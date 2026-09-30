# Report: t191-r2-w4 (worker), chat asks and quieter folds

## Outcome

Done, with one gap: nothing was checked in a browser or against real Core (see Not verified).

- **Problem 1.** Every chat now shows work that is waiting on the person. When the question is in a thread that is not on screen, the waiting live line has one button, "Show the question". It opens that thread in the chat, where Core's own Continue and Stop (or the ask's other answers) are the thread's ask controls.
- **Problem 2.** Decisions (`thought`, "Deciding the next step") are no longer fold rows or counted steps. The live line still shows the paced display's "Thinking about the next step".

All edits are under `apps/extension/src/panel/chat/`. The shell needs nothing new.

## Design, and why

### Where Core puts the question (read from Core's code, not observed)

Core writes the ask into the thread of the work's own subject. It does not use the thread the work was started from, which is what the activity events' `conversationId` names.

- **Build.** The ask goes to the Flow's thread, subject `flow` with the Flow's id. This covers both the permission ask and t197's person-needed ask. See Core `runtime/service.ts:1543-1546`, `parkingPort({ subject: { kind: "flow", id: flowId } })`.
  - The build's activity scope carries the same `flowId` (`runtime/activity/build.ts`).
  - The waiting event is `emitAutomationStudioActivityWaitingOnAsk` (`runtime/activity/ask.ts`, called from `flow-bootstrap/person-needed.ts`).
- **Run.** The ask goes to the run's own thread, subject `run` with the run id. See `runtime/service.ts:2620`, `parkingPort({ subject: { kind: "run", id: session.runId } })`.
  - The waiting event comes from `executor/graph-run.ts:527`.
  - The run's `activityId` is `run:<runId>`, with `subject.id` equal to the run id (`activity/bind.ts`).
- **Opening the thread again.** Core's `openConversation` continues a subject's open thread. So `list-conversations` with status `open`, that subject and `limit: 1` finds the thread holding the ask. Core's `requestedSubject` accepts `project`, `flow`, `build` and `run`.

So there were two failures, not one:

1. `target-activity` hid the waiting display when its unit belonged to another thread or another automation.
2. Even when the display was shown (a build started from the latest chat), the question itself was in the Flow's thread, which is not the one on screen. Nothing on screen could answer it.

### Chosen design: open the question's thread (option A)

- **New target.** `ChatTarget` gains a third kind: `{ kind: "question", activityId, subjectKind: "flow" | "run", subjectId, title }`.
  - The controller reads it like an automation's thread, listing by that subject (`thread-requests.ts`).
  - The existing controller, read retries, ask cards and `panelConversationAnswer` path answer it unchanged.
- **Finding the thread.** `stream/ask-thread.ts` (`askThread`) takes the paced display's `outcome: "waiting"` and names the thread holding the question from the unit's subject in the relay's events:
  - a build maps to `flow` and `subject.flowId`;
  - a run maps to `run` and `subject.id`.
- **Always shown.** `activityForTarget` now always returns a waiting display, in every chat. It also returns `answerIn`, which is the question's thread unless that thread is already on screen:
  - it is on screen in the same automation's chat for a build's question;
  - it is on screen in that question's own chat.
- **The button.** The live line (`liveLineModel(display, sending, questionElsewhere)`) gains `action: "Show the question"`, a pill button under Core's sentence. Clicking it calls `chat.open(answerIn)`.
- **The question's chat.** Once open:
  - the context line reads "‹ Latest chat · The run's question" (or "The build's question");
  - the unit's own events show, even though they name the thread they were started from;
  - "‹ Latest chat" goes back.

**Why this and not an inline ask card.** Rendering the ask inline in the current chat would need a second thread reader with its own poll, retries and answer state, plus a detached ask card with no turn around it.

Opening the thread reuses everything that already works against the real relay:

- `list-conversations` by subject, which the relay passes through unchanged (`conversation-relay.ts` `read`);
- `get-conversation`;
- `answer-ask`.

The ask then shows in context: Core's sentence with its buttons, in the same thread FluxIQ's own chat shows. The cost is one extra click.

### Problem 2

`activityRows` skips `detail.kind === "thought"` before it makes a row. A decision event still closes the step row before it: "Started building" is marked done once Core decides. That happens because the close runs before the skip.

## What changed

**Source:**

| File | Change |
| --- | --- |
| `target.ts` | The `question` target kind, documented. |
| `same-thread.ts` (new) | `sameThread(a, b)`, shared by the controller and the panel, so a question from the same Flow's thread keeps what is on screen. |
| `stream/ask-thread.ts` (new) | `askThread`, `QuestionTarget`; exported from `stream/index.ts`. |
| `stream/target-activity.ts` | A waiting display always shows; `answerIn`; the question target's filter; its own unit is exempt from the other-thread rule. |
| `stream/activity-rows.ts` | Decisions are not rows; comments updated. |
| `conversation/thread-requests.ts` | List and send for a question target. A message sent there carries `onScreen.flowId` or `onScreen.runId`. |
| `conversation/controller.ts` | Uses `sameThread`. |
| `view/live-line-model.ts` | `action` field; third parameter. |
| `view/live-line.ts` | The action button, with `onAction`. |
| `view/thread-view.ts` | Passes `onLiveAction`. |
| `view/context-line.ts` | The question's title, with the "Automation" label hidden. |
| `view/empty-state-model.ts` | A question's empty thread: "There is no question waiting here now…", with no examples. |
| `chat-panel.ts` | Wires `answerIn` to the button; `open` uses `sameTarget`/`sameThread`; header comment. |
| `chat.css` | `.chat-live-action`, a pill in the ask buttons' style. |

**Tests (in `tests/` folders):**

- **New `stream/tests/ask-thread.test.ts` (4 tests):**
  - a run asks in its own thread;
  - a build asks in its Flow's thread;
  - nothing is asked while working, once settled, or with no flowId;
  - the `current` event works as a fallback.
- **`stream/tests/target-activity.test.ts` (+5 tests):**
  - a run started from the automations tab shows in the latest chat with `answerIn`;
  - a build started from the latest chat is offered there, and the automation's chat holds it;
  - work waiting in another thread shows in every chat;
  - the question's own chat shows the unit, with no `answerIn`;
  - no offer while running or settled.
- **`tests/chat-panel.test.ts` (+1, mounted, end to end):**
  - the latest chat shows the wait with Core's person-needed sentence and "Show the question";
  - a click opens the run's thread: the context line, and a list request with `subjectKind: "run"` and `subjectId: "r1"`;
  - the Continue and Stop buttons render;
  - Continue sends `answer-ask` with `["ask-1", "choice", "done"]`;
  - back returns to the latest chat.
- **`tests/in-place-updates.test.ts`:** +1 test for the action model, the button, the click and hiding. Existing tests were updated for `action`, and the 50-step fold uses tool steps.
- **`conversation/tests/target-switch.test.ts` (+2 tests):** the question requests; the same thread is kept and another subject is read.
- **`stream/tests/activity-rows.test.ts`:**
  - the internal-reads expectation no longer has "Decided the next step";
  - "each decision is its own row" is replaced by "decisions are never rows" (the chat2-04 sequence) and "a decision still ends the step before it";
  - the partial tests use page looks, and one checks that a window full of decisions still slides past the opening.
- **Fixture updates:**
  - `conversation/tests/target-core.ts`: the fake Core carries `ask` on turns and settles it on `answer-ask`;
  - `stream-items.test.ts` and `thread-view.test.ts`.

## Commands run and observed results

- **Baseline** before any edit, scratch runner `scratchpad/t191-r2-w4/run-chat-tests.mjs`: `# tests 104`, `# pass 104`, `# fail 0`.
  - The runner mirrors `scripts/test-extension.mjs`, bundling only `src/panel/chat/**/tests/*.test.ts`, with output in the scratchpad.
- **After the source change, before the test updates:** 8 failures.
  - These were the tests that used decisions as filler rows, and the model fixtures that lacked `action`.
  - I updated them as listed above. Run: `# tests 105`, `# pass 105`.
- **With the new tests:** `# tests 118`, `# pass 118`, `# fail 0`. Every new test name appears as `ok`, for example:
  - `ok 105 - a run waiting on the person in a thread not on screen shows in the latest chat, and one click brings its Continue and Stop`;
  - `ok 59 - decisions are never rows: ...`.
- **Typechecks:** `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension` both exited 0 with no output.
- **Structure audit:** `node scripts/structure-audit.mjs` at the repo root exited 0: `structure-audit: passed (129 warning(s), 120 baselined).` No finding names `panel/chat`.
- **Final run after the CSS edit.** Both `tsc` runs exited 0, the audit passed, and the tests showed `# pass 118`, `# fail 0`. However, the runner process exited 1.
  - The cause was my new end-to-end test. Its last "‹ Latest chat" click started a read that finished after the fake document was torn down: "generated asynchronous activity after the test ended ... Cannot read properties of undefined (reading 'createElement')". `run2.log`, from before that test existed, has no such line.
  - The fix: the test now waits for that read and asserts the latest thread's turns.
  - Re-run: `tests exit=0`, `# tests 118`, `# pass 118`, `# fail 0`, and 0 "generated asynchronous activity" lines. `npx tsc -p tsconfig.test.json --noEmit` exited 0 again.

## Not verified

- **Browser and real Core.** No browser run and no real Core, as the brief asked.
  - The thread each ask is parked in comes from reading Core's code, not from a live build's database: `service.ts:1543/1546/2620`, `activity/build.ts`, `activity/bind.ts`, `executor/graph-run.ts:527`.
  - I assumed that a waiting build's events always carry `subject.flowId`. `withAutomationStudioBuildActivity` sets it only when the request named a Flow. If it did not, the wait still shows, but there is no button.
- **The pacer's headline.** The paced headline "Waiting for you: answer in the FluxIQ panel" comes from the background pacer (not my paths). I did not change it.
- **Full suite.** No full `pnpm check`, `test` or `build` run. The shell worker's concurrent files were typechecked together with mine and passed at the time of my run.

## Open questions or contradictions found

1. **Headline wording.** The pacer's headline says "answer in the FluxIQ panel". With the button in the chat, "Waiting for you" plus Core's sentence may be enough. That is a `background/activity` change for the lead.
2. **Stale waiting display.** A waiting display persists until Core's next event for that unit. If a question is answered in FluxIQ's own window, the next event clears it; a run parked durably stays "waiting", which is correct. A Core restart that loses a held-in-place run leaves the last "waiting" display until the relay's state is replaced. The button then opens a thread whose ask Core may have expired. The ask card says "FluxIQ stopped waiting for an answer.", so this fails safe.
3. **Where "back" goes.** "‹ Latest chat" goes back to the project thread, not to the automation's chat the person may have come from. The brief's context line asks for exactly that; returning to the previous target would be a small change in `chat-panel.ts`.
4. **Shell impact.** The shell (`mount-panel.ts`) shows its automation strip only for `kind === "automation"`, so it hides for a question target. That seems right; no shell change is needed.
