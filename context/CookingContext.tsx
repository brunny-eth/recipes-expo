import * as React from 'react';
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CombinedParsedRecipe } from '../common/types';
import { useAuth } from './AuthContext';

// Types
export type RecipeSession = {
  recipeId: string;
  recipe: CombinedParsedRecipe | null;
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

console.error('[CookingContext] 🌟 Initial state - activeRecipes length:', initialState.activeRecipes?.length || 'N/A');
console.error('[CookingContext] 🌟 Initial state - activeRecipeId:', initialState.activeRecipeId);
console.error('[CookingContext] 🌟 Initial state - sessionStartTime:', initialState.sessionStartTime);

// Context
const CookingContext = createContext<CookingContextType | null>(null);

// Provider Component
export function CookingProvider({ children }: { children: React.ReactNode }) {
  // Use useState instead of useReducer
  const [activeRecipes, setActiveRecipes] = useState<RecipeSession[]>(initialState.activeRecipes);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(initialState.activeRecipeId);
  const [sessionStartTime, setSessionStartTime] = useState<number | undefined>(initialState.sessionStartTime);

  console.error('[CookingContext] ✅ useState hooks initialized successfully.');

  // State monitoring effect (reduced logging)
  useEffect(() => {
    console.error(`[CookingContext] ✅ useState initialized. activeRecipes: ${activeRecipes?.length}, activeRecipeId: ${activeRecipeId}`);
  }, [activeRecipes, activeRecipeId, sessionStartTime]);
  
  const { session } = useAuth();

  // Load state from storage on mount with recovery logic
  useEffect(() => {
    const loadState = async () => {
      console.error('[CookingContext] 🔄 Loading cooking state from AsyncStorage on mount');
      
      try {
        const savedState = await AsyncStorage.getItem('meez.cookingSession');
        
        if (!savedState) {
          console.error('[CookingContext] ❌ No saved cooking state found');
          return;
        }
        
        console.error('[CookingContext] 📦 Found saved state, length:', savedState.length, 'characters');
        const parsedState = JSON.parse(savedState);
        
        console.error('[CookingContext] 📊 Parsed saved state:', {
          activeRecipesCount: parsedState.activeRecipes?.length || 0,
          activeRecipeId: parsedState.activeRecipeId,
          sessionStartTime: parsedState.sessionStartTime,
          hasSessionStartTime: !!parsedState.sessionStartTime,
        });
        
        // Check if session is recent (within 24 hours)
        const now = Date.now();
        const sessionAge = now - (parsedState.sessionStartTime || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        console.error('[CookingContext] ⏰ Session age check:', {
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
          console.error('[CookingContext] ✅ Found resumable cooking session, restoring state');
          setActiveRecipes(parsedState.activeRecipes);
          setActiveRecipeId(parsedState.activeRecipeId);
          setSessionStartTime(parsedState.sessionStartTime);
        } else {
          // Session too old or empty, clear it
          console.error('[CookingContext] 🗑️ Session too old or empty, clearing stored state');
          await AsyncStorage.removeItem('meez.cookingSession');
        }
      } catch (error) {
        console.error('[CookingContext] 💥 Error loading cooking state:', error);
        console.error('[CookingContext] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Clear corrupted state
        console.error('[CookingContext] 🗑️ Clearing corrupted state');
        await AsyncStorage.removeItem('meez.cookingSession');
      }
    };
    loadState();
  }, []);

  // Save state to storage on changes
  useEffect(() => {
    const saveState = async () => {
      console.error(`[CookingContext] 💾 Saving state: ${activeRecipes.length} recipes, activeId: ${activeRecipeId}`);
      
      try {
        // Only save if there are active recipes
        if (activeRecipes.length > 0) {
          const stateToSave = JSON.stringify({ activeRecipes, activeRecipeId, sessionStartTime });
          console.error('[CookingContext] 📤 Saving state to AsyncStorage, size:', stateToSave.length, 'characters');
          await AsyncStorage.setItem('meez.cookingSession', stateToSave);
          console.error('[CookingContext] ✅ State saved successfully');
        } else {
          // Clear storage if no active recipes
          console.error('[CookingContext] 🗑️ No active recipes, clearing stored state');
          await AsyncStorage.removeItem('meez.cookingSession');
        }
      } catch (error) {
        console.error('[CookingContext] 💥 Error saving cooking state:', error);
        console.error('[CookingContext] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    };
    saveState();
  }, [activeRecipes, activeRecipeId, sessionStartTime]);

  // --- initializeSessions function refactored to use useState setters directly ---
  const initializeSessions = useCallback(
    (miseRecipes: any[]) => {
      console.error('[CookingContext] 🚀 initializeSessions called (useState version). Recipes Count:', miseRecipes.length);

      if (!miseRecipes || !Array.isArray(miseRecipes) || miseRecipes.length === 0) {
        console.error('[CookingContext] ⚠️ initializeSessions called with empty or invalid recipes array.');
        setActiveRecipes([]);
        setActiveRecipeId(null);
        setSessionStartTime(undefined);
        return;
      }

      try {
        // Validate input
        if (!Array.isArray(miseRecipes)) {
          throw new Error(`Invalid miseRecipes parameter: expected array, got ${typeof miseRecipes}`);
        }

        // Convert mise recipes to full recipe objects using prepared_recipe_data
        const recipes: CombinedParsedRecipe[] = miseRecipes.map(miseRecipe => {
          try {
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

            console.error('[CookingContext] 📋 Processed mise recipe:', {
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
          } catch (error) {
            console.error('[CookingContext] 💥 Error processing mise recipe:', miseRecipe.id, error);
            return null;
          }
        }).filter(Boolean) as CombinedParsedRecipe[];

        console.error('[CookingContext] 📊 Processed recipes count:', recipes.length);

        const newActiveRecipes: RecipeSession[] = recipes.map(recipe => {
          // Add validation for recipe properties if needed
          if (!recipe || !recipe.id) {
            console.error('[CookingContext] ❌ Invalid recipe object found during mapping:', recipe);
            return null as any;
          }
          return {
            recipeId: String(recipe.id),
            recipe: recipe,
            completedSteps: [],
            activeTimers: [],
            scrollPosition: 0,
            isLoading: false,
          };
        }).filter(Boolean) as RecipeSession[];

        const newActiveRecipeId = newActiveRecipes.length > 0 ? String(newActiveRecipes[0].recipeId) : null;

        // Update state directly using useState setters
        setActiveRecipes(newActiveRecipes);
        setActiveRecipeId(newActiveRecipeId);
        setSessionStartTime(Date.now());

        console.error('[CookingContext] ✅ State updated successfully via useState setters.');
        console.error(`[CookingContext] ✅ New activeRecipes count: ${newActiveRecipes.length}`);
        console.error(`[CookingContext] ✅ New activeRecipeId: ${newActiveRecipeId}`);

      } catch (e: any) {
        console.error('[CookingContext] 💥 CRITICAL ERROR in initializeSessions (useState refactor):', e);
        console.error('[CookingContext] 💥 Error stack:', e.stack);
        // Reset state on error
        setActiveRecipes([]);
        setActiveRecipeId(null);
        setSessionStartTime(undefined);
      }
    },
    [] // No dependencies here, as it directly uses the state setters
  );

  // All other functions refactored to use useState setters
  const endSession = useCallback((recipeId: string) => {
    console.error('[CookingContext] 🛑 Ending session for recipe:', recipeId);
    
    setActiveRecipes(prevRecipes => {
      const updatedRecipes = prevRecipes.filter(recipe => recipe.recipeId !== recipeId);
      
      if (updatedRecipes.length === 0) {
        setActiveRecipeId(null);
        setSessionStartTime(undefined);
      } else if (activeRecipeId === recipeId) {
        setActiveRecipeId(updatedRecipes[0].recipeId);
      }
      
      console.error('[CookingContext] ✅ Session ended:', {
        endedRecipeId: recipeId,
        remainingRecipesCount: updatedRecipes.length,
      });
      
      return updatedRecipes;
    });
  }, [activeRecipeId]);

  const endAllSessions = useCallback(() => {
    console.error('[CookingContext] 🛑 Ending all cooking sessions');
    console.error('[CookingContext] 📊 Current sessions to end:', {
      activeRecipesCount: activeRecipes.length,
      activeRecipeId: activeRecipeId,
    });

    if (!activeRecipes || activeRecipes.length === 0) {
      console.error('[CookingContext] ⚠️ No active recipes to end');
      return;
    }

    activeRecipes.forEach(recipe => {
      console.error('[CookingContext] 🛑 Ending session for recipe:', recipe.recipeId);
    });

    setActiveRecipes([]);
    setActiveRecipeId(null);
    setSessionStartTime(undefined);

    console.error('[CookingContext] 🗑️ Clearing cooking session from AsyncStorage');
    AsyncStorage.removeItem('meez.cookingSession').then(() => {
      console.error('[CookingContext] ✅ AsyncStorage cleared successfully');
    }).catch(error => {
      console.error('[CookingContext] 💥 Error clearing AsyncStorage:', error);
    });
  }, [activeRecipes, activeRecipeId]);

  const switchRecipe = useCallback((recipeId: string) => {
    console.error('[CookingContext] 🔄 Switching to recipe:', recipeId);
    
    if (!activeRecipes.some(r => r.recipeId === recipeId)) {
      console.error('[CookingContext] ⚠️ Cannot switch to recipe - not found in active recipes:', recipeId);
      return;
    }
    
    setActiveRecipeId(recipeId);
    console.error('[CookingContext] ✅ Switched to recipe:', recipeId);
  }, [activeRecipes]);

  const completeStep = useCallback((recipeId: string, stepId: string) => {
    console.error('[CookingContext] ✅ Completing step:', { recipeId, stepId });
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              completedSteps: recipe.completedSteps.includes(stepId)
                ? recipe.completedSteps // Already completed
                : [...recipe.completedSteps, stepId]
            }
          : recipe
      )
    );
  }, []);

  const uncompleteStep = useCallback((recipeId: string, stepId: string) => {
    console.error('[CookingContext] ❌ Uncompleting step:', { recipeId, stepId });
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              completedSteps: recipe.completedSteps.filter(s => s !== stepId)
            }
          : recipe
      )
    );
  }, []);

  const startTimer = useCallback((recipeId: string, stepId: string, duration: number) => {
    console.error(`[CookingContext] ⏰ Starting timer for recipe ${recipeId}, step ${stepId}, duration ${duration}`);
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              activeTimers: [
                ...recipe.activeTimers,
                {
                  stepId,
                  startTime: Date.now(),
                  pausedAt: null,
                  duration,
                }
              ]
            }
          : recipe
      )
    );
  }, []);

  const pauseTimer = useCallback((recipeId: string, stepId: string) => {
    console.error(`[CookingContext] ⏸️ Pausing timer for recipe ${recipeId}, step ${stepId}`);
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              activeTimers: recipe.activeTimers.map(timer =>
                timer.stepId === stepId
                  ? { ...timer, pausedAt: Date.now() }
                  : timer
              )
            }
          : recipe
      )
    );
  }, []);

  const resumeTimer = useCallback((recipeId: string, stepId: string) => {
    console.error(`[CookingContext] ▶️ Resuming timer for recipe ${recipeId}, step ${stepId}`);
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              activeTimers: recipe.activeTimers.map(timer =>
                timer.stepId === stepId
                  ? { ...timer, pausedAt: null, startTime: Date.now() }
                  : timer
              )
            }
          : recipe
      )
    );
  }, []);

  const endTimer = useCallback((recipeId: string, stepId: string) => {
    console.error(`[CookingContext] 🛑 Ending timer for recipe ${recipeId}, step ${stepId}`);
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              activeTimers: recipe.activeTimers.filter(timer => timer.stepId !== stepId)
            }
          : recipe
      )
    );
  }, []);

  const setScrollPosition = useCallback((recipeId: string, position: number) => {
    // Reduced logging for scroll position (only log errors if needed)
    
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? { ...recipe, scrollPosition: position }
          : recipe
      )
    );
  }, [activeRecipes]);

  const getCurrentScrollPosition = useCallback((recipeId: string): number => {
    const recipeSession = activeRecipes.find(session => session.recipeId === recipeId);
    return recipeSession ? recipeSession.scrollPosition : 0;
  }, [activeRecipes]);

  const hasResumableSession = useCallback((): boolean => {
    return activeRecipes.length > 0;
  }, [activeRecipes]);

  // Construct the state object for the context value
  const state = useMemo(() => ({
    activeRecipes,
    activeRecipeId,
    sessionStartTime,
  }), [activeRecipes, activeRecipeId, sessionStartTime]);

  // Memoize the context value
  const contextValue = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  useEffect(() => {
    console.error('[CookingContext] ✅ CookingProvider has rendered/re-rendered. State:', state);
  }, [state]);

  return (
    <CookingContext.Provider value={contextValue}>
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

 