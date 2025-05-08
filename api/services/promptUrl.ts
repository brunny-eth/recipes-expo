import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchHtmlWithFallback } from './htmlFetch';
import { extractRecipeContent } from './extractContent';
import { truncateTextByLines } from '../utils/truncate';

// Type definitions matching those in recipes.ts - consider moving to a shared types file
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null, amount?: string | number | null, unit?: string | null }> | null;
};

type CombinedParsedRecipe = {
  title: string | null;
  ingredients: StructuredIngredient[] | null;
  instructions: string[] | null;
  substitutions_text: string | null;
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: { calories?: string | null; protein?: string | null; [key: string]: any } | null;
};

type GeminiModel = ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']>; // Infer type

export async function handleRecipeUrl(
  url: string,
  requestId: string,
  geminiModel: GeminiModel, // Pass the initialized model
  scraperApiKey: string | undefined, // Pass API key
  scraperClient: any // Pass client instance
): Promise<{
  recipe: CombinedParsedRecipe | null;
  error: string | null;
  fetchMethodUsed: string;
  timings: { fetchHtml: number; extractContent: number; geminiCombinedParse: number; totalProcessingNoCache: number };
  usage: { combinedParseInputTokens: number; combinedParseOutputTokens: number; };
}> {
  const handlerStartTime = Date.now();
  console.log(`[${requestId}] Starting URL recipe processing for: ${url}`);
  let timings = { fetchHtml: -1, extractContent: -1, geminiCombinedParse: -1, totalProcessingNoCache: -1 };
  let usage = { combinedParseInputTokens: 0, combinedParseOutputTokens: 0 };
  let combinedParsedResult: CombinedParsedRecipe | null = null;
  let processingError: string | null = null;
  let fetchMethodUsed = 'Direct Fetch';

  // Step 1: Fetch HTML
  const fetchStartTime = Date.now();
  // Use the passed-in key and client
  const fetchResult = await fetchHtmlWithFallback(url, scraperApiKey, scraperClient); 
  let htmlContent = fetchResult.htmlContent;
  let fetchError = fetchResult.error;
  fetchMethodUsed = fetchResult.fetchMethodUsed;
  timings.fetchHtml = Date.now() - fetchStartTime;

  if (fetchError) {
      console.error(`[${requestId}] Fetch process failed for URL ${url}: ${fetchError.message}`);
      processingError = `Failed to retrieve recipe content from ${url}: ${fetchError.message}`;
  } else if (htmlContent.length === 0) {
      const finalErrorMessage = 'HTML content was empty after fetch attempts';
      console.error(`[${requestId}] Fetch process failed for URL ${url}: ${finalErrorMessage}`);
      processingError = `Failed to retrieve recipe content from ${url}: ${finalErrorMessage}`;
  }

  if (processingError) {
    timings.totalProcessingNoCache = Date.now() - handlerStartTime;
    return { recipe: null, error: processingError, fetchMethodUsed, timings, usage };
  }
  console.log(`[${requestId}] Using HTML content obtained via: ${fetchMethodUsed} (URL: ${url}, Length: ${htmlContent.length})`);

  // Step 1.5: Extract Content
  console.log(`[${requestId}] Pre-processing HTML with cheerio for URL: ${url}...`);
  const extractStartTime = Date.now();
  const extractedContent = extractRecipeContent(htmlContent);
  timings.extractContent = Date.now() - extractStartTime;

  if (!extractedContent.ingredientsText || !extractedContent.instructionsText) {
      console.warn(`[${requestId}] Failed to extract clear ingredients or instructions using cheerio for URL: ${url}. Will proceed with what was found (or nulls).`);
  } else {
      console.log(`[${requestId}] Successfully extracted content sections for URL: ${url}.`);
  }
  
  // Step 1.6: Truncate Extracted Content
  const maxIngredientLines = 40; 
  const maxInstructionLines = 40; 
  const safeIngredientsText = truncateTextByLines(extractedContent.ingredientsText, maxIngredientLines, "\n\n[INGREDIENTS TRUNCATED BY SYSTEM]");
  const safeInstructionsText = truncateTextByLines(extractedContent.instructionsText, maxInstructionLines, "\n\n[INSTRUCTIONS TRUNCATED BY SYSTEM]");

  // Step 2: Gemini Parsing
  const combinedPromptForUrl = `You are provided with pre-extracted text sections for a recipe's title, ingredients, and instructions. Your goal is to parse ALL information into a single, specific JSON object.

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
1.  **Sections:** If a section (title, ingredients, instructions) was not successfully extracted or is empty (appears as 'N/A' or is blank in the provided text), use null for its value in the JSON. If ingredients or instructions text is present but seems nonsensical or too short to be a real recipe, also consider using null for those arrays.
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
    - **recipeYield:** Diligently extract the recipe yield (servings). Look for terms like "serves", "makes", "yields", "servings", etc., from the *original text sections provided*, and the associated number (e.g., "serves 4-6", "makes 2 dozen"). If a range is given, use the lower end or the most reasonable single number (e.g., "4-6" becomes "4"). If no explicit yield is found after careful searching of the entire provided text, use null.
    - Extract prepTime, cookTime, total time, and basic nutrition info (calories, protein) if available in the *original text sections provided*, otherwise use null.
7.  **Output:** Ensure the output is ONLY the single, strictly valid JSON object described.

**Provided Text Sections:**

Title:
${extractedContent.title || 'N/A'}

Ingredients Text:
${safeIngredientsText || 'N/A'}

Instructions Text:
${safeInstructionsText || 'N/A'}
`;
  
  console.log(`[${requestId}] Sending combined parsing request to Gemini for URL ${url} (prompt length: ${combinedPromptForUrl.length})`);
  let combinedGeminiError = null;
  const geminiCombinedStartTime = Date.now();

  try {
    if (combinedPromptForUrl.length > 150000) { 
        throw new Error(`URL Combined prompt is too large (${combinedPromptForUrl.length} chars).`);
    }
    // Use the passed-in model
    const result = await geminiModel.generateContent(combinedPromptForUrl);
    const response = result.response;
    const responseText = response.text();

    usage.combinedParseInputTokens = response.usageMetadata?.promptTokenCount || 0;
    usage.combinedParseOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;
    
    const previewText = responseText ? (responseText.length > 300 ? responseText.substring(0, 300) + "..." : responseText) : "EMPTY";
    console.log(`[${requestId}] Gemini (URL Parse) raw JSON response: ${previewText}`);

    if (responseText) {
        try {
            combinedParsedResult = JSON.parse(responseText) as CombinedParsedRecipe;
            if (typeof combinedParsedResult !== 'object' || combinedParsedResult === null) {
                 throw new Error("Parsed JSON is not an object.");
            }
             if (combinedParsedResult.ingredients && !Array.isArray(combinedParsedResult.ingredients)) {
                 console.warn(`[${requestId}] Gemini returned non-array for ingredients (URL), setting to null.`);
                 combinedParsedResult.ingredients = null;
             } else if (Array.isArray(combinedParsedResult.ingredients)) {
                 const isValidStructure = combinedParsedResult.ingredients.every(ing => 
                     typeof ing === 'object' && ing !== null && 'name' in ing && 'amount' in ing && 'unit' in ing
                 );
                 if (!isValidStructure) {
                     console.warn(`[${requestId}] Some ingredients (URL) in the array might not have the expected structure.`);
                 }
             }
             if (combinedParsedResult.instructions && !Array.isArray(combinedParsedResult.instructions)) {
                 console.warn(`[${requestId}] Gemini returned non-array for instructions (URL), setting to null.`);
                 combinedParsedResult.instructions = null;
             }
             console.log(`[${requestId}] Successfully parsed combined JSON from Gemini (URL) response.`);
        } catch(parseError) {
            console.error(`[${requestId}] Failed to parse JSON response from Gemini (URL Parse) for ${url}:`, parseError);
            console.error(`[${requestId}] Raw Response that failed parsing (URL):`, responseText); 
            combinedGeminiError = "Invalid JSON received from AI parser for URL.";
        }
    } else {
        combinedGeminiError = 'Empty response received from AI parser for URL.';
    }
  } catch (err) {
    console.error(`[${requestId}] Error calling Gemini API (URL Parse) for ${url} or processing result:`, err);
    combinedGeminiError = err instanceof Error ? err.message : 'An unknown error occurred calling Gemini for URL';
    if ((err as any)?.response?.promptFeedback?.blockReason) {
         combinedGeminiError = `Gemini blocked the prompt/response for URL ${url}: ${ (err as any).response.promptFeedback.blockReason }`;
         console.error(`[${requestId}] Gemini prompt/response blocked for URL. Reason: ${(err as any).response.promptFeedback.blockReason}`);
         if ((err as any).response.promptFeedback.safetyRatings) {
            console.error(`[${requestId}] Safety Ratings:`, JSON.stringify((err as any).response.promptFeedback.safetyRatings, null, 2));
         }
    }
  } finally {
    timings.geminiCombinedParse = Date.now() - geminiCombinedStartTime;
  }

  if (combinedGeminiError) {
    processingError = `Failed combined recipe parse from URL ${url}: ${combinedGeminiError}`;
  } else if (!combinedParsedResult) {
    processingError = `Failed to get parsed data from AI for URL ${url}.`;
  }
  
  timings.totalProcessingNoCache = Date.now() - handlerStartTime;
  console.log(`[${requestId}] URL processing finished (before cache insert) for ${url}. Fetch=${timings.fetchHtml}ms, Extract=${timings.extractContent}ms, Gemini=${timings.geminiCombinedParse}ms, HandlerTotal=${timings.totalProcessingNoCache}ms`);
  console.log(`[${requestId}] Token Usage (URL for ${url}): Input=${usage.combinedParseInputTokens}, Output=${usage.combinedParseOutputTokens}`);
  
  return { recipe: combinedParsedResult, error: processingError, fetchMethodUsed, timings, usage };
} 