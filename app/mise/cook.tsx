import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FolderPickerModal from '@/components/FolderPickerModal';
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
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import uuid from 'react-native-uuid';
import isEqual from 'fast-deep-equal';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

import { useCooking } from '@/context/CookingContext';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { useAnalytics } from '@/utils/analytics';
import { createLogger } from '@/utils/logger';
import { COLORS, SPACING, RADIUS, OVERLAYS, SHADOWS, BORDER_WIDTH } from '@/constants/theme';
import { sectionHeaderText, bodyText, bodyStrongText, bodyTextLoose, captionText, FONT } from '@/constants/typography';
import { CombinedParsedRecipe, StructuredIngredient } from '@/common/types';
import RecipeSwitcher from '@/components/recipe/RecipeSwitcher';
import StepItem from '@/components/recipe/StepItem';

import MiniTimerDisplay from '@/components/MiniTimerDisplay';
import StepsFooterButtons from '@/components/recipe/StepsFooterButtons';
import TimerTool, { Timer } from '@/components/TimerTool';

import { 
  StepCompletionState, 
  isStepCompleted, 
  isStepActive, 
  autoScrollToNextStep,
  findIngredientSpans,
  parseTextSegments
} from '@/utils/stepUtils';
import { abbreviateUnit } from '@/utils/format';
import { isUserFork, normalizeInstructionsToSteps, InstructionStep } from '@/utils/recipeUtils';

type LocalStep = InstructionStep;

interface AddStepButtonProps {
  onPress: () => void;
}

function AddStepButton({ onPress }: AddStepButtonProps) {
  return (
    <TouchableOpacity
      style={styles.addStepButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.addStepContent}>
        <MaterialCommunityIcons
          name="plus"
          size={20}
          color={COLORS.textMuted}
          style={styles.addStepIcon}
        />
        <Text style={styles.addStepText}>Add new step</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  

  
  // Access the entire context objects
  const cookingContext = useCooking();
  const { selectedMiseId } = cookingContext;
  const errorModalContext = useErrorModal();
  const successModalContext = useSuccessModal();
  const { track } = useAnalytics();
  const logger = createLogger('CookScreen');

  // Removed temporary AsyncStorage clearing - no longer needed

  // Destructure from the context objects where needed, but use the objects directly in handleRecipeSwitch
  // This is a key change to potentially avoid stale closures in production builds.
  const { state, initializeSessions, endSession, endAllSessions, hasResumableSession, completeStep, uncompleteStep } = cookingContext;
  const { showError } = errorModalContext;
  const { showSuccess } = successModalContext;


  // Removed debug logging - production ready
  
  const [isLoading, setIsLoading] = useState(true);
  const [recipes, setRecipes] = useState<CombinedParsedRecipe[]>([]);
  const appState = useRef(AppState.currentState);
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<any>(null);

  // --- Ingredient Tooltip State ---
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  // --- End Ingredient Tooltip State ---

  // --- Timer State (Multiple Timers) ---
  const [timers, setTimers] = useState<Timer[]>([]);
  const timerIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // --- End Timer State ---

  // --- Timer Modal State ---
  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  // --- End Timer Modal State ---

  // --- Recipe Tips Modal State ---
  const [isRecipeTipsModalVisible, setIsRecipeTipsModalVisible] = useState(false);
  // --- End Recipe Tips Modal State ---

  // NEW: State to store the current scroll Y position
  const [currentScrollY, setCurrentScrollY] = useState(0);

  // Add scroll position throttling
  const scrollPositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Step Management State ---
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [baselineSteps, setBaselineSteps] = useState<LocalStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initializedFromCanonical, setInitializedFromCanonical] = useState(false);
  // --- End Step Management State ---

  // --- Step Edit Modal State ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepText, setEditingStepText] = useState('');
  // --- End Step Edit Modal State ---

  // --- Mise Context State ---
  const [canonicalRecipeData, setCanonicalRecipeData] = useState<CombinedParsedRecipe | null>(null);
  
  // Use selectedMiseId from cooking context as the miseId
  const miseId = selectedMiseId;
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0); // ✅ FIX: Force re-fetch after save operations
  
  // Track last saved recipe info to avoid re-querying
  const [lastSaved, setLastSaved] = useState<{savedId: string, baseRecipeId: number} | null>(null);

  // Debug: Log state changes
  
  useEffect(() => {
    console.log('[DEBUG] 🔍 canonicalRecipeData changed to:', canonicalRecipeData?.id);
  }, [canonicalRecipeData]);
  
  useEffect(() => {
    console.log('[DEBUG] 🔍 reloadVersion changed to:', reloadVersion);
  }, [reloadVersion]);

  // Selection change logging
  useEffect(() => {
    console.log('[COOK] selection change', { selectedMiseId });
  }, [selectedMiseId]);

  useEffect(() => {
    console.log('[COOK] canonicalRecipeData change', { id: canonicalRecipeData?.id });
  }, [canonicalRecipeData?.id]);
  // --- End Mise Context State ---

  // Fetch canonical recipe from mise pointer (stale-response safe)
  const lastRequestRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCanonicalRecipeFromMise = useCallback(async (miseId: string, accessToken: string) => {
    console.log('[COOK] fetchCanonicalFromMise', { miseId });
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const requestKey = `${miseId}-${Date.now()}`;
    lastRequestRef.current = requestKey;
    const start = Date.now();
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        console.error('[DEBUG] ❌ API configuration error: EXPO_PUBLIC_API_URL is not defined.');
        return;
      }

      console.log('[DEBUG] 🔍 Fetching canonical recipe for mise:', miseId);
      
      const response = await fetch(`${backendUrl}/api/mise/recipes/${miseId}?userId=${session?.user.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error('[DEBUG] ❌ Failed to fetch canonical recipe:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      const end = Date.now();
      const isLatest = lastRequestRef.current === requestKey;
      console.log('[Cook] canonical loaded', {
        id: data.recipe?.id,
        hasInstructions: Array.isArray(data.recipe?.instructions),
        length: Array.isArray(data.recipe?.instructions) ? data.recipe.instructions.length : null,
        ms: end - start,
        applied: isLatest,
      });
      
      // Store canonical recipe data for use in save operations
      if (isLatest && data.recipe) setCanonicalRecipeData(data.recipe);
    } catch (error) {
      console.error('[DEBUG] ❌ Error fetching canonical recipe:', error);
    }
  }, [session?.user.id, session?.access_token]);

  // Drive fetch by selectedMiseId only
  useFocusEffect(
    useCallback(() => {
      if (!selectedMiseId || !session?.access_token) return;
      console.log('[COOK] fetchCanonicalFromMise', { miseId: selectedMiseId });
      fetchCanonicalRecipeFromMise(selectedMiseId, session.access_token);
    }, [selectedMiseId, session?.access_token])
  );

  // ✅ FIX: Fetch canonical recipe by ID (for direct access from saved recipes)
  const fetchCanonicalRecipeById = useCallback(async (recipeId: string, accessToken: string) => {
    console.log('[COOK] fetchCanonicalById', { id: recipeId });
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        console.error('[DEBUG] ❌ API configuration error: EXPO_PUBLIC_API_URL is not defined.');
        return;
      }

      console.log('[DEBUG] 🔍 Fetching canonical recipe by ID:', recipeId);
      
      const response = await fetch(`${backendUrl}/api/recipes/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[DEBUG] ❌ Failed to fetch canonical recipe by ID:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      console.log('[Cook] canonical loaded', {
        id: data?.id,
        hasInstructions: Array.isArray(data?.instructions),
        length: Array.isArray(data?.instructions) ? data.instructions.length : null,
      });
      
      // Store canonical recipe data for use in save operations
      setCanonicalRecipeData(data);
    } catch (error) {
      console.error('[DEBUG] ❌ Error fetching canonical recipe by ID:', error);
    }
  }, []);

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
  }, [cookingContext.state.activeRecipeId]);

  // Keep screen awake while cooking
  useKeepAwake();

  // Get the current recipe from the context state
  const currentRecipeSession = useMemo(() => 
    cookingContext.state.activeRecipes.find(
      recipe => recipe.recipeId === cookingContext.state.activeRecipeId
    ), [cookingContext.state.activeRecipes, cookingContext.state.activeRecipeId]
  );
  const currentRecipeData = useMemo(() => 
    currentRecipeSession?.recipe, [currentRecipeSession]
  ); // Get the actual CombinedParsedRecipe object

  // Initialize steps when canonical recipe data changes (only once per recipe ID)
  // Reset init and clear steps when canonical changes
  useEffect(() => {
    console.log('[COOK] canonicalRecipeData change', { id: canonicalRecipeData?.id });
    setInitializedFromCanonical(false);
    setSteps([]);
    setBaselineSteps([]);
  }, [canonicalRecipeData?.id]);

  // Initialize steps once per recipe id
  useEffect(() => {
    console.log('[COOK] init steps check', { initializedFromCanonical, id: canonicalRecipeData?.id, stepsLen: steps.length });
    if (!canonicalRecipeData?.id) return;
    if (initializedFromCanonical || steps.length > 0) return;
    const norm = normalizeInstructionsToSteps(canonicalRecipeData.instructions);
    console.log('[COOK] initializing steps for', canonicalRecipeData.id, { normLen: norm.length });
    setSteps(norm);
    setBaselineSteps(norm);
    setInitializedFromCanonical(true);
  }, [canonicalRecipeData?.id, initializedFromCanonical, steps.length]);

  // Reset initialization flag when recipe ID changes
  useEffect(() => {
    setInitializedFromCanonical(false);
  }, [canonicalRecipeData?.id]);

    // Timer and scroll cleanup - only on component unmount
  useEffect(() => {
    return () => {
      // Clean up all timers
      timerIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      timerIntervalsRef.current.clear();

      // Clean up scroll timeout
      if (scrollPositionTimeoutRef.current) {
        clearTimeout(scrollPositionTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array = only runs on unmount

  // Load sessions only - canonical fetching is now driven by selectedMiseId
  useFocusEffect(
    useCallback(() => {
      const loadAndInitializeRecipes = async () => {
        setIsLoading(true);

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
                initializeSessionsFn(miseRecipes); // No initial recipe needed - auto-selected by context
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
                miseRecipesCount: miseRecipes.length
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
    }, [cookingContext.state.activeRecipes.length, session?.access_token, session?.user?.id])
  );

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
  }, [logger]);

  // REMOVED: Dummy function no longer needed - using real context function with defensive checks

    // Production-ready handleRecipeSwitch with defensive checks
  const handleRecipeSwitch = useCallback((recipeId: string) => {
    try {
      // Extract context functions to local constants to prevent minification issues
      const setScrollPositionFn = cookingContext.setScrollPosition;
      const switchRecipeFn = cookingContext.switchRecipe;
      const selectMiseRecipeFn = (cookingContext as any).selectMiseRecipe as (id: string)=>void;
      const getCurrentScrollPositionFn = cookingContext.getCurrentScrollPosition;
      const showErrorFn = errorModalContext.showError;

      // Defensive checks - if any context function is undefined, bail out
      if (typeof setScrollPositionFn !== 'function' || 
          typeof switchRecipeFn !== 'function' || 
          typeof selectMiseRecipeFn !== 'function' || 
          typeof getCurrentScrollPositionFn !== 'function' || 
          typeof showErrorFn !== 'function') {
        logger.error('Context functions are undefined, aborting recipe switch', {
          setScrollPositionType: typeof setScrollPositionFn,
          switchRecipeType: typeof switchRecipeFn,
          selectMiseRecipeType: typeof selectMiseRecipeFn,
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

      // Switch to the new recipe and drive selection
      switchRecipeFn(recipeId);
      console.log('[COOK] tab selected', { recipeId });
      selectMiseRecipeFn(recipeId);

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
  }, [cookingContext, errorModalContext, currentScrollY, logger, session?.user?.id]);


  // Check if steps have changed from baseline using useMemo for performance
  const hasChanges = useMemo(() => {
    const changed = !isEqual(steps, baselineSteps);
    if (changed) {
      console.log('🔍 DEBUG: hasChanges =', changed);
      console.log('🔍 Recipe analysis:', {
        recipeId: currentRecipeData?.id,
        isUserFork: currentRecipeData ? isUserFork(currentRecipeData) : false,
        sourceType: currentRecipeData?.source_type,
        parentRecipeId: currentRecipeData?.parent_recipe_id
      });
    }
    return changed;
  }, [steps, baselineSteps, currentRecipeData]);

  // Save modified steps to backend
  const handleSaveSteps = useCallback(async () => {
    // Use canonical recipe data if available, otherwise fall back to currentRecipeData
    const canonicalId = canonicalRecipeData?.id || currentRecipeData?.id;
    const recipeToSave = canonicalRecipeData || currentRecipeData;
    
    if (!recipeToSave || !canonicalId || !session?.access_token || !hasChanges) {
      return;
    }

    setIsSaving(true);
    
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('API configuration error: EXPO_PUBLIC_API_URL is not defined.');
      }

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // 1. If recipe is a fork (is_user_modified === true): PATCH the fork
      if (isUserFork(recipeToSave)) {
        console.log('[Cook] PATCHing fork id=', canonicalId);
        
        const patchResponse = await fetch(`${backendUrl}/api/recipes/${canonicalId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            patch: {
              instructions: steps
            }
          }),
        });

        if (!patchResponse.ok) {
          const errorData = await patchResponse.json();
          throw new Error(errorData.error || `Failed to patch recipe: ${patchResponse.statusText}`);
        }

        const patchData = await patchResponse.json();
        
        // Optimistic save: only update baseline, keep current steps as-is
        if (patchData.recipe?.recipe_data) {
          const updatedRecipeFromServer = patchData.recipe.recipe_data;
          const norm = normalizeInstructionsToSteps(updatedRecipeFromServer.instructions);
          setBaselineSteps(norm);
          // Keep current 'steps' as-is (they match what we just saved)
          
          // CRITICAL: Update cooking context with the patched recipe data
          if (cookingContext.updateRecipe && currentRecipeData?.id) {
            cookingContext.updateRecipe(currentRecipeData.id.toString(), updatedRecipeFromServer);
            console.log('[Cook] Updated cooking context with patched fork data');
          }
        }
        
        // Show success toast
        showSuccess('Saved', 'Recipe changes saved successfully', 2000);
        
      } else {
        // 2. If recipe is original: Determine if it came from a saved recipe or is truly unsaved
        
        // Check if this recipe came from mise and originated from a saved recipe
        const currentMiseRecipe = currentRecipeSession;
        const isFromMise = !!miseId && !!currentMiseRecipe;
        
        console.log('[Cook] Recipe context:', {
          canonicalId,
          isFromMise,
          miseId,
          currentRecipeId: currentRecipeData?.id,
          originalRecipeId: (currentRecipeData as any)?.originalRecipeId
        });
        
        // Check for existing saved recipe entry
        let savedId = null;
        try {
          const response = await fetch(`${backendUrl}/api/saved/recipes?userId=${session.user.id}&baseRecipeId=${canonicalId}`);
          
          if (response.ok) {
            const data = await response.json();
            const recipesArray = data.recipes || [];
            const existingSavedRecipe = recipesArray.find((r: any) => 
              String(r.base_recipe_id) === String(canonicalId)
            );
            
            if (existingSavedRecipe) {
              savedId = existingSavedRecipe.id;
            }
          }
        } catch (error) {
          console.warn('[Cook] Failed to check for existing saved recipe:', error);
          // Continue without saved_id
        }
        
        console.log('[COOK] save decision', { 
          canonicalId, 
          lastSavedBaseId: lastSaved?.baseRecipeId, 
          willPatch: isUserFork(recipeToSave), 
          willPromptFolder: !savedId && !lastSaved 
        });
        
        // Check if we already know this recipe is saved (avoid re-querying)
        const isKnownSaved = lastSaved && lastSaved.baseRecipeId === canonicalId;
        
        if (savedId || isKnownSaved) {
          // Recipe has an existing saved entry - update it to point to new fork
          console.log('[Cook] Recipe already saved, updating existing saved entry');
          
          const saveResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              originalRecipeId: canonicalId,
              userId: session.user.id,
              modifiedRecipeData: {
                ...recipeToSave,
                instructions: steps
              },
              appliedChanges: {
                ingredientChanges: [],
                scalingFactor: 1
              },
              saved_id: savedId || lastSaved?.savedId, // Use known saved ID if available
            }),
          });

          if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.error || `Failed to create fork: ${saveResponse.statusText}`);
          }

          const saveResult = await saveResponse.json();
          const newRecipeId = saveResult.recipe?.id;
          const savedRecordId = saveResult.userSavedRecordId;
          
          console.log('[COOK] fork success', { 
            forkId: newRecipeId, 
            savedId: savedRecordId || savedId || lastSaved?.savedId, 
            replacingOriginal: canonicalId 
          });
          
          // CRITICAL: Promote fork to canonical and update saved info
          if (saveResult.recipe?.recipe_data) {
            const updatedRecipeFromServer = {
              ...saveResult.recipe.recipe_data,
              id: newRecipeId // CRITICAL: Add the fork ID to the recipe data
            };
            
            // Update canonical recipe data to the fork
            setCanonicalRecipeData(updatedRecipeFromServer);
            
            // Update baseline steps
            const norm = normalizeInstructionsToSteps(updatedRecipeFromServer.instructions);
            setBaselineSteps(norm);
            
            // Update saved info cache
            if (newRecipeId) {
              setLastSaved({ 
                savedId: savedRecordId || savedId || lastSaved?.savedId || '', 
                baseRecipeId: newRecipeId 
              });
            }
            
            // Update cooking context with the new fork data
            if (cookingContext.updateRecipe && currentRecipeData?.id) {
              cookingContext.updateRecipe(currentRecipeData.id.toString(), updatedRecipeFromServer);
              console.log('[Cook] Updated cooking context with new fork data');
            }
          }
          
          // Show success toast
          showSuccess('Saved', 'Recipe changes saved successfully', 2000);
          
          // If we're in a mise context, update the mise pointer to point to the new fork
          if (miseId && newRecipeId) {
            try {
              const updateMiseResponse = await fetch(`${backendUrl}/api/mise/recipes/${miseId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                  userId: session.user.id,
                  originalRecipeId: newRecipeId, // Point to the new fork
                }),
              });
              
              if (!updateMiseResponse.ok) {
                console.warn('[Cook] Failed to update mise pointer, but fork was created successfully');
              } else {
                console.log('[CTX] updateMiseRecipe', { miseId, newOriginalRecipeId: newRecipeId });
              }
            } catch (error) {
              console.warn('[Cook] Error updating mise pointer:', error);
            }
          }
        } else {
          // Recipe has no saved entry - prompt user for folder selection
          console.log('[Cook] Recipe is unsaved, prompting for folder selection');
          setFolderPickerVisible(true);
          return; // Exit early - the actual save will happen in the folder picker callback
        }
      }

    } catch (error) {
      logger.error('Error saving recipe steps', {
        errorMessage: error instanceof Error ? error.message : String(error),
        recipeId: canonicalId
      });
      
      if (typeof errorModalContext.showError === 'function') {
        errorModalContext.showError('Save Error', 'Failed to save changes. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [canonicalRecipeData, currentRecipeData, session?.access_token, hasChanges, errorModalContext, successModalContext, steps, miseId, showSuccess]);



      // Step edit modal functions
  const openEditModal = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    setEditingStepId(stepId);
    setEditingStepText(step?.text || '');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    // Delay clearing state to prevent visual jank during modal close animation
    setTimeout(() => {
      setEditingStepId(null);
      setEditingStepText('');
    }, 300); // Match modal animation duration
  };

  const saveStepText = () => {
    if (editingStepId) {
      setSteps(prev => prev.map(s =>
        s.id === editingStepId
          ? { ...s, text: editingStepText.trim() || 'New step' }
          : s
      ));
    }
    closeEditModal();
  };

  // Delete step function
  const deleteStep = useCallback((stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId));
  }, []);

  const addNewStep = useCallback(() => {
    const newStep: LocalStep = {
      id: uuid.v4() as string,
      text: 'New step',
      note: undefined
    };
    setSteps(prev => [...prev, newStep]);
  }, []);

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
      
      // Auto-scroll to next uncompleted step
      if (steps.length > 0 && flatListRef.current) {
        const nextUncompletedIndex = steps.findIndex(
          (_, sIndex) => sIndex > stepIndex && !completedStepsState[sIndex]
        );
        
        if (nextUncompletedIndex !== -1) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: nextUncompletedIndex,
              animated: true,
              viewPosition: 0.3, // Show the step in upper third of screen
            });
          }, 300);
        }
      }
    }
  };

  // --- Ingredient Tooltip Logic ---
  const handleIngredientPress = (ingredient: StructuredIngredient) => {
    setSelectedIngredient(ingredient);
    setIsTooltipVisible(true);
  };
  // --- End Ingredient Tooltip Logic ---

  // Render function for draggable steps
  const renderStepItem = useCallback(({ item, drag, isActive }: RenderItemParams<LocalStep>) => {
    // Convert completedSteps array to StepCompletionState object
    const completedStepsState: StepCompletionState = {};
    if (currentRecipeSession?.completedSteps) {
      currentRecipeSession.completedSteps.forEach(stepId => {
        completedStepsState[parseInt(stepId)] = true;
      });
    }
    
    const stepIndex = steps.findIndex(s => s.id === item.id);
    const stepIsCompleted = isStepCompleted(stepIndex, completedStepsState);
    const stepIsActive = isStepActive(stepIndex, steps.map(s => s.text), completedStepsState);
    
    // Flatten ingredients from ingredient groups for highlighting
    const flatIngredients: StructuredIngredient[] = [];
    if (currentRecipeData?.ingredientGroups) {
      currentRecipeData.ingredientGroups.forEach(group => {
        if (group.ingredients && Array.isArray(group.ingredients)) {
          flatIngredients.push(...group.ingredients);
        }
      });
    }

    // Generate ingredient spans for smart highlighting
    const ingredientSpans = findIngredientSpans(item.text, flatIngredients);
    const textSegments = parseTextSegments(item.text, ingredientSpans);

    return (
      <View 
        style={[
          styles.stepItemContainer,
          isActive && styles.stepItemActive
        ]}
      >
        <View style={styles.stepContent}>
          {/* Left side drag handle */}
          <TouchableOpacity
            style={styles.dragHandleLeft}
            onLongPress={drag}
            disabled={isActive}
          >
            <MaterialCommunityIcons
              name="drag-vertical"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          {/* Clickable step text container */}
          <TouchableOpacity
            style={styles.stepTextContainer}
            onPress={() => toggleStepCompleted(currentRecipeSession?.recipeId || '', stepIndex)}
            activeOpacity={0.7}
          >
            {/* Render highlighted text with ingredient spans */}
            <Text style={[
              styles.stepText,
              stepIsCompleted && styles.stepTextCompleted
            ]}>
              {textSegments.map((segment, segmentIndex) => (
                <Text
                  key={`segment-${segmentIndex}`}
                  style={segment.isHighlighted ? styles.highlightedText : undefined}
                  onPress={
                    segment.isHighlighted && !stepIsCompleted && segment.ingredientId
                      ? () => {
                          const ingredient = flatIngredients.find(ing => ing.name === segment.ingredientId);
                          if (ingredient) {
                            handleIngredientPress(ingredient);
                          }
                        }
                      : undefined
                  }
                >
                  {segment.text}
                </Text>
              ))}
            </Text>
          </TouchableOpacity>

          {/* Right side controls */}
          <View style={styles.stepControls}>
            {/* Edit icon */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openEditModal(item.id)}
            >
              <MaterialCommunityIcons
                name="pencil"
                size={16}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>

            {/* Delete icon */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteStep(item.id)}
            >
              <Text style={styles.deleteIcon}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [steps, currentRecipeSession, currentRecipeData, toggleStepCompleted, openEditModal, deleteStep, handleIngredientPress]);

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

  const handleAddTimer = (name: string, initialTime?: number, startActive?: boolean) => {
    const newTimer: Timer = {
      id: uuid.v4() as string,
      name,
      timeRemaining: initialTime || 0,
      isActive: startActive || false,
      startTimestamp: startActive ? Date.now() : null,
    };
    setTimers(prev => [...prev, newTimer]);
    
    // If the timer should start active, trigger the update logic
    if (startActive && initialTime && initialTime > 0) {
      // Use setTimeout to ensure the timer is added to state first
      setTimeout(() => {
        handleUpdateTimer(newTimer.id, { 
          isActive: true,
          startTimestamp: Date.now()
        });
      }, 0);
    }
  };

  const handleUpdateTimer = useCallback((id: string, updates: Partial<Timer>) => {
    setTimers(prev => prev.map(timer => {
      if (timer.id === id) {
        const updatedTimer = { ...timer, ...updates };
        
        // Handle timer start/pause logic
        if (updates.isActive !== undefined) {
          const existingInterval = timerIntervalsRef.current.get(id);
          
          if (updates.isActive && !existingInterval && updatedTimer.timeRemaining > 0) {
            // Start timer
            const startTime = Date.now();
            updatedTimer.startTimestamp = startTime;
            
            const interval = setInterval(() => {
              setTimers(currentTimers => currentTimers.map(t => {
                if (t.id === id) {
                  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                  const newTimeRemaining = Math.max(0, updatedTimer.timeRemaining - elapsedSeconds);
                  
                  if (newTimeRemaining <= 0) {
                    // Timer finished
                    const intervalToClean = timerIntervalsRef.current.get(id);
                    if (intervalToClean) {
                      clearInterval(intervalToClean);
                      timerIntervalsRef.current.delete(id);
                    }
                    
                    // Show notification
                    try {
                      const showErrorFn = errorModalContext.showError;
                      if (typeof showErrorFn === 'function') {
                        showErrorFn(t.name, "Time's up!");
                      }
                    } catch (error) {
                      logger.error('Error showing timer completion notification', { error });
                    }
                    
                    return {
                      ...t,
                      timeRemaining: 0,
                      isActive: false,
                      startTimestamp: null,
                    };
                  }
                  
                  return {
                    ...t,
                    timeRemaining: newTimeRemaining,
                  };
                }
                return t;
              }));
            }, 1000);
            
            timerIntervalsRef.current.set(id, interval);
          } else if (!updates.isActive && existingInterval) {
            // Pause timer
            clearInterval(existingInterval);
            timerIntervalsRef.current.delete(id);
            updatedTimer.startTimestamp = null;
          }
        }
        
        return updatedTimer;
      }
      return timer;
    }));
  }, [errorModalContext.showError, logger]);

  const handleDeleteTimer = (id: string) => {
    // Clean up interval if exists
    const existingInterval = timerIntervalsRef.current.get(id);
    if (existingInterval) {
      clearInterval(existingInterval);
      timerIntervalsRef.current.delete(id);
    }
    
    // Remove timer from state
    setTimers(prev => prev.filter(timer => timer.id !== id));
  };
  // --- End Timer Functions ---

  // --- Timer Modal Functions ---
  const openTimerModal = () => {
    // Create initial timer if none exist
    if (timers.length === 0) {
      handleAddTimer('Timer', 0, false);
    }
    setIsTimerModalVisible(true);
  };

  const closeTimerModal = () => {
    setIsTimerModalVisible(false);
  };

  const handleEndCookingSessions = async () => {
    try {
      // End all cooking sessions
      await endAllSessions();
      
      // Close the timer modal
      closeTimerModal();
      
      // Navigate back to the mise screen (prep station)
      router.back();
    } catch (error) {
      logger.error('Error ending cooking sessions', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        activeRecipesCount: cookingContext.state.activeRecipes.length
      });
      // Still try to navigate back even if there's an error
      closeTimerModal();
      router.back();
    }
  };

  const handleTimersPress = () => {
    openTimerModal();
  };

  const handleMiniTimerPress = () => {
    openTimerModal();
  };
  // --- End Timer Modal Functions ---

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
        <View style={styles.content}>
        {currentRecipeData ? ( // Use currentRecipeData for rendering the steps
          <View style={styles.recipeContainer}>
            {currentRecipeSession?.isLoading ? ( // Check isLoading from session if needed
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading recipe...</Text>
              </View>
            ) : (
              <>
                {/* Draggable Recipe Steps */}
                {steps.length > 0 ? (
                  <DraggableFlatList
                    key={canonicalRecipeData?.id ?? 'no-recipe'}
                    ref={flatListRef}
                    data={steps}
                    keyExtractor={(item) => item.id}
                    onDragEnd={({ data }) => setSteps(data)}
                    renderItem={renderStepItem}
                    ListFooterComponent={() => (
                      <AddStepButton onPress={addNewStep} />
                    )}
                    containerStyle={styles.stepsContainer}
                                        contentContainerStyle={{
                      paddingBottom: currentRecipeData?.tips ? 240 : 200
                    }}
                    onScrollToIndexFailed={(info) => {
                      // Handle scroll to index failure gracefully
                      setTimeout(() => {
                        flatListRef.current?.scrollToIndex({
                          index: Math.min(info.index, steps.length - 1),
                          animated: true,
                          viewPosition: 0.3,
                        });
                      }, 100);
                    }}
                  />
                ) : (
                  <View style={styles.noRecipeContainer}>
                    <Text style={styles.noRecipeText}>No recipe steps available</Text>
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.noRecipeContainer}>
            <Text style={styles.noRecipeText}>Select a recipe to start cooking</Text>
          </View>
        )}
        </View>

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



        {/* Step Edit Modal */}
        <Modal
          visible={editModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={closeEditModal}
        >
          <Pressable
            style={styles.editModalOverlay}
            onPress={closeEditModal}
          >
            <Pressable style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>
                  Edit Step
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeEditModal}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.editModalInput}
                value={editingStepText}
                onChangeText={setEditingStepText}
                placeholder="Enter step instructions"
                multiline
                autoFocus
              />

              <View style={styles.editModalActions}>
                <TouchableOpacity
                  style={styles.editModalCancelButton}
                  onPress={closeEditModal}
                >
                  <Text style={styles.editModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editModalSaveButton}
                  onPress={saveStepText}
                >
                  <Text style={styles.editModalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Footer Buttons */}
        <StepsFooterButtons
          onTimersPress={handleTimersPress}
          onRecipeTipsPress={handleRecipeTipsPress}
          hasRecipeTips={!!currentRecipeData?.tips}
          onEndCookingSessions={handleEndCookingSessions}
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSavePress={handleSaveSteps}
        />

        {/* Timer Modal */}
        <TimerTool
          isVisible={isTimerModalVisible}
          onClose={closeTimerModal}
          timers={timers}
          onAddTimer={handleAddTimer}
          onUpdateTimer={handleUpdateTimer}
          onDeleteTimer={handleDeleteTimer}
          formatTime={formatTime}
        />

        {/* Mini Timer Display */}
        {!isTimerModalVisible && timers.some(timer => timer.isActive && timer.timeRemaining > 0) && (
          <MiniTimerDisplay
            timers={timers.filter(timer => timer.isActive && timer.timeRemaining > 0)}
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
                    color={COLORS.textDark}
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

        {/* Folder Picker Modal for saving modified recipes */}
        <FolderPickerModal
          visible={folderPickerVisible}
          onClose={() => setFolderPickerVisible(false)}
          onSelectFolder={async (folderId: number) => {
            console.log('[DEBUG] 🔧 User selected folder:', folderId, 'for recipe:', currentRecipeData?.id);
            
            // Close the modal
            setFolderPickerVisible(false);
            
            // Create new fork using save-modified endpoint with folder selection
            try {
              const backendUrl = process.env.EXPO_PUBLIC_API_URL;
              if (!backendUrl) {
                throw new Error('API configuration error: EXPO_PUBLIC_API_URL is not defined.');
              }

              // Use canonical recipe data if available, otherwise fall back to currentRecipeData
              const canonicalId = canonicalRecipeData?.id || currentRecipeData?.id;
              const recipeToSave = canonicalRecipeData || currentRecipeData;
              
              if (!recipeToSave || !canonicalId || !session?.access_token) {
                throw new Error('Missing required data for saving recipe');
              }

              console.log('[Cook] Creating fork with folder selection - id=', canonicalId, 'folder=', folderId);

              const headers = {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              };

              const saveResponse = await fetch(`${backendUrl}/api/recipes/save-modified`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  originalRecipeId: canonicalId,
                  userId: session.user.id,
                  modifiedRecipeData: {
                    ...recipeToSave,
                    instructions: steps
                  },
                  appliedChanges: {
                    ingredientChanges: [],
                    scalingFactor: 1
                  },
                  folderId: folderId // Include folder selection
                }),
              });

              if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                throw new Error(errorData.error || `Failed to create fork: ${saveResponse.statusText}`);
              }

              const saveResult = await saveResponse.json();
              const newRecipeId = saveResult.recipe?.id;
              const savedRecordId = saveResult.userSavedRecordId;
              
              console.log('[COOK] fork success', { 
                forkId: newRecipeId, 
                savedId: savedRecordId, 
                replacingOriginal: canonicalId 
              });
              
              // CRITICAL: Promote fork to canonical - this is the key fix
              console.log('[DEBUG] Server response structure:', {
                hasRecipe: !!saveResult.recipe,
                hasRecipeData: !!saveResult.recipe?.recipe_data,
                recipeKeys: saveResult.recipe ? Object.keys(saveResult.recipe) : [],
                recipeDataKeys: saveResult.recipe?.recipe_data ? Object.keys(saveResult.recipe.recipe_data) : []
              });
              
              if (saveResult.recipe?.recipe_data) {
                const updatedRecipeFromServer = {
                  ...saveResult.recipe.recipe_data,
                  id: newRecipeId // CRITICAL: Add the fork ID to the recipe data
                };
                
                console.log('[DEBUG] Fork recipe data:', {
                  id: updatedRecipeFromServer.id,
                  title: updatedRecipeFromServer.title,
                  hasInstructions: !!updatedRecipeFromServer.instructions,
                  instructionsCount: updatedRecipeFromServer.instructions?.length,
                  isUserModified: updatedRecipeFromServer.is_user_modified
                });
                
                // 1. Update canonical recipe data to the fork
                setCanonicalRecipeData(updatedRecipeFromServer);
                
                // 2. Update baseline steps and re-initialize
                const norm = normalizeInstructionsToSteps(updatedRecipeFromServer.instructions);
                setBaselineSteps(norm);
                setInitializedFromCanonical(false); // Force re-init on next effect
                
                // 3. Cache the saved pointer info
                if (savedRecordId && newRecipeId) {
                  setLastSaved({ savedId: savedRecordId, baseRecipeId: newRecipeId });
                }
                
                // 4. Update cooking context with the new fork data
                if (cookingContext.updateRecipe && currentRecipeData?.id) {
                  cookingContext.updateRecipe(currentRecipeData.id.toString(), updatedRecipeFromServer);
                  console.log('[Cook] Updated cooking context with new fork data after folder selection');
                }
              } else {
                console.error('[DEBUG] No recipe_data in server response:', saveResult);
              }
              
              // Show success toast
              showSuccess('Saved', 'Recipe saved to folder successfully', 2000);
              
              // If we're in a mise context, update the mise pointer to point to the new fork
              if (miseId && newRecipeId) {
                try {
                  const updateMiseResponse = await fetch(`${backendUrl}/api/mise/recipes/${miseId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                      userId: session.user.id,
                      originalRecipeId: newRecipeId, // Point to the new fork
                    }),
                  });
                  
                  if (!updateMiseResponse.ok) {
                    console.warn('[Cook] Failed to update mise pointer, but fork was created successfully');
                  } else {
                    console.log('[CTX] updateMiseRecipe', { miseId, newOriginalRecipeId: newRecipeId });
                  }
                } catch (error) {
                  console.warn('[Cook] Error updating mise pointer:', error);
                }
              }
              
            } catch (error) {
              console.error('[ERROR][CookScreen] Error forking recipe after folder selection:', error);
              if (typeof errorModalContext.showError === 'function') {
                errorModalContext.showError('Save Error', 'Failed to save recipe to folder. Please try again.');
              }
            }
          }}
        />

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
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
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
    fontFamily: FONT.family.graphikMedium,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
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
    borderBottomColor: '#000000',
  },
  headerTitle: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
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
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
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
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    maxWidth: '80%',
    width: 'auto',
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipTitle: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: FONT.size.body,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  tooltipText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  tooltipPreparationText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
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
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  recipeTipsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recipeTipsTitle: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
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
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  tipNumber: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.tight,
    color: COLORS.textDark,
  },
  tipContent: {
    flex: 1,
  },
  recipeTipsText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: COLORS.textDark,
  },

  // --- Draggable Steps Styles ---
  stepsContainer: {
    flex: 1,
  },
  stepItemContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#000000',
    ...SHADOWS.small,
  },
  stepItemActive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.textDark,
    ...SHADOWS.medium,
  },
  stepContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  stepToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepToggleCompleted: {
    backgroundColor: COLORS.textDark,
  },
  stepTextContainer: {
    flex: 1,
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.sm,
  },
  stepText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  highlightedText: {
    fontFamily: FONT.family.graphikMedium,
    fontWeight: '600',
    color: COLORS.textDark,
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },

  stepControls: {
    alignItems: 'center',
    gap: SPACING.xs,
    flexDirection: 'column',
  },
  editButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
  },
  deleteButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
  },
  deleteIcon: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: FONT.size.lg,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  dragHandleLeft: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    width: 24,
  },






  // --- Step Edit Modal Styles ---
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: SPACING.xxxl * 3, // Position modal higher up by default
    paddingHorizontal: SPACING.pageHorizontal,
  },
  editModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    minHeight: 200, // Prevent resizing during animation
    ...SHADOWS.large,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  editModalTitle: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
  },
  editModalInput: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    margin: SPACING.lg,
    minHeight: 80,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  editModalActions: {
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  editModalCancelButton: {
    marginBottom: SPACING.sm,
  },
  editModalCancelText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    textAlign: 'left',
  },
  editModalSaveButton: {
    marginBottom: SPACING.sm,
  },
  editModalSaveText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    textAlign: 'left',
  },

  // --- Add Step Button Styles ---
  addStepButton: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
  },
  addStepContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  addStepIcon: {
    marginTop: 1, // Slight adjustment for visual alignment
  },
  addStepText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.tight,
    color: COLORS.textMuted,
  },

});
