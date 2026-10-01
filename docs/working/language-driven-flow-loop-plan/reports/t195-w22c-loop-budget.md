# t195-w22c: the decision budget does not withdraw tools while money is left

## Outcome

Done.

## What changed and why

Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/loop-budget.ts`:

- The cost bound used to count decisions as `floor(costLeft / max(average, worstCase))`, so every decision was priced at the worst case. In run 36 that withdrew the tools at E42 with $0.09 left (cause 9).
- It now counts them the way the token bound does:
  - `worstCase = max(average, nextDecisionCostUsd)`;
  - `0` if `costLeft < worstCase`;
  - otherwise `1 + floor((costLeft - worstCase) / perDecision)`, where `perDecision` is the average over the reported decisions.
- The worst case is still reserved once, so the next call cannot overrun the ceiling. The purse (`cost-purse.ts`) still guards each real send.
- Before any decision is reported, the only price known is the worst case, so `perDecision` falls back to it. This is the "sane default", and it matches what the code did before in that state.
- An average of 0 with money left still returns `iterationsLeft`, as before.
- I updated the comments: the `nextDecisionCostUsd` doc and a new comment at the cost bound that cites `run-muq3uozx-3153564b`. The file header's intent is unchanged.

Tests in `.../runtime/llm/tests/loop-budget.test.ts`:

- **"reserves the worst case once and counts the decisions after it at the average":**
  - Setup: one decision reported at $0.0023, `maxCostUsd 0.0546`, so `costLeftUsd` is about 0.05 after the held-back average. Worst case is $0.025.
  - Expects `decisionsLeft >= 10` and `limitedBy: "cost"`. It gets 11.
- **"leaves one decision for money enough for exactly one worst case, and none for less":**
  - $0.5 left with a $0.5 worst case gives 1.
  - A $0.5000001 worst case gives 0.
  - Before anything is reported: $0.5 with a $0.125 worst case gives 4, and with a $0.75 worst case gives 0.
- The existing test from `run-mup2u8o3` still passes unchanged (3, 0, 3).

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts` (in `packages/fluxiq`) printed `Tests 13 passed (13)`.
- Revert check: I swapped in `git show HEAD:<loop-budget.ts>` and re-ran the tests. Result: `Tests 1 failed | 12 passed`, with `expected 2 to be greater than or equal to 10` on the new $0.05 case. The file was then restored from a scratch copy, and `git diff --stat` shows the change is back (14+/5-).
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w22c tsc" npx tsc --noEmit -p tsconfig.json` printed only `[heavy] t195-w22c tsc holds b1` and exited 0.
- `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (211 warning(s), 349 baselined)` and `1 baseline entries can be lowered`. That baseline note is not caused by this change.

## Not verified

- No live run, Lab, or browser was used, per the brief.
- I ran no evidence-loop suites beyond the loop-budget test file. That file includes the loop integration tests, and they pass.

## Open questions or contradictions found

- **Old code also passes two of the new cases.** The brief says each new case must fail with the change reverted. Only the $0.05 case can: the old `floor(costLeft/worst)` also gives 1 for exactly one worst case and 0 for less. Those two are guard cases that the old code satisfied too.
- **How I read "maxCostUsd 0.05".** I read it as $0.05 *left*. With literally `maxCostUsd: 0.05`, the held-back average leaves $0.0454: the new code gives 9 and the old gives 1, not 2. The brief says "today 2", which only holds with $0.05 left, so the test sets the ceiling so that $0.05 is left.
- **How I read "never below what the token bound allows".** I took it to mean the cost count takes the same shape as the token bound. I did not take it to mean the cost count is floored at the token count, because that would let tokens override an exhausted cost ceiling. Please confirm.
