export function preprocessRawRecipeText(text: string): string {
  let processedText = text.trim();
  processedText = processedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  processedText = processedText.replace(/\n{3,}/g, '\n\n');
  return processedText;
} 