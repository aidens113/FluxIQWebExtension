# Lab selector sync, and a creation grant sized so tokens are not the cap (t173-J)

Worker report for brief t173-J (branch `task/t173-audit-close`). Checked against
the Core panel source at Core HEAD e82089f (the rename landed in 68bad85; d67bdfa
and 6c6a06d changed no selector the Lab uses). Core was only read.

## Outcome

**Done.** Every stale panel selector in `packages/test-runner/src` now names what
Core's panel renders today. The creation grant's token budget is now every
authorized call at the per-request limit, so the cost cap, the call count and the
stall guard stop a build before tokens do. `--llm-max-cost-usd` stays exactly what
the operator gave. No live run was made.

## What changed and why

### Goal 1: selectors (old to new, per file)

Every name below comes from Core `apps/web/src`, not from a guess. The main
sources are `views/canonical-view-definitions.tsx`, `hierarchy/flow-generation.ts`,
`authoring/BlankFlowAuthoringPanel.tsx`, `flow-editor/components/FlowEditorView.tsx`,
`runtime/FlowRunView.tsx`, `router/RouterView.tsx`, `shared/CollapseToggle.tsx` and
`hierarchy/AutomationHierarchyDialog.tsx`. Hierarchy `data-tree-item-id`s did
not change (`-runtime-debug`, `-adaptations`, `-router`, `-settings`), so those
selectors were kept.

| File | Old | New |
| --- | --- | --- |
| `demo-llm-blank-workspace.ts` | hierarchy search `"Instructions"`, `[aria-label="Instructions"]` | `"Guidance for the assistant"` (both) |
| `demo-llm-blank-workspace.ts` | project dialog `getByLabel("Security PIN")` fill | removed (the Create project dialog has no PIN field) |
| `demo-llm-blank-workspace.ts` | Add Flow dialog `hierarchyDialogFieldControl(form, "Security PIN")` fill | removed (Flow creation no longer asks for a PIN) |
| `demo-llm-blank-workspace.ts` | `dialog "Authorize Instruction Save"`, PIN, `button "Authorize and Save"` | clicking `Save Instruction` saves directly, then wait for `All changes saved` |
| `demo-llm-create-ui/build-flow-ui.ts` | search `"Runtime Debug"`, open `-runtime-debug` row | select the Flow row, then `openStepsPane` (tab `Steps`, opened from the picker if it is absent) |
| `demo-llm-create-ui/build-flow-ui.ts` | `region "Build Flow from instructions"` | `region "Tell FluxIQ what to automate"` |
| `demo-llm-create-ui/build-flow-ui.ts` | `button "Build Flow from instructions"` | `button "Build proposal from active instructions"` |
| `demo-llm-create-ui/build-flow-ui.ts` | (the proposal opened itself from Runtime Debug) | opens the `Suggested changes` row (`-adaptations`) itself; the table is still named `Adaptations` |
| `demo-llm-create-ui/explore-proposal-ui.ts` | search `"Runtime Debug"`, open `-runtime-debug` row | `openStepsPane` after re-selecting the Flow |
| `demo-llm-create-ui/explore-proposal-ui.ts` | `region "Build Flow from instructions"` and `section[aria-label="Build Flow from instructions"]` | `"Tell FluxIQ what to automate"` (both) |
| `demo-llm-create-ui/apply-proposal-ui.ts` | search `"Adaptations"` | `"Suggested changes"` (the table name `Adaptations` is unchanged) |
| `demo-llm-create-ui/flow-settings-ui.ts` | `dialog "Authorize Flow Settings Save"`, PIN, `button "Authorize and Save"` | `Save Settings` click wrapped in the `update-flow-settings` response wait |
| `demo-llm-create-ui/panel-interaction.ts` | `review()` fills the dialog's `PIN` field | no PIN field (the dialog still has its title and action); new `openStepsPane()` |
| `demo-workspace/adaptation-ui.ts` | search `"Adaptations"` | `"Suggested changes"` |
| `demo-workspace/adaptation-ui.ts` | search `"Runtime Debug"` | `"Run and test"` |
| `demo-workspace/adaptation-ui.ts` | `"Checking Flow readiness..."` | `"Checking whether this is ready to run..."` |
| `demo-workspace/adaptation-ui.ts` | mode button inside `.automation-runtime-run-command` | `selectRunMode()`: opens the `details.automation-runtime-advanced-mode` "Advanced" summary, then the mode button |
| `demo-workspace/adaptation-ui.ts` | Approve/Apply dialogs `getByLabel(/^PIN/)` fill | removed |
| `demo-workspace/diagnosis-ui.ts` | `"Instructions"` search and aria-label | `"Guidance for the assistant"` |
| `demo-workspace/diagnosis-ui.ts` | instruction save and settings save through `Authorize … Save` dialogs | direct saves (the settings save still waits for `update-flow-settings`) |
| `demo-workspace/diagnosis-ui.ts` | `"Runtime Debug"` search, aria-label, readiness text, and the `LLM diagnosis` mode button in the run command | `"Run and test"`, the new readiness text, `selectRunMode` |
| `demo-workspace/panel-run.ts` | `"Runtime Debug"` search; `.automation-runtime-run-command` page-wide | `"Run and test"`; `runPanel()` = `section.automation-runtime-run-panel:not(.automation-flow-authoring-panel):visible` (the Steps authoring region shares the class) |
| `demo-workspace/panel-run.ts` | `No LLM intervention` inside the run command; old readiness text | `selectRunMode`; `RUN_READINESS_CHECK_TEXT` |
| `demo-workspace/panel-navigation.ts` | wait for `"Loading projects..."` to hide (a no-op since Core b8bd363) | removed |
| `demo-workspace/panel-navigation.ts` | search `"Router"`; tab `Router: <flow>` | `"Choose a path"`; `Choose a path: <flow>` |
| `demo-workspace/panel-navigation.ts` | tab, picker button and `strong` `Connected Clients` | `Connected browsers` |
| `demo-workspace/subflow-authoring.ts` | folder search, label and aria-label `Subflows`; `Add inside Subflows` | `Reusable parts`; `Add inside Reusable parts` |
| `demo-workspace/subflow-authoring.ts` | dialogs `Add to Subflows` / `Create Subflow`; kind `/^Subflow/`; PIN fill | `Add to Reusable parts` / `Create Reusable part`; `/^Reusable part/`; no PIN |
| `demo-workspace/subflow-authoring.ts` | tab `/^Nodes(?::\|$)/`; picker `nodes`, `/^Nodes/` | `/^Steps(?::\|$)/`; `Steps`, `/^Steps/` |
| `demo-workspace/subflow-authoring.ts` | tab `Router: <flow>`; picker `router`, `/^Router/` | `Choose a path: <flow>`; `Choose a path`, `/^Choose a path/` |
| `demo-workspace/subflow-authoring.ts` | `Save Fallback`, then `Authorize Router Change`, PIN, `Authorize and save` | `Save Fallback`, then wait for the fallback dialog to close (only deleting a route group still asks for a PIN) |
| `demo-workspace/provisioning.ts` | PIN fills for project create, Flow create and `Generate deterministic Subflow` | removed (none of the three dialogs has a PIN field) |
| `demo-workspace/workspace-lanes.ts` | comment: Connected Clients / Runtime Debug | Connected browsers / Run and test |
| `panel-verification.ts` | `button "Expand sidebar"` | `button "Show the sidebar"` (exact) |
| `ui-e2e/assertions/adaptations.ts` | review dialog `getByLabel(/^PIN/)` fill | removed |
| `demo-llm-create-ui/tests/exploration.test.ts` | pins `aria-label="Build Flow from instructions"` and the `-runtime-debug` row | pins `Tell FluxIQ what to automate`, `openStepsPane`, the `-adaptations` row, and that no `-runtime-debug` row is used |
| `demo-llm-create-ui/tests/readiness-gate.test.ts` | seam `Build Flow from instructions`; order anchor `create-runtime-search` | the new region, button and `Suggested changes` seams; anchor `create-steps` |
| `tests/demo-llm-prepare.test.ts` | pins the `Security PIN` fills and `Authorize Instruction Save` | pins that neither is present and that the row is `Guidance for the assistant` |
| `tests/demo-llm-live.test.ts` | pins the text `Checking Flow readiness` | pins `RUN_READINESS_CHECK_TEXT` |

These `ui-e2e` files needed no selector change: `assertions/runtime-debug(-facts).ts`, `journeys/{dataset-panel,failure-log,failure-presentation,panel-rerun}.ts`. Their "Runtime Debug" mentions are prose in comments and failure messages. Their locators (`Find a run`, `Run datasets`, `N stored`, `Stored datasets`, and the classes) are unchanged in Core. They run through `runDemoFlowFromPanel`, which is fixed.

The `pin` parameters stay in the function signatures, unused, so that callers outside my files (`run-scenario.ts`, `flow-lane/**`) need not change.

### Goal 2: the creation grant's tokens (audit item D)

- `live-llm/live-llm-plan.ts` (`runTokenBudget`): for `build_and_adapt`, the run token budget is now `--llm-max-total-tokens` times the authorized calls. That is the most Core issues. A typed `--llm-max-run-tokens` is still validated but does not bind a build. The campaign's 48 calls at 56k give 2,688,000 tokens. At about 16k input tokens per decision, that is more than every authorized decision. Every other purpose keeps the old rules unchanged. The plan's `maxEstimatedCostUsd` and `maxTotalEstimatedCostUsd` are unchanged: per call, the operator's value held to Core's $0.25; in total, `min($2, cost x calls)`. The high-token confirmation now follows automatically, because the budget is above Core's 560k threshold.
- I made the change in the plan, not only in `execution-grant.ts`, on purpose. Three places read the plan's number: the grant, the post-run budget check (`budget.ts`) and the run snapshot. Changing only the grant request would have failed every long build afterwards with `performance.budget` at 600k.
- `live-llm/execution-grant.ts`: comment only. The request logic already asks for `min(plan budget, per-call x calls)`. A `verify_result` override still asks for one call's tokens and no confirmation.
- `live-llm/budget.ts`: a breach message no longer credits a build's budget to `--llm-max-run-tokens`.
- Tests: `execution-grant.test.ts` has a new creation-grant test covering the campaign numbers, tokens covering every decision, the confirmation, the cost cap held and the judge grant. `live-llm-plan.test.ts` updates the create-flow case: the default is exposure; a typed 600k does not bind; a $0.01 cost cap is kept; the typed value is still validated; `repair` still honours 600k. `live-llm-run.test.ts` sets the overspend case to the new build budget.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` first failed with about 60 TS2305/TS2835 errors, all in `domain/dist`: a stale `dist` that the package script never rebuilds. None were in my files. I ran `pnpm --filter @fluxiq-web-extension/domain build`: "removed 519 emitted file(s)", "818 specifier(s) in 246 file(s)". After that, `npx tsc -p tsconfig.json --noEmit` gave exit 0, and the final `pnpm check` (package) gave exit 0.
- `pnpm build` (package): exit 0, twice.
- `node --test dist/**/*.test.js` (the whole test-runner package): `tests 1490, pass 1463, fail 27`. All 27 fail with `Windows auth-cache ACL verification did not prove exclusive current-user access`, from `windows-acl.ts`, which I did not touch. It is environmental (this sandbox).
- The final focused run after the last edit, `node --test dist/live-llm/tests/*.test.js dist/demo-llm-create-ui/tests/*.test.js dist/demo-workspace/tests/*.test.js "dist/ui-e2e/**/*.test.js" dist/tests/demo-*.test.js dist/tests/panel-verification.test.js`: `tests 351, pass 346, fail 5`. The 5 are the same ACL failure. Before I fixed the tests, 3 real failures appeared, and all 3 are now fixed: live-llm-run "a build over its run budget…", demo-llm-live, and demo-llm-prepare.
- `node scripts/structure-audit.mjs` (read-only): 1 violation, `[working-docs] docs/working/README.md is out of date`. That is not an owned path. Only warnings came from my files: `explore-proposal-ui.ts` 429 lines and `live-llm-run.test.ts` 424 lines, both over the 400-line advisory threshold.

## Not verified

- **No live run and no browser launch** (the brief forbade both). Nothing here proves the selectors resolve in a real panel. In particular these are unverified:
  - that the `Steps` tab exists by default or is offered by the picker under the option name `Steps…`;
  - that the Steps pane follows the Flow row selection for a blank top-level Flow;
  - that `details > summary` opens the Advanced run modes;
  - that `section.automation-runtime-run-panel:not(.automation-flow-authoring-panel):visible` is unique.
- I did not investigate the ACL test failures. I did not rerun them outside the sandbox.
- No repo-wide `pnpm check`, `test` or `build`.
- Out of scope: `run-scenario.ts`, `flow-lane/**` and `existing-fluxiq-control/**` were not searched for selectors. `scripts/lab/live-campaign` still passes `--llm-max-run-tokens 600000`. That value is now ignored for `create-flow`, but still binds `repair` and `adapt`.

## Open questions or contradictions found

- **Is the plan the right place for the token change?** The brief named `execution-grant.ts`, but the change is in `live-llm-plan.ts`. Changing the grant alone would contradict `budget.ts`, which fails a run over the plan's budget. The supervisor should confirm that the Lab may override a typed `--llm-max-run-tokens` for builds. The file's header still says a typed cap "can only ever bind harder". That sentence now names the exception.
- **The repair grant inherits the build budget.** A create-flow run's repair grant copies the build's `maxTotalTokensPerRun`. `live-llm-run.test.ts` asserts that the repair "asks for no more" than the build. So a repair now also asks for the exposure (still under the cost cap). If the repair should keep a smaller budget, that is a follow-up in `live-llm-run.ts`.
- **The Suggested changes view no longer opens itself.** After a build, the Steps pane does not open the proposal for review, because `FlowEditorStartPane` passes no `onOpenAdaptation`. The Lab now opens it itself, but a person using the panel will not see it open. This may be a Core UX regression worth a line.
- **`docs/working/README.md` is stale.** It fails the structure audit. Regenerate it with `pnpm structure:baseline` (supervisor).
- **`domain/dist` was stale** (written 22:14) and broke the test-runner typecheck until it was rebuilt. The `domain:dist` script never rebuilds an existing `dist`.
