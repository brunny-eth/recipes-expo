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

// Helper function to truncate title to 15 characters + ellipses
const truncateTitle = (title: string, maxLength: number = 15): string => {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
};

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

  // Single recipe case - show with underline
  if (recipes.length === 1) {
    const recipe = recipes[0];
    const recipeTitle = recipe.recipe?.title || 'Loading...';
    const truncatedTitle = truncateTitle(recipeTitle);

    return (
      <View style={styles.container}>
        <View style={styles.singleRecipeContainer}>
          <Text style={styles.singleRecipeTitle}>
            {truncatedTitle}
          </Text>
          <View style={styles.singleRecipeUnderline} />
        </View>
      </View>
    );
  }

  // Multiple recipes case - horizontal scrolling with underlines
  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {recipes.map((recipe, index) => {
            const isActive = recipe.recipeId === activeRecipeId;
            const recipeTitle = recipe.recipe?.title || 'Loading...';
            const truncatedTitle = truncateTitle(recipeTitle);

            console.log('[RecipeSwitcher] 🎨 Rendering recipe button:', {
              key: recipe.recipeId,
              title: recipeTitle,
              truncatedTitle,
              isActive,
              isLoading: recipe.isLoading,
              hasRecipe: !!recipe.recipe,
            });

            return (
              <TouchableOpacity
                key={recipe.recipeId}
                style={styles.tabButton}
                onPress={() => handleRecipePress(recipe)}
                activeOpacity={0.8}
              >
                <Text 
                  style={[
                    styles.tabButtonText,
                    isActive && styles.tabButtonTextActive,
                  ]}
                >
                  {truncatedTitle}
                </Text>
                {isActive && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0, // Remove horizontal padding to start tabs at screen edge
    paddingVertical: SPACING.sm,
  },
  
  // Single recipe styles
  singleRecipeContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  singleRecipeTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  singleRecipeUnderline: {
    position: 'absolute',
    bottom: -2,
    height: 2,
    width: '60%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  
  // Multiple recipes styles - underline style like ESPN+
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingLeft: SPACING.pageHorizontal, // Start with standard page padding on left
    paddingRight: SPACING.sm, // Smaller padding on right to show overflow
  },
  tabButton: {
    paddingVertical: 16,
    paddingHorizontal: 12, // Reduced from 16 to make tabs tighter
    alignItems: 'center',
    position: 'relative',
    backgroundColor: COLORS.background,
    minWidth: 60, // Reduced from 80 to allow more tabs visible
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 2,
    height: 2,
    width: '100%', // Fill entire tab width instead of 60%
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  tabButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: COLORS.textDark,
  },
}); 