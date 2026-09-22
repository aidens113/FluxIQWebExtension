# w2x-ui-e2e-foundation: UI end-to-end topology and assertions (plan step U1, first half)

Worker: `w2x-ui-e2e-foundation` (task t068)
Date: 2026-09-21
Tree: flat worktree `F:\fxwork\t068-ui-e2e-foundation`, branch `task/t068-ui-e2e-foundation`, from `dev` `49fee2c`. Core is the shared read-only `F:\fxwork\!FluxIQ` at `71e2798`.
Changes are uncommitted.

## Outcome

**Partial.** All three pieces are built, and the checks passed.

- **(A) topology.** Built, and proven live.
- **(B) Runtime Debug assertion.** Built, and verified live on 4 of 4 runs that reached a run response.
- **(C) adaptation assertions.** Built and run live. They measure the history table, the "Changed fields" tables, and the PIN-authorized Approve, Apply, UI Revert and Reject. Every check passes on both the panel and Core except one. That check fails on a real Core defect, which I cannot fix from here: right after any PIN review, the Audit tab shows "0 events" until you reopen the adaptation. The code is `adaptations.audit_stale_after_review`. I kept it as a failure rather than tolerate a known wrong screen.

The brief asked for "(C) passing". It does not fully pass until Core returns the audit trail with a review result (see Open questions 1).

Other findings:

- **The shared `basic-form` "Submitted" oracle proves nothing.** It uses Playwright's `hasText`, which is a case-insensitive substring match, so it also matches "Not submitted" (Open questions 2).
- **Journey 1 hit one flake.** In 1 of 6 live runs, the panel never delivered the run response, although Core finished the run (Open questions 4).

## What changed and why

All paths are under `packages/test-runner/src/`.

### `ui-e2e/topology.ts` (new, 399 lines): class `UiE2eTopology`

- **What stays up.** One Core, panel, client gateway, Scenario Lab and browser pair. They are kept across journeys (`journey(id, op)` gives each journey its own evidence bundle over the shared pages).
- **Ports.** Three distinct ports come from `allocateLoopbackPort` and are each proven with `assertLoopbackPortBindable`. Excluded ports are drawn again, within a bound: `3000`, `4711`, `3300` and `4877` (`UI_E2E_EXCLUDED_PORTS`, `allocateUiE2ePorts`). The fixed demo defaults are never used.
- **Run root.** `$FLUXIQ_TEST_RUNS_DIR/ui-e2e/<run-id>/` (`uiE2eRunRoot`). It holds:
  - `fluxiq-root/.fluxiq`;
  - `browser-profile-isolated`;
  - `panel-browser-profile-isolated-v2`;
  - `extension-under-test`, a pinned copy of `FLUXIQ_DEMO_EXTENSION_DIR` or `apps/extension/dist/chrome`;
  - `evidence/`;
  - `logs/`.
- **Identity.** Fresh per run (`freshUiE2eIdentity`). The configuration is built from an explicit allowlist, never from env files or demo pins.
- **Provider secrets.** The topology never reads one. Its browsers and children start without provider variables. In the `provider-free` lane, the panel context blocks `generate-flow-bootstrap-adaptation`, `preflight-llm-execution` and `issue-llm-execution-grant`, and counts every attempt (`blockedProviderRequests()`).
- **`restartCore({ whileStopped })`.** Stops Core, then measures that both ports are released (it binds them, allowing 5 s for Windows to release handles). It starts Core again on the same ports through the reuse path, signs in afresh, and puts the new cookie on the panel context. `whileStopped` runs in the one window in which no server holds the store; I used it to seed fixtures. This hook goes beyond the brief.
- **`resetScenarios()` and `scenarioState(id)`.** These use the Lab's `/__control/reset` and `/__control/final-state`. I added them after measuring that the Lab's server-side state survives across journeys (see Open questions 3).
- **`timings`.** Per phase: prepare, pin extension, Scenario Lab, Core start and restart, authenticate, browsers.

### `ui-e2e/assertions/` (new)

- **`runtime-debug.ts` and `runtime-debug-facts.ts` (B).** These promote the observers from `w2-panel-run-presentation-live` and `w2-integrated-dev-ui-smoke`.
  - `watchRuntimeDebugRefresh(page)` is started before the Run click. It sets a marker on the document; a replaced document is the reload signal. I did not use raw `framenavigated`, because Playwright also counts same-document history updates. The watch records when the run's execute response arrived and when the Action Log header first named the run.
  - `assertRuntimeDebugRun` reads Core's run detail until terminal. It then checks three things:
    - the Action Log already open reaches Core's status, action count and attempt rows in place;
    - the "Find a run" search shows one row with Core's status and action count;
    - the reopened Action Log names the run and shows Core's status (badge and metric), count, and attempt rows in run order.
  - Each read is one self-contained page function using structural hooks: the status badge's `title`, each metric's own `span`/`strong`, and each attempt row's node `title`.
  - The result has 13 closed codes. The facts are closed statuses, counts and booleans only.
- **`adaptations.ts`, `adaptation-facts.ts` and `changed-fields.ts` (C).**
  - `assertAdaptationHistory` compares table rows with Core's list, plus optional expected statuses.
  - `assertAdaptationChanges` compares each rendered "Changed fields" table, planned and applied, with Core's before/after. The oracle is `adaptationChangedFieldRows`, a mirror of Core's `adaptationChangedFields`, including its display words and 50-row cap.
  - `reviewAdaptationViaUi` drives Approve, Apply Changes, Revert Changes or Reject (with a reason) through the real Audit-tab button and the PIN dialog. It then judges:
    - Core's status and audit trail;
    - the rendered detail badge and table row;
    - the Audit count in place, and again after the view reloads the adaptation;
    - a SHA-256 of the patched nodes' `parameterValues`. Apply or revert must change it; approve or reject must not. Revert can also be required to restore an exact earlier digest.
  - The result has 19 closed codes.
- **`index.ts`.** The barrel for the assertions.

### `demo-workspace/core-process.ts`

- `withPersistentDemoCore` is split into `startPersistentDemoCore(config, { reusePreparedWorkspace })`. It returns `RunningDemoCore { sessionId, webPort, gatewayPort, stop() }`; `stop()` can be called more than once safely.
- A start that fails part-way stops what it launched and removes its session. The same "cleanup also failed" appending as before is kept.
- `withPersistentDemoCore` is now start, then `runThenCleanUp(operation, core.stop)`, so it has the same semantics for existing lanes.
- `reusePreparedWorkspace` skips the host build, domain setup and identity check on a restart.

### `demo-workspace/configuration.ts`

- `resolveDemoWorkspaceConfiguration(root, env, overrides?)` accepts the allocated `origin` and `gatewayUrl`, plus `workspaceDirectory` and `extensionSourceDirectory`.
- Each passes the same checks as its environment variable, and the two ports must be explicit and distinct.
- With no overrides, behaviour is unchanged.

### `demo-workspace/index.ts`

**Outside the paths named in the brief.** I added one additive export line: `startPersistentDemoCore`, `RunningDemoCore`, `DemoCoreStartOptions`, `withPersistentDemoCore`, `authenticatedControl`, and the overrides type.

This was required: the imports rule ratchets barrel skips. An import from `ui-e2e/topology.ts` straight into `../demo-workspace/core-process.js` would be a new structure-audit failure.

**Merge note:** t069 may add a similar line. It is additive.

### Tests

- `ui-e2e/tests/topology.test.ts`.
- `ui-e2e/assertions/tests/{runtime-debug-facts,adaptation-facts,changed-fields}.test.ts`.
- `demo-workspace/tests/configuration.test.ts` (new).
- `demo-workspace/tests/core-process.test.ts` gains three tests:
  - a start with equal ports is refused;
  - a start on a held port is refused before anything launches;
  - the restart path skips the one-time preparation, and `withPersistentDemoCore` composes start and stop.

## Commands run and observed results

Every live run used:

- `FLUXIQ_TEST_ENV_FILES=none`;
- the `provider-free` lane;
- headless Chromium with the worktree's `apps/extension/dist/chrome`;
- ports allocated by the topology, never 3000 or 4711, run one after another.

The driver is scratch code, not in the repository: `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\9fa9070d-9274-4ad5-ba37-583f15c64762\scratchpad\t068\live-foundation.mjs`. It uses the new topology and assertions, plus the existing `provisionDemoFlow`, `connectExtension`, `generateDemoSubflowFromRecording` and `runDemoFlowFromPanel`.

**Journey 1** (record, Generate Subflow, run on `basic-form`):

1. Reset the Lab.
2. Assert a fresh fixture: exact text "Not submitted", and Lab `submissionCount` 0.
3. Run under No LLM intervention.
4. Assert (B).
5. Judge the oracle by the Lab's own state and by exact text.
6. Check Core's run detail.

**Journey 2:**

1. Seed two `edit_action_target` fixtures while Core is stopped. There is no provider-free way to create an adaptation; recording generation creates none (`reviewRecordingFlowProposal`). I seeded them through Core's own `saveFlowAdaptation` validator; the patch re-points one recorded node's selector to an equivalent `:not([data-ui-e2e-never])` form.
2. Restart Core.
3. Reload the panel and open the Flow's Adaptations.
4. history → Changes → Approve → Apply → Changes → history → UI Revert (must restore the pre-apply digest) → Reject → history.

| Run | Phases | Result |
|---|---|---|
| `r20260921t230112-265b` | record | (B) `runtime_debug.verified`. My driver's own "Submitted before run" check tripped because the Lab kept the recording's submission, so I added `resetScenarios()`. |
| `r20260921t230559-14c1` | record | (B) verified. The Lab went from 0 to 1 submission with the recorded values. My driver's `hasText: "Submitted"` check matched "Not submitted" (Open questions 2), so I switched to exact text. |
| `r20260921t231002-478a` | all | Journey 1 passed. In journey 2, every Core, row, badge and graph check was right. The in-place Audit count read 0 against Core's 1–4, and each step waited out its 30 s poll, so the journey took 137 s. |
| `r20260921t231827-69fa` | all | **Journey 1 failed:** `Timed out waiting for the panel Flow run response` (60 s, in the shared `runDemoFlowFromPanel`). Core recorded that run as `succeeded`: queued to finished in 9.7 s, 5 of 5 attempts. The final screenshot shows the Run button back to "Run", not "Running...". |
| `r20260921t232340-3246` | all | Journey 1 passed. Run-request diagnostics: 1 request, one 200 response, 0 `requestfailed`. Click to response took 40.3 s under machine load (queue +10.8 s, run 18.7 s, response +4.6 s). In journey 2, every step was `verified` except the four reviews, each `adaptations.audit_stale_after_review`. |
| `r20260921t233400-0774` | all (final build) | Same as the previous run. Details below. |

**Final run (`r20260921t233400-0774`), measured:**

- **Journey 1:**
  - (B) `runtime_debug.verified`:
    - `documentReplaced` false;
    - `logNamedRunBeforeResponse` true;
    - in-place log, run row and reopened log all `succeeded`, 5 actions, 5 attempt rows matching Core's order.
  - Core: `succeeded`, 5 of 5 attempts `succeeded`. Provider calls, interventions, adaptation IDs and change-proposal IDs were all 0.
  - Blocked provider requests: 0.
  - Lab `basic-form`: `submissionCount` 0 before the run, 1 after, values Ada / team; the exact text "Submitted" appeared only after the run.
  - The extension went `recording`, then `idle`; 1 new recording; generated graph of 5 nodes.
- **Restart:** `webPortClosed` true, `gatewayPortClosed` true.
- **Journey 2** (fixtures `adaptation.ui-e2e.apply.2168e892` and `adaptation.ui-e2e.reject.eb27a630`):
  - history (proposed), Changes (1 card, 1 row, 0 mismatches), Changes after apply, history (applied) and history (reverted/rejected): all `adaptations.verified`.
  - Approve: Core `validated`; detail and row show `validated`; audit 1→2, +1 `validated` event; reopened count 2; digest unchanged.
  - Apply: Core `applied`; audit 2→3; reopened 3; digest `8067b4d9…` → `ea04f708…`.
  - UI Revert: Core `reverted`; audit 3→4; reopened 4; digest back to `8067b4d9…`, exactly the pre-apply value.
  - Reject: Core `rejected`; audit 1→2; reopened 2; digest unchanged.
  - Every review showed 0 in place, so each returned `adaptations.audit_stale_after_review`.
  - The applied adaptation had no `applicationRecord.mutations`. Core and the panel agree (0 "Applied Changes" cards).

**Timings, final run** (whole driver 117.2 s):

- **Topology start: 12.3 s.** Prepare 0.14 s (pinning the extension 0.04 s), Scenario Lab 0.9 s, Core start 7.8 s, sign-in 1.5 s, browsers 2.1 s.
- **Journey 1: 62.7 s.** Provision through the panel 13.8 s, connect the extension 5.6 s, record 6.4 s, Generate Subflow 9.5 s, reset and open the Flow then run to response 25.7 s, Runtime Debug assertion 1.2 s.
- **Restart: 9.8 s.** Stop 0.21 s, seed while stopped 0.36 s, Core restart 6.7 s, sign-in again 2.4 s.
- **Journey 2: 30.8 s.** Open Adaptations after reload 9.7 s. Approve 7.1 s, Apply 2.1 s, UI Revert 2.4 s, Reject 4.2 s; each includes the reopen read.
- **Stop: 1.7 s.**
- **Variance on the loaded machine (`…232340-3246`):** journey 1 took 128.4 s, including a 50.6 s span from generation to run response, and journey 2 took 15.0 s. In `…230559-14c1`, prepare took 47.9 s; later runs pinned the extension in 0.04–0.3 s.

**Checks:**

- **Build:** `npx tsc -p tsconfig.json` in `packages/test-runner` exits 0.
- **Unit tests:** `node --test` on six compiled test files: `ui-e2e/tests/topology`, `ui-e2e/assertions/tests/{runtime-debug-facts,changed-fields,adaptation-facts}` and `demo-workspace/tests/{configuration,core-process}`. Result: `# tests 43 # pass 43 # fail 0`. An earlier run showed one failure; that came from a stale build while one test file did not compile.
- **`pnpm check`:** in the worktree, `FLUXIQ_TEST_ENV_FILES=none pnpm check` exits 0 in 2 min 17 s. The audit printed `structure-audit: passed (84 warning(s), 122 baselined).`
- **Structure audit:** `node scripts/structure-audit.mjs --json` reports `failures` 0, and none of the 84 warnings names a file I touched.
- **Core diagnosis:** I read the stopped store in-process with a scratch `inspect-runs.mjs` to get the failed run's Core record.

## Not verified

- The existing demo lanes (`demo:record`, `demo:run`, `panel:golden`) were not re-run after the `withPersistentDemoCore` split. Only the new topology exercised `startPersistentDemoCore`, on both the first-start and reuse paths.
- The `provider` lane was never started, and no provider journey was run.
- An extension reconnect after `restartCore` (F4) was not run; journey 2 needed no extension.
- Paging was not exercised: more than 25 adaptations, more than 8 changes, or more than 50 attempts.
- Headed mode and Firefox were not run.
- The cause of the run-response flake is not established (below).
- The in-page reader functions are tested only live; the unit tests cover the pure halves.
- The topology does not install per-action boundary screenshots (`installRuntimeActionEvidence`). `exposeBinding` can be registered only once per page, and evidence is per journey, so a forwarding recorder is needed.
- No full test suites were run, as the brief required.

## Open questions or contradictions found

1. **Core defect: a review returns an adaptation without its audit trail.**
   - `getFlowAdaptation` attaches `auditEvents`/`auditTotal` (`runtime/service.ts` ~3561-3562).
   - The typed review path (`reviewTypedFlowAdaptation`, ~4775-4802) returns `adaptationFromTypedStoreDetail(await store.setAdaptationStatus(...))`, and likewise for apply and revert, without them.
   - The Adaptations view shows that review result, so its Audit tab reads "0 events" after every Approve, Apply, Revert or Reject until the adaptation is reopened. Measured 4 of 4 in each of the last two runs.
   - The fix is in Core: attach `store.listAuditEvents` in the review path, or re-read through `getFlowAdaptation`. It needs a Core task, and `service.ts` is ratcheted.
2. **The shared `basic-form` oracle proves nothing.**
   - `demo-workspace/panel-run.ts::waitForSubmittedDemoPage` and `workspace-lanes.ts::recordDemoWorkspace` wait on `getByTestId("result").filter({ hasText: "Submitted" })`.
   - Playwright's string `hasText` is a case-insensitive substring match, so the fixture's initial "Not submitted" satisfies it. Measured on a freshly reset fixture in run `…230559-14c1`.
   - So the "visible Submitted" oracle in `demo:run` and `panel:golden` does not measure the page. Use exact text, or the Lab's `submissionCount` (now `UiE2eTopology.scenarioState`).
   - Not my file; not changed.
3. **Scenario Lab state is server-side and survives across journeys in a kept topology.** A submission made while recording already satisfies the next run's oracle unless the journey calls `resetScenarios()`. The journeys and suite owners must do this.
4. **Run-response flake, 1 of 6 runs.**
   - In `…231827-69fa`, the panel's `run-runtime-session` response was not observed within 60 s. Core finished the run 10 s after the click.
   - Two cause candidates, neither established:
     - a network-level failure of the execute request, consistent with the button having returned to "Run";
     - a response that arrived late.
   - Runs 5 and 6 with `request`/`requestfailed` tracing saw one request, one 200 response, and no failures.
   - Click-to-response was 40.3 s under load in run 5, so the shared driver's 60 s bound has little margin on a busy machine.
5. **"An existing adaptation".** No provider-free path creates one, so I seeded fixtures through Core's own validator while Core was stopped. The P2 journey will supply a model-authored one. In run 4's screenshot, the hierarchy's Adaptations folder showed a "recording-pr…" item that `list-flow-adaptations` does not return. I did not investigate it.
6. **P2's diff assertion.** A typed-store apply records no `metadata.applicationRecord.mutations`, so the planned "Changed fields" table is the only before/after the panel shows.
7. **Long paths.** Run roots under the worktree's `test-runs` produce Core artifact paths over 260 characters; `git status` warns "Filename too long". Core itself was unaffected. A short `FLUXIQ_TEST_RUNS_DIR` avoids this.
