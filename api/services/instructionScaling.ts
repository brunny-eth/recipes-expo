import { performance } from 'perf_hooks';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';
import openai from '../lib/openai';
import { LLMResponse } from './substitutionRewriter';
import { buildScalingPrompt } from '../llm/scalingPrompts';

export async function scaleInstructions(
  instructionsToScale: string[],
  originalIngredients: any[],
  scaledIngredients: any[],
  geminiModel: any
): Promise<LLMResponse<{ scaledInstructions: string[] | null }>> {
  const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
  const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

  const scalePrompt = buildScalingPrompt(instructionsToScale, originalIngredients, scaledIngredients);

  const startTime = performance.now();

  try {
    if (scalePrompt.length > 100000) {
      throw new Error(`Scale prompt too large (${scalePrompt.length} chars).`);
    }

    try {
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
    } catch (geminiErr: any) {
      // Handle specific Gemini errors that should trigger fallback
      if (geminiErr?.status === 503 || geminiErr?.message?.includes('503') || geminiErr?.message?.includes('unavailable')) {
        logger.warn({ error: geminiErr }, `Gemini service unavailable for instruction scaling. Falling back to OpenAI.`);
        
        // Try OpenAI fallback
        try {
          if (!openai) {
            throw new Error('OpenAI client not initialized (API key might be missing)');
          }
          
          const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              {
                role: "system",
                content: `You are an expert recipe editor. Your task is to rewrite recipe instructions to reflect changes in ingredient quantities.`
              },
              {
                role: "user",
                content: scalePrompt
              }
            ],
            response_format: { type: "json_object" }
          });
          
          const responseText = completion.choices[0].message.content;
          const endTime = performance.now();
          const timeMs = endTime - startTime;
          
          if (responseText) {
            try {
              const parsedResult: any = JSON.parse(responseText);
              if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
                const usage = {
                  promptTokens: completion.usage?.prompt_tokens || 0,
                  outputTokens: completion.usage?.completion_tokens || 0
                };
                logger.info({ action: 'openai_scale_instructions', timeMs, usage, promptLength: scalePrompt.length }, 'OpenAI fallback instruction scaling successful.');
                return {
                  scaledInstructions: parsedResult.scaledInstructions.map((item: any) => String(item)),
                  error: null,
                  usage,
                  timeMs
                };
              } else {
                throw new Error("Parsed JSON result from OpenAI did not have the expected 'scaledInstructions' array.");
              }
            } catch (parseErr) {
              const err = parseErr as Error;
              logger.error({ action: 'openai_scale_instructions', err, responseText }, 'Failed to parse scaled instructions JSON from OpenAI response.');
              return { scaledInstructions: null, error: 'Invalid JSON format received from OpenAI instruction scaler.', usage: null, timeMs: null };
            }
          } else {
            logger.warn({ action: 'openai_scale_instructions' }, 'Empty response received from OpenAI instruction scaler.');
            return { scaledInstructions: null, error: 'Empty response received from OpenAI instruction scaler.', usage: null, timeMs: null };
          }
        } catch (openaiErr: any) {
          logger.error({ action: 'openai_scale_instructions', error: openaiErr }, 'OpenAI fallback also failed for instruction scaling.');
          return { scaledInstructions: null, error: `Both Gemini and OpenAI fallback failed: ${openaiErr.message || 'Unknown error'}`, usage: null, timeMs: null };
        }
      } else {
        // Re-throw other errors
        throw geminiErr;
      }
    }
  } catch (err) {
    const error = err as Error;
    logger.error({ action: 'gemini_scale_instructions', err: error }, 'Error during instruction scaling.');
    return { scaledInstructions: null, error: error.message, usage: null, timeMs: null };
  }
} 