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
  ViewStyle,
  TextStyle,
  ImageStyle,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
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
import { useHandleError } from '@/hooks/useHandleError';
import InlineErrorBanner from '@/components/InlineErrorBanner';
import { StructuredIngredient, CombinedParsedRecipe as ParsedRecipe, IngredientGroup } from '../../common/types';
import { IngredientChange } from '../../server/llm/modificationPrompts';
import { abbreviateUnit } from '@/utils/format';

// Define AppliedRecipeChanges type for frontend use
type AppliedRecipeChanges = {
  ingredientChanges: IngredientChange[];
  scalingFactor: number;
};
import { useAuth } from '@/context/AuthContext';
import RecipeStepsHeader from '@/components/recipe/RecipeStepsHeader';
import StepsFooterButtons from '@/components/recipe/StepsFooterButtons';
import { useAnalytics } from '@/utils/analytics';
import {
  titleText,
  sectionHeaderText,
  bodyText,
  bodyTextLoose,
  bodyStrongText,
  captionText,
  FONT,
} from '@/constants/typography';

export default function StepsScreen() {
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
  const handleError = useHandleError();
  const { session } = useAuth();
  const { track } = useAnalytics();


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
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  // --- End Lifted Timer State ---

  // --- Auto-scroll State ---
  const scrollViewRef = useRef<ScrollView>(null);
  // --- End Auto-scroll State ---

  // Component mount/unmount logging
  useEffect(() => {
    // Track steps started event
    const trackStepsStarted = async () => {
      const scaled = appliedChanges?.scalingFactor !== 1;
      const substitutions = appliedChanges?.ingredientChanges?.length || 0;
      const modified = substitutions > 0 || scaled;
      console.log('[POSTHOG] Tracking event: steps_started', { 
        scaled, 
        substitutions,
        modified,
        sessionType: 'single_recipe'
      });
      await track('steps_started', { 
        scaled, 
        substitutions,
        modified,
        sessionType: 'single_recipe'
      });
    };
    trackStepsStarted();
  }, []);

  // Timer cleanup - only on component unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setTimerStartTimestamp(null);
    };
  }, []); // Empty dependency array = only runs on unmount

  // Keep screen awake while cooking
  useKeepAwake();

  // Effect to initialize recipe state from params
  useEffect(() => {
    setIsLoading(true);
    try {
      if (params.recipeData) {
        const parsedOriginalRecipe: ParsedRecipe = JSON.parse(params.recipeData);
        setOriginalRecipe(parsedOriginalRecipe); // Store original for reference

        // Start with a deep copy of the original recipe to preserve all fields
        let currentModifiedRecipe: ParsedRecipe = JSON.parse(JSON.stringify(parsedOriginalRecipe));

        // If we have a miseRecipeId, check for local modifications
        if (params.miseRecipeId) {
          // Access the global miseRecipes (we'll need to pass this properly later)
          const getMiseRecipe = (globalThis as any).getMiseRecipe;
          if (getMiseRecipe) {
            const miseRecipe = getMiseRecipe(params.miseRecipeId);
            if (miseRecipe?.local_modifications?.modified_recipe_data) {
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

        // Update legacy state for backward compatibility with existing UI components
        // Use titleOverride if available, otherwise use the modified recipe title
        const displayTitle = params.titleOverride || currentModifiedRecipe.title || 'Instructions';
        setRecipeTitle(displayTitle);
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
        handleError('Error Loading Steps', 'Recipe data was not provided. Please go back and try again.');
        setInstructions([]);
        setIsLoading(false);
        return;
      }
    } catch (e: any) {
      console.error('[StepsScreen] ❌ Error parsing recipe data from params:', e);
      handleError('Error Loading Steps', e);
      setInstructions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  }, [params.recipeData, params.editedInstructions, params.editedIngredients, params.newTitle, params.originalId, params.appliedChanges, showError]);

  useEffect(() => {
          return () => {
        // This cleanup function runs when the component unmounts
      };
    }, []);



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
    if (isTimerActive && timerTimeRemaining > 0 && timerStartTimestamp) {
      timerIntervalRef.current = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        const newTimeRemaining = Math.max(0, timerTimeRemaining - elapsedSeconds);
        
        if (newTimeRemaining <= 0) {
          // Timer finished
          setIsTimerActive(false);
          setTimerStartTimestamp(null);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setTimerTimeRemaining(0);
          // Optional: Add sound/vibration feedback here
          handleError('Timer', "Time's up!");
        } else {
          setTimerTimeRemaining(newTimeRemaining);
        }
      }, 1000);
    }

    // Cleanup interval
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerActive, timerTimeRemaining, timerStartTimestamp, showError]);

  const handleTimerStartPause = () => {
    if (timerTimeRemaining > 0) {
      if (isTimerActive) {
        // Pause timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setTimerStartTimestamp(null);
        setIsTimerActive(false);
      } else {
        // Start timer
        const startTime = Date.now();
        setTimerStartTimestamp(startTime);
        setIsTimerActive(true);
      }
    }
  };

  const handleTimerReset = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTimerActive(false);
    setTimerStartTimestamp(null);
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

  // Handle ending cooking session
  const handleEndCookingSession = async () => {
    if (!session?.access_token) {
      router.back();
      return;
    }

    // If this is a mise recipe, mark it as complete
    if (params.miseRecipeId) {
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
    } else {
      // For non-mise recipes, just navigate back
      router.back();
    }
  };

  // Footer button handlers
  const handleTimersPress = () => {
    openToolsModal('timer');
  };



  const handleRecipeTipsPress = () => {
    if (modifiedRecipe?.tips) {
      setIsRecipeTipsModalVisible(true);
    }
  };

  const handleSwipeGesture = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Swipe from left edge to go back
      if (translationX > 100 && velocityX > 300) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Check if we can go back properly, otherwise navigate to mise as fallback
        if (router.canGoBack()) {
          router.back();
        } else {
          // Navigate back to mise tab
          router.navigate('/tabs/mise' as any);
        }
      }
    }
  };



  return (
    <PanGestureHandler onHandlerStateChange={handleSwipeGesture}>
      <SafeAreaView style={styles.container}>
      <RecipeStepsHeader title={recipeTitle} imageUrl={recipeImageUrl} />

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
        message="We couldn't load the steps. Data might be missing or invalid."
              showGoBackButton={true}
            />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>



      {/* Footer Buttons */}
      <StepsFooterButtons
        onTimersPress={handleTimersPress}
        onRecipeTipsPress={handleRecipeTipsPress}
        hasRecipeTips={!!modifiedRecipe?.tips}
        onEndCookingSessions={handleEndCookingSession}
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
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsRecipeTipsModalVisible(false)}
      >
        <Pressable
          style={styles.recipeTipsModalOverlay}
          onPress={() => setIsRecipeTipsModalVisible(false)}
        >
          <Pressable style={styles.recipeTipsModalContent}>
            <View style={styles.recipeTipsHeader}>
              <View style={styles.recipeTipsHeaderContent}>
                <MaterialCommunityIcons
                  name="lightbulb-outline"
                  size={24}
                  color={COLORS.primary}
                />
                <Text style={styles.recipeTipsTitle}>Recipe Tips</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsRecipeTipsModalVisible(false)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
            
            <FlatList
              style={styles.recipeTipsList}
              data={modifiedRecipe?.tips?.split(/\.\s+|\n+/).filter(tip => tip.trim()) || []}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.tipItem}>
                  <View style={styles.tipNumberContainer}>
                    <Text style={styles.tipNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.tipContent}>
                    <Text style={styles.recipeTipsText}>
                      {item.trim()}
                    </Text>
                  </View>
                </View>
              )}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.recipeTipsListContent}
            />
          </Pressable>
        </Pressable>
      </Modal>
      </SafeAreaView>
    </PanGestureHandler>
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
  recipeTipsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
  } as ViewStyle,
  recipeTipsModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    height: '70%',
    ...SHADOWS.large,
  } as ViewStyle,
  recipeTipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
  } as ViewStyle,
  recipeTipsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  } as ViewStyle,
  recipeTipsTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 18,
  } as TextStyle,
  closeButton: {
    padding: SPACING.xs,
  } as ViewStyle,
  recipeTipsList: {
    flex: 1,
    minHeight: 0,
  } as ViewStyle,
  recipeTipsListContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  } as ViewStyle,
  tipItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  } as ViewStyle,
  tipNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  } as ViewStyle,
  tipNumber: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  } as TextStyle,
  tipContent: {
    flex: 1,
  } as ViewStyle,
  recipeTipsText: {
    ...bodyTextLoose,
    color: COLORS.textDark,
    lineHeight: 24,
    fontSize: 16,
  } as TextStyle,
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
