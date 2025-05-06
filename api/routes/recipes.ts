import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
// import OpenAI from 'openai'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from "@google/generative-ai"; // Import Google AI SDK
import * as cheerio from 'cheerio'; // Import cheerio
import scraperapiClient from 'scraperapi-sdk'; // Import the SDK

// --- Define the expected *single pass* structured ingredient type --- 
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null, amount?: string | number | null, unit?: string | null }> | null; // Added amount/unit to substitution suggestions
};

// --- Define the type for the combined parsing pass --- 
// (This now expects structured ingredients directly)
type CombinedParsedRecipe = {
  title: string | null;
  ingredients: StructuredIngredient[] | null; // Expect structured ingredients directly
  instructions: string[] | null;
  substitutions_text: string | null;
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: { calories?: string | null; protein?: string | null; [key: string]: any } | null;
};

// --- Helper Function: Extract Recipe Content ---
// Tries JSON-LD first, then falls back to selectors
function extractRecipeContent(html: string): { title: string | null, ingredientsText: string | null, instructionsText: string | null } {
  const $ = cheerio.load(html);
  let title: string | null = null;
  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;

  // Tier 1: Try JSON-LD
  let recipeJson: any = null;
  $('script[type="application/ld+json"]').each((_, element) => {
    if (recipeJson) return; // Stop if already found
    try {
      const scriptContent = $(element).html();
      if (!scriptContent) return;
      const jsonData = JSON.parse(scriptContent);

      // Check if jsonData is the recipe object or contains it in a graph
      if (jsonData['@type'] === 'Recipe') {
        recipeJson = jsonData;
      } else if (Array.isArray(jsonData) && jsonData.some(item => item['@type'] === 'Recipe')) {
         recipeJson = jsonData.find(item => item['@type'] === 'Recipe');
      } else if (jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
         recipeJson = jsonData['@graph'].find((item: any) => item['@type'] === 'Recipe');
      }
    } catch (e) {
      // Ignore parsing errors
      console.warn("Ignoring JSON-LD parsing error:", e);
    }
  });

  if (recipeJson) {
    console.log("Found recipe via JSON-LD.");
    title = recipeJson.name || null;
    // Ingredients can be string[]
    if (Array.isArray(recipeJson.recipeIngredient)) {
       ingredientsText = recipeJson.recipeIngredient.join('\n');
    }
    // Instructions can be string, string[], or array of HowToStep objects
    if (typeof recipeJson.recipeInstructions === 'string') {
        instructionsText = recipeJson.recipeInstructions;
    } else if (Array.isArray(recipeJson.recipeInstructions)) {
        // Check if it's an array of strings or HowToStep objects
        if (recipeJson.recipeInstructions.every((item: any) => typeof item === 'string')) {
            instructionsText = recipeJson.recipeInstructions.join('\n');
        } else if (recipeJson.recipeInstructions.every((item: any) => typeof item === 'object' && item.text)) {
            // Array of HowToStep objects (common format)
            instructionsText = recipeJson.recipeInstructions.map((step: any) => step.text).join('\n');
        } else if (recipeJson.recipeInstructions.every((item: any) => typeof item === 'object' && item['@type'] === 'HowToSection')) {
             // Handle sections containing steps
             instructionsText = recipeJson.recipeInstructions
                .flatMap((section: any) => section.itemListElement || [])
                .map((step: any) => step.text)
                .join('\n');
        }
    }
    // Fallback title extraction if needed
    if (!title) title = $('title').first().text() || $('h1').first().text() || null;

    console.log(`Extracted from JSON-LD - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}`);
    return { title, ingredientsText, instructionsText };
  }

  // Tier 2: Fallback to Selectors
  console.log("JSON-LD not found or incomplete. Falling back to selectors.");
  if (!title) {
    title = $('title').first().text() || $('h1').first().text() || null;
  }

  // Ingredient Selectors (add more as needed)
  const ingredientSelectors = [
    '[itemprop="recipeIngredient"]',
    '.wprm-recipe-ingredient', // Common plugin class
    '.tasty-recipes-ingredients li', // Another common plugin
    '.easyrecipe-ingredient',
    '.recipe-ingredients li',
    '.ingredients li',
    '.ingredient-list li'
  ];

  for (const selector of ingredientSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
          ingredientsText = elements.map((_, el) => $(el).text().trim()).get().join('\n');
          if (ingredientsText) break; // Stop if we found some
      }
  }

  // Instruction Selectors (add more as needed)
  const instructionSelectors = [
      '[itemprop="recipeInstructions"]',
      '.wprm-recipe-instructions li', // Common plugin class
      '.tasty-recipes-instructions li', // Another common plugin
      '.easyrecipe-instructions li',
      '.recipe-instructions li',
      '.instructions li',
      '.direction-list li',
      // Sometimes instructions are just paragraphs within a container
      '.wprm-recipe-instructions p',
      '.tasty-recipes-instructions p',
      '.instructions p',
      '.directions p'
  ];

   for (const selector of instructionSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
          instructionsText = elements.map((_, el) => $(el).text().trim()).get().join('\n');
          if (instructionsText) break; // Stop if we found some
      }
  }

  console.log(`Extracted from Selectors - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}`);
  return { title, ingredientsText, instructionsText };
}
// --- End Helper Function ---

// --- Helper Function: Fetch HTML with Fallback ---
async function fetchHtmlWithFallback(
  url: string, 
  apiKey: string | undefined, // scraperApiKey
  client: any // scraperClient instance
): Promise<{ htmlContent: string; fetchMethodUsed: string; error: Error | null }> {
  let htmlContent = '';
  let fetchMethodUsed = 'Direct Fetch';
  let error: Error | null = null;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  // Attempt 1: Direct Fetch
  console.log(`Attempting direct fetch from: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'DNT': '1'
      }
    });
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    htmlContent = await response.text();
    console.log(`Successfully fetched HTML via Direct Fetch. Length: ${htmlContent.length}`);
  } catch (directErr) {
    const directFetchError = directErr instanceof Error ? directErr : new Error(String(directErr));
    console.warn(`Direct fetch failed: ${directFetchError.message}`);
    error = directFetchError; // Assume error initially

    // Attempt 2: ScraperAPI Fallback (only on 403 or if direct fetch failed for other reasons and key is present)
    // We'll attempt fallback if directFetchError message contains '403' OR if any direct fetch error occurred and scraperApiKey is present.
    if (apiKey && (directFetchError.message.includes('Fetch failed: 403') || directFetchError)) {
      console.log(`Direct fetch failed. Falling back to ScraperAPI... Cause: ${directFetchError.message}`);
      fetchMethodUsed = 'ScraperAPI Fallback';
      try {
        const scraperResponse: any = await client.get(url);
        if (typeof scraperResponse === 'object' && scraperResponse !== null && typeof scraperResponse.body === 'string' && scraperResponse.body.length > 0) {
          htmlContent = scraperResponse.body;
          console.log(`Successfully fetched HTML via ScraperAPI Fallback. Length: ${htmlContent.length}`);
          error = null; // Clear error as fallback succeeded
        } else if (typeof scraperResponse === 'string' && scraperResponse.length > 0) {
          htmlContent = scraperResponse;
          console.log(`Successfully fetched HTML directly as string via ScraperAPI Fallback. Length: ${htmlContent.length}`);
          error = null; // Clear error as fallback succeeded
        } else {
          let responseString = '';
          try {
            responseString = JSON.stringify(scraperResponse);
          } catch (e) {
            responseString = String(scraperResponse);
          }
          throw new Error(`ScraperAPI fallback returned unexpected response: ${responseString}`);
        }
      } catch (scraperErr) {
        const scraperErrorMessage = scraperErr instanceof Error ? scraperErr.message : String(scraperErr);
        console.error(`ScraperAPI fallback also failed:`, scraperErr);
        // Combine error messages
        error = new Error(`Direct fetch failed (${directFetchError.message}) and ScraperAPI fallback failed (${scraperErrorMessage})`);
      }
    } else if (!apiKey && directFetchError) {
         console.warn('Direct fetch failed and ScraperAPI key is missing. Cannot fallback.');
         // error is already set to directFetchError
    }
  }
  return { htmlContent, fetchMethodUsed, error };
}
// --- End Helper Function: Fetch HTML with Fallback ---

const router = Router()

// --- Initialize ScraperAPI Client ---
const scraperApiKey = process.env.SCRAPERAPI_KEY;
if (!scraperApiKey) {
  console.error('SCRAPERAPI_KEY environment variable is not set!');
  // Optionally throw an error or exit if the key is critical for operation
  // throw new Error('Server configuration error: Missing ScraperAPI key.');
}
const scraperClient = scraperapiClient(scraperApiKey || ''); // Initialize client - provide empty string if null

// --- Initialize Google AI Client ---
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set!');
}
const genAI = new GoogleGenerativeAI(googleApiKey || '');
const geminiConfig: GenerationConfig = {
  // Ensure JSON output
  responseMimeType: "application/json",
  temperature: 0.1, // Keep low temperature for consistency
};
// Define safety settings if needed (adjust as necessary)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: geminiConfig,
    safetySettings: safetySettings,
});

// Get all recipes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients (*)
      `)
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Get single recipe with ingredients and substitutions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients (
          *,
          substitutions (*)
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Create new recipe
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, servings, ingredients } = req.body
    
    // Insert recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({ title, servings })
      .select()
      .single()
    
    if (recipeError) throw recipeError
    
    // Insert ingredients if provided
    if (ingredients && ingredients.length > 0) {
      const ingredientsWithRecipeId = ingredients.map((ing: any) => ({
        ...ing,
        recipe_id: recipe.id
      }))
      
      const { error: ingredientsError } = await supabase
        .from('ingredients')
        .insert(ingredientsWithRecipeId)
      
      if (ingredientsError) throw ingredientsError
    }
    
    res.json(recipe)
  } catch (error) {
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// --- Main Parsing Route ---
router.post('/parse', async (req: Request, res: Response) => {
  const requestStartTime = Date.now();
  let timings = {
    dbCheck: -1, // Added for timing database check
    fetchHtml: -1,
    extractContent: -1,
    geminiCombinedParse: -1,
    dbInsert: -1, // Added for timing database insert
    total: -1
  };
  let usage = {
      combinedParseInputTokens: 0,
      combinedParseOutputTokens: 0,
  }
  let fetchMethodUsed = 'Direct Fetch'; // Track which method succeeded

  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL in request body' });
    }

    // --- Check Supabase for Cached Recipe ---
    const dbCheckStartTime = Date.now();
    try {
      const { data: cachedRecipe, error: dbError } = await supabase
        .from('processed_recipes_cache') // IMPORTANT: Use your actual table name
        .select('recipe_data') // IMPORTANT: Use your actual column name for the JSON data
        .eq('url', url)
        .maybeSingle(); // Use maybeSingle() if a URL might not exist

      timings.dbCheck = Date.now() - dbCheckStartTime;

      if (dbError) {
        console.error('Error checking cache in Supabase:', dbError);
        // Decide if you want to fail or proceed if cache check fails
        // For now, we'll log and proceed
      }

      if (cachedRecipe && cachedRecipe.recipe_data) {
        console.log(`Cache hit for URL: ${url}. Returning cached data.`);
        timings.total = Date.now() - requestStartTime;
        console.log(`Request Timings (ms): DB Check=${timings.dbCheck}, Total=${timings.total}`);
        return res.json({
          message: 'Recipe retrieved from cache.',
          receivedUrl: url,
          recipe: cachedRecipe.recipe_data // IMPORTANT: Ensure this matches your column name
        });
      }
      console.log(`Cache miss for URL: ${url}. Proceeding with parsing.`);
    } catch (cacheError) {
      timings.dbCheck = Date.now() - dbCheckStartTime;
      console.error('Exception during cache check:', cacheError);
      // Proceed with parsing if cache check throws an error
    }
    // --- End Cache Check ---

    // Check ScraperAPI key
    // No longer need to check scraperApiKey here as fetchHtmlWithFallback handles it
    // if (!scraperApiKey) {
    //   return res.status(500).json({ error: 'Server configuration error: Missing ScraperAPI key.' });
    // }
    // Check Google AI key
    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    // --- Step 1: Fetch HTML (with ScraperAPI fallback on 403) ---
    console.log(`Attempting direct fetch from: ${url}`);
    const fetchStartTime = Date.now();
    // let htmlContent = ''; // Now handled by helper
    // let fetchError: Error | null = null; // Now handled by helper
    // const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'; // Keep user agent

    const fetchResult = await fetchHtmlWithFallback(url, scraperApiKey, scraperClient);
    let htmlContent = fetchResult.htmlContent;
    let fetchError = fetchResult.error;
    fetchMethodUsed = fetchResult.fetchMethodUsed; // Update fetchMethodUsed from helper

    // --- Check Fetch Result --- 
    timings.fetchHtml = Date.now() - fetchStartTime;
    // Explicitly check for fetchError first
    if (fetchError) {
        // Ensured fetchError is an Error if it's not null by its assignments.
        console.error(`Fetch process failed: ${fetchError.message}`); 
        return res.status(500).json({ error: `Failed to retrieve recipe content: ${fetchError.message}` });
    }
    // Then check for empty content if there was no error
    if (htmlContent.length === 0) {
        const finalErrorMessage = 'HTML content was empty after fetch attempts';
        console.error(`Fetch process failed: ${finalErrorMessage}`);
        return res.status(500).json({ error: `Failed to retrieve recipe content: ${finalErrorMessage}` });
    }
    // If we reach here, fetch was successful and content is not empty
    console.log(`Using HTML content obtained via: ${fetchMethodUsed}`);
    // --- End Fetch HTML --- 

    // --- Step 1.5: Pre-process HTML to Extract Content ---
    console.log("Pre-processing HTML with cheerio...");
    const extractStartTime = Date.now(); // Start timing extraction
    const extractedContent = extractRecipeContent(htmlContent);
    timings.extractContent = Date.now() - extractStartTime; // End timing extraction

    if (!extractedContent.ingredientsText || !extractedContent.instructionsText) {
        console.error("Failed to extract ingredients or instructions using cheerio.");
        return res.status(500).json({ error: "Could not automatically extract recipe ingredients or instructions from the provided URL." });
    }
    console.log("Successfully extracted content sections.");
    // --- End Pre-processing ---


    // --- Step 2: Combined Gemini Parsing (Using Extracted Content) ---

    // --- UPDATED Prompt asking for everything in one go --- 
    const combinedPrompt = `You are provided with pre-extracted text sections for a recipe's title, ingredients, and instructions. Your goal is to parse ALL information into a single, specific JSON object.

**Desired JSON Structure:**
{ 
  "title": "string | null", 
  "ingredients": [
    { 
      "name": "string", 
      "amount": "string | null", 
      "unit": "string | null", 
      "suggested_substitutions": [
        { 
          "name": "string", 
          "amount": "string | number | null", 
          "unit": "string | null", 
          "description": "string | null" 
        }
      ] | null 
    }
  ] | null, 
  "instructions": "array of strings, each a single step without numbering | null", 
  "substitutions_text": "string | null", 
  "recipeYield": "string | null", 
  "prepTime": "string | null", 
  "cookTime": "string | null", 
  "totalTime": "string | null", 
  "nutrition": { "calories": "string | null", "protein": "string | null" } | null 
}

**Parsing Rules:**
1.  **Sections:** If a section (title, ingredients, instructions) was not successfully extracted or is empty, use null for its value in the JSON.
2.  **Instructions Array:** 
    - ONLY include actionable cooking/preparation steps. Split the provided instructions text into logical step-by-step actions. EXCLUDE serving suggestions, anecdotes, tips, etc. Ensure steps do not have numbering.
    - **Clarity for Sub-groups:** If an instruction refers to combining a sub-group of ingredients (e.g., 'dressing ingredients', 'tahini ranch ingredients'), and those ingredients are part of the main ingredient list you parsed, rephrase the instruction to explicitly list those specific ingredients. For example, instead of 'combine tahini ranch ingredients', if tahini, chives, and parsley are the ranch ingredients, the instruction should be 'combine tahini, dried chives, and dried parsley, whisking in water to thin...'.
3.  **Ingredients Array:** 
    - Parse the provided ingredients text into the structured array shown above.
    - **Convert Fractions:** Convert all fractional amounts (e.g., "1 1/2", "3/4") to their decimal representation (e.g., "1.5", "0.75") for the main ingredient's "amount".
    - **Handle Variations:** Handle ranges or optional parts. Use null if a part (amount, unit) isn't clearly identifiable.
    - **Quantity Handling:** If an ingredient clearly lacks a quantity (e.g., 'fresh cilantro'), set main "amount" to null and main "unit" to "to taste" or "as needed".
    - **Exclusions:** Do NOT include ingredients that are variations of 'sea salt', 'salt', 'black pepper', or 'pepper' in the final array.
4.  **Ingredient Substitutions:**
    - For each parsed ingredient (except salt/pepper), suggest 1-2 sensible culinary substitutions.
    - Each substitution suggestion MUST be an object with "name" (string), "amount" (string/number/null - the *equivalent* amount), "unit" (string/null), and optional "description" (string/null).
    - Base substitution amount/unit on volume/weight where possible, adjust for flavor/texture.
    - If no good substitutions come to mind, use null for "suggested_substitutions".
5.  **Substitutions Text:** Attempt to find any *explicit substitution notes* mentioned within the original INSTRUCTIONS text and place them in the top-level "substitutions_text" field, otherwise use null.
6.  **Metadata:** 
    - **recipeYield:** Diligently extract the recipe yield (servings). Look for terms like "serves", "makes", "yields", "servings", etc., and the associated number (e.g., "serves 4-6", "makes 2 dozen"). If a range is given, use the lower end or the most reasonable single number (e.g., "4-6" becomes "4"). If no explicit yield is found after careful searching of the entire provided text, use null.
    - Extract prep time, cook time, total time, and basic nutrition info (calories, protein) if available in the *original* text, otherwise use null.
7.  **Output:** Ensure the output is ONLY the single, strictly valid JSON object described.

**Provided Text Sections:**

Title:
${extractedContent.title || 'N/A'}

Ingredients Text:
${extractedContent.ingredientsText}

Instructions Text:
${extractedContent.instructionsText}
`;
    // --- End UPDATED Prompt --- 

    console.log('Sending combined parsing request to Gemini...');
    let combinedParsedResult: CombinedParsedRecipe | null = null; // Use the new type
    let combinedGeminiError = null;
    const geminiCombinedStartTime = Date.now();

    try {
        if (combinedPrompt.length > 100000) { // Simple length check
            throw new Error(`Combined prompt is too large (${combinedPrompt.length} chars).`);
        }

        // --- Call Gemini ONCE --- 
        const result = await geminiModel.generateContent(combinedPrompt);
        const response = result.response;
        const responseText = response.text();

        usage.combinedParseInputTokens = response.usageMetadata?.promptTokenCount || 0;
        usage.combinedParseOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;

        console.log('Gemini (Combined Parse) raw JSON response content:', responseText);
        if (responseText) {
            try {
                combinedParsedResult = JSON.parse(responseText) as CombinedParsedRecipe;
                // --- Basic Validation for the combined result --- 
                if (typeof combinedParsedResult !== 'object' || combinedParsedResult === null) {
                     throw new Error("Parsed JSON is not an object.");
                }
                // Add more specific validation if needed, e.g., checking if ingredients is an array of objects
                 if (combinedParsedResult.ingredients && !Array.isArray(combinedParsedResult.ingredients)) {
                     console.warn("Gemini returned non-array for ingredients, setting to null.");
                     combinedParsedResult.ingredients = null;
                 } else if (Array.isArray(combinedParsedResult.ingredients)) {
                     // Optional: Deeper validation of ingredient structure
                     const isValidStructure = combinedParsedResult.ingredients.every(ing => 
                         typeof ing === 'object' && ing !== null && 'name' in ing && 'amount' in ing && 'unit' in ing
                         // Add check for suggested_substitutions structure if desired
                     );
                     if (!isValidStructure) {
                         console.warn("Some ingredients in the array might not have the expected structure.");
                         // Decide how to handle: proceed, nullify, or error out?
                     }
                 }
                 // Validation for instructions array (optional but good)
                 if (combinedParsedResult.instructions && !Array.isArray(combinedParsedResult.instructions)) {
                     console.warn("Gemini returned non-array for instructions, setting to null.");
                     combinedParsedResult.instructions = null;
                 }
                 console.log('Successfully parsed combined JSON from Gemini response.');
            } catch(parseError) {
                console.error("Failed to parse JSON response from Gemini (Combined Parse):", parseError);
                console.error("Raw Response:", responseText);
                combinedGeminiError = "Invalid JSON received from AI parser.";
            }
        } else {
            combinedGeminiError = 'Empty response received from AI parser.';
        }

    } catch (err) {
        console.error('Error calling Gemini API (Combined Parse) or processing result:', err);
        combinedGeminiError = err instanceof Error ? err.message : 'An unknown error occurred calling Gemini';
        if ((err as any)?.response?.promptFeedback?.blockReason) {
             combinedGeminiError = `Gemini blocked the prompt/response due to safety settings: ${ (err as any).response.promptFeedback.blockReason }`;
        }
    } finally {
        timings.geminiCombinedParse = Date.now() - geminiCombinedStartTime;
    }

    if (combinedGeminiError) {
      return res.status(500).json({ error: `Failed combined recipe parse: ${combinedGeminiError}` });
    }
    if (!combinedParsedResult) {
      return res.status(500).json({ error: 'Failed to get parsed data from AI.' });
    }
    // --- End Combined Gemini Parsing ---

    // --- REMOVED Step 3: Secondary Gemini Parsing for Ingredients --- 

    // --- Step 4: Send Final Response --- 
    // Use the combinedParsedResult directly
    timings.total = Date.now() - requestStartTime;
    console.log(`Request Timings (ms): Fetch (${fetchMethodUsed})=${timings.fetchHtml}, Extract=${timings.extractContent}, Gemini Combined Parse=${timings.geminiCombinedParse}, Total=${timings.total}`);
    console.log(`Token Usage: Combined Parse=${usage.combinedParseInputTokens}/${usage.combinedParseOutputTokens} (Input/Output)`);
    console.log("Sending final parsed recipe data to client.");

    // --- Cache the new result before sending response ---
    if (combinedParsedResult) {
      const dbInsertStartTime = Date.now();
      try {
        const { error: insertError } = await supabase
          .from('processed_recipes_cache') // IMPORTANT: Use your actual table name
          .insert({
            url: url,
            recipe_data: combinedParsedResult, // IMPORTANT: Use your actual column name
            // last_processed_at: new Date().toISOString() // Optional: add a timestamp
          });

        timings.dbInsert = Date.now() - dbInsertStartTime;

        if (insertError) {
          console.error('Error saving recipe to cache:', insertError);
          // Don't fail the request if caching fails, just log it.
        } else {
          console.log(`Successfully cached new recipe for URL: ${url}`);
        }
      } catch (cacheInsertError) {
        timings.dbInsert = Date.now() - dbInsertStartTime;
        console.error('Exception during cache insertion:', cacheInsertError);
      }
    }
    // --- End Caching New Result ---

    res.json({
      message: 'Recipe processing complete (Combined Parse).',
      receivedUrl: url,
      recipe: combinedParsedResult // Send the result from the single call
    });
    // --- End Send Final Response ---

  } catch (error) {
    console.error('Error in /parse route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    timings.total = Date.now() - requestStartTime;
    console.log(`Request Timings on Error (ms): DB Check=${timings.dbCheck > 0 ? timings.dbCheck : 'N/A'}, Fetch (${fetchMethodUsed})=${timings.fetchHtml > 0 ? timings.fetchHtml : 'N/A'}, Extract=${timings.extractContent > 0 ? timings.extractContent : 'N/A'}, Gemini Combined Parse=${timings.geminiCombinedParse > 0 ? timings.geminiCombinedParse : 'N/A'}, DB Insert=${timings.dbInsert > 0 ? timings.dbInsert : 'N/A'}, Total=${timings.total}`);
    console.log(`Token Usage on Error: Combined Parse=${usage.combinedParseInputTokens > 0 ? usage.combinedParseInputTokens : 'N/A'}/${usage.combinedParseOutputTokens > 0 ? usage.combinedParseOutputTokens : 'N/A'} (Input/Output)`);
    res.status(500).json({ error: message });
  }
});

// --- Rewrite Instructions Endpoint ---
router.post('/rewrite-instructions', async (req: Request, res: Response) => {
  // TODO: Adapt this endpoint to use Gemini
  // Similar steps: Check key, create prompt, call geminiModel.generateContent, parse JSON response
  try {
    const { originalInstructions, originalIngredientName, substitutedIngredientName } = req.body; // Keep validation
    if (!originalInstructions || !Array.isArray(originalInstructions) || originalInstructions.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid original instructions' });
    }
    if (!originalIngredientName || !substitutedIngredientName) {
      return res.status(400).json({ error: 'Missing original or substituted ingredient name' });
    }

    // Check Google AI key
    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    // --- Construct the prompt for Gemini --- (Using the same logic as the previous OpenAI prompt)
    const rewritePrompt = `You are an expert cooking assistant. You are given recipe instructions and a specific ingredient substitution.
Original Ingredient: ${originalIngredientName}
Substituted Ingredient: ${substitutedIngredientName}

Your task is to rewrite the original instructions to accommodate the substituted ingredient. Consider:
- **Preparation differences:** Does the substitute need different prep (e.g., pressing tofu, soaking beans)? Add or modify steps accordingly.
- **Cooking time/temperature:** Adjust cooking times and temperatures if the substitute cooks differently.
- **Liquid adjustments:** Might the substitute absorb more or less liquid?
- **Flavor profile:** Keep the core recipe goal, but account for flavor changes if necessary (though focus primarily on process).
- **Safety:** Ensure the rewritten steps are safe and make culinary sense.

Rewrite the steps clearly. Output ONLY a valid JSON object with a single key "rewrittenInstructions", where the value is an array of strings, each string being a single step without numbering.

Original Instructions (Array):
${JSON.stringify(originalInstructions)}
`;

    console.log(`Sending rewrite request to Gemini for ${originalIngredientName} -> ${substitutedIngredientName}`);

    let rewrittenInstructions: string[] | null = null;
    let rewriteError: string | null = null;
    let rewriteInputTokens = 0;
    let rewriteOutputTokens = 0;
    let rewriteTime = -1; // Added for timing

    // --- Make the Gemini call --- 
    const rewriteStartTime = Date.now(); // Start timing
    try {
        if (rewritePrompt.length > 100000) { // Basic prompt length check
           throw new Error(`Rewrite prompt too large (${rewritePrompt.length} chars).`);
        }

        const result = await geminiModel.generateContent(rewritePrompt);
        const response = result.response;
        const responseText = response.text();

        // Log token usage
        rewriteInputTokens = response.usageMetadata?.promptTokenCount || 0;
        rewriteOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        console.log(`Gemini Rewrite Token Usage: ${rewriteInputTokens}/${rewriteOutputTokens} (Input/Output)`);

        console.log('Gemini (Rewrite) raw JSON response content:', responseText);

        if (responseText) {
            try {
                const parsedResult: any = JSON.parse(responseText);
                if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                    rewrittenInstructions = parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'); // Ensure all elements are strings
                    console.log('Successfully parsed rewritten instructions from Gemini response.');
                } else {
                    console.error("Parsed JSON response did not contain expected 'rewrittenInstructions' array:", parsedResult);
                    throw new Error("Parsed JSON result did not have the expected structure.");
                }
            } catch (parseErr) {
                console.error('Failed to parse rewritten instructions JSON from Gemini response:', parseErr);
                console.error('Raw content that failed parsing:', responseText);
                rewriteError = 'Invalid JSON format received from AI instruction rewriter.';
            }
        } else {
            rewriteError = 'Empty response received from AI instruction rewriter.';
        }

    } catch (err) {
       rewriteError = err instanceof Error ? err.message : 'Unknown Gemini rewrite error';
       console.error('Gemini rewrite API call error:', err);
       // Handle safety blocks
       if ((err as any)?.response?.promptFeedback?.blockReason) {
           rewriteError = `Gemini blocked the prompt/response due to safety settings: ${ (err as any).response.promptFeedback.blockReason }`;
       }
    } finally {
        rewriteTime = Date.now() - rewriteStartTime; // End timing
        console.log(`Gemini Rewrite Time: ${rewriteTime}ms`); // Log time
    }

    // --- Send response or error ---
    if (rewriteError || !rewrittenInstructions) {
      console.error(`Failed to rewrite instructions with Gemini: ${rewriteError || 'Result was null'}`);
      return res.status(500).json({ error: `Failed to rewrite instructions: ${rewriteError || 'Unknown error'}` });
    } else {
        res.json({ rewrittenInstructions });
    }

  } catch (error) {
    console.error('Error in /rewrite-instructions route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    res.status(500).json({ error: message });
  }
});

// --- Scale Instructions Endpoint ---
router.post('/scale-instructions', async (req: Request, res: Response) => {
  // TODO: Adapt this endpoint to use Gemini
   // Similar steps: Check key, create prompt, call geminiModel.generateContent, parse JSON response
   try {
     const { instructionsToScale, originalIngredients, scaledIngredients } = req.body; // Keep validation
     if (!Array.isArray(instructionsToScale) || !Array.isArray(originalIngredients) || !Array.isArray(scaledIngredients)) {
      return res.status(400).json({ error: 'Invalid input: instructions, originalIngredients, and scaledIngredients must be arrays.' });
     }
     // Add other input checks as before...
     if (instructionsToScale.length === 0) {
        console.log("No instructions provided to scale.");
        return res.json({ scaledInstructions: [] }); // Return empty if no instructions
     }
     if (originalIngredients.length !== scaledIngredients.length) {
        console.warn("Original and scaled ingredient lists have different lengths. Scaling might be inaccurate.");
     }

     // Check Google AI key
    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    // --- Construct the prompt for Gemini --- (Using the same logic as before)
    const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
    const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

    const scalePrompt = `You are an expert recipe editor. You are given recipe instructions that were originally written for ingredients with these quantities: [${originalIngredientsDesc}].

The ingredients have now been scaled to new quantities: [${scaledIngredientsDesc}].

Your task is to rewrite the provided recipe instructions, carefully adjusting any specific ingredient quantities mentioned in the text to match the *new* scaled quantities. Maintain the original meaning, structure, and step count. Be precise with the numbers.

For example, if an original instruction was "Add 2 cups flour" and the scaled ingredients now list "4 cups flour", the instruction should become "Add 4 cups flour". If an instruction mentions "the onion" and the quantity didn't change or wasn't numeric, leave it as is. Only adjust explicit numeric quantities that correspond to scaled ingredients.

Output ONLY a valid JSON object with a single key "scaledInstructions", where the value is an array of strings, each string being a single rewritten step.

Instructions to Scale (Array):
${JSON.stringify(instructionsToScale)}
`;

    console.log('Sending instruction scaling request to Gemini...');

    let scaledInstructionsResult: string[] | null = null;
    let scaleError: string | null = null;
    let scaleInputTokens = 0;
    let scaleOutputTokens = 0;
    let scaleTime = -1; // Added for timing

    // --- Make the Gemini call --- 
    const scaleStartTime = Date.now(); // Start timing
    try {
        if (scalePrompt.length > 100000) { // Basic prompt length check
           throw new Error(`Scale prompt too large (${scalePrompt.length} chars).`);
        }

       const result = await geminiModel.generateContent(scalePrompt);
       const response = result.response;
       const responseText = response.text();

       // Log token usage
       scaleInputTokens = response.usageMetadata?.promptTokenCount || 0;
       scaleOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;
       console.log(`Gemini Scale Token Usage: ${scaleInputTokens}/${scaleOutputTokens} (Input/Output)`);

       console.log('Gemini (Scale) raw JSON response content:', responseText);

       if (responseText) {
           try {
             const parsedResult: any = JSON.parse(responseText);
             if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
                scaledInstructionsResult = parsedResult.scaledInstructions.map((item: any) => String(item)); // Ensure strings
                console.log('Successfully parsed scaled instructions from Gemini response.');
             } else {
                throw new Error("Parsed JSON result did not have the expected 'scaledInstructions' array.");
             }
           } catch (parseErr) {
             console.error('Failed to parse scaled instructions JSON from Gemini response:', parseErr);
             console.error('Raw content that failed parsing:', responseText);
             scaleError = 'Invalid JSON format received from AI instruction scaler.';
           }
        } else {
          scaleError = 'Empty response received from AI instruction scaler.';
        }

    } catch (err) {
        scaleError = err instanceof Error ? err.message : 'Unknown Gemini scale error';
        console.error('Gemini scale API call error:', err);
        // Handle safety blocks
        if ((err as any)?.response?.promptFeedback?.blockReason) {
            scaleError = `Gemini blocked the prompt/response due to safety settings: ${ (err as any).response.promptFeedback.blockReason }`;
        }
    } finally {
        scaleTime = Date.now() - scaleStartTime; // End timing
        console.log(`Gemini Scale Time: ${scaleTime}ms`); // Log time
    }

    // --- Send response or error ---
    if (scaleError || !scaledInstructionsResult) {
      console.error(`Failed to scale instructions with Gemini: ${scaleError || 'Result was null'}`);
      // Returning original instructions on failure to avoid breaking the flow entirely
      console.warn("Returning original instructions due to scaling failure.");
      res.json({ scaledInstructions: instructionsToScale }); 
      // Alternatively, return a 500 error:
      // return res.status(500).json({ error: `Failed to scale instructions: ${scaleError || 'Unknown error'}` });
    } else {
        res.json({ scaledInstructions: scaledInstructionsResult });
    }

   } catch (error) {
      console.error("Error in /scale-instructions route:", error);
      res.status(500).json({ error: 'Internal server error processing instruction scaling request.' });
  }
});

export const recipeRouter = router