import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableHighlight,
  ActivityIndicator,
  Image,
  TextInput,
  Pressable,
  ViewStyle,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import FastImage from '@d11/react-native-fast-image';

import { COLORS, SPACING, RADIUS, BORDER_WIDTH, SHADOWS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  FONT,
  screenTitleText,
} from '@/constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { parseServingsValue } from '@/utils/recipeUtils';
import { moveRecipesToFolder, unsaveRecipes } from '@/lib/savedRecipes';
import ScreenHeader from '@/components/ScreenHeader';
import FolderPickerModal from '@/components/FolderPickerModal';
import ConfirmationModal from '@/components/ConfirmationModal';

type SavedRecipe = {
  id: string; // UUID primary key from user_saved_recipes table
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

// Helpers for client-side search
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

export default function SavedFolderDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ folderId?: string; folderName?: string }>();
  
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>('Folder'); // State for actual folder name
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [editedFolderName, setEditedFolderName] = useState<string>('');
  const [isSavingFolderName, setIsSavingFolderName] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const nameInputRef = useRef<TextInput | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Bulk actions state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  
  // Delete folder state
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [isMovingRecipes, setIsMovingRecipes] = useState(false);
  const [isRemovingRecipes, setIsRemovingRecipes] = useState(false);
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);
  const [bulkActionsHeight, setBulkActionsHeight] = useState(0);
  
  // Confirmation modals state
  const [showDeleteRecipeModal, setShowDeleteRecipeModal] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null);

  const folderId = params.folderId ? parseInt(params.folderId) : null;

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[SavedFolderDetailScreen] Component DID MOUNT for folder:', folderId);
    return () => {
      console.log('[SavedFolderDetailScreen] Component WILL UNMOUNT');
    };
  }, [folderId]);

  // Fetch folder name from database
  const fetchFolderName = useCallback(async () => {
    if (!session?.user || !folderId) return;

    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders/${folderId}?userId=${session.user.id}`);

      if (!response.ok) {
        console.error('[SavedFolderDetailScreen] Error fetching folder name:', response.statusText);
        return;
      }

      const { folder } = await response.json();
      if (folder) {
        console.log('[SavedFolderDetailScreen] Fetched folder name:', folder.name);
        setFolderName(folder.name);
      }
    } catch (err) {
      console.error('[SavedFolderDetailScreen] Unexpected error fetching folder name:', err);
    }
  }, [session?.user, folderId]);

  // Fetch recipes in this folder
  const fetchFolderRecipes = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: SavedFolderDetailScreen] Start fetchFolderRecipes at ${startTime.toFixed(2)}ms`);

    if (!session?.user || !folderId) {
      console.warn('[SavedFolderDetailScreen] No user session or folder ID found. Skipping fetch.');
      setIsLoading(false);
      setSavedRecipes([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders/${folderId}/recipes?userId=${session.user.id}`);

      if (!response.ok) {
        console.error('[SavedFolderDetailScreen] Error fetching folder recipes:', response.statusText);
    setError("We couldn't load your recipes. Please try again.");
        return;
      }

      const { recipes } = await response.json();
      const validRecipes = (recipes as SavedRecipe[]) || [];

      console.log(`[SavedFolderDetailScreen] Fetched ${validRecipes.length} recipes from folder ${folderId}.`);
      setSavedRecipes(validRecipes);
    } catch (err) {
      console.error('[SavedFolderDetailScreen] Unexpected error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, folderId]);

  // Focus effect to refetch when screen becomes active
  useFocusEffect(
    useCallback(() => {
      fetchFolderRecipes();
      fetchFolderName(); // Fetch folder name on focus
    }, [fetchFolderRecipes, fetchFolderName])
  );

  // Focus the input when starting rename
  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isRenaming]);

  const handleStartRenaming = useCallback(() => {
    if (!session?.user) return;
    setEditedFolderName(folderName);
    setRenameError(null);
    setIsRenaming(true);
  }, [session?.user, folderName]);

  const cancelRenaming = useCallback(() => {
    setIsRenaming(false);
    setEditedFolderName('');
    setRenameError(null);
  }, []);

  const saveFolderName = useCallback(async () => {
    if (!session?.user || !folderId) {
      setIsRenaming(false);
      return;
    }

    const newName = editedFolderName.trim();
    if (newName.length === 0) {
      setRenameError("Name can't be empty");
      return;
    }
    if (newName === folderName) {
      setIsRenaming(false);
      setRenameError(null);
      return;
    }

    setIsSavingFolderName(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: session.user.id, name: newName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update folder name');
      }

      setFolderName(newName);
      setIsRenaming(false);
      setRenameError(null);
    } catch (e) {
      setRenameError('Could not rename. Try again.');
    } finally {
      setIsSavingFolderName(false);
    }
  }, [editedFolderName, session?.user, folderId, folderName]);

  // Debounce search input (200ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // SEARCH button logic simplified (no active state highlighting)

  // Toggle search
  const toggleSearch = useCallback(() => {
    setIsSearchActive(prev => {
      if (prev) {
        // When hiding search, clear the search query
        setSearchQuery('');
      } else {
        // When showing search, exit selection mode
        setIsSelectionMode(false);
        setSelectedRecipes(new Set());
      }
      return !prev;
    });
  }, []);

  // Dismiss search (used by X button in search results)
  const dismissSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
  }, []);

  // Toggle selection mode
  const toggleSelection = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        // When exiting selection mode, clear selected recipes
        setSelectedRecipes(new Set());
      } else {
        // When entering selection mode, hide search
        setIsSearchActive(false);
        setSearchQuery('');
      }
      return !prev;
    });
  }, [isSearchActive, isSelectionMode]);

  // Handle delete folder button (kept for future use, not exposed in UI)
  const handleDeleteFolder = useCallback(() => {
    // Exit search and selection modes when deleting
    setIsSearchActive(false);
    setSearchQuery('');
    setIsSelectionMode(false);
    setSelectedRecipes(new Set());
    setShowDeleteFolderModal(true);
  }, []);



  // Handle swipe gesture to go back
  const handleSwipeGesture = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      // If swiped right with sufficient distance or velocity, go back
      if (translationX > 100 || velocityX > 500) {
        router.back();
      }
    }
  }, [router]);

  // Handle delete folder
  const confirmDeleteFolder = useCallback(async () => {
    if (!folderId || !session?.user) return;

    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
        }),
      });

      if (response.ok) {
        // Navigate back to library after successful deletion
        router.back();
      } else {
        setError('Failed to delete folder. Please try again.');
      }
    } catch (err) {
      console.error('[SavedFolderDetailScreen] Error deleting folder:', err);
      setError('Failed to delete folder. Please try again.');
    } finally {
      setShowDeleteFolderModal(false);
    }
  }, [folderId, session?.user, router]);

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

  // Handle recipe press
  const handleRecipePress = useCallback((item: SavedRecipe) => {
    if (isSelectionMode) {
      // In selection mode, toggle selection
      setSelectedRecipes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.base_recipe_id)) {
          newSet.delete(item.base_recipe_id);
        } else {
          newSet.add(item.base_recipe_id);
        }
        return newSet;
      });
      return;
    }

    // Normal navigation
    if (!item.processed_recipes_cache?.recipe_data) {
      console.warn('[SavedFolderDetailScreen] Missing recipe data for navigation:', item);
      return;
    }

    const { recipe_data, source_type } = item.processed_recipes_cache;
    const isModified = source_type === 'user_modified';
    const displayTitle = item.title_override || recipe_data.title;
    
    const recipeWithId = {
      ...recipe_data,
      id: item.processed_recipes_cache.id,
      // Add database metadata for proper fork vs patch logic
      parent_recipe_id: item.processed_recipes_cache.parent_recipe_id,
      source_type: item.processed_recipes_cache.source_type,
      ...(isModified && item.title_override && { title: item.title_override }),
    };

    console.log(`[SavedFolderDetailScreen] Opening recipe: ${displayTitle}`);

    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeId: item.processed_recipes_cache?.id?.toString(), 
        entryPoint: 'saved',
        from: '/saved',
        folderId: folderId?.toString(), // Add folderId so it can be used for saving changes
        isModified: isModified.toString(),
        ...(item.title_override && {
          titleOverride: item.title_override
        }),
        ...(isModified && item.applied_changes && {
          appliedChanges: JSON.stringify(item.applied_changes)
        }),
      },
    });
  }, [router, isSelectionMode, folderId]);

  // Handle delete recipe
  const handleDeleteRecipe = useCallback((savedRecipeId: string) => {
    if (!session?.user) {
      console.warn('[SavedFolderDetailScreen] No user session found. Cannot delete recipe.');
      return;
    }

    setRecipeToDelete(savedRecipeId);
    setShowDeleteRecipeModal(true);
  }, [session?.user]);

  const confirmDeleteRecipe = useCallback(async () => {
    if (!recipeToDelete || !session?.user) return;
    
    setIsLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/saved/recipes/${recipeToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: session.user.id }),
      });

      if (!response.ok) {
        console.error('[SavedFolderDetailScreen] Error deleting recipe:', response.statusText);
        setError('Failed to remove recipe. Please try again.');
      } else {
        console.log(`[SavedFolderDetailScreen] Recipe ${recipeToDelete} removed.`);
        setSavedRecipes(prev => prev.filter(recipe => recipe.id !== recipeToDelete));
      }
    } catch (error) {
      console.error('[SavedFolderDetailScreen] Unexpected error deleting recipe:', error);
      setError('Failed to remove recipe. Please try again.');
    } finally {
      setIsLoading(false);
      setShowDeleteRecipeModal(false);
      setRecipeToDelete(null);
    }
  }, [recipeToDelete, session?.user]);

  // Bulk move functionality - now handled by toggleSelection

  const handleCancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedRecipes(new Set());
  }, []);

  const handleMoveSelectedRecipes = useCallback(() => {
    if (selectedRecipes.size === 0) return;
    setShowFolderPicker(true);
  }, [selectedRecipes.size]);

  const handleStartBulkRemove = useCallback(() => {
    if (selectedRecipes.size === 0) return;
    setShowBulkRemoveModal(true);
  }, [selectedRecipes.size]);



  const handleFolderPickerSelect = useCallback(async (targetFolderId: number) => {
    setShowFolderPicker(false);
    
    if (selectedRecipes.size === 0 || targetFolderId === folderId) {
      return;
    }

    setIsMovingRecipes(true);
    
    try {
      const success = await moveRecipesToFolder(Array.from(selectedRecipes), targetFolderId);
      
      if (success) {
        // Remove moved recipes from current view
        setSavedRecipes(prev => 
          prev.filter(recipe => !selectedRecipes.has(recipe.base_recipe_id))
        );
        setIsSelectionMode(false);
        setSelectedRecipes(new Set());
      } else {
        setError('Failed to move recipes. Please try again.');
      }
    } catch (err) {
      console.error('[SavedFolderDetailScreen] Error moving recipes:', err);
      setError('Failed to move recipes. Please try again.');
    } finally {
      setIsMovingRecipes(false);
    }
  }, [selectedRecipes, folderId]);

  const confirmBulkRemoveSelectedRecipes = useCallback(async () => {
    if (selectedRecipes.size === 0) {
      setShowBulkRemoveModal(false);
      return;
    }
    setIsRemovingRecipes(true);
    try {
      const success = await unsaveRecipes(Array.from(selectedRecipes));
      if (success) {
        setSavedRecipes(prev => prev.filter(r => !selectedRecipes.has(r.base_recipe_id)));
        setIsSelectionMode(false);
        setSelectedRecipes(new Set());
      } else {
        setError('Failed to remove recipes. Please try again.');
      }
    } catch (err) {
      console.error('[SavedFolderDetailScreen] Error bulk removing recipes:', err);
      setError('Failed to remove recipes. Please try again.');
    } finally {
      setIsRemovingRecipes(false);
      setShowBulkRemoveModal(false);
    }
  }, [selectedRecipes]);

  // Start cooking with selected recipes
  const handleStartCookingSelectedRecipes = useCallback(async () => {
    if (!session?.user || selectedRecipes.size === 0) return;

    console.log('[COOKING_DEBUG] Starting to cook with selected recipes:', {
      selectedCount: selectedRecipes.size,
      selectedIds: Array.from(selectedRecipes)
    });

    setIsMovingRecipes(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;

      // Get the selected recipes data
      const selectedRecipeData = savedRecipes.filter(recipe =>
        selectedRecipes.has(recipe.base_recipe_id)
      );

      // Add each recipe to mise
      const addPromises = selectedRecipeData.map(async (recipe) => {
        const recipeData = recipe.processed_recipes_cache?.recipe_data;
        if (!recipeData) {
          console.error(`Missing recipe data for recipe ${recipe.base_recipe_id}`);
          return null;
        }

        console.log(`Adding recipe ${recipe.base_recipe_id} to mise:`, {
          hasRecipeData: !!recipeData,
          title: recipeData.title,
          hasAppliedChanges: !!recipe.applied_changes,
          titleOverride: recipe.title_override
        });

        const response = await fetch(`${backendUrl}/api/mise/save-recipe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: session.user.id,
            originalRecipeId: recipe.base_recipe_id,
            preparedRecipeData: recipeData,
            titleOverride: recipe.title_override,
            appliedChanges: recipe.applied_changes || {},
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to add recipe ${recipe.base_recipe_id} to mise:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          return null;
        }

        return response.json();
      });

      const results = await Promise.all(addPromises);
      const successfulAdds = results.filter(result => result !== null);

      console.log('[COOKING_DEBUG] Cooking setup complete:', {
        totalAttempted: selectedRecipeData.length,
        successfulAdds: successfulAdds.length,
        failedAdds: results.length - successfulAdds.length
      });

      if (successfulAdds.length > 0) {
        // Navigate to mise screen
        console.log('[COOKING_DEBUG] Navigating to mise screen');
        router.push('/tabs/mise');
      } else {
        setError('Failed to add recipes to mise. Please try again.');
      }
    } catch (err) {
      console.error('[SavedFolderDetailScreen] Error adding recipes to mise:', err);
      setError('Failed to start cooking. Please try again.');
    } finally {
      setIsMovingRecipes(false);
      setShowFolderPicker(false);
    }
  }, [session, selectedRecipes, savedRecipes, router]);

  // Render recipe item
  const renderRecipeItem = useCallback(({ item, index }: { item: SavedRecipe; index: number }) => {
    if (!item.processed_recipes_cache?.recipe_data) {
      return null;
    }

    const { recipe_data, source_type } = item.processed_recipes_cache;
    const isModified = source_type === 'user_modified';
    const displayTitle = item.title_override || recipe_data.title;
    const isSelected = selectedRecipes.has(item.base_recipe_id);
    const servingsCount = parseServingsValue(recipe_data.recipeYield);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          styles.cardWithMinHeight,
          isSelected && styles.cardSelected,
          index === 0 && { marginTop: SPACING.sm }, // Add top margin to first recipe
          index === 0 && { borderTopWidth: 1, borderTopColor: '#000000' } // Add top border to first recipe
        ]}
        onPress={() => handleRecipePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {isSelectionMode && (
            <View style={styles.selectionIndicator}>
              <MaterialCommunityIcons
                name={isSelected ? 'circle' : 'circle-outline'}
                size={24}
                color={isSelected ? COLORS.textDark : COLORS.textMuted}
              />
            </View>
          )}
          
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
              {displayTitle}
            </Text>
            {servingsCount && (
              <Text style={styles.servingsText}>For {servingsCount}</Text>
            )}
          </View>
        </View>


      </TouchableOpacity>
    );
  }, [handleRecipePress, handleDeleteRecipe, isSelectionMode, selectedRecipes]);

  // Render content
  const renderContent = () => {
    if (isLoading && !isMovingRecipes) {
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
          <Text style={styles.emptyText}>Log in to see your saved recipes</Text>
        </View>
      );
    }

    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }

    if (savedRecipes.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="heart-outline" size={48} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>No recipes in this folder yet</Text>
          <Text style={styles.emptySubtext}>
            Save recipes to this folder or move recipes from another folder.
          </Text>
        </View>
      );
    }

    // Show search results when searching
    if (isSearchActive && searchQuery.length > 0) {
      return (
        <>
          {filteredRecipes.length > 0 ? (
            <>
              <View style={styles.searchResultsHeader}>
                <Text style={styles.searchResultsHeaderText}>
                  Search results ({filteredRecipes.length})
                </Text>
                <TouchableOpacity
                  style={styles.searchResultsDismissButton}
                  onPress={dismissSearch}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#000000" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={filteredRecipes}
                renderItem={({ item, index }) => renderRecipeItem({ item, index })}
                keyExtractor={(item, index) => `search-recipe-${item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}-${index}`}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: 100 + (isSelectionMode ? bulkActionsHeight + insets.bottom : 0) },
                ]}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <>
              <View style={styles.searchResultsHeader}>
                <Text style={styles.searchResultsHeaderText}>
                  Search results ({filteredRecipes.length})
                </Text>
                <TouchableOpacity
                  style={styles.searchResultsDismissButton}
                  onPress={dismissSearch}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#000000" />
                </TouchableOpacity>
              </View>
                          <View style={styles.noSearchResults}>
              <Text style={styles.emptyText}>No matches.</Text>
              <Text style={styles.emptySubtext}>Try a different search term.</Text>
            </View>
            </>
          )}
        </>
      );
    }

    return (
      <>
        <FlatList
          data={filteredRecipes}
          renderItem={({ item, index }) => renderRecipeItem({ item, index })}
          keyExtractor={(item, index) => `recipe-${item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}-${index}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 100 + (isSelectionMode ? bulkActionsHeight + insets.bottom : 0) },
          ]}
          showsVerticalScrollIndicator={false}
        />
        {savedRecipes.length > 0 && filteredRecipes.length === 0 && !isSearchActive && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="magnify" size={48} color={COLORS.lightGray} />
            <Text style={styles.emptyText}>No matches</Text>
            <Text style={styles.emptySubtext}>Try a different search term.</Text>
          </View>
        )}
        
        {/* Bulk actions bar */}
        {isSelectionMode && (
          <View
            style={styles.bulkActionsBar}
            onLayout={(e) => setBulkActionsHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.bulkActionsHeader}>
              <Text style={styles.selectedCountText}>
                Recipes selected ({selectedRecipes.size})
              </Text>
              <TouchableOpacity
                style={styles.closeSelectionButton}
                onPress={toggleSelection}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.closeSelectionText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bulkActionsButtonsStack}>
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  selectedRecipes.size === 0 && styles.primaryActionButtonDisabled,
                ]}
                onPress={handleStartCookingSelectedRecipes}
                disabled={selectedRecipes.size === 0}
              >
                <Text style={styles.primaryActionButtonText}>
                  Cook now
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  selectedRecipes.size === 0 && styles.primaryActionButtonDisabled,
                ]}
                onPress={handleMoveSelectedRecipes}
                disabled={selectedRecipes.size === 0}
              >
                <Text style={styles.primaryActionButtonText}>Move to</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dangerOutlineButton,
                  (selectedRecipes.size === 0 || isRemovingRecipes) && styles.dangerOutlineButtonDisabled,
                ]}
                onPress={handleStartBulkRemove}
                disabled={selectedRecipes.size === 0 || isRemovingRecipes}
              >
                {isRemovingRecipes && (
                  <ActivityIndicator size="small" color={COLORS.error} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.dangerOutlineButtonText}>Remove from saved</Text>
              </TouchableOpacity>


            </View>
          </View>
        )}
      </>
    );
  };

  // Header action - only for renaming
  const renderHeaderAction = () => {
    // When renaming, show a checkmark to confirm save
    if (isRenaming) {
      const isSaveDisabled =
        isSavingFolderName || editedFolderName.trim().length === 0;
      return (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={saveFolderName}
          disabled={isSaveDisabled}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isSavingFolderName ? (
            <ActivityIndicator size="small" color="black" />
          ) : (
            <MaterialCommunityIcons
              name="check"
              size={24}
              color={isSaveDisabled ? COLORS.textMuted : COLORS.textDark}
            />
          )}
        </TouchableOpacity>
      );
    }

    // When not renaming, show a pencil icon to start editing
    return (
      <TouchableOpacity
        style={styles.selectButton}
        onPress={handleStartRenaming}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="pencil"
          size={20}
          color={COLORS.textDark}
        />
      </TouchableOpacity>
    );
  };

  return (
    <PanGestureHandler
      onHandlerStateChange={handleSwipeGesture}
      activeOffsetX={[-10, 10]}
      failOffsetY={[-5, 5]}
    >
      <Pressable style={[styles.container, { paddingTop: insets.top }]} onPress={isRenaming ? cancelRenaming : undefined}>
      {/* Custom Header */}
      <View style={styles.header}>
        {isRenaming ? (
          <TextInput
            ref={nameInputRef}
            style={[styles.headerTitle, styles.headerTitleInput]}
            value={editedFolderName}
            onChangeText={setEditedFolderName}
            // Do not auto-save on blur or submit; rely on the checkmark
            editable={!isSavingFolderName}
            maxLength={18}
            returnKeyType="done"
            blurOnSubmit={false}
          />
        ) : (
          <TouchableOpacity
            style={styles.headerTitleTouchable}
            onPress={handleStartRenaming}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>{folderName.toUpperCase()}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerRight}>
          {renderHeaderAction()}
        </View>
      </View>

      {/* Search and Select toolbar */}
      <View style={styles.toolbarContainer}>
        <TouchableOpacity
          key="search-button"
          style={styles.toolbarButton}
          onPress={isSearchActive ? undefined : toggleSearch}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.toolbarButtonContent}>
            {isSearchActive ? (
              <TextInput
                style={styles.toolbarButtonText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder=""
                returnKeyType="search"
                autoCorrect={false}
                autoFocus={true}
                onBlur={() => {
                  // Keep search active on blur to show results without keyboard
                  // Don't clear search query to allow recipe selection
                }}
              />
            ) : (
              <Text style={styles.toolbarButtonText}>Search</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableHighlight
          key="select-button"
          style={styles.toolbarButton}
          onPress={toggleSelection}
          underlayColor="transparent"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.toolbarButtonContent}>
            <Text style={styles.toolbarButtonText}>Select</Text>
          </View>
        </TouchableHighlight>

        <TouchableHighlight
          key="delete-folder-button"
          style={[styles.toolbarButton, styles.deleteButton]}
          onPress={handleDeleteFolder}
          underlayColor="transparent"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.toolbarButtonContent}>
            <Text style={styles.toolbarButtonText}>Delete Folder</Text>
          </View>
        </TouchableHighlight>


      </View>


      {renameError ? <Text style={styles.renameErrorText}>{renameError}</Text> : null}
      
      {renderContent()}
      
      {/* Folder Picker Modal for moving recipes */}
      <FolderPickerModal
        visible={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelectFolder={handleFolderPickerSelect}
        isLoading={isMovingRecipes}
        showStartCookingOption={false}
        onStartCooking={handleStartCookingSelectedRecipes}
        selectedRecipeCount={selectedRecipes.size}
      />

      {/* Delete Recipe Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteRecipeModal}
        title="Remove Recipe"
        message="Are you sure you want to remove this recipe from your saved recipes?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteRecipe}
        onCancel={() => {
          setShowDeleteRecipeModal(false);
          setRecipeToDelete(null);
        }}
        destructive={false}
      />

      {/* Bulk Remove Confirmation Modal */}
      <ConfirmationModal
        visible={showBulkRemoveModal}
        title="Remove from saved"
        message={`Remove ${selectedRecipes.size} recipe${selectedRecipes.size !== 1 ? 's' : ''} from your saved list?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={confirmBulkRemoveSelectedRecipes}
        onCancel={() => setShowBulkRemoveModal(false)}
        destructive={false}
      />

      {/* Delete Folder Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteFolderModal}
        title="Delete Folder"
        message={`Are you sure? You'll be removing ${savedRecipes.length} recipe${savedRecipes.length !== 1 ? 's' : ''} from your saved folders.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setShowDeleteFolderModal(false)}
        destructive={true}
      />
      </Pressable>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    marginTop: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    backgroundColor: '#DEF6FF', // Add light blue background to match other headers
  },
  headerTitle: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'left',
  },
  headerTitleInput: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'left',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingLeft: 18, // Match ScreenHeader titleContainer
    paddingHorizontal: 0,
    minWidth: 100, // Prevent layout shifts by maintaining minimum width
    flex: 1,
  },
  headerTitleTouchable: {
    alignItems: 'flex-start',
    paddingLeft: 18, // Match ScreenHeader titleContainer
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: SPACING.pageHorizontal, // Match the page horizontal padding
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'left',
  },
  emptySubtext: {
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    textAlign: 'left',
    marginTop: SPACING.xs,
  },
  listContent: {
    // Removed paddingTop to match library.tsx positioning
    paddingBottom: 100, // Extra space for bulk actions bar
  },
  searchWrapper: {
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    // Fix height so it doesn't change between placeholder and typed text
    height: 40,
  },
  searchIcon: {
    marginRight: SPACING.xs,
  },
  searchInput: {
    // Avoid inheriting bodyText lineHeight which can misalign TextInput vertically
    fontFamily: FONT.family.body,
    fontSize: FONT.size.body,
    flex: 1,
    color: COLORS.textDark,
    paddingVertical: 0,
    height: '100%',
    textAlignVertical: 'center',
  },
  clearButton: {
    padding: 4,
  },
  // Toolbar styles
  toolbarContainer: {
    flexDirection: 'column', // Stack vertically
    height: 112, // Updated for 16px spacing: 32px + 16px + 32px + 16px + 16px = 112px
    backgroundColor: 'transparent',
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    marginTop: SPACING.md, // Consistent with other screens
    marginBottom: SPACING.xxxl + SPACING.contentTopMargin, // Match library.tsx spacing between buttons and content
  },
  toolbarButton: {
    height: 32, // Increased for better fit with 20px font
    backgroundColor: 'transparent',
    marginBottom: SPACING.md, // Increased to 16px for consistent spacing across toolbars
  },
  deleteButton: {
    width: '45%', // Smaller width for DELETE FOLDER button
    alignSelf: 'flex-start', // Left align the button
    marginBottom: 0, // Remove bottom margin for last button
  },

  toolbarButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  toolbarButtonText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400', // Non-bold variant to match library.tsx
    lineHeight: 24,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'left', // Ensure left alignment
    textAlignVertical: 'center',
    paddingVertical: 0,
  },

  toolbarDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#D9D5CC',
  },
  // Card styles to match mise.tsx
  card: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  trashIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 4,
  },
  cardWithMinHeight: {
    height: 64,
  },
  cardSelected: {
    // No border styling - only checkbox indicates selection
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    ...bodyText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    lineHeight: 19,
    marginBottom: SPACING.xs,
  },
  servingsText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  selectionIndicator: {
    marginRight: SPACING.md,
  },
  selectButton: {
    padding: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkActionsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    backgroundColor: '#DEF6FF', // Lighter blue background
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  bulkActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  },
  selectedCountText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.lg,
    textAlign: 'left', // Left align like toolbar buttons
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding like toolbar buttons
  },
  closeSelectionButton: {
    padding: SPACING.xs,
  },
  closeSelectionText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.lg,
    textAlign: 'center',
  },
  bulkActionsButtonsStack: {
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding like toolbar buttons
    height: 80, // Adjusted for 24px buttons (24*3 + spacing = ~80px)
    justifyContent: 'space-between', // Distribute space evenly like toolbar
  },
  primaryActionButton: {
    height: 24, // Match toolbar button height for consistency
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    width: 'auto', // Width based on content, not full width
  },
  primaryActionButtonDisabled: {
    opacity: 0.6, // Match the lighter grey inactive state of "Remove from saved"
  },
  primaryActionButtonText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400', // Match SEARCH/SELECT non-bold weight
    lineHeight: 22,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'left', // Match SEARCH/SELECT left alignment
  },
  secondaryOutlineButton: {
    height: 24, // Match SEARCH/SELECT button height
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    width: 'auto', // Width based on content, not full width
  },
  secondaryOutlineButtonText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400', // Match SEARCH/SELECT non-bold weight
    lineHeight: 22,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'left', // Match SEARCH/SELECT left alignment
  },
  dangerOutlineButton: {
    height: 24, // Match toolbar button height for consistency
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    width: 'auto', // Width based on content, not full width
  },
  dangerOutlineButtonDisabled: {
    borderColor: COLORS.error,
    opacity: 0.6,
  },
  dangerOutlineButtonText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400', // Match SEARCH/SELECT non-bold weight
    lineHeight: 22,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'left', // Match SEARCH/SELECT left alignment
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  renameErrorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  // New styles for search
  searchResultsWrapper: {
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 0, // Remove right padding to match folder rows
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
  } as ViewStyle,
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingLeft: 0, // Remove left padding for perfect alignment
    paddingRight: 0, // Remove right padding to allow X button at edge
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  },
  searchResultsHeaderText: {
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
  },
  searchResultsDismissButton: {
    padding: 4,
    marginRight: 0,
  },
  headerPlaceholder: {
    // Invisible placeholder to maintain consistent spacing when search is not active
    height: 24 + SPACING.sm, // lineHeight (24) + marginBottom (8) to match searchResultsHeader exactly
  },
  searchResultsList: {
    // Match listContent style for consistent sizing and positioning
    paddingBottom: 100, // Extra space for bulk actions bar
  },
  searchResultsFlatList: {
    maxHeight: '100%', // Allow FlatList to take full height of container and scroll
  } as ViewStyle,
  noSearchResults: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.xl,
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    paddingLeft: 0, // Remove left padding for perfect alignment
    paddingRight: 18, // Match other elements' right padding
  },
}); 