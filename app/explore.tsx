import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, screenTitleText, FONT, metaText } from '@/constants/typography';
import ScreenHeader from '@/components/ScreenHeader';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { useAnalytics } from '@/utils/analytics';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { track } = useAnalytics();
  const [recipes, setRecipes] = useState<ParsedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const handleImageError = useCallback((recipeId: number) => {
    setImageErrors(prev => ({ ...prev, [String(recipeId)]: true }));
  }, []);

  const loadCached = useCallback(async () => {
    try {
      const [lastFetchedStr, cachedRecipesStr] = await Promise.all([
        AsyncStorage.getItem('libraryExploreLastFetched'),
        AsyncStorage.getItem('libraryExploreRecipes'),
      ]);
      if (!lastFetchedStr || !cachedRecipesStr) return { recipes: null, shouldFetch: true } as const;
      const lastFetched = parseInt(lastFetchedStr, 10);
      const sixHours = 6 * 60 * 60 * 1000;
      if (Date.now() - lastFetched >= sixHours) return { recipes: null, shouldFetch: true } as const;
      const parsed = JSON.parse(cachedRecipesStr) as ParsedRecipe[];
      if (!parsed || parsed.length === 0) return { recipes: null, shouldFetch: true } as const;
      return { recipes: parsed, shouldFetch: false } as const;
    } catch {
      return { recipes: null, shouldFetch: true } as const;
    }
  }, []);

  const fetchFromAPI = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setIsLoading(true);
    setError(null);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/recipes/explore-random`);
      if (!response.ok) throw new Error('Failed to fetch explore recipes');
      const data = await response.json();
      setRecipes(data || []);
      await Promise.all([
        AsyncStorage.setItem('libraryExploreLastFetched', Date.now().toString()),
        AsyncStorage.setItem('libraryExploreRecipes', JSON.stringify(data || [])),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load explore recipes');
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const cached = await loadCached();
      if (cached.recipes && !cached.shouldFetch) {
        setRecipes(cached.recipes);
        setIsLoading(false);
      } else {
        fetchFromAPI(false);
      }
    })();
  }, [loadCached, fetchFromAPI]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFromAPI(true);
    await new Promise(r => setTimeout(r, 300));
    setRefreshing(false);
  }, [fetchFromAPI]);

  const navigateToRecipe = useCallback(async (recipe: ParsedRecipe) => {
    try { await track('input_mode_selected', { inputType: 'explore' }); } catch {}
    router.push({ pathname: '/recipe/summary', params: { recipeData: JSON.stringify(recipe), entryPoint: 'library' } });
  }, [router, track]);

  const renderItem = useCallback(({ item }: { item: ParsedRecipe }) => {
    const imageUrl = item.image || item.thumbnailUrl;
    const hasImageError = imageErrors[String(item.id)];
    return (
      <TouchableOpacity style={styles.exploreCard} onPress={() => navigateToRecipe(item)}>
        <View style={styles.imageContainer}>
          {imageUrl && !hasImageError ? (
            <FastImage source={{ uri: imageUrl }} style={styles.exploreCardImage} onError={() => handleImageError(item.id || 0)} />
          ) : (
            <FastImage source={require('@/assets/images/meezblue_underline.webp')} style={styles.exploreCardImage} />
          )}
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.exploreCardTitle} numberOfLines={3}>{item.title}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigateToRecipe, handleImageError, imageErrors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>        
      <ScreenHeader title="Explore recipes" showBack={true} />
      {isLoading ? (
        <ActivityIndicator style={styles.centered} size="large" color={COLORS.primary} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchFromAPI(false)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
          initialNumToRender={10}
          windowSize={21}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { paddingTop: SPACING.sm },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl },
  errorText: { ...bodyText, color: COLORS.error, textAlign: 'center', marginBottom: SPACING.lg },
  retryButton: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: RADIUS.sm },
  retryButtonText: { ...bodyStrongText, color: COLORS.white },
  exploreCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.sm, marginBottom: SPACING.md, height: 120, overflow: 'hidden' },
  imageContainer: { width: '40%', height: '100%', borderRadius: RADIUS.md, overflow: 'hidden' },
  exploreCardImage: { width: '100%', height: '100%' },
  titleContainer: { width: '60%', height: '100%', paddingLeft: SPACING.md, paddingRight: SPACING.sm, justifyContent: 'center', backgroundColor: COLORS.white },
  exploreCardTitle: { color: COLORS.textDark, ...bodyStrongText, fontSize: FONT.size.body, lineHeight: FONT.size.body * 1.3 },
});

