import React from 'react';
import { render, fireEvent, waitFor } from '../utils/testUtils';
import HomeScreen from '../../app/tabs/index';
import { 
  mockRouter, 
  mockErrorModalContext, 
  mockAuthContext, 
  mockFreeUsageContext,
  resetAllMocks,
  createMockRecipe
} from '../utils/testUtils';

// Mock the recipe submission hook
const mockSubmitRecipe = jest.fn();
const mockClearState = jest.fn();

jest.mock('../../hooks/useRecipeSubmission', () => ({
  useRecipeSubmission: () => ({
    submitRecipe: mockSubmitRecipe,
    isSubmitting: false,
    submissionState: 'idle',
    clearState: mockClearState,
  }),
}));

// Mock the detectInputType function
jest.mock('../../server/utils/detectInputType', () => ({
  detectInputType: jest.fn((input: string) => {
    if (input.startsWith('http')) return 'url';
    if (input.includes('youtube.com') || input.includes('tiktok.com')) return 'video';
    if (input.trim().length > 0) return 'raw_text';
    return 'invalid';
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    resetAllMocks();
    mockSubmitRecipe.mockClear();
    mockClearState.mockClear();
    
    // Reset auth context
    mockAuthContext.session = {
      user: { id: 'test-user-id' },
      access_token: 'test-token',
    };
    
    // Reset free usage context
    mockFreeUsageContext.hasUsedFreeRecipe = false;
  });

  describe('initialization and rendering', () => {
    it('renders home screen correctly', async () => {
      const { getByText } = render(<HomeScreen />);
      
      expect(getByText('Home base for home cooks')).toBeTruthy();
      expect(getByText('Meez clears clutter so you can make meals')).toBeTruthy();
    });

    it('displays logo and branding', async () => {
      const { getByText } = render(<HomeScreen />);
      
      expect(getByText('Home base for home cooks')).toBeTruthy();
      expect(getByText('Swap out ingredients, save recipes, and plan across multiple dishes')).toBeTruthy();
    });

    it('shows input field with placeholder', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        expect(getByPlaceholderText('What do you want to cook today?')).toBeTruthy();
      });
    });

    it('shows submit button', async () => {
      const { getByText } = render(<HomeScreen />);
      
      expect(getByText('Go')).toBeTruthy();
    });
  });

  describe('input handling', () => {
    it('accepts text input', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
        expect(input.props.value).toBe('chicken soup');
      });
    });

    it('accepts URL input', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'https://example.com/recipe');
        expect(input.props.value).toBe('https://example.com/recipe');
      });
    });

    it('shows different placeholder after focus', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent(input, 'focus');
        
        // After focus, placeholder should change
        // This depends on the placeholder animation logic
      });
    });

    it('handles input blur', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent(input, 'focus');
        fireEvent(input, 'blur');
        
        // Should handle blur event appropriately
      });
    });
  });

  describe('recipe submission', () => {
    it('submits recipe when form is submitted', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_summary',
        recipe: createMockRecipe(),
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockSubmitRecipe).toHaveBeenCalledWith('chicken soup');
      });
    });

    it('navigates to summary on successful submission', async () => {
      const mockRecipe = createMockRecipe();
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_summary',
        recipe: mockRecipe,
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/recipe/summary',
          params: {
            recipeData: JSON.stringify(mockRecipe),
            entryPoint: 'new',
            from: '/tabs',
          },
        });
      });
    });

    it('navigates to loading on successful URL submission', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_loading',
        normalizedUrl: 'https://example.com/recipe',
        inputType: 'url',
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'https://example.com/recipe');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/loading',
          params: {
            recipeUrl: 'https://example.com/recipe',
            inputType: 'url',
          },
        });
      });
    });

    it('shows match modal when multiple matches found', async () => {
      const mockMatches = [
        { recipe: createMockRecipe(), similarity: 0.9 },
        { recipe: createMockRecipe({ title: 'Another Recipe' }), similarity: 0.8 },
      ];

      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'show_match_modal',
        matches: mockMatches,
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'pasta');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        // Should show match selection modal
        // This depends on the modal implementation
      });
    });

    it('handles submission errors gracefully', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: false,
        action: 'show_validation_error',
        error: 'Invalid recipe input',
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'invalid input');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Validation Error',
          'Invalid recipe input'
        );
      });
    });

    it('clears input after successful submission', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_summary',
        recipe: createMockRecipe(),
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        expect(input.props.value).toBe('');
      });
    });
  });

  describe('input validation', () => {
    it('shows error for empty input', async () => {
      const { getByText } = render(<HomeScreen />);
      
      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Input Required',
          expect.stringContaining('Add a recipe link or dish name')
        );
      });
    });

    it('validates input format', async () => {
      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'not a valid input');
      });

      // Mock detectInputType to return invalid
      const { detectInputType } = require('../../server/utils/detectInputType');
      detectInputType.mockReturnValue('invalid');

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Input Not Recognized',
          expect.stringContaining('Please enter a real dish name or recipe link')
        );
      });
    });

    it('accepts valid recipe names', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_summary',
        recipe: createMockRecipe(),
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockSubmitRecipe).toHaveBeenCalledWith('chicken soup');
      });
    });

    it('accepts valid URLs', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_loading',
        normalizedUrl: 'https://example.com/recipe',
        inputType: 'url',
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'https://example.com/recipe');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockSubmitRecipe).toHaveBeenCalledWith('https://example.com/recipe');
      });
    });
  });

  describe('authentication handling', () => {
    it('handles authenticated users', async () => {
      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_summary',
        recipe: createMockRecipe(),
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockSubmitRecipe).toHaveBeenCalled();
      });
    });

    it('handles unauthenticated users with free usage', async () => {
      mockAuthContext.session = null;
      mockFreeUsageContext.hasUsedFreeRecipe = false;

      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'navigate_to_summary',
        recipe: createMockRecipe(),
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockSubmitRecipe).toHaveBeenCalled();
      });
    });

    it('redirects to login when free usage is exhausted', async () => {
      mockAuthContext.session = null;
      mockFreeUsageContext.hasUsedFreeRecipe = true;

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Login Required',
          expect.stringContaining("You've already used your free recipe")
        );
      });
    });
  });

  describe('match selection modal', () => {
    it('handles recipe selection from modal', async () => {
      const mockMatches = [
        { recipe: createMockRecipe({ id: 1 }), similarity: 0.9 },
        { recipe: createMockRecipe({ id: 2, title: 'Another Recipe' }), similarity: 0.8 },
      ];

      mockSubmitRecipe.mockResolvedValue({
        success: true,
        action: 'show_match_modal',
        matches: mockMatches,
      });

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'pasta');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      // This would test the modal interaction
      // Implementation depends on the modal component
    });

    it('handles create new recipe option', async () => {
      // This would test the create new recipe flow
      // Implementation depends on the modal component
    });

    it('handles return to home option', async () => {
      // This would test the return to home flow
      // Implementation depends on the modal component
    });
  });

  describe('loading states', () => {
    it('shows loading state during submission', async () => {
      // Mock the hook to return loading state
      const mockUseRecipeSubmission = require('../../hooks/useRecipeSubmission').useRecipeSubmission;
      mockUseRecipeSubmission.mockReturnValue({
        submitRecipe: mockSubmitRecipe,
        isSubmitting: true,
        submissionState: 'validating',
        clearState: mockClearState,
      });

      const { getByText } = render(<HomeScreen />);
      
      const submitButton = getByText('Go');
      expect(submitButton).toBeDisabled();
    });

    it('shows different loading states', async () => {
      const states = ['validating', 'checking_cache', 'parsing', 'navigating'];
      
      for (const state of states) {
        const mockUseRecipeSubmission = require('../../hooks/useRecipeSubmission').useRecipeSubmission;
        mockUseRecipeSubmission.mockReturnValue({
          submitRecipe: mockSubmitRecipe,
          isSubmitting: true,
          submissionState: state,
          clearState: mockClearState,
        });

        const { getByText } = render(<HomeScreen />);
        
        // Should show appropriate loading indicator
        // This depends on the actual loading state implementation
      }
    });
  });

  describe('accessibility', () => {
    it('has accessible input field', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        expect(input).toBeTruthy();
      });
    });

    it('has accessible submit button', async () => {
      const { getByText } = render(<HomeScreen />);
      
      const submitButton = getByText('Go');
      expect(submitButton).toBeTruthy();
    });

    it('handles keyboard navigation', async () => {
      const { getByPlaceholderText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
        fireEvent(input, 'submitEditing');
        
        // Should submit when Enter is pressed
        expect(mockSubmitRecipe).toHaveBeenCalledWith('chicken soup');
      });
    });
  });

  describe('error handling', () => {
    it('handles network errors', async () => {
      mockSubmitRecipe.mockRejectedValue(new Error('Network error'));

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalledWith(
          'Recipe Submission Failed',
          expect.stringContaining('Something went wrong while submitting your recipe')
        );
      });
    });

    it('handles submission hook errors', async () => {
      mockSubmitRecipe.mockRejectedValue(new Error('Submission hook error'));

      const { getByPlaceholderText, getByText } = render(<HomeScreen />);
      
      await waitFor(() => {
        const input = getByPlaceholderText('What do you want to cook today?');
        fireEvent.changeText(input, 'chicken soup');
      });

      const submitButton = getByText('Go');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockErrorModalContext.showError).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    it('clears state when leaving screen', async () => {
      const { unmount } = render(<HomeScreen />);
      
      unmount();
      
      // Should call clearState on unmount
      expect(mockClearState).toHaveBeenCalled();
    });
  });
}); 