import { Router, Request, Response } from 'express'
import { Content } from "@google/generative-ai"; // For type only, no initialization
import { v4 as uuidv4 } from 'uuid';
import { scraperClient, scraperApiKey } from '../lib/scraper';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { parseAndCacheRecipe } from '../services/parseRecipe';
import { rewriteForSubstitution } from '../services/substitutionRewriter';
import { scaleInstructions } from '../services/instructionScaling';
import { getAllRecipes, getRecipeById } from '../services/recipeDB';
import { generateAndSaveEmbedding } from '../../utils/recipeEmbeddings';
import { CombinedParsedRecipe } from '../../common/types';
import { IngredientChange } from '../llm/substitutionPrompts';
import logger from '../lib/logger'; 
import { ParseErrorCode } from '../../common/types/errors';

interface SaveModifiedRecipeRequestBody {
  originalRecipeId: number;
  userId: string;
  modifiedRecipeData: CombinedParsedRecipe;
  appliedChanges: { // Ensure this matches the exact structure from frontend
    ingredientChanges: IngredientChange[];
    scalingFactor: number;
  };
}

const router = Router()

// Middleware to log all incoming requests to this router, which helps in debugging
// path matching issues, especially in a serverless environment.
router.use((req, res, next) => {
  logger.info({
    requestId: (req as any).id,
    method: req.method,
    path: req.originalUrl,
  }, 'Incoming request to /api/recipes router');
  next();
});

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

// --- Main Parsing Route ---
// It is critical to define static routes like this one *before* dynamic routes.
// This ensures that a request to '/parse' is handled by this specific handler
// instead of being mistakenly captured by a dynamic handler like '/:id'.
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

// Get single recipe with ingredients and substitutions
// By using `:id(\\d+)`, we apply a regex to the route parameter.
// This ensures that this route will only match requests where the 'id'
// segment is composed of one or more digits (i.e., a numeric ID).
// This prevents conflicts with other routes that might have a string in the same
// path segment, such as a hypothetical '/api/recipes/latest'.
router.get('/:id(\\d+)', async (req: Request, res: Response) => {
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

    const { rewrittenInstructions, newTitle, error: rewriteError, usage, timeMs } = await rewriteForSubstitution(
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
      res.json({ rewrittenInstructions, newTitle, usage, timeMs });
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

// POST /api/recipes/save-modified
router.post('/save-modified', async (req: Request<any, any, SaveModifiedRecipeRequestBody>, res: Response) => {
  const requestId = (req as any).id;

  try {
    const { originalRecipeId, userId, modifiedRecipeData, appliedChanges } = req.body;

    logger.info({ 
      requestId, 
      originalRecipeId, 
      userId, 
      appliedChanges,
      hasImage: !!modifiedRecipeData?.image,
      hasThumbnail: !!modifiedRecipeData?.thumbnailUrl,
      title: modifiedRecipeData?.title
    }, 'Received request to save modified recipe');

    // --- Data Validation (basic, extend as needed) ---
    if (!originalRecipeId || !userId || !modifiedRecipeData || !appliedChanges) {
      logger.error({ requestId, body: req.body }, 'Missing required fields for saving modified recipe.');
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!modifiedRecipeData.title || !modifiedRecipeData.instructions || modifiedRecipeData.instructions.length === 0 || !modifiedRecipeData.ingredientGroups || modifiedRecipeData.ingredientGroups.length === 0) {
        logger.error({ requestId, modifiedRecipeData }, 'Modified recipe data is incomplete or invalid.');
        return res.status(400).json({ error: 'Incomplete modified recipe data provided.' });
    }

    // --- 1. Generate a new unique URL (UUID) for the modified recipe ---
    const newRecipeUrl = uuidv4(); // Generates a Version 4 UUID

    // --- 2. Insert the modified recipe into processed_recipes_cache ---
    // The 'recipe_data' column is jsonb, so we can directly store the CombinedParsedRecipe object.
    const { data: newModifiedRecipeRows, error: insertRecipeError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .insert({
        url: newRecipeUrl,
        recipe_data: modifiedRecipeData, // Store the full reconstructed recipe here
        parent_recipe_id: originalRecipeId,
        source_type: 'user_modified', // Add a source type to distinguish modified recipes
        is_user_modified: true, // Explicitly set the boolean flag for modified recipes
      })
      .select('id, url') // Select the new id and url to return them
      .single(); // Expect a single row back

    if (insertRecipeError || !newModifiedRecipeRows) {
      logger.error({ requestId, originalRecipeId, newRecipeUrl, err: insertRecipeError }, 'Failed to insert modified recipe into processed_recipes_cache.');
      return res.status(500).json({ error: 'Failed to save modified recipe content.' });
    }

    const newModifiedRecipeId = newModifiedRecipeRows.id;
    const savedRecipeUrl = newModifiedRecipeRows.url;

    logger.info({ 
      requestId, 
      newModifiedRecipeId, 
      savedRecipeUrl,
      parentRecipeId: originalRecipeId,
      sourceType: 'user_modified',
      isUserModified: true,
      hasImagePreserved: !!modifiedRecipeData?.image
    }, 'Modified recipe inserted into processed_recipes_cache.');

    // --- 3. Generate and Save Embedding for the New Modified Recipe ---
    // Prepare text inputs for embedding from the modifiedRecipeData
    const ingredientsText = modifiedRecipeData.ingredientGroups
      ?.flatMap(group => group.ingredients.map(ing => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()))
      .join('\n');
    const instructionsText = modifiedRecipeData.instructions?.join('\n');

    await generateAndSaveEmbedding(newModifiedRecipeId, {
      title: modifiedRecipeData.title,
      ingredientsText: ingredientsText,
      instructionsText: instructionsText,
    });
    // Note: The embedding is saved asynchronously, but we proceed with user_saved_recipes insert.
    // You might want to add more robust error handling or retry logic for embedding if it's critical path.

    // --- 4. Insert into user_saved_recipes ---
    // This links the user to their newly saved modified recipe in the cache
    const { data: userSavedEntry, error: insertUserSavedError } = await supabaseAdmin
      .from('user_saved_recipes')
      .insert({
        user_id: userId,
        base_recipe_id: newModifiedRecipeId, // Link to the newly created modified recipe
        title_override: modifiedRecipeData.title, // Use the (potentially LLM-suggested) title
        applied_changes: appliedChanges, // Store the explicit changes metadata
        // notes: null, // As per plan, leave notes as null unless user input is added
      })
      .select('id')
      .single(); // Expect a single row back

    if (insertUserSavedError || !userSavedEntry) {
      // IMPORTANT: If this fails, consider rolling back the processed_recipes_cache insert
      // For now, we'll log an error. A transaction would be ideal here if supported directly.
      logger.error({ requestId, newModifiedRecipeId, userId, err: insertUserSavedError }, 'Failed to insert into user_saved_recipes.');
      // You might want to delete the entry from processed_recipes_cache here
      // await supabaseAdmin.from('processed_recipes_cache').delete().eq('id', newModifiedRecipeId);
      return res.status(500).json({ error: 'Failed to record saved recipe for user.' });
    }

    logger.info({ requestId, userSavedEntryId: userSavedEntry.id }, 'User saved recipe entry created.');

    // --- 5. Send Success Response ---
    res.status(201).json({
      message: 'Modified recipe saved successfully!',
      newRecipeId: newModifiedRecipeId,
      newRecipeUrl: savedRecipeUrl,
      userSavedRecordId: userSavedEntry.id,
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error, route: req.originalUrl, method: req.method, body: req.body }, 'Critical error in /save-modified route processing');
    res.status(500).json({ error: error.message || 'Internal server error processing save modified recipe request.' });
  }
});

export const recipeRouter = router;