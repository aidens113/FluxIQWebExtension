# t254-s2-w2: recovery pricing at the billed rate

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t254/!FluxIQ`, branch `task/t254-purse-holds-true-cost`. Nothing staged or committed.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`.

1. `R/recovery/annotation/run-budget.ts`
   - `AutomationStudioRecoveryRunBudgetInput` gains `now?: (() => number) | undefined`, which defaults to `Date.now`.
   - `worstCaseCallCostUsd(tokenLimits, model, atMs)` now passes `atMs` to `estimateAutomationStudioDeepSeekCostUsd`, so a reservation is priced at the rate in force when it is held: half the peak rate off-peak. It uses the shared function only; there is no new rate table and no copy of the off-peak rule.
   - Rewrote the two comments that said "peak rates".
2. `R/llm/harness/provider.ts:60`: the `estimateCostUsd` doc comment said "at the provider's peak rates". It is comment-only and now says the rates in force now. The DeepSeek implementation, `provider.ts:79`, already passes `now()`.
3. `R/recovery/annotation/tests/run-budget.test.ts`
   - Pinned a peak clock (Mon 2026-10-05 02:00 UTC) in each test that asserts peak figures: worst case, the model-priced test, purse/per-call caps, the 64-call loop and the window profile.
   - Added the test "is half the peak worst case off-peak, and the peak one at peak". It covers flash and v4-pro and checks four things: peak equals the shared function at peak, off-peak is peak / 2, off-peak equals the shared function at Sat 2026-10-03 12:00 UTC, and the ledger (purse) is identical either way.

The clock is not threaded from `annotate.ts`. Its only caller (`annotate.ts:276`) has no wall-clock port. The `now` it does have (`annotate.ts:375`) is `input.detail.summary.updatedAt || Date.now()`, which is a record timestamp. Using it would price the reservation at the run's last-update time, not now. The resolver's default `Date.now` is the correct clock there, and it matches `startAutomationStudioRecoveryDeadline({ startedAtMs: Date.now() })` in the same function.

## Sites found (step 2 and 3 search, non-test files in packages/fluxiq/src)

- **`estimateAutomationStudioDeepSeekCostUsd` calls**
  - `llm/deepseek/provider.ts:79` (hold) and `:176` (charge): both pass a time. OK.
  - `llm/deepseek/response-envelope.ts:57`, `:240`: pass `sentAtMs` and cache hits. OK.
  - `llm/deepseek/panel-command.ts:78`, `:170`: pass `sentAtMs`. This file belongs to another worker and already shows uncommitted edits. Not touched.
  - `recovery/annotation/run-budget.ts:177`: priced at peak. **Fixed.**
- **`AUTOMATION_STUDIO_DEEPSEEK_PEAK_*` constants:** only defined in `pricing.ts` and re-exported in `llm/index.ts:46-48`. No arithmetic uses them outside tests.
- **Hard-coded rates:** `0.3`/`1.2` appear only in the rate table in `pricing.ts:51`. `conversations/instructions/closest.ts:72` `0.3` is a string-match score, not a price.
- **"peak" comments:**
  - `llm/harness/provider.ts:60`: **fixed**.
  - `flow-bootstrap/unfinished-build/round-funding.ts:18` and `llm/build-purse/projected-cost.ts:4` already say "peak or off-peak".
- **Recovery charges (step 2):** none recomputes a price.
  - The run ledger is charged from the provider's reported `estimatedCostUsd`, which comes from the send-time, cached-input pricing in the response envelope.
  - `recovery/annotation/patch-reserve.ts` holds through `provider.estimateCostUsd`, which is priced at `now()` in `provider.ts:79`.
  - `recovery/refuted-result/purse.ts` charges the `costUsd` each part reports and computes no price.
  - `recovery/runtime-exploration.ts:720` is a zero-usage literal.
- **Out of scope:** nothing found under `flow-bootstrap/`, `result-verification/` or `docs/` that prices at peak.

## Commands run and observed results

From `packages/fluxiq`:
- `npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/tests/recovery-default-limits.test.ts src/programs/automation-studio/runtime/llm/harness`
  - Output: `Test Files 74 passed (74)`, `Tests 750 passed (750)`.
  - The `llm/harness` filter also matched `llm/harness-options`.
- `npx vitest run src/programs/automation-studio/runtime/recovery/annotation/tests/run-budget.test.ts` printed `Test Files 1 passed (1)`, `Tests 20 passed (20)`.
- `npx tsc --noEmit -p .` printed no output, meaning no errors.

## Not verified

- No live or Lab run.
- `annotate.ts` reservations are not asserted at an off-peak wall clock in an annotate-level test. The resolver default is covered only by the resolver tests.

## Open questions or contradictions found

- `panel-command.ts` and its test show uncommitted modifications in this tree from another worker. I left them alone.
- Chinese public holidays still price at peak, as `pricing.ts` documents.
