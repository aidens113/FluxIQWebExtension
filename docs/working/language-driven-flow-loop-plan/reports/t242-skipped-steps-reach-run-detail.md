# t242 skipped steps reach run detail: worker report

## Outcome

Done, after the follow-up wiring the coordinator assigned mid-task (see "Wiring").

- Core's run detail carries `skipped`.
- The Lab reads the mark into its actions table.
- `run-scenario.ts` passes each Flow run's skips to the playback step writer.
- The writer writes a skipped sometimes-present step as `skipped`, never `failed`.

My first hand-back said Partial; this report replaces it. The "Open questions" section below records what was
missing at that point; the wiring section is the answer.

## What changed and why

Core (`fxwork/t242/!FluxIQ`, branch `task/t242-skipped-steps-reach-run-detail`):

- `packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/conversions.ts`:
  `runtimeActionAttemptsFromSession` copies `attempt.skipped` as `{ reason, code }` onto each action record. A
  skipped attempt reads `succeeded` with `route: "skipped"`, which a reader cannot tell apart from a press without
  this field.
- `packages/fluxiq/src/programs/automation-studio/model/flow-adaptation.ts`: **this declares the run-detail type**.
  It adds `skipped?: { reason: "target_absent"; code: string }` to `AutomationStudioFlowRunActionAttemptRecord`.
  The field is top-level, the same as `failure`, not under `metadata`. The typed SQLite store keeps the whole
  action JSON in `detail_json`, so the field survives storage. Summary-only rows, which hold columns only, keep
  `route: "skipped"` but drop `skipped`. That is the same as every other non-column field.
- `.../summaries/tests/conversions.test.ts`: two new cases. One checks that a skipped attempt carries the mark and
  no `failure`. The other checks that attempts that ran carry no mark.
- `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`: regenerated.
  The only change is shifted line numbers for declarations below the inserted type lines.

Downstream (`fxwork/t242/!FluxIQWebExtension`):

- `packages/test-runner/src/lab-runs/write-playback-steps.ts`:
  - New optional input `skippedSteps?: readonly PlaybackSkippedStep[]`, where
    `PlaybackSkippedStep = { nodeId: string | null; startedAt: number; finishedAt: number; reason: string; code: string }`
    in epoch ms.
  - A skip claims the first unclaimed host attempt that:
    - did not succeed,
    - was dispatched within the skipped attempt's `[startedAt, finishedAt]`, and
    - failed with the code the skip names.
  - The claimed attempt is written as `status: "skipped"` in both `meta.json` and `result.json`. It gets
    `failureCode: null`, `failure: null` and a `skipped: { reason, code, nodeId }` mark, and its summary starts
    with `skipped (...)`. The host's failure record is kept as `result.observed`, as evidence of what observed
    the absence.
  - A skip with no host attempt (`executor.ready_state.not_shown`, where nothing was dispatched) gets its own
    `NNNN-run-skipped` folder, in time order, so that every runtime step is listed.
  - Skips outside the playback window are ignored.
  - The writer now also writes when only skips exist, and does nothing when there are neither skips nor attempts.
- `packages/test-runner/src/lab-runs/index.ts`: exports `type PlaybackSkippedStep`.
- `packages/test-runner/src/lab-runs/tests/write-playback-steps.test.ts`: two new cases:
  - a matched skip is written as skipped, while the same `web.target.not_found` on a step that was not skipped stays
    failed, and `index.md` shows both;
  - an undispatched skip gets its own folder in time order, and an out-of-window skip is ignored.
- `rewrite-steps-index.ts` is unchanged. Its Summary column already shows the `skipped (...)` summary, and the new
  tests assert this through `index.md`.

## Commands run and observed results

- Failing first, Core: `npx vitest run .../summaries/tests/conversions.test.ts` -> `1 failed | 12 passed`. The new
  case was missing `skipped`.
- Failing first, Lab: I declared the input field only and ran `pnpm run build` (heavy.sh). tsc reported TS2353 on
  the test because the type was not declared yet, and still emitted. Then
  `node --test dist/lab-runs/tests/write-playback-steps.test.js` -> `# pass 3 # fail 2` (`expected: 'skipped'`,
  `actual: 'failed'`).
- After the change, Core: `npx vitest run src/.../service/summaries/tests/` -> `6 passed (6)`, `54 passed`.
- `pnpm --filter fluxiq check` (heavy.sh) -> exit 0.
- Core libs (heavy.sh)
  `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> exit 0
  (`fluxiq build: Done`).
- `pnpm --filter @fluxiq-web-extension/test-runner check` (heavy.sh) -> exit 0.
- test-runner `pnpm run build`, then
  `node --test dist/lab-runs/tests/write-playback-steps.test.js dist/lab-runs/tests/lab-run-record.test.js` ->
  `# tests 11 # pass 11 # fail 0`.
- `node scripts/structure-audit.mjs`, Core -> `structure-audit: passed (218 warning(s), 349 baselined)`.
- `node scripts/structure-audit.mjs`, downstream -> `structure-audit: passed (157 warning(s), 118 baselined)`.
- `node scripts/docs-reference.mjs --check` (Core) -> stale. Ran `node scripts/docs-reference.mjs` to regenerate.
  The diff is line-number shifts only. Re-ran `--check` -> `Deterministic framework reference is current.`

## Not verified

- No live run. A real skip has not been seen to flow from Core through the run detail into `steps/`.
- The time-window match assumes that `dispatchedAt` falls inside the graph attempt's `startedAt`..`finishedAt`.
  Both are stamped in Core's process with its own clock. This has only been exercised in unit tests.
- No full suites, per the brief.
- I did not look at whether the web UI or the Lab's run-detail parser should show `skipped`.

## Open questions or contradictions found

- **The wiring is outside this brief, and the live Lab needs it.** The writer reads only Core's host command
  attempts, which carry no node id. Core keeps the run detail in SQLite, so the writer cannot read it from disk.
  The skips therefore have to be passed in by the caller.
  - `packages/test-runner/src/run-scenario.ts:627` (not owned) has to pass `skippedSteps`.
  - Its source is the run detail the lane already reads in `flow-lane/persisted-flow-run.ts` (not owned).
    `PersistedFlowAction` would need a `skipped?: { reason, code }` field parsed from the run detail's
    `actionAttempts[].skipped`, together with a numeric start and finish time.
  - `recordEvidence` in `run-scenario.ts` (around line 321) could then collect the skips, the same way it collects
    `actions`.
  - Proposed follow-up brief: own `persisted-flow-run.ts`, `persisted-attempt.ts` and `run-scenario.ts`, and their
    tests.
- `persisted-flow-run.ts` still treats a skipped attempt as a plain `succeeded` action, so the Lab's own judgement
  does not distinguish a skip either. That belongs to the same follow-up.

## Wiring (coordinator follow-up, same trees)

The coordinator added ownership of `run-scenario.ts` (the `writePlaybackSteps` call), `flow-lane/persisted-flow-run.ts`
and their tests.

What changed:

- `packages/test-runner/src/flow-lane/skipped-attempt.ts` (new): `skippedAttemptOf` and `PersistedFlowActionSkip`.
  - It reads Core's `actionAttempts[].skipped` only in its closed shape: `reason === "target_absent"`, and a code of
    dotted lowercase words of at most 120 characters, so page text cannot reach the bundle.
  - The span is in epoch ms: `startedAt`, and `finishedAt` (which falls back to `startedAt` for a skip that
    dispatched nothing).
  - It lives in its own file rather than inside `persisted-flow-run.ts` because that file went to 821 lines, and the
    audit fails anything past 800 lines. The Lab's other per-attempt readers already live outside it, in
    `persisted-attempt.ts`.
  - It is imported directly, the same way `persisted-attempt.ts` is, and is not added to the `flow-lane/index.ts`
    barrel (not owned).
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`: `PersistedFlowAction` gains
  `skipped?: PersistedFlowActionSkip`, which `flowAction` sets. The file is 797 lines (792 before).
  - Superseded: the status is now the literal `skipped`. See "Literal `skipped` status" below.
- `packages/test-runner/src/run-scenario.ts`: three edits plus the import, which is slightly more than "the call only".
  - The new list is `const playbackSkips: PlaybackSkippedStep[] = []` next to `actions`.
  - `recordEvidence` adds `playbackSkips.push(...evidence.run.actions.flatMap(action => action.skipped ? [{ nodeId: action.nodeId, ...action.skipped }] : []))`
    next to the existing `actions.push`.
  - The call at about line 630 now passes `skippedSteps: playbackSkips`.
  - The collection line is needed because nothing else in scope at the call still holds the run's actions.
  - Build-phase skips, if any, are dropped by the writer's playback window.
- Tests:
  - `flow-lane/tests/skipped-attempt.test.ts` drives the parse through `executeRecordedFlowRun` with a fake run
    detail. It covers a skipped attempt, malformed marks, and a skip with no finish time.
  - `run-scenario/tests/playback-skips-wiring.test.ts` reads the runner source, following the
    `run-evaluation/tests/runner-wiring.test.ts` precedent, because `runScenario` needs the whole Lab. It checks the
    collection and that the one `writePlaybackSteps` call passes `skippedSteps: playbackSkips`.
  - The wiring test is placed there because `src/tests/` is at its baselined 25-file limit (49 files), and adding one
    failed the audit's `directory-files` rule.

Commands run and observed results:

- Failing first: the new parse and wiring tests were built before the implementation (tsc reported TS2339
  `skipped` and still emitted). `node --test dist/flow-lane/tests/persisted-flow-run-skipped.test.js dist/tests/run-scenario-playback-skips.test.js`
  -> `# tests 5 # pass 1 # fail 4`. The one that passed is the negative case, which holds before the change. These
  files were then renamed and moved as described above.
- `pnpm run build` (heavy.sh) -> `test-runner:build` stored, no TS errors.
- `node --test "dist/flow-lane/**/*.test.js" dist/lab-runs/tests/*.test.js dist/run-scenario/tests/*.test.js dist/run-evaluation/tests/runner-wiring.test.js`
  -> `# tests 438 # pass 438 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check` (heavy.sh) -> exit 0.
- `node scripts/structure-audit.mjs`, downstream -> `structure-audit: passed (157 warning(s), 118 baselined)`. Two
  earlier failures were fixed as described above: `persisted-flow-run.ts` at 821 lines, and `src/tests/` at 50 files.
- `node scripts/structure-audit.mjs`, Core -> `passed (218 warning(s), 349 baselined)`. Core files are unchanged
  since that run.

Not verified (wiring):

- No live run, so the path from Core through `get-flow-run-detail`, `recordEvidence` and the writer into `steps/` has
  not been seen end to end in a real run. The wiring is proved by a source-reading test, not by executing
  `runScenario`.
- No commits, per the brief.

## Literal `skipped` status (coordinator decision, same trees)

The coordinator decided that a skipped attempt reads as the literal `skipped`, never `succeeded` or `failed`. I
was given `packages/test-contracts/src/run.ts`, `run-validation.ts` and the tests beside them, plus every consumer
the type checker names.

What changed:

- `packages/test-contracts/src/run.ts`: `runActionStatuses` gains `"skipped"`, placed after `"failed"`, with a
  doc comment.
  - `run-validation.ts` needed no edit: `actionTiming` validates `status` against `runActionStatuses`.
- `packages/test-contracts/tests/run-manifest.test.mjs`: a new case checks that a manifest action with
  `status: "skipped"` validates and parses.
- `flow-lane/persisted-flow-run.ts`: `flowAction` sets `status: skipped ? "skipped" : runActionStatus(...)`.
  `run.json`'s `actions[]` (through `recordEvidence`) and the actions table therefore read `skipped`.
- The type checker named no consumer, because the status is compared as plain strings. Five plain-string
  `=== "succeeded"` checks, however, judge "ended well". Left alone, they would have judged a run with a skipped
  popup as failed. I extended each to accept `skipped`, since a skipped step ended its node and the run went on.
  - **These are beyond the listed files**, done because the decision cannot hold without them.
  - `flow-lane/lane-observation.ts`: `recordingLaneProbeObservation` (every action ended well -> `passed`) and
    `reportedVerdict`.
  - `flow-lane/node-recovery.ts`: `endedWell`.
  - `flow-lane/recovery-attribution.ts`: `nodeAttribution.succeeded` and `absorbedEveryFailure`.
  - `flow-lane/persisted-flow-run.ts`: `stopWithoutFailedAttempt`.
- `flow-lane/tests/skipped-attempt.test.ts`:
  - The first case now asserts `status === "skipped"`.
  - A new case: a run with a skipped popup and one press is judged `passed` by both `flowLaneObservation` and
    `recordingLaneProbeObservation`. Every node ends well, and `absorbedEveryFailure` is false.

Commands run and observed results:

- Failing first, contracts: `pnpm --filter @fluxiq-web-extension/test-contracts test` ->
  `not ok 114 - an action the run skipped is recorded as skipped`, `# pass 156 # fail 1`. After the change,
  `# tests 157 # pass 157 # fail 0`.
- Failing first, Lab, proved by reverting on purpose and rebuilding, then restoring from a scratch copy:
  - (A) Status line reverted -> `skipped-attempt.test.js`: `# pass 2 # fail 2` (the status case and the judgement
    case).
  - (B2) Only the consumer edits reverted -> `# pass 3 # fail 1`, with the judgement case at `expected: 'passed'`,
    `actual: 'failed'`. This is the exact regression the consumer edits prevent.
  - An earlier revert run (B) also failed, but on a wrong expectation of mine: `recoveredByNode` returns "node ended
    well", so `[true, true]` is correct. I fixed the expectation and re-ran it as B2.
- `pnpm --filter @fluxiq-web-extension/test-contracts check` (heavy.sh) -> exit 0.
- test-runner `pnpm run build`, then node --test over `flow-lane/**`, `lab-runs`, `run-scenario`, `run-evaluation`,
  `run-manifest` and `core-action-probe` tests -> `# tests 503 # pass 503 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check` (heavy.sh) -> exit 0.
- `node scripts/structure-audit.mjs`, downstream -> `passed (157 warning(s), 118 baselined)`.
- `node scripts/structure-audit.mjs`, Core -> `passed (218 warning(s), 349 baselined)`.

Not verified, or left open:

- **The existing/clone target path still reads a skip as `succeeded`.**
  - `existing-fluxiq-control.ts` `runAction` (line 760) parses no `route` or `skipped`, and `flowActionTimings`
    (`run-manifest/action-timings.ts`) maps Core's raw `succeeded`.
  - It is never `failed`, but it is not `skipped` either.
  - Making it `skipped` needs `runAction` to keep the mark and `flowActionTimings` to map it. That is a separate
    brief, because those files are outside this one and that lane is not the created-Flow lane.
- `scenario.ts` lets a scenario declare only the two statuses a finished attempt reaches (`succeeded`, `failed`). I
  did not add `skipped` as a declarable expectation.
- Apps and domain: `apps/scenario-lab` has a test that references `RunActionTiming`. It was not run, because it is
  outside the named tests. `pnpm check` (a full suite) was not run.
- No live run.
