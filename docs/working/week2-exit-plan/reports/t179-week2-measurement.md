# t179: Week 2 measurement and the provider-free UI exit lane

Lane lead: t179 (worker to the supervisor). Date: 2026-09-29.
Trees: `C:\Users\osrs_\FluxStuff\fxwork\t179\!FluxIQWebExtension` and Core
`C:\Users\osrs_\FluxStuff\fxwork\t179\!FluxIQ`, branch
`task/t179-week2-measurement`. Nothing committed. No live run, no provider call.
Core was read, not edited.

## Outcome

Partial. Goal 3 is done. For Goal 2, the command exists but its live run verified 0 of 4 journeys. Goal 1 is done on the measuring side: the corpus, the
per-run reader, the contracts and the aggregates are in place. The Flow lane still
has to write `snapshots/adaptation.json`, and that call belongs to t176/t177's
files, so a real run still records all four metrics as `null`. Goal 2 is covered
by the `ui:e2e` section below, from sub-worker t179-U2.

## Goal 1: the `week2` corpus and the Week 2 metrics

### What changed

- **Contracts, `packages/test-contracts/src/adaptation-reuse.ts`.**
  - `proposed` is added to `adaptationRecordStatuses`. It is Core's status for
    a build or repair awaiting review, and the contract used to refuse it.
  - New types: `RunAdaptationMeasurements` for one run, and four bench
    aggregates: `BenchAdaptationReuse`, `BenchAdaptationValidation`,
    `BenchAdaptationPersistence` and `BenchAdaptationCost`.
  - The doc comments now name the Core fields that really exist. Core has no
    `metadata.adaptationsExercised` and no `metadata.resume`.
- **Validators, `adaptation-reuse-validation.ts`.** Each aggregate has a
  validator. It checks that the counts nest, that the tallies sum, that the rate
  matches its counts, and that `measuredRuns` is at least 1. An aggregate that
  no run measured is `null`, never a record of zeros.
- **Report contract, `bench-report.ts` and `bench-report-validation.ts`.** These
  two files are outside my list. I had to edit them because the report typed
  the four fields as `null` and refused any other value. The four fields are
  now `Bench* | null` and are checked by the validators above. `harnessRecovery`
  stays reserved and must be `null`.
- **Per-run reader, `packages/test-runner/src/run-evaluation/adaptation/`.**
  - `core-reads.ts`, `readRunAdaptationMeasurements(control, { projectId, flowId, runId })`,
    makes these reads through the generic `automationStudioCall`:
    - `get-flow-run-detail`;
    - `get-flow`, for the Flow and for each Subflow graph the run entered;
    - `get-flow-adaptation`, for each adaptation the run created, trialled, or
      executed a stamp of.

    It throws on a mismatched or malformed payload. It never measures a partial
    read.
  - `measure.ts` is pure. It works out the four records as follows:
    - Reuse is the adaptations Core stamped on nodes the run attempted
      (`metadata.adaptationIds`), limited to those the run did not create and
      that Core holds as `applied`. This is Core's own replay rule. The provider
      count is `llmGate.costAccounting.calls`. The resume record comes from
      `metadata.adaptiveRetry` plus the `resumeFrom` and `adaptationId` of the
      resumable patch attempts.
    - Validation uses Core's `decideAutomationStudioChangeConfidence`, imported
      from `fluxiq/automation-studio`.
    - Persistence is the stored status, plus `baseRevision` and
      `appliedRevision`, read from `metadata.phase9` or the legacy `metadata`.
    - Cost is Core's accounting. `reservedCalls` is counted only when Core
      itemized every call.
  - `snapshot.ts`:
    - defines `RUN_ADAPTATION_SNAPSHOT = snapshots/adaptation.json`;
    - `flowLaneAdaptationMeasurements(bundlePath)` reads it back member by
      member;
    - a member that is absent, not JSON, or off-contract reads as `null`, so a
      bad file never throws after a run or in the middle of a bench.
- **Evaluation wiring.**
  - `observed-run-evaluation.ts` takes `adaptation?` and keeps it only for a
    Flow lane whose Flow was created.
  - If a run with no live provider shows a provider count above 0, or reuse and
    cost disagree, both of those records become `null`. The finished run's
    evaluation is not thrown away over them.
  - `single-run-evaluation.ts` reads the snapshot from the bundle, and so does
    `bench/evaluate-run.ts` (`evaluateFlowRun`). `FLOW_LANE_SOURCES.adaptation`
    documents where the figures come from.
- **Aggregates.**
  - `bench/adaptation-metrics.ts` counts from each run's own records.
  - Reuse = deterministic replays ÷ the exercising runs whose provider count
    Core stated. A deterministic replay is an exercising run with 0 provider
    calls and 0 interventions. Uncertified runs are counted beside the rate.
  - `aggregate-report.ts` uses it. `comparison-details.ts` lists eight Week 2
    figures. `render-markdown.ts` prints a "Week 2 adaptation, Flow lane"
    section.
- **Corpus, `bench/corpus/week2.ts`.** It is registered in `benchCorpora`. It
  runs on the Flow lane only, with 8 results per repeat and 0 skipped:

  | Row | Scenario | Workflow | Results |
  | --- | --- | --- | --- |
  | A01 | identity-drift | primary | unarmed and `renamed-redesign` |
  | A02 | product-catalog | primary | `text-variant` |
  | A03 | data-table | primary | `column-reorder` |
  | A04 | modal-flows | `consent-then-click` | `banner-absent` |
  | A05 | intermediate-state | primary | `unannounced` |
  | A06 | member-directory | primary | unarmed and `restyled` |

  The ids are `A..` rather than `W2-..` because `CORPUS_ROW_ID` is
  `^[A-Z]+[0-9]+$`. The first attempt failed report validation on exactly this.
- **Docs.** `docs/architecture/testing-facility.md` now describes the `week2`
  corpus, the Week 2 adaptation metrics, and the X5.5 exact-success rule.

### Handoff: needed before any run populates the metrics

1. **The Flow lane has to write the snapshot. This is in t176/t177's files.**
   - Add the call where the lane still holds the Core control and the run's
     `projectId`, `flowId` and `runtimeRunId`, and Core has not yet deleted the
     isolated workspace. That is next to where `run-scenario.ts` writes
     `snapshots/flow-lane.json` (around `:382` and `:482`). The created-Flow
     lane and the recorded lane both need it.
   - The call:
     `await bundle.writeStructured("snapshots/adaptation.json", await readRunAdaptationMeasurements(control, { projectId, flowId, runId: runtimeRunId }))`.
   - Wrap it so that a failed read writes nothing. A missing file means
     unmeasured, which is correct.
   - Nothing else changes. Both evaluators already read the file.
2. **Core gap: a provider-free replay can never be certified.**
   - Only `runtime/recovery/annotation/annotate.ts` writes
     `metadata.llmGate`. A run that never failed has no `costAccounting`.
   - Its provider count is therefore `null`, and the contract says a `null`
     count certifies nothing. Every clean deterministic replay is counted
     **uncertified**, and the reuse rate stays `null`.
   - The fix belongs in Core: the finished run detail should always state
     `llmGate.costAccounting` from the run budget, with `calls: 0` for a run
     that asked nothing. It is near the run-detail save in `service.ts`, which
     is the serial bottleneck, so I did not edit it.
3. **Core writes no replay results in production.**
   - `recordAutomationStudioAdaptationReplays`
     (`runtime/adaptation-confidence/replay.ts`) has no caller outside tests,
     so `established` cannot be reached.
   - Until it is wired, validation tiers will show `provisional` at most.
4. **No item-selector drift fixture.** D2.9d's item-selector drift variant does
   not exist yet, so it has no row. The row and the fixture should be added
   together.

### The `week2` corpus measurement: not run

A provider-free `lab bench --corpus week2` run now would record all four
aggregates as `null`, because of handoff item 1. With the model off, it cannot
create a repair either. It would cost a Core and a browser per result on a
shared 12 GB machine and measure nothing new. The run belongs after item 1
lands, and ideally after item 2.

## Goal 3: count-only extraction never scores 1.0 (X5.5)

- **Cause.** `bench/extraction-metrics.ts` `exactSuccess` counted a run as exact
  whenever every judged step passed `extractionStepMatched`. For a count-only
  step that is true as soon as the counts agree, so a Flow lane made of
  count-only steps, such as `data-table-inventory-large`, printed an
  `extractionExactSuccess` of 1.0 while comparing no value.
- **Fix.** `extractionStepExact` requires the step to have listed its records
  and matched them. A count-only step is now a miss for exact success.
  `extractionFalseSuccess` still uses `extractionStepMatched`, so a wrong count
  under a reported pass is still a false success, and `extractionCountAccuracy`
  is unchanged. The rate's published definition now says this.
- **Regression test.** "a count-only match is never an exact success…" in
  `bench/tests/extraction-metrics.test.ts`.

## Goal 2: `ui:e2e` and `panel:golden`

(from sub-worker t179-U2; see `reports/t179-ui-e2e.md`)

- **Built.** There is a new root script `pnpm ui:e2e`. It runs the same build prelude as `panel:golden`, then `node scripts/run/ui-e2e.mjs`.
  - Flags: `--lane provider-free|provider|all` and `--journey <id>...`.
  - It prints one JSON line.
  - Exit codes: 0 when every selected journey is verified, 2 when any selected journey is not verified, 1 on a rig or usage error.
  - The suite is `TR/ui-e2e/suite.ts` plus `suite-outcome.ts`, `journey-selection.ts` and `run-configuration.ts`. It runs F1-F4 on the provider-free lane by default. P1-P6 are `not_run` unless the provider lane is selected.
  - Nothing on the provider lane is wired, by design. P6 is `not_built`.
- **The single provider-free live run failed: exit 2, 1345 s wall clock, run `r20260929t214653-9a66`, ports 51127/51128.** 0 of 4 journeys verified:
  - F1 is `not_built`. Nothing composes record, generate, first run and the Runtime Debug check yet.
  - F2 failed as `runtime.behavior`. It got through the connect step up to "Save extension settings", which stuck on "Saving..." for 30 s on the allocated ports. The diagnostic in its evidence bundle is `connect.settings-save`. No pick, record or run happened.
  - F3 failed as `process.startup`. Scenario Lab exited on its second start, before any browser step.
  - F4 is `not_run`, because its prerequisite journeys were not verified.
  - Cause: the journeys still start everything through `session.ts` and `demo-workspace/`, which were only ever proven on the demo default ports. `ui:e2e` cannot pass until the journeys move onto `UiE2eTopology`, or until the connect step and the Scenario Lab restart handle allocated ports. That is the next task. It needs `demo-workspace/`, `session.ts` and `topology.ts` ownership.
- **`panel:golden`'s declared-unverified stages, and what `ui:e2e` now does for each.** Details are in `reports/t179-ui-e2e.md`.
  - `exploration_progress` and `repair_review_apply` need the provider lane (P1 and P2), which is not wired.
  - `normal_run_presentation` belongs to F1, which is `not_built`. The `assertRuntimeDebugRun` assertion exists.
  - `failure_presentation` is **wired** in F3. It is not yet **measured**, because F3 failed live before it reached that point. The sub-worker's table says "measured by F3". That is true of the wiring only.
  - `recording_path` is wired in F2 and F3, with the same caveat. The separate proposal-review stage stays unverified because the product has no UI for it.
- **Verified by me:** `node --test dist/ui-e2e/tests/*.test.js` gave tests 18, pass 18. The root `package.json` diff adds only `ui:e2e`.

### Second pass (supervisor follow-up): causes and fixes

- **F2 cause: the extension background was not ready. The allocated ports were not the problem.**
  - From the first screenshot on, the control page showed "Checking the connection…" and then "State: unknown". The background never answered, so Save stuck on "Saving…".
  - Reproduced without Core: 3 of 8 fresh Chromium launches showed no extension service worker within 30 s.
  - A direct Save on ports 51127/51128 succeeds whenever the background answers.
- **F3 cause: Scenario Lab starts slowly under load.**
  - On this machine it took 3.3 s, 8.4 s and 18.1 s just to start, against a 15 s health deadline.
  - The `[exit] code=1` in the log is the cleanup's taskkill. The Lab did not crash.
- **Fixes, all in `demo-workspace/`, which I was granted:**
  - New `extension-readiness.ts`, used by `withDemoBrowser`. The lane opens the extension page only after its background answers a status request. It reopens the page to wake the service worker, for up to 90 s. The extension id comes from the service worker, or is computed from the path when no worker appears (measured to match on Windows). If the background never answers, the lane fails with `extension.background_unresponsive`.
  - The Scenario Lab health wait is now 60 s, with `scenario_lab.exited` and `scenario_lab.not_ready` codes.
  - A connect failure now carries `connect.<stage>`, so the suite no longer reduces it to `journey.failed`.
- **F1 is built.** `ui-e2e/journeys/first-run.ts` does the following:
  1. Records the `missing-target` task through the extension and generates the Subflow.
  2. Runs the Flow from the panel in a fresh session.
  3. Requires the run to succeed, `assertRuntimeDebugRun` to return `runtime_debug.verified`, zero model activity, and the page's final-state oracle to hold.
- **Validation:** test-runner tsc exits 0. `node --test` on the ui-e2e and demo-workspace tests: 106/106 pass. The structure audit passes.
- **Live rerun:** queued detached behind a gate. It starts only when `LIVE_RUN_ACTIVE` is absent, no other Lab or UI run is active, and free RAM is above 2 GB, on three checks 60 s apart. Its result is recorded below once it ends.

### Second pass: live result and follow-up

**Run 2** (`r20260929t230838-c793`, slot-1): exit 2 after 812 s of wall clock, with 2 of 4 journeys verified.

| Journey | Result | Detail |
| --- | --- | --- |
| F1 | **verified** in 195 s | 1 attempt; Runtime Debug run row and Action Log matched Core (`actionLogAttemptRowsMatch: true`); 0 provider calls; oracle reached. |
| F3 | **verified** in 175 s | 3 of 3 attempts failed as `target_not_found` (`web.target.not_found`); terminal reason shown (`terminal.recovery_exhausted`); 0 provider calls; oracle not reached. |
| F2 | failed | `extraction.generated_flow_shape` |
| F4 | not run | `prerequisite_not_verified` |

- **The connect and Scenario Lab fixes held.** F2 now got past connect, picking, recording and Subflow generation.
- **Why F2 failed.** The recording held 2 actions. The picker's scroll to the list was recorded, so the generated Subflow is `web.dom.scroll` followed by `web.dom.extract_list`. I read this from the run's Core store. The journey demanded exactly one node.
- **Fix.** `assertExtractionRecordingDerivedFlow` now accepts:
  - exactly one `extract_list`;
  - at most one scroll and one navigate beside it;
  - chained edges;
  - recording provenance on every node.

  This is the same allowance `assertRecordedTaskFlow` already makes. The run check now expects one succeeded attempt per generated node, read from Core, instead of exactly one. Tests are updated and 108/108 pass.
- **Headed rule applied.** Lab browsers now default to headed (`FLUXIQ_DEMO_HEADLESS` default false), including the bench's browser-version launch.
- **Run 3** runs headed under the slot-2 rule. It claims only `lab-slots/slot-2`, and only while free RAM is above 4 GB.

### Runs 3 and 4, and the stop

**Run 3** (`r20260929t232702-0470`): headed, slot-2, exit 2 after 701 s wall clock, with 2 of 4 journeys verified.

| Journey | Result | Evidence |
| --- | --- | --- |
| F1 | verified in 129 s | 1 attempt. The Runtime Debug row and Action Log matched Core. 0 provider calls. |
| F2 | **verified** in 154 s | See below. |
| F3 | failed as `journey.failed`, category unknown | See below. |
| F4 | not run | `prerequisite_not_verified` |

- **F2 detail:**
  - Picker: proposed 8 items, captured 8.
  - Fields: 8 proposed. 4 were kept and renamed; the other 4 were removed.
  - Records: 8 of 8 matched, 32 fields judged.
  - Run: 2 attempts (scroll, then extract), 0 provider calls.
  - Panel: preview showed 8 rows × 4 fields. The CSV export was 953 B and the JSON export 1250 B, 8 rows each.
- **F3 cause:**
  - `waitForPanelRunResponse` gave up exactly 60 s after Run was clicked.
  - Core answers `run-runtime-session` only when the run is terminal. The drifted run's three failed click attempts had ended by 45 s, but no answer had come by 60 s. Run 2 had answered within the bound.
  - Fix in `demo-workspace/panel-run.ts`: the bound is now 180 s, and a timeout is now the closed `panel_run.response_timeout` instead of an uncategorized Error.

**Run 4** (`r20260929t234358-f1b0`): headed, slot-2, started 23:40:18Z.

- The supervisor killed it before it finished, under the new user rule described below. The suite printed no verdict.
- The evidence bundles show how far it got:
  - F1's record session and run session each finalized `passed`.
  - F2's session finalized `passed`, through to the JSON export.
  - F3's record session finalized `passed`, and the run was killed before F3's drifted-run session.
- The journey-level checks that follow a session are not recorded, so none of these counts as verified.

**Across runs:**
- F1, F2 and F3 have each been verified live, provider-free, with zero provider calls, but never all in one run.
- F4 has never been reached.

**Stop (2026-09-29, user rule relayed by the supervisor).** Lab and browser runs of any kind may use only the ten realistic scenarios, and the machine is not to be spent on browser runs for non-LLM features.
- The ui:e2e journeys run on `llm-target-drift` and `product-catalog`, so they are out of scope under this rule.
- The supervisor killed run 4 and the runner scripts. I have not relaunched anything and started no further browser run.
- If the journeys are re-targeted onto the ten scenarios, the suite, launcher and fixes here carry over as they are. The scenario-bound parts are the recorded tasks in `recorded-task.ts` and the extraction defaults in `extraction.ts`.

## Validation

| Command | Observed |
| --- | --- |
| `pnpm exec tsc -p tsconfig.json`, test-contracts | exit 0 |
| `node --test tests/*.test.mjs`, test-contracts | `# tests 149`, `# pass 149`, `# fail 0` |
| `pnpm exec tsc -p tsconfig.json`, test-runner | exit 0 |
| `node --test "dist/run-evaluation/**/*.test.js" "dist/bench/**/*.test.js"`, test-runner | `# tests 268`, `# pass 268`, `# fail 0`. Includes `week2` resolving against the built registry. |
| `node --test` on the lane-observation, extraction measurements, launch-containment and commands tests | `# tests 52`, `# pass 52` |
| `node scripts/structure-audit.mjs` (includes untracked files) | `structure-audit: passed (114 warning(s), 120 baselined)` |

## Not verified

- No real run writes `snapshots/adaptation.json` yet (handoff item 1). The
  reader is tested against a fake Core and fixed payloads only.
- The full `pnpm check` and `pnpm test` were not run. The machine was shared,
  and I ran only the focused suites above.
- Line endings: the files I edited through Python were written with CRLF and
  were normalized back to LF.
