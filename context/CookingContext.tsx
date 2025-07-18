import * as React from 'react';
import { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CombinedParsedRecipe } from '../common/types';
import { useAuth } from './AuthContext';



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
  | { type: 'INITIALIZE_SESSIONS'; payload: { recipes: CombinedParsedRecipe[]; activeRecipeId?: string } }
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
  initializeSessions: (miseRecipes: any[]) => void;
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
    case 'INITIALIZE_SESSIONS': {
      console.log('[CookingContext] 🚀 Initializing all cooking sessions with eager loading:', {
        recipesCount: action.payload.recipes.length,
        activeRecipeId: action.payload.activeRecipeId,
        recipeIds: action.payload.recipes.map(r => r.id)
      });
      
      const newRecipes: RecipeSession[] = action.payload.recipes.map(recipe => {
        const recipeId = String(recipe.id);
        
        console.log('[CookingContext] 📋 Creating session for recipe:', {
          recipeId,
          title: recipe.title,
          hasInstructions: !!recipe.instructions,
          instructionsCount: recipe.instructions?.length || 0,
          hasIngredientGroups: !!recipe.ingredientGroups,
          ingredientGroupsCount: recipe.ingredientGroups?.length || 0,
        });
        
        return {
          recipeId,
          recipe, // Full recipe data immediately available
          completedSteps: [],
          activeTimers: [],
          scrollPosition: 0,
          isLoading: false, // No loading needed - data is already here
        };
      });
      
      const newState = {
        ...state,
        activeRecipes: newRecipes,
        activeRecipeId: action.payload.activeRecipeId || newRecipes[0]?.recipeId || null,
        sessionStartTime: Date.now(),
      };
      
      console.log('[CookingContext] ✅ All sessions initialized:', {
        activeRecipesCount: newState.activeRecipes.length,
        activeRecipeId: newState.activeRecipeId,
        sessionStartTime: newState.sessionStartTime
      });
      
      return newState;
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

  const initializeSessions = (miseRecipes: any[]) => {
    console.time(`[CookingContext] ⏱️ initializeSessions`);
    console.log('[CookingContext] 🚀 Initializing cooking sessions with mise recipes:', {
      recipesCount: miseRecipes.length,
      recipeIds: miseRecipes.map(mr => mr.id),
    });

    // Convert mise recipes to full recipe objects using prepared_recipe_data
    const recipes: CombinedParsedRecipe[] = miseRecipes.map(miseRecipe => {
      const recipeData = miseRecipe.local_modifications?.modified_recipe_data || 
                       miseRecipe.prepared_recipe_data || 
                       miseRecipe.original_recipe_data;
      
      if (!recipeData) {
        console.error('[CookingContext] ❌ No recipe data found for mise recipe:', miseRecipe.id);
        return null;
      }

      // Create the recipe object with mise ID as primary ID
      const recipe = {
        ...recipeData,
        id: String(miseRecipe.id), // Use the mise ID as the primary ID
        originalRecipeId: recipeData.id, // Keep original recipe ID for reference
        miseRecipeId: miseRecipe.id, // Keep mise recipe ID for reference
      };

      console.log('[CookingContext] 📋 Processed mise recipe:', {
        miseRecipeId: miseRecipe.id,
        recipeId: recipe.id,
        title: recipe.title,
        hasInstructions: !!recipe.instructions,
        instructionsCount: recipe.instructions?.length || 0,
        hasIngredientGroups: !!recipe.ingredientGroups,
        ingredientGroupsCount: recipe.ingredientGroups?.length || 0,
                 totalIngredients: recipe.ingredientGroups?.reduce((total: number, group: any) => 
           total + (group.ingredients?.length || 0), 0) || 0,
      });

      return recipe;
    }).filter(Boolean) as CombinedParsedRecipe[];

         // Initialize all sessions with full recipe data
     dispatch({ 
       type: 'INITIALIZE_SESSIONS', 
       payload: { 
         recipes,
         activeRecipeId: recipes[0]?.id ? String(recipes[0].id) : undefined // Set first recipe as active
       } 
     });
    
    console.timeEnd(`[CookingContext] ⏱️ initializeSessions`);
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
    console.time(`[CookingContext] ⏱️ switchRecipe-${recipeId}`);
    console.log('[CookingContext] 🔄 Switching to recipe:', recipeId);
    dispatch({ type: 'SWITCH_RECIPE', payload: { recipeId } });
    console.timeEnd(`[CookingContext] ⏱️ switchRecipe-${recipeId}`);
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



  return (
    <CookingContext.Provider
      value={{
        state,
        initializeSessions,
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