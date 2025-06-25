import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, Alert, Modal, Pressable, Image, InteractionManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PerformanceObserver } from 'react-native-performance';
// import Animated, { FadeIn } from 'react-native-reanimated'; // Removed for gesture debug
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';
import { StructuredIngredient, SubstitutionSuggestion } from '../../common/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatMeasurement, abbreviateUnit } from '@/utils/format';
import { coerceToStructuredIngredients, parseIngredientDisplayName } from '@/utils/ingredientHelpers';
import { getScaledYieldText, scaleIngredient, parseAmountString, formatAmountNumber } from '@/utils/recipeUtils';
import { useErrorModal } from '@/context/ErrorModalContext';
import { titleText, bodyStrongText, bodyText, captionText } from '@/constants/typography';
import { FlatList } from 'react-native';
import IngredientRow from './IngredientRow';

// --- Types ---
// The new, richer state definition for a change. `null` for `to` indicates a removal.
type AppliedChange = {
  from: string;
  to: StructuredIngredient | null;
};

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

/**
 * Resolves the original ingredient name from appliedChanges instead of relying on parsed display names.
 */
function getOriginalIngredientNameFromAppliedChanges(
  appliedChanges: AppliedChange[],
  displayName: string
): string {
  const { substitutedFor, baseName } = parseIngredientDisplayName(displayName);
  const fallback = substitutedFor || baseName;
  const match = appliedChanges.find(change => change.to?.name === fallback);
  return match?.from || fallback;
}

// Utility for consistent timing logs in dev
const logTiming = (label: string) => {
  if (__DEV__) {
    console.log(`[TIMING] ${label} at ${Date.now()}ms`);
  }
};

export default function IngredientsScreen() {
  if (__DEV__) console.log("🚨 INGREDIENTS SCREEN MOUNTED 🚨");
  const renderCount = useRef(0);
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  
  const [navData, setNavData] = useState<IngredientsNavParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<{ [key: number]: boolean }>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isScalingInstructions, setIsScalingInstructions] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [selectedIngredientOriginalData, setSelectedIngredientOriginalData] = useState<StructuredIngredient | null>(null);
  const [processedSubstitutionsForModal, setProcessedSubstitutionsForModal] = useState<SubstitutionSuggestion[] | null>(null);
  const processedRecipeData = useRef<string | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{ from: string; to: string | null } | null>(null);

  const scaledIngredients = useMemo(() => {
    if (!navData?.scaledIngredients) {
      return [];
    }

    const baseIngredients = coerceToStructuredIngredients(navData.scaledIngredients);
    if (appliedChanges.length === 0) {
      return baseIngredients;
    }

    const finalIngredients = baseIngredients.map(baseIngredient => {
      const change = appliedChanges.find(c => c.from === baseIngredient.name);

      if (change) {
        if (change.to === null) { // Removal
          return {
            ...baseIngredient,
            name: `${baseIngredient.name} (removed)`,
            amount: null,
            unit: null,
            suggested_substitutions: null,
          };
        } else { // Substitution
          return {
            ...change.to,
            name: `${change.to.name} (substituted for ${change.from})`,
          };
        }
      }
      return baseIngredient;
    });

    return finalIngredients;
  }, [navData?.scaledIngredients, appliedChanges]);

  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 16) {
          console.warn(`[⚠️ FRAME BLOCKED] ${entry.name} took ${entry.duration.toFixed(2)}ms`);
        }
      }
    });

    observer.observe({ type: 'measure', buffered: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    renderCount.current += 1;
    console.log(`[Render Count] IngredientsScreen: ${renderCount.current}`);
  });

  // Debug logs for modal visibility state changes
  useEffect(() => {
    if (__DEV__) {
      console.log('[DEBUG] substitutionModalVisible:', substitutionModalVisible);
    }
  }, [substitutionModalVisible]);

  useEffect(() => {
    if (!substitutionModalVisible) {
      console.log('[DEBUG] Substitution modal fully closed');
      setTimeout(() => {
        console.log('[DEBUG] 250ms after modal close');
      }, 250);
    }
  }, [substitutionModalVisible]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[DEBUG] selectedIngredientOriginalData:', selectedIngredientOriginalData);
    }
  }, [selectedIngredientOriginalData]);

  useEffect(() => {
    console.log('[PERF] appliedChanges updated:', appliedChanges);
  }, [appliedChanges]);

  useEffect(() => {
    console.log('[PERF] scaledIngredients updated, FlatList will re-render.');
  }, [scaledIngredients]);

  useEffect(() => {
    console.log('[PERF] checkedIngredients updated');
  }, [checkedIngredients]);

  useEffect(() => {
    console.log('[Re-render Trigger] navData changed');
  }, [navData]);

  useEffect(() => {
    return () => {
      console.log('[UNMOUNT] IngredientsScreen has been unmounted ✅');
    };
  }, []);

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
          console.log('[IngredientsScreen] Received recipeData:', params.recipeData);
          const parsedNavData = JSON.parse(params.recipeData) as IngredientsNavParams;

          // 🧠 If scaled ingredients aren't provided (e.g., scale=1x), create them from originals
          if (!parsedNavData.scaledIngredients && parsedNavData.originalIngredients) {
              const structured = coerceToStructuredIngredients(parsedNavData.originalIngredients);
              const scale = parsedNavData.scaleFactor || 1;
              parsedNavData.scaledIngredients = structured.map(i => scaleIngredient(i, scale));
          }

          if (!parsedNavData || typeof parsedNavData !== 'object' || Object.keys(parsedNavData).length === 0) {
            console.error("[IngredientsScreen] Parsed nav data is empty or invalid. Original data:", params.recipeData);
            showError(
              "Error Loading Ingredients",
              "Ingredient data is invalid. Please go back and try again."
            );
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
          showError(
              "Error Loading Ingredients",
              `Could not load ingredient data: ${e.message}. Please go back and try again.`
          );
          setIsLoading(false);
          return;
        }
      } else {
        console.error("[IngredientsScreen] Recipe data not provided or not a string in params. Received:", params.recipeData);
        showError(
          "Error Loading Ingredients",
          "Recipe data not provided. Please go back and try again."
        );
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

  const toggleCheckIngredient = useCallback((index: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }, []);

  const openSubstitutionModal = useCallback((ingredient: StructuredIngredient) => {
    console.log("Opening substitution modal for:", JSON.stringify(ingredient));
    let scaledSuggestions: SubstitutionSuggestion[] | null = null;
    if (ingredient.suggested_substitutions && navData && navData.scaleFactor !== null && navData.scaleFactor !== 1) {
      const scalingFactor = navData.scaleFactor;
      scaledSuggestions = ingredient.suggested_substitutions.map(sub => {
        let finalAmount: string | number | null = sub.amount ?? null;
        if (sub.amount != null) {
          try {
            const parsedAmount = parseAmountString(String(sub.amount));
            if (parsedAmount !== null) {
              const calculatedAmount = parsedAmount * scalingFactor;
              finalAmount = formatAmountNumber(calculatedAmount) || calculatedAmount.toFixed(2);
            } else {
              finalAmount = sub.amount;
            }
          } catch (e) {
            console.error("Error scaling substitution amount:", e);
            finalAmount = sub.amount;
          }
        } else {
          finalAmount = null;
        }
        return {
          ...sub,
          amount: finalAmount
        };
      });
    } else {
      scaledSuggestions = ingredient.suggested_substitutions || null;
    }
    setSelectedIngredientOriginalData(ingredient);
    setProcessedSubstitutionsForModal(scaledSuggestions);
    setTimeout(() => {
      setSubstitutionModalVisible(true);
    }, 0);
  }, [navData]);

  const undoIngredientRemoval = useCallback((fullName: string) => {
    if (__DEV__) console.log(`[Handler] Undo removal: ${fullName}`);
    const { baseName: originalName } = parseIngredientDisplayName(fullName);

    setAppliedChanges(prev => prev.filter(change => change.from !== originalName));

    if (lastRemoved?.from === originalName) {
      setLastRemoved(null);
    }
  }, [lastRemoved]);

  const undoSubstitution = useCallback((originalName: string) => {
    if (__DEV__) console.log(`[Handler] Undo substitution: ${originalName}`);
    setAppliedChanges(prev => prev.filter(change => change.from !== originalName));
  }, []);

  const handleGoToSteps = () => {
    InteractionManager.runAfterInteractions(() => {
      navigateToNextScreen();
    });
  };

  const memoizedRenderIngredientRow = useCallback(
    ({ item, index }: { item: StructuredIngredient; index: number }) => {
      return (
        <IngredientRow
          ingredient={item}
          index={index}
          isChecked={!!checkedIngredients[index]}
          appliedChanges={appliedChanges}
          toggleCheckIngredient={toggleCheckIngredient}
          openSubstitutionModal={openSubstitutionModal}
          undoIngredientRemoval={undoIngredientRemoval}
          undoSubstitution={undoSubstitution}
        />
      );
    },
    [
      checkedIngredients,
      appliedChanges,
      toggleCheckIngredient,
      openSubstitutionModal,
      undoIngredientRemoval,
      undoSubstitution,
    ]
  );

  const navigateToNextScreen = useCallback(async () => {
    console.log('🚀 navigateToNextScreen CALLED');
    const navStart = Date.now();
    logTiming("Entered navigateToNextScreen");

    const removalCount = appliedChanges.filter(c => !c.to).length;
    if (removalCount > 2) {
      console.warn("[NAV BLOCKED] Too many removals, canceling navigation");
      showError(
        "Limit Reached",
        "You can only remove up to 2 ingredients per recipe."
      );
      return;
    }

    if (!navData || !scaledIngredients) {
      console.error("Cannot navigate, essential data is missing.");
      return;
    }

    let finalInstructions = navData.instructions || [];
    let finalSubstitutionsText = navData.substitutions_text || '';
    const needsScaling = navData.scaleFactor !== 1;

    performance.mark('navigateToNextScreen-start');
    // --- 1. Handle Substitution Rewriting (if applicable) --- 
    if (appliedChanges.length > 0) {
       console.log('[Navigate] Triggering rewrite with changes:', appliedChanges);
       console.log("🧪 Sending to backend:", appliedChanges);
       setIsRewriting(true);
       try {
         const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
         const response = await fetch(`${backendUrl}/api/recipes/rewrite-instructions`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             originalInstructions: navData.instructions || [],
             substitutions: appliedChanges.map(change => ({
                from: change.from,
                to: change.to ? change.to.name : null
             })),
           }),
         });
         const result = await response.json();
         if (!response.ok) {
           console.error("💥 Rewrite fetch failed", result);
           throw new Error(result.error || `Rewrite failed (Status: ${response.status})`);
         }
         if (!result.rewrittenInstructions) {
            console.error("💥 Rewrite response invalid format", result);
            throw new Error("Invalid format for rewritten instructions.");
         }
         finalInstructions = result.rewrittenInstructions;
         logTiming("Finished rewriting instructions");
       } catch (rewriteError) {
         console.error("Error rewriting instructions:", rewriteError);
         showError(
           "Update Failed", 
           "We couldn't update the recipe steps for the ingredient substitution. The original steps will be used."
         );
         return;
       } finally {
         setIsRewriting(false);
       }
     } else {
       if (__DEV__) console.log('[Navigate] No substitutions provided – skipping rewrite');
     }

    // --- 2. Handle Instruction Scaling (if applicable) --- 
    if (needsScaling && scaledIngredients.length > 0) {
        logTiming("Started scaling instructions");
        setIsScalingInstructions(true);
        try {
            const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
            const response = await fetch(`${backendUrl}/api/recipes/scale-instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instructionsToScale: finalInstructions,
                    originalIngredients: navData.originalIngredients,
                    scaledIngredients: scaledIngredients,
                }),
            });
            const result = await response.json();
             if (!response.ok) {
                console.error("💥 Scale fetch failed", result);
                throw new Error(result.error || `Scaling failed (Status: ${response.status})`);
             }
             if (!result.scaledInstructions) {
                console.error("💥 Scale response invalid format", result);
                throw new Error("Invalid format for scaled instructions.");
             }
             finalInstructions = result.scaledInstructions;
             logTiming("Finished scaling instructions");
        } catch (scalingError) {
             console.error("Error scaling instructions:", scalingError);
             showError(
               "Update Failed",
               "We couldn't automatically adjust ingredient quantities in the recipe steps. The original quantities will be shown."
             );
             return;
        } finally {
            setIsScalingInstructions(false);
        }
    }

    if (__DEV__) {
      console.log('[Navigate] Pushing to /steps with instructions:', finalInstructions);
    }
    logTiming("Beginning navigation to Steps screen");
    // --- 3. Navigate to Steps Screen --- 
    router.replace({
      pathname: '/recipe/steps',
      params: {
        recipeData: JSON.stringify({
          title: navData.title,
          instructions: finalInstructions,
          substitutions_text: finalSubstitutionsText,
          ingredients: scaledIngredients,
          recipeYield: getScaledYieldText(navData.originalYieldDisplay, navData.scaleFactor),
          prepTime: navData.prepTime,
          cookTime: navData.cookTime,
          totalTime: navData.totalTime,
          nutrition: navData.nutrition
        })
      }
    });

    performance.mark('navigateToNextScreen-end');
    performance.measure('navigateToNextScreen', 'navigateToNextScreen-start', 'navigateToNextScreen-end');

    logTiming(`navigateToNextScreen completed (total ${Date.now() - navStart}ms)`);
  }, [navData, scaledIngredients, appliedChanges, router, showError]);

  const handleApplySubstitution = (substitution: SubstitutionSuggestion) => {
    try {
      if (!selectedIngredientOriginalData) {
        console.error("Apply error: Missing original ingredient data or display list.");
        return;
      }
  
      const ingredientToSubstitute = selectedIngredientOriginalData;
      console.log(`[TIMING] Modal close trigger at ${Date.now()}ms`);
      setSubstitutionModalVisible(false);
      setSelectedIngredientOriginalData(null);
      setProcessedSubstitutionsForModal(null);
  
      requestAnimationFrame(() => {
        InteractionManager.runAfterInteractions(() => {
          console.log(`[TIMING] Running deferred state updates at ${Date.now()}ms`);
          performance.mark('applySubstitution-start');
  
          if (substitution.name === 'Remove ingredient') {
            const currentRemovals = appliedChanges.filter(change => !change.to).length;
            if (currentRemovals >= 2) {
              console.warn('🚫 Blocked 3rd removal attempt:', ingredientToSubstitute?.name);
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  console.log('🔥 Triggering showError modal');
                  showError(
                    'Limit Reached',
                    'You can only remove up to 2 ingredients per recipe.'
                  );
                }, 300);
              });
              console.trace('Blocked 3rd removal – trace');
              return;
            }
          }
  
          console.log("🧪 Current appliedChanges:", appliedChanges);
  
          const isRemoval = substitution.name === 'Remove ingredient';
          const originalIngredientNameFromState = ingredientToSubstitute.name;
          const index = scaledIngredients.findIndex(ing => {
            const { substitutedFor } = parseIngredientDisplayName(ing.name);
            return ing.name === originalIngredientNameFromState || substitutedFor === originalIngredientNameFromState;
          });
  
          if (index === -1) {
            console.error(`Apply error: Cannot find ingredient matching "${originalIngredientNameFromState}" in display list.`);
            console.log("Current scaledIngredients names:", scaledIngredients.map(i => i.name));
            return;
          }
  
          const currentDisplayName = scaledIngredients[index].name;
          let originalNameForSub = ingredientToSubstitute.name;
          const { substitutedFor } = parseIngredientDisplayName(currentDisplayName);
          if (substitutedFor) {
            originalNameForSub = substitutedFor;
          }
  
          console.log(`Applying substitution: ${substitution.name} (Amount: ${substitution.amount}, Unit: ${substitution.unit}) for original ${originalNameForSub} at index ${index}`);
  
          const newChange: AppliedChange = {
            from: originalNameForSub,
            to: isRemoval ? null : {
              name: substitution.name,
              amount: substitution.amount != null ? String(substitution.amount) : null,
              unit: substitution.unit ?? null,
              preparation: substitution.description ?? null,
              suggested_substitutions: null,
            }
          };
  
          if (isRemoval) {
            setLastRemoved({ from: newChange.from, to: null });
          }
  
          console.log('Applying change:', newChange);
          console.log(`[TIMING] setAppliedChanges will run at ${Date.now()}ms`);
          setAppliedChanges(prev => {
            const existingChangeIndex = prev.findIndex(c => c.from === originalNameForSub);
            if (existingChangeIndex > -1) {
              const updated = [...prev];
              updated[existingChangeIndex] = newChange;
              return updated;
            }
            return [...prev, newChange];
          });
  
          performance.mark('applySubstitution-end');
          performance.measure('applySubstitution', 'applySubstitution-start', 'applySubstitution-end');
          console.log("✅ Substitution applied (deferred)");
        });
      });
    } catch (err) {
      console.error("💥 Unexpected applySubstitution failure", err);
      showError("Substitution Error", "Something went wrong.");
    }
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
  if (__DEV__ && scaledIngredients) {
    console.log('[IngredientsScreen] scaledIngredients names:', scaledIngredients.map(i=>i.name));
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
          <TouchableOpacity style={styles.exitButton} onPress={() => router.replace('/')}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
        
        {navData?.title && (
          <Text style={styles.pageTitle}>{navData.title}</Text>
        )}
        
        <FlatList
          data={scaledIngredients}
          keyExtractor={(item: StructuredIngredient, index: number) => `${item.name}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.ingredientsList, { paddingBottom: 100 }]}
          ListHeaderComponent={navData && navData.scaleFactor !== 1 ? (
            <View style={styles.scaleInfoBanner}>
              <Text style={styles.scaleInfoText}>{`Showing ${navData.scaleFactor}x scaled up ingredients`}</Text>
            </View>
          ) : undefined}
          ListEmptyComponent={<Text style={styles.placeholderText}>No ingredients found.</Text>}
          extraData={appliedChanges.length + Object.keys(checkedIngredients).length}
          renderItem={memoizedRenderIngredientRow}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            onPressIn={() => console.log('[BUTTON] onPressIn')}
            onPress={() => {
              console.log('[BUTTON] onPress');
              handleGoToSteps();
            }}
            onLayout={(e) => console.log('[BUTTON] Layout:', e.nativeEvent.layout)}
            style={[
              styles.nextButton,
              (isRewriting || isScalingInstructions) && styles.nextButtonDisabled
            ]}
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
          </TouchableOpacity>
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
                Tip: substitute out an ingredient in the recipe by clicking the button next to the ingredient name. The recipe will adjust accordingly!
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
  exitButton: {
    padding: 8,
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

  checkboxPlaceholder: {
    width: 24,
    height: 24,
    marginRight: 15,
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
  ingredientTextRemoved: {
    color: COLORS.darkGray,
    textDecorationLine: 'line-through',
  },
  ingredientRemovedTag: {
    color: COLORS.darkGray,
    fontStyle: 'italic',
  },
  ingredientItemStructured: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
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
  revertButton: {
    paddingHorizontal: 8,
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
    top: 15,
    right: 15,
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