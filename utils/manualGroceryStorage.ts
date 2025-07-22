import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ManualGroceryItem {
  id: string;          // uuid
  category: string;    // grocery category name or "Miscellaneous"
  itemText: string;    // "3 rolls toilet paper"
  createdAt: string;   // ISO timestamp
}

const MANUAL_GROCERY_ITEMS_KEY = 'manual_grocery_items';

// Generate a simple UUID-like string
const generateId = (): string => {
  return 'manual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Load all manual grocery items from AsyncStorage
 */
export const loadManualItems = async (): Promise<ManualGroceryItem[]> => {
  try {
    console.log('[ManualStorage] 📖 Loading manual items from AsyncStorage...');
    const stored = await AsyncStorage.getItem(MANUAL_GROCERY_ITEMS_KEY);
    
    if (!stored) {
      console.log('[ManualStorage] 📋 No manual items found, returning empty array');
      return [];
    }
    
    const items: ManualGroceryItem[] = JSON.parse(stored);
    console.log('[ManualStorage] ✅ Loaded', items.length, 'manual items');
    return items;
  } catch (error) {
    console.error('[ManualStorage] ❌ Error loading manual items:', error);
    return []; // Return empty array on error for graceful fallback
  }
};

/**
 * Save all manual grocery items to AsyncStorage
 */
export const saveManualItems = async (items: ManualGroceryItem[]): Promise<void> => {
  try {
    console.log('[ManualStorage] 💾 Saving', items.length, 'manual items to AsyncStorage...');
    const serialized = JSON.stringify(items);
    await AsyncStorage.setItem(MANUAL_GROCERY_ITEMS_KEY, serialized);
    console.log('[ManualStorage] ✅ Manual items saved successfully');
  } catch (error) {
    console.error('[ManualStorage] ❌ Error saving manual items:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

/**
 * Add a new manual grocery item
 */
export const addManualItem = async (category: string, itemText: string): Promise<ManualGroceryItem> => {
  try {
    console.log('[ManualStorage] ➕ Adding manual item:', { category, itemText });
    
    // Validate inputs
    if (!itemText.trim()) {
      throw new Error('Item text cannot be empty');
    }
    if (!category.trim()) {
      throw new Error('Category cannot be empty');
    }
    
    // Create new item
    const newItem: ManualGroceryItem = {
      id: generateId(),
      category: category.trim(),
      itemText: itemText.trim(),
      createdAt: new Date().toISOString(),
    };
    
    // Load existing items, add new one, and save
    const existingItems = await loadManualItems();
    const updatedItems = [...existingItems, newItem];
    await saveManualItems(updatedItems);
    
    console.log('[ManualStorage] ✅ Manual item added:', newItem.id);
    return newItem;
  } catch (error) {
    console.error('[ManualStorage] ❌ Error adding manual item:', error);
    throw error;
  }
};

/**
 * Delete a manual grocery item by ID
 */
export const deleteManualItem = async (itemId: string): Promise<void> => {
  try {
    console.log('[ManualStorage] 🗑️ Deleting manual item:', itemId);
    
    const existingItems = await loadManualItems();
    const itemExists = existingItems.some(item => item.id === itemId);
    
    if (!itemExists) {
      console.warn('[ManualStorage] ⚠️ Item not found for deletion:', itemId);
      return; // Gracefully handle missing items
    }
    
    const filteredItems = existingItems.filter(item => item.id !== itemId);
    await saveManualItems(filteredItems);
    
    console.log('[ManualStorage] ✅ Manual item deleted:', itemId);
  } catch (error) {
    console.error('[ManualStorage] ❌ Error deleting manual item:', error);
    throw error;
  }
};

/**
 * Clear all manual grocery items
 */
export const clearAllManualItems = async (): Promise<void> => {
  try {
    console.log('[ManualStorage] 🧹 Clearing all manual items...');
    await AsyncStorage.removeItem(MANUAL_GROCERY_ITEMS_KEY);
    console.log('[ManualStorage] ✅ All manual items cleared');
  } catch (error) {
    console.error('[ManualStorage] ❌ Error clearing manual items:', error);
    throw error;
  }
};

/**
 * Get manual items by category
 */
export const getManualItemsByCategory = async (category: string): Promise<ManualGroceryItem[]> => {
  try {
    const allItems = await loadManualItems();
    return allItems.filter(item => item.category === category);
  } catch (error) {
    console.error('[ManualStorage] ❌ Error getting items by category:', error);
    return [];
  }
};

/**
 * Get count of manual items
 */
export const getManualItemsCount = async (): Promise<number> => {
  try {
    const items = await loadManualItems();
    return items.length;
  } catch (error) {
    console.error('[ManualStorage] ❌ Error getting items count:', error);
    return 0;
  }
}; 