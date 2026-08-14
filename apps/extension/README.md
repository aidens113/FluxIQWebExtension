# FluxIQ Extension App

This is the browser-side client for FluxIQ web automation.

Responsibilities:

- connect to a FluxIQ gateway over WebSocket;
- pair with the selected local or hosted FluxIQ web panel;
- stream FluxIQ `StateSnapshot` updates, compact snapshots, domain-tagged
  recording events, and selected recording timeline entries;
- execute approved browser actions sent by FluxIQ;
- keep only lightweight local settings and queued events.

Durable projects, recordings, policies, generated artifacts, and the Automation
Studio editor live in FluxIQ. The web automation recording/action contract
lives in the workspace `domain/` package.

## Popup Flow

Chrome and Edge are side-panel-first. Clicking the extension action opens the
FluxIQ Recorder side panel. Firefox keeps the popup as a fallback.

The recorder console shows:

- connection state and active page;
- a primary record control with timer, event count, and queued count;
- a paginated event log for the current recording;
- saved recording summaries from FluxIQ Core;
- unsupported-page warnings;
- a settings drawer for gateway/core API URLs, reconnect behavior, capture
  toggles, diagnostics, and session reset.

The default development endpoints are:

```text
Gateway: ws://127.0.0.1:4777/client
Core API: http://127.0.0.1:3000
```

When FluxIQ requires pairing, the extension displays a blocking approval panel
with a reference code. Compare that code with the web panel approval modal,
then approve or reject pairing in FluxIQ. The extension does not accept or send
user-entered pairing codes.

## Recording

Recording is available only after the gateway sends `server.session_ready`.
Starting a recording resets local counters, enables content-script capture,
sends `client.start_recording` with a compact initial `StateSnapshot`,
environment descriptor, sources, and action channels. The initial state is
derived from the active tab snapshot when possible and falls back to browser tab
state if content scripts are unavailable.

DOM snapshots are converted into factual `web` namespace state values. The
extension filters element state to visible, useful targets and public facts.
The content script captures up to 1,000 visible candidates per snapshot, then
the domain state layer keeps up to 300 state elements and 300 visual region
layers. This avoids recording every DOM node while still giving FluxIQ useful
targets and state deltas.

Primary user actions are sent as domain events and as selected
`client.recording_entry` action entries. Passive evidence, snapshots, and
presence updates are kept as compact state updates or observations. DOM-backed
steps send one canonical `client.snapshot` state checkpoint so Core can batch
high-frequency recording writes. Stopping sends `client.stop_recording`
immediately and leaves the paginated local event log visible.

The recordings tab loads saved summaries from FluxIQ Core:

```text
GET /api/recordings?page=1&pageSize=10
```

When the extension has a paired gateway token, it sends it as a bearer token for
that request.
