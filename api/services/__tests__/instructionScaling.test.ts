import { scaleInstructions } from '../instructionScaling';
import { GeminiModel } from '../../types'; // Assuming GeminiModel is from types
import logger from '../../lib/logger';

// Mock dependencies
jest.mock('../../lib/logger');

// Define a mock GeminiModel
const mockGeminiModel = {
  generateContent: jest.fn(),
} as unknown as jest.Mocked<GeminiModel>; // Cast through unknown

// Response type from scaleInstructions, simplified for test expectations
type ScaleInstructionResponse = {
  scaledInstructions: string[] | null;
  error: string | null;
  // usage and timeMs are also returned but might not be asserted in all tests
};

// Helper to log outputs
const logTestInfo = (label: string, response: ScaleInstructionResponse, mockGeminiResponseText?: string, inputDetails?: any) => {
  console.log(`\n--- Test Case: ${label} ---`);
  if (inputDetails) {
    console.log('Input Details:');
    console.log(JSON.stringify(inputDetails, null, 2));
  }
  console.log('Expected Logs to check for (from instructionScaling.ts):');
  console.log('  - logger.info with action: gemini_scale_instructions_input...');
  console.log('  - logger.info with action: gemini_scale_instructions_prompt...');
  if (mockGeminiResponseText !== undefined) {
    console.log(`  - Mocked Gemini Raw Response Text (preview): ${mockGeminiResponseText.substring(0,300)}${mockGeminiResponseText.length > 300 ? '...' : ''}`);
  }
  console.log('  - logger.info with action: gemini_scale_instructions_response_raw...');
  console.log('  - logger.info with action: gemini_scale_instructions_cleaned_response... (if applicable)');
  console.log('  - logger.info with action: gemini_scale_instructions (successful case)');
  console.log('  - logger.error with action: gemini_scale_instructions_parse_error... (on parse failure)');
  console.log('  - logger.info with action: gemini_scale_instructions_output...');
  console.log('\nActual Response:');
  console.log(JSON.stringify(response, null, 2));
  console.log('--- End Test Case ---\n');
};

describe('scaleInstructions', () => {
  let originalInstructions: string[];
  let originalIngredients: any[];
  let scaledIngredients: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGeminiModel.generateContent as jest.Mock).mockReset();

    originalInstructions = [
      'Preheat oven to 350 degrees F.',
      'Mix 1 cup flour and 0.5 cup sugar.',
      'Add 2 eggs.',
      'Bake for 30 minutes.'
    ];
    originalIngredients = [
      { name: 'flour', amount: '1', unit: 'cup' },
      { name: 'sugar', amount: '0.5', unit: 'cup' },
      { name: 'eggs', amount: '2', unit: '' }
    ];
    scaledIngredients = [
      { name: 'flour', amount: '2', unit: 'cup' },      // Doubled
      { name: 'sugar', amount: '0.25', unit: 'cup' }, // Halved
      { name: 'eggs', amount: '3', unit: '' }         // Increased
    ];
  });

  test('should correctly scale instructions with good Gemini JSON response', async () => {
    const expectedScaledInstructions = [
      'Preheat oven to 350 degrees F.',
      'Mix 2 cup flour and 0.25 cup sugar.', // flour and sugar amounts changed
      'Add 3 eggs.', // eggs changed
      'Bake for 30 minutes.'
    ];
    const geminiResponse = { scaledInstructions: expectedScaledInstructions };
    const geminiResponseText = JSON.stringify(geminiResponse);
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({
      response: { text: () => geminiResponseText, usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 40 } },
    });

    const result = await scaleInstructions(originalInstructions, originalIngredients, scaledIngredients, mockGeminiModel);
    logTestInfo('Scaling - Good Gemini JSON', result, geminiResponseText, { originalInstructions, originalIngredients, scaledIngredients });

    expect(result.error).toBeNull();
    expect(result.scaledInstructions).toEqual(expectedScaledInstructions);
    expect(result.usage?.promptTokens).toBe(30);
    expect(result.usage?.outputTokens).toBe(40);
  });

  test('Gemini returns valid JSON but semantically poor (e.g., no changes)', async () => {
    const geminiResponse = { scaledInstructions: originalInstructions }; // No actual scaling
    const geminiResponseText = JSON.stringify(geminiResponse);
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => geminiResponseText, usageMetadata: {} } });

    const result = await scaleInstructions(originalInstructions, originalIngredients, scaledIngredients, mockGeminiModel);
    logTestInfo('Scaling - Semantically Poor JSON (no changes)', result, geminiResponseText);

    expect(result.error).toBeNull();
    expect(result.scaledInstructions).toEqual(originalInstructions);
  });

  test('Gemini returns JSON wrapped in markdown', async () => {
    const markdownJson = '```json\n{ "scaledInstructions": ["Step 1 scaled"] }\n```';
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => markdownJson, usageMetadata: {} } });

    const result = await scaleInstructions(originalInstructions, originalIngredients, scaledIngredients, mockGeminiModel);
    logTestInfo('Scaling - Markdown-Wrapped JSON', result, markdownJson);

    expect(result.error).toBeNull();
    expect(result.scaledInstructions).toEqual(['Step 1 scaled']);
  });

  test('Gemini returns malformed JSON (e.g. missing scaledInstructions field)', async () => {
    const malformedJson = '{"wrongField": ["data"]}';
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => malformedJson, usageMetadata: {} } });

    const result = await scaleInstructions(originalInstructions, originalIngredients, scaledIngredients, mockGeminiModel);
    logTestInfo('Scaling - Malformed JSON (missing field)', result, malformedJson);
    
    expect(result.error).toBe('Invalid JSON format received from AI instruction scaler.');
    expect(result.scaledInstructions).toBeNull();
  });

  test('Gemini returns incomplete JSON', async () => {
    const incompleteJson = '{"scaledInstructions": ["Step 1" '; // Missing closing bracket and brace
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => incompleteJson, usageMetadata: {} } });
    
    const result = await scaleInstructions(originalInstructions, originalIngredients, scaledIngredients, mockGeminiModel);
    logTestInfo('Scaling - Incomplete JSON', result, incompleteJson);

    expect(result.error).toBe('Invalid JSON format received from AI instruction scaler.');
    expect(result.scaledInstructions).toBeNull();
  });

  test('Gemini returns an empty string response', async () => {
    const emptyResponse = '';
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => emptyResponse, usageMetadata: {} } });

    const result = await scaleInstructions(originalInstructions, originalIngredients, scaledIngredients, mockGeminiModel);
    logTestInfo('Scaling - Empty Gemini Response', result, emptyResponse);

    expect(result.error).toBe('Empty response received from AI instruction scaler.');
    expect(result.scaledInstructions).toBeNull();
  });
}); 