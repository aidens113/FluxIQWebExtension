# ext-ws-b: Workstream B -- the simple view

Status: DONE (pending supervisor integration: mounting the view in `sidepanel/index.ts` and the popup).
Spec: `ext-ui-audit.md` section 4, section 5 "Contracts" and "Workstream B". Builds on `ext-ws-a.md` (commit d447ca70).

## Outcome

Done. All of `apps/extension/src/panel/simple/**` is written, type-checks in both the source and the test
projects, bundles, and its unit tests pass. The session was cut off twice (a machine crash, then a session
restart). After the crash, `conversation/turn.ts` and `conversation/ask-controls.ts` were all NUL bytes
(0x00, 1152 and 2645 bytes) and were rewritten from scratch. `conversation/draft-storage.ts`, left by the lost
session, was rewritten because it dodged the failure-as-empty audit with `String(error) === "" ? "" : ""`.
After the restart, every file was intact (NUL count 0 across all 32 files).

## What changed and why

Sources (`apps/extension/src/panel/simple/`):
- `index.ts` exports `mountSimpleView` only. `simple-view.ts` mounts the four cards from the one PanelStore
  status. A 1-second tick drives the recording clock, the one-minute "Done" window and Stop's wait. The tick
  and the conversation polling run only while the view is shown, and stop on `pagehide`. `simple.css` is sized
  for the Firefox popup's 600px height, and only the conversation turns scroll.
- Status card: `status-card.ts`, `status-controls.ts` (buttons and link for each row of the audit's status
  table), `pairing-card.ts`, `open-fluxiq-button.ts`, `sticky-error.ts` (an error ends when its cause ends,
  never sooner and never later).
- Now card: `now-card.ts`, `now-copy.ts` (the "Right now" table, including which row wins), and `run-stop.ts`.
  Stop sends `panelStopRun` and never disconnects. `unsupported` means the background doesn't handle the
  message; for it, the card permanently falls back to "To stop this, use FluxIQ." and Open FluxIQ. Other
  failures, "nothing to stop", and a step that hasn't stopped after 20 s each show a sentence plus Open FluxIQ.
  Each of those states ends when the run does.
- Manual actions: `manual-actions.ts`, `record-control.ts`.
- Conversation (`conversation/`): `controller.ts` holds no DOM and no local copy of the conversation. It keeps
  only what is on screen, and Core's answer replaces it after every send and answer. It reads the newest open
  thread (`list`, open, limit 1), skips the read when the thread's revision hasn't changed, and keeps the last
  `TURN_WINDOW` turns via `thread-tail.ts`, reading forward from an anchor turn. Also `core-thread.ts` (parses
  Core's replies), `ask-copy.ts` and `ask-controls.ts` (grant, deny, choice or text answers, or "Answer this in
  FluxIQ."), `turn.ts`, `composer.ts` (Enter sends, Shift+Enter adds a line, the words stay until FluxIQ has
  them) and `draft-storage.ts` (keeps the unsent draft in `localStorage`; only a `DOMException` is absorbed,
  anything else is rethrown). `card.ts` renders it all.
- The first message uses the relay's no-`conversationId` path, which opens a thread and then appends to it.
  No `start-conversation` anywhere, and `open-conversation` (`kind: "open"`) isn't needed.

Changes from the coordinator's 2026-09-28 update (PanelResult `code`):
- `refused` (FluxIQ rejected this browser's token) is now told apart by `result.code`, never by parsing the sentence.
  - Conversation: the mode `unsupported` is renamed `fallback`, and `ConversationState.fallbackReason` is
    `"unsupported" | "refused"`. A refused read, send or answer shows the "Talk to FluxIQ in the FluxIQ window."
    fallback, not a "Try again" message that retrying can't satisfy. `refused` clears when the connection
    drops, because pairing again reconnects; `unsupported` lasts as long as the card is mounted. The card stops
    polling only for `unsupported`.
  - Stop: `refused` removes the button and shows "FluxIQ didn't let this browser stop it." with Open FluxIQ,
    until the run ends. Any other code (`unreachable`, `failed`, and so on) is an ordinary failure that keeps
    Stop pressable.

Tests (`panel/simple/tests/`, `panel/simple/conversation/tests/`): `status-controls`, `now-copy`,
`record-control`, `run-stop`, `sticky-error`, `controller` and `ask-copy`, each checking its audit table one
row per assertion. Support files: `status-fixture.ts` and `fake-core.ts` (a fake Core behind the relay reply
envelope, which pages `get` forward from `sinceTurnId`).
Two exported types gained `| undefined` on optional fields (`readError`, `sendError`, `sentence`, `detail`)
because the repository compiles with `exactOptionalPropertyTypes`.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/extension) -> exit 0.
- `node scripts/check-extension.mjs` (apps/extension; both tsc projects plus in-memory bundling) -> first run:
  2 errors, both in my tests (`controller.test.ts:208` object spread widened to the `PanelResult` union;
  `run-stop.test.ts:38` comparison narrowed away by an earlier `assert.deepEqual`). Fixed -> exit 0, no output.
- `EXTENSION_TEST_BUILD_LABEL=ext-ws-b node scripts/test-extension.mjs`:
  - run 1: 990 tests, 989 pass, 1 fail: "a read error before anything loaded never claims there is no
    conversation", expected `loading`, got `empty`. The test's setup was wrong, not the controller:
    connecting starts a read and the awaited `refresh()` queues a second one, which succeeded against the
    fail-once fake. I rewrote the test with a request that always fails.
  - run 2: 990 tests, 990 pass, exit 0. The new `refused` tests ran (ok 776, 777, 778, 799) alongside
    ok 815, which checks that "panelRequest keeps the background's failure code".
  - run 3 (after the two test-file type fixes): 990 tests, 988 pass, 2 fail. Both failures are in
    `content/actions/tests/extract-list-paging-account.test.ts` (tests 429 and 430, pagination
    `control_absent` wording). I don't own that file. It and `actions/extract-list.ts` and
    `extraction/list-reader.ts` were modified at 18:21:40-18:21:52, between runs 2 and 3, so another worker
    was editing them. Every panel/simple test passed in run 3.
- `node scripts/structure-audit.mjs` (repository root) -> exit 1. Its one violation: "[working-docs]
  docs/working/README.md is out of date with the documents' header blocks. Run pnpm structure:baseline". That
  file is a shared document, so I left it alone. No finding names any `panel/simple` file. The other lines are
  advisory `file-lines` warnings about files outside my scope.

## Not verified

- The view isn't mounted by any entry yet: `sidepanel/index.ts` and the popup still use
  `placeholder-views.ts`. So `simple-view.ts` and `simple.css` haven't gone through the entry bundling, and
  nothing was tested in a browser (Chrome side panel or Firefox popup): layout within 600px, focus, the
  Enter/Shift+Enter behaviour, scroll anchoring, the draft surviving popup close.
- The DOM modules (`card.ts`, `composer.ts`, `turn.ts`, `ask-controls.ts`, `now-card.ts`, `status-card.ts`,
  `manual-actions.ts`, `simple-view.ts`) have no unit tests. Only their DOM-free logic is tested.
- Against a live Core: that the relays return `runtimeSessions: []` for "nothing to stop", and that a refusal
  reaches the panel with `code: "refused"`. Both rest on the protocol types and Workstream D's tests.

## Open questions or contradictions found

- Wording for `refused` ("FluxIQ didn't let this browser stop it.") is mine; the audit has no row for it.
  In the conversation card, `refused` reuses the `unsupported` fallback text, with no extra line explaining why.
- `docs/working/README.md` needs `pnpm structure:baseline` (supervisor).
- `extract-list-paging-account.test.ts` tests 429 and 430 were red at 18:23 while another worker was editing
  extraction. Worth checking once that worker finishes.
