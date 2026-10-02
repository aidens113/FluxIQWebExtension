# t234 W2: the purse is the only cost authority for an evidence loop

## Outcome

Done. All paths below are in the Core worktree, under
`C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/`.
The loop now takes the build's purse and holds every decision against it. The
cost count reads that purse with nothing held back and never drops below 1. A
last decision that the cost bound limits no longer ends the loop. The only cost
ending is a refusal from the purse, and the ending carries that refusal's real
figures. The iteration, token and duration bounds work as before.

## What changed and why

- `loop-configuration.ts`: `AutomationStudioLlmEvidenceLoopInput` gains `purse?: AutomationStudioLlmBuildPurse`, with a doc comment. The `budget` comment now says cost only informs and never ends a loop.
- `evidence-loop/cost-purse.ts`, rewritten:
  - `automationStudioLlmEvidenceLoopPurse(budget, accounting, given?)` uses the given purse when there is one. Otherwise it makes its own purse at `budget.maxCostUsd`, with `spentUsd` set to the loop's accounting, as before.
  - Breaches are counted as `purse.breaches - breachesAtStart`, read in a `finally` after each decision, and written to `accounting.budgetBreaches` only when above 0. The `onBreach` increment was dropped, so the given purse and the loop's own purse are counted the same way.
  - `refusal` returns `purse.refusal` only. `standing`/`declinedBy` are gone.
  - New `figures()` returns `{ceilingUsd, spentUsd(), pendingUsd()}` for the count.
  - `refused(thrown)` now returns the refusal the thrown `AutomationStudioLlmBuildPurseRefused` carries, not a boolean.
- `loop-budget.ts`:
  - `AutomationStudioLlmEvidenceLoopSpending` gains `purse?: {ceilingUsd, spentUsd, pendingUsd}`.
  - Cost is counted when `budget.maxCostUsd` is set or a purse snapshot is given.
  - `costLeft` is `purse.ceilingUsd - spentUsd - pendingUsd`, with nothing held back. Without a purse snapshot it falls back to `maxCostUsd - estimatedCostUsd - unreported*average`, also with no extra held-back decision.
  - The next decision is reserved at `max(average, nextDecisionCostUsd)`; later ones count at the average. A `1e-9` epsilon matches the purse's.
  - The count is clamped with `Math.max(1, counted)`, and `costLeftUsd` comes from the same `costLeft`.
  - The header and the `limitedBy` comments now describe the purse as the only cost ending.
- `evidence-loop/exhaustion.ts`:
  - `purseRefusal` is kept only when `bound === "budget"`. It then gives `budgetBound: "cost"` and `costRefusal`, even when the loop had no `lastRemaining`, because a given purse may come without a budget. Otherwise the bound is `lastRemaining.limitedBy` as before.
  - The `declinedBy` filter is removed, and the comments on the `budget` bound, `budgetBound` and `costRefusal` are rewritten.
- `evidence-loop.ts` (795 lines, under Core's 800):
  - It passes `input.purse` to the purse factory, and passes `purse.figures()` into `automationStudioLlmEvidenceLoopRemaining`.
  - `exhausted(bound, costRefusal?)` receives the refusal only from the catch path where the purse refused (`purse.refused(thrown)`), so a stale `purse.refusal` on a shared purse can never reach an ending.
  - The last-decision stop is now `if (finalDecision && remaining && remaining.limitedBy !== "cost")`.
  - The comments on the old count stop are updated.

## Tests

### New tests, each checked against the old source

| | Test | File |
| --- | --- | --- |
| (a) unit | "counts the next decision while the purse can pay for it at worst, with nothing held back (t234)": $0.0738 of $0.10 spent, next worst case $0.0245, gives `decisionsLeft: 1` and costLeft ≈ 0.0262. It also checks the count against purse snapshots, including carried and pending spend. | `tests/loop-budget.test.ts` |
| (a) loop | "sends the decision the purse can pay for at $0.0738 of $0.10, and ends only when the purse refuses one". It runs the real harness with every request projected at $0.0245 and reported at $0.0123, and refuses every completion. The seventh decision is sent at $0.0738 spent, with costLeft ≈ 0.0262. The purse refuses the eighth, giving `budgetBound: "cost"` and `costRefusal{projectedCostUsd: 0.0245, spentUsd ≈ 0.0861, pendingUsd: 0, ceilingUsd: 0.1}`. | `tests/loop-budget.test.ts` |
| (b) | "ends when the purse refuses a decision, with the refusal's figures and the spend earlier builds carried". The given purse has a $0.10 ceiling and $0.05 carried in. The loop budget has no `maxCostUsd`. The second decision is refused, and the ending carries `costRefusal` `toEqual` `{…, projectedCostUsd: 0.03, spentUsd ≈ 0.08, pendingUsd: 0, ceilingUsd: 0.1, carriedUsd: 0.05}`. | `evidence-loop/tests/cost-purse.test.ts` |
| (c) | "carries on past a cost-bound last decision spent on a tool call: the purse decides". The second decision is cost-bound with `decisionsLeft 1`. It is answered with a tool call, which is not run, and the third decision completes: `ok: true`. | `tests/loop-budget.test.ts` |
| (d) | "holds every decision against the purse it was given, so what earlier calls spent on it is what is left". An earlier call on the purse settled $0.03 and breached. Every provider call runs under the given purse (`llm.purses` equals `[purse, purse]`). The second decision is shown costLeft ≈ 0.065. `budgetBreaches` is 1 (only the breach during the loop), and `purse.breaches` is 2. | `evidence-loop/tests/cost-purse.test.ts` |
| Exhaustion | "names cost with the refusal's figures whether or not the loop counted a budget, and only for a budget ending (t234)". This replaces the `declinedBy` test. | `evidence-loop/tests/exhaustion.test.ts` |

**How I checked that they fail on the old source.** I copied the five old sources to the scratchpad (`t234w2-old/`), swapped them in, ran the three test files, then restored the new files. All 12 new or changed tests failed (12 failed, 14 passed):

- (b) failed with `expected 2 to be 1`: the old loop ignored `purse` and sent the decision.
- (d) failed with `expected [ …(2) ] to deeply equal [ …(2) ]`: the old loop made a second purse.
- The (a) unit test failed with `expected { decisionsLeft: +0 … } to match { decisionsLeft: 1 …}`.
- The exhaustion test failed with `budgetBound` missing.
- (a) loop and (c) failed with `TypeError: purse.standing is not a function`, because the lead's `purse.ts` change already removed `standing()`.

To show that (a) loop and (c) also fail on the old count logic itself, I ran them a second time on the old loop with a one-line shim that tolerates the missing `standing()`:

- (c) failed with `expected { ok: false … } to match object { ok: true … }`: the old loop counted 0 and ended before the second decision.
- (a) loop never sent a seventh decision: `shown[6]` was undefined. I then moved `expect(asked).toBe(7)` first, so the old failure now reads 6 against 7.

Everything was restored afterwards.

### Changed expectations in existing tests (quoted old → new)

`tests/loop-budget.test.ts`:

- "is the fewest decisions any bound allows": `costLeftUsd: expect.closeTo(1.9395, 3)` → `costLeftUsd: expect.closeTo(1.945, 3)`.
- "counts decisions left at the last request's worst case …":
  - `{ decisionsLeft: 3, limitedBy: "cost" }` → `{ decisionsLeft: 4, limitedBy: "cost" }`
  - with next $0.1534: `{ decisionsLeft: 0, limitedBy: "cost" }` → `{ decisionsLeft: 1, limitedBy: "cost" }`
  - with next $0.001: `.toBe(3)` → `.toBe(4)`
- "reserves the worst case once …": `expect(remaining.costLeftUsd).toBeCloseTo(0.05, 4)` → `toBeCloseTo(0.0523, 4)`.
- "leaves one decision for money enough for exactly one worst case, and none for less" is renamed "… and still one for less: the purse decides". The ceiling changed from `maxCostUsd: 1` to `0.75`, so $0.5 is still left without the hold-back:
  - next $0.5: `decisionsLeft: 1`, unchanged
  - next $0.25 (added): `decisionsLeft: 2`
  - next $0.5000001: `{ decisionsLeft: 0 …}` → `{ decisionsLeft: 1 …}`
  - fresh with next $0.75: `.toBe(0)` → `.toBe(1)`
- "is nothing once a bound is spent, and never more than the iteration backstop" is renamed "… save cost, …":
  - `{ maxCostUsd: 0.45 }` → `{ decisionsLeft: 0, limitedBy: "cost" }` becomes `{ decisionsLeft: 1, limitedBy: "cost", costLeftUsd: expect.closeTo(0.05, 3) }`
  - added: an overspent `{ maxCostUsd: 0.3 }` gives `{ decisionsLeft: 1, …, costLeftUsd: 0 }`
- "shows the model what is left …": `costLeftUsd: expect.closeTo(0.985, 3)` → `costLeftUsd: expect.closeTo(0.99, 3)`.

`evidence-loop/tests/exhaustion.test.ts`: the test "carries the purse's standing as the cost figures only where the loop's count ran out of cost (t194-w47)", which built a `declinedBy: "loop_budget"` standing, was removed. The new t234 test above replaces it.

`evidence-loop/tests/cost-purse.test.ts`: the existing three tests are unchanged and pass. Their assertion `expect(refusal).not.toHaveProperty("declinedBy")` still holds.

## Commands run and observed results

All from `packages/fluxiq` in the t234 Core worktree.

| Command | Result |
| --- | --- |
| Baseline before editing: `npx vitest run …/llm/tests/loop-budget.test.ts …/llm/evidence-loop …/llm/build-purse …/runtime/loop-limits …/llm/tests/evidence-loop` | 33 files, 280 tests passed. |
| `npx vitest run src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/llm/build-purse src/programs/automation-studio/runtime/loop-limits` | `Test Files 28 passed (28)`, `Tests 194 passed (194)`. |
| `npx vitest run src/programs/automation-studio/runtime/llm/tests/evidence-loop` (provider, draft-shown, seeded-draft, tool-failure, evidence-loop) | `Test Files 5 passed (5)`, `Tests 91 passed (91)`. |
| Old-source checks | As described above: 12 failed, then 2 failed with the shim. |
| `npx tsc -p <scratchpad>/t234w2-tsconfig.json` | Exit 0, no errors; `Files: 1416`. This is not a whole-package run: the scratch tsconfig lists only my 8 files and tsc follows their imports. **No type errors in my files.** |
| `node scripts/structure-audit.mjs` (repo root, read-only) | Exit 1. Both FAILs are in `runtime/service.ts` (another worker's): file lines 4518 > baseline 4491, and a barrel bypass on `./service/creation-spend.ts`. For my files, only the existing advisory `warn [file-lines] … evidence-loop.ts: 795 lines is past the 400-line advisory threshold`. |

The combined total of 285 equals the 280 baseline plus the 5 tests added.

## Not verified

- No live or Lab run, as the brief said.
- No whole-package `tsc`, as the brief said.
- The callers in `service.ts` and `flow-bootstrap/` do not pass `purse` yet; that is other workers' work. The end-to-end behaviour of a real build sharing one purse across the instruction reading, the rounds and the judge has not been exercised.

## Open questions or contradictions found

1. **Stale `declinedBy` consumers outside my files** will break now that the purse and the loop no longer produce it:
   - `runtime/flow-bootstrap/unfinished-build/phases.ts:359`: `refusal.declinedBy === "loop_budget"` is a type error once the field is gone, and it never fires.
   - `runtime/flow-bootstrap/unfinished-build/tests/budget-figures.test.ts:130`
   - `runtime/flow-bootstrap/unfinished-build/tests/loop-budget-cost-ending.test.ts:93`: it expects `costRefusal` with `declinedBy: "loop_budget"`, an ending that can no longer happen.

   These belong to whoever owns `flow-bootstrap/`.
2. **At a cost-bound last decision only completion is offered**, because `canAmend` is false at the last decision, and that is unchanged. The loop now carries on rather than ending, so a completion refused there is asked again with completion only, until the purse refuses or the no-progress guard stops it. Amendments stay unavailable. If amending should be allowed while cost alone is at 1, `canAmend` would need `!finalDecision || remaining.limitedBy === "cost"`. I did not change it, because the brief did not ask for it.
3. **Breach counting** reads the purse's delta after each decision. A breach on a shared purse from a call outside the loop's decisions but during the loop (for example, a tool that itself calls a model) is counted at the next decision. One after the loop's last decision is not in this loop's accounting; it is still on `purse.breaches`.
4. **When the cost count applies**:
   - With a purse given, the cost count (and `costLeftUsd`) appears whenever the loop has a `budget`, even one without `maxCostUsd`.
   - With a purse but no `budget` at all, nothing is counted or shown, as before. A refusal still ends the loop with `budgetBound: "cost"` and `costRefusal`.
   - When both a purse and `budget.maxCostUsd` are given, the purse's ceiling wins.
