import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, Alert, Modal, Pressable, Image, InteractionManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// import Animated, { FadeIn } from 'react-native-reanimated'; // Removed for gesture debug
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';
import { StructuredIngredient, SubstitutionSuggestion } from '@/api/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatMeasurement, abbreviateUnit } from '@/utils/format';
import { coerceToStructuredIngredients } from '@/utils/ingredientHelpers';
import { getScaledYieldText, scaleIngredient, parseAmountString, formatAmountNumber } from '@/utils/recipeUtils';
import { useErrorModal } from '@/context/ErrorModalContext';
import { titleText, bodyStrongText, bodyText, captionText } from '@/constants/typography';
import { FlatList } from 'react-native';

// --- Types ---
// Added SubstitutionSuggestion type matching backend/modal
type IngredientChange = { from: string; to: string | null };

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
/* This function has been moved to utils/format.ts */
// --- End Helper function ---

// --- Comment out old types/data ---
/*
type Recipe = { ... };
interface Ingredient { ... };
const SAMPLE_RECIPES: Record<string, Recipe> = { ... };
*/
// --- End Comment Out ---

// Memoized row component to avoid unnecessary re-renders
const IngredientRow = React.memo(({
  ingredient,
  index,
  isChecked,
  isSubstituted,
  toggleCheckIngredient,
  openSubstitutionModal
}: {
  ingredient: StructuredIngredient;
  index: number;
  isChecked: boolean;
  isSubstituted: boolean;
  toggleCheckIngredient: (idx: number) => void;
  openSubstitutionModal: (ing: StructuredIngredient) => void;
}) => {
  /* removed verbose row render log */
  return (
    <TouchableOpacity 
      key={`ing-${index}`} 
      style={[
        styles.ingredientItemContainer,
        isSubstituted && styles.ingredientItemSubstituted,
        ingredient.name.includes('(removed') && styles.ingredientItemRemoved,
      ]}
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

      {/* Ingredient Text Container */}
      <View style={styles.ingredientNameContainer}> 
        <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked, isSubstituted && styles.ingredientNameSubstituted]} numberOfLines={0}> 
          {String(ingredient.name)}
          {ingredient.preparation && (
            <Text style={styles.ingredientPreparation}>
              {` ${ingredient.preparation}`}
            </Text>
          )}
          {(ingredient.amount || ingredient.unit) && (
            <Text style={styles.ingredientQuantityParenthetical}>
              {` (${ingredient.amount || ''}${ingredient.unit ? ` ${abbreviateUnit(ingredient.unit)}` : ''})`}
            </Text>
          )}
        </Text>

        {/* Substitution Button */}
        {!isSubstituted && 
         ingredient.suggested_substitutions && 
         ingredient.suggested_substitutions.length > 0 && 
         ingredient.suggested_substitutions.some(sub => sub && sub.name != null) && (
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={() => {
              /* removed verbose button press log */
              requestAnimationFrame(() => {
                openSubstitutionModal(ingredient);
              });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID={`substitution-button-${ingredient.name}`}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

// Utility for consistent timing logs in dev
const logTiming = (label: string) => {
  if (__DEV__) {
    console.log(`[TIMING] ${label} at ${Date.now()}ms`);
  }
};

export default function IngredientsScreen() {
  if (__DEV__) console.log("🚨 INGREDIENTS SCREEN MOUNTED 🚨");
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  
  const [navData, setNavData] = useState<IngredientsNavParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<{ [key: number]: boolean }>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<IngredientChange[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isScalingInstructions, setIsScalingInstructions] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [selectedIngredientOriginalData, setSelectedIngredientOriginalData] = useState<StructuredIngredient | null>(null);
  const [processedSubstitutionsForModal, setProcessedSubstitutionsForModal] = useState<SubstitutionSuggestion[] | null>(null);
  const processedRecipeData = useRef<string | null>(null);

  // Debug logs for modal visibility state changes
  useEffect(() => {
    if (__DEV__) {
      console.log('[DEBUG] substitutionModalVisible:', substitutionModalVisible);
    }
  }, [substitutionModalVisible]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[DEBUG] selectedIngredientOriginalData:', selectedIngredientOriginalData);
    }
  }, [selectedIngredientOriginalData]);

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
    // removed verbose structured ingredients log
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
    // 🚫 Prevent resets after a failed substitution
    if (
      params.recipeData &&
      params.recipeData === processedRecipeData.current
    ) {
      console.warn("🔁 Duplicate recipeData received — skipping reprocessing");
      return;
    }
    // Only re-process if the recipeData param has actually changed
    if (params.recipeData && params.recipeData !== processedRecipeData.current) {
      setIsLoading(true);

      if (typeof params.recipeData === 'string') {
        try {
          console.log("[IngredientsScreen] New recipeData detected, parsing:", params.recipeData);
          const parsedNavData = JSON.parse(params.recipeData) as IngredientsNavParams;

          if (!parsedNavData || typeof parsedNavData !== 'object' || Object.keys(parsedNavData).length === 0) {
            console.error("[IngredientsScreen] Parsed nav data is empty or invalid. Original data:", params.recipeData);
            showError({
              title: "Error Loading Ingredients",
              message: "Ingredient data is invalid. Please go back and try again."
            });
            setIsLoading(false);
            return;
          }

          InteractionManager.runAfterInteractions(() => {
            setNavData(parsedNavData);
            setAppliedChanges([]); // Reset changes for the new recipe
            setCheckedIngredients({});
            processedRecipeData.current = params.recipeData ?? null; // Mark as processed
            setIsLoading(false);
          });
        } catch (e: any) { 
          console.error(`[IngredientsScreen] Failed to parse recipeData. Error: ${e.message}. Raw data:`, params.recipeData);
          showError({
              title: "Error Loading Ingredients",
              message: `Could not load ingredient data: ${e.message}. Please go back and try again.`
          });
          setIsLoading(false);
          return;
        }
      } else {
        console.error("[IngredientsScreen] Recipe data not provided or not a string in params. Received:", params.recipeData);
        showError({
          title: "Error Loading Ingredients",
          message: "Recipe data not provided. Please go back and try again."
        });
        setIsLoading(false);
        return;
      }
    } else {
      // If recipeData is null/undefined and we haven't processed anything yet, it's a problem.
      if (!processedRecipeData.current) {
         setIsLoading(false);
      }
    }
  }, [params.recipeData]);

  const navigateToNextScreen = useCallback(async () => {
    console.log('🚀 navigateToNextScreen CALLED');
    const navStart = Date.now();
    logTiming("Entered navigateToNextScreen");

    const removalCount = appliedChanges.filter(c => !c.to).length;
    if (removalCount > 2) {
      console.warn("[NAV BLOCKED] Too many removals, canceling navigation");
      showError({
        title: "Limit Reached",
        message: "You can only remove up to 2 ingredients per recipe."
      });
      return;
    }

    if (!navData || !displayIngredients) {
      console.error("Cannot navigate, essential data is missing.");
      return;
    }

    let finalInstructions = navData.instructions || [];
    let finalSubstitutionsText = navData.substitutions_text || '';
    const needsScaling = navData.scaleFactor !== 1;

    // --- 1. Handle Substitution Rewriting (if applicable) --- 
    if (appliedChanges.length > 0) {
       console.log('[Navigate] Triggering rewrite with changes:', appliedChanges);
       console.log("🧪 Sending to backend:", appliedChanges);
       setIsRewriting(true);
       try {
         const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
         const response = await fetch(`${backendUrl}/api/recipes/rewrite-instructions`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             originalInstructions: navData.instructions || [],
             substitutions: appliedChanges,
           }),
         });
         const result = await response.json();
         if (!response.ok) throw new Error(result.error || `Rewrite failed (Status: ${response.status})`);
         if (result.rewrittenInstructions) finalInstructions = result.rewrittenInstructions;
         else throw new Error("Invalid format for rewritten instructions.");
         logTiming("Finished rewriting instructions");
       } catch (rewriteError) {
         console.error("Error rewriting instructions:", rewriteError);
         showError({ 
           title: "Update Failed", 
           message: "We couldn't update the recipe steps for the ingredient substitution. The original steps will be used."
         });
       } finally {
         setIsRewriting(false);
       }
     } else {
       if (__DEV__) console.log('[Navigate] No substitutions provided – skipping rewrite');
     }

    // --- 2. Handle Instruction Scaling (if applicable) --- 
    if (needsScaling && displayIngredients.length > 0) {
        logTiming("Started scaling instructions");
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
                 logTiming("Finished scaling instructions");
             } else throw new Error("Invalid format for scaled instructions.");
        } catch (scalingError) {
            console.error("Error scaling instructions:", scalingError);
            showError({
              title: "Update Failed",
              message: "We couldn't automatically adjust ingredient quantities in the recipe steps. The original quantities will be shown."
            });
        } finally {
            setIsScalingInstructions(false);
        }
    }

    if (__DEV__) {
      console.log('[Navigate] Pushing to /steps with instructions:', finalInstructions);
    }
    logTiming("Beginning navigation to Steps screen");
    // --- 3. Navigate to Steps Screen --- 
    router.push({
      pathname: '/recipe/steps',
      params: {
        recipeData: JSON.stringify({
          title: navData.title,
          instructions: finalInstructions,
          substitutions_text: finalSubstitutionsText,
          ingredients: displayIngredients,
          recipeYield: getScaledYieldText(navData.originalYieldDisplay, navData.scaleFactor),
          prepTime: navData.prepTime,
          cookTime: navData.cookTime,
          totalTime: navData.totalTime,
          nutrition: navData.nutrition
        })
      }
    });

    logTiming(`navigateToNextScreen completed (total ${Date.now() - navStart}ms)`);
  }, [navData, displayIngredients, appliedChanges, router, showError]);

  const toggleCheckIngredient = (index: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index] // Toggle the boolean value for the given index
    }));
  };

  const openSubstitutionModal = useCallback((ingredient: StructuredIngredient) => {
      // log removed: opening substitution modal with full ingredient json
      console.log("Opening substitution modal for:", JSON.stringify(ingredient)); 
      
      // --- Scaling Logic --- 
      let scaledSuggestions: SubstitutionSuggestion[] | null = null;
      if (ingredient.suggested_substitutions && navData && navData.scaleFactor !== null && navData.scaleFactor !== 1) {
           const scalingFactor = navData.scaleFactor;
           // removed scaling factor verbose log

           scaledSuggestions = ingredient.suggested_substitutions.map(sub => {
               let finalAmount: string | number | null = sub.amount ?? null;

               // Use parseAmountString for consistent handling of amounts
               if (sub.amount != null) {
                   try {
                       const parsedAmount = parseAmountString(String(sub.amount));
                       if (parsedAmount !== null) {
                           const calculatedAmount = parsedAmount * scalingFactor;
                           finalAmount = formatAmountNumber(calculatedAmount) || calculatedAmount.toFixed(2);
                           // removed verbose scaling log
                       } else {
                           // Keep original non-numeric amount if parsing fails
                           finalAmount = sub.amount;
                           // removed verbose log
                       }
                   } catch (e) {
                       console.error("Error scaling substitution amount:", e);
                       finalAmount = sub.amount; // Fallback to original if scaling fails
                   }
               } else {
                   // removed verbose null amount log
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
          // removed verbose scaling/no substitutions logs
      }
      // --- End Scaling Logic --- 

      setSelectedIngredientOriginalData(ingredient); // Store the original data
      setProcessedSubstitutionsForModal(scaledSuggestions); // Store the scaled suggestions for the modal
      setSubstitutionModalVisible(true);
  }, [navData, setSelectedIngredientOriginalData, setProcessedSubstitutionsForModal, setSubstitutionModalVisible]);

  const handleApplySubstitution = (substitution: SubstitutionSuggestion) => {
    if (!selectedIngredientOriginalData || !displayIngredients) { 
      console.error("Apply error: Missing original ingredient data or display list.");
      return;
    }

    if (substitution.name === 'Remove ingredient') {
      const currentRemovals = appliedChanges.filter(change => !change.to).length;
      if (currentRemovals >= 2) {
        console.warn('🚫 Blocked 3rd removal attempt:', selectedIngredientOriginalData?.name);
        setSubstitutionModalVisible(false);
        setSelectedIngredientOriginalData(null);

        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            console.log('🔥 Triggering showError modal');
            showError({
              title: 'Limit Reached',
              message: 'You can only remove up to 2 ingredients per recipe.',
            });
          }, 300); // ⏳ delay to let first modal cleanly disappear
        });
        console.trace('Blocked 3rd removal – trace');
        return; // 🔒 prevent any state update
      }
    }

    console.log("🧪 Current appliedChanges:", appliedChanges);

    const isRemoval = substitution.name === 'Remove ingredient';

    const originalIngredientNameFromState = selectedIngredientOriginalData.name;
    
    const index = displayIngredients.findIndex(ing => 
      ing.name === originalIngredientNameFromState || 
      ing.name.includes(`(substituted for ${originalIngredientNameFromState})`)
    );

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
    
    const newChange: IngredientChange = {
      from: originalNameForSub,
      to: isRemoval ? null : substitution.name,
    };

    console.log('Applying change:', newChange);

    setAppliedChanges(prev => {
      const existingChangeIndex = prev.findIndex(c => c.from === originalNameForSub);
      if (existingChangeIndex > -1) {
        const updated = [...prev];
        updated[existingChangeIndex] = newChange;
        return updated;
      }
      return [...prev, newChange];
    });

    // Update navData with the substituted ingredient
    setNavData(prevNavData => {
      if (!prevNavData) return prevNavData;
      
      const newNavData = { ...prevNavData };
      const source = newNavData.scaleFactor === 1 ? newNavData.originalIngredients : newNavData.scaledIngredients;
      
      if (Array.isArray(source) && index !== -1 && source[index]) {
        const newSource = source.map((item, i) => {
          if (i === index) {
            // Convert string to StructuredIngredient if needed
            const baseIngredient = typeof item === 'string' 
              ? { name: item, amount: null, unit: null, suggested_substitutions: null }
              : item;
            
            if (isRemoval) {
              return {
                ...baseIngredient,
                name: `${originalNameForSub} (removed)` ,
                amount: null,
                unit: null,
                suggested_substitutions: null,
              };
            } else {
              return {
                ...baseIngredient,
                name: `${substitution.name} (substituted for ${originalNameForSub})`,
                amount: substitution.amount != null ? String(substitution.amount) : null,
                unit: substitution.unit || null,
                suggested_substitutions: null
              };
            }
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
    console.log("✅ Substitution applied");
  };

  // --- Conditional Rendering (SHOULD BE AFTER ALL HOOKS) ---
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!navData) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- RENDER LOGIC (assuming navData is available) --- 
  if (__DEV__ && displayIngredients) {
    console.log('[IngredientsScreen] displayIngredients names:', displayIngredients.map(i=>i.name));
  }

  return (
    <>
      {substitutionModalVisible && selectedIngredientOriginalData && (
        <IngredientSubstitutionModal
          visible={substitutionModalVisible}
          onClose={() => {
            setSubstitutionModalVisible(false);
            setSelectedIngredientOriginalData(null);
            setProcessedSubstitutionsForModal(null);
          }}
          ingredientName={selectedIngredientOriginalData.name}
          substitutions={processedSubstitutionsForModal}
          onApply={handleApplySubstitution}
        />
      )}
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Image source={require('@/assets/images/meez_logo.png')} style={styles.headerLogo} />
          <View style={styles.placeholder} />
        </View>
        
        {navData?.title && (
          <Text style={styles.pageTitle}>{navData.title}</Text>
        )}
        
        <FlatList
          data={displayIngredients}
          keyExtractor={(item: StructuredIngredient, index: number) => `${item.name}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.ingredientsList, { paddingBottom: 100 }]}
          ListHeaderComponent={navData && navData.scaleFactor !== 1 ? (
            <View style={styles.scaleInfoBanner}>
              <Text style={styles.scaleInfoText}>{`Showing ${navData.scaleFactor}x scaled up ingredients`}</Text>
            </View>
          ) : undefined}
          ListEmptyComponent={<Text style={styles.placeholderText}>No ingredients found.</Text>}
          extraData={[substitutionModalVisible, selectedIngredientOriginalData]}
          renderItem={({ item, index }: { item: StructuredIngredient; index: number }) => {
            /* removed flash list verbose render log */
            const isChecked = !!checkedIngredients[index];
            const change = appliedChanges.find(c => {
              // A bit complex: check if the item is the result of this change
              return item.name.includes(c.from) || (c.to && item.name.startsWith(c.to));
            });
            const isSubstituted = !!change;
            return (
              <IngredientRow
                ingredient={item}
                index={index}
                isChecked={isChecked}
                isSubstituted={isSubstituted}
                toggleCheckIngredient={toggleCheckIngredient}
                openSubstitutionModal={openSubstitutionModal}
              />
            );
          }}
        />

        <View style={styles.footer}>
          <Pressable 
            style={[
              styles.nextButton, 
              (isRewriting || isScalingInstructions) && styles.nextButtonDisabled
            ]}
            onPress={() => {
              logTiming("Button press fired");
              InteractionManager.runAfterInteractions(() => {
                logTiming("UI settled, navigating");
                navigateToNextScreen();
              });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={isRewriting || isScalingInstructions}
          >
            {(isRewriting || isScalingInstructions) && (
              <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }}/>
            )}
            <Text style={styles.nextButtonText}>
              {isRewriting ? 'Customizing instructions...' : isScalingInstructions ? 'Making sure everything lines up...' : 'Go to Steps'}
            </Text>
            {!(isRewriting || isScalingInstructions) && <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.white} />}
          </Pressable>
        </View>

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
                <MaterialCommunityIcons name="close" size={20} color={COLORS.textDark} />
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: 8, 
  },
  headerLogo: {
    width: 70,
    height: 25,
    resizeMode: 'center',
    marginTop: 2,
  },
  pageTitle: {
    ...titleText,
    color: COLORS.textDark,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 34,
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
    ...bodyText,
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
    ...bodyStrongText,
    color: COLORS.white,
    marginRight: 8,
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  errorText: {
    ...bodyText,
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
    ...bodyStrongText,
    color: COLORS.textDark,
  },
   placeholderText: {
    ...captionText,
    fontStyle: 'italic',
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
  ingredientItemRemoved: {
    backgroundColor: '#fce8e6',
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
    ...bodyStrongText,
    color: COLORS.textDark,
    lineHeight: 24,
    flexShrink: 1, // Allow text to shrink if needed, but prefer wrapping
    marginRight: 8, // Space between text and S button
  },
  ingredientNameFullWidth: { // May no longer be needed, merged into ingredientName
    // ... keep for now, might remove later if unused ...
    ...bodyStrongText,
    color: COLORS.textDark,
    lineHeight: 24,
    flex: 1,
    marginRight: 8,
  },
  ingredientQuantityParenthetical: { // Style for the (qty unit) part
    ...bodyText,
    fontSize: 15, // Slightly smaller
    color: COLORS.darkGray, // Lighter color
  },
  ingredientNameSubstituted: {
    fontStyle: 'italic',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    ...bodyText,
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
    backgroundColor: COLORS.darkGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  scaleInfoText: {
    ...bodyStrongText,
    fontSize: 15,
    color: COLORS.white,
    textAlign: 'center',
  },
  ingredientPreparation: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    marginTop: 2,
    marginLeft: 2,
  },
});