import { isProbablyUrl } from '../detectUrl';

describe('isProbablyUrl', () => {
  // Valid URLs
  test('should return true for valid http URL', () => {
    expect(isProbablyUrl('http://example.com')).toBe(true);
  });

  test('should return true for valid https URL', () => {
    expect(isProbablyUrl('https://www.example.com/path?query=value#fragment')).toBe(true);
  });

  test('should return true for URL without protocol but with www', () => {
    expect(isProbablyUrl('www.example.com')).toBe(true);
  });

  test('should return true for domain name only', () => {
    expect(isProbablyUrl('example.com')).toBe(true);
  });
  
   test('should return true for domain with path', () => {
    expect(isProbablyUrl('example.com/recipes/123')).toBe(true);
  });

  test('should return true for URL with IP address', () => {
    expect(isProbablyUrl('http://192.168.1.1/page')).toBe(true);
  });

  // Invalid Inputs / Raw Text
  test('should return false for plain text', () => {
    expect(isProbablyUrl('This is just some recipe text')).toBe(false);
  });

  test('should return false for text with newlines resembling a recipe', () => {
    const recipeText = `Ingredients:\n1 cup flour\n2 eggs\n\nInstructions:\nMix ingredients well.`;
    expect(isProbablyUrl(recipeText)).toBe(false);
  });

  test('should return false for text containing dots but not a URL structure', () => {
    expect(isProbablyUrl('Preheat oven to 350 degrees F. (175 degrees C.)')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(isProbablyUrl('')).toBe(false);
  });

  test('should return false for string with only whitespace', () => {
    expect(isProbablyUrl('   \n  ')).toBe(false);
  });

  // Edge cases based on current logic
  test('should return false for domain-like string with spaces', () => {
    expect(isProbablyUrl('example . com')).toBe(false); // Contains space
  });

  test('should return false for domain-like string with too many newlines', () => {
    expect(isProbablyUrl('example.com\n\n\n\n')).toBe(false); // > 3 newlines
  });

  test('should return true for domain-like string with allowed newlines', () => {
    expect(isProbablyUrl('\n example.com \n ')).toBe(true); // Allows surrounding whitespace/newlines
  });
}); 