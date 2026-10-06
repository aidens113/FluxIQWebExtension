# t281-c1a-reversal: report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t281/!FluxIQ`, branch `task/t281-lane-a-r3-fixes`. Nothing was committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Both tasks were written fail-first. The new tests failed for the expected reasons and pass after the fix. The named test folders pass, and the package typecheck passes.

## What changed and why

### Task 1, C1a: settings never rewrite what a step ran with

- **New `R/flow-draft/amendment/settings-rewrite-run.ts`.** It has one export, `automationStudioFlowDraftSettingsRewriteRun(step, settings): boolean`. It is true when a settings key is a parameter the step ran with and the value differs from the one it ran with.
  - "Ran with" means the parameters of `ranWith` **and** of `input`, read under `parameters` when the argument nests them and from the argument itself otherwise (flat domain-tool arguments).
  - A key whose value equals either of those passes. Keys the step never had (expectedState, timeoutMs, waitFor, attempts) pass.
  - Equality is structural and ignores key order.
- **Exported from the barrel**, `R/flow-draft/amendment/index.ts`.
- **New reason in `R/flow-draft/amendment/types.ts`:** `settings_rewrite_run` added to the reason union.
- **Check placed in `R/flow-draft/amendment/apply.ts`.** It runs once per amendment, before anything changes. It comes after the `no_such_step`, replaced-attempt, `run_by_the_loop`, `unrepeat`, `did_not_work` and not-a-Flow-step refusals, and before `act_on_a_read` and the bind, reorder, routing and disposition branches.
  - A rewriting amendment is refused `settings_rewrite_run` and is skipped whole: no disposition, act claim, place, move, routing, bind or settings change.
  - Only `apply.ts` calls `move.ts`, `bind.ts` and `route.ts` (grep over `src` confirms it). So this single gate comes before all four places that merge settings, and those three files are unchanged. The helper's header says so. This departs from the brief's wording ("used at every site"), which would have meant unreachable duplicate checks; the intent, that no merge bypasses the check, holds.
- **Exhaustive maps updated:**
  - `R/llm/draft-amendment-feedback.ts`: exactly one `REFUSAL_REASONS` entry, right after `strands_a_step`, with the brief's wording verbatim. Nothing else in the file changed.
  - `packages/fluxiq/src/ui/activity-action/refusal-words.ts`: person-facing words, "that would change what the step was done with, which makes it a different step".
  - `R/flow-bootstrap/evidence-loop-steps.ts`: `EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS` (exhaustive by type) now includes `settings_rewrite_run: true`.
  - `R/llm/tests/draft-amendment-feedback.test.ts`: its `everyReason` map is exhaustive by type, and `tsc` failed until the reason was named there. I added `settings_rewrite_run: true` to that one line.

### Task 2, F1 fix 3: rule (b) and reversal on a drop

- **`R/flow-draft/reversal.ts`.** The between-steps check now sits inside the `earlier.disposition === "kept"` branch (rule (a)), after the cancels/routing guard. Rule (b) is no longer blocked by kept steps between the halves.
  - The header now says that the check is rule (a) only, why rule (b) ignores what lies between (the earlier half never runs), and cites run mux6n7m4.
  - The header also says reversal runs when an amendment takes a kept step out, and that a step taken out loses its acts.
- **`R/flow-draft/amendment/apply.ts`.** `automationStudioFlowDraftDropReversals` now runs when `disposition === "kept" || leavesFlow`. `leavesFlow` is a kept step becoming dropped or exploratory, which is the same condition that already records a withdrawal for the strand check.
- **Act claim release.** `takeOut` already does `delete step.acts`, so the act is released. The new amendment test shows this through the real checklist: `automationStudioInstructedActsChecklist` shows `a1` as `{done: 3}` before the drop and `{todo: "no_step_added"}` after it.

### Tests added

- `R/flow-draft/amendment/tests/settings-rewrite-run.test.ts`, 4 tests:
  - The run mux74k5q 0025 case: a run-node press shown by handle and run by selector, with `add` + `act` + `settings.target` set to another handle. It is refused, the whole draft is deep-equal to before, and the other step's act claim is intact.
  - `selector` and `element` (ranWith keys) given other values are refused.
  - On a flat argument, refusal also covers `keep`, `optional`, `reorder` and `bind`, each leaving the draft unchanged.
  - `expectedState` and `timeoutMs` still apply with `add` + act. Settings equal to the shown or ran value still apply.
- `R/flow-draft/amendment/tests/drop-reversal.test.ts`, 1 test: a lone `{step: 1, change: "drop"}` on the kept "off" half takes the kept "on" half out (`cancels: "d1"`, acts removed, checklist todo).
- `R/flow-draft/tests/reversal.test.ts`: the `run mux6n7m4` case copied from live-a-r3-f1.md, plus an assertion that the taken-out step's acts are gone.

## Commands run and observed results

All were run from `packages/fluxiq` unless noted.

1. **Fail-first.** `npx vitest run .../amendment/tests/settings-rewrite-run.test.ts .../amendment/tests/drop-reversal.test.ts .../flow-draft/tests/reversal.test.ts` printed `Tests 5 failed | 11 passed (16)`.
   - reversal mux6n7m4: `expected [] to deeply equal [ 5 ]`.
   - drop-reversal: `expected [ 'dropped', 'kept', 'kept' ] to deeply equal [ 'dropped', 'kept', 'dropped' ]`.
   - The three settings refusal tests: `expected { applied: 1, refused: [] } to deeply equal { applied: +0, refused: [ ... ] }`.
   - The "still applies" test passed before the fix, as expected.
2. **After the fix.** `npx vitest run R/flow-draft/amendment/tests R/flow-draft/tests R/llm/tests/draft-amendment-feedback.test.ts src/ui/activity-action/tests R/llm/decision-handlers/tests` printed `Test Files 41 passed (41)`, `Tests 546 passed (546)`.
3. **Other touched maps.** `npx vitest run R/flow-bootstrap/tests/evidence-loop-steps.test.ts R/activity` printed `Test Files 23 passed (23)`, `Tests 240 passed (240)`.
4. **First typecheck.** `npx tsc -p tsconfig.json --noEmit` exited 2.
   - Mine: `draft-amendment-feedback.test.ts(227,9)` was missing `settings_rewrite_run`. Fixed as described above.
   - Not mine: two errors in `R/llm/repeat-guard/tests/outcomes.test.ts` (`checked` property), from another worker's in-flight edit.
5. **Second typecheck.** `npx tsc -p tsconfig.json --noEmit` exited 0, with no output.
6. **Final rerun.** The same folders as in 2, plus `evidence-loop-steps.test.ts`, printed `Test Files 42 passed (42)`, `Tests 576 passed (576)`.
7. **Structure audit.** `node scripts/structure-audit.mjs`, run from the Core root, reported 1 violation: `[file-lines] R/llm/evidence-loop.ts: 801 lines exceeds the 800-line limit`. That file is another worker's (I did not touch it). None of my files were flagged.

## Not verified

- No full suite, build or Lab run was done (per the brief). No live run checks that the model reacts to `settings_rewrite_run` as intended.
- The real shape of step 12's `ranWith` in run mux74k5q was not read from the run artifacts. The test assumes the run-node shape: `input.parameters.target = {handle}` and `ranWith.parameters` holding `selector`/`element`. Because the check uses the union of `input` and `ranWith` keys, `target` is caught whether or not `ranWith` keeps it.
- I did not check whether any downstream code (extension or domain) sends amendments whose `settings` legitimately carry a parameter key with a new value. A grep for `strands_a_step` in the downstream `domain/src` and `apps/extension/src` found no exhaustive map that needs the new reason.

## Open questions or contradictions found

- **Union instead of "else".** The brief says "keys of `ranWith.parameters`, else `input.parameters`". I used both because a press shown by handle runs as a selector: `ranWith` may lack `target` while `input` has it, which is exactly the C1 shape. "Else" would have let C1 through in that case.
- **The check also covers written and checked-candidate steps.** Their `input` is what they would run with, and rewriting it through settings is the same defect.
- **Reversal and the strand check can disagree.** Reversal now runs on a drop before the strand check. If the strand check later puts a dropped toggle half back (`strands_a_step`, which only happens if that press also navigated), the partner reversal took out stays out with `cancels`. This is unlikely for a toggle, and the existing `keep` path has the same ordering. It is not fixed here.
- **`llm/evidence-loop.ts` (~:214, :480) still calls reversal only on kept.** That is right for those sites, which add steps, but a drop never reaches them. That file was out of my ownership.
- **Not done: the report's general fold rule.** live-a-r3-f1 Q4 proposes folding each key's toggles from the arrival state. That would also catch a kept toggle whose earlier same-key partner is two presses back. Only rule (b) as briefed was changed.
