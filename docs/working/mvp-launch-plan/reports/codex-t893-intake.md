# t893 intake inventory

Outcome: Done

## Baseline and scope

- Checkout: `task/t893-web-instant-actions-4`, HEAD `e6fd713ed`; ahead 24. The untracked `docs/working/mvp-launch-plan/` directory is the authorized session brief/report area, not unrelated user work.
- `dev` was `e73e8e044`. The task branch has not incorporated this latest `dev` tip: its merge commit is from the earlier base. `git diff dev...HEAD` lists the paths below as t893-specific work against the merge base.
- I read the `Current State` of `docs/working/task-speed-plan.md`. It says t893 is held until professional-network passes with the act-gate fix now in dev. Its old sync blocker named a `next start` server (PID 17772, ports 49216/49217); the current readiness probe below found that process and both listeners absent.
- I read t885's `codex-t885-resume.md` from its worktree. It attributes t885's company-website interruption follow-on to downstream domain layer ownership in `domain/src/runtime/llm-evidence/node-run/own-layers/`: a layer appearing while answering an interruption was incorrectly credited as opened by that act, so its later dismissal became required. Core retains its optional-step protections. That is distinct from t893's reported professional-network chat Close/greeting act-gate control confusion. The reports concern different scenarios and different identified causes; no shared defect is established.
- No tests, builds, browser sessions, Lab runs, or git mutations were performed.

## Unique t893 production and test paths

The surviving unit is the page-aware wait and readiness optimization, not t896/t897's press/replay work:

- `apps/extension/src/content/action-runtime/page-work/address-settle.ts` (new)
- `apps/extension/src/content/action-runtime/page-work/page-quiet.ts` (new)
- `apps/extension/src/content/action-runtime/page-work/index.ts` (new)
- `apps/extension/src/content/action-runtime/page-work/tests/page-work.test.ts` (new)
- `apps/extension/src/content/actions/execute.ts`
- `apps/extension/src/content/extraction/list-wait.ts`
- `apps/extension/src/content/extraction/page-render.ts`
- `apps/extension/src/content/extraction/tests/page-render.test.ts`
- `apps/extension/src/runtime/automation-tab.ts`
- `apps/extension/src/runtime/navigation-events/epochs.ts`
- `apps/extension/src/runtime/navigation-events/index.ts`
- `apps/extension/src/runtime/navigation-events/page-work.ts`
- `apps/extension/src/runtime/navigation-events/tests/epochs.test.ts`
- `apps/extension/src/runtime/tests/tab-ready-events.test.ts`
- Rename: `apps/extension/src/runtime/navigation-events/page-settled.ts` → `apps/extension/src/shared/scheduled-work-settled.ts`
- Rename: `apps/extension/src/runtime/navigation-events/tests/page-settled.test.ts` → `apps/extension/src/shared/tests/scheduled-work-settled.test.ts`
- Authored architecture update: `docs/architecture/extension-client.md`
- Existing lane report: `docs/working/task-speed-plan/reports/instant-actions-4.md`

The two fixes are: readiness proof follows the same top document across in-place address changes, with redraw settling moved into the page; and one-page list growth windows can end when page-world scheduled work settles, after scroll/intersection handlers have run.

## Remaining acceptance and known limits

- **Professional-network is still unaccepted.** The t893 report says `professional-network-accept-messaged-invitations` succeeded on dev before the change but the after run ended `waiting_for_person` / `stuck_in_a_loop`. The proposed cause is Core's act gate treating a different control (the chat's Close) as an act already done after the faster read. The task-speed-plan Current State says this act-gate defect is now fixed in dev. The professional-network task is present at `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts`; the `notes-back` form uses the scripted model path and is covered by its adjacent test file.
- **t885 overlap:** The t885 resume note confirms a company-website downstream-domain layer-ownership defect after an interruption is answered; Core keeps its optional-step protections. t893 reports a professional-network act-gate confusion involving the chat Close control. These are distinct reported causes and scenarios; the evidence does not establish a shared defect.
- **Known unverified t893 behavior:** cause of local-classifieds s5's remaining wait; load-matched before/after timings; a second-site replay; child-frame action after a top-document pushState; Firefox; and a WebSocket-fed list.
- **Dining replay diagnosis is fixed on dev.** t896 narrowed replay judgments to the absent saved cookie-banner interruption being classified as `act_not_done`. t897's report on dev says `steps-ran.ts` now treats an absent, unclaimed saved interruption as `absent`; its dining `--attempts 4` proof passed, and attempts 3–4 stood on the saved Flow at zero calls. This is separate from t893's professional-network issue.
- Earlier t893 tests passed in the lane report, but they are not fresh validation against current dev. The current branch must incorporate current dev and paired Core must be synced before live acceptance. The historical server blocker is absent now; the Core sync dry run is allowed and would check out and rebuild the shared Core.

## Readiness snapshot (2026-11-12 19:57 UTC)

- Process/port metadata: PID 17772 does not exist; TCP ports 49216 and 49217 have no listeners. No command line was printed.
- Shared Core: `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ`; detached HEAD (no branch), clean status, HEAD `a5c48d8f65fe5be6d5377c3baa4da80a4b9ad5bf`.
- Core `dev` target: `9319a141012767e215b80e4b46b79545afb3e3e9`; shared Core is 26 commits behind.
- `pnpm.cmd task sync-core --dry-run` completed with `applied:false`, `checkout:true`, `install:false`, `build:true`, and no refusal. Its process guard found no process working inside this Core or its sharing worktrees at that observation. Many sibling worktrees share this Core, so the ordinary command's guard should be allowed to re-check immediately before changing it.

## Exact next acceptance commands

From the t893 worktree root, the current next command is `pnpm.cmd task sync-core`; the dry run above shows the historical process blocker is gone and predicts a checkout plus rebuild. This changes the shared Core, so the task command's running-process guard must remain enabled. After sync, run the extension check and exact changed test files. The test runner lives under `apps/extension/scripts`, accepts package-relative path fragments, and refuses filters that match no test entry.

```powershell
pnpm.cmd task sync-core
pnpm.cmd --filter @fluxiq-web-extension/extension run check
```

Run the focused tests from `apps/extension`:

```powershell
node scripts/test-extension.mjs src/content/action-runtime/page-work/tests/page-work.test.ts src/content/extraction/tests/page-render.test.ts src/runtime/navigation-events/tests/epochs.test.ts src/runtime/tests/tab-ready-events.test.ts src/shared/tests/scheduled-work-settled.test.ts
```

Run the structure audit from the repository root:

```powershell
node scripts/structure-audit.mjs
```

Then, from the repository root, re-prove the exact professional-network task with the required four-attempt scripted series:

```powershell
$env:FLUXIQ_ATTEMPT_SCRIPT_FORM = 'notes-back'; pnpm.cmd lab attempt professional-network --task professional-network-accept-messaged-invitations --authoring-mode answer-first --scripted-model --attempts 4
```

Record browser/build, Flow identity, each attempt's path and continuation proof, calls, verdict and duration. This inventory did not authorize or perform a run.

## Return contract

Outcome: Done
Changed: `docs/working/mvp-launch-plan/reports/codex-t893-intake.md`
Validation: Process/port metadata at 2026-11-12 19:57:28 UTC → PID 17772 absent; ports 49216/49217 have no listeners. `git -C C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ status --short --branch` → `## HEAD (no branch)` (clean). `pnpm.cmd task sync-core --dry-run` → `applied:false`, detached Core 26 commits behind, checkout and build planned, no process-guard refusal. No tests or builds run.
Not verified: No source behavior or Lab acceptance command was run; the normal mutating `sync-core` command was not run.
Report: `docs/working/mvp-launch-plan/reports/codex-t893-intake.md`
Notes: t897 already closes the dining replay diagnosis; t885's downstream-domain layer-ownership fix is separate from t893's professional-network re-proof.



