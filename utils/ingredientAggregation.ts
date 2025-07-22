import { GroceryListItem } from './groceryHelpers';
import { parse, toFraction } from 'fraction.js';

/**
 * Normalizes an ingredient name for consistent aggregation.
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes irrelevant adjectives (but keeps important ones like "toasted")
 * - Makes singular (simple implementation)
 */
export function normalizeName(name: string): string {
  console.log('[ingredientAggregation] 🔄 Normalizing name:', name);
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
  const residualUnits = ['clove', 'cloves', 'piece', 'pieces'];
  const residualUnitPattern = new RegExp(`\\s+(${residualUnits.join('|')})$`, 'i');
  normalized = normalized.replace(residualUnitPattern, '');
  
  // Clean up extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
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
  
  console.log('[ingredientAggregation] ✨ Normalized result:', normalized);
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
  console.log('[ingredientAggregation] 📏 Normalizing unit:', unit);
  if (!unit) return null;
  const lowerUnit = unit.toLowerCase().trim();
  const result = unitDictionary[lowerUnit] || null;
  console.log('[ingredientAggregation] 📏 Normalized unit result:', result);
  return result;
}

/**
 * Parses a quantity string (e.g., "1 1/2", "0.5") into a number.
 * Returns null if parsing fails.
 */
function parseQuantity(amount: number | string | null): number | null {
  console.log('[ingredientAggregation] 🔢 Parsing quantity:', amount);
  if (typeof amount === 'number') {
    return amount;
  }
  if (typeof amount === 'string' && amount.trim() !== '') {
    try {
      // Use fraction.js to handle mixed numbers like "1 1/2"
      const result = parse(amount.trim());
      console.log('[ingredientAggregation] 🔢 Parsed quantity result:', result);
      return result;
    } catch (e) {
      console.warn('[ingredientAggregation] ⚠️ Failed to parse quantity:', amount, e);
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
  console.log('[ingredientAggregation] 🔍 Checking unit compatibility:', { unit1, unit2 });
  const normalizedUnit1 = normalizeUnit(unit1);
  const normalizedUnit2 = normalizeUnit(unit2);

  if (normalizedUnit1 === null && normalizedUnit2 === null) return true;
  if (normalizedUnit1 === null || normalizedUnit2 === null) return false;

  // If units are exactly the same, they're compatible
  if (normalizedUnit1 === normalizedUnit2) {
    console.log('[ingredientAggregation] ✅ Units are identical');
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
    console.log('[ingredientAggregation] ✅ Both are volume units');
    return true; // Both are volume units
  }
  
  if (weightUnits.has(normalizedUnit1) && weightUnits.has(normalizedUnit2)) {
    console.log('[ingredientAggregation] ✅ Both are weight units');
    return true; // Both are weight units
  }
  
  if (countUnits.has(normalizedUnit1) && countUnits.has(normalizedUnit2)) {
    console.log('[ingredientAggregation] ✅ Both are count units');
    return true; // Both are count units
  }

  console.log('[ingredientAggregation] ❌ Units are not compatible');
  return false; // Units are not compatible
}

/**
 * Aggregates a list of grocery items.
 * Combines items with the same name and compatible units.
 */
export function aggregateGroceryList(items: GroceryListItem[]): GroceryListItem[] {
  console.log('[ingredientAggregation] 🔄 Starting aggregation with', items.length, 'items');
  if (!items || items.length === 0) {
    return [];
  }

  const aggregatedMap = new Map<string, GroceryListItem>();

  for (const item of items) {
    const normalizedItemName = normalizeName(item.item_name);
    const normalizedUnit = normalizeUnit(item.quantity_unit);
    const key = `${normalizedItemName}|${normalizedUnit}`;

    console.log('[ingredientAggregation] 📝 Processing item:', {
      original_name: item.item_name,
      normalized_name: normalizedItemName,
      original_unit: item.quantity_unit,
      normalized_unit: normalizedUnit,
      aggregation_key: key
    });

    const existing = aggregatedMap.get(key);
    
    if (existing && areUnitsCompatible(existing.quantity_unit, item.quantity_unit)) {
      console.log('[ingredientAggregation] 🔗 Combining with existing item');
      // --- Combine Items ---
      const existingAmount = parseQuantity(existing.quantity_amount);
      const currentAmount = parseQuantity(item.quantity_amount);

      console.log('[ingredientAggregation] 🔢 Amounts to combine:', {
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
        console.log('[ingredientAggregation] ➕ Combined amounts:', total);
      } else if (currentAmount !== null) {
        // If existing had no amount but the new one does, use the new one.
        existing.quantity_amount = currentAmount;
        console.log('[ingredientAggregation] ➡️ Using current amount:', currentAmount);
      }
      
      // Append original text for reference
      existing.original_ingredient_text += ` | ${item.original_ingredient_text}`;

    } else {
      console.log('[ingredientAggregation] ➕ Adding new item');
      // --- Add New Item ---
      // If an item with the same name but different unit exists, create a new entry
      const newKey = `${normalizedItemName}|${normalizedUnit}|${aggregatedMap.size}`;
      
      console.log('[ingredientAggregation] 🔑 Using key:', existing ? newKey : key);
      
      // When adding a new item, store its unit in the canonical form
      const newItem = { ...item };
      newItem.quantity_unit = normalizedUnit;
      aggregatedMap.set(existing ? newKey : key, newItem);
    }
  }

  const result = Array.from(aggregatedMap.values());
  console.log('[ingredientAggregation] ✅ Aggregation complete:', {
    input_items: items.length,
    output_items: result.length
  });
  
  return result;
} 