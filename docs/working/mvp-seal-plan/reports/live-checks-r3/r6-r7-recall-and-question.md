# R6 and R7: recall points at the lost view, timing leaves the repeat key, and a stuck attempt asks a real question

Worker report for E1 (run-mwc6ut8u-52e3c1b3). All edits are in the Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`, uncommitted.

## Outcome

Partial. R6a and R7 are done. R6b is done inside the repeat guard and the loop detector, with
tests. It has no effect in a live run yet, because nothing gives the guard the node's declared
timing parameters. That last link needs files outside my brief (Q1 below). I sent E1 the question
at the start (`SendMessage` to supervisor `a13bae7025b3ea07a`, the one I took to be E1). No answer
had arrived by the end.

## What changed and why

### R6a. The refusal points at recall, and recall gives back the page

- **I confirmed recall did not restore a click's page.** `evidence-recall/restored.ts` gave back
  only held `holder.member` views (read rows). Its header said the page is left out because "the
  target is still there to look at". That is false once the work has moved away, which is exactly
  this run.
  - `restored.ts` now gives back the result's declared top-level views (the page) as well as its
    held views. A top-level view that is itself a holder is given back whole, once.
  - The recall answer already sits in its own current-view group (`decision-context/current-view.ts`,
    `tool:core.recall_result:restored`). So a recalled page shows as the page that call ended on,
    and never replaces the current page. A test proves this through `automationStudioLlmEvidenceCurrentView`.
  - `description.ts`, `tool-id.ts` and `index.ts` now say the page is recalled too. The
    description is still under 2,000 characters (that test passes).
- **`repeat-guard/feedback.ts`: a `same_result` refusal has its own instruction.** It says the call
  would end where it ended before. It names `core.recall_result with {"callId": <sameAsCall>}` as
  showing that page without going there. The note has a new optional input, `recallOffered`:
  - `true` names recall outright;
  - `false` leaves it out;
  - when it is not given, the note names recall only "where core.recall_result is among your tools".
  - The note says "changing only how long a call waits does not make it a different call" only when
    the guard really left timing out of that call's key (`timingLeftOut`), so it is never untrue.
  - The wording without a draft (undrafted) still applies.
  - `failed` and `changed_nothing` keep the old instruction and never mention recall.

### R6b. Timing parameters leave both repeat keys

- **New `repeat-guard/timing-free.ts`, `automationStudioLlmEvidenceTimingFree(toolId, input, timingOf, node?)`.**
  For a `core.run_node` call, it takes out of `parameters` the members its node declares as timing.
  The declaration comes through the caller's `timingOf(nodeId)`. Core names no parameter itself, and
  a node that declares none keeps every parameter in its key. The `node` argument covers
  `draft.ranWith`, which holds `parameters` without `node`.
- **`repeat-guard/outcomes.ts`:**
  - The guard takes a `timingOf` option, and its key uses the input with timing taken out.
  - A failed call that timed out keeps the timing it ran with (`timedOutWith`). That timeout is
    seen from `failure.category === "timeout"`, or a code or reason whose last word is
    `timeout` / `timed_out`.
  - `blocks` lets the same call run again with a different wait, and refuses it with the same wait.
  - A refusal of a call that carried timing is marked `timingLeftOut`.
  - The header gains an R6 paragraph. The file is now 707 lines.
- **`loop-detection/detector.ts` and `watch.ts`:** both take `timingOf`. Every written key and
  ran-as key goes through the same timing split, so the near-repeat key closes the same gap.

### R7. A stuck attempt asks a real question, and the answer carries it on

- **New `answer-first/loop-signal/stuck-question.ts`, `automationStudioAnswerFirstStuckQuestion`.**
  It builds the question from the loop's own evidence:
  - **What is stuck:** the finding the ladder stopped on, as pattern, count and what did not change
    (page, rows, acts, draft) in plain words. For a completion refused again, it says the result
    keeps being refused, with the check's screened reason.
  - **What was tried:** the steers given and the repeats refused (summed from `loopsCaught`), the
    fresh starts (`tried.approaches`), and how many different things did not work over how many tries.
  - **What the attempt holds:** rows, acts and an answer in words.
  - **What the person can do:** tell it in their own words where the thing asked for is shown, what
    to try, or what was misunderstood, or press Stop.
  - The wording is generic and passes `personFacingTextFaults` for every pattern. It contains no
    code, tool id or digest.
- **`attempt/stuck-ask.ts`.** The ask is now `kind: "open"`, parked, with no clock and the same
  `stuck_in_a_loop` control. It returns the person's words, or nothing: nobody to ask, an empty
  answer, or the wait ended by a Stop. Stop is the build's own Stop, because an `open` ask accepts
  only a `text` answer (`interaction/request.ts`, `automationStudioConversationAnswerFits`).
- **`attempt/rounds.ts`.** `askedToStop` is replaced by `askPerson`:
  - It builds the question from `run.stuck`, `run.loopsCaught`, `run.tried` and what the attempt holds.
  - It waits for the answer. Words are pushed onto `run.personSaid`.
  - It is never an ending: only `stopped(run)` (the person's Stop) returns `stopped_by_person`.
  - The fresh-round note says "the person was asked and answered" only when words came back.
  - The nobody-to-ask path is unchanged. It still parks as `waiting_for_person` /
    `stuck_in_a_loop`, which is the "stopped" the lead kept.
- **Other answer-first files:**
  - `attempt/round.ts`: the watch's `ask_person` signal now hands its finding to `run.stuck`
    (`loop-signal/signal.ts` passes the signal through). A completion refused again sets `run.stuck`
    with the check's reason. This replaces the fixed `askWords`.
  - `attempt/state.ts`: `askWords` is replaced by `stuck` and `personSaid`.
  - `attempt/round-note.ts`: every later round's note carries
    `personSaid: { whose, words }`, marked as the person's own guidance.
  - `completion/refused-words.ts`: the model is no longer told the person is asked "whether to keep
    going or to stop". The old fixed `ask` question is removed.
  - `completion-refused-again.ts`: header comment only. Its rung logic, and so D14 step 4's
    trigger, is unchanged.

### Tests

- **New:**
  - `repeat-guard/tests/timing-free.test.ts`: the split; the guard refusing a press whose only
    change is its wait; a node that declares no timing; a timed-out call running again with another
    wait (three ways of saying timeout); the detector's near repeat.
  - `loop-signal/tests/stuck-question.test.ts`.
  - `attempt/tests/stuck-ask.test.ts`.
- **Extended:** `repeat-guard/tests/feedback.test.ts`, `evidence-recall/tests/binding.test.ts`
  (a press's page recalled beside the current page; a holder given back once), and
  `attempt/tests/round-note.test.ts`.
- **Updated, because they answered the old `stuck_stop` / `stuck_keep_going` choices:**
  - `attempt/tests/keep.test.ts`.
  - `answer-first/tests/endings/tests/person.test.ts`: the person's text answer now reaches the
    next round's request.
  - `answer-first/tests/endings/tests/refused-completion.test.ts`: the ask is `open`, the question
    names the fresh start, and the next note carries `personSaid`.
  - `answer-first/tests/identical-rows.test.ts`.
  - In all four, Stop is now `service.buildCancellation.cancel`, and keep going is
    `kind: "text"` with words.

## Commands run and observed results

All were run from the Core worktree through
`node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- <cmd>`, without `--priority`.

- `pnpm --filter fluxiq check`: exit 0 on the final tree (`check exit=0`, build-cache
  "inputs changed ... stored").
- `pnpm structure:check`: the first run failed with 1 violation, `[statement-packing]`, in
  `attempt/round.ts` line 126 (my one-line handler). After I split it: `structure-audit: passed
  (534 warning(s), 969 baselined)`, exit 0.
- `pnpm --filter fluxiq exec vitest run src/runtime/llm/repeat-guard src/runtime/llm/evidence-recall src/runtime/llm/evidence-loop src/framework/automation-service/service/answer-first`:
  - **First run:** 3 failed and 1398 passed. Two were files I edited while the run was going
    (`feedback.test.ts`, `timing-free.test.ts`). One was real: `stuck-question.test.ts` failed
    `personFacingTextFaults` on the repeated phrases "did not change" and then "what i have". I
    reworded both.
  - **Narrow rerun** (repeat-guard, loop-signal, stuck-ask, round-note): 24 files and 185 tests passed.
  - **Final run on the final tree:** `Test Files 175 passed (175)`, `Tests 1401 passed (1401)`,
    exit 0, 957.70 s.

## Not verified

- **R6b in a live run.** `evidence-loop.ts:372` builds the guard with `{ draftOf }` only, and the
  loop watch receives no `timingOf`. So in production every parameter is still part of the key
  until Q1 is done.
- **Recall named outright.** `decision-handlers/refused-repeat.ts`, which is outside my brief,
  does not pass `recallOffered`. A live `same_result` refusal therefore uses the "where
  core.recall_result is among your tools" wording.
- **No browser or Lab run.** In particular, it is unverified that the extension chat shows an `open`
  ask with the new question and sends the person's reply as a `text` answer. The conversation layer
  supports it (`answer-words.ts` maps words to `text` for an `open` ask), but I did not exercise the
  extension.
- **A domain with only a page view.** The recall binding is still offered only where a held view is
  declared. A domain that declares only its page still gets no recall tool. The web domain declares
  `read.extracted`, so it is offered there.

## Open questions or contradictions found

- **Q1 (needs E1 or the lead).** Three changes are needed for timing to be declared generically,
  and each is outside my brief:
  - (a) a `timing?: true` flag on `AutomationNodeParameter`, in `components/automation/contracts.ts`;
  - (b) one changed line at `runtime/llm/evidence-loop.ts:372`, passing
    `timingOf: (node) => input.definitionOf?.(node)?.parameters.filter((p) => p.timing).map((p) => p.id)`
    to both `automationStudioLlmEvidenceRepeatGuard` and `automationStudioLlmLoopWatch`. The file
    stays at 800 lines if the existing line is edited;
  - (c) the web domain marking its `timeoutMs` parameters `timing: true`
    (`domain/src/output-nodes/definitions.ts`, extension repository).

  Until all three are in, the live gap the run used stays open.
- **The same_result note and recall.** Passing `recallOffered: context.toolIds.has("core.recall_result")`
  at `decision-handlers/refused-repeat.ts:52` would name recall outright. That file is outside my
  brief.
- **Old wording on the nobody-to-ask path.** It still says "nobody to ask whether to keep going"
  (`attempt/remember.ts:21`, `interrupted/check-missing.ts:9`, `carry-on/carry-on.ts:88`
  comment). These are outside what the brief named and were not changed. They now describe an ask
  that no longer exists in that form.
- **The person's free text goes to the model.** It is the person's own words and is not screened.
  It is marked as the person's guidance (`personSaid.whose`). If such text should pass a screen
  before it reaches a model, that is a separate decision.

## R7 revision: steer, never park

E1's revision overrides "it waits for the answer". A stuck attempt now never parks at
`waiting_for_person` (`stuck_in_a_loop`) and never waits on the person. This holds whether or not
anyone can be asked; only the result, the budget or the person's Stop ends it. The R6b wiring
(the timing flag in contracts.ts, `evidence-loop.ts:372`, `recallOffered` in refused-repeat.ts,
and the domain's `timeoutMs`) is E1's, and I did not touch those files. This revision supersedes
the R7 notes above about waiting, Stop through the ask, and the nobody-to-ask park.

### What changed

All files are under
`C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src/framework/automation-service/service/answer-first`.

- **`attempt/stuck-ask.ts`** is now `automationStudioAnswerFirstStuckAsking`, a channel that posts
  the question and never waits for it.
  - `post(question)` opens an `open` ask with `parks: false`, no clock and the `stuck_in_a_loop`
    control. It starts the wait for the answer in the background and returns at once.
  - At most one question is open at a time. A later loop while it is unanswered posts nothing more.
  - The person's words go to `heard` whenever they come.
  - `close()` aborts the wait. The conversation port then expires a question nobody answered, so
    nothing is left open under the thread. A Stop aborts it too.
  - A failure to post the question or read the answer goes to `failed`. It is said in the chat and
    is never an ending.
  - It uses the raw person port, not the activity ask port, because that one emits a "waiting on
    ask" event, which would show the attempt as paused.
- **`attempt/rounds.ts`**:
  - The rounds run inside `try` / `finally { asking.close() }`.
  - At the last rung, `steerStuck` does three things. It posts the question built from the loop's
    evidence (the R7 builder, unchanged in substance). It then counts one fresh start on the
    attempt record. It says "Trying a different way" in the chat.
  - The next round's note gets `loopStopped`.
  - The old nobody-to-ask park (`return "waiting_for_check"` with `stuck_in_a_loop`) and the
    blocking `askPerson` are gone. With nobody to ask, the attempt steers the same way and posts
    nothing.
  - When an answer arrives, it is pushed onto `run.personSaid`, the chat says "Got your answer",
    and every later round's note carries it, as already built.
- **New `loop-signal/stuck-steer.ts`** writes the `loopStopped` note in generic words. It says the
  loop was stopped, that everything under `tried` was already done and is refused again, to take
  a different way, and to keep going until the result. With `personAsked`, it adds that the person
  was asked and must not be waited for.
- **`loop-signal/stuck-question.ts`**: the opening is now "I keep getting stuck, so I am trying a
  different way, and asking you in case you can help." It adds "I carry on meanwhile; press Stop
  to end the task here".
- **`completion/refused-words.ts`**: `sameEvidence` and `freshRound` now say that the next round
  must take a different way and that the model never waits for the person. `freshRound`
  mentions `personSaid` once the person has answered.
- **`attempt/remember.ts`**: the dead stuck-with-nobody note (`STUCK_NO_ONE_TO_ASK`) is removed.
- **`interrupted/check-missing.ts`**: `AUTOMATION_STUDIO_ANSWER_FIRST_STUCK_MISSING` keeps its
  exact text. `interrupted-view.ts` still matches it against rows written before R7, so changing
  the string would make those stored rows read as interrupted. Its comment now says it is only
  for those older rows and is no longer written.
- **Comments updated**: `state.ts`, `round.ts`, `signal.ts` and the header of
  `completion-refused-again.ts`. The rung logic itself is unchanged.

### Tests

- **New:**
  - `loop-signal/tests/stuck-steer.test.ts`: the steer's words, `personAsked` never saying to
    wait, and no site, task or tool words.
  - `attempt/tests/stuck-ask.test.ts`, rewritten: posted without waiting, `parks: false`, one
    question open at a time, words heard later, closed with the attempt and on Stop, empty or other
    answers ignored, post and read failures said rather than thrown, nobody asked when nobody can
    be.
- **Test support:** `heldAtSteer()` in `tests/endings/support.ts` holds the first model call of the
  steered round, so a test can inspect the attempt while it is still going.
- **End to end:**
  - `tests/endings/tests/person.test.ts`: a caught loop leads to a steered fresh round (its
    request carries "Take a different way" and "Do not wait for them") while the question is open,
    and the row stays `working` with no `waitingFor`. An answer given later reaches a later round's
    note as `personSaid`, and the attempt reaches its result. With nobody to ask, it steers on to
    `budget_out` and the note has no `personAsked`. A Stop while the question is open ends it as
    `stopped_by_person` and closes the question.
  - `tests/endings/tests/refused-completion.test.ts`: the same three behaviours for completions
    refused again. The question names the fresh start and says "I carry on meanwhile". An answer
    given while the attempt goes on reaches the next round, which reaches the result (`askPerson`
    is now 2). With nobody to ask, it ends `budget_out` and is never judged again.
- **Updated, because they expected the park:**
  - `saved-shapes.test.ts` and `stuck-with-nobody.test.ts`: both now end `budget_out` with no
    `waitingFor`.
  - `identical-rows.test.ts`: there is no park; an answer reaches a later round; "money still
    there" now means under the whole budget, not half, since the attempt keeps going after the ask.
  - `attempt/tests/keep.test.ts`: its subject, keep.ts processing the dataset at a wait, now uses a
    person-only check. A stuck attempt no longer waits, and keep.ts processes the dataset only at a
    wait.
  - `loop-signal/tests/signal.test.ts`: the ask handler now receives the signal's finding.

### Commands run and observed results

All were run from the Core worktree through
`node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- <cmd>`, without `--priority`.

- **`pnpm --filter fluxiq check`:**
  - First run: exit 2 with TS2339, because the tests asserted `attempt.waitingFor` on a status
    type that has no such member.
  - I switched those assertions to `not.toHaveProperty("waitingFor")`.
  - Final run: `check exit=0`.
- **Narrow vitest** (loop-signal, the stuck-ask, keep and round-note tests, person,
  refused-completion, saved-shapes, stuck-with-nobody, identical-rows):
  - First run: 3 failed and 63 passed. Two were the identical-rows spend at the ask
    (`0.04000000000000003` against `< 0.04`). One was keep.test's dataset not processed between
    rounds (rows 6, not 3).
  - I fixed both as described above. A rerun of those two files gave 8 of 8 passed.
- **`pnpm structure:check`:** `structure-audit: passed (534 warning(s), 969 baselined)`, exit 0.
- **`pnpm --filter fluxiq exec vitest run src/runtime/llm/repeat-guard src/runtime/llm/evidence-recall src/runtime/llm/evidence-loop src/framework/automation-service/service/answer-first`:**
  `Test Files 176 passed (176)`, `Tests 1408 passed (1408)`, exit 0.

### Not verified

- **No browser or Lab run.** In particular, I have not seen the extension chat render a
  non-parking `open` question and send the reply back as `text`.
- **A question left open after the attempt ends** is closed through the conversation port's
  expire-on-abort path. That is covered by the person.test Stop case, but not on a process that dies.
- **A failure to post or read the question** is said in the chat in plain words only. The error's
  own detail is not logged, because this module has no logging channel.

### Open questions

- **Older stored rows.** Stored rows with `waitingFor: "stuck_in_a_loop"` from earlier runs are
  still recognised by `interrupted-view.ts`. `carry-on.ts:89`, which is not mine, still refuses to
  carry on such a row. Whether those older rows should become carry-on-able now is the lead's call.
- **`ending.ts`** (must not touch) still maps `waitingFor === "stuck_in_a_loop"` to a waiting
  ending. Nothing sets that value any more, so the branch is dead, not wrong.
