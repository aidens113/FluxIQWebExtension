# w2-c4-executor-provenance: attempts name the saved changes their node carries

Repository: FluxIQ Core `F:\!FluxIQ`. `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Design: `w2-back-half-design.md` section 2.6, Phase 2.9, section 8 row C-4.

## Outcome

**Done.** Every attempt the executor builds for a node now carries
`adaptationIds`, copied from that node's `metadata.adaptationIds`. The one
exception is the region-timeout attempt, which is built in `graph-run.ts` (see
open question 1). A node without the list gives an attempt without the field.
A malformed list is ignored whole and never partly trusted.

The C-1 module (`AS/runtime/flow-change/`) landed while I was working. It
exports the key constant, the limit, and a reader with the same rules I had
written, so I removed my local copy and call its
`automationStudioNodeAdaptationIds`. No local constant is left, so there is
nothing to switch over later.

## What changed and why

- `AS/runtime/executor/contracts.ts`: `AutomationStudioNodeAttemptTrace` gains
  an optional, documented `adaptationIds?: string[]` field, as design section 2.6
  specifies.
- `AS/runtime/executor/attempt-trace.ts`: new export
  `nodeAttemptWithAdaptationIds(node, attempt)`.
  - It reads the list only through
    `automationStudioNodeAdaptationIds(node.metadata)` from
    `../flow-change/index.ts`.
  - It sets the field from the node's list and drops any `adaptationIds` the
    attempt already had, so the node's metadata is the only source.
  - When the node has no list and the attempt has no field, it returns the same
    attempt object, so unstamped Flows run exactly as before.
  - The reader returns a new array, so later changes to the Flow document and
    the trace cannot affect each other.
- `AS/runtime/executor/node-execution.ts`: the exported
  `executeAutomationStudioNode` is now a thin wrapper. The old body became the
  private `executeNodeAttempt`, and the wrapper stamps its result.
  - All seven return paths are covered by that one stamp: success, dispatch
    failure, thrown error, missing state binding, version-pin mismatch,
    non-executable definition, and the native and composite executors.
  - It reads the original `node`, whose metadata is the same object as the
    executed copy's.
- Field placement: `adaptationIds` sits at the top level of the attempt, not
  under `metadata`. Trace withholding rewrites only its data and prose keys
  (`trace-withholding.ts` `TRACE_DATA_KEYS`), so the ids stay in the saved trace
  word for word. The test for a run that withholds a resolved value confirms
  this.
- Tests:
  - `tests/attempt-trace.test.ts`: a new `describe` block for the helper.
    - Copies the ids in order and hands the attempt its own array.
    - Collapses duplicates.
    - Accepts 8 ids and a 256-character id.
    - Gives no field, and the same attempt object, when there is no metadata, no
      list, or an empty list.
    - Ignores the whole list for 14 malformed shapes: a string, null, a number,
      an object, a list holding a number, null, a nested list, an empty id, a
      whitespace id, an id with surrounding whitespace, a NUL character or a
      line break, an id over 256 characters, or more than 8 ids.
    - Drops or replaces an `adaptationIds` the attempt already carried.
  - `tests/node-execution.test.ts`: a new `describe` block that runs whole
    Flows.
    - Eight ways an adapted node's attempt can end all name its ids (a
      table-driven test).
    - An unadapted node next to an adapted one: only the adapted one names ids.
    - A malformed list (not a list; a list holding a non-id) produces a trace
      identical to the unadapted node's run (`toEqual`, fixed clock).

## Commands run and observed results

All commands were run from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`.

- `npx vitest run src/programs/automation-studio/runtime/executor`: 9 files,
  157 tests passed (first run, and again after the final edit).
- Mutation tests, each reverted afterwards (`cmp` against a scratch backup
  showed the restore was exact):
  - The wrapper returned the unstamped attempt: 9 failed, 148 passed.
  - A malformed entry was skipped instead of rejecting the list (my earlier
    local reader): 11 failed, 146 passed.
  - After switching to the shared reader, the helper never stamped: 14 failed,
    143 passed.
- `npx vitest run .../runtime/executor .../runtime/flow-change`: 12 files, 234
  tests passed.
- `pnpm check`, first full run: exit 2. Structure audit passed. `packages/fluxiq`
  tsc reported `runtime/recovery/stages.ts(71,10): Cannot find name
  'adaptationIdentity'`, which is C-2's in-progress file.
- `npx tsc --noEmit` in `packages/fluxiq`, minutes later: 0 errors.
- `pnpm check`, run on its own: **exit 0**. Structure tests: 105 passed, 0
  failed. `structure-audit: passed (147 warning(s), 254 baselined)`. contracts,
  client-gateway-websocket, fluxiq and web all printed `check: Done`. This run
  used my code before the switch to the shared reader.
- `pnpm check`, final run after the switch: **exit 1**. The one violation is
  `runtime/tests/live-patch.test.ts: 878 lines exceeds the 800-line limit`,
  which belongs to the live-patch worker and is on my must-not-touch list. The
  audit reported nothing for my files except existing advisory warnings: the
  executor directory has 20 files, and `node-execution.test.ts` grew from 510 to
  566 lines, over the 400-line advisory limit.
- `npx tsc --noEmit` in `packages/fluxiq`, final run: exit 2 with 5 errors, none
  in the executor.
  - 3 are in `runtime/flow-change/tests/verdict.test.ts` (C-1, not yet
    tracked), all exactOptionalPropertyTypes errors.
  - 2 are in `runtime/live-patch.ts:205,207` (the live-patch worker's file):
    `Property 'target' does not exist`.
  - `grep -c executor` on that log: 0.
- `pnpm --filter apps/web --filter packages/contracts --filter
  packages/client-gateway-websocket check`: all three printed `Done`.
- `npx vitest run src/programs/automation-studio/runtime` (the whole runtime
  suite, with other workers active): exit 1, 13 of 122 files and 15 tests
  failed. 14 of those were 15-second timeouts. The 15th was
  `deepseek-bootstrap-exploration` "runs past its deadline", a timing-sensitive
  test. Single tests took 20 to 116 seconds in that run.
- Rerun of those 13 files with at most 3 worker processes: 4 failed.
  - 3 were timeouts.
  - 1 was a real assertion difference in `run-detail-preservation.test.ts:129`,
    a new file from the run-detail worker: expected 2 provider calls after
    replays, got 6.
- `run-detail-preservation.test.ts` run alone, with my stamp active: 3 of 3
  passed.
- The 3 timed-out files, run with one worker at a time: `proposals` (10 tests)
  and `service-bootstrap/adaptation` (9 tests) passed. `scale-pages` "persists
  Flow expansion summaries" timed out at 15478ms against a 15000ms limit. That
  test only saves and lists stored records and never runs a Flow, so the
  executor is not on its path.
- Why the remaining runtime failures are not from this change:
  - In the current tree, the only code that writes node `adaptationIds` is
    `flow-bootstrap/adaptation.ts` (C-3). Nothing reads the attempt field yet.
  - For every other node the stamp returns the same attempt object.

## Not verified

- No live browser or provider run (none was in scope).
- I did not get a green `pnpm check` after the switch to the shared reader,
  because the live-patch test file is over its line limit. The tsc run after the
  switch shows no errors in executor or flow-change source files.
- The `scale-pages` timeout (15.5 seconds against a 15-second limit, with one
  worker) is not explained. That test never runs the executor. It may be slower
  because of the in-progress run-detail writer and lock (`service/summaries/**`),
  or it may be this machine.
- I did not investigate the `run-detail-preservation` failure (6 provider calls
  against 2 expected) further, because it passed when run alone. It may be an
  interaction with C-2's in-progress known-adaptation gate, or with that file's
  own in-progress work.
- A Call Flow child's attempts are stamped through the child's own
  `executeAutomationStudioNode`, but only when the composite executor runs
  `runAutomationStudioGraph`. No test covers a real Call Flow child.

## Open questions or contradictions found

1. **The region-timeout attempt is not stamped.**
   - Where: `AS/runtime/executor/graph-run.ts:228` builds the fallback attempt
     outside `executeAutomationStudioNode`.
   - Effect: a region-timeout failure of an adapted node names no adaptation, so
     C-10's replay recorder would miss that failed replay instead of recording
     it as failed.
   - Fix: one line in `graph-run.ts`, which is outside my brief: wrap that
     fallback as `() => nodeAttemptWithAdaptationIds(currentNode!, { ... })` and
     import the helper from `./attempt-trace.ts`.
2. **Commit dependency.** `attempt-trace.ts` now imports
   `../flow-change/index.ts`, which is still untracked (C-1). Commit C-1 with
   C-4 or before it.
3. **Legacy created Flows.** Nodes that carry only `bootstrapAdaptationId`
   produce no provenance: per the brief, the executor reads only
   `adaptationIds`. Design section 3 assigns legacy stamping to C-10.
4. **Hand-off to C-10.** Copying the attempt field into
   `actionAttempts[].metadata.adaptationIds` and `adaptationsExercised` belongs
   to C-10. If anything ever places the ids under an attempt's own `metadata`
   key in the executor trace, withholding treats them as data and could rewrite
   an id that equals a resolved value. The top-level field avoids that.
5. **Overlapping tests.** My attempt-level table of malformed shapes overlaps
   C-1's reader tests. I kept it because it pins down the attempt contract, and
   it fails if the reader's rules change.
6. **Tooling note.** The Edit tool wrote `\u0000`-style escapes in a regex
   literal as raw control bytes, and grep then treated the file as binary. The
   regex went away with the switch to the shared reader. A byte scan of all
   five changed files (node) is now clean.
