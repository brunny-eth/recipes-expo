import { Database } from './database.types';

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
  description?: string | null;
  image?: string | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  ingredientGroups: IngredientGroup[] | null;
  instructions: string[] | null;
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
  created_at?: string;
  last_processed_at?: string;
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