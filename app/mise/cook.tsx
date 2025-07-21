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

  // Cleanup timeout and timer on unmount
  useEffect(() => {
    return () => {
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

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
          
          // Initialize all sessions at once with full recipe data
          initializeSessions(miseRecipes);
          
          console.log('[CookScreen] ✅ All cooking sessions initialized with fresh recipe data');
        } else {
          console.log('[CookScreen] ❌ No valid recipes found to start cooking sessions');
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
      const timestamp = new Date().toISOString();
      console.log(`[CookScreen] 🎯 useFocusEffect triggered at ${timestamp}`);
      
      // Always fetch fresh data when screen comes into focus
      console.log('[CookScreen] 🔄 Navigation check - fetching fresh data');
      
      const refreshMiseRecipes = async () => {
        try {
          console.log('[CookScreen] 🔄 Starting to refresh mise recipes from API');
          
          // Clear any existing cooking session to start fresh
          await endAllSessions();
          
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
            initializeSessions(miseRecipes);
          }
        } catch (error) {
          console.error('[CookScreen] 💥 Error refreshing mise recipes:', error);
        }
      };
      
      refreshMiseRecipes();
    }, [session?.user?.id, session?.access_token]) // Removed function dependencies that change on every render
  );

  // Handle app state changes for timer management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - sync timers
        console.log('App came to foreground, syncing timers');
        // Timer sync logic will be handled by individual timer components
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);



  const handleRecipeSwitch = (recipeId: string) => {
    console.time(`[CookScreen] ⏱️ handleRecipeSwitch-${recipeId}`);
    console.log('[CookScreen] 🔄 Starting recipe switch to:', recipeId);
    
    // Save current scroll position before switching
    if (state.activeRecipeId && scrollViewRef.current) {
      // Get current scroll position - this would need to be implemented
      // For now, we'll use a placeholder
      const currentScrollY = 0; // TODO: Get actual scroll position
      setScrollPosition(state.activeRecipeId, currentScrollY);
    }
    
    switchRecipe(recipeId);
    // No need to load recipe data - all recipes are already loaded with eager loading
    
    console.log('[CookScreen] ✅ Recipe switch completed for:', recipeId);
    console.timeEnd(`[CookScreen] ⏱️ handleRecipeSwitch-${recipeId}`);
    
    // Restore scroll position for new recipe
    const savedScrollY = getCurrentScrollPosition(recipeId);
    if (savedScrollY > 0 && scrollViewRef.current) {
      InteractionManager.runAfterInteractions(() => {
        scrollViewRef.current?.scrollTo({ y: savedScrollY, animated: true });
      });
    }
  };

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
        // Check if we can go back properly, otherwise navigate to mise as fallback
        if (router.canGoBack()) {
          router.back();
        } else {
          // Navigate back to mise tab
          router.navigate('/tabs/mise' as any);
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
              showError('Timer', "Time's up!");
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

  const handleAIChatPress = () => {
    openToolsModal('aiChat');
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
          onAIChatPress={handleAIChatPress}
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
          recipeInstructions={currentRecipe?.recipe?.instructions || []}
          recipeSubstitutions={currentRecipe?.recipe?.substitutions_text || null}
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