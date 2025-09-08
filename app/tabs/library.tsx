import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  ActivityIndicator,
  RefreshControl,
  ViewStyle,
  TextStyle,
  TextInput,
  Alert,
  Modal,
  Keyboard,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH, SHADOWS } from '@/constants/theme';

import { bodyText, screenTitleText, FONT, bodyStrongText, captionText, metaText } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import ScreenHeader from '@/components/ScreenHeader';
import AddNewFolderModal from '@/components/AddNewFolderModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { useAnalytics } from '@/utils/analytics';
import { useRenderCounter } from '@/hooks/useRenderCounter';
import { useHandleError } from '@/hooks/useHandleError';

// Types for folders
type SavedFolder = {
  id: number;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  recipe_count: number;
};

// Types for saved recipes
type SavedRecipe = {
  id: string;
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
  display_order: number;
};

// Predefined folder colors (9 gradient hues) - Teal/Cyan theme (lighter tones only)
const FOLDER_COLORS = [
  '#F0F8F8', // Very light teal mist
  '#E0F2F1', // Light teal mint
  '#D1EDE9', // Soft teal cream
  '#B2DFDB', // Gentle teal
  '#A7D7D2', // Light medium teal
  '#9CCFC9', // Soft medium teal
  '#80CBC4', // Light rich teal
  '#6BBFB7', // Gentle rich teal
  '#4DB6AC', // Medium teal (still light)
];

// Helpers for client-side search (same as in folder-detail.tsx)
function normalizeForSearch(text: string): string {
  return text
    ? text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim()
    : '';
}

function buildSearchBlob(item: SavedRecipe): string {
  const data = item.processed_recipes_cache?.recipe_data;
  if (!data) return '';

  const title = item.title_override || data.title || '';
  const ingredientNames = (data.ingredientGroups || []).flatMap((group) =>
    (group.ingredients || []).map((ing) => [ing.name, ing.preparation].filter(Boolean).join(' ')),
  );

  return normalizeForSearch([title, ...ingredientNames].join(' '));
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { session } = useAuth();
  useRenderCounter('LibraryScreen', { hasSession: !!session });
  const { showError } = useErrorModal();
  const handleError = useHandleError();
  const { track } = useAnalytics();
  
  // Tab state
  const [selectedTab, setSelectedTab] = useState<'explore' | 'saved'>(
    params?.tab === 'saved' ? 'saved' : 'explore'
  );

  // Keep selected tab in sync with route params even if the screen stays mounted
  useEffect(() => {
    if (params?.tab === 'saved') {
      setSelectedTab('saved');
    } else if (params?.tab === 'explore') {
      setSelectedTab('explore');
    }
  }, [params?.tab]);
  
  // Explore recipes state
  const [exploreRecipes, setExploreRecipes] = useState<ParsedRecipe[]>([]);
  const [isExploreLoading, setIsExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [refreshing, setRefreshing] = useState(false);
  
  // Saved folders state
  const [savedFolders, setSavedFolders] = useState<SavedFolder[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  
  // Search state for saved recipes
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // Prevent flicker during navigation
  
  // Add new folder modal state
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  
  // Confirmation modal state
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<SavedFolder | null>(null);

  // Color picker modal state
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<SavedFolder | null>(null);
  const [isUpdatingColor, setIsUpdatingColor] = useState(false);

  // Debounce search input (200ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // SEARCH button active state (matches folder-detail.tsx pattern)
  const isSearchButtonActive = isSearchActive;

  // Toggle search
  const toggleSearch = useCallback(() => {
    setIsSearchActive(prev => {
      if (prev) {
        // When hiding search, clear the search query
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  // Build indexed list for search
  const indexedRecipes = useMemo(() => {
    return savedRecipes.map((r) => ({ recipe: r, blob: buildSearchBlob(r) }));
  }, [savedRecipes]);

  // Filtered recipes based on query
  const filteredRecipes = useMemo(() => {
    const q = normalizeForSearch(debouncedSearchQuery);
    if (!q) return savedRecipes;
    const tokens = q.split(' ').filter(Boolean);
    return indexedRecipes
      .filter((ir) => tokens.every((t) => ir.blob.includes(t)))
      .map((ir) => ir.recipe);
  }, [debouncedSearchQuery, savedRecipes, indexedRecipes]);

  // Update folder color
  const updateFolderColor = useCallback(async (folderId: number, newColor: string) => {
    if (!session?.user) return;
    
    setIsUpdatingColor(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: session.user.id,
          color: newColor 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update folder color');
      }

      // Update local state
      setSavedFolders(prev => 
        prev.map(folder => 
          folder.id === folderId 
            ? { ...folder, color: newColor }
            : folder
        )
      );

      track('folder_color_updated', {
        folderId,
        newColor,
        userId: session?.user?.id,
      });
    } catch (error) {
      track('folder_color_update_error', {
        folderId,
        errorMessage: error instanceof Error ? error.message : String(error),
        userId: session?.user?.id,
      });
      handleError('Error', error);
    } finally {
      setIsUpdatingColor(false);
      setFolderToEdit(null);
    }
  }, [session, showError, track]);


  // Load cached explore recipes (keeping existing explore logic)
  const loadCachedExploreRecipes = useCallback(async (): Promise<{ recipes: ParsedRecipe[] | null; shouldFetch: boolean }> => {
    try {
      const [lastFetchedStr, cachedRecipesStr] = await Promise.all([
        AsyncStorage.getItem('libraryExploreLastFetched'),
        AsyncStorage.getItem('libraryExploreRecipes')
      ]);

      if (!lastFetchedStr || !cachedRecipesStr) {
        return { recipes: null, shouldFetch: true };
      }

      const lastFetched = parseInt(lastFetchedStr, 10);
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds  
      const timeSinceLastFetch = now - lastFetched;

      if (timeSinceLastFetch >= sixHours) {
        return { recipes: null, shouldFetch: true };
      }

      const recipes = JSON.parse(cachedRecipesStr) as ParsedRecipe[];
      const hoursLeft = Math.round((sixHours - timeSinceLastFetch) / (60 * 60 * 1000) * 10) / 10;
      
      if (!recipes || recipes.length === 0) {
        return { recipes: null, shouldFetch: true };
      }

      return { recipes, shouldFetch: false };
    } catch (error) {
      console.error('[LibraryScreen] Error loading cached recipes:', error);
      return { recipes: null, shouldFetch: true };
    }
  }, []);

  // Fetch explore recipes from API (using the working API endpoint)
  const fetchExploreRecipesFromAPI = useCallback(async (isRefresh: boolean = false) => {
    const startTime = performance.now();
    
    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      track('api_config_error', { 
        screen: 'LibraryScreen', 
        error: 'EXPO_PUBLIC_API_URL not set',
        userId: session?.user?.id,
      });
      setExploreError('API configuration error. Please check your environment variables.');
      if (!isRefresh) {
        setIsExploreLoading(false);
      }
      return;
    }

    // Only show full-screen loading indicator if it's not a refresh
    if (!isRefresh) {
      setIsExploreLoading(true);
    }
    setExploreError(null);
    
    try {
      const apiUrl = `${backendUrl}/api/recipes/explore-random`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch explore recipes: ${response.statusText}`);
      }

      const recipes = await response.json();
      
      setExploreRecipes(recipes || []);
      
      // Cache the results using library-specific keys
      const now = Date.now().toString();
      await Promise.all([
        AsyncStorage.setItem('libraryExploreLastFetched', now),
        AsyncStorage.setItem('libraryExploreRecipes', JSON.stringify(recipes || []))
      ]);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load explore recipes';
      track('fetch_explore_recipes_error', { 
        screen: 'LibraryScreen', 
        error: errorMessage,
        userId: session?.user?.id,
      });
      setExploreError(errorMessage);
    } finally {
      // Only hide full-screen loading indicator if it was shown
      if (!isRefresh) {
        setIsExploreLoading(false);
      }
    }
  }, []);

  // Fetch explore recipes (keeping existing explore logic)
  const fetchExploreRecipes = useCallback(async () => {
    const { recipes: cachedRecipes, shouldFetch } = await loadCachedExploreRecipes();
    
    if (cachedRecipes && !shouldFetch) {
      setExploreRecipes(cachedRecipes);
      setIsExploreLoading(false);
      return;
    }

    await fetchExploreRecipesFromAPI(false); // false = not a refresh, show full loading
  }, [loadCachedExploreRecipes, fetchExploreRecipesFromAPI]);

  // Fetch saved folders
  const fetchSavedFolders = useCallback(async () => {
    if (!session?.user) {
      setIsSavedLoading(false);
      setSavedFolders([]);
      return;
    }

    setIsSavedLoading(true);
    setSavedError(null);
    
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders?userId=${session.user.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { folders } = await response.json();
      setSavedFolders(folders || []);
      
    } catch (err) {
      track('fetch_saved_folders_error', { 
        screen: 'LibraryScreen', 
        error: 'Failed to load saved folders',
        userId: session?.user?.id,
      });
      setSavedError('Failed to load saved folders. Please try again.');
    } finally {
      setIsSavedLoading(false);
    }
  }, [session?.user]);

  // Fetch all saved recipes for search functionality
  const fetchAllSavedRecipes = useCallback(async () => {
    if (!session?.user) {
      setSavedRecipes([]);
      return;
    }

    setIsSearchingRecipes(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/recipes?userId=${session.user.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { recipes } = await response.json();
      const validRecipes = (recipes as SavedRecipe[]) || [];
      setSavedRecipes(validRecipes);
      
    } catch (err) {
      console.error('[LibraryScreen] Error fetching saved recipes for search:', err);
      // Don't show error to user for search functionality
    } finally {
      setIsSearchingRecipes(false);
    }
  }, [session?.user]);

  // Load data on focus (Saved only)
  useFocusEffect(
    useCallback(() => {
      fetchSavedFolders();
      fetchAllSavedRecipes(); // Also fetch recipes for search
      setIsNavigating(false); // Reset navigation state when returning to screen
    }, [fetchSavedFolders, fetchAllSavedRecipes])
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    if (selectedTab === 'explore') {
      setExploreError(null);
      await fetchExploreRecipesFromAPI(true); // true = is a refresh, don't show full loading
    } else {
      await fetchSavedFolders();
    }
    
    // Ensure minimum refresh duration for smooth UX
    await new Promise(resolve => setTimeout(resolve, 300));
    setRefreshing(false);
  }, [selectedTab, fetchExploreRecipesFromAPI, fetchSavedFolders]);

  // Navigate to recipe
  const navigateToRecipe = useCallback(async (recipe: ParsedRecipe) => {
    // Set navigating state to prevent flicker
    setIsNavigating(true);

    // Track input mode selection if user is on explore tab
    if (selectedTab === 'explore') {
      try {
        await track('input_mode_selected', { inputType: 'explore' });
      } catch (error) {
        track('track_explore_recipe_selection_error', {
          screen: 'LibraryScreen',
          error: error instanceof Error ? error.message : String(error),
          userId: session?.user?.id,
        });
      }
    }

    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeId: recipe.id?.toString(),
        entryPoint: 'library',
      },
    });
  }, [router, selectedTab, track]);

  // Navigate to folder
  const navigateToFolder = useCallback((folder: SavedFolder) => {
    router.push({
      pathname: '/saved/folder-detail' as any,
      params: {
        folderId: folder.id.toString(),
        folderName: folder.name,
      },
    });
  }, [router]);

  // Handle delete folder
  const handleDeleteFolder = useCallback((folder: SavedFolder) => {
    if (!session?.user) return;

    if (folder.recipe_count > 0) {
      setFolderToDelete(folder);
      setShowDeleteFolderModal(true);
      return;
    }

    setFolderToDelete(folder);
    setShowDeleteFolderModal(true);
  }, [session?.user]);

  const confirmDeleteFolder = useCallback(async () => {
    if (!folderToDelete || !session?.user) return;
    
    setIsSavedLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders/${folderToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: session.user.id }),
      });

      if (!response.ok) {
        track('delete_folder_error', { 
          screen: 'LibraryScreen', 
          folderId: folderToDelete?.id, 
          error: response.statusText,
          userId: session?.user?.id,
        });
        setSavedError('Failed to delete folder. Please try again.');
      } else {
        setSavedFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
      }
    } catch (error) {
      track('unexpected_delete_folder_error', { 
        screen: 'LibraryScreen', 
        folderId: folderToDelete?.id, 
        error: error instanceof Error ? error.message : String(error),
        userId: session?.user?.id,
      });
      setSavedError('Failed to delete folder. Please try again.');
    } finally {
      setIsSavedLoading(false);
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
    }
  }, [folderToDelete, session?.user]);



  // Handle image error
  const handleImageError = useCallback((recipeId: number) => {
    setImageErrors(prev => ({ ...prev, [recipeId]: true }));
  }, []);

  // Render explore recipe item - using original explore styling
  const renderExploreItem = useCallback(({ item }: { item: ParsedRecipe }) => {
    const imageUrl = item.image || item.thumbnailUrl;
    const itemId = (item.id as number).toString();
    const hasImageError = imageErrors[itemId];

    return (
      <TouchableOpacity
        style={styles.exploreCard}
        onPress={() => navigateToRecipe(item)}
      >
        {/* Left half - Image */}
        <View style={styles.imageContainer}>
          {imageUrl && !hasImageError ? (
            <FastImage
              source={{ uri: imageUrl }}
              style={styles.exploreCardImage}
              onLoad={() => {}}
              onError={() => handleImageError(item.id || 0)}
            />
          ) : null}
        </View>
        
        {/* Right half - Recipe title */}
        <View style={styles.titleContainer}>
          <Text style={styles.exploreCardTitle} numberOfLines={3}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigateToRecipe, handleImageError, imageErrors]);

  // Render folder item
  const renderFolderItem = useCallback(({ item, index }: { item: SavedFolder; index: number }) => (
    <TouchableHighlight
      style={[
        styles.folderRow,
        { backgroundColor: 'transparent' }, // Make transparent instead of using folder colors
        index === 0 && { marginTop: SPACING.sm }, // Add top margin to first folder
        index === 0 && { borderTopWidth: 1, borderTopColor: '#000000' } // Add top border to first folder
      ]}
      onPress={() => navigateToFolder(item)}
      underlayColor="transparent" // Match folder-detail button behavior
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.folderRowContent}>
        <Text 
          style={styles.folderRowName} 
          numberOfLines={1} 
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.2}
        >
          {item.name.replace(/\b\w/g, (l) => l.toUpperCase())}
        </Text>
        <Text style={styles.chevronText}>›</Text>
      </View>
    </TouchableHighlight>
  ), [navigateToFolder]);

  // Render search result item
  const renderSearchResultItem = useCallback(({ item }: { item: SavedRecipe }) => {
    const data = item.processed_recipes_cache?.recipe_data;
    if (!data) return null;

    const imageUrl = data.image || data.thumbnailUrl;
    const itemId = item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString();
    const hasImageError = imageErrors[itemId];

    return (
      <TouchableOpacity
        style={styles.searchResultCard}
        onPress={() => navigateToRecipe(data)}
      >
        {/* Left half - Image */}
        <View style={styles.imageContainer}>
          {imageUrl && !hasImageError ? (
            <FastImage
              source={{ uri: imageUrl }}
              style={styles.exploreCardImage}
              onLoad={() => {}}
              onError={() => handleImageError(item.processed_recipes_cache?.id || item.base_recipe_id)}
            />
          ) : null}
        </View>
        
        {/* Right half - Recipe title */}
        <View style={styles.titleContainer}>
          <Text style={styles.exploreCardTitle} numberOfLines={3}>
            {item.title_override || data.title || 'Untitled Recipe'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigateToRecipe, handleImageError, imageErrors]);

  // Render explore content
  const renderExploreContent = () => {
    if (isExploreLoading) {
      return (
        <ActivityIndicator
          style={styles.centered}
          size="large"
          color="black"
        />
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
          <Text style={styles.emptyText}>Couldn&apos;t load explore recipes</Text>
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

    return (
      <FlatList
        data={exploreRecipes}
        renderItem={renderExploreItem}
        keyExtractor={(item) => `explore-${(item.id as number).toString()}`}
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
      />
    );
  };

  // Render saved content
  const renderSavedContent = () => {
    if (isSavedLoading) {
      return (
        <ActivityIndicator
          style={styles.centered}
          size="large"
          color="black"
        />
      );
    }

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="login" size={48} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>Log in to see your recipe folders</Text>
          <Text style={styles.emptySubtext}>
            Your saved recipe folders will appear here once you&apos;re logged in.
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

    if (savedError) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Couldn&apos;t load saved folders</Text>
          <Text style={styles.emptySubtext}>{savedError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchSavedFolders}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (savedFolders.length === 0) {
      return (
        <View style={styles.savedContent}>
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="folder-outline" size={48} color={COLORS.lightGray} />
            <Text style={styles.emptyText}>No recipe folders yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first folder to organize your saved recipes.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.savedContent}>
          {/* Search toolbar */}
          <TouchableHighlight
            style={styles.searchToolbar}
            onPress={isSearchActive ? undefined : toggleSearch}
            underlayColor="transparent"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.searchToolbarContent}>
              {isSearchActive ? (
                <TextInput
                  style={styles.headerText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder=""
                  returnKeyType="search"
                  autoCorrect={false}
                  autoFocus={true}
                  onBlur={() => {
                    setIsSearchActive(false);
                    setSearchQuery('');
                  }}
                />
              ) : (
                <Text style={[
                  styles.headerText,
                  isSearchButtonActive && styles.headerTextActive
                ]}>Search</Text>
              )}
            </View>
          </TouchableHighlight>

          {/* Add New Folder - right below search */}
          <TouchableHighlight
            style={styles.addFolderRow}
            onPress={() => setShowAddFolderModal(true)}
            underlayColor="transparent"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.searchToolbarContent}>
              <Text style={styles.headerText}>Add New Folder</Text>
            </View>
          </TouchableHighlight>

          {/* Spacing now handled by addFolderRow marginBottom */}

        {/* Show search results if searching or navigating */}
        {((isSearchActive && searchQuery.length > 0) || isNavigating) && (
          <View style={styles.searchResultsWrapper}>
            <View style={styles.searchResultsContainer}>
              <Text style={styles.searchResultsHeader}>
                {isNavigating ? 'Loading recipe...' : `Search results (${filteredRecipes.length})`}
              </Text>
              {filteredRecipes.length > 0 ? (
                <FlatList
                  data={filteredRecipes}
                  renderItem={renderSearchResultItem}
                  keyExtractor={(item, index) => `search-${item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}-${index}`}
                  contentContainerStyle={styles.searchResultsList}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  style={styles.searchResultsFlatList}
                />
              ) : (
                <View style={styles.noSearchResults}>
                  <Text style={styles.emptyText}>No matches.</Text>
                  <Text style={styles.emptySubtext}>Try a different search term.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Show folders when not searching or when search query is empty */}
        {(!isSearchActive || (isSearchActive && searchQuery.length === 0)) && (
          <>
            <FlatList
              data={savedFolders}
              renderItem={({ item, index }) => renderFolderItem({ item, index })}
              keyExtractor={(item) => `folder-${(item.id as number).toString()}`}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[COLORS.primary]}
                  tintColor={COLORS.primary}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No folders yet</Text>
                  <Text style={styles.emptySubtext}>
                    Create your first folder to organize your saved recipes
                  </Text>
                </View>
              }
            />
          </>
        )}
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="LIBRARY" showBack={false} backgroundColor="#DEF6FF" />
      
      {/* Content: Saved only */}
      {renderSavedContent()}

      {/* Add New Folder Modal */}
      <AddNewFolderModal
        visible={showAddFolderModal}
        onClose={() => setShowAddFolderModal(false)}
        onFolderCreated={fetchSavedFolders}
      />

      {/* Delete Folder Confirmation Modal */}
      {folderToDelete && (
        <ConfirmationModal
          visible={showDeleteFolderModal}
          title={"Delete Folder"}
          message={`Are you sure? You'll be removing ${folderToDelete.recipe_count} recipe${folderToDelete.recipe_count !== 1 ? 's' : ''} from your saved folders.`}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          onConfirm={confirmDeleteFolder}
          onCancel={() => {
            setShowDeleteFolderModal(false);
            setFolderToDelete(null);
          }}
          destructive={true}
        />
      )}

             {/* Color Picker Modal */}
       {folderToEdit && (
         <Modal
           visible={showColorPickerModal}
           transparent={true}
           animationType="fade"
           onRequestClose={() => setShowColorPickerModal(false)}
         >
           <TouchableOpacity 
             style={styles.modalOverlay} 
             activeOpacity={1}
             onPress={() => setShowColorPickerModal(false)}
           >
             <TouchableOpacity 
               style={styles.colorPickerContainer}
               activeOpacity={1}
               onPress={(e) => e.stopPropagation()}
             >
               <Text style={styles.colorPickerTitle}>
                 Choose a color for &quot;{folderToEdit.name}&quot;
               </Text>
               
               <View style={styles.colorGrid}>
                 <View style={styles.colorRow}>
                   {FOLDER_COLORS.slice(0, 3).map((color, index) => (
                     <TouchableOpacity
                       key={index}
                       style={[
                         styles.colorSquare,
                         { backgroundColor: color },
                         folderToEdit.color === color && styles.selectedColorSquare
                       ]}
                       onPress={() => {
                         updateFolderColor(folderToEdit.id, color);
                         setShowColorPickerModal(false);
                       }}
                     />
                   ))}
                 </View>
                 <View style={styles.colorRow}>
                   {FOLDER_COLORS.slice(3, 6).map((color, index) => (
                     <TouchableOpacity
                       key={index + 3}
                       style={[
                         styles.colorSquare,
                         { backgroundColor: color },
                         folderToEdit.color === color && styles.selectedColorSquare
                       ]}
                       onPress={() => {
                         updateFolderColor(folderToEdit.id, color);
                         setShowColorPickerModal(false);
                       }}
                     />
                   ))}
                 </View>
                 <View style={styles.colorRow}>
                   {FOLDER_COLORS.slice(6, 9).map((color, index) => (
                     <TouchableOpacity
                       key={index + 6}
                       style={[
                         styles.colorSquare,
                         { backgroundColor: color },
                         folderToEdit.color === color && styles.selectedColorSquare
                       ]}
                       onPress={() => {
                         updateFolderColor(folderToEdit.id, color);
                         setShowColorPickerModal(false);
                       }}
                     />
                   ))}
                 </View>
               </View>
             </TouchableOpacity>
           </TouchableOpacity>
         </Modal>
       )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: COLORS.background,
  },
  tabButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  tabButtonTextActive: {
    color: COLORS.textDark,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 2,
    height: 2,
    width: '60%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    // Removed paddingTop to eliminate gap above first folder
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryButton: {
    marginTop: SPACING.lg,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
  },
  retryButtonText: {
    ...bodyStrongText,
    color: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  emptyText: {
    fontFamily: FONT.family.heading,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
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
  // Folder row styles
  folderRow: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  },
  folderRowAlternate: {
    // Removed - now using individual folder colors
  },
  folderRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Right-align chevron
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 0, // Remove padding to push chevron to right edge
  },
  folderRowName: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.textDark,
    position: 'absolute',
    left: 0,
    top: 18, // Position to balance spacing above and below text
    textAlign: 'left', // Ensure left alignment
  },
  chevronText: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  // Explore card styles
  exploreCard: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120,
    overflow: 'hidden',
    width: '90%',
    alignSelf: 'center',
  },
  // Search result card styles - left aligned
  searchResultCard: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120,
    overflow: 'hidden',
    width: '95%', // Slightly wider to account for left edge positioning
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: 0, // Start from absolute left edge
    paddingLeft: 0, // Ensure no internal left padding
  },
  imageContainer: {
    width: '40%',
    height: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  // Specific title container for search results to ensure alignment
  searchResultTitleContainer: {
    width: '60%',
    height: '100%',
    paddingLeft: 0, // Remove left padding for perfect alignment
    paddingRight: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  exploreCardImage: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    width: '60%',
    height: '100%',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  exploreCardTitle: {
    color: COLORS.textDark,
    ...bodyStrongText,
    fontSize: FONT.size.body,
    lineHeight: FONT.size.body * 1.3,
  },
  
  // Add new folder styles - now looks like search text
  addFolderRow: {
    height: 32, // Increased for better fit with 20px font
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    marginTop: SPACING.md, // Increased to 16px for consistent spacing across toolbars
    marginBottom: SPACING.xxxl + SPACING.contentTopMargin, // Big bottom margin for spacing from folders plus content top margin
  },
  addFolderRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  // Note: addFolderRowText now uses headerText style for consistency

  // New styles for saved content
  savedContent: {
    flex: 1,
    paddingTop: SPACING.md,
  } as ViewStyle,

  // Modal styles
     modalOverlay: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: 'rgba(0,0,0,0.6)',
   },
   colorPickerContainer: {
     backgroundColor: COLORS.white,
     borderRadius: RADIUS.lg,
     padding: SPACING.xl,
     width: '85%',
     maxWidth: 320,
     shadowColor: COLORS.black,
     shadowOffset: { width: 0, height: 10 },
     shadowOpacity: 0.25,
     shadowRadius: 20,
     elevation: 10,
   },
   colorPickerTitle: {
     ...bodyStrongText,
     fontSize: FONT.size.sectionHeader,
     color: COLORS.textDark,
     marginBottom: SPACING.lg,
     textAlign: 'center',
   },
   colorGrid: {
     width: '100%',
     marginBottom: SPACING.lg,
   },
   colorRow: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     marginBottom: SPACING.md,
   },
   colorSquare: {
     width: 50,
     height: 50,
     borderRadius: RADIUS.md,
     borderWidth: 2,
     borderColor: COLORS.surface,
     shadowColor: COLORS.black,
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.1,
     shadowRadius: 4,
     elevation: 2,
   },
   selectedColorSquare: {
     borderColor: COLORS.primary,
     borderWidth: 3,
     shadowColor: COLORS.primary,
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 8,
     elevation: 4,
   },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: RADIUS.sm,
  },
     doneButtonText: {
     ...bodyStrongText,
     color: COLORS.white,
   },
  // New styles for search - matches subheading spacing
  searchToolbar: {
    height: 32, // Increased for better fit with 20px font
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  },

  searchToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  searchToolbarText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    textTransform: 'uppercase' as const,
    color: COLORS.textDark,
    flex: 1,
    textAlignVertical: 'center',
    paddingVertical: 0,
  },
  // Shared text style for search and add folder - matches subheading style
  headerText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400', // Non-bold variant
    lineHeight: 24,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'left', // Ensure left alignment
    textAlignVertical: 'center',
    paddingVertical: 0,
  },
  // Active state for search (matches folder-detail.tsx)
  headerTextActive: {
    color: COLORS.primary, // Blue color when active
  },





  searchResultsWrapper: {
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: SPACING.pageHorizontal, // Keep right padding
    paddingTop: 0,
    paddingBottom: SPACING.md,
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  } as ViewStyle,
  searchResultsContainer: {
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    padding: 0, // Remove padding for true left alignment
    ...SHADOWS.small,
    maxHeight: '90%', // Allow more height while still preventing cutoff by tab bar
    width: '100%',
  } as ViewStyle,
  searchResultsHeader: {
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    paddingLeft: 0, // Remove left padding for perfect alignment
    paddingRight: 18, // Match other elements' right padding
  },
  searchResultsList: {
    paddingLeft: 0, // Match other elements' left padding
    paddingRight: 18, // Match other elements' right padding
    paddingBottom: SPACING.md,
  },
  searchResultsFlatList: {
    maxHeight: '100%', // Allow FlatList to take full height of container and scroll
  } as ViewStyle,
  noSearchResults: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.xl,
    paddingLeft: 0, // Remove left padding for perfect alignment
    paddingRight: 18, // Match other elements' right padding
  },
}); 
