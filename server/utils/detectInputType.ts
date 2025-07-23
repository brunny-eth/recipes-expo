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

  // Handle inputs that are too short to be meaningful (e.g., single characters, or "a.b")
  // You might adjust the length based on your minimum meaningful text input.
  if (trimmed.length < 5) {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (too short: ${trimmed.length} chars)`);
    return 'invalid';
  }

  // Handle inputs that are only special characters or non-alphanumeric
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (no alphanumeric chars)`);
    return 'invalid';
  }

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
          // (e.g., "https://invalid", "http://mylocalhost"), treat it as invalid for parsing.
          console.log(`[detectInputType] URL hostname "${urlObj.hostname}" does not look like a valid domain. Classifying as 'invalid'.`);
          console.log(`[detectInputType] Classification result: 'invalid' for input: '${input}' (invalid domain)`);
          return 'invalid';
      }
  } catch (e) {
      // If the URL constructor throws an error, the string is not a valid URL.
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log(`[detectInputType] URL parsing failed for input '${trimmed}': ${errorMessage}. Classifying as 'raw_text'.`);
      console.log(`[detectInputType] Classification result: 'raw_text' for input: '${input}' (URL parsing failed)`);
      return 'raw_text';
  }

  // If it didn't pass as a URL, and already passed basic text checks, classify as raw_text.
  // This part of the code is only reached if the input is definitely not a URL and is not invalid
  // according to the initial checks (length, alphanumeric content).
  // Note: This line should never be reached due to the URL constructor logic above, but kept for safety.
  console.log(`[detectInputType] Classification result: 'raw_text' for input: '${input}' (fallback)`);
  return 'raw_text';
} 