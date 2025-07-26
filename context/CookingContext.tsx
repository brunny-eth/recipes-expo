import * as React from 'react';
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CombinedParsedRecipe } from '../common/types';
import { useAuth } from './AuthContext';

// Helper for deep comparison (simple for arrays of primitives/objects without circular refs)
// This is a basic deep equality check. For more complex objects, a dedicated library like 'fast-deep-equal' might be needed.
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (a.constructor !== b.constructor) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  return a !== a && b !== b; // Handle NaN
};

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

  // State monitoring effect with timestamps to track when state changes
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.error(`[CookingContext] 📊 STATE CHANGE at ${timestamp}: activeRecipes: ${activeRecipes?.length}, activeRecipeId: ${activeRecipeId}, sessionStartTime: ${sessionStartTime}`);
    
    // Log what might have triggered this state change
    if (activeRecipes?.length > 0) {
      console.error('[CookingContext] 📊 Active recipes detected:', activeRecipes.map(r => ({ id: r.recipeId, hasRecipe: !!r.recipe })));
    }
  }, [activeRecipes, activeRecipeId, sessionStartTime]);
  
  const { session } = useAuth();

  // Load state from storage on mount with recovery logic
  useEffect(() => {
    const loadState = async () => {
      const loadTimestamp = new Date().toISOString();
      console.error(`[CookingContext] 🔄 ASYNCSTORAGE LOAD START at ${loadTimestamp}`);
      
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
          const restoreTimestamp = new Date().toISOString();
          console.error(`[CookingContext] ✅ RESTORING SESSION from AsyncStorage at ${restoreTimestamp}`);
          console.error('[CookingContext] ✅ Restoring data:', {
            activeRecipesCount: parsedState.activeRecipes?.length,
            activeRecipeId: parsedState.activeRecipeId,
            sessionStartTime: parsedState.sessionStartTime,
            sessionAgeHours: Math.round(sessionAge / (60 * 60 * 1000) * 10) / 10
          });
          
          // Use deepEqual to prevent unnecessary re-renders if state is identical
          if (!deepEqual(activeRecipes, parsedState.activeRecipes)) {
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
          const stateToSave = JSON.stringify({ 
            activeRecipes, 
            activeRecipeId, 
            sessionStartTime
          });
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
    (miseRecipes: any[], initialActiveRecipeId?: string) => { // Added optional initialActiveRecipeId
      console.error('[CookingContext] 🚀 initializeSessions called (useState version). Recipes Count:', miseRecipes.length, 'Initial Active ID:', initialActiveRecipeId);

      if (!miseRecipes || !Array.isArray(miseRecipes) || miseRecipes.length === 0) {
        console.error('[CookingContext] ⚠️ initializeSessions called with empty or invalid recipes array.');
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
          console.warn(`[CookingContext] ⚠️ Initial active recipe ID "${targetActiveRecipeId}" not found in new recipes. Defaulting to first recipe.`);
          targetActiveRecipeId = newActiveRecipes.length > 0 ? String(newActiveRecipes[0].recipeId) : null;
        }

        // Update state directly using useState setters, with deep comparison
        if (!deepEqual(activeRecipes, newActiveRecipes)) {
          setActiveRecipes(newActiveRecipes);
          console.error('[CookingContext] ✅ activeRecipes updated.');
        } else {
          console.error('[CookingContext] ℹ️ activeRecipes are identical, skipping update.');
        }
        
        if (activeRecipeId !== targetActiveRecipeId) {
          setActiveRecipeId(targetActiveRecipeId);
          console.error('[CookingContext] ✅ activeRecipeId updated.');
        } else {
          console.error('[CookingContext] ℹ️ activeRecipeId is identical, skipping update.');
        }

        // Always set session start time on initialization
        const newSessionStartTime = Date.now();
        if (sessionStartTime !== newSessionStartTime) {
          setSessionStartTime(newSessionStartTime);
          console.error('[CookingContext] ✅ sessionStartTime updated.');
        } else {
          console.error('[CookingContext] ℹ️ sessionStartTime is identical, skipping update.');
        }

        console.error('[CookingContext] ✅ State update checks completed via useState setters.');
        console.error(`[CookingContext] ✅ Final activeRecipes count: ${newActiveRecipes.length}`);
        console.error(`[CookingContext] ✅ Final activeRecipeId: ${targetActiveRecipeId}`);

      } catch (e: any) {
        console.error('[CookingContext] 💥 CRITICAL ERROR in initializeSessions (useState refactor):', e);
        console.error('[CookingContext] 💥 Error stack:', e.stack);
        // Reset state on error
        setActiveRecipes([]);
        setActiveRecipeId(null);
        setSessionStartTime(undefined);
      }
    },
    [activeRecipes, activeRecipeId, sessionStartTime] // Dependencies for useCallback to ensure deepEqual works with current state
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
        // If the current active recipe is being ended, switch to the first remaining one
        setActiveRecipeId(updatedRecipes[0].recipeId);
      }
      
      console.error('[CookingContext] ✅ Session ended:', {
        endedRecipeId: recipeId,
        remainingRecipesCount: updatedRecipes.length,
      });
      
      return updatedRecipes;
    });
  }, [activeRecipeId]); // Dependency on activeRecipeId to ensure correct switch logic

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
  }, [activeRecipes, activeRecipeId]); // Dependencies to ensure accurate logging before state clear

  const switchRecipe = useCallback((recipeId: string) => {
    console.error('[CookingContext] 🔄 Switching to recipe:', recipeId);
    
    // DEFENSIVE: Check if activeRecipes is valid before calling .some()
    if (!activeRecipes || !Array.isArray(activeRecipes)) {
      console.error('[CookingContext] 🛑 CRITICAL: activeRecipes is not a valid array:', typeof activeRecipes, activeRecipes);
      return;
    }
    
    // DEFENSIVE: Check if setActiveRecipeId is still a function
    if (typeof setActiveRecipeId !== 'function') {
      console.error('[CookingContext] 🛑 CRITICAL: setActiveRecipeId is not a function:', typeof setActiveRecipeId);
      return;
    }
    
    // Safe to call .some() now
    const recipeExists = activeRecipes.some(r => r && r.recipeId === recipeId);
    if (!recipeExists) {
      console.error('[CookingContext] ⚠️ Cannot switch to recipe - not found in active recipes:', recipeId);
      console.error('[CookingContext] 🔍 Available recipes:', activeRecipes.map(r => r?.recipeId));
      return;
    }
    
    // Only update if the activeRecipeId is actually changing
    if (activeRecipeId !== recipeId) {
      console.error('[CookingContext] 🧪 About to call setActiveRecipeId with:', recipeId);
      setActiveRecipeId(recipeId);
      console.error('[CookingContext] ✅ Switched to recipe:', recipeId);
    } else {
      console.error('[CookingContext] ℹ️ Already on target recipe, skipping switch.');
    }
  }, [activeRecipes, activeRecipeId, setActiveRecipeId]); // Added setActiveRecipeId to dependencies

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
                  ? { ...timer, pausedAt: null, startTime: Date.now() + (timer.pausedAt ? (Date.now() - timer.pausedAt) : 0) } // Adjust start time to account for pause
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
      console.warn('[CookingContext] No sessionStartTime found - session not resumable');
      return false;
    }

    const now = Date.now();
    const sessionAge = now - sessionStartTime;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxAge) {
      console.log('[CookingContext] Session expired (age:', Math.round(sessionAge / (60 * 60 * 1000)), 'hours) - not resumable');
      return false;
    }

    console.log('[CookingContext] Session is resumable (age:', Math.round(sessionAge / (60 * 60 * 1000)), 'hours)');
    return true;
  }, [activeRecipes, sessionStartTime]);

  const invalidateSession = useCallback(() => {
    const timestamp = new Date().toISOString();
    console.log(`[CookingContext] 🗑️ INVALIDATING SESSION at ${timestamp}`);
    console.log('[CookingContext] 🗑️ Before invalidation:', { 
      activeRecipesCount: activeRecipes.length, 
      activeRecipeId, 
      sessionStartTime 
    });
    
    setActiveRecipes([]);
    setActiveRecipeId(null);
    setSessionStartTime(undefined);
    
    console.log('[CookingContext] 🗑️ After invalidation state set - should be empty');
    
    // Also clear AsyncStorage
    AsyncStorage.removeItem('meez.cookingSession').then(() => {
      console.log('[CookingContext] 🗑️ AsyncStorage cleared successfully');
    }).catch(error => {
      console.warn('[CookingContext] Warning: Failed to clear AsyncStorage during invalidation:', error);
    });
  }, [activeRecipes, activeRecipeId, sessionStartTime]);

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
      invalidateSession,
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
