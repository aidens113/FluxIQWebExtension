# T027 Panel Live Golden Path

Status: Blocked before provider execution
Date: 2026-09-20
Worker: `w2-t027-panel-live`

## Candidate and isolation

- Downstream: `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`
- Core: `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`
- Browser/build: production Chromium extension build, headed production panel
- Panel/gateway: isolated loopback ports `3357` / `4927`
- Run root: `F:\fxlab-runs\t027-panel-live`
- Workspace: `F:\fxlab-runs\t027-panel-live\workspace`
- User port `3000`, profile, store, and panel were not touched.
- Credentials and the provider key were loaded only into command-local process
  environments. They were not copied to either worktree or report.

The pinned Core checkout initially lacked generated package output. Building
`@fluxiq/contracts`, `@fluxiq/client-gateway-websocket`, and `fluxiq` completed
the prerequisite. `pnpm demo:llm:setup` then passed, including its redaction
attestation, and configured the provider through the real panel in the isolated
workspace.

## Live result

The required `pnpm panel:golden` command was invoked. On the fresh workspace it
started the isolated Core successfully, authenticated, and then failed before a
browser evidence bundle was produced. Sanitized inspection found that the
orchestrator calls `runDemoLlmExplorationCheckpoint` without first creating the
blank-workspace preparation state that this production driver requires.
`packages/test-runner/src/panel-golden-path/lane.ts:42` binds `proposeCreation`
directly to `runDemoLlmExplorationCheckpoint`, and line 78 invokes it without
first composing the exported `prepareDemoLlmBlankWorkspace` driver from
`demo-workspace/blank-preparation.ts`. The lane therefore cannot run from a
fresh workspace even though `panel:golden` presents itself as the campaign
launcher. Its public result discarded the underlying reason and returned only
`panel_golden_path.failed`.

The documented non-product prerequisite, `pnpm demo:llm:prepare`, was then run
once in the same isolated workspace. This launched the actual production panel
and browser and stopped on the first actionable UI-driver failure:

- evidence run: `demo-llm-blank-prepare-2026-09-20T23-22-19-861Z-a1884b`
- elapsed: `32.249 s`
- event/screenshot counts: `14` / `14`
- step: `blank-project-name`
- summary: `Enter the instruction-only project name`
- phase / phase index: `operation-entered` / `8`
- failure class / code: `playwright-timeout` / `playwright.timeout`
- source: `browser-evidence:54:34`

The final browser capture visibly showed the production **Create project**
dialog and its empty project-name input, description input, PIN input, and
disabled submit button. The panel was responsive; the driver could not address
the project-name field. The failing locator is at
`packages/test-runner/src/demo-llm-blank-workspace.ts:89`:

```ts
dialog.getByLabel("Project name", { exact: true })
```

The current UI's accessible label includes its required marker. The established
recording-workspace provisioning driver already avoids this mismatch by using
`getByLabel("Project name")` without exact matching. This is a live-confirmed
test-driver compatibility defect, not evidence that panel project creation is
broken. The PIN locator at line 91 has the same exact-match risk and should be
aligned in the same focused repair before the rerun.

## Golden-stage ledger

| Stage | Result | Evidence |
| --- | --- | --- |
| Instruction entry | Blocked | Blank project could not be prepared because the UI locator timed out. |
| Exploration progress | Unverified | Not reached. |
| Creation proposal review | Unverified | Not reached. |
| Creation approval | Unverified | Not reached. |
| Creation application | Unverified | Not reached. |
| Normal run and oracle | Unverified | No Flow or run was created. |
| Normal run presentation | Unverified | Not reached. |
| Failure presentation | Unverified | Not reached. |
| Repair review/apply | Unverified | Not reached. |
| Repaired rerun | Unverified | Not reached. |
| Restart/saved reuse | Unverified | Not reached. |
| Recording path | Unverified | Not reached. |

Provider calls were `0`. There are no project, Flow, adaptation, or run IDs to
report. No scenario oracle executed.

## Classification and next repair

Classification: **testing-facility/orchestrator blocker**, live-confirmed in the
real panel. It prevents product golden-path evidence but is not itself a failure
of the panel's project-creation behavior.

The smallest repair is:

1. In `packages/test-runner/src/demo-llm-blank-workspace.ts`, align the
   project-name and PIN label locators with the already-working non-exact
   locators in `demo-workspace/provisioning.ts`.
2. Make `packages/test-runner/src/panel-golden-path/lane.ts` own or explicitly
   call the blank-workspace preparation step so `pnpm panel:golden` is runnable
   from its documented fresh isolated workspace.
3. Preserve a sanitized structured cause in
   `scripts/run-panel-golden-path.mjs`; the current generic catch hides the
   failing stage and forces artifact archaeology.
4. Rerun only `pnpm panel:golden` in a fresh pinned workspace. Do not run unit or
   full suites before this live lane gets past project preparation.

No source file was edited. No command was retried after the live UI-driver
failure. The assigned ports are closed and no assigned panel, browser, or Core
process remains running. Run artifacts were preserved.
