# FluxIQ Web Extension

Browser extension client for FluxIQ web automation.

The extension does not run the FluxIQ framework. It connects to a local or
hosted FluxIQ web panel through FluxIQ's generic client WebSocket gateway and
acts as one browser-side recorder, observer, and action executor client.

## Shape

```text
apps/
  extension/
    src/background/   WebSocket session, tab routing, recording state
    src/content/      DOM recorder, snapshotter, action executor
    src/popup/        connection and recording controls
    src/sidepanel/    compact live status view
    src/shared/       protocol, constants, browser-facing helpers
```

## Development

```bash
pnpm install
pnpm --filter @fluxiq-web-extension/extension check
pnpm --filter @fluxiq-web-extension/extension build
```

Build output is written to:

```text
apps/extension/dist/chrome
apps/extension/dist/firefox
```

Load the matching folder as an unpacked extension in Chrome, Edge, Firefox, or
another compatible browser.

## Default Gateway

The extension defaults to:

```text
ws://127.0.0.1:4777/client
```

You can change this from the popup. Production deployments should use `wss://`.
