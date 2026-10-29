# t790 / fix1: the lone-yes confirming ask after a double no whose re-asks split, and the unsure reason's wording

## Outcome

Done. Both goals are in Core's `agreement/unsupported-no.ts`, with six tests in `agreement/tests/membership-reask.test.ts`
(one existing, five new). All 14 test files under `tests/reask-route/tests/` and `agreement/tests/` pass. That includes
"a double no Core refused every defect of (t771)" in `lone-yes-route.test.ts`, which is unchanged.

## What changed and why

CORE = `C:/Users/osrs_/FluxStuff/fxwork/t790/!FluxIQ` and RV = `$CORE/packages/fluxiq/src/programs/automation-studio/runtime/result-verification`.

**`$RV/agreement/unsupported-no.ts`**

- **Guard (Goal 1).** The old guard was `yes && nos.every((call) => notTaken.has(call))`. It is now `yes && taken.every(modelYes)`. The confirming ask is now made on `[...notTaken.keys()][0]` instead of `nos[0]`.
- **I checked the debug's guard against the code before adopting it.** By the time the guard runs, `standing` has already returned whenever `taken` holds a model no.
  - **Split** (`nos=[n]`, the other call a model yes): to get this far, `notTaken` must be exactly `{n}`, so `taken=[yes]`. Both guards are true, and `[...notTaken.keys()][0] === n === nos[0]`. The behaviour is the same as before.
  - **Double no, both re-asks refused:** `taken` is empty, so `yes` is undefined. Nothing is asked and the outcome is `model_unconfirmed`, as before.
  - **Double no, one re-ask yes and the other still refused** (the shape of run-mvswewhy-e4e469d4): `taken=[yes]`, so the confirming ask goes to the refused call. This is the new case.
  - **Double no, one re-ask "unknown" and the other refused:** `yes` is undefined, so nothing is asked.
  - **A grounded no** still returns through `standing` before the guard is reached.
  - `notTaken` is filled in the order of `nos` (1, then 2), so "first refused no" is well defined.
- **Reason (Goal 2).** A new map, `named`, records for each refused call how many defects its re-ask listed: `again.repair.judgement.defects.length`. That list always exists here, because `supportOf` treats a missing list as supported. The value is `undefined` where the re-ask came back unusable (`basis !== "model"`). A new private helper, `namedWords`, turns this into words:
  - "it named none"
  - "it named one defect, which Core cannot find in its record"
  - "it named N defects, none of which Core can find in its record"
  - "it gave no answer that could be read"
  - When both nos were refused: "the first … and the second …", or "each …" when the two clauses are the same.
- **Header.** I added a t790 paragraph citing `run-mvswewhy-e4e469d4`, plus short comments at the guard and at `named`.
- The `CONFIRM_LONE_YES` text is unchanged, so `lone-yes-route.test.ts` still matches on it.

**`$RV/agreement/tests/membership-reask.test.ts`**

I added a scripted judge that works like this:

- both first asks return `TESTED_CLUB_NO`;
- the first recheck (call 1) returns `first` and the second recheck (call 2) returns `second`;
- the request carrying `CONFIRM_LONE_YES` returns `confirm`.

A helper reads the `verificationCheck` of each confirming ask from the report's interventions. It asserts first that there is one intervention per request.

- **Fix 1:** recheck yes, then no, then the confirming ask yes. Expects the confirming ask on call 2 (`[2]`), `verdict` "answers", and `FailsRun` false.
- **Twin:** the confirming ask returns the no. Expects the confirming ask on call 2, `unsure` / `model_disagreed` / `refutationUnsupported`, `unsupportedNo.calls` `[2]`, and the reason "…it named one defect, which Core cannot find in its record, so that no is not taken."
- **Reason, single no:** the second recheck returns a no with `defects: []`. Expects "…it named none, so that no is not taken."
- **Reason, both nos with different answers:** the first recheck returns `defects: []` and the second returns `TESTED_CLUB_NO`. Expects no confirming ask, `model_unconfirmed`, calls `[1,2]`, and "the first named none and the second named one defect, which Core cannot find in its record, so neither no is taken."
- **Reason, both nos the same:** "each named one defect, which Core cannot find in its record, so neither no is taken."

**Existing tests asserting the old wording:** none. A grep of `$CORE/packages/fluxiq/src` for "Asked once more", "list each,", "neither no is" and "so that no is not" matched only the source line and `refuted-no/reask.ts`, which has its own separate reason. A grep for "named one" found nothing in result-verification or activity tests.

## Commands run and observed results

- `cd $CORE && pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/agreement/tests/membership-reask.test.ts` -> "Test Files 1 passed (1), Tests 6 passed (6)".
- `cd $CORE && pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/ src/programs/automation-studio/runtime/result-verification/agreement/tests/` -> "Test Files 14 passed (14), Tests 82 passed (82)". This includes `lone-yes-route.test.ts` (3 tests), `unsupported-no-route.test.ts` (19), `split-no-route.test.ts` (3), `membership-reask.test.ts` (6) and the rest.

## Not verified

- I did not run a typecheck or the whole-package suite, because the brief reserves them for the supervisor.
- The "gave no answer that could be read" wording, for an unusable re-ask, has no test.
- I did not run the new tests against the old code to watch them fail. From the code, the old guard is false in this shape, so `confirmingChecks` would be `[]`, not `[2]`.
- I did not check other callers of `reason` downstream, such as the activity or chat display. The grep found none asserting the old text.

## Open questions or contradictions found

- The `CONFIRM_LONE_YES` words say "one check answered that the result does what the request asks, and every check that answered no named no defect Core can find … even asked once more". In the new double-no case, the yes check had itself answered no first, naming nothing Core found, before turning yes. The words stay true, but they do not tell the judge that. I left them unchanged, as the brief and the existing test require.
- The debug's judgement call still needs a lead decision: in this shape, the yes was reached through Core's recheck words rather than on a first ask. The code now follows the debug's proposal.
