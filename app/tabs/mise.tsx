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
  ImageStyle,
  TextInput,
  Share,
  Modal,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  screenTitleText,
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  sectionHeaderText,
  FONT,
} from '@/constants/typography';
import { SHADOWS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import ScreenHeader from '@/components/ScreenHeader';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { parseServingsValue } from '@/utils/recipeUtils';
import { useCooking } from '@/context/CookingContext';
import { formatIngredientsForGroceryList, getBasicGroceryCategory, formatAmountForGroceryDisplay } from '@/utils/groceryHelpers';

// Cache removed - always fetch fresh data for consistency

// Types matching the mise database structure
type MiseRecipe = {
  id: string;
  title_override: string | null;
  planned_date: string | null;
  prepared_recipe_data: ParsedRecipe;
  original_recipe_data: ParsedRecipe | null; // Original recipe data for consistent scaling
  final_yield: number;
  applied_changes: any | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  // Local modifications for non-persistent changes
  local_modifications?: {
    scaleFactor?: number;
    appliedChanges?: any[];
    modified_recipe_data?: ParsedRecipe;
  };
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
  console.log('[MiseScreen] 🔄 Starting convertToGroceryCategories with items:', items.length);
  
  const categories: { [key: string]: GroceryItem[] } = {};
  
  items.forEach((item, index) => {
    const categoryName = item.grocery_category || 'Other';
    
    console.log(`[MiseScreen] 📝 Processing item ${index + 1}:`, {
      item_name: item.item_name,
      original_category: item.grocery_category,
      final_category: categoryName,
      original_ingredient_text: item.original_ingredient_text
    });
    
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
  const result = Object.entries(categories).map(([categoryName, items]) => ({
    name: categoryName,
    items: items,
  }));
  
  console.log('[MiseScreen] ✅ Final categorized result:', {
    categoryCount: result.length,
    categories: result.map(cat => ({
      name: cat.name,
      itemCount: cat.items.length
    }))
  });
  
  return result;
};

export default function MiseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { showError } = useErrorModal();
  const { hasResumableSession } = useCooking();
  const [miseRecipes, setMiseRecipes] = useState<MiseRecipe[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'recipes' | 'grocery'>('recipes');

  // Removed caching strategy - always fetch fresh data for consistency

  // Component Mount/Unmount logging
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[MiseScreen] 🚀 Component DID MOUNT at ${timestamp}`);
    return () => {
      const unmountTimestamp = new Date().toISOString();
      console.log(`[MiseScreen] 💀 Component WILL UNMOUNT at ${unmountTimestamp}`);
    };
  }, []);

  // Removed loadCachedMiseData function - always fetch fresh data

  const fetchMiseDataFromAPI = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: MiseScreen] Start fetchMiseDataFromAPI at ${startTime.toFixed(2)}ms`);

    if (!session?.user) {
      console.warn('[MiseScreen] No user session found. Skipping fetch.');
      setIsLoading(false);
      setMiseRecipes([]);
      setGroceryList([]);
      setError('Please log in to access your mise.');
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

      console.log('[MiseScreen] 🛒 Starting grocery list fetch...');

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
      
      console.log('[MiseScreen] 📦 Raw grocery data received:', {
        itemsCount: groceryData?.items?.length || 0,
        items: groceryData?.items?.map((item: any) => ({
          item_name: item.item_name,
          grocery_category: item.grocery_category,
          original_ingredient_text: item.original_ingredient_text
        })) || []
      });

      const categorizedGroceryList = convertToGroceryCategories(groceryData?.items || []);
      
      console.log('[MiseScreen] 🎯 Converted grocery categories:', {
        categoryCount: categorizedGroceryList.length,
        categories: categorizedGroceryList.map(cat => ({
          name: cat.name,
          itemCount: cat.items.length,
          items: cat.items.map(item => ({
            name: item.name,
            category: item.category,
            amount: item.amount,
            unit: item.unit
          }))
        }))
      });

      // Log memory pressure for each recipe
      console.log('[MiseScreen] 💾 Memory analysis for fetched recipes:');
      fetchedRecipes.forEach((recipe: any, index: number) => {
        const recipeJson = JSON.stringify(recipe);
        const sizeInKB = (recipeJson.length / 1024).toFixed(2);
        const preparedDataSize = recipe.prepared_recipe_data ? 
          (JSON.stringify(recipe.prepared_recipe_data).length / 1024).toFixed(2) : '0';
        const originalDataSize = recipe.original_recipe_data ? 
          (JSON.stringify(recipe.original_recipe_data).length / 1024).toFixed(2) : '0';
        
        console.log(`[MiseScreen] 📊 Recipe ${index + 1}/${fetchedRecipes.length}:`, {
          id: recipe.id,
          title: recipe.title_override || recipe.prepared_recipe_data?.title || 'Unknown',
          totalSizeKB: sizeInKB,
          preparedDataKB: preparedDataSize,
          originalDataKB: originalDataSize,
          hasAppliedChanges: !!recipe.applied_changes,
          ingredientGroupsCount: recipe.prepared_recipe_data?.ingredientGroups?.length || 0,
          instructionsCount: recipe.prepared_recipe_data?.instructions?.length || 0,
        });
      });

      const totalMemoryKB = fetchedRecipes.reduce((total: number, recipe: any) => {
        return total + (JSON.stringify(recipe).length / 1024);
      }, 0).toFixed(2);
      
      console.log(`[MiseScreen] 📈 Total memory usage: ${totalMemoryKB} KB for ${fetchedRecipes.length} recipes`);

      setMiseRecipes(fetchedRecipes);
      setGroceryList(categorizedGroceryList);

      // Cache removed - always fetch fresh data for consistency

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

  // Simplified - always fetch fresh data from API
  const fetchMiseData = useCallback(async () => {
    console.log('[MiseScreen] 🎯 fetchMiseData called - always fetching fresh data');
    await fetchMiseDataFromAPI();
  }, [fetchMiseDataFromAPI]);

  // Silent grocery list refresh without affecting recipes display
  const refreshGroceryListOnly = useCallback(async () => {
    if (!session?.user?.id || !session.access_token) return;
    
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) return;
      
      console.log('[MiseScreen] 🛒 Silently refreshing grocery list');
      
      const groceryResponse = await fetch(
        `${backendUrl}/api/mise/grocery-list?userId=${session.user.id}`, 
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (groceryResponse.ok) {
        const groceryData = await groceryResponse.json();
        const categorizedGroceryList = convertToGroceryCategories(groceryData?.items || []);
        setGroceryList(categorizedGroceryList); // Only update grocery list, no loading states
        console.log('[MiseScreen] ✅ Grocery list silently refreshed after recipe deletion');
      } else {
        console.warn('[MiseScreen] Failed to refresh grocery list:', groceryResponse.statusText);
      }
    } catch (error) {
      console.warn('[MiseScreen] Failed to refresh grocery list after deletion:', error);
      // Fail silently - recipe deletion was successful, just grocery refresh failed
    }
  }, [session?.user?.id, session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      const timestamp = new Date().toISOString();
      console.log(`[MiseScreen] 🎯 useFocusEffect triggered at ${timestamp}`);
      console.log('[MiseScreen] 🔍 Focus effect context:', {
        sessionExists: !!session?.user?.id,
        currentSessionId: session?.user?.id,
        miseRecipesCount: miseRecipes.length,
        groceryListCount: groceryList.length,
        canGoBack: router.canGoBack(),
      });
      
      // UX improvement: Skip API call if coming from cook screen (no edits possible)
      if (router.canGoBack() && miseRecipes.length > 0) {
        console.log('[MiseScreen] 🎯 Navigation from cook screen detected - skipping API call');
        return;
      }
      
      // Fetch fresh data when screen comes into focus (first load or from other screens)
      console.log('[MiseScreen] 🔄 Navigation check - fetching fresh data');
      fetchMiseData();
    }, [fetchMiseData, router, miseRecipes.length])
  );



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

      // Update local recipes state immediately for instant UI feedback
      setMiseRecipes((prev) => prev.filter((r) => r.id !== recipeId));

      // Silently refresh grocery list to ensure it reflects the deletion
      await refreshGroceryListOnly();

      console.log(`[MiseScreen] Recipe ${recipeId} deleted successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[MiseScreen] Error deleting recipe:', err);
      showError('Error', errorMessage);
    }
  }, [session, showError, refreshGroceryListOnly]);

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
  const handleShareGrocery = useCallback(async () => {
    try {
      // Generate plain text format with clear intent
      let plainText = `GROCERY LIST\n\n`;

      // Add recipe titles if there are any recipes
      if (miseRecipes.length > 0) {
        plainText += `For these recipes:\n`;
        miseRecipes.forEach(recipe => {
          const title = recipe.title_override || recipe.prepared_recipe_data.title || 'Unknown Recipe';
          plainText += `- ${title}\n`;
        });
        plainText += '\n';
      }

      groceryList.forEach(category => {
        // Add category header
        plainText += `${category.name.toUpperCase()}\n`;
        
        // Add items with clear checkbox intent
        category.items.forEach(item => {
          const checkbox = item.checked ? '✓' : '□';
          const amount = item.amount ? `${item.amount}` : '';
          const unit = item.unit ? ` ${item.unit}` : '';
          const displayText = `${amount}${unit} ${item.name}`.trim();
          
          plainText += `${checkbox} ${displayText}\n`;
        });
        
        plainText += '\n'; // Add spacing between categories
      });

      console.log('Attempting to share grocery list:', plainText);

      await Share.share({
        message: plainText,
        title: 'Grocery List',
      });
      
      console.log('Share successful');
    } catch (error) {
      console.error('Share failed:', error);
      showError('Share Error', 'Failed to share grocery list');
    }
  }, [groceryList, miseRecipes, showError]);



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
    const displayTitle = item.title_override || item.prepared_recipe_data.title;

    return (
      <View style={[styles.card, styles.cardWithMinHeight]}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => {
            console.log('[MiseScreen] 🚀 Attempting to navigate to summary for recipe:', {
              recipeId: item.id,
              title: displayTitle,
              hasPreparedData: !!item.prepared_recipe_data,
              preparedDataKeys: Object.keys(item.prepared_recipe_data || {}),
              finalYield: item.final_yield,
              hasAppliedChanges: !!item.applied_changes,
              appliedChanges: item.applied_changes,
            });
            
            // Navigate to recipe summary with the prepared recipe data and mise entry point
            router.push({
              pathname: '/recipe/summary',
              params: {
                recipeData: JSON.stringify(item.prepared_recipe_data),
                entryPoint: 'mise',
                miseRecipeId: item.id, // Pass the mise recipe ID for future reference
                finalYield: item.final_yield.toString(),
                // Pass title_override for correct title display
                ...(item.title_override && {
                  titleOverride: item.title_override
                }),
                // Pass applied changes so the summary can restore the correct scaling factor
                ...(item.applied_changes && {
                  appliedChanges: JSON.stringify(item.applied_changes)
                }),
                // Pass original recipe data for consistent scaling
                ...(item.original_recipe_data && {
                  originalRecipeData: JSON.stringify(item.original_recipe_data)
                }),
              },
            });
            
            console.log('[MiseScreen] ✅ Navigation to summary completed');
          }}
        >
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            {(() => {
              const servingsCount = parseServingsValue(item.prepared_recipe_data.recipeYield);
              return servingsCount ? (
                <Text style={styles.servingsText}>(servings: {servingsCount})</Text>
              ) : null;
            })()}
          </View>
        </TouchableOpacity>
        
        {/* Trash icon */}
        <TouchableOpacity
          style={styles.trashIcon}
          onPress={() => handleDeleteRecipe(item.id)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="trash-can" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }, [handleDeleteRecipe, router]);

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
            size={24}
            color={groceryItem.checked ? COLORS.success : COLORS.secondary}
          />
          <Text style={[
            styles.groceryItemText,
            groceryItem.checked && styles.groceryItemChecked
          ]}>
            {groceryItem.amount ? `${formatAmountForGroceryDisplay(groceryItem.amount)}` : ''}
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

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="login"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Log in to see your mise</Text>
          <Text style={styles.emptySubtext}>
            Your mise recipes and shopping list will appear here once you're logged in.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.retryButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
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
            onPress={() => fetchMiseData()}
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
      <ScreenHeader title="Your prep station" />
      
      {/* Tab selector - underline style */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setSelectedTab('recipes')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'recipes' && styles.tabButtonTextActive
          ]}>
            Recipes
          </Text>
          {selectedTab === 'recipes' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setSelectedTab('grocery')}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'grocery' && styles.tabButtonTextActive
          ]}>
            Shopping List
          </Text>
          {selectedTab === 'grocery' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {/* Subheading for recipes tab */}
      {selectedTab === 'recipes' && (
        <Text style={styles.subheading}>
          Recipes you're getting ready to cook.
        </Text>
      )}

      {renderContent()}

      {/* Cooking Session Button - only show on recipes tab */}
      {selectedTab === 'recipes' && miseRecipes.length > 0 && (
        <TouchableOpacity
          style={styles.cookingSessionButton}
          onPress={() => router.push('/mise/cook')}
        >
        
          <Text style={styles.cookingSessionButtonText}>
            Cook your recipes
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Floating Action Button for sharing grocery list */}
      {selectedTab === 'grocery' && session && groceryList.length > 0 && (
        <TouchableOpacity
          style={styles.floatingActionButton}
          onPress={handleShareGrocery}
        >
          <MaterialCommunityIcons name="export" size={20} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>Share</Text>
        </TouchableOpacity>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  // Tab styles - underline style like ESPN+
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    marginBottom: SPACING.md,
  } as ViewStyle,
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: COLORS.background,
  } as ViewStyle,
  tabUnderline: {
    position: 'absolute',
    bottom: 2,
    height: 2,
    width: '60%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  } as ViewStyle,
  tabButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
    fontSize: FONT.size.body,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  } as TextStyle,
  tabButtonTextActive: {
    color: COLORS.textDark,
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
            fontFamily: FONT.family.libreBaskerville,
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
    paddingVertical: SPACING.lg, // Consistent vertical padding
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER_WIDTH.hairline,
    borderColor: COLORS.primaryLight,
    ...SHADOWS.small, // Add subtle elevation
  } as ViewStyle,
  recipeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  recipeInfo: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
  } as ViewStyle,
  recipeTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    marginBottom: SPACING.md, // Consistent spacing below title
  } as TextStyle,
  recipeTitleInput: {
    ...bodyStrongText,
    color: COLORS.textDark,
    borderBottomWidth: 1,
    borderColor: COLORS.primary,
    paddingBottom: 2,
  } as TextStyle,
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  } as ViewStyle,

  titleActions: {
    flexDirection: 'row',
  },
  recipeYield: {
    ...bodyText,
    color: COLORS.primary,
    fontSize: FONT.size.body, // Increased font size for better visibility
    marginTop: 2, // less space
  } as TextStyle,
  recipeActions: {
    flexDirection: 'column', // Stack icons vertically
    justifyContent: 'center', // Center them vertically
    marginLeft: SPACING.lg, // More space from the content
    paddingLeft: SPACING.sm, // Additional padding
  } as ViewStyle,
  actionButton: {
    padding: SPACING.sm, // Better touch target
    marginVertical: SPACING.xs, // Space between buttons when editing
  } as ViewStyle,
  deleteButton: {
    padding: SPACING.sm, // Better touch target
    alignSelf: 'center', // Center the delete button
  } as ViewStyle,

  // New card styles to match saved.tsx
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  } as ViewStyle,
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,
  trashIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 4,
  } as ViewStyle,
  cardWithMinHeight: {
    minHeight: 75,
  } as ViewStyle,
  cardImage: {
    width: SPACING.xxl + 8,
    height: SPACING.xxl + 8,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  cardTextContainer: {
    flex: 1,
  } as ViewStyle,
  cardTitle: {
    ...bodyStrongText,
    fontSize: FONT.size.body - 1,
    color: COLORS.textDark,
    lineHeight: 19,
    flexWrap: 'wrap',
  } as TextStyle,
  servingsText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    fontWeight: '400',
    marginTop: SPACING.xs,
  } as TextStyle,

  groceryContainer: {
    flex: 1,
  } as ViewStyle,
  groceryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  } as ViewStyle,
  groceryTitle: {
    ...sectionHeaderText,
    fontSize: FONT.size.lg,
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
    paddingVertical: SPACING.lg, // Consistent vertical padding
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: BORDER_WIDTH.hairline,
    borderColor: COLORS.primaryLight,
    ...SHADOWS.small,
  } as ViewStyle,
  groceryCategoryTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    marginBottom: SPACING.md, // Consistent spacing below header
    fontSize: FONT.size.lg,
  } as TextStyle,
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs, // Add 6-8px gap between items
  } as ViewStyle,
  groceryItemText: {
    ...bodyText,
    fontSize: FONT.size.bodyMedium,
    color: COLORS.textDark,
    marginLeft: SPACING.md,
    flex: 1,
  } as TextStyle,
  groceryItemChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.darkGray,
  } as TextStyle,
  floatingActionButton: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  } as ViewStyle,
  floatingButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.smBody,
    marginLeft: SPACING.xs,
  } as TextStyle,
  cookingSessionButton: {
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
  cookingSessionButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    marginLeft: SPACING.sm,
  } as TextStyle,
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