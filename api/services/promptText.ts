import { CombinedParsedRecipe, GeminiModel, GeminiHandlerResponse } from '../types';
import { truncateTextByLines } from '../utils/truncate';
import { performance } from 'perf_hooks';
import { normalizeUsageMetadata, StandardizedUsage } from '../utils/usageUtils';
import { validateRecipeText } from '../utils/textValidation';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';

export async function parseRawTextWithGemini(
  preparedText: string,
  requestId: string,
  geminiModel: GeminiModel
): Promise<GeminiHandlerResponse> {
  const handlerStartTime = Date.now();
  logger.info({ requestId }, 'Starting Gemini parsing for raw text input.');

  let usage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
  let recipe: CombinedParsedRecipe | null = null;
  let error: string | null = null;

  // Validate prepared text
  const validationResult = validateRecipeText(preparedText, requestId);
  if (!validationResult.isValid) {
    logger.warn({ requestId, error: validationResult.error }, 'Input validation failed');
    return {
      recipe: null,
      error: validationResult.error || 'Input validation failed.',
      usage: { inputTokens: 0, outputTokens: 0 },
      timings: { geminiCombinedParse: Date.now() - handlerStartTime }
    };
  }

  // Step 1: Truncate oversized text if needed
  const maxLength = 75000;
  const safeText = preparedText.length > maxLength
    ? truncateTextByLines(preparedText, 800, '\n\n[RAW TEXT TRUNCATED BY SYSTEM]')
    : preparedText;

  if (preparedText.length > maxLength) {
    logger.warn({ requestId, originalLength: preparedText.length, truncatedLength: safeText.length }, 'Raw text was truncated');
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

  logger.info({ requestId, promptLength: rawTextPrompt.length }, 'Sending Gemini request.');
  const geminiStart = Date.now();

  logger.debug({ 
      requestId, 
      promptLength: rawTextPrompt.length,
      promptPreview: rawTextPrompt.substring(0, 200), // First 200 chars of prompt
      textPreview: safeText.substring(0,500) // First 500 chars of the actual recipe text part
  }, "Preparing to call Gemini for raw text");

  try {
    if (rawTextPrompt.length > 150000) {
      throw new Error(`Prompt too large (${rawTextPrompt.length} chars).`);
    }

    const result = await geminiModel.generateContent(rawTextPrompt);
    const response = result.response;
    const text = response.text();

    logger.debug({
        requestId,
        responseTextPreview: text ? text.substring(0, 500) : "EMPTY", // First 500 chars of response
        usageMetadata: response.usageMetadata
    }, "Received response from Gemini for raw text");

    usage = normalizeUsageMetadata(response.usageMetadata, 'gemini');

    const preview = text ? text.slice(0, 300) + (text.length > 300 ? '...' : '') : 'EMPTY';
    logger.debug({ requestId, preview }, 'Gemini response preview.');

    if (text) {
      try {
        const cleanText = stripMarkdownFences(text);
        if (text !== cleanText) {
            logger.info({ requestId, source: 'promptText.ts' }, "Stripped markdown fences from Gemini response.");
        }
        recipe = JSON.parse(cleanText);

        if (!recipe || typeof recipe !== 'object') throw new Error('Parsed JSON is not a valid object.');

        // Basic structure checks
        if (recipe.ingredients && !Array.isArray(recipe.ingredients)) {
          logger.warn({ requestId }, 'Parsed ingredients field is not an array, nullifying.');
          recipe.ingredients = null;
        }

        if (recipe.instructions && !Array.isArray(recipe.instructions)) {
          logger.warn({ requestId }, 'Parsed instructions field is not an array, nullifying.');
          recipe.instructions = null;
        }

        logger.info({ requestId }, 'Successfully parsed Gemini output.');
      } catch (parseErr: any) {
        logger.error({ requestId, err: parseErr }, 'JSON parse failed');
        logger.error({ requestId, rawResponse: text }, 'Raw Gemini response that failed to parse');
        error = `Failed to parse Gemini response: ${parseErr.message}`;
      }
    } else {
      error = 'Empty response from Gemini.';
      logger.warn({ requestId }, 'No text in Gemini response.');
    }
  } catch (err: any) {
    logger.error({ requestId, err }, 'Gemini call error');
    error = err instanceof Error ? err.message : 'Unknown Gemini error';

    if (err?.response?.promptFeedback?.blockReason) {
      error = `Gemini blocked response: ${err.response.promptFeedback.blockReason}`;
      logger.error({ requestId, reason: err.response.promptFeedback.blockReason }, 'Gemini blocked response');
      if (err.response.promptFeedback.safetyRatings) {
        logger.error({ requestId, ratings: err.response.promptFeedback.safetyRatings }, 'Gemini safety ratings');
      }
    }

    if (usage.inputTokens === 0 && usage.outputTokens === 0) {
      usage = normalizeUsageMetadata(null, 'gemini');
    }
  }

  const geminiParseTime = Date.now() - geminiStart;
  const totalTime = Date.now() - handlerStartTime;

  if (!recipe && !error) {
    logger.warn({ requestId }, 'No result and no error — defaulting to unknown failure.');
    error = 'AI returned no usable result.';
  }

  logger.info({ requestId, geminiParseTime, totalTime }, 'Gemini parsing complete.');
  logger.debug({ requestId, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }, 'Token usage');

  return {
    recipe,
    error,
    usage,
    timings: { geminiCombinedParse: geminiParseTime }
  };
}