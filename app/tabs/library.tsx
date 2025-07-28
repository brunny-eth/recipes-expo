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
  TextInput,
  Alert,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';
import { bodyText, screenTitleText, FONT, bodyStrongText } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import ScreenHeader from '@/components/ScreenHeader';
import AddNewFolderModal from '@/components/AddNewFolderModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';

// Types for folders
type SavedFolder = {
  id: number;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  recipe_count: number;
};

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  
  // Saved folders state
  const [savedFolders, setSavedFolders] = useState<SavedFolder[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  
  // Add new folder modal state
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  
  // Confirmation modal state
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<SavedFolder | null>(null);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[LibraryScreen] Component DID MOUNT');
    return () => {
      console.log('[LibraryScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Load cached explore recipes (keeping existing explore logic)
  const loadCachedExploreRecipes = useCallback(async (): Promise<{ recipes: ParsedRecipe[] | null; shouldFetch: boolean }> => {
    try {
      const [lastFetchedStr, cachedRecipesStr] = await Promise.all([
        AsyncStorage.getItem('libraryExploreLastFetched'),
        AsyncStorage.getItem('libraryExploreRecipes')
      ]);

      if (!lastFetchedStr || !cachedRecipesStr) {
        console.log('[LibraryScreen] No cached explore data found');
        return { recipes: null, shouldFetch: true };
      }

      const lastFetched = parseInt(lastFetchedStr, 10);
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds  
      const timeSinceLastFetch = now - lastFetched;

      if (timeSinceLastFetch >= sixHours) {
        console.log(`[LibraryScreen] Cache expired (${Math.round(timeSinceLastFetch / (60 * 60 * 1000))}h old) - will fetch`);
        return { recipes: null, shouldFetch: true };
      }

      const recipes = JSON.parse(cachedRecipesStr) as ParsedRecipe[];
      const hoursLeft = Math.round((sixHours - timeSinceLastFetch) / (60 * 60 * 1000) * 10) / 10;
      
      if (!recipes || recipes.length === 0) {
        console.log('[LibraryScreen] Cached data is empty - will fetch');
        return { recipes: null, shouldFetch: true };
      }

      console.log(`[LibraryScreen] Using cached recipes (${recipes.length} recipes, ${hoursLeft}h left)`);
      return { recipes, shouldFetch: false };
    } catch (error) {
      console.error('[LibraryScreen] Error loading cached recipes:', error);
      return { recipes: null, shouldFetch: true };
    }
  }, []);

  // Fetch explore recipes from API (using the working API endpoint)
  const fetchExploreRecipesFromAPI = useCallback(async (isRefresh: boolean = false) => {
    const startTime = performance.now();
    console.log(`[PERF: LibraryScreen] Start fetchExploreRecipesFromAPI at ${startTime.toFixed(2)}ms, isRefresh: ${isRefresh}`);
    
    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('[LibraryScreen] EXPO_PUBLIC_API_URL is not set.');
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
      console.log(`[LibraryScreen] Fetching from: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch explore recipes: ${response.statusText}`);
      }

      const recipes = await response.json();
      console.log(`[LibraryScreen] Fetched ${recipes?.length || 0} explore recipes from API.`);
      
      setExploreRecipes(recipes || []);
      
      // Cache the results using library-specific keys
      const now = Date.now().toString();
      await Promise.all([
        AsyncStorage.setItem('libraryExploreLastFetched', now),
        AsyncStorage.setItem('libraryExploreRecipes', JSON.stringify(recipes || []))
      ]);
      console.log('[LibraryScreen] Stored fetch timestamp and recipe data');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load explore recipes';
      console.error('[LibraryScreen] Error fetching explore recipes:', err);
      setExploreError(errorMessage);
    } finally {
      // Only hide full-screen loading indicator if it was shown
      if (!isRefresh) {
        setIsExploreLoading(false);
      }
      const totalTime = performance.now() - startTime;
      console.log(`[PERF: LibraryScreen] Total fetchExploreRecipesFromAPI duration: ${totalTime.toFixed(2)}ms`);
    }
  }, []);

  // Fetch explore recipes (keeping existing explore logic)
  const fetchExploreRecipes = useCallback(async () => {
    console.log('[LibraryScreen] fetchExploreRecipes called - checking cache');
    
    const { recipes: cachedRecipes, shouldFetch } = await loadCachedExploreRecipes();
    
    if (cachedRecipes && !shouldFetch) {
      console.log('[LibraryScreen] Using cached explore recipes');
      setExploreRecipes(cachedRecipes);
      setIsExploreLoading(false);
      return;
    }

    await fetchExploreRecipesFromAPI(false); // false = not a refresh, show full loading
  }, [loadCachedExploreRecipes, fetchExploreRecipesFromAPI]);

  // Fetch saved folders
  const fetchSavedFolders = useCallback(async () => {
    console.log('[LibraryScreen] Fetching saved folders');
    
    if (!session?.user) {
      console.log('[LibraryScreen] No user session for saved folders');
      setIsSavedLoading(false);
      setSavedFolders([]);
      return;
    }

    setIsSavedLoading(true);
    setSavedError(null);
    
    try {
      const { data: foldersData, error: foldersError } = await supabase
        .from('user_saved_folders')
        .select(`
          id,
          name,
          color,
          icon,
          display_order,
          user_saved_recipes!folder_id(count)
        `)
        .eq('user_id', session.user.id)
        .order('display_order', { ascending: true });

      if (foldersError) throw foldersError;

      const formattedFolders = foldersData?.map(folder => ({
        id: folder.id,
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        display_order: folder.display_order,
        recipe_count: (folder.user_saved_recipes as any)?.[0]?.count || 0,
      })) || [];

      console.log(`[LibraryScreen] Fetched ${formattedFolders.length} saved folders`);
      setSavedFolders(formattedFolders);
      
    } catch (err) {
      console.error('[LibraryScreen] Error fetching saved folders:', err);
      setSavedError('Failed to load saved folders. Please try again.');
    } finally {
      setIsSavedLoading(false);
    }
  }, [session?.user]);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      console.log('[LibraryScreen] Focus effect triggered');
      fetchExploreRecipes();
      fetchSavedFolders();
    }, [fetchExploreRecipes, fetchSavedFolders])
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    console.log('[LibraryScreen] Pull-to-refresh triggered');
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

  // Navigate to folder
  const navigateToFolder = useCallback((folder: SavedFolder) => {
    console.log(`[LibraryScreen] Opening folder: ${folder.name}`);

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
    
    // If folder has recipes, just close the modal (it's an info message)
    if (folderToDelete.recipe_count > 0) {
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
      return;
    }
    
    setIsSavedLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('user_saved_folders')
        .delete()
        .eq('user_id', session.user.id)
        .eq('id', folderToDelete.id);

      if (deleteError) {
        console.error('[LibraryScreen] Error deleting folder:', deleteError);
        setSavedError('Failed to delete folder. Please try again.');
      } else {
        console.log(`[LibraryScreen] Folder "${folderToDelete.name}" deleted.`);
        setSavedFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
      }
    } catch (error) {
      console.error('[LibraryScreen] Unexpected error deleting folder:', error);
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
    const itemId = item.id || 'unknown';
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
          ) : (
            <FastImage
              source={require('@/assets/images/meezblue_underline.webp')}
              style={styles.exploreCardImage}
            />
          )}
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
  const renderFolderItem = useCallback(({ item }: { item: SavedFolder }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => navigateToFolder(item)}
    >
      <View style={styles.folderIcon}>
        <MaterialCommunityIcons
          name="folder"
          size={28}
          color={COLORS.primary}
        />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <Text style={styles.recipeCountText}>
          {item.recipe_count} recipe{item.recipe_count !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.folderActions}>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteFolder(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  ), [navigateToFolder, handleDeleteFolder]);

  // Render explore content
  const renderExploreContent = () => {
    if (isExploreLoading) {
      return (
        <ActivityIndicator
          style={styles.centered}
          size="large"
          color={COLORS.primary}
        />
      );
    }

    if (exploreError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{exploreError}</Text>
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
          color={COLORS.primary}
        />
      );
    }

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="login" size={48} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>Log in to see your recipe folders</Text>
          <Text style={styles.emptySubtext}>
            Your saved recipe folders will appear here once you're logged in.
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{savedError}</Text>
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
          
          {/* Add New Folder Button at Bottom */}
          <View style={styles.bottomButtonContainer}>
            <TouchableOpacity
              style={styles.addFolderButton}
              onPress={() => setShowAddFolderModal(true)}
            >
              <MaterialCommunityIcons
                name="plus"
                size={20}
                color={COLORS.white}
              />
              <Text style={styles.addFolderText}>Add new folder</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.savedContent}>
        <FlatList
          data={savedFolders}
          renderItem={renderFolderItem}
          keyExtractor={(item) => item.id.toString()}
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

        {/* Add New Folder Button at Bottom */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.addFolderButton}
            onPress={() => setShowAddFolderModal(true)}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={COLORS.white}
            />
            <Text style={styles.addFolderText}>Add new folder</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Recipe library" />
      
      {/* Tab selector - underline style */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setSelectedTab('explore')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'explore' && styles.tabButtonTextActive
          ]}>
            Explore
          </Text>
          {selectedTab === 'explore' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setSelectedTab('saved')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'saved' && styles.tabButtonTextActive
          ]}>
            Saved
          </Text>
          {selectedTab === 'saved' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {/* Subheading for explore tab */}
      {selectedTab === 'explore' && (
        <Text style={styles.subheading}>
          Discover recipes from our community
        </Text>
      )}

      {/* Subheading for saved tab */}
      {selectedTab === 'saved' && (
        <Text style={styles.subheading}>
          Recipes you're saving for later.
        </Text>
      )}

      {/* Content */}
      {selectedTab === 'explore' ? renderExploreContent() : renderSavedContent()}

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
          title={folderToDelete.recipe_count > 0 ? "Cannot Delete Folder" : "Delete Folder"}
          message={folderToDelete.recipe_count > 0 
            ? `This folder contains ${folderToDelete.recipe_count} recipe${folderToDelete.recipe_count !== 1 ? 's' : ''}. Please move or delete the recipes first.`
            : `Are you sure you want to delete "${folderToDelete.name}"?`
          }
          confirmLabel={folderToDelete.recipe_count > 0 ? "OK" : "Delete"}
          cancelLabel={folderToDelete.recipe_count > 0 ? undefined : "Cancel"}
          onConfirm={confirmDeleteFolder}
          onCancel={() => {
            setShowDeleteFolderModal(false);
            setFolderToDelete(null);
          }}
          destructive={false}
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
    paddingTop: SPACING.sm,
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
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: RADIUS.sm,
  },
  retryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    paddingTop: '30%',
  },
  emptyText: {
    fontFamily: FONT.family.ubuntu,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...bodyText,
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
  // Folder styles
  folderCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  folderIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  folderInfo: {
    flex: 1,
    marginRight: SPACING.sm, // Ensure consistent spacing from actions
  },
  folderName: {
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  recipeCountText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
  },
  folderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60, // Ensure consistent width for actions
    justifyContent: 'flex-end',
  },
  deleteButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  // Explore card styles
  exploreCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '40%',
    height: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
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
    backgroundColor: COLORS.surface,
  },
  exploreCardTitle: {
    color: COLORS.textDark,
    ...bodyStrongText,
    fontSize: FONT.size.body,
    lineHeight: FONT.size.body * 1.3,
  },
  
  // Add new folder styles
  bottomButtonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  addFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  addFolderText: {
    ...bodyStrongText,
    color: COLORS.white,
    marginLeft: SPACING.sm,
  } as TextStyle,

  // New styles for saved content
  savedContent: {
    flex: 1,
  } as ViewStyle,
  subheading: {
    ...bodyText,
    fontSize: FONT.size.body,
    fontWeight: '300',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
  } as TextStyle,
}); 