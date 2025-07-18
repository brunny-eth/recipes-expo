import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, BORDER_WIDTH } from '@/constants/theme';
import { bodyStrongText, bodyText, FONT } from '@/constants/typography';
import { RecipeSession } from '@/context/CookingContext';

interface RecipeSwitcherProps {
  recipes: RecipeSession[];
  activeRecipeId: string;
  onRecipeSwitch: (recipeId: string) => void;
}

export default function RecipeSwitcher({ 
  recipes, 
  activeRecipeId, 
  onRecipeSwitch
}: RecipeSwitcherProps) {
  console.log('[RecipeSwitcher] 🔄 Rendering with props:', {
    recipesCount: recipes.length,
    activeRecipeId,
    recipeKeys: recipes.map(r => ({ key: r.recipeId, title: r.recipe?.title, isLoading: r.isLoading }))
  });

  if (recipes.length === 0) {
    console.log('[RecipeSwitcher] ❌ No recipes to display');
    return null;
  }

  const handleRecipePress = (recipe: RecipeSession) => {
    console.log('[RecipeSwitcher] 👆 Recipe card pressed:', {
      recipeId: recipe.recipeId,
      isLoading: recipe.isLoading,
      hasRecipeData: !!recipe.recipe,
      title: recipe.recipe?.title || 'No title'
    });

    // Only switch to the recipe - let the parent handle data loading
    onRecipeSwitch(recipe.recipeId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {recipes.map((recipe, index) => {
          const isActive = recipe.recipeId === activeRecipeId;
          const recipeTitle = recipe.recipe?.title || 'Loading...';

          console.log('[RecipeSwitcher] 🎨 Rendering recipe button:', {
            key: recipe.recipeId,
            title: recipeTitle,
            isActive,
            isLoading: recipe.isLoading,
            hasRecipe: !!recipe.recipe,
          });

          return (
            <TouchableOpacity
              key={recipe.recipeId}
              style={[
                styles.tabButton,
                isActive && styles.tabButtonActive,
                recipes.length === 1 && styles.singleTabButton,
              ]}
              onPress={() => handleRecipePress(recipe)}
              activeOpacity={0.8}
            >
              <Text 
                style={[
                  styles.tabButtonText,
                  isActive && styles.tabButtonTextActive,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {recipeTitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 999, // Fully rounded pill shape
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999, // Fully rounded pill shape
    backgroundColor: COLORS.white, // White background for inactive tabs
    minWidth: 0, // Allow button to shrink
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  singleTabButton: {
    // When there's only one recipe, make it look more like a header
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    ...bodyStrongText,
    color: COLORS.primary, // Burnt orange text for inactive tabs
    textAlign: 'center',
    fontSize: FONT.size.caption, // Smaller text for better fit
    lineHeight: FONT.size.caption + 2, // Tighter line height
  },
  tabButtonTextActive: {
    color: COLORS.white,
  },
}); 