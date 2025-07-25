import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  InteractionManager,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCooking } from '@/context/CookingContext';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { COLORS, SPACING, RADIUS, OVERLAYS, SHADOWS, BORDER_WIDTH } from '@/constants/theme';
import { sectionHeaderText, bodyText, bodyStrongText, bodyTextLoose, captionText } from '@/constants/typography';
import { CombinedParsedRecipe, StructuredIngredient } from '@/common/types';
import RecipeSwitcher from '@/components/recipe/RecipeSwitcher';
import StepItem from '@/components/recipe/StepItem';
import ToolsModal from '@/components/ToolsModal';
import MiniTimerDisplay from '@/components/MiniTimerDisplay';
import StepsFooterButtons from '@/components/recipe/StepsFooterButtons';
import { ActiveTool } from '@/components/ToolsModal';

import { 
  StepCompletionState, 
  isStepCompleted, 
  isStepActive, 
  autoScrollToNextStep 
} from '@/utils/stepUtils';
import { abbreviateUnit } from '@/utils/format';

export default function CookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const { showError } = useErrorModal();
  const { state, initializeSessions, endSession, endAllSessions, switchRecipe, setScrollPosition, getCurrentScrollPosition, hasResumableSession, completeStep, uncompleteStep } = useCooking();

  // DEBUG: Check types of functions that handleRecipeSwitch relies on
  console.error('[CookScreen] DEBUG: typeof setScrollPosition:', typeof setScrollPosition);
  console.error('[CookScreen] DEBUG: typeof switchRecipe:', typeof switchRecipe);
  console.error('[CookScreen] DEBUG: typeof getCurrentScrollPosition:', typeof getCurrentScrollPosition);

  // Add targeted debugging for navigation-related functions
  console.error('[CookScreen] 🔍 Component initialized with router:', typeof router);
  console.error('[CookScreen] 🔍 Router methods available:', Object.keys(router));
  console.error('[CookScreen] 🔍 showError function type:', typeof showError);
  
  // 💥 LOGGING POINT 3: Check initializeSessions type immediately after destructuring from useCooking
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CookScreen] 🔍 useCooking hook accessed. typeof initializeSessions:', typeof initializeSessions);
      if (typeof initializeSessions !== 'function') {
        console.error('[CookScreen] 💥 CRITICAL: initializeSessions is NOT a function after useCooking!');
        console.error('[CookScreen] 💥 Available keys from useCooking:', Object.keys(useCooking()));
        console.error('[CookScreen] 💥 Full useCooking result:', useCooking());
      } else {
        console.error('[CookScreen] ✅ initializeSessions is properly defined as function');
      }
    }
  }, [initializeSessions]); // Dependency on initializeSessions itself
  
  const [isLoading, setIsLoading] = useState(true);
  const [recipes, setRecipes] = useState<CombinedParsedRecipe[]>([]);
  const appState = useRef(AppState.currentState);
  const scrollViewRef = useRef<ScrollView>(null);

  // --- Ingredient Tooltip State ---
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  // --- End Ingredient Tooltip State ---

  // --- Timer State (Persistent Across Recipes) ---
  const [timerTimeRemaining, setTimerTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // --- End Timer State ---

  // --- Tools Modal State ---
  const [isToolsPanelVisible, setIsToolsPanelVisible] = useState(false);
  const [initialToolToShow, setInitialToolToShow] = useState<ActiveTool>(null);
  // --- End Tools Modal State ---

  // --- Recipe Tips Modal State ---
  const [isRecipeTipsModalVisible, setIsRecipeTipsModalVisible] = useState(false);
  // --- End Recipe Tips Modal State ---

  // Add scroll position throttling
  const scrollPositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = (event: any) => {
    if (state.activeRecipeId) {
      const scrollY = event.nativeEvent.contentOffset.y;
      
      // Clear existing timeout
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
      
      // Throttle scroll position updates to reduce excessive logging and improve performance
      scrollPositionTimeoutRef.current = setTimeout(() => {
        setScrollPosition(state.activeRecipeId!, scrollY);
      }, 100); // Update every 100ms instead of every 16ms
    }
  };

  // Component lifecycle monitoring with cleanup
  useEffect(() => {
    console.error('[CookScreen] 🔍 Component mounted or dependencies changed.');
    
    return () => {
      console.error('[CookScreen] 🔍 Component unmounting (cleanup function).');
      console.error('[CookScreen] 🔍 Cleaning up scroll timeout and timer interval');
      
      if (scrollPositionTimeoutRef.current) {
        console.error('[CookScreen] 🔍 Clearing scroll position timeout');
        clearTimeout(scrollPositionTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        console.error('[CookScreen] 🔍 Clearing timer interval');
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [state.activeRecipes, state.activeRecipeId, state.sessionStartTime, isLoading, router]);

  // Load recipes from mise on mount - fetch fresh data from API
  useEffect(() => {
    const loadMiseRecipes = async () => {
      try {
        setIsLoading(true);
        console.log('[CookScreen] 🔄 Starting to load fresh mise recipes from API');
        
        // Clear any existing cooking session to start fresh
        console.log('[CookScreen] 🧹 Clearing existing cooking sessions');
        await endAllSessions();
        
        // Fetch fresh mise data from API instead of using cached data
        if (!session?.user) {
          console.log('[CookScreen] ❌ No user session found');
          setRecipes([]);
          return;
        }
        
        const backendUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!backendUrl) {
          throw new Error('API configuration error');
        }
        
        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        };
        
        console.log('[CookScreen] 📡 Fetching fresh mise recipes from API');
        const response = await fetch(`${backendUrl}/api/mise/recipes?userId=${session.user.id}`, { headers });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch mise recipes: ${response.statusText}`);
        }
        
        const recipesData = await response.json();
        const miseRecipes = recipesData?.recipes || [];
        
        console.log('[CookScreen] 📊 Fresh mise recipes from API:', miseRecipes.length, 'recipes');
        console.log('[CookScreen] 📋 Mise recipes summary:', miseRecipes.map((mr: any) => ({
          id: mr.id,
          title: mr.prepared_recipe_data?.title || mr.original_recipe_data?.title,
          hasLocalMods: !!mr.local_modifications,
          hasPreparedData: !!mr.prepared_recipe_data,
          hasOriginalData: !!mr.original_recipe_data,
        })));
        
        if (miseRecipes.length === 0) {
          console.log('[CookScreen] ❌ No mise recipes found');
          setRecipes([]);
          return;
        }
        
        // Extract recipe data from mise recipes and use mise ID as primary identifier
        const recipeList = miseRecipes.map((miseRecipe: any) => {
          console.log('[CookScreen] 🔄 Processing mise recipe:', miseRecipe.id);
          
          const recipeData = miseRecipe.local_modifications?.modified_recipe_data || 
                           miseRecipe.prepared_recipe_data || 
                           miseRecipe.original_recipe_data;
          
          if (!recipeData) {
            console.error('[CookScreen] ❌ No recipe data found for mise recipe:', miseRecipe.id);
            return null;
          }
          
          // Use mise recipe ID as the primary identifier for cooking sessions
          const cookingSessionId = String(miseRecipe.id);
          
          const processedRecipe = {
            ...recipeData,
            id: cookingSessionId, // Use mise ID as the cooking session ID
            originalRecipeId: recipeData.id, // Keep original recipe ID for reference
            miseRecipeId: miseRecipe.id, // Keep mise recipe ID for reference
            title: miseRecipe.title_override || recipeData.title, // Use title_override if available
          };
          
          console.log('[CookScreen] ✅ Processed recipe:', {
            cookingSessionId,
            title: processedRecipe.title,
            originalRecipeId: processedRecipe.originalRecipeId,
            miseRecipeId: processedRecipe.miseRecipeId,
            hasInstructions: !!processedRecipe.instructions,
            instructionsCount: processedRecipe.instructions?.length || 0,
            hasIngredients: !!processedRecipe.ingredientGroups,
            ingredientGroupsCount: processedRecipe.ingredientGroups?.length || 0,
          });
          
          return processedRecipe;
        }).filter(Boolean); // Remove any null entries
        
        console.log('[CookScreen] 📊 Final recipe list for cooking:', {
          totalCount: recipeList.length,
          recipes: recipeList.map((r: any) => ({ 
            cookingSessionId: r.id, 
            title: r.title,
            miseRecipeId: r.miseRecipeId,
            originalRecipeId: r.originalRecipeId
          }))
        });
        
        setRecipes(recipeList);
        
        // Initialize all sessions with eager loading using fresh mise recipes
        if (miseRecipes.length > 0) {
          console.log('[CookScreen] 🚀 Initializing cooking sessions for', miseRecipes.length, 'recipes with fresh data');
          
          // 💥 LOGGING POINT 4: Log right before calling initializeSessions
          if (process.env.NODE_ENV === 'production') {
            console.error('[CookScreen] 🔍 Before calling initializeSessions. typeof initializeSessions:', typeof initializeSessions);
            console.error('[CookScreen] 🔍 initializeSessions is function?', typeof initializeSessions === 'function');
            console.error('[CookScreen] 🔍 initializeSessions.toString():', initializeSessions?.toString?.()?.substring(0, 100) + '...');
          }
          
          try {
            // Initialize all sessions at once with full recipe data
            initializeSessions(miseRecipes);
            
            console.error('[CookScreen] ✅ All cooking sessions initialized with fresh recipe data');
          } catch (error) {
            console.error('[CookScreen] 💥 TypeError caught in initializeSessions call:', error);
            console.error('[CookScreen] 💥 Error type:', typeof error);
            console.error('[CookScreen] 💥 Error message:', error instanceof Error ? error.message : String(error));
            console.error('[CookScreen] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            console.error('[CookScreen] 💥 Error constructor:', error?.constructor?.name);
            console.error('[CookScreen] 💥 Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            
            // Continue without sessions rather than crashing the app
            console.error('[CookScreen] ⚠️ Continuing without cooking sessions due to initialization error');
          }
        } else {
          console.error('[CookScreen] ❌ No valid recipes found to start cooking sessions');
        }
      } catch (error) {
        console.error('[CookScreen] 💥 Error loading mise recipes:', error);
        console.error('[CookScreen] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Show error in console instead of alert for simplicity
        console.error('[CookScreen] 💥 Failed to load recipes from mise:', error);
      } finally {
        setIsLoading(false);
        console.log('[CookScreen] 🏁 Finished loading mise recipes, isLoading set to false');
      }
    };

    loadMiseRecipes();
  }, []);

  // Refresh data when screen comes into focus for consistency with mise.tsx
  useFocusEffect(
    useCallback(() => {
      console.error('[CookScreen] 🔍 useFocusEffect: Screen focused.');
      const timestamp = new Date().toISOString();
      console.log(`[CookScreen] 🎯 useFocusEffect triggered at ${timestamp}`);
      
      // Always fetch fresh data when screen comes into focus
      console.log('[CookScreen] 🔄 Navigation check - fetching fresh data');
      
      const refreshMiseRecipes = async () => {
        try {
          console.log('[CookScreen] 🔄 Starting to refresh mise recipes from API');
          
          // Clear any existing cooking session to start fresh
          try {
            await endAllSessions();
          } catch (error) {
            console.warn('[CookScreen] ⚠️ Error clearing sessions, continuing anyway:', error);
          }
          
          // Fetch fresh mise data from API
          if (!session?.user) {
            console.log('[CookScreen] ❌ No user session found');
            setRecipes([]);
            return;
          }
          
          const backendUrl = process.env.EXPO_PUBLIC_API_URL;
          if (!backendUrl) {
            throw new Error('API configuration error');
          }
          
          const headers = {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          };
          
          const response = await fetch(`${backendUrl}/api/mise/recipes?userId=${session.user.id}`, { headers });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch mise recipes: ${response.statusText}`);
          }
          
          const recipesData = await response.json();
          const miseRecipes = recipesData?.recipes || [];
          
          console.log('[CookScreen] 📊 Refreshed mise recipes from API:', miseRecipes.length, 'recipes');
          
          if (miseRecipes.length === 0) {
            console.log('[CookScreen] ❌ No mise recipes found after refresh');
            setRecipes([]);
            return;
          }
          
          // Extract recipe data from mise recipes
          const recipeList = miseRecipes.map((miseRecipe: any) => {
            const recipeData = miseRecipe.prepared_recipe_data || miseRecipe.original_recipe_data;
            
            if (!recipeData) {
              console.error('[CookScreen] ❌ No recipe data found for mise recipe:', miseRecipe.id);
              return null;
            }
            
            const cookingSessionId = String(miseRecipe.id);
            
            return {
              ...recipeData,
              id: cookingSessionId,
              originalRecipeId: recipeData.id,
              miseRecipeId: miseRecipe.id,
              title: miseRecipe.title_override || recipeData.title,
            };
          }).filter(Boolean);
          
          setRecipes(recipeList);
          
          // Initialize all sessions with fresh data
          if (miseRecipes.length > 0) {
            console.log('[CookScreen] 🚀 Re-initializing cooking sessions with fresh data');
            
                      // 💥 LOGGING POINT 5: Log right before calling initializeSessions in useFocusEffect
          if (process.env.NODE_ENV === 'production') {
            console.error('[CookScreen] 🔍 Before calling initializeSessions (useFocusEffect). typeof initializeSessions:', typeof initializeSessions);
            console.error('[CookScreen] 🔍 initializeSessions is function?', typeof initializeSessions === 'function');
            console.error('[CookScreen] 🔍 initializeSessions.toString():', initializeSessions?.toString?.()?.substring(0, 100) + '...');
          }
            
            try {
              initializeSessions(miseRecipes);
              console.error('[CookScreen] ✅ Re-initialized cooking sessions successfully');
            } catch (error) {
              console.error('[CookScreen] 💥 TypeError caught in initializeSessions call (useFocusEffect):', error);
              console.error('[CookScreen] 💥 Error type:', typeof error);
              console.error('[CookScreen] 💥 Error message:', error instanceof Error ? error.message : String(error));
              console.error('[CookScreen] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
              console.error('[CookScreen] 💥 Error constructor:', error?.constructor?.name);
              console.error('[CookScreen] 💥 Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
              
              // Continue without sessions rather than crashing the app
              console.error('[CookScreen] ⚠️ Continuing without cooking sessions due to initialization error in useFocusEffect');
            }
          }
        } catch (error) {
          console.error('[CookScreen] 💥 Error refreshing mise recipes:', error);
        }
      };
      
              refreshMiseRecipes();
        
        return () => {
          console.error('[CookScreen] 🔍 useFocusEffect: Screen blurred/unfocused (cleanup function).');
          // Look here for any complex cleanup operations that might involve external libraries
          // or specific objects that could be undefined if uninitialized.
        };
      }, [session?.user?.id, session?.access_token]) // Removed function dependencies that change on every render
    );

  // Handle app state changes for timer management
  useEffect(() => {
    console.error('[CookScreen] 🔍 Setting up AppState listener');
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.error(`[CookScreen] 🔍 AppState changed from ${appState.current} to ${nextAppState}`);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - sync timers
        console.log('App came to foreground, syncing timers');
        // Timer sync logic will be handled by individual timer components
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      console.error('[CookScreen] 🔍 Cleaning up AppState listener');
      console.error('[CookScreen] 🔍 AppState subscription type:', typeof subscription);
      console.error('[CookScreen] 🔍 AppState subscription remove type:', typeof subscription?.remove);
      
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else {
        console.error('[CookScreen] ⚠️ AppState subscription remove is not a function!');
      }
    };
  }, []);



  const handleRecipeSwitch = useCallback((recipeId: string) => {
    try {
      console.time(`[CookScreen] ⏱️ handleRecipeSwitch-${recipeId}`);
      console.log('[CookScreen] 🔄 Starting recipe switch to:', recipeId);

      // --- TOP DEBUG: Check function types at the very beginning ---
      console.error('[CookScreen] TOP DEBUG: typeof setScrollPosition:', typeof setScrollPosition);
      console.error('[CookScreen] TOP DEBUG: typeof switchRecipe:', typeof switchRecipe);
      console.error('[CookScreen] TOP DEBUG: typeof getCurrentScrollPosition:', typeof getCurrentScrollPosition);

      // --- GENERAL ENTRY POINT CHECKS ---
      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): handleRecipeSwitch entry point.');
      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): typeof state:', typeof state);
      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): state value (partial):', state ? { activeRecipeId: state.activeRecipeId, activeRecipesCount: state.activeRecipes?.length } : 'null/undefined');
      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): typeof scrollViewRef.current:', typeof scrollViewRef.current);
      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): scrollViewRef.current value (presence check):', !!scrollViewRef.current);
      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): typeof state.activeRecipeId:', typeof state?.activeRecipeId);

      // --- GRANULAR IF CONDITION EVALUATION ---
      let hasValidActiveRecipeId = false;
      try {
        hasValidActiveRecipeId = !!(state?.activeRecipeId && typeof state.activeRecipeId === 'string');
        console.error('[CookScreen] 💥💥 CRASH DEBUG: Result of state.activeRecipeId check:', hasValidActiveRecipeId);
        if (!hasValidActiveRecipeId) {
          console.error('[CookScreen] 💥💥 CRASH DEBUG: state.activeRecipeId is missing or not a string.');
        }
      } catch (e: any) {
        console.error('[CookScreen] 🛑🛑🛑 CRASH DEBUG ERROR: Exception during state.activeRecipeId check:', e.message, e.stack);
        throw e; // Re-throw to catch with outer catch
      }

      let hasValidScrollViewRef = false;
      try {
        hasValidScrollViewRef = !!scrollViewRef.current;
        console.error('[CookScreen] 💥💥 CRASH DEBUG: Result of scrollViewRef.current check:', hasValidScrollViewRef);
        if (!hasValidScrollViewRef) {
          console.error('[CookScreen] 💥💥 CRASH DEBUG: scrollViewRef.current is null/undefined.');
        } else {
          // Additional validation: check if the ref is still connected to a valid component
          console.error('[CookScreen] 💥💥 CRASH DEBUG: scrollViewRef.current type:', typeof scrollViewRef.current);
          console.error('[CookScreen] 💥💥 CRASH DEBUG: scrollViewRef.current constructor:', scrollViewRef.current?.constructor?.name);
          
          // Check if the component is still mounted and valid
          try {
            const nativeTag = (scrollViewRef.current as any)?._nativeTag;
            console.error('[CookScreen] 💥💥 CRASH DEBUG: scrollViewRef.current._nativeTag:', nativeTag);
            if (!nativeTag) {
              console.error('[CookScreen] 💥💥 CRASH DEBUG: WARNING - scrollViewRef.current has no _nativeTag, may be stale!');
              hasValidScrollViewRef = false;
            }
          } catch (nativeTagError: any) {
            console.error('[CookScreen] 💥💥 CRASH DEBUG: Error checking _nativeTag:', nativeTagError.message);
            hasValidScrollViewRef = false;
          }
        }
      } catch (e: any) {
        console.error('[CookScreen] 🛑🛑🛑 CRASH DEBUG ERROR: Exception during scrollViewRef.current check:', e.message, e.stack);
        throw e; // Re-throw to catch with outer catch
      }

      // Proceed only if both are truly valid
      if (hasValidActiveRecipeId && hasValidScrollViewRef) {
        console.error('[CookScreen] ✅ Both state.activeRecipeId AND scrollViewRef.current are confirmed valid. Proceeding to scroll position logic.');
        
        // Additional check: ensure currentRecipe exists and is valid
        const currentRecipe = state.activeRecipes.find(
          recipe => recipe.recipeId === state.activeRecipeId
        );
        console.error('[CookScreen] 💥💥 CRASH DEBUG: currentRecipe exists:', !!currentRecipe);
        console.error('[CookScreen] 💥💥 CRASH DEBUG: currentRecipe loading state:', currentRecipe?.isLoading);
        console.error('[CookScreen] 💥💥 CRASH DEBUG: currentRecipe has recipe data:', !!currentRecipe?.recipe);
        
        if (!currentRecipe) {
          console.error('[CookScreen] 💥💥 CRASH DEBUG: WARNING - currentRecipe is null, ScrollView may be in invalid state!');
        }

        // --- NEW: Even more granular checks for scrollViewRef.current properties ---
        // Wrap each property access in its own try-catch
        try {
          console.error('[CookScreen] CRASH DEBUG: Checking scrollViewRef.current properties - START');
          // Log scrollViewRef.current itself if it's safe to stringify
          try {
            console.error('[CookScreen] CRASH DEBUG: scrollViewRef.current object (JSON.stringify safe portion):', JSON.stringify(Object.keys(scrollViewRef.current || {})));
          } catch (e: any) {
            console.error('[CookScreen] CRASH DEBUG: Error stringifying scrollViewRef.current keys:', e.message);
          }

          // Check if it's a valid React Native ScrollView instance (or at least has ._nativeTag)
          try {
            console.error('[CookScreen] CRASH DEBUG: scrollViewRef.current._nativeTag presence:', !!(scrollViewRef.current as any)._nativeTag);
          } catch (e: any) {
            console.error('[CookScreen] CRASH DEBUG: Error accessing _nativeTag:', e.message);
          }

          try {
            console.error('[CookScreen] CRASH DEBUG: scrollViewRef.current.scrollTo typeof:', typeof (scrollViewRef.current as any).scrollTo);
          } catch (e: any) {
            console.error('[CookScreen] CRASH DEBUG: Error accessing scrollTo typeof:', e.message);
          }

          try {
            console.error('[CookScreen] CRASH DEBUG: scrollViewRef.current.getScrollResponder typeof:', typeof (scrollViewRef.current as any).getScrollResponder);
          } catch (e: any) {
            console.error('[CookScreen] CRASH DEBUG: Error accessing getScrollResponder typeof:', e.message);
          }
          console.error('[CookScreen] CRASH DEBUG: Checking scrollViewRef.current properties - END');

        } catch (e: any) {
          console.error('[CookScreen] CRASH DEBUG: Caught general error during scrollViewRef.current property checks:', e.message, e.stack);
          // Re-throw this to ensure outer catch gets it with the exact location
          throw e;
        }

        // --- Granular checks for contentOffset and y ---
        let currentScrollY: number = 0; // Initialize to ensure it's a number

        try {
          console.error('[CookScreen] CRASH DEBUG: Attempting to access scrollViewRef.current.contentOffset...');
          // Note: contentOffset is not a direct property on ScrollView ref in React Native
          // This is a test to see if this access causes the crash
          console.error('[CookScreen] CRASH DEBUG: scrollViewRef.current exists:', !!scrollViewRef.current);
          
          // Use getCurrentScrollPosition as the safe alternative
          if (typeof getCurrentScrollPosition === 'function' && state.activeRecipeId) {
            currentScrollY = getCurrentScrollPosition(state.activeRecipeId);
            console.error('[CookScreen] CRASH DEBUG: getCurrentScrollPosition result:', currentScrollY);
          } else {
            console.error('[CookScreen] CRASH DEBUG: getCurrentScrollPosition is not a function or activeRecipeId is null, using 0');
            currentScrollY = 0;
          }

        } catch (errDuringScrollYCalculation: any) {
          console.error('[CookScreen] CRASH DEBUG: Caught error during scrollY calculation TRY BLOCK:', errDuringScrollYCalculation.message);
          console.error('[CookScreen] CRASH DEBUG: Error Stack from scrollY calculation TRY BLOCK:', errDuringScrollYCalculation.stack);
          throw errDuringScrollYCalculation; // Re-throw to be caught by the outer handleRecipeSwitch try/catch
        }

        console.error('[CookScreen] CRASH DEBUG: currentScrollY AFTER CALCULATION (type):', typeof currentScrollY);
        console.error('[CookScreen] CRASH DEBUG: currentScrollY AFTER CALCULATION (value):', currentScrollY);
        
        // --- Checks immediately before calling setScrollPosition ---
        console.error('[CookScreen] CRASH DEBUG: Before setScrollPosition call - state.activeRecipeId type:', typeof state.activeRecipeId);
        console.error('[CookScreen] CRASH DEBUG: Before setScrollPosition call - state.activeRecipeId value:', state.activeRecipeId);
        console.error('[CookScreen] CRASH DEBUG: Before setScrollPosition call - currentScrollY type:', typeof currentScrollY);
        console.error('[CookScreen] CRASH DEBUG: Before setScrollPosition call - currentScrollY value:', currentScrollY);
        console.error('[CookScreen] CRASH DEBUG: Before setScrollPosition call - typeof setScrollPosition:', typeof setScrollPosition);
        console.error('[CookScreen] CRASH DEBUG: Before setScrollPosition call - setScrollPosition is function?', typeof setScrollPosition === 'function');

        try {
          if (typeof setScrollPosition === 'function' && state.activeRecipeId) {
            setScrollPosition(state.activeRecipeId, currentScrollY); // Use currentScrollY
            console.error('[CookScreen] CRASH DEBUG: setScrollPosition called successfully.');
          } else {
            console.error('[CookScreen] 💥 setScrollPosition is NOT a function or activeRecipeId is null!');
          }
        } catch (errSetScrollPosition: any) {
          console.error('[CookScreen] CRASH DEBUG: Caught error calling setScrollPosition TRY BLOCK:', errSetScrollPosition.message);
          console.error('[CookScreen] CRASH DEBUG: Error Stack from setScrollPosition TRY BLOCK:', errSetScrollPosition.stack);
          throw errSetScrollPosition; // Re-throw for the outer catch to handle
        }
      } else {
        console.error('[CookScreen] ⚠️ Skipping scroll position logic because one or both conditions failed: hasValidActiveRecipeId:', hasValidActiveRecipeId, 'hasValidScrollViewRef:', hasValidScrollViewRef);
      }

      // --- Checks immediately before calling switchRecipe ---
      console.error('[CookScreen] CRASH DEBUG: Before switchRecipe call - recipeId type:', typeof recipeId);
      console.error('[CookScreen] CRASH DEBUG: Before switchRecipe call - recipeId value:', recipeId);
      console.error('[CookScreen] CRASH DEBUG: Before switchRecipe call - typeof switchRecipe:', typeof switchRecipe);
      console.error('[CookScreen] CRASH DEBUG: Before switchRecipe call - switchRecipe is function?', typeof switchRecipe === 'function');

      try {
        if (typeof switchRecipe === 'function') {
          switchRecipe(recipeId);
          console.error('[CookScreen] CRASH DEBUG: switchRecipe called successfully.');
        } else {
          console.error('[CookScreen] 💥 switchRecipe is NOT a function!');
        }
      } catch (errSwitchRecipe: any) {
        console.error('[CookScreen] CRASH DEBUG: Caught error calling switchRecipe TRY BLOCK:', errSwitchRecipe.message);
        console.error('[CookScreen] CRASH DEBUG: Error Stack from switchRecipe TRY BLOCK:', errSwitchRecipe.stack);
        throw errSwitchRecipe; // Re-throw for the outer catch to handle
      }
      
      console.log('[CookScreen] ✅ Recipe switch completed for:', recipeId);
      console.timeEnd(`[CookScreen] ⏱️ handleRecipeSwitch-${recipeId}`);

      // Restore scroll position for new recipe
      let savedScrollY = 0;
      try {
        console.error('[CookScreen] 💥💥 CRASH DEBUG: About to call getCurrentScrollPosition');
        if (typeof getCurrentScrollPosition === 'function') {
          savedScrollY = getCurrentScrollPosition(recipeId);
          console.error('[CookScreen] ✅ getCurrentScrollPosition called successfully. Value:', savedScrollY);
        } else {
          console.error('[CookScreen] 💥 getCurrentScrollPosition is NOT a function!');
        }
      } catch (error: any) {
        console.error('[CookScreen] 💥 Error calling getCurrentScrollPosition:', error);
        console.error('[CookScreen] 💥 getCurrentScrollPosition error stack:', error.stack);
        throw error; // Re-throw to ensure outer catch gets it
      }

      if (savedScrollY > 0 && scrollViewRef.current) {
        InteractionManager.runAfterInteractions(() => {
          try {
            console.error('[CookScreen] 💥💥 CRASH DEBUG: About to call scrollViewRef.current.scrollTo');
            scrollViewRef.current?.scrollTo({ y: savedScrollY, animated: true });
            console.error('[CookScreen] ✅ scrollViewRef.current.scrollTo called successfully.');
          } catch (error: any) {
            console.error('[CookScreen] 💥 Error calling scrollViewRef.current.scrollTo:', error);
            console.error('[CookScreen] 💥 scrollViewRef.current.scrollTo error stack:', error.stack);
            // Don't rethrow here, scroll isn't critical app path
          }
        });
      }
    } catch (outerError: any) {
      console.error('[CookScreen] 🛑 FATAL CRASH CAUGHT IN handleRecipeSwitch OUTER TRY-CATCH!');
      console.error('[CookScreen] 🛑 Error Name:', outerError.name);
      console.error('[CookScreen] 🛑 Error Message:', outerError.message);
      console.error('[CookScreen] 🛑 Error Stack:', outerError.stack);
      console.error('[CookScreen] 🛑 State at crash time: typeof state:', typeof state);
      console.error('[CookScreen] 🛑 State at crash time: state value (partial):', state ? { activeRecipeId: state.activeRecipeId, activeRecipesCount: state.activeRecipes?.length } : 'null/undefined');
      console.error('[CookScreen] 🛑 State at crash time: typeof scrollViewRef.current:', typeof scrollViewRef.current);
      console.error('[CookScreen] 🛑 State at crash time: scrollViewRef.current value (presence check):', !!scrollViewRef.current);
      console.error('[CookScreen] 🛑 State at crash time: typeof state.activeRecipeId:', typeof state?.activeRecipeId);
      showError('Application Error', 'A critical error occurred while switching recipes. Please restart the app.');
    }
  }, [state, scrollViewRef, setScrollPosition, switchRecipe, getCurrentScrollPosition, showError]);


  const handleSwipeGesture = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      const currentIndex = state.activeRecipes.findIndex(r => r.recipeId === state.activeRecipeId);
      
      // Swipe left (next recipe) - need sufficient distance and velocity
      if (translationX < -100 && velocityX < -300 && currentIndex < state.activeRecipes.length - 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleRecipeSwitch(state.activeRecipes[currentIndex + 1].recipeId);
      }
      // Swipe right (previous recipe)
      else if (translationX > 100 && velocityX > 300 && currentIndex > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleRecipeSwitch(state.activeRecipes[currentIndex - 1].recipeId);
      }
      // Swipe from left edge to go back - similar to summary.tsx
      else if (translationX > 100 && velocityX > 300 && currentIndex === 0) {
        console.error('[CookScreen] 🔍 Attempting to navigate back via swipe');
        console.error('[CookScreen] 🔍 router.canGoBack type:', typeof router.canGoBack);
        console.error('[CookScreen] 🔍 router.back type:', typeof router.back);
        console.error('[CookScreen] 🔍 router.navigate type:', typeof router.navigate);
        
        try {
          // Check if we can go back properly, otherwise navigate to mise as fallback
          if (router.canGoBack && typeof router.canGoBack === 'function' && router.canGoBack()) {
            console.error('[CookScreen] 🔍 Calling router.back()');
            router.back();
          } else {
            console.error('[CookScreen] 🔍 Calling router.navigate to /tabs/mise');
            // Navigate back to mise tab
            router.navigate('/tabs/mise' as any);
          }
          console.error('[CookScreen] ✅ Navigation call completed');
        } catch (navError: any) {
          console.error('[CookScreen] 💥 Error during swipe navigation:', navError);
          console.error('[CookScreen] 💥 Navigation error stack:', navError.stack);
        }
      }
    }
  };

  const toggleStepCompleted = (recipeId: string, stepIndex: number) => {
    // Find the current recipe and toggle the step
    const currentRecipe = state.activeRecipes.find(r => r.recipeId === recipeId);
    if (!currentRecipe) return;

    const stepId = stepIndex.toString();
    const isCompleted = currentRecipe.completedSteps.includes(stepId);
    
    // Convert completedSteps array to StepCompletionState object for utilities
    const completedStepsState: StepCompletionState = {};
    currentRecipe.completedSteps.forEach(stepId => {
      completedStepsState[parseInt(stepId)] = true;
    });
    
    if (isCompleted) {
      // Remove from completed steps
      console.log('[CookScreen] Step uncompleted:', { recipeId, stepIndex });
      uncompleteStep(recipeId, stepId);
    } else {
      // Add to completed steps
      console.log('[CookScreen] Step completed:', { recipeId, stepIndex });
      completeStep(recipeId, stepId);
      
      // Auto-scroll to next step if recipe has instructions
      if (currentRecipe.recipe?.instructions) {
        autoScrollToNextStep(
          stepIndex,
          currentRecipe.recipe.instructions,
          completedStepsState,
          scrollViewRef
        );
      }
    }
  };

  // --- Ingredient Tooltip Logic ---
  const handleIngredientPress = (ingredient: StructuredIngredient) => {
    console.log('[CookScreen] Ingredient pressed:', ingredient.name);
    setSelectedIngredient(ingredient);
    setIsTooltipVisible(true);
  };
  // --- End Ingredient Tooltip Logic ---

  // --- Timer Functions ---
  const formatTime = (timeInSeconds: number): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimerAddSeconds = (seconds: number) => {
    setTimerTimeRemaining(prev => prev + seconds);
  };

  const handleTimerStartPause = () => {
    console.error('[CookScreen] 🔍 handleTimerStartPause called, isTimerActive:', isTimerActive);
    console.error('[CookScreen] 🔍 showError function type:', typeof showError);
    
    if (isTimerActive) {
      // Pause timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsTimerActive(false);
    } else {
      // Start timer
      if (timerTimeRemaining > 0) {
        setIsTimerActive(true);
        timerIntervalRef.current = setInterval(() => {
          setTimerTimeRemaining(prev => {
            if (prev <= 1) {
              // Timer finished
              setIsTimerActive(false);
              if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
              }
              // Show notification when timer finishes
              console.error('[CookScreen] 🔍 About to call showError for timer completion');
              try {
                if (typeof showError === 'function') {
                  showError('Timer', "Time's up!");
                } else {
                  console.error('[CookScreen] ⚠️ showError is not a function!');
                }
              } catch (showErrorError: any) {
                console.error('[CookScreen] 💥 Error calling showError:', showErrorError);
                console.error('[CookScreen] 💥 showError error stack:', showErrorError.stack);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
  };

  const handleTimerReset = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsTimerActive(false);
    setTimerTimeRemaining(0);
  };
  // --- End Timer Functions ---

  // --- Tools Modal Functions ---
  const openToolsModal = (tool: ActiveTool) => {
    setInitialToolToShow(tool);
    setIsToolsPanelVisible(true);
  };

  const closeToolsModal = () => {
    setIsToolsPanelVisible(false);
    setInitialToolToShow(null);
  };

  const handleTimersPress = () => {
    openToolsModal('timer');
  };



  const handleMiniTimerPress = () => {
    openToolsModal('timer');
  };
  // --- End Tools Modal Functions ---

  // --- Recipe Tips Functions ---
  const handleRecipeTipsPress = () => {
    const currentRecipe = state.activeRecipes.find(
      recipe => recipe.recipeId === state.activeRecipeId
    );
    if (currentRecipe?.recipe?.tips) {
      setIsRecipeTipsModalVisible(true);
    }
  };
  // --- End Recipe Tips Functions ---

  const currentRecipe = state.activeRecipes.find(
    recipe => recipe.recipeId === state.activeRecipeId
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cooking session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.activeRecipes.length === 0) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chef-hat" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Recipes to Cook</Text>
          <Text style={styles.emptyText}>
            Add recipes to your mise to start cooking.
          </Text>
        </View>
      </SafeAreaView>
    );
  }



  return (
    <PanGestureHandler onHandlerStateChange={handleSwipeGesture}>
      <SafeAreaView style={styles.container}>
        {/* Recipe Switcher */}
        <View style={styles.recipeSwitcherContainer}>
          <RecipeSwitcher
            recipes={state.activeRecipes}
            activeRecipeId={state.activeRecipeId || ''}
            onRecipeSwitch={handleRecipeSwitch} // This remains the same
          />
        </View>

        {/* Current Recipe Content */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
        {currentRecipe ? (
          <View style={styles.recipeContainer}>
            {currentRecipe.isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading recipe...</Text>
              </View>
            ) : currentRecipe.recipe ? (
              <>
                {/* Recipe Steps with steps.tsx styling */}
                {currentRecipe.recipe.instructions && currentRecipe.recipe.instructions.length > 0 ? (
                  currentRecipe.recipe.instructions.map((step, index) => {
                    // Convert completedSteps array to StepCompletionState object
                    const completedStepsState: StepCompletionState = {};
                    currentRecipe.completedSteps.forEach(stepId => {
                      completedStepsState[parseInt(stepId)] = true;
                    });
                    
                    const stepIsCompleted = isStepCompleted(index, completedStepsState);
                    const stepIsActive = isStepActive(index, currentRecipe.recipe?.instructions || [], completedStepsState);
                    
                    // Flatten ingredients from ingredient groups for highlighting
                    const flatIngredients: StructuredIngredient[] = [];
                    if (currentRecipe.recipe?.ingredientGroups) {
                      currentRecipe.recipe.ingredientGroups.forEach(group => {
                        if (group.ingredients && Array.isArray(group.ingredients)) {
                          flatIngredients.push(...group.ingredients);
                        }
                      });
                    }

                    return (
                      <StepItem
                        key={`step-${index}`}
                        step={step}
                        stepIndex={index}
                        isCompleted={stepIsCompleted}
                        isActive={stepIsActive}
                        onStepPress={(stepIndex) => toggleStepCompleted(currentRecipe.recipeId, stepIndex)}
                        ingredients={flatIngredients}
                        onIngredientPress={handleIngredientPress}
                      />
                    );
                  })
                ) : (
                  <View style={styles.noRecipeContainer}>
                    <Text style={styles.noRecipeText}>No recipe steps available</Text>
                  </View>
                )}

                {/* Add some bottom padding */}
                <View style={{ height: 100 }} />
              </>
            ) : (
              <View style={styles.noRecipeContainer}>
                <Text style={styles.noRecipeText}>Recipe data not available</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noRecipeContainer}>
            <Text style={styles.noRecipeText}>Select a recipe to start cooking</Text>
          </View>
        )}
        </ScrollView>

        {/* Ingredient Tooltip Modal */}
        <Modal
          transparent
          visible={isTooltipVisible}
          animationType="fade"
          onRequestClose={() => setIsTooltipVisible(false)}
        >
          <Pressable
            style={styles.tooltipBackdrop}
            onPress={() => setIsTooltipVisible(false)}
          >
            <Pressable style={styles.tooltipContainer}>
              {selectedIngredient && (
                <>
                  <Text style={styles.tooltipTitle}>
                    {selectedIngredient.name}
                  </Text>
                  {(selectedIngredient.amount || selectedIngredient.unit) && (
                    <Text style={styles.tooltipText}>
                      {selectedIngredient.amount || ''}{' '}
                      {abbreviateUnit(selectedIngredient.unit || '')}
                    </Text>
                  )}
                  {selectedIngredient.preparation && (
                    <Text style={styles.tooltipPreparationText}>
                      {selectedIngredient.preparation}
                    </Text>
                  )}
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Footer Buttons */}
        <StepsFooterButtons
          onTimersPress={handleTimersPress}
          onRecipeTipsPress={handleRecipeTipsPress}
          hasRecipeTips={!!currentRecipe?.recipe?.tips}
        />

        {/* Tools Modal */}
        <ToolsModal
          isVisible={isToolsPanelVisible}
          onClose={closeToolsModal}
          initialTool={initialToolToShow}
          timerTimeRemaining={timerTimeRemaining}
          isTimerActive={isTimerActive}
          formatTime={formatTime}
          handleTimerAddSeconds={handleTimerAddSeconds}
          handleTimerStartPause={handleTimerStartPause}
          handleTimerReset={handleTimerReset}
        />

        {/* Mini Timer Display */}
        {!isToolsPanelVisible && isTimerActive && timerTimeRemaining > 0 && (
          <MiniTimerDisplay
            timeRemaining={timerTimeRemaining}
            formatTime={formatTime}
            onPress={handleMiniTimerPress}
          />
        )}

        {/* Recipe Tips Modal */}
        <Modal
          visible={isRecipeTipsModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsRecipeTipsModalVisible(false)}
        >
          <Pressable
            style={styles.recipeTipsModalOverlay}
            onPress={() => setIsRecipeTipsModalVisible(false)}
          >
            <Pressable style={styles.recipeTipsModalContent}>
              <View style={styles.recipeTipsHeader}>
                <View style={styles.recipeTipsHeaderContent}>
                  <MaterialCommunityIcons
                    name="lightbulb-outline"
                    size={24}
                    color={COLORS.primary}
                  />
                  <Text style={styles.recipeTipsTitle}>Recipe Tips</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsRecipeTipsModalVisible(false)}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
              
              <FlatList
                style={styles.recipeTipsList}
                data={currentRecipe?.recipe?.tips?.split(/\.\s+|\n+/).filter(tip => tip.trim()) || []}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.tipItem}>
                    <View style={styles.tipNumberContainer}>
                      <Text style={styles.tipNumber}>{index + 1}</Text>
                    </View>
                    <View style={styles.tipContent}>
                      <Text style={styles.recipeTipsText}>
                        {item.trim()}
                      </Text>
                    </View>
                  </View>
                )}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.recipeTipsListContent}
              />
            </Pressable>
          </Pressable>
        </Modal>

      </SafeAreaView>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },

  recipeSwitcherContainer: {
    // Padding now handled within RecipeSwitcher component
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...bodyText,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
  },
  emptyTitle: {
    ...sectionHeaderText,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    ...sectionHeaderText,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  recipeContainer: {
    flex: 1,
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
  },
  noRecipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  },
  noRecipeText: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  tooltipBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    maxWidth: '80%',
    width: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipTitle: {
    ...bodyStrongText,
    marginBottom: SPACING.xs,
  },
  tooltipText: {
    ...bodyText,
    marginBottom: SPACING.xs,
  },
  tooltipPreparationText: {
    ...bodyTextLoose,
    color: COLORS.textMuted,
  },

  // --- Recipe Tips Modal Styles ---
  recipeTipsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
  },
  recipeTipsModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    height: '70%',
    ...SHADOWS.large,
  },
  recipeTipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
  },
  recipeTipsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recipeTipsTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 18,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  recipeTipsList: {
    flex: 1,
    minHeight: 0,
  },
  recipeTipsListContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  tipNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  tipNumber: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  },
  tipContent: {
    flex: 1,
  },
  recipeTipsText: {
    ...bodyTextLoose,
    color: COLORS.textDark,
    lineHeight: 24,
    fontSize: 16,
  },
}); 