import { Router, Request, Response } from 'express'
import { Content } from "@google/generative-ai"; // For type only, no initialization
import { scraperClient, scraperApiKey } from '../lib/scraper';
import { parseAndCacheRecipe } from '../services/parseRecipe';
import { rewriteForSubstitution } from '../services/substitutionRewriter';
import { scaleInstructions } from '../services/instructionScaling';
import { getAllRecipes, getRecipeById } from '../services/recipeDB';
import logger from '../lib/logger'; 
import { ParseErrorCode } from '../types/errors';

const router = Router()

// Get all recipes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await getAllRecipes();
    
    if (error) throw error
    res.json(data)
  } catch (err) {
    const error = err as Error;
    logger.error({ requestId: (req as any).id, err: error, route: req.originalUrl, method: req.method }, 'Error fetching all recipes');
    res.status(500).json({ error: error.message || 'An unknown error occurred' });
  }
})

// Get single recipe with ingredients and substitutions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { data, error } = await getRecipeById(id);
    
    if (error) throw error
    res.json(data)
  } catch (err) {
    const error = err as Error;
    logger.error({ requestId: (req as any).id, err: error, route: req.originalUrl, method: req.method, params: req.params }, 'Error fetching single recipe');
    res.status(500).json({ error: error.message || 'An unknown error occurred' });
  }
})

// --- Main Parsing Route --- 
router.post('/parse', async (req: Request, res: Response) => {
  // Add logging for incoming request body
  logger.info({ body: req.body, requestId: (req as any).id, route: req.originalUrl, method: req.method }, '[parse] Incoming request');
  try {
    const { input } = req.body;
    const requestId = (req as any).id;

    logger.info({ input, requestId }, '[parse] Processing');

    if (!input || typeof input !== 'string' || input.trim() === '') {
      logger.warn({ requestId, route: req.originalUrl, method: req.method, inputReceived: input }, 'Missing or empty "input" in request body for /parse');
      return res.status(400).json({ error: 'Missing or empty "input" in request body' });
    }

    if (!scraperApiKey) {
      logger.error({ requestId, route: req.originalUrl, method: req.method, nodeEnv: process.env.NODE_ENV }, 'Server configuration error: Missing ScraperAPI key for /parse.');
      return res.status(500).json({ error: 'Server configuration error: Missing ScraperAPI key.' });
    }

    const { recipe, error: parseError, fromCache, inputType, cacheKey, timings, usage, fetchMethodUsed } = await parseAndCacheRecipe(input);

    if (parseError) {
      switch (parseError.code) {
        case ParseErrorCode.INVALID_INPUT:
          return res.status(400).json({ error: parseError });
        case ParseErrorCode.FINAL_VALIDATION_FAILED:
        case ParseErrorCode.GENERATION_EMPTY:
          return res.status(422).json({ error: parseError });
        default:
          return res.status(500).json({ error: parseError });
      }
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
    
  } catch (err) {
    const error = err as Error;
    logger.error({
        requestId: (req as any).id,
        message: '💥 Error in /api/recipes/parse:', 
        errorObject: error, 
        errorMessage: error.message,
        stack: error.stack,
        route: req.originalUrl,
        method: req.method,
        body: req.body
    }, 'Unhandled exception in /parse route');
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// --- Rewrite Instructions Endpoint ---
router.post('/rewrite-instructions', async (req: Request, res: Response) => {
  try {
    const { originalInstructions, substitutions } = req.body;
    const requestId = (req as any).id;

    logger.info({ requestId, body: req.body }, '[rewrite-instructions] Received body');

    if (!originalInstructions || !Array.isArray(originalInstructions) || originalInstructions.length === 0) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Missing or invalid original instructions');
      return res.status(400).json({ error: 'Missing or invalid original instructions' });
    }
    if (!substitutions || !Array.isArray(substitutions)) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Missing or invalid substitutions array');
      return res.status(400).json({ error: 'Missing or invalid substitutions array' });
    }

    const { rewrittenInstructions, error: rewriteError, usage, timeMs } = await rewriteForSubstitution(
      originalInstructions,
      substitutions,
      requestId
    );

    if (rewriteError || !rewrittenInstructions) {
      // rewriteForSubstitution service already logs details
      logger.error({ requestId, route: req.originalUrl, method: req.method, errMessage: rewriteError || 'Result was null' }, `Failed to rewrite instructions with Gemini`);
      return res.status(500).json({ error: `Failed to rewrite instructions: ${rewriteError || 'Unknown error'}` });
    } else {
      logger.info({ requestId, route: req.originalUrl, method: req.method, usage, timeMs }, 'Successfully rewrote instructions.');
      res.json({ rewrittenInstructions, usage, timeMs });
    }

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId: (req as any).id, err: error, route: req.originalUrl, method: req.method, body: req.body }, 'Error in /rewrite-instructions route processing');
    res.status(500).json({ error: error.message || 'An unknown server error occurred' });
  }
});

// --- Scale Instructions Endpoint ---
router.post('/scale-instructions', async (req: Request, res: Response) => {
  try {
    const { instructionsToScale, originalIngredients, scaledIngredients } = req.body;
    const requestId = (req as any).id;

    if (!Array.isArray(instructionsToScale) || !Array.isArray(originalIngredients) || !Array.isArray(scaledIngredients)) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Invalid input: instructions, originalIngredients, and scaledIngredients must be arrays.');
      return res.status(400).json({ error: 'Invalid input: instructions, originalIngredients, and scaledIngredients must be arrays.' });
    }
    if (instructionsToScale.length === 0) {
      logger.info({ requestId, route: req.originalUrl, method: req.method }, "No instructions provided to scale, returning empty array.");
      return res.json({ scaledInstructions: [] });
    }
    if (originalIngredients.length !== scaledIngredients.length) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method, originalLength: originalIngredients.length, scaledLength: scaledIngredients.length }, "Original and scaled ingredient lists have different lengths. Scaling might be inaccurate.");
    }

    const { scaledInstructions, error: scaleError, usage, timeMs } = await scaleInstructions(
      instructionsToScale,
      originalIngredients,
      scaledIngredients,
      requestId
    );

    if (scaleError || !scaledInstructions) {
      logger.error({ requestId, route: req.originalUrl, method: req.method, errMessage: scaleError || 'Result was null' }, 'Failed to scale instructions with Gemini');
      return res.status(500).json({ error: `Failed to scale instructions: ${scaleError || 'Unknown error'}` });
    } else {
      logger.info({ requestId, route: req.originalUrl, method: req.method, usage, timeMs }, 'Successfully scaled instructions.');
      res.json({ scaledInstructions, usage, timeMs });
    }

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId: (req as any).id, err: error, route: req.originalUrl, method: req.method, body: req.body }, 'Error in /scale-instructions route processing');
    res.status(500).json({ error: error.message || 'Internal server error processing instruction scaling request.' });
  }
});

export const recipeRouter = router;