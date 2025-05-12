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

    if (!input || typeof input !== 'string' || input.trim() === '') {
        console.warn(`[${requestId}] Invalid request: Missing or empty "input" in request body.`);
        return { recipe: null, error: 'Missing or empty "input" in request body', fromCache: false, inputType: 'raw_text', cacheKey: '', timings: overallTimings, usage: { inputTokens: 0, outputTokens: 0 }, fetchMethodUsed: 'N/A' };
    }

    const trimmedInput = input.trim();
    const inputType = detectInputType(input);
    const cacheKey = inputType === 'url' ? trimmedInput : generateCacheKeyHash(trimmedInput);

    console.log(`[${requestId}] Received parse request. Input type: ${inputType}. Input length: ${trimmedInput.length}. Cache key: ${cacheKey}`);

    const dbCheckStartTime = Date.now();
    try {
        const { data: cachedRecipe, error: dbError } = await supabase
            .from('processed_recipes_cache')
            .select('recipe_data')
            .eq('url', cacheKey)
            .maybeSingle();

        overallTimings.dbCheck = Date.now() - dbCheckStartTime;

        if (dbError) {
            console.error(`[${requestId}] Error checking cache in Supabase for key ${cacheKey}:`, dbError);
        }

        if (cachedRecipe && cachedRecipe.recipe_data) {
            console.log(`[${requestId}] Cache hit for key: ${cacheKey}. Returning cached data. DB Check time: ${overallTimings.dbCheck}ms.`);
            overallTimings.total = Date.now() - requestStartTime;
            return { recipe: cachedRecipe.recipe_data, error: null, fromCache: true, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed: 'N/A' };
        }
        console.log(`[${requestId}] Cache miss for key: ${cacheKey}. DB Check time: ${overallTimings.dbCheck}ms. Proceeding with processing.`);
    } catch (cacheError) {
        overallTimings.dbCheck = Date.now() - dbCheckStartTime;
        console.error(`[${requestId}] Exception during cache check for key ${cacheKey}:`, cacheError);
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
            console.error(`[${requestId}] URL processing failed during fetch/extract: ${processingError}`);
        } else {
            const totalLength = (extractedContent?.ingredientsText?.length ?? 0) + (extractedContent?.instructionsText?.length ?? 0);
            console.log(`[${requestId}] URL content prepared. Fetch/Extract time: ${overallTimings.fetchHtml + overallTimings.extractContent}ms. Method: ${fetchMethodUsed}. Combined text length (ingredients+instructions): ${totalLength}`);
            geminiResponse = await parseUrlContentWithGemini(extractedContent, requestId, geminiModel);
            if (geminiResponse) {
                if (geminiResponse.error) {
                    processingError = geminiResponse.error;
                    console.error(`[${requestId}] URL processing failed during Gemini parse: ${processingError}`);
                } else {
                    finalRecipeData = geminiResponse.recipe;
                }
                overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                handlerUsage = geminiResponse.usage;
                console.log(`[${requestId}] Gemini parse completed for URL. Time: ${overallTimings.geminiParse}ms. Tokens: In=${handlerUsage.inputTokens}, Out=${handlerUsage.outputTokens}.`);
            } else {
                processingError = 'Gemini response was unexpectedly null for URL.';
                console.error(`[${requestId}] ${processingError}`);
                overallTimings.geminiParse = 0;
                handlerUsage = { inputTokens: 0, outputTokens: 0 };
            }
        }
    } else {
        const { preparedText, error: prepareError, timings: prepTimings } = extractFromRawText(trimmedInput, requestId);
        overallTimings.prepareText = prepTimings.prepareText;

        if (prepareError) {
            processingError = prepareError;
            console.error(`[${requestId}] Raw text processing failed during preparation: ${processingError}`);
        } else {
            console.log(`[${requestId}] Raw text prepared. Preparation time: ${overallTimings.prepareText}ms. Prepared text length: ${preparedText?.length ?? 0}`);
            geminiResponse = await parseRawTextWithGemini(preparedText, requestId, geminiModel);
            if (geminiResponse) {
                if (geminiResponse.error) {
                    processingError = geminiResponse.error;
                    console.error(`[${requestId}] Raw text processing failed during Gemini parse: ${processingError}`);
                } else {
                    finalRecipeData = geminiResponse.recipe;
                }
                overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                handlerUsage = geminiResponse.usage;
                console.log(`[${requestId}] Gemini parse completed for Raw Text. Time: ${overallTimings.geminiParse}ms. Tokens: In=${handlerUsage.inputTokens}, Out=${handlerUsage.outputTokens}.`);
            } else {
                processingError = 'Gemini response was unexpectedly null for Raw Text.';
                console.error(`[${requestId}] ${processingError}`);
                overallTimings.geminiParse = 0;
                handlerUsage = { inputTokens: 0, outputTokens: 0 };
            }
        }
    }

    if (processingError) {
        overallTimings.total = Date.now() - requestStartTime;
        console.error(`[${requestId}] Processing ultimately failed for input. Error: ${processingError}. Input Type: ${inputType}. Final Timings: ${JSON.stringify(overallTimings)}`);
        return { recipe: null, error: processingError, fromCache: false, inputType, cacheKey, timings: overallTimings, usage: handlerUsage, fetchMethodUsed };
    }

    if (finalRecipeData) {
        const preview = finalRecipeData.title
            ? finalRecipeData.title.substring(0, MAX_PREVIEW_LENGTH) + (finalRecipeData.title.length > MAX_PREVIEW_LENGTH ? '...' : '')
            : '(No title found)';
        console.log(`[${requestId}] Successfully parsed recipe. Preview (Title): "${preview}"`);

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
                console.error(`[${requestId}] Error saving recipe to cache (key: ${cacheKey}):`, insertError);
            } else {
                console.log(`[${requestId}] Successfully cached new recipe (key: ${cacheKey}). DB Insert time: ${overallTimings.dbInsert}ms`);
            }
        } catch (cacheInsertError) {
            overallTimings.dbInsert = Date.now() - dbInsertStartTime;
            console.error(`[${requestId}] Exception during cache insertion (key: ${cacheKey}):`, cacheInsertError);
        }
    } else {
        console.warn(`[${requestId}] Processing finished without error, but no final recipe data was produced. Input Type: ${inputType}.`);
        overallTimings.dbInsert = 0;
    }

    overallTimings.total = Date.now() - requestStartTime;
    console.log(`[${requestId}] Request complete. Success: ${!!finalRecipeData}. Input Type: ${inputType}. From Cache: false. Fetch Method: ${fetchMethodUsed}. Final Timings (ms): ${JSON.stringify(overallTimings)}`);
    console.log(`[${requestId}] Final Token Usage: Input=${handlerUsage.inputTokens}, Output=${handlerUsage.outputTokens}`);

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
} 