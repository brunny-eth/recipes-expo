import { Router, Request, Response } from 'express'
import { Content } from "@google/generative-ai"; // For type only, no initialization
import { v4 as uuidv4 } from 'uuid';
import { scraperClient, scraperApiKey } from '../lib/scraper';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { parseAndCacheRecipe } from '../services/parseRecipe';
import { parseImageRecipe } from '../services/parseImageRecipe';
import { upload, uploadMultiple } from '../lib/multer';
import { modifyInstructions } from '../services/instructionModification';
import { getAllRecipes, getRecipeById } from '../services/recipeDB';
import { generateAndSaveEmbedding } from '../../utils/recipeEmbeddings';
import { CombinedParsedRecipe } from '../../common/types';
import { IngredientChange, buildVariationPrompt, VariationType } from '../llm/modificationPrompts';
import { runDefaultLLM } from '../llm/adapters';
import logger from '../lib/logger'; 
import { ParseErrorCode } from '../../common/types/errors';
import { ImageData } from '../services/parseImageRecipe';

// Helper function to merge substitutions from original recipe with LLM-generated ones
function mergeSubstitutions(originalGroups: any[], modifiedGroups: any[], variationType: VariationType): any[] {
  const mergedGroups = modifiedGroups.map(modifiedGroup => {
    const mergedIngredients = modifiedGroup.ingredients.map((modifiedIngredient: any) => {
      // Find matching original ingredient (fuzzy match by name)
      const originalIngredient = findMatchingOriginalIngredient(modifiedIngredient, originalGroups);

      if (originalIngredient && originalIngredient.suggested_substitutions) {
        // Check if this ingredient was actually changed by the variation
        const wasChanged = wasIngredientChanged(modifiedIngredient, originalIngredient, variationType);

        if (!wasChanged && modifiedIngredient.suggested_substitutions === null) {
          // Ingredient wasn't changed, copy original substitutions
          return {
            ...modifiedIngredient,
            suggested_substitutions: originalIngredient.suggested_substitutions,
            _substitutionSource: 'inherited'
          };
        }
      }

      // Ingredient was changed or LLM provided substitutions, keep LLM's version
      return {
        ...modifiedIngredient,
        _substitutionSource: 'llm'
      };
    });

    return {
      ...modifiedGroup,
      ingredients: mergedIngredients
    };
  });

  return mergedGroups;
}

// Helper to find matching ingredient from original recipe
function findMatchingOriginalIngredient(modifiedIngredient: any, originalGroups: any[]): any | null {
  for (const group of originalGroups) {
    for (const originalIngredient of group.ingredients) {
      // Simple fuzzy match - could be improved with better similarity logic
      const modifiedName = modifiedIngredient.name?.toLowerCase() || '';
      const originalName = originalIngredient.name?.toLowerCase() || '';

      if (modifiedName === originalName ||
          modifiedName.includes(originalName) ||
          originalName.includes(modifiedName) ||
          // Also check if amounts are similar (indicating same ingredient)
          (modifiedIngredient.amount === originalIngredient.amount &&
           modifiedIngredient.unit === originalIngredient.unit)) {
        return originalIngredient;
      }
    }
  }
  return null;
}

// Helper to determine if an ingredient was actually changed by the variation
function wasIngredientChanged(modifiedIngredient: any, originalIngredient: any, variationType: VariationType): boolean {
  // Compare names (case insensitive)
  const nameChanged = modifiedIngredient.name?.toLowerCase() !== originalIngredient.name?.toLowerCase();

  // For vegetarian, check if meat/fish was replaced
  if (variationType === 'vegetarian') {
    const meatFishKeywords = ['beef', 'chicken', 'pork', 'lamb', 'fish', 'shrimp', 'salmon', 'tuna', 'crab', 'lobster'];
    const originalHasMeat = meatFishKeywords.some(keyword =>
      originalIngredient.name?.toLowerCase().includes(keyword)
    );
    const modifiedHasMeat = meatFishKeywords.some(keyword =>
      modifiedIngredient.name?.toLowerCase().includes(keyword)
    );

    if (originalHasMeat && !modifiedHasMeat) {
      return true; // Meat was replaced with vegetarian alternative
    }
  }

  // For other variations, check if name changed significantly
  return nameChanged;
}

interface SaveModifiedRecipeRequestBody {
  originalRecipeId: number;
  userId: string;
  modifiedRecipeData: CombinedParsedRecipe;
  appliedChanges: { // Ensure this matches the exact structure from frontend
    ingredientChanges: IngredientChange[];
    scalingFactor: number;
  };
  folderId?: number; // Optional folder support - if not provided, skip creating new user_saved_recipes entry
  saved_id?: string; // Optional saved recipe ID to update instead of creating new
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
    const { input, forceNewParse } = req.body;
    const requestId = (req as any).id;

    logger.info({ input, forceNewParse, requestId }, '[parse] Processing');

    if (!input || typeof input !== 'string' || input.trim() === '') {
      logger.warn({ requestId, route: req.originalUrl, method: req.method, inputReceived: input }, 'Missing or empty "input" in request body for /parse');
      return res.status(400).json({ error: 'Missing or empty "input" in request body' });
    }

    if (!scraperApiKey) {
      logger.error({ requestId, route: req.originalUrl, method: req.method, nodeEnv: process.env.NODE_ENV }, 'Server configuration error: Missing ScraperAPI key for /parse.');
      return res.status(500).json({ error: 'Server configuration error: Missing ScraperAPI key.' });
    }

    const { recipe, error: parseError, fromCache, inputType, cacheKey, timings, usage, fetchMethodUsed, cachedMatches } = await parseAndCacheRecipe(input, forceNewParse);

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
      recipe,
      cachedMatches
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

// --- Image Parsing Route ---
// Test with: curl -X POST -F "image=@/path/to/recipe.jpg" http://localhost:3000/api/recipes/parse-image
router.post('/parse-image', upload.single('image'), async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  logger.info({ 
    requestId,
    headers: req.headers,
    bodySize: req.body ? Object.keys(req.body).length : 0,
    fileExists: !!(req as any).file,
    route: req.originalUrl,
    method: req.method
  }, 'Starting /parse-image request processing');
  
  try {
    const file = (req as any).file;
    if (!file) {
      logger.warn({ 
        requestId, 
        route: req.originalUrl, 
        method: req.method,
        multerError: 'No file received by multer',
        headers: req.headers 
      }, 'No image file uploaded for /parse-image');
      return res.status(400).json({ error: 'Image file is required.' });
    }

    logger.info({ 
      requestId, 
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      route: req.originalUrl, 
      method: req.method 
    }, 'Received image for parsing');

    const { recipe, error: parseError, fromCache, inputType, cacheKey, timings, usage, fetchMethodUsed, extractedText, imageProcessingTime, coverImageUrl, cachedMatches } = await parseImageRecipe(
      file.buffer, 
      file.mimetype, 
      requestId,
      { uploadCoverImage: true } // Enable cover image upload
    );

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
      message: `Image processing complete (${inputType}).`,
      inputType,
      fromCache,
      cacheKey,
      timings,
      usage,
      fetchMethodUsed,
      recipe,
      extractedText: extractedText ? extractedText.substring(0, 200) + '...' : null,
      imageProcessingTime,
      coverImageUrl,
      cachedMatches
    });

  } catch (err) {
    const error = err as Error;
    
    // Check for multer-specific errors
    if (error.message?.includes('File too large')) {
      logger.warn({ requestId: (req as any).id, error: error.message }, 'File size exceeded limit');
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    
    if (error.message?.includes('Only JPEG, PNG, WebP, and GIF')) {
      logger.warn({ requestId: (req as any).id, error: error.message }, 'Invalid file type uploaded');
      return res.status(400).json({ error: error.message });
    }
    
    logger.error({
        requestId: (req as any).id,
        message: '💥 Error in /api/recipes/parse-image:', 
        errorObject: error, 
        errorMessage: error.message,
        stack: error.stack,
        route: req.originalUrl,
        method: req.method,
        errorName: error.name,
        errorCode: (error as any).code
    }, 'Unhandled exception in /parse-image route');
    res.status(500).json({ error: 'Failed to process the uploaded image. Please try again.', details: error.message });
  }
});

// --- Multi-Page Image Parsing Route ---
// Test with: curl -X POST -F "images=@page1.jpg" -F "images=@page2.jpg" http://localhost:3000/api/recipes/parse-images
router.post('/parse-images', (req: Request, res: Response, next: Function) => {
  // Custom multer error handling
  uploadMultiple.array('images', 10)(req, res, (err: any) => {
    if (err) {
      const requestId = (req as any).id;
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        logger.warn({ requestId, error: err.message }, 'File size limit exceeded in multi-image upload');
        return res.status(400).json({ error: 'One or more files exceed the 10MB size limit.' });
      }
      
      if (err.code === 'LIMIT_FILE_COUNT') {
        logger.warn({ requestId, error: err.message }, 'Too many files in multi-image upload');
        return res.status(400).json({ error: 'Too many files. Maximum is 10 images.' });
      }
      
      if (err.message?.includes('Only JPEG, PNG, WebP, and GIF')) {
        logger.warn({ requestId, error: err.message }, 'Invalid file type in multi-image upload');
        return res.status(400).json({ error: err.message });
      }
      
      logger.error({ requestId, error: err }, 'Multer error in multi-image upload');
      return res.status(400).json({ error: 'File upload error. Please try again.' });
    }
    
    next();
  });
}, async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  logger.info({ 
    requestId,
    headers: req.headers,
    filesCount: (req as any).files?.length || 0,
    route: req.originalUrl,
    method: req.method
  }, 'Starting /parse-images request processing');
  
  try {
    const files = (req as any).files;
    if (!files || files.length === 0) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'No image files uploaded for /parse-images');
      return res.status(400).json({ error: 'At least one image file is required.' });
    }

    logger.info({ 
      requestId, 
      filesCount: files.length,
      fileSizes: files.map((f: any) => ({ name: f.originalname, size: f.size })),
      route: req.originalUrl, 
      method: req.method 
    }, 'Received multiple images for parsing');

    // Prepare image data for vision model
    const imageData = files.map((file: any) => ({
      mimeType: file.mimetype,
      data: file.buffer.toString('base64')
    }));

    const { recipe, error: parseError, fromCache, inputType, cacheKey, timings, usage, fetchMethodUsed, extractedText, imageProcessingTime, coverImageUrl, cachedMatches } = await parseImageRecipe(
      imageData,
      requestId,
      { uploadCoverImage: true } // Enable cover image upload for multi-page
    );

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
      message: `Multi-page recipe processing complete.`,
      inputType,
      fromCache,
      cacheKey,
      timings,
      usage,
      fetchMethodUsed,
      recipe,
      extractedText,
      imageProcessingTime,
      coverImageUrl,
      cachedMatches,
      pagesProcessed: files.length
    });
    
  } catch (err) {
    const error = err as Error;
    
    logger.error({
        requestId: (req as any).id,
        message: '💥 Error in /api/recipes/parse-images:', 
        errorObject: error, 
        errorMessage: error.message,
        stack: error.stack,
        route: req.originalUrl,
        method: req.method,
        errorName: error.name,
        errorCode: (error as any).code
    }, 'Unhandled exception in /parse-images route');
    res.status(500).json({ error: 'Failed to process the uploaded images. Please try again.', details: error.message });
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

// Get random recipes for explore page
router.get('/explore-random', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    logger.info({ requestId, route: req.originalUrl, method: req.method }, 'Received request for explore-random recipes');

    const { data, error } = await supabase
      .rpc('get_random_recipes');

    if (error) {
      logger.error({ requestId, err: error, route: req.originalUrl, method: req.method }, 'Error fetching random recipes for explore');
      throw error;
    }

    const recipeCount = data?.length || 0;
    logger.info({ requestId, recipeCount, route: req.originalUrl, method: req.method }, `Successfully fetched ${recipeCount} random recipes for explore`);

    // Transform data to return just the recipe_data with ids
    const recipes = data?.map((item: any) => ({
      ...item.recipe_data,
      id: item.id
    })) || [];

    res.json(recipes);
  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error, route: req.originalUrl, method: req.method }, 'Error in /explore-random route processing');
    res.status(500).json({ error: error.message || 'An unknown error occurred' });
  }
})



// --- Unified Modify Instructions Endpoint ---
router.post('/modify-instructions', async (req: Request, res: Response) => {
  try {
    const { originalInstructions, substitutions, originalIngredients, scaledIngredients, scalingFactor, skipTitleUpdate } = req.body;
    const requestId = (req as any).id;

    logger.info({ requestId, body: req.body }, '[modify-instructions] Received body');

    // Validation
    if (!originalInstructions || !Array.isArray(originalInstructions) || originalInstructions.length === 0) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Missing or invalid original instructions');
      return res.status(400).json({ error: 'Missing or invalid original instructions' });
    }
    if (!substitutions || !Array.isArray(substitutions)) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Missing or invalid substitutions array');
      return res.status(400).json({ error: 'Missing or invalid substitutions array' });
    }
    if (!originalIngredients || !Array.isArray(originalIngredients)) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Missing or invalid originalIngredients array');
      return res.status(400).json({ error: 'Missing or invalid originalIngredients array' });
    }
    if (!scaledIngredients || !Array.isArray(scaledIngredients)) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method }, 'Missing or invalid scaledIngredients array');
      return res.status(400).json({ error: 'Missing or invalid scaledIngredients array' });
    }
    if (typeof scalingFactor !== 'number' || scalingFactor <= 0) {
      logger.warn({ requestId, route: req.originalUrl, method: req.method, scalingFactor }, 'Invalid scalingFactor');
      return res.status(400).json({ error: 'scalingFactor must be a positive number' });
    }

    const { modifiedInstructions, newTitle, error: modifyError, usage, timeMs } = await modifyInstructions(
      originalInstructions,
      substitutions,
      originalIngredients,
      scaledIngredients,
      scalingFactor,
      requestId,
      skipTitleUpdate
    );

    if (modifyError || !modifiedInstructions) {
      logger.error({ requestId, route: req.originalUrl, method: req.method, errMessage: modifyError || 'Result was null' }, `Failed to modify instructions with unified approach`);
      return res.status(500).json({ error: `Failed to modify instructions: ${modifyError || 'Unknown error'}` });
    } else {
      logger.info({ requestId, route: req.originalUrl, method: req.method, usage, timeMs }, 'Successfully modified instructions.');
      res.json({ modifiedInstructions, newTitle, usage, timeMs });
    }

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId: (req as any).id, err: error, route: req.originalUrl, method: req.method, body: req.body }, 'Error in /modify-instructions route processing');
    res.status(500).json({ error: error.message || 'An unknown server error occurred' });
  }
});

// POST /api/recipes/save-modified
router.post('/save-modified', async (req: Request<any, any, SaveModifiedRecipeRequestBody>, res: Response) => {
  const requestId = (req as any).id;

  try {
    // Guard against original_recipe_data being sent
    if ('original_recipe_data' in req.body || 'originalRecipeData' in req.body) {
      return res.status(400).json({ error: 'original_recipe_data is not allowed' });
    }

    const { originalRecipeId, userId, modifiedRecipeData, appliedChanges, folderId, saved_id } = req.body;

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

    // Verify folder exists and belongs to user (only if folderId is provided)
    let folder = null;
    if (folderId) {
      const { data: folderData, error: folderError } = await supabaseAdmin
        .from('user_saved_folders')
        .select('id')
        .eq('user_id', userId)
        .eq('id', folderId)
        .single();

      if (folderError || !folderData) {
        logger.error({ requestId, userId, folderId, folderError }, 'Invalid folder or folder does not exist.');
        return res.status(400).json({ error: 'Invalid folder selected.' });
      }
      folder = folderData;
    }
    if (!modifiedRecipeData.title || !modifiedRecipeData.instructions || modifiedRecipeData.instructions.length === 0 || !modifiedRecipeData.ingredientGroups || modifiedRecipeData.ingredientGroups.length === 0) {
        logger.error({ requestId, modifiedRecipeData }, 'Modified recipe data is incomplete or invalid.');
        return res.status(400).json({ error: 'Incomplete modified recipe data provided.' });
    }

    // --- 1. Generate a new unique URL (UUID) for the modified recipe ---
    const newRecipeUrl = uuidv4(); // Generates a Version 4 UUID

    // --- 2. Insert the modified recipe into processed_recipes_cache ---
    // A) Strip any incoming id field to prevent parent ID pollution
    const { id: _jsonIdDrop, ...cleanModified } = modifiedRecipeData ?? {};
    
    // B) Insert without ID field to ensure clean data
    const { data: newModifiedRecipeRows, error: insertRecipeError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .insert({
        url: newRecipeUrl,
        recipe_data: cleanModified, // Store the recipe WITHOUT any ID field
        parent_recipe_id: originalRecipeId,
        source_type: 'user_modified', // Add a source type to distinguish modified recipes
        is_user_modified: true, // Explicitly set the boolean flag for modified recipes
      })
      .select('*') // Select all fields to return the full recipe
      .single(); // Expect a single row back

    if (insertRecipeError || !newModifiedRecipeRows) {
      logger.error({ requestId, originalRecipeId, newRecipeUrl, err: insertRecipeError }, 'Failed to insert modified recipe into processed_recipes_cache.');
      return res.status(500).json({ error: 'Failed to save modified recipe content.' });
    }

    const newModifiedRecipeId = newModifiedRecipeRows.id;
    const savedRecipeUrl = newModifiedRecipeRows.url;

    // C) Force JSON id to equal the row id (belt-and-suspenders)
    const { error: updateError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .update({
        recipe_data: { ...cleanModified, id: newModifiedRecipeId },
      })
      .eq('id', newModifiedRecipeId);

    if (updateError) {
      logger.warn({ requestId, newModifiedRecipeId, err: updateError }, 'Failed to update recipe_data.id with row ID, but insert succeeded');
      // Continue execution since the main insert succeeded
    } else {
      logger.info({ requestId, newModifiedRecipeId }, 'Successfully updated recipe_data.id to match row ID');
    }

    logger.info({ 
      requestId, 
      newModifiedRecipeId, 
      savedRecipeUrl,
      parentRecipeId: originalRecipeId,
      sourceType: 'user_modified',
      isUserModified: true,
      hasImagePreserved: !!modifiedRecipeData?.image
    }, 'Modified recipe inserted into processed_recipes_cache.');

    // --- 3. Skip Embedding Generation for User-Modified Recipes ---
    // User-modified recipes should not be embedded since they are filtered out during search
    // This prevents unnecessary embedding generation and storage
    logger.info({ 
      requestId, 
      newModifiedRecipeId,
      sourceType: 'user_modified',
      reason: 'Skipping embedding generation for user-modified recipe'
    }, 'User-modified recipe - embedding generation skipped.');

    // --- 4. Insert into user_saved_recipes (only if folderId is provided) ---
    let userSavedEntry = null;
    if (folderId) {
      // This links the user to their newly saved modified recipe in the cache
      const { data: userSavedEntryData, error: insertUserSavedError } = await supabaseAdmin
        .from('user_saved_recipes')
        .insert({
          user_id: userId,
          base_recipe_id: newModifiedRecipeId, // Link to the newly created modified recipe
          folder_id: folderId, // Save to selected folder
          title_override: modifiedRecipeData.title, // Use the (potentially LLM-suggested) title
          applied_changes: appliedChanges, // Store the explicit changes metadata
          // display_order can be NULL since we sort by created_at DESC for chronological order
          // notes: null, // As per plan, leave notes as null unless user input is added
        })
        .select('id')
        .single(); // Expect a single row back

      if (insertUserSavedError || !userSavedEntryData) {
        // IMPORTANT: If this fails, consider rolling back the processed_recipes_cache insert
        // For now, we'll log an error. A transaction would be ideal here if supported directly.
        logger.error({ requestId, newModifiedRecipeId, userId, err: insertUserSavedError }, 'Failed to insert into user_saved_recipes.');
        // You might want to delete the entry from processed_recipes_cache here
        // await supabaseAdmin.from('processed_recipes_cache').delete().eq('id', newModifiedRecipeId);
        return res.status(500).json({ error: 'Failed to record saved recipe for user.' });
      }

      userSavedEntry = userSavedEntryData;
      logger.info({ requestId, userSavedEntryId: userSavedEntry.id }, 'User saved recipe entry created.');
    } else {
      logger.info({ requestId, newModifiedRecipeId }, '[SaveModified] Skipping saved pointer creation (no folderId provided)');
    }

    // --- 5. Handle saved_id parameter (update existing saved recipe to point to new fork) ---
    if (saved_id) {
      logger.info({ requestId, saved_id, newModifiedRecipeId }, '[SaveModified] Attempting to repoint saved_id=:saved_id to base_recipe_id=:newModifiedRecipeId');
      const { error: updateSavedError } = await supabaseAdmin
        .from('user_saved_recipes')
        .update({
          base_recipe_id: newModifiedRecipeId, // Point to the new fork
          title_override: modifiedRecipeData.title,
          applied_changes: appliedChanges,
        })
        .eq('id', saved_id)
        .eq('user_id', userId); // Ensure user owns this saved recipe

      if (updateSavedError) {
        logger.warn({ requestId, saved_id, err: updateSavedError }, 'Failed to update existing saved recipe, but fork was created successfully');
        // Continue - the fork was created successfully, this is just an optimization
      } else {
        logger.info({ requestId, saved_id, newModifiedRecipeId }, '[SaveModified] Repointed saved_id=:saved_id to base_recipe_id=:newModifiedRecipeId');
      }
    }

    // --- 6. Send Success Response with full recipe data ---
    res.status(201).json({
      message: 'Modified recipe saved successfully!',
      recipe: {
        id: newModifiedRecipeRows.id,
        is_user_modified: newModifiedRecipeRows.is_user_modified,
        parent_recipe_id: newModifiedRecipeRows.parent_recipe_id,
        recipe_data: newModifiedRecipeRows.recipe_data
      },
      userSavedRecordId: userSavedEntry?.id || null,
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error, route: req.originalUrl, method: req.method, body: req.body }, 'Critical error in /save-modified route processing');
    res.status(500).json({ error: error.message || 'Internal server error processing save modified recipe request.' });
  }
});

// PATCH /api/recipes/:id - Update an existing recipe (numeric ID for processed_recipes_cache only)
router.patch('/:id(\\d+)', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { patch } = req.body;

    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid patch data' });
    }

    logger.info({ requestId, recipeId: id, patchFields: Object.keys(patch) }, 'Patching recipe');

    // Get the current recipe from processed_recipes_cache only
    const { data: currentRecipe, error: fetchError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentRecipe) {
      logger.error({ requestId, recipeId: id, err: fetchError }, 'Recipe not found in processed_recipes_cache');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Only allow PATCHing user-modified recipes (forks)
    if (!currentRecipe.is_user_modified) {
      logger.warn({ requestId, recipeId: id }, 'Attempted to PATCH non-user-modified recipe');
      return res.status(400).json({ 
        error: 'Cannot modify original recipe. Please fork first.',
        code: 'NEEDS_FORK' 
      });
    }

    // Validate instructions if present
    if (patch.instructions) {
      if (!Array.isArray(patch.instructions)) {
        return res.status(400).json({ error: 'instructions must be an array' });
      }

      for (const s of patch.instructions) {
        if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.text !== 'string') {
          return res.status(400).json({ error: 'each step must have {id: string, text: string}' });
        }
        if (s.note && (typeof s.note !== 'string' || s.note.length > 100)) {
          return res.status(400).json({ error: 'step.note must be ≤ 100 chars' });
        }
      }
    }

    // Merge the patch with existing recipe data
    const merged = {
      ...currentRecipe.recipe_data,
      ...patch,
    };

    // Special handling for instructions - replace wholesale if present
    if (patch.instructions) {
      merged.instructions = patch.instructions;
    }

    // Belt & suspenders - re-enforce recipe_data.id = row.id after merge
    const idNum = parseInt(id);
    merged.id = idNum;

    // Update the recipe in processed_recipes_cache
    const { data: updatedRecipe, error: updateError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .update({ 
        recipe_data: merged 
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error({ requestId, recipeId: id, err: updateError }, 'Failed to update recipe');
      return res.status(500).json({ error: 'Failed to update recipe' });
    }

    logger.info({ requestId, recipeId: id }, 'Successfully patched recipe');

    // Return the full updated canonical recipe row
    res.json({
      message: 'Recipe updated successfully',
      recipe: {
        id: updatedRecipe.id,
        is_user_modified: updatedRecipe.is_user_modified,
        parent_recipe_id: updatedRecipe.parent_recipe_id,
        recipe_data: updatedRecipe.recipe_data
      }
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error, route: req.originalUrl, method: req.method, params: req.params }, 'Error in PATCH /:id route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// --- Recipe Variations Endpoint ---
// POST /api/recipes/variations
router.post('/variations', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const { recipeId, variationType, modifiedRecipeData } = req.body;

    logger.info({ requestId, recipeId, variationType }, '[variations] Received request');

    // Validation
    if (!recipeId || typeof recipeId !== 'number') {
      logger.warn({ requestId, recipeId }, 'Missing or invalid recipeId');
      return res.status(400).json({ error: 'Missing or invalid recipeId' });
    }

    if (!variationType || typeof variationType !== 'string') {
      logger.warn({ requestId, variationType }, 'Missing or invalid variationType');
      return res.status(400).json({ error: 'Missing or invalid variationType' });
    }

    // Validate variation type
    const validVariations = ['low_fat', 'higher_protein', 'gluten_free', 'dairy_free', 'vegetarian', 'easier_recipe'];
    if (!validVariations.includes(variationType)) {
      logger.warn({ requestId, variationType }, 'Invalid variation type');
      return res.status(400).json({ error: 'Invalid variation type' });
    }

    // Fetch original recipe from database
    const { data: originalRecipe, error: fetchError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (fetchError || !originalRecipe) {
      logger.error({ requestId, recipeId, err: fetchError }, 'Recipe not found in processed_recipes_cache');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    logger.info({ requestId, recipeId, variationType }, '[variations] Processing variation request');

    let finalModifiedRecipe = modifiedRecipeData;

    // If no modified data provided, use LLM to generate variations
    if (!finalModifiedRecipe) {
      try {
        logger.info({ requestId, recipeId, variationType }, '[variations] Calling LLM for recipe variation');

        // Build the variation prompt
        const prompt = buildVariationPrompt(originalRecipe.recipe_data, variationType as VariationType);

        // Add metadata to the prompt
        prompt.metadata = {
          requestId,
          route: req.originalUrl
        };

        // Call the LLM
        const llmResponse = await runDefaultLLM(prompt);

        if (llmResponse.error || !llmResponse.output) {
          logger.error({ requestId, error: llmResponse.error }, '[variations] LLM call failed');
          return res.status(500).json({ error: 'Failed to generate recipe variation' });
        }

        logger.info({
          requestId,
          variationType,
          responseLength: llmResponse.output.length,
          responsePreview: llmResponse.output.substring(0, 200)
        }, '[variations] Raw LLM response');

        // Parse the JSON response
        let parsedResponse;
        try {
          // Clean the response - remove any markdown code blocks if present
          let cleanOutput = llmResponse.output.trim();

          // Remove markdown code blocks if present
          if (cleanOutput.startsWith('```json')) {
            cleanOutput = cleanOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanOutput.startsWith('```')) {
            cleanOutput = cleanOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          // Find JSON object in the response
          const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanOutput = jsonMatch[0];
          }

          logger.info({
            requestId,
            cleanOutputPreview: cleanOutput.substring(0, 200)
          }, '[variations] Cleaned LLM response');

          parsedResponse = JSON.parse(cleanOutput);
          logger.info({ requestId, variationType }, '[variations] Successfully parsed LLM response');
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
          logger.error({
            requestId,
            parseError: errorMessage,
            rawOutput: llmResponse.output,
            outputLength: llmResponse.output.length
          }, '[variations] Failed to parse LLM JSON response');
          return res.status(500).json({
            error: 'Failed to parse variation response',
            details: errorMessage,
            responsePreview: llmResponse.output.substring(0, 200)
          });
        }

        // Validate the response has required fields
        if (!parsedResponse.title || !parsedResponse.instructions || !parsedResponse.ingredientGroups) {
          logger.error({ requestId, parsedResponse }, '[variations] LLM response missing required fields');
          return res.status(500).json({ error: 'Invalid variation response structure' });
        }

        // Merge substitutions: LLM only generates for changed ingredients, we copy originals for unchanged
        if (originalRecipe?.recipe_data?.ingredientGroups) {
          parsedResponse.ingredientGroups = mergeSubstitutions(
            originalRecipe.recipe_data.ingredientGroups,
            parsedResponse.ingredientGroups,
            variationType as VariationType
          );
        }

        // Log substitutions info for debugging
        let totalSubstitutions = 0;
        let llmGeneratedSubstitutions = 0;
        let inheritedSubstitutions = 0;

        parsedResponse.ingredientGroups.forEach((group: any) => {
          group.ingredients.forEach((ingredient: any) => {
            if (ingredient.suggested_substitutions && ingredient.suggested_substitutions.length > 0) {
              totalSubstitutions += ingredient.suggested_substitutions.length;
              if (ingredient._substitutionSource === 'llm') {
                llmGeneratedSubstitutions += ingredient.suggested_substitutions.length;
              } else if (ingredient._substitutionSource === 'inherited') {
                inheritedSubstitutions += ingredient.suggested_substitutions.length;
              }
            }
          });
        });

        logger.info({
          requestId,
          variationType,
          totalIngredients: parsedResponse.ingredientGroups.reduce((acc: number, group: any) => acc + group.ingredients.length, 0),
          totalSubstitutions,
          llmGeneratedSubstitutions,
          inheritedSubstitutions,
          substitutionsSample: parsedResponse.ingredientGroups.flatMap((g: any) => g.ingredients).slice(0, 3).map((ing: any) => ({
            name: ing.name,
            hasSubs: !!ing.suggested_substitutions,
            subCount: ing.suggested_substitutions?.length || 0,
            source: ing._substitutionSource
          }))
        }, '[variations] Substitutions analysis after merging');

        // Validate vegetarian recipes don't contain meat/fish
        if (variationType === 'vegetarian') {
          const meatFishKeywords = ['beef', 'chicken', 'pork', 'lamb', 'fish', 'shrimp', 'salmon', 'tuna', 'crab', 'lobster', 'meat', 'poultry', 'seafood'];
          const foundMeatFish: string[] = [];

          parsedResponse.ingredientGroups.forEach((group: any) => {
            group.ingredients.forEach((ingredient: any) => {
              const ingredientName = ingredient.name?.toLowerCase() || '';
              const foundKeyword = meatFishKeywords.find(keyword => ingredientName.includes(keyword));
              if (foundKeyword) {
                foundMeatFish.push(`${ingredient.name} (contains: ${foundKeyword})`);
              }
            });
          });

          if (foundMeatFish.length > 0) {
            logger.error({
              requestId,
              variationType,
              foundMeatFish,
              recipeTitle: parsedResponse.title
            }, '[variations] Vegetarian recipe still contains meat/fish ingredients!');

            return res.status(500).json({
              error: 'Vegetarian recipe validation failed',
              details: `Recipe still contains meat/fish ingredients: ${foundMeatFish.join(', ')}. Please try again.`
            });
          }

          logger.info({ requestId, variationType }, '[variations] Vegetarian validation passed - no meat/fish found');
        }

        finalModifiedRecipe = parsedResponse;

        logger.info({
          requestId,
          variationType,
          usage: llmResponse.usage
        }, '[variations] LLM variation generation successful');

      } catch (llmError) {
        logger.error({ requestId, llmError }, '[variations] LLM call threw exception');
        return res.status(500).json({ error: 'Failed to generate recipe variation' });
      }
    } else {
      logger.info({ requestId, recipeId, variationType }, '[variations] Using provided modified recipe data');
    }

    // --- 1. Generate a new unique URL (UUID) for the modified recipe ---
    const newRecipeUrl = uuidv4(); // Generates a Version 4 UUID

    // --- 2. Insert the modified recipe into processed_recipes_cache ---
    // A) Strip any incoming id field to prevent parent ID pollution
    const { id: _jsonIdDrop, ...cleanModified } = finalModifiedRecipe ?? {};

    // B) Preserve image from parent recipe if it exists
    const parentImage = originalRecipe?.recipe_data?.image;
    const parentThumbnailUrl = originalRecipe?.recipe_data?.thumbnailUrl;

    // C) Merge parent images with modified recipe data
    const finalRecipeData = {
      ...cleanModified,
      ...(parentImage && { image: parentImage }),
      ...(parentThumbnailUrl && { thumbnailUrl: parentThumbnailUrl })
    };

    // D) Insert without ID field to ensure clean data
    const { data: newModifiedRecipeRows, error: insertRecipeError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .insert({
        url: newRecipeUrl,
        recipe_data: finalRecipeData, // Store the recipe with preserved images
        parent_recipe_id: recipeId,
        source_type: 'user_modified', // Add a source type to distinguish modified recipes
        is_user_modified: true, // Explicitly set the boolean flag for modified recipes
      })
      .select('*') // Select all fields to return the full recipe
      .single(); // Expect a single row back

    if (insertRecipeError || !newModifiedRecipeRows) {
      logger.error({ requestId, recipeId, newRecipeUrl, err: insertRecipeError }, 'Failed to insert modified recipe into processed_recipes_cache.');
      return res.status(500).json({ error: 'Failed to save modified recipe content.' });
    }

    const newModifiedRecipeId = newModifiedRecipeRows.id;

    // C) Force JSON id to equal the row id (belt-and-suspenders)
    const { error: updateError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .update({
        recipe_data: { ...finalRecipeData, id: newModifiedRecipeId },
      })
      .eq('id', newModifiedRecipeId);

    if (updateError) {
      logger.warn({ requestId, newModifiedRecipeId, err: updateError }, 'Failed to update recipe_data.id with row ID, but insert succeeded');
      // Continue execution since the main insert succeeded
    } else {
      logger.info({ requestId, newModifiedRecipeId }, 'Successfully updated recipe_data.id to match row ID');
    }

    logger.info({
      requestId,
      newModifiedRecipeId,
      parentRecipeId: recipeId,
      sourceType: 'user_modified',
      isUserModified: true,
      variationType
    }, '[variations] Modified recipe inserted into processed_recipes_cache.');

    // --- 3. Return the modified recipe ---
    const modifiedRecipe = {
      id: newModifiedRecipeRows.id,
      is_user_modified: newModifiedRecipeRows.is_user_modified,
      parent_recipe_id: newModifiedRecipeRows.parent_recipe_id,
      recipe_data: newModifiedRecipeRows.recipe_data
    };

    logger.info({ requestId, recipeId, variationType }, '[variations] Returning modified recipe response');

    res.json({
      message: `Recipe variation (${variationType}) processed successfully`,
      recipe: modifiedRecipe,
      variationType,
      isPlaceholder: !modifiedRecipeData // Indicate if this was a placeholder modification
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error, route: req.originalUrl, method: req.method }, 'Error in /variations route processing');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export const recipeRouter = router;