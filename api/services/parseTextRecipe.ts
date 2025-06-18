import { GeminiModel, CombinedParsedRecipe, GeminiHandlerResponse } from '../types';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';
import { detectInputType } from '../utils/detectInputType';
import { generateCacheKeyHash } from '../utils/hash';
import { extractFromRawText } from './textProcessor';
import { StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';
import { normalizeUsageMetadata } from '../utils/usageUtils';
import { finalValidateRecipe } from './finalValidateRecipe';
import { ParseResult } from './parseRecipe';
import { geminiAdapter, runDefaultLLM } from '../llm/adapters';
import { buildTextParsePrompt } from '../llm/parsingPrompts';
import { ParseErrorCode, StructuredError } from '../types/errors';
import { embedText } from '../../utils/embedText';
import { findSimilarRecipe } from '../../utils/findSimilarRecipe';

const MAX_PREVIEW_LENGTH = 100;
const SIMILARITY_THRESHOLD = 0.55;

function normalizeServings(servingRaw: string | null): string | null {
    if (!servingRaw) return null;
  
    const parts = servingRaw.split(',').map(s => s.trim());
    const unique = [...new Set(parts)];

    const numericPart = unique.find(s => /^\d+(\.\d+)?$/.test(s));
    if (numericPart) return numericPart;

    for (const part of unique) {
        const rangeMatch = part.match(/(\d+(\.\d+)?)[\s–-]+(\d+(\.\d+)?)/);
        if (rangeMatch) return rangeMatch[1];
    }

    return unique[0];
}

export async function parseTextRecipe(
    input: string,
    intent: 'fuzzy_match' | 'literal' = 'literal',
    requestId: string
): Promise<ParseResult> {
    const requestStartTime = Date.now();
    let overallTimings: ParseResult['timings'] = {
        dbCheck: -1,
        geminiParse: -1,
        dbInsert: -1,
        total: -1
    };
    let handlerUsage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
    const inputType = 'raw_text';
    const trimmedInput = input.trim();
    const cacheKey = generateCacheKeyHash(trimmedInput);
    let isFallback = false;

    // --- Start Fuzzy Match Logic ---
    if (intent === 'fuzzy_match' && process.env.ENABLE_FUZZY_MATCH === 'true') {
        logger.info({ requestId, intent }, "Attempting fuzzy match.");
        try {
            const embeddingStartTime = Date.now();
            const embedding = await embedText(trimmedInput);
            const embeddingTime = Date.now() - embeddingStartTime;

            const searchStartTime = Date.now();
            const match = await findSimilarRecipe(embedding);
            const searchTime = Date.now() - searchStartTime;

            if (match && match.recipe && match.similarity > SIMILARITY_THRESHOLD) {
                logger.info({
                    requestId,
                    similarity: match.similarity,
                    matchedRecipeId: match.recipe.id,
                    llm_skipped: true,
                    timings: { embeddingTime, searchTime }
                }, "Fuzzy match found, returning matched recipe directly.");

                // The matched recipe data is already in the correct format.
                // We can short-circuit and return immediately.
                return {
                    recipe: match.recipe,
                    error: null,
                    fromCache: true, // Treat it as a cache hit for analytics
                    inputType,
                    cacheKey: match.recipe.url, // Use the matched recipe's key
                    timings: { ...overallTimings, total: Date.now() - requestStartTime, dbCheck: searchTime },
                    usage: { inputTokens: 0, outputTokens: 0 },
                    fetchMethodUsed: 'fuzzy_match'
                };
            } else {
                 logger.info(
                    {
                        requestId,
                        similarity: match?.similarity ?? 'N/A',
                        matchedRecipeId: match?.recipe?.id ?? null,
                        llm_skipped: false
                    }, 
                    "No suitable fuzzy match found or threshold not met. Proceeding with LLM."
                );
            }

        } catch (fuzzyError: any) {
            logger.error({ requestId, error: fuzzyError.message }, "Error during fuzzy match process. Falling back to LLM.");
        }
    }
    // --- End Fuzzy Match Logic ---

    try {
        if (trimmedInput.length < 20 && !trimmedInput.includes(' ')) {
             const errorPayload: StructuredError = {
                code: ParseErrorCode.INVALID_INPUT,
                message: "That didn't look like a real recipe. Try describing a dish or pasting a full recipe."
            };
            logger.warn({ requestId, input: trimmedInput }, "Rejected input as invalid (too short, no spaces).");
            return {
                recipe: null,
                error: errorPayload,
                fromCache: false,
                inputType,
                cacheKey,
                timings: { dbCheck: -1, geminiParse: -1, dbInsert: -1, total: Date.now() - requestStartTime },
                usage: { inputTokens: 0, outputTokens: 0 },
                fetchMethodUsed: 'N/A'
            };
        }

        logger.info({ requestId, inputType, inputLength: trimmedInput.length, cacheKey }, `Received parse request.`);

        const dbCheckStartTime = Date.now();
        try {
            const { data: cachedRecipe, error: dbError } = await supabase
                .from('processed_recipes_cache')
                .select('recipe_data')
                .eq('url', cacheKey)
                .maybeSingle();

            overallTimings.dbCheck = Date.now() - dbCheckStartTime;

            if (dbError) {
                logger.error({ requestId, cacheKey, err: dbError }, `Error checking cache in Supabase.`);
            }

            if (cachedRecipe && cachedRecipe.recipe_data) {
                logger.info({ requestId, cacheKey, dbCheckMs: overallTimings.dbCheck }, `Cache hit. Returning cached data.`);
                overallTimings.total = Date.now() - requestStartTime;
                return { recipe: cachedRecipe.recipe_data, error: null, fromCache: true, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed: 'N/A' };
            }
            logger.info({ requestId, cacheKey, dbCheckMs: overallTimings.dbCheck }, `Cache miss. Proceeding with processing.`);
        } catch (cacheError) {
            overallTimings.dbCheck = Date.now() - dbCheckStartTime;
            logger.error({ requestId, cacheKey, err: cacheError }, `Exception during cache check.`);
        }

        let processingError: string | null = null;
        let finalRecipeData: CombinedParsedRecipe | null = null;
        let usedFallback = false;

        const { preparedText, error: prepareError, timings: prepTimings } = extractFromRawText(trimmedInput, requestId);
        overallTimings.prepareText = prepTimings.prepareText;

        if (prepareError) {
            processingError = prepareError;
            logger.error({ requestId, error: processingError }, `Raw text processing failed during preparation`);
        } else {
            logger.info({ requestId, prepareMs: overallTimings.prepareText, textLength: preparedText?.length ?? 0 }, `Raw text prepared.`);
            
            const prompt = buildTextParsePrompt(preparedText!);
            prompt.metadata = { requestId };

            const modelStartTime = Date.now();
            const modelResponse = await runDefaultLLM(prompt);
            
            overallTimings.geminiParse = Date.now() - modelStartTime;
            handlerUsage = modelResponse.usage;

            if (modelResponse.error || !modelResponse.output) {
                processingError = modelResponse.error || "Model returned no output.";
                logger.error({ requestId, error: processingError }, `Raw text processing failed during model parse`);
            } else {
                try {
                    finalRecipeData = JSON.parse(modelResponse.output);
                     logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: `llm_parse_raw_text` }, `LLM parse completed for Raw Text.`);
                } catch (parseErr: any) {
                    processingError = `Failed to parse model response: ${parseErr.message}`;
                    logger.error({ requestId, error: processingError, responseText: modelResponse.output }, 'JSON parse failed for model response');
                }
            }
        }

        if (processingError) {
            overallTimings.total = Date.now() - requestStartTime;
            logger.error({ requestId, error: processingError, inputType, timings: overallTimings }, `Processing ultimately failed for input.`);
            return { recipe: null, error: { code: ParseErrorCode.GENERATION_FAILED, message: processingError }, fromCache: false, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed: 'N/A' };
        }

        const isEmptyRecipe = (
            !finalRecipeData?.title &&
            (!finalRecipeData?.ingredients || finalRecipeData.ingredients.length === 0) &&
            (!finalRecipeData?.instructions || finalRecipeData.instructions.length === 0)
        );

        if (isEmptyRecipe) {
          logger.warn({ requestId }, "[parse] Model returned an empty recipe. Rejecting.");
          return {
            recipe: null,
            error: {
              code: ParseErrorCode.GENERATION_EMPTY,
              message: "We couldn't create a recipe from that. Try adding a few more details or ingredients."
            },
            fromCache: false,
            inputType,
            cacheKey,
            timings: { ...overallTimings, total: Date.now() - requestStartTime },
            usage: handlerUsage,
            fetchMethodUsed: 'N/A'
          };
        }

        const validationResult = finalValidateRecipe(finalRecipeData, requestId);
        if (!validationResult.ok) {
            logger.warn({ requestId, reasons: validationResult.reasons }, "Final validation failed, rejecting recipe.");
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.FINAL_VALIDATION_FAILED,
                    message: "Can you be a bit more descriptive about the meal you want?"
                },
                fromCache: false,
                inputType,
                cacheKey,
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'N/A'
            };
        }

        if (finalRecipeData) {
            if (finalRecipeData.recipeYield) {
                finalRecipeData.recipeYield = normalizeServings(finalRecipeData.recipeYield);
            }

            const preview = finalRecipeData.title
                ? finalRecipeData.title.substring(0, MAX_PREVIEW_LENGTH) + (finalRecipeData.title.length > MAX_PREVIEW_LENGTH ? '...' : '')
                : '(No title found)';
            logger.info({ requestId, preview }, `Successfully parsed recipe.`);

            const dbInsertStartTime = Date.now();
            try {
                const { error: insertError } = await supabase
                    .from('processed_recipes_cache')
                    .insert({
                        url: cacheKey,
                        recipe_data: finalRecipeData,
                        source_type: inputType
                    });

                overallTimings.dbInsert = Date.now() - dbInsertStartTime;

                if (insertError) {
                    logger.error({ requestId, cacheKey, err: insertError }, `Error saving recipe to cache.`);
                } else {
                    logger.info({ requestId, cacheKey, dbInsertMs: overallTimings.dbInsert }, `Successfully cached new recipe.`);
                }
            } catch (cacheInsertError) {
                overallTimings.dbInsert = Date.now() - dbInsertStartTime;
                logger.error({ requestId, cacheKey, err: cacheInsertError }, `Exception during cache insertion.`);
            }

            if (finalRecipeData) {
              const finalSizeKb = Buffer.byteLength(JSON.stringify(finalRecipeData), 'utf8') / 1024;
              logger.info({ requestId, sizeKb: finalSizeKb.toFixed(2), event: 'final_recipe_size' }, 'Size of final structured recipe JSON');
            }
        } else {
            logger.warn({ requestId, inputType }, `Processing finished without error, but no final recipe data was produced.`);
            overallTimings.dbInsert = 0;
        }

        overallTimings.total = Date.now() - requestStartTime;
        logger.info({ 
            requestId, 
            success: !!finalRecipeData, 
            inputType, 
            intent,
            fromCache: false, 
            fetchMethod: 'N/A', 
            usedFallback: isFallback,
            fallbackType: null,
            timings: overallTimings, 
            event: 'parse_request_complete' 
        }, `Request complete.`);
        logger.info({ requestId, usage: handlerUsage, event: 'token_usage_summary' }, `Final Token Usage.`);

        logger.debug({
          requestId,
          finalRecipeTitle: finalRecipeData?.title,
          numIngredients: finalRecipeData?.ingredients?.length ?? 0,
          servings: finalRecipeData?.recipeYield
        }, "Final structured recipe returned to client");

        return {
            recipe: finalRecipeData,
            error: null,
            fromCache: false,
            inputType,
            cacheKey,
            timings: overallTimings,
            usage: handlerUsage,
            fetchMethodUsed: 'N/A'
        };

    } catch (err) {
        const error = err as Error;
        overallTimings.total = Date.now() - requestStartTime;
        logger.error({ requestId, error: error.message, stack: error.stack }, `Unhandled exception in parseTextRecipe.`);
        return {
            recipe: null,
            error: {
              code: ParseErrorCode.GENERATION_FAILED,
              message: error.message || 'Unknown error in parseTextRecipe'
            },
            fromCache: false,
            inputType,
            cacheKey: generateCacheKeyHash(input),
            timings: overallTimings,
            usage: handlerUsage,
            fetchMethodUsed: 'N/A'
        };
    }
}
