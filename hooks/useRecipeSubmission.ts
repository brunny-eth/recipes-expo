import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { InteractionManager } from 'react-native';
import { detectInputType } from '../server/utils/detectInputType';
import { normalizeUrl } from '../utils/normalizeUrl';
import { supabase } from '../lib/supabaseClient';
import { useErrorModal } from '../context/ErrorModalContext';
import { useAuth } from '../context/AuthContext';
import { useFreeUsage } from '../context/FreeUsageContext';
import { getNetworkErrorMessage, getSubmissionErrorMessage } from '../utils/errorMessages';
import type { 
  CacheCheckResult, 
  SubmissionState, 
  SubmissionResult, 
  ValidationResult,
  CombinedParsedRecipe
} from '../common/types';

export interface UseRecipeSubmissionReturn {
  submissionState: SubmissionState;
  submitRecipe: (input: string) => Promise<SubmissionResult>;
  validateInput: (input: string) => ValidationResult;
  checkCache: (normalizedUrl: string) => Promise<CacheCheckResult>;
  isSubmitting: boolean;
  clearState: () => void;
}

export function useRecipeSubmission(): UseRecipeSubmissionReturn {
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { showError } = useErrorModal();
  const { session } = useAuth();
  const { hasUsedFreeRecipe } = useFreeUsage();

  const validateInput = useCallback((input: string): ValidationResult => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      return {
        isValid: false,
        inputType: 'invalid',
        error: 'Please paste a recipe URL or recipe text.'
      };
    }

    const detectedType = detectInputType(trimmedInput);
    
    if (detectedType === 'invalid') {
      return {
        isValid: false,
        inputType: 'invalid',
        error: 'Please enter a valid recipe URL or recipe text.'
      };
    }

    let normalizedInput = trimmedInput;
    if (detectedType === 'url') {
      try {
        normalizedInput = normalizeUrl(trimmedInput);
      } catch (error) {
        return {
          isValid: false,
          inputType: 'invalid',
          error: 'Please enter a valid recipe URL.'
        };
      }
    }

    return {
      isValid: true,
      inputType: detectedType,
      normalizedInput
    };
  }, []);

  const checkCache = useCallback(async (normalizedUrl: string): Promise<CacheCheckResult> => {
    try {
      const { data, error } = await supabase.rpc('get_cached_recipe_by_url', {
        p_normalized_url: normalizedUrl
      });

      if (error) {
        console.error('[useRecipeSubmission] Cache check error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[useRecipeSubmission] Cache check exception:', error);
      return null;
    }
  }, []);

  const submitRecipe = useCallback(async (input: string): Promise<SubmissionResult> => {
    // Check authentication and free usage
    if (!session && hasUsedFreeRecipe) {
      return {
        success: false,
        action: 'show_validation_error',
        error: "You've already used your free recipe. Please log in to continue."
      };
    }

    setIsSubmitting(true);
    setSubmissionState('validating');

    try {
      // Step 1: Validate input
      const validation = validateInput(input);
      if (!validation.isValid) {
        setSubmissionState('idle');
        return {
          success: false,
          action: 'show_validation_error',
          error: validation.error
        };
      }

      const { inputType, normalizedInput } = validation;

      // Step 2: Handle different input types
      if (inputType === 'url') {
        setSubmissionState('checking_cache');
        
        // Check cache for URL
        const cacheResult = await checkCache(normalizedInput!);
        
        if (cacheResult) {
          // Cache hit - navigate directly to summary
          setSubmissionState('navigating');
          
          const recipe: CombinedParsedRecipe = {
            ...cacheResult.recipe_data,
            id: cacheResult.id
          };

          return new Promise((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              router.push({
                pathname: '/recipe/summary',
                params: {
                  recipeData: JSON.stringify(recipe),
                  from: '/tabs',
                },
              });
              
              resolve({
                success: true,
                action: 'navigate_to_summary',
                recipe,
                normalizedUrl: normalizedInput!
              });
            });
          });
        } else {
          // Cache miss - navigate to loading screen
          setSubmissionState('navigating');
          
          return new Promise((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              router.push({
                pathname: '/loading',
                params: { recipeInput: normalizedInput! },
              });
              
              resolve({
                success: true,
                action: 'navigate_to_loading',
                normalizedUrl: normalizedInput!
              });
            });
          });
        }
      } else if (inputType === 'raw_text') {
        setSubmissionState('parsing');
        
        // For text input, make backend call to check for fuzzy matches
        const backendUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!backendUrl) {
          throw new Error('Backend URL not configured');
        }

        const response = await fetch(`${backendUrl}/api/recipes/parse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: normalizedInput }),
        });

        if (!response.ok) {
          const errorMessage = getNetworkErrorMessage(`HTTP ${response.status}`, response.status);
          throw new Error(errorMessage);
        }

        const parseResult = await response.json();
        
        if (parseResult.cachedMatches && parseResult.cachedMatches.length > 1) {
          // Multiple matches - show selection modal
          setSubmissionState('idle');
          return {
            success: true,
            action: 'show_match_modal',
            matches: parseResult.cachedMatches
          };
        } else if (parseResult.cachedMatches && parseResult.cachedMatches.length === 1) {
          // Single match - navigate directly
          setSubmissionState('navigating');
          const singleMatch = parseResult.cachedMatches[0];
          
          return new Promise((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              router.push({
                pathname: '/recipe/summary',
                params: {
                  recipeData: JSON.stringify(singleMatch.recipe),
                  from: '/tabs',
                },
              });
              
              resolve({
                success: true,
                action: 'navigate_to_summary',
                recipe: singleMatch.recipe
              });
            });
          });
        } else {
          // No matches - navigate to loading screen for full parsing
          setSubmissionState('navigating');
          
          return new Promise((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              router.push({
                pathname: '/loading',
                params: { recipeInput: normalizedInput! },
              });
              
              resolve({
                success: true,
                action: 'navigate_to_loading'
              });
            });
          });
        }
      } else {
        throw new Error('Unsupported input type');
      }
    } catch (error) {
      console.error('[useRecipeSubmission] Submission error:', error);
      const currentState = submissionState;
      setSubmissionState('idle');
      
      // Get context-specific error message based on what stage failed
      const errorMessage = getSubmissionErrorMessage(currentState, error instanceof Error ? error : String(error));
      
      return {
        success: false,
        action: 'show_validation_error',
        error: errorMessage
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [session, hasUsedFreeRecipe, validateInput, checkCache, router]);

  const clearState = useCallback(() => {
    setSubmissionState('idle');
    setIsSubmitting(false);
  }, []);

  return {
    submissionState,
    submitRecipe,
    validateInput,
    checkCache,
    isSubmitting,
    clearState
  };
} 