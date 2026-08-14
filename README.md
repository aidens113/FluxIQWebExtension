# FluxIQ Web Extension

Browser extension client for FluxIQ web automation.

The extension does not run the FluxIQ framework. It connects to a local or
hosted FluxIQ web panel through FluxIQ's generic client WebSocket gateway and
acts as one browser-side recorder, observer, and action executor client. The
domain-specific FluxIQ code for web automation lives in the top-level
`domain/` package.

## Shape

```text
apps/
  extension/
    src/background/   WebSocket session, tab routing, recording state
    src/content/      DOM recorder, snapshotter, action executor
    src/popup/        connection and recording controls
    src/sidepanel/    compact live status view
    src/shared/       protocol, constants, browser-facing helpers
domain/
  src/                FluxIQ domain manifest, registered inputs/outputs, recording contracts, actions
```

## Development

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs the repo-local FluxIQ setup first. That imports FluxIQ from
this repo's domain host, creates `.fluxiq/` under this repo, registers the
`web-automation` domain, then starts the FluxIQ web panel with
`FLUXIQ_ROOT` pointed at this repo.

You can run setup by itself with:

```bash
pnpm fluxiq:setup
```

Useful checks:

```bash
pnpm --filter @fluxiq-web-extension/domain check
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
Gateway: ws://127.0.0.1:4777/client
Core API: http://127.0.0.1:3000
```

You can change these from the popup. Production deployments should use `wss://`
for the gateway and the matching HTTPS web origin for Core API calls.

## Input and output contract

The domain has explicit FluxIQ inputs and output nodes. Browser/tab state and
passive DOM evidence are state/event inputs only. Recorded clicks, text entry,
clears, selections, key presses, scrolls, and navigations are action inputs
that map one-to-one to registered browser outputs. A mapped action input is
never available as policy state; an unmapped input can never create an
executable policy node.
