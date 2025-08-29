import { ParseErrorCode } from '../common/types/errors';
import { isOfflineError } from './networkUtils';

/**
 * Maps technical ParseErrorCode values to user-friendly, actionable error messages
 */
export function getErrorMessage(errorCode: ParseErrorCode, context?: string): string {
  switch (errorCode) {
    case ParseErrorCode.INVALID_INPUT:
      if (context === 'image' || context === 'images') {
        return "Those images don't appear to contain a recipe. Please try uploading images that show recipe ingredients and instructions.";
      }
      if (context === 'raw_text') {
        return "Please be a bit more descriptive so we can make you the best recipe! Try adding details like 'chicken empanadas with cheese' or 'vegetarian empanadas with spinach'.";
      }
      return "That doesn't look like a valid recipe. \n\n Please try a URL with an actual recipe in it, or just paste the recipe text directly.";
      
    case ParseErrorCode.GENERATION_FAILED:
      if (context === 'image' || context === 'images') {
        return "We couldn't find a recipe in those images. Please try uploading clearer images that show recipe ingredients and cooking steps.";
      }
      if (context === 'raw_text') {
        return "We couldn't process that recipe. Please be a bit more descriptive so we can make you the best recipe! Try adding details like cooking method or main ingredients.";
      }
      return "We couldn't process that recipe. \n\n Please try a URL with an actual recipe on it, or just paste the recipe text directly.";
      
    case ParseErrorCode.GENERATION_EMPTY:
      if (context === 'image' || context === 'images') {
        return "We couldn't find enough recipe details in those images. Please make sure the images clearly show ingredients and cooking instructions.";
      }
      if (context === 'url') {
        return "No recipe found at that URL. Please try a different link or paste the recipe text directly.";
      }
      if (context === 'raw_text') {
        return "We couldn't find enough recipe details in that text. Please be more specific about what you'd like to cook - try including ingredients, cooking method, or dietary preferences.";
      }
      return "We couldn't find enough recipe details in that text. Please include ingredients and cooking instructions.";
      
    case ParseErrorCode.FINAL_VALIDATION_FAILED:
      if (context === 'image' || context === 'images') {
        return "The recipe from those images seems incomplete. Please try uploading images with more complete recipe information.";
      }
      if (context === 'url') {
        return "The recipe from that URL seems incomplete. Please try a different link or paste the recipe text directly.";
      }
      if (context === 'raw_text') {
        return "The recipe details seem incomplete. Please add more specific ingredients or cooking steps - the more details you provide, the better we can help!";
      }
      return "The recipe details seem incomplete. Please add more ingredients or cooking steps and try again.";
      
    case ParseErrorCode.UNSUPPORTED_INPUT_TYPE:
      return "Please try pasting a link with a recipe in it,or just search for a similar recipe.";
      
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
export function getSubmissionErrorMessage(stage: string, error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  switch (stage) {
    case 'validation':
      return "Please enter a valid recipe URL or recipe text.";
      
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
      
    case 'parsing':
      if (errorMessage.includes('timeout')) {
        return "Recipe processing is taking longer than usual. Please try again.";
      }
      return "We're having trouble processing that recipe. Please try again or paste the recipe text directly.";
      
    default:
      return getNetworkErrorMessage(error);
  }
} 