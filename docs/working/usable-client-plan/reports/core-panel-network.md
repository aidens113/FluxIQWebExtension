# Core panel network cost (Brief B), task t915

## Outcome
Done, with `check` red only from other workers' files (below). Paths relative to `fxwork/t915/!FluxIQ/apps/web/src/features` (F).

## What changed
- New `panel-shell/shared/`: `createSharedSource` (one read for all subscribers, never two at once, re-read when the tab is returned to, optional poll that skips hidden tabs), `whenTabReturns`, `tabIsHidden`.
- `top-bar`: `projectsSource` (one `projects` read per page load, re-read on tab return or `notifyProjectsChanged()` / event `fluxiq:projects-changed`, a failed read keeps the old list). `useProjectChoices` now reads it, so ProjectSwitcher and AssistantDock share one request. `engineSource` is the single `/api/ready` poller (30 s, paused while hidden, immediate check on return). `useEngineStatus` and new `useEngineReading` read it.
- `dock/AssistantDock.tsx`: chat widget mounts on first open (or `?chat=open`), stays mounted after.
- `home`: `useResource` has no timer now; it loads on mount, on tab return, on `retry`, and when `key` changes; a failed refresh keeps the data marked `stale`; error and stale states carry `retry`. `HomeSection` shows "Try again" for both. `loadEngine` removed; Home's engine section reads the shared engine source. `loadRuns(studio, projectIds, signal)` no longer fetches `projects`; HomePage passes the project in view, or the shared list when "All projects".
- Note: `useResource` is shared with Data, Runs and Security pages, so they also lose the blind 30 s reload and gain tab-return refresh, stale-keep and retry (types are backward compatible; `Resource` fields added are optional).

## Requests per page load, reasoned from code
Before (Home, N projects): 2 `projects` (switcher + dock) + 2 `/api/ready` (top bar + Home) + 1 `projects` (loadRuns) + 2N + `list-conversations` + `list-clients` = 7+2N, then 5+2N more every 30 s on Home plus 1 `/api/ready` from the bar. Other pages: 3 (2 projects + 1 ready) + 1 ready every 30 s; chat widget polling mounted on every page.
After: 1 `projects` + 1 `/api/ready` + `list-conversations` + `list-clients` + runs read. Project in view: 2 requests, so 6 total. "All projects": 2N, so 4+2N total. Every 30 s: only 1 `/api/ready`, none while hidden. Other pages: 2 requests; closed chat costs nothing until first opened.

## Fan-out: no Core cross-project read exists
`list-flow-runs` (`packages/contracts/.../flow-runs.d.ts`) requires `projectId`; `list-flow-summaries` also takes one. A Core read that takes no project (or a project list) and returns runs plus Flow names would remove the 2N for "All projects"; I did not add it (Core packages not mine).

## Commands run
- `pnpm exec vitest run --config <temp config> src/features/panel-shell/top-bar .../dock .../shared src/features/home` -> 7 files, 31 tests passed. The repo's own `vitest.config.ts` refused to start: "Core's library build is 5 minute(s) behind its source" (another worker is editing `packages/fluxiq`). I used a temp config without that guard (my tests do not import Core dist) and deleted it afterwards.
- `pnpm --filter @fluxiq/web check` -> failed, 5 tsc errors, none in my files: `settings-page/connect/tests/connect.test.tsx(40)` and `packages/fluxiq/src/...` (`model-ports.ts`, `answer-ask.ts`, `runtime/llm/index.ts`).

## Not verified
- tsc is clean for my files only by absence of errors in them; the full check was red from others' files.
- No browser run; request counts are from reading code. `useResource` consumers on Data/Runs/Security pages not re-tested beyond type errors absent.
- Other pages creating projects must call `notifyProjectsChanged()` for the switcher to refresh before the next tab return (Brief C should).

## Open questions
- The quirk: Home with a project in view now shows only that project's runs; "All projects" shows all.
