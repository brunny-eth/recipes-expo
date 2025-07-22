import { CombinedParsedRecipe, StructuredIngredient } from '../common/types';
import { parseIngredientDisplayName } from './ingredientHelpers';
import { parseAmountString } from './recipeUtils';
import { parse, toFraction } from 'fraction.js';
import { convertUnits, availableUnits } from './units';

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
  quantity_unit: string | null;  // Internal standardized unit (e.g., 'tbsp')
  display_unit: string | null;   // User-friendly display unit (e.g., 'Tbsp' or 'tablespoon')
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
  let normalized = name.toLowerCase().trim();

  // A more robust way to remove adjectives without brittle regex
  const adjectivesToRemove = [
    'fresh', 'dried', 'ground', 'chopped', 'sliced', 'diced', 'minced', 'crushed', 'peeled', 'seeded',
    'large', 'medium', 'small', 'thin', 'thick', 'whole', 'optional', 'for garnish', 'to taste',
    'plus more for garnish', 'cooked', 'uncooked', 'raw', 'ripe', 'unripe', 'sweet', 'unsweetened',
    'salted', 'unsalted', 'low-sodium', 'lower-sodium', 'toasted'
  ];
  
  // Create a regex pattern that matches any of the adjectives as whole words
  const pattern = new RegExp(`\\b(${adjectivesToRemove.join('|')})\\b`, 'gi');
  normalized = normalized.replace(pattern, '');

  // Clean up extra spaces that may have been left by removing adjectives
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
  
  // Handle garlic variations - normalize all to "garlic"
  if (normalized === 'garlic clove' || normalized === 'clove garlic' || normalized === 'garlic cloves' || normalized === 'cloves garlic') {
    console.log('[groceryHelpers] 🧄 GARLIC MATCH! Converting:', normalized, '→ garlic');
    normalized = 'garlic';
  }
  
  // Handle sesame seed variations - normalize all to "sesame seed"
  if (normalized === 'sesame seed' || normalized === 'sesame seeds') {
    console.log('[groceryHelpers] 🌱 SESAME MATCH! Converting:', normalized, '→ sesame seed');
    normalized = 'sesame seed';
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
  
  return normalized;
}

/**
 * A dictionary to normalize common units to the canonical short-form
 * required by the `units.ts` conversion utility.
 */
const unitDictionary: { [key: string]: string } = {
  // Teaspoon
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  'Tsp': 'tsp', 'Tsps': 'tsp',
  // Tablespoon
  tbsp: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  'Tbsp': 'tbsp', 'Tbsps': 'tbsp',
  // Ounce
  oz: 'oz', ounces: 'oz', 'fl oz': 'fl_oz', 'fluid ounce': 'fl_oz', 'fluid ounces': 'fl_oz',
  // Pound
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  // Gram
  g: 'g', gram: 'g', grams: 'g',
  // Kilogram
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  // Milliliter
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  // Liter
  l: 'l', liter: 'l', liters: 'l',
  // Count
  clove: 'clove', cloves: 'clove',
  cup: 'cup', cups: 'cup',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
};

/**
 * Normalizes a unit to its canonical short-form.
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
  // console.log('[groceryHelpers] 🔍 Checking unit compatibility:', { unit1, unit2 });
  const normalizedUnit1 = normalizeUnit(unit1);
  const normalizedUnit2 = normalizeUnit(unit2);

  if (normalizedUnit1 === null && normalizedUnit2 === null) {
    console.log('[groceryHelpers] ✅ Units are compatible (both null)');
    return true;
  }
  
  // Special case: cloves and null are compatible for garlic aggregation
  if ((normalizedUnit1 === 'clove' && normalizedUnit2 === null) || 
      (normalizedUnit1 === null && normalizedUnit2 === 'clove')) {
    console.log(`[groceryHelpers] ✅ Special case: clove and null are compatible for garlic`);
    return true;
  }
  
  // Special case: tablespoons and null are compatible for seeds/spices aggregation
  if ((normalizedUnit1 === 'tbsp' && normalizedUnit2 === null) || 
      (normalizedUnit1 === null && normalizedUnit2 === 'tbsp')) {
    console.log(`[groceryHelpers] ✅ Special case: tbsp and null are compatible for seeds/spices`);
    return true;
  }
  
  if (normalizedUnit1 === null || normalizedUnit2 === null) {
    console.log(`[groceryHelpers] ❌ Units are not compatible (one is null): ${normalizedUnit1}, ${normalizedUnit2}`);
    return false;
  }

  // If units are exactly the same, they're compatible
  if (normalizedUnit1 === normalizedUnit2) {
    // console.log('[groceryHelpers] ✅ Units are identical');
    return true;
  }

  // Check if both units are available for conversion (i.e., they are volume units)
  const isUnit1Convertible = availableUnits.includes(normalizedUnit1 as any);
  const isUnit2Convertible = availableUnits.includes(normalizedUnit2 as any);

  if (isUnit1Convertible && isUnit2Convertible) {
    console.log(`[groceryHelpers] ✅ Both units (${normalizedUnit1}, ${normalizedUnit2}) are convertible volume units`);
    return true;
  }
  
  console.log(`[groceryHelpers] ❌ Units are not convertible: ${normalizedUnit1}, ${normalizedUnit2}`);

  // Define unit groups for non-convertible but similar types
  // Weight units can only be compatible with the SAME weight unit (no conversion available)
  const weightUnits = new Set(['gram', 'kilogram', 'ounce', 'pound']);
  
  const countUnits = new Set([
    'clove', 'piece', 'pinch', 'dash'
  ]);

  // Check if both units are weight units - only compatible if they're identical
  if (weightUnits.has(normalizedUnit1) && weightUnits.has(normalizedUnit2)) {
    if (normalizedUnit1 === normalizedUnit2) {
      console.log('[groceryHelpers] ✅ Both are identical weight units');
      return true;
    } else {
      console.log('[groceryHelpers] ❌ Different weight units - no conversion available');
      return false; // Different weight units cannot be converted
    }
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
 * This new implementation first groups by name, then attempts to combine units.
 */
export function aggregateGroceryList(items: GroceryListItem[]): GroceryListItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  // Step 1: Group all items by their normalized name.
  const groupedByName = new Map<string, GroceryListItem[]>();
  for (const item of items) {
    const normalizedName = normalizeName(item.item_name);
    if (!groupedByName.has(normalizedName)) {
      groupedByName.set(normalizedName, []);
    }
    groupedByName.get(normalizedName)!.push(item);
  }

  const finalAggregatedList: GroceryListItem[] = [];

  // Step 2: Iterate through each group and aggregate compatible units.
  for (const [name, itemList] of groupedByName.entries()) {
    if (itemList.length === 1) {
      finalAggregatedList.push(itemList[0]);
      continue;
    }

    const aggregatedItemsForGroup = [];
    const processedIndices = new Set<number>();

    for (let i = 0; i < itemList.length; i++) {
      if (processedIndices.has(i)) continue;

      let baseItem = { ...itemList[i] };
      processedIndices.add(i);

      for (let j = i + 1; j < itemList.length; j++) {
        if (processedIndices.has(j)) continue;

        const compareItem = itemList[j];
        if (areUnitsCompatible(baseItem.quantity_unit, compareItem.quantity_unit)) {
          const baseAmount = parseQuantity(baseItem.quantity_amount);
          const compareAmount = parseQuantity(compareItem.quantity_amount);

          if (baseAmount !== null && compareAmount !== null) {
            let convertedAmount = compareAmount;
            let finalUnit = baseItem.quantity_unit;
            let finalAmount = baseAmount;
            
            // Special case: Handle clove/null compatibility for garlic
            if ((baseItem.quantity_unit === 'cloves' && compareItem.quantity_unit === null) ||
                (baseItem.quantity_unit === null && compareItem.quantity_unit === 'cloves') ||
                (normalizeUnit(baseItem.quantity_unit) === 'clove' && compareItem.quantity_unit === null) ||
                (baseItem.quantity_unit === null && normalizeUnit(compareItem.quantity_unit) === 'clove')) {
              // Use the cloves unit and add the amounts
              finalUnit = baseItem.quantity_unit || compareItem.quantity_unit;
              finalAmount = baseAmount + compareAmount;
            } 
            // Special case: Handle tbsp/null compatibility for seeds/spices
            else if ((normalizeUnit(baseItem.quantity_unit) === 'tbsp' && compareItem.quantity_unit === null) ||
                     (baseItem.quantity_unit === null && normalizeUnit(compareItem.quantity_unit) === 'tbsp')) {
              // Use the tbsp unit and add the amounts
              finalUnit = baseItem.quantity_unit || compareItem.quantity_unit;
              finalAmount = baseAmount + compareAmount;
            } else if (baseItem.quantity_unit && compareItem.quantity_unit && baseItem.quantity_unit !== compareItem.quantity_unit) {
              const normalizedBaseUnit = normalizeUnit(baseItem.quantity_unit);
              const normalizedCompareUnit = normalizeUnit(compareItem.quantity_unit);
              
              if (normalizedBaseUnit && normalizedCompareUnit) {
                const converted = convertUnits(compareAmount, normalizedCompareUnit as any, normalizedBaseUnit as any);
                if (converted !== null) {
                  const totalInBaseUnit = baseAmount + converted;
                  const totalInCompareUnit = convertUnits(baseAmount, normalizedBaseUnit as any, normalizedCompareUnit as any);
                  
                  // Choose the unit that gives a more readable result
                  // Prefer larger units when the result is more than 16 of the smaller unit
                  if (totalInBaseUnit > 16 && totalInCompareUnit !== null && totalInCompareUnit < 4) {
                    // Use the compare unit (larger unit)
                    finalUnit = compareItem.quantity_unit;
                    finalAmount = totalInCompareUnit;
                  } else {
                    // Use the base unit
                    finalAmount = totalInBaseUnit;
                  }
                } else {
                  finalAmount = baseAmount + compareAmount; // Fallback if conversion fails
                }
              } else {
                finalAmount = baseAmount + compareAmount; // Fallback if normalization fails
              }
            } else {
              finalAmount = baseAmount + compareAmount;
            }
            
            baseItem.quantity_amount = finalAmount;
            baseItem.quantity_unit = finalUnit;
            // Keep the original display unit if we're using that unit, otherwise use the new unit
            baseItem.display_unit = finalUnit === baseItem.quantity_unit ? baseItem.display_unit : compareItem.display_unit;
            baseItem.original_ingredient_text += ` | ${compareItem.original_ingredient_text}`;
            processedIndices.add(j);
          }
        }
      }
      aggregatedItemsForGroup.push(baseItem);
    }
    finalAggregatedList.push(...aggregatedItemsForGroup);
  }

  console.log('[groceryHelpers] ✅ Aggregation complete:', {
    input_items: items.length,
    output_items: finalAggregatedList.length,
    items_combined: items.length - finalAggregatedList.length
  });

  console.log('[groceryHelpers] 🚨 FINAL AGGREGATION RESULT:', {
    input_count: items.length,
    output_count: finalAggregatedList.length,
    garlic_items: finalAggregatedList.filter(item => item.item_name.toLowerCase().includes('garlic')),
    sesame_items: finalAggregatedList.filter(item => item.item_name.toLowerCase().includes('sesame'))
  });

  return finalAggregatedList;
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
        
        // Standardize the unit immediately
        const standardizedUnit = normalizeUnit(ingredient.unit);
        
        // Create grocery list item from final ingredient
        const groceryItem = {
          item_name: parsedName.baseName, // Use base name without substitution text
          original_ingredient_text: originalText,
          quantity_amount: parseAmountString(ingredient.amount), // Use proper amount parsing
          quantity_unit: standardizedUnit, // Use standardized unit internally
          display_unit: ingredient.unit || null, // Keep original unit for display
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
  display_unit: string | null;
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
    display_unit: item.display_unit || item.quantity_unit,
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