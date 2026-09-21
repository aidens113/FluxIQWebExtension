# w2x-ui-e2e-audit: end-to-end UI testing inventory and Week 2 suite proposal

Worker: `w2x-ui-e2e-audit` (read-only)
Date: 2026-09-21
Trees read: `dev` (`F:\!FluxIQWebExtension`, `d3ad8c5`) and the t027 worktree
(`F:\fxwork\t027\!FluxIQWebExtension`, `b388aea`). The Core UI was checked by targeted
grep of `F:\fxwork\t027\!FluxIQ\apps\web\src\features\automation-studio`, only to tell
"no UI" apart from "UI with no test".

## Outcome

Done. Four findings matter most:

1. **No committed command drives the Week 2 exit chain through the UI to the end.**
   `pnpm panel:golden` exists only on t027 (`scripts/run/panel-golden-path.mjs`,
   `packages/test-runner/src/panel-golden-path/`). It has never completed. Its furthest
   run got through creation, apply and deterministic run. It then failed in the repair
   stage, and the repair lane has **0 of 9** passing evidence bundles across the t027
   isolated roots. Even when every driver succeeds, the lane cannot report `passed`: five
   of its twelve stages are hard-coded `unverified` (`lane.ts:187-200`), so it exits 2
   (`incomplete`) by construction.
2. **The most valuable UI proofs are not in code.** These journeys were each proven live
   once, using disposable drivers under `F:\fxlab-runs\...` that were never committed:
   - the Runtime Debug run row and Action Log;
   - the no-reload terminal refresh;
   - the extraction picker, dataset preview and export (t027 extraction-exit and t032 on
     `dev`);
   - reconnect after a full Core stop.

   None of them can be rerun.
3. **No UI lane judges extraction by records.** The creation and bound-run drivers check
   the manifest's `expected.finalState` facts only. The t032 smoke checked counts and
   export sizes only. `matchedRecords` against `expectedRecords` is computed only by the
   non-UI Flow lane, the bench and `lab replay`
   (`run-expectations/extraction/judgement.ts`, `flow-lane/run-flow-lane.ts:272`).
4. **Three journeys have no product UI at all:**
   - improving an existing, non-blank Flow;
   - a permission request raised by a run or a repair, as opposed to one raised by
     creation;
   - a Flow-level or structural diff for a repair.

   Revert, adaptation history and the field-level change table do have UI, but nothing
   tests them. Revert is exercised only through the control API.

## Journey table

In the Evidence column, a count such as "4/35 passing bundles" is taken from
`summary.json` of every sanitized evidence bundle under `F:\fxlab-runs\t0*\*\evidence`
(171 bundles). Most failures were iterations while a driver or product fix was
developed, not repeated runs of the same code, so these counts are an attempt history,
not a flake rate. Evidence at the same code revision is called out separately.
Durations are the bundle interval (`finishedAt - startedAt`). They exclude the build
prelude and the roughly 8-12 s Core restart that each driver pays (`withPersistentDemoCore`).

| # | Journey | Automated? Lane / script (tree) | Provider? | Measured duration | Recorded flakiness / evidence | Gap |
|---|---|---|---|---|---|---|
| 1 | Create a Flow from an instruction | **Yes, committed.** `demo:llm:prepare` → `demo:llm:explore` → `demo:llm:explore:request:apply` → `demo:llm:explore:request:run`. Drivers: `demo-workspace/exploration-checkpoints.ts`, `demo-llm-create-ui/explore-proposal-ui.ts`, `apply-proposal-ui.ts`, `demo-workspace/bound-exploration.ts`. Composed in `panel:golden` (t027 only). The older `demo:llm:create` uses `build-flow-ui.ts`. | Explore: yes (DeepSeek). Apply and run: no; apply blocks `generate-flow-bootstrap-adaptation`. | Prepare 6.4-19.8 s (median 7.0 s). Explore 21.9-29.3 s (median 24.9 s). Apply 15.6 s. Bound run 14.1-23.3 s. Click to durable proposal 9.61 s (`w2-mvp-latency-critical-path-audit.md`). | Prepare 39/46 and explore 4/35 passing bundles. Same-code non-determinism is recorded: HTTP 200 with zero proposals (`w2-fresh-ui-repair-cycle.md`; `w2-permission-continuation-acceptance-live.md`, bundle `…T03-33-37…`), then one proposal on the next identical attempt (`…T03-39-51…`). An intermittent empty generation HTTP 400 is also recorded (`w2-concurrent-live-testing-plan.md`). On `dev` the blank-preparation locators still use `{ exact: true }` (`demo-llm-blank-workspace.ts:89-91,227`), which t027 live runs proved stale. | Progress states are not asserted. The bound run judges `finalState` facts only (no `matchedRecords`). The proposed graph is not asserted beyond clicking the Audit tab. |
| 2 | Record by demonstration | **Yes, committed.** `demo:record` (`workspace-lanes.ts::recordDemoWorkspace`: the extension side panel's Start/Stop, then the panel's **Generate Subflow**), with `demo:run`. These are the last two `panel:golden` stages. | No | demo-record 18.9-31.8 s (median 26.2 s). Passing rerun 18.872 s. Generate submit 2.1-3.2 s (`w2-recording-panel-live.md`). | 5/7 passing. The failures came from a stale Lab predicate that rejected a legitimate `dom.scroll`; it was fixed in t027 `demo-workspace/flow-document.ts`. | Hard-wired to `basic-form` "Ada / team". The timeline row count is not asserted. The generation dialog creates and approves in one step, so there is no separate review before apply (a product gap). |
| 3 | Pick and extract data | **No committed automation.** Two live proofs used disposable drivers: `w2-extraction-exit-live.md` (t027) and `w2-integrated-extraction-ui-smoke.md` (t032, `dev`, including full-restart replay). The content harness `e2e/content/tests/extraction/tests/extraction-picker.spec.ts` covers the content script only: no extension UI, no Core. | No | 40.0 s (extraction-exit). t032: 46.96 s to verified exports, 70.1 s including restart and replay. | extraction-exit 1/6 and t032 initial 1/4 passing. All failures were driver ordering: foregrounding the extension page disables Start recording, plus oracle calibration. | Nothing to rerun. t032's oracle checked counts only; extraction-exit did check records. |
| 4 | Run (deterministic, from the panel) | **Yes, committed.** `demo:run` (`runDemoWorkspaceFlow`), `demo:llm:explore:request:run`. Shared driver `demo-workspace/panel-run.ts::runDemoFlowFromPanel` (Runtime Debug, **No LLM intervention**, **Run**). | No | demo-playback 20.2-33.8 s (median 25.8 s). The panel runtime step fell from 14.774 s to 8.165 s after the t027 readiness-reuse fix (`w2-runtime-command-latency-trace.md`). | **27/27 passing, no flakiness recorded.** | The assertion reads Core run detail and the scenario page, not the rendered run. |
| 5 | Watch Runtime Debug | **Partial.** Committed `panel-verification.ts` selects a run row and the Action Log, but only the `existing`/`clone` targets use it (`run-scenario.ts`). The run row, Action Log and 4/4 attempt rows were proven by a disposable driver (`w2-panel-run-presentation-live.md`, 2 bundles). The no-reload terminal refresh was proven by disposable drivers (t030; `w2-integrated-dev-ui-smoke.md`). The golden stage `normal_run_presentation` is hard-coded `unverified`. | No | Presentation proof 14.6 s including startup; bundle 3.5 s. | integrated-dev-ui-smoke 0/3 bundles `passed`, although the product passed: the observer's composed locator was a harness defect. | No committed assertion. Live per-action progress during a run is not asserted anywhere. |
| 6 | See a failure | **Partial.** The golden repair stage arms drift and runs **Diagnose and propose adaptation** (`demo-workspace/adaptation-ui.ts::runAdaptationFromPanel`). It never asserts the failed attempt or terminal reason in the Action Log (`failure_presentation` is hard-coded `unverified`). `demo:llm:diagnose` (llm-target-drift) is diagnosis-only; there is no recent evidence in the t027 roots. | Yes as wired (adapt mode). A provider-free failure run is possible but not automated. | 25.3 s (adaptation bundle). | See journey 7. | No provider-free "run fails visibly" lane. The failure is conflated with the repair request. |
| 7 | Review and apply a repair proposal, and its diff | **Yes, committed.** `demo:llm:explore:adapt`, `…:apply`, `…:validate` (`demo-workspace/exploration-adaptation.ts`, `adaptation-ui.ts::reviewAndApplyAdaptationViaUi`), plus golden stages 4-6. `demo:llm:adapt` is the older prepared-target lane. | Proposal: yes (2 calls expected). Apply and validate: no (LLM endpoints blocked by `context.route`). | Run-to-response 19.1-24.6 s (`w2-panel-repair-continuation.md`, `w2-panel-repair-result-boundary.md`). | **0/9 passing `demo-llm-exploration-adaptation` bundles.** Since repair was bound to the created Flow, no panel run has produced a repair proposal: 2 calls and no proposal; diagnosis `stillAchievable: no`; a stale workspace (`w2-repair-candidate-ranking-live.md`); and the last golden attempt (`…T03-41-14…`) failed with no terminal code in its bundle. | Hard-wired to `instruction-only-form` drift controls and the "Submitted: Ada / team" oracle, and to `edit_action_target` only. **Diff:** Core renders a field-level "Changed fields" before/after table (`adaptations/AdaptationChangeCard.tsx:34-36`); no driver asserts it. No Flow-script or structural diff exists. |
| 8 | Grant or refuse a permission request | **Conditional, never reached live.** `explore-proposal-ui.ts:82-127` handles Core's "Confirm Flow action consequences" dialog: Cancel, then **Review requested permissions**, then **Allow and continue**. It runs only if the provider triggers `flow_bootstrap.permission_required`. Both live attempts did not trigger it (`bootstrap-no-proposal-investigation.md` Current State: "remains proven provider-free rather than by a provider-triggered browser journey"). No driver refuses for good. | Yes (the trigger is model-dependent). | n/a | Never observed in a panel run. | Creation only. There is no UI for a run-time or repair permission request (next section). |
| 9 | Inspect adaptation history | **Partial.** Drivers open the Adaptations table and select an exact row (`apply-proposal-ui.ts:43-56`, `adaptation-ui.ts::openAdaptationFromPanel`). None asserts history content: statuses after apply or revert, or audit events. | No (needs a prior adaptation) | n/a | n/a | UI exists (statuses including `reverted`/`superseded`, Audit tab, source-run links); no test. |
| 10 | Revert | **API only.** `demo:llm:revert`, `demo:llm:explore:adapt:revert`, `demo:llm:adapt:revert` all call `control.revertFlowAdaptation` (`creation-lanes.ts:169-205`, `demo-llm-exploration-adaptation-revert.ts:35-57`, `demo-llm-adaptation-control.ts:66-76`). | No | n/a | n/a | UI exists (**Revert Changes** with PIN, `adaptations/adaptation-model.ts:67`); no test. |
| 11 | Restart and reuse | **Yes, committed, implicitly.** Every demo driver owns and closes its Core, so a second command is a restart. The golden `restart_saved_reuse` stage (`validateRepair`) depends on repair succeeding. `demo:run` was run twice (`w2-recording-playback-reuse-live.md`). A full stop, port probe and reconnect were proven by a disposable driver (`w2-reconnect-reuse-live.md`). The non-UI `lab replay` enforces zero-provider reuse. | No | Playback 25-33 s. Reconnect: 67.0 s stop phase, then 33.7 s restarted playback. | 27/27 playback; reconnect 1/1. | No committed explicit stop/probe/reconnect lane. Golden reuse is gated behind the repair stage, which fails. |
| 12 | Improve an existing Flow (third entry point) | **No UI, no test.** | — | — | — | Authoring requires a blank Flow (`authoring/blank-flow-authoring-model.ts:98-104`). |
| 13 | Pair or connect the extension; configure the provider key | **Yes, committed**, inside every driver (`browser-session.ts::connectExtension` plus `approvePairingInPanel`) and `demo:llm:setup` (Secret Keys UI with redaction attestation). | Setup reads the key but makes no provider call. | Key setup 4.0-5.4 s. | Key setup 10/10. | — |
| 14 | Firefox popup parity | **None.** Only `playwright.content.firefox.config.ts` exists (content harness, no popup). | — | — | — | Chromium only. |
| — | Extension Playwright suite (`test:e2e`) | Committed, 7 tests. It loads the E2E build and checks the side-panel heading, content injection, type and click, worker restart, and profile cleanup. **No FluxIQ Core, no panel UI.** | No | Not measured in the evidence read. | — | Does not exercise any panel journey. |
| — | Content-script harness (`test:content`) | Committed; about 265 tests. | No | Full run 1.4 min at `--workers=2`. | Recorded flake: `Tearing down "openHarness" exceeded the test timeout of 30000ms`, 5 times on 3 rows, never reproducible on the same row (`first-class-data-extraction-plan/reports/x5l-harness-fixture-regressions.md:126-150`). | Not UI E2E. |

**Last full `panel:golden` attempt** (bundles under
`F:\fxlab-runs\t027-permission-continuation\workspace\evidence`):

| Stage | Time | Duration | Result |
|---|---|---|---|
| prepare | 03:39:32 | 11.2 s | pass |
| explore | 03:39:51 | 21.9 s | pass, 1 provider call |
| apply | 03:40:23 | 15.6 s | pass |
| bound run | 03:40:48 | 14.1 s | pass |
| adaptation | 03:41:14 | 25.3 s | **fail** |

From prepare to the failure took 2 min 07 s, not counting the build prelude. Four more
drivers would follow a pass.

## No UI at all (distinct from UI with no test)

**No UI:**
- **Improving an existing, non-blank Flow.** The authoring panel refuses non-blank
  Flows.
- **A permission request raised by a run or a repair.** Core's
  `runtime/` views contain no consequence or permission surface. The only consequence
  dialog is in `authoring/BlankFlowAuthoringPanel.tsx:259-262`. t018 also left recovery
  without the permitted set.
- **A structural or Flow-script repair diff.** Only a per-change field table exists.
- **A separate review before apply for recording-generated Flows.** **Generate Subflow**
  creates and approves in one dialog.
- **Per-decision or per-action exploration progress.** Only phase-level states exist:
  "Preparing exploration..." and "Inspecting live target...".
- **Automatic Runtime Debug focus after extraction.** This was reported as a UX defect in
  `w2-extraction-exit-live.md` and appears fixed by t030; `w2-integrated-dev-ui-smoke.md`
  observed the refresh without a reload.

**UI exists, no committed test:**
- UI revert (**Revert Changes**), Reject, Disable, Supersede.
- Adaptation history and audit content.
- The "Changed fields" diff table.
- The Runtime Debug run row and Action Log (outside the existing/clone targets).
- The no-reload terminal refresh.
- The extraction picker, preview and field review in the extension, and the dataset
  preview and CSV/JSON export in the panel.
- Phase-level exploration progress.
- Visible failure presentation (terminal reason and recovery section in the Action Log).

## Proposed Week 2 end-to-end UI suite

### One command

`pnpm ui:e2e [--lane provider-free|provider|all] [--journey <id>...]`.

It is a thin launcher, `scripts/run/ui-e2e.mjs`, over
`packages/test-runner/src/ui-e2e/suite.ts`. It replaces `panel:golden` as the entry
point, and `panel:golden`'s stage ledger becomes measured rather than declared. The
command prints one JSON line of IDs, closed codes, counts and timings only. It exits 0
only when every selected journey is `verified`. A journey whose product UI does not
exist reports `not_built` and fails, rather than being skipped.

### Isolation

- **Worktree.** Run from the task worktree under `F:/fxwork/<task>`, created with
  `pnpm task start … --worktree` whenever another agent validates at the same time
  (AGENTS.md "Branches And Worktrees").
- **Ports.** Allocate the panel, gateway and scenario ports with `allocation.ts`
  (`allocateLoopbackPort`, then `assertLoopbackPortBindable` from t031). Do not use the
  fixed demo defaults `3300`/`4877` (`demo-workspace/configuration.ts:42-43`): every
  isolated live report had to override them by hand, and a pinned port fell inside a
  Windows excluded range (49776-49875). Never use `3000` or `4711`, which belong to the
  user's panel.
- **Store and profile.** Use one run-scoped root,
  `$FLUXIQ_TEST_RUNS_DIR/ui-e2e/<run-id>/`, holding:
  - `fluxiq-root/.fluxiq`;
  - `browser-profile-isolated`;
  - `panel-browser-profile-isolated-v2`;
  - a run-scoped copy of the extension build (pinned the way `FLUXIQ_DEMO_EXTENSION_DIR`
    already pins it);
  - a fresh test identity.

  Nothing is reused from `test-runs/web-extension-demo`. Copied workspaces went stale
  (`w2-repair-candidate-ranking-live.md`).
- **Topology.** Keep one Core, panel, gateway and browser topology across adjacent
  journeys, and restart only for the restart journey. The latency audit estimates 8-12 s
  saved per phase compared with today's per-driver restarts.
- **Provider credentials.** Load them only in the provider lane's driver process, as
  today. The provider-free lane scrubs them (`withoutProviderSecrets`) and blocks the LLM
  endpoints with `context.route`, as `exploration-adaptation.ts:193-199` already does.

### Journeys, in priority order

**Provider-free lane.** It is deterministic, runs at every integration, and costs no
provider money.

| Pri | Journey | Assertions (what each one reads) |
|---|---|---|
| F1 | Record, then Generate Subflow, then Run, then Watch Runtime Debug | **Extension status:** `recordingState` is `recording`, then `idle`. **Core:** exactly one new recording, and the generated graph passes `flow-document.ts`. **DOM:** node rectangles render without overlap. **Runtime Debug DOM:** the run row and Action Log show the same run ID, `Succeeded`, the action count and the attempt rows, with zero main-frame navigations. **Scenario:** the `finalState` oracle holds. **Core run detail:** all attempts succeeded; `providerCallCount ?? 0`, interventions, adaptation IDs and change-proposal IDs are all 0. |
| F2 | Pick and extract data, then Flow, then Run, then dataset preview and export | **Extension picker:** item count, preview rows and confirmed field count. **Core:** one new recording, and one `web.dom.extract_list` node with provenance. **Core datasets:** read with `get-run-dataset-page` (`flow-lane/run-datasets.ts`) and judged by `run-expectations/extraction/judgement.ts` against the manifest's `expected.extracted`; the check requires **`matchedRecords === expectedRecords`**. **Panel DOM:** preview rows equal the stored rows. **Downloads:** the CSV and JSON exports are non-empty. |
| F3 | See a failure, without a provider | Arm drift on `instruction-only-form`, then run under **No LLM intervention**. **Action Log DOM:** the run shows `Failed`, the failed attempt row, and the terminal reason text from the closed set. **Core:** the attempt's `failure.category`. **Scenario:** the oracle is not reached. |
| F4 | Restart and reuse | Stop Core and the gateway, then probe that both ports are closed. Restart, sign in freshly, reconnect the extension, and find the F1 and F2 Flows through the hierarchy search. Rerun both. **Identities:** unchanged. **Core:** zero provider activity, as in F1. **Datasets:** F2's rows have the same count and SHA-256 (the `lab replay` digest). **Oracles:** pass. |

**Provider lane.** It runs once per candidate, with explicit per-lane limits of
48k/8k/56k tokens per request and a 560k run budget. It makes one attempt and retries
only on the recognized empty HTTP 400.

| Pri | Journey | Assertions (what each one reads) |
|---|---|---|
| P1 | Create a Flow from an instruction (`instruction-only-form`, then one extraction task such as `product-catalog-first-page`) | **Progress DOM:** "Preparing exploration..." appears before "Inspecting live target...". **High-token dialog:** confirmed. **Core:** exactly one `proposed` `flow_bootstrap` with `evidenceLoop` accounting, and the blank Flow's hash is unchanged before approval. **Audit and Changes views:** visible. **Approve, then Apply with PIN:** Core status goes `validated`, then `applied`, and the digest changes. **Bound run:** zero provider activity. **Oracle:** `finalState`, and for the extraction task `matchedRecords === expectedRecords`. |
| P2 | Fail, diagnose, repair the same Flow, review the diff, apply, rerun | **Action Log DOM:** shows the failure before any approval. **Core:** exactly one repair proposal, with provider calls within the grant. **Changes view DOM:** the "Changed fields" table shows the target field before and after. **Approve and apply with PIN:** the mutation count is 1. **Deterministic rerun:** zero provider activity and a passing oracle. **Lane result:** if no proposal is produced, the lane reports `recovery.<code>` from `llm.runtime_patch_*` rather than a generic failure. |
| P3 | Revert through the UI, then inspect history | **Revert Changes with PIN:** Core status is `reverted`. **Adaptations table DOM:** the row shows `reverted`, and the Audit list shows the revert event. **Drift rerun under No LLM:** fails again, which proves the revert took effect. |
| P4 | Restart and reuse the repaired Flow | As F4, applied to the P2 Flow before P3's revert. Alternatively, run P3 on a second repair. |
| P5 | Grant, then refuse, a permission request | Needs a registered consent-requiring task. **If the dialog appears:** Cancel, then check that there is no proposal and the blank hash is unchanged. Reopen. **Grant path:** **Allow and continue** leads to one proposal whose `permittedConsequences` equal exactly `missing`. **Refuse path:** a second build is stopped at Cancel, and no proposal or mutation follows. **If the dialog does not appear:** the lane reports `permission.not_requested` as `unverified`. |
| P6 | Improve an existing Flow | Reports `not_built` until the product UI exists (see `w2x-existing-flow-and-repair-design`). |

### Expected wall clock

These are estimates built from the measurements above. They are not run results.

- **Provider-free lane.** Topology start takes about 10-15 s. F1 takes about 45-60 s.
  F2 takes about 40-50 s. F3 takes about 20-30 s. F4 takes about 60-80 s, based on t032's
  70.1 s and the integrated smoke's 74 s. The total is **about 3-4 min**, plus the build
  prelude.
- **Provider lane.** P1 takes about 60-90 s per task. P2 takes about 90-120 s. P3 takes
  about 40 s. P4 takes about 60 s. P5 takes about 60-90 s for two builds. The total is
  **about 6-8 min**. Provider cost is in cents; for example, one creation cost $0.0032
  (`w2-panel-unified-batch-live.md`) and a 5-call build cost $0.023 (`w2-t011-live-permission-resume.md`).
- **Build prelude.** The scenario-lab build, extension build and test-runner build were
  not measured in any evidence I read, so this must be measured on the first run.

### File-partitioned build order

**Phase 0 (serial, prerequisite).** Integrate the t027 test-runner drivers into `dev`.
There are 40 files; `git diff --stat dev task/t027-multi-action-exploration --
packages/test-runner/src` reports 777 insertions and 106 deletions. They include the
live-proven locator, confirmation and diagnostic fixes and `panel-golden-path/`. The
suite builds on them. `w2x-branch-integration-audit` owns this sequencing.

**Phase 1.** These briefs can run in parallel because no two share a file:

| Brief | Owns (new unless marked) |
|---|---|
| A: topology and allocation | `ui-e2e/topology.ts`, `ui-e2e/tests/topology.test.ts`. Edits `demo-workspace/core-process.ts` (split start and stop from `withPersistentDemoCore`) and `demo-workspace/configuration.ts` (accept allocated origin and gateway). |
| B: Runtime Debug assertions | `ui-e2e/assertions/runtime-debug.ts`, `ui-e2e/assertions/index.ts`, `ui-e2e/assertions/tests/runtime-debug.test.ts`. This promotes the disposable presentation and no-reload observers; it reads `panel-verification.ts` without editing it. |
| C: Adaptation assertions | `ui-e2e/assertions/adaptations.ts` (history, "Changed fields" diff, UI Revert and Reject), `ui-e2e/assertions/tests/adaptations.test.ts`. The shared `assertions/index.ts` is owned by B; C hands its export to the Phase 2 owner. |
| D: Extraction journey | `ui-e2e/journeys/extraction.ts`, `ui-e2e/journeys/tests/extraction.test.ts`. This promotes the t032 driver and reuses `flow-lane/run-datasets.ts` and `run-expectations/extraction/judgement.ts` without editing them. |
| E: Failure and restart journeys | `ui-e2e/journeys/failure-presentation.ts`, `ui-e2e/journeys/restart-reuse.ts`, and tests. |
| F: Creation driver | Edits `demo-llm-create-ui/explore-proposal-ui.ts`: progress-state assertion and a permission refuse branch. Its test is `demo-llm-create-ui/tests/exploration.test.ts`. |

**Phase 2 (serial, one owner).** This owner takes:
- `ui-e2e/suite.ts`;
- `ui-e2e/index.ts`;
- `ui-e2e/journeys/index.ts`;
- `packages/test-runner/src/index.ts`;
- `scripts/run/ui-e2e.mjs`;
- the root `package.json` (`ui:e2e`);
- `panel-golden-path/{lane,assertions,index}.ts`, whose stages become measured or which
  is folded into the suite.

**Phase 3.** `docs/architecture/testing-facility.md` gets a "UI end-to-end suite"
section. Today the document does not mention `panel:golden` or any panel UI lane; `grep -i golden`
finds nothing.

**Product UI work, in separate Core-side briefs:**
- a structural repair diff (`AdaptationChangeCard.tsx` and the repair script contract);
- a run-time or repair permission request surface (the runtime views);
- existing-Flow improvement (the authoring panel);
- review before apply for recording generation (the recordings view);
- per-decision exploration progress (`BlankFlowAuthoringPanel.tsx`).

P2's diff assertion and P5 and P6 depend on these.

## What changed and why

I created only this report, as the brief required. I edited no source, test, working
document or git state. I wrote two throw-away aggregation scripts in my session
scratchpad; they are not in the repository.

## Commands run and observed results

- `git log`, `git diff --stat dev task/t027-multi-action-exploration -- …` on the lane
  sources: 24 files changed, +651/-52. Across all of `packages/test-runner/src`: 40
  files, +777/-106. `panel:golden` is the only root script that differs between `dev`
  and t027.
- `diff -q` of `docs/architecture/testing-facility.md` between `dev` and t027: identical.
- A node script over `F:\fxlab-runs\*\*\evidence\*\summary.json`: 171 bundles, with the
  per-lane pass and fail counts and durations quoted in the journey table.
- Per-stage `summary.json` read of the last `panel:golden` attempt: prepare, explore,
  apply and run passed; adaptation `failed` at 25.3 s. `events.ndjson` held no terminal
  failure code.
- A grep of Core `apps/web/src/features/automation-studio` for revert, diff and
  permission UI; the findings are cited above.
- A second aggregation over `F:\!FluxIQWebExtension\test-runs` and the t027
  `test-runs`: no demo bundles were found.

## Not verified

- I ran no build, test or live run, as the brief required. Every duration above is a
  past observation.
- **Build prelude duration.** No evidence I read measured it, and the wall-clock figures
  for the proposed lanes are inferences.
- **Whether `dev`'s Core Create project dialog still breaks `dev`'s exact-label
  locators.** It was proven stale only against t027's Core (`ef7892f`, `w2-t027-panel-live.md`).
- **Whether the content-harness teardown flake persists** after x5l.
- **The extension `test:e2e` suite's duration.**
- **Why the last golden adaptation failed.** The bundle carries no code. The inference
  that no repair proposal was produced comes from the Current State and
  `w2-panel-repair-result-boundary.md`.
- **The Core UI checks** were greps, not rendering.

## Open questions or contradictions found

- `panel:golden` reports seven stages as `verified` by static declaration
  (`lane.ts:187-200`), not from observed checks. A driver returning without throwing is
  counted as verification of stages such as `creation_proposal_review`, whose
  presentation is never asserted.
- The t027 golden-path design report names the launcher `scripts/run-panel-golden-path.mjs`;
  the file is at `scripts/run/panel-golden-path.mjs`.
- Two extraction proofs disagree on the oracle. `w2-extraction-exit-live.md` passed the
  full record oracle. `w2-integrated-extraction-ui-smoke.md` on `dev` checked counts and
  export sizes only, so `dev` has no record-level UI extraction evidence.
- The permission dialog is covered only when the model happens to request a consequence.
  There is no deterministic trigger that keeps the real provider. The supervisor must
  choose between a consent-requiring registered task, accepting `unverified` when the
  dialog does not appear, and a panel-level network stub, which would be a component
  test, not E2E.
- Every repair lane (the golden stages, `demo:llm:explore:adapt*`) is hard-wired to
  `instruction-only-form`'s drift controls and the "Submitted: Ada / team" oracle
  (`adaptation-ui.ts:180-190`, `exploration-adaptation.ts:138-139`). The
  `FLUXIQ_LLM_SCENARIO_ID` override therefore changes creation but not repair.
