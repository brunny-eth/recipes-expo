import { useState, useCallback } from 'react';
import { detectInputType } from '../server/utils/detectInputType';
import { normalizeUrl } from '../utils/normalizeUrl';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getNetworkErrorMessage, getSubmissionErrorMessage, getErrorMessage } from '../utils/errorMessages';
import { normalizeAppError } from '../utils/normalizeAppError';
import { ParseErrorCode } from '../common/types/errors';
import type { 
  CacheCheckResult, 
  SubmissionState, 
  SubmissionResult, 
  ValidationResult,
  CombinedParsedRecipe
} from '../common/types';

export interface SubmitRecipeOptions {
  isDishNameSearch?: boolean;
}

export interface UseRecipeSubmissionReturn {
  submissionState: SubmissionState;
  submitRecipe: (input: string, options?: SubmitRecipeOptions) => Promise<SubmissionResult>;
  validateInput: (input: string) => ValidationResult;
  checkCache: (normalizedUrl: string) => Promise<CacheCheckResult>;
  isSubmitting: boolean;
  clearState: () => void;
}

export function useRecipeSubmission(): UseRecipeSubmissionReturn {
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session } = useAuth();

  const validateInput = useCallback((input: string): ValidationResult => {
    const trimmedInput = input.trim();
    console.log(`[useRecipeSubmission] validateInput: Validating input: '${trimmedInput}'`); // NEW LOG
    
    if (!trimmedInput) {
      console.log('[useRecipeSubmission] validateInput: Input is empty, returning invalid.'); // NEW LOG
      return {
        isValid: false,
        inputType: 'invalid',
        error: getErrorMessage(ParseErrorCode.INVALID_INPUT, 'url') // Default to url context for empty input
      };
    }

    const detectedType = detectInputType(trimmedInput);
    console.log(`[useRecipeSubmission] validateInput: Detected type by detectInputType: ${detectedType}`); // NEW LOG
    
    if (detectedType === 'invalid') {
      console.log('[useRecipeSubmission] validateInput: Input classified as invalid, returning error.'); // NEW LOG
      return {
        isValid: false,
        inputType: 'invalid',
        error: getErrorMessage(ParseErrorCode.INVALID_INPUT, 'url') // Default to url context for invalid input
      };
    }

    console.log('[useRecipeSubmission] validateInput: Input is valid, returning success.'); // NEW LOG
    
    return {
      isValid: true,
      inputType: detectedType,
      normalizedInput: detectedType === 'url' ? normalizeUrl(trimmedInput) : trimmedInput
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

  const submitRecipe = useCallback(async (input: string, options?: SubmitRecipeOptions): Promise<SubmissionResult> => {
    const { isDishNameSearch = false } = options || {};
    // Check authentication - users must be logged in to use the app
    if (!session) {
      return {
        success: false,
        action: 'show_validation_error',
        error: "Please log in to continue using the app."
      };
    }

    setIsSubmitting(true);
    setSubmissionState('validating');

    // Declare inputType outside try block so it's available in catch block
    let inputType: string = 'url'; // Default fallback

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

      const validationResult = validation;
      inputType = validationResult.inputType;
      const { normalizedInput } = validationResult;

      // Step 2: Handle different input types
      if (inputType === 'url' || inputType === 'video') {
        setSubmissionState('checking_cache');
        
        // For URLs and Videos, we check the cache first.
        const cacheResult = await checkCache(normalizedInput!);
        
        // Validate cache result has complete recipe data
        if (cacheResult && cacheResult.id) {
          // Cache hit - return recipe for navigation to summary
          setSubmissionState('idle');
          
          console.log('[useRecipeSubmission] submitRecipe: Cache hit, returning cached recipe for navigation');
          return {
            success: true,
            action: 'navigate_to_summary',
            recipe: cacheResult
          };
        } else {
          // Cache miss - return normalized URL for navigation to loading
          setSubmissionState('idle');
          
          return {
            success: true,
            action: 'navigate_to_loading',
            normalizedUrl: normalizedInput!,
            inputType: inputType
          };
        }
      } else if (inputType === 'raw_text') {
        setSubmissionState('parsing');

        // For text input, make backend call to get intelligent response
        const backendUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!backendUrl) {
          throw new Error('Backend URL not configured');
        }

        console.log('[useRecipeSubmission] Making backend request to:', `${backendUrl}/api/recipes/parse`);
        console.log('[useRecipeSubmission] Request payload:', { input: normalizedInput, isDishNameSearch });
        console.log("Parse request userId:", session?.user?.id);

        const response = await fetch(`${backendUrl}/api/recipes/parse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            input: normalizedInput, 
            isDishNameSearch,
            userId: session?.user?.id ?? null
          }),
        });

        console.log('[useRecipeSubmission] Backend response status:', response.status);
        console.log('[useRecipeSubmission] Backend response ok:', response.ok);

        if (!response.ok) {
          // For parsing endpoints, treat 4xx/5xx as parsing failures, not network errors
          if (response.status === 400 || response.status === 422) {
            throw new Error('Invalid input provided');
          } else if (response.status === 500) {
            throw new Error('Could not process the input provided');
          } else {
            // True network/service errors (503, 502, etc.)
            const errorMessage = getNetworkErrorMessage(`HTTP ${response.status}`, response.status);
            throw new Error(errorMessage);
          }
        }

        const parseResult = await response.json();

        // Debug logging to understand what the backend returns
        console.log('[useRecipeSubmission] Backend request successful - parse result:', {
          hasRecipe: !!parseResult.recipe,
          hasCachedMatches: !!parseResult.cachedMatches,
          cachedMatchesLength: parseResult.cachedMatches?.length || 0,
          fromCache: parseResult.fromCache,
          fetchMethodUsed: parseResult.fetchMethodUsed,
          hasError: !!parseResult.error,
          isDishNameSearch
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

        // Different priority handling based on input type
        if (isDishNameSearch) {
          // For dish name searches, prioritize showing matches first
          console.log('[useRecipeSubmission] Dish name search - prioritizing matches');

          // Priority 1: Multiple matches - show selection modal (dish name searches should show options)
          if (parseResult.cachedMatches && parseResult.cachedMatches.length > 0) {
            setSubmissionState('idle');
            console.log('[useRecipeSubmission] Dish name search - showing match modal');

            return {
              success: true,
              action: 'show_match_modal',
              matches: parseResult.cachedMatches
            };
          }

          // Priority 2: Direct recipe hit (fallback for dish name)
          if (parseResult.recipe) {
            setSubmissionState('idle');
            console.log('[useRecipeSubmission] Dish name search - direct recipe hit');

            return {
              success: true,
              action: 'navigate_to_summary',
              recipe: parseResult.recipe
            };
          }
        } else {
          // For raw text input, prioritize direct parsing
          console.log('[useRecipeSubmission] Raw text input - prioritizing direct parsing');

          // Priority 1: Direct recipe hit (raw text should parse directly)
          if (parseResult.recipe) {
            setSubmissionState('idle');
            console.log('[useRecipeSubmission] Raw text - direct recipe hit');

            return {
              success: true,
              action: 'navigate_to_summary',
              recipe: parseResult.recipe
            };
          }

          // Priority 2: Multiple matches - show selection modal (fallback for raw text)
          if (parseResult.cachedMatches && parseResult.cachedMatches.length > 1) {
            setSubmissionState('idle');
            console.log('[useRecipeSubmission] Raw text - showing match modal as fallback');

            return {
              success: true,
              action: 'show_match_modal',
              matches: parseResult.cachedMatches
            };
          }
        }

        // Priority 3: No matches or unclear result - proceed to full parsing (both cases)
        setSubmissionState('idle');
        console.log('[useRecipeSubmission] No clear matches - returning for navigation to loading');

        return {
          success: true,
          action: 'navigate_to_loading',
          normalizedUrl: normalizedInput,
          inputType: inputType
        };
      } else {
        throw new Error('Unsupported input type');
      }
    } catch (error) {
      console.error('[useRecipeSubmission] Submission error:', error);
      
      // Capture current submission state before resetting it
      const currentStage = submissionState;
      setSubmissionState('idle');
      
      // Map inputType to context for proper error message selection
      const context = inputType === 'url' || inputType === 'video' ? 'url' :
                     inputType === 'raw_text' ? 'raw_text' :
                     inputType === 'image' ? 'image' : 'url';
      
      console.log('[useRecipeSubmission] Error context mapping:', { inputType, context, currentStage, submissionState: 'idle' });
      
      const normalized = normalizeAppError(error, { stage: currentStage, context });
      return {
        success: false,
        action: 'show_validation_error',
        error: normalized.message,
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [session, validateInput, checkCache, submissionState]);

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