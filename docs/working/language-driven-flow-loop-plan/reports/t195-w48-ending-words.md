# t195-w48 ending words: report

## Outcome

Partial. The wording is done, the tests were shown failing and then passing, all four test directories pass, and the structure audit passed. `pnpm --filter fluxiq check` exited 2. Its only error is in `runtime/llm/evidence-loop/tests/repeat-guard.test.ts(165,125)` (TS2352). That file is outside my brief: it is under `runtime/llm/**`, which I must not touch, and another agent has uncommitted edits in it. None of my files has a type error.

## What changed and why

Only words changed. Which ending is chosen, and every field, kind and code, are unchanged. The counts a debug needs (`tried.rounds`, `tried.decisions`, `tried.stops`, `tried.noRoute.kind`) are still recorded in `tried`, so they no longer need to appear in the prose.

- `U/not-done.ts`
  - STOP_WORDS:
    - `iterations`: "it used all the tries it had before the Flow was finished"
    - `tool_calls`: "it used all the actions it had before the Flow was finished"
    - `unusable_decisions`: "too many attempts in a row went nowhere"
    - `judged_wrong`: "the Flow it thought was ready was not judged to do what you asked"
  - BLOCKED_WORDS now names "it" (the build) where it used to say "the model":
    - "it kept trying changes to the Flow that changed nothing"
    - "it kept retrying things that had already failed or done nothing"
    - "it kept looking again at what it had already seen"
    - "the replies it got back could not be read"
  - These clauses are shared. They also feed the phases.ts heading "The build stopped before the Flow was finished: ...", the not-doable ending and the budget-exhausted ending.
- `U/not-finished.ts`
  - The opening is now "I have not finished this Flow yet." followed by a separate sentence. That sentence starts "My last attempt to fix it got no further than the one before: ..." or "My last N attempts to fix it each got no further ...", and lists its clauses with commas and a final ", and".
  - Clauses: "the Flow came out exactly the same"; "the one thing you asked has a step as it did before", "... still has no step" or "... no longer has a step"; "N of the M things you asked have a step, no more than before"; "only N of the M ... have a step now, down from K".
  - "it stopped before the Flow was ready, though the attempt before it had got that far"; "it still failed at a step when tested"; "no more of its steps worked when it was run from the start".
  - The judge clauses "still could not tell whether it does what you asked" and "now found it does not do what you asked" replace "still could not judge it" and "still found it wrong".
  - The refused-repeats case now reads: "My first attempt" or "My last attempt to fix it" "kept retrying the same things, which had already failed or done nothing, and left the Flow just as it started, so trying again would only do the same".
  - The tried sentence is now "I worked on it live twice: first exploring the page, then fixing it once after testing what I had." The decision count is dropped from the prose and stays in `tried.decisions`.
  - New small helpers: `timesSaid`, `stepsAskedSaid` and `listSaid`.
- `U/tried.ts` is unchanged. It contains no prose, only the structured `tried` record. The "I tried ... over N decisions" sentence was in not-finished.ts.

New ending text, captured from a probe test that I then deleted. The output is in scratch `t195-w48-messages.txt`.

- Run musr9pv3 ending: "I have not finished this Flow yet. My last attempt to fix it got no further than the one before: the Flow came out exactly the same, the one thing you asked has a step as it did before, and no more of its steps worked when it was run from the start. The one thing you asked has a step that ran, or could run, when the Flow was run from its start. The Flow as far as it got (7 steps) ran from its start without failing. I worked on it live twice: first exploring the page, then fixing it once after testing what I had. The Flow so far was kept as a draft, not put into the Flow, and building again carries on from it."
- Run musp474o heading: "The build stopped before the Flow was finished: too many attempts in a row went nowhere, because it kept retrying things that had already failed or done nothing."

Tests:

- New, written to fail first:
  - `U/tests/not-finished.test.ts`, describe "the not-finished ending as a person reads it". It covers both runs' endings and checks that the text does not match `/decision|\bmodel\b|\bround\b|measurable|as before\)|handed back/iu`, and that `tried` still holds the rounds and decisions.
  - `U/tests/not-done.test.ts`, describe "the stop as a person reads it".
- Updated because they pinned the old strings:
  - `U/tests/not-done.test.ts` ("what the person is told stopped the build")
  - `U/tests/not-finished.test.ts` (the count tests and the "never says no way" opening regex)
  - `U/tests/judged.test.ts:158`
  - `U/tests/no-progress-ending.test.ts:107,166,178`
  - `U/tests/phases.test.ts:154,160`
  - `U/tests/repair-rounds.test.ts:159,213,225`
  - `runtime/tests/service-bootstrap/tests/unfinished-build.test.ts:183,185,230`

## Commands run and observed results

All commands were run from the Core root.

- Failing first: `npx vitest run ... unfinished-build/tests/not-finished.test.ts .../not-done.test.ts` printed `Tests 3 failed | 26 passed (29)`. The new assertions received "too many of its decisions in a row could not be used, because the model kept asking for..." and an ending that matched the internal-words pattern.
- After the source change but before updating the pinned tests, the four directories gave `Tests 18 failed | 1416 passed (1434)`. All 18 failures were old-string pins (scratch `t195-w48-run1.txt`).
- After updating them: `npx vitest run --exclude ".tmp/**" --testTimeout=30000 <flow-bootstrap> <service-bootstrap> <deepseek-bootstrap> <activity>` printed `Test Files 119 passed (119)` and `Tests 1440 passed (1440)` (scratch `t195-w48-run2.txt`).
- `bash .../heavy.sh "t195 w48 core check" pnpm --filter fluxiq check` exited 2. Its single error was `runtime/llm/evidence-loop/tests/repeat-guard.test.ts(165,125): error TS2352`. That file shows as modified (` M`) in git status, by another agent, and is not mine.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (242 warning(s), 349 baselined)` and exited 0.

## Not verified

- I did not see the new wording live in the extension chat.
- I did not get a check exit 0, because of another agent's file (above).
- I did not run the full suites.

## Open questions or contradictions found

- Other person-facing sentences still name internals, in files outside this brief:
  - `budget-exhausted.ts`: "I explored live once over N decisions, and what held it up was that ..." (pinned at phases.test.ts:298 and unfinished-build.test.ts:148).
  - `replies-unreadable.ts`: "The build stopped because the model's replies could not be read ..."
- `ProgressSaid` in not-done.ts still produces "has a step that ran, or could run, when the Flow was run from its start" and "0 of the 3 things you asked have a step that ran, or could run, ...". It contains none of the banned words, so I left it, but it is clumsy. A follow-up could reword it, along with the repeated "from its start" wording.
