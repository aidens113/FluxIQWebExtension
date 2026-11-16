# Chat title refresh (t915)

## Outcome
Done.

## Cause
Core titles an unnamed thread inside the send call (`nameFromFirstMessage`), but the chat only re-read the thread list on its beat (4 to 10 s) or on a pushed change. Nothing read the list when a send ended, so the Chats list and the chat bar (both drawn from the list's row) kept "New chat" until the next beat or a reopen.

## What changed
- `packages/ui-components/src/chat/chat-widget.ts`: `renderAll` notes when the controller's `sending` goes true to false and reads the thread list then (`threads.read()`, only while active). The catalog's signature check redraws list and bar (and `onTitle`) when the title differs.
- `packages/ui-components/src/chat/tests/threads-widget.test.ts`: new test. New chat, send a first message, Core titles it during the send; asserts the list row and `onTitle` (chat bar name) show the title with no reopen. It failed before the fix (list read only once).

## Commands run
- `vitest run src/chat src/project-switcher`: 110 files, 744 tests passed.
- `pnpm --filter @fluxiq/ui-components check`: passed (build-cache step ran, no tsc errors).
- `pnpm --filter @fluxiq/ui-components build`: passed (238 s, other worker was loading the machine).
- `node scripts/structure-audit.mjs` in CORE: printed nothing; exit code not captured (the run went to the background twice).

## Not verified
- Not run in a live browser or against real Core; the fake Core titles during `send`, as the real one does.
- Structure audit exit status.

## Open questions
None.
