# Live Activity And Extension Chat

Status: Active
Status detail: Every phase is implemented and checked in both trees (2026-09-29); the browser proof passes to the live lane's next run.
Created: 2026-09-29
Last updated: 2026-09-29
Owner: Senior supervisor agent (lane lead t185)
Scope: Show what FluxIQ is actually doing, live, on the page it is automating and in the extension's panel: a typed, bounded Core activity stream pushed over the client gateway, an on-page shadow-root status overlay, the extension chat window sharing Core's conversation, and the Lab opening the panel beside the page. It does not change the build loop, the recovery ladder or LLM call grants.
Paired document: none — Core's side is the `server.activity` contract in `packages/contracts/src/client-gateway.ts`, recorded here; a Core-side document is owed if the stream grows beyond this lane.
Related: [fluxiq-conversations-plan.md](./fluxiq-conversations-plan.md), [automated-testing-facility-plan.md](./automated-testing-facility-plan.md)

---

## Current State

**Direction (user, 2026-09-29).** "Show FluxIQ thinking/doing stuff in real
time on the page it's doing stuff on":

1. An overlay injected into the automated page, in a shadow root, that shows
   the current status. Every status comes from a real Core event, never from a
   guess or a timer.
2. The extension gets the same chat window as the Core panel: a status header,
   a streamed message stream, and tool/step rows that expand into detail. The
   person can type instructions.
3. In Lab runs, Chromium shows the panel beside the page.

**Audit findings** are under [Audit Findings](#audit-findings).

**Decisions.**

- **D1. Wire contract.**
  - `server.activity` carries `ClientGatewayActivity`, a status plus an
    optional detail row. It is typed in `@fluxiq/contracts/client-gateway`.
  - Core sends it only to ready sessions that advertised
    `CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID = "fluxiq.activity"` and whose
    project matches.
  - It is sent without entering `outbound`, and dropped if the socket is
    closed.
  - Seeded 2026-09-29 by the lane lead.
- **D2. Activity is ephemeral, not a conversation turn.** The thread stays
  the durable record. The chat interleaves thread turns with live activity
  rows. A later reader of the thread sees Core's own `say` turns, not every
  tool call.
- **D3. Emission without threading parameters.**
  - Core's `runtime/activity/` owns a hub (publish, subscribe, per-project
    snapshot of the latest event and recent events) and an
    `AsyncLocalStorage` scope that the build or run entry sets.
  - Emission sites call `emitAutomationStudioActivity(...)`, which is a no-op
    outside a scope.
  - Restricted directories (`runtime/llm/**`, `flow-bootstrap/**`,
    `recovery/**`) only gain emission calls or input wrappers at call sites.
- **D4. Redaction.** Labels are Core's own sentences plus tool ids, node ids
  and authored step labels, which the panel already shows. No observed target
  content, model output text, tokens or secrets. Strings are truncated
  (label 160, title 160, text 1,000).
- **D5. The overlay never takes input.**
  - Every element is `pointer-events: none`. Hit-testing
    (`elementFromPoint`) skips it, so the page and the automation's own
    clicks are untouched.
  - It is collapsed, expanded or hidden from the panel, not from the page.
  - The host carries a FluxIQ marker, so recording, snapshots, evidence and
    interference checks exclude it. Its shadow root is closed.
- **D6. The chat panel replaces Simple Mode's conversation card** and reuses
  its controller and Core-thread readers. An activity push triggers a thread
  re-read; the 4 s poll stays as a fallback.
- **D7. The Lab opens the real side panel.** It uses a trusted Playwright
  click in the extension control page that calls
  `chrome.sidePanel.open({ tabId })`. The fallback is a popup window docked
  beside the scenario window. It is on by default for headed runs, and
  `--no-live-panel` turns it off.

- **D8. `get-activity` is the Core panel's endpoint only (lead, 2026-09-29).**
  It is not in `PAIRED_CLIENT_ENDPOINTS`. The extension is pushed
  `server.activity`, which Core filters by the session's project. A token read
  would let a paired client name any project id, and nothing consumes it.

**Done.**

- P1: the audit, this plan, and the wire contract.
- P2:
  - C1: the gateway push.
  - C2: the activity hub and its emission sites.
  - C3: `get-activity` and the Core chat's activity header and rows.
  - E1: the background relay.
  - E2: the on-page overlay.
  - E3: `panel/chat/`, which replaces Simple Mode's conversation card.
  - E4: `browser-session/live-panel/` and `--no-live-panel`.
  - Each has a report under `live-activity-chat-plan/reports/`.
- P3: `programs/_shared/runtime.ts:84` subscribes the hub to
  `clientGateway.publishActivity`.
- Lead edits:
  - D8.
  - The Core chat styles in `styles/conversation/01-thread.css`.
  - Core's `createdAt` carried into the extension chat's timeline.
  - The `cli.ts` pass-through for `--no-live-panel`.
  - Docs: `extension-client.md` and `testing-facility.md`.
- Validation: checks green under a build slot. The commands and their output
  are in the ledger and the lane report.

**Not done.** P4 browser proof.
- The lead's slot-2 run did not start. Its first attempt was refused because
  Core's dist was stale. Core was rebuilt (`pnpm --filter fluxiq build`,
  EXIT=0). Free RAM was 3.75 GB by then, below the 4 GB floor, so the run was
  skipped.
- The supervisor hands the proof to the live lane's next run.

**Next: what the live lane's next run must confirm** (any of the ten
scenarios):
1. **Live panel.**
   - stderr has `[lab] live panel: side-panel ...` or `popup ...`.
   - The bundle's `snapshots/live-panel.json` names the same mode.
   - The panel is on screen beside the page.
   - Pairing and `activateScenarioTab` still pass: the extension's
     `activeTabUrl` is the scenario URL, never `chrome-extension://`.
2. **Overlay from real events.** `<fluxiq-activity-overlay>` appears in the
   scenario tab's top frame. Its phase and "Step N of M" follow Core's own
   emissions:
   - `thinking` and `exploring` during a build;
   - `running` per node;
   - `done` or `failed` at settle.
   It must not appear before Core's first event, and it must never show a
   status Core did not send.
3. **No interference** (`isExtensionUiNode`, `data-fluxiq-activity`). None of
   the following contains the host, its marker or its label text:
   - a DOM snapshot;
   - an evidence blocker (`evidence/overlays.ts`);
   - an interference sentence (`covering-layer.ts`, `interference/overlays.ts`);
   - a recorded `dom.mutation`.
   No action is refused or misdirected at the bottom-right corner.
4. **Chat.** The panel chat's header follows the phases. Tool and step rows
   appear and expand. Core's turns interleave by time. A typed instruction
   reaches Core's thread.
5. **Core.** The `server.activity` pushes cause no gateway errors, and no
   session `outbound` grows from them.

**Blockers:** none.

---

## Audit Findings

(2026-09-29) Full detail is in
[the lane report](./live-activity-chat-plan/reports/t185-live-activity-chat.md).

- Core has no push path to any browser today. Its panel polls
  (`conversation/thread/poller.ts`). The extension's conversation card polls
  Core over HTTP every 4 s through the background
  (`background/panel/conversation-relay.ts`).
- The gateway can send to one session
  (`client-gateway/service/transport.ts`). The session's `outbound` queue has
  no bound, so a stream must not go through it.
- `FLUXIQ_BUILD_PROGRESS_TRACE` exists only as uncommitted work in t174. The
  real seams in t185 are:
  - the evidence loop's `decide`, `executeTool` and `checkCompletion`, wrapped
    at the caller in `runtime/service.ts` because `llm/evidence-loop.ts` is at
    exactly 800 lines;
  - the graph executor's per-attempt loop (`executor/graph-run.ts`) and the
    `onRecordBatch` hook;
  - parking and asks;
  - result verification and refuted-result repair.
- Core's `runtime/service.ts` is frozen at 4,558 lines in the baseline, with
  11 lines of headroom. The `web-vocabulary` rule forbids web words in Core
  contracts.
- The extension already has a shadow-root on-page UI to copy:
  `content/picker/overlay.ts`. It is `pointer-events: none`, styled through
  the CSSOM, and uses no `innerHTML`. `isPickerHostNode` keeps it out of
  recordings, but snapshots, evidence and interference checks do not exclude
  it.
- The Lab opens `sidepanel/index.html` as an ordinary tab. Nothing calls
  `chrome.sidePanel.open`.

## Phases

| Phase | Owner | What |
| --- | --- | --- |
| P1 | lane lead | Contract seed (done) |
| P2 | C1 `core-gateway-activity` | `ClientGatewayService.publishActivity`, capability and project filter, queue bypass; typed `activity` client event |
| P2 | C2 `core-activity-hub` | `runtime/activity/**` hub, scope, emitter, evidence-loop observer; emission call sites |
| P2 | E1 `ext-background-activity` | `background/activity/**`, `server.activity` routing, panel read/overlay messages, capability advert, docs |
| P2 | E2 `ext-activity-overlay` | `content/activity-overlay/**`, handler branch, exclusion marker, content spec |
| P2 | E3 `ext-chat-panel` | `panel/chat/**`, wiring into Simple Mode, tests, panel spec |
| P2 | E4 `lab-live-panel` | Lab opens the side panel beside the page |
| P3 | lane lead | Wire hub to gateway in `programs/_shared/runtime.ts` |
| P3 | C3 `core-activity-endpoint` | `get-activity` endpoint (paired-client allowed) and the Core chat window's status header and activity rows |
| P4 | lane lead | Integrated checks, headed Lab run in slot-2, report |

## Phase-to-event map

| Phase | Real Core event |
| --- | --- |
| thinking | evidence-loop `decide` started |
| exploring | a domain tool call started (non-draft tool); recovery exploration |
| building | build started; draft amendment tool call |
| verifying | completion check; result verification or judgement started |
| running | graph executor about to execute node N |
| extracting | a record output batch stored |
| repairing | recovery ladder rung; refuted-result repair |
| waiting_permission | a run or build parked on an ask |
| done / failed | build or run settled |

## Risks

- `service.ts` headroom is 11 lines, and other lanes (t174, t186) may spend
  it. C2 may use at most 6 net lines there.
- The t174 wrapper lives at `llm/evidence-loop.ts:171`. This lane wraps at the
  caller instead, so the two do not conflict.
- The overlay could leak into snapshots or evidence. D5's marker and the
  content spec guard this.
- `chrome.sidePanel.open` needs user activation. A Playwright click provides
  it. If Chromium refuses, the docked window is the fallback, and the report
  says which mode ran.
- Only one live Lab run may run at a time. Runs happen in slot-2 only, and
  only while free RAM is above 4 GB.

## Validation

- `tsc` in both repositories.
- Focused tests with `--minWorkers=1 --maxWorkers=2`.
- `pnpm --filter @fluxiq-web-extension/extension build`.
- `pnpm test:content` overlay spec (shadow isolation, no click interception,
  recorder ignores it).
- Panel spec.
- `pnpm structure:check` in both repositories.
- One headed, provider-free Lab run in slot-2, with screenshots of the panel
  beside the page and the overlay.

---

## Worker Briefs

Shared rules for every brief:

- Contract types:
  - Core `ClientGatewayActivity` in `packages/contracts/src/client-gateway.ts`
    (built).
  - Extension `apps/extension/src/shared/activity/`. Read it; do not edit it.
- Tests run with `--minWorkers=1 --maxWorkers=2`.
- No live provider runs and no Lab runs.
- Core tree: `C:\Users\osrs_\FluxStuff\fxwork\t185\!FluxIQ`. Extension tree:
  `C:\Users\osrs_\FluxStuff\fxwork\t185\!FluxIQWebExtension`.
- Reports land in `docs/working/live-activity-chat-plan/reports/<label>.md`
  in the extension tree, including for Core workers.

### Brief: core-gateway-activity (C1)
- Repository: FluxIQ Core
- Task: Let Core push `server.activity` to paired clients.
  - Add `ClientGatewayService.publishActivity(activity: ClientGatewayActivity, target: { projectId: string }): number`. It returns how many sessions it sent to.
  - Target sessions: `status === "ready"`, capabilities include `CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID`, and `session.projectId` equals `target.projectId` or is null/undefined.
  - Send straight to the socket, never through `session.outbound`. A failed send is dropped with a `/* best-effort: <reason> */` comment, never thrown.
  - Client package: add a typed `{ type: "activity"; message }` event to `FluxIQClientGatewayWebSocketEvent` and emit it in `handleServerMessage`.
- Required reads: this document's Current State; `packages/fluxiq/src/client-gateway/service.ts`, `service/{commands,transport,sessions}.ts`; `packages/client-gateway-websocket/src/{transport,types}.ts`.
- Owns (may edit): `packages/fluxiq/src/client-gateway/**`, `packages/client-gateway-websocket/src/{transport,types}.ts` and `src/tests/**`.
- Must not touch: `packages/contracts/**`, `client-gateway-websocket/src/index.ts`, `programs/**`.
- Definition of done:
  - Tests cover capability filtering, project filtering, the queue bypass, a closed socket, and the typed client event.
  - `pnpm --filter fluxiq exec vitest run src/client-gateway --minWorkers=1 --maxWorkers=2` passes.
  - The client-gateway-websocket tests pass, `pnpm --filter fluxiq check` passes, and `pnpm structure:check` passes.
  - Rebuild `client-gateway-websocket` dist.
- Report to: docs/working/live-activity-chat-plan/reports/core-gateway-activity.md

### Brief: core-activity-hub (C2)
- Repository: FluxIQ Core
- Task: Build `packages/fluxiq/src/programs/automation-studio/runtime/activity/`, with one export per file, an `index.ts` barrel and `tests/`, re-exported from `runtime/index.ts`. It holds:
  - `AutomationStudioActivityHub`:
    - `publish(event)`, which assigns `sequence` and `at` and truncates per D4;
    - `subscribe(listener)`, which returns an unsubscribe function;
    - `snapshot(projectId)`, which returns `{ current, recent }`, with `recent` capped at 60.
  - A process-wide default hub.
  - `runWithAutomationStudioActivity(scope, fn)` (AsyncLocalStorage; scope `{ kind: "build"|"run", id, projectId, flowId?, conversationId? }`).
  - `emitAutomationStudioActivity({ phase, label, step?, detail?, final? })`, a no-op outside a scope.
  - `observeAutomationStudioEvidenceLoop(input)`, which wraps `decide`/`executeTool`/`checkCompletion` and emits:
    - thinking, on decide;
    - building, for the draft tool `AUTOMATION_STUDIO_FLOW_DRAFT_TOOL_ID`;
    - exploring, for every other tool (tool id as `detail.ref`, result code on end);
    - verifying, on the completion check.
    It must rethrow and never change results.
- Emission call sites, each listed in your report with file:line:
  - `service.ts` (at most 6 net lines):
    - wrap the public `generateFlowBootstrapAdaptation` body in a build scope, emitting building at start and done/failed at settle;
    - wrap the `runAutomationStudioLlmEvidenceLoop({...})` input at about L1582 with the observer;
    - wrap the graph run in a run scope, emitting running at start and done/failed/waiting_permission at settle.
  - `executor/graph-run.ts`: running "Running step N of M: <node label>" before each node execute, where M is the flow's executable node count (say "step N" plainly when a loop makes N > M); waiting_permission when it parks; repairing when a recovery rung starts.
  - `executor/node-execution.ts`: extracting after a record batch is stored (row count only).
  - `recovery/runtime-exploration.ts`: wrap its loop input with the observer.
  - `result-verification/**`: verifying when the judge starts.
  - `recovery/refuted-result/**`: repairing.
- Required reads: this document's Current State and "Phase-to-event map"; the files above.
- Owns (may edit): `runtime/activity/**`, `runtime/index.ts` (one export line), plus emission-only edits in the files listed above.
- Must not touch: `packages/contracts/**`, `client-gateway/**`, `programs/_shared/**`, `apps/web/**`, `llm/evidence-loop.ts`.
- Definition of done:
  - Unit tests for the hub, scope, truncation and observer.
  - Existing executor and service tests still pass: `pnpm --filter fluxiq exec vitest run <dirs> --minWorkers=1 --maxWorkers=2`.
  - `pnpm --filter fluxiq check` and `pnpm structure:check` pass, with no baseline growth.
- Report to: docs/working/live-activity-chat-plan/reports/core-activity-hub.md

### Brief: ext-background-activity (E1)
- Repository: this repository
- Task: The background receives and fans out activity.
  - `apps/extension/src/background/activity/`: an `ActivityRelay` holding `ExtensionActivityState`:
    - drop events with sequence <= last;
    - `recent` capped at `ACTIVITY_RECENT_LIMIT`;
    - overlay preference persisted in `chrome.storage.local`, default "expanded".
  - On each event:
    - broadcast `{ type: ACTIVITY_MESSAGES.changed, state }` to the panel pages;
    - send `ActivityContentMessage` to the automation's tab (`connection` `page.tabId()`), top frame, via `ensureContentScript` + `sendToTab`. Failures are best-effort.
  - When a top frame reports `contentReady` on that tab, re-send the current state.
  - Route `server.activity` in `connection/server-command-channel.ts`.
  - Answer `ACTIVITY_MESSAGES.read` / `setOverlay` from control pages only (`background/panel/panel-control.ts`).
  - Advertise `{ id: "fluxiq.activity", kind: "custom" }` in `domain/src/runtime/capabilities.ts`, and update the domain test.
  - Update the "Wire Shape" section of `docs/architecture/extension-client.md`.
- Required reads: this document's Current State; `shared/activity/`; `background/connection.ts`, `connection/server-command-channel.ts`, `panel/panel-control.ts`, `tabs.ts`, `index.ts`.
- Owns (may edit): `apps/extension/src/background/**`, `domain/src/runtime/capabilities.ts`, the domain capability tests, `docs/architecture/extension-client.md`.
- Must not touch: `apps/extension/src/{content,panel,shared}/**`.
- Definition of done:
  - Unit tests for the relay and routing pass (`pnpm --filter @fluxiq-web-extension/extension test`), and the domain tests pass.
  - `pnpm --filter @fluxiq-web-extension/extension check` passes, and `pnpm structure:check` passes.
- Report to: docs/working/live-activity-chat-plan/reports/ext-background-activity.md

### Brief: ext-activity-overlay (E2)
- Repository: this repository
- Task: `apps/extension/src/content/activity-overlay/` shows the current `ActivityContentMessage` on the page.
  - Host element on `document.documentElement`: `position: fixed`, bottom-right, max z-index, `pointer-events: none` on the host and on every descendant.
  - A closed shadow root, styles through the CSSOM (copy `content/picker/overlay.ts`), and no `innerHTML`.
  - Expanded: phase icon and colour, label, "step N of M", and the latest detail title.
  - Collapsed: a small pill with the phase. Hidden or null: removed.
  - `final` events fade after 6 s. That fade is a display timer only; the status itself only ever comes from an event.
  - Handle `ACTIVITY_MESSAGES.content` in `content/message-handler.ts`, top frame only.
  - Mark the host so that the recorder (`picker-host.ts` `isPickerHostNode`, which you may generalise), snapshots, evidence and interference (`action-runtime/interference/covering-layer.ts`) all ignore it.
  - Content spec `e2e/content/tests/activity-overlay.spec.ts` proving:
    - page CSS (`* { all: unset }`, `div { display: none }`) does not change the overlay;
    - `elementFromPoint` under the overlay returns the page element;
    - a real Playwright click at the overlay's position reaches the page button;
    - the recorder emits no mutation for the overlay;
    - a snapshot does not include it.
- Required reads: this document's Current State; `shared/activity/`; `content/picker/overlay.ts`, `content/picker-host.ts`, `content/message-handler.ts`; `e2e/content/harness.ts`, `runtime-stub.ts`.
- Owns (may edit): `apps/extension/src/content/**`, `apps/extension/e2e/content/**`.
- Must not touch: `background/**`, `panel/**`, `shared/**`.
- Definition of done:
  - Unit tests pass.
  - `pnpm --filter @fluxiq-web-extension/extension test:content -- activity-overlay` passes, and the existing recorder, evidence and interference content specs still pass (at most 2 workers).
  - The extension check passes.
- Report to: docs/working/live-activity-chat-plan/reports/ext-activity-overlay.md

### Brief: ext-chat-panel (E3)
- Repository: this repository
- Task: `apps/extension/src/panel/chat/` is an automation chat window, built with vanilla DOM and `createElement` like the rest of the panel.
  - A status header: the phase chip and label from `ExtensionActivityState.current`, a live/offline dot, and overlay controls (expanded/collapsed/hidden) that send `ACTIVITY_MESSAGES.setOverlay`.
  - A message stream interleaving Core thread turns with activity rows by time. Rows with `detail` are `<details>` that expand to text, ref and status. Asks are answered through the existing ask controls.
  - A composer that sends instructions through the existing `panelConversationSend`.
  - Read the state via `ACTIVITY_MESSAGES.read` and subscribe to `ACTIVITY_MESSAGES.changed`. Tolerate "Unknown FluxIQ extension message." as offline.
  - On a new sequence carrying a `conversationId`, or on `final`, refresh the thread (debounced 300 ms). Keep the 4 s poll.
  - Reuse `panel/simple/conversation/{controller,core-thread,composer,turn,ask-controls}.ts` and do not duplicate them.
  - Replace the conversation card in `panel/simple/simple-view.ts`. Follow the tokens in `panel/theme/tokens.css`, light and dark.
- Required reads: this document's Current State; `shared/activity/`; the `panel/simple/conversation/*` files; `simple-view.ts`; `panel/state/store.ts`.
- Owns (may edit): `apps/extension/src/panel/chat/**`, `panel/simple/simple-view.ts`, `panel/simple/simple.css`, `panel/simple/conversation/index.ts` (exports only).
- Must not touch: `background/**`, `content/**`, `shared/**`, the other `panel/simple/conversation/*` files.
- Definition of done:
  - Node unit tests (no browser) for the stream view-model (merge, ordering, bounds, expansion data) and the header/overlay-control state.
  - `pnpm --filter @fluxiq-web-extension/extension check`, `test` and `build` pass.
  - No Playwright or browser runs (user rule 2026-09-29: browser runs only on the ten realistic scenarios, in the live lane).
- Report to: docs/working/live-activity-chat-plan/reports/ext-chat-panel.md

### Brief: lab-live-panel (E4)
- Repository: this repository
- Task: In headed Lab runs, show the extension panel beside the page.
  - Add `packages/test-runner/src/run-scenario/browser-session/open-live-panel.ts`. It:
    - injects a button into the extension control page;
    - clicks it with Playwright (a trusted gesture), which runs `chrome.sidePanel.open({ tabId: <scenario tab> })`, and verifies the panel opened (for example, a new `sidepanel/index.html` target, or `chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL"] })`);
    - on refusal, falls back to `chrome.windows.create({ url: sidepanel, type: "popup" })` docked right of the browser window;
    - returns which mode ran.
  - Give the headed window room with `--window-size=1700,1000`.
  - Wire it into `run-scenario.ts` after the scenario page opens (before `activateScenarioTab`, which must still pass) and into `interactive-session.ts`. Add `--no-live-panel` to the CLI (`commands.ts`).
  - Record the mode in the run's evidence or logs.
- Required reads: this document's Current State; the `browser-session/*` files; `run-scenario.ts` around L259-273 and L673; `interactive-session.ts` around L229; `commands.ts`.
- Owns (may edit): `packages/test-runner/src/run-scenario/browser-session/**`, `run-scenario.ts`, `interactive-session.ts`, `commands.ts`, the related `tests/`.
- Must not touch: `apps/extension/**`.
- Definition of done:
  - Unit tests for the mode choice and argument parsing pass: `pnpm --filter @fluxiq-web-extension/test-runner test`, filtered to the new tests if the full suite is heavy.
  - `check` passes.
  - Do not start a Lab or browser run (user rule 2026-09-29). The live lane t174 captures the visual proof on a realistic scenario.
- Report to: docs/working/live-activity-chat-plan/reports/lab-live-panel.md

### Brief: core-activity-endpoint (C3)
- Repository: FluxIQ Core
- Task: Let the Core panel, and a paired extension, read the live activity, and show it in Core's own chat window.
  - Add a `get-activity` endpoint to Automation Studio's API.
    - Request: `{ projectId }`, classification `read`.
    - Response: `automationStudioActivityHub.snapshot(projectId)` (`{ current, recent }`, from `runtime/activity/`).
    - Add it to `PAIRED_CLIENT_ENDPOINTS["automation-studio"]` in `apps/web/src/lib/program-route.ts`.
  - In `apps/web/src/features/automation-studio/conversation/**`, add an activity status header (phase chip and label, "step N of M") and live activity rows interleaved with turns.
    - Rows with a detail expand to text, ref and status.
    - Read it through the existing backoff poller: fast while the current event is not `final`, otherwise the normal cadence.
    - Keep the view awake while visible (a view containing `setInterval` fails a source-text test; use the poller).
    - Follow the existing conversation component style.
- Required reads: this document's Current State; `packages/fluxiq/src/programs/automation-studio/runtime/activity/index.ts` and `contracts.ts`; `api/contracts/endpoints.ts`, `api/contracts/conversation.ts`, `api/handlers/conversations.ts` (the pattern to copy); `apps/web/src/lib/program-route.ts`; `apps/web/src/features/automation-studio/conversation/` (`useConversationThread.ts`, `thread/poller.ts`).
- Owns (may edit):
  - new `api/contracts/activity.ts` and `api/handlers/activity.ts`, plus one registration line each in the contracts and handlers barrels and in `endpoints.ts`;
  - `apps/web/src/lib/program-route.ts` (the allow-list entry only);
  - `apps/web/src/features/automation-studio/conversation/**`, and their tests.
- Must not touch: `runtime/**`, `client-gateway/**`, `packages/contracts/**`, `programs/_shared/**`.
- Definition of done:
  - A handler test and web unit tests pass (vitest, `--minWorkers=1 --maxWorkers=2`).
  - `pnpm --filter fluxiq check` and `pnpm --filter @fluxiq/web check` pass.
  - `pnpm structure:check` passes.
  - No browser runs.
- Report to: docs/working/live-activity-chat-plan/reports/core-activity-endpoint.md

---

## Work Ledger

### 2026-09-29 — Audit and contract seed
- Agent: lane lead t185
- Changed: Core `packages/contracts/src/client-gateway.ts`,
  `packages/client-gateway-websocket/src/index.ts`; extension
  `apps/extension/src/shared/activity/*`; this plan.
- Why: Parallel workers need one fixed contract before dispatch.
- Validation: `pnpm --filter @fluxiq/contracts build` and `check` -> no
  errors; `grep -c server.activity dist/client-gateway.d.ts` -> 2;
  client-gateway-websocket `pnpm build` -> no errors; extension
  `tsc -p tsconfig.json --noEmit` -> no output.
- Outcome: Accepted
- Follow-up: dispatch P2.

### 2026-09-29 — P2 (E3, E4, C3), lead integration and checks
- Agent: lane lead t185, with workers ext-chat-panel, lab-live-panel and
  core-activity-endpoint.
- Changed:
  - Core: `api/{contracts,handlers}/activity.ts` and their registration;
    `apps/web/.../conversation/**`; `styles/conversation/01-thread.css`.
  - Extension: `apps/extension/src/panel/chat/**`; `panel/simple/simple-view.ts`
    and `simple.css`; `conversation/{index,core-thread}.ts`, with `card.ts`
    removed; `packages/test-runner/src/{cli,commands,run-scenario,interactive-session}.ts`;
    `browser-session/live-panel/**`; two architecture docs.
- Why: the chat, the Lab live panel, and the Core panel's activity. D8.
- Validation: one `heavy.sh` slot ran every command below, with the observed
  result after each arrow.
  - Core:
    - `pnpm --filter fluxiq check` -> EXIT=0.
    - `pnpm --filter @fluxiq/web check` -> EXIT=0.
    - `node scripts/structure-audit.mjs` -> "passed (197 warning(s), 355
      baselined)".
  - Extension:
    - `check` -> EXIT=0.
    - `EXTENSION_TEST_BUILD_LABEL=t185-lead ... test` -> `# tests 1213`,
      `# pass 1213`, `# fail 0`.
    - `build` -> EXIT=0.
  - test-runner:
    - `pnpm build` -> EXIT=0.
    - `pnpm check` -> EXIT=0.
    - The live-panel and commands tests -> `# tests 45`, `# pass 45`.
  - Core web `conversation-activity.test.tsx` -> 7 passed, after one fixture
    label was fixed.
- Outcome: Accepted
- Follow-up: the browser proof passes to the live lane. Current State lists
  what that run must confirm.

---

## Open Questions

- Should activity also be persisted per run, for replay after the fact? Not in
  this lane (D2). Owner: senior supervisor agent.
