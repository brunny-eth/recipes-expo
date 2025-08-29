import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
  ViewStyle,
  TextStyle,
  ImageStyle,
  InteractionManager,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import FastImage from '@d11/react-native-fast-image';
import RecipeHeaderTitle from '@/components/recipe/RecipeHeaderTitle';

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
import { useHandleError } from '@/hooks/useHandleError';
import { useSuccessModal } from '@/context/SuccessModalContext';
import InlineErrorBanner from '@/components/InlineErrorBanner';
import {
  sectionHeaderText,
  bodyText,
  captionStrongText,
  bodyStrongText,
  captionText,
  FONT,
  metaText,
  screenTitleText,
} from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import IngredientSubstitutionModal from '@/app/recipe/IngredientSubstitutionModal';
import { useAnalytics } from '@/utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CollapsibleSection from '@/components/CollapsibleSection';
import IngredientList from '@/components/recipe/IngredientList';
import ServingScaler from '@/components/recipe/ServingScaler';
import FolderPickerModal from '@/components/FolderPickerModal';
import RecipeFooterButtons from '@/components/recipe/RecipeFooterButtons';
import RecipeVariationsModal, { VariationType } from '@/components/RecipeVariationsModal';

import RecipeStepsHeader from '@/components/recipe/RecipeStepsHeader';
import ScreenHeader from '@/components/ScreenHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCooking } from '@/context/CookingContext';

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
  console.log('[Summary] 🎬 Component render started');
  
  const params = useLocalSearchParams<{
    recipeData?: string; 
    from?: string; 
    appliedChanges?: string; 
    isModified?: string; 
    entryPoint?: string; 
    miseRecipeId?: string; 
    finalYield?: string; 
    originalRecipeData?: string; 
    titleOverride?: string; 
    inputType?: string;
    folderId?: string; // Add folderId for saved recipes
    recipeId?: string; // Add recipeId for ID-based loading
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const { showError, hideError } = useErrorModal();
  const { showSuccess } = useSuccessModal();
  const handleError = useHandleError();
  const { track } = useAnalytics();
  const insets = useSafeAreaInsets();
  const cookingContext = useCooking();

  // ✅ FIX: Extract recipeId from params and convert to numeric
  const recipeId = params.recipeId;
  const entryPoint = params.entryPoint || 'new'; // Default to 'new' for backward compatibility
  const miseRecipeId = params.miseRecipeId; // Store the mise recipe ID for modifications
  const folderId = params.folderId; // Store folderId for saved recipes
  const appliedChanges = params.appliedChanges; // Store appliedChanges
  const originalRecipeData = params.originalRecipeData; // Store originalRecipeData
  const titleOverride = params.titleOverride; // Store titleOverride
  const inputType = params.inputType; // Store inputType
  const from = params.from; // Store from
  const isModified = params.isModified; // Store isModified
  const finalYield = params.finalYield; // Store finalYield
  const numericId = Number(recipeId);
  
  // Get the actual recipe ID (from param or recipe object)
  const getRecipeId = () => {
    if (recipeId && !isNaN(numericId)) {
      return numericId;
    }
    // If recipeId param is not available, get it from the recipe object
    return recipe?.id || null;
  };
  
  // Extract and validate entryPoint with logging
  const entryPointValue = entryPoint || 'new'; // Default to 'new' for backward compatibility
  const miseRecipeIdValue = miseRecipeId; // Store the mise recipe ID for modifications
  const folderIdValue = folderId; // Store folderId for saved recipes
  const appliedChangesValue = appliedChanges; // Store appliedChanges
  const originalRecipeDataValue = originalRecipeData; // Store originalRecipeData
  const titleOverrideValue = titleOverride; // Store titleOverride
  const inputTypeValue = inputType; // Store inputType
  const fromValue = from; // Store from
  const isModifiedValue = isModified; // Store isModified
  const finalYieldValue = finalYield; // Store finalYield

  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [originalRecipe, setOriginalRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isTitleModalVisible, setIsTitleModalVisible] = useState(false);
  const [isAllergensExpanded, setIsAllergensExpanded] = useState(false);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isRecipeSizeExpanded, setIsRecipeSizeExpanded] = useState(false);
  const [isDescriptionTextExpanded, setIsDescriptionTextExpanded] = useState(false);
  const [isVariationsModalVisible, setIsVariationsModalVisible] = useState(false);
  const [isApplyingVariation, setIsApplyingVariation] = useState(false);
  // State to track if image failed to load
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  
  // Title editing state
  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const originalTitleRef = useRef('');

  // Folder picker state for title editing
  const [isFolderPickerVisible, setIsFolderPickerVisible] = useState(false);
  const [pendingTitleSave, setPendingTitleSave] = useState<{
    cleanTitle: string;
    recipeId: number;
    userId: string;
  } | null>(null);

  console.log('[Summary] 📊 Current state:', {
    hasRecipe: !!recipe,
    recipeId: recipe?.id,
    title: title,
    isEditingTitle,
    isLoading,
  });
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false);

  const [originalYieldValue, setOriginalYieldValue] = useState<number | null>(
    null,
  );
  const [selectedScaleFactor, setSelectedScaleFactor] = useState<number>(1.0);

  const [substitutionModalVisible, setSubstitutionModalVisible] =
    useState(false);
  const [selectedIngredient, setSelectedIngredient] =
    useState<StructuredIngredient | null>(null);
  // Separate persisted changes (loaded from DB, locked) from current unsaved changes (revertible)
  const [persistedChanges, setPersistedChanges] = useState<AppliedChange[]>([]);
  const [currentUnsavedChanges, setCurrentUnsavedChanges] = useState<AppliedChange[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isScalingInstructions, setIsScalingInstructions] = useState(false);
  // Track loading state specifically for the "Save for later" action so we don't disable the primary button.
  const [isSavingForLater, setIsSavingForLater] = useState(false);
  // Track loading state for saving modifications in mise entry point
  const [isSavingModifications, setIsSavingModifications] = useState(false);
  // Track loading state for saving changes on saved recipes
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  // Track loading state for cook now button

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

  // Dev log to correlate substitution modal with background modal flicker
  useEffect(() => {
    if (__DEV__) {
      console.log(`[Summary] substitutionModalVisible=${substitutionModalVisible}`);
    }
  }, [substitutionModalVisible]);

  // Determine if we're viewing a saved recipe (clean display) vs actively editing (show indicators)
  // For mise recipes: we're actively editing even if appliedChanges exist in URL
  // The URL appliedChanges are just the baseline from existing mise recipe
  const isViewingSavedRecipe = entryPoint !== 'mise' && !!params.appliedChanges;
  if (__DEV__) {
    console.log('[DEBUG] Entry point analysis:', {
      entryPoint,
      hasAppliedChanges: !!params.appliedChanges,
      isViewingSavedRecipe,
      selectedScaleFactor,
      miseRecipeId,
      persistedChangesLength: persistedChanges.length,
      currentUnsavedChangesLength: currentUnsavedChanges.length,
      'Should show undo buttons?': !isViewingSavedRecipe,
    });
  }

  // Track if modifications have been made for mise entry point
  const [hasModifications, setHasModifications] = useState(false);

  // Track if recipe is already in mise with current modifications
  const [isAlreadyInMise, setIsAlreadyInMise] = useState(false);

  // Track the baseline state when screen loads (for mise entry point)
  const [baselineScaleFactor, setBaselineScaleFactor] = useState<number>(1);
  // baselineScaleFactor should always be 1.0 (original recipe scale)
  // selectedScaleFactor represents the current user-selected scale
  const [baselineAppliedChanges, setBaselineAppliedChanges] = useState<AppliedChange[]>([]);
  
  // Store the unscaled ingredient groups to use as baseline for scaling calculations
  const [unscaledIngredientGroups, setUnscaledIngredientGroups] = useState<IngredientGroup[]>([]);

  const scaledIngredientGroups = React.useMemo<IngredientGroup[]>(() => {
    // Use unscaledIngredientGroups as baseline if available, otherwise fall back to originalRecipe
    const sourceIngredientGroups = unscaledIngredientGroups.length > 0 
      ? unscaledIngredientGroups 
      : originalRecipe?.ingredientGroups || [];
    
    if (sourceIngredientGroups.length === 0) return [];
    
    // Combine persisted and current changes for processing
    const allAppliedChanges = [...persistedChanges, ...currentUnsavedChanges];
    
    if (__DEV__) {
      console.log('[DEBUG] ===== SCALING INGREDIENTS =====');
      console.log('[DEBUG] Scaling context:', {
        entryPoint,
        selectedScaleFactor,
        persistedChangesCount: persistedChanges.length,
        currentUnsavedChangesCount: currentUnsavedChanges.length,
        allAppliedChangesCount: allAppliedChanges.length,
        allAppliedChanges,
        isViewingSavedRecipe,
        originalRecipeTitle: originalRecipe?.title,
      });
    }
    
    const result = sourceIngredientGroups.map((group) => {
      if (!group.ingredients || !Array.isArray(group.ingredients)) {
        return { ...group, ingredients: [] };
      }
      
      if (__DEV__) {
        console.log('[DEBUG] Processing group:', {
          groupName: group.name || 'Default',
          ingredientCount: group.ingredients.length,
        });
      }
      
      // Always scale ingredients from the original recipe using the current selectedScaleFactor
      const scaledIngredients = group.ingredients.map((ingredient) => {
        if (__DEV__) {
          console.log('[DEBUG] Scaling from original recipe:', {
            ingredient: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
            scaleFactor: selectedScaleFactor,
            entryPoint
          });
        }
        
        const scaledIngredient = scaleIngredient(ingredient, selectedScaleFactor);
        if (__DEV__) {
          console.log('[DEBUG] After scaling:', {
            ingredient: scaledIngredient.name,
            amount: scaledIngredient.amount,
            unit: scaledIngredient.unit,
          });
        }
        
        return scaledIngredient;
      });

      let finalIngredients = scaledIngredients;
      if (allAppliedChanges.length > 0) {
        if (__DEV__) {
          console.log('[DEBUG] Applying substitutions to scaled ingredients...');
        }
        
        if (isViewingSavedRecipe) {
          // Clean display for saved recipes: filter out removed, cleanly replace substituted
          finalIngredients = scaledIngredients
            .map((baseIngredient) => {
              // Parse the display name to get the original name without "(removed)" or "(substituted for X)" text
              const { baseName: originalName } = parseRecipeDisplayName(baseIngredient.name);
              const change = allAppliedChanges.find((c) => c.from === originalName);
              
                          if (__DEV__) {
              console.log('[DEBUG] Checking ingredient for substitution (clean display):', {
                baseIngredientName: baseIngredient.name,
                originalName,
                foundChange: !!change,
                change,
              });
            }
              
              if (change) {
                if (change.to === null) {
                  if (__DEV__) {
                    console.log('[DEBUG] Marking ingredient for removal:', originalName);
                  }
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
                if (__DEV__) {
                  console.log('[DEBUG] Applying clean substitution with dynamic scaling:', {
                    originalName,
                    originalSubstitutionAmount: change.to.amount,
                    currentScaleFactor: selectedScaleFactor,
                    scaledSubstitutionAmount,
                    substitutedIngredient,
                  });
                }
                return substitutedIngredient;
              }
              if (__DEV__) {
                console.log('[DEBUG] No substitution found, keeping original:', {
                  name: baseIngredient.name,
                  amount: baseIngredient.amount,
                  unit: baseIngredient.unit,
                });
              }
              return baseIngredient;
            })
            .filter((ingredient): ingredient is StructuredIngredient => ingredient !== null);
        } else {
          // Active editing: show visual indicators for user feedback
          finalIngredients = scaledIngredients.map((baseIngredient) => {
            const change = allAppliedChanges.find((c) => c.from === baseIngredient.name);
            
            if (__DEV__) {
              console.log('[DEBUG] Checking ingredient for substitution (with indicators):', {
                baseIngredientName: baseIngredient.name,
                foundChange: !!change,
                change,
              });
            }
            
                          if (change) {
                if (change.to === null) {
                  if (__DEV__) {
                  console.log('[DEBUG] Applying removal indicator:', baseIngredient.name);
                }
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
                if (__DEV__) {
                  console.log('[DEBUG] Applying substitution with indicator and dynamic scaling:', {
                    originalName: baseIngredient.name,
                    originalSubstitutionAmount: change.to.amount,
                    currentScaleFactor: selectedScaleFactor,
                    scaledSubstitutionAmount,
                    substitutedIngredient,
                  });
                }
                return substitutedIngredient;
              }
            if (__DEV__) {
              console.log('[DEBUG] No substitution found, keeping original:', {
                name: baseIngredient.name,
                amount: baseIngredient.amount,
                unit: baseIngredient.unit,
              });
            }
            return baseIngredient;
          });
        }
      }

      if (__DEV__) {
        console.log('[DEBUG] Final ingredients for group:', {
          groupName: group.name || 'Default',
          finalIngredients: finalIngredients.map(ing => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          })),
        });
      }

      return {
        ...group,
        ingredients: finalIngredients,
      };
    });
    
    if (__DEV__) {
      console.log('[DEBUG] ===== END SCALING INGREDIENTS =====');
    }
    return result;
  }, [originalRecipe, selectedScaleFactor, persistedChanges, currentUnsavedChanges, isViewingSavedRecipe, unscaledIngredientGroups]);

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

  // ✅ FIX: Function to fetch canonical recipe by ID
  const fetchCanonicalById = useCallback(async (id: number) => {
    if (!session?.access_token) {
      console.log('[Summary] No session, cannot fetch recipe');
      return null;
    }
    try {
      console.log('[Summary] Loading by id:', id);
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        console.error('[Summary] No backend URL configured');
        return null;
      }

      const response = await fetch(`${backendUrl}/api/recipes/${id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error('[Summary] Failed to fetch recipe:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('[Summary] Successfully fetched recipe by ID:', data?.id);
      console.log('[Summary] Full server response structure:', {
        hasData: !!data,
        dataKeys: Object.keys(data || {}),
        recipeId: data?.id,
        recipeDataId: data?.recipe_data?.id,
        hasRecipeData: !!data?.recipe_data,
        recipeDataKeys: data?.recipe_data ? Object.keys(data.recipe_data) : [],
      });
      
      // Extract the actual recipe data from the response
      const recipeData = data?.recipe_data;
      if (!recipeData) {
        console.error('[Summary] No recipe_data found in response');
        return null;
      }
      
      // Update cooking context with the fetched recipe
      if (cookingContext.updateRecipe && data?.id) {
        cookingContext.updateRecipe(data.id.toString(), recipeData);
      }
      
      return recipeData; // Return the actual recipe content, not the wrapper
    } catch (error) {
      console.error('[Summary] Error fetching recipe by ID:', error);
      return null;
    }
  }, [session?.access_token]); // Removed cookingContext dependency

  // ✅ FIX: Modified useEffect to fetch by ID when recipeData is missing
  useEffect(() => {
    const loadRecipe = async () => {
      if (params.recipeData) {
        // Legacy path: parse recipeData from params
        try {
          const parsed = JSON.parse(params.recipeData as string);
          if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
            handleError('Error Loading Summary', 'Recipe data is invalid.');
            setIsLoading(false);
            return;
          }
          
          // Debug: Log the recipe structure to see if sourceUrl exists
          if (__DEV__) {
            console.log('[DEBUG] Recipe data structure:', {
              hasRecipe: !!parsed,
              keys: Object.keys(parsed),
              sourceUrl: parsed.sourceUrl,
              hasSourceUrl: !!parsed.sourceUrl,
              recipePreview: {
                title: parsed.title,
                sourceUrl: parsed.sourceUrl,
                image: parsed.image,
              },
              // Add metadata debugging for fork detection
              metadata: {
                id: parsed.id,
                parent_recipe_id: parsed.parent_recipe_id,
                source_type: parsed.source_type,
                isUserModified: !!(parsed.parent_recipe_id || parsed.source_type === 'user_modified'),
              }
            });
          }
          
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
            
            // Set fresh scaling baseline for saved/forked recipes
            const isSavedEntrypoint = entryPoint === 'saved';
            if (isSavedEntrypoint) {
              console.log('[DEBUG] Setting fresh scaling baseline for saved recipe (with originalRecipeData)');
              // Treat current server values as the unscaled baseline (1×) for this screen load
              setUnscaledIngredientGroups(parsed.ingredientGroups ? [...parsed.ingredientGroups] : []);
              setBaselineScaleFactor(1);
              setSelectedScaleFactor(1);
              console.log('[DEBUG] Fresh baseline set:', {
                unscaledGroupsCount: parsed.ingredientGroups?.length || 0,
                baselineScaleFactor: 1,
                selectedScaleFactor: 1,
              });
            }
          } else {
            // For new recipes or when original data is not available, use current recipe as original
            setOriginalRecipe(parsed);
            const yieldNum = parseServingsValue(parsed.recipeYield);
            setOriginalYieldValue(yieldNum);
          }

          // Set fresh scaling baseline for saved/forked recipes
          const isSavedEntrypoint = entryPoint === 'saved';
          if (isSavedEntrypoint) {
            console.log('[DEBUG] Setting fresh scaling baseline for saved recipe');
            // Treat current server values as the unscaled baseline (1×) for this screen load
            setUnscaledIngredientGroups(parsed.ingredientGroups ? [...parsed.ingredientGroups] : []);
            setBaselineScaleFactor(1);
            setSelectedScaleFactor(1);
            console.log('[DEBUG] Fresh baseline set:', {
              unscaledGroupsCount: parsed.ingredientGroups?.length || 0,
              baselineScaleFactor: 1,
              selectedScaleFactor: 1,
            });
          }
          
          // Check if this is a saved recipe with existing applied changes
          if (params.appliedChanges) {
            if (__DEV__) {
              console.log('[DEBUG] Found appliedChanges URL param:', params.appliedChanges);
            }
            try {
              const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
              if (__DEV__) {
                console.log('[DEBUG] Parsed appliedChanges from URL:', savedAppliedChanges);
              }
              
              // Convert saved format to internal format
              if (savedAppliedChanges.ingredientChanges) {
                if (__DEV__) {
                  console.log('[DEBUG] Converting ingredientChanges to internal format:', savedAppliedChanges.ingredientChanges);
                }
              
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
              
                if (__DEV__) {
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
                }
              
                // These are changes loaded from the database, so they are persisted
                setPersistedChanges(convertedChanges);
                setCurrentUnsavedChanges([]); // No unsaved changes initially
                // Set baseline for both mise and saved entrypoints
                setBaselineScaleFactor(1.0);
                setBaselineAppliedChanges(convertedChanges);
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
                  // For saved recipes, ignore the old scaling factor since the saved data is already scaled
                  if (entryPoint === 'saved') {
                    console.log('[DEBUG] Saved recipe: could not calculate yield-based factor, using 1.0 as fresh baseline');
                    finalScaleFactor = 1.0;
                  } else {
                    console.log('[DEBUG] Could not calculate yield-based scale factor, using saved factor:', savedAppliedChanges.scalingFactor);
                    finalScaleFactor = savedAppliedChanges.scalingFactor;
                  }
                }
              } else if (savedAppliedChanges.scalingFactor) {
                // For saved recipes, ignore the old scaling factor since the saved data is already scaled
                if (entryPoint === 'saved') {
                  console.log('[DEBUG] Saved recipe: ignoring old scaling factor, using 1.0 as fresh baseline');
                  finalScaleFactor = 1.0;
                } else {
                  console.log('[DEBUG] Using scaling factor from saved changes:', savedAppliedChanges.scalingFactor);
                  finalScaleFactor = savedAppliedChanges.scalingFactor;
                }
              } else {
                console.log('[DEBUG] No scaling factor in saved changes, defaulting to 1.0');
                finalScaleFactor = 1.0;
              }
              
              setSelectedScaleFactor(finalScaleFactor);
              // Set baseline for both mise and saved entrypoints
              // Baseline should always be 1.0 (original recipe scale), not the saved scale factor
              setBaselineScaleFactor(1.0);
            } catch (appliedChangesError: any) {
              console.error('[DEBUG] Error parsing applied changes:', appliedChangesError);
              setSelectedScaleFactor(1.0);
              setPersistedChanges([]);
              setCurrentUnsavedChanges([]);
            }
          } else {
            console.log('[DEBUG] No appliedChanges URL param, defaulting to new recipe state');
            // New recipe, no existing changes
            setSelectedScaleFactor(1.0);
            setPersistedChanges([]);
            setCurrentUnsavedChanges([]);
            console.log('[INGREDIENT_LOCKING] New recipe initialized:', {
              entryPoint,
              persistedChanges: [],
              currentUnsavedChanges: [],
              recipeTitle: parsed.title,
            });
            // Set baseline for both mise and saved entrypoints
            setBaselineScaleFactor(1.0);
            setBaselineAppliedChanges([]);
          }
        } catch (e: any) {
          handleError('Error Loading Summary', e);
        }
      } else if (numericId && !isNaN(numericId)) {
        // ✅ FIX: New path: fetch recipe by ID
        console.log('[Summary] No recipeData, fetching by ID:', numericId);
        const fetchedRecipe = await fetchCanonicalById(numericId);
        
        if (fetchedRecipe) {
          setRecipe(fetchedRecipe);
          setOriginalRecipe(fetchedRecipe);
          const yieldNum = parseServingsValue(fetchedRecipe.recipeYield);
          setOriginalYieldValue(yieldNum);
          
          // Set fresh scaling baseline for saved recipes
          if (entryPoint === 'saved') {
            console.log('[DEBUG] Setting fresh scaling baseline for fetched saved recipe');
            setUnscaledIngredientGroups(fetchedRecipe.ingredientGroups ? [...fetchedRecipe.ingredientGroups] : []);
            setBaselineScaleFactor(1);
            setSelectedScaleFactor(1);
          }
          
          // Reset image load failure state
          setImageLoadFailed(false);
        } else {
          handleError('Error Loading Summary', 'Failed to fetch recipe from server.');
        }
      } else {
        // ✅ FIX: Show friendly error instead of throwing
        console.error('[Summary] Missing recipeId param');
        handleError('Missing Recipe ID', 'Please provide a valid recipe ID to view this recipe.');
      }
      setIsLoading(false);
    };

    // ✅ FIX: Call the async function and handle errors properly
    loadRecipe().catch((error) => {
      console.error('[Summary] Error in loadRecipe:', error);
      handleError('Error Loading Summary', error);
      setIsLoading(false);
    });
  }, [params.recipeData, params.appliedChanges, numericId, entryPoint]); // Removed fetchCanonicalById and handleError dependencies

  // Initialize title state when recipe is loaded
  useEffect(() => {
    if (recipe) {
      const initialTitle = recipe.title || '';
      setTitle(initialTitle);
      originalTitleRef.current = initialTitle;
      console.log('[Summary] 🏷️ Title state initialized:', { initialTitle, recipeId: recipe.id });
    }
  }, [recipe]);

  // Add layout debugging
  const onHeaderLayout = (event: any) => {
    const { height, y } = event.nativeEvent.layout;
    console.log('[Summary] 📐 Header layout:', { height, y });
  };

  const onScrollViewLayout = (event: any) => {
    const { height, y } = event.nativeEvent.layout;
    console.log('[Summary] 📐 ScrollView layout:', { height, y });
  };

  // Folder picker handlers for title editing (will be defined after API helpers)
  const handleFolderPickerClose = useCallback(() => {
    setIsFolderPickerVisible(false);
    setPendingTitleSave(null);
    setIsSavingTitle(false);
    setIsEditingTitle(false);
  }, []);

  // API helper functions for title editing
  const patchRecipeTitle = useCallback(async (recipeId: number, newTitle: string) => {
    console.log('[Summary] 📡 PATCH request details:', {
      recipeId,
      newTitle,
      endpoint: `/api/recipes/${recipeId}`,
      hasAuthToken: !!session?.access_token,
    });

    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      throw new Error('Backend API URL is not configured.');
    }

    const requestBody = { patch: { title: newTitle } };
    console.log('[Summary] 📤 Request body:', requestBody);

    const response = await fetch(`${backendUrl}/api/recipes/${recipeId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Summary] 📥 PATCH response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        console.error('[Summary] Failed to parse error response:', parseError);
        throw new Error(`Failed to update title (Status: ${response.status})`);
      }
      console.error('[Summary] ❌ PATCH error response:', errorData);
      throw new Error(errorData.error || `Failed to update title (Status: ${response.status})`);
    }

    const responseData = await response.json();
    console.log('[Summary] ✅ PATCH success response:', {
      hasData: !!responseData,
      responseKeys: Object.keys(responseData || {}),
      updatedTitle: responseData?.recipe?.title || responseData?.title,
    });
    return responseData;
  }, [session?.access_token]);

  const getSavedRecipes = useCallback(async (userId: string, baseRecipeId: number) => {
    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      throw new Error('Backend API URL is not configured.');
    }

    const response = await fetch(`${backendUrl}/api/saved/recipes?userId=${userId}&baseRecipeId=${baseRecipeId}`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get saved recipes (Status: ${response.status})`);
    }

    return await response.json();
  }, [session?.access_token]);

  const saveModifiedRecipe = useCallback(async (data: {
    originalRecipeId: number;
    modifiedRecipeData: any;
    userId: string;
    appliedChanges?: any;
    folderId?: number;
    saved_id?: string;
  }) => {
    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      throw new Error('Backend API URL is not configured.');
    }

    const response = await fetch(`${backendUrl}/api/recipes/save-modified`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to save modified recipe (Status: ${response.status})`);
    }

    return await response.json();
  }, [session?.access_token]);



  // Helper function to get current applied changes
  const getCurrentAppliedChanges = useCallback(() => {
    return {
      ingredientChanges: [...persistedChanges, ...currentUnsavedChanges],
      scalingFactor: selectedScaleFactor,
    };
  }, [persistedChanges, currentUnsavedChanges, selectedScaleFactor]);

  // Helper functions for recipe updates
  const applyRecipeUpdate = useCallback((patchResponse: any) => {
    // PATCH response has same structure as save-modified: { recipe: { id, is_user_modified, parent_recipe_id, recipe_data } }
    const patchMetadata = patchResponse.recipe || patchResponse;
    const patchRecipeData = patchMetadata.recipe_data || patchMetadata;
    
    const mergedRecipe = {
      ...patchRecipeData,
      id: patchMetadata.id,
      is_user_modified: patchMetadata.is_user_modified,
      parent_recipe_id: patchMetadata.parent_recipe_id,
      source_type: 'user_modified',
    };
    
    console.log('[Summary] 🔄 Applying recipe update:', {
      recipeId: mergedRecipe.id,
      title: mergedRecipe.title,
      hasImage: !!mergedRecipe.image,
      isUserModified: mergedRecipe.is_user_modified,
    });
    
    setRecipe(mergedRecipe);
    // Update cooking context if available
    if (cookingContext.updateRecipe && mergedRecipe.id) {
      cookingContext.updateRecipe(mergedRecipe.id.toString(), mergedRecipe);
    }
  }, [cookingContext]);

  const replaceSummaryRecipeWith = useCallback((forkResponse: any) => {
    // The server returns { recipe: { id, is_user_modified, parent_recipe_id, recipe_data } }
    // We need to merge the metadata with the recipe_data
    const forkMetadata = forkResponse.recipe || forkResponse;
    const forkRecipeData = forkMetadata.recipe_data || forkMetadata;
    
    const mergedRecipe = {
      ...forkRecipeData,
      id: forkMetadata.id,
      is_user_modified: forkMetadata.is_user_modified,
      parent_recipe_id: forkMetadata.parent_recipe_id,
      source_type: 'user_modified',
    };
    
    console.log('[Summary] 🔀 Replacing recipe with fork:', {
      forkId: mergedRecipe.id,
      title: mergedRecipe.title,
      hasImage: !!mergedRecipe.image,
      isUserModified: mergedRecipe.is_user_modified,
    });
    
    setRecipe(mergedRecipe);
    // Update cooking context if available
    if (cookingContext.updateRecipe && mergedRecipe.id) {
      cookingContext.updateRecipe(mergedRecipe.id.toString(), mergedRecipe);
    }
  }, [cookingContext]);

  // Folder picker handler for title editing (defined after API helpers)
  const handleFolderSelected = useCallback(async (selectedFolderId: number) => {
    if (!pendingTitleSave) {
      console.error('[Summary] No pending title save data');
      return;
    }

    const { cleanTitle, recipeId, userId } = pendingTitleSave;

    try {
      console.log('[Summary] 📁 Creating fork with folder selection:', {
        recipeId,
        cleanTitle,
        selectedFolderId,
      });

      const forkResponse = await saveModifiedRecipe({
        originalRecipeId: recipeId,
        modifiedRecipeData: { ...recipe, title: cleanTitle },
        userId,
        appliedChanges: getCurrentAppliedChanges(),
        folderId: selectedFolderId,
      });

      replaceSummaryRecipeWith(forkResponse);
      originalTitleRef.current = cleanTitle;
      showSuccess('Title saved', 'Recipe saved to folder with new title!');
      console.log('[Summary] ✅ Fork created and saved to folder:', { selectedFolderId });

    } catch (error: any) {
      console.error('[Summary] ❌ Failed to save fork to folder:', error);
      handleError('Could not save title', error.message || error);
    } finally {
      setIsFolderPickerVisible(false);
      setPendingTitleSave(null);
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  }, [pendingTitleSave, recipe, saveModifiedRecipe, getCurrentAppliedChanges, replaceSummaryRecipeWith, showSuccess, handleError]);

  // Main title save handler
  const handleSaveTitle = useCallback(async () => {
    const cleanTitle = title.trim();
    const originalTitle = (originalTitleRef.current || '').trim();
    const userId = session?.user?.id;
    const recipeId = recipe?.id;
    const isFork = (recipe as any)?.is_user_modified || recipe?.source_type === 'user_modified' || !!recipe?.parent_recipe_id;
    
    // For entryPoint 'new' or 'library', always treat as original (needs fork+save) even if technically a fork,
    // because the user hasn't saved it anywhere yet
    const shouldTreatAsOriginal = (entryPoint === 'new' || entryPoint === 'library') || !isFork;
    const parentRecipeId = recipe?.parent_recipe_id;

    console.log('[Summary] 🏷️ Title save attempt:', {
      cleanTitle,
      originalTitle,
      recipeId,
      userId: userId ? 'present' : 'missing',
      hasChanged: cleanTitle !== originalTitle,
      isFork,
      shouldTreatAsOriginal,
      entryPoint,
      parentRecipeId,
      recipeSourceType: recipe?.source_type,
    });
    
    if (!cleanTitle || cleanTitle === originalTitle) {
      console.log('[Summary] Title unchanged, skipping save');
      setIsEditingTitle(false);
      return;
    }

    if (!recipe || !session?.user?.id) {
      console.error('[Summary] Missing recipe or user data for title save');
      return;
    }

    // Prevent double execution
    if (isSavingTitle) {
      console.log('[Summary] Title save already in progress, skipping');
      return;
    }

    // Use the variables declared above

    if (!recipeId) {
      console.error('[Summary] Missing recipe ID for title save');
      return;
    }

    console.log('[Summary] Starting title save:', { recipeId, cleanTitle, isFork });
    setIsSavingTitle(true);

    try {
      if (!shouldTreatAsOriginal) {
        // PATCH in place for saved user forks (entryPoint 'saved' only)
        console.log('[Summary] 🔀 PATCH title on saved fork:', { 
          recipeId, 
          cleanTitle,
          currentTitle: recipe.title,
          isUserModified: (recipe as any).is_user_modified,
          sourceType: recipe.source_type,
          parentRecipeId: recipe.parent_recipe_id,
        });
        const patchResponse = await patchRecipeTitle(recipeId, cleanTitle);
        const updatedRecipe = patchResponse.recipe || patchResponse;
        
        console.log('[Summary] 📥 PATCH response:', {
          hasRecipe: !!updatedRecipe,
          updatedTitle: updatedRecipe?.title,
          updatedId: updatedRecipe?.id,
        });
        
        applyRecipeUpdate(updatedRecipe);
        originalTitleRef.current = cleanTitle;
        showSuccess('Title saved', 'Recipe title updated successfully');
        console.log('[Summary] ✅ Fork title updated successfully');
        return;
      }

      // Original recipe OR entryPoint 'new'/'library' - check if it's already saved
      console.log('[Summary] Title edited on original; checking saved state', { recipeId, userId });
      if (!userId) {
        throw new Error('User ID is required for title save');
      }
      const savedResponse = await getSavedRecipes(userId, recipeId);
      const savedRecipes = Array.isArray(savedResponse.recipes) ? savedResponse.recipes : [];
      const hasSaved = savedRecipes.length > 0;

      if (!hasSaved) {
        // Original not saved → fork and maybe prompt for folder
        console.log('[Summary] Original not saved; forking with new title');
        
        if (!userId) {
          throw new Error('User ID is required for fork creation');
        }
        
        const forkData = {
          originalRecipeId: recipeId,
          modifiedRecipeData: { ...recipe, title: cleanTitle },
          userId,
          appliedChanges: getCurrentAppliedChanges(),
          // Include folderId if we know the folder context from params
          ...(folderId && { folderId: Number(folderId) }),
        };

        // If no folder context, show folder picker
        if (!folderId) {
          console.log('[Summary] 📁 No folder context - showing folder picker');
          setPendingTitleSave({ cleanTitle, recipeId, userId });
          setIsFolderPickerVisible(true);
          return; // Don't reset isSavingTitle yet - will be handled by folder picker
        }

        // Has folder context - save directly
        const forkResponse = await saveModifiedRecipe(forkData);
        replaceSummaryRecipeWith(forkResponse);
        originalTitleRef.current = cleanTitle;
        showSuccess('Title saved', 'Recipe forked with new title');
        console.log('[Summary] ✅ Original forked with new title and saved to folder');
        return;
      }

      // Already saved → fork with saved_id to automatically retarget the saved row
      console.log('[Summary] Original saved; forking with saved_id to retarget saved row');
      const savedRow = savedRecipes[0];
      
      if (!userId) {
        throw new Error('User ID is required for fork creation');
      }
      
      const forkResponse = await saveModifiedRecipe({
        originalRecipeId: recipeId,
        modifiedRecipeData: { ...recipe, title: cleanTitle },
        userId,
        appliedChanges: getCurrentAppliedChanges(),
        saved_id: savedRow.id, // This tells the backend to update the existing saved row
      });

      replaceSummaryRecipeWith(forkResponse);
      originalTitleRef.current = cleanTitle;
      showSuccess('Title saved', 'Recipe updated with new title');
      console.log('[Summary] ✅ Original forked and saved row retargeted:', { 
        savedRowId: savedRow.id 
      });

    } catch (error: any) {
      console.error('[Summary] ❌ Title save failed:', {
        error: error.message || error,
        recipeId,
        isFork,
        cleanTitle,
        errorStack: error.stack,
      });
      handleError('Could not save title', error.message || error);
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  }, [
    title, 
    recipe, 
    session?.user?.id, 
    folderId, 
    patchRecipeTitle, 
    getSavedRecipes, 
    saveModifiedRecipe, 
    getCurrentAppliedChanges, 
    applyRecipeUpdate, 
    replaceSummaryRecipeWith, 
    showSuccess, 
    handleError
  ]);

  // Cancel title editing and revert to original title
  const handleCancelTitleEdit = useCallback(() => {
    if (!isSavingTitle) {
      setTitle(originalTitleRef.current || 'Recipe');
      setIsEditingTitle(false);
    }
  }, [isSavingTitle]);

  // Update hasModifications when scaling factor or applied changes change
  useEffect(() => {
    // Calculate hasModifications for both mise and saved entrypoints
    const hasScaleChanges = selectedScaleFactor !== baselineScaleFactor;
    const hasIngredientChanges = currentUnsavedChanges.length > 0 || 
      persistedChanges.length !== baselineAppliedChanges.length || 
      !persistedChanges.every((change, index) => {
        const baselineChange = baselineAppliedChanges[index];
        return baselineChange && 
          change.from === baselineChange.from && 
          JSON.stringify(change.to) === JSON.stringify(baselineChange.to);
      });
    
    const newHasModifications = hasScaleChanges || hasIngredientChanges;
    console.log('[DEBUG] hasModifications calculation (baseline comparison):', {
      entryPoint,
      selectedScaleFactor,
      baselineScaleFactor,
      hasScaleChanges,
      currentUnsavedChangesCount: currentUnsavedChanges.length,
      persistedChangesCount: persistedChanges.length,
      baselineAppliedChangesCount: baselineAppliedChanges.length,
      hasIngredientChanges,
      newHasModifications,
    });
    
    setHasModifications(newHasModifications);
  }, [selectedScaleFactor, currentUnsavedChanges, persistedChanges, entryPoint, baselineScaleFactor, baselineAppliedChanges]);

  // Reset isAlreadyInMise when user makes modifications that would change the recipe
  useEffect(() => {
    if (isAlreadyInMise) {
      setIsAlreadyInMise(false);
    }
  }, [selectedScaleFactor, currentUnsavedChanges, persistedChanges]); // Reset when scaling or ingredient changes occur

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
      persistedChanges,
      currentUnsavedChanges,
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
      currentUnsavedChanges: currentUnsavedChanges,
    });

    InteractionManager.runAfterInteractions(() => {
      if (substitution.name === 'Remove ingredient') {
        const currentRemovals = [...persistedChanges, ...currentUnsavedChanges].filter((c) => !c.to).length;
        console.log('[DEBUG] Removal limit check:', {
          currentRemovals,
          limit: 2,
          willProceed: currentRemovals < 2,
        });
        if (currentRemovals >= 2) {
          handleError('Limit Reached', 'You can only remove up to 2 ingredients.');
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

      setCurrentUnsavedChanges((prev) => {
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
        const newUnsavedChanges = [...prev, newChange];
        console.log('[DEBUG] Added new substitution/removal:', {
          isRemoval,
          ingredientName: originalNameForSub,
          previousChanges: prev,
          newChange,
          allChanges: newUnsavedChanges,
          previousCount: prev.length,
          newCount: newUnsavedChanges.length,
        });
        return newUnsavedChanges;
      });
    });
  };

  const undoIngredientRemoval = React.useCallback(
    (fullName: string) => {
      const { baseName: originalName } = parseRecipeDisplayName(fullName);
      setCurrentUnsavedChanges((prev) => prev.filter((change) => change.from !== originalName));
      if (lastRemoved?.from === originalName) setLastRemoved(null);
    },
    [lastRemoved],
  );

  const undoSubstitution = React.useCallback((originalName: string) => {
    setCurrentUnsavedChanges((prev) => prev.filter((change) => change.from !== originalName));
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

  const navigateToMise = React.useCallback(async () => {
    // All cooking now goes through mise - no more steps routing

    // Regular flow for new/saved recipes
    const removalCount = [...persistedChanges, ...currentUnsavedChanges].filter((c) => !c.to).length;
    if (removalCount > 2) {
      handleError('Limit Reached', 'You can only remove up to 2 ingredients per recipe.');
      return;
    }

    if (!recipe || !scaledIngredients) {
      console.error('Cannot navigate, essential data is missing.');
      return;
    }

    let finalInstructions = recipe.instructions || [];
    let newTitle: string | null = null; // Capture new title from LLM if suggested
    const needsScaling = selectedScaleFactor !== 1;
    const needsSubstitution = currentUnsavedChanges.length > 0;

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
            substitutions: currentUnsavedChanges.map((change) => ({
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
        handleError('Update Failed', modificationError);
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

    // Combine all changes for saving to database
    const allChangesToSave = [...persistedChanges, ...currentUnsavedChanges];
    const appliedChangesData = {
      ingredientChanges: allChangesToSave.map((change) => ({
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
      originalAppliedChanges: allChangesToSave.map(change => ({
        from: change.from,
        to: change.to ? {
          name: change.to.name,
          amount: change.to.amount,
          unit: change.to.unit,
          preparation: change.to.preparation,
        } : null,
      })),
      savedAppliedChangesData: appliedChangesData,
      dataPreserved: allChangesToSave.map(change => ({
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
      handleError('Authentication Required', 'You need an account to prepare your mise en place.', undefined, {
        onButtonPress: () => router.push('/login')
      });
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
          handleError('Already in Mise', result.message || 'This recipe with these modifications is already in your mise en place.', undefined, {
            onButtonPress: () => router.push('/tabs/mise')
          });
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
        modificationsCount: allChangesToSave.length,
        scalingFactor: selectedScaleFactor,
      });
      
      // Navigate directly to mise tab
      router.replace('/tabs/mise' as any);

    } catch (saveError: any) {
      handleError('Save Failed', saveError);
      return; // Stop execution on failure
    }
  }, [recipe, scaledIngredients, scaledIngredientGroups, persistedChanges, currentUnsavedChanges, router, showError, selectedScaleFactor, session, entryPoint, miseRecipeId]);

  const handleGoToSteps = () => InteractionManager.runAfterInteractions(navigateToMise);

  // Removed handleGoToRecipeSteps - no longer needed

  const handleGoToMise = () => {
    router.replace('/tabs/mise' as any);
  };

  const handleGoHome = () => {
    router.replace('/tabs' as any);
  };

  const handleOpenVariations = () => {
    try {
      // Check if there are unsaved modifications and warn the user
      if (hasModifications) {
        showError(
          'Unsaved Changes',
          'You have unsaved changes that won\'t be applied to the remix. Save your recipe first if you want these changes included.'
        );
      }

      setIsVariationsModalVisible(true);
    } catch (error) {
      console.error('Error opening variations modal:', error);
      handleError('Modal Error', 'Failed to open variations modal. Please try again.');
    }
  };

  const handleCloseVariations = () => {
    try {
      setIsVariationsModalVisible(false);
    } catch (error) {
      console.error('Error closing variations modal:', error);
      // Try to force close by setting to false directly
      setIsVariationsModalVisible(false);
    }
  };

  const handleVariationSelected = async (variationType: VariationType) => {
    console.log('Starting variation selection for:', variationType);

    // Close modal immediately and navigate to loading screen
    setIsVariationsModalVisible(false);

    // Navigate to loading screen
    try {
      router.push({
        pathname: '/loading',
        params: {
          type: 'remix',
          variationType: variationType,
          recipeId: recipe?.id?.toString(),
        }
      });
    } catch (navError) {
      console.error('Navigation error to loading screen:', navError);
      handleError('Navigation Error', 'Failed to start remix process. Please try again.');
    }

  };

  const handleSaveToFolder = async (folderId: number) => {
  if (!recipe?.id || !session?.user) {
      handleError('Authentication Required', 'You need an account to save recipes.', undefined, {
        onButtonPress: () => router.push('/login')
      });
      return;
    }

    const needsSubstitution = currentUnsavedChanges.length > 0;
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
            substitutions: currentUnsavedChanges.map((change) => ({
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

        // Combine all changes for saving
        const allChangesToSaveForFolder = [...persistedChanges, ...currentUnsavedChanges];
        const appliedChangesData = {
          ingredientChanges: allChangesToSaveForFolder.map((change) => ({
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
          originalAppliedChanges: allChangesToSaveForFolder.map(change => ({
            from: change.from,
            to: change.to ? {
              name: change.to.name,
              amount: change.to.amount,
              unit: change.to.unit,
              preparation: change.to.preparation,
            } : null,
          })),
          savedAppliedChangesData: appliedChangesData,
          dataPreserved: allChangesToSaveForFolder.map(change => ({
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
        // NEW/EXPLORE ENTRYPOINT: Always fork when saving modifications (never patch)
        console.log('[DEBUG] 🔧 New/Explore entrypoint - always creating fork for modified recipe:', recipe?.id);
        
        // Always create fork for new/explore entrypoint
        if (false) {
          // UPDATE THE EXISTING FORK
          console.log('[DEBUG] 🔧 Patching existing fork:', recipe?.id, 'parent_recipe_id:', recipe?.parent_recipe_id);
          
          // Convert finalInstructions (string[]) to InstructionStep[] format for PATCH
          const { normalizeInstructionsToSteps } = require('@/utils/recipeUtils');
          const normalizedInstructions = normalizeInstructionsToSteps(finalInstructions);

          const patchResponse = await fetch(`${backendUrl}/api/recipes/${recipe?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patch: {
                title: newTitle || recipe?.title,
                recipeYield: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
                instructions: normalizedInstructions,
                ingredientGroups: scaledIngredientGroups,
              },
            }),
          });

          if (!patchResponse.ok) {
            const patchResult = await patchResponse.json();
            throw new Error(patchResult.error || 'Failed to update recipe');
          }

          console.log('[DEBUG] ✅ Successfully patched existing fork');
          
          // Track recipe updated event
          console.log('[POSTHOG] Tracking event: recipe_updated', { 
            recipeId: recipe?.id?.toString(), 
            inputType: entryPoint 
          });
          await track('recipe_updated', { 
            recipeId: recipe?.id?.toString(), 
            inputType: entryPoint 
          });

        } else {
          // FIRST EDIT → CREATE A FORK (existing flow)
          console.log('[DEBUG] 🔧 Creating new fork from original recipe:', recipe?.id);
          
          const saveResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalRecipeId: recipe?.id,
              userId: session.user.id,
              modifiedRecipeData,
              appliedChanges: appliedChangesData,
              folderId: folderId, // Use the folder ID passed from the folder picker
            }),
          });

          console.log('[DEBUG] Save modified API call with folderId:', {
            folderId: folderId,
            fromFolderPicker: true,
          });

          const saveResult = await saveResponse.json();
          if (!saveResponse.ok) throw new Error(saveResult.error || 'Failed to save modified recipe');

          console.log('[DEBUG] ✅ Successfully created new fork');
          
          // Track recipe saved event
          console.log('[POSTHOG] Tracking event: recipe_saved', { 
            recipeId: recipe.id.toString(), 
            inputType: entryPoint 
          });
          await track('recipe_saved', { 
            recipeId: recipe.id.toString(), 
            inputType: entryPoint 
          });

          // CRITICAL: Navigate to the fork so subsequent edits hit PATCH path automatically
          // This prevents the "keep forking" problem by ensuring the screen shows the forked recipe
          if (saveResult.newRecipeId) {
            console.log('[DEBUG] 🔄 Navigating to fork to enable PATCH path:', saveResult.newRecipeId);
            // Navigate to the fork with isModified=true so future edits use PATCH
            router.replace({
              pathname: '/recipe/summary',
              params: {
                recipeData: JSON.stringify({
                  ...modifiedRecipeData,
                  id: saveResult.newRecipeId,
                  parent_recipe_id: recipe.id, // Mark as fork
                  source_type: 'user_modified',
                }),
                entryPoint: 'saved',
                from: '/saved',
                folderId: folderId, // Use the folder ID from folder picker
                isModified: 'true',
              },
            });
            return; // Exit early since we're navigating
          }
        }

        // Navigate to the specific folder that the recipe was saved to
        // For forked recipes, this creates a new saved recipe. For patched recipes, the existing saved recipe is updated.
        router.replace(`/saved/folder-detail?folderId=${folderId}` as any);

      } catch (error: any) {
        setIsSavingForLater(false);
        console.error('Error saving modified recipe:', error);
        handleError('Save Failed', error);
      }
    } else {
      // No modifications, save original recipe (instant - no loading state needed)
      try {
        const { saveRecipe } = require('@/lib/savedRecipes');
        const result = await saveRecipe(recipe.id, folderId);
        if (result.success) {
          // Track recipe saved event
          console.log('[POSTHOG] Tracking event: recipe_saved', { 
            recipeId: recipe.id.toString(), 
            inputType: entryPoint 
          });
          await track('recipe_saved', { 
            recipeId: recipe.id.toString(), 
            inputType: entryPoint 
          });
          
          // Navigate to the specific folder that the recipe was saved to
          router.replace(`/saved/folder-detail?folderId=${folderId}` as any);
        } else if (result.alreadySaved) {
          handleError('Already Saved', 'This recipe is already saved. Make modifications if you want to save a different variation.');
        } else {
      handleError('Save Failed', "We couldn't save your recipe. Please try again.");
        }
      } catch (error) {
        console.error('Error saving recipe:', error);
        handleError('Save Failed', error);
      }
    }
  };

  const handleRemoveFromSaved = async () => {
    if (!recipe?.id || !session?.user) {
      handleError('Authentication Required', 'You need an account to manage saved recipes.', undefined, {
        onButtonPress: () => router.push('/login')
      });
      return;
    }

    try {
      const { unsaveRecipe } = require('@/lib/savedRecipes');
      const success = await unsaveRecipe(recipe.id);
      if (success) {
        router.replace('/tabs/library' as any);
      } else {
        handleError('Remove Failed', "We couldn't remove the recipe. Please try again.");
      }
    } catch (error) {
      console.error('Error removing recipe from saved:', error);
      handleError('Remove Failed', error);
    }
  };

  const handleCookNow = async () => {
    console.log('[Summary] Cook now button pressed');
    
    // Cook now available from all entry points now that we use unified mise flow
    
    if (!recipe || !scaledIngredients) {
      console.error('[Summary] Cannot cook now, essential data is missing.');
      return;
    }

    const needsScaling = selectedScaleFactor !== 1;
    const needsSubstitution = currentUnsavedChanges.length > 0;
    const hasModifications = needsScaling || needsSubstitution;

    console.log('[Summary] Cook now modifications check:', {
      needsScaling,
      needsSubstitution,
      hasModifications,
      scaleFactor: selectedScaleFactor,
      changesCount: currentUnsavedChanges.length,
      recipeId: getRecipeId(),
      recipeTitle: recipe?.title,
      hasRecipe: !!recipe,
      hasScaledIngredients: !!scaledIngredients,
    });

    try {
      let finalInstructions = recipe.instructions || [];
      let newTitle: string | null = null;

      if (hasModifications) {
        console.log('[Summary] Modifications detected, calling modify-instructions endpoint');
        
        // Check removal limit
        const removalCount = [...persistedChanges, ...currentUnsavedChanges].filter((c) => !c.to).length;
        if (removalCount > 2) {
          handleError('Limit Reached', 'You can only remove up to 2 ingredients per recipe.');
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
            substitutions: currentUnsavedChanges.map((change) => ({
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

      // Filter out removed ingredients before sending to mise
      const filteredIngredientGroups = scaledIngredientGroups.map(group => ({
        ...group,
        ingredients: group.ingredients?.filter(ingredient => {
          // Skip ingredients marked as removed
          if (ingredient.name.includes('(removed)')) return false;
          
          // Skip ingredients with null/undefined amounts
          if (ingredient.amount === null || ingredient.amount === undefined) return false;
          
          // Skip ingredients with zero amounts (handle both string and number)
          if (typeof ingredient.amount === 'number' && ingredient.amount === 0) return false;
          if (typeof ingredient.amount === 'string' && ingredient.amount === '0') return false;
          
          return true;
        }) || []
      }));

      // Create the recipe for mise and steps
      const preparedRecipeData = {
        ...recipe,
        title: newTitle || recipe.title,
        recipeYield: getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
        instructions: finalInstructions,
        ingredientGroups: filteredIngredientGroups,
      };

      // Prepare applied changes for mise
      const appliedChanges = {
        ingredientChanges: currentUnsavedChanges.map((change) => ({
          from: change.from,
          to: change.to ? {
            name: change.to.name,
            amount: change.to.amount,
            unit: change.to.unit,
          } : null,
        })),
        scalingFactor: selectedScaleFactor,
      };

      console.log('[Summary] 🚀 Adding recipe to mise before cooking:', {
        title: preparedRecipeData.title,
        hasModifications,
        instructionsCount: finalInstructions.length,
        scalingFactor: selectedScaleFactor,
        changesCount: currentUnsavedChanges.length,
      });

      // Add recipe to mise first
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('Backend API URL is not configured.');
      }

      const miseResponse = await fetch(`${backendUrl}/api/mise/save-recipe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session?.user?.id,
          originalRecipeId: getRecipeId(),
          preparedRecipeData,
          appliedChanges,
          finalYield: preparedRecipeData.recipeYield,
          titleOverride: newTitle || params.titleOverride || null,
        }),
      });

      const miseResult = await miseResponse.json();
      if (!miseResponse.ok) {
        throw new Error(miseResult.error || miseResult.message || `Failed to add to mise (Status: ${miseResponse.status})`);
      }

      const miseRecipeId = miseResult.miseRecipe?.id;
      console.log('[Summary] ✅ Successfully added to mise:', {
        miseRecipeId,
        recipeTitle: preparedRecipeData.title,
      });

      // Navigate to mise tab to show the recipe was added
      showSuccess('Added to Prep', 'Recipe ready for cooking!', 2000);
      router.push('/tabs/mise');

    } catch (error: any) {
      console.error('[Summary] Error in cook now:', error);
      handleError('Cook Now Failed', error);
    }
  };

  const handleSaveModifications = async () => {
    if (entryPoint !== 'mise' || !miseRecipeId || !recipe) {
      console.error('[Summary] handleSaveModifications: Invalid entry point or missing data');
      return;
    }

    if (!session?.user?.id) {
      handleError('Authentication Required', 'You must be logged in to save modifications.', undefined, {
        onButtonPress: () => router.push('/login')
      });
      return;
    }

    try {
      // Check if we have modifications that need LLM processing
      const needsSubstitution = currentUnsavedChanges.length > 0;
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
            substitutions: currentUnsavedChanges.map((change) => ({
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
          substitutionsCount: currentUnsavedChanges.length,
        });
      } else {
        console.log('[Summary] No modifications requiring LLM processing');
      }

      // Combine all changes for saving modifications
      const allChangesToSaveForMise = [...persistedChanges, ...currentUnsavedChanges];
      const appliedChangesData = {
        ingredientChanges: allChangesToSaveForMise.map((change) => ({
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
        appliedChangesCount: allChangesToSaveForMise.length,
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
        modificationsCount: allChangesToSaveForMise.length,
        scalingFactor: selectedScaleFactor,
      });
      
      // Navigate directly to mise tab (consistent with other entrypoints)
      router.replace('/tabs/mise' as any);

    } catch (error: any) {
      console.error('[Summary] Failed to save modifications:', error);
      handleError('Save Failed', error);
    } finally {
      setIsSavingModifications(false);
    }
  };

  // Handle saving changes on saved recipes (single source of truth architecture)
  const handleSaveChanges = async () => {
    if (!recipe || !session?.user) {
      handleError('Authentication Required', 'You need an account to save changes.');
      return;
    }

    if (!hasModifications) {
      console.log('[Summary] No modifications to save');
      return;
    }

    console.log('[DEBUG] handleSaveChanges called with:', {
      entryPoint,
      folderId: params.folderId,
      recipeId: recipe.id,
      hasModifications,
    });

    setIsSavingChanges(true);

    try {
      // Check if we have modifications that need LLM processing
      const needsSubstitution = currentUnsavedChanges.length > 0;
      const needsScaling = selectedScaleFactor !== 1;
      
      let finalInstructions = recipe.instructions || [];
      let newTitle: string | null = null;

      // Process modifications with LLM if needed
      if (needsSubstitution || needsScaling) {
        console.log('[Summary] Processing modifications with LLM before saving changes...');
        
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
            substitutions: currentUnsavedChanges.map((change) => ({
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

        console.log('[Summary] ✅ LLM processing completed for save changes');
      }

      // Create modified recipe data
      const modifiedRecipeData = {
        ...recipe,
        title: newTitle || recipe.title,
        recipeYield: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
        instructions: finalInstructions,
        ingredientGroups: scaledIngredientGroups,
      };

      // Combine all changes for saving
      const allChangesToSave = [...persistedChanges, ...currentUnsavedChanges];
      const appliedChangesData = {
        ingredientChanges: allChangesToSave.map((change) => ({
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

      const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
      
      if (entryPoint === 'saved') {
        // SAVED ENTRYPOINT: Use base_recipe_id from joined data to determine fork vs patch
        console.log('[DEBUG] 🔍 Saved entrypoint - determining fork vs patch based on base_recipe_id');
        
        // The recipe.id we have is the base_recipe_id from the joined data
        // Check if it's a fork by looking at is_user_modified or source_type
        const isUserModifiedRecipe = recipe.source_type === 'user_modified' || 
                                     recipe.parent_recipe_id ||
                                     (params.isModified === 'true');
        
        console.log('[DEBUG] 🔍 Saved recipe analysis:', {
          baseRecipeId: recipe.id,
          source_type: recipe.source_type,
          parent_recipe_id: recipe.parent_recipe_id,
          paramsIsModified: params.isModified,
          isUserModifiedRecipe,
          willUsePatch: isUserModifiedRecipe,
          willUseFork: !isUserModifiedRecipe,
        });
        
        if (isUserModifiedRecipe) {
          // PATCH the existing fork
          console.log('[DEBUG] 🔧 Patching existing fork (base_recipe_id):', recipe.id);
          
          // Convert finalInstructions (string[]) to InstructionStep[] format for PATCH
          const { normalizeInstructionsToSteps } = require('@/utils/recipeUtils');
          const normalizedInstructions = normalizeInstructionsToSteps(finalInstructions);
          
          const patchResponse = await fetch(`${backendUrl}/api/recipes/${recipe.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patch: {
                title: newTitle || recipe.title,
                recipeYield: getScaledYieldText(originalRecipe?.recipeYield || recipe?.recipeYield, selectedScaleFactor),
                instructions: normalizedInstructions,
                ingredientGroups: scaledIngredientGroups,
              },
            }),
          });

          if (!patchResponse.ok) {
            const patchResult = await patchResponse.json();
            throw new Error(patchResult.error || 'Failed to update recipe');
          }

          const patchData = await patchResponse.json();
          console.log('[DEBUG] ✅ Successfully patched existing fork');
          
          // ✅ FIX: Refresh local recipe state with server response
          const updatedRecipeFromServer = patchData.recipe.recipe_data;
          setRecipe(updatedRecipeFromServer);
          
          // ✅ FIX: Update cookingContext with the patched recipe
          if (cookingContext.updateRecipe && recipe.id) {
            cookingContext.updateRecipe(recipe.id.toString(), updatedRecipeFromServer);
          }
          
        } else {
          // CREATE A FORK and update the saved recipe pointer
          console.log('[DEBUG] 🔧 Creating fork from original (base_recipe_id):', recipe.id);
          
          // Find the existing saved recipe to get the saved_id
          const savedRecipeResponse = await fetch(`${backendUrl}/api/saved/recipes?userId=${session.user.id}&baseRecipeId=${recipe.id}`);
          if (!savedRecipeResponse.ok) {
            throw new Error('Failed to find saved recipe');
          }
          
          const savedRecipes = await savedRecipeResponse.json();
          const savedRecipe = savedRecipes.recipes?.find((r: any) => r.base_recipe_id === recipe.id);
          
          if (!savedRecipe) {
            throw new Error('Saved recipe not found - this should not happen for saved entrypoint');
          }
          
          console.log('[DEBUG] 🔧 Found saved recipe to update:', savedRecipe.id);
          
          // Create fork and update saved recipe pointer
          const forkResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalRecipeId: recipe.id,
              userId: session.user.id,
              modifiedRecipeData,
              appliedChanges: appliedChangesData,
              folderId: folderId, // Use the folder ID passed from the folder picker
              saved_id: savedRecipe.id, // Update existing saved recipe to point to new fork
            }),
          });

          if (!forkResponse.ok) {
            const forkResult = await forkResponse.json();
            throw new Error(forkResult.error || 'Failed to create fork');
          }

          const forkData = await forkResponse.json();
          console.log('[DEBUG] ✅ Successfully created fork and updated saved recipe pointer:', forkData.newRecipeId);
          
          // ✅ FIX: Refresh local recipe state with server response
          const newRecipeFromServer = forkData.recipe.recipe_data;
          setRecipe(newRecipeFromServer);
          
          // ✅ FIX: Update cookingContext with the new fork
          if (cookingContext.updateRecipe && recipe.id) {
            cookingContext.updateRecipe(recipe.id.toString(), newRecipeFromServer);
          }
          
          // ✅ FIX: Navigate to the new fork using router.replace with fork ID
          router.replace({
            pathname: '/recipe/summary',
            params: {
              recipeId: forkData.recipe.id.toString(), // Use the fork ID from server response
              entryPoint: 'saved',
              folderId: folderId,
              isModified: 'true',
            },
          });
        }
        
      } else {
        // NEW/EXPLORE ENTRYPOINT: Always fork when saving modifications
        console.log('[DEBUG] 🔧 New/Explore entrypoint - creating fork for modified recipe:', recipe.id);
        
        const forkResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalRecipeId: recipe.id,
            userId: session.user.id,
            modifiedRecipeData,
            appliedChanges: appliedChangesData,
            folderId: folderId, // Use the folder ID passed from the folder picker
            // No saved_id for new/explore - this creates a new saved recipe
          }),
        });

        if (!forkResponse.ok) {
          const forkResult = await forkResponse.json();
          throw new Error(forkResult.error || 'Failed to create fork');
        }

        const forkData = await forkResponse.json();
        console.log('[DEBUG] ✅ Successfully created fork for new/explore:', forkData.newRecipeId);
        
        // ✅ FIX: Refresh local recipe state with server response
        const newRecipeFromServer = forkData.recipe.recipe_data;
        setRecipe(newRecipeFromServer);
        
        // ✅ FIX: Update cookingContext with the new fork
        if (cookingContext.updateRecipe && recipe.id) {
          cookingContext.updateRecipe(recipe.id.toString(), newRecipeFromServer);
        }
        
        // ✅ FIX: Navigate to the new fork using router.replace with fork ID
        router.replace({
          pathname: '/recipe/summary',
          params: {
            recipeId: forkData.recipe.id.toString(), // Use the fork ID from server response
            entryPoint: 'saved', // Now it's saved
            folderId: folderId,
            isModified: 'true',
          },
        });
      }
      
      // Track recipe updated event
      if (recipe.id) {
        await track('recipe_updated', { 
          recipeId: recipe.id.toString(), 
          inputType: entryPoint 
        });
      }

      // ✅ FIX: Local state is now updated above with server response data
      // No need to manually construct updatedRecipeData here
      
      // Reset all baselines to 1× after successful save
      // Treat the newly saved data as the new 1× baseline to prevent double-scaling
      setUnscaledIngredientGroups(recipe?.ingredientGroups ? [...recipe.ingredientGroups] : []);
      setBaselineScaleFactor(1);
      setSelectedScaleFactor(1);
      
      // Reset modifications state after successful save
      setHasModifications(false);
      setCurrentUnsavedChanges([]);
      
      // Update persistedChanges and baseline applied changes
      const newPersistedChanges = [...persistedChanges, ...currentUnsavedChanges];
      setPersistedChanges(newPersistedChanges);
      setBaselineAppliedChanges(newPersistedChanges);
      
      console.log('[DEBUG] ✅ All baselines reset after save:', {
        unscaledGroupsCount: recipe?.ingredientGroups?.length || 0,
        baselineScaleFactor: 1,
        selectedScaleFactor: 1,
        baselineAppliedChangesScaling: 1,
      });
      
      // Show success message
      showSuccess(
        'Changes Saved!',
        'Your recipe modifications have been saved successfully.',
        3000 // Show for 3 seconds
      );
      
      console.log('[Summary] ✅ Successfully saved changes');

    } catch (error: any) {
      console.error('Error saving changes:', error);
      handleError('Save Failed', error);
    } finally {
      setIsSavingChanges(false);
    }
  };

  if (isLoading) {
    console.log('[Summary] ⏳ Showing loading screen');
    return (
      <View style={[styles.centeredStatusContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!recipe) {
    console.log('[Summary] ❌ No recipe data, showing error');
    return (
      <View style={[styles.centeredStatusContainer, { paddingTop: insets.top }]}>
      <InlineErrorBanner message="We couldn't load the recipe summary." showGoBackButton />
      </View>
    );
  }

  console.log('[Summary] 🎨 Rendering main UI with recipe:', {
    id: recipe.id,
    title: recipe.title,
    hasImage: !!recipe.image,
  });

  return (
    <PanGestureHandler onHandlerStateChange={onSwipeGesture}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Modals */}
      {substitutionModalVisible && selectedIngredientOriginalData && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="box-none">
          <IngredientSubstitutionModal
            visible={substitutionModalVisible}
            onClose={() => setSubstitutionModalVisible(false)}
            ingredientName={selectedIngredientOriginalData.name}
            substitutions={processedSubstitutionsForModal}
            onApply={onApplySubstitution}
          />
        </View>
      )}

      {/* Folder Picker Modal for title editing */}
      <FolderPickerModal
        visible={isFolderPickerVisible}
        onClose={handleFolderPickerClose}
        onSelectFolder={handleFolderSelected}
        isLoading={false}
      />
      
      {/* Custom Header with Editable Title */}
      <Pressable style={styles.customHeader} onLayout={onHeaderLayout} onPress={isEditingTitle ? handleCancelTitleEdit : undefined}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        {isEditingTitle ? (
          <TextInput
            style={[styles.headerTitle, styles.headerTitleInput]}
            value={title}
            onChangeText={setTitle}
            editable={!isSavingTitle}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handleSaveTitle}
            onBlur={() => {
              // Cancel editing on blur instead of auto-saving
              if (!isSavingTitle) {
                handleCancelTitleEdit();
              }
            }}
            autoFocus={true}
            multiline={false}
            numberOfLines={1}
          />
        ) : (
          <TouchableOpacity
            style={styles.headerTitleTouchable}
            onPress={() => setIsEditingTitle(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RecipeHeaderTitle title={title || 'Recipe'} />
          </TouchableOpacity>
        )}
        <View style={styles.headerRight}>
          {isEditingTitle && (
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleSaveTitle}
              disabled={isSavingTitle || title.trim() === originalTitleRef.current.trim()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isSavingTitle ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <MaterialCommunityIcons
                  name="check"
                  size={24}
                  color={
                    title.trim() === originalTitleRef.current.trim() 
                      ? COLORS.textMuted 
                      : COLORS.primary
                  }
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </Pressable>

      {/* Sharp divider to separate title from content */}
      <View style={styles.titleDivider} />

      <Pressable style={{ flex: 1 }} onPress={isEditingTitle ? handleCancelTitleEdit : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onLayout={onScrollViewLayout}
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
              appliedChanges={currentUnsavedChanges}
              persistedChanges={persistedChanges}
              openSubstitutionModal={openSubstitutionModal}
              undoIngredientRemoval={undoIngredientRemoval}
              undoSubstitution={undoSubstitution}
              showCheckboxes={false}
              isViewingSavedRecipe={isViewingSavedRecipe}
            />
          </View>
        </View>

        {/* Visit Source link inside ScrollView with proper spacing - only show for URL-based recipes or saved recipes */}
        {recipe?.sourceUrl && (params.inputType === 'url' || !params.inputType) && (
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
      </Pressable>

      {/* Title pop-up modal for long titles */}
      <Modal
        visible={isTitleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTitleModalVisible(false)}
      >
        <Pressable 
          style={[styles.titleModalOverlay, { paddingTop: insets.top + SPACING.pageHorizontal }]}
          onPress={() => setIsTitleModalVisible(false)}
        >
          <Pressable style={styles.titleModalContent}>
            <Text style={styles.titleModalText}>{cleanTitle || 'Recipe'}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Recipe Variations Modal */}
      <RecipeVariationsModal
        visible={isVariationsModalVisible}
        onClose={handleCloseVariations}
        onSelectVariation={handleVariationSelected}
      />

      <RecipeFooterButtons
        handleGoToSteps={handleGoToSteps}
        isRewriting={isRewriting}
        isScalingInstructions={isScalingInstructions}
        handleSaveToFolder={handleSaveToFolder}
        handleRemoveFromSaved={handleRemoveFromSaved}
        handleSaveModifications={handleSaveModifications}
        handleCookNow={handleCookNow}
        handleSaveChanges={handleSaveChanges}
        isSavingForLater={isSavingForLater}
        isSavingModifications={isSavingModifications}
        isSavingChanges={isSavingChanges}

        entryPoint={entryPoint}
        hasModifications={hasModifications}
        isAlreadyInMise={isAlreadyInMise}
        onOpenVariations={handleOpenVariations}
      />
      
    </View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.pageHorizontal, // Use paddingTop instead of marginTop for consistent spacing
    paddingBottom: SPACING.md,
    minHeight: 44 + SPACING.md,
  } as ViewStyle,
  backButton: {
    padding: SPACING.xs,
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  } as ViewStyle,
  headerTitle: {
    ...screenTitleText,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
  } as TextStyle,
  headerTitleInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
  } as TextStyle,
  headerTitleTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  } as ViewStyle,
  headerActionButton: {
    padding: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
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
            fontFamily: FONT.family.heading,
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
    fontFamily: FONT.family.bold,
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
    fontSize: FONT.size.caption,
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
    fontFamily: FONT.family.body,
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
    fontFamily: FONT.family.body,
    fontSize: FONT.size.body,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    lineHeight: FONT.lineHeight.tight,
  },
  shortDescriptionHeaderLeft: {
    fontFamily: FONT.family.body,
    fontSize: FONT.size.caption + 1,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xxs,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.xs, // Reduced for wider text area
    paddingHorizontal: SPACING.xs, // Reduced for wider text area
    lineHeight: FONT.lineHeight.tight,
  },
  metaInfoCondensed: {
    fontFamily: FONT.family.body,
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
    fontFamily: FONT.family.body,
    fontSize: FONT.size.caption,
    color: COLORS.textDark,
    textDecorationLine: 'underline',
    opacity: 0.5,
  },
  titleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  },
  titleModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    maxWidth: '90%',
  },
  titleModalText: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'center',
  },
});