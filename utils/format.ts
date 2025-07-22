export function formatMeasurement(amount: number): string {
  if (isNaN(amount)) return '';

  // Add tolerance for floating-point precision errors
  const TOLERANCE = 0.01; // 1% tolerance
  
  const FRACTIONS = [
    { value: 1, label: '' },
    { value: 0.875, label: '⅞' },
    { value: 0.833, label: '⅚' },
    { value: 0.75, label: '¾' },
    { value: 0.666, label: '⅔' },
    { value: 0.625, label: '⅝' },
    { value: 0.5, label: '½' },
    { value: 0.375, label: '⅜' },
    { value: 0.333, label: '⅓' },
    { value: 0.25, label: '¼' },
    { value: 0.125, label: '⅛' },
    { value: 0, label: '' }  // Add explicit zero for whole numbers
  ];

  const whole = Math.floor(amount);
  const decimal = amount - whole;
  
  // Handle very small decimal parts as whole numbers (floating-point precision errors)
  if (decimal < TOLERANCE) {
    return whole.toString();
  }
  
  // Handle cases very close to the next whole number
  if (decimal > (1 - TOLERANCE)) {
    return (whole + 1).toString();
  }

  let closest = FRACTIONS.reduce((prev, curr) =>
    Math.abs(curr.value - decimal) < Math.abs(prev.value - decimal) ? curr : prev
  );

  if (whole === 0 && closest.value === 1) return '1'; // e.g. 0.99 rounds to 1
  if (closest.value === 0) return `${whole}`;
  return whole > 0 ? `${whole} ${closest.label}` : `${closest.label}`;
}

export const abbreviateUnit = (unit: string | null): string | null => {
  if (!unit) return null;
  const lowerUnit = unit.toLowerCase();
  switch (lowerUnit) {
    case 'teaspoon':
    case 'teaspoons':
      return 'tsp';
    case 'tablespoon':
    case 'tablespoons':
      return 'tbsp';
    case 'pound':
    case 'pounds':
      return 'lb';
    case 'kilogram':
    case 'kilograms':
      return 'kg';
    case 'gram':
    case 'grams':
      return 'g';
    case 'ounce':
    case 'ounces':
      return 'oz';
    case 'milliliter':
    case 'milliliters':
      return 'ml';
    case 'liter':
    case 'liters':
      return 'l';
    case 'cup':
    case 'cups':
        return 'cup'; 
    case 'pinch':
    case 'pinches':
        return 'pinch';
    case 'dash':
    case 'dashes':
        return 'dash';
    default:
      return unit;
  }
}; 