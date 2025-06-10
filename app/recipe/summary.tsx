import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { scaleIngredient, parseServingsValue, getScaledYieldText } from '@/utils/recipeUtils'; // Correct import path assuming utils is under root/src or similar alias
import { StructuredIngredient } from '@/api/types';
import { coerceToStructuredIngredients } from '@/utils/ingredientHelpers'; // Import the new helper
import { useErrorModal } from '@/context/ErrorModalContext'; // Added import
import InlineErrorBanner from '@/components/InlineErrorBanner'; // Import the new component

// --- Define Types (Matching Backend Output) ---
// Re-define types here or import from a shared types file
type ParsedRecipe = {
  title: string | null;
  ingredients: StructuredIngredient[] | string[] | null; // This holds the ORIGINAL ingredients initially
  instructions: string[] | null;
  substitutions_text: string | null;
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: { calories?: string | null; protein?: string | null; [key: string]: any } | null;
};

// Type for data passed to IngredientsScreen
type IngredientsNavParams = {
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
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal(); // Added hook usage
  
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // NEW state for original yield value and selected scale factor
  const [originalYieldValue, setOriginalYieldValue] = useState<number | null>(null);
  const [selectedScaleFactor, setSelectedScaleFactor] = useState<number>(1.0); // Default to 1x

  useEffect(() => {
    setIsLoading(true); // Start loading
    setRecipe(null); // Reset recipe on new data

    if (params.recipeData) {
      try {
        const parsed = JSON.parse(params.recipeData) as ParsedRecipe;
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) { // Added check for empty/invalid parsed object
          console.error("Parsed recipe data is empty or invalid on summary screen.");
          showError({
            title: "Error Loading Summary",
            message: "Recipe data is invalid. Please go back and try again."
          });
          setIsLoading(false);
          return;
        }
        setRecipe(parsed);
        
        const yieldNum = parseServingsValue(parsed.recipeYield); 
        setOriginalYieldValue(yieldNum);
        setSelectedScaleFactor(1.0);

      } catch (e: any) {
        console.error("Failed to parse recipe data on summary screen:", e);
        showError({
          title: "Error Loading Summary",
          message: `Could not load recipe details: ${e.message}. Please go back and try again.`
        });
        setIsLoading(false); // Ensure loading is false on error
        return; // Prevent further processing
      }
    } else {
      showError({
        title: "Error Loading Summary",
        message: "Recipe data not provided. Please go back and try again."
      });
      setIsLoading(false); // Ensure loading is false on error
      return; // Prevent further processing
    }
    setIsLoading(false); // Finish loading successfully
  }, [params.recipeData, showError, router]); // Added showError and router

  const handleScaleFactorChange = (factor: number) => {
    setSelectedScaleFactor(factor);
  };

  // Clean the title to remove attribution text like " - by Publisher"
  const cleanTitle = recipe?.title?.replace(/\s*[–-]\s*by\s+.*$/i, '').trim();

  const navigateToIngredients = () => {
    if (!recipe || !recipe.ingredients) return;

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
        title: cleanTitle || recipe.title,
        originalIngredients: structuredOriginals, // Pass the coerced originals
        scaledIngredients: scaledIngredients,
        instructions: recipe.instructions,
        substitutions_text: recipe.substitutions_text,
        originalYieldDisplay: recipe.recipeYield || null,
        scaleFactor: selectedScaleFactor
    };

    router.push({
      pathname: '/recipe/ingredients',
      params: { 
        recipeData: JSON.stringify(navParams) // Reverted to original
        // recipeData: "this is not valid json for ingredients" // Temporary change for testing
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

  // Use the new helper for scaled yield text display
  const displayableYieldText = recipe.recipeYield || "its original quantity";
  // For the text indicating what it makes *now* after scaling:
  const currentScaledResultText = getScaledYieldText(recipe.recipeYield, selectedScaleFactor);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */} 
      <View style={styles.header}>
         <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
           <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
         </TouchableOpacity>
         <View style={{ width: 40 }} /> 
      </View>
      
      {cleanTitle && (
        <Text style={styles.pageTitle}>{cleanTitle}</Text>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Nutrition Info Section Removed */}

        {/* Servings Selector */} 
        <Text style={styles.sectionTitle}>Adjust Recipe Size</Text>
        <Text style={styles.servingQuestionPrompt}>
          {/* Display initial yield string, then the result of scaling if factor is not 1 */}
          {`This recipe makes ${displayableYieldText}.`}
          {selectedScaleFactor !== 1.0 && 
            ` You are viewing a version scaled to: ${currentScaledResultText}.`}
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
        {/* 
          The old originalYieldText that showed a complex string can be simplified or removed 
          as the main prompt now includes the scaled result more clearly.
          If we want to keep a note about the original, it can be simpler.
        */}
        {selectedScaleFactor !== 1.0 && recipe.recipeYield && (
             <Text style={styles.originalYieldText}>
                (Original recipe makes: {recipe.recipeYield})
             </Text>
        )}

        {/* Time Info */} 
         {(recipe.prepTime || recipe.cookTime || recipe.totalTime) && (
             <View style={[styles.infoBox, styles.timeInfoBox]}>
                 {recipe.prepTime && (
                     <View style={styles.infoItem}>
                         <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.secondary} />
                         <Text style={styles.infoValue}>{recipe.prepTime}</Text>
                         <Text style={styles.infoLabel}>Prep Time</Text>
                     </View>
                 )}
                 {recipe.cookTime && (
                      <View style={styles.infoItem}>
                         <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.secondary} />
                         <Text style={styles.infoValue}>{recipe.cookTime}</Text>
                         <Text style={styles.infoLabel}>Cook Time</Text>
                      </View>
                 )}
                  {recipe.totalTime && (
                      <View style={styles.infoItem}>
                         <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.secondary} />
                         <Text style={styles.infoValue}>{recipe.totalTime}</Text>
                         <Text style={styles.infoLabel}>Total Time</Text>
                      </View>
                 )}
             </View>
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
  header: { /* Similar to other headers */
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 8,
    marginLeft: -8, // Offset padding for visual alignment
  },
  pageTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 26,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Ensure space for the footer button
  },
  infoBox: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      padding: 15,
      borderRadius: 12,
      marginBottom: 25,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
  },
  timeInfoBox: {
      justifyContent: 'space-between', // Adjust for 3 items
  },
  infoItem: {
      alignItems: 'center',
      minWidth: 80, // Give items some minimum space
  },
  infoValue: {
      fontFamily: 'Poppins-Bold',
      fontSize: 20,
      color: COLORS.textDark,
      marginTop: 5,
  },
  infoLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: 12,
      color: COLORS.gray,
      marginTop: 2,
  },
  sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 18,
      color: COLORS.textDark,
      marginTop: 24,
      marginBottom: 12,
  },
  servingsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
  },
  servingButton: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.lightGray,
      backgroundColor: COLORS.white,
      minWidth: 45, // Ensure buttons have size
      alignItems: 'center',
  },
  servingButtonSelected: {
      backgroundColor: COLORS.primaryLight,
      borderColor: COLORS.primary,
  },
  servingButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: 16,
      color: COLORS.textDark,
  },
  servingButtonTextSelected: {
      color: COLORS.primary,
  },
  originalYieldText: {
      fontFamily: 'Poppins-Regular',
      fontSize: 13,
      color: COLORS.gray,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 16,
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
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
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
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
  servingQuestionPrompt: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: COLORS.gray,
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  // Add styles for loading/error states if needed
}); 