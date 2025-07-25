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
import { getUnitDisplayName } from '@/utils/units';
import { 
  loadManualItems, 
  addManualItem, 
  deleteManualItem, 
  clearAllManualItems,
  ManualGroceryItem 
} from '@/utils/manualGroceryStorage';
import AddManualItemModal from '@/components/AddManualItemModal';
import HouseholdStaplesModal from '@/components/HouseholdStaplesModal';

// Cache removed - always fetch fresh data for consistency

// AsyncStorage keys
const GROCERY_SORT_MODE_KEY = 'grocery_sort_mode';
const HOUSEHOLD_STAPLES_KEY = 'household_staples_filter';
const STAPLES_ENABLED_KEY = 'household_staples_enabled';

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
  isManual?: boolean; // Flag to identify manually added items
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
      original_ingredient_text: item.original_ingredient_text,
      quantity_amount: item.quantity_amount,
      quantity_unit: item.quantity_unit,
      display_unit: item.display_unit,
      raw_item_data: item // Log the entire raw item for debugging
    });
    
    if (!categories[categoryName]) {
      categories[categoryName] = [];
    }
    
    const groceryItem = {
      id: item.id || `item_${index}`,
      name: item.item_name || item.name,
      amount: item.quantity_amount,
      unit: item.display_unit || item.quantity_unit, // Use display_unit if available
      category: categoryName,
      checked: item.is_checked || false,
    };
    
    console.log(`[MiseScreen] 🛒 Created grocery item:`, {
      id: groceryItem.id,
      name: groceryItem.name,
      amount: groceryItem.amount,
      unit: groceryItem.unit,
      category: groceryItem.category,
      checked: groceryItem.checked
    });
    
    categories[categoryName].push(groceryItem);
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
      itemCount: cat.items.length,
      items: cat.items.map(item => ({
        name: item.name,
        amount: item.amount,
        unit: item.unit
      }))
    }))
  });
  
  return result;
};

// Merge manual items into grocery categories
const mergeManualItemsIntoCategories = (
  recipeCategories: GroceryCategory[], 
  manualItems: ManualGroceryItem[]
): GroceryCategory[] => {
  console.log('[MiseScreen] 🔄 Merging manual items into categories:', {
    recipeCategoriesCount: recipeCategories.length,
    manualItemsCount: manualItems.length
  });

  // Start with a copy of recipe categories
  const mergedCategories: { [key: string]: GroceryItem[] } = {};
  
  // Add all recipe categories
  recipeCategories.forEach(category => {
    mergedCategories[category.name] = [...category.items];
  });
  
  // Add manual items to appropriate categories
  manualItems.forEach(manualItem => {
    const categoryName = manualItem.category;
    
    // Create category if it doesn't exist
    if (!mergedCategories[categoryName]) {
      mergedCategories[categoryName] = [];
    }
    
    // Convert manual item to GroceryItem format
    const groceryItem: GroceryItem = {
      id: manualItem.id,
      name: `${manualItem.itemText} (manually added)`,
      amount: null,
      unit: null,
      category: categoryName,
      checked: false,
      isManual: true,
    };
    
    mergedCategories[categoryName].push(groceryItem);
  });
  
  // Only create "Miscellaneous" category if there are actually items to put in it
  // (Don't create empty categories)
  
  // Convert back to array format, but only include categories that have items
  const result = Object.entries(mergedCategories)
    .filter(([categoryName, items]) => items.length > 0) // Only include categories with items
    .map(([categoryName, items]) => ({
      name: categoryName,
      items: items,
    }));
  
  console.log('[MiseScreen] ✅ Merged categories result:', {
    categoryCount: result.length,
    categories: result.map(cat => ({
      name: cat.name,
      itemCount: cat.items.length,
      manualItemCount: cat.items.filter(item => item.isManual).length
    }))
  });
  
  return result;
};

// Sort grocery items alphabetically (flatten all categories)
const sortGroceryItemsAlphabetically = (groceryCategories: GroceryCategory[]): GroceryCategory[] => {
  console.log('[MiseScreen] 🔤 Sorting grocery items alphabetically...');
  
  // Flatten all items from all categories
  const allItems = groceryCategories.flatMap(category => category.items);
  
  // Sort alphabetically by item name
  const sortedItems = allItems.sort((a, b) => a.name.localeCompare(b.name));
  
  // Return as a single "All Items" category
  const result = [{
    name: 'All Items',
    items: sortedItems
  }];
  
  console.log('[MiseScreen] ✅ Alphabetically sorted', sortedItems.length, 'items');
  
  return result;
};

// Filter out household staples from grocery list
const filterHouseholdStaples = (
  categories: GroceryCategory[], 
  enabled: boolean, 
  selectedStaples: string[]
): GroceryCategory[] => {
  if (!enabled || selectedStaples.length === 0) {
    return categories;
  }
  
  console.log('[MiseScreen] 🏠 Filtering household staples:', {
    enabled,
    selectedStaplesCount: selectedStaples.length,
    selectedStaples: selectedStaples.slice(0, 3), // Log first 3 for debugging
  });
  
  return categories.map(category => ({
    ...category,
    items: category.items.filter(item => {
      // DEFENSIVE: Check if item and item.name exist and are strings
      if (!item || typeof item.name !== 'string') {
        console.warn('[MiseScreen] Invalid item in filterHouseholdStaples:', item);
        return true; // Keep the item if we can't validate it
      }
      
      const itemName = item.name.toLowerCase().trim();
      const isStaple = selectedStaples.some(staple => {
        // DEFENSIVE: Check if staple exists and is a string
        if (!staple || typeof staple !== 'string') {
          console.warn('[MiseScreen] Invalid staple in filterHouseholdStaples:', staple);
          return false; // Skip this staple comparison
        }
        
        const stapleName = staple.toLowerCase().trim();
        
        // Exact matches or very close matches
        if (itemName === stapleName || itemName.includes(stapleName)) {
                  // Special handling for pepper types - don't match vegetable peppers
        if (stapleName.includes('pepper') && !stapleName.includes('bell')) {
          const vegetablePeppers = ['bell pepper', 'jalapeño', 'jalapeno', 'poblano', 'serrano', 'habanero', 'chili pepper', 'hot pepper', 'sweet pepper'];
          const isVegetablePepper = vegetablePeppers.some(vegPepper => itemName.includes(vegPepper));
          
          // Also check for "freshly ground pepper" and similar variations
          if (stapleName === 'black pepper' || stapleName === 'ground pepper') {
            const pepperVariations = ['freshly ground pepper', 'ground black pepper', 'black pepper', 'ground pepper', 'pepper'];
            const isPepperVariation = pepperVariations.some(pepper => itemName.includes(pepper));
            return isPepperVariation; // Filter out all pepper variations
          }
          
          return !isVegetablePepper; // Only filter if it's NOT a vegetable pepper
        }
          
          // Special handling for "salt" - don't match specialized salts
          if (stapleName === 'salt') {
            const specializedSalts = ['sea salt', 'himalayan', 'kosher salt', 'table salt', 'iodized salt'];
            // If it's a basic salt, filter it out
            return itemName === 'salt' || specializedSalts.some(salt => itemName.includes(salt));
          }
          
          return true;
        }
        
        return false;
      });
      
      if (isStaple) {
        console.log('[MiseScreen] 🚫 Filtering out staple:', item.name);
      }
      
      return !isStaple;
    })
  })).filter(category => category.items.length > 0); // Remove empty categories
};

export default function MiseScreen() {
  console.error('[MiseScreen] 🧨 FRESH BUILD MARKER vB2 - added cooking session invalidation');
  
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { showError } = useErrorModal();
  const { hasResumableSession, state: cookingState, invalidateSession } = useCooking();
  const [miseRecipes, setMiseRecipes] = useState<MiseRecipe[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryCategory[]>([]);
  const [manualItems, setManualItems] = useState<ManualGroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'recipes' | 'grocery'>('recipes');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortMode, setSortMode] = useState<'category' | 'alphabetical'>('category');
  const [staplesModalVisible, setStaplesModalVisible] = useState(false);
  const [staplesEnabled, setStaplesEnabled] = useState(false);
  const [selectedStaples, setSelectedStaples] = useState<string[]>([]);

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

  // Load manual items from storage on component mount
  const loadManualItemsFromStorage = useCallback(async () => {
    try {
      console.log('[MiseScreen] 📖 Loading manual items from storage...');
      const items = await loadManualItems();
      setManualItems(items);
      console.log('[MiseScreen] ✅ Loaded', items.length, 'manual items');
    } catch (error) {
      console.error('[MiseScreen] ❌ Error loading manual items:', error);
      // Don't show error to user for manual items - graceful degradation
      setManualItems([]);
    }
  }, []);

  // Load sort mode preference from storage
  const loadSortModeFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(GROCERY_SORT_MODE_KEY);
      if (stored && (stored === 'category' || stored === 'alphabetical')) {
        setSortMode(stored as 'category' | 'alphabetical');
        console.log('[MiseScreen] 📖 Loaded sort mode:', stored);
      }
    } catch (error) {
      console.error('[MiseScreen] ❌ Error loading sort mode:', error);
      // Default to category mode on error
    }
  }, []);

  // Save sort mode preference to storage
  const saveSortModeToStorage = useCallback(async (mode: 'category' | 'alphabetical') => {
    try {
      await AsyncStorage.setItem(GROCERY_SORT_MODE_KEY, mode);
      console.log('[MiseScreen] 💾 Saved sort mode:', mode);
    } catch (error) {
      console.error('[MiseScreen] ❌ Error saving sort mode:', error);
    }
  }, []);

  // Load household staples preferences from storage
  const loadStaplesPreferences = useCallback(async () => {
    try {
      const [enabledStored, staplesStored] = await Promise.all([
        AsyncStorage.getItem(STAPLES_ENABLED_KEY),
        AsyncStorage.getItem(HOUSEHOLD_STAPLES_KEY),
      ]);
      
      if (enabledStored !== null) {
        setStaplesEnabled(enabledStored === 'true');
        console.log('[MiseScreen] 📖 Loaded staples enabled:', enabledStored === 'true');
      }
      
      if (staplesStored) {
        const staples = JSON.parse(staplesStored);
        setSelectedStaples(staples);
        console.log('[MiseScreen] 📖 Loaded selected staples:', staples.length, 'items');
      }
    } catch (error) {
      console.error('[MiseScreen] ❌ Error loading staples preferences:', error);
    }
  }, []);

  // Save household staples preferences to storage
  const saveStaplesPreferences = useCallback(async (enabled: boolean, staples: string[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STAPLES_ENABLED_KEY, enabled.toString()),
        AsyncStorage.setItem(HOUSEHOLD_STAPLES_KEY, JSON.stringify(staples)),
      ]);
      console.log('[MiseScreen] 💾 Saved staples preferences:', { enabled, staplesCount: staples.length });
    } catch (error) {
      console.error('[MiseScreen] ❌ Error saving staples preferences:', error);
    }
  }, []);

  // Load preferences on component mount
  useEffect(() => {
    loadManualItemsFromStorage();
    loadSortModeFromStorage();
    loadStaplesPreferences();
  }, [loadManualItemsFromStorage, loadSortModeFromStorage, loadStaplesPreferences]);

  // Removed loadCachedMiseData function - always fetch fresh data

  const fetchMiseDataFromAPI = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: MiseScreen] Start fetchMiseDataFromAPI at ${startTime.toFixed(2)}ms`);

    if (!session?.user) {
      console.warn('[MiseScreen] No user session found. Skipping fetch.');
      setIsLoading(false);
      setMiseRecipes([]);
      setGroceryList([]);
              setError('Please log in to access your prep station.');
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

      console.log('[MiseScreen] 🛒 Starting sequential fetch to avoid race conditions...');

      // First fetch recipes to ensure they exist
      console.log('[MiseScreen] 📋 Step 1: Fetching recipes...');
      const recipesResponse = await fetch(`${backendUrl}/api/mise/recipes?userId=${session.user.id}`, { headers });

      if (!recipesResponse.ok) {
        throw new Error(`Failed to fetch mise recipes: ${recipesResponse.statusText}`);
      }
      
      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then fetch grocery list based on those recipes
      console.log('[MiseScreen] 🛒 Step 2: Fetching grocery list...');
      const groceryResponse = await fetch(`${backendUrl}/api/mise/grocery-list?userId=${session.user.id}`, { headers });

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
          original_ingredient_text: item.original_ingredient_text,
          quantity_amount: item.quantity_amount,
          quantity_unit: item.quantity_unit,
          display_unit: item.display_unit
        })) || []
      });

      const recipeCategorizedList = convertToGroceryCategories(groceryData?.items || []);
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, manualItems);
      
      console.log('[MiseScreen] 🎯 Final grocery list with manual items:', {
        categoryCount: mergedGroceryList.length,
        categories: mergedGroceryList.map(cat => ({
          name: cat.name,
          itemCount: cat.items.length,
          manualItemCount: cat.items.filter(item => item.isManual).length,
          recipeItemCount: cat.items.filter(item => !item.isManual).length
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
      setGroceryList(mergedGroceryList);

      // Check if cooking session needs invalidation due to recipe changes
      if (cookingState.activeRecipes.length > 0) {
        const currentRecipeIds = cookingState.activeRecipes.map(r => r.recipeId).sort();
        const freshRecipeIds = fetchedRecipes.map((r: any) => String(r.id)).sort();
        
        const recipesChanged = currentRecipeIds.length !== freshRecipeIds.length ||
          !currentRecipeIds.every((id, index) => id === freshRecipeIds[index]);
        
        if (recipesChanged) {
          console.log('[MiseScreen] 🔄 Recipes changed - invalidating cooking session');
          console.log('[MiseScreen] 📊 Current cooking recipes:', currentRecipeIds);
          console.log('[MiseScreen] 📊 Fresh mise recipes:', freshRecipeIds);
          invalidateSession();
        } else {
          console.log('[MiseScreen] ✅ Recipes unchanged - keeping cooking session');
        }
      }

      // Cache removed - always fetch fresh data for consistency

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load prep station data';
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
        const recipeCategorizedList = convertToGroceryCategories(groceryData?.items || []);
        const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, manualItems);
        setGroceryList(mergedGroceryList); // Only update grocery list, no loading states
        console.log('[MiseScreen] ✅ Grocery list silently refreshed after recipe deletion');
      } else {
        console.warn('[MiseScreen] Failed to refresh grocery list:', groceryResponse.statusText);
      }
    } catch (error) {
      console.warn('[MiseScreen] Failed to refresh grocery list after deletion:', error);
      // Fail silently - recipe deletion was successful, just grocery refresh failed
    }
  }, [session?.user?.id, session?.access_token, manualItems]);

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

      // Use the same filtered list that's displayed (respects staples filter)  
      let shareGroceryList = groceryList;
      
      // Apply staples filtering if enabled (same as display logic)
      shareGroceryList = filterHouseholdStaples(shareGroceryList, staplesEnabled, selectedStaples);
      
      // Apply alphabetical sorting if enabled (same as display logic)
      if (sortMode === 'alphabetical') {
        shareGroceryList = sortGroceryItemsAlphabetically(shareGroceryList);
      }

      shareGroceryList.forEach(category => {
        // Add category header
        plainText += `${category.name.toUpperCase()}\n`;
        
        // Add items with clear checkbox intent
        category.items.forEach(item => {
          const checkbox = item.checked ? '✓' : '□';
          const amount = item.amount ? `${formatAmountForGroceryDisplay(item.amount)}` : '';
          const unitDisplay = getUnitDisplayName(item.unit as any, item.amount || 1);
          const unit = unitDisplay ? ` ${unitDisplay}` : '';
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
  }, [groceryList, miseRecipes, showError, staplesEnabled, selectedStaples, sortMode]);

  // Manual item management functions
  const handleAddManualItem = useCallback(async (category: string, itemText: string) => {
    try {
      console.log('[MiseScreen] ➕ Adding manual item:', { category, itemText });
      const newItem = await addManualItem(category, itemText);
      
      // Update local state
      setManualItems(prev => [...prev, newItem]);
      
      // Re-merge grocery list with new manual item
      const recipeCategorizedList = convertToGroceryCategories(groceryList.flatMap(cat => 
        cat.items.filter(item => !item.isManual).map(item => ({
          id: item.id,
          item_name: item.name,
          quantity_amount: item.amount,
          display_unit: item.unit,
          grocery_category: item.category,
          is_checked: item.checked
        }))
      ));
      const updatedManualItems = [...manualItems, newItem];
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, updatedManualItems);
      setGroceryList(mergedGroceryList);
      
      console.log('[MiseScreen] ✅ Manual item added and grocery list updated');
    } catch (error) {
      console.error('[MiseScreen] ❌ Error adding manual item:', error);
      showError('Error', 'Failed to add item. Please try again.');
    }
  }, [manualItems, groceryList, showError]);

  const handleDeleteManualItem = useCallback(async (itemId: string) => {
    try {
      console.log('[MiseScreen] 🗑️ Deleting manual item:', itemId);
      await deleteManualItem(itemId);
      
      // Update local state
      const updatedManualItems = manualItems.filter(item => item.id !== itemId);
      setManualItems(updatedManualItems);
      
      // Re-merge grocery list without deleted item
      const recipeCategorizedList = convertToGroceryCategories(groceryList.flatMap(cat => 
        cat.items.filter(item => !item.isManual).map(item => ({
          id: item.id,
          item_name: item.name,
          quantity_amount: item.amount,
          display_unit: item.unit,
          grocery_category: item.category,
          is_checked: item.checked
        }))
      ));
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, updatedManualItems);
      setGroceryList(mergedGroceryList);
      
      console.log('[MiseScreen] ✅ Manual item deleted and grocery list updated');
    } catch (error) {
      console.error('[MiseScreen] ❌ Error deleting manual item:', error);
      showError('Error', 'Failed to delete item. Please try again.');
    }
  }, [manualItems, groceryList, showError]);

  const handleClearAllManualItems = useCallback(async () => {
    try {
      console.log('[MiseScreen] 🧹 Clearing all manual items');
      await clearAllManualItems();
      
      // Update local state
      setManualItems([]);
      
      // Re-merge grocery list without manual items
      const recipeCategorizedList = convertToGroceryCategories(groceryList.flatMap(cat => 
        cat.items.filter(item => !item.isManual).map(item => ({
          id: item.id,
          item_name: item.name,
          quantity_amount: item.amount,
          display_unit: item.unit,
          grocery_category: item.category,
          is_checked: item.checked
        }))
      ));
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, []);
      setGroceryList(mergedGroceryList);
      
      console.log('[MiseScreen] ✅ All manual items cleared and grocery list updated');
    } catch (error) {
      console.error('[MiseScreen] ❌ Error clearing manual items:', error);
      showError('Error', 'Failed to clear items. Please try again.');
    }
  }, [groceryList, showError]);

  // Modal handlers
  const handleOpenAddModal = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setAddModalVisible(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setAddModalVisible(false);
    setSelectedCategory('');
  }, []);

  const handleAddItemFromModal = useCallback(async (itemText: string) => {
    await handleAddManualItem(selectedCategory, itemText);
  }, [handleAddManualItem, selectedCategory]);

  // Sort mode toggle
  const handleToggleSortMode = useCallback(async () => {
    const newMode = sortMode === 'category' ? 'alphabetical' : 'category';
    setSortMode(newMode);
    await saveSortModeToStorage(newMode);
  }, [sortMode, saveSortModeToStorage]);

  // Household staples toggle
  const handleToggleStaples = useCallback(async () => {
    if (!staplesEnabled) {
      // If enabling staples filter, open modal if no staples selected
      if (selectedStaples.length === 0) {
        setStaplesModalVisible(true);
        return;
      }
    }
    
    const newEnabled = !staplesEnabled;
    setStaplesEnabled(newEnabled);
    await saveStaplesPreferences(newEnabled, selectedStaples);
  }, [staplesEnabled, selectedStaples, saveStaplesPreferences]);

  // Staples modal handlers
  const handleOpenStaplesModal = useCallback(() => {
    setStaplesModalVisible(true);
  }, []);

  const handleCloseStaplesModal = useCallback(() => {
    setStaplesModalVisible(false);
  }, []);

  const handleStaplesChange = useCallback(async (staples: string[]) => {
    setSelectedStaples(staples);
    const enabled = staples.length > 0;
    setStaplesEnabled(enabled);
    await saveStaplesPreferences(enabled, staples);
    
    console.log('[MiseScreen] 🏠 Staples changed:', {
      staples,
      enabled,
      isDefaultSelection: staples.length === 2 && staples.includes('salt') && staples.includes('black pepper')
    });
  }, [saveStaplesPreferences]);

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
      <View style={styles.groceryCategoryHeader}>
        <Text style={styles.groceryCategoryTitle}>{item.name}</Text>
        {/* Hide add button in alphabetical mode since "All Items" isn't a real category */}
        {sortMode === 'category' && (
          <TouchableOpacity 
            onPress={() => handleOpenAddModal(item.name)}
            style={styles.addButton}
          >
            <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
      {item.items.map((groceryItem, index) => {
        // Add detailed logging for each grocery item being rendered
        console.log(`[MiseScreen] 🎨 Rendering grocery item:`, {
          id: groceryItem.id,
          name: groceryItem.name,
          amount: groceryItem.amount,
          unit: groceryItem.unit,
          amountFormatted: groceryItem.amount ? formatAmountForGroceryDisplay(groceryItem.amount) : 'null',
          unitDisplay: getUnitDisplayName(groceryItem.unit as any, groceryItem.amount || 1),
          finalDisplayText: `${groceryItem.amount ? formatAmountForGroceryDisplay(groceryItem.amount) : ''}${getUnitDisplayName(groceryItem.unit as any, groceryItem.amount || 1) ? ` ${getUnitDisplayName(groceryItem.unit as any, groceryItem.amount || 1)}` : ''}${groceryItem.amount || groceryItem.unit ? ' ' : ''}${groceryItem.name}`
        });
        
        return (
          <View key={groceryItem.id} style={styles.groceryItem}>
            <TouchableOpacity
              style={styles.groceryItemCheckbox}
              onPress={() => handleGroceryToggle(item.name, index)}
            >
              <MaterialCommunityIcons
                name={groceryItem.checked ? "checkbox-marked" : "checkbox-blank-outline"}
                size={24}
                color={groceryItem.checked ? COLORS.success : COLORS.secondary}
              />
            </TouchableOpacity>
            <Text 
              style={[
                styles.groceryItemText,
                groceryItem.checked && styles.groceryItemChecked
              ]}
              numberOfLines={0}
            >
              {(() => {
                const amountText = groceryItem.amount ? formatAmountForGroceryDisplay(groceryItem.amount) : '';
                const unitDisplay = getUnitDisplayName(groceryItem.unit as any, groceryItem.amount || 1);
                const unitText = unitDisplay ? ` ${unitDisplay}` : '';
                const spaceBeforeName = (amountText || unitText) ? ' ' : '';
                return `${amountText}${unitText}${spaceBeforeName}${groceryItem.name}`;
              })()}
            </Text>
            {groceryItem.isManual && (
              <TouchableOpacity
                onPress={() => handleDeleteManualItem(groceryItem.id)}
                style={styles.deleteManualButton}
              >
                <MaterialCommunityIcons name="close" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  ), [handleGroceryToggle, handleOpenAddModal, handleDeleteManualItem, sortMode]);

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
            <Text style={styles.emptyText}>No recipes in prep station</Text>
            <Text style={styles.emptySubtext}>
              Prepare a recipe to add it to your prep station.
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
      // Determine which data to use based on sort mode and staples filter
      let displayGroceryList = groceryList;
      
      // First apply staples filtering if enabled
      displayGroceryList = filterHouseholdStaples(displayGroceryList, staplesEnabled, selectedStaples);
      
      // Then apply sorting if alphabetical mode
      if (sortMode === 'alphabetical') {
        displayGroceryList = sortGroceryItemsAlphabetically(displayGroceryList);
      }

      // Check if the displayed list is empty (after filtering)
      if (displayGroceryList.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="cart-outline"
              size={48}
              color={COLORS.lightGray}
            />
            <Text style={styles.emptyText}>No grocery items</Text>
            <Text style={styles.emptySubtext}>
              {groceryList.length === 0 
                ? "Add recipes to your mise to see grocery items."
                : "All items are hidden by your staples filter."
              }
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.groceryContainer}>
          <FlatList
            data={displayGroceryList}
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

      {/* Controls for grocery tab */}
      {selectedTab === 'grocery' && groceryList.length > 0 && (
        <View style={styles.groceryControls}>
          <TouchableOpacity
            style={styles.sortToggle}
            onPress={handleToggleSortMode}
          >
            <Text style={styles.sortToggleText}>
              Sort: {sortMode === 'alphabetical' ? 'By Category' : 'A-Z'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.staplesControlsContainer}>
            <TouchableOpacity
              style={styles.staplesToggle}
              onPress={handleToggleStaples}
            >
              <Text style={styles.staplesToggleText}>
                {staplesEnabled ? 'Show Staples' : 'Hide Staples'}
              </Text>
            </TouchableOpacity>
            
            {selectedStaples.length > 0 && (
              <TouchableOpacity
                style={styles.staplesConfigButton}
                onPress={handleOpenStaplesModal}
              >
                <MaterialCommunityIcons name="format-list-checks" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
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

      {/* Add Manual Item Modal */}
      <AddManualItemModal
        visible={addModalVisible}
        onClose={handleCloseAddModal}
        onAdd={handleAddItemFromModal}
        categoryName={selectedCategory}
      />

      {/* Household Staples Modal */}
      <HouseholdStaplesModal
        visible={staplesModalVisible}
        onClose={handleCloseStaplesModal}
        selectedStaples={selectedStaples}
        onStaplesChange={handleStaplesChange}
      />

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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    paddingTop: '30%', // Move content higher up on the screen
  } as ViewStyle,
  emptyText: {
            fontFamily: FONT.family.ubuntu,
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
  groceryCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  } as ViewStyle,
  groceryCategoryTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.lg,
  } as TextStyle,
  addButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs, // Add 6-8px gap between items
  } as ViewStyle,
  groceryItemCheckbox: {
    marginRight: SPACING.md,
  } as ViewStyle,
  groceryItemText: {
    ...bodyText,
    fontSize: FONT.size.bodyMedium,
    color: COLORS.textDark,
    flex: 1,
  } as TextStyle,
  groceryItemChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.darkGray,
  } as TextStyle,
  deleteManualButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  } as ViewStyle,
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
  
  groceryControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 0,
  } as ViewStyle,
  
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  } as ViewStyle,
  
  sortToggleText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,

  staplesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primaryLight,
  } as ViewStyle,
  
  staplesToggleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  } as ViewStyle,
  
  staplesToggleText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.primary,
    fontWeight: '500',
  } as TextStyle,
  
  staplesToggleTextActive: {
    color: COLORS.white,
  } as TextStyle,
  
  staplesControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  
  staplesConfigButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_WIDTH.hairline,
    borderColor: COLORS.primaryLight,
    marginLeft: SPACING.xs,
  } as ViewStyle,

}); 