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
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  screenTitleText,
  bodyStrongText,
  bodyText,
  sectionHeaderText,
  FONT,
  captionText,
  metaText,
} from '@/constants/typography';
import { SHADOWS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useHandleError } from '@/hooks/useHandleError';
import { useAnalytics } from '@/utils/analytics';
import { useRenderCounter } from '@/hooks/useRenderCounter';
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
  preparation?: string | null; // Preparation method (e.g., "grated", "chopped", "diced")
};

type GroceryCategory = {
  name: string;
  items: GroceryItem[];
};

// Convert flat grocery items array to categorized format
const convertToGroceryCategories = (items: any[]): GroceryCategory[] => {
  const categories: { [key: string]: GroceryItem[] } = {};

    const eggItems = items.filter(item =>
    (item.item_name || item.name || '').toLowerCase().includes('egg')
  );

  items.forEach((item, index) => {
    const categoryName = item.grocery_category || 'Other';
    
    if (!categories[categoryName]) {
      categories[categoryName] = [];
    }
    
    // Fallback unit parsing when backend fails to extract compound units
    let finalUnit = item.display_unit || item.quantity_unit;
    
    // If unit is null but we have original text with compound units, try to extract them
    if (!finalUnit && item.original_ingredient_text && item.quantity_amount) {
      const originalText = item.original_ingredient_text.toLowerCase().trim();
      
      // Common compound unit patterns that backend often misses
      const compoundUnits = [
        { pattern: /(\d+(\.\d+)?)\s*ounce\s+can/i, unit: 'oz can' },
        { pattern: /(\d+(\.\d+)?)\s*oz\s+can/i, unit: 'oz can' },
        { pattern: /(\d+(\.\d+)?)\s*pound\s+bag/i, unit: 'lb bag' },
        { pattern: /(\d+(\.\d+)?)\s*lb\s+bag/i, unit: 'lb bag' },
        { pattern: /(\d+(\.\d+)?)\s*ounce\s+package/i, unit: 'oz package' },
        { pattern: /(\d+(\.\d+)?)\s*oz\s+package/i, unit: 'oz package' },
        { pattern: /(\d+(\.\d+)?)\s*ounce\s+jar/i, unit: 'oz jar' },
        { pattern: /(\d+(\.\d+)?)\s*oz\s+jar/i, unit: 'oz jar' },
      ];
      
      for (const { pattern, unit } of compoundUnits) {
        if (pattern.test(originalText)) {
          finalUnit = unit;
          break;
        }
      }
    }
    
    // Generate a stable ID based on item content, not array index
    const stableId = item.id || `${item.item_name || item.name}-${item.quantity_amount || '0'}-${finalUnit || 'unit'}-${categoryName}`;
    
    const groceryItem = {
      id: stableId,
      name: item.item_name || item.name,
      amount: item.quantity_amount,
      unit: finalUnit, // Use fallback unit if available
      category: categoryName,
      checked: item.is_checked || false,
      preparation: item.preparation || null, // Include preparation method
    };


    
    categories[categoryName].push(groceryItem);
  });
  
  // Convert to sorted array of categories
  return Object.entries(categories)
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      // Put common categories first
      const order = ['Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Pantry', 'Bakery', 'Frozen'];
      const aIndex = order.indexOf(a.name);
      const bIndex = order.indexOf(b.name);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
};

// Merge manual items into grocery categories
const mergeManualItemsIntoCategories = (
  recipeCategories: GroceryCategory[], 
  manualItems: ManualGroceryItem[]
): GroceryCategory[] => {
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
      name: manualItem.itemText,
      amount: null,
      unit: null,
      category: categoryName,
      checked: false,
      isManual: true,
      preparation: null, // Manual items don't have preparation info
    };
    
    mergedCategories[categoryName].push(groceryItem);
  });
  
  // Ensure a catch-all Miscellaneous category always exists, even if empty
  if (!mergedCategories['Miscellaneous']) {
    mergedCategories['Miscellaneous'] = [];
  }

  // Convert back to array format, include Miscellaneous even if empty
  const result = Object.entries(mergedCategories)
    .filter(([categoryName, items]) => categoryName === 'Miscellaneous' || items.length > 0)
    .map(([categoryName, items]) => ({
      name: categoryName,
      items: items,
    }));
  
  return result;
};

// Sort grocery items alphabetically (flatten all categories)
const sortGroceryItemsAlphabetically = (groceryCategories: GroceryCategory[]): GroceryCategory[] => {
  // Flatten all items from all categories
  const allItems = groceryCategories.flatMap(category => category.items);
  
  // Sort alphabetically by item name
  const sortedItems = allItems.sort((a, b) => a.name.localeCompare(b.name));
  
  // Return as a single "All Items" category
  const result = [{
    name: 'All Items',
    items: sortedItems
  }];
  
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
        
        // Special handling for pepper types - match pepper variations but not vegetable peppers
        if (stapleName === 'black pepper' || stapleName === 'ground pepper') {
          const vegetablePeppers = ['bell pepper', 'jalapeño', 'jalapeno', 'poblano', 'serrano', 'habanero', 'chili pepper', 'hot pepper', 'sweet pepper'];
          const isVegetablePepper = vegetablePeppers.some(vegPepper => itemName.includes(vegPepper));
          
          if (isVegetablePepper) {
            return false; // Don't filter out vegetable peppers
          }
          
          // Check for pepper variations that should be filtered
          const pepperVariations = ['freshly ground pepper', 'ground black pepper', 'black pepper', 'ground pepper'];
          const isPepperVariation = pepperVariations.some(pepper => itemName.includes(pepper));
          
          // Special case for standalone "pepper" - only match if it's exactly "pepper" or ends with " pepper"
          // This prevents matching "bell pepper", "jalapeño pepper", etc.
          const isStandalonePepper = itemName === 'pepper' || itemName.endsWith(' pepper');
          
          return isPepperVariation || isStandalonePepper;
        }
          
        // Special handling for salt - match all salt types
        if (stapleName === 'salt') {
          const saltVariations = ['salt', 'kosher salt', 'sea salt', 'table salt', 'iodized salt'];
          return saltVariations.some(salt => itemName.includes(salt));
        }
        
        // Special handling for flour - match flour variations
        if (stapleName === 'all purpose flour' || stapleName === 'all-purpose flour') {
          const flourVariations = ['all purpose flour', 'all-purpose flour', 'unbleached all purpose flour', 'unbleached all-purpose flour'];
          return flourVariations.some(flour => itemName.includes(flour));
        }
        
        // For other staples, do exact or substring matching
        return itemName === stapleName || itemName.includes(stapleName);
        
        return false;
      });
      
      return !isStaple;
    })
  })).filter(category => category.name === 'Miscellaneous' || category.items.length > 0); // Keep Miscellaneous even if empty
};

export default function MiseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  useRenderCounter('MiseScreen', { hasSession: !!session });
  const { showError } = useErrorModal();
  const handleError = useHandleError();
  const { track } = useAnalytics();
  const { hasResumableSession, state: cookingState, invalidateSession, initializeSessions, selectMiseRecipe } = useCooking();
  const [miseRecipes, setMiseRecipes] = useState<MiseRecipe[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryCategory[]>([]);
  const [manualItems, setManualItems] = useState<ManualGroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'recipes' | 'grocery'>('recipes');
  // Inline add state (replaces modal)
  const [inlineAddCategory, setInlineAddCategory] = useState<string | null>(null);
  const [inlineAddText, setInlineAddText] = useState<string>('');
  const [sortMode, setSortMode] = useState<'category' | 'alphabetical'>('category');
  const [staplesModalVisible, setStaplesModalVisible] = useState(false);
  const [staplesEnabled, setStaplesEnabled] = useState(false);
  const [selectedStaples, setSelectedStaples] = useState<string[]>([]);

  // Removed caching strategy - always fetch fresh data for consistency

  // Flag to prevent reloading manual items after clearing them
  const [manualItemsCleared, setManualItemsCleared] = useState(false);

  // FlatList ref for keyboard handling and scrolling
  const groceryListRef = useRef<FlatList>(null);

  // Load manual items from storage on component mount
  const loadManualItemsFromStorage = useCallback(async () => {
    // Don't reload if we just cleared them
    if (manualItemsCleared) {
      console.log('[MiseScreen] 🚫 Blocked loading manual items - flag is set');
      return;
    }
    
    console.log('[MiseScreen] 📖 Loading manual items from storage...');
    try {
      const items = await loadManualItems();
      setManualItems(items);
      console.log('[MiseScreen] ✅ Loaded', items.length, 'manual items');
    } catch (error) {
      // Track error without causing re-renders
      if (session?.user?.id) {
        track('mise_manual_items_load_error', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: session.user.id,
        });
      }
      // Don't show error to user for manual items - graceful degradation
      setManualItems([]);
      console.log('[MiseScreen] ❌ Error loading manual items, set to empty');
    }
  }, [manualItemsCleared]); // Add manualItemsCleared dependency

  // Load sort mode preference from storage (deprecated; always category)
  const loadSortModeFromStorage = useCallback(async () => {
    setSortMode('category');
  }, []);

  // Save sort mode preference (deprecated no-op)
  const saveSortModeToStorage = useCallback(async (_mode: 'category' | 'alphabetical') => {
    // no-op; alphabetical sorting removed
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
      }
      
      if (staplesStored) {
        const staples = JSON.parse(staplesStored);
        setSelectedStaples(staples);
      }
    } catch (error) {
      // Track error without causing re-renders
      if (session?.user?.id) {
        track('mise_staples_preferences_load_error', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: session.user.id,
        });
      }
    }
  }, []); // Remove dependencies to prevent infinite re-renders

  // Save household staples preferences to storage
  const saveStaplesPreferences = useCallback(async (enabled: boolean, staples: string[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STAPLES_ENABLED_KEY, enabled.toString()),
        AsyncStorage.setItem(HOUSEHOLD_STAPLES_KEY, JSON.stringify(staples)),
      ]);
    } catch (error) {
      // Track error without causing re-renders
      if (session?.user?.id) {
        track('mise_staples_preferences_save_error', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: session.user.id,
          enabled,
          staplesCount: staples.length,
        });
      }
    }
  }, []); // Remove dependencies to prevent infinite re-renders

  // Load preferences on component mount
  useEffect(() => {
    loadManualItemsFromStorage();
    loadSortModeFromStorage();
    loadStaplesPreferences();
  }, [loadManualItemsFromStorage, loadSortModeFromStorage, loadStaplesPreferences]);

  // Keep screen awake only when on grocery tab to prevent battery drain
  useEffect(() => {
    if (selectedTab === 'grocery') {
      const { activateKeepAwakeAsync, deactivateKeepAwake } = require('expo-keep-awake');
      activateKeepAwakeAsync();
      return () => deactivateKeepAwake();
    }
  }, [selectedTab]);

  // Removed loadCachedMiseData function - always fetch fresh data

  const fetchMiseDataFromAPI = useCallback(async () => {
    const startTime = performance.now();

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

      // First fetch recipes to ensure they exist
      const recipesResponse = await fetch(`${backendUrl}/api/mise/recipes?userId=${session.user.id}`, { headers });

      if (!recipesResponse.ok) {
        throw new Error(`Failed to fetch mise recipes: ${recipesResponse.statusText}`);
      }
      
      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then fetch grocery list based on those recipes
      const groceryResponse = await fetch(`${backendUrl}/api/mise/grocery-list?userId=${session.user.id}`, { headers });

      if (!groceryResponse.ok) {
        throw new Error(`Failed to fetch grocery list: ${groceryResponse.statusText}`);
      }
      
      const [recipesData, groceryData] = await Promise.all([
        recipesResponse.json(),
        groceryResponse.json(),
      ]);

      // Debug logging for backend data
      if (groceryData?.items) {
              const eggItems = groceryData.items.filter((item: any) =>
        (item.item_name || item.name || '').toLowerCase().includes('egg')
      );
      }

      const fetchedRecipes = recipesData?.recipes || [];

      const recipeCategorizedList = convertToGroceryCategories(groceryData?.items || []);
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, manualItems);



      setMiseRecipes(fetchedRecipes);
      setGroceryList(mergedGroceryList);

      // Clear manual items if no recipes are left in mise
      if (fetchedRecipes.length === 0 && manualItems.length > 0) {
        console.log('[MiseScreen] 🧹 No recipes left in mise, clearing manual items');
        clearAllManualItems();
        setManualItems([]);
        setManualItemsCleared(true); // Set flag to prevent re-loading
        console.log('[MiseScreen] 🚫 Set manualItemsCleared flag to true');
        // Update grocery list to only show empty state
        setGroceryList([]);
      } else if (fetchedRecipes.length > 0) {
        // Reset flag if recipes are present, allowing manual items to be loaded
        if (manualItemsCleared) {
          console.log('[MiseScreen] ✅ Recipes present, resetting manualItemsCleared flag');
        }
        setManualItemsCleared(false);
      }

      // Check if cooking session needs invalidation due to recipe changes or modifications
      if (cookingState.activeRecipes.length > 0) {
        const currentRecipeIds = cookingState.activeRecipes.map((r: any) => r.recipeId).sort();
        const freshRecipeIds = fetchedRecipes.map((r: any) => String(r.id)).sort();
        console.log('[CTX] Checking for recipe changes:', { currentRecipeIds, freshRecipeIds });
        
        // Check if recipe IDs changed (added/removed recipes)  
        const lengthChanged = currentRecipeIds.length !== freshRecipeIds.length;
        const orderChanged = !currentRecipeIds.every((id: string, index: number) => id === freshRecipeIds[index]);
        const idsChanged = lengthChanged || orderChanged;
        
        // Check if recipe content changed (serving size, ingredients, etc.)
        let recipeContentChanged = false;
        if (!idsChanged && currentRecipeIds.length > 0) {
          // Compare recipe content for existing recipes
          for (const freshRecipe of fetchedRecipes) {
            const freshId = String(freshRecipe.id);
            const currentRecipe = cookingState.activeRecipes.find(r => r.recipeId === freshId);
            
            if (currentRecipe && currentRecipe.recipe) {
              const freshData = freshRecipe.prepared_recipe_data || freshRecipe.original_recipe_data;
              const currentData = currentRecipe.recipe;
              
              // Compare key fields that indicate recipe modifications
              const freshTitle = freshRecipe.title_override || freshData?.title;
              const currentTitle = currentData.title;
              const freshYield = freshData?.recipeYield;
              const currentYield = currentData.recipeYield;
              const freshIngredientsCount = freshData?.ingredientGroups?.reduce((sum: number, group: any) => 
                sum + (group.ingredients?.length || 0), 0) || 0;
              const currentIngredientsCount = currentData.ingredientGroups?.reduce((sum: number, group: any) => 
                sum + (group.ingredients?.length || 0), 0) || 0;
              const freshInstructionsCount = freshData?.instructions?.length || 0;
              const currentInstructionsCount = currentData.instructions?.length || 0;
              
              // Compare ingredient content (not just count) - detect bacon → turkey bacon changes
              let ingredientContentChanged = false;
              if (freshIngredientsCount === currentIngredientsCount && freshIngredientsCount > 0) {
                // Create simplified ingredient signatures for comparison
                const getFlatIngredients = (ingredientGroups: any[]) => {
                  return ingredientGroups?.flatMap(group => 
                    group.ingredients?.map((ing: any) => ({
                      name: ing.name?.toLowerCase().trim(),
                      amount: ing.amount,
                      unit: ing.unit?.toLowerCase().trim(),
                      preparation: ing.preparation?.toLowerCase().trim()
                    })) || []
                  ) || [];
                };
                
                const freshIngredients = getFlatIngredients(freshData?.ingredientGroups || []);
                const currentIngredients = getFlatIngredients(currentData.ingredientGroups || []);
                
                // Compare ingredient signatures
                if (freshIngredients.length === currentIngredients.length) {
                  for (let i = 0; i < freshIngredients.length; i++) {
                    const fresh = freshIngredients[i];
                    const current = currentIngredients[i];
                    
                    if (fresh.name !== current.name ||
                        fresh.amount !== current.amount ||
                        fresh.unit !== current.unit ||
                        fresh.preparation !== current.preparation) {
                      console.log('[MiseScreen] 🥓 Ingredient content changed:', {
                        index: i,
                        fresh: fresh,
                        current: current
                      });
                      ingredientContentChanged = true;
                      break;
                    }
                  }
                }
              }
              
              if (freshTitle !== currentTitle ||
                  freshYield !== currentYield ||
                  freshIngredientsCount !== currentIngredientsCount ||
                  freshInstructionsCount !== currentInstructionsCount ||
                  ingredientContentChanged) {
                recipeContentChanged = true;
                break;
              }
            }
          }
        }
        
        if (idsChanged || recipeContentChanged) {
          track('mise_cooking_session_invalidated', {
            idsChanged,
            recipeContentChanged,
            currentRecipesCount: currentRecipeIds.length,
            freshRecipesCount: freshRecipeIds.length,
            userId: session?.user?.id,
          });
          console.log('[CTX] Invalidating cooking session due to recipe changes');
          invalidateSession();
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
      track('mise_data_fetch_performance', {
        durationMs: totalTime,
        userId: session?.user?.id,
        success: !error,
      });
    }
  }, []); // Remove dependencies to prevent infinite re-renders

  // Simplified - always fetch fresh data from API
  const fetchMiseData = useCallback(async () => {
    await fetchMiseDataFromAPI();
  }, [fetchMiseDataFromAPI]);

  // Silent grocery list refresh without affecting recipes display
  const refreshGroceryListOnly = useCallback(async () => {
    if (!session?.user?.id || !session.access_token) return;
    
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) return;
      
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
      } else {
        if (session?.user?.id) {
          track('mise_grocery_refresh_error', {
            statusText: groceryResponse.statusText,
            status: groceryResponse.status,
            userId: session.user.id,
          });
        }
      }
    } catch (error) {
      if (session?.user?.id) {
        track('mise_grocery_refresh_exception', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: session.user.id,
        });
      }
      // Fail silently - recipe deletion was successful, just grocery refresh failed
    }
  }, []); // Remove dependencies to prevent infinite re-renders

  useFocusEffect(
    useCallback(() => {
      // Always fetch fresh data to ensure deletion detection works properly
      // Previous optimization skipped API calls from cook screen, but this prevented
      // deletion detection when users deleted recipes and returned to cook
      fetchMiseData();
      
      // Also refresh grocery list to catch ingredient changes from recipe modifications
      if (session?.user?.id && session.access_token) {
        console.log('[MiseScreen] 🔄 Refreshing grocery list on focus to catch ingredient changes');
        refreshGroceryListOnly();
      }
    }, []) // Remove dependencies to prevent infinite re-renders
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
        prev.map((r) => (String(r.id) === String(recipeId) ? { ...r, is_completed: isCompleted } : r))
      );
      
      track('mise_recipe_completion_updated', {
        recipeId,
        isCompleted,
        userId: session?.user?.id,
      });
    } catch (err) {
      track('mise_recipe_completion_error', {
        recipeId,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        userId: session?.user?.id,
      });
      handleError('Recipe Error', err);
    }
  }, [session, showError, track]);

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

      track('mise_recipe_deleted', {
        recipeId,
        userId: session?.user?.id,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      track('mise_recipe_deletion_error', {
        recipeId,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        userId: session?.user?.id,
      });
      handleError('Error', err);
    }
  }, [session, showError, refreshGroceryListOnly, track]);

  // Handle grocery item toggle
  const handleGroceryToggle = useCallback((itemId: string) => {
    // Optimistically update local state for instant feedback
    const updatedList = [...groceryList];
    
    // Find item by ID instead of index for stable identification
    let itemToUpdate: GroceryItem | null = null;
    let categoryIndex = -1;
    let itemIndex = -1;
    
    for (let i = 0; i < updatedList.length; i++) {
      const category = updatedList[i];
      const foundIndex = category.items.findIndex(item => item.id === itemId);
      if (foundIndex !== -1) {
        itemToUpdate = category.items[foundIndex];
        categoryIndex = i;
        itemIndex = foundIndex;
        break;
      }
    }
    
    if (!itemToUpdate) return;

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
          itemName: itemToUpdate!.name,
          isChecked: newCheckedState,
        }),
      }).catch(err => {
        track('mise_grocery_item_toggle_error', {
          itemName: itemToUpdate!.name,
          isChecked: newCheckedState,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          userId: session.user.id,
        });
        // Optionally, revert the optimistic update and show an error
        handleError('Sync Error', err);
        itemToUpdate!.checked = !newCheckedState;
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
          
          // Add "(as needed)" for items with no amount
          const asNeededText = (!item.amount && !amount) ? '(as needed)' : '';
          
          // Build display text with preparation
          const amountPart = `${amount}${unit}`;
          const preparationPart = item.preparation || '';
          
          // Combine with proper comma handling
          let displayText = item.name.toLowerCase();
          if (amountPart && preparationPart) {
            displayText = `${item.name.toLowerCase()} - ${amountPart}, ${preparationPart}`;
          } else if (amountPart) {
            displayText = `${item.name.toLowerCase()} - ${amountPart}`;
          } else if (preparationPart) {
            displayText = `${item.name.toLowerCase()} - ${preparationPart}`;
          } else if (asNeededText) {
            displayText = `${item.name.toLowerCase()} - ${asNeededText}`;
          }
          
          plainText += `${checkbox} ${displayText}\n`;
        });
        
        plainText += '\n'; // Add spacing between categories
      });

      // Add footer
      plainText += '\nMade with help from Meez';

      await Share.share({
        message: plainText,
        title: 'Grocery List',
      });
    } catch (error) {
      track('mise_grocery_share_error', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: session?.user?.id,
      });
      handleError('Share Error', error);
    }
  }, [groceryList, miseRecipes, showError, staplesEnabled, selectedStaples, sortMode, track, session?.user?.id]);

  // Manual item management functions
  const handleAddManualItem = useCallback(async (category: string, itemText: string) => {
    try {
      const newItem = await addManualItem(category, itemText);
      
      // Reset the cleared flag since we're adding items again
      setManualItemsCleared(false);
      
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
          is_checked: item.checked,
          preparation: item.preparation // Preserve preparation information
        }))
      ));
      const updatedManualItems = [...manualItems, newItem];
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, updatedManualItems);
      setGroceryList(mergedGroceryList);
    } catch (error) {
      track('mise_manual_item_add_error', {
        category,
        itemText,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: session?.user?.id,
      });
      handleError('Error', error);
    }
  }, [manualItems, groceryList, showError, track, session?.user?.id]);

  const handleDeleteManualItem = useCallback(async (itemId: string) => {
    try {
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
          is_checked: item.checked,
          preparation: item.preparation // Preserve preparation information
        }))
      ));
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, updatedManualItems);
      setGroceryList(mergedGroceryList);
    } catch (error) {
      track('mise_manual_item_delete_error', {
        itemId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: session?.user?.id,
      });
      handleError('Error', error);
    }
  }, [manualItems, groceryList, showError, track, session?.user?.id]);

  const handleClearAllManualItems = useCallback(async () => {
    try {
      await clearAllManualItems();
      
      // Update local state
      setManualItems([]);
      setManualItemsCleared(true); // Set flag to prevent re-loading
      
      // Re-merge grocery list without manual items
      const recipeCategorizedList = convertToGroceryCategories(groceryList.flatMap(cat => 
        cat.items.filter(item => !item.isManual).map(item => ({
          id: item.id,
          item_name: item.name,
          quantity_amount: item.amount,
          display_unit: item.unit,
          grocery_category: item.category,
          is_checked: item.checked,
          preparation: item.preparation // Preserve preparation information
        }))
      ));
      const mergedGroceryList = mergeManualItemsIntoCategories(recipeCategorizedList, []);
      setGroceryList(mergedGroceryList);
    } catch (error) {
      track('mise_manual_items_clear_error', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: session?.user?.id,
      });
      handleError('Error', error);
    }
  }, [groceryList, showError, track, session?.user?.id]);

  // Inline add handlers
  const handleStartInlineAdd = useCallback((categoryName: string) => {
    setInlineAddCategory(categoryName);
    setInlineAddText('');

    // Scroll to the category being edited to ensure input is visible when keyboard opens
    if (groceryListRef.current) {
      // Find the index of the category being edited
      const categoryIndex = groceryList.findIndex(category => category.name === categoryName);
      if (categoryIndex !== -1) {
        // Add a small delay to allow state to update before scrolling
        setTimeout(() => {
          groceryListRef.current?.scrollToIndex({
            index: categoryIndex,
            animated: true,
            viewPosition: 0.3, // Position category at 30% from top to ensure input field is visible
          });
        }, 100);
      }
    }
  }, [groceryList]);

  const handleCancelInlineAdd = useCallback(() => {
    setInlineAddCategory(null);
    setInlineAddText('');
  }, []);

  const handleConfirmInlineAdd = useCallback(async () => {
    if (!inlineAddCategory || !inlineAddText.trim()) {
      setInlineAddCategory(null);
      setInlineAddText('');
      return;
    }
    await handleAddManualItem(inlineAddCategory, inlineAddText.trim());
    setInlineAddCategory(null);
    setInlineAddText('');
  }, [inlineAddCategory, inlineAddText, handleAddManualItem]);

  // Sort mode toggle (deprecated)
  const handleToggleSortMode = useCallback(async () => {
    setSortMode('category');
  }, []);

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
  }, [saveStaplesPreferences]);



  // Render recipe item
  const renderRecipeItem = useCallback(({ item }: { item: MiseRecipe }) => {
    const displayTitle = item.title_override || item.prepared_recipe_data.title;

    const handleRecipePress = () => {
      router.push({
        pathname: '/recipe/summary',
        params: {
          recipeId: item.prepared_recipe_data.id?.toString(),
          entryPoint: 'mise',
          miseRecipeId: item.id,
          appliedChanges: item.applied_changes ? JSON.stringify(item.applied_changes) : undefined,
          titleOverride: item.title_override,
          originalRecipeData: item.original_recipe_data ? JSON.stringify(item.original_recipe_data) : undefined,
        },
      });
    };

    return (
      <TouchableOpacity
        style={[styles.card, styles.cardWithMinHeight]}
        onPress={handleRecipePress}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
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
        </View>

        {/* Trash icon */}
        <TouchableOpacity
          style={styles.trashIcon}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteRecipe(item.id);
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="trash-can" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [handleDeleteRecipe, router]);

  // Render grocery category
  const renderGroceryCategory = useCallback(({ item }: { item: GroceryCategory }) => {
    // Separate checked and unchecked items, then sort alphabetically within each group
    const uncheckedItems = item.items
      .filter(item => !item.checked)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const checkedItems = item.items
      .filter(item => item.checked)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // Helper function to render individual grocery item
    const renderGroceryItem = (groceryItem: GroceryItem, index: number, isLastInGroup: boolean) => (
      <TouchableOpacity
        key={groceryItem.id}
        style={[
          styles.groceryItem,
          isLastInGroup && styles.groceryItemLast
        ]}
        onPress={() => handleGroceryToggle(groceryItem.id)}
        activeOpacity={0.8}
      >
        <View style={styles.groceryItemCheckbox}>
          <MaterialCommunityIcons
            name={groceryItem.checked ? "checkbox-marked" : "checkbox-blank-outline"}
            size={28}
            color={groceryItem.checked ? COLORS.primary : COLORS.textMuted}
          />
        </View>

        <View style={styles.groceryItemTextContainer}>
          <Text
            style={[
              styles.groceryItemText,
              groceryItem.checked && styles.groceryItemChecked
            ]}
          >
            {groceryItem.name.toLowerCase()}
          </Text>
          <Text
            style={[
              styles.groceryItemSubtext,
              groceryItem.checked && styles.groceryItemChecked
            ]}
          >
            {(() => {
              // Manual items: show a consistent subtext
              if (groceryItem.isManual) {
                return '(manually added)';
              }

              const amountText = groceryItem.amount ? formatAmountForGroceryDisplay(groceryItem.amount) : '';
              const unitText = groceryItem.unit ? ` ${groceryItem.unit}` : '';

              // Add "(as needed)" for items with no amount
              const asNeededText = (!groceryItem.amount && !amountText) ? '(as needed)' : '';

              // Build subtext parts
              const amountPart = `${amountText}${unitText}`;
              const preparationPart = groceryItem.preparation || '';

              // Combine with proper comma handling
              let subtext = '';
              if (amountPart && preparationPart) {
                subtext = `${amountPart}, ${preparationPart}`;
              } else if (amountPart) {
                subtext = amountPart;
              } else if (preparationPart) {
                subtext = preparationPart;
              } else if (asNeededText) {
                subtext = asNeededText;
              }

              return subtext;
            })()}
          </Text>
        </View>

        {groceryItem.isManual && (
          <TouchableOpacity
            onPress={() => handleDeleteManualItem(groceryItem.id)}
            style={styles.deleteManualButton}
          >
            <MaterialCommunityIcons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );

    return (
      <View style={styles.groceryCategory}>
        <View style={styles.groceryCategoryHeader}>
          <Text style={styles.groceryCategoryTitle}>{item.name}</Text>
          {/* Hide add button in alphabetical mode since "All Items" isn't a real category */}
          {sortMode === 'category' && (
            <TouchableOpacity
              onPress={() => handleStartInlineAdd(item.name)}
              style={styles.addButton}
            >
              <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Unchecked items (need to get) */}
        {uncheckedItems.map((groceryItem, index) => {
          const isLastUnchecked = index === uncheckedItems.length - 1 && checkedItems.length === 0 && inlineAddCategory !== item.name;
          return renderGroceryItem(groceryItem, index, isLastUnchecked);
        })}

        {/* Inline add row for this category - only show if there are unchecked items or no items at all */}
        {inlineAddCategory === item.name && (
          <View style={[
            styles.groceryItem,
            uncheckedItems.length === 0 && checkedItems.length === 0 && styles.groceryItemLast
          ]}>
            <View style={styles.groceryItemCheckbox}>
              <MaterialCommunityIcons
                name="checkbox-blank-outline"
                size={28}
                color={COLORS.textMuted}
              />
            </View>
            <View style={[styles.groceryItemTextContainer, { flexDirection: 'row', alignItems: 'center' }] }>
              <TextInput
                style={[styles.inlineTextInput, inlineAddText.length > 0 && styles.inlineTextInputTyped]}
                value={inlineAddText}
                onChangeText={setInlineAddText}
                returnKeyType="done"
                onSubmitEditing={handleConfirmInlineAdd}
                multiline={false}
                blurOnSubmit
                autoFocus
              />
              <TouchableOpacity onPress={handleConfirmInlineAdd} style={styles.inlineIconButton}>
                <MaterialCommunityIcons name="check" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelInlineAdd} style={styles.inlineIconButton}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Checked items at the bottom */}
        {checkedItems.length > 0 && (
          <>
            {checkedItems.map((groceryItem, index) => {
              const isLastChecked = index === checkedItems.length - 1;
              return renderGroceryItem(groceryItem, index, isLastChecked);
            })}
          </>
        )}
      </View>
    );
  }, [handleGroceryToggle, handleStartInlineAdd, handleDeleteManualItem, inlineAddCategory, inlineAddText, handleConfirmInlineAdd, handleCancelInlineAdd, sortMode]);

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
            Your mise recipes and shopping list will appear here once you&apos;re logged in.
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
          <Text style={styles.emptyText}>Couldn&apos;t load mise recipes</Text>
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
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <MaterialCommunityIcons
                name="chef-hat"
                size={64}
                color={COLORS.primary}
              />
              <Text style={styles.heroTitle}>Your Prep Area</Text>
              <Text style={styles.heroSubtitle}>
                Add recipes here to make a shopping list and follow multiple recipes at once
              </Text>
            </View>
            
            {/* CTA Section */}
            <View style={styles.ctaSection}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => router.push('/tabs')}
              >
                <Text style={styles.primaryButtonText}>Import Recipes</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => router.push('/tabs/library')}
              >
                <Text style={styles.secondaryButtonText}>My recipes</Text>
              </TouchableOpacity>
            </View>
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

      // Always render the grocery list; ensure there's always a Miscellaneous category
      if (displayGroceryList.length === 0) {
        displayGroceryList = [{ name: 'Miscellaneous', items: [] }];
      }

      return (
        <KeyboardAvoidingView
          style={styles.groceryContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <FlatList
            ref={groceryListRef}
            data={displayGroceryList}
            renderItem={renderGroceryCategory}
            keyExtractor={(item) => `category-${item.name}-${item.items.length}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {
                  if (session?.user?.id && session.access_token) {
                    console.log('[MiseScreen] 🔄 Manual grocery list refresh');
                    refreshGroceryListOnly();
                  }
                }}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
          />
        </KeyboardAvoidingView>
      );
    }
  };

  // Handle cooking session start
  const handleCookMyRecipes = useCallback(() => {
    if (miseRecipes.length === 0) {
      return; // No recipes to cook
    }

    console.log('[MiseScreen] Starting cooking session with recipes:', miseRecipes.map(r => ({ 
      id: r.id, 
      title: r.title_override || r.prepared_recipe_data?.title || 'Untitled Recipe' 
    })));

    // 1) Seed cooking context with the selected mise items
    // The initializeSessions method will convert mise recipes to proper recipe objects
    console.log('[CTX] initializeSessions with miseRecipes:', miseRecipes.map(r => ({ id: r.id, title: r.title_override || r.prepared_recipe_data?.title })));
    initializeSessions(miseRecipes);

    // 2) Navigate to cook screen (no params needed - context will bootstrap)
    router.push('/mise/cook');
  }, [miseRecipes, initializeSessions, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Prep Station" showBack={false} />
      
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
            Menu
          </Text>
          {/* underline removed */}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            setSelectedTab('grocery');
            // Refresh grocery list when switching to grocery tab to catch ingredient changes
            if (session?.user?.id && session.access_token) {
              console.log('[MiseScreen] 🔄 Refreshing grocery list on tab switch');
              refreshGroceryListOnly();
            }
          }}
        >
          <Text style={[
            styles.tabButtonText,
            selectedTab === 'grocery' && styles.tabButtonTextActive
          ]}>
            Groceries
          </Text>
          {/* underline removed */}
        </TouchableOpacity>
      </View>



      {/* Controls for grocery tab */}
      {selectedTab === 'grocery' && groceryList.length > 0 && (
        <View style={styles.groceryControls}>
          {session && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareGrocery}
            >
              <MaterialCommunityIcons name="export" size={16} color={COLORS.white} />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.staplesSettingsButton}
            onPress={handleOpenStaplesModal}
            accessibilityLabel="Pantry settings"
            accessibilityHint="Opens pantry selection settings"
          >
            <MaterialCommunityIcons name="tune" size={16} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.staplesButton,
              !staplesEnabled && styles.staplesButtonDisabled,
            ]}
            onPress={handleToggleStaples}
          >
            <Text
              style={[
                styles.staplesButtonText,
                !staplesEnabled && styles.staplesButtonTextDisabled,
              ]}
            >
              {staplesEnabled ? 'Show pantry' : 'Hide pantry'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {renderContent()}

      {/* Cooking Session Button - only show on recipes tab */}
      {selectedTab === 'recipes' && miseRecipes.length > 0 && (
        <TouchableOpacity
          style={styles.cookingSessionButton}
          onPress={handleCookMyRecipes}
        >
          <Text style={styles.cookingSessionButtonText}>
            Cook your recipes
          </Text>
        </TouchableOpacity>
      )}
      


      {/* Household Staples Modal */}
      <HouseholdStaplesModal
        visible={staplesModalVisible}
        onClose={handleCloseStaplesModal}
        selectedStaples={selectedStaples}
        onStaplesChange={handleStaplesChange}
        staplesEnabled={staplesEnabled}
        onStaplesToggle={handleToggleStaples}
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
    color: COLORS.primary,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  } as ViewStyle,
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  } as ViewStyle,
  heroTitle: {
    ...bodyStrongText,
    fontSize: FONT.size.screenTitle,
    color: COLORS.textDark,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    textAlign: 'center',
  } as TextStyle,
  heroSubtitle: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: FONT.size.body,
    maxWidth: 320,
  } as TextStyle,

  ctaSection: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.sm,
  } as ViewStyle,
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.sm,
    width: '100%',
    maxWidth: 280,
  } as ViewStyle,
  primaryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    width: '100%',
    maxWidth: 280,
  } as ViewStyle,
  secondaryButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,

  emptyText: {
            fontFamily: FONT.family.heading,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  } as TextStyle,
  emptySubtext: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
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
  groceryCategory: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.lg, // Consistent vertical padding
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg, // Increased spacing between categories
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
    fontSize: FONT.size.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  addButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md, // Increased padding for even spacing
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  } as ViewStyle,

  groceryItemCheckbox: {
    marginRight: SPACING.sm,
    alignSelf: 'center',
  } as ViewStyle,

  groceryItemTextContainer: {
    flex: 1,
    flexDirection: 'column',
  } as ViewStyle,
  groceryItemText: {
    ...bodyText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
  } as TextStyle,
  groceryItemSubtext: {
    ...metaText,
    color: COLORS.textMuted,
    marginTop: 4,
  } as TextStyle,
  groceryItemPreparation: {
    ...bodyText,
    fontSize: FONT.size.caption - 1,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  } as TextStyle,
  groceryItemLast: {
    borderBottomWidth: 0, // Remove border for last item
    marginBottom: 0, // Remove bottom margin for last item
  } as ViewStyle,
  groceryItemChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.darkGray,
  } as TextStyle,
  deleteManualButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  } as ViewStyle,
  inlineTextInput: {
    flex: 1,
    fontFamily: FONT.family.body,
    fontSize: FONT.size.body,
    lineHeight: 22, // iOS optical alignment for Inter 16
    height: 28, // match checkbox size for vertical alignment
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    paddingTop: 2,
    paddingBottom: 0,
    paddingHorizontal: 0,
    color: COLORS.textDark,
    backgroundColor: 'transparent',
    textAlignVertical: 'center' as any,
  } as TextStyle,
  // Nudge baseline by 1px only once text is present to eliminate the tiny perceived droop
  inlineTextInputTyped: {
    paddingTop: 0,
    transform: [{ translateY: -1 }],
  } as TextStyle,
  inlineIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  } as ViewStyle,

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
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    flex: 1,
    marginHorizontal: SPACING.xs,
  } as ViewStyle,
  
  sortToggleText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.white,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,


  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.xs,
  } as ViewStyle,
  shareButtonText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.white,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,
  staplesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginLeft: 0,
    minWidth: 120,
  } as ViewStyle,
  staplesButtonText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.white,
    fontWeight: '500',
    minWidth: 0,
    textAlign: 'center',
  } as TextStyle,
  staplesButtonDisabled: {
    backgroundColor: COLORS.white,
  } as ViewStyle,
  staplesButtonTextDisabled: {
    color: COLORS.primary,
  } as TextStyle,
  staplesSettingsButton: {
    height: 32,
    width: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  } as ViewStyle,

}); 