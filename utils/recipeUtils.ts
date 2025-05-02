// Define type locally if not available globally
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null }> | null;
};

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

// --- Main Parsing Function ---
export const parseAmountString = (amountStr: string | null | undefined): number | null => {
  if (amountStr === null || amountStr === undefined || typeof amountStr !== 'string') {
    return null;
  }
  const trimmedAmount = amountStr.trim();
  if (!trimmedAmount || isNaN(parseFloat(trimmedAmount.charAt(0)))) {
    // Handle empty strings or strings not starting with a number (e.g., "to taste")
    return null; 
  }

  // Check for mixed numbers (e.g., "1 1/2")
  const mixedNumberMatch = trimmedAmount.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixedNumberMatch) {
    const whole = parseFloat(mixedNumberMatch[1]);
    const fracDecimal = fractionToDecimal(mixedNumberMatch[2]);
    if (fracDecimal !== null) {
      return whole + fracDecimal;
    }
  }

  // Check for simple fractions (e.g., "1/2")
  const fractionMatch = trimmedAmount.match(/^(\d+\/\d+)$/);
  if (fractionMatch) {
    return fractionToDecimal(fractionMatch[1]);
  }

  // Check for simple decimals or whole numbers (e.g., "1.5", "2")
  // Use parseFloat which handles decimals and whole numbers
  const num = parseFloat(trimmedAmount);
  if (!isNaN(num)) {
    return num;
  }
  
  // Handle ranges (e.g., "2-3") - take the first number
  const rangeMatch = trimmedAmount.match(/^(\d+(\.\d+)?)\s*-\s*\d+/);
   if (rangeMatch) {
     const firstNum = parseFloat(rangeMatch[1]);
     if (!isNaN(firstNum)) {
       return firstNum;
     }
   }

  // If none of the above match, it's likely not a standard quantifiable amount
  return null;
};


// --- Formatting Function ---
const FRACTION_MAP: { [key: number]: string } = {
  0.125: '1/8',
  0.25: '1/4',
  0.33: '1/3', 0.333: '1/3', 0.3333: '1/3',
  0.5: '1/2',
  0.66: '2/3', 0.666: '2/3', 0.6667: '2/3',
  0.75: '3/4',
  0.875: '7/8',
};
const FRACTION_PRECISION = 0.01; // How close a decimal needs to be to a known fraction

export const formatAmountNumber = (num: number | null): string | null => {
  if (num === null || isNaN(num)) return null;
  if (num <= 0) return null; // Don't format non-positive numbers typically

  const wholePart = Math.floor(num);
  const decimalPart = num - wholePart;

  let fractionStr = '';

  if (decimalPart > FRACTION_PRECISION) {
    let bestMatch = '';
    let minDiff = 1;

    // Find closest fraction in our map
    for (const decimalVal in FRACTION_MAP) {
      const diff = Math.abs(decimalPart - parseFloat(decimalVal));
      if (diff < FRACTION_PRECISION && diff < minDiff) {
        minDiff = diff;
        bestMatch = FRACTION_MAP[decimalVal];
      }
    }

    if (bestMatch) {
        fractionStr = bestMatch;
    } else {
        // If no close fraction, maybe round to 1 or 2 decimal places?
        // Or attempt to convert to a generic fraction
        const tolerance = 1.0E-6;
        let h1 = 1; let h2 = 0;
        let k1 = 0; let k2 = 1;
        let b = decimalPart;
        do {
            let a = Math.floor(b);
            let aux = h1; h1 = a * h1 + h2; h2 = aux;
            aux = k1; k1 = a * k1 + k2; k2 = aux;
            b = 1 / (b - a);
        } while (Math.abs(decimalPart - h1 / k1) > decimalPart * tolerance && k1 <= 16); // Limit denominator

        if (k1 <= 16) { // Only use if denominator is reasonable
            fractionStr = `${h1}/${k1}`;
        } else {
            // Fallback: Round decimal if no good fraction found
             fractionStr = parseFloat(decimalPart.toFixed(2)).toString(); 
             // Remove leading zero if present (e.g., "0.33" -> ".33") - stylistic choice
             if (fractionStr.startsWith('0.')) {
                 fractionStr = fractionStr.substring(1);
             }
        }
    }
  }

  const wholeStr = wholePart > 0 ? wholePart.toString() : '';
  const separator = wholePart > 0 && fractionStr ? ' ' : '';

  const result = `${wholeStr}${separator}${fractionStr}`;
  return result.trim() || null; // Return null if empty (e.g., input was 0)
};


// --- Scaling Function ---
export const scaleIngredient = (
  ingredient: StructuredIngredient,
  originalServings: number,
  newServings: number
): StructuredIngredient => {
  // Don't scale if servings are invalid or the same
  if (isNaN(originalServings) || originalServings <= 0 || isNaN(newServings) || newServings <= 0 || originalServings === newServings) {
    return ingredient;
  }
    
  const originalAmountNum = parseAmountString(ingredient.amount);

  // Don't scale if amount is not parseable (e.g., "to taste") or zero/negative
  if (originalAmountNum === null || originalAmountNum <= 0) {
    return ingredient;
  }

  const scaleFactor = newServings / originalServings;
  const newAmountNum = originalAmountNum * scaleFactor;

  const newAmountStr = formatAmountNumber(newAmountNum);

  // Return a *new* ingredient object with the updated amount
  return {
    ...ingredient,
    amount: newAmountStr, // Keep unit the same
  };
}; 