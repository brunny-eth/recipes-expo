import { ParseErrorCode } from '../common/types/errors';
import { isOfflineError } from './networkUtils';

/**
 * Context-aware error messages for different input types
 */
export const errorMessages = {
  INVALID_INPUT: {
    url: "That doesn't look like a valid recipe. Please try a recipe URL.",
    raw_text: "Please be a bit more descriptive. Try something like 'arugula pizza' or 'lasagna'.",
    image: "Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions.",
    images: "Those images don't appear to contain a recipe. Try uploading ones with ingredients and instructions.",
    default: "That doesn't look like a valid recipe. Please try again.",
  },
  GENERATION_FAILED: {
    url: "We couldn't parse this recipe from the website. Try a different link.",
    raw_text: "We couldn't understand the recipe you pasted. Try adding more detail.",
    image: "We couldn't find a recipe in those images. Try clearer images with steps and ingredients.",
    images: "We couldn't find a recipe in those images. Try clearer images with steps and ingredients.",
    default: "We couldn't process that recipe. Please try again.",
  },
  GENERATION_EMPTY: {
    url: "No recipe found at that URL. Please try a different link or paste the recipe text directly.",
    raw_text: "We couldn't find enough recipe details in that text. Please be more specific about what you'd like to cook - try including ingredients, cooking method, or dietary preferences.",
    image: "We couldn't find enough recipe details in those images. Please make sure the images clearly show ingredients and cooking instructions.",
    images: "We couldn't find enough recipe details in those images. Please make sure the images clearly show ingredients and cooking instructions.",
    default: "We couldn't find enough recipe details in that text. Please include ingredients and cooking instructions.",
  },
  FINAL_VALIDATION_FAILED: {
    url: "The recipe from that URL seems incomplete. Please try a different link or paste the recipe text directly.",
    raw_text: "The recipe details seem incomplete. Please add more specific ingredients or cooking steps - the more details you provide, the better we can help!",
    image: "The recipe from those images seems incomplete. Please try uploading images with more complete recipe information.",
    images: "The recipe from those images seems incomplete. Please try uploading images with more complete recipe information.",
    default: "The recipe details seem incomplete. Please add more ingredients or cooking steps and try again.",
  },
  UNSUPPORTED_INPUT_TYPE: {
    default: "Please try pasting a link with a recipe in it, or just search for a similar recipe.",
  },
} as const;

/**
 * Maps technical ParseErrorCode values to user-friendly, actionable error messages
 * Now uses context-aware message selection
 */
export function getErrorMessage(errorCode: ParseErrorCode, context?: string): string {
  const entry = errorMessages[errorCode];
  if (!entry) return "Something went wrong while processing your recipe. Please try again.";

  if (typeof entry === "string") return entry;
  if (context && context in entry) return entry[context as keyof typeof entry];
  return entry.default ?? Object.values(entry)[0];
}

/**
 * Classifies and provides user-friendly messages for different types of errors
 */
export function getNetworkErrorMessage(error: Error | string, statusCode?: number): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  
  // Network connectivity issues
  if (isOfflineError(error)) {
    return "Please check your internet connection and try again.";
  }
  
  // Backend configuration issues
  if (errorMessage.includes('Backend URL not configured')) {
    return "Recipe service is temporarily unavailable. Please try again in a few moments.";
  }
  
  // HTTP status code based messages
  if (statusCode) {
    if (statusCode === 400) {
      return "Invalid recipe format. Please check your input and try again.";
    } else if (statusCode === 404) {
      return "Recipe service not found. Please try again in a few moments.";
    } else if (statusCode === 429) {
      return "Too many requests. Please wait a moment and try again.";
    } else if (statusCode === 500) {
      return "Recipe service is having issues. Please try again in a few minutes.";
    } else if (statusCode === 503) {
      return "Recipe service is temporarily down. Please try again later.";
    } else if (statusCode >= 500) {
      return "Our recipe service is having technical difficulties. Please try again later.";
    }
  }
  
  // Supabase/Database specific errors
  if (errorMessage.includes('supabase') || 
      errorMessage.includes('database') ||
      errorMessage.includes('connection')) {
    return "Can't connect to our recipe database right now. Please check your connection and try again.";
  }
  
  // Cache/RPC specific errors
  if (errorMessage.includes('rpc') || errorMessage.includes('cache')) {
    return "Having trouble checking saved recipes. Your recipe will still be processed, but it may take a moment longer.";
  }
  
  // URL parsing/normalization errors
  if (errorMessage.includes('URL') || errorMessage.includes('normalize')) {
    return "That doesn't look like a valid recipe. Please check your input and try again.";
  }
  
  // Generic fallback
  return "Something unexpected happened when trying to process your recipe. \nIf the problem continues, try pasting recipe text directly.";
}

/**
 * Provides context-specific error messages for different submission stages
 */
export function getSubmissionErrorMessage(stage: string, error: Error | string, context?: string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // For input-related stages, delegate to getErrorMessage for context-aware messages
  if (stage === 'validation' || stage === 'parsing') {
    // Detect the specific error type from the message
    let errorCode: ParseErrorCode;
    
    if (errorMessage.includes('invalid') || errorMessage.includes('not a valid') || errorMessage.includes('doesn\'t look like') || errorMessage.includes('Invalid input provided')) {
      errorCode = ParseErrorCode.INVALID_INPUT;
    } else if (errorMessage.includes('couldn\'t process') || errorMessage.includes('generation failed') || errorMessage.includes('couldn\'t understand') || errorMessage.includes('Could not process the input provided')) {
      errorCode = ParseErrorCode.GENERATION_FAILED;
    } else if (errorMessage.includes('empty') || errorMessage.includes('not enough details') || errorMessage.includes('couldn\'t find enough')) {
      errorCode = ParseErrorCode.GENERATION_EMPTY;
    } else if (errorMessage.includes('incomplete') || errorMessage.includes('validation failed') || errorMessage.includes('seems incomplete')) {
      errorCode = ParseErrorCode.FINAL_VALIDATION_FAILED;
    } else {
      // Default to INVALID_INPUT for validation/parsing stages
      errorCode = ParseErrorCode.INVALID_INPUT;
    }
    
    return getErrorMessage(errorCode, context);
  }
  
  switch (stage) {
    case 'authentication':
      return "Authentication issue. Please try logging in again.";
      
    case 'cache_check':
      return "Having trouble checking saved recipes, but we'll still process your recipe.";
      
    case 'analytics_tracking':
      return "There was a tracking issue, but we'll still process your recipe.";
      
    case 'recipe_submission':
      if (errorMessage.includes('timeout')) {
        return "Recipe processing is taking longer than usual. Please try again.";
      }
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        return "Network issue while submitting recipe. Please check your connection and try again.";
      }
      return "We're having trouble processing that recipe. Please try again or paste the recipe text directly.";
      
    case 'result_processing':
      return "There was an issue processing the recipe results. Please try again.";
      
    case 'navigation_routing':
    case 'navigation':
      return "There was an issue during the submission process. The recipe was not processed. Please try submitting again.";
      
    default:
      return getNetworkErrorMessage(error);
  }
} 