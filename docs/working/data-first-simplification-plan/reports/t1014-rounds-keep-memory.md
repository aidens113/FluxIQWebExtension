# t1014: a fresh round keeps what the model learned; unreadable decider replies go to loop detection - report

## Outcome

Done, including the lead's three follow-ups (section "Follow-ups from the lead" below). Every fresh round now starts
with what the earlier rounds did and found, a carried-on attempt's first round included. Where the loop takes
`loopSignal`, no count ends a round any more:

- the same unreadable decider reply twice in a row is a loop finding for the deciding role;
- three decisions refused for one reason are a loop finding;
- a completion refused again over the same draft is a loop finding.

Each is steered with the model's loop decision, and only the ladder's last rung ends the round. The named tests (with
`decision-handlers/tests`), `pnpm --filter fluxiq check` and the structure audit: results under "Commands run". No live
run.

## What emptied memory, and how it is now carried

**What emptied it.** Each answer-first round runs one evidence loop, and that loop starts its window from nothing
(`runtime/llm/evidence-loop.ts`, `const evidence = []`). When a round ended, the next round's window held only its
note (the tried list in counts and codes, acts, rows kept, last check) and its own opening look. This happened however
the round ended, not only in the two cases the brief named:

1. loop detection's last rung (the `change_approach` / `ask_person` signal; `rounds.ts` steers a fresh round);
2. unreadable decider replies, six in a row (`maxUnreadableRepliesInARow`, `llm_evidence_loop.unreadable_replies`);
3. the completion check's own ladder (`round.ts` `checked`, `refusalEndedRound`);
4. stalls not yet on the ladder: three decisions refused for one reason in a row (`decision-handlers/refusal-run.ts`),
   and a completion refused for the same draft alongside refused repeats (`evidence-loop.ts` `unusable`, `repeatsStall`);
5. a round that threw, and a backoff.

**How it is carried now.** The fix is one structural change at the attempt level. From the second round on, the
decider's window is `[note, core.earlier_rounds, ...the round's own evidence, core.result]`. The `core.earlier_rounds`
entry is built once as the round starts, so it is constant for the round and keeps the request prefix cache-stable.
It holds every call the attempt made before that round, read from the attempt's trail (`run.trail`, the same per-call
record the judge reads, kept across rounds and a resume). Each call carries `{ n, did, on, asked, outcome, where, found }`:

- `where` holds the pages and locations reached;
- `found` holds finds, element descriptions and a read's rows;
- `outcome` and `found` hold acts and how they came back;
- `asked` holds what each call was asked.

Because the entry is built from the attempt's record and not from how the round ended, it covers all five endings above.

- **No raw page dumps.** Each top-level view key the domain declares is replaced by `core.view_not_carried`. These are
  the `observedStateKeys` with no holder; on the web they are `elements`, `dialogs`, `blockedBy`, `page` and `judgeState`.
  Held views such as `read.extracted` (a read's rows) are kept. The round's opening look shows the page as it stands now.
- **Screened like the judge's trail** (`automationStudioResultTrailScreened`). Denied keys and credential-shaped strings
  are withheld, locator text is rewritten, and times and minted ids are left out.
- **Fitted to the context window.** The entry may use a quarter of the model's input window, taken from
  `input.provider.tokenLimits` and measured at the judge's 1.8 bytes per token. When it does not fit, the oldest calls'
  `found` is summarised first, then their `asked`. Each summary sits in place as `core.summarised` (counts, keys and
  list lengths). Nothing is dropped: every call keeps `n`, `did`, `outcome` and `where`, and a `summarised` member says
  that summarising happened.
- **The note is unchanged.** It still carries the tried list, `loopStopped`, the model's decisions and the judge's
  defects (t1011/t1008), all in Core's own words. The steer still names the repeat and asks for a different way.
- **Nothing navigates.** The fresh round's opening look runs where the page stands (the `run.arrived` logic is
  unchanged). The new integration test checks this.

**Unreadable decider replies (decision 2).** These changes apply only where the loop takes `loopSignal`, which the
answer-first rounds do. A loop without `loopSignal` still ends after six unreadable replies in a row, as before.

- **No count ends the round.** The unreadable counter runs with an infinite limit. The re-ask note no longer says
  "N unreadable replies in a row stop this build" and no longer carries `maxUnreadableInARow`. Instead it says that a
  reply sent the same way again is caught as a repeat.
- **Each re-ask names what failed.** It names what could not be read and, for a reply that does not fit the schema,
  adds `At fault: <path> <rule>`.
- **The same failure twice in a row is a loop finding.** "The same way" means the same clause: the case words plus the
  schema misses (`automationStudioLlmUnreadableDecisionSaid`). Two or more such replies in a row are an `exact_repeat`
  finding under `evidence_tool_decision`. It is put on the ladder through `automationStudioLlmEvidenceLoopCaught`, the
  same route as t1008's run of looks.
- **The model is steered and decides.** The steer is a `core.loop_check` note plus the `core.loop_decision` ask. It says
  nothing is refused, because no call ran.
- **Only the last rung ends the round.** Further replies failing the same way climb the ladder. The last rung is
  `change_approach`, recorded as `stoppedOn`, and the next round keeps its memory as described above.
- Replies that fail in different ways are never a repeat. They are asked again until the purse ends the task.
- A reply that is read breaks the run.

## What changed and why

All changes are in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t1014/!FluxIQ`, branch
`task/t1014-rounds-keep-memory`:

- **`packages/fluxiq/src/framework/automation-service/service/answer-first/earlier-rounds/**` (new).** It holds
  `earlier-rounds.ts`, `carried-step.ts`, `fitted.ts`, `tool-id.ts`, `view-not-carried.ts`, a barrel, and
  `tests/earlier-rounds.test.ts`, with one export per file. It sits beside `attempt/` rather than inside it: inside
  `attempt/` the structure audit failed both its 9-segment path-depth limit and `attempt/`'s 25-file limit.
- **`.../answer-first/attempt/round.ts` and `decide.ts`.** `round.ts` builds the entry when `ordinal > 1`, and
  `decide.ts` puts it after the note. The header comments of `rounds.ts` and `round-note.ts` are updated to match.
- **`.../answer-first/tests/endings/tests/rounds-keep-memory.test.ts` (new, real-sql).** This is the integration test.
  It lives under `tests/endings/` because `attempt/tests/` was at its 25-file limit.
- **`.../answer-first/tests/endings/tests/stalls.test.ts`.** The test "unreadable replies are a fresh round" now
  asserts the new behaviour. The fresh round comes from loop detection's last rung on `evidence_tool_decision`, its note
  says "replies could not be read, each the same way", and at least one change of approach is counted.
- **`packages/fluxiq/src/runtime/llm/repeat-guard/loop-detection/unreadable/**` (new).** It holds the same-way tracker
  and the tool id, a barrel, and `tests/unreadable-loop.test.ts`. `loop-detection/index.ts` exports it.
- **`.../loop-detection/feedback.ts`.** It adds the steer, `stoppedOn` and chat wording for an unreadable-reply finding.
  That wording no longer says "refused before it runs".
- **`packages/fluxiq/src/runtime/llm/unusable-decision.ts`.** The unreadable note has an uncounted form, and there is a
  new `automationStudioLlmUnreadableDecisionSaid`.
- **`packages/fluxiq/src/runtime/llm/evidence-loop/unreadable-reply.ts` (new) and `evidence-loop/index.ts`.** The loop's
  unreadable-reply handling moved here: the count, the same-way tracker, the feedback and the hand-off to the ladder.
  What it records and tells is passed in as callbacks, so the module closes no import cycle.
- **`packages/fluxiq/src/runtime/llm/evidence-loop.ts`.** Only wiring changed: it builds the handler and acts on its
  three outcomes (end, recover, stall). The file is exactly at its 800-line limit (it was 800 before).
- **`packages/fluxiq/package.json`.** Version 0.54.7 -> 0.54.8.
- **`docs/architecture/automation-studio/failure-control.md`.** Two new paragraphs follow "No count ends a loop with a
  `loopSignal`".

**Tests written for the brief's four cases:**

- **A fresh round after the last rung holds the prior round's evidence and tried list.** The fresh round's window shows
  the read's rows, and the failed calls with their outcome and the parameters they were asked with, numbered in order,
  with no page text. Its note still holds the tried list and `loopStopped`.
- **The page is not navigated.** Between the first round's last decision and the fresh round's first, only that
  decision's own call and a look ran, and nothing reset the site.
- **A repeated unreadable decider reply is a loop finding, not a round end.** It produces `exact_repeat` under
  `evidence_tool_decision`, with the `core.loop_decision` ask.
- **No count ends a round.** Ten unreadable replies in a row (more than the old limit of six), each failing a different
  way, are followed by the result in the same round.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t1014/!FluxIQ/packages/fluxiq` (the structure audit from the repo
root), one at a time, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- ...`.

1. **First pass of the new tests.**
   `node ../../scripts/vitest-groups.mjs --groups=parallel <the new test dirs> ... --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
   - First run: 4 failed. The trail screen imports through the LLM barrel and is undefined when the test loads it first,
     so the test now imports `runtime/llm/index.ts` first.
   - Then 2 failed, both on my own expectations. The reply account keeps a schema rule only if it starts with "must",
     "is", "does" or "fits". The fitting test's window was also too small to leave any call whole.
   - After those fixes: `Test Files 25 passed (25)`, `Tests 204 passed (204)`.
2. **The new integration test plus `stalls.test.ts` (real-sql).** The new test passed. The `stalls.test.ts`
   "unreadable replies" case failed on `expected ... to contain 'unreadable'`, which is the intended behaviour change,
   so I updated the test as described above.
3. **The full set of named tests.**
   `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first/attempt src/framework/automation-service/service/answer-first/earlier-rounds src/framework/automation-service/service/answer-first/tests/endings src/framework/automation-service/service/answer-first/loop-signal src/runtime/llm/tests/unusable-decision.test.ts src/runtime/llm/evidence-loop/tests src/runtime/llm/repeat-guard src/runtime/llm/deepseek/tests/system-prompt.test.ts src/runtime/llm/provider-task/tests/default-wording.test.ts src/framework/automation-service/tests/service-bootstrap/tests/unreadable-replies.test.ts src/runtime/llm/decision-handlers/tests/loop-decision.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
   - Final run: parallel `Test Files 80 passed (80)`, `Tests 818 passed (818)`; real-sql `Test Files 30 passed (30)`,
     `Tests 134 passed (134)`; `[vitest-groups] all groups passed: parallel, real-sql`.
   - It passed with the same counts before the refactor and move as well.
4. **Typecheck: `pnpm --filter fluxiq check`.**
   - First run: one error, `earlier-rounds.ts(51,76): error TS2345` (the type `flatMap` inferred). I fixed it.
   - Then exit 0.
   - After the refactor: exit 0 again (`RESULT 0`).
5. **Structure audit: `node scripts/structure-audit.mjs`** (from the repo root).
   - First run: 10 violations. These were the `attempt/tests` file count, `evidence-loop.ts` at 819 lines, a non-barrel
     import, six path-depth violations, and statement packing at 20 against a baseline of 19.
   - After the move and the extraction of `unreadable-reply.ts`: 2 import-cycle violations. I removed the cycle by
     passing the loop's recording and telling in as callbacks.
   - Then one violation: the file was at 802 lines. I shortened two comments.
   - Final: `structure-audit: passed (571 warning(s), 903 baselined)`.

## Not verified

- **No live, Lab, provider or paid run, as briefed.** Whether Haiku uses the carried evidence instead of looking again is
  model behaviour that no provider-free test can prove. The tests prove only what the model is shown.
- **Prompt pins were not regenerated.** The system prompt did not change, and the pin owners passed
  (`deepseek/tests/system-prompt.test.ts`, `provider-task/tests/default-wording.test.ts`).
- **The carry-on test was not run against the old condition** to watch it fail. It asserts the entry is there in a
  carried-on first round, which only the new `|| run.prior !== undefined` condition produces (rounds count from 1 in
  each segment).
- **No downstream web-extension checks.** Nothing downstream changed.

## Open questions or contradictions found

- **Where the follow-ups differ from the lead's wording.** For items 1 and 2 the lead quoted my earlier suggestion,
  `automationStudioLlmEvidenceLoopRaise(..., loops.stalling())`. Raising `stalling()` at the third refusal would still end
  the round exactly at the count: a change of approach is the ladder's last rung. That would break the lead's own
  requirement that no count ends the round. So each run is instead put on the ladder as a finding
  (`automationStudioLlmEvidenceLoopCaught`): it is steered with the model's loop decision, each further one climbs the
  ladder, and the round ends only when the ladder's own `due()` rung is raised through
  `automationStudioLlmEvidenceLoopRaise`. This is the same route as the run of looks (t1008) and the unreadable replies.
  If the lead wants the literal `stalling()` form, it is a one-line change in each of `onTheLadder` and
  `automationStudioLlmEvidenceRefusedAgainEnds`.
- **Guards that persist within a round now show.** Two tests in `tests/endings` had passed only because a count-ended
  fresh round reset the repeat guard: `refused-completion.test.ts` ("new evidence between completions") and
  `refused-rows-not-read.test.ts`. In the first, the fake site gains a loan with no action, and the same read, or the
  same `amend_draft` rerun, on the same draft is refused unrun even after a look shows the change ("already tried exactly
  this way"). I changed that test so the model looks with its own input and reruns its read step with a distinct
  `pass`. Its expectations are unchanged: 5 rows, 3 judge calls, near-repeat ladder `{2,2,0,0}`. The second test now
  asserts the repeat is caught and the read happens in the same round, with no "Carrying on".

  The underlying point is for the lead. On the same draft, the repeat guard refuses an identical read or rerun that
  would bring new rows, if the page changed without the loop seeing an action. On a real site that is rare, and a model
  can look and read differently. But a count no longer covers for it.
- **Paths outside the literal ownership list.** The brief owns `runtime/llm/evidence-loop/**`. I also edited the file
  `runtime/llm/evidence-loop.ts`, but only to wire things up; the logic is in `evidence-loop/unreadable-reply.ts`. I also
  created two paths the structure rules forced: `answer-first/earlier-rounds/` sits beside `attempt/` and is not owned
  by t1013, and the integration test is in `answer-first/tests/endings/tests/`.
- **Advice wording after an unreadable loop.** `answer-first/loop-signal/told-fresh-round.ts` (not mine) adds "another
  control, another page..." after the `stoppedOn` words. For an unreadable-reply loop, "fix what core.decision_check
  names" would fit better.
- **A stale header comment.** The header of `runtime/models/failures/unreadable-reply.ts` (not mine) still says an
  unbroken run of unreadable replies ends the loop. That is now true only for loops without `loopSignal`.
- **Version.** It is left at 0.54.8, as the lead asked; the lead re-bumps at merge.

## Follow-ups from the lead (after the first hand-back)

1. **Refusal runs, `decision-handlers/refusal-run.ts`.** With `loopSignal`, three or more decisions refused (or changing
   nothing) for one reason are a `no_progress` finding under `core.refusal_run`. It goes on the ladder through
   `automationStudioLlmEvidenceLoopCaught`. The round ends only when `context.loops.due()` gives the ladder's rung and
   `automationStudioLlmEvidenceLoopRaise` does not answer `continue` (`onTheLadder`). The warning at the second refusal
   now says the next one "is caught as a repeat, and you decide how to go on", and carries no `maxInARow`. Loops without
   a signal keep the 2026-10-06 rule unchanged. The id is new, in `repeat-guard/loop-detection/refused-run.ts`, with
   steer and chat wording in `feedback.ts`.
2. **`repeatsStall`.** The logic is in `runtime/llm/evidence-loop/refused-again.ts`
   (`automationStudioLlmEvidenceRefusedAgainEnds`), wired on the existing line in `evidence-loop.ts`, which stays at 800
   lines. With `loopSignal`, the completion refused again is a `near_repeat` finding under `core.completion_check`,
   caught on the ladder, and it ends the round only on the ladder's rung. The steer now reads "You have completed N
   times over the same draft, and the check refused it the same way each time". The ladder's steps are passed in, so
   the module closes no import cycle.
3. **Carry-on.** `round.ts` builds the entry when `round.ordinal > 1 || run.prior !== undefined`.

**Tests added:**

- `decision-handlers/tests/refusals-of-one-kind.test.ts`. The repeated refusal is caught, the model is asked to decide,
  and the result comes in the same round with no signal. Refused on and on, it ends only on the ladder's
  `change_approach`, past the old count. (`decision-handlers/tests/` is at its 25-file limit, so the tests were added to
  the existing file.)
- `evidence-loop/tests/repeat-guard.test.ts`. Unit tests of `automationStudioLlmEvidenceRefusedAgainEnds`, plus a test
  through the loop: the refused completion is steered under `core.completion_check`, and the round ends on loop
  detection's signal. (`evidence-loop/tests/` is also at its 25-file limit.)
- `tests/endings/tests/rounds-keep-memory.test.ts`. A carried-on attempt's first round holds the earlier segment's read,
  with its rows, and its two presses, with no page view.

**Final verification after the follow-ups**, run one at a time through the heavy slot:

- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <the named groups above> src/runtime/llm/decision-handlers/tests src/framework/automation-service/service/answer-first/tests/carry-on.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
  - Parallel: `Test Files 104 passed (104)`, `Tests 920 passed (920)`.
  - Real-sql: `Test Files 31 passed (31)`, `Tests 155 passed (155)`.
  - `[vitest-groups] all groups passed: parallel, real-sql`.
  - Earlier runs of this set failed in two places, both fixed: two endings tests that relied on count-ended rounds
    (updated as described under "Open questions"), and statement packing in my new test lines.
- `pnpm --filter fluxiq check` -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (571 warning(s), 903 baselined)`.
