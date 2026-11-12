/**
 * Initial-state resolution for the recipe summary screen.
 *
 * Extracted from the `loadRecipe` effect in app/recipe/summary.tsx. Each function is a
 * line-by-line translation of the original: every `setX(value)` became `patch.x = value`,
 * in the same order, so later assignments win exactly as the last setter call did.
 * Keys absent from the patch mean "the original code did not call that setter" — the
 * screen leaves that state untouched. Behavior is pinned by __tests__/domain/summaryLoad.test.ts;
 * known quirks are preserved on purpose and listed there.
 *
 * React-free so it can be unit-tested.
 */
import type { CombinedParsedRecipe, IngredientGroup } from '../../common/types';
import { parseServingsValue } from '../../utils/recipeUtils';
import type { AppliedChange } from './applyChanges';

export type SummaryLoadPatch = {
  recipe?: CombinedParsedRecipe;
  originalRecipe?: CombinedParsedRecipe;
  originalYieldValue?: number | null;
  imageLoadFailed?: boolean;
  unscaledIngredientGroups?: IngredientGroup[];
  baselineScaleFactor?: number;
  selectedScaleFactor?: number;
  persistedChanges?: AppliedChange[];
  currentUnsavedChanges?: AppliedChange[];
  baselineAppliedChanges?: AppliedChange[];
};

/** `error` is passed to handleError(title, error) after the patch is applied. */
export type SummaryLoadResult = {
  patch: SummaryLoadPatch;
  error?: { title: string; error: unknown };
};

// Param is named `parsed` so a thrown TypeError's message ("parsed.ingredientGroups is not
// iterable") matches the original code exactly — that message can reach the error modal.
const copyGroups = (parsed: any): IngredientGroup[] =>
  parsed.ingredientGroups ? [...parsed.ingredientGroups] : [];

/** Converts the saved `applied_changes.ingredientChanges` format to the screen's internal format. */
export function convertSavedIngredientChanges(ingredientChanges: any[]): AppliedChange[] {
  return ingredientChanges.map((change: any) => ({
    from: change.from,
    to: change.to
      ? {
          // Handle both old format (string) and new format (object)
          name: typeof change.to === 'string' ? change.to : change.to.name,
          amount: typeof change.to === 'string' ? null : change.to.amount,
          unit: typeof change.to === 'string' ? null : change.to.unit,
          preparation: typeof change.to === 'string' ? null : change.to.preparation,
          suggested_substitutions: null,
        }
      : null,
  }));
}

/** Deep-link (share slug) path, after the shared recipe was fetched successfully. */
export function patchForSharedRecipe(sharedRecipe: CombinedParsedRecipe): SummaryLoadPatch {
  return {
    recipe: sharedRecipe,
    originalRecipe: sharedRecipe,
    imageLoadFailed: false,
    unscaledIngredientGroups: sharedRecipe.ingredientGroups ? [...sharedRecipe.ingredientGroups] : [],
    baselineScaleFactor: 1,
    selectedScaleFactor: 1,
    originalYieldValue: parseServingsValue(sharedRecipe.recipeYield),
  };
}

/** Fetch-by-id path, after the recipe was fetched successfully. Ignores appliedChanges/originalRecipeData params (as before). */
export function patchForFetchedRecipe(fetchedRecipe: CombinedParsedRecipe, entryPoint: string): SummaryLoadPatch {
  const patch: SummaryLoadPatch = {};
  patch.recipe = fetchedRecipe;
  patch.originalRecipe = fetchedRecipe;
  patch.originalYieldValue = parseServingsValue(fetchedRecipe.recipeYield);
  if (entryPoint === 'saved') {
    patch.unscaledIngredientGroups = fetchedRecipe.ingredientGroups ? [...fetchedRecipe.ingredientGroups] : [];
    patch.baselineScaleFactor = 1;
    patch.selectedScaleFactor = 1;
  }
  patch.imageLoadFailed = false;
  return patch;
}

/** `recipeData` route-param path (recipe passed as JSON). */
export function resolveFromRecipeDataParam(input: {
  recipeData: string;
  originalRecipeData?: string;
  appliedChanges?: string;
  entryPoint: string;
}): SummaryLoadResult {
  const { recipeData, originalRecipeData, appliedChanges, entryPoint } = input;
  const patch: SummaryLoadPatch = {};

  try {
    const parsed = JSON.parse(recipeData);
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      return { patch, error: { title: 'Error Loading Summary', error: 'Recipe data is invalid.' } };
    }

    patch.recipe = parsed;
    patch.imageLoadFailed = false;

    if (originalRecipeData) {
      try {
        const originalParsed = JSON.parse(originalRecipeData);
        patch.originalRecipe = originalParsed;
        patch.originalYieldValue = parseServingsValue(originalParsed.recipeYield);
      } catch {
        // Fall back to using the current recipe as original
        patch.originalRecipe = parsed;
        patch.originalYieldValue = parseServingsValue(parsed.recipeYield);
      }
      if (entryPoint === 'saved') {
        patch.unscaledIngredientGroups = copyGroups(parsed);
        patch.baselineScaleFactor = 1;
        patch.selectedScaleFactor = 1;
      }
    } else {
      patch.originalRecipe = parsed;
      patch.originalYieldValue = parseServingsValue(parsed.recipeYield);
    }

    if (entryPoint === 'saved') {
      patch.unscaledIngredientGroups = copyGroups(parsed);
      patch.baselineScaleFactor = 1;
      patch.selectedScaleFactor = 1;
    }

    if (appliedChanges) {
      try {
        const savedAppliedChanges = JSON.parse(appliedChanges);

        if (savedAppliedChanges.ingredientChanges) {
          const convertedChanges = convertSavedIngredientChanges(savedAppliedChanges.ingredientChanges);
          patch.persistedChanges = convertedChanges;
          patch.currentUnsavedChanges = [];
          patch.baselineScaleFactor = 1.0;
          patch.baselineAppliedChanges = convertedChanges;
        }

        let finalScaleFactor = 1.0;
        if (savedAppliedChanges.scalingFactor && originalRecipeData) {
          const currentYieldNum = parseServingsValue(parsed.recipeYield);
          let originalYieldNum = null;
          try {
            const originalParsed = JSON.parse(originalRecipeData);
            originalYieldNum = parseServingsValue(originalParsed?.recipeYield);
          } catch {
            // ignore — falls through to the saved factor below
          }
          if (currentYieldNum && originalYieldNum) {
            finalScaleFactor = currentYieldNum / originalYieldNum;
          } else if (entryPoint === 'saved') {
            // Saved data is already scaled: fresh 1× baseline
            finalScaleFactor = 1.0;
          } else {
            finalScaleFactor = savedAppliedChanges.scalingFactor;
          }
        } else if (savedAppliedChanges.scalingFactor) {
          finalScaleFactor = entryPoint === 'saved' ? 1.0 : savedAppliedChanges.scalingFactor;
        } else {
          finalScaleFactor = 1.0;
        }

        patch.selectedScaleFactor = finalScaleFactor;
        patch.baselineScaleFactor = 1.0;
      } catch {
        patch.selectedScaleFactor = 1.0;
        patch.persistedChanges = [];
        patch.currentUnsavedChanges = [];
      }
    } else {
      // New recipe, no existing changes
      patch.selectedScaleFactor = 1.0;
      patch.persistedChanges = [];
      patch.currentUnsavedChanges = [];
      patch.baselineScaleFactor = 1.0;
      patch.baselineAppliedChanges = [];
    }

    return { patch };
  } catch (e) {
    return { patch, error: { title: 'Error Loading Summary', error: e } };
  }
}

/**
 * Mise entry: a mise item stores the *prepared* recipe (changes and scale already baked into
 * title, steps and ingredients) plus the applied changes — but not the 1× original. Rebuild
 * the screen from the canonical recipe (as the original) + the stored changes, so ingredients
 * are derived once (no double scaling) while title/steps come from the prepared version.
 *
 * The baseline scale is set to the stored scale: reopening a mise recipe is not a modification.
 * If the canonical recipe could not be fetched, show the prepared recipe as-is at 1×.
 */
export function resolveMiseRecipe(input: {
  preparedRecipeData: string;
  canonicalRecipe: CombinedParsedRecipe | null;
  appliedChanges?: string;
}): SummaryLoadResult {
  const { preparedRecipeData, canonicalRecipe, appliedChanges } = input;
  if (!canonicalRecipe) {
    return resolveFromRecipeDataParam({ recipeData: preparedRecipeData, entryPoint: 'mise' });
  }
  const result = resolveFromRecipeDataParam({
    recipeData: preparedRecipeData,
    originalRecipeData: JSON.stringify(canonicalRecipe),
    appliedChanges,
    entryPoint: 'mise',
  });
  if (!result.error && result.patch.selectedScaleFactor !== undefined) {
    result.patch.baselineScaleFactor = result.patch.selectedScaleFactor;
  }
  return result;
}
