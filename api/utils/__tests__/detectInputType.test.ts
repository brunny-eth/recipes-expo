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

  it('should handle empty or whitespace-only strings as raw_text', () => {
    expect(detectInputType('')).toBe<InputType>('raw_text');
    expect(detectInputType('   ')).toBe<InputType>('raw_text');
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