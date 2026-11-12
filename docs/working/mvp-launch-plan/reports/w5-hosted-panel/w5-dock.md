# w5-dock (t901, W5)

## Outcome
Partial. Tasks 1, 2 and 3 done and verified (chat-widget runner: 12 of 12 pass, U5 included). Task 4 cannot be done: no screen in the panel can show a project thread, so the choice and open-ask cases have nowhere to be raised. Exact gap below.

## What changed and why
1. Attachment reads (`apps/web/src/features/chat-widget/attachments/read-attachment.ts`): `readAttachment(api, { panel? })`. In the docked Assistant (panel set) it posts `get-panel-thread-attachment { conversationId, turnId, projectId? }`. The project is the context's project if it is real, else the project the person has open (`openProjectId`); the literal `panel` is never sent. With no project it omits `projectId` (Core serves a navigation, and refuses a proposal in its own words). Project threads keep `get-conversation-attachment`. `ProgramChatWidget.tsx` passes `panel` when the chat is the panel one, with `openProjectId: () => latest.current.projectId`.
   - The turn's reference (`flow.<id>:adaptation.<id>`) does NOT carry a project, and neither does the turn. The only source is the host's open project (the top bar). So a proposal reads only while its project is the open one. Not an assumption I could remove without a Core change (a project in the reference or turn).
2. `transport/panel-conversation-port.ts`: `renameThread` -> `rename-panel-thread { conversationId, title }` (trimmed; empty refused locally, no call) and `deleteThread` -> `delete-panel-thread { conversationId }` (Core's refusal and sentence pass through).
3. Seed: `e2e/support/seed-chat-threads.mjs` already planted, in the "Planning notes" panel thread, a `flow-graph-diff` turn referencing a real proposal in the small project (unchanged). Spec U5 now selects the small project in the top bar's Project combobox first (the dock reads the proposal in the open project), then asserts the "Structural changes" table (Start the post, Finish the post, 3 Added rows, no `builtin.`). Nothing weakened; stale "fails today" comment replaced.
4. Tests: `attachments/tests/panel-attachment-port.test.ts` (panel read uses real project not `panel`; context project wins; none open omits it) and `transport/tests/thread-changes.test.ts` (panel new/rename/delete requests, empty name, Core refusal; replaced the old "offers no rename or delete" assertion).

## Commands run and observed results
- `pnpm --filter @fluxiq/web exec vitest run src/features/chat-widget src/tests` -> Test Files 19 passed (19), Tests 137 passed (137).
- Lib build under lock via heavy-slot (contracts, fluxiq, ui-components) -> exit 0; lock removed.
- `node .../heavy-slot.mjs run t901 -- node apps/web/e2e/support/run-isolated.mjs --only e2e/chat-widget.spec.ts` (with build) -> `12 passed (1.2m)`, `done in 485s, 0 round(s) failed`. U5 passed (3.4s). Free memory was 3065 MB at start (earlier checks at 1070-1922 MB, waited).
- `pnpm structure:check` -> "structure-audit: passed (537 warning(s), 917 baselined)".
- After the run: no node/next process with `fxwork\t901` in its command line remained.

## Not verified
- Only desktop-chromium ran. No apps/web typecheck (the build typechecked; supervisor runs the check).
- A proposal read while a different project (or none) is open was only unit-tested, not live.

## Open questions or contradictions found
- Task 4 gap (choice and open asks on a project thread): the premise "project threads are in the shared conversation list" is not true in the code. `AssistantDock.tsx` is the only mount of the chat (`ChatDock` and `ChatWidgetPage` have no route or import outside tests), and it always passes `panel`, so `createProgramChatTransport` (`transport/program-chat-transport.ts:26`) always uses `createPanelConversationPort`, whose `listThreads`/`listAllThreads` call only `list-panel-threads` (`transport/panel-conversation-port.ts`). A seeded project thread therefore never appears. To cover choice and open asks the panel needs: (a) the list to include project threads (a `listAllThreads` over `list-conversations` merged with `list-panel-threads`, and `readThread`/`send`/`answer` routed per thread, project threads via `get-conversation`, `answer-ask` in `transport/answer-ask.ts`, which already takes `value` for open asks), or a screen mounting `ChatWidgetPage`/`ChatDock` for a project; and (b) a decision on which of those. Separately, `answer-panel-ask` accepts only grant or deny (`register.ts`), so a choice or open ask in a panel thread cannot be answered. I did not seed or write those tests since there is no screen to run them on; say which route to build.
- The Project-in-reference gap above: Core could carry the project in the turn or reference so the dock does not depend on the open project.
