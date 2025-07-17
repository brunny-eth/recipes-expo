import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';
import { CombinedParsedRecipe, IngredientGroup, StructuredIngredient } from '../../common/types';
import { formatIngredientsForGroceryList, categorizeIngredients, getBasicGroceryCategory } from '../../utils/groceryHelpers';

import { aggregateGroceryList } from '../../utils/ingredientAggregation';
import { runDefaultLLM } from '../llm/adapters';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';

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

/**
 * Server-side LLM categorization function
 * Categorizes ingredients using LLM with fallback to basic categorization
 */
async function categorizeIngredientsWithServerLLM(
  items: any[],
  requestId: string
): Promise<any[]> {
  if (items.length === 0) {
    return items;
  }

  // Extract unique ingredient names
  const ingredientNames = [...new Set(items.map(item => item.item_name))];
  
  try {
    // Build the categorization prompt (same as grocery.ts)
    const ingredientList = ingredientNames.map(ing => `"${ing}"`).join(', ');
    
    const systemPrompt = `
You are an expert grocery organizer. Categorize the following ingredients into appropriate grocery store sections.

Available categories:
- Produce
- Dairy & Eggs  
- Meat & Seafood
- Pantry
- Bakery
- Frozen
- Beverages
- Condiments & Sauces
- Spices & Herbs
- Snacks
- Health & Personal Care
- Other

Rules:
1. Use the exact category names from the list above.
2. Be consistent - same ingredients should always go to the same category.
3. If an ingredient could fit multiple categories, choose the one where the ingredient is most commonly found in a grocery store.
4. For prepared or processed items, categorize based on where they're typically found in stores (frozen, pantry, etc).
5. Fresh ingredients, like fresh herbs or fresh produce, should be categorized as "Produce".
6. Exclude all forms of salt and all forms of black pepper from the categories and simply ignore them. 

Return your response as a JSON object where each ingredient name is a key and its category is the value.

Example:
{
  "chicken breast": "Meat & Seafood",
  "milk": "Dairy & Eggs",
  "onions": "Produce",
  "olive oil": "Pantry"
}`;

    const userPrompt = `Categorize these ingredients: ${ingredientList}`;
    
    logger.info({ requestId, ingredientCount: ingredientNames.length }, 'Sending categorization request to LLM');
    
    const { output, error } = await runDefaultLLM({
      system: systemPrompt,
      text: userPrompt,
      isJson: true,
      metadata: { requestId }
    });
    
    if (error || !output) {
      logger.warn({ requestId, error }, 'LLM categorization failed, falling back to basic categorization');
      return items.map(item => ({
        ...item,
        grocery_category: getBasicGroceryCategory(item.item_name)
      }));
    }
    
    // Parse the LLM response
    const cleanedResponse = stripMarkdownFences(output);
    
    let categories: { [ingredient: string]: string };
    try {
      categories = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.error({ requestId, response: cleanedResponse, parseError }, 'Failed to parse LLM response as JSON, falling back to basic');
      return items.map(item => ({
        ...item,
        grocery_category: getBasicGroceryCategory(item.item_name)
      }));
    }
    
    // Apply LLM categories to items
    const categorizedItems = items.map(item => ({
      ...item,
      grocery_category: categories[item.item_name] || getBasicGroceryCategory(item.item_name)
    }));
    
    logger.info({ requestId, categorizedCount: Object.keys(categories).length }, 'Successfully categorized ingredients with LLM');
    return categorizedItems;

  } catch (error) {
    logger.warn({ requestId, error }, 'Error during LLM categorization, falling back to basic');
    return items.map(item => ({
      ...item,
      grocery_category: getBasicGroceryCategory(item.item_name)
    }));
  }
}

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

    // Fetch original recipe data for storage
    const { data: originalRecipe, error: originalRecipeError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('recipe_data')
      .eq('id', originalRecipeId)
      .single();

    if (originalRecipeError || !originalRecipe) {
      logger.error({ requestId, originalRecipeId, err: originalRecipeError }, 'Failed to fetch original recipe data');
      return res.status(500).json({ error: 'Failed to fetch original recipe data' });
    }

    // Check for duplicate recipe in mise (same user, same original recipe, same modifications, not completed)
    const { data: existingRecipe, error: duplicateCheckError } = await supabaseAdmin
      .from('user_mise_recipes')
      .select('id, title_override, final_yield, created_at')
      .eq('user_id', userId)
      .eq('original_recipe_id', originalRecipeId)
      .eq('applied_changes', JSON.stringify(appliedChanges))
      .eq('is_completed', false)
      .maybeSingle();

    if (duplicateCheckError) {
      logger.error({ requestId, err: duplicateCheckError }, 'Error checking for duplicate mise recipe');
      return res.status(500).json({ error: 'Failed to check for existing recipe' });
    }

    if (existingRecipe) {
      logger.info({ requestId, existingRecipeId: existingRecipe.id }, 'Recipe with same modifications already exists in mise');
      return res.status(409).json({ 
        error: 'Recipe already in mise',
        message: 'This recipe with these modifications is already in your mise en place',
        existingRecipe: existingRecipe
      });
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
        original_recipe_data: originalRecipe.recipe_data,
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

    // Respond immediately to user
    res.status(201).json({
      message: 'Recipe added to mise!',
      miseRecipe: miseRecipe
    });

    // Run LLM categorization in background to pre-categorize ingredients
    setImmediate(async () => {
      try {
        logger.info({ requestId, miseRecipeId: miseRecipe.id }, 'Starting background LLM categorization');
        
        const groceryItems = formatIngredientsForGroceryList(
          preparedRecipeData,
          `mise_${miseRecipe.id}`,
          undefined
        );
        
        // Attempt LLM categorization (with automatic fallback to basic)
        const categorizedItems = await categorizeIngredientsWithServerLLM(groceryItems, requestId);
        
        // Update the prepared recipe data with categorized ingredients
        const updatedRecipeData = {
          ...preparedRecipeData,
          ingredientGroups: preparedRecipeData.ingredientGroups?.map((group: IngredientGroup) => ({
            ...group,
            ingredients: group.ingredients?.map((ingredient: StructuredIngredient) => {
              const matchingItem = categorizedItems.find(item => 
                item.item_name === ingredient.name || 
                item.original_ingredient_text.includes(ingredient.name)
              );
              return {
                ...ingredient,
                grocery_category: matchingItem?.grocery_category || getBasicGroceryCategory(ingredient.name)
              };
            })
          }))
        };
        
        // Save the updated recipe data with categories
        const { error: updateError } = await supabaseAdmin
          .from('user_mise_recipes')
          .update({ prepared_recipe_data: updatedRecipeData })
          .eq('id', miseRecipe.id);
          
        if (updateError) {
          logger.error({ requestId, miseRecipeId: miseRecipe.id, err: updateError }, 'Failed to update recipe with categorized ingredients');
        } else {
          logger.info({ requestId, miseRecipeId: miseRecipe.id, categorizedCount: categorizedItems.length }, 'Successfully updated recipe with LLM categorization');
        }
        
      } catch (error) {
        logger.warn({ requestId, miseRecipeId: miseRecipe.id, err: error }, 'Background LLM categorization failed - will use basic categorization when grocery list is viewed');
        // Don't throw - this is background processing and shouldn't affect the user experience
      }
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

    // Use pre-categorized data when available, with fallback to basic categorization
    const categorizedItems = aggregatedItems.map((item: any) => ({
      ...item,
      grocery_category: item.grocery_category || getBasicGroceryCategory(item.item_name)
    }));

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

    // --- NEW: Clean up stale item states ---
    const currentItemNames = new Set(categorizedItems.map(item => normalizeName(item.item_name)));
    const staleItemNames = checkedStates
      ?.filter(state => !currentItemNames.has(state.normalized_item_name))
      .map(state => state.normalized_item_name) || [];

    if (staleItemNames.length > 0) {
      logger.info({ requestId, staleItemNames }, 'Cleaning up stale shopping list item states');
      
      const { error: cleanupError } = await supabaseAdmin
        .from('user_shopping_list_item_states')
        .delete()
        .eq('user_id', userId)
        .in('normalized_item_name', staleItemNames);

      if (cleanupError) {
        logger.error({ requestId, err: cleanupError }, 'Failed to cleanup stale item states');
      } else {
        logger.info({ requestId, cleanedCount: staleItemNames.length }, 'Successfully cleaned up stale item states');
      }
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