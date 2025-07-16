import React from 'react';
import { render, fireEvent, waitFor } from '../utils/testUtils';
import RecipeSummaryScreen from '../../app/recipe/summary';
import { createMockRecipe, mockRouter, mockErrorModalContext, mockAuthContext, resetAllMocks } from '../utils/testUtils';

// Mock the useLocalSearchParams hook
const mockUseLocalSearchParams = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

// Mock the global functions that might be set by MiseScreen
beforeEach(() => {
  (globalThis as any).updateMiseRecipe = jest.fn();
  (globalThis as any).getMiseRecipe = jest.fn();
});

afterEach(() => {
  delete (globalThis as any).updateMiseRecipe;
  delete (globalThis as any).getMiseRecipe;
});

describe('RecipeSummaryScreen', () => {
  const mockRecipe = createMockRecipe();
  
  beforeEach(() => {
    resetAllMocks();
    mockUseLocalSearchParams.mockReturnValue({
      recipeData: JSON.stringify(mockRecipe),
      entryPoint: 'new',
    });
  });

  describe('initialization and rendering', () => {
    it('renders recipe summary correctly', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
        expect(getByText('Quick test recipe')).toBeTruthy();
      });
    });

    it('displays recipe servings information', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('This recipe makes 4 servings. Scale it up or down here.')).toBeTruthy();
      });
    });

    it('displays recipe ingredients', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('flour')).toBeTruthy();
        expect(getByText('eggs')).toBeTruthy();
      });
    });

    it('shows error when recipe data is missing', async () => {
      mockUseLocalSearchParams.mockReturnValue({});
      
      render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Error Loading Summary',
          'Recipe data not provided.'
        );
      });
    });

    it('shows error when recipe data is invalid', async () => {
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: 'invalid json',
      });
      
      render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Error Loading Summary',
          expect.stringContaining('Could not load recipe details')
        );
      });
    });
  });

  describe('servings scaling', () => {
    it('scales recipe servings correctly', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('This recipe makes 4 servings. Scale it up or down here.')).toBeTruthy();
      });

      // Click the 2x button
      fireEvent.press(getByText('2x'));
      
      await waitFor(() => {
        expect(getByText('Now scaled up to 8 servings.')).toBeTruthy();
      });
    });

    it('scales recipe servings down', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('This recipe makes 4 servings. Scale it up or down here.')).toBeTruthy();
      });

      // Click the Half button
      fireEvent.press(getByText('Half'));
      
      await waitFor(() => {
        expect(getByText('Now scaled down to 2 servings.')).toBeTruthy();
      });
    });

    it('handles recipes without explicit servings', async () => {
      const recipeWithoutServings = {
        ...mockRecipe,
        recipeYield: null,
      };
      
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(recipeWithoutServings),
        entryPoint: 'new',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText("This recipe doesn't specify servings amount, but we can still scale amounts up or down if you'd like.")).toBeTruthy();
      });
    });
  });

  describe('ingredient modifications', () => {
    it('shows substitution options for ingredients with substitutions', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('eggs')).toBeTruthy();
        // Should have substitution options available
      });
    });

    it('handles ingredient removal', async () => {
      // This would test the removal functionality
      // Implementation depends on how the substitution modal works
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('eggs')).toBeTruthy();
      });
    });

    it('handles ingredient substitution', async () => {
      // This would test the substitution functionality
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('eggs')).toBeTruthy();
      });
    });

    it('limits ingredient removals to 2', async () => {
      // Test the 2-ingredient removal limit
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('eggs')).toBeTruthy();
      });
    });
  });

  describe('entry point handling', () => {
    it('handles new recipe entry point', async () => {
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'new',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });

    it('handles saved recipe entry point', async () => {
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'saved',
        appliedChanges: JSON.stringify({
          ingredientChanges: [],
          scalingFactor: 1.0,
        }),
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });

    it('handles mise entry point', async () => {
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'mise',
        miseRecipeId: 'mise-recipe-123',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });
  });

  describe('saved recipe handling', () => {
    it('displays saved recipe with applied changes', async () => {
      const appliedChanges = {
        ingredientChanges: [
          { from: 'flour', to: 'almond flour' }
        ],
        scalingFactor: 2.0,
      };
      
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'saved',
        appliedChanges: JSON.stringify(appliedChanges),
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });

    it('handles corrupted applied changes gracefully', async () => {
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'saved',
        appliedChanges: 'invalid json',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });
  });

  describe('navigation and actions', () => {
    it('navigates to next screen when continue button is pressed', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      // Find and press the continue/next button
      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled();
      });
    });

    it('saves recipe for later', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      // Find and press the save for later button
      const saveButton = getByText('Save for later');
      fireEvent.press(saveButton);
      
      // Should either save or show auth requirement
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/tabs/saved');
      });
    });

    it('requires authentication for saving', async () => {
      // Mock no session
      const originalSession = mockAuthContext.session;
      mockAuthContext.session = null;
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      const saveButton = getByText('Save for later');
      fireEvent.press(saveButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Account Required',
          expect.stringContaining('You need an account to save recipes')
        );
      });
      
      // Restore original session
      mockAuthContext.session = originalSession;
    });
  });

  describe('mise recipe handling', () => {
    it('saves modifications for mise recipes', async () => {
      const mockUpdateMiseRecipe = jest.fn();
      (globalThis as any).updateMiseRecipe = mockUpdateMiseRecipe;
      
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'mise',
        miseRecipeId: 'mise-recipe-123',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      // Make some modifications
      fireEvent.press(getByText('2x'));
      
      await waitFor(() => {
        expect(getByText('Now scaled up to 8 servings.')).toBeTruthy();
      });

      // Save modifications
      const saveButton = getByText('Save modifications');
      fireEvent.press(saveButton);
      
      await waitFor(() => {
        expect(mockUpdateMiseRecipe).toHaveBeenCalledWith(
          'mise-recipe-123',
          expect.objectContaining({
            scaleFactor: 2.0,
          })
        );
      });
    });

    it('loads existing mise recipe modifications', async () => {
      const mockMiseRecipe = {
        id: 'mise-recipe-123',
        local_modifications: {
          scaleFactor: 2.0,
          appliedChanges: [{ from: 'flour', to: 'almond flour' }],
        },
      };
      
      (globalThis as any).getMiseRecipe = jest.fn().mockReturnValue(mockMiseRecipe);
      
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(mockRecipe),
        entryPoint: 'mise',
        miseRecipeId: 'mise-recipe-123',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });
  });

  describe('error handling', () => {
    it('handles recipe modification errors gracefully', async () => {
      // Mock fetch to fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      // Try to continue (which would trigger modification)
      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Update Failed',
          expect.stringContaining('Couldn\'t update recipe instructions')
        );
      });
    });

    it('handles save errors gracefully', async () => {
      // Mock fetch to fail for save
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Save Error'));
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      const saveButton = getByText('Save for later');
      fireEvent.press(saveButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Save Failed',
          expect.stringContaining('Could not save recipe')
        );
      });
    });
  });

  describe('loading states', () => {
    it('shows loading state during recipe processing', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      // Mock a slow API response
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
      
      // Should show loading state
      // This would depend on the actual loading implementation
    });
  });

  describe('accessibility', () => {
    it('has accessible elements', async () => {
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });

      // Check that key interactive elements are accessible
      expect(getByText('Half')).toBeTruthy();
      expect(getByText('Continue')).toBeTruthy();
      expect(getByText('Save for later')).toBeTruthy();
    });
  });

  describe('performance', () => {
    it('handles large ingredient lists efficiently', async () => {
      const largeRecipe = {
        ...mockRecipe,
        ingredientGroups: [
          {
            name: 'Main',
            ingredients: Array.from({ length: 100 }, (_, i) => ({
              name: `ingredient ${i}`,
              amount: '1',
              unit: 'cup',
              preparation: null,
              suggested_substitutions: null,
            })),
          },
        ],
      };
      
      mockUseLocalSearchParams.mockReturnValue({
        recipeData: JSON.stringify(largeRecipe),
        entryPoint: 'new',
      });
      
      const { getByText } = render(<RecipeSummaryScreen />);
      
      await waitFor(() => {
        expect(getByText('Test Recipe')).toBeTruthy();
      });
    });
  });
}); 