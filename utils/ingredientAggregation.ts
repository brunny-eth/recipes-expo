import { GroceryListItem } from './groceryHelpers';
import { parse, toFraction } from 'fraction.js';

/**
 * Normalizes an ingredient name for consistent aggregation.
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Makes singular (simple implementation)
 */
function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Simple pluralization check - not exhaustive but covers common cases
  if (normalized.endsWith('s')) {
    normalized = normalized.slice(0, -1);
  }
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
  if (!unit) return null;
  const lowerUnit = unit.toLowerCase().trim();
  return unitDictionary[lowerUnit] || null;
}

/**
 * Parses a quantity string (e.g., "1 1/2", "0.5") into a number.
 * Returns null if parsing fails.
 */
function parseQuantity(amount: number | string | null): number | null {
  if (typeof amount === 'number') {
    return amount;
  }
  if (typeof amount === 'string' && amount.trim() !== '') {
    try {
      // Use fraction.js to handle mixed numbers like "1 1/2"
      return parse(amount.trim());
    } catch (e) {
      return null; // Return null if parsing fails
    }
  }
  return null;
}

/**
 * A very simple unit compatibility check.
 * In a real-world scenario, this would involve a comprehensive conversion library.
 */
function areUnitsCompatible(unit1: string | null, unit2: string | null): boolean {
  const normalizedUnit1 = normalizeUnit(unit1);
  const normalizedUnit2 = normalizeUnit(unit2);

  if (normalizedUnit1 === null && normalizedUnit2 === null) return true;
  if (normalizedUnit1 === null || normalizedUnit2 === null) return false;

  return normalizedUnit1 === normalizedUnit2;
}

/**
 * Aggregates a list of grocery items.
 * Combines items with the same name and compatible units.
 */
export function aggregateGroceryList(items: GroceryListItem[]): GroceryListItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  const aggregatedMap = new Map<string, GroceryListItem>();

  for (const item of items) {
    const normalizedItemName = normalizeName(item.item_name);
    const normalizedUnit = normalizeUnit(item.quantity_unit);
    const key = `${normalizedItemName}|${normalizedUnit}`;

    const existing = aggregatedMap.get(key);
    
    if (existing && areUnitsCompatible(existing.quantity_unit, item.quantity_unit)) {
      // --- Combine Items ---
      const existingAmount = parseQuantity(existing.quantity_amount);
      const currentAmount = parseQuantity(item.quantity_amount);

      if (existingAmount !== null && currentAmount !== null) {
        const total = existingAmount + currentAmount;
        // The quantity_amount should always be a number for further processing.
        // Conversion to a fraction string should happen on the frontend.
        existing.quantity_amount = total;
      } else if (currentAmount !== null) {
        // If existing had no amount but the new one does, use the new one.
        existing.quantity_amount = currentAmount;
      }
      
      // Append original text for reference
      existing.original_ingredient_text += ` | ${item.original_ingredient_text}`;

    } else {
      // --- Add New Item ---
      // If an item with the same name but different unit exists, create a new entry
      const newKey = `${normalizedItemName}|${normalizedUnit}|${aggregatedMap.size}`;
      
      // When adding a new item, store its unit in the canonical form
      const newItem = { ...item };
      newItem.quantity_unit = normalizedUnit;
      aggregatedMap.set(existing ? newKey : key, newItem);
    }
  }

  return Array.from(aggregatedMap.values());
} 