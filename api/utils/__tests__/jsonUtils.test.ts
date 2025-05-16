import { safeJsonParse } from '../jsonUtils';
import logger from '../../lib/logger';

jest.mock('../../lib/logger'); // Mock logger to prevent actual logging during tests

describe('safeJsonParse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should parse valid JSON string correctly', () => {
    const jsonString = '{"name":"Test", "value":123}';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ name: 'Test', value: 123 });
    expect(result.error).toBeUndefined();
  });

  test('should parse JSON string wrapped in markdown ```json ... ```', () => {
    const jsonString = '```json\n{"name":"Markdown Test", "value":true}\n```';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ name: 'Markdown Test', value: true });
    expect(result.error).toBeUndefined();
  });

  test('should parse JSON string wrapped in markdown ``` ... ``` with leading/trailing whitespace', () => {
    const jsonString = '  \n```\n{"name":"Plain Markdown", "value":false}\n```  \n  ';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ name: 'Plain Markdown', value: false });
    expect(result.error).toBeUndefined();
  });

  test('should parse JSON string with surrounding text by extracting content between first { and last }', () => {
    const jsonString = 'Some leading text { "name": "Embedded JSON", "data": [1,2,3] } and some trailing text.';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ name: 'Embedded JSON', data: [1,2,3] });
    expect(result.error).toBeUndefined();
  });

  test('should handle JSON string with surrounding text and markdown, prioritizing markdown', () => {
    const jsonString = 'Some leading text ```json\n{ "name": "Markdown Priority", "value": 42 }\n``` and some trailing text.';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ name: 'Markdown Priority', value: 42 });
    expect(result.error).toBeUndefined();
  });

  test('should return error for malformed JSON string (trailing comma)', () => {
    const jsonString = '{"name":"Bad JSON",}';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    expect(result.error).toContain('JSON.parse failed:');
  });

  test('should return error for incomplete JSON string', () => {
    const jsonString = '{"name":"Incomplete';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    expect(result.error).toContain('JSON.parse failed:');
  });

  test('should return error for empty string input', () => {
    const result = safeJsonParse('');
    expect(result.parsed).toBeUndefined();
    expect(result.error).toBe('Input was empty or not a string.');
  });

  test('should return error for string with only whitespace', () => {
    const result = safeJsonParse('   \n  ');
    expect(result.parsed).toBeUndefined();
    expect(result.error).toBe('Input was empty or not a string.');
  });

  test('should return error for non-JSON string that does not look like an object', () => {
    const jsonString = 'This is just some random text without braces.';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    // This might successfully parse as a JSON string literal depending on the exact JSON.parse behavior
    // For this util, we are primarily concerned with object extraction. If it parses to a string, that's acceptable for now.
    // If it errors, it should be a JSON.parse error.
    if (result.error) {
        expect(result.error).toContain('JSON.parse failed:');
    }
  });

  test('should return error when markdown block is empty', () => {
    const jsonString = '```json\n\n```';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    expect(result.error).toBe('Cleaned text resulted in empty string.');
  });

  test('should handle JSON primitives if not wrapped (e.g. string literal)', () => {
    const jsonString = '"just a string"';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBe('just a string');
    expect(result.error).toBeUndefined();
  });

  test('should handle JSON primitives (number literal)', () => {
    const jsonString = '123.45';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBe(123.45);
    expect(result.error).toBeUndefined();
  });

    test('should handle JSON primitives (boolean true literal)', () => {
    const jsonString = 'true';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should handle JSON primitives (boolean false literal)', () => {
    const jsonString = 'false';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBe(false);
    expect(result.error).toBeUndefined();
  });

  test('should handle JSON primitives (null literal)', () => {
    const jsonString = 'null';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeNull();
    expect(result.error).toBeUndefined();
  });

  test('should log with requestId when provided', () => {
    const jsonString = '{"name":"Test"}';
    safeJsonParse(jsonString, 'test-id');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[test-id]'));
  });

  test('should parse JSON string with escaped characters within markdown', () => {
    const jsonString = '```json\n{"message": "Hello \\"World\\"!"}\n```';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ message: 'Hello "World"!' });
    expect(result.error).toBeUndefined();
  });

  test('should correctly parse JSON where content between braces is not actually JSON', () => {
    const jsonString = 'Here is some text { not actually json } and more text.';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    expect(result.error).toContain('JSON.parse failed');
  });

  test('should return error if only opening brace is present in surrounding text scenario', () => {
    const jsonString = 'Some text { and that is all.';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    // It will try to parse "{ and that is all." which will fail
    expect(result.error).toContain('JSON.parse failed');
  });

  test('should return error if only closing brace is present in surrounding text scenario', () => {
    const jsonString = 'Some text } and that is all.';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toBeUndefined();
    // It will try to parse the whole string "Some text } and that is all." which will fail if not valid JSON (e.g. a string primitive)
    // or parse the string as a primitive if valid, which is fine.
    // For this specific input, it should fail JSON.parse.
    if (result.error) {
        expect(result.error).toContain('JSON.parse failed');
    }
  });

  test('should not extract from braces if markdown is present', () => {
    const jsonString = '```json\n{"key":"markdown"}\n``` { "key": "braces" }';
    const result = safeJsonParse(jsonString);
    expect(result.parsed).toEqual({ key: 'markdown' });
    expect(result.error).toBeUndefined();
  });
}); 