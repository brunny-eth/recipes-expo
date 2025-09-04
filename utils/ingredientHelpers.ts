import { StructuredIngredient, IngredientGroup } from '../common/types/recipes';
import { parseAmountString } from './recipeUtils';
import { availableUnits, Unit } from './units';
import { detectInputType } from '../server/utils/detectInputType';

// === COMPREHENSIVE UNIT SYSTEM ===

/**
 * Comprehensive unit mapping aligned with units.ts system
 * Maps all common variations to their standardized internal form
 */
const UNIT_MAPPINGS: Record<string, string> = {
  // Volume units - aligned with units.ts
  'ml': 'ml', 'mL': 'ml', 'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
  'tsp': 'tsp', 't': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp', 
  'tbsp': 'tbsp', 'T': 'tbsp', 'tbs': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
  'fl oz': 'fl_oz', 'fl. oz': 'fl_oz', 'fl.oz': 'fl_oz', 'floz': 'fl_oz', 
  'fluid ounce': 'fl_oz', 'fluid ounces': 'fl_oz', 'fl ounce': 'fl_oz', 'fl ounces': 'fl_oz',
  'cup': 'cup', 'cups': 'cup', 'c': 'cup',
  'pint': 'pint', 'pints': 'pint', 'pt': 'pint', 'pts': 'pint',
  'quart': 'quart', 'quarts': 'quart', 'qt': 'quart', 'qts': 'quart',
  'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon', 'gals': 'gallon',
  'liter': 'liter', 'liters': 'liter', 'l': 'liter', 'L': 'liter', 'litre': 'liter', 'litres': 'liter',

  // Count-based units - all mapped to 'each' for aggregation consistency
  'each': 'each', 'piece': 'each', 'pieces': 'each', 'item': 'each', 'items': 'each',
  'clove': 'each', 'cloves': 'each', 'bulb': 'each', 'bulbs': 'each',
  'head': 'each', 'heads': 'each', 'ear': 'each', 'ears': 'each',
  'bunch': 'each', 'bunches': 'each', 'bundle': 'each', 'bundles': 'each',
  'stalk': 'each', 'stalks': 'each', 'stem': 'each', 'stems': 'each',
  'sprig': 'each', 'sprigs': 'each', 'branch': 'each', 'branches': 'each',
  'leaf': 'each', 'leaves': 'each', 'sheet': 'each', 'sheets': 'each',
  'slice': 'slices', 'slices': 'slices', 'strip': 'each', 'strips': 'each',
  'wedge': 'each', 'wedges': 'each', 'segment': 'each', 'segments': 'each',

  // Container units - mapped to 'each' but preserve original for display
  'can': 'each', 'cans': 'each', 'tin': 'each', 'tins': 'each',
  'jar': 'each', 'jars': 'each', 'bottle': 'each', 'bottles': 'each',
  'package': 'each', 'packages': 'each', 'pkg': 'each', 'pkgs': 'each',
  'box': 'each', 'boxes': 'each', 'carton': 'each', 'cartons': 'each',
  'bag': 'each', 'bags': 'each', 'pouch': 'each', 'pouches': 'each',
  'container': 'each', 'containers': 'each', 'tub': 'each', 'tubs': 'each',

  // Special measurement units
  'pinch': 'each', 'pinches': 'each', 'dash': 'each', 'dashes': 'each',
  'splash': 'each', 'splashes': 'each', 'handful': 'each', 'handfuls': 'each',
  'large handful': 'each', 'large handfuls': 'each', 'small handful': 'each', 'small handfuls': 'each',
  'drop': 'each', 'drops': 'each', 'squeeze': 'each', 'squeezes': 'each',

  // Weight units (note: not convertible with volume in units.ts)
  'g': 'g', 'gram': 'g', 'grams': 'g', 'gr': 'g',
  'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg', 'kilo': 'kg', 'kilos': 'kg',
  'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz', // Weight ounces (distinct from fl_oz)
  'lb': 'lb', 'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb', '#': 'lb',

  // Compound units (preserve full form for clarity) - patterns for sizes + containers
  'oz can': 'oz can', 'ounce can': 'ounce can', 'oz jar': 'oz jar', 'ounce jar': 'ounce jar',
  'oz package': 'oz package', 'ounce package': 'ounce package', 'oz bag': 'oz bag', 'ounce bag': 'ounce bag',
  'lb bag': 'lb bag', 'pound bag': 'pound bag', 'lb box': 'lb box', 'pound box': 'pound box',
  'fl oz bottle': 'fl oz bottle', 'fl oz can': 'fl oz can', 'fl oz jar': 'fl oz jar',
  
  // Dynamic compound unit patterns (handled specially in parsing)
  // These are matched by regex: /\d+(?:\.\d+)?\s+(?:oz|fl\s*oz|lb|g|kg)\s+(?:can|jar|bottle|bag|box|package|container)/
};

/**
 * Unit display names for user-friendly output
 * Maps internal units to their preferred display forms
 */
const UNIT_DISPLAY_NAMES: Record<string, { singular: string, plural: string }> = {
  // Volume units
  'ml': { singular: 'ml', plural: 'ml' },
  'tsp': { singular: 'tsp', plural: 'tsp' },
  'tbsp': { singular: 'tbsp', plural: 'tbsp' },
  'fl_oz': { singular: 'fl oz', plural: 'fl oz' },
  'cup': { singular: 'cup', plural: 'cups' },
  'pint': { singular: 'pint', plural: 'pints' },
  'quart': { singular: 'quart', plural: 'quarts' },
  'gallon': { singular: 'gallon', plural: 'gallons' },
  'liter': { singular: 'liter', plural: 'liters' },
  
  // Count and weight units
  'each': { singular: '', plural: '' }, // Empty for count units
  'slices': { singular: 'slice', plural: 'slices' }, // Preserve slice display
  'large handfuls': { singular: 'large handful', plural: 'large handfuls' },
  'small handfuls': { singular: 'small handful', plural: 'small handfuls' },
  'g': { singular: 'g', plural: 'g' },
  'kg': { singular: 'kg', plural: 'kg' },
  'oz': { singular: 'oz', plural: 'oz' },
  'lb': { singular: 'lb', plural: 'lb' },
  
  // Container units (preserve original for display)
  'oz can': { singular: 'oz can', plural: 'oz cans' },
  'ounce can': { singular: 'ounce can', plural: 'ounce cans' },
  'oz jar': { singular: 'oz jar', plural: 'oz jars' },
  'oz bag': { singular: 'oz bag', plural: 'oz bags' },
  'oz package': { singular: 'oz package', plural: 'oz packages' },
  'lb bag': { singular: 'lb bag', plural: 'lb bags' },
  'lb box': { singular: 'lb box', plural: 'lb boxes' },
  'fl oz bottle': { singular: 'fl oz bottle', plural: 'fl oz bottles' },
  'fl oz can': { singular: 'fl oz can', plural: 'fl oz cans' },
  'fl oz jar': { singular: 'fl oz jar', plural: 'fl oz jars' },
};

/**
 * Words that look like units but should be treated as descriptive adjectives
 * These get moved back into the ingredient name
 */
const DESCRIPTIVE_WORDS = new Set([
  'small', 'medium', 'large', 'extra large', 'jumbo', 'mini', 'baby',
  'thin', 'thick', 'fine', 'coarse', 'rough', 'smooth',
  'fresh', 'dried', 'frozen', 'canned', 'bottled', 'whole', 'ground',
  'half', 'quarter', 'ripe', 'unripe', 'green', 'red', 'yellow', 'white',
  'organic', 'free-range', 'grass-fed', 'wild', 'raw', 'cooked',
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
  'peeled', 'seeded', 'pitted', 'trimmed', 'cleaned',
  'hot', 'mild', 'sweet', 'sour', 'spicy', 'plain', 'salted', 'unsalted'
]);

/**
 * Common measurement prefixes that indicate approximate amounts
 */
const APPROXIMATION_PREFIXES = [
  'about', 'approximately', 'roughly', 'around', 'nearly', 'almost',
  'just over', 'just under', 'a little over', 'a little under',
  'up to', 'at least', 'or so', 'give or take'
];

/**
 * Normalized unit lookup - converts any unit variation to standardized form
 */
function normalizeUnit(rawUnit: string | null): string | null {
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 📏 normalizeUnit called with:', rawUnit);
  }
  
  if (!rawUnit) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 📏 normalizeUnit returning null - no input');
    }
    return null;
  }
  
  const cleaned = rawUnit.toLowerCase().trim();
  const normalized = UNIT_MAPPINGS[cleaned] || null;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 📏 normalizeUnit result:', { input: rawUnit, cleaned, normalized });
  }
  return normalized;
}

/**
 * Gets appropriate display name for a unit based on quantity
 */
function getDisplayUnit(unit: string | null, amount: number | null): string | null {
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 🎨 getDisplayUnit called with:', { unit, amount });
  }
  
  if (!unit) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🎨 getDisplayUnit returning null - no unit');
    }
    return null;
  }
  
  const displayInfo = UNIT_DISPLAY_NAMES[unit];
  if (!displayInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🎨 getDisplayUnit returning original unit - no display info');
    }
    return unit;
  }
  
  // Use plural for amounts != 1, or when amount is null/unknown
  const shouldUsePlural = amount === null || amount === 0 || amount > 1 || (amount > 0 && amount < 1);
  const result = shouldUsePlural ? displayInfo.plural : displayInfo.singular;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 🎨 getDisplayUnit result:', { 
      unit, 
      amount, 
      shouldUsePlural, 
      result 
    });
  }
  
  return result || unit;
}

/**
 * Advanced ingredient string parser with comprehensive unit recognition
 * and robust amount parsing using existing parseAmountString utility
 */
function parseIngredientString(ingredientString: string): {
  amount: string | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  displayUnit: string | null;
  parsedAmount: number | null;
} {
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 🔍 parseIngredientString called with:', ingredientString);
  }
  
  const original = ingredientString.trim();
  if (!original) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] ⚠️ Empty ingredient string');
    }
    return {
      amount: null,
      unit: null, 
      name: '',
      preparation: null,
      displayUnit: null,
      parsedAmount: null
    };
  }
  
  // Step 1: Extract preparation notes (after comma or in parentheses)
  let workingString = original;
  let preparation: string | null = null;
  
  // Handle comma-separated preparation
  const commaIndex = workingString.indexOf(',');
  if (commaIndex !== -1) {
    preparation = workingString.substring(commaIndex + 1).trim();
    workingString = workingString.substring(0, commaIndex).trim();
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 📝 Found comma-separated preparation:', preparation);
    }
  }
  
  // Handle parenthetical preparation (but not substitutions or units)
  const parenMatch = workingString.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch && !parenMatch[2].includes(' or ') && !parenMatch[2].includes('/')) {
    const parenContent = parenMatch[2].trim();
    
    // Check if parentheses contain unit information (like "2 cloves", "3 tbsp")
    const unitPattern = /^\d+(?:\s+\d+\/\d+)?\s+(cloves?|heads?|bunches?|pieces?|stalks?|sprigs?|cans?|bottles?|jars?|bags?|boxes?|packages?|containers?|tbsp|tbsps?|tsp|tsps?|cups?|ounces?|oz|pounds?|lb|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|pinches?|dashes?|drops?|splashes?|handfuls?|large\s+handfuls?|small\s+handfuls?|squeezes?)$/i;
    
    if (unitPattern.test(parenContent)) {
      // This is unit information, not preparation - leave it for unit extraction
      if (process.env.NODE_ENV === 'development') {
        console.log('[ingredientHelpers] 📏 Found parenthetical unit info, leaving for unit extraction:', parenContent);
      }
    } else {
      // This is preparation text
      if (!preparation) {
        preparation = parenContent;
      } else {
        preparation += ', ' + parenContent;
      }
      workingString = parenMatch[1].trim();
      if (process.env.NODE_ENV === 'development') {
        console.log('[ingredientHelpers] 📝 Found parenthetical preparation:', preparation);
      }
    }
  }
  
  // Step 2: Handle special non-numeric amount patterns first
  const specialAmountPatterns = [
    { pattern: /^(a\s+(?:pinch|dash|splash|handful|squeeze|drop)\s+of)\s+(.+)$/i, amount: '1' },
    { pattern: /^(some|several|few|many)\s+(.+)$/i, amount: null },
    { pattern: /^(to\s+taste)\s+(.+)$/i, amount: null },
    { pattern: /^(as\s+needed)\s+(.+)$/i, amount: null },
  ];
  
  let amount: string | null = null;
  let remainingText = workingString;
  
  for (const { pattern, amount: defaultAmount } of specialAmountPatterns) {
    const match = workingString.match(pattern);
    if (match) {
      amount = defaultAmount;
      remainingText = match[2].trim();
      if (process.env.NODE_ENV === 'development') {
        console.log('[ingredientHelpers] 🎯 Matched special amount pattern:', {
          pattern: pattern.source,
          amount,
          remaining: remainingText
        });
      }
      break;
    }
  }
  
  // Step 3: Extract numeric amounts if no special pattern matched
  if (amount === null) {
    // Enhanced amount extraction patterns with better approximation and range handling
    const amountExtractionPatterns = [
      // Approximation prefix with tilde: "~2", "~ 1.5"
      /^(~\s*\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s+/,
      // Complex approximations with amounts: "about 1 1/2", "roughly 2.5", "approximately 3"
      /^((?:about|approximately|roughly|around|nearly|almost)\s+\d+(?:\s+\d+\/\d+|\.\d+)?)\s+/i,
      // Ranges with various separators: "1-2", "2 to 3", "1–2" (en dash), "1—2" (em dash)
      /^(\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*\d+(?:\.\d+)?)\s+/i,
      // Compound measurements: "1 14.5 oz", "2 16 fl oz" (amount + size + unit)
      /^(\d+)\s+(\d+(?:\.\d+)?)\s+(oz|fl\s*oz|lb|g|kg)\s+/i,
      // Unicode fractions: "½", "1½", "2¾"
      /^(\d*[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s+/,
      // Mixed fractions: "1 1/2", "2 3/4", "1 2/16"
      /^(\d+\s+\d+\/\d+)\s+/,
      // Simple fractions: "1/2", "3/4", "15/16"
      /^(\d+\/\d+)\s+/,
      // Decimal numbers: "1.5", "0.25", "2.75"
      /^(\d*\.?\d+)\s+/,
      // Whole numbers: "1", "2", "10"
      /^(\d+)\s+/
    ];
    
    for (const pattern of amountExtractionPatterns) {
      const match = workingString.match(pattern);
      if (match) {
        // Handle compound measurements specially
        if (match[2] && match[3]) {
          // This is a compound measurement like "1 14.5 oz can"
          amount = match[1].trim(); // Just the count (1)
          // Reconstruct the remaining text with the size and unit preserved
          remainingText = `${match[2]} ${match[3]} ${workingString.substring(match[0].length)}`.trim();
          if (process.env.NODE_ENV === 'development') {
            console.log('[ingredientHelpers] 📦 Extracted compound measurement:', {
              count: amount,
              remaining: remainingText
            });
          }
        } else {
          amount = match[1].trim();
          remainingText = workingString.substring(match[0].length).trim();
          if (process.env.NODE_ENV === 'development') {
            console.log('[ingredientHelpers] 🔢 Extracted amount:', {
              pattern: pattern.source,
              amount,
              remaining: remainingText
            });
          }
        }
        break;
      }
    }
  }
  
  // Step 4: Extract unit from remaining text
  let unit: string | null = null;
  let finalName = remainingText;
  
  if (remainingText) {
    // Enhanced unit extraction with better fluid ounce and compound unit handling
    const enhancedUnitPatterns = [
      // Fluid ounces with various formats: "fluid ounces", "fl oz", "fl. oz"
      /^(fluid\s+ounces?|fl\s*\.?\s*oz|fl\s+ounces?)\b/i,
      // Compound units with sizes: "14.5 oz can", "16 fl oz bottle"
      /^(\d+(?:\.\d+)?\s+(?:oz|fl\s*oz|lb|g|kg)\s+(?:can|jar|bottle|bag|box|package|container))\b/i,
      // Weight ounces (not fluid): "ounces", "oz" when not preceded by "fl"
      /^(ounces?|oz)(?!\s+(?:can|jar|bottle|bag|box|package|container))\b/i,
      // Standard unit pattern for all other units
      null // Will be filled below
    ];
    
    // Add the comprehensive unit pattern as the last fallback
    const allUnitVariations = Object.keys(UNIT_MAPPINGS).sort((a, b) => b.length - a.length);
    enhancedUnitPatterns[3] = new RegExp(`^(${allUnitVariations.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
    
    for (const pattern of enhancedUnitPatterns) {
      if (!pattern) continue;
      
      const unitMatch = remainingText.match(pattern);
      if (unitMatch) {
        const rawUnit = unitMatch[1];
        
        // Special handling for compound units
        if (rawUnit.includes(' ') && /\d/.test(rawUnit)) {
          // This is a compound unit like "14.5 oz can"
          unit = normalizeUnit(rawUnit);
          if (!unit) {
            // If normalization failed, preserve the compound unit as-is
            unit = rawUnit.toLowerCase().replace(/\s+/g, ' ');
          }
        } else {
          // Standard unit normalization
          unit = normalizeUnit(rawUnit);
        }
        
        finalName = remainingText.substring(unitMatch[0].length).trim();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 📏 Extracted unit:', {
            rawUnit,
            normalizedUnit: unit,
            remaining: finalName
          });
        }
        
        // Check if this is actually a descriptive word that should stay with the name
        if (DESCRIPTIVE_WORDS.has(rawUnit.toLowerCase())) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[ingredientHelpers] 🔄 Unit is descriptive, moving back to name:', rawUnit);
          }
          finalName = `${rawUnit} ${finalName}`.trim();
          unit = null;
          continue; // Try next pattern
        }
        
        break; // Found a valid unit, stop looking
      }
    }
  }
  
  // Step 5: Handle compound units (e.g., "14.5 oz can")
  if (unit && finalName) {
    const compoundUnitPattern = /^(can|jar|bag|box|bottle|package|container|tub)\b/i;
    const compoundMatch = finalName.match(compoundUnitPattern);
    if (compoundMatch) {
      const containerType = compoundMatch[1].toLowerCase();
      const compoundUnit = `${unit} ${containerType}`;
      
      // Check if we have a mapping for this compound unit
      if (UNIT_MAPPINGS[compoundUnit]) {
        unit = compoundUnit;
        finalName = finalName.substring(compoundMatch[0].length).trim();
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 📦 Found compound unit:', compoundUnit);
        }
      }
    }
  }
  
  // Step 6: Parse the numeric amount for calculations
  let parsedAmount: number | null = null;
  if (amount) {
    parsedAmount = parseAmountString(amount);
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🧮 Parsed amount:', { amount, parsedAmount });
    }
  }
  
  // Step 7: Generate display unit
  const displayUnit = getDisplayUnit(unit, parsedAmount);
  
  // Step 8: Final cleanup and validation
  if (!finalName && !unit && !amount) {
    finalName = original; // Fallback to original if nothing was parsed
  }
  
  finalName = finalName.trim() || original;
  
  const result = {
    amount,
    unit,
    name: finalName,
    preparation,
    displayUnit,
    parsedAmount
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] ✅ parseIngredientString result:', result);
  }
  return result;
}

// === EXPORT UPDATED FUNCTIONS ===

/**
 * Coerces an array of mixed ingredient types (string or StructuredIngredient objects)
 * into a standardized array of StructuredIngredient objects.
 * Now uses enhanced parseIngredientString with better unit handling.
 */
export const coerceToStructuredIngredients = (
  ingredients: (StructuredIngredient | string | null | undefined)[] | null | undefined
): StructuredIngredient[] => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 🔄 coerceToStructuredIngredients called with:', ingredients?.length, 'items');
  }
  
  if (!ingredients || !Array.isArray(ingredients)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] ⚠️ Invalid ingredients input, returning empty array');
    }
    return [];
  }

  const processedIngredients: StructuredIngredient[] = [];

  for (const ing of ingredients) {
    if (ing === null || ing === undefined) {
      continue; // Skip null or undefined entries
    }

    if (typeof ing === 'string') {
      if (ing.trim()) { // Ensure string is not empty or just whitespace
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 📝 Processing string ingredient:', ing);
        }
        const parsed = parseIngredientString(ing.trim());
        
        processedIngredients.push({
          name: parsed.name,
          amount: parsed.amount,
          unit: parsed.unit,
          suggested_substitutions: null,
          preparation: parsed.preparation,
        });
      }
    } else if (typeof ing === 'object' && ing.name) { 
      if (process.env.NODE_ENV === 'development') {
        console.log('[ingredientHelpers] 📦 Processing object ingredient:', ing.name);
      }
      processedIngredients.push({
        name: ing.name,
        amount: ing.amount !== undefined ? ing.amount : null,
        unit: ing.unit !== undefined ? ing.unit : null,
        suggested_substitutions: Array.isArray(ing.suggested_substitutions) 
            ? ing.suggested_substitutions 
            : null, 
        preparation: ing.preparation !== undefined ? ing.preparation : null,
      });
    } else {
      console.warn('[ingredientHelpers] ⚠️ Skipping invalid ingredient item:', ing);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] ✅ coerceToStructuredIngredients processed:', processedIngredients.length, 'items');
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
 * Parses an ingredient display name for RECIPE DISPLAY purposes.
 * Detects removal and substitution markers without aggressive cleaning.
 */
export function parseRecipeDisplayName(name: string): { 
  baseName: string; 
  substitutionText: string | null;
  isRemoved?: boolean;
  substitutedFor?: string | null;
} {
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 🔄 Parsing RECIPE display name:', name);
  }
  
  // Handle null/undefined input
  if (!name) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] ⚠️ Empty ingredient name');
    }
    return { baseName: '', substitutionText: null };
  }

  // FIRST: Check for removal markers before any other processing
  let isRemoved = false;
  let originalName = name;
  
  // Check for "(removed)" parenthetical marker
  if (name.includes('(removed)')) {
    isRemoved = true;
    originalName = name.replace(/\s*\(removed\)\s*/i, '').trim();
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🗑️ Found removal marker:', {
        originalName: name,
        cleanedName: originalName,
        isRemoved
      });
    }
  }
  
  // Check for "removed:" prefix marker
  if (originalName.toLowerCase().includes('removed:')) {
    isRemoved = true;
    originalName = originalName.replace(/^removed:\s*/i, '').trim();
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🗑️ Found removal prefix:', {
        cleanedName: originalName,
        isRemoved
      });
    }
  }

  // Check for "(substituted for X)" pattern first
  const substitutedForMatch = originalName.match(/^(.*?)\s*\(substituted for (.+?)\)\s*$/i);
  let baseName = originalName;
  let substitutionText = null;
  
  if (substitutedForMatch) {
    baseName = substitutedForMatch[1].trim();
    substitutionText = substitutedForMatch[2].trim();
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🔄 Found "substituted for" pattern:', {
        originalName,
        baseName,
        substitutionText: substitutionText
      });
    }
  } else {
    // Split on other substitution markers
    const substitutionMarkers = [' or ', ' (or ', ' / ', ' OR '];

    for (const marker of substitutionMarkers) {
      if (originalName.includes(marker)) {
        const parts = originalName.split(marker);
        const firstPart = parts[0].trim();
        const secondPart = parts.slice(1).join(marker).trim();
        
        // Special case: If first part is just "champagne" and second part contains "vinegar",
        // treat this as a compound ingredient name, not a substitution
        if (firstPart.toLowerCase() === 'champagne' && secondPart.toLowerCase().includes('vinegar')) {
          baseName = originalName; // Keep the full name as-is
          substitutionText = null;
          if (process.env.NODE_ENV === 'development') {
            console.log('[ingredientHelpers] 🍾 Preserving compound vinegar name in recipe:', originalName);
          }
          break;
        }
        
        baseName = firstPart;
        substitutionText = secondPart;
        // Remove trailing parenthesis if present
        if (substitutionText.endsWith(')')) {
          substitutionText = substitutionText.slice(0, -1).trim();
        }
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 🔍 Found substitution marker:', {
            marker,
            baseName,
            substitutionText
          });
        }
        break;
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] ✅ RECIPE parsed result:', {
      baseName,
      substitutionText,
      isRemoved
    });
  }
  
  // Check if this is a substituted ingredient
  const substitutedFor = substitutionText;

  return { 
    baseName, 
    substitutionText,
    isRemoved,
    substitutedFor
  };
}

/**
 * Parses an ingredient display name for GROCERY LIST purposes.
 * Aggressively cleans and normalizes ingredient names.
 */
export function parseIngredientDisplayName(name: string): {
  baseName: string;
  substitutionText: string | null;
  isRemoved?: boolean;
  substitutedFor?: string | null;
} {
  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] 🔄 Parsing GROCERY ingredient name:', name);
  }

  // Fix for egg pluralization issue - return egg names unchanged
  if (name.toLowerCase().includes('egg')) {
    return {
      baseName: name,
      substitutionText: null,
      isRemoved: false,
      substitutedFor: null
    };
  }
  
  // Handle null/undefined input
  if (!name) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] ⚠️ Empty ingredient name');
    }
    return { baseName: '', substitutionText: null };
  }

  // Split on substitution markers, but be smarter about compound ingredient names
  const substitutionMarkers = [' or ', ' (or ', ' / ', ' OR '];
  let baseName = name;
  let substitutionText = null;

  for (const marker of substitutionMarkers) {
    if (name.includes(marker)) {
      const parts = name.split(marker);
      const firstPart = parts[0].trim();
      const secondPart = parts.slice(1).join(marker).trim();

      // Special case: Handle "fresh or frozen" and similar patterns
      // These are not substitutions but describe equally valid forms of the same ingredient
      const freshFrozenPatterns = [
        { first: 'fresh', second: 'frozen' },
        { first: 'frozen', second: 'fresh' },
        { first: 'dried', second: 'fresh' },
        { first: 'fresh', second: 'dried' },
        { first: 'canned', second: 'fresh' },
        { first: 'fresh', second: 'canned' }
      ];

      for (const pattern of freshFrozenPatterns) {
        if (firstPart.toLowerCase() === pattern.first && secondPart.toLowerCase().startsWith(pattern.second)) {
          baseName = name; // Keep the full name as-is
          substitutionText = null;
          console.log('[ingredientHelpers] 🥬 DEBUG: Preserving compound ingredient name:', {
            originalName: name,
            firstPart,
            secondPart,
            pattern,
            result: baseName
          });
          break;
        }
      }

      // If we found a preserved pattern, break out of the marker loop
      if (baseName === name && substitutionText === null) {
        break;
      }

      // Special case: If first part is just "champagne" and second part contains "vinegar",
      // treat this as a compound ingredient name, not a substitution
      if (firstPart.toLowerCase() === 'champagne' && secondPart.toLowerCase().includes('vinegar')) {
        baseName = name; // Keep the full name as-is
        substitutionText = null;
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 🍾 Preserving compound vinegar name:', name);
        }
        break;
      }

      // Special case: If both parts contain "paprika", treat this as a compound ingredient name
      if (firstPart.toLowerCase().includes('paprika') || secondPart.toLowerCase().includes('paprika')) {
        baseName = name; // Keep the full name as-is
        substitutionText = null;
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 🌶️ Preserving compound paprika name:', name);
        }
        break;
      }

      // Special case: If the ingredient contains "half & half", treat this as a compound ingredient name
      if (name.toLowerCase().includes('half & half') || name.toLowerCase().includes('half and half')) {
        baseName = name; // Keep the full name as-is
        substitutionText = null;
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 🥛 Preserving compound half & half name:', name);
        }
        break;
      }

      baseName = firstPart;
      substitutionText = secondPart;
      // Remove trailing parenthesis if present
      if (substitutionText.endsWith(')')) {
        substitutionText = substitutionText.slice(0, -1).trim();
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[ingredientHelpers] 🔍 Found substitution:', {
          marker,
          baseName,
          substitutionText
        });
      }
      break;
    }
  }

  // Clean up any parenthetical notes (for grocery normalization)
  const parenMatch = baseName.match(/^(.*?)\s*\(.*\)\s*$/);
  if (parenMatch) {
    baseName = parenMatch[1].trim();
    if (process.env.NODE_ENV === 'development') {
      console.log('[ingredientHelpers] 🧹 Cleaned parenthetical for grocery:', baseName);
    }
  }
  
  // Preserve important combinations that should not be modified
  // This is a simplified version of the PRESERVED_COMBINATIONS logic
  const preservedCombinations = [
    'golden potatoes', 'red potatoes', 'small potatoes', 'baby potatoes', 'fingerling potatoes',
    'russet potatoes', 'yukon gold potatoes', 'sweet potatoes', 'purple potatoes', 'white potatoes',
    'all purpose flour', 'all-purpose flour', 'unbleached all purpose flour', 'unbleached all-purpose flour'
  ];
  
  const lowerBaseName = baseName.toLowerCase();
  for (const combination of preservedCombinations) {
    if (lowerBaseName.includes(combination)) {
      // Keep the original case from the input
      const originalCase = baseName.match(new RegExp(combination, 'i'))?.[0];
      if (originalCase) {
        baseName = originalCase;
        if (process.env.NODE_ENV === 'development') {
          console.log('[ingredientHelpers] 🛡️ Preserved combination:', combination);
        }
        break;
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[ingredientHelpers] ✅ GROCERY parsed result:', {
      baseName,
      substitutionText
    });
  }
  
  // For grocery context, we don't need removal/substitution detection
  const substitutedFor = substitutionText;

  return { 
    baseName, 
    substitutionText,
    isRemoved: false, // Grocery context doesn't care about removals
    substitutedFor
  };
}

// Removed parseCanonicalIngredientName function - functionality moved to
// normalizeName in groceryHelpers.ts for better consistency

/**
 * Checks if a dish name is descriptive enough to generate a good recipe
 * Returns true if the name is descriptive enough, false if it's too vague
 */
export function isDescriptiveDishName(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;

  // Convert to lowercase for easier matching
  const lowerInput = trimmed.toLowerCase();

  // Too short - single words are usually too vague
  const words = lowerInput.split(/\s+/);
  if (words.length < 2) {
    return false;
  }

  // Check for descriptive words that indicate specificity
  const descriptiveIndicators = [
    // Cooking methods
    'baked', 'fried', 'grilled', 'roasted', 'stewed', 'braised', 'steamed',
    'sauteed', 'pan-fried', 'deep-fried', 'air-fried', 'slow-cooked',
    // Ingredients
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'turkey', 'lamb',
    'tofu', 'lentil', 'bean', 'cheese', 'cream', 'garlic', 'onion', 'tomato',
    'spinach', 'broccoli', 'carrot', 'potato', 'rice', 'pasta', 'noodle',
    'vegetable', 'fruit', 'chocolate', 'vanilla', 'cinnamon', 'herb',
    // Styles/cuisines
    'italian', 'mexican', 'chinese', 'thai', 'indian', 'french', 'spanish',
    'greek', 'japanese', 'korean', 'vietnamese', 'mediterranean',
    // Dietary indicators
    'vegan', 'vegetarian', 'gluten-free', 'low-carb', 'keto', 'paleo',
    'dairy-free', 'nut-free', 'spicy', 'mild', 'sweet', 'savory',
    // Preparation styles
    'stuffed', 'crusted', 'marinated', 'seasoned', 'herbed', 'spiced',
    'creamy', 'tangy', 'crispy', 'tender', 'juicy', 'fluffy'
  ];

  // Check if any descriptive words are present
  const hasDescriptiveWord = descriptiveIndicators.some(indicator =>
    lowerInput.includes(indicator)
  );

  // If it has descriptive words, it's likely specific enough
  if (hasDescriptiveWord) {
    return true;
  }

  // Check for numbers (like "3-ingredient", "5-minute")
  if (/\d+/.test(lowerInput)) {
    return true;
  }

  // Check for common vague food categories that need more specificity
  const vagueCategories = [
    'soup', 'salad', 'sandwich', 'pizza', 'pasta', 'curry', 'stew',
    'casserole', 'pie', 'cake', 'cookies', 'bread', 'muffin', 'pancakes',
    'waffles', 'omelette', 'frittata', 'quiche', 'lasagna', 'tacos',
    'burritos', 'quesadilla', 'nachos', 'guacamole', 'salsa', 'hummus',
    'pesto', 'sauce', 'dressing', 'dip', 'spread', 'jam', 'jelly'
  ];

  // If it's a vague category without descriptive words, it's too vague
  const isVagueCategory = vagueCategories.some(category =>
    lowerInput.includes(category) && words.length <= 2
  );

  if (isVagueCategory) {
    return false;
  }

  // Default to requiring at least 3 words for most dish names
  return words.length >= 3;
}
