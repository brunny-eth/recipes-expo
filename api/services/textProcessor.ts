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
  console.log(`[${requestId}] Preparing raw text input.`);
  const preparedText = text.trim();
  const timings = { prepareText: Date.now() - startTime };
  console.log(`[${requestId}] Raw text preparation complete. Timing: ${timings.prepareText}ms`);
  return { preparedText, error: null, timings };
} 