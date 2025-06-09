import { GeminiModel, CombinedParsedRecipe, GeminiHandlerResponse } from '../types';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';
import { detectInputType, InputType } from '../utils/detectInputType';
import { generateCacheKeyHash } from '../utils/hash';
import { fetchAndExtractFromUrl } from './urlProcessor';
import { extractFromRawText } from './textProcessor';
import { parseUrlContentWithGemini } from './promptUrl';
import { parseRawTextWithGemini } from './promptText';
import scraperapiClient from 'scraperapi-sdk';
import { StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';

// Define a maximum length for output previews
const MAX_PREVIEW_LENGTH = 100;

export type ParseResult = {
    recipe: CombinedParsedRecipe | null;
    error: string | null;
    fromCache: boolean;
    inputType: InputType;
    cacheKey: string;
    timings: {
        dbCheck: number;
        fetchHtml?: number;
        extractContent?: number;
        prepareText?: number;
        geminiParse: number;
        dbInsert: number;
        total: number;
    };
    usage: StandardizedUsage;
    fetchMethodUsed?: string;
};

export async function parseAndCacheRecipe(
    input: string,
    geminiModel: GeminiModel,
    scraperApiKey: string,
    scraperClient: any
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
    let isFallback = false; // Ensure isFallback is always a boolean

    // Wrap the core logic in a try/catch block
    try {
        if (!input || typeof input !== 'string' || input.trim() === '') {
            logger.warn({ requestId }, 'Invalid request: Missing or empty "input" in request body.');
            // Ensure a consistent return structure even for early exits
            overallTimings.total = Date.now() - requestStartTime;
            return { 
                recipe: null, 
                error: 'Missing or empty "input" in request body', 
                fromCache: false, 
                inputType: 'raw_text', // Default or detect if possible
                cacheKey: '', 
                timings: overallTimings, 
                usage: { inputTokens: 0, outputTokens: 0 }, 
                fetchMethodUsed: 'N/A' 
            };
        }

        const trimmedInput = input.trim();
        const inputType = detectInputType(input);

        // --- BEGIN EARLY INPUT TYPE VALIDATION ---
        const SUPPORTED_INPUT_TYPES: ReadonlyArray<InputType> = ['url', 'raw_text'];
        if (!SUPPORTED_INPUT_TYPES.includes(inputType)) {
            const errorMsg = `Unsupported input type detected: ${inputType}`;
            logger.error({ requestId, inputTypeRec: inputType }, errorMsg);
            overallTimings.total = Date.now() - requestStartTime;
            return {
                recipe: null,
                error: errorMsg,
                fromCache: false,
                inputType: inputType,
                cacheKey: generateCacheKeyHash(trimmedInput), 
                timings: overallTimings,
                usage: { inputTokens: 0, outputTokens: 0 },
                fetchMethodUsed: 'N/A'
            };
        }
        // --- END EARLY INPUT TYPE VALIDATION ---

        const cacheKey = inputType === 'url' ? trimmedInput : generateCacheKeyHash(trimmedInput);
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
        let geminiResponse: GeminiHandlerResponse | null = null;

        if (inputType === 'url') {
            const { extractedContent, error: fetchExtractError, fetchMethodUsed: fmUsed, timings: feTimings } = await fetchAndExtractFromUrl(trimmedInput, requestId, scraperApiKey, scraperClient);
            fetchMethodUsed = fmUsed;
            overallTimings.fetchHtml = feTimings.fetchHtml;
            overallTimings.extractContent = feTimings.extractContent;

            if (fetchExtractError || !extractedContent) {
                processingError = fetchExtractError || 'Failed to fetch or extract content from URL.';
                logger.error({ requestId, error: processingError }, `URL processing failed during fetch/extract`);
            } else {
                isFallback = !!extractedContent.isFallback; // Ensure isFallback is a boolean
                const totalLength = (extractedContent?.ingredientsText?.length ?? 0) + (extractedContent?.instructionsText?.length ?? 0);
                logger.info({ requestId, fetchExtractMs: (overallTimings.fetchHtml ?? 0) + (overallTimings.extractContent ?? 0), method: fetchMethodUsed, combinedTextLength: totalLength }, `URL content prepared.`);
                geminiResponse = await parseUrlContentWithGemini(extractedContent, requestId, geminiModel);
                if (geminiResponse) {
                    if (geminiResponse.error) {
                        processingError = geminiResponse.error;
                        logger.error({ requestId, error: processingError }, `URL processing failed during Gemini parse`);
                    } else {
                        finalRecipeData = geminiResponse.recipe;
                    }
                    overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                    handlerUsage = geminiResponse.usage;
                    logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: 'gemini_parse_url' }, `Gemini parse completed for URL.`);
                } else {
                    processingError = 'Gemini response was unexpectedly null for URL.';
                    logger.error({ requestId }, processingError);
                    overallTimings.geminiParse = 0;
                    handlerUsage = { inputTokens: 0, outputTokens: 0 };
                }
            }
        } else if (inputType === 'raw_text') {
            const { preparedText, error: prepareError, timings: prepTimings } = extractFromRawText(trimmedInput, requestId);
            overallTimings.prepareText = prepTimings.prepareText;

            if (prepareError) {
                processingError = prepareError;
                logger.error({ requestId, error: processingError }, `Raw text processing failed during preparation`);
            } else {
                logger.info({ requestId, prepareMs: overallTimings.prepareText, textLength: preparedText?.length ?? 0 }, `Raw text prepared.`);
                geminiResponse = await parseRawTextWithGemini(preparedText, requestId, geminiModel);
                if (geminiResponse) {
                    if (geminiResponse.error) {
                        processingError = geminiResponse.error;
                        logger.error({ requestId, error: processingError }, `Raw text processing failed during Gemini parse`);
                    } else {
                        finalRecipeData = geminiResponse.recipe;
                    }
                    overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                    handlerUsage = geminiResponse.usage;
                    logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: 'gemini_parse_raw_text' }, `Gemini parse completed for Raw Text.`);
                } else {
                    processingError = 'Gemini response was unexpectedly null for Raw Text.';
                    logger.error({ requestId }, processingError);
                    overallTimings.geminiParse = 0;
                    handlerUsage = { inputTokens: 0, outputTokens: 0 };
                }
            }
        }

        if (processingError) {
            overallTimings.total = Date.now() - requestStartTime;
            logger.error({ requestId, error: processingError, inputType, timings: overallTimings }, `Processing ultimately failed for input.`);
            return { recipe: null, error: processingError, fromCache: false, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed };
        }

        // Add a final guard post-Gemini
        const isEmptyRecipe = (
            !finalRecipeData?.title &&
            (!finalRecipeData?.ingredients || finalRecipeData.ingredients.length === 0) &&
            (!finalRecipeData?.instructions || finalRecipeData.instructions.length === 0)
        );

        if (isEmptyRecipe) {
            logger.warn({ requestId }, "[parse] Gemini returned empty recipe — likely a non-recipe page. Rejecting.");
            throw new Error("No recipe found on that page.");
        }

        if (isFallback && isEmptyRecipe) {
            // fallback mode, and Gemini found nothing — hard fail
            throw new Error("This page doesn't appear to contain a recipe.");
        }

        if (finalRecipeData) {
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
        } else {
            logger.warn({ requestId, inputType }, `Processing finished without error, but no final recipe data was produced.`);
            overallTimings.dbInsert = 0;
        }

        overallTimings.total = Date.now() - requestStartTime;
        logger.info({ requestId, success: !!finalRecipeData, inputType, fromCache: false, fetchMethod: fetchMethodUsed, timings: overallTimings, action: 'parse_request_complete' }, `Request complete.`);
        logger.info({ requestId, usage: handlerUsage, action: 'final_token_usage' }, `Final Token Usage.`);

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

    } catch (err: any) {
        // Catch unexpected errors within the main logic block
        const errorMessage = err.message || 'An unknown error occurred within parseAndCacheRecipe';
        logger.error(
            { 
                requestId,
                message: '💥 Critical error in parseAndCacheRecipe core logic:', 
                errorObject: err, 
                errorMessage: errorMessage,
                stack: err.stack,
                inputType: detectInputType(input), // Re-detect or pass inputType if available earlier
                inputReceived: input
            }, 
            `Unhandled exception in parseAndCacheRecipe: ${errorMessage}`
        );
        overallTimings.total = Date.now() - requestStartTime;
        return {
            recipe: null,
            error: `Unhandled exception: ${errorMessage}`,
            fromCache: false,
            inputType: detectInputType(input), // Re-detect
            cacheKey: generateCacheKeyHash(input.trim()), // Attempt to generate cacheKey
            timings: overallTimings,
            usage: handlerUsage, // Might be 0 if error was very early
            fetchMethodUsed
        };
    }
} 