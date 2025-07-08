import { StructuredIngredient, IngredientGroup } from '../common/types/recipes';

// Standardized unit mapping for consistent unit normalization
const standardizedUnits: Record<string, string> = {
  // Volume units
  'cups': 'cup',
  'c': 'cup',
  'cup': 'cup',
  'tablespoons': 'tbsp',
  'tablespoon': 'tbsp',
  'tbsp': 'tbsp',
  'tbs': 'tbsp',
  'T': 'tbsp',
  'teaspoons': 'tsp',
  'teaspoon': 'tsp',
  'tsp': 'tsp',
  't': 'tsp',
  'fluid ounces': 'fl oz',
  'fl oz': 'fl oz',
  'fl. oz': 'fl oz',
  'ounces': 'oz',
  'oz': 'oz',
  'pints': 'pint',
  'pint': 'pint',
  'pt': 'pint',
  'quarts': 'quart',
  'quart': 'quart',
  'qt': 'quart',
  'gallons': 'gallon',
  'gallon': 'gallon',
  'gal': 'gallon',
  'liters': 'L',
  'liter': 'L',
  'l': 'L',
  'L': 'L',
  'milliliters': 'mL',
  'milliliter': 'mL',
  'ml': 'mL',
  'mL': 'mL',
  
  // Weight units
  'pounds': 'lb',
  'pound': 'lb',
  'lbs': 'lb',
  'lb': 'lb',
  'grams': 'g',
  'gram': 'g',
  'g': 'g',
  'kilograms': 'kg',
  'kilogram': 'kg',
  'kg': 'kg',
  
  // Count/descriptive units that should be preserved
  'cloves': 'clove',
  'clove': 'clove',
  'heads': 'head',
  'head': 'head',
  'bunches': 'bunch',
  'bunch': 'bunch',
  'pieces': 'piece',
  'piece': 'piece',
  'slices': 'slice',
  'slice': 'slice',
  'stalks': 'stalk',
  'stalk': 'stalk',
  'sprigs': 'sprig',
  'sprig': 'sprig',
  'leaves': 'leaf',
  'leaf': 'leaf',
  'cans': 'can',
  'can': 'can',
  'packages': 'package',
  'package': 'package',
  'pkg': 'package',
  'bottles': 'bottle',
  'bottle': 'bottle',
  'jars': 'jar',
  'jar': 'jar',
  'containers': 'container',
  'container': 'container',
};

// Descriptive "units" that should be treated as part of the name instead
const descriptiveUnits = new Set([
  'small', 'medium', 'large', 'extra large', 'jumbo',
  'thin', 'thick', 'fine', 'coarse', 'rough',
  'fresh', 'dried', 'frozen', 'canned', 'whole',
  'half', 'quarter', 'ripe', 'unripe', 'green', 'red'
]);

/**
 * Parses a raw ingredient string to extract amount, unit, and name components
 * Handles various numerical formats and common cooking units
 */
function parseIngredientString(ingredientString: string): {
  amount: string | null;
  unit: string | null;
  name: string;
  preparation: string | null;
} {
  const original = ingredientString.trim();
  
  // First, check for preparation notes (typically after a comma)
  const [mainPart, ...prepParts] = original.split(',');
  const preparation = prepParts.length > 0 ? prepParts.join(',').trim() : null;
  
  let remaining = mainPart.trim();
  
  // Regex patterns for different amount formats
  const amountPatterns = [
    // Mixed fractions: "1 1/2", "2 3/4"
    /^(\d+\s+\d+\/\d+)\s+/,
    // Simple fractions: "1/2", "3/4"
    /^(\d+\/\d+)\s+/,
    // Decimal numbers: "1.5", "0.25", "2.75"
    /^(\d*\.?\d+)\s+/,
    // Whole numbers: "1", "2", "10"
    /^(\d+)\s+/,
    // Range amounts: "1-2", "2 to 3"
    /^(\d+\s*[-–]\s*\d+|\d+\s+to\s+\d+)\s+/,
    // Approximate amounts: "about 1", "approximately 2"
    /^(about\s+\d+\.?\d*|approximately\s+\d+\.?\d*)\s+/i,
  ];
  
  let amount: string | null = null;
  
  // Try to match amount patterns
  for (const pattern of amountPatterns) {
    const match = remaining.match(pattern);
    if (match) {
      amount = match[1].trim();
      remaining = remaining.substring(match[0].length).trim();
      break;
    }
  }
  
  // If no amount found, try to match unit-only patterns (like "a pinch of")
  if (!amount) {
    const unitOnlyPatterns = [
      /^(a\s+pinch\s+of)\s+/i,
      /^(a\s+dash\s+of)\s+/i,
      /^(a\s+splash\s+of)\s+/i,
      /^(a\s+handful\s+of)\s+/i,
      /^(some)\s+/i,
    ];
    
    for (const pattern of unitOnlyPatterns) {
      const match = remaining.match(pattern);
      if (match) {
        amount = '1'; // Normalize to 1 for counting purposes
        remaining = remaining.substring(match[0].length).trim();
        break;
      }
    }
  }
  
  let unit: string | null = null;
  
  // Try to extract unit if we have an amount
  if (amount) {
    // Create a regex pattern for all known units (case-insensitive)
    const unitKeys = Object.keys(standardizedUnits);
    const unitPattern = new RegExp(`^(${unitKeys.join('|')})\\b`, 'i');
    
    const unitMatch = remaining.match(unitPattern);
    if (unitMatch) {
      const rawUnit = unitMatch[1].toLowerCase();
      unit = standardizedUnits[rawUnit] || rawUnit;
      remaining = remaining.substring(unitMatch[0].length).trim();
      
      // Check if this is a descriptive unit that should be part of the name
      if (descriptiveUnits.has(rawUnit)) {
        // Put the descriptive unit back into the name
        remaining = `${rawUnit} ${remaining}`.trim();
        unit = null;
      }
    }
  }
  
  // What's left is the ingredient name
  let name = remaining || original;
  
  // If we couldn't parse confidently (no amount and no clear unit), 
  // fall back to using the entire original string as the name
  if (!amount && !unit) {
    name = original;
    amount = null;
    unit = null;
  }
  
  // Clean up the name
  name = name.trim();
  
  // Handle edge cases where descriptive terms got parsed as units
  if (unit && descriptiveUnits.has(unit) && !name) {
    name = unit;
    unit = null;
  }
  
  return {
    amount,
    unit,
    name,
    preparation
  };
}

/**
 * Coerces an array of mixed ingredient types (string or StructuredIngredient objects)
 * into a standardized array of StructuredIngredient objects.
 *
 * - Converts string ingredients to StructuredIngredient format with intelligent parsing of amounts, units, and names
 * - Ensures object ingredients have essential fields (name, amount, unit, suggested_substitutions), defaulting to null if missing
 * - Filters out any null or undefined items from the input array before processing
 * - Returns an empty array if the input is null, undefined, or results in no valid structured ingredients
 */
export const coerceToStructuredIngredients = (
  ingredients: (StructuredIngredient | string | null | undefined)[] | null | undefined
): StructuredIngredient[] => {
  if (!ingredients || !Array.isArray(ingredients)) {
    return [];
  }

  const processedIngredients: StructuredIngredient[] = [];

  for (const ing of ingredients) {
    if (ing === null || ing === undefined) {
      continue; // Skip null or undefined entries in the array
    }

    if (typeof ing === 'string') {
      if (ing.trim()) { // Ensure string is not empty or just whitespace
        // Parse the ingredient string to extract components
        const parsed = parseIngredientString(ing.trim());
        
        processedIngredients.push({
          name: parsed.name,
          amount: parsed.amount,
          unit: parsed.unit,
          suggested_substitutions: null,
          preparation: parsed.preparation,
        });
      }
    } else if (typeof ing === 'object' && ing.name) { // Basic check for an object that could be an ingredient
      processedIngredients.push({
        name: ing.name,
        amount: ing.amount !== undefined ? ing.amount : null,
        unit: ing.unit !== undefined ? ing.unit : null,
        suggested_substitutions: Array.isArray(ing.suggested_substitutions) 
            ? ing.suggested_substitutions 
            : null, // Ensure it's an array or null
        preparation: ing.preparation !== undefined ? ing.preparation : null,
      });
    } else {
      // Log or handle cases where an object is not a valid ingredient structure if necessary
      console.warn('Skipping invalid ingredient item:', ing);
    }
  }

  return processedIngredients;
};

/**
 * Validates and processes ingredient groups to ensure they have the correct structure.
 * - Ensures each group has a name and ingredients array
 * - Processes ingredients within each group using coerceToStructuredIngredients
 * - Filters out empty groups
 */
export const coerceToIngredientGroups = (
  ingredientGroups: any[] | null | undefined
): IngredientGroup[] => {
  if (!ingredientGroups || !Array.isArray(ingredientGroups)) {
    return [];
  }

  const processedGroups: IngredientGroup[] = [];

  for (const group of ingredientGroups) {
    if (!group || typeof group !== 'object') {
      continue;
    }

    const groupName = group.name || 'Main';
    const groupIngredients = coerceToStructuredIngredients(group.ingredients);

    if (groupIngredients.length > 0) {
      processedGroups.push({
        name: groupName,
        ingredients: groupIngredients,
      });
    }
  }

  return processedGroups;
};

/**
 * Parses ingredient display names to handle removal and substitution text
 * This is the consolidated version that handles both "(removed)" and "(substituted for X)" patterns
 */
export function parseIngredientDisplayName(name: string): {
  baseName: string;
  isRemoved: boolean;
  substitutedFor?: string;
} {
  // Handle removed ingredients: "ingredient (removed)"
  const removedMatch = name.match(/^(.*?)\s*\(removed\)$/i);
  if (removedMatch) {
    return { baseName: removedMatch[1].trim(), isRemoved: true };
  }

  // Handle substituted ingredients: "new ingredient (substituted for original ingredient)"
  const substitutedMatch = name.match(/^(.*?)\s*\(substituted for (.+?)\)$/i);
  if (substitutedMatch) {
    return {
      baseName: substitutedMatch[1].trim(),
      isRemoved: false,
      substitutedFor: substitutedMatch[2].trim(),
    };
  }

  // No special formatting found, return the original name
  return { baseName: name.trim(), isRemoved: false };
}
