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
import SaveButton from '@/components/SaveButton';
import ShareButton from '@/components/recipe/ShareButton';
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
  const params = useLocalSearchParams<{ recipeData?: string; from?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  const { session } = useAuth();

  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isAllergensExpanded, setIsAllergensExpanded] = useState(false);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isRecipeSizeExpanded, setIsRecipeSizeExpanded] = useState(true);
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(true);

  const [originalYieldValue, setOriginalYieldValue] = useState<number | null>(
    null,
  );
  const [selectedScaleFactor, setSelectedScaleFactor] = useState<number>(1.0);

  const [checkedIngredients, setCheckedIngredients] = useState<{
    [key: number]: boolean;
  }>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] =
    useState(false);
  const [selectedIngredient, setSelectedIngredient] =
    useState<StructuredIngredient | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isScalingInstructions, setIsScalingInstructions] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [selectedIngredientOriginalData, setSelectedIngredientOriginalData] =
    useState<StructuredIngredient | null>(null);
  const [processedSubstitutionsForModal, setProcessedSubstitutionsForModal] =
    useState<SubstitutionSuggestion[] | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{
    from: string;
    to: string | null;
  } | null>(null);

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

      return {
        ...group,
        ingredients: finalIngredients,
      };
    });
  }, [recipe, selectedScaleFactor, appliedChanges]);

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

  const handleExitPress = () => {
    const exitPath = params.from || '/';
    router.replace(exitPath as any);
  };

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
        setSelectedScaleFactor(1.0);
        setAppliedChanges([]);
        setCheckedIngredients({});
      } catch (e: any) {
        showError('Error Loading Summary', `Could not load recipe details: ${e.message}.`);
      }
    } else {
      showError('Error Loading Summary', 'Recipe data not provided.');
    }
    setIsLoading(false);
  }, [params.recipeData, showError]);

  const detectedAllergens = React.useMemo(() => {
    if (!recipe) return [];
    return extractAllergens(recipe.ingredientGroups);
  }, [recipe]);

  const handleScaleFactorChange = (factor: number) => setSelectedScaleFactor(factor);

  const toggleCheckIngredient = React.useCallback((index: number) => {
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

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

    // --- 3. Navigate to Steps Screen ---
    router.push({
      pathname: '/recipe/steps',
      params: {
        originalId: recipe.id?.toString() || '', // Pass the ID of the original recipe
        recipeData: JSON.stringify({
          // Pass the ORIGINAL recipe data with all metadata intact
          ...recipe,
          // Update only the scaled yield text for display
          recipeYield: getScaledYieldText(recipe.recipeYield, selectedScaleFactor),
        }),
        // Pass the edited instructions and ingredients for steps.tsx to apply
        editedInstructions: JSON.stringify(finalInstructions),
        editedIngredients: JSON.stringify(scaledIngredientGroups),
        newTitle: newTitle || 'null', // Pass newTitle from LLM, or 'null' string
        appliedChanges: JSON.stringify({
          ingredientChanges: appliedChanges.map((change) => ({
            from: change.from,
            to: change.to ? change.to.name : null, // Convert StructuredIngredient to string
          })),
          scalingFactor: selectedScaleFactor,
        }),
      },
    });
  }, [recipe, scaledIngredients, scaledIngredientGroups, appliedChanges, router, showError, selectedScaleFactor]);

  const handleGoToSteps = () => InteractionManager.runAfterInteractions(navigateToNextScreen);

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
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.actionsContainer}>
          {recipe.id && <SaveButton recipeId={recipe.id} />}
          <ShareButton />
        </View>

        <View style={styles.infoTable}>
          {recipe.description && (
            <View style={styles.infoRow}>
              <TouchableOpacity
                style={styles.infoRowTouchable}
                onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              >
                <Text style={styles.infoRowLabel}>Description</Text>
                <MaterialCommunityIcons
                  name={isDescriptionExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.textSubtle}
                />
              </TouchableOpacity>
              {isDescriptionExpanded && (
                <Text style={styles.infoRowContent}>{decode(recipe.description)}</Text>
              )}
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
              <TouchableOpacity
                style={styles.infoRowTouchable}
                onPress={() => setIsAllergensExpanded(!isAllergensExpanded)}
              >
                <Text style={styles.infoRowLabel}>Allergens</Text>
                <MaterialCommunityIcons
                  name={isAllergensExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.textSubtle}
                />
              </TouchableOpacity>
              {isAllergensExpanded && (
                <Text style={styles.infoRowContent}>
                  {detectedAllergens.join(', ')}
                </Text>
              )}
            </View>
          )}
          {recipe.sourceUrl && (
            <View style={styles.infoRow}>
              <TouchableOpacity
                style={styles.infoRowTouchable}
                onPress={() => setIsSourceExpanded(!isSourceExpanded)}
              >
                <Text style={styles.infoRowLabel}>Original Source</Text>
                <MaterialCommunityIcons
                  name={isSourceExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.textSubtle}
                />
              </TouchableOpacity>
              {isSourceExpanded && (
                <Text
                  style={[styles.infoRowContent, styles.link]}
                  onPress={() => Linking.openURL(recipe.sourceUrl!)}
                >
                  Visit Source ↗︎
                </Text>
              )}
            </View>
          )}
        </View>

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
          <IngredientList
            ingredientGroups={scaledIngredientGroups}
            selectedScaleFactor={selectedScaleFactor}
            appliedChanges={appliedChanges}
            checkedIngredients={checkedIngredients}
            toggleCheckIngredient={toggleCheckIngredient}
            openSubstitutionModal={openSubstitutionModal}
            undoIngredientRemoval={undoIngredientRemoval}
            undoSubstitution={undoSubstitution}
          />
        </CollapsibleSection>
      </ScrollView>

      <RecipeFooterButtons
        handleGoToSteps={handleGoToSteps}
        isRewriting={isRewriting}
        isScalingInstructions={isScalingInstructions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
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
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
});