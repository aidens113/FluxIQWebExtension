# FluxIQ Extension App

This is the browser-side client for FluxIQ web automation.

Responsibilities:

- connect to a FluxIQ gateway over WebSocket;
- pair with the selected local or hosted FluxIQ web panel;
- stream browser/tab/DOM/recording events;
- execute approved browser actions sent by FluxIQ;
- keep only lightweight local settings and queued events.

Durable projects, recordings, policies, generated artifacts, and the Automation
Studio editor live in FluxIQ.

## Popup Flow

The popup has two tabs:

- `Status`: connection state, connect/disconnect, record/stop, active tab, and
  queue status.
- `Settings`: gateway URL, reconnect behavior, and capture toggles.

The default development gateway is:

```text
ws://127.0.0.1:4777/client
```

When FluxIQ requires pairing, the extension displays a reference code. Compare
that code with the web panel approval modal, then approve or reject pairing in
FluxIQ.
