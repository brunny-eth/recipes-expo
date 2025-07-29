import { CombinedParsedRecipe } from '../../common/types';
import { createLogger } from '../lib/logger';

const logger = createLogger('finalValidateRecipe');

/**
 * Validates the final parsed recipe object and logs warnings or info for missing fields.
 * @param recipe The recipe object to validate.
 * @param requestId A unique identifier for tracing the request.
 */
export function finalValidateRecipe(recipe: CombinedParsedRecipe | null, requestId: string): { ok: boolean; reasons?: string[] } {
  const reasons: string[] = [];

  if (!recipe) {
    logger.error({ requestId }, 'Final validation failed: Recipe object is null');
    return { ok: false, reasons: ['Recipe object is null'] };
  }

  logger.info({ 
    requestId, 
    title: recipe.title,
    hasIngredientGroups: !!recipe.ingredientGroups,
    ingredientGroupsCount: recipe.ingredientGroups?.length || 0,
    hasInstructions: !!recipe.instructions,
    instructionsCount: recipe.instructions?.length || 0,
    hasTitle: !!recipe.title
  }, 'Performing final validation on parsed recipe data');

  // Validate ingredient groups
  if (!recipe.ingredientGroups || recipe.ingredientGroups.length < 1) {
    logger.warn({ 
      requestId, 
      count: recipe.ingredientGroups?.length || 0,
      title: recipe.title 
    }, 'Final validation: Ingredient groups are missing or empty');
    reasons.push('Missing or empty ingredient groups');
  } else {
    // Check if at least one group has ingredients
    const totalIngredients = recipe.ingredientGroups.reduce((total, group) => total + (group.ingredients?.length || 0), 0);
    if (totalIngredients < 1) {
      logger.warn({ 
        requestId, 
        totalIngredients,
        title: recipe.title 
      }, 'Final validation: No ingredients found in any group');
      reasons.push('No ingredients found in ingredient groups');
    }
  }

  if (!recipe.instructions || recipe.instructions.length < 1) {
    logger.warn({ 
      requestId, 
      count: recipe.instructions?.length || 0,
      title: recipe.title 
    }, 'Final validation: Instructions are missing or too few');
    reasons.push('Missing or too few instructions');
  }
  
  if (!recipe.title) {
    logger.warn({ requestId }, 'Final validation: Missing title');
    reasons.push('Missing title');
  }

  // Log informational warnings for optional fields, but don't fail validation for them.
  const optionalFields: (keyof CombinedParsedRecipe)[] = ['recipeYield', 'prepTime', 'cookTime', 'totalTime'];
  const missingOptionalFields = optionalFields.filter(field => !recipe[field]);

  if (missingOptionalFields.length > 0) {
    logger.info({ 
      requestId, 
      missingFields: missingOptionalFields,
      title: recipe.title 
    }, 'Final validation: Optional informational fields are missing');
  }

  if (reasons.length > 0) {
    logger.error({ 
      requestId, 
      reasons,
      title: recipe.title 
    }, 'Final validation failed');
    return { ok: false, reasons };
  }

  logger.info({ 
    requestId, 
    title: recipe.title 
  }, 'Final validation passed successfully');
  return { ok: true };
} 