/**
 * Fetches HTML content from a URL, with fallback to ScraperAPI if direct fetch fails (e.g., 403).
 * 
 * @param url The URL to fetch.
 * @param scraperApiKey Your ScraperAPI key (optional, needed for fallback).
 * @param scraperClient An initialized ScraperAPI client instance.
 * @returns An object containing the HTML content, the fetch method used, and any error encountered.
 */
export async function fetchHtmlWithFallback(
  url: string, 
  scraperApiKey: string | undefined, 
  scraperClient: any // Consider defining a more specific type if possible from the SDK
): Promise<{ htmlContent: string; fetchMethodUsed: string; error: Error | null }> {
  let htmlContent = '';
  let fetchMethodUsed = 'Direct Fetch';
  let error: Error | null = null;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  // Attempt 1: Direct Fetch
  console.log(`Attempting direct fetch from: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'DNT': '1'
      }
    });
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    htmlContent = await response.text();
    console.log(`Successfully fetched HTML via Direct Fetch. Length: ${htmlContent.length}`);
    console.log('[DEBUG htmlFetch] Raw HTML Content (Direct Fetch - first 500 chars):', htmlContent.substring(0, 500));
  } catch (directErr) {
    const directFetchError = directErr instanceof Error ? directErr : new Error(String(directErr));
    console.warn(`Direct fetch failed: ${directFetchError.message}`);
    error = directFetchError; // Assume error initially

    // Attempt 2: ScraperAPI Fallback
    if (scraperApiKey && scraperClient && (directFetchError.message.includes('Fetch failed: 403') || directFetchError)) {
      console.log(`Direct fetch failed. Falling back to ScraperAPI... Cause: ${directFetchError.message}`);
      
      // Determine if rendering is needed based on domain
      const needsRender = url.includes('foodnetwork.com'); // Add other domains as needed
      const options = needsRender ? { render: true, autoparse: false } : {};
      const attemptType = needsRender ? 'ScraperAPI Rendered (autoparse=false)' : 'ScraperAPI Initial';
      fetchMethodUsed = attemptType;

      try {
          console.log(`[${attemptType}] Fetching URL: ${url}`);
          const scraperResponse: any = await scraperClient.get(url, options); 

          // Determine HTML content based on response type
          let potentialHtml = '';
          let statusCode: number | undefined = undefined;
          if (typeof scraperResponse === 'object' && scraperResponse !== null) {
              if (typeof scraperResponse.body === 'string') {
                  potentialHtml = scraperResponse.body;
              }
              if (typeof scraperResponse.statusCode === 'number') {
                  statusCode = scraperResponse.statusCode;
              }
          } else if (typeof scraperResponse === 'string') {
              potentialHtml = scraperResponse;
          }

          // Validate the response
          const isValidHtml = potentialHtml && potentialHtml.toLowerCase().includes('<html');
          const isSuccessStatusCode = !statusCode || (statusCode >= 200 && statusCode < 300);

          if (isSuccessStatusCode && isValidHtml) {
              htmlContent = potentialHtml;
              console.log(`[${attemptType}] Successfully fetched valid HTML. Length: ${htmlContent.length}`);
              console.log(`[DEBUG htmlFetch] Raw HTML Content (${attemptType} - first 500 chars):`, htmlContent.substring(0, 500));
              error = null; // Clear original direct fetch error as fallback succeeded
          } else {
              // Construct error message for the failed attempt
              let failureReason = `returned ${statusCode || 'unknown status'}`;
              if (!isValidHtml) failureReason += ", and HTML content was invalid or missing <html> tag";
              throw new Error(`[${attemptType}] fallback failed: ${failureReason}`);
          }
      } catch (err) {
          const scraperError = err instanceof Error ? err : new Error(String(err));
          console.error(`[${attemptType}] Error:`, scraperError.message);
          // If the ScraperAPI attempt fails, construct the final combined error message
          error = new Error(`Direct fetch failed (${directFetchError.message}) and ScraperAPI fallback failed (${scraperError.message})`);
      }

    } else if (!scraperApiKey && directFetchError) {
         console.warn('Direct fetch failed and ScraperAPI key is missing. Cannot fallback.');
         // error is already set to directFetchError
    } else if (!scraperClient && directFetchError && scraperApiKey) {
        console.warn('Direct fetch failed and ScraperAPI client was not provided. Cannot fallback.');
        // error is already set to directFetchError
    }
  }
  return { htmlContent, fetchMethodUsed, error };
} 