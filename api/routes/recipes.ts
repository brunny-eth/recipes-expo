import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from "@google/generative-ai"; // Import Google AI SDK
import scraperapiClient from 'scraperapi-sdk';
import { parseAndCacheRecipe } from '../services/parseRecipe';
import { createRecipeWithIngredients } from '../services/recipeService';
import { rewriteForSubstitution } from '../services/substitutionRewriter';
import { scaleInstructions } from '../services/instructionScaling';

const router = Router()

// --- Initialize ScraperAPI Client ---
const scraperApiKey = process.env.SCRAPERAPI_KEY;
if (!scraperApiKey) {
  console.error('SCRAPERAPI_KEY environment variable is not set!');
}
const scraperClient = scraperapiClient(scraperApiKey || ''); 

// --- Initialize Google AI Client ---
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set!');
}
const genAI = new GoogleGenerativeAI(googleApiKey || '');
const geminiConfig: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.1, 
};
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: geminiConfig,
    safetySettings: safetySettings,
});

// Get all recipes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients (*)
      `)
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Get single recipe with ingredients and substitutions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients (
          *,
          substitutions (*)
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Create new custom user-created recipe, NOT in full parsing flow; not currently being used 
router.post('/', async (req: Request, res: Response) => {
  const { title, servings, ingredients } = req.body;

  const { result, error } = await createRecipeWithIngredients({ title, servings, ingredients });

  if (error) {
    return res.status(500).json({ error });
  }

  res.json(result);
});

// --- Main Parsing Route --- 
router.post('/parse', async (req: Request, res: Response) => {
  const { input } = req.body;
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return res.status(400).json({ error: 'Missing or empty "input" in request body' });
  }

  if (!scraperApiKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing ScraperAPI key.' });
  }

  const { recipe, error, fromCache, inputType, cacheKey, timings, usage, fetchMethodUsed } = await parseAndCacheRecipe(input, geminiModel, scraperApiKey, scraperClient);

  if (error) {
    console.error(`[API /parse Error] Failed to process input: ${input}`, error);
    return res.status(500).json({ error });
  }

  res.json({
    message: `Recipe processing complete (${inputType}).`,
    inputType,
    fromCache,
    cacheKey,
    timings,
    usage,
    fetchMethodUsed,
    recipe
  });
});

// --- Rewrite Instructions Endpoint ---
router.post('/rewrite-instructions', async (req: Request, res: Response) => {
  try {
    const { originalInstructions, originalIngredientName, substitutedIngredientName } = req.body;
    if (!originalInstructions || !Array.isArray(originalInstructions) || originalInstructions.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid original instructions' });
    }
    if (!originalIngredientName || !substitutedIngredientName) {
      return res.status(400).json({ error: 'Missing original or substituted ingredient name' });
    }

    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    const { rewrittenInstructions, error, usage, timeMs } = await rewriteForSubstitution(
      originalInstructions,
      originalIngredientName,
      substitutedIngredientName,
      geminiModel
    );

    if (error || !rewrittenInstructions) {
      console.error(`Failed to rewrite instructions with Gemini: ${error || 'Result was null'}`);
      return res.status(500).json({ error: `Failed to rewrite instructions: ${error || 'Unknown error'}` });
    } else {
      res.json({ rewrittenInstructions, usage, timeMs });
    }

  } catch (error) {
    console.error('Error in /rewrite-instructions route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    res.status(500).json({ error: message });
  }
});

// --- Scale Instructions Endpoint ---
router.post('/scale-instructions', async (req: Request, res: Response) => {
  try {
    const { instructionsToScale, originalIngredients, scaledIngredients } = req.body;
    if (!Array.isArray(instructionsToScale) || !Array.isArray(originalIngredients) || !Array.isArray(scaledIngredients)) {
      return res.status(400).json({ error: 'Invalid input: instructions, originalIngredients, and scaledIngredients must be arrays.' });
    }
    if (instructionsToScale.length === 0) {
      console.log("No instructions provided to scale.");
      return res.json({ scaledInstructions: [] });
    }
    if (originalIngredients.length !== scaledIngredients.length) {
      console.warn("Original and scaled ingredient lists have different lengths. Scaling might be inaccurate.");
    }

    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    const { scaledInstructions, error, usage, timeMs } = await scaleInstructions(
      instructionsToScale,
      originalIngredients,
      scaledIngredients,
      geminiModel
    );

    if (error || !scaledInstructions) {
      console.error(`Failed to scale instructions with Gemini: ${error || 'Result was null'}`);
      return res.status(500).json({ error: `Failed to scale instructions: ${error || 'Unknown error'}` });
    } else {
      res.json({ scaledInstructions, usage, timeMs });
    }

  } catch (error) {
    console.error("Error in /scale-instructions route:", error);
    res.status(500).json({ error: 'Internal server error processing instruction scaling request.' });
  }
});

export const recipeRouter = router