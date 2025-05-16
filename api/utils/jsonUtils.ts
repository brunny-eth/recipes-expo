import logger from '../lib/logger'; // Assuming logger is in lib

/**
 * Safely parses a string that is expected to be JSON, potentially wrapped in markdown code blocks
 * or surrounded by other text.
 * @param rawString The raw string to parse.
 * @param requestId Optional request ID for logging.
 * @returns An object with `parsed` (the parsed JSON) or `error` (an error message if parsing failed).
 */
export function safeJsonParse(rawString: string, requestId?: string): { parsed?: any; error?: string } {
  const id = requestId || 'safeJsonParse';

  if (typeof rawString !== 'string' || rawString.trim() === '') {
    logger.warn(`[${id}] Input to safeJsonParse was empty or not a string.`);
    return { error: 'Input was empty or not a string.' };
  }

  // Attempt to extract JSON from typical markdown code blocks or direct JSON
  // Regex looks for ```json ... ``` or ``` ... ``` or the string itself if no backticks
  const match = rawString.match(/^[^\S\n]*```(?:json)?\s*([\s\S]*?)\s*```[^\S\n]*$/s);
  let textToParse = rawString.trim();

  if (match && match[1]) {
    textToParse = match[1].trim();
    logger.info(`[${id}] Extracted content from markdown code block for parsing.`);
  } else {
    // If no markdown block, try to find the first '{' and last '}' to extract potential JSON object
    // This helps with cases where JSON is embedded in other text without markdown
    const firstBrace = textToParse.indexOf('{');
    const lastBrace = textToParse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      textToParse = textToParse.substring(firstBrace, lastBrace + 1);
      logger.info(`[${id}] Attempting to parse substring from first '{' to last '}'.`);
    } else {
        // If no braces, it's unlikely to be a JSON object. Could be a JSON primitive (string, number, boolean)
        // but our primary use case is objects. If it's not an object, direct JSON.parse will handle it or fail.
        logger.info(`[${id}] No markdown or clear JSON object braces detected, attempting to parse trimmed input directly.`);
    }
  }

  if (textToParse === '') {
    logger.warn(`[${id}] After cleaning, text to parse is empty.`);
    return { error: 'Cleaned text resulted in empty string.' };
  }

  try {
    const parsed = JSON.parse(textToParse);
    logger.info(`[${id}] Successfully parsed JSON string.`);
    return { parsed };
  } catch (e: any) {
    const errorMessage = e.message || '';
    // Regex to capture the position from the error message
    const posRegex = /position (\d+)/;
    const matchPos = errorMessage.match(posRegex);

    if (errorMessage.includes('Unexpected non-whitespace character') && matchPos && matchPos[1]) {
      const position = parseInt(matchPos[1], 10);
      logger.warn(`[${id}] JSON.parse failed with 'Unexpected non-whitespace character' at position ${position}. Attempting to parse substring textToParse.substring(0, position). Full text was: "${textToParse}".`);
      try {
        const cleanedText = textToParse.substring(0, position);
        const parsed = JSON.parse(cleanedText);
        logger.info(`[${id}] Successfully parsed JSON string after truncation due to trailing characters.`);
        return { parsed };
      } catch (e2: any) {
        logger.error(`[${id}] JSON.parse still failed after truncation. Original error: ${errorMessage}. Second error: ${e2.message}. Full text was: "${textToParse}"`);
        return { error: `JSON.parse failed: ${e2.message} (after attempting to fix 'Unexpected non-whitespace character')` };
      }
    } else {
      const previewText = `${textToParse.substring(0, 500)}${textToParse.length > 500 ? '...' : ''}`;
      logger.error(`[${id}] JSON.parse failed for text: '${previewText}'. Error: ${errorMessage}`);
      return { error: `JSON.parse failed: ${errorMessage}` };
    }
  }
} 