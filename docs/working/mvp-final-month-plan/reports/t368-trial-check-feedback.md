# t368 report: a trial's failed check tells the model what it needs; optional steps and repeated failures handled

## Outcome

Done. All four goals are in place in the t368 Core tree (`C:\Users\osrs_\FluxStuff\fxwork\t368\!FluxIQ`), with fail-first tests. Nothing is committed.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

**(1) Feedback for a failed check names what it waited for.** New file `service/candidate-trial/check-step.ts`, wired into `service/candidate-trial/feedback.ts` and exported from the barrel.
- It applies to a failed step whose node is a wait or an assert (definition id contains `wait` or `assert` as a segment). Such a step gets:
  - `waitedFor`: the wait's `text`, or the first `expected` text in an assert's `conditions`;
  - `seen`: a plain sentence;
  - `advice`: a check that only confirms the act before it is not needed, because the judge reads the page the run ends on.
- When the domain reports it, the step also gets `textPresence` and `visibleNear`, and `seen` says one of:
  - the text "is on the page but stayed hidden for the whole wait, inside something closed such as a collapsed panel, a menu or a tab", or
  - it "is not on the page at all";
  - either way followed by "The visible text most like it: ...".
- Without the domain's detail, `seen` says: `The step waited for "Cart (3)", and the page did not show it.`
- **Where the detail is read from (changed after t369's update).** It is read only from `attempt.outputs.result.result`, which is the action result `payload.result` that a failed dispatch keeps. Values are bounded again in Core:
  - `textPresence` must be exactly `hidden` or `absent`;
  - `visibleNear` keeps string items only, collapses whitespace, and is cut to 3 items of at most 80 characters;
  - any other shape is ignored.

**(2) Candidate-only guidance (`flow-bootstrap/plan/flow-script-format.ts`).**
- `AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE` gets a new sentence: do not end the Flow with an invented confirmation check, because the run is judged from the page it ends on. A wait belongs only where a later step needs the page ready, or where the instruction asks for the check. It waits only for something the page visibly showed after the act during exploration, never for text in a closed panel or menu, or a notice that has already gone.
- The example itself used to end with exactly such a check (`wait_for_text "added to your basket"`). That step is removed, so the example now ends on the add-to-basket press.
- The header comment records the change.
- The legacy format and completion schema are unchanged. Their existing sha256 pins pass.

**(3) F1: an optional step that cannot be done no longer fails the trial (`flow-bootstrap/verification/detached-execution.ts`).**
- Cause, traced and reproduced:
  - The trial ran with `recoveryBudget { maxRecoveryAttemptsPerSubflow: 0, maxReroutesPerRun: 0 }`.
  - The executor offers an authored failed route (`deterministic_path`) only while both budgets last (`executor/recovery-ladder.ts:82`). So the optional shape's failed edge into its Merge was never taken.
  - The continuation rule then stopped the run: for a domain output it cannot enumerate ports (`executor/defensive/continuation.ts:122`).
  - An absent target was unaffected, because it is skipped before the ladder runs. A timeout was affected.
- Fix: both budgets are now set to the number of `failed` edges the trial graph declares, so each authored failed route can be taken once. A graph with none keeps 0. The model rung and patches stay off.

**(4) F2: the same failure twice stops re-testing (`flow-bootstrap/candidate/trial-gate.ts`).**
- The gate records the step each `execution_failed` trial stopped at: the last entry of `feedback.steps` when it failed, identified by `step`, `definitionId`, `failureCode` and the run `code`.
- When a second trial of the same revision and digest stops at the same step:
  - its answer carries `retestsLeft: 0`, no `retry_allowed` reason, `failedStep`, and a "change that step (or remove it if it only checks the act before it)" instruction;
  - a later test of that revision is refused `candidate.trial_same_failure`;
  - completion is refused with the same instruction (code `candidate.trial_execution_failed`).
- This works within the existing 3-trial limit. Failures at different steps still allow re-tests.

**Regenerated:** `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`, which went stale. The only differences are line-number shifts.

## Commands run and observed results

All in `C:\Users\osrs_\FluxStuff\fxwork\t368\!FluxIQ`.

**Fail-first runs (fix removed, then restored):**
- F1, budget set back to 0: `npx vitest run .../verification/tests/detached-execution.test.ts` -> 2 failed (the optional last wait, and several optional steps); the non-optional case passed.
- (1), check feedback removed from `feedback.ts`: `npx vitest run .../candidate-trial/tests/feedback.test.ts` -> 5 failed | 6 passed.
- F2, `recordStop` disabled: `npx vitest run .../candidate/tests/trial-gate.test.ts` -> 1 failed (the same-failure test) | 19 passed.
- (2): the new guidance test asserts text that did not exist before. It was not run against the old text.

**Final runs:**
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/ .../service/candidate-trial/ .../service/flow-bootstrap-commands/tests/ .../executor/tests/` (from `packages/fluxiq`) -> Test Files 150 passed | 1 skipped; Tests 2032 passed | 2 skipped.
- Earlier, conversations command tests, activity candidate words, service-bootstrap generation, llm-generation handler and `_shared` candidate-start-hook -> 54 files, 557 tests passed. These were not re-run after the final check-step change, which they do not import.
- `npx tsc --noEmit -p .` (from `packages/fluxiq`) -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (289 warning(s), 710 baselined)`, with no warning for any file I touched. It also printed "1 baseline entries can be lowered". I did not run `structure:baseline`, because `.structure-baseline.json` is shared.
- `pnpm docs:check` -> first "framework-reference.md is stale"; after `pnpm docs:reference`: `structure-audit: passed (0 warning(s), 0 baselined)` and "Deterministic framework reference is current."
- No new `as never`: `git diff | grep "^+" | grep -c "as never"` -> 0. The new `check-step.ts` has none.

## Not verified

- No live, Lab or provider run. The `outputs.result.result` path comes from reading Core `io-policy.ts` (failed dispatch outputs carry `result: result.payload`) and t369's message. No real trial trace with t369's fields has been seen.
- The full Core suite was not run, per the twice-a-day rule.
- I did not check that reroutes to `builtin.policy.recovery` nodes stay off in trials. A non-zero budget now also allows that reroute when a candidate graph contains such a node and declares failed edges. Script candidates do not normally contain one.

## Open questions or contradictions found

1. **t369 placement.** The coordinator's update says the fields arrive at `payload.result.{textPresence, visibleNear}` and `metadata.failureDiagnostics`. In Core only the first reaches the attempt trace, as `outputs.result.result`. Command metadata is not copied onto node outputs (no Core reader of `failureDiagnostics`). Core reads the first only. If t369 put the fields on the validation instead of the action result's top level, Core would not see them; there is a test pinning that.
2. **Playback parity.** A saved Flow's playback runs under the Flow settings' budget (default `maxRecoveryAttemptsPerSubflow: 2`). With three or more optional steps that fail in a way other than an absent target, playback could still stop at the third, while a trial now goes on. The same continuation gap exists in playback for a failed optional step once the budget is spent. The structural fix is in the executor, which I do not own: either do not count the optional shape's own failed route against the budget, or have the assembler set `metadata.optional`.
3. **Loop example.** `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`'s row example still ends its span with a `wait_for_text $row.name` confirmation. I left it alone because it is the `repeat through` end and has its own tests. It may teach the same pattern.
