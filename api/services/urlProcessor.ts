import { fetchHtmlWithFallback } from './htmlFetch';
import { extractRecipeContent, ExtractedContent } from './extractContent'; // Import ExtractedContent type
import logger from '../lib/logger';

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
  console.log(`[${requestId}] Starting URL fetch & extract for: ${url}`);
  let timings: FetchExtractTimings = { fetchHtml: -1, extractContent: -1 };
  let fetchMethodUsed = 'Direct Fetch';
  let processingError: string | null = null;
  let extractedContent: ExtractedContent | null = null;

  // Step 1: Fetch HTML
  const fetchStartTime = Date.now();
  const fetchResult = await fetchHtmlWithFallback(url, scraperApiKey, scraperClient);
  let htmlContent = fetchResult.htmlContent;
  let fetchError = fetchResult.error;
  fetchMethodUsed = fetchResult.fetchMethodUsed;
  timings.fetchHtml = Date.now() - fetchStartTime;

  if (fetchError) {
      console.error(`[${requestId}] Fetch process failed for URL ${url}: ${fetchError.message}`);
      processingError = `Failed to retrieve recipe content from ${url}: ${fetchError.message}`;
  } else if (htmlContent.length === 0) {
      const finalErrorMessage = 'HTML content was empty after fetch attempts';
      console.error(`[${requestId}] Fetch process failed for URL ${url}: ${finalErrorMessage}`);
      processingError = `Failed to retrieve recipe content from ${url}: ${finalErrorMessage}`;
  }

  if (processingError) {
    // Return early if fetch failed
    return { extractedContent: null, error: processingError, fetchMethodUsed, timings };
  }

  console.log(`[${requestId}] Using HTML content obtained via: ${fetchMethodUsed} (URL: ${url}, Length: ${htmlContent.length})`);

  // Step 2: Extract Content
  console.log(`[${requestId}] Pre-processing HTML with cheerio for URL: ${url}...`);
  const extractStartTime = Date.now();
  try {
      extractedContent = extractRecipeContent(htmlContent);
      timings.extractContent = Date.now() - extractStartTime;

      // --- ADDED DEBUG LOG ---
      if (extractedContent) {
        logger.debug({ requestId, url, ingredientsTextPreview: extractedContent.ingredientsText ? extractedContent.ingredientsText.substring(0, 500) : 'null/empty' }, '[DEBUG urlProcessor] Extracted ingredientsText');
        logger.debug({ requestId, url, instructionsTextPreview: extractedContent.instructionsText ? extractedContent.instructionsText.substring(0, 500) : 'null/empty' }, '[DEBUG urlProcessor] Extracted instructionsText');
      } else {
        logger.debug({ requestId, url }, '[DEBUG urlProcessor] extractedContent is null after extractRecipeContent');
      }
      // --- END DEBUG LOG ---

      if (extractedContent && (!extractedContent.ingredientsText || !extractedContent.instructionsText)) {
          console.warn(`[${requestId}] Failed to extract clear ingredients or instructions using cheerio for URL: ${url}. Proceeding with partial data.`);
      } else {
          console.log(`[${requestId}] Successfully extracted content sections for URL: ${url}.`);
      }
  } catch (extractErr: any) {
      console.error(`[${requestId}] Error during content extraction for URL ${url}:`, extractErr);
      timings.extractContent = Date.now() - extractStartTime;
      processingError = `Failed to extract content from HTML for ${url}: ${extractErr.message}`;
      extractedContent = null; // Ensure content is null if extraction fails
  }

  console.log(`[${requestId}] Fetch & Extract finished for ${url}. Fetch=${timings.fetchHtml}ms, Extract=${timings.extractContent}ms`);

  return { extractedContent, error: processingError, fetchMethodUsed, timings };
}

// Need to import the ExtractedContent type from extractContent.ts
// Make sure extractContent.ts exports it. 