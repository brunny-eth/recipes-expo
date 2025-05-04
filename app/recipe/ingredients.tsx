import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';

// --- Types ---
// Match local type or import if shared
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null }> | null;
};

// Type for data received via navigation params
type IngredientsNavParams = {
    title: string | null;
    originalIngredients: StructuredIngredient[] | string[] | null; 
    scaledIngredients: StructuredIngredient[] | null; // This is what we display primarily
    instructions: string[] | null;
    substitutions_text: string | null;
    originalYield: string | null;
    selectedServings: number;
};
// --- End Types ---

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

// --- Comment out old types/data ---
/*
type Recipe = { ... };
interface Ingredient { ... };
const SAMPLE_RECIPES: Record<string, Recipe> = { ... };
*/
// --- End Comment Out ---

export default function IngredientsScreen() {
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  
  // State for the data received via navigation
  const [navData, setNavData] = useState<IngredientsNavParams | null>(null);
  // State specifically for the ingredients being displayed (initially the scaled ones)
  const [displayIngredients, setDisplayIngredients] = useState<StructuredIngredient[] | null>(null);
  // State to hold the original, unscaled ingredients for scaling instructions
  const [originalIngredientsList, setOriginalIngredientsList] = useState<StructuredIngredient[] | string[] | null>(null);
  // State for servings
  const [originalServings, setOriginalServings] = useState<number | null>(null);
  const [selectedServings, setSelectedServings] = useState<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<{ [key: number]: boolean }>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [appliedSubstitution, setAppliedSubstitution] = useState<{ originalIndex: number; originalName: string; substitution: { name: string } } | null>(null);
  const [isRewriting, setIsRewriting] = useState(false); // For substitution rewrite
  const [isScalingInstructions, setIsScalingInstructions] = useState(false); // For scaling instructions

  useEffect(() => {
    setIsLoading(true); 
    if (params.recipeData) {
      try {
        console.log("[IngredientsScreen] Raw recipeData param:", params.recipeData);
        const parsedNavData = JSON.parse(params.recipeData) as IngredientsNavParams;
        // --- Log #1: Check parsed data --- 
        console.log("[IngredientsScreen] Parsed Nav Data:", JSON.stringify(parsedNavData, null, 2)); 
        setNavData(parsedNavData);

        // --- Process and set state from navData --- 
        const ingredientsForDisplay = parsedNavData.scaledIngredients || []; 
        // --- Log #2: Check data before setting state --- 
        console.log("[IngredientsScreen] Ingredients for display (before setState):", JSON.stringify(ingredientsForDisplay, null, 2));
        setDisplayIngredients(ingredientsForDisplay); 

        // Store original ingredients separately
        setOriginalIngredientsList(parsedNavData.originalIngredients); 

        // Store servings
        const originalServingsNum = parseInt(parsedNavData.originalYield || '1', 10);
        setOriginalServings(!isNaN(originalServingsNum) && originalServingsNum > 0 ? originalServingsNum : 1);
        setSelectedServings(parsedNavData.selectedServings); 

        // Reset other states
        setAppliedSubstitution(null); 
        setCheckedIngredients({}); 
        setError(null);
      } catch (e) {
        console.error("Failed to parse recipe data:", e);
        setError("Could not load recipe data.");
        setNavData(null); // Clear data on error
        setDisplayIngredients(null);
        setOriginalIngredientsList(null);
      }
    } else {
      setError("Recipe data not provided.");
    }
    setIsLoading(false); 
  }, [params.recipeData]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !navData) {
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
    if (!navData || !displayIngredients) { // Check navData and displayIngredients
      console.error("Cannot navigate, essential data is missing.");
      return;
    }

    let finalInstructions = navData.instructions || [];
    let finalSubstitutionsText = navData.substitutions_text || '';
    const needsScaling = originalServings !== null && selectedServings !== null && originalServings !== selectedServings;

    // --- 1. Handle Substitution Rewriting (if applicable) --- 
    if (appliedSubstitution) {
      console.log("Applied substitution detected. Rewriting instructions...");
      setIsRewriting(true);
      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${backendUrl}/api/recipes/rewrite-instructions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalInstructions: navData.instructions || [], // Use initial instructions from navData
            originalIngredientName: appliedSubstitution.originalName,
            substitutedIngredientName: appliedSubstitution.substitution.name,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Rewrite failed (Status: ${response.status})`);
        if (result.rewrittenInstructions) finalInstructions = result.rewrittenInstructions;
        else throw new Error("Invalid format for rewritten instructions.");
      } catch (rewriteError) {
        console.error("Error rewriting instructions:", rewriteError);
        Alert.alert("Rewrite Failed", `Could not adjust instructions for substitution. Proceeding with previous version.`);
        // Keep instructions as they were before the failed rewrite attempt
      } finally {
        setIsRewriting(false);
      }
    }

    // --- 2. Handle Instruction Scaling (if applicable) --- 
    if (needsScaling && originalIngredientsList) {
        console.log(`Servings changed (${originalServings} -> ${selectedServings}). Scaling instructions...`);
        setIsScalingInstructions(true);
        try {
            const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/recipes/scale-instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instructionsToScale: finalInstructions, // Use potentially rewritten instructions
                    originalIngredients: originalIngredientsList, // Pass the stored original list
                    scaledIngredients: displayIngredients, // Pass the current (scaled) list
                }),
            });
            const result = await response.json();
             if (!response.ok) throw new Error(result.error || `Scaling failed (Status: ${response.status})`);
             if (result.scaledInstructions) {
                 finalInstructions = result.scaledInstructions; // Update with scaled instructions
                 console.log("Successfully scaled instructions.");
             } else throw new Error("Invalid format for scaled instructions.");
        } catch (scalingError) {
            console.error("Error scaling instructions:", scalingError);
            Alert.alert("Instruction Scaling Failed", `Could not automatically scale instruction quantities. Proceeding with unscaled quantities in text.`);
             // Proceed with the instructions we have (potentially rewritten but not scaled)
        } finally {
            setIsScalingInstructions(false);
        }
    }

    // --- 3. Navigate to Steps Screen --- 
    router.push({
      pathname: '/recipe/steps',
      params: { 
        instructionsData: JSON.stringify(finalInstructions), // Pass final (rewritten and/or scaled) instructions
        substitutionsText: finalSubstitutionsText, 
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
      // --- Update UI to use displayIngredients state --- 
      if (!selectedIngredient || !displayIngredients) return;
      const index = displayIngredients.findIndex(ing => ing.name === selectedIngredient.name);
      if (index === -1) { /* ... error handling ... */ return; }
      
      console.log(`Applying substitution: ${substitution.name} for ${selectedIngredient.name} at index ${index}`);
      
      // Store original name before modifying display name
      const originalNameForSub = displayIngredients[index].name.includes('(substituted for') 
          ? displayIngredients[index].name.substring(displayIngredients[index].name.indexOf('(substituted for') + 17, displayIngredients[index].name.length - 1)
          : displayIngredients[index].name;

      setAppliedSubstitution({ 
          originalIndex: index, 
          originalName: originalNameForSub, // Use the actual original name
          substitution: { name: substitution.name }
      });

      setDisplayIngredients(prevIngredients => {
         if (!prevIngredients) return prevIngredients;
         const newIngredients = [...prevIngredients];
         newIngredients[index] = {
             ...newIngredients[index],
             // Make sure name modification references the correct original name
             name: `${substitution.name} (substituted for ${originalNameForSub})` 
         };
         return newIngredients;
      });
      // --- End Update UI --- 

      setSubstitutionModalVisible(false);
      setSelectedIngredient(null);
  };

  // --- RENDER LOGIC --- 
  // --- Log #3: Check state right before render --- 
  console.log("[IngredientsScreen] displayIngredients state before render:", JSON.stringify(displayIngredients, null, 2));

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{navData?.title || 'Ingredients'}</Text>
        <View style={styles.placeholder} />
      </Animated.View>
      
      <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false}>
        {displayIngredients && displayIngredients.length > 0 ? (
            displayIngredients.map((ingredient, index) => {
              // Checkbox logic using checkedIngredients[index]
              const isChecked = !!checkedIngredients[index];
              // Substitution styling
              const isSubstituted = appliedSubstitution?.originalIndex === index;
              // Check if quantity exists
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
                        <Text style={[styles.ingredientAmountUnit, isChecked && styles.ingredientTextChecked]}>
                          {String(ingredient.amount ? `${ingredient.amount} ` : '')}
                          {String(ingredient.unit ? `${abbreviateUnit(ingredient.unit)} ` : '')}
                        </Text>
                        <View style={styles.ingredientNameContainer}>
                          <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]}>
                            {String(ingredient.name)}
                          </Text>
                          {/* Substitution Button */} 
                          {ingredient.suggested_substitutions && ingredient.suggested_substitutions.length > 0 && (
                            <TouchableOpacity 
                              style={styles.infoButton}
                              onPress={() => openSubstitutionModal(ingredient)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.infoButtonText}>S</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    ) : (
                      <View style={styles.ingredientNameContainer}>
                        <Text style={[styles.ingredientNameFullWidth, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]}>
                          {String(ingredient.name)}
                        </Text>
                         {/* Substitution Button */} 
                         {ingredient.suggested_substitutions && ingredient.suggested_substitutions.length > 0 && (
                          <TouchableOpacity 
                            style={styles.infoButton}
                            onPress={() => openSubstitutionModal(ingredient)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.infoButtonText}>S</Text>
                          </TouchableOpacity>
                         )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.placeholderText}>No ingredients found.</Text>
          )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, (isRewriting || isScalingInstructions) && styles.nextButtonDisabled]}
          onPress={navigateToNextScreen}
          disabled={isRewriting || isScalingInstructions} // Disable if either process is running
        >
          {(isRewriting || isScalingInstructions) && (
             <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }}/>
          )}
          <Text style={styles.nextButtonText}>
              {isRewriting ? 'Adjusting Steps...' : isScalingInstructions ? 'Scaling Steps...' : 'Go to Steps'}
          </Text>
          {!(isRewriting || isScalingInstructions) && <ChevronRight size={20} color={COLORS.white} />}
        </TouchableOpacity>
      </View>

      {selectedIngredient && (
        <IngredientSubstitutionModal
          visible={substitutionModalVisible}
          onClose={() => {
            setSubstitutionModalVisible(false);
            setSelectedIngredient(null);
          }}
          ingredientName={selectedIngredient.name} // Use name from selectedIngredient state
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
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: COLORS.raisinBlack,
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
      backgroundColor: COLORS.darkGray, // Or another disabled color
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
    alignItems: 'flex-start',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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