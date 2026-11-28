# t1095 panel audit (read-only)

Paths are relative to Core `C:/Users/osrs_/FluxStuff/fxwork/t1095/!FluxIQ` unless marked EXT (the extension tree beside it). `W` = `apps/web/src`, `F` = `packages/fluxiq/src`. Nothing was run live; every claim is from reading source.

## 1. Surfaces

| Surface (route / file) | What the person sees | What it does |
| --- | --- | --- |
| Top bar project picker: `W/features/panel-shell/top-bar/ProjectSwitcher.tsx:17-64` | Shared `createProjectSwitcher` (same widget the extension uses) | Picks the panel's open project (`dispatch project`, :42), "all projects" goes to `/projects` (:43-46), creates a project by name (:33, no PIN) |
| `/projects`: `W/app/(panel)/projects/page.tsx`, `W/features/projects/ProjectsPage.tsx:19-55` | Project catalog | Create, rename, move, open (open sets the panel project and routes to `/flows`, :38-41). Delete is not offered (:15) |
| Dock "Assistant" (opener labelled "Ask"): `W/features/panel-shell/dock/AssistantDock.tsx:35-52` | Right column or phone sheet | `ProgramChatWidget` with `panel` always set (:42): the panel-wide assistant thread plus the open project's threads |
| `/chats`: `W/features/chats/ChatsPage.tsx:15-83`, `load-chats.ts:14-24` | "Chats": scope current/all projects, search, rows | Project conversations (`list-conversations`) plus, in all-projects scope only, `list-panel-threads` (load-chats.ts:15-18) |
| `/chats/[conversationId]?project=`: `W/app/(panel)/chats/[conversationId]/page.tsx:9-14`, `ChatThreadPage.tsx:95-124` | One chat, full page | Needs `?project=`, else "This chat address has no project" (:120). Mounts `ProgramChatWidget` WITHOUT `panel` (:117), so it is the project's own chat |
| `/settings`: `W/features/settings-page/ui/SettingsPage.tsx:17-47` | AI keys, assistant model, allowance, "Connect a browser or app" pointer, Starting humanness, Appearance, Advanced tools | Keys `AiKeysSection` (:29); model/allowance (:35-36); humanness `humanness/StartingHumannessSection.tsx:14-25` |
| `/security/keys`: `W/app/(panel)/security/keys/page.tsx:4-6` | Redirect | To `/settings#ai-keys` |
| `/security/devices`: `W/app/(panel)/security/devices/page.tsx`, `W/features/settings-page/connect/ConnectClientSection.tsx:16-55` | "Devices and apps": waiting approvals, connected clients, how to connect, addresses | Approve or forget paired clients; copy panel and gateway addresses |
| Global pairing modal: `W/app/GlobalClientGatewayPairing.tsx:1-241` (mounted `W/app/layout.tsx:39`) | "<client> wants to connect" dialog on any page | Approve or dismiss a pairing request (routes `api/client-gateway/approve-pairing`, `dismiss-pairing`) |
| `/connect`, `/connect/authorize`, `/connect/done`: `W/app/connect/page.tsx:7-13`, `authorize/page.tsx:10-21` | Browser-side consent pages | "Open the extension and choose this server" (page.tsx:9); sign-in consent for token handoff |
| Home: `W/features/home/sections/HomeConnected.tsx:31-40`, `HomeAiKey.tsx` | "Browsers and apps", AI key card | Read-only status; link to `/security/devices` (:38) |
| Nav: `W/features/panel-shell/nav/items/panel-nav-items.ts:6-15` | Home, Projects, Flows, Runs, Data, Chats, Security, Settings | Hints: Chats "Every conversation with FluxIQ" (:12), Security "Keys, access and activity" (:13), Settings "AI keys, budgets and setup" (:14) |
| Chat key card: `W/features/chat-widget/ProgramChatWidget.tsx:57,85` | Key card in the chat empty state | Buttons route to Settings (`AI_KEYS_HREF`, `ASSISTANT_MODEL_HREF`) |
| Shared widgets: `packages/ui-components/src/{project-switcher,model-access,screens/tasks,screens/library,chat}` | Same widgets the extension mounts | `project-switcher/projects-port.ts:12` (list + create only); `model-access/key/{card,form,remove}.ts`; `chat/controls/humanness/humanness-control.ts:113` |

## 2. Conversation storage and keys

Two stores, two key shapes.

- Project conversation: SQL store inside the project's own database, keyed (projectId, conversationId); `F/runtime/conversations/store.ts:1-3,66-70`. Endpoints `open-conversation` (`F/programs/automation-studio/api/handlers/conversations.ts:63-84`, requires `projectId`, asserted at :74-75), `list-conversations` (:16-46; per project, or across projects `F/framework/automation-service/service/conversation-requests/list.ts:22-46`), `get-conversation`, `append-turn`.
- Panel assistant thread: per-USER database at `<projects root>/../panel-assistant`, no project (`F/programs/automation-studio/api/panel-assistant/register.ts:72-77`); every endpoint is `selfUser` (:83). Its project id reads back as the reserved `"panel"` (:52).

Extension (client over the gateway), write path: `EXT/apps/extension/src/background/panel/conversation-relay.ts:128-145` calls `open-conversation` then `append-turn` with `projectFor(...)` (:151, :253), so project conversations only; no project fails `no_project` (:129).
Panel read path of the same data: `/chats` `W/features/chats/load-chats.ts:15-16` (`list-conversations`), the thread page `ChatThreadPage.tsx:117`, and the dock when that project is open (`W/features/chat-widget/transport/composed-conversation-port.ts:50-60`, project threads merged in with a "<project> · " title prefix, :60, :91-94).

Answer: with a project, an extension conversation IS the same conversation the panel shows (same store, same ids), in Chats and in the dock list for that project. Panel-only assistant threads (started in the dock with no project, or "New chat": `composed-conversation-port.ts:69` always calls `panel.newThread`) are NOT reachable by the extension: Core refuses paired clients on every panel-thread endpoint (`register.ts:88`, "The assistant is used from the FluxIQ panel.").

Related defect (see 5, #1): the extension's all-chats list calls `list-panel-threads` (`conversation-relay.ts:108-112`) and returns that failure as the whole answer (:110 `return assistantChats` when not ok), but the endpoint refuses paired clients, so the extension's all-projects chat list probably errors. Not run live; confirm.

## 3. How projects are created

- Panel, explicit only: top bar create (`ProjectSwitcher.tsx:33`) and `/projects` (`ProjectsPage.tsx:19`), via `createAutomationProject`.
- Sending a panel chat with no project does NOT create or pick one. With none open the dock uses the person's own panel thread (`composed-conversation-port.ts:5-6,48`; `AssistantDock.tsx:42`), so the assistant works without a project. A project chat with no project is refused with "FluxIQ has not said which project this chat belongs to yet. Choose a project" (`W/features/chat-widget/transport/project-for.ts:8-14`, code `no_project`).
- Client-callable endpoint: `POST /api/client-gateway/first-project` (`W/app/api/client-gateway/first-project/route.ts:12-23`, rationale :8-11). It calls `automationStudioPersonProject({create:true})` (`F/programs/automation-studio/api/person-project.ts:43-57`): returns the person's latest OWN project (`latestOwn` :26-31) else makes one named "My automations" (:12, `makeFirst` :33-36), de-duplicated per user+domain (:23-24, :47-51). The extension calls it (`EXT/apps/extension/src/background/connection/core-api.ts:14-25`).
- Snapshot read (creates nothing): `W/app/api/client-gateway/snapshot/project.ts:12-16` uses the client's bound project, else the stored `activeProjectId`, else the latest own.
- No dedicated client endpoint creates a NAMED project, renames or deletes one. Only the panel's own `createAutomationProject` path does (ProjectSwitcher.tsx:33).

## 4. Duplication, and what the panel lacks

Already in the panel and duplicated in the extension (EXT `apps/extension/src/panel/`: `projects/project-selector.ts`, `settings/model-section.ts`, `settings/settings-view.ts`, `settings/humanness/{index,slider}.ts`, `automations/humanness/flow-humanness-section.ts`, `tasks/create-tasks-panel.ts`, `library/create-extension-library.ts`):
- Project create/pick: panel has both (ProjectSwitcher.tsx:33; ProjectsPage); the extension has its own selector.
- Model keys, replace/remove, assistant model, allowance: panel `AiKeysSection`, `AssistantModelSection`, `AllowanceSection` (SettingsPage.tsx:29-36); the extension has `model-section.ts`.
- Starting humanness: panel `StartingHumannessSection` (SettingsPage.tsx:43); extension has `slider.ts`.
- Pairing approval: panel only (global modal and `/security/devices`); the extension only requests.

Missing before the extension can drop its controls:
1. A way for clients to learn which project the panel has open. The panel keeps its choice in this browser's localStorage (`W/features/panel-shell/context/project-storage.ts:5,17,27`); no panel code posts to `/api/client-gateway/automation-studio-context` (grep found callers only in the route and `W/lib/workspaces/presentation`). The snapshot only reads the stored `activeProjectId` (snapshot/project.ts:12).
2. Delete project in the panel (`ProjectsPage.tsx:15`: "not offered here").
3. A reliable "Flow being worked on" for clients: snapshot carries `activeFlowId` (snapshot/project.ts:18), but only from the stored preference that the panel never writes (see 1).
4. Panel threads for clients: either make the assistant thread a project conversation or let clients read it (`register.ts:88` refuses them).
5. Per-task and per-Flow humanness and task settings editing: not located in the panel in this audit (only the starting humanness, SettingsPage.tsx:43, was found); the shared chat humanness control is mounted by both.

## 5. Confusions and defects

| # | Where (file:line) | Problem | Proposed fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | `F/programs/automation-studio/api/panel-assistant/register.ts:88`; EXT `background/panel/conversation-relay.ts:108-119` | Extension all-chats list calls `list-panel-threads`, which refuses paired clients; the failure becomes the whole list (:110). The panel list (load-chats.ts:15-18) shows those threads, the extension cannot | One conversation model (see #2); stop-gap only: relay skips that refusal | Core `register.ts` and EXT relay |
| 2 | `composed-conversation-port.ts:5-6,48,69`; `AssistantDock.tsx:42` | Two kinds of chat: "Assistant" panel threads (per user, no project) and project chats. "New chat" in the dock always makes a panel thread even with a project open (:69). The list mixes both with a "<project> · " title prefix (:60, :91-94) | A chat always belongs to a project (default one via `first-project`); retire the panel-thread store and the prefix | Core `F/runtime/conversations/assistant`, `W/features/chat-widget/transport` |
| 3 | `ChatsPage.tsx:61` vs `load-chats.ts:15-18`; `chat-rows.ts:65,71` | Empty text says "Open the assistant and ask for something", but the default scope (current project) hides panel threads; they are labelled "Assistant" next to project rows | Resolved by #2; until then show them in both scopes | Core `W/features/chats` |
| 4 | `chat-rows.ts:99`, `chat-href.ts`, `ChatThreadPage.tsx:115-121` | A panel thread's row builds its href from project id `"panel"` (parse-panel-threads.ts:47); the page then mounts the project widget (no `panel` prop, :117) on that fake project. Not verified live | Open panel threads in the dock, or remove them via #2 | Core `W/features/chats` |
| 5 | `AssistantDock.tsx:36,52`; panel-nav-items.ts:12 | One thing called "Assistant", "Ask", "Chats", "conversation" | One word, one place; the extension shows the same name | Core + EXT copy |
| 6 | `project-storage.ts:5-33`; no caller of `automation-studio-context` | The panel's open project is per-browser localStorage; the extension has its own binding; the person sees a different "current project" in each | Panel posts its selection to the existing route (`automation-studio-context/route.ts:12`); extension reads it from the snapshot | Core `panel-shell/context` |
| 7 | `SettingsPage.tsx:39-42`; `panel-nav-items.ts:13-14` | "Connect a browser or app" is a pointer to Security (plain `<a href>` full reload, :41); Security's hint still says "Keys" (:13) though keys moved to Settings; pairing appears in four places (global modal, Security, Settings pointer, Home) | One Connections place; `next/link`; fix hint | Core `settings-page`, `panel-shell/nav` |
| 8 | `ProjectsPage.tsx:15-16` | `PANEL_PERSON` is a fake user (`id:"panel"`, `pinConfigured:false`), so delete is hidden | Real current user and a delete with the panel's own confirm | Core `W/features/projects` |
| 9 | `project-for.ts:8-14` | A chat with no project tells the person to choose one although `first-project` exists | Panel calls the same first-project path when none exists | Core `chat-widget/transport` |
| 10 | `snapshot/project.ts:12,35` | A paired client bound to one project (binding.projectId) is refused another (`projectUnavailable`); extension chats for a different project then fail with an unexplained error | State the binding rule in the client contract; show it in Devices | Core docs and `settings-page/connect` |
