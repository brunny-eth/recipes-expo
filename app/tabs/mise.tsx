import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
  TextStyle,
  TextInput,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useErrorModal } from '@/context/ErrorModalContext';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import ScreenHeader from '@/components/ScreenHeader';

const MISE_CACHE_KEYS = {
  LAST_FETCHED: 'miseLastFetched',
  RECIPES: 'miseRecipes',
  GROCERY: 'miseGroceryList',
};
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

// Types matching the mise database structure
type MiseRecipe = {
  id: string;
  title_override: string | null;
  planned_date: string | null;
  prepared_recipe_data: ParsedRecipe;
  final_yield: number;
  applied_changes: any | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

type GroceryItem = {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string;
  checked: boolean;
  id: string;
};

type GroceryCategory = {
  name: string;
  items: GroceryItem[];
};

// Convert flat grocery items array to categorized format
const convertToGroceryCategories = (items: any[]): GroceryCategory[] => {
  const categories: { [key: string]: GroceryItem[] } = {};
  
  items.forEach((item, index) => {
    const categoryName = item.grocery_category || 'Other';
    
    if (!categories[categoryName]) {
      categories[categoryName] = [];
    }
    
    categories[categoryName].push({
      id: item.id || `item_${index}`,
      name: item.item_name || item.name,
      amount: item.quantity_amount,
      unit: item.quantity_unit,
      category: categoryName,
      checked: item.is_checked || false,
    });
  });
  
  // Convert to array format expected by UI
  return Object.entries(categories).map(([categoryName, items]) => ({
    name: categoryName,
    items: items,
  }));
};

export default function MiseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { showError } = useErrorModal();
  const [miseRecipes, setMiseRecipes] = useState<MiseRecipe[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'recipes' | 'grocery'>('recipes');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // --- Caching Strategy ---
  const lastSessionIdRef = useRef<string | null>(null);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[MiseScreen] Component DID MOUNT');
    return () => {
      console.log('[MiseScreen] Component WILL UNMOUNT');
    };
  }, []);

  const loadCachedMiseData = useCallback(
    async (): Promise<{
      recipes: MiseRecipe[] | null;
      grocery: GroceryCategory[] | null;
      shouldFetch: boolean;
    }> => {
      try {
        const [lastFetchedStr, cachedRecipesStr, cachedGroceryStr] = await Promise.all([
          AsyncStorage.getItem(MISE_CACHE_KEYS.LAST_FETCHED),
          AsyncStorage.getItem(MISE_CACHE_KEYS.RECIPES),
          AsyncStorage.getItem(MISE_CACHE_KEYS.GROCERY),
        ]);

        const currentSessionId = session?.user?.id || null;
        const storedSessionId = lastSessionIdRef.current;

        if (currentSessionId !== storedSessionId) {
          console.log('[MiseScreen] Session changed - will fetch');
          lastSessionIdRef.current = currentSessionId;
          return { recipes: null, grocery: null, shouldFetch: true };
        }
        
        if (!lastFetchedStr || !cachedRecipesStr || !cachedGroceryStr) {
          console.log('[MiseScreen] No complete cached data found - will fetch');
          return { recipes: null, grocery: null, shouldFetch: true };
        }
  
        const lastFetched = parseInt(lastFetchedStr, 10);
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetched;
  
        if (timeSinceLastFetch >= CACHE_DURATION_MS) {
          console.log(
            `[MiseScreen] Cache expired (${Math.round(
              timeSinceLastFetch / (60 * 60 * 1000)
            )}h old) - will fetch`
          );
          return { recipes: null, grocery: null, shouldFetch: true };
        }
  
        try {
          const recipes = JSON.parse(cachedRecipesStr) as MiseRecipe[];
          const grocery = JSON.parse(cachedGroceryStr) as GroceryCategory[];
          const hoursLeft = Math.round((CACHE_DURATION_MS - timeSinceLastFetch) / (60 * 60 * 1000) * 10) / 10;
          console.log(`[MiseScreen] Using cached data (${recipes.length} recipes, ${hoursLeft}h left)`);
          return { recipes, grocery, shouldFetch: false };
        } catch (parseError) {
          console.error('[MiseScreen] Error parsing cached data - will fetch:', parseError);
          return { recipes: null, grocery: null, shouldFetch: true };
        }
      } catch (error) {
        console.error('[MiseScreen] Error loading cached data - will fetch as fallback:', error);
        return { recipes: null, grocery: null, shouldFetch: true };
      }
    },
    [session]
  );

  const fetchMiseDataFromAPI = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: MiseScreen] Start fetchMiseDataFromAPI at ${startTime.toFixed(2)}ms`);

    if (!session?.user) {
      console.warn('[MiseScreen] No user session found. Skipping fetch.');
      setIsLoading(false);
      setMiseRecipes([]);
      setGroceryList([]);
      setError('Please log in to access your mise en place.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('API configuration error. Please check your environment variables.');
      }
      
      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // Fetch both recipes and grocery list in parallel
      const [recipesResponse, groceryResponse] = await Promise.all([
        fetch(`${backendUrl}/api/mise/recipes?userId=${session.user.id}`, { headers }),
        fetch(`${backendUrl}/api/mise/grocery-list?userId=${session.user.id}`, { headers }),
      ]);

      if (!recipesResponse.ok) {
        throw new Error(`Failed to fetch mise recipes: ${recipesResponse.statusText}`);
      }
      if (!groceryResponse.ok) {
        throw new Error(`Failed to fetch grocery list: ${groceryResponse.statusText}`);
      }
      
      const [recipesData, groceryData] = await Promise.all([
        recipesResponse.json(),
        groceryResponse.json(),
      ]);

      const fetchedRecipes = recipesData?.recipes || [];
      const categorizedGroceryList = convertToGroceryCategories(groceryData?.items || []);

      setMiseRecipes(fetchedRecipes);
      setGroceryList(categorizedGroceryList);

      // Cache the fresh data
      try {
        const now = Date.now().toString();
        await Promise.all([
          AsyncStorage.setItem(MISE_CACHE_KEYS.LAST_FETCHED, now),
          AsyncStorage.setItem(MISE_CACHE_KEYS.RECIPES, JSON.stringify(fetchedRecipes)),
          AsyncStorage.setItem(MISE_CACHE_KEYS.GROCERY, JSON.stringify(categorizedGroceryList)),
        ]);
        console.log('[MiseScreen] Stored fresh mise data in cache.');
        console.log('[MiseScreen] Caching grocery list data:', JSON.stringify(categorizedGroceryList, null, 2));
      } catch (storageError) {
        console.warn('[MiseScreen] Failed to store cache data:', storageError);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load mise data';
      console.error('[MiseScreen] Error fetching mise data:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      const totalTime = performance.now() - startTime;
      console.log(`[PERF: MiseScreen] Total fetchMiseDataFromAPI duration: ${totalTime.toFixed(2)}ms`);
    }
  }, [session?.user?.id, session?.access_token]);

  const fetchMiseData = useCallback(async (forceRefresh = false) => {
    console.log('[MiseScreen] fetchMiseData called', { forceRefresh });
    
    if (!forceRefresh) {
      const { recipes, grocery, shouldFetch } = await loadCachedMiseData();
      
      if (!shouldFetch && recipes && grocery) {
        console.log('[MiseScreen] Using cached data - no fetch needed');
        setMiseRecipes(recipes);
        setGroceryList(grocery);
        setIsLoading(false);
        return;
      }
    }

    console.log('[MiseScreen] Cache miss, expired, or refresh forced - fetching fresh data');
    await fetchMiseDataFromAPI();
  }, [loadCachedMiseData, fetchMiseDataFromAPI]);

  // Use this to manually invalidate cache, e.g., after adding/deleting recipe
  const invalidateMiseCache = async () => {
    try {
      await AsyncStorage.removeItem(MISE_CACHE_KEYS.LAST_FETCHED);
      console.log('[MiseScreen] Invalidated mise cache.');
    } catch (error) {
      console.error('[MiseScreen] Failed to invalidate mise cache:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log('[MiseScreen] 🎯 useFocusEffect triggered');
      // On focus, check if we need to refetch data
      fetchMiseData();
    }, [fetchMiseData])
  );

  // Handle updating a recipe's title
  const handleUpdateTitle = useCallback(async (recipeId: string, newTitle: string) => {
    if (!session?.access_token || !session.user?.id) return;

    // Find the original title to revert on failure
    const originalTitle = miseRecipes.find(r => r.id === recipeId)?.title_override;

    // Optimistically update the UI
    setMiseRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, title_override: newTitle } : r));
    setEditingRecipeId(null);

    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) throw new Error('API URL not configured');

      const response = await fetch(`${backendUrl}/api/mise/recipes/${recipeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: session.user.id, titleOverride: newTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title on the server');
      }
      await invalidateMiseCache();
    } catch (err) {
      console.error('[MiseScreen] Error updating title:', err);
      showError('Update Failed', 'Could not save the new title. Please try again.');
      // Revert optimistic update on failure
      setMiseRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, title_override: originalTitle || r.prepared_recipe_data.title } : r));
    }
  }, [session?.access_token, session?.user?.id, showError, miseRecipes]);

  const handleCompleteRecipe = useCallback(async (recipeId: string, isCompleted: boolean) => {
    if (!session?.user) return;
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/mise/recipes/${recipeId}/complete`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_completed: isCompleted }),
      });

      if (!response.ok) {
        throw new Error('Failed to update completion status');
      }

      const updatedRecipe = await response.json();

      setMiseRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? { ...r, is_completed: isCompleted } : r))
      );
      
      // Invalidate cache after completing/uncompleting
      await invalidateMiseCache();
      
      console.log(`[MiseScreen] Recipe ${recipeId} completion status updated to ${isCompleted}`);
    } catch (err) {
      console.error('[MiseScreen] Error completing recipe:', err);
      showError('Recipe Error', 'Failed to update completion status. Please try again.');
    }
  }, [session, showError]);

  // Handle recipe deletion
  const handleDeleteRecipe = useCallback(async (recipeId: string) => {
    if (!session?.user) return;
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${backendUrl}/api/mise/recipes/${recipeId}?userId=${session.user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `Failed to delete recipe: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (jsonError) {
          console.warn('[MiseScreen] Failed to parse error response:', jsonError);
        }
        throw new Error(errorMessage);
      }

      setMiseRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      
      // Invalidate cache after deleting
      await invalidateMiseCache();

      console.log(`[MiseScreen] Recipe ${recipeId} deleted successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[MiseScreen] Error deleting recipe:', err);
      showError('Error', errorMessage);
    }
  }, [session, showError]);

  // Handle grocery item toggle
  const handleGroceryToggle = useCallback((categoryName: string, itemIndex: number) => {
    // Optimistically update local state for instant feedback
    const updatedList = [...groceryList];
    const categoryIndex = updatedList.findIndex(cat => cat.name === categoryName);
    if (categoryIndex === -1) return;

    const itemToUpdate = updatedList[categoryIndex].items[itemIndex];
    const newCheckedState = !itemToUpdate.checked;
    itemToUpdate.checked = newCheckedState;
    setGroceryList(updatedList);

    // Debounce the API call to prevent spamming while quickly checking items
    const timerId = setTimeout(() => {
      if (!session?.user?.id || !session.access_token) return;

      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) return;

      fetch(`${backendUrl}/api/mise/grocery-item-state`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          itemName: itemToUpdate.name,
          isChecked: newCheckedState,
        }),
      }).catch(err => {
        console.error('Failed to save grocery item state:', err);
        // Optionally, revert the optimistic update and show an error
        showError('Sync Error', 'Could not save check state. Please try again.');
        itemToUpdate.checked = !newCheckedState;
        setGroceryList([...groceryList]);
      });
    }, 500); // 500ms debounce

    // Note: We don't clear the timeout on re-render because each toggle is independent.
    // A more robust implementation might use a single, cancellable timeout for the whole list.
  }, [groceryList, session?.user?.id, session?.access_token, showError]);

  // Handle grocery sharing
  const handleShareGrocery = useCallback(() => {
    // Generate markdown for sharing
    const markdown = groceryList.map(category => {
      const items = category.items.map(item => {
        const checkbox = item.checked ? '☑️' : '☐';
        const amount = item.amount ? `${item.amount}` : '';
        const unit = item.unit ? ` ${item.unit}` : '';
        return `${checkbox} ${amount}${unit} ${item.name}`;
      }).join('\n');
      return `## ${category.name}\n${items}`;
    }).join('\n\n');

    // On iOS, this will open the share sheet
    const shareData = {
      title: 'Grocery List',
      text: markdown,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback for development
      console.log('Grocery list markdown:', markdown);
    }
  }, [groceryList]);

  // Use focus effect to refresh data when tab becomes active
  // This useFocusEffect is now redundant as the caching strategy handles refetches
  // useFocusEffect(
  //   useCallback(() => {
  //     console.log('[MiseScreen] 🎯 useFocusEffect triggered');
  //     fetchMiseRecipes();
  //   }, [fetchMiseRecipes])
  // );

  // Render recipe item
  const renderRecipeItem = useCallback(({ item }: { item: MiseRecipe }) => {
    const isEditing = editingRecipeId === item.id;

    const startEditing = () => {
      setEditingRecipeId(item.id);
      setEditingTitle(item.title_override || item.prepared_recipe_data.title || '');
    };

    const cancelEditing = () => {
      setEditingRecipeId(null);
      setEditingTitle('');
    };

    const saveEditing = async () => {
      if (!session?.access_token || !session.user?.id) return;

      // Find the original title to revert on failure
      const originalTitle = miseRecipes.find(r => r.id === editingRecipeId)?.title_override;

      // Optimistically update the UI
      setMiseRecipes(prev => prev.map(r => r.id === editingRecipeId ? { ...r, title_override: editingTitle } : r));
      setEditingRecipeId(null);

      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!backendUrl) throw new Error('API URL not configured');

        const response = await fetch(`${backendUrl}/api/mise/recipes/${editingRecipeId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: session.user.id, titleOverride: editingTitle }),
        });

        if (!response.ok) {
          throw new Error('Failed to update title');
        }

        setMiseRecipes((prev) =>
          prev.map((r) => (r.id === editingRecipeId ? { ...r, title_override: editingTitle } : r))
        );
        
        // Invalidate cache after editing title
        await invalidateMiseCache();

        cancelEditing();
      } catch (error) {
        console.error('Error saving title:', error);
        showError('Update Failed', 'Could not save the new title. Please try again.');
        // Revert optimistic update on failure
        setMiseRecipes(prev => prev.map(r => r.id === editingRecipeId ? { ...r, title_override: originalTitle || r.prepared_recipe_data.title } : r));
      }
    };

    return (
      <View style={styles.recipeCard}>
        <TouchableOpacity
          style={styles.recipeCardContent}
          onPress={() => {
            if (isEditing) return; // Don't navigate while editing
            // Navigate to recipe steps with the prepared recipe data
            router.push({
              pathname: '/recipe/steps',
              params: {
                recipeData: JSON.stringify(item.prepared_recipe_data),
                finalYield: item.final_yield.toString(),
                miseRecipeId: item.id, // Pass the mise recipe ID for completion functionality
              },
            });
          }}
          disabled={isEditing}
        >
          {item.prepared_recipe_data.thumbnailUrl && (
            <FastImage
              source={{ uri: item.prepared_recipe_data.thumbnailUrl }}
              style={styles.recipeImage}
            />
          )}
          <View style={styles.recipeInfo}>
            {isEditing ? (
              <TextInput
                style={styles.recipeTitleInput}
                value={editingTitle}
                onChangeText={setEditingTitle}
                autoFocus
                onBlur={saveEditing} // Save when input loses focus
              />
            ) : (
              <Text style={styles.recipeTitle} numberOfLines={1} ellipsizeMode="tail">
                {item.title_override || item.prepared_recipe_data.title}
              </Text>
            )}
            <Text style={styles.recipeYield}>
              Serves {item.final_yield}
            </Text>
            {item.applied_changes && (
              <Text style={styles.recipeChanges}>
                {item.applied_changes.ingredientChanges?.length > 0 && ''}
                {item.applied_changes.scalingFactor !== 1 && `Scaled ${item.applied_changes.scalingFactor}x`}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.recipeActions}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={saveEditing}>
                <MaterialCommunityIcons name="check" size={20} color={COLORS.success} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={cancelEditing}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={startEditing}>
                <MaterialCommunityIcons name="pencil" size={20} color={COLORS.darkGray} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteRecipe(item.id)}>
                <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }, [editingRecipeId, editingTitle, handleUpdateTitle, handleCompleteRecipe, handleDeleteRecipe, router, session?.access_token, session?.user?.id, showError, miseRecipes]);

  // Render grocery category
  const renderGroceryCategory = useCallback(({ item }: { item: GroceryCategory }) => (
    <View style={styles.groceryCategory}>
      <Text style={styles.groceryCategoryTitle}>{item.name}</Text>
      {item.items.map((groceryItem, index) => (
        <TouchableOpacity
          key={groceryItem.id}
          style={styles.groceryItem}
          onPress={() => handleGroceryToggle(item.name, index)}
        >
          <MaterialCommunityIcons
            name={groceryItem.checked ? "checkbox-marked" : "checkbox-blank-outline"}
            size={20}
            color={groceryItem.checked ? COLORS.success : COLORS.darkGray}
          />
          <Text style={[
            styles.groceryItemText,
            groceryItem.checked && styles.groceryItemChecked
          ]}>
            {groceryItem.amount ? `${groceryItem.amount}` : ''}
            {groceryItem.unit ? ` ${groceryItem.unit}` : ''}
            {groceryItem.amount || groceryItem.unit ? ' ' : ''}
            {groceryItem.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [handleGroceryToggle, groceryList]);

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

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Couldn't load mise recipes</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchMiseData(true)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (selectedTab === 'recipes') {
      if (miseRecipes.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="chef-hat"
              size={48}
              color={COLORS.lightGray}
            />
            <Text style={styles.emptyText}>No recipes in mise</Text>
            <Text style={styles.emptySubtext}>
              Prepare a recipe to add it to your mise en place.
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={miseRecipes}
          renderItem={renderRecipeItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      );
    } else {
      if (groceryList.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="cart-outline"
              size={48}
              color={COLORS.lightGray}
            />
            <Text style={styles.emptyText}>No grocery items</Text>
            <Text style={styles.emptySubtext}>
              Add recipes to your mise to see grocery items.
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.groceryContainer}>
          <View style={styles.groceryHeader}>
            <Text style={styles.groceryTitle}>Combined Grocery List</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareGrocery}
            >
              <MaterialCommunityIcons name="share" size={20} color={COLORS.primary} />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={groceryList}
            renderItem={renderGroceryCategory}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Mise en Place" />
      
      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'recipes' && styles.tabButtonActive
          ]}
          onPress={() => setSelectedTab('recipes')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'recipes' && styles.tabButtonTextActive
          ]}>
            Recipes ({miseRecipes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'grocery' && styles.tabButtonActive
          ]}
          onPress={() => setSelectedTab('grocery')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'grocery' && styles.tabButtonTextActive
          ]}>
            Grocery List
          </Text>
        </TouchableOpacity>
      </View>

      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: 4,
    marginBottom: SPACING.md,
  } as ViewStyle,
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  tabButtonText: {
    ...bodyStrongText,
    color: COLORS.darkGray,
  } as TextStyle,
  tabButtonTextActive: {
    color: COLORS.white,
  } as TextStyle,
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
    fontFamily: FONT.family.recoleta,
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
  recipeCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm, // Reduced vertical padding
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  recipeCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  recipeImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
  } as ViewStyle,
  recipeTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  recipeTitleInput: {
    ...bodyStrongText,
    color: COLORS.textDark,
    borderBottomWidth: 1,
    borderColor: COLORS.primary,
    paddingBottom: 2,
  } as TextStyle,
  titleActions: {
    flexDirection: 'row',
  },
  recipeYield: {
    ...bodyText,
    color: COLORS.darkGray,
    fontSize: 12, // smaller font for sub-text
    marginTop: 2, // less space
  } as TextStyle,
  recipeChanges: {
    ...bodyText,
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 2, // less space
  } as TextStyle,
  recipeActions: {
    flexDirection: 'column', // Stack icons vertically
    justifyContent: 'space-around', // Space them out
    marginLeft: SPACING.md,
  } as ViewStyle,
  actionButton: {
    padding: SPACING.xs, // smaller touch target
  } as ViewStyle,
  groceryContainer: {
    flex: 1,
  } as ViewStyle,
  groceryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  } as ViewStyle,
  groceryTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  shareButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  } as TextStyle,
  groceryCategory: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  } as ViewStyle,
  groceryCategoryTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  } as TextStyle,
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  } as ViewStyle,
  groceryItemText: {
    ...bodyText,
    color: COLORS.textDark,
    marginLeft: SPACING.sm,
    flex: 1,
  } as TextStyle,
  groceryItemChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.darkGray,
  } as TextStyle,
}); 