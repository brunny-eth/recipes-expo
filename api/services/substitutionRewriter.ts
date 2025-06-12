import { performance } from 'perf_hooks';
import { formatMeasurement } from '../../utils/format';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';
import openai from '../lib/openai';

// Define LLMResponse type for consistent return format
export type LLMResponse<T> = {
    error: string | null;
    usage: {
        promptTokens: number;
        outputTokens: number;
    } | null;
    timeMs: number | null;
} & T;

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

        try {
            const result = await geminiModel.generateContent(rewritePrompt);
            const response = result.response;
            const responseText = response.text();

            const endTime = performance.now();
            const timeMs = endTime - startTime;

            if (responseText) {
                try {
                    const cleanText = stripMarkdownFences(responseText);
                    if (responseText !== cleanText) {
                        logger.info({ source: 'substitutionRewriter.ts' }, "Stripped markdown fences from Gemini response.");
                    }
                    const parsedResult: any = JSON.parse(cleanText);
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
        } catch (geminiErr: any) {
            // Handle specific Gemini errors that should trigger fallback
            if (geminiErr?.status === 503 || geminiErr?.message?.includes('503') || geminiErr?.message?.includes('unavailable')) {
                logger.warn({ error: geminiErr }, `Gemini service unavailable for substitution rewrite. Falling back to OpenAI.`);
                
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
                                content: `You are an expert cooking assistant. You will rewrite cooking instructions to reflect ingredient substitutions based on user preferences.`
                            },
                            {
                                role: "user",
                                content: `Original Ingredient: "${originalIngredientName}"
Substituted Ingredient: "${cleanedSubstitutedIngredientName}"

Consider:
- Preparation differences (e.g. tofu may need pressing, beans may need soaking)
- Cooking time or method changes based on the substituted ingredient
- Flavor or texture impacts
- Any changes in food safety or allergen concerns

If no meaningful change is required, return the original steps unchanged.

Original Instructions:
${originalInstructions.map(s => `- ${s}`).join('\n')}

Respond with ONLY a valid JSON object:
{
  "rewrittenInstructions": [ ... ] // each step as a plain string, without numbering
}`
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
                            if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                                const usage = {
                                    promptTokens: completion.usage?.prompt_tokens || 0,
                                    outputTokens: completion.usage?.completion_tokens || 0
                                };
                                logger.info({ action: 'openai_rewrite_substitution', timeMs, usage, promptLength: rewritePrompt.length }, 'OpenAI fallback substitution rewrite successful.');
                                return {
                                    rewrittenInstructions: parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'),
                                    error: null,
                                    usage,
                                    timeMs
                                };
                            } else {
                                throw new Error("Parsed JSON result from OpenAI did not have the expected structure.");
                            }
                        } catch (parseError) {
                            const err = parseError as Error;
                            logger.error({ action: 'openai_rewrite_substitution', err, responseText }, 'Failed to parse substitution rewrite JSON from OpenAI response.');
                            throw err;
                        }
                    } else {
                        logger.warn({ action: 'openai_rewrite_substitution' }, 'Empty response received from OpenAI instruction rewriter.');
                        return { rewrittenInstructions: null, error: 'Empty response received from OpenAI instruction rewriter.', usage: null, timeMs: null };
                    }
                } catch (openaiErr: any) {
                    logger.error({ action: 'openai_rewrite_substitution', error: openaiErr }, 'OpenAI fallback also failed for substitution rewrite.');
                    throw new Error(`Both Gemini and OpenAI fallback failed: ${openaiErr.message || 'Unknown error'}`);
                }
            } else {
                // Re-throw other errors
                throw geminiErr;
            }
        }
    } catch (err) {
        const error = err as Error;
        logger.error({ action: 'gemini_rewrite_substitution', err: error }, 'Error during substitution rewrite.');
        return { rewrittenInstructions: null, error: error.message, usage: null, timeMs: null };
    }
} 