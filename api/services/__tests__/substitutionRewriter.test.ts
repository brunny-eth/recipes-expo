import { rewriteForSubstitution } from '../substitutionRewriter';
import { GeminiModel } from '../../types'; // Assuming GeminiModel is from types
import logger from '../../lib/logger';
import { formatMeasurement } from '../../../utils/format'; // Actual import from the service file

// Mock dependencies
jest.mock('../../lib/logger');
// jest.mock('../../../utils/format'); // Only mock if its internal logic is complex and not part of what we test here
                                      // For now, assume formatMeasurement is simple and let it run.

// Define a mock GeminiModel
const mockGeminiModel = {
  generateContent: jest.fn(),
} as unknown as jest.Mocked<GeminiModel>; // Cast through unknown

// Response type from rewriteForSubstitution, simplified
type RewriteResponse = {
  rewrittenInstructions: string[] | null;
  error: string | null;
};

// Helper to log outputs
const logTestInfo = (label: string, response: RewriteResponse, mockGeminiResponseText?: string, inputDetails?: any) => {
  console.log(`\n--- Test Case: ${label} ---`);
  if (inputDetails) {
    console.log('Input Details:');
    console.log(JSON.stringify(inputDetails, null, 2));
  }
  console.log('Expected Logs to check for (from substitutionRewriter.ts):');
  console.log('  - logger.info with action: gemini_rewrite_substitution_input...');
  console.log('  - logger.info with action: gemini_rewrite_substitution_prompt...');
  if (mockGeminiResponseText !== undefined) {
    console.log(`  - Mocked Gemini Raw Response Text (preview): ${mockGeminiResponseText.substring(0,300)}${mockGeminiResponseText.length > 300 ? '...' : ''}`);
  }
  console.log('  - logger.info with action: gemini_rewrite_substitution_response_raw...');
  console.log('  - logger.info with action: gemini_rewrite_substitution_cleaned_response... (if applicable)');
  console.log('  - logger.info with action: gemini_rewrite_substitution (successful case)');
  console.log('  - logger.error with action: gemini_rewrite_substitution_parse_error... (on parse failure)');
  console.log('  - logger.info with action: gemini_rewrite_substitution_output...');
  console.log('\nActual Response:');
  console.log(JSON.stringify(response, null, 2));
  console.log('--- End Test Case ---\n');
};

describe('rewriteForSubstitution', () => {
  let originalInstructions: string[];
  let originalIngredientName: string;
  let substitutedIngredientName: string;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGeminiModel.generateContent as jest.Mock).mockReset();

    originalInstructions = [
      'Dice the chicken breast.',
      'Cook chicken until golden brown.',
      'Serve with rice.'
    ];
    originalIngredientName = 'chicken breast';
    substitutedIngredientName = 'tofu'; // This will be passed to formatMeasurement
  });

  test('should correctly rewrite instructions with good Gemini JSON response', async () => {
    const expectedRewrittenInstructions = [
      'Press and dice the tofu.', // Changed for tofu
      'Pan-fry tofu until golden brown.', // Adapted for tofu
      'Serve with rice.' // Unchanged
    ];
    const geminiResponse = { rewrittenInstructions: expectedRewrittenInstructions };
    const geminiResponseText = JSON.stringify(geminiResponse);
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({
      response: { text: () => geminiResponseText, usageMetadata: { promptTokenCount: 35, candidatesTokenCount: 45 } },
    });

    const result = await rewriteForSubstitution(originalInstructions, originalIngredientName, substitutedIngredientName, mockGeminiModel);
    logTestInfo('Rewrite - Good Gemini JSON', result, geminiResponseText, { originalInstructions, originalIngredientName, substitutedIngredientName });

    expect(result.error).toBeNull();
    expect(result.rewrittenInstructions).toEqual(expectedRewrittenInstructions);
    expect(result.usage?.promptTokens).toBe(35);
    expect(result.usage?.outputTokens).toBe(45);
  });

  test('Gemini returns JSON that indicates no changes needed (original instructions)', async () => {
    const geminiResponse = { rewrittenInstructions: originalInstructions }; // No actual rewrite
    const geminiResponseText = JSON.stringify(geminiResponse);
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => geminiResponseText, usageMetadata: {} } });

    const result = await rewriteForSubstitution(originalInstructions, originalIngredientName, substitutedIngredientName, mockGeminiModel);
    logTestInfo('Rewrite - Semantically Poor JSON (no changes)', result, geminiResponseText);

    expect(result.error).toBeNull();
    expect(result.rewrittenInstructions).toEqual(originalInstructions);
  });

  test('Gemini returns JSON wrapped in markdown', async () => {
    const markdownJson = '```json\n{ "rewrittenInstructions": ["Rewritten step 1"] }\n```';
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => markdownJson, usageMetadata: {} } });

    const result = await rewriteForSubstitution(originalInstructions, originalIngredientName, substitutedIngredientName, mockGeminiModel);
    logTestInfo('Rewrite - Markdown-Wrapped JSON', result, markdownJson);

    expect(result.error).toBeNull();
    expect(result.rewrittenInstructions).toEqual(['Rewritten step 1']);
  });

  test('Gemini returns malformed JSON (e.g. missing rewrittenInstructions field)', async () => {
    const malformedJson = '{"unexpectedField": []}';
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => malformedJson, usageMetadata: {} } });

    // This service re-throws the error on parse failure
    await expect(rewriteForSubstitution(originalInstructions, originalIngredientName, substitutedIngredientName, mockGeminiModel))
      .rejects.toThrow('Parsed JSON result did not have the expected structure.');
    
    // To use logTestInfo, we'd need to catch and pass, or adjust logTestInfo for thrown errors.
    // For now, just verifying the throw and expected logs via manual inspection is okay.
    console.log('\n--- Test Case: Rewrite - Malformed JSON (missing field) --- Expected Throw ---');
    console.log('Expected Logs to check for (from substitutionRewriter.ts):');
    console.log('  - logger.error with action: gemini_rewrite_substitution_parse_error...');
    console.log(`  - Contained responseText: ${malformedJson}`);
    console.log('--- End Test Case ---\n');
  });

  test('Gemini returns incomplete JSON, causing parse error', async () => {
    const incompleteJson = '{"rewrittenInstructions": ["Step A" '; // Missing closing bracket and brace
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => incompleteJson, usageMetadata: {} } });

    await expect(rewriteForSubstitution(originalInstructions, originalIngredientName, substitutedIngredientName, mockGeminiModel))
      .rejects.toThrow(); // General JSON parse error
      
    console.log('\n--- Test Case: Rewrite - Incomplete JSON --- Expected Throw ---');
    console.log('Expected Logs to check for (from substitutionRewriter.ts):');
    console.log('  - logger.error with action: gemini_rewrite_substitution_parse_error...');
    console.log(`  - Contained responseText: ${incompleteJson}`);
    console.log('--- End Test Case ---\n');
  });

  test('Gemini returns an empty string response', async () => {
    const emptyResponse = '';
    (mockGeminiModel.generateContent as jest.Mock).mockResolvedValue({ response: { text: () => emptyResponse, usageMetadata: {} } });

    const result = await rewriteForSubstitution(originalInstructions, originalIngredientName, substitutedIngredientName, mockGeminiModel);
    logTestInfo('Rewrite - Empty Gemini Response', result, emptyResponse);

    expect(result.error).toBe('Empty response received from AI instruction rewriter.');
    expect(result.rewrittenInstructions).toBeNull();
  });
}); 