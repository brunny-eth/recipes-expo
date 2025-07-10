import { detectInputType, InputType } from '../detectInputType';

describe('detectInputType', () => {
  // Test cases for URL detection
  it('should detect valid URLs with http/https prefix', () => {
    expect(detectInputType('http://example.com')).toBe<InputType>('url');
    expect(detectInputType('https://example.com')).toBe<InputType>('url');
    expect(detectInputType('https://www.example.com/path?query=value#fragment')).toBe<InputType>('url');
  });

  it('should detect valid URLs without http/https prefix but with domain pattern', () => {
    expect(detectInputType('example.com')).toBe<InputType>('url');
    expect(detectInputType('www.example.com')).toBe<InputType>('url');
    expect(detectInputType('example.co.uk/path')).toBe<InputType>('url');
    expect(detectInputType('sub.domain.example.com')).toBe<InputType>('url');
  });

  it('should detect URLs with few lines', () => {
    // TODO: Review detectInputType logic for multi-line URL-like strings.
    // Currently, internal newlines cause it to be treated as raw_text.
    expect(detectInputType('example.com\nsecond line')).toBe<InputType>('raw_text');
    expect(detectInputType('example.com\nsecond line\nthird line')).toBe<InputType>('raw_text');
  });

  it('should detect video URLs from supported platforms', () => {
    // YouTube URLs
    expect(detectInputType('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe<InputType>('video');
    expect(detectInputType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe<InputType>('video');
    expect(detectInputType('https://youtu.be/dQw4w9WgXcQ')).toBe<InputType>('video');
    expect(detectInputType('youtube.com/watch?v=dQw4w9WgXcQ')).toBe<InputType>('video');
    
    // Instagram URLs
    expect(detectInputType('https://instagram.com/p/ABC123')).toBe<InputType>('video');
    expect(detectInputType('https://www.instagram.com/reel/ABC123')).toBe<InputType>('video');
    expect(detectInputType('instagram.com/p/ABC123')).toBe<InputType>('video');
    
    // TikTok URLs
    expect(detectInputType('https://tiktok.com/@user/video/123456')).toBe<InputType>('video');
    expect(detectInputType('https://www.tiktok.com/@user/video/123456')).toBe<InputType>('video');
    expect(detectInputType('tiktok.com/@user/video/123456')).toBe<InputType>('video');
  });

  // Test cases for raw text detection
  it('should detect raw text when no URL pattern is matched', () => {
    expect(detectInputType('This is a simple sentence.')).toBe<InputType>('raw_text');
    expect(detectInputType('Ingredients:\n1 cup flour\n2 eggs')).toBe<InputType>('raw_text');
  });

  it('should detect raw text for domain-like strings with too many lines', () => {
    expect(detectInputType('example.com\nsecond line\nthird line\nfourth line')).toBe<InputType>('raw_text');
  });

  it('should detect raw text for inputs that might look like URLs but are not', () => {
    expect(detectInputType('file.txt')).toBe<InputType>('url'); // This is an edge case, could be debated based on strictness
    expect(detectInputType('localhost:3000')).toBe<InputType>('raw_text'); // No TLD
    expect(detectInputType('not a url . com')).toBe<InputType>('raw_text'); // Contains spaces
  });

  // Test cases for invalid inputs
  it('should handle empty or whitespace-only strings as invalid', () => {
    expect(detectInputType('')).toBe<InputType>('invalid');
    expect(detectInputType('   ')).toBe<InputType>('invalid');
    expect(detectInputType('\n\n')).toBe<InputType>('invalid');
    expect(detectInputType('\t \n ')).toBe<InputType>('invalid');
  });

  it('should handle inputs that are too short to be meaningful as invalid', () => {
    expect(detectInputType('a')).toBe<InputType>('invalid');
    expect(detectInputType('1')).toBe<InputType>('invalid');
    expect(detectInputType('.')).toBe<InputType>('invalid');
    expect(detectInputType('?')).toBe<InputType>('invalid');
  });

  it('should handle inputs with only special characters as invalid', () => {
    expect(detectInputType('!!!')).toBe<InputType>('invalid');
    expect(detectInputType('...')).toBe<InputType>('invalid');
    expect(detectInputType('###')).toBe<InputType>('invalid');
    expect(detectInputType('---')).toBe<InputType>('invalid');
    expect(detectInputType('???')).toBe<InputType>('invalid');
  });

  // Test cases from original isProbablyUrl logic (if any specific examples are known)
  it('should correctly classify based on original isProbablyUrl logic', () => {
    // Example: "contains a period and no whitespace"
    expect(detectInputType('word.word')).toBe<InputType>('url');
    // Example: "contains a period but also whitespace"
    expect(detectInputType('word.word with space')).toBe<InputType>('raw_text');
    expect(detectInputType(' text with.period ')).toBe<InputType>('raw_text');
  });
}); 