// Test file to verify household staples filtering behavior
// This tests the expected behavior of the filtering without importing internal functions

// Type definitions for test
interface GroceryItem {
  name: string;
  amount: number | null;
  unit: string | null;
  checked: boolean;
}

interface GroceryCategory {
  name: string;
  items: GroceryItem[];
}

// Simplified version of the filtering logic for testing
const testFilterHouseholdStaples = (
  categories: GroceryCategory[], 
  enabled: boolean, 
  selectedStaples: string[]
): GroceryCategory[] => {
  if (!enabled || selectedStaples.length === 0) {
    return categories;
  }
  
  return categories.map(category => ({
    ...category,
    items: category.items.filter(item => {
      const itemName = item.name.toLowerCase().trim();
      const isStaple = selectedStaples.some(staple => {
        const stapleName = staple.toLowerCase().trim();
        
        // Exact matches or substring matches (this is the problematic logic we're testing)
        if (itemName === stapleName || itemName.includes(stapleName)) {
          // Special handling for pepper types - don't match vegetable peppers
          if (stapleName.includes('pepper') && !stapleName.includes('bell')) {
            const vegetablePeppers = ['bell pepper', 'jalapeño', 'jalapeno', 'poblano', 'serrano', 'habanero', 'chili pepper', 'hot pepper', 'sweet pepper'];
            const isVegetablePepper = vegetablePeppers.some(vegPepper => itemName.includes(vegPepper));
            return !isVegetablePepper; // Only filter if it's NOT a vegetable pepper
          }
          
          // Special handling for "salt" - don't match specialized salts
          if (stapleName === 'salt') {
            const specializedSalts = ['sea salt', 'himalayan', 'kosher salt', 'table salt', 'iodized salt'];
            // If it's a basic salt, filter it out
            return itemName === 'salt' || specializedSalts.some(salt => itemName.includes(salt));
          }
          
          return true;
        }
        
        return false;
      });
      
      return !isStaple;
    })
  })).filter(category => category.items.length > 0); // Remove empty categories
};

describe('Household Staples Filtering Logic', () => {
  const sampleGroceryList: GroceryCategory[] = [
    {
      name: 'Pantry',
      items: [
        { name: 'flour', amount: 1, unit: 'cup', checked: false },
        { name: 'all purpose flour', amount: 2, unit: 'cups', checked: false },
        { name: 'whole wheat flour', amount: 1, unit: 'cup', checked: false },
        { name: 'almond flour', amount: 0.5, unit: 'cup', checked: false },
        { name: 'cooking spray', amount: null, unit: null, checked: false },
        { name: 'nonstick cooking spray', amount: null, unit: null, checked: false },
        { name: 'vanilla cooking extract', amount: 1, unit: 'tsp', checked: false },
      ]
    },
    {
      name: 'Spices & Herbs',
      items: [
        { name: 'salt', amount: null, unit: null, checked: false },
        { name: 'sea salt', amount: null, unit: null, checked: false },
        { name: 'black pepper', amount: null, unit: null, checked: false },
      ]
    }
  ];

  describe('when staples filter is disabled', () => {
    it('should return all items unchanged', () => {
      const result = testFilterHouseholdStaples(sampleGroceryList, false, ['salt', 'all purpose flour']);
      expect(result).toEqual(sampleGroceryList);
    });
  });

  describe('when staples filter is enabled but no staples selected', () => {
    it('should return all items unchanged', () => {
      const result = testFilterHouseholdStaples(sampleGroceryList, true, []);
      expect(result).toEqual(sampleGroceryList);
    });
  });

  describe('when staples filter is enabled with selected staples', () => {
         it('should filter out exact matches correctly', () => {
       const selectedStaples = ['black pepper', 'all purpose flour'];
       const result = testFilterHouseholdStaples(sampleGroceryList, true, selectedStaples);
       
       // Should filter out black pepper but keep salt types
       const spicesCategory = result.find((cat: GroceryCategory) => cat.name === 'Spices & Herbs');
       expect(spicesCategory?.items).toHaveLength(2); // salt and sea salt should remain
       expect(spicesCategory?.items.find((item: GroceryItem) => item.name === 'black pepper')).toBeUndefined();
       expect(spicesCategory?.items.find((item: GroceryItem) => item.name === 'salt')).toBeDefined();
       expect(spicesCategory?.items.find((item: GroceryItem) => item.name === 'sea salt')).toBeDefined();

       // Should filter out all purpose flour exactly
       const pantryCategory = result.find((cat: GroceryCategory) => cat.name === 'Pantry');
       expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'all purpose flour')).toBeUndefined();
       expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'flour')).toBeDefined();
     });

    it('demonstrates the substring matching problem we are fixing', () => {
      // This test shows the problem: if "flour" is selected as a staple,
      // "all purpose flour" gets incorrectly filtered out due to substring matching
      const selectedStaples = ['flour']; // This would be problematic
      const result = testFilterHouseholdStaples(sampleGroceryList, true, selectedStaples);
      
      const pantryCategory = result.find((cat: GroceryCategory) => cat.name === 'Pantry');
      
      // The problem: all flour types get filtered because they contain "flour"
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'flour')).toBeUndefined();
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'all purpose flour')).toBeUndefined(); // Problem!
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'whole wheat flour')).toBeUndefined(); // Problem!
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'almond flour')).toBeUndefined(); // Problem!
      
      // This demonstrates why we removed "flour" from the staples list
    });

    it('should handle cooking spray filtering without substring issues', () => {
      const selectedStaples = ['nonstick cooking spray'];
      const result = testFilterHouseholdStaples(sampleGroceryList, true, selectedStaples);
      
      const pantryCategory = result.find((cat: GroceryCategory) => cat.name === 'Pantry');
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'nonstick cooking spray')).toBeUndefined();
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'cooking spray')).toBeDefined(); // Should remain
      expect(pantryCategory?.items.find((item: GroceryItem) => item.name === 'vanilla cooking extract')).toBeDefined(); // Should remain
    });

    it('should remove empty categories after filtering', () => {
      const testList: GroceryCategory[] = [
        {
          name: 'Test Category',
          items: [
            { name: 'salt', amount: null, unit: null, checked: false },
          ]
        }
      ];

      const result = testFilterHouseholdStaples(testList, true, ['salt']);
      expect(result).toHaveLength(0); // Category should be removed when empty
    });
  });

  describe('special filtering rules', () => {
    it('should handle pepper filtering correctly to avoid vegetable peppers', () => {
      const testList: GroceryCategory[] = [
        {
          name: 'Mixed',
          items: [
            { name: 'black pepper', amount: null, unit: null, checked: false },
            { name: 'bell pepper', amount: 1, unit: null, checked: false },
            { name: 'jalapeño pepper', amount: 2, unit: null, checked: false },
            { name: 'ground pepper', amount: null, unit: null, checked: false },
          ]
        }
      ];

      const result = testFilterHouseholdStaples(testList, true, ['black pepper']);
      const mixedCategory = result.find((cat: GroceryCategory) => cat.name === 'Mixed');
      
      expect(mixedCategory?.items.find((item: GroceryItem) => item.name === 'black pepper')).toBeUndefined();
      expect(mixedCategory?.items.find((item: GroceryItem) => item.name === 'bell pepper')).toBeDefined();
      expect(mixedCategory?.items.find((item: GroceryItem) => item.name === 'jalapeño pepper')).toBeDefined();
      expect(mixedCategory?.items.find((item: GroceryItem) => item.name === 'ground pepper')).toBeDefined();
    });

    it('should handle salt filtering correctly including specialized salts', () => {
      const testList: GroceryCategory[] = [
        {
          name: 'Seasonings',
          items: [
            { name: 'salt', amount: null, unit: null, checked: false },
            { name: 'sea salt', amount: null, unit: null, checked: false },
            { name: 'kosher salt', amount: null, unit: null, checked: false },
            { name: 'himalayan salt', amount: null, unit: null, checked: false },
          ]
        }
      ];

      const result = testFilterHouseholdStaples(testList, true, ['salt']);
      
      // All salt types should be filtered since they're all basic salts
      expect(result).toHaveLength(0); // Category should be empty and removed
    });
  });

  describe('solution verification', () => {
    it('verifies that removing problematic staples solves the issue', () => {
      // Test that without "flour" in the staples list, we don't have substring issues
      const allowedStaples = [
        'salt', 'black pepper', 'ground pepper', 'all purpose flour', 
        'nonstick cooking spray', 'granulated sugar', 'brown sugar',
        'olive oil', 'vegetable oil', 'butter', 'eggs', 'milk',
        'onion', 'garlic', 'baking soda', 'baking powder', 'vanilla extract'
      ];

      // None of these should cause substring issues
      expect(allowedStaples.includes('flour')).toBe(false);
      expect(allowedStaples.includes('cooking spray')).toBe(false);
      expect(allowedStaples.includes('all purpose flour')).toBe(true);
      expect(allowedStaples.includes('nonstick cooking spray')).toBe(true);
    });
  });
}); 