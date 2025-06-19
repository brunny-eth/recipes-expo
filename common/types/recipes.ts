export type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: SubstitutionSuggestion[] | null;
  preparation?: string | null;
};

export type CombinedParsedRecipe = {
  title: string | null;
  description?: string | null;
  image?: string | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  ingredients: StructuredIngredient[] | null;
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
};

export type SubstitutionSuggestion = {
  name: string;
  description?: string | null;
  amount?: string | number | null;
  unit?: string | null;
}; 