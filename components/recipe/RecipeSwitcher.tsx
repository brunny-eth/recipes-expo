import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, BORDER_WIDTH } from '@/constants/theme';
import { bodyStrongText, bodyText, FONT } from '@/constants/typography';
import { RecipeSession } from '@/context/CookingContext';

// Helper function to calculate dynamic maxWidth for chips based on screen size
const getChipMaxWidth = () => {
  const { width: screenWidth } = Dimensions.get('window');
  // Use 75% of screen width, but cap at 360px for larger screens and floor at 280px for smaller screens
  const calculatedWidth = screenWidth * 0.75;
  return Math.min(Math.max(calculatedWidth, 280), 360);
};


interface RecipeSwitcherProps {
  recipes: RecipeSession[];
  activeRecipeId: string;
  onRecipeSwitch: (recipeId: string) => void;
}

// Helper function to truncate title to 15 characters + ellipses (original cook screen length)
const truncateTitle = (title: string, maxLength: number = 15): string => {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
};

export default function RecipeSwitcher({ 
  recipes, 
  activeRecipeId, 
  onRecipeSwitch
}: RecipeSwitcherProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupText, setPopupText] = useState('');

  // Auto-scroll to make active chip fully visible when activeRecipeId changes
  useEffect(() => {
    if (recipes.length > 1 && activeRecipeId && scrollViewRef.current) {
      const activeIndex = recipes.findIndex(r => r.recipeId === activeRecipeId);
      if (activeIndex !== -1) {
        // Simple approach: just ensure the active chip is visible
        // Position it with some left padding so it's not cut off
        const estimatedChipWidth = 140;
        const leftPadding = SPACING.pageHorizontal;
        const targetScrollX = Math.max(0, activeIndex * estimatedChipWidth - leftPadding);

        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: targetScrollX,
            animated: true
          });
        }, 100);
      }
    }
  }, [activeRecipeId, recipes.length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  const showRecipeNamePopup = (fullTitle: string) => {
    // Clear any existing timeout
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    // Set popup visible with text
    setPopupText(fullTitle);
    setIsPopupVisible(true);

    // Auto-dismiss after 2.5 seconds
    popupTimeoutRef.current = setTimeout(() => {
      setIsPopupVisible(false);
    }, 2500);
  };

  const hidePopup = () => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
    setIsPopupVisible(false);
  };

  if (recipes.length === 0) {
    return null;
  }

  const handleRecipePress = (recipe: RecipeSession) => {
    const isAlreadyActive = recipe.recipeId === activeRecipeId;
    
    if (isAlreadyActive) {
      // Show popup for full recipe name
      const fullTitle = recipe.recipe?.title || 'Unknown Recipe';
      showRecipeNamePopup(fullTitle);
    } else {
      // Switch to the recipe (existing behavior)
      onRecipeSwitch(recipe.recipeId);
    }
  };

  // Single recipe case - show with underline
  if (recipes.length === 1) {
    const recipe = recipes[0];
    const recipeTitle = recipe.recipe?.title || 'Loading...';
    const truncatedTitle = truncateTitle(recipeTitle);

    return (
      <View style={styles.container}>
        <View style={[styles.singleRecipeContainer, styles.singleRecipeActive]}>
          <TouchableOpacity
            onPress={() => showRecipeNamePopup(recipeTitle)}
            activeOpacity={0.8}
          >
            <Text style={styles.singleRecipeTitle}>
              {truncatedTitle}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Popup for single recipe */}
        <Modal
          transparent
          visible={isPopupVisible}
          animationType="fade"
          onRequestClose={hidePopup}
        >
          <Pressable style={styles.popupBackdrop} onPress={hidePopup}>
            <View style={styles.popupContainer}>
              <Text style={styles.popupText}>{popupText}</Text>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // Multiple recipes case - expanded active chip + compact chips
  const activeRecipe = recipes.find(r => r.recipeId === activeRecipeId);
  const activeRecipeTitle = activeRecipe?.recipe?.title || 'Loading...';

  return (
    <View style={styles.container}>
      {/* Chips with expanded active chip */}
      <View style={styles.chipsContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContainer}
        >
          {recipes.map((recipe, index) => {
            const isActive = recipe.recipeId === activeRecipeId;
            const recipeTitle = recipe.recipe?.title || 'Loading...';
            const displayTitle = isActive ? recipeTitle : truncateTitle(recipeTitle, 12);

            return (
              <TouchableOpacity
                key={recipe.recipeId}
                style={[
                  styles.chip,
                  isActive && styles.chipActive
                ]}
                onPress={() => handleRecipePress(recipe)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive && styles.chipTextActive,
                  ]}
                  numberOfLines={isActive ? 2 : 1}
                >
                  {displayTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Popup for multiple recipes */}
      <Modal
        transparent
        visible={isPopupVisible}
        animationType="fade"
        onRequestClose={hidePopup}
      >
        <Pressable style={styles.popupBackdrop} onPress={hidePopup}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupText}>{popupText}</Text>
          </View>
        </Pressable>
      </Modal>
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
  singleRecipeActive: {
    backgroundColor: '#DEF6FF', // Add blue background for active single recipe
  },
  singleRecipeTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    textAlign: 'center',
  },
  
  // Chips container for multiple recipes
  chipsContainer: {
    backgroundColor: COLORS.primary,
    paddingVertical: 2, // Reduced from SPACING.xs (4px) to 2px
  },
  chipsScrollContainer: {
    paddingLeft: SPACING.pageHorizontal,
    paddingRight: SPACING.sm,
    alignItems: 'center',
  },
  chip: {
    borderRadius: RADIUS.xl, // Increased from RADIUS.lg (16px) to RADIUS.xl (20px) for more rounded corners
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    minWidth: 70,
    maxWidth: getChipMaxWidth(), // Dynamic maxWidth based on screen size
    minHeight: 44, // Base height for inactive chips
  },
  chipActive: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.textDark,
    minHeight: 60, // Taller height for active chips with 2 lines
    paddingVertical: SPACING.md, // More padding for active chips
  },
  chipText: {
    ...bodyText,
    color: COLORS.textMuted,
    fontSize: FONT.size.body,
    lineHeight: 19,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  chipTextActive: {
    color: COLORS.textDark,
    fontSize: FONT.size.sectionHeader, // Larger text for active chips
    lineHeight: 22, // Adjusted line height for larger text
  },


  // Popup styles
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80, // Position below the status bar and recipe switcher
  },
  popupContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, // Increased from RADIUS.md (12px) to RADIUS.lg (16px) for more rounded corners
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.pageHorizontal,
    maxWidth: '90%',
    ...SHADOWS.large,
    position: 'relative',
  },
  popupText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
}); 