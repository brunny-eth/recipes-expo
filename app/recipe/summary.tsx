import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Linking,
  ViewStyle,
  TextStyle,
  ImageStyle,
  InteractionManager,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import FastImage from '@d11/react-native-fast-image';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  parseRecipeDisplayName,
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

// Helper function to convert time format from "10 minutes" to "10m"
const formatTimeCondensed = (timeString: string): string => {
  return timeString
    .replace(/\b(\d+)\s*minutes?\b/gi, '$1m')
    .replace(/\b(\d+)\s*hours?\b/gi, '$1h')
    .replace(/\b(\d+)\s*hrs?\b/gi, '$1h')
    .replace(/\b(\d+)\s*mins?\b/gi, '$1m')
    .trim();
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
  const params = useLocalSearchParams<{ recipeData?: string; from?: string; appliedChanges?: string; isModified?: string; entryPoint?: string; miseRecipeId?: string; finalYield?: string; originalRecipeData?: string; titleOverride?: string }>();
  const router = useRouter();
  const { showError, hideError } = useErrorModal();
  const { session } = useAuth();

  // Extract and validate entryPoint with logging
  const entryPoint = params.entryPoint || 'new'; // Default to 'new' for backward compatibility
  const miseRecipeId = params.miseRecipeId; // Store the mise recipe ID for modifications


  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [originalRecipe, setOriginalRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isAllergensExpanded, setIsAllergensExpanded] = useState(false);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isRecipeSizeExpanded, setIsRecipeSizeExpanded] = useState(false);
  const [isDescriptionTextExpanded, setIsDescriptionTextExpanded] = useState(false);
  // State to track if image failed to load
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
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
  // Track loading state for saving modifications in mise entry point
  const [isSavingModifications, setIsSavingModifications] = useState(false);
  // Track loading state for cook now button
  const [isCookingNow, setIsCookingNow] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
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
  // For mise recipes: we're actively editing even if appliedChanges exist in URL
  // The URL appliedChanges are just the baseline from existing mise recipe
  const isViewingSavedRecipe = entryPoint !== 'mise' && !!params.appliedChanges;
  console.log('[DEBUG] Entry point analysis:', {
    entryPoint,
    hasAppliedChanges: !!params.appliedChanges,
    isViewingSavedRecipe,
    selectedScaleFactor,
    miseRecipeId,
    appliedChangesLength: appliedChanges.length,
    'Should show undo buttons?': !isViewingSavedRecipe,
  });

  // Track if modifications have been made for mise entry point
  const [hasModifications, setHasModifications] = useState(false);

  // Track if recipe is already in mise with current modifications
  const [isAlreadyInMise, setIsAlreadyInMise] = useState(false);

  // Track the baseline state when screen loads (for mise entry point)
  const [baselineScaleFactor, setBaselineScaleFactor] = useState<number>(1);
  const [baselineAppliedChanges, setBaselineAppliedChanges] = useState<AppliedChange[]>([]);

  const scaledIngredientGroups = React.useMemo<IngredientGroup[]>(() => {
    if (!originalRecipe?.ingredientGroups) return [];
    
    console.log('[DEBUG] ===== SCALING INGREDIENTS =====');
    console.log('[DEBUG] Scaling context:', {
      entryPoint,
      selectedScaleFactor,
      appliedChangesCount: appliedChanges.length,
      appliedChanges,
      isViewingSavedRecipe,
      originalRecipeTitle: originalRecipe.title,
    });
    
    const result = originalRecipe.ingredientGroups.map((group) => {
      if (!group.ingredients || !Array.isArray(group.ingredients)) {
        return { ...group, ingredients: [] };
      }
      
      console.log('[DEBUG] Processing group:', {
        groupName: group.name || 'Default',
        ingredientCount: group.ingredients.length,
      });
      
      // Always scale ingredients from the original recipe using the current selectedScaleFactor
      const scaledIngredients = group.ingredients.map((ingredient) => {
        console.log('[DEBUG] Scaling from original recipe:', {
          ingredient: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          scaleFactor: selectedScaleFactor,
          entryPoint
        });
        
        const scaledIngredient = scaleIngredient(ingredient, selectedScaleFactor);
        console.log('[DEBUG] After scaling:', {
          ingredient: scaledIngredient.name,
          amount: scaledIngredient.amount,
          unit: scaledIngredient.unit,
        });
        
        return scaledIngredient;
      });

      let finalIngredients = scaledIngredients;
      if (appliedChanges.length > 0) {
        console.log('[DEBUG] Applying substitutions to scaled ingredients...');
        
        if (isViewingSavedRecipe) {
          // Clean display for saved recipes: filter out removed, cleanly replace substituted
          finalIngredients = scaledIngredients
            .map((baseIngredient) => {
              // Parse the display name to get the original name without "(removed)" or "(substituted for X)" text
              const { baseName: originalName } = parseRecipeDisplayName(baseIngredient.name);
              const change = appliedChanges.find((c) => c.from === originalName);
              
              console.log('[DEBUG] Checking ingredient for substitution (clean display):', {
                baseIngredientName: baseIngredient.name,
                originalName,
                foundChange: !!change,
                change,
              });
              
              if (change) {
                if (change.to === null) {
                  console.log('[DEBUG] Marking ingredient for removal:', originalName);
                  // Mark for removal (will be filtered out)
                  return null;
                }
                // Replace with substituted ingredient (no visual indicators)
                // Scale the substitution amount based on current scale factor
                let scaledSubstitutionAmount = change.to.amount;
                if (change.to.amount && selectedScaleFactor !== 1) {
                  const parsedAmount = parseAmountString(change.to.amount);
                  if (parsedAmount !== null) {
                    const scaledAmount = parsedAmount * selectedScaleFactor;
                    scaledSubstitutionAmount = formatAmountNumber(scaledAmount) || scaledAmount.toString();
                  }
                }
                
                const substitutedIngredient = {
                  ...change.to,
                  amount: scaledSubstitutionAmount,
                  // Keep the substituted ingredient's name as-is
                };
                console.log('[DEBUG] Applying clean substitution with dynamic scaling:', {
                  originalName,
                  originalSubstitutionAmount: change.to.amount,
                  currentScaleFactor: selectedScaleFactor,
                  scaledSubstitutionAmount,
                  substitutedIngredient,
                });
                return substitutedIngredient;
              }
              console.log('[DEBUG] No substitution found, keeping original:', {
                name: baseIngredient.name,
                amount: baseIngredient.amount,
                unit: baseIngredient.unit,
              });
              return baseIngredient;
            })
            .filter((ingredient): ingredient is StructuredIngredient => ingredient !== null);
        } else {
          // Active editing: show visual indicators for user feedback
          finalIngredients = scaledIngredients.map((baseIngredient) => {
            const change = appliedChanges.find((c) => c.from === baseIngredient.name);
            
            console.log('[DEBUG] Checking ingredient for substitution (with indicators):', {
              baseIngredientName: baseIngredient.name,
              foundChange: !!change,
              change,
            });
            
                          if (change) {
                if (change.to === null) {
                  console.log('[DEBUG] Applying removal indicator:', baseIngredient.name);
                  return {
                    ...baseIngredient,
                    name: `${baseIngredient.name} (removed)`,
                    amount: null,
                    unit: null,
                    suggested_substitutions: null,
                  };
                }
                // Scale the substitution amount based on current scale factor
                let scaledSubstitutionAmount = change.to.amount;
                if (change.to.amount && selectedScaleFactor !== 1) {
                  const parsedAmount = parseAmountString(change.to.amount);
                  if (parsedAmount !== null) {
                    const scaledAmount = parsedAmount * selectedScaleFactor;
                    scaledSubstitutionAmount = formatAmountNumber(scaledAmount) || scaledAmount.toString();
                  }
                }
                
                const substitutedIngredient = {
                  ...change.to,
                  amount: scaledSubstitutionAmount,
                  name: `${change.to.name} (substituted for ${change.from})`,
                };
                console.log('[DEBUG] Applying substitution with indicator and dynamic scaling:', {
                  originalName: baseIngredient.name,
                  originalSubstitutionAmount: change.to.amount,
                  currentScaleFactor: selectedScaleFactor,
                  scaledSubstitutionAmount,
                  substitutedIngredient,
                });
                return substitutedIngredient;
              }
            console.log('[DEBUG] No substitution found, keeping original:', {
              name: baseIngredient.name,
              amount: baseIngredient.amount,
              unit: baseIngredient.unit,
            });
            return baseIngredient;
          });
        }
      }

      console.log('[DEBUG] Final ingredients for group:', {
        groupName: group.name || 'Default',
        finalIngredients: finalIngredients.map(ing => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
        })),
      });

      return {
        ...group,
        ingredients: finalIngredients,
      };
    });
    
    console.log('[DEBUG] ===== END SCALING INGREDIENTS =====');
    return result;
  }, [originalRecipe, selectedScaleFactor, appliedChanges, isViewingSavedRecipe]);

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
        
        // Debug: Log the recipe structure to see if sourceUrl exists
        console.log('[DEBUG] Recipe data structure:', {
          hasRecipe: !!parsed,
          keys: Object.keys(parsed),
          sourceUrl: parsed.sourceUrl,
          hasSourceUrl: !!parsed.sourceUrl,
          recipePreview: {
            title: parsed.title,
            sourceUrl: parsed.sourceUrl,
            image: parsed.image,
          }
        });
        
        setRecipe(parsed);
        
        // Reset image load failure state when new recipe is loaded
        setImageLoadFailed(false);
        
        // Set original recipe data if available (for consistent scaling)
        if (params.originalRecipeData) {
          try {
            const originalParsed = JSON.parse(params.originalRecipeData as string);
            setOriginalRecipe(originalParsed);
            const yieldNum = parseServingsValue(originalParsed.recipeYield);
            setOriginalYieldValue(yieldNum);
          } catch (originalError) {
            console.error('[DEBUG] Error parsing original recipe data:', originalError);
            // Fall back to using the current recipe as original
            setOriginalRecipe(parsed);
            const yieldNum = parseServingsValue(parsed.recipeYield);
            setOriginalYieldValue(yieldNum);
          }
        } else {
          // For new recipes or when original data is not available, use current recipe as original
          setOriginalRecipe(parsed);
          const yieldNum = parseServingsValue(parsed.recipeYield);
          setOriginalYieldValue(yieldNum);
        }
        
        // Check if this is a saved recipe with existing applied changes
        if (params.appliedChanges) {
          console.log('[DEBUG] Found appliedChanges URL param:', params.appliedChanges);
          try {
            const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
            console.log('[DEBUG] Parsed appliedChanges from URL:', savedAppliedChanges);
            
            // Convert saved format to internal format
            if (savedAppliedChanges.ingredientChanges) {
              console.log('[DEBUG] Converting ingredientChanges to internal format:', savedAppliedChanges.ingredientChanges);
              
              const convertedChanges: AppliedChange[] = savedAppliedChanges.ingredientChanges.map((change: any) => ({
                from: change.from,
                to: change.to ? {
                  // Handle both old format (string) and new format (object)
                  name: typeof change.to === 'string' ? change.to : change.to.name,
                  amount: typeof change.to === 'string' ? null : change.to.amount,
                  unit: typeof change.to === 'string' ? null : change.to.unit,
                  preparation: typeof change.to === 'string' ? null : change.to.preparation,
                  suggested_substitutions: null,
                } : null,
              }));
              
              console.log('[DEBUG] Converted appliedChanges:', {
                original: savedAppliedChanges.ingredientChanges,
                converted: convertedChanges,
                details: convertedChanges.map(change => ({
                  from: change.from,
                  to: change.to ? {
                    name: change.to.name,
                    amount: change.to.amount,
                    unit: change.to.unit,
                  } : null,
                })),
              });
              
              setAppliedChanges(convertedChanges);
              // Set baseline for mise entry point
              if (entryPoint === 'mise') {
                setBaselineAppliedChanges(convertedChanges);
              }
            }
            
            // Calculate the actual scale factor from original recipe
            let finalScaleFactor = 1.0;
            if (savedAppliedChanges.scalingFactor && params.originalRecipeData) {
              // For saved/mise recipes, calculate the current scale factor based on the current recipe yield vs original yield
              const currentYieldNum = parseServingsValue(parsed.recipeYield);
              let originalYieldNum = null;
              
              try {
                const originalParsed = JSON.parse(params.originalRecipeData as string);
                originalYieldNum = parseServingsValue(originalParsed?.recipeYield);
              } catch (originalError) {
                console.error('[DEBUG] Error parsing original recipe for yield calculation:', originalError);
              }
              
              if (currentYieldNum && originalYieldNum) {
                const actualScaleFactor = currentYieldNum / originalYieldNum;
                console.log('[DEBUG] Calculated actual scale factor:', { currentYieldNum, originalYieldNum, actualScaleFactor });
                finalScaleFactor = actualScaleFactor;
              } else {
                console.log('[DEBUG] Could not calculate yield-based scale factor, using saved factor:', savedAppliedChanges.scalingFactor);
                finalScaleFactor = savedAppliedChanges.scalingFactor;
              }
            } else if (savedAppliedChanges.scalingFactor) {
              console.log('[DEBUG] Using scaling factor from saved changes:', savedAppliedChanges.scalingFactor);
              finalScaleFactor = savedAppliedChanges.scalingFactor;
            } else {
              console.log('[DEBUG] No scaling factor in saved changes, defaulting to 1.0');
              finalScaleFactor = 1.0;
            }
            
            setSelectedScaleFactor(finalScaleFactor);
            // Set baseline for mise entry point
            if (entryPoint === 'mise') {
              setBaselineScaleFactor(finalScaleFactor);
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
          // Set baseline for mise entry point
          if (entryPoint === 'mise') {
            setBaselineScaleFactor(1.0);
            setBaselineAppliedChanges([]);
          }
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
      // Compare current state against baseline to detect NEW modifications
      const hasScaleChanges = selectedScaleFactor !== baselineScaleFactor;
      const hasIngredientChanges = appliedChanges.length !== baselineAppliedChanges.length || 
        !appliedChanges.every((change, index) => {
          const baselineChange = baselineAppliedChanges[index];
          return baselineChange && 
            change.from === baselineChange.from && 
            JSON.stringify(change.to) === JSON.stringify(baselineChange.to);
        });
      
      const newHasModifications = hasScaleChanges || hasIngredientChanges;
      console.log('[DEBUG] hasModifications calculation (baseline comparison):', {
        selectedScaleFactor,
        baselineScaleFactor,
        hasScaleChanges,
        appliedChangesCount: appliedChanges.length,
        baselineAppliedChangesCount: baselineAppliedChanges.length,
        hasIngredientChanges,
        newHasModifications,
      });
      
      setHasModifications(newHasModifications);
    }
  }, [selectedScaleFactor, appliedChanges, entryPoint, baselineScaleFactor, baselineAppliedChanges]);

  // Reset isAlreadyInMise when user makes modifications that would change the recipe
  useEffect(() => {
    if (isAlreadyInMise) {
      setIsAlreadyInMise(false);
    }
  }, [selectedScaleFactor, appliedChanges]); // Reset when scaling or ingredient changes occur

  const detectedAllergens = React.useMemo(() => {
    if (!originalRecipe) return [];
    return extractAllergens(originalRecipe.ingredientGroups);
  }, [originalRecipe]);

  const handleScaleFactorChange = (factor: number) => setSelectedScaleFactor(factor);



  const openSubstitutionModal = React.useCallback(
    (ingredient: StructuredIngredient) => {
      console.log('[DEBUG] openSubstitutionModal called with:', {
        ingredientName: ingredient.name,
        ingredientAmount: ingredient.amount,
        ingredientUnit: ingredient.unit,
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
          
          console.log('[DEBUG] Processing substitution before scaling:', {
            name: sub.name,
            originalAmount: sub.amount,
            unit: sub.unit,
            description: sub.description,
          });
          
          if (sub.amount != null) {
            const parsedAmount = parseAmountString(String(sub.amount));
            if (parsedAmount !== null) {
              const calculatedAmount = parsedAmount * scalingFactor;
              finalAmount = formatAmountNumber(calculatedAmount) || calculatedAmount.toFixed(2);
              console.log('[DEBUG] Scaled substitution:', {
                name: sub.name,
                original: sub.amount,
                parsed: parsedAmount,
                scalingFactor,
                calculated: calculatedAmount,
                final: finalAmount,
              });
            } else {
              console.log('[DEBUG] Could not parse amount for substitution:', {
                name: sub.name,
                amount: sub.amount,
                typeof: typeof sub.amount,
              });
            }
          }
          
          const scaledSub = { ...sub, amount: finalAmount };
          console.log('[DEBUG] Final scaled substitution:', {
            name: scaledSub.name,
            amount: scaledSub.amount,
            unit: scaledSub.unit,
          });
          
          return scaledSub;
        });
      } else {
        console.log('[DEBUG] No scaling applied to substitutions:', {
          hasSubstitutions: !!ingredient.suggested_substitutions,
          selectedScaleFactor,
          reason: selectedScaleFactor === 1 ? 'scale factor is 1' : 'no substitutions',
        });
        scaledSuggestions = ingredient.suggested_substitutions || null;
      }

      console.log('[DEBUG] Final scaled suggestions for modal:', {
        originalSuggestions: ingredient.suggested_substitutions,
        scaledSuggestions,
        ingredientName: ingredient.name,
      });

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

    console.log('[DEBUG] onApplySubstitution called with:', {
      substitutionName: substitution.name,
      isRemoval: substitution.name === 'Remove ingredient',
      ingredientToSubstitute: ingredientToSubstitute.name,
      currentAppliedChanges: appliedChanges,
    });

    InteractionManager.runAfterInteractions(() => {
      if (substitution.name === 'Remove ingredient') {
        const currentRemovals = appliedChanges.filter((c) => !c.to).length;
        console.log('[DEBUG] Removal limit check:', {
          currentRemovals,
          limit: 2,
          willProceed: currentRemovals < 2,
        });
        if (currentRemovals >= 2) {
          showError('Limit Reached', 'You can only remove up to 2 ingredients.');
          return;
        }
      }

      const isRemoval = substitution.name === 'Remove ingredient';
      let originalNameForSub = ingredientToSubstitute.name;
      const { substitutionText } = parseRecipeDisplayName(ingredientToSubstitute.name);
      if (substitutionText) originalNameForSub = substitutionText;
      
      console.log('[DEBUG] Creating substitution change:', {
        originalIngredient: {
          name: ingredientToSubstitute.name,
          amount: ingredientToSubstitute.amount,
          unit: ingredientToSubstitute.unit,
        },
        substitution: {
          name: substitution.name,
          amount: substitution.amount,
          unit: substitution.unit,
          description: substitution.description,
        },
        originalNameForSub,
        isRemoval,
        entryPoint,
        selectedScaleFactor,
      });
      
      // Calculate the original (unscaled) amount for substitution
      let originalSubstitutionAmount: string | null = null;
      if (substitution.amount != null && selectedScaleFactor !== 1) {
        const parsedAmount = parseAmountString(String(substitution.amount));
        if (parsedAmount !== null) {
          // Unscale the amount to get the original amount
          const originalAmount = parsedAmount / selectedScaleFactor;
          originalSubstitutionAmount = formatAmountNumber(originalAmount) || originalAmount.toString();
        } else {
          originalSubstitutionAmount = String(substitution.amount);
        }
      } else {
        originalSubstitutionAmount = substitution.amount != null ? String(substitution.amount) : null;
      }
      
      const newChange: AppliedChange = {
        from: originalNameForSub,
        to: isRemoval
          ? null
          : {
              name: substitution.name,
              amount: originalSubstitutionAmount, // Save the original unscaled amount
              unit: substitution.unit ?? null,
              preparation: substitution.description ?? null,
              suggested_substitutions: null,
            },
      };

      console.log('[DEBUG] Created newChange object:', {
        isRemoval,
        originalNameForSub,
        substitutionName: substitution.name,
        newChange,
        willCreateRemoval: isRemoval ? 'YES - to: null' : 'NO - to: object',
      });

      console.log('[DEBUG] Final substitution change object (with unscaled amount):', {
        newChange,
        toIngredient: newChange.to,
        scaledAmountFromModal: substitution.amount,
        unscaledAmountSaved: newChange.to?.amount,
        currentScaleFactor: selectedScaleFactor,
        unitAfterConversion: newChange.to?.unit,
      });

      if (isRemoval) setLastRemoved({ from: newChange.from, to: null });

      setAppliedChanges((prev) => {
        const existingChangeIndex = prev.findIndex((c) => c.from === originalNameForSub);
        if (existingChangeIndex > -1) {
          const updated = [...prev];
          updated[existingChangeIndex] = newChange;
          console.log('[DEBUG] Updated existing substitution:', {
            index: existingChangeIndex,
            oldChange: prev[existingChangeIndex],
            newChange,
          });
          return updated;
        }
        const newAppliedChanges = [...prev, newChange];
        console.log('[DEBUG] Added new substitution/removal:', {
          isRemoval,
          ingredientName: originalNameForSub,
          previousChanges: prev,
          newChange,
          allChanges: newAppliedChanges,
          previousCount: prev.length,
          newCount: newAppliedChanges.length,
        });
        return newAppliedChanges;
      });
    });
  };

  const undoIngredientRemoval = React.useCallback(
    (fullName: string) => {
      const { baseName: originalName } = parseRecipeDisplayName(fullName);
      setAppliedChanges((prev) => prev.filter((change) => change.from !== originalName));
      if (lastRemoved?.from === originalName) setLastRemoved(null);
    },
    [lastRemoved],
  );

  const undoSubstitution = React.useCallback((originalName: string) => {
    setAppliedChanges((prev) => prev.filter((change) => change.from !== originalName));
  }, []);

  // Use titleOverride if available (for mise recipes), otherwise use the recipe title
  const rawTitle = params.titleOverride || recipe?.title;
  const cleanTitle = rawTitle?.replace(/\s*(?:[–-]\s*)?by\s+.*$/i, '').replace(/\s+recipe\s*$/i, '').trim();
  
  console.log('[DEBUG] Title selection:', {
    titleOverride: params.titleOverride,
    recipeTitle: recipe?.title,
    rawTitle,
    cleanTitle,
    entryPoint,
  });

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

      // Use the recipe data directly (local modifications removed)
      const baseRecipe = recipe;
      
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
              skipTitleUpdate: !!params.titleOverride, // Skip title suggestions if title override exists
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
          recipeYield: getScaledYieldText(originalRecipe?.recipeYield || baseRecipe.recipeYield, selectedScaleFactor),
          instructions: finalInstructions,
          ingredientGroups: scaledIngredientGroups,
        };

        setIsRewriting(false);

          router.push({
            pathname: '/recipe/steps',
            params: {
              recipeData: JSON.stringify(modifiedRecipe),
              miseRecipeId: miseRecipeId,
              // Pass title_override if available
              ...(params.titleOverride && {
                titleOverride: params.titleOverride
              }),
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
            // Pass title_override if available
            ...(params.titleOverride && {
              titleOverride: params.titleOverride
            }),
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
            skipTitleUpdate: !!params.titleOverride, // Skip title suggestions if title override exists
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
    // Use the selected scale factor directly (now always relative to original)

    const finalRecipeData = {
      // Pass the ORIGINAL recipe data with all metadata intact
      ...recipe,
      // Update the yield text and instructions for the prepared version
                recipeYield: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
      instructions: finalInstructions,
      ingredientGroups: scaledIngredientGroups,
    };

    const appliedChangesData = {
      ingredientChanges: appliedChanges.map((change) => ({
        from: change.from,
        to: change.to ? {
          name: change.to.name,
          amount: change.to.amount,
          unit: change.to.unit,
          preparation: change.to.preparation,
        } : null, // Preserve complete substitution data
      })),
              scalingFactor: selectedScaleFactor,
    };

    console.log('[DEBUG] ✅ FIXED: Preserving complete substitution data when saving:', {
      originalAppliedChanges: appliedChanges.map(change => ({
        from: change.from,
        to: change.to ? {
          name: change.to.name,
          amount: change.to.amount,
          unit: change.to.unit,
          preparation: change.to.preparation,
        } : null,
      })),
      savedAppliedChangesData: appliedChangesData,
      dataPreserved: appliedChanges.map(change => ({
        from: change.from,
        originalAmount: change.to?.amount || 'N/A',
        originalUnit: change.to?.unit || 'N/A',
        savedData: change.to,
        amountPreserved: !!change.to?.amount,
        unitPreserved: !!change.to?.unit,
      })),
    });

          console.log('[DEBUG] 📋 Preparing recipe for mise save with comprehensive details:', {
        recipeId: recipe.id,
        entryPoint,
        finalRecipeData: {
          title: finalRecipeData.title,
          recipeYield: finalRecipeData.recipeYield,
          ingredientGroupsCount: finalRecipeData.ingredientGroups?.length || 0,
          totalIngredients: finalRecipeData.ingredientGroups?.reduce((total, group) => 
            total + (group.ingredients?.length || 0), 0) || 0,
          instructionsCount: finalRecipeData.instructions?.length || 0,
          hasImage: !!finalRecipeData.image,
          hasSourceUrl: !!finalRecipeData.sourceUrl,
          prepTime: finalRecipeData.prepTime,
          cookTime: finalRecipeData.cookTime,
        },
        appliedChangesData: {
          scalingFactor: appliedChangesData.scalingFactor,
          ingredientChangesCount: appliedChangesData.ingredientChanges?.length || 0,
          ingredientChanges: appliedChangesData.ingredientChanges?.map(change => ({
            from: change.from,
            to: change.to ? (typeof change.to === 'string' ? change.to : change.to.name) : null,
            isRemoval: !change.to,
            hasAmountData: change.to && typeof change.to === 'object' && !!change.to.amount,
            hasUnitData: change.to && typeof change.to === 'object' && !!change.to.unit,
            hasPreparationData: change.to && typeof change.to === 'object' && !!change.to.preparation,
          })) || [],
        },
        originalRecipeData: {
          title: (originalRecipe || recipe).title,
          recipeYield: (originalRecipe || recipe).recipeYield,
          ingredientGroupsCount: (originalRecipe || recipe).ingredientGroups?.length || 0,
          totalOriginalIngredients: (originalRecipe || recipe).ingredientGroups?.reduce((total, group) => 
            total + (group.ingredients?.length || 0), 0) || 0,
          instructionsCount: (originalRecipe || recipe).instructions?.length || 0,
        },
        scalingInfo: {
          selectedScaleFactor,
          originalYieldValue,
          finalYieldText: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
        },
      });

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
          originalRecipeData: originalRecipe || recipe, // Pass original recipe data directly
          preparedRecipeData: finalRecipeData,
          appliedChanges: appliedChangesData,
          finalYield: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
          titleOverride: newTitle || null,
        }),
      });

      const result = await response.json();
      
      console.log('[DEBUG] Mise save response:', {
        success: response.ok,
        status: response.status,
        result,
        savedRecipeData: result.miseRecipe ? {
          id: result.miseRecipe.id,
          title: result.miseRecipe.title,
          // Add any other relevant fields from the saved recipe
        } : null,
      });
      
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

      console.log('[Summary] 🚀 Navigating to mise tab after successful save');
      console.log('[Summary] 📊 Save details:', {
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        miseRecipeId: result.miseRecipe.id,
        hasModifications: needsSubstitution || needsScaling,
        modificationsCount: appliedChanges.length,
        scalingFactor: selectedScaleFactor,
      });
      
      // Navigate directly to mise tab
      router.replace('/tabs/mise' as any);

    } catch (saveError: any) {
      showError('Save Failed', `Couldn't save recipe to mise: ${saveError.message}`);
      return; // Stop execution on failure
    }
  }, [recipe, scaledIngredients, scaledIngredientGroups, appliedChanges, router, showError, selectedScaleFactor, session, entryPoint, miseRecipeId]);

  const handleGoToSteps = () => InteractionManager.runAfterInteractions(navigateToNextScreen);

  const handleGoToRecipeSteps = () => {
    if (!preparedRecipeData) return;
    
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
        // Pass title_override if available
        ...(params.titleOverride && {
          titleOverride: params.titleOverride
        }),
      },
    });
  };

  const handleGoToMise = () => {
    router.replace('/tabs/mise' as any);
  };

  const handleGoHome = () => {
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
            skipTitleUpdate: !!params.titleOverride, // Skip title suggestions if title override exists
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
          recipeYield: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
          instructions: finalInstructions,
          ingredientGroups: scaledIngredientGroups,
        };

        const appliedChangesData = {
          ingredientChanges: appliedChanges.map((change) => ({
            from: change.from,
            to: change.to ? {
              name: change.to.name,
              amount: change.to.amount,
              unit: change.to.unit,
              preparation: change.to.preparation,
            } : null, // Preserve complete substitution data
          })),
          scalingFactor: selectedScaleFactor,
        };

        console.log('[DEBUG] ✅ FIXED: Preserving complete substitution data when saving (handleSaveForLater):', {
          originalAppliedChanges: appliedChanges.map(change => ({
            from: change.from,
            to: change.to ? {
              name: change.to.name,
              amount: change.to.amount,
              unit: change.to.unit,
              preparation: change.to.preparation,
            } : null,
          })),
          savedAppliedChangesData: appliedChangesData,
          dataPreserved: appliedChanges.map(change => ({
            from: change.from,
            originalAmount: change.to?.amount || 'N/A',
            originalUnit: change.to?.unit || 'N/A',
            savedData: change.to,
            amountPreserved: !!change.to?.amount,
            unitPreserved: !!change.to?.unit,
          })),
        });

        console.log('[DEBUG] Saving modified recipe with data:', {
          modifiedRecipeData: {
            title: modifiedRecipeData.title,
            recipeYield: modifiedRecipeData.recipeYield,
            ingredientGroups: modifiedRecipeData.ingredientGroups?.map(group => ({
              name: group.name,
              ingredients: group.ingredients?.map(ing => ({
                name: ing.name,
                amount: ing.amount,
                unit: ing.unit,
              })),
            })),
          },
          appliedChangesData,
          originalRecipeData: {
            title: (originalRecipe || recipe).title,
            recipeYield: (originalRecipe || recipe).recipeYield,
          },
        });

        // Save the modified recipe
        const saveResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalRecipeId: recipe.id,
            originalRecipeData: originalRecipe || recipe, // Pass original recipe data directly
            userId: session.user.id,
            modifiedRecipeData,
            appliedChanges: appliedChangesData,
          }),
        });

        const saveResult = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(saveResult.error || 'Failed to save modified recipe');

        router.replace('/tabs/saved' as any);

      } catch (error: any) {
        setIsSavingForLater(false);
        console.error('Error saving modified recipe:', error);
        showError('Save Failed', `Could not save modified recipe: ${error.message}`);
      }
    } else {
      // No modifications, save original recipe (instant - no loading state needed)
      try {
        const { saveRecipe } = require('@/lib/savedRecipes');
        const success = await saveRecipe(recipe.id);
        if (success) {
          router.replace('/tabs/saved' as any);
        } else {
          showError('Save Failed', 'Could not save recipe. Please try again.');
        }
      } catch (error) {
        console.error('Error saving recipe:', error);
        showError('Save Failed', 'Could not save recipe. Please try again.');
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

  const handleCookNow = async () => {
    console.log('[Summary] Cook now button pressed');
    
    // Only allow from saved entrypoint
    if (entryPoint !== 'saved') {
      console.log('[Summary] Cook now only available from saved entrypoint');
      return;
    }
    
    if (!recipe || !scaledIngredients) {
      console.error('[Summary] Cannot cook now, essential data is missing.');
      return;
    }

    const needsScaling = selectedScaleFactor !== 1;
    const needsSubstitution = appliedChanges.length > 0;
    const hasModifications = needsScaling || needsSubstitution;

    console.log('[Summary] Cook now modifications check:', {
      needsScaling,
      needsSubstitution,
      hasModifications,
      scaleFactor: selectedScaleFactor,
      changesCount: appliedChanges.length,
    });

    setIsCookingNow(true);

    try {
      let finalInstructions = recipe.instructions || [];
      let newTitle: string | null = null;

      if (hasModifications) {
        console.log('[Summary] Modifications detected, calling modify-instructions endpoint');
        
        // Check removal limit
        const removalCount = appliedChanges.filter((c) => !c.to).length;
        if (removalCount > 2) {
          showError('Limit Reached', 'You can only remove up to 2 ingredients per recipe.');
          setIsCookingNow(false);
          return;
        }

        // Flatten all ingredients from ingredient groups for scaling
        const allIngredients: StructuredIngredient[] = [];
        if (recipe.ingredientGroups) {
          recipe.ingredientGroups.forEach(group => {
            if (group.ingredients && Array.isArray(group.ingredients)) {
              allIngredients.push(...group.ingredients);
            }
          });
        }

        // Call modify-instructions API
        const backendUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!backendUrl) {
          throw new Error('Backend API URL is not configured.');
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
            skipTitleUpdate: !!params.titleOverride,
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

        console.log('[Summary] Successfully modified instructions for cook now');
      }

      // Create the recipe for steps
      const recipeForSteps = {
        ...recipe,
        title: newTitle || recipe.title,
        recipeYield: getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
        instructions: finalInstructions,
        ingredientGroups: scaledIngredientGroups,
      };

      console.log('[Summary] Navigating to steps with recipe data:', {
        title: recipeForSteps.title,
        hasModifications,
        instructionsCount: finalInstructions.length,
      });

      // Navigate to steps
      router.push({
        pathname: '/recipe/steps',
        params: {
          recipeData: JSON.stringify(recipeForSteps),
          // Pass title_override if available
          ...(params.titleOverride && {
            titleOverride: params.titleOverride
          }),
        },
      });

    } catch (error: any) {
      console.error('[Summary] Error in cook now:', error);
      showError('Cook Now Failed', `Could not start cooking: ${error.message}`);
    } finally {
      setIsCookingNow(false);
    }
  };

  const handleSaveModifications = async () => {
    if (entryPoint !== 'mise' || !miseRecipeId || !recipe) {
      console.error('[Summary] handleSaveModifications: Invalid entry point or missing data');
      return;
    }

    if (!session?.user?.id) {
      showError('Authentication Required', 'You must be logged in to save modifications.');
      return;
    }

    try {
      // Check if we have modifications that need LLM processing
      const needsSubstitution = appliedChanges.length > 0;
      const needsScaling = selectedScaleFactor !== 1;
      
      let processedRecipeData = recipe;
      let finalInstructions = recipe.instructions || [];
      let newTitle: string | null = null;

      // Process modifications with LLM if needed
      if (needsSubstitution || needsScaling) {
        setIsSavingModifications(true);
        console.log('[Summary] Processing modifications with LLM before saving...');
        
        // Use the recipe data directly (local modifications removed)
        const baseRecipe = recipe;

        // Flatten all ingredients from ingredient groups for scaling
        const allIngredients: StructuredIngredient[] = [];
        if (baseRecipe.ingredientGroups) {
          baseRecipe.ingredientGroups.forEach(group => {
            if (group.ingredients && Array.isArray(group.ingredients)) {
              allIngredients.push(...group.ingredients);
            }
          });
        }

        // Call modify-instructions API to process changes
        const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
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
            skipTitleUpdate: !!params.titleOverride, // Skip title suggestions if title override exists
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `Modification processing failed (Status: ${response.status})`);
        }
        if (!result.modifiedInstructions) {
          throw new Error('Invalid format for modified instructions.');
        }

        finalInstructions = result.modifiedInstructions;
        
        // Capture new title if suggested by LLM
        if (result.newTitle && result.newTitle.trim() !== '') {
          newTitle = result.newTitle;
        }

        // Create the processed recipe data
        processedRecipeData = {
          ...baseRecipe,
          title: newTitle || baseRecipe.title,
          recipeYield: getScaledYieldText(originalRecipe?.recipeYield || baseRecipe.recipeYield, selectedScaleFactor),
          instructions: finalInstructions,
          ingredientGroups: scaledIngredientGroups,
        };

        console.log('[Summary] ✅ LLM processing completed:', {
          originalInstructionsCount: baseRecipe.instructions?.length || 0,
          processedInstructionsCount: finalInstructions.length,
          newTitle: newTitle,
          scalingFactor: selectedScaleFactor,
          substitutionsCount: appliedChanges.length,
        });
      } else {
        console.log('[Summary] No modifications requiring LLM processing');
      }

      const appliedChangesData = {
        ingredientChanges: appliedChanges.map((change) => ({
          from: change.from,
          to: change.to ? {
            name: change.to.name,
            amount: change.to.amount,
            unit: change.to.unit,
            preparation: change.to.preparation,
          } : null,
        })),
        scalingFactor: selectedScaleFactor,
      };

      console.log('[Summary] Saving processed modifications to database:', {
        miseRecipeId,
        selectedScaleFactor,
        appliedChangesCount: appliedChanges.length,
        processedRecipeTitle: processedRecipeData.title,
        processedRecipeYield: processedRecipeData.recipeYield,
        instructionsCount: processedRecipeData.instructions?.length || 0,
        needsLLMProcessing: needsSubstitution || needsScaling,
      });

      // Save the processed recipe to database
      const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
      const response = await fetch(`${backendUrl}/api/mise/recipes/${miseRecipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          preparedRecipeData: processedRecipeData, // Save the processed version
          appliedChanges: appliedChangesData,
          finalYield: getScaledYieldText(originalRecipe?.recipeYield || recipe.recipeYield, selectedScaleFactor),
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || `Update failed (Status: ${response.status})`);
      }

      // Local state updates removed - mise.tsx will fetch fresh data on focus

      // Reset modifications state
      setHasModifications(false);
      
      console.log('[Summary] 🚀 Navigating to mise tab after successful modification save');
      console.log('[Summary] 📊 Modification save details:', {
        miseRecipeId,
        recipeTitle: processedRecipeData.title,
        hasModifications: needsSubstitution || needsScaling,
        modificationsCount: appliedChanges.length,
        scalingFactor: selectedScaleFactor,
      });
      
      // Navigate directly to mise tab (consistent with other entrypoints)
      router.replace('/tabs/mise' as any);

    } catch (error: any) {
      console.error('[Summary] Failed to save modifications:', error);
      showError('Save Failed', `Could not save modifications: ${error.message}`);
    } finally {
      setIsSavingModifications(false);
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
        {/* Recipe image - only render if image exists */}
        {(() => {
          const imageUrl = recipe.image || recipe.thumbnailUrl;
          
          // Debug logging for image URL
          console.log('[DEBUG] Image URL check:', {
            recipeTitle: recipe.title,
            hasImage: !!recipe.image,
            imageValue: recipe.image,
            hasThumbnail: !!recipe.thumbnailUrl, 
            thumbnailValue: recipe.thumbnailUrl,
            finalImageUrl: imageUrl,
            imageUrlType: typeof imageUrl,
            imageUrlLength: imageUrl?.length,
            willRenderImage: !!imageUrl
          });
          
          if (!imageUrl || imageLoadFailed) {
            console.log('[DEBUG] No image URL or image failed to load - collapsing image area', {
              hasImageUrl: !!imageUrl,
              imageLoadFailed
            });
            return null; // Completely collapse when no image or image fails to load
          }

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
                alert('Could not open the video link.');
              }
            }
          };

          if (isVideoRecipe) {
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
                  onError={() => {
                    console.log('[DEBUG] Image failed to load, collapsing image area:', imageUrl);
                    setImageLoadFailed(true);
                  }}
                />
              </TouchableOpacity>
            );
          } else {
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
                onError={() => {
                  console.log('[DEBUG] Image failed to load, collapsing image area:', imageUrl);
                  setImageLoadFailed(true);
                }}
              />
            );
          }
        })()}
        {/* Short description left-aligned, outside columns */}
        {/* {recipe.shortDescription && (
          <Text style={styles.shortDescriptionHeaderLeft}>
            {recipe.shortDescription.endsWith('.') 
              ? recipe.shortDescription.slice(0, -1) 
              : recipe.shortDescription}
          </Text>
        )} */}
        {/* Condensed single-line meta info */}
        {(recipe.prepTime || recipe.cookTime || detectedAllergens.length > 0) && (
          <View style={styles.metaInfoCondensed}>
            <Text style={styles.metaInfoCondensedText}>
              {[
                recipe.prepTime && `prep: ${formatTimeCondensed(recipe.prepTime)}`,
                recipe.cookTime && `cook: ${formatTimeCondensed(recipe.cookTime)}`,
                detectedAllergens.length > 0 && `allergens: ${detectedAllergens.join(', ')}`
              ].filter(Boolean).join(' | ')}
            </Text>
          </View>
        )}

        {/* Divider between meta info and Adjust servings */}
        <View style={{ marginTop: SPACING.lg, marginBottom: SPACING.lg }}>
          <View style={styles.divider} />
        </View>

        <View style={{ marginTop: 0 }}>
          <Text style={styles.sectionTitle}>Adjust servings</Text>
          <ServingScaler
            selectedScaleFactor={selectedScaleFactor}
            handleScaleFactorChange={handleScaleFactorChange}
            recipeYield={originalRecipe?.recipeYield || recipe?.recipeYield}
            originalYieldValue={originalYieldValue}
          />
        </View>

        {/* Divider between Adjust servings and Swap ingredients */}
        <View style={{ marginTop: SPACING.lg, marginBottom: SPACING.lg }}>
          <View style={styles.divider} />
        </View>

        <View style={{ marginTop: 0 }}>
          <Text style={styles.sectionTitle}>Swap ingredients</Text>
          {selectedScaleFactor !== 1 && (
            <Text style={styles.ingredientsSubtext}>
              {(() => {
                const direction = selectedScaleFactor < 1 ? 'down' : 'up';
                // Always scale from original recipe yield
                const scaledYieldString = getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor);
                
                console.log('[DEBUG] Yield display (simplified):', {
                  originalYield: originalRecipe?.recipeYield || recipe?.recipeYield,
                  scaledYieldString,
                  selectedScaleFactor,
                });
                return `Now scaled ${direction} to ${scaledYieldString}.`;
              })()}
            </Text>
          )}
          <View style={{marginTop: SPACING.xs, paddingLeft: SPACING.md}}>
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
        </View>

        {/* Visit Source link inside ScrollView with proper spacing */}
        {recipe?.sourceUrl && (
          <View style={[styles.visitSourceContainer, { marginBottom: 60 }]}>
            <Text
              style={styles.visitSourceLink}
              onPress={() => Linking.openURL(recipe.sourceUrl!)}
            >
              Visit Source ↗︎
            </Text>
          </View>
        )}
      </ScrollView>

      <RecipeFooterButtons
        handleGoToSteps={handleGoToSteps}
        isRewriting={isRewriting}
        isScalingInstructions={isScalingInstructions}
        handleSaveForLater={handleSaveForLater}
        handleRemoveFromSaved={handleRemoveFromSaved}
        handleSaveModifications={handleSaveModifications}
        handleCookNow={handleCookNow}
        isSavingForLater={isSavingForLater}
        isSavingModifications={isSavingModifications}
        isCookingNow={isCookingNow}
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
            fontFamily: FONT.family.ubuntu,
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
    height: BORDER_WIDTH.default,
    backgroundColor: COLORS.divider,
  },
  mainIngredientsHeader: {
    marginBottom: SPACING.sm,
  } as ViewStyle,
  mainIngredientsTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  sectionTitle: {
    ...sectionHeaderText,
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.xs,
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
    fontSize: FONT.size.smBody+1,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xxs,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.xs, // Reduced for wider text area
    paddingHorizontal: SPACING.xs, // Reduced for wider text area
    lineHeight: FONT.lineHeight.compact,
  },
  metaInfoCondensed: {
    fontFamily: FONT.family.inter,
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  metaInfoCondensedText: {
    ...captionText,
    color: COLORS.textMuted,
    fontSize: FONT.size.caption,
    textAlign: 'left',
  },
  visitSourceContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm, // Smaller margin to bring closer to buttons
    zIndex: 1, // Ensure it's above other elements
    elevation: 1, // For Android
  },
  visitSourceLink: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.caption,
    color: COLORS.textDark,
    textDecorationLine: 'underline',
    opacity: 0.5,
  },
});