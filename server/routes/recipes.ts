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
import { IngredientChange } from '../llm/modificationPrompts';
import logger from '../lib/logger'; 
import { ParseErrorCode } from '../../common/types/errors';
import { ImageData } from '../services/parseImageRecipe';

interface SaveModifiedRecipeRequestBody {
  originalRecipeId: number;
  originalRecipeData: CombinedParsedRecipe;
  userId: string;
  modifiedRecipeData: CombinedParsedRecipe;
  appliedChanges: { // Ensure this matches the exact structure from frontend
    ingredientChanges: IngredientChange[];
    scalingFactor: number;
  };
  folderId: number; // Add folder support
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
    const { originalRecipeId, originalRecipeData, userId, modifiedRecipeData, appliedChanges, folderId, saved_id } = req.body;

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
    if (!originalRecipeId || !originalRecipeData || !userId || !modifiedRecipeData || !appliedChanges || !folderId) {
      logger.error({ requestId, body: req.body }, 'Missing required fields for saving modified recipe.');
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Verify folder exists and belongs to user
    const { data: folder, error: folderError } = await supabaseAdmin
      .from('user_saved_folders')
      .select('id')
      .eq('user_id', userId)
      .eq('id', folderId)
      .single();

    if (folderError || !folder) {
      logger.error({ requestId, userId, folderId, folderError }, 'Invalid folder or folder does not exist.');
      return res.status(400).json({ error: 'Invalid folder selected.' });
    }
    if (!modifiedRecipeData.title || !modifiedRecipeData.instructions || modifiedRecipeData.instructions.length === 0 || !modifiedRecipeData.ingredientGroups || modifiedRecipeData.ingredientGroups.length === 0) {
        logger.error({ requestId, modifiedRecipeData }, 'Modified recipe data is incomplete or invalid.');
        return res.status(400).json({ error: 'Incomplete modified recipe data provided.' });
    }

    // Use the original recipe data passed directly from the client
    const originalRecipe = { recipe_data: originalRecipeData };

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
      .select('id, url') // Select the new id and url to return them
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

    // --- 4. Insert into user_saved_recipes ---
    // This links the user to their newly saved modified recipe in the cache
    const { data: userSavedEntry, error: insertUserSavedError } = await supabaseAdmin
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

    if (insertUserSavedError || !userSavedEntry) {
      // IMPORTANT: If this fails, consider rolling back the processed_recipes_cache insert
      // For now, we'll log an error. A transaction would be ideal here if supported directly.
      logger.error({ requestId, newModifiedRecipeId, userId, err: insertUserSavedError }, 'Failed to insert into user_saved_recipes.');
      // You might want to delete the entry from processed_recipes_cache here
      // await supabaseAdmin.from('processed_recipes_cache').delete().eq('id', newModifiedRecipeId);
      return res.status(500).json({ error: 'Failed to record saved recipe for user.' });
    }

    logger.info({ requestId, userSavedEntryId: userSavedEntry.id }, 'User saved recipe entry created.');

    // --- 5. Handle saved_id parameter (update existing saved recipe to point to new fork) ---
    if (saved_id) {
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
        logger.info({ requestId, saved_id, newForkedRecipeId: newModifiedRecipeId }, 'Updated existing saved recipe to point to new fork');
      }
    }

    // --- 6. Send Success Response ---
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

// PATCH /api/recipes/:id - Update an existing recipe (typically a user-modified fork)
router.patch('/:id(\\d+)', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { patch } = req.body;

    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid patch data' });
    }

    logger.info({ requestId, recipeId: id, patchFields: Object.keys(patch) }, 'Patching recipe');

    // Get the current recipe to verify it exists and is user-modified
    const { data: currentRecipe, error: fetchError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('recipe_data, is_user_modified')
      .eq('id', id)
      .single();

    if (fetchError || !currentRecipe) {
      logger.error({ requestId, recipeId: id, err: fetchError }, 'Recipe not found');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Only allow PATCHing user-modified recipes (forks)
    if (!currentRecipe.is_user_modified) {
      logger.warn({ requestId, recipeId: id }, 'Attempted to PATCH non-user-modified recipe');
      return res.status(403).json({ error: 'Can only update user-modified recipes' });
    }

    // Merge the patch with existing recipe data
    const updatedRecipeData = {
      ...currentRecipe.recipe_data,
      ...patch,
      // Ensure the ID field matches the row ID
      id: parseInt(id),
    };

    // Update the recipe_data column
    const { data: updatedRecipe, error: updateError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .update({
        recipe_data: updatedRecipeData,
        // Don't update last_processed_at - that's for pipeline processing, not user edits
        // The updated_at field will be automatically updated by the database trigger
        // 
        // TODO: Add this database schema change:
        // ALTER TABLE processed_recipes_cache ADD COLUMN updated_at timestamptz DEFAULT now();
        // CREATE OR REPLACE FUNCTION update_updated_at_column()
        // RETURNS TRIGGER AS $$
        // BEGIN
        //   NEW.updated_at = now();
        //   RETURN NEW;
        // END;
        // $$ language 'plpgsql';
        // CREATE TRIGGER update_processed_recipes_cache_updated_at 
        //   BEFORE UPDATE ON processed_recipes_cache 
        //   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      })
      .eq('id', id)
      .select('id, recipe_data')
      .single();

    if (updateError) {
      logger.error({ requestId, recipeId: id, err: updateError }, 'Failed to update recipe');
      return res.status(500).json({ error: 'Failed to update recipe' });
    }

    logger.info({ requestId, recipeId: id }, 'Successfully patched recipe');

    res.json({
      message: 'Recipe updated successfully',
      recipe: updatedRecipe,
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error, route: req.originalUrl, method: req.method, params: req.params }, 'Error in PATCH /:id route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export const recipeRouter = router;