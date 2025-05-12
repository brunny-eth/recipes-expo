import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import IngredientsScreen from './ingredients'; // Adjust path if needed
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native'; // Import StyleSheet for style checks
// Explicitly import matcher type to help TypeScript
import type {} from '@testing-library/jest-native/extend-expect';

// --- Types (Mirror from component) ---
// It's good practice to keep types consistent or import them if possible
type SubstitutionSuggestion = {
  name: string;
  description?: string | null;
  amount?: string | number | null;
  unit?: string | null;
};

type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: SubstitutionSuggestion[] | null;
};

type IngredientsNavParams = {
  title: string | null;
  originalIngredients: StructuredIngredient[] | string[] | null;
  scaledIngredients: StructuredIngredient[] | null;
  instructions: string[] | null;
  substitutions_text: string | null;
  originalYield: string | null;
  selectedServings: number;
};
// --- End Types ---

// --- Mocking Hooks Directly --- 
// Tell Jest to mock the entire module
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  // Provide mocks for any other exports if needed by the component
}));

// Type cast the imported hooks to Jest mock functions
const mockUseRouter = useRouter as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

// Mock data for the test
const mockRecipeData: IngredientsNavParams = {
  title: 'Test Recipe Title',
  originalIngredients: [
    { name: 'Flour', amount: '2', unit: 'cup' },
    { name: 'Sugar', amount: '1', unit: 'cup' },
  ],
  scaledIngredients: [
    { name: 'Flour', amount: '2', unit: 'cup', suggested_substitutions: [{ name: 'Almond Flour', amount: '2', unit: 'cup' }] },
    { name: 'Sugar', amount: '1', unit: 'cup', suggested_substitutions: null },
    { name: 'Salt', amount: '1', unit: 'tsp', suggested_substitutions: null }, // Ingredient without subs
    { name: 'Vanilla Extract', amount: null, unit: 'to taste', suggested_substitutions: [{ name: 'Almond Extract'}] } // Ingredient without amount
  ],
  instructions: ['Mix ingredients', 'Bake at 350'],
  substitutions_text: null,
  originalYield: '4',
  selectedServings: 4, // Keep scale factor 1 for simplicity initially
};

// --- Mock IngredientSubstitutionModal --- 
jest.mock('./IngredientSubstitutionModal', () => {
  // Move imports INSIDE the factory function
  const React = require('react');
  const { View, TouchableOpacity, Text: RNText } = require('react-native');
  // We need the formatter and abbreviator inside the mock
  const { formatMeasurement } = require('@/utils/format');

  // Define props type for the mock modal (can stay outside if preferred, or move in)
  interface MockModalProps {
    visible: boolean;
    onClose: () => void;
    ingredientName: string;
    substitutions: any[] | null; // Using any[] for simplicity in mock
    onApply: (selectedOption: any) => void; // Using any for simplicity in mock
  }

  // Mock component that renders props and allows interaction
  const MockModal: React.FC<MockModalProps> = ({ 
      visible, 
      onClose, 
      ingredientName, 
      substitutions, 
      onApply 
  }) => {
    if (!visible) {
      return null;
    }
    const firstSub = substitutions && substitutions[0];
    // Format the amount/unit for display similar to the main component
    const formattedAmount = firstSub?.amount ? formatMeasurement(parseFloat(firstSub.amount.toString())) : '';
    const unitDisplay = firstSub?.unit || ''; // Directly use the unit
    const displayText = `${firstSub?.name || ''}${formattedAmount || unitDisplay ? ` (${formattedAmount}${unitDisplay ? ` ${unitDisplay}` : ''})` : ''}`;

    return (
      <View testID="mock-substitution-modal">
        <RNText>Substitute {ingredientName}</RNText>
        {firstSub && (
          <TouchableOpacity
            testID={`substitution-option-${firstSub.name}`}
            onPress={() => onApply(firstSub)}
          >
            {/* <RNText>{`${firstSub.name} (Amount: ${firstSub.amount}, Unit: ${firstSub.unit})`}</RNText> */}
            <RNText>{displayText}</RNText> { /* Use the formatted display text */ }
          </TouchableOpacity>
        )}
        <TouchableOpacity testID="modal-close-button" onPress={onClose}>
          <RNText>Close</RNText>
        </TouchableOpacity>
      </View>
    );
  };
  return MockModal;
});
// --- End Mock --- 

// Add checked style for comparison
const checkedStyle = StyleSheet.create({
  checked: {
    textDecorationLine: 'line-through',
    color: '#666666', // Use the actual color value from the component style
  }
}).checked;

describe('<IngredientsScreen />', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock implementations for the hooks for this test suite
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
    });
    mockUseLocalSearchParams.mockReturnValue({
      recipeData: JSON.stringify(mockRecipeData),
    });
  });

  it('renders recipe title and ingredients correctly', async () => {
    render(<IngredientsScreen />);

    // Wait for state updates triggered by useEffect
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    // Check title
    expect(screen.getByText('Test Recipe Title')).toBeOnTheScreen();

    // Check for specific ingredients with formatted amounts
    expect(screen.getByText(/Flour.*\(2\s*⅛\s*cup\)/)).toBeOnTheScreen();
    expect(screen.getByText(/Sugar.*\(1\s*⅛\s*cup\)/)).toBeOnTheScreen();
    expect(screen.getByText(/Salt.*\(1\s*⅛\s*tsp\)/)).toBeOnTheScreen();
    expect(screen.getByText(/Vanilla Extract.*\(\s*to taste\)/)).toBeOnTheScreen();

    // Check that the substitution button IS present for Flour
    expect(screen.getByTestId(`substitution-button-Flour`)).toBeTruthy(); // Assumes you add testID="substitution-button-${ingredient.name}" to the button

    // Check that the substitution button is NOT present for Salt
    expect(screen.queryByTestId(`substitution-button-Salt`)).toBeNull();

  });

  it('toggles ingredient check state on press', async () => {
    render(<IngredientsScreen />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    const flourCheckbox = screen.getByTestId('checkbox-Flour'); // Assuming testID="checkbox-${ingredient.name}"
    const flourTextElement = screen.getByText(/Flour.*\(2\s*⅛\s*cup\)/); // Match formatted text

    // Initial state: not checked (no specific style assertion here, just presence)
    expect(flourTextElement).toBeOnTheScreen();

    // 2. Press the checkbox
    fireEvent.press(flourCheckbox);

    // 3. After press: Should be checked
    // Re-find the element if necessary, though usually not needed
    expect(await screen.findByText(/Flour.*\(2\s*⅛\s*cup\)/)).toHaveStyle(checkedStyle);

    // 4. Press again
    fireEvent.press(flourCheckbox);

    // 5. After second press: Should be unchecked again
    expect(await screen.findByText(/Flour.*\(2\s*⅛\s*cup\)/)).not.toHaveStyle(checkedStyle);
  });

  it('applies substitution correctly', async () => {
    render(<IngredientsScreen />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    // 1. Open the modal
    const subButton = screen.getByTestId('substitution-button-Flour');
    fireEvent.press(subButton);

    // Wait for modal to become visible and find the TouchableOpacity for the option
    const modalOptionTouchable = await screen.findByTestId('substitution-option-Almond Flour');
    expect(modalOptionTouchable).toBeOnTheScreen();
    // Optional: Verify the text content within the touchable if needed
    expect(screen.getByText('Almond Flour (2 ⅛ cup)')).toBeOnTheScreen(); 

    // 2. Apply the substitution by pressing the TouchableOpacity
    fireEvent.press(modalOptionTouchable); 

    // 3. Check that the ingredient list updates
    // Wait for the state where the NEW text is present AND the OLD checkbox is absent
    await waitFor(() => {
      // Check for the new text first (throws error if not found)
      expect(screen.getByText(/Almond Flour \(substituted for Flour\).*\(2\s*⅛\s*cup\)/)).toBeOnTheScreen();
      // Then check that the old checkbox is gone
      expect(screen.queryByTestId('checkbox-Flour')).toBeNull(); 
    });

    // Assertions outside waitFor are less critical now, but confirm final state
    // expect(screen.queryByText(/Flour.*\(2\s*⅛\s*cup\)/)).toBeNull(); // Already confirmed in waitFor

    // Check that the substitution button is gone for the substituted item
    expect(screen.queryByTestId('substitution-button-Almond Flour (substituted for Flour)')).toBeNull();
  });

  // Add more tests: navigation, error states, edge cases for formatting, etc.
});

// --- Helper Function to add testID to substitution button (MODIFY INGREDIENTS.TSX) ---
/*
In app/recipe/ingredients.tsx, modify the substitution button TouchableOpacity:

<TouchableOpacity 
  style={styles.infoButton}
  onPress={() => openSubstitutionModal(ingredient)}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  testID={`substitution-button-${ingredient.name}`} // <-- ADD THIS
>
  <Text style={styles.infoButtonText}>S</Text>
</TouchableOpacity>

*/ 