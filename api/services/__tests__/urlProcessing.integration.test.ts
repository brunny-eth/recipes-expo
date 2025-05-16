import fs from 'fs';
import path from 'path';
import { extractRecipeContent, ExtractedContent } from '../extractContent';
import { parseUrlContentWithGemini } from '../promptUrl';
import { safeJsonParse } from '../../utils/jsonUtils';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Import the actual base class for typing mocks
import { GeminiModel } from '../../types'; // Corrected path to api/types.ts

// Mock @google/generative-ai
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
  // Mock other exports from @google/generative-ai if needed by other parts of the code, e.g., HarmCategory
  HarmCategory: {
    HARM_CATEGORY_UNSPECIFIED: 'HARM_CATEGORY_UNSPECIFIED',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 'BLOCK_NONE',
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
  },
}));

const fixturesDir = path.join(__dirname, 'fixtures');
const fixtureFiles = [
  'allrecipes_judys_strawberry_pretzel_salad.html',
  'halfbakedharvest_dijon_salmon_panko_potatoes.html',
  'chimichurri-chickpeas.html',
  'crispy-pepperoni-dip.html',
  'dill-pickle-potato-salad.html',
  'kataifi-wrapped-feta.html',
  'tomato-sauce.html',
];

describe('URL Processing Integration Test Harness', () => {
  let mockModelInstance: GeminiModel; // This will be our doubly-mocked instance

  beforeEach(() => {
    // Reset mock implementations and calls
    (GoogleGenerativeAI as jest.Mock).mockClear();
    mockGetGenerativeModel.mockClear();
    mockGenerateContent.mockClear();

    // Setup the mock model instance that will be passed to the function
    // The actual GoogleGenerativeAI constructor is mocked to return an object
    // which has getGenerativeModel, which in turn returns our object with generateContent.
    const genAI = new GoogleGenerativeAI('test-api-key');
    mockModelInstance = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' }) as GeminiModel;
 
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          title: "Mocked Gemini Recipe Title via @google/generative-ai mock",
          ingredients: [
            { originalText: "1 cup Mock Ingredient A", name: "Mock Ingredient A" },
          ],
          instructions: [
            { originalText: "Mock Gemini step 1." },
          ],
        }),
        usageMetadata: { totalTokenCount: 100, promptTokenCount: 50, candidatesTokenCount: 50 },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  fixtureFiles.forEach(fixtureFile => {
    test(`should process and snapshot ${fixtureFile}`, async () => {
      const htmlFilePath = path.join(fixturesDir, fixtureFile);
      let htmlContent = '';
      try {
        htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
      } catch (e) {
        console.warn(`Could not read fixture ${fixtureFile}, skipping test. Error: ${(e as Error).message}`);
        return; // Skip test if fixture can't be read
      }

      console.log(`\n--- Testing Fixture: ${fixtureFile} ---`);

      const extractedContent: ExtractedContent = extractRecipeContent(htmlContent);
      console.log(`  [extractContent] isFallback: ${extractedContent.isFallback}`);
      console.log(`  [extractContent] ingredientsText length: ${extractedContent.ingredientsText?.length || 0}`);
      console.log(`  [extractContent] instructionsText length: ${extractedContent.instructionsText?.length || 0}`);

      const requestId = `test-${fixtureFile.replace('.html', '')}`;
      // Corrected call signature for parseUrlContentWithGemini
      const result = await parseUrlContentWithGemini(extractedContent, requestId, mockModelInstance);

      let geminiParseSuccess = false;
      if (mockGenerateContent.mock.calls.length > 0) {
        const mockedGeminiResponse = await mockGenerateContent.mock.results[0].value;
        const geminiText = mockedGeminiResponse?.response?.text();
        if (geminiText) {
            const parsedGeminiJson = safeJsonParse(geminiText);
            geminiParseSuccess = !!parsedGeminiJson.parsed && !parsedGeminiJson.error;
        }
      }
      
      console.log(`  [parseUrlContentWithGemini] Mocked Gemini call count: ${mockGenerateContent.mock.calls.length}`);
      console.log(`  [parseUrlContentWithGemini] Gemini JSON parse success (from mock): ${geminiParseSuccess}`);
      console.log(`  [parseUrlContentWithGemini] Final recipe title present: ${!!result.recipe?.title}`);
      console.log(`  [parseUrlContentWithGemini] Final recipe ingredients count: ${result.recipe?.ingredients?.length || 0}`);
      console.log(`  [parseUrlContentWithGemini] Final recipe instructions count: ${result.recipe?.instructions?.length || 0}`);
      
      expect(result.recipe).toMatchSnapshot('final_recipe_object');
      console.log(`--- End Fixture: ${fixtureFile} ---\n`);
    });
  });
}); 