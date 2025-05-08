import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Clock } from 'lucide-react-native'; // Removed Zap, PieChart
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { scaleIngredient } from '@/utils/recipeUtils'; // Correct import path assuming utils is under root/src or similar alias

// --- Define Types (Matching Backend Output) ---
// Re-define types here or import from a shared types file
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null }> | null;
};

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
    originalIngredients: StructuredIngredient[] | string[] | null; // Unscaled
    scaledIngredients: StructuredIngredient[] | null; // Scaled
    instructions: string[] | null;
    substitutions_text: string | null;
    originalYield: string | null;
    selectedServings: number;
};
// --- End Types ---

// --- NEW Helper Function to parse yield string ---
function parseYieldString(yieldStr: string | null | undefined): number | null {
  if (!yieldStr) return null;
  // Try to get the first number in the string
  // This regex handles integers, and potentially the first number in a range like "4-6"
  const match = yieldStr.match(/\d+/);
  if (match && match[0]) {
    const num = parseInt(match[0], 10);
    return !isNaN(num) && num > 0 ? num : null;
  }
  // Fallback for simple worded numbers (optional, can be expanded)
  // This is a very basic example, a more robust library might be needed for complex cases
  const lowerYieldStr = yieldStr.toLowerCase();
  if (lowerYieldStr.includes("one")) return 1;
  if (lowerYieldStr.includes("two")) return 2;
  // Add more common words if necessary

  return null;
}
// --- End NEW Helper Function ---

export default function RecipeSummaryScreen() {
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServings, setSelectedServings] = useState<number>(4); // Default servings

  useEffect(() => {
    if (params.recipeData) {
      try {
        const parsed = JSON.parse(params.recipeData) as ParsedRecipe;
        setRecipe(parsed);
        
        // Use the new parseYieldString helper, with a default of 4 if null or invalid
        const yieldNum = parseYieldString(parsed.recipeYield) ?? 4; 

        if (yieldNum > 0) { // isNaN check is covered by parseYieldString returning null
          setSelectedServings(yieldNum);
        } else {
          setSelectedServings(4); // Explicitly default to 4 if yieldNum ended up not positive
        }
      } catch (e) {
        console.error("Failed to parse recipe data on summary screen:", e);
        setError("Could not load recipe details.");
      }
    } else {
      setError("Recipe data not provided.");
    }
    setIsLoading(false);
  }, [params.recipeData]);

  const handleServingsChange = (servings: number) => {
    setSelectedServings(servings);
  };

  const navigateToIngredients = () => {
    if (!recipe || !recipe.ingredients) return;

    const originalIngredients = recipe.ingredients; // Keep the original list
    const originalYield = recipe.recipeYield || null;
    const originalServingsNum = parseInt(originalYield || '1', 10);
    const validOriginalServings = (!isNaN(originalServingsNum) && originalServingsNum > 0) ? originalServingsNum : 1; 

    let scaledIngredients: StructuredIngredient[] | null = null;
    if (Array.isArray(originalIngredients)) {
       const structuredOriginals = originalIngredients.map(ing => {
           if (typeof ing === 'string') {
               return { name: ing, amount: null, unit: null, suggested_substitutions: null }; // Convert string to basic object
           } 
           // Ensure it matches StructuredIngredient shape, add missing optional keys if needed
           return { 
                name: ing.name, 
                amount: ing.amount,
                unit: ing.unit,
                suggested_substitutions: ing.suggested_substitutions || null
            }; 
       }).filter(ing => typeof ing === 'object' && ing !== null) as StructuredIngredient[];

        scaledIngredients = structuredOriginals.map(ingredient => 
            scaleIngredient(ingredient, validOriginalServings, selectedServings)
        );
    } else {
        console.warn("Original ingredients are not in a scalable format (expected array).");
        // If original aren't scalable, pass them along as-is for scaled too?
        scaledIngredients = null; // Or handle as appropriate
    }
    
    // Prepare data for navigation
    const navParams: IngredientsNavParams = {
        title: recipe.title,
        originalIngredients: originalIngredients, // Pass original
        scaledIngredients: scaledIngredients,     // Pass scaled
        instructions: recipe.instructions,
        substitutions_text: recipe.substitutions_text,
        originalYield: originalYield,             // Pass original yield string
        selectedServings: selectedServings        // Pass the target servings count
    };

    router.push({
      pathname: '/recipe/ingredients',
      params: { 
        recipeData: JSON.stringify(navParams) // Pass the whole structured object
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

  if (error || !recipe) {
      return (
        <SafeAreaView style={styles.centeredStatusContainer}>
          <Text style={styles.errorText}>{error || 'Recipe data could not be loaded.'}</Text>
          <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
               <Text style={styles.backButtonText}>Go Back</Text>
           </TouchableOpacity>
        </SafeAreaView>
      );
  }

  const servingOptions = [1, 2, 4, 6, 8]; // Example options

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */} 
      <View style={styles.header}>
         <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
           <ArrowLeft size={24} color={COLORS.textDark} />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>{recipe.title || 'Recipe Summary'}</Text>
         <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Nutrition Info Section Removed */}

        {/* Servings Selector */} 
        <Text style={styles.sectionTitle}>Adjust Recipe Size</Text>
        <Text style={styles.servingQuestionPrompt}>
          {`This recipe is currently set for ${recipe.recipeYield ? `${recipe.recipeYield} servings` : 'its original servings'}. How many servings would you like to prepare?`}
        </Text>
        <View style={styles.servingsContainer}>
          {servingOptions.map(num => (
            <TouchableOpacity 
              key={num}
              style={[styles.servingButton, selectedServings === num && styles.servingButtonSelected]}
              onPress={() => handleServingsChange(num)}
            >
              <Text style={[styles.servingButtonText, selectedServings === num && styles.servingButtonTextSelected]}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {(recipe.recipeYield && selectedServings !== parseInt(recipe.recipeYield, 10)) && (
             <Text style={styles.originalYieldText}>Original recipe makes {recipe.recipeYield}</Text>
        )}

        {/* Time Info */} 
         {(recipe.prepTime || recipe.cookTime || recipe.totalTime) && (
             <View style={[styles.infoBox, styles.timeInfoBox]}>
                 {recipe.prepTime && (
                     <View style={styles.infoItem}>
                         <Clock size={20} color={COLORS.secondary} />
                         <Text style={styles.infoValue}>{recipe.prepTime}</Text>
                         <Text style={styles.infoLabel}>Prep Time</Text>
                     </View>
                 )}
                 {recipe.cookTime && (
                      <View style={styles.infoItem}>
                         <Clock size={20} color={COLORS.secondary} />
                         <Text style={styles.infoValue}>{recipe.cookTime}</Text>
                         <Text style={styles.infoLabel}>Cook Time</Text>
                      </View>
                 )}
                  {recipe.totalTime && (
                      <View style={styles.infoItem}>
                         <Clock size={20} color={COLORS.secondary} />
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
            <ChevronRight size={20} color={COLORS.white} />
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  backButton: { padding: 8 },
  headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: 'Poppins-SemiBold',
      fontSize: 18,
      color: COLORS.textDark,
      marginHorizontal: 5,
  },
  scrollContent: {
      padding: 20,
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
      color: COLORS.textGray,
      marginTop: 2,
  },
  sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 18,
      color: COLORS.textDark,
      marginBottom: 15,
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
      fontSize: 12,
      color: COLORS.textGray,
      textAlign: 'center',
      marginBottom: 25,
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
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 10,
  },
  // Add styles for loading/error states if needed
}); 