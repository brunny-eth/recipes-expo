import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import IngredientsScreen from './ingredients'; // Adjust path if needed
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native'; // Import StyleSheet for style checks

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

// Mock IngredientSubstitutionModal to prevent rendering its complexity
jest.mock('./IngredientSubstitutionModal', () => 'IngredientSubstitutionModal');

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
    // Check for the title
    expect(await screen.findByText('Test Recipe Title')).toBeTruthy();

    // Check for ingredients based on scaledIngredients
    expect(await screen.findByText(/Flour.*\(2 cup\)/)).toBeTruthy(); 
    expect(await screen.findByText(/Sugar.*\(1 cup\)/)).toBeTruthy();
    expect(await screen.findByText(/Salt.*\(1 tsp\)/)).toBeTruthy();
    expect(await screen.findByText(/Vanilla Extract.*\(\s*to taste\s*\)/)).toBeTruthy(); 

    // Check for the substitution button ("S") near Flour
    // Use findByText which handles async rendering
    const flourRow = await screen.findByText(/Flour.*\(2 cup\)/);
    // Check within the row for the 'S' button - adjust query based on actual structure if needed
    expect(screen.getByTestId(`substitution-button-Flour`)).toBeTruthy(); // Assumes you add testID="substitution-button-${ingredient.name}" to the button

    // Check that the substitution button is NOT present for Salt
    expect(screen.queryByTestId(`substitution-button-Salt`)).toBeNull();

  });

  it('toggles ingredient check state on press', async () => {
    render(<IngredientsScreen />);

    // Find the checkbox and text for 'Flour'
    const flourCheckbox = await screen.findByTestId('checkbox-Flour');
    const flourText = await screen.findByText(/Flour.*\(2 cup\)/);

    // 1. Initial state: Not checked
    // Check that the combined Text element does not have the line-through style
    expect(flourText).not.toHaveStyle(checkedStyle); 
    // Check the visual checkbox View itself doesn't contain the inner checkmark initially
    // This might require a more specific query depending on checkbox implementation details
    // For now, focusing on the text style change is often sufficient.

    // 2. Press the checkbox
    fireEvent.press(flourCheckbox);

    // 3. After press: Should be checked
    // Re-find the element if necessary, though usually not needed
    expect(await screen.findByText(/Flour.*\(2 cup\)/)).toHaveStyle(checkedStyle);

    // 4. Press again
    fireEvent.press(flourCheckbox);

    // 5. After second press: Should be unchecked again
    expect(await screen.findByText(/Flour.*\(2 cup\)/)).not.toHaveStyle(checkedStyle);
  });

  // Add more tests here for interactions (checking items, substitutions, navigation)

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