import { CombinedParsedRecipe } from '../../common/types';
import { supabase } from '../lib/supabase';
import { createHash } from 'crypto';
import { generateCacheKeyHash } from '../utils/hash';
import { StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';
import { finalValidateRecipe } from './finalValidateRecipe';
import { ParseResult } from './parseRecipe';
import { parseUrlRecipe } from './parseUrlRecipe';
import { parseTextRecipe } from './parseTextRecipe';
import { runDefaultLLM, PromptPayload } from '../llm/adapters';
import { buildVideoParsePrompt } from '../llm/parsingPrompts';
import { ParseErrorCode, StructuredError } from '../../common/types/errors';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { generateAndSaveEmbedding } from '../../utils/recipeEmbeddings';

// Type definitions for the external scraper response
export type ScrapeCaptionResponse = {
  caption: string | null;
  source: 'caption' | 'link' | null;
  platform: 'instagram' | 'tiktok' | 'youtube';
  error: {
    code: string;
    severity: 'auth' | 'retryable' | 'fatal';
  } | null;
};

export type VideoParseResult = ParseResult & {
  source?: 'caption' | 'link' | null;
};

/**
 * Fetches caption from video URL using the external scraper microservice.
 * @param videoUrl The video URL to scrape.
 * @param requestId A unique identifier for tracing the request.
 * @returns The scraper response.
 */
async function fetchCaptionFromVideoUrl(videoUrl: string, requestId: string): Promise<ScrapeCaptionResponse> {
  const startTime = Date.now();
  
  try {
    logger.info({ requestId, videoUrl }, 'Fetching caption from video URL via scraper microservice.');
    
    const response = await fetch('https://meez-scrape.fly.dev/scrape-caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ScrapeCaptionResponse = await response.json();
    
    logger.info({ 
      requestId, 
      platform: data.platform, 
      hasCaptionData: !!data.caption,
      captionLength: data.caption?.length || 0,
      timeMs: Date.now() - startTime 
    }, 'Successfully fetched caption from scraper microservice.');
    
    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ requestId, error: errorMessage, timeMs: Date.now() - startTime }, 'Failed to fetch caption from scraper microservice.');
    
    // Return a fallback response with error information
    return {
      caption: null,
      source: null,
      platform: 'youtube', // Default fallback
      error: {
        code: 'SCRAPER_REQUEST_FAILED',
        severity: 'fatal'
      }
    };
  }
}

/**
 * Scores the quality of a caption for recipe extraction.
 * @param caption The caption text to evaluate.
 * @returns Quality score: 'high', 'medium', or 'low'.
 */
function scoreCaptionQuality(caption: string | null): 'high' | 'medium' | 'low' {
  if (!caption) return 'low';
  
  const text = caption.trim();
  if (text.length < 20) return 'low';
  
  // Count recipe-related keywords
  const recipeKeywords = [
    'recipe', 'ingredients', 'cook', 'bake', 'mix', 'stir', 'add', 'cup', 'tablespoon', 'teaspoon',
    'minutes', 'hour', 'oven', 'pan', 'bowl', 'salt', 'pepper', 'oil', 'flour', 'sugar',
    'onion', 'garlic', 'chicken', 'beef', 'pork', 'fish', 'eggs', 'cheese', 'butter', 'milk'
  ];

  // Keywords that strongly indicate instructions
  const instructionKeywords = [
    'preheat', 'heat', 'slice', 'chop', 'dice', 'mince', 'combine', 'mix', 'stir', 'whisk', 
    'beat', 'fold', 'pour', 'sprinkle', 'season', 'bake', 'roast', 'fry', 'sauté', 'boil', 
    'simmer', 'reduce', 'cool', 'serve', 'garnish', 'set aside', 'drain', 'rinse', 'melt', 
    'toast', 'spread', 'layer', 'step'
  ];
  
  const keywordCount = recipeKeywords.reduce((count, keyword) => {
    return count + (text.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);

  const instructionKeywordCount = instructionKeywords.reduce((count, keyword) => {
    return count + (text.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
  
  // Count measurement patterns (e.g., "2 cups", "1 tbsp", "3/4 cup")
  const measurementPatterns = [
    /\d+\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounces|lb|lbs|pound|pounds)/gi,
    /\d+\/\d+\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons)/gi,
    /\d+\.\d+\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons)/gi
  ];
  
  const measurementCount = measurementPatterns.reduce((count, pattern) => {
    const matches = text.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  // New Rule: If a URL is present and there are few-to-no measurements,
  // it's likely a "link-in-bio" style post. Prioritize the link.
  const hasUrl = /https?:\/\//.test(text);
  if (hasUrl && measurementCount < 2) {
    logger.info({ event: 'caption_quality_override' }, 'URL found with few measurements, forcing "low" quality to prioritize link extraction.');
    return 'low';
  }

  // Scoring logic
  const wordCount = text.split(/\s+/).length;
  const keywordDensity = keywordCount / Math.max(wordCount, 1);
  
  // High quality requires at least some instructions
  if (keywordCount >= 5 && measurementCount >= 2 && wordCount >= 50 && instructionKeywordCount >= 3) {
    return 'high';
  } else if (keywordCount >= 3 && (measurementCount >= 1 || wordCount >= 30) && instructionKeywordCount >= 3) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Extracts URLs from text using regex patterns.
 * @param text The text to search for URLs.
 * @returns The first URL found, or null if none found.
 */
function extractUrlFromText(text: string | null): string | null {
  if (!text) return null;
  
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex);
  
  // Log the extraction attempt for debugging
  if (matches && matches.length > 0) {
    console.log(`[extractUrlFromText] Found ${matches.length} URL(s) in text: ${matches.join(', ')}`);
  } else {
    console.log(`[extractUrlFromText] No URLs found in text: "${text.substring(0, 50)}..."`);
  }
  
  return matches ? matches[0] : null;
}

/**
 * Parses a recipe from a video URL by extracting captions and processing them.
 * @param videoUrl The video URL to parse.
 * @returns The parsed recipe result.
 */
export async function parseVideoRecipe(videoUrl: string): Promise<VideoParseResult> {
  const requestId = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
  const requestStartTime = Date.now();
  
  let overallTimings: ParseResult['timings'] & { scraperTime?: number } = {
    dbCheck: -1,
    geminiParse: -1,
    dbInsert: -1,
    total: -1,
    scraperTime: -1,
  };
  
  let handlerUsage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
  const inputType = 'video';
  const cacheKey = generateCacheKeyHash(videoUrl);

  try {
    logger.info({ requestId, videoUrl }, 'Starting video recipe parsing.');

    // Step 1: Fetch caption from video URL
    console.time(`[${requestId}] scraper_call`);
    logger.info({ requestId, event: 'scraper_call_start' }, 'Calling scraper microservice.');
    const scrapingStartTime = Date.now();
    const scrapeResult = await fetchCaptionFromVideoUrl(videoUrl, requestId);
    overallTimings.scraperTime = Date.now() - scrapingStartTime;
    logger.info({ requestId, event: 'scraper_call_end', durationMs: overallTimings.scraperTime }, 'Scraper microservice call finished.');
    console.timeEnd(`[${requestId}] scraper_call`);
    
    // Step 2: Handle scraping errors
    if (scrapeResult.error) {
      logger.error({ requestId, error: scrapeResult.error }, 'Video scraping failed.');
      return {
        recipe: null,
        error: {
          code: ParseErrorCode.GENERATION_FAILED,
          message: `Failed to extract caption from video: ${scrapeResult.error.code}`
        },
        fromCache: false,
        inputType,
        cacheKey,
        timings: { ...overallTimings, total: Date.now() - requestStartTime },
        usage: handlerUsage,
        fetchMethodUsed: 'video_scraper',
        source: null
      };
    }

    console.log(`[parseVideoRecipe] Scraper returned caption:`, scrapeResult.caption?.slice(0, 100));

    // Add a strict check for the caption before proceeding
    if (!scrapeResult.caption || typeof scrapeResult.caption !== 'string') {
      logger.error({ requestId, caption: scrapeResult.caption }, 'Caption was missing or invalid from scraper response.');
      return {
        recipe: null,
        error: {
          code: ParseErrorCode.INVALID_INPUT,
          message: 'Received an invalid caption from the video scraper.',
        },
        fromCache: false,
        inputType,
        cacheKey,
        timings: { ...overallTimings, total: Date.now() - requestStartTime },
        usage: handlerUsage,
        fetchMethodUsed: 'video_scraper',
        source: null,
      };
    }

    // Step 3: Score caption quality
    console.time(`[${requestId}] caption_scoring`);
    logger.info({ requestId, event: 'caption_scoring_started' }, 'Attempting to score caption quality.');
    const captionQuality = scoreCaptionQuality(scrapeResult.caption);
    console.timeEnd(`[${requestId}] caption_scoring`);
    logger.info({ 
      requestId, 
      captionQuality, 
      captionLength: scrapeResult.caption.length, 
      platform: scrapeResult.platform,
      event: 'caption_quality_assessed'
    }, 'Caption quality assessed.');

    // Step 4: Route based on caption quality
    if (captionQuality === 'high' || captionQuality === 'medium') {
      // High/Medium quality: Parse caption directly with LLM
      logger.info({ 
        requestId, 
        captionQuality, 
        platform: scrapeResult.platform,
        source: 'caption',
        event: 'llm_processing_started'
      }, 'Processing high/medium quality caption with LLM.');
      
      const prompt = buildVideoParsePrompt(scrapeResult.caption, scrapeResult.platform);
      prompt.metadata = { requestId, route: 'video_caption' };

      console.log('[DEBUG] Gemini System Prompt:\n', prompt.system);
      console.log('[DEBUG] Gemini Prompt Text:\n', prompt.text);

      console.time(`[${requestId}] gemini_call`);
      logger.info({ requestId, event: 'llm_call_start' }, 'Calling LLM to parse caption.');
      const llmStartTime = Date.now();
      const llmResponse = await runDefaultLLM(prompt);
      overallTimings.geminiParse = Date.now() - llmStartTime;
      handlerUsage = llmResponse.usage;
      logger.info({ requestId, event: 'llm_call_end', durationMs: overallTimings.geminiParse }, 'LLM call finished.');
      console.timeEnd(`[${requestId}] gemini_call`);

      if (llmResponse.error || !llmResponse.output) {
        const errorMessage = llmResponse.error || 'LLM returned no output';
        logger.error({ requestId, error: errorMessage }, 'LLM processing failed for video caption.');
        
        return {
          recipe: null,
          error: {
            code: ParseErrorCode.GENERATION_FAILED,
            message: `Failed to process video caption: ${errorMessage}`
          },
          fromCache: false,
          inputType,
          cacheKey,
          timings: { ...overallTimings, total: Date.now() - requestStartTime },
          usage: handlerUsage,
          fetchMethodUsed: 'video_scraper',
          source: null
        };
      }

      let parsedRecipe: CombinedParsedRecipe | null = null;
      
      try {
        parsedRecipe = JSON.parse(llmResponse.output);
        console.log('[DEBUG] Gemini Raw Output:\n', JSON.stringify(parsedRecipe, null, 2));

        // Fallback patch for flat ingredients list
        if (parsedRecipe && !parsedRecipe.ingredientGroups && (parsedRecipe as any).ingredients) {
          console.warn('[PATCH] Gemini returned flat ingredients list — wrapping into ingredientGroups.');
          parsedRecipe.ingredientGroups = [{ name: 'Main Ingredients', ingredients: (parsedRecipe as any).ingredients }];
          delete (parsedRecipe as any).ingredients;
        }

        logger.info({ requestId, timeMs: overallTimings.geminiParse }, 'Successfully parsed video caption with LLM.');

        if (parsedRecipe?.ingredientGroups?.length) {
          console.log(`[${requestId}] [DEBUG] Parsed ingredient names:`);
          parsedRecipe.ingredientGroups.forEach((group, i) => {
            console.log(`  Group ${i + 1} (${group.name || 'no name'}):`);
            group.ingredients.forEach((ingredient) => {
              console.log(`    - ${ingredient.name}`);
            });
          });
        } else {
          console.warn(`[${requestId}] [DEBUG] No ingredientGroups returned in parsed recipe`);
        }

      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'JSON parse failed';
        logger.error({ requestId, error: errorMessage }, 'Failed to parse LLM response as JSON.');
        
        return {
          recipe: null,
          error: {
            code: ParseErrorCode.GENERATION_FAILED,
            message: `Failed to parse LLM response: ${errorMessage}`
          },
          fromCache: false,
          inputType,
          cacheKey,
          timings: { ...overallTimings, total: Date.now() - requestStartTime },
          usage: handlerUsage,
          fetchMethodUsed: 'video_scraper',
          source: null
        };
      }

      // Validate the parsed recipe
      const validationResult = finalValidateRecipe(parsedRecipe, requestId);
      if (!validationResult.ok) {
        logger.warn({ requestId, reasons: validationResult.reasons }, 'Video recipe validation failed.');
        return {
          recipe: null,
          error: {
            code: ParseErrorCode.FINAL_VALIDATION_FAILED,
            message: 'The video caption did not contain enough recipe information.'
          },
          fromCache: false,
          inputType,
          cacheKey,
          timings: { ...overallTimings, total: Date.now() - requestStartTime },
          usage: handlerUsage,
          fetchMethodUsed: 'video_scraper',
          source: null
        };
      }

      // Add source URL and return successful result
      if (parsedRecipe) {
        parsedRecipe.sourceUrl = videoUrl;
      }

      // --- Database Insertion and Embedding ---
      let insertedId: number | null = null;
      if (parsedRecipe) {
        console.time(`[${requestId}] supabase_insert`);
        const dbInsertStartTime = Date.now();
        try {
          const { data: insertData, error: insertError } = await supabase
            .from('processed_recipes_cache')
            .insert({
              url: videoUrl,
              normalized_url: normalizeUrl(videoUrl),
              recipe_data: parsedRecipe,
              source_type: inputType,
            })
            .select('id')
            .single();

          overallTimings.dbInsert = Date.now() - dbInsertStartTime;

          if (insertError) {
            logger.error({ requestId, cacheKey, err: insertError }, 'Error saving video recipe to cache.');
          } else if (insertData) {
            insertedId = insertData.id;
            (parsedRecipe as any).id = insertedId;
            logger.info({ requestId, cacheKey, dbInsertMs: overallTimings.dbInsert, insertedId }, 'Successfully saved video recipe to cache.');
            
            // Generate and save embedding asynchronously
            if (insertedId) {
              generateAndSaveEmbedding(insertedId, parsedRecipe).catch(err => {
                logger.error({ requestId, recipeId: insertedId, error: err }, "Failed to generate/save embedding for video recipe");
              });
            }
          }
        } catch (dbError) {
          overallTimings.dbInsert = Date.now() - dbInsertStartTime;
          logger.error({ requestId, cacheKey, err: dbError }, 'Exception during video recipe cache insert.');
        }
        console.timeEnd(`[${requestId}] supabase_insert`);
      }
      // --- End Database Insertion and Embedding ---

      overallTimings.total = Date.now() - requestStartTime;
      
      logger.info({ 
        requestId, 
        captionQuality, 
        platform: scrapeResult.platform,
        source: 'caption',
        totalTimeMs: overallTimings.total,
        timings: overallTimings,
        event: 'video_recipe_parsing_completed'
      }, 'Video recipe parsing completed successfully via caption.');
      
      return {
        recipe: parsedRecipe,
        error: null,
        fromCache: false,
        inputType,
        cacheKey,
        timings: overallTimings,
        usage: handlerUsage,
        fetchMethodUsed: 'video_scraper',
        source: 'caption'
      };

    } else {
      // Low quality: Try to extract URL from caption
      logger.info({ 
        requestId, 
        captionQuality, 
        platform: scrapeResult.platform,
        captionLength: scrapeResult.caption.length,
        event: 'url_extraction_started'
      }, 'Low quality caption detected, attempting URL extraction.');
      
      const extractedUrl = extractUrlFromText(scrapeResult.caption);
      
      if (extractedUrl) {
        logger.info({ 
          requestId, 
          extractedUrl, 
          captionQuality,
          platform: scrapeResult.platform,
          source: 'link',
          event: 'url_extracted_from_caption'
        }, 'Found URL in caption, delegating to URL parser.');
        
        try {
          logger.info({ requestId, event: 'url_fallback_start', url: extractedUrl }, 'Starting fallback to parseUrlRecipe.');
          // Parse the extracted URL
          const urlParseStartTime = Date.now();
          const urlParseResult = await parseUrlRecipe(extractedUrl);
          const urlParseTime = Date.now() - urlParseStartTime;

          logger.info({
            requestId,
            extractedUrl,
            platform: scrapeResult.platform,
            urlParseTimeMs: urlParseTime,
            success: !!urlParseResult.recipe,
            event: 'url_fallback_end',
            timings: urlParseResult.timings,
          }, 'URL parsing completed for extracted link.');

          // Return the URL parse result with video-specific metadata
          return {
            ...urlParseResult,
            source: 'link',
            fetchMethodUsed: 'video_scraper_url_extraction',
          };
        } catch (fallbackError) {
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error';
          logger.error({ requestId, extractedUrl, error: errorMessage }, 'Fallback to parseUrlRecipe failed.');
          return {
            recipe: null,
            error: {
              code: ParseErrorCode.GENERATION_FAILED,
              message: `The linked recipe at ${extractedUrl} could not be parsed.`,
            },
            fromCache: false,
            inputType,
            cacheKey,
            timings: { ...overallTimings, total: Date.now() - requestStartTime },
            usage: handlerUsage,
            fetchMethodUsed: 'video_scraper_url_extraction',
            source: 'link',
          };
        }
      } else {
        logger.warn({ 
          requestId, 
          captionQuality,
          platform: scrapeResult.platform,
          captionLength: scrapeResult.caption.length,
          captionPreview: scrapeResult.caption.substring(0, 100) + '...',
          event: 'url_extraction_failed'
        }, 'No URL found in low-quality caption.');
        
        return {
          recipe: null,
          error: {
            code: ParseErrorCode.INVALID_INPUT,
            message: 'The caption was too short and didn\'t contain a usable link.'
          },
          fromCache: false,
          inputType,
          cacheKey,
          timings: { ...overallTimings, total: Date.now() - requestStartTime },
          usage: handlerUsage,
          fetchMethodUsed: 'video_scraper',
          source: null
        };
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    overallTimings.total = Date.now() - requestStartTime;
    
    logger.error({ 
      requestId, 
      error: errorMessage, 
      videoUrl,
      totalTimeMs: overallTimings.total,
      event: 'video_recipe_parsing_failed'
    }, 'Unhandled exception in parseVideoRecipe.');
    
    return {
      recipe: null,
      error: {
        code: ParseErrorCode.GENERATION_FAILED,
        message: `Video recipe parsing failed: ${errorMessage}`
      },
      fromCache: false,
      inputType,
      cacheKey,
      timings: overallTimings,
      usage: handlerUsage,
      fetchMethodUsed: 'video_scraper',
      source: null
    };
  }
} 