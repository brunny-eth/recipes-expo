import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import IngredientSubstitutionModal from './IngredientSubstitutionModal';

type Recipe = {
  id: string;
  title: string;
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
    adjustable: boolean;
  }>;
  servings: number;
};

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  isChecked: boolean;
  substitution?: {
    name: string;
    description: string;
  };
}

const SAMPLE_RECIPES: Record<string, Recipe> = {
  'sample-recipe': {
    id: 'sample-recipe',
    title: 'Sample Recipe',
    ingredients: [
      { name: 'Flour', amount: '2', unit: 'cups', adjustable: true },
      { name: 'Sugar', amount: '1', unit: 'cup', adjustable: true },
      { name: 'Eggs', amount: '2', unit: 'large', adjustable: false },
    ],
    servings: 4,
  },
  'recipe-1': {
    id: 'recipe-1',
    title: 'Recipe 1',
    ingredients: [
      { name: 'Milk', amount: '1', unit: 'cup', adjustable: true },
      { name: 'Butter', amount: '1/2', unit: 'cup', adjustable: true },
      { name: 'Salt', amount: '1', unit: 'tsp', adjustable: true },
    ],
    servings: 4,
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
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [adjustedIngredients, setAdjustedIngredients] = useState<Array<{name: string, amount: string}>>([]);
  const [checked, setChecked] = useState<{[key: string]: boolean}>({});
  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [servings, setServings] = useState(4);

  const recipe = SAMPLE_RECIPES[recipeId];
  
  useEffect(() => {
    if (recipe && recipe.ingredients) {
      // Initialize ingredients list
      const initialIngredients = recipe.ingredients.map((ingredient, index) => ({
        id: `${index}`,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        isChecked: false
      }));
      setIngredients(initialIngredients);

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
  
  const toggleChecked = (id: string) => {
    setChecked(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const navigateToSteps = () => {
    router.push({
      pathname: '/recipe/steps',
      params: { recipeId }
    });
  };

  const handleSubstitutePress = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setSubstitutionModalVisible(true);
  };

  const handleApplySubstitution = (substitution: { name: string; description: string }) => {
    if (selectedIngredient) {
      const updatedIngredients = ingredients.map((ing) =>
        ing.id === selectedIngredient.id
          ? { ...ing, substitution }
          : ing
      );
      setIngredients(updatedIngredients);
    }
    setSubstitutionModalVisible(false);
    setSelectedIngredient(null);
  };

  const handleServingsChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setServings(numValue);
      adjustIngredients(numValue);
    }
  };

  const adjustIngredients = (newServings: number) => {
    const ratio = newServings / recipe.servings;
    const adjusted = ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount ? `${(parseFloat(ing.amount) * ratio).toFixed(1)} ${ing.unit}` : ''
    }));
    setAdjustedIngredients(adjusted);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ingredients</Text>
        <View style={styles.placeholder} />
      </Animated.View>
      
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          {recipe.title}
        </Text>
      </View>
      
      <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false}>
        {ingredients.map((ingredient) => (
          <View key={ingredient.id} style={styles.ingredientItem}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => toggleChecked(ingredient.id)}
            >
              <View
                style={[
                  styles.checkboxInner,
                  ingredient.isChecked && styles.checkboxChecked,
                ]}
              />
            </TouchableOpacity>
            <View style={styles.ingredientInfo}>
              <Text style={styles.ingredientName}>
                {ingredient.substitution ? ingredient.substitution.name : ingredient.name}
                <Text style={styles.ingredientAmount}>
                  {' '}({ingredient.amount} {ingredient.unit})
                </Text>
              </Text>
              {ingredient.substitution && (
                <View style={styles.substitutionContainer}>
                  <Text style={styles.substitutionText}>
                    Substituted for {ingredient.name}
                  </Text>
                  <TouchableOpacity 
                    style={styles.cancelSubstitutionButton}
                    onPress={() => {
                      const updatedIngredients = ingredients.map((ing) =>
                        ing.id === ingredient.id
                          ? { ...ing, substitution: undefined }
                          : ing
                      );
                      setIngredients(updatedIngredients);
                    }}
                  >
                    <Text style={styles.cancelSubstitutionText}>×</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.substituteButton}
              onPress={() => handleSubstitutePress(ingredient)}
            >
              <Text style={styles.substituteButtonText}>Substitute</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.nextButton}
        onPress={navigateToSteps}
      >
        <Text style={styles.nextButtonText}>View Cooking Steps</Text>
        <ChevronRight size={20} color={COLORS.white} />
      </TouchableOpacity>

      <IngredientSubstitutionModal
        visible={substitutionModalVisible}
        onClose={() => {
          setSubstitutionModalVisible(false);
          setSelectedIngredient(null);
        }}
        ingredientName={selectedIngredient?.name || ''}
        onApply={handleApplySubstitution}
      />
    </SafeAreaView>
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
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkbox: {
    marginRight: 16,
  },
  checkboxInner: {
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
  ingredientInfo: {
    flex: 1,
    marginRight: 12,
  },
  ingredientName: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
  },
  ingredientAmount: {
    color: COLORS.textGray,
  },
  substitutionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  substitutionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: COLORS.textGray,
    marginRight: 4,
  },
  cancelSubstitutionButton: {
    padding: 0,
  },
  cancelSubstitutionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 18,
    color: COLORS.warning,
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
  substituteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  substituteButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: COLORS.primary,
  },
});