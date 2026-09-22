# w2x-ui-e2e-journeys: journeys D and E, and the creation driver F

Worker: `w2x-ui-e2e-journeys` (task t069)
Date: 2026-09-21 to 2026-09-22
Worktree: `F:\fxwork\t069-ui-e2e-journeys`, branch `task/t069-ui-e2e-journeys`, base `dev` `49fee2c`, shared read-only Core `F:\fxwork\!FluxIQ` (`71e2798`). All changes are uncommitted.

## Outcome

Done, with three deviations from the brief, each explained below.

- **D, extraction:** verified live on `product-catalog` five times. The final run on the final code matched **8 of 8** expected records, with `matchedRecords === expectedRecords`, `observedRecords` 8, and 32 of 32 fields present. The run made 0 provider calls. The panel preview showed 8 rows and 4 columns equal to the stored rows. The CSV export was 953 bytes and the JSON export 1,250 bytes, holding 8 rows.
- **E, failure presentation:** verified live, but not on the drift the brief named. A Flow recorded on `instruction-only-form` survives that form's drift, because the extension's deterministic target scoring finds the redesigned field. The run succeeds, so there is nothing to present (`failure.not_reproduced`, measured twice, the second time on the final code). The journey therefore defaults to `llm-target-drift`'s in-page "Introduce missing target" control. On that drift the run fails with `target_not_found` / `web.target.not_found`. The Action Log shows it as Failed without a reload, marks 1 of 1 attempt rows failed, and shows the terminal reason (`terminal.recovery_exhausted`). The scenario oracle was not reached and there were 0 provider calls. The instruction-only-form case is kept as the task `redesigned-field` and reports its closed code.
- **E, restart and reuse:** verified live with both saved Flows. Both ports were closed on the first probe after Core stopped. The restarted Core took a fresh sign-in and the extension reconnected. Both Flows were found through the hierarchy search with unchanged identities and content hashes. Both reruns made 0 provider calls. The extraction rerun had an equal SHA-256 and matched 8 of 8. The failure Flow reached its baseline oracle.
- **F, creation driver:** the ordered progress assertion was verified live in two provider creation runs on `instruction-only-form`. Both went preparing, then inspecting, then ready for review, through the high-token confirmation, with 1 provider call each at about $0.0031 each. The permission refuse path is built and unit-tested, but it was **not reached live**: the model asked for no consequence in either run.
- **Tests and checks:** 85 of 85 tests pass in the owning `tests/` folders and their neighbours. `pnpm check` exits 0 on the final tree.

## What changed and why

New, `packages/test-runner/src/ui-e2e/journeys/` (owned):
- `session.ts` is the only topology seam. `withJourneyCore` wraps `withWorkspaceLock` and `withPersistentDemoCore` and signs in fresh. `withJourneyBrowser` wraps `withDemoBrowser`. The suite owner rewires the journeys to `ui-e2e/topology.ts` by replacing this file. The file also holds:
  - `JOURNEY_RECORDING_FINALIZE_TIMEOUT_MS` (240 s), explained under "Flakiness and measurements";
  - `journeyFlowConfiguration`, which gives each journey, and each failure task, its own project;
  - `JourneyProjectKey`.
- `extraction.ts` is journey D. It:
  - opens the extension's picker and clicks one `product-card`;
  - requires the proposed item count to equal the oracle's record count;
  - reviews the fields, confirms, and requires the captured count to equal the proposed count;
  - stops recording and generates the Subflow through the panel;
  - runs under No LLM intervention and requires 1 succeeded attempt with no model activity;
  - judges the stored dataset, then checks the panel preview and the exports.

  It returns ids, counts, the digest, a `saved` reference for the restart journey, and checkpoints.
- `field-review.ts` holds `planFieldReview`, which is pure, and `reviewPickedFields`. The oracle decides which proposed columns to keep. A column is kept for an oracle field when every previewed value matches that field under `extractedValueMatches`. The field is renamed in the column's name box, and every other included column is removed. Excluded columns are left as they are. Only counts leave the module; the diagnostic `ui-e2e.extraction.field-review` records them.
- `dataset-judgement.ts` reads the run's single dataset through `readRunDatasets`. It judges the dataset with `measureExtraction` from `run-expectations/extraction/judgement.ts`. It fails with one of `extraction.records_mismatch`, `record_count_mismatch`, `non_string_values` or `store_incomplete`. It also computes `lab replay`'s digest, which has the same definition as `rowsDigest`.
- `dataset-panel.ts` checks Runtime Debug's "Run datasets" region: exactly 1 stored dataset, and the preview equal to the stored rows cell by cell, compared in memory. It downloads the CSV and JSON exports through the panel's buttons. Each must be non-empty, and the JSON must be an array with one object per stored row.
- `failure-log.ts` reads a failed run's Action Log:
  - the badge carries `title="failed"` and the label Failed, and the Status metric reads `failed`;
  - there is one attempt row per attempt Core recorded, and exactly Core's failed attempts are marked failed;
  - Core's `metadata.terminalFailureReason` is shown.

  The reason is reported only as a closed code from `classifyTerminalFailureReason`.
- `recorded-task.ts` holds the two provider-free recorded tasks, `missing-target` and `redesigned-field`. Each has its in-page drift and reset controls, a generated-graph check, and `recordTaskFlow`.
- `failure-presentation.ts` is journey E, first half. It records in one browser session. It then presents the failure in a second session on the same Core, so the Scenario Lab is fresh and "oracle not reached" is meaningful. Core's run detail, including the attempt's `failure` record, is read beside the DOM.
- `restart-reuse.ts` holds the restart journey. `panel-rerun.ts` finds a Flow through the hierarchy search, reruns it, and judges it. `saved-flow.ts` defines the identities and the judge. `port-probe.ts` holds `waitForPortsClosed`.
- `extension-project.ts` connects the extension for the journey's project. It resets the extension session when the extension still holds another project; see product finding 1.
- `provider-free-run.ts` holds `assertProviderFreeRun`, which fails `run.model_activity`.
- `timeline.ts` holds checkpoints.
- `index.ts` is the barrel.
- `tests/`: 12 test files, 26 tests, covering every pure function.

Edited, owned:
- `demo-llm-create-ui/explore-proposal-ui.ts`, now 429 lines (up from 273):
  - The existing body moved into an internal `exploreEvidenceGuidedCreationViaUi(input, decision)`.
  - `proposeEvidenceGuidedCreationViaUi` keeps its signature and behaviour.
  - New `refuseEvidenceGuidedCreationPermissionViaUi`. After the existing Cancel checks it returns `permission.refused`. Before that it requires the retained "Review requested permissions" button to be visible, waits 3 s, and re-proves: no proposal, the blank hash unchanged, and the dialog not reopened. If the model asks for no consequence, it returns `permission.not_requested` as `unverified`, carrying the proposal.
  - New `explorationProgressOrderIssue`, pure.
  - A `MutationObserver` is installed before the click. It records the closed states `preparing`, `inspecting`, `ready_for_review` and `permission_pending` from Core's own labels, and the result is checked through the diagnostic `exploration.progress-order.*`.
- `demo-llm-create-ui/tests/exploration.test.ts`: the driver rows now read the internal driver. New rows cover:
  - the order rule;
  - observer placement;
  - Core's labels, read from the sibling Core's `BlankFlowAuthoringPanel.tsx` and `blank-flow-authoring-model.ts` so a rename fails here;
  - the refuse path never reopening or allowing.

Edited, **outside my ownership**:
- `demo-workspace/index.ts`: I appended one block exporting the building blocks the journeys use, without changing any existing line. The structure audit's `imports` rule fails any file outside `demo-workspace/` that reaches past its barrel, and the barrel did not export them. There was no way to compile the journeys without this.

## Commands run and observed results

Every live run used `FLUXIQ_TEST_ENV_FILES=none`, the panel on 33691 and the gateway on 43691 (never 3000 or 4711), a fresh random identity, run roots under `F:\fxlab-runs\t069\`, and headless Chromium with the unpacked extension. The drivers ran sequentially. The disposable driver lives in my scratchpad and imports the compiled journeys. The provider key was exported from the worktree's `.env.local` only into the F processes and was never printed.

| Run | Workspace | Result | Wall clock |
|---|---|---|---|
| D extraction | ws1 | failed `recording.persistence`: Core finalized the 99-entry recording 93.5 s after Stop, past the demo's 90 s | 363 s, including the first Core web build |
| D extraction | ws1 | **verified**, 8 of 8 matched | 220 s |
| E failure (instruction-only-form) | ws1 | failed: both Flows' Subflows were named "Primary browser automation", so the search opened the other one; fixed with per-journey Subflow names | 141 s |
| D extraction | ws2 | failed: panel `review-recording-flow-proposal` exceeded the fixed 60 s in `panel-run.ts`, under load | 233 s |
| D extraction | ws2 | **verified**, 8 of 8 matched | 138 s |
| E failure (instruction-only-form) | ws2 | failed: with a second Flow in the project, the panel driver never saw the new Subflow row; fixed with per-journey projects | 68 s |
| E failure (instruction-only-form) | ws3 | `failure.not_reproduced`: the recorded Flow healed the drift | 155 s |
| E failure (missing-target) | ws4 | **verified** | 138 s |
| D extraction | ws4 | failed: "FluxIQ has a different project open than the one this recording asked for"; led to product finding 1 | 66 s |
| D extraction | ws4 | **verified**, 8 of 8 matched, `sessionReset: true` | 143 s |
| E restart, 2 Flows | ws4 | **verified** | 114 s |
| F `demo:llm:setup`, `prepare`, `explore` | wsllm | configured (redaction attestation found 0 findings); prepared; **proposed**, 1 call, 6,628 tokens, $0.0031152, progress order valid with 3 transitions | 134 s, 128 s, 80 s |
| F `prepare` and `explore` after the observer-wait fix | wsllm | **proposed**, 1 call, 6,641 tokens, $0.00312532; progress check 0.1 s after the proposal (was 10 s) | about 85 s |
| E failure (missing-target), final code | ws5 | failed: panel "Authorize Router Change" dialog still open after 30 s in `provisioning.ts`; no screenshot, because the step is sensitive | 131 s |
| D extraction, final code | ws5 | **verified**, 8 of 8 matched | 74 s |
| E failure (missing-target), final code | ws5 | **verified** | 52 s |
| E restart, 2 Flows, final code | ws5 | **verified**, `sessionReset: true` | 65 s |
| E failure (redesigned-field), final code | ws5 | failed: both failure tasks provisioned the same Flow, so the second found the first's graph; fixed with a project per task. Then a 30 s Core control timeout on `list-flow-summaries`; then `failure.not_reproduced` | 36 s, 101 s, 80 s |
| E failure (missing-target) after the project-per-task change | ws5 | **verified** | 88 s |
| E restart, 2 Flows, final code | ws5 | **verified**: ports closed on the first probe, 0 calls, sha256 equal, 8 of 8 | 90 s |

Checks:
- `node --test dist/ui-e2e/journeys/tests/*.test.js dist/demo-llm-create-ui/tests/*.test.js dist/demo-workspace/tests/*.test.js` gave **85 of 85 passing**.
- `pnpm check` on the final tree **exited 0**:
  - structure tests 182 of 182;
  - lab tests 74 passing, 0 failing, 1 skipped;
  - task tests 113 of 113;
  - `structure-audit: passed (86 warning(s), 122 baselined)`;
  - every `pnpm -r check` package reported Done.
- Before that, the first `pnpm check` run failed at `lab:test` on "the build lock excludes a second holder". The same unchanged test also fails intermittently on the main checkout: in `F:\!FluxIQWebExtension` it passed once and failed once. It is a pre-existing timing flake (a 40 ms timeout); `scripts/` is unchanged in my worktree.
- The first structure-audit run found 7 violations in my files, all of `failure-as-empty` or `swallowed-failure`. All were fixed; each best-effort catch now states why.

Timings for the final code in ws5, from inside the journey. D:
- extension connected at 12 s;
- extraction confirmed at 23 s;
- recording finalized at 38 s;
- Subflow generated at 46 s;
- run succeeded at 55 s;
- panel verified at 56 s.

Each command adds about 10 to 20 s of Core start before that. Under heavier load the same stages took up to 140 s: recording finalize took 15 to 56 s and generation 9 to 35 s.

## Product and harness findings

1. **Product: the extension keeps a stale project across sessions.** A recording started after the operator's project changed is refused with "Project Mismatch", and the advice "Switch project in the web panel" cannot fix it: the panel already has the right project open. The only control that clears it is the extension's own Reset Session, followed by re-pairing. Two paths keep the persisted `projectId`:
   - `apps/extension/src/background/connection/server-command-channel.ts` `handleSessionReady`, when `session.ready` carries none;
   - `project-context.ts` `current()`, which prefers the session project over Core's active project.

   The journeys detect this, reset, and record `sessionReset: true` in their checkpoints so it stays visible.
2. **Product behaviour against the brief's premise.** Recorded Flows heal `instruction-only-form`'s target drift deterministically, so provider-free failure presentation cannot use that drift. Created, selector-only Flows still fail on it, which is the golden path's case.
3. **Product latency.** Under load, Core appends recording entries about once a second. A 20 s extraction recording held 99 entries and finalized 93.5 s after Stop.
4. **Harness, not mine:**
   - `subflow-authoring.ts` `createDemoSubflowInPanel` never sees the new Subflow row when the project holds a second Flow.
   - `openProjectInPanel` matches projects by substring.
   - `panel-run.ts` `waitForPanelMutationResponse` has a fixed 60 s. It timed out once on generation, under load.

   The journeys avoid the first two with one project per journey.
5. **Digest scope.** The stored `url` values are absolute, so the dataset SHA-256 includes the scenario port; different workspaces gave different digests. Restart equality holds because the workspace persists its scenario port.

## Not verified

- The permission refuse path was not verified live: in two runs the model requested no consequence. Only its structure and the pure logic are unit-tested.
- There was no journey run on the new `ui-e2e/topology.ts` from t068, which landed on `dev` after my base. The journeys still use `withPersistentDemoCore`, as the brief asked.
- No merge of `dev` into the task branch; a worker may not change history. My tree was never type-checked against t068's changes.
- Firefox, and a headed browser.
- The CSV body is not parsed; only its size and file extension are checked.
- The t068 assertion modules on `dev` (`runtime-debug.ts`, `adaptations.ts`) were not used. `failure-log.ts` is a journey-local reader, which the suite owner may swap for them.

## Open questions or contradictions found

- **Merge instruction.** After `dev` (t068) is merged, delete the line `export { authenticatedControl, withPersistentDemoCore } from "./core-process.js";` from my appended block in `demo-workspace/index.ts`. t068's barrel line already exports both, and the duplicate would be a TypeScript error. Git will merge the file textually without a conflict, so only the compile will show it. Every other name in my block exists unchanged on `dev`.
- **Ownership.**
  - `demo-workspace/index.ts` was edited outside my ownership because the structure audit's barrel rule required it.
  - `demo-llm-create-ui/index.ts` was **not** edited. `refuseEvidenceGuidedCreationPermissionViaUi`, `explorationProgressOrderIssue` and their types are reachable only from `explore-proposal-ui.js` until that barrel's owner re-exports them.
  - The audit design assigned `ui-e2e/journeys/index.ts` to the Phase 2 owner. The brief's `journeys/**` covers it, so I wrote it. `ui-e2e/index.ts` does not exist in my tree.
- **Deviation from the brief.** Journey E's default drift is `llm-target-drift`'s missing target, not `instruction-only-form`'s, for the reason in finding 2. The supervisor should decide whether P3's failure journey should instead use a selector-only created Flow on `instruction-only-form`.
- **Advisory warnings, not failures.** `ui-e2e/journeys/` has 16 source files (advisory limit 15), and `explore-proposal-ui.ts` has 429 lines (advisory limit 400).
- The restart journey starts one Core only to read identities before stopping it, which costs 12 to 33 s. On t068's topology this should become that topology's restart.
