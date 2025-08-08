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
  Modal,
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

// Types for folders
type SavedFolder = {
  id: number;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  recipe_count: number;
};

// Predefined folder colors (8 choices in 4x2 grid)
const FOLDER_COLORS = [
  '#109DF0', // Primary blue
  '#9253E0', // Purple
  '#2E7D32', // Green
  '#FFA000', // Orange
  '#D32F2F', // Red
  '#7a8c99', // Gray
  '#FF6B6B', // Coral
  '#DDA0DD', // Plum
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { session } = useAuth();
  const { showError } = useErrorModal();
  const { track } = useAnalytics();
  
  // Tab state
  const [selectedTab, setSelectedTab] = useState<'explore' | 'saved'>(
    params?.tab === 'saved' ? 'saved' : 'explore'
  );
  
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

  // Color picker modal state
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<SavedFolder | null>(null);
  const [isUpdatingColor, setIsUpdatingColor] = useState(false);

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
      showError('Error', 'Failed to update folder color. Please try again.');
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

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      fetchExploreRecipes();
      fetchSavedFolders();
    }, [fetchExploreRecipes, fetchSavedFolders])
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
        recipeData: JSON.stringify(recipe),
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
    
    // If folder has recipes, just close the modal (it's an info message)
    if (folderToDelete.recipe_count > 0) {
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
      return;
    }
    
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
      <TouchableOpacity 
        style={styles.folderIcon}
        onPress={() => {
          setFolderToEdit(item);
          setShowColorPickerModal(true);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="folder"
          size={28}
          color={item.color || COLORS.primary}
        />
      </TouchableOpacity>
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
            <MaterialCommunityIcons name="trash-can" size={16} color={COLORS.textMuted} />
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
        keyExtractor={(item) => (item.id as number).toString()}
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
          keyExtractor={(item) => (item.id as number).toString()}
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
                 Choose a color for "{folderToEdit.name}"
               </Text>
               
               <View style={styles.colorGrid}>
                 <View style={styles.colorRow}>
                   {FOLDER_COLORS.slice(0, 4).map((color, index) => (
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
                   {FOLDER_COLORS.slice(4, 8).map((color, index) => (
                     <TouchableOpacity
                       key={index + 4}
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
    marginBottom: 6,
  },
  recipeCountText: {
    ...metaText,
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
    backgroundColor: COLORS.white,
  },
  exploreCardTitle: {
    color: COLORS.textDark,
    ...bodyStrongText,
    fontSize: FONT.size.body,
    lineHeight: FONT.size.body * 1.3,
  },
  
  // Add new folder styles
  bottomButtonContainer: {
    backgroundColor: COLORS.background,
  } as ViewStyle,
  addFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    marginHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
    ...SHADOWS.small,
  } as ViewStyle,
  addFolderText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,

  // New styles for saved content
  savedContent: {
    flex: 1,
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
}); 