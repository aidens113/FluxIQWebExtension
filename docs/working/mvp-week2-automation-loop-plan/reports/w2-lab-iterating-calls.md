# Report: w2-lab-iterating-calls

## Outcome

**Done.** The Testing Lab now follows Core's call-count model:

- A diagnosis makes exactly one call.
- An adaptation makes as many calls as the operator allows with `--llm-max-calls` (default 26, the same as Core). The option is refused only above 64 or below 1.
- The Lab contract's ceiling is now Core's backstop of 64.
- `explore_and_adapt` is a purpose the Lab can type and carry. `--llm-task adapt` still maps to `diagnose_and_adapt`.

Both of the supervisor's mid-task additions are built.

**First addition: high-token confirmation.** The Lab sends `highTokenConfirmation: true` only when the run's token budget is above Core's 100,000-token threshold. It records whether it sent it, and why, in `snapshots/live-llm.json`.

**Second addition: default 26 and a run token budget.**
- The default call count is 26.
- The Lab carries a whole-run token budget, `maxTotalTokensPerRun`, in the grant request, and bases the confirmation on that budget.
- The post-run checks judge the run against that budget.

All checks are green:
- `pnpm check`: exit 0.
- test-runner: 964 of 964.
- test-contracts: 94 of 94.
- Structure audit: passed.

**What a live run needs before it can work.** Core must be rebuilt, and Core's HTTP handlers do not yet forward the run token budget. Both are under "Open questions".

## What changed and why

**`packages/test-contracts/src/llm.ts`**
- `LLM_LAB_MAX_CALLS_PER_RUN` changed from 2 to 64. It mirrors Core's `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS`.
- `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun` changed from 2 to 26, Core's default.
  - It is written inline, not as a new export. A new export pushed this file past the audit's advisory limit of 8 exported values, so I took it out again.
- Added an optional `LlmTokenBudget.maxTotalTokensPerRun`. When it is absent, the budget is Core's default.

**`packages/test-contracts/src/llm-validation.ts`**
- The budget validator accepts the new field. It must:
  - be absent in dry mode;
  - be a whole number of at least one request's total tokens;
  - be no more than per-request tokens × `maxCallsPerRun`.
- The existing call-count checks now use 64 automatically.

**`packages/test-runner/src/live-llm/live-llm-plan.ts`**
- `PURPOSE_CALLS` (`{diagnosis_only: 1, diagnose_and_adapt: 2}`) is replaced by `PURPOSE_ITERATES`: `diagnosis_only` does not iterate; `diagnose_and_adapt` and `explore_and_adapt` do.
- `--llm-max-calls` is bounded to 1–64 for every purpose. A purpose that iterates takes that number; `diagnosis_only` takes 1.
- New plan fields:
  - `maxTotalTokensPerRun`: the typed `--llm-max-run-tokens`, clamped down to what the authorized calls could use. Without one, Core's formula exactly: `max(perCall, min(perCall × calls, 100_000))`. A typed value below one request is refused.
  - `maxTotalEstimatedCostUsd`: `min($2, perCallCost × calls)`, Core's own default, made explicit.
  - `highTokenConfirmation`: whether to send it, the budget it is judged on, the threshold, and a one-sentence reason.

**`packages/test-runner/src/live-llm/execution-grant.ts`**
- Both requests are now built field by field.
- Preflight and issue both carry `maxTotalTokensPerRun` and `maxTotalEstimatedCostUsd`.
- `highTokenConfirmation: true` is sent on the issue call only, and only when the plan requires it.
- The returned grant now carries `highTokenConfirmationSent` and `maxTotalTokensPerRun`. The latter is `null` when Core reports none.
- The grant is refused if Core reports:
  - a larger run token budget than was asked for;
  - a total cost above the plan's total.

**`packages/test-runner/src/live-llm/budget.ts`**
- Run-wide totals are now judged across the *authorized* calls (`plan.maxCalls`), not the typed cap. That is never looser. For example, a diagnosis typed with a cap of 26 is judged across 1 call, not 26.
- Total cost is judged against `plan.maxTotalEstimatedCostUsd`. Otherwise 26 × $0.25 = $6.50 would be a number no grant can reach.
- Total tokens are judged against `plan.maxTotalTokensPerRun`. The figure used is the larger of Core's accounting and the sum of the per-call records, so a run with no published accounting is still bounded.
- The old "per-request tokens × calls" total-token check is replaced; the run budget is never looser than it.
- The call-count checks against both the authorized count and `--llm-max-calls` are unchanged.

**`packages/test-runner/src/live-llm/live-llm-run.ts`**
- The run keeps the issued grant.
- The snapshot now records:
  - `authorized.maxTotalTokensPerRun` and `authorized.maxTotalEstimatedCostUsd`;
  - `granted`: what Core issued;
  - `highTokenConfirmation`: `{ sent, authorizedTokens, threshold, reason }`.

**`packages/test-runner/src/flow-lane/persisted-flow-run.ts`**
- The `PersistedFlowLlmExecution.purpose` union now includes `explore_and_adapt`.

**`packages/test-runner/src/commands.ts`**
- New option `--llm-max-run-tokens`. It is optional and is put into the budget only when typed.
- The `--llm-max-calls` default follows the contract (26).
- **Why add an option?** Once the confirmation is judged on the run budget, and that budget defaults to at most 100,000, no run could ever exceed the threshold without an operator-settable budget. The confirmation path would be unreachable and untestable.

**`packages/test-runner/src/demo-llm-profile.ts`**
- Both creation profiles use the Lab default (26) instead of 2.

**`packages/test-runner/src/demo-llm-adaptation.ts`**
- `FIRST_LIVE_ADAPTATION_PROFILE` uses the Lab default (26).
- The evaluation's `maxCallsPerRun` now reads the profile's value instead of a literal 2.
- The certifier's "exactly two invocations" is **kept deliberately**, with a comment. It certifies what `demo-workspace/adaptation-lane.ts` collects, which is one diagnosis and one patch. Accepting more there would misstate a run's spend unless the lane (not mine) also collects the calls in between.

**Tests**
- New: `live-llm/tests/execution-grant.test.ts` and `live-llm/tests/live-llm-run.test.ts`.
- Rewritten or extended: `live-llm/tests/live-llm-plan.test.ts`, `live-llm/tests/budget.test.ts`, `tests/commands.test.ts`, `tests/demo-llm-profile.test.ts`, `tests/demo-llm-adaptation.test.ts`, and `test-contracts/tests/llm-contracts.test.mjs`.
- Updated one assertion in `tests/demo-llm-creation.test.ts`. It pins `DEFAULT_DEMO_LLM_CREATION_PROFILE.budget`, which I changed, so it could not stay as it was.
- Tests the brief asked for:
  - adapt with `--llm-max-calls 10` is accepted and carries 10;
  - 65 is refused with "--llm-max-calls 65 must be a whole number between 1 and 64";
  - diagnose plans exactly one call;
  - the contract validator accepts up to 64 and refuses 65.
- Tests the supervisor added:
  - confirmation on both sides of the threshold (100,000 not sent, 100,001 sent), at plan, grant-request and snapshot level;
  - a default 26-call adapt run needs no confirmation.
- **Drift test** (`live-llm-plan.test.ts`, last test). It reads Core's *source* `execution-grants.ts`, found through `import.meta.resolve("fluxiq/automation-studio")`, and checks that:
  - `..._MAX_CALLS` = 64;
  - `..._DEFAULT_MAX_CALLS` = the Lab default;
  - `..._HIGH_TOKEN_CONFIRMATION_THRESHOLD` = the plan's threshold;
  - `MAX_TOTAL_COST_USD` = the plan's cost ceiling.
- **The drift test demonstrably works.** It failed twice mid-task with `10 !== 26`, while Core still said 10, and passed once Core landed 26.

## Commands run and observed results

**test-contracts** (`pnpm --filter @fluxiq-web-extension/test-contracts test`)
- After the first edit: `# tests 93 # pass 93 # fail 0`.
- Final: `# tests 94 # pass 94 # fail 0`.

**test-runner** (`pnpm --filter @fluxiq-web-extension/test-runner test`)

| Run | When | Result |
| --- | --- | --- |
| 1 and 2 | Before Core landed 26 | exit 1; `# tests 963 # pass 962 # fail 1`. The only failure was the drift test: `10 !== 26` |
| 3 | After Core landed 26 | exit 0; `# tests 964 # pass 964 # fail 0 # cancelled 0` |
| Final | After the last edit | exit 0; `# tests 964 # pass 964 # fail 0 # cancelled 0` |

The count was 940 at `ea0a2ec`; the 24 extra tests are new.

**Other checks**
- `pnpm --filter @fluxiq-web-extension/test-runner check`: no errors.
- `node scripts/structure-audit.mjs`:
  - First run: `structure-audit: passed (58 warning(s), 17 baselined)`. One of those warnings was mine (`llm.ts: 9 exported values`), fixed as described above.
  - Final: exit 0, `structure-audit: passed (57 warning(s), 17 baselined)`.
- `pnpm check`, run twice, the second after the last edit: exit 0, and the audit line again read `passed (57 warning(s), 17 baselined)`.

## Not verified

- **No live provider call.** As the brief required, `pnpm lab` and `--live-llm` were not run, so nothing here shows that a real 26-call adapt run is accepted by Core end to end.
- **Core's new shape was typechecked only as far as it had landed.** At the end, Core source had:
  - `DEFAULT_MAX_CALLS = 26`;
  - `maxTotalTokensPerRun` in `preflight`;
  - confirmation judged on `max(maxTotalTokensPerRun, perCall)`.

  The Lab reaches Core only over HTTP and does not import these types, so nothing here typechecks against them. The shape was coded from `reports/w2-guards-not-call-counts.md` and a read of Core source.
- **Core's `packages/fluxiq/dist` was stale when checked mid-task.** It had `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS = 8` and no default constant. The Lab's Core web build is built from Core's `packages/*/dist` (`core-web-build/inputs.ts`). Until Core is rebuilt, a live run would enforce the old grant code, and a 26-call grant would be refused with "LLM execution call limit is invalid."
- **No manual browser validation.** None was needed for the code I changed.
- **The demo lanes under `demo-workspace/`** were not run.

## Open questions or contradictions found

1. **Core's HTTP handlers drop `maxTotalTokensPerRun`.**
   - Both handlers in `AS/api/handlers/llm-generation.ts`, `preflight-llm-execution` (line 37) and `issue-llm-execution-grant` (line 55), copy request fields by name, and neither forwards `maxTotalTokensPerRun`. The "Exact change" in `w2-guards-not-call-counts.md` does not mention this file.
   - Core's `publicGrant` (`execution-grants.ts:562`) does not return `maxTotalTokensPerRun` either.
   - **Effect today:** Core ignores the budget the Lab sends and uses its own default.
     - For a default run the two numbers are identical, so nothing changes.
     - For a *typed* `--llm-max-run-tokens` below the default, only the Lab's post-run check enforces the lower number. The Lab accepts a grant that reports no budget, so nothing refuses the grant up front.
   - **Fix, in Core:** forward the field in both handlers, add it to `publicGrant`, and add it to `AutomationStudioLlmExecutionLimitRequest` (`api/contracts/llm.ts`). Once `publicGrant` reports it, the Lab's existing check refuses a grant whose budget is larger than requested.
2. **Core's API purpose type is stale.** `AutomationStudioLlmExecutionPurpose` (`AS/api/contracts/llm.ts:22`) still omits `explore_and_adapt`. The handlers and the grant service accept it at run time.
3. **This repository has a stale narrow purpose type.** `packages/test-runner/src/existing-fluxiq-control.ts:278` (not mine) types `llmExecution.purpose` as `"diagnosis_only" | "diagnose_and_adapt"`. It compiles because method parameters are bivariant, and at run time it forwards the value as `runIntent`, which Core accepts. It should be widened to match `PersistedFlowLlmExecution`.
4. **How I read "diagnose still requires exactly one".** A diagnose plan always carries one call. It accepts any typed `--llm-max-calls` from 1 to 64 rather than refusing anything but 1.
   - This matches the Lab's behaviour before this change.
   - Core refuses only an explicit `maxCalls` other than 1, and the Lab always sends 1.
   - Refusing would have broken `--llm-task diagnose` without `--llm-max-calls`, now that the default is 26.
5. **Remaining places in this repository that still assume two calls.** None of these files were mine.
   - **UI settings driver.** `packages/test-runner/src/demo-workspace/diagnosis-ui.ts:198-201` types "Max calls" = `"2"` for adaptation. It chooses the adaptation token values only when `maxCalls === "2"`.
   - **Adaptation lane.** `packages/test-runner/src/demo-workspace/adaptation-lane.ts`:
     - line 60 configures 2 calls through the UI;
     - lines 78-80 require exactly [diagnosis, runtime_patch] and `providerCallCount === 2`.
   - **Exploration-adaptation lane.** `packages/test-runner/src/demo-workspace/exploration-adaptation.ts`:
     - line 133 configures 2;
     - line 241 requires the source run's `providerCallCount === 2`.
   - **Exploration-adaptation certifier.** `packages/test-runner/src/demo-llm-exploration-adaptation.ts`:
     - lines 70-72 require `providerCallCount === 2` and exactly two interventions;
     - types at lines 10, 29 and 46, and values at lines 101, 147 and 195, are the literal `2`.
   - **Adaptation control.** `packages/test-runner/src/demo-llm-adaptation-control.ts:144-147` requires the same.
   - **Exploration-adaptation revert.** `packages/test-runner/src/demo-llm-exploration-adaptation-revert.ts:118-119` requires the same.
   - **Adaptation certifier (in my files, left on purpose).** `packages/test-runner/src/demo-llm-adaptation.ts`: the `providerCallCount: 2` type and value (lines 162 and 260) and "exactly two invocations" (line 312). It certifies what the adaptation lane collects; see "What changed".
   - **Tests that pin the above:** `tests/demo-llm-exploration-adaptation.test.ts`, `tests/demo-llm-exploration-adaptation-revert.test.ts`, `tests/demo-llm-adaptation-control.test.ts`.
   - **What will break.** Under Core's new model, `diagnose_and_adapt` may spend a call gathering evidence. So these UI-driven demo lanes, which cap the Flow at 2 calls through the Settings screen, may now end with no patch. Their certifiers would also reject a run that made 3 or more calls. They need their own brief, owning `demo-workspace/**` and those certifiers.
6. **Documentation is stale.** `docs/architecture/testing-facility.md:1877` still says "two calls per run … Retries consume the same two-call allowance". The new `--llm-max-run-tokens` option is documented nowhere. `docs/**` was not mine to edit.
