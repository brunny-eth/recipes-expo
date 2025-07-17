import { performance } from 'perf_hooks';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';
import { buildSubstitutionPrompt, IngredientChange } from '../llm/substitutionPrompts';
import { runDefaultLLM } from '../llm/adapters';
import { StandardizedUsage } from '../utils/usageUtils';

// Define LLMResponse type for consistent return format
export type LLMResponse<T> = {
    error: string | null;
    usage: StandardizedUsage;
    timeMs: number | null;
} & T;

// New unified signature
export async function rewriteForSubstitution(
    originalInstructions: string[],
    substitutions: IngredientChange[],
    requestId: string
): Promise<LLMResponse<{ rewrittenInstructions: string[] | null; newTitle: string | null }>> {

    const removalCount = substitutions.filter(s => !s.to || (typeof s.to === 'string' && s.to.trim() === '')).length;

    const prompt = buildSubstitutionPrompt(originalInstructions, substitutions);
    prompt.metadata = { requestId };

    const startTime = performance.now();

    logger.info({ phase: 'start', substitutions, removalCount }, '[REWRITE] Starting unified instruction rewrite');

    // ---- Early validation ----
    if (!originalInstructions || originalInstructions.length === 0) {
        logger.error({ phase: 'validation_failed', reason: 'No instructions provided' }, '[REWRITE] No instructions to rewrite — aborting');
        return { rewrittenInstructions: null, newTitle: null, error: 'No instructions provided to rewrite.', usage: { inputTokens: 0, outputTokens: 0 }, timeMs: null };
    }

    if (removalCount > 0) {
        const removedNames = substitutions.filter(s => !s.to || (typeof s.to === 'string' && s.to.trim() === '')).map(s => s.from);
        logger.info({ phase: 'removal_trigger', removedNames }, '[REWRITE] Triggered removal mode');
    }

    // Log prompt preview for removal mode (avoid massive logs)
    if (removalCount > 0) {
        const previewText = `${prompt.system} ${prompt.text}`.substring(0, 500);
        logger.debug({ phase: 'prompt_preview', preview: previewText }, '[REWRITE] Removal prompt preview');
    }

    try {
        const modelResponse = await runDefaultLLM(prompt);

        const endTime = performance.now();
        const timeMs = endTime - startTime;

        if (modelResponse.error || !modelResponse.output) {
            logger.error({ requestId, error: modelResponse.error }, 'Error from LLM in substitution rewriter');
            return { rewrittenInstructions: null, newTitle: null, error: modelResponse.error || 'LLM error', usage: modelResponse.usage, timeMs };
        }

        try {
            const cleanText = stripMarkdownFences(modelResponse.output);
            if (modelResponse.output !== cleanText) {
                logger.info({ source: 'substitutionRewriter.ts' }, "Stripped markdown fences from LLM response.");
            }
            const parsedResult: any = JSON.parse(cleanText);
            if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                
                logger.info({ phase: 'success', llm: 'default', timeMs, usage: modelResponse.usage }, '[REWRITE] Success');
                logger.debug('[REWRITE] Rewritten instructions', { instructions: parsedResult.rewrittenInstructions });
                return {
                    rewrittenInstructions: parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'),
                    newTitle: parsedResult.newTitle || null,
                    error: null,
                    usage: modelResponse.usage,
                    timeMs
                };
            } else {
                throw new Error("Parsed JSON result did not have the expected structure.");
            }
        } catch (parseError) {
            const err = parseError as Error;
            logger.error({ phase: 'parse_error', source: 'llm', err, responsePreview: modelResponse.output ? modelResponse.output.substring(0, 400) : 'EMPTY' }, '[REWRITE] Error parsing LLM response');
            throw err;
        }

    } catch (err) {
        const error = err as Error;
        logger.error({ action: 'llm_rewrite_substitution', err: error }, 'Error during substitution rewrite.');
        return { rewrittenInstructions: null, newTitle: null, error: error.message, usage: {inputTokens: 0, outputTokens: 0}, timeMs: null };
    }
} 