import { describe, it, expect } from 'vitest';
import { formatDisplayAmount } from '@/utils/recipeUtils';

describe('formatDisplayAmount', () => {
  it.each([
    ['0.33', '⅓'], ['0.5', '½'], ['.25', '¼'], ['1.5', '1½'], ['0.66', '⅔'], ['2.0', '2'], ['1.333', '1⅓'],
  ])('%s → %s', (input, out) => expect(formatDisplayAmount(input)).toBe(out));

  it.each(['1-2', '1 1/2', 'to taste', '3', '½', '1/3', ''])('leaves %j unchanged', (s) => {
    expect(formatDisplayAmount(s)).toBe(s);
  });

  it('handles null/undefined/number', () => {
    expect(formatDisplayAmount(null)).toBeNull();
    expect(formatDisplayAmount(undefined)).toBeNull();
    expect(formatDisplayAmount(0.5 as any)).toBe('½');
  });
});
