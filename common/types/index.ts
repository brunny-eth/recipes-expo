export * from './recipes';
export * from './llm';
export * from './database.types';
export * from './errors';
// Export stable database type overrides for direct use (excluding Json to avoid conflict)
export {
  type CombinedParsedRecipe,
  type InstructionStep,
  type StructuredIngredient,
  type IngredientGroup,
  type SubstitutionSuggestion,
  type RecipeData,
  type ProcessedRecipesCacheRow,
  type ProcessedRecipesCacheInsert,
  type ProcessedRecipesCacheUpdate,
  type UserSavedRecipesRow,
  type UserSavedRecipesInsert,
  type UserSavedRecipesUpdate,
  type RecipeWithEmbedding,
  type RecipeWithDates,
  asRecipeData,
  asRecipeDataOrNull
} from './dbOverrides';

// Import types that we need to reference in this file
import { CombinedParsedRecipe } from './recipes';

/**
 * Result from a quick cache check using the get_cached_recipe_by_url RPC
 * Returns the complete recipe if found, or null if not found/error
 */
export type CacheCheckResult = CombinedParsedRecipe | null;

/**
 * State management for recipe submission flow
 */
export type SubmissionState = 'idle' | 'validating' | 'checking_cache' | 'parsing' | 'navigating';

/**
 * Result from the submission flow logic
 */
export type SubmissionResult = {
  success: boolean;
  action: 'navigate_to_summary' | 'navigate_to_loading' | 'show_validation_error' | 'show_match_modal';
  recipe?: CombinedParsedRecipe;
  matches?: { recipe: CombinedParsedRecipe; similarity: number; }[];
  error?: string;
  normalizedUrl?: string;
  inputType?: 'url' | 'raw_text' | 'video';
};

/**
 * Input validation result
 */
export type ValidationResult = {
  isValid: boolean;
  inputType: 'url' | 'raw_text' | 'image' | 'video' | 'invalid';
  normalizedInput?: string;
  error?: string;
}; 