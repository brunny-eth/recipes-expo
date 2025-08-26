import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Pressable,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
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
  
  // Bulk actions state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isMovingRecipes, setIsMovingRecipes] = useState(false);
  const [isRemovingRecipes, setIsRemovingRecipes] = useState(false);
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);
  const [bulkActionsHeight, setBulkActionsHeight] = useState(0);
  
  // Confirmation modals state
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
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

  // Bulk move functionality
  const handleStartSelection = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedRecipes(new Set());
  }, []);

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

  // Render recipe item
  const renderRecipeItem = useCallback(({ item }: { item: SavedRecipe }) => {
    if (!item.processed_recipes_cache?.recipe_data) {
      return null;
    }

    const { recipe_data, source_type } = item.processed_recipes_cache;
    const imageUrl = recipe_data.image || recipe_data.thumbnailUrl;
    const isModified = source_type === 'user_modified';
    const displayTitle = item.title_override || recipe_data.title;
    const isSelected = selectedRecipes.has(item.base_recipe_id);

    return (
      <TouchableOpacity
        style={[
          styles.recipeCard,
          isSelected && styles.recipeCardSelected,
        ]}
        onPress={() => handleRecipePress(item)}
      >
        {isSelectionMode && (
          <View style={styles.selectionIndicator}>
            <MaterialCommunityIcons
              name={isSelected ? 'check-circle' : 'circle-outline'}
              size={24}
              color={isSelected ? COLORS.primary : COLORS.textMuted}
            />
          </View>
        )}
        
        {imageUrl ? (
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
          />
        ) : (
          <View style={styles.fallbackImageContainer}>
            <Image
              source={require('@/assets/images/meezblue_underline.webp')}
              style={styles.fallbackImage}
              resizeMode="contain"
            />
          </View>
        )}
        
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          {(() => {
            const servingsCount = parseServingsValue(recipe_data.recipeYield);
            return servingsCount ? (
              <Text style={styles.servingsText}>(servings: {servingsCount})</Text>
            ) : null;
          })()}
        </View>
        
        {!isSelectionMode && (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleDeleteRecipe(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="trash-can" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
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
          color={COLORS.primary}
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

    return (
      <>
        <FlatList
          data={filteredRecipes}
          renderItem={renderRecipeItem}
          keyExtractor={(item) => item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 100 + (isSelectionMode ? bulkActionsHeight + insets.bottom : 0) },
          ]}
          showsVerticalScrollIndicator={false}
        />
        {savedRecipes.length > 0 && filteredRecipes.length === 0 && (
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
                {selectedRecipes.size} recipe{selectedRecipes.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
            <View style={styles.bulkActionsButtonsStack}>
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  (selectedRecipes.size === 0 || isMovingRecipes) && styles.primaryActionButtonDisabled,
                ]}
                onPress={handleMoveSelectedRecipes}
                disabled={selectedRecipes.size === 0 || isMovingRecipes}
              >
                {isMovingRecipes && (
                  <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.primaryActionButtonText}>Move to...</Text>
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

              <TouchableOpacity 
                style={styles.secondaryOutlineButton}
                onPress={handleCancelSelection}
              >
                <Text style={styles.secondaryOutlineButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </>
    );
  };

  // Header action
  const renderHeaderAction = () => {
    // When renaming, show a checkmark to confirm save
    if (isRenaming) {
      const isSaveDisabled =
        isSavingFolderName || editedFolderName.trim().length === 0 || editedFolderName.trim() === folderName.trim();
      return (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={saveFolderName}
          disabled={isSaveDisabled}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isSavingFolderName ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <MaterialCommunityIcons
              name="check"
              size={24}
              color={isSaveDisabled ? COLORS.textMuted : COLORS.primary}
            />
          )}
        </TouchableOpacity>
      );
    }

    if (savedRecipes.length === 0 || isSelectionMode) return null;

    return (
      <TouchableOpacity
        style={styles.selectButton}
        onPress={handleStartSelection}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="checkbox-multiple-marked-outline" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  return (
    <Pressable style={[styles.container, { paddingTop: insets.top }]} onPress={isRenaming ? cancelRenaming : undefined}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        {isRenaming ? (
          <TextInput
            ref={nameInputRef}
            style={[styles.headerTitle, styles.headerTitleInput]}
            value={editedFolderName}
            onChangeText={setEditedFolderName}
            // Do not auto-save on blur or submit; rely on the checkmark
            editable={!isSavingFolderName}
            maxLength={50}
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
            <Text style={styles.headerTitle} numberOfLines={1}>{folderName}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerRight}>
          {renderHeaderAction()}
        </View>
      </View>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search inside this folder"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {renameError ? <Text style={styles.renameErrorText}>{renameError}</Text> : null}
      
      {renderContent()}
      
      {/* Folder Picker Modal for moving recipes */}
      <FolderPickerModal
        visible={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelectFolder={handleFolderPickerSelect}
        isLoading={isMovingRecipes}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
    width: 85, // Fixed width to match headerRight
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...screenTitleText,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
  },
  headerTitleInput: {
    ...screenTitleText,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerTitleTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 85, // Wider to accommodate "Select" button without wrapping
    alignItems: 'flex-end',
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
    fontFamily: FONT.family.ubuntu,
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
  listContent: {
    paddingTop: SPACING.sm,
    paddingBottom: 100, // Extra space for bulk actions bar
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
    marginBottom: SPACING.sm,
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
  recipeCard: {
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
  recipeCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  selectionIndicator: {
    marginRight: SPACING.md,
  },
  recipeImage: {
    width: SPACING.xxl + 8,
    height: SPACING.xxl + 8,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  fallbackImageContainer: {
    width: SPACING.xxl + 8,
    height: SPACING.xxl + 8,
    borderRadius: 6,
    marginRight: SPACING.md,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackImage: {
    width: '80%',
    height: '80%',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
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
  deleteButton: {
    padding: SPACING.xs,
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
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.background,
    borderTopWidth: BORDER_WIDTH.hairline,
    borderTopColor: COLORS.divider,
  },
  bulkActionsHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  selectedCountText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.lg,
    textAlign: 'center',
  },
  bulkActionsButtonsStack: {
    gap: SPACING.sm,
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  },
  primaryActionButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  primaryActionButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  secondaryOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryOutlineButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  },
  dangerOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  dangerOutlineButtonDisabled: {
    borderColor: COLORS.lightGray,
  },
  dangerOutlineButtonText: {
    ...bodyStrongText,
    color: COLORS.error,
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
}); 