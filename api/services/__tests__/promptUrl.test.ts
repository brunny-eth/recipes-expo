import { parseUrlContentWithGemini } from '../promptUrl';
import { ExtractedContent } from '../extractContent';
import { GeminiModel, GeminiHandlerResponse } from '../../types';
import logger from '../../lib/logger'; // Assuming logger is used

// Mock dependencies
jest.mock('../extractContent'); // We don't need to test extractContent here
jest.mock('../../lib/logger'); // Mock logger to spy or suppress

// Define a mock GeminiModel - casting a partial mock
const mockGeminiModel = {
  generateContent: jest.fn(),
} as unknown as jest.Mocked<GeminiModel>; // Cast through unknown

// Helper to log outputs for manual inspection
const logTestInfo = (label: string, response: GeminiHandlerResponse, mockGeminiResponseText?: string) => {
  console.log(`\n--- Test Case: ${label} ---`);
  console.log('Expected Logs to check for (from promptUrl.ts):');
  console.log('  - [requestId] Starting Gemini parsing...');
  console.log('  - [requestId] Initial extracted content lengths...');
  console.log('  - [requestId] Fallback/Standard extraction detected...');
  console.log('  - [requestId] Prepared text for Gemini: ingredients=..., instructions=...');
  console.log('  - [DEBUG promptUrl] Gemini Prompt for requestId (first 1000 chars):...');
  console.log('  - [requestId] Sending combined parsing request to Gemini...');
  if (mockGeminiResponseText !== undefined) {
    console.log(`  - Mocked Gemini Raw Response Text (preview): ${mockGeminiResponseText.substring(0,300)}${mockGeminiResponseText.length > 300 ? '...' : ''}`);
  }
  console.log('  - [requestId] Gemini (URL Parse) raw response length: ...');
  console.log('  - [requestId] Gemini (URL Parse) raw JSON response preview: ...');
  console.log('  - [requestId] Cleaned Gemini response text... (if applicable)');
  console.log('  - [requestId] Successfully parsed combined JSON... OR Failed to parse JSON response...');
  console.log('  - Logs from logger.info about the final parsed object (or preview).');
  console.log('\nActual GeminiHandlerResponse:');
  console.log(JSON.stringify(response, null, 2));
  console.log('--- End Test Case ---\n');
};

describe('parseUrlContentWithGemini', () => {
  const requestId = 'test-url-req';
  let mockExtractedContent: ExtractedContent;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation before each test if necessary
    (mockGeminiModel.generateContent as jest.Mock).mockReset();

    mockExtractedContent = {
      title: 'Test Recipe',
      ingredientsText: '1 cup flour\n1 egg',
      instructionsText: 'Mix\nBake',
      recipeYieldText: '2 servings',
      isFallback: false,
      prepTime: '10 min',
      cookTime: '20 min',
      totalTime: '30 min',
    };
  });

  test('should handle successful parse of good Gemini JSON response', async () => {
    const goodJsonResponse = {
      title: 'Test Recipe from Gemini',
      ingredients: [{ name: 'flour', amount: '1', unit: 'cup' }],
      instructions: ['Mix well', 'Bake it'],
      recipeYield: '2 servings',
      prepTime: '10m', cookTime: '20m', totalTime: '30m',
      nutrition: null, substitutions_text: null
    };
    const geminiResponseText = JSON.stringify(goodJsonResponse);
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({
      response: {
        text: () => geminiResponseText,
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      },
    });

    const result = await parseUrlContentWithGemini(mockExtractedContent, requestId, mockGeminiModel);
    logTestInfo('URL - Good Gemini JSON', result, geminiResponseText);

    expect(result.error).toBeNull();
    expect(result.recipe).toEqual(goodJsonResponse);
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(20);
    // Expected logs: successful parse, final object logged.
  });

  describe('Simulating Poor Gemini Responses', () => {
    test('Gemini returns valid JSON but semantically poor (e.g., empty instructions)', async () => {
      const poorJsonResponse = { title: 'Test Recipe', ingredients: [], instructions: [] };
      const geminiResponseText = JSON.stringify(poorJsonResponse);
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => geminiResponseText, usageMetadata: {} } });
      
      const result = await parseUrlContentWithGemini(mockExtractedContent, requestId, mockGeminiModel);
      logTestInfo('URL - Semantically Poor JSON', result, geminiResponseText);

      expect(result.error).toBeNull(); // It's valid JSON
      expect(result.recipe).toEqual(poorJsonResponse);
      // Expected logs: successful parse, but the final logged object will show the empty arrays.
    });
  });

  describe('Simulating Malformed Gemini Output', () => {
    test('Gemini returns JSON wrapped in markdown', async () => {
      const markdownJson = '```json\n{"title": "Markdown Recipe"}\n```';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => markdownJson, usageMetadata: {} } });
      
      const result = await parseUrlContentWithGemini(mockExtractedContent, requestId, mockGeminiModel);
      logTestInfo('URL - Markdown-Wrapped JSON', result, markdownJson);

      expect(result.error).toBeNull();
      expect(result.recipe).toEqual({ title: 'Markdown Recipe' });
      // Expected logs: "Cleaned Gemini response text...", successful parse.
    });

    test('Gemini returns JSON with a trailing comma', async () => {
      const jsonWithTrailingComma = '{"title": "Trailing Comma Recipe",}';
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => jsonWithTrailingComma, usageMetadata: {} } });

      const result = await parseUrlContentWithGemini(mockExtractedContent, requestId, mockGeminiModel);
      logTestInfo('URL - JSON Trailing Comma', result, jsonWithTrailingComma);
      
      expect(result.error).toMatch(/Invalid JSON|Unexpected token , in JSON|Unexpected non-whitespace character after JSON data/i);
      expect(result.recipe).toBeNull();
      // Expected logs: "Failed to parse JSON...", raw response logged.
    });

    test('Gemini returns incomplete JSON', async () => {
      const incompleteJson = '{"title": "Incomplete Recipe"'; // Missing closing brace and quote
      (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => incompleteJson, usageMetadata: {} } });

      const result = await parseUrlContentWithGemini(mockExtractedContent, requestId, mockGeminiModel);
      logTestInfo('URL - Incomplete JSON', result, incompleteJson);

      expect(result.error).toContain('Invalid JSON received from AI parser for URL');
      expect(result.recipe).toBeNull();
      // Expected logs: "Failed to parse JSON...", raw response logged.
    });

    test('Gemini returns an empty string', async () => {
        const emptyResponse = '';
        (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => emptyResponse, usageMetadata: {} } });
  
        const result = await parseUrlContentWithGemini(mockExtractedContent, requestId, mockGeminiModel);
        logTestInfo('URL - Empty Gemini Response', result, emptyResponse);
  
        expect(result.error).toBe('Empty response received from AI parser for URL.');
        expect(result.recipe).toBeNull();
        // Expected logs: "Empty response text from Gemini..."
      });
  });
}); 