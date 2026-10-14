# t602 replay-call-accounting: worker report

## Outcome

Done. The cause was on the Lab side: the Lab read the replay too early. Core did publish
the replay's provider-call accounting (a zero), but only in the save after the one
the Lab read. The fix is in `packages/test-runner` only, and Core is unchanged. The
Lab's rule is not weakened: a replay with no published accounting still fails
`assertReplaysAccounted`.

## What changed and why

### Cause, from the evidence of run-mv8k9k2e-1f1065a8

- The Lab's rule is `assertReplaysAccounted` in
  `packages/test-runner/src/flow-lane/repair/replay-repair.ts`. `replayOnce` reads
  `getRunDetail(...).llmAccounting?.calls ?? providerCallCount`, which comes from
  `runDetail.metadata.llmGate.costAccounting`.
- On the Core side, a run that asked no model gets a zero `llmGate` from
  `automationStudioZeroProviderGate` (`runtime/result-verification/zero-provider-run.ts`).
  `automationStudioResultRecordOnRunDetail` (`run-record.ts`) writes that gate in the
  same save as the run's verdict, after the graph run has already saved status
  `succeeded`.
- In the run's Core store (`project.sqlite`, plus event-chunk objects copied to the
  scratchpad and read for keys and codes only), the replay is run `e6a554fd…`:
  succeeded, 0 interventions, 0 adaptations, and a schedule check that was skipped
  (`core.check.interval_not_reached`). Its event stream:
  - seq 40 is the final graph summary with status succeeded and no `llmGate`. Its chunk was written at 20:35:04.367Z.
  - seq 43 was written at 04.728.
  - seq 44 was written at 04.757. It carries `resultVerification`
    `{status: unverified, performed: false, code: core.result.no_model_available}` and the
    zero `llmGate` (`calls: 0`, `providerCalls: []`, `providerCallsOmitted: 0`).

  So Core published the zero, about 0.4 s after the status save.
- The replay ran about 48 s, from queued at 20:34:15.9 to finished at 20:35:04.0. The
  Lab's default request bound is 30 s (`http-control/index.ts`, `boundedTimeout`), so
  `runPersistedFlow` timed out. `executeRecordedFlowRun` then took the read-back path,
  `awaitTerminalRunDetail`, with no `awaitVerdict`, because a replay has no
  `llmExecution`. That path returns on the first read that shows a terminal status
  with actions, which here was the seq 40 state. `replayOnce` then called
  `getRunDetail` at once, before seq 44, found no accounting, and failed the run. The
  Lab published its record at 20:35:05.378.
- `lab replay` already had this fix: `saved-flow-replay/run-flow.ts` passes
  `{ awaitVerdict: true }` (commit 72a858be, "await settled accounting in deterministic
  replay"). The in-run repair replay never got it.
- The brief's comparison runs could not have shown the defect.
  run-mv8jh76n-972c8b72 (crossborder) and run-mv8jii6x-a4159311 (bigbox) have
  `application: no_proposal` and `replays: []` in `snapshots/repair-lane.json`. They
  replayed nothing, so they published no replay accounting.

### Fix

- In `packages/test-runner/src/flow-lane/repair/replay-repair.ts`, `replayOnce` now passes
  the terminal wait `REPLAY_TERMINAL_WAIT` (`{ awaitVerdict: true }`, a module constant
  that is not exported) to `executeRecordedFlowRun`. A succeeded replay is read back
  until Core's verdict is on it, and the accounting is read only after that. This
  covers both paths: the answered path (`owed === "verdict"`) and the timed-out
  read-back path (settlement merged). A failed replay is never judged, and
  `pendingWork` asks for a verdict only on a succeeded run, so the wait never holds a
  failed replay up. The header comment records the cause and the run id.
- `packages/test-runner/src/flow-lane/repair/tests/replay-repair.test.ts`:
  - The fake Core now writes `metadata.resultVerification` on succeeded runs, as real
    Core does (`wireDetail`, `NO_MODEL_VERDICT`).
  - New `stagedCore` fake: it saves the status first and the verdict plus zero
    accounting `verdictLagMs` later.
  - New test "a replay that outlived its request is read once Core has saved its
    verdict, and its zero accounting with it" reproduces the run: a bounded timeout
    and a 400 ms verdict lag.
  - New test "a replay Core answered before its verdict save is read again until the
    verdict is in" covers the answered path with a 200 ms lag.
- `packages/test-runner/src/flow-lane/repair/tests/run-repair-lane.test.ts`: the lane
  fake's replay detail now carries Core's verdict for a no-model run. Without it the
  new wait would have held each replay for the 90 s bound.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner build` (core-build check, domain
  dist, then `tsc -p tsconfig.json`) printed "core-build: FluxIQ Core's build at …
  is current with its source." and the `test-runner:build` step built in 90295 ms
  with no tsc errors.
- `node --test dist/flow-lane/repair/tests/*.test.js` printed `# tests 71`, `# pass 71`,
  `# fail 0`, in about 10 s.
- I checked that the reproduction catches the defect by editing the compiled
  `dist/flow-lane/repair/replay-repair.js` to pass `{}` instead of the wait, then
  running `node --test --test-name-pattern="verdict" dist/flow-lane/repair/tests/replay-repair.test.js`.
  Both new tests reported `not ok`, with "the accounting was read before Core saved
  it", `expected: 0` and `actual: ~` (null), and the summary was `# pass 0`,
  `# fail 2`. I then restored the compiled file from a backup; a grep confirmed the
  wait was back.
- After the restore, `node --test dist/flow-lane/repair/tests/replay-repair.test.js`
  printed `# tests 16`, `# pass 16`, `# fail 0`. The two new tests took 1015 ms and
  1003 ms, which is one read-back poll each.
- `pnpm structure:check` (downstream) printed "structure-audit: passed (194 warning(s),
  639 baselined)". None of the warnings is new: `run-repair-lane.test.ts` is 474 lines
  and was 472 before, past the 400-line advisory threshold either way.
- Core: no files changed, so I ran no Core checks. `git status` in the t602 Core
  worktree is clean.

## Not verified

- No live Lab run. The brief forbids one, so the fix has not been shown on a real
  48-second replay. It is shown only against fakes modelled on the observed save
  order.
- I did not run the whole test-runner suite (`pnpm test`), per the twice-a-day rule.
  Nothing outside `flow-lane/repair/tests` was run. `saved-flow-replay` and
  `persisted-flow-run` tests are unchanged and were not rerun.
- I did not verify whether Core publishes accounting on a replay that ends `failed` or
  `cancelled`. The zero gate is written only on the succeeded-run verdict path
  (`run-outcome.ts` sends a failed run to `repairFailedStep`, which writes no zero
  gate). A failed run's recovery writes an `llmGate` on its refusal paths
  (`recovery/stages.ts`), but I did not trace every path. For the in-run replay this
  is not the reported defect: a failed replay is failed earlier by
  `assertLiveRepairProof`, before the accounting check.

## Open questions or contradictions found

1. The brief says crossborder's and bigbox's replays published their accounting. Their
   repair lanes ran no replays (`no_proposal`, `replays: []`), so they are not evidence
   either way.
2. Core gap, outside this task's paths: the zero accounting exists only on the
   succeeded-run verdict save (`result-verification/zero-provider-run.ts`, `run-record.ts`).
   A failed or cancelled model-free run may carry no accounting at all. Making every
   Flow run publish it, failures included, means editing `result-verification/**`,
   which another task owns. That edit belongs to its owner, not here.
3. A replay passes no `actionTypes`, so its timed-out read-back is bounded by the
   one-node 90 s (`terminalDetailWaitMs(undefined)`). A replay of a long Flow that runs
   past 30 s plus 90 s would be reported unreachable. This was true before this fix,
   and the verdict wait does not lengthen it. A replay could pass its Flow's action-node
   count (the lane already reads the nodes in `run-repair-lane.ts`) or a longer request
   bound.
4. The same rule ("a provider-free replay waits for the verdict") now lives in two
   places: `saved-flow-replay/run-flow.ts` and `replay-repair.ts`. A shared helper in
   `flow-lane` would stop a third replay path from missing it again.

## Follow-up: one shared replay rule (coordinator request; open question 4 above)

### Outcome

Done. The rule "a replay runs with no model and is read back only once Core has saved
its verdict" now lives in one helper. `lab replay` and the in-run repair replay both
call it, and neither path changes its behaviour.

### What changed and why

- New directory `packages/test-runner/src/flow-lane/replay/`:
  - `provider-free-replay-run.ts` exports `executeProviderFreeReplayRun(control, input,
    bounds = {})` and its input type `ProviderFreeReplayRun`. The input is
    `executeRecordedFlowRun`'s input without `llmExecution`. The helper calls
    `executeRecordedFlowRun(control, replay, bounds, { awaitVerdict: true })`. It also
    removes any `llmExecution` a caller slips in through a cast, so a replay can never
    bring a model along.
  - `index.ts` is the barrel, and `flow-lane/index.ts` re-exports it.
  - Its own test is `replay/tests/provider-free-replay-run.test.ts`.
- Why this directory: `executeRecordedFlowRun`, which both paths already depend on,
  lives in `flow-lane`. `saved-flow-replay` already imports `flow-lane`, so putting
  the helper in `saved-flow-replay` would make `flow-lane/repair` import back the
  other way. I first put it in `flow-lane/` itself, but the structure audit failed:
  `flow-lane/` was already at its 25-file limit. So it got its own directory.
- `saved-flow-replay/run-flow.ts`: `runProviderFreeReplayFlow` keeps its signature and
  now calls `executeProviderFreeReplayRun(control, {...})`. Before, it called
  `executeRecordedFlowRun(control, {...}, {}, { awaitVerdict: true })`. The arguments
  and the wait are the same, so behaviour is unchanged.
- `flow-lane/repair/replay-repair.ts`: the module's `REPLAY_TERMINAL_WAIT` constant is
  removed. `replayOnce` now calls `executeProviderFreeReplayRun(control, {...}, bounds)`.
  The input, the bounds and the `{ awaitVerdict: true }` wait are the same as before.
- The new test covers four cases:
  - A succeeded replay is read back until the verdict save, with two variants: Core
    answered early, and the request outlived its bound.
  - A model slipped in through a cast is never sent: the run starts its own session
    and carries no `llmExecution` or `runIntent`.
  - A failed replay is not polled for a verdict (one read).

### Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` (the package's check, `tsc --noEmit`)
  printed "core-build: … current with its source." and the `test-runner:check` step
  built in 12873 ms with no tsc errors.
- `pnpm --filter @fluxiq-web-extension/test-runner build` passed: `test-runner:build`
  built in 27958 ms. Its clean step removed the compiled copies left over from the
  helper's first location.
- `node --test dist/flow-lane/replay/tests/*.test.js dist/saved-flow-replay/tests/*.test.js dist/flow-lane/repair/tests/*.test.js`
  printed `# tests 108`, `# pass 108`, `# fail 0`, in about 10.5 s. That includes the
  unchanged `saved-flow-replay/tests/run-flow.test.ts` (both of its cases `ok`) and
  all 71 repair tests.
- I checked that the tests catch a missing wait by editing the compiled helper
  (`dist/flow-lane/replay/provider-free-replay-run.js`) to pass `{}`, then running the
  helper, `run-flow` and `replay-repair` tests. They printed `# pass 16`, `# fail 6`:
  every verdict test on all three paths failed (`replay-repair` 15 and 16, helper 17
  and 18, `run-flow` 21 and 22). I then restored the file from a byte copy; a grep
  confirmed `{ awaitVerdict: true }` was back.
- `pnpm structure:check`:
  - The first run failed on `[directory-files] flow-lane/: 26 source files exceeds the
    25-file limit` and on `[statement-packing]` at line 24 of the new test.
  - After moving the helper into `flow-lane/replay/` and putting one statement per
    line, it printed "structure-audit: passed (194 warning(s), 639 baselined)".

### Not verified

- I did not run the whole test-runner suite (`pnpm test`), only the three directories
  above. Other tests under `flow-lane/tests` import the flow-lane barrel, which now
  re-exports `replay/index.js`. They type-check, but I did not run them.
- No live Lab run.

### Follow-up left open (from open question 3 above)

- Long replays. A replay passes no `actionTypes`, so a replay whose request times out
  is polled back for only the one-node bound: 90 s (`terminalDetailWaitMs(undefined)`).
  A replay of a Flow that runs past roughly 30 s plus 90 s would be reported as
  unreachable. The helper does not change this. The fix belongs in the helper, so
  both paths get it: pass the Flow's action-node count, or a longer request bound.
