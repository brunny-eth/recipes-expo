import * as React from 'react';
import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
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
// REMOVE PREVIOUS JSON.stringify(initialState) log here.
console.error('[CookingContext] 🌟 Initial state - activeRecipes length:', initialState.activeRecipes?.length || 'N/A'); // ADD THIS
console.error('[CookingContext] 🌟 Initial state - activeRecipeId:', initialState.activeRecipeId); // ADD THIS
console.error('[CookingContext] 🌟 Initial state - sessionStartTime:', initialState.sessionStartTime); // ADD THIS

// Context
const CookingContext = createContext<CookingContextType | null>(null);

// Reducer
function cookingReducer(state: CookingState, action: CookingAction): CookingState {
  console.error(`[CookingReducer] 🔄 Reducer called with action type: ${action.type}`);
  console.error(`[CookingReducer] 🔍 Current state:`, state);
  console.error(`[CookingReducer] 🔍 Incoming action payload:`, action.payload);

  switch (action.type) {
    case 'INITIALIZE_SESSIONS':
      console.error('[CookingReducer] 🚀 Handling INITIALIZE_SESSIONS action...');
      try {
        if (!action.payload || !Array.isArray(action.payload.recipes)) {
          console.error('[CookingReducer] ❌ INITIALIZE_SESSIONS: Invalid payload or recipes not an array.');
          console.error('[CookingReducer] ❌ Payload type:', typeof action.payload);
          console.error('[CookingReducer] ❌ Recipes type:', typeof action.payload?.recipes);
          return { ...state }; // Return current state instead of throwing
        }
        
        console.error('[CookingReducer] ✅ INITIALIZE_SESSIONS: Payload validation passed.');
        console.error('[CookingReducer] ✅ INITIALIZE_SESSIONS: Recipes array length:', action.payload.recipes.length);
        
        // Safely map recipes with error handling for each item
        const newActiveRecipes: RecipeSession[] = [];
        for (let i = 0; i < action.payload.recipes.length; i++) {
          try {
            const recipe = action.payload.recipes[i];
            console.error(`[CookingReducer] 🔍 Processing recipe ${i}:`, { id: recipe?.id, title: recipe?.title });
            
            if (!recipe || !recipe.id) {
              console.error(`[CookingReducer] ⚠️ Skipping recipe ${i}: missing id`);
              continue;
            }
            
            const recipeSession: RecipeSession = {
              recipeId: String(recipe.id),
              recipe,
              completedSteps: [],
              activeTimers: [],
              scrollPosition: 0,
              isLoading: false,
            };
            
            newActiveRecipes.push(recipeSession);
            console.error(`[CookingReducer] ✅ Successfully processed recipe ${i}: ${recipeSession.recipeId}`);
          } catch (recipeError: any) {
            console.error(`[CookingReducer] 💥 Error processing recipe ${i}:`, recipeError);
            console.error(`[CookingReducer] 💥 Recipe ${i} data:`, action.payload.recipes[i]);
            // Continue processing other recipes instead of failing completely
          }
        }
        
        const newActiveRecipeId = action.payload.activeRecipeId || newActiveRecipes[0]?.recipeId || null;

        console.error(`[CookingReducer] ✅ INITIALIZE_SESSIONS: Successfully processed ${newActiveRecipes.length} recipes.`);
        console.error(`[CookingReducer] ✅ INITIALIZE_SESSIONS: New activeRecipeId: ${newActiveRecipeId}`);

        return {
          ...state,
          activeRecipes: newActiveRecipes,
          activeRecipeId: newActiveRecipeId,
          sessionStartTime: Date.now(),
        };
      } catch (e: any) {
        console.error('[CookingReducer] 💥 CRITICAL ERROR in INITIALIZE_SESSIONS case:', e);
        console.error('[CookingReducer] 💥 Error stack in INITIALIZE_SESSIONS case:', e.stack);
        console.error('[CookingReducer] 💥 Error type:', typeof e);
        console.error('[CookingReducer] 💥 Error message:', e.message);
        // Return current state instead of throwing to prevent app crash
        return { ...state };
      }

    case 'SET_SCROLL_POSITION': {
      // Only log significant scroll changes to reduce noise
      const currentRecipe = state.activeRecipes.find(r => r.recipeId === action.payload.recipeId);
      const positionDifference = Math.abs((currentRecipe?.scrollPosition || 0) - action.payload.position);
      
      if (positionDifference > 20) { // Only log if position changed by more than 20px
        console.error('[CookingContext] 📍 Setting scroll position:', {
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
      console.error('[CookingContext] 🔀 Switching to recipe:', action.payload.recipeId);
      
      if (!state.activeRecipes.some(r => r.recipeId === action.payload.recipeId)) {
        console.error('[CookingContext] ⚠️ Cannot switch to recipe - not found in active recipes:', action.payload.recipeId);
        return state;
      }
      
      const newState = {
        ...state,
        activeRecipeId: action.payload.recipeId,
      };
      
      console.error('[CookingContext] ✅ Switched to recipe:', action.payload.recipeId);
      return newState;
    }

    case 'END_SESSION': {
      console.error('[CookingContext] 🛑 Ending session for recipe:', action.payload.recipeId);
      
      const updatedRecipes = state.activeRecipes.filter(
        recipe => recipe.recipeId !== action.payload.recipeId
      );
      
      const newState = {
        ...state,
        activeRecipes: updatedRecipes,
        activeRecipeId: updatedRecipes.length > 0 ? updatedRecipes[0].recipeId : null,
      };
      
      console.error('[CookingContext] ✅ Session ended:', {
        endedRecipeId: action.payload.recipeId,
        remainingRecipesCount: newState.activeRecipes.length,
        newActiveRecipeId: newState.activeRecipeId
      });
      
      return newState;
    }

    case 'RESTORE_STATE': {
      console.error('[CookingContext] 🔄 Restoring state from storage:', {
        activeRecipesCount: action.payload.activeRecipes.length,
        activeRecipeId: action.payload.activeRecipeId,
        sessionStartTime: action.payload.sessionStartTime
      });
      
      return action.payload;
    }

    case 'COMPLETE_STEP': {
      console.error('[CookingContext] ✅ Completing step:', {
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
      console.error('[CookingContext] ❌ Uncompleting step:', {
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
      console.warn(`[CookingReducer] ❓ Unhandled action type: ${action.type}`);
      return state;
  }
}



// Provider Component
export function CookingProvider({ children }: { children: React.ReactNode }) {
  let state: CookingState;
  let dispatch: React.Dispatch<CookingAction>;

  try {
    [state, dispatch] = useReducer(cookingReducer, initialState);
    console.error('[CookingContext] ✅ useReducer initialized successfully.'); // ADD THIS
  } catch (e: any) {
    console.error('[CookingContext] 💥 CRITICAL ERROR: useReducer failed to initialize!', e); // ADD THIS
    console.error('[CookingContext] 💥 useReducer error stack:', e.stack); // ADD THIS
    // Provide a fallback to prevent app crash, though functionality will be broken
    state = initialState;
    dispatch = () => { console.error('[CookingContext] 💥 Fallback dispatch called due to useReducer init error.'); };
  }

  console.error('[CookingContext] 🎯 cookingReducer function reference:', cookingReducer.toString()); // Keep this existing log
  
  // 💥 ADDED LOGGING POINT: Check typeof dispatch right after useReducer
  if (process.env.NODE_ENV === 'production') {
    console.error('[CookingContext] 🔍 typeof dispatch immediately after useReducer:', typeof dispatch);
  }

  // ADD THESE NEW LOGS:
  useEffect(() => {
    console.error(`[CookingContext] ✅ useReducer initialized successfully. Effect fired.`);
    console.error(`[CookingContext] 🎯 cookingReducer function reference from effect: ${cookingReducer.toString()}`);
    console.error(`[CookingContext] 🔍 typeof dispatch immediately after useReducer from effect: ${typeof dispatch}`);
    console.error(`[CookingContext] 🔍 dispatch object from effect (should be a function):`, dispatch);
    console.error(`[CookingContext] 🔍 state object from effect (initial state):`, state);
    console.error(`[CookingContext] 🔍 state.activeRecipes length from effect: ${state.activeRecipes?.length}`); // Check for deep property access

  }, [dispatch, state]); // Add dispatch and state to dependencies
  
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



  const endSession = (recipeId: string) => {
    dispatch({ type: 'END_SESSION', payload: { recipeId } });
  };

  const endAllSessions = async () => {
    console.log('[CookingContext] 🛑 Ending all cooking sessions');
    console.log('[CookingContext] 📊 Current sessions to end:', {
      activeRecipesCount: state.activeRecipes?.length || 0,
      recipeIds: state.activeRecipes?.map(r => r.recipeId) || []
    });
    
    // Clear all active sessions
    if (state.activeRecipes && Array.isArray(state.activeRecipes)) {
      state.activeRecipes.forEach(recipe => {
        console.log('[CookingContext] 🛑 Ending session for recipe:', recipe.recipeId);
        dispatch({ type: 'END_SESSION', payload: { recipeId: recipe.recipeId } });
      });
    }
    
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

  // Use useMemo to prevent tree-shaking of functions in production builds
  const contextValue = useMemo(() => {
    // 💥 LOGGING POINT 1: Check dispatch type right before defining initializeSessions
    if (process.env.NODE_ENV === 'production') {
      console.error('[CookingContext] 🔍 Production build - preparing contextValue. typeof dispatch (inside useMemo scope):', typeof dispatch);
    }

    // Define initializeSessions directly inside useMemo to make it intrinsically part of the context value
    // Pass dispatch as an explicit argument here
    const initializeSessions = useCallback(
      // ADD dispatchParam as the first argument
      async (dispatchParam: React.Dispatch<CookingAction>, miseRecipes: any[]) => {
        console.error('[CookingContext] 🚀 initializeSessions called (inside useCallback). Recipes Count:', miseRecipes.length);
        
        // 💥 ADDED LOGGING POINT: Check typeof dispatchParam right before calling it inside initializeSessions
        if (process.env.NODE_ENV === 'production') {
          console.error('[CookingContext] 🔍 initializeSessions: typeof dispatchParam before calling:', typeof dispatchParam);
        }
        
        console.time(`[CookingContext] ⏱️ initializeSessions`);
        console.error('[CookingContext] 🚀 Initializing cooking sessions with mise recipes:', {
          recipesCount: miseRecipes.length,
          recipeIds: miseRecipes.map(mr => mr.id),
        });

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

        // Initialize all sessions with full recipe data
        try {
          // REVERTED: Back to original payload for comprehensive debugging
          const actionPayload = { recipes, activeRecipeId: recipes[0]?.id ? String(recipes[0].id) : undefined };
          const actionToDispatch: CookingAction = {
            type: 'INITIALIZE_SESSIONS',
            payload: actionPayload
          };

          console.error('[CookingContext] 🔍 dispatching action type:', actionToDispatch.type);
          console.error('[CookingContext] 🔍 dispatching action payload.recipes length:', actionToDispatch.payload?.recipes?.length || 'N/A');
          console.error('[CookingContext] 🔍 dispatching action payload.activeRecipeId:', actionToDispatch.payload?.activeRecipeId);

          // Try to stringify actionPayload with a replacer to handle circular refs/complex objects if any
          try {
            console.error('[CookingContext] 🔍 Action object before dispatch (JSON.stringify - attempt):',
              JSON.stringify({
                type: 'INITIALIZE_SESSIONS',
                payload: {
                  recipes: actionToDispatch.payload.recipes.map(r => ({ id: r.id, title: r.title })), // Simplify recipes for logging
                  activeRecipeId: actionToDispatch.payload.activeRecipeId
                }
              }, (key, value) => {
                // A simple replacer to handle potential complex objects or circular references
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  const simpleObject: { [k: string]: any } = {};
                  for (const prop in value) {
                    if (typeof value[prop] !== 'function' && typeof value[prop] !== 'object') {
                      simpleObject[prop] = value[prop];
                    }
                  }
                  return simpleObject;
                }
                return value;
              })
            );
          } catch (e) {
            console.error('[CookingContext] 💥 Error stringifying actionPayload before dispatch:', e);
          }

          console.error('[CookingContext] 🔍 Action object before dispatch (type and payload type):', {
            type: actionToDispatch.type,
            payloadType: typeof actionToDispatch.payload,
            isMinimalPayload: Object.keys(actionToDispatch.payload).length === 0,
            payloadKeys: Object.keys(actionToDispatch.payload),
          });

          // ADD THIS LOG IMMEDIATELY BEFORE DISPATCH - THIS IS CRITICAL NOW
                      console.error(`[CookingContext] 🔍 Just before dispatch call (inside useCallback). typeof dispatchParam: ${typeof dispatchParam}`);
            console.error(`[CookingContext] 🔍 dispatchParam value (inside useCallback):`, dispatchParam); // See what it actually is

            // --- ADD THESE NEW LOGS AND TRY/CATCH ---
            try {
              dispatchParam(actionToDispatch);
              console.error('[CookingContext] ✅ Dispatch call completed successfully (synchronous check).');
            } catch (dispatchInnerError: any) {
              console.error('[CookingContext] 💥 ERROR: Dispatch call FAILED synchronously (inside useCallback)!', dispatchInnerError);
              console.error('[CookingContext] 💥 Error message from inner dispatch catch:', dispatchInnerError.message);
              console.error('[CookingContext] 💥 Error stack from inner dispatch catch:', dispatchInnerError.stack);
              throw dispatchInnerError; // Re-throw to propagate if needed
            }
            // --- END NEW LOGS AND TRY/CATCH ---

            console.error('[CookingContext] ✅ Dispatch attempt finished. Waiting for reducer to process...'); // This log indicates it went past the synchronous dispatch call
        } catch (dispatchError: any) { // Ensure error is typed to 'any' for direct property access
          console.error('[CookingContext] ❌ Error during initializeSessions dispatch:', dispatchError);
          console.error('[CookingContext] ❌ Error message (from dispatch):', dispatchError.message);
          console.error('[CookingContext] ❌ Error stack (from dispatch):', dispatchError.stack);
          // Re-throw if it's a critical error you don't want to swallow
          throw dispatchError;
        }
        
        console.timeEnd(`[CookingContext] ⏱️ initializeSessions`);
      } catch (error) {
        console.error('[CookingContext] 💥 Error in initializeSessions:', error);
        console.error('[CookingContext] 💥 Error type:', typeof error);
        console.error('[CookingContext] 💥 Error message:', error instanceof Error ? error.message : String(error));
        console.error('[CookingContext] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('[CookingContext] 💥 Error constructor:', error?.constructor?.name);
        console.error('[CookingContext] 💥 Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.timeEnd(`[CookingContext] ⏱️ initializeSessions`);
        throw error; // Re-throw to be caught by the calling function
      }
          },
      [dispatch] // ADD DISPATCH HERE. This is the key change!
    );

    // 💥 CRITICAL: Ensure this function is not tree-shaken - use void operator
    void initializeSessions; // This line is crucial for preventing tree-shaking
    
    // 💥 ADDED VOID DISPATCH: Explicitly hint to the bundler that dispatch is used
    void dispatch; // New line

    // 💥 LOGGING POINT 2: Check initializeSessions type as it's being returned in contextValue
    if (process.env.NODE_ENV === 'production') {
      console.error('[CookingContext] 🔍 Production build - contextValue being formed. typeof initializeSessions (inside useMemo):', typeof initializeSessions);
      console.error('[CookingContext] 🔍 Production build - contextValue keys:', Object.keys({
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
      }));
    }
    
    // Explicitly construct the context value to ensure all functions are included
    const value = {
      state,
      // WRAP initializeSessions to pass 'dispatch' from this scope
      initializeSessions: (recipes: any[]) => initializeSessions(dispatch, recipes),
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
    };
    
    // Additional safety check in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[CookingContext] 🔍 Production build - context value keys:', Object.keys(value));
      console.error('[CookingContext] 🔍 Production build - initializeSessions in value:', typeof value.initializeSessions);
    }
    
    return value;
  }, [
    state,
    dispatch, // Crucial dependency for initializeSessions defined within
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
  ]);

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
  
  // Add fallback for initializeSessions if it's undefined in production builds
  if (!context.initializeSessions && process.env.NODE_ENV === 'production') {
    console.error('[CookingContext] 💥 initializeSessions is undefined in production build!');
    console.error('[CookingContext] 💥 Available context keys:', Object.keys(context));
    
    // Create a fallback function that logs the error
    const fallbackInitializeSessions = (miseRecipes: any[]) => {
      console.error('[CookingContext] 💥 Fallback initializeSessions called - this should not happen!');
      console.error('[CookingContext] 💥 miseRecipes:', miseRecipes);
      throw new Error('initializeSessions is not available in this build');
    };
    
    return {
      ...context,
      initializeSessions: fallbackInitializeSessions,
    };
  }
  
  return context;
}

 