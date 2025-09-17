import { describe, it, expect } from 'vitest';
import { normalizeName, parseAndNormalizeIngredient } from '../../utils/groceryHelpers';

/**
 * Fuzz test findings - Real-world edge cases discovered through fuzz testing
 * These tests validate the parsing and normalization pipeline on messy, real ingredient strings
 */
describe('normalizeName - Fuzz test findings', () => {
  describe('Real-world edge cases', () => {
    it('handles evoo abbreviation correctly', () => {
      expect(normalizeName('evoo')).toBe('olive oil');
    });


    it('handles complex preparation descriptions', () => {
      const result = parseAndNormalizeIngredient('1-2 tbsp fresh parsley, finely chopped');
      expect(result.name).toBe('fresh parsley');
    });

    it('handles sea salt with taste qualifier', () => {
      const result = parseAndNormalizeIngredient('1/2 tsp. sea salt (or to taste)');
      expect(result.name).toBe('sea salt');
    });

    it('handles pepper with taste qualifier', () => {
      const result = parseAndNormalizeIngredient('1/4 tsp black pepper (or to taste)');
      expect(result.name).toBe('black pepper');
    });

    it('handles ground beef with fat ratio', () => {
      const result = parseAndNormalizeIngredient('1 lb. ground beef (80/20)');
      expect(result.name).toBe('ground beef');
    });

    it('handles grated cheese with preparation note', () => {
      const result = parseAndNormalizeIngredient('1/2 cup grated parmesan cheese');
      expect(result.name).toBe('grated parmesan cheese');
    });

    it('handles shredded cheese', () => {
      const result = parseAndNormalizeIngredient('2 cups shredded mozzarella cheese');
      expect(result.name).toBe('shredded mozzarella cheese');
    });

    it('handles panko breadcrumbs', () => {
      const result = parseAndNormalizeIngredient('1/4 cup panko breadcrumbs');
      expect(result.name).toBe('panko breadcrumb');
    });

    it('handles italian seasoning', () => {
      const result = parseAndNormalizeIngredient('1 tbsp. Italian seasoning');
      expect(result.name).toBe('italian seasoning');
    });

    it('handles red pepper flakes', () => {
      const result = parseAndNormalizeIngredient('1/2 tsp. red pepper flakes');
      expect(result.name).toBe('red pepper flake');
    });

    it('handles fresh parsley with preparation', () => {
      const result = parseAndNormalizeIngredient('1/4 cup fresh parsley, chopped');
      expect(result.name).toBe('fresh parsley');
    });

    it('handles heavy cream', () => {
      const result = parseAndNormalizeIngredient('1/2 cup heavy cream');
      expect(result.name).toBe('heavy cream');
    });

    it('handles white wine', () => {
      const result = parseAndNormalizeIngredient('1/4 cup white wine');
      expect(result.name).toBe('white wine');
    });

    it('handles butter', () => {
      const result = parseAndNormalizeIngredient('2 tbsp. butter');
      expect(result.name).toBe('butter');
    });

    it('handles all-purpose flour', () => {
      const result = parseAndNormalizeIngredient('1 tbsp. all-purpose flour');
      expect(result.name).toBe('all purpose flour');
    });

    it('handles chicken broth', () => {
      const result = parseAndNormalizeIngredient('1/2 cup chicken broth');
      expect(result.name).toBe('chicken broth');
    });

    it('handles half & half', () => {
      const result = parseAndNormalizeIngredient('1/4 cup half & half');
      expect(result.name).toBe('half & half');
    });


    it('handles nutritional yeast', () => {
      expect(normalizeName('nutritional yeast')).toBe('nutritional yeast');
    });

    it('handles garlic powder', () => {
      expect(normalizeName('garlic powder')).toBe('garlic powder');
    });

    it('handles onion powder', () => {
      expect(normalizeName('onion powder')).toBe('onion powder');
    });

    it('handles chicken seasoning', () => {
      expect(normalizeName('chicken seasoning')).toBe('chicken seasoning');
    });

    it('handles vegan chicken stock', () => {
      expect(normalizeName('vegan chicken stock')).toBe('vegan chicken stock');
    });

    it('handles vital wheat gluten', () => {
      expect(normalizeName('vital wheat gluten')).toBe('vital wheat gluten');
    });

    it('handles lemon wedges', () => {
      expect(normalizeName('lemon wedges')).toBe('lemon wedge');
    });

    it('handles carrots with preparation', () => {
      expect(normalizeName('carrots, peeled and chopped')).toBe('carrot');
    });

    it('handles onion with preparation', () => {
      expect(normalizeName('onion, peeled and finely chopped')).toBe('onion');
    });

    it('handles ginger with preparation', () => {
      expect(normalizeName('ginger, peeled and finely chopped')).toBe('ginger');
    });

    it('handles granulated sugar', () => {
      expect(normalizeName('granulated sugar')).toBe('granulated sugar');
    });

    it('handles soy sauce', () => {
      expect(normalizeName('soy sauce')).toBe('soy sauce');
    });

    it('handles rice vinegar', () => {
      expect(normalizeName('rice vinegar')).toBe('rice vinegar');
    });


    // Complex pepper name tests
    it('handles complex pepper names', () => {
      expect(normalizeName('carolina reaper pepper')).toBe('carolina reaper pepper');
    });

    it('handles very long pepper names', () => {
      expect(normalizeName('trinidad moruga scorpion pepper')).toBe('trinidad moruga scorpion pepper');
    });

    it('handles dragon breath peppers', () => {
      expect(normalizeName('dragon breath peppers')).toBe('dragon breath pepper');
    });

    it('handles pepper x peppers', () => {
      expect(normalizeName('pepper x peppers')).toBe('pepper x pepper');
    });

    it('handles chocolate bhutlah peppers', () => {
      expect(normalizeName('chocolate bhutlah peppers')).toBe('chocolate bhutlah pepper');
    });

    it('handles 7 pot primo peppers', () => {
      expect(normalizeName('7 pot primo peppers')).toBe('7 pot primo pepper');
    });

    it('handles moruga scorpion peppers', () => {
      expect(normalizeName('moruga scorpion peppers')).toBe('moruga scorpion pepper');
    });

    it('handles butch t peppers', () => {
      expect(normalizeName('butch t peppers')).toBe('butch t pepper');
    });

    it('handles brain strain peppers', () => {
      expect(normalizeName('brain strain peppers')).toBe('brain strain pepper');
    });

    it('handles douglah peppers', () => {
      expect(normalizeName('douglah peppers')).toBe('douglah pepper');
    });

    it('handles infinity peppers', () => {
      expect(normalizeName('infinity peppers')).toBe('infinity pepper');
    });

    it('handles naga morich peppers', () => {
      expect(normalizeName('naga morich peppers')).toBe('naga morich pepper');
    });

    it('handles red savina peppers', () => {
      expect(normalizeName('red savina peppers')).toBe('red savina pepper');
    });

    it('handles dorset naga peppers', () => {
      expect(normalizeName('dorset naga peppers')).toBe('dorset naga pepper');
    });

    it('handles bhut jolokia peppers', () => {
      expect(normalizeName('bhut jolokia peppers')).toBe('bhut jolokia pepper');
    });

    it('handles trinidad moruga scorpion peppers', () => {
      expect(normalizeName('trinidad moruga scorpion peppers')).toBe('trinidad moruga scorpion pepper');
    });
  });
});
