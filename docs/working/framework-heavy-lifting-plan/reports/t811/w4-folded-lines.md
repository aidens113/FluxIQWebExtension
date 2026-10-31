# t811 w4-folded-lines

## Outcome
Done. All three goals met; activity/ tests pass. tsc and structure-audit fail only in flow-bootstrap/ (W1's lane), not in activity/.

## What changed and why
- New `activity/folded-test/`: `folded-test.ts` (`automationStudioActivityFoldedTest(call, result)`: for a `core.submit_*` result whose `evidence.tested` is an object, returns a synthetic `core.test_subflow` call, an answer built from `tested` (+ its `code` as `resultCode`), and the Core line), `folded-test-line.ts` (the line via `automationStudioActivityFoldedReason`), `index.ts` barrel, `tests/folded-test.test.ts`.
- `activity/observer.ts` (about 12 lines added): after the submit's own `toolActivity`, if a folded test exists, emit a thought row carrying the Core line, then a started and an ended tool row for the test. The ended row uses `automationStudioActivityCandidateResult("core.test_subflow", ...)`, so status and card are what a real test answer gets. The submit's own row and the model's reason are unchanged. A `from` run is detected by `testedWith.from` or `tested.fromStep`.
- Goal 1 needed no fix: a Core-written `complete` decision already shows through `decide` -> `narration.decided(thought, undefined)` -> `say`, then the completion-check note follows.

## Exact chat lines produced (from the test run)
Submit with a passing `tested`:
- `thought | Saving one part of the Flow | Said reason "Saving the part so it can be tried."` (held, then said after the submit ended)
- `tool | Saving one part of the Flow — done | Said: the steps were accepted`
- `thought | Testing one part of the Flow | Core tested the saved version from its start because the submission asked for it.`
- `tool | Testing one part of the Flow — passed | Said: the test passed and the Flow did what you asked: 2 steps done`

(The word "revision" in my input becomes "version": the reason screen rewrites it, as it should for a person.)
A `from` test: "Core ran the saved version from the named step because the submission asked for it."; a "no" verdict ends `failed`.
Core `complete`: `thought | Checking whether the Flow is finished | Core finished the part because the saved version passed its test.` then `note | Completion check | succeeded | The proposed Flow's plan checks out; it still has to run cleanly`.
Submit without `tested`: no `core.test_subflow` row; one thought only.

## Commands run and observed results
- `FLUXIQ_TEST_GROUP=parallel npx vitest run src/programs/automation-studio/runtime/activity` (inside the lock) -> `Test Files 58 passed (58)`, `Tests 484 passed (484)`. This includes person-facing-sweep and observer tests, and my 4 new tests (which run every row through `personFacingTextFaults`).
- `tsc --noEmit -p .` (inside the lock) -> exit 2; every error is in flow-bootstrap/subflow-candidate/ (`subflow-trial-gate.ts(510,213)` TS2345 and `tests/builder-loop-auto-complete.test.ts` lines 24, 37, 45 TS2322, all `undefined` not assignable to `JsonValue`). None in activity/.
- `node scripts/structure-audit.mjs` -> `4 violation(s)`, all `[directory-files]` in flow-bootstrap/candidate/ (26 files) and flow-bootstrap/subflow-candidate/ (28 files; tests/ 30). activity/ has none.

## Not verified
- The real W1 builder was not run; I used the stable interface (`evidence.tested`, `evidence.testedWith`) as described in the brief.
- The tsc and audit results come from the run before my final test-only edit (a `personFacingTextFaults` check split per part, plus a removed console.log). The vitest result is after it.

## Open questions or contradictions found
- None blocking. The flow-bootstrap tsc errors and directory-file overflow are W1's to fix.
