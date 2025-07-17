import * as React from 'react';
import { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CombinedParsedRecipe } from '../common/types';
import { useAuth } from './AuthContext';

// Cache management constants
const COOKING_CACHE_KEYS = {
  RECIPE_PREFIX: 'cookingRecipe_',
  LAST_FETCHED_PREFIX: 'cookingRecipeLastFetched_',
};
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours (same as mise)

// Types
export type RecipeSession = {
  recipeId: string;
  recipe: CombinedParsedRecipe | null; // null when not yet loaded
  completedSteps: string[];
  activeTimers: {
    stepId: string;
    startTime: number;
    pausedAt: number | null;
    duration: number;
  }[];
  scrollPosition: number;
  isLoading: boolean;
};

type CookingState = {
  activeRecipes: RecipeSession[];
  activeRecipeId: string | null;
  sessionStartTime?: number;
};

type CookingAction =
  | { type: 'START_SESSION'; payload: { recipe: CombinedParsedRecipe } }
  | { type: 'START_LAZY_SESSION'; payload: { recipeId: string } }
  | { type: 'LOAD_RECIPE_DATA'; payload: { recipeId: string; recipe: CombinedParsedRecipe } }
  | { type: 'SET_RECIPE_LOADING'; payload: { recipeId: string; isLoading: boolean } }
  | { type: 'END_SESSION'; payload: { recipeId: string } }
  | { type: 'SWITCH_RECIPE'; payload: { recipeId: string } }
  | { type: 'COMPLETE_STEP'; payload: { recipeId: string; stepId: string } }
  | { type: 'UNCOMPLETE_STEP'; payload: { recipeId: string; stepId: string } }
  | { type: 'START_TIMER'; payload: { recipeId: string; stepId: string; duration: number } }
  | { type: 'PAUSE_TIMER'; payload: { recipeId: string; stepId: string } }
  | { type: 'RESUME_TIMER'; payload: { recipeId: string; stepId: string } }
  | { type: 'END_TIMER'; payload: { recipeId: string; stepId: string } }
  | { type: 'SET_SCROLL_POSITION'; payload: { recipeId: string; position: number } }
  | { type: 'RESTORE_STATE'; payload: CookingState };

type CookingContextType = {
  state: CookingState;
  startSession: (recipe: CombinedParsedRecipe) => void;
  startLazySession: (recipeId: string) => void;
  loadRecipeDataIfNeeded: (recipeId: string) => Promise<void>;
  endSession: (recipeId: string) => void;
  endAllSessions: () => void;
  switchRecipe: (recipeId: string) => void;
  completeStep: (recipeId: string, stepId: string) => void;
  uncompleteStep: (recipeId: string, stepId: string) => void;
  startTimer: (recipeId: string, stepId: string, duration: number) => void;
  pauseTimer: (recipeId: string, stepId: string) => void;
  resumeTimer: (recipeId: string, stepId: string) => void;
  endTimer: (recipeId: string, stepId: string) => void;
  setScrollPosition: (recipeId: string, position: number) => void;
  getCurrentScrollPosition: (recipeId: string) => number;
  hasResumableSession: () => boolean;
  invalidateRecipeCache: (recipeId: string) => Promise<void>;
};

const initialState: CookingState = {
  activeRecipes: [],
  activeRecipeId: null,
  sessionStartTime: undefined,
};

// Context
const CookingContext = createContext<CookingContextType | null>(null);

// Reducer
function cookingReducer(state: CookingState, action: CookingAction): CookingState {
  console.log('[CookingContext] 🔄 Reducer action:', action.type, action.payload);
  console.log('[CookingContext] 📊 Current state before action:', {
    activeRecipesCount: state.activeRecipes.length,
    activeRecipeId: state.activeRecipeId,
    sessionStartTime: state.sessionStartTime,
    recipeIds: state.activeRecipes.map(r => ({ id: r.recipeId, title: r.recipe?.title, isLoading: r.isLoading }))
  });

  switch (action.type) {
    case 'START_SESSION': {
      // Generate a unique string ID for the session
      const recipeId = String(action.payload.recipe.id || Date.now());
      console.log('[CookingContext] 🚀 Starting session for recipe:', {
        recipeId,
        title: action.payload.recipe.title,
        hasInstructions: !!action.payload.recipe.instructions,
        instructionsCount: action.payload.recipe.instructions?.length || 0
      });
      
      const newRecipe: RecipeSession = {
        recipeId,
        recipe: action.payload.recipe, // Keep original recipe unchanged
        completedSteps: [],
        activeTimers: [],
        scrollPosition: 0,
        isLoading: false,
      };
      
      const newState = {
        ...state,
        activeRecipes: [...state.activeRecipes, newRecipe],
        activeRecipeId: recipeId,
        sessionStartTime: state.sessionStartTime || Date.now(),
      };
      
      console.log('[CookingContext] ✅ Session started, new state:', {
        activeRecipesCount: newState.activeRecipes.length,
        activeRecipeId: newState.activeRecipeId,
        sessionStartTime: newState.sessionStartTime
      });
      
      return newState;
    }

    case 'START_LAZY_SESSION': {
      console.log('[CookingContext] ⏳ Starting lazy session for recipe ID:', action.payload.recipeId);
      
      const newRecipe: RecipeSession = {
        recipeId: action.payload.recipeId,
        recipe: null, // Will be loaded later
        completedSteps: [],
        activeTimers: [],
        scrollPosition: 0,
        isLoading: true,
      };
      
      const newState = {
        ...state,
        activeRecipes: [...state.activeRecipes, newRecipe],
        activeRecipeId: state.activeRecipeId || action.payload.recipeId,
      };
      
      console.log('[CookingContext] ✅ Lazy session started:', {
        recipeId: action.payload.recipeId,
        activeRecipesCount: newState.activeRecipes.length,
        activeRecipeId: newState.activeRecipeId
      });
      
      return newState;
    }

    case 'LOAD_RECIPE_DATA': {
      console.log('[CookingContext] 📥 Loading recipe data for:', {
        recipeId: action.payload.recipeId,
        title: action.payload.recipe.title,
        hasInstructions: !!action.payload.recipe.instructions,
        instructionsCount: action.payload.recipe.instructions?.length || 0
      });
      
      const newState = {
        ...state,
        activeRecipes: state.activeRecipes.map(recipe =>
          recipe.recipeId === action.payload.recipeId
            ? {
                ...recipe,
                recipe: action.payload.recipe,
                isLoading: false,
              }
            : recipe
        ),
      };
      
      console.log('[CookingContext] ✅ Recipe data loaded for:', action.payload.recipeId);
      return newState;
    }

    case 'SET_RECIPE_LOADING': {
      console.log('[CookingContext] 📥 Setting recipe loading state:', {
        recipeId: action.payload.recipeId,
        isLoading: action.payload.isLoading,
      });
      
      return {
        ...state,
        activeRecipes: state.activeRecipes.map(recipe =>
          recipe.recipeId === action.payload.recipeId
            ? { ...recipe, isLoading: action.payload.isLoading }
            : recipe
        ),
      };
    }

    case 'SET_SCROLL_POSITION': {
      // Only log significant scroll changes to reduce noise
      const currentRecipe = state.activeRecipes.find(r => r.recipeId === action.payload.recipeId);
      const positionDifference = Math.abs((currentRecipe?.scrollPosition || 0) - action.payload.position);
      
      if (positionDifference > 20) { // Only log if position changed by more than 20px
        console.log('[CookingContext] 📍 Setting scroll position:', {
          recipeId: action.payload.recipeId,
          position: action.payload.position,
          previousPosition: currentRecipe?.scrollPosition || 0,
        });
      }
      
      return {
        ...state,
        activeRecipes: state.activeRecipes.map(recipe =>
          recipe.recipeId === action.payload.recipeId
            ? { ...recipe, scrollPosition: action.payload.position }
            : recipe
        ),
      };
    }

    case 'SWITCH_RECIPE': {
      console.log('[CookingContext] 🔀 Switching to recipe:', action.payload.recipeId);
      
      if (!state.activeRecipes.some(r => r.recipeId === action.payload.recipeId)) {
        console.warn('[CookingContext] ⚠️ Cannot switch to recipe - not found in active recipes:', action.payload.recipeId);
        return state;
      }
      
      const newState = {
        ...state,
        activeRecipeId: action.payload.recipeId,
      };
      
      console.log('[CookingContext] ✅ Switched to recipe:', action.payload.recipeId);
      return newState;
    }

    case 'END_SESSION': {
      console.log('[CookingContext] 🛑 Ending session for recipe:', action.payload.recipeId);
      
      const updatedRecipes = state.activeRecipes.filter(
        recipe => recipe.recipeId !== action.payload.recipeId
      );
      
      const newState = {
        ...state,
        activeRecipes: updatedRecipes,
        activeRecipeId: updatedRecipes.length > 0 ? updatedRecipes[0].recipeId : null,
      };
      
      console.log('[CookingContext] ✅ Session ended:', {
        endedRecipeId: action.payload.recipeId,
        remainingRecipesCount: newState.activeRecipes.length,
        newActiveRecipeId: newState.activeRecipeId
      });
      
      return newState;
    }

    case 'RESTORE_STATE': {
      console.log('[CookingContext] 🔄 Restoring state from storage:', {
        activeRecipesCount: action.payload.activeRecipes.length,
        activeRecipeId: action.payload.activeRecipeId,
        sessionStartTime: action.payload.sessionStartTime
      });
      
      return action.payload;
    }

    case 'COMPLETE_STEP': {
      console.log('[CookingContext] ✅ Completing step:', {
        recipeId: action.payload.recipeId,
        stepId: action.payload.stepId,
      });
      
      return {
        ...state,
        activeRecipes: state.activeRecipes.map(recipe =>
          recipe.recipeId === action.payload.recipeId
            ? {
                ...recipe,
                completedSteps: recipe.completedSteps.includes(action.payload.stepId)
                  ? recipe.completedSteps // Already completed
                  : [...recipe.completedSteps, action.payload.stepId]
              }
            : recipe
        ),
      };
    }

    case 'UNCOMPLETE_STEP': {
      console.log('[CookingContext] ❌ Uncompleting step:', {
        recipeId: action.payload.recipeId,
        stepId: action.payload.stepId,
      });
      
      return {
        ...state,
        activeRecipes: state.activeRecipes.map(recipe =>
          recipe.recipeId === action.payload.recipeId
            ? {
                ...recipe,
                completedSteps: recipe.completedSteps.filter(s => s !== action.payload.stepId)
              }
            : recipe
        ),
      };
    }

    default:
      console.log('[CookingContext] ❓ Unknown action type:', action.type);
      return state;
  }
}

// Cache management functions
const getCachedRecipe = async (recipeId: string): Promise<{ recipe: any; shouldFetch: boolean }> => {
  try {
    const [cachedRecipeStr, lastFetchedStr] = await Promise.all([
      AsyncStorage.getItem(`${COOKING_CACHE_KEYS.RECIPE_PREFIX}${recipeId}`),
      AsyncStorage.getItem(`${COOKING_CACHE_KEYS.LAST_FETCHED_PREFIX}${recipeId}`),
    ]);

    if (!cachedRecipeStr || !lastFetchedStr) {
      console.log('[CookingContext] No cached recipe found for:', recipeId);
      return { recipe: null, shouldFetch: true };
    }

    const lastFetched = parseInt(lastFetchedStr, 10);
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetched;

    if (timeSinceLastFetch >= CACHE_DURATION_MS) {
      console.log('[CookingContext] Cache expired for recipe:', recipeId, 
        `(${Math.round(timeSinceLastFetch / (60 * 60 * 1000))}h old)`);
      return { recipe: null, shouldFetch: true };
    }

    const cachedRecipe = JSON.parse(cachedRecipeStr);
    const hoursLeft = Math.round((CACHE_DURATION_MS - timeSinceLastFetch) / (60 * 60 * 1000) * 10) / 10;
    console.log('[CookingContext] Using cached recipe:', recipeId, `(${hoursLeft}h left)`);
    return { recipe: cachedRecipe, shouldFetch: false };
  } catch (error) {
    console.error('[CookingContext] Error loading cached recipe:', recipeId, error);
    return { recipe: null, shouldFetch: true };
  }
};

const cacheRecipe = async (recipeId: string, recipe: any): Promise<void> => {
  try {
    const now = Date.now().toString();
    await Promise.all([
      AsyncStorage.setItem(`${COOKING_CACHE_KEYS.RECIPE_PREFIX}${recipeId}`, JSON.stringify(recipe)),
      AsyncStorage.setItem(`${COOKING_CACHE_KEYS.LAST_FETCHED_PREFIX}${recipeId}`, now),
    ]);
    console.log('[CookingContext] Cached recipe:', recipeId);
  } catch (error) {
    console.error('[CookingContext] Error caching recipe:', recipeId, error);
  }
};

const invalidateRecipeCache = async (recipeId: string): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(`${COOKING_CACHE_KEYS.RECIPE_PREFIX}${recipeId}`),
      AsyncStorage.removeItem(`${COOKING_CACHE_KEYS.LAST_FETCHED_PREFIX}${recipeId}`),
    ]);
    console.log('[CookingContext] Invalidated cache for recipe:', recipeId);
  } catch (error) {
    console.error('[CookingContext] Error invalidating cache for recipe:', recipeId, error);
  }
};

// Provider Component
export function CookingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cookingReducer, initialState);
  const { session } = useAuth();

  // Load state from storage on mount with recovery logic
  useEffect(() => {
    const loadState = async () => {
      console.log('[CookingContext] 🔄 Loading cooking state from AsyncStorage on mount');
      
      try {
        const savedState = await AsyncStorage.getItem('meez.cookingSession');
        
        if (!savedState) {
          console.log('[CookingContext] ❌ No saved cooking state found');
          return;
        }
        
        console.log('[CookingContext] 📦 Found saved state, length:', savedState.length, 'characters');
        const parsedState = JSON.parse(savedState);
        
        console.log('[CookingContext] 📊 Parsed saved state:', {
          activeRecipesCount: parsedState.activeRecipes?.length || 0,
          activeRecipeId: parsedState.activeRecipeId,
          sessionStartTime: parsedState.sessionStartTime,
          hasSessionStartTime: !!parsedState.sessionStartTime,
        });
        
        // Check if session is recent (within 24 hours)
        const now = Date.now();
        const sessionAge = now - (parsedState.sessionStartTime || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        console.log('[CookingContext] ⏰ Session age check:', {
          sessionStartTime: parsedState.sessionStartTime,
          now,
          sessionAge,
          sessionAgeHours: Math.round(sessionAge / (60 * 60 * 1000) * 10) / 10,
          maxAgeHours: 24,
          isWithinLimit: sessionAge < maxAge,
          hasActiveRecipes: parsedState.activeRecipes?.length > 0,
        });
        
        if (sessionAge < maxAge && parsedState.activeRecipes?.length > 0) {
          // Valid session found - can be resumed
          console.log('[CookingContext] ✅ Found resumable cooking session, restoring state');
          dispatch({ type: 'RESTORE_STATE', payload: parsedState });
        } else {
          // Session too old or empty, clear it
          console.log('[CookingContext] 🗑️ Session too old or empty, clearing stored state');
          await AsyncStorage.removeItem('meez.cookingSession');
        }
      } catch (error) {
        console.error('[CookingContext] 💥 Error loading cooking state:', error);
        console.error('[CookingContext] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Clear corrupted state
        console.log('[CookingContext] 🗑️ Clearing corrupted state');
        await AsyncStorage.removeItem('meez.cookingSession');
      }
    };
    loadState();
  }, []);

  // Save state to storage on changes
  useEffect(() => {
    const saveState = async () => {
      console.log('[CookingContext] 💾 Saving cooking state to AsyncStorage');
      console.log('[CookingContext] 📊 Current state to save:', {
        activeRecipesCount: state.activeRecipes.length,
        activeRecipeId: state.activeRecipeId,
        sessionStartTime: state.sessionStartTime,
        recipeIds: state.activeRecipes.map(r => ({ id: r.recipeId, title: r.recipe?.title, hasRecipe: !!r.recipe }))
      });
      
      try {
        // Only save if there are active recipes
        if (state.activeRecipes.length > 0) {
          const stateToSave = JSON.stringify(state);
          console.log('[CookingContext] 📤 Saving state to AsyncStorage, size:', stateToSave.length, 'characters');
          await AsyncStorage.setItem('meez.cookingSession', stateToSave);
          console.log('[CookingContext] ✅ State saved successfully');
        } else {
          // Clear storage if no active recipes
          console.log('[CookingContext] 🗑️ No active recipes, clearing stored state');
          await AsyncStorage.removeItem('meez.cookingSession');
        }
      } catch (error) {
        console.error('[CookingContext] 💥 Error saving cooking state:', error);
        console.error('[CookingContext] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    };
    saveState();
  }, [state]);

  const startSession = (recipe: CombinedParsedRecipe) => {
    dispatch({ type: 'START_SESSION', payload: { recipe } });
  };

  const startLazySession = (recipeId: string) => {
    dispatch({ type: 'START_LAZY_SESSION', payload: { recipeId } });
  };

  const loadRecipeDataIfNeeded = async (recipeId: string): Promise<void> => {
    console.log('[CookingContext] 🔍 loadRecipeDataIfNeeded called for:', recipeId);
    
    const existingRecipe = state.activeRecipes.find(r => r.recipeId === recipeId);
    if (!existingRecipe) {
      console.warn('[CookingContext] ⚠️ Recipe not found in active recipes:', recipeId);
      return;
    }
    
    if (existingRecipe.recipe) {
      console.log('[CookingContext] ✅ Recipe data already loaded for:', recipeId);
      return;
    }
    
    console.log('[CookingContext] 📥 Loading recipe data for:', recipeId);

    try {
      dispatch({ type: 'SET_RECIPE_LOADING', payload: { recipeId, isLoading: true } });
      
      // Check authentication
      if (!session?.user?.id || !session?.access_token) {
        console.error('[CookingContext] ❌ No authenticated session found');
        dispatch({ type: 'SET_RECIPE_LOADING', payload: { recipeId, isLoading: false } });
        return;
      }
      
      // Check cache first
      const { recipe: cachedRecipe, shouldFetch } = await getCachedRecipe(recipeId);
      
      let miseRecipe = cachedRecipe;
      
      if (shouldFetch) {
        console.log('[CookingContext] 🌐 Fetching fresh recipe data from API for:', recipeId);
        
        const backendUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!backendUrl) {
          throw new Error('API configuration error. Please check your environment variables.');
        }
        
        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        };
        
        const apiUrl = `${backendUrl}/api/mise/recipes/${recipeId}?userId=${session.user.id}`;
        console.log('[CookingContext] 🌐 Making API request:', {
          url: apiUrl,
          method: 'GET',
          hasAuthToken: !!session.access_token,
          userId: session.user.id,
          recipeId,
        });
        
        // Fetch single recipe from API
        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
          // Get more detailed error information
          let errorMessage = `Failed to fetch recipe: ${response.status} ${response.statusText}`;
          try {
            const errorBody = await response.json();
            errorMessage += ` - ${errorBody.error || 'Unknown error'}`;
          } catch (jsonError) {
            // If we can't parse the error response, just use the status
          }
          console.error('[CookingContext] 🌐 API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            url: `${backendUrl}/api/mise/recipes/${recipeId}?userId=${session.user.id}`,
            headers: headers,
          });
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        miseRecipe = result.recipe;
        
        if (!miseRecipe) {
          throw new Error('Recipe not found in API response');
        }
        
        // Cache the fresh data
        await cacheRecipe(recipeId, miseRecipe);
        console.log('[CookingContext] ✅ Fresh recipe data fetched and cached for:', recipeId);
      }
      
      console.log('[CookingContext] ✅ Found mise recipe:', {
        id: miseRecipe.id,
        title: miseRecipe.prepared_recipe_data?.title || miseRecipe.original_recipe_data?.title,
        hasLocalMods: !!miseRecipe.local_modifications,
        hasPreparedData: !!miseRecipe.prepared_recipe_data,
        hasOriginalData: !!miseRecipe.original_recipe_data,
      });
      
      const recipeData = miseRecipe.local_modifications?.modified_recipe_data || 
                       miseRecipe.prepared_recipe_data || 
                       miseRecipe.original_recipe_data;
      
      if (!recipeData) {
        console.error('[CookingContext] ❌ No recipe data found in mise recipe:', recipeId);
        dispatch({ type: 'SET_RECIPE_LOADING', payload: { recipeId, isLoading: false } });
        return;
      }
      
      // Create the recipe object with mise ID as primary ID
      const recipe = {
        ...recipeData,
        id: recipeId, // Use the mise ID as the primary ID
        originalRecipeId: recipeData.id, // Keep original recipe ID for reference
        miseRecipeId: miseRecipe.id, // Keep mise recipe ID for reference
      };
      
      console.log('[CookingContext] ✅ Loaded recipe data for mise ID:', {
        recipeId,
        miseRecipeId: miseRecipe.id,
        originalRecipeId: recipeData.id,
        title: recipe.title,
        hasInstructions: !!recipe.instructions,
        instructionsCount: recipe.instructions?.length || 0,
        hasIngredients: !!recipe.ingredientGroups,
        ingredientGroupsCount: recipe.ingredientGroups?.length || 0,
      });
      
      dispatch({ type: 'LOAD_RECIPE_DATA', payload: { recipeId, recipe } });
    } catch (error) {
      console.error('[CookingContext] 💥 Error loading recipe data:', error);
      console.error('[CookingContext] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      dispatch({ type: 'SET_RECIPE_LOADING', payload: { recipeId, isLoading: false } });
    }
  };

  const endSession = (recipeId: string) => {
    dispatch({ type: 'END_SESSION', payload: { recipeId } });
  };

  const endAllSessions = async () => {
    console.log('[CookingContext] 🛑 Ending all cooking sessions');
    console.log('[CookingContext] 📊 Current sessions to end:', {
      activeRecipesCount: state.activeRecipes.length,
      recipeIds: state.activeRecipes.map(r => r.recipeId)
    });
    
    // Clear all active sessions
    state.activeRecipes.forEach(recipe => {
      console.log('[CookingContext] 🛑 Ending session for recipe:', recipe.recipeId);
      dispatch({ type: 'END_SESSION', payload: { recipeId: recipe.recipeId } });
    });
    
    // Clear storage
    try {
      console.log('[CookingContext] 🗑️ Clearing cooking session from AsyncStorage');
      await AsyncStorage.removeItem('meez.cookingSession');
      console.log('[CookingContext] ✅ AsyncStorage cleared successfully');
    } catch (error) {
      console.error('[CookingContext] 💥 Error clearing cooking session:', error);
    }
  };

  const switchRecipe = (recipeId: string) => {
    dispatch({ type: 'SWITCH_RECIPE', payload: { recipeId } });
  };

  const completeStep = (recipeId: string, stepId: string) => {
    dispatch({ type: 'COMPLETE_STEP', payload: { recipeId, stepId } });
  };

  const uncompleteStep = (recipeId: string, stepId: string) => {
    dispatch({ type: 'UNCOMPLETE_STEP', payload: { recipeId, stepId } });
  };

  const startTimer = (recipeId: string, stepId: string, duration: number) => {
    dispatch({ type: 'START_TIMER', payload: { recipeId, stepId, duration } });
  };

  const pauseTimer = (recipeId: string, stepId: string) => {
    dispatch({ type: 'PAUSE_TIMER', payload: { recipeId, stepId } });
  };

  const resumeTimer = (recipeId: string, stepId: string) => {
    dispatch({ type: 'RESUME_TIMER', payload: { recipeId, stepId } });
  };

  const endTimer = (recipeId: string, stepId: string) => {
    dispatch({ type: 'END_TIMER', payload: { recipeId, stepId } });
  };

  const setScrollPosition = (recipeId: string, position: number) => {
    dispatch({ type: 'SET_SCROLL_POSITION', payload: { recipeId, position } });
  };

  // Helper to get current recipe's scroll position
  const getCurrentScrollPosition = (recipeId: string): number => {
    const recipe = state.activeRecipes.find(r => r.recipeId === recipeId);
    return recipe?.scrollPosition || 0;
  };

  const hasResumableSession = (): boolean => {
    return state.activeRecipes.length > 0;
  };

  const invalidateRecipeCacheForContext = async (recipeId: string): Promise<void> => {
    await invalidateRecipeCache(recipeId);
  };

  return (
    <CookingContext.Provider
      value={{
        state,
        startSession,
        startLazySession,
        loadRecipeDataIfNeeded,
        endSession,
        endAllSessions,
        switchRecipe,
        completeStep,
        uncompleteStep,
        startTimer,
        pauseTimer,
        resumeTimer,
        endTimer,
        setScrollPosition,
        getCurrentScrollPosition,
        hasResumableSession,
        invalidateRecipeCache: invalidateRecipeCacheForContext,
      }}
    >
      {children}
    </CookingContext.Provider>
  );
}

// Hook
export function useCooking() {
  const context = useContext(CookingContext);
  if (!context) {
    throw new Error('useCooking must be used within a CookingProvider');
  }
  return context;
} 