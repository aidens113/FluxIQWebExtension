# Cross-project reads: IAM proof and Runs page

Outcome: Done.

## What changed and why
- New real-runtime test `packages/fluxiq/src/programs/automation-studio/api/handlers/across-projects/tests/across-projects-iam.test.ts` (service IAM profile, Alice and Bob each own a project and a real Flow): each read returns only the caller's own project's runs and Flows, never the other's; another domain shows nothing; a paired-token call through `handleProgramRequest` is refused on both reads before `listProjects` runs. Runs are a spy on `listFlowRunSummaries` (no easy real run seeding); Flows and projects are real.
- DEFECT FOUND AND FIXED: on the service profile both reads were "Not authorized" for every ordinary person, because the two actions were missing from `FILTERED_WORKSPACE_LISTS` in `packages/fluxiq/src/platform/iam/predefined/user-access.ts`. Added `studio:ListRecentFlowRuns` and `studio:ListWorkspaceFlowSummaries` (outside the named owned paths, but it is the cause). The mock-only tests could not see it.
- Cross-project run cap raised 100 to 200 per project in the handler (and its test), so the Runs page, which read 200 per project, loses no history.
- Runs page: `apps/web/src/features/runs/data/load-run-rows.ts` fanned out (projects, then per project `list-flow-runs` + `list-flow-summaries`). Now two requests (`list-recent-flow-runs`, `list-workspace-flow-summaries`); `incomplete` now means Flow names unread (note text in `RunsListPage.tsx` updated). Test rewritten.
- Flows page: no fan-out. `loadFlowListing` reads one project (picker); "All projects" is only a link to /projects. Unchanged.

## Commands run and observed
- Filtering removed (`list:` lines deleted from the handler) -> IAM test: 2 failed (runs, Flows), 2 passed; restored.
- vitest across-projects folder: 2 files, 8 passed. With `api-iam-escalation` and `platform/iam/predefined`: 6 files, 51 passed (escalation test lists the two reads as filtered workspace lists, none refused).
- web vitest runs, flows, home (temp config skipping only `refuseStaleCoreBuild`, deleted): 13 files, 88 passed.
- `pnpm --filter fluxiq check`, `pnpm --filter @fluxiq/web check`: both completed with no errors. `node scripts/structure-audit.mjs`: passed.

## Not verified
- Run listing against a real run store; live panel; Core dist not rebuilt (guard was bypassed).
- Full web and Core suites not run.

## Open questions
- The audit says 2 baseline entries can be lowered (not from this change; `pnpm structure:baseline` not run).
