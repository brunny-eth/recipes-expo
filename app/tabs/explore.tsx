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
import AsyncStorage from '@react-native-async-storage/async-storage';
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



// Remove the DevTools component and the divider
// const DevTools = () => {
//   if (!__DEV__) {
//     return null;
//   }

//   const { resetFreeRecipeUsage, hasUsedFreeRecipe } = useFreeUsage();

//   const clearExploreCache = async () => {
//     try {
//       await Promise.all([
//         AsyncStorage.removeItem('exploreLastFetched'),
//         AsyncStorage.removeItem('exploreRecipes')
//       ]);
//       console.log('[DevTools] Cleared explore cache (timestamp and recipes)');
//       alert('Explore cache cleared! Next tab switch will fetch fresh recipes.');
//     } catch (error) {
//       console.error('[DevTools] Failed to clear explore cache:', error);
//       alert('Failed to clear cache');
//     }
//   };

//   return (
//     <>
//       <View style={styles.devToolsContainer}>
//         <Text style={styles.devToolsTitle}>Dev Tools</Text>
//         <Text>Has Used Free Recipe: {String(hasUsedFreeRecipe)}</Text>
//         <TouchableOpacity style={styles.devButton} onPress={resetFreeRecipeUsage}>
//           <Text style={styles.devButtonText}>Reset Free Usage</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.devButton} onPress={clearExploreCache}>
//           <Text style={styles.devButtonText}>Clear Explore Cache</Text>
//         </TouchableOpacity>
//       </View>
//       <View style={styles.divider} />
//     </>
//   );
// };

const ExploreScreen = () => {
  const insets = useSafeAreaInsets();
  const { hasUsedFreeRecipe, isLoadingFreeUsage, resetFreeRecipeUsage } = useFreeUsage();
  const { session, isAuthenticated } = useAuth();
  const { showError } = useErrorModal();
  
  // State for explore recipes
  const [exploreRecipes, setExploreRecipes] = useState<ParsedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[ExploreScreen] Component DID MOUNT');
    return () => {
      console.log('[ExploreScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Load cached recipes from AsyncStorage
  const loadCachedRecipes = useCallback(async (): Promise<{ recipes: ParsedRecipe[] | null; shouldFetch: boolean }> => {
    try {
      const [lastFetchedStr, cachedRecipesStr] = await Promise.all([
        AsyncStorage.getItem('exploreLastFetched'),
        AsyncStorage.getItem('exploreRecipes')
      ]);

      // No cached data at all
      if (!lastFetchedStr || !cachedRecipesStr) {
        console.log('[ExploreScreen] No cached data found - will fetch');
        return { recipes: null, shouldFetch: true };
      }

      // Check if cache is fresh
      const lastFetched = parseInt(lastFetchedStr, 10);
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
      const timeSinceLastFetch = now - lastFetched;

      if (timeSinceLastFetch >= sixHours) {
        console.log(`[ExploreScreen] Cache expired (${Math.round(timeSinceLastFetch / (60 * 60 * 1000))}h old) - will fetch`);
        return { recipes: null, shouldFetch: true };
      }

      // Cache is fresh, parse and return recipes
      try {
        const recipes = JSON.parse(cachedRecipesStr) as ParsedRecipe[];
        const hoursLeft = Math.round((sixHours - timeSinceLastFetch) / (60 * 60 * 1000) * 10) / 10;
        console.log(`[ExploreScreen] Using cached recipes (${recipes.length} recipes, ${hoursLeft}h left)`);
        return { recipes, shouldFetch: false };
      } catch (parseError) {
        console.error('[ExploreScreen] Error parsing cached recipes - will fetch:', parseError);
        return { recipes: null, shouldFetch: true };
      }
    } catch (error) {
      console.error('[ExploreScreen] Error loading cached recipes - will fetch as fallback:', error);
      return { recipes: null, shouldFetch: true };
    }
  }, []);

  // Fetch explore recipes from API
  const fetchExploreRecipesFromAPI = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: ExploreScreen] Start fetchExploreRecipesFromAPI at ${startTime.toFixed(2)}ms`);

    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('[ExploreScreen] EXPO_PUBLIC_API_URL is not set.');
      setError('API configuration error. Please check your environment variables.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = `${backendUrl}/api/recipes/explore-random`;
      console.log(`[ExploreScreen] Fetching from: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch explore recipes: ${response.statusText}`);
      }

      const recipes = await response.json();
      console.log(`[ExploreScreen] Fetched ${recipes?.length || 0} explore recipes from API.`);
      
      setExploreRecipes(recipes || []);
      
      // Store both timestamp and recipe data
      try {
        const now = Date.now().toString();
        await Promise.all([
          AsyncStorage.setItem('exploreLastFetched', now),
          AsyncStorage.setItem('exploreRecipes', JSON.stringify(recipes || []))
        ]);
        console.log('[ExploreScreen] Stored fetch timestamp and recipe data');
      } catch (storageError) {
        console.warn('[ExploreScreen] Failed to store cache data:', storageError);
        // Don't throw - this is not critical
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load explore recipes';
      console.error('[ExploreScreen] Error fetching explore recipes:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      const totalTime = performance.now() - startTime;
      console.log(`[PERF: ExploreScreen] Total fetchExploreRecipesFromAPI duration: ${totalTime.toFixed(2)}ms`);
    }
  }, []);

  // Main fetch function with AsyncStorage caching
  const fetchExploreRecipes = useCallback(async () => {
    console.log('[ExploreScreen] fetchExploreRecipes called - checking cache');
    
    const { recipes, shouldFetch } = await loadCachedRecipes();
    
    if (!shouldFetch && recipes) {
      // Use cached recipes immediately
      console.log('[ExploreScreen] Using cached recipes - no fetch needed');
      setExploreRecipes(recipes);
      setIsLoading(false);
      return;
    }

    // Need to fetch fresh data
    console.log('[ExploreScreen] Cache miss or expired - fetching fresh data');
    await fetchExploreRecipesFromAPI();
  }, [loadCachedRecipes, fetchExploreRecipesFromAPI]);

  // Fetch recipes on component mount and focus
  useEffect(() => {
    fetchExploreRecipes();
  }, [fetchExploreRecipes]);

  // Focus effect for navigation-aware caching
  useFocusEffect(
    useCallback(() => {
      console.log('[ExploreScreen] 🎯 useFocusEffect triggered');
      console.log('[ExploreScreen] 👁️ Screen focused');

      // Check cache when screen comes into focus (but don't double-fetch on mount)
      // The useEffect above handles the initial mount
      
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
    const itemId = item.id || 'unknown'; // Use a fallback key if item.id is undefined
    const hasImageError = imageErrors[itemId];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleRecipePress(item)}
      >
        <FastImage
          source={{ uri: hasImageError ? require('@/assets/images/meez_logo.webp') : imageUrl }}
          style={styles.cardImage}
          onLoad={() => setImageErrors((prev) => ({ ...prev, [itemId]: false }))}
          onError={() => {
            setImageErrors((prev) => ({ ...prev, [itemId]: true }));
            handleImageError(item.title || 'Unknown Recipe');
          }}
        />
        <View style={styles.cardTextContainer}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleRecipePress, handleImageError, imageErrors]);



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
            onPress={fetchExploreRecipesFromAPI}
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
      <ScreenHeader title="Find new recipes" />

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
    backgroundColor: COLORS.primary, // Set the entire card background to burnt orange
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
    width: '100%',
    height: 200, // Increase the height to make images slightly bigger
    borderTopLeftRadius: RADIUS.md, // Use a valid radius value
    borderTopRightRadius: RADIUS.md, // Use a valid radius value
  },
  cardTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary, // Use burnt orange color
    padding: SPACING.sm,
  },
  cardTitle: {
    color: COLORS.white,
    ...bodyStrongText,
    fontSize: FONT.size.body - 2, // Make the text slightly smaller
  },
  devToolsContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.smMd,
    marginHorizontal: SPACING.pageHorizontal,
    marginVertical: SPACING.smMd,
    borderRadius: 5,
    alignItems: 'center',
  } as ViewStyle,
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.md,
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
