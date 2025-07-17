import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  screenTitleText,
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  FONT,
} from '@/constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { parseServingsValue } from '@/utils/recipeUtils';
import ScreenHeader from '@/components/ScreenHeader';

type SavedRecipe = {
  base_recipe_id: number;
  title_override: string | null;
  applied_changes: any | null; // JSON object with ingredient changes and scaling
  original_recipe_data: ParsedRecipe | null; // Original recipe data for consistent scaling
  processed_recipes_cache: {
    id: number;
    recipe_data: ParsedRecipe;
    source_type: string | null; // "user_modified" for modified recipes
    parent_recipe_id: number | null;
  } | null;
};

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[SavedScreen] Component DID MOUNT');
    return () => {
      console.log('[SavedScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Stable fetchSavedRecipes function
  const fetchSavedRecipes = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: SavedScreen] Start fetchSavedRecipes at ${startTime.toFixed(2)}ms`);

    if (!session?.user) {
      console.warn('[SavedScreen] No user session found. Skipping fetch.');
      setIsLoading(false);
      setSavedRecipes([]); // Clear recipes if user logs out
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const dbQueryStart = performance.now();
    console.log(`[PERF: SavedScreen] Starting Supabase query at ${dbQueryStart.toFixed(2)}ms`);

    const { data, error: fetchError } = await supabase
      .from('user_saved_recipes')
      .select(
        `
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
      `,
      )
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }); // Show newest saves first

    const dbQueryEnd = performance.now();
    console.log(`[PERF: SavedScreen] Supabase query finished in ${(dbQueryEnd - dbQueryStart).toFixed(2)}ms`);
    
    if (fetchError) {
      console.error(
        '[SavedScreen] Error fetching saved recipes:',
        fetchError,
      );
      setError('Could not load saved recipes. Please try again.');
    } else {
      const processingStart = performance.now();
      console.log(`[PERF: SavedScreen] Starting data processing at ${processingStart.toFixed(2)}ms`);
      console.log(
        `[SavedScreen] Fetched ${data?.length || 0} saved recipes from DB.`,
      );
      console.log('Fetched recipes:', data?.length || 0, 'items'); // DEBUG: Track fetch results

      // The linter is struggling with the joined type. We cast to 'any' and then to our expected type.
      // This is safe as long as the RLS and DB schema are correct.
      const validRecipes =
        ((data as any[])?.filter(
          (r) => r.processed_recipes_cache?.recipe_data,
        ) as SavedRecipe[]) || [];

      setSavedRecipes(validRecipes);
      const processingEnd = performance.now();
      console.log(`[PERF: SavedScreen] Data processing and state update took ${(processingEnd - processingStart).toFixed(2)}ms`);
    }

    const finalStateUpdateStart = performance.now();
    setIsLoading(false);
    const finalStateUpdateEnd = performance.now();
    console.log(`[PERF: SavedScreen] setIsLoading(false) took ${(finalStateUpdateEnd - finalStateUpdateStart).toFixed(2)}ms`);
    
    const totalTime = performance.now() - startTime;
    console.log(`[PERF: SavedScreen] Total fetchSavedRecipes duration: ${totalTime.toFixed(2)}ms`);
  }, [session?.user?.id]); // Only recreate when user ID changes

  // Mount stability detection to differentiate between focus and remount
  const mountIdRef = useRef(Math.random());
  const lastMountId = useRef(mountIdRef.current);
  
  // Improved caching strategy
  const lastFetchTimeRef = useRef(0);
  const lastSessionIdRef = useRef<string | null>(null);
  const CACHE_DURATION_MS = 30000; // Cache data for 30 seconds
  const DEBOUNCE_MS = 500; // Prevent calls within 500ms of each other

  // Optimized useFocusEffect with smart caching
  useFocusEffect(
    useCallback(() => {
      const now = performance.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      const currentMountId = mountIdRef.current;
      const currentSessionId = session?.user?.id || null;
      
      console.log('[SavedScreen] 🎯 useFocusEffect triggered for:', currentSessionId);
      
      // Check if this is a remount vs just a focus event
      const isRemount = currentMountId !== lastMountId.current;
      const isSessionChange = currentSessionId !== lastSessionIdRef.current;
      const isCacheExpired = timeSinceLastFetch > CACHE_DURATION_MS;
      const isDebounced = timeSinceLastFetch < DEBOUNCE_MS;
      
      if (isRemount) {
        console.log('[SavedScreen] 🔄 Screen remounted - full refetch needed');
        lastMountId.current = currentMountId;
      } else if (isDebounced && !isSessionChange) {
        console.log('[SavedScreen] 🚫 DEBOUNCED: Ignoring rapid successive focus without significant changes');
        return () => {
          console.log('[SavedScreen] 🌀 useFocusEffect cleanup (debounced focus)');
        };
      } else if (isSessionChange) {
        console.log('[SavedScreen] 👤 Session changed - refetch needed');
      } else if (isCacheExpired) {
        console.log('[SavedScreen] ⏰ Cache expired - refetch needed');
      } else if (savedRecipes.length === 0) {
        console.log('[SavedScreen] 💾 No cached data - initial fetch needed');
      } else {
        console.log('[SavedScreen] ✅ Using cached data - no refetch needed');
        return () => {
          console.log('[SavedScreen] 🌀 useFocusEffect cleanup (cached data used)');
        };
      }
      
      // Update tracking variables
      lastFetchTimeRef.current = now;
      lastSessionIdRef.current = currentSessionId;
      
      if (!currentSessionId) {
        console.warn('[SavedScreen] No user session found. Skipping fetch.');
        setIsLoading(false);
        setSavedRecipes([]);
        return () => {
          console.log('[SavedScreen] 🌀 useFocusEffect cleanup (no session)');
        };
      }

      console.log('✅ Fetching saved recipes initiated...');
        
      // Inline async function to avoid dependencies
      (async () => {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_saved_recipes')
          .select(
            `
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
          `,
          )
          .eq('user_id', currentSessionId)
          .order('created_at', { ascending: false });
        
        if (fetchError) {
          console.error('[SavedScreen] Error fetching saved recipes:', fetchError);
          setError('Could not load saved recipes. Please try again.');
        } else {
          console.log(`[SavedScreen] Fetched ${data?.length || 0} saved recipes from DB.`);

          const validRecipes =
            ((data as any[])?.filter(
              (r) => r.processed_recipes_cache?.recipe_data,
            ) as SavedRecipe[]) || [];

          setSavedRecipes(validRecipes);
        }

        setIsLoading(false);
      })();
      
      // Return cleanup function to log blur events
      return () => {
        console.log('[SavedScreen] 🌀 useFocusEffect cleanup');
        console.log('[SavedScreen] 🌀 Screen is blurring (not necessarily unmounting)');
      };
    }, [session?.user?.id, savedRecipes.length]) // Add savedRecipes.length to prevent unnecessary fetches when data exists
  );

  const handleRecipePress = useCallback((item: SavedRecipe) => {
    // Ensure data exists before proceeding
    if (!item.processed_recipes_cache?.recipe_data) {
        console.warn('[SavedScreen] Missing recipe data for navigation:', item);
        return;
    }

    const { recipe_data, source_type } = item.processed_recipes_cache;
    const isModified = source_type === 'user_modified';
    const displayTitle = item.title_override || recipe_data.title;
    
    // Create a complete recipe object by merging the ID with the recipe_data
    const recipeWithId = {
        ...recipe_data,
        id: item.processed_recipes_cache.id,
        // For modified recipes, override the title if we have a title_override
        ...(isModified && item.title_override && { title: item.title_override }),
    };

    console.log(`[SavedScreen] Opening recipe: ${displayTitle}`, {
      id: recipeWithId.id,
      isModified,
      hasAppliedChanges: !!item.applied_changes,
    });

    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeData: JSON.stringify(recipeWithId), 
        entryPoint: 'saved',
        from: '/saved',
        isModified: isModified.toString(),
        // Pass title_override for correct title display
        ...(item.title_override && {
          titleOverride: item.title_override
        }),
        ...(isModified && item.applied_changes && {
          appliedChanges: JSON.stringify(item.applied_changes)
        }),
        ...(item.original_recipe_data && {
          originalRecipeData: JSON.stringify(item.original_recipe_data)
        }),
      },
    });
  }, [router]);

  const handleDeleteRecipe = useCallback(async (baseRecipeId: number) => {
    if (!session?.user) {
      console.warn('[SavedScreen] No user session found. Cannot delete recipe.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from('user_saved_recipes')
      .delete()
      .eq('user_id', session.user.id)
      .eq('base_recipe_id', baseRecipeId);

    if (deleteError) {
      console.error('[SavedScreen] Error deleting saved recipe:', deleteError);
      setError('Failed to unsave recipe. Please try again.');
    } else {
      console.log(`[SavedScreen] Recipe with base_recipe_id ${baseRecipeId} unsaved.`);
      setSavedRecipes(prev => prev.filter(recipe => recipe.base_recipe_id !== baseRecipeId));
    }
    setIsLoading(false);
  }, [session?.user]);

  // Stable callbacks for image loading to prevent re-renders
  const handleImageLoad = useCallback((recipeName: string) => {
    // Image loaded successfully
  }, []);

  const handleImageError = useCallback((recipeName: string) => {
    console.error(`[SavedScreen] Image failed to load for recipe: ${recipeName}`);
  }, []);

const renderRecipeItem = useCallback(({ item }: { item: SavedRecipe }) => {
  if (!item.processed_recipes_cache?.recipe_data) {
      console.warn(
          '[SavedScreen] Rendering a saved recipe item without complete data:',
          item,
      );
      return null; // Gracefully skip rendering this item
  }

  const { recipe_data, source_type } = item.processed_recipes_cache;
  const imageUrl = recipe_data.image || recipe_data.thumbnailUrl;
  const isModified = source_type === 'user_modified';
  
  // Use title_override if available (for modified recipes), otherwise use original title
  const displayTitle = item.title_override || recipe_data.title;

  // Note: Removed excessive debug logging to improve performance

  return (
      <TouchableOpacity
          style={[styles.card, styles.cardWithMinHeight]} // Add min height style
          onPress={() => handleRecipePress(item)}
      >
          {imageUrl && (
            <FastImage
              source={{ uri: imageUrl }}
              style={styles.cardImage}
              onLoad={() => handleImageLoad(displayTitle || 'Unknown Recipe')}
              onError={() => handleImageError(displayTitle || 'Unknown Recipe')}
            />
          )}
          <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                  {displayTitle}
              </Text>
              {(() => {
                const servingsCount = parseServingsValue(recipe_data.recipeYield);
                return servingsCount ? (
                  <Text style={styles.servingsText}>(servings: {servingsCount})</Text>
                ) : null;
              })()}
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteRecipe(item.base_recipe_id)}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
      </TouchableOpacity>
  );
}, [handleRecipePress, handleImageLoad, handleImageError, handleDeleteRecipe]);

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

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="login"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Log in to see your favorites</Text>
          <Text style={styles.emptySubtext}>
            Your saved recipes will appear here once you're logged in.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
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
            You can save recipes directly from the recipe summary screen to build your recipe library. 
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={savedRecipes}
        renderItem={renderRecipeItem}
        keyExtractor={(item) => item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}
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
      <ScreenHeader title="Saved recipes" />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  },
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  emptyText: {
            fontFamily: FONT.family.libreBaskerville,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...bodyTextLoose,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  loginButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
  },
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  listContent: {
    paddingTop: SPACING.sm,
  },
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
  },
  cardWithMinHeight: {
    minHeight: 75, // Adjust this value based on the image
  },
  cardImage: {
    width: SPACING.xxl + 8,
    height: SPACING.xxl + 8,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    ...bodyStrongText,
    fontSize: FONT.size.body - 1,
    color: COLORS.textDark,
    lineHeight: 19,
    flexWrap: 'wrap',
  },
  servingsText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    fontWeight: '400',
    marginTop: SPACING.xs,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  deleteButton: {
    // Remove absolute positioning
    // position: 'absolute',
    // bottom: SPACING.md,
    // right: SPACING.md,
    padding: SPACING.xs,
    alignSelf: 'center', // Center vertically in row
  },
});