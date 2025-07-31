import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_USAGE_KEY = 'hasUsedFreeRecipe';

/**
 * Checks if the user has already used their one free recipe.
 * @returns {Promise<boolean>} - True if the flag is set, false otherwise.
 */
export const getHasUsedFreeRecipe = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(FREE_USAGE_KEY);
    if (process.env.NODE_ENV === 'development') {
      console.log('[FreeUsage] getHasUsedFreeRecipe:', value);
    }
    return value === 'true';
  } catch (error) {
    console.error('Error getting free recipe usage from AsyncStorage:', error);
    return false; // Fail safely
  }
};

/**
 * Marks the user as having used their one free recipe.
 */
export const setHasUsedFreeRecipe = async (): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[FreeUsage] setHasUsedFreeRecipe: true');
    }
    await AsyncStorage.setItem(FREE_USAGE_KEY, 'true');
  } catch (error) {
    console.error('Error setting free recipe usage in AsyncStorage:', error);
  }
};

/**
 * Clears the free recipe usage flag from AsyncStorage.
 * Intended for development and testing purposes.
 */
export const clearFreeRecipeFlag = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FREE_USAGE_KEY);
  } catch (error) {
    console.error('Error clearing free recipe usage from AsyncStorage:', error);
  }
}; 