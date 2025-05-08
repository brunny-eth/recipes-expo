import { preprocessRawRecipeText } from '../preprocessText';

describe('preprocessRawRecipeText', () => {
  test('should trim leading and trailing whitespace', () => {
    const inputText = '  \n Recipe Text \t ';
    const expectedText = 'Recipe Text';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should normalize CRLF line breaks to LF', () => {
    const inputText = 'Line 1\r\nLine 2';
    const expectedText = 'Line 1\nLine 2';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should normalize CR line breaks to LF', () => {
    const inputText = 'Line 1\rLine 2';
    const expectedText = 'Line 1\nLine 2';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should keep existing LF line breaks', () => {
    const inputText = 'Line 1\nLine 2';
    const expectedText = 'Line 1\nLine 2';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should reduce 3 or more consecutive newlines to exactly 2', () => {
    const inputText = 'Line 1\n\n\nLine 2\n\n\n\n\nLine 3';
    const expectedText = 'Line 1\n\nLine 2\n\nLine 3';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should keep single and double newlines as they are', () => {
    const inputText = 'Line 1\nLine 2\n\nLine 3';
    const expectedText = 'Line 1\nLine 2\n\nLine 3';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should handle combined trimming, normalization, and blank line reduction', () => {
    const inputText = '  Start\r\n\n\n\nMiddle line\rEnd  \n ';
    const expectedText = 'Start\n\nMiddle line\nEnd';
    expect(preprocessRawRecipeText(inputText)).toBe(expectedText);
  });

  test('should return empty string for empty input', () => {
    expect(preprocessRawRecipeText('')).toBe('');
  });

  test('should return empty string for whitespace-only input', () => {
    expect(preprocessRawRecipeText('   \t\n  ')).toBe('');
  });
}); 