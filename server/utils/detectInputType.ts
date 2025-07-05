export type InputType = 'url' | 'raw_text' | 'audio' | 'image' | 'video' | 'invalid';

/**
 * Detects if the input string is likely a URL, raw text, or invalid input.
 * Based on the logic from the original isProbablyUrl function.
 * @param input The input string.
 * @returns 'url' if it looks like a URL, 'raw_text' if it's valid text, or 'invalid' if it's empty, whitespace-only, or meaningless.
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  console.log(`[detectInputType] Input received: '${input}' (trimmed: '${trimmed}')`); // NEW LOG

  // Handle empty or purely whitespace inputs
  if (trimmed === '') {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (empty trimmed)`); // NEW LOG
    return 'invalid';
  }

  // Handle inputs that are too short to be meaningful (less than 5 characters)
  if (trimmed.length < 5) {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (too short: ${trimmed.length} chars)`); // NEW LOG
    return 'invalid';
  }

  // Handle inputs that are only special characters or non-alphanumeric
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (no alphanumeric chars)`); // NEW LOG
    return 'invalid';
  }

  // Check for explicit http(s) prefix
  const httpPattern = /^https?:\/\//i;
  if (httpPattern.test(trimmed)) {
    console.log(`[detectInputType] Classification result: 'url' for input: '${input}' (has http prefix)`); // NEW LOG
    return 'url';
  }

  // Check for a general domain pattern and limit line count
  const domainPattern = /^[^\s\/$.?#].[^\s]*\.[a-zA-Z]{2,}(\/[\w.-]*)*\/?(\?[\w%.-]+=[\w%.-]+(&[\w%.-]+=[\w%.-]+)*)?(#\w*)?$/;
  if (domainPattern.test(trimmed)) {
    // Consider it a URL only if it also has few lines (original logic)
    if (input.split('\n').length <= 3) {
      console.log(`[detectInputType] Classification result: 'url' for input: '${input}' (matches domain pattern)`); // NEW LOG
      return 'url';
    }
  }

  // Otherwise, assume it's raw text
  console.log(`[detectInputType] Classification result: 'raw_text' for input: '${input}' (fallback)`); // NEW LOG
  return 'raw_text';
} 