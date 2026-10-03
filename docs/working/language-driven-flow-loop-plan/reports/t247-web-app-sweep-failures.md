# t247 web app sweep failures — worker report (t247-worker)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t247/!FluxIQ`, branch `task/t247-web-app-sweep-failures`. Nothing committed.

## Outcome

Done. All 353 apps/web test files pass (2,895 tests). The apps/web typecheck passes, and so does the Core structure audit. I reviewed the previous worker's uncommitted changes and kept them as they were. The only thing I added was a docs correction in `docs/architecture/package-boundaries.md`.

## Failures and causes

Before the change, Core's root `pnpm test` ran `pnpm -r test`. That command stops at the first package that fails, so apps/web's tests never ran in the sweep and two failures went unseen:

1. **`hierarchy/tests/architecture.test.ts` "keeps implementation modules bounded"**: `components/ProjectTree.tsx` had 301 lines, over the 300-line limit. The file mixed several jobs: tree composition, viewport measurement and scroll-into-view focus, keyboard handling, two row components and some stale re-exports. The fix splits it by job:
   - `components/RootFlowRow.tsx` holds `AutomationHierarchyRootFlowRow`. It was moved unchanged, apart from a new name.
   - `components/LoadMoreRow.tsx` holds `AutomationHierarchyLoadMoreRow`. This was inline JSX before; it is now a component that takes `level`, `parentId`, `pageInfo` and an optional `loadMoreChildren`.
   - `hooks/useTreeViewport.ts` holds `useAutomationHierarchyTreeViewport`: the ResizeObserver height, the scroll offset, `focusRow` and `handleScroll`. The logic is the same as before. `previewFocus` is now passed in, using the same `hierarchyStore.previewFocus` binding.
   - `hooks/useTreeKeyDown.ts` holds `useAutomationHierarchyTreeKeyDown`. The handler logic is the same as before, now wrapped in `useCallback`.
   - The barrels `components/index.ts` and `hooks/index.ts` export the new files.
   - I removed two re-exports from `ProjectTree.tsx`: `AutomationHierarchyTreeRow`, which the barrel already exports through `./TreeRows`, and the selector functions, which belong to `../selectors`. The only importer of those selectors through `ProjectTree` was `ProjectTree.test.tsx`, which now imports them from `../../selectors`. A grep of `apps/web/src` found no other importer.
   - `ProjectTree.tsx` is now 201 lines. Each new file exports one thing, and no code was extracted and then dropped.

   One small behaviour difference: `handleScroll` and the keydown handler are now memoised. They used to be recreated on every render. This does not change what they do.

2. **`settings/tests/settings-round-trip.test.tsx` "defaults ... to Core's $0.25 run ceiling"** failed with `expected 0.25 to be NaN`. The test and the form were wrong; Core was right. Core changed the run ceiling to $0.10, set through `FLUXIQ_LLM_RUN_COST_CEILING_USD`, in two steps:
   - `runtime/llm/flow-execution-limits/run-cost-ceiling.ts` now reads `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD: number = resolveAutomationStudioLlmRunCostCeilingUsd()`. The test's pattern `= ([0-9.]+);` no longer matched, so it parsed nothing and produced NaN.
   - The default is now `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_DEFAULT_USD = 0.1` in `model/run-cost-ceiling/run-cost-ceiling-env.ts`.
   - `model/flows.ts:297` stores `maxEstimatedCostUsdPerRun: resolveAutomationStudioLlmRunCostCeilingUsd()`.

   The fix:
   - The form default in `flow-settings-model.ts` changes from 0.25 to 0.1, with a comment naming Core's constant and the environment variable.
   - The test now pins the value to `run-cost-ceiling-env.ts` and checks that `flows.ts` stores the resolved ceiling.

   This matches the user's rule: one $0.10 purse, configured by the environment variable. The settings value can only lower it. I confirmed in `run-budget.ts` and `recovery/annotation/run-budget.ts`, reading only, that recoveries fall back to the same ceiling.

## Changes (Core tree, uncommitted)

- `package.json`: `"test": "pnpm -r --no-bail test"`.
- `AGENTS.md`: comment on `pnpm test` saying one failing package no longer stops the rest.
- `apps/web/src/features/automation-studio/hierarchy/components/{ProjectTree.tsx, LoadMoreRow.tsx (new), RootFlowRow.tsx (new), index.ts, tests/ProjectTree.test.tsx}`.
- `apps/web/src/features/automation-studio/hierarchy/hooks/{useTreeKeyDown.ts (new), useTreeViewport.ts (new), index.ts}`.
- `apps/web/src/features/automation-studio/settings/{flow-settings-model.ts, tests/settings-round-trip.test.tsx}`.
- `docs/architecture/package-boundaries.md` (added by me, brief step 3):
  - In the "model sees the whole page" entry and the recovery "Cost" bullet, "$0.25 run cost ceiling" now says the ceiling is set by `FLUXIQ_LLM_RUN_COST_CEILING_USD` and is $0.10 by default.
  - The derived per-call share changes from about $0.0104 to about $0.0042 ($0.10 / 24).

## Commands run and observed results

- `bash .../heavy.sh "t247 web tsc" pnpm exec tsc --noEmit` (in `apps/web`) -> `EXIT 0`, with no diagnostics. heavy.sh printed `reclaiming abandoned b2: t247 root pnpm test`. That was the dead root run's slot; I did not restart the run.
- `bash .../heavy.sh "t247 web vitest" pnpm exec vitest run --passWithNoTests` (in `apps/web`, the same as the package's `test` script) -> `Test Files 353 passed (353)`, `Tests 2895 passed (2895)`, `Duration 181.02s`, `EXIT 0`.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (219 warning(s), 349 baselined).`, exit 0. Two of the warnings are advisory notes about touched files: `ProjectTree.test.tsx` at 524 lines and `flow-settings-model.ts` at 642 lines are both over the 400-line advisory threshold. Both files were already over it before this change.

## Not verified

- Core's root `pnpm test`, `pnpm check` and `pnpm build` were not run, as the brief required. `--no-bail` has not been exercised end to end.
- The ProjectTree split was not checked in a live browser. I checked it only through the unit and source tests and by reading the diff.

## Open questions or contradictions found

- `docs/reference/framework-reference.md` still says "$0.25 cost ceiling" or "$0.25 per-build ceiling" in rows generated from Core source comments:
  - `runtime/llm/harness/token-limits.ts:20`
  - `model/tokens-per-run/tokens-per-run-default-cleared-key.ts:9`
  - the `AUTOMATION_STUDIO_RESULT_CHECK_AUTHORIZATION_DEFAULTS` doc, which says "a recovery's own $0.25"

  The fix is to edit those comments and then run `pnpm docs:reference`. Those files are outside my owned paths, and `runtime/**` is explicitly off limits, so I left them.
- Other "USD 0.25" mentions are still correct and were left alone. They refer to the separate per-call default `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_ESTIMATED_COST_USD = 0.25` and to the form's diagnosis cap, for example in `automation-studio.md`, `llm-flow-bootstrap.md` and `FLOW_LLM_DIAGNOSIS_MAX_COST_USD`.
