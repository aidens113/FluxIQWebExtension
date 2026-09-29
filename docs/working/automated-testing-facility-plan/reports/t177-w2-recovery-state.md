# t177-W2: the Lab waits on Core's recovery state, not a fixed time

## Outcome

Done. Core now marks a failed run's recovery on its run detail
(`metadata.recoveryState`), and the Lab's terminal wait follows that marker.
No live runs, no provider calls.

## What changed and why

### Core (`C:\Users\osrs_\FluxStuff\fxwork\t177\!FluxIQ`, package `packages/fluxiq`)

- New `src/programs/automation-studio/runtime/service/runtime-session/recovery-state.ts`
  exports `annotateAutomationStudioRunDetailWithRecoveryState` and the types
  `AutomationStudioRunRecoveryState` and `AutomationStudioRunRecoveryStateInput`.
  It applies only when `recovering && detail.summary.status === "failed"`, and then:
  - saves `{ state: "running", startedAt }` before annotation;
  - calls `annotate(detail)` with the unmarked detail, so the recovery sees the same input as before;
  - on success, returns the annotated detail with `{ state: "ended", startedAt, endedAt }`. The caller's existing save persists it, and the helper makes no extra save;
  - on a throw, saves the pre-annotation detail with `{ state: "threw", startedAt, endedAt, code: "recovery.threw" }` and rethrows the original error. Only the code is stored, never the message.

  Both marker saves are best-effort (`.catch(/* best-effort: ... */)`, the form the swallowed-failure rule allows). If the `running` save fails, the recovery still runs and the Lab falls back to its old rule. This is my own call: the brief made only the `threw` save best-effort.
  In every other case the helper passes straight through to `annotate`, unmarked.
- `runtime-session/index.ts`: the barrel now exports `./recovery-state.ts` and its header comment is extended.
- `runtime/service.ts`: only the two `runRuntimeSession` call sites are wrapped (routed about line 2763 with `recovering: Boolean(adaptationContext)`; direct about line 2822 with `recovering: true`, because that branch is already guarded by `adaptationContext`). Diff: +7/-7 lines, plus one import. The refuted-result port is untouched.
- Why this is enough: on the retry path, `repair-rerun.ts` spreads `input.detail.metadata` (the annotated detail) into its final save, so `ended` carries over. The retry's intermediate `writeRuntimeSession` re-projection drops the marker, but the Lab handles a missing marker (below).

### Lab: `packages/test-runner/src/flow-lane/terminal-run-wait.ts` (lane t176's area; self-contained diff, +39/-3)

- New exported type `RecoveryStateCode = "recovery.threw" | "recovery.ended_without_record" | "recovery.still_running"`.
- `awaitTerminalRunDetail`'s result gains an optional `recoveryState?: RecoveryStateCode`.
- On each terminal read where recovery is still pending, it reads `runDetail.metadata.recoveryState.state`:
  - `threw` or `ended`: return at once with `unsettled: "recovery"` and the code.
  - `running`: `deadline = max(deadline, firstTerminalAt + TERMINAL_DETAIL_MAX_WAIT_MS)`. If the deadline expires, the result is `unsettled: "recovery"` with `recoveryState: "recovery.still_running"`.
  - No marker: today's rule, unchanged.
  - Record present: `pendingWork` already returns nothing, so the run is done as today.
- An extension, once granted, is not shortened by a later read that has no marker (for example, a rerun's re-projection).
- New private helper `coreRecoveryState`. The doc comment now names the marker behaviour.
- Callers still ignore the new `recoveryState` field. Passing it into evidence or reports is not done.

## Commands run and observed results

- Core, `packages/fluxiq`: `npx vitest run --maxWorkers=2 --minWorkers=1 src/programs/automation-studio/runtime/service/runtime-session/tests/` printed 4 files and 27 tests passed. That includes 6 new tests in `recovery-state.test.ts`: running then ended; threw with code only and rethrow; threw-save failure still rethrows; running-save failure still recovers; no marking for a non-failed run or a missing context.
- Core, `packages/fluxiq`: `npx tsc --noEmit -p .` exited 0 with no output.
- Core root: `node scripts/structure-audit.mjs` printed `structure-audit: passed (194 warning(s), 355 baselined)`, exit 0. It also printed "1 baseline entries can be lowered". That entry is not from my files, and I did not run `structure:baseline`.
- Downstream: `pnpm --filter @fluxiq-web-extension/test-runner check` exited 0.
- Downstream: `pnpm build` in `packages/test-runner` exited 0. Then `node --test dist/flow-lane/tests/terminal-run-wait.test.js` gave 11 tests, 11 passed, 0 failed. The 5 new tests use a fake clock:
  - running is extended past 300 s and settles at 400 s;
  - running until the lease expires gives `recovery.still_running` at exactly `TERMINAL_DETAIL_MAX_WAIT_MS`;
  - threw and ended without a record stop at the next poll (250 ms) with their codes;
  - record present is done at 0 ms;
  - no marker keeps the 300 s wait and names nothing.
- Downstream: `node scripts/structure-audit.mjs` showed one FAIL `[failure-as-empty]` in `packages/test-runner/src/run-scenario/decision-trace/read-decision-trace.ts`. That file is untracked and belongs to another worker, not me. `terminal-run-wait.ts` shows an advisory warning of 11 exported values, which was already there: my change adds only a type, and types are not counted.

## Not verified

- No live run. I did not observe a real throwing recovery writing `threw`, or the Lab reading it through `persisted-flow-run.ts`.
- I did not run Core tests that exercise `runRuntimeSession` end to end (service-level suites). Existing assertions that check exact `saveFlowRunDetail` call counts or order for failed granted runs could now see one extra save (`running`), or a second save on a throw.
- Nothing downstream consumes or reports `recoveryState` yet.

## Open questions or contradictions found

- The routed path is marked only when `adaptationContext` exists, which is how I read "only when a recovery context exists". If annotation returns without recovering (no provider, for example), the detail is saved `ended` with no record, and the Lab then stops at once with `recovery.ended_without_record`. Before this change it waited 300 s for the same outcome. I believe this is the intent, but it changes behaviour.
- Downstream `pnpm check` is currently red because of the other worker's `read-decision-trace.ts` (failure-as-empty).
