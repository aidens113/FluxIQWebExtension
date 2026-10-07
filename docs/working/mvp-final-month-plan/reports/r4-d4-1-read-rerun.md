# r4-d4-1-read-rerun: a rerun that changes a read's input is not a repeat (D4-1)

## Outcome

Done. A rerun of a step that only reads (`effect: "observe"`) now runs when its merged input differs from the step's own input, even if an earlier identical call on that page is held as `changed_nothing`. These cases are still refused `changes_nothing`, unrun: the identical rerun (the step's own input), an earlier identical call that `failed`, and any rerun of a `mutate` step.

## What changed and why

Paths are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime` (`R`).

- `R/llm/evidence-loop/rerun-request.ts`
  - The `ranAlready` callback now returns the guard's outcome (`AutomationStudioLlmEvidenceRepeatedOutcome | undefined`) instead of a boolean.
  - The refusal is decided by a new private `changesARead(step, merged, earlier)`. It returns true when the step is `observe`, `earlier.outcome !== "failed"`, and the canonical JSON of the merged input differs from the step's own input. The comparison uses `automationStudioLlmEvidenceCanonicalJson` and runs on the merged input before the written-step `write: true` is added.
  - Added a header paragraph that names live run `run-muxky54f-fadb9d03` and D4-1.
  - Cause: `repeat-guard/outcomes.ts` `recorded` stores every proposing read as `changed_nothing`, because a read never moves its page. So a rerun whose merged input equals another step's earlier read on the same page was refused, even though it would have changed the kept step.
- `R/llm/decision-handlers/amendment.ts` (line 72): the callback now passes `context.repeats.blocks(toolId, input, at)` through directly, without `!== undefined`.
- `R/llm/evidence-loop/tests/rerun-request.test.ts`:
  - The three boolean predicates now return guard outcomes: `() => true` became `() => ({ callId: "earlier", outcome: "failed" })`, and `() => false` became `() => undefined`.
  - New unit describe with this run's shape: dropped read step 11 with the `where`, kept read step 12 without it, and a guard that answers `changed_nothing` for step 11's input at the `stateBefore` of both steps. It expects a request for step 12 with the `where` and no refusal. It also covers three cases that must still be refused: the identical rerun of 12, an earlier `failed` call, and a press with an earlier `changed_nothing`.
  - New loop-level test through `runAutomationStudioLlmEvidenceLoop`: read with the where (add), read without it (add), then `rerun` step 2 with the where. It expects the third `executeTool` call to run, no `changes_nothing` in the feedback, and the kept steps to hold the filtered input and not the unfiltered one.
- No other test passed a boolean predicate. `grep -rn automationStudioLlmEvidenceRerunRequest` found one other test caller, `rerun-input.test.ts`, which passes no callback.

### Execution path (checked end to end)

- `R/llm/evidence-loop.ts:764` skips `repeats.blocks` when `rerunning`, so the requested rerun is not refused again on the tool-call path. `refused-repeat.ts` is reached only through that check.
- `same_amendment` (`amendmentBlocks`) is recorded only after a rerun has run and settled with `changed: false`. On the first such decision nothing is recorded, so it is not blocked. A rerun that changes the step's input changes the draft key, so it does not record `same_amendment`.
- The loop-level test shows the rerun running and replacing the kept step. Nothing downstream refuses it.
- One related path is untouched: `rerun-result.ts` `sameResult`. If the filtered read's answer were identical to the unfiltered step's answer, the loop would tell `rerun_same_result` and count it as no progress. That is a different and intended mechanism. In this run the `where` changes the rows.

## Commands run and observed results

Fail-first, with only the tests added and the source unchanged. Run from `packages/fluxiq`:

- `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-request.test.ts`
  - Printed: `Tests 2 failed | 31 passed (33)`.
  - The unit test failed at line 376: it received `[{ step: 12, reason: "changes_nothing" }]` where it expected `[]`.
  - The loop test failed at line 427: `executeTool` received only the first two inputs, so the rerun with the where never ran.

After the fix:

- From `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests src/programs/automation-studio/runtime/llm/repeat-guard src/programs/automation-studio/runtime/llm/decision-handlers/tests src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts`
  - Printed: `Test Files 40 passed (40)`, `Tests 421 passed (421)`, exit 0.
- From the Core root: `node scripts/build-cache/cli.mjs fluxiq:check`
  - Exit 0.
  - It printed `"not stamped, because inputs changed while it ran (packages/fluxiq)"`, because another worker was editing `flow-bootstrap/instructed-acts/claim-verdict.ts` concurrently.
- From the Core root: `node scripts/structure-audit.mjs`
  - Printed: `structure-audit: passed (278 warning(s), 349 baselined).` Exit 0.
  - Two advisory warnings are on my files:
    - `amendment.ts` at 421 lines. This is unchanged: the file was already 421 lines.
    - `rerun-request.test.ts` at 434 lines. This is new, because the file grew past 400. It is advisory only.

## Not verified

- No live Lab, browser or provider run. The fix has not been exercised against the real `run-muxky54f-fadb9d03` page, so this report does not show that the Flow now keeps the filtered listing there.
- No full suites were run, per the brief.
- The `fluxiq:check` result was not stamped by the build cache, because another worker's files changed during the run. It exited 0, but it was not re-run after that worker finished.

## Open questions or contradictions found

- `rerun-request.test.ts` is now 434 lines, past the 400-line advisory threshold. The structure audit does not fail on it. If the supervisor wants it under 400, the D4-1 block could move to a new file, but the folder is at its 25-file budget.
- Outcomes other than `failed`, such as `same_result` from a paginating read that moves the page, are also no longer refused for an `observe` step whose input changes. This is deliberate, matching the brief's rule that a read with a new input changes the draft.
