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
- stores that URL in the side-panel settings drawer;
- displays the server-provided reference code while the user approves pairing
  in the FluxIQ web panel;
- presents a side-panel-first recorder console in Chrome and Edge;
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

A navigation the page made itself is different. That is a Chrome transition of
`link` or `form_submit`, script navigation such as `location.assign` included.
It is recorded only as the **landing** of the executable click that caused it,
in the same tab and within 5 s after that click. A form submit extends the
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

Element state is intentionally filtered. The extension does not record every
DOM element. An element is kept only when it is rendered and says something
about itself — meaningful text, an accessible name, a value, media, or, for an
interactable control, one of those or a stable public identifier such as
`data-testid`, `aria-label`, `name`, or `id`. Controls the user has touched
rank first, then primary controls, then other interactables, then semantic
text. The generic sweep walks at most 50,000 nodes, a capture returns at most
2,000 descriptors, and the state projection then keeps at most 1,500 of them. Each cap reports itself, and which flag names which is in
[page evidence](page-evidence.md#the-four-caps). This gives FluxIQ enough
factual target data for mining without bloating recordings with anonymous DOM
structure.

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
- **the panel** ([`popup/extraction/`](../../apps/extension/src/popup/extraction/index.ts)):
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
  `isPickerHostNode`
  ([`content/picker-host.ts`](../../apps/extension/src/content/picker-host.ts))
  tests for and the recorder's mutation counter skips — the host arriving and
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

## Default Endpoint

The default development endpoints are:

```text
Gateway: ws://127.0.0.1:4777/client
Core API: http://127.0.0.1:3000
```
