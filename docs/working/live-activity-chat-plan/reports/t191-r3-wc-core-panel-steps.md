# t191-r3-wc: Core panel chat shows every step as its own message

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ` (branch `task/t191-extension-chat-ui`). Nothing was committed.
Paths below are relative to `apps/web/src/features/automation-studio/`.

## Outcome

Done. The Core panel's chat now shows each explained decision, repair and check as its own FluxIQ message:

- the action in bold;
- the model's reason after a dash;
- a quiet outcome line taken from the tool events that follow.

There are no folds, disclosures or step counts. Each message is keyed by `activityId#sequence` and updated in place. Each unit of work is held client-side, so earlier step messages stay after Core's 60-event snapshot moves on and after the work settles. The live line is always last while Core works.

Validation matches the brief's expectations:

- tsc is clean.
- 242 of 243 conversation tests pass. The one failure is the known `registry.test.ts` "pins the classes".
- `core-contract.test.ts` passed all 60 tests this run, with no timeouts.
- The structure audit passes.

## What changed and why

### Holding the whole unit (brief item 3): `conversation/activity/history.ts` (new)

- `holdConversationActivity(held, snapshot, limits)` replaces `mergeConversationActivity`, which was a flat window of 120 events by sequence and therefore lost a long build's first steps.
- Events are held per `activityId` and deduplicated by `activityId#sequence`.
- It holds only events that can become a message or that end a unit:
  - an event with a detail, except a text-less `thought` ("Deciding the next step");
  - a final, done or failed event.
- `CONVERSATION_ACTIVITY_HISTORY_LIMITS = { units: 10, eventsPerUnit: 500 }`:
  - within a unit, the newest events are kept;
  - the units kept are the ones heard from most recently;
  - the result is ordered oldest first, by Core's `at`, then by sequence.
- `useConversationActivity.ts` now calls it. `model.ts` keeps only the step phrase and the poll speed.

### Step messages (brief items 1 and 2): `conversation/activity/steps/` (new)

The rules mirror the extension's `panel/chat/stream/step/messages.ts`.

**`messages.ts`: `conversationStepMessages(events, limit = 1000)`.** Kinds:

| Kind | Source |
| --- | --- |
| `decision` | A `thought` with text. Title is Core's action (or its sentence, if the title is not in words); text is the model's reason. |
| `repair` | The same, in phase `repairing`. |
| `check` | A `check`. Its title is Core's sentence ("The result doesn't answer the request") and its text is the verdict. A check that started is updated in place when it ends. |
| `step` | A run step: "Step 2: Open the listing". It has no "of M" and is closed once the run moves on. |
| `action` | A tool with no decision before it, for runs or an older Core. Its title is the tool's title in words, else "Working on the page". |
| `ended` | Only when a unit fails and no other message said so: "Build failed", "Run failed" or "Couldn't fix your Flow", with Core's label as text when it is in words. |

**Outcomes.** A tool after a decision sets that decision's outcome and is not a message of its own. A second tool becomes an `action` message.

**Hidden:**
- the decide-start event;
- pure status changes;
- build start and finish markers;
- asks, because the turn carries the question and the live line says "Waiting for your answer";
- notes;
- Core's bookkeeping tools.

**Ids and codes.** Titles and outcome text never show a tool id or a result code. They go through `conversationActivityTextIsHuman` (`wording.ts`). A reason that is only codes is dropped.

**`internal.ts`: `conversationActivityIsInternal`.** This is the extension's `INTERNAL_TOOLS` list and `INTERNAL_WORDS`, plus every `note`. Without it, a `core.state_digest` tool between a decision and its real action would have become that decision's outcome.

**`outcome.ts`: `conversationStepOutcomeWords`.** It returns:
- "Working on it", only on the newest message of the unit still running;
- "Done" or "Didn't work", followed by Core's sentence when it is in words;
- "Passed" or "Didn't pass" for a check.

**`stream.ts` (rewritten).** `conversationStream` places the step messages among the turns by the time of each message's opening event. That time never changes, so a message never moves. It still excludes events from another conversation and hides messages older than the first shown turn when earlier turns are hidden. `conversationActivityDuration` and `ConversationActivityGroup` are removed.

### Components

- `components/ConversationActivityBlock.tsx`: deleted.
- New `ConversationStepMessage.tsx`:
  - an `<article>` with `data-kind` and `data-outcome`, and a screen-reader "FluxIQ:";
  - `<strong>` for the title, " — reason" after it;
  - an outcome line with a lucide Check or X, or a spinner while working;
  - the time in the hover title.
- New `ConversationLiveLine.tsx`: the paced headline and detail, `role="status"`.
- `ConversationThread.tsx`:
  - renders `<li data-step-key>` per message with React keys equal to the message key;
  - puts the live line last (`key="activity:live"`);
  - memoizes the visible turns and the stream;
  - removes `settledHeadline`;
  - scroll-follow now also re-runs when the tail message's sequence or the live detail changes, so an outcome line appearing at the bottom stays in view for a reader at the bottom. The "New turns below" prompt still fires only when an entry is added.
- `ConversationViewContent.tsx`: comment only.
- `components/index.ts`: the barrel was updated.

### Styles: `styles/conversation/02-dock.css`

- The fold section was replaced with `.automation-conversation-step*` rules (the extension's look, using panel tokens) and `.automation-conversation-live*` rules.
- Consecutive step messages sit closer together: `li[data-step-key] + li[data-step-key]`.
- The spinner and breathing animations stop under reduced motion.
- The shared `.automation-conversation-opening li > div` rule is kept.
- The file went from 407 to 379 lines, so no split into a 03 file was needed and the advisory warning is gone.

### Tests

**New:**
- `activity/steps/tests/messages.test.ts` (8 tests)
- `activity/steps/tests/outcome.test.ts` (2 tests)
- `activity/tests/history.test.ts` (4 tests, including a 150-event build read through a 60-event hub window that is held whole)
- `activity/tests/stream.test.ts` (4 tests)

**Replaced or trimmed:**
- `activity/tests/model.test.ts`: the merge and interleave cases were removed.
- `activity/tests/pacing.test.ts`: the grouped-stream and duration cases were removed.
- `tests/conversation-activity.test.tsx`: the fold cases were replaced by these mounted cases:
  - "each step as its own FluxIQ message with its reason, between the turns, with no fold";
  - "how failed work ended as its own message";
  - "keeps every step of a long build after Core's snapshot has moved past them, each message in place". This case uses two reads (60 events, then the next 60 with a final event), fired through `visibilitychange`. It asserts 119 messages between the two turns, and that the first message's rendered `li` instance is the same object after the second read.

## Commands run and observed results

- **Typecheck and tests.** In `apps/web`:
  ```
  bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t191 wc web" bash -c "npx tsc --noEmit -p . && npx vitest run src/features/automation-studio/conversation"
  ```
  - `[heavy] t191 wc web holds b4`.
  - tsc printed nothing and passed.
  - vitest: `Test Files 1 failed | 24 passed (25)`, `Tests 1 failed | 242 passed (243)`.
  - The one failure is `capabilities/tests/registry.test.ts` "pins the classes that re-authorize to Core's own two", which received `"send_or_publish"`. It is pre-existing and was named in the brief.
  - `core-contract.test.ts`: 60 tests passed in 317 s, with no timeouts this run. This is a change from the brief's expectation, in the good direction.
- **Earlier focused run.** `npx vitest run src/features/automation-studio/conversation/activity src/features/automation-studio/conversation/tests/conversation-activity.test.tsx`: 7 files and 41 tests passed.
- **Structure audit.** `node scripts/structure-audit.mjs` at the Core root printed `structure-audit: passed (200 warning(s), 354 baselined).`
  - The only conversation warning left is the pre-existing `thread/model.ts` (9 exported values).
  - The `02-dock.css` 407-line warning is gone.

## Not verified

- **No browser run**, as the brief said. The look has not been seen on screen:
  - spacing between consecutive step messages;
  - the spinner and marks;
  - light and dark themes.
- **Core's live output.** I have not observed that real Core emits the r3-wa contract. The tests build events to the contract described in the r3-wa report.
- **Scale.** Rendering cost with 10 units × 500 events (up to 1,000 messages) was not measured. The stream is memoized, and React reconciles by key.
- **Poll gaps.** Events that Core's hub drops between two polls are not recoverable client-side. The poll runs at 1 s while work is running, and the hub keeps 60 events.

## Open questions or contradictions found

1. **Asks and notes are not messages here**, while the extension shows them as messages. In the panel, an ask is already its own turn with a form, and notes were always hidden as bookkeeping. This is a deliberate difference; say if it should match.
2. **The `ended` message** ("Build failed" or "Run failed" for a failed final event with no other message) is new here. The extension only shows Core's own "Build failed" step marker. It replaces the fold summary's "Run failed · 1 step".
3. **Model reasons are shown as Core sent them.** They are dropped only when the whole text is codes. The redaction is Core's `reasonText` (r3-wa). A reason that mentions a dotted id mid-sentence would still show it.
