import { useState, useCallback } from 'react';
import { detectInputType } from '../server/utils/detectInputType';
import { normalizeUrl } from '../utils/normalizeUrl';
import { supabase } from '../lib/supabaseClient';
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
  const { session } = useAuth();
  const { hasUsedFreeRecipe } = useFreeUsage();

  const validateInput = useCallback((input: string): ValidationResult => {
    const trimmedInput = input.trim();
    console.log(`[useRecipeSubmission] validateInput: Validating input: '${trimmedInput}'`); // NEW LOG
    
    if (!trimmedInput) {
      console.log('[useRecipeSubmission] validateInput: Input is empty, returning invalid.'); // NEW LOG
      return {
        isValid: false,
        inputType: 'invalid',
        error: 'Please paste a recipe URL or recipe text.'
      };
    }

    const detectedType = detectInputType(trimmedInput);
    console.log(`[useRecipeSubmission] validateInput: Detected type by detectInputType: ${detectedType}`); // NEW LOG
    
    if (detectedType === 'invalid') {
      console.log('[useRecipeSubmission] validateInput: Input classified as invalid, returning error.'); // NEW LOG
      return {
        isValid: false,
        inputType: 'invalid',
        error: 'Please enter a valid recipe URL or recipe text.'
      };
    }

    let normalizedInput = trimmedInput;
    if (detectedType === 'url' || detectedType === 'video') {
      try {
        normalizedInput = normalizeUrl(trimmedInput);
        console.log(`[useRecipeSubmission] validateInput: URL normalized to: ${normalizedInput}`); // NEW LOG
      } catch (error) {
        console.log('[useRecipeSubmission] validateInput: URL normalization failed, returning invalid.', error); // NEW LOG
        return {
          isValid: false,
          inputType: 'invalid',
          error: 'Please enter a valid recipe URL.'
        };
      }
    }

    console.log('[useRecipeSubmission] validateInput: Returning valid result.'); // NEW LOG
    return {
      isValid: true,
      inputType: detectedType,
      normalizedInput
    };
  }, []);

  const checkCache = useCallback(async (normalizedUrl: string): Promise<CacheCheckResult> => {
    console.log(`[useRecipeSubmission] checkCache: Checking cache for URL: ${normalizedUrl}`);
    try {
      const { data, error } = await supabase.rpc('get_cached_recipe_by_url', {
        p_normalized_url: normalizedUrl
      });

      // ------------------- DIAGNOSTIC LOGS (KEEP FOR CONFIRMATION, CAN BE REMOVED LATER) -------------------
      console.log(`[useRecipeSubmission] checkCache: Type of 'data' from Supabase query: ${typeof data}`);
      console.log(`[useRecipeSubmission] checkCache: Is 'data' an Array from Supabase query? ${Array.isArray(data)}`);
      console.log(`[useRecipeSubmission] checkCache: Raw 'data' content (full) from Supabase query:`, data);
      // ------------------- DIAGNOSTIC LOGS END -------------------

      if (error) {
        console.error('[useRecipeSubmission] Cache check error:', error);
        return null;
      }

      // --- REVISED MODIFICATION START ---
      // Check if data is an array and has at least one element, or if it's already an object (ideal .single() behavior)
      let actualRowData: any = null;
      if (Array.isArray(data) && data.length > 0) {
        actualRowData = data[0]; // Get the single object from the array
        console.log('[useRecipeSubmission] checkCache: Data was array, extracted first element.');
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        actualRowData = data; // Data is already the single object
        console.log('[useRecipeSubmission] checkCache: Data was already a single object (expected .single() behavior).');
      }

      if (actualRowData) {
        console.log('[useRecipeSubmission] checkCache: Cache hit! Raw row data found:', JSON.stringify(actualRowData));

        // Assume recipe content is in a 'recipe_data' column (JSONB type) within the actualRowData
        const extractedRecipeContent = actualRowData.recipe_data;
        const cachedRecipeId = actualRowData.id; // Get the ID from the top-level actualRowData

        if (extractedRecipeContent && typeof extractedRecipeContent === 'object' && cachedRecipeId) {
          // Reconstruct the CombinedParsedRecipe, ensuring 'id' is included at the top level
          const fullCachedRecipe: CombinedParsedRecipe = {
            ...(extractedRecipeContent as CombinedParsedRecipe), // Cast nested content
            id: cachedRecipeId, // Override or add the correct ID
          };
          console.log('[useRecipeSubmission] checkCache: Successfully extracted recipe from cache:', JSON.stringify(fullCachedRecipe));

          return fullCachedRecipe;
        } else {
          // Fallback: Data was found but 'recipe_data' was missing/malformed or ID was missing.
          console.warn('[useRecipeSubmission] checkCache: Valid row data found, but could not extract valid CombinedParsedRecipe from element, treating as cache miss.');
          console.log('[useRecipeSubmission] checkCache: Returning null (fallback)');
          return null;
        }
      } else {
        // This covers cases where data is null, undefined, or an empty array
        console.log('[useRecipeSubmission] checkCache: Cache miss for URL (no data, null, or empty array).');
        return null;
      }
      // --- REVISED MODIFICATION END ---
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
      if (inputType === 'url' || inputType === 'video') {
        setSubmissionState('checking_cache');
        
        // For URLs and Videos, we check the cache first.
        const cacheResult = await checkCache(normalizedInput!);
        
        // Validate cache result has complete recipe data
        if (cacheResult && cacheResult.id) {
          // Cache hit - return recipe for navigation to summary
          setSubmissionState('idle');
          
          const recipe: CombinedParsedRecipe = cacheResult;

          const submissionResult = {
            success: true,
            action: 'navigate_to_summary' as const,
            recipe,
            normalizedUrl: normalizedInput!
          };
          console.log('[useRecipeSubmission] submitRecipe: Final SubmissionResult before return (cache hit):', JSON.stringify(submissionResult)); // NEW LOG
          return submissionResult;
        } else {
          // Cache miss - return normalized URL for navigation to loading
          setSubmissionState('idle');
          
          const submissionResult = {
            success: true,
            action: 'navigate_to_loading' as const,
            normalizedUrl: normalizedInput!,
            inputType: inputType
          };
          console.log('[useRecipeSubmission] submitRecipe: Final SubmissionResult before return (cache miss):', JSON.stringify(submissionResult)); // NEW LOG
          return submissionResult;
        }
      } else if (inputType === 'raw_text') {
        setSubmissionState('parsing');
        
        // For text input, make backend call to get intelligent response
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
        
        // Debug logging to understand what the backend returns
        console.log('[useRecipeSubmission] Parse result:', {
          hasRecipe: !!parseResult.recipe,
          hasCachedMatches: !!parseResult.cachedMatches,
          cachedMatchesLength: parseResult.cachedMatches?.length || 0,
          fromCache: parseResult.fromCache,
          fetchMethodUsed: parseResult.fetchMethodUsed
        });
        
        // Handle error responses
        if (parseResult.error) {
          setSubmissionState('idle');
          return {
            success: false,
            action: 'show_validation_error',
            error: parseResult.error.message || 'Failed to process recipe'
          };
        }
        
        // Priority 1: Direct recipe hit (either new parse OR single fuzzy match)
        if (parseResult.recipe) {
          setSubmissionState('idle');
          console.log('[useRecipeSubmission] Direct recipe hit - returning for navigation to summary');
          
          return {
            success: true,
            action: 'navigate_to_summary',
            recipe: parseResult.recipe
          };
        }
        
        // Priority 2: Multiple matches - show selection modal
        if (parseResult.cachedMatches && parseResult.cachedMatches.length > 1) {
          setSubmissionState('idle');
          console.log('[useRecipeSubmission] Multiple matches - showing modal');
          
          return {
            success: true,
            action: 'show_match_modal',
            matches: parseResult.cachedMatches
          };
        }
        
        // Priority 3: No matches or unclear result - proceed to full parsing
        setSubmissionState('idle');
        console.log('[useRecipeSubmission] No clear matches - returning for navigation to loading');
        
        return {
          success: true,
          action: 'navigate_to_loading',
          normalizedUrl: normalizedInput!,
          inputType: inputType
        };
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
  }, [session, hasUsedFreeRecipe, validateInput, checkCache]);

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