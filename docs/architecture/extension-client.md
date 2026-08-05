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
- warns when the active page cannot be recorded by content scripts;
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

Current client message groups:

- `client.hello`
- `client.state_update`
- `client.recording_entry`
- `client.recording_event`
- `client.snapshot`
- `client.action_result`
- `client.error`

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

The first browser action set is deliberately small:

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

## Recording Evidence

Content scripts emit browser evidence:

- page/content ready;
- tab and navigation changes;
- click/input/change/submit/focus/blur;
- keydown and scroll;
- batched DOM mutation counts;
- DOM snapshots.

The background process maps this raw evidence into `web-automation` domain
events such as `web.element.clicked`, `web.element.input_changed`,
`web.page.navigated`, and `web.action.executed` before sending
`client.recording_event`. FluxIQ validates those events against the registered
`RecordingDomainDefinition` before deriving normalized timelines, signal
registries, task models, or policies.

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

Primary user actions are also sent as `client.recording_entry` action entries
so Automation Studio timelines can distinguish operator actions from passive
state observations. Raw snapshots and state updates remain available as
recording observations through the client gateway bridge.

The side panel recordings tab reads saved summaries from FluxIQ Core:

```text
GET /api/recordings?page=1&pageSize=10
```

The extension includes the paired client token as a bearer token when one is
available.

The extension keeps only transient recorder UI state for the active browser
session. It does not persist canonical recordings locally.

## Default Endpoint

The default development gateway is:

```text
ws://127.0.0.1:4777/client
```
