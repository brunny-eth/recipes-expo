export type InputType = 'url' | 'raw_text' | 'audio' | 'image' | 'video' | 'invalid';

/**
 * Detects if the input string is likely a URL, raw text, or invalid input.
 * Based on the logic from the original isProbablyUrl function.
 * @param input The input string.
 * @returns 'url' if it looks like a URL, 'raw_text' if it's valid text, or 'invalid' if it's empty, whitespace-only, or meaningless.
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();

  // Handle empty or purely whitespace inputs
  if (trimmed === '') {
    return 'invalid';
  }

  // Handle inputs that are too short to be meaningful (less than 5 characters)
  if (trimmed.length < 5) {
    return 'invalid';
  }

  // Handle inputs that are only special characters or non-alphanumeric
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return 'invalid';
  }

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