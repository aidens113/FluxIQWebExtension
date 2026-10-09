# t378 W7: runtime pace (worker-high)

## Brief

### Brief: t378-w7-runtime-pace (worker-high)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`; N = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes`.
- User rule (binding): when a trial meets an interruption such as a site's "you're going too fast" notice, the build must adapt the Flow: a branch on that page state that waits, presses the dismiss control and returns to the loop where it was, plus a pace between iterations that grows after a rate limit; the saved Flow keeps both. This brief is the runtime half; a later worker adds the script syntax (`repeat pace:`, guarded steps in loops).
- Task:
  1. `builtin.timing.wait` must pause and continue. Today `R/executor/graph-run.ts:548-557` returns the whole run `waiting` for it (probe: `wait -> math.add` ended `{"status":"waiting","parked":null}`, the next node never ran). Sleep its `durationMs`, signal-aware (as the retry delay at `graph-run.ts:266-275`) and bounded by the run's limits, then continue on success; `builtin.routine.approval` keeps parking. Update `R/executor/expected-transition.ts` (:22, :40) and `N/timing/wait.ts` as needed.
  2. The retry wait credits time already passed: `graph-run.ts:631-640` waits the full hint (`automationStudioBoundedRetryWaitMs`) after the failed attempt's 2.7-4.6 s after-action snapshot, so a 5.5 s request kept the site's notice up 12-14 s. Wait `max(0, hint - time since the failed attempt settled)`.
  3. Pace contract: Flow node `metadata.paceMs` (positive integer ms) = minimum time between successive starts of that node within one run. Honour it before dispatch, in trials and playback. After an attempt whose failure carries a wait hint (`retryAfterMs`, e.g. `web.action.rate_limited` with effect unacted), raise that node's pace for the rest of the run to at least the hint, and grow it on each further limit (bounded). Record the learned pace in the trace. Domain-agnostic: read the failure's wait hint, never a web code.
  4. Trial feedback `R/service/candidate-trial/feedback.ts:62-97`: `executedSteps` replaces a failed attempt with its successful retry, so the model saw only `attempts: 2`. Keep what each step absorbed: what interrupted it in plain words (the site asked to slow down), the pass's row (from the preceding for-each attempt), the wait taken, that the run closed the site's notice, and the pace now in force.
  5. Promotion `R/service/candidate-trial/promotion.ts`: the saved Flow keeps the pace the deciding trial learned (set `metadata.paceMs` on that node to the larger of authored and learned).
- Required reads: the files named; lane D rate-limit analysis (read-only) `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-d-candidate-w1-rate-limit.md` sections 2-4.
- Owns: `R/executor/**` except `R/executor/node-execution/**`, `N/timing/**`, `R/service/candidate-trial/**`, new focused modules under those, their barrels and `tests/`.
- Must not touch: `R/executor/node-execution/**` and Core storage files (another task owns them; if the clean fix needs them, stop and report), `R/flow-bootstrap/**`, `R/activity/**`, `R/llm/**`, any other tree, lab slots or processes.
- Concurrency: other workers edit other Core files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Definition of done: fail-first tests: wait continues to its next node; the retry wait is credited; a paced node waits; pace grows after a hinted failure and is in the trace; feedback names the absorbed refusal, row and wait; promotion writes `metadata.paceMs`. `npx vitest run <the test dirs you touch>` from `T/!FluxIQ` passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w7-runtime-pace.md` (paste this brief at its top; protocol report format; return at most 12 lines; in Notes, state the exact trace field and metadata key a script-syntax worker must write to).

## Outcome

**Partial.** Items 1-4 are done and tested. Item 5 is done only up to the `R/flow-bootstrap/**` boundary.
The deciding trial's learned paces now reach promotion and ride on the `candidateTrial` audit detail. They are
**not** yet written to the saved Flow's `metadata.paceMs`, because that needs three edits in `R/flow-bootstrap/**`,
which this brief forbids (see "Open questions"). Wiring them into the proposed plan today would make promotion throw:
plan validation refuses an unexpected node field with `bootstrap.unexpected_field`, at error severity. That would
happen on exactly the rate-limited live runs this work is for.

Paths below are relative to Core `packages/fluxiq/src/programs/automation-studio/`.

## What changed and why

### 1. A Wait node pauses and the run continues

- `runtime/executor/pacing/timed-pause.ts` (new): `automationStudioTimedPause`. The contract is domain-agnostic. A
  node that answers `waiting` with a numeric `outputs.durationMs` and no ask is a timed pause. The run sleeps for the
  duration, held to `deadlineAt`, to the region's remaining time and to the signal. The attempt then settles
  `succeeded` with `pause: { requestedMs, waitedMs, bounded? }`. Anything else that waits (an approval, any ask)
  parks as before.
- `runtime/executor/pacing/run-wait.ts` (new): `automationStudioRunWait` is now the single wait primitive for retry
  waits, pace waits and Wait pauses. It uses `options.delay` when one is given. Otherwise it uses an unref'd timer
  that **ends at once on abort**. The old `automationStudioRetryDelay` in graph-run.ts was not signal-aware, and it
  has been removed.
- `graph-run.ts`, at the `attempt.status === "waiting"` branch: it calls the timed pause. On a pause it replaces the
  attempt and continues down `success`. If the run was cancelled during the pause, it returns `cancelled`.
- `expected-transition.ts`: Wait's expected status is now `succeeded`, and approval keeps `waiting`. Wait keeps
  `allowWaiting`, so its own dispatch-time answer still compares as `tolerated`. This keeps
  `runtime/tests/executor.test.ts` (not mine, still green) valid.
- `nodes/timing/wait.ts`: a doc comment only. Its result is unchanged, so `nodes/tests/registry.test.ts` (not mine)
  stays green.

### 2. The retry wait credits the time already passed

- `runtime/executor/defensive/credited-hint.ts` (new): `automationStudioCreditedHintMs(hint, settledAt, now)` returns
  `{ remainingMs, creditedMs }`. Credit is whole tenths of a second, so a refusal handled at once still waits the full
  hint, and the existing exact-wait tests stay deterministic.
- `graph-run.ts` retry branch: the hint passed to `automationStudioBoundedRetryWaitMs` is now
  `remainingMs = hint - (now - failed.finishedAt)`. The wait is still at least the backoff table and is still bounded.
  The retry record now also carries `hintedWaitMs` and `creditedMs`. The ledger keeps the raw hint and the actual wait.

### 3. Pace contract

- `runtime/executor/pacing/pace-metadata.ts` (new): `AUTOMATION_STUDIO_PACE_METADATA_KEY = "paceMs"` and
  `automationStudioAuthoredPaceMs(node)`. The latter accepts only a positive safe integer.
- `runtime/executor/pacing/pace-keeper.ts` (new): `automationStudioPaceKeeper()` is per-run state on `runState.pace`.
  - `before(node, now, wait)` holds an **arrival** until `lastStart + paceMs`.
  - `started(node, at)` is recorded at every real dispatch, retries included.
  - `learn(node, hintMs)` sets `pace = max(authored, min(60_000, max(hint, ceil(pace * 1.5))))`. A first hint sets
    the pace to the hint. Each further hint grows it by half again, up to `AUTOMATION_STUDIO_MAX_LEARNED_PACE_MS` =
    60 s, which matches the hint clamp. An authored pace is never lowered.
- Retries of one arrival are **not** paced. Their own wait already honours the hint, and pacing them as well would
  wait the same hint twice.
- `graph-run.ts`:
  - the pace hold runs before readiness, only on the first attempt of an arrival;
  - `started` is called just before dispatch;
  - the attempt is stamped with `pace: { inForceMs, waitedMs }`;
  - after the fault assessment, `fault.hintedWaitMs` (the domain-agnostic hint) calls `learn`, and the failed attempt
    gets `pace.raisedToMs`;
  - `runGraphToTrace` adds `trace.pace` beside `trace.defence`.
- The file stays at 798 lines, under the 800-line limit.
- `contracts.ts`:
  - new type `AutomationStudioNodePace` (`{ nodeId, paceMs, authoredMs?, learnedMs?, raisedCount, waitedMs }`);
  - `trace.pace?: AutomationStudioNodePace[]`;
  - on the attempt: `pace?` and `pause?`, plus `retry.hintedWaitMs?` and `retry.creditedMs?`.
- `run-state.ts`: adds `pace`.
- Barrel `executor/index.ts` exports `AUTOMATION_STUDIO_MAX_LEARNED_PACE_MS`, `AUTOMATION_STUDIO_PACE_METADATA_KEY` and
  `automationStudioAuthoredPaceMs`. `defensive/index.ts` exports `credited-hint.ts`.
- Trials and playback both run through `runAutomationStudioGraph`, so both honour the pace.

### 4. Trial feedback keeps what each step absorbed

- `runtime/service/candidate-trial/absorbed.ts` (new): `automationStudioTrialAbsorbedFeedback`. For each refused
  attempt a step got past, it lists:
  - `failureCode` and `happened`: "The site asked the run to slow down on pass 4 (Jonas), and to try again in 5.5 s."
    when the failure carries a hint; otherwise Core's category sentence;
  - `pass` and `row`: the row is taken from the preceding For Each or Repeat `body` attempt's `item`, reading only
    name/title/label/text/heading or a bare string or number, at most 60 characters. Withheld values and dataset
    markers give no row;
  - `askedWaitMs`, `waitedMs` (the retry's `backoffMs`) and `paceMs`;
  - a `said` sentence: what happened, how long the run waited and how much had already passed, then "it went
    through, so what the site had shown no longer stood in its way", then "From then on the run started this step at
    most once every 5.5 s."

  The failure message is never read.
- `runtime/service/candidate-trial/happened.ts` (new): the category sentence table, moved out of feedback.ts.
- `feedback.ts`:
  - `executedSteps` keeps the folded-away attempts (`absorbed`) and the current loop pass;
  - each step gets `absorbed: [...]` when it absorbed anything;
  - learned paces are said once at the top level under `paces`.

### 5. Promotion (partial)

- `runtime/service/candidate-trial/learned-paces.ts` (new): `automationStudioTrialLearnedPaces(trace, graph)` maps
  each learned `trace.pace` entry from the run's node id to the plan's keys, giving
  `{ subflowKey, nodeKey, paceMs }`. Both keys come from `metadata.bootstrapSymbolicKey` on the trial graph and its
  node.
- `contracts.ts`: adds `AutomationStudioCandidateTrialLearnedPace` and `AutomationStudioCandidateTrialRecord.learnedPaces?`.
- `run.ts`: puts `learnedPaces` on every trial record after execution.
- `promotion.ts`: the deciding trial's `learnedPaces` go on the `candidateTrial` audit detail. The plan stays as it was
  judged. A header comment states exactly what remains.

### Tests (changed and added)

- `executor/pacing/tests/graph-pacing.test.ts` (new, 7 tests). It covers:
  - Wait reaches End with `pause` set;
  - the deadline bounds the pause;
  - cancelling during the pause ends the run cancelled;
  - the credited retry: a 3 s snapshot leaves 2 500 ms waited and `creditedMs` 3 000;
  - an authored pace of 4 000 gives waits `[3000, 3000]`;
  - a pace learned at 2 000 grows to 3 000, with waits `[2000, 1000, 2000, 2000]` and the `trace.pace` entry;
  - without a pace or a hint, nothing is paced.

  It sits under `pacing/tests/` because `executor/tests/` would have reached 26 files, over the 25-file audit limit.
- `executor/pacing/tests/pace-keeper.test.ts` (new): the metadata reader, the hold, learning, growth and the ceiling,
  the authored pace above the ceiling, and abort-awareness of the run wait.
- `executor/defensive/tests/credited-hint.test.ts` (new).
- `candidate-trial/tests/feedback.test.ts`:
  - 2 existing expectations were updated to include `absorbed`. They encoded the `attempts: 2`-only defect the brief
    asks to fix.
  - 2 new tests: a refusal with pass, row, wait and pace, and a row that is withheld or a marker.
- `candidate-trial/tests/learned-paces.test.ts` (new).
- `candidate-trial/tests/promotion.test.ts`: 2 new tests. One checks the audit detail carries `learnedPaces` and the
  plan is unchanged; the other checks there is nothing when the trial learned nothing.
- `candidate-trial/tests/run.test.ts`: 1 new end-to-end test through the real detached runner. A press is refused with
  a 5 500 ms hint and then accepted. It checks `record.learnedPaces = [{ primary, press, 5500 }]` and the feedback's
  `absorbed`.

## Commands run and observed results

All commands were run from `T/!FluxIQ`.

| Command | Observed result |
| --- | --- |
| Baseline, before editing: `npx vitest run .../runtime/executor .../runtime/service/candidate-trial` | 1 failed, 492 passed. The failure is `executor/tests/failed-step-reason.test.ts`: `expected 'the site asked FluxIQ to slow down' to be 'the page was busy'`. It is activity wording from another worker, not mine. |
| Fail-first: HEAD `graph-run.ts` swapped in, `npx vitest run .../executor/tests/run-pacing.test.ts`, then restored (`cmp` confirmed it restored) | 6 failed, 1 passed. The pass is the no-pace control. |
| Fail-first: HEAD `feedback.ts`, `run.ts` and `promotion.ts` swapped in, `npx vitest run .../service/candidate-trial`, then restored (`cmp` confirmed) | 6 failed, 43 passed. Every new or updated test failed. |
| Final: `npx vitest run .../runtime/executor .../runtime/service/candidate-trial .../nodes/tests/registry.test.ts .../runtime/tests/executor.test.ts` | Test Files 1 failed, 46 passed. Tests 1 failed, 546 passed. The only failure is the same pre-existing `failed-step-reason.test.ts` assertion. |
| After moving the test: `npx vitest run .../runtime/executor/pacing` | 17 passed |
| `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` | One error, in `runtime/flow-bootstrap/candidate/tests/refusal-domain-fixture.ts(40,32)` (TS2322, another worker's file). Nothing in my files: one test-file error of mine, an `exactOptionalPropertyTypes` cast, was fixed and re-checked. |
| `node scripts/structure-audit.mjs` | 2 violations, neither mine: `as-never` in `runtime/llm/decision-handlers/tests/candidate-repeat-told.test.ts:29`, and `failure-as-empty` in `runtime/llm/repeat-guard/outcomes.ts:356`. My only audit output is the advisory warnings on `executor/contracts.ts` (538 lines) and `graph-run.ts` (798 lines); both files were already past the 400-line advisory threshold. |

## Not verified

- **No live or Lab run** (the brief excluded them). It is not shown that a 5.5 s learned pace avoids the 7th-press
  refusal on social-network-feed, or that crediting shortens the time the notice stays up in the browser.
- **"The run closed the site's notice."** Core has no structured record of it. The extension's
  `validation.actual` prose ("closing 1 dialog...") does not reach the Core attempt as data. The feedback therefore
  says only what Core knows: after the wait the step went through, "so what the site had shown no longer stood in its
  way". A producer field (for example a `dismissed` count on the success result) would be needed to say "closed".
- **A resumed run (park, then resume) starts with no pace state.** The seed does not carry it. Learned paces are lost
  across a park.
- The pace hold runs before readiness and before the region-timeout check is recomputed. A long pace inside a region
  with a timeout is not counted against that region before dispatch.
- `runtime/tests/executor.test.ts` was not changed. Its Wait case now sleeps a real 1 s, because it passes no `delay`.
  It still passes.

## Open questions or contradictions found

1. **Item 5 needs `R/flow-bootstrap/**`, which is forbidden to me.** To make the saved Flow keep the pace:
   - (a) `flow-bootstrap/plan/contracts.ts`: add `paceMs?: number` to `AutomationStudioFlowBootstrapNode`.
   - (b) `flow-bootstrap/plan/parsing.ts:107`: add `"paceMs"` to the `rejectFields` allowlist, with a
     positive-safe-integer check.
   - (c) `flow-bootstrap/adaptation.ts` (node `metadata`, about line 220): copy it as
     `[AUTOMATION_STUDIO_PACE_METADATA_KEY]: node.paceMs`.
   - (d) Then `promotion.ts` sets each plan node's `paceMs` to the larger of its own and the deciding trial's
     `learnedPaces` for that `subflowKey` and `nodeKey`, in both `buildPlan.plan.subflows[].nodes` and
     `buildPlan.subflows[].nodes`, and passes that plan to `propose`. That is about 15 lines in my area once (a)-(c)
     land.

   The script-syntax worker's `repeat pace:` needs the same (a)-(c), so one change serves both. Another worker is
   currently editing `flow-bootstrap/authoring/*` in this tree.
2. Promotion raising the plan's pace changes the plan after the digest the trial was judged on. This is intended,
   since it is the trial's own learning, but whoever wires (d) should decide whether the audit should name the change.
   It already records `learnedPaces`.
3. The pre-existing failure in `executor/tests/failed-step-reason.test.ts` (activity wording) and the `tsc` error in
   `flow-bootstrap/candidate/tests/refusal-domain-fixture.ts` belong to other workers.

## Contract for the script-syntax worker

- **Metadata key to write:** Flow node `metadata.paceMs`, a positive safe integer in milliseconds
  (`AUTOMATION_STUDIO_PACE_METADATA_KEY`, exported from `runtime/executor`). Put it on the node whose starts are
  paced, the act inside the span, not the For Each. It reaches the node through the plan node field `paceMs` once
  (a)-(c) above land.
- **Trace field to read (written by the runtime, not by authors):**
  - `trace.pace[]`: `{ nodeId, paceMs, authoredMs?, learnedMs?, raisedCount, waitedMs }`;
  - per attempt: `attempt.pace { inForceMs, waitedMs, raisedToMs? }`, `attempt.pause { requestedMs, waitedMs, bounded? }`,
    and `attempt.retry.hintedWaitMs` / `creditedMs`;
  - trial record: `learnedPaces [{ subflowKey, nodeKey, paceMs }]`.
