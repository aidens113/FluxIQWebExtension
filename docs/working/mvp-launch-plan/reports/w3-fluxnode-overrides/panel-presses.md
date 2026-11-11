# W3 t899: panel presses run under the attempt's overrides

## Outcome
Done. A Carry on or Run again press on a FluxNode attempt now runs inside the overrides frame the FluxNode run set.

## What changed and why
Paths are under `packages/fluxiq/src/framework/automation-service/service/` in the Core worktree.
- `flow-bootstrap-commands/contracts.ts`: `AutomationStudioAnswerFirstCallerOptions.runOverrides?: AutomationStudioRunOverrides`. The kept-options `Pick` now includes `runOverrides`.
- `answer-first/caller/run-overrides-read.ts` (new): strict reader for the frame. It refuses unknown keys by name at every level (for example `Answer-first caller runOverrides.pace does not take "gap"`), checks types and whole-number bounds, and returns a copy. It does not re-run the FluxNode limits, because the FluxNode already enforced them.
- `answer-first/caller/options.ts`: accepts `runOverrides` and reads it through that reader.
- `answer-first/caller/kept.ts`: keeps `runOverrides`.
- `answer-first/attempt/run-attempt.ts`: the exported function now wraps the old body, renamed `attemptRun`. It runs the attempt inside `runWithAutomationStudioRunOverrides(caller.runOverrides)` only when a frame is given and `automationStudioRunOverrides()` is not already set. It never double-wraps or replaces an outer frame. Your `tokenLimits` line is untouched.
- `fluxnode/caller-options.ts`: new `runOverrides` input, passed into the options as a structured clone.
- `fluxnode/run-fluxnode.ts`: passes `runOverrides: frame`.

With no `runOverrides`, behaviour is unchanged. The existing carry-on, run-again and caller-replay tests still pass.

## Secret inputs on a press
- Secrets are never in the frame or in the kept options. `fluxNodeInputsWithoutSecrets` already strips them from `callerOptions.inputs`, and the frame has no field that could hold one. The new reader would refuse a `secrets` key by name.
- A press runs with no `runWithAutomationStudioRunSecrets` frame. This is the same state as a lost secrets frame today.
- Resolved from code, not run live: a step bound to a secret input is resolved from `automationStudioRunSecrets()` in `engine/automation/graph-run.ts` (replay), `runtime/llm/node-tools/replay/span.ts` (exploration) and `flow-run/input-bound-steps.ts`. With no secrets frame the binding finds no value and is reported unresolved (`{ unresolved: missingPaths }`), so the step fails to resolve. No kept or stand-in value is ever typed.
- The person therefore sees a bound step that cannot resolve. I did not run a live press on a secret-input attempt, so I did not observe the exact wording on screen.
- Only the frame is restored by the press; the secrets are not.

## Commands run and observed results
- `npx vitest run` on `answer-first/caller/tests`, `attempt/tests/run-overrides-press.test.ts` and `fluxnode/tests/run-overrides-kept.test.ts`: 8 files, 31 tests passed.
- `npx vitest run` on `answer-first/attempt`, `carry-on`, `run-again`, `tests/carry-on.test.ts` and `service/fluxnode`: 41 files, 187 tests passed. This run also included the 4 press tests.
- After fixing the first audit failure, I re-ran `fluxnode/tests/run-overrides-kept.test.ts`: 2 tests passed.
- `node scripts/structure-audit.mjs` (Core root): exit 0, `passed (533 warning(s), 969 baselined)`. The first run failed on `as-never` casts in my new test; I replaced them with `resolveFluxNodeOptions`.
- The first run also reported a `directory-files` failure in `result-verification/tests/` (26 files). That is the other worker's directory, and it had cleared by the final run.

New tests:
- `caller/tests/run-overrides.test.ts`: the reader keeps a copy, kept options round-trip through JSON, and 17 malformed frames are refused by name.
- `attempt/tests/run-overrides-press.test.ts`: the cases below.
  - Run again (outside any frame) sees the same frame the FluxNode run set.
  - Carry on sees the same frame.
  - An outer frame is never replaced.
  - A press on a non-FluxNode attempt sees no frame.
- `fluxnode/tests/run-overrides-kept.test.ts`: the options a FluxNode run builds carry the frame and no secret, and carry no frame when the run set none.

## Not verified
- The fluxiq `tsc` (you said you would run it).
- A live browser or panel press, and a press on a secret-input attempt (only resolved from code, as above).
- `service/fluxnode/tests/library-lane.ts` is not used. The press tests use the lending-library lane (`later-attempts` with `drivenBy`), the same as `caller-replay.test.ts`. A FluxNode run's frame is simulated there with `runWithAutomationStudioRunOverrides` plus `callerOptions.runOverrides`. Real `runFluxNode` frame-setting is covered by the existing `run-overrides.test.ts`.

## Open questions or contradictions found
- `humanness` is read by the options reader but not in the kept-options `Pick`, so a press drops it. That is the t898 lane's concern, and I left it.
- The "no outer frame" check wraps whenever a caller frame is given and no frame is set. A non-FluxNode caller that passes `runOverrides` directly also gets the wrap, which seems intended.
