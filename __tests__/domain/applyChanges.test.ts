import { describe, it, expect } from 'vitest';
import {
  applyChangesToGroups,
  flattenIngredientGroups,
  type AppliedChange,
} from '@/domain/recipe/applyChanges';
import type { IngredientGroup, StructuredIngredient } from '@/common/types';
import { scaleIngredient, parseAmountString, formatAmountNumber } from '@/utils/recipeUtils';
import { parseRecipeDisplayName } from '@/utils/ingredientHelpers';

/**
 * ORACLE: verbatim copy (debug logging removed) of the `scaledIngredientGroups` memo body in
 * app/recipe/summary.tsx as of commit dbf6aab, before extraction. Used to prove the extracted
 * function is behavior-identical. Do not "fix" this copy.
 */
function legacyScaledIngredientGroups(
  unscaledIngredientGroups: IngredientGroup[],
  originalRecipeGroups: IngredientGroup[] | null | undefined,
  persistedChanges: AppliedChange[],
  currentUnsavedChanges: AppliedChange[],
  selectedScaleFactor: number,
  isViewingSavedRecipe: boolean,
): IngredientGroup[] {
  const sourceIngredientGroups = unscaledIngredientGroups.length > 0
    ? unscaledIngredientGroups
    : originalRecipeGroups || [];
  if (sourceIngredientGroups.length === 0) return [];
  const allAppliedChanges = [...persistedChanges, ...currentUnsavedChanges];
  return sourceIngredientGroups.map((group) => {
    if (!group.ingredients || !Array.isArray(group.ingredients)) {
      return { ...group, ingredients: [] };
    }
    const scaledIngredients = group.ingredients.map((ingredient) => scaleIngredient(ingredient, selectedScaleFactor));
    let finalIngredients = scaledIngredients;
    if (allAppliedChanges.length > 0) {
      if (isViewingSavedRecipe) {
        finalIngredients = scaledIngredients
          .map((baseIngredient) => {
            const { baseName: originalName } = parseRecipeDisplayName(baseIngredient.name);
            const change = allAppliedChanges.find((c) => c.from === originalName);
            if (change) {
              if (change.to === null) return null;
              let scaledSubstitutionAmount = change.to.amount;
              if (change.to.amount && selectedScaleFactor !== 1) {
                const parsedAmount = parseAmountString(change.to.amount);
                if (parsedAmount !== null) {
                  const scaledAmount = parsedAmount * selectedScaleFactor;
                  scaledSubstitutionAmount = formatAmountNumber(scaledAmount) || scaledAmount.toString();
                }
              }
              return { ...change.to, amount: scaledSubstitutionAmount };
            }
            return baseIngredient;
          })
          .filter((ingredient): ingredient is StructuredIngredient => ingredient !== null);
      } else {
        finalIngredients = scaledIngredients.map((baseIngredient) => {
          const change = allAppliedChanges.find((c) => c.from === baseIngredient.name);
          if (change) {
            if (change.to === null) {
              return {
                ...baseIngredient,
                name: `${baseIngredient.name} (removed)`,
                amount: null,
                unit: null,
                suggested_substitutions: null,
              };
            }
            let scaledSubstitutionAmount = change.to.amount;
            if (change.to.amount && selectedScaleFactor !== 1) {
              const parsedAmount = parseAmountString(change.to.amount);
              if (parsedAmount !== null) {
                const scaledAmount = parsedAmount * selectedScaleFactor;
                scaledSubstitutionAmount = formatAmountNumber(scaledAmount) || scaledAmount.toString();
              }
            }
            return {
              ...change.to,
              amount: scaledSubstitutionAmount,
              name: `${change.to.name} (substituted for ${change.from})`,
            };
          }
          return baseIngredient;
        });
      }
    }
    return { ...group, ingredients: finalIngredients };
  });
}

// --- Fixtures ---------------------------------------------------------------

const ing = (name: string, amount: any, unit: string | null = null, extra: Partial<StructuredIngredient> = {}): StructuredIngredient =>
  ({ name, amount, unit, suggested_substitutions: [{ name: 'alt', amount: '1', unit: null }], preparation: null, ...extra });

const GROUPS: IngredientGroup[] = [
  {
    name: 'Main',
    ingredients: [
      ing('lamb mince', '500', 'g'),
      ing('sweet potatoes', '4', null, { preparation: 'scrubbed' }),
      ing('olive oil', '1 1/2', 'tbsp'),
      ing('ground cumin', '½', 'tsp'),
      ing('salt', null, null),
      ing('pepper', 'to taste', null),
      ing('eggs', '2-3', null),
      ing('flour', 0.25 as any, 'cup'),
      ing('yogurt', '', 'cup'),
      ing('chicken thighs (boneless, skinless)', '1.5', 'lb'),
    ],
  },
  { name: 'Sauce', ingredients: [ing('tahini', '3', 'tbsp'), ing('lemon juice', '2', 'tbsp'), ing('garlic', '1', 'clove')] },
  { name: 'Empty', ingredients: [] },
  { name: 'Broken', ingredients: null as any },
];

const CHANGE_SETS: Record<string, AppliedChange[]> = {
  none: [],
  substitute: [{ from: 'lamb mince', to: { name: 'beef mince', amount: '500', unit: 'g' } }],
  remove: [{ from: 'olive oil', to: null }],
  substituteNullAmount: [{ from: 'tahini', to: { name: 'peanut butter', amount: null, unit: 'tbsp' } }],
  substituteFraction: [{ from: 'ground cumin', to: { name: 'ground coriander', amount: '1/2', unit: 'tsp' } }],
  substituteNonNumeric: [{ from: 'pepper', to: { name: 'chili flakes', amount: 'a pinch', unit: null } }],
  mixed: [
    { from: 'lamb mince', to: { name: 'brown lentils', amount: '1', unit: 'cup', preparation: 'cooked' } },
    { from: 'salt', to: null },
    { from: 'lemon juice', to: { name: 'lime juice', amount: '2', unit: 'tbsp' } },
  ],
  duplicateFrom: [
    { from: 'garlic', to: { name: 'shallot', amount: '1', unit: null } },
    { from: 'garlic', to: null },
  ],
  noMatch: [{ from: 'saffron', to: null }],
  parenthesized: [{ from: 'chicken thighs (boneless, skinless)', to: { name: 'tofu', amount: '1', unit: 'block' } }],
};

const SCALES = [1, 0.5, 2, 3, 1.5, 0.25, 4, 0, -1, NaN];

// --- Equivalence with the original inline implementation --------------------

describe('applyChangesToGroups ≡ legacy summary.tsx memo', () => {
  for (const [label, changes] of Object.entries(CHANGE_SETS)) {
    for (const scale of SCALES) {
      for (const saved of [true, false]) {
        it(`${label} × ${scale} × ${saved ? 'clean' : 'annotated'}`, () => {
          const expected = legacyScaledIngredientGroups(GROUPS, null, changes, [], scale, saved);
          const actual = applyChangesToGroups(GROUPS, changes, scale, saved ? 'clean' : 'annotated');
          expect(actual).toEqual(expected);
        });
      }
    }
  }

  it('persisted + unsaved changes are equivalent to their concatenation', () => {
    const persisted = CHANGE_SETS.substitute;
    const unsaved = CHANGE_SETS.remove;
    for (const saved of [true, false]) {
      expect(applyChangesToGroups(GROUPS, [...persisted, ...unsaved], 2, saved ? 'clean' : 'annotated'))
        .toEqual(legacyScaledIngredientGroups(GROUPS, null, persisted, unsaved, 2, saved));
    }
  });

  it('empty input returns empty', () => {
    expect(applyChangesToGroups([], CHANGE_SETS.mixed, 2, 'clean')).toEqual([]);
  });
});

// --- Pinned behavior (documents what users see today) -----------------------

describe('applyChangesToGroups pinned behavior', () => {
  const main = (groups: IngredientGroup[]) => groups[0].ingredients;

  it('scales base amounts', () => {
    const out = main(applyChangesToGroups(GROUPS, [], 2, 'clean'));
    expect(out.find(i => i.name === 'lamb mince')?.amount).toBe('1000');
    expect(out.find(i => i.name === 'olive oil')?.amount).toBe('3');
    expect(out.find(i => i.name === 'salt')?.amount).toBeNull();
    expect(out.find(i => i.name === 'pepper')?.amount).toBe('to taste');
  });

  it('annotated mode labels removals and substitutions', () => {
    const out = main(applyChangesToGroups(GROUPS, CHANGE_SETS.mixed, 1, 'annotated'));
    expect(out[0].name).toBe('brown lentils (substituted for lamb mince)');
    const salt = out.find(i => i.name.startsWith('salt'));
    expect(salt).toMatchObject({ name: 'salt (removed)', amount: null, unit: null, suggested_substitutions: null });
  });

  it('clean mode drops removals and replaces substitutions without labels', () => {
    const out = main(applyChangesToGroups(GROUPS, CHANGE_SETS.mixed, 1, 'clean'));
    expect(out.some(i => i.name.startsWith('salt'))).toBe(false);
    expect(out[0].name).toBe('brown lentils');
    expect(out).toHaveLength(GROUPS[0].ingredients.length - 1);
  });

  it('scales the substitute amount by the current factor', () => {
    const out = main(applyChangesToGroups(GROUPS, CHANGE_SETS.substitute, 3, 'clean'));
    expect(out[0]).toMatchObject({ name: 'beef mince', amount: '1500', unit: 'g' });
  });

  it('substitute takes only fields from the change (drops base preparation/substitutions)', () => {
    const out = main(applyChangesToGroups(GROUPS, CHANGE_SETS.mixed, 1, 'clean'));
    expect(out[0]).toEqual({ name: 'brown lentils', amount: '1', unit: 'cup', preparation: 'cooked' });
  });

  it('first matching change wins when several target the same ingredient', () => {
    const sauce = applyChangesToGroups(GROUPS, CHANGE_SETS.duplicateFrom, 1, 'clean')[1].ingredients;
    expect(sauce.find(i => i.name === 'shallot')).toBeDefined();
  });

  it('does not mutate inputs', () => {
    const snapshot = JSON.parse(JSON.stringify(GROUPS));
    applyChangesToGroups(GROUPS, CHANGE_SETS.mixed, 2, 'annotated');
    applyChangesToGroups(GROUPS, CHANGE_SETS.mixed, 2, 'clean');
    expect(JSON.parse(JSON.stringify(GROUPS))).toEqual(snapshot);
  });
});

describe('flattenIngredientGroups', () => {
  it('concatenates group ingredients and skips missing arrays', () => {
    const flat = flattenIngredientGroups(GROUPS);
    expect(flat).toHaveLength(10 + 3);
    expect(flat[10].name).toBe('tahini');
  });
});
