import { createLogger } from '../lib/logger';

const logger = createLogger('textProcessor');

/**
 * Prepares raw recipe text for further processing.
 * Currently, this just trims the input.
 * @param rawText The raw recipe text.
 * @param requestId A unique identifier for logging.
 * @returns The prepared text.
 */
export function extractFromRawText(rawText: string, requestId: string): { preparedText: string | null; error: string | null; timings: { prepareText: number } } {
  const startTime = Date.now();

  logger.info({ 
    requestId, 
    inputLength: rawText?.length || 0,
    inputPreview: rawText?.substring(0, 100) + '...' 
  }, 'Processing raw text input');

  if (!rawText || rawText.trim().length < 2) {
    logger.warn({ 
      requestId, 
      inputLength: rawText?.length || 0,
      trimmedLength: rawText?.trim().length || 0 
    }, 'Input text is empty or too short');
    return { preparedText: null, error: 'Input text is empty or too short.', timings: { prepareText: Date.now() - startTime } };
  }

  const preparedText = rawText.trim();

  const wordCount = preparedText.split(/\s+/).length;
  const hasFoodKeywords = /(?:eggs?|chicken|soup|sandwich|pasta|salad|toast|rice|steak|cookies|roast|tacos?)/i.test(preparedText);

  if (wordCount < 3 && !hasFoodKeywords) {
    const error = 'Input text has too few words and does not appear to describe a recipe.';
    logger.warn({ 
      requestId, 
      wordCount, 
      hasFoodKeywords,
      preparedTextLength: preparedText.length,
      preparedTextPreview: preparedText.substring(0, 100) + '...',
      event: 'plausibility_check_failed' 
    }, error);
    return { preparedText, error, timings: { prepareText: Date.now() - startTime } };
  }

  logger.info({ 
    requestId, 
    preparedTextLength: preparedText.length,
    wordCount,
    hasFoodKeywords,
    event: 'plausibility_check_passed' 
  }, 'Input text passed basic plausibility check');
  return { preparedText, error: null, timings: { prepareText: Date.now() - startTime } };
} 