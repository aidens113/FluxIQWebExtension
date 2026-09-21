# T027 Panel Busy Confirmation

Status: Busy-transition race fixed; true generation response captured
Date: 2026-09-20
Worker: `w2-t027-panel-busy-confirmation`

## Focused change

The existing terminal observer now accepts an
`ignoreHighTokenConfirmation` option. Only the second observer invocation—the
one made after this driver clicked the visible confirmation—sets it. The first
observer still treats an unapproved confirmation as a safety terminal.

This prevents the approved modal's disabled `Building...` transition from
masquerading as a second confirmation while preserving every other terminal:
response, visible alert, persisted proposal, and timeout.

## Live-first result

`pnpm panel:golden` was rerun through the isolated production panel and headed
Chromium.

Preparation passed:

- run: `demo-llm-blank-prepare-2026-09-20T23-45-31-500Z-45ca96`
- elapsed: `6.961 s`
- event/screenshot counts: `62` / `50`

Exploration advanced beyond the busy confirmation:

- run: `demo-llm-explore-2026-09-20T23-45-48-223Z-6d5429`
- elapsed: `20.364 s`
- event/screenshot counts: `124` / `100`
- the confirmed request completed three real `web.dom.capture_snapshot`
  actions, all reported `succeeded`;
- the terminal observer then captured a genuine generation response.

Sanitized response evidence:

- HTTP status: `400`
- response OK: `false`
- parsed closed diagnostic: `true`
- code: `flow_bootstrap.pre_provider_validation_failed`
- provider call count: `0`
- generic visible error at the bounded `150 ms` sample: absent
- proposal persisted: no

This is a product/contract failure before the model provider, not provider
noise. No retry was made.

## Narrow check after live

The directly owned exploration test now pins that only the approved second wait
ignores the confirmation transition:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/demo-llm-create-ui/tests/exploration.test.js
```

Result: `4/4` passed. No broad suite ran.

## Next focused action

Project only the closed pre-provider validation stage and bounded allowlisted
issue codes from the already-sanitized response, then trace which downstream
request/Flow setting violates Core's bootstrap contract. Fix downstream-owned
construction only; if the rejecting rule belongs to Core, report its exact seam
without editing Core in this lane.

Assigned ports are closed and no assigned process remains. Artifacts were
preserved. No commit or push was made.
