export type InputType = 'url' | 'raw_text' | 'audio' | 'image' | 'video';

/**
 * Detects if the input string is likely a URL or raw text.
 * Based on the logic from the original isProbablyUrl function.
 * @param input The input string.
 * @returns 'url' if it looks like a URL, otherwise 'raw_text'.
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();

  // Check for explicit http(s) prefix
  const httpPattern = /^https?:\/\//i;
  if (httpPattern.test(trimmed)) {
    return 'url';
  }

  // Check for a general domain pattern and limit line count
  const domainPattern = /^[^\s\/$.?#].[^\s]*\.[a-zA-Z]{2,}(\/[\w.-]*)*\/?(\?[\w%.-]+=[\w%.-]+(&[\w%.-]+=[\w%.-]+)*)?(#\w*)?$/;
  if (domainPattern.test(trimmed)) {
    // Consider it a URL only if it also has few lines (original logic)
    if (input.split('\n').length <= 3) {
      return 'url';
    }
  }

  // Otherwise, assume it's raw text
  return 'raw_text';
} 