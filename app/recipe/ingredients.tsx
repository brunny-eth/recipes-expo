import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform, Alert, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, X } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';
import { StructuredIngredient, SubstitutionSuggestion } from '@/api/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatMeasurement } from '@/utils/format';
import { coerceToStructuredIngredients } from '@/utils/ingredientHelpers';
import { getScaledYieldText, scaleIngredient, parseAmountString, formatAmountNumber } from '@/utils/recipeUtils';

// --- Types ---
// Added SubstitutionSuggestion type matching backend/modal

// Type for data received via navigation params
type IngredientsNavParams = {
    title: string | null;
    originalIngredients: StructuredIngredient[] | string[] | null; 
    scaledIngredients: StructuredIngredient[] | null;
    instructions: string[] | null;
    substitutions_text: string | null;
    originalYieldDisplay: string | null; // Renamed from originalYield, and it's the display string
    scaleFactor: number; // Added
    // Optional fields (ensure they are handled if not present)
    prepTime?: string | null;
    cookTime?: string | null;
    totalTime?: string | null;
    nutrition?: { [key: string]: any; } | null;
};
// --- End Types ---

// --- Helper function for unit abbreviation (kept for display) ---
export const abbreviateUnit = (unit: string | null): string | null => {
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
  
  const [navData, setNavData] = useState<IngredientsNavParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<{ [key: number]: boolean }>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [appliedSubstitution, setAppliedSubstitution] = useState<{
     originalIndex: number; 
     originalName: string; 
     substitution: SubstitutionSuggestion
  } | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isScalingInstructions, setIsScalingInstructions] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [selectedIngredientOriginalData, setSelectedIngredientOriginalData] = useState<StructuredIngredient | null>(null);
  const [processedSubstitutionsForModal, setProcessedSubstitutionsForModal] = useState<SubstitutionSuggestion[] | null>(null);

  // Use useMemo for displayIngredients calculation
  const displayIngredients = useMemo(() => {
    if (!navData) return null;

    const scale = navData.scaleFactor || 1;
    const usingOriginal = navData.scaleFactor === 1 || !navData.scaledIngredients;

    const source = usingOriginal
      ? navData.originalIngredients
      : navData.scaledIngredients;

    if (!source) return null;

    const structured = coerceToStructuredIngredients(source);
    // Only scale if using original
    return usingOriginal
      ? structured.map(i => scaleIngredient(i, scale))
      : structured;
  }, [navData]);

  useEffect(() => {
    const showTip = async () => {
      const hasSeenTip = await AsyncStorage.getItem('hasSeenTip');
      if (!hasSeenTip) {
        const timer = setTimeout(() => {
          setIsHelpModalVisible(true);
          AsyncStorage.setItem('hasSeenTip', 'true');
        }, 500);
        return () => clearTimeout(timer);
      }
    };
    showTip();
  }, []);

  useEffect(() => {
    setIsLoading(true); 
    if (params.recipeData) {
      try {
        console.log("[IngredientsScreen] Raw recipeData param:", params.recipeData);
        const parsedNavData = JSON.parse(params.recipeData) as IngredientsNavParams;
        console.log("[IngredientsScreen] Parsed Nav Data:", JSON.stringify(parsedNavData, null, 2)); 
        setNavData(parsedNavData);
        setAppliedSubstitution(null); 
        setCheckedIngredients({}); 
        setError(null);
      } catch (e) {
        console.error("Failed to parse recipe data:", e);
        setError("Could not load recipe data.");
        setNavData(null); 
      }
    } else {
      setError("Recipe data not provided.");
    }
    setIsLoading(false); 
  }, [params.recipeData]);

  const navigateToNextScreen = useCallback(async () => {
    if (!navData || !displayIngredients) { 
      console.error("Cannot navigate, essential data is missing.");
      return;
    }

    let finalInstructions = navData.instructions || [];
    let finalSubstitutionsText = navData.substitutions_text || '';
    const needsScaling = navData.scaleFactor !== 1;

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
            originalInstructions: navData.instructions || [],
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
      } finally {
        setIsRewriting(false);
      }
    }

    // --- 2. Handle Instruction Scaling (if applicable) --- 
    if (needsScaling && displayIngredients.length > 0) {
        console.log(`Scaling instructions for ${navData.scaleFactor}x of "${navData.originalYieldDisplay || 'original recipe'}"...`);
        setIsScalingInstructions(true);
        try {
            const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/recipes/scale-instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instructionsToScale: finalInstructions,
                    originalIngredients: navData.originalIngredients,
                    scaledIngredients: displayIngredients,
                }),
            });
            const result = await response.json();
             if (!response.ok) throw new Error(result.error || `Scaling failed (Status: ${response.status})`);
             if (result.scaledInstructions) {
                 finalInstructions = result.scaledInstructions;
                 console.log("Successfully scaled instructions.");
             } else throw new Error("Invalid format for scaled instructions.");
        } catch (scalingError) {
            console.error("Error scaling instructions:", scalingError);
            Alert.alert("Instruction Scaling Failed", `Could not automatically scale instruction quantities. Proceeding with unscaled quantities in text.`);
        } finally {
            setIsScalingInstructions(false);
        }
    }

    // --- 3. Navigate to Steps Screen --- 
    router.push({
      pathname: '/recipe/steps',
      params: {
        recipeData: JSON.stringify({
          title: navData.title,
          instructions: finalInstructions,
          substitutions_text: finalSubstitutionsText,
          recipeYield: getScaledYieldText(navData.originalYieldDisplay, navData.scaleFactor),
          prepTime: navData.prepTime,
          cookTime: navData.cookTime,
          totalTime: navData.totalTime,
          nutrition: navData.nutrition
        })
      }
    });
  }, [navData, displayIngredients, appliedSubstitution, router]);

  const toggleCheckIngredient = (index: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index] // Toggle the boolean value for the given index
    }));
  };

  const openSubstitutionModal = (ingredient: StructuredIngredient) => {
      console.log("Opening substitution modal for:", JSON.stringify(ingredient)); 
      
      // --- Scaling Logic --- 
      let scaledSuggestions: SubstitutionSuggestion[] | null = null;
      if (ingredient.suggested_substitutions && navData && navData.scaleFactor !== null && navData.scaleFactor !== 1) {
           const scalingFactor = navData.scaleFactor;
           console.log(`Scaling substitutions by factor: ${scalingFactor} (Selected: ${navData.scaleFactor}, Original: 1)`);

           scaledSuggestions = ingredient.suggested_substitutions.map(sub => {
               let finalAmount: string | number | null = sub.amount ?? null;

               // Use parseAmountString for consistent handling of amounts
               if (sub.amount != null) {
                   try {
                       const parsedAmount = parseAmountString(String(sub.amount));
                       if (parsedAmount !== null) {
                           const calculatedAmount = parsedAmount * scalingFactor;
                           finalAmount = formatAmountNumber(calculatedAmount) || calculatedAmount.toFixed(2);
                           console.log(`Scaled ${sub.name} amount from ${sub.amount} to ${finalAmount}`);
                       } else {
                           // Keep original non-numeric amount if parsing fails
                           finalAmount = sub.amount;
                           console.log(`Kept original non-numeric amount: ${sub.amount} for ${sub.name}`);
                       }
                   } catch (e) {
                       console.error("Error scaling substitution amount:", e);
                       finalAmount = sub.amount; // Fallback to original if scaling fails
                   }
               } else {
                   console.log(`Amount was null or undefined for ${sub.name}, keeping as null.`);
                   finalAmount = null;
               }

               return {
                   ...sub,
                   amount: finalAmount
               };
           });
      } else {
          // Use original suggestions if no scaling is needed/possible
          scaledSuggestions = ingredient.suggested_substitutions || null;
          if (navData && navData.scaleFactor === null || navData && navData.scaleFactor === 1) {
             console.log("Skipping substitution scaling: Invalid scale factor data.");
          } else {
             console.log("No substitutions found to scale.");
          }
      }
      // --- End Scaling Logic --- 

      setSelectedIngredientOriginalData(ingredient); // Store the original data
      setProcessedSubstitutionsForModal(scaledSuggestions); // Store the scaled suggestions for the modal
      setSubstitutionModalVisible(true);
  };

  const handleApplySubstitution = (substitution: SubstitutionSuggestion) => {
    if (!selectedIngredientOriginalData || !displayIngredients) { 
      console.error("Apply error: Missing original ingredient data or display list.");
      return;
    }

    const originalIngredientNameFromState = selectedIngredientOriginalData.name;
    console.log(`Attempting to find index for: "${originalIngredientNameFromState}"`);
    
    const index = displayIngredients.findIndex(ing => 
      ing.name === originalIngredientNameFromState || 
      ing.name.includes(`(substituted for ${originalIngredientNameFromState})`)
    );

    console.log(`Found index: ${index}`);

    if (index === -1) { 
      console.error(`Apply error: Cannot find ingredient matching "${originalIngredientNameFromState}" in display list.`);
      console.log("Current displayIngredients names:", displayIngredients.map(i => i.name));
      return;
    }
    
    const currentDisplayName = displayIngredients[index].name;
    let originalNameForSub = selectedIngredientOriginalData.name;
    if (currentDisplayName.includes('(substituted for')) {
      const match = currentDisplayName.match(/\(substituted for (.*?)\)/);
      if (match && match[1]) {
        originalNameForSub = match[1];
      }
    }

    console.log(`Applying substitution: ${substitution.name} (Amount: ${substitution.amount}, Unit: ${substitution.unit}) for original ${originalNameForSub} at index ${index}`);
    
    setAppliedSubstitution({ 
      originalIndex: index, 
      originalName: originalNameForSub,
      substitution: substitution
    });

    // Update navData with the substituted ingredient
    setNavData(prevNavData => {
      if (!prevNavData) return prevNavData;
      
      const newNavData = { ...prevNavData };
      const source = newNavData.scaleFactor === 1 ? newNavData.originalIngredients : newNavData.scaledIngredients;
      
      if (Array.isArray(source)) {
        const newSource = source.map((item, i) => {
          if (i === index) {
            // Convert string to StructuredIngredient if needed
            const baseIngredient = typeof item === 'string' 
              ? { name: item, amount: null, unit: null, suggested_substitutions: null }
              : item;
            
            return {
              ...baseIngredient,
              name: `${substitution.name} (substituted for ${originalNameForSub})`,
              amount: substitution.amount != null ? String(substitution.amount) : null,
              unit: substitution.unit || null,
              suggested_substitutions: null
            };
          }
          return item;
        });
        
        if (newNavData.scaleFactor === 1) {
          // For originalIngredients, we need to maintain the same type as input
          newNavData.originalIngredients = newSource as typeof newNavData.originalIngredients;
        } else {
          // For scaledIngredients, we know it's always StructuredIngredient[]
          newNavData.scaledIngredients = newSource as StructuredIngredient[];
        }
      }
      
      return newNavData;
    });

    setSubstitutionModalVisible(false);
    setSelectedIngredientOriginalData(null);
    setProcessedSubstitutionsForModal(null);
  };

  // --- RENDER LOGIC --- 
  // --- Log #3: Check state right before render --- 
  console.log("[IngredientsScreen] displayIngredients state before render:", JSON.stringify(displayIngredients, null, 2));

  // --- Conditional Rendering (SHOULD BE AFTER ALL HOOKS) ---
  if (isLoading) {
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
          {navData && navData.scaleFactor !== 1 && (
            <View style={styles.scaleInfoBanner}>
              <Text style={styles.scaleInfoText}>
                {`Showing ingredients for: ${getScaledYieldText(navData.originalYieldDisplay, navData.scaleFactor)}`}
              </Text>
            </View>
          )}

          {displayIngredients && displayIngredients.length > 0 ? (
              displayIngredients.map((ingredient, index) => {
                const isChecked = !!checkedIngredients[index];
                // Check if this specific ingredient is the one that was substituted
                const isSubstituted = appliedSubstitution?.originalIndex === index;
                
                return (
                  <TouchableOpacity 
                    key={`ing-${index}`} 
                    style={[styles.ingredientItemContainer, isSubstituted && styles.ingredientItemSubstituted]}
                    onPress={() => toggleCheckIngredient(index)}
                    activeOpacity={0.7} 
                  >
                    {/* Checkbox Visual */}
                    <View 
                      style={[styles.checkboxBase, isChecked && styles.checkboxChecked]}
                      testID={`checkbox-${ingredient.name}`}
                    >
                      {isChecked && <View style={styles.checkboxInnerCheck} />}
                    </View>
                    
                    {/* Ingredient Text Container - Using combined structure */}
                    <View style={styles.ingredientNameContainer}> 
                      {/* Combined Text Element */}
                      <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]} numberOfLines={0}> 
                        {/* Display Name (already includes substitution info if applied) */}
                        {String(ingredient.name)}
                        {/* Display Quantity/Unit */}
                        {(ingredient.amount || ingredient.unit) && (
                          <Text style={styles.ingredientQuantityParenthetical}>
                            {` (${ingredient.amount || ''}${ingredient.unit ? ` ${abbreviateUnit(ingredient.unit)}` : ''})`}
                          </Text>
                        )}
                      </Text>

                      {/* Substitution Button - Show only if NOT already substituted */}
                      {!isSubstituted && 
                       ingredient.suggested_substitutions && 
                       ingredient.suggested_substitutions.length > 0 && 
                       ingredient.suggested_substitutions.some(sub => sub && sub.name != null) && (
                        <TouchableOpacity 
                          style={styles.infoButton}
                          onPress={() => openSubstitutionModal(ingredient)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          testID={`substitution-button-${ingredient.name}`}
                        >
                          <Text style={styles.infoButtonText}>S</Text>
                        </TouchableOpacity>
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
          <Pressable 
            style={[
              styles.nextButton, 
              (isRewriting || isScalingInstructions) && styles.nextButtonDisabled
            ]}
            onPress={navigateToNextScreen}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={isRewriting || isScalingInstructions}
          >
            {(isRewriting || isScalingInstructions) && (
              <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }}/>
            )}
            <Text style={styles.nextButtonText}>
              {isRewriting ? 'Adjusting Steps...' : isScalingInstructions ? 'Scaling Steps...' : 'Go to Steps'}
            </Text>
            {!(isRewriting || isScalingInstructions) && <ChevronRight size={20} color={COLORS.white} />}
          </Pressable>
        </View>

        {/* Substitution Modal - Pass processed suggestions */}
        {selectedIngredientOriginalData && (
          <IngredientSubstitutionModal
            visible={substitutionModalVisible}
            onClose={() => {
              setSubstitutionModalVisible(false);
              setSelectedIngredientOriginalData(null); // Clear original data state
              setProcessedSubstitutionsForModal(null); // Clear processed suggestions
            }}
            ingredientName={selectedIngredientOriginalData.name} // Use name from original data
            substitutions={processedSubstitutionsForModal} // Pass the scaled suggestions
            onApply={handleApplySubstitution}
          />
        )}

        {/* Help Modal */}
        <Modal
          visible={isHelpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsHelpModalVisible(false)} // For Android back button
        >
          <Pressable 
            style={styles.helpModalBackdrop} 
            onPress={() => setIsHelpModalVisible(false)} // Dismiss on backdrop press
          >
            <Pressable style={styles.helpModalContent} onPress={() => {}}> 
              {/* Prevent backdrop press from triggering through content */}
              <Text style={styles.helpModalText}>
                Tip: substitute out an ingredient in the recipe by clicking the S next to the ingredient name. The recipe will adjust accordingly!
              </Text>
              <TouchableOpacity 
                style={styles.helpModalCloseButton} 
                onPress={() => setIsHelpModalVisible(false)}
              >
                <X size={20} color={COLORS.textDark} />
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

      </SafeAreaView>
    );
  }

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
        {navData && navData.scaleFactor !== 1 && (
          <View style={styles.scaleInfoBanner}>
            <Text style={styles.scaleInfoText}>
              {`Showing ingredients for: ${getScaledYieldText(navData.originalYieldDisplay, navData.scaleFactor)}`}
            </Text>
          </View>
        )}

        {displayIngredients && displayIngredients.length > 0 ? (
            displayIngredients.map((ingredient, index) => {
              const isChecked = !!checkedIngredients[index];
              // Check if this specific ingredient is the one that was substituted
              const isSubstituted = appliedSubstitution?.originalIndex === index;
              
              return (
                <TouchableOpacity 
                  key={`ing-${index}`} 
                  style={[styles.ingredientItemContainer, isSubstituted && styles.ingredientItemSubstituted]}
                  onPress={() => toggleCheckIngredient(index)}
                  activeOpacity={0.7} 
                >
                  {/* Checkbox Visual */}
                  <View 
                    style={[styles.checkboxBase, isChecked && styles.checkboxChecked]}
                    testID={`checkbox-${ingredient.name}`}
                  >
                    {isChecked && <View style={styles.checkboxInnerCheck} />}
                  </View>
                  
                  {/* Ingredient Text Container - Using combined structure */}
                  <View style={styles.ingredientNameContainer}> 
                    {/* Combined Text Element */}
                    <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]} numberOfLines={0}> 
                      {/* Display Name (already includes substitution info if applied) */}
                      {String(ingredient.name)}
                      {/* Display Quantity/Unit */}
                      {(ingredient.amount || ingredient.unit) && (
                        <Text style={styles.ingredientQuantityParenthetical}>
                          {` (${ingredient.amount || ''}${ingredient.unit ? ` ${abbreviateUnit(ingredient.unit)}` : ''})`}
                        </Text>
                      )}
                    </Text>

                    {/* Substitution Button - Show only if NOT already substituted */}
                    {!isSubstituted && 
                     ingredient.suggested_substitutions && 
                     ingredient.suggested_substitutions.length > 0 && 
                     ingredient.suggested_substitutions.some(sub => sub && sub.name != null) && (
                      <TouchableOpacity 
                        style={styles.infoButton}
                        onPress={() => openSubstitutionModal(ingredient)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        testID={`substitution-button-${ingredient.name}`}
                      >
                        <Text style={styles.infoButtonText}>S</Text>
                      </TouchableOpacity>
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
        <Pressable 
          style={[
            styles.nextButton, 
            (isRewriting || isScalingInstructions) && styles.nextButtonDisabled
          ]}
          onPress={navigateToNextScreen}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={isRewriting || isScalingInstructions}
        >
          {(isRewriting || isScalingInstructions) && (
            <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }}/>
          )}
          <Text style={styles.nextButtonText}>
            {isRewriting ? 'Adjusting Steps...' : isScalingInstructions ? 'Scaling Steps...' : 'Go to Steps'}
          </Text>
          {!(isRewriting || isScalingInstructions) && <ChevronRight size={20} color={COLORS.white} />}
        </Pressable>
      </View>

      {/* Substitution Modal - Pass processed suggestions */}
      {selectedIngredientOriginalData && (
        <IngredientSubstitutionModal
          visible={substitutionModalVisible}
          onClose={() => {
            setSubstitutionModalVisible(false);
            setSelectedIngredientOriginalData(null); // Clear original data state
            setProcessedSubstitutionsForModal(null); // Clear processed suggestions
          }}
          ingredientName={selectedIngredientOriginalData.name} // Use name from original data
          substitutions={processedSubstitutionsForModal} // Pass the scaled suggestions
          onApply={handleApplySubstitution}
        />
      )}

      {/* Help Modal */}
      <Modal
        visible={isHelpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHelpModalVisible(false)} // For Android back button
      >
        <Pressable 
          style={styles.helpModalBackdrop} 
          onPress={() => setIsHelpModalVisible(false)} // Dismiss on backdrop press
        >
          <Pressable style={styles.helpModalContent} onPress={() => {}}> 
            {/* Prevent backdrop press from triggering through content */}
            <Text style={styles.helpModalText}>
              Tip: substitute out an ingredient in the recipe by clicking the S next to the ingredient name. The recipe will adjust accordingly!
            </Text>
            <TouchableOpacity 
              style={styles.helpModalCloseButton} 
              onPress={() => setIsHelpModalVisible(false)}
            >
              <X size={20} color={COLORS.textDark} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
    marginHorizontal: 8,
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
    // This style is no longer needed as quantity/unit are combined
    /*
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.darkGray,
    lineHeight: 24,
    textAlign: 'right',
    marginRight: 10,
    */
  },
  ingredientNameContainer: {
      flex: 1, // Takes remaining space
      flexDirection: 'row',
      alignItems: 'flex-start', // Align items to the top within this row
      justifyContent: 'space-between',
  },
  ingredientName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    flexShrink: 1, // Allow text to shrink if needed, but prefer wrapping
    marginRight: 8, // Space between text and S button
  },
  ingredientNameFullWidth: { // May no longer be needed, merged into ingredientName
    // ... keep for now, might remove later if unused ...
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    flex: 1,
    marginRight: 8,
  },
  ingredientQuantityParenthetical: { // Style for the (qty unit) part
    fontFamily: 'Poppins-Regular', // Less emphasis
    fontSize: 15, // Slightly smaller
    color: COLORS.darkGray, // Lighter color
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
  },
  // --- Help Modal Styles ---
  helpModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  helpModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 25,
    paddingTop: 35, // Extra padding top for close button
    alignItems: 'center',
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
    maxWidth: 400,
  },
  helpModalText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  helpModalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  // --- End Help Modal Styles ---
  scaleInfoBanner: {
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  scaleInfoText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.white,
    textAlign: 'center',
  },
});