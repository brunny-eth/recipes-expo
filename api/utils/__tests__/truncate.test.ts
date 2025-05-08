import { truncateTextByLines } from '../truncate';

// Mock console.log before tests run
let consoleSpy: jest.SpyInstance;
beforeAll(() => {
  consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

// Restore console.log after tests finish
afterAll(() => {
  consoleSpy.mockRestore();
});

describe('truncateTextByLines', () => {
  const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

  test('should truncate text when lines exceed maxLines', () => {
    const maxLines = 3;
    const expected = 'Line 1\nLine 2\nLine 3\n\n[CONTENT TRUNCATED]';
    expect(truncateTextByLines(text, maxLines)).toBe(expected);
  });

  test('should not truncate text when lines are equal to maxLines', () => {
    const maxLines = 5;
    expect(truncateTextByLines(text, maxLines)).toBe(text);
  });

  test('should not truncate text when lines are less than maxLines', () => {
    const maxLines = 10;
    expect(truncateTextByLines(text, maxLines)).toBe(text);
  });

  test('should use custom marker when provided', () => {
    const maxLines = 2;
    const customMarker = '... [MORE] ...';
    const expected = `Line 1\nLine 2${customMarker}`;
    expect(truncateTextByLines(text, maxLines, customMarker)).toBe(expected);
  });

  test('should handle text with fewer lines than maxLines gracefully', () => {
    const shortText = 'Line A\nLine B';
    const maxLines = 5;
    expect(truncateTextByLines(shortText, maxLines)).toBe(shortText);
  });

  test('should return empty string for null input', () => {
    expect(truncateTextByLines(null, 5)).toBe('');
  });

  test('should return empty string for undefined input', () => {
    expect(truncateTextByLines(undefined, 5)).toBe('');
  });

  test('should return empty string for empty string input', () => {
    expect(truncateTextByLines('', 5)).toBe('');
  });

  test('should handle maxLines of 0 correctly', () => {
    const expected = '\n\n[CONTENT TRUNCATED]'; // Returns only the marker
    expect(truncateTextByLines(text, 0)).toBe(expected);
  });

  test('should handle text with trailing newlines correctly when truncating', () => {
    const textWithTrailing = 'Line 1\nLine 2\n\n';
    const maxLines = 1;
    const expected = 'Line 1\n\n[CONTENT TRUNCATED]';
    expect(truncateTextByLines(textWithTrailing, maxLines)).toBe(expected);
  });

   test('should handle text with trailing newlines correctly when not truncating', () => {
    const textWithTrailing = 'Line 1\nLine 2\n\n';
    const maxLines = 4;
    expect(truncateTextByLines(textWithTrailing, maxLines)).toBe(textWithTrailing);
  });
}); 