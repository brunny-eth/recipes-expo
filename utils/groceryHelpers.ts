import { CombinedParsedRecipe, StructuredIngredient } from '../common/types';
import { parseIngredientDisplayName } from './ingredientHelpers';
import { parseAmountString } from './recipeUtils';
import { parse } from 'fraction.js';
import { formatMeasurement } from './format';
import { convertUnits, availableUnits, Unit, getUnitDisplayName } from './units';

/**
 * Converts decimal amounts to readable fractions for grocery list display
 */
export function formatAmountForGroceryDisplay(amount: number | null): string | null {
  console.log('[groceryHelpers] 📊 formatAmountForGroceryDisplay called with:', amount);
  
  if (amount === null || amount === 0) {
    console.log('[groceryHelpers] 📊 formatAmountForGroceryDisplay returning null - amount is null or 0');
    return null;
  }

  // Use the existing formatMeasurement function which already handles fractions properly
  const result = formatMeasurement(amount);
  console.log('[groceryHelpers] 📊 formatAmountForGroceryDisplay returning:', result);
  return result;
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
  console.log('[groceryHelpers] 🔄 normalizeName called with:', name);
  let normalized = name.toLowerCase().trim();

  // Convert hyphens to spaces for consistent splitting and matching of multi-word adjectives
  normalized = normalized.replace(/-/g, ' ');

  // Add a new list/set for adjective-noun pairs to preserve
  // This list will be the primary mechanism for preserving critical modifiers.
  const preservedAdjectiveNounPairs = new Set([
    'toasted_pecans',
    'ground_beef',
    'shredded_cheese',
    'smoked_salmon',
    'roasted_red_peppers',
    'sun_dried_tomatoes', // Using 'sun_dried' for consistency if it appears as two words
    'aged_cheddar',
    'whole_wheat_flour',
    'active_dry_yeast',
    'all_purpose_flour', // Important to keep "all purpose" as it defines the flour type
    'ground_pork',
    'ground_chicken',
    'ground_turkey',
    'smoked_paprika',
    'hot_paprika',
    'sweet_paprika',
    'powdered_sugar',
    'confectioners_sugar',
    'brown_sugar', // While "brown" is generic, "brown sugar" is a distinct product
    'white_sugar', // Same for white sugar
    'fine_salt',
    'coarse_salt',
    // Add more as you identify them through monitoring or specific recipe needs
  ]);

  // Revised and more focused list of generic adjectives to remove
  const adjectivesToRemove = [
    'fresh', 'dried', 'chopped', 'diced', 'minced', 'crushed',
    'peeled', 'seeded', 'pitted', 'canned', 'frozen',
    'cooked', 'raw', 'boiled', 'fried', 'baked', 'grilled', 'steamed',
    'large', 'medium', 'small', 'jumbo', 'extra', 'super',
    'ripe', 'unripe', 'organic', 'gluten-free', 'sugar-free', 'low-fat', 'fat-free',
    'whole', 'half', 'quarter', 'light', 'dark', 'sweet', 'sour', 'spicy', 'mild',
    'fine', 'coarse',
    'cubed', 'drained', 'flaked', 'melted', 'softened', 'unsalted', 'salted',
    'plain', 'clarified', 'boneless', 'skinless', 'shelled',
    'pureed', 'mashed', 'whipped', 'beaten', 'sifted',
    'instant', 'pre-cooked', 'quick-cooking', 'self-rising',
    'reduced-sodium', 'unsweetened', 'powdered', 'granulated', 'brown', 'white',
    'yellow', 'red', 'green', 'black', 'pink', 'orange',
    'prepared', 'kosher', 'free-range', 'grass-fed', 'wild',
    'pasteurized', 'unpasteurized', 'seasoned', 'unseasoned', 'pure',
    'extra-virgin', 'virgin', 'thick', 'thin', 'regular', 'concentrated', 'diluted',
    'chilled', 'room-temperature',
    // Specific words that *can* be adjectives but are more likely to be part of a distinct ingredient name:
    // These should be moved to 'preservedAdjectiveNounPairs' if they create common problems.
    // For now, remove 'ground', 'shredded', 'smoked', 'roasted', 'toasted' from this general list
    // as they are explicitly handled in preservedAdjectiveNounPairs.
  ];
  
  // 2. Remove adjectives with contextual preservation
  let words = normalized.split(/\s+/).filter(Boolean); // filter(Boolean) removes empty strings from split

  let filteredWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Look ahead up to 2 words for potential multi-word pairs
    const nextWord = words[i + 1] || '';
    const nextTwoWords = words[i + 2] || '';

    // Construct potential pairs for checking
    const potentialPair1 = `${word}_${nextWord}`; // e.g., 'ground_beef'
    const potentialPair2 = `${word}_${nextWord}_${nextTwoWords}`; // e.g., 'roasted_red_peppers'

    // Check if the current word is in adjectivesToRemove.
    // However, if the current word is part of a *preserved* multi-word phrase,
    // then we should *not* remove it.

    let isPartiallyPreserved = false;
    // Check if current word starts a preserved two-word pair
    if (preservedAdjectiveNounPairs.has(potentialPair1)) {
        isPartiallyPreserved = true;
        console.log('[groceryHelpers] 🛡️ Preserving adjective-noun pair:', potentialPair1);
    }
    // Check if current word starts a preserved three-word pair
    if (preservedAdjectiveNounPairs.has(potentialPair2)) {
        isPartiallyPreserved = true;
        console.log('[groceryHelpers] 🛡️ Preserving adjective-noun pair:', potentialPair2);
    }
    // Also consider cases where the adjective might be after the noun,
    // though the `normalizeName` design usually puts adjectives first.
    // For now, we'll focus on adjective-noun patterns.

    if (
        adjectivesToRemove.includes(word) && // Is it a general adjective we usually remove?
        !isPartiallyPreserved && // AND is it *not* part of a specific preserved phrase starting with this word?
        // Your previous `!preservedAdjectiveNounPairs.has(`${word}_${words[i-1]}`)` implies checking if current word is a *second* word in a preserved pair.
        // This is tricky with simple string splitting. For now, let's simplify and focus on adjective-noun patterns.
        // If "cheese, shredded" is a common input, consider a pre-processing step to reorder "noun, adjective" to "adjective noun".
        !(word === 'ground' && nextWord === 'pepper') // Keep specific exception for "ground pepper" if needed, though now 'ground_pepper' could be added to set
    ) {
        // Skip this adjective as it's not critical in this context
        console.log('[groceryHelpers] 🗑️ Removing adjective:', word, 'from context:', words.join(' '));
        continue;
    }

    filteredWords.push(word);
  }

  normalized = filteredWords.join(' ');

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
  
  // Handle egg variations - normalize all to "eggs" (plural is more common for shopping)
  if (normalized === 'egg' || normalized === 'eggs') {
    console.log('[groceryHelpers] 🥚 EGG MATCH! Converting:', normalized, '→ eggs');
    normalized = 'eggs';
  }
  
  // Handle flour variations - normalize plain flour to "all purpose flour"
  // Note: "all purpose flour" is now preserved by the preservedAdjectiveNounPairs system
  if (normalized === 'flour') {
    console.log('[groceryHelpers] 🌾 FLOUR MATCH! Converting:', normalized, '→ all purpose flour');
    normalized = 'all purpose flour';
  }
  
  // Fix common ingredient misspellings
  const spellingCorrections: { [key: string]: string } = {
    'tomatoe': 'tomato',
    'roasted tomatoe': 'roasted tomato',
    'potatoe': 'potato',
    'roasted potatoe': 'roasted potato'
  };
  
  if (spellingCorrections[normalized]) {
    console.log('[groceryHelpers] ✏️ SPELLING CORRECTION:', normalized, '→', spellingCorrections[normalized]);
    normalized = spellingCorrections[normalized];
  }
  
  // Simple pluralization check - remove trailing 's' but be careful with exceptions
  const pluralExceptions = [
    'beans', 'peas', 'lentils', 'oats', 'grits', 'grains',
    'noodles', 'brussels sprouts', 'green beans',
    'sesame seeds', 'sunflower seeds', 'pumpkin seeds',
    'blueberries', 'strawberries', 'raspberries', 'blackberries', 'cranberries',
    'eggs'
  ];
  
  // Check if the normalized name contains any plural exception as a substring
  // This handles compound names like "frozen blueberries"
  const containsPlural = pluralExceptions.some(exception => normalized.includes(exception));
  
  // Only singularize if it's not an exception and ends with 's' and doesn't contain plural words
  if (normalized.endsWith('s') && !pluralExceptions.includes(normalized) && !containsPlural) {
    // Additional check: don't singularize if it would create a very short word
    const singular = normalized.slice(0, -1);
    if (singular.length >= 3) {
      normalized = singular;
    }
  }
  
  console.log('[groceryHelpers] ✅ normalizeName result:', name, '→', normalized);
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
  // Volume units (match units.ts)
  'fl oz': 'fl_oz', 'fluid ounce': 'fl_oz', 'fluid ounces': 'fl_oz',
  'fl. oz': 'fl_oz', 'fl.oz': 'fl_oz', 'floz': 'fl_oz',
  'cup': 'cup', 'cups': 'cup',
  'pint': 'pint', 'pints': 'pint', 'pt': 'pint',
  'quart': 'quart', 'quarts': 'quart', 'qt': 'quart',
  'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon',
  'milliliter': 'ml', 'milliliters': 'ml', 'mL': 'ml',
  'liter': 'liter', 'liters': 'liter', 'L': 'liter', 'l': 'liter',
  // Weight units (not converted, must match exactly)
  'g': 'g', 'gram': 'g', 'grams': 'g',
  'kg': 'kg', 'kgs': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
  'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
  'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
  // Count-based units - standardize all to 'each' for consistent aggregation
  'clove': 'each', 'cloves': 'each',
  'head': 'each', 'heads': 'each',
  'bunch': 'each', 'bunches': 'each',
  'piece': 'each', 'pieces': 'each',
  'stalk': 'each', 'stalks': 'each',
  'sprig': 'each', 'sprigs': 'each',
  'can': 'each', 'cans': 'each',
  'bottle': 'each', 'bottles': 'each',
  'box': 'each', 'boxes': 'each',
  'bag': 'each', 'bags': 'each',
  'package': 'each', 'packages': 'each',
  'jar': 'each', 'jars': 'each',
  'container': 'each', 'containers': 'each',
  'pinch': 'each', 'pinches': 'each',
  'dash': 'each', 'dashes': 'each',
  'each': 'each', 'count': 'each'
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
 * Checks if an ingredient can have both volume and count measurements
 * (e.g., shallots can be measured as "2 shallots" or "1/2 cup diced shallots")
 */
function canHaveVolumeAndCountMeasurements(ingredientName: string): boolean {
  const volumeAndCountIngredients = [
    'shallot', 'onion', 'garlic', 'mushroom', 'bell pepper', 'jalapeño', 'serrano'
  ];
  const normalizedName = ingredientName.toLowerCase().trim();
  return volumeAndCountIngredients.some(ingredient => normalizedName.includes(ingredient));
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
  
  // Special case: each units and null are compatible for count-based aggregation
  if ((normalizedUnit1 === 'each' && normalizedUnit2 === null) || 
      (normalizedUnit1 === null && normalizedUnit2 === 'each')) {
    console.log(`[groceryHelpers] ✅ Special case: each and null are compatible for count-based aggregation`);
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
  // Define unit groups that can be converted between each other
  const volumeUnits = new Set([
    'tsp', 'tbsp', 'cup', 'ml', 'liter',
    'fl_oz', 'pint', 'quart', 'gallon'
  ]);
  
  const weightUnits = new Set(['gram', 'kilogram', 'ounce', 'pound']);
  
  const countUnits = new Set(['each']);

  // Check if both units are volume units (these can be converted)
  if (volumeUnits.has(normalizedUnit1) && volumeUnits.has(normalizedUnit2)) {
    console.log('[groceryHelpers] ✅ Both are volume units - can convert:', {
      unit1: normalizedUnit1,
      unit2: normalizedUnit2,
      unit1_in_set: volumeUnits.has(normalizedUnit1),
      unit2_in_set: volumeUnits.has(normalizedUnit2),
      volume_units: Array.from(volumeUnits)
    });
    return true;
  }

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
    // Create a normalized copy of the item
    const normalizedItem = {
      ...item,
      item_name: normalizedName // Use normalized name for grouping
    };
    if (!groupedByName.has(normalizedName)) {
      groupedByName.set(normalizedName, []);
    }
    groupedByName.get(normalizedName)!.push(normalizedItem);
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
        
        // Check if we can aggregate these items
        let canAggregate = areUnitsCompatible(baseItem.quantity_unit, compareItem.quantity_unit);
        
        // Special case: volume/count combinations for certain ingredients (like shallots)
        if (!canAggregate && canHaveVolumeAndCountMeasurements(baseItem.item_name)) {
          const baseUnit = normalizeUnit(baseItem.quantity_unit);
          const compareUnit = normalizeUnit(compareItem.quantity_unit);
          
          // Check if one is volume (cup/tbsp/etc) and the other is count (null/each/etc)
          const volumeUnits = new Set(['cup', 'tbsp', 'tsp', 'ml', 'fl_oz']);
          const countUnits = new Set([null, 'each']);
          
          if ((volumeUnits.has(baseUnit as any) && countUnits.has(compareUnit as any)) ||
              (countUnits.has(baseUnit as any) && volumeUnits.has(compareUnit as any))) {
            console.log('[groceryHelpers] 🥄 Special volume/count aggregation for:', baseItem.item_name, {
              baseUnit,
              compareUnit
            });
            canAggregate = true;
          }
        }
        
        if (canAggregate) {
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
            }
            // Special case: Handle volume/count combinations for ingredients like shallots
            else if (canHaveVolumeAndCountMeasurements(baseItem.item_name)) {
              const baseUnit = normalizeUnit(baseItem.quantity_unit);
              const compareUnit = normalizeUnit(compareItem.quantity_unit);
              const volumeUnits = new Set(['cup', 'tbsp', 'tsp', 'ml', 'fl_oz']);
              const countUnits = new Set([null, 'clove', 'piece']);
              
              if ((volumeUnits.has(baseUnit as any) && countUnits.has(compareUnit as any)) ||
                  (countUnits.has(baseUnit as any) && volumeUnits.has(compareUnit as any))) {
                // Create a combined entry showing both measurements
                console.log('[groceryHelpers] 🥄 Creating combined volume/count entry for:', baseItem.item_name);
                
                // Keep the base item's measurements for display, but note it's a combined entry
                finalUnit = baseItem.quantity_unit; // Keep base unit
                finalAmount = baseAmount; // Keep base amount
                
                // Update the item name to be more descriptive
                const volumeItem = volumeUnits.has(baseUnit as any) ? baseItem : compareItem;
                const countItem = volumeUnits.has(baseUnit as any) ? compareItem : baseItem;
                
                // Don't try to add amounts - just combine the descriptions
                // The original_ingredient_text will be combined below
              }
            } else if (baseItem.quantity_unit && compareItem.quantity_unit && baseItem.quantity_unit !== compareItem.quantity_unit) {
              const normalizedBaseUnit = normalizeUnit(baseItem.quantity_unit);
              const normalizedCompareUnit = normalizeUnit(compareItem.quantity_unit);
              
              if (normalizedBaseUnit && normalizedCompareUnit) {
                // Always convert through milliliters as the base unit
                const baseInMl = convertUnits(baseAmount, normalizedBaseUnit as any, 'ml');
                const compareInMl = convertUnits(compareAmount, normalizedCompareUnit as any, 'ml');
                
                if (baseInMl !== null && compareInMl !== null) {
                  const totalInMl = baseInMl + compareInMl;
                  console.log('[groceryHelpers] 📊 Converting amounts:', {
                    base: { amount: baseAmount, unit: normalizedBaseUnit, inMl: baseInMl },
                    compare: { amount: compareAmount, unit: normalizedCompareUnit, inMl: compareInMl },
                    total: { inMl: totalInMl }
                  });
                  
                  // Try converting to each unit in order of preference
                  const preferredUnits: [Unit, number, number][] = [
                    ['cup', 0.25, 4],      // 1/4 cup to 4 cups
                    ['fl_oz', 1, 16],      // 1 fl oz to 16 fl oz
                    ['tbsp', 1, 16],       // 1 tbsp to 16 tbsp
                    ['tsp', 1, 16],        // 1 tsp to 16 tsp
                    ['ml', 1, 1000]        // fallback to ml
                  ];
                  
                  let bestUnit: Unit = 'ml';
                  let bestAmount = totalInMl;
                  
                  for (const [unit, min, max] of preferredUnits) {
                    const amount = convertUnits(totalInMl, 'ml', unit);
                    if (amount !== null && amount >= min && amount <= max) {
                      console.log('[groceryHelpers] 📊 Found suitable unit:', {
                        unit,
                        amount,
                        min,
                        max
                      });
                      bestUnit = unit;
                      bestAmount = amount;
                      break;
                    }
                  }
                  
                  finalUnit = bestUnit.toString();
                  finalAmount = bestAmount;
                  
                  console.log('[groceryHelpers] 📊 Final conversion:', {
                    totalInMl,
                    finalUnit,
                    finalAmount,
                    displayUnit: getUnitDisplayName(finalUnit as Unit, finalAmount)
                  });
                } else {
                  console.warn('[groceryHelpers] ⚠️ Unit conversion failed:', {
                    baseUnit: normalizedBaseUnit,
                    compareUnit: normalizedCompareUnit,
                    baseAmount,
                    compareAmount
                  });
                  // No fallback - if conversion fails, don't aggregate
                  continue;
                }
              } else {
                console.warn('[groceryHelpers] ⚠️ Unit normalization failed:', {
                  baseUnit: baseItem.quantity_unit,
                  compareUnit: compareItem.quantity_unit
                });
                // No fallback - if normalization fails, don't aggregate
                continue;
              }
            } else {
              finalAmount = baseAmount + compareAmount;
            }
            
            baseItem.quantity_amount = finalAmount;
            baseItem.quantity_unit = finalUnit;
            // Always use standardized display unit based on final amount
            baseItem.display_unit = getUnitDisplayName(finalUnit as Unit, finalAmount);
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
        // If ingredient.unit is null/empty, try to extract from the original text
        let standardizedUnit = normalizeUnit(ingredient.unit);
        if (standardizedUnit === null && ingredient.unit === null) {
          // Fallback: try to extract unit from the original text
          console.log('[groceryHelpers] 🔄 Unit is null, trying to extract from original text:', originalText);
          
          // Simple unit extraction from original text
          const unitMatch = originalText.match(/\b(cup|cups|tbsp|tbs|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters|clove|cloves|head|heads|bunch|bunches|piece|pieces|stalk|stalks|sprig|sprigs|can|cans|bottle|bottles|box|boxes|bag|bags|package|packages|jar|jars|container|containers|pinch|pinches|dash|dashes|each|count)\b/i);
          if (unitMatch) {
            const extractedUnit = unitMatch[1].toLowerCase();
            standardizedUnit = normalizeUnit(extractedUnit);
            console.log('[groceryHelpers] ✅ Successfully extracted unit from original text:', extractedUnit, '→', standardizedUnit);
          }
        }
        
        // Parse amount first to use for display unit
        // If ingredient.amount is null/empty, try to parse from the original text
        let amount = parseAmountString(ingredient.amount);
        if (amount === null && ingredient.amount === null) {
          // Fallback: try to parse amount from the original text
          console.log('[groceryHelpers] 🔄 Amount is null, trying to parse from original text:', originalText);
          amount = parseAmountString(originalText);
          if (amount !== null) {
            console.log('[groceryHelpers] ✅ Successfully parsed amount from original text:', amount);
          }
        }
        
        // Create grocery list item from final ingredient
        const groceryItem = {
          item_name: parsedName.baseName, // Use base name without substitution text
          original_ingredient_text: originalText,
          quantity_amount: amount, // Use proper amount parsing
          quantity_unit: standardizedUnit, // Use standardized unit internally
          display_unit: standardizedUnit ? getUnitDisplayName(standardizedUnit as Unit, amount || 1) : null,
          grocery_category: (ingredient as any).grocery_category || null, // Use pre-categorized data if available
          is_checked: false,
          order_index: orderIndex++,
          recipe_id: recipe.id || null,
          user_saved_recipe_id: userSavedRecipeId || null,
          source_recipe_title: recipe.title || 'Unknown Recipe'
        };
        
        console.log(`[groceryHelpers] 🔍 Detailed grocery item creation:`, {
          originalName: ingredient.name,
          parsedBaseName: parsedName.baseName,
          originalAmount: ingredient.amount,
          parsedAmount: amount,
          originalUnit: ingredient.unit,
          standardizedUnit: standardizedUnit,
          displayUnit: groceryItem.display_unit,
          originalText: originalText,
          finalGroceryItem: {
            item_name: groceryItem.item_name,
            quantity_amount: groceryItem.quantity_amount,
            quantity_unit: groceryItem.quantity_unit,
            display_unit: groceryItem.display_unit
          }
        });
        
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
  
  // Post-process: Convert large cheese amounts from oz to cups for better grocery shopping
  const processedItems = groceryItems.map(item => {
    // Check if this is a cheese item measured in oz
    if (item.quantity_unit === 'oz' && item.quantity_amount && 
        (item.item_name.toLowerCase().includes('cheese') || 
         item.item_name.toLowerCase().includes('mozzarella') || 
         item.item_name.toLowerCase().includes('cheddar') ||
         item.item_name.toLowerCase().includes('parmesan'))) {
      
      // Convert large oz amounts to cups (4 oz = 1 cup for shredded cheese)
      if (item.quantity_amount >= 8) { // Convert amounts 8 oz and above
        const cupsAmount = item.quantity_amount / 4;
        console.log('[groceryHelpers] 🧀 Converting cheese from oz to cups:', {
          item: item.item_name,
          originalAmount: item.quantity_amount,
          originalUnit: 'oz',
          newAmount: cupsAmount,
          newUnit: 'cup'
        });
        
        return {
          ...item,
          quantity_amount: cupsAmount,
          quantity_unit: 'cup',
          display_unit: getUnitDisplayName('cup', cupsAmount)
        };
      }
    }
    
    return item;
  });
  
  return processedItems;
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
  // Note: Be specific about pepper types to avoid catching vegetable peppers (bell, jalapeño, etc.)
  if (hasExactPhrase(name, 'powder') || hasExactPhrase(name, 'dried') || 
      hasExactWord(name, 'salt') || hasExactPhrase(name, 'black pepper') || hasExactPhrase(name, 'white pepper') ||
      hasExactPhrase(name, 'ground pepper') || hasExactPhrase(name, 'pepper powder') || 
      hasExactPhrase(name, 'peppercorn') || hasExactPhrase(name, 'pepper corns') || hasExactPhrase(name, 'paprika') || 
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
      hasExactWord(name, 'poblano') || hasExactWord(name, 'serrano') || hasExactWord(name, 'habanero') ||
      hasExactWord(name, 'anaheim') || hasExactWord(name, 'fresno') || hasExactWord(name, 'chipotle') ||
      hasExactPhrase(name, 'chili pepper') || hasExactPhrase(name, 'hot pepper') || hasExactPhrase(name, 'sweet pepper') ||
      hasExactPhrase(name, 'banana pepper') || hasExactPhrase(name, 'cherry pepper') ||
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