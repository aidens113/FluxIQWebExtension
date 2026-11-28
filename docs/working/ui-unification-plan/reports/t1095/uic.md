# t1095 uic report

Outcome: Done

## What changed and why (Core packages/ui-components/src)
- Defect 1 / I3: chat/view/thread-header.ts: the bar title is a plain `span.chat-bar-title` (no click, no aria-expanded/controls, no tabindex, no "Choose a chat" tooltip). "Chats" is the only drawer toggle. chat/conversation/thread-list/title.ts: `conversationDisplayTitle(thread, emptyTitle?)` no longer takes a project name; thread title, else the subject noun ("New chat", "This run"...), else `emptyTitle`, else "New chat". chat/threads/chat-threads.ts calls it that way; `deps.projectName` kept as optional and unused so chat/chat-widget.ts (not mine) still compiles. chat/ports/threads.ts `emptyTitle` doc updated. thread-list.css: button styling dropped.
- I1: project-switcher/projects-port.ts `create?` optional. project-switcher.ts: without it no New project button/name field; all-projects button reads "Add or manage projects in the FluxIQ panel"; no current project reads "No project yet"; empty list reads "FluxIQ makes one when you send your first message."; with create unchanged.
- I2: model-access/key/card.ts: with `canWrite` false the form is unreachable; add-key / paste-again / replace-key actions become one "Open FluxIQ" (calls `onAction("open-fluxiq")`), plus a line "Add or change your AI key in the FluxIQ panel." (`.model-key-panel-note`); Add another and Remove hidden. change-model, try-now, how-to-update are not key writes and are unchanged (judgement call; ext-ui may want to know). canWrite true unchanged.

## Defect 1 before / after
- Before: bar title = `<button class="chat-bar-title" aria-expanded aria-controls>` whose click called the drawer toggle; text = project name when the thread was about the project or there was no thread yet.
- After: `<span class="chat-bar-title">`, click does nothing; text = conversation title else "New chat"; never the project name.

## Tests (beside code)
- chat/threads/tests/chat-bar.test.ts: title click leaves the drawer closed and open; only Chats toggles; no aria attrs; project "Gamma" shows "New chat".
- chat/conversation/thread-list/tests/thread-list.test.ts, chat/tests/threads-widget.test.ts updated for the new titles.
- project-switcher/tests/project-switcher.test.ts: new test for no-create words and no create control.
- model-access/key/tests/card.test.ts: old "cannot write yet" test replaced; two new canWrite-false tests (no form, one panel action).

## Commands run
- `cd packages/ui-components && pnpm check` -> completed with no tsc errors (build-cache step ran 66982 ms; exit 0 as run through tail, no error output).
- `npx vitest run src/chat src/project-switcher src/model-access` -> Test Files 118 passed (118), Tests 789 passed (789).
- `node scripts/structure-audit.mjs` -> "passed (583 warning(s), 895 baselined)"; only new advisory is card.test.ts at 404 lines (past 400 advisory); 9 baseline entries could be lowered (not mine to record).
- heavy-slot `ui-components:build` -> ran ("ms":17232, source command, no error); not stamped because packages/fluxiq inputs changed during the run (another worker editing).

## Not verified
- Live browser; extension consumers (ext-ui must stop passing `create` and set `canWrite:false`); a rebuild after other workers finish if a stamp is needed.
- `pnpm check` exit code was read from the piped output, not directly.

## Open questions
- Whether change-model should also go to the panel when canWrite is false.

## Follow-up (sub-supervisor decisions)
- Key card with canWrite false: the one action now reads "Open in FluxIQ panel" (card.ts); add-key, paste-again, replace-key and change-model all become it (click -> `onAction("open-fluxiq")`). Try now and How to update are unchanged. Test added (Change model becomes the panel action; Try now stays); existing canWrite-false tests renamed to the new label.
- Removed `deps.projectName` from chat/threads/chat-threads.ts and its pass-through in chat/chat-widget.ts. `createChatThreads` has no caller outside chat-widget.ts, so no apps/web file needs a change (the apps/web `projectName` hits are host status fields, unrelated).
- `pnpm check` -> exit 0 (CHECK_EXIT 0 printed directly). vitest src/chat src/project-switcher src/model-access -> 118 files, 790 tests passed. structure-audit -> passed (583 warnings, 895 baselined), no new violations. heavy-slot ui-components:build -> see final message.
