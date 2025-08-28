import { CombinedParsedRecipe, StructuredIngredient } from '../common/types';
import { parseIngredientDisplayName } from './ingredientHelpers';
import { parseAmountString } from './recipeUtils';
import { formatMeasurement } from './format';
import { convertUnits, availableUnits, Unit, getUnitDisplayName } from './units';

/**
 * Converts decimal amounts to readable fractions for grocery list display
 */
export function formatAmountForGroceryDisplay(amount: number | null): string | null {
  if (amount === null || amount === 0) {
    return null;
  }

  // Use the existing formatMeasurement function which already handles fractions properly
  const result = formatMeasurement(amount);
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
  preparation: string | null;  // Preparation method (e.g., "grated", "chopped", "diced")
}

// === INGREDIENT NORMALIZATION DATA ===

/**
 * Map of ingredient aliases to their canonical forms
 * This helps consolidate ingredients that are essentially the same but named differently
 */
const INGREDIENT_ALIASES: Record<string, string> = {
  // Onion variations
  'green onions': 'scallions',
  'spring onions': 'scallions', 
  'green onion': 'scallions',
  'spring onion': 'scallions',
  
  // Garlic variations
  'garlic clove': 'garlic',
  'clove garlic': 'garlic',
  'garlic cloves': 'garlic',
  'cloves garlic': 'garlic',
  'clove of garlic': 'garlic',
  'cloves of garlic': 'garlic',
  
  // Egg variations
  'egg': 'eggs',
  'chicken egg': 'eggs',
  'chicken eggs': 'eggs',
  
  // Flour variations
  'flour': 'all purpose flour',
  'plain flour': 'all purpose flour',
  'white flour': 'all purpose flour',
  'all-purpose flour': 'all purpose flour', // Handle hyphenated version
  'all purpose flour': 'all purpose flour', // Keep canonical form
  
  // Tomato variations
  'roma tomato': 'tomato',
  'roma tomatoes': 'tomatoes',
  'cherry tomato': 'cherry tomatoes',
  'grape tomato': 'grape tomatoes',
  'plum tomato': 'plum tomatoes',
  
  // Pepper variations
  'bell peppers': 'bell pepper',
  'sweet pepper': 'bell pepper',
  'sweet peppers': 'bell pepper',
  'black pepper': 'black pepper',
  'freshly ground black pepper': 'black pepper',
  'ground black pepper': 'black pepper',
  'freshly ground pepper': 'black pepper', // Add this for generic "freshly ground pepper"
  'ground pepper': 'black pepper', // Add this for generic "ground pepper"
  'white pepper': 'white pepper',
  'freshly ground white pepper': 'white pepper',
  'ground white pepper': 'white pepper',
  
  // Herb variations
  'fresh herbs': 'herbs',
  'chopped herbs': 'herbs',
  'mixed herbs': 'herbs',
  
  // Common spelling corrections and variations
  'tomatoe': 'tomato',
  'tomatoes': 'tomatoes', // Keep this plural
  'tomatos': 'tomatoes', // Fix common misspelling
  'potatoe': 'potato',
  'potatoes': 'potatoes', // Keep this plural
  'potatos': 'potatoes', // Fix common misspelling
  
  // Cheese variations
  'shredded cheese': 'cheese',
  'grated cheese': 'cheese',
  'sliced cheese': 'cheese',
  
  // Oil variations
  'cooking oil': 'oil',
  'vegetable cooking oil': 'vegetable oil',
  'extra virgin olive oil': 'olive oil',
  'evoo': 'olive oil',
  
  // Common ingredient variations and cleanup
  'diced tomatoes': 'tomatoes', // Preserve plural for canned tomatoes
  'crushed tomatoes': 'tomatoes',
  'whole tomatoes': 'tomatoes',
  'cherry tomatoes': 'cherry tomatoes', // Keep specific type
  'grape tomatoes': 'grape tomatoes', // Keep specific type
  
  // Meat variations
  'chicken breast': 'chicken breast',
  'chicken breasts': 'chicken breast', // Singularize for consistency
  'ground chicken': 'ground chicken',
  'ground turkey': 'ground turkey',
  'ground pork': 'ground pork',
  'ground lamb': 'ground lamb',
  
  // Salt variations - normalize all to base "salt"
  'kosher salt': 'salt',
  'sea salt': 'salt', 
  'fine salt': 'salt',
  'coarse salt': 'salt',
  'table salt': 'salt',
  'iodized salt': 'salt',
  'himalayan salt': 'salt',
  'pink salt': 'salt',
  'rock salt': 'salt',
  'celtic salt': 'salt',
  'flaky salt': 'salt',

  // Mustard variations - normalize grainy types to "grainy mustard"
  'grain mustard': 'grainy mustard',
  'grainy dijon mustard': 'grainy mustard',
  'whole grain mustard': 'grainy mustard',
  'whole grain dijon mustard': 'grainy mustard',
  // Keep specific mustard types separate
  'dijon mustard': 'dijon mustard',
  'yellow mustard': 'yellow mustard', 
  'brown mustard': 'brown mustard',

  // Vinegar variations - normalize to base types
  'champagne vinegar': 'champagne vinegar',
  'apple cider vinegar': 'apple cider vinegar',
  'red wine vinegar': 'red wine vinegar',
  'white wine vinegar': 'white wine vinegar',
  'balsamic vinegar': 'balsamic vinegar',
  'rice vinegar': 'rice vinegar',

  // Unit-based cleanup (remove unit words from ingredient names)
  'fluid ounces': '', // Remove when it appears in ingredient name
  'ounces': '', // Remove when it appears in ingredient name
};

/**
 * Adjective-noun combinations that should be preserved as they represent distinct ingredients
 */
const PRESERVED_COMBINATIONS = new Set([
  'ground beef', 'ground pork', 'ground chicken', 'ground turkey', 'ground lamb',
  'shredded cheese', 'grated cheese', 'sliced cheese',
  'smoked salmon', 'smoked paprika', 'smoked salt', 'smoked bacon',
  'roasted red peppers', 'roasted tomatoes', 'roasted garlic',
  'sun dried tomatoes', 'sun dried',
  'toasted nuts', 'toasted seeds', 'toasted bread',
  'aged cheddar', 'aged cheese',
  'whole wheat flour', 'whole wheat',
  'all purpose flour', 'all purpose',
  'active dry yeast', 'active dry',
  'brown sugar', 'white sugar', 'powdered sugar', 'confectioners sugar',
  'hot paprika', 'sweet paprika',
  'heavy cream', 'light cream', 'sour cream', 'whipped cream',
  'cottage cheese', 'cream cheese', 'goat cheese', 'blue cheese',
  'green beans', 'black beans', 'kidney beans', 'navy beans',
  'bell pepper', 'hot pepper', 'chili pepper',
  'olive oil', 'vegetable oil', 'canola oil', 'sesame oil', 'coconut oil',
  'red wine vinegar', 'white wine vinegar', 'apple cider vinegar', 'balsamic vinegar',
  'soy sauce', 'hot sauce', 'barbecue sauce', 'tomato sauce',
  'chicken broth', 'beef broth', 'vegetable broth',
  'greek yogurt', 'plain yogurt',
  'golden potatoes', 'red potatoes', 'small potatoes', 'baby potatoes', 'fingerling potatoes',
  'russet potatoes', 'yukon gold potatoes', 'sweet potatoes', 'purple potatoes', 'white potatoes',
  'fresh or frozen', 'frozen or fresh', 'fresh or dried', 'dried or fresh',
  'fresh or canned', 'canned or fresh'
]);

/**
 * Adjectives that should typically be removed unless part of a preserved combination
 */
const REMOVABLE_ADJECTIVES = new Set([
  'chopped', 'diced', 'minced', 'crushed', 'sliced', 'ground',
  'peeled', 'seeded', 'pitted', 'canned', 'frozen', 'defrosted',
  'cooked', 'raw', 'boiled', 'fried', 'baked', 'grilled', 'steamed', 'roasted',
  'large', 'medium', 'small', 'jumbo', 'extra', 'super', 'mini', 'baby',
  'ripe', 'unripe', 'organic', 'natural', 'wild', 'free-range', 'grass-fed',
  'whole', 'half', 'quarter', 'thick', 'thin', 'regular',
  'cubed', 'drained', 'flaked', 'melted', 'softened', 'room-temperature',
  'plain', 'clarified', 'boneless', 'skinless', 'shelled', 'hulled',
  'pureed', 'mashed', 'whipped', 'beaten', 'sifted', 'strained',
  'instant', 'pre-cooked', 'quick-cooking', 'self-rising',
  'reduced-sodium', 'low-sodium', 'unsalted', 'salted',
  'unsweetened', 'sweetened', 'sugar-free', 'fat-free', 'low-fat',
  'prepared', 'pre-made', 'ready-made',
  'pasteurized', 'unpasteurized', 'homogenized',
  'chilled', 'cold', 'warm', 'hot',
  'tender', 'firm', 'soft', 'hard', 'crisp', 'crunchy',
  'mild', 'medium', 'hot', 'spicy', 'sweet', 'sour', 'bitter',
  'light', 'dark', 'golden', 'pale',
  'imported', 'domestic', 'local', 'artisanal', 'homemade'
]);

/**
 * Words that should remain plural (exceptions to singularization)
 */
const PLURAL_EXCEPTIONS = new Set([
  'beans', 'peas', 'lentils', 'chickpeas', 'oats', 'grits', 'grains',
  'noodles', 'brussels sprouts', 'green beans', 'black beans', 'kidney beans',
  'sesame seeds', 'sunflower seeds', 'pumpkin seeds', 'pine nuts',
  'blueberries', 'strawberries', 'raspberries', 'blackberries', 'cranberries',
  'eggs', 'nuts', 'almonds', 'walnuts', 'pecans', 'cashews', 'peanuts',
  'tomatoes', 'potatoes', 'avocados', 'mangoes', 'onions', 'shallots',
  'cloves', 'spices', 'herbs', 'greens', 'sprouts', 'leftovers',
  'chives', 'olives'
]);

/**
 * Irregular plural to singular mappings
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  'children': 'child',
  'feet': 'foot',
  'geese': 'goose', 
  'men': 'man',
  'mice': 'mouse',
  'people': 'person',
  'teeth': 'tooth',
  'women': 'woman',
  'leaves': 'leaf',
  'loaves': 'loaf',
  'halves': 'half',
  'shelves': 'shelf',
  'knives': 'knife',
  'lives': 'life',
  'wives': 'wife',
  'calves': 'calf'
};

/**
 * Applies ingredient aliases to normalize common variations
 */
function applyIngredientAliases(name: string): string {
  const normalized = name.toLowerCase().trim();
  
  // Check for exact matches first
  if (INGREDIENT_ALIASES[normalized]) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] 🔄 Applied alias:', normalized, '→', INGREDIENT_ALIASES[normalized]);
    }
    return INGREDIENT_ALIASES[normalized];
  }
  
  // Check for partial matches (useful for compound ingredients)
  for (const [alias, canonical] of Object.entries(INGREDIENT_ALIASES)) {
    if (normalized.includes(alias)) {
      const result = normalized.replace(alias, canonical);
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🔄 Applied partial alias:', normalized, '→', result);
      }
      return result;
    }
  }
  
  return normalized;
}

/**
 * Removes non-essential adjectives while preserving important combinations
 */
function removeAdjectives(name: string): string {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ✂️ removeAdjectives called with:', name);
  }
  
  // Convert hyphens to spaces for consistent processing
  let processed = name.replace(/-/g, ' ');
  let words = processed.split(/\s+/).filter(Boolean);
  
  // Check if the entire phrase should be preserved
  const fullPhrase = words.join(' ');
  if (PRESERVED_COMBINATIONS.has(fullPhrase)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] 🛡️ Preserving entire phrase:', fullPhrase);
    }
    return fullPhrase;
  }
  
  // Look for preserved multi-word combinations
  for (let i = 0; i < words.length - 1; i++) {
    const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
    const threeWordPhrase = i < words.length - 2 ? `${words[i]} ${words[i + 1]} ${words[i + 2]}` : '';
    
    if (PRESERVED_COMBINATIONS.has(twoWordPhrase) || 
        (threeWordPhrase && PRESERVED_COMBINATIONS.has(threeWordPhrase))) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🛡️ Found preserved combination:', twoWordPhrase || threeWordPhrase);
      }
      // Don't remove adjectives from preserved combinations
      return fullPhrase;
    }
  }
  
  // Remove individual adjectives that aren't part of preserved combinations
  const filteredWords = words.filter(word => {
    if (!REMOVABLE_ADJECTIVES.has(word)) {
      return true; // Keep non-adjectives
    }
    
    // Check if this adjective is part of a preserved combination
    const wordIndex = words.indexOf(word);
    if (wordIndex !== -1 && wordIndex < words.length - 1) {
      const nextWord = words[wordIndex + 1];
      if (PRESERVED_COMBINATIONS.has(`${word} ${nextWord}`)) {
        return true; // Keep adjective that's part of preserved combination
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] ✂️ Removing adjective:', word);
    }
    return false; // Remove standalone adjective
  });
  
  const result = filteredWords.join(' ').trim();
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ✂️ removeAdjectives result:', name, '→', result);
  }
  return result || name; // Fallback to original if everything was removed
}

/**
 * Converts plural forms to singular while respecting exceptions
 */
function singularize(name: string): string {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 📝 singularize called with:', name);
  }
  
  const words = name.split(/\s+/);
  const lastWord = words[words.length - 1];
  
  // Check if the full phrase or last word should remain plural
  if (PLURAL_EXCEPTIONS.has(name) || PLURAL_EXCEPTIONS.has(lastWord)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] 🚫 Skipping singularization (exception):', name);
    }
    return name;
  }
  
  // Handle irregular plurals
  if (IRREGULAR_PLURALS[lastWord]) {
    words[words.length - 1] = IRREGULAR_PLURALS[lastWord];
    const result = words.join(' ');
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] 🔄 Applied irregular plural:', name, '→', result);
    }
    return result;
  }
  
  // Handle regular plurals ending in 's'
  if (lastWord.endsWith('s') && lastWord.length > 3) {
    // Special cases for words ending in specific patterns
    if (lastWord.endsWith('ies') && lastWord.length > 4) {
      // berries → berry, cherries → cherry
      const singular = lastWord.slice(0, -3) + 'y';
      words[words.length - 1] = singular;
    } else if (lastWord === 'preserves') {
      // preserves → preserve (regular plural, not irregular like leaves → leaf)
      const singular = lastWord.slice(0, -1);
      words[words.length - 1] = singular;
    } else if (lastWord.endsWith('ves')) {
      // leaves → leaf, shelves → shelf (true irregular plurals)
      const singular = lastWord.slice(0, -3) + 'f';
      words[words.length - 1] = singular;
    } else if (lastWord.endsWith('es') &&
               (lastWord.endsWith('ches') || lastWord.endsWith('shes') ||
                lastWord.endsWith('ses') || lastWord.endsWith('xes') || lastWord.endsWith('zes'))) {
      // matches → match, dishes → dish, boxes → box
      const singular = lastWord.slice(0, -2);
      words[words.length - 1] = singular;
    } else if (!lastWord.endsWith('ss') && !lastWord.endsWith('us')) {
      // Simple case: remove trailing 's' but avoid 'grass' → 'gras' or 'radius' → 'radiu'
      const singular = lastWord.slice(0, -1);
      if (singular.length >= 3) {
        words[words.length - 1] = singular;
      }
    }
  }
  
  const result = words.join(' ');
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 📝 singularize result:', name, '→', result);
  }
  return result;
}

/**
 * Handles special ingredient-specific normalizations
 */
function applySpecialCases(name: string): string {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🎯 applySpecialCases called with:', name);
  }
  
  // Handle fresh herb logic
  const commonHerbs = [
    'basil', 'cilantro', 'dill', 'mint', 'oregano', 'parsley', 'rosemary', 
    'sage', 'thyme', 'chives', 'tarragon', 'marjoram', 'bay leaves', 'chervil'
  ];
  
  const lowerName = name.toLowerCase();
  const isHerb = commonHerbs.some(herb => {
    // Use word boundaries to avoid partial matches
    const herbRegex = new RegExp(`\\b${herb}\\b`, 'i');
    return herbRegex.test(lowerName);
  });
  
  if (isHerb) {
    // If it explicitly says "fresh [herb]", keep it as "fresh [herb]"
    if (lowerName.startsWith('fresh ')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🌿 Keeping explicit fresh herb:', name);
      }
      return name;
    }
    
    // If it explicitly says "dried [herb]", keep it as "dried [herb]"
    if (lowerName.startsWith('dried ')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🌿 Keeping explicit dried herb:', name);
      }
      return name;
    }
    
    // If it's just "[herb]" without fresh/dried, assume it's fresh
    const herbName = commonHerbs.find(herb => {
      // Use word boundaries to avoid partial matches
      const herbRegex = new RegExp(`\\b${herb}\\b`, 'i');
      return herbRegex.test(lowerName);
    });
    if (herbName) {
      const freshHerbName = `fresh ${herbName}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🌿 Assuming fresh herb:', name, '→', freshHerbName);
      }
      return freshHerbName;
    }
  }
  
  // Handle complex herb patterns like "fresh chopped herbs scallions" → "scallions"
  if (name.includes('herbs') && (name.includes('scallion') || name.includes('cilantro') || name.includes('parsley'))) {
    if (name.includes('scallion')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🌿 HERB EXTRACTION: scallions');
      }
      return 'scallions';
    } else if (name.includes('cilantro')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🌿 HERB EXTRACTION: cilantro');
      }
      return 'cilantro';
    } else if (name.includes('parsley')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] 🌿 HERB EXTRACTION: parsley');
      }
      return 'parsley';
    }
  }
  
  // Handle size/unit patterns that should be cleaned up
  // "14.5 oz can" in ingredient name → "can" (size already captured in unit)
  name = name.replace(/\d+(?:\.\d+)?\s*(?:oz|lb|g|kg)\s+/gi, '');
  
  // Handle duplicated words caused by alias replacement
  // "scallions (scallions)" → "scallions"
  name = name.replace(/\b(\w+)\s*\(\1\)/gi, '$1');
  
  // Handle leftover punctuation artifacts
  name = name.replace(/\s*,\s*$/, ''); // Remove trailing commas
  name = name.replace(/^\s*,\s*/, ''); // Remove leading commas
  name = name.replace(/\s{2,}/g, ' '); // Collapse multiple spaces
  
  // Handle common parsing artifacts
  name = name.replace(/^-\d+\s+/, ''); // Remove range artifacts like "-2 "
  name = name.replace(/^~\d*\s+/, ''); // Remove tilde artifacts like "~2 "
  name = name.replace(/^about\s+\d+\/\d+\s+/, ''); // Remove "about 1/2 " artifacts
  
  // Clean up empty parentheses and extra spaces
  name = name.replace(/\s*\(\s*\)/g, '');
  name = name.trim();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🎯 applySpecialCases result:', name);
  }
  return name;
}

/**
 * Normalizes an ingredient name for consistent aggregation.
 * This is the main entry point for ingredient name normalization.
 */
export function normalizeName(name: string): string {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🔄 normalizeName called with:', name);
  }
  
  if (!name || typeof name !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] ⚠️ Invalid input to normalizeName:', name);
    }
    return '';
  }
  
  // Step 1: Basic cleanup and artifact removal
  let normalized = name.toLowerCase().trim();
  
  // Remove trailing punctuation and common artifacts
  normalized = normalized.replace(/[,;:.!?]+$/, '').trim(); // Remove trailing punctuation
  normalized = normalized.replace(/\s*\([^)]*\)$/, '').trim(); // Remove trailing parenthetical notes
  normalized = normalized.replace(/\s*,\s*$/, '').trim(); // Remove trailing commas with spaces
  
  // Step 2: Apply ingredient aliases (consolidate common variations)
  normalized = applyIngredientAliases(normalized);
  
  // Step 3: Remove non-essential adjectives while preserving important combinations
  normalized = removeAdjectives(normalized);
  
  // Step 4: Apply special ingredient-specific rules
  normalized = applySpecialCases(normalized);
  
  // Step 5: Singularize while respecting exceptions
  normalized = singularize(normalized);
  
  // Step 6: Final cleanup
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ✅ normalizeName final result:', name, '→', normalized);
    // Special logging for mustard items to verify grouping
    if (name.toLowerCase().includes('mustard')) {
      console.log('[groceryHelpers] 🧪 Mustard normalization:', name, '→', normalized);
    }
    // Special logging for vinegar items to verify grouping
    if (name.toLowerCase().includes('vinegar')) {
      console.log('[groceryHelpers] 🍾 Vinegar normalization:', name, '→', normalized);
    }
    // Special logging for herb items to verify fresh/dried logic
    if (name.toLowerCase().includes('basil') || name.toLowerCase().includes('cilantro') || 
        name.toLowerCase().includes('dill') || name.toLowerCase().includes('thyme') ||
        name.toLowerCase().includes('rosemary') || name.toLowerCase().includes('parsley')) {
      console.log('[groceryHelpers] 🌿 Herb normalization:', name, '→', normalized);
    }
  }
  return normalized || name; // Fallback to original if somehow empty
}

/**
 * A dictionary to normalize common units to the canonical short-form
 * required by the `units.ts` conversion utility.
 * null values indicate descriptive words that should be moved to the ingredient name
 */
const unitDictionary: { [key: string]: string | null } = {
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
  'each': 'each', 'count': 'each',
  // Size descriptors - these should be treated as descriptive, not units
  'small': null, 'medium': null, 'large': null, 'extra large': null,
  'small-size': null, 'medium-size': null, 'large-size': null,
  'small pinch': 'each', 'medium pinch': 'each', 'large pinch': 'each'
};

/**
 * Normalizes a unit to its canonical short-form.
 * Returns null if the unit is not found or is empty.
 */
function normalizeUnit(unit: string | null): string | null {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 📏 Normalizing unit:', unit);
  }
  if (!unit) return null;
  const lowerUnit = unit.toLowerCase().trim();
  const result = unitDictionary[lowerUnit] || null;
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 📏 Normalized unit result:', result);
  }
  return result;
}

/**
 * Parses a quantity string (e.g., "1 1/2", "0.5") into a number.
 * Returns null if parsing fails.
 */
function parseQuantity(amount: number | string | null): number | null {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🔢 Parsing quantity:', amount);
  }
  if (typeof amount === 'number') {
    return amount;
  }
  if (typeof amount === 'string' && amount.trim() !== '') {
    // Use parseAmountString to handle mixed numbers like "1 1/2", fractions, etc.
    const result = parseAmountString(amount.trim());
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] 🔢 Parsed quantity result:', result);
    }
    return result;
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
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] ✅ Units are compatible (both null)');
    }
    return true;
  }
  
  // Special case: each units and null are compatible for count-based aggregation
  if ((normalizedUnit1 === 'each' && normalizedUnit2 === null) || 
      (normalizedUnit1 === null && normalizedUnit2 === 'each')) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[groceryHelpers] ✅ Special case: each and null are compatible for count-based aggregation`);
    }
    return true;
  }
  
  // Special case: tablespoons and null are compatible for seeds/spices aggregation
  if ((normalizedUnit1 === 'tbsp' && normalizedUnit2 === null) || 
      (normalizedUnit1 === null && normalizedUnit2 === 'tbsp')) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[groceryHelpers] ✅ Special case: tbsp and null are compatible for seeds/spices`);
    }
    return true;
  }
  
  // Special case: teaspoons and null are compatible for seeds/spices aggregation
  if ((normalizedUnit1 === 'tsp' && normalizedUnit2 === null) || 
      (normalizedUnit1 === null && normalizedUnit2 === 'tsp')) {
    return true;
  }
  
  if (normalizedUnit1 === null || normalizedUnit2 === null) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[groceryHelpers] ❌ Units are not compatible (one is null): ${normalizedUnit1}, ${normalizedUnit2}`);
    }
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
    if (process.env.NODE_ENV === 'development') {
      console.log(`[groceryHelpers] ✅ Both units (${normalizedUnit1}, ${normalizedUnit2}) are convertible volume units`);
    }
    return true;
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[groceryHelpers] ❌ Units are not convertible: ${normalizedUnit1}, ${normalizedUnit2}`);
  }

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
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] ✅ Both are volume units - can convert:', {
        unit1: normalizedUnit1,
        unit2: normalizedUnit2,
        unit1_in_set: volumeUnits.has(normalizedUnit1),
        unit2_in_set: volumeUnits.has(normalizedUnit2),
        volume_units: Array.from(volumeUnits)
      });
    }
    return true;
  }

  // Check if both units are weight units - only compatible if they're identical
  if (weightUnits.has(normalizedUnit1) && weightUnits.has(normalizedUnit2)) {
    if (normalizedUnit1 === normalizedUnit2) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] ✅ Both are identical weight units');
      }
      return true;
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[groceryHelpers] ❌ Different weight units - no conversion available');
      }
      return false; // Different weight units cannot be converted
    }
  }
  
  if (countUnits.has(normalizedUnit1) && countUnits.has(normalizedUnit2)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[groceryHelpers] ✅ Both are count units');
    }
    return true; // Both are count units
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ❌ Units are not compatible');
  }
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
    // Special case: Don't normalize potato varieties - keep them separate
    const isPotatoVariant = item.item_name.toLowerCase().includes('potato') && 
      (item.item_name.toLowerCase().includes('small') || 
       item.item_name.toLowerCase().includes('red') || 
       item.item_name.toLowerCase().includes('golden') || 
       item.item_name.toLowerCase().includes('baby') || 
       item.item_name.toLowerCase().includes('fingerling') || 
       item.item_name.toLowerCase().includes('russet') || 
       item.item_name.toLowerCase().includes('yukon') || 
       item.item_name.toLowerCase().includes('sweet') || 
       item.item_name.toLowerCase().includes('purple') || 
       item.item_name.toLowerCase().includes('white'));
    
    // Special case: Don't normalize flour varieties - keep them separate
    const isFlourVariant = item.item_name.toLowerCase().includes('flour') && 
      (item.item_name.toLowerCase().includes('all purpose') || 
       item.item_name.toLowerCase().includes('all-purpose') || 
       item.item_name.toLowerCase().includes('unbleached') || 
       item.item_name.toLowerCase().includes('whole wheat') || 
       item.item_name.toLowerCase().includes('bread') || 
       item.item_name.toLowerCase().includes('cake') || 
       item.item_name.toLowerCase().includes('pastry'));
    
    const normalizedName = (isPotatoVariant || isFlourVariant) ? item.item_name : normalizeName(item.item_name);
    
    // Create a normalized copy of the item with normalized name as the display name
    const normalizedItem = {
      ...item,
      item_name: normalizedName // Use normalized name as the final display name
    };
    if (!groupedByName.has(normalizedName)) {
      groupedByName.set(normalizedName, []);
    }
    groupedByName.get(normalizedName)!.push(normalizedItem);
  }

  const finalAggregatedList: GroceryListItem[] = [];

  // Step 2: Iterate through each group and aggregate compatible units.
  for (const [name, itemList] of Array.from(groupedByName.entries())) {
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
            if (process.env.NODE_ENV === 'development') {
              console.log('[groceryHelpers] 🥄 Special volume/count aggregation for:', baseItem.item_name, {
                baseUnit,
                compareUnit
              });
            }
            canAggregate = true;
          }
        }
        
        if (canAggregate) {
          const baseAmount = parseQuantity(baseItem.quantity_amount);
          const compareAmount = parseQuantity(compareItem.quantity_amount);

          // Handle case where both amounts are null (as needed items)
          if (baseAmount === null && compareAmount === null) {
            // Combine items with null amounts - they're both "as needed"
            
            // Combine the original ingredient texts to show what recipes they came from
            const combinedText = baseItem.original_ingredient_text === compareItem.original_ingredient_text 
              ? baseItem.original_ingredient_text
              : `${baseItem.original_ingredient_text}; ${compareItem.original_ingredient_text}`;
            
            baseItem.original_ingredient_text = combinedText;
            processedIndices.add(j);
          }
          else if (baseAmount !== null && compareAmount !== null) {
            let convertedAmount = compareAmount;
            let finalUnit = baseItem.quantity_unit;
            let finalAmount = baseAmount;
            
            // Special case: Handle clove/null compatibility for garlic
            if ((baseItem.quantity_unit === 'cloves' && compareItem.quantity_unit === null) ||
                (baseItem.quantity_unit === null && compareItem.quantity_unit === 'cloves') ||
                (normalizeUnit(baseItem.quantity_unit) === 'clove' && compareItem.quantity_unit === null) ||
                (baseItem.quantity_unit === null && normalizeUnit(compareItem.quantity_unit) === 'clove') ||
                // Handle case where both are normalized to 'each' but originally were 'cloves'
                (normalizeUnit(baseItem.quantity_unit) === 'each' && normalizeUnit(compareItem.quantity_unit) === 'each' &&
                 (baseItem.display_unit === 'cloves' || compareItem.display_unit === 'cloves'))) {
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
                if (process.env.NODE_ENV === 'development') {
                  console.log('[groceryHelpers] 🥄 Creating combined volume/count entry for:', baseItem.item_name);
                }
                
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
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[groceryHelpers] 📊 Converting amounts:', {
                      base: { amount: baseAmount, unit: normalizedBaseUnit, inMl: baseInMl },
                      compare: { amount: compareAmount, unit: normalizedCompareUnit, inMl: compareInMl },
                      total: { inMl: totalInMl }
                    });
                  }
                  
                  // Try converting to each unit in order of preference
                  // Prefer tbsp/tsp over fl_oz for better readability
                  const preferredUnits: [Unit, number, number][] = [
                    ['cup', 0.25, 4],      // 1/4 cup to 4 cups
                    ['tbsp', 1, 16],       // 1 tbsp to 16 tbsp (preferred over fl_oz)
                    ['tsp', 1, 16],        // 1 tsp to 16 tsp (preferred over fl_oz)
                    ['fl_oz', 1, 16],      // 1 fl oz to 16 fl oz (fallback)
                    ['ml', 1, 1000]        // fallback to ml
                  ];
                  
                  let bestUnit: Unit = 'ml';
                  let bestAmount = totalInMl;
                  
                  for (const [unit, min, max] of preferredUnits) {
                    const amount = convertUnits(totalInMl, 'ml', unit);
                    if (amount !== null && amount >= min && amount <= max) {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('[groceryHelpers] 📊 Found suitable unit:', {
                          unit,
                          amount,
                          min,
                          max
                        });
                      }
                      bestUnit = unit;
                      bestAmount = amount;
                      break;
                    }
                  }
                  
                  finalUnit = bestUnit.toString();
                  finalAmount = bestAmount;
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[groceryHelpers] 📊 Final conversion:', {
                      totalInMl,
                      finalUnit,
                      finalAmount,
                      displayUnit: getUnitDisplayName(finalUnit as Unit, finalAmount),
                      originalUnits: `${baseAmount} ${normalizedBaseUnit} + ${compareAmount} ${normalizedCompareUnit}`
                    });
                  }
                } else {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('[groceryHelpers] ⚠️ Unit conversion failed:', {
                      baseUnit: normalizedBaseUnit,
                      compareUnit: normalizedCompareUnit,
                      baseAmount,
                      compareAmount
                    });
                  }
                  // No fallback - if conversion fails, don't aggregate
                  continue;
                }
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('[groceryHelpers] ⚠️ Unit normalization failed:', {
                    baseUnit: baseItem.quantity_unit,
                    compareUnit: compareItem.quantity_unit
                  });
                }
                // No fallback - if normalization fails, don't aggregate
                continue;
              }
            } else {
              finalAmount = baseAmount + compareAmount;
            }
            
            baseItem.quantity_amount = finalAmount;
            baseItem.quantity_unit = finalUnit;
            
            // Preserve display unit for specific cases where we want to keep the original unit name
            if (baseItem.item_name.toLowerCase().includes('garlic') && 
                (baseItem.display_unit === 'cloves' || compareItem.display_unit === 'cloves')) {
              // Keep "cloves" as display unit for garlic
              baseItem.display_unit = 'cloves';
            } else {
              // Always use standardized display unit based on final amount
              baseItem.display_unit = getUnitDisplayName(finalUnit as Unit, finalAmount);
            }
            
            baseItem.original_ingredient_text += ` | ${compareItem.original_ingredient_text}`;
            processedIndices.add(j);
          }
        }
      }
      aggregatedItemsForGroup.push(baseItem);
    }
    finalAggregatedList.push(...aggregatedItemsForGroup);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ✅ Aggregation complete:', {
      input_items: items.length,
      output_items: finalAggregatedList.length,
      items_combined: items.length - finalAggregatedList.length
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🚨 FINAL AGGREGATION RESULT:', {
      input_count: items.length,
      output_count: finalAggregatedList.length,
      garlic_items: finalAggregatedList.filter(item => item.item_name.toLowerCase().includes('garlic')),
      sesame_items: finalAggregatedList.filter(item => item.item_name.toLowerCase().includes('sesame'))
    });
  }

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
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🛒 Starting grocery list formatting for recipe:', recipe.title);
  }
  const groceryItems: GroceryListItem[] = [];
  let orderIndex = 0;

  // Process each ingredient group from the final recipe
  if (recipe.ingredientGroups) {
    for (const group of recipe.ingredientGroups) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[groceryHelpers] 📦 Processing ingredient group: "${group.name}"`);
      }
      
      for (const ingredient of group.ingredients) {
        const originalText = `${ingredient.amount || ''} ${ingredient.unit || ''} ${ingredient.name}`.trim();
        console.log('[groceryHelpers] 🔍 DEBUG: Processing ingredient for grocery list:', {
          originalName: ingredient.name,
          originalText,
          amount: ingredient.amount,
          unit: ingredient.unit
        });
        const parsedName = parseIngredientDisplayName(ingredient.name);
        console.log('[groceryHelpers] 🔍 DEBUG: Parsed ingredient name:', {
          originalName: ingredient.name,
          parsedBaseName: parsedName.baseName,
          parsedSubstitutionText: parsedName.substitutionText,
          result: parsedName
        });

        // Handle amount - it might be a number, string, or null (parse first)
        let amount: number | null = null;
        if (ingredient.amount !== null && ingredient.amount !== undefined) {
          if (typeof ingredient.amount === 'number') {
            // Amount is already a number (e.g., 6)
            amount = ingredient.amount;
            if (process.env.NODE_ENV === 'development') {
              console.log('[groceryHelpers] 🔢 Using numeric amount directly:', amount);
            }
          } else if (typeof ingredient.amount === 'string') {
            // Amount is a string (e.g., "6-8" or "1 1/2")
            amount = parseAmountString(ingredient.amount);
            if (process.env.NODE_ENV === 'development') {
              console.log('[groceryHelpers] 🔢 Parsed string amount:', ingredient.amount, '→', amount);
            }
          }
        }
        
        // If still no amount, try to parse from the original text as fallback
        if (amount === null) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[groceryHelpers] 🔄 Amount is null, trying to parse from original text:', originalText);
          }
          amount = parseAmountString(originalText);
          if (amount !== null) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[groceryHelpers] ✅ Successfully parsed amount from original text:', amount);
            }
          }
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[groceryHelpers] 🥬 Processing ingredient:`, {
            originalName: ingredient.name,
            parsedBaseName: parsedName.baseName,
            originalText,
            amount: ingredient.amount,
            amountType: typeof ingredient.amount,
            parsedAmount: amount,
            unit: ingredient.unit,
            unitType: typeof ingredient.unit,
            existingCategory: (ingredient as any).grocery_category
          });
        }
        
        // Special debugging for broccoli
        if (ingredient.name.toLowerCase().includes('broccoli')) {
          console.log('[groceryHelpers] 🥦 BROCCOLI DEBUG:', {
            originalName: ingredient.name,
            parsedBaseName: parsedName.baseName,
            originalUnit: ingredient.unit,
            originalText
          });
        }
        
        // Special debugging for garlic
        if (ingredient.name.toLowerCase().includes('garlic')) {
          console.log('[groceryHelpers] 🧄 GARLIC DEBUG:', {
            originalName: ingredient.name,
            parsedBaseName: parsedName.baseName,
            originalUnit: ingredient.unit,
            originalText
          });
        }
        
        // Special debugging for potatoes
        if (ingredient.name.toLowerCase().includes('potato')) {
          console.log('[groceryHelpers] 🥔 POTATO DEBUG:', {
            originalName: ingredient.name,
            parsedBaseName: parsedName.baseName,
            originalUnit: ingredient.unit,
            originalText
          });
        }
        
        // Special debugging for flour
        if (ingredient.name.toLowerCase().includes('flour')) {
          console.log('[groceryHelpers] 🌾 FLOUR DEBUG:', {
            originalName: ingredient.name,
            parsedBaseName: parsedName.baseName,
            originalUnit: ingredient.unit,
            originalText
          });
        }
        
        // Handle unit - normalize it if it exists, but preserve original for display
        let standardizedUnit: string | null = null;
        let displayUnit: string | null = null;
        let descriptiveSize: string | null = null;
        
        if (ingredient.unit !== null && ingredient.unit !== undefined && ingredient.unit !== '') {
          const originalUnit = ingredient.unit.toLowerCase().trim();
          standardizedUnit = normalizeUnit(ingredient.unit);
          
          // Check if this is a descriptive size that should be moved to name
          if (standardizedUnit === null) {
            const descriptiveSizes = ['small', 'medium', 'large', 'extra large', 'small-size', 'medium-size', 'large-size'];
            if (descriptiveSizes.some(size => originalUnit.includes(size.toLowerCase()))) {
              descriptiveSize = ingredient.unit; // Preserve original capitalization
              if (process.env.NODE_ENV === 'development') {
                console.log('[groceryHelpers] 📏 Descriptive size detected, will add to name:', descriptiveSize);
              }
            }
          }
          // Preserve specific unit types for better display
          else if (originalUnit === 'cloves' || originalUnit === 'clove') {
            displayUnit = 'cloves';
          } else if (originalUnit === 'heads' || originalUnit === 'head') {
            displayUnit = 'heads';
          } else if (originalUnit === 'pinches' || originalUnit === 'pinch') {
            displayUnit = 'pinch';
          } else if (originalUnit === 'dashes' || originalUnit === 'dash') {
            displayUnit = 'dash';
          } else if (originalUnit === 'slices' || originalUnit === 'slice') {
            displayUnit = 'slices';
          } else if (originalUnit === 'large handfuls' || originalUnit === 'large handful') {
            displayUnit = 'large handfuls';
          } else if (originalUnit === 'small handfuls' || originalUnit === 'small handful') {
            displayUnit = 'small handfuls';
          } else if (originalUnit === 'small pinch' || originalUnit === 'medium pinch' || originalUnit === 'large pinch') {
            displayUnit = originalUnit; // Keep the full descriptive pinch
          } else {
            displayUnit = null; // Use standardized unit for display
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[groceryHelpers] 📏 Normalized unit:', ingredient.unit, '→', standardizedUnit, '(display:', displayUnit, ', descriptive:', descriptiveSize, ')');
          }
        }
        
        // If no unit from structured ingredient, try to extract from original text as fallback
        if (standardizedUnit === null) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[groceryHelpers] 🔄 No unit found, trying to extract from original text:', originalText);
          }
          
          // Simple unit extraction from original text
          const unitMatch = originalText.match(/\b(cup|cups|tbsp|tbs|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters|clove|cloves|head|heads|bunch|bunches|piece|pieces|slice|slices|stalk|stalks|sprig|sprigs|can|cans|bottle|bottles|box|boxes|bag|bags|package|packages|jar|jars|container|containers|pinch|pinches|dash|dashes|large\s+handful|large\s+handfuls|small\s+handful|small\s+handfuls|handful|handfuls|each|count)\b/i);
          if (unitMatch) {
            const extractedUnit = unitMatch[1].toLowerCase();
            standardizedUnit = normalizeUnit(extractedUnit);
            
            // Preserve specific unit types for display
            if (extractedUnit === 'cloves' || extractedUnit === 'clove') {
              displayUnit = 'cloves';
            } else if (extractedUnit === 'heads' || extractedUnit === 'head') {
              displayUnit = 'heads';
            } else if (extractedUnit === 'pinches' || extractedUnit === 'pinch') {
              displayUnit = 'pinch';
            } else if (extractedUnit === 'dashes' || extractedUnit === 'dash') {
              displayUnit = 'dash';
                      } else if (extractedUnit === 'slices' || extractedUnit === 'slice') {
            displayUnit = 'slices';
          } else if (extractedUnit === 'large handfuls' || extractedUnit === 'large handful') {
            displayUnit = 'large handfuls';
          } else if (extractedUnit === 'small handfuls' || extractedUnit === 'small handful') {
            displayUnit = 'small handfuls';
          }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[groceryHelpers] ✅ Successfully extracted unit from original text:', extractedUnit, '→', standardizedUnit, '(display:', displayUnit, ')');
            }
          }
        }
        
        // Special case: For spices without units, assign appropriate units based on ingredient name
        if (standardizedUnit === null && amount !== null) {
          const ingredientName = parsedName.baseName.toLowerCase();
          
          // Check if this is a spice/seasoning that should get a pinch unit
          // Be more specific to avoid catching vegetable peppers
          const spiceKeywords = [
            'cumin', 'paprika', 'turmeric', 'cinnamon', 'nutmeg', 'allspice',
            'cardamom', 'coriander', 'caraway', 'anise', 'saffron',
            'cayenne', 'chili powder', 'curry powder', 'garam masala',
            'oregano', 'thyme', 'rosemary', 'sage', 'basil', 'marjoram',
            'bay leaves', 'dill', 'tarragon', 'herbs',
            'garlic powder', 'onion powder', 'ginger powder'
          ];
          
          // Handle pepper separately to avoid catching vegetable peppers
          const isVegetablePepper = ingredientName.includes('bell') || 
                                  ingredientName.includes('jalapeño') || 
                                  ingredientName.includes('serrano') ||
                                  ingredientName.includes('poblano') ||
                                  ingredientName.includes('habanero') ||
                                  ingredientName.includes('anaheim') ||
                                  ingredientName.includes('chipotle') ||
                                  ingredientName.includes('fresno');
          
          const isPepperSpice = !isVegetablePepper && (
            ingredientName === 'pepper' || 
            ingredientName === 'black pepper' || 
            ingredientName === 'white pepper' ||
            ingredientName === 'ground pepper' ||
            ingredientName.includes('peppercorn')
          );
          
          // Exclude fennel bulb from being treated as a spice (fennel seeds are the spice)
          const isFennelBulb = ingredientName.includes('fennel') && !ingredientName.includes('seed');
          
          const isRegularSpice = spiceKeywords.some(spice => ingredientName.includes(spice));
          const isSpice = (isRegularSpice || isPepperSpice) && !isFennelBulb;
          
          if (isSpice && amount <= 5) { // Small amounts of spices get pinch
            standardizedUnit = 'each'; // For aggregation (pinch normalizes to each)
            displayUnit = 'pinch';
            if (process.env.NODE_ENV === 'development') {
              console.log('[groceryHelpers] 🌶️ Assigned pinch unit to spice:', ingredientName);
            }
          }
        }
        
        // Skip ingredients that are marked as removed or have no amount
        if (ingredient.name.includes('(removed)') || amount === null || amount === 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[groceryHelpers] ⏭️ Skipping removed/empty ingredient:`, {
              name: ingredient.name,
              amount: ingredient.amount,
              parsedAmount: amount
            });
          }
          continue; // Skip to next ingredient
        }

        // Create grocery list item from final ingredient
        // Include descriptive size in the item name if present, but not if it's a unit
        let finalItemName = parsedName.baseName;
        if (descriptiveSize && !displayUnit) {
          // Only add descriptive size if we don't have a display unit
          // This prevents "small heads broccoli" when we have display_unit: "heads"
          finalItemName = `${descriptiveSize} ${parsedName.baseName}`;
        }
        
        const groceryItem = {
          item_name: finalItemName,
          original_ingredient_text: originalText,
          quantity_amount: amount, // Use proper amount parsing
          quantity_unit: standardizedUnit, // Use standardized unit internally
          display_unit: displayUnit || (standardizedUnit && standardizedUnit !== 'each' ? getUnitDisplayName(standardizedUnit as Unit, amount || 1) : null),
          grocery_category: (ingredient as any).grocery_category || null, // Use pre-categorized data if available
          is_checked: false,
          order_index: orderIndex++,
          recipe_id: recipe.id || null,
          user_saved_recipe_id: userSavedRecipeId || null,
          source_recipe_title: recipe.title || 'Unknown Recipe',
          preparation: ingredient.preparation || null // Include preparation method
        };

        console.log('[groceryHelpers] ✅ DEBUG: Created final grocery item:', {
          originalName: ingredient.name,
          finalItemName: groceryItem.item_name,
          quantity_amount: groceryItem.quantity_amount,
          quantity_unit: groceryItem.quantity_unit,
          display_unit: groceryItem.display_unit,
          originalText,
          parsedName
        });
        
        if (process.env.NODE_ENV === 'development') {
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
        }
        
        // Special debugging for broccoli final item
        if (ingredient.name.toLowerCase().includes('broccoli')) {
          console.log('[groceryHelpers] 🥦 BROCCOLI FINAL ITEM:', {
            item_name: groceryItem.item_name,
            quantity_amount: groceryItem.quantity_amount,
            quantity_unit: groceryItem.quantity_unit,
            display_unit: groceryItem.display_unit,
            finalItemName: finalItemName,
            descriptiveSize,
            displayUnit
          });
        }
        
        // Special debugging for garlic final item
        if (ingredient.name.toLowerCase().includes('garlic')) {
          console.log('[groceryHelpers] 🧄 GARLIC FINAL ITEM:', {
            item_name: groceryItem.item_name,
            quantity_amount: groceryItem.quantity_amount,
            quantity_unit: groceryItem.quantity_unit,
            display_unit: groceryItem.display_unit,
            finalItemName: finalItemName,
            descriptiveSize,
            displayUnit
          });
        }
        
        // Special debugging for potato final item
        if (ingredient.name.toLowerCase().includes('potato')) {
          console.log('[groceryHelpers] 🥔 POTATO FINAL ITEM:', {
            item_name: groceryItem.item_name,
            quantity_amount: groceryItem.quantity_amount,
            quantity_unit: groceryItem.quantity_unit,
            display_unit: groceryItem.display_unit,
            finalItemName: finalItemName,
            descriptiveSize,
            displayUnit
          });
        }
        
        // Special debugging for flour final item
        if (ingredient.name.toLowerCase().includes('flour')) {
          console.log('[groceryHelpers] 🌾 FLOUR FINAL ITEM:', {
            item_name: groceryItem.item_name,
            quantity_amount: groceryItem.quantity_amount,
            quantity_unit: groceryItem.quantity_unit,
            display_unit: groceryItem.display_unit,
            finalItemName: finalItemName,
            descriptiveSize,
            displayUnit
          });
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[groceryHelpers] ✅ Created grocery item:`, {
            item_name: groceryItem.item_name,
            original_ingredient_text: groceryItem.original_ingredient_text,
            quantity_amount: groceryItem.quantity_amount,
            quantity_unit: groceryItem.quantity_unit,
            grocery_category: groceryItem.grocery_category,
            basicCategory: getBasicGroceryCategory(groceryItem.item_name),
            preparation: groceryItem.preparation
          });
        }
        
        groceryItems.push(groceryItem);
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[groceryHelpers] 🎯 Finished formatting ${groceryItems.length} grocery items`);
  }
  
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
        if (process.env.NODE_ENV === 'development') {
          console.log('[groceryHelpers] 🧀 Converting cheese from oz to cups:', {
            item: item.item_name,
            originalAmount: item.quantity_amount,
            originalUnit: 'oz',
            newAmount: cupsAmount,
            newUnit: 'cup'
          });
        }
        
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
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 🏷️ Starting basic categorization for', items.length, 'items');
  }
  const result = items.map(item => {
    const category = getBasicGroceryCategory(item.item_name);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[groceryHelpers] 📝 Categorized "${item.item_name}" as "${category}"`);
    }
    return {
      ...item,
      grocery_category: category
    };
  });
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ✅ Completed basic categorization');
  }
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
  preparation: string | null;
}> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] 💾 Preparing', items.length, 'items for database insertion');
  }
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
    source_recipe_title: item.source_recipe_title,
    preparation: item.preparation
  }));
  if (process.env.NODE_ENV === 'development') {
    console.log('[groceryHelpers] ✅ Items prepared for database');
  }
  return result; 
}