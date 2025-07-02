import React from 'react';
import { useState, useEffect, useRef } from 'react';
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
import { IngredientChange } from '../../server/llm/substitutionPrompts';
import { abbreviateUnit } from '@/utils/format';

// Define AppliedRecipeChanges type for frontend use
type AppliedRecipeChanges = {
  ingredientChanges: IngredientChange[];
  scalingFactor: number;
};
import {
  titleText,
  sectionHeaderText,
  bodyText,
  bodyTextLoose,
  bodyStrongText,
  captionText,
  FONT,
} from '@/constants/typography';
import { parseAmountString } from '@/utils/recipeUtils';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';
import RecipeStepsHeader from '@/components/recipe/RecipeStepsHeader';

const screenWidth = Dimensions.get('window').width;

export default function StepsScreen() {
  const params = useLocalSearchParams<{
    originalId?: string; // The ID of the original recipe from processed_recipes_cache
    recipeData?: string; // The original CombinedParsedRecipe (stringified)
    editedInstructions?: string; // LLM-rewritten instructions (stringified array)
    editedIngredients?: string; // Scaled/substituted ingredients (stringified array of IngredientGroup)
    newTitle?: string; // LLM-suggested new title
    appliedChanges?: string; // The AppliedRecipeChanges object (stringified)
  }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  const { session } = useAuth();
  const { markFreeRecipeUsed } = useFreeUsage();

  // State for save modified recipe functionality
  const [isLoadingSave, setIsLoadingSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // --- Lifted Timer State ---
  const [timerTimeRemaining, setTimerTimeRemaining] = useState(0); // Time in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<any>(null);
  // --- End Lifted Timer State ---

  // Effect to initialize recipe state from params
  useEffect(() => {
    setIsLoading(true);
    try {
      if (params.recipeData) {
        const parsedOriginalRecipe: ParsedRecipe = JSON.parse(params.recipeData);
        setOriginalRecipe(parsedOriginalRecipe); // Store original for reference

        // Start with a deep copy of the original recipe to preserve all fields
        const currentModifiedRecipe: ParsedRecipe = JSON.parse(JSON.stringify(parsedOriginalRecipe));

        // Apply specific modifications passed from summary.tsx
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
        });

        // Update legacy state for backward compatibility with existing UI components
        setRecipeTitle(currentModifiedRecipe.title || 'Instructions');
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
        showError(
          'Error Loading Steps',
          'Recipe data was not provided. Please go back and try again.',
        );
        setInstructions([]);
        setIsLoading(false);
        return;
      }
    } catch (e: any) {
      console.error('Error parsing recipe data from params:', e);
      showError(
        'Error Loading Steps',
        `Could not load recipe data: ${e.message}. Please go back and try again.`,
      );
      setInstructions([]);
      setIsLoading(false);
      return;
    }
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

  // Function to handle saving the modified recipe
  const handleSaveModifiedRecipe = async () => {
    setSaveError(null); // Clear any previous errors
    setIsLoadingSave(true);

    if (!modifiedRecipe || !originalRecipeId || !appliedChanges || !session?.user?.id) {
      const errorMessage = 'Missing data to save the modified recipe. Please ensure all modifications are applied and you are logged in.';
      setSaveError(errorMessage);
      showError('Save Failed', errorMessage);
      setIsLoadingSave(false);
      return;
    }

    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('Backend API URL is not configured.');
      }

      const payload = {
        originalRecipeId: originalRecipeId,
        userId: session.user.id,
        modifiedRecipeData: modifiedRecipe, // The fully reconstructed recipe
        appliedChanges: appliedChanges, // The metadata about changes
      };

      console.log('[StepsScreen] Saving modified recipe:', {
        originalRecipeId,
        userId: session.user.id,
        title: modifiedRecipe.title,
        changesCount: appliedChanges.ingredientChanges.length,
        scalingFactor: appliedChanges.scalingFactor,
        hasImage: !!modifiedRecipe.image,
        hasThumbnail: !!modifiedRecipe.thumbnailUrl,
        imageUrl: modifiedRecipe.image || 'MISSING',
      });

      const response = await fetch(`${backendUrl}/api/recipes/save-modified`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `Failed to save modified recipe: ${response.statusText}`;
        setSaveError(errorMsg);
        showError('Save Failed', errorMsg);
        return;
      }

      console.log('[StepsScreen] Modified recipe saved successfully:', data);

      // Show success message
      showError('Recipe Saved!', `${modifiedRecipe.title} has been saved to your collection.`);

      // Navigate to the saved recipes screen
      router.push('/tabs/saved');

    } catch (error) {
      const errMsg = (error as Error).message || 'An unexpected error occurred while saving the recipe.';
      setSaveError(errMsg);
      showError('Save Failed', errMsg);
      console.error('[StepsScreen] Error saving modified recipe:', error);
    } finally {
      setIsLoadingSave(false);
    }
  };

  // Helper function to check if recipe has been modified
  const hasModifications = () => {
    if (!appliedChanges) return false;
    return appliedChanges.ingredientChanges.length > 0; // Only allow saving if ingredients were substituted/removed
  };

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
          searchTerm: term,
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
      `(${uniqueSearchTermItems.map((item) => escapeRegex(item.searchTerm)).join('|')})`,
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
              (item) => item.searchTerm.toLowerCase() === part.toLowerCase(),
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

      <ScrollView
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
                  <View
                    style={[
                      styles.stepNumber,
                      completedSteps[index] && styles.stepNumberCompleted,
                    ]}
                  >
                    {completedSteps[index] ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={24}
                        color={COLORS.white}
                      />
                    ) : (
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    )}
                  </View>
                  {index < instructions.length - 1 &&
                    !completedSteps[index] && (
                      <View style={styles.stepConnector} />
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
            </View>
          </Animated.View>
        )}

      {/* Save Modified Recipe Button */}
      {hasModifications() && modifiedRecipe && originalRecipeId && appliedChanges && session?.user?.id && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              isLoadingSave && styles.saveButtonDisabled
            ]}
            onPress={handleSaveModifiedRecipe}
            disabled={isLoadingSave}
          >
            {isLoadingSave ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="bookmark-plus"
                  size={20}
                  color={COLORS.white}
                  style={{ marginRight: SPACING.sm }}
                />
                <Text style={styles.saveButtonText}>Save Modified Recipe</Text>
              </>
            )}
          </TouchableOpacity>
          {saveError && (
            <Text style={styles.saveErrorText}>{saveError}</Text>
          )}
        </View>
      )}

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
    padding: SPACING.smAlt,
    borderRadius: RADIUS.smMd,
  } as ViewStyle,
  activeStep: {
    transform: [{ scale: 1.02 }],
    backgroundColor: OVERLAYS.extraLight,
    ...SHADOWS.small,
  } as ViewStyle,
  stepNumberContainer: {
    alignItems: 'center',
    marginRight: SPACING.md,
  } as ViewStyle,
  stepNumber: {
    width: ICON_SIZE.xxl,
    height: ICON_SIZE.xxl,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.thick,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  stepNumberCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  } as ViewStyle,
  stepNumberText: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  stepConnector: {
    width: BORDER_WIDTH.thick,
    flex: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: SPACING.xs,
  } as ViewStyle,
  stepContent: {
    flex: 1,
    paddingBottom: SPACING.smMd,
  } as ViewStyle,
  stepText: {
    ...bodyTextLoose,
    color: COLORS.textDark,
    marginBottom: SPACING.smMd,
  } as TextStyle,
  stepTextCompleted: {
    color: COLORS.gray,
    textDecorationLine: 'line-through',
  } as TextStyle,
  activeStepText: {
    ...bodyTextLoose,
    fontSize: FONT.size.lg,
    lineHeight: 26,
  } as TextStyle,
  highlightedText: {
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.primary,
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
  saveErrorText: {
    ...captionText,
    color: COLORS.error,
    marginTop: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,
});
