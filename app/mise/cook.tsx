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
  NativeSyntheticEvent, // Import this for type safety for onScroll event
  NativeScrollEvent, // Import this for type safety for onScroll event
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

  // NEW: State to store the current scroll Y position
  const [currentScrollY, setCurrentScrollY] = useState(0);

  // Add scroll position throttling
  const scrollPositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // NEW: handleScroll function for onScroll prop - tracks current scroll position in state
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setCurrentScrollY(scrollY); // Update the state with current scroll position
    
    if (state.activeRecipeId) {
      // Clear existing timeout
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
      
      // Throttle scroll position updates to reduce excessive logging and improve performance
      scrollPositionTimeoutRef.current = setTimeout(() => {
        setScrollPosition(state.activeRecipeId!, scrollY);
      }, 100); // Update every 100ms instead of every 16ms
    }
  }, [state.activeRecipeId, setScrollPosition]);

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

  // REMOVED: Separate useEffect for loadMiseRecipes - consolidated into useFocusEffect below

  // Simple, reliable approach: Always fetch fresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.error('[CookScreen] 🔍 useFocusEffect: Screen focused.');
      const timestamp = new Date().toISOString();
      console.log(`[CookScreen] 🎯 useFocusEffect triggered at ${timestamp}`);
      
      const refreshMiseRecipes = async () => {
        try {
          setIsLoading(true);
          console.log('[CookScreen] 🔄 Starting to refresh mise recipes from API');
          
          // Clear existing sessions to start fresh
          console.log('[CookScreen] 🧹 Clearing existing cooking sessions');
          try {
            await endAllSessions();
          } catch (error) {
            console.warn('[CookScreen] ⚠️ Error clearing sessions, continuing anyway:', error);
          }
          
          // Fetch fresh mise data from API
          if (!session?.user) {
            console.log('[CookScreen] ❌ No user session found');
            setRecipes([]);
            setIsLoading(false);
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
            setIsLoading(false);
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
          
          // Initialize sessions with fresh data
          if (miseRecipes.length > 0) {
            console.log('[CookScreen] 🚀 Initializing cooking sessions with fresh data');
            
            try {
              initializeSessions(miseRecipes);
              console.error('[CookScreen] ✅ Initialized cooking sessions successfully');
            } catch (error) {
              console.error('[CookScreen] 💥 TypeError caught in initializeSessions call:', error);
              console.error('[CookScreen] 💥 Error type:', typeof error);
              console.error('[CookScreen] 💥 Error message:', error instanceof Error ? error.message : String(error));
              console.error('[CookScreen] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
              
              // Continue without sessions rather than crashing the app
              console.error('[CookScreen] ⚠️ Continuing without cooking sessions due to initialization error');
            }
          }
        } catch (error) {
          console.error('[CookScreen] 💥 Error refreshing mise recipes:', error);
        } finally {
          setIsLoading(false);
          console.log('[CookScreen] 🏁 Finished refreshing mise recipes, isLoading set to false');
        }
      };
      
      refreshMiseRecipes();
        
      return () => {
        console.error('[CookScreen] 🔍 useFocusEffect: Screen blurred/unfocused (cleanup function).');
      };
    }, [session?.user?.id, session?.access_token]) // Simple dependency array - only re-run when session changes
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



  // NEW: Defensive handleRecipeSwitch that doesn't rely on potentially stale context functions
  const handleRecipeSwitch = useCallback((recipeId: string) => {
    try {
      console.time(`[CookScreen] ⏱️ handleRecipeSwitch-${recipeId}`);
      console.log('[CookScreen] 🔄 Starting recipe switch to:', recipeId);

      console.error('[CookScreen] 💥💥 CRASH DEBUG (outer try): handleRecipeSwitch entry point.');

      // DEFENSIVE: Check if context functions are still valid before using them
      console.error('[CookScreen] DEBUG: Checking context function validity...');
      console.error('[CookScreen] DEBUG: typeof setScrollPosition:', typeof setScrollPosition);
      console.error('[CookScreen] DEBUG: typeof switchRecipe:', typeof switchRecipe);
      console.error('[CookScreen] DEBUG: typeof getCurrentScrollPosition:', typeof getCurrentScrollPosition);
      console.error('[CookScreen] DEBUG: typeof showError:', typeof showError);

      // If any context function is undefined, bail out early
      if (typeof setScrollPosition !== 'function' || 
          typeof switchRecipe !== 'function' || 
          typeof getCurrentScrollPosition !== 'function' || 
          typeof showError !== 'function') {
        console.error('[CookScreen] 🛑 CRITICAL: Context functions are undefined! Bailing out.');
        showError('Context Error', 'Recipe switching context is invalid. Please restart the app.');
        return;
      }

      // NEW: Use the state variable for the scroll position instead of direct ref access
      const scrollYToSave = currentScrollY; // Use the most recently updated scroll position from state

      console.error('[CookScreen] DEBUG: ScrollY to save:', scrollYToSave);

      if (state.activeRecipeId) {
        const savedScrollPosition = getCurrentScrollPosition(state.activeRecipeId);
        console.error('[CookScreen] DEBUG: Previously saved scroll position for activeRecipe:', savedScrollPosition);
        
        // Save the current scroll position for the *old* active recipe ID
        console.log(`[CookScreen] 💾 Saving scroll position ${scrollYToSave} for recipe ${state.activeRecipeId}`);
        setScrollPosition(state.activeRecipeId, scrollYToSave);
      } else {
        console.log('[CookScreen] ⚠️ No activeRecipeId to save scroll position for.');
      }

      console.log(`[CookScreen] 🚀 Switching to recipe: ${recipeId}`);
      switchRecipe(recipeId);

      // Now, try to scroll to the new recipe's saved position after the switch
      const newRecipeSavedScrollY = getCurrentScrollPosition(recipeId);
      console.log(`[CookScreen] ➡️ Attempting to scroll new recipe ${recipeId} to: ${newRecipeSavedScrollY}`);

      if (scrollViewRef.current) {
        // Wrap this in a safe block as well
        try {
          // Delaying the scroll slightly often helps with rendering race conditions
          setTimeout(() => {
            if (scrollViewRef.current) {
              scrollViewRef.current.scrollTo({ y: newRecipeSavedScrollY, animated: false });
              console.log(`[CookScreen] ✅ Scrolled to position ${newRecipeSavedScrollY} for new recipe ${recipeId}`);
            } else {
              console.warn('[CookScreen] ⚠️ scrollViewRef.current is null when trying to scroll.');
            }
          }, 50); // Small delay to allow re-render
        } catch (scrollErr: any) {
          console.error('[CookScreen] 🛑 ERROR during scrollTo:', scrollErr.message, scrollErr.stack);
        }
      } else {
        console.warn('[CookScreen] ⚠️ scrollViewRef.current is null when trying to scroll after switch.');
      }

      console.timeEnd(`[CookScreen] ⏱️ handleRecipeSwitch-${recipeId}`);
    } catch (e: any) {
      console.error('[CookScreen] 🛑 FATAL CRASH CAUGHT IN handleRecipeSwitch OUTER TRY-CATCH!');
      console.error('[CookScreen] 🛑 Error Name:', e.name);
      console.error('[CookScreen] 🛑 Error Message:', e.message);
      console.error('[CookScreen] 🛑 Error Stack:', e.stack);
      console.error('[CookScreen] 🛑 State at crash time: typeof state:', typeof state);
      console.error('[CookScreen] 🛑 State at crash time: state value (partial):', state ? { activeRecipeId: state.activeRecipeId, activeRecipesCount: state.activeRecipes?.length } : 'null/undefined');
      console.error('[CookScreen] 🛑 State at crash time: typeof scrollViewRef.current:', typeof scrollViewRef.current);
      console.error('[CookScreen] 🛑 State at crash time: scrollViewRef.current value (presence check):', !!scrollViewRef.current);
      console.error('[CookScreen] 🛑 State at crash time: typeof state.activeRecipeId:', typeof state?.activeRecipeId);
      
      // DEFENSIVE: Check if showError is still valid before using it
      if (typeof showError === 'function') {
        showError('Application Error', 'A critical error occurred while switching recipes. Please restart the app.');
      } else {
        console.error('[CookScreen] 🛑 CRITICAL: showError is also undefined!');
      }
    }
  }, [state.activeRecipeId, currentScrollY, setScrollPosition, switchRecipe, getCurrentScrollPosition, showError]); // Reverted to include context functions


  const handleSwipeGesture = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      const currentIndex = state.activeRecipes.findIndex(r => r.recipeId === state.activeRecipeId);
      
      // Swipe left (next recipe) - need sufficient distance and velocity
      if (translationX < -100 && velocityX < -300 && currentIndex < state.activeRecipes.length - 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // NEW LOGGING AND TRY-CATCH FOR CALL SITE
        console.error('[CookScreen] 💥💥 CALL SITE DEBUG: Attempting to call handleRecipeSwitch (next). typeof handleRecipeSwitch:', typeof handleRecipeSwitch);
        try {
          // This is the call to handleRecipeSwitch that seems to be crashing.
          handleRecipeSwitch(state.activeRecipes[currentIndex + 1].recipeId);
        } catch (callSiteErr: any) {
          console.error('[CookScreen] 🛑 CALL SITE CRASH: Error calling handleRecipeSwitch (next):', callSiteErr.message, callSiteErr.stack);
          showError('Swipe Error', 'Failed to switch recipe during swipe. Please try again.');
        }

      }
      // Swipe right (previous recipe)
      else if (translationX > 100 && velocityX > 300 && currentIndex > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // NEW LOGGING AND TRY-CATCH FOR CALL SITE
        console.error('[CookScreen] 💥💥 CALL SITE DEBUG: Attempting to call handleRecipeSwitch (prev). typeof handleRecipeSwitch:', typeof handleRecipeSwitch);
        try {
          // This is the call to handleRecipeSwitch that seems to be crashing.
          handleRecipeSwitch(state.activeRecipes[currentIndex - 1].recipeId);
        } catch (callSiteErr: any) {
          console.error('[CookScreen] 🛑 CALL SITE CRASH: Error calling handleRecipeSwitch (prev):', callSiteErr.message, callSiteErr.stack);
          showError('Swipe Error', 'Failed to switch recipe during swipe. Please try again.');
        }
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