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
and sent by `sendAction`. It is sent once, with one exception, a
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
extension classifies an operator click, text entry, clear, select, key press,
scroll, or navigation into a distinct action input. Each action input carries
`metadata.inputId` and has exactly one registered output binding. FluxIQ uses
that binding to persist the output ID and mapped payload in a policy action.

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
- tab and navigation changes, from the background worker;
- click, input, change, and submit;
- keydown and scroll;
- batched DOM mutation counts;
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
the recording mapper finds it beside the click it names (see below).

A `client.start_recording` waits 750 ms for FluxIQ to answer; on silence the
recorder starts locally so no user action is lost. A refusal is an answer, so
it cancels that window — and it is classified rather than treated as a
connection failure. `classifyRecordingStartRefusal`
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

Primary user actions are not sent as a separate message type. Each one that
maps to a registered action input goes out as a `client.recording_event`
whose `metadata.inputId` names that input, and FluxIQ's gateway bridge
records an event carrying a registered input ID as that input. That is how
Automation Studio timelines distinguish operator actions from passive state
observations. Raw snapshots and state updates remain available as recording
observations through the client gateway bridge.

A recorded click proposes the page it landed on as its expected state. When
Core turns a recording into a proposal, it shows the web recording mapper
([`domain/src/web-panel-host.ts`](../../domain/src/web-panel-host.ts), with
the builder in
[`domain/src/runtime/expectation/click-landing.ts`](../../domain/src/runtime/expectation/click-landing.ts))
each timeline entry together with up to 32 entries after it (`following`). The
mapper looks there for explained landings that name the click, and takes the
**last** one, since a client redirect can commit twice. The claim it adds is
exactly:

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

## Default Endpoint

The default development endpoints are:

```text
Gateway: ws://127.0.0.1:4777/client
Core API: http://127.0.0.1:3000
```
