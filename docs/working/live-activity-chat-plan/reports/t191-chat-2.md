# Report: t191-chat-2 (worker), lane t191, round 2

## Outcome

Done. The chat now fills the panel, opens either the latest thread or one automation's thread, and sends to the thread on screen. It has no header, and it shows only decisions and real page actions, in words.

Extension `check`, `test` and `build` all pass, and the structure audit passes. I checked it headed in `lab-slots/ui-1`, with the company-website scenario open, against a scripted fake Core. No model was called. There are 15 screenshots, and I looked at each one.

## What changed and why

All changes are under `apps/extension/src/panel/chat/`.

### Target switching (brief item 1)

- `target.ts` holds `ChatTarget`. I renamed it from `chat-target.ts` because the structure audit failed `chat/` for three files sharing the `chat-` prefix. The shell imports it from the `../chat` barrel.
- New `conversation/thread-requests.ts`:
  - The latest thread is the existing request: `list-conversations`, open, limit 1.
  - An automation adds `subjectKind: "flow"` and `subjectId: flowId` to the list.
  - A first message in an automation's chat sends that subject, with `title: name`. The relay then calls `open-conversation`, which continues the subject's open thread when there is one.
  - Every message in an automation's chat carries `onScreen: { flowId }`. Core feeds that into the instruction context (`instructions/invocation.ts`, `prompt.ts`).
  - The relay already passes all of these fields. I did not touch the relay or Core.
- `controller.ts` has `setTarget(target)`:
  - It clears the thread on screen at once.
  - A generation counter drops any read still on its way for the old target.
  - A send that was already on its way still lands in the thread it was written in.
  - The same Flow under a new name keeps its thread, with nothing read again.
  - `state().conversationId` exposes the thread on screen.
- `chat-panel.ts` has `open(target)`, `target()` and `onTargetChange(listener)`. `open` also:
  - resets the turn clock and the thread view;
  - updates the context line;
  - sets the composer placeholder to "Message FluxIQ about <name>".
- New `view/context-line.ts`: a slim line with "‹ Latest chat" on the left and "Automation <name>" on the right. It is hidden in the latest chat.
- New `stream/target-activity.ts` decides which activity each chat shows:
  - Work whose events name another thread (`conversationId`) never shows in this thread.
  - The latest chat shows everything else.
  - An automation's chat shows only its Flow's work, or work that speaks through its own thread.
  - The live line follows `display` only when the unit it describes is one this chat shows.

### Fill the container (brief item 2)

- Deleted `header/` (header model, header view and phase copy). I moved `step-text.ts` into `view/`.
- The on-page status control moved to new `settings/` as `createOnPageStatusSetting(request, listen?)`. It has its own activity feed and a `setActive` method. The shell's `settings-view.ts` already mounts it.
- I removed the fallback's Open FluxIQ button. The fallback now says "Open FluxIQ from the top of this panel."
- I kept the inline Open FluxIQ links, but only where a question or an attachment can be handled only in FluxIQ.
- `chat.css`:
  - no card chrome;
  - `.chat-panel` fills its parent (`flex: 1`, `height: 100%`);
  - `[hidden]` is forced to hide inside the chat.
- New `view/empty-state.ts` and `view/empty-state-model.ts` hold the title, one line and three example prompts.
  - The latest chat and an automation's chat have different examples.
  - The examples show only when a message could be sent now.
- The composer has two new methods:
  - `fill(text)` puts an example in the box and keeps it as the draft. It never sends.
  - `setPlaceholder(text)` sets the placeholder, which is now "Message FluxIQ".

### ChatGPT polish (brief item 3)

- The person's messages are right-hand bubbles.
- FluxIQ's answers are full-width formatted text, using the existing `format/` module.
- There is one fold per answer: `stream/thread-entries.ts` merges every unit of work between two turns into one `WorkFold`.
- The work fold looks like a quiet summary line with a chevron, and opens to a list with a left rule.
- The live line's headline has a shimmer, which is skipped when reduced motion is requested.
- Spacing is larger than before, and the example prompts are cards.
- Light and dark come from the tokens.

### Only real steps, in words (brief item 4)

- New `stream/step-filter.ts` (`isInternalStep`) drops Core's bookkeeping:
  - these tool ids: `core.state_digest`, `answer_check`, `evidence_history`, `request_check`, `decision_check`, `amendment_check`, `budget`, `no_progress`, `resumed`, `observe`, `other`, `read_draft`;
  - any id or title containing "state digest", "digest" or "answer check".
- New `stream/step-words.ts` (`stepWords`) puts steps in words:
  - `core.run_node` reads as what it did, taken from its result code: "Looked at", "Clicked on", "Opened a page", "Typed on", "Read data from", and so on. It is in the present while under way, and "Working on the page" before any result.
  - Known tools and titles have human wording. "Deciding the next step" becomes "Decided the next step" once done, and "Completion check" becomes "Checked the result".
  - Run steps read "Step N: label".
  - An unknown id reads "Used a tool". A raw id is never shown.
  - Result and issue codes are dropped from the text.
  - The ref `<code>` is gone from the list.
- New `stream/activity-rows.ts` builds the rows. A decision or a step is never reopened, and it counts as done once any later event of the same unit arrives. So 62 decisions are 62 rows, not one, and only the newest row shows a spinner.

### Honest counts (brief item 5)

`activityRows` returns a `partial` set. A unit is partial when either of these holds:

- rows of it were cut by the chat's row limit (now 120; the relay caps events at 60);
- the relay window is full (`ACTIVITY_RECENT_LIMIT`) and its oldest event belongs to the unit;
- its first run step is past step 1.

A unit is never partial while its opening row (Build started, or run step 1) is still held.

`workSummary` then says:

| State | Summary |
| --- | --- |
| Whole | "Worked for 2m 5s · 14 steps" |
| Partial | "Worked for 3m 18s", with no count |
| Working, whole | "N steps so far" |
| Working, partial | "Show the work so far" |
| The unit itself failed | adds "· didn't finish" |

- Step failures along the way are not a failed unit.
- Markers such as "Started building" are listed but not counted.
- A partial fold's time starts at the person's message just before it, when that message is at most 10 minutes older than the first row left and the thread has not been answered since.

### Tests (node, in `tests/` folders)

New test files:

- `conversation/tests/target-switch.test.ts` (6): latest to automation to latest; sending goes to the thread on screen with `onScreen`; a first message opens a Flow thread with subject and title; an in-flight read for the old target is dropped; the requests; a rename.
- `conversation/tests/target-core.ts`: a multi-thread fake Core used by those tests.
- `stream/tests/activity-rows.test.ts` (4): internal reads filtered; decision rows; wording (no `core.`, `web.`, node ids or `_` in any title or text); partial detection.
- `stream/tests/target-activity.test.ts` (4).
- `tests/chat-panel.test.ts` (5, the mounted chat under the fake DOM):
  - `open` with the context line, "Latest chat" and `onTargetChange`;
  - Enter in the composer sends to the automation's thread;
  - examples fill the box without sending;
  - an automation's chat shows only its own live work;
  - `contextLine: false`.
- `settings/tests/on-page-status-model.test.ts`.
- `view/tests/step-text.test.ts`.

Updated test files: `stream-items`, `thread-entries` (7 tests), `work-summary`, `in-place-updates` (the live line; a fold keeps its step elements across 50 steps), and `thread-view` (no ref shown).

## Commands run and observed results

- Focused runner (scratch `t191-chat2/run-chat-tests.mjs`, which bundles only `src/panel/chat/**/tests`): final run `# tests 97`, `# pass 97`, `# fail 0`.
- `heavy.sh "t191 chat2 check" pnpm --filter @fluxiq-web-extension/extension check`:
  - First run: exit 1. Both errors were in the shell worker's files:
    - `panel/automations/tests/choose-automation.test.ts` imported `../../chat/chat-target`. They changed it to the barrel.
    - `panel/tests/status-fixture.ts` had a bad protocol path.
  - Second run: exit 0.
  - Final run: `check exit=0`.
- `EXTENSION_TEST_BUILD_LABEL=t191-chat2 heavy.sh ... test`:
  - The first try failed in `smoke-test.mjs`: "src/popup/index.ts must mount the panel for popup". That is the shell worker's file.
  - `node scripts/test-extension.mjs` alone: `# tests 1268`, `# pass 1268`.
  - Final full `pnpm ... test`: `test exit=0`, `# tests 1270`, `# pass 1270`, `# fail 0`.
- `heavy.sh ... build`: `build exit=0`. It printed "chrome: verified 22 files", "firefox: verified 22 files" and "e2e-chromium: verified 22 files".
- `node scripts/structure-audit.mjs`:
  - First run: the only failures were the shell worker's `../shell/contracts` barrel imports. There were no `panel/chat` findings, and the `chat-` prefix failure is fixed.
  - Final run: `structure-audit: passed (123 warning(s), 120 baselined)`, with nothing under `panel/chat`.

### Browser run

Setup:

- Script: scratch `t191-chat2/chat-probe.mjs`.
- Slot `lab-slots/ui-1`, claimed with mkdir and an owner line carrying a token, and released on exit only if the token matched. On the second run it waited 4.5 minutes for the shell worker's claim to clear. It was released after all three runs.
- Headed Chromium with `dist/chrome` loaded.
- A company-website scenario tab from `startScenarioLab`.
- The real `sidepanel/index.html` in a 440×900 tab, with the shell worker's panel around my chat.
- A fake Core: a WebSocket gateway plus the Automation Studio endpoints. Its turns and `server.activity` are scripted, and it makes no model call. Each scripted build includes internal `core.state_digest`, `core.evidence_history` and "Answer check" events.
- Free RAM was 3.18 GB and free virtual memory 14.91 GB before the first run.

Runs:

- Run 1 exposed two defects, both fixed and covered by tests:
  - Another thread's work showed in a thread. This is the `conversationId` filter in `target-activity.ts`.
  - A partial fold said "Worked for 1h 1m" because it extended back to an hour-old message. This is the 10-minute cap, and the reset after an answer.
- Run 1 also showed probe artifacts: the fake stamped times late, which put the work above the message.
- Run 2 showed the "Started building" spinner that never finished. The fix is to close unended steps.
- Final run (07:50Z) log:
  - `foldLabels: ["Worked for 2m 5s · 14 steps"]` for the 46-event build.
  - Step titles are all words: "Started building, Decided the next step, Looked at the page, … Updated the draft automation, Checked the result, Finished building". No internal read appears.
  - `appended … conv-flow-7 … onScreen {"flowId":"flow-7"}`: the automation's message went to its own thread.
  - The 88-event build shows `foldLabels: ["Worked for 3m 18s"]`, with no count.

Screenshots in `C:/Users/osrs_/FluxStuff/evidence/t191-shots/`, all read:

| Shot | What it shows |
| --- | --- |
| `chat2-01-empty-light`, `chat2-01b-empty-dark` | The empty state with three example cards and the pinned composer |
| `chat2-02-example-filled` | The composer grew to two lines and the send button is enabled |
| `chat2-03-working`, `chat2-04-working-fold-open` | The person bubble, the live line "Building your Flow / Thinking about the next step", and "8 steps so far" open to ✓ rows |
| `chat2-05`, `chat2-06-answered`, `chat2-07-answered-dark` | "Worked for 2m 5s · 14 steps" above formatted text (bold, bullets, inline code) |
| `chat2-08-automations-tab` | The shell's Automations tab |
| `chat2-09`, `chat2-10-automation-light/dark` | The context line "‹ Latest chat · Automation Price tracker", a numbered list, and Yes/No ask buttons |
| `chat2-11-automation-sent` | A message sent in the automation's chat |
| `chat2-12-automation-empty` | "Ask about Job alerts" with automation examples |
| `chat2-13-back-to-latest` | After going back to the latest chat |
| `chat2-14-long-build` | "Worked for 3m 18s" with no count |

## Not verified

- **Real Core.** A real Core and the real background pacer driving `display` in a live build were not exercised. The browser runs used a scripted fake Core, so Core's real `conversationId` and `flowId` tagging of activity events is assumed from the contract (`ClientGatewayActivity`), not observed.
- **The real side-panel surface.** I screenshotted `sidepanel/index.html` as a 440 px tab, not the docked side panel. The Firefox popup was not opened.
- **Internal reads in Core's stream.** Whether Core ever puts digest or bookkeeping reads into the activity stream is unconfirmed. The evidence report says digests currently never reach it, so the filter is defensive. It covers the ids and words listed above; an internal read under an id outside that list would still show, worded as "Used a tool".
- **Scrolling in the browser.** Scroll-follow and "Jump to latest" were not exercised against real scrolling beyond the jump button appearing in run 1. They are unit-tested.
- **Asks.** Answering an ask from the panel was not clicked in the browser.

## Open questions or contradictions found

1. **The automation's name is shown twice.** The shell's automation strip sits above the chat.
   - In run 1 the strip showed "× Price tracker Run" directly above my "‹ Latest chat · Automation Price tracker" line (`chat2-09`).
   - In the final run the strip shows only "Not run yet / Open in FluxIQ / Run" (`chat2-10`, `chat2-12`), so the shell worker appears to have dropped its name and close button.
   - If both are kept, `createChatPanel(request, openFluxIQ, { contextLine: false })` hides mine. I kept it on by default because the brief asks for it.
2. **"Latest chat" means the most recently touched thread.** After a person uses an automation's thread, "Latest chat" shows that same thread (`chat2-13`). That matches "the project's latest thread", but a person may expect the project thread they were in before. The lead should decide whether "latest" should exclude Flow-subject threads. That would be one change in `thread-requests.ts`, but the relay only filters by subject equality, so excluding a kind is not expressible without a relay change.
3. **Breaking API change.** `createChatPanel`'s third parameter is now an options object `{ onConversation?, contextLine? }` instead of a callback. `panel/simple/` is gone and the shell passes no third argument, so nothing breaks today.
4. **Removed exports.** `chatHeaderModel` and `PHASE_COPY` are gone with `header/`. Nothing outside `panel/chat` used them. The content overlay has its own `stepText`.
