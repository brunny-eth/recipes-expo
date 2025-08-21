// Import the StructuredIngredient type from the shared types file
import { StructuredIngredient } from '../common/types';
import uuid from 'react-native-uuid';

// --- Fraction Handling ---
// Helper to convert fraction string ("1/2", "3/4") to number
const fractionToDecimal = (fraction: string): number | null => {
  const parts = fraction.split('/');
  if (parts.length !== 2) return null;
  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

// Helper to find the greatest common divisor (for simplifying fractions)
const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

// --- Unicode Fractions Definition ---
const UNICODE_FRACTIONS: { [key: string]: number } = {
  // Vulgar Fractions block (U+00BC–U+00BE)
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  // Number Forms block (U+2150–U+215F) - selected common ones
  '⅐': 1/7, '⅑': 1/9, '⅒': 1/10, // Note: 1/10 is 0.1
  '⅓': 1/3, '⅔': 2/3,
  '⅕': 1/5, '⅖': 2/5, '⅗': 3/5, '⅘': 4/5,
  '⅙': 1/6, '⅚': 5/6,
  '⅛': 1/8, '⅜': 3/8, '⅝': 5/8, '⅞': 7/8,
  '↉': 0, // Used for 0/3 in some contexts, effectively zero.
  // Add more as needed, e.g. U+2189  vulgar fraction zero thirds
};

// Generate a regex fragment for matching any of the defined unicode fraction characters
const unicodeFractionCharsRegexFragment = Object.keys(UNICODE_FRACTIONS)
  .map(char => char.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')) // Escape special regex chars
  .join('');

// --- Main Parsing Function ---
export const parseAmountString = (amountStr: string | null | undefined): number | null => {
  console.log('[recipeUtils] 🔢 parseAmountString called with:', amountStr);
  
  if (amountStr === null || amountStr === undefined || typeof amountStr !== 'string') {
    console.log('[recipeUtils] 🔢 parseAmountString returning null - invalid input type');
    return null;
  }

  let currentAmountStr = amountStr.trim();
  if (!currentAmountStr) {
    console.log('[recipeUtils] 🔢 parseAmountString returning null - empty string after trim');
    return null;
  }

  // 1. Handle "approx" or "~" prefix
  // This modifies currentAmountStr for subsequent parsing attempts
  if (currentAmountStr.startsWith('~')) {
    currentAmountStr = currentAmountStr.substring(1).trim();
  } else if (currentAmountStr.toLowerCase().startsWith('approx ')) {
    currentAmountStr = currentAmountStr.substring('approx '.length).trim();
  } else if (currentAmountStr.toLowerCase().startsWith('approx.')) {
    currentAmountStr = currentAmountStr.substring('approx.'.length).trim();
  }
  // Re-check if currentAmountStr became empty after stripping prefix
  if (!currentAmountStr) {
    return null; // e.g., if input was just "~" or "approx "
  }

  // 2. Check for standalone Unicode fraction (e.g., "½")
  if (UNICODE_FRACTIONS.hasOwnProperty(currentAmountStr)) {
    return UNICODE_FRACTIONS[currentAmountStr];
  }

  // 3. Check for mixed numbers with Unicode fraction (e.g., "1 ½")
  if (unicodeFractionCharsRegexFragment) { // Only if map is not empty and fragment was generated
    const mixedUnicodeMatch = currentAmountStr.match(
        new RegExp(`^(\\d+)\\s+([${unicodeFractionCharsRegexFragment}])$`)
    );
    if (mixedUnicodeMatch) {
        const whole = parseFloat(mixedUnicodeMatch[1]);
        const fracChar = mixedUnicodeMatch[2];
        if (UNICODE_FRACTIONS.hasOwnProperty(fracChar)) { // Ensure fracChar is a valid key
            return whole + UNICODE_FRACTIONS[fracChar as keyof typeof UNICODE_FRACTIONS];
        }
    }
  }

  // 4. Check for mixed numbers with ASCII fraction (e.g., "1 1/2")
  const mixedNumberMatchOld = currentAmountStr.match(/^(\d+)\s+(\d+\/\d+)/);
  if (mixedNumberMatchOld) {
    const whole = parseFloat(mixedNumberMatchOld[1]);
    const fracDecimal = fractionToDecimal(mixedNumberMatchOld[2]);
    if (fracDecimal !== null) {
      return whole + fracDecimal;
    }
  }

  // 5. Check for simple ASCII fractions (e.g., "1/2")
  const fractionMatchOld = currentAmountStr.match(/^(\d+\/\d+)/);
  if (fractionMatchOld) {
    return fractionToDecimal(fractionMatchOld[1]);
  }
  
  // 6. Handle ranges (e.g., "2-3", "1 to 2") - take the first number
  // Parses "X-Y" or "X to Y" (case-insensitive for "to")
  const rangeMatch = currentAmountStr.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*\d+/i);
  if (rangeMatch) {
    const firstNum = parseFloat(rangeMatch[1]);
    if (!isNaN(firstNum)) {
      return firstNum;
    }
  }
  
  // 7. Check for simple decimals or whole numbers (e.g., "1.5", "2", "0.5 apples")
  // This attempts to parse a leading number from the string.
  // It allows for trailing text (like units) which parseFloat handles by ignoring.
  if (/^(\d|\.\d)/.test(currentAmountStr)) { // Check if it starts like a number
    const num = parseFloat(currentAmountStr);
    if (!isNaN(num)) {
      console.log('[recipeUtils] 🔢 parseAmountString returning parsed number:', num);
      return num; // parseFloat will extract "2" from "2 apples"
    }
  }

  // If none of the above specific formats match, return null.
  // This covers cases like "to taste", "a pinch", or other non-numeric/unhandled amounts.
  console.log('[recipeUtils] 🔢 parseAmountString returning null - no valid number found');
  return null;
};

// Helper to parse a "servings" or "yield" string (e.g., "6-8 servings", "Makes 4", "About 10 tacos")
// It extracts the first number, or averages a range.
export const parseServingsValue = (yieldStr: string | null | undefined): number | null => {
  if (yieldStr === null || yieldStr === undefined || typeof yieldStr !== 'string') {
    return null;
  }

  let processedStr = yieldStr.trim().toLowerCase();
  if (!processedStr) {
    return null;
  }

  // Strip common prefixes
  const prefixes = ["makes ", "about ", "approx ", "approx.", "~"];
  for (const prefix of prefixes) {
    if (processedStr.startsWith(prefix)) {
      processedStr = processedStr.substring(prefix.length).trim();
      // Re-check if empty after stripping
      if (!processedStr) return null;
      break; // Assume only one such prefix
    }
  }

  // Regex to capture:
  // 1. A leading number (integer or decimal)
  // 2. Optionally, a range indicator ("-" or "to", case-insensitive) followed by a second number.
  // Example: "8-10", "8 to 10", "8"
  const servingsRegex = /(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?/i;
  const match = processedStr.match(servingsRegex);

  if (match) {
    const firstNumStr = match[1];
    const secondNumStr = match[2]; // This will be undefined if not a range

    const firstNum = parseFloat(firstNumStr);

    if (secondNumStr) { // It's a range like "N-M" or "N to M"
      const secondNum = parseFloat(secondNumStr);
      if (!isNaN(firstNum) && !isNaN(secondNum)) {
        // For a range like "8-10", use the average, rounded
        return Math.round((firstNum + secondNum) / 2);
      } else if (!isNaN(firstNum)) {
        // If the second part of the range is invalid, fall back to the first number
        return firstNum;
      }
    } else if (!isNaN(firstNum)) {
      // Not a range, or only the first part of a range was valid, and it's a number
      return firstNum;
    }
  }

  // If the regex does not match (e.g., string doesn't start with a number in the expected format)
  return null;
};

/**
 * Generates a display string for a potentially scaled recipe yield.
 * @param yieldStr The original recipe yield string (e.g., "6-8 servings", "12 tacos").
 * @param factor The scaling factor applied (e.g., 0.5, 1, 2.5).
 * @returns A user-friendly string describing the scaled yield.
 */
export function getScaledYieldText(yieldStr: string | null | undefined, factor: number): string {
  if (factor === 1 || isNaN(factor) || factor <= 0) {
    return formatRecipeYield(yieldStr) || "Original quantity"; // Use formatted yield for consistency
  }

  const baseServings = parseServingsValue(yieldStr);

  if (baseServings && baseServings > 0) {
    const scaledNumericYield = Math.round(baseServings * factor * 10) / 10; // Round to 1 decimal for display
    if (scaledNumericYield <= 0) {
      return "a small amount";
    }
    
    // Try to find the original unit (e.g., "servings", "tacos", "burgers")
    const unitMatch = yieldStr?.match(/\b([a-zA-Z]+)\b$/);
    const unit = unitMatch ? ` ${unitMatch[1]}` : ' servings'; // Default to servings if no unit found

    return `${scaledNumericYield}${unit}`;
  }
  
  // Fallback if original yield string couldn't be parsed into a number but there's a scale factor
  const formattedOriginal = formatRecipeYield(yieldStr);
  return `${factor}x of the ${formattedOriginal || "original quantity"}`;
}

// --- Formatting Function ---
const UNICODE_FRACTION_MAP: Record<string, string> = {
    '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
    '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘', '1/6': '⅙',
    '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞'
};

const FRACTION_MAP_DECIMAL_TO_ASCII: { [key: number]: string } = {
  0.125: '1/8', 0.166: '1/6', 0.1667: '1/6', 0.2: '1/5',
  0.25: '1/4', 0.33: '1/3', 0.333: '1/3', 0.3333: '1/3',
  0.375: '3/8', 0.4: '2/5', 0.5: '1/2', 0.6: '3/5',
  0.625: '5/8', 0.66: '2/3', 0.666: '2/3', 0.6667: '2/3',
  0.75: '3/4', 0.8: '4/5', 0.833: '5/6', 0.8333: '5/6', 0.875: '7/8',
};

const FRACTION_PRECISION = 0.02;

function decimalToUnicodeFraction(decimal: number): string | null {
  if (decimal <= 0) return null;

  let bestAsciiMatch = '';
  let minDiff = 1;
  
  for (const decimalVal in FRACTION_MAP_DECIMAL_TO_ASCII) {
    const diff = Math.abs(decimal - parseFloat(decimalVal));
    if (diff < FRACTION_PRECISION && diff < minDiff) {
      minDiff = diff;
      bestAsciiMatch = FRACTION_MAP_DECIMAL_TO_ASCII[decimalVal as unknown as keyof typeof FRACTION_MAP_DECIMAL_TO_ASCII];
    }
  }
  
  if (bestAsciiMatch) {
    return UNICODE_FRACTION_MAP[bestAsciiMatch] || bestAsciiMatch;
  }

  const tolerance = 1.0E-6;
  let h1 = 1; let h2 = 0;
  let k1 = 0; let k2 = 1;
  let b = decimal;
  do {
      let a = Math.floor(b);
      let aux = h1; h1 = a * h1 + h2; h2 = aux;
      aux = k1; k1 = a * k1 + k2; k2 = aux;
      b = 1 / (b - a);
  } while (Math.abs(decimal - h1 / k1) > decimal * tolerance && k1 <= 16);

  if (k1 > 0 && k1 <= 16) {
      const asciiFraction = `${h1}/${k1}`;
      return UNICODE_FRACTION_MAP[asciiFraction] || asciiFraction;
  }
  
  return null;
}

export const formatAmountNumber = (num: number | null): string | null => {
  if (num === null || isNaN(num) || num <= 0) {
      return null;
  }

  const wholePart = Math.floor(num);
  const decimalPart = num - wholePart;

  if (decimalPart < FRACTION_PRECISION) {
    return wholePart > 0 ? wholePart.toString() : null;
  }
  if (decimalPart > (1 - FRACTION_PRECISION)) {
    return (wholePart + 1).toString();
  }

  const fractionStr = decimalToUnicodeFraction(decimalPart);
  
  if (fractionStr) {
      const wholeStr = wholePart > 0 ? wholePart.toString() : '';
      return `${wholeStr}${fractionStr}`;
  }

  return parseFloat(num.toFixed(1)).toString();
};


// --- Scaling Function ---
export const scaleIngredient = (
  ingredient: StructuredIngredient,
  scaleFactor: number
): StructuredIngredient => {
  if (isNaN(scaleFactor) || scaleFactor <= 0 || scaleFactor === 1) {
    return ingredient;
  }
  // Robustly handle both string and number types for amount
  let amountStr: string | null | undefined = ingredient.amount;
  if (typeof ingredient.amount === 'number') {
    amountStr = String(ingredient.amount);
  } else if (ingredient.amount === undefined || ingredient.amount === null) {
    amountStr = null;
  } else if (typeof ingredient.amount !== 'string') {
    amountStr = String(ingredient.amount);
  }
  const originalAmountNum = parseAmountString(amountStr);
  if (originalAmountNum === null || originalAmountNum <= 0) {
    return ingredient;
  }
  const newAmountNum = originalAmountNum * scaleFactor;
  const cleanedAmountNum = Math.round(newAmountNum * 1000) / 1000;
  const newAmountStr = formatAmountNumber(cleanedAmountNum);
  return {
    ...ingredient,
    amount: newAmountStr, // Keep unit the same
  };
};

/**
 * Formats recipe yield for display by adding "servings" if only a number is provided.
 * @param yieldStr The original recipe yield string (e.g., "6", "4 burgers", "8 servings").
 * @returns A formatted string with appropriate units (e.g., "6 servings", "4 burgers", "8 servings").
 */
export function formatRecipeYield(yieldStr: string | null | undefined): string | null {
  if (!yieldStr || typeof yieldStr !== 'string') {
    return null;
  }

  const trimmed = yieldStr.trim();
  if (!trimmed) {
    return null;
  }

  // Check if the string already has text after a number (like "4 burgers", "2 sandwiches", "8 servings")
  const hasUnitMatch = trimmed.match(/^\d+(?:\.\d+)?\s+[a-zA-Z]/);
  
  if (hasUnitMatch) {
    // Already has a unit, return as is
    return trimmed;
  }

  // Check if it's just a number (possibly with range like "4-6")
  const justNumberMatch = trimmed.match(/^(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)$/);
  
  if (justNumberMatch) {
    // Just a number or number range, add "servings"
    return `${trimmed} servings`;
  }

  // For any other format, return as is (covers edge cases)
  return trimmed;
} 

/**
 * Determines if a recipe is a user-modified fork
 * @param recipe - The recipe object to check
 * @returns boolean indicating if this is a user fork
 */
export function isUserFork(recipe: any): boolean {
  return (
    recipe?.source_type === 'user_modified' ||
    !!recipe?.parent_recipe_id ||
    recipe?.is_user_modified === true
  );
}

// Normalize instructions to the new InstructionStep format
export type InstructionStep = { id: string; text: string; note?: string };

export function normalizeInstructionsToSteps(raw: any): InstructionStep[] {
  if (!raw) return [];
  
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'string') {
    // Convert string[] to InstructionStep[]
    return (raw as string[]).map(s => ({ id: uuid.v4() as string, text: s }));
  }
  if (Array.isArray(raw)) {
    // Already InstructionStep[] or convert object[] to InstructionStep[]
    return (raw as any[]).map(s => ({ 
      id: s.id ?? uuid.v4() as string, 
      text: s.text ?? '', 
      note: s.note 
    }));
  }
  return [];
} 