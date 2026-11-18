# Core web panel audit (task t915 tree, read-only)

Paths are relative to `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQ` unless noted. `W` = `apps/web/src`.
Method: static reading only. No server, build or profiler ran, so every cost below is reasoned from code, not measured.

## 1. Why it is slow (ranked by likely impact)

1. **Launch runs `next dev --turbopack`, compiling each route on first visit.** `apps/web/package.json` "dev" is
   `node scripts/build-client-gateway-server.mjs && next dev --turbopack --hostname 127.0.0.1`. The downstream launcher
   `!FluxIQWebExtension/scripts/run-fluxiq-web.mjs:36` spawns `pnpm --dir <fluxiqRoot> --filter @fluxiq/web dev`, after first
   running `domain/scripts/build-web-panel-host.mjs` (line 28). Dev compiles every page and API route lazily on first hit, unminified.
   The app has about 1,288 non-test TS/TSX files in `W`, 287 marked `"use client"`, 22 pages/layouts/route handlers for screens plus
   about 35 API routes. Each tab visited for the first time compiles again (Flows, Runs, Data, Security, Settings; a Flow graph pulls `@xyflow/react`).
   `next.config.ts:5-18` explains dev resolves Core `fluxiq` from `packages/fluxiq/src` (tsconfig paths) with `transpilePackages: ["fluxiq"]`
   (line 24), so the dev server compiles Core source. A production build resolves the stamped `dist` (`tsconfigPath` at line 64).
2. **Every page is a client tree behind a per-navigation server auth gate.** `W/app/(panel)/layout.tsx:10-12` is an async server layout that
   runs `currentFluxIQUser()` on each navigation; `W/lib/auth.ts:8-16` awaits `identityAccess.validateSession` and `presentPanelSession`.
   Then `PanelShell` is `"use client"` (`W/features/panel-shell/PanelShell.tsx:1`), so each page is server auth, then client JS, then client fetches.
   Only `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx` exist, no `loading.tsx` inside `(panel)`, so a slow layout blocks the whole frame.
3. **Home fan-out and a 30 s full reload.** `W/features/home/HomePage.tsx:13-16` mounts four `useResource` loaders;
   `W/features/home/data/use-resource.ts:6,27` re-runs each every 30 s with `setInterval` and flips the section to `error` on any failed refresh.
   `loadRuns` (`W/features/home/data/load/runs.ts:25-40`) does `GET projects`, then per project two POSTs (`list-flow-runs` with `limit: 200`,
   and `list-flow-summaries`): 1+2N program requests per cycle. Each goes through `workspaceProgramContext` and `handleProgramRequest`
   (`W/app/api/programs/[programId]/[endpoint]/route.ts:36-53`). Add `list-conversations`, `list-clients` and `/api/ready`: about 5+2N requests on load and every 30 s.
4. **Duplicate polling and fetching in the shell on every page.** `W/features/panel-shell/top-bar/use-engine-status.ts:6,22` polls `/api/ready`
   every 30 s on all pages (Home polls it a second time via `home/data/load/engine.ts`). `top-bar/use-project-choices.ts` fetches `projects` on mount and is
   called twice (`ProjectSwitcher.tsx:8` and `AssistantDock.tsx:20`): two identical `GET projects` per page load, no shared cache.
   `W/features/security/state/use-reloadable-resource.ts:6,25` polls every 30 s on Security.
5. **The assistant chat is mounted on every page, even closed.** `W/features/panel-shell/dock/AssistantDock.tsx:46` always renders `ProgramChatWidget`
   ("Closing it hides it without unmounting"). Its conversation poller (`W/features/automation-studio/conversation/thread/poller.ts:29-31`: 1 s fast,
   10 s ceiling, 5 s hidden, with backoff) and thread list live for the tab. `chat-widget/options/panel-chat-options.ts:32` asks for `history: { window: 200 }`.
   I did not trace the idle firing rate; with the 10 s ceiling it is at least 6 requests per minute.
6. **`middleware.ts` on every request** (`W/middleware.ts:33-53`; matcher excludes only `_next/static`, `_next/image`, `favicon.ico`). Each request calls
   `resolveFluxIQDeploymentSettings(process.env)`, `currentPanelPreset()`, `isHiddenPanelPath` (a scan of six nav items) and `isCrossSiteRequest`. Pure string work, no I/O. Low impact; it also runs for every poll above.
7. **Startup.** `W/instrumentation.ts` awaits `initializeFluxIQWebRuntime()` once per start (storage, gateway listener, audit). Delays the first request only.

Also checked:
- Sync filesystem/SQLite appears only in `W/server/browser-trust/repository.ts`, `server/connect/service.ts`, `server/key-sessions/service.ts`,
  `server/security-audit/append-audit-line.ts`, `app/api/security/server/platform-audit-reader.ts`: pairing/security paths, not Home/Flows/Runs. Not traced for blocking.
- `@xyflow/react` is imported only under `features/automation-studio/flow-editor/` and `app/(panel)/flows/[flowId]/graph/layout.tsx`, so only the graph route loads it.
- `@fluxiq/ui-components` has a single `.` entry (`packages/ui-components/package.json:9-19`); `chat-widget/ChatWidget.tsx:29` and
  `settings/humanness/HumannessSetting.tsx:4` import the barrel, so a dev compile walks the whole chat/tasks/library surface for the dock on every page. A production build tree-shakes most of it.

## 2. Navigation map

Rail (`W/features/panel-shell/nav/items/panel-nav-items.ts:6-13`): Home `/`, Flows `/flows`, Runs `/runs`, Data `/data`, Security `/security`, Settings `/settings`.
Presets (`W/app/product/preset/panel-presets.ts:21-35`): `full` and `data-collection` show all six; `task-automation` hides Data. The launcher sets no `FLUXIQ_PANEL_PRESET`, so `full`.

| Route | File | Reachable from | Notes |
|---|---|---|---|
| `/` | `(panel)/page.tsx` | rail | Home: engine, today, connected, needs-you, recent runs |
| `/flows` | `(panel)/flows/page.tsx` | rail | Shows only "Choose a project in the top bar" until one is picked (`FlowsListPage.tsx:20-21`); no create-Flow control, only "Ask FluxIQ to make one" |
| `/flows/[flowId]` | `.../[flowId]/page.tsx` | Flows rows | Numbered step editor |
| `/flows/[flowId]/graph` | `.../graph/page.tsx` | not in rail; entry link not verified | Loads @xyflow |
| `/runs`, `/runs/[runId]` | `(panel)/runs/*` | rail; Data "run" links | |
| `/data` | `(panel)/data/page.tsx` | rail | Datasets, CSV/JSON export, "open the run" |
| `/security` | `(panel)/security/page.tsx` | rail | Keys, sign-in link, paired browsers and people, activity |
| `/security/keys`, `/security/sign-in` | subpages | links on Security and Settings tools | targets of old `/programs/*` redirects |
| `/settings` | `(panel)/settings/page.tsx` | rail | AI keys, assistant model, allowance, humanness, theme, Advanced tools |
| `/settings/[tool]` | dynamic | Settings "Advanced" list | background-tasks, deployment-sync, database-manager, docs, runtime, compute-control, production-runner |
| `/connect`, `/connect/authorize`, `/connect/done` | `app/connect` | extension pairing flow only | not linked from the panel |
| `/setup`, `/welcome`, `/reset` | `app` | first run, reset | not in rail |
| redirects | `next.config.ts:41-51` | `/programs/*`, `/domains/*`, `/get-started` | land on Settings, Flows, Home |

Dead ends and gaps:
- `features/automation-studio/project/ProjectCatalogSurface.tsx` and `hierarchy/ProjectBrowser.tsx` (project create, rename, categories; "New project" at
  `ProjectBrowser.tsx:134`) are exported (`project/index.ts:7`) but no route or shell file imports them. Orphaned.
- No page lists chats. Older chats are reachable only in the dock via "Show older chats" (`packages/ui-components/src/chat/view/thread-list/conversation-list.ts:11,69`);
  Home's needs-you list reads open threads only (`home/data/load/threads.ts:8`, `status: "open"`).
- Flows needs a top-bar project; "All projects" is the default option (`ProjectSwitcher.tsx:19`). What Runs and Data show with no project: not checked.
- If `projects` fails, the switcher reads "Projects could not be loaded" with no retry button.

## 3. Configuration coverage

| Need | Status | Where | Evidence |
|---|---|---|---|
| Model provider keys: add, status, remove | Present | `/settings` AI keys; `/security/keys` | `settings-page/ui/AddKeyForm.tsx`, `KeyList.tsx`, `RemoveKeyConfirm.tsx`; `api/keys/route.ts` |
| Default/assistant model, allowance | Present | `/settings` | `AssistantModelSection.tsx`, `AllowanceSection.tsx` |
| Connected clients, pairing, revocation | Partial | Home "Connected" lists clients; Security lists paired browsers with Forget | `security/access/PairedClientsList.tsx:12-17` (Forget only when active). Pairing starts in the extension via `/connect`; approve/dismiss routes exist (`api/client-gateway/approve-pairing`, `dismiss-pairing`) and `app/GlobalClientGatewayPairing.tsx` exists, not traced; no "pair a client" page |
| Account and password | Present | `/security/sign-in` | `security/page/SecuritySignInPage.tsx` (password, PIN, two-factor, sessions) |
| People and invites | Present | Security "Access" | `security/access/AccessSection.tsx` uses `features/accounts` |
| Workspace create, rename, switch | Missing | none | no workspace UI under `features`; only `lib/workspaces` server code |
| Project create, rename, switch | Partial | switch in top bar; create only by asking the assistant | `conversation/capabilities/catalog/projects.ts:13-24`; orphaned `ProjectCatalogSurface` |
| Humanness default | Present | `/settings` | `settings-page/humanness/StartingHumannessSection.tsx` |
| Theme | Present | `/settings` | `settings-page/appearance/` |
| Server address / discovery for clients | Missing in UI | API only: `/.well-known/fluxiq` rewritten to `api/discovery/route.ts` (`middleware.ts:34-36`), `/api/health`, `/api/ready` | No page shows the panel URL or gateway WebSocket URL (launcher passes `ws://127.0.0.1:4777/client`) |

## 4. Projects and chats

- List and switch projects: the top-bar `<select>` only, from `GET /api/programs/automation-studio/projects` (`top-bar/use-project-choices.ts`). Whether the choice survives reload: not checked.
- Create project: no page; only the assistant's `create-project` endpoint.
- A project's chats: the dock thread list (`list-conversations`); open an older one via "Show older chats"; new chat via the dock controls (inside `ui-components`, not traced).
- Flows: `/flows` (`list-flow-summaries` plus runs), editor `/flows/[id]`, graph `/flows/[id]/graph`. Runs: `/runs`, `/runs/[id]` (`list-flow-runs`). Data: `/data`, export through
  `api/programs/automation-studio/run-datasets/[projectId]/[runId]/[datasetId]`. Recordings: `api/recordings`.
- Backing routes: generic `api/programs/[programId]/[endpoint]` plus `api/client-gateway/{snapshot,first-project,...}`.

## 5. Model-key "unlock" UI

No password prompt, unlock button or locked banner for model keys was found in `apps/web/src` or `packages/ui-components/src`. Leftovers:
- `W/features/settings-page/model/engine-tools.ts:20`: the Keys tool blurb still says "add, replace, remove, scope, lock and unlock" (stale wording).
- `W/features/security/model/shape/key-row.ts:11` and `W/features/chat-widget/transport/models-port.ts:32` still read a legacy `unlocked` field (mapped to `upgrade_required`).
- `W/features/security/sign-in/IdentityAccessLive.tsx:332,404,468`: "Credential vault: Unlocked/Locked" panel (credential vault, not model keys).
- `packages/ui-components/src/chat/onboarding/model-readiness.ts` and tests (`chat/view/tests/empty-state-model.test.ts`, `screens/tasks/model/tests/model.test.ts`, `testing/tasks/fixtures.ts`) contain "unlock" strings; not read in detail.
- Server side keeps `W/server/key-sessions/*`, `server/connect/restore-login-keys.ts`, `app/api/keys/session/route.ts` (signed SDK proof exchange; needs header `fluxiq-client: sdk`, so not a UI path).

## 6. Fix plan (four briefs, disjoint files)

**Brief A: launch and dev speed.** Owns `!FluxIQWebExtension/scripts/run-fluxiq-web.mjs` and `apps/web/package.json` (add a `start:local` script) only.
Change: after the host build, run `pnpm --filter @fluxiq/web build` (already stamps and checks identity; build cache skips when fresh) then `next start --hostname 127.0.0.1`
instead of `dev`; keep `dev` behind a `--dev` flag. The build and the other processes must not collide (a build is running now).
Acceptance: `pnpm --filter @fluxiq/web check`; after launch `/api/ready` returns 200 from `next start`; a person sees each tab open within a moment after the first load, with no per-tab compile wait.
Not verified: that production start works with the host module and gateway env vars the launcher sets.

**Brief B: shell and Home network cost.** Owns `W/features/panel-shell/top-bar/**`, `W/features/panel-shell/dock/**`, `W/features/home/data/**`, `W/features/home/HomePage.tsx`,
`W/features/chat-widget/transport/models-port.ts` (legacy `unlocked` line).
Change: one shared projects fetch used by `ProjectSwitcher` and `AssistantDock`; one engine-status source for the top bar and Home; replace Home's per-project 1+2N fan-out
with a single cross-project read or the project in view; pause polling when the tab is hidden; keep previous data on a failed refresh; mount the chat widget on first open and keep it mounted afterwards.
Acceptance: `features/panel-shell/top-bar/tests`, `features/panel-shell/dock/tests`, `features/home/model/tests`, plus new tests for the shared fetch. A person sees one `projects` request per page load and Home filled after one round.

**Brief C: projects, chats, navigation.** Owns `W/app/(panel)/projects/**` (new), `W/features/panel-shell/nav/items/**`, `W/features/automation-studio/project/**`,
`W/app/product/preset/panel-presets.ts`, `W/features/flows/list/FlowsListPage.tsx`.
Change: a Projects page mounting the existing `ProjectCatalogSurface` (list, create, rename, switch), linked in the rail and the switcher; `FlowsListPage` offers a project picker/create inline instead of the top-bar-only prompt;
a Chats list page backed by `list-conversations` (all statuses, older chats loadable). Rail and preset change together because `isHiddenPanelPath` reads the nav list.
It reads the project list through `usePanelContext` only, so it does not clash with Brief B's files.
Acceptance: `features/panel-shell/nav/items/tests`, `app/product/preset/tests`, `features/flows` tests, a new Projects page test. A person can create a project and open an old chat without typing to the assistant.

**Brief D: configuration gaps.** Owns `W/features/settings-page/**`, `W/features/security/access/**`, `W/features/security/keys/**`, `W/features/security/model/shape/key-row.ts`.
Change: a "Connect a client" Settings section showing the panel address, `/.well-known/fluxiq` data and the gateway WebSocket URL with copy buttons, plus pending-pairing approval inline
(reusing `approve-pairing`, `dismiss-pairing`); remove the stale "lock and unlock" wording and the legacy `unlocked` mapping; workspace name shown only when multi-tenancy is on.
Acceptance: `features/settings-page/ui/tests`, `features/settings-page/model/tests`, `features/security/keys/tests`, `features/security/access/tests`. A person sees their panel URL and gateway address in Settings and can approve or forget a client in one place.

A, B, C, D touch disjoint files and can run in parallel. Checks stay narrow per `AGENTS.md`: `pnpm --filter @fluxiq/web check` plus the test directories above.

## Not verified
Nothing was run or measured; request counts and polling cadence are from code. Not read: `ui-components` chat internals (thread list, new chat), Runs and Data behaviour with no project,
whether the project choice persists across reloads, the graph route's entry link, `GlobalClientGatewayPairing.tsx`.
