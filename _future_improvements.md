# Future Improvements

A running list of known issues and improvements we've deliberately deferred. Each entry captures the problem, root cause, and the intended fix so we can pick it up later with full context.

---

## Recipe parse fails when app is backgrounded ("check your internet")

**Status:** Deferred — not fixing today. Documented 2026-07-26.

### Symptom
While a recipe link is parsing (the loading screen with the rotating "recipe gnomes" / "cleaning up the clutter" messages), if the user backgrounds the app — e.g. swipes away to answer a text, *not* killing the app — the parse fails with a misleading error: **"Please check your internet connection and try again."** The user's internet is actually fine.

### Root cause
The URL parse is a **single, long-lived `fetch()` POST** to `/api/recipes/parse`, run on the loading screen. It has **no `AbortController`, no timeout, and no background handling**.

- `components/loading/LoadingExperienceScreen.tsx:309` — the `fetch` call (kicked off in a `useEffect` at ~`:436`, catch block at `:420`).

Recipe parsing is slow (page fetch + LLM work), often 15–40s. When the app is backgrounded, iOS suspends the JS runtime and tears down the in-flight network socket. On return to foreground, the frozen `fetch` rejects with `TypeError: Network request failed`.

That error text then gets misclassified as an offline error:
- `utils/normalizeAppError.ts:113` — regex matches `Network request failed` → routes to `getNetworkErrorMessage`.
- `utils/errorMessages.ts:62-64` — `isOfflineError()` is true → returns "Please check your internet connection and try again."

So the code can't distinguish "genuinely offline" from "iOS suspended a long request," and blames connectivity for both.

**Same exposure exists** on the `raw_text` path: `hooks/useRecipeSubmission.ts:200` (also an un-aborted, un-timed-out `fetch`). Any fix should cover both.

### Intended fix

**Option A — Pragmatic (frontend-only, recommended first step):**
Scoped to `LoadingExperienceScreen.tsx` (and the `raw_text` fetch in `useRecipeSubmission.ts`):
1. Add an `AppState` listener that records when the app went to `inactive`/`background` during the parse.
2. In the `catch` block, when the error is a network-type failure, distinguish the cause:
   - If the app was backgrounded (or `NetInfo.fetch()` confirms the device is actually online), **auto-retry the parse** instead of showing the error — ideally once the app returns to `active`. The screen already has a `handleRetry()` that re-runs the parse via `componentKey`.
   - Only show the "check your internet" message when `NetInfo` confirms the device is genuinely offline (at which point the message is correct).
3. Cap auto-retries (e.g. after N attempts show an honest "This is taking longer than expected" fallback) so a user who keeps backgrounding doesn't loop forever.

Pieces already available: `utils/networkUtils.ts` has `getNetworkStatus()` (NetInfo) and `isOfflineError()`.

UX with Option A: brief backgrounding → silent restart, completes normally (no false error). Downside: work done server-side during suspension is discarded, so the parse restarts from scratch each time — heavy multitaskers may see slow/restarting parses.

**Option B — Long-term (backend work, most robust):**
Convert parsing from one long request into a **job + poll** model — `POST` returns a `jobId` immediately, the client polls a short `GET /status/:id`. Short polls survive backgrounding trivially, and the server keeps working while the app is suspended, so the user returns to a finished (or nearly finished) recipe regardless of how long they were away.

**Suggested path:** ship Option A now (small, frontend-only, kills the wrong error), move to Option B later if analytics show users frequently background long parses.

### Key files
- `components/loading/LoadingExperienceScreen.tsx:309` (fetch), `:420` (catch), `:436` (effect)
- `hooks/useRecipeSubmission.ts:200` (raw_text fetch, same exposure)
- `utils/normalizeAppError.ts:113` (network branch)
- `utils/errorMessages.ts:62-64` (the exact "check your internet" string)
- `utils/networkUtils.ts` (`getNetworkStatus`, `isOfflineError`)
- `app/loading.tsx` (loading route that renders the screen)

---

## Ingredient substitution: only 2 options shown — offer more and/or allow manual entry

**Status:** Deferred — not fixing today. Documented 2026-07-26.

### Goal
The substitution modal only ever shows **2 suggested alternatives** per ingredient (e.g. for "lamb mince": beef mince, brown lentils) plus a "Remove ingredient" option. We want to give users more choice, via either (or both):
1. **Show more than 2 suggested options** per ingredient.
2. Let a user **manually type their own substitute** (free text) instead of only picking from AI suggestions — with the validation that would require.

### Root cause of the "only 2 options"
The modal is **not** truncating — it renders *all* valid substitutions it's handed plus "Remove ingredient" (`app/recipe/IngredientSubstitutionModal.tsx:63-77`). The reason only 2 appear is **upstream**: the LLM is only ever *asked* to generate 1–2 substitutions per ingredient, so that's all that's ever stored in each ingredient's `suggested_substitutions` and passed to the modal.

The instruction lives in the prompts:
- `server/llm/parsingPrompts.ts:65` — "For every ingredient, YOU MUST suggest 1–2 realistic substitutions..." (populated at parse time).
- `server/llm/modificationPrompts.ts:136` — "Suggest 1–2 realistic substitutions..." (for modified ingredients).

(The `.slice(0, 2)` at `IngredientRow.tsx:142` is only for a debug log, not a UI cap.)

**No manual/free-text input exists.** `IngredientSubstitutionModal.tsx` has no `TextInput`; the user taps one of the AI-suggested options (radio list, `:125-180`) or "Remove ingredient", then taps "Apply Changes" (`onApply(selectedOption)`).

### Separate, unrelated limit worth knowing
There *is* a hard cap of **2 ingredient _removals_** per recipe (not substitutions — substitutions are unlimited). It's enforced in `app/recipe/summary.tsx` at `:1632-1642`, `:1795-1799`, and `:2416-2420` ("You can only remove up to 2 ingredients"). Not what this entry is about, but noted so the two "2"s don't get confused later.

**Downstream when a change is applied:**
- Applying a substitution only updates local `currentUnsavedChanges` state in `summary.tsx` (revertible; nothing sent to backend yet).
- The substitute's amount/unit comes **pre-filled from the suggestion object**; quantity is unscaled to base then re-scaled for display client-side (`summary.tsx:518-630`, `:1673-1698`). No backend quantity recalculation.
- Steps are rewritten later, when cooking/saving, via `POST /api/recipes/modify-instructions` (`summary.tsx:1827`; handler `server/routes/recipes.ts:496-545` → `server/services/instructionModification.ts`). The LLM rewrites instructions for the swap/scaling and may suggest a new title.
- Backend validation (`recipes.ts:504-524`) only checks structural shape (arrays present, positive scaling factor). **There is no check that a substitute is a real/edible food** — current safety comes purely from constraining choices to the AI-suggested list.
- **No nutrition/calorie recalculation** happens anywhere in this flow.

### What a fix would involve

**If showing more suggested options** (the "only 2" the user actually sees): raise the count in the prompt directives (`parsingPrompts.ts:65`, `modificationPrompts.ts:136`) from "1–2" to e.g. "3–4". Trade-offs to weigh:
- Increases parse latency/cost and the size of stored `suggested_substitutions` on every ingredient.
- Existing already-parsed recipes won't gain more options retroactively unless re-parsed (options are baked in at parse time). A small on-demand "get more substitutions for this ingredient" endpoint could backfill without re-parsing the whole recipe.
- Quality can drop as you ask for more — the 3rd/4th suggestion is often a stretch. Worth a quick eval.

**If allowing free-text manual substitutes** — the "relevant checks" that don't exist today and would be needed:
- **Food validation** — verify the typed text is a real/edible ingredient. Today safety relies on the choices being AI-constrained; free text removes that guardrail. Likely needs a validation call (LLM or lookup).
- **Amount/unit resolution** — a suggestion object carries `amount`/`unit`; a free-text entry has none. Need to infer or prompt for a sensible quantity/unit for the substitute (see the `to` object construction at `summary.tsx:1688-1698`).
- **Step rewriting** already handles arbitrary substitute names — `/api/recipes/modify-instructions` only passes `change.to.name` (a string) to the LLM — so instruction updates would work, but quality depends on the substitute being sensible (reinforcing the need for validation above).

### Key files
- `app/recipe/summary.tsx:1632-1642`, `:1795-1799`, `:2416-2420` (removal cap enforcement), `:1616-1745` (`onApplySubstitution`), `:1827-1852` (modify-instructions call), `:518-630` (client-side scaling)
- `app/recipe/IngredientSubstitutionModal.tsx:63-77` (option list build), `:125-193` (selection + apply)
- `app/recipe/IngredientRow.tsx:129-167` (entry point to open modal)
- `server/routes/recipes.ts:496-545` (modify-instructions handler + validation)
- `server/services/instructionModification.ts` (step rewrite service)
- `server/llm/parsingPrompts.ts:65`, `server/llm/modificationPrompts.ts:136` (the "1–2 suggestions" prompt directive)
