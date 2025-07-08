import { CombinedParsedRecipe, StructuredIngredient } from '../common/types';
import { parseIngredientDisplayName } from './ingredientHelpers';

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
          grocery_category: (ingredient as any).grocery_category || null, // Use pre-categorized data if available
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
 * Creates an intelligent ingredient-to-category mapping for basic categorization
 * Uses rule prioritization: specific categories (spices, condiments) are checked before 
 * general categories (produce) to prevent misclassification of items like "onion powder"
 * For more sophisticated categorization, use the LLM endpoint
 */
export function getBasicGroceryCategory(ingredientName: string): string {
  const name = ingredientName.toLowerCase().trim();
  
  // PRIORITY 1: Spices & Herbs (most specific - check powders, dried, etc. first)
  // This prevents "onion powder" or "garlic powder" from being categorized as Produce
  if (name.includes('powder') || name.includes('dried') || name.includes('ground') ||
      name.includes('salt') || name.includes('pepper') || name.includes('paprika') ||
      name.includes('cumin') || name.includes('oregano') || name.includes('thyme') ||
      name.includes('rosemary') || name.includes('cinnamon') || name.includes('vanilla') ||
      name.includes('turmeric') || name.includes('ginger powder') || name.includes('onion powder') ||
      name.includes('garlic powder') || name.includes('chili powder') || name.includes('curry powder') ||
      name.includes('bay leaves') || name.includes('nutmeg') || name.includes('allspice') ||
      name.includes('cardamom') || name.includes('cloves') || name.includes('fennel seeds') ||
      name.includes('coriander') || name.includes('mustard seed') || name.includes('sesame seeds') ||
      name.includes('poppy seeds') || name.includes('caraway') || name.includes('dill') ||
      name.includes('sage') || name.includes('marjoram') || name.includes('tarragon') ||
      name.includes('red pepper flakes') || name.includes('crushed red pepper') ||
      name.includes('smoked paprika') || name.includes('garlic granules') || name.includes('onion flakes')) {
    return 'Spices & Herbs';
  }
  
  // PRIORITY 2: Condiments & Sauces (specific liquid/paste items)
  if (name.includes('sauce') || name.includes('ketchup') || name.includes('mustard') ||
      name.includes('mayo') || name.includes('mayonnaise') || name.includes('dressing') ||
      name.includes('soy sauce') || name.includes('hot sauce') || name.includes('pickle') ||
      name.includes('relish') || name.includes('sriracha') || name.includes('worcestershire') ||
      name.includes('barbecue sauce') || name.includes('bbq sauce') || name.includes('teriyaki') ||
      name.includes('tahini') || name.includes('pesto') || name.includes('salsa') ||
      name.includes('hummus') || name.includes('jam') || name.includes('jelly') ||
      name.includes('honey') || name.includes('maple syrup') || name.includes('syrup') ||
      name.includes('molasses') || name.includes('agave') || name.includes('tomato paste') ||
      name.includes('tomato sauce') || name.includes('marinara') || name.includes('alfredo')) {
    return 'Condiments & Sauces';
  }
  
  // PRIORITY 3: Pantry Staples (non-perishable dry goods, oils, vinegars)
  if (name.includes('flour') || name.includes('sugar') || name.includes('rice') ||
      name.includes('pasta') || name.includes('oil') || name.includes('vinegar') ||
      name.includes('beans') || name.includes('lentils') || name.includes('oats') ||
      name.includes('quinoa') || name.includes('stock') || name.includes('broth') ||
      name.includes('coconut oil') || name.includes('olive oil') || name.includes('vegetable oil') ||
      name.includes('canola oil') || name.includes('sesame oil') || name.includes('avocado oil') ||
      name.includes('balsamic vinegar') || name.includes('apple cider vinegar') || name.includes('white vinegar') ||
      name.includes('red wine vinegar') || name.includes('brown sugar') || name.includes('powdered sugar') ||
      name.includes('coconut sugar') || name.includes('baking powder') || name.includes('baking soda') ||
      name.includes('cornstarch') || name.includes('arrowroot') || name.includes('tapioca') ||
      name.includes('breadcrumbs') || name.includes('panko') || name.includes('crackers') ||
      name.includes('cereal') || name.includes('granola') || name.includes('nuts') ||
      name.includes('almonds') || name.includes('walnuts') || name.includes('pecans') ||
      name.includes('cashews') || name.includes('peanuts') || name.includes('pine nuts') ||
      name.includes('chickpeas') || name.includes('black beans') || name.includes('kidney beans') ||
      name.includes('navy beans') || name.includes('split peas') || name.includes('barley') ||
      name.includes('bulgur') || name.includes('couscous') || name.includes('millet')) {
    return 'Pantry';
  }
  
  // PRIORITY 4: Dairy & Eggs (refrigerated dairy products)
  if (name.includes('milk') || name.includes('cheese') || name.includes('butter') ||
      name.includes('cream') || name.includes('yogurt') || name.includes('egg') ||
      name.includes('cottage cheese') || name.includes('sour cream') || name.includes('cream cheese') ||
      name.includes('ricotta') || name.includes('mozzarella') || name.includes('cheddar') ||
      name.includes('parmesan') || name.includes('feta') || name.includes('goat cheese') ||
      name.includes('swiss cheese') || name.includes('brie') || name.includes('camembert') ||
      name.includes('blue cheese') || name.includes('heavy cream') || name.includes('half and half') ||
      name.includes('buttermilk') || name.includes('greek yogurt') || name.includes('kefir')) {
    return 'Dairy & Eggs';
  }
  
  // PRIORITY 5: Meat & Seafood (fresh proteins)
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
      name.includes('fish') || name.includes('salmon') || name.includes('shrimp') ||
      name.includes('bacon') || name.includes('turkey') || name.includes('lamb') ||
      name.includes('ground beef') || name.includes('ground turkey') || name.includes('ground chicken') ||
      name.includes('steak') || name.includes('roast') || name.includes('tenderloin') ||
      name.includes('ribs') || name.includes('chops') || name.includes('ham') ||
      name.includes('sausage') || name.includes('chorizo') || name.includes('pepperoni') ||
      name.includes('tuna') || name.includes('cod') || name.includes('halibut') ||
      name.includes('tilapia') || name.includes('mahi mahi') || name.includes('crab') ||
      name.includes('lobster') || name.includes('scallops') || name.includes('mussels') ||
      name.includes('clams') || name.includes('oysters') || name.includes('duck') ||
      name.includes('venison') || name.includes('bison')) {
    return 'Meat & Seafood';
  }
  
  // PRIORITY 6: Produce (fresh fruits, vegetables, fresh herbs)
  // Now checked AFTER spices to prevent "onion powder" from matching "onion"
  // Fresh herbs are specifically qualified to distinguish from dried spices
  if ((name.includes('onion') && !name.includes('powder') && !name.includes('flakes')) ||
      (name.includes('garlic') && !name.includes('powder') && !name.includes('granules')) ||
      name.includes('tomato') || name.includes('bell pepper') || name.includes('jalapeño') ||
      name.includes('lettuce') || name.includes('spinach') || name.includes('kale') ||
      name.includes('carrot') || name.includes('celery') || name.includes('potato') ||
      name.includes('sweet potato') || name.includes('broccoli') || name.includes('cauliflower') ||
      name.includes('cucumber') || name.includes('zucchini') || name.includes('squash') ||
      name.includes('eggplant') || name.includes('mushroom') || name.includes('avocado') ||
      name.includes('apple') || name.includes('banana') || name.includes('orange') ||
      name.includes('lemon') || name.includes('lime') || name.includes('strawberry') ||
      name.includes('blueberry') || name.includes('raspberry') || name.includes('blackberry') ||
      (name.includes('basil') && (name.includes('fresh') || name.includes('leaves'))) ||
      (name.includes('parsley') && (name.includes('fresh') || name.includes('leaves'))) ||
      (name.includes('cilantro') && (name.includes('fresh') || name.includes('leaves'))) ||
      (name.includes('mint') && (name.includes('fresh') || name.includes('leaves'))) ||
      name.includes('green onion') || name.includes('scallion') || name.includes('leek') ||
      name.includes('shallot') || name.includes('ginger') || name.includes('asparagus') ||
      name.includes('brussels sprouts') || name.includes('cabbage') || name.includes('corn') ||
      name.includes('peas') || name.includes('green beans') || name.includes('artichoke')) {
    return 'Produce';
  }
  
  // PRIORITY 7: Frozen Foods (explicitly frozen items)
  if (name.includes('frozen')) {
    return 'Frozen';
  }
  
  // PRIORITY 8: Bakery (fresh baked goods)
  if (name.includes('bread') || name.includes('bagel') || name.includes('roll') ||
      name.includes('baguette') || name.includes('croissant') || name.includes('muffin') ||
      name.includes('tortilla') || name.includes('pita') || name.includes('naan')) {
    return 'Bakery';
  }
  
  // Default fallback to Other for unmatched items
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