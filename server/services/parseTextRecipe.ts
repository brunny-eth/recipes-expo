import { GeminiModel, GeminiHandlerResponse } from '../../common/types';
import { CombinedParsedRecipe } from '../../common/types/dbOverrides';
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
import { ParseErrorCode, StructuredError } from '../../common/types/errors';
import { embedText } from '../../utils/embedText';
import { findSimilarRecipe } from '../../utils/findSimilarRecipe';
import { generateAndSaveEmbedding } from '../../utils/recipeEmbeddings';

const MAX_PREVIEW_LENGTH = 100;
const SIMILARITY_THRESHOLD = 0.5;

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
    requestId: string,
    forceNewParse?: boolean | string,
    options?: {
        fromImageExtraction?: boolean; // Indicates text was extracted from image/PDF
        isDishNameSearch?: boolean; // Indicates if this is a dish name search
    }
): Promise<ParseResult> {
    // Coerce forceNewParse to boolean
    const forceNewParseBool = forceNewParse === true || forceNewParse === 'true';
    const isFromImageExtraction = options?.fromImageExtraction === true;
    const isDishNameSearch = options?.isDishNameSearch === true;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[parseTextRecipe] forceNewParse received as:`, forceNewParse, `| typeof:`, typeof forceNewParse, `| coerced:`, forceNewParseBool);
      console.log(`[parseTextRecipe] fromImageExtraction:`, isFromImageExtraction);
    }
    
    logger.info({ requestId, fromImageExtraction: isFromImageExtraction }, "🚨🚨🚨 parseTextRecipe was called! 🚨🚨🚨");
    logger.info({ env: process.env.ENABLE_FUZZY_MATCH }, "Env variable ENABLE_FUZZY_MATCH value");
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
    logger.info({ 
        requestId, 
        enableFuzzyMatch: process.env.ENABLE_FUZZY_MATCH, 
        forceNewParse: forceNewParseBool,
        fromImageExtraction: isFromImageExtraction 
    }, "Checking fuzzy match environment variable, forceNewParse, and fromImageExtraction");
    
    // Skip fuzzy matching for raw text inputs (only do it for dish name searches)
    if (!forceNewParseBool && !isFromImageExtraction && process.env.ENABLE_FUZZY_MATCH === 'true' && isDishNameSearch) {
        logger.info({ requestId }, "Fuzzy match enabled, attempting to find similar recipes.");
        const fuzzyMatchStartTime = Date.now();
        try {
            // Step 1: Create an embedding for the input text
            const embeddingStartTime = Date.now();
            logger.info({ requestId, input: trimmedInput.substring(0, 50) + '...' }, "[FuzzyMatch] Generating embedding...");
            const embedding = await embedText(trimmedInput);
            const embeddingTime = Date.now() - embeddingStartTime;
            logger.info({ requestId, timeMs: embeddingTime }, "[FuzzyMatch] Embedding generated successfully.");

            // Step 2: Use the embedding to find similar recipes in the database
            const searchStartTime = Date.now();
            logger.info({ requestId }, "[FuzzyMatch] Searching for similar recipes...");
            
            // First try with the standard threshold
            let matches = await findSimilarRecipe(embedding, SIMILARITY_THRESHOLD);
            
            // If no matches found with standard threshold, try with a lower threshold
            if (!matches || matches.length === 0) {
                logger.info({ requestId, originalThreshold: SIMILARITY_THRESHOLD, newThreshold: 0.35 }, "[FuzzyMatch] No matches with standard threshold, trying lower threshold.");
                matches = await findSimilarRecipe(embedding, 0.35);
            }
            
            logger.info({ requestId, event: 'findSimilarRecipe_result', matchesIsNull: matches === null, matchesLength: matches?.length || 0 }, "[FuzzyMatch] Raw matches result");
            const searchTime = Date.now() - searchStartTime;
            logger.info({ requestId, timeMs: searchTime, matchesFound: matches?.length || 0 }, "[FuzzyMatch] Search complete.");

            if (matches && matches.length > 0) {
                logger.info({
                    requestId,
                    matchesCount: matches.length,
                    topSimilarity: matches[0].similarity,
                    threshold: SIMILARITY_THRESHOLD,
                    totalFuzzyMatchTime: Date.now() - fuzzyMatchStartTime,
                    timings: { embeddingTime, searchTime }
                }, "Fuzzy matches found.");

                // If exactly one match, return it directly (existing behavior)
                if (matches.length === 1) {
                    logger.info({ requestId, matchedRecipeId: matches[0].recipe.id, similarity: matches[0].similarity, event: 'single_match_return' }, "Single match found, returning directly.");
                    return {
                        recipe: matches[0].recipe,
                        error: null,
                        fromCache: true,
                        inputType,
                        cacheKey: matches[0].recipe.sourceUrl || cacheKey,
                        timings: { ...overallTimings, total: Date.now() - requestStartTime, dbCheck: searchTime },
                        usage: { inputTokens: 0, outputTokens: 0 },
                        fetchMethodUsed: 'fuzzy_match'
                    };
                } else {
                    // Multiple matches - pass them to frontend for user selection
                    logger.info({ requestId, matchesCount: matches.length, topSimilarity: matches[0].similarity, event: 'multiple_matches_return' }, "Multiple matches found, passing to frontend for selection.");
                    return {
                        recipe: null, // No single recipe
                        error: null,
                        fromCache: false,
                        inputType,
                        cacheKey,
                        timings: { ...overallTimings, total: Date.now() - requestStartTime, dbCheck: searchTime },
                        usage: { inputTokens: 0, outputTokens: 0 },
                        fetchMethodUsed: 'fuzzy_match',
                        cachedMatches: matches // NEW: Pass multiple matches to frontend
                    };
                }
            } else {
                 logger.info(
                    {
                        requestId,
                        threshold: SIMILARITY_THRESHOLD,
                        llm_skipped: false,
                        totalFuzzyMatchTime: Date.now() - fuzzyMatchStartTime,
                        event: 'no_matches_found'
                    }, 
                    "No fuzzy matches found even with lower threshold. Proceeding with LLM."
                );
            }

        } catch (fuzzyError: any) {
            logger.error({ 
                requestId, 
                error: fuzzyError.message, 
                stack: fuzzyError.stack,
                totalFuzzyMatchTime: Date.now() - fuzzyMatchStartTime
            }, "An unexpected error occurred during the fuzzy match process. Falling back to LLM.");
        }
    }
    // --- End Fuzzy Match Logic ---

    try {
        // Relax validation: allow concise single-word dish names like "chicken".
        // Only reject truly trivial inputs (e.g., too short or lacking letters),
        // and skip this guard entirely if forceNewParse was requested or text came from image extraction.
        if (!forceNewParseBool && !isFromImageExtraction) {
            const letterCount = (trimmedInput.match(/[a-zA-Z]/g) || []).length;
            if (letterCount < 3) {
                const errorPayload: StructuredError = {
                    code: ParseErrorCode.INVALID_INPUT,
                    message: "Please include at least a few letters of a dish or recipe."
                };
                logger.warn({ requestId, input: trimmedInput, letterCount }, "Rejected input as invalid (insufficient letters).");
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
        }

        logger.info({ requestId, inputType, inputLength: trimmedInput.length, cacheKey }, `Received parse request.`);

        const dbCheckStartTime = Date.now();
        try {
            const { data: cachedRecipe, error: dbError } = await supabase
                .from('processed_recipes_cache')
                .select('id, recipe_data')
                .eq('url', cacheKey)
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

        const { preparedText, error: prepareError, timings: prepTimings } = extractFromRawText(trimmedInput, requestId);
        overallTimings.prepareText = prepTimings.prepareText;

        if (prepareError) {
            processingError = prepareError;
            logger.error({ requestId, error: processingError }, `Raw text processing failed during preparation`);
        } else {
            logger.info({ requestId, prepareMs: overallTimings.prepareText, textLength: preparedText?.length ?? 0 }, `Raw text prepared.`);
            
            const prompt = buildTextParsePrompt(preparedText!, isFromImageExtraction);
            prompt.metadata = { requestId };

            if (isFromImageExtraction) {
                logger.info({ requestId }, 'Using enhanced prompt for image-extracted JSON input');
            }

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
                    
                    // Debug logging for PDF/image parsing issues
                    logger.info({ 
                        requestId, 
                        finalRecipeDataType: Array.isArray(finalRecipeData) ? 'array' : typeof finalRecipeData,
                        hasTitle: !!finalRecipeData?.title,
                        isArray: Array.isArray(finalRecipeData),
                        arrayLength: Array.isArray(finalRecipeData) ? finalRecipeData.length : 'N/A',
                        firstItemTitle: Array.isArray(finalRecipeData) && finalRecipeData[0] ? finalRecipeData[0].title : 'N/A'
                    }, 'Debug: LLM response structure');
                    
                    // Handle case where LLM returns an array of recipes (common with PDF extraction)
                    if (Array.isArray(finalRecipeData) && finalRecipeData.length > 0 && finalRecipeData[0]) {
                        logger.info({ requestId }, 'LLM returned array of recipes, extracting first recipe');
                        finalRecipeData = finalRecipeData[0];
                    }
                    
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
            return { recipe: null, error: { code: ParseErrorCode.GENERATION_FAILED, message: "We couldn't find any similar recipes. Try pasting a recipe link instead." }, fromCache: false, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed: 'N/A' };
        }

        const isEmptyRecipe = (
            !finalRecipeData?.title &&
            (!finalRecipeData?.ingredientGroups || finalRecipeData.ingredientGroups.length === 0 || 
             finalRecipeData.ingredientGroups.every(group => !group.ingredients || group.ingredients.length === 0)) &&
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

            finalRecipeData.sourceUrl = cacheKey;

            const preview = finalRecipeData.title
                ? finalRecipeData.title.substring(0, MAX_PREVIEW_LENGTH) + (finalRecipeData.title.length > MAX_PREVIEW_LENGTH ? '...' : '')
                : '(No title found)';
            logger.info({ requestId, preview }, `Successfully parsed recipe.`);

            let insertData: { id: number; created_at: string; last_processed_at: string } | null = null;
            const dbInsertStartTime = Date.now();
            try {
                // A) Strip any incoming id field to prevent ID pollution from LLM outputs
                const { id: _jsonIdDrop, ...cleanFinalRecipeData } = (finalRecipeData as Record<string, any>) ?? {};
                
                // B) Insert without ID field to ensure clean data
                const { error: insertError } = await supabase
                    .from('processed_recipes_cache')
                    .insert({
                        url: cacheKey,
                        recipe_data: cleanFinalRecipeData, // Store WITHOUT any ID field
                        source_type: inputType
                    });

                if (insertError) {
                    logger.error({ requestId, cacheKey, err: insertError }, `Error saving recipe to cache.`);
                } else {
                    const { data: queryData, error: queryError } = await supabase
                        .from('processed_recipes_cache')
                        .select('id, created_at, last_processed_at')
                        .eq('url', cacheKey)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();
                    
                    if (queryData && queryData.id) {
                        insertedId = queryData.id;
                        logger.info({ requestId, cacheKey, id: insertedId, dbInsertMs: Date.now() - dbInsertStartTime }, `Successfully cached new recipe from raw text.`);
                        
                        // C) Force JSON id to equal the row id (belt-and-suspenders)
                        const { error: updateError } = await supabase
                            .from('processed_recipes_cache')
                            .update({
                                recipe_data: { ...(cleanFinalRecipeData as Record<string, any>), id: insertedId },
                            })
                            .eq('id', insertedId);

                        if (updateError) {
                            logger.warn({ requestId, insertedId, err: updateError }, 'Failed to update recipe_data.id with row ID, but insert succeeded');
                        } else {
                            logger.info({ requestId, insertedId }, 'Successfully updated recipe_data.id to match row ID');
                        }
                    } else {
                        logger.warn({ requestId, cacheKey, queryError }, `Could not retrieve inserted recipe ID from text parse.`);
                    }
                }
                
                overallTimings.dbInsert = Date.now() - dbInsertStartTime;
            } catch (cacheInsertError) {
                overallTimings.dbInsert = Date.now() - dbInsertStartTime;
                logger.error({ requestId, cacheKey, err: cacheInsertError }, `Exception during cache insertion.`);
            }

            const finalSizeKb = Buffer.byteLength(JSON.stringify(finalRecipeData), 'utf8') / 1024;
            logger.info({ requestId, sizeKb: finalSizeKb.toFixed(2), event: 'final_recipe_size' }, 'Size of final structured recipe JSON');
            
            parsedRecipe = {
                ...finalRecipeData,
                id: insertedId || undefined // Add the database ID to the recipe object, convert null to undefined
            };
            
            logger.info({ 
                requestId, 
                insertedId, 
                recipeId: parsedRecipe.id,
                hasId: !!parsedRecipe.id 
            }, 'Recipe object created with database ID');

        } else {
            logger.warn({ requestId, inputType }, `Processing finished without error, but no final recipe data was produced.`);
            overallTimings.dbInsert = 0;
        }

        overallTimings.total = Date.now() - requestStartTime;
        logger.info({ 
            requestId, 
            success: !!parsedRecipe, 
            inputType, 
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
          finalRecipeTitle: parsedRecipe?.title,
          ingredientGroups: parsedRecipe?.ingredientGroups,
          instructions: parsedRecipe?.instructions,
          servings: parsedRecipe?.recipeYield
        }, "Final structured recipe returned to client");

        if (process.env.NODE_ENV === 'development') {
          console.log('[parseTextRecipe] Returning parsedRecipe with ID:', parsedRecipe?.id);
        }

        const finalResult: ParseResult = {
            recipe: parsedRecipe,
            error: null,
            fromCache: false,
            inputType,
            cacheKey,
            timings: overallTimings,
            usage: handlerUsage,
            fetchMethodUsed: 'N/A'
        };

        logger.info({ requestId, event: 'final_return', hasCachedMatches: !!(finalResult as any).cachedMatches, hasRecipe: !!finalResult.recipe }, "Final result being returned from parseTextRecipe");

        return finalResult;

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