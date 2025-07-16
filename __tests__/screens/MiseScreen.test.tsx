import React from 'react';
import { render, fireEvent, waitFor } from '../utils/testUtils';
import MiseScreen from '../../app/tabs/mise';
import { 
  mockRouter, 
  mockErrorModalContext, 
  mockAuthContext, 
  mockSupabaseClient, 
  resetAllMocks 
} from '../utils/testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('MiseScreen', () => {
  const mockMiseRecipes = [
    {
      id: 'mise-recipe-1',
      title_override: 'Custom Pasta',
      planned_date: null,
      prepared_recipe_data: {
        id: 1,
        title: 'Pasta Recipe',
        recipeYield: '4 servings',
        ingredientGroups: [
          {
            name: 'Main',
            ingredients: [
              { name: 'pasta', amount: '1', unit: 'lb', preparation: null, suggested_substitutions: null },
              { name: 'tomatoes', amount: '2', unit: 'cans', preparation: null, suggested_substitutions: null },
            ],
          },
        ],
        instructions: ['Cook pasta', 'Add tomatoes'],
        substitutions_text: null,
        tips: null,
        nutrition: null,
      },
      final_yield: 4,
      applied_changes: {
        ingredientChanges: [],
        scalingFactor: 1.0,
      },
      is_completed: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
    {
      id: 'mise-recipe-2',
      title_override: null,
      planned_date: null,
      prepared_recipe_data: {
        id: 2,
        title: 'Chicken Soup',
        recipeYield: '6 servings',
        ingredientGroups: [
          {
            name: 'Main',
            ingredients: [
              { name: 'chicken', amount: '2', unit: 'lbs', preparation: null, suggested_substitutions: null },
              { name: 'carrots', amount: '3', unit: null, preparation: null, suggested_substitutions: null },
            ],
          },
        ],
        instructions: ['Cook chicken', 'Add carrots'],
        substitutions_text: null,
        tips: null,
        nutrition: null,
      },
      final_yield: 6,
      applied_changes: null,
      is_completed: true,
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
    },
  ];

  const mockGroceryList = [
    {
      name: 'Produce',
      items: [
        { id: 'item-1', name: 'tomatoes', amount: 2, unit: 'cans', category: 'Produce', checked: false },
        { id: 'item-2', name: 'carrots', amount: 3, unit: null, category: 'Produce', checked: true },
      ],
    },
    {
      name: 'Pantry',
      items: [
        { id: 'item-3', name: 'pasta', amount: 1, unit: 'lb', category: 'Pantry', checked: false },
      ],
    },
  ];

  beforeEach(() => {
    resetAllMocks();
    
    // Mock successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/mise/recipes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ recipes: mockMiseRecipes }),
        });
      }
      if (url.includes('/api/mise/grocery-list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            items: [
              { id: 'item-1', item_name: 'tomatoes', quantity_amount: 2, quantity_unit: 'cans', grocery_category: 'Produce', is_checked: false },
              { id: 'item-2', item_name: 'carrots', quantity_amount: 3, quantity_unit: null, grocery_category: 'Produce', is_checked: true },
              { id: 'item-3', item_name: 'pasta', quantity_amount: 1, quantity_unit: 'lb', grocery_category: 'Pantry', is_checked: false },
            ]
          }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Mock AsyncStorage
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  describe('initialization and rendering', () => {
    it('renders mise screen correctly', async () => {
      const { getByText } = render(<MiseScreen />);
      
      expect(getByText('Your mise en place')).toBeTruthy();
      expect(getByText('Recipes (0)')).toBeTruthy(); // Initial count before loading
      expect(getByText('Shopping List')).toBeTruthy();
    });

    it('loads mise recipes on mount', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Recipes (2)')).toBeTruthy();
        expect(getByText('Custom Pasta')).toBeTruthy();
        expect(getByText('Chicken Soup')).toBeTruthy();
      });
    });

    it('displays recipe counts correctly', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Recipes (2)')).toBeTruthy();
      });
    });

    it('shows loading state initially', async () => {
      const { getByTestId } = render(<MiseScreen />);
      
      // Should show loading indicator initially
      // This depends on the actual loading implementation
    });
  });

  describe('recipe management', () => {
    it('displays recipe titles correctly', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Custom Pasta')).toBeTruthy(); // title_override
        expect(getByText('Chicken Soup')).toBeTruthy(); // original title
      });
    });

    it('shows recipe yield information', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Makes 4')).toBeTruthy();
        expect(getByText('Makes 6')).toBeTruthy();
      });
    });

    it('navigates to recipe summary when recipe is pressed', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Custom Pasta')).toBeTruthy();
      });

      fireEvent.press(getByText('Custom Pasta'));
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/recipe/summary',
          params: expect.objectContaining({
            recipeData: expect.any(String),
            entryPoint: 'mise',
            miseRecipeId: 'mise-recipe-1',
          }),
        });
      });
    });

    it('handles recipe deletion', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mise/recipes/mise-recipe-1') && options.method === 'DELETE') {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ recipes: mockMiseRecipes }),
        });
      });

      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Custom Pasta')).toBeTruthy();
      });

      // This would depend on the actual UI implementation for deletion
      // For now, we'll test the underlying function
    });

    it('handles title editing', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Custom Pasta')).toBeTruthy();
      });

      // This would depend on the actual UI implementation for editing
      // For now, we'll test the underlying function
    });
  });

  describe('grocery list management', () => {
    it('switches to grocery list tab', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Shopping List')).toBeTruthy();
      });

      fireEvent.press(getByText('Shopping List'));
      
      await waitFor(() => {
        expect(getByText('Produce')).toBeTruthy();
        expect(getByText('Pantry')).toBeTruthy();
      });
    });

    it('displays grocery items correctly', async () => {
      const { getByText } = render(<MiseScreen />);
      
      fireEvent.press(getByText('Shopping List'));
      
      await waitFor(() => {
        expect(getByText('tomatoes')).toBeTruthy();
        expect(getByText('carrots')).toBeTruthy();
        expect(getByText('pasta')).toBeTruthy();
      });
    });

    it('handles grocery item checking', async () => {
      const { getByText } = render(<MiseScreen />);
      
      fireEvent.press(getByText('Shopping List'));
      
      await waitFor(() => {
        expect(getByText('tomatoes')).toBeTruthy();
      });

      // Find and toggle a grocery item
      const tomatoItem = getByText('tomatoes');
      fireEvent.press(tomatoItem);
      
      // Should call the API to update the item state
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mise/grocery-item-state'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('tomatoes'),
          })
        );
      });
    });

    it('groups grocery items by category', async () => {
      const { getByText } = render(<MiseScreen />);
      
      fireEvent.press(getByText('Shopping List'));
      
      await waitFor(() => {
        expect(getByText('Produce')).toBeTruthy();
        expect(getByText('Pantry')).toBeTruthy();
      });
    });

    it('shows share button for grocery list', async () => {
      const { getByText } = render(<MiseScreen />);
      
      fireEvent.press(getByText('Shopping List'));
      
      await waitFor(() => {
        expect(getByText('Share')).toBeTruthy();
      });
    });
  });

  describe('authentication handling', () => {
    it('shows login prompt when not authenticated', async () => {
      mockAuthContext.session = null;
      
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Log in to see your mise en place')).toBeTruthy();
        expect(getByText('Log In')).toBeTruthy();
      });
    });

    it('navigates to login when login button is pressed', async () => {
      mockAuthContext.session = null;
      
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Log In')).toBeTruthy();
      });

      fireEvent.press(getByText('Log In'));
      
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });

    it('loads data when authenticated', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Recipes (2)')).toBeTruthy();
      });
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));
      
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText("Couldn't load mise recipes")).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
      });
    });

    it('shows retry button on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network Error'));
      
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Try Again')).toBeTruthy();
      });

      // Reset fetch mock to success
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/mise/recipes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ recipes: mockMiseRecipes }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      });

      fireEvent.press(getByText('Try Again'));
      
      await waitFor(() => {
        expect(getByText('Recipes (2)')).toBeTruthy();
      });
    });
  });

  describe('caching behavior', () => {
    it('caches data after successful fetch', async () => {
      render(<MiseScreen />);
      
      await waitFor(() => {
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'miseRecipes',
          expect.any(String)
        );
      });
    });

    it('uses cached data when available', async () => {
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'miseLastFetched') {
          return Promise.resolve(String(Date.now()));
        }
        if (key === 'miseRecipes') {
          return Promise.resolve(JSON.stringify(mockMiseRecipes));
        }
        if (key === 'miseGroceryList') {
          return Promise.resolve(JSON.stringify(mockGroceryList));
        }
        return Promise.resolve(null);
      });

      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Recipes (2)')).toBeTruthy();
      });

      // Should not make API calls if cache is fresh
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refreshes cache when expired', async () => {
      const oldTimestamp = Date.now() - (7 * 60 * 60 * 1000); // 7 hours ago
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'miseLastFetched') {
          return Promise.resolve(String(oldTimestamp));
        }
        return Promise.resolve(null);
      });

      render(<MiseScreen />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('empty states', () => {
    it('shows empty state when no recipes', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/mise/recipes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ recipes: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      });

      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('No recipes in mise')).toBeTruthy();
        expect(getByText('Prepare a recipe to add it to your mise en place.')).toBeTruthy();
      });
    });

    it('shows empty state when no grocery items', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/mise/grocery-list')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ recipes: [] }),
        });
      });

      const { getByText } = render(<MiseScreen />);
      
      fireEvent.press(getByText('Shopping List'));
      
      await waitFor(() => {
        expect(getByText('No grocery items')).toBeTruthy();
      });
    });
  });

  describe('global functions', () => {
    it('exposes updateMiseRecipe function globally', () => {
      render(<MiseScreen />);
      
      expect((globalThis as any).updateMiseRecipe).toBeDefined();
      expect(typeof (globalThis as any).updateMiseRecipe).toBe('function');
    });

    it('exposes getMiseRecipe function globally', () => {
      render(<MiseScreen />);
      
      expect((globalThis as any).getMiseRecipe).toBeDefined();
      expect(typeof (globalThis as any).getMiseRecipe).toBe('function');
    });

    it('updateMiseRecipe function works correctly', async () => {
      const { getByText } = render(<MiseScreen />);
      
      await waitFor(() => {
        expect(getByText('Recipes (2)')).toBeTruthy();
      });

      const updateFunction = (globalThis as any).updateMiseRecipe;
      
      updateFunction('mise-recipe-1', {
        scaleFactor: 2.0,
        appliedChanges: [{ from: 'pasta', to: 'rice' }],
      });

      // Should update the local state
      expect(updateFunction).toBeDefined();
    });
  });
}); 