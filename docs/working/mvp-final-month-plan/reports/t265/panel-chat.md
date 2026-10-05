# t265-panel-chat report

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t265/!FluxIQWebExtension`, branch `task/t265-extension-ui-integration`. All edits under `apps/extension/src/panel/chat/`. LF endings checked: no CR in `panel/chat`.

## Outcome

Done for the chat work. All 191 tests in the brief's scope pass. The extension check reported errors only in the background worker's files (`background/activity/send-start.ts` and its test). It reported none in my files. The re-run exited 0.

## What changed and why

### Defect 1: the composer kept the text (decision 1)

- `conversation/composer.ts`: this uses w83's (t194) rule. The words leave the box and the kept draft at once, before `send` is called. A failed send puts them back only if the box is untouched: same owner, owner still current, no edit, fill or owner change since (`sentRevision === editRevision`), and the box still empty. From F7 (t193) I took one more piece: a send that *rejects* also counts as failed and restores the words through the same rule. w83 only re-enabled the button in that case. The composer's own send-error `notice` element, and its render code, are removed. t262's scope placeholders, `scopeState` gating of `enabled`, and parked `box.readOnly` are unchanged.

### Defect 2: a failed send disappeared (decision 1)

- `conversation/core-thread.ts`: adds `CoreTurn.sendError?`. Core never sets it; only the panel does.
- `conversation/controller.ts`: adds a local person turn `outgoing` (`local-send:<n>`). It is appended to `state().turns`, and `mode` becomes `thread` once it exists, so a first message never shows the welcome screen.
  - **When it is created:** only after every refusal check, including t262's `target.projectId !== undefined && scopeState !== "ready"`. A refused send leaves no turn.
  - **When a send fails:** a failed request, or t262's opened-in-the-wrong-project error, keeps the turn and sets `sendError` on it (`keepFailed`). A fallback (unsupported or refused) drops the turn, because the whole card then says why.
  - **When it is replaced by Core's turn:**
    - w83's rule: a good read holds a person turn that was not there at send.
    - Hardening, generalised from A9: when Core accepts the send, the turn records `deliveredAfterRead = readsStarted`. Any good read *started* after that drops the turn, even if Core's turn was not recognised. This is the brief's "refresh whose read succeeded" case. It also covers a post-send read that failed and was followed by a good poll, so the turn cannot linger.
    - Reads are serialised, so `readsStarted` at `settle` identifies the settling read.
  - **When it is cleared:** a new send replaces it. `setTarget` to another thread and `setConnected(false)` also clear it. A send whose target changed meanwhile drops it.
  - The header comment, which said there were "no local turns", is rewritten.
- `view/message-view.ts`, `view/thread-view.ts` and `chat.css` (w83): a turn with `sendError` draws `p.chat-send-error[role=alert]` under its bubble. The thread-view signature includes `sendError`, so the error appears or disappears on re-render.

### Defect 3: the chat stopped following (A9, t174)

- `view/scroll-follower.ts`: only the person's input can end following. That means a wheel, touchmove, a scroll key that is not typed into a field, or a scroll-bar drag (pointerdown whose target is the scroller itself) within `PERSON_SCROLL_MS = 1000`. Any other scroll that moves the view off the bottom, such as Chrome scroll anchoring, sends a follower back to the bottom. `ScrollHost` gains the general `addEventListener` and an optional `ownerDocument`.
- `tests/fake-dom.ts`: the fake document gets `addEventListener` and `removeEventListener`.
- `tests/navigation-focus.test.ts`: the three simulated reader scrolls now dispatch `wheel` before `scroll`.
- `view/tests/scroll-follow.test.ts`: A9's host splits `scroll` (the person) from `shift` (the browser), plus two new tests.

### Item 3: t194's `messages.test.ts` addition

Added, and it passes on this tree: "a failed run's last message says what came back and why it failed".

## Tests adapted or dropped, with reasons

- **New file `conversation/tests/outgoing-turn.test.ts`.** w83's file, copied with LF endings, plus two tests of mine:
  - "a delivered message's local turn goes with the first good read after it, even when Core's turn is not recognised" (the hardening, including a failed post-send read followed by a good refresh).
  - "a send refused for an unready project chat leaves no turn behind" (t262 scope gating).
- **`composer-draft.test.ts`:**
  - w83's change to the "failed" scenario is applied: no "Try again" text in the composer.
  - F7's two assertions are folded in: the box and the kept draft are empty right after send.
  - A9's identical "box empties at once" assertion is dropped as a duplicate.
  - A9's test "a send that fails puts the words back in front of anything typed meanwhile" asserts A9's alternative. It is **adapted** to "a send that fails keeps what was typed meanwhile, and never merges the two": the box keeps "and more", not "submitted\nand more".
- **`composer-owner.test.ts`:**
  - w83's rewrite of the old-owner test is applied.
  - F7's version is kept as a separate test because it covers more: the new owner's own failed send restores into its own box, and the kept draft is `{text: "", owner: "a"}` right after send.
  - A9's version of the same old-owner test is dropped: it asserts the same behaviour as w83's.
- **`controller.test.ts`:** A9's D10 test is **adapted**. The first half (in the thread at once, exactly once, replaced by Core's turn) is kept, with the id prefix `sending:` changed to `local-send:`. The final assertion, that the failed message is not left in the thread, asserted A9's alternative. It now checks that the message stays once, as a person turn with `sendError` "Couldn't send that. Try again.".
- **Not touched, per decision 3:** A9's and w83's `view/tests/action-card-view.test.ts` hunks and A9's `stream/step/tests/card-words.test.ts` hunk. F7's `messages.test.ts` change was not applied because the brief names only t194's addition.

## Commands run and observed results

- `sh <scratchpad>/t265pc-run.sh` runs `run-subset.mjs` with the **absolute** package dir. The relative `apps/extension` made `createRequire` throw `ERR_INVALID_ARG_VALUE`. It then runs `node --test` on the 26 printed bundles, which cover every test under `panel/chat/conversation/tests`, `panel/chat/view/tests` and `panel/chat/tests`, plus `stream/step/tests/messages.test.ts`.
  - Result: `# tests 191 # pass 191 # fail 0`, exit 0.
  - An earlier run had 1 failure, in my own scope test: the setup let the second read succeed. I fixed the test, not the code.
  - A mistyped `sed` once made `node --test` run with no files, so it began discovering the whole tree. I stopped it (TaskStop). It wrote no tracked files; `git status` shows only my files and the background worker's.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 1. Its only errors were TS2353 and TS2339 (`'kind' does not exist in type 'ActivityDisplay'`) in `src/background/activity/send-start.ts(77,7)` and `src/background/activity/tests/send-start.test.ts(66,52)` and `(76,72)`. Those files belong to the concurrent background worker. No error was reported in `panel/chat/**`.
- Re-run of the check: exit 0, with no TS errors (the other worker had fixed `send-start`). Build-cache line: "not stamped, because inputs changed while it ran (apps/extension)". The concurrent worker was still editing.

## Not verified

- Live browser behaviour: no Lab or browser run, as the brief requires.
- The type check of my files is clean only as far as the check reported. tsc lists every error, so my files had none, but the check never finished green because of the other worker's errors.

## What a live run must look at

1. **Composer kept text:** after pressing Enter, the box is empty at once and a person bubble appears in the stream while "Sending" shows. Reopen the popup: the draft is empty. A first message in a new or empty chat shows the bubble, not the welcome screen.
2. **Failed send:**
   - Force a send failure, for example by stopping Core mid-send or using a refused relay. The bubble stays, with a red "Couldn't send that. Try again." under it. The composer shows no error.
   - If nothing was typed meanwhile, the words come back to the box. If something was typed meanwhile, the newer typing stays and nothing is merged.
   - Sending again replaces the failed bubble.
   - After a good send, exactly one person bubble remains, which is Core's. There is never a duplicate or leftover local bubble, even when the read right after the send failed.
   - A project chat that is still loading or in error accepts no send and shows no bubble.
3. **Chat stopped following:** during a long build with nobody touching the panel, the stream stays at the bottom through card shrink and grow and through the hand-off question at the end. A wheel or PageUp scroll, or dragging the scroll bar up, still stops following and shows "Jump to latest". Clicking a card's button does not stop following.

## Open questions or contradictions

- **Hardening rule widened.** Decision 1 says to drop the turn "after a successful send's refresh whose read succeeded". I applied it as "any good read started after Core took the send". This covers that case and the case where that refresh failed. If the supervisor wants the narrower rule, the change is one condition in `settle`.
- **`run-subset.mjs` needs an absolute package dir** on this machine (`createRequire` rejects `apps\extension\package.json`).
