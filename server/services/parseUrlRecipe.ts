import { GeminiModel, CombinedParsedRecipe, GeminiHandlerResponse } from '../../common/types';
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
import { ParseErrorCode, StructuredError } from '../../common/types/errors';
import { generateAndSaveEmbedding } from '../../utils/recipeEmbeddings';
import { normalizeUrl } from '../../utils/normalizeUrl';

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
    const normalizedUrl = normalizeUrl(trimmedInput);
    const cacheKey = normalizedUrl;

    try {
        logger.info({ requestId, inputType, inputLength: trimmedInput.length, cacheKey }, `Received parse request.`);

        const dbCheckStartTime = Date.now();
        try {
            const { data: cachedRecipe, error: dbError } = await supabase
                .from('processed_recipes_cache')
                .select('id, recipe_data')
                .eq('normalized_url', cacheKey)
                .maybeSingle();
            
            logger.debug({ cachedRecipe }, '[debug] Supabase returned cachedRecipe');

            overallTimings.dbCheck = Date.now() - dbCheckStartTime;

            if (dbError) {
                logger.error({ requestId, cacheKey, err: dbError }, `Error checking cache in Supabase.`);
            }

            if (cachedRecipe && cachedRecipe.recipe_data) {
                logger.info({ requestId, cacheKey, dbCheckMs: overallTimings.dbCheck }, `Cache hit. Returning cached data.`);
                overallTimings.total = Date.now() - requestStartTime;
                logger.debug({ requestId, cachedRecipe }, 'Inspecting cachedRecipe result before return');
                logger.debug({ requestId, cachedRecipe, recipeData: cachedRecipe.recipe_data }, 'Cache hit recipeData');
                logger.debug({ requestId, recipeReturn: {
                    id: cachedRecipe.id,
                    ...(cachedRecipe.recipe_data as CombinedParsedRecipe)
                  }}, 'Returning parsed recipe from cache');
                return { 
                    recipe: {
                        ...(cachedRecipe.recipe_data as CombinedParsedRecipe),
                        id: cachedRecipe.id,
                    },
                    error: null, 
                    fromCache: true, 
                    inputType, 
                    cacheKey, 
                    timings: overallTimings, 
                    usage: handlerUsage, 
                    fetchMethodUsed: 'N/A' 
                };
            }
            logger.info({ requestId, cacheKey, dbCheckMs: overallTimings.dbCheck }, `Cache miss. Proceeding with processing.`);
        } catch (cacheError) {
            overallTimings.dbCheck = Date.now() - dbCheckStartTime;
            logger.error({ requestId, cacheKey, err: cacheError }, `Exception during cache check.`);
        }

        let insertedId: number | null = null;
        let processingError: string | null = null;
        let finalRecipeData: CombinedParsedRecipe | null = null;
        let parsedRecipe: CombinedParsedRecipe | null = null;
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
              extractedContent.instructionsText || '',
              extractedContent.prepTime || null,
              extractedContent.cookTime || null,
              extractedContent.totalTime || null,
              extractedContent.recipeYieldText || null
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
                (!(finalRecipeData as any)?.ingredientGroups || (finalRecipeData as any).ingredientGroups.length === 0 || 
                 (finalRecipeData as any).ingredientGroups.every((group: any) => !group.ingredients || group.ingredients.length === 0)) &&
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

            let insertData: { id: number; created_at: string; last_processed_at: string } | null = null;
            const dbInsertStartTime = Date.now();
            try {
                console.log('[parseUrlRecipe] attempting insert with cacheKey:', cacheKey);
                
                // First, do the insert without trying to get the ID back
                const { error: insertError } = await supabase
                    .from('processed_recipes_cache')
                    .insert({
                        url: trimmedInput, // Store original URL for reference
                        normalized_url: cacheKey, // Store normalized URL for cache lookups
                        recipe_data: finalRecipeData,
                        source_type: inputType
                    });
                
                console.log('[parseUrlRecipe] insertError:', insertError);

                if (insertError) {
                    logger.error({ requestId, cacheKey, err: insertError }, `Error saving recipe to cache.`);
                } else {
                    // Now query for the inserted record to get the ID
                    const { data: queryData, error: queryError } = await supabase
                        .from('processed_recipes_cache')
                        .select('id, created_at, last_processed_at')
                        .eq('normalized_url', cacheKey)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();
                    
                    console.log('[parseUrlRecipe] queryData:', queryData);
                    console.log('[parseUrlRecipe] queryError:', queryError);
                    
                    if (queryData && queryData.id) {
                        insertData = queryData;
                        insertedId = queryData.id;
                        logger.info({ requestId, cacheKey, id: insertedId, dbInsertMs: Date.now() - dbInsertStartTime }, `Successfully cached new recipe.`);
                        console.log('[parseUrlRecipe] Found inserted recipe with ID:', insertedId);

                        if (insertedId && process.env.ENABLE_EMBEDDING === 'true') {
                            logger.info({ recipeId: insertedId }, 'Embedding queued after successful URL parse');
                            // Extract all ingredients from ingredient groups
                            const allIngredients = (finalRecipeData as any).ingredientGroups?.flatMap((group: any) => 
                                group.ingredients?.map((ingredient: any) => ingredient.name) || []
                            ) || [];
                            
                            await generateAndSaveEmbedding(insertedId, {
                                title: finalRecipeData.title,
                                ingredientsText: allIngredients.join('\n'),
                                instructionsText: finalRecipeData.instructions?.join('\n'),
                            });
                        }
                    } else {
                        logger.warn({ requestId, cacheKey, queryError }, `Could not retrieve inserted recipe ID.`);
                    }
                }
                
                overallTimings.dbInsert = Date.now() - dbInsertStartTime;
            } catch (cacheInsertError) {
                overallTimings.dbInsert = Date.now() - dbInsertStartTime;
                logger.error({ requestId, cacheKey, err: cacheInsertError }, `Exception during cache insertion.`);
            }

            console.log('[parseUrlRecipe] insertData:', insertData);
            console.log('[parseUrlRecipe] insertedId after insert:', insertedId);

            const finalSizeKb = Buffer.byteLength(JSON.stringify(finalRecipeData), 'utf8') / 1024;
            logger.info({ requestId, sizeKb: finalSizeKb.toFixed(2), event: 'final_recipe_size' }, 'Size of final structured recipe JSON');
            
            parsedRecipe = {
                ...finalRecipeData,
                id: insertedId ?? undefined,
                created_at: insertData?.created_at ?? undefined,
                last_processed_at: insertData?.last_processed_at ?? undefined,
            };
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
          ingredientGroups: (finalRecipeData as any)?.ingredientGroups,
          instructions: finalRecipeData?.instructions,
          servings: finalRecipeData?.recipeYield
        }, "Final structured recipe returned to client");

        console.log('[parseUrlRecipe] Returning parsedRecipe with ID:', parsedRecipe?.id);

        return {
            recipe: parsedRecipe,
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
