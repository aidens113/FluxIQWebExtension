# T027 Panel Generation Response Observability

Status: Observability added; live rerun exposed an earlier terminal-classifier blocker
Date: 2026-09-20
Worker: `w2-t027-panel-generation-response`

## Scoped observability

The isolated driver's existing response path now records only closed safe data:

- generation HTTP status and `response.ok`;
- a closed generic visible-error code, selected only by exact matching against
  the production UI's known messages;
- proposed-adaptation count and terminal identity agreement; and
- the already-existing allowlisted generation stage/code/provider accounting
  when its sanitized parser is reached.

No response body, prompt, page data, credential, token, or arbitrary UI text is
recorded. Core and the product UI remain unchanged.

## Live-first result

`pnpm panel:golden` was rerun on the isolated production panel and Chromium.
Preparation passed again:

- preparation run: `demo-llm-blank-prepare-2026-09-20T23-42-38-570Z-6e1ee3`
- elapsed: `6.611 s`
- event/screenshot counts: `62` / `50`

The exploration run was:

- `demo-llm-explore-2026-09-20T23-42-53-666Z-444367`
- elapsed: `12.429 s`
- event/screenshot counts: `115` / `94`

It again reached the visible high-token dialog, recorded equality as authorized,
clicked **Continue high-token build**, and visibly entered `Building...`.
However, none of the new response diagnostics ran.

The event sequence proves why: `explore-high-token-confirm` starts and completes
while the busy confirmation modal is still visible. The second call to
`waitForExplorationTerminal` immediately sees that same approved modal and
returns another `high_token_confirmation`; the repeated-confirmation guard then
throws before a request response, alert, proposal, or timeout can be observed.

This corrects the inference in the preceding token-confirmation report: the
roughly `95 ms` confirmation step measured the dialog's still-visible busy
transition, not a generation API response. API/provider start is **not proven**.
No adaptation or runtime run was persisted, and no provider call is evidenced.

## Classification

Exact next blocker: **panel driver terminal-classifier race**. After explicit
approval, the observer must ignore only the already-approved modal's visible
busy/closing transition. It must continue waiting for one of the genuine
terminal signals: generation response, visible alert, persisted proposal, or
bounded timeout.

The new response observability is compiled and ready but remains live-unreached
until that classifier race is repaired.

## Narrow check after live

The directly owned exploration test was extended to require the closed response,
visible-error, and proposal-count diagnostics:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/demo-llm-create-ui/tests/exploration.test.js
```

Result: `4/4` passed. No broad suite ran.

## Next focused action

Give the post-confirmation wait an explicit `ignoreHighTokenConfirmation` mode,
used only after the driver itself clicked the confirmation. Rerun the live panel
lane and inspect the newly reachable sanitized response diagnostics before any
further change.

Assigned ports are closed; no assigned process remains. Artifacts were
preserved. No commit or push was made.
