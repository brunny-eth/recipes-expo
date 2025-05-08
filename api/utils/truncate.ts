export function truncateTextByLines(text: string | null | undefined, maxLines: number, marker: string = "\n\n[CONTENT TRUNCATED]"): string {
  if (!text) {
    return '';
  }
  const lines = text.split('\n');
  if (lines.length > maxLines) {
    console.log(`Truncating text from ${lines.length} lines to ${maxLines} lines.`);
    return lines.slice(0, maxLines).join('\n') + marker;
  }
  return text;
} 