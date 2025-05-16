import { parseRawTextWithGemini } from '../promptText';
import { GeminiModel, GeminiHandlerResponse, CombinedParsedRecipe } from '../../types';
import logger from '../../lib/logger'; // Assuming logger might be used, or for consistency

// Mock dependencies
jest.mock('../../lib/logger'); // Mock logger

// Define a mock GeminiModel
const mockGeminiModel = {
  generateContent: jest.fn(),
} as unknown as jest.Mocked<GeminiModel>; // Cast through unknown

// Helper to log outputs for manual inspection
const logTestInfo = (label: string, response: GeminiHandlerResponse, mockGeminiResponseText?: string, preparedTextPreview?: string) => {
  console.log(`\n--- Test Case: ${label} ---`);
  if (preparedTextPreview) {
    console.log(`Input PreparedText Preview: ${preparedTextPreview}`);
  }
  console.log('Expected Logs to check for (from promptText.ts):');
  console.log('  - [requestId] Starting Gemini parsing for raw text input.');
  console.log('  - [requestId] Input preparedText length: ...');
  console.log('  - [requestId] Input preparedText preview (first 500 chars): ...');
  console.log('  - [requestId] Prepared text for Gemini: textLength=...');
  console.log('  - [requestId] Gemini prompt preview (excluding full text): ...');
  console.log('  - [requestId] Sending Gemini request (prompt length: ...).');
  if (mockGeminiResponseText !== undefined) {
    console.log(`  - Mocked Gemini Raw Response Text (preview): ${mockGeminiResponseText.substring(0,300)}${mockGeminiResponseText.length > 300 ? '...' : ''}`);
  }
  console.log('  - [requestId] Gemini (Raw Text Parse) raw response length: ...');
  console.log('  - [requestId] Gemini response preview: ...');
  console.log('  - [requestId] Cleaned Gemini response text... (if applicable)');
  console.log('  - [requestId] Successfully parsed Gemini output. OR JSON parse failed: ...');
  console.log('  - [requestId] Final parsed recipe object (Raw Text): ... (or preview)');
  console.log('\nActual GeminiHandlerResponse:');
  console.log(JSON.stringify(response, null, 2));
  console.log('--- End Test Case ---\n');
};

describe('parseRawTextWithGemini', () => {
  const requestId = 'test-rawtext-req';
  let preparedText: string;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGeminiModel.generateContent as jest.Mock).mockReset();
    preparedText = 'Title: Test Recipe\nIngredients:\n1 cup flour\n1 egg\nSome salt to taste\nInstructions:\nMix ingredients thoroughly in a large bowl.\nBake at 350 degrees Fahrenheit until golden brown. This usually takes about 20-25 minutes.';
  });

  test('should handle successful parse of good Gemini JSON response', async () => {
    const goodJsonResponse: CombinedParsedRecipe = {
      title: 'Test Recipe from Gemini',
      ingredients: [{ name: 'flour', amount: '1', unit: 'cup', suggested_substitutions: null }],
      instructions: ['Mix well', 'Bake it'],
      recipeYield: '2 servings',
      prepTime: '10m', cookTime: '20m', totalTime: '30m',
      nutrition: null, substitutions_text: null
    };
    const geminiResponseText = JSON.stringify(goodJsonResponse);
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({
      response: {
        text: () => geminiResponseText,
        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25 },
      },
    });

    const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
    logTestInfo('RawText - Good Gemini JSON', result, geminiResponseText, preparedText.substring(0,100));

    expect(result.error).toBeNull();
    expect(result.recipe).toEqual(goodJsonResponse);
    expect(result.usage?.inputTokens).toBe(15);
    expect(result.usage?.outputTokens).toBe(25);
  });

  describe('Simulating Poor Gemini Responses', () => {
    test('Gemini returns valid JSON but semantically poor (e.g., only title)', async () => {
      const poorJsonResponse = { title: 'Only a Title', ingredients: null, instructions: null };
      const geminiResponseText = JSON.stringify(poorJsonResponse);
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => geminiResponseText, usageMetadata: {} } });
      
      const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
      logTestInfo('RawText - Semantically Poor JSON', result, geminiResponseText, preparedText.substring(0,100));

      expect(result.error).toBeNull();
      expect(result.recipe).toEqual(poorJsonResponse);
    });
  });

  describe('Simulating Malformed Gemini Output', () => {
    test('Gemini returns JSON wrapped in markdown with spaces', async () => {
      const markdownJson = '  ```json\n{"title": "Markdown Recipe Spaces"}\n```  ';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => markdownJson, usageMetadata: {} } });
      
      const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
      logTestInfo('RawText - Markdown-Wrapped JSON with Spaces', result, markdownJson, preparedText.substring(0,100));

      expect(result.error).toBeNull();
      expect(result.recipe).toEqual({ title: 'Markdown Recipe Spaces' });
    });

    test('Gemini returns JSON with trailing comma', async () => {
      const jsonWithTrailingComma = '{"title": "Raw Trailing Comma",}';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => jsonWithTrailingComma, usageMetadata: {} } });

      const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
      logTestInfo('RawText - JSON Trailing Comma', result, jsonWithTrailingComma, preparedText.substring(0,100));
      
      expect(result.error).toMatch(/Failed to parse Gemini response: .+/i);
      expect(result.recipe).toBeNull();
    });

    test('Gemini returns incomplete JSON', async () => {
      const incompleteJson = '{"title": "Raw Incomplete';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => incompleteJson, usageMetadata: {} } });

      const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
      logTestInfo('RawText - Incomplete JSON', result, incompleteJson, preparedText.substring(0,100));

      expect(result.error).toMatch(/Failed to parse Gemini response: .+/i);
      expect(result.recipe).toBeNull();
    });

    test('Gemini returns an empty string response', async () => {
      const emptyResponse = '';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => emptyResponse, usageMetadata: {} } });

      const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
      logTestInfo('RawText - Empty Gemini Response', result, emptyResponse, preparedText.substring(0,100));

      expect(result.error).toBe('Empty response from Gemini.');
      expect(result.recipe).toBeNull();
    });

    test('Gemini returns JSON with surrounding text', async () => {
      const jsonWithSurroundingText = 'Here is the recipe JSON:\n{"title": "Recipe with Padding"}\nHope you find this useful!';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => jsonWithSurroundingText, usageMetadata: {} } });
      
      const result = await parseRawTextWithGemini(preparedText, requestId, mockGeminiModel);
      logTestInfo('RawText - JSON with Surrounding Text', result, jsonWithSurroundingText, preparedText.substring(0,100));

      expect(result.error).toBeNull();
      expect(result.recipe).toEqual({ title: 'Recipe with Padding' });
    });
  });

  test('should return validation error for very short preparedText', async () => {
    const shortText = 'Too short.';
    const result = await parseRawTextWithGemini(shortText, requestId, mockGeminiModel);
    logTestInfo('RawText - Short Input Validation', result, undefined, shortText);

    expect(result.error).not.toBeNull();
    if (result.error) {
        expect(result.error).toContain('Input');
        expect(result.error).toMatch(/too short/i);
        expect(result.error).toMatch(/keywords/i);
    }
    expect(result.recipe).toBeNull();
    expect(mockGeminiModel.generateContent).not.toHaveBeenCalled();
    // Expected logs: "[requestId] Input validation failed..." or "Input flagged as likely garbage..."
  });
}); 