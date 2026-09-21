# T027 Panel Driver Fix And Live Rerun

Status: Focused fix live-proven; next driver blocker identified
Date: 2026-09-20
Worker: `w2-t027-panel-driver-fix`

## Scope and candidate

The isolated panel pair remained pinned to downstream
`0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf` and Core
`ef7892fc50b19667400c4fcb6be82f2e826e6fc0`, with the focused downstream
working diff described below. The lane reused isolated ports `3357` / `4927`
and `F:\fxlab-runs\t027-panel-live`; it did not touch the user's port-3000
panel, profile, store, Core source, or product UI.

## Focused repair

Only the files owned by the brief changed:

- `packages/test-runner/src/panel-golden-path/lane.ts`
  - adds `prepareWorkspace` to the driver seam;
  - binds it to the existing `prepareDemoLlmBlankWorkspace` production driver;
  - awaits preparation before the creation checkpoint.
- `packages/test-runner/src/demo-llm-blank-workspace.ts`
  - changes the Create project dialog's `Project name` and `Security PIN`
    locators from exact label matching to the current working non-exact pattern.
- `packages/test-runner/src/tests/demo-llm-prepare.test.ts`
  - added only after the live rerun had proved progression;
  - checks preparation precedes creation and guards the two repaired locators.

No product behavior, Core code, launcher error handling, or unrelated locator
was changed.

## Live-first result

The actual `pnpm panel:golden` command was rerun immediately after the two
source changes. The production panel and headed Chromium opened, the Create
project dialog appeared, and the project-name field was visibly filled. This
proves both fixes were active: the golden command owned its preparation and the
original `blank-project-name` timeout was cleared.

The run then stopped at the next visible driver step:

- evidence run: `demo-llm-blank-prepare-2026-09-20T23-27-37-760Z-8f0327`
- elapsed: `32.412 s`
- event/screenshot counts: `16` / `16`
- failing step: `blank-project-description`
- phase / phase index: `operation-entered` / `9`
- failure class / code: `playwright-timeout` / `playwright.timeout`
- source: `browser-evidence:54:34`

The final screenshot shows the populated project-name field and the visible,
empty Description field. The remaining driver still uses
`getByLabel("Description", { exact: true })` at
`packages/test-runner/src/demo-llm-blank-workspace.ts:90`; the current field's
accessible naming includes its helper text. The established provisioning driver
already uses the non-exact form. This is the next testing-driver compatibility
blocker, not a demonstrated product project-creation failure.

Provider calls were `0`. Project submission was not reached, so no project,
Flow, adaptation, run, or oracle result exists yet. Per the brief, this worker
did not broaden the fix to the newly discovered Description locator.

## Narrow checks after live progression

After the live panel proved the original blocker cleared:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/tests/demo-llm-prepare.test.js
```

The final focused result passed `6/6`. The first assertion iteration was too
broad and also matched a separate valid PIN dialog later in the file; it was
narrowed to the Create project evidence steps, after which the exact test
passed. No full or repository-wide suite ran.

## Next focused action

Change only the Create project's Description locator to the established
non-exact form, rerun `pnpm panel:golden` live immediately, and stop at the next
real stage. Keep the three live-proven changes from this task. Do not add more
tests or run a broad suite until the panel advances beyond project creation.

The assigned ports are closed. No assigned panel, Core, or browser process
remains running. Artifacts were preserved. No commit or push was made.
