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
validated, is in [web capabilities](web-capabilities.md).

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
- click (recorded on `pointerdown` and on `click`), input, change, and submit;
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

The background process maps this raw evidence into `web-automation` domain
events such as `web.element.clicked`, `web.element.input_changed`,
`web.page.navigated`, and `web.action.executed` before sending
`client.recording_event`. FluxIQ validates those events against the registered
`RecordingDomainDefinition` before deriving normalized timelines, signal
registries, task models, or policies.

When Core refuses a start because the approving Automation Studio context has
expired, it answers `recording.project_required`. The extension cancels its
pending start on that answer, so the 750 ms local-start fallback never fires and
the recorder returns to idle with no retry and no reason shown to the operator.
Classifying and surfacing that refusal is Week 1 Phase 1.5 work.

Recording sessions start with a FluxIQ `StateSnapshot` rather than an empty
state object. DOM snapshots are converted into compact, factual state paths
under the `web` namespace, including page URL/title, viewport bounds, scroll
position, focused target, selected text, and a capped set of interactive
elements.

Element state is intentionally filtered. The extension does not record every
DOM element. It keeps only interactive elements that have meaningful text,
label, value, href, or stable public identifiers such as `data-testid`,
`aria-label`, `name`, or `id`, and caps each snapshot to 40 captured elements.
This gives FluxIQ enough factual target data for mining without bloating
recordings with anonymous DOM structure.

Sensitive values are not yet redacted when they are captured. The
`captureInputValues` setting defaults to on
([`shared/browser.ts`](../../apps/extension/src/shared/browser.ts)) and
reaches the content script with every recording message. While it is on, an
element descriptor carries the value of any input, textarea, select, or
`contenteditable`, password fields included, and the recorder sends the same
value as the event's `inputValue`. The sensitivity rule is one function,
`isSensitiveFieldSignature` in
[`shared/sensitive-field.ts`](../../apps/extension/src/shared/sensitive-field.ts),
used by the content script and the background worker alike: a password input,
`data-sensitive="true"`, or any `autocomplete` token that is
`current-password`, `new-password`, `one-time-code`, or `cc-*` (every token is
checked, so `billing cc-number` counts). It withholds only a `<select>`'s
`selectedValue`, the `hasValue` flag, and the value on a `type` or `select`
runtime confirmation. The domain marks `elements.*.value` and `forms.*` as
sensitive state, which labels the value downstream but does not remove it.
Redaction at capture is Week 1 Phase 1.4 work.

Primary user actions are not sent as a separate message type. Each one that
maps to a registered action input goes out as a `client.recording_event`
whose `metadata.inputId` names that input, and FluxIQ's gateway bridge
records an event carrying a registered input ID as that input. That is how
Automation Studio timelines distinguish operator actions from passive state
observations. Raw snapshots and state updates remain available as recording
observations through the client gateway bridge.

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
