import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';

const router = Router();

// GET /api/saved/folders - Get all saved folders for the user
router.get('/folders', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId parameter' });
    }

    logger.info({ requestId, userId }, 'Fetching saved folders for user');

    const { data: foldersData, error: foldersError } = await supabaseAdmin
      .from('user_saved_folders')
      .select(`
        id,
        name,
        color,
        icon,
        display_order,
        user_saved_recipes!folder_id(count)
      `)
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

    if (foldersError) {
      logger.error({ requestId, err: foldersError }, 'Failed to fetch saved folders');
      return res.status(500).json({ error: 'Failed to fetch saved folders' });
    }

    const formattedFolders = foldersData?.map(folder => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      display_order: folder.display_order,
      recipe_count: (folder.user_saved_recipes as any)?.[0]?.count || 0,
    })) || [];

    logger.info({ requestId, folderCount: formattedFolders.length }, 'Successfully fetched saved folders');

    res.json({
      folders: formattedFolders
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /folders GET route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/saved/folders/:id - Get specific folder details
router.get('/folders/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId parameter' });
    }

    logger.info({ requestId, folderId: id, userId }, 'Fetching folder details');

    const { data: folderData, error: folderError } = await supabaseAdmin
      .from('user_saved_folders')
      .select('id, name, color, icon, display_order')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (folderError) {
      logger.error({ requestId, err: folderError }, 'Failed to fetch folder details');
      return res.status(500).json({ error: 'Failed to fetch folder details' });
    }

    if (!folderData) {
      logger.warn({ requestId, folderId: id }, 'Folder not found or user does not own it');
      return res.status(404).json({ error: 'Folder not found' });
    }

    logger.info({ requestId, folderId: id }, 'Successfully fetched folder details');

    res.json({
      folder: folderData
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /folders/:id GET route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/saved/folders/:id/recipes - Get recipes in a specific folder
router.get('/folders/:id/recipes', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId parameter' });
    }

    logger.info({ requestId, folderId: id, userId }, 'Fetching recipes in folder');

    // First verify the folder belongs to the user
    const { data: folderData, error: folderError } = await supabaseAdmin
      .from('user_saved_folders')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (folderError || !folderData) {
      logger.warn({ requestId, folderId: id }, 'Folder not found or user does not own it');
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Fetch recipes in the folder
    const { data, error: fetchError } = await supabaseAdmin
      .from('user_saved_recipes')
      .select(`
        base_recipe_id,
        title_override,
        applied_changes,
        original_recipe_data,
        display_order,
        created_at,
        processed_recipes_cache (
          id,
          recipe_data,
          source_type,
          parent_recipe_id
        )
      `)
      .eq('user_id', userId)
      .eq('folder_id', id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false }); // Most recently created first
      // TODO: Add updated_at column to user_saved_recipes table for better sorting
      // ALTER TABLE user_saved_recipes ADD COLUMN updated_at timestamptz DEFAULT now();
      // CREATE TRIGGER update_user_saved_recipes_updated_at BEFORE UPDATE ON user_saved_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    if (fetchError) {
      logger.error({ requestId, err: fetchError }, 'Failed to fetch folder recipes');
      return res.status(500).json({ error: 'Failed to fetch recipes' });
    }

    const validRecipes = ((data as any[])?.filter(
      (r) => r.processed_recipes_cache?.recipe_data,
    )) || [];

    logger.info({ requestId, folderId: id, recipeCount: validRecipes.length }, 'Successfully fetched folder recipes');

    res.json({
      recipes: validRecipes
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /folders/:id/recipes GET route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DELETE /api/saved/folders/:id - Delete a folder (and remove all saved recipes inside it for this user)
router.delete('/folders/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    logger.info({ requestId, folderId: id, userId }, 'Deleting folder and contained saved recipes');

    // First, delete saved recipes within this folder for the user
    const { error: recipesDeleteError } = await supabaseAdmin
      .from('user_saved_recipes')
      .delete()
      .eq('user_id', userId)
      .eq('folder_id', id);

    if (recipesDeleteError) {
      logger.error({ requestId, err: recipesDeleteError }, 'Failed to delete saved recipes before folder deletion');
      return res.status(500).json({ error: 'Failed to remove recipes in folder' });
    }

    // Then, delete the folder itself
    const { error: folderDeleteError } = await supabaseAdmin
      .from('user_saved_folders')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (folderDeleteError) {
      logger.error({ requestId, err: folderDeleteError }, 'Failed to delete folder after removing recipes');
      return res.status(500).json({ error: 'Failed to delete folder' });
    }

    logger.info({ requestId, folderId: id }, 'Successfully deleted folder and its recipes');

    res.json({
      message: 'Folder and its recipes deleted successfully'
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /folders/:id DELETE route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// PUT /api/saved/folders/:id - Update folder properties
router.put('/folders/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId, color, name } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    logger.info({ requestId, folderId: id, userId, color, name }, 'Updating folder');

    const updateData: any = {};
    if (color !== undefined) updateData.color = color;
    if (name !== undefined) updateData.name = name;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_saved_folders')
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', id);

    if (updateError) {
      logger.error({ requestId, err: updateError }, 'Failed to update folder');
      return res.status(500).json({ error: 'Failed to update folder' });
    }

    logger.info({ requestId, folderId: id }, 'Successfully updated folder');

    res.json({
      message: 'Folder updated successfully'
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /folders/:id PUT route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DELETE /api/saved/recipes/:id - Remove recipe from saved folder
router.delete('/recipes/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    logger.info({ requestId, savedRecipeId: id, userId }, 'Removing recipe from saved folder');

    const { error: deleteError } = await supabaseAdmin
      .from('user_saved_recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      logger.error({ requestId, err: deleteError }, 'Failed to remove saved recipe');
      return res.status(500).json({ error: 'Failed to remove recipe' });
    }

    logger.info({ requestId, savedRecipeId: id }, 'Successfully removed saved recipe');

    res.json({
      message: 'Recipe removed from saved folder successfully'
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /recipes/:id DELETE route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// PATCH /api/saved/recipes/:id - Update saved recipe modifications
router.patch('/recipes/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId, patch } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid patch data' });
    }

    logger.info({ requestId, savedRecipeId: id, userId, patchFields: Object.keys(patch) }, 'Patching saved recipe');

    // Get the current saved recipe to verify ownership
    const { data: currentSavedRecipe, error: fetchError } = await supabaseAdmin
      .from('user_saved_recipes')
      .select('id, user_id, applied_changes, original_recipe_data')
      .eq('id', id)
      .single();

    if (fetchError || !currentSavedRecipe) {
      logger.error({ requestId, savedRecipeId: id, err: fetchError }, 'Saved recipe not found');
      return res.status(404).json({ error: 'Saved recipe not found' });
    }

    // Verify user owns this saved recipe
    if (currentSavedRecipe.user_id !== userId) {
      logger.warn({ requestId, savedRecipeId: id, userId }, 'User does not own this saved recipe');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prepare the update data
    const updateData: any = {};

    // Update applied_changes if provided
    if (patch.applied_changes) {
      updateData.applied_changes = patch.applied_changes;
    }

    // Update title_override if provided
    if (patch.title_override !== undefined) {
      updateData.title_override = patch.title_override;
    }

    // Update notes if provided
    if (patch.notes !== undefined) {
      updateData.notes = patch.notes;
    }

    // Update the saved recipe
    const { data: updatedSavedRecipe, error: updateError } = await supabaseAdmin
      .from('user_saved_recipes')
      .update(updateData)
      .eq('id', id)
      .select('id, applied_changes, title_override, notes')
      .single();

    if (updateError) {
      logger.error({ requestId, savedRecipeId: id, err: updateError }, 'Failed to update saved recipe');
      return res.status(500).json({ error: 'Failed to update saved recipe' });
    }

    logger.info({ requestId, savedRecipeId: id }, 'Successfully patched saved recipe');

    res.json({
      message: 'Saved recipe updated successfully',
      savedRecipe: updatedSavedRecipe,
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in PATCH /recipes/:id route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/saved/recipes - Get user's saved recipes
router.get('/recipes', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { userId, baseRecipeId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    logger.info({ requestId, userId, baseRecipeId }, 'Fetching saved recipes');

    let query = supabaseAdmin
      .from('user_saved_recipes')
      .select(`
        id,
        base_recipe_id,
        title_override,
        applied_changes,
        original_recipe_data,
        display_order,
        created_at,
        processed_recipes_cache (
          id,
          recipe_data,
          source_type,
          parent_recipe_id
        )
      `)
      .eq('user_id', userId);

    // If baseRecipeId is provided, filter by it
    if (baseRecipeId) {
      query = query.eq('base_recipe_id', baseRecipeId);
    }

    const { data, error: fetchError } = await query
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false }); // Most recently created first

    if (fetchError) {
      logger.error({ requestId, err: fetchError }, 'Failed to fetch saved recipes');
      return res.status(500).json({ error: 'Failed to fetch saved recipes' });
    }

    const validRecipes = ((data as any[])?.filter(
      (r) => r.processed_recipes_cache?.recipe_data,
    )) || [];

    logger.info({ requestId, count: validRecipes.length }, 'Successfully fetched saved recipes');

    res.json({
      recipes: validRecipes
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /recipes GET route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 