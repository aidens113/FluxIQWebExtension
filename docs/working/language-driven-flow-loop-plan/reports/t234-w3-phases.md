# t234 W3: phases, cost ending and judge draw from one build purse

## Outcome

Done. All five required behaviours are in. 85 of 85 tests pass in the two named directories. The 9 new tests were each run against the HEAD source and all 9 fail there. The scoped type check of my files is clean.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.

- `flow-bootstrap/unfinished-build/phases.ts`
  - `AutomationStudioFlowBootstrapBuildPhasesInput` and `AutomationStudioFlowBootstrapRoundRequest` each gain `purse?: AutomationStudioLlmBuildPurse | undefined`. Every round is handed the same purse.
  - When a purse is given:
    - `remaining()` keeps the whole `maxCostUsd` for every round. Tokens, duration and calls are unchanged.
    - `exhaustedBound()` checks cost as `purse.leftUsd() <= 1e-9`. This `PURSE_EMPTY_USD` slack matches the purse's own EPSILON. Without it, carried 0.09 plus 0.01 against a 0.10 ceiling leaves about 1e-17, and a repair would start with nothing to spend.
    - The judge's `budget.maxCostUsd` is `purse.leftUsd()`.
    - The cost ending's `sizes.maxCostUsd` is `purse.ceilingUsd`.
  - `costSpending()`:
    - With a purse and a refusal: the refusal's `spentUsd`/`pendingUsd` as they stand, with no `spentBefore` added. It passes `projectedCostUsd`, `carriedUsd` and `ceilingUsd` through.
    - With a purse and no refusal: `purse.spentUsd()`, `pendingUsd()` and `carriedUsd`.
    - Without a purse: today's arithmetic.
    - `projectedAtLeast` and `declinedBy` are removed.
  - Comments: the header gains a "Cost is one purse's (t234)" paragraph that names FLUXIQ_LLM_RUN_COST_CEILING_USD (default $0.10). The per-round-share and $0.25 wording is gone. The one remaining $0.25 describes a historical run (`run-muog33va`), and the text now says it was that run's ceiling.
- `flow-bootstrap/unfinished-build/budget-exhausted.ts`
  - New exported type `AutomationStudioFlowBootstrapCostSpending`, replacing the private `Spending`. It adds `carriedUsd?` and `ceilingUsd?`, and drops `projectedAtLeast`.
  - The F41 figures are kept: spent, held, and the next call's worst case, now always "up to".
  - When `carriedUsd > 0`, the spend is followed by "($X of it by earlier builds of this Flow)".
  - When `ceilingUsd` is set (purse given) on a kept cost ending, the sentence reads "...and building again carries on from it, with $X left of this Flow's $0.10." or "with nothing left of this Flow's $0.10." Amounts use the file's existing 3-decimal style, not the brief's 4-decimal example.
- `result-verification/build-test/judge.ts`
  - The judge reads `automationStudioLlmCurrentBuildPurse()`.
  - Under a purse it drops `maxEstimatedCostUsd: maxCostUsd / 2`. Outside any purse it keeps that cap, so a judge outside a purse is never uncapped.
  - It keeps `not_judged` when `maxCostUsd <= 0`.
  - How verify reports a harness refusal: `verify.ts` `askOnce` maps a failed harness call to `basis: "model_unavailable"`. That becomes an `unsure` outcome, which the old judge returned as `unknown`. It never throws.
  - The judge now snapshots `purse.refusal` before calling verify and compares identity after. A new refusal returns `not_judged` with a reason like "The build's spending limit of $0.10 had $0.010 left, too little for the judge's call, which could have cost up to $0.020, so its test was not judged." Any spend of a first call that was sent is still returned.
  - This only reads `purse.refusal` and never clears it.
- `service/flow-bootstrap-commands/build-judge.ts`: not changed. It already passes `budget` through, and the purse reaches the judge through the async scope.
- Tests in `flow-bootstrap/unfinished-build/tests/`:
  - New `shared-purse.test.ts` covers (a), (b), (c), plus "no repair once the purse is spent" and "a repair's refusal said as it stands".
  - `loop-budget-cost-ending.test.ts` is rewritten. It drives the real loop and harness with run 13's figures, under a build purse with $0.095 left by an earlier build. The purse, not the loop's count, refuses the 16th call. The test asserts the costRefusal has no `declinedBy` and checks the carried figure in the message. The ceiling is derived from `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`, and the test is `skipIf` the ceiling is below $0.095.
  - `budget-figures.test.ts`: the `declinedBy: "loop_budget"` test ("or more") is removed, and the header notes these tests cover a build given no purse.
- `result-verification/build-test/tests/judge.test.ts`: a new describe block "a judge under the build's purse (t234)" with three tests:
  - no per-call cap under a purse;
  - (d) a refused call gives `not_judged` with "spending limit of $C", nothing sent, and no throw;
  - a refused second ask gives `not_judged` and keeps the first call's spend.

## Commands run and observed results

- From `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/result-verification/build-test`
  - Printed `Test Files 10 passed (10)`, `Tests 85 passed (85)`.
  - The run-13 test showed as passed (`✓`) under `--reporter=verbose`, not skipped.
- Fail-on-old check:
  - Method: I copied my three source files to the scratchpad, wrote `git show HEAD:<path>` over them, ran the three new or rewritten test files, then restored my versions and confirmed the restore with `cmp`.
  - Result: `Tests 9 failed | 11 passed (20)`. The 9 failures are exactly the new tests: the run-13 test, the 5 in shared-purse, and the 3 new judge tests. The 11 existing judge tests passed.
  - Incident: my first attempt's restore trap used relative paths after a `cd` and did not restore. I caught it straight away and restored with absolute paths. `cmp` then confirmed all three files are identical to my saved versions.
- Scoped type check: `npx tsc -p <scratchpad>/t234w3-tsconfig.json`. It extends the package tsconfig with `files` set to my source and test files plus `build-judge.ts` and their imports, not the whole package.
  - First run: one error, in my own test. W2's loop declares `purse?: AutomationStudioLlmBuildPurse` with no `| undefined`, and the package uses `exactOptionalPropertyTypes`. I fixed the test to spread `...(request.purse ? { purse: request.purse } : {})`.
  - Second run: 0 lines of output (clean).

## Not verified

- The whole-package tsc, the full test suite and the structure audit were not run. `phases.ts` is now 449 lines, which is past the 400-line advisory and under the 800-line limit. It was already 410 lines and past that advisory before this change.
- The run-13 test passes against W2's loop as it stood in the shared worktree during my run. If W2's loop changes further, this test should be re-run.
- I did not check W4's service wiring: whether it passes `purse` into the phases, hands `request.purse` to the loop, and runs the judge inside `automationStudioLlmBuildPurseScope`.
- No live or Lab run.

## Open questions or contradictions found

- The brief says to drop the judge's per-call cap. I dropped it only when a purse is current. Outside any purse I kept the half-of-what-is-left cap, because dropping it there would leave a judge with no cost bound at all. In production W4 runs builds inside the scope, so the cap does not apply there.
- The brief says to check cost as `purse.leftUsd() <= 0`. I used `<= 1e-9` to absorb floating-point residue, the same slack the purse uses.
- W2's loop input `purse?` has no `| undefined`, so a caller passing `request.purse` must spread it conditionally, and W4's service wiring will hit the same thing. Adding `| undefined` there would be more convenient.
- The "left of this Flow's ceiling" sentence appears only on a kept cost ending, as the brief specifies. A not-kept ending ("Nothing was kept to carry on from.") and non-cost endings do not say what the Flow has left.
- A purse-refused judge call still makes verify emit its "Result check" chat activity with an unsure status before the judge maps the outcome to `not_judged`. That is outside my files.
