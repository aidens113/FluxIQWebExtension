# assistant-shared (t925, key-security-ux)

W = Core apps/web/src, U = Core packages/ui-components/src.

## Outcome
Done for items 1-3, with two gaps listed under Not verified. No commits, no branch changes. U version not bumped (no new stylesheet exported).

## 1. Assistant with no project
Cause: `panelChatOptions` always set `unavailableReason`, so the chat's `nowhere()` blocked the composer when no project was open. The composed port also sent a project-less "latest" list to the project port.
- `W/features/chat-widget/options/panel-chat-options.ts`: new input `assistant`; when true no `unavailableReason`. A project-only chat keeps it.
- `W/features/chat-widget/ProgramChatWidget.tsx`: passes `assistant: panel !== undefined`.
- `W/features/chat-widget/transport/composed-conversation-port.ts`: with no project open, `listThreads` goes to `list-panel-threads`. A first message already went to `send-panel-message` through `originOf`.
- U: new `threads.emptyTitle` option and `conversationDisplayTitle` third parameter. A `panel` thread is never named "<noun> · <project>" (this is the chat-widget part of #18). Files: `chat/ports/threads.ts`, `chat/threads/chat-threads.ts`, `chat/conversation/thread-list/title.ts`.
- Not wired yet: W does not pass `emptyTitle`. The dock with no thread still reads "All projects". One line in `panelChatOptions` (`emptyTitle: "New chat"` when `assistant`) would fix it; I did not add it.
- Tests: `ChatDock.test.tsx` ("takes a message at once with no project ... into its own thread": composer enabled, no "Open a project" text, `send-panel-message` gets `{text, onScreen}`, no `append-turn`, `open-conversation` or `list-conversations`); `composed-conversation-port.test.ts` (2 new); `panel-chat-options.test.ts`; `thread-list.test.ts`.

## 2. Project survives reload, honours ?project=
New in `W/features/panel-shell/context/`: `project-storage.ts` (localStorage, typed `ok/reason` result, no swallowed failures), `requested-project.ts` (`?project=` wins over storage), `use-restored-project.ts` (restore on mount, remember on change, drop an unknown restored id once the project list has loaded and not failed). Wired in `PanelContextProvider.tsx`; exports added to `index.ts`.
- Only the restored id is validated, so a just-created project is never cleared by a stale list. A failed list read keeps the project. A refusing browser logs one warning and carries on.
- It imports `../top-bar/use-project-choices` directly, because the top-bar barrel imports the context barrel (a cycle). The structure audit accepted it.
- Tests: `context/tests/restored-project.test.tsx` (7): none by default and storage not wiped; restored after a reload; address wins; unknown id falls back to none and is forgotten; failed list keeps it; new project not cleared; storage refused.

## 3. Shared look (U)
- #15: `theme/tokens.css` gets `scrollbar-width: thin` and `--scrollbar-thumb` (color-mix of `--text-dim`, follows the theme). Test in `theme/tests/tokens.test.ts`.
- #5/#6 clip: `model-access/model-access.css` rule `.chat-key-card, .chat-key-bar { flex: none; min-height: min-content; overflow: visible }`. In `chat/view/empty-state.ts` the key line and card now sit directly under the title and line, above the welcome lines, so the button is never below the fold of a short dock. `chat.css` untouched (still 800 lines).
- One no-key card: the dock's second helper and placeholder copy is gone (item 1). The sweep's two cards were the old key line (no `modelKeys` port) versus the card. With the port both states use the same compact card and words.
- Tests: `chat/view/tests/thread-header.test.ts` (card before welcome lines; exactly one `model-key-card`; line hidden), `model-access/tests/key-card-sheet.test.ts`.

## Commands run (all through the slot queue)
- U tests (`vitest run` theme, model-access, thread-header, thread-list, threads-widget, styles): 11 files, 89 tests passed.
- W tests, first run: 1 failed (my expectation lacked `subjectId`), fixed. Final run (`chat-widget/transport`, `ChatDock.test.tsx`, `panel-shell/context`): 12 files, 92 tests passed. The first run covered chat-widget, context and dock: 21 of 22 files passed before the fix.
- `pnpm --filter @fluxiq/ui-components check`: no errors printed (build-cache step ran, 14 s). `pnpm --filter @fluxiq/web check`: no errors (30 s, after the last edit).
- `node scripts/structure-audit.mjs`: first run 5 failures (2 mine: failure-as-empty and swallowed in project-storage, statement packing in two test files; fixed). Final: 1 failure, `app/product/preset/is-hidden-panel-path.ts` importing `features/settings-page/model/engine-tools` (not my file, journey fix 8's worker).
- `node scripts/build-cache/cli.mjs ui-components:build`: `reuse ... inputs and outputs match the stamp`, so another worker's build had already stored my sources. Not a fresh compile by me. The same command printed no failure.

## Journey 2 step count (panel first)
Before: Home (assistant disabled) -> Projects -> Create project, name, Create -> first message = about 8 clicks, 5 screens to a first message. After: Home, type the first message = 0 project steps. The assistant takes the message at once into its own thread. Removed: steps 5 (project creation) of the journey table, as the lead decided. The key step (4) is another worker's.

## Not verified
- No browser run; the panel was not started, so nothing was seen on screen: scrollbar look, card position and the no-key reply text are verified by tests and CSS only.
- Wording of the server's no-key reply ("No model key is set up yet...") differs from the card sentence; that text comes from Core (t928 area), not changed.
- The dock's empty-title (see item 1) and "FluxIQ assistant" versus "Untitled chat" in the Chats list (chats worker) are not finished.
- `?project=` is read once on mount; the address is not rewritten when the project changes.
- U gained an API option (`emptyTitle`); no version bump was made per the brief, so the lead may want a minor bump.
