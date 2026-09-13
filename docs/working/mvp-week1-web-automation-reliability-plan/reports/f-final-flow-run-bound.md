# f-final-flow-run-bound — preserve bounded Flow-run failures until terminal evidence

Implementation report, 2026-09-13. Owned files only:

- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`
- `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts`
- this report

No shared document, Core source, extension/domain source, Lab worktree, run
artifact, commit, or remote was touched.

## Outcome

Implemented the downstream fix for the two final-bench W02 repeat-0 misses.
`executeRecordedFlowRun` now distinguishes a bounded HTTP timeout/abort from an
arbitrary `RunnerFailure`. After a bounded failure it polls the exact Core run
for a terminal detail carrying at least one durable attempt, for a 90-second
load-derived window. It returns that real terminal outcome when it arrives and
rethrows the original timeout/abort object when it does not.

This removes both false conversions that the old path allowed:

1. a running, zero-attempt recovery detail cannot become the terminal
   `action.dispatch` “no durable attempt” result;
2. an unrelated runner failure cannot authorize a speculative detail read.

The normal resolved path is unchanged: a resolved failed session still reads
and returns Core's structured terminal failure, while a genuinely terminal
zero-attempt detail on that normal path retains the existing no-durable guard.

## Design

- Imported the existing `isBoundedHttpFailure` seam from `http-control.ts`.
- Added an injectable terminal-detail wait used by tests without wall-clock
  sleeps. Production defaults are 90,000 ms and 250 ms polling.
- The 90-second bound matches the finalization bound already justified by the
  loaded campaign. The failed W02 dispatch-to-error intervals were 42.985 s and
  46.497 s; both crossed the request's 30-second default under concurrent load.
- Each diagnostic detail read is independently bounded to the smaller of 30
  seconds and the remaining overall window. The already-fired external signal
  is not reused, because it would make every recovery read abort immediately.
- A detail is accepted only when its summary status is `succeeded`, `failed`, or
  `cancelled` **and** it has durable attempts. Diagnostic-read errors are
  contained; without accepted evidence, the exact original bounded failure is
  authoritative.
- Extracted the existing detail-to-outcome conversion into one helper so normal
  and recovered terminal results retain the same action/failure/evidence/start
  semantics.

## Tests added or corrected

Three required regression rows were added:

1. both bounded timeout and bounded abort wait through an empty `running`
   detail, then return the terminal durable attempt;
2. a bounded timeout whose detail never becomes terminal/durable rethrows the
   same original error object, never the no-action guard;
3. a non-bounded `RunnerFailure` is rethrown by identity without any detail
   read.

The existing structured failed-run row now models the production contract—a
resolved `runPersistedFlow` response with `session.status=failed`—and confirms
the terminal structured failure remains unchanged.

## Validation

- First private package typecheck exposed one refactor typo (`runId` was not
  passed into the extracted outcome helper). It was fixed.
- Final `pnpm --filter @fluxiq-web-extension/test-runner check`: **passed**.
- Private compilation to
  `packages/test-runner/.private-flow-run-bound`: **passed**.
- Focused restored suite
  `node --test .private-flow-run-bound/flow-lane/tests/persisted-flow-run.test.js`:
  **16 passed, 0 failed**.

Mutation proof:

- Before mutation, source SHA-256 was
  `6DCBF982D2726BCC81EC0E33F3B6875A94E302B685168C7A5A94A40EB3FB9E2B`.
- Mutated the wait to return the first detail immediately, recreating the old
  premature-read behavior.
- Private rebuild succeeded; focused suite produced **14 passed, 2 failed**.
  Both new bounded rows failed by receiving the no-durable-attempt error.
- Restored with `apply_patch`; SHA-256 returned exactly to the value above.
- Rebuilt and reran: **16 passed, 0 failed**.

## Remaining risks and unverified work

- No Lab run was authorized for this worker. The two active benches use the old
  pushed pins, so this fix needs a supervisor-verified targeted W02 Flow run and
  then fresh final benches at a new pushed pin.
- The poll intentionally accepts no terminal zero-attempt detail on the bounded
  recovery path: without a durable attempt it cannot distinguish a truly empty
  run from Core's in-progress partial recovery. In that case the original
  transport failure is the honest result.
- The wait does not cancel Core after its recovery window. Cancellation policy
  is outside this file's current control contract and was not broadened here.
- The private compiler output was removed after the restored suite passed.
