# t1095 ext-ui report

## Outcome
Done. All items in the brief are built and tested. The last full run of `src/panel` passes, the typecheck is clean and `model-text` passes. The structure audit has two failures, neither in my files.

## What changed and why (before / after)
Paths are under `apps/extension/src/panel/`.

| Item | Before | After |
| --- | --- | --- |
| I1 projects port | `extensionProjectsPort` had `list` and `create` (sent `panelCreateProject`) | `list` only. Core's switcher now draws no "+ New project" and says to manage projects in the panel. The selector's `open()` (used by Settings "Change") is removed. `projects/` |
| Settings: project "Change" | `#changeProjectButton` opened the header switcher | Gone. The project name line stays. A new group "In the FluxIQ panel" holds the links "Manage projects in the FluxIQ panel" (purpose `projects`) and "Change humanness in the FluxIQ panel". `settings/settings-view.ts`, `project-line.ts` |
| Settings: key card (I2) | Writable card (save, replace, remove) | `modelKeysPort` has `canWrite: false`. The three write methods only refuse with "Add or change your AI key in the FluxIQ panel." and send nothing. `send-key-write.ts` and `KEY_WRITE_MESSAGES` are removed (the chat's key card gets the same read-only port). Core's card draws its panel line and "Open FluxIQ" action. |
| Settings: humanness slider and Save bar | Slider saved through the bar | Slider and `settings/humanness/slider.ts` removed. `HUMANNESS_CHANGE_LABEL` removed and `unsavedLabels` loses its humanness argument. The Save bar stays only for the connection address, auto-reconnect and permissions. A save carries the stored humanness through unchanged. |
| Settings kept | | Connection state, Connect/Disconnect, Forget this pairing and the two addresses (under Advanced), permissions, on-page status, appearance, report a problem. |
| Getting started key step | "add your AI key in the chat" | Step line "Add your AI key in the FluxIQ panel. ..." plus a link button "Add your AI key in the FluxIQ panel" (purpose `model-key`). `getting-started/start/{view,step-words}.ts` |
| Strip humanness | Slider behind "Humanness · N" | A link "Change in the FluxIQ panel" that opens that Flow. The Flow-humanness section, its port, its test and its CSS are removed. `automations/` |
| "New automation" card, "Show FluxIQ how" | Card with two buttons and text | Both removed. Composer "Show me how" is unchanged. `recording-controls` now returns `extractEntry` (just the extraction entry, so the Automations tab and `openExtraction` still work). The tab hook `newAutomation` is renamed `extract`. Empty text is "Describe one in the chat." |
| Chat context line (D6) | On (the open Flow named twice) | `contextLine: false` passed in `shell/mount-panel.ts` |
| Chat welcome (D7) | "What can FluxIQ do for you?" plus starts | `EXTENSION_WELCOME` (new `chat/extension-welcome.ts`) says "Tell FluxIQ what you want. It picks the project and saves the Flow." |
| Conversation port | `renameThread` and `deleteThread` | Removed (the thread list then offers neither). `chat/transport/ports/conversation.ts` |
| One wording (D8) | "Open FluxIQ", "Open in FluxIQ", "Open data in FluxIQ", ... | `OPEN_IN_PANEL = "Open in FluxIQ panel"` (new `open-fluxiq/panel-label.ts`). Used by the top-bar icon, strip, notice, tab fallback, getting-started, recording review and the hidden key action. The strip's data and run links read "Open data in FluxIQ panel" and "Open run in FluxIQ panel". |
| I6 | None | `createOpenFluxIQButton(request, style, flowId?, conversation?)`. The chat's controls and the top-bar icon pass the thread on screen (`chat.target()` when `kind === "thread"`). `conversationId` and `projectId` are sent only when there is no Flow and no page-specific purpose (keys, projects, pairing). They are typed locally as `{ conversationId?: string; projectId?: string }`. The purpose union gained `projects`. |

Tests were added or updated beside each change:
- `open-fluxiq/tests/open-in-panel.test.ts` is new.
- `chat/transport/tests/thread-list-ports.test.ts` now covers New chat and the absence of rename and delete.
- `model-keys/tests/model-keys-port.test.ts` checks that the port is read-only.
- `projects/tests/*` check there is no `create`.
- `settings/tests/{settings-order,save-model,unsaved-changes,humanness-settings}.test.ts`.
- `getting-started/start/tests/view.test.ts` covers the key-step link.
- `automations/tests/*` (strip humanness link, "Describe one in the chat.", new link order).
- `shell/tests/mount-panel-navigation.test.ts` covers the context line gone, the welcome, and the extraction entry in Automations.
- `chat/tests/chat-panel.test.ts` covers the welcome and no rename/delete.

Files deleted (the lead stages them): `settings/humanness/slider.ts`, `automations/humanness/` (whole directory, including its test), `chat/transport/ports/model-keys/send-key-write.ts`.

## Commands run and observed results
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t1095-ext-ui node scripts/test-extension.mjs src/panel` printed `# tests 731 / # pass 731 / # fail 0`. This ran against the Core `ui-components` build as it stood when I ran it. Core's card and port changes had landed by the last run. An earlier run, against an older Core build, failed the key-card test.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` finished with no output and exit 0. An earlier run, before Core's I1 landed in the built types, had one error: `create` missing in `ProjectsPort`. It went away on its own, with nothing worked around.
- `node scripts/check/model-text.mjs` printed `model-text: ok (202 scenario tokens, 575 model-facing Core files, 14347 string literals)`.
- `node scripts/structure-audit.mjs` finished with 2 violations, neither mine. One is a statement-packing violation in `background/projects/tests/projects-relay.test.ts`, which is ext-bg's. The other is `docs/working/README.md` needing `pnpm structure:baseline`, which is the lead's. I fixed my own naming violation (the `open-` prefix) and statement-packing violations (one in `open-fluxiq-button.ts`, one in `mount-panel-navigation.test.ts`).

## Not verified
- No live browser check. Nothing was loaded in Chrome or Firefox.
- The `panelOpenFluxIQ` message with `conversationId` and `projectId` is typed locally. The background does not yet read it (ext-bg's I6 work), so until it lands the panel opens its home page.
- The empty-chat "Extract data from this page" start is gone. The welcome replaces the starts, so extraction is reached from the Automations tab's entry. I did not change `onExtract`, which is now unused by an empty chat.
- A thread is passed to the panel only when the chat shows a specific thread (`target.kind === "thread"`). While the chat shows "latest", the plain home is opened.
- The card's action text "Open FluxIQ" comes from Core, so it differs from the "Open in FluxIQ panel" wording.

## Open questions or contradictions found
- The brief says the strip's humanness becomes "Change in the FluxIQ panel". It sits beside "Open in FluxIQ panel", which opens the same Flow. That is two links to one place, as asked.
- `RUNTIME_MESSAGES.panelCreateProject`, `panelModelKeySave/Replace/Remove`, `panelConversationRename/Delete` and `panelFlowHumannessRead` have no panel caller now. ext-bg or the lead can drop them from `shared/` and the background.

## Follow-up: screenshots in the provider-free ui:e2e first-run journey
Changed (all under `packages/test-runner/src/ui-e2e/journeys/`):
- `screenshots.ts` is new. `journeyShots(dir)` writes numbered PNGs and an `index.json` sidecar. A capture that fails is recorded in the index as `skipped` with its reason and never fails the journey.
- `extension-shots.ts` is new. It takes the extension shots (first open, project sheet, Settings) and the after-run shots (extension chat, panel).
- `first-run.ts` calls it after `connectExtensionForProject` and after the run succeeds. No assertion was changed.
- `index.ts` exports the new modules.
- `tests/screenshots.test.ts` is new.

Shots, in order:
- (a) `extension-first-open`: the empty chat with the welcome and the project button.
- (b) `extension-project-sheet`: the project sheet, with no "+ New project" and the panel link.
- (d) `extension-settings`.
- (c) `extension-after-run`: the extension chat after the Flow ran.
- (e) `panel-after-run`: the panel as it stands, on the same project.

Limits:
- A provider-free run sends no chat message, so (c) is the extension after the Flow ran. It shows the strip only if the extension has the Flow open.
- (e) is the panel page as it stands, not a navigation to `/chats`, so the journey's state is not disturbed.

Where the PNGs land: `<workspaceDirectory>/ui-e2e-screenshots/first-run/NN-<name>.png` with `index.json` beside them. The workspace directory is the run directory under test-runs (`FLUXIQ_DEMO_RUN_DIR`, else `<runs>/web-extension-demo`), which is not committed.

Command for the lead to run (not run by me): `pnpm ui:e2e --lane provider-free --journey first_run`. I did not verify the exact flag spelling, so check `packages/test-runner/src/ui-e2e/journey-selection.ts`.

Validation:
- test-runner `tsc -p tsconfig.json --noEmit`: 87 errors, all pre-existing "Cannot find module @fluxiq-web-extension/domain/node" and "browser-host/reaper" because those packages are not built in this tree. None are in my files (grepped).
- `node scripts/structure-audit.mjs`: only the `docs/working/README.md` baseline violation remains. My earlier failure-as-empty, swallowed-failure and statement-packing findings are fixed.
- The unit tests were not run. `pnpm test` needs the domain, browser-host and test-evidence builds first, which I did not do.

## Follow-up 2: panel-only things in project threads
Changed (all under `apps/extension/src/panel/`):
- (a) `panel.on-screen` attachments. The extension's chat is mounted with no attachments port (`chat-panel.ts`), and Core's message view draws an attachment only when a port exists, so no turn attachment is drawn and `panel.on-screen` never shows. I added no port, since a port would start drawing the other attachment kinds. The invariant is now locked by a `chat/tests/chat-panel.test.ts` test with a person turn carrying a `panel.on-screen` attachment. For that test, `chat/conversation/tests/target-core.ts` can now carry an `attachment` on a turn.
- (b) `ask.assistant.` cards. `chat/asks/present-ask.ts` now words them as read-only. The note is Core's sentence: "This question was asked by the FluxIQ panel's tools. Answer it in the FluxIQ panel." Every action carries `reauthorize`, which this host never handles. Core's ask view therefore drops the answer buttons and draws the chat's open control, "Open in FluxIQ panel". That control passes the conversation and project (I6) because its purpose is `ask`. No ui-components change is needed. Tests: `asks/tests/present-ask.test.ts` for permission, confirm and open kinds, and `chat-panel.test.ts` end to end (no Allow or Don't allow buttons, sentence shown).
- Settings test: `settings-order.test.ts` followed Core's latest card, whose one read-only action is now "Open in FluxIQ panel" in every state.

Validation:
- `EXTENSION_TEST_BUILD_LABEL=t1095-ext-ui node scripts/test-extension.mjs src/panel` -> tests 731, pass 731, fail 0.
- `tsc -p tsconfig.json --noEmit` -> no output.
- `node scripts/check/model-text.mjs` -> `model-text: ok (202 scenario tokens, 575 model-facing Core files, 14348 string literals)`.
- `node scripts/structure-audit.mjs` -> see the return contract below.
