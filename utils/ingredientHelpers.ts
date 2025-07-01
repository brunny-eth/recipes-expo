import { StructuredIngredient, IngredientGroup } from '../common/types/recipes';

/**
 * Coerces an array of mixed ingredient types (string or StructuredIngredient objects)
 * into a standardized array of StructuredIngredient objects.
 *
 * - Converts string ingredients to StructuredIngredient format with default null values.
 * - Ensures object ingredients have essential fields (name, amount, unit, suggested_substitutions), defaulting to null if missing.
 * - Filters out any null or undefined items from the input array before processing.
 * - Returns an empty array if the input is null, undefined, or results in no valid structured ingredients.
 */
export const coerceToStructuredIngredients = (
  ingredients: (StructuredIngredient | string | null | undefined)[] | null | undefined
): StructuredIngredient[] => {
  if (!ingredients || !Array.isArray(ingredients)) {
    return [];
  }

  const processedIngredients: StructuredIngredient[] = [];

  for (const ing of ingredients) {
    if (ing === null || ing === undefined) {
      continue; // Skip null or undefined entries in the array
    }

    if (typeof ing === 'string') {
      if (ing.trim()) { // Ensure string is not empty or just whitespace
        processedIngredients.push({
          name: ing.trim(),
          amount: null,
          unit: null,
          suggested_substitutions: null,
          preparation: null,
        });
      }
    } else if (typeof ing === 'object' && ing.name) { // Basic check for an object that could be an ingredient
      processedIngredients.push({
        name: ing.name,
        amount: ing.amount !== undefined ? ing.amount : null,
        unit: ing.unit !== undefined ? ing.unit : null,
        suggested_substitutions: Array.isArray(ing.suggested_substitutions) 
            ? ing.suggested_substitutions 
            : null, // Ensure it's an array or null
        preparation: ing.preparation !== undefined ? ing.preparation : null,
      });
    } else {
      // Log or handle cases where an object is not a valid ingredient structure if necessary
      console.warn('Skipping invalid ingredient item:', ing);
    }
  }

  return processedIngredients;
};

/**
 * Validates and processes ingredient groups to ensure they have the correct structure.
 * - Ensures each group has a name and ingredients array
 * - Processes ingredients within each group using coerceToStructuredIngredients
 * - Filters out empty groups
 */
export const coerceToIngredientGroups = (
  ingredientGroups: any[] | null | undefined
): IngredientGroup[] => {
  if (!ingredientGroups || !Array.isArray(ingredientGroups)) {
    return [];
  }

  const processedGroups: IngredientGroup[] = [];

  for (const group of ingredientGroups) {
    if (!group || typeof group !== 'object') {
      continue;
    }

    const groupName = group.name || 'Main';
    const groupIngredients = coerceToStructuredIngredients(group.ingredients);

    if (groupIngredients.length > 0) {
      processedGroups.push({
        name: groupName,
        ingredients: groupIngredients,
      });
    }
  }

  return processedGroups;
};

export function parseIngredientDisplayName(name: string): {
  baseName: string;
  isRemoved: boolean;
  substitutedFor?: string;
} {
  const removedMatch = name.match(/^(.*?) \(removed\)$/);
  if (removedMatch) {
    return { baseName: removedMatch[1], isRemoved: true };
  }

  const substitutedMatch = name.match(/^(.*?) \(substituted for (.+?)\)$/);
  if (substitutedMatch) {
    return {
      baseName: substitutedMatch[1],
      isRemoved: false,
      substitutedFor: substitutedMatch[2],
    };
  }

  return { baseName: name, isRemoved: false };
}
