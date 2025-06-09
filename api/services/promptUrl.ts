import { GoogleGenerativeAI } from "@google/generative-ai";
import { truncateTextByLines } from '../utils/truncate';
import { CombinedParsedRecipe, GeminiModel, GeminiHandlerResponse } from '../types';
import { ExtractedContent } from './extractContent'; // Need this type
import { normalizeUsageMetadata, StandardizedUsage } from '../utils/usageUtils'; // Import the new utility
import { parseISODuration } from '../utils/timeUtils'; // Import the utility
import { validateRecipeText } from '../utils/textValidation'; // Added import
import logger from "../lib/logger"; // Corrected logger import path
import { stripMarkdownFences } from '../utils/stripMarkdownFences';

// --- New function for Gemini Parsing of URL content ---
export async function parseUrlContentWithGemini(
    extractedContent: ExtractedContent,
    requestId: string,
    geminiModel: GeminiModel
): Promise<GeminiHandlerResponse> {
    const handlerStartTime = Date.now(); // For timing this specific step
    console.log(`[${requestId}] Starting Gemini parsing for extracted URL content.`);
    let usage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
    let combinedParsedResult: CombinedParsedRecipe | null = null;
    let processingError: string | null = null;

    // Define truncation limits
    const fallbackMaxChars = 100000; // Max CHARACTERS if using raw body fallback
    const defaultMaxIngredientLines = 40;
    const defaultMaxInstructionLines = 40;

    let textToParse = ``;
    let promptPrefix = ``;

    if (extractedContent.isFallback) {
        console.log(`[${requestId}] Fallback extraction detected. Preparing raw body text for prompt (max ${fallbackMaxChars} chars).`);
        // Use the simpler prompt prefix for direct raw text
        promptPrefix = `This is raw page text from a cooking website. Please extract structured data:
- Title
- Ingredients (as list)
- Instructions (as clear steps)
`;
        
        const cleanedRawBody = extractedContent.ingredientsText 
            ? extractedContent.ingredientsText.split('\n').map(line => line.trim()).filter(line => line).join('\n') 
            : '';
        
        // --- Log sample of cleanedRawBody --- 
        if (cleanedRawBody) {
            console.log(`[${requestId}] Sample of cleaned raw body text (first 50 lines):
${cleanedRawBody.split('\n').slice(0, 50).join('\n')}`);
        }
        // --- End Log --- 

        let safeRawBodyText = cleanedRawBody;
        if (safeRawBodyText.length > fallbackMaxChars) {
            console.warn(`[${requestId}] Fallback raw body text exceeds ${fallbackMaxChars} chars (${safeRawBodyText.length}). Truncating by characters.`);
            safeRawBodyText = safeRawBodyText.substring(0, fallbackMaxChars) + "\n\n[RAW BODY TEXT TRUNCATED BY SYSTEM (CHAR LIMIT)]";
        } else {
            console.log(`[${requestId}] Fallback raw body text within char limit (${safeRawBodyText.length} chars).`);
        }

        // --- Validate Fallback Content ---
        const fallbackValidationResult = validateRecipeText(safeRawBodyText, requestId);
        if (!fallbackValidationResult.isValid) {
            const errorMsg = fallbackValidationResult.error || 'Fallback content failed validation.';
            // Updated logging
            logger.warn({ 
                requestId, 
                reason: errorMsg, 
                inputType: 'url-fallback',
                length: safeRawBodyText.length 
            }, 'Rejected fallback text before Gemini due to validation failure.');
            // Updated return structure
            return {
                recipe: null,
                error: `Input validation failed for fallback content: ${errorMsg}`,
                usage: { inputTokens: 0, outputTokens: 0 },
                timings: { geminiCombinedParse: 0 } // Gemini not called
            };
        }
        console.log(`[${requestId}] Fallback content passed validation.`);
        // --- End Validate Fallback Content ---

        // --- Skip Heuristic Filtering (Temporary) --- 
        console.log(`[${requestId}] Skipping heuristic filtering. Using character-truncated raw body text directly.`);
        const formattedRawText = `
------------------------
${safeRawBodyText}
------------------------`;
        // --- End Skip --- 
        
        textToParse = `**Provided Text Sections:**\n\nTitle:\n${extractedContent.title || 'N/A'}\n\nExplicit Recipe Yield Text:\n${extractedContent.recipeYieldText || 'N/A'}\n\nRaw Page Content:\n${formattedRawText || 'N/A'}`; // Use the formatted *unfiltered* raw text

    } else {
        console.log(`[${requestId}] Standard extraction detected. Using default truncation limits (Ingredients: ${defaultMaxIngredientLines}, Instructions: ${defaultMaxInstructionLines}).`);
        promptPrefix = `This is structured text from a recipe site with extracted ingredients and instructions.`;

        const cleanedIngredients = extractedContent.ingredientsText
            ? extractedContent.ingredientsText.split('\n').map(line => line.trim()).filter(line => line).join('\n')
            : null;
        
        // --- VALIDATE BEFORE TRUNCATION ---
        const ingredientsForValidation = cleanedIngredients ? `Ingredients:\n${cleanedIngredients}` : '';
        const instructionsForValidation = extractedContent.instructionsText ? `Instructions:\n${extractedContent.instructionsText}` : '';
        const fullContentToValidate = ingredientsForValidation + "\n\n" + instructionsForValidation;
        const standardValidationResult = validateRecipeText(fullContentToValidate, requestId);
        if (!standardValidationResult.isValid) {
            const errorMsg = standardValidationResult.error || 'Standard extracted content failed validation (pre-truncation).';
            logger.warn({ 
                requestId, 
                reason: errorMsg, 
                inputType: 'url-standard-full', // Indicate validation on full text
                length: fullContentToValidate.length,
                ingredientsLength: cleanedIngredients?.length || 0,
                instructionsLength: extractedContent.instructionsText?.length || 0
            }, 'Rejected standard extracted text (full) before Gemini due to validation failure.');
            
            if (!cleanedIngredients && !extractedContent.instructionsText) {
                 logger.warn({requestId, inputType: 'url-standard-full'}, 'Both full ingredients and instructions text were empty, contributing to validation failure.');
            }
            return {
                recipe: null,
                error: `Input validation failed for standard extracted content (full): ${errorMsg}`,
                usage: { inputTokens: 0, outputTokens: 0 },
                timings: { geminiCombinedParse: 0 }
            };
        }
        console.log(`[${requestId}] Full standard extracted content passed validation.`);
        // --- END VALIDATE BEFORE TRUNCATION ---

        const safeIngredientsText = truncateTextByLines(cleanedIngredients, defaultMaxIngredientLines, "\n\n[INGREDIENTS TRUNCATED BY SYSTEM]");
        const safeInstructionsText = truncateTextByLines(extractedContent.instructionsText, defaultMaxInstructionLines, "\n\n[INSTRUCTIONS TRUNCATED BY SYSTEM]");
        
        textToParse = `**Provided Text Sections:**\n\nTitle:\n${extractedContent.title || 'N/A'}\n\nExplicit Recipe Yield Text:\n${extractedContent.recipeYieldText || 'N/A'}\n\nIngredients Text:\n${safeIngredientsText || 'N/A'}\n\nInstructions Text:\n${safeInstructionsText || 'N/A'}`;
    }

    // Gemini Prompt - Combined with updated prefix logic
    const combinedPromptForUrl = `${promptPrefix}

Your goal is to parse ALL information from the provided text sections into a single, specific JSON object.

**Important Note:** If processing 'Raw Page Content' (due to fallback), use the provided raw text. If processing separate 'Ingredients Text' and 'Instructions Text' are provided, use them primarily.

---

**Examples of correct ingredient extraction:**

- "1 medium onion (peeled and diced)"  
  → name: "onion", amount: "1", unit: "medium", preparation: "peeled and diced"

- "3 cloves garlic, minced"  
  → name: "garlic", amount: "3", unit: "cloves", preparation: "minced"

- "¼ cup parsley, finely chopped"  
  → name: "parsley", amount: "0.25", unit: "cup", preparation: "finely chopped"

---

**Desired JSON Structure:**
{
  "title": "string | null",
  "ingredients": [
    {
      "name": "string",               // e.g., "onion"
      "amount": "string | null",     // e.g., "1", "1.5"
      "unit": "string | null",       // e.g., "cup", "clove", "medium"
      "preparation": "string | null",// e.g., "chopped", "minced", "peeled and diced"
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
  "nutrition": {
    "calories": "string | null",
    "protein": "string | null"
  } | null
}

---

**Parsing Rules:**

1. **Sections:** Use the appropriate source — either structured text or raw fallback — to find all fields. If a field is clearly missing or nonsensical, return "null".

2. **Ingredients Array:**
   - Extract "name", "amount", "unit", and "preparation" if present.
   - The "preparation" field should include descriptive phrases like “minced”, “chopped”, “finely chopped”, “peeled and diced”.
   - "preparation" may appear at the end of the line or in parentheses.
   - Do **not** include preparation in the "name" field.
   - Convert fractions (e.g., "1 1/2") to decimal ("1.5").
   - Skip salt, pepper, or similar generic seasonings unless they have substitutions.
   - If an amount or unit is clearly missing, use "null".

3. **Instructions Array:**
   - Extract clear cooking steps. No numbering.
   - Exclude unrelated text like anecdotes or serving suggestions.
   - Replace vague ingredient group references ("the dressing ingredients") with specific items if possible.

4. **Substitutions:**
   - Provide 1–2 culinary substitutions for each ingredient (except salt/pepper).
   - Use structured objects with name, amount, unit, and optional description.

5. **substitutions_text:**
   - Extract any substitution notes found in the instructions (e.g., “you can use shallots instead of onions”).

6. **Time and Yield:**
   - Use the explicit recipe yield text first. If missing, look for phrases like “serves 4” or “makes 1 loaf”.
   - Parse all time fields only if they are explicitly written.
   - Return "null" if fields are missing.

7. **Nutrition:**
   - Extract calories and protein, if available.
   - Omit the object if both values are missing.

---

${textToParse}`;

    // --- ADDED DEBUG LOG ---
    console.log(`[DEBUG promptUrl] Gemini Prompt for ${requestId} (first 1000 chars):
${combinedPromptForUrl.substring(0, 1000)}`);
    // For full prompt, uncomment and be careful with large outputs:
    // console.log(`[DEBUG promptUrl] Full Gemini Prompt for ${requestId}:\n${combinedPromptForUrl}`); 
    // --- END DEBUG LOG ---

    console.log(`[${requestId}] Sending combined parsing request to Gemini for extracted URL content (prompt length: ${combinedPromptForUrl.length})`);
    const geminiCombinedStartTime = Date.now();

    logger.debug({ 
        requestId, 
        promptLength: combinedPromptForUrl.length,
        promptPrefix: combinedPromptForUrl.substring(0, 200), // First 200 chars of prompt
        textToParsePreview: textToParse.substring(0,500) // First 500 chars of the actual recipe text part
    }, "Preparing to call Gemini for URL content");

    try {
        if (combinedPromptForUrl.length > 150000) { // Keep safety check
            throw new Error(`URL Combined prompt is too large (${combinedPromptForUrl.length} chars).`);
        }
        const result = await geminiModel.generateContent(combinedPromptForUrl);
        const response = result.response;
        const responseText = response.text();

        logger.debug({
            requestId,
            responseTextPreview: responseText ? responseText.substring(0, 500) : "EMPTY", // First 500 chars of response
            usageMetadata: response.usageMetadata
        }, "Received response from Gemini for URL content");

        usage = normalizeUsageMetadata(response.usageMetadata, 'gemini');

        const previewText = responseText ? (responseText.length > 300 ? responseText.substring(0, 300) + "..." : responseText) : "EMPTY";
        console.log(`[${requestId}] Gemini (URL Parse) raw JSON response preview: ${previewText}`);

        if (responseText) {
            try {
                const cleanText = stripMarkdownFences(responseText);
                if (responseText !== cleanText) {
                    logger.info({ requestId, source: 'promptUrl.ts' }, "Stripped markdown fences from Gemini response.");
                }
                combinedParsedResult = JSON.parse(cleanText) as CombinedParsedRecipe;
                // Basic validation (copied from old handler)
                if (typeof combinedParsedResult !== 'object' || combinedParsedResult === null) {
                    throw new Error("Parsed JSON is not an object.");
                }
                if (combinedParsedResult.ingredients && !Array.isArray(combinedParsedResult.ingredients)) {
                    console.warn(`[${requestId}] Gemini returned non-array for ingredients (URL), setting to null.`);
                    combinedParsedResult.ingredients = null;
                }
                if (combinedParsedResult.instructions && !Array.isArray(combinedParsedResult.instructions)) {
                    console.warn(`[${requestId}] Gemini returned non-array for instructions (URL), setting to null.`);
                    combinedParsedResult.instructions = null;
                }
                console.log(`[${requestId}] Successfully parsed combined JSON from Gemini (URL) response.`);
            } catch (parseError: any) {
                console.error(`[${requestId}] Failed to parse JSON response from Gemini (URL Parse):`, parseError);
                console.error(`[${requestId}] Raw Response that failed parsing (URL):`, responseText); 
                processingError = `Invalid JSON received from AI parser for URL: ${parseError.message}`;
            }
        } else {
            processingError = 'Empty response received from AI parser for URL.';
            console.warn(`[${requestId}] Empty response text from Gemini (URL Parse).`);
        }
    } catch (err: any) {
        console.error(`[${requestId}] Error calling Gemini API (URL Parse) or processing result:`, err);
        processingError = err instanceof Error ? err.message : 'An unknown error occurred calling Gemini for URL';
        // Handle blocked content specifically
        if (err?.response?.promptFeedback?.blockReason) {
            processingError = `Gemini blocked the prompt/response for URL: ${err.response.promptFeedback.blockReason}`;
            console.error(`[${requestId}] Gemini prompt/response blocked for URL. Reason: ${err.response.promptFeedback.blockReason}`);
            if (err.response.promptFeedback.safetyRatings) {
                console.error(`[${requestId}] Safety Ratings:`, JSON.stringify(err.response.promptFeedback.safetyRatings, null, 2));
            }
        }
        // Ensure usage is default if error occurs before assignment
        if (usage.inputTokens === 0 && usage.outputTokens === 0) {
            usage = normalizeUsageMetadata(null, 'gemini');
        }
    }

    const geminiCombinedParseTime = Date.now() - geminiCombinedStartTime;
    const totalTime = Date.now() - handlerStartTime;

    if (!processingError && !combinedParsedResult) {
         // This state shouldn't really happen if responseText was non-empty and JSON parsing succeeded but resulted in null/undefined? Add warning.
        console.warn(`[${requestId}] Gemini parsing for URL completed without error, but result is null.`);
        processingError = 'AI parsing completed without error but yielded no result.'; // Assign an error if no recipe found
    }

    console.log(`[${requestId}] Gemini URL content parsing finished. Time=${geminiCombinedParseTime}ms (Total Step Time=${totalTime}ms)`);
    console.log(`[${requestId}] Token Usage (URL Gemini Step): Input=${usage.inputTokens}, Output=${usage.outputTokens}`);

    return {
        recipe: combinedParsedResult,
        error: processingError,
        usage,
        timings: { geminiCombinedParse: geminiCombinedParseTime }
    };
}

