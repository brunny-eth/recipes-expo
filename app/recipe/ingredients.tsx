import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';

// Sample recipe data - in a real app, this would come from an API or local storage
const SAMPLE_RECIPES = {
  'sample-recipe': {
    id: 'sample-recipe',
    title: 'Chicken Avocado Sandwich',
    ingredients: [
      { name: 'Chicken breast', amount: '4 oz', adjustable: true },
      { name: 'Avocado', amount: '1/2', adjustable: true },
      { name: 'Whole grain bread', amount: '2 slices', adjustable: true },
      { name: 'Lettuce', amount: '1 leaf', adjustable: true },
      { name: 'Tomato', amount: '2 slices', adjustable: true },
      { name: 'Mayo', amount: '1 tbsp', adjustable: true },
      { name: 'Salt', amount: 'to taste', adjustable: false },
      { name: 'Pepper', amount: 'to taste', adjustable: false },
    ],
  },
  'recipe-1': {
    id: 'recipe-1',
    title: 'Chicken Avocado Sandwich',
    ingredients: [
      { name: 'Chicken breast', amount: '4 oz', adjustable: true },
      { name: 'Avocado', amount: '1/2', adjustable: true },
      { name: 'Whole grain bread', amount: '2 slices', adjustable: true },
      { name: 'Lettuce', amount: '1 leaf', adjustable: true },
      { name: 'Tomato', amount: '2 slices', adjustable: true },
      { name: 'Mayo', amount: '1 tbsp', adjustable: true },
      { name: 'Salt', amount: 'to taste', adjustable: false },
      { name: 'Pepper', amount: 'to taste', adjustable: false },
    ],
  },
};

// Helper function to adjust ingredient amounts based on servings
const adjustIngredientAmount = (amount: string, servings: number, isAdjustable: boolean): string => {
  if (!isAdjustable) return amount;
  
  // Handle "to taste" and similar non-numeric values
  if (amount.includes('to taste') || amount.includes('as needed')) {
    return amount;
  }
  
  // Extract numeric values and units
  const regex = /^([\d./]+)(\s*)(.*)/;
  const match = amount.match(regex);
  
  if (!match) return amount;
  
  const [_, numericPart, space, unitPart] = match;
  
  // Handle fractions like 1/2
  if (numericPart.includes('/')) {
    const [numerator, denominator] = numericPart.split('/').map(Number);
    const decimal = (numerator / denominator) * servings;
    
    // Convert back to a fraction or decimal as appropriate
    if (decimal >= 1) {
      const wholePart = Math.floor(decimal);
      const fractionPart = decimal - wholePart;
      
      if (fractionPart === 0) {
        return `${wholePart}${space}${unitPart}`;
      } else {
        // Find a reasonable fraction approximation
        const fraction = approximateFraction(fractionPart);
        return `${wholePart} ${fraction}${space}${unitPart}`;
      }
    } else {
      const fraction = approximateFraction(decimal);
      return `${fraction}${space}${unitPart}`;
    }
  }
  
  // Handle integers and decimals
  let num = parseFloat(numericPart) * servings;
  
  // Round to 1 decimal place if needed
  num = Math.round(num * 10) / 10;
  
  // Display as integer if it's a whole number
  const displayNum = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
  
  return `${displayNum}${space}${unitPart}`;
};

// Helper function to approximate decimal to common fractions
const approximateFraction = (decimal: number): string => {
  if (decimal >= 0.9) return '1';
  if (decimal >= 0.75) return '3/4';
  if (decimal >= 0.6) return '2/3';
  if (decimal >= 0.45) return '1/2';
  if (decimal >= 0.3) return '1/3';
  if (decimal >= 0.15) return '1/4';
  if (decimal >= 0.05) return '1/8';
  return '0';
};

export default function IngredientsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const recipeId = params.recipeId as string;
  const servingsParam = params.servings as string;
  const servings = parseInt(servingsParam, 10) || 1;
  
  const [adjustedIngredients, setAdjustedIngredients] = useState<Array<{name: string, amount: string}>>([]);
  const [checked, setChecked] = useState<{[key: string]: boolean}>({});
  
  const recipe = SAMPLE_RECIPES[recipeId];
  
  useEffect(() => {
    if (recipe && recipe.ingredients) {
      // Adjust ingredient amounts based on serving size
      const adjusted = recipe.ingredients.map(ingredient => ({
        name: ingredient.name,
        amount: adjustIngredientAmount(ingredient.amount, servings, ingredient.adjustable),
      }));
      
      setAdjustedIngredients(adjusted);
    }
  }, [recipe, servings]);
  
  if (!recipe) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Recipe not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const toggleChecked = (index: number) => {
    setChecked(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  const navigateToSteps = () => {
    router.push({
      pathname: '/recipe/steps',
      params: { recipeId }
    });
  };
  
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ingredients</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          {recipe.title} • {servings} {servings === 1 ? 'serving' : 'servings'}
        </Text>
      </View>
      
      <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false}>
        {adjustedIngredients.map((ingredient, index) => (
          <Animated.View 
            key={`${ingredient.name}-${index}`}
            entering={FadeInRight.delay(index * 50).duration(300)}
            style={styles.ingredientItem}
          >
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => toggleChecked(index)}
            >
              <View style={[styles.checkbox, checked[index] ? styles.checkboxChecked : null]}>
                {checked[index] && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            
            <View style={styles.ingredientContent}>
              <Text style={[
                styles.ingredientName,
                checked[index] && styles.ingredientTextChecked
              ]}>
                {ingredient.name}
              </Text>
              <Text style={[
                styles.ingredientAmount,
                checked[index] && styles.ingredientTextChecked
              ]}>
                {ingredient.amount}
              </Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.nextButton}
        onPress={navigateToSteps}
      >
        <Text style={styles.nextButtonText}>View Cooking Steps</Text>
        <ChevronRight size={20} color={COLORS.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: COLORS.textDark,
  },
  placeholder: {
    width: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  subtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textGray,
  },
  ingredientsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  checkboxContainer: {
    marginRight: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  ingredientContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
    flex: 1,
  },
  ingredientAmount: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.textGray,
    marginLeft: 8,
  },
  ingredientTextChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textGray,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
  },
  nextButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.white,
    marginRight: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  backButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.primary,
  },
});