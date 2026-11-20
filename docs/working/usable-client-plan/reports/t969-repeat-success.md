# t969 repeat-success report

Outcome: Partial (own folders green; 7 tests in answer-first/** fail by design of the new ask_person gate, outside my ownership).

## What changed and why
All under packages/fluxiq/src/runtime/llm in the t969 Core tree.
- repeat-guard/loop-detection/detector.ts, limits.ts, types.ts, feedback.ts: new "success again" read. A call that succeeded (not refused, not exempt, not a look, not a fix) with the same normalised input, the same result (same answer digest, or same ending state + result code), the same place, and no new row or draft since, counted per call key. The 3rd identical one (AUTOMATION_STUDIO_LLM_LOOP_SAME_SUCCESS_AT = 3) returns a finding; further ones keep counting, so a "continue" decision gets asked again with the count. It overrides the "progressed" reading (a replay lands an act / page each time, which is what hid F15). A changed result (new rows, new answer, another place) restarts it. Entries expire after the existing no-progress window. Pre-run: once the model decided change_approach, the repeat is refused through the existing ladder.
- Pattern naming: reported as `near_repeat` with `succeeded: true` on the finding, because a new pattern name would have to enter the contracts package and answer-first mapping (outside my paths; would crash their tally). Words: "went through every time with the same result".
- loop-decision/options.ts (new), ask.ts, tool.ts, read.ts, index.ts; decision-handlers/loop-decision-options.ts (new), loop-check.ts, refusal-decision-ask.ts, model-decision.ts: ask_person is a last resort. Not offered on first detection; offered only after the attempt changed approach (model's change_approach decisions or ladder fresh approaches >= 1) AND the ladder climbed (or has nothing to climb). The ask names the offered options and says asking is only for a task genuinely impossible under the person's instructions (not difficulty or a repeat). ask_person now needs `why` (what is impossible and why) as well as `question`; missing why is answered with what is missing; calling it when not offered is answered `core.loop_decision.ask_person_not_offered`. The loop_decision step meta records offered, askPerson ("offered" | "after_change_approach" | "after_model_climb"), approachesChanged, climbedOrAtTop, computed before the decision changes them.
- Tests: detector.test.ts (3: 3rd identical run_flow fires, changed rows never fires, restart/continue counting); decision-handlers/tests/loop-decision.test.ts (ask absent on first detection and refused if called; absent after change alone or climb alone, present after both; needs why; meta).

## Commands run and observed
- vitest run repeat-guard loop-decision decision-handlers (via heavy slot) -> 43 files passed, 271 tests passed.
- `node scripts/structure-audit.mjs` -> passed (558 warnings, 911 baselined); detector.ts now 404 lines (advisory >400 only, was 370).
- vitest on answer-first/loop-signal, tests/endings, identical-rows, automation-activity refused-loop-call, evidence-loop/tests -> 44 passed, 3 failed files / 7 tests failed.

## Failing (not mine to edit: answer-first/**)
identical-rows.test.ts (3 tests), endings/tests/person.test.ts (2), endings/tests/refused-completion.test.ts (2). They drive a scripted model that answers ask_person with only a question at the first detection; under the new rule that is refused (no why, not yet offered). Fix: those tests must seed an attempt record with a prior change_approach decision and a ladder climb, and pass `why`. I did not confirm each failure line by line beyond the test names.

## Not verified
Live run; whether run_flow's real result digest is stable (timestamps in the answer would defeat the same-answer test, the same-ending fallback covers equal state + code); the 7 failures' exact cause; no package typecheck run (user rule).

## Addendum: answer-first tests updated (lead's permission)
- identical-rows.test.ts: the scripted model changes approach first, then (once core's ask lists ask_person as offered) asks the person with a `why`. Passed (run 5).
- endings/tests/person.test.ts: same sequence; recorded decisions now ["change_approach","ask_person"]. Passed (run 6).
- endings/tests/refused-completion.test.ts: after refused completions ask_person cannot be reached before a ladder-driven fresh round (the second refused completion after a change_approach stalls the round), so the two ask tests there were replaced by one that shows the model's non-ask choice: ask_person not offered at the first decision (checked), change_approach carried out, nobody is asked, attempt goes on to budget_out, one judge call. The "person's answer reaches a later round" subject is still proven by person.test.ts; the refused-completion variant of it was removed.
- File moved to avoid a structure-audit naming violation: decision-handlers/decision-options.ts (was loop-decision-options.ts).

## Final observed results
- vitest repeat-guard + loop-decision + decision-handlers + refused-completion.test.ts (run 7): 43 passed, the then-stale refused test failed; re-run of refused-completion.test.ts alone after the fix: 5/5 passed.
- vitest identical-rows + person + refused-completion (runs 5, 6, 9): all pass after the edits above.
- `node scripts/structure-audit.mjs` -> passed (558 warnings, 911 baselined).
Not re-run after the last edit: the full set in one command (only because the heavy-slot queue took ~25 min per run).
