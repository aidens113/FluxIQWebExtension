# t1095 ext-audit: where a person meets projects, chats, keys and connection in the extension

Read only; no source edited. Paths: EXT = `apps/extension/src` of the t1095 extension tree; UIC = Core `packages/ui-components/src` of the t1095 Core tree.

## Outcome

Part 2's cause is found and is in Core (`UIC/chat/view/thread-header.ts:117-121`). The single path of part 4 mostly exists already: a first chat message with no project makes one (`EXT/background/connection/project-context.ts:265` calling Core's `first-project` route). What is missing: the extension still shows its own project-creation, key and settings controls, and its open thread is remembered per browser window, not shared with the panel.

## 1. Surfaces

"Move" = config or project management, which the rule puts in the panel. "Stay" = shows work.

| # | Files | What the person sees | What it does | Verdict |
|---|---|---|---|---|
| 1 | `EXT/popup/index.ts:7`, `EXT/sidepanel/index.ts:7`, `EXT/panel/shell/mount-panel.ts:207` | One shell in the Firefox popup and the Chrome/Edge side panel (`manifest.firefox.json:8`, `manifest.chrome.json:14`) | `mountPanel` builds header, screens, store | Stay |
| 2 | `EXT/panel/shell/top-bar.ts:77-84` | Logo, project switcher, tabs Chat / Automations, connection dot, "Settings" button, "↗" Open FluxIQ | Layout only | Stay; items below leave |
| 3 | `UIC/project-switcher/project-switcher.ts:60-90`, `EXT/panel/projects/project-selector.ts:28-68`, `extension-projects-port.ts:80-95` | Button "ProjectName v" or "Choose a project" (`project-switcher.ts:145`); sheet with search, rows, "+ New project" with a name field, "All projects in FluxIQ" | Row click sends `panelSelectProject` (`project-selector.ts:35`); Create sends `panelCreateProject` (`extension-projects-port.ts:87-93`, relay `EXT/background/projects/projects-relay.ts:68-77`) | Rows: Stay (shows projects). "+ New project": Move. "All projects in FluxIQ": becomes the panel link |
| 4 | `EXT/panel/chat/chat-panel.ts:63-118`, `UIC/chat/chat-widget.ts` | The chat; a "chat bar" with the name, "Chats", "+ New chat"; empty state "What can FluxIQ do for you?" with "Describe what you want" and "Extract data from this page" (`UIC/chat/view/empty-state-model.ts:52-55`) | Sends to background relays (`EXT/background/panel/conversation-relay.ts:92-117`) | Stay (the chat the rule keeps) |
| 5 | `UIC/chat/view/thread-header.ts:114-143`, `UIC/chat/threads/chat-threads.ts:154-160`, `UIC/chat/view/thread-list/*` | Conversation drawer: search, rows, New chat, Rename, Delete | Toggles a drawer over the thread | Stay (lists the same Core conversations, `conversation-relay.ts:80-97`); Rename and Delete are management |
| 6 | `UIC/chat/view/context-line.ts:20-45` | Slim line "Automation <name>" with "Latest chat" back button | Back to the latest chat | Stay, but duplicates the strip (D6) |
| 7 | `EXT/panel/automations/automation-strip.ts:30-60`, `mount-panel.ts:352` | Strip above the chat for the open Flow: name, Run, Stop run, exports, "Open in FluxIQ", "Open data in FluxIQ", per-Flow humanness (line 40) | Run/stop a Flow, open pages | Stay (shows the Flow worked on); humanness section: Move |
| 8 | `EXT/panel/automations/automations-tab.ts:65-135` | Tab "Automations": search, Tasks / Library segments, "Saved automations", "New automation" card, fallback "Your saved automations are in FluxIQ." | Lists and opens Flows | Stay; the "New automation" card is a duplicate entry (row 9) |
| 9 | `EXT/panel/recording/recording-controls.ts:80-91, 125` | Composer "Show me how" (line 82); card "New automation": "Tell FluxIQ what to do in the Chat tab, or show it how." and "Show FluxIQ how" (lines 83, 89-91); recording bar | Starts a recording | Stay as one entry (composer); card is a duplicate |
| 10 | `EXT/panel/tasks/create-tasks-panel.ts:24-48`, `UIC/screens/tasks`, `EXT/panel/library/create-extension-library.ts`, `UIC/screens/library` | Tasks and Library panes in Automations | Read lists; "Open in chat" | Stay |
| 11 | `EXT/panel/settings/settings-view.ts:103-130` | Settings (gear): Connection (state, approval, Project + "Change", reconnect, Disconnect/Connect), AI key card, Behaviour (Humanness slider, on-page status), Permissions, Appearance, Help, Advanced (two addresses, Forget this pairing), Save bar | `panelSaveSettings`, connect, disconnect, forget (`settings-view.ts:187, 214, 229`) | Move all but connection state and Appearance (section 5) |
| 12 | `EXT/panel/settings/model-section.ts:35-95`; chat key card (`UIC/chat/onboarding/composer-key-bar.ts`, `EXT/panel/chat/transport/ports/model-keys/model-keys-port.ts:16`) | An "AI key" card that can paste and save a key; "Open FluxIQ" fallback | `panelModelKeySave` to Core (`send-key-write.ts:15`) | Move (keys live in the panel); a read-only state line may stay |
| 13 | `EXT/panel/getting-started/start/{steps.ts,view.ts,step-words.ts}`, `shell/screen-state.ts:43-49` | Full-panel steps "Start FluxIQ", "Connect and approve", "Add your AI key" until connected | Replaces the chat while unconnected (`mount-panel.ts:416-418`) | Stay for connection (pairing is browser-side); the key step (`steps.ts:113-114`) is Move |
| 14 | `EXT/panel/open-fluxiq/open-fluxiq-button.ts:42-92`, `EXT/background/panel/panel-control.ts:98-124`, `background/panel/open-fluxiq.ts:21-24` | "↗" in the top bar and "Open FluxIQ" buttons in several places; purposes model-key, projects, pairing; with `flowId` opens that Flow | Opens a Core tab | Stay: this is the link to the panel |
| 15 | `EXT/background/projects/projects-relay.ts`, `background/connection/project-context.ts`, `background/panel/conversation-relay.ts` | none (routing) | Keeps the project choice per server address; resolves a project for each send | Stay (section 4) |

## 2. The project-name click defect

The header switcher is not the cause: its button only toggles its own project sheet (`project-switcher.ts:279`).

The cause is the chat bar's name button, in Core:
- `UIC/chat/view/thread-header.ts:117-121` creates `nameButton` (class `chat-bar-title`, `title: "Choose a chat"`) and `nameButton.addEventListener("click", toggle)`. `toggle` is `() => setOpen(!open)` (`UIC/chat/threads/chat-threads.ts:120`), which shows or hides the conversation drawer (`chat-threads.ts:154-160`; `thread-list.css:43-45` hides the thread and composer while it is open).
- The text on that button is `conversationDisplayTitle` (`UIC/chat/conversation/thread-list/title.ts:12`): the project name for the latest chat, and again the project name for a project thread (`title.ts:17`). The extension passes `threads` with no `onTitle` (`EXT/panel/chat/chat-panel.ts:93-101`), so the bar draws that name itself (`chat-threads.ts:184-190`, `thread-header.ts:130`).
- Result: the project name appears twice, in the header switcher (opens projects) and in the chat bar (opens or closes conversations). The bar name reads as the project, and clicking it expands or collapses the conversations. This is the user's report.
- It is deliberate in code: comment `thread-header.ts:116` "The name opens the list too, for a pointer".

Fix, owned by Core (ui-components); the extension has no code to change beyond picking up the new package:
1. In `createBar` (`thread-header.ts:114`) make the name a plain `span`: no `nameButton`, no click, no `aria-expanded`/`aria-controls` (remove the line-136 `setAttribute`). The "Chats" button (lines 85-95) stays the only way to open the list. Update the header comment (lines 13-16).
2. `UIC/chat/view/thread-list/thread-list.css:26-31`: drop button hover styling on `.chat-bar-title`.
3. Preferably stop repeating the project name in the bar when the host has a project switcher: have `title.ts:12/17` return the conversation's own label. `context-line.ts:30-32` already assumes the project is named by the host's switcher.
4. Update the Core tests that press the name button (`UIC/chat/view/tests`, `UIC/chat/threads/tests`), then rebuild the extension.

## 3. Other confusions and defects

D1. A "create a project first" step is offered but not needed. With no project the switcher says "Choose a project" (`project-switcher.ts:145`) and "No projects yet." (`:167`) and offers "+ New project" (`:73`, `:209-238`); Settings says "No project is chosen yet. Choose one with Change." (`EXT/panel/settings/project-line.ts:10`). A first message already makes one (section 4). Fix: with no project the header says "FluxIQ picks your project when you send a message"; remove "+ New project".

D2. Key instructions contradict each other. Getting-started says "add your AI key in the chat" (`EXT/panel/getting-started/start/step-words.ts:19`); the settings comment says "The extension cannot write a key yet" (`model-section.ts:16`) yet it builds the same writable port (`model-section.ts:65`, `model-keys-port.ts:16`). Three places can take a key (step, chat card, settings card). Fix: one sentence "Add your AI key in the FluxIQ panel" with the link (`purpose: "model-key"`, `open-fluxiq.ts:21-24`); drop the writable card.

D3. The extension chat and the panel chat are not guaranteed the same thread. Both read Core conversations, but the extension keeps its open thread per browser window in session storage (`chat-panel.ts:79-80, 93-101`, `panel/chat/thread-memory/`) and otherwise picks "the one waiting, else the newest" (`chat-threads.ts:9-14`); the panel mounts its own widget with its own project prop and selection (`!FluxIQ/apps/web/src/features/chat-widget/ChatDock.tsx:20-21, 53-54`). Typing in the extension then opening the panel can land in another thread. Fix: hold the current conversation in Core per person and project and have both read it, or let the panel link carry the thread id (see section 4, item 3).

D4. Assistant chats are mixed into the all-projects list: `conversation-relay.ts:103-119` merges project chats with "panel" subject threads (`:58-59`), and with no project the bar reads "All projects" (`title.ts:12`). A person cannot tell which is the panel chat. Fix: one list per project; drop or label the `panel` subject in the extension.

D5. Several ways to start a Flow: composer "Show me how" (`recording-controls.ts:82`), "Show FluxIQ how" (`:83`), the card "Tell FluxIQ what to do in the Chat tab, or show it how" (`:91`), the empty chat's "Describe what you want" and "Extract data from this page" (`empty-state-model.ts:52-55`; the latter switches to Automations and presses an entry hidden inside it, `mount-panel.ts:366-374`), and the empty-list text "Describe one in the chat, or record it below" (`automations-tab.ts:72`). Fix: one entry, the chat composer; delete the "New automation" card and "Show FluxIQ how"; keep "Extract data from this page" as a composer action.

D6. The open automation is named twice: the strip (`mount-panel.ts:352`) and Core's context line (`context-line.ts:20-45`). `chat-panel.ts:44-49` documents `contextLine: false` for exactly this, but `mount-panel.ts:227` does not pass it and `chat-widget.ts:120` defaults it on. Fix: pass `contextLine: false` and put a back control in the strip.

D7. The empty state speaks of "this page" (`empty-state-model.ts:42-50`, `ONBOARDING_CONCEPT` line 38) and never says the project is chosen for you. Fix: pass a `ChatWelcome` (`UIC/chat/ports/threads.ts:5-8`) saying "Tell FluxIQ what you want. It picks the project and saves the Flow."

D8. Many "Open FluxIQ" buttons with different words: "↗" (`open-fluxiq-button.ts:45`, `mount-panel.ts:337`), "Open in FluxIQ" (`automation-strip.ts:33`), "Open data in FluxIQ" (`:35`), "All projects in FluxIQ" (`project-switcher.ts:81`), the key card's, the automations fallback (`automations-tab.ts:75`), getting-started, and a notice link (`automation-strip.ts:195`). Fix: one icon plus one contextual "Open in FluxIQ panel".

D9. Settings mixes config the rule moves with browser-only config under one Save bar (`settings-view.ts:94, 106-128`). The Project row's "Change" (`:72-74`) opens the header switcher, a second route to the same sheet. Fix: section 5.

D10. A project chosen in the extension is stored only in the browser (`project-context.ts:61, 94-102`, `projects-relay.ts:81-92`); Core's own project wins on every read unless the person chose (`project-context.ts:155-161`), and a project chosen in the panel is followed within 15 s (`:27`). So the panel does not show the extension's choice. Fix: write the choice to Core so every client agrees.

D11. A refused first-project ends with `no_project`: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again." (`background/panel/relay-failure.ts:8`, `conversation-relay.ts:80`). That points at reconnecting, not at the panel. Fix: say "Make a project in the FluxIQ panel" with the link.

## 4. Proposed single path and what exists

Path: open the extension, type in its chat; FluxIQ picks or creates the project and Flow; the panel shows the same project and conversation.

Already supported:
- No project selected is allowed: `chat-panel.ts:88-92` ("No `unavailableReason`") and `UIC/chat/ports/threads.ts:29-38`; the composer is not disabled.
- Send resolves a project: `conversation-relay.ts:92-94, 252-254` (`projectFor` -> `context.projectId()`), then opens a thread and appends the turn (`:99-117`).
- Resolution creates one if none: `project-context.ts:155-166` (`forPanel` -> `resolve`) -> `askCore` (`:260`) -> `:265` `askCoreForFirstProject` when Core names none and the browser has none. That POSTs `/api/client-gateway/first-project` (`EXT/background/connection/core-api.ts:43-54`). Core's route returns the person's own project or creates the first (`!FluxIQ/apps/web/src/app/api/client-gateway/first-project/route.ts:7-21`, `automationStudioPersonProject({ create: true })`); the extension adopts and names it (`project-context.ts:271-277`).
- Conversations are Core's, so the panel can show them: `list-conversations` (`conversation-relay.ts:93-97`), `open-conversation` (`:99, 106`), `append-turn` (`:109`).

Missing:
1. A shared current conversation (D3). `panelOpenFluxIQ` takes only `flowId`, `runId` or a purpose (`panel-control.ts:98-124`); add `conversationId` so "Open in FluxIQ panel" lands in the same chat.
2. The project choice in Core (D10), so the panel shows what the extension picked.
3. Words for the empty state and the no-project failure (D1, D7, D11).
4. Which project a later request goes to is decided by the browser's stored or Core's current project only; Core should choose by the request. Not traced.
5. The extension's header already names the auto-created project from the status (`project-selector.ts:53-65`), so no code is needed there.

## 5. Controls to remove from the extension, and what replaces each

| Remove | Where | Replace with |
|---|---|---|
| "+ New project" and its name field | `project-switcher.ts:73-80, 209-238`; port `extension-projects-port.ts:87-93`; relay `projects-relay.ts:68-77` | Nothing: the first message makes the project. In the sheet: "Add or manage projects in the FluxIQ panel" (`Open in FluxIQ panel`, purpose `projects`, `panel-control.ts:100-103`) |
| Chat bar name as a button | `thread-header.ts:117-121` | Plain text; "Chats" stays (Core fix, section 2) |
| Settings Project "Change" button | `settings-view.ts:72-74, 111` | Project name text only; the header switcher stays the one place to switch |
| AI key card (writable) in Settings | `model-section.ts:35-95` | Read-only line "AI key: ready / missing" and "Add or change your key in the FluxIQ panel" (purpose `model-key`) |
| Chat key card and composer key bar saving | `UIC/chat/onboarding/composer-key-bar.ts`, `model-keys-port.ts:16` (host drops `save`) | Same line with the panel link; Extract works with no key |
| "Add your AI key" getting-started step | `steps.ts:113-114`, `step-words.ts:19-20` | "Add your key in the FluxIQ panel" with the link |
| Settings fields: web address, Permissions, Humanness slider, Forget this pairing, the Save bar | `settings-view.ts:79-96, 116-128`, `advanced-section.ts`, `address-form.ts` | Move to the panel's settings for this client. Keep: connection state, Connect/Disconnect, Appearance (`appearance-section.ts:7-32`, per-browser look). The connection address is needed before pairing, so keep it behind "Check the connection address" (`start/view.ts:262`) |
| Per-Flow humanness in the strip | `automation-strip.ts:40` | Link "Change in the FluxIQ panel" |
| "New automation" card and "Show FluxIQ how" | `recording-controls.ts:83-91`; text `automations-tab.ts:72` | Composer "Show me how" (line 82) and the chat; empty text "Describe one in the chat." |
| Duplicate Open FluxIQ buttons | D8 | One "Open in FluxIQ panel" icon in the top bar (opens the open Flow or project, then the thread) |
| Rename and Delete chat | `chat-threads.ts:112-137` via the port's `renameThread`/`deleteThread` (`panel/chat/transport/ports/conversation.ts:15-17`) | Leave those ports out of the extension's transport; the panel does them |

## Not verified

- Nothing was run: no build, no browser, no tests. Everything is from reading code.
- Whether the panel's own chat (`!FluxIQ/apps/web/src/features/chat-widget/ChatWidget.tsx`) has the same name-click defect; it uses `createChatWidget`, so it likely does.
- Whether Core names an auto-created first project from the first message (the route was read, naming was not traced).
