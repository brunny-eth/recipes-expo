import { describe, it, expect } from 'vitest';
import {
  resolveFromRecipeDataParam,
  patchForFetchedRecipe,
  patchForSharedRecipe,
  type SummaryLoadPatch,
} from '@/domain/recipe/summaryLoad';
import { parseServingsValue } from '@/utils/recipeUtils';

/**
 * ORACLE: verbatim copy (logging removed) of the `params.recipeData` branch of the loadRecipe
 * effect in app/recipe/summary.tsx before extraction, with React setters replaced by recorders
 * (last call wins, like React state). Do not "fix" this copy.
 */
function legacyRecipeDataBranch(params: {
  recipeData: string; originalRecipeData?: string; appliedChanges?: string;
}, entryPoint: string) {
  const state: SummaryLoadPatch = {};
  const errors: { title: string; error: unknown }[] = [];
  const handleError = (title: string, error: unknown) => errors.push({ title, error });
  const setRecipe = (v: any) => { state.recipe = v; };
  const setImageLoadFailed = (v: any) => { state.imageLoadFailed = v; };
  const setOriginalRecipe = (v: any) => { state.originalRecipe = v; };
  const setOriginalYieldValue = (v: any) => { state.originalYieldValue = v; };
  const setUnscaledIngredientGroups = (v: any) => { state.unscaledIngredientGroups = v; };
  const setBaselineScaleFactor = (v: any) => { state.baselineScaleFactor = v; };
  const setSelectedScaleFactor = (v: any) => { state.selectedScaleFactor = v; };
  const setPersistedChanges = (v: any) => { state.persistedChanges = v; };
  const setCurrentUnsavedChanges = (v: any) => { state.currentUnsavedChanges = v; };
  const setBaselineAppliedChanges = (v: any) => { state.baselineAppliedChanges = v; };

  try {
    const parsed = JSON.parse(params.recipeData as string);
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      handleError('Error Loading Summary', 'Recipe data is invalid.');
      return { state, errors };
    }
    setRecipe(parsed);
    setImageLoadFailed(false);
    if (params.originalRecipeData) {
      try {
        const originalParsed = JSON.parse(params.originalRecipeData as string);
        setOriginalRecipe(originalParsed);
        const yieldNum = parseServingsValue(originalParsed.recipeYield);
        setOriginalYieldValue(yieldNum);
      } catch (originalError) {
        setOriginalRecipe(parsed);
        const yieldNum = parseServingsValue(parsed.recipeYield);
        setOriginalYieldValue(yieldNum);
      }
      const isSavedEntrypoint = entryPoint === 'saved';
      if (isSavedEntrypoint) {
        setUnscaledIngredientGroups(parsed.ingredientGroups ? [...parsed.ingredientGroups] : []);
        setBaselineScaleFactor(1);
        setSelectedScaleFactor(1);
      }
    } else {
      setOriginalRecipe(parsed);
      const yieldNum = parseServingsValue(parsed.recipeYield);
      setOriginalYieldValue(yieldNum);
    }
    const isSavedEntrypoint = entryPoint === 'saved';
    if (isSavedEntrypoint) {
      setUnscaledIngredientGroups(parsed.ingredientGroups ? [...parsed.ingredientGroups] : []);
      setBaselineScaleFactor(1);
      setSelectedScaleFactor(1);
    }
    if (params.appliedChanges) {
      try {
        const savedAppliedChanges = JSON.parse(params.appliedChanges as string);
        if (savedAppliedChanges.ingredientChanges) {
          const convertedChanges = savedAppliedChanges.ingredientChanges.map((change: any) => ({
            from: change.from,
            to: change.to ? {
              name: typeof change.to === 'string' ? change.to : change.to.name,
              amount: typeof change.to === 'string' ? null : change.to.amount,
              unit: typeof change.to === 'string' ? null : change.to.unit,
              preparation: typeof change.to === 'string' ? null : change.to.preparation,
              suggested_substitutions: null,
            } : null,
          }));
          setPersistedChanges(convertedChanges);
          setCurrentUnsavedChanges([]);
          setBaselineScaleFactor(1.0);
          setBaselineAppliedChanges(convertedChanges);
        }
        let finalScaleFactor = 1.0;
        if (savedAppliedChanges.scalingFactor && params.originalRecipeData) {
          const currentYieldNum = parseServingsValue(parsed.recipeYield);
          let originalYieldNum = null;
          try {
            const originalParsed = JSON.parse(params.originalRecipeData as string);
            originalYieldNum = parseServingsValue(originalParsed?.recipeYield);
          } catch (originalError) {
            // logged only
          }
          if (currentYieldNum && originalYieldNum) {
            const actualScaleFactor = currentYieldNum / originalYieldNum;
            finalScaleFactor = actualScaleFactor;
          } else {
            if (entryPoint === 'saved') {
              finalScaleFactor = 1.0;
            } else {
              finalScaleFactor = savedAppliedChanges.scalingFactor;
            }
          }
        } else if (savedAppliedChanges.scalingFactor) {
          if (entryPoint === 'saved') {
            finalScaleFactor = 1.0;
          } else {
            finalScaleFactor = savedAppliedChanges.scalingFactor;
          }
        } else {
          finalScaleFactor = 1.0;
        }
        setSelectedScaleFactor(finalScaleFactor);
        setBaselineScaleFactor(1.0);
      } catch (appliedChangesError: any) {
        setSelectedScaleFactor(1.0);
        setPersistedChanges([]);
        setCurrentUnsavedChanges([]);
      }
    } else {
      setSelectedScaleFactor(1.0);
      setPersistedChanges([]);
      setCurrentUnsavedChanges([]);
      setBaselineScaleFactor(1.0);
      setBaselineAppliedChanges([]);
    }
  } catch (e: any) {
    handleError('Error Loading Summary', e);
  }
  return { state, errors };
}

// --- Fixtures ---------------------------------------------------------------

const groups = [{ name: 'Main', ingredients: [{ name: 'lamb mince', amount: '500', unit: 'g' }] }];
const RECIPES: Record<string, string> = {
  normal: JSON.stringify({ id: 2616, title: 'Moroccan Lamb', recipeYield: '4 servings', ingredientGroups: groups }),
  noId: JSON.stringify({ title: 'No id', recipeYield: '2', ingredientGroups: groups }),
  noGroups: JSON.stringify({ id: 1, title: 'x', recipeYield: null }),
  scaled: JSON.stringify({ id: 2, title: 'Scaled', recipeYield: '8 servings', ingredientGroups: groups }),
  nonIterableGroups: JSON.stringify({ id: 3, title: 'bad', ingredientGroups: { not: 'array' } }),
  empty: '{}',
  nullJson: 'null',
  notJson: '{not json',
};
const ORIGINALS: Record<string, string | undefined> = {
  none: undefined,
  fourServings: JSON.stringify({ id: 2616, recipeYield: '4 servings', ingredientGroups: groups }),
  noYield: JSON.stringify({ id: 2616, recipeYield: null }),
  notJson: '{oops',
  nullJson: 'null',
};
const CHANGES: Record<string, string | undefined> = {
  none: undefined,
  objectTo: JSON.stringify({ ingredientChanges: [{ from: 'lamb mince', to: { name: 'beef mince', amount: '500', unit: 'g', preparation: null } }], scalingFactor: 2 }),
  stringTo: JSON.stringify({ ingredientChanges: [{ from: 'lamb mince', to: 'beef mince' }, { from: 'salt', to: null }] }),
  scaleOnly: JSON.stringify({ scalingFactor: 1.5 }),
  emptyChanges: JSON.stringify({ ingredientChanges: [], scalingFactor: 0 }),
  nonArrayChanges: JSON.stringify({ ingredientChanges: { a: 1 }, scalingFactor: 2 }),
  nullJson: 'null',
  notJson: '[[bad',
};
const ENTRY_POINTS = ['new', 'saved', 'mise', 'library', 'upload'];

describe('resolveFromRecipeDataParam ≡ legacy loadRecipe recipeData branch', () => {
  for (const [rk, recipeData] of Object.entries(RECIPES)) {
    for (const [ok, originalRecipeData] of Object.entries(ORIGINALS)) {
      for (const [ck, appliedChanges] of Object.entries(CHANGES)) {
        for (const entryPoint of ENTRY_POINTS) {
          it(`${rk} / original:${ok} / changes:${ck} / ${entryPoint}`, () => {
            const legacy = legacyRecipeDataBranch({ recipeData, originalRecipeData, appliedChanges }, entryPoint);
            const result = resolveFromRecipeDataParam({ recipeData, originalRecipeData, appliedChanges, entryPoint });
            expect(result.patch).toEqual(legacy.state);
            // Same keys set (absent key = setter never called)
            expect(Object.keys(result.patch).sort()).toEqual(Object.keys(legacy.state).sort());
            if (legacy.errors.length === 0) {
              expect(result.error).toBeUndefined();
            } else {
              expect(result.error?.title).toBe(legacy.errors[0].title);
              const le = legacy.errors[0].error;
              if (le instanceof Error) {
                expect(result.error?.error).toBeInstanceOf(le.constructor);
                expect((result.error?.error as Error).message).toBe(le.message);
              } else {
                expect(result.error?.error).toEqual(le);
              }
            }
          });
        }
      }
    }
  }
});

describe('pinned behavior', () => {
  it('keeps the recipe id from recipeData (the "Missing required fields" bug is not here)', () => {
    const r = resolveFromRecipeDataParam({ recipeData: RECIPES.normal, entryPoint: 'new' });
    expect(r.patch.recipe?.id).toBe(2616);
  });

  it('mise with originalRecipeData derives the scale factor from yields', () => {
    const r = resolveFromRecipeDataParam({
      recipeData: RECIPES.scaled, originalRecipeData: ORIGINALS.fourServings, appliedChanges: CHANGES.objectTo, entryPoint: 'mise',
    });
    expect(r.patch.selectedScaleFactor).toBe(2);
    expect(r.patch.persistedChanges?.[0].to?.name).toBe('beef mince');
  });

  it('saved entry ignores a stored scalingFactor when yields are unavailable', () => {
    const r = resolveFromRecipeDataParam({ recipeData: RECIPES.normal, appliedChanges: CHANGES.scaleOnly, entryPoint: 'saved' });
    expect(r.patch.selectedScaleFactor).toBe(1);
  });

  it('QUIRK: non-iterable ingredientGroups on a saved recipe sets recipe, then errors', () => {
    const r = resolveFromRecipeDataParam({ recipeData: RECIPES.nonIterableGroups, entryPoint: 'saved' });
    expect(r.patch.recipe).toBeDefined();
    expect(r.error?.title).toBe('Error Loading Summary');
  });

  it('QUIRK: scale-only applied changes leave persisted changes untouched (key absent)', () => {
    const r = resolveFromRecipeDataParam({ recipeData: RECIPES.normal, appliedChanges: CHANGES.scaleOnly, entryPoint: 'mise' });
    expect('persistedChanges' in r.patch).toBe(false);
    expect(r.patch.selectedScaleFactor).toBe(1.5);
  });
});

describe('patchForFetchedRecipe / patchForSharedRecipe', () => {
  const recipe = JSON.parse(RECIPES.normal);

  it('fetch-by-id resets scale only for saved entry', () => {
    expect(patchForFetchedRecipe(recipe, 'saved')).toEqual({
      recipe, originalRecipe: recipe, originalYieldValue: 4, imageLoadFailed: false,
      unscaledIngredientGroups: groups, baselineScaleFactor: 1, selectedScaleFactor: 1,
    });
    expect(patchForFetchedRecipe(recipe, 'library')).toEqual({
      recipe, originalRecipe: recipe, originalYieldValue: 4, imageLoadFailed: false,
    });
  });

  it('shared recipe always starts at 1×', () => {
    expect(patchForSharedRecipe(recipe)).toEqual({
      recipe, originalRecipe: recipe, imageLoadFailed: false,
      unscaledIngredientGroups: groups, baselineScaleFactor: 1, selectedScaleFactor: 1, originalYieldValue: 4,
    });
  });
});
