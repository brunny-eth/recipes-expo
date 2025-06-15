import logger from '../lib/logger';

/**
 * Prepares raw recipe text for further processing.
 * Currently, this just trims the input.
 * @param text The raw recipe text.
 * @param requestId A unique identifier for logging.
 * @returns The prepared text.
 */
export function extractFromRawText(
  text: string,
  requestId: string
): { preparedText: string; error: null; timings: { prepareText: number } } {
  const startTime = Date.now();
  logger.info({ requestId }, 'Preparing raw text input.');
  const preparedText = text.trim();
  const timings = { prepareText: Date.now() - startTime };
  logger.info({ requestId, duration: timings.prepareText }, 'Raw text preparation complete.');
  return { preparedText, error: null, timings };
} 