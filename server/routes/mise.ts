import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';
import { CombinedParsedRecipe, IngredientGroup, StructuredIngredient } from '../../common/types';
import { formatIngredientsForGroceryList, categorizeIngredients, getBasicGroceryCategory, aggregateGroceryList, normalizeName } from '../../utils/groceryHelpers';
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

  // Extract unique ingredient names from original text for better context
  const ingredientTexts = [...new Set(items.map(item => item.original_ingredient_text))];
  
  try {
    // Build the categorization prompt using original ingredient text
    const ingredientList = ingredientTexts.map(ing => `"${ing}"`).join(', ');
    
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
5. Fresh ingredients, like fresh herbs (like cilantro, basil, parsley, mint, fresh chopped herbs, or other similar) or fresh produce, should be categorized as "Produce".
6. Dried herbs and spices should be categorized as "Spices & Herbs".
7. Salt and black pepper should be categorized as "Spices & Herbs".

Return your response as a JSON object where each ingredient name is a key and its category is the value.

Example:
{
  "chicken breast": "Meat & Seafood",
  "milk": "Dairy & Eggs",
  "onions": "Produce",
  "olive oil": "Pantry",
  "fresh cilantro": "Produce",
  "dried oregano": "Spices & Herbs",
  "salt": "Spices & Herbs"
}`;

    const userPrompt = `Categorize these ingredients: ${ingredientList}`;
    
    logger.info({ requestId, ingredientCount: ingredientTexts.length }, 'Sending categorization request to LLM');
    
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
    
    // Log raw LLM response for debugging
    logger.info({ 
      requestId, 
      rawLLMResponse: output,
      cleanedResponse,
      problematicIngredients: items.filter(item => 
        item.original_ingredient_text.toLowerCase().includes('egg') ||
        item.original_ingredient_text.toLowerCase().includes('garlic') ||
        item.original_ingredient_text.toLowerCase().includes('sesame')
      ).map(item => ({
        original_text: item.original_ingredient_text,
        item_name: item.item_name
      }))
    }, '🤖 Raw LLM categorization response');
    
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
    
    // Apply LLM categories to items using original ingredient text as key
    const categorizedItems = items.map(item => ({
      ...item,
      grocery_category: categories[item.original_ingredient_text] || getBasicGroceryCategory(item.item_name)
    }));
    
    // Debug specific problematic ingredients (look for them in original ingredient text)
    const problematicPatterns = ['herbs', 'cilantro', 'basil'];
    problematicPatterns.forEach(pattern => {
      const matchingItems = items.filter(item => 
        item.original_ingredient_text.toLowerCase().includes(pattern)
      );
      matchingItems.forEach(item => {
        const llmCategory = categories[item.original_ingredient_text];
        const basicCategory = getBasicGroceryCategory(item.item_name);
        const finalCategory = llmCategory || basicCategory;
        logger.info({ 
          requestId, 
          ingredient: item.item_name,
          originalText: item.original_ingredient_text,
          llmCategory,
          basicCategory,
          finalCategory,
          hasLLMCategory: !!llmCategory
        }, 'Debug: Categorization for problematic ingredient');
      });
    });
    
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
      originalRecipeData,
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
      finalYield,
      appliedChanges,
      scalingFactor: appliedChanges?.scalingFactor,
      ingredientChangesCount: appliedChanges?.ingredientChanges?.length || 0,
      ingredientChanges: appliedChanges?.ingredientChanges?.map((change: any) => ({
        from: change.from,
        to: change.to ? (typeof change.to === 'string' ? change.to : change.to.name) : null,
        hasAmountData: change.to && typeof change.to === 'object' && !!change.to.amount,
        hasUnitData: change.to && typeof change.to === 'object' && !!change.to.unit,
      })) || [],
      recipeTitle: preparedRecipeData?.title,
      originalRecipeTitle: originalRecipeData?.title,
      preparedYield: preparedRecipeData?.recipeYield,
      originalYield: originalRecipeData?.recipeYield,
      ingredientGroupsCount: preparedRecipeData?.ingredientGroups?.length || 0,
      instructionsCount: preparedRecipeData?.instructions?.length || 0,
    }, 'Saving recipe to mise with detailed modifications');

    // Validation
    if (!userId || !originalRecipeId || !originalRecipeData || !preparedRecipeData || !appliedChanges) {
      logger.error({ requestId, body: req.body }, 'Missing required fields for saving mise recipe');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use the original recipe data passed directly from the client
    const originalRecipe = { recipe_data: originalRecipeData };

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
        
        logger.info({ 
          requestId, 
          miseRecipeId: miseRecipe.id,
          recipeTitle: preparedRecipeData.title,
          ingredientGroupsCount: preparedRecipeData.ingredientGroups?.length || 0
        }, 'Background: Processing recipe for grocery categorization');
        
        // Log all ingredients before formatting
        if (preparedRecipeData.ingredientGroups) {
          preparedRecipeData.ingredientGroups.forEach((group: IngredientGroup, groupIndex: number) => {
            if (group.ingredients) {
              group.ingredients.forEach((ingredient: StructuredIngredient, ingIndex: number) => {
                logger.info({ 
                  requestId, 
                  miseRecipeId: miseRecipe.id,
                  groupIndex,
                  ingIndex,
                  ingredient: {
                    name: ingredient.name,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    preparation: ingredient.preparation,
                    grocery_category: (ingredient as any).grocery_category
                  }
                }, 'Background: Raw ingredient before grocery formatting');
              });
            }
          });
        }
        
        const groceryItems = formatIngredientsForGroceryList(
          preparedRecipeData,
          `mise_${miseRecipe.id}`,
          undefined
        );
        
        logger.info({ 
          requestId, 
          miseRecipeId: miseRecipe.id,
          formattedItemsCount: groceryItems.length,
          formattedItems: groceryItems.map(item => ({
            item_name: item.item_name,
            original_ingredient_text: item.original_ingredient_text,
            grocery_category: item.grocery_category
          }))
        }, 'Background: Formatted grocery items before LLM categorization');
        
        // Attempt LLM categorization (with automatic fallback to basic)
        const categorizedItems = await categorizeIngredientsWithServerLLM(groceryItems, requestId);
        
        logger.info({ 
          requestId, 
          miseRecipeId: miseRecipe.id,
          categorizedItemsCount: categorizedItems.length,
          categorizedItems: categorizedItems.map(item => ({
            item_name: item.item_name,
            grocery_category: item.grocery_category
          }))
        }, 'Background: Items after LLM categorization');
        
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
              const finalCategory = matchingItem?.grocery_category || getBasicGroceryCategory(ingredient.name);
              
              logger.info({ 
                requestId, 
                miseRecipeId: miseRecipe.id,
                ingredientName: ingredient.name,
                matchingItemName: matchingItem?.item_name,
                llmCategory: matchingItem?.grocery_category,
                basicCategory: getBasicGroceryCategory(ingredient.name),
                finalCategory
              }, 'Background: Categorizing ingredient in recipe data');
              
              return {
                ...ingredient,
                grocery_category: finalCategory
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
          logger.error({ requestId, miseRecipeId: miseRecipe.id, err: updateError }, 'Background: Failed to update recipe with categorized ingredients');
        } else {
          logger.info({ requestId, miseRecipeId: miseRecipe.id }, 'Background: Successfully updated recipe with categorized ingredients');
        }
      } catch (err) {
        const error = err as Error;
        logger.error({ requestId, miseRecipeId: miseRecipe.id, err: error }, 'Background: Error in LLM categorization');
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
        original_recipe_data,
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

// GET /api/mise/recipes/:id - Get single mise recipe by ID
router.get('/recipes/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    logger.info({ requestId, miseRecipeId: id, userId }, 'Fetching single mise recipe');

    const { data: miseRecipe, error: fetchError } = await supabaseAdmin
      .from('user_mise_recipes')
      .select(`
        id,
        original_recipe_id,
        title_override,
        planned_date,
        display_order,
        prepared_recipe_data,
        original_recipe_data,
        final_yield,
        applied_changes,
        is_completed,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns this recipe
      .single();

    if (fetchError) {
      logger.error({ requestId, err: fetchError }, 'Failed to fetch mise recipe');
      return res.status(500).json({ error: 'Failed to fetch mise recipe' });
    }

    if (!miseRecipe) {
      logger.warn({ requestId, miseRecipeId: id }, 'Mise recipe not found');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    logger.info({ requestId, miseRecipeId: id }, 'Successfully fetched mise recipe');

    res.json({
      recipe: miseRecipe
    });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, err: error }, 'Error in /recipes/:id GET route');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// PUT /api/mise/recipes/:id - Update mise recipe
router.put('/recipes/:id', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  
  try {
    const { id } = req.params;
    const { userId, titleOverride, plannedDate, displayOrder, isCompleted, preparedRecipeData, appliedChanges, finalYield } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    logger.info({ 
      requestId, 
      miseRecipeId: id, 
      userId,
      updates: {
        titleOverride,
        plannedDate,
        displayOrder,
        isCompleted,
        finalYield,
        hasNewPreparedData: !!preparedRecipeData,
        hasNewAppliedChanges: !!appliedChanges,
        scalingFactor: appliedChanges?.scalingFactor,
        ingredientChangesCount: appliedChanges?.ingredientChanges?.length || 0,
        ingredientChanges: appliedChanges?.ingredientChanges?.map((change: any) => ({
          from: change.from,
          to: change.to ? (typeof change.to === 'string' ? change.to : change.to.name) : null,
          hasAmountData: change.to && typeof change.to === 'object' && !!change.to.amount,
          hasUnitData: change.to && typeof change.to === 'object' && !!change.to.unit,
        })) || [],
        newRecipeTitle: preparedRecipeData?.title,
        newRecipeYield: preparedRecipeData?.recipeYield,
        newIngredientsCount: preparedRecipeData?.ingredientGroups?.length || 0,
        newInstructionsCount: preparedRecipeData?.instructions?.length || 0,
      }
    }, 'Updating mise recipe with detailed modifications');

    // Build update object with only provided fields
    const updates: any = { updated_at: new Date().toISOString() };
    if (titleOverride !== undefined) updates.title_override = titleOverride;
    if (plannedDate !== undefined) updates.planned_date = plannedDate;
    if (displayOrder !== undefined) updates.display_order = displayOrder;
    if (isCompleted !== undefined) updates.is_completed = isCompleted;
    if (preparedRecipeData !== undefined) updates.prepared_recipe_data = preparedRecipeData;
    if (appliedChanges !== undefined) updates.applied_changes = appliedChanges;
    if (finalYield !== undefined) updates.final_yield = finalYield;

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
    logger.info({ requestId, userId, query: { user_id: userId, is_completed: false } }, 'Executing grocery list query with parameters');
    
    const { data: miseRecipes, error: fetchError } = await supabaseAdmin
      .from('user_mise_recipes')
      .select('id, prepared_recipe_data, title_override, user_id, is_completed, created_at')
      .eq('user_id', userId)
      .eq('is_completed', false);

    if (fetchError) {
      logger.error({ requestId, err: fetchError }, 'Failed to fetch mise recipes for grocery list');
      return res.status(500).json({ error: 'Failed to fetch recipes' });
    }

    logger.info({ 
      requestId, 
      recipeCount: miseRecipes?.length || 0,
      foundRecipes: miseRecipes?.map(recipe => ({
        id: recipe.id,
        user_id: recipe.user_id,
        is_completed: recipe.is_completed,
        created_at: recipe.created_at,
        title: recipe.prepared_recipe_data?.title || 'Unknown'
      })) || []
    }, 'Found mise recipes for grocery list generation');

    // Extract ingredients from all recipes and create grocery items
    let allGroceryItems: any[] = [];
    
    // --- Step 1: Fetch all active mise recipes and extract their ingredients ---
    for (const miseRecipe of miseRecipes || []) {
      const recipe = miseRecipe.prepared_recipe_data as CombinedParsedRecipe;
      const recipeTitle =
        miseRecipe.title_override || (miseRecipe.prepared_recipe_data as CombinedParsedRecipe).title;
      const ingredientGroupsCount = (miseRecipe.prepared_recipe_data as CombinedParsedRecipe)
        .ingredientGroups?.length;

      logger.info(
        { requestId, miseRecipeId: miseRecipe.id, recipeTitle, ingredientGroupsCount },
        'Processing recipe for grocery list'
      );

      // --- Step 2: Format the ingredients from each recipe into a flat grocery list ---
      const formattedItems = formatIngredientsForGroceryList(
        recipe,
        `mise_${miseRecipe.id}`
      );
      allGroceryItems.push(...formattedItems);
    }

    logger.info({ 
      requestId, 
      totalGroceryItems: allGroceryItems.length,
      allItems: allGroceryItems.map(item => ({
        item_name: item.item_name,
        original_ingredient_text: item.original_ingredient_text,
        grocery_category: item.grocery_category
      }))
    }, 'All grocery items before aggregation');

    // Filter out common household staples that users unlikely need to buy
    const EXCLUDED_ITEMS = new Set([
      'salt', 'pepper', 'black pepper', 'white pepper',
      'water', 'tap water', 'cold water', 'warm water', 'hot water',
      'cooking spray', 'non-stick spray', 'oil spray',
      'ice', 'ice cube', 'ice cubes'
    ]);
    
    const filteredGroceryItems = allGroceryItems.filter(item => {
      // Use the same normalization as aggregation for consistency
      const normalizedItem = normalizeName(item.item_name);
      const shouldExclude = EXCLUDED_ITEMS.has(normalizedItem);
      
      if (shouldExclude) {
        logger.info({ 
          requestId, 
          item_name: item.item_name,
          normalized_name: normalizedItem
        }, 'Excluding common household item from grocery list');
      }
      
      return !shouldExclude;
    });
    
    logger.info({ 
      requestId, 
      originalCount: allGroceryItems.length,
      filteredCount: filteredGroceryItems.length,
      excludedCount: allGroceryItems.length - filteredGroceryItems.length
    }, 'Applied exclusion filter for household staples');

    // Aggregate the filtered grocery list
    const aggregatedItems = aggregateGroceryList(filteredGroceryItems);

    // Debug specific problematic cases
    const problematicItems = ['garlic', 'tamari', 'avocado'];
    problematicItems.forEach(itemName => {
      const matchingItems = aggregatedItems.filter(item => 
        item.item_name.toLowerCase().includes(itemName.toLowerCase())
      );
      
      if (matchingItems.length > 0) {
        logger.info({ 
          requestId, 
          searchTerm: itemName,
          matchingCount: matchingItems.length,
          matchingItems: matchingItems.map(item => ({
            item_name: item.item_name,
            grocery_category: item.grocery_category,
            quantity_amount: item.quantity_amount,
            quantity_unit: item.quantity_unit,
            original_ingredient_text: item.original_ingredient_text
          }))
        }, 'Debug: Found matching items for problematic ingredient');
      }
    });

    logger.info({ 
      requestId, 
      aggregatedItemsCount: aggregatedItems.length,
      aggregatedItems: aggregatedItems.map(item => ({
        item_name: item.item_name,
        original_ingredient_text: item.original_ingredient_text,
        grocery_category: item.grocery_category
      }))
    }, 'Aggregated grocery items');

    // Use pre-categorized data when available, with fallback to basic categorization
    const categorizedItems = aggregatedItems.map((item: any) => {
      const originalCategory = item.grocery_category;
      const basicCategory = getBasicGroceryCategory(item.item_name);
      const finalCategory = item.grocery_category || basicCategory;
      
      logger.info({ 
        requestId, 
        item_name: item.item_name,
        original_category: originalCategory,
        basic_category: basicCategory,
        final_category: finalCategory
      }, 'Categorizing grocery item');
      
      return {
        ...item,
        grocery_category: finalCategory
      };
    });

    logger.info({ 
      requestId, 
      categorizedItemsCount: categorizedItems.length,
      categorizedItems: categorizedItems.map(item => ({
        item_name: item.item_name,
        grocery_category: item.grocery_category
      }))
    }, 'Final categorized grocery items');

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
      recipeCount: miseRecipes?.length || 0,
      finalItems: finalItems.map(item => ({
        item_name: item.item_name,
        grocery_category: item.grocery_category,
        is_checked: item.is_checked
      }))
    }, 'Successfully created aggregated grocery list with persistent states');

    logger.info({ 
      requestId, 
      finalResponseItemCount: finalItems.length,
      garlicItems: finalItems.filter((item: any) => item.item_name.toLowerCase().includes('garlic')),
      sesameItems: finalItems.filter((item: any) => item.item_name.toLowerCase().includes('sesame'))
    }, '🚨 FINAL RESPONSE TO FRONTEND');

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


export { router as miseRouter }; 