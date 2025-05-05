// Basic Unit Conversion Logic
// Focus on common cooking units (volume primarily)
// Could be expanded significantly or use a library for more robustness

// Base unit: Milliliters (ml)
const conversions: { [key: string]: number } = {
  ml: 1,
  tsp: 4.92892,       // US teaspoon
  tbsp: 14.7868,      // US tablespoon (3 tsp)
  fl_oz: 29.5735,     // US fluid ounce (2 tbsp)
  cup: 236.588,       // US cup (16 tbsp or 8 fl oz)
  pint: 473.176,      // US pint (2 cups)
  quart: 946.353,     // US quart (4 cups or 2 pints)
  gallon: 3785.41,    // US gallon (4 quarts)
  liter: 1000,       // Metric liter
  // Weight (approximate for common liquids like water/milk - very inaccurate for solids)
  // It's generally better NOT to convert between volume and weight without density info
  // g: 1,            // Gram (base for weight)
  // kg: 1000,
  // oz: 28.3495,     // Ounce (weight)
  // lb: 453.592,     // Pound (weight)
};

export type Unit = keyof typeof conversions;

export const availableUnits = Object.keys(conversions) as Unit[];

export function convertUnits(amount: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (isNaN(amount) || amount < 0) {
    return null;
  }
  if (!conversions[fromUnit] || !conversions[toUnit]) {
    console.error(`Unknown unit(s): ${fromUnit}, ${toUnit}`);
    return null; // Unknown unit
  }

  // Convert 'fromUnit' to base unit (ml)
  const amountInMl = amount * conversions[fromUnit];

  // Convert from base unit (ml) to 'toUnit'
  const result = amountInMl / conversions[toUnit];

  // Basic rounding for display purposes
  if (result < 0.1 && result > 0) {
      return parseFloat(result.toFixed(3));
  }
  if (result < 1 && result > 0) {
      return parseFloat(result.toFixed(2));
  }
  return parseFloat(result.toFixed(1));
}

// Helper to get common display names (can be expanded)
export function getUnitDisplayName(unit: Unit): string {
    switch (unit) {
        case 'ml': return 'ml';
        case 'tsp': return 'tsp';
        case 'tbsp': return 'tbsp';
        case 'fl_oz': return 'fl oz';
        case 'cup': return 'cups';
        case 'pint': return 'pints';
        case 'quart': return 'quarts';
        case 'gallon': return 'gallons';
        case 'liter': return 'liters';
        default:
            // Explicitly cast unit to string for the default case
            return String(unit);
    }
} 