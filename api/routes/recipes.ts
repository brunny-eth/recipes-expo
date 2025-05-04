import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import OpenAI from 'openai'
import * as cheerio from 'cheerio'; // Import cheerio

// --- Define the expected structured ingredient type ---
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null }> | null;
};
// --- ---

// --- Define the type for the first parsing pass ---
type InitialParsedRecipe = {
  title: string | null;
  ingredients: string[] | null; // Expect strings first
  instructions: string[] | null;
  substitutions_text: string | null;
  // Added optional fields
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: { calories?: string | null; protein?: string | null; [key: string]: any } | null; // Simple nutrition object
};
// --- ---

// --- Define the type for the final response ---
type FinalRecipeOutput = {
  title: string | null;
  ingredients: StructuredIngredient[] | string[] | null; // Can be structured or fallback to strings
  instructions: string[] | null;
  substitutions_text: string | null;
  // Added optional fields
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: { calories?: string | null; protein?: string | null; [key: string]: any } | null;
};
// --- ---

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

const router = Router()

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
  // Overall try-catch for request processing errors
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL in request body' });
    }

    // --- Step 1: Fetch HTML ---
    console.log(`Attempting to fetch HTML from: ${url}`);
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    let htmlContent = '';
    let fetchError = null;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/'
        }
      });
      if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      htmlContent = await response.text();
      console.log(`Successfully fetched HTML. Length: ${htmlContent.length}`);
    } catch (err) {
      console.error(`Error fetching URL ${url}:`, err);
      fetchError = err instanceof Error ? err.message : 'An unknown error occurred during fetch';
    }
    if (fetchError) {
      return res.status(500).json({ error: `Failed to retrieve recipe content: ${fetchError}` });
    }
    // --- End Fetch HTML ---


    // --- Step 1.5: Pre-process HTML to Extract Content ---
    console.log("Pre-processing HTML with cheerio...");
    const extractedContent = extractRecipeContent(htmlContent);

    if (!extractedContent.ingredientsText || !extractedContent.instructionsText) {
        console.error("Failed to extract ingredients or instructions using cheerio.");
        return res.status(500).json({ error: "Could not automatically extract recipe ingredients or instructions from the provided URL." });
    }
    console.log("Successfully extracted content sections.");
    // --- End Pre-processing ---


    // --- Step 2: Initial OpenAI Parsing (Using Extracted Content) ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set.');
      return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key.' });
    }
    const openai = new OpenAI({ apiKey });

    // --- New Prompt using extracted text ---
    const initialPrompt = `You are provided with pre-extracted text sections for a recipe's title, ingredients, and instructions. Format this into the specified JSON structure: { "title": "string | null", "ingredients": "array of strings | null", "instructions": "array of strings, where each string is a single cooking step without any numbering | null", "substitutions_text": "string | null", "recipeYield": "string | null", "prepTime": "string | null", "cookTime": "string | null", "totalTime": "string | null", "nutrition": { "calories": "string | null", "protein": "string | null" } | null }.
If a section was not successfully extracted or is empty, use null for its value.
For the 'instructions' array: ONLY include actionable cooking or preparation steps. Split the provided instructions text into logical step-by-step actions. Critically, EXCLUDE any sentences that are serving suggestions, personal anecdotes, author tips, or anything not part of the core cooking process. Ensure steps do not have numbering.
For the 'ingredients' array: Split the provided ingredients text into an array of individual ingredient strings.
Attempt to find any explicit substitution notes mentioned within the INSTRUCTIONS text provided and place them in 'substitutions_text', otherwise use null.
Extract recipe yield (servings), prep time, cook time, total time, and basic nutrition info (calories, protein) if available in the text, otherwise use null.
Only use the provided text sections. Ensure the output is strictly valid JSON.

Title:
${extractedContent.title || 'N/A'}

Ingredients Text:
${extractedContent.ingredientsText}

Instructions Text:
${extractedContent.instructionsText}
`;
    // --- End New Prompt ---

    console.log('Sending initial request to OpenAI (GPT-4 Turbo with JSON mode using extracted content)...');
    let initialParsedResult: InitialParsedRecipe | null = null;
    let initialOpenAIError = null;

    try {
      // Ensure prompt isn't excessively large (though much less likely now)
      if (initialPrompt.length > 150000) { // Arbitrary safety limit, adjust if needed
           throw new Error(`Combined extracted text is too large (${initialPrompt.length} chars). Cannot send to OpenAI.`);
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "You are an assistant that formats pre-extracted recipe text (title, ingredients, instructions) into a specific JSON structure." },
          { role: "user", content: initialPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      console.log('OpenAI (Pass 1) raw JSON response content:', responseContent);
      if (responseContent) {
        // --- Add Robust JSON Parsing ---
        try {
            initialParsedResult = JSON.parse(responseContent) as InitialParsedRecipe;
             // Basic validation
             if (typeof initialParsedResult !== 'object' || initialParsedResult === null) {
                 throw new Error("Parsed JSON is not an object.");
             }
             // Ensure arrays are arrays or null
             if (initialParsedResult.ingredients && !Array.isArray(initialParsedResult.ingredients)) {
                  console.warn("OpenAI returned non-array for ingredients, setting to null.");
                  initialParsedResult.ingredients = null;
             }
             if (initialParsedResult.instructions && !Array.isArray(initialParsedResult.instructions)) {
                  console.warn("OpenAI returned non-array for instructions, setting to null.");
                  initialParsedResult.instructions = null;
             }
            console.log('Successfully parsed initial JSON from OpenAI response.');
        } catch(parseError) {
             console.error("Failed to parse JSON response from OpenAI (Pass 1):", parseError);
             console.error("Raw Response:", responseContent);
             initialOpenAIError = "Invalid JSON received from AI parser (Pass 1).";
        }
        // --- End Robust JSON Parsing ---
      } else {
        initialOpenAIError = 'Empty response received from AI parser (Pass 1).';
      }
    } catch (err) {
      console.error('Error calling OpenAI API (Pass 1) or processing result:', err);
      initialOpenAIError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI (Pass 1)';
       // Check specifically for RateLimitError - maybe log differently or handle
       if ((err as any)?.code === 'rate_limit_exceeded') {
           initialOpenAIError = `OpenAI rate limit exceeded. Please try again later. Details: ${initialOpenAIError}`;
       }
    }
     if (initialOpenAIError) {
      // If the first pass fails critically, return error
      return res.status(500).json({ error: `Failed initial recipe parse: ${initialOpenAIError}` });
    }
    if (!initialParsedResult) {
       // Should technically be caught by error above, but safety check
       return res.status(500).json({ error: 'Failed to get initial parsed data from AI.' });
    }
    // --- End Initial OpenAI Parsing ---


    // --- Step 3: Secondary OpenAI Parsing for Ingredients (Remains the Same) ---
    let finalRecipeOutput: FinalRecipeOutput = { // Initialize with results from pass 1
      title: initialParsedResult.title,
      ingredients: initialParsedResult.ingredients, // Start with string array or null
      instructions: initialParsedResult.instructions,
      substitutions_text: initialParsedResult.substitutions_text,
      // Initialize new fields
      recipeYield: initialParsedResult.recipeYield || null,
      prepTime: initialParsedResult.prepTime || null,
      cookTime: initialParsedResult.cookTime || null,
      totalTime: initialParsedResult.totalTime || null,
      nutrition: initialParsedResult.nutrition || null,
    };

    if (initialParsedResult.ingredients && initialParsedResult.ingredients.length > 0) {
      console.log(`Found ${initialParsedResult.ingredients.length} ingredient strings to parse further.`);

      // --- Prompt asking for object containing the array ---
      const ingredientParsingPrompt = `Parse the following array of ingredient strings into an array of JSON objects. Each object must have keys: "name" (string), "amount" (string or null), "unit" (string or null), and an optional key "suggested_substitutions" (array of objects or null).

      **Substitution Rules & Examples:**
      For each ingredient, suggest 1-2 sensible culinary substitutions.
      For EACH substitution suggestion, the object MUST include:
        - "name" (string): The name of the substitute.
        - "amount" (string, number, or null): The suggested *equivalent* amount based on the original quantity. If direct conversion isn't possible or relevant (e.g., spice for spice 1:1 tsp), use null.
        - "unit" (string or null): The suggested unit for the substitute amount.
        - "description" (string or null, optional): Brief notes on flavor/texture differences or usage (e.g., "milder flavor", "press firmly").

      **Guiding Principle:** Substitute based on volume or weight where applicable, not necessarily unit count, due to size variance. Adjust for flavor intensity, texture, and cooking method.

      **Good Examples of Substitution Formatting:**
      - Original: "4 cloves garlic" -> Substitution Suggestion: { "name": "shallot", "amount": "1", "unit": "small", "description": "milder, sweeter flavor" }
      - Original: "1 small onion" -> Substitution Suggestion: { "name": "shallots", "amount": "2-3", "unit": null, "description": "milder, more complex" }
      - Original: "1 lb chicken breast" -> Substitution Suggestion: { "name": "tofu", "amount": "14", "unit": "oz", "description": "pressed, extra-firm" }
      - Original: "1 cup all-purpose flour" -> Substitution Suggestion: { "name": "whole wheat flour", "amount": "0.875", "unit": "cup", "description": "denser texture, may need more liquid" }

      If no good substitutions come to mind, use null for "suggested_substitutions".

      **Other Parsing Rules:**
      Convert all fractional amounts (e.g., "1 1/2", "3/4") in the *main* ingredient parsing to their decimal representation (e.g., "1.5", "0.75").
      Handle variations like ranges, optional parts in the main ingredient. If a part isn't clearly identifiable, use null.
      If an ingredient clearly lacks a quantity (e.g., toppings like 'fresh cilantro'), set main amount to null and main unit to "to taste" or "as needed".
      **IMPORTANT: Do NOT include ingredients that are variations of 'sea salt', 'salt', 'black pepper', or 'pepper' in the final array.**

      **Output Format:** Output ONLY a single valid JSON object with one key "structured_ingredients" whose value is the array of parsed ingredient objects, adhering strictly to the format described above for ingredients AND their substitutions.
      Example Output Structure: { "structured_ingredients": [ { "name": "olive oil", "amount": "2", "unit": "tbsp", "suggested_substitutions": [{ "name": "avocado oil", "amount": "2", "unit": "tbsp" }] }, { "name": "chicken breast", "amount": "1", "unit": "lb", "suggested_substitutions": [{ "name": "tofu", "amount": "14", "unit": "oz", "description": "pressed, extra-firm"}] } ] }.

      Ingredient Strings to Parse: ${JSON.stringify(initialParsedResult.ingredients)}
      `;
      // --- End Prompt ---

      console.log('Sending ingredient parsing request to OpenAI (GPT-4 Turbo with JSON mode - enhanced prompt)...');
      let structuredIngredients: StructuredIngredient[] | null = null;
      let ingredientParseError = null;

      try {
        // --- Add safety check for prompt length ---
         if (ingredientParsingPrompt.length > 150000) { // Safety limit
             throw new Error(`Ingredient parsing prompt too large (${ingredientParsingPrompt.length} chars).`);
         }
        // ---

        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: "You are an assistant that parses ingredient strings and outputs a JSON object containing a 'structured_ingredients' array." },
            { role: "user", content: ingredientParsingPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0]?.message?.content;
        console.log('OpenAI (Pass 2 - Ingredients) raw JSON response content:', responseContent);

        if (responseContent) {
           try {
             const parsedResult: any = JSON.parse(responseContent);
             let parsedArray: any[] | null = null;
             if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.structured_ingredients)) {
                parsedArray = parsedResult.structured_ingredients;
             } else {
                 console.error("Parsed JSON response did not contain expected 'structured_ingredients' array:", parsedResult);
                 throw new Error("Parsed JSON result did not have the expected structure.");
             }

             if(Array.isArray(parsedArray)) {
                // --- Update Validation for new field ---
                structuredIngredients = parsedArray.map((item: any) => ({ // Ensure structure
                    name: item.name,
                    amount: item.amount,
                    unit: item.unit,
                    suggested_substitutions: Array.isArray(item.suggested_substitutions) ? item.suggested_substitutions : null
                })) as StructuredIngredient[];
                // --- End Update Validation ---
                console.log('Successfully parsed structured ingredients from OpenAI response (JSON mode).');
             } else {
                console.error('Extracted ingredient data was unexpectedly not an array:', parsedArray);
                throw new Error("Extracted ingredient data is not an array.");
             }
           } catch (parseErr) {
             console.error('Failed to parse structured ingredients JSON from OpenAI response (Pass 2):', parseErr);
             console.error('Raw content that failed parsing:', responseContent);
             ingredientParseError = 'Invalid JSON format received from AI ingredient parser.';
           }
        } else {
          ingredientParseError = 'Empty response received from AI ingredient parser.';
        }

      } catch (err) {
        console.error('Error calling OpenAI API (Pass 2 - Ingredients) or processing result:', err);
        ingredientParseError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI for ingredients';
        if ((err as any)?.code === 'rate_limit_exceeded') {
             ingredientParseError = `OpenAI rate limit exceeded. Please try again later. Details: ${ingredientParseError}`;
        }
      }

      if (structuredIngredients) {
         // Basic validation of structure before assigning
         if (structuredIngredients.every(ing => 
             typeof ing === 'object' && 
             ing !== null && 
             'name' in ing && 
             'amount' in ing && 
             'unit' in ing &&
             ('suggested_substitutions' in ing ? (ing.suggested_substitutions === null || Array.isArray(ing.suggested_substitutions)) : true) // Check optional field
           )) {
            finalRecipeOutput.ingredients = structuredIngredients; // Replace string array with structured array
         } else {
            console.warn(`Parsed ingredient array did not have the expected structure. Error: ${ingredientParseError || 'Invalid structure'}. Returning original ingredient strings.`);
            // Keep the original string array from Pass 1
         }
      } else {
         console.warn(`Failed to parse ingredients into structured format. Error: ${ingredientParseError || 'Unknown'}. Returning original ingredient strings.`);
         // Keep the original string array from Pass 1
      }

    } else {
      console.log("No ingredients found in initial parse to process further.");
    }
    // --- End Secondary OpenAI Parsing ---


    // --- Step 4: Send Final Response ---
    console.log("Sending final parsed recipe data to client.");
    res.json({
      message: 'Recipe processing complete.',
      receivedUrl: url,
      recipe: finalRecipeOutput
    });
    // --- End Send Final Response ---

  } catch (error) {
    // Catch errors related to request processing (e.g., reading req.body)
    console.error('Error in /parse route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    res.status(500).json({ error: message });
  }
});

// --- New Endpoint: Rewrite Instructions ---
router.post('/rewrite-instructions', async (req: Request, res: Response) => {
  try {
    const { originalInstructions, originalIngredientName, substitutedIngredientName } = req.body;

    if (!originalInstructions || !Array.isArray(originalInstructions) || originalInstructions.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid original instructions' });
    }
    if (!originalIngredientName || !substitutedIngredientName) {
      return res.status(400).json({ error: 'Missing original or substituted ingredient name' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set for rewrite endpoint.');
      return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key.' });
    }
    const openai = new OpenAI({ apiKey });

    // --- Prompt for Rewriting Instructions ---
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
    // --- End Rewrite Prompt ---

    console.log(`Sending rewrite request to OpenAI for ${originalIngredientName} -> ${substitutedIngredientName}`);
    let rewrittenInstructions: string[] | null = null;
    let rewriteError = null;

    try {
      if (rewritePrompt.length > 150000) { // Safety limit
           throw new Error(`Rewrite prompt too large (${rewritePrompt.length} chars).`);
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo", // Use a powerful model for this complex task
        messages: [
          { role: "system", content: "You are an assistant that rewrites recipe instructions based on an ingredient substitution, outputting a JSON array of steps." },
          { role: "user", content: rewritePrompt }
        ],
        temperature: 0.3, // Allow a little more creativity/variation than parsing
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      console.log('OpenAI (Rewrite) raw JSON response content:', responseContent);

      if (responseContent) {
         try {
           const parsedResult: any = JSON.parse(responseContent);
           if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
              rewrittenInstructions = parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'); // Ensure all elements are strings
              console.log('Successfully parsed rewritten instructions from OpenAI response.');
           } else {
               console.error("Parsed JSON response did not contain expected 'rewrittenInstructions' array:", parsedResult);
               throw new Error("Parsed JSON result did not have the expected structure.");
           }
         } catch (parseErr) {
           console.error('Failed to parse rewritten instructions JSON from OpenAI response:', parseErr);
           console.error('Raw content that failed parsing:', responseContent);
           rewriteError = 'Invalid JSON format received from AI instruction rewriter.';
         }
      } else {
        rewriteError = 'Empty response received from AI instruction rewriter.';
      }
    } catch (err) {
      console.error('Error calling OpenAI API (Rewrite) or processing result:', err);
      rewriteError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI for rewrite';
      if ((err as any)?.code === 'rate_limit_exceeded') {
           rewriteError = `OpenAI rate limit exceeded. Please try again later. Details: ${rewriteError}`;
       }
    }

    if (rewriteError || !rewrittenInstructions) {
      return res.status(500).json({ error: `Failed to rewrite instructions: ${rewriteError || 'Unknown error'}` });
    }

    res.json({ rewrittenInstructions });

  } catch (error) {
    console.error('Error in /rewrite-instructions route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    res.status(500).json({ error: message });
  }
});

// --- NEW: POST /api/recipes/scale-instructions --- 
router.post('/scale-instructions', async (req: Request, res: Response) => {
  try {
    const { 
        instructionsToScale, 
        originalIngredients, 
        scaledIngredients    
    } = req.body;

    // Basic Input Validation
    if (!Array.isArray(instructionsToScale) || !Array.isArray(originalIngredients) || !Array.isArray(scaledIngredients)) {
      return res.status(400).json({ error: 'Invalid input: instructions, originalIngredients, and scaledIngredients must be arrays.' });
    }
    if (instructionsToScale.length === 0) {
        console.log("No instructions provided to scale.");
        return res.json({ scaledInstructions: [] }); // Return empty if no instructions
    }
     if (originalIngredients.length !== scaledIngredients.length) {
        console.warn("Original and scaled ingredient lists have different lengths. Scaling might be inaccurate.");
        // Proceed, but be aware of potential issues
     }

    console.log(`Received ${instructionsToScale.length} instructions to potentially scale.`);

    // --- Instantiate OpenAI client here --- 
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set for scale-instructions endpoint.');
      return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key.' });
    }
    const openai = new OpenAI({ apiKey }); // Instantiate the client
    // --- End Instantiation --- 

    // --- Prepare Prompt for Scaling --- 
    // We need to present the ingredients clearly to the AI
    const originalIngredientsDesc = originalIngredients.map(ing => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
    const scaledIngredientsDesc = scaledIngredients.map(ing => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

    const scalePrompt = `You are an expert recipe editor. You are given recipe instructions that were originally written for ingredients with these quantities: [${originalIngredientsDesc}].

The ingredients have now been scaled to new quantities: [${scaledIngredientsDesc}].

Your task is to rewrite the provided recipe instructions, carefully adjusting any specific ingredient quantities mentioned in the text to match the *new* scaled quantities. Maintain the original meaning, structure, and step count. Be precise with the numbers.

For example, if an original instruction was "Add 2 cups flour" and the scaled ingredients now list "4 cups flour", the instruction should become "Add 4 cups flour". If an instruction mentions "the onion" and the quantity didn't change or wasn't numeric, leave it as is. Only adjust explicit numeric quantities that correspond to scaled ingredients.

Output ONLY a valid JSON object with a single key "scaledInstructions", where the value is an array of strings, each string being a single rewritten step.

Instructions to Scale (Array):
${JSON.stringify(instructionsToScale)}
`;
    // --- End Scaling Prompt --- 

    console.log('Sending instruction scaling request to OpenAI...');
    let scaledInstructionsResult: string[] | null = null;
    let scaleError = null;

    try {
         if (scalePrompt.length > 150000) { // Safety limit
             throw new Error(`Instruction scaling prompt too large (${scalePrompt.length} chars).`);
         }

        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo", // Or another capable model
          messages: [
            { role: "system", content: "You are an assistant that rewrites recipe instructions to reflect scaled ingredient quantities, outputting a JSON object with a 'scaledInstructions' array." },
            { role: "user", content: scalePrompt }
          ],
          temperature: 0.2, // Lower temperature for less creative changes
          response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0]?.message?.content;
        console.log('OpenAI scaling raw response content:', responseContent);

        if (responseContent) {
           try {
             const parsedResult: any = JSON.parse(responseContent);
             if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
                scaledInstructionsResult = parsedResult.scaledInstructions.map((item: any) => String(item)); // Ensure strings
                console.log('Successfully parsed scaled instructions from OpenAI response.');
             } else {
                throw new Error("Parsed JSON result did not have the expected 'scaledInstructions' array.");
             }
           } catch (parseErr) {
             console.error('Failed to parse scaled instructions JSON from OpenAI response:', parseErr);
             console.error('Raw content that failed parsing:', responseContent);
             scaleError = 'Invalid JSON format received from AI instruction scaler.';
           }
        } else {
          scaleError = 'Empty response received from AI instruction scaler.';
        }

    } catch (err) {
      console.error('Error calling OpenAI API for instruction scaling or processing result:', err);
      scaleError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI for instruction scaling';
      // Handle specific errors like rate limits if needed
    }

    // Send Response
    if (scaledInstructionsResult) {
      res.json({ scaledInstructions: scaledInstructionsResult });
    } else {
      // If scaling failed, should we return original instructions or an error?
      // Returning error seems appropriate as the frontend expects scaled instructions.
      console.error("Instruction scaling failed:", scaleError);
      res.status(500).json({ error: scaleError || 'Failed to scale instructions.' });
    }

  } catch (error) {
    console.error("Error in /scale-instructions route:", error);
    res.status(500).json({ error: 'Internal server error processing instruction scaling request.' });
  }
});

export const recipeRouter = router