# t438: one purse per Flow in Lab-scoped runs

Worker report. Nothing committed. Worktrees: `fxwork/t438/!FluxIQ` and
`fxwork/t438/!FluxIQWebExtension`, both on `task/t438-one-purse-per-flow`.

## Outcome

Partial. Most of the brief is done:

- In a Lab-scoped run, a Flow's creation, its in-run repairs, the post-run patch
  ladder and its re-authors now draw on one purse.
- The misattributed comments are replaced with the user's words.
- A ceiling stop still ends the run through the existing cost-bound paths.
- The Lab's per-build figures now count the whole Flow.

What is left: the result check (the run's own judge) is still capped by its
own authorization. It is not drawn from the Flow's purse in Core. The Lab's
figure does count it, so a check that pushes a Flow past the ceiling shows up
as over. See "Not verified" and the open questions.

## What changed and why

### Core (`packages/fluxiq/src/programs/automation-studio/runtime/`)

- `service/runtime-adaptation/flow-spend.ts` (new). `automationStudioFlowSpendPort(store, labScoped?)`
  is a port over the existing per-Flow `creation-spend.json` record. It does
  three things, all scoped to one Flow:
  - `of(projectId, flowId)` returns `spentUsd()`, `leftUsd(flowMax)` and `record(spentUsd)`.
  - `record` never lowers the recorded figure.
  - The port is `undefined` unless `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test`.
    That is checked with `resolveAutomationStudioLlmTestRunCostCeilingUsd()`; a
    test can pass `labScoped` instead.

  The ceiling comes from `automationStudioLlmRunCostCeilingUsd(flowMax)`, not from
  a hard-coded figure. The file is exported from the `runtime-adaptation` barrel.
- `service/flow-bootstrap-commands/creation-purse.ts`. A new optional input,
  `flowPurse`, defaults to "is the ceiling Lab-scoped". When it is true, the
  creation record is saved instead of deleted when the creation ends, so it
  outlives the creation as the Flow's purse. A repair's build still never reads
  or writes the record. The comment at lines 9-10 ("A refuted-result repair keeps
  its own ceiling ... carries nothing") is replaced with the user's words and the
  t438 rule.
- `recovery/refuted-result/purse.ts`.
  - `automationStudioResultRepairPurse(detail, flowMax?, carriedUsd?)` opens a new
    purse with `spentUsd = carriedUsd`, which is what the Flow already spent.
  - A purse recorded by an earlier pass ignores `carriedUsd`, so nothing is
    counted twice.
  - The new `carriedUsd` field is written on the run's re-author marker.
  - The misattributed comment at lines 7-9 ("The user's rule is that a build,
    and its repair, each spend at most ...") is removed. The header now quotes
    the user's words and says why product scope differs.
- `service/runtime-adaptation/refuted-result-port.ts` and `step-failure-port.ts`.
  Both take a new optional dependency, `flowSpend`. They open the run's repair
  purse with the Flow's spend, and every exit writes `purse.spentUsd` back to the
  Flow record. The step-failure port still charges the in-run ladder's spend
  first, then hands the re-author what is left. The re-author's charge in
  `reauthor-build.ts:113` is unchanged, because it already spends from the purse
  it is handed.
- `service/runtime-session/in-run-repair.ts`. The binding takes an optional
  `flowSpend`. Each incident passes
  `costLeftUsd = flowSpend.of(...).leftUsd(policy.maxEstimatedCostUsdPerRun)` to
  the recovery. The in-run purse, opened at the first incident, is therefore
  sized to what the Flow has left. With nothing left, the existing early refusal
  `llm_budget.run_cost_limit` / `bound: "cost"` ("The repair's cost ceiling is
  spent, so no model was asked.") ends it.
- `service.ts`. Two existing lines changed and the line count is unchanged at
  4360. The import gains `automationStudioFlowSpendPort`. Both the repair ports
  and `bindAutomationStudioInRunRepair` are handed `flowSpend: automationStudioFlowSpendPort(this.creationSpends)`.
  **This file was not in my owned list.** No other file can wire the store into
  the ports.
- `flow-bootstrap/creation-spend/record.ts`. Comment only: the record now
  outlives the creation in a Lab-scoped run. **Not in my owned list.** It carried
  the same stale statement.
- Tests:
  - New: `recovery/refuted-result/tests/purse.test.ts`,
    `service/runtime-adaptation/tests/flow-spend.test.ts` and
    `service/flow-bootstrap-commands/tests/creation-purse.test.ts`.
  - Added Lab-scope cases to `refuted-result-port.test.ts`,
    `step-failure-port.test.ts` and `runtime-session/tests/in-run-repair.test.ts`.
    The step-failure case is the R4a shape: creation 0.4248 of the ceiling plus
    ladder 0.0424 hands the re-author 0.5328. Another case covers being refused
    at the ceiling.
  - `reauthor-build.test.ts`: its purse fixture gained `carriedUsd: 0`.
  - No new `as never` casts.

**Product scope: unchanged, on purpose.** A product Flow runs on a schedule for
as long as it exists, and its owner's limit is per run
(`maxEstimatedCostUsdPerRun`: $0.25 by default, up to $10 by explicit policy). A
lifetime purse there would leave every later run's repair with nothing. So
sharing is not equally right in product scope. The port is not created there,
and the creation record is still deleted when the creation ends.

### Downstream (this repository)

- `packages/test-runner/src/live-llm/run-spend.ts`. `perBuild` is now one Flow:
  - `builds` holds `[{ phase: "flow", attempt: null, estimatedCostUsd: <run total>, overCeiling }]`.
  - `parts` is new and lists build, read, judge, chat, runtime, each re-author
    attempt and anything unattributed.
  - `maxBuildCostUsd` is the Flow's total.
  - `overCeiling` is 0 or 1.

  The figure is the run's whole spend: every phase plus the calls only the step
  log saw. That includes the chat interpreter and the result check, because the
  user's rule counts "the judge" and everything for the Flow. The barrel
  `live-llm/index.ts` exports the new type `LiveLlmFlowSpendPart`.
- `scripts/lab/live-campaign/row/build-spend.mjs` (rewritten), which is used by
  `run-outcomes.mjs` and therefore by the spend ledger.
  - It reads the runner's `flow` entry when one is recorded.
  - For older snapshots, the Flow is the larger of
    `observed.totalEstimatedCostUsd` and the sum of the recorded parts, or of the
    derived build and repair.
  - `builds` is one `flow` entry, with `parts` beside it. `unrecorded` counts a
    Flow whose cost is unknown.
  - The misattribution "The user's rule is $0.25 per build" is gone.
- Comment and wording only:
  - `scripts/lab/live-guards/run-outcomes.mjs` and `ledger.mjs` describe the
    fields as the Flow's. They keep the names `maxBuildCostUsd` and
    `buildsOverCeiling`.
  - `scripts/lab/live-campaign/summary/markdown.mjs` now reads "N Flow(s) over
    the per-Flow spend ceiling".
- Tests updated: `run-spend.test.ts` (new R4a case: no part is over, the Flow
  is), `row/tests/build-spend.test.mjs` (rewritten), and
  `live-guards/tests/admit-live-run.test.mjs`. The ledger case "$0.20 + $0.20
  against $0.25" now records `maxBuildCostUsd 0.4` and `buildsOverCeiling 1`.

## Commands run and observed results

- Core vitest, from `fxwork/t438/!FluxIQ/packages/fluxiq`:
  `npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result src/programs/automation-studio/runtime/service/runtime-adaptation src/programs/automation-studio/runtime/service/flow-bootstrap-commands src/programs/automation-studio/runtime/service/runtime-session src/programs/automation-studio/runtime/flow-bootstrap/creation-spend src/programs/automation-studio/runtime/tests/refuted-result src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/service/tests/instruction-authority.test.ts`
  printed `Test Files 97 passed (97)` and `Tests 802 passed (802)`.
  - This covers the changed directories, plus the service-level purse chains
    (`repair-purse-chain`, `shared-purse`, `murzln6g-repair-funding`).
  - One in-run test failed on its first version. A $0.01 remainder could not
    hold both the diagnosis and the patch reserve, so the repair was refused. I
    changed the amounts to $0.02 left of $0.04, and the test file then printed
    `Tests 11 passed (11)`.
  - After the statement-packing fix, the three port and flow-spend test files
    were rerun: `Tests 48 passed (48)`.
- Core typecheck, `pnpm run check` in `packages/fluxiq`:
  - The first run failed with `TS2741 carriedUsd missing` in `reauthor-build.test.ts:29`.
    I fixed the fixture.
  - The final run printed `{"build-cache":"build","step":"fluxiq:check",...}`
    with no errors and no ELIFECYCLE.
- Core structure audit, `node scripts/structure-audit.mjs`:
  - The first run failed: 3 `statement-packing` violations in my new test
    helpers. I unpacked them.
  - The final run printed `structure-audit: passed (327 warning(s), 1160 baselined).`
- Core library build, needed for the downstream build:
  `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  printed `fluxiq build: Done`.
- Downstream:
  - `pnpm run build` in `packages/test-runner` compiled (tsc) with no errors.
  - `node --test dist/live-llm/tests/run-spend.test.js dist/live-llm/tests/live-llm-run.test.js`
    printed `# tests 35`, `# pass 35`, `# fail 0`.
  - `node --test scripts/lab/live-guards/tests/admit-live-run.test.mjs scripts/lab/live-campaign/tests/runner.test.mjs scripts/lab/live-guards/tests/ledger.test.mjs scripts/lab/live-campaign/row/tests/build-spend.test.mjs`
    printed `# tests 26`, `# pass 26`, `# fail 0`. The first run had 1 failure,
    the old per-build ledger expectation, which I updated.
- Downstream structure audit, `node scripts/structure-audit.mjs`, printed
  `structure-audit: passed (184 warning(s), 651 baselined).`
- No Lab run and no provider call.

## Not verified

- **The result check is not drawn from the Flow's purse in Core.** It is still
  paid and capped by its own authorization (`result-check-authorization/`). Its
  spend is not recorded anywhere the repair purse can read, and wiring it would
  touch `result-verification/run-outcome.ts` and `service.ts`'s `resolveProvider`.
- **An in-run repair's spend on a run that then succeeded is not written back**
  to the Flow record. Only a repair that reaches a repair port writes back. In a
  one-run Lab task nothing spends afterwards, so the Flow total is unaffected.
  A second run of the same Flow would get more than it should.
- **The in-run purse is sized once per run.** It opens at the first incident. In
  the re-run that follows a re-author, in-run repairs reuse that purse, and it
  does not subtract what the re-author spent. That is a possible overshoot of up
  to the in-run purse.
- Behaviour in a live Lab run, including whether a Lab Flow is ever run twice.
- Concurrent repairs of one Flow. The record is read, then written, with no lock.
- Full suites (`pnpm check`, `pnpm test`) were not run, by the twice-a-day rule.

## Open questions or contradictions found

1. Authored docs still describe the old split, and were not in my files:
   - Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` around
     lines 1734-1737: "A refuted-result repair during a later scheduled run
     keeps its own run ceiling and never touches the record."
   - This repo's `docs/architecture/testing-facility.md:3167`: "Core's loop
     budget holds the build, the run's recovery and each re-author build to it,
     each on its own", and "reports its spend per build".

   Both need updating with this change.
2. I edited files outside the owned list: Core `service.ts` (two existing lines,
   needed for wiring) and `creation-spend/record.ts` (comment only). Downstream I
   also edited the `live-llm/index.ts` barrel, `markdown.mjs`, and the comments
   in `ledger.mjs` and `run-outcomes.mjs`.
3. The Lab's Flow figure counts the result check and the chat interpreter, but
   Core's purse does not hold the result check. Until it does, a Lab run can show
   `buildsOverCeiling: 1` while Core behaved as designed. I chose that because it
   is the honest measure of "$0.1 per flow max". The supervisor may prefer to
   leave the check out of the figure until Core holds it.
4. In a Lab-scoped run, a later non-repair build of the same Flow (an extend
   after the Flow was proposed) now carries the Flow's whole spend. This follows
   from one purse per Flow, but it is new behaviour.
5. `live-llm-run.ts`'s settle event key `buildsOverCeiling` now means "the Flow
   was over", 0 or 1. The name was kept for the existing readers.
