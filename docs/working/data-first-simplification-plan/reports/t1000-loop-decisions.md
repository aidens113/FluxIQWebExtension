# t1000 Loop decisions: worker report

Worker: worker-heavy, 2026-11-23. Tree: `fxwork/t1000/!FluxIQ` (branch `task/t1000-loop-decisions`). Nothing was committed.

## Outcome

Done. Both defects are fixed in their owning modules, and the tests the brief asked for are written and pass. The `endings/person` test is back on the rule. `fluxiq` is bumped 0.54.3 to 0.54.4 (dev is 0.54.3). The narrow tests, `pnpm --filter fluxiq check` and the Core structure audit all pass.

## What changed and why

### Defect 1: `ask_person` was offered at the first catch

- **Cause.** Commit 002650596 (t983, U1) removed the model ladder. It also removed the whole `ask_person` gate in `loop-decision/options.ts`, the refusal in `decision-handlers/model-decision.ts`, and the last-resort wording in `ask.ts` and `tool.ts`. The user's 2026-11-20 rule removed only the climb. c7b2c989a (t994 W1) then changed `endings/person` to expect `["ask_person"]`.
- **Fix: the gate without the ladder.**
  - `loop-decision/options.ts`: `ask_person` is offered only when the attempt has changed approach at least once AND a repeat was caught again since (`persisting`).
  - `askPerson` is now `"offered" | "after_change_approach" | "after_repeat_persists"`. The unused `climbedOrAtTop` field is gone.
- **Where "the loop persists" comes from.** `repeat-guard/loop-detection/attempt-record.ts` gained an in-memory `persisting` flag:
  - `noted()` sets it. Every catch calls `noted()`: the watch, a refused repeat, and a completion refused again.
  - `approachChanged()` and a `change_approach` decision clear it.
  - It is not kept on the attempt row, so a carried-on attempt must be caught again before it may ask.
- `decision-handlers/decision-options.ts` passes `persisting` through.
- `decision-handlers/model-decision.ts` restores the refusal `core.loop_decision.ask_person_not_offered`. The refusal lists what is offered and says why asking is not open yet.
- **Wording.** `ask.ts` says asking is a last resort until it is offered. The `tool.ts` description no longer says "available without changing models".
- An `ask_person` with no stated reason was already refused in `read.ts`, and it still is.
- `endings/person.test.ts` expects `["change_approach", "ask_person"]` again. Its comment quotes the user's words and cites t983, t994 and this brief. Only the comment and that one expectation changed: the script already changed approach whenever `ask_person` was not offered.

### Defect 2: an unreadable judge reply was asked again, unchanged, forever

- **Cause (021b1f631, t979), in two parts.**
  1. **The re-ask did not say what was wrong.** The note was built from the reply's case alone (`unreadable-asks/reply-said.ts`). For a reply that was valid JSON but did not fit the schema, it said only "it did not fit the answer asked for". The Anthropic adapter already reports where the reply missed the schema (path and rule), and that detail was thrown away. So nothing told the next reply what to change.
  2. **Nothing noticed the repeat.** The same unreadable reply coming back again was never treated as a loop.
- **The 2,399-call fixture.** Its judge replied without `diagnosis.defects`. The note never named that field, and each of the 2,399 asks was identical to the last.
- **Fix, with no cap and no wait.**
  - `reply-said.ts`: the clause now names each schema miss, for example `it was JSON, but it did not fit the answer asked for: response.diagnosis.defects is missing, and it must be there`. These come from the bounded reply account, so they hold only schema keys and schema rules, never the reply's content.
  - `asks.ts`: two or more unreadable replies in a row with the same `said` (same case, same misses) make an `exact_repeat` loop finding for the judge role, under tool id `loop_verification`.
    - It goes through the same loop-detection pieces as every other role: the finding type and a `loop` step folder with `rung: "steer"`.
    - `unread()` returns `"steered"`, and `asks.repeat` and `asks.steer` expose the finding and the steer.
    - A readable reply, or a different unreadable one, resets it.
  - New `unreadable-asks/steer.ts`: the steer. It names the repeat, how many times, and the judge's decision, in generic words.
  - `note.ts`: the steer is added at the end of the note, so it still comes after any cached prefix.
  - `verify.ts` and `flow-less/judge.ts` pass the steer in. `verify.ts` also marks the ask's intervention `verificationUnreadableRepeats`, and the Flow-less judge's step-log note says the reply was caught repeating itself.
  - The judge stays on its model. The purse, the budget and the deadline still end it, as before.
- **What the judge's loop decision may choose.** It decides inside its one reply, which is read as usual:
  - **`change_approach`:** send the answer again with exactly what Core named fixed.
  - **`finish_with_best`:** send the smallest answer the outputSchema takes, with every required field and `answersRequest: unknown` where it cannot tell. The check reads that as unsure, never as yes.
  - **Not `continue`:** nothing on the judge's side is waiting to change, so the same reply can only be read the same way.
  - **Not `ask_person`:** the judge is Core's check of a result. The person is asked only by the deciding model's own loop, as a last resort.

### Tests

- `decision-handlers/tests/loop-decision.test.ts`:
  - The first catch offers no `ask_person` and refuses one if called.
  - `ask_person` straight after a `change_approach`, before the repeat comes back, is refused.
  - `ask_person` joins after a `change_approach` once the repeat comes back, and the person is asked.
  - A seeded changed approach plus a new catch offers it.
  - A reasonless ask is refused even where offered.
  - The step meta shows `askPerson: "after_change_approach"`.
- `unreadable-asks/tests/asks.test.ts`: misses named, and anything that is not a schema path and rule left out; repeat detection with counts and resets; the steer offers only the two judge decisions; the note ends with the steer.
- `flow-less/tests/judge-unreadable.test.ts`:
  - The re-ask names the missing field, and a re-ask that parses settles exactly as a first readable answer.
  - A judge repeating one unreadable reply is caught and steered (2 and then 3 times), with `loop` step folders and step-log notes.
  - A different unreadable reply in between is not a repeat.
  - The t979 continuing-judge test now expects its second reply, which failed the same way as the first, to be steered.
- **The judge's decision itself.** No test checks that a judge chose `change_approach` or `finish_with_best`. Both are ordinary replies, read by the existing reader.

## Commands run and observed results

All runs were from `fxwork/t1000/!FluxIQ/packages/fluxiq` (the structure audit from the repo root), each through `heavy-slot.mjs run`, one at a time.

- `vitest-groups.mjs --groups=parallel src/runtime/llm/decision-handlers/tests/loop-decision.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> `Test Files 1 passed (1)`, `Tests 13 passed (13)`.
- The same flags over 55 named parallel-group files:
  - Directories: `decision-handlers/tests/*`, `repeat-guard/loop-detection/tests/*`, `answer-first/loop-signal/tests/*`, `unreadable-asks/tests/*`, `flow-less/tests/*`.
  - Single files: `tests/verify.test.ts`, `tests/judge-reply/tests/unreadable-reply.test.ts`, `tests/run-outcome.test.ts`, `build-yes-hold/tests/saved-flow-trial.test.ts`, `check-authorization/tests/repair.test.ts`, `automation-activity/tests/refused-loop-call.test.ts`.
  - Result: `Test Files 1 failed | 54 passed (55)`, `Tests 2 failed | 435 passed (437)`.
  - The 2 failures were the t979 continuing-judge test at line 223. It expected the old "asked again with a note" line, but its second reply now counts as a repeat. I updated that expectation.
- Rerun of `flow-less/tests/judge-unreadable.test.ts` -> `Test Files 1 passed (1)`, `Tests 12 passed (12)`.
- `--groups=real-sql` with the same flags over `endings/tests/{person,refused-completion,stuck-with-nobody,saved-shapes,judge}.test.ts`, `answer-first/tests/identical-rows.test.ts` and `completion/tests/judge-continues-decider.test.ts` -> `Test Files 7 passed (7)`, `Tests 39 passed (39)`.
- `pnpm --filter fluxiq check` -> exit 0. tsc ran in 96.6 s with no errors.
- `node scripts/structure-audit.mjs` (repo root) -> `structure-audit: passed (570 warning(s), 903 baselined)`. Touched files carry only advisory warnings: `person.test.ts` is 475 lines and `verify.ts` is 626 lines, both already over 400.

## Not verified

- No live or paid run, and no provider call. Whether a real Haiku judge changes its reply once told the exact path, or follows the steer, is untested.
- The `t994` fixture shape (a judge that answers the same whatever it is told) still re-asks until the deadline, purse or budget ends it, as the user's rule requires. The fix gives a real model what it needs to change; it does not limit a judge that never changes.
- Judge loops are recorded in step folders and step-log notes. They are not added to the attempt's `loopsCaught` and do not post a chat line: the judge's check has no handle on either, and both live outside my owned paths.
- No full suites, by the brief.

## Open questions or contradictions found (other Core paths, not touched)

1. `docs/architecture/automation-studio/failure-control.md` (around lines 134-146) still describes `ask_person` with no gate. It should say that asking is offered only after a `change_approach` and once the repeat comes back, and that a judge's repeated unreadable reply is steered (`unreadable-asks/steer.ts`).
2. `answer-first/completion/refused-words.ts:34` names `ask_person` in its text whether or not it is offered ("where it is offered"). The handler refuses it when it is not offered, so the behaviour is safe, but the wording should follow the offered list.
3. The comment at `answer-first/tests/identical-rows.test.ts:47` still mentions "the ladder climbed". It is only a comment; the test passes.
4. The evidence loop's own unreadable-reply count (`models/failures/unreadable-reply.ts`, 6 in a row ends the loop) is a separate path. It was not in scope, and it was left as it is.
