# W4-SEC1: answers require a person's activation

## Outcome

Partial. The extension transport gate and the Core answer-control gate are in place, with tests;
the Lab's Chrome side-panel answering is not converted to trusted input because the press lives
outside the granted directory and Chrome's side panel has no Playwright Page (see Lab driver).

## What changed and why

### 1. Extension transport (worktree `fxwork/t900/!FluxIQWebExtension`, APP = `apps/extension`)

- `APP/src/panel/chat/transport/ports/conversation.ts:27` `conversationPort(request, activation = personActivationIsActive)`;
  `:33-36` `answer` reads `activation()` before its first await and, when false, returns
  `{ ok: false, sentence: "Press the answer yourself to give it." }` (`:12`) and sends nothing.
  Reads, sends and the thread-list calls are not gated.
- `APP/src/panel/chat/transport/ports/person-activation.ts:6` `personActivationIsActive()`:
  `globalThis.navigator?.userActivation?.isActive === true`; absent `userActivation` is false (fails closed).
- Other paths that could send `panelConversationAnswer`: grep of `RUNTIME_MESSAGES.panelConversationAnswer`
  under `APP/src` finds only `conversation.ts` in the panel (the rest is `background/**` and tests).
  `ChatAskPort` (`APP/src/panel/chat/asks/ask-port.ts`) only words questions (`present`), it never answers,
  and the extension supplies no `reauthorize` dialog. `restoringThreadList` (`thread-memory/`) spreads the
  port, so `answer` reaches the background only through the gated function. No other gate needed.
- The failed result has no `code`, on purpose: `code: "refused"` would put Core's controller into its
  "refused this browser" fallback (`controller.ts:233`). Core's card shows its own "Couldn't send your
  answer. Try again." beside the buttons; the returned outcome carries the sentence above.

### 2. Firefox

`navigator.userActivation` (with `isActive` and `hasBeenActive`) is supported in Firefox from **120**,
no flags or notes; Chrome 72, Edge mirrors Chrome, Safari 16.4. Source: MDN browser-compat-data
`api/Navigator.json` (`userActivation`) and `api/UserActivation.json`
(raw.githubusercontent.com/mdn/browser-compat-data/main/...), read 2026-11-10. The Firefox floor is
`strict_min_version: "128.0"` (`APP/manifest.firefox.json:46`), Chrome `minimum_chrome_version: "116"`
(`APP/manifest.chrome.json:6`), so both floors have it and no substitute is needed. BCD does not list
extension popups separately; the popup is an ordinary document, but this was not checked in a live Firefox.

### 3. Core ui-components (worktree `fxwork/t900/!FluxIQ`, `packages/ui-components`)

- `src/chat/conversation/person-event.ts:7` `isPersonEvent(event)`: `event.isTrusted === true`.
- `src/chat/conversation/ask-controls.ts:50` choice buttons, `:64` the Answer button, `:67` Enter in the answer box.
- `src/chat/conversation/presented-ask.ts:54` every host-worded action button (also the one that opens
  the host's PIN dialog), `:86` Send answer, `:89` Enter in the text box.
- These are every chat control that calls the answer path: grep of `context.answer` / `.answer(` under
  `src` finds only these two files plus `turn-controls.ts` (wiring, no events) and the controller. The
  answer turn's foot (`chat/answer/view/foot.ts`, Run again etc.) and `action-card.ts` do not answer asks.
  The host dialog's own submit (`turn-controls.ts:66`) belongs to the host's dialog; the extension has none.
- `src/testing/fake-dom.ts`: `dispatch(type, fields)` now delivers `isTrusted: true` (it has always stood
  for a person's input; `fields` may set `isTrusted: false`), new `dispatchUntrusted(type, fields)`
  (`:125`), and `click()` (`:129`) as `HTMLElement.click()`: an untrusted click, none on a disabled control.
  Existing tests needed no change, because `dispatch` stays trusted by default.

### 4. Lab driver

No file under `packages/test-runner/src/attempt-lane/live/` presses an ask's answer itself:
`attempt-person.ts:68` calls `panel.press(label)`, a `ChatPanelDriver` from
`packages/test-runner/src/extension-chat-check/panel-driver.ts`. `press-run-again.ts` presses Run again on
an answer turn, which is not an ask answer (the results port, not `panelConversationAnswer`), and
`answer-turn-dom.ts:31` only expands a turn; neither was changed.

Every Lab answer goes through `ChatPanelDriver.press` (callers: `attempt-lane/live/attempt-person.ts:68`,
`run-scenario/chat-build/chat-entry.ts:88`, `extension-chat-check/prove/ask-answered.ts:42`):
- Firefox popup, and Chrome when a side-panel Page is found: `pagePanelDriver.press`
  (`panel-driver.ts:53-57`) already uses Playwright `getByRole(...).click()`, trusted input. Unaffected.
- Chrome's real side panel: `open-chrome-session.ts:62-63` falls back to `extensionViewPanelDriver`
  because Playwright 1.51.1 does not hand over the side panel's page (its own `panelNote` says so).
  `panel-driver.ts:151-155` (`inView`, action `press`) answers with `button.click()` from the control
  tab through `chrome.extension.getViews()`. **After this fix those presses are ignored** (untrusted
  event, and no user activation in the panel), so a Chrome Lab run that must answer an ask in the side
  panel will press, then time out in `settled()` (30 s), and the panel shows the answer error.

What is missing: a trusted press into the side panel's target. That file is outside this brief's grant,
so it is not changed. A route that needs no Page: open a CDP session on the control page
(`context.newCDPSession(control)`), `Target.getTargets` for the target whose url is
`${extensionOrigin}/sidepanel/index.html` and is not the control tab, `Target.attachToTarget({ flatten: false })`,
then via `Target.sendMessageToTarget` run `Runtime.evaluate` to get the button's centre and send
`Input.dispatchMouseEvent` `mousePressed`/`mouseReleased` there. CDP input is real input: trusted, and it
gives user activation. The unflattened attach-and-send pattern already exists in
`packages/test-runner/src/perturbations/stop-service-worker.ts:200`. Not built or tried here.

## Tests

- New `APP/src/panel/chat/transport/tests/answer-activation.test.ts`: inactive activation refused; absent
  `userActivation` refused; active sent unchanged; injected reader read for each answer; reads and sends
  not gated.
- New test support `APP/src/panel/chat/tests/user-activation.ts` (puts `navigator.userActivation` in a
  state for one test, restores after).
- `APP/src/panel/chat/tests/chat-panel.test.ts`: the two answering tests now set an active activation;
  new end-to-end test: an untrusted `click()`/`dispatchUntrusted` on Allow sends nothing, and a trusted
  press with no live activation sends nothing and leaves the question waiting.
- `APP/src/panel/chat/transport/tests/ports-send.test.ts`: the answering test sets an active activation.
- Core `src/chat/conversation/tests/ask-controls-keyboard.test.ts`: two new tests (choice; Answer box
  click and Enter), untrusted refused, trusted accepted.
- Core `src/chat/conversation/tests/presented-ask.test.ts`: two new tests (actions incl. the PIN-dialog
  action; open-question Send answer and Enter), untrusted refused, trusted accepted.
  (A separate Core test file was first added and removed: it put `conversation/tests/` over the
  25-file limit.)

## Commands run and observed results

- Core `packages/ui-components`: `pnpm exec vitest run src/chat/conversation/tests/ask-controls-keyboard.test.ts src/chat/conversation/tests/presented-ask.test.ts`
  -> `2 passed`, `Tests 21 passed (21)`. Earlier, with the gates and fake-dom change in place:
  `pnpm exec vitest run src/chat src/screens src/testing` -> `Test Files 114 passed (114)`, `Tests 794 passed (794)`.
- Core build, via the slot: `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t900 -- pnpm build`
  (in `packages/ui-components`) -> waited in the queue, `t900 took slot-1`, `{"build-cache":"build","step":"ui-components:build",...,"ms":111789}`, exit 0;
  `dist/chat/conversation/person-event.js` present, `dist/testing/fake-dom.d.ts:60 dispatchUntrusted`.
- APP: `EXTENSION_TEST_BUILD_LABEL=t900-sec1 node scripts/test-extension.mjs panel/chat panel/shell`
  (after the Core build) -> `# tests 140`, `# pass 140`, `# fail 0`; includes the new end-to-end test
  (ok 21) and the 5 transport tests (ok 61-65). After a final edit to the new transport test:
  `node scripts/test-extension.mjs transport/tests/answer-activation` -> `# tests 5`, `# pass 5`, `# fail 0`.
- Structure audit, extension root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (245 warning(s), 552 baselined).`
- Structure audit, Core root: first run -> 2 violations, both from my first Core test file (26 files in
  `conversation/tests/`, packed statements). Folded into the existing files; re-run ->
  `structure-audit: passed (530 warning(s), 969 baselined).`
- Narrow typecheck (no slot; not the whole package): a temporary tsconfig extending each package's own,
  listing only the touched files, `node node_modules/typescript/bin/tsc -p <it>` -> extension: no output,
  exit 0 (conversation.ts, person-activation.ts, the three touched tests, user-activation.ts); Core: no
  output, exit 0 (the two touched tests, fake-dom.ts). Temporary tsconfigs removed.
- test-runner: none run; no test-runner file changed.

## Not verified

- No live browser: Chrome or Firefox real `userActivation` and `isTrusted` behaviour in the panel or popup.
- The Lab's Chrome side-panel answering (broken by design until the driver change above lands).
- test-runner tests: no test-runner file changed, so none were run.
- Whole-package typecheck of either package (only the touched files and what they import were checked).

## Open questions or contradictions found

- The brief places the Lab answer press in `attempt-lane/live/`; it is in `extension-chat-check/panel-driver.ts`.
  Granting that file (and `open-chrome-session.ts` if the CDP session is set up there) is needed before
  the Chrome Lab can answer asks again.
- The reference test (t902 lane, `background/tests/answer-origin-panel-transport.test.ts`) imports
  `conversationPort` with one argument; that still works (the reader defaults to the browser's own).
