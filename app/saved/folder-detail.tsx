import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  FONT,
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
  
  // Bulk move state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isMovingRecipes, setIsMovingRecipes] = useState(false);

  const folderId = params.folderId ? parseInt(params.folderId) : null;
  const folderName = params.folderName || 'Folder';

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[SavedFolderDetailScreen] Component DID MOUNT for folder:', folderId);
    return () => {
      console.log('[SavedFolderDetailScreen] Component WILL UNMOUNT');
    };
  }, [folderId]);

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
    }, [fetchFolderRecipes])
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
  const handleDeleteRecipe = useCallback(async (baseRecipeId: number) => {
    if (!session?.user) {
      console.warn('[SavedFolderDetailScreen] No user session found. Cannot delete recipe.');
      return;
    }

    Alert.alert(
      'Remove Recipe',
      'Are you sure you want to remove this recipe from your saved recipes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const { error: deleteError } = await supabase
              .from('user_saved_recipes')
              .delete()
              .eq('user_id', session.user.id)
              .eq('base_recipe_id', baseRecipeId);

            if (deleteError) {
              console.error('[SavedFolderDetailScreen] Error deleting recipe:', deleteError);
              setError('Failed to remove recipe. Please try again.');
            } else {
              console.log(`[SavedFolderDetailScreen] Recipe ${baseRecipeId} removed.`);
              setSavedRecipes(prev => prev.filter(recipe => recipe.base_recipe_id !== baseRecipeId));
            }
            setIsLoading(false);
          },
        },
      ]
    );
  }, [session?.user]);

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
            <Text style={styles.selectedCountText}>
              {selectedRecipes.size} selected
            </Text>
            <View style={styles.bulkActions}>
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
      >
        <Text style={styles.selectButtonText}>Select</Text>
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
  },
  headerTitle: {
    ...bodyStrongText,
    fontSize: 20,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 40, // Same width as back button to center title
    alignItems: 'flex-end',
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  selectButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  },
  bulkActionsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCountText: {
    ...bodyText,
    color: COLORS.textDark,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
  },
  cancelButtonText: {
    ...bodyText,
    color: COLORS.textMuted,
  },
  moveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    minWidth: 120,
    alignItems: 'center',
  },
  moveButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  moveButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
}); 