# chats-list-live report

Outcome: Done (both items fixed inside owned paths). Core tree: C:/Users/osrs_/FluxStuff/fxwork/t925/!FluxIQ, W = apps/web/src.

## Cause
1. Stale rows: `W/features/chats/ChatsPage.tsx` read the list once through `useLoaded` and never subscribed to the panel change stream, so only the thread page (via chat-widget `changes-port.ts`) heard conversation changes.
2. Empty list: the assistant dock reads `list-panel-threads` (panel-conversation-port.ts:29), but `loadChats` (`W/features/chats/load-chats.ts`) only called `list-conversations`, which lists project threads. Panel threads belong to no project (projectId "panel"). Also `parseConversations` (W/features/automation-studio/conversation/thread/contracts.ts:126, outside my paths) would drop them: panel records are flat (`subjectKind:"panel"`), and it accepts only project/flow/build/run subjects.

## Change (all in W/features/chats)
- New `use-reload-on-chat-changes.ts`: subscribes to `sharedPanelChanges()` (the one shared stream, no timer, no second stream); `conversation` and later `opened` events call `reload`. The `opened` told synchronously on subscribing is skipped (the page has just read). `ChatsPage.tsx` calls it with `chats.reload`; `useLoaded` keeps the shown rows during the reload.
- New `parse-panel-threads.ts`: maps the flat `list-panel-threads` records to `Conversation` (bad record dropped alone).
- `load-chats.ts`: reads `list-conversations` and `list-panel-threads` in parallel (both scopes), merges, dedupes by id; either failure throws with Core's words.
- Panel rows link to `/chats/<id>?project=panel`. Not verified that ChatThreadPage opens a panel thread through project "panel" (composed port routes projectId "panel" to the panel port by design, but I did not run it).

## Tests
- `chats/tests/ChatsPage.test.tsx`: mock now routes by endpoint and fakes the shared stream. New: conversation change reloads the list (10 -> 12 messages, then `opened` -> 13), with exactly one read on mount; assistant thread listed after reload and "no chats yet" absent.
- New `chats/tests/parse-panel-threads.test.ts` (2 tests).

## Commands
- `npx vitest run src/features/chats` (in apps/web) -> Test Files 3 passed, Tests 11 passed.
- `pnpm --filter @fluxiq/web check` -> build-cache step web:check completed, no tsc errors printed.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (549 warning(s), 914 baselined)".

## Not verified
- Live behaviour against 127.0.0.1:3100 (panel not touched; running tree needs its own reload to show the change).
- Real `list-panel-threads` record shape beyond the existing port test's fixture and Core's register.ts; the `panel-changes` stream event names conversation changes for panel threads (assumed, since the dock uses it).
- "Show older chats" limit now applies to both lists, so a page may exceed `limit` rows by the panel count; `canLoadMore` still triggers on `>= limit`.
- panel-changes untouched, so its tests were not run.
