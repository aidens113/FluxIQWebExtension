# t254-s3-w2: recovery prices each call at the rate in force when it is made

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t254/!FluxIQ`, branch `task/t254-purse-holds-true-cost`. Nothing was staged or committed.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`.

### Where the reservation is actually taken

- The ledger reservation is taken in `R/llm/harness/run.ts:146`:
  - The call is `reserve({ maxEstimatedCostUsd: reservedCostUsd(provider, pricedInputTokens, replyReserveTokens, request.maxEstimatedCostUsd) })`.
  - `reservedCostUsd` returns `min(ceiling, provider-priced)`. The provider prices the call at `now()` (`deepseek/provider.ts:79`).
  - The ceiling is the number the caller passes as `maxEstimatedCostUsd`. In recovery, that number was `budget.maxEstimatedCostUsdPerCall`, priced once at resolution.
- When the worst-case term binds, two things go wrong:
  - A recovery resolved off-peak holds a peak call at the off-peak ceiling, so the ledger counts it as a breach.
  - A provider that does not price falls back to the stale ceiling outright.
- The ledger (`R/llm/run-budget.ts`) only stores the figure it is given. The provider preflight only range-checks `request.maxEstimatedCostUsd`.

The fix was therefore to change what each call passes as its ceiling. **Neither `R/llm/harness/run.ts` nor `R/llm/run-budget.ts` needed editing.** Changing the harness input type would also have meant editing `task-request.ts`, which I do not own.

### Changes (all under `R/recovery/annotation/`)

1. **`run-budget.ts`**
   - `resolveAutomationStudioRecoveryRunBudget` now returns `maxEstimatedCostUsdPerCallAt(atMs?: number): number`.
     - It recomputes the same expression as before: `floor_1e-9(min(purse, resolver per-call cap, max(even share, worstCaseCallCostUsd(limits, model, atMs))))`.
     - The worst case is priced through the shared `estimateAutomationStudioDeepSeekCostUsd(..., atMs)`. There is no second rate table.
     - `atMs` defaults to the budget's clock (`input.now ?? Date.now`).
   - `maxEstimatedCostUsdPerCall` is still returned, now documented as the resolution-time figure. It is still used by `R/tests/recovery-default-limits.test.ts`, which I do not own, and by existing tests.
   - Only the worst-case term moves with the clock. The even share, the resolver's per-call cost and the purse bound it exactly as before.
2. **`annotate.ts`**
   - `maxEstimatedCostUsdPerCall` is now a function, `() => budget.maxEstimatedCostUsdPerCallAt()`.
   - It is called in each call's request literal: the diagnosis, the patch-reserve hold, the re-plan and the patch.
   - Each literal is built synchronously right before the harness reserves, so the price is set when the call is made.
   - The exploration is passed the function itself.
   - The clock is the budget's default wall clock, as in stage 2. The local `now` in `annotate.ts` is a record timestamp and is not used for pricing.
3. **`exploration.ts`**
   - `maxEstimatedCostUsd` is widened to `number | (() => number)`.
   - The exploration reads it inside each decision's harness request, because an exploration can outlast an off-peak window.
   - Existing callers that pass a number are unchanged.
4. **Tests**
   - `tests/run-budget.test.ts`, test "prices each call at the rate in force when that call is made, not when the budget was resolved":
     - Pins a mutable clock to Sat 2026-10-03 12:00 UTC (off-peak) and resolves; the figure equals the shared price off-peak.
     - Moves the clock to Mon 2026-10-05 02:00 UTC (peak): `maxEstimatedCostUsdPerCallAt()` equals the shared price at peak, which is 2x the resolution figure.
     - Moves the clock back: it returns to the off-peak price.
     - Runs for both flash and v4-pro.
     - Checks the ledger directly. A peak-cost call reserved at the per-call figure has 0 breaches; the same call reserved at the stale resolution figure has 1 breach.
   - `tests/run-budget.test.ts`, test "keeps the even share, the resolver's per-call cost and the purse as bounds at any hour": the bounds hold at both hours.
   - `tests/exploration.test.ts`, test "reads a per-call ceiling given as a function once per decision": a 4-decision exploration reads the function 4 times, and each provider request carries that decision's figure.

### Known limit (deliberate)

The patch-reserve hold is priced at the moment the exploration starts. It is released before the patch call, and the patch then reserves at its own call-time price. So the patch itself is priced correctly. However, the protection the hold gives is sized at the earlier hour.

## Commands run and observed results

All commands were run from `packages/fluxiq`.

- `npx vitest run .../recovery/annotation/tests/run-budget.test.ts .../recovery/annotation/tests/exploration.test.ts`
  - Printed: `Test Files 2 passed (2)`, `Tests 30 passed (30)`.
- `npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/tests/recovery-default-limits.test.ts src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/llm/tests`
  - Printed: `Test Files 99 passed (99)`, `Tests 1125 passed (1125)`.
- `npx tsc --noEmit -p .`
  - Exited 2 with 5 errors, all in `R/flow-bootstrap/unfinished-build/tests/reserve-unchanged.test.ts`.
  - The errors are lines 90, 91, 114, 123 and 131, all of the form `findings: readonly [...]` not assignable to `string[]`.
  - That file is untracked and belongs to another worker's flow-bootstrap work, which I must not touch.
  - No errors appear in any file I changed.

## Not verified

- No live or Lab run took place, and no annotate-level test crosses a peak boundary. The annotate wiring is checked by reading the code and by `tsc`; the behaviour is covered by the resolver and exploration tests.
- `tsc` is not clean for the tree, because of the other worker's untracked test file.

## Open questions or contradictions found

- `R/flow-bootstrap/unfinished-build/tests/reserve-unchanged.test.ts` (untracked, not mine) fails typecheck: readonly `findings` are not assignable to `string[]`.
- The resolution-time `maxEstimatedCostUsdPerCall` is kept only for compatibility. Once `R/tests/recovery-default-limits.test.ts` moves to `maxEstimatedCostUsdPerCallAt`, the supervisor may want to remove it so nothing can take the stale figure.
