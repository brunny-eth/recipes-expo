import { GeminiModel, CombinedParsedRecipe, GeminiHandlerResponse } from '../types';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';
import { detectInputType, InputType } from '../utils/detectInputType';
import { generateCacheKeyHash } from '../utils/hash';
import { fetchAndExtractFromUrl } from './urlProcessor';
import { extractFromRawText } from './textProcessor';
import { parseUrlContentWithGemini } from './promptUrl';
import { parseRawTextWithGemini } from './promptText';
import { scraperClient, scraperApiKey } from '../lib/scraper';
import { StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';
import openai from '../lib/openai';
import { normalizeUsageMetadata } from '../utils/usageUtils';

function normalizeServings(servingRaw: string | null): string | null {
    if (!servingRaw) return null;
  
    const parts = servingRaw.split(',').map(s => s.trim());
    const unique = [...new Set(parts)];

    // 1. Try to find a clean numeric part
    const numericPart = unique.find(s => /^\d+(\.\d+)?$/.test(s));
    if (numericPart) return numericPart;

    // 2. Try to extract lower bound from range like "4-6" or "4 – 6"
    for (const part of unique) {
        const rangeMatch = part.match(/(\d+(\.\d+)?)[\s–-]+(\d+(\.\d+)?)/); // handles "4-6", "4 – 6"
        if (rangeMatch) return rangeMatch[1]; // return the first (lower) number
    }

    // 3. Fallback to first part
    return unique[0];
}

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
    geminiModel: GeminiModel
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
        let usedFallback = false;

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
                
                try {
                    geminiResponse = await parseUrlContentWithGemini(extractedContent, requestId, geminiModel);
                    if (geminiResponse) {
                        if (geminiResponse.error) {
                            // Gemini failed, try OpenAI fallback
                            logger.warn({ requestId, error: geminiResponse.error }, `Gemini parsing failed for URL. Falling back to OpenAI.`);
                            geminiResponse = await parseWithOpenAI(trimmedInput, requestId);
                            usedFallback = true;
                        }
                        
                        if (geminiResponse.error) {
                            processingError = geminiResponse.error;
                            logger.error({ requestId, error: processingError }, `URL processing failed during ${usedFallback ? 'OpenAI' : 'Gemini'} parse`);
                        } else {
                            finalRecipeData = geminiResponse.recipe;
                            if (finalRecipeData && extractedContent) {
                                finalRecipeData.description = extractedContent.description ?? null;
                                finalRecipeData.image = extractedContent.image ?? null;
                                finalRecipeData.thumbnailUrl = extractedContent.thumbnailUrl ?? null;
                                finalRecipeData.sourceUrl = extractedContent.sourceUrl ?? null;
                            }
                        }
                        overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                        handlerUsage = geminiResponse.usage;
                        logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: `${usedFallback ? 'openai' : 'gemini'}_parse_url` }, `${usedFallback ? 'OpenAI' : 'Gemini'} parse completed for URL.`);
                    } else {
                        processingError = `${usedFallback ? 'OpenAI' : 'Gemini'} response was unexpectedly null for URL.`;
                        logger.error({ requestId }, processingError);
                        overallTimings.geminiParse = 0;
                        handlerUsage = { inputTokens: 0, outputTokens: 0 };
                    }
                } catch (err: any) {
                    // Handle specific Gemini errors that should trigger fallback
                    if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('unavailable')) {
                        logger.warn({ requestId, error: err }, `Gemini service unavailable for URL. Falling back to OpenAI.`);
                        try {
                            geminiResponse = await parseWithOpenAI(trimmedInput, requestId);
                            usedFallback = true;
                            
                            if (geminiResponse.error) {
                                processingError = geminiResponse.error;
                                logger.error({ requestId, error: processingError }, `URL processing failed during OpenAI fallback parse`);
                            } else {
                                finalRecipeData = geminiResponse.recipe;
                                if (finalRecipeData && extractedContent) {
                                    finalRecipeData.description = extractedContent.description ?? null;
                                    finalRecipeData.image = extractedContent.image ?? null;
                                    finalRecipeData.thumbnailUrl = extractedContent.thumbnailUrl ?? null;
                                    finalRecipeData.sourceUrl = extractedContent.sourceUrl ?? null;
                                }
                            }
                            overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                            handlerUsage = geminiResponse.usage;
                            logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: 'openai_parse_url' }, `OpenAI fallback parse completed for URL.`);
                        } catch (fallbackErr: any) {
                            processingError = `Both Gemini and OpenAI fallback failed: ${fallbackErr.message || 'Unknown error'}`;
                            logger.error({ requestId, error: fallbackErr }, `OpenAI fallback also failed for URL`);
                            overallTimings.geminiParse = 0;
                            handlerUsage = { inputTokens: 0, outputTokens: 0 };
                        }
                    } else {
                        // Other unexpected errors
                        processingError = `Unexpected error during URL parsing: ${err.message || 'Unknown error'}`;
                        logger.error({ requestId, error: err }, `Unexpected error during URL parsing`);
                        overallTimings.geminiParse = 0;
                        handlerUsage = { inputTokens: 0, outputTokens: 0 };
                    }
                }
            }
        } else {
            const { preparedText, error: prepareError, timings: prepTimings } = extractFromRawText(trimmedInput, requestId);
            overallTimings.prepareText = prepTimings.prepareText;

            if (prepareError) {
                processingError = prepareError;
                logger.error({ requestId, error: processingError }, `Raw text processing failed during preparation`);
            } else {
                logger.info({ requestId, prepareMs: overallTimings.prepareText, textLength: preparedText?.length ?? 0 }, `Raw text prepared.`);
                
                try {
                    geminiResponse = await parseRawTextWithGemini(preparedText, requestId, geminiModel);
                    if (geminiResponse) {
                        if (geminiResponse.error) {
                            // Gemini failed, try OpenAI fallback
                            logger.warn({ requestId, error: geminiResponse.error }, `Gemini parsing failed for raw text. Falling back to OpenAI.`);
                            geminiResponse = await parseWithOpenAI(trimmedInput, requestId);
                            usedFallback = true;
                        }
                        
                        if (geminiResponse.error) {
                            processingError = geminiResponse.error;
                            logger.error({ requestId, error: processingError }, `Raw text processing failed during ${usedFallback ? 'OpenAI' : 'Gemini'} parse`);
                        } else {
                            finalRecipeData = geminiResponse.recipe;
                        }
                        overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                        handlerUsage = geminiResponse.usage;
                        logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: `${usedFallback ? 'openai' : 'gemini'}_parse_raw_text` }, `${usedFallback ? 'OpenAI' : 'Gemini'} parse completed for Raw Text.`);
                    } else {
                        processingError = `${usedFallback ? 'OpenAI' : 'Gemini'} response was unexpectedly null for Raw Text.`;
                        logger.error({ requestId }, processingError);
                        overallTimings.geminiParse = 0;
                        handlerUsage = { inputTokens: 0, outputTokens: 0 };
                    }
                } catch (err: any) {
                    // Handle specific Gemini errors that should trigger fallback
                    if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('unavailable')) {
                        logger.warn({ requestId, error: err }, `Gemini service unavailable for raw text. Falling back to OpenAI.`);
                        try {
                            geminiResponse = await parseWithOpenAI(trimmedInput, requestId);
                            usedFallback = true;
                            
                            if (geminiResponse.error) {
                                processingError = geminiResponse.error;
                                logger.error({ requestId, error: processingError }, `Raw text processing failed during OpenAI fallback parse`);
                            } else {
                                finalRecipeData = geminiResponse.recipe;
                            }
                            overallTimings.geminiParse = geminiResponse.timings.geminiCombinedParse;
                            handlerUsage = geminiResponse.usage;
                            logger.info({ requestId, timeMs: overallTimings.geminiParse, usage: handlerUsage, action: 'openai_parse_raw_text' }, `OpenAI fallback parse completed for Raw Text.`);
                        } catch (fallbackErr: any) {
                            processingError = `Both Gemini and OpenAI fallback failed: ${fallbackErr.message || 'Unknown error'}`;
                            logger.error({ requestId, error: fallbackErr }, `OpenAI fallback also failed for raw text`);
                            overallTimings.geminiParse = 0;
                            handlerUsage = { inputTokens: 0, outputTokens: 0 };
                        }
                    } else {
                        // Other unexpected errors
                        processingError = `Unexpected error during raw text parsing: ${err.message || 'Unknown error'}`;
                        logger.error({ requestId, error: err }, `Unexpected error during raw text parsing`);
                        overallTimings.geminiParse = 0;
                        handlerUsage = { inputTokens: 0, outputTokens: 0 };
                    }
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
            // Normalize servings field before caching or returning
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
            usedFallback, 
            timings: overallTimings, 
            action: 'parse_request_complete' 
        }, `Request complete.`);
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

    } catch (err) {
        const error = err as Error;
        overallTimings.total = Date.now() - requestStartTime;
        logger.error({ requestId, error: error.message, stack: error.stack }, `Unhandled exception in parseAndCacheRecipe.`);
        return {
            recipe: null,
            error: error.message || 'Unknown error in parseAndCacheRecipe',
            fromCache: false,
            inputType: detectInputType(input),
            cacheKey: input.startsWith('http') ? input : generateCacheKeyHash(input),
            timings: overallTimings,
            usage: handlerUsage,
            fetchMethodUsed
        };
    }
}

// Add new parseWithOpenAI function
async function parseWithOpenAI(
  input: string,
  requestId: string,
): Promise<GeminiHandlerResponse> {
  const handlerStartTime = Date.now();
  logger.info({ requestId }, "Falling back to OpenAI for parsing");
  
  let usage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
  let recipe: CombinedParsedRecipe | null = null;
  let error: string | null = null;
  
  const inputType = detectInputType(input);
  
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized (API key might be missing)');
    }
    
    // Process based on input type
    if (inputType === 'url') {
      const { extractedContent, error: fetchExtractError, fetchMethodUsed, timings } = 
        await fetchAndExtractFromUrl(input, requestId, scraperApiKey, scraperClient);
      
      if (fetchExtractError || !extractedContent) {
        throw new Error(fetchExtractError || 'Failed to fetch or extract content from URL');
      }
      
      // Create a prompt similar to the one in parseUrlContentWithGemini
      const textToParse = `
Title: ${extractedContent.title || ''}
Ingredients:
${extractedContent.ingredientsText || ''}
Instructions:
${extractedContent.instructionsText || ''}
      `.trim();
      
      // Call OpenAI with the extracted content
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert recipe parsing AI. Parse the provided recipe into a valid JSON object.
            
Expected JSON format:
{
  "title": "string | null",
  "ingredients": [
    {
      "name": "string",
      "amount": "string | null",
      "unit": "string | null",
      "suggested_substitutions": [
        {
          "name": "string",
          "amount": "string | number | null",
          "unit": "string | null",
          "description": "string | null"
        }
      ] | null
    }
  ] | null,
  "instructions": "array of strings, each a single step without numbering | null",
  "substitutions_text": "string | null",
  "recipeYield": "string | null",
  "prepTime": "string | null",
  "cookTime": "string | null",
  "totalTime": "string | null",
  "nutrition": {
    "calories": "string | null",
    "protein": "string | null"
  } | null
}

Parsing Rules:
- If a value is not found, use null (not "N/A" or empty string).
- Exclude ingredients like "salt", "black pepper", "pepper", "sea salt".
- Extract prepTime, cookTime, totalTime from explicit mentions.
- Extract recipeYield from terms like "Serves 4", "Yield: 12 cookies".
- Extract nutrition info if available.
- Suggest 1-2 sensible substitutions for each ingredient.
- Convert fractional amounts to decimals.
- Output ONLY the JSON object.`
          },
          {
            role: "user",
            content: textToParse
          }
        ],
        response_format: { type: "json_object" }
      });
      
      // Process the response
      const responseText = completion.choices[0].message.content;
      
      if (responseText) {
        try {
          recipe = JSON.parse(responseText);
          
          // Add additional data from extractedContent
          if (recipe && extractedContent) {
            recipe.description = extractedContent.description ?? null;
            recipe.image = extractedContent.image ?? null;
            recipe.thumbnailUrl = extractedContent.thumbnailUrl ?? null;
            recipe.sourceUrl = extractedContent.sourceUrl ?? null;
          }
          
          // Track usage
          usage = normalizeUsageMetadata({
            promptTokenCount: completion.usage?.prompt_tokens || 0,
            candidatesTokenCount: completion.usage?.completion_tokens || 0
          }, 'openai');
          
          logger.info({ requestId, usage, action: 'openai_parse_url' }, 'OpenAI parse completed for URL');
        } catch (parseErr: any) {
          error = `Failed to parse OpenAI response: ${parseErr.message}`;
          logger.error({ requestId, error, responseText }, 'JSON parse failed for OpenAI URL response');
        }
      } else {
        error = 'Empty response from OpenAI';
        logger.warn({ requestId }, 'No text in OpenAI response for URL');
      }
    } else {
      // Raw text processing
      const { preparedText, error: prepareError, timings: prepTimings } = extractFromRawText(input, requestId);
      
      if (prepareError || !preparedText) {
        throw new Error(prepareError || 'Failed to prepare raw text');
      }
      
      // Call OpenAI with the prepared text
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert recipe parsing AI. Parse the provided recipe into a valid JSON object.
            
Expected JSON format:
{
  "title": "string | null",
  "ingredients": [
    {
      "name": "string",
      "amount": "string | null",
      "unit": "string | null",
      "suggested_substitutions": [
        {
          "name": "string",
          "amount": "string | number | null",
          "unit": "string | null",
          "description": "string | null"
        }
      ] | null
    }
  ] | null,
  "instructions": "array of strings, each a single step without numbering | null",
  "substitutions_text": "string | null",
  "recipeYield": "string | null",
  "prepTime": "string | null",
  "cookTime": "string | null",
  "totalTime": "string | null",
  "nutrition": {
    "calories": "string | null",
    "protein": "string | null"
  } | null
}

Parsing Rules:
- If a value is not found, use null (not "N/A" or empty string).
- Exclude ingredients like "salt", "black pepper", "pepper", "sea salt".
- Extract prepTime, cookTime, totalTime from explicit mentions.
- Extract recipeYield from terms like "Serves 4", "Yield: 12 cookies".
- Extract nutrition info if available.
- Suggest 1-2 sensible substitutions for each ingredient.
- Convert fractional amounts to decimals.
- Output ONLY the JSON object.`
          },
          {
            role: "user",
            content: preparedText
          }
        ],
        response_format: { type: "json_object" }
      });
      
      // Process the response
      const responseText = completion.choices[0].message.content;
      
      if (responseText) {
        try {
          recipe = JSON.parse(responseText);
          
          // Track usage
          usage = normalizeUsageMetadata({
            promptTokenCount: completion.usage?.prompt_tokens || 0,
            candidatesTokenCount: completion.usage?.completion_tokens || 0
          }, 'openai');
          
          logger.info({ requestId, usage, action: 'openai_parse_raw_text' }, 'OpenAI parse completed for Raw Text');
        } catch (parseErr: any) {
          error = `Failed to parse OpenAI response: ${parseErr.message}`;
          logger.error({ requestId, error, responseText }, 'JSON parse failed for OpenAI raw text response');
        }
      } else {
        error = 'Empty response from OpenAI';
        logger.warn({ requestId }, 'No text in OpenAI response for raw text');
      }
    }
  } catch (err: any) {
    logger.error({ requestId, error: err }, 'OpenAI call error');
    error = err instanceof Error ? err.message : 'Unknown OpenAI error';
    
    // Ensure usage has default values if error occurs before assignment
    if (usage.inputTokens === 0 && usage.outputTokens === 0) {
      usage = normalizeUsageMetadata(null, 'openai');
    }
  }
  
  const totalTime = Date.now() - handlerStartTime;
  
  logger.info({ requestId, success: !!recipe, timeMs: totalTime, action: 'openai_parse_complete' }, 
    `OpenAI parsing ${recipe ? 'succeeded' : 'failed'} in ${totalTime}ms`);
  
  return {
    recipe,
    error,
    usage,
    timings: { geminiCombinedParse: totalTime }
  };
} 