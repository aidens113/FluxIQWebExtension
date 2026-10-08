# t371 report: playback goes on past every optional step that cannot be done

## Outcome

Done. The work is in the t371 Core tree (`C:\Users\osrs_\FluxStuff\fxwork\t371\!FluxIQ`, branch `task/t371-playback-optional-budget`). Nothing is committed.

There is now one rule for optional steps. Every execution path uses it: playback, trials, partial runs and resumed runs all go through `graph-run.ts`. An optional step that cannot be done goes on past it, whatever stopped it (target absent, a timeout, a target that is not actionable, an action that failed, an ambiguous target). Doing so spends none of the recovery or reroute budget. The budgets still apply to real failures, and a real failure still stops the run once they are spent.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

**Cause (confirmed by reading the code and by the fail-first runs).** The absent-target skip already went on past an optional step without touching the budget. Any other failure of an optional step went through the recovery ladder:
- The optional shape's failed edge into its Merge was offered as a `deterministic_path` candidate only while both budgets lasted (`executor/recovery-ladder.ts`).
- Once taken, that edge counted against both budgets (`executor/recovery-budget.ts`).
- So under the Flow default (subflow budget 2), the third optional step that timed out or could not be pressed found the budget spent. It then fell to the continuation rule, which stops for a domain output whose ports it cannot enumerate.

**Changes:**

1. **New `executor/step-skip/optional-step.ts`: `automationStudioOptionalStepWayOn(flow, node)`.** This is the one definition of "optional" and of "the way on past it":
   - the drafted optional shape (a `failed` edge into a Merge that `success` also enters), where the way on is the `failed` edge; or
   - `metadata.sometimesPresent === true`, where the way on is the shape's `failed` edge if the node has the shape, otherwise its `success` edge.

   It is exported from the `step-skip` and `executor` barrels. It accepts any `{ nodes, edges }`, so the trial can pass its `AutomationStudioFlowArtifact`.
2. **`step-skip/absent-step.ts`** now uses that helper instead of its own copy of the shape check. Behaviour is unchanged.
3. **`recovery-ladder.ts`:**
   - For an optional node, the ladder offers the way on as `deterministic_path`, labelled "Go on past the optional step". It does this whatever the budgets say, and the offer replaces the failed-route candidate.
   - The cheaper rungs still run first. So a timed-out optional wait is still retried three times (the user's retry rule), and a covered button is not retried, because it is not retryable.
   - New `automationStudioRecoveryPathEdge(flow, node, decision, failedEdge)` returns the edge a `deterministic_path` decision follows: the optional way on (which may be a `success` edge) or the authored failed route.
4. **`recovery-budget.ts`:** `recoveryBudgetState` now takes `flow` as a required fifth argument. An earlier attempt whose decision followed its node's optional way on is not counted as a recovery or a reroute. Any other route from the same node still counts.
5. **`graph-run.ts`:**
   - It passes `flow` to `recoveryBudgetState`.
   - It uses `automationStudioRecoveryPathEdge` to choose the edge to follow. This lets a `sometimesPresent` node without the shape go on along its `success` edge.
   - The file is back to exactly 800 lines, the limit.
6. **`graph-navigation.ts`:** `chooseAutomationStudioEdge` now takes `Pick<AutomationStudioFlowDocument, "edges">`. This only widens the type it accepts.
7. **Trial (`flow-bootstrap/verification/detached-execution.ts`):**
   - The budgets used to be the number of all `failed` edges (t368). They are now the number of written `on failed:` branches only: every `failed` edge except an optional step's way on.
   - Before, optional routes inflated the trial's budget. A written failed branch could therefore be taken again as many times as the optional steps had left budget over.
   - Trials and playback now read the same rule. For script candidates, which normally contain only optional shapes, the budget is back to 0. That also closes t368's open point about reroutes to `builtin.policy.recovery` nodes in trials.
8. **Docs:**
   - `docs/architecture/automation-studio.md`: the sometimes-present paragraph used to say an optional node failing another way "goes through the ladder unchanged". It now describes the new rule.
   - Regenerated `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`. The changes are the new export plus line-number shifts.

**Tests:**
- Extended `executor/tests/optional-failed-route.test.ts`. I did not create a new file, because `executor/tests/` would have reached 26 files, over the 25-file limit.
  - Three optional steps (absent, timeout, not actionable) complete under the default budget and under a budget of zero.
  - Each step keeps its own retries: absent 1 dispatch, timeout 4, not actionable 1.
  - Under the default budget, a real failure after the optional steps still has the whole budget (`budgetState` 0/0) and takes its written failed route.
  - Under a budget of 1, the first real failure takes its route and the second stops, with `budgetExhausted` set and no `deterministic_path` candidate.
  - A `sometimesPresent` node without the shape that times out goes on along `success` under a budget of zero.
  - The budget does not count an optional way on, but does count another route from the same node.
  - One existing test encoded the old behaviour ("gives an optional press that failed some other way no failed route when the subflow budget is zero"). It is replaced by its opposite.
- `flow-bootstrap/verification/tests/detached-execution.test.ts`:
  - A trial with the same three optional steps completes.
  - Then a mutating step (`pay`) with a written failed branch to `fix`, looping back through a Merge. Its branch is taken exactly once (fix dispatched 1, pay 2), and then the trial stops with `candidate.execution_incomplete`.

## Commands run and observed results

All commands ran in `C:\Users\osrs_\FluxStuff\fxwork\t371\!FluxIQ`. Vitest and tsc ran from `packages/fluxiq`.

**Fail-first: source changes reverted, new tests kept.**
- Command: `npx vitest run .../executor/tests/optional-playback-budget.test.ts .../executor/tests/optional-failed-route.test.ts .../verification/tests/detached-execution.test.ts`. The new playback tests were still in their own file at that point.
- Result: `Tests 7 failed | 49 passed (56)`. The 7 failures:
  - three optional steps under a budget of zero;
  - a real failure after them still has the whole budget;
  - the budget is spent, then the run stops;
  - `sometimesPresent` without the shape;
  - the optional press's way on at budget 0;
  - the budget does not count the optional way on;
  - the trial takes its written branch once.
- The three-optional-steps case under the **default** budget passed before the fix too. With one absent step and two ladder-taken steps, the old code spent exactly 2 of 2. The case that fails before the fix is a real failure *after* those steps.

**Fix restored, final runs:**
- `npx vitest run` over `executor/`, `flow-bootstrap/`, `service/candidate-trial/`, `service/flow-bootstrap-commands/tests/`, `activity/`, `flow-draft/`, `llm/harness-options/`, `llm/node-tools/`, `recovery/`, `result-verification/`, `service/flow-settings/`, `service/runtime-adaptation/`, `tests/executor.test.ts`, `tests/refuted-result/`, `tests/service-adaptation/`, `src/ui/activity-action/` -> `Test Files 405 passed | 1 skipped (406)`, `Tests 4712 passed | 2 skipped`.
  - This ran before two changes: the move of the path-edge selection into `recovery-ladder.ts`, which does the same thing, and the merge of the test files.
- After those two changes: `npx vitest run .../executor/ .../flow-bootstrap/verification/` -> `Test Files 40 passed | 1 skipped (41)`, `Tests 527 passed | 2 skipped`.
- `npx tsc --noEmit -p .` -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (289 warning(s), 710 baselined)`.
  - It also printed "1 baseline entries can be lowered", as it did for t368. I did not run `structure:baseline`.
  - Before the fixes, the audit had reported two failures: `executor/tests/` at 26 files and `graph-run.ts` at 808 lines. Both are resolved as described above.
- `pnpm docs:check`:
  - First run: "framework-reference.md is stale".
  - After `pnpm docs:reference` ("3367 public declarations"): `structure-audit: passed (0 warning(s), 0 baselined)` and "Deterministic framework reference is current."
- New `as never` casts: `git diff`, plus the new file, `| grep "^+" | grep -c "as never"` -> 0.
- Import cycles: covered by the audit's `import-cycles` rule, which passed.

## Not verified

- No live, Lab, browser or provider run. Playback was exercised only through `runAutomationStudioGraph` with a stub dispatcher. Trials were exercised through `runAutomationStudioDetachedCandidate` with a stub native executor.
- The full Core suite was not run, per the twice-a-day rule.
- I did not check the activity cards for an optional step that times out. The ladder's final thought still uses the generic "follows what the Flow says to do when this step fails" wording from `activity/wording/recovery-choice.ts`. That file is owned by t373 / `activity/**`, which I must not touch.
- The failure shapes for "timeout" (`timeout` / `web.action.timeout`) and "not actionable" (`unexpected_state` / `web.target.not_actionable`, from `domain/src/runtime/failure/codes.ts`) are taken as the domain declares them. No real trace was used.

## Open questions or contradictions found

1. **Reference files collide with t372.** t372 owns `scripts/docs-reference.mjs` and the two generated reference files, and will change their format. My regenerated copies differ only by the new export `automationStudioOptionalStepWayOn` and line numbers. At integration, take t372's versions and run `pnpm docs:reference` again rather than merging these two files by hand.
2. **`metadata.optional === true` is not part of the shared rule.** The brief defines optional as the drafted shape or `sometimesPresent`. A node marked only `metadata.optional` still goes on through the continuation rule, which returns "continue" whatever the budget. But if such a node also has a failed edge that is not the shape, taking that edge still spends budget. Whether `optional` should join the rule is a product decision.
3. **An authored failed branch on a `sometimesPresent` node without the shape.** Its way on is the `success` edge, so the ladder now goes on along `success` instead of the authored `failed` branch. This matches what the absent-target skip already did for such a node. No existing test covered that combination.
