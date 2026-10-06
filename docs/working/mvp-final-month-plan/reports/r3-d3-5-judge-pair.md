# r3-d3-5-judge-pair: worker report

Brief: r3-d3-5-judge-pair (worker-high). Core tree `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQ`, branch `task/t275-live-lane-d`. No commits made.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Both parts were written test-first. I watched each new test fail before its fix and pass after it. The owning suites pass on two runs.

## What changed and why

Part 1: a yes that was never confirmed no longer finishes a build.

- `R/result-verification/agreement.ts`: with `confirmAnswer`, a first `answers` plus a second `basis: "model_unavailable"` now returns `unsettled(first, second, "model_unconfirmed", codes.unconfirmed, reason, verdicts)`. "model_unavailable" covers a call the purse refused, one that was never sent, and one that did not come back usable.
  - The reason reads: "This result was checked once: the first answer was that it does what was asked, and the second check, which confirms a yes, gave no answer, because it did not come back usable (<second.code>). " followed by `UNSETTLED.model_unconfirmed.run`.
  - A second reply of `unknown`, or a silent one (`model_silent`), still leaves the yes standing.
  - Without `confirmAnswer` nothing changes. The header table now splits "unknown or silent" from "unavailable", and the comment cites run-mux6nxst-c9bca37c D3-5.
- `R/result-verification/build-test/judge.ts`: comments only, no logic change.
  - Updated the header verdict table: yes, then answers/unknown/silent gives yes; yes, then a call not back usable gives unknown, or not_judged where the purse refused it.
  - Updated the paragraph that said "a refused confirmation of a first yes ... leaves that yes standing".
  - Updated the inline comment that said "contradicts nothing ... the yes stands".
  - The existing `refused && !yesStood` branch now returns `not_judged` with the spend, because the outcome is `unsure`. No test needed a logic change.

Part 2: reserve judging is not started when the purse cannot pay for the whole judging pair.

- `R/llm/build-purse/call-allowance.ts`: added `canHoldAll(calls)`, which checks spent + pending + calls <= maxCalls (true when there is no maxCalls).
- `R/llm/build-purse/purse.ts`: added the public `judgingFits(): boolean`. It returns:
  - true when nothing is kept back;
  - false when the kept-back `calls` do not fit under maxCalls (`canHoldAll`);
  - otherwise true when `judgingHoldUsd()` is undefined (unpriced), or when spentUsd + pendingUsd + hold <= ceiling + EPSILON.
- `R/flow-bootstrap/unfinished-build/reserve-judging.ts`: after the stepsInFlow/replayed_clean guard, and before `accept` and `input.judge`, it returns `{ kind: "not_judged" }` when `automationStudioLlmCurrentBuildPurse()` exists and `!judgingFits()`. It imports from `../../llm/build-purse/index.ts`. Added a header paragraph citing the run.

Tests (extended existing files; no new files):

- `R/result-verification/tests/agreement.test.ts`:
  - Renamed and narrowed the old test "a second call that is unknown, silent or unavailable leaves the first yes standing" to cover unknown and silent only.
  - Added "run mux6nxst: yes, then a confirming call that did not come back usable, is unconfirmed and unsure -- never a yes". It covers both a provider-timeout unavailable and an `llm_budget.run_call_limit` unavailable. It checks the exact reason, that there is no failure and no unconfirmedReading, and that without `confirmAnswer` the result is still a yes from one call.
- `R/result-verification/build-test/tests/judge.test.ts`:
  - "a confirming call the purse refuses ..." now expects `not_judged` (why mentions the spending limit), with the first call's tokens and cost and `calls: 2` still returned.
  - "keeps a scoped first yes ..." is renamed to "does not judge on a scoped first yes the call allowance refused to confirm, and still returns its paid usage". It now expects `not_judged` with "call allowance of 1" and the full paid usage.
  - The test "yes, then unknown or a call that did not come back" is renamed to "... a reply without an answer", since `{}` is a silent reply.
  - Added "yes, then a confirming call that failed, is unknown" (the provider throws on call 2).
- `R/llm/build-purse/tests/purse.test.ts`: added "says whether the whole judging kept back can still be held, on calls and on cost". It covers:
  - nothing kept back: true;
  - 46 of 48 calls spent: true;
  - 46 spent plus 1 pending: false;
  - 47 of 48 spent: false;
  - cost at $0.0912 spent: true, and at $0.0923 spent with a $0.0078 pair under $0.10: false;
  - an unpriced pair: true.
- `R/flow-bootstrap/unfinished-build/tests/reserve-judging.test.ts`: added a phases-level test run inside `automationStudioLlmBuildPurseScope(purse, ...)`.
  - Setup: purse `maxCalls: 3`, 2 calls spent, `keepBackForJudging({calls: 2, ...})`, and a round refused on calls.
  - It asserts the judge and `acceptStopped` were never called, the outcome is `unfinished` and `budget_exhausted` with bound `calls`, and spentCalls stays 2.

## Commands run and observed results

All commands ran from `packages/fluxiq`. The four target files are `R/result-verification/tests/agreement.test.ts`, `R/result-verification/build-test/tests/judge.test.ts`, `R/llm/build-purse/tests/purse.test.ts` and `R/flow-bootstrap/unfinished-build/tests/reserve-judging.test.ts`.

1. Before any fix, `npx vitest run` on the four target files: "Test Files 4 failed (4)", "Tests 6 failed | 64 passed (70)". The failures were:
   - the agreement mux6nxst test;
   - the judge refused-confirmation test;
   - the judge call-allowance test;
   - the judge "confirming call that failed" test;
   - the purse judgingFits test (method missing);
   - the reserve-judging test.
2. After the agreement fix and `judgingFits`, before the reserve-judging.ts edit, same four files: "Tests 1 failed | 69 passed (70)". The reserve test failed on behaviour: "AssertionError: expected 1 to be +0", meaning the judge was called once.
3. After all fixes, run twice:
   - the four files: "Test Files 4 passed (4)", "Tests 70 passed (70)", on both passes;
   - `npx vitest run R/flow-bootstrap/unfinished-build/tests R/result-verification/tests`: "Test Files 44 passed (44)", "Tests 415 passed (415)", on both passes.
4. Extra coverage, run once: `npx vitest run R/result-verification/build-test/tests R/llm/build-purse/tests`: "Test Files 14 passed (14)", "Tests 123 passed (123)".
5. `grep -rln "yes standing|yes stands|yesStood" src`: the only hits are judge.ts, judge.test.ts and agreement.test.ts, all for the unknown/silent rule that is still correct.

## Not verified

- No typecheck. The brief excluded fluxiq:check and the Core build, and vitest does not typecheck. The new code uses existing types, and the test file imports `automationStudioLlmBuildPurseScope` from the purse barrel, which exports it.
- The structure audit was not run (excluded by the brief). No test files were added, so no folder's file count changed.
- No live, Lab or browser run.
- The production wiring of the purse scope was confirmed only by reading: `service/flow-bootstrap-commands/creation-purse.ts` runs the build body inside `automationStudioLlmBuildPurseScope`. That makes `automationStudioLlmCurrentBuildPurse()` visible inside reserve-judging in production. The existing reserve-judging tests run unscoped, so they are unaffected by the new guard.

## Open questions or contradictions found

- `oneCallSaidYes` in judge.ts is set only for `model_disagreed`. A yes followed by an unavailable confirmation now comes back as `unknown` without `oneCallSaidYes`, although one call did say yes. I made no change, per the brief. The lead should decide whether the build's progress measure should count this case.
- phases.ts announces "Running the Flow as far as it got from its start, and judging it with what was kept back for judging" before the test runs. When `judgingFits()` is false, the judge is then never asked, so that sentence over-promises. phases.ts is outside my ownership.
- `UNSETTLED.model_unconfirmed.build` reads "Since neither confirmed it, the build cannot finish on this test." For a yes followed by no answer, "neither" is slightly off. That wording sits in `unsettled/unsettled-words.ts` and is swapped in by `check-activity.ts`, neither of which I own.
- `judgingFits()` does not count the call the judge's own first answer will take beyond the pair. The pair is the whole judging (2 calls) by design, so this matches the brief.
