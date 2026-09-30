# t194-w16: Lab spend, settle, and failure-label fixes

## Outcome

Done. All three defects are fixed and tested on both sides. Nothing was committed. There was no Lab run and no browser.

## What changed and why

### 1. Spend was under-reported (run 7)

Run 7's `snapshots/live-llm.json` `observed` was the build alone: $0.041788 and 22 calls. The playback's two judge calls were only in `repair.observed` and `verification`. The re-author's 36 calls and $0.042481 were only in Core's `metadata.resultReauthor.attempts[].accounting` and on the re-author's adaptation (`evidenceLoop.totalProviderCallCount`).

- New `packages/test-runner/src/live-llm/reauthor-record.ts` (`readLiveLlmReauthor`). It reads `metadata.resultReauthor.attempts[]` from the raw run detail and records each attempt's tokens and cost from Core's own accounting. It takes each attempt's call count from one of two places: the attempt's own `evidenceLoop` (a build that failed), or `get-flow-adaptation` → `adaptation.evidenceLoop.totalProviderCallCount` (a build that succeeded). `callsFrom` says which one: `loop`, `adaptation`, `adaptation_unreadable` or `not_recorded`. It keeps counts and ids only.
- New `packages/test-runner/src/live-llm/run-spend.ts` (`liveLlmRunSpend`). It adds up four phases: build, runtime (the Flow run's own calls), judge and re-author. The result check's calls are counted once. When a run detail is read from its interventions (no accounting and no per-call lines), those interventions already include the check. So a check call the runtime phase itemized under the same request id is moved out of that phase and counted under `judge`. When the run has accounting or per-call lines, the check is added, because Core leaves it out of those.
- `live-llm-run.ts`:
  - `readRunRecords` also reads the re-author record.
  - The snapshot's `observed.calls` and `observed.totalEstimatedCostUsd` are now the whole run's. The spend ledger reads `observed.totalEstimatedCostUsd`.
  - The snapshot gains `observed.phases`, `runSpend` and `reauthor`.
  - `build`, `repair` and `verification`, and the rest of `observed` (`accounting`, `observedCalls`), are unchanged, so each phase can still be read on its own.
  - `usage.calls`, which becomes the evaluation's `llm.calls`, is the whole-run count.
  - The settle events of `settle`, `settleRepair` and `settleUnfinished` carry `runTotal`.
  - Per-phase budget checks are unchanged.
- On run 7's numbers the test gives: 60 calls, $0.086099304 (build 22 / $0.04178802, runtime 0 / $0, judge 2 / $0.001830072, re-author 36 / $0.042481212). This matches the debug's hand count.

### 2. The Lab idled 306 s after a failed repair re-run

- Core `service/runtime-adaptation/repair-rerun.ts`: once the re-run reaches a terminal status (`isTerminalRuntimeSessionStatus`), its saved detail carries `metadata.recoveryState: { state: "ended", startedAt, endedAt }`, using the existing `AutomationStudioRunRecoveryState` type. A marker the first pass already wrote as `ended` or `threw` is kept. A carried-over `running` marker is replaced.
  - The fix applies to both re-run kinds, but only the `start` kind (a re-authored Flow) lacked a marker. A resumed re-run already carries the ladder's `ended`, and it is preserved.
- Lab `flow-lane/terminal-run-wait.ts`: `pendingWork` no longer reports `recovery` for a failed run whose `metadata.repairedRerun.status` is terminal. The `repair` check (`resultRepair.phase` of `reauthoring` or `rerunning`) still runs first, so a repair still in flight keeps its full bound.

### 3. A build without a Flow was labelled a facility failure (run 5)

- New `packages/test-runner/src/run-scenario/product-failure.ts` (`productFailureOf`). A `RunnerFailure` of category `runtime.behavior` is the product's failure, not the facility's. The codes are:
  - `flow_lane.flow_not_built`, when the Flow lane published no created Flow. It carries Core's closed `buildFailureCode`, such as `flow_bootstrap.evidence_unusable_decision`, taken from `details.failure.code` and screened by a closed-code pattern.
  - `flow_lane.product_behavior`, for a product failure after the Flow was built.
  - `recording_lane.product_behavior`, for the same on the recording lane.
  - Every other category, and any non-`RunnerFailure` (a browser crash, an unreachable server), returns `undefined` and is projected as before.
- `run-scenario.ts`, failure-classification lines only: `facilityFailure` is projected at `scenario.execute` only when `productFailureOf` returns nothing. The failure event carries `productFailure` (its code and the build's code). The function is exported through `run-scenario/index.ts`.

## Commands run and observed results

- Core, in `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/service/runtime-adaptation` → `Test Files 5 passed (5)`, `Tests 46 passed (46)`, run twice. `repair-rerun.test.ts` has 7 tests, 4 of them new.
- Core: `npx tsc --noEmit -p tsconfig.json`. The first run gave exit 2: my test's metadata type failed under `exactOptionalPropertyTypes`. After the fix it gave exit 0 with no output.
- Core: `node scripts/structure-audit.mjs` → `structure-audit: passed (201 warning(s), 354 baselined)`. It also said "1 baseline entries can be lowered"; that is not from my change, and I did not run baseline.
- test-runner: `npx tsc -p tsconfig.json --noEmit` → exit 0. I ran it before the slot freed and again after each change.
- test-runner: `pnpm test`, run after `lab-slots/slot-3/owner` was gone.
  - Run 1: 1694 pass, 6 fail. Three were my own stale expectations: the new `runTotal` in `lane-settlement.test.ts:161` and `live-llm-run.test.ts`, and a missing `llmGate` in my new test. I fixed them.
  - Run 3 (final): 1698 pass, 2 fail. All 16 new or updated tests pass.
  - The 2 remaining failures are not in my files:
    - `runner-wiring.test.ts` "the redaction attestation scans...": it expects a `runRedactionScopes(...)` string that `run-scenario.ts:617` does not contain, and that line is outside my diff.
    - `demo-workspace.test.ts:38` "resolves one reusable demo directory".
  - `clone-cache.test.ts` "serializes simultaneous..." timed out on its lock in runs 1 and 2 and passed in run 3, so it is flaky.
- Downstream `node scripts/structure-audit.mjs`. The first run flagged `failure-as-empty` in `reauthor-record.ts:95` and `product-failure.ts:57`. I fixed both: `callsFrom: "adaptation_unreadable"`, and removed an unneeded try/catch. After that, one violation remains, and it is not mine: `[naming] domain/src/actions/extraction/: 3 files share the prefix "condition-"`, from another worker's untracked `condition-seen.ts`.

## Not verified

- No live run. That the spend ledger (`scripts/lab/live-guards/run-outcomes.mjs`) now records the whole-run figure was shown only through the snapshot field it reads, not by the ledger itself.
- The Core fix was not exercised end to end through `service.ts` with a real refuted, re-authored and failed re-run. It is covered only by the module test.
- I did not rebuild Core's `dist`, so a live run needs `buildCore` before it picks up the marker. The Lab's side of the fix works without it.

## Open questions or contradictions found

1. **Campaign rows still under-report (`scripts/lab/live-campaign/row/reported-spend.mjs`, not mine).** For a created Flow it sums `build.accounting` and `repair.observed`, so it leaves out the re-author, and the judge too when the playback has accounting. It should read `runSpend.totalEstimatedCostUsd`, or `observed.totalEstimatedCostUsd`, instead.
2. **"Its own category."** The evaluation's `failureCategories` is a closed list in `packages/test-contracts` (not mine), so a build with no Flow still has `failureCategory: runtime.behavior`. What now tells it apart is `facilityFailure: null`, `flowCreated: false`, and `productFailure.code: flow_lane.flow_not_built` on the failure event. A real category, such as `flow.not_built`, needs a test-contracts change.
3. **`flow_lane.flow_not_built` is broad.** It is also used for a `runtime.behavior` failure raised during the recorded Flow lane's recording phase, before any build. That is still true (no Flow was built), but less specific.
4. **Possible double counts.**
   - If a future Core puts re-author calls into the run's own per-call lines or accounting, `runSpend` would count them twice.
   - A judge call with no request id cannot be matched, so in the interventions-only path it would be counted in both the runtime and judge phases.
   - Both errors over-report rather than under-report.
5. The runner-wiring and demo-workspace failures listed above predate this work.
