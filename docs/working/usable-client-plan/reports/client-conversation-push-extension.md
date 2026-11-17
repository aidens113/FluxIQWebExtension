# t921 client-conversation-push-extension

## Outcome
Done.

## What changed and why
- `background/projects/conversation-changed.ts` (`conversationChangedFor`) and `resync-changes.ts` (`resyncChange`), exported from `projects/index.ts`: turn `server.conversation_changed` into a `fluxiq.panel.changes` naming the conversation (projectId null for the panel thread), and a ready session into one `panelChanges` naming none.
- `background/connection/server-command-channel.ts`: routes `server.conversation_changed` to new optional dep `acceptConversationChanged` (never answered, no status); `handleSessionReady` calls new optional dep `onSessionResync` once.
- `background/connection.ts`: wires both to `chrome.runtime.sendMessage` exactly as activity is (same path for Chrome side panel and Firefox popup).
- `panel/chat/transport/ports/changes.ts`: `complete: true`. The listener logic is unchanged: a named conversation tells `{conversationId}`, none tells `{}`.
- `docs/architecture/extension-client.md`: poll sentence replaced with the push design.

## Why complete is justified
The widget's poll read: the thread list, the thread (`controller.refresh`), model readiness (`reader.read`), and the activity feed when failed. The widget's own change listener schedules a thread and list refresh on any change and rechecks readiness when `complete`. Thread/list changes arrive by `conversation_changed` (any author) and activity pushes; every reconnect gap is closed by the `{}` on `session_ready`; activity itself is already pushed (`ACTIVITY_MESSAGES.changed`); readiness is re-asked on a change and on composer focus per the Core widget. A worker asleep (MV3) wakes and reconnects, so it too ends in `session_ready`. Residual: a panel opened while the worker is already ready reads on its own start; a panel that misses a broadcast with the worker connected has no other path (accepted by the contract).

Kept: the activity-driven `panelChangesFor` signal (project/conversation from `server.activity`), still useful for run/attempt changes not yet emitted as conversation changes; not redundant.

## Commands run and observed
- `node apps/extension/scripts/test-extension.mjs src/panel/chat src/background` -> 1066 tests, pass 1066, fail 0 (run before the line-split edit of one test; the edit was formatting only).
- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json --noEmit` -> no output, exit 0.
- `node scripts/structure-audit.mjs` -> one FAIL remains: `[working-docs] docs/working/README.md is out of date` (the lead's working docs, not mine; I fixed my own statement-packing FAIL).

## Not verified
- No live browser check (Chrome/Firefox); Core's sending side not exercised end to end.
- The tests were not re-run after the formatting edit.
- "No interval" is asserted by spying `setInterval` through the port plus `complete === true`; the widget's `readBeatMs` is not exported, so it was not driven.

## Open questions
None.
