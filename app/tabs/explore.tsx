import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';
import { useFreeUsage } from '@/context/FreeUsageContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { bodyText, screenTitleText, FONT, bodyStrongText } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import ScreenHeader from '@/components/ScreenHeader';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';



const DevTools = () => {
  if (!__DEV__) {
    return null;
  }

  const { resetFreeRecipeUsage, hasUsedFreeRecipe } = useFreeUsage();

  const handleFullReset = async () => {
    await supabase.auth.signOut();
    await resetFreeRecipeUsage();
    router.replace('/login');
  };

  return (
    <View style={styles.devToolsContainer}>
      <Text style={styles.devToolsTitle}>Dev Tools</Text>
      <Text>Has Used Free Recipe: {String(hasUsedFreeRecipe)}</Text>
      <TouchableOpacity style={styles.devButton} onPress={resetFreeRecipeUsage}>
        <Text style={styles.devButtonText}>Reset Free Usage</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.devButton} onPress={handleFullReset}>
        <Text style={styles.devButtonText}>Start Fresh (Sign Out & Reset)</Text>
      </TouchableOpacity>
    </View>
  );
};

const ExploreScreen = () => {
  const insets = useSafeAreaInsets();
  const { hasUsedFreeRecipe, isLoadingFreeUsage, resetFreeRecipeUsage } = useFreeUsage();
  const { session, isAuthenticated } = useAuth();
  const { showError } = useErrorModal();
  
  // State for explore recipes
  const [exploreRecipes, setExploreRecipes] = useState<ParsedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[ExploreScreen] Component DID MOUNT');
    return () => {
      console.log('[ExploreScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Fetch explore recipes on mount
  const fetchExploreRecipes = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: ExploreScreen] Start fetchExploreRecipes at ${startTime.toFixed(2)}ms`);

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/recipes/explore-random');
      if (!response.ok) {
        throw new Error(`Failed to fetch explore recipes: ${response.statusText}`);
      }

      const recipes = await response.json();
      console.log(`[ExploreScreen] Fetched ${recipes?.length || 0} explore recipes from API.`);
      
      setExploreRecipes(recipes || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load explore recipes';
      console.error('[ExploreScreen] Error fetching explore recipes:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      const totalTime = performance.now() - startTime;
      console.log(`[PERF: ExploreScreen] Total fetchExploreRecipes duration: ${totalTime.toFixed(2)}ms`);
    }
  }, []);

  // Fetch recipes on component mount
  useEffect(() => {
    fetchExploreRecipes();
  }, [fetchExploreRecipes]);

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      console.log('[ExploreScreen] 🎯 useFocusEffect triggered');
      console.log('[ExploreScreen] 👁️ Screen focused');

      return () => {
        console.log('[ExploreScreen] 🌀 useFocusEffect cleanup');
        console.log('[ExploreScreen] 🌀 Screen is blurring (not necessarily unmounting)');
      };
    }, [])
  );

  // Handle recipe press - same pattern as saved.tsx
  const handleRecipePress = useCallback((recipe: ParsedRecipe) => {
    console.log(`[ExploreScreen] Opening recipe: ${recipe.title}`, {
      id: recipe.id,
    });

    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeData: JSON.stringify(recipe),
        from: '/explore',
      },
    });
  }, []);

  // Stable callbacks for image loading to prevent re-renders
  const handleImageLoad = useCallback((recipeName: string) => {
    // Image loaded successfully
  }, []);

  const handleImageError = useCallback((recipeName: string) => {
    console.error(`[ExploreScreen] Image failed to load for recipe: ${recipeName}`);
  }, []);

  // Render recipe item - same pattern as saved.tsx
  const renderRecipeItem = useCallback(({ item }: { item: ParsedRecipe }) => {
    const imageUrl = item.image || item.thumbnailUrl;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleRecipePress(item)}
      >
        {imageUrl && (
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            onLoad={() => handleImageLoad(item.title || 'Unknown Recipe')}
            onError={() => handleImageError(item.title || 'Unknown Recipe')}
          />
        )}
        <View style={styles.cardTextContainer}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleRecipePress, handleImageLoad, handleImageError]);

  const handleResetFreeUsage = async () => {
    console.log('[Dev Tools] Attempting to reset free recipe usage...');
    await resetFreeRecipeUsage();
    console.log('[Dev Tools] Free recipe usage has been reset.');
    alert('Free recipe usage has been reset!');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <ActivityIndicator
          style={styles.centered}
          size="large"
          color={COLORS.primary}
        />
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Couldn't load recipes</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchExploreRecipes}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (exploreRecipes.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="food-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>No recipes found</Text>
          <Text style={styles.emptySubtext}>
            We couldn't find any recipes to explore right now.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={exploreRecipes}
        renderItem={renderRecipeItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        windowSize={21}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => (
          { length: 85, offset: 85 * index, index } // Approximate item height
        )}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Explore Recipes" />

      <DevTools />

      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  listContentContainer: {
    paddingBottom: SPACING.pageHorizontal,
  } as ViewStyle,
  listContent: {
    paddingTop: SPACING.sm,
  } as ViewStyle,
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  } as ViewStyle,
  emptyText: {
    fontFamily: FONT.family.recoleta,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  } as TextStyle,
  emptySubtext: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
  } as TextStyle,
  retryButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  retryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  } as ViewStyle,
  cardImage: {
    width: SPACING.xxl,
    height: SPACING.xxl,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  cardTextContainer: {
    flex: 1,
  } as ViewStyle,
  cardTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  devToolsContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.smMd,
    marginHorizontal: SPACING.pageHorizontal,
    marginVertical: SPACING.smMd,
    borderRadius: 5,
    alignItems: 'center',
  } as ViewStyle,
  devToolsTitle: {
    fontWeight: FONT.weight.semiBold,
    fontSize: FONT.size.body,
    marginBottom: 5,
  } as TextStyle,
  devButton: {
    backgroundColor: COLORS.warning,
    padding: SPACING.smMd,
    borderRadius: 5,
    marginTop: 5,
  } as ViewStyle,
  devButtonText: {
    color: COLORS.black,
  } as TextStyle,
  recipeItem: {
    height: 120,
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    padding: SPACING.smMd,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  recipeTitle: {
    fontWeight: FONT.weight.semiBold,
  } as TextStyle,
});

export default ExploreScreen;
