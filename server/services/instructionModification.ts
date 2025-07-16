import { performance } from 'perf_hooks';
import logger from '../lib/logger';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';
import { buildModificationPrompt, IngredientChange } from '../llm/modificationPrompts';
import { runDefaultLLM } from '../llm/adapters';
import { StandardizedUsage } from '../utils/usageUtils';

// Define LLMResponse type for consistent return format
export type LLMResponse<T> = {
    error: string | null;
    usage: StandardizedUsage;
    timeMs: number | null;
} & T;

export async function modifyInstructions(
    originalInstructions: string[],
    substitutions: IngredientChange[],
    originalIngredients: any[],
    scaledIngredients: any[],
    scalingFactor: number,
    requestId: string
): Promise<LLMResponse<{ modifiedInstructions: string[] | null; newTitle: string | null }>> {

    const needsSubstitution = substitutions.length > 0;
    const needsScaling = scalingFactor !== 1;
    const removalCount = substitutions.filter(s => !s.to || s.to.trim() === '').length;

    const prompt = buildModificationPrompt(
        originalInstructions, 
        substitutions, 
        originalIngredients, 
        scaledIngredients, 
        scalingFactor
    );
    prompt.metadata = { requestId };

    const startTime = performance.now();

    logger.info({ 
        phase: 'start', 
        needsSubstitution, 
        needsScaling, 
        substitutions, 
        scalingFactor, 
        removalCount 
    }, '[MODIFY] Starting unified instruction modification');

    // ---- Early validation ----
    if (!originalInstructions || originalInstructions.length === 0) {
        logger.error({ phase: 'validation_failed', reason: 'No instructions provided' }, '[MODIFY] No instructions to modify — aborting');
        return { 
            modifiedInstructions: null, 
            newTitle: null, 
            error: 'No instructions provided to modify.', 
            usage: { inputTokens: 0, outputTokens: 0 }, 
            timeMs: null 
        };
    }

    if (!needsSubstitution && !needsScaling) {
        logger.info({ phase: 'no_changes_needed' }, '[MODIFY] No modifications needed, returning original instructions');
        const endTime = performance.now();
        return {
            modifiedInstructions: originalInstructions,
            newTitle: null,
            error: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            timeMs: endTime - startTime
        };
    }

    if (needsSubstitution && removalCount > 0) {
        const removedNames = substitutions.filter(s => !s.to || s.to.trim() === '').map(s => s.from);
        logger.info({ phase: 'removal_trigger', removedNames }, '[MODIFY] Modification includes ingredient removals');
    }

    if (needsScaling) {
        logger.info({ phase: 'scaling_trigger', scalingFactor }, '[MODIFY] Modification includes quantity scaling');
    }

    try {
        const modelResponse = await runDefaultLLM(prompt);

        const endTime = performance.now();
        const timeMs = endTime - startTime;

        if (modelResponse.error || !modelResponse.output) {
            logger.error({ requestId, error: modelResponse.error }, 'Error from LLM in instruction modification');
            return { 
                modifiedInstructions: null, 
                newTitle: null, 
                error: modelResponse.error || 'LLM error', 
                usage: modelResponse.usage, 
                timeMs 
            };
        }

        try {
            const cleanText = stripMarkdownFences(modelResponse.output);
            if (modelResponse.output !== cleanText) {
                logger.info({ source: 'instructionModification.ts' }, "Stripped markdown fences from LLM response.");
            }
            const parsedResult: any = JSON.parse(cleanText);
            
            if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.modifiedInstructions)) {
                
                logger.info({ 
                    phase: 'success', 
                    llm: 'default', 
                    timeMs, 
                    usage: modelResponse.usage,
                    needsSubstitution,
                    needsScaling 
                }, '[MODIFY] Success');
                
                logger.debug('[MODIFY] Modified instructions', { instructions: parsedResult.modifiedInstructions });
                
                return {
                    modifiedInstructions: parsedResult.modifiedInstructions.filter((step: any) => typeof step === 'string'),
                    newTitle: parsedResult.newTitle || null,
                    error: null,
                    usage: modelResponse.usage,
                    timeMs
                };
            } else {
                throw new Error("Parsed JSON result did not have the expected structure with 'modifiedInstructions' array.");
            }
        } catch (parseError) {
            const err = parseError as Error;
            logger.error({ 
                phase: 'parse_error', 
                source: 'llm', 
                err, 
                responsePreview: modelResponse.output ? modelResponse.output.substring(0, 400) : 'EMPTY' 
            }, '[MODIFY] Error parsing LLM response');
            throw err;
        }

    } catch (err) {
        const error = err as Error;
        logger.error({ action: 'llm_modify_instructions', err: error }, 'Error during instruction modification.');
        return { 
            modifiedInstructions: null, 
            newTitle: null, 
            error: error.message, 
            usage: {inputTokens: 0, outputTokens: 0}, 
            timeMs: null 
        };
    }
} 