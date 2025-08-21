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
  // Updated initializeSessions signature
  initializeSessions: (miseRecipes: any[], initialActiveRecipeId?: string) => void;
  endSession: (recipeId: string) => void;
  endAllSessions: () => void;
  switchRecipe: (recipeId: string) => void;
  // New selection state for Mise-driven selection
  selectedMiseId: string | null;
  selectMiseRecipe: (id: string | number) => void;
  completeStep: (recipeId: string, stepId: string) => void;
  uncompleteStep: (recipeId: string, stepId: string) => void;
  startTimer: (recipeId: string, stepId: string, duration: number) => void;
  pauseTimer: (recipeId: string, stepId: string) => void;
  resumeTimer: (recipeId: string, stepId: string) => void;
  endTimer: (recipeId: string, stepId: string) => void;
  setScrollPosition: (recipeId: string, position: number) => void;
  getCurrentScrollPosition: (recipeId: string) => number;
  hasResumableSession: () => boolean;
  invalidateSession: () => void;
  updateRecipe: (recipeId: string, updatedRecipe: CombinedParsedRecipe) => void;
};

const initialState: CookingState = {
  activeRecipes: [],
  activeRecipeId: null,
  sessionStartTime: undefined,
};



// Context
const CookingContext = createContext<CookingContextType | null>(null);

// Provider Component
export function CookingProvider({ children }: { children: React.ReactNode }) {
  // Use useState instead of useReducer
  const [activeRecipes, setActiveRecipes] = useState<RecipeSession[]>(initialState.activeRecipes);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(initialState.activeRecipeId);
  const [sessionStartTime, setSessionStartTime] = useState<number | undefined>(initialState.sessionStartTime);
  // New: Selected mise recipe id used to drive canonical selection in Cook
  const [selectedMiseId, setSelectedMiseId] = useState<string | null>(null);


  
  const { session } = useAuth();

  // Load state from storage on mount with recovery logic
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('meez.cookingSession');
        
        if (!savedState) {
          return;
        }
        
        const parsedState = JSON.parse(savedState);
        
        // Check if session is recent (within 24 hours)
        const now = Date.now();
        const sessionAge = now - (parsedState.sessionStartTime || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge < maxAge && parsedState.activeRecipes?.length > 0) {
          // Valid session found - can be resumed
          
          // Use safe comparison to prevent unnecessary re-renders if state is identical
          const needsActiveRecipesRestore = activeRecipes.length !== parsedState.activeRecipes?.length ||
            !activeRecipes.every((existing, index) => 
              parsedState.activeRecipes[index] && existing.recipeId === parsedState.activeRecipes[index].recipeId
            );
            
          if (needsActiveRecipesRestore) {
            setActiveRecipes(parsedState.activeRecipes);
          }
          if (activeRecipeId !== parsedState.activeRecipeId) {
            setActiveRecipeId(parsedState.activeRecipeId);
          }
          if (sessionStartTime !== parsedState.sessionStartTime) {
            setSessionStartTime(parsedState.sessionStartTime);
          }
        } else {
          // Session too old or empty, clear it
          await AsyncStorage.removeItem('meez.cookingSession');
        }
      } catch (error) {
        console.error('[CookingContext] 💥 Error loading cooking state:', error);
        // Clear corrupted state
        await AsyncStorage.removeItem('meez.cookingSession');
      }
    };
    loadState();
  }, []);

  // Save state to storage on changes
  useEffect(() => {
    const saveState = async () => {
      try {
        // Only save if there are active recipes
        if (activeRecipes.length > 0) {
          const stateToSave = JSON.stringify({ 
            activeRecipes, 
            activeRecipeId, 
            sessionStartTime
          });
          await AsyncStorage.setItem('meez.cookingSession', stateToSave);
        } else {
          // Clear storage if no active recipes
          await AsyncStorage.removeItem('meez.cookingSession');
        }
      } catch (error) {
        console.error('[CookingContext] 💥 Error saving cooking state:', error);
      }
    };
    saveState();
  }, [activeRecipes, activeRecipeId, sessionStartTime]);

  // --- initializeSessions function refactored to use useState setters directly ---
  const initializeSessions = useCallback(
    (miseRecipes: any[], initialActiveRecipeId?: string) => { // Added optional initialActiveRecipeId

      if (!miseRecipes || !Array.isArray(miseRecipes) || miseRecipes.length === 0) {
        // Only update if state is not already empty
        if (activeRecipes.length > 0 || activeRecipeId !== null || sessionStartTime !== undefined) {
          setActiveRecipes([]);
          setActiveRecipeId(null);
          setSessionStartTime(undefined);
        }
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
              return null;
            }

            // Create the recipe object with mise ID as primary ID
            const recipe = {
              ...recipeData,
              id: String(miseRecipe.id), // Use the mise ID as the primary ID
              originalRecipeId: recipeData.id, // Keep original recipe ID for reference
              miseRecipeId: miseRecipe.id, // Keep mise recipe ID for reference
            };



            return recipe;
          } catch (error) {
            return null;
          }
        }).filter(Boolean) as CombinedParsedRecipe[];



        const newActiveRecipes: RecipeSession[] = recipes.map(recipe => {
          // Add validation for recipe properties if needed
          if (!recipe || !recipe.id) {
            return null as any;
          }
          // Preserve existing scroll position if recipe already exists in activeRecipes
          const existingSession = activeRecipes.find(s => s.recipeId === String(recipe.id));
          return {
            recipeId: String(recipe.id),
            recipe: recipe,
            completedSteps: existingSession ? existingSession.completedSteps : [],
            activeTimers: existingSession ? existingSession.activeTimers : [],
            scrollPosition: existingSession ? existingSession.scrollPosition : 0,
            isLoading: false,
          };
        }).filter(Boolean) as RecipeSession[];

        // Determine the new active recipe ID
        let targetActiveRecipeId = initialActiveRecipeId || (newActiveRecipes.length > 0 ? String(newActiveRecipes[0].recipeId) : null);
        // Ensure the targetActiveRecipeId actually exists in the newActiveRecipes list
        if (targetActiveRecipeId && !newActiveRecipes.some(r => r.recipeId === targetActiveRecipeId)) {
          targetActiveRecipeId = newActiveRecipes.length > 0 ? String(newActiveRecipes[0].recipeId) : null;
        }

        // Update state directly using useState setters, with safe comparison
        // Check if we need to update activeRecipes by comparing lengths and recipe IDs
        const needsActiveRecipesUpdate = activeRecipes.length !== newActiveRecipes.length ||
          !activeRecipes.every((existing, index) => 
            newActiveRecipes[index] && existing.recipeId === newActiveRecipes[index].recipeId
          );
          
        if (needsActiveRecipesUpdate) {
          setActiveRecipes(newActiveRecipes);
        }
        
        if (activeRecipeId !== targetActiveRecipeId) {
          setActiveRecipeId(targetActiveRecipeId);
        }

        // Auto-select first mise recipe if none selected yet (optional behavior)
        if (!selectedMiseId && newActiveRecipes.length > 0) {
          const firstId = String(newActiveRecipes[0].recipeId);
          console.log('[CTX] autoSelectMiseRecipe', { firstId });
          setSelectedMiseId(firstId);
        }

        // Always set session start time on initialization
        const newSessionStartTime = Date.now();
        if (sessionStartTime !== newSessionStartTime) {
          setSessionStartTime(newSessionStartTime);
        }

      } catch (e: any) {
        console.error('[CookingContext] 💥 CRITICAL ERROR in initializeSessions:', e);
        // Reset state on error
        setActiveRecipes([]);
        setActiveRecipeId(null);
        setSessionStartTime(undefined);
      }
    },
    [activeRecipes, activeRecipeId, sessionStartTime, selectedMiseId] // Dependencies for useCallback to ensure comparison works with current state
  );

  // All other functions refactored to use useState setters
  const endSession = useCallback((recipeId: string) => {
    setActiveRecipes(prevRecipes => {
      const updatedRecipes = prevRecipes.filter(recipe => recipe.recipeId !== recipeId);
      
      if (updatedRecipes.length === 0) {
        setActiveRecipeId(null);
        setSessionStartTime(undefined);
      } else if (activeRecipeId === recipeId) {
        // If the current active recipe is being ended, switch to the first remaining one
        setActiveRecipeId(updatedRecipes[0].recipeId);
      }
      
      return updatedRecipes;
    });
  }, [activeRecipeId]); // Dependency on activeRecipeId to ensure correct switch logic

  const endAllSessions = useCallback(() => {
    if (!activeRecipes || activeRecipes.length === 0) {
      return;
    }

    setActiveRecipes([]);
    setActiveRecipeId(null);
    setSessionStartTime(undefined);
    setSelectedMiseId(null);

    AsyncStorage.removeItem('meez.cookingSession').catch(error => {
      console.error('[CookingContext] 💥 Error clearing AsyncStorage:', error);
    });
  }, [activeRecipes, activeRecipeId]); // Dependencies to ensure accurate logging before state clear

  const switchRecipe = useCallback((recipeId: string) => {
    // DEFENSIVE: Check if activeRecipes is valid before calling .some()
    if (!activeRecipes || !Array.isArray(activeRecipes)) {
      return;
    }
    
    // DEFENSIVE: Check if setActiveRecipeId is still a function
    if (typeof setActiveRecipeId !== 'function') {
      return;
    }
    
    // Safe to call .some() now
    const recipeExists = activeRecipes.some(r => r && r.recipeId === recipeId);
    if (!recipeExists) {
      return;
    }
    
    // Only update if the activeRecipeId is actually changing
    if (activeRecipeId !== recipeId) {
      setActiveRecipeId(recipeId);
    }
  }, [activeRecipes, activeRecipeId, setActiveRecipeId]); // Added setActiveRecipeId to dependencies

  const completeStep = useCallback((recipeId: string, stepId: string) => {
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
    setActiveRecipes(prevRecipes =>
      prevRecipes.map(recipe =>
        recipe.recipeId === recipeId
          ? {
              ...recipe,
              activeTimers: recipe.activeTimers.map(timer =>
                timer.stepId === stepId
                  ? { ...timer, pausedAt: null, startTime: Date.now() + (timer.pausedAt ? (Date.now() - timer.pausedAt) : 0) } // Adjust start time to account for pause
                  : timer
              )
            }
          : recipe
      )
    );
  }, []);

  const endTimer = useCallback((recipeId: string, stepId: string) => {
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
  }, []); // No dependencies needed as it uses prevRecipes directly

  const getCurrentScrollPosition = useCallback((recipeId: string): number => {
    const recipeSession = activeRecipes.find(session => session.recipeId === recipeId);
    return recipeSession ? recipeSession.scrollPosition : 0;
  }, [activeRecipes]);

  const hasResumableSession = useCallback((): boolean => {
    // Check if we have active recipes
    if (activeRecipes.length === 0) {
      return false;
    }

    // Check if session is not too old (24 hour expiration)
    if (!sessionStartTime) {
      return false;
    }

    const now = Date.now();
    const sessionAge = now - sessionStartTime;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxAge) {
      return false;
    }

    return true;
  }, [activeRecipes, sessionStartTime]);

  const invalidateSession = useCallback(() => {
    setActiveRecipes([]);
    setActiveRecipeId(null);
    setSessionStartTime(undefined);
    setSelectedMiseId(null);
    
    // Also clear AsyncStorage
    AsyncStorage.removeItem('meez.cookingSession').catch(error => {
      console.warn('[CookingContext] Warning: Failed to clear AsyncStorage during invalidation:', error);
    });
  }, [activeRecipes, activeRecipeId, sessionStartTime]);

  const updateRecipe = useCallback((recipeId: string, updatedRecipe: CombinedParsedRecipe) => {
    setActiveRecipes(prevRecipes => 
      prevRecipes.map(recipe => 
        recipe.recipeId === recipeId
          ? { ...recipe, recipe: updatedRecipe }
          : recipe
      )
    );
  }, []);

  // Select a mise recipe (single source of truth for Cook)
  const selectMiseRecipe = useCallback((id: string | number) => {
    const next = String(id);
    console.log('[CTX] selectMiseRecipe', { next });
    setSelectedMiseId(next);
  }, []);

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
      selectedMiseId,
      selectMiseRecipe,
      completeStep,
      uncompleteStep,
      startTimer,
      pauseTimer,
      resumeTimer,
      endTimer,
      setScrollPosition,
      getCurrentScrollPosition,
      hasResumableSession,
      invalidateSession,
      updateRecipe,
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
      invalidateSession,
      updateRecipe,
    ]
  );



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
