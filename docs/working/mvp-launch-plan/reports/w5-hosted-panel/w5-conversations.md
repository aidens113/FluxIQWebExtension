# w5-conversations (t901, W5 P2)

## Outcome
Partial (one decision for the supervisor: the docked Assistant cannot rename or delete, see Open questions). Everything else done and checked.

## What changed and why
- The panel never had its own thread dropdown or thread list: the dropdown was the shared ui-components chat's native picker, which W4 already replaced with the conversation list (New chat, search, rename, delete). The panel's chat-widget code, CSS and `panelChatOptions` render nothing of the kind, so nothing was removed. `grep "<select"` under features/chat-widget and panel-shell finds only the project switcher in the top bar, which is not a thread control.
- Added `transport/thread-changes.ts` (`createThreadChanges`, exported from the barrel), spread into the project conversation port:
  - `newThread` -> `open-conversation` with `fresh: true` (project from the request or the chat, subject `project`/project id by default; no project -> `no_project` failure, no call).
  - `renameThread` -> `rename-conversation` `{projectId?, conversationId, title}` (title trimmed; an empty one is refused locally; projectId omitted when none is known so Core finds the thread).
  - `deleteThread` -> `delete-conversation` `{projectId?, conversationId}`; Core's `conversation_run_active` and its sentence pass through `chatResult`.
  - After each success it calls `commitConversationChanged` when a project is known, so the rest of the panel re-reads.
- Panel assistant port (`panel-conversation-port.ts`, used by the docked Assistant): `newThread` -> `open-panel-thread {title?}`. `renameThread` and `deleteThread` are deliberately absent (the list then shows no such controls).
- Activation rule: nothing to implement panel-side. The shared chat's answer controls only act on trusted events; the panel's ask path is unchanged. Fixed one existing test affected by the new list: `tests/ChatDock.test.tsx` `buttonNamed` now skips the list's own hidden Cancel (`chat-thread-confirm-cancel`) so it finds the ask card's Cancel.
- `e2e/chat-widget.spec.ts`: `pickThread` now opens the "Chats" drawer if present and clicks the row's `.chat-thread-open` by `data-conversation-id`; `showThreadList` helper; the select/option assertions (V7/V1/V2) became list assertions (no `<select>`, 3 rows, 3 "Waiting on you", no ids on screen, search "planning" keeps one row); the other combobox "Thread" waits use the list/toggle. Not run.
- `route.test.ts`: `rename-conversation` and `delete-conversation` added to the allowlist, classifications (authoring), the forwarding table, plus tests: forwards exactly `{conversationId, title}` / `{conversationId}` as the paired person; 403 and no Core call for extra fields (status, flowId, force, title on delete); 403 for a non-object body. (route.ts unchanged; the allowlist and narrowing come from Core's program-route.)
- New `transport/tests/thread-changes.test.ts` (new/rename/delete requests, no-project, empty name, Core refusal, panel port).

## Commands run and observed results
- Lib build under lock via heavy-slot: completed, exit 0 (contracts, fluxiq, ui-components); lock released.
- `pnpm --filter @fluxiq/web exec vitest run src/features/chat-widget "src/app/api/programs/[programId]/[endpoint]" src/tests` -> Test Files 1 failed | 22 passed (23); Tests 1 failed | 219 passed (220). The one failure: `src/tests/provisioning-welcome-smoke.test.ts` "provisions over the listener, redeems the welcome link and signs in" -> `expected 403 to be 200`. It is in the accounts/security area (not mine, not touched), not investigated.
- `pnpm structure:check` -> "structure-audit: passed (534 warning(s), 917 baselined)".

## Not verified
- e2e/chat-widget.spec.ts (not run, per brief); selectors written from the ui-components README hook classes.
- The provisioning smoke failure's cause (likely the parallel worker's security/accounts change).
- No apps/web typecheck (supervisor runs it).
- Panel-token test passed as part of src/tests; no CSS was added.

## Open questions
- The docked Assistant (panel threads in the reserved assistant store) has no Core rename or delete endpoint, and `rename-conversation`/`delete-conversation` search project databases only. So rename/delete cannot work there without a Core change in packages/fluxiq (W4's). Say if you want that added.
