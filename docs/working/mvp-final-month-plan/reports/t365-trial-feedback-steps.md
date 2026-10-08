# t365 trial feedback counts steps, not attempts

## Outcome
Done.

## What changed and why
- Core `packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/feedback.ts`: `steps()` now folds the trace's attempts into executed steps (`executedSteps`). An attempt of the same node directly after a *failed* attempt of that node counts as the same step tried again: it replaces the step's outcome (status, failure code, happened, expected/actual, retryable) and adds to its count. A node reached again after it *succeeded* (loop, route back) is a new step. Each step carries `attempts: N` only when N > 1, so single-attempt steps read exactly as before. `MAX_STEPS`/`stepsLeftOut` now count steps, not attempts.
- Round 5 evidence (`run-muz0f12h-eae63685`, 0022 and 0028 `result.json`): steps 6 (dom-click, `web.action.rate_limited`, failed) and 7 (dom-click, succeeded) were one node's busy refusal and its retry. With this change they read as one step `{ status: "succeeded", attempts: 2 }`, and later steps are renumbered by one.
- Tests (`tests/feedback.test.ts`, new describe "trial feedback counts steps, not attempts"): busy-then-accepted reads as one succeeded step with `attempts: 2` and no `rate_limited` text; four failed attempts read as one failed step with `attempts: 4` and the final reason (`web.target.not_found`, its happened sentence, `retryable: false`); a node revisited after success is a new step.

## Commands run and observed results
- Fail-first: `npx vitest run .../candidate-trial/tests/feedback.test.ts` before the fix -> 2 failed | 3 passed (the two new attempt-folding tests failed with steps 2..5 listed per attempt).
- After fix: `npx vitest run src/programs/automation-studio/runtime/service/candidate-trial` (in packages/fluxiq) -> 4 files, 35 tests passed.
- `npx tsc --noEmit -p .` in packages/fluxiq -> no output (clean).
- `node scripts/structure-audit.mjs` (Core root) -> "structure-audit: passed (289 warning(s), 710 baselined)"; also prints "1 baseline entries can be lowered" which is not from this change (no violation removed here; no candidate-trial warnings).

## Not verified
- Live trial behaviour (no Lab/provider run, per brief).
- Assumes the executor records a node's retries as consecutive attempts (true for t355 in-place retries as seen in round 5). If recovery routes through another node between attempts, those read as separate steps, which is intended.

## Open questions or contradictions found
- "By its position in the candidate": steps are numbered by execution order (Nth executed step), not by node index in the graph, because a loop can execute one node several times and merge/skip nodes are listed too. Matches the existing numbering the model already reads.
- A step that failed after all attempts still reports the producer's `retryable` word; after four busy refusals that may still say `retryable: true`, inviting a retest. Not changed (outside the brief's goal); the supervisor may want the instruction or this field to account for attempts already spent.
