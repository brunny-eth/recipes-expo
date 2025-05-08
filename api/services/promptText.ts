import { GoogleGenerativeAI } from "@google/generative-ai";
import { preprocessRawRecipeText } from '../utils/preprocessText';
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

export async function handleRawTextRecipe(
  rawText: string,
  requestId: string,
  geminiModel: GeminiModel // Pass the initialized model
): Promise<{ 
  recipe: CombinedParsedRecipe | null; 
  error: string | null; 
  usage: { combinedParseInputTokens: number; combinedParseOutputTokens: number; }; 
  timings: { geminiCombinedParse: number; total: number; } 
}> {
  const handlerStartTime = Date.now();
  console.log(`[${requestId}] Starting raw text recipe processing.`);
  let timings = { geminiCombinedParse: -1, total: -1 };
  let usage = { combinedParseInputTokens: 0, combinedParseOutputTokens: 0 };
  let combinedParsedResult: CombinedParsedRecipe | null = null;
  let combinedGeminiError: string | null = null;

  const processedText = preprocessRawRecipeText(rawText);
  const MAX_RAW_TEXT_LINES = 200; 
  const safeRawText = truncateTextByLines(processedText, MAX_RAW_TEXT_LINES, "\n\n[RAW TEXT TRUNCATED BY SYSTEM DUE TO LENGTH]");

  const rawTextPrompt = `You are an expert recipe parsing AI. You are provided with a block of raw text that is believed to be a complete recipe. Your goal is to parse ALL information from this text into a single, specific JSON object.

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

**Parsing Rules & Guidelines:**
1.  **Overall Goal:** Extract as much structured information as possible from the provided text. If a field is not present or cannot be determined, use null.
2.  **Title:** Identify the recipe's title. This is often at the beginning or prominently displayed. If no clear title is found, try to infer a sensible one from the ingredients or instructions, or use "Untitled Recipe" as a last resort if truly unidentifiable.
3.  **Ingredients Array ("ingredients"):**
    - Locate the ingredients list. Parse each ingredient line into "name", "amount", and "unit".
    - "name": The name of the ingredient (e.g., "all-purpose flour", "large eggs").
    - "amount": The quantity (e.g., "1", "1.5", "2-3"). Convert fractions (e.g., "1 1/2", "3/4") to decimal strings (e.g., "1.5", "0.75"). If an amount is a range (e.g., "2-3"), represent it as a string "2-3". If no quantity is specified (e.g., "salt to taste"), "amount" should be null.
    - "unit": The unit of measurement (e.g., "cup", "tbsp", "oz", "cloves"). If no unit is specified (e.g., "2 carrots"), "unit" should be null. For items like "salt to taste", "unit" could be "to taste".
    - **Exclusions:** Do NOT include ingredients that are variations of 'sea salt', 'salt', 'black pepper', or 'pepper' in the final "ingredients" array.
    - **Ingredient Substitutions ("suggested_substitutions"):** For each parsed ingredient (excluding salt/pepper), if you can think of 1-2 sensible culinary substitutions, provide them. Each substitution MUST be an object with "name" (string), "amount" (string/number/null - the *equivalent* amount for the substitution), "unit" (string/null), and an optional "description" (string/null, e.g., "for a richer flavor"). If no good substitutions come to mind, "suggested_substitutions" should be null for that ingredient.
4.  **Instructions Array ("instructions"):**
    - Find the preparation or cooking steps.
    - Split the instructions into an array of strings, where each string is a single, distinct step.
    - Steps should be actionable and in logical order.
    - Omit any numbering (e.g., "1.", "Step 1:") from the beginning of the strings.
    - EXCLUDE non-essential text like serving suggestions, tips, or anecdotes unless they are integral to a specific step.
    - **Clarity for Sub-groups:** If an instruction refers to combining a sub-group of ingredients (e.g., 'dressing ingredients,' 'tahini ranch ingredients'), and those ingredients are part of the main ingredient list you parsed, rephrase the instruction to explicitly list those specific ingredients. For example, instead of 'combine tahini ranch ingredients', if tahini, chives, and parsley are the ranch ingredients, the instruction should be 'combine tahini, dried chives, and dried parsley, whisking in water to thin...'.
5.  **Substitutions Text ("substitutions_text"):** If the original text contains a dedicated section or general notes about substitutions (not specific to one ingredient), extract that text here. Otherwise, use null.
6.  **Metadata:**
    - **Yield ("recipeYield"):** Look for phrases like "Serves X", "Makes Y pieces", "Yield: Z". Extract the yield information as a string (e.g., "4 servings", "2 dozen cookies"). If a range is given (e.g., "serves 4-6"), use that range (e.g., "4-6 servings"). Use null if not found.
    - **Times ("prepTime", "cookTime", "totalTime"):** Extract preparation time, cooking time, and total time if specified. Format as strings (e.g., "15 minutes", "1 hour"). Use null if not found.
    - **Nutrition ("nutrition"):** If calorie and/or protein information is provided, extract it into the "nutrition" object (e.g., { "calories": "350 kcal", "protein": "20g" }). Use null for fields not found. The parent "nutrition" field should be null if no nutritional info is found.
7.  **Output Format:** Ensure your entire response is ONLY the single, strictly valid JSON object described above. Do not include any explanatory text, markdown formatting, or anything else outside this JSON structure.

**Provided Raw Recipe Text:**
${safeRawText}
`;

  console.log(`[${requestId}] Sending raw text parsing request to Gemini (text length: ${safeRawText.length}). Prompt length: ${rawTextPrompt.length}`);
  const geminiCombinedStartTime = Date.now();

  try {
    if (rawTextPrompt.length > 150000) { 
        throw new Error(`Raw text prompt is too large (${rawTextPrompt.length} chars).`);
    }
    const result = await geminiModel.generateContent(rawTextPrompt);
    const response = result.response;
    const responseText = response.text();

    usage.combinedParseInputTokens = response.usageMetadata?.promptTokenCount || 0;
    usage.combinedParseOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;

    const previewText = responseText ? (responseText.length > 300 ? responseText.substring(0, 300) + "..." : responseText) : "EMPTY";
    console.log(`[${requestId}] Gemini (Raw Text Parse) raw JSON response content: ${previewText}`);
    
    if (responseText) {
        try {
            combinedParsedResult = JSON.parse(responseText) as CombinedParsedRecipe;
            if (typeof combinedParsedResult !== 'object' || combinedParsedResult === null) {
                 throw new Error("Parsed JSON is not an object.");
            }
            if (combinedParsedResult.ingredients && !Array.isArray(combinedParsedResult.ingredients)) {
                 console.warn(`[${requestId}] Gemini returned non-array for ingredients (Raw Text), setting to null.`);
                 combinedParsedResult.ingredients = null;
            } else if (Array.isArray(combinedParsedResult.ingredients)) {
                 const isValidStructure = combinedParsedResult.ingredients.every(ing => 
                     typeof ing === 'object' && ing !== null && 'name' in ing && typeof ing.name === 'string'
                 );
                 if (!isValidStructure) {
                     console.warn(`[${requestId}] Some ingredients (Raw Text) in the array might not have the expected structure.`);
                 }
            }
            if (combinedParsedResult.instructions && !Array.isArray(combinedParsedResult.instructions)) {
                 console.warn(`[${requestId}] Gemini returned non-array for instructions (Raw Text), setting to null.`);
                 combinedParsedResult.instructions = null;
            }
            console.log(`[${requestId}] Successfully parsed JSON from Gemini (Raw Text) response.`);
        } catch(parseError) {
            console.error(`[${requestId}] Failed to parse JSON response from Gemini (Raw Text Parse):`, parseError);
            console.error(`[${requestId}] Raw Response that failed parsing (Raw Text):`, responseText); 
            combinedGeminiError = "Invalid JSON received from AI parser for raw text.";
        }
    } else {
        combinedGeminiError = 'Empty response received from AI parser for raw text.';
    }
  } catch (err) {
    console.error(`[${requestId}] Error calling Gemini API (Raw Text Parse) or processing result:`, err);
    combinedGeminiError = err instanceof Error ? err.message : 'An unknown error occurred calling Gemini for raw text';
    if ((err as any)?.response?.promptFeedback?.blockReason) {
         combinedGeminiError = `Gemini blocked the prompt/response for raw text: ${ (err as any).response.promptFeedback.blockReason }`;
         console.error(`[${requestId}] Gemini prompt/response blocked for raw text. Reason: ${(err as any).response.promptFeedback.blockReason}`);
         if ((err as any).response.promptFeedback.safetyRatings) {
            console.error(`[${requestId}] Safety Ratings:`, JSON.stringify((err as any).response.promptFeedback.safetyRatings, null, 2));
         }
    }
  } finally {
    timings.geminiCombinedParse = Date.now() - geminiCombinedStartTime;
  }

  timings.total = Date.now() - handlerStartTime;
  console.log(`[${requestId}] Raw text processing finished. Gemini Parse Time=${timings.geminiCombinedParse}ms, Handler Total Time=${timings.total}ms`);
  console.log(`[${requestId}] Token Usage (Raw Text): Input=${usage.combinedParseInputTokens}, Output=${usage.combinedParseOutputTokens}`);

  return { recipe: combinedParsedResult, error: combinedGeminiError, usage, timings };
} 