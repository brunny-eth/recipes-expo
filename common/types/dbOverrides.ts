/**
 * Database type overrides - frozen stable types from before UI/UX refactor
 * 
 * This file contains the stable, working database types from commit aee476d
 * (before the comprehensive UI/UX refactor that introduced type inconsistencies).
 * 
 * Use these types instead of the auto-generated database.types.ts for recipe-related
 * operations to avoid the infinite loop of type errors.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================================
// RECIPE TYPES - STABLE FROM PRE-REFACTOR
// ============================================================================

export type InstructionStep = {
  id: string;        // stable UUID per step
  text: string;      // the instruction
  note?: string;     // ≤100 chars, optional
};

export type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: SubstitutionSuggestion[] | null;
  preparation?: string | null;
};

export type IngredientGroup = {
  name: string;
  ingredients: StructuredIngredient[];
};

export type CombinedParsedRecipe = {
  id?: number;
  title: string | null;
  shortDescription?: string | null;
  description?: string | null;
  image?: string | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  ingredientGroups: IngredientGroup[] | null;
  instructions: InstructionStep[] | string[] | null; // back-compat
  substitutions_text: string | null;
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: {
    calories?: string | null;
    protein?: string | null;
    [key: string]: any;
  } | null;
  tips?: string | null;
  created_at?: string;
  last_processed_at?: string;
  // Database metadata for fork vs patch logic
  parent_recipe_id?: number | null;
  source_type?: string | null;
};

export type SubstitutionSuggestion = {
  name: string;
  description?: string | null;
  amount?: string | number | null;
  unit?: string | null;
};

// Alias for backward compatibility
export type RecipeData = CombinedParsedRecipe;

// ============================================================================
// DATABASE TABLE OVERRIDES - STABLE TYPES
// ============================================================================

/**
 * Override for processed_recipes_cache table
 * Fixes the embedding type inconsistency and ensures recipe_data uses our stable type
 */
export type ProcessedRecipesCacheRow = {
  id: number;
  created_at: string; // Fixed: not nullable in practice
  last_processed_at: string; // Fixed: not nullable in practice
  embedding: string | null; // Fixed: stored as string in DB, not number[]
  is_user_modified: boolean | null;
  normalized_url: string | null;
  parent_recipe_id: number | null;
  recipe_data: CombinedParsedRecipe | null; // Using our stable type
  source_type: string | null;
  updated_at: string | null;
  url: string;
};

export type ProcessedRecipesCacheInsert = {
  id?: number;
  created_at?: string | null;
  last_processed_at?: string | null;
  embedding?: string | null; // Fixed: string, not number[]
  is_user_modified?: boolean | null;
  normalized_url?: string | null;
  parent_recipe_id?: number | null;
  recipe_data?: CombinedParsedRecipe | null;
  source_type?: string | null;
  updated_at?: string | null;
  url: string;
};

export type ProcessedRecipesCacheUpdate = {
  id?: number;
  created_at?: string | null;
  last_processed_at?: string | null;
  embedding?: string | null; // Fixed: string, not number[]
  is_user_modified?: boolean | null;
  normalized_url?: string | null;
  parent_recipe_id?: number | null;
  recipe_data?: CombinedParsedRecipe | null;
  source_type?: string | null;
  updated_at?: string | null;
  url?: string;
};

/**
 * Override for user_saved_recipes table
 * Maintains backward compatibility with old ID structure
 */
export type UserSavedRecipesRow = {
  id: number; // Fixed: was number in old schema, more reliable
  user_id: string;
  base_recipe_id: number;
  folder_id: number | null;
  title_override: string | null;
  applied_changes: Json | null;
  display_order: number;
  created_at: string;
  updated_at?: string; // Optional as in old schema
  notes?: string | null; // New field, optional
};

export type UserSavedRecipesInsert = {
  user_id: string;
  base_recipe_id: number;
  folder_id?: number | null;
  title_override?: string | null;
  applied_changes?: Json | null;
  display_order?: number;
  notes?: string | null;
};

export type UserSavedRecipesUpdate = {
  folder_id?: number | null;
  title_override?: string | null;
  applied_changes?: Json | null;
  display_order?: number;
  notes?: string | null;
};

// ============================================================================
// HELPER TYPES FOR COMMON OPERATIONS
// ============================================================================

/**
 * Type for recipe data when working with embeddings
 * Ensures embedding is treated as string (as stored in DB)
 */
export type RecipeWithEmbedding = ProcessedRecipesCacheRow & {
  embedding: string; // Non-null embedding
};

/**
 * Type for recipe operations that need consistent date handling
 */
export type RecipeWithDates = ProcessedRecipesCacheRow & {
  created_at: string; // Non-null
  last_processed_at: string; // Non-null
};

// ============================================================================
// HELPER FUNCTIONS FOR SAFE TYPE CASTING
// ============================================================================

/**
 * Safely cast Json from Supabase to CombinedParsedRecipe
 * Use this when pulling recipe_data from the database
 */
export function asRecipeData(json: Json): CombinedParsedRecipe {
  return json as CombinedParsedRecipe;
}

/**
 * Safely cast nullable Json from Supabase to CombinedParsedRecipe
 * Returns null if input is null/undefined
 */
export function asRecipeDataOrNull(json: Json | null | undefined): CombinedParsedRecipe | null {
  if (!json) return null;
  return json as CombinedParsedRecipe;
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Re-export common types for easy migration
export {
  type InstructionStep as LegacyInstructionStep,
  type StructuredIngredient as LegacyStructuredIngredient,
  type IngredientGroup as LegacyIngredientGroup,
  type SubstitutionSuggestion as LegacySubstitutionSuggestion,
};
