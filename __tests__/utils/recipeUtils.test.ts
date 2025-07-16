import {
  parseAmountString,
  parseServingsValue,
  getScaledYieldText,
  formatAmountNumber,
  scaleIngredient,
  formatRecipeYield,
} from '../../utils/recipeUtils';
import { StructuredIngredient } from '@/common/types';

describe('recipeUtils', () => {
  describe('parseAmountString', () => {
    it('should parse whole numbers correctly', () => {
      expect(parseAmountString('2')).toBe(2);
      expect(parseAmountString('10')).toBe(10);
      expect(parseAmountString('0')).toBe(0);
    });

    it('should parse decimal numbers correctly', () => {
      expect(parseAmountString('2.5')).toBe(2.5);
      expect(parseAmountString('0.75')).toBe(0.75);
      expect(parseAmountString('1.25')).toBe(1.25);
    });

    it('should parse fractions correctly', () => {
      expect(parseAmountString('1/2')).toBe(0.5);
      expect(parseAmountString('3/4')).toBe(0.75);
      expect(parseAmountString('1/4')).toBe(0.25);
      expect(parseAmountString('2/3')).toBeCloseTo(0.667, 3);
    });

    it('should parse mixed numbers correctly', () => {
      expect(parseAmountString('1 1/2')).toBe(1.5);
      expect(parseAmountString('2 3/4')).toBe(2.75);
      expect(parseAmountString('3 1/4')).toBe(3.25);
    });

    it('should parse unicode fractions correctly', () => {
      expect(parseAmountString('½')).toBe(0.5);
      expect(parseAmountString('¼')).toBe(0.25);
      expect(parseAmountString('¾')).toBe(0.75);
      expect(parseAmountString('⅓')).toBeCloseTo(0.333, 3);
    });

    it('should parse mixed numbers with unicode fractions correctly', () => {
      expect(parseAmountString('1 ½')).toBe(1.5);
      expect(parseAmountString('2 ¼')).toBe(2.25);
      expect(parseAmountString('3 ¾')).toBe(3.75);
    });

    it('should handle approximation prefixes', () => {
      expect(parseAmountString('~2')).toBe(2);
      expect(parseAmountString('approx 1.5')).toBe(1.5);
      expect(parseAmountString('approx. 3/4')).toBe(0.75);
    });

    it('should handle ranges by taking the first number', () => {
      expect(parseAmountString('2-3')).toBe(2);
      expect(parseAmountString('1 to 2')).toBe(1);
      expect(parseAmountString('1.5-2.5')).toBe(1.5);
    });

    it('should handle numbers with trailing text', () => {
      expect(parseAmountString('2 cups')).toBe(2);
      expect(parseAmountString('1.5 tablespoons')).toBe(1.5);
    });

    it('should return null for invalid inputs', () => {
      expect(parseAmountString(null)).toBeNull();
      expect(parseAmountString(undefined)).toBeNull();
      expect(parseAmountString('')).toBeNull();
      expect(parseAmountString('to taste')).toBeNull();
      expect(parseAmountString('a pinch')).toBeNull();
      expect(parseAmountString('~')).toBeNull();
      expect(parseAmountString('approx')).toBeNull();
    });

    // Additional edge cases based on real-world usage
    it('should handle complex mixed fractions', () => {
      expect(parseAmountString('12 1/2')).toBe(12.5);
      expect(parseAmountString('0 3/4')).toBe(0.75);
    });

    it('should handle more unicode fractions', () => {
      expect(parseAmountString('⅕')).toBeCloseTo(0.2, 3);
      expect(parseAmountString('⅖')).toBeCloseTo(0.4, 3);
      expect(parseAmountString('⅗')).toBeCloseTo(0.6, 3);
      expect(parseAmountString('⅘')).toBeCloseTo(0.8, 3);
      expect(parseAmountString('⅙')).toBeCloseTo(0.167, 3);
      expect(parseAmountString('⅚')).toBeCloseTo(0.833, 3);
      expect(parseAmountString('⅛')).toBeCloseTo(0.125, 3);
      expect(parseAmountString('⅜')).toBeCloseTo(0.375, 3);
      expect(parseAmountString('⅝')).toBeCloseTo(0.625, 3);
      expect(parseAmountString('⅞')).toBeCloseTo(0.875, 3);
    });

    it('should handle ingredient parsing scenarios', () => {
      // From actual ingredient parsing in the codebase
      expect(parseAmountString('1.5 tablespoons olive oil')).toBe(1.5);
      expect(parseAmountString('2 pounds chicken thighs')).toBe(2);
      // Now correctly parses fractions with trailing text
      expect(parseAmountString('3/4 cup breadcrumbs')).toBe(0.75);
      // Now correctly parses mixed numbers with trailing text
      expect(parseAmountString('1 1/2 cups flour')).toBe(1.5);
    });

    it('should handle unusual but valid numeric formats', () => {
      expect(parseAmountString('0.5')).toBe(0.5);
      expect(parseAmountString('.5')).toBe(0.5);
      expect(parseAmountString('00.5')).toBe(0.5);
      expect(parseAmountString('2.0')).toBe(2.0);
    });

    it('should handle complex range formats', () => {
      expect(parseAmountString('1.5 to 2.5')).toBe(1.5);
      expect(parseAmountString('2 - 3')).toBe(2);
      // Now correctly parses fraction at start of range
      expect(parseAmountString('1/2 to 3/4')).toBe(0.5);
    });

    it('should handle different approximation formats', () => {
      expect(parseAmountString('~1/2')).toBe(0.5);
      expect(parseAmountString('approx 2 1/2')).toBe(2.5);
      expect(parseAmountString('approx. 1 ½')).toBe(1.5);
    });

    it('should handle edge cases with spacing', () => {
      expect(parseAmountString('  2  ')).toBe(2);
      expect(parseAmountString('1   1/2')).toBe(1.5);
      expect(parseAmountString('1 ½  ')).toBe(1.5);
    });

    it('should handle non-standard but parseable formats', () => {
      expect(parseAmountString('2cups')).toBe(2); // No space before unit
      expect(parseAmountString('1.5tbsp')).toBe(1.5); // No space before unit
    });
  });

  describe('parseServingsValue', () => {
    it('should parse simple servings correctly', () => {
      expect(parseServingsValue('4')).toBe(4);
      expect(parseServingsValue('6')).toBe(6);
      expect(parseServingsValue('12')).toBe(12);
    });

    it('should parse servings with units', () => {
      expect(parseServingsValue('4 servings')).toBe(4);
      expect(parseServingsValue('6 portions')).toBe(6);
      expect(parseServingsValue('8 people')).toBe(8);
    });

    it('should parse servings with prefixes', () => {
      expect(parseServingsValue('Makes 4')).toBe(4);
      expect(parseServingsValue('About 6')).toBe(6);
      expect(parseServingsValue('Approx 8')).toBe(8);
      expect(parseServingsValue('~10')).toBe(10);
    });

    it('should handle serving ranges by averaging', () => {
      expect(parseServingsValue('4-6')).toBe(5);
      expect(parseServingsValue('6-8')).toBe(7);
      expect(parseServingsValue('4 to 6')).toBe(5);
      expect(parseServingsValue('8 to 10')).toBe(9);
    });

    it('should handle complex serving descriptions', () => {
      expect(parseServingsValue('Makes 4-6 servings')).toBe(5);
      expect(parseServingsValue('About 8 to 10 portions')).toBe(9);
    });

    it('should return null for invalid inputs', () => {
      expect(parseServingsValue(null)).toBeNull();
      expect(parseServingsValue(undefined)).toBeNull();
      expect(parseServingsValue('')).toBeNull();
      expect(parseServingsValue('variable')).toBeNull();
    });

    // Additional edge cases for servings parsing
    it('should handle decimal servings', () => {
      expect(parseServingsValue('4.5')).toBe(4.5);
      expect(parseServingsValue('Makes 2.5 servings')).toBe(2.5);
      expect(parseServingsValue('2.5-3.5')).toBe(3);
    });

    it('should handle various units for servings', () => {
      expect(parseServingsValue('4 cookies')).toBe(4);
      expect(parseServingsValue('6 muffins')).toBe(6);
      expect(parseServingsValue('Makes 8 rolls')).toBe(8);
      expect(parseServingsValue('12 pieces')).toBe(12);
    });

    it('should handle edge cases with whitespace and capitalization', () => {
      expect(parseServingsValue('  4 servings  ')).toBe(4);
      expect(parseServingsValue('MAKES 6')).toBe(6);
      expect(parseServingsValue('About   8   portions')).toBe(8);
    });

    it('should handle serving ranges with different formats', () => {
      expect(parseServingsValue('2 to 4')).toBe(3);
      expect(parseServingsValue('4 - 6')).toBe(5);
      expect(parseServingsValue('6  to  8')).toBe(7);
      expect(parseServingsValue('Makes 2-4 servings')).toBe(3);
    });

    it('should handle non-numeric descriptions', () => {
      expect(parseServingsValue('large family')).toBeNull();
      expect(parseServingsValue('crowd')).toBeNull();
      expect(parseServingsValue('individual')).toBeNull();
      expect(parseServingsValue('to taste')).toBeNull();
    });
  });

  describe('getScaledYieldText', () => {
    it('should return original text when scale factor is 1', () => {
      expect(getScaledYieldText('4 servings', 1)).toBe('4 servings');
      expect(getScaledYieldText('6 portions', 1)).toBe('6 portions');
    });

    it('should scale servings correctly', () => {
      expect(getScaledYieldText('4 servings', 2)).toBe('8 servings');
      expect(getScaledYieldText('6 portions', 0.5)).toBe('3 portions');
      expect(getScaledYieldText('8 people', 1.5)).toBe('12 people');
    });

    it('should handle servings without units by adding default unit', () => {
      expect(getScaledYieldText('4', 2)).toBe('8 servings');
      expect(getScaledYieldText('6', 0.5)).toBe('3 servings');
    });

    it('should handle complex yield strings', () => {
      expect(getScaledYieldText('Makes 4 servings', 2)).toBe('8 servings');
      expect(getScaledYieldText('About 6 portions', 0.5)).toBe('3 portions');
    });

    it('should handle edge cases', () => {
      expect(getScaledYieldText('4 servings', 0)).toBe('4 servings');
      expect(getScaledYieldText('4 servings', -1)).toBe('4 servings');
      expect(getScaledYieldText(null, 2)).toBe('2x of the original quantity');
    });
  });

  describe('formatAmountNumber', () => {
    it('should format whole numbers correctly', () => {
      expect(formatAmountNumber(1)).toBe('1');
      expect(formatAmountNumber(2)).toBe('2');
      expect(formatAmountNumber(10)).toBe('10');
    });

    it('should format common fractions as unicode', () => {
      expect(formatAmountNumber(0.5)).toBe('½');
      expect(formatAmountNumber(0.25)).toBe('¼');
      expect(formatAmountNumber(0.75)).toBe('¾');
      expect(formatAmountNumber(1/3)).toBe('⅓');
      expect(formatAmountNumber(2/3)).toBe('⅔');
    });

    it('should format mixed numbers correctly', () => {
      expect(formatAmountNumber(1.5)).toBe('1½');
      expect(formatAmountNumber(2.25)).toBe('2¼');
      expect(formatAmountNumber(3.75)).toBe('3¾');
    });

    it('should format decimals when no fraction match', () => {
      expect(formatAmountNumber(1.7)).toBe('17/10');
      expect(formatAmountNumber(2.3)).toBe('23/10');
    });

    it('should return null for invalid inputs', () => {
      expect(formatAmountNumber(null)).toBeNull();
      expect(formatAmountNumber(0)).toBeNull();
      expect(formatAmountNumber(-1)).toBeNull();
    });
  });

  describe('scaleIngredient', () => {
    const mockIngredient: StructuredIngredient = {
      name: 'flour',
      amount: '2',
      unit: 'cups',
      preparation: null,
      suggested_substitutions: null,
    };

    it('should scale ingredient amounts correctly', () => {
      const scaled = scaleIngredient(mockIngredient, 2);
      expect(scaled.name).toBe('flour');
      expect(scaled.amount).toBe('4');
      expect(scaled.unit).toBe('cups');
    });

    it('should handle fractional scaling', () => {
      const scaled = scaleIngredient(mockIngredient, 0.5);
      expect(scaled.amount).toBe('1');
    });

    it('should handle complex amount strings', () => {
      const ingredient = { ...mockIngredient, amount: '1 1/2' };
      const scaled = scaleIngredient(ingredient, 2);
      expect(scaled.amount).toBe('3');
    });

    it('should handle ingredients without amounts', () => {
      const ingredient = { ...mockIngredient, amount: null };
      const scaled = scaleIngredient(ingredient, 2);
      expect(scaled.amount).toBeNull();
    });

    it('should handle scale factor of 1', () => {
      const scaled = scaleIngredient(mockIngredient, 1);
      expect(scaled).toEqual(mockIngredient);
    });

    it('should handle invalid scale factors', () => {
      const scaled1 = scaleIngredient(mockIngredient, 0);
      const scaled2 = scaleIngredient(mockIngredient, -1);
      expect(scaled1).toEqual(mockIngredient);
      expect(scaled2).toEqual(mockIngredient);
    });

    it('should handle numeric amounts', () => {
      const ingredient = { ...mockIngredient, amount: 2 as any };
      const scaled = scaleIngredient(ingredient, 1.5);
      expect(scaled.amount).toBe('3');
    });

    it('should preserve substitutions', () => {
      const ingredient = {
        ...mockIngredient,
        suggested_substitutions: [
          { name: 'almond flour', amount: '2', unit: 'cups', description: 'Gluten-free option' }
        ]
      };
      const scaled = scaleIngredient(ingredient, 2);
      expect(scaled.suggested_substitutions).toEqual(ingredient.suggested_substitutions);
    });
  });

  describe('formatRecipeYield', () => {
    it('should add servings to plain numbers', () => {
      expect(formatRecipeYield('4')).toBe('4 servings');
      expect(formatRecipeYield('6')).toBe('6 servings');
      expect(formatRecipeYield('12')).toBe('12 servings');
    });

    it('should add servings to number ranges', () => {
      expect(formatRecipeYield('4-6')).toBe('4-6 servings');
      expect(formatRecipeYield('8-10')).toBe('8-10 servings');
    });

    it('should leave existing units unchanged', () => {
      expect(formatRecipeYield('4 burgers')).toBe('4 burgers');
      expect(formatRecipeYield('6 sandwiches')).toBe('6 sandwiches');
      expect(formatRecipeYield('8 servings')).toBe('8 servings');
    });

    it('should handle complex yield strings', () => {
      expect(formatRecipeYield('Makes 4 burgers')).toBe('Makes 4 burgers');
      expect(formatRecipeYield('About 6 portions')).toBe('About 6 portions');
    });

    it('should return null for invalid inputs', () => {
      expect(formatRecipeYield(null)).toBeNull();
      expect(formatRecipeYield(undefined)).toBeNull();
      expect(formatRecipeYield('')).toBeNull();
      expect(formatRecipeYield('   ')).toBeNull();
    });
  });
}); 