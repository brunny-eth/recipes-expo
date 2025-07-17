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
  const params = useLocalSearchParams<{ recipeData?: string; from?: string; appliedChanges?: string; isModified?: string; entryPoint?: string; miseRecipeId?: string; finalYield?: string }>();
  const router = useRouter();
  const { showError, hideError } = useErrorModal();
  const { session } = useAuth();

  // Extract and validate entryPoint with logging
  const entryPoint = params.entryPoint || 'new'; // Default to 'new' for backward compatibility
  const miseRecipeId = params.miseRecipeId; // Store the mise recipe ID for modifications


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
  // Track loading state specifically for the "Save for later" action so we don't disable the primary button.
  const [isSavingForLater, setIsSavingForLater] = useState(false);
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
  console.log('[DEBUG] Entry point analysis:', {
    entryPoint,
    hasAppliedChanges: !!params.appliedChanges,
    isViewingSavedRecipe,
    selectedScaleFactor,
    miseRecipeId,
  });

  // Track if modifications have been made for mise entry point
  const [hasModifications, setHasModifications] = useState(false);

  // Track if recipe is already in mise with current modifications
  const [isAlreadyInMise, setIsAlreadyInMise] = useState(false);

  const scaledIngredientGroups = React.useMemo<IngredientGroup[]>(() => {
    if (!recipe?.ingredientGroups) return [];
    const result = recipe.ingredientGroups.map((group) => {
      if (!group.ingredients || !Array.isArray(group.ingredients)) {
        return { ...group, ingredients: [] };
      }
      // Always scale ingredients based on current selectedScaleFactor
      // For saved recipes, we need to scale relative to the saved scale factor
      const scaledIngredients = group.ingredients.map((ingredient) => {
        if (isViewingSavedRecipe) {
          // For saved recipes, we need to scale relative to the saved scale factor
          // First get the saved scale factor from appliedChanges
          const savedScaleFactor = (() => {
            if (params.appliedChanges) {
              try {
                const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
                return savedAppliedChanges.scalingFactor || 1.0;
              } catch {
                return 1.0;
              }
            }
            return 1.0;
          })();
          
          // Calculate the relative scale factor
          const relativeScaleFactor = selectedScaleFactor / savedScaleFactor;
          
          console.log('[DEBUG] Saved recipe - scaling with relative factor:', {
            ingredient: ingredient.name,
            amount: ingredient.amount,
            savedScaleFactor,
            currentScaleFactor: selectedScaleFactor,
            relativeScaleFactor,
            entryPoint
          });
          
          return scaleIngredient(ingredient, relativeScaleFactor);
        } else {
          console.log('[DEBUG] New recipe - applying scaling factor:', selectedScaleFactor, 'to', ingredient.name, ingredient.amount, 'entryPoint:', entryPoint);
          return scaleIngredient(ingredient, selectedScaleFactor);
        }
      });

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
    return result;
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
          console.log('[DEBUG] Found appliedChanges URL param:', params.appliedChanges);
          try {
            const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
            console.log('[DEBUG] Parsed appliedChanges from URL:', savedAppliedChanges);
            
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
              console.log('[DEBUG] Setting scaling factor from saved changes:', savedAppliedChanges.scalingFactor);
              setSelectedScaleFactor(savedAppliedChanges.scalingFactor);
            } else {
              console.log('[DEBUG] No scaling factor in saved changes, defaulting to 1.0');
              setSelectedScaleFactor(1.0);
            }
          } catch (appliedChangesError: any) {
            console.error('[DEBUG] Error parsing applied changes:', appliedChangesError);
            setSelectedScaleFactor(1.0);
            setAppliedChanges([]);
          }
        } else {
          console.log('[DEBUG] No appliedChanges URL param, defaulting to new recipe state');
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

  // Update hasModifications when scaling factor or applied changes change
  useEffect(() => {
    if (entryPoint === 'mise') {
      const hasScaleChanges = selectedScaleFactor !== 1;
      const hasIngredientChanges = appliedChanges.length > 0;
      setHasModifications(hasScaleChanges || hasIngredientChanges);
    }
  }, [selectedScaleFactor, appliedChanges, entryPoint]);

  // Reset isAlreadyInMise when user makes modifications that would change the recipe
  useEffect(() => {
    if (isAlreadyInMise) {
      setIsAlreadyInMise(false);
    }
  }, [selectedScaleFactor, appliedChanges]); // Reset when scaling or ingredient changes occur

  const detectedAllergens = React.useMemo(() => {
    if (!recipe) return [];
    return extractAllergens(recipe.ingredientGroups);
  }, [recipe]);

  const handleScaleFactorChange = (factor: number) => setSelectedScaleFactor(factor);



  const openSubstitutionModal = React.useCallback(
    (ingredient: StructuredIngredient) => {
      console.log('[DEBUG] openSubstitutionModal called with:', {
        ingredientName: ingredient.name,
        ingredientAmount: ingredient.amount,
        selectedScaleFactor,
        isViewingSavedRecipe,
        appliedChanges,
        hasSuggestedSubstitutions: !!ingredient.suggested_substitutions,
        substitutionCount: ingredient.suggested_substitutions?.length || 0,
        suggestedSubstitutions: ingredient.suggested_substitutions,
      });

      let scaledSuggestions: SubstitutionSuggestion[] | null = null;
      if (ingredient.suggested_substitutions && selectedScaleFactor !== 1) {
        console.log('[DEBUG] Scaling substitutions with factor:', selectedScaleFactor);
        const scalingFactor = selectedScaleFactor;
        scaledSuggestions = ingredient.suggested_substitutions.map((sub) => {
          let finalAmount: string | number | null = sub.amount ?? null;
          if (sub.amount != null) {
            const parsedAmount = parseAmountString(String(sub.amount));
            if (parsedAmount !== null) {
              const calculatedAmount = parsedAmount * scalingFactor;
              finalAmount = formatAmountNumber(calculatedAmount) || calculatedAmount.toFixed(2);
              console.log('[DEBUG] Scaled substitution:', {
                original: sub.amount,
                parsed: parsedAmount,
                scalingFactor,
                calculated: calculatedAmount,
                final: finalAmount,
              });
            }
          }
          return { ...sub, amount: finalAmount };
        });
      } else {
        console.log('[DEBUG] No scaling applied to substitutions:', {
          hasSubstitutions: !!ingredient.suggested_substitutions,
          selectedScaleFactor,
          reason: selectedScaleFactor === 1 ? 'scale factor is 1' : 'no substitutions',
        });
        scaledSuggestions = ingredient.suggested_substitutions || null;
      }

      console.log('[DEBUG] Final scaled suggestions:', scaledSuggestions);

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
    // If we're coming from mise, we still need to apply any new modifications before going to steps
    if (entryPoint === 'mise' && miseRecipeId) {
      
      
      if (!recipe) {
        console.error('[Summary] No recipe data available for navigation');
        showError('Navigation Error', 'Recipe data is missing.');
      return;
    }

      const needsSubstitution = appliedChanges.length > 0;
    const needsScaling = selectedScaleFactor !== 1;

      // Check if we have local modifications to use as base
      const getMiseRecipe = (globalThis as any).getMiseRecipe;
      let baseRecipe = recipe;
      
      if (getMiseRecipe) {
        const miseRecipe = getMiseRecipe(miseRecipeId);
        if (miseRecipe?.local_modifications?.modified_recipe_data) {

          baseRecipe = miseRecipe.local_modifications.modified_recipe_data;
        }
      }
      
      // If there are new modifications on this screen, apply them
      if (needsSubstitution || needsScaling) {
        
        
        try {
      setIsRewriting(true);
          
          let finalInstructions = baseRecipe.instructions || [];
          let newTitle: string | null = null;
          
        const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
          
          // Flatten all ingredients from ingredient groups for scaling
          const allIngredients: StructuredIngredient[] = [];
          if (baseRecipe.ingredientGroups) {
            baseRecipe.ingredientGroups.forEach(group => {
              if (group.ingredients && Array.isArray(group.ingredients)) {
                allIngredients.push(...group.ingredients);
              }
            });
          }

          const response = await fetch(`${backendUrl}/api/recipes/modify-instructions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              originalInstructions: baseRecipe.instructions || [],
            substitutions: appliedChanges.map((change) => ({
              from: change.from,
              to: change.to ? change.to.name : null,
            })),
              originalIngredients: allIngredients,
              scaledIngredients: scaledIngredients || [],
              scalingFactor: selectedScaleFactor,
          }),
        });
          
        const result = await response.json();
          if (!response.ok) throw new Error(result.error || `Modification failed (Status: ${response.status})`);
          if (!result.modifiedInstructions) throw new Error('Invalid format for modified instructions.');
          
          finalInstructions = result.modifiedInstructions;
        
        // Capture new title if suggested by LLM
        if (result.newTitle && result.newTitle.trim() !== '') {
          newTitle = result.newTitle;
        }

          // Create the modified recipe for steps
                  const modifiedRecipe = {
          ...baseRecipe,
          title: newTitle || baseRecipe.title,
          recipeYield: isViewingSavedRecipe ? baseRecipe.recipeYield : getScaledYieldText(baseRecipe.recipeYield, selectedScaleFactor),
          instructions: finalInstructions,
          ingredientGroups: scaledIngredientGroups,
        };

        setIsRewriting(false);

          router.push({
            pathname: '/recipe/steps',
            params: {
              recipeData: JSON.stringify(modifiedRecipe),
              miseRecipeId: miseRecipeId,
            },
          });
          return;

        } catch (modificationError: any) {
          setIsRewriting(false);
          showError('Update Failed', `Couldn't apply modifications: ${modificationError.message}`);
          return;
        }
      } else {
        // No new modifications, use base recipe
        router.push({
          pathname: '/recipe/steps',
          params: {
            recipeData: JSON.stringify(baseRecipe),
            miseRecipeId: miseRecipeId,
          },
        });
        return;
      }
    }

    // Regular flow for new/saved recipes
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
    const needsSubstitution = appliedChanges.length > 0;

    // --- Unified Instruction Modification (handles both substitutions and scaling) ---
    if (needsSubstitution || needsScaling) {
      setIsRewriting(true);
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

        const response = await fetch(`${backendUrl}/api/recipes/modify-instructions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalInstructions: recipe.instructions || [],
            substitutions: appliedChanges.map((change) => ({
              from: change.from,
              to: change.to ? change.to.name : null,
            })),
            originalIngredients: allIngredients,
            scaledIngredients: scaledIngredients || [],
            scalingFactor: selectedScaleFactor,
          }),
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Modification failed (Status: ${response.status})`);
        if (!result.modifiedInstructions) throw new Error('Invalid format for modified instructions.');
        
        finalInstructions = result.modifiedInstructions;
        
        // Capture new title if suggested by LLM
        if (result.newTitle && result.newTitle.trim() !== '') {
          newTitle = result.newTitle;
        }
        
      } catch (modificationError: any) {
        showError('Update Failed', `Couldn't update recipe instructions: ${modificationError.message}`);
        return; // Stop navigation on failure
      } finally {
        setIsRewriting(false);
      }
    }

    // --- 3. Save Prepared Recipe to Mise Table ---
    // Calculate the correct scale factor for saved recipes
    const actualScaleFactor = (() => {
      if (isViewingSavedRecipe) {
        // For saved recipes, calculate the relative scale factor
        const savedScaleFactor = (() => {
          if (params.appliedChanges) {
            try {
              const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
              return savedAppliedChanges.scalingFactor || 1.0;
            } catch {
              return 1.0;
            }
          }
          return 1.0;
        })();
        
        // Calculate the relative scale factor
        return selectedScaleFactor / savedScaleFactor;
      } else {
        // For new recipes, use the selected scale factor directly
        return selectedScaleFactor;
      }
    })();

    const finalRecipeData = {
      // Pass the ORIGINAL recipe data with all metadata intact
      ...recipe,
      // Update the yield text and instructions for the prepared version
      recipeYield: isViewingSavedRecipe 
        ? getScaledYieldText(recipe.recipeYield, actualScaleFactor)
        : getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
      instructions: finalInstructions,
      ingredientGroups: scaledIngredientGroups,
    };

    const appliedChangesData = {
      ingredientChanges: appliedChanges.map((change) => ({
        from: change.from,
        to: change.to ? change.to.name : null, // Convert StructuredIngredient to string
      })),
      scalingFactor: actualScaleFactor,
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
          finalYield: isViewingSavedRecipe 
            ? getScaledYieldText(recipe.recipeYield, actualScaleFactor)
            : getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
          titleOverride: newTitle || null,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        if (response.status === 409) {
          // Recipe already exists in mise with same modifications
          setIsAlreadyInMise(true);
          showError(
            'Already in Mise',
            result.message || 'This recipe with these modifications is already in your mise en place.',
            () => {
              hideError();
              router.push('/tabs/mise');
            }
          );
        } else {
          throw new Error(result.error || `Save failed (Status: ${response.status})`);
        }
        return;
      }

      // Store the mise recipe ID for navigation
      setPreparedRecipeData({ miseRecipeId: result.miseRecipe.id, ...finalRecipeData });
      setPreparationComplete(true);

    } catch (saveError: any) {
      showError('Save Failed', `Couldn't save recipe to mise: ${saveError.message}`);
      return; // Stop execution on failure
    }
  }, [recipe, scaledIngredients, scaledIngredientGroups, appliedChanges, router, showError, selectedScaleFactor, session, entryPoint, miseRecipeId]);

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

    const needsSubstitution = appliedChanges.length > 0;
    const needsScaling = selectedScaleFactor !== 1;

    // If we have modifications, we need to save a modified version
    if (needsSubstitution || needsScaling) {
      try {
        setIsSavingForLater(true);
        
        // Apply modifications using the unified endpoint
        let finalInstructions = recipe.instructions || [];
        let newTitle: string | null = null;
        
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

        const response = await fetch(`${backendUrl}/api/recipes/modify-instructions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalInstructions: recipe.instructions || [],
            substitutions: appliedChanges.map((change) => ({
              from: change.from,
              to: change.to ? change.to.name : null,
            })),
            originalIngredients: allIngredients,
            scaledIngredients: scaledIngredients || [],
            scalingFactor: selectedScaleFactor,
          }),
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Modification failed (Status: ${response.status})`);
        if (!result.modifiedInstructions) throw new Error('Invalid format for modified instructions.');
        
        finalInstructions = result.modifiedInstructions;
        
        // Capture new title if suggested by LLM
        if (result.newTitle && result.newTitle.trim() !== '') {
          newTitle = result.newTitle;
        }

        setIsSavingForLater(false);

        // Create modified recipe data
        const modifiedRecipeData = {
          ...recipe,
          title: newTitle || recipe.title,
          recipeYield: isViewingSavedRecipe ? recipe.recipeYield : getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
          instructions: finalInstructions,
          ingredientGroups: scaledIngredientGroups,
        };

        const appliedChangesData = {
          ingredientChanges: appliedChanges.map((change) => ({
            from: change.from,
            to: change.to ? change.to.name : null,
          })),
          scalingFactor: selectedScaleFactor,
        };

        // Save the modified recipe
        const saveResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalRecipeId: recipe.id,
            userId: session.user.id,
            modifiedRecipeData,
            appliedChanges: appliedChangesData,
          }),
        });

        const saveResult = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(saveResult.error || 'Failed to save modified recipe');


        setPreparationComplete(false);
        router.replace('/tabs/saved' as any);

      } catch (error: any) {
        setIsSavingForLater(false);
        console.error('Error saving modified recipe:', error);
        showError('Save Failed', `Could not save modified recipe: ${error.message}`);
      }
    } else {
      // No modifications, save original recipe
      try {
        setIsSavingForLater(true);
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
      } finally {
        setIsSavingForLater(false);
      }
    }
  };

  const handleRemoveFromSaved = async () => {
    if (!recipe?.id || !session?.user) {
      showError('Account Required', 'You need an account to manage saved recipes.');
      return;
    }

    try {
      const { unsaveRecipe } = require('@/lib/savedRecipes');
      const success = await unsaveRecipe(recipe.id);
      if (success) {
        router.replace('/tabs/saved' as any);
      } else {
        showError('Remove Failed', 'Could not remove recipe from saved. Please try again.');
      }
    } catch (error) {
      console.error('Error removing recipe from saved:', error);
      showError('Remove Failed', 'Could not remove recipe from saved. Please try again.');
    }
  };

  const handleSaveModifications = () => {
    if (entryPoint !== 'mise' || !miseRecipeId || !recipe) {
      
      return;
    }

    // Access the global updateMiseRecipe function
    const updateMiseRecipe = (globalThis as any).updateMiseRecipe;
    if (!updateMiseRecipe) {
      console.error('[Summary] updateMiseRecipe function not available');
      showError('Update Failed', 'Could not save modifications. Please try again.');
      return;
    }

    // Prepare the modified recipe data
    const modifiedRecipeData = {
      ...recipe,
      recipeYield: isViewingSavedRecipe ? recipe.recipeYield : getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
      ingredientGroups: scaledIngredientGroups,
    };

    // Call the updateMiseRecipe function with modifications
    updateMiseRecipe(miseRecipeId, {
      scaleFactor: selectedScaleFactor,
      appliedChanges: appliedChanges,
      modified_recipe_data: modifiedRecipeData,
    });

    
    
    // Reset modifications state
    setHasModifications(false);
    
    // Show success feedback
    showError('Modifications Saved', 'Your changes have been saved for this cooking session. The grocery list will update when you return to your mise.', () => {
      hideError();
      // Navigate to mise screen instead of going back
      router.replace('/tabs/mise' as any);
    });
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
            <Text style={styles.modalTitle}>Added to your mise</Text>
            <Text style={styles.modalMessage}>
              This recipe is now added to your grocery list and ready for cooking.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={handleGoToMise}
              >
                <Text style={styles.secondaryButtonText}>Go to your mise</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={handleGoToRecipeSteps}
              >
                <Text style={styles.secondaryButtonText}>Cook this now</Text>
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
        {(() => {
          const imageUrl = recipe.image || recipe.thumbnailUrl;
          const sourceUrl = recipe.sourceUrl;
          const isVideoRecipe = sourceUrl && (
            sourceUrl.includes('tiktok.com') ||
            sourceUrl.includes('instagram.com') ||
            sourceUrl.includes('youtube.com')
          );
          const handleOpenSource = async () => {
            if (sourceUrl) {
              try {
                await Linking.openURL(sourceUrl);
              } catch (err) {
                // Optionally, show a user-friendly error
                alert('Could not open the video link.');
              }
            }
          };
          if (imageUrl && isVideoRecipe) {
            return (
              <TouchableOpacity onPress={handleOpenSource} activeOpacity={0.8} style={{ marginBottom: SPACING.md }}>
                <FastImage
                  source={{ uri: String(imageUrl) }}
                  style={{
                    width: '100%',
                    height: 150,
                    borderRadius: RADIUS.md,
                  }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            );
          } else if (imageUrl) {
            return (
              <FastImage
                source={{ uri: String(imageUrl) }}
                style={{
                  width: '100%',
                  height: 150,
                  borderRadius: RADIUS.md,
                  marginBottom: SPACING.md,
                }}
                resizeMode="cover"
              />
            );
          } else {
            return null;
          }
        })()}
        {/* Short description left-aligned, outside columns */}
        {recipe.shortDescription && (
          <Text style={styles.shortDescriptionHeaderLeft}>{recipe.shortDescription}</Text>
        )}
        {/* Two-column layout for meta info */}
        {(recipe.prepTime || recipe.cookTime || detectedAllergens.length > 0) && (
          <View style={styles.metaInfoContainer}>
            {recipe.prepTime && (
              <View style={styles.metaInfoRow}>
                <Text style={styles.metaInfoLabel}>Prep Time:</Text>
                <Text style={styles.metaInfoValue}>{recipe.prepTime}</Text>
              </View>
            )}
            {recipe.cookTime && (
              <View style={styles.metaInfoRow}>
                <Text style={styles.metaInfoLabel}>Cook Time:</Text>
                <Text style={styles.metaInfoValue}>{recipe.cookTime}</Text>
              </View>
            )}
            {detectedAllergens.length > 0 && (
              <View style={styles.metaInfoRow}>
                <Text style={styles.metaInfoLabel}>Allergens:</Text>
                <Text style={styles.metaInfoValue}>{detectedAllergens.join(', ')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Remove More About This Recipe section and its divider */}
        {/* <CollapsibleSection ... /> and <View style={styles.divider} /> removed */}

        {/* Divider above Adjust servings */}
        <View style={styles.divider} />

        <CollapsibleSection
          title="Adjust servings"
          isExpanded={isRecipeSizeExpanded}
          onToggle={() => setIsRecipeSizeExpanded(!isRecipeSizeExpanded)}
        >
          <ServingScaler
            selectedScaleFactor={selectedScaleFactor}
            handleScaleFactorChange={handleScaleFactorChange}
            recipeYield={recipe.recipeYield}
            originalYieldValue={originalYieldValue}
            isViewingSavedRecipe={isViewingSavedRecipe}
            appliedChanges={params.appliedChanges}
          />
        </CollapsibleSection>

        {/* Divider between Adjust servings and Swap or remove ingredients */}
        <View style={styles.divider} />

        <CollapsibleSection
          title="Swap or remove ingredients"
          isExpanded={isIngredientsExpanded}
          onToggle={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
        >
          {selectedScaleFactor !== 1 && (
            <Text style={styles.ingredientsSubtext}>
              {(() => {
                const direction = selectedScaleFactor < 1 ? 'down' : 'up';
                let scaledYieldString;
                
                if (isViewingSavedRecipe) {
                  // For saved recipes, calculate the relative scale factor
                  const savedScaleFactor = (() => {
                    if (params.appliedChanges) {
                      try {
                        const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
                        return savedAppliedChanges.scalingFactor || 1.0;
                      } catch {
                        return 1.0;
                      }
                    }
                    return 1.0;
                  })();
                  
                  // Calculate the relative scale factor and apply it
                  const relativeScaleFactor = selectedScaleFactor / savedScaleFactor;
                  scaledYieldString = getScaledYieldText(recipe.recipeYield, relativeScaleFactor);
                } else {
                  // For new recipes, scale directly
                  scaledYieldString = getScaledYieldText(recipe.recipeYield, selectedScaleFactor);
                }
                
                console.log('[DEBUG] Yield display:', {
                  isViewingSavedRecipe,
                  originalYield: recipe.recipeYield,
                  scaledYieldString,
                  selectedScaleFactor,
                });
                return `Now scaled ${direction} to ${scaledYieldString}.`;
              })()}
            </Text>
          )}
          <View style={{marginTop: SPACING.sm}}>
            <IngredientList
              ingredientGroups={scaledIngredientGroups}
              selectedScaleFactor={selectedScaleFactor}
              appliedChanges={appliedChanges}
              openSubstitutionModal={openSubstitutionModal}
              undoIngredientRemoval={undoIngredientRemoval}
              undoSubstitution={undoSubstitution}
              showCheckboxes={false}
              isViewingSavedRecipe={isViewingSavedRecipe}
            />
          </View>
        </CollapsibleSection>
      </ScrollView>

      {/* Move Visit Source to the bottom, above action buttons */}
      {recipe.sourceUrl && (
        <View style={styles.visitSourceContainer}>
          <Text
            style={styles.visitSourceLink}
            onPress={() => Linking.openURL(recipe.sourceUrl!)}
          >
            Visit Source ↗︎
          </Text>
        </View>
      )}

      <RecipeFooterButtons
        handleGoToSteps={handleGoToSteps}
        isRewriting={isRewriting}
        isScalingInstructions={isScalingInstructions}
        handleSaveForLater={handleSaveForLater}
        handleRemoveFromSaved={handleRemoveFromSaved}
        handleSaveModifications={handleSaveModifications}
        isSavingForLater={isSavingForLater}
        entryPoint={entryPoint}
        hasModifications={hasModifications}
        isAlreadyInMise={isAlreadyInMise}
      />
      
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
            fontFamily: FONT.family.libreBaskerville,
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
    height: BORDER_WIDTH.hairline,
    backgroundColor: COLORS.divider,
    marginHorizontal: 0,
  },
  ingredientsSubtext: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm, // Use small spacing for consistency
    marginTop: 0,
    textAlign: 'left',
    lineHeight: 18,
  },
  shortDescription: {
    ...bodyText,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  shortDescriptionHeader: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.body,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    lineHeight: FONT.lineHeight.compact,
  },
  shortDescriptionHeaderLeft: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.caption, // Use caption size for smaller text
    color: COLORS.textMuted, // Use muted color for caption effect
    textAlign: 'left',
    marginTop: 0.5, // Bring caption even closer to image
    marginBottom: SPACING.md, // Add more space below caption
    marginHorizontal: 0,
    paddingHorizontal: 0,
    lineHeight: FONT.lineHeight.compact,
  },
  metaInfoContainer: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  metaInfoLabel: {
    minWidth: 90,
    fontWeight: '600',
    color: COLORS.textDark,
    fontSize: FONT.size.body,
    textAlign: 'left',
  },
  metaInfoValue: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: FONT.size.body,
    textAlign: 'left',
    marginLeft: SPACING.xs,
  },
  visitSourceContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm, // Smaller margin to bring closer to buttons
  },
  visitSourceLink: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.caption,
    color: COLORS.textDark,
    textDecorationLine: 'underline',
    opacity: 0.5,
  },
});