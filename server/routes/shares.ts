import express from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';

const router = express.Router();

// CORS middleware for share routes
const corsHeaders = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "https://cookolea.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
};

// Generate a random alphanumeric slug (8-10 characters)
function generateSlug(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 8 + Math.floor(Math.random() * 3); // 8-10 characters
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/share - Create or retrieve a share slug for recipe or folder
router.post('/api/share', corsHeaders, async (req, res) => {
  const requestId = (req as any).id;
  
  try {
    const { type, objectId, userId } = req.body;

    // Enhanced validation
    if (!type || typeof type !== 'string' || !['recipe', 'folder'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid or missing type. Must be "recipe" or "folder"',
        received: type 
      });
    }

    if (!objectId || typeof objectId !== 'number' || !Number.isInteger(objectId) || objectId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid or missing objectId. Must be a positive integer',
        received: objectId 
      });
    }

    // userId is optional - validate only if provided
    if (userId !== undefined && (!userId || typeof userId !== 'string' || userId.trim() === '')) {
      return res.status(400).json({ 
        error: 'Invalid userId. Must be a non-empty string if provided',
        received: userId 
      });
    }

    logger.info({ 
      requestId, 
      scope: "shares", 
      action: "create", 
      type, 
      objectId, 
      userId: userId || null,
      hasUserId: !!userId
    }, 'Creating share for object');

    // Check if a share already exists for this object
    let query = supabaseAdmin
      .from('public_shares')
      .select('slug')
      .eq('type', type)
      .eq('object_id', objectId)
      .is('revoked_at', null);

    // Only filter by created_by if userId is provided
    if (userId) {
      query = query.eq('created_by', userId);
    } else {
      query = query.is('created_by', null);
    }

    const { data: existingShare, error: checkError } = await query.single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error({ 
        requestId, 
        scope: "shares", 
        action: "check_existing_failed", 
        error: checkError.message, 
        details: checkError.details,
        userId: userId || null,
        hasUserId: !!userId
      }, 'Error checking for existing share');
      return res.status(500).json({ 
        error: 'Failed to check for existing share',
        details: checkError.message 
      });
    }

    // If share already exists, return it
    if (existingShare) {
      const prefix = type === 'recipe' ? 'r' : 'f';
      const url = `https://cookolea.com/${prefix}/${existingShare.slug}`;
      
      logger.info({ 
        requestId, 
        scope: "shares", 
        action: "create", 
        type, 
        objectId, 
        slug: existingShare.slug 
      }, 'Returning existing share');

      return res.json({ 
        slug: existingShare.slug, 
        url 
      });
    }

    // Prepare for retry logic
    const prefix = type === 'recipe' ? 'r' : 'f';

    let snapshotJson = null;

    // If type is folder, create snapshot of recipes
    if (type === 'folder') {
      logger.info({ requestId, folderId: objectId }, 'Creating folder snapshot');

      // First fetch folder title
      const { data: folderData, error: folderError } = await supabaseAdmin
        .from('user_saved_folders')
        .select('name')
        .eq('id', objectId)
        .single();

      if (folderError || !folderData) {
        logger.warn({ 
          requestId, 
          scope: "shares", 
          action: "snapshot", 
          objectId, 
          error: folderError?.message 
        }, "Folder not found for snapshot");
        return res.status(404).json({ error: "Folder not found" });
      }

      // Fetch folder recipes (max 100) with canonical recipe IDs
      const { data: folderRecipes, error: recipesError } = await supabaseAdmin
        .from('user_saved_recipes')
        .select(`
          base_recipe_id,
          processed_recipes_cache!inner(id, recipe_data)
        `)
        .eq('folder_id', objectId)
        .limit(100);

      if (recipesError) {
        logger.error({ 
          requestId, 
          scope: "shares", 
          action: "snapshot", 
          objectId, 
          error: recipesError.message 
        }, "Failed to fetch folder recipes");
        return res.status(500).json({ error: "Failed to fetch folder recipes" });
      }

      // Build snapshot with canonical recipe IDs and null-safe handling
      // Always ensure snapshot_json is set, even for empty folders
      snapshotJson = {
        title: folderData.name || "Untitled Folder",
        recipes: (folderRecipes || []).map(ur => {
          const recipeData = ur.processed_recipes_cache.recipe_data as any;
          return {
            id: ur.processed_recipes_cache.id,          // canonical recipe id
            title: recipeData?.title ?? "Untitled Recipe",
            image: recipeData?.image ?? null,
          };
        })
      };

      logger.info({ 
        requestId, 
        scope: "shares", 
        action: "snapshot_created", 
        objectId, 
        count: snapshotJson.recipes.length 
      }, "Folder snapshot created");
    }

    // Retry logic for slug generation and insert (up to 5 attempts)
    let newShare = null;
    let insertError = null;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const slug = generateSlug();
      
      logger.info({ 
        requestId, 
        attempt, 
        maxRetries, 
        slug 
      }, 'Attempting to create share record');

      const { data: shareData, error: error } = await supabaseAdmin
        .from('public_shares')
        .insert({
          slug: slug!,
          type,
          object_id: objectId,
          snapshot_json: snapshotJson,
          created_by: userId || null
        })
        .select('slug')
        .single();

      if (!error) {
        newShare = shareData;
        insertError = null;
        break;
      }

      // Check if it's a unique violation error (23505)
      if (error.code === '23505') {
        logger.warn({ 
          requestId, 
          attempt, 
          maxRetries, 
          slug, 
          errorCode: error.code 
        }, 'Slug collision, retrying with new slug');
        insertError = error;
        continue;
      }

      // For non-unique violation errors, fail immediately
      insertError = error;
      break;
    }

    if (insertError || !newShare) {
      logger.error({ 
        requestId, 
        scope: "shares", 
        action: "create_failed", 
        errorCode: insertError?.code, 
        errorMessage: insertError?.message, 
        payload: { type, objectId, userId: userId || null, hasUserId: !!userId } 
      }, 'Failed to create share record after all retries');
      return res.status(500).json({ error: 'Failed to create share' });
    }

    const url = `https://cookolea.com/${prefix}/${newShare.slug}`;

    logger.info({ 
      requestId, 
      scope: "shares", 
      action: "create", 
      type, 
      objectId, 
      slug: newShare.slug,
      userId: userId || null,
      hasUserId: !!userId
    }, 'Successfully created share');

    res.json({ 
      slug: newShare.slug, 
      url 
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in POST /api/share route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/public-shares/:slug - Fetch share data by slug
router.get('/api/public-shares/:slug', corsHeaders, async (req, res) => {
  const requestId = (req as any).id;
  
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid or missing slug parameter. Must be a non-empty string',
        received: slug 
      });
    }

    logger.info({ 
      requestId, 
      scope: "shares", 
      action: "open", 
      slug 
    }, 'Fetching share data');

    // Look up the share by slug
    const { data: shareData, error: shareError } = await supabaseAdmin
      .from('public_shares')
      .select('*')
      .eq('slug', slug)
      .is('revoked_at', null)
      .single();

    if (shareError || !shareData) {
      logger.warn({ requestId, slug }, 'Share not found or revoked');
      return res.status(404).json({ error: 'Share not found or has been revoked' });
    }

    // Increment open_count
    const { error: updateError } = await supabaseAdmin
      .from('public_shares')
      .update({ open_count: (shareData.open_count || 0) + 1 })
      .eq('slug', slug);

    if (updateError) {
      logger.warn({ requestId, slug, err: updateError }, 'Failed to increment open_count');
      // Don't fail the request, just log the warning
    }

    // Handle recipe shares
    if (shareData.type === 'recipe') {
      logger.info({ requestId, slug, recipeId: shareData.object_id }, 'Fetching recipe data');

      // Fetch live recipe data from processed_recipes_cache
      const { data: recipeData, error: recipeError } = await supabaseAdmin
        .from('processed_recipes_cache')
        .select('id, recipe_data, source_type, parent_recipe_id')
        .eq('id', shareData.object_id)
        .single();

      if (recipeError || !recipeData || !recipeData.recipe_data) {
        logger.error({ requestId, slug, recipeId: shareData.object_id, err: recipeError }, 'Failed to fetch recipe data');
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const recipe = recipeData.recipe_data as any;
      
      // Normalize recipe data to match Summary.tsx expectations
      const normalizedRecipe = {
        id: recipeData.id,
        title: recipe.title || 'Untitled Recipe',
        image: recipe.image || recipe.thumbnailUrl || null,
        description: recipe.description || recipe.shortDescription || null,
        ingredientGroups: recipe.ingredientGroups || [],
        instructions: recipe.instructions || [],
        sourceUrl: recipe.sourceUrl || null,
        recipeYield: recipe.recipeYield || null,
        prepTime: recipe.prepTime || null,
        cookTime: recipe.cookTime || null,
        totalTime: recipe.totalTime || null,
        nutrition: recipe.nutrition || null,
        tips: recipe.tips || null,
        substitutions_text: recipe.substitutions_text || null,
        source_type: recipeData.source_type,
        parent_recipe_id: recipeData.parent_recipe_id,
        created_at: recipe.created_at,
        last_processed_at: recipe.last_processed_at
      };

      logger.info({ 
        requestId, 
        scope: "shares", 
        action: "open", 
        slug, 
        type: "recipe" 
      }, 'Successfully fetched recipe share');

      return res.json(normalizedRecipe);
    }

    // Handle folder shares
    if (shareData.type === 'folder') {
      logger.info({ requestId, slug, folderId: shareData.object_id }, 'Fetching folder data');

      if (!shareData.snapshot_json) {
        logger.error({ requestId, slug, folderId: shareData.object_id }, 'Folder snapshot not found');
        return res.status(404).json({ error: 'Folder data not available' });
      }

      const snapshot = shareData.snapshot_json as any;
      
      // Use the new snapshot structure with title and recipes array
      const folderData = {
        kind: 'folder',
        title: snapshot.title || 'Shared Recipe Collection',
        recipes: snapshot.recipes || []
      };

      logger.info({ 
        requestId, 
        scope: "shares", 
        action: "open", 
        slug, 
        type: "folder",
        recipeCount: snapshot.length
      }, 'Successfully fetched folder share');

      return res.json(folderData);
    }

    // Invalid type
    logger.error({ requestId, slug, type: shareData.type }, 'Invalid share type');
    return res.status(500).json({ error: 'Invalid share type' });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in GET /api/public-shares/:slug route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/duplicate-folder/:slug - Duplicate a shared folder for the current user
router.post('/api/duplicate-folder/:slug', corsHeaders, async (req, res) => {
  const requestId = (req as any).id;
  
  try {
    const { slug } = req.params;
    const { userId } = req.body;

    // Enhanced validation
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid or missing slug parameter. Must be a non-empty string',
        received: slug 
      });
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid or missing userId. Must be a non-empty string',
        received: userId 
      });
    }

    logger.info({ 
      requestId, 
      scope: "shares", 
      action: "duplicate_folder", 
      slug,
      userId
    }, 'Starting folder duplication');

    // Step 1: Resolve slug in public_shares - must be type folder
    const { data: shareData, error: shareError } = await supabaseAdmin
      .from('public_shares')
      .select('*')
      .eq('slug', slug)
      .eq('type', 'folder')
      .is('revoked_at', null)
      .single();

    if (shareError || !shareData) {
      logger.warn({ 
        requestId, 
        scope: "shares", 
        action: "duplicate_folder", 
        slug,
        error: shareError?.message 
      }, 'Share not found or not a folder');
      return res.status(404).json({ error: 'Folder share not found or has been revoked' });
    }

    const originalFolderId = shareData.object_id;

    // Step 2: Fetch original folder data using supabaseAdmin
    const { data: originalFolder, error: folderError } = await supabaseAdmin
      .from('user_saved_folders')
      .select('name, color, icon, display_order, is_system')
      .eq('id', originalFolderId)
      .single();

    if (folderError || !originalFolder) {
      logger.error({ 
        requestId, 
        scope: "shares", 
        action: "duplicate_folder", 
        slug,
        folderId: originalFolderId,
        error: folderError?.message 
      }, 'Original folder not found');
      return res.status(404).json({ error: 'Original folder not found' });
    }

    // Step 3: Fetch original folder recipes (max 100) using supabaseAdmin
    const { data: originalRecipes, error: recipesError } = await supabaseAdmin
      .from('user_saved_recipes')
      .select('base_recipe_id, title_override, notes, applied_changes, display_order')
      .eq('folder_id', originalFolderId)
      .limit(100);

    if (recipesError) {
      logger.error({ 
        requestId, 
        scope: "shares", 
        action: "duplicate_folder", 
        slug,
        folderId: originalFolderId,
        error: recipesError.message 
      }, 'Failed to fetch original folder recipes');
      return res.status(500).json({ error: 'Failed to fetch original folder recipes' });
    }

    const recipesToDuplicate = originalRecipes || [];
    
    // Enforce 100 recipe cap
    if (recipesToDuplicate.length > 100) {
      logger.warn({ 
        requestId, 
        scope: "shares", 
        action: "duplicate_folder", 
        slug,
        folderId: originalFolderId,
        recipeCount: recipesToDuplicate.length
      }, 'Folder has more than 100 recipes, capping at 100');
    }

    // Step 4: Insert new folder for the current user
    const { data: newFolder, error: newFolderError } = await supabaseAdmin
      .from('user_saved_folders')
      .insert({
        user_id: userId,
        name: originalFolder.name,
        color: originalFolder.color,
        icon: originalFolder.icon,
        display_order: originalFolder.display_order,
        is_system: false // Always false for duplicated folders
      })
      .select('id')
      .single();

    if (newFolderError || !newFolder) {
      // Check if it's a duplicate folder name error
      if (newFolderError?.code === '23505' && newFolderError?.message?.includes('user_saved_folders_user_id_name_key')) {
        logger.info({ 
          requestId, 
          scope: "shares", 
          action: "duplicate_folder", 
          slug,
          userId,
          folderName: originalFolder.name
        }, 'User already has a folder with this name');
        return res.status(409).json({ 
          error: 'You already have this folder!',
          code: 'FOLDER_ALREADY_EXISTS'
        });
      }
      
      logger.error({ 
        requestId, 
        scope: "shares", 
        action: "duplicate_folder", 
        slug,
        userId,
        error: newFolderError?.message 
      }, 'Failed to create new folder');
      return res.status(500).json({ error: 'Failed to create new folder' });
    }

    const newFolderId = newFolder.id;

    // Step 5: Insert cloned recipes into user_saved_recipes
    if (recipesToDuplicate.length > 0) {
      const recipesToInsert = recipesToDuplicate.slice(0, 100).map(recipe => ({
        user_id: userId,
        base_recipe_id: recipe.base_recipe_id,
        title_override: recipe.title_override,
        notes: recipe.notes,
        applied_changes: recipe.applied_changes,
        folder_id: newFolderId,
        display_order: recipe.display_order
      }));

      const { error: insertRecipesError } = await supabaseAdmin
        .from('user_saved_recipes')
        .insert(recipesToInsert);

      if (insertRecipesError) {
        logger.error({ 
          requestId, 
          scope: "shares", 
          action: "duplicate_folder", 
          slug,
          userId,
          newFolderId,
          recipeCount: recipesToInsert.length,
          error: insertRecipesError.message 
        }, 'Failed to insert cloned recipes');
        
        // Clean up the created folder
        await supabaseAdmin
          .from('user_saved_folders')
          .delete()
          .eq('id', newFolderId);
        
        return res.status(500).json({ error: 'Failed to duplicate recipes' });
      }
    }

    logger.info({ 
      requestId, 
      scope: "shares", 
      action: "duplicate_folder", 
      slug,
      userId,
      newFolderId,
      recipeCount: recipesToDuplicate.length
    }, 'Successfully duplicated folder');

    res.json({ 
      success: true, 
      newFolder: {
        id: newFolderId,
        name: originalFolder.name,
        color: originalFolder.color,
        icon: originalFolder.icon,
        recipeCount: recipesToDuplicate.length
      }
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in POST /api/duplicate-folder/:slug route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export { router as sharesRouter };
