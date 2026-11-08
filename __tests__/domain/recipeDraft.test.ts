import { describe, it, expect } from 'vitest';
import {
  recipeDraftReducer,
  initialRecipeDraft,
  computeHasModifications,
  countRemovals,
  buildSubstitutionChange,
  type RecipeDraft,
} from '@/domain/recipe/recipeDraft';
import type { AppliedChange } from '@/domain/recipe/applyChanges';
import type { StructuredIngredient, SubstitutionSuggestion } from '@/common/types';
import { parseAmountString, formatAmountNumber } from '@/utils/recipeUtils';
import { parseRecipeDisplayName } from '@/utils/ingredientHelpers';

// --- ORACLES: verbatim copies (logging removed) from app/recipe/summary.tsx before extraction ---

function legacyBuildChange(ingredientToSubstitute: StructuredIngredient, substitution: SubstitutionSuggestion, selectedScaleFactor: number) {
  const isRemoval = substitution.name === 'Remove ingredient';
  let originalNameForSub = ingredientToSubstitute.name;
  if (ingredientToSubstitute.name.includes('(substituted for ')) {
    const { substitutionText } = parseRecipeDisplayName(ingredientToSubstitute.name);
    if (substitutionText) originalNameForSub = substitutionText;
  }
  let originalSubstitutionAmount: string | null = null;
  if (substitution.amount != null && selectedScaleFactor !== 1) {
    const parsedAmount = parseAmountString(String(substitution.amount));
    if (parsedAmount !== null) {
      const originalAmount = parsedAmount / selectedScaleFactor;
      originalSubstitutionAmount = formatAmountNumber(originalAmount) || originalAmount.toString();
    } else {
      originalSubstitutionAmount = String(substitution.amount);
    }
  } else {
    originalSubstitutionAmount = substitution.amount != null ? String(substitution.amount) : null;
  }
  const newChange: AppliedChange = {
    from: originalNameForSub,
    to: isRemoval ? null : {
      name: substitution.name,
      amount: originalSubstitutionAmount,
      unit: substitution.unit ?? null,
      preparation: substitution.description ?? null,
      suggested_substitutions: null,
    },
  };
  return { change: newChange, isRemoval };
}

function legacyHasModifications(selectedScaleFactor: number, baselineScaleFactor: number, currentUnsavedChanges: AppliedChange[], persistedChanges: AppliedChange[], baselineAppliedChanges: AppliedChange[]) {
  const hasScaleChanges = selectedScaleFactor !== baselineScaleFactor;
  const hasIngredientChanges = currentUnsavedChanges.length > 0 ||
    persistedChanges.length !== baselineAppliedChanges.length ||
    !persistedChanges.every((change, index) => {
      const baselineChange = baselineAppliedChanges[index];
      return baselineChange &&
        change.from === baselineChange.from &&
        JSON.stringify(change.to) === JSON.stringify(baselineChange.to);
    });
  return hasScaleChanges || hasIngredientChanges;
}

function legacyUpsert(prev: AppliedChange[], newChange: AppliedChange, originalNameForSub: string) {
  const existingChangeIndex = prev.findIndex((c) => c.from === originalNameForSub);
  if (existingChangeIndex > -1) {
    const updated = [...prev];
    updated[existingChangeIndex] = newChange;
    return updated;
  }
  return [...prev, newChange];
}

// --- Fixtures ---

const INGREDIENTS: StructuredIngredient[] = [
  { name: 'lamb mince', amount: '500', unit: 'g' },
  { name: 'fresh cilantro or mint', amount: '1/4', unit: 'cup' },
  { name: 'olive oil (substituted for butter)', amount: '2', unit: 'tbsp' },
  { name: 'tahini (removed)', amount: null, unit: null },
  { name: 'weird (substituted for )', amount: '1', unit: null },
];
const SUBS: SubstitutionSuggestion[] = [
  { name: 'beef mince', amount: '1000', unit: 'g', description: 'leaner' },
  { name: 'parsley', amount: 0.5 as any, unit: 'cup' },
  { name: 'ghee', amount: '1 1/2', unit: 'tbsp', description: null },
  { name: 'salt', amount: 'to taste', unit: null },
  { name: 'water', amount: null, unit: undefined as any },
  { name: 'Remove ingredient', amount: null, unit: null },
];
const SCALES = [1, 2, 0.5, 3, 1.5];

describe('buildSubstitutionChange ≡ legacy handler', () => {
  for (const ingredient of INGREDIENTS) for (const sub of SUBS) for (const scale of SCALES) {
    it(`${ingredient.name} → ${sub.name} @ ${scale}×`, () => {
      expect(buildSubstitutionChange(ingredient, sub, scale)).toEqual(legacyBuildChange(ingredient, sub, scale));
    });
  }

  it('stores the 1× amount when picked at 2×', () => {
    const { change } = buildSubstitutionChange(INGREDIENTS[0], SUBS[0], 2);
    expect(change.to?.amount).toBe('500');
  });
});

const A: AppliedChange = { from: 'lamb mince', to: { name: 'beef mince', amount: '500', unit: 'g' } };
const B: AppliedChange = { from: 'salt', to: null };
const A2: AppliedChange = { from: 'lamb mince', to: { name: 'lentils', amount: '1', unit: 'cup' } };
const C: AppliedChange = { from: 'tahini', to: { name: 'peanut butter', amount: '3', unit: 'tbsp' } };

describe('computeHasModifications ≡ legacy effect', () => {
  const lists = [[], [A], [B], [A, B], [B, A], [A2], [A, C]];
  for (const sel of [1, 2]) for (const base of [1, 2]) for (const unsaved of lists) for (const persisted of lists) for (const baseline of lists) {
    it(`sel ${sel} base ${base} u${unsaved.length} p${persisted.map(c => c.from).join('+')} b${baseline.map(c => c.from).join('+')}`, () => {
      const d: RecipeDraft = { selectedScaleFactor: sel, baselineScaleFactor: base, currentUnsavedChanges: unsaved, persistedChanges: persisted, baselineAppliedChanges: baseline };
      expect(computeHasModifications(d)).toBe(legacyHasModifications(sel, base, unsaved, persisted, baseline));
    });
  }
});

describe('recipeDraftReducer', () => {
  it('upsertChange matches the legacy setter (append, and replace same ingredient in place)', () => {
    let s = initialRecipeDraft;
    let legacy: AppliedChange[] = [];
    for (const c of [A, B, C, A2, B]) {
      s = recipeDraftReducer(s, { type: 'upsertChange', change: c });
      legacy = legacyUpsert(legacy, c, c.from);
      expect(s.currentUnsavedChanges).toEqual(legacy);
    }
    expect(s.currentUnsavedChanges.map(c => c.from)).toEqual(['lamb mince', 'salt', 'tahini']);
    expect(s.currentUnsavedChanges[0]).toBe(A2);
  });

  it('revertChange removes only unsaved changes for that ingredient', () => {
    const s = recipeDraftReducer(
      { ...initialRecipeDraft, persistedChanges: [C], currentUnsavedChanges: [A, B] },
      { type: 'revertChange', from: 'lamb mince' },
    );
    expect(s.currentUnsavedChanges).toEqual([B]);
    expect(s.persistedChanges).toEqual([C]);
  });

  it('setScale changes only the selected factor', () => {
    const s = recipeDraftReducer(initialRecipeDraft, { type: 'setScale', factor: 2 });
    expect(s).toEqual({ ...initialRecipeDraft, selectedScaleFactor: 2 });
    expect(computeHasModifications(s)).toBe(true);
  });

  it('commitSaved matches the legacy post-save resets', () => {
    const before: RecipeDraft = { persistedChanges: [C], currentUnsavedChanges: [A, B], selectedScaleFactor: 2, baselineScaleFactor: 1, baselineAppliedChanges: [C] };
    const s = recipeDraftReducer(before, { type: 'commitSaved' });
    expect(s).toEqual({ persistedChanges: [C, A, B], currentUnsavedChanges: [], selectedScaleFactor: 1, baselineScaleFactor: 1, baselineAppliedChanges: [C, A, B] });
    expect(computeHasModifications(s)).toBe(false);
  });

  it('load sets only the provided fields', () => {
    const s = recipeDraftReducer({ ...initialRecipeDraft, currentUnsavedChanges: [A] }, { type: 'load', fields: { selectedScaleFactor: 3 } });
    expect(s).toEqual({ ...initialRecipeDraft, currentUnsavedChanges: [A], selectedScaleFactor: 3 });
  });

  it('initial state matches the old useState initial values', () => {
    expect(initialRecipeDraft).toEqual({ persistedChanges: [], currentUnsavedChanges: [], selectedScaleFactor: 1.0, baselineScaleFactor: 1, baselineAppliedChanges: [] });
  });
});

describe('countRemovals', () => {
  it('counts removals across persisted and unsaved', () => {
    expect(countRemovals({ persistedChanges: [B, A], currentUnsavedChanges: [{ from: 'x', to: null }] })).toBe(2);
  });
});
