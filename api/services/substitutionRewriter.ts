import { performance } from 'perf_hooks';
import { formatMeasurement } from '../../utils/format';
import logger from '../lib/logger';

type LLMResponse<T> = {
  [K in keyof T]: T[K];
} & {
  error: string | null;
  usage: { promptTokens: number; outputTokens: number } | null;
  timeMs: number | null;
};

export async function rewriteForSubstitution(originalInstructions: string[], originalIngredientName: string, substitutedIngredientName: string, geminiModel: any): Promise<LLMResponse<{ rewrittenInstructions: string[] | null }>> {
    const cleanedSubstitutedIngredientName = formatMeasurement(Number(substitutedIngredientName));

    const rewritePrompt = `
    You are an expert cooking assistant. You will rewrite cooking instructions to reflect ingredient substitutions based on user preferences.
    
    Original Ingredient: "${originalIngredientName}"
    Substituted Ingredient: "${cleanedSubstitutedIngredientName}"
    
    Consider:
    - Preparation differences (e.g. tofu may need pressing, beans may need soaking)
    - Cooking time or method changes based on the substituted ingredient
    - Flavor or texture impacts
    - Any changes in food safety or allergen concerns
    
    If no meaningful change is required, return the original steps unchanged.
    
    Respond with ONLY a valid JSON object:
    {
      "rewrittenInstructions": [ ... ] // each step as a plain string, without numbering
    }
    
    Original Instructions:
    ${originalInstructions.map(s => `- ${s}`).join('\n')}
`;

    const startTime = performance.now();

    try {
        if (rewritePrompt.length > 100000) {
            throw new Error(`Rewrite prompt too large (${rewritePrompt.length} chars).`);
        }

        const result = await geminiModel.generateContent(rewritePrompt);
        const response = result.response;
        const responseText = response.text();

        const endTime = performance.now();
        const timeMs = endTime - startTime;

        if (responseText) {
            try {
                const parsedResult: any = JSON.parse(responseText);
                if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                    const usage = {
                        promptTokens: response.usageMetadata?.promptTokenCount || 0,
                        outputTokens: response.usageMetadata?.candidatesTokenCount || 0
                    };
                    logger.info({ action: 'gemini_rewrite_substitution', timeMs, usage, promptLength: rewritePrompt.length }, 'Gemini substitution rewrite successful.');
                    return {
                        rewrittenInstructions: parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'),
                        error: null,
                        usage,
                        timeMs
                    };
                } else {
                    throw new Error("Parsed JSON result did not have the expected structure.");
                }
            } catch (parseError) {
                const err = parseError as Error;
                logger.error({ action: 'gemini_rewrite_substitution', err, responseText }, 'Failed to parse substitution rewrite JSON from Gemini response.');
                throw err;
            }
        } else {
            logger.warn({ action: 'gemini_rewrite_substitution' }, 'Empty response received from AI instruction rewriter.');
            return { rewrittenInstructions: null, error: 'Empty response received from AI instruction rewriter.', usage: null, timeMs: null };
        }
    } catch (err) {
        const error = err as Error;
        logger.error({ action: 'gemini_rewrite_substitution', err: error }, 'Error during Gemini substitution rewrite.');
        return { rewrittenInstructions: null, error: error.message, usage: null, timeMs: null };
    }
} 