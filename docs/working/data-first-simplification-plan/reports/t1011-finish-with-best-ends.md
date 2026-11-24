# t1011: a `finish_with_best` decision did not end the build

Worker report, 2026-11-24. Core tree `fxwork/t1011/!FluxIQ`. Evidence: run-mwug2xjw-41f62603, copied to the
ignored `fxwork/t1011/!FluxIQWebExtension/test-runs/t1011-evidence/`. No page data is quoted here.

## Cause, in plain words

`finish_with_best` worked as designed. At 0116 its result went to the completion check, and the check
correctly said no: the result kept rows priced above the limit the request set, and it held no condition
or distance data. The build was right not to end. A task ends only with its result or its purse, and this
result was wrong.

What went wrong is what the model was given next. Three things were missing or out of date:

1. **The no's list of what was wrong was dropped.** The judge gave a structured list of defects: two rows
   over the price limit, a sponsored row, and missing condition and distance columns. The Flow-less judge
   turned the no into prose only (`flow-less/judge.ts`, `readingWords`: observed, then "Asked for:",
   then advice). It also dropped Core's own check of the rows the no named (`repair.checked`). The last
   clause of the prose was "paging never reached a confirmed end". Core's own result header said the
   same thing: "nothing has said whether a page follows". So the only concrete pointer the model got was
   paging, and its next call was `find_on_page "Next"` (0120) on a page where it had already searched
   for "Next" at 0028 and 0034.
2. **Nothing joined the refusal to the loop.** The handler told the watch `decided("finish_with_best")`
   *before* the check ran, and that cleared the incident (the rung went back to `clear`). When the no
   came back, nothing was refused any more. The steer that had asked for the decision (`core.loop_check`,
   "your next decision is a call to core.loop_decision") stayed in the window. The decision's own answer
   still said "Your result is being checked as this attempt's result." The model got no Core signal that
   its next step had to be different. 0122 and 0124 (the same search twice) and 0128 and 0130 (the same
   detect twice, "to check for pagination") all ran.
3. **The refusal words left out the cheapest real fix.** They list what counts as new evidence, but they
   never named declaring the result's processing differently. That is what removes kept rows above a
   stated limit. The model said at 0137 and 0140 that "the £200 cap ... was not applied", but it never
   called `core.set_result_processing`.

## Q1, answered from the steps

- **Did the check run on the finished result?** Yes. 0116 `finish_with_best` led straight to 0117
  `judge` (taskKind `loop_verification`, continuing the decider) and then to 0118 `answer_first.judged_no`.
  `finish_with_best` was carried out as a completion.
- **What did it say three times?** There were three judge calls but only two checks:
  - 0117: no, on the `finish_with_best` result.
  - 0133: an unreadable reply (`response.summary` missing), asked again on its own request. This is
    t979's mechanism (note 0134).
  - 0135: no, on the 0132 `complete`.

  Both nos made the same points: rows above the price limit were kept, and the condition and distance
  columns were missing. Some of their defects were wrong. The "sponsored" row and the "duplicate" row
  named are not in the 27 rows held. The price defects are real: two held rows are above the limit.
  0137 and 0140 were refused as `same_evidence` with no judge call. 0141 is the completion ladder's
  `change_approach` signal, after which a fresh round began (0142).
- **What was the model told?** The model was told four things at 0119:
  - The `judged_no` feedback: the judge's prose, the generic `NEW_EVIDENCE` sentence, and `resultHolds`.
    It had no `defects`.
  - The stale `core.loop_check.50` steer, still asking for a loop decision.
  - A stale `core.search_check` and a stale `core.request_check`.
  - The loop decision's answer, "being checked".

  The prose's paging clause matched Core's own header line about paging, and the `NEW_EVIDENCE` text
  invites "a look at the page that shows what the check said it could not see". Nothing pointed at the
  rows the check named, and nothing was refused. That is why the model went back to the paging check.

## What changed, and why

All edits are in Core (`packages/fluxiq/`).

- **`src/runtime/result-verification/flow-less/judged-no-found.ts` (new)** and **`types.ts`.** A no now
  carries `found`: the judge's screened defects (`../verdict/defects.ts`) and Core's `checked` lines on
  the rows they name. Core's `fix` lines are left out on purpose, because they speak of a Flow's steps and
  record output. `reason` and what the person sees are unchanged.
- **`flow-less/judge.ts`.** On `does_not_answer`, attaches `found` from `verdict.repair`.
- **`flow-less/index.ts`.** Exports the type and the function.
- **`src/framework/.../answer-first/completion/check.ts`.**
  - A judge's no feedback now carries `defects` and `checkedRows` beside `instruction`.
  - `state.refused.found` keeps them, so a `same_evidence` refusal shows them again.
  - A caller's own check and an unsure read exactly as before.
- **`completion/refused-words.ts`.**
  - New `FOUND` words are added only when a no listed something. They say what `defects` and
    `checkedRows` are, ask the model to compare each with `resultHolds`, and say what each kind of defect
    is fixed by: processing or a filter for kept, duplicated or misordered rows; a read for missing rows
    or columns; a re-read for a wrong value; an act for a missing or wrong act.
  - `NEW_EVIDENCE` now also names "the result's processing declared anew so that it keeps other rows or
    another order". The pinned substring "a read that returns different rows or the same rows in a
    different order" is kept.
  - `sameEvidence` takes the same flag.
- **`src/runtime/llm/decision-handlers/model-decision.ts`.**
  - `finish_with_best` tells the watch only after the check answers. If accepted, the loop ends with that
    result, as before. If refused, it calls `loops.decided("change_approach")`, so the repeat stays
    refused.
  - The decision's "being checked" answer is replaced by `BEST_REFUSED`, with `accepted: false`: the
    result was not accepted, `core.completion_check` says why and what fixes each defect, the repeat stays
    refused, and the next step works on what the check named, a different way.
  - Any carried-out decision now supersedes `core.loop_check`, the steer whose question it answered.
- **`src/runtime/llm/loop-decision/tool.ts` and `ask.ts`.** The `finish_with_best` wording now adds:
  "if it is not accepted, the repeat stays refused and you work on what the check named".
- **`package.json`.** Version 0.54.4 to 0.54.5 (patch, fix).

Nothing caps or counts anything. There is no judge-call limit and no round ending. Every model-facing
sentence is generic.

Tests added:

- `runtime/llm/decision-handlers/tests/finish-with-best-refused.test.ts`. A refused best keeps the repeat
  refused: the next press is refused before it runs. The answer is replaced and the steer is gone. A yes
  still ends the task with that result. Any carried-out decision removes its steer.
- `runtime/result-verification/flow-less/tests/judged-no-found.test.ts`. Defects are carried, a
  credential-shaped defect is dropped, a yes or an unsure carries nothing, and `fix` lines are not carried.
- `answer-first/completion/tests/judged-no-found.test.ts`. The feedback carries `defects` and
  `checkedRows`, with the words pinned. They are carried again on the same evidence. A no that listed
  nothing and an unsure read as before. A yes is achieved.

## Commands run and observed results

All checks ran through `heavy-slot.mjs run <label> --`, one at a time.

- `vitest-groups.mjs --groups=parallel --maxWorkers=1 --minWorkers=1 --fileParallelism=false` on the
  three new tests, `loop-decision.test.ts` and `refused-again.test.ts`. One failure: my own assertion on
  the order of evidence entries. The window orders Core notes by slot, not by push order, so I removed the
  assertion. The rerun of that file passed: 3 of 3.
- The same command on `answer-first/completion/tests`, `runtime/llm/decision-handlers/tests`,
  `flow-less/tests/judge.test.ts`, `judge-unreadable.test.ts`, `unreadable-asks/tests/asks.test.ts` and
  the three answer-first ending tests: "Test Files 41 passed (41), Tests 243 passed (243)". The three
  ending tests are marked real-sql, so the parallel group skipped them.
- `pnpm --filter fluxiq check`: the first run failed with one TS2379 in my new completion test, from
  `exactOptionalPropertyTypes` on a fixture. After the fixture was fixed it passed: exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (570 warning(s), 903 baselined)". No
  warning names a file I changed.
- Final parallel rerun of the edited and new files plus `flow-less/tests/judge.test.ts`: "Test Files 6
  passed (6), Tests 76 passed (76)". This was after the last wording change to `BEST_REFUSED`.
- The real-sql group run of `refused-completion.test.ts`, `person.test.ts` and `identical-rows.test.ts`
  is in the addendum at the end of this report.

## Not verified

- No live or paid run. Whether Haiku now goes from a judged no to `core.set_result_processing` or a
  filter, rather than to a paging look, is not shown. Only the inputs it is given changed.
- Whether 0120's `find "Next"` would have been refused under the new rung is uncertain. It would be
  refused only if its page-state digest matched the earlier "Next" searches on that page (0028 and 0034).
  A cookie dismissal and a re-navigation happened in between, and the step files do not hold the digests.
  The later same-page repeats (0122 and 0124; 0128 and 0130) are the kind the refusing rung catches.
- No full package suite was run, per the narrow-check rule.

## Open questions, contradictions, and changes outside my paths

1. **Fresh round loses the defects.** `attempt/round-note.ts` (not owned) gives a fresh round
   `lastCheck: { verdict, reason }`. To carry the defects into a fresh round, change line 46 to:
   `...(refused ? { lastCheck: { verdict: refused.verdict, reason: refused.reason, ...(refused.found?.defects?.length ? { defects: refused.found.defects } : {}) } } : {}),`.
   Nothing in t1008's files (`round.ts`, `rounds.ts`, `run-attempt.ts`) needs to change: `round.ts`
   spreads `answer.feedback`, so the new keys reach the model.
2. **Header paging line contradicts the trail.** `answer-first/result/header.ts:70` says "nothing has
   said whether a page follows" even after a `dom-next_page` came back `output_not_observed` (trail step
   37) and a `find "Next"` found 0 matches. It, and the judge's own paging clause, pulled the model to
   paging. Whether a rejected next-page should settle the paging account is for the owner of
   `answer-first/result/` and the read account. Not changed here.
3. **Doc and watch comment are now out of date.** Core's `docs/architecture/automation-studio/failure-control.md`
   (around line 142) and the `decided` doc comment in `repeat-guard/loop-detection/watch.ts` (line 88)
   still say `finish_with_best` "ends the incident". Suggested doc wording: "`finish_with_best` (with
   `result`) goes to the completion check as any completion does; accepted, it is the attempt's result;
   refused, the repeat stays refused as after `change_approach`, the answer says it was not accepted,
   and the no's defects and Core's check of their rows reach the model beside its words (t1011)." Both
   files are outside my paths.
4. **Some judge defects were wrong.** Some defects in this run do not match the rows held (the
   sponsored row and the duplicate). The new words tell the model to compare each with `resultHolds`
   first. They are not located against Core's record. `located-defects/` would misjudge column-wide
   claims such as "all rows lack condition", so I did not use it.
5. **Condition was read but dropped from the result.** The run's reads extracted a condition field, but
   the result's columns were title, price, location and url. That is the not-yet-built data-first rule
   "extraction keeps every column", outside this brief.

## Addendum: real-sql run

Result of `vitest-groups.mjs --groups=real-sql` on `refused-completion.test.ts`, `person.test.ts` and
`identical-rows.test.ts`: "Test Files 3 passed (3), Tests 27 passed (27)", "all groups passed: real-sql".
This includes "a judged no's reason reaches its next request, whole" and the `NEW_EVIDENCE` substring pins.
