import { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookmarkPlus, Bookmark } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';

// Add type for recipe
type Recipe = {
  id: string;
  title: string;
  calories: number;
  protein: number;
  imageUrl: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: number;
  ingredients: Array<{
    name: string;
    amount: string;
    adjustable: boolean;
  }>;
  steps: string[];
};

// Add type for SAMPLE_RECIPES
const SAMPLE_RECIPES: Record<string, Recipe> = {
  'sample-recipe': {
    id: 'sample-recipe',
    title: 'Chicken Avocado Sandwich',
    calories: 425,
    protein: 27,
    imageUrl: 'https://images.pexels.com/photos/1647163/pexels-photo-1647163.jpeg',
    prepTime: '15 mins',
    cookTime: '10 mins',
    totalTime: '25 mins',
    servings: 1,
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
    steps: [
      'Season chicken breast with salt and pepper.',
      'Cook chicken in a pan over medium heat until internal temperature reaches 165°F (74°C), about 6-8 minutes per side.',
      'Toast bread slices.',
      'Mash avocado and spread on one slice of bread.',
      'Spread mayo on the other slice of bread.',
      'Layer lettuce, cooked chicken, and tomato slices.',
      'Close sandwich and cut diagonally.',
      'Serve immediately.'
    ]
  },
  'recipe-1': {
    id: 'recipe-1',
    title: 'Chicken Avocado Sandwich',
    calories: 425,
    protein: 27,
    imageUrl: 'https://images.pexels.com/photos/1647163/pexels-photo-1647163.jpeg',
    prepTime: '15 mins',
    cookTime: '10 mins',
    totalTime: '25 mins',
    servings: 1,
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
    steps: [
      'Season chicken breast with salt and pepper.',
      'Cook chicken in a pan over medium heat until internal temperature reaches 165°F (74°C), about 6-8 minutes per side.',
      'Toast bread slices.',
      'Mash avocado and spread on one slice of bread.',
      'Spread mayo on the other slice of bread.',
      'Layer lettuce, cooked chicken, and tomato slices.',
      'Close sandwich and cut diagonally.',
      'Serve immediately.'
    ]
  },
  'recipe-2': {
    id: 'recipe-2',
    title: 'Greek Yogurt Parfait',
    calories: 310,
    protein: 18,
    imageUrl: 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg',
    prepTime: '10 mins',
    cookTime: '0 mins',
    totalTime: '10 mins',
    servings: 1,
    ingredients: [
      { name: 'Greek yogurt', amount: '1 cup', adjustable: true },
      { name: 'Granola', amount: '1/4 cup', adjustable: true },
      { name: 'Mixed berries', amount: '1/2 cup', adjustable: true },
      { name: 'Honey', amount: '1 tbsp', adjustable: true }
    ],
    steps: [
      'Layer yogurt, granola, and berries in a glass',
      'Drizzle with honey',
      'Serve immediately'
    ]
  },
  'recipe-3': {
    id: 'recipe-3',
    title: 'Spinach Mushroom Omelette',
    calories: 285,
    protein: 22,
    imageUrl: 'https://images.pexels.com/photos/803963/pexels-photo-803963.jpeg',
    prepTime: '5 mins',
    cookTime: '10 mins',
    totalTime: '15 mins',
    servings: 1,
    ingredients: [
      { name: 'Eggs', amount: '2', adjustable: true },
      { name: 'Spinach', amount: '1 cup', adjustable: true },
      { name: 'Mushrooms', amount: '1/2 cup', adjustable: true },
      { name: 'Cheese', amount: '1/4 cup', adjustable: true },
      { name: 'Salt', amount: 'to taste', adjustable: false },
      { name: 'Pepper', amount: 'to taste', adjustable: false }
    ],
    steps: [
      'Whisk eggs with salt and pepper',
      'Sauté mushrooms and spinach',
      'Pour eggs into pan and cook until set',
      'Add cheese and fold omelette',
      'Serve hot'
    ]
  },
};

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();
  const recipeId = params.id as string;
  const router = useRouter();
  
  const [selectedServings, setSelectedServings] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  
  const recipe = SAMPLE_RECIPES[recipeId];
  
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
  
  const servingOptions = [1, 2, 4, 6, 8];
  
  const navigateToIngredients = () => {
    router.push({
      pathname: '/recipe/ingredients',
      params: { recipeId, servings: selectedServings }
    });
  };
  
  const navigateToPrep = () => {
    router.push({
      pathname: '/recipe/prep',
      params: { recipeId }
    });
  };
  
  const navigateToSteps = () => {
    router.push({
      pathname: '/recipe/steps',
      params: { recipeId }
    });
  };
  
  const toggleSaveRecipe = () => {
    setIsSaved(!isSaved);
    // In a real app, we would save this to storage or a database
  };
  
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Image 
            source={{ uri: recipe.imageUrl }} 
            style={styles.recipeImage}
            resizeMode="cover"
          />
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={toggleSaveRecipe}
            >
              {isSaved ? (
                <Bookmark size={24} color={COLORS.primary} fill={COLORS.primary} />
              ) : (
                <BookmarkPlus size={24} color={COLORS.textDark} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          
          <View style={styles.nutritionContainer}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{recipe.calories}</Text>
              <Text style={styles.nutritionLabel}>calories</Text>
              <Text style={styles.nutritionPerServing}>(per serving)</Text>
            </View>
            
            <View style={styles.nutritionDivider} />
            
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{recipe.protein}</Text>
              <Text style={styles.nutritionLabel}>grams of protein</Text>
              <Text style={styles.nutritionPerServing}>(per serving)</Text>
            </View>
          </View>
          
          <Text style={styles.servingsLabel}>How many servings do you want?</Text>
          
          <View style={styles.servingSelector}>
            {servingOptions.map((servings) => (
              <TouchableOpacity
                key={servings}
                style={[
                  styles.servingOption,
                  selectedServings === servings && styles.servingOptionSelected
                ]}
                onPress={() => setSelectedServings(servings)}
              >
                <Text
                  style={[
                    styles.servingOptionText,
                    selectedServings === servings && styles.servingOptionTextSelected
                  ]}
                >
                  {servings}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={navigateToIngredients}
            >
              <Text style={styles.buttonText}>Go to Ingredients</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]}
              onPress={navigateToPrep}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go to Prep Work</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]}
              onPress={navigateToSteps}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go to Steps</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.timeInfoContainer}>
            <View style={styles.timeInfo}>
              <Text style={styles.timeInfoLabel}>Prep Time</Text>
              <Text style={styles.timeInfoValue}>{recipe.prepTime}</Text>
            </View>
            
            <View style={styles.timeInfo}>
              <Text style={styles.timeInfoLabel}>Cook Time</Text>
              <Text style={styles.timeInfoValue}>{recipe.cookTime}</Text>
            </View>
            
            <View style={styles.timeInfo}>
              <Text style={styles.timeInfoLabel}>Total Time</Text>
              <Text style={styles.timeInfoValue}>{recipe.totalTime}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 250,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerActions: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  recipeTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  nutritionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.lightGray,
  },
  nutritionValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: COLORS.textDark,
  },
  nutritionLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  nutritionPerServing: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
  servingsLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  servingSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  servingOption: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  servingOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  servingOptionText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
  },
  servingOptionTextSelected: {
    color: COLORS.primary,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.primary,
  },
  timeInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInfo: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  timeInfoLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  timeInfoValue: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: COLORS.textDark,
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