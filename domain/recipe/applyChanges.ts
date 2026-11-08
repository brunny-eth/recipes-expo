/**
 * Pure recipe derivation: base ingredients + applied changes + scale factor → displayed ingredients.
 *
 * Extracted verbatim (minus debug logging) from the `scaledIngredientGroups` memo in
 * app/recipe/summary.tsx. Behavior is intentionally unchanged, including its quirks — see
 * __tests__/domain/applyChanges.test.ts, which pins the current behavior. Change behavior
 * here deliberately and update those tests in the same commit.
 *
 * This module must stay free of React / React Native imports so it can run on the server
 * and in vitest.
 */
import type { IngredientGroup, StructuredIngredient } from '../../common/types';
import { scaleIngredient, parseAmountString, formatAmountNumber } from '../../utils/recipeUtils';
import { parseRecipeDisplayName } from '../../utils/ingredientHelpers';

/** A substitution (`to` = replacement ingredient) or removal (`to` = null), keyed by ingredient name. */
export type AppliedChange = {
  from: string;
  to: StructuredIngredient | null;
};

/**
 * - `clean`: how a saved recipe is shown — removed ingredients are dropped, substitutes replace
 *   the original with no annotation. Matches changes against the ingredient's base display name.
 * - `annotated`: how an in-progress edit is shown — removed ingredients stay with a "(removed)"
 *   suffix, substitutes are labelled "(substituted for X)". Matches against the raw name.
 */
export type ChangeDisplayMode = 'clean' | 'annotated';

/** Scales a substitute's amount by the current factor (no rounding step, unlike scaleIngredient). */
function scaleSubstituteAmount(
  amount: StructuredIngredient['amount'],
  scaleFactor: number,
): StructuredIngredient['amount'] {
  if (amount && scaleFactor !== 1) {
    const parsedAmount = parseAmountString(amount);
    if (parsedAmount !== null) {
      const scaledAmount = parsedAmount * scaleFactor;
      return formatAmountNumber(scaledAmount) || scaledAmount.toString();
    }
  }
  return amount;
}

export function applyChangesToGroups(
  baseGroups: IngredientGroup[],
  changes: AppliedChange[],
  scaleFactor: number,
  mode: ChangeDisplayMode,
): IngredientGroup[] {
  if (baseGroups.length === 0) return [];

  return baseGroups.map((group) => {
    if (!group.ingredients || !Array.isArray(group.ingredients)) {
      return { ...group, ingredients: [] };
    }

    // Always scale from the base (unscaled) ingredients.
    const scaledIngredients = group.ingredients.map((ingredient) =>
      scaleIngredient(ingredient, scaleFactor),
    );

    if (changes.length === 0) {
      return { ...group, ingredients: scaledIngredients };
    }

    if (mode === 'clean') {
      const ingredients = scaledIngredients
        .map((baseIngredient): StructuredIngredient | null => {
          const { baseName: originalName } = parseRecipeDisplayName(baseIngredient.name);
          const change = changes.find((c) => c.from === originalName);
          if (!change) return baseIngredient;
          if (change.to === null) return null;
          return {
            ...change.to,
            amount: scaleSubstituteAmount(change.to.amount, scaleFactor),
          };
        })
        .filter((ingredient): ingredient is StructuredIngredient => ingredient !== null);
      return { ...group, ingredients };
    }

    const ingredients = scaledIngredients.map((baseIngredient): StructuredIngredient => {
      const change = changes.find((c) => c.from === baseIngredient.name);
      if (!change) return baseIngredient;
      if (change.to === null) {
        return {
          ...baseIngredient,
          name: `${baseIngredient.name} (removed)`,
          amount: null,
          unit: null,
          suggested_substitutions: null,
        };
      }
      return {
        ...change.to,
        amount: scaleSubstituteAmount(change.to.amount, scaleFactor),
        name: `${change.to.name} (substituted for ${change.from})`,
      };
    });
    return { ...group, ingredients };
  });
}

export function flattenIngredientGroups(groups: IngredientGroup[]): StructuredIngredient[] {
  const all: StructuredIngredient[] = [];
  groups.forEach((group) => {
    if (group.ingredients && Array.isArray(group.ingredients)) {
      all.push(...group.ingredients);
    }
  });
  return all;
}
