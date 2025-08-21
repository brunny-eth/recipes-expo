import { Database } from './database.types';

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

export type Recipe = Database['public']['Tables']['recipes']['Row'] & {
  ingredients: Database['public']['Tables']['ingredients']['Row'][];
  instructions: { step: number; text: string }[];
}; 