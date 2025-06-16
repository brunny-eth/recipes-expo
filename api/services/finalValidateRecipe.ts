import { CombinedParsedRecipe } from '../types';
import logger from '../lib/logger';

/**
 * Validates the final parsed recipe object and logs warnings or info for missing fields.
 * @param recipe The recipe object to validate.
 * @param requestId A unique identifier for tracing the request.
 */
export function finalValidateRecipe(recipe: CombinedParsedRecipe | null, requestId: string): { ok: boolean; reasons?: string[] } {
  const reasons: string[] = [];

  if (!recipe) {
    return { ok: false, reasons: ['Recipe object is null'] };
  }

  logger.info({ requestId, title: recipe.title }, 'Performing final validation on parsed recipe data.');

  if (!recipe.ingredients || recipe.ingredients.length < 1) {
    logger.warn({ requestId, count: recipe.ingredients?.length || 0 }, 'Final validation: Ingredients are missing or too few.');
    reasons.push('Missing or too few ingredients');
  }

  if (!recipe.instructions || recipe.instructions.length < 1) {
    logger.warn({ requestId, count: recipe.instructions?.length || 0 }, 'Final validation: Instructions are missing or too few.');
    reasons.push('Missing or too few instructions');
  }
  
  if (!recipe.title) {
    logger.warn({ requestId }, 'Final validation: Missing title.');
    reasons.push('Missing title');
  }

  // Log informational warnings for optional fields, but don't fail validation for them.
  const optionalFields: (keyof CombinedParsedRecipe)[] = ['recipeYield', 'prepTime', 'cookTime', 'totalTime'];
  const missingOptionalFields = optionalFields.filter(field => !recipe[field]);

  if (missingOptionalFields.length > 0) {
    logger.info({ requestId, missingFields: missingOptionalFields }, 'Final validation: Optional informational fields are missing.');
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  return { ok: true };
} 