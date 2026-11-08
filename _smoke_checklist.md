# Smoke checklist (run before merging any refactor step)

~10 minutes in the simulator. Each line is a flow that has broken before or that the refactor touches.
Mark ✅ / ❌ and note anything odd (wrong amounts, missing title/image, unexpected error modal).

## Getting a recipe onto the summary screen (the 7 entry points of `app/recipe/summary.tsx`)
1. **URL import** — Import tab → paste a blog URL → loading screen → summary shows title, image, ingredients, steps.
2. **Text import** — paste raw recipe text → summary. Then try a dish name (e.g. "chicken tikka masala") → match picker appears → pick one → summary.
3. **Image upload** — upload a photo/PDF of a recipe → summary. If similar recipes exist, the match picker should appear (this was crashing before `b6018af`).
4. **Library** — Library tab → open a recipe → summary.
5. **Saved folder** — open a folder → open a saved recipe that has a substitution → summary shows the substitute *without* "(substituted for …)" labels.
6. **Mise** — Mise tab → open a recipe → summary.
7. **Deep link** — open a share link (`cookolea.com/...`) → summary.

## On the summary screen
8. **Scale** — change servings 2× and ½×: amounts update (incl. fractions like "1 1/2" → "3"), "to taste"/blank amounts unchanged.
9. **Substitute + remove** — substitute one ingredient, remove another: labels "(substituted for X)" and "(removed)" appear; scaling still applies to the substitute.
10. **Cook** — after #9, tap Cook → lands on Mise without "Missing required fields". Open it in cook mode: steps reflect the swap.
11. **Save to folder** — save a modified recipe to a folder → reopen it from the folder → changes persisted.

## Elsewhere
12. **Grocery list** — Mise grocery list shows items from active recipes; check/uncheck an item; reopen the app → state kept.
13. **Background mid-parse** — start a URL import, switch apps for ~10s, come back. (Known bug today: shows "check your internet". Note the behavior; the API-client work targets this.)
14. **Login / logout** — sign out, sign back in with Apple → lands on tabs, library intact.
