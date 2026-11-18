# Home speed (worker, t915)

## Outcome
Done. Cause: Home's "All projects" runs read cost 2 requests per project (`list-flow-runs` + `list-flow-summaries`) and waited for the project list first. The dev server answers about 1 s per request and runs them about 6 at a time, so Home cost grew with the project count (the test data went from 2 to about 6 projects: 35 to 46 requests, content 469 to 2086 ms). Individual reads are not slow (all about 0.7-1 s, empty results, same as `/api/ready`). The loader was already parallel; the fan-out was the cost.

## What changed and why
- Core: new session-only reads (not on the paired-token allowlist), each IAM-filtered per project through the registry list filter, scoped by `listProjects(domainId)` like `list-conversations`:
  - `list-recent-flow-runs` (newest 100 runs per project, each with `projectId`)
  - `list-workspace-flow-summaries` (Flows of all projects, each with `projectId`)
- Web: `loadAllRuns` (2 requests, at once, whatever N). Home uses it when no project is in view, so it no longer waits for the project list. A project in view keeps `loadRuns` (2 requests). No caps changed, no data hidden, no new timers.

## Files
- `packages/fluxiq/src/programs/automation-studio/api/handlers/across-projects/{across-projects.ts,index.ts,tests/across-projects.test.ts}` (new; own folder because `handlers/tests` was at the 25-file limit)
- `.../handlers/register.ts`, `packages/fluxiq/src/api-contracts/automation/endpoints.ts` (2 endpoint names)
- Regenerated (FLUXIQ_REGENERATE_IAM_CATALOG=1): `packages/contracts/src/iam/actions.generated.ts`, `packages/fluxiq/src/platform/iam/catalog/generated/read-only-actions.generated.ts` (2 lines each)
- `apps/web/src/features/home/data/{index.ts,load/index.ts,load/all-runs.ts,load/tests/all-runs.test.ts}`
- `apps/web/src/features/home/HomePage.tsx` (outside `data`, small: picks `loadAllRuns`, drops the project-list gate)

## Commands and results
- Before (same data, 5 projects, direct API with session, ten calls in parallel as the browser does): 2424 / 2360 / 2343 ms. After (2 calls): 973 / 958 / 937 ms. Requests for Home content: 10 to 2 (and one fewer wait on `projects`). Sequential per-call earlier: 0.7-2.8 s each, noisy machine.
- vitest (fluxiq): iam catalog + across-projects: 15 passed (catalog regenerated); after the move, across-projects 4 passed.
- vitest (web, src/features/home, 23 passed). Needed a temporary copy of vitest.config without the stale-dist gate (other workers' edits made dist stale); copy removed.
- `pnpm --filter fluxiq check` passed; `pnpm --filter @fluxiq/web check` passed; `node scripts/structure-audit.mjs` passed (it notes 2 baseline entries can be lowered).

## Not verified
- Browser Home content time (shell/content/idle) after the fix: the dev server was too loaded for Playwright (page loads 60-100 s, 0 API requests captured), so before/after are API timings, not page timings. Re-run the walk-through for the page numbers.
- No IAM filter test against a real authorizer with a denied project (mock-based tests only; the filter is the registry's shared one).
- Core `dist` not rebuilt; web tests need a rebuild to pass their gate normally.

## Open questions
- Chats/Runs/Flows pages for "all projects" may fan out the same way; not touched.
- Extension does not need these reads.
