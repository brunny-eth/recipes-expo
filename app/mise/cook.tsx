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
import { useKeepAwake } from 'expo-keep-awake';

import { useCooking } from '@/context/CookingContext';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useAnalytics } from '@/utils/analytics';
import { createLogger } from '@/utils/logger';
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
  // Access the entire context objects
  const cookingContext = useCooking();
  const errorModalContext = useErrorModal();
  const { track } = useAnalytics();
  const logger = createLogger('CookScreen');

  // Removed temporary AsyncStorage clearing - no longer needed

  // Destructure from the context objects where needed, but use the objects directly in handleRecipeSwitch
  // This is a key change to potentially avoid stale closures in production builds.
  const { state, initializeSessions, endSession, endAllSessions, hasResumableSession, completeStep, uncompleteStep } = cookingContext;
  const { showError } = errorModalContext;


  // Removed debug logging - production ready
  
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
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
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
    
    if (cookingContext.state.activeRecipeId) {
      // Clear existing timeout
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
      
      // Throttle scroll position updates to reduce excessive logging and improve performance
      scrollPositionTimeoutRef.current = setTimeout(() => {
        // DEFENSIVE: Extract context function to local constant to prevent minification issues
        const setScrollPositionFn = cookingContext.setScrollPosition;
        if (typeof setScrollPositionFn === 'function' && cookingContext.state.activeRecipeId) {
          setScrollPositionFn(cookingContext.state.activeRecipeId, scrollY);
        }
      }, 100); // Update every 100ms instead of every 16ms
    }
  }, [cookingContext.state.activeRecipeId, cookingContext]);

  // Keep screen awake while cooking
  useKeepAwake();

  // Timer and scroll cleanup - only on component unmount
  useEffect(() => {
    return () => {
      // Clean up timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setTimerStartTimestamp(null);
      
      // Clean up scroll timeout
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array = only runs on unmount

  // Main data fetching and session initialization logic
  useFocusEffect(
    useCallback(() => {
      const loadAndInitializeRecipes = async () => {
        setIsLoading(true);
        const initialRecipeIdFromParams = params.recipeId ? String(params.recipeId) : undefined;

        try {
          // Check if we already have active sessions - if so, don't clear them
          const hasActiveSessions = cookingContext.state.activeRecipes.length > 0;
          
          if (hasActiveSessions) {
            // Populate local recipes state from existing sessions
            const existingRecipes = cookingContext.state.activeRecipes
              .filter(session => session.recipe)
              .map(session => session.recipe!);
            
            setRecipes(existingRecipes);
            
            // Track steps started event for existing multi-recipe cooking sessions
            const trackExistingStepsStarted = async () => {
              try {
                // For existing sessions, we can't easily determine modifications from the context
                // So we'll track with basic info
                await track('steps_started', { 
                  scaled: false, // Default assumption for existing sessions
                  substitutions: 0, // Default assumption for existing sessions
                  modified: false, // Default assumption for existing sessions
                  sessionType: 'multi_recipe',
                  recipeCount: existingRecipes.length,
                  existingSession: true
                });
              } catch (error) {
                logger.error('Error tracking steps_started for existing sessions', {
                  errorMessage: error instanceof Error ? error.message : String(error),
                  existingRecipesCount: existingRecipes.length
                });
              }
            };
            
            trackExistingStepsStarted();
            setIsLoading(false);
            return;
          }
          
          // Fetch fresh mise data from API
          if (!session?.user) {
            await track('mise_recipes_fetch_failed', { 
              reason: 'no_user_session',
              screen: 'cook'
            });
            setRecipes([]);
            setIsLoading(false);
            return;
          }
          
          const backendUrl = process.env.EXPO_PUBLIC_API_URL;
          if (!backendUrl) {
            throw new Error('API configuration error: EXPO_PUBLIC_API_URL is not defined.');
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
          
          if (miseRecipes.length === 0) {
            setRecipes([]); // Clear local recipes if none fetched
            setIsLoading(false);
            return;
          }
          
          // Extract recipe data from mise recipes for local state
          const recipeList = miseRecipes.map((miseRecipe: any) => {
            const recipeData = miseRecipe.prepared_recipe_data || miseRecipe.original_recipe_data;
            
            if (!recipeData) {
              logger.error('No recipe data found for mise recipe', { 
                miseRecipeId: miseRecipe.id,
                hasPreparedData: !!miseRecipe.prepared_recipe_data,
                hasOriginalData: !!miseRecipe.original_recipe_data
              });
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
          
          setRecipes(recipeList); // Update local recipes state
          
          // Track steps started event for multi-recipe cooking
          const trackStepsStarted = async () => {
            try {
              // Check if any recipes have modifications (scaling or substitutions)
              const hasModifications = recipeList.some((recipe: any) => {
                const miseRecipe = miseRecipes.find((mr: any) => String(mr.id) === String(recipe.miseRecipeId));
                return miseRecipe?.local_modifications?.scaling_factor !== 1 || 
                       miseRecipe?.local_modifications?.ingredient_changes?.length > 0;
              });
              
              const totalSubstitutions = miseRecipes.reduce((total: number, mr: any) => {
                return total + (mr.local_modifications?.ingredient_changes?.length || 0);
              }, 0);
              
              const modified = totalSubstitutions > 0 || hasModifications;
              await track('steps_started', { 
                scaled: hasModifications, 
                substitutions: totalSubstitutions,
                modified,
                sessionType: 'multi_recipe',
                recipeCount: recipeList.length
              });
            } catch (error) {
              logger.error('Error tracking steps_started', {
                errorMessage: error instanceof Error ? error.message : String(error),
                recipeListLength: recipeList.length
              });
            }
          };
          
          // Track if we have recipes loaded
          if (recipeList && recipeList.length > 0) {
            trackStepsStarted();
          }
          
          // Initialize sessions in context with fresh data
          if (miseRecipes.length > 0) {
            try {
              // DEFENSIVE: Extract context function to local constant to prevent minification issues
              const initializeSessionsFn = cookingContext.initializeSessions;
              if (typeof initializeSessionsFn === 'function') {
                initializeSessionsFn(miseRecipes, initialRecipeIdFromParams); // Pass initialActiveRecipeId
              } else {
                logger.error('initializeSessions function is undefined', {
                  contextFunctionType: typeof cookingContext.initializeSessions,
                  hasCookingContext: !!cookingContext
                });
              }
            } catch (error) {
              logger.error('TypeError caught in initializeSessions call', {
                errorType: typeof error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : 'No stack trace',
                miseRecipesCount: miseRecipes.length,
                initialRecipeId: initialRecipeIdFromParams
              });
              
              // Continue without sessions rather than crashing the app
              logger.warn('Continuing without cooking sessions due to initialization error');
            }
          }
        } catch (error) {
          logger.error('Error fetching/initializing mise recipes', {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : 'No stack trace',
            hasSession: !!session?.user,
            hasAccessToken: !!session?.access_token
          });
          // DEFENSIVE: Extract context function to local constant to prevent minification issues
          const showErrorFn = errorModalContext.showError;
          if (typeof showErrorFn === 'function') {
            showErrorFn('Loading Error', 'Failed to load recipes. Please check your connection.');
          }
          setRecipes([]); // Clear local recipes on error
        } finally {
          setIsLoading(false);
        }
      };
      
      loadAndInitializeRecipes();
        
      return () => {
        // Cleanup function
      };
    }, [session?.user?.id, session?.access_token, params.recipeId, errorModalContext])
      ); // Always fetch fresh data - no context dependencies needed

  // Handle app state changes for timer management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - sync timers
        // Timer sync logic will be handled by individual timer components (if applicable)
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else {
        logger.error('AppState subscription remove is not a function', {
          subscriptionType: typeof subscription,
          hasRemove: typeof subscription?.remove
        });
      }
    };
  }, []);

  // REMOVED: Dummy function no longer needed - using real context function with defensive checks

    // Production-ready handleRecipeSwitch with defensive checks
  const handleRecipeSwitch = useCallback((recipeId: string) => {
    try {
      // Extract context functions to local constants to prevent minification issues
      const setScrollPositionFn = cookingContext.setScrollPosition;
      const switchRecipeFn = cookingContext.switchRecipe;
      const getCurrentScrollPositionFn = cookingContext.getCurrentScrollPosition;
      const showErrorFn = errorModalContext.showError;

      // Defensive checks - if any context function is undefined, bail out
      if (typeof setScrollPositionFn !== 'function' || 
          typeof switchRecipeFn !== 'function' || 
          typeof getCurrentScrollPositionFn !== 'function' || 
          typeof showErrorFn !== 'function') {
        logger.error('Context functions are undefined, aborting recipe switch', {
          setScrollPositionType: typeof setScrollPositionFn,
          switchRecipeType: typeof switchRecipeFn,
          getCurrentScrollPositionType: typeof getCurrentScrollPositionFn,
          showErrorType: typeof showErrorFn,
          targetRecipeId: recipeId
        });
        return;
      }

      // Save current scroll position for the old recipe
      const scrollYToSave = currentScrollY;
      const prevId = cookingContext.state.activeRecipeId;
      
      if (prevId) {
        setScrollPositionFn(prevId, scrollYToSave);
      }

      // Switch to the new recipe
      switchRecipeFn(recipeId);

      // Scroll to the new recipe's saved position
      const newScrollY = getCurrentScrollPositionFn(recipeId);
      if (scrollViewRef.current) {
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: newScrollY, animated: false });
          }
        }, 50);
      }

    } catch (e: any) {
      logger.error('Error in handleRecipeSwitch', {
        errorMessage: e.message,
        errorStack: e.stack,
        targetRecipeId: recipeId,
        currentRecipeId: cookingContext.state.activeRecipeId
      });
      const showErrorFn = errorModalContext.showError;
      if (typeof showErrorFn === 'function') {
        showErrorFn('Recipe Switch Error', 'Failed to switch recipe. Please try again.');
      }
    }
  }, [cookingContext, errorModalContext, currentScrollY]);


  const handleSwipeGesture = async (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Ensure state.activeRecipes is an array before accessing its properties
      if (!cookingContext.state.activeRecipes || !Array.isArray(cookingContext.state.activeRecipes) || cookingContext.state.activeRecipes.length === 0) {
        await track('swipe_gesture_ignored', { 
          reason: 'no_active_recipes',
          activeRecipesCount: cookingContext.state.activeRecipes?.length || 0,
          hasActiveRecipes: !!cookingContext.state.activeRecipes,
          isArray: Array.isArray(cookingContext.state.activeRecipes)
        });
        return;
      }

      const currentIndex = cookingContext.state.activeRecipes.findIndex(r => r.recipeId === cookingContext.state.activeRecipeId);
      
      // Swipe left (next recipe) - need sufficient distance and velocity
      if (translationX < -100 && velocityX < -300 && currentIndex !== -1 && currentIndex < cookingContext.state.activeRecipes.length - 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Defensive check before accessing next recipe
        const nextRecipe = cookingContext.state.activeRecipes[currentIndex + 1];
        if (nextRecipe && nextRecipe.recipeId) {
          handleRecipeSwitch(nextRecipe.recipeId);
        }

      }
      // Swipe right (previous recipe)
      else if (translationX > 100 && velocityX > 300 && currentIndex !== -1 && currentIndex > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Defensive check before accessing previous recipe
        const prevRecipe = cookingContext.state.activeRecipes[currentIndex - 1];
        if (prevRecipe && prevRecipe.recipeId) {
          handleRecipeSwitch(prevRecipe.recipeId);
        }
      }
      // Swipe from left edge to go back - similar to summary.tsx
      else if (translationX > 100 && velocityX > 300 && currentIndex === 0) {
        try {
          // Check if we can go back properly, otherwise navigate to mise as fallback
          if (router.canGoBack && typeof router.canGoBack === 'function' && router.canGoBack()) {
            router.back();
          } else {
            // Navigate back to mise tab
            router.navigate('/tabs/mise' as any);
          }
        } catch (navError: any) {
          logger.error('Error during swipe navigation', {
            errorMessage: navError.message,
            errorStack: navError.stack,
            translationX,
            velocityX,
            currentIndex
          });
          if (typeof errorModalContext.showError === 'function') {
            errorModalContext.showError('Navigation Error', 'Failed to navigate back. Please try again.');
          }
        }
      }
    }
  };

  const toggleStepCompleted = async (recipeId: string, stepIndex: number) => {
    // Find the current recipe and toggle the step
    const currentRecipeSession = cookingContext.state.activeRecipes.find(r => r.recipeId === recipeId);
    if (!currentRecipeSession || !currentRecipeSession.recipe) {
      await track('step_toggle_failed', { 
        reason: 'no_recipe_session',
        recipeId,
        stepIndex,
        hasCurrentRecipeSession: !!currentRecipeSession,
        hasRecipeData: !!currentRecipeSession?.recipe
      });
      return;
    }

    // DEFENSIVE: Extract context functions to local constants to prevent minification issues
    const completeStepFn = cookingContext.completeStep;
    const uncompleteStepFn = cookingContext.uncompleteStep;

    if (typeof completeStepFn !== 'function' || typeof uncompleteStepFn !== 'function') {
      logger.error('Context step functions are undefined', {
        completeStepType: typeof completeStepFn,
        uncompleteStepType: typeof uncompleteStepFn,
        recipeId,
        stepIndex
      });
      return;
    }

    const stepId = String(stepIndex); // Ensure stepId is a string
    const isCompleted = currentRecipeSession.completedSteps.includes(stepId);
    
    // Convert completedSteps array to StepCompletionState object for utilities
    const completedStepsState: StepCompletionState = {};
    currentRecipeSession.completedSteps.forEach(sId => {
      completedStepsState[parseInt(sId)] = true;
    });
    
    if (isCompleted) {
      // Remove from completed steps
      uncompleteStepFn(recipeId, stepId);
    } else {
      // Add to completed steps
      completeStepFn(recipeId, stepId);
      
      // Auto-scroll to next step if recipe has instructions
      if (currentRecipeSession.recipe.instructions) {
        autoScrollToNextStep(
          stepIndex,
          currentRecipeSession.recipe.instructions,
          completedStepsState,
          scrollViewRef
        );
      }
    }
  };

  // --- Ingredient Tooltip Logic ---
  const handleIngredientPress = (ingredient: StructuredIngredient) => {
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
    // DEFENSIVE: Extract context function to local constant to prevent minification issues
    const showErrorFn = errorModalContext.showError;
    
    if (isTimerActive) {
      // Pause timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerStartTimestamp(null);
      setIsTimerActive(false);
    } else {
      // Start timer
      if (timerTimeRemaining > 0) {
        const startTime = Date.now();
        setTimerStartTimestamp(startTime);
        setIsTimerActive(true);
        
        timerIntervalRef.current = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const newTimeRemaining = Math.max(0, timerTimeRemaining - elapsedSeconds);
          
          if (newTimeRemaining <= 0) {
            // Timer finished
            setIsTimerActive(false);
            setTimerStartTimestamp(null);
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            setTimerTimeRemaining(0);
            
            // Show notification when timer finishes
            try {
              // DEFENSIVE: Extract showError again inside the interval closure
              const showErrorInternalFn = errorModalContext.showError;
              if (typeof showErrorInternalFn === 'function') {
                showErrorInternalFn('Timer', "Time's up!");
              } else {
                logger.error('showError is not a function in timer completion', {
                  showErrorType: typeof showErrorInternalFn,
                  hasErrorModalContext: !!errorModalContext
                });
              }
            } catch (showErrorError: any) {
              logger.error('Error calling showError for timer completion', {
                errorMessage: showErrorError.message,
                errorStack: showErrorError.stack
              });
            }
          } else {
            setTimerTimeRemaining(newTimeRemaining);
          }
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
    setTimerStartTimestamp(null);
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

  const handleEndCookingSessions = async () => {
    try {
      // End all cooking sessions
      await endAllSessions();
      
      // Close the tools modal
      closeToolsModal();
      
      // Navigate back to the mise screen (prep station)
      router.back();
    } catch (error) {
      logger.error('Error ending cooking sessions', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        activeRecipesCount: cookingContext.state.activeRecipes.length
      });
      // Still try to navigate back even if there's an error
      closeToolsModal();
      router.back();
    }
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
    const currentRecipe = cookingContext.state.activeRecipes.find(
      recipe => recipe.recipeId === cookingContext.state.activeRecipeId
    );
    if (currentRecipe?.recipe?.tips) {
      setIsRecipeTipsModalVisible(true);
    }
  };
  // --- End Recipe Tips Functions ---

  // Get the current recipe from the context state
  const currentRecipeSession = cookingContext.state.activeRecipes.find(
    recipe => recipe.recipeId === cookingContext.state.activeRecipeId
  );
  const currentRecipeData = currentRecipeSession?.recipe; // Get the actual CombinedParsedRecipe object

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cooking session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use the local 'recipes' state for rendering the switcher, as it directly drives the UI
  // and is synced with context in useFocusEffect.
  if (recipes.length === 0) {
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
            // Convert CombinedParsedRecipe[] to RecipeSession[] format
            recipes={recipes.map(recipe => ({
              recipeId: String(recipe.id),
              recipe: recipe,
              completedSteps: [],
              activeTimers: [],
              scrollPosition: 0,
              isLoading: false
            }))} 
            activeRecipeId={cookingContext.state.activeRecipeId || ''}
            onRecipeSwitch={handleRecipeSwitch}
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
        {currentRecipeData ? ( // Use currentRecipeData for rendering the steps
          <View style={styles.recipeContainer}>
            {currentRecipeSession?.isLoading ? ( // Check isLoading from session if needed
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading recipe...</Text>
              </View>
            ) : (
              <>
                {/* Recipe Steps with steps.tsx styling */}
                {currentRecipeData.instructions && currentRecipeData.instructions.length > 0 ? (
                  currentRecipeData.instructions.map((step, index) => {
                    // Convert completedSteps array to StepCompletionState object
                    const completedStepsState: StepCompletionState = {};
                    if (currentRecipeSession?.completedSteps) {
                      currentRecipeSession.completedSteps.forEach(stepId => {
                        completedStepsState[parseInt(stepId)] = true;
                      });
                    }
                    
                    const stepIsCompleted = isStepCompleted(index, completedStepsState);
                    const stepIsActive = isStepActive(index, currentRecipeData.instructions || [], completedStepsState);
                    
                    // Flatten ingredients from ingredient groups for highlighting
                    const flatIngredients: StructuredIngredient[] = [];
                    if (currentRecipeData.ingredientGroups) {
                      currentRecipeData.ingredientGroups.forEach(group => {
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
                        onStepPress={(stepIndex) => toggleStepCompleted(currentRecipeSession.recipeId, stepIndex)}
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
          hasRecipeTips={!!currentRecipeData?.tips}
          onEndCookingSessions={handleEndCookingSessions}
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
                data={currentRecipeData?.tips?.split(/\.\s+|\n+/).filter(tip => tip.trim()) || []}
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
