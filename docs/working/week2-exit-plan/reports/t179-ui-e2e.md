# t179-U2: ui:e2e suite and launcher

## Outcome

Partial. The suite, launcher, package script and tests are done. The type check, the focused tests (18/18) and the structure audit all pass. The one provider-free live run did execute, but ended at exit 2 with 0 of 4 selected journeys verified:

- F1 is `not_built`.
- F2 failed with `runtime.behavior`. The extension's "Save extension settings" hung on the allocated ports.
- F3 failed with `process.startup`. Scenario Lab did not come back up for its second session.
- F4 is `not_run` / `prerequisite_not_verified`.

Both F2 and F3 failed in the rig and connect layer, before any journey assertion ran.

## What changed and why

- `packages/test-runner/src/ui-e2e/journey-selection.ts` (new): the journey catalog (F1-F4 provider-free, P1-P6 provider), `parseUiE2eArguments` (`--lane provider-free|provider|all`, `--journey <id>...`, repeated / comma / `=`; unknown input is refused with `ui_e2e.usage.*`), and `selectUiE2eJourneys`. Provider-free is the default. A provider journey is selected only through `--lane provider|all`, or when it is named by `--journey`. In the `--journey` case it stays selected but is reported `not_run`, so it fails the suite rather than dropping silently. F4 automatically brings F2 and F3, because it reruns their saved Flows.
- `ui-e2e/suite-outcome.ts` (new): the per-journey outcome `{id, name, lane, selected, status, reasonCode, failureCategory, durationMs, ids, counts, timings}`, plus `foldUiE2eSuite` and `uiE2eExitCode`. Statuses are `verified`, `failed`, `not_built` and `not_run`. The suite passes only when every selected journey is verified and at least one journey is selected. A failed journey keeps its category and its closed `details.reasonCode`; the message is never kept, so no page text reaches the output. A failure with no closed code is reported as `journey.failed`.
- `ui-e2e/run-configuration.ts` (new): `prepareUiE2eRunConfiguration` builds `$FLUXIQ_TEST_RUNS_DIR/ui-e2e/<run-id>/` (ACL-hardened on Windows). It pins the extension build into `extension-source`, allocates the web and gateway ports with `allocateUiE2ePorts` (which excludes 3000/4711/3300/4877) and creates a fresh identity with `freshUiE2eIdentity`. It reuses the exported helpers from `topology.ts`, which I did not edit. All journeys in one run share this store, so F4 finds F2's and F3's Flows.
- `ui-e2e/suite.ts` (new): `runUiE2eSuite({lane, journeys, config, drivers?, now?})`.
  - F2 is `runExtractionJourney`, F3 is `runFailurePresentationJourney`, and F4 is `runRestartReuseJourney` with the saved Flows from F2 and F3. If either prerequisite is not verified, F4 reports `not_run` / `prerequisite_not_verified`.
  - F1 is `not_built` / `runtime_debug_journey_not_composed` (see Open questions).
  - Provider lane: P6 is `not_built` / `product_ui_not_built`. P1-P5 are `not_run` / `journey_not_wired`. A provider journey whose lane was not selected is `not_run` / `provider_lane_not_selected`. No provider driver is called.
- `ui-e2e/index.ts` (new barrel) exports the four modules above.
- `ui-e2e/tests/journey-selection.test.ts` and `ui-e2e/tests/suite.test.ts` (new) have 12 tests covering argument parsing, selection, composition order, the saved-Flow handoff to F4, failure folding (no message leak), provider-lane not_run/not_built behaviour, and exit codes.
- `scripts/run/ui-e2e.mjs` (new): a thin launcher on the pattern of `panel-golden-path.mjs`. It strips provider secrets from `process.env` itself, not only from the loader input, so no spawned Core or browser inherits them. The env allowlist is `FLUXIQ_WEB_EXTENSION_ROOT`, `FLUXIQ_TEST_RUNS_DIR`, `FLUXIQ_CORE_ROOT`, `FLUXIQ_DEMO_EXTENSION_DIR` and `FLUXIQ_DEMO_HEADLESS`; no credentials are read, because the identity is fresh. It imports from dist and prints one JSON line (the suite result plus runId, ports, prepareMs and wallClockMs). Exit codes: 0 when the suite passed; 2 when any selected journey was not verified; 1 on a rig or usage error, with a stderr JSON line `{status:"rig_error", reasonCode, category}`.
- Root `package.json`: added `"ui:e2e"` with the same build prelude `panel:golden` uses (scenario-lab build, extension test:e2e:build, `test-runner...` build) and then `node scripts/run/ui-e2e.mjs`. Nothing else in the file changed.
- No `scripts/run/tests` pattern exists, so no scripts test was added.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0, no tsc errors.
- `pnpm build` (test-runner), then `node --test dist/ui-e2e/tests/*.test.js`: `# tests 18 / # pass 18 / # fail 0`. The 18 are my 12 plus the 6 existing topology tests. I ran this before and after the barrel-import fix.
- A second `pnpm build` printed TS2322 errors in `src/bench/comparison-details.ts`. That file belongs to a concurrent worker who was editing `bench/` and `run-evaluation/` (visible in `git status`). A re-run of `npx tsc -p tsconfig.json --noEmit` shortly afterwards reported 0 errors.
- `node scripts/structure-audit.mjs`, first run: 2 FAIL `[imports]` (suite.ts and suite.test.ts imported journey files directly instead of the barrel). After switching to `./journeys/index.js`: `structure-audit: passed (114 warning(s), 120 baselined).`
- Pre-run checks: free RAM was 2847 MB, then 2658 MB before the live run. The process check found no node process matching run-lab.mjs, live-campaign, adversarial-lane, panel-golden-path, ui-e2e.mjs, demo-workspace or `lab `.

## Live run

Command: `pnpm ui:e2e`, from the t179 worktree, with the provider-free default. Pre-checks: free RAM 2658 MB, and no competing Lab or UI run. Result: **exit 2, wall clock 1345 s** (shell-measured, build prelude included). The suite's own `wallClockMs` was 968666, of which `durationMs` was 931343 and `prepareMs` 1122. Run id `r20260929t214653-9a66`, ports web 51127 and gateway 51128 (allocated; neither 3000/4711 nor 3300/4877). Journeys began at 21:46:53Z.

JSON line, abridged. Every P journey is `selected:false, not_run, provider_lane_not_selected`, and ids, counts and timings are empty on every journey:

```
{"status":"failed","lane":"provider-free","durationMs":931343,"selected":4,"verified":0,"failed":2,"notBuilt":1,"notRun":1,
 "journeys":[{"id":"F1","status":"not_built","reasonCode":"runtime_debug_journey_not_composed","durationMs":0},
  {"id":"F2","status":"failed","reasonCode":"journey.failed","failureCategory":"runtime.behavior","durationMs":719369},
  {"id":"F3","status":"failed","reasonCode":"journey.failed","failureCategory":"process.startup","durationMs":211972},
  {"id":"F4","status":"not_run","reasonCode":"prerequisite_not_verified","durationMs":0}, ...P1-P6...],
 "runId":"r20260929t214653-9a66","ports":{"web":51127,"gateway":51128},"prepareMs":1122,"wallClockMs":968666}
```

The run root is `test-runs/ui-e2e/r20260929t214653-9a66/`. The launcher did its job end to end: build prelude, run root, pinned extension, port allocation, fresh identity, composition, the JSON line and exit 2.

### F2: failure cause and how far it got

- The first Core start included the Core web build: `core-web-build.log` ran 21:46:57 to 21:55:43, about 9 min of F2's 719 s.
- Core then came up on 51127 and 51128, and the browser session started at 21:56:14 (evidence `evidence/ui-e2e-extraction-2026-09-29T21-56-14-161Z-406902/`, 104 events, 88 screenshots).
- The journey got through context selection, opening settings, filling the gateway and API addresses (`ws://127.0.0.1:51128/client`, `http://127.0.0.1:51127`) and verifying 4 options.
- "Save extension settings" (`settings-save`) then waited 30 s and failed at 21:57:46. The diagnostic is `connect.settings-save`, with facts `settingsSaved:false, connectionRequested:false`. Screenshot 00103 shows the extension on Connection with the Save button stuck on "Saving...", "State: unknown", and no browser or connection ID.
- The failure is in the shared demo connect step (`demo-workspace`), before picking, recording or running.
- Probable cause, not verified: saving a non-default origin makes the extension wait on something the demo browser session never answers, such as an optional host-permission grant for the new port. The journeys had previously been proven only on the demo topology's ports. This is exactly why `topology.ts` exists, and its browser launch (`launchGuardedPersistentContext`) is not what `session.ts` uses.
- The thrown RunnerFailure carried no `details.reasonCode`, so the suite reports `journey.failed`. The closed code lives only in the evidence diagnostic.

### F3: failure cause and how far it got

- A second Core started at 21:58:54 on the same store, and its domain setup finished at 21:59:46. The Core log shows Next ready (27.6 s) and the gateway bound on 51128.
- Scenario Lab's log (`logs/scenario-lab.log`, one file shared by every session) reads: F2's line `{"status":"ready",...,"port":51180}`, then `[exit] code=1` (F2's stop), then a second `[exit] code=1` with no ready line at about 22:02:24. `scenario-port.json` still pins 51180.
- So F3's Scenario Lab start (`startPersistentScenarioLabWithRecovery`) failed, and the journey ended as `process.startup` about 212 s after starting. No F3 evidence bundle was created, so it failed before any browser step.
- Cause not established. It is probably the persisted port 51180 not yet being free, or its recovery path. Not investigated further, since it is outside my ownership.

## panel:golden's declared-unverified stages versus ui:e2e

| Stage (golden status) | ui:e2e now | Why / which journey |
|---|---|---|
| exploration_progress (unverified) | not measured | Needs the provider lane (P1 "Progress DOM" ordering); P1 is `not_run` / `journey_not_wired`. |
| normal_run_presentation (unverified) | not measured | The assertion exists (`assertions/runtime-debug.ts`, `assertRuntimeDebugRun`), but no journey calls it for a successful run. It belongs to F1, which is `not_built`. F2 and F4 check run success through Core, not the Runtime Debug run row. |
| failure_presentation (unverified) | **measured by F3** | Action Log status badge and metric `failed`, attempt and failed-attempt rows, terminal reason shown with a closed code, Core `failure.category` and code, oracle not reached, zero provider calls. This covers a recorded Flow drifted by the fixture, not the LLM-created Flow before its repair. |
| repair_review_apply (unverified) | not measured | Needs the provider lane (P2). The "Changed fields" structural-diff assertion exists (`assertions/changed-fields.ts`), but P2 is not wired. |
| recording_path (unverified) | **partly measured by F2 and F3** | Both record through the real extension, generate a Subflow in the panel, check the generated graph's shape and provenance (`assertExtractionRecordingDerivedFlow` and `assertRecordedTaskFlow`), and run it. The golden-path gap, a separate review stage for the generation proposal, stays unverified because the product has no such UI. |

The stages golden declares verified are all on the provider lane: instruction_entry, creation_proposal_review, creation_approval, creation_application, normal_run on the created Flow, repaired_rerun, and restart_saved_reuse of the repaired Flow. ui:e2e does not re-measure them, because P1, P2 and P4 are not wired. F4 measures restart_saved_reuse for the recorded Flows: both ports closed, identities unchanged, hierarchy search, dataset SHA-256 equality, final-state oracle, and zero provider calls.

## Not verified

- Why the settings save hangs on allocated ports, and why Scenario Lab's second start exited. Both are diagnosed only as far as the logs and evidence above, and neither is fixed; both live in `demo-workspace/`, outside my ownership.
- No journey has been verified live under `ui:e2e`, so the facts mapping (`extractionFacts`, `failureFacts`, `restartFacts`) is exercised only by unit tests.
- F1 composition: not built.
- The provider lane: nothing is wired by design.
- The launcher's usage-error path was not exercised live; its parsing is unit-tested.
- The journeys still run on `session.ts` (one Core start and stop per journey), not on the shared `UiE2eTopology`. The audit's "one topology across adjacent journeys" and the blocking of LLM endpoints through `context.route` are therefore not in effect. The provider-free guarantee rests on scrubbed secrets plus each journey's `assertProviderFreeRun` (zero provider, accounted, intervention, adaptation and change-proposal counts).

## Open questions or contradictions found

- **The journeys do not survive allocated ports.** On the demo topology's `session.ts`, F2 hangs at the extension's settings save once the gateway and web addresses are not the demo defaults. The audit requires allocated ports, and the brief forbids the defaults (3000/4711; `topology.ts` also excludes 3300/4877). ui:e2e cannot pass until either the journeys move onto `UiE2eTopology` or the connect step handles a non-default origin. This is the next task, and it sits outside my ownership (`demo-workspace/`, `topology.ts`, `session.ts`).
- A journey RunnerFailure without `details.reasonCode` reduces to `journey.failed`. The suite could carry the evidence path or the last diagnostic `errorCode` so that the JSON line names the cause. I did not do this, to keep page-derived data out of the line; decide whether the evidence path is acceptable there.
- Scenario Lab's log is one file for all sessions, so a start failure's own output is hard to separate.

- F1: `recordTaskFlow` plus a first run plus `assertRuntimeDebugRun` would cover it. Composing it is a new journey, which is beyond "minimal wiring", so it is reported `not_built` (reason `runtime_debug_journey_not_composed`). Its reason should arguably be `not_wired` rather than `not_built`, since the product UI does exist. I used `not_built` because the brief specified it.
- `topology.ts`'s header says the journeys move onto it by replacing `session.ts`. That migration is not done, and it is needed for the audit's latency and isolation targets.
- The golden launcher reads test credentials from env files; ui:e2e does not, because its identity is fresh. `pnpm ui:e2e` therefore needs no `.env` credentials.
