import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform, Dimensions, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { decode } from 'he';
import { COLORS } from '@/constants/theme';
import { scaleIngredient, parseServingsValue, getScaledYieldText, parseAmountString, formatAmountNumber } from '@/utils/recipeUtils'; // Correct import path assuming utils is under root/src or similar alias
import { StructuredIngredient, CombinedParsedRecipe as ParsedRecipe } from '../../common/types';
import { coerceToStructuredIngredients } from '@/utils/ingredientHelpers'; 
import { useErrorModal } from '@/context/ErrorModalContext'; 
import InlineErrorBanner from '@/components/InlineErrorBanner'; 
import { titleText, sectionHeaderText, bodyText, captionStrongText, bodyStrongText, captionText } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { setHasUsedFreeRecipe } from '@/server/lib/freeUsageTracker';
import SaveButton from '@/components/SaveButton';

const ALLERGENS = [
  {
    key: 'dairy',
    match: [
      'milk', 'cheese', 'butter', 'cream', 'yogurt', 'feta',
      'parmesan', 'mozzarella', 'ricotta', 'custard', 'whey'
    ]
  },
  {
    key: 'nuts',
    match: [
      'almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'macadamia',
      'pistachio', 'brazil nut', 'nut butter', 'nut'
    ]
  },
  {
    key: 'peanuts',
    match: ['peanut', 'peanut butter']
  },
  {
    key: 'gluten',
    match: [
      'flour', 'wheat', 'bread', 'breadcrumbs', 'pasta', 'semolina',
      'barley', 'rye', 'spelt', 'farro', 'bulgur', 'couscous'
    ]
  },
  {
    key: 'soy',
    match: ['soy', 'soybean', 'tofu', 'tempeh', 'edamame', 'soy sauce']
  },
  {
    key: 'egg',
    match: ['egg', 'mayonnaise', 'mayo', 'aioli']
  },
  {
    key: 'shellfish',
    match: [
      'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel',
      'scallop', 'oyster', 'langoustine'
    ]
  },
  {
    key: 'fish',
    match: [
      'salmon', 'tuna', 'cod', 'trout', 'haddock', 'anchovy', 'sardine',
      'mackerel', 'halibut', 'bass', 'snapper'
    ]
  },
  {
    key: 'sesame',
    match: ['sesame', 'tahini']
  },
  {
    key: 'mustard',
    match: ['mustard', 'mustard seed']
  }
];

const extractAllergens = (ingredients: StructuredIngredient[] | string[] | null): string[] => {
    if (!ingredients) return [];

    const structuredIngredients = coerceToStructuredIngredients(ingredients);
    if (!structuredIngredients || structuredIngredients.length === 0) return [];

    const ingredientNames = structuredIngredients.map(i => i.name?.toLowerCase().trim().normalize('NFKC') ?? '');

    return ALLERGENS
        .filter(allergen =>
            ingredientNames.some(name =>
                allergen.match.some(term => name.includes(term))
            )
        )
        .map(allergen => allergen.key);
};

// --- Calculate Button Widths ---
const screenWidth = Dimensions.get('window').width;
const contentHorizontalPadding = 20;
const servingsContainerGap = 8;
const numButtons = 5;
const availableWidth = screenWidth - (contentHorizontalPadding * 2);
const buttonTotalGap = servingsContainerGap * (numButtons - 1);
const buttonWidth = (availableWidth - buttonTotalGap) / numButtons;

// --- Define Types (Matching Backend Output) ---


// Type for data passed to IngredientsScreen
type IngredientsNavParams = {
    id?: number;
    title: string | null;
    originalIngredients: StructuredIngredient[] | string[] | null;
    scaledIngredients: StructuredIngredient[] | null;
    instructions: string[] | null;
    substitutions_text: string | null;
    originalYieldDisplay: string | null;
    scaleFactor: number;
};
// --- End Types ---

export default function RecipeSummaryScreen() {
  const params = useLocalSearchParams<{ recipeData?: string; from?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal(); // Added hook usage
  const { session } = useAuth();
  
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // NEW state for original yield value and selected scale factor
  const [originalYieldValue, setOriginalYieldValue] = useState<number | null>(null);
  const [selectedScaleFactor, setSelectedScaleFactor] = useState<number>(1.0); // Default to 1x

  const handleExitPress = () => {
    // If 'from' exists, go there. Otherwise, default to the main input screen.
    const exitPath = params.from || '/'; 
    router.replace(exitPath as any);
  };

  useEffect(() => {
    console.log('[SummaryScreen] Mount');
    setIsLoading(true); // Start loading
    setRecipe(null); // Reset recipe on new data

    if (params.recipeData) {
      try {
        const parsed = JSON.parse(params.recipeData) as ParsedRecipe;
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) { // Added check for empty/invalid parsed object
          console.error("Parsed recipe data is empty or invalid on summary screen.");
          showError(
            "Error Loading Summary",
            "Recipe data is invalid. Please go back and try again."
          );
          setIsLoading(false);
          return;
        }

        setRecipe(parsed);
        if (!parsed.id) {
          console.warn('[SummaryScreen] Missing recipe.id, SaveButton will not be rendered.');
        }
        
        const yieldNum = parseServingsValue(parsed.recipeYield); 
        setOriginalYieldValue(yieldNum);
        setSelectedScaleFactor(1.0);

      } catch (e: any) {
        console.error("Failed to parse recipe data on summary screen:", e);
        showError(
          "Error Loading Summary",
          `Could not load recipe details: ${e.message}. Please go back and try again.`
        );
        setIsLoading(false); // Ensure loading is false on error
        return; // Prevent further processing
      }
    } else {
      showError(
        "Error Loading Summary",
        "Recipe data not provided. Please go back and try again."
      );
      setIsLoading(false); // Ensure loading is false on error
      return; // Prevent further processing
    }
    setIsLoading(false); // Finish loading successfully
  }, [params.recipeData, showError, router]); // Added showError and router

  const detectedAllergens = React.useMemo(() => {
    if (!recipe) return [];
    return extractAllergens(recipe.ingredients);
  }, [recipe]);

  const handleScaleFactorChange = (factor: number) => {
    setSelectedScaleFactor(factor);
  };

  // Clean the title to remove attribution text and "Recipe" suffix
  const cleanTitle = recipe?.title
    ?.replace(/\s*(?:[–-]\s*)?by\s+.*$/i, '') // Remove " - by Publisher"
    .replace(/\s+recipe\s*$/i, '') // Remove "Recipe" from the end
    .trim();

  const navigateToIngredients = () => {
    if (!recipe || !recipe.ingredients) return;

    if (!session) {
      if (__DEV__) {
        console.log('[FreeUsage] User is not logged in. Setting hasUsedFreeRecipe flag.');
      }
      setHasUsedFreeRecipe();
    }

    // Use the helper to coerce ingredients
    const structuredOriginals: StructuredIngredient[] = coerceToStructuredIngredients(recipe.ingredients);
    
    let scaledIngredients: StructuredIngredient[] | null = null;

    if (structuredOriginals.length > 0) {
        scaledIngredients = structuredOriginals.map(ingredient => 
            scaleIngredient(ingredient, selectedScaleFactor)
        );
    } else {
        console.warn("No valid structured ingredients to scale after coercion.");
        // Pass an empty array or null, depending on desired downstream handling
        scaledIngredients = []; 
    }
    
    const navParams: IngredientsNavParams = {
        id: recipe.id,
        title: cleanTitle || recipe.title,
        originalIngredients: structuredOriginals, // Pass the coerced originals
        scaledIngredients: scaledIngredients,
        instructions: recipe.instructions,
        substitutions_text: recipe.substitutions_text,
        originalYieldDisplay: recipe.recipeYield || null,
        scaleFactor: selectedScaleFactor
    };

    const recipeData = JSON.stringify(navParams);
    console.log('[SummaryScreen] Navigating with recipeData:', recipeData);

    router.push({
      pathname: '/recipe/ingredients',
      params: { 
        recipeData
      }
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
           <InlineErrorBanner 
                message="Could not load recipe summary. The data might be missing or corrupted."
                showGoBackButton={true}
            />
        </SafeAreaView>
      );
  }

  // Define scale factor options
  const scaleFactorOptions = [
    { label: 'Half', value: 0.5 },
    { label: 'Original', value: 1.0 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2.0 },
    { label: '4x', value: 4.0 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */} 
      <View style={styles.header}>
         <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
           <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
         </TouchableOpacity>
         <Image source={require('@/assets/images/meez_logo.png')} style={styles.headerLogo} />
         <TouchableOpacity style={styles.exitButton} onPress={handleExitPress}>
           <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
         </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.recipeInfoContainer}>
            {(recipe.image || recipe.thumbnailUrl) && (
                <Image
                    source={{ uri: (recipe.image || recipe.thumbnailUrl) as string }}
                    style={styles.recipeImage}
                    resizeMode="cover"
                />
            )}
            <View style={styles.recipeTextContainer}>
                {cleanTitle && (
                    <Text style={styles.pageTitle}>{cleanTitle}</Text>
                )}
            </View>
        </View>

        {recipe?.id && (
          <View style={{ marginBottom: 24 }}>
            <SaveButton recipeId={recipe.id} />
          </View>
        )}

        {/* --- Metadata Sections --- */}
        
        {/* Description */}
        {recipe.description && (() => {
          const fullDescription = decode(recipe.description);
          const sentences = fullDescription.split(/(?<=[.!?])\s+/);
          const firstSentence = sentences[0] || fullDescription;
          const canBeTruncated = sentences.length > 1 || (sentences.length === 1 && fullDescription.length > firstSentence.length);

          return (
            <>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionSubtext}>
                {isDescriptionExpanded ? fullDescription : firstSentence}
                {canBeTruncated && (
                  <Text style={styles.readMoreToggle} onPress={() => setIsDescriptionExpanded(prev => !prev)}>
                    {isDescriptionExpanded ? ' Read less' : ' Read more'}
                  </Text>
                )}
              </Text>
            </>
          );
        })()}

        {recipe.description && <View style={styles.divider} />}

        {/* Servings Selector */} 
        <Text style={styles.sectionTitle}>Adjust Recipe Size</Text>
        <Text style={styles.helperText}>
          {(() => {
            if (selectedScaleFactor === 1.0) {
              return recipe.recipeYield
                ? `This recipe makes ${recipe.recipeYield}. We make it easy to scale it up or down.`
                : `This recipe doesn't specify servings amount, but we can still scale amounts up or down if you'd like.`;
            }

            const direction = selectedScaleFactor < 1 ? 'down' : 'up';
            
            if (originalYieldValue && originalYieldValue > 0 && recipe.recipeYield) {
              const scaledYieldString = getScaledYieldText(recipe.recipeYield, selectedScaleFactor);
              return `Now scaled ${direction} by ${selectedScaleFactor}x (${scaledYieldString}).`;
            }

            return `Now scaled ${direction} by ${selectedScaleFactor}x.`;
          })()}
        </Text>
        <View style={styles.servingsContainer}>
          {scaleFactorOptions.map(option => (
            <TouchableOpacity 
              key={option.value}
              style={[styles.servingButton, selectedScaleFactor === option.value && styles.servingButtonSelected]}
              onPress={() => handleScaleFactorChange(option.value)}
            >
              <Text style={[styles.servingButtonText, selectedScaleFactor === option.value && styles.servingButtonTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Allergen Info */}
        {detectedAllergens && detectedAllergens.length > 0 && (
            <>
                <Text style={styles.sectionTitle}>Allergens</Text>
                <Text style={styles.helperText}>
                    This recipe contains{' '}
                    {detectedAllergens.map((allergen, index) => (
                      <React.Fragment key={allergen}>
                        <Text style={styles.allergenText}>{allergen}</Text>
                        {index < detectedAllergens.length - 1 && ', '}
                      </React.Fragment>
                    ))}
                    . If you are allergic or insensitive to any of these, you can substitute them out on the following page.
                </Text>
            </>
        )}

        {/* Original Source */}
        {recipe.sourceUrl && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>From the Original Author</Text>
            <Text style={styles.sourceLink} onPress={() => Linking.openURL(recipe.sourceUrl!)}>
              Visit ↗︎
            </Text>
          </>
        )}

      </ScrollView>

      {/* Footer Button */} 
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={navigateToIngredients}>
            <Text style={styles.nextButtonText}>Go to Ingredients</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Add Styles for Summary Screen --- 
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
  exitButton: {
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
    textAlign: 'left',
    lineHeight: 34,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Ensure space for the footer button
  },
  recipeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  recipeTextContainer: {
    flex: 1,
  },
  recipeImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  sectionTitle: {
      ...sectionHeaderText,
      color: COLORS.textDark,
      marginBottom: 8,
      textAlign: 'left',
      marginTop: 12,
  },
  sectionSubtext: {
    ...bodyText,
    color: COLORS.gray,
    marginBottom: 12,
    lineHeight: 22,
    textAlign: 'left',
  },
  helperText: {
    ...bodyText,
    color: '#8e8e8e',
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'left',
  },
  readMoreToggle: {
    ...captionStrongText,
    color: COLORS.primary,
    marginLeft: 8,
  },
  allergenText: {
    ...bodyStrongText,
    color: COLORS.textDark, // Using a darker tone for emphasis as requested
    fontWeight: '600',
  },
  sourceLink: {
    ...bodyStrongText,
    color: COLORS.primary,
  },
  servingsContainer: {
      flexDirection: 'row',
      marginBottom: 12,
      gap: servingsContainerGap,
  },
  servingButton: {
      width: buttonWidth,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.lightGray,
      backgroundColor: COLORS.white,
      alignItems: 'center',
  },
  servingButtonSelected: {
      backgroundColor: COLORS.primaryLight,
      borderColor: COLORS.primary,
  },
  servingButtonText: {
      ...captionStrongText,
      color: COLORS.textDark,
  },
  servingButtonTextSelected: {
      color: COLORS.primary,
  },
  footer: { /* Similar to other footers */
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
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
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
  servingQuestionPrompt: {
    ...bodyText,
    color: COLORS.gray,
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'left',
  },
  divider: {
    height: 1,
    backgroundColor: '#e6e0d9',
    marginVertical: 12,
  },
  // Add styles for loading/error states if needed
}); 