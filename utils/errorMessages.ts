import { ParseErrorCode } from '../common/types/errors';

/**
 * Maps technical ParseErrorCode values to user-friendly, actionable error messages
 */
export function getErrorMessage(errorCode: ParseErrorCode, context?: string): string {
  switch (errorCode) {
    case ParseErrorCode.INVALID_INPUT:
      return "That doesn't look like a valid recipe. Please try a URL with an actual recipe on it, or just paste the recipe text directly. You can also just say what you want and we'll suggest a recipe for you.";
      
    case ParseErrorCode.GENERATION_FAILED:
      return "We couldn't process that recipe. Please try a URL with an actual recipe on it, or just paste the recipe text directly. You can also just say what you want and we'll suggest a recipe for you.";
      
    case ParseErrorCode.GENERATION_EMPTY:
      if (context === 'url') {
        return "No recipe found at that URL. Please try a different link or paste the recipe text directly.";
      }
      return "We couldn't find enough recipe details in that text. Please include ingredients and cooking instructions.";
      
    case ParseErrorCode.FINAL_VALIDATION_FAILED:
      if (context === 'url') {
        return "The recipe from that URL seems incomplete. Please try a different link or paste the recipe text directly.";
      }
      return "The recipe details seem incomplete. Please add more ingredients or cooking steps and try again.";
      
    case ParseErrorCode.UNSUPPORTED_INPUT_TYPE:
      return "We can only process recipe URLs or recipe text right now. Please try pasting a link or typing out the recipe.";
      
    default:
      return "Something went wrong while processing your recipe. Please try again.";
  }
}

/**
 * Classifies and provides user-friendly messages for different types of errors
 */
export function getNetworkErrorMessage(error: Error | string, statusCode?: number): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // Network connectivity issues
  if (errorMessage.includes('Network request failed') || 
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('network error')) {
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
  return "Something unexpected happened. Please try again, and if the problem continues, try pasting the recipe text instead of a URL.";
}

/**
 * Provides context-specific error messages for different submission stages
 */
export function getSubmissionErrorMessage(stage: string, error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  switch (stage) {
    case 'validation':
      return "Please enter a valid recipe URL or recipe text.";
      
    case 'cache_check':
      return "Having trouble checking saved recipes, but we'll still process your recipe.";
      
    case 'parsing':
      if (errorMessage.includes('timeout')) {
        return "Recipe processing is taking longer than usual. Please try again.";
      }
      return "We're having trouble processing that recipe. Please try again or paste the recipe text directly.";
      
    case 'navigation':
      return "Recipe processed successfully, but there was a navigation issue. Please try submitting again.";
      
    default:
      return getNetworkErrorMessage(error);
  }
} 