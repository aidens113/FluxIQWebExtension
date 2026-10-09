# t376 run controls and onboarding

Lane report, lead `t376`, 2026-10-08. Brief `t376 run controls and onboarding (lead)` in
`../../mvp-final-month-plan.md`. Trees: `fxwork/t376` (downstream and Core), both on
`task/t376-run-controls-onboarding`, changes uncommitted.

## Re-verification of the UX design against current source (2026-10-08)

Read in `fxwork/t376` at downstream `571b8153`, Core `52d7ac3a`.

- **Stop (Unit 2) has mostly landed since the design** (`0c64fcab`, `6e51d44b`):
  `panel/chat/stop-control.ts` shows Stop from "Starting..." on, sends `panelStopRun` with
  `runId` for a run or `flowId` for a build; `background/panel/run-control.ts` routes a build to
  Core's `cancel-flow-bootstrap` (on `PAIRED_CLIENT_ENDPOINTS`, with
  `api/handlers/tests/cancel-build.test.ts`). The design's `cancel-flow-build` and its
  `service.ts` build map are therefore not needed; nothing in this lane touches `service.ts`.
- **Still open for Stop:** the ending's "stopped" is inferred in the extension by matching Core's
  label text (`background/activity/pacer.ts:247`, `label === "Build stopped" || "Run cancelled"`),
  which the activity rules forbid; Core sends no `stopped` field. The Automations strip has Run
  but no Stop (`panel/automations/automation-strip.ts`).
- **Take over / hand back (Unit 3): nothing built.** `pause-runtime-session`,
  `resume-runtime-session`, `get-runtime-run-control` are still absent from
  `PAIRED_CLIENT_ENDPOINTS` (`apps/web/src/lib/program-route.ts`); `ClientGatewayActivityPhase`
  has no `paused`; no extension relay or control.
- **Onboarding (Unit 1): nothing built.** `panel/chat/view/empty-state-model.ts` still shows
  "What can FluxIQ do for you?" with three fill-only examples; no concept message, no Extract
  start; `panelModelReadiness` relay exists (`background/automation-relay/automation-relay.ts:117`)
  but no panel caller. The extraction sheet is mounted inside `panel/recording/recording-controls.ts`
  (not owned by this lane), so the chat's Extract start must reach it through the shell and the
  existing DOM, without editing `panel/recording/**`.

## Work units (partitioned by file)

| Unit | Worker | Owns | Status |
| --- | --- | --- | --- |
| C1 Core run control and activity | worker-high | Core contracts `client-gateway.ts`, `runtime/activity/**` (new `hold.ts`), `runtime/executor/graph-run.ts`, `runtime/run-control/{types,run-controller}.ts`, `apps/web/src/lib/program-route.ts`, Core `client-gateway.md` | done, verified |
| CW Core web reader | worker-low | Core `apps/web/src/features/automation-studio/conversation/activity/**` (scope addition: its reader refused any unknown phase, so `paused` events vanished from the web panel) | done, verified |
| E1 Onboarding | worker | `panel/chat/view/empty-state*.ts`, new `panel/chat/onboarding/**`, `panel/chat/chat-panel.ts`, `panel/chat/chat.css`, `panel/shell/mount-panel.ts` | done, verified |
| E2 Strip Stop | worker | `panel/automations/**` except `facts.ts`, `summary-copy.ts` | done, verified |
| E3 Background take over and stopped | worker | `background/panel/**`, `background/activity/**`, `shared/{constants,protocol}.ts`, `shared/activity/**`, `content/activity-overlay/**` | done, verified |
| Badge wiring | lead | `background/connection.ts` (`onActivityDisplay`), `background/index.ts` (one line); scope addition, E3's badge had no feed | done |
| E5 Chat on run, record button (user addition 2026-10-09) | worker | `panel/shell/**` (new `run-follow.ts`), `panel/recording/recording.css`, `panel/shell/shell.css` | done, verified |
| E4 Chat take over controls, followed-run retarget | worker | `panel/chat/**` (new `hold-control.ts`, `stream/run-target.ts`), `panel/shell/mount-panel.ts` | done, verified |
| L1 Lab panel-control helper | worker | new `packages/test-runner/src/person-simulation/panel-run-control.ts` (+ index, test) | done, unit-verified |
| D1 Docs | worker-low | `docs/architecture/extension-client.md` | done |

## Ledger

### 2026-10-08/09 - t376 units landed in the tree (uncommitted)

**Per unit.**
- **Unit 1 Onboarding: done.** The connected latest chat's empty state shows the concept paragraph,
  "Describe what you want" (focuses the composer, sends nothing), "Extract data from this page" (the shell
  switches to Automations and presses `#extractDataButton`; no edit to `panel/recording`), and the model-key
  line from `panelModelReadiness` when no key is enabled (a failed read shows nothing).
- **Unit 2 Stop: done.** Chat Stop for runs and builds was already on dev. Added: Core `stopped: true` on the
  final event of a cancelled run or build; the extension reads that field instead of matching "Build
  stopped"/"Run cancelled" label text (`background/activity/pacer.ts`); the Automations strip shows "Stop run"
  while its Flow runs. The strip learns the run id only from the run reply, so Stop re-reads the run list once
  and, if no running run is found, falls back to the project-wide stop. No `service.ts` change was needed
  (`cancel-flow-bootstrap` exists).
- **Unit 3 Take over / Hand back: done in code.** Core: the three run-control endpoints are on the paired
  allowlist; a hold emits one `paused` event ("Paused: you have the page") and its release one `running`
  event ("Continuing from step N"); the Core web panel's reader accepts `paused` and `stopped`. Extension:
  `fluxiq.panel.takeOverRun` / `fluxiq.panel.handBackRun` {projectId?, runId} relay to pause-runtime-session
  {takeControl: true} / resume-runtime-session {afterManualAction: true}; headline "Paused: your turn on the
  page" (never fades); overlay detail "Open FluxIQ and press Hand back"; toolbar "!" while paused or waiting;
  the chat shows "Take over" beside Stop for a working run and, while held, "You have the page. FluxIQ
  continues from step N when you hand back." with "Hand back" and Stop.
- **W-G Lab helper: done (unit tests only).** `pressPanelRunControl({surface, control: "stop" | "takeOver" |
  "handBack", atStep?, ...})` presses by accessible name, first attempt plus 3 retries, and returns a typed
  refusal instead of throwing. Not wired into a scenario.
- **User additions (2026-10-09).** The idle "Start recording" button is neutral grey (red only on hover or
  keyboard focus; hidden while recording, when the red bar shows); id and name unchanged. The panel switches
  to Chat on the first event of each new run of the chosen project, from Automations or Settings, never during
  a recording and not while the person types in a field it would hide; builds never switch it. If the chat is
  on a thread that would not show the run, it opens that Flow's chat (name known), else the latest chat, else
  the run's own thread; not while the composer holds a draft being typed.

**Validation (run by the lead, observed).**
- Whole extension unit runner in one process: `EXTENSION_TEST_BUILD_LABEL=t376-lead node scripts/test-extension.mjs`
  -> exit 0, `# tests 2714 # pass 2714 # fail 0` (3m17s). Each changed test directory alone also passes
  (background/activity 115, background/panel 61, content/activity-overlay 40, panel/automations 113,
  panel/chat/onboarding 4, panel/chat/stream 31, panel/chat 67, panel/chat/view 28, panel/recording 18,
  panel/shell 57, shared/activity 26; 0 fail each).
- `pnpm --filter @fluxiq-web-extension/extension build` -> exit 0 (Core build current);
  `npx tsc -p apps/extension/tsconfig.test.json --noEmit` -> exit 0;
  `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0.
- Core: `npx vitest run` on runtime/activity, graph-run-pause, run-control, handler run-control and cancel-build
  -> 31 files, 278 passed; apps/web program-route, route and conversation/activity -> 9 files, 105 passed;
  `pnpm --filter` check of @fluxiq/contracts, @fluxiq/client-gateway-websocket, fluxiq, @fluxiq/web -> all exit 0;
  Core `node scripts/structure-audit.mjs` -> passed (289 warnings, 710 baselined).
- Downstream `node scripts/structure-audit.mjs` -> one FAIL, `[working-docs] docs/working/README.md is out of
  date`, pre-existing at `571b8153` (reproduced with every t376 file moved out); the index is the supervisor's.

**Findings.**
- Test-order fragility (pre-existing): bundling `background/panel/tests/auto-connect.test.ts` (or
  `panel-control.test.ts`) in one process before `panel/chat/tests/*` makes chat tests fail with "Cannot assign
  to read only property 'chrome'" (auto-connect defines `chrome` non-writable; chat tests assign it).
  Reproduced on unmodified `571b8153` source (9 failures). The real runner's order passes; the new chat tests
  use the existing pattern.
- No paired-token endpoint pins a token to its own project at the route; unchanged, and it applies to the new
  run-control endpoints too (C1 report).
- A run held 15 minutes stops itself and also reads "stopped".

**Not verified (needs a live check).** No browser, Lab or Core round trip: a real Take over / Hand back, the
overlay and badge while held, strip Stop on a live run, the onboarding's Extract arming the picker, the panel
switching to Chat on a Lab/API playback, the 380 px Firefox popup layout, and the record button's colours by
eye. All four Lab slots are held by the live lanes, so no provider-free Lab check ran. The design's live checks
(Unit 1, Unit 2 a/b, Unit 3) now have the Lab helper they need.

Worker reports: `reports/t376/{c1-core-run-control,cw-core-web-paused,e1-onboarding,e2-strip-stop,e3-background-take-over,e4-chat-take-over,e5-chat-on-run-and-record-button,l1-panel-run-control}.md`.
