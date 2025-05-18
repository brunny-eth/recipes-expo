import { performance } from 'perf_hooks';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';

type LLMResponse<T> = {
  [K in keyof T]: T[K];
} & {
  error: string | null;
  usage: { promptTokens: number; outputTokens: number } | null;
  timeMs: number | null;
};

export async function scaleInstructions(
  instructionsToScale: string[],
  originalIngredients: any[],
  scaledIngredients: any[],
  geminiModel: any
): Promise<LLMResponse<{ scaledInstructions: string[] | null }>> {
  const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
  const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

  const scalePrompt = `
You are an expert recipe editor. Your task is to rewrite recipe instructions to reflect changes in ingredient quantities.

Original ingredients: [${originalIngredientsDesc}]
Scaled ingredients: [${scaledIngredientsDesc}]

Update **only** ingredient quantities that are explicitly stated (e.g., "2 cups flour"). Do not modify vague references like "the onion" or "some salt".

**Rules**:
- Use the exact scaled quantity if numeric.
- For whole or indivisible ingredients (e.g. eggs, bay leaves, cinnamon sticks), round sensibly upwards.
- Be precise. If the original says "Add 2 tbsp olive oil" and the scaled amount is "1 tbsp", rewrite as "Add 1 tbsp olive oil".

Respond with ONLY a valid JSON object:
{
  "scaledInstructions": [ ... ] // same number of steps, rewritten for new quantities
}

Original Instructions:
${instructionsToScale.map(s => `- ${s}`).join('\n')}
`;

  const startTime = performance.now();

  try {
    if (scalePrompt.length > 100000) {
      throw new Error(`Scale prompt too large (${scalePrompt.length} chars).`);
    }

    const result = await geminiModel.generateContent(scalePrompt);
    const response = result.response;
    const responseText = response.text();

    const endTime = performance.now();
    const timeMs = endTime - startTime;

    if (responseText) {
      try {
        const cleanText = stripMarkdownFences(responseText);
        if (responseText !== cleanText) {
          logger.info({ source: 'instructionScaling.ts' }, "Stripped markdown fences from Gemini response.");
        }
        const parsedResult: any = JSON.parse(cleanText);
        if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
          const usage = {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0
          };
          logger.info({ action: 'gemini_scale_instructions', timeMs, usage, promptLength: scalePrompt.length }, 'Gemini instruction scaling successful.');
          return {
            scaledInstructions: parsedResult.scaledInstructions.map((item: any) => String(item)),
            error: null,
            usage,
            timeMs
          };
        } else {
          throw new Error("Parsed JSON result did not have the expected 'scaledInstructions' array.");
        }
      } catch (parseErr) {
        const err = parseErr as Error;
        logger.error({ action: 'gemini_scale_instructions', err, responseText }, 'Failed to parse scaled instructions JSON from Gemini response.');
        return { scaledInstructions: null, error: 'Invalid JSON format received from AI instruction scaler.', usage: null, timeMs: null };
      }
    } else {
      logger.warn({ action: 'gemini_scale_instructions' }, 'Empty response received from AI instruction scaler.');
      return { scaledInstructions: null, error: 'Empty response received from AI instruction scaler.', usage: null, timeMs: null };
    }
  } catch (err) {
    const error = err as Error;
    logger.error({ action: 'gemini_scale_instructions', err: error }, 'Error during Gemini instruction scaling.');
    return { scaledInstructions: null, error: error.message, usage: null, timeMs: null };
  }
} 