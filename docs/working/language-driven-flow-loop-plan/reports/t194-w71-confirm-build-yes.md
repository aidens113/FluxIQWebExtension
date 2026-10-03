# t194-w71: a build's yes is confirmed by a second call

## Outcome

Done. The build-test judge now asks a second time after a first `yes`, using the same evidence. The runtime result check is unchanged.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`. These edits sit on top of w63's uncommitted `unconfirmedReading` work.

- `R/result-verification/agreement.ts`
  - New input `confirmAnswer` and a new exported type `AutomationStudioResultVerificationAskAgainOptions`.
  - `automationStudioResultVerificationAskAgain(first, { confirmAnswer })` now also asks again after a first model `answers` when the option is set. A silent or unavailable first call is still never asked again.
  - How the agreement reads a first `answers`:
    - (yes, yes) -> the first verdict, with `verdicts: [answers, answers]` and `calls: 2`.
    - (yes, no) -> `unsettled(... "model_disagreed", core.result.verdicts_disagree ...)`, so the verdict is unsure. It carries the `no` call's reading as `unconfirmedReading`, which is w63's path.
    - (yes, unknown/silent/unavailable) -> the first verdict, with `calls: 2`.
  - Updated the header comment and agreement table, including the murwcmx2 evidence (judges 0032 and 0051).
- `R/result-verification/verify.ts`
  - New request field `confirmAnswer?: boolean`, passed to both `AskAgain` and the agreement.
  - Header paragraph updated. When the field is unset, behaviour is as before.
- `R/result-verification/build-test/judge.ts`
  - Calls verify with `confirmAnswer: true`.
  - Updated the verdict-mapping table and the comments on spend and calls.
  - The cost split outside a purse (`maxCostUsd / 2` per call) is unchanged. It was already sized for two calls, which now happen after any answer.
  - Purse refusal: a purse refusal of the *confirming* call after a first yes no longer turns the verdict into `not_judged`. The yes stands (`yesStood` guard), as the brief requires for an unavailable second call, and both interventions' spend is still returned. A refusal on any other call still returns `not_judged`, as before.
- `R/result-verification/contracts.ts`: doc comments only (`model_disagreed` basis, `verdicts`).
- Tests:
  - `tests/agreement.test.ts`: 5 new tests.
  - `build-test/tests/judge.test.ts`: 5 new tests, including the murwcmx2 yes-then-no -> unknown case and a check that the runtime check still asks only once after a yes. The run 38 (C7) test now expects 2 calls; two judge-sized holds still fit in $0.009.
  - `build-test/tests/request-size.test.ts`: the capture helper now expects 2 calls carrying an identical `context`.

## Commands run and observed results

- Failing-first run, `npx vitest run` on agreement.test.ts and judge.test.ts before the implementation: `Tests 9 failed | 31 passed (40)`. All 9 failures were the new tests.
- After the implementation, `npx vitest run src/.../result-verification`: `Tests 6 failed | 241 passed (247)`. These were the old single-call-after-yes assertions (run 38 C7, and 5 in request-size via the shared helper). I updated them as described above.
- `npx vitest run` over R/result-verification, R/service/flow-bootstrap-commands, R/flow-bootstrap/unfinished-build and R/service/summaries: `Test Files 47 passed (47)`, `Tests 453 passed (453)`. I saw no failures from the concurrent worker.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w71 pnpm check fluxiq" pnpm check` in packages/fluxiq: the tsc build-cache step finished (`"step":"fluxiq:check","reason":"inputs changed ..."`, 33214 ms) and printed no errors.

## Not verified

- No live run. The cost of the extra call per build-test yes has not been measured live.
- Other directories that may script a single `yes` judge, beyond the four named, were not run. In the named ones a missing second answer reads as silent and the yes stands, so they pass.

## Open questions or contradictions found

- Under a purse, a refused confirming call leaves the yes standing. I followed the brief ("unavailable leaves the first yes standing"). The alternative is `not_judged`, which would stop a low-money build from ever finishing on a yes. If the lead wants a refusal to read as `not_judged` instead, it is a one-line change: drop the `yesStood` guard in judge.ts.
- `build-test/tests/request-size.test.ts` is outside the four named source files, but it is in `build-test/tests/`, so I treated it as owned.

## Doc paragraph for Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`

**A build's yes is asked twice.** The build-test judge's `yes` finishes a build, so its verification request sets `confirmAnswer`, and a first `yes` gets a second call with the same evidence (`result-verification/agreement.ts`). Two `yes` answers are a yes. A `yes` followed by a `no` is `model_disagreed`: unsure, carrying the `no` call's expected, observed and advice as `unconfirmedReading`, which the build reads as `unknown` and repairs with. A second call that answers `unknown`, gives no verdict, does not come back, or is refused by the build's purse leaves the first `yes` standing, because on correct results a `yes` was measured to flip to `unknown` and never to `no`. In live run murwcmx2, build judges 0032 and 0051 were sent the same request except for one step number. They answered `no` and then `yes`, and that single `yes` finished the build on rows the playback judge refused. The runtime result check does not set the option, and a first `yes` there still stands on one call. Outside a purse each judge call is capped at half of what the build has left. Under a purse each call is held at its own worst case.
