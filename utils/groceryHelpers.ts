import { CombinedParsedRecipe, StructuredIngredient } from '../common/types';
import { parseIngredientDisplayName } from './ingredientHelpers';
import { parseAmountString } from './recipeUtils';
import { parse, toFraction } from 'fraction.js';

/**
 * Converts decimal amounts to readable fractions for grocery list display
 */
export function formatAmountForGroceryDisplay(amount: number | null): string | null {
  console.log('[groceryHelpers] 🔢 Formatting amount:', amount);
  if (amount === null || amount === 0) {
    return null;
  }

  // Common fractions that are easy to read
  const commonFractions: { [key: number]: string } = {
    0.125: '⅛',
    0.25: '¼',
    0.375: '⅜',
    0.5: '½',
    0.625: '⅝',
    0.75: '¾',
    0.875: '⅞',
    0.33: '⅓',
    0.67: '⅔',
    0.2: '⅕',
    0.4: '⅖',
    0.6: '⅗',
    0.8: '⅘',
  };

  // Check if it's a whole number
  if (Number.isInteger(amount)) {
    console.log('[groceryHelpers] 🔢 Whole number:', amount.toString());
    return amount.toString();
  }

  // Check if it's a common fraction
  const rounded = Math.round(amount * 1000) / 1000; // Round to 3 decimal places
  if (commonFractions[rounded]) {
    console.log('[groceryHelpers] 🔢 Common fraction:', commonFractions[rounded]);
    return commonFractions[rounded];
  }

  // Check for mixed numbers (e.g., 1.5 = 1 ½)
  const wholePart = Math.floor(amount);
  const decimalPart = amount - wholePart;
  const roundedDecimal = Math.round(decimalPart * 1000) / 1000;
  
  if (wholePart > 0 && commonFractions[roundedDecimal]) {
    const result = `${wholePart} ${commonFractions[roundedDecimal]}`;
    console.log('[groceryHelpers] 🔢 Mixed number:', result);
    return result;
  }

  // For other decimals, try to find a close fraction
  const tolerance = 0.01;
  for (const [decimal, fraction] of Object.entries(commonFractions)) {
    if (Math.abs(rounded - parseFloat(decimal)) < tolerance) {
      if (wholePart > 0) {
        const result = `${wholePart} ${fraction}`;
        console.log('[groceryHelpers] 🔢 Approximate mixed number:', result);
        return result;
      }
      console.log('[groceryHelpers] 🔢 Approximate fraction:', fraction);
      return fraction;
    }
  }

  // If no good fraction found, return the original decimal as a string
  console.log('[groceryHelpers] 🔢 Using decimal:', amount.toString());
  return amount.toString();
}

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

// === AGGREGATION LOGIC (consolidated from ingredientAggregation.ts) ===

/**
 * Normalizes an ingredient name for consistent aggregation.
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes irrelevant adjectives (but keeps important ones like "toasted")
 * - Makes singular (simple implementation)
 */
export function normalizeName(name: string): string {
  // Use console.log for frontend, but this will also work for backend Node.js
  console.log('[groceryHelpers] 🔄 Normalizing name:', name);
  let normalized = name.toLowerCase().trim();
  
  // Remove truly irrelevant adjectives that don't affect shopping/aggregation
  // NOTE: Deliberately NOT including "toasted" as it's a meaningful distinction
  const irrelevantAdjectives = [
    'large', 'small', 'medium', 'extra-large', 'jumbo', 'mini',
    'fresh', 'frozen', 'organic', 'free-range', 'grass-fed',
    'whole', 'chopped', 'diced', 'minced', 'sliced', 'grated',
    'peeled', 'unpeeled', 'skinless', 'boneless',
    'raw', 'cooked', 'steamed', 'roasted', 'grilled'
  ];
  
  // Remove irrelevant adjectives (word boundaries to avoid partial matches)
  const adjectivePattern = new RegExp(`\\b(${irrelevantAdjectives.join('|')})\\s+`, 'gi');
  normalized = normalized.replace(adjectivePattern, '');
  
  // Handle common unit words that might still be in the name
  // This is a safety net in case parseIngredientDisplayName didn't catch them
  const residualUnits = ['clove', 'cloves', 'piece', 'pieces', 'head', 'heads', 'bunch', 'bunches'];
  const residualUnitPattern = new RegExp(`\\s+(${residualUnits.join('|')})$`, 'i');
  normalized = normalized.replace(residualUnitPattern, '');
  
  // Also handle unit words at the beginning (like "garlic clove" -> "garlic")
  const leadingUnitPattern = new RegExp(`^(${residualUnits.join('|')})\\s+`, 'i');
  normalized = normalized.replace(leadingUnitPattern, '');
  
  // Clean up extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Handle complex herb patterns like "fresh chopped herbs scallions" -> "scallions"
  if (normalized.includes('herbs') && (normalized.includes('scallion') || normalized.includes('cilantro') || normalized.includes('parsley'))) {
    // Extract the specific herb from patterns like "fresh chopped herbs scallions"
    if (normalized.includes('scallion')) {
      normalized = 'scallion';
    } else if (normalized.includes('cilantro')) {
      normalized = 'cilantro';
    } else if (normalized.includes('parsley')) {
      normalized = 'parsley';
    }
  }
  
  // Simple pluralization check - remove trailing 's' but be careful with exceptions
  const pluralExceptions = [
    'beans', 'peas', 'lentils', 'oats', 'grits', 'grains',
    'noodles', 'brussels sprouts', 'green beans',
    'sesame seeds', 'sunflower seeds', 'pumpkin seeds'
  ];
  
  // Only singularize if it's not an exception and ends with 's'
  if (normalized.endsWith('s') && !pluralExceptions.includes(normalized)) {
    // Additional check: don't singularize if it would create a very short word
    const singular = normalized.slice(0, -1);
    if (singular.length >= 3) {
      normalized = singular;
    }
  }
  
  console.log('[groceryHelpers] ✨ Normalized result:', normalized);
  return normalized;
}

/**
 * A dictionary to normalize common units to a canonical form.
 */
const unitDictionary: { [key: string]: string } = {
  'tsp': 'teaspoon', 'tsps': 'teaspoon', 'teaspoon': 'teaspoon', 'teaspoons': 'teaspoon',
  'tbsp': 'tablespoon', 'tbsps': 'tablespoon', 'tablespoon': 'tablespoon', 'tablespoons': 'tablespoon',
  'oz': 'ounce', 'ounces': 'ounce',
  'lb': 'pound', 'lbs': 'pound', 'pound': 'pound', 'pounds': 'pound',
  'g': 'gram', 'grams': 'gram',
  'kg': 'kilogram', 'kgs': 'kilogram', 'kilogram': 'kilogram', 'kilograms': 'kilogram',
  'ml': 'milliliter', 'milliliters': 'milliliter',
  'l': 'liter', 'liters': 'liter',
  'clove': 'clove', 'cloves': 'clove',
  'cup': 'cup', 'cups': 'cup',
  'pinch': 'pinch', 'pinches': 'pinch',
  'dash': 'dash', 'dashes': 'dash',
};

/**
 * Normalizes a unit to its canonical form using the dictionary.
 * Returns null if the unit is not found or is empty.
 */
function normalizeUnit(unit: string | null): string | null {
  console.log('[groceryHelpers] 📏 Normalizing unit:', unit);
  if (!unit) return null;
  const lowerUnit = unit.toLowerCase().trim();
  const result = unitDictionary[lowerUnit] || null;
  console.log('[groceryHelpers] 📏 Normalized unit result:', result);
  return result;
}

/**
 * Parses a quantity string (e.g., "1 1/2", "0.5") into a number.
 * Returns null if parsing fails.
 */
function parseQuantity(amount: number | string | null): number | null {
  console.log('[groceryHelpers] 🔢 Parsing quantity:', amount);
  if (typeof amount === 'number') {
    return amount;
  }
  if (typeof amount === 'string' && amount.trim() !== '') {
    try {
      // Use fraction.js to handle mixed numbers like "1 1/2"
      const result = parse(amount.trim());
      console.log('[groceryHelpers] 🔢 Parsed quantity result:', result);
      return result;
    } catch (e) {
      console.warn('[groceryHelpers] ⚠️ Failed to parse quantity:', amount, e);
      return null; // Return null if parsing fails
    }
  }
  return null;
}

/**
 * Enhanced unit compatibility check that handles volume and weight conversions.
 * Groups units by type (volume, weight, count) for proper aggregation.
 */
function areUnitsCompatible(unit1: string | null, unit2: string | null): boolean {
  console.log('[groceryHelpers] 🔍 Checking unit compatibility:', { unit1, unit2 });
  const normalizedUnit1 = normalizeUnit(unit1);
  const normalizedUnit2 = normalizeUnit(unit2);

  if (normalizedUnit1 === null && normalizedUnit2 === null) return true;
  if (normalizedUnit1 === null || normalizedUnit2 === null) return false;

  // If units are exactly the same, they're compatible
  if (normalizedUnit1 === normalizedUnit2) {
    console.log('[groceryHelpers] ✅ Units are identical');
    return true;
  }

  // Define unit groups that can be converted between each other
  const volumeUnits = new Set([
    'teaspoon', 'tablespoon', 'cup', 'milliliter', 'liter',
    'fluid_ounce', 'pint', 'quart', 'gallon'
  ]);
  
  const weightUnits = new Set([
    'gram', 'kilogram', 'ounce', 'pound'
  ]);
  
  const countUnits = new Set([
    'clove', 'piece', 'pinch', 'dash'
  ]);

  // Check if both units are in the same group
  if (volumeUnits.has(normalizedUnit1) && volumeUnits.has(normalizedUnit2)) {
    console.log('[groceryHelpers] ✅ Both are volume units');
    return true; // Both are volume units
  }
  
  if (weightUnits.has(normalizedUnit1) && weightUnits.has(normalizedUnit2)) {
    console.log('[groceryHelpers] ✅ Both are weight units');
    return true; // Both are weight units
  }
  
  if (countUnits.has(normalizedUnit1) && countUnits.has(normalizedUnit2)) {
    console.log('[groceryHelpers] ✅ Both are count units');
    return true; // Both are count units
  }

  console.log('[groceryHelpers] ❌ Units are not compatible');
  return false; // Units are not compatible
}

/**
 * Aggregates a list of grocery items.
 * Combines items with the same name and compatible units.
 */
export function aggregateGroceryList(items: GroceryListItem[]): GroceryListItem[] {
  console.log('[groceryHelpers] 🔄 Starting aggregation with', items.length, 'items');
  if (!items || items.length === 0) {
    return [];
  }

  const aggregatedMap = new Map<string, GroceryListItem>();

  for (const item of items) {
    const normalizedItemName = normalizeName(item.item_name);
    const normalizedUnit = normalizeUnit(item.quantity_unit);
    const key = `${normalizedItemName}|${normalizedUnit}`;

    console.log('[groceryHelpers] 📝 Processing item:', {
      original_name: item.item_name,
      normalized_name: normalizedItemName,
      original_unit: item.quantity_unit,
      normalized_unit: normalizedUnit,
      aggregation_key: key
    });

    const existing = aggregatedMap.get(key);
    
    if (existing && areUnitsCompatible(existing.quantity_unit, item.quantity_unit)) {
      console.log('[groceryHelpers] 🔗 Combining with existing item');
      // --- Combine Items ---
      const existingAmount = parseQuantity(existing.quantity_amount);
      const currentAmount = parseQuantity(item.quantity_amount);

      console.log('[groceryHelpers] 🔢 Amounts to combine:', {
        existing_amount: existingAmount,
        current_amount: currentAmount,
        existing_unit: existing.quantity_unit,
        current_unit: item.quantity_unit
      });

      if (existingAmount !== null && currentAmount !== null) {
        const total = existingAmount + currentAmount;
        // The quantity_amount should always be a number for further processing.
        // Conversion to a fraction string should happen on the frontend.
        existing.quantity_amount = total;
        console.log('[groceryHelpers] ➕ Combined amounts:', total);
      } else if (currentAmount !== null) {
        // If existing had no amount but the new one does, use the new one.
        existing.quantity_amount = currentAmount;
        console.log('[groceryHelpers] ➡️ Using current amount:', currentAmount);
      }
      
      // Append original text for reference
      existing.original_ingredient_text += ` | ${item.original_ingredient_text}`;

    } else {
      console.log('[groceryHelpers] ➕ Adding new item');
      // --- Add New Item ---
      // If an item with the same name but different unit exists, create a new entry
      const newKey = `${normalizedItemName}|${normalizedUnit}|${aggregatedMap.size}`;
      
      console.log('[groceryHelpers] 🔑 Using key:', existing ? newKey : key);
      
      // When adding a new item, store its unit in the canonical form
      const newItem = { ...item };
      newItem.quantity_unit = normalizedUnit;
      aggregatedMap.set(existing ? newKey : key, newItem);
    }
  }

  const result = Array.from(aggregatedMap.values());
  console.log('[groceryHelpers] ✅ Aggregation complete:', {
    input_items: items.length,
    output_items: result.length
  });
  
  return result;
}

// === END AGGREGATION LOGIC ===

/**
 * Formats a final processed recipe's ingredients for grocery list
 * Assumes the recipe has already been scaled/modified by LLM routes
 */
export function formatIngredientsForGroceryList(
  recipe: CombinedParsedRecipe,
  shoppingListId: string,
  userSavedRecipeId?: string
): GroceryListItem[] {
  console.log('[groceryHelpers] 🛒 Starting grocery list formatting for recipe:', recipe.title);
  const groceryItems: GroceryListItem[] = [];
  let orderIndex = 0;

  // Process each ingredient group from the final recipe
  if (recipe.ingredientGroups) {
    for (const group of recipe.ingredientGroups) {
      console.log(`[groceryHelpers] 📦 Processing ingredient group: "${group.name}"`);
      
      for (const ingredient of group.ingredients) {
        const originalText = `${ingredient.amount || ''} ${ingredient.unit || ''} ${ingredient.name}`.trim();
        const parsedName = parseIngredientDisplayName(ingredient.name);
        
        console.log(`[groceryHelpers] 🥬 Processing ingredient:`, {
          originalName: ingredient.name,
          parsedBaseName: parsedName.baseName,
          originalText,
          amount: ingredient.amount,
          unit: ingredient.unit,
          existingCategory: (ingredient as any).grocery_category
        });
        
        // Create grocery list item from final ingredient
        const groceryItem = {
          item_name: parsedName.baseName, // Use base name without substitution text
          original_ingredient_text: originalText,
          quantity_amount: parseAmountString(ingredient.amount), // Use proper amount parsing
          quantity_unit: ingredient.unit || null,
          grocery_category: (ingredient as any).grocery_category || null, // Use pre-categorized data if available
          is_checked: false,
          order_index: orderIndex++,
          recipe_id: recipe.id || null,
          user_saved_recipe_id: userSavedRecipeId || null,
          source_recipe_title: recipe.title || 'Unknown Recipe'
        };
        
        console.log(`[groceryHelpers] ✅ Created grocery item:`, {
          item_name: groceryItem.item_name,
          original_ingredient_text: groceryItem.original_ingredient_text,
          quantity_amount: groceryItem.quantity_amount,
          quantity_unit: groceryItem.quantity_unit,
          grocery_category: groceryItem.grocery_category,
          basicCategory: getBasicGroceryCategory(groceryItem.item_name)
        });
        
        groceryItems.push(groceryItem);
      }
    }
  }

  console.log(`[groceryHelpers] 🎯 Finished formatting ${groceryItems.length} grocery items`);
  
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
  
  // Helper function to check for exact word matches or word boundaries
  const hasExactWord = (text: string, word: string): boolean => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
  };
  
  // Helper function to check for exact phrase matches
  const hasExactPhrase = (text: string, phrase: string): boolean => {
    return text.includes(phrase.toLowerCase());
  };
  
  // PRIORITY 1: Spices & Herbs (most specific - check powders, dried, etc. first)
  // This prevents "onion powder" or "garlic powder" from being categorized as Produce
  if (hasExactPhrase(name, 'powder') || hasExactPhrase(name, 'dried') || 
      hasExactWord(name, 'salt') || hasExactWord(name, 'pepper') || hasExactPhrase(name, 'paprika') || 
      hasExactWord(name, 'cumin') || hasExactWord(name, 'oregano') || hasExactWord(name, 'thyme') || 
      hasExactWord(name, 'rosemary') || hasExactWord(name, 'cinnamon') || hasExactWord(name, 'vanilla') || 
      hasExactWord(name, 'turmeric') || hasExactPhrase(name, 'ginger powder') || hasExactPhrase(name, 'onion powder') || 
      hasExactPhrase(name, 'garlic powder') || hasExactPhrase(name, 'chili powder') || hasExactPhrase(name, 'curry powder') || 
      hasExactPhrase(name, 'bay leaves') || hasExactWord(name, 'nutmeg') || hasExactWord(name, 'allspice') || 
      hasExactWord(name, 'cardamom') || hasExactWord(name, 'cloves') || hasExactPhrase(name, 'fennel seeds') || 
      hasExactWord(name, 'coriander') || hasExactPhrase(name, 'mustard seed') || hasExactPhrase(name, 'sesame seeds') || 
      hasExactPhrase(name, 'poppy seeds') || hasExactWord(name, 'caraway') || hasExactWord(name, 'dill') || 
      hasExactWord(name, 'sage') || hasExactWord(name, 'marjoram') || hasExactWord(name, 'tarragon') || 
      hasExactPhrase(name, 'red pepper flakes') || hasExactPhrase(name, 'crushed red pepper') || 
      hasExactPhrase(name, 'smoked paprika') || hasExactPhrase(name, 'garlic granules') || hasExactPhrase(name, 'onion flakes') ||
      hasExactPhrase(name, 'ground cinnamon') || hasExactPhrase(name, 'ground ginger') || 
      hasExactPhrase(name, 'ground nutmeg') || hasExactPhrase(name, 'ground allspice') ||
      hasExactPhrase(name, 'ground cloves') || hasExactPhrase(name, 'ground coriander') ||
      hasExactPhrase(name, 'ground cumin') || hasExactPhrase(name, 'ground turmeric')) {
    return 'Spices & Herbs';
  }
  
  // PRIORITY 2: Meat & Seafood (moved up to catch ground meats before generic "ground")
  if (hasExactWord(name, 'chicken') || hasExactWord(name, 'beef') || hasExactWord(name, 'pork') ||
      hasExactWord(name, 'fish') || hasExactWord(name, 'salmon') || hasExactWord(name, 'shrimp') ||
      hasExactWord(name, 'bacon') || hasExactWord(name, 'turkey') || hasExactWord(name, 'lamb') ||
      hasExactPhrase(name, 'ground beef') || hasExactPhrase(name, 'ground turkey') || hasExactPhrase(name, 'ground chicken') ||
      hasExactPhrase(name, 'ground pork') || hasExactPhrase(name, 'ground lamb') || hasExactPhrase(name, 'ground bison') ||
      hasExactWord(name, 'steak') || hasExactWord(name, 'roast') || hasExactWord(name, 'tenderloin') ||
      hasExactWord(name, 'ribs') || hasExactWord(name, 'chops') || hasExactWord(name, 'ham') ||
      hasExactWord(name, 'sausage') || hasExactWord(name, 'chorizo') || hasExactWord(name, 'pepperoni') ||
      hasExactWord(name, 'tuna') || hasExactWord(name, 'cod') || hasExactWord(name, 'halibut') ||
      hasExactWord(name, 'tilapia') || hasExactPhrase(name, 'mahi mahi') || hasExactWord(name, 'crab') ||
      hasExactWord(name, 'lobster') || hasExactWord(name, 'scallops') || hasExactWord(name, 'mussels') ||
      hasExactWord(name, 'clams') || hasExactWord(name, 'oysters') || hasExactWord(name, 'duck') ||
      hasExactWord(name, 'venison') || hasExactWord(name, 'bison')) {
    return 'Meat & Seafood';
  }
  
  // PRIORITY 3: Condiments & Sauces (specific liquid/paste items)
  if (hasExactWord(name, 'sauce') || hasExactWord(name, 'ketchup') || hasExactWord(name, 'mustard') ||
      hasExactWord(name, 'mayo') || hasExactWord(name, 'mayonnaise') || hasExactWord(name, 'dressing') ||
      hasExactPhrase(name, 'soy sauce') || hasExactWord(name, 'tamari') || hasExactPhrase(name, 'hot sauce') || 
      hasExactWord(name, 'pickle') || hasExactWord(name, 'relish') || hasExactWord(name, 'sriracha') || 
      hasExactWord(name, 'worcestershire') || hasExactPhrase(name, 'barbecue sauce') || hasExactPhrase(name, 'bbq sauce') || 
      hasExactWord(name, 'teriyaki') || hasExactWord(name, 'tahini') || hasExactWord(name, 'pesto') || 
      hasExactWord(name, 'salsa') || hasExactWord(name, 'hummus') || hasExactWord(name, 'jam') || 
      hasExactWord(name, 'jelly') || hasExactWord(name, 'honey') || hasExactPhrase(name, 'maple syrup') || 
      hasExactWord(name, 'syrup') || hasExactWord(name, 'molasses') || hasExactWord(name, 'agave') || 
      hasExactPhrase(name, 'tomato paste') || hasExactPhrase(name, 'tomato sauce') || hasExactWord(name, 'marinara') || 
      hasExactWord(name, 'alfredo') || hasExactPhrase(name, 'chili paste') || hasExactPhrase(name, 'rice vinegar') ||
      hasExactWord(name, 'vinegar')) {
    return 'Condiments & Sauces';
  }
  
  // PRIORITY 4: Pantry Staples (non-perishable dry goods, oils - but NOT vinegars which go to Condiments)
  if (hasExactWord(name, 'flour') || hasExactWord(name, 'sugar') || hasExactWord(name, 'rice') ||
      hasExactWord(name, 'pasta') || hasExactWord(name, 'oil') ||
      hasExactWord(name, 'beans') || hasExactWord(name, 'lentils') || hasExactWord(name, 'oats') ||
      hasExactWord(name, 'quinoa') || hasExactWord(name, 'stock') || hasExactWord(name, 'broth') ||
      hasExactPhrase(name, 'coconut oil') || hasExactPhrase(name, 'olive oil') || hasExactPhrase(name, 'vegetable oil') ||
      hasExactPhrase(name, 'canola oil') || hasExactPhrase(name, 'sesame oil') || hasExactPhrase(name, 'avocado oil') ||
      hasExactPhrase(name, 'balsamic vinegar') || hasExactPhrase(name, 'apple cider vinegar') || hasExactPhrase(name, 'white vinegar') ||
      hasExactPhrase(name, 'red wine vinegar') || hasExactPhrase(name, 'brown sugar') || hasExactPhrase(name, 'powdered sugar') ||
      hasExactPhrase(name, 'coconut sugar') || hasExactPhrase(name, 'baking powder') || hasExactPhrase(name, 'baking soda') ||
      hasExactWord(name, 'cornstarch') || hasExactWord(name, 'arrowroot') || hasExactWord(name, 'tapioca') ||
      hasExactWord(name, 'breadcrumbs') || hasExactWord(name, 'panko') || hasExactWord(name, 'crackers') ||
      hasExactWord(name, 'cereal') || hasExactWord(name, 'granola') || hasExactWord(name, 'nuts') ||
      hasExactWord(name, 'almonds') || hasExactWord(name, 'walnuts') || hasExactWord(name, 'pecans') ||
      hasExactWord(name, 'cashews') || hasExactWord(name, 'peanuts') || hasExactPhrase(name, 'pine nuts') ||
      hasExactWord(name, 'chickpeas') || hasExactPhrase(name, 'black beans') || hasExactPhrase(name, 'kidney beans') ||
      hasExactPhrase(name, 'navy beans') || hasExactPhrase(name, 'split peas') || hasExactWord(name, 'barley') ||
      hasExactWord(name, 'bulgur') || hasExactWord(name, 'couscous') || hasExactWord(name, 'millet')) {
    return 'Pantry';
  }
  
  // PRIORITY 5: Dairy & Eggs (refrigerated dairy products)
  if (hasExactWord(name, 'milk') || hasExactWord(name, 'cheese') || hasExactWord(name, 'butter') ||
      hasExactWord(name, 'cream') || hasExactWord(name, 'yogurt') || hasExactWord(name, 'egg') ||
      hasExactPhrase(name, 'cottage cheese') || hasExactPhrase(name, 'sour cream') || hasExactPhrase(name, 'cream cheese') ||
      hasExactWord(name, 'ricotta') || hasExactWord(name, 'mozzarella') || hasExactWord(name, 'cheddar') ||
      hasExactWord(name, 'parmesan') || hasExactWord(name, 'feta') || hasExactPhrase(name, 'goat cheese') ||
      hasExactPhrase(name, 'swiss cheese') || hasExactWord(name, 'brie') || hasExactWord(name, 'camembert') ||
      hasExactPhrase(name, 'blue cheese') || hasExactPhrase(name, 'heavy cream') || hasExactPhrase(name, 'half and half') ||
      hasExactWord(name, 'buttermilk') || hasExactPhrase(name, 'greek yogurt') || hasExactWord(name, 'kefir') ||
      hasExactPhrase(name, 'salted butter') || hasExactPhrase(name, 'unsalted butter')) {
    return 'Dairy & Eggs';
  }
  
  // PRIORITY 6: Produce (fresh fruits, vegetables, fresh herbs)
  // Now checked AFTER spices to prevent "onion powder" from matching "onion"
  // Fresh herbs are specifically qualified to distinguish from dried spices
  if ((hasExactWord(name, 'onion') && !hasExactPhrase(name, 'onion powder') && !hasExactPhrase(name, 'onion flakes')) ||
      (hasExactWord(name, 'garlic') && !hasExactPhrase(name, 'garlic powder') && !hasExactPhrase(name, 'garlic granules')) ||
      hasExactWord(name, 'tomato') || hasExactPhrase(name, 'bell pepper') || hasExactWord(name, 'jalapeño') ||
      hasExactWord(name, 'lettuce') || hasExactWord(name, 'spinach') || hasExactWord(name, 'kale') ||
      hasExactWord(name, 'carrot') || hasExactWord(name, 'celery') || hasExactWord(name, 'potato') ||
      hasExactPhrase(name, 'sweet potato') || hasExactWord(name, 'broccoli') || hasExactWord(name, 'cauliflower') ||
      hasExactWord(name, 'cucumber') || hasExactWord(name, 'cucumbers') || hasExactWord(name, 'zucchini') || hasExactWord(name, 'squash') ||
      hasExactWord(name, 'eggplant') || hasExactWord(name, 'mushroom') || hasExactWord(name, 'avocado') ||
      hasExactWord(name, 'apple') || hasExactWord(name, 'banana') || hasExactWord(name, 'orange') ||
      hasExactWord(name, 'lemon') || hasExactWord(name, 'lime') || hasExactWord(name, 'strawberry') ||
      hasExactWord(name, 'blueberry') || hasExactWord(name, 'raspberry') || hasExactWord(name, 'blackberry') ||
      // Fresh herbs - more comprehensive coverage
      (hasExactWord(name, 'basil') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'leaves'))) ||
      (hasExactWord(name, 'parsley') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'leaves'))) ||
      (hasExactWord(name, 'cilantro') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'leaves'))) ||
      (hasExactWord(name, 'mint') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'leaves'))) ||
      (hasExactWord(name, 'rosemary') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'sprigs'))) ||
      (hasExactWord(name, 'thyme') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'sprigs'))) ||
      (hasExactWord(name, 'oregano') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'leaves'))) ||
      (hasExactWord(name, 'sage') && (hasExactWord(name, 'fresh') || hasExactWord(name, 'leaves'))) ||
      // Generic herb terms (when fresh)
      (hasExactWord(name, 'herbs') && (hasExactWord(name, 'fresh') || hasExactPhrase(name, 'chopped herbs'))) ||
      // Standalone fresh herbs (without explicit "fresh" but common fresh forms)
      hasExactWord(name, 'cilantro') || hasExactWord(name, 'basil') || hasExactWord(name, 'parsley') || 
      hasExactWord(name, 'mint') || hasExactWord(name, 'dill') || hasExactWord(name, 'chives') ||
      hasExactPhrase(name, 'green onion') || hasExactWord(name, 'scallion') || hasExactWord(name, 'leek') ||
      hasExactWord(name, 'shallot') || hasExactWord(name, 'ginger') || hasExactWord(name, 'asparagus') ||
      hasExactPhrase(name, 'brussels sprouts') || hasExactWord(name, 'cabbage') || hasExactWord(name, 'corn') ||
      hasExactWord(name, 'peas') || hasExactPhrase(name, 'green beans') || hasExactWord(name, 'artichoke')) {
    return 'Produce';
  }
  
  // PRIORITY 7: Frozen Foods (explicitly frozen items or commonly frozen items)
  if (hasExactWord(name, 'frozen') || hasExactWord(name, 'edamame')) {
    return 'Frozen';
  }
  
  // PRIORITY 8: Bakery (fresh baked goods)
  if (hasExactWord(name, 'bread') || hasExactWord(name, 'bagel') || hasExactWord(name, 'roll') ||
      hasExactWord(name, 'baguette') || hasExactWord(name, 'croissant') || hasExactWord(name, 'muffin') ||
      hasExactWord(name, 'tortilla') || hasExactWord(name, 'pita') || hasExactWord(name, 'naan')) {
    return 'Bakery';
  }
  
  // Default fallback
  return 'Other';
}

/**
 * Applies basic categorization to grocery items using simple pattern matching
 */
export function categorizeIngredients(items: GroceryListItem[]): GroceryListItem[] {
  console.log('[groceryHelpers] 🏷️ Starting basic categorization for', items.length, 'items');
  const result = items.map(item => {
    const category = getBasicGroceryCategory(item.item_name);
    console.log(`[groceryHelpers] 📝 Categorized "${item.item_name}" as "${category}"`);
    return {
      ...item,
      grocery_category: category
    };
  });
  console.log('[groceryHelpers] ✅ Completed basic categorization');
  return result;
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
  console.log('[groceryHelpers] 💾 Preparing', items.length, 'items for database insertion');
  const result = items.map(item => ({
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
  console.log('[groceryHelpers] ✅ Items prepared for database');
  return result;
} 