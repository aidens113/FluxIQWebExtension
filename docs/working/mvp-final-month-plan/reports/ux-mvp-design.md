# ux-mvp-design

Worker report, 2026-10-05. Brief `ux-mvp-design` in `../../mvp-final-month-plan.md`.
Read-only: no build, test, Lab, browser, panel or provider call. This report is the only file written.
Source read on extension `dev` (`13bf7450` era, t263 merged) and Core `dev` `3c47ed7d`.

## Outcome

**Done.** Each Phase 4 unit has a design, a file partition, tests and a live check below, followed by a build order.
Four findings change the plan's assumptions:

1. **No Stop button exists in the panel.** The background handler (`background/panel/run-control.ts`) and Core's
   `cancel-runtime-session` (registered and on the paired-token allowlist) both work. But the only control that sent
   `fluxiq.panel.stopRun` was Simple Mode's "Right now" card (`panel/simple/now-card.ts`, `#stopRunButton`), which was
   deleted with Simple Mode in `47ba62dc` (2026-09-30). `grep` over `apps/extension/src/panel` finds no sender.
   The gap map's "Stop implemented" is true only of the background. There is also **no way to stop a build** in Core
   at all. A build's abort signal comes only from the permission gate and the person-needed wrapper
   (`service.ts:1575`).
2. **Core already has step-boundary pause, takeover and resume** (`runtime/run-control/`, commit `f7e99a7a`):
   `pause-runtime-session {takeControl}`, `resume-runtime-session {afterManualAction}` and `get-runtime-run-control`.
   The executor holds at `graph-run.ts:389` before the next node. Holds are bounded at 15 minutes. The web panel's
   `FlowRunView` uses these endpoints. Three things are missing: the endpoints are **not on the paired-token allowlist**
   (`apps/web/src/lib/program-route.ts:62`); Core **emits no activity** when a run holds or resumes; and the extension
   has no relay and no UI for them. Take over and hand back should be built on run-control, not on conversation parking.
3. **"Learned something" is half there.** The Automations row already prints "Learned N new page variation(s)",
   "Future runs updated", "Checking the change..." and "The change didn't hold up..."
   (`panel/automations/summary-copy.ts`, `facts.ts`). The chat says nothing. Core's chat `run.execute` answer is
   "The run <raw run id> ended succeeded." (`conversations/commands/run-flow.ts:46`), which shows an id and nothing
   learned.
4. **All t224 source is already on `dev`** in both repositories: the merge-base checks passed for extension `3a55a8b1`,
   `28ee7f6a`, `1884e5e2`, `da6477b5` and Core `c4683b61`, `e05597bb`. Only the doc commits `8f4071db` / `73bbdb57`
   are not. The "held units" are plans with no code, and each was re-checked against current source below.

## What changed and why

Only this report was written.

---

### Unit 1 — Onboarding after connect (item 2, phase 4.2)

**Today.** `panel/getting-started/start-steps.ts` is connection-only (Open, Connect, Approve). Once connected, the
chat's empty state (`panel/chat/view/empty-state-model.ts`) shows "What can FluxIQ do for you?" with three example
prompts that fill the composer. The prompts are a scrape, a monitor and a form-fill. There is no concept message and
no Extract start in the chat. Extraction is only under Automations > "New automation" (`panel/recording/recording-controls.ts:60`).
The `modelReadiness` relay exists (`background/automation-relay/automation-relay.ts:110`, which calls `secret-keys snapshot`),
but nothing in the panel calls it. A person with no unlocked model key types a request and only then learns it cannot build.

**Design.** No new screen. The connected chat's empty "latest" thread becomes the onboarding:

- **Concept message (one paragraph, in the empty state):** "FluxIQ turns a job you describe on a website into an
  automation you can run again. The first time, it works the job out on this page with AI and shows each step here.
  After that it repeats the saved steps without AI, and if the site changes it fixes the step, checks the fix and
  remembers it. You can stop it, or take over the page, at any time." The last sentence depends on Unit 3; drop it if
  Unit 3 slips.
- **Two starts under it, as buttons:**
  - **Describe what you want.** It focuses the composer and keeps today's examples as fill-only chips. Sending goes
    `panelConversationSend` → background `conversation-relay.ts` → Core `open-conversation` + `append-turn`, carrying
    the capability ids (`flow.createHere`, `flow.describe`, `flow.explore`, `flow.improve`, `run.execute`, `ask.answer`)
    and `onScreen.pageUrl`. Core's interpreter picks `flow.createHere` (`conversations/commands/create-here.ts`),
    whose build calls `generate-flow-bootstrap-adaptation {evidenceGuided: true, startLocation}`
    (`commands/build.ts:36`).
  - **Extract data from this page.** It opens the existing extraction sheet: the proven, model-free picker path
    (t027/t032). Its Core traffic is the recording path: `client.start_recording` (`startRecordingIfIdle`), the
    picker's extraction event, `client.stop_recording`, then review in Automations: `generate-recording-proposal
    {mode: "direct"}`, test with `run-runtime-session`, and save with `review-recording-flow-proposal {decision: "approved"}`.
    The shell switches to the Automations tab and opens the sheet, because the sheet is mounted there. Moving the
    sheet into the chat is not MVP work.
- **Model-key line.** On mount of the connected empty chat, ask `modelReadiness`. If no key is `enabled`, show
  "FluxIQ needs a model key before it can build. Add one in FluxIQ." with the existing Open FluxIQ button. Extract
  stays available, because it needs no model.
- The message shows only while the latest thread is empty, so no first-run flag or storage is needed.

**Files (extension only; one unit, after t265 lands — t265 owns `panel/chat/**`):**
`panel/chat/view/empty-state-model.ts`, `panel/chat/view/empty-state.ts`, `panel/chat/chat-panel.ts` (an `onStart`
hook), new `panel/chat/onboarding/model-readiness.ts`, `panel/chat/chat.css`, `panel/shell/mount-panel.ts` (route
Extract to Automations and the sheet), `panel/recording/recording-controls.ts` (expose `openExtraction()`).
**Core:** none.

**Tests:** new `panel/chat/view/tests/empty-state-model.test.ts` (concept text, the two starts, and the key-missing
line by readiness); `panel/chat/tests/chat-panel.test.ts` (Describe focuses the composer and sends nothing);
`panel/shell/tests/mount-panel-navigation.test.ts` (Extract opens Automations with the sheet open, and
`#extraction*` ids are kept); a readiness test with a fake relay (no key, disabled key, relay failure → no line).

**Live check:** a fresh Lab profile and fresh pairing on a realistic scenario's start page. The headed UI review
confirms the concept message and both starts are visible after Approve. Describe → type the scenario prompt → the
build starts (the "Building your Flow" overlay). Extract → the sheet opens on the page and the picker arms. Time from
"Connect" to the first saved automation is recorded for 4.2's five-minute goal, and measured properly in Phase 6.
One run with the model key disabled shows the key line and makes no provider call.

---

### Unit 2 — Stop (item 10, 4.3)

**Today, end to end.**
- Extension: `fluxiq.panel.stopRun` → `background/panel/panel-control.ts:94` → `stopRun`
  (`background/panel/run-control.ts`). With a `runId`, it calls `cancel-runtime-session {projectId, runId, reason}`.
  Without one, it calls `list-runtime-sessions {summaries, limit 25}` and cancels every run whose status is not ended.
  The project comes from the paired session.
- Core: `api/handlers/runtime-execution.ts:31` registers `cancel-runtime-session` (`runtime.control`, `authoring`, no PIN).
  It is on `PAIRED_CLIENT_ENDPOINTS`. `service.cancelRuntimeSession` (`service.ts:2751`) goes through
  `parkedRunExpiry.cancel`, which also ends a durably parked run, and aborts the run's controller.
  The executor checks the signal at every step boundary (`graph-run.ts:384`, and `:457` after an attempt). A held run
  is let go as cancelled (`graph-run.ts:390-393`). `activity/run.ts` emits the final `phase: "failed"`,
  `label: "Run cancelled"`.
- **Gap 1: nothing in the panel sends it** (see Outcome 1).
- **Gap 2: builds cannot be stopped.** There is no Core endpoint. The build signal at `service.ts:1575` is
  `AbortSignal.any([creation.signal(permissions.signal), personNeeded.signal])`. The phases already end a cancelled
  build cleanly as `llm_evidence_loop.cancelled` (`flow-bootstrap/unfinished-build/phases.ts:423`). A build is where
  the money is spent.
- **Gap 3: the ending is not "stopped".** The headline maps every failed run to "Run failed"
  (`background/activity/headline.ts:43`). The Automations row already says "Stopped" for `cancelled`
  (`facts.ts` OUTCOMES).

**Design.**
- **Extension UI.** Add a Stop button on the chat's live line while a unit of work is running or waiting, and on the
  automation strip while that Flow runs. For `subject.kind === "run"` it sends `stopRun {runId: subject.id}`. The
  run's `subject.id` is the run id, bound by `bindAutomationStudioActivityRun`. For `subject.kind === "build"` it
  sends a new `fluxiq.panel.stopBuild {flowId: subject.flowId}`. The button is disabled while the request is in flight,
  and a second press is harmless: Core answers an ended run as it ended.
- **Core build cancel.** Add a new endpoint `cancel-flow-build {projectId, flowId, reason?}` (`runtime.control`,
  `authoring`). The service keeps `buildAbortControllers` keyed `${projectId}:${flowId}`, set and deleted around the
  build next to `service.ts:1575`, with the controller's signal added to that `AbortSignal.any`. A build that is not
  running answers `{ stopped: false }`, which is not an error. Add the endpoint to `PAIRED_CLIENT_ENDPOINTS`.
- **Ending words.** Add `stopped?: true` on the final activity event (contracts `ClientGatewayActivity`). Core sets it
  in `activity/run.ts` for `cancelled` and in `activity/build.ts` for a cancelled build. The headline then reads
  "Run stopped" or "Build stopped" instead of "failed". The alternative, matching Core's label text, is what
  the activity rules forbid.

**Files.**
- Core unit (one owner): `packages/contracts/src/client-gateway.ts` (`stopped`), `api/contracts/endpoints.ts`, new
  `api/handlers/build-control.ts` and its registration, `runtime/service.ts` (build controller map; **t264 owns
  `service.ts` — serial after t264**), `runtime/activity/run.ts`, `runtime/activity/build.ts`,
  `apps/web/src/lib/program-route.ts`, `docs/architecture/automation-studio/client-gateway.md`.
- Extension background unit: `background/panel/run-control.ts` (`stopBuild`), `background/panel/panel-control.ts`,
  `shared/constants.ts`, `shared/protocol.ts`, `background/activity/headline.ts`. **t265 owns
  `background/panel/**` and `background/activity/**` — serial after t265.**
- Extension UI: `panel/chat/view/live-line.ts`, `live-line-model.ts` (chat unit, shared with Units 1 and 3);
  `panel/automations/automation-strip.ts`, `controller.ts` (automations unit).

**Tests.** Core: new `api/handlers/tests/build-control.test.ts` (stops a running build, answers a non-running build,
refuses a missing id); `apps/web/src/lib/tests/program-route.test.ts` (the token may call `cancel-flow-build`); a
service test in which a build aborted mid-loop ends `llm_evidence_loop.cancelled` and the fake provider gets no further
call; an `activity/tests` case for `stopped: true`. Extension: `background/panel/tests/run-control.test.ts`
(`stopBuild`), `panel-control.test.ts` (routing, control pages only); a headline test ("Run stopped" / "Build stopped");
a live-line test (Stop is shown only while working, and sends the subject's id); `panel/automations/tests/automation-strip.test.ts`.

**Live check (two runs).**
(a) Run: start the A8 saved Flow from the Automations Run button and press Stop in the panel at step 2 or later.
Observe: no `server.execute_action` reaches the tab after the step in flight ends (Lab trace); the Core session is
`cancelled`; the overlay and live line say "Run stopped" and do not fade into "Run failed"; the row says "Stopped";
and there are zero provider calls after the press.
(b) Build: type a scenario prompt and press Stop after the first explained decision. Observe: no provider request in
`steps/` after the press except the one in flight; the build's ending in the chat says it was stopped; the spend
ledger stays at or below the pre-press spend plus one call.
The Lab needs a "press Stop in the panel at step N" person action (`packages/test-runner/src/person-simulation/`, new
file), since Stop must be pressed in the real panel.

---

### Unit 3 — Take over / hand back (item 10, 4.3, 4.10 step 12)

**Exists in Core.** `runtime/run-control/run-controller.ts` is one live run's hold. `pause({holder: "person"})`
records a request, and the run holds at the next `checkpoint` (`graph-run.ts:389`), before the next node. A click is
never cut in half. `resume({afterManualAction: true})` continues at the same node with its variables, loops and step
budget, and that node reads the page as the person left it. State routing (`graph-run.ts:540-560`) handles a page the
person moved on. The hold is bounded at 15 minutes (`AUTOMATION_STUDIO_RUN_CONTROL_MAX_PAUSED_MS`), after which the
run stops itself as cancelled. Stop while held lets the run go as cancelled. Every chat- or panel-started run with a
project opens a controller (`service.ts:2583`), so chat `run.execute` and the Automations Run are both covered.
The endpoints are in `api/handlers/run-control.ts`, with history (`pause_requested`, `paused`, `resumed`
`afterManualAction`) kept on the controller.

**Why not conversation parking.** Parking (`runtime/parking/`, the person-needed ask) parks a run on a *question the
run raised*, routes Continue down the node's `success` edge and Stop down `failed`
(`executor/person-needed.ts` header), and may serialise the run. A takeover is the person's initiative and must resume
at the *same* node, which is exactly what run-control does without serialising anything. The person-check card and
its Continue/Stop words stay as they are, as the model for the hand-back UI.

**Missing.**
1. `pause-runtime-session`, `resume-runtime-session` and `get-runtime-run-control` are not on `PAIRED_CLIENT_ENDPOINTS`.
2. No activity when a run holds or resumes. The overlay keeps the last "Running your Flow / Step N" and the chat shows
   nothing.
3. No extension relay or control.
4. Builds cannot be paused. This is out of scope per the plan's decision 3; a build gets Stop only.

**Design.**
- Core: add the three endpoints to the allowlist. In `graph-run.ts`, around the held checkpoint, emit one activity
  event when held and one when released, both inside the run's activity scope. The executor already imports
  `../activity` (`executor/resume.ts:2`). Add a phase `"paused"` to `ClientGatewayActivityPhase`
  (`packages/contracts/src/client-gateway.ts:122`) with labels "Paused: you have the page" and "Continuing from step N".
  The extension's `wording.ts` `Record<Phase, string>` then fails to compile until it handles the new phase, which is
  the intended mechanical check.
- Extension background: `pauseRun {runId, takeControl: true}` → `pause-runtime-session`;
  `resumeRun {runId, afterManualAction: true}` → `resume-runtime-session`. Headline for `paused`: "Paused: your turn
  on the page". It never fades, like a wait on the person. The toolbar badge shows "!" while paused or waiting, which
  matters in Firefox (Unit 7).
- Extension chat: the live line shows "Take over" beside Stop while a *run* works. While held it shows "You have the
  page. FluxIQ continues from step N when you hand back." with **Hand back** and Stop. The overlay stays input-free
  by design. Its detail line says "Open FluxIQ and press Hand back" in the popup case.

**Files.** Core unit, the same owner as Unit 2's Core part because both touch `program-route.ts` and the contracts:
`apps/web/src/lib/program-route.ts`, `packages/contracts/src/client-gateway.ts`, `runtime/executor/graph-run.ts`, the
Core web panel's activity wording for the new phase (`src/ui/activity-action/**` is **t264-owned**, so serial),
`client-gateway.md`. Extension background unit (Unit 2's): `background/panel/run-control.ts`, `panel-control.ts`,
`shared/constants.ts`, `shared/protocol.ts`, `background/activity/{headline,pacer,unit-situation}.ts`,
`shared/activity/wording.ts`, `background/panel/toolbar-badge.ts`. Extension chat unit: `panel/chat/view/live-line*.ts`.

**Tests.** Core: `program-route.test.ts` (three endpoints); new `runtime/executor/tests/run-control-activity.test.ts`
(a held run emits `paused` once and the resume event once, and nothing per poll); the existing
`api/handlers/tests/run-control.test.ts` stays green. Extension: `run-control.test.ts` (pause/resume relays,
`takeControl` and `afterManualAction` forwarded, only the named fields sent); headline/pacer tests for `paused`
(shown at once, no fade, cleared on resume); a live-line test (Take over only for runs, Hand back only while held);
a toolbar-badge test.

**Live check.** On `company-website-*` (the quote-request Flow), take over before the step that fills the form, have
the Lab person type one field on the page, then press Hand back. Observe: the run held at a node boundary, with no
`execute_action` during the hold; the overlay showed the paused headline for the whole hold; the run continued from the
held node and the scenario oracle held, including the person's field; the Core run's control history shows
`paused (person)` and `resumed afterManualAction`; zero provider calls during the hold. A second case: Stop while held
→ `cancelled`. This needs the same new Lab panel-press action as Unit 2.

---

### Unit 4 — "Learned something" in the chat and the Automations row (items 21-24)

**What Core exposes.** `run-runtime-session`'s answer (`api/handlers/runtime-execution.ts:87-96`) includes
`runSummary` (`interventionCount`, `adaptationCount`, `durableBehaviorChanged`), `createdAdaptationIds`,
`interventionCount` and `durableBehaviorChanged`. These are read after the run's judged settle, which happens inside
the run (`service.ts:2742`). t256 adds `judgedApplication {applied, notAppliedReason?}` to adaptation listing rows
(`service/adaptation-projections/listing-rows.ts:22`, `durable-behavior/judged-application.ts`): whether the patch
actually went into the Flow, or why it was held back.

**Today.** The Automations row's lines come from `facts.ts`, which reads adaptation `status` (`validated` / `applied`
/ dropped). They come only from the row's own Run (`runAutomation` reply) or `runDetail`. The chat has nothing. Core's
`run-flow.ts` answer shows a raw run id and "ended succeeded".

**Design.**
- Core `run-flow.ts`: replace the summary with person words built from the payload. "Done without AI." when
  `interventionCount === 0`. "Done. The page had changed, so FluxIQ fixed a step and checked the fix; future runs use
  it." when `durableBehaviorChanged`. "Done. FluxIQ needed AI N times; the fix is still being checked." when
  adaptations exist but none was applied. "Stopped." for `cancelled`. Carry no run id in the words; `progress.carry`
  already keeps it as data.
- Extension row: `replies.ts` reads `judgedApplication` from `list-flow-adaptations` rows when present. `facts.ts`:
  `applied: true` → `futureRunsUpdated`; `applied: false` → a new line "Held back: <reason in words>". Keep the
  status-based reading as the fallback.
- No new extension chat code: the chat shows Core's answer turn.

**Files.** Core (**`R/conversations/**` is t264-owned — serial after t264**):
`runtime/conversations/commands/run-flow.ts`, new `commands/tests/run-flow.test.ts`. Extension (automations unit):
`panel/automations/{replies,facts,summary-copy,types}.ts` and their tests.

**Tests.** `run-flow.test.ts`: each payload shape gives its sentence, and no `run-` id appears. Extension
`facts.test.ts` / `summary-copy.test.ts`: applied, held back with reason, and absent `judgedApplication` (old Core).

**Live check.** Inside Phase 2's chained proof: after the repaired-and-persisted run started from the chat, the
answer turn says the page changed and the fix is kept, and the Automations row says "Learned 1 new page variation" /
"Future runs updated". After the zero-call re-run, the row says "No AI needed" and the chat says "Done without AI."

---

### Unit 5 — Open in FluxIQ on the right Flow and its adaptation (items 25-26)

**Today (t219).** The strip's Open in FluxIQ sends `panelOpenFluxIQ` with the Flow id. The background
(`background/panel/open-fluxiq.ts:9-17`) builds `/programs/automation-studio?project=<session project>&flow=<id>`.
Core parses `project`, `flow`, `subflow`, `view` and `detail=<kind>:<id>` (`apps/web/src/features/automation-studio/navigation.ts:17-30`).
`useAutomationDeepLinkRuntime.ts` loads the Flow and opens the default view (router). **It folds `detail` into its key
but never acts on it** (lines 31-60), so a link to one adaptation opens only the Flow.

**Design.** Extension: `panelOpenFluxIQ` takes an optional `adaptationId`, validated as an id
(`^[A-Za-z0-9._:-]{1,128}$`) and URL-encoded. The background adds `view=adaptations&detail=adaptation:<id>`; the
project still comes only from the session. The strip shows a second link, "See what it learned", when the selected
automation's last run has adaptation ids (the controller already has them from `runDetail`). Core: when
`link.detail?.kind === "adaptation"`, open the `adaptations` view ("Suggested changes") for the Flow and select the
adaptation through the existing `useAdaptationWorkspaceNavigation` selection (`persistSelection`).

**Files.** Extension background unit: `background/panel/open-fluxiq.ts`, `background/panel/panel-control.ts`,
`shared/protocol.ts`. Extension automations unit: `panel/automations/automation-strip.ts`, `controller.ts`,
`panel/open-fluxiq/open-fluxiq-button.ts`. Core web (independent): `live/hooks/useAutomationDeepLinkRuntime.ts`
(and the session wiring that passes the adaptation navigation in, in `live/components/AutomationStudioSession.tsx`).

**Tests.** Extension `background/panel/tests/*open*` (the URL carries `view` and `detail`; a bad id is refused; a
panel-supplied project is ignored); `panel/automations/tests/automation-strip-open.test.ts` ("See what it learned" only
with adaptation ids). Core: a hook test in which a deep link with `detail=adaptation:x` selects `x` in the adaptations
view once, and a manual navigation afterwards is not overridden.

**Live check.** After the chained repair: Open in FluxIQ opens the right project and Flow (router view, not another
Flow). "See what it learned" opens Suggested changes with that adaptation selected, showing t256's "In the Flow:
applied", and the repaired node is reachable from it (item 26). The headed UI review captures both tabs.

---

### Unit 6 — t224's held units (status checked against current source)

| Unit | Plan / files | Current source | Still needed? |
| --- | --- | --- | --- |
| Extraction caret (selection restored only into the matched original control) | `panel/extraction/dialog-focus.ts` + new `tests/dialog-focus-selection.test.ts` (`extraction-caret-selection-implementation.md`, never dispatched) | Not done: `dialog-focus.ts:85` captures the active selection and `:105-106` applies it to whatever `target` focus falls back to | Yes, small. A caret jumping into a neighbouring field corrupts a column name while typing. Phase 4, parallel. |
| Preview table semantics (accessible name, "No value" for empty cells) | `panel-elements.ts`, `preview-table.ts` + new `tests/preview-accessibility.test.ts` (partition A of `extraction-preview-accessibility-audit.md`) | Not done: no table name in either file | Yes, cheap. It shares `panel-elements.ts` with the next row, so they run serially. |
| Preview feedback ("Refreshing preview..." while the automatic read is pending; a polite status on the note) | `panel.ts`, `panel-elements.ts`, `read-recovery/createExtractionReadRecovery.ts` + new `tests/preview-feedback.test.ts` (`extraction-preview-feedback-readiness.md`) | Not done: `previewNote` (`panel-elements.ts:75`) is a plain span with no live region | Yes. This is the scraping UX gap a person sees: stale counts shown as current while a read is pending. |
| Backend preview ownership | `background/extraction/{control,session-store}.ts` + `background/tests/extraction-preview-ownership.test.ts` | **Landed** (the test file is on `dev`) | No. |
| Receiver ownership (stale cancel/start/record against a replaced picker session) | `content/picker/*`, `content/message-handler.ts`, background control (`extraction-receiver-ownership-plan.md`) | Not done | Not for MVP: adverse-schedule races with no live sighting. Phase 5 hardening only if a live run shows it. |
| Start currentness (an unissued start cannot re-arm after cancel) | `background/extraction/control.ts` + new `background/tests/extraction-start-currentness.test.ts` | Not done | As above: Phase 5 at most. |
| Structured-state keyboard (Core web: Enter/Space on the fact button inside a focusable row fires twice) | Core `apps/web/src/features/automation-studio/state/StateStructuredPanel.tsx` + new `state/tests/StateStructuredPanel-keyboard.test.tsx` (`core-state-panels-ui-audit.md` S1) | Not done: the row `onKeyDown` (`StateStructuredPanel.tsx:18`) does not check `event.target === event.currentTarget` | Low. A one-file Core fix for an idle worker; it does not block items 25-26. |

Order for the extraction units: the caret unit and the table unit can run in parallel (no shared file). The feedback
unit runs after the table unit (`panel-elements.ts`). All are inside `panel/extraction/**`, which no other Phase 4 unit
touches.
**Live check:** in the Extract start of Unit 1, edit a column name, then remove a column. The preview note says
"Refreshing preview..." and then the new count, and the caret stays in the edited field.

---

### Unit 7 — Firefox popup parity (about 600 px)

The popup body is fixed at 380 × 580 px (`panel/shell/shell.css:23`), inside Firefox's 800 × 600 popup limit. Known
differences, all from source and docs; nothing has been loaded in Firefox:

1. **The popup closes on any click outside it.** While a Flow runs or a person acts on the page, the chat is gone. The
   overlay is the only progress view, and Stop, Take over, Hand back and an ask's Continue all mean reopening the popup.
   Drafts survive (`chat/conversation/draft-storage.ts`), and so does the extraction sheet (`panel/extraction/client.ts:74`).
   Needed: the overlay's waiting and paused detail says "Open FluxIQ from the toolbar to answer". The badge shows "!"
   while waiting or paused; `toolbar-indicator.ts` has only `REC` and `...` today. Both are in the Unit 2/3 background unit.
2. **No side panel.** `background/index.ts:327` sets `sidePanel.setPanelBehavior` only where `chrome.sidePanel`
   exists. Firefox's `sidebar_action` could give a persistent panel, but it is a manifest and permission change, so it
   is not MVP. Record it as a known difference in `docs/user/`.
3. **The background is an event page** (`background.scripts`), not a service worker. Whether Firefox suspends it with
   the gateway WebSocket open is unverified. The activity relay's memory-only history (`ACTIVITY_HISTORY_LIMITS`) would
   be lost.
4. **Placeholder gecko id** `fluxiq-web-automation@example.local` (`manifest.firefox.json`). AMO signing needs a real one.
5. **No real Firefox launch has ever happened.** Playwright 1.51.1 cannot install a temporary add-on
   (`release-packaging.md:87-91`). Proof is manual: `web-ext run` on the Firefox build with Firefox 128 or later.

Files (when built): the overlay wording in `content/activity-overlay/**` (t265-owned now, so after it), the
`background/panel/toolbar-badge.ts` "!" state, and the `docs/user/` known-differences note.
**Live check (manual, Phase 5 package step):** load the Firefox build in a real Firefox. Pair; run the A8 saved Flow
from the popup; close the popup and watch the overlay to the end; reopen and see the ending in the chat. Trigger a
person ask and answer it after reopening. Press Stop after reopening. Check the panel at 380 × 580 with no clipped
controls and no horizontal scroll.

---

## Recommended build order

Prerequisites: **t265** must land first (it owns `panel/chat/**`, `background/panel/**`, `background/activity/**`,
`content/activity-overlay/**`, `extension-client.md`). **t264** must land first for anything in Core
`R/service.ts`, `R/conversations/**` and `src/ui/activity-action/**`.

Work units, partitioned by file (W-A to W-H). Some can start at once; the rest are gated:

| Unit | Repo | Owns | Contains | Can start |
| --- | --- | --- | --- | --- |
| W-A Core run/build control | Core | `contracts/src/client-gateway.ts`, `api/contracts/endpoints.ts`, new `api/handlers/build-control.ts`, `runtime/service.ts` (build map only), `runtime/executor/graph-run.ts`, `runtime/activity/{run,build}.ts`, `apps/web/src/lib/program-route.ts`, `client-gateway.md` | Unit 2 Core, Unit 3 Core | after t264 |
| W-B Core learned + deep link | Core | `conversations/commands/run-flow.ts`, `apps/web/.../live/hooks/useAutomationDeepLinkRuntime.ts` (+ session wiring) | Unit 4 Core, Unit 5 Core | deep link: now; run-flow: after t264 |
| W-C Extension background control | ext | `background/panel/{run-control,panel-control,open-fluxiq,toolbar-badge}.ts`, `shared/{constants,protocol}.ts`, `background/activity/{headline,pacer,unit-situation}.ts`, `shared/activity/wording.ts` | Units 2, 3 and 5 background; the Firefox badge | after t265 and W-A's contract change |
| W-D Extension chat | ext | `panel/chat/view/{live-line,live-line-model,empty-state,empty-state-model}.ts`, `panel/chat/chat-panel.ts`, new `panel/chat/onboarding/*`, `chat.css`, `panel/shell/mount-panel.ts`, `panel/recording/recording-controls.ts` | Unit 1; Units 2 and 3 controls | after W-C |
| W-E Extension automations | ext | `panel/automations/**`, `panel/open-fluxiq/**` | Unit 2 strip Stop, Unit 4 row, Unit 5 link | after W-C; parallel with W-D |
| W-F Extraction (t224) | ext | `panel/extraction/**` | Unit 6: caret ∥ table, then feedback | now |
| W-G Lab panel controls | ext | new `packages/test-runner/src/person-simulation/panel-run-control.ts` (+ index export, test) | Stop / Take over / Hand back presses for the live checks | after W-D |
| W-H Docs + Firefox | ext | `docs/architecture/extension-client.md`, `content/activity-overlay/**` wording, `docs/user/` | Units 2, 3 and 7 words | last, after t265 |

Parallel now: W-F, and the deep-link half of W-B. After t264/t265: W-A, then W-C, then W-D and W-E in parallel,
then W-G and W-H. The live checks run as one Phase 4 round on the realistic scenarios, alongside Phase 3:
onboarding, Stop (run + build), Take over / Hand back, Open in FluxIQ, and the extraction preview.
"Learned" is proven inside Phase 2's chained run.

## Commands run and observed results

All read-only:
- `git merge-base --is-ancestor <c> dev` for extension `3a55a8b1 28ee7f6a 1884e5e2 da6477b5`: all on dev. Core
  `c4683b61 e05597bb`: both on dev. `git log dev..task/t224-codex-ui-ux-review`: only `8f4071db` (extension) and
  `73bbdb57` (Core), both doc-only (`git show --stat`).
- `git log -S panelStopRun -- apps/extension/src/panel` → `47ba62dc`, whose diff deletes `panel/simple/now-card.ts`
  containing `#stopRunButton`. A grep of `apps/extension/src/panel` for `panelStopRun|stopRun|fluxiq.panel.stopRun`
  outside tests found no sender.
- Read: `background/panel/run-control.ts`; Core `service.ts:2740-2760, 2578-2586, 1575`;
  `api/handlers/runtime-execution.ts:20-96`; `api/handlers/run-control.ts`; `run-control/{run-controller,registry}.ts`;
  `executor/graph-run.ts:380-560`; `executor/person-needed.ts`; `parking/{parked-run,person-needed-tool-calls}.ts`
  (headers); `activity/{run,build}.ts`; `contracts/src/client-gateway.ts:118-210`; `apps/web/src/lib/program-route.ts:58-80`;
  `conversations/commands/{build,run-flow}.ts`; `durable-behavior/judged-application.ts`; web
  `navigation.ts`, `useAutomationDeepLinkRuntime.ts`, `StateStructuredPanel.tsx:18`; extension
  `getting-started/start-steps.ts`, `shell/screen-state.ts`, `chat/view/empty-state-model.ts`,
  `automations/{summary-copy,facts}.ts`, `open-fluxiq.ts`, `extraction/dialog-focus.ts:85-106`,
  `extraction/panel-elements.ts`, `toolbar-indicator.ts`, `manifest.firefox.json`, `shell.css`;
  `extension-client.md:1-600`; the gap map; the t224 Current State, handoff and extraction plan reports (headers and
  the proposal sections); the t265 report header (for file ownership).
- No build, test, Lab, browser, panel or provider call.

## Not verified

- No behaviour was exercised: every "works today" above comes from reading source. Specifically unverified: that a
  token call to `cancel-runtime-session` from the background reaches a live run's controller in a real session; that a
  build cancel through the proposed signal ends with no further provider call (the phases' cancellation path exists,
  but not this trigger); and that `list-flow-adaptations` returns t256's `judgedApplication` on the rows the extension
  reads (it is on listing rows; that the endpoint uses those rows was not traced).
- Whether chat-started `run.execute` passes through the same `service.ts:2583` path (inferred from `run-flow.ts`
  calling `run-runtime-session`; not traced through the conversation port).
- Firefox event-page suspension with an open WebSocket; popup behaviour; everything in Unit 7.
- t265's final shape of `live-line*.ts` and `headline.ts`. The designs assume today's files and must be re-read after
  t265 lands.
- Lab support for pressing panel buttons mid-run: only the API-level person simulation (`person-simulation/asks.ts`)
  was seen.

## Open questions or contradictions found

1. **The gap map says Stop is implemented; the panel has no Stop control** since `47ba62dc` (2026-09-30). Item 10
   is further from done than recorded, and build Stop needs Core work. Decision 3 in Current State ("Stop plus a live
   take over / hand back") still stands, but Stop is a build task, not just a proof.
2. **Decision 3 can reuse Core's existing pause/takeover** rather than building on conversation parking, as the brief
   suggested. Run-control resumes at the same node, which is the hand-back semantics. Parking resumes down an edge.
3. **New activity phase `paused` and field `stopped`** are contract changes across Core contracts, the Core web panel's
   activity wording (t264-owned `src/ui/activity-action/**`) and the extension. They must land in one Core unit (W-A)
   before W-C.
4. **Extract start wiring.** The design hands Extract to the Automations tab, because the sheet is mounted there. If
   the supervisor wants Extract to stay in the chat, the sheet's mount moves out of `recording-controls.ts`. That is a
   larger W-D unit with no MVP item behind it.
5. **`extension-client.md` says Settings has "Open FluxIQ" and the strip has "Run"; neither has Stop.** The doc's Panel
   UI section should gain the Stop / Take over / Hand back rows when W-H lands.
