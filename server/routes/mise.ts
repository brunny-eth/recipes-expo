import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';
import { CombinedParsedRecipe } from '../../common/types';
import { formatIngredientsForGroceryList, categorizeIngredients } from '../../utils/groceryHelpers';
import { aggregateGroceryList } from '../../utils/ingredientAggregation';

const router = Router();

// Middleware to log all incoming requests to this router
router.use((req, res, next) => {
  logger.info({
    requestId: (req as any).id,
    method: req.method,
    path: req.originalUrl,
  }, 'Incoming request to /api/mise router');
  next();
});

// POST /api/mise/save-recipe - Save prepared recipe to mise table
router.post('/save-recipe', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { 
      userId, 
      originalRecipeId, 
      preparedRecipeData, 
      appliedChanges, 
      finalYield,
      titleOverride,
      plannedDate 
    } = req.body;

    logger.info({ 
      requestId, 
      originalRecipeId, 
      userId, 
      titleOverride,
      finalYield 
    }, 'Saving recipe to mise');

    // Validation
    if (!userId || !originalRecipeId || !preparedRecipeData || !appliedChanges) {
      logger.error({ requestId, body: req.body }, 'Missing required fields for saving mise recipe');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into user_mise_recipes
    const { data: miseRecipe, error: insertError } = await supabaseAdmin
      .from('user_mise_recipes')
      .insert({
        user_id: userId,
        original_recipe_id: originalRecipeId,
        title_override: titleOverride || null,
        planned_date: plannedDate || null,
        prepared_recipe_data: preparedRecipeData,
        final_yield: finalYield || null,
        applied_changes: appliedChanges,
        display_order: 0, // New recipes go to top
      })
      .select('id, title_override, final_yield, created_at')
      .single();

    if (insertError || !miseRecipe) {
      logger.error({ requestId, err: insertError }, 'Failed to insert mise recipe');
      return res.status(500).json({ error: 'Failed to save recipe to mise' });
    }

    logger.info({ requestId, miseRecipeId: miseRecipe.id }, 'Successfully saved recipe to mise');

    res.status(201).json({
      message: 'Recipe added to mise!',
      miseRecipe: miseRecipe
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /save-recipe route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/mise/recipes - Get user's staged recipes
router.get('/recipes', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    logger.info({ requestId, userId }, 'Fetching mise recipes');

    const { data: miseRecipes, error: fetchError } = await supabaseAdmin
      .from('user_mise_recipes')
      .select(`
        id,
        original_recipe_id,
        title_override,
        planned_date,
        display_order,
        prepared_recipe_data,
        final_yield,
        applied_changes,
        is_completed,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .eq('is_completed', false) // Only active recipes
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false }); // Newest first within same order

    if (fetchError) {
      logger.error({ requestId, err: fetchError }, 'Failed to fetch mise recipes');
      return res.status(500).json({ error: 'Failed to fetch mise recipes' });
    }

    logger.info({ requestId, count: miseRecipes?.length || 0 }, 'Successfully fetched mise recipes');

    res.json({
      recipes: miseRecipes || []
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /recipes route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// PUT /api/mise/recipes/:id - Update mise recipe
router.put('/recipes/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId, titleOverride, plannedDate, displayOrder, isCompleted } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    logger.info({ requestId, miseRecipeId: id, updates: req.body }, 'Updating mise recipe');

    // Build update object with only provided fields
    const updates: any = { updated_at: new Date().toISOString() };
    if (titleOverride !== undefined) updates.title_override = titleOverride;
    if (plannedDate !== undefined) updates.planned_date = plannedDate;
    if (displayOrder !== undefined) updates.display_order = displayOrder;
    if (isCompleted !== undefined) updates.is_completed = isCompleted;

    const { data: updatedRecipe, error: updateError } = await supabaseAdmin
      .from('user_mise_recipes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns this recipe
      .select('id, title_override, final_yield, is_completed, updated_at')
      .single();

    if (updateError || !updatedRecipe) {
      logger.error({ requestId, err: updateError }, 'Failed to update mise recipe');
      return res.status(500).json({ error: 'Failed to update mise recipe' });
    }

    logger.info({ requestId, miseRecipeId: id }, 'Successfully updated mise recipe');

    res.json({
      message: 'Recipe updated',
      recipe: updatedRecipe
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /recipes/:id PUT route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DELETE /api/mise/recipes/:id - Remove recipe from mise
router.delete('/recipes/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    logger.info({ requestId, miseRecipeId: id, userId }, 'Removing recipe from mise');

    const { error: deleteError } = await supabaseAdmin
      .from('user_mise_recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Ensure user owns this recipe

    if (deleteError) {
      logger.error({ requestId, err: deleteError }, 'Failed to delete mise recipe');
      return res.status(500).json({ error: 'Failed to remove recipe from mise' });
    }

    logger.info({ requestId, miseRecipeId: id }, 'Successfully removed recipe from mise');

    res.json({
      message: 'Recipe removed from mise'
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /recipes/:id DELETE route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/mise/grocery-list - Get aggregated grocery list from all active mise recipes
router.get('/grocery-list', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId parameter' });
    }

    logger.info({ requestId, userId }, 'Fetching aggregated grocery list');

    // Get all active mise recipes for the user
    const { data: miseRecipes, error: fetchError } = await supabaseAdmin
      .from('user_mise_recipes')
      .select('id, prepared_recipe_data, title_override')
      .eq('user_id', userId)
      .eq('is_completed', false);

    if (fetchError) {
      logger.error({ requestId, err: fetchError }, 'Failed to fetch mise recipes for grocery list');
      return res.status(500).json({ error: 'Failed to fetch recipes' });
    }

    // Extract ingredients from all recipes and create grocery items
    let allGroceryItems: any[] = [];
    
    for (const miseRecipe of miseRecipes || []) {
      const recipe = miseRecipe.prepared_recipe_data as CombinedParsedRecipe;
      const shoppingListId = `mise_${Date.now()}`;
      
      // Format ingredients for this recipe
      const recipeGroceryItems = formatIngredientsForGroceryList(
        recipe,
        shoppingListId,
        undefined
      );
      
      // Add source information
      const itemsWithSource = recipeGroceryItems.map((item: any) => ({
        ...item,
        source_mise_recipe_id: miseRecipe.id,
        source_recipe_title: miseRecipe.title_override || recipe.title || 'Unknown Recipe',
      }));
      
      allGroceryItems.push(...itemsWithSource);
    }

    // Aggregate the grocery list
    const aggregatedItems = aggregateGroceryList(allGroceryItems);

    // Apply basic categorization
    const categorizedItems = categorizeIngredients(aggregatedItems);

    // --- NEW: Fetch persistent checked states ---
    const { data: checkedStates, error: checkedStatesError } = await supabaseAdmin
      .from('user_shopping_list_item_states')
      .select('normalized_item_name, is_checked')
      .eq('user_id', userId);

    if (checkedStatesError) {
      logger.error({ requestId, err: checkedStatesError }, 'Failed to fetch checked states');
      // This is a critical failure. The user's list would appear incorrect.
      return res.status(500).json({ error: 'Failed to retrieve shopping list state.' });
    }

    // --- NEW: Merge checked states into the grocery list ---
    const checkedStatesMap = new Map(
      checkedStates?.map(s => [s.normalized_item_name, s.is_checked]) || []
    );

    const finalItems = categorizedItems.map(item => ({
      ...item,
      is_checked: checkedStatesMap.get(normalizeName(item.item_name)) || false,
    }));


    logger.info({ 
      requestId, 
      totalItems: finalItems.length, 
      recipeCount: miseRecipes?.length || 0 
    }, 'Successfully created aggregated grocery list with persistent states');

    logger.info({ requestId, finalItems }, 'Sending cleaned grocery list data to frontend');

    res.json({
      items: finalItems,
      sourceRecipes: miseRecipes?.map(r => ({
        id: r.id,
        title: r.title_override || (r.prepared_recipe_data as any)?.title || 'Unknown Recipe'
      })) || []
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /grocery-list route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// --- NEW Endpoint: Update the checked state of a grocery list item ---
router.post('/grocery-item-state', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  try {
    const { userId, itemName, isChecked } = req.body;

    if (!userId || typeof itemName !== 'string' || typeof isChecked !== 'boolean') {
      return res.status(400).json({ error: 'Missing or invalid parameters' });
    }

    const normalizedItemName = normalizeName(itemName);

    logger.info({ requestId, userId, normalizedItemName, isChecked }, 'Updating grocery item state');

    const { error: upsertError } = await supabaseAdmin
      .from('user_shopping_list_item_states')
      .upsert(
        {
          user_id: userId,
          normalized_item_name: normalizedItemName,
          is_checked: isChecked,
        },
        {
          onConflict: 'user_id, normalized_item_name',
        }
      );

    if (upsertError) {
      logger.error({ requestId, err: upsertError }, 'Failed to upsert grocery item state');
      return res.status(500).json({ error: 'Failed to update item state' });
    }

    res.status(200).json({ message: 'State updated successfully' });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /grocery-item-state route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Helper function to normalize name (can be moved to a shared util if needed)
function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();
  if (normalized.endsWith('s')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}


export { router as miseRouter }; 