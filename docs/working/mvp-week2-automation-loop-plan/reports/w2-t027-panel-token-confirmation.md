# T027 Panel High-Token Confirmation

Status: Confirmation live-proven; API begins; next response/observability blocker found
Date: 2026-09-20
Worker: `w2-t027-panel-token-confirmation`

## Focused change

In the existing isolated panel worktree,
`packages/test-runner/src/demo-llm-create-ui/explore-proposal-ui.ts` now:

- classifies the golden profile as requiring confirmation at the exact imported
  threshold (`>=`);
- records that confirmation is attempted;
- verifies the production **Confirm high-token Flow Build** dialog;
- clicks the visible **Continue high-token build** action; and
- resumes the existing bounded terminal observer for the real generation call.

No Core or product UI file changed. The prior preparation and label fixes remain
as the accumulated scoped driver diff.

## Live-first result

`pnpm panel:golden` was rerun in the same isolated production panel/Chromium
lane on ports `3357` / `4927`.

Preparation remained healthy:

- evidence run: `demo-llm-blank-prepare-2026-09-20T23-37-35-415Z-d8e079`
- verdict: passed
- elapsed: `6.446 s`
- event/screenshot counts: `62` / `50`

The exploration run reached and handled the safety UI:

- evidence run: `demo-llm-explore-2026-09-20T23-37-50-473Z-780684`
- elapsed: `13.278 s`
- event/screenshot counts: `115` / `94`
- diagnostic: `exploration.high-token-confirmation-required`
- driver authorized tokens / imported threshold: `560000` / `560000`
- configured profile requires confirmation: `true`
- confirmation attempted: `true`
- initial API request observed before confirmation: `false`

The browser evidence visibly shows the confirmation dialog, its limits, and
the button entering `Building...` after the driver clicked it. The resumed
terminal observer completed about `95 ms` after the click, which proves the
generate API request began and returned; the earlier no-request stop is fixed.

The production dialog displayed a `312000`-token run bound and explains its own
`100000`-token warning threshold. The driver's equality is against the imported
Core threshold of `560000`. The driver now safely follows the actual visible UI
boundary, but these two threshold descriptions are not the same contract and
should not be reported as numerically identical.

## Next blocker

No proposed adaptation or runtime run was persisted for either generated
checkpoint Flow, and no provider invocation is evidenced. Immediately after
the generation response, `panel:golden` returned only
`panel_golden_path.failed`.

The evidence bundle has no failure event or sanitized generation diagnostic
after `explore-high-token-confirm` completed. Its last captured UI state is the
confirmation dialog in `Building...`. Therefore the exact provider-side reason
cannot be claimed from this run. The next blocker is a **generation response /
driver observability failure**: an API response terminates the driver before it
records status, sanitized reason code, provider-call accounting, or the visible
terminal alert.

This worker did not broaden the brief into response parsing or launcher error
reporting and did not retry the product outcome.

## Narrow check after live progression

Only after the API stage advanced, the directly owned exploration test was
updated for equality and visible confirmation:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/demo-llm-create-ui/tests/exploration.test.js
```

Result: `4/4` passed. No full or repository-wide suite ran.

## Next focused action

Instrument the existing sanitized terminal path so every post-confirmation
response records HTTP status, allowlisted generation code, and provider-call
accounting before any assertion can throw. Rerun this exact golden lane once;
classify and fix that newly visible response rather than retrying it away.

Assigned ports are closed and no assigned process remains. Artifacts were
preserved. No commit or push was made.
