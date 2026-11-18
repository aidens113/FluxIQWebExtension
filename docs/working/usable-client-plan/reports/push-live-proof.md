# push-live-proof (task t923)

## Outcome
Done. The approved-client live proof now carries two checks groups (9 new named booleans, 29 in all). Two consecutive live runs exited 0 with every check true.

## What each check does, and why it proves push
All in `packages/test-runner/src/extension-chat-check/prove/approved-client/`.

1. `panel-turn-push.ts` (`provePanelTurnPush`), run right after the proof's first two checks, while no model key is configured (so no model call is made and the loopback model fixture is not asked about it).
   - The chat the person sees (Chrome side panel) sends a first turn; the proof marks the side panel's live document (`markDocument`).
   - Quiet window: it waits until the extension has made no thread read (`get-conversation` / `list-conversations`, as recorded by the proxy in front of Core, bearer calls only) for 8 s, bound 60 s. A read timer shorter than 8 s keeps the chat from ever being quiet, so the check fails.
   - It then writes a turn into the same chat as the signed-in person, through Core's `append-turn` with the person's session (the control client), which is the request the web panel makes. The extension is not involved in the write.
   - It waits (bound 30 s) for the open side panel to show that turn's text.
   - Booleans: `panelTurnPush:chatWasQuietBeforeTheWrite`, `:turnReachedTheOpenChat`, `:chatReadAfterTheWrite` (the extension made a read after the write, none before it for 8 s, so the read was caused by the write), `:chatWasNotReloaded` (the mark on the panel document survived, so nothing reloaded or reopened it). If the turn never arrives, `turnReachedTheOpenChat` is false and the run exits 2.
2. `panel-stream-reconnect.ts` (`holdPanelChatPage`), wrapped around the proof's existing `restartCore`.
   - Before the restart the proof signs in and opens `/chats/<conversationId>?project=<id>` of the same chat as a web panel page (new tab, signed-in cookie), waits for that chat's turn to show and for its `GET /api/panel/changes` stream to answer 200, and marks the page. The page is never navigated or reloaded afterwards; main-frame navigations are counted.
   - After Core restarts and the extension's model probe passes, it waits for the page's stream to answer 200 again (a response after the restart began), waits for the page to show a turn made while the stream was down (`Approved client access confirmed: after-core-restart`), then writes a new uniquely worded turn as the person and waits for the page to show it.
   - Booleans: `panelStream:openedBeforeRestart`, `:reopenedAfterRestart`, `:caughtUpAfterReopen`, `:showedChangeMadeAfterRestart`, `:pageWasNotReloaded` (marker survived and zero navigations).
   - Observations recorded in the result: `panelTurnPush` (quiet ms, arrival ms, reads after write) and `panelStream` (openings before and after, catch-up, arrival ms).

## Files changed (all under packages/test-runner/src/extension-chat-check/)
- New: `prove/approved-client/push-evidence.ts`, `panel-turn-push.ts`, `panel-stream-reconnect.ts`, `prove/approved-client/tests/push-evidence.test.ts`.
- Edited: `prove/approved-client/prove.ts` (wiring, two new inputs `writePanelTurn`), `observation.ts`, `run-chat-check.ts` (supplies `writePanelTurn` via `control.automationStudioCall("append-turn", ...)`), `panel-driver.ts` (`markDocument` / `documentIsMarked` on both drivers).
- `model-fixture/` is unchanged (a panel-written turn makes no model call; I tried a fresh-chat variant that assumed otherwise and reverted it).

## Commands and observed results
- Setup: `pnpm build` finished ("apps/extension build ..."), `node domain/scripts/build-web-panel-host.mjs` -> "Built web panel host module".
- `node --test` on model-fixture, prove/approved-client tests and extension-chat-check tests (built dist) -> `# tests 31 # pass 31 # fail 0` (includes the new push-evidence tests: read filtering, quiet window incl. a steady timer never being quiet, stream reopening needs a 200 after the restart).
- `pnpm --filter @fluxiq-web-extension/test-runner check` -> completed without error (the following build and live runs were chained with `&&`); last edit followed by a passing check and a full build (stored 2866 files).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (251 warning(s), 551 baselined).`
- Live, twice, `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key`, headed, no provider (loopback fixture only):
  - Run A: exit 0, `failure:null`, all 29 checks true. Evidence `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-17T23-05-30-433Z-chrome`. Log: quiet after 10272 ms, panel turn shown after 646 ms (6 reads after the write), stream reopened, caught up, post-restart turn shown in 879 ms.
  - Run B: exit 0, all 29 true. Evidence `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-17T23-07-14-258Z-chrome`. Quiet after 10123 ms, panel turn shown after 692 ms (6 reads), post-restart turn shown in 903 ms.
  - Earlier iterations (each exit 2, the other 28 checks true) are what shaped the stream check; evidence dirs `...T22-26-01`, `T22-36-50`, `T22-47-27`, `T22-53-56`, plus one more at about 23:00.

## Finding (product, not fixed, not in my paths)
The web panel's Chats list page (`/chats`, Core `apps/web/src/features/chats/ChatsPage.tsx`) does not refresh over the change stream. Held open across the restart with its stream reopened, its row stayed at "10 messages" while Core held 12 and then 13 turns (read as the person through `get-conversation`). Screenshots: `panel-stream-reconnect-page.png` in `...T22-47-27-246Z-chrome` and `...T22-53-56-741Z-chrome`. The page loads once with `useLoaded` and has no subscription to the changes port. The chat thread page (`/chats/<id>`, which hosts the chat widget) does update, which is why the proof holds that page. Whether the list should update is a Core decision.

## Not verified
- Firefox (popup driver has the new mark methods but was not run); only Chrome side panel.
- The quiet window proves absence of a read for 8 s, not that no timer longer than 8 s exists; a timer that long would still be caught only if the push check read no change after the write (it reads 6 times right after the write).
- That `panelStream:reopenedAfterRestart` was triggered by EventSource's own retry rather than a visibility wake: the page was not reloaded either way.
- The proof's final lines of the earlier `pnpm check` exit code were not printed separately.
