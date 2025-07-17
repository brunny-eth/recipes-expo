import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  AppState,
  AppStateStatus,
  InteractionManager,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCooking } from '@/context/CookingContext';
import { COLORS, SPACING, RADIUS, OVERLAYS, SHADOWS } from '@/constants/theme';
import { sectionHeaderText, bodyText, bodyStrongText, bodyTextLoose, captionText } from '@/constants/typography';
import { CombinedParsedRecipe, StructuredIngredient } from '@/common/types';
import RecipeSwitcher from '@/components/recipe/RecipeSwitcher';
import StepItem from '@/components/recipe/StepItem';
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
  const { state, startSession, startLazySession, loadRecipeDataIfNeeded, endSession, endAllSessions, switchRecipe, setScrollPosition, getCurrentScrollPosition, hasResumableSession, completeStep, uncompleteStep } = useCooking();
  
  const [isLoading, setIsLoading] = useState(true);
  const [recipes, setRecipes] = useState<CombinedParsedRecipe[]>([]);
  const appState = useRef(AppState.currentState);
  const scrollViewRef = useRef<ScrollView>(null);

  // --- Ingredient Tooltip State ---
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  // --- End Ingredient Tooltip State ---

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
    };
  }, []);

  // Load recipes from mise on mount
  useEffect(() => {
    const loadMiseRecipes = async () => {
      try {
        setIsLoading(true);
        console.log('[CookScreen] 🔄 Starting to load mise recipes from AsyncStorage');
        
        // Clear any existing cooking session to start fresh
        console.log('[CookScreen] 🧹 Clearing existing cooking sessions');
        await endAllSessions();
        
        // Get mise recipes from AsyncStorage
        console.log('[CookScreen] 📱 Reading miseRecipes from AsyncStorage');
        const miseData = await AsyncStorage.getItem('miseRecipes');
        
        if (!miseData) {
          console.log('[CookScreen] ❌ No mise data found in AsyncStorage');
          setRecipes([]);
          return;
        }
        
        console.log('[CookScreen] 📦 Raw mise data from AsyncStorage:', miseData.length, 'characters');
        const miseRecipes = JSON.parse(miseData);
        console.log('[CookScreen] 📊 Parsed mise recipes count:', miseRecipes.length);
        console.log('[CookScreen] 📋 Mise recipes summary:', miseRecipes.map((mr: any) => ({
          id: mr.id,
          title: mr.prepared_recipe_data?.title || mr.original_recipe_data?.title,
          hasLocalMods: !!mr.local_modifications,
          hasPreparedData: !!mr.prepared_recipe_data,
          hasOriginalData: !!mr.original_recipe_data,
        })));
        
        if (miseRecipes.length === 0) {
          console.log('[CookScreen] ❌ Mise recipes array is empty');
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
        
        // Start fresh sessions for all recipes
        if (recipeList.length > 0) {
          console.log('[CookScreen] 🚀 Starting cooking sessions for', recipeList.length, 'recipes');
          
          // Start first recipe immediately, others lazily
          if (recipeList[0]) {
            console.log('[CookScreen] 🥇 Starting immediate session for first recipe:', recipeList[0].title);
            startSession(recipeList[0]);
          }
          
          // Start lazy sessions for remaining recipes using mise IDs
          if (recipeList.length > 1) {
            console.log('[CookScreen] ⏳ Scheduling lazy sessions for remaining', recipeList.length - 1, 'recipes');
            InteractionManager.runAfterInteractions(() => {
              recipeList.slice(1).forEach((recipe: any, index: number) => {
                const cookingSessionId = String(recipe.id); // This is now the mise ID
                console.log('[CookScreen] 🔄 Starting lazy session:', {
                  cookingSessionId,
                  title: recipe.title,
                  miseRecipeId: recipe.miseRecipeId,
                  index: index + 1,
                  totalRemaining: recipeList.length - 1,
                });
                startLazySession(cookingSessionId);
              });
              console.log('[CookScreen] ✅ All lazy sessions initiated');
            });
          }
        } else {
          console.log('[CookScreen] ❌ No valid recipes found to start cooking sessions');
        }
      } catch (error) {
        console.error('[CookScreen] 💥 Error loading mise recipes:', error);
        console.error('[CookScreen] 💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        Alert.alert('Error', 'Failed to load recipes from mise');
      } finally {
        setIsLoading(false);
        console.log('[CookScreen] 🏁 Finished loading mise recipes, isLoading set to false');
      }
    };

    loadMiseRecipes();
  }, []);

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

  const handleEndSession = () => {
    Alert.alert(
      'End Cooking Session',
      'Are you sure you want to end your cooking session? This will clear all progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            // End all active sessions and clear storage
            await endAllSessions();
            router.replace('/tabs/mise');
          },
        },
      ]
    );
  };

  const handleRecipeSwitch = async (recipeId: string) => {
    // Save current scroll position before switching
    if (state.activeRecipeId && scrollViewRef.current) {
      // Get current scroll position - this would need to be implemented
      // For now, we'll use a placeholder
      const currentScrollY = 0; // TODO: Get actual scroll position
      setScrollPosition(state.activeRecipeId, currentScrollY);
    }
    
    switchRecipe(recipeId);
    // Load recipe data if needed
    await loadRecipeDataIfNeeded(recipeId);
    
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

  const currentRecipe = state.activeRecipes.find(
    recipe => recipe.recipeId === state.activeRecipeId
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cooking session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.activeRecipes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chef-hat" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Active Cooking Session</Text>
          <Text style={styles.emptyText}>
            Start a cooking session from your mise to begin cooking multiple recipes.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/tabs/mise')}
          >
            <Text style={styles.primaryButtonText}>Go to Mise</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with session controls */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Cooking Session</Text>
        
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndSession}
        >
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>
      </View>

      {/* Recipe Switcher */}
      <RecipeSwitcher
        recipes={state.activeRecipes}
        activeRecipeId={state.activeRecipeId || ''}
        onRecipeSwitch={handleRecipeSwitch}
        loadRecipeDataIfNeeded={loadRecipeDataIfNeeded}
      />

      {/* Current Recipe Content */}
      <PanGestureHandler onHandlerStateChange={handleSwipeGesture}>
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
      </PanGestureHandler>

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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    ...sectionHeaderText,
    flex: 1,
    textAlign: 'center',
  },
  endButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  endButtonText: {
    ...bodyStrongText,
    color: COLORS.error,
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
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  primaryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
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
}); 


