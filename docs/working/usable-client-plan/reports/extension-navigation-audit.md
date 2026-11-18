# Extension side panel: navigation and speed audit (task t914, read-only)

Paths: EXT = `fxwork/t914/!FluxIQWebExtension/apps/extension/src`, CORE = `fxwork/t914/!FluxIQ/packages`. Committed state; none of the WIP-modified files
(content, page-world, trace-capture, authentication-*) are in a panel journey. `connection/core-api.ts` (modified) was read only for the `first-project` and snapshot calls.

## Outcome in one paragraph

The shell is better than "unusable" suggests: chat-first tabs, a Chats drawer, an Automations tab, a settings screen and a gated getting-started screen all exist.
The real gaps are structural. (1) The extension has no concept of "projects": it follows the single project Core names in its snapshot, and Core does not let a
paired token call `projects` or `create-project`. So list, switch and create project are Missing end to end, and the Chats drawer can only ever show one project's chats.
(2) Navigation is a flat two-tab bar with no header context (no project name, no current chat, no "New chat" outside the drawer). (3) Polling is a 4 s beat
(conversation + thread list + answers) because the extension supplies no change feed, plus a Core snapshot lookup behind relay calls: the likely cause of "slow".

## 1. Journeys

| Journey | Status | Cause / evidence |
|---|---|---|
| Open panel, connected | Works | `panel/shell/mount-panel.ts:72-324` builds top bar + chat; default screen is chat (`shell/screen-state.ts` `INITIAL_SHELL`, `shellScreen`). Slow, see section 3. |
| Open panel, disconnected | Works | `shellScreen` returns `getting-started` when `guide.gated`; steps in `getting-started/start/steps.ts`; the gear still wins so the address can be fixed (`screen-state.ts` header comment). A missing key only shows a card above the chat (`steps.ts:16-19`). |
| See list of projects | Missing | No panel message, relay or UI: `RUNTIME_MESSAGES` (`shared/constants.ts:37-77`) has none; grep for projects finds only `background/connection/*` internals. Core: endpoint `projects` exists (`CORE/fluxiq/src/programs/automation-studio/api/handlers/projects.ts:72-95`, `programs.read`, `read`) but is NOT in `PAIRED_CLIENT_ENDPOINTS` (`CORE/fluxiq/src/server/program-route/program-route.ts:90-166`), so a paired token is refused. |
| Switch project | Missing | The session project is "what Core last said" and moves with the person's web-panel context (`program-route.ts` comment: the extension "follows the project the person has open"). `background/connection/project-context.ts:1-9,57-60` only resolves and adopts Core's answer; `panel/settings/project-line.ts:12-14` tells the person "Change it in FluxIQ". No Core call sets a paired session's project. |
| Create project | Missing | `create-project` is registered (`handlers/projects.ts:96-110`, `authoring`) but not allowlisted for tokens; no panel UI. |
| See chats of a project | Works (current project only) | Drawer: `panel/chat/chat-panel.ts:88-97` (`layout: "drawer"`); catalog reads list-all, limit 25, scoped by `projectId: () => latestStatus?.projectId` (`CORE/ui-components/src/chat/chat-widget.ts:145`, `conversation/thread-list/catalog.ts:22,54-70`); relay `background/panel/conversation-relay.ts:72-75` calls `list-conversations`. A null-project (all projects) list works in the relay but nothing asks for it. |
| Open older chat and continue | Works | Row press opens `{kind:"thread"}` (`chat/threads/chat-threads.ts` list `open`); sends carry the thread's own project (`conversation/thread-requests.ts:63-66`); last thread remembered per window (`panel/chat/thread-memory/restoring-thread-list.ts:20-45`). Lists only the current project; "Show older chats" pages by 25. |
| Start new chat | Works, but buried | Only inside the drawer (`chat-threads.ts` list `create`; relay `fresh: true`, `conversation-relay.ts` `freshOpening`). No header "New chat" button; the drawer is closed by default (`chat-threads.ts` `open = layout === "column"`). |
| See automations, open one (chat + data) | Partly works | Tab `panel/automations/automations-tab.ts` (Tasks / Library segments, search, rows). Choosing a row opens its chat (`mount-panel.ts:98-110,229-232`) with a strip above (`automations/automation-strip.ts:1-8`): last run summary, Run, Stop, export of last run datasets, humanness, Open in FluxIQ. Data is export-to-file only; no in-panel rows view. |
| Run an automation | Works | Strip Run -> `controller.run` (`automations/controller.ts:324-340`) -> `panelRunAutomation`; the shell jumps to Chat on a new run (`shell/run-follow.ts`, `mount-panel.ts:158-181`). |
| Settings: server address | Works | Address form in the Connection group (`settings/address-form.ts`, `settings-view.ts:95-103`). |
| Settings: connection / sign-in | Works | State line, approval, project line, Disconnect (`settings-view.ts:64-103`); steps 1-4 on getting-started. |
| Settings: model key status | Works (read-only) | `keyLine` + Open FluxIQ to the keys page (`settings-view.ts:104-108`, `open-fluxiq/open-fluxiq-button.ts:56-60`, `background/panel/open-fluxiq.ts:23-31`). A key cannot be added in the extension. |
| Settings: humanness default | Works | `settings/humanness/*`, mounted `settings-view.ts:109-113`, saved via `withHumanness` (`settings-view.ts:168`). |
| Settings: theme | Works | `createAppearanceSection()` (`settings-view.ts:118`), `mountThemeChoice()` (`mount-panel.ts:74`). |
| Open Core web panel at right page | Partly works | Top-bar icon opens the base address (`mount-panel.ts:194`); strip opens `/programs/automation-studio?project=&flow=` (`open-fluxiq.ts:9-20`); keys page `/programs/secret-keys` (`open-fluxiq.ts:23-31`). Missing: project page, a conversation, a run or data page, the project list. |

Why it reads as "can't navigate": there is no project concept, no persistent header showing project and chat, the conversation list is a collapsed drawer inside the chat card
(`CORE/ui-components/src/chat/view/thread-header.ts`: one "Chats" button carrying the chat title), and the settings gear is an icon with no label. Navigation between a project's
chats exists but is undiscoverable; between projects it does not exist.

## 2. Core endpoints and gateway messages per journey

| Journey | Exists | Missing |
|---|---|---|
| Connection / pairing | `/api/client-gateway/snapshot`, `first-project`, pairing flow (`EXT/background/connection/core-api.ts:44-84`) | n/a |
| List projects | `projects` endpoint (read, domain-scoped, with owners) | Token allowlist entry (`program-route.ts:90`); an extension relay + `RUNTIME_MESSAGES.panelListProjects`; a name/id/updatedAt projection (the handler returns owner info the extension does not need) |
| Switch project | Snapshot session `projectId` follows Core context | Either a narrowed "set my session's project" client-gateway call, or (recommended) client-side selection kept in extension session and passed as `projectId` on relays, which already accept a named project (`conversation-relay.ts:76-84,229-231`) |
| Create project | `create-project` (authoring) | Allowlist entry narrowed to `{name}` (as `update-flow-settings` is narrowed); relay + UI |
| Chats of a project / any project | `list-conversations` (project or null), `get-conversation`, `open-conversation`, `append-turn`, `rename-conversation`, `delete-conversation` (all allowlisted, `program-route.ts:91-108`) | A cheap summary read (list returns full records; no field projection) and a change feed (see section 3) |
| Automations | `list-flow-summaries`, `list-flow-runs`, `get-flow-run-detail`, `export-run-dataset`, `run-runtime-session`, `list-project-tasks`, `list-project-parts` (allowlisted) | A dataset rows read for in-panel data; export is file download only |
| Settings | local settings, `get/update-flow-settings`, `update-task-settings`, secret-keys `snapshot` (read) | Nothing blocking |
| Web panel deep links | `/programs/automation-studio?project&flow`, `/programs/secret-keys` | A documented URL scheme for project and conversation pages (web app routes not read here) |

## 3. Panel speed

Open path (side panel, connected); each item is a runtime message to the MV3 worker unless noted:
1. The store asks `getStatus` (`panel/state/store.ts` end of `createPanelStore`) and the shell asks again (`mount-panel.ts:309`).
2. The shell's activity feed `start()` + `read()` (`mount-panel.ts:127-151`); the chat widget starts its own second feed (`CORE/ui-components/src/chat/chat-widget.ts:362-366`): the same activity is read and subscribed twice.
3. Chat `startReads` (`chat-widget.ts:362-368`): `controller.refresh()` (list the project thread, limit 1, then `get-conversation` tail of 20 turns only if the revision changed: `conversation/controller.ts:295-335`, `thread-tail.ts:24`), `reader.read()` (task attempts), `threads.read()` (list-all, 25).
4. Key reader read (`getting-started/model/key/reader.ts`), re-read every 4 s while the key is missing (`KEY_BEAT_MS`) and on each window focus or visibility change (`mount-panel.ts:191-192`). Settings builds a second `extensionSetupPort` (`mount-panel.ts:193`).
5. Every relay with no explicit project awaits `context.projectId()` -> `ProjectContext.resolve` -> `GET /api/client-gateway/snapshot` (`background/panel/conversation-relay.ts:229-231`, `connection/project-context.ts:92-142`). The snapshot body lists every paired client's session (`core-api.ts:74-77`), so a heavy payload is fetched at least once per second of activity (reuse window `CORE_PROJECT_CONTEXT_REUSE_MS = 1000`).

Steady state while Chat is visible: a 4 s interval (`CORE/ui-components/src/chat/read-beat.ts:11`, used at `chat-widget.ts:373-390`) runs `threads.read` + `controller.refresh` + `reader.read`
(3+ Core calls, each through the worker, each possibly behind the snapshot lookup) indefinitely, because the extension transport supplies no `changes` port
(`panel/chat/transport/create-extension-chat-transport.ts:14-27`); the 10 s ceiling applies only when `changes` exists (`read-beat.ts:15-18`). Readiness is re-read every 15 s (`chat-widget.ts:114,388`).
Automations tab: `list-flow-summaries` + `list-flow-runs` on open and every 30 s (`automations-tab.ts:27,218-221`); tasks and library read when shown or searched. Switching tab is cheap
(`setActive` toggles, `mount-panel.ts:282-285`), but each activation re-reads at once (`automations-tab.ts:241-251`).
Re-render: every status push runs topBar, openIcon, recording, review, chat, automations, library render and `draw()` (`mount-panel.ts:287-306`); pushes are frequent while connecting (3 s probe,
`state/status-probe-ms.ts`). Rows reconcile in place and the chat compares signatures, so this is wasted work rather than rebuilds; secondary.
Payload size: the thread list is capped at 25 records and conversation reads are windowed to 20 turns, so whole-history payloads are NOT the main cost.
Likely slow paths, in order: (a) the snapshot lookup in front of relay calls, (b) the 4 s triple poll with no push feed, (c) MV3 worker cold start on the first message after idle,
(d) duplicate activity feeds and key readers, (e) the whole `@fluxiq/ui-components` chat bundle and CSS loaded on open (size not measured).
No timings were taken; these are code-reading conclusions.

## 4. Unit tests

Not run. `pnpm --filter @fluxiq-web-extension/extension test` (`apps/extension/package.json:9`) first runs `core-build.mjs`, then `scripts/test-extension.mjs`, which esbuilds every
`src/**/tests/*.test.ts` into `.test-build-scratch/` and runs node:test. There is no vitest and no way to run `src/panel` alone without that build. 101 test files exist under `src/panel`. Baseline results unknown.

## 5. Proposed navigation

Principle: always show where you are (project and chat), reach everything within two taps, keep the panel thin, link to the Core web panel for anything rich.

Header (always visible, one row, wraps to two at 360 px):
- Left: project switcher button with the project name and a chevron; opens a sheet with the project list, search, "New project" and "All projects in FluxIQ".
- Centre: tabs `Chat | Automations` (keep the existing tablist ids `panelTab-*` and `settingsButton`).
- Right: connection dot, labelled gear (Settings), Open FluxIQ icon (opens the current project's page).

Chat screen: a slim chat bar under the header with the current chat title, "Chats" (list with waiting badge) and "+ New chat". The drawer stays but is reachable from the title.
Automations screen: the list; choosing one opens its chat in the Chat tab with the strip (existing); the strip gains "Data" (last run rows via a Core dataset read) and "Open in FluxIQ" to the run or data page.
Settings (gear): Connection (address, sign-in), Project row with Change (opens the same project sheet), Model key status, Humanness default, Theme, Help. Structure unchanged otherwise.
Getting-started replaces the Chat screen only while not connected or approved (existing `shellScreen`); the gear still wins.
Project switching lives only in the header sheet; chat switching only in the chat bar's list.

## Implementation plan: four briefs, disjoint files

Interface fixed first (stable for all briefs): `PanelProjectSummary = { id, name, updatedAt? }`; messages `fluxiq.panel.listProjects` -> `{ projects }`,
`fluxiq.panel.createProject {name}` -> `{ project }`, `fluxiq.panel.selectProject {projectId}` -> status carrying `projectId` and `projectName`. Selection is client-side, stored in the extension session, passed as `projectId` on relays. Alert the user before the first Core edit (cross-repo).

**Brief A, Core API (Core repo).** Owns `CORE/fluxiq/src/server/program-route/program-route.ts` (allowlist), `CORE/fluxiq/src/programs/automation-studio/api/handlers/projects.ts` (token projection and
`create-project` narrowed to a name), their tests, and a dataset-rows read handler if absent. Must not touch the extension or ui-components.
Acceptance: Core tests beside the changed files (allowlist tests: `projects` and `create-project` allowed; `update-project`, `delete-project` still refused; create ignores category, PIN and auth fields); typecheck of `packages/fluxiq`; Core structure audit.

**Brief B, extension background and protocol.** Owns `EXT/shared/constants.ts`, `EXT/shared/protocol.ts`, `EXT/background/panel/**` (new `project-relay.ts`; `conversation-relay.ts` honours the selected project),
`EXT/background/connection/project-context.ts` (selected project wins over Core's), `EXT/background/connection/runtime-status.ts` (status carries the choice). Also removes slow path (a): no snapshot lookup when a project is selected or cached.
Must not touch `panel/**` or Core. Depends on A for live behaviour; unit-testable against fake `context.call`.
Acceptance: tests in `background/panel/tests` and `background/connection/tests`; extension typecheck.

**Brief C, Core ui-components.** Owns `CORE/ui-components/src/chat/**` and a new `src/project-switcher/**` (sheet component over a `ProjectsPort`, no extension imports): chat bar (title, Chats, New chat) in
`chat/threads` and `chat/view/thread-header.ts`, a `changes` feed hook, one shared activity feed instead of two, beat tuning. Must not touch the extension or Core API.
Acceptance: ui-components tests in changed directories; package typecheck and build (the extension consumes `dist/`); structure audit.

**Brief D, extension panel shell.** Owns `EXT/panel/shell/**`, `EXT/panel/settings/**` (project row), `EXT/panel/chat/**`, `EXT/panel/automations/**` (strip Data link), new `EXT/panel/projects/**`
(port over B's messages, mounts C's sheet), `EXT/panel/open-fluxiq/**` and `EXT/background/panel/open-fluxiq.ts` (deep links; the only background file D owns, so B must not edit it).
Delivers the header, project sheet, chat bar wiring, a `changes` port from worker pushes (4 s poll becomes the 10 s ceiling), removal of the duplicate feed and second setup port, trimmed status fan-out.
Depends on B and C interfaces. Acceptance: tests beside changed panel files; extension typecheck and build; manual run in Chrome side panel and Firefox popup (connect, switch project, new chat, open older chat, open and run an automation, settings, open web panel), stating what was and was not exercised; a before/after count of Core calls per minute and time to first chat paint.

Order: A, B and C start in parallel (B against fakes); D after B and C interfaces land.

## Not verified
No unit tests run; no live browser; no timings; Core web-app route names for project or conversation deep links; whether `projects` output leaks owner ids to a token caller (read from the handler only).

Outcome: Done
Changed: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/extension-navigation-audit.md
Validation: unit tests not run (suite needs core-build and an esbuild bundle); evidence from reading only
Not verified: live behaviour, timings, web-panel deep-link routes
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/extension-navigation-audit.md
Notes: Project list, switch and create are missing because Core's paired-token allowlist excludes `projects` and `create-project` and the extension has no project selection.
