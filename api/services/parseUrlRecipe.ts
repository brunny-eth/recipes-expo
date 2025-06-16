import { GeminiModel, CombinedParsedRecipe, GeminiHandlerResponse } from '../types';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';
import { detectInputType } from '../utils/detectInputType';
import { generateCacheKeyHash } from '../utils/hash';
import { fetchAndExtractFromUrl } from './urlProcessor';
import { scraperClient, scraperApiKey } from '../lib/scraper';
import { StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';
import { normalizeUsageMetadata } from '../utils/usageUtils';
import { finalValidateRecipe } from './finalValidateRecipe';
import { ParseResult } from './parseRecipe';
import { geminiAdapter, openaiAdapter, PromptPayload, runDefaultLLM } from '../llm/adapters';
import { buildUrlParsePrompt } from '../llm/parsingPrompts';
import { ParseErrorCode, StructuredError } from '../types/errors';

const MAX_PREVIEW_LENGTH = 100;

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

export async function parseUrlRecipe(
    input: string,
): Promise<ParseResult> {
    const requestId = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
    const requestStartTime = Date.now();
    let overallTimings: ParseResult['timings'] = {
        dbCheck: -1,
        geminiParse: -1,
        dbInsert: -1,
        total: -1
    };
    let handlerUsage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
    let fetchMethodUsed: string | undefined = 'N/A';
    let isFallback = false;
    let fallbackType: string | null = null;
    const inputType = 'url';
    const trimmedInput = input.trim();
    const cacheKey = trimmedInput;

    try {
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

        const { extractedContent, error: fetchExtractError, fetchMethodUsed: fmUsed, timings: feTimings } = await fetchAndExtractFromUrl(trimmedInput, requestId, scraperApiKey, scraperClient);
        fetchMethodUsed = fmUsed;
        overallTimings.fetchHtml = feTimings.fetchHtml;
        overallTimings.extractContent = feTimings.extractContent;

        if (fetchExtractError || !extractedContent) {
            processingError = fetchExtractError || 'Failed to fetch or extract content from URL.';
            logger.error({ requestId, error: processingError }, `URL processing failed during fetch/extract`);
        } else {
            isFallback = !!extractedContent.isFallback;
            fallbackType = extractedContent.fallbackType || null;
            const totalLength = (extractedContent?.ingredientsText?.length ?? 0) + (extractedContent?.instructionsText?.length ?? 0);
            logger.info({ requestId, fetchExtractMs: (overallTimings.fetchHtml ?? 0) + (overallTimings.extractContent ?? 0), method: fetchMethodUsed, combinedTextLength: totalLength }, `URL content prepared.`);
            
            const prompt = buildUrlParsePrompt(
              extractedContent.title || '',
              extractedContent.ingredientsText || '',
              extractedContent.instructionsText || ''
            );
            prompt.metadata = { requestId };

            const geminiStartTime = Date.now();
            const modelResponse = await runDefaultLLM(prompt);
            
            overallTimings.geminiParse = Date.now() - geminiStartTime;
            handlerUsage = modelResponse.usage;

            if (modelResponse.error || !modelResponse.output) {
                processingError = modelResponse.error || "Model returned no output.";
                logger.error({ requestId, error: processingError }, `URL processing failed during model parse`);
            } else {
                try {
                    finalRecipeData = JSON.parse(modelResponse.output);
                    if (finalRecipeData && extractedContent) {
                        finalRecipeData.description = extractedContent.description ?? null;
                        finalRecipeData.image = extractedContent.image ?? null;
                        finalRecipeData.thumbnailUrl = extractedContent.thumbnailUrl ?? null;
                        finalRecipeData.sourceUrl = extractedContent.sourceUrl ?? null;
                    }
                    logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: `llm_parse_url` }, `LLM parse completed for URL.`);
                } catch (parseErr: any) {
                    processingError = `Failed to parse model response: ${parseErr.message}`;
                    logger.error({ requestId, error: processingError, responseText: modelResponse.output }, 'JSON parse failed for model response');
                }
            }
        }

        if (processingError) {
            overallTimings.total = Date.now() - requestStartTime;
            logger.error({ requestId, error: processingError, inputType, timings: overallTimings }, `Processing ultimately failed for input.`);
            return { recipe: null, error: { code: ParseErrorCode.GENERATION_FAILED, message: processingError }, fromCache: false, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed };
        }

        const validationResult = finalValidateRecipe(finalRecipeData, requestId);
        if (!validationResult.ok) {
            logger.warn({ requestId, reasons: validationResult.reasons }, "Final validation failed for URL recipe, rejecting.");
            const isThinRecipe = (
                !finalRecipeData?.title &&
                (!finalRecipeData?.ingredients || finalRecipeData.ingredients.length === 0) &&
                (!finalRecipeData?.instructions || finalRecipeData.instructions.length === 0)
            );
            if (isFallback && isThinRecipe) {
                return {
                    recipe: null,
                    error: {
                        code: ParseErrorCode.GENERATION_EMPTY,
                        message: "This page doesn't appear to contain a recipe."
                    },
                    fromCache: false,
                    inputType,
                    cacheKey,
                    timings: { ...overallTimings, total: Date.now() - requestStartTime },
                    usage: handlerUsage,
                    fetchMethodUsed
                };
            }
             return {
                recipe: null,
                error: {
                    code: ParseErrorCode.FINAL_VALIDATION_FAILED,
                    message: "The recipe generated from the URL was incomplete."
                },
                fromCache: false,
                inputType,
                cacheKey,
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed
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
            fromCache: false, 
            fetchMethod: fetchMethodUsed, 
            usedFallback: isFallback,
            fallbackType: fallbackType,
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
            fetchMethodUsed
        };

    } catch (err) {
        const error = err as Error;
        overallTimings.total = Date.now() - requestStartTime;
        logger.error({ requestId, error: error.message, stack: error.stack }, `Unhandled exception in parseUrlRecipe.`);
        return {
            recipe: null,
            error: {
              code: ParseErrorCode.GENERATION_FAILED,
              message: error.message || 'Unknown error in parseUrlRecipe'
            },
            fromCache: false,
            inputType,
            cacheKey,
            timings: overallTimings,
            usage: handlerUsage,
            fetchMethodUsed
        };
    }
}
