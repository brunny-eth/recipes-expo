import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';

// --- Define Structured Ingredient Type (matching backend output) ---
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null }> | null;
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
  const [appliedSubstitution, setAppliedSubstitution] = useState<{ originalIndex: number; originalName: string; substitution: { name: string } } | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);

  useEffect(() => {
    if (params.recipeData) {
      try {
        console.log("Raw recipeData param:", params.recipeData);
        // Parse the raw data
        const rawRecipe = JSON.parse(params.recipeData) as ParsedRecipe;
        
        let processedIngredients: StructuredIngredient[] | null = null;

        // Process the ingredients based on their type
        if (rawRecipe.ingredients) {
            if (Array.isArray(rawRecipe.ingredients)) {
                // Now we know it's an array, check the type of its elements
                if (rawRecipe.ingredients.length === 0) {
                    // Handle empty array explicitly
                    processedIngredients = [];
                } else if (typeof rawRecipe.ingredients[0] === 'string') {
                    // TypeScript should now infer rawRecipe.ingredients is string[] here
                    console.warn("Received ingredient strings instead of objects. Mapping to structured.");
                    processedIngredients = rawRecipe.ingredients.map(ingredientNameString => ({ // Renamed parameter from str
                        name: ingredientNameString, // Use renamed parameter
                        amount: null,
                        unit: null,
                        suggested_substitutions: null
                    }));
                } else if (rawRecipe.ingredients.every(item => typeof item === 'object' && item !== null && 'name' in item)) {
                    // Type guard confirms elements are objects with at least a 'name' property
                    // TypeScript *should* infer rawRecipe.ingredients is StructuredIngredient[] here
                    processedIngredients = rawRecipe.ingredients; // Removed explicit cast
                } else {
                    // Mixed array or other invalid format
                    console.warn("Received ingredients data is not a valid array of strings or structured objects. Falling back to empty.");
                    processedIngredients = []; // Fallback to empty array
                }
            } else {
                // It's not an array
                console.warn("Received ingredients data is not an array, falling back to empty.");
                processedIngredients = []; // Fallback to empty array
            }
        } else {
             // Ingredients property was null
             processedIngredients = null;
        }
        
        // Create the final recipe object for state with processed ingredients
        const finalRecipe: ParsedRecipe = {
            ...rawRecipe,
            ingredients: processedIngredients // Assign the correctly typed array/null
        };

        console.log("Processed recipe object in useEffect:", JSON.stringify(finalRecipe, null, 2));
        setParsedRecipe(finalRecipe);
        setAppliedSubstitution(null); // Reset substitutions when recipe data changes
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
  
  const navigateToNextScreen = async () => {
    if (!parsedRecipe) {
      console.error("Cannot navigate, parsed recipe data is missing.");
      return;
    }

    let finalInstructions = parsedRecipe.instructions || [];
    let finalSubstitutionsText = parsedRecipe.substitutions_text || '';

    if (appliedSubstitution) {
      console.log("Applied substitution detected. Attempting to rewrite instructions...");
      setIsRewriting(true);
      try {
        // Get the backend URL (replace with your actual deployed or local URL)
        // IMPORTANT: Replace this with your actual Vercel deployment URL or keep localhost for dev
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'; // Use env var or fallback
        
        const response = await fetch(`${backendUrl}/api/recipes/rewrite-instructions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalInstructions: parsedRecipe.instructions || [],
            originalIngredientName: appliedSubstitution.originalName,
            substitutedIngredientName: appliedSubstitution.substitution.name,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Failed to rewrite instructions (Status: ${response.status})`);
        }

        if (result.rewrittenInstructions && Array.isArray(result.rewrittenInstructions)) {
          console.log("Successfully received rewritten instructions.");
          finalInstructions = result.rewrittenInstructions;
          // Optionally update substitutions text if needed, or clear it?
          // finalSubstitutionsText = "Instructions modified based on substitution."; 
        } else {
          throw new Error("Invalid format received for rewritten instructions.");
        }

      } catch (rewriteError) {
        console.error("Error rewriting instructions:", rewriteError);
        Alert.alert(
            "Rewrite Failed", 
            `Could not automatically adjust instructions for the substitution: ${(rewriteError as Error).message}. Proceeding with original instructions.`
        );
        // Proceed with original instructions on failure
        finalInstructions = parsedRecipe.instructions || []; 
      } finally {
        setIsRewriting(false);
      }
    }

    // Navigate with either original or rewritten instructions
    router.push({
      pathname: '/recipe/steps',
      params: { 
        instructionsData: JSON.stringify(finalInstructions),
        substitutionsText: finalSubstitutionsText, // Pass original or potentially modified text
      }
    });
  };
  
  const toggleCheckIngredient = (index: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index] // Toggle the boolean value for the given index
    }));
  };

  const openSubstitutionModal = (ingredient: StructuredIngredient) => {
      console.log("Opening substitution modal for:", JSON.stringify(ingredient)); 
      setSelectedIngredient(ingredient);
      setSubstitutionModalVisible(true);
  };

  const handleApplySubstitution = (substitution: { name: string }) => {
      if (!selectedIngredient || !parsedRecipe?.ingredients) return;

      // Find the index of the selected ingredient in the current recipe state
      const index = parsedRecipe.ingredients.findIndex(ing => ing.name === selectedIngredient.name);
      if (index === -1) {
          console.error("Could not find selected ingredient index.");
          setSubstitutionModalVisible(false);
          setSelectedIngredient(null);
          return;
      }
      
      console.log(`Applying substitution: ${substitution.name} for ${selectedIngredient.name} at index ${index}`);
      
      // --- Track the substitution ---
      // For now, only allow one substitution. Clear previous if applying a new one.
      setAppliedSubstitution({ 
          originalIndex: index, 
          originalName: selectedIngredient.name, // Store original name
          substitution: { name: substitution.name }
      });
      // --- End Track Substitution ---

      // --- Update UI (Optional - modify ingredient name in list) ---
      // This provides immediate visual feedback
      setParsedRecipe(prevRecipe => {
         if (!prevRecipe || !prevRecipe.ingredients) return prevRecipe;
         const newIngredients = [...prevRecipe.ingredients];
         // Restore original name if a previous substitution existed for this index
         // (This part might need refinement if multiple substitutions are allowed later)
         // For now, let's just update the current one
         newIngredients[index] = {
             ...newIngredients[index],
             name: `${substitution.name} (substituted for ${selectedIngredient.name})` // Modify name for display
         };
         return { ...prevRecipe, ingredients: newIngredients };
      });
      // --- End Update UI ---

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
              const isSubstituted = appliedSubstitution?.originalIndex === index;

              // Check if ingredient is an object (structured) or string (fallback)
              if (typeof ingredient === 'object' && ingredient !== null) {
                // Check if BOTH amount and unit are effectively missing
                const hasQuantity = !!ingredient.amount || !!ingredient.unit;

                return (
                  <TouchableOpacity 
                    key={`ing-${index}`} 
                    style={[styles.ingredientItemContainer, isSubstituted && styles.ingredientItemSubstituted]}
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
                            <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]}>
                              {String(ingredient.name)}
                            </Text>
                            <TouchableOpacity 
                              style={styles.infoButton}
                              onPress={() => openSubstitutionModal(ingredient)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.infoButtonText}>S</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        // Render name taking full width if no quantity
                        <View style={styles.ingredientNameContainer}>
                          <Text style={[styles.ingredientNameFullWidth, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]}>
                            {String(ingredient.name)}
                          </Text>
                          <TouchableOpacity 
                            style={styles.infoButton}
                            onPress={() => openSubstitutionModal(ingredient)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.infoButtonText}>S</Text>
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
          style={[styles.nextButton, isRewriting && styles.nextButtonDisabled]}
          onPress={navigateToNextScreen}
          disabled={isRewriting}
        >
          {isRewriting ? (
             <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }}/>
          ) : null}
          <Text style={styles.nextButtonText}>
              {isRewriting ? 'Adjusting Steps...' : 'Go to Steps'}
          </Text>
          {!isRewriting && <ChevronRight size={20} color={COLORS.white} />}
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
          substitutions={selectedIngredient.suggested_substitutions || null}
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
  nextButtonDisabled: {
      backgroundColor: COLORS.textGray,
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
  ingredientItemSubstituted: {
    backgroundColor: COLORS.primaryLight,
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
  ingredientNameSubstituted: {
    fontStyle: 'italic',
  },
  infoButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.lightGray,
    marginLeft: 5,
  },
  infoButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: COLORS.primary, 
  }
});