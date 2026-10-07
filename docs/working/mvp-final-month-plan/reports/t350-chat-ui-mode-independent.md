# t350 chat and overlay defects that persist in both authoring modes

Worker: t350-chat-ui. Trees: `fxwork/t350/!FluxIQWebExtension` and sibling `fxwork/t350/!FluxIQ`, both on
`task/t350-chat-ui-mode-independent`. Nothing committed.

## Outcome

Mostly done. D6, D7, D9, D11 and D12 are fixed, each with a test that failed first. D4 is fixed for the case where a
name exists (moment 12, the "Quantity" press). The other two D4 cards (03 and 08) stay unnamed, because that link
has no name anywhere on the page (see below). No browser or Lab run was done.

## Files listed before editing

Downstream: `apps/extension/src/content/activity-overlay/fit-line.ts`, `placement/choose-placement.ts`,
`placement/page-probe.ts`, `panel/chat/stop-control.ts`, `panel/chat/chat-panel.ts`, `panel/chat/chat.css`,
`panel/chat/stream/step/{done-again.ts (new), messages.ts, action-card.ts, index.ts, words.ts}`,
`panel/chat/stream/index.ts`, `panel/chat/view/{done-again-view.ts (new), step-message-view.ts, index.ts}`,
`shared/activity/wording.ts`, plus their tests.
Core: `packages/fluxiq/src/programs/automation-studio/runtime/activity/observer.ts`,
`runtime/activity/wording/draft-edit-card.ts`, `packages/fluxiq/src/ui/activity-action/names.ts`, plus their tests.
I did not touch `runtime/conversations/**`, runtime host configuration, the Lab, candidate code or `docs/working/*.md`.

## What changed and why

- **D4: cards with no target name (Core `activity/observer.ts`).** Cause, from the evidence of step 0139
  (`rerun.10.2`, a press on handle `t964`): the observer asks the domain for a call's words once, before the
  call runs. The replays had just reloaded the page, so the handle could not be resolved at that moment and nothing
  was named. The node run then took its own look, after which `t964` read as `field "Quantity"`. The fix is
  `namedAtEnd`: when the words taken before the call name no control, the observer asks again at the call's end.
  The end row then reads "Clicking “Quantity”", and the panel card takes the end's target (`messages.ts` already
  prefers it). The overlay's end line becomes "Trying again: clicking “Quantity” — done". This partly covers D5,
  but only at the end; the "started" line is unchanged.
  **Not fixed:** screenshots 03 and 08 (first card). The target there is `t644 link ~/item/1005008123450` in
  `steps/0010/page.txt`, a link with no accessible name and no text. No name exists, so the card stays "Click".
  Naming it by its role ("a link") would need a new field in the domain's call words; I did not do that.
- **D6: the overlay truncated a short name (`fit-line.ts`).** A cut never falls inside a name in curly quotes. If the
  line cannot keep the name, the words before the colon are dropped first: "Checking an earlier step is still
  done: clicking “Get coupons”" becomes "Clicking “Get coupons”". The old word cut is kept as the last fallback.
- **D7: replays repeated full success cards (new `stream/step/done-again.ts`, `view/done-again-view.ts`).** Within
  one message, two or more cards in a row that each finished a step the same work had already done (same kind,
  same named target, same test mark) fold into one closed `<details>` line, for example "Did 3 earlier steps
  again: Accept all, 7-in-1 and Spain". It opens to show each card. It keeps the first card's key and place, and
  it stays open while more steps join it. A single repeat stays its own card, and so does a card that is still
  running, failed, was refused, or has no name. `ActionCard` gets an optional `again` field.
- **D9: no Stop during "Starting…", and Stop looked like plain text.**
  - `stop-control.ts` now shows "Stop" while the send says "Starting…". `chat-panel.ts` passes `display.kind ===
    "starting"`.
  - A press at that point is held ("Stopping as soon as it starts.") and sent for the first live work Core
    reports. If the send starts nothing, the press is dropped.
  - Cause of the plain-text look: `.chat-stop` used `var(--border)`, which no stylesheet defines. That made the
    border declaration invalid, so a white button sat on the white dock. It is now a rounded button with a stop
    mark, centred on the chat column, using defined tokens.
  - New `panel/tests/css-tokens.test.ts` fails the build if any panel stylesheet reads an undefined custom property
    with no fallback.
- **D11: the overlay jumped and covered the cookie banner.**
  - Jumping: `choose-placement.ts` now keeps the place it already holds, on a busy page too, while nothing fixed is
    under it. Text scrolling under it no longer moves it. On the item page it had hopped between y 572 (above the
    bar) and y 327 (the left midpoint).
  - Covering the banner: `page-probe.ts` used to treat a full-viewport scrim as hiding everything beneath it, so
    every corner read as clear. Where only the scrim's bare surface is at a point, it now looks beneath through
    `elementsFromPoint`, and the cookie banner under the scrim counts as fixed.
- **D12: one word for one action.** "Changing the Flow" is used everywhere:
  - Core edit card title (`draft-edit-card.ts`): was "Editing the Flow".
  - Overlay (`shared/activity/wording.ts`): was "Updating the Flow".
  - Panel step words (`words.ts`): was "Updating the draft automation".
  - The card name (`names.ts`) becomes "Change the Flow" (was "Edit the Flow").
  - Test assertions were updated in both repositories. Old quotes from past runs in comments were left as they were.

## Commands run and observed results

- Fail-first (each new test ran before its fix, with the narrow runner
  `node <scratchpad>/t350-run-tests.mjs <tests>`):
  - `fit-line.test.ts`: 1 fail, actual "Checking an earlier step is still done…".
  - `choose-placement.test.ts`: 2 fails, on the held docked place and the held midpoint.
  - `page-probe.test.ts` run against the HEAD `page-probe.ts`: 1 fail.
  - `stop-control.test.ts`: 1 fail ("Stop shows during Starting…", hidden expected false).
  - `css-tokens.test.ts`: fail, listing `chat.css: var(--border)`.
  - `words.test.ts` and `wording.test.ts`: fail, actual "Updating the draft automation" and "Updating the Flow".
  - `done-again.test.ts` with the fold switched off: 2 fails.
  - Core: `npx vitest run` over the activity and activity-action tests: 10 fails before the D12 source change. The new
    observer test failed before `namedAtEnd`.
- After the fixes:
  - Downstream, every test under `panel/`, `content/activity-overlay/` and `shared/activity/` through the same
    bundling as `test-extension.mjs`: `# tests 837 # pass 837 # fail 0`.
  - Core `npx vitest run src/programs/automation-studio/runtime/activity src/ui/activity-action`: 33 files and 439
    tests passed.
  - Core web `npx vitest run src/features/automation-studio/conversation/activity`: 6 files and 46 tests passed
    (after rebuilding Core; the first try refused because the library build was behind its source).
- Typechecks, all exit 0 with no output:
  - Core `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` (non-incremental).
  - Extension `npx tsc -p tsconfig.json --noEmit`.
  - Extension `npx tsc -p tsconfig.test.json --noEmit`.
- `pnpm build` in Core `packages/fluxiq`: built (twice; the second time after line endings were restored).
- `pnpm --filter @fluxiq-web-extension/extension build`: chrome, firefox and e2e-chromium each "verified 22 files".
  Firefox shows the known placeholder gecko.id warning.
- Structure audits:
  - Core `node scripts/structure-audit.mjs`: "passed (287 warning(s), 509 baselined)". It also printed "1 baseline
    entries can be lowered", which I did not investigate or change.
  - Downstream: "passed (176 warning(s), 182 baselined)". The only warning on a touched file is `chat-panel.ts` at
    425 lines (424 before, advisory).
- No new `as never`. The new stop-control tests use a typed `accepting` relay instead.

## Not verified

- No browser and no Lab run, provider-free or otherwise, so I have no before and after screenshots. Not seen in a
  browser:
  - the new Stop button style and "Starting…" Stop;
  - the folded "Did N earlier steps again" line and its disclosure styling;
  - the overlay keeping its place on the item page;
  - the scrim look-through on the live page;
  - the end-of-call "Quantity" name.
- The full suites were not run (per the twice-daily rule). Only the tests in the touched directories ran.
- D4's re-ask is proven against a scripted describer. That the live domain resolves `t964` after the node run's look
  is inferred from step 0139's `page.txt`, not reproduced.

## Open questions or contradictions found

- D4 cards 03 and 08 are a link with no name on the page. The brief's premise ("the name exists") holds for moment 12
  only. Naming nameless controls by role would be a domain and Core words change.
- D12 changes Core's shared card name to "Change the Flow". Core's web panel and any other client reading
  `ACTIVITY_ACTION_NAMES` change with it.
- Line endings: Python edits on this machine wrote CRLF. I restored every touched file to the LF it has in HEAD and
  checked by script.
