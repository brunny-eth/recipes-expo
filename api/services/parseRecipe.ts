import { GeminiModel } from '../types';
import { CombinedParsedRecipe } from '../types';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';
import { isProbablyUrl } from '../utils/detectUrl';
import { generateCacheKeyHash } from '../utils/hash';
import { handleRawTextRecipe } from '../services/promptText';
import { handleRecipeUrl } from '../services/promptUrl';
import scraperapiClient from 'scraperapi-sdk';

type HandlerResponse = {
    recipe: CombinedParsedRecipe | null;
    error: string | null;
    usage: { combinedParseInputTokens: number; combinedParseOutputTokens: number; };
    timings: { geminiCombinedParse: number; total: number; } | { fetchHtml: number; extractContent: number; geminiCombinedParse: number; totalProcessingNoCache: number; };
    fetchMethodUsed?: string;
};

export async function parseAndCacheRecipe(input: string, geminiModel: GeminiModel, scraperApiKey: string, scraperClient: any): Promise<{ recipe: CombinedParsedRecipe | null, error: string | null, fromCache: boolean, inputType: string, cacheKey: string, timings: any, usage: any, fetchMethodUsed?: string }> {
    const requestId = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
    const requestStartTime = Date.now();
    let overallTimings = {
        dbCheck: -1,
        processing: -1, 
        dbInsert: -1,
        total: -1
    };
    let handlerUsage = { combinedParseInputTokens: 0, combinedParseOutputTokens: 0 };

    if (!input || typeof input !== 'string' || input.trim() === '') {
        console.warn(`[${requestId}] Invalid request: Missing or empty "input" in request body.`);
        return { recipe: null, error: 'Missing or empty "input" in request body', fromCache: false, inputType: '', cacheKey: '', timings: overallTimings, usage: handlerUsage };
    }

    const trimmedInput = input.trim();
    const isUrl = isProbablyUrl(trimmedInput);
    const cacheKey = isUrl ? trimmedInput : generateCacheKeyHash(trimmedInput);

    console.log(`[${requestId}] Received parse request. Input type: ${isUrl ? 'URL' : 'Raw Text'}. Input length: ${trimmedInput.length}. Cache key: ${cacheKey}`);

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
            return { recipe: cachedRecipe.recipe_data, error: null, fromCache: true, inputType: isUrl ? 'URL' : 'Raw Text', cacheKey, timings: overallTimings, usage: handlerUsage };
        }
        console.log(`[${requestId}] Cache miss for key: ${cacheKey}. DB Check time: ${overallTimings.dbCheck}ms. Proceeding with parsing.`);
    } catch (cacheError) {
        overallTimings.dbCheck = Date.now() - dbCheckStartTime;
        console.error(`[${requestId}] Exception during cache check for key ${cacheKey}:`, cacheError);
    }

    let handlerResponse: HandlerResponse;
    if (isUrl) {
        handlerResponse = await handleRecipeUrl(trimmedInput, requestId, geminiModel, scraperApiKey, scraperClient);
    } else {
        handlerResponse = await handleRawTextRecipe(trimmedInput, requestId, geminiModel);
    }

    if (handlerResponse.error || !handlerResponse.recipe) {
        overallTimings.total = Date.now() - requestStartTime;
        console.error(`[${requestId}] Processing failed for input. Error: ${handlerResponse.error}. Input Type: ${isUrl ? 'URL' : 'Raw Text'}. Overall timings: DB Check=${overallTimings.dbCheck}ms, Processing=${overallTimings.processing}ms, Total=${overallTimings.total}ms`);
        return { recipe: null, error: handlerResponse.error || 'Failed to process recipe input.', fromCache: false, inputType: isUrl ? 'URL' : 'Raw Text', cacheKey, timings: overallTimings, usage: handlerResponse.usage, fetchMethodUsed: handlerResponse.fetchMethodUsed };
    }

    const finalRecipeData = handlerResponse.recipe;

    if (finalRecipeData) {
        const dbInsertStartTime = Date.now();
        try {
            const { error: insertError } = await supabase
                .from('processed_recipes_cache')
                .insert({
                    url: cacheKey,
                    recipe_data: finalRecipeData,
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
    }

    if (isUrl) {
        overallTimings.processing = (handlerResponse.timings as { fetchHtml: number; extractContent: number; geminiCombinedParse: number; totalProcessingNoCache: number }).totalProcessingNoCache;
    } else {
        overallTimings.processing = (handlerResponse.timings as { geminiCombinedParse: number; total: number }).total;
    }

    overallTimings.total = Date.now() - requestStartTime;
    console.log(`[${requestId}] Request complete for input. Input Type: ${isUrl ? 'URL' : 'Raw Text'}. Overall Timings (ms): DB Check=${overallTimings.dbCheck}, Processing=${overallTimings.processing}ms, DB Insert=${overallTimings.dbInsert}ms, Total=${overallTimings.total}ms`);

    return {
        recipe: finalRecipeData,
        error: null,
        fromCache: false,
        inputType: isUrl ? 'URL' : 'Raw Text',
        cacheKey,
        timings: overallTimings,
        usage: handlerResponse.usage,
        ...(isUrl && handlerResponse.fetchMethodUsed && { fetchMethodUsed: handlerResponse.fetchMethodUsed })
    };
} 