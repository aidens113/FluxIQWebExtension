# Extension Client Architecture

The FluxIQ web extension is a client for FluxIQ's generic WebSocket gateway.
The gateway should accept many client kinds; this extension identifies itself
as:

```json
{
  "clientType": "extension",
  "metadata": {
    "domainId": "web-automation"
  }
}
```

The extension is intentionally not the framework runtime. FluxIQ owns durable
projects, Automation Studio, recordings, normalization, policy generation,
authorization, and long-running work. The extension owns browser presence.

## Responsibilities

The extension:

- connects to a local or hosted FluxIQ gateway URL;
- stores that URL in the panel's settings (the gear);
- displays the server-provided reference code while the user approves pairing
  in the FluxIQ web panel;
- presents one panel UI, mounted by the Chrome/Edge side panel and the Firefox
  popup alike (see [Panel UI](#panel-ui));
- tracks local recording timer, event count, queued messages, and recent
  activity summaries;
- warns when the active page cannot be recorded by content scripts. One rule,
  `unsupportedAutomationPageReason`
  ([`runtime/unsupported-page.ts`](../../apps/extension/src/runtime/unsupported-page.ts)),
  now answers that question for recording and for automation alike; the
  recording path only restates its reason in the panel's wording
  (`background/connection/browser-state.ts`). The recording side previously
  kept a second pattern that required `://`, so eight URL classes it let
  through are now refused: `about:`, `view-source:`, `data:`, `devtools:`, and
  `javascript:` pages, and the Chrome, Edge, and Firefox extension galleries;
- reports browser, tab, and DOM state as FluxIQ `StateSnapshot` values;
- captures compact recording evidence from pages;
- lets the user pick one example item on a page and records an extraction of
  the list it belongs to;
- executes browser actions requested by FluxIQ;
- returns action results with evidence and timing;
- stores only lightweight settings, pairing/session data, and unsent events.

FluxIQ:

- pairs and authorizes clients;
- owns the generic WebSocket gateway;
- stores recordings and generated artifacts;
- maps domain-tagged client events into Automation Studio documents;
- chooses which actions to send to browser clients.

The top-level `domain/` package owns the FluxIQ-specific web automation
manifest, accepted recording event definitions, reducers, observation
extractors, and action interfaces. The extension imports those domain contracts
but the generic websocket package remains domain-neutral.

## Panel UI

The popup and the side panel are one UI. Both `popup/index.html` and
`sidepanel/index.html` are the same stub -- a `<div id="app">`, a link to
`index.css`, and `index.js` -- and each entry calls `mountPanel(root, surface)`
from [`panel/`](../../apps/extension/src/panel/index.ts). The surface name only
sets `data-surface` on the page, which sizes the popup to 380 by 580 px and lets
the side panel fill its column; nothing else differs, so a change to the panel
lands in both browsers at once.

There are no modes. The panel is laid out like a chat app: a slim top bar
(FluxIQ, the Chat and Automations tabs, the record button, the connection dot,
the gear and Open FluxIQ) and, under it, exactly one screen
(`panel/shell/screen-state.ts`):

- **Chat**, the default, with the whole panel. While it shows one automation's
  thread, a slim strip above it gives that automation's last run, Run, the
  run's data to export and Open in FluxIQ.
- **Automations**, the person's saved automations, newest first. Choosing one
  calls `chat.open({ kind: "automation", flowId, name })` and shows the chat.
  Below the list, "New automation" offers "Record a new automation" and
  "Extract Data From This Page"; a recording that just ended is reviewed at the
  top (analyze, preview, test, save), and the panel switches to this tab when
  a recording stops.
  Review actions retain their mounted controls across phase changes, including
  Done while analysis progresses into building. A removed focused action hands
  focus to an available local control only while the visible review still owns
  focus in the active document. Passive redraw and dismissal do not claim
  external focus; reducer, request and review-epoch contracts remain unchanged.
- **Settings**, opened by the gear in place of everything else: the two
  addresses and four switches with an explicit Save, Disconnect, the on-page
  status (Full, Small, Off), Report a problem, Forget this pairing, and Open
  FluxIQ. Picking a tab or "Close settings" goes back.
- **Getting started**, which replaces the chat and the automations tab while
  the browser is not connected -- never connected, connecting, waiting for
  approval, lost, or unable to reach FluxIQ -- or when the background does not
  answer: numbered steps (1 Open FluxIQ, 2 Connect this browser, 3 Approve this
  browser in FluxIQ), each marked done, under way, a problem or still to do,
  with their buttons and the approval code. Settings still open over it,
  because the connection address is there.

While a recording runs, a bar under the top bar on every screen shows its step
count, "Extract Data From This Page" and "Stop recording". It also holds a
recording refusal (with OK) and any failed recording request. Nothing in the
panel lists the steps of a run; what FluxIQ decides and does is the chat's to
show, and internal page reads are never shown as steps. Flow editing, run logs
and everything richer are in FluxIQ, one Open FluxIQ away.

The selected automation's Open in FluxIQ button carries its Flow ID to the
background. The background takes the project from the paired browser's
session and opens `/programs/automation-studio?project=...&flow=...` on the
configured HTTP(S) Core address, with both IDs encoded as query parameters.
It ignores a panel-supplied project or token and refuses an automation link
when the session has no project. Generic Open FluxIQ buttons still open the
configured panel address. Only the side panel and popup may request either
kind of link; content pages are refused before settings or session context
are read. Opening a link makes no authenticated program call and places no
pairing token in the URL.

| Directory under `apps/extension/src/panel/` | Owns |
| --- | --- |
| `shell/` | `mountPanel`, the top bar, the one `PanelStore`, and which screen shows (`screen-state.ts`, pure). |
| `state/` | The one `PanelStore`: a single `getStatus` on mount plus the `statusChanged` subscription, and `request`, which never throws. Every failure comes back as a `PanelResult` sentence, including a service worker that did not answer. Also the sticky error every screen uses. |
| `getting-started/` | The numbered steps as data (`startGuide`, pure) and their screen. |
| `settings/` | The settings screen, the connection form, its unsaved draft (`fluxiq.ui.connectionDraft`), Save's plan, Report a problem and Forget this pairing. The on-page status choice is the chat's (`chat/settings/`), mounted here. |
| `automations/` | The automations tab, the open automation's strip, and the controller and readers behind them. |
| `recording/` | The record button, the recording bar, the "New automation" section and the review after a recording. |
| `open-fluxiq/` | The Open FluxIQ button and its failure line. |
| `chat/` | The chat ([Live Activity](#live-activity)). |
| `copy/` | Every sentence about the connection, a step and an error, as pure functions of the status. The panel shows no selectors, ids or URLs other than a hostname. |
| `dom/` | `createElement`. Screens build their own DOM through `textContent`; nothing parses HTML. |
| `theme/tokens.css` | The light and dark colour tokens. Every stylesheet reads colours from them. |
| `extraction/` | The extraction sheet ([Defining An Extraction](#defining-an-extraction)). `mountExtractionPanel(host)` builds the entry button and the sheet into a host, keeping every `#extraction*` id the Lab drives. |

Each screen imports its own stylesheet, and the build emits one `index.css`
per page entry beside its `index.js` (`scripts/build-extension.mjs`, which
fails if a page's stylesheet is missing).

The names the Lab presses are kept: the gear's "Settings", the settings labels,
"Save" and "Saved.", "Forget this pairing" and "Forget", the getting-started
"Connect" / "Try again" / "Try now" (`#connectButton`) and the approval code
(`#pairingReferenceCode`), the top bar's "Start recording" (`#recordButton`),
the recording bar's "Stop recording" (`#stopRecordingButton`), and "Extract
Data From This Page". The old way back from settings, the "Simple" radio, is
gone with the modes.
Paused recording remains an active recording lifecycle: Start recording stays
hidden and disabled, including during connection, page and workload changes.
Getting Started keeps Connect and Cancel locked through acknowledgement. A
late failure is reconciled with the latest rendered connection state so it
cannot contradict an already confirmed goal; unmet-goal failures retain retry
feedback. Unexpected rejection releases both controls without exposing its text.

Pending chat sends and connection-settings saves preserve edits made after the
request began. Completion clears or refills a draft only when its edit revision
still matches the submitted revision. A successful earlier settings save reports
that newer changes remain unsaved; reconnect uses the saved settings. Typing or
filling an example while a chat send is pending never sends that newer draft.
Connection settings share one pending mutation owner across Save/reconnect,
Disconnect and Forget. Status pushes cannot enable another mutation during that
sequence; form inputs remain editable. Failed Forget retains confirmation and
offers retry. Successful asynchronous dismissal restores opener focus only while
the initiating control still owns focus in a visible active document; explicit
opening focuses Cancel when the opener owns focus.

The Automations list reconciles rows by flow id. Refreshing status or changing
workload state retains mounted rows, their controls and current activation data.
Reordering preserves row focus; removing a focused row selects a surviving
neighbour or a visible named fallback. Background refresh does not claim focus
from other controls, hidden panels or a hidden document.

A failed request's sentence stays where it was sent until the person acts
again; a status update never wipes it. Earlier, a refused command's error was
hidden in the same tick it was shown, because the re-render after every command
ended by drawing `lastError`, which the background had usually not set.

## Staying Connected

A browser FluxIQ has paired reconnects without anyone pressing Connect, as long
as "Reconnect automatically" is on and the person has not pressed Disconnect
since they last pressed Connect (remembered in `chrome.storage.session`).

- **Worker start.** `background/index.ts` reconnects on every start of the
  Manifest V3 worker, not only on `runtime.onStartup`: a browser start, an
  extension reload or update, and a worker Chrome stopped for idleness and an
  event woke all start the worker with a token in storage and no socket. Building
  the connection and reconnecting are each single-flight, so start-up, a panel
  opening and an alarm arriving together make one socket.
- **Dropped socket.** `GatewaySession` retries with a backoff of 1 s doubling to
  30 s. `retryNow()` starts the backoff over and tries at once; the worker calls
  it when the browser reports it is back `online` and when the reconnect alarm
  fires.
- **Reconnect alarm.** The backoff timer dies with a stopped worker, so while a
  paired, auto-reconnecting browser is neither connected nor waiting on a pairing
  approval, `reconnect-watchdog.ts` holds a `chrome.alarms` alarm
  (`fluxiq.reconnect`, every 30 s) that wakes the worker; it is cleared once the
  connection is back. This is why the manifests ask for `alarms`.
- **A panel opening** still reconnects too (`getStatus` from a control page).

`e2e/reconnect.spec.ts` covers a restarted worker reconnecting, a dropped socket
reconnecting, and the alarm being set and firing.

**Saved state of the wrong shape** is repaired, not thrown. Settings, the
session, the client id and the offline queue are read through
`background/saved-state.ts`: each well-formed field is kept, each malformed one
is replaced by its default (a malformed token is dropped, and the browser pairs
again), the repair is written back and noted, by field name only, in the problem
log.

**A panel relay that runs out of time** (two minutes; a conversation turn waits
on a model) answers `timed_out`, "FluxIQ may still be working on this", rather
than `unreachable`, so the panel does not invite a retry that does it twice.

## Problem Reports

`fluxiq.panel.reportProblem` (`RUNTIME_MESSAGES.panelReportProblem`, control
pages only) answers `{ ok: true, report }` with a `ProblemReport`
(`shared/protocol.ts`) built by allowlist in `background/diagnostics/`. It is
made even when FluxIQ cannot be reached, and then says why its recent-runs part
is missing. The panel's settings show it as "Report a problem":
it copies the report and offers it as a file. What it holds and withholds is in
[sensitive values](sensitive-values.md#problem-reports).

## Panel Relays

The panel's automation and recording requests (`AUTOMATION_PANEL_MESSAGES` in `shared/protocol.ts`, the
strings in `RUNTIME_MESSAGES`) are relayed by `background/automation-relay/` with
the pairing token, and each sends Core only the fields named here, never the
panel's message:

| Message | Core endpoint and request |
| --- | --- |
| `listAutomations` | `list-flow-summaries` `{ projectId }`, then `list-flow-runs` `{ projectId, sort: "updated", direction: "desc", limit: 50 }`; answers `{ flows, runs }` |
| `runAutomation`, `testGeneratedAutomation` | `run-runtime-session` `{ projectId, flowId }` |
| `runDetail` | `get-flow-run-detail` `{ projectId, runId, compact: true }`, then `list-flow-adaptations` for its Flow; answers `{ runDetail, adaptations }` |
| `exportDataset` | `export-run-dataset` `{ projectId, runId, datasetId, format }` |
| `modelReadiness` | `secret-keys` `snapshot` `{}`; answers `{ keys }`, each key's `kind`, `provider` and `enabled` only |
| `generateFromRecording` | `generate-recording-proposal` `{ projectId, recordingId, mode: "direct" }` for the recording this browser stopped last |
| `saveGeneratedAutomation` | `review-recording-flow-proposal` `{ projectId, proposalId, decision: "approved" }` |
| `removeRecordingStep` | by `entryId`, the `ActivityEntry.id` the recording log showed: removed from the offline queue if it was never sent, otherwise `remove-recording-entry` `{ projectId, recordingId, eventId }` |

Core accepts the token on these endpoints only with the same narrowed requests
(Core's `docs/architecture/automation-studio/client-gateway.md`), so a run from
the panel never carries an inline Flow, run inputs, an LLM run intent or external
side effects. The step index and the last stopped recording live in the worker,
so neither survives a worker restart; the relay then says the step can no longer
be removed.

## Wire Shape

Every message is a versioned JSON envelope:

```json
{
  "protocolVersion": 1,
  "id": "extension-client:timestamp:nonce",
  "type": "client.hello",
  "timestampMs": 1785600000000,
  "clientId": "extension-uuid",
  "sessionId": "optional-session-id",
  "tabId": 123,
  "frameId": 0,
  "payload": {}
}
```

Client messages this extension sends:

- `client.hello`
- `client.state_update`
- `client.start_recording`
- `client.stop_recording`
- `client.recording_event`
- `client.snapshot`
- `client.action_result`

The gateway protocol also defines `client.recording_entry` and
`client.error`, and FluxIQ's gateway client package can send both, but this
extension sends neither. An operator action travels as a
`client.recording_event` (see [Recording Evidence](#recording-evidence)), and
a gateway error is kept as local connection state.

Current server message groups:

- `server.pairing_required`
- `server.session_ready`
- `server.start_recording`
- `server.stop_recording`
- `server.capture_snapshot`
- `server.set_active_tab`
- `server.execute_action`
- `server.disconnect`
- `server.command` as a compatibility envelope
- `server.error`
- `server.ping`
- `server.ack`
- `server.activity`, only to a session that declared the `fluxiq.activity`
  capability

### Live Activity

`server.activity` carries a `ClientGatewayActivity`: what FluxIQ is doing now
in one unit of work (a build or a run), as a phase, Core's one-line status
sentence, an optional step count, and an optional detail row for the chat.
Every value comes from a real Core event. Core sends it only to ready sessions
that declared `{ id: "fluxiq.activity", kind: "custom" }`, which the extension
always declares (`domain/src/runtime/capabilities.ts`). The capability names no
action type, input or output, so it makes nothing executable. Core sends it
straight to the socket, bypassing the session's outbound queue, and drops it
when the socket is closed, so it is never replayed.

It is a status display, not a command. `ServerCommandChannel` hands the payload
to `ActivityRelay` (`background/activity/`) and does nothing else: no runtime
status opens, no reply is sent, and the connection's error is untouched. The
relay:

- drops a malformed event and any event whose `sequence` is not greater than
  the last kept one, so a late event never overwrites a newer status. A new
  gateway session resets that mark, because Core counts per process;
- keeps `current` and the last `ACTIVITY_RECENT_LIMIT` (60) events in memory
  only, so a worker restart forgets them. The conversation thread stays the
  durable record;
- keeps, beside them, each recent unit of work's whole story for the chat
  (`history`, `UnitHistory`): every decision Core explained (a `thought` with
  text), every check and repair, every action's start and end, every run step
  and the unit's final event, in arrival order, bounded by
  `ACTIVITY_HISTORY_LIMITS` (the last 10 units, at most 500 events each, the
  newest kept). A decision still being made ("Deciding the next step", no
  text), a pure status change and Core's bookkeeping (`isInternalStep`) are
  left out. The pacer and the overlay are untouched by it;
- folds the events into one paced **display** (`ActivityPacer`, below), which
  is what the overlay and the chat's live line draw;
- broadcasts `{ type: "fluxiq.activity.changed", state }` to the extension's
  pages when the event list, the display or the overlay preference changed;
- sends `{ type: "fluxiq.activity.overlay", activity, display, overlay,
  topFrameOnly: true }` to the top frame of the automation's tab
  (`OverlayTarget`, below) through `ensureContentScript` then `sendToTab`, when
  the display or the preference changed. Sends go one at a time, and changes
  that arrive during a send collapse into one send of the latest state. A send
  that has not settled after `PAGE_SEND_TIMEOUT_MS` (3 s) -- a document torn
  down mid-send -- is given up, so it cannot hold back the next one. When the
  target moves to another tab, the tab it left is sent `display: null`, so no
  stale status stays up there;
- answers `contentReady` from that tab's top frame at once with the current
  display, because a navigation replaced the document the overlay was drawn in:
  outside the rate gate and outside the one-at-a-time queue, whose send in
  flight is to the document that went away. A "done" display older than
  `ACTIVITY_DONE_VISIBLE_MS` (6 s) is not re-drawn, since the person already
  saw it fade; a failure is re-drawn on every page. The content script ignores
  a display older than the one it drew for the same unit of work, so the two
  sends cannot cross.

Each audience has its own rate gate (`FanOutGate`): at most one send per
250 ms, the first change after a quiet interval at once and the last change of
a burst at the interval's end. The panels' traffic therefore never delays the
page. Every delivery is best-effort and the two are independent: a closed panel
(the broadcast rejects), a panel send that never settles, a page that refuses
the content script, or a tab that closed mid-send is absorbed and holds nothing
else back.

**The paced display** (`ActivityDisplay`, `shared/activity/activity-display.ts`)
exists because Core reports every seam of a build -- ask the model, run a tool,
read its result, ask again -- often inside one second. Drawn as they came, the
t185 overlay's heading changed 103 times and its sentence 188 times over t174's
200-second crossborder-marketplace build, up to 4 times in one second. The
pacer keeps what Core says and changes how often it is said:

- `headline` names the unit of work and changes only when the work, its
  situation or its outcome does (`background/activity/headline.ts`): "Building
  your Flow" or "Running your Flow" while it works; "Fixing your Flow" from
  Core's first `repairing` event (for a run, until it reports its next step;
  for a build, until it settles) and "Couldn't fix your Flow" if it then fails;
  "Waiting for you: finish the check on the page" while a page action's result
  is `web.intervention.required` (a robot check or code prompt only a person
  can answer), until a later page action succeeds; "Waiting for you: answer in
  the FluxIQ panel" for Core's `waiting_permission`; then "Flow ready", "Build
  failed", "Run finished" or "Run failed". Every headline change shows at once,
  however recently the detail changed. The repair and check situations span
  many events, so `UnitSituation` folds every event in, shown or not. Core
  sends no event of its own for a robot check: the result code on the build's
  tool event is the only signal, and a run's step that meets one reports only
  a failed step;
- `detail` is Core's latest sentence in a person's words
  (`shared/activity/wording.ts`), changed at most once per 1,200 ms. The
  first change after a quiet interval shows at once; later ones wait for the
  interval's end, where only the newest shows, so no stale sentence is left up.
  A sentence that only repeats the headline ("Run finished" under "Run
  finished", "Building the Flow" under "Building your Flow") is null instead
  (`isHeadlineEcho`);
- `phase` and `step` belong to the event the detail came from, so they change
  no faster than it does. A run's step is kept between its step events and
  cleared when it settles;
- a `final`, `failed` or `waiting_permission` event, a new unit of work, a
  repair or check beginning or ending, and work resuming after a wait change
  the headline or the outcome, so they skip the interval.

Replayed at its real timing, the same t174 build gives 2 headline changes and
128 detail changes, never two working sentences less than 1.2 s apart
(`background/activity/tests/activity-replay.test.ts`, whose fixture holds the
run's 259 trace lines).

**Which tab** (`OverlayTarget`): the first ordinary web page (`http:`, `https:`
or `file:`) not on one of FluxIQ's own origins -- `coreApiUrl`, the gateway's
host -- among, in order, the tab the last runtime command ran in (remembered
after the runtime status moves on), the tab the extension holds as active, and
the active tab of each window, the focused window's first. The t185 relay used
only the extension's active tab, which depends on which of an extension page,
FluxIQ's web panel and the scenario page was activated last; the driven tab
comes first now and FluxIQ's own pages are refused outright.

The overlay preference (`expanded` by default, `collapsed` or `hidden`) is
kept in `chrome.storage.local` under `fluxiq.activity.overlay`. The panel reads
the state with `fluxiq.panel.activityRead` and sets the preference with
`fluxiq.panel.activityOverlay` (`{ overlay }`). Both answer `{ ok: true,
state }`, and both are accepted only from the side panel or the popup
(`background/panel/panel-control.ts`), so the page under test cannot change
what is drawn on it. An unknown preference is refused as `invalid_request`.

**The on-page overlay** (`content/activity-overlay/`) draws the paced display
in the top frame of that tab, never the raw event: a `<fluxiq-activity-overlay>`
host on `document.documentElement` with a closed shadow root styled through the
CSSOM and no `innerHTML`. `expanded` is a 384 by 66 pixel card: a mark, a
14-pixel headline, "Step N of M" (just "Step N" when N passes M) while a run
works, and the detail as one 13-pixel line; the text is white and near-white
(`#d8dde6`) on a near-black card of its own, with a light hairline inside for
dark pages and a dark ring outside for light ones. `collapsed` is a 300 by 36
pixel pill with the mark and the headline; `hidden` removes the host. The mark
and its colour follow the unit of work (amber for a build, blue for a run) and
its outcome (a check, a cross, or an attention mark), not Core's phase of the
moment. It is built once and updated in place: the same host and nodes, only
their text and attributes changing, a fixed box per shape so nothing shifts,
and a 220 ms fade-in when the detail changes. It has no entry animation, so a
page loaded mid-work gets it back at full strength.

**Where it sits** (`content/activity-overlay/placement/`): in a corner where it
covers no part of the page that stays over the content. `choosePlacement`
samples the pill's box at each corner, one point about every 36 pixels, and
`pageProbe` says what is under each point by hit test (`elementFromPoint`,
stepping into open shadow roots): a `fixed` or `sticky` box or a dialog makes
the corner busy -- a cookie banner, a chat widget, a sticky header, a cart bar
-- while a fixed box covering 60% or more of the viewport is a modal's backdrop
and hides nothing the person needs, and ordinary links and buttons only break
ties. Corners are tried bottom-left, top-left, bottom-right, top-right (the
side panel covers the right of the Lab's emulated viewport without narrowing
it, t191 round 1), and a corner the overlay holds is kept while it stays
clear. When every corner is busy it shrinks to a 30-pixel dot, carrying only
the mark, at whichever corner or side midpoint covers least. `PlacementKeeper`
re-checks on resize, scroll and page DOM changes (its own UI's mutations are
skipped), at most once per 800 ms; a check only reads, and the host moves --
one write -- only when the answer changes. A page whose banner lives in a
closed shadow root, or draws a bar with a canvas, cannot be seen this way.

The overlay never takes input: every element is `pointer-events: none`,
`inert` and `aria-hidden`, so hit-testing and the automation's own clicks
reach the page. Its `data-fluxiq-activity` marker keeps it out of the recorder,
DOM snapshots, evidence blockers and the interference checks
(`isExtensionUiNode`). Only "done" fades, after `ACTIVITY_DONE_VISIBLE_MS`
(6 s): a failure stays until new work starts or the person hides the overlay,
and waiting for the person never fades. That fade is the only timer and it
changes nothing but the display.

Measured in a headed Chromium on company-website (t191-overlay2 probe, fake
gateway, no Core): after the automation navigated, the new document's overlay
host was in the page 65 ms after the old page hid and before the new page's
first paint (104 ms), and a 200 ms sampler across the navigation saw 16 of 16
samples present. An earlier run of the same probe saw 1 absent sample of 16
in a 121 ms gap, again ending before first paint.

**Waiting for the person.** Core's asks arrive as a `waiting_permission`
event whose label is the ask's text. At a robot check that text is "FluxIQ
needs you: complete the check on this page, then press Continue." (Core's
person-needed ask, `control.kind: "person_check"`). The pacer shows it at once
as the detail under "Waiting for you". The expanded overlay draws it whole,
because it fits the line, and does not fade. The collapsed pill shows only the
headline.

**The panel's chat** (`panel/chat/`) fills the panel and has no header. It
shows Core's thread (the latest, one automation's, or the thread a build or a
run asked its question in) and FluxIQ's work in one stream, like a chat app:

- The person's turns are bubbles on the right; FluxIQ's answers are
  full-width formatted text. A question's turn carries its choices as buttons
  (`conversation/ask-copy.ts`): the person-needed ask shows "Continue" and
  "Stop", which send `choice` with `person_done` or `person_stop`.
- **What the person asked a build is their message** (`stream/stream-items.ts`),
  however the build was started. A build says the person's own words on its
  activity once it has read its instructions (`ClientGatewayActivity.request`,
  Core's `activity/build.ts`), and the chat shows them as the person's bubble
  where the build said them, unless the thread already holds those words from
  the person (a request typed into this chat is not shown twice). Live runs 34
  and 35 were built from an instruction no chat showed.
- **Every step is its own FluxIQ message**, in order, with its reason
  (`stream/step/messages.ts`, `view/step-message-view.ts`): each explained
  decision reads "**Clicking “Get a free quote”** — The quote form is behind
  this button, so I'm opening it.", and each repair gives its diagnosis. A
  note is words only, and a note with no words is no message: Core's own look
  before the first decision and a dry run's reset are said by the live line
  while they run, never as a bare heading (live runs 34 and 35 showed "Looking
  at the page" twice that way). There are no folds, disclosures or step counts,
  and no raw tool or node id is shown (`stream/step/words.ts`).
- **Every action is a card** (`stream/step/action-card.ts`,
  `view/action-card-view.ts`). The actions Core took for a decision (the
  `tool` events after its `thought`, until something else opens a message)
  are that message's cards, in order. An action with no decision before it, a
  result check, a question to the person and a run's step are each a message
  that is only its card. Core's shared classifier reads each event
  (`activityActionOf`, `ACTIVITY_ACTION_ICONS` and `ACTIVITY_ACTION_NAMES` from
  `fluxiq/ui`), so the extension and Core's web panel draw the same card:
  - **Mark.** The icon Core pins for the kind, drawn from lucide's node data
    by `panel/icons/` (`lucideIcon`, inline SVG in the current colour), in a
    28 px round mark. The mark is tinted by the outcome: accent while
    working, success when done, danger when failed, warning while waiting,
    and neutral once settled.
  - **Head line.** The kind's name and what it acted on: "Click · Get a free
    quote". An action on the page that named no control says "the page"; a
    test run, an edit to the Flow, a wait, a robot check or a permission
    names no target.
  - **Outcome line** (`stream/step/card-words.ts`). "Done"; "Didn't work: it
    wasn't on the page" (Core's reason, else its sentence in words); a check
    reads "Passed" or "Didn't pass" with its verdict. A wait on the person
    that Core settled reads its sentence: "Done. You pressed Continue.",
    "Didn't work: you pressed Stop". "Working on it" shows only on the
    action of the moment, the newest card of the unit of work that is running
    or waiting on the person; "Waiting for you" shows on every card of that
    unit still waiting on the person. An action that never said it ended
    shows no outcome once the work moved on. A wait Core never settled keeps
    "Waiting for you", even after its unit of work ends.
  - **Questions to the person** (`stream/step/messages.ts`). A robot-check or
    permission card is over only when Core says so: the ask row that settles
    the wait carries the same ask id (`activityActionKey` from `fluxiq/ui`,
    `ask:<ref>`) and a `detail.resolution`, and the card is marked from it in
    place, the same element in the same place. Its outcome comes only from
    `activityActionOf`; the chat never enumerates resolutions, so a new one
    needs no change here. Nothing later in the work (a note, another action,
    the work moving on or failing) settles a wait. One check is one card: a
    tool whose result says the page needs a person (Core reads it as a robot
    check, waiting) and the robot-check ask of the same unit of work share a
    card, whichever came first. An ask row with no ask id while another ask's
    card waits only restates that wait (a parked run's "Run is waiting for an
    answer") and adds nothing. These are the Core panel's rules.
    Core's closed resolutions are `waited_out` (the check cleared itself),
    `answered` (the person continued), `allowed` (permission granted),
    `declined`, `timed_out` and `cancelled`. The first three settle successfully;
    the last three settle as failed. A later action cannot imply any of them.
  - **Accessibility.** The card is a labelled group ("Click, Get a free
    quote: Done"), and its icon is `aria-hidden`.
  - **Styling.** The panel's tokens only, so light and dark follow them: the
    getting-started step's mark and body in `.card`'s chrome (`chat.css`).
- Messages are keyed by the event that opened them (`step:activityId#sequence`)
  and cards by theirs (`action:activityId#sequence`). Both are updated in
  place, never remounted. A new card goes after the others, and each message
  keeps the time of its event, so nothing reorders. They come from the relay's
  `history`, so a whole build stays in the chat after it settles, placed by
  time among the thread's turns (timed by Core's own `createdAt`), before the
  answer it led to.
- The live line is always last. It shows the paced display only: the
  headline, the step, and Core's latest sentence ("Thinking about the next
  step" while Core decides, which adds no message). While the work waits for
  the person it says what Core asked, and "Show the question" opens the thread
  holding the question when it is not on screen.
- New content is followed only while the person is at the bottom of the
  stream; scrolled up, it stays put and "Jump to latest" shows.

The composer sends typed instructions through `panelConversationSend`. The
thread is re-read 300 ms after an event that names a conversation or ends the
work. The 4 s poll stays as the fallback.

**The chat builds and runs automations** (t198). The background relay
(`background/panel/conversation-relay.ts`) adds two things to every message:

- The capability ids Core executes server-side (`chat-capabilities.ts`):
  `flow.createHere`, `flow.describe`, `flow.explore`, `flow.improve`,
  `run.execute` and `ask.answer`. They are ids only, because Core supplies
  their descriptors.
- `onScreen.pageUrl`: the active tab's address (`chrome.tabs.query`, last
  focused window), and only an http(s) address of at most 2048 characters
  (`page-url.ts`). Core builds from that page. If the browser cannot say which
  tab is active, nothing is sent, and the panel is told why.

Core runs a chosen capability for the paired person's project, on that person's
unlocked model key, and answers `response.execution`. For a build or a run
that is `started`. The result arrives later as a thread turn, and progress
arrives as activity stamped with the thread's id. An automation's own chat is
`panelConversationSend` with `kind: "open"`, `subjectKind: "flow"` and the
Flow's id. There, "run it" means that Flow. Core's side is described in
FluxIQ Core's `docs/architecture/automation-studio/client-gateway.md`
("The chat runs capabilities in Core").

## Action Surface

The browser action set is `WEB_AUTOMATION_ACTION_TYPES`
([`domain/src/actions/types.ts`](../../domain/src/actions/types.ts)), which is
the one list every schema, output node, manifest output, and registered output
derives from:

- `web.browser.navigate`
- `web.dom.click`
- `web.dom.type`
- `web.dom.clear`
- `web.dom.select`
- `web.dom.scroll`
- `web.dom.keypress`
- `web.dom.wait_for_selector`
- `web.dom.wait_for_text`
- `web.dom.extract`
- `web.dom.capture_snapshot`
- `web.dom.check`
- `web.dom.assert`
- `web.dom.extract_list`
- `web.dom.upload`
- `web.dom.dialog`
- `web.browser.tab`
- `web.browser.download`

`web.browser.navigate`, `web.browser.tab`, and `web.browser.download` run in
the background worker; every other action runs in the tab's content script.

Server action commands use the current gateway shape:

```json
{
  "actionType": "web.dom.click",
  "parameters": {},
  "target": { "selector": "button[type=submit]", "label": "Submit" },
  "timeoutMs": 10000
}
```

The extension maps those commands into browser operations and returns
`client.action_result` with status, message, target evidence, payload evidence,
and start/completion timestamps.

A command can name a tab or a child frame by its path, because an id does not
survive to a replay, an origin differs from run to run, and a query may carry a
token. Two fields carry a path:

- **`tab.urlPath`**, on a `web.browser.tab` switch. It is the exact pathname of
  the tab to switch to, as `WebAutomationTabRequest`
  ([`domain/src/actions/types.ts`](../../domain/src/actions/types.ts)) and the
  `tab` parameter schema declare it. A malformed one refuses the whole tab
  request, so the command fails as `INVALID_PARAMETER`. Dropping only the path
  would send the switch to whichever tab the request's other fields name.
- **`frameUrlPath`**, the pathname of the child-frame document the action was
  recorded in. The parameter reader
  ([`domain/src/client/gateway-action-parameters.ts`](../../domain/src/client/gateway-action-parameters.ts))
  lifts it only from the node parameter `browserFrameUrlPath`. It is optional,
  so a malformed one is left off and the action is addressed by its frame id
  alone.

Both are held to one rule, `webAutomationUrlPath`
([`domain/src/output-nodes/url-path.ts`](../../domain/src/output-nodes/url-path.ts)),
which the extension imports from `@fluxiq-web-extension/domain/client` rather
than copies. A path starts with `/`, its second character is not `/` or `\`,
and it holds no `?` or `#`, so a full URL, a protocol-relative host, a query and
a fragment are each refused. How a switch finds its tab is in the switch row of
the [capability matrix](web-capabilities.md#capability-matrix), and how a
command finds its frame is under
[child frames](web-capabilities.md#child-frames).

The domain resolves a command's action type once, in
`normalizeWebAutomationActionType`
([`domain/src/client/gateway-mapping.ts`](../../domain/src/client/gateway-mapping.ts)):
a canonical type passes, a legacy dotted alias such as `dom.click` becomes its
canonical type, and any other type is rejected instead of being rewritten into
another action. The extension answers that rejection itself, without
dispatching anything to the page: a `failed` `client.action_result` whose
`failure` is Core's structured record — `category:
"blocked_by_capability_or_policy"`, `code: "web.action.unsupported_type"`,
`retryable: false`, `stage: "dispatch"` — with the requested type in
`metadata`. The current state of every capability, and whether its outcome is
validated, is in [web capabilities](web-capabilities.md); the closed set that
`code` is drawn from is in [the failure taxonomy](failure-taxonomy.md), and
how a command's target becomes an element is in
[element identity](element-identity.md).

An in-page action goes to its frame's content script as one `executeAction`
message, built once in `runActionInFrame`
([`runtime/action-runner.ts`](../../apps/extension/src/runtime/action-runner.ts))
and sent by `sendAction`. When the command also names its child frame by path,
`runActionInFrame` first chooses the frame now at that path
([`runtime/frame-address.ts`](../../apps/extension/src/runtime/frame-address.ts)),
and the message goes to that frame. The message is sent once, with one exception, a
`web.dom.assert` whose send Chrome refuses as a navigating page would: no
receiving end, or a message port or channel that closed before a response.
That assert waits for the tab to settle (`waitForTabReady`) and is sent to the
same frame exactly once more. A navigation that a click started late can take
the old document away under the assert after it. The assert only reads, so a
second send cannot act twice. Every other verb is sent once, because a click or
a type may already have acted before the channel closed. A refusal that is not
retried, the assert's second one included, is thrown, and
`runtime/command-router.ts` answers it as a `failed` result with
`web.action.failed`. The result does not say whether a second send happened.

Every in-page result passes one hook that can name its failure from the page
rather than from the verb. `authGateFailure`
([`content/action-runtime/results.ts`](../../apps/extension/src/content/action-runtime/results.ts))
reports `auth_required` (`web.auth.required`) when both of these hold:
- the document is a sign-in gate, meaning a rendered password control inside a
  form;
- the action's target matched nothing, or a `web.dom.assert` URL claim that
  names a URL did not hold.

The URL case is how a replayed click fails when an expired session leaves it on
the gate instead of the page it recorded landing on. The domain's expectation
evaluator sends that claim as a `web.dom.assert`. It keeps the record the
client reported, not a state mismatch of its own
([`domain/src/runtime/expectation/evaluate.ts`](../../domain/src/runtime/expectation/evaluate.ts)).
The record's `expected` is the Flow's claim and its `actual` is fixed words;
neither holds the address the page is at. A URL claim that names no URL is a
malformed Flow and still fails as `web.validation.state_mismatch`, as does a
failed URL claim on a page with no gate. Every producer is listed in
[the failure taxonomy](failure-taxonomy.md#who-produces-what).

### Robot Checks

FluxIQ never presses, types into, solves or reloads a robot check. What it
does next depends on who clears the check, which
[`content/action-runtime/challenge-evidence.ts`](../../apps/extension/src/content/action-runtime/challenge-evidence.ts)
reads from wording and structure a visitor sees, never from a site's name
(`robotCheckIn`):

- **Self-clearing.** The page says it is checking and will let the visitor on
  by itself. Examples: "Checking your browser before you continue",
  "Checking you are human…", "we'll check your browser again automatically
  in 8 seconds", or a disabled "Checking…" button on a page about robots,
  humans or the browser. Such a check is waited out in place, untouched, for
  at most 15 s. The wait is held within the command's own `timeoutMs`, less
  1 s for the reply.
- **Person-only.** The page asks the visitor to prove something: an "I'm not
  a robot" box, "Confirm you are human", a press-and-hold with no countdown,
  or characters in a picture. The result is `USER_INTERVENTION_REQUIRED`
  (`web.intervention.required`), and Core asks the person to complete the
  check and press Continue.

Characters in a picture are always person-only. Otherwise, a check that says
it clears by itself counts as self-clearing even if it also offers a box or a
hold. A self-clearing check that does not clear in time is handed to the
person like a person-only one. A page is read in its headings, in full when
it is small enough to be an interstitial (1,000 characters), and in the
regions a page draws a check into over its own content: a dialog, an alert or
status region, a live region. In a dialog, every robot check is `captcha` to
`challengeIn`, so the interference defence never presses a self-clearing
check's Continue. On a page, only a person-only check is `captcha`. The page
reading feeds `challengeGateFailure`, which hands a missing target to the
person, and a self-clearing check is waited out instead: by the navigation or
click that met it, or by the retry a missing target is given.

Where checks are met:

- **A navigation** asks the landed page's top frame (`fluxiq.pageChallenge`,
  [`shared/page-challenge-message.ts`](../../apps/extension/src/shared/page-challenge-message.ts)).
  The answer is `{ challenge: "captcha", robotCheck: "self_clearing" |
  "person_only" }`; a content script from before `robotCheck` existed
  answers `captcha` alone, which is read as person-only. A self-clearing check
  is polled every 500 ms
  ([`runtime/landed-check-wait.ts`](../../apps/extension/src/runtime/landed-check-wait.ts)).
  When it reads as no check, the tab is let settle and asked once more. The
  landing is then judged as usual, and the validation says the check was
  waited out.
- **A navigation to the address the tab already shows** is normally a reload
  ([`runtime/automation-tab.ts`](../../apps/extension/src/runtime/automation-tab.ts)).
  If the tab is showing a check, it is not reloaded: a reload asks the check
  again and restarts its countdown. The drive record says `heldForCheck`,
  which `judgeTabMovement` does not treat as a no-op, and the check is waited
  out or handed over as above.
- **A click whose navigation commits onto a check**
  ([`runtime/click-landing.ts`](../../apps/extension/src/runtime/click-landing.ts)):
  the landed top frame is asked the same question, again for up to 2.5 s while
  the new document is not yet listening. A check decides the landing before
  the HTTP status does, so a check served 403 is still the person's. The
  failure says the click was made and names the landed path without its
  query.
- **A press that puts a check up in place**, with no navigation
  ([`content/action-runtime/robot-check/`](../../apps/extension/src/content/action-runtime/robot-check/robot-check-watch.ts)).
  The click verb watches the page's reading beside the rate-limit watch,
  within the same 500 ms window and ending on the same signals, so an
  ordinary press waits no longer. Only a check that appeared after the press,
  or one that turned from self-clearing into person-only, is the press's
  answer. A self-clearing one is followed for up to 15 s; company-website's
  "Checking you are human…" becoming "Confirm you are human" ends as
  person-only. The failure (`actionNeedsPerson` in `results.ts`) says the
  press was made.

A navigation or a click whose landed check cleared by itself says so twice:
in its validation's prose, and as a fact, `checkWait: { waitedMs }` on the
action result (`clearedCheckWait` in `runtime/landed-check-wait.ts`). Only that
outcome carries it; a check that needed a person, or did not clear in time,
fails the action instead. `webAutomationActionResultPayload` copies it onto the
gateway payload through
[`domain/src/actions/cleared-check-wait.ts`](../../domain/src/actions/cleared-check-wait.ts),
which keeps `waitedMs` alone as whole milliseconds within ten minutes and drops
anything else. Core reads it in two places. In a Flow run the client's payload
reaches Core whole under the dispatch result's `payload.result`, so it is
`payload.result.checkWait`. In a build's evidence loop the node run's tool
execution carries it beside `resultCode` as `clearedWait: { waitedMs }`
(`domain/src/runtime/llm-evidence/node-run/cleared-wait.ts`, and listed in
`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`), on a node run that succeeded. The
chat's robot-check card reads it to close as cleared on its own.

Every failure record leads its `actual` with the closed word `captcha:` and
never quotes the check.

Action commands, recorded action events, and action results may also carry a
`visualTarget` object. This object is the editor-facing reference to the state
entity acted on, separate from the raw `element` fingerprint:

```json
{
  "visualTarget": {
    "namespace": "web",
    "statePath": "web.elements.button.save",
    "selector": "button.save",
    "frameId": "screen",
    "layerId": "element.button.save",
    "documentLayerId": "document.element.button.save",
    "bounds": { "x": 20, "y": 30, "width": 80, "height": 32 },
    "documentBounds": { "x": 20, "y": 55, "width": 80, "height": 32 },
    "anchor": {
      "type": "bounds",
      "bounds": { "x": 20, "y": 55, "width": 80, "height": 32 }
    },
    "confidence": 0.98
  }
}
```

`statePath` is the primary key for editor highlighting. It points at the
`web.elements.*` state value generated from DOM snapshots; visual frames expose
matching region layers with the same `statePath`. Consumers should prefer
`statePath`, then `layerId`/`documentLayerId`, then selector and bounds as
fallbacks.

## Declared Inputs And Outputs

The domain registers browser state and passive recording evidence as unmapped
inputs. They can be used as observations and policy conditions only. The
extension classifies an operator navigation, click, text entry, clear, select,
check, key press, scroll, file choice, tab switch, tab close, or extraction
defined with the picker into a distinct action input. Each action input carries
`metadata.inputId` and has exactly one registered output binding. FluxIQ uses that binding to persist the output ID
and mapped payload in a policy action.

Three of the twelve action inputs come from a file choice or a tab change:

| Input | Output | Mapped from |
| --- | --- | --- |
| `web.user.files_chosen` | `web.dom.upload` | an `input` or `change` on a file input |
| `web.user.tab_switched` | `web.browser.tab` | a `browser.tab` event whose `tab.operation` is `switch` |
| `web.user.tab_closed` | `web.browser.tab` | a `browser.tab` event whose `tab.operation` is `close` |

The two tab inputs share one output, so an input is never derived from
`web.browser.tab` alone: it comes from the event's `tab.operation`. All twelve
inputs and their outputs are listed in
[web capabilities](web-capabilities.md#recorded-actions).

One more comes from the extraction picker: `web.user.data_extraction_defined`,
which maps to `web.dom.extract_list`. A single-value definition has no input,
because nothing can record one — see
[Defining An Extraction](#defining-an-extraction).

The extension never sends a generic executable action entry. Inputs without an
output mapping remain non-executable even when they were captured during a
recording. Registered input adapters also subscribe to the live gateway stream
so runtime consumers can wait for browser confirmation events after dispatch.
One domain function, `webAutomationRecordedAction`
([`domain/src/io/input-model.ts`](../../domain/src/io/input-model.ts)), maps a
recorded event to its action input for both the live path and the
recording-to-Subflow proposal mapper, and an event whose output would lack a
required parameter stays evidence.

## Recording Evidence

The content script and the background worker emit browser evidence:

- content ready, from the content script;
- tab switches, tab closes and navigation changes, from the background worker;
- click, input, change, and submit;
- keydown and scroll;
- batched DOM mutation counts, sent ahead of the next action;
- DOM snapshots.

No focus or blur evidence is emitted. The shared protocol still declares
`dom.focus` and `dom.blur` kinds and the domain still maps them to event
types, but the recorder
([`content/dom-events.ts`](../../apps/extension/src/content/dom-events.ts))
registers no focus or blur listener. The recorder ignores untrusted pointer,
click, input, change, key, and wheel events. A click the page dispatches is
therefore not recorded as the user's, and a replayed `type`, `clear`, or
`select` is recorded once, as its runtime confirmation, not a second time from
the synthetic `input` and `change` events it dispatches. Submit and window
scroll are recorded without a trust check.

A click is recorded from its `pointerdown`. The `click` that the press produces is
the same action, so it is dropped when it lands on the pressed control in the
same tab and frame. Every `click` ends that pairing, and no time window applies.
So a second press on the same control is a second action, however soon it
follows. A `click` with no press before it, such as a keyboard activation, is
recorded on its own
([`background/connection/pointer-click-filter.ts`](../../apps/extension/src/background/connection/pointer-click-filter.ts)).

Typed text is debounced into one pending input event. Three things send it
first, so no action is recorded ahead of the text typed just before it:
- a pointer press;
- a text field's `change`;
- a key that acts on the text rather than typing it: Enter, Tab, Escape, or an
  arrow.

A character, a deletion, a bare modifier, or a key an input method reports while
composing does not send it, so one run of typing stays one event.

The page's own DOM changes are counted, not described. While mutation capture is
on, the content script
([`content/recorder.ts`](../../apps/extension/src/content/recorder.ts)) adds them
up into one pending `dom.mutation` batch: nodes added, nodes removed, attribute
changes and text changes. The batch is sent once the page has been quiet for
500 ms. A DOM change made before an action is never recorded after it:
- **An action sends the batch first.** A batch still pending goes out ahead of
  any event of a kind that can become an action: `dom.click`, `dom.input`,
  `dom.change`, `dom.submit`, `dom.keydown` or `data.extract`.
- **Undelivered changes count.** That early send also counts the changes the
  page's observer has queued but not yet delivered, so a change made in the same
  task as the action is not left behind.
- **Other kinds wait.** A scroll or a navigation leaves the batch to its quiet
  period.
- **The extension's own overlay is not a page change.** A node carrying
  `data-fluxiq-picker`, and anything inside it, is skipped
  ([`content/picker-host.ts`](../../apps/extension/src/content/picker-host.ts)),
  so raising the element picker's highlight mid-recording counts nothing. Left
  in, the recording would hold a `dom.mutation` no page behaviour produced, and
  a replay would wait for it ([Defining An Extraction](#defining-an-extraction)).

A batch is evidence only. It carries no DOM snapshot, so the background worker
sends it as a `client.state_update` under the `web.recording.evidence` input,
with its counts and page URL in `latestEvidence`. A
[wait before a late target](#a-wait-before-a-late-target) is proposed from it.

The background process maps this raw evidence into `web-automation` domain
events such as `web.element.clicked`, `web.element.input_changed`,
`web.page.navigated`, and `web.action.executed` before sending
`client.recording_event`. FluxIQ validates those events against the registered
`RecordingDomainDefinition` before deriving normalized timelines, signal
registries, task models, or policies.

The background worker decides which committed navigations become events
([`background/connection/navigation-recorder.ts`](../../apps/extension/src/background/connection/navigation-recorder.ts),
fed by `recorded-event-intake.ts`). The general rules are these:
- Only the top frame's commits count, and a reload is never recorded.
- Commits are debounced per tab for 250 ms, so a fast client redirect records
  only where the page settled.
- A navigation committed before the recording started belongs to setup and is
  dropped, as is a return to the tab's starting URL within the first 10 s.
- A typed navigation is recorded unless it repeats the tab's last recorded URL.
- Any other navigation, a history-state update included, is dropped when a
  click or submit in the same tab preceded it within 5 s.

A target captured inside an open shadow root keeps its **host chain**
(`context.shadowHosts`, outermost first): each host's selector, so replay
resolves the element inside the same root rather than the light DOM. Replay
walks the chain, widening the scope only when a positional host selector
misses; the element's own selector, the recorded fingerprint veto and the
ambiguity rule then decide, and more than one equal match is refused with a
closed `web.target.ambiguous` result rather than guessed. Closed shadow roots
are not reachable.

A navigation the page made itself is different. That is a Chrome transition of
`link` or `form_submit`, script navigation such as `location.assign` included.
It is recorded only as the **landing** of the executable click that caused it,
in the same tab, within 5 s after that click, and before any later recorded
action other than a scroll: a key press, typed text or a change ends the
click's window. A navigation is judged by the action in force when it
committed, so a step's expected post-state never comes from a later step's
page. A form submit extends the
window and keeps the click it follows, provided that click was inside the
submit's own window; a submit never names a click of its own. A click nothing
can replay names nothing, and a new recording forgets the previous one's
clicks. The landing is sent as a non-executable `client.recording_event`,
`web.page.navigated`, carrying:
- `metadata.transition: "explained"`;
- `metadata.explainedByEventId`, the gateway event id the click was itself sent
  under (`web.<sequence>.<timestamp>`). It is read off the event the domain's
  builder, `createWebAutomationRecordingEvent`, makes for that click, and it
  names exactly one click in the recording;
- `metadata.explainedBy`, the click's `sequence`. The content script restarts
  that counter in every document, so two clicks in one recording can share it;
- a URL cut to origin and path. The query and fragment, where a session token
  or a one-time code would ride, are dropped, and a URL with no origin is not
  recorded.

The landing carries no input id. The domain maps it to no input, so it never
executes, and it is not counted as a recorded action. It is also sent as
evidence. Core stores it as a domain event on the recording's timeline, where
the recording mapper finds it beside the click it names
([A Click's Landing](#a-clicks-landing)).

Stop is one synchronous, single-flight lifecycle boundary. The first Stop
caller installs the shared operation and decides whether Core is notified;
crossing callers receive that same promise and teardown runs once. From that
boundary, ordinary content, tab, command-confirmation, and fresh-navigation
events are no longer admitted.

Before the recorder becomes idle or sends `client.stop_recording`, it drains
the current navigation generation: pending 250 ms callbacks run immediately,
callbacks already sending are awaited, and same-generation work exposed while
they settle is drained too. Only callbacks admitted before Stop may use the
internal navigation-admission path. A send failure remains the primary error,
but does not prevent the matching Stop attempt. A later recording advances
the generation only after this drain, so old callbacks cannot enter or fail
the new recording.

When Stop crosses a start Core has already accepted, ordinary events remain
fenced, but that start's one initial `browser.tab` marker is admitted and
awaited before teardown. Its Stop timestamp is then taken after the marker,
so Core sees one ordered start marker followed by one close.

The background worker also records a tab change as an action
([`background/connection/tab-recorder.ts`](../../apps/extension/src/background/connection/tab-recorder.ts)).
`active-page.ts` hands it each tab Chrome activates or updates, and each tab
Chrome removes. The rules are these:
- **A switch** is recorded when a page a recording can see comes to the front
  and is not the page the recording is already in. The first page a recording
  sees in front is where it already is, so it is no switch. The `browser.tab`
  event carries:
  - `tab: { operation: "switch", urlPath }`, the pathname alone;
  - a `url` cut to origin and path;
  - the page's title;
  - the id of the tab switched to, so evidence is read from that page.
- **A new tab with no page yet**, whose URL is empty or `about:blank`, is
  waited for. The switch is recorded when the tab's first URL commits, if that
  happens within 10 s. A later commit records no switch, but the recorder
  follows the tab.
- **A close** is recorded only for the tab the recording is in, because replay
  closes the tab it is driving. Its event carries `tab: { operation: "close" }`
  and the tab's last origin and path. It carries no tab id, since no page is
  left to snapshot.
- **Never recorded:** passing through a page a recording cannot see, such as a
  browser page, the extension's own control page or a web store; and a tab
  change made while FluxIQ is running a command. That change enters the
  recording once, as the command's runtime confirmation.

A tab event goes through the same intake as a click, so it is sent once with its
input id and counted once. The recording-start marker is a `browser.tab` event
too. It carries no `tab`, which is what keeps it evidence.

A recording begins with a handshake
([`background/connection/recording-start/handshake.ts`](../../apps/extension/src/background/connection/recording-start/handshake.ts)).
A `client.start_recording` waits 750 ms for FluxIQ to answer, and FluxIQ accepts
with `server.start_recording`. On silence the recorder starts locally, so no user
action is lost, but never before that attempt's send has settled:
- **The window measures the user's wait.** It opens before the send, not after
  it. The send first looks the project up from FluxIQ over HTTP, for at most
  1,500 ms (`RECORDING_START_PROJECT_LOOKUP_BOUND_MS`), then goes on without one.
- **An elapsed window waits for the send.** An event recorded while the start is
  unsent would reach FluxIQ ahead of it, and nothing on FluxIQ's side could put
  it back. So nothing recorded reaches FluxIQ ahead of its start.
- **A late answer still counts.** One that arrives after the window has elapsed,
  but before the send has settled, still decides the start.
- **Each retry waits for its own send,** not an earlier attempt's, and gets a
  fresh window.
- **A send that never settles never falls back.** The start stays pending until
  it is cancelled, and pressing Record again only says it is starting.
  Disconnecting cancels it.

Stop owns starts which have not reached the public `recording` state too. A UI
preflight that has not claimed the handshake is cancelled locally after each
await and sends neither a false Start nor a false Stop. Once a handshake
identity exists, Stop synchronously cancels its timers and fallback, drains
the current send — including a detached retry — and then sends at most one
matching `client.stop_recording` when notification was requested. A send
rejection belongs to the cancelled start and does not strand or reject local
teardown. A late acceptance of that stopped identity is ignored.

If a server acceptance or local fallback already owns `starting`, Stop waits
for that exact start to finish its sole initial marker and then tears it down
once. Stop does not resolve while any pre-boundary continuation can later
activate the recorder.

A recording starts once
([`background/connection/active-recording.ts`](../../apps/extension/src/background/connection/active-recording.ts)).
Every way into one, a local start or a `server.start_recording`, goes through
`beginOnce`. A start is marked the moment it is decided, and another that arrives
meanwhile waits for it. `beginAccepted` first reads which recording a
`server.start_recording` names:
- **The pending start.** The handshake is cancelled, so the window never fires
  and the recording starts once.
- **A local start still under way.** It waits for that start, then only links
  the project FluxIQ named. The local start's missing project never overwrites
  it.
- **The recording already running,** whether the acknowledgement is late or
  repeated. It only links the project.
- **Another recording,** while a start is pending or under way, or a recording
  is running. It is ignored.
- **The recording this client last stopped.** It is ignored: it crossed that
  Stop on the wire, and restarting would record into a recording FluxIQ has
  closed.
- **Nothing of this client's own,** with no start pending or under way and no
  recording running. It is FluxIQ's own start, asked for from the web panel,
  and it begins.

A Start arriving after Stop's boundary captures that Stop and waits for its
teardown, whether the Stop fulfills or rejects, before rechecking lifecycle
owners. When Stop cancels an older UI preparation A, it detaches A from the
public UI single-flight slot while retaining A's promise for its own drain. A
later press B therefore owns a distinct request and waits one-way behind Stop;
A's identity-checked settlement cannot clear B. After Stop settles, UI and
server starts arbitrate at one final no-await gate: the first pending handshake
or `starting` owner wins, and the loser sends no competing Start.

FluxIQ Core keeps the same order on its side, in its Automation Studio client
gateway bridge (Core's
`packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`):
- a client's later messages wait for its start to settle, so they meet the
  recording it opens, or its refusal;
- a message the client sent before the start never lands in that recording;
- the acknowledgement is sent only once the recording is open, and never to a
  client that has already sent Stop for it.

A refusal is an answer, so it cancels the acceptance window — and it is
classified rather than treated as a connection failure. `classifyRecordingStartRefusal`
([`background/connection/recording-start/refusal.ts`](../../apps/extension/src/background/connection/recording-start/refusal.ts))
reads Core's `server.error` and separates three cases that arrive under two
wire codes:

- `recording.project_required` **with** an `activeProjectId` in the metadata —
  a project is open and its Automation Studio context has merely gone stale.
  Transient, so the handshake re-sends the same start after 400 ms, 1.2 s and
  2.4 s before giving up.
- `recording.project_required` with no active project — nobody has chosen one.
  Persistent; retrying would only hide the message that asks the operator to.
- `recording.project_context_mismatch` — Core has a fresh project and it is
  not the one that was asked for. Persistent for the same reason.

A refusal the handshake has stopped fighting becomes a `recordingBlock` on the
status: a title, what to do about it, and how many retries were spent. The
socket is left alone throughout, because a refused recording is scoped to the
recording and not to a session that is working.

Recording sessions start with a FluxIQ `StateSnapshot` rather than an empty
state object. DOM snapshots are converted into compact, factual state paths
under the `web` namespace, including page URL/title, viewport bounds, scroll
position, focused target, selected text, and a capped set of interactive
elements.

The browser capture lists every rendered element in composed document order,
across open shadow roots and every responding frame, with no count cap,
ranking, text cut or attribute allowlist (`content/rendered-elements.ts`,
`dom-snapshot.ts`, `describe-element.ts`). Nameless, transparent, small and
`aria-hidden` elements remain represented when rendered. Repetition,
front-layer and lead-statement facts annotate elements rather than reorder
them. Hidden/non-rendered subtrees and the extension's own UI are excluded.
The separate stored-state projection still selects at most 1,500 useful
elements for recording state paths; it does not bound the model's packet.
Its omission flags are in [page evidence](page-evidence.md#the-four-caps).
The model receives the complete screened packet, bounded only by Core's
1,000,000-token request window; an oversized request is refused before sending.

Beside the elements, a snapshot carries page-level evidence: the dialogs in
front of the page, what is painted over its controls, whether it is still
loading, its landmarks, its repeating structures, its forms, and how it was
navigated to. The wire contract for all of it is
[`domain/src/page-evidence/`](../../domain/src/page-evidence/types.ts), and
the background worker merges one capture per frame into a single tab snapshot
— see [page evidence](page-evidence.md).

Sensitive values are withheld at capture, unconditionally. A password input,
a one-time code, a card field, or anything marked `data-sensitive` yields no
value to an element descriptor, to a recorded event, to the page selection, or
to a runtime confirmation; only value *presence* travels, as the descriptor's
`hasValue`. The `captureInputValues` setting
([`shared/browser.ts`](../../apps/extension/src/shared/browser.ts)), which
defaults to on and reaches the content script with every recording message, is
a preference about ordinary controls — turning it on cannot re-enable a
sensitive value, and turning it off is not what protects one. The rule is one
function in `domain/src/sensitivity/`, re-exported for the extension by
[`shared/sensitive-field.ts`](../../apps/extension/src/shared/sensitive-field.ts)
and asked again by every domain reader. Where it is asked, what the wire
guards cover, and what they are not a boundary against are in
[sensitive values](sensitive-values.md).

A file input yields no value either, sensitive or not, and whatever
`captureInputValues` says, because its value is the chosen file's local name.
`readElementValue`
([`content/describe-element.ts`](../../apps/extension/src/content/describe-element.ts))
returns nothing for one. Its descriptor carries `inputType: "file"` and
`hasValue`, and its `input` and `change` events carry no `inputValue`. The
domain replays the choice as an upload that asks for its files at run time
([web capabilities](web-capabilities.md#recorded-actions)).

Primary user actions are not sent as a separate message type. Each one that
maps to a registered action input goes out as a `client.recording_event`
whose `metadata.inputId` names that input, and FluxIQ's gateway bridge
records an event carrying a registered input ID as that input. That is how
Automation Studio timelines distinguish operator actions from passive state
observations. Raw snapshots and state updates remain available as recording
observations through the client gateway bridge.

A recorded event's payload is `RecordingEventPayload`
([`shared/protocol.ts`](../../apps/extension/src/shared/protocol.ts)), which the
domain's `createWebAutomationRecordingEvent`
([`domain/src/client/gateway-mapping.ts`](../../domain/src/client/gateway-mapping.ts))
turns into the gateway event. A tab switch or close carries one field more,
`tab`. Reduced to the two fields that decide it, a switch reads:

```json
{ "kind": "browser.tab", "tab": { "operation": "switch", "urlPath": "/orders/details" } }
```

`tab` is the domain's `WebAutomationRecordedTab`,
`{ operation: "switch" | "close"; urlPath?: string }`, which the extension
imports rather than copies. A close carries no `urlPath`. A `browser.tab` event
is stored as `web.tab.state_changed`. The builder copies only `operation` and
`urlPath` into the stored `tab`, so a tab id or a full URL a caller adds to `tab`
never reaches the recording. The event's own `url` is a separate field: a tab
event the recorder sends cuts it to origin and path, and a runtime confirmation
sets it from the action result as it is.

A succeeded runtime action is confirmed on the same message: a
`client.recording_event` carrying `metadata.inputId` and
`metadata.runtimeConfirmation: true`, sent after its `client.action_result`. A
tab confirmation carries `tab` in the shape above. Which verbs confirm, and what
each carries, is in
[web capabilities](web-capabilities.md#recorder-trust-and-runtime-confirmations).

When a recorded action has an element, the background process derives
`visualTarget` with the same state ID algorithm used by snapshot conversion.
Executed action results do the same using the element actually resolved in the
page, so editor playback can highlight what the browser interacted with.

The side panel recordings tab reads saved summaries from FluxIQ Core:

```text
GET /api/recordings?page=1&pageSize=10
```

The extension includes the paired client token as a bearer token when one is
available.

The extension keeps only transient recorder UI state for the active browser
session. It does not persist canonical recordings locally.

## Defining An Extraction

While a recording is running, the user picks one example item on the page — a
product card, a table row — and FluxIQ records an extraction of the whole list it
belongs to. Three parts share the work, and one file,
[`shared/extraction-messages.ts`](../../apps/extension/src/shared/extraction-messages.ts),
is the message contract between them:

- **the page** ([`content/picker/`](../../apps/extension/src/content/picker/index.ts)):
  the overlay, the pick, the confirmation preview, and the `data.extract` event
  the recorder emits;
- **the worker** ([`background/extraction/`](../../apps/extension/src/background/extraction/index.ts)):
  the session, who may drive it, the confirm path, and the one read;
- **the panel** ([`panel/extraction/`](../../apps/extension/src/panel/extraction/index.ts)):
  where columns are renamed, removed or excluded. The Chrome side panel and the
  Firefox popup are the same module, so this is one flow in both browsers.

The entry point is enabled only while the extension is connected and a recording
is running on a page it can drive, because an extraction is recorded into a
recording. The feature needed no new manifest permission: the picker runs in the
content script the recorder is already in.

### The Pick Is Not An Action

The picker's listeners are on `window` in the capture phase. The recorder's are
on `document` in the capture phase
([`content/dom-events.ts`](../../apps/extension/src/content/dom-events.ts)), and
the DOM's capture path runs window first, so the picker's
`stopImmediatePropagation()` runs before the recorder's listener does and the
press that chose the list is not also recorded as a click on it.
`preventDefault()` is the other half: without it the press activates what it
landed on, so picking a product name follows its link and leaves the page the
proposal describes. Both are needed, and neither substitutes for the other.

The whole press sequence is swallowed, not just its first event
([`content/picker/session.ts`](../../apps/extension/src/content/picker/session.ts)).
A browser sends `pointerdown`, `mousedown`, `pointerup`, `mouseup` and `click`
for one press, and `contextmenu` or `auxclick` for the other buttons. The pick is
taken on `pointerdown`, and the listeners stay up draining the rest until the
sequence ends at `click` or `auxclick`, with a 10 s backstop so a sequence that
never ends cannot leave the page unable to be clicked. Tearing them down on the
press would let the tail of that same press through to the recorder, which is the
bug the arrangement exists to prevent. Escape cancels the pick and is swallowed
likewise, so it is not recorded as a key the page was sent.

**That ordering is observed, not assumed.** It is a claim about the DOM's capture
path, and a claim of that kind is exactly what stops being true without anything
failing.
`apps/extension/e2e/content/tests/extraction/tests/extraction-picker.spec.ts`
runs the picker in real Chromium: a trusted click on a product link must leave
the recording holding no `dom.click`, the page must not navigate, and the overlay
going up and coming down must produce no `dom.mutation`, and a second row proves
that Escape hands the page back, since the same click then follows the link. The
two rules those rows rest on were each proved by mutating the source and watching
the row fail: registering the listeners on `document` records the pick as a
second `dom.click`, and removing the recorder's overlay filter counts the
highlight as a page change. Both mutations were reverted and the suite re-run
green.

The overlay is extension UI inside someone else's page, and three properties keep
it out of the page's way
([`content/picker/overlay.ts`](../../apps/extension/src/content/picker/overlay.ts)):

- **it takes no pointer event.** The host is `pointer-events: none`, so every
  press and move reaches the page element underneath and the picker reads the
  real target rather than its own highlight;
- **it is not part of the page.** Everything visible lives in a shadow root, so
  no page stylesheet reaches it and it adds no class or id a page could collide
  with. Styles are set through the CSSOM, because a page with a `style-src`
  policy blocks an inline `style` attribute and a `<style>` element alike, and
  nothing uses `innerHTML`, which a page requiring Trusted Types makes throw;
- **it is not a page change.** The host carries `data-fluxiq-picker`, which
  `isExtensionUiNode`
  ([`content/picker-host.ts`](../../apps/extension/src/content/picker-host.ts))
  tests for, together with the activity overlay's `data-fluxiq-activity`, and
  the recorder's mutation counter skips — the host arriving and
  leaving, and anything the overlay does inside itself.

### What Crosses The Channel

**A proposal carries selectors, names and counts only**, never a value read from
the page. It crosses a message channel and is shown before the user has decided
anything, including which columns hold something private, so it has to be safe to
show whatever the page happens to hold. That is why a proposed field's spec
cannot carry an element fingerprint at all
([`domain/src/extraction/proposal.ts`](../../domain/src/extraction/proposal.ts)):
the one fingerprint normalizer records an element's text, value and link target.
A *recorded* definition may carry one, because by then the user has seen the
columns and chosen which to exclude. A label is a test id, a column header, an
attribute name, or the item's own tag and position; text read inside an item is
never a label.

**A refusal names a reason from a fixed vocabulary** rather than quoting page
content. A pick is refused as `target_not_found` or `no_repeating_run`, a content
message as `not_picking`, `unreadable_request`, `not_recording` or
`invalid_definition`, and a `value` pick as `value_form_unsupported`, which is the
one word here about FluxIQ rather than about the page. `unreadable_request` is
what the worker is told when a field resolved to a sensitive control — not which
field, and not what it held.

**The confirmation preview is the one extraction payload that carries page
values.** At most 20 rows are read for the panel to show while the user chooses
columns. They travel from the frame to the extension's own UI and nowhere else:
never recorded, never stored, never exported, and never written to
`chrome.storage`. The read is of the page as it stands, with no pagination, so
the user confirms against the page they picked on, and its minimum is 0 because
an empty preview is a fact to show rather than a failure.

### An Excluded Column Is Never Read

Excluding a column is not masking it afterwards. The column is absent from the
request, so no value of it is ever read: none reaches the preview, the records,
the dataset, an export, or Core's saved run trace. The rule is enforced at three
points rather than one, because a single point is one refactor away from becoming
a filter over rows already read:

- **inference pre-selects it.** A field whose element is, or sits inside, a
  sensitive control is proposed `handling: "exclude"` and can be proposed nothing
  else (`content/extraction/infer-fields.ts`). The user may change it in the
  picker, which is where that decision belongs;
- **the preview is re-read, not filtered.** An edit changes which columns the
  panel may show; the panel sends that set with `fluxiq.getExtractionSession`,
  the worker's stored rows no longer match it, and the page is asked for a fresh
  read that does not name the excluded column
  (`background/extraction/control.ts`). The panel drops the values from its own
  copy in the same turn, so neither half is left holding them, and un-excluding
  brings nothing back, because there is nothing left to bring;
- **the page drops it before reading.** `normalizeExtractField`
  (`content/extraction/field-spec.ts`) answers `undefined` for an excluded field,
  so nothing on the page is read for it.

The background store erases earlier rows as soon as a narrower or empty preview
selection arrives. Empty selection sends no page read. Only the current session,
proposal and preview operation may commit rows or clear a failed read; identical
pending selections share one read. Replies copy at most twenty rows and retain
only the proposal keys their caller requested. Deleted or replaced sessions do
not publish captured replies. These are preview lifecycle safeguards; session
binding and receiver mutation ownership are separate contracts.

What *is* recorded is the exclusion itself: the field stays in the recorded
request as `handling: "exclude"`, and Core's record schema declares it the same
way. That is the record of a decision the user made — drop it, and the next field
detection proposes the column again and the user excludes their card-number
column a second time. Core then copies captured rows by allowlist, so an excluded
field's value reaches neither the values map, nor a later node's inputs, nor the
saved trace. What the guarantee covers, and what it does not, is in
[sensitive values](sensitive-values.md).

### Who May Drive It

Every message in `EXTRACTION_RUNTIME_MESSAGES` is accepted from the extension's
own side panel or popup and from nothing else. `isControlPage`
([`background/control-page.ts`](../../apps/extension/src/background/control-page.ts))
asks three things, and all three matter: the sender is this extension, because
another extension may send to this one and its messages arrive the same way; the
sender has a URL at all, because `undefined === undefined` would otherwise pass
an absent one as a match; and the URL is **exactly** `sidepanel/index.html` or
`popup/index.html` as `chrome.runtime.getURL` spells it. Not a prefix and not an
origin: every page this extension serves shares one origin, so an origin test
would accept any of them, and a prefix test would accept `popup/index.html.evil`.
The same predicate gates scripted navigation, and it lives in one file because it
was briefly written twice — two copies of a check like this is how a hole appears
later, when someone tightens one of them and nothing fails.

`fluxiq.test.defineExtraction`, the seam the Testing Lab drives a read through
without a human pick, is the sharpest case: it runs an extraction and answers
with the records, so a page under test that could send it would be able to drive
FluxIQ's own reader and read the page back out of it. It is refused like the
rest, and `background/tests/extraction-control.test.ts` proves the refusal — from
a page sender, from another extension, and from an extension URL that is not one
of the two control pages.

The pick itself is the one message that comes from a content script by
definition, and it is checked no less strictly: it is accepted only from frame 0
of the very tab the session was opened against, so neither another page nor a
child frame of the page under test can fill a session the user opened elsewhere.

### The Session

A session lives in the worker's memory and nowhere else
([`background/extraction/session-store.ts`](../../apps/extension/src/background/extraction/session-store.ts)):
one per tab, replaced by the next pick on that tab, and dropped when the tab
closes or its top frame navigates away, since both leave the page the proposal's
selectors were written against. Nothing is written to `chrome.storage`, because a
session holds a preview, and a durable preview is exactly the artefact an
excluded column must never reach. A service worker torn down loses the session
and the panel starts the pick again; that is the intended trade.

The panel owns no truth about the pick. It reads the session back on mount and on
a timer while the user is still choosing an item, because in Firefox the popup is
destroyed the moment the user clicks the page, so a panel that remembered its own
pick would have nothing to remember. The Chrome side panel, which is never
destroyed, takes the same path.

A pick that proposed nothing leaves the session open carrying the word that says
why, and the worker puts the overlay back up. The frame closes its own overlay on
every press and forgets its own session when the press finishes, so without that
re-arm the panel would say "pick another item" over a page that could no longer
be picked in, and the only way out would be Cancel.

### Confirm: Record First, Then Read

Confirm is refused outside a recording, because a definition nothing keeps is a
silent no-op to the person who just confirmed it. Then the recording comes first
and the read second
([`background/extraction/confirm.ts`](../../apps/extension/src/background/extraction/confirm.ts)).
The recorded `data.extract` is what a Flow is later built from and it must land
whether or not the read succeeds: a list that came up short of its minimum is a
failed read of an extraction the user really did define, and recording after the
read would lose the definition every such time.

Nothing the read returns is stored. The records go back to the caller in the
reply and are held nowhere else — not in the session, which drops its preview
when the extraction is recorded, not in `chrome.storage`, and not in the recorded
event, which carries the definition and counts alone.

Two rules keep the worker honest about what it runs:

- **the definition is the domain's, rebuilt.** `runnableExtractListRequest`
  (`background/extraction/definition.ts`) puts the finished definition through
  `webAutomationRecordedAction`, the one reader that decides whether a recorded
  extraction becomes an executable node, and runs the request that reader
  rebuilt. A definition the domain refuses is neither recorded nor run, so the
  worker cannot run a read the replayed Flow would not;
- **the timeout is the domain's number.** The page waits up to 10 s for *each*
  page of a list, so the budget is `webAutomationExtractListTimeoutMs`
  ([`domain/src/actions/extraction/request.ts`](../../domain/src/actions/extraction/request.ts)):
  the per-page wait times the pages the request may follow, which is `maxPages`
  for every mode that follows pages and `maxScrolls` for a scrolling list. It is
  imported rather than restated. The worker once carried a flat 60,000 ms ceiling
  of its own, because the function could not be reached from `domain/client`, and
  that truncated every read past six pages; the function is exported there now,
  so the worker's budget and the recorded node's declared budget are one number.

### What The Recording Holds

The frame records the extraction, not the worker, because the frame is where the
recording is sequenced: `data.extract` is an executable kind, so a pending
mutation batch is flushed ahead of it and the event lands after the changes that
preceded it and before whatever follows, exactly as a click does. An event
injected from the worker would have no place in that order.

The event carries the definition and nothing else. No element descriptor is
attached, although the recorder's other kinds carry one: a descriptor holds the
element's text, and the element a list extraction was defined on is the list, so
its text is the records. The definition is checked for shape in the frame and
then rebuilt field by field by `webAutomationRecordedExtraction`
([`domain/src/actions/extraction/recorded-definition.ts`](../../domain/src/actions/extraction/recorded-definition.ts))
when the gateway event is built, so what is stored is selectors, field keys,
labels, counts, and the dataset's own id and name. An unknown key a producer put
beside the definition is never copied — refusing it would make a stray key break
recording, while copying it would be the leak. Every field key is checked against
the domain's key rule and the dataset id against Core's, so a definition that is
recorded cannot make Core refuse the whole candidate at approval. The activity
log is told the form, the number of columns and the item count, and no more.

A recorded extraction maps to one input, and only a list definition does:

| Input | Output |
| --- | --- |
| `web.user.data_extraction_defined` | `web.dom.extract_list` |

A single value has no input. The worker refuses to start a `value` pick and
refuses one that arrives anyway, because a value extraction needs an element
target that the picker's recorded event deliberately does not attach; accepted,
it would be stored as passive evidence and never become the `web.dom.extract`
node the user thinks they defined, and refusing at the pick is the only way they
find that out. An input was registered for it once, mapping to `web.dom.extract`.
Nothing could reach it, so it named a capability the product does not have, and
it was removed; the domain still reads a value definition, which stays evidence,
and registering the input again is one row when the picker can record one. A
definition `webAutomationRecordedExtraction` refuses stays evidence too, rather
than becoming an extraction that reads something other than what was picked.

Every extraction reads one document: the frame the action is delivered to. The
request names no frame — a frame is addressed on the command, exactly as it is
for a click, and `browserFrameId` and `browserFrameUrlPath` travel on a recorded
node's parameters — and a request that names one is refused rather than read
against another document. The picker takes a pick from the top frame alone, and
the confirm path dispatches with `frameId: 0`, so no extraction defined today
names a child frame.

## Recording Proposals

When Core turns a recording into a proposal, it shows the web recording mapper,
`mapWebRecordingObservation`
([`domain/src/web-panel-host.ts`](../../domain/src/web-panel-host.ts)), each
timeline entry together with up to 32 entries after it (`following`). Besides
the node each recorded action maps to, the mapper reads `following` for two
things: the page a click landed on, and a page change just before a click.

### A Click's Landing

A recorded click proposes the page it landed on as its expected state, built in
[`domain/src/runtime/expectation/click-landing.ts`](../../domain/src/runtime/expectation/click-landing.ts).
The mapper looks in `following` for explained landings that name the click, and
takes the **last** one, since a client redirect can commit twice. The claim it
adds is exactly:

```json
{ "conditions": [{ "assert": { "kind": "url", "expected": "/the/landing/path" } }], "mode": "all", "timeoutMs": 5000 }
```

It holds a path only, never an origin, query, fragment, selector, text or
value. The URL assert judges it as a substring of the page's address, so it
still holds when a run serves the same pages from another origin. How a
landing names its click depends on how the click was recorded:

- **As Core's `action` entry.** This is how a live click is recorded, because
  the extension sends a click with its action input id. Core's IO recorder
  keeps the recording event's own id on that entry as `metadata.eventId`. A
  landing names the entry only when its `explainedByEventId` equals that stored
  id, verbatim and non-blank. The entry holds neither the click's sequence nor
  its page URL, so it is never named by sequence. For a linked entry, the
  mapper returns the candidate Core's own fallback
  (`recordingActionEntryCandidate`) would propose, with the claim added. The
  output, parameters, source input, confirmation, confidence `0.95` and label
  `Web Dom Click` are all the fallback's.
- **As a click domain event** (`web.element.clicked`). A landing names the
  click when its `explainedByEventId` equals the id the domain's builder
  rebuilds from the click's `payload.sequence` and timestamp. A landing with no
  event id names the nearest preceding click in the same tab whose sequence
  equals `explainedBy`. That rule reads each side's tab from
  `metadata.sourceId`. Core keeps a domain-event entry's `sourceId` as a
  top-level field, which a recording mapper is not shown, and every landing this
  extension sends carries the event id, so the rule serves only a client that
  puts `sourceId` in both events' metadata. The claim is added to the mapper's
  own click candidate,
  and none is made when the landing's path is the click page's own path.

Every click that no landing names keeps the candidate it had without this
feature:
- an `action` entry that no landing names maps to `null`, and so does one
  that is not a click or that Core marks `policyEligible: false`, so Core's
  own fallback candidate stands for each;
- a click domain event that no landing names gets the mapper's click candidate
  with no expected state.

No claim is made for a landing on `/`, or for one whose URL has no readable
path. The landing itself proposes nothing.

When a proposal is appended to a Flow, the claim becomes the recorded node's
`parameterValues.expectedState`. After that node's action succeeds, Core asks
the host to evaluate it. The domain's expectation evaluator then sends it to
the page as a `web.dom.assert`. So a replayed click that lands anywhere else
fails, instead of passing because nothing threw. [Action Surface](#action-surface)
describes how that failure is named on a sign-in gate.

### A Wait Before A Late Target

A recording that saw the page add something just before a click proposes waiting
for that click's target first. A replay that reaches the click before the page
has added its target then waits for it, rather than failing to find it. The rule
is `webAutomationLateTargetWait`
([`domain/src/recording/proposals/late-target-wait.ts`](../../domain/src/recording/proposals/late-target-wait.ts)).

It starts from a `dom.mutation` batch that added at least one node. Core hands the
mapper that batch as an `input.event` observation whose payload is
`{ latestEvidence }`. The batch's document is its URL without the fragment. A
batch that only removed nodes, or changed attributes or text, proposes nothing.

The first executable entry in `following` decides. A Core `action` entry is read
by its output id, and any other entry through `webAutomationRecordedAction`.
Evidence before it is skipped. A wait is proposed only when all of these hold:
- the entry is a `web.dom.click` with a non-empty selector;
- the click is in the top document. The wait names no frame, so it would run
  there, and a click recorded in a child frame proposes nothing;
- the click's own URL, when it carries one, is the batch's document apart from
  the fragment. An `action` entry carries no URL;
- no evidence skipped on the way names another URL, which would mean the page
  changed between the addition and the click.

Nothing is proposed when the next executable entry is anything else, even if a
click comes after it, or when no executable entry follows within `following`.

The proposal is a `web.dom.wait_for_selector` for the click's selector, with the
condition `present`, confidence `0.9` and label `Wait for element`. It carries no
`sourceInputIds` and no `expectedConfirmation`: Core refuses a source input that
is not action-role, and a wait has no echo to confirm. The rule does not check
that the added node is the click's target, so any addition before the click
proposes the wait.

The wait comes from the batch's own entry, never the click's. In
`mapWebRecordingObservation` it is tried only for an observation that no action
maps from. A candidate returned for a click's `action` entry would replace Core's
fallback click. So the click keeps the candidate it has without this rule, and
the proposal reads wait, then click.

The rule depends on the order the two entries are stored in:
- the recorder sends a pending batch before any executable event
  ([Recording Evidence](#recording-evidence));
- Core stores one client's recording messages in the order it received them,
  although its WebSocket host handles one socket's frames concurrently (Core's
  `packages/fluxiq/src/programs/automation-studio/client-gateway/client-recording-write-order.ts`).

Without both, the click could be stored before the addition that revealed it, and
no wait would be proposed. `domain/src/tests/core-gateway-recording-order.test.ts`
pins this end to end. It sends the eight messages of a live `delayed-ui`
recording through Core's own client gateway, concurrently, and requires the
proposal click, wait, click. The rule's own cases are in
`domain/src/recording/proposals/tests/late-target-wait.test.ts`.

### An Extraction's Dataset And Budget

A recorded extraction's candidate (`extractionCandidate` in
[`domain/src/web-panel-host.ts`](../../domain/src/web-panel-host.ts)) differs
from every other action's in three ways:

- **it carries no `expectedConfirmation`.** Core waits for the confirmation input
  whenever one is set, and the extension confirms no extract action, so a
  confirmation would fail every replay after five seconds. The late-target wait
  omits it for the same reason;
- **a list carries a `recordOutput`**, which is what makes the approved node save
  its rows as a dataset: the dataset's id and name, a schema over every field the
  request declares — the excluded ones included, carrying their `handling` — and
  `writeMode: "append"`, so a paginated read's later pages add to the rows the
  earlier ones stored
  ([`domain/src/recording/proposals/record-output.ts`](../../domain/src/recording/proposals/record-output.ts)).
  The single-value form carries none: one value is not a list of records;
- **a list carries a scaled `timeoutMs`**, the same
  `webAutomationExtractListTimeoutMs` the picker's own run uses. Core otherwise
  sends the node's 5,000 ms default as the command timeout, which would cut a
  paginated read short at its first page.

### Stable navigation controls

Automation export controls retain their identity across status updates for the
same flow, run, dataset and format. Notice openers retain pending/error state.
When a focused control is removed, the strip selects a visible enabled neighbor
or fallback only while the extension document owns focus. Refresh never pulls
focus back from the browser page. Tab arrows and Home/End retain native roving
navigation; modified and composing key events remain unconsumed.

Explicit activation of a focused automation row opens its target, shows Chat,
then hands keyboard focus to the visible enabled composer or selected Chat tab.
Latest Back similarly chooses the composer or the labelled Chat container. These
handoffs require the activating control to own focus in the visible active
extension document. Passive status updates, reconnects and late replies do not
claim focus. Local DOM/event tests cover the ownership rules; live browser and
assistive-technology behavior remain unverified.

Names from the refreshed automation list synchronize the open same-flow Chat
context, placeholder and strip labels through a metadata update. This preserves
conversation generation, history, draft selection and reading position, and does
not request detail or claim focus. A flow absent from a confirmed current list
keeps its conversation and remembered name with disabled Run and current-list
unavailability feedback. Loading, offline and failed reads do not imply deletion.

### Extraction dialog lifecycle

The Open FluxIQ utility serializes pending requests and scopes refusal feedback
to its initiating Core address. An already observed address change prevents a
late refusal from installing stale feedback; same-address errors retain retry.

Report a problem holds one lock through report generation, file preparation and
clipboard acknowledgement. A new request hides the previous download until a
current report is prepared. Copy failure retains the current file; file creation
failure still attempts copying. Fixed recovery feedback handles unavailable
browser delivery APIs. Report generation/redaction remains background-owned.

The shared Activity feed orders read replies and observed pushes independently.
An overlay acknowledgement cannot replace newer observed activity. Stopping the
feed invalidates old listeners and local completions; a later direct read remains
legal without starting a subscription. This fences presentation without claiming
to cancel an already issued background mutation.

Panel status reads publish only while they remain the latest requested read and
no newer push or command acknowledgement has been observed. This prevents slow
startup reads from rolling the displayed connection/recording state backwards;
request results and command acknowledgement publication retain their contracts.

Conversation reads invalidate old publications on thread or connection changes.
Answers dispatch only for a pending ask in the confirmed current thread; each
operation owns its completion and lock, so an old same-ID answer cannot release
the new thread's pending answer. Injected request throws/rejections use fixed
recoverable feedback and retain ordinary fulfilled relay failure behavior.
Accepted sends retain their original destination across thread changes. A late
refusal cannot place the newly opened thread into fallback; disconnected state
takes precedence over fallback. Mounted Chat also observes gateway/Core address,
client, project and pairing context. Owner replacement retires old thread/feed
instances, history, subject callbacks and timers before announcing the latest
target. Same-owner reconnect and passive names retain draft and reading state.
After explicit inactivity, fresh reads wait for activation; the historical first
initialization read remains supported. Unsupported relay capability stays tied
to the mounted lifetime.

The composer keeps a single versioned local UI draft with nonsecret owner
metadata. Foreign or unowned legacy text remains visible and requires explicit
Use draft here or Clear draft; typing and examples never silently adopt it.
Matching owned text restores without repeated review. Writes install the atomic
versioned record before removing the literal legacy key, and an empty record
prevents legacy resurrection. Owner/edit leases prevent accepted old sends from
clearing newer or adopted text. This convenience owns no durable project data.

Automation metadata and controls use a local owner revision for confirmed
gateway/Core address, client, project and pairing context. Missing optional
settings retain the confirmed Core address; volatile runtime/session evidence
does not reset an owner. Replacements retire foreign rows, details, notices and
rendered callbacks. Connection epochs retire pending operations while retaining
same-owner confirmed metadata. Current run/export operations verify their known
flow/run/dataset tuple and own acknowledgement, delivery and lock release. A
parsed detail summary that explicitly names another run or flow is withheld;
legacy omitted summaries remain supported. Offline controls dispatch nothing,
and a new active owner can recover from an old unsupported-list fallback using
the existing cadence. These are frontend publication/activation guards and do
not cancel or authorize commands already accepted by the background.

The shell's separate working feed uses the same confirmed remote owner tuple.
Owner changes retire its read/push instance before Record/Extract/Run consume
activity, reset the prior raw/held state, then use current runtime fallback and
current paced activity. Timer epochs reject canceled callbacks. Same-owner
reconnect and existing tab/pagehide subscription behavior retain400ms-on and
1200ms-off holding; unsupported capability stays tied to the mounted shell.

Dataset export retains its operation lock through browser delivery. Preparation
or click failure shows local Retry/Open FluxIQ feedback and releases the lock.
Temporary download links and owned URLs are cleaned up on success and failure,
with delayed URL revocation retained after the click. Issued exports are never
automatically replayed and a click is not claimed to prove file persistence.

The extraction sheet temporarily mounts at the extension document root while
open, isolating other extension controls and preserving their prior inert state.
It restores its current host and a visible extension control on close. Focus
handling stays inside the active extension document; selecting the browser page
does not cancel a pick or pull focus back. Field redraws preserve the logical
control and text selection where possible.

Column-name inputs retain raw typing independently of redraw, including spaces
and temporary blanks. Explicit change or Confirm applies the existing trimmed,
nonempty label policy. Current row callbacks belong to their draft and render
generation; detached rows cannot edit a replacement draft or captured receipt.
Column groups and name/read-kind/remove controls identify their current column
through text-only accessible names. Preview privacy narrowing stays unchanged.

Session, preview and pick-start failures expose explicit current-stage recovery.
A hidden initial restore failure offers recovery near the entry without opening
a sheet automatically. Reading retries preserve the existing session and do not
prepare or start another pick; uncertain start retries first inspect that session
and retain a successful preparation milestone. Preview operations and Retry
controls own their selection/generation, so obsolete failures cannot replace a
newer preview or clear mutation feedback. Background refusal provenance retains
authored refusal text; unexpected read errors use fixed local feedback. Picker
polling remains600ms and stops on failure until explicit recovery.

Confirmation freezes editing until acknowledgement. Cancellation immediately
clears preview values from memory and rendered cells, retaining a visible pending
or retryable failure sheet until the background acknowledges it. Per-operation
epochs reject obsolete mount, polling, preview and command completions. The
background remains the session owner across Firefox popup recreation; polling
and column privacy rules remain unchanged. Controlled DOM tests verify these
transitions; live browser focus and assistive-technology behavior remain unverified.

## Default Endpoint

Extraction binds each draft to its actual backend session ID, tab and form.
Initial discovery selects the automation tab; subsequent reads, preview,
Confirm and cancellation name the selected ID and do not follow a replacement.
Missing selected sessions retire the draft; malformed or mismatching replies
cannot publish executable controls. Recovery tickets and polling share that
binding. Cancellation erases draft values immediately while retaining the ID
for an explicit failed-cancellation retry. Receipt Close cleans local UI.
Older optional low-level callers retain omitted-ID compatibility and its risk.
IDs provide correlation, not authorization or ordering of content commands.
Receiver lifecycle and confirmation idempotence require separate validation.

Chat question inputs submit on plain, unhandled Enter. Composing events,
legacy IME key code229 and modified Enter leave the native event untouched;
answer buttons retain their existing behavior. Conversation ownership and
submission coordination remain in the existing Chat controller.

List extraction observes queued page work once before declaring an unchanged
growth window complete. It then rereads the item count and absolute command
deadline. This observation grants no extra growth window; an elapsed deadline
returns a timeout. Existing reveal limits and polling intervals remain intact.

The default development endpoints are:

```text
Gateway: ws://127.0.0.1:4777/client
Core API: http://127.0.0.1:3000
```

### Cleared checks and later action failures

Navigation and click landing results retain a self-clearing check's elapsed milliseconds even when the destination or subsequent navigation verdict fails. The gateway payload keeps the domain's `checkWait`; the outer gateway result also carries the screened generic `clearedWait` for Core's transport runtime path. Direct domain dispatch and runtime adapters preserve the same fact independently of success. Core resolves the check card as `waited_out` while the action keeps its own failure.

Core also settles durably parked run asks as `timed_out` at their deadline and as `cancelled` before project deletion. A service restart detects overdue sessions when they are read; indefinite waits keep waiting.
