# Core panel: Projects, Chats, Flows picker (t915)

## Outcome
Partial. All code and tests are written. Neither required check finished: vitest refuses to start (stale Core library build, not my files) and `pnpm --filter @fluxiq/web check` (tsc --noEmit) did not finish on a machine with about 350 MB free of 12 GB.

## What a person can now do
- Open Projects in the rail, see every project, create one, rename one, and open one. Opening makes it the panel's current project and goes to Flows.
- Open Chats in the rail: every chat (open and resolved) of the current project or of all projects, searchable, "Show older chats" asks for 25 more. Each chat opens as a full page with its thread shown.
- On Flows with no project chosen: pick a project or create one right there (or jump to All projects) instead of being sent to the top bar.
- Each new page shows a loading line and, on failure, the reason with a "Try again" button.

## URLs (extension deep links)
- Projects: `/projects` (no per-project page; opening sets panel context, then `/flows`)
- Chats list: `/chats`; one chat: `/chats/<conversationId>?project=<projectId>` (project is required to find the thread)
- Flow: `/flows/<flowId>?project=<projectId>`; graph: `/flows/<flowId>/graph?project=<projectId>`
- Run: `/runs/<runId>`
- Data: `/data` (no per-dataset page; exports are API downloads, each dataset links to its run)

## What changed (W = apps/web/src)
- `features/panel-shell/context/types.ts` (NOT in my owned list, one line): `PANEL_PAGES` gained `projects` and `chats`; nav items must equal it and the preset type needs it.
- `features/panel-shell/nav/items/panel-nav-items.ts`: Projects and Chats added. Rail order: Home, Projects, Flows, Runs, Data, Chats, Security, Settings. `isHiddenPanelPath` reads the list, so no change there.
- `app/product/preset/panel-presets.ts`: all three presets list both new pages.
- `app/(panel)/projects/page.tsx`, `app/(panel)/chats/page.tsx`, `app/(panel)/chats/[conversationId]/page.tsx` (new, each guarded by `requirePanelScreen`).
- `features/automation-studio/project/`: `ProjectsPage.tsx` (mounts the existing `AutomationProjectCatalogSurface`), `use-project-list.ts`, `projects-page.css`, barrel exports.
- `features/flows/list/FlowsProjectPicker.tsx` + `FlowsListPage.tsx` + css.
- New `features/chats/`: `ChatsPage`, `ChatThreadPage`, `chat-rows`, `chat-href`, `load-chats`, css, barrel.
- `notifyProjectsChanged()` (lead's instruction) is imported from panel-shell/top-bar and called after the Flows inline create and, in ProjectsPage, whenever the catalog's project list changes after its first load (create, rename, delete, reload). No top-bar file edited.
- Tests updated: nav items, presets, is-hidden-panel-path, `(panel)/tests/preset-routes`. New: `chats/tests/chat-rows`, `chats/tests/ChatsPage`, `flows/list/tests/FlowsProjectPicker`.

## Commands run and observed
- `pnpm --filter @fluxiq/web exec vitest run <my test dirs>` -> refused at startup: "Core's library build is 2 minute(s) behind its source. Stale: packages/ui-components/src/chat/chat-widget.ts". Another worker is editing ui-components; the shared Core must not be rebuilt by me. No test ran.
- `pnpm --filter @fluxiq/web check` -> first run (before the notify edits) produced no error lines before I lost the exit status; second run still going after about 25 minutes, output empty (machine out of memory, three tsc runs competing).

## Not verified
Typecheck; every test (new and edited). Nothing rendered in a browser; the existing project browser and modal have no stylesheet of their own in this repo (no `automation-project-browser` css), so they may look unstyled. Whether `ProgramChatWidget` with `requestedConversationId` opens a thread from a different project than the panel's (the widget reads it from the `projectId` prop, which I pass).

## Open questions / contradictions
- Dock cannot open a given thread (no prop; only `?chat=open`), so chats open as a full page, not in the dock.
- Project switcher (top-bar) is not mine, so it has no "Manage projects" link; the rail link covers reachability. A one-line link there is a follow-up for its owner.
- Delete is not offered usefully: the modal demands a PIN and the panel has none (MVP), so delete stays blocked.
- `list-conversations` has no cursor, so "older chats" re-reads with a larger limit.
- Projects list is fetched by my own small hook (`useProjectList`), not the new shared source in top-bar, per the brief's "panel context only"; it adds one extra `projects` request on Flows/Chats/Projects pages. Swap to the shared source if wanted.
- Edits could not be tested against `PANEL_PAGES` users elsewhere (e.g. Home, Security) beyond the type being widened.

```text
Outcome: Partial
Changed: apps/web/src/features/panel-shell/context/types.ts; features/panel-shell/nav/items/{panel-nav-items.ts,tests/panel-nav-items.test.ts}; app/product/preset/{panel-presets.ts,tests/panel-presets.test.ts,tests/is-hidden-panel-path.test.ts}; app/(panel)/{projects,chats,chats/[conversationId]}/page.tsx; app/(panel)/tests/preset-routes.test.tsx; features/automation-studio/project/{ProjectsPage.tsx,use-project-list.ts,projects-page.css,index.ts}; features/flows/{flows.css,list/*,list/tests/FlowsProjectPicker.test.tsx}; features/chats/** (all new)
Validation: `pnpm --filter @fluxiq/web exec vitest run ...` -> refused, stale ui-components dist (not my files); `pnpm --filter @fluxiq/web check` -> did not finish, machine out of memory
Not verified: typecheck, all tests, browser rendering and styling of the project catalog
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/core-panel-projects-chats.md
Notes: Needs the ui-components rebuild by its owner, then rerun vitest and check when memory is free.
Notes: PANEL_PAGES edit in panel-shell/context/types.ts is outside my owned paths but required.
```
