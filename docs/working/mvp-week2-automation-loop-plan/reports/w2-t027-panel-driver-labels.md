# T027 Panel Driver Labels Live Rerun

Status: Label fix live-proven; preparation passes; next confirmation blocker found
Date: 2026-09-20
Worker: `w2-t027-panel-driver-labels`

## Focused change

In the existing isolated panel worktree,
`packages/test-runner/src/demo-llm-blank-workspace.ts` now locates the Create
project Description field with the same semantic non-exact label locator used
by Core's own live panel specs and the established recording provisioning
driver. No Core or product UI file changed.

The previously accumulated, live-proven golden preparation and required-label
changes remain in the worktree. Candidate bases remain downstream
`0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf` and Core
`ef7892fc50b19667400c4fcb6be82f2e826e6fc0`.

## Live-first result

`pnpm panel:golden` was rerun immediately against the production panel and
headed Chromium on isolated ports `3357` / `4927`.

Blank-workspace preparation passed completely:

- evidence run: `demo-llm-blank-prepare-2026-09-20T23-32-39-514Z-dab4aa`
- elapsed: `13.839 s`
- event/screenshot counts: `107` / `82`
- persisted project: `40964b56-7c34-4637-b74b-5a840af1571b`
- persisted blank Flow: `flow.e9ce0490-11f4-4120-b772-c05b2a24d665`

The panel visibly filled all three Create project controls, submitted the form,
created the project and blank Flow, saved its instruction/settings, connected
the extension, opened Runtime Debug, entered the bounded website task, and
activated **Explore and create proposal**. This clears all three Create project
label blockers.

The creation campaign then stopped before any API/provider request:

- evidence run: `demo-llm-explore-2026-09-20T23-33-02-959Z-b75e49`
- elapsed: `21.968 s`
- event/screenshot counts: `113` / `92`
- diagnostic stage: `exploration-high-token-confirmation`
- code: `exploration.high-token-confirmation-required`
- API request observed: `false`
- authorized tokens / threshold: `560000` / `560000`
- driver classification: `configuredProfileRequiresConfirmation=false`
- confirmation attempted: `false`

The production UI requires confirmation at equality. The driver computes
`configuredProfileRequiresConfirmation` with strict `>` at
`demo-llm-create-ui/explore-proposal-ui.ts:58`, then deliberately refuses the
visible confirmation at lines 51-61. This is a driver/UI boundary mismatch:
the run is exactly at the threshold, the UI correctly presents its safety
boundary, and the automated panel lane neither expects nor confirms it.

Provider calls were `0`; no proposal, adaptation, execution run, or scenario
oracle exists yet.

## Narrow check after progression

Only after live preparation passed, the focused preparation source test was
extended to guard the Description locator. The final commands were:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/tests/demo-llm-prepare.test.js
```

Result: `6/6` passed. No full or repository-wide suite ran.

## Next action

Align the testing driver with the production UI's equality contract and make
the explicitly authorized golden lane confirm the threshold dialog through the
real panel before continuing. Rerun `panel:golden` live first and stop at the
next concrete stage; only then run the narrow exploration driver test.

Assigned ports are closed and no assigned process remains. Artifacts were
preserved. No commit or push was made.
