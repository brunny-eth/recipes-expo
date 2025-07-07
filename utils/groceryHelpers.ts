import { CombinedParsedRecipe, StructuredIngredient } from '../common/types';

export interface GroceryListItem {
  item_name: string;
  original_ingredient_text: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  grocery_category: string | null;
  is_checked: boolean;
  order_index: number;
  recipe_id: number | null;
  user_saved_recipe_id: string | null;
  source_recipe_title: string;
}

// Function to parse ingredient display name and remove substitution text
function parseIngredientDisplayName(ingredientName: string) {
  // Regular expression to match substitution text
  const substitutionRegex = /\(substituted for [^)]+\)/i;
  // Remove substitution text
  const baseName = ingredientName.replace(substitutionRegex, '').trim();
  return { baseName };
}

/**
 * Formats a final processed recipe's ingredients for grocery list
 * Assumes the recipe has already been scaled/modified by LLM routes
 */
export function formatIngredientsForGroceryList(
  recipe: CombinedParsedRecipe,
  shoppingListId: string,
  userSavedRecipeId?: string
): GroceryListItem[] {
  const groceryItems: GroceryListItem[] = [];
  let orderIndex = 0;

  // Process each ingredient group from the final recipe
  if (recipe.ingredientGroups) {
    for (const group of recipe.ingredientGroups) {
      for (const ingredient of group.ingredients) {
        const originalText = `${ingredient.amount || ''} ${ingredient.unit || ''} ${ingredient.name}`.trim();
        const parsedName = parseIngredientDisplayName(ingredient.name);
        
        console.log(`Formatted ingredient: ${parsedName.baseName}`);
        // Create grocery list item from final ingredient
        groceryItems.push({
          item_name: parsedName.baseName, // Use base name without substitution text
          original_ingredient_text: originalText,
          quantity_amount: ingredient.amount ? parseFloat(ingredient.amount) : null,
          quantity_unit: ingredient.unit || null,
          grocery_category: null, // Will be set by categorization
          is_checked: false,
          order_index: orderIndex++,
          recipe_id: recipe.id || null,
          user_saved_recipe_id: userSavedRecipeId || null,
          source_recipe_title: recipe.title || 'Unknown Recipe'
        });
      }
    }
  }

  return groceryItems;
}

/**
 * Creates a simple ingredient-to-category mapping for basic categorization
 * For more sophisticated categorization, use the LLM endpoint
 */
export function getBasicGroceryCategory(ingredientName: string): string {
  const name = ingredientName.toLowerCase();
  
  // Produce
  if (name.includes('onion') || name.includes('garlic') || name.includes('tomato') || 
      name.includes('pepper') || name.includes('lettuce') || name.includes('carrot') ||
      name.includes('celery') || name.includes('potato') || name.includes('apple') ||
      name.includes('lemon') || name.includes('lime') || name.includes('herbs') ||
      name.includes('basil') || name.includes('parsley') || name.includes('cilantro')) {
    return 'Produce';
  }
  
  // Dairy & Eggs
  if (name.includes('milk') || name.includes('cheese') || name.includes('butter') ||
      name.includes('cream') || name.includes('yogurt') || name.includes('egg')) {
    return 'Dairy & Eggs';
  }
  
  // Meat & Seafood
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
      name.includes('fish') || name.includes('salmon') || name.includes('shrimp') ||
      name.includes('bacon') || name.includes('turkey') || name.includes('lamb')) {
    return 'Meat & Seafood';
  }
  
  // Pantry
  if (name.includes('flour') || name.includes('sugar') || name.includes('rice') ||
      name.includes('pasta') || name.includes('oil') || name.includes('vinegar') ||
      name.includes('beans') || name.includes('lentils') || name.includes('oats') ||
      name.includes('quinoa') || name.includes('stock') || name.includes('broth')) {
    return 'Pantry';
  }
  
  // Spices & Herbs
  if (name.includes('salt') || name.includes('pepper') || name.includes('paprika') ||
      name.includes('cumin') || name.includes('oregano') || name.includes('thyme') ||
      name.includes('rosemary') || name.includes('cinnamon') || name.includes('vanilla')) {
    return 'Spices & Herbs';
  }
  
  // Condiments & Sauces
  if (name.includes('sauce') || name.includes('ketchup') || name.includes('mustard') ||
      name.includes('mayo') || name.includes('dressing') || name.includes('soy sauce') ||
      name.includes('hot sauce') || name.includes('pickle')) {
    return 'Condiments & Sauces';
  }
  
  // Default to Other
  return 'Other';
}

/**
 * Applies basic categorization to grocery items using simple pattern matching
 */
export function categorizeIngredients(items: GroceryListItem[]): GroceryListItem[] {
  return items.map(item => ({
    ...item,
    grocery_category: getBasicGroceryCategory(item.item_name)
  }));
}

/**
 * Categorizes ingredients using the LLM endpoint for more accurate results
 */
export async function categorizeIngredientsWithLLM(
  items: GroceryListItem[]
): Promise<GroceryListItem[]> {
  if (items.length === 0) {
    return items;
  }

  // Extract unique ingredient names
  const ingredientNames = [...new Set(items.map(item => item.item_name))];
  
  try {
    const response = await fetch('/api/grocery/categorize-ingredients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingredients: ingredientNames
      })
    });

    if (!response.ok) {
      console.warn('LLM categorization failed, falling back to basic categorization');
      return categorizeIngredients(items);
    }

    const { categories } = await response.json();
    
    // Apply LLM categories to items
    return items.map(item => ({
      ...item,
      grocery_category: categories[item.item_name] || getBasicGroceryCategory(item.item_name)
    }));

  } catch (error) {
    console.warn('Error calling LLM categorization, falling back to basic:', error);
    return categorizeIngredients(items);
  }
}

/**
 * Generates a unique ID for grocery items (can be used as temporary ID before database insert)
 */
export function generateGroceryItemId(): string {
  return `grocery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Prepares grocery items for Supabase insertion
 */
export function prepareForSupabaseInsert(
  items: GroceryListItem[],
  shoppingListId: string
): Array<{
  shopping_list_id: string;
  item_name: string;
  original_ingredient_text: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  grocery_category: string | null;
  is_checked: boolean;
  order_index: number;
  recipe_id: number | null;
  user_saved_recipe_id: string | null;
  source_recipe_title: string;
}> {
  return items.map(item => ({
    shopping_list_id: shoppingListId,
    item_name: item.item_name,
    original_ingredient_text: item.original_ingredient_text,
    quantity_amount: item.quantity_amount,
    quantity_unit: item.quantity_unit,
    grocery_category: item.grocery_category,
    is_checked: false,
    order_index: item.order_index,
    recipe_id: item.recipe_id,
    user_saved_recipe_id: item.user_saved_recipe_id,
    source_recipe_title: item.source_recipe_title
  }));
} 