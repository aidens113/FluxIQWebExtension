# Report: ext-chat-panel (E3), lane t185

## Outcome

Done. `apps/extension/src/panel/chat/` is the automation chat window. It has a status header, a stream that interleaves Core's thread turns with live activity rows, `<details>` rows that expand, and a composer. It replaces Simple Mode's conversation card in `simple-view.ts`. The node unit tests, extension `check`, `test` and `build`, and the structure audit all pass for these files. Nothing was run in a browser (machine rule).

## What changed and why

New, `apps/extension/src/panel/chat/`. Each file exports one value, each directory has a barrel, and tests sit in `tests/`:

- `index.ts` is the barrel.
- `chat-panel.ts` has `createChatPanel(request, openFluxIQ)`. It mounts the header, stream, composer and fallback, and it reuses the existing `conversation/{controller,composer,turn,ask-controls}` through the conversation barrel.
  - Polling: the 4 s thread poll is kept. The thread is also read again 300 ms (debounced) after a *new* activity event that carries a `conversationId` or `final`.
  - Reconciliation: the stream is reconciled, not rebuilt. An unchanged turn or row keeps its element and its position. This keeps a half-typed open-question answer, its focus, and any expanded rows intact across pushes and polls.
  - Offline reads: while the page is visible, a failed activity read (for example after a worker restart) is retried on each poll tick.
  - Open FluxIQ buttons: the Open FluxIQ factory is injected by `simple-view.ts`. Importing `simple/open-fluxiq-button` directly broke the barrel rule, and importing the `simple` barrel would create a `simple` <-> `chat` import cycle.
- `chat.css` uses tokens only: the chip tones, the live dot, the overlay segmented control, the stream, and rows with expand markers. The success chip uses `color-mix(var(--success), var(--surface))` because no `--success-soft` token exists.
- `feed/activity-feed.ts` has `createActivityFeed({request, listen}, onChange)`. It works without DOM or `chrome`.
  - It reads `ACTIVITY_MESSAGES.read`, takes `{ ok: true, state }`, and takes `ACTIVITY_MESSAGES.changed` pushes, validating the state's shape.
  - Reach states:
    - `loading`
    - `ready`
    - `unsupported`: the "Unknown FluxIQ extension message." case. It is permanent, is shown as offline, and disables the overlay control.
    - `failed`: shows the reason and is retried.
  - A read reply that was requested before a push arrived is dropped as stale.
  - `setOverlay` sends `{ type: ACTIVITY_MESSAGES.setOverlay, overlay }` and shows whatever state the relay answers with. On failure it keeps the old preference and shows an error sentence.
- `feed/runtime-listener.ts` has `listenToRuntime`, the `chrome.runtime.onMessage` subscription. It is the only file that touches `chrome`.
- `feed/thread-refresh.ts` has `threadRefreshWanted(seen, state)`. Events count as "new" by `activityId#sequence`, not by the highest sequence seen, so events after a Core restart (which resets the sequence) still count. The first state never triggers a read.
- `header/header-model.ts` has `chatHeaderModel(feed, connected)`, which produces:
  - the phase, chip label and tone;
  - Core's label;
  - the step text;
  - the live flag and its reason (`Live`, `Connecting`, `Offline: ...`);
  - the overlay options (Full, Small, Off), each with a selected and disabled state.
- `header/phase-copy.ts` maps each phase, plus `idle`, to its chip label and tone:
  - accent: the working phases
  - warning: `repairing` and `waiting_permission` ("Needs you")
  - success: `done`
  - danger: `failed`
  - neutral: `idle`
- `header/step-text.ts` treats `step.index` as 1-based and produces "Step N of M". It produces "Step N" when N > M or when M is not a positive integer, adds ": label" when the step has one, and returns nothing when the index is invalid.
- `header/header-view.ts` has `createChatHeader(chooseOverlay)`, the DOM header. The overlay buttons use `aria-pressed`.
- `stream/stream-items.ts` has `buildChatStream(turns, recent, limit = CHAT_ACTIVITY_ROW_LIMIT = 40)`.
  - Only events that carry a `detail` become rows.
  - A row that is still open (same `activityId|kind|ref ?? title`, status `started`) absorbs later events in place, so started then succeeded is one row. A finished row is not reopened.
  - The newest `limit` rows are kept.
  - Rows are ordered by time. An unreadable `at` takes the time of the row before it. On equal times a turn goes first, and each list otherwise keeps its own order.
  - A row is expandable when it has text, a ref or a status.
- `stream/turn-clock.ts` has `createTurnClock()`. `CoreTurn` carries no timestamp, so a turn's time is when the panel first saw it.
  - Turns from the first loaded read are history (`-Infinity`) and sort before every activity row.
  - A turn is never timed earlier than the turn before it, and it keeps its time on later reads.
- `stream/activity-row.ts` has `activityRowElement(row, open, onToggle)`. It renders a plain line, or a `<details>` whose summary shows kind, title and status, and whose body shows the title, text, `Ref:` and `Status:`.
- `tests/activity-fixture.ts` is test support shared by the three `tests/` folders.
- Tests (31):
  - `stream/tests/stream-items.test.ts` (9)
  - `stream/tests/turn-clock.test.ts` (3)
  - `header/tests/header-model.test.ts` (6, including step text)
  - `feed/tests/activity-feed.test.ts` (9)
  - `feed/tests/thread-refresh.test.ts` (4)

Edited:
- `panel/simple/simple-view.ts` mounts `createChatPanel(store.request, (style) => createOpenFluxIQButton(store.request, style))` in place of `createConversationCard`, and its header comment is updated.
- `panel/simple/simple.css` loses the card-only rules (`.conversation-live`, `.turns`, `.conversation-fallback`). The turn and composer rules stay because the chat mounts those parts.
- `panel/simple/conversation/index.ts` (exports only) drops the card exports and adds `askControls`, `createComposer` and `turnElement`.
- `panel/simple/conversation/card.ts` is **deleted**. After the swap nothing imported it except the barrel, and it had no tests; its rendering moved into `chat-panel.ts`. The chat keeps the card's hooks: the section class `simple-conversation`, `aria-label="Conversation"`, the `#conversationInput` and `#conversationSendButton` ids (from the composer), and the empty and fallback sentences.

## Commands run and observed results

- Focused bundle of the chat tests, run with esbuild under node:test (scratch script `e3-focused.mjs`, output dir removed afterwards): `# tests 31`, `# pass 31`, `# fail 0`.
- `node scripts/structure-audit.mjs`, run from the repo root before and after: the only FAIL is the pre-existing `[working-docs] docs/working/README.md is out of date`, which is not mine and was present before my edits. There are no findings for `panel/chat` or `panel/simple`. An intermediate run flagged `[imports] chat-panel.ts ... "../simple/open-fluxiq-button"`, which I fixed with the injected factory.
- All three package commands ran through slot-claiming runs (mkdir, an `owner` file, then `rm -rf` in a trap):
  - `pnpm --filter @fluxiq-web-extension/extension check` in `build-slots/b2` at 01:40:30Z: `EXIT 0`. That is tsc on `tsconfig.json` and `tsconfig.test.json`, with no diagnostics.
  - `EXTENSION_TEST_BUILD_LABEL=e3-chat pnpm --filter @fluxiq-web-extension/extension test` in `b1` at 01:43:03Z: `# tests 1210`, `# pass 1210`, `# fail 0`, `EXIT 0`.
  - `check && build` again in `b1` after a final header edit: `EXIT 0`, with "chrome: verified 22 files", "firefox: verified 22 files" and "e2e-chromium: verified 22 files" (plus the existing gecko.id placeholder warning).
  - The built `build/sidepanel/index.css` contains the chat rules (5 matches for `chat-phase`).
- `grep innerHTML|insertAdjacentHTML` under `panel/chat`: none.

## Not verified

- No live rendering in a browser: layout, the light and dark look, scroll-stick, `<details>` toggling, reconciliation keeping focus, and receiving real pushes were not exercised. The brief forbids browser, Playwright, Lab and e2e runs.
- The chat against a real background and Core: the E1 relay was read for its shapes but not exercised end to end. The E1 files were not edited.
- `chat-panel.ts`, `header-view.ts`, `activity-row.ts` and `runtime-listener.ts` are DOM or `chrome` code and have no unit tests, because the node runner cannot load DOM modules. Their logic lives in the tested models.
- How closely the look matches the Core panel's chat header: C3 is building that in parallel, so I matched the description in the brief, not Core's code.

## Open questions or contradictions found

1. **Turn times are approximate.** `conversation/core-thread.ts` (not mine) drops Core's turn `createdAt`, so turns are placed by the time the panel first saw them. With the 300 ms push-triggered read the error is small, but a turn Core wrote before an activity event can land after that event's row if the read lags. The fix is for `parseTurn` to keep `createdAt` and for `turn-clock.ts` to prefer it; that is a one-line change in each file.
2. **The brief's "Must not touch" conflicted with the permission to delete `card.ts`.** I followed the later permission (nothing imports it and it had no tests) and deleted it. `git checkout -- apps/extension/src/panel/simple/conversation/card.ts` restores it if unwanted, along with its two barrel exports.
3. The relay's `live` flag and the extension's `connectionState` are both required for "Live". If Core is connected but did not advertise `fluxiq.activity`, the header says "Offline: FluxIQ is not streaming activity".
