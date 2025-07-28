// Basic Unit Conversion Logic
// Focus on common cooking units (volume primarily)
// Could be expanded significantly or use a library for more robustness

// Base unit: Milliliters (ml)
// Using exact US legal definitions to prevent floating-point precision errors
// 1 US gallon = 231 cubic inches exactly = 3785.411784 ml exactly
const conversions: { [key: string]: number } = {
  ml: 1,
  tsp: 4.92892159375,         // US teaspoon (1/3 tbsp exactly)
  tbsp: 14.78676478125,       // US tablespoon (1/2 fl oz exactly)  
  fl_oz: 29.5735295625,       // US fluid ounce (1/8 cup exactly)
  cup: 236.5882365,           // US cup (1/2 pint exactly)
  pint: 473.176473,           // US pint (1/2 quart exactly)
  quart: 946.352946,          // US quart (1/4 gallon exactly)
  gallon: 3785.411784,        // US gallon (231 cubic inches exactly)
  liter: 1000,               // Metric liter
  each: 1,                   // Count-based unit for consistent aggregation
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

  // Return full precision result for internal calculations
  return result;
}

// Helper to get common display names (can be expanded)
export function getUnitDisplayName(unit: Unit | string | null, amount: number = 1): string | null {
    console.log('[units] 📏 getUnitDisplayName called with:', { unit, amount });
    
    // Handle null or undefined units
    if (!unit || unit === 'null') {
        console.log('[units] 📏 getUnitDisplayName returning null - unit is null or "null"');
        return null;
    }
    
    // Define standard display forms for each unit (including count units)
    const displayForms: { [key: string]: { singular: string, plural: string } } = {
        // Volume units
        ml: { singular: 'ml', plural: 'ml' },
        tsp: { singular: 'tsp', plural: 'tsp' },
        tbsp: { singular: 'Tbsp', plural: 'Tbsp' },
        fl_oz: { singular: 'fl oz', plural: 'fl oz' },
        cup: { singular: 'cup', plural: 'cups' },
        pint: { singular: 'pint', plural: 'pints' },
        quart: { singular: 'quart', plural: 'quarts' },
        gallon: { singular: 'gallon', plural: 'gallons' },
        liter: { singular: 'liter', plural: 'liters' },
        
        // Count units - standardized to 'each'
        each: { singular: 'each', plural: 'each' },
        
        // Compound units (fallback for backend parsing failures)
        'oz can': { singular: 'oz can', plural: 'oz cans' },
        'ounce can': { singular: 'ounce can', plural: 'ounce cans' },
        'lb bag': { singular: 'lb bag', plural: 'lb bags' },
        'pound bag': { singular: 'pound bag', plural: 'pound bags' },
        'oz package': { singular: 'oz package', plural: 'oz packages' },
        'ounce package': { singular: 'ounce package', plural: 'ounce packages' },
        'oz jar': { singular: 'oz jar', plural: 'oz jars' },
        'ounce jar': { singular: 'ounce jar', plural: 'ounce jars' },
    };

    // Special cases for amounts that should use plural
    if (amount === 0 || amount > 1 || (amount < 1 && amount > 0)) {
        const result = displayForms[unit]?.plural || String(unit);
        console.log('[units] 📏 getUnitDisplayName returning plural form:', result);
        return result;
    }

    const result = displayForms[unit]?.singular || String(unit);
    console.log('[units] 📏 getUnitDisplayName returning singular form:', result);
    return result;
} 