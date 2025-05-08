export function isProbablyUrl(input: string): boolean {
  // Trim leading/trailing whitespace (spaces, tabs, etc.) but keep internal newlines for now
  const trimmed = input.trim();

  const httpPattern = /^https?:\/\//i;
  if (httpPattern.test(trimmed)) {
    return true;
  }
  // Regex for a domain check - should match the core part even if newlines exist *after* it
  // This pattern tries to match the URL structure on the trimmed string
  const domainPattern = /^[^\s\/$.?#].[^\s]*\.[a-zA-Z]{2,}(\/[\w.-]*)*\/?(\?[\w%.-]+=[\w%.-]+(&[\w%.-]+=[\w%.-]+)*)?(#\w*)?$/;

  // Test the pattern on the trimmed version (to ignore leading/trailing spaces but catch internal invalid chars)
  if (domainPattern.test(trimmed)) {
    // If the pattern matches the trimmed string, THEN check line count on the ORIGINAL input
    if (input.split('\n').length <= 3) {
      return true;
    }
  }
  // If it doesn't look like a URL or has too many lines
  return false;
} 