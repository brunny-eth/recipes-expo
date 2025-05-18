export function stripMarkdownFences(text: string): string {
  // Check if the text actually contains markdown fences
  const  startsAndEndsWithFences = (text.startsWith("```json") || text.startsWith("```")) && text.endsWith("```");
  
  if (startsAndEndsWithFences) {
    console.log("Stripping markdown fences from text."); // Or use your preferred logger
    return text
      .replace(/^```json/, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();
  }
  // If no fences, or malformed, return original text to avoid breaking valid JSON
  return text;
} 