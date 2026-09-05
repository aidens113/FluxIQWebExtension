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

Recorded and executed actions can include `visualTarget`, an editor-facing
reference to the acted-on state entity. The extension derives it from the same
DOM element fingerprint used for `web.elements.*` state paths, so Automation
Studio can highlight the specific element region while keeping the raw
`element` payload available for replay and selector fallback.

## Automated testing facility

This repository includes deterministic scenario fixtures, a Playwright
Chromium extension suite, isolated FluxIQ topology, opt-in attachment to an
existing FluxIQ installation, attested evidence and review tooling, CI
selection, and bounded-agent safety contracts. A verified Windows isolated
`basic-form` run paired the production extension, persisted its Core recording,
and proved Core-issued navigate and type actions reached the page through the
production client API.

Existing mode is implemented for an already-persisted Flow: it opens the seeded
scenario page, attaches without owning or deleting the external installation,
executes that Flow to drive the expected browser state, saves sanitized
Flow/run/action/event evidence, and verifies the selected project and Flow in
the authenticated panel. The panel helper reports unavailable exact run-detail
UI proof as `limited`, and the finite runner fails closed instead of treating
that outcome as a pass. This path has not yet been claimed as validated against
a live existing installation. Configure it from the ignored `.env`/`.env.local`
files using `.env.example`; inspect or clear the origin-and-username-scoped
session cache with `pnpm lab auth status` and `pnpm lab auth clear`, or bypass
reuse with `--fresh-login`.

Clone mode downloads the configured source Flow through read-only APIs, reuses
a private facility-wide sanitized cache when the source revision is unchanged,
imports the Flow with new IDs into a run-owned isolated Core project, verifies
the saved document, and executes only that isolated copy. The source PIN is not
required because clone mode never mutates, pairs with, or executes on the
source installation. Run it with `pnpm lab run <scenario> --target clone`; use
`pnpm lab clone-cache status|refresh|clear` to manage the scoped cache.

Run the finite CLI with `pnpm lab run`, `matrix`, `auth`, `clone-cache`, `inspect`, or
`compare`; root safety tools are exposed as `pnpm boundary:audit`,
`pnpm agent:orchestrator`, and `pnpm real-site:policy`. See the
[testing facility architecture](docs/architecture/testing-facility.md) for
existing-target fields and Core compatibility limits, commands,
evidence/security boundaries, and remaining Linux, automatic-agent,
Core-promotion, and real-site limits.
