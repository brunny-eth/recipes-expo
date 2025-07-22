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
 * Parses an ingredient display name into its base name and any substitution text.
 */
export function parseIngredientDisplayName(name: string): { baseName: string; substitutionText: string | null } {
  console.log('[ingredientHelpers] 🔄 Parsing ingredient name:', name);
  
  // Handle null/undefined input
  if (!name) {
    console.log('[ingredientHelpers] ⚠️ Empty ingredient name');
    return { baseName: '', substitutionText: null };
  }

  // Split on substitution markers
  const substitutionMarkers = [' or ', ' (or ', ' / ', ' OR ', ' / ', '/'];
  let baseName = name;
  let substitutionText = null;

  for (const marker of substitutionMarkers) {
    if (name.includes(marker)) {
      const parts = name.split(marker);
      baseName = parts[0].trim();
      substitutionText = parts.slice(1).join(marker).trim();
      // Remove trailing parenthesis if present
      if (substitutionText.endsWith(')')) {
        substitutionText = substitutionText.slice(0, -1).trim();
      }
      console.log('[ingredientHelpers] 🔍 Found substitution:', {
        marker,
        baseName,
        substitutionText
      });
      break;
    }
  }

  // Clean up any remaining parenthetical notes
  const parenMatch = baseName.match(/^(.*?)\s*\(.*\)\s*$/);
  if (parenMatch) {
    baseName = parenMatch[1].trim();
    console.log('[ingredientHelpers] 🧹 Cleaned parenthetical:', baseName);
  }

  console.log('[ingredientHelpers] ✅ Parsed result:', {
    baseName,
    substitutionText
  });
  
  return { baseName, substitutionText };
}

/**
 * Parses a raw ingredient name to extract the canonical ingredient name
 * Handles disjunctive phrases, unit separation, and common patterns
 */
function parseCanonicalIngredientName(name: string): string {
  let workingName = name.toLowerCase().trim();
  
  // Handle disjunctive phrases: "tamari or soy sauce" -> prefer first option
  // Common patterns: "A or B", "A/B", "A, or B"
  const disjunctivePatterns = [
    /^([^,\/]+?)\s+or\s+.+$/i,           // "tamari or soy sauce"
    /^([^,\/]+?)\s*\/\s*.+$/i,           // "tamari/soy sauce"
    /^([^,\/]+?),\s*or\s+.+$/i,          // "tamari, or soy sauce"
  ];
  
  for (const pattern of disjunctivePatterns) {
    const match = workingName.match(pattern);
    if (match) {
      workingName = match[1].trim();
      break;
    }
  }
  
  // Handle complex ingredient lists with slashes: "fresh chopped herbs scallions/cilantro"
  // Extract the main ingredient type before the slash
  const complexSlashPattern = /^(.*?)\s+([^\/\s]+)\/([^\/\s]+)$/i;
  const complexMatch = workingName.match(complexSlashPattern);
  if (complexMatch) {
    const baseDescription = complexMatch[1].trim(); // "fresh chopped herbs"
    const option1 = complexMatch[2].trim(); // "scallions"
    const option2 = complexMatch[3].trim(); // "cilantro"
    
    // For herbs, prefer the base description without the specific options
    if (baseDescription.includes('herb')) {
      workingName = baseDescription;
    } else {
      // Otherwise, prefer the first option
      workingName = option1;
    }
  }
  
  // Handle unit-name confusion patterns
  // "9 cloves garlic" -> "garlic" (unit should be parsed elsewhere)
  // "garlic cloves" -> "garlic"
  // "chicken breasts" -> "chicken" (but keep "chicken breasts" as it's more specific)
  
  // Common unit words that should be removed from ingredient names
  const unitWords = [
    'cloves?', 'clove', 'pieces?', 'piece', 'slices?', 'slice',
    'strips?', 'strip', 'stalks?', 'stalk', 'sprigs?', 'sprig',
    'bunches?', 'bunch', 'heads?', 'head', 'ears?', 'ear'
  ];
  
  // Remove unit words when they appear at the end
  // "garlic cloves" -> "garlic", but keep "chicken breasts" as "chicken breasts"
  const unitPattern = new RegExp(`\\s+(${unitWords.join('|')})$`, 'i');
  const unitMatch = workingName.match(unitPattern);
  if (unitMatch) {
    // Special cases where we want to keep the unit as part of the name
    const keepUnitCases = [
      'chicken breast', 'chicken thigh', 'pork chop', 'beef roast',
      'lamb chop', 'fish fillet', 'turkey breast'
    ];
    
    const potentialName = workingName.replace(unitPattern, '').trim();
    const fullName = workingName;
    
    // Check if this is a case where we should keep the unit
    const shouldKeepUnit = keepUnitCases.some(keepCase => 
      fullName.includes(keepCase) || potentialName.length < 3
    );
    
    if (!shouldKeepUnit) {
      workingName = potentialName;
    }
  }
  
  // Remove common preparation words that don't affect aggregation
  const preparationWords = [
    'fresh', 'frozen', 'dried', 'canned', 'bottled',
    'chopped', 'diced', 'minced', 'sliced', 'grated',
    'whole', 'ground', 'crushed', 'organic', 'raw'
  ];
  
  // Only remove preparation words if they're at the beginning
  const prepPattern = new RegExp(`^(${preparationWords.join('|')})\\s+`, 'i');
  workingName = workingName.replace(prepPattern, '');
  
  // Handle specific common cases for better canonicalization
  const canonicalMappings: { [key: string]: string } = {
    // Garlic variations
    'garlic clove': 'garlic',
    'clove garlic': 'garlic',
    'cloves garlic': 'garlic',
    'garlic cloves': 'garlic',
    
    // Onion variations  
    'onion': 'onion',
    'onions': 'onion',
    'yellow onion': 'onion',
    'white onion': 'onion',
    
    // Common ingredient standardizations
    'scallion': 'green onion',
    'scallions': 'green onion',
    'spring onion': 'green onion',
    'spring onions': 'green onion',
    
    // Herb standardizations
    'cilantro': 'cilantro',
    'fresh cilantro': 'cilantro',
    'coriander leaves': 'cilantro',
  };
  
  // Apply canonical mappings
  if (canonicalMappings[workingName]) {
    workingName = canonicalMappings[workingName];
  }
  
  // Final cleanup
  workingName = workingName.trim();
  
  // Ensure we don't return an empty string
  if (!workingName) {
    return name.trim(); // Fallback to original
  }
  
  return workingName;
}
