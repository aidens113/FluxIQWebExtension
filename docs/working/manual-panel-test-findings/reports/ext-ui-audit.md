# Extension UI audit and simple-view specification

Worker report. Audited the committed tree only (`git show HEAD:<path>`, with
HEAD at 260a4e17 in this repository and 717f035 in FluxIQ Core). Every line
number below is a HEAD line number. No product code was edited.

## Outcome

Done. The report covers all five parts of the brief: the inventory, the
first-contact trace with step counts, 20 mechanical defects with citations
plus a label-by-label vocabulary table, a
simple-view specification with copy for every label, and a target module
layout. It ends with a four-workstream partition over disjoint files, run in
two waves.

The two findings that shape everything else:

1. **The extension cannot do two of the product's four core jobs.** It has no
   control to run an automation and no way to ask FluxIQ anything. It cannot
   stop a run either, except by disconnecting.
2. **Core does not yet let it.** Core's conversation and run-control
   endpoints sit behind the web panel's login cookie
   (`F:\!FluxIQ\apps\web\src\app\api\programs\[programId]\[endpoint]\route.ts:14-44`),
   while the extension holds only a gateway bearer token. Core's
   `/api/recordings` already accepts that token
   (`F:\!FluxIQ\apps\web\src\app\api\recordings\route.ts:18-19`), so the
   seam is small, but it is a Core change. The simple view is specified to
   ship without it and to fall back to "Open FluxIQ" until it lands.

## What changed and why

Only this report was written:
`docs/working/manual-panel-test-findings/reports/ext-ui-audit.md`. The brief
is read-only on product code. The report was written early and filled in
section by section, as the coordinator asked after the crash.

## Commands run and observed results

- `git show HEAD:<path>` for `popup/index.html`, `popup/index.ts`,
  `popup/styles.css`, `popup/extraction/{panel,field-row,client,index,panel-elements}.ts`,
  `sidepanel/{index.html,index.ts,styles.css}`, both manifests,
  `shared/{protocol,present,constants,browser}.ts`, `background/index.ts`,
  `background/connection.ts`, and
  `background/connection/{gateway-session,runtime-status,core-api,recording-start/refusal}.ts`.
  All returned content; line counts are 222, 519, 325, 1, 14, 49 and 52 for
  the page, script, stylesheet, side-panel entry, side-panel stylesheet and
  manifests.
- `diff` of HEAD's `popup/index.html` and `sidepanel/index.html` printed
  nothing, and the shell then printed `IDENTICAL`.
- `git grep` at HEAD for `.connect()` callers: only `background/index.ts:108`
  outside the gateway itself, so nothing auto-connects.
- `git grep` at HEAD for `setBadge|setIcon|action.set`: no output, so there is
  no toolbar indicator.
- `git grep` at HEAD for every `lastError` clear: three sites
  (`gateway-session.ts:219`, `server-command-channel.ts:253`,
  `active-recording.ts:325`).
- `git grep` at HEAD over `packages/test-runner/src` and `apps/extension/e2e`
  for the extension's accessible names and ids. This found the Lab journeys
  listed in section 5.
- In `F:\!FluxIQ` at HEAD: the gateway message union
  (`packages/contracts/src/client-gateway.ts:188-211`) has no conversation or
  run identity; the conversation endpoint names and request fields
  (`api/contracts/endpoints.ts:154-159`, `api/contracts/conversation.ts:32-92`);
  `cancel-runtime-session` exists (`endpoints.ts:146`); the program route
  authenticates by cookie only; and the default gateway port is 4777
  (`apps/web/src/lib/fluxiq.ts:253`).
- `git show HEAD:apps/extension/scripts/build-extension.mjs`: `copyStatic`
  copies only top-level `.html` and `.css` (lines 255-264).

No build, test or browser run was needed or performed: this is a read-only
audit.

## Not verified

- **Nothing was observed live.** Every layout claim (L1-L5) is derived from the
  committed CSS. The Firefox height figure (L3) is an estimate. The
  first-contact trace follows the code, not a session in a browser.
- The claim that `session_ready` arrives on the same socket as
  `pairing_required` (which is what keeps the pairing reason on screen, E3)
  follows from the gateway client's event handling. It was not confirmed
  against Core's server.
- The concurrent split worker's output was not read, as the brief required.
  Workstream A is written to absorb whatever it produced under `popup/`.
- esbuild emitting `index.css` for CSS imported from an ESM entry is standard
  esbuild behaviour, but it was not tried against this repository's build
  plugins.
- Whether Core's `list-runtime-sessions` or `get-runtime-session` exposes a
  Flow name for the "FluxIQ is working" line was not checked.

## Open questions or contradictions found

1. **Core seam (blocking for Ask and Stop).** Should Core accept the gateway
   bearer token on an allowlist of program endpoints (`list-conversations`,
   `open-conversation`, `get-conversation`, `append-turn`, `answer-ask`,
   `list-runtime-sessions`, `cancel-runtime-session`), acting as the user who
   approved the pairing? Or should the gateway protocol gain conversation and
   run-control messages? This report recommends the allowlist: it is the same
   pattern as `/api/recordings`, and it keeps the conversation owned by Core.
   It is a Core boundary change, so the supervisor must alert the user before
   the first Core edit.
2. **Run identity.** `server.execute_action` carries no Flow or run id, so
   the now card can say what step is happening but not which automation it
   belongs to. Either Core adds `flowName` and `runId` metadata to the command,
   or the panel reads them through the seam in question 1.
3. **The current manual host is non-default.** It listens on 4711, while the
   extension and Core both default to 4777. Every new person on that host
   takes the nine-step pairing path. Consider having Core's pairing page show
   the exact connection address to paste, or serving on the default.
4. **Lab journey churn.** Plain-English labels break
   `getByLabel("Gateway URL")` and similar in two Lab files. Section 5 assigns
   them to workstream C. If a live Lab campaign is running from `dev`, merge
   the rebuild between campaigns.
5. **Contradiction with the brief's premise.** The brief says the side panel
   "currently just imports the popup". That is true of the script, but the page
   is a full byte-identical copy of the HTML, so two copies of every id must
   be kept in step today. Section 5 removes the copy.

## 1. Inventory

Both surfaces are one page. `sidepanel/index.html` is byte-identical to
`popup/index.html` (a diff at HEAD prints nothing), `sidepanel/index.ts:1` is
`import "../popup/index";`, and `sidepanel/styles.css:1` imports the popup
stylesheet and only widens `body` (lines 3-14). Chrome opens it as a side panel
on toolbar click (`background/index.ts:188-192`, `manifest.chrome.json:13-15`).
Firefox opens it as a 380px popup (`manifest.firefox.json:8`,
`popup/styles.css:27`). Everything below therefore applies to both.

Verdict key: **Keep** (simple view), **Advanced** (move behind the switch),
**Rewrite** (keep the job, change the words or behaviour), **Drop** (dead,
duplicated, or meaningless to a non-engineer).

### Persistent chrome

| Element (HEAD `popup/index.html` line) | What it does | Verdict |
| --- | --- | --- |
| Brand mark "F" (12) | Decoration. | Keep |
| Heading "FluxIQ Recorder" (14) | Title. It names one feature, not the product; the product's jobs are running, repairing and asking. | Rewrite: "FluxIQ" |
| Active domain line (15; `index.ts:232`, `483-491`) | Hostname of the tab FluxIQ is attached to, or "No active page". | Keep, folded into the status sentence |
| Settings button, text `...` (17) | Opens the settings drawer. The glyph is three literal dots, not an icon. | Advanced entry; rewrite the glyph |
| Status dot (21; `index.ts:238-241`) | Grey, green, yellow or red. Red means *recording*, not error; the `error` state gets grey. | Rewrite |
| Connection label (22; `index.ts:235`) | The raw `connectionState` enum, capitalised by CSS (`styles.css:105`): "Disconnected", "Connecting", "Pairing", "Connected", "Reconnecting", "Error". The `.replace("_", " ")` is dead because no state has an underscore (`protocol.ts:53`). | Rewrite as a sentence |
| Connect button (23; `index.ts:105-108`) | Saves *all* settings from the drawer form and opens the socket. It is the only path that saves settings. | Keep, relabel per state |
| Disconnect button (24; `index.ts:115-117`) | Closes the socket and stops reconnecting. | Advanced |
| Unsupported Page card (28-31) | Shows the background's reason a page cannot be recorded. | Keep, rewrite copy |
| Error line `#errorText` (112; `index.ts:446-449`) | Shows `status.lastError` or a command error, raw. | Rewrite (see section 3) |

### Tabs (33-37)

| Tab | Contents | Verdict |
| --- | --- | --- |
| **Recorder** (39-73) | Record button, runtime card, stats, extract button. | Split: record/stop and "right now" go to the simple view, runtime detail to Advanced |
| **Events** (75-91) | "Event Log": the background activity log, 25 per page, Prev/Next. | Advanced, renamed "Activity" |
| **Recordings** (93-110) | Core recordings list, 10 per page, Refresh, Prev/Next. Rows are inert, with no open, run or rename (`index.ts:369-388`). | Advanced |

### Recorder tab controls

| Element | What it does | Verdict |
| --- | --- | --- |
| Record button (40-43; `styles.css:147-163`) | A 132px circle that starts or stops a recording (`index.ts:123-130`). Its only text, "Start recording"/"Stop recording", is visually hidden (`styles.css:163`), so a sighted person sees a blue dot in a ring with no words. It is disabled unless connected and on a recordable page (`index.ts:249`), with no reason shown. | Keep, with a visible label and a smaller size |
| Runtime card (44-57; `index.ts:264-279`) | "Runtime idle / running / succeeded / failed", the command label, "Target" (a CSS selector, URL, or typed value: `runtime-status.ts:170-172`), "Tab" (a numeric browser tab id), and "Result" (a message or "5s"). Always shown, even before anything has ever run. | The simple view gets one plain sentence; the card moves to Advanced |
| Stat "Timer" (60-61) | mm:ss since the recording started, ticking every second (`index.ts:464-481`). | Keep, while recording only |
| Stat "Actions" (64-65) | `status.eventCount`. | Keep while recording, as "steps" |
| Stat "Queued" (68-69) | Size of the offline gateway queue (`gateway-session.ts:197`). Meaningless to a non-engineer, and almost always 0. | Advanced |
| "Extract Data From This Page" (72) | Opens the extraction sheet. Disabled unless recording (`index.ts:250`); the reason exists only as a hover `title` (`extraction/panel.ts:281`), which is invisible in a side panel and on touch. | Keep while recording; show the reason as text |

### Events tab

| Element | What it does | Verdict |
| --- | --- | --- |
| "Event Log" heading and last-activity "Idle/Now/5s" (78-79) | Relative time of the last entry. It refreshes only on a status render, so it goes stale. | Advanced |
| Page label "Page 1" (81) and Prev/Next (88-89) | Paging over an in-memory log. | Advanced |
| Entries (`index.ts:315-343`) | Label, detail and tone. The labels are engineering vocabulary: "Evidence: ..." (`background/connection/recorded-event-intake.ts:198`); "Fresh viewport screenshot stored" with a 12-hex hash and "@ Nms after event" (`state-assets.ts:46`); "Project context pending: Structured state will record; screenshots attach after FluxIQ links a project" (`active-recording.ts:533`); "Project lookup timed out ... N ms" (`active-recording.ts:489`); and "Runtime started: Click" in **warning** yellow for a normal start (`server-command-channel.ts:254`). | Advanced; the few person-level entries feed the simple view's "right now" line |

### Recordings tab

It shows a heading, the source host ("127.0.0.1:3000", `index.ts:348`), a
Refresh button, list rows and a pager. Each row has a title, the raw Core
`status` string in a pill that defaults to "saved", and "N events - date", or
the raw recording id when there is no date (`index.ts:377-385`). This goes to
Advanced. It is the only place Core data is listed, and nothing can be done
with a row.

### Overlays and drawers

| Element | What it does | Verdict |
| --- | --- | --- |
| Settings drawer (115-146) | "Gateway URL", "Core API URL", four toggles ("Auto reconnect", "DOM mutations", "Input values", "Snapshots"), diagnostics "Client", "Session" and "Tab" (raw ids), and a red "Reset Session". There is no Save button: edits are stored only when **Connect** is pressed, and Connect sits under the drawer's backdrop (`styles.css:234`) and is disabled while connected (`index.ts:251`). | Advanced, rebuilt |
| Pairing overlay (148-156) | A full-screen modal: "Waiting For Approval", "Pair With FluxIQ", a six-character code, "Approve the matching code in the FluxIQ web panel.", and Cancel (which disconnects, `index.ts:132-134`). It does not say where in the panel to approve, and offers no way to open the panel. | Keep, as an inline card in the simple view |
| Recording lock overlay (158-166) | A modal with a lock emoji, "Recording Locked", the heading **hard-coded** as "Open A Project First" (162), the block's message, and "Got It". The renderer writes only `block.message` (`index.ts:458-462`), so the two other refusals Core sends, "Project Mismatch" and "FluxIQ Is Catching Up" (`recording-start/refusal.ts:79,91`), appear under the wrong heading. | Keep, as an inline notice titled from the block |
| Extraction sheet (168-218; `extraction/panel.ts`) | Pick an example item; review columns (rename, what it reads, include/exclude, remove); an optional "Read every page"; a preview table; Cancel/Confirm; then "Captured N records into ...". This is the best-written surface in the extension: plain sentences, and refusals mapped to sentences (`panel.ts:60-64`). Its only raw error is the catch-all at `panel.ts:115`. | Keep; reached from the simple view while recording |

### Dead, duplicated, or meaningless

- **Dead:** the `.replace("_", " ")` (`index.ts:235`). The `paused` recording
  state (`protocol.ts:54`) is never rendered. The `timerHandle` cleanup on
  `unload` (`index.ts:466`) does not run in a side panel that is never
  unloaded. The default `recordingsSource` text "FluxIQ Core" (97) is replaced
  on the first load.
- **Duplicated:** the whole page (`popup/index.html` equals
  `sidepanel/index.html`). There are two independent error surfaces
  (`#errorText` and the extraction `#extractionNotice`) and two paging
  implementations (events and recordings, `index.ts:151-177`). Connection
  state is shown twice, by the dot and by the label, and a third time
  implicitly by the record button's disabled state.
- **Meaningless to a non-engineer:** "Runtime", "Target" (a selector), "Tab
  1234", "Queued", "Gateway URL", "Core API URL", "DOM mutations", "Snapshots",
  "Client", "Session", "Reset Session", "Evidence:", screenshot hashes, the
  Recordings source host, and "events unknown".

## 2. First contact

This is traced from code, not observed live. A "step" is one click, one typed
field, or one switch to another window.

### State A: installed, unpaired

Nothing connects on its own. `background/index.ts:39-42` builds the connection
object on browser start but never calls `connect()`. The only caller is the
Connect message (`index.ts:104-109`, repository grep of `.connect()`).
Opening the panel shows:

- "FluxIQ Recorder", "No active page" or the hostname, a grey dot,
  "Disconnected", an enabled **Connect** and a disabled **Disconnect**.
- The Recorder / Events / Recordings tabs.
- A large disabled circle with no visible words, then "Runtime idle / No
  command running / Target - / Tab - / Result -", then "00:00 Timer / 0
  Actions / 0 Queued", then a disabled "Extract Data From This Page".

Nothing says what FluxIQ is, that Connect is the first move, or that the
FluxIQ web panel must be running. Six of the eight visible controls are
disabled or inert.

**Is the next step obvious?** Partly. Connect is the only enabled button in
the main area. It works only when FluxIQ listens on the built-in default
`ws://127.0.0.1:4777/client` (`shared/constants.ts:1`, which matches Core's
default at `F:\!FluxIQ\apps\web\src\lib\fluxiq.ts:253`). The current manual
host listens on `4711` (working document `Current State`), so on that host
Connect produces the raw "WebSocket connection failed."
(`gateway-session.ts:146`), then "Reconnecting" with a backoff loop
(`gateway-session.ts:301-307`). Nothing points at Settings as the fix.

### State B: pairing

Once the socket opens without a token, the state becomes `pairing`
(`gateway-session.ts:220,267-270`). A full-screen modal shows the code and
"Approve the matching code in the FluxIQ web panel." It has no link to the
panel and does not say where the approval lives there. The only button is
Cancel.

**Steps to pair.** On the default host it takes four: open the panel, press
Connect, switch to the FluxIQ web panel, and approve the matching code. On any
other host it takes nine: open the panel, press Settings, type Gateway URL,
type Core API URL, close the drawer, press Connect, switch to the web panel,
approve, and switch back. The Lab journey drives exactly that longer
sequence (`packages/test-runner/src/demo-workspace/browser-session.ts:210-234`).
The pairing must be repeated by pressing Connect after every browser restart,
because nothing reconnects automatically (see State A).

### State C: paired, idle

The panel shows a green dot, "Connected", and an enabled circle. The error
line may still show the pairing reason, because nothing clears it on
`session_ready` (section 3, defect E3). The runtime card still says "Runtime
idle". There is no text input, no list of Flows, no "run" control and no
conversation.

**Is the next step obvious?** No. The only affordance is an unlabelled
circle. Pressing it without a project open in the FluxIQ web panel's
Automation Studio returns the lock modal "Open A Project First"
(`recording-start/refusal.ts:98-106`). If the Automation Studio tab is not in
front, Core's 10-second context freshness window
(`recording-start/refusal.ts:10`) produces "FluxIQ Is Catching Up", which is
shown under the same hard-coded "Open A Project First" heading.

### State D: recording

The dot turns **red** (the same colour a person would read as an error), the
circle shows a pulsing square, and the timer and "Actions" count tick. In
**Firefox**, the popup closes the moment the person clicks the page they are
recording. No toolbar badge or icon change exists (a repository grep for
`setBadge`, `setIcon` and `action.set` finds nothing), so while recording in
Firefox there is no visible sign that a recording is running. Stopping
requires reopening the popup.

**Steps to record one thing:** open the panel, then open a project in the web
panel (if none is open, that is three or more steps there), return and press
the circle, act on the page, reopen the panel (Firefox), and press the circle
again. That is five steps at best, and eight or more when no project is open.

### State E: FluxIQ running a Flow

The extension receives single `execute_action` commands
(`gateway-session.ts:276-286`). The contract carries no Flow, run or step
identity (`F:\!FluxIQ\packages\contracts\src\client-gateway.ts:202-211`). The
runtime card shows "Runtime running", then "Click", then a selector under
"Target", then "Tab 1234567". The Events tab logs "Runtime started: Click" in
warning yellow. After a failure, the error line keeps the failure message
until the next action starts (`server-command-channel.ts:263`).

**Is the next step obvious?** There is no next step to take. There is no
Stop. The only lever that halts a run from the extension is Disconnect, which
tears down the whole session.

### Steps to the core jobs

| Job | Steps from the extension, today | Possible from the extension? |
| --- | --- | --- |
| Pair with FluxIQ | 4 on the default host; 9 on a non-default host; repeated (Connect) after every browser restart | Yes, with the web panel's help |
| Record something | 5 at best; 8+ without an open project; Firefox needs the popup reopened to stop | Yes, with the web panel's help |
| Run an automation | No control exists. Recordings rows are inert (`index.ts:369-388`) and no Flow is listed anywhere | **No**: web panel only |
| Ask FluxIQ to do something | No text input exists anywhere in the extension | **No**: the conversation lives in Core's web app (`F:\!FluxIQ\apps\web\src\app\GlobalConversationPrompt.tsx`, `features/automation-studio/conversation/`) |
| Stop what FluxIQ is doing | Stop recording: 1 step. Stop a run: no control, only Disconnect | Recording yes; run **no** |

## 3. Mechanical defects

"Observed by reading" means the conclusion follows from the committed code and
CSS; none was reproduced live (see Not verified).

### Layout

- **L1. The main area's rows are assigned by which siblings happen to be
  visible.** `.app-main` declares four rows, `auto auto minmax(0,1fr) auto`
  (`styles.css:113`), for six children: the unsupported card, the tabs, three
  view panels, and `#errorText`. Hidden children are `display:none`
  (`styles.css:122`; `#errorText` through the user-agent `[hidden]` rule), so
  in the common case (supported page, no error) the tabs take row 1 and the
  visible view takes row 2, which is `auto`, not `1fr`. The `1fr` row is empty.
  The view panel is therefore never height-bounded. `.list-viewport` has
  `overflow:hidden` (`styles.css:204`), and the lists' `height:100%`
  (`styles.css:208`) resolves against an auto height, so the Events and
  Recordings lists do not scroll internally. Instead the whole document grows,
  and the Prev/Next pager falls below the fold. Only when the unsupported card
  is showing does the view land in the `1fr` row.
- **L2. Overlays are sized to the shell, not the viewport.** The settings
  drawer, the pairing and lock overlays, and the extraction sheet are
  `position:absolute; inset:0` inside `.shell` (`styles.css:235,246,266-276`).
  `.shell` has `min-height:100vh` and grows with content
  (`styles.css:43-50`), so when the page is taller than the panel, an overlay
  is taller too. The extraction sheet's Cancel/Confirm footer
  (`styles.css:324`) then sits at the bottom of the tall shell, off-screen,
  rather than pinned to the visible panel.
- **L3. The Firefox popup is at its height cap on the default view.** The
  fixed parts of the Recorder tab add up to about 600px: header 64, connection
  row 46, main padding 24, tabs 39, gap 12, and the recorder console with its
  132px button, runtime card, stats and extract button (about 415). Firefox
  caps popups at 600px. Any error line or unsupported card pushes the
  primary controls into a scroll area. This is an estimate from the CSS, not a
  measurement.
- **L4. Fixed widths fight the narrow panel.** `body{width:380px}`
  (`styles.css:27`) is overridden only for the side panel
  (`sidepanel/styles.css:3-6`). The runtime card is capped at 326px and the
  stats at 300px (`styles.css:165,174`), the record circle is a fixed 132px,
  and preview cells are capped at 140px with ellipsis
  (`styles.css:320`), so a two-word column value is cut off.
- **L5. Everything is dark.** `color-scheme: dark` is hard-coded
  (`styles.css:2`) with no light palette and no `prefers-color-scheme`
  handling, so the panel ignores the browser theme.

### State lost on view switch or close

- **S1. The Firefox popup forgets everything each time it closes**, which is
  every click on the page. The current tab (`index.ts:80`), the event and
  recordings pages (`index.ts:81-84`), and any settings typed but not yet
  "saved" by Connect (`settingsDraftDirty`, `index.ts:86,110-113`) all live
  only in module memory. Typing a Gateway URL, then clicking the page to copy
  the Core address, loses the typed URL.
- **S2. The Recordings list never refreshes on its own.** It loads only when
  its tab is opened or Refresh is pressed (`index.ts:163-165,390-395`). After
  stopping a recording, the list still omits it.
- **S3. Relative times freeze.** "Now", "5s" and "3m" in the Events tab and the
  runtime card are computed at render (`index.ts:236,278,328`) and are not
  re-rendered by the one-second timer (`index.ts:464-481`, which only redraws
  the recording clock).
- **S4. The extraction sheet can lose its result sentence.** After Confirm,
  the sheet shows "Captured N records ..." (`extraction/panel.ts:103-111`).
  Reopening the Firefox popup re-reads the session, and a `recorded` session
  closes the sheet (`panel.ts:134-137`), so the sentence is gone before it is
  read.

### Controls with no feedback

- **F1. Command errors are erased in the same tick they are shown.**
  `sendCommand` renders a failed response with `renderError(response.error)`
  (`index.ts:207`), then its `finally` calls `renderStatus(currentStatus)`
  (`index.ts:213`). That ends with `renderError(status.lastError)`
  (`index.ts:260`), which hides the message when the background has no stored
  error. A refused Start, Connect or Reset therefore flashes and vanishes.
- **F2. Disabled controls never say why.** The record circle
  (`index.ts:249`), Connect (`index.ts:251`) and the extract button
  (`index.ts:250`, reason only in a `title`) are disabled silently.
- **F3. The settings drawer has no Save.** Settings are written only by the
  Connect message (`background/index.ts:104-107`). Connect is covered by the
  drawer's backdrop (`styles.css:234`, z-index 19 over the connection row) and
  is disabled while connected (`index.ts:251`). Changing a capture toggle
  while connected therefore needs Close, Disconnect and Connect, and nothing
  says so. The toggles take effect only in the next `client.hello`
  (`gateway-session.ts:252-256`).
- **F4. "Reset Session" acts with no confirmation and no explanation.**
  It is one click (`index.ts:119-121`) and discards the pairing token
  (`background/index.ts:117-122`), forcing a re-pair.
- **F5. Busy state is inconsistent.** `setBusy` disables five buttons
  (`index.ts:442-444`) and then `renderStatus` re-enables them from status in
  `finally` (`index.ts:213,249-252`). The tabs, Refresh and the settings
  button are never busy-guarded, and there is no spinner or pending text
  anywhere.
- **F6. There is no Stop for a run** (section 2, State E).

### Errors shown as raw strings

- **E1. Transport messages reach the person unchanged:** "WebSocket connection
  failed." (`gateway-session.ts:146,265`); "FluxIQ recordings API returned
  401." (`core-api.ts:28`), shown as the Recordings empty state
  (`index.ts:358-363`); and any `server.error` payload message verbatim
  (`server-command-channel.ts:82`).
- **E2. A torn-down service worker surfaces as a TypeError.**
  `runtimeSendMessage` resolves `undefined` when nothing answers
  (`shared/browser.ts:27-34`). `refresh()` then reads `.ok` off it
  (`index.ts:191`) and throws an unhandled rejection, leaving the static HTML
  "Disconnected". `sendCommand` catches the same failure and shows "Cannot
  read properties of undefined (reading 'ok')" (`index.ts:209-210`), until F1
  erases it. The extraction client already guards this case with a plain
  sentence (`extraction/client.ts:13-16,30`), and the main page does not.
- **E3. Stale errors outlive their cause.** `lastError` is cleared only
  when a socket opens (`gateway-session.ts:219`), when a runtime action starts
  (`server-command-channel.ts:253`), or when a refusal is dismissed
  (`active-recording.ts:325`). The pairing reason set at `connection.ts:117`
  after the socket opened therefore stays in the red error line after pairing
  succeeds. A failed action's message (`server-command-channel.ts:263`) stays
  until the next action. "Connect to FluxIQ before recording."
  (`active-recording.ts:192`) stays after connecting.
- **E4. A failed runtime action shows the action's raw `message`**
  (`runtime-status.ts:65-66`) under "Result", next to a raw selector under
  "Target".
- **E5. The recording lock shows the wrong heading** for two of its three
  causes (section 1, overlays).

### Internal vocabulary in labels

These are the labels a person sees, with a plain-English replacement (the
full copy is in section 4):

| HEAD label (location) | Replacement |
| --- | --- |
| "FluxIQ Recorder" (html 14) | "FluxIQ" |
| "Disconnected / Connecting / Pairing / Reconnecting / Error" (`index.ts:235`) | Status sentences, section 4 |
| "Runtime idle / running / succeeded / failed" (`index.ts:271-274`) | "Nothing running" / "Working on ..." / "Done: ..." / "A step didn't work: ..." |
| "No command running" (html 49) | (not shown) |
| "Target", "Tab", "Result" (html 53-55) | Advanced only: "Page element", "Browser tab", "Outcome" |
| "Actions", "Queued", "Timer" (html 61-69) | "steps recorded"; "Queued" goes to Advanced as "Waiting to send" |
| "Event Log", "Events" (html 35,78) | "Activity" |
| "Gateway URL", "Core API URL" (html 123,128) | "FluxIQ connection address", "FluxIQ web address" |
| "Auto reconnect", "DOM mutations", "Input values", "Snapshots" (html 133-136) | "Reconnect automatically", "Record page changes", "Record what I type", "Record page snapshots" |
| "Client", "Session", "Tab" (html 140-142) | Advanced: "This browser's ID", "Connection ID", "Current tab" |
| "Reset Session" (html 145) | "Forget this pairing" |
| "Recording Locked", "Open A Project First", "Got It" (html 161-164) | The block's own title; "OK" |
| "Unsupported Page" (html 29) | "FluxIQ can't work on this page" |
| "Evidence: ...", "Fresh viewport screenshot stored", "Project context pending", "Runtime started: X" (activity log) | Advanced only; the simple view never shows activity-log labels |

## 4. The simple view

### Principles

1. **Default.** Every open of the panel lands in the simple view, unless this
   viewer last chose Advanced (see "Switching").
2. **Three questions, answered top to bottom.** Is FluxIQ connected and
   working? What is it doing right now? What do I want it to do, or to stop?
3. **One primary button per card**, labelled with the verb it performs.
4. **No engineering words.** No ids, selectors, URLs other than a hostname,
   enum values, hashes, or milliseconds. Raw text is reachable only through
   "Details", which opens Advanced.
5. **Chrome and Firefox render the same modules.** The simple view must fit
   the Firefox popup's 600px height with no scrolling in every state except a
   long conversation, which scrolls inside its own card.
6. **The conversation belongs to Core.** The extension renders one Core
   thread and posts turns into it through Core's endpoints. It keeps no
   message model of its own: no local turn list beyond what is on screen, no
   local ids, no model calls, no retry-and-merge logic. The only local state is
   the unsent draft, which is a per-viewer convenience.

### Layout (top to bottom)

```
+--------------------------------------------+
| FluxIQ                 [Simple|Advanced] (gear)|  header
+--------------------------------------------+
| (dot) Connected to FluxIQ                  |  1. status card
|       Working in: shop.example.com         |
+--------------------------------------------+
| Right now                                  |  2. now card
| FluxIQ is working                          |
| Search products: Typing into "Search"      |
|                                  [ Stop ]  |
+--------------------------------------------+
| FluxIQ: Found 24 products. Want a CSV?     |  3. conversation card
| You: Yes, only ones under $50              |
| [Ask FluxIQ to do something...    ][Send]  |
| Open the full conversation in FluxIQ       |
+--------------------------------------------+
| [ Start recording ]                        |  4. manual actions
+--------------------------------------------+
```

### 1. Status card

| Condition (from `ExtensionStatus`) | Dot | Sentence | Line below | Buttons |
| --- | --- | --- | --- | --- |
| `disconnected`, never paired | grey | FluxIQ isn't connected | Connect this browser so FluxIQ can work in it. | **Connect** |
| `disconnected`, paired before | grey | FluxIQ isn't connected | Connect to pick up where you left off. | **Connect** |
| `connecting` | amber | Connecting to FluxIQ... | (none) | Cancel |
| `reconnecting` | amber | Lost the connection. Trying again... | FluxIQ reconnects on its own. | **Try now** |
| `error` | red | Can't reach FluxIQ | Make sure FluxIQ is running on this computer, then try again. Link: *Check the connection address* (opens Advanced, Connection) | **Try again** |
| `pairing` | amber | Approve this browser in FluxIQ | The code in large type, then: In FluxIQ, approve the request that shows this code. | **Open FluxIQ** (opens the FluxIQ web address in a tab), Cancel |
| `connected`, recordable page | green | Connected to FluxIQ | Working in: *hostname* | (none) |
| `connected`, no page | green | Connected to FluxIQ | Open a web page for FluxIQ to work on. | (none) |
| `connected`, unsupported page | green | Connected to FluxIQ | FluxIQ can't work on this page. *Plain reason* | (none) |

Red is used **only** for "can't reach" and for a failed step. Recording uses
its own indicator in the now card, never the status dot.

The pairing state is an inline card here, not a full-screen modal, so the
person can still see what they are approving.

### 2. "Right now" card

| Condition | Title | Detail | Buttons |
| --- | --- | --- | --- |
| Nothing running, nothing recording | Nothing running | Ask FluxIQ below, or record the steps yourself. | (none; recording is in section 4) |
| `recordingState === "recording"` | Recording your steps | *mm:ss* · *N* steps on *hostname* (a red recording dot beside the title) | **Stop recording**, then *Extract data from this page* |
| `runtime.state === "running"` | FluxIQ is working | *Flow name, if Core supplies it*: *step sentence*, for example Clicking "Search" | **Stop** |
| `runtime.state === "succeeded"`, finished less than 60s ago | Done | Last step: *step sentence in the past tense*, for example Typed into "Email" | (none) |
| `runtime.state === "failed"` | A step didn't work | *Plain error sentence*. Link: *Details* (opens Advanced, Activity) | (none) |
| `recordingBlock` present | *`block.title`* | *`block.message`* | **OK** (dismisses) |
| Recording refused because not connected | Connect first | Connect to FluxIQ before recording. | (none) |

**Step sentences.** Verb from the action type, then the element's human name
in quotes. The name must never be a selector: if no name is known, the verb
stands alone ("Clicking a button", "Typing into a field").

| Action | Present tense | Past tense |
| --- | --- | --- |
| navigate | Opening *hostname* | Opened *hostname* |
| click | Clicking "*name*" | Clicked "*name*" |
| type | Typing into "*name*" | Typed into "*name*" |
| clear | Clearing "*name*" | Cleared "*name*" |
| select | Choosing an option in "*name*" | Chose an option in "*name*" |
| check | Ticking "*name*" | Ticked "*name*" |
| keypress | Pressing a key | Pressed a key |
| scroll | Scrolling the page | Scrolled the page |
| wait_for_selector, wait_for_text | Waiting for the page | Page was ready |
| extract, extract_list | Reading data from the page | Read data from the page |
| capture_snapshot | Looking at the page | Looked at the page |
| assert | Checking the page | Checked the page |
| upload | Attaching files | Attached files |
| dialog | Answering a pop-up | Answered a pop-up |
| tab | Switching tabs | Switched tabs |
| download | Waiting for a download | Download finished |
| anything else | Working on the page | Finished a step |

**Stop.** While recording, Stop recording sends the existing
`stopRecording` message. While a run is going, Stop asks Core to cancel the
run (Core's `cancel-runtime-session` endpoint). That needs a Core seam which
does not exist yet (open question 1). Until it lands, the Stop button is
replaced by the line: *To stop this, use FluxIQ.* with an **Open FluxIQ**
button. The extension must never fake a stop by disconnecting.

### 3. Conversation card

This is Core's conversation, shown and fed, never owned.

- **Which thread.** The most recent open conversation for the session's
  project: `list-conversations` with `{ projectId, status: "open", limit: 1 }`,
  then `get-conversation` with `{ conversationId, sinceTurnId, limit: 20 }`
  (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\contracts\conversation.ts:32-63`).
  The card shows the last three turns, and scrolls inside itself for more.
- **Each turn.** Speaker in bold, *You* or *FluxIQ*, then the text. A turn
  that carries a Core ask shows the ask's options as buttons, which send
  `answer-ask` with `{ askId, kind, value }` (contract lines 79-82). An
  attachment shows as *FluxIQ attached something: open it in FluxIQ*. The
  extension renders no diffs or graphs.
- **Composer.** Placeholder: *Ask FluxIQ to do something...*. Button:
  **Send**. Enter sends; Shift+Enter adds a line. The draft goes out through
  `append-turn` with `{ conversationId, text }` (contract lines 67-71), or
  `open-conversation` first when no thread exists.
  - While sending: the button reads *Sending...* and is disabled; the text
    stays in the box.
  - On failure: *Couldn't send that. Try again.* The text stays in the box.
  - Not connected: the composer is disabled, with the placeholder *Connect to
    FluxIQ first*.
- **Empty.** *No conversation yet. Ask FluxIQ to do something to start one.*
- **Footer link.** *Open the full conversation in FluxIQ* (opens the FluxIQ web
  address in a tab).
- **Refresh.** Re-read with `sinceTurnId` when the panel opens, after each
  send, and every few seconds while the panel is visible. Nothing is merged
  locally; the rendered turns are replaced by Core's answer.
- **Until the Core seam exists** (open question 1): the whole card is the
  sentence *Talk to FluxIQ in the FluxIQ window.* with **Open FluxIQ**. The card
  detects this from the background's "unknown message" answer, so it can ship
  before the seam does.

### 4. Manual actions row

| Condition | Control |
| --- | --- |
| Connected, recordable page, not recording, nothing running | **Start recording** (visible text; keep this exact name, which the Lab drives) |
| Recording | Hidden: Stop recording is in the now card |
| Not connected | **Start recording**, disabled, with the visible line *Connect to FluxIQ to record.* |
| Unsupported page | **Start recording**, disabled, with the visible line *FluxIQ can't record this page.* |
| A run is going | **Start recording**, disabled, with the visible line *Wait for FluxIQ to finish.* |

*Extract data from this page* appears only while recording, under Stop
recording, and opens the existing extraction sheet unchanged, with its ids and
copy kept, because the Lab reads them (`packages/test-runner/src/ui-e2e/journeys/extraction.ts:146-167`,
`field-review.ts:93-140`).

### Error sentences

Every error is shown in the card it belongs to, never in a detached red line.
Raw text is kept for Advanced, Activity.

| Raw source | Sentence |
| --- | --- |
| "WebSocket connection failed." (`gateway-session.ts:146,265`) | Can't reach FluxIQ. Make sure it is running on this computer. |
| No response from the background (`shared/browser.ts:27-34`) | The extension restarted. Close this panel and open it again. |
| "FluxIQ recordings API returned 401." (`core-api.ts:28`) | FluxIQ didn't accept this browser. Connect again to re-approve it. |
| Any other recordings API status | Couldn't load recordings from FluxIQ. |
| Recording refusals (`recording-start/refusal.ts`) | The block's own title and message (they are already plain English). |
| "Connect to FluxIQ before recording." | Kept as written. |
| A failed step's message (`runtime-status.ts:65-66`) | *Past-tense step sentence* didn't work. *Details* |
| Anything unmapped | Something went wrong. *Details* |

### What moves to Advanced

Advanced has four tabs, in this order, with these labels:

| Tab | Contents (from HEAD) | Labels |
| --- | --- | --- |
| **Activity** | The Events log with paging. | Heading "Activity"; "Last activity: *time*"; Previous / Next; "Page *n* of *m*"; empty: "Nothing has happened yet." |
| **Recordings** | The Recordings list with paging and Refresh. | Heading "Recordings"; "From *host*"; Refresh; row "*n* steps · *date*"; the status pill in words ("Saved", "Recording", or Core's status capitalised); empty: "No recordings yet." |
| **Current step** | The runtime card's detail. | "Step", "Page element" (the selector is allowed here), "Browser tab", "Outcome", "Started" |
| **Connection** | Settings, diagnostics and connection controls. | See below |

**Connection tab copy:**

- Status line: the raw state is allowed here, as "State: connected".
- "FluxIQ connection address" (was Gateway URL). Hint: *Where this browser
  connects to FluxIQ. Usually ws://127.0.0.1:4777/client.*
- "FluxIQ web address" (was Core API URL). Hint: *The address you open FluxIQ
  at.*
- Toggles, each with a one-line hint:
  - "Reconnect automatically": *Reconnect after the connection drops.*
  - "Record page changes" (was DOM mutations): *Notice when the page updates
    by itself.*
  - "Record what I type" (was Input values): *Needed to replay typing.
    Passwords are never recorded.*
  - "Record page snapshots" (was Snapshots): *Lets FluxIQ see the page as it
    was at each step.*
- **Save** (new). It writes settings and reconnects if the connection address
  changed. Success message: *Saved.*
- **Disconnect**.
- "Waiting to send: *n*" (was Queued).
- IDs: "This browser's ID", "Connection ID", "Current tab".
- **Forget this pairing** (was Reset Session). It asks first: *FluxIQ will
  need to approve this browser again.* Buttons: **Forget**, Cancel.

### Switching

- A two-option control in the header: **Simple** and **Advanced**. It is
  `role="radiogroup"` with the accessible name "View".
- The choice is remembered per viewer in `chrome.storage.local` under
  `fluxiq.ui.mode`, with every read and write wrapped in try/catch. Simple is
  the default when nothing is stored.
- The gear button (accessible name kept as "Settings", which the Lab uses)
  opens Advanced on the Connection tab.
- Every *Details* link opens Advanced on the Activity tab.
- The view never switches by itself. The one exception is the pairing card:
  it is part of the simple view, so while pairing is in progress the panel
  shows Simple.
- The selected Advanced tab is remembered the same way, under
  `fluxiq.ui.advancedTab`.

### Background changes the simple view needs

1. `ExtensionStatus.paired: boolean`, true when a token is stored. This
   distinguishes the two disconnected rows without exposing the token.
2. Connect on browser start and on panel open when paired and
   `autoReconnect` is on.
3. Clear `lastError` on `session_ready`, and on every connection state
   change to `connected`.
4. `RuntimeCommandStatus.targetName`: the element's human name only, never a
   selector.
5. A toolbar indicator in both browsers: badge text "REC" while recording and
   "..." while a run is going, cleared otherwise. This is what Firefox's
   closing popup needs.
6. New panel messages: `panelSaveSettings` (save without connecting),
   `panelOpenFluxIQ` (open the web address in a tab), `panelConversationRead`,
   `panelConversationSend`, `panelConversationAnswer`, and `panelStopRun`. The
   last four relay to Core with the gateway bearer token, the way
   `fetchCoreRecordings` does (`core-api.ts:14-30`).

## 5. Target architecture and workstream partition

### Why the current shape cannot be partitioned

Every view's markup lives in one `index.html`, which is duplicated as
`sidepanel/index.html`. All controllers except extraction live in one
`index.ts`, which resolves some 60 element ids at module load
(`index.ts:18-77`). All styles live in one `styles.css`. Any two changes to two
views therefore touch the same three files. The build copies only top-level
`.html` and `.css` files from `src/popup` and `src/sidepanel`
(`scripts/build-extension.mjs:255-264`), so a view cannot currently own a
stylesheet in its own directory.

### Target layout

One shared UI package, `apps/extension/src/panel/`, mounted by both
surfaces. Views build their own DOM, so `index.html` shrinks to a stub, and no
two views share a markup file, a stylesheet or a controller. Each view imports
its own `.css`, and esbuild emits one `index.css` per entry beside
`index.js`.

```
apps/extension/src/
  popup/index.html          stub: <div id="app">, link index.css, script index.js
  popup/index.ts            mountPanel(root, "popup", views)
  sidepanel/index.html      same stub (the duplicate page is gone)
  sidepanel/index.ts        mountPanel(root, "sidepanel", views)
  sidepanel/styles.css      removed, or side-panel sizing only
  panel/
    index.ts                barrel
    shell/                  mount-panel.ts, header.ts, mode-switch.ts,
                            mode-preference.ts, view-host.ts,
                            placeholder-views.ts, shell.css, index.ts, tests/
    state/                  panel-store.ts (one getStatus plus statusChanged
                            subscription), panel-request.ts (a message wrapper
                            that never throws and handles an undefined reply),
                            panel-result.ts, index.ts, tests/
    copy/                   connection-copy.ts, step-copy.ts, error-copy.ts,
                            index.ts, tests/
    dom/                    create-element.ts, index.ts
    theme/                  tokens.css (light and dark)
    simple/                 simple-view.ts, status-card.ts, pairing-card.ts,
                            now-card.ts, conversation-card.ts,
                            conversation-turn.ts, composer.ts,
                            manual-actions.ts, simple.css, index.ts, tests/
    advanced/               advanced-view.ts, activity-tab.ts,
                            recordings-tab.ts, step-tab.ts, connection-tab.ts,
                            pager.ts, advanced.css, index.ts, tests/
    extraction/             moved from popup/extraction/; panel-elements.ts
                            becomes a DOM builder that keeps every existing id
apps/extension/src/background/
  panel/                    conversation-relay.ts, run-control.ts,
                            settings-save.ts, open-fluxiq.ts,
                            toolbar-indicator.ts, index.ts, tests/
```

### Contracts pinned by this spec

These go into every brief verbatim, so the workstreams build against the same
seams.

```ts
// panel/state (workstream A)
export type PanelResult<T> =
  | { ok: true; value: T }
  | { ok: false; sentence: string; detail?: string; unsupported?: true };
  // `unsupported` means the background answered "Unknown FluxIQ extension message."
export type PanelStore = {
  current(): ExtensionStatus | undefined;
  subscribe(listener: (status: ExtensionStatus) => void): () => void; // calls at once when known
  request<T>(message: { type: string; [key: string]: unknown }): Promise<PanelResult<T>>; // never throws
};

// panel/shell (workstream A)
export type AdvancedTab = "activity" | "recordings" | "step" | "connection";
export type PanelRoute = { mode: "simple" } | { mode: "advanced"; tab: AdvancedTab };
export type PanelSurface = "popup" | "sidepanel";
export type PanelView = { readonly element: HTMLElement; show(route: PanelRoute): void; hide(): void };
export type PanelViewContext = { store: PanelStore; navigate(route: PanelRoute): void; surface: PanelSurface };
export type PanelViews = { simple(context: PanelViewContext): PanelView; advanced(context: PanelViewContext): PanelView };
export function mountPanel(root: HTMLElement, surface: PanelSurface, views: PanelViews): void;

// panel/copy (workstream A)
export function connectionCopy(status: ExtensionStatus): { dot: "grey" | "amber" | "green" | "red"; sentence: string; line?: string };
export function stepSentence(runtime: RuntimeCommandStatus, tense: "present" | "past"): string;
export function errorSentence(raw: string | undefined): string;

// panel/simple (workstream B)
export function mountSimpleView(context: PanelViewContext): PanelView;
// panel/advanced (workstream C)
export function mountAdvancedView(context: PanelViewContext): PanelView;

// shared/constants.ts RUNTIME_MESSAGES additions (workstream D)
panelSaveSettings: "fluxiq.panel.saveSettings",
panelOpenFluxIQ: "fluxiq.panel.openFluxIQ",
panelConversationRead: "fluxiq.panel.conversationRead",
panelConversationSend: "fluxiq.panel.conversationSend",
panelConversationAnswer: "fluxiq.panel.conversationAnswer",
panelStopRun: "fluxiq.panel.stopRun",
// shared/protocol.ts additions (workstream D)
ExtensionStatus.paired: boolean;
RuntimeCommandStatus.targetName?: string;  // a human name, never a selector
```

### Accessible names the Lab drives

The rebuild keeps these names exactly: "Start recording", "Stop recording",
"Connect", "Settings", and every `#extraction*` id and extraction sentence
(`packages/test-runner/src/ui-e2e/journeys/extraction.ts:82-167`,
`field-review.ts:93-140`, `recorded-task.ts:106-117`,
`demo-workspace/workspace-lanes.ts:47-70`, `diagnosis-lanes.ts:66-81`).

These names change, so their journeys change in the same workstream as the
label:

- "FluxIQ Recorder" is read by `apps/extension/e2e/install-and-content.spec.ts:14`
  (workstream A).
- "Gateway URL", "Core API URL", the four toggle labels and "Close" are read by
  `packages/test-runner/src/demo-workspace/browser-session.ts:210-230`.
  "Reset Session" and "Close" are read by
  `packages/test-runner/src/ui-e2e/journeys/extension-project.ts:28-31`.
  Both files belong to workstream C.

### Workstream partition

The file sets are disjoint across all four workstreams. The work runs in two
waves so that `pnpm build` stays green at the end of each one:

- **Wave 1:** A and D in parallel.
- **Wave 2:** B and C in parallel, after wave 1 is merged into the task
  branch.
- **Integration:** the supervisor then switches the two entry files from
  `placeholderViews` to the real views. That is a two-line edit in each of
  `popup/index.ts` and `sidepanel/index.ts`.

Run all four waves on one task branch with its own worktree
(`pnpm task start ext-ui-rebuild --worktree`). D also needs a paired Core
branch of the same id.

**Workstream A: shell, shared panel state, copy, and build (wave 1)**

- `apps/extension/src/popup/index.html`
- `apps/extension/src/popup/index.ts`
- `apps/extension/src/popup/styles.css` (delete)
- every other file under `apps/extension/src/popup/` that the concurrent split
  worker creates, **except** `popup/extraction/**`
- `apps/extension/src/sidepanel/index.html`
- `apps/extension/src/sidepanel/index.ts`
- `apps/extension/src/sidepanel/styles.css`
- `apps/extension/src/panel/index.ts`
- `apps/extension/src/panel/shell/**`, including `placeholder-views.ts`: a
  minimal simple view (status card, Start/Stop recording, and Extract data
  from this page) and an empty Advanced view, so wave 1 builds, records and
  extracts
- `apps/extension/src/popup/extraction/**`, moved to
  `apps/extension/src/panel/extraction/**` with its `tests/`. This has to be in
  wave 1: stubbing `index.html` deletes the extraction markup
  (`index.html:168-218`), so `panel-elements.ts` must become a DOM builder that
  keeps every id in the same change. The pinned signature becomes
  `mountExtractionPanel(host: HTMLElement): ExtractionPanelHandle`, with
  `ExtractionPanelHandle` unchanged (`extraction/panel.ts:46-49`).
- `apps/extension/src/panel/state/**`
- `apps/extension/src/panel/copy/**`
- `apps/extension/src/panel/dom/**`
- `apps/extension/src/panel/theme/tokens.css`
- `apps/extension/scripts/build-extension.mjs`: emit CSS imported from the
  entries; stop the static copy of CSS
- `apps/extension/scripts/smoke-test.mjs`
- `apps/extension/e2e/install-and-content.spec.ts`
- `docs/architecture/extension-client.md` (the panel UI section)

Validate with `pnpm --filter @fluxiq-web-extension/extension build`,
`pnpm --filter @fluxiq-web-extension/extension test`, and `pnpm check`
(structure audit). Unit tests go in `panel/copy/tests/` and
`panel/state/tests/`.

**Workstream D: background, shared protocol, and the Core seam (wave 1)**

- `apps/extension/src/shared/constants.ts`
- `apps/extension/src/shared/protocol.ts`
- `apps/extension/src/shared/browser.ts`
- `apps/extension/src/background/index.ts`
- `apps/extension/src/background/panel/**` (new)
- `apps/extension/src/background/connection.ts`
- `apps/extension/src/background/connection/gateway-session.ts`
- `apps/extension/src/background/connection/server-command-channel.ts`
- `apps/extension/src/background/connection/runtime-status.ts`
- `apps/extension/src/background/connection/core-api.ts`
- `apps/extension/src/background/connection/tests/runtime-status.test.ts`
- `apps/extension/src/background/connection/tests/server-command-channel.test.ts`
- Core, on a paired branch:
  `F:\!FluxIQ\apps\web\src\app\api\programs\[programId]\[endpoint]\route.ts`,
  `F:\!FluxIQ\apps\web\src\lib\program-route.ts`, their `tests/`, and
  `F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`

D delivers the six "Background changes the simple view needs" in section 4.
The relays return Core's payloads unchanged; no conversation state is kept in
the background. Validate with
`pnpm --filter @fluxiq-web-extension/extension test` and Core's route tests.

**Workstream B: the simple view (wave 2)**

- `apps/extension/src/panel/simple/**`

Covers the status card, the pairing card, the now card with Stop, the
conversation card with its "Open FluxIQ" fallback on `unsupported`, and the
manual actions row, with the copy in section 4 verbatim. It reuses the
extraction sheet by calling `mountExtractionPanel(host)` from
`panel/extraction`'s barrel (moved by A in wave 1). B does not edit it.

Validate with unit tests in `panel/simple/tests/` for every state-to-copy
table, then a live load in Chrome's side panel and the Firefox popup at 600px
height.

**Workstream C: the Advanced view and the Lab journeys (wave 2)**

- `apps/extension/src/panel/advanced/**`
- `packages/test-runner/src/demo-workspace/browser-session.ts`
- `packages/test-runner/src/ui-e2e/journeys/extension-project.ts`

Covers the four tabs and copy in section 4, the Save button, and the
confirmation on Forget this pairing. The journeys move to the new labels: Save
instead of relying on Connect to save, "Forget this pairing" then "Forget", and
"Simple" instead of "Close".

Validate with `pnpm --filter @fluxiq-web-extension/extension test`, a
type-check of `packages/test-runner`, and one Lab journey run through
`extension-project`, queued behind any live run already in flight.

### Partition check

| Path | A | B | C | D |
| --- | --- | --- | --- | --- |
| `apps/extension/src/popup/**` (including `extraction/`) | yes | | | |
| `apps/extension/src/sidepanel/**` | yes | | | |
| `apps/extension/src/panel/{index.ts,shell,state,copy,dom,theme,extraction}/**` | yes | | | |
| `apps/extension/src/panel/simple/**` | | yes | | |
| `apps/extension/src/panel/advanced/**` | | | yes | |
| `apps/extension/src/shared/{constants,protocol,browser}.ts` | | | | yes |
| `apps/extension/src/background/index.ts`, `background/panel/**`, `background/connection.ts` | | | | yes |
| `background/connection/{gateway-session,server-command-channel,runtime-status,core-api}.ts` and two tests | | | | yes |
| `apps/extension/scripts/{build-extension,smoke-test}.mjs` | yes | | | |
| `apps/extension/e2e/install-and-content.spec.ts` | yes | | | |
| `packages/test-runner/src/demo-workspace/browser-session.ts`, `ui-e2e/journeys/extension-project.ts` | | | yes | |
| `docs/architecture/extension-client.md` | yes | | | |
| Core route, `program-route.ts`, Core client-gateway doc | | | | yes |

No path has two owners. Supervisor-only: the two-line integration edit in
`popup/index.ts` and `sidepanel/index.ts` after wave 2.
