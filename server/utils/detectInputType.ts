export type InputType = 'url' | 'raw_text' | 'image' | 'video' | 'invalid';

/**
 * Detects if the input string is likely a URL, raw text, or invalid input.
 * @param input The input string.
 * @returns 'url' if it looks like a URL, 'raw_text' if it's valid text, or 'invalid' if it's empty, whitespace-only, or meaningless.
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  console.log(`[detectInputType] Input received: '${input}' (trimmed: '${trimmed}')`);

  // Handle empty or purely whitespace inputs
  if (trimmed === '') {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (empty trimmed)`);
    return 'invalid';
  }

  // Loosen minimum length requirement - allow shorter inputs like "lasagna", "pasta"
  if (trimmed.length < 3) {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (too short: ${trimmed.length} chars)`);
    return 'invalid';
  }

  // First, check if this looks like a URL - URLs should be validated by URL parsing, not letter ratio
  // Attempt to create a URL object. This is the most reliable way to validate a URL.
  // Prepend 'https://' if no protocol is present, to help the URL constructor.
  let potentialUrl = trimmed;
  if (!potentialUrl.match(/^https?:\/\//i)) {
      potentialUrl = 'https://' + potentialUrl;
  }

  try {
      const urlObj = new URL(potentialUrl);

      // A simple, yet effective, check for a valid domain:
      // - It must contain at least one dot in the hostname (e.g., example.com)
      // - All parts separated by dots must have some length (e.g., not 'a..b')
      // This helps filter out hostnames like 'invalid' or 'localhost' from being treated as remote URLs.
      if (urlObj.hostname.includes('.') && urlObj.hostname.split('.').every(part => part.length > 0)) {
          // Check if this is a video URL from supported platforms
          const videoPatterns = [
            /^(www\.)?(youtube\.com|youtu\.be)/i,
            /^(www\.)?(instagram\.com)/i,
            /^(www\.)?(tiktok\.com)/i
          ];
          
          const isVideoUrl = videoPatterns.some(pattern => pattern.test(urlObj.hostname));
          
          if (isVideoUrl) {
              console.log(`[detectInputType] Classification result: 'video' for input: '${input}' (video URL detected)`);
              return 'video';
          } else {
              console.log(`[detectInputType] Classification result: 'url' for input: '${input}' (valid URL with proper domain)`);
              return 'url';
          }
      } else {
          // If it has a protocol but the hostname doesn't look like a valid FQDN
          // (e.g., "https://invalid", "http://mylocalhost"), treat it as raw_text since it's likely a recipe name
          console.log(`[detectInputType] URL hostname "${urlObj.hostname}" does not look like a valid domain. Classifying as 'raw_text'.`);
          console.log(`[detectInputType] Classification result: 'raw_text' for input: '${input}' (invalid domain, likely recipe name)`);
          return 'raw_text';
      }
  } catch (e) {
      // If the URL constructor throws an error, the string is not a valid URL.
      // Now check if it's valid text using letter ratio
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log(`[detectInputType] URL parsing failed for input '${trimmed}': ${errorMessage}. Checking letter ratio for text classification.`);
  }

  // If it's not a valid URL, apply letter ratio check for text inputs
  // This allows inputs like "lasagna", "pasta", "curry", "7-layer dip" while rejecting pure numbers
  const letterRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
  if (letterRatio < 0.65) {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (insufficient letters: ${letterRatio})`);
    return 'invalid';
  }

  // If it passed the letter ratio test but isn't a URL, it's raw text
  console.log(`[detectInputType] Classification result: 'raw_text' for input: '${input}' (valid text, letter ratio: ${letterRatio})`);
  return 'raw_text';
} 