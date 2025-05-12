// api/types.ts

// Structured Ingredient Type
export type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: SubstitutionSuggestion[] | null;
};

// Combined Parsed Recipe Type
export type CombinedParsedRecipe = {
  title: string | null;
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

// Substitution Suggestion Type
export type SubstitutionSuggestion = {
  name: string;
  description?: string | null;
  amount?: string | number | null;
  unit?: string | null;
};

// Gemini Model Type
import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai";
export type GeminiModel = ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']>;
