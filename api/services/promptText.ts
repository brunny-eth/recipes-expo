import { CombinedParsedRecipe, GeminiModel, GeminiHandlerResponse } from '../types';
import { truncateTextByLines } from '../utils/truncate';
import { performance } from 'perf_hooks';
import { normalizeUsageMetadata, StandardizedUsage } from '../utils/usageUtils';
import { validateRecipeText } from '../utils/textValidation';

export async function parseRawTextWithGemini(
  preparedText: string,
  requestId: string,
  geminiModel: GeminiModel
): Promise<GeminiHandlerResponse> {
  const handlerStartTime = Date.now();
  console.log(`[${requestId}] Starting Gemini parsing for raw text input.`);

  let usage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
  let recipe: CombinedParsedRecipe | null = null;
  let error: string | null = null;

  // Validate prepared text
  const validationResult = validateRecipeText(preparedText, requestId);
  if (!validationResult.isValid) {
    console.warn(`[${requestId}] Input validation failed: ${validationResult.error}`);
    return {
      recipe: null,
      error: validationResult.error || 'Input validation failed.',
      usage: { inputTokens: 0, outputTokens: 0 },
      timings: { geminiCombinedParse: Date.now() - handlerStartTime }
    };
  }

  // Add heuristic filter
  const isLikelyGarbage = preparedText.length < 100 || !preparedText.match(/ingredients|directions|instructions/i);
  if (isLikelyGarbage) {
    console.warn(`[${requestId}] Input flagged as likely garbage: length ${preparedText.length}`);
    return {
      recipe: null,
      error: 'Input does not appear to be a valid recipe (too short or missing keywords).',
      usage: { inputTokens: 0, outputTokens: 0 }, // Default usage as no API call was made
      timings: { geminiCombinedParse: Date.now() - handlerStartTime } // Time spent up to this point
    };
  }

  // Step 1: Truncate oversized text if needed
  const maxLength = 75000;
  const safeText = preparedText.length > maxLength
    ? truncateTextByLines(preparedText, 800, '\n\n[RAW TEXT TRUNCATED BY SYSTEM]')
    : preparedText;

  if (preparedText.length > maxLength) {
    console.warn(`[${requestId}] Raw text was truncated from ${preparedText.length} to ${safeText.length} characters.`);
  }

  // Step 2: Gemini Prompt
  const rawTextPrompt = `
You are an expert recipe parsing AI.

Your goal is to parse ALL structured information from the provided raw recipe text into a valid JSON object.

Expected JSON format:
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
  "nutrition": {
    "calories": "string | null",
    "protein": "string | null"
  } | null
}

Parsing Rules:
- **VERY IMPORTANT**: If a value for a field (like prepTime, cookTime, totalTime, recipeYield, nutrition) is not explicitly found in the provided text, you MUST return \`null\` for that field in the JSON. DO NOT use \"N/A\", \"0\", or make up values. Be precise.
- Do not skip required keys — include them with null values if unknown.
- Exclude ingredients like "salt", "black pepper", "pepper", "sea salt".
- If steps mention ingredient subgroups, list the actual ingredients instead.
- Extract prepTime, cookTime, totalTime. Look for explicit mentions like "Prep Time: 15 min", "Cook: 45 minutes". Extract the value exactly as stated.
- Extract recipeYield. Look for terms like "Serves 4", "Yield: 12 cookies", "Makes 1 loaf". Extract the description (e.g., "4 servings", "12 cookies", "1 loaf").
- Extract nutrition info (calories, protein) if available (e.g., "350 kcal", "15g protein"). The entire nutrition object should be null if no nutrition info is found.
- Ingredient substitutions: Suggest 1-2 sensible culinary substitutions for each ingredient (except salt/pepper). Format as { name, amount, unit, description }. Return null for suggested_substitutions if none are found.
- Convert fractional ingredient amounts (e.g., "1 1/2") to decimals ("1.5").
- Output ONLY the JSON object. Do not include explanations, formatting, or extra text.

Raw Recipe Text:
${safeText}
`;

  console.log(`[${requestId}] Sending Gemini request (prompt length: ${rawTextPrompt.length}).`);
  const geminiStart = Date.now();

  try {
    if (rawTextPrompt.length > 150000) {
      throw new Error(`Prompt too large (${rawTextPrompt.length} chars).`);
    }

    const result = await geminiModel.generateContent(rawTextPrompt);
    const response = result.response;
    const text = response.text();

    usage = normalizeUsageMetadata(response.usageMetadata, 'gemini');

    const preview = text ? text.slice(0, 300) + (text.length > 300 ? '...' : '') : 'EMPTY';
    console.log(`[${requestId}] Gemini response preview:\n${preview}`);

    if (text) {
      try {
        recipe = JSON.parse(text);

        if (!recipe || typeof recipe !== 'object') throw new Error('Parsed JSON is not a valid object.');

        // Basic structure checks
        if (recipe.ingredients && !Array.isArray(recipe.ingredients)) {
          console.warn(`[${requestId}] ingredients not an array — nulling`);
          recipe.ingredients = null;
        }

        if (recipe.instructions && !Array.isArray(recipe.instructions)) {
          console.warn(`[${requestId}] instructions not an array — nulling`);
          recipe.instructions = null;
        }

        console.log(`[${requestId}] Successfully parsed Gemini output.`);
      } catch (parseErr: any) {
        console.error(`[${requestId}] JSON parse failed:`, parseErr);
        console.error(`[${requestId}] Raw response:\n${text}`);
        error = `Failed to parse Gemini response: ${parseErr.message}`;
      }
    } else {
      error = 'Empty response from Gemini.';
      console.warn(`[${requestId}] No text in Gemini response.`);
    }
  } catch (err: any) {
    console.error(`[${requestId}] Gemini call error:`, err);
    error = err instanceof Error ? err.message : 'Unknown Gemini error';

    if (err?.response?.promptFeedback?.blockReason) {
      error = `Gemini blocked response: ${err.response.promptFeedback.blockReason}`;
      console.error(`[${requestId}] Block reason: ${err.response.promptFeedback.blockReason}`);
      if (err.response.promptFeedback.safetyRatings) {
        console.error(`[${requestId}] Safety Ratings:`, JSON.stringify(err.response.promptFeedback.safetyRatings, null, 2));
      }
    }

    if (usage.inputTokens === 0 && usage.outputTokens === 0) {
      usage = normalizeUsageMetadata(null, 'gemini');
    }
  }

  const geminiParseTime = Date.now() - geminiStart;
  const totalTime = Date.now() - handlerStartTime;

  if (!recipe && !error) {
    console.warn(`[${requestId}] No result and no error — defaulting to unknown failure.`);
    error = 'AI returned no usable result.';
  }

  console.log(`[${requestId}] Gemini parsing complete. Time=${geminiParseTime}ms, Total=${totalTime}ms`);
  console.log(`[${requestId}] Token Usage: prompt=${usage.inputTokens}, output=${usage.outputTokens}`);

  return {
    recipe,
    error,
    usage,
    timings: { geminiCombinedParse: geminiParseTime }
  };
}