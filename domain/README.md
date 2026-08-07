# FluxIQ Web Automation Domain

This package contains the domain-specific FluxIQ code for browser/web automation.
FluxIQ core stays generic; this package owns the domain manifest, accepted
recording event contract, state reducers, action interfaces, and client
capability declarations.

Use `createWebAutomationFluxIQ()` when hosting a FluxIQ runtime for this repo.
It registers both the general domain manifest and the Automation Studio
`RecordingDomainDefinition`.

From the repo root, run:

```bash
pnpm dev
```

That command runs the domain setup first, creating `.fluxiq/` in the repo root,
then starts the FluxIQ web panel with `FLUXIQ_ROOT` pointed at this repo.

The browser extension should send `client.recording_event` messages with
`domainId: "web-automation"` and one of the `WEB_AUTOMATION_EVENTS` event
types. Generic state and snapshot messages use `client.state_update` and
`client.snapshot`.

Every gateway message that represents a registered domain input includes
`metadata.inputId`. State and passive-evidence inputs have no output mapping.
Operator action inputs map deterministically to one registered output, which
is the only route by which a recording can create an executable policy action.
