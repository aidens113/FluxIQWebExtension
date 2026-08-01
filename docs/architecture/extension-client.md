# Extension Client Architecture

The FluxIQ web extension is a client for FluxIQ's generic WebSocket gateway.
The gateway should accept many client kinds; this extension identifies itself
as:

```json
{
  "clientKind": "browser_extension"
}
```

The extension is intentionally not the framework runtime. FluxIQ owns durable
projects, Automation Studio, recordings, normalization, policy generation,
authorization, and long-running work. The extension owns browser presence.

## Responsibilities

The extension:

- connects to a local or hosted FluxIQ gateway URL;
- stores that URL in the popup Settings tab;
- displays the server-provided reference code while the user approves pairing
  in the FluxIQ web panel;
- reports browser, tab, and DOM state;
- captures raw recording evidence from pages;
- executes browser actions requested by FluxIQ;
- returns action results with evidence and timing;
- stores only lightweight settings, pairing/session data, and unsent events.

FluxIQ:

- pairs and authorizes clients;
- owns the generic WebSocket gateway;
- stores recordings and generated artifacts;
- maps client events into Automation Studio documents;
- chooses which actions to send to browser clients.

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
- `client.browser_state`
- `client.tab_state`
- `client.recording_event`
- `client.dom_snapshot`
- `client.action_result`
- `client.error`
- `client.pong`

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

- `browser.navigate`
- `dom.click`
- `dom.type`
- `dom.clear`
- `dom.select`
- `dom.scroll`
- `dom.keypress`
- `dom.wait_for_selector`
- `dom.wait_for_text`
- `dom.extract`
- `dom.capture_snapshot`

Each action returns `client.action_result` with status, message, URL/title,
optional element evidence, optional snapshot evidence, extracted data, and
start/finish timestamps.

## Recording Evidence

Content scripts emit raw browser evidence:

- page/content ready;
- tab and navigation changes;
- click/input/change/submit/focus/blur;
- keydown and scroll;
- batched DOM mutation counts;
- DOM snapshots.

FluxIQ should preserve this raw evidence before deriving normalized timelines,
signal registries, task models, or policies.

## Default Endpoint

The default development gateway is:

```text
ws://127.0.0.1:4777/client
```
