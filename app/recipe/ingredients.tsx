import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Info as InfoIcon } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';

// --- Define Structured Ingredient Type (matching backend output) ---
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
};
// --- End Define Structured Ingredient Type ---

// --- Helper function for unit abbreviation ---
const abbreviateUnit = (unit: string | null): string | null => {
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
        return 'cup'; // Or keep as 'cup'
    case 'pinch':
    case 'pinches':
        return 'pinch'; // Or keep as 'pinch'
    case 'dash':
    case 'dashes':
        return 'dash'; // Or keep as 'dash'
    // Add more common units as needed
    default:
      return unit; // Return original if no abbreviation found
  }
};
// --- End Helper function ---

// --- Type for data received from OpenAI ---
type ParsedRecipe = {
  title: string | null;
  ingredients: StructuredIngredient[] | null;
  instructions: string[] | null;
  substitutions_text: string | null; 
};
// --- End Type Definition ---

// --- Comment out old types/data ---
/*
type Recipe = { ... };
interface Ingredient { ... };
const SAMPLE_RECIPES: Record<string, Recipe> = { ... };
const adjustIngredientAmount = (...) => { ... };
const approximateFraction = (...) => { ... };
*/
// --- End Comment Out ---

export default function IngredientsScreen() {
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<{ [key: number]: boolean }>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);

  useEffect(() => {
    if (params.recipeData) {
      try {
        console.log("Raw recipeData param:", params.recipeData);
        const recipe = JSON.parse(params.recipeData) as ParsedRecipe;
        console.log("Parsed recipe object in useEffect:", JSON.stringify(recipe, null, 2));
        // Add basic validation for ingredients structure if needed
        if (recipe.ingredients && !Array.isArray(recipe.ingredients)) {
            console.warn("Received ingredients data is not an array, falling back to empty.");
            recipe.ingredients = []; // Fallback or handle appropriately
        } else if (recipe.ingredients && recipe.ingredients.length > 0 && typeof recipe.ingredients[0] === 'string') {
            // Handle potential fallback case where backend sent strings
            console.warn("Received ingredient strings instead of objects. Displaying as strings.");
             // Optionally convert strings to basic objects here if desired
            // recipe.ingredients = (recipe.ingredients as string[]).map(str => ({ name: str, amount: null, unit: null }));
        }
        setParsedRecipe(recipe);
      } catch (e) {
        console.error("Failed to parse recipe data:", e);
        setError("Could not load recipe data.");
      }
    } else {
      setError("Recipe data not provided.");
    }
    setIsLoading(false);
    // Reset checked state when data changes
    setCheckedIngredients({}); 
  }, [params.recipeData]);

  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !parsedRecipe) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <Text style={styles.errorText}>{error || 'Recipe data is unavailable.'}</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const navigateToNextScreen = () => {
    if (parsedRecipe) {
      router.push({
        pathname: '/recipe/steps',
        params: { 
          instructionsData: JSON.stringify(parsedRecipe.instructions || []),
          substitutionsText: parsedRecipe.substitutions_text || ''
        }
      });
    } else {
       console.error("Cannot navigate, parsed recipe data is missing.");
    }
  };
  
  const toggleCheckIngredient = (index: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index] // Toggle the boolean value for the given index
    }));
  };

  const openSubstitutionModal = (ingredient: StructuredIngredient) => {
      console.log("Opening substitution modal for:", JSON.stringify(ingredient)); // Log 1
      setSelectedIngredient(ingredient);
      setSubstitutionModalVisible(true);
  };

  const handleApplySubstitution = (substitution: any) => {
      // TODO: Implement logic to actually apply the substitution if needed
      // For now, just close the modal
      console.log("Applying substitution:", substitution, "for", selectedIngredient?.name);
      setSubstitutionModalVisible(false);
      setSelectedIngredient(null);
  };

  // --- Log before rendering --- 
  console.log("State before render - isLoading:", isLoading);
  console.log("State before render - error:", error);
  console.log("State before render - parsedRecipe ingredients:", JSON.stringify(parsedRecipe?.ingredients, null, 2));
  // --- End log before rendering ---
  
  // --- Log modal state before return ---
  console.log("Modal state before return - selectedIngredient:", selectedIngredient?.name);
  console.log("Modal state before return - substitutionModalVisible:", substitutionModalVisible);
  // --- End log modal state ---

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{parsedRecipe.title || 'Ingredients'}</Text>
        <View style={styles.placeholder} />
      </Animated.View>
      
      <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false}>
        {parsedRecipe.ingredients && parsedRecipe.ingredients.length > 0 ? (
            parsedRecipe.ingredients.map((ingredient, index) => {
              // --- Add logging inside the map --- 
              console.log(`Rendering ingredient ${index}:`, JSON.stringify(ingredient));
              // --- End logging ---
              
              const isChecked = !!checkedIngredients[index]; // Get checked status

              // Check if ingredient is an object (structured) or string (fallback)
              if (typeof ingredient === 'object' && ingredient !== null) {
                // Check if BOTH amount and unit are effectively missing
                const hasQuantity = !!ingredient.amount || !!ingredient.unit;

                return (
                  <TouchableOpacity 
                    key={`ing-${index}`} 
                    style={styles.ingredientItemContainer} 
                    onPress={() => toggleCheckIngredient(index)}
                    activeOpacity={0.7} 
                  >
                    {/* Checkbox Visual */}
                    <View style={[styles.checkboxBase, isChecked && styles.checkboxChecked]}>
                      {isChecked && <View style={styles.checkboxInnerCheck} />}
                    </View>
                    {/* Ingredient Text Container */}
                    <View style={styles.ingredientTextContainer}>
                      {hasQuantity ? (
                        <> 
                          {/* Display amount and unit ONLY if they exist */} 
                          <Text style={[styles.ingredientAmountUnit, isChecked && styles.ingredientTextChecked]}>
                            {String(ingredient.amount ? `${ingredient.amount} ` : '')}
                            {String(ingredient.unit ? `${abbreviateUnit(ingredient.unit)} ` : '')}
                          </Text>
                          <View style={styles.ingredientNameContainer}>
                            <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked]}>
                              {String(ingredient.name)}
                            </Text>
                            <TouchableOpacity 
                              style={styles.infoButton}
                              onPress={() => openSubstitutionModal(ingredient)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <InfoIcon size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        // Render name taking full width if no quantity
                        <View style={styles.ingredientNameContainer}>
                          <Text style={[styles.ingredientNameFullWidth, isChecked && styles.ingredientTextChecked]}>
                            {String(ingredient.name)}
                          </Text>
                          <TouchableOpacity 
                            style={styles.infoButton}
                            onPress={() => openSubstitutionModal(ingredient)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <InfoIcon size={18} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              } else if (typeof ingredient === 'string') {
                 // Fallback display for simple strings (no checkbox for simplicity)
                 return (
                    <View key={`ing-${index}`} style={styles.ingredientItemSimple}>
                        <Text style={styles.ingredientTextSimple}>{`\u2022 ${ingredient}`}</Text>
                    </View>
                 );
              }
              return null; // Should not happen if validation is good
            })
          ) : (
            <Text style={styles.placeholderText}>No ingredients found.</Text>
          )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.nextButton} 
          onPress={navigateToNextScreen}
        >
          <Text style={styles.nextButtonText}>Go to Steps</Text>
          <ChevronRight size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {selectedIngredient && (
        <IngredientSubstitutionModal
          visible={substitutionModalVisible}
          onClose={() => {
            setSubstitutionModalVisible(false);
            setSelectedIngredient(null);
          }}
          ingredientName={selectedIngredient.name}
          onApply={handleApplySubstitution}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: 8, 
  },
  headerTitle: {
    flex: 1, 
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: COLORS.raisinBlack,
    marginHorizontal: 10,
  },
  placeholder: {
    width: 24 + 16,
  },
  ingredientsList: {
     paddingHorizontal: 20,
     paddingTop: 15,
  },
  ingredientItemSimple: {
     marginBottom: 12,
  },
  ingredientTextSimple: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white, 
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.white,
    marginRight: 8,
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.error, 
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonSimple: { 
     marginTop: 15,
     paddingVertical: 10,
     paddingHorizontal: 20,
     backgroundColor: COLORS.lightGray,
     borderRadius: 8,
  },
  backButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
   placeholderText: {
    fontFamily: 'Poppins-Italic',
    fontSize: 14,
    color: COLORS.darkGray,
    marginTop: 5,
    textAlign: 'center',
    paddingVertical: 20, 
  },
  ingredientItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15, 
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  checkboxBase: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxInnerCheck: {
      width: 12,
      height: 12,
      backgroundColor: COLORS.white,
  },
  ingredientTextContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
  },
  ingredientTextChecked: {
      color: COLORS.darkGray,
      textDecorationLine: 'line-through',
  },
  ingredientItemStructured: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  ingredientAmountUnit: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.darkGray,
    lineHeight: 24,
    textAlign: 'right',
    marginRight: 10,
  },
  ingredientNameContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
  },
  ingredientName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    flex: 1,
    marginRight: 8,
  },
  ingredientNameFullWidth: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    flex: 1,
    marginRight: 8,
  },
  infoButton: {
    padding: 4,
  },
});