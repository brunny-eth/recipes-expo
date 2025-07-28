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
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  FONT,
  screenTitleText,
} from '@/constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { parseServingsValue } from '@/utils/recipeUtils';
import { moveRecipesToFolder } from '@/lib/savedRecipes';
import ScreenHeader from '@/components/ScreenHeader';
import FolderPickerModal from '@/components/FolderPickerModal';
import ConfirmationModal from '@/components/ConfirmationModal';

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
  display_order: number;
};

export default function SavedFolderDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ folderId?: string; folderName?: string }>();
  
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>('Folder'); // State for actual folder name
  
  // Bulk move state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isMovingRecipes, setIsMovingRecipes] = useState(false);
  
  // Confirmation modals state
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [showDeleteRecipeModal, setShowDeleteRecipeModal] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<number | null>(null);

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
      const { data: folderData, error: folderError } = await supabase
        .from('user_saved_folders')
        .select('name')
        .eq('id', folderId)
        .eq('user_id', session.user.id)
        .single();

      if (folderError) {
        console.error('[SavedFolderDetailScreen] Error fetching folder name:', folderError);
        return;
      }

      if (folderData) {
        console.log('[SavedFolderDetailScreen] Fetched folder name:', folderData.name);
        setFolderName(folderData.name);
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
      const { data, error: fetchError } = await supabase
        .from('user_saved_recipes')
        .select(`
          base_recipe_id,
          title_override,
          applied_changes,
          original_recipe_data,
          display_order,
          processed_recipes_cache (
            id,
            recipe_data,
            source_type,
            parent_recipe_id
          )
        `)
        .eq('user_id', session.user.id)
        .eq('folder_id', folderId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[SavedFolderDetailScreen] Error fetching folder recipes:', fetchError);
        setError('Could not load recipes. Please try again.');
        return;
      }

      const validRecipes = ((data as any[])?.filter(
        (r) => r.processed_recipes_cache?.recipe_data,
      ) as SavedRecipe[]) || [];

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
      ...(isModified && item.title_override && { title: item.title_override }),
    };

    console.log(`[SavedFolderDetailScreen] Opening recipe: ${displayTitle}`);

    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeData: JSON.stringify(recipeWithId), 
        entryPoint: 'saved',
        from: '/saved',
        isModified: isModified.toString(),
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
  }, [router, isSelectionMode]);

  // Handle delete recipe
  const handleDeleteRecipe = useCallback((baseRecipeId: number) => {
    if (!session?.user) {
      console.warn('[SavedFolderDetailScreen] No user session found. Cannot delete recipe.');
      return;
    }

    setRecipeToDelete(baseRecipeId);
    setShowDeleteRecipeModal(true);
  }, [session?.user]);

  const confirmDeleteRecipe = useCallback(async () => {
    if (!recipeToDelete || !session?.user) return;
    
    setIsLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('user_saved_recipes')
        .delete()
        .eq('user_id', session.user.id)
        .eq('base_recipe_id', recipeToDelete);

      if (deleteError) {
        console.error('[SavedFolderDetailScreen] Error deleting recipe:', deleteError);
        setError('Failed to remove recipe. Please try again.');
      } else {
        console.log(`[SavedFolderDetailScreen] Recipe ${recipeToDelete} removed.`);
        setSavedRecipes(prev => prev.filter(recipe => recipe.base_recipe_id !== recipeToDelete));
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
        
        {imageUrl && (
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
          />
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
            onPress={() => handleDeleteRecipe(item.base_recipe_id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
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
            Save recipes to this folder from the recipe summary screen.
          </Text>
        </View>
      );
    }

    return (
      <>
        <FlatList
          data={savedRecipes}
          renderItem={renderRecipeItem}
          keyExtractor={(item) => item.processed_recipes_cache?.id.toString() || item.base_recipe_id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        
        {/* Bulk actions bar */}
        {isSelectionMode && (
          <View style={styles.bulkActionsBar}>
            <View style={styles.bulkActionsHeader}>
              <Text style={styles.selectedCountText}>
                {selectedRecipes.size} recipe{selectedRecipes.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
            <View style={styles.bulkActionsButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelSelection}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.moveButton,
                  selectedRecipes.size === 0 && styles.moveButtonDisabled
                ]}
                onPress={handleMoveSelectedRecipes}
                disabled={selectedRecipes.size === 0 || isMovingRecipes}
              >
                {isMovingRecipes ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.moveButtonText}>
                    Move to folder
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </>
    );
  };

  // Header action
  const renderHeaderAction = () => {
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{folderName}</Text>
        <View style={styles.headerRight}>
          {renderHeaderAction()}
        </View>
      </View>
      
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
    </View>
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
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    marginTop: SPACING.lg,
    marginHorizontal: -SPACING.pageHorizontal,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
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
  bulkActionsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
  },
  moveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    minHeight: 48,
  },
  moveButtonDisabled: {
    backgroundColor: COLORS.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  moveButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
}); 