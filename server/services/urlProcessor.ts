import { fetchHtmlWithFallback } from './htmlFetch';
import { extractRecipeContent, ExtractedContent } from './extractContent'; // Import ExtractedContent type
import { createLogger } from '../lib/logger';

const logger = createLogger('urlProcessor');

type FetchExtractTimings = {
  fetchHtml: number;
  extractContent: number;
};

type FetchExtractResult = {
  extractedContent: ExtractedContent | null;
  error: string | null;
  fetchMethodUsed: string;
  timings: FetchExtractTimings;
};

/**
 * Fetches HTML from a URL (with fallback) and extracts recipe content.
 * @param url The recipe URL.
 * @param requestId A unique identifier for logging.
 * @param scraperApiKey The ScraperAPI key (optional).
 * @param scraperClient The ScraperAPI client instance.
 * @returns An object containing extracted content, fetch method, timings, and error status.
 */
export async function fetchAndExtractFromUrl(
  url: string,
  requestId: string,
  scraperApiKey: string | undefined,
  scraperClient: any
): Promise<FetchExtractResult> {
  const handlerStartTime = Date.now(); // Keep track of total time within this specific function if needed, though parseAndCacheRecipe does overall timing.
  logger.info({ requestId, url }, 'Starting URL fetch & extract');
  let timings: FetchExtractTimings = { fetchHtml: -1, extractContent: -1 };
  let fetchMethodUsed = 'Direct Fetch';
  let processingError: string | null = null;
  let extractedContent: ExtractedContent | null = null;

  // Step 1: Fetch HTML
  const fetchStartTime = Date.now();
  const fetchResult = await fetchHtmlWithFallback(url, scraperApiKey, scraperClient, requestId);
  let htmlContent = fetchResult.htmlContent;
  let fetchError = fetchResult.error;
  fetchMethodUsed = fetchResult.fetchMethodUsed;
  timings.fetchHtml = Date.now() - fetchStartTime;

  if (fetchError) {
      logger.error({ 
        requestId, 
        url, 
        fetchError: fetchError.message,
        fetchMethodUsed,
        fetchTime: timings.fetchHtml 
      }, 'Fetch process failed for URL');
      processingError = `Failed to retrieve recipe content from ${url}: ${fetchError.message}`;
  } else if (htmlContent.length === 0) {
      const finalErrorMessage = 'HTML content was empty after fetch attempts';
      logger.error({ 
        requestId, 
        url, 
        fetchMethodUsed,
        fetchTime: timings.fetchHtml 
      }, 'Fetch process failed: HTML content was empty after fetch attempts');
      processingError = `Failed to retrieve recipe content from ${url}: ${finalErrorMessage}`;
  }

  if (processingError) {
    // Return early if fetch failed
    return { extractedContent: null, error: processingError, fetchMethodUsed, timings };
  }

  logger.info({ 
    requestId, 
    url, 
    fetchMethodUsed, 
    htmlContentLength: htmlContent.length,
    fetchTime: timings.fetchHtml 
  }, 'HTML content fetched successfully');

  // Step 2: Extract Content
  logger.info({ requestId, url }, 'Pre-processing HTML with cheerio');
  const extractStartTime = Date.now();
  try {
      extractedContent = extractRecipeContent(htmlContent, requestId, url);
      timings.extractContent = Date.now() - extractStartTime;

      // --- ADDED DEBUG LOG ---
      if (extractedContent) {
        logger.debug({ 
          requestId, 
          url, 
          ingredientsTextPreview: extractedContent.ingredientsText ? extractedContent.ingredientsText.substring(0, 500) : 'null/empty' 
        }, 'Extracted ingredientsText');
        logger.debug({ 
          requestId, 
          url, 
          instructionsTextPreview: extractedContent.instructionsText ? extractedContent.instructionsText.substring(0, 500) : 'null/empty' 
        }, 'Extracted instructionsText');
      } else {
        logger.debug({ requestId, url }, 'extractedContent is null after extractRecipeContent');
      }
      // --- END DEBUG LOG ---

      if (extractedContent && (!extractedContent.ingredientsText || !extractedContent.instructionsText)) {
          logger.warn({ 
            requestId, 
            url,
            hasIngredients: !!extractedContent.ingredientsText,
            hasInstructions: !!extractedContent.instructionsText,
            extractTime: timings.extractContent 
          }, 'Failed to extract clear ingredients or instructions using cheerio. Proceeding with partial data');
      } else {
          logger.info({ 
            requestId, 
            url,
            extractTime: timings.extractContent 
          }, 'Successfully extracted content sections');
      }
  } catch (extractErr: any) {
      logger.error({ 
        requestId, 
        url, 
        error: extractErr.message,
        stack: extractErr.stack,
        extractTime: Date.now() - extractStartTime 
      }, 'Error during content extraction');
      timings.extractContent = Date.now() - extractStartTime;
      processingError = `Failed to extract content from HTML for ${url}: ${extractErr.message}`;
      extractedContent = null; // Ensure content is null if extraction fails
  }

  logger.info({ 
    requestId, 
    url, 
    fetchTime: timings.fetchHtml,
    extractTime: timings.extractContent,
    totalTime: Date.now() - handlerStartTime 
  }, 'Fetch & Extract finished');

  return { extractedContent, error: processingError, fetchMethodUsed, timings };
}

// Need to import the ExtractedContent type from extractContent.ts
// Make sure extractContent.ts exports it. 