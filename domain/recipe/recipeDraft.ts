/**
 * The summary screen's editable "draft": ingredient changes (persisted vs. unsaved) and scale,
 * plus the baseline they're compared against to decide whether there are modifications.
 *
 * Extracted from app/recipe/summary.tsx (previously six useState hooks mutated from handlers).
 * Behavior is unchanged; see __tests__/domain/recipeDraft.test.ts. React-free.
 */
import type { StructuredIngredient, SubstitutionSuggestion } from '../../common/types';
import { parseAmountString, formatAmountNumber } from '../../utils/recipeUtils';
import { parseRecipeDisplayName } from '../../utils/ingredientHelpers';
import type { AppliedChange } from './applyChanges';

export const REMOVE_INGREDIENT = 'Remove ingredient';
export const MAX_REMOVALS = 2;

export type RecipeDraft = {
  /** Changes loaded from / already saved to the server. */
  persistedChanges: AppliedChange[];
  /** Changes made on this screen since load or last save (revertible). */
  currentUnsavedChanges: AppliedChange[];
  selectedScaleFactor: number;
  /** Scale and changes at load / last save — "modified" means differing from these. */
  baselineScaleFactor: number;
  baselineAppliedChanges: AppliedChange[];
};

export const initialRecipeDraft: RecipeDraft = {
  persistedChanges: [],
  currentUnsavedChanges: [],
  selectedScaleFactor: 1.0,
  baselineScaleFactor: 1,
  baselineAppliedChanges: [],
};

export type RecipeDraftAction =
  /** Set any subset of fields (used by the screen's load logic). */
  | { type: 'load'; fields: Partial<RecipeDraft> }
  /** Add a change, replacing any existing unsaved change for the same ingredient. */
  | { type: 'upsertChange'; change: AppliedChange }
  /** Drop the unsaved change for an ingredient (undo removal / undo substitution). */
  | { type: 'revertChange'; from: string }
  | { type: 'setScale'; factor: number }
  /** After a successful save: unsaved changes become persisted, and everything is the new 1× baseline. */
  | { type: 'commitSaved' };

export function recipeDraftReducer(state: RecipeDraft, action: RecipeDraftAction): RecipeDraft {
  switch (action.type) {
    case 'load':
      return { ...state, ...action.fields };
    case 'upsertChange': {
      const prev = state.currentUnsavedChanges;
      const i = prev.findIndex((c) => c.from === action.change.from);
      const next = i > -1 ? prev.map((c, j) => (j === i ? action.change : c)) : [...prev, action.change];
      return { ...state, currentUnsavedChanges: next };
    }
    case 'revertChange':
      return {
        ...state,
        currentUnsavedChanges: state.currentUnsavedChanges.filter((c) => c.from !== action.from),
      };
    case 'setScale':
      return { ...state, selectedScaleFactor: action.factor };
    case 'commitSaved': {
      const persisted = [...state.persistedChanges, ...state.currentUnsavedChanges];
      return {
        persistedChanges: persisted,
        currentUnsavedChanges: [],
        selectedScaleFactor: 1,
        baselineScaleFactor: 1,
        baselineAppliedChanges: persisted,
      };
    }
  }
}

/** True when scale or ingredient changes differ from the baseline. */
export function computeHasModifications(d: RecipeDraft): boolean {
  const hasScaleChanges = d.selectedScaleFactor !== d.baselineScaleFactor;
  const hasIngredientChanges =
    d.currentUnsavedChanges.length > 0 ||
    d.persistedChanges.length !== d.baselineAppliedChanges.length ||
    !d.persistedChanges.every((change, index) => {
      const baselineChange = d.baselineAppliedChanges[index];
      return (
        baselineChange &&
        change.from === baselineChange.from &&
        JSON.stringify(change.to) === JSON.stringify(baselineChange.to)
      );
    });
  return hasScaleChanges || hasIngredientChanges;
}

export function countRemovals(d: Pick<RecipeDraft, 'persistedChanges' | 'currentUnsavedChanges'>): number {
  return [...d.persistedChanges, ...d.currentUnsavedChanges].filter((c) => !c.to).length;
}

/**
 * Builds the change for a substitution picked in the modal. The modal shows amounts at the
 * current scale; the change stores the 1× (unscaled) amount so it can be re-scaled later.
 */
export function buildSubstitutionChange(
  ingredient: StructuredIngredient,
  substitution: SubstitutionSuggestion,
  selectedScaleFactor: number,
): { change: AppliedChange; isRemoval: boolean } {
  const isRemoval = substitution.name === REMOVE_INGREDIENT;

  let originalNameForSub = ingredient.name;
  // Only parse when it's a UI-generated display name like "olive oil (substituted for butter)".
  // Natural language alternatives like "fresh cilantro or mint" must be kept as-is so the
  // render-time match (c.from === baseIngredient.name) can find the right change.
  if (ingredient.name.includes('(substituted for ')) {
    const { substitutionText } = parseRecipeDisplayName(ingredient.name);
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

  return {
    isRemoval,
    change: {
      from: originalNameForSub,
      to: isRemoval
        ? null
        : {
            name: substitution.name,
            amount: originalSubstitutionAmount,
            unit: substitution.unit ?? null,
            preparation: substitution.description ?? null,
            suggested_substitutions: null,
          },
    },
  };
}
