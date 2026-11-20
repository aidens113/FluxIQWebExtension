# t973: the chat starts clear tasks (F19); replays from varying steps are a loop (F20)

## Outcome

Done. Both fixes are in Core (`C:/Users/osrs_/FluxStuff/fxwork/t973/!FluxIQ`). Nothing is committed.

## What changed and why

### F19: the chat answered clear tasks in words

**Cause, from the evidence.** I compared today's chat request for company-website (run-mwos5phg-115e3a15)
with the request for the same task on 2026-11-11 (run-mwc6ut8u-52e3c1b3, which started). Apart from the
port, the only difference is `thinking: {type: disabled}`. The lead confirmed the same for run-mwosbjsl.
So the wording was always ambiguous, and thinking used to cover for it. Haiku with no thinking followed
the surface cues:

- **The reply shape was an escape hatch.** A reply was for "when they are not asking for anything to be done".
  A model that has decided to be careful never tests itself against that.
- **Deleting was not "ordinary".** "Do not ask whether you may do something ordinary" let the model treat a
  deletion as an exception. The PIN line said "FluxIQ asks the person for it when it is needed", which told
  the model a gate existed without saying the gate belonged to FluxIQ. Run 1's reply begins "I need to be
  careful about one thing first".
- **"On the page they have open" was read literally.** The createHere summary said the task runs on the open
  page. In runs 2 and 3 the model told the person to open the booking page or team page first.
- **Lookups seemed out of scope.** The summary stressed "keeps the steps as a draft Flow", and the model
  replied "Neither is a read-only lookup".
- **The domain's text reads as the chat's own.** The domain text says "You operate a real website" and
  explains page views. Run 2 replied "Your open page ... which I haven't read".

**Fix 1: the guidance.**
- `prompt.ts`: every answer now opens with `"intent": "task" | "conversation"`.
  - The prompt says outright that a lookup is a task, and that a delete, pay, send or post job is a task.
  - Reply is only for conversation, and "A task is never answered with a reply". Start it, with a full effort.
  - The model never asks whether to start and never asks for a PIN or password. FluxIQ itself asks one plain
    permission question when the attempt starts.
  - The "ordinary" qualifier is gone.
- The domain text now sits under a lead line: "What follows is what the attempt you start is told ... You see
  no page here and need not read one".
- The described-job line now also lists check, change and remove, and says "They need not open any particular
  page first: it starts here and goes wherever on the site the job needs."
- `commands/answer-first/summary.ts`: the attempt starts on the open page and goes wherever on the site the job
  needs. It brings back "something found, a list or table, an answer, or a change made".
- Everything stays generic: no site, task or answer is named.
- No prompt pins exist for the chat prompt. `system-prompt-pins.json` holds only Flow-task prompts, so nothing
  needed re-pinning.

**Fix 2: the structural guard (the lead's addition).**
- `instructions/intent.ts` reads the declaration, and `instructions/answer-record.ts` holds the shared object
  reader, moved out of `parse.ts`.
- `instructions/unanswered-task.ts` refuses two kinds of reply: a reply to a message the model declared a task
  (`task_answered_in_words`), and a reply that declares nothing (`reply_undeclared`).
- A start (`do`) and a question (`ask`) are never judged. The person's words are never read.
- `interpret.ts`: a refused reply is asked again with a correction and a `climb` on the request. The climb is
  sticky for the turn.
- `llm/anthropic/panel-command.ts`: a climbed attempt goes one rung up the model ladder (Haiku to Sonnet), with
  no thinking. Sonnet's no-thinking setting is `between_tools`, per `no-thinking.ts`. The ladder is read from
  `role-routing/ladder` and nothing there was edited.
- The climbed call's step `meta.json` records `climb: {from, reason}`. This is wired through
  `models/transport/observation.ts`, `models/providers/anthropic/messages.ts` and `llm/step-log/model-step.ts`.
- `instructions/unanswered-route.ts` handles the case where the attempts run out and the model still replied:
  - if any answer declared a task, and createHere is offered with a page open, it starts createHere with the
    person's whole message;
  - otherwise the model's own reply is shown.
  - Either way the person gets an answer, never a silent stall.
- DeepSeek's chat adapter ignores `climb`. It asks again with the correction on the same model.

### F20: replays from varying steps were not caught

**Cause, from run-mworaue7-5a56f19a (local-classifieds, campaign-a), steps 0281-0356.**
- `core.run_flow` ran 13 times, from steps 38, 38, 29, 29, 38, 29, 29, 33, 34, 38–39, 38, 29 and 38.
- Structure looks, `run_node add` steps and an amendment ran between the replays.
- The result's rows stayed at 5 throughout (`rowsKept.totalRows`), and no completion was tried.

**Why nothing caught it.**
- t969's "success again" keys on one input, so changing `from` started a new key each time.
- Every `add` stood at a new draft, which counts as progress and cleared every other pattern.

**Fix.**
- `loop-detection/types.ts`: a new call fact, `replay: {changed, reachedEnd}`, and a finding flag
  `replays: true`. The finding is counted under the existing `near_repeat` pattern, so the pattern contract is
  unchanged.
- `loop-detection/detector.ts`: replays are counted across all starting steps, whatever else moved. The count
  starts again when:
  - a replay changes the result (`changed`, or rows never seen before);
  - a replay reaches the Flow's end for the first time since the result last changed;
  - a completion is tried (the new `completionTried()`, called from `decision-handlers/completion.ts`);
  - a dry run moves the page (`moved()`).
- Detection threshold: `AUTOMATION_STUDIO_LLM_LOOP_SAME_REPLAY_AT` = 3, the same as a success again.
- What happens on detection: the model gets its loop decision with the count. After "continue" the next replay
  asks again. A replay is refused before it runs only after the model chose `change_approach`. There is no
  hard stop and no cap.
- `decision-handlers/replay-facts.ts` reads the fact by shape from run_flow's answer:
  - `changed` means `rows.done > 0` or a `resultList` note;
  - `reachedEnd` means `passed`, no `stoppedAt`, and no `to`.
- The run_flow id moved to the import-free module `node-tools/run/run-flow-tool-id.ts`. Importing it from
  `flow.ts` closed an import cycle that the structure audit failed. The barrels re-export the id, so existing
  importers are unchanged.
- `feedback.ts`: new words for the model ("replayed the Flow's steps ... from different steps, without the
  result changing ... without trying to complete") and for the person.

## Commands run and observed results

Every vitest, tsc and audit run went through `heavy-slot.mjs run t973-<step>` with `HEAVY_SLOT_PRIORITY=1`,
because the lead marked this top priority.

1. **t973-tsc1.** Targeted tsc on the F19 files and tests, using a temporary `tsconfig.t973-check.json` that
   lists the files (since deleted). Exit 0, no errors.
2. **t973-vitest1.** `conversations/instructions/tests`, `panel-command-climb`, `step-log/model-step`.
   - Result: 5 failed, 98 passed. The failures were old tests whose mock replies declare no intent, plus my
     climb test expecting `disabled` on Sonnet.
   - Fixed: mocks now declare `"intent": "conversation"`. The test now expects Sonnet's `between_tools`.
3. **t973-vitest2.** The same set plus importers: framework service-bootstrap domain-instructions,
   extension-chat, person-words, caller-key-chat, all of `runtime/conversations/tests`.
   - Result: 2 files failed, 24 passed.
   - Fixed: the recorded test now parses the capabilities inside the test, so the answer-first summary is the
     one parsed. The framework test expects the lead line.
4. **t973-vitest3.** The 4 fixed files: 4 passed.
5. **t973-check2.** tsc on the F20 files and their importers (`evidence-loop.ts`, `assistant/loop/loop-watch.ts`)
   gave `TSC_EXIT=0`. vitest on `repeat-guard/**`, `decision-handlers/tests`, `evidence-loop/tests/repeat-guard`
   and `conversations/assistant/loop`: 48 files passed.
6. **t973-audit.** 6 violations: the replay-facts import cycle and two statement-packing lines in my tests.
   - Fixed the cycle by moving the id into its own module, and unpacked the test lines.
7. **t973-audit2.** A naming violation: three `flow-` files in one directory. Fixed by renaming the module to
   `run-flow-tool-id.ts`.
8. **t973-check3.** Run on the final state:
   - tsc: `TSC_EXIT=0`;
   - structure audit: `structure-audit: passed (560 warning(s), 911 baselined).`;
   - vitest on `conversations/instructions/tests`, `replay-facts`, `node-tools/run`, `loop-detection`,
     `panel-command-climb` and the framework domain-instructions test: 20 files passed.

### What the new tests prove

**`recorded-chat-requests.test.ts`** reads the three recorded step 0001 files, `request.json` and
`decision.json`, copied to `instructions/tests/fixtures/`. For each:
- **The recording is the failure.** The model was Haiku with thinking disabled, the request carried the old
  wording, and the reply was a bare `reply`.
- **The guidance now leads to a start.** Built from the same message, page and domain text, the guidance
  declares intent, never answers a task with a reply, makes permission FluxIQ's own, and uses the new summary.
  It also contains no long word from the task's message.
- **The recorded reply does not stand.** It is asked again with `climb: reply_undeclared`, and the start that
  follows is taken.
- **A declared task becomes a start.** When every answer is a declared task replied in words, the turn ends as
  `flow.createHere` with the whole message. The climb reasons are `[none, task_answered_in_words, task_answered_in_words]`.

**`unanswered-task.test.ts`** is the routing unit test: reading the declaration, which replies stand, where an
unanswered task goes, and how the climb behaves within a turn.

**`panel-command-climb.test.ts`** covers the adapter:
- a climbed call goes Haiku to Sonnet with no thinking;
- Opus stays on Opus;
- the step meta holds `climb: {from: "claude-haiku-5-5", reason}`.

**`replay-again.test.ts`** replays run-17's exact sequence, with looks, adds and the amendment in between:
- the first finding comes at replay 4 with `repeats: 3` and `replays: true`;
- after "continue", every later replay asks again (findings at 4 through 13, last `repeats: 12`);
- `change_approach` refuses the next replay before it runs;
- a changed result, rows never seen before, the first time the end is reached, and a completion tried each
  start the count again;
- calls that are not replays are never counted.

**`replay-facts.test.ts`** covers reading the fact from run_flow's answer.

## Not verified

- **No live run and no model call.** The tests prove that the guidance and the guard make a prose reply
  impossible to keep. They do not prove Haiku now answers `do` on the first try, which needs a live chat call.
  If Haiku still replies, the turn climbs to Sonnet and, failing that, starts the task itself.
- **The live detector path.** That the live loop hands run_flow's evidence to `automationStudioLlmEvidenceLoopRan`
  as `answer` with `passed`, `rows` and `resultList` at its top level is read from the code (`flow-part.ts`,
  `evidence-loop.ts:518`). It was not observed in a live run, because the recorded step logs show only compacted
  evidence.
- **Whether run 17's replays changed the result.** I could not confirm per replay that none carried a
  `resultList` note. `rowsKept.totalRows` stayed at 5 throughout.
- **No package typecheck or full suite**, per the user's rule.
- **The extension repository** was not touched or tested.

## Open questions or contradictions found

- **A routing judgement call.** When the attempts run out and the model declared a task but still replied,
  the route starts createHere without the model choosing it. I judged this right under the user's rules (act on
  a clear instruction; only stop when truly impossible, and "impossible" has the `ask` shape). If the lead
  prefers the reply to be shown instead, it is one line in `unanswered-route.ts`.
- **Leftover PIN machinery.** `panel-command-pin.ts` and the vocabulary's re-authorize sentence ("the person
  proving who they are again") still describe a PIN for re-authorizing panel commands. The MVP has no PIN. Those
  lines were not in these prompts, because no offered capability re-authorizes, so I left them alone.
- **Two meanings of "reaches the end".** The brief says a replay that reaches the end is progress. Run 17's
  `{from: 38}` replays did run to the end, so I count only the first time the end is reached after the result
  changes. Otherwise the run-17 pattern could not be caught.
