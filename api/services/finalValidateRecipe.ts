import { CombinedParsedRecipe } from '../types';
import logger from '../lib/logger';

/**
 * Validates the final parsed recipe object and logs warnings or info for missing fields.
 * @param recipe The recipe object to validate.
 * @param requestId A unique identifier for tracing the request.
 */
export function finalValidateRecipe(recipe: CombinedParsedRecipe | null, requestId: string): void {
  if (!recipe) {
    // This case should ideally not be hit if called correctly, but it's a safe guard.
    logger.warn({ requestId }, 'finalValidateRecipe was called with a null recipe.');
    return;
  }

  logger.info({
    requestId,
    title: recipe.title || undefined,
    sourceUrl: recipe.sourceUrl || undefined
  }, 'Performing final validation on parsed recipe data.');

  // Log a warning if title is missing or too short.
  if (!recipe.title || recipe.title.length < 3) {
    logger.warn({ requestId, title: recipe.title || 'NULL' }, 'Final validation: Title is missing or too short.');
  }

  // Log a warning if ingredients are missing or fewer than 2 entries.
  const ingredientCount = recipe.ingredients?.length ?? 0;
  if (ingredientCount < 2) {
    logger.warn({ requestId, count: ingredientCount }, 'Final validation: Ingredients are missing or have fewer than 2 entries.');
  }

  // Log a warning if instructions are missing or fewer than 2 entries.
  const instructionCount = recipe.instructions?.length ?? 0;
  if (instructionCount < 2) {
    logger.warn({ requestId, count: instructionCount }, 'Final validation: Instructions are missing or have fewer than 2 entries.');
  }

  // Log an info if recipeYield or any of the time fields are missing.
  const missingInfoFields: string[] = [];
  if (!recipe.recipeYield) missingInfoFields.push('recipeYield');
  if (!recipe.prepTime) missingInfoFields.push('prepTime');
  if (!recipe.cookTime) missingInfoFields.push('cookTime');
  if (!recipe.totalTime) missingInfoFields.push('totalTime');

  if (missingInfoFields.length > 0) {
    logger.info({ requestId, missingFields: missingInfoFields }, 'Final validation: Optional informational fields are missing.');
  }
} 