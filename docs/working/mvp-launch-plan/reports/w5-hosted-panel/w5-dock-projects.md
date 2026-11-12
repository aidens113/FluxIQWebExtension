# w5-dock-projects (t901, W5)

## Outcome
Done, except the e2e tests are written but not run (per brief) and real groups are not possible in the shared list (W4 gap below).

## What changed and why
- New `transport/composed-conversation-port.ts` (`createComposedConversationPort`, exported from the barrel): one port over the panel port and the project port. `listAllThreads` reads `list-panel-threads` then, when a project is open, `list-conversations` for that project; own threads first, then the project's. Each listed record notes its origin; read, send, answer, rename and delete go to the origin's port (origin from the lists, else the record's project: `panel` or none -> panel, a real project -> project). A new chat and a send with no thread are the person's own (panel). A failed project read is returned as the failure (the chat keeps its held list and retries), never hidden.
- `PanelConversationOptions` gained optional `openProject()`; `program-chat-transport.ts` composes only when a panel chat has it. No project open: the panel port alone, exactly as before. The project port gets the panel's on-screen flow/run/recording so a send into a project thread carries them.
- `ProgramChatWidget.tsx` passes `openProject` (the host's open project and its `projectName`, if the host gives one).
- Answers: a project thread's ask goes through `answer-ask` (choice id and typed words in `value`, existing `answer-ask.ts`); a panel thread keeps `answer-panel-ask`.
- `attachments/read-attachment.ts`: in the docked Assistant a thread whose context names a real project (a project thread) is read with `get-conversation-attachment` in its own project; panel threads (project `panel`) keep `get-panel-thread-attachment` with the open project. The old test "prefers a real project the context names" now asserts the new rule.
- Seed (`e2e/support/seed-chat-threads.mjs`): in the small project, "Cleanup choice" (run subject, choice ask `ask.e2e.which-draft`, options Clear the oldest / Clear both, consequence delete) and "Project questions" (project subject, open ask `ask.e2e.name`), written through `studio.conversations.writerFor`; ids in `chat-threads-manifest.json` under `projectThreads: { choice, open }`.
- Spec (`e2e/chat-widget.spec.ts`): `Seeded` type extended; `openSmallProject`; three tests: list shows the project's threads only once the project is open; choice ask with destructive options settles on one press with no PIN dialog; open ask takes words and answers. All pick the thread from the dock's list.
- Tests: `transport/tests/composed-conversation-port.test.ts` (listing order and labels, failed project read, read/send/answer/rename/delete routed to the right endpoint, project answer with a choice and with words, new chat is the panel's, no project open).

## Groups (item 3)
The shared list has no groups. Its rows come from `parseThreadList` -> `ThreadRow` (`conversationId, projectId, label, when, date, waiting, selected, search`), sorted by `sortThreadsForList` (waiting first, then open, then newest), which also decides order, so "own first" holds only in the read, not on screen. Used instead: a per-thread label, `"<project name> · <title>"` for a project thread (name from `projectName`, which `AssistantDock` does not pass today, so it reads "This project · ..."; passing it is in `features/panel-shell`, not mine). The prefix is stripped on rename so it is never stored. For real groups W4 would need: a group field on `ChatThreadSummary`/`ThreadRow` (from the record's project, with a display name from a port, e.g. `ChatThreadsOptions.groupLabel(projectId)`), grouping in `sortThreadsForList` (group first, then the existing order within it), and group headings in `conversation-list.ts` (a `li` heading with `role="presentation"` or nested lists) with search matching the group name.

## Commands run and observed results
- Lib build under lock via heavy-slot (the first test run reported Core's dist stale by another worker's change): exit 0; lock removed.
- `pnpm --filter @fluxiq/web exec vitest run src/features/chat-widget src/tests` -> Test Files 20 passed (20), Tests 145 passed (145). (Free memory was 1437 MB when started, below the 2500 MB bar; the earlier check, 3269 MB, was taken before the rebuild. No crash.)
- `pnpm structure:check` -> "structure-audit: passed (537 warning(s), 916 baselined)".

## Not verified
- e2e not run (per brief); the new spec tests are only read for types. Assumptions: choice ask heading "FluxIQ is asking you to choose." and the "Consequences requiring approval" list (both from the old spec), and that Core settles a choice ask on a thread with no parked run (the old spec only reached the PIN dialog).
- The seed's `studio.conversations.writerFor(...)` is from the old seed (same collaborator); not run.
- No apps/web typecheck.
- Existing spec V7/V8 row counts assume no project open; U5 opens the small project and picks a panel thread by id, still fine, but the rows now include the project's two threads there.

## Open questions or contradictions found
- Panel ask card on a panel thread still cannot take a choice or words (`answer-panel-ask` is grant/deny only); unchanged.
- I mangled `attachments/tests/panel-attachment-port.test.ts` once with a CRLF-blind script and restored it from `HEAD` (it matched the working copy); the file is now LF->CRLF written, contents as intended.
