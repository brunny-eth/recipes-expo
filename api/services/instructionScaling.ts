import { performance } from 'perf_hooks';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';
import { LLMResponse } from './substitutionRewriter';
import { buildScalingPrompt } from '../llm/scalingPrompts';
import { runDefaultLLM } from '../llm/adapters';

export async function scaleInstructions(
  instructionsToScale: string[],
  originalIngredients: any[],
  scaledIngredients: any[],
  requestId: string
): Promise<LLMResponse<{ scaledInstructions: string[] | null }>> {
  const prompt = buildScalingPrompt(instructionsToScale, originalIngredients, scaledIngredients);
  prompt.metadata = { requestId };

  const startTime = performance.now();

  try {
    const modelResponse = await runDefaultLLM(prompt);
    const endTime = performance.now();
    const timeMs = endTime - startTime;

    if (modelResponse.error || !modelResponse.output) {
      logger.error({ requestId, error: modelResponse.error }, 'Error from LLM in instruction scaling');
      return { scaledInstructions: null, error: modelResponse.error || 'LLM error', usage: modelResponse.usage, timeMs };
    }

    try {
      const cleanText = stripMarkdownFences(modelResponse.output);
      if (modelResponse.output !== cleanText) {
        logger.info({ source: 'instructionScaling.ts' }, "Stripped markdown fences from LLM response.");
      }
      const parsedResult: any = JSON.parse(cleanText);
      if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
        
        logger.info({ action: 'llm_scale_instructions', timeMs, usage: modelResponse.usage }, 'LLM instruction scaling successful.');
        return {
          scaledInstructions: parsedResult.scaledInstructions.map((item: any) => String(item)),
          error: null,
          usage: modelResponse.usage,
          timeMs
        };
      } else {
        throw new Error("Parsed JSON result did not have the expected 'scaledInstructions' array.");
      }
    } catch (parseErr) {
      const err = parseErr as Error;
      logger.error({ action: 'llm_scale_instructions', err, responseText: modelResponse.output }, 'Failed to parse scaled instructions JSON from LLM response.');
      return { scaledInstructions: null, error: 'Invalid JSON format received from AI instruction scaler.', usage: modelResponse.usage, timeMs };
    }
  } catch (err) {
    const error = err as Error;
    logger.error({ action: 'llm_scale_instructions', err: error }, 'Error during instruction scaling.');
    return { scaledInstructions: null, error: error.message, usage: {inputTokens: 0, outputTokens: 0}, timeMs: null };
  }
} 