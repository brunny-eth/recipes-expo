import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ViewStyle,
  TextStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';
import { useFreeUsage } from '@/context/FreeUsageContext';
import { supabase } from '@/lib/supabaseClient';
import { bodyText, screenTitleText, FONT, bodyStrongText } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import ScreenHeader from '@/components/ScreenHeader';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { parseServingsValue } from '@/utils/recipeUtils';

// Types for saved recipes
type SavedRecipe = {
  base_recipe_id: number;
  title_override: string | null;
  applied_changes: any | null;
  original_recipe_data: ParsedRecipe | null;
  processed_recipes_cache: {
    id: number;
    recipe_data: ParsedRecipe;
    source_type: string | null;
    parent_recipe_id: number | null;
  } | null;
};

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hasUsedFreeRecipe, isLoadingFreeUsage } = useFreeUsage();
  const { session, isAuthenticated } = useAuth();
  const { showError } = useErrorModal();
  
  // Tab state
  const [selectedTab, setSelectedTab] = useState<'explore' | 'saved'>('explore');
  
  // Explore recipes state
  const [exploreRecipes, setExploreRecipes] = useState<ParsedRecipe[]>([]);
  const [isExploreLoading, setIsExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [refreshing, setRefreshing] = useState(false);
  
  // Saved recipes state
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[LibraryScreen] Component DID MOUNT');
    return () => {
      console.log('[LibraryScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Load cached explore recipes
  const loadCachedExploreRecipes = useCallback(async (): Promise<{ recipes: ParsedRecipe[] | null; shouldFetch: boolean }> => {
    try {
      const [lastFetchedStr, cachedRecipesStr] = await Promise.all([
        AsyncStorage.getItem('exploreLastFetched'),
        AsyncStorage.getItem('exploreRecipes')
      ]);

      if (!lastFetchedStr || !cachedRecipesStr) {
        console.log('[LibraryScreen] No cached explore data found');
        return { recipes: null, shouldFetch: true };
      }

      const lastFetched = parseInt(lastFetchedStr, 10);
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetched;
      const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

      if (timeSinceLastFetch >= CACHE_DURATION) {
        console.log('[LibraryScreen] Explore cache expired');
        return { recipes: null, shouldFetch: true };
      }

      const recipes = JSON.parse(cachedRecipesStr) as ParsedRecipe[];
      console.log(`[LibraryScreen] Using cached explore recipes (${recipes.length} recipes)`);
      return { recipes, shouldFetch: false };
    } catch (error) {
      console.error('[LibraryScreen] Error loading cached explore data:', error);
      return { recipes: null, shouldFetch: true };
    }
  }, []);

  // Fetch explore recipes from API (matching original explore.tsx)
  const fetchExploreRecipes = useCallback(async () => {
    console.log('[LibraryScreen] Fetching explore recipes from API');
    
    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('[LibraryScreen] EXPO_PUBLIC_API_URL is not set.');
      setExploreError('API configuration error. Please check your environment variables.');
      setIsExploreLoading(false);
      return;
    }

    setIsExploreLoading(true);
    setExploreError(null);
    
    try {
      const apiUrl = `${backendUrl}/api/recipes/explore-random`;
      console.log(`[LibraryScreen] Fetching from: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch explore recipes: ${response.statusText}`);
      }

      const recipes = await response.json();
      console.log(`[LibraryScreen] Fetched ${recipes?.length || 0} explore recipes from API.`);
      
      setExploreRecipes(recipes || []);
      
      // Cache the results
      const now = Date.now().toString();
      await Promise.all([
        AsyncStorage.setItem('exploreLastFetched', now),
        AsyncStorage.setItem('exploreRecipes', JSON.stringify(recipes || []))
      ]);
      console.log('[LibraryScreen] Stored fetch timestamp and recipe data');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load explore recipes';
      console.error('[LibraryScreen] Error fetching explore recipes:', err);
      setExploreError(errorMessage);
    } finally {
      setIsExploreLoading(false);
    }
  }, []);

  // Load explore recipes
  const loadExploreRecipes = useCallback(async () => {
    const { recipes, shouldFetch } = await loadCachedExploreRecipes();
    
    if (!shouldFetch && recipes) {
      setExploreRecipes(recipes);
      setIsExploreLoading(false);
      return;
    }
    
    await fetchExploreRecipes();
  }, [loadCachedExploreRecipes, fetchExploreRecipes]);

  // Fetch saved recipes
  const fetchSavedRecipes = useCallback(async () => {
    console.log('[LibraryScreen] Fetching saved recipes');
    
    if (!session?.user) {
      console.log('[LibraryScreen] No user session for saved recipes');
      setIsSavedLoading(false);
      setSavedRecipes([]);
      return;
    }

    setIsSavedLoading(true);
    setSavedError(null);
    
    try {
      const { data, error } = await supabase
        .from('user_saved_recipes')
        .select(`
          base_recipe_id,
          title_override,
          applied_changes,
          original_recipe_data,
          processed_recipes_cache (
            id,
            recipe_data,
            source_type,
            parent_recipe_id
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const recipes = (data || []).map(item => ({
        ...item,
        processed_recipes_cache: Array.isArray(item.processed_recipes_cache) 
          ? item.processed_recipes_cache[0] || null 
          : item.processed_recipes_cache
      }));
      console.log(`[LibraryScreen] Fetched ${recipes.length} saved recipes`);
      setSavedRecipes(recipes);
      
    } catch (err) {
      console.error('[LibraryScreen] Error fetching saved recipes:', err);
      setSavedError('Failed to load saved recipes. Please try again.');
    } finally {
      setIsSavedLoading(false);
    }
  }, [session?.user]);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      console.log('[LibraryScreen] Focus effect triggered');
      loadExploreRecipes();
      fetchSavedRecipes();
    }, [loadExploreRecipes, fetchSavedRecipes])
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedTab === 'explore') {
      await fetchExploreRecipes();
    } else {
      await fetchSavedRecipes();
    }
    setRefreshing(false);
  }, [selectedTab, fetchExploreRecipes, fetchSavedRecipes]);

  // Handle image error
  const handleImageError = useCallback((recipeId: string) => {
    setImageErrors(prev => ({ ...prev, [recipeId]: true }));
  }, []);

  // Navigate to recipe
  const navigateToRecipe = useCallback((recipe: ParsedRecipe) => {
    console.log('[LibraryScreen] Navigating to recipe:', recipe.title);
    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeData: JSON.stringify(recipe),
        entryPoint: 'library',
      },
    });
  }, [router]);

  // Navigate to saved recipe
  const navigateToSavedRecipe = useCallback((savedRecipe: SavedRecipe) => {
    const recipeData = savedRecipe.processed_recipes_cache?.recipe_data;
    if (!recipeData) return;

    console.log('[LibraryScreen] Navigating to saved recipe:', recipeData.title);
    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeData: JSON.stringify(recipeData),
        entryPoint: 'saved',
        ...(savedRecipe.title_override && {
          titleOverride: savedRecipe.title_override
        }),
        ...(savedRecipe.applied_changes && {
          appliedChanges: JSON.stringify(savedRecipe.applied_changes)
        }),
        ...(savedRecipe.original_recipe_data && {
          originalRecipeData: JSON.stringify(savedRecipe.original_recipe_data)
        }),
      },
    });
  }, [router]);

  // Render explore recipe item
  const renderExploreItem = useCallback(({ item }: { item: ParsedRecipe }) => {
    const imageUrl = item.image || item.thumbnailUrl;
    const hasImageError = imageErrors[item.id?.toString() || ''];
    
    return (
      <TouchableOpacity
        style={styles.exploreCard}
        onPress={() => navigateToRecipe(item)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {imageUrl && !hasImageError ? (
            <FastImage
              source={{ uri: imageUrl }}
              style={styles.cardImage}
              onError={() => handleImageError(item.id?.toString() || '')}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={24}
                color={COLORS.textMuted}
              />
            </View>
          )}
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.exploreCardTitle} numberOfLines={3}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [imageErrors, navigateToRecipe, handleImageError]);

  // Render saved recipe item
  const renderSavedItem = useCallback(({ item }: { item: SavedRecipe }) => {
    const recipeData = item.processed_recipes_cache?.recipe_data;
    if (!recipeData) return null;

    const imageUrl = recipeData.image || recipeData.thumbnailUrl;
    const displayTitle = item.title_override || recipeData.title;
    const servingsCount = parseServingsValue(recipeData.recipeYield);

    return (
      <TouchableOpacity
        style={[styles.savedCard, styles.cardWithMinHeight]}
        onPress={() => navigateToSavedRecipe(item)}
        activeOpacity={0.7}
      >
        {imageUrl && (
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.savedCardImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.savedCardTextContainer}>
          <Text style={styles.savedCardTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          {servingsCount && (
            <Text style={styles.servingsText}>
              (servings: {servingsCount})
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [navigateToSavedRecipe]);

  // Render explore content
  const renderExploreContent = () => {
    if (isExploreLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (exploreError) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Couldn't load explore recipes</Text>
          <Text style={styles.emptySubtext}>{exploreError}</Text>
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
            name="book-open-variant"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>No recipes to explore</Text>
          <Text style={styles.emptySubtext}>
            Check back later for new recipes from the community.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={exploreRecipes}
        renderItem={renderExploreItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        initialNumToRender={10}
        windowSize={21}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => (
          { length: 120 + SPACING.md, offset: (120 + SPACING.md) * index, index }
        )}
      />
    );
  };

  // Render saved content
  const renderSavedContent = () => {
    if (isSavedLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="login"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Log in to see saved recipes</Text>
          <Text style={styles.emptySubtext}>
            Save recipes to build your personal recipe library.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.retryButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (savedError) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Couldn't load saved recipes</Text>
          <Text style={styles.emptySubtext}>{savedError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchSavedRecipes}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (savedRecipes.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="heart-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>No saved recipes yet</Text>
          <Text style={styles.emptySubtext}>
            Save recipes from the recipe summary screen to build your library.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={savedRecipes}
        renderItem={renderSavedItem}
        keyExtractor={(item) => item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        initialNumToRender={10}
        windowSize={21}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => (
          { length: 85, offset: 85 * index, index }
        )}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Recipe library" />
      
      {/* Tab selector - matching mise.tsx pattern */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'explore' && styles.tabButtonActive
          ]}
          onPress={() => setSelectedTab('explore')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'explore' && styles.tabButtonTextActive
          ]}>
            Explore ({exploreRecipes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'saved' && styles.tabButtonActive
          ]}
          onPress={() => setSelectedTab('saved')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'saved' && styles.tabButtonTextActive
          ]}>
            Saved ({savedRecipes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Subheading for explore tab */}
      {selectedTab === 'explore' && (
        <Text style={styles.subheading}>
          Recipes the Meez community is cooking right now.
        </Text>
      )}

      {/* Content */}
      {selectedTab === 'explore' ? renderExploreContent() : renderSavedContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  
  // Tab styles - matching mise.tsx
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 999, // Fully rounded pill shape
    padding: 4,
    marginBottom: SPACING.md,
  } as ViewStyle,
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 999, // Fully rounded pill shape
    backgroundColor: COLORS.white, // White background for inactive tabs
  } as ViewStyle,
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  } as ViewStyle,
  tabButtonText: {
    ...bodyStrongText,
    color: COLORS.primary, // Burnt orange text for inactive tabs
  } as TextStyle,
  tabButtonTextActive: {
    color: COLORS.white,
  } as TextStyle,
  
  // Content styles
  listContent: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.pageHorizontal,
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
    fontFamily: FONT.family.libreBaskerville,
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
  subheading: {
    ...bodyText,
    fontSize: FONT.size.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
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
  
  // Explore card styles
  exploreCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120,
    overflow: 'hidden',
  } as ViewStyle,
  imageContainer: {
    width: '40%',
    height: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  } as ViewStyle,
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  titleContainer: {
    width: '60%',
    height: '100%',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  } as ViewStyle,
  exploreCardTitle: {
    color: COLORS.textDark,
    ...bodyStrongText,
    fontSize: FONT.size.body,
    lineHeight: FONT.size.body * 1.3,
  } as TextStyle,
  
  // Saved card styles
  savedCard: {
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
  cardWithMinHeight: {
    minHeight: 75,
  } as ViewStyle,
  savedCardImage: {
    width: SPACING.xxl + 8,
    height: SPACING.xxl + 8,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  savedCardTextContainer: {
    flex: 1,
  } as ViewStyle,
  savedCardTitle: {
    ...bodyStrongText,
    fontSize: FONT.size.body - 1,
    color: COLORS.textDark,
    lineHeight: 19,
    flexWrap: 'wrap',
  } as TextStyle,
  servingsText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    fontWeight: '400',
    marginTop: SPACING.xs,
  } as TextStyle,
}); 