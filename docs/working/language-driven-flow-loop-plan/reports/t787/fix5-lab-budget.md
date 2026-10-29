# t787 fix 5: the Lab reports what happened

## Outcome
Done. Both halves implemented; the two acceptance tests pass.

## What changed and why
Budget (`packages/test-runner/src/live-llm/`):
- `budget.ts`: `liveLlmBudgetBreaches` no longer fails on Core's `accounting.budgetBreaches > 0`. That count is Core's per-call reservation overrun (bytes/3), not a cap. Calls, cost, tokens, per-call caps and the itemization check still fail as before.
- `budget/reservation-findings.ts` (`liveLlmBudgetFindings`), `budget/finding.ts`, `budget/index.ts` (new directory, because the structure audit refused a 26th file and a third `budget-` prefix): when no cap was breached and Core counted an overrun, one finding `reservation_undercounted` with `overrunCalls`, the flagged `calls` (position, requestId, taskKind, supplied input tokens, output tokens) and a message. A real breach yields no finding; the failure speaks.
- `observed-usage.ts`: a call now carries Core's per-call `budgetBreach`; `call-rows.ts` keeps it when the step log replaces the rows.
- `live-llm-run.ts`: findings per phase (build, repair) are written to `snapshots/live-llm.json` as `findings` and sent on the settle event (`findings`). That is where the Lab reports a run's spend; there was no other finding channel for the budget.
- `index.ts`: exports the new function and types.

Lane (`flow-lane/creation/lane.ts`), the narrower choice made explicit: I kept the breach and deferred it, rather than judging the oracle before `settleRun`.
- Success path: a `performance.budget` error from `settleRun` is held, the run is judged and the evidence published (so `oracleVerdict` is recorded), then the breach is thrown with the run's own expectation failure (if any) as its `cause` through `budgetOverProductFailure`. Any other settlement error still throws at once.
- Throw path: the breach is thrown with the run's thrown error as its `cause` (the helper only keeps a `runtime.behavior` cause, as the Lab reads only that as the product's).
- Why not reorder only: reordering alone would put the verdict on the evidence but still let a thrown breach hide the failure; keeping the cause on both paths plus the deferred throw covers both with one helper that already exists.
- Imports `budgetOverProductFailure` by file from `live-llm/`, avoiding the `live-llm` barrel (it imports `flow-lane`).

Tests changed in `live-llm/tests/`: `budget.test.ts` (the old "Core counted a breach fails" test replaced by the two new ones), `build-usage.test.ts` (the build's `budgetBreaches: 2` is now a finding), `observed-usage.test.ts` (`budgetBreach: false` on a call).

## Commands run and observed results
- `npx tsc -p tsconfig.json --noEmit` (test-runner): no output (clean). Run directly, not through the package script, so the core-build gate was not exercised.
- `npx tsc -p tsconfig.json` then `node --test dist/live-llm/tests/*.test.js dist/flow-lane/creation/tests/*.test.js`: tests 303, pass 303, fail 0. These include "a Core reservation overrun within every cap is not a breach", "a real cap breach is still a breach...", "a breach after a failed playback keeps the playback failure and the oracle verdict".
- `node scripts/structure-audit.mjs` from D: passed (232 warnings, 616 baselined). It failed first on my own first layout (26 files, a third `budget-` prefix), fixed by the `budget/` directory.

## Not verified
- Fail-first: I did not run the new tests against the old code (no git changes allowed); the first lane test run failed only because my fake did not play back through `run-runtime-session`, which I then corrected.
- Core publishes no reserved-token figure per call, so the finding carries the supplied input tokens and Core's overrun count, not a numeric overrun. The build path publishes only the count, so its finding has no calls.
- `evaluation.json` `llm` (`{mode, profileId, calls}`, built in `run-scenario.ts`/`run-evaluation/`, outside my paths) does not carry the finding.
- No live run.

## Open questions or contradictions found
- A Core `budgetBreach` also fires on a cost overrun versus reservation; it is treated the same way while the declared cost cap held.
- Docs: no architecture sentence found that states the old rule (grepped `docs/architecture/*.md` for "budget breach"). `testing-facility.md` could add after the `snapshots/live-llm.json` `observed.perBuild` sentence (line ~3592): "`findings` lists budget observations that are not failures: `reservation_undercounted` when Core's per-call reservation was smaller than a call while every declared cap held."
