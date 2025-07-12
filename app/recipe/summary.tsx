import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
  ViewStyle,
  TextStyle,
  ImageStyle,
  InteractionManager,
  FlatList,
  Modal,
  Pressable,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
// Import FastImage from the new library
import FastImage from '@d11/react-native-fast-image';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { decode } from 'he';
import {
  COLORS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
  OVERLAYS,
  SHADOWS,
} from '@/constants/theme';
import {
  scaleIngredient,
  parseServingsValue,
  getScaledYieldText,
  parseAmountString,
  formatAmountNumber,
} from '@/utils/recipeUtils'; // Correct import path assuming utils is under root/src or similar alias
import {
  StructuredIngredient,
  CombinedParsedRecipe as ParsedRecipe,
  SubstitutionSuggestion,
  IngredientGroup,
} from '../../common/types';
import {
  coerceToStructuredIngredients,
  coerceToIngredientGroups,
  parseIngredientDisplayName,
} from '@/utils/ingredientHelpers';
import { useErrorModal } from '@/context/ErrorModalContext';
import InlineErrorBanner from '@/components/InlineErrorBanner';
import {
  sectionHeaderText,
  bodyText,
  captionStrongText,
  bodyStrongText,
  captionText,
  FONT,
} from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import IngredientSubstitutionModal from '@/app/recipe/IngredientSubstitutionModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CollapsibleSection from '@/components/CollapsibleSection';
import IngredientList from '@/components/recipe/IngredientList';
import ServingScaler from '@/components/recipe/ServingScaler';
import RecipeFooterButtons from '@/components/recipe/RecipeFooterButtons';

import RecipeStepsHeader from '@/components/recipe/RecipeStepsHeader';

// Type for a change (substitution or removal)
type AppliedChange = {
  from: string;
  to: StructuredIngredient | null;
};

const ALLERGENS = [
  {
    key: 'dairy',
    match: [
      'milk',
      'cheese',
      'butter',
      'cream',
      'yogurt',
      'feta',
      'parmesan',
      'mozzarella',
      'ricotta',
      'custard',
      'whey',
    ],
  },
  {
    key: 'nuts',
    match: [
      'almond',
      'cashew',
      'walnut',
      'pecan',
      'hazelnut',
      'macadamia',
      'pistachio',
      'brazil nut',
      'nut butter',
      'nut',
    ],
  },
  {
    key: 'peanuts',
    match: ['peanut', 'peanut butter'],
  },
  {
    key: 'gluten',
    match: [
      'flour',
      'wheat',
      'bread',
      'breadcrumbs',
      'pasta',
      'semolina',
      'barley',
      'rye',
      'spelt',
      'farro',
      'bulgur',
      'couscous',
    ],
  },
  {
    key: 'soy',
    match: ['soy', 'soybean', 'tofu', 'tempeh', 'edamame', 'soy sauce'],
  },
  {
    key: 'egg',
    match: ['egg', 'mayonnaise', 'mayo', 'aioli'],
  },
  {
    key: 'shellfish',
    match: [
      'shrimp',
      'prawn',
      'crab',
      'lobster',
      'clam',
      'mussel',
      'scallop',
      'oyster',
      'langoustine',
    ],
  },
  {
    key: 'fish',
    match: [
      'salmon',
      'tuna',
      'cod',
      'trout',
      'haddock',
      'anchovy',
      'sardine',
      'mackerel',
      'halibut',
      'bass',
      'snapper',
    ],
  },
  {
    key: 'sesame',
    match: ['sesame', 'tahini'],
  },
  {
    key: 'mustard',
    match: ['mustard', 'mustard seed'],
  },
];

const extractAllergens = (
  ingredientGroups: IngredientGroup[] | null,
): string[] => {
  if (!ingredientGroups || ingredientGroups.length === 0) return [];

  // Flatten all ingredients from all groups
  const allIngredients: StructuredIngredient[] = [];
  ingredientGroups.forEach(group => {
    if (group.ingredients && Array.isArray(group.ingredients)) {
      allIngredients.push(...group.ingredients);
    }
  });

  if (allIngredients.length === 0) return [];

  const ingredientNames = allIngredients.map(
    (i) => i.name?.toLowerCase().trim().normalize('NFKC') ?? '',
  );

  return ALLERGENS.filter((allergen) =>
    ingredientNames.some((name) =>
      allergen.match.some((term) => name.includes(term)),
    ),
  ).map((allergen) => allergen.key);
};

// --- Calculate Button Widths ---
const screenWidth = Dimensions.get('window').width;
const contentHorizontalPadding = SPACING.pageHorizontal;
const servingsContainerGap = SPACING.sm;
const numButtons = 5;
const availableWidth = screenWidth - contentHorizontalPadding * 2;
const buttonTotalGap = servingsContainerGap * (numButtons - 1);
const buttonWidth = (availableWidth - buttonTotalGap) / numButtons;

// --- End Types ---

export default function RecipeSummaryScreen() {
  const params = useLocalSearchParams<{ recipeData?: string; from?: string; appliedChanges?: string; isModified?: string }>();
  const router = useRouter();
  const { showError, hideError } = useErrorModal();
  const { session } = useAuth();

  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isAllergensExpanded, setIsAllergensExpanded] = useState(false);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isRecipeSizeExpanded, setIsRecipeSizeExpanded] = useState(false);
  const [isDescriptionTextExpanded, setIsDescriptionTextExpanded] = useState(false);
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false);

  const [originalYieldValue, setOriginalYieldValue] = useState<number | null>(
    null,
  );
  const [selectedScaleFactor, setSelectedScaleFactor] = useState<number>(1.0);

  const [substitutionModalVisible, setSubstitutionModalVisible] =
    useState(false);
  const [selectedIngredient, setSelectedIngredient] =
    useState<StructuredIngredient | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isScalingInstructions, setIsScalingInstructions] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [preparationComplete, setPreparationComplete] = useState(false);
  const [preparedRecipeData, setPreparedRecipeData] = useState<any>(null);
  const [selectedIngredientOriginalData, setSelectedIngredientOriginalData] =
    useState<StructuredIngredient | null>(null);
  const [processedSubstitutionsForModal, setProcessedSubstitutionsForModal] =
    useState<SubstitutionSuggestion[] | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{
    from: string;
    to: string | null;
  } | null>(null);

  // Determine if we're viewing a saved recipe (clean display) vs actively editing (show indicators)
  const isViewingSavedRecipe = !!params.appliedChanges;

  const scaledIngredientGroups = React.useMemo<IngredientGroup[]>(() => {
    if (!recipe?.ingredientGroups) return [];
    
    return recipe.ingredientGroups.map(group => {
      if (!group.ingredients || !Array.isArray(group.ingredients)) {
        return { ...group, ingredients: [] };
      }

      const scaledIngredients = group.ingredients.map((ingredient) =>
        scaleIngredient(ingredient, selectedScaleFactor),
      );

      let finalIngredients = scaledIngredients;
      if (appliedChanges.length > 0) {
        if (isViewingSavedRecipe) {
          // Clean display for saved recipes: filter out removed, cleanly replace substituted
          finalIngredients = scaledIngredients
            .map((baseIngredient) => {
              // Parse the display name to get the original name without "(removed)" or "(substituted for X)" text
              const { baseName: originalName } = parseIngredientDisplayName(baseIngredient.name);
              const change = appliedChanges.find((c) => c.from === originalName);
              
              if (change) {
                if (change.to === null) {
                  // Mark for removal (will be filtered out)
                  return null;
                }
                // Replace with substituted ingredient (no visual indicators)
                return {
                  ...change.to,
                  // Keep the substituted ingredient's name as-is
                };
              }
              return baseIngredient;
            })
            .filter((ingredient): ingredient is StructuredIngredient => ingredient !== null);
        } else {
          // Active editing: show visual indicators for user feedback
          finalIngredients = scaledIngredients.map((baseIngredient) => {
            const change = appliedChanges.find((c) => c.from === baseIngredient.name);
            if (change) {
              if (change.to === null) {
                return {
                  ...baseIngredient,
                  name: `${baseIngredient.name} (removed)`,
                  amount: null,
                  unit: null,
                  suggested_substitutions: null,
                };
              }
              return {
                ...change.to,
                name: `${change.to.name} (substituted for ${change.from})`,
              };
            }
            return baseIngredient;
          });
        }
      }

      return {
        ...group,
        ingredients: finalIngredients,
      };
    });
  }, [recipe, selectedScaleFactor, appliedChanges, isViewingSavedRecipe]);

  // Keep scaledIngredients as a flat array for backward compatibility with existing code
  const scaledIngredients = React.useMemo<StructuredIngredient[]>(() => {
    const allIngredients: StructuredIngredient[] = [];
    scaledIngredientGroups.forEach(group => {
      if (group.ingredients && Array.isArray(group.ingredients)) {
        allIngredients.push(...group.ingredients);
      }
    });
    return allIngredients;
  }, [scaledIngredientGroups]);

  useEffect(() => {
    if (params.recipeData) {
      try {
        const parsed = JSON.parse(params.recipeData as string);
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
          showError('Error Loading Summary', 'Recipe data is invalid.');
          setIsLoading(false);
          return;
        }
        setRecipe(parsed);
        const yieldNum = parseServingsValue(parsed.recipeYield);
        setOriginalYieldValue(yieldNum);
        
        // Check if this is a saved recipe with existing applied changes
        if (params.appliedChanges) {
          try {
            const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
            // Convert saved format to internal format
            if (savedAppliedChanges.ingredientChanges) {
              const convertedChanges: AppliedChange[] = savedAppliedChanges.ingredientChanges.map((change: any) => ({
                from: change.from,
                to: change.to ? { 
                  name: change.to, 
                  amount: null, 
                  unit: null, 
                  preparation: null, 
                  suggested_substitutions: null 
                } : null,
              }));
              setAppliedChanges(convertedChanges);
            }
            // Set scaling factor from saved changes
            if (savedAppliedChanges.scalingFactor) {
              setSelectedScaleFactor(savedAppliedChanges.scalingFactor);
            } else {
              setSelectedScaleFactor(1.0);
            }
          } catch (appliedChangesError: any) {
            console.error('Error parsing applied changes:', appliedChangesError);
            setSelectedScaleFactor(1.0);
            setAppliedChanges([]);
          }
        } else {
          // New recipe, no existing changes
          setSelectedScaleFactor(1.0);
          setAppliedChanges([]);
        }
        

      } catch (e: any) {
        showError('Error Loading Summary', `Could not load recipe details: ${e.message}.`);
      }
    } else {
      showError('Error Loading Summary', 'Recipe data not provided.');
    }
    setIsLoading(false);
  }, [params.recipeData, params.appliedChanges, showError]);

  const detectedAllergens = React.useMemo(() => {
    if (!recipe) return [];
    return extractAllergens(recipe.ingredientGroups);
  }, [recipe]);

  const handleScaleFactorChange = (factor: number) => setSelectedScaleFactor(factor);



  const openSubstitutionModal = React.useCallback(
    (ingredient: StructuredIngredient) => {
      let scaledSuggestions: SubstitutionSuggestion[] | null = null;
      if (ingredient.suggested_substitutions && selectedScaleFactor !== 1) {
        const scalingFactor = selectedScaleFactor;
        scaledSuggestions = ingredient.suggested_substitutions.map((sub) => {
          let finalAmount: string | number | null = sub.amount ?? null;
          if (sub.amount != null) {
            const parsedAmount = parseAmountString(String(sub.amount));
            if (parsedAmount !== null) {
              const calculatedAmount = parsedAmount * scalingFactor;
              finalAmount = formatAmountNumber(calculatedAmount) || calculatedAmount.toFixed(2);
            }
          }
          return { ...sub, amount: finalAmount };
        });
      } else {
        scaledSuggestions = ingredient.suggested_substitutions || null;
      }
      setSelectedIngredientOriginalData(ingredient);
      setProcessedSubstitutionsForModal(scaledSuggestions);
      setSubstitutionModalVisible(true);
    },
    [selectedScaleFactor],
  );

  const onApplySubstitution = (substitution: SubstitutionSuggestion) => {
    if (!selectedIngredientOriginalData) return;

    const ingredientToSubstitute = selectedIngredientOriginalData;
    setSubstitutionModalVisible(false);
    setSelectedIngredientOriginalData(null);
    setProcessedSubstitutionsForModal(null);

    InteractionManager.runAfterInteractions(() => {
      if (substitution.name === 'Remove ingredient') {
        const currentRemovals = appliedChanges.filter((c) => !c.to).length;
        if (currentRemovals >= 2) {
          showError('Limit Reached', 'You can only remove up to 2 ingredients.');
          return;
        }
      }

      const isRemoval = substitution.name === 'Remove ingredient';
      let originalNameForSub = ingredientToSubstitute.name;
      const { substitutedFor } = parseIngredientDisplayName(ingredientToSubstitute.name);
      if (substitutedFor) originalNameForSub = substitutedFor;
      
      const newChange: AppliedChange = {
        from: originalNameForSub,
        to: isRemoval
          ? null
          : {
              name: substitution.name,
              amount: substitution.amount != null ? String(substitution.amount) : null,
              unit: substitution.unit ?? null,
              preparation: substitution.description ?? null,
              suggested_substitutions: null,
            },
      };

      if (isRemoval) setLastRemoved({ from: newChange.from, to: null });

      setAppliedChanges((prev) => {
        const existingChangeIndex = prev.findIndex((c) => c.from === originalNameForSub);
        if (existingChangeIndex > -1) {
          const updated = [...prev];
          updated[existingChangeIndex] = newChange;
          return updated;
        }
        return [...prev, newChange];
      });
    });
  };

  const undoIngredientRemoval = React.useCallback(
    (fullName: string) => {
      const { baseName: originalName } = parseIngredientDisplayName(fullName);
      setAppliedChanges((prev) => prev.filter((change) => change.from !== originalName));
      if (lastRemoved?.from === originalName) setLastRemoved(null);
    },
    [lastRemoved],
  );

  const undoSubstitution = React.useCallback((originalName: string) => {
    setAppliedChanges((prev) => prev.filter((change) => change.from !== originalName));
  }, []);

  const cleanTitle = recipe?.title?.replace(/\s*(?:[–-]\s*)?by\s+.*$/i, '').replace(/\s+recipe\s*$/i, '').trim();

  // Swipe to go back gesture handler
  const onSwipeGesture = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      // Detect swipe from left edge with sufficient distance and velocity
      // Right-to-left swipe: translationX > 100 means swipe toward the right (from left edge)
      if (translationX > 100 && velocityX > 300) {
        // Check if we can go back properly, otherwise navigate to home as fallback
        if (router.canGoBack()) {
          router.back();
        } else {
          // This shouldn't normally happen since users should always come from somewhere
          console.warn('[Summary] No previous screen found, navigating to home as fallback');
          router.navigate('/tabs' as any);
        }
      }
    }
  };

  const navigateToNextScreen = React.useCallback(async () => {
    const removalCount = appliedChanges.filter((c) => !c.to).length;
    if (removalCount > 2) {
      showError('Limit Reached', 'You can only remove up to 2 ingredients per recipe.');
      return;
    }

    if (!recipe || !scaledIngredients) {
      console.error('Cannot navigate, essential data is missing.');
      return;
    }

    let finalInstructions = recipe.instructions || [];
    let newTitle: string | null = null; // Capture new title from LLM if suggested
    const needsScaling = selectedScaleFactor !== 1;

    // --- 1. Handle Substitution Rewriting (if applicable) ---
    if (appliedChanges.length > 0) {
      setIsRewriting(true);
      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
        const response = await fetch(`${backendUrl}/api/recipes/rewrite-instructions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalInstructions: recipe.instructions || [],
            substitutions: appliedChanges.map((change) => ({
              from: change.from,
              to: change.to ? change.to.name : null,
            })),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Rewrite failed (Status: ${response.status})`);
        if (!result.rewrittenInstructions) throw new Error('Invalid format for rewritten instructions.');
        finalInstructions = result.rewrittenInstructions;
        
        // Capture new title if suggested by LLM
        if (result.newTitle && result.newTitle.trim() !== '') {
          newTitle = result.newTitle;
        }
      } catch (rewriteError: any) {
        showError('Update Failed', `Couldn't update steps for substitutions: ${rewriteError.message}`);
        return; // Stop navigation on failure
      } finally {
        setIsRewriting(false);
      }
    }

    // --- 2. Handle Instruction Scaling (if applicable) ---
    if (needsScaling && scaledIngredients.length > 0) {
      setIsScalingInstructions(true);
      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
        // Flatten all ingredients from ingredient groups for scaling
        const allIngredients: StructuredIngredient[] = [];
        if (recipe.ingredientGroups) {
          recipe.ingredientGroups.forEach(group => {
            if (group.ingredients && Array.isArray(group.ingredients)) {
              allIngredients.push(...group.ingredients);
            }
          });
        }
        const originalIngredients = allIngredients;
        const response = await fetch(`${backendUrl}/api/recipes/scale-instructions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructionsToScale: finalInstructions,
            originalIngredients: originalIngredients,
            scaledIngredients: scaledIngredients,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Scaling failed (Status: ${response.status})`);
        if (!result.scaledInstructions) throw new Error('Invalid format for scaled instructions.');
        finalInstructions = result.scaledInstructions;
      } catch (scalingError: any) {
        showError('Update Failed', `Couldn't adjust steps for scaling: ${scalingError.message}`);
        return; // Stop navigation on failure
      } finally {
        setIsScalingInstructions(false);
      }
    }

    // --- 3. Save Prepared Recipe to Mise Table ---
    const finalRecipeData = {
      // Pass the ORIGINAL recipe data with all metadata intact
      ...recipe,
      // Update the yield text and instructions for the prepared version
      recipeYield: getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
      instructions: finalInstructions,
      ingredientGroups: scaledIngredientGroups,
    };

    const appliedChangesData = {
      ingredientChanges: appliedChanges.map((change) => ({
        from: change.from,
        to: change.to ? change.to.name : null, // Convert StructuredIngredient to string
      })),
      scalingFactor: selectedScaleFactor,
    };

    // Check authentication before saving
    if (!session?.user?.id) {
      showError(
        'Account Required',
        'You need an account to prepare your mise en place. Sign up to save your recipes!',
        undefined,
        () => {
          hideError();
          router.push('/login');
        }
      );
      return;
    }

    // Save to mise table
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
      const response = await fetch(`${backendUrl}/api/mise/save-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id,
          originalRecipeId: recipe.id,
          preparedRecipeData: finalRecipeData,
          appliedChanges: appliedChangesData,
          finalYield: getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
          titleOverride: newTitle || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Save failed (Status: ${response.status})`);

      // Store the mise recipe ID for navigation
      setPreparedRecipeData({ miseRecipeId: result.miseRecipe.id, ...finalRecipeData });
      setPreparationComplete(true);

    } catch (saveError: any) {
      showError('Save Failed', `Couldn't save recipe to mise: ${saveError.message}`);
      return; // Stop execution on failure
    }
  }, [recipe, scaledIngredients, scaledIngredientGroups, appliedChanges, router, showError, selectedScaleFactor, session]);

  const handleGoToSteps = () => InteractionManager.runAfterInteractions(navigateToNextScreen);

  const handleGoToRecipeSteps = () => {
    if (!preparedRecipeData) return;
    
    setPreparationComplete(false);
    router.push({
      pathname: '/recipe/steps',
      params: {
        originalId: recipe?.id?.toString() || '',
        recipeData: JSON.stringify(preparedRecipeData),
        editedInstructions: JSON.stringify(preparedRecipeData.instructions || []),
        editedIngredients: JSON.stringify(preparedRecipeData.ingredientGroups || []),
        newTitle: 'null', // Title is already in preparedRecipeData
        appliedChanges: JSON.stringify({
          ingredientChanges: appliedChanges.map((change) => ({
            from: change.from,
            to: change.to ? change.to.name : null,
          })),
          scalingFactor: selectedScaleFactor,
        }),
      },
    });
  };

  const handleGoToMise = () => {
    setPreparationComplete(false);
    router.replace('/tabs/mise' as any);
  };

  const handleGoHome = () => {
    setPreparationComplete(false);
    router.replace('/tabs' as any);
  };

  const handleSaveForLater = async () => {
    if (!recipe?.id || !session?.user) {
      showError(
        'Account Required',
        'You need an account to save recipes. Sign up to save your recipes!',
        undefined,
        () => {
          hideError();
          router.push('/login');
        }
      );
      return;
    }

    try {
      const { saveRecipe } = require('@/lib/savedRecipes');
      const success = await saveRecipe(recipe.id);
      if (success) {
        setPreparationComplete(false);
        router.replace('/tabs/saved' as any);
      } else {
        showError('Save Failed', 'Could not save recipe. Please try again.');
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      showError('Save Failed', 'Could not save recipe. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <InlineErrorBanner message="Could not load recipe summary." showGoBackButton />
      </SafeAreaView>
    );
  }

  return (
    <PanGestureHandler onHandlerStateChange={onSwipeGesture}>
      <SafeAreaView style={styles.container}>
      {/* Modals */}
      {substitutionModalVisible && selectedIngredientOriginalData && (
        <IngredientSubstitutionModal
          visible={substitutionModalVisible}
          onClose={() => setSubstitutionModalVisible(false)}
          ingredientName={selectedIngredientOriginalData.name}
          substitutions={processedSubstitutionsForModal}
          onApply={onApplySubstitution}
        />
      )}
      
      {/* Success Modal */}
      <Modal
        visible={preparationComplete}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreparationComplete(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPreparationComplete(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={48}
              color={COLORS.success}
              style={styles.successIcon}
            />
            <Text style={styles.modalTitle}>Added to Mise</Text>
            <Text style={styles.modalMessage}>
              We've prepped your mise for you. This recipe is now ready for cooking.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={handleGoToMise}
              >
                <MaterialCommunityIcons
                  name="chef-hat"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.secondaryButtonText}>Go to Mise</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={handleGoToRecipeSteps}
              >
                <MaterialCommunityIcons
                  name="play"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.secondaryButtonText}>Cook This Now</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      <RecipeStepsHeader
        title={cleanTitle}
        imageUrl={recipe.image || recipe.thumbnailUrl}
        recipe={recipe}
      />

      {/* Sharp divider to separate title from content */}
      <View style={styles.titleDivider} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe image at the very top of the scrollable content */}
        {(recipe.image || recipe.thumbnailUrl) && (
          <FastImage
            source={{ uri: String(recipe.image || recipe.thumbnailUrl) }}
            style={{
              width: '100%',
              height: 150, // match previous max height
              borderRadius: RADIUS.md,
              marginBottom: SPACING.md,
              marginTop: 0,
            }}
            resizeMode="cover"
          />
        )}


        <CollapsibleSection
          title="More About This Recipe"
          isExpanded={isDescriptionExpanded} // Use state to control expansion
          onToggle={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
        >
          {recipe.description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Description</Text>
              <View style={styles.descriptionContainer}>
                <Text 
                  style={styles.infoRowContent}
                  numberOfLines={isDescriptionTextExpanded ? undefined : 3}
                  ellipsizeMode="tail"
                >
                  {decode(recipe.description)}
                </Text>
                {recipe.description.length > 150 && (
                  <TouchableOpacity 
                    onPress={() => setIsDescriptionTextExpanded(!isDescriptionTextExpanded)}
                    style={styles.readMoreButton}
                  >
                    <Text style={styles.readMoreText}>
                      {isDescriptionTextExpanded ? 'Read less' : 'Read more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          {(recipe.prepTime || recipe.cookTime) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Time it will take:</Text>
              <Text style={styles.infoRowContent}>
                {recipe.prepTime && `Prep: ${recipe.prepTime}`}
                {recipe.prepTime && recipe.cookTime ? ', ' : ''}
                {recipe.cookTime && `Cook: ${recipe.cookTime}`}
              </Text>
            </View>
          )}
          {detectedAllergens.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Allergens</Text>
              <Text style={styles.infoRowContent}>
                {detectedAllergens.join(', ')}
              </Text>
            </View>
          )}
          {recipe.sourceUrl && (
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Original Source</Text>
              <Text
                style={[styles.infoRowContent, styles.link]}
                onPress={() => Linking.openURL(recipe.sourceUrl!)}
              >
                Visit Source ↗︎
              </Text>
            </View>
          )}
        </CollapsibleSection>

        <View style={styles.divider} />

        <CollapsibleSection
          title="Adjust Recipe Size"
          isExpanded={isRecipeSizeExpanded}
          onToggle={() => setIsRecipeSizeExpanded(!isRecipeSizeExpanded)}
        >
          <ServingScaler
            selectedScaleFactor={selectedScaleFactor}
            handleScaleFactorChange={handleScaleFactorChange}
            recipeYield={recipe.recipeYield}
            originalYieldValue={originalYieldValue}
          />
        </CollapsibleSection>

        <View style={styles.divider} />

        <CollapsibleSection
          title="Ingredients"
          isExpanded={isIngredientsExpanded}
          onToggle={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
        >
          {selectedScaleFactor !== 1 && (
            <Text style={styles.ingredientsSubtext}>
              {`Now scaled up by ${selectedScaleFactor}x (${getScaledYieldText(recipe.recipeYield, selectedScaleFactor)})`}
            </Text>
          )}
          <IngredientList
            ingredientGroups={scaledIngredientGroups}
            selectedScaleFactor={selectedScaleFactor}
            appliedChanges={appliedChanges}
            openSubstitutionModal={openSubstitutionModal}
            undoIngredientRemoval={undoIngredientRemoval}
            undoSubstitution={undoSubstitution}
            showCheckboxes={false}
          />
        </CollapsibleSection>
      </ScrollView>

      <RecipeFooterButtons
        handleGoToSteps={handleGoToSteps}
        isRewriting={isRewriting}
        isScalingInstructions={isScalingInstructions}
      />
      
      {/* Save Recipe Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveForLater}
        >
          <Text style={styles.saveButtonText}>Save for later</Text>
          <MaterialCommunityIcons
            name="bookmark-outline"
            size={20}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
    paddingBottom: 100,
  },

  infoTable: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    marginBottom: SPACING.lg,
  },
  infoRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.base,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
  },
  infoRowTouchable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRowLabel: {
    fontFamily: FONT.family.recoleta,
    fontSize: FONT.size.body,
  },
  infoRowContent: {
    ...bodyText,
    marginTop: SPACING.sm,
    color: COLORS.textMuted,
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  divider: {
    height: BORDER_WIDTH.hairline,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.lg,
  },
  mainIngredientsHeader: {
    marginBottom: SPACING.sm,
  } as ViewStyle,
  mainIngredientsTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    maxWidth: '90%',
    width: '100%',
  },
  successIcon: {
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalMessage: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalButtons: {
    gap: SPACING.md,
    width: '100%',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  primaryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  secondaryButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  },
  descriptionContainer: {
    marginTop: SPACING.sm,
  },
  readMoreButton: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: FONT.size.smBody,
  },
  saveButtonContainer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.pageHorizontal,
    backgroundColor: COLORS.white,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.sm,
  },
  saveButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  },
  titleDivider: {
    height: BORDER_WIDTH.default,
    backgroundColor: COLORS.divider,
    marginHorizontal: 0,
  },
  ingredientsSubtext: {
    ...bodyText,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
});