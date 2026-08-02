# FluxIQ Extension App

This is the browser-side client for FluxIQ web automation.

Responsibilities:

- connect to a FluxIQ gateway over WebSocket;
- pair with the selected local or hosted FluxIQ web panel;
- stream generic state updates, structured snapshots, and domain-tagged
  recording events;
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
- live recording activity;
- unsupported-page warnings;
- a settings drawer for gateway URL, reconnect behavior, capture toggles,
  diagnostics, and session reset.

The default development gateway is:

```text
ws://127.0.0.1:4777/client
```

When FluxIQ requires pairing, the extension displays a blocking approval panel
with a reference code. Compare that code with the web panel approval modal,
then approve or reject pairing in FluxIQ. The extension does not accept or send
user-entered pairing codes.

## Recording

Recording is available only after the gateway sends `server.session_ready`.
Starting a recording resets local counters, enables content-script capture,
sends `client.state_update`, and attempts an initial structured
`client.snapshot`. Stopping captures a final snapshot and leaves the latest
activity summary visible.
