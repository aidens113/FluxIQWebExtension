# Panel UI content pages (brief 4 of 4), task t915

Outcome: Partial. CSS and markup fixes are in and verified by check and tests. Screenshots exist for every route except Flows and chat thread in dark (dev server refused connections for those two). Data never finished loading during any capture (the dev server answered in 25-30 s), so loaded states of Home, Chats and Runs rows were not seen.

## What changed (all under CORE/apps/web/src/features)
- Home `home.css`: `.home-row` is now a grid (`minmax(0,1fr) auto`), so the "Connected" state column no longer wraps to a new line and indents; stacks left-aligned at 720 px. Cards use `--radius` and `--surface`.
- Chats `chats.css`: tools row is a 2-column grid of full-width fields (search placeholder no longer clipped, label above, one column at 390). `.chats-thread time` capped to the column (see Open).
- Flows `FlowsProjectPicker.tsx` + `flows.css`: "New project" is now a card (`.flows-new`): label above a full-width input, Create project and All projects beside it, wraps below 260 px.
- Runs and Data: `RunsSkeleton.tsx`, `DataSkeleton.tsx` (row-shaped pulse, reduced-motion safe, a visually hidden "Loading your runs/data…" for screen readers), empty and error states are now bordered cards with a title and a hint; h1 sizes match the other pages.
- Projects `projects-page.css`: catalog h1 inherits the panel h1 size. The catalog itself already matched the panel.
- Exports unchanged: `chats/index.ts`, `projects/index.ts` untouched.

## Commands run and results
- `npx vitest run --minWorkers=1 --maxWorkers=4` on home, chats, projects, flows, runs, data, app/(panel): exit 0 (`--maxWorkers` alone fails with a Tinypool minThreads conflict).
- `pnpm --filter @fluxiq/web check`: exit 0 (272 s, shared store).
- `node scripts/structure-audit.mjs` in CORE: exit 0, no output.
- Screenshots (before: `test-runs/panel-ui-audit/<route>-<theme>-<w>.png`; after: `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension/test-runs/panel-ui-fixes/content/`): home, projects, chats, runs, data in light and dark at 1440 and 390; flows and chat in light at 1440 and 390 (e.g. `flows-light-1440.png`, `chat-light-390.png`). Metrics in `report-fixes.json`, `report-flowschat.json`: no horizontal scroll anywhere; no overflow outside the rail (see Open).

## Not verified
- Home "Connected" with real rows, Chats list rows, Flows project list, Runs/Data populated rows: capture showed loading only.
- Chat `<time>` overflow: the thread never loaded, so no message was rendered. Header at 390 shows one row (Chats and New chat on one line), but that may be the chat worker's change.
- Dark Flows and dark chat thread screenshots.

## Open for other workers
- Chat `<time>`: rendered by `packages/ui-components/src/chat/view/message-view.ts` line 99 (`createElement("time", ...)`); `chat/chat.css` has no rule for it (nothing for `time`, no `min-width: 0`/wrap). That is the likely overflow source; chat worker to fix there. My page-level `.chats-thread time` cap is a backstop only.
- Phone bottom nav still overflows at 390 (Security and Settings `li` past the viewport): shell worker (`panel-shell.css`).
- Home data takes long to arrive in dev (outside scope, separate speed fix).

Outcome: Partial
Changed: apps/web/src/features/{home/home.css, chats/chats.css, flows/flows.css, flows/list/FlowsProjectPicker.tsx, projects/projects-page.css, runs/runs.css, runs/list/{RunsListPage.tsx,RunsSkeleton.tsx,index.ts}, data/data.css, data/list/{DataView.tsx,DataSkeleton.tsx,index.ts}}
Validation: vitest (owned folders) exit 0; `pnpm --filter @fluxiq/web check` exit 0; structure-audit exit 0
Not verified: loaded states, chat time overflow, dark Flows and chat shots
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/panel-ui-content.md
