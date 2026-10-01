# t194-w23: the purse's closing figures, and breaches kept to the Lab

## Outcome

**Partial.** Task 1 is done. Task 2 is done inside the files I own, but it stops where Core publishes the build's accounting, because that is in `runtime/service.ts` (Must not touch) and in wire parsers outside my list. Both the proposal path and the refusal path rebuild the accounting field by field from a whitelist, so `budgetBreaches` is carried through `phases.ts` and is read by the Lab, but Core does not yet publish it between those two points. The files and lines that still need changing are listed under "Open questions".

## Trace (every file:line the figures pass through)

Core paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`.

**Purse refusal figures (Task 1):**
1. `llm/build-purse/purse.ts:100-111`: `hold()` refuses and records `refusal` {projectedCostUsd?, spentUsd, pendingUsd, ceilingUsd, ...}.
2. `llm/build-purse/run.ts:31-41`: throws `AutomationStudioLlmBuildPurseRefused` when `purse.refusal` is set.
3. `llm/evidence-loop/cost-purse.ts:33-44`: the loop's purse, ceiling = the round's `budget.maxCostUsd`, spending = the round's accounting.
4. `llm/evidence-loop.ts:512,516`: the refused decision becomes `exhausted("budget")`. `:368` passes `purseRefusal: purse.refusal`.
5. `llm/evidence-loop/exhaustion.ts:168` (481 in the combined listing): `budgetBound: "cost"`, `costRefusal: {...purseRefusal}`.
6. `flow-bootstrap/unfinished-build/round-ending.ts:40-44`: `kind: "budget"`, `progress.exhaustion` carries `costRefusal`.
7. `flow-bootstrap/unfinished-build/phases.ts:199` (new): `spentBefore`, what earlier rounds spent. `:231` (changed): `spending: purseSpending(ending.progress.exhaustion?.costRefusal, spentBefore)` for a `cost` ending. `:275-278` (new): `purseSpending` turns the round's figures into the build's.
8. `flow-bootstrap/unfinished-build/budget-exhausted.ts:51` (new input `spending`), `:64-65` (message), `:89-98` (new `spendingSaid`, `usd`).
9. After that, unchanged: the ending goes through `service.ts:1622` `flowBootstrapBuildEndingFailure(built.ending, ...)` (`flow-bootstrap/generation-failure/evidence-failure.ts:191-206`) and is parsed by `generation-failure/build-ending.ts:79-102`.

**`budgetBreaches` (Task 2):**
1. `llm/evidence-loop/cost-purse.ts:37`: `onBreach` increments `accounting.budgetBreaches` (`llm/evidence-loop/accounting.ts:39`).
2. `flow-bootstrap/unfinished-build/phases.ts:198,326` (changed): `addAccounting` now carries `budgetBreaches` across rounds. Before this it was **dropped here**. It reaches `outcome.accounting` and `progress.accounting` on finished, ended and unfinished outcomes.
3. `service.ts:1558-1560` `loopAccounting(spent)`: builds `AutomationStudioBootstrapAccounting` field by field and **drops it here**. Must not touch, so not changed.
4. Proposal path: `flow-bootstrap/adaptation.ts:64-73` (type, no field) → `flow-bootstrap/review-projection.ts:18-41` `sanitizedBootstrapAccounting` (whitelist) → `service.ts:1776` stores it → downstream `packages/test-runner/src/existing-fluxiq-control.ts:110` (type) and `:470-477` (parses `metadata.bootstrap.accounting` with a whitelist) → `flow-lane/creation/build-proposal.ts:371` `accountingOf(detail.accounting)`.
5. Refusal path: `generation-failure/diagnostic.ts:25-48` (type) → `generation-failure/diagnostic-parse.ts:132-159` `parseAccounting`. Its `hasExactFields` **rejects the whole diagnostic** if an unknown field is present. → downstream `build-proposal.ts:463` `accountingOf(diagnostic.accounting)`.
6. Downstream reader: `flow-lane/creation/build-proposal.ts:83` (type, new optional field), `:498,506` (`accountingOf` carries it) → `live-llm/build-usage.ts:56` (reads it, was `0`) → `live-llm/budget.ts:38` (`accounting.budgetBreaches > 0` adds "Core recorded N budget breach(es) of its own during the run", which fails the run).

`harness-accounting.ts` (the one-shot build) needed no change. That call is not held by the purse, so it cannot produce a breach.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`):
- `runtime/flow-bootstrap/unfinished-build/budget-exhausted.ts`: new optional input `spending` {spentUsd, pendingUsd, projectedCostUsd?}. It is stated only for a `cost` ending, as `": it had spent $X[, with $P more held for calls still running], and its next call could have cost up to $Y"`. Where the provider does not price, it ends `", which left nothing for its next call"` instead. Amounts are shown to 3 decimals; the ceiling keeps its existing 2. `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_BUILD_ENDING_MAX_MESSAGE` slicing is unchanged. With no refusal, the message is byte-identical to before.
- `runtime/flow-bootstrap/unfinished-build/phases.ts`: the refusal is stated in the build's own figures. A repair's purse holds only what earlier rounds left, so build spent = `spentBefore` + `refusal.spentUsd`, and the stated ceiling is the build's `input.budget.maxCostUsd`. `addAccounting` now sums `budgetBreaches` and leaves it absent when there are none.
- New `runtime/flow-bootstrap/unfinished-build/tests/budget-figures.test.ts` (7 tests).

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`):
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`: `CreatedFlowBuildAccounting` gets an optional `budgetBreaches?: number`. `accountingOf` keeps it when it is a non-negative safe integer.
- `packages/test-runner/src/live-llm/build-usage.ts:56`: `budgetBreaches: totals.budgetBreaches ?? 0` replaces the hard-coded `0`.
- `packages/test-runner/src/live-llm/tests/build-usage.test.ts`: new test. With breaches 2, `usage.accounting.budgetBreaches === 2` and `liveLlmBudgetBreaches` includes "Core recorded 2 budget breach(es) of its own during the run". With breaches absent or 0, it reports no breach.

**Structural carrying (Task 1): not done, by design.** `AutomationStudioFlowBootstrapBuildEnding` is parsed with `exact(value, ["kind","message","bound","notDone","tried"])` (`generation-failure/build-ending.ts:83`). Any new field is a wire change and would make an older reader refuse the ending, so the figures travel in the message only.

**Compatibility:** no wire or contract field was added in Core. Downstream, `CreatedFlowBuildAccounting.budgetBreaches` is a new **optional** field on a repository-local type, and no existing literal breaks.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build` (from `packages/fluxiq`): `Test Files 4 passed (4)`, `Tests 29 passed (29)`.
- Old-source proof (Core): I copied my `phases.ts` and `budget-exhausted.ts` aside, put back `git show HEAD:` versions, and ran `npx vitest run .../tests/budget-figures.test.ts`. Result: `Tests 5 failed | 2 passed (7)`. The 3 message tests failed with `expected 'The build stopped at its spending lim…' to match`. The 2 breach tests failed with `expected undefined to be 3` and `expected undefined to be 1`. The 2 that passed are the "unchanged otherwise" and "absent when none" guards, which are meant to hold on both versions. I then restored my files (`git diff --stat` confirmed).
- `npx vitest run src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/service/flow-bootstrap-commands`: `Test Files 149 passed (149)`, `Tests 1707 passed (1707)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w23 core tsc" npx tsc --noEmit -p tsconfig.json` (from `packages/fluxiq`): no output, `tsc rc=0`.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (206 warning(s), 353 baselined).` rc 0, and no warning names `unfinished-build`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w23 test-runner" pnpm --filter @fluxiq-web-extension/test-runner check`: rc 0. Last lines: `{"build-cache":"build","step":"test-runner:check",...}`. As part of this command, `domain-dist.mjs` rebuilt the downstream `domain/dist`.
- Downstream tests: `pnpm test` was not used, because its first gate (`scripts/check/core-build.mjs`) refuses a Core dist that is stale against Core source, and I may not rebuild Core's dist. Instead I compiled with `npx tsc -p tsconfig.json --outDir node_modules/.cache/t194-w23-dist` (through `heavy.sh`) and ran `node --test` on each file:
  - `live-llm/tests/build-usage.test.js`: `# tests 7`, `# pass 7`, `# fail 0`
  - `live-llm/tests/budget.test.js`: `# tests 14`, `# pass 14`
  - `flow-lane/creation/tests/build-proposal.test.js`: `# tests 23`, `# pass 23`

  Old-source proof: I edited the compiled `build-usage.js` back to `budgetBreaches: 0,` and re-ran. Result: `not ok 7 - a build whose calls Core says cost more than its purse held them at fails the Lab's budget check...`, `expected: 2`, `actual: 0`. The private output directory was deleted afterwards.

## Not verified

- End to end, `budgetBreaches` does not reach the Lab, because Core does not publish it (see below). `accountingOf`'s new spread line has no test through `buildCreatedFlowProposal`: both of its inputs come through parsers that strip the field (proposal path) or reject the whole diagnostic (refusal path).
- No Lab run and no model calls, as the brief requires. Core's dist was not rebuilt, so the downstream tests ran against Core's existing dist. They do not depend on these Core changes.
- I did not check whether `exhaustion.costRefusal` survives into the published diagnostic's `evidenceLoop` (`generation-failure/diagnostic-parse.ts:233-260` writes the exhaustion out field by field). That is outside this brief.

## Open questions or contradictions found

1. **The brief assumed the build's accounting is published through `service/flow-bootstrap-commands/`. It is not.** It is built inline in `runtime/service.ts:1558-1560` (`loopAccounting`), which is Must not touch. Carrying `budgetBreaches` to the Lab needs all of these:
   - `service.ts:1560`: add `...(spent.budgetBreaches ? { budgetBreaches: spent.budgetBreaches } : {})`. Alternatively, move `loopAccounting` into `service/flow-bootstrap-commands/` and call it from `service.ts`.
   - `flow-bootstrap/adaptation.ts:64-73`: an optional `budgetBreaches?: number` on `AutomationStudioBootstrapAccounting`.
   - `flow-bootstrap/review-projection.ts:18-41`: a bounded-integer line in `sanitizedBootstrapAccounting`.
   - `flow-bootstrap/generation-failure/diagnostic.ts:25-48`: a type field. `diagnostic-parse.ts:134`: add it to `hasExactFields`, plus a validation line and a copy line. This is a **wire change**: an older Core reader refuses the whole diagnostic when the field is present.
   - Downstream `packages/test-runner/src/existing-fluxiq-control.ts:110` (type) and `:470-477` (parse `metadata.bootstrap.accounting.budgetBreaches`).

   With those in place, the reader half here (`build-proposal.ts` `accountingOf` and `build-usage.ts:56`) needs no further change.
2. A refusal from the build's purse spends the build's whole ceiling only within the round that refused. If a later round's `exhaustedBound` (`phases.ts:281-288`) ends the build at `cost` without a refusal, the message stays as before. That is correct, since no call was refused, but noted.
3. An untracked `apps/extension/e2e/content/tests/live-tasks/` exists in the downstream tree. It is not mine, and I left it alone.
