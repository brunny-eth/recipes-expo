import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Modal,
  Pressable,
  Image,
  Dimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import {
  COLORS,
  OVERLAYS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
  SHADOWS,
  IMAGE_SIZE,
} from '@/constants/theme';
import ToolsModal from '@/components/ToolsModal';
import MiniTimerDisplay from '@/components/MiniTimerDisplay';
import { ActiveTool } from '@/components/ToolsModal';
import { useErrorModal } from '@/context/ErrorModalContext';
import InlineErrorBanner from '@/components/InlineErrorBanner';
import { StructuredIngredient, CombinedParsedRecipe as ParsedRecipe, IngredientGroup } from '../../common/types';
import { IngredientChange } from '../../server/llm/modificationPrompts';
import { abbreviateUnit } from '@/utils/format';

// Define AppliedRecipeChanges type for frontend use
type AppliedRecipeChanges = {
  ingredientChanges: IngredientChange[];
  scalingFactor: number;
};
import { parseAmountString } from '@/utils/recipeUtils';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';
import RecipeStepsHeader from '@/components/recipe/RecipeStepsHeader';
import StepsFooterButtons from '@/components/recipe/StepsFooterButtons';
import {
  titleText,
  sectionHeaderText,
  bodyText,
  bodyTextLoose,
  bodyStrongText,
  captionText,
  FONT,
} from '@/constants/typography';

const screenWidth = Dimensions.get('window').width;

export default function StepsScreen() {
  // console.log('[StepsScreen] 🚀 Component rendering');
  
  const params = useLocalSearchParams<{
    originalId?: string; // The ID of the original recipe from processed_recipes_cache
    recipeData?: string; // The original CombinedParsedRecipe (stringified)
    editedInstructions?: string; // LLM-rewritten instructions (stringified array)
    editedIngredients?: string; // Scaled/substituted ingredients (stringified array of IngredientGroup)
    newTitle?: string; // LLM-suggested new title
    appliedChanges?: string; // The AppliedRecipeChanges object (stringified)
    miseRecipeId?: string; // New parameter for mise integration
    titleOverride?: string; // Title override from mise/saved screens
  }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  const { session } = useAuth();
  const { markFreeRecipeUsed } = useFreeUsage();


  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  // State to hold the original recipe data (if needed for reference)
  const [originalRecipe, setOriginalRecipe] = useState<ParsedRecipe | null>(null);

  // State to hold the *modified* recipe data that will be sent to the backend
  const [modifiedRecipe, setModifiedRecipe] = useState<ParsedRecipe | null>(null);

  // State to hold the original recipe ID and applied changes for the save API call
  const [originalRecipeId, setOriginalRecipeId] = useState<number | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedRecipeChanges | null>(null);

  // Legacy state for backward compatibility with existing UI components
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<StructuredIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<{
    [key: number]: boolean;
  }>({});
  const [isToolsPanelVisible, setIsToolsPanelVisible] = useState(false);
  const [initialToolToShow, setInitialToolToShow] = useState<ActiveTool>(null);
  const [isHeaderToolsVisible, setIsHeaderToolsVisible] = useState(false);

  // --- Tooltip State ---
  const [selectedIngredient, setSelectedIngredient] =
    useState<StructuredIngredient | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  // --- End Tooltip State ---

  // --- Recipe Tips Modal State ---
  const [isRecipeTipsModalVisible, setIsRecipeTipsModalVisible] = useState(false);
  // --- End Recipe Tips Modal State ---

  // --- Lifted Timer State ---
  const [timerTimeRemaining, setTimerTimeRemaining] = useState(0); // Time in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<any>(null);
  // --- End Lifted Timer State ---

  // --- Auto-scroll State ---
  const scrollViewRef = useRef<ScrollView>(null);
  // --- End Auto-scroll State ---

  // Component mount/unmount logging
  useEffect(() => {
    console.log('[StepsScreen] 🎯 Component DID MOUNT');
    return () => {
      console.log('[StepsScreen] 🌀 Component WILL UNMOUNT');
    };
  }, []);

  // Effect to initialize recipe state from params
  useEffect(() => {
    console.log('[StepsScreen] 🔄 Initializing recipe state from params:', {
      hasRecipeData: !!params.recipeData,
      hasEditedInstructions: !!params.editedInstructions,
      hasEditedIngredients: !!params.editedIngredients,
      hasNewTitle: !!params.newTitle,
      hasOriginalId: !!params.originalId,
      hasAppliedChanges: !!params.appliedChanges,
      hasMiseRecipeId: !!params.miseRecipeId,
      recipeDataLength: params.recipeData?.length || 0,
    });
    
    setIsLoading(true);
    try {
      if (params.recipeData) {
        const parsedOriginalRecipe: ParsedRecipe = JSON.parse(params.recipeData);
        console.log('[StepsScreen] ✅ Successfully parsed recipe data:', {
          title: parsedOriginalRecipe.title,
          instructionsCount: parsedOriginalRecipe.instructions?.length || 0,
          ingredientsCount: parsedOriginalRecipe.ingredientGroups?.length || 0,
        });
        setOriginalRecipe(parsedOriginalRecipe); // Store original for reference

        // Start with a deep copy of the original recipe to preserve all fields
        let currentModifiedRecipe: ParsedRecipe = JSON.parse(JSON.stringify(parsedOriginalRecipe));

        // If we have a miseRecipeId, check for local modifications
        if (params.miseRecipeId) {
          console.log('[StepsScreen] 📝 Checking for local modifications for mise recipe:', params.miseRecipeId);
          
          // Access the global miseRecipes (we'll need to pass this properly later)
          const getMiseRecipe = (globalThis as any).getMiseRecipe;
          if (getMiseRecipe) {
            const miseRecipe = getMiseRecipe(params.miseRecipeId);
            if (miseRecipe?.local_modifications?.modified_recipe_data) {
              console.log('[StepsScreen] 🔄 Using local modifications for mise recipe');
              currentModifiedRecipe = miseRecipe.local_modifications.modified_recipe_data;
            }
          }
        }

        // Apply specific modifications passed from summary.tsx (these override local modifications)
        if (params.editedInstructions) {
          currentModifiedRecipe.instructions = JSON.parse(params.editedInstructions);
        }
        if (params.editedIngredients) {
          currentModifiedRecipe.ingredientGroups = JSON.parse(params.editedIngredients);
        }
        if (params.newTitle && params.newTitle !== 'null') { // Check for "null" string
          currentModifiedRecipe.title = params.newTitle;
        }
        // The recipeYield should already be correctly scaled and formatted from summary.tsx params
        // So, no specific update needed here, as it's part of the parsedOriginalRecipe already if passed correctly.

        setModifiedRecipe(currentModifiedRecipe);

        // Set originalRecipeId and appliedChanges for the save API call
        if (params.originalId) {
          setOriginalRecipeId(Number(params.originalId));
        }
        if (params.appliedChanges) {
          setAppliedChanges(JSON.parse(params.appliedChanges));
        }

        // Debug logging to verify data flow
        console.log('[StepsScreen] Recipe data initialized:', {
          originalRecipeId: params.originalId,
          hasOriginalRecipe: !!parsedOriginalRecipe,
          hasModifiedRecipe: !!currentModifiedRecipe,
          titleChanged: currentModifiedRecipe.title !== parsedOriginalRecipe.title,
          hasImage: !!currentModifiedRecipe.image,
          appliedChanges: params.appliedChanges ? JSON.parse(params.appliedChanges) : null,
          usingMiseModifications: params.miseRecipeId && currentModifiedRecipe !== parsedOriginalRecipe,
        });

        // Update legacy state for backward compatibility with existing UI components
        // Use titleOverride if available, otherwise use the modified recipe title
        const displayTitle = params.titleOverride || currentModifiedRecipe.title || 'Instructions';
        setRecipeTitle(displayTitle);
        
        console.log('[StepsScreen] Title selection:', {
          titleOverride: params.titleOverride,
          modifiedRecipeTitle: currentModifiedRecipe.title,
          originalRecipeTitle: parsedOriginalRecipe.title,
          displayTitle,
        });
        setRecipeImageUrl(currentModifiedRecipe.image || currentModifiedRecipe.thumbnailUrl || null);
        
        if (currentModifiedRecipe.instructions && Array.isArray(currentModifiedRecipe.instructions)) {
          setInstructions(currentModifiedRecipe.instructions);
        } else {
          console.warn('[StepsScreen] Instructions missing or not an array in modifiedRecipe.');
          setInstructions([]);
        }

        // Flatten ingredients from ingredient groups for backward compatibility
        const flatIngredients: StructuredIngredient[] = [];
        if (currentModifiedRecipe.ingredientGroups && Array.isArray(currentModifiedRecipe.ingredientGroups)) {
          currentModifiedRecipe.ingredientGroups.forEach(group => {
            if (group.ingredients && Array.isArray(group.ingredients)) {
              flatIngredients.push(...group.ingredients);
            }
          });
        }
        setIngredients(flatIngredients);

      } else {
        console.error('[StepsScreen] ❌ No recipe data provided in params');
        showError(
          'Error Loading Steps',
          'Recipe data was not provided. Please go back and try again.',
        );
        setInstructions([]);
        setIsLoading(false);
        return;
      }
    } catch (e: any) {
      console.error('[StepsScreen] ❌ Error parsing recipe data from params:', e);
      showError(
        'Error Loading Steps',
        `Could not load recipe data: ${e.message}. Please go back and try again.`,
      );
      setInstructions([]);
      setIsLoading(false);
      return;
    }
    console.log('[StepsScreen] ✅ Recipe initialization completed, setting isLoading to false');
    setIsLoading(false);
  }, [params.recipeData, params.editedInstructions, params.editedIngredients, params.newTitle, params.originalId, params.appliedChanges, showError]);

  useEffect(() => {
    return () => {
      // This cleanup function runs when the component unmounts
      if (!session) {
        console.log(
          '[StepsScreen] User is NOT authenticated. Marking free recipe used via FreeUsageContext on unmount.',
        );
        markFreeRecipeUsed();
      }
    };
  }, [session, markFreeRecipeUsed]); // Dependencies to ensure it reacts to auth state changes and function stability



  // --- Lifted Timer Logic ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleTimerAddSeconds = (secondsToAdd: number) => {
    if (!isTimerActive) {
      setTimerTimeRemaining((prev) => Math.max(0, prev + secondsToAdd));
    }
  };

  useEffect(() => {
    if (isTimerActive && timerTimeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timerTimeRemaining === 0 && isTimerActive) {
      setIsTimerActive(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      // Optional: Add sound/vibration feedback here
      showError('Timer', "Time's up!");
    }

    // Cleanup interval
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerActive, timerTimeRemaining, showError]);

  const handleTimerStartPause = () => {
    if (timerTimeRemaining > 0) {
      setIsTimerActive((prev) => !prev);
      // Clear interval when pausing explicitly
      if (isTimerActive && timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handleTimerReset = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTimerActive(false);
    setTimerTimeRemaining(0);
  };
  // --- End Lifted Timer Logic ---

  // --- Ingredient Tooltip Logic ---
  const handleIngredientPress = (ingredient: StructuredIngredient) => {
    setSelectedIngredient(ingredient);
    setIsTooltipVisible(true);
  };

  const escapeRegex = (string: string) => {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  const renderHighlightedInstruction = (
    step: string,
    isCompleted: boolean,
    isActive: boolean,
  ) => {
    if (!ingredients || ingredients.length === 0) {
      return (
        <Text
          style={[
            styles.stepText,
            isCompleted && styles.stepTextCompleted,
            isActive && styles.activeStepText,
          ]}
        >
          {step}
        </Text>
      );
    }

    const searchTermsWithIng = ingredients
      .flatMap((ing) => {
        const baseName = ing.name.split(' (substituted for')[0].trim();
        if (!baseName) return [];

        const terms = new Set<string>();
        terms.add(baseName);

        const words = baseName.split(' ');
        if (words.length > 1) {
          words.forEach((word) => {
            if (word.length > 3) {
              terms.add(word);
            }
          });
        }

        const finalTerms = new Set<string>(terms);
        terms.forEach((term) => {
          const lowerTerm = term.toLowerCase();
          if (lowerTerm.endsWith('s')) {
            finalTerms.add(term.slice(0, -1));
          } else {
            if (!term.includes(' ')) {
              finalTerms.add(term + 's');
            }
          }
        });

        return Array.from(finalTerms).map((term) => ({
          ingredient: ing,
          searchTerm: `\\b${escapeRegex(term)}\\b`, // Use word boundaries
        }));
      })
      .filter((item) => item.searchTerm);

    const uniqueSearchTermItems = Array.from(
      new Map(
        searchTermsWithIng.map((item) => [item.searchTerm.toLowerCase(), item]),
      ).values(),
    );
    uniqueSearchTermItems.sort(
      (a, b) => b.searchTerm.length - a.searchTerm.length,
    );

    if (uniqueSearchTermItems.length === 0) {
      return (
        <Text
          style={[
            styles.stepText,
            isCompleted && styles.stepTextCompleted,
            isActive && styles.activeStepText,
          ]}
        >
          {step}
        </Text>
      );
    }

    const regex = new RegExp(
      `(${uniqueSearchTermItems.map((item) => item.searchTerm).join('|')})`,
      'gi',
    );
    const parts = step.split(regex);

    return (
      <Text
        style={[
          styles.stepText,
          isCompleted && styles.stepTextCompleted,
          isActive && styles.activeStepText,
        ]}
      >
        {parts
          .filter((part) => part)
          .map((part, index) => {
            const matchedItem = uniqueSearchTermItems.find(
              (item) => new RegExp(item.searchTerm, 'i').test(part),
            );
            if (matchedItem) {
              return (
                <Text
                  key={index}
                  style={[
                    styles.highlightedText,
                    isCompleted && styles.stepTextCompleted,
                  ]}
                  onPress={
                    !isCompleted
                      ? () => handleIngredientPress(matchedItem.ingredient)
                      : undefined
                  }
                >
                  {part}
                </Text>
              );
            }
            return <Text key={index}>{part}</Text>;
          })}
      </Text>
    );
  };
  // --- End Ingredient Tooltip Logic ---

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const toggleStepCompleted = (index: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));

    // Auto-scroll to next unchecked step after a short delay
    setTimeout(() => {
      const nextUncompletedIndex = instructions.findIndex(
        (_, stepIndex) => stepIndex > index && !completedSteps[stepIndex]
      );
      
      if (nextUncompletedIndex !== -1 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: nextUncompletedIndex * 100, // Approximate height per step
          animated: true,
        });
      }
    }, 200); // 200ms delay for smooth UX
  };

  const openToolsModal = (initialTool: ActiveTool = null) => {
    console.log(
      `Opening tools modal${initialTool ? ` to ${initialTool}` : ''}`,
    );
    setInitialToolToShow(initialTool);
    setIsToolsPanelVisible(true);
  };

  const closeToolsModal = () => {
    setIsToolsPanelVisible(false);
    setInitialToolToShow(null);
  };

  const handleMiniTimerPress = () => {
    openToolsModal('timer');
  };

  const firstUncompletedIndex = instructions.findIndex(
    (_, index) => !completedSteps[index],
  );
  const activeStepIndex =
    firstUncompletedIndex === -1 ? null : firstUncompletedIndex;

  // Calculate progress percentage
  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercentage = instructions.length > 0 ? (completedStepsCount / instructions.length) * 100 : 0;

  // Handle marking mise recipe as complete
  const handleMarkMiseComplete = async () => {
    if (!params.miseRecipeId || !session?.access_token) return;

    setIsLoadingComplete(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('API configuration error');
      }

      const response = await fetch(`${backendUrl}/api/mise/recipes/${params.miseRecipeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: session.user?.id,
          isCompleted: true 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark recipe as complete');
      }

      // Navigate back to mise tab
      router.replace('/tabs/mise' as any);
    } catch (err) {
      console.error('Error marking recipe complete:', err);
      showError('Error', 'Failed to mark recipe as complete. Please try again.');
    } finally {
      setIsLoadingComplete(false);
    }
  };

  // Footer button handlers
  const handleTimersPress = () => {
    openToolsModal('timer');
  };

  const handleAIChatPress = () => {
    openToolsModal('aiChat');
  };

  const handleRecipeTipsPress = () => {
    if (modifiedRecipe?.tips) {
      setIsRecipeTipsModalVisible(true);
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <RecipeStepsHeader title={recipeTitle} imageUrl={recipeImageUrl} />

      <Modal
        transparent
        visible={isHeaderToolsVisible}
        animationType="fade"
        onRequestClose={() => setIsHeaderToolsVisible(false)}
      >
        <Pressable
          style={styles.headerToolsBackdrop}
          onPress={() => setIsHeaderToolsVisible(false)}
        >
          <View style={styles.headerToolsContainer}>
            <TouchableOpacity
              style={styles.headerToolButton}
              onPress={() => {
                setIsHeaderToolsVisible(false);
                openToolsModal('timer');
              }}
            >
              <MaterialCommunityIcons
                name="timer-outline"
                size={24}
                color={COLORS.textDark}
              />
              <Text style={styles.headerToolButtonText}>Timer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerToolButton}
              onPress={() => {
                setIsHeaderToolsVisible(false);
                openToolsModal('units');
              }}
            >
              <MaterialCommunityIcons
                name="ruler"
                size={24}
                color={COLORS.textDark}
              />
              <Text style={styles.headerToolButtonText}>Units</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerToolButton}
              onPress={() => {
                setIsHeaderToolsVisible(false);
                openToolsModal('help');
              }}
            >
              <MaterialCommunityIcons
                name="help-circle-outline"
                size={24}
                color={COLORS.textDark}
              />
              <Text style={styles.headerToolButtonText}>Help</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${progressPercentage}%` }
            ]} 
          />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.stepsContainer}
        showsVerticalScrollIndicator={false}
      >
        {instructions.length > 0 ? (
          instructions.map((step, index) => (
            <TouchableOpacity
              key={`step-${index}`}
              onPress={() => toggleStepCompleted(index)}
              activeOpacity={0.6}
            >
              <Animated.View
                entering={FadeInUp.delay(index * 50).duration(300)}
                style={[
                  styles.stepItem,
                  index === activeStepIndex && styles.activeStep,
                ]}
              >
                <View style={styles.stepNumberContainer}>
                  {completedSteps[index] ? (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={COLORS.primary}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="circle-outline"
                      size={24}
                      color={index === activeStepIndex ? COLORS.primary : COLORS.lightGray}
                    />
                  )}
                </View>

                <View style={styles.stepContent}>
                  {renderHighlightedInstruction(
                    step,
                    !!completedSteps[index],
                    index === activeStepIndex,
                  )}
                </View>
              </Animated.View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.centeredStatusContainerForBanner}>
            <InlineErrorBanner
              message="Could not load recipe steps. Data might be missing or invalid."
              showGoBackButton={true}
            />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {instructions.length > 0 &&
        Object.values(completedSteps).filter(Boolean).length ===
          instructions.length && (
          <Animated.View
            entering={FadeIn.duration(500)}
            style={styles.completionContainer}
          >
            <View style={styles.completionContent}>
              <Text style={styles.completionTitle}>Recipe Completed</Text>
              <Text style={styles.completionText}>Enjoy!</Text>
              
              {/* Mark as Complete button for mise recipes */}
              {params.miseRecipeId && (
                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    isLoadingComplete && styles.completeButtonDisabled
                  ]}
                  onPress={handleMarkMiseComplete}
                  disabled={isLoadingComplete}
                >
                  {isLoadingComplete ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={COLORS.white}
                      />
                      <Text style={styles.completeButtonText}>Mark as Complete</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

      {/* Footer Buttons */}
      <StepsFooterButtons
        onTimersPress={handleTimersPress}
        onAIChatPress={handleAIChatPress}
        onRecipeTipsPress={handleRecipeTipsPress}
        hasRecipeTips={!!modifiedRecipe?.tips}
      />


      <ToolsModal
        isVisible={isToolsPanelVisible}
        onClose={closeToolsModal}
        initialTool={initialToolToShow}
        timerTimeRemaining={timerTimeRemaining}
        isTimerActive={isTimerActive}
        formatTime={formatTime}
        handleTimerAddSeconds={handleTimerAddSeconds}
        handleTimerStartPause={handleTimerStartPause}
        handleTimerReset={handleTimerReset}
        recipeInstructions={instructions}
        recipeSubstitutions={modifiedRecipe?.substitutions_text || null}
      />

      {!isToolsPanelVisible && isTimerActive && timerTimeRemaining > 0 && (
        <MiniTimerDisplay
          timeRemaining={timerTimeRemaining}
          formatTime={formatTime}
          onPress={handleMiniTimerPress}
        />
      )}

      <Modal
        transparent
        visible={isTooltipVisible}
        animationType="fade"
        onRequestClose={() => setIsTooltipVisible(false)}
      >
        <Pressable
          style={styles.tooltipBackdrop}
          onPress={() => setIsTooltipVisible(false)}
        >
          <Pressable style={styles.tooltipContainer}>
            {selectedIngredient && (
              <>
                <Text style={styles.tooltipTitle}>
                  {selectedIngredient.name}
                </Text>
                {(selectedIngredient.amount || selectedIngredient.unit) && (
                  <Text style={styles.tooltipText}>
                    {selectedIngredient.amount || ''}{' '}
                    {abbreviateUnit(selectedIngredient.unit || '')}
                  </Text>
                )}
                {selectedIngredient.preparation && (
                  <Text style={styles.tooltipPreparationText}>
                    {selectedIngredient.preparation}
                  </Text>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Recipe Tips Modal */}
      <Modal
        visible={isRecipeTipsModalVisible}
        animationType="slide"
        onRequestClose={() => setIsRecipeTipsModalVisible(false)}
      >
        <SafeAreaView style={styles.recipeTipsModalContainer}>
          <View style={styles.recipeTipsHeader}>
            <Text style={styles.recipeTipsTitle}>Recipe Tips</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsRecipeTipsModalVisible(false)}
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.white}
              />
            </TouchableOpacity>
          </View>
          <FlatList
            style={styles.recipeTipsList}
            data={modifiedRecipe?.tips?.split(/\.\s+|\n+/).filter(tip => tip.trim()) || []}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.tipItem}>
                <Text style={styles.recipeTipsText}>
                  • {item.trim()}.
                </Text>
              </View>
            )}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.recipeTipsListContent}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 0 : SPACING.smMd,
    paddingBottom: SPACING.smMd,
    borderBottomWidth: BORDER_WIDTH.default,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  backButton: {
    padding: SPACING.sm,
  } as ViewStyle,
  headerLogo: {
    width: IMAGE_SIZE.thumbnail,
    height: IMAGE_SIZE.badge,
    resizeMode: 'center',
    marginTop: SPACING.xxs,
  } as ImageStyle,
  headerMeezText: {
    ...captionText,
    color: COLORS.darkGray,
  },
  stepsContainer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.smMd,
  } as ViewStyle,
  pageTitle: {
    ...titleText,
    color: COLORS.textDark,
    textAlign: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.base,
    lineHeight: FONT.lineHeight.spacious,
  } as TextStyle,
  stepItem: {
    flexDirection: 'row',
    marginBottom: SPACING.smLg,
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  } as ViewStyle,
  activeStep: {
    transform: [{ scale: 1.02 }],
    backgroundColor: '#FFF9EF',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
  } as ViewStyle,
  stepNumberContainer: {
    alignItems: 'center',
    marginRight: SPACING.md,
  } as ViewStyle,
  stepNumberText: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  stepContent: {
    flex: 1,
    paddingBottom: SPACING.smMd,
  } as ViewStyle,
  stepText: {
    ...bodyTextLoose,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textDark,
    marginBottom: SPACING.smMd,
  } as TextStyle,
  stepTextCompleted: {
    color: COLORS.textDark,
    opacity: 0.5,
  } as TextStyle,
  activeStepText: {
    ...bodyTextLoose,
    fontSize: 17,
    lineHeight: 24,
  } as TextStyle,
  highlightedText: {
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.primary,
    fontSize: 16,
    lineHeight: 22,
  } as TextStyle,
  completionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: OVERLAYS.whiteOpaque,
    padding: SPACING.pageHorizontal,
    paddingBottom: SPACING.xxlAlt,
    borderTopLeftRadius: RADIUS.xxxl,
    borderTopRightRadius: RADIUS.xxxl,
    ...SHADOWS.mediumUp,
  } as ViewStyle,
  completionContent: {
    alignItems: 'center',
  } as ViewStyle,
  completionTitle: {
    ...sectionHeaderText,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  } as TextStyle,
  completionText: {
    ...bodyTextLoose,
    color: COLORS.textDark,
    marginBottom: SPACING.smLg,
  } as TextStyle,
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  centeredStatusContainerForBanner: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: SPACING.pageHorizontal,
  } as ViewStyle,
  placeholderText: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    marginTop: 20,
    textAlign: 'center',
  },
  exitButton: {
    padding: SPACING.sm,
  } as ViewStyle,
  headerToolsBackdrop: {
    flex: 1,
    backgroundColor: OVERLAYS.light,
  } as ViewStyle,
  headerToolsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 82 : 48,
    right: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    ...SHADOWS.large,
  } as ViewStyle,
  headerToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.smMd,
    paddingHorizontal: SPACING.smLg,
  } as ViewStyle,
  headerToolButtonText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    marginLeft: SPACING.smMd,
  } as TextStyle,
  // --- Tooltip Styles ---
  tooltipBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: OVERLAYS.light,
  } as ViewStyle,
  tooltipContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.pageHorizontal,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
    ...SHADOWS.small,
  } as ViewStyle,
  tooltipTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  } as TextStyle,
  tooltipText: {
    ...bodyTextLoose,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  tooltipPreparationText: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    marginTop: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,
  // --- Recipe Tips Modal Styles ---
  recipeTipsModalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  recipeTipsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    width: '90%',
    maxWidth: 400,
    height: '60%',
    ...SHADOWS.large,
  } as ViewStyle,
  recipeTipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  } as ViewStyle,
  recipeTipsTitle: {
    ...bodyStrongText,
    color: COLORS.white,
    flex: 1,
  } as TextStyle,
  closeButton: {
    padding: SPACING.xs,
  } as ViewStyle,
  recipeTipsScrollView: {
    flex: 1,
    maxHeight: '100%',
  } as ViewStyle,
  recipeTipsList: {
    flex: 1,
  } as ViewStyle,
  recipeTipsContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  } as ViewStyle,
  recipeTipsListContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  } as ViewStyle,
  recipeTipsText: {
    ...bodyTextLoose,
    color: COLORS.textDark,
    lineHeight: 28,
    fontSize: 17,
  } as TextStyle,
  tipItem: {
    marginBottom: SPACING.md,
  } as ViewStyle,
  // --- Save Button Styles ---
  saveButtonContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? SPACING.lg : SPACING.md,
    left: SPACING.pageHorizontal,
    right: SPACING.pageHorizontal,
    alignItems: 'center',
    zIndex: 10, // Ensure it's above other content
  } as ViewStyle,
  saveButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    width: '100%', // Make it full width of its container
    ...SHADOWS.medium,
  } as ViewStyle,
  saveButtonDisabled: {
    backgroundColor: COLORS.gray,
    opacity: 0.6,
  } as ViewStyle,
  saveButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,

  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  } as ViewStyle,
  completeButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  } as ViewStyle,
  completeButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  } as TextStyle,
  // --- Progress Bar Styles ---
  progressBarContainer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.sm,
  } as ViewStyle,
  progressBarBackground: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
  } as ViewStyle,
  progressBarFill: {
    height: '100%',
    backgroundColor: '#109DF0',
    borderRadius: 2,
  } as ViewStyle,

});
