import { describe, it, expect } from 'vitest';
import { parseIngredientString } from '../../utils/ingredientHelpers';

describe('parseIngredientString', () => {
  describe('Compound unit parsing', () => {
    it('parses "4 14-ounce cans white beans" correctly', () => {
      const result = parseIngredientString('4 14-ounce cans white beans');
      expect(result.amount).toBe('4');
      expect(result.unit).toBe('14-oz can');
      expect(result.name).toBe('white beans');
      expect(result.parsedAmount).toBe(4);
    });

    it('parses "2 15-ounce cans black beans" correctly', () => {
      const result = parseIngredientString('2 15-ounce cans black beans');
      expect(result.amount).toBe('2');
      expect(result.unit).toBe('15-oz can');
      expect(result.name).toBe('black beans');
      expect(result.parsedAmount).toBe(2);
    });

    it('parses "3 16-ounce jars salsa" correctly', () => {
      const result = parseIngredientString('3 16-ounce jars salsa');
      expect(result.amount).toBe('3');
      expect(result.unit).toBe('16-oz jar');
      expect(result.name).toBe('salsa');
      expect(result.parsedAmount).toBe(3);
    });

    it('parses "1 28-ounce can crushed tomatoes" correctly', () => {
      const result = parseIngredientString('1 28-ounce can crushed tomatoes');
      expect(result.amount).toBe('1');
      expect(result.unit).toBe('28-oz can');
      expect(result.name).toBe('crushed tomatoes');
      expect(result.parsedAmount).toBe(1);
    });

    it('parses "2 32-ounce containers chicken broth" correctly', () => {
      const result = parseIngredientString('2 32-ounce containers chicken broth');
      expect(result.amount).toBe('2');
      expect(result.unit).toBe('32-oz container');
      expect(result.name).toBe('chicken broth');
      expect(result.parsedAmount).toBe(2);
    });
  });

  describe('Standard unit parsing', () => {
    it('parses "2 cups flour" correctly', () => {
      const result = parseIngredientString('2 cups flour');
      expect(result.amount).toBe('2');
      expect(result.unit).toBe('cup');
      expect(result.name).toBe('flour');
      expect(result.parsedAmount).toBe(2);
    });

    it('parses "1 tbsp olive oil" correctly', () => {
      const result = parseIngredientString('1 tbsp olive oil');
      expect(result.amount).toBe('1');
      expect(result.unit).toBe('tbsp');
      expect(result.name).toBe('olive oil');
      expect(result.parsedAmount).toBe(1);
    });

    it('parses "3 lbs chicken breast" correctly', () => {
      const result = parseIngredientString('3 lbs chicken breast');
      expect(result.amount).toBe('3');
      expect(result.unit).toBe('lb');
      expect(result.name).toBe('chicken breast');
      expect(result.parsedAmount).toBe(3);
    });
  });

  describe('Preparation parsing', () => {
    it('parses preparation from comma-separated text', () => {
      const result = parseIngredientString('2 cups onions, diced');
      expect(result.amount).toBe('2');
      expect(result.unit).toBe('cup');
      expect(result.name).toBe('onions');
      expect(result.preparation).toBe('diced');
      expect(result.parsedAmount).toBe(2);
    });

    it('parses preparation from parenthetical text', () => {
      const result = parseIngredientString('1 lb ground beef (85% lean)');
      expect(result.amount).toBe('1');
      expect(result.unit).toBe('lb');
      expect(result.name).toBe('ground beef');
      expect(result.preparation).toBe('85% lean');
      expect(result.parsedAmount).toBe(1);
    });
  });

  describe('Complex ingredient patterns', () => {
    it('handles ingredients with "or" alternatives', () => {
      const result = parseIngredientString('2 lbs chicken breasts or thighs');
      expect(result.amount).toBe('2');
      expect(result.unit).toBe('lb');
      expect(result.name).toBe('chicken breasts or thighs');
      expect(result.parsedAmount).toBe(2);
    });

    it('handles fractional amounts', () => {
      const result = parseIngredientString('1/2 cup sugar');
      expect(result.amount).toBe('1/2');
      expect(result.unit).toBe('cup');
      expect(result.name).toBe('sugar');
      expect(result.parsedAmount).toBe(0.5);
    });

    it('handles mixed number amounts', () => {
      const result = parseIngredientString('1 1/2 cups flour');
      expect(result.amount).toBe('1 1/2');
      expect(result.unit).toBe('cup');
      expect(result.name).toBe('flour');
      expect(result.parsedAmount).toBe(1.5);
    });
  });

  describe('Edge cases', () => {
    it('handles ingredients without amounts', () => {
      const result = parseIngredientString('salt to taste');
      expect(result.amount).toBe(null);
      expect(result.unit).toBe(null);
      expect(result.name).toBe('salt to taste'); // The parsing doesn't separate "to taste" as preparation in this case
      expect(result.preparation).toBe(null);
      expect(result.parsedAmount).toBe(null);
    });

    it('handles empty string', () => {
      const result = parseIngredientString('');
      expect(result.amount).toBe(null);
      expect(result.unit).toBe(null);
      expect(result.name).toBe('');
      expect(result.preparation).toBe(null);
      expect(result.parsedAmount).toBe(null);
    });

    it('handles ingredient names only', () => {
      const result = parseIngredientString('fresh parsley');
      expect(result.amount).toBe(null);
      expect(result.unit).toBe(null);
      expect(result.name).toBe('fresh parsley');
      expect(result.preparation).toBe(null);
      expect(result.parsedAmount).toBe(null);
    });
  });
});
