# Panel Golden Path Audit And Lane Design

Status: Read-only audit complete
Date: 2026-09-20
Worker: `w2-panel-golden-path`
Candidate: paired t027 worktrees; no process was started and no runtime claim is
made by this report

## Result

The production panel already has real UI drivers for most of the desired path,
but there is no single acceptance lane that proves it as one user journey.
Typed website exploration, proposal review/application, deterministic execution,
recording-derived Flow generation, panel-driven failure/adaptation, and
provider-free replay are each present. Today they are split across independent
demo commands and, critically, the repair demo operates on a separately prepared
target-drift Flow rather than on the Flow that the typed-instruction lane just
created.

The smallest useful addition is therefore a test-runner orchestration seam, not
a second implementation of any Core or browser behavior: carry one exact Flow
identity from typed creation through run failure, visible repair review/apply,
rerun, process restart, and deterministic reuse, while reusing the existing UI
drivers. Recording-to-Flow should remain a second path in the same golden-path
campaign because it begins in the production extension recorder rather than in
blank-Flow authoring.

## What is already driven through production UI

| Required visible stage | Existing production path | Existing driver and assertion | Coverage status |
| --- | --- | --- | --- |
| Typed instruction | Automation Studio -> exact blank Flow -> Runtime Debug -> region `Build Flow from instructions` -> `Website task` | `demo-workspace/exploration-checkpoints.ts` calls `proposeEvidenceGuidedCreationViaUi`; `demo-llm-create-ui/explore-proposal-ui.ts` fills the textarea and presses `Explore and create proposal`. | Supported. |
| Exploration/progress | The authoring panel renders `Preparing exploration...`, then `Inspecting live target...`, a progress element, live status text, and elapsed seconds. | `BlankFlowAuthoringPanel.tsx` owns the visible states. The current driver waits for the terminal API/proposal/UI state but does **not** assert that both progress states were visible. | UI exists; golden assertion missing. Progress is phase-level, not action-by-action. |
| Reviewable proposal | Adaptations table -> exact adaptation -> Adaptation Detail -> Audit | `approveApplyExistingEvidenceGuidedCreationViaUi` requires the exact pending `flow_bootstrap`, matching base digest, unchanged blank Flow, one exact Adaptations row, and the Audit tab. | Supported. |
| Approval and application | `Approve Adaptation` dialog, PIN, then `Apply Adaptation` / `Apply Changes`, PIN | `demo-llm-create-ui/apply-proposal-ui.ts` and `panel-interaction.ts::review` drive both real dialogs and re-read Core after each transition. | Supported. |
| Normal run | Exact Flow -> Runtime Debug -> `No LLM intervention` -> `Run` | `demo-workspace/panel-run.ts::runDemoFlowFromPanel`; the bound exploration continuation additionally requires the manifest oracle, terminal success, all action attempts successful, zero provider calls/interventions, the expected owned Subflow, and no recording change. | Supported. |
| Visible final outcome | Runtime Debug history and Action Log render run status, action count, duration, attempts, story, metrics, recovery routing, LLM adaptation, and terminal failure reason. | `runtime/RunActionLogView.tsx` renders these. `panel-verification.ts` can select a run row and prove the Action Log names the run, although its deep-link fallback may report `limited`. | UI exists; creation continuation does not assert the rendered final outcome. |
| Recording start/stop | Production extension side-panel `Start recording` / `Stop recording`, while the real Scenario Lab page is manipulated | `demo-workspace/workspace-lanes.ts::recordDemoWorkspace` uses the unpacked `dist/chrome` extension copied into the private workspace and opens its real `sidepanel/index.html`. | Supported. |
| Recording-to-Flow | Persisted recording -> timeline -> `Generate Subflow` -> destination + PIN -> rendered Nodes view | `demo-workspace/provisioning.ts::generateDemoSubflowFromRecording` drives the real panel, checks the durable recording identity/Router/Subflow graph, then checks rendered node rectangles. | Supported. The dialog approves generation in one operation; it is not a separately reviewable Adaptation inbox proposal. |
| Visible failure and diagnosis | Runtime Debug -> `Diagnose and propose adaptation`; Action Log can show the failure and recovery metadata | `demo-workspace/adaptation-ui.ts::runAdaptationFromPanel` drives the real run mode and waits for a terminal run. | Partly supported. The driver validates durable details but does not first assert the failed attempt/terminal reason is visibly rendered in Action Log. |
| Repair review/apply | Exact pending Adaptation -> Audit -> Approve -> Apply Changes | `adaptation-ui.ts::openAdaptationFromPanel` and `reviewAndApplyAdaptationViaUi` drive the production inbox and dialogs. | Supported for the prepared target-drift demo. |
| Rerun after repair | Reload drifted fixture -> exact Flow -> Runtime Debug -> zero-LLM run -> scenario oracle | `adaptation-ui.ts::runZeroLlmAdaptationValidation` requires terminal success, successful actions, zero provider calls/interventions/adaptations, and the expected visible result. | Supported for the prepared target-drift demo. |
| Persisted deterministic reuse | Each demo invocation restarts its owned Core web process but retains the workspace store and browser profiles; the applied exploration Flow can be run again by `demo:llm:explore:request:run` or the instruction-only baseline command. | `bound-exploration.ts::runBoundDemoLlmExplorationFlow` permits only non-topology execution-settings drift and still requires the exact bound adaptation/topology, zero provider use, and the manifest oracle. | Supported across invocations, but the current command does not assert the saved Flow was found by a human-visible panel search before the rerun. |

The production extension fixture is genuine rather than an API substitute:
`demo-workspace/browser-session.ts` copies the selected extension build to the
workspace, launches Chromium with only that unpacked extension, resolves its
service worker, and opens `chrome-extension://<id>/sidepanel/index.html`.
Panel interactions use a separate authenticated persistent Chromium context,
and the scenario uses the extension-bearing context. Pairing approval is also
driven through the real panel.

## Executable campaign using current commands

This sequence is runnable now and provides the strongest current UI evidence.
It is a campaign of related checkpoints, not yet the single-Flow golden lane.
Run it in an isolated paired worktree with an already provisioned test identity
and key; values for credentials and the provider key remain in the supervisor's
private environment and must never be copied into a report.

Use one unique resource set for this worker:

```powershell
$env:FLUXIQ_WEB_EXTENSION_ROOT = 'F:\fxwork\<task>\!FluxIQWebExtension'
$env:FLUXIQ_CORE_ROOT = 'F:\fxwork\<task>\!FluxIQ'
$env:FLUXIQ_TEST_RUNS_DIR = 'F:\fxlab-runs\panel-golden-<task>'
$env:FLUXIQ_DEMO_RUN_DIR = 'F:\fxlab-runs\panel-golden-<task>\workspace'
$env:FLUXIQ_DEMO_BASE_URL = 'http://127.0.0.1:<unique-panel-port>'
$env:FLUXIQ_DEMO_GATEWAY_URL = 'ws://127.0.0.1:<unique-gateway-port>/client'
$env:FLUXIQ_DEMO_EXTENSION_DIR = 'F:\fxwork\<task>\!FluxIQWebExtension\apps\extension\dist\chrome'
$env:FLUXIQ_DEMO_HEADLESS = 'false'
```

The identity variables `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`,
`FLUXIQ_TEST_PIN`, and optional `FLUXIQ_TEST_TOTP` must be supplied privately.
Provider setup is a one-time UI operation for this isolated workspace:

```powershell
pnpm demo:llm:setup
```

Run the following live-first checkpoints in order, stopping at the first
product failure and reading the browser evidence rather than continuing:

```powershell
# Recording -> generated Subflow -> ordinary panel execution.
pnpm demo:record
pnpm demo:run

# Typed instruction -> exploration proposal -> exact UI review/apply -> run.
# With no FLUXIQ_LLM_* override, the registered instruction-only-form default
# is used. A breadth worker can set a registered scenario and safe instruction.
pnpm demo:llm:prepare
pnpm demo:llm:explore:request
pnpm demo:llm:explore
pnpm demo:llm:explore:request:apply
pnpm demo:llm:explore:request:run

# Repeat in a new process to prove persistence and zero-model reuse.
pnpm demo:llm:explore:request:run

# Existing panel-driven failure -> repair -> approve/apply -> zero-LLM rerun.
pnpm demo:llm:adapt
```

For a registered breadth scenario, set `FLUXIQ_LLM_SCENARIO_ID` and
`FLUXIQ_LLM_INSTRUCTION` to the exact entry from
`apps/scenario-lab/src/scenarios/live-instructions.ts`; the readiness command
must run first and must not echo the instruction. The first golden acceptance
should use `instruction-only-form`; `social-scheduler-schedule-post` is the
next meaningful multi-field/permission lane after the t027 A/B is accepted.

## Assertions the golden lane must add

The new lane must inspect the visible UI and then corroborate it against Core;
neither surface alone is enough.

1. **Instruction entry:** one exact `Build Flow from instructions` region and
   `Website task` textarea; text accepted; action enabled.
2. **Progress:** `Preparing website exploration` becomes visible before
   `Inspecting live target`; status text remains live while elapsed time
   advances; controls are disabled; no failure alert is present.
3. **Proposal:** exactly one proposal row appears; Audit visibly reports a
   `flow_bootstrap`; the Flow content hash remains blank before approval.
4. **Approval:** the exact Approve dialog and PIN boundary appear; status
   becomes `validated`; the graph is still unchanged.
5. **Application:** the exact Apply dialog appears; status becomes `applied`;
   the expected Router, owned Subflow, executable graph, and applied digest
   exist and are visibly selectable.
6. **Run:** Runtime Debug shows the selected mode and enabled Run action; the
   response names one run; the run row and Action Log visibly show the same
   run ID, terminal status, action count, and every failed/succeeded attempt.
7. **Oracle:** Scenario Lab's registered final-state or dataset oracle passes;
   a successful HTTP response or `runtimeSession.status` alone does not pass.
8. **Failure presentation:** on the induced drift, Action Log visibly shows the
   failed attempt, terminal failure, Recovery/Adaptation section, and exact
   pending adaptation link before any repair is approved.
9. **Repair oversight:** the exact repair opens from Adaptations, Audit is
   visible, approval and apply require PIN, and no mutation occurs before
   approval. For structural repair, the UI must expose the proposed diff; if
   only opaque metadata is visible, this assertion remains failed.
10. **Rerun:** the same Flow is rerun from Runtime Debug, reaches the registered
    oracle, and Core records zero provider calls/interventions.
11. **Restart/reuse:** after the owned Core and browsers close and restart, the
    panel finds the same saved Flow through the project hierarchy, runs it
    again, passes the oracle, and again records zero provider calls.
12. **Recording path:** extension connection/pairing and recorder state are
    visibly correct; one durable recording appears in the panel; generated
    nodes cover all executable recorded events in order; the run passes the
    page oracle without provider use.

At every stage record only IDs, closed status/code names, counts, timings, and
boolean UI assertions. Do not record the entered instruction/value, cookies,
PIN, token, raw page evidence, prompt, or model response.

## Smallest missing seam and file ownership

### 1. One exact-flow golden orchestrator (required first)

Create a focused test-runner module that composes the existing public helpers
while keeping one `{projectId, flowId, adaptationId}` binding from creation to
repair and reuse.

- New owner: `packages/test-runner/src/panel-golden-path/lane.ts`
- New visible assertions: `packages/test-runner/src/panel-golden-path/assertions.ts`
- Barrel: `packages/test-runner/src/panel-golden-path/index.ts` and the package
  public barrel only if the script needs it
- Thin launcher: `scripts/run-panel-golden-path.mjs`
- Command registration: root `package.json`, for example `panel:golden`
- Report/evidence schema should reuse `BrowserEvidenceRecorder`; do not create a
  second artifact format.

The lane should reuse, not copy:

- `proposeEvidenceGuidedCreationViaUi` and
  `approveApplyExistingEvidenceGuidedCreationViaUi`;
- `runDemoFlowFromPanel`, `openAdaptationFromPanel`,
  `reviewAndApplyAdaptationViaUi`, and the zero-LLM validation logic;
- `verifyAuthenticatedFluxIQPanel` only as a corroborating deep-link check;
- Scenario Lab manifests and their existing fact/dataset oracles.

The needed behavioral extension is to induce a declared post-creation drift on
the created Flow's own scenario, run that same Flow in diagnosis/adaptation
mode, retain its proposed repair, and continue the same binding through review,
apply, restart, and reuse. Do not substitute `demo:llm:adapt`'s separate
prepared Flow for that identity.

### 2. Visible-stage assertions (required for UI acceptance)

The current helpers observe API responses and durable records more strongly
than they observe presentation. Add narrow helpers in the new assertions file
for progress state/order, proposal audit visibility, run-row/action-log
identity, visible failed attempts, recovery/adaptation presentation, and
saved-Flow re-selection after restart. No Core change is required for these
assertions.

### 3. Product UI gaps discovered by the lane (separate tasks only if live
evidence confirms them)

- Phase-level exploration progress exists, but action/decision-level oversight
  is not exposed by `BlankFlowAuthoringPanel.tsx`. If the user cannot tell what
  the explorer is doing during a slow run, Core owns the progress event
  contract and `apps/web/.../authoring/BlankFlowAuthoringPanel.tsx` owns its
  rendering. This is a product enhancement, not a test-runner workaround.
- The recording `Generate Subflow` dialog combines proposal creation and
  approval. If recording-derived automation must use the same explicit
  review-before-apply contract as LLM generation, ownership crosses Core's
  recording proposal API and Automation Studio's recording view. The golden
  lane must report this distinction; it must not claim a separate review that
  the UI does not present.
- Structural repair diff review is described in the Week 2 Current State as not
  built. Until the Adaptation detail renders a human-readable Flow diff, the
  complete oversight assertion cannot pass. This is Core Automation Studio UI
  work, not downstream browser-driver work.

## Blockers versus supported continuation

### Supported now

- A person can type a website task in the real panel, watch bounded phase-level
  progress, receive a proposal, approve/apply it, and run it through the real
  extension and panel.
- A person can record with the production extension side-panel, generate a
  deterministic Subflow from the durable recording in the panel, and run it.
- A prepared Flow can fail on drift, use the model to propose a repair through
  Runtime Debug, be reviewed/applied in the real Adaptations UI, and pass a
  zero-model validation run.
- Persistent isolated workspaces permit a later process to find and rerun an
  applied Flow without calling the provider.

### Still open for the requested end-to-end claim

- One Flow identity is not currently carried through typed creation, induced
  failure, repair, rerun, and restart/reuse by any test command.
- Progress rendering is not asserted and does not expose each exploratory
  action/decision.
- Visible failure/action-log and post-restart hierarchy assertions are absent
  from the typed-creation continuation.
- Recording generation is UI-driven but does not present a separate proposal
  review stage.
- Human-readable structural repair diff review is not built.
- Firefox popup parity is outside the current Chromium-only demo browser and
  needs its own later lane; it cannot be inferred from this golden path.

## Acceptance boundary

Do not call the panel end-to-end path complete until the new exact-flow lane
passes all twelve visible assertions in headed Chromium, its Scenario Lab
oracle passes, its repaired and restarted runs each account for zero provider
calls, and the recording path passes independently. Only after that live result
should narrow automated tests be added for the orchestration seam. A complete
suite remains an integration-boundary check, not an iteration step.

