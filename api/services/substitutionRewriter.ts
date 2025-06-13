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

// New unified signature
export type IngredientChange = { from: string; to: string | null };

export async function rewriteForSubstitution(
    originalInstructions: string[],
    substitutionsOrFrom: IngredientChange[] | string,
    substitutedOrGemini: string | any,
    maybeGemini?: any
): Promise<LLMResponse<{ rewrittenInstructions: string[] | null }>> {
    // Back-compat handling
    let geminiModel: any;
    let substitutions: IngredientChange[] = [];
    let originalIngredientName: string | undefined;
    let substitutedIngredientName: string | null | undefined;
    if (Array.isArray(substitutionsOrFrom)) {
        substitutions = substitutionsOrFrom;
        geminiModel = substitutedOrGemini;
    } else {
        originalIngredientName = substitutionsOrFrom;
        substitutedIngredientName = substitutedOrGemini as string;
        geminiModel = maybeGemini;
        substitutions = [{ from: originalIngredientName, to: substitutedIngredientName ?? null }];
    }

    const removalCount = substitutions.filter(s => !s.to || s.to.trim() === '').length;

    // Build substitution line strings
    const substitutionLines = substitutions.map(sub => {
        if (!sub.to || sub.to.trim() === '') {
            // derive simple alternative names (last word and grated form)
            const words = sub.from.split(' ');
            const base = words[words.length - 1];
            const altPhrases: string[] = [];
            if (base.toLowerCase() !== sub.from.toLowerCase()) altPhrases.push(base);
            altPhrases.push(`grated ${base}`);
            const altLine = altPhrases.length ? `\nALSO REMOVE if referred to as: ${altPhrases.map(a=>`"${a}"`).join(', ')}` : '';
            return `REMOVE: "${sub.from}"${altLine}`;
        }
        return `REPLACE: "${sub.from}" → "${formatMeasurement(Number(sub.to)) || sub.to}"`;
    }).join('\n');

    const rewritePrompt = `
    You are an expert recipe editor. Rewrite the cooking instructions to reflect the following ingredient changes.

    ${substitutionLines}

    Rules:
    1. For any ingredients marked REMOVE, eliminate all mentions/usages as if never present.
    2. For any ingredients marked REPLACE, update wording/preparation to use the substitute. Adjust timings/prep if needed.
    3. Preserve step order and DO NOT number the steps.
    4. Output natural instructions without phrases like "omit" or "instead"—just the corrected steps.

    Respond ONLY in valid JSON:
    { "rewrittenInstructions": [ ... ] }

    ORIGINAL_INSTRUCTIONS:
    ${originalInstructions.map(s => `- ${s}`).join('\n')}
`;

    const startTime = performance.now();

    logger.info({ phase: 'start', substitutions, removalCount }, '[REWRITE] Starting unified instruction rewrite');

    // ---- Early validation ----
    if (!originalInstructions || originalInstructions.length === 0) {
        logger.error({ phase: 'validation_failed', reason: 'No instructions provided' }, '[REWRITE] No instructions to rewrite — aborting');
        return { rewrittenInstructions: null, error: 'No instructions provided to rewrite.', usage: null, timeMs: null };
    }

    if (removalCount > 0) {
        const removedNames = substitutions.filter(s => !s.to || s.to.trim() === '').map(s => s.from);
        logger.info({ phase: 'removal_trigger', removedNames }, '[REWRITE] Triggered removal mode');
    }

    // Log prompt preview for removal mode (avoid massive logs)
    if (removalCount > 0) {
        logger.debug({ phase: 'prompt_preview', preview: rewritePrompt.substring(0, 500) }, '[REWRITE] Removal prompt preview');
    }

    try {
        if (rewritePrompt.length > 100000) {
            throw new Error(`Rewrite prompt too large (${rewritePrompt.length} chars).`);
        }

        try {
            logger.info({ phase: 'gemini_call' }, '[REWRITE] Calling Gemini');
            const result = await geminiModel.generateContent(rewritePrompt);
            const response = result.response;
            const responseText = response.text();

            const endTime = performance.now();
            const timeMs = endTime - startTime;

            logger.info({ phase: 'gemini_response', responsePreview: responseText ? responseText.substring(0, 400) : 'EMPTY' }, '[REWRITE] Gemini response text');

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
                        logger.info({ phase: 'success', llm: 'gemini', timeMs, usage, promptTokens: usage.promptTokens, outputTokens: usage.outputTokens }, '[REWRITE] Success');
                        logger.debug('[REWRITE] Rewritten instructions', { instructions: parsedResult.rewrittenInstructions });
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
                    logger.error({ phase: 'parse_error', source: 'gemini', err, responsePreview: responseText ? responseText.substring(0, 400) : 'EMPTY' }, '[REWRITE] Error parsing LLM response');
                    throw err;
                }
            } else {
                logger.warn({ phase: 'empty_response', source: 'gemini' }, '[REWRITE] Empty response received from AI instruction rewriter.');
                return { rewrittenInstructions: null, error: 'Empty response received from AI instruction rewriter.', usage: null, timeMs: null };
            }
        } catch (geminiErr: any) {
            // Handle specific Gemini errors that should trigger fallback
            if (geminiErr?.status === 503 || geminiErr?.message?.includes('503') || geminiErr?.message?.includes('unavailable')) {
                logger.warn({ phase: 'gemini_error', error: geminiErr }, '[REWRITE] Gemini service unavailable. Falling back to OpenAI');
                
                // Try OpenAI fallback
                try {
                    if (!openai) {
                        throw new Error('OpenAI client not initialized (API key might be missing)');
                    }
                    
                    const openAIMessages = [
                        { role: 'system', content: 'You are an expert recipe editor.' },
                        { role: 'user', content: rewritePrompt }
                    ];

                    logger.info({ phase: 'openai_call' }, '[REWRITE] Calling OpenAI fallback');

                    const completion = await openai.chat.completions.create({
                        model: "gpt-4-turbo",
                        messages: openAIMessages as any,
                        response_format: { type: "json_object" }
                    });
                    
                    const responseText = completion.choices[0].message.content;
                    const endTime = performance.now();
                    const timeMs = endTime - startTime;
                    
                    logger.info({ phase: 'openai_response', responsePreview: responseText ? responseText.substring(0, 400) : 'EMPTY' }, '[REWRITE] OpenAI response text');

                    if (responseText) {
                        try {
                            const parsedResult: any = JSON.parse(responseText);
                            if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                                const usage = {
                                    promptTokens: completion.usage?.prompt_tokens || 0,
                                    outputTokens: completion.usage?.completion_tokens || 0
                                };
                                logger.info({ phase: 'success', llm: 'openai', timeMs, usage, promptTokens: usage.promptTokens, outputTokens: usage.outputTokens }, '[REWRITE] Success (OpenAI fallback)');
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
                            logger.error({ phase: 'parse_error', source: 'openai', err, responsePreview: responseText ? responseText.substring(0, 400) : 'EMPTY' }, '[REWRITE] Error parsing OpenAI response');
                            throw err;
                        }
                    } else {
                        logger.warn({ phase: 'empty_response', source: 'openai' }, '[REWRITE] Empty response received from OpenAI instruction rewriter.');
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