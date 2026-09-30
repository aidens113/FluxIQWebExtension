# Report: t191-r3-wb (worker), every step is its own chat message

## Outcome

Done. The chat shows every explained decision, repair and check as its own FluxIQ message, with its reason. The action that follows a decision appears as a quiet outcome line on that message. Folds, disclosures and step counts are gone.

The background now keeps each recent unit of work whole (`history`), so a long build stays in the chat after it settles.

Extension `check`, `test` (1502 of 1502 passing) and `build` all pass, and so does the structure audit. There was no browser run and no Lab run, as the brief said.

## Design

### Stream (brief items 1 and 2)

The message builder is `panel/chat/stream/step/messages.ts` (`stepMessages`). It reads events in the order they arrived.

**What becomes a message:**

| Kind | Source |
| --- | --- |
| `decision` | A `thought` with text. Title is Core's action and text is its reason. |
| `repair` | A `thought` in phase `repairing`. Text is the diagnosis. |
| `check` | A `check`. Its title reads "Checked the result" or "The result didn't pass its check", and its text is the verdict. A check that `started` is updated in place when it ends. |
| `step` | A run step ("Step 2: Open results"), and the build's failure marker. |
| `ask`, `note` | Core's words. |
| `action` | A `tool` with no decision before it, for a Core that does not explain its steps yet. It is worded by `stepWords` ("Clicked on the page"). |

**What is not a message:**

- the decide-start event (`thought` "Deciding the next step", with no text); the live line keeps "Thinking about the next step";
- a pure status change;
- the build's start and finish markers;
- Core's bookkeeping (`isInternalStep`).

**Outcomes.** The `tool` events after a decision attach to it as its outcome (`stream/step/outcome.ts`, `outcomeWords`):

- "Working on it" while the action runs, shown only on the newest message of the unit that is still working;
- then "Done" or "Didn't work", with Core's sentence when it is in words ("Didn't work. The field was covered by a banner."); result codes are dropped;
- a check reads "Passed" or "Didn't pass";
- an action that never said it ended shows no outcome line once the work moved on or settled.

A decision carries one action. A second action becomes its own `action` message.

**Keys and stability:**

- Each message's key is `step:<activityId>#<sequence>` of the event that opened it.
- Its `at` is that event's time and never changes, so a message is placed once and never moves.
- `view/step-message-view.ts` updates text and attributes in place, and `thread-view.ts` reconciles with `placeChildren`. A message is never remounted.
- The live line is always the last child.
- Scroll-follow is unchanged: it follows only while the person is at the bottom (`createScrollFollower`).

**Removed:**

- `stream/activity-rows.ts`, `stream/thread-entries.ts` (`WorkFold`), `stream/work-summary.ts` and `view/work-disclosure.ts`, with their tests;
- the `workSlot` of the message view and the live line;
- the fold CSS.

`stream/step-words.ts` moved to `stream/step/words.ts`. The structure audit requires this because three files shared the `step-` prefix. `stream/step-filter.ts` moved to `shared/activity/internal-step.ts` because the background uses it too.

### Keeping the whole unit (brief item 3)

- **Where `recent` lives.** `background/activity/activity-relay.ts` held `recent`, the last 60 events of every kind. It is unchanged.
- **New `background/activity/unit-history.ts` (`UnitHistory`).** It keeps, for each unit, every event with a detail: explained thoughts, tools, checks, steps, asks and notes, plus the unit's final event. It leaves out text-less thoughts and bookkeeping.
- **Bounds.** `shared/activity/history-limits.ts`, `ACTIVITY_HISTORY_LIMITS = { units: 10, eventsPerUnit: 500 }`. The newest events are kept. Units are ordered by the last time they were heard from, and the stalest is dropped first. Events stay in arrival order across units, which is also correct across a Core restart, where sequences start again.
- **State.** `ExtensionActivityState.history?: ClientGatewayActivity[]` is optional, so the tests I don't own that build a state still typecheck, and a panel facing an older background falls back to `recent`.
  - The relay sets it on every `state()`.
  - The panel feed accepts a state with or without it.
- **Unchanged.** The pacer, the display and the overlay messages: the pacer still receives every event.
- **Panel side.** `stream/target-activity.ts` returns `events` (renamed from `recent`), taken from `history ?? recent`. The same thread and automation filters apply. The "another thread" rule now looks at both lists.
- **Placement after settling.** Messages stay after the build settles, placed by Core's `at` among turns timed by Core's `createdAt`. The chat keeps at most 1,000 messages (`CHAT_STEP_MESSAGE_LIMIT`).

### Before and after: one build as text

The build: the person asks, then Core runs "Deciding", a quote-button click, "Deciding", typing a postcode (which fails), a repair, a retry, and a completion check. The answer follows.

**Before (r2), collapsed:**

```
                                   [Get me a quote for my postcode]
Worked for 1m 12s · 4 steps  ›
Your quote form is ready: ...
```

**Before (r2), opened:**

```
✓ Clicked on the page
✕ Typed on the page
✓ Typed on the page
✓ Checked the result
```

The reasons were not shown anywhere, and only the relay's last 60 events were held.

**After (this change):**

```
                                   [Get me a quote for my postcode]
**Clicking “Get a free quote”** — The quote form is behind this button, so I'm opening it.
✓ Done
**Typing the postcode** — The form asks where the job is.
✕ Didn't work. The field was covered by a banner.
**Closing the cookie banner** — The banner covers the postcode field; closing it first.
✓ Done
**Typing the postcode** — The field is free now.
✓ Done
**Checked the result** — The quote form is open with the postcode filled.
✓ Passed
Your quote form is ready: ...
[live line, last: "Building your Flow / Thinking about the next step" while working]
```

## What changed

**Background and shared:**

- `background/activity/unit-history.ts` (new)
- `activity-relay.ts`
- `index.ts`
- `tests/unit-history.test.ts` (new, 3 tests)
- `tests/activity-relay.test.ts` (+1 test: 120 explained decisions all kept past the 60-event window, and the display is still paced)
- `shared/activity/history-limits.ts` (new)
- `internal-step.ts` (moved from `panel/chat/stream/step-filter.ts`, header updated)
- `extension-activity-state.ts`
- `activity-display.ts` (comment only)
- `index.ts`

**Chat source:**

- `panel/chat/stream/step/{index,messages,outcome,words}.ts`
- `stream/stream-items.ts`
- `stream/target-activity.ts`
- `stream/index.ts`
- `view/step-message-view.ts` (new)
- `view/thread-view.ts`
- `view/message-view.ts`
- `view/live-line.ts`
- `view/index.ts`
- `view/scroll-follower.ts` (comment)
- `feed/activity-feed.ts`
- `chat-panel.ts`
- `chat.css`
- `index.ts`

**Chat tests:**

- `stream/step/tests/messages.test.ts` (7, new)
- `stream/step/tests/outcome.test.ts` (2, new)
- `stream/tests/stream-items.test.ts` (rewritten, 5)
- `stream/tests/target-activity.test.ts` (renamed field, +1 history test)
- `view/tests/thread-view.test.ts` (rewritten, 3)
- `tests/in-place-updates.test.ts`: the fold test is replaced by "fifty step messages later the first is the same element"
- `tests/chat-panel.test.ts`: +1 mounted end-to-end test. A settled 80-decision build from `history` (only 60 events in `recent`) shows 80 messages between the person's turn and the answer, with no fold.
- `conversation/tests/target-core.ts`: fake turns may carry `createdAt`.

**Docs:** `docs/architecture/extension-client.md`: the relay's `history` bullet, and the chat section rewritten. The old section described a header and Simple Mode. The "chat header" wording is replaced by "live line".

## Commands run and observed results

- **Typecheck.** `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension` produced no output and exit 0.
- **Unit tests.** `EXTENSION_TEST_BUILD_LABEL=t191-wb node scripts/test-extension.mjs` printed exit=0, `# tests 1502`, `# pass 1502`, `# fail 0`.
  - All 19 new test names appear as `ok`.
  - The log has no "generated asynchronous activity" line.
- **Structure audit, first run.** `node scripts/structure-audit.mjs` failed with `FAIL [naming] apps/extension/src/panel/chat/stream/: 3 files share the prefix "step-"`. I moved those files into `stream/step/`.
- **Structure audit, re-run.** `structure-audit: passed (129 warning(s), 120 baselined).`
- **Build-slot validation.** `EXTENSION_TEST_BUILD_LABEL=t191-wb bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t191 wb ext" bash -c "pnpm --filter @fluxiq-web-extension/extension check && pnpm --filter @fluxiq-web-extension/extension test && pnpm --filter @fluxiq-web-extension/extension build"` exited 0 in slot b2.
  - check: `extension:check` ran, 187879 ms, with no errors.
  - test: `Extension smoke test passed.`, then `# tests 1502`, `# pass 1502`, `# fail 0`, `# cancelled 0`.
  - build: `chrome: verified 22 files`, `firefox: verified 22 files` (plus the existing gecko.id placeholder warning), `e2e-chromium: verified 22 files`.

## Not verified

- **Browser and real Core.** No browser run and no real Core, as the brief said. I have not observed that Core emits the pinned contract: a `thought` with text before each action, tool titles equal to the thought's title, and repairs as `thought`s in `repairing`. The tests build events to that contract.
  - With a Core that still sends text-less thoughts, the chat degrades to `action` messages that have no reason.
- **Rendering.** Visual spacing, and the look in light and dark, were not screenshotted. That includes the `-10px` tightening between consecutive step messages and the outcome line colours.
- **Broadcast size.** At the bounds (10 units of 500 events, text up to 1,000 characters), a state broadcast could reach a few MB, and the relay sends at most 4 per second. A typical build is about 250 kept events, roughly 100 to 150 KB. I did not measure the cost of `chrome.runtime.sendMessage` at that size.
- **Clock skew.** Placement between turns relies on Core stamping turns with `createdAt` on the same clock as activity `at`. An unstamped turn read later takes the panel's `Date.now()`.

## Open questions or contradictions found

1. **Staged rename.** My first `git mv` staged the move of `panel/chat/stream/step-filter.ts` to `shared/activity/internal-step.ts` in the index. Everything else is unstaged working-tree changes. I tried `git reset` to unstage it, and the hook blocked the command. The supervisor's commit should use `git add -A` for `apps/extension/src`.
2. **Deleted r2 edits.** The worktree already held uncommitted r2 edits to `activity-rows.ts` and its test, which I deleted along with the fold design. Their other r2 changes (`ask-thread`, `target-activity`, live line action) are kept.
3. **Build markers.** "Started building" and "Finished building" no longer appear anywhere in the chat. A build failure shows one message, "The build failed". If the lead wants a start marker as a message, it is one condition in `stream/step/messages.ts`.
4. **Asks as messages.** An `ask` detail such as "Waiting for a person" also shows as a message, in addition to the live line's waiting state and the thread's ask turn. It could be dropped if that reads as a duplicate.
