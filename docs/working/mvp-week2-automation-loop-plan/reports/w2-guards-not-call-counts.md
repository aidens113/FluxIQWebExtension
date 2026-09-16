# Report: w2-guards-not-call-counts

Repository: FluxIQ Core (`F:\!FluxIQ`). `AS/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.
Nothing was committed or pushed.

## Outcome

**Done**, including the two items the coordinator added mid-task.

A recovery is no longer bounded by a small fixed call count. It keeps going while it makes progress and stops on one of four guards:

1. the run's estimated-cost ceiling;
2. the run's token budget;
3. the recovery deadline;
4. a new no-progress guard.

The no-progress guard ends with its own outcome, `no_progress`, which is distinct from `budget_exhausted` (money, tokens and time each still name their own code).

Coordinator additions:

- **Captured failure evidence blocked every live exploration: verified and fixed.** A test fails without the fix and passes with it.
- **The grant default of 10 calls:** yes, it binds a normally progressing recovery. The exact change is below.

Required checks:

- Core `pnpm check`: exit 0.
- Runtime suite: 932/932 on the final run. It was 890 at HEAD; the other worker's new tests are included.

## Worst-case cost of one recovery

These are estimates, from the ledger's estimated-cost accounting.

**Recovery without an adapting grant** (training-mode recovery; also `explore_and_adapt`, see open question 3):

- Estimated cost is at most **$0.25**. A policy can lower that, never raise it.
- Tokens are at most **144,000** by default. `settings.budgets.maxTokensPerRun` binds as written.
- Wall clock is at most **120 s**.
- The call backstop is 250.
- At DeepSeek peak prices ($0.44/M input, $1.32/M output), 144,000 tokens is about $0.06 if all input and $0.19 if all output. The token budget usually binds before the $0.25.
- Each call reserves $0.25/24 ≈ $0.0104. A default-sized DeepSeek request (8,000 in + 2,000 out) costs at most ≈ $0.0062, so the $0.25 cannot be overshot at default token limits.

**Recovery under a `diagnose_and_adapt` or `diagnosis_only` grant:**

- Estimated cost is at most the grant's own total, and never more than **$2.00**. That is both the grant service's limit and a new Core per-recovery ceiling, `AUTOMATION_STUDIO_RECOVERY_MAX_ESTIMATED_COST_USD_PER_RUN`.
- The default grant is 10 calls × $0.25, capped to $2.00.
- Calls are at most the grant's count: default 10, maximum 64.
- The token budget is the per-call limit × the grant's calls, which is exactly the exposure the person confirmed when the grant was issued. That is **100,000** for a default grant, and up to 640,000 for a confirmed 64-call grant.

**Overshoot caveat:** a call whose reported cost exceeds its reservation is still charged, and counted as a breach. So the true worst case can exceed a ceiling by at most one call's overage. That only happens with per-call token limits raised well above the defaults.

## What changed and why

- **`AS/llm/run-budget.ts`** — the call count is now only a backstop.
  - `maxCallsPerRun` is optional. It defaults to `AUTOMATION_STUDIO_LLM_RUN_CALL_BACKSTOP = 250`, and no call-count value depends on the kind of run.
  - Every call counts against that one number.
  - **Task 3 (the separate exploration allowance):** removed. That means `maxExplorationCallsPerRun`, `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_EXPLORATION_CALLS_PER_RUN` and `llm_budget.run_exploration_call_limit`.
    - Once calls stopped being the governing limit, a second call ceiling had nothing left to protect.
    - `allowance` stays as a label on the receipt, because the receipt is useful and `task-request.ts` references the type.
    - `snapshot().calls` now counts every call; `explorationCalls` is the subset.
- **`AS/recovery/progress-guard.ts`** (new) — the no-progress guard.
  - A step advances only if it brings back something new.
  - The guard stops after `maxStepsWithoutProgress` consecutive non-advancing steps (default 3), with a reason: `repeated_request`, `repeated_evidence` or `no_new_evidence` (empty or refused).
  - The streak resets on any step that advances. Answers are compared by a short FNV-1a hash of their content.
- **`AS/recovery/exploration-budget.ts`**
  - The ledger owns the guard. `recordAction` takes `{ signature, evidenceDigest, evidenceBytes, refused? }` and stops with `no_progress`. If a refusal limit and the streak come due on the same step, the refusal reason is reported.
  - `noProgressReason` is exposed. The new setting `maxStepsWithoutProgress` defaults to 3, with a ceiling of 8.
  - Time, actions and provider calls are now backstops:
    - `maxDurationMs`: 30 s → 120 s (ceiling 120 s → 600 s).
    - `maxActions` and `maxProviderCalls`: 8 → 24 (ceilings 16 → 64).
- **`AS/recovery/exploration-outcome.ts`**
  - Adds the `no_progress` outcome and stop reason.
  - `repeat_window` and the loop's `duplicate_tool_request` and `repeat_without_progress` now map to `no_progress` instead of `budget_exhausted`.
  - The removed run-budget code is dropped.
- **`AS/recovery/runtime-exploration.ts`**
  - Each action records its signature, a hash of what came back, and the size of what came back. Empty answers (`null`, `""`, `{}`, `[]`) count as zero bytes.
  - `noProgressReason` appears on the result and in the trace, with one sentence per reason.
  - `no_progress` shows in the trace with status `failed`.
- **`AS/recovery/annotation/run-budget.ts`** (new, extracted from `annotate.ts`) — `resolveAutomationStudioRecoveryRunBudget`.
  - The per-mode call counts are gone: 1 for `diagnosis_only`, 2 for `diagnose_and_adapt`, otherwise min(intervention limits, 2).
  - The intervention limit is no longer read as a provider-call cap. A call count a resolver declares is still honoured, because a grant issues exactly that many call authorizations. Otherwise the backstop applies.
  - The purse is split among exactly the declared calls, or 24 shares when none are declared. Each share is rounded down to a billionth of a dollar. The reason is a problem found during this task:
    - The grant commits each call's **reservation**, not its actual cost, against its total, and rounds that running total to a billionth of a dollar.
    - My first version split the purse into at most 24 shares, so a 25–64-call grant would have refused its later calls on cost, with an unnamed error that also revokes the grant.
    - A test now covers 10-, 25-, 26- and 64-call grants.
  - A grant's token budget is the per-call limit × its calls, which is what issuing it confirmed.
  - A new optional `resolution.maxTotalTokensPerRun` caps the token budget. It is ready for the grant change below.
  - The $2.00 per-recovery ceiling is added here.
  - `annotate.ts` is 352 lines; it was 395 at HEAD and 435 mid-task.
- **`AS/recovery/annotation/exploration.ts`** — **the captured-failure-evidence fix.**
  - `sanitizeAutomationStudioLlmFailureEvidence` throws for any task other than `runtime_diagnosis` and `runtime_patch` (`llm/harness/failure-evidence.ts:50`). `packAutomationStudioLlmContext` calls it whenever `failureEvidence` is present (`context-packet.ts:118`).
  - So the `evidence_tool_decision` request, which carried `failureEvidence`, threw before any provider call whenever the domain captured evidence.
  - Verified by test: before the fix the provider saw only `["runtime_diagnosis"]`; after it, `["runtime_diagnosis", "evidence_tool_decision", "evidence_tool_decision"]`.
  - Fix: the gather request no longer carries it, with a comment explaining why. The now-unused `failureEvidence` input field was removed, along with `annotate.ts`'s pass-through, so it cannot be re-added by accident.
  - The diagnosis and the patch still receive it.
  - Reusable context is sanitized for any task and does not throw. Recovery context is silently dropped for this task. Neither needed a change.
- **Edits outside my owned list (justified):**
  - **`AS/loop-limits/evidence-loop.ts`: ceilings 16 → 64. Required.**
    - The evidence loop rejects any configured limit above these ceilings (`invalid_configuration`). At 16, an exploration's provider calls would be hard-capped at 16 whatever the guards say.
    - An existing test pins the exploration ceilings equal to these values.
    - Only the ceilings changed. The loop's defaults stay at 8, so flow bootstrap is unaffected.
  - **`AS/recovery/index.ts`:** one export line for `progress-guard.ts`, whose types appear in the exported exploration result.
  - **`AS/tests/service-adaptation/tests/llm-grants.test.ts`: required.**
    - "shares one atomic call budget…" relied on the intervention limit capping provider calls, which is exactly the behaviour removed.
    - The one-call limit now comes from the resolver's `maxCallsPerRun: 1`. The assertions are unchanged, and the unused `JsonObject` import was removed.
    - The other worker has not modified this file.
- **Tests**
  - New: `recovery/tests/progress-guard.test.ts`; `recovery/annotation/tests/iteration-guards.test.ts`, which replaces the deleted `run-budget-allowance.test.ts`; `recovery/annotation/tests/run-budget.test.ts`.
  - Updated: `llm/tests/run-budget.test.ts`, `recovery/tests/exploration-budget.test.ts`, `exploration-outcome.test.ts`, `runtime-exploration.test.ts`, `annotation/tests/annotate.test.ts` (which gains the failure-evidence test).
  - What the brief asked for is proven by:
    - **Progress beyond the old limits:** a loop that keeps finding new evidence makes 21 calls in the runner, and 15 calls with 13 exploration decisions through the whole recovery path. That is past the old limits of 2, 6 and 16.
    - **No-progress guard:** a circling loop stops on `no_progress` after 4 of 24 allowed actions. The circling cases are `repeated_evidence`, `repeated_request` and `no_new_evidence`.
    - **Cost and token ceilings:** the cost ceiling stops a recovery with `llm_budget.run_cost_limit`, and the token budget stops one with `llm_budget.run_total_limit`.
    - **Deadline and backstop:** an expired recovery deadline still stops a progressing loop, and the 250-call backstop still stops a runaway.

## Would the grant default of 10 bind a normally progressing recovery?

**Yes.**

- Ten calls cover the diagnosis, the patch and 8 exploration decisions, so at most 7 looks at the page.
- My exploration's own default ceiling is 24 decisions. The "keeps learning" recovery in `iteration-guards.test.ts` makes 13.
- Under a 10-call grant, the run budget uses the grant's 10 as its call limit. The exploration then stops with `llm_budget.run_call_limit`. That code is named, and the grant is not revoked, but the stop happens before any of the four guards would.
- **Worse:** the exploration does not hold a call back for the patch. A progressing exploration can therefore use calls 2–10 and leave the patch refused, so the recovery proposes nothing.

**The count needs to be 26:** the diagnosis, the patch and the exploration's 24.

**Obstacle:** the grant's high-token confirmation.

- `issue()` requires `highTokenConfirmation` whenever per-call tokens × calls exceeds 100,000.
- 10 × 10,000 sits exactly at that threshold. 26 would force a confirmation prompt on every default recovery grant.

**Exact change (keeps the confirmation meaning "tokens", not "calls"):**

1. `AS/llm/execution-grants.ts`
   - `export const AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS = 26;`
     - Comment: a diagnosis, a patch, and the exploration's own default ceiling of 24 decisions (`AUTOMATION_STUDIO_EXPLORATION_BUDGET_DEFAULTS.maxProviderCalls`).
     - Keep it as a literal: `llm/` may not import values from `recovery/`.
   - Add `maxTotalTokensPerRun?: number;` to `RequestedExecutionLimits` and to the grant record type.
   - In `preflight`, after `tokenResolution`:
     ```ts
     const callTokenExposure = tokenResolution.limits.maxTotalTokens * maxCalls;
     const maxTotalTokensPerRun = input.maxTotalTokensPerRun ?? Math.min(callTokenExposure, AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD);
     if (!Number.isSafeInteger(maxTotalTokensPerRun) || maxTotalTokensPerRun < tokenResolution.limits.maxTotalTokens || maxTotalTokensPerRun > callTokenExposure) throw new Error("LLM total token limit is invalid.");
     ```
     Then include `maxTotalTokensPerRun` in the returned object.
   - In `issue()`: `const aggregateAuthorizedTokens = safe.maxTotalTokensPerRun;`
   - In `resolve()`: add `maxTotalTokensPerRun: number` to the return type and `maxTotalTokensPerRun: grant.maxTotalTokensPerRun` to the value.
2. `AS/service.ts`: add `maxTotalTokensPerRun?: number;` to `AutomationStudioLlmProviderResolution`.
3. No change on my side. `recovery/annotation/run-budget.ts` already caps the run's token budget at `resolution.maxTotalTokensPerRun` (tested). The run ledger refuses with `llm_budget.run_total_limit` before that exposure is exceeded.
4. Update `execution-grants.test.ts` wherever it expects `maxCalls: 10` or `remainingUses: 10` on a default iterating grant, and wherever it asserts confirmation behaviour for default grants.

**Result:** a default iterating grant has 26 calls, 100,000 tokens and $2.00, with no confirmation prompt. The per-call cost reservation is $2/26 ≈ $0.0769. That is within the grant's $0.25 per-call limit and above a worst-case default DeepSeek call (≈ $0.0062), and all 26 reservations fit the grant total, as the test for 26 calls shows.

**Enforcement note:** the grant does not track tokens, so the 100,000 limit is enforced by the run ledger on reported usage. Enforcing it inside the grant on *reservations* would bring back a 10-call cap (100,000 ÷ 10,000). Doing it on actual usage would need `commitCall` to see the call's reported usage.

**Alternative, if no new field is wanted:** set the default to 26 and accept that default iterating grants require the high-token confirmation, for 260,000 tokens of exposure. That is a product decision.

## Commands run and observed results

- `npx tsc --noEmit` (packages/fluxiq): no output (clean).
  - An earlier run showed 4 errors in the other worker's `llm/tests/execution-grants.test.ts`; they were gone later.
- Failure-evidence test before the fix: `npx vitest run …/annotation/tests/annotate.test.ts` gave `Tests 1 failed | 7 passed`, with `expected [ 'runtime_diagnosis' ] to deeply equal [ 'runtime_diagnosis', …(2) ]`.
  - A first attempt failed for a different reason, because the stub's evidence had no `schemaVersion`. After correcting the stub, it failed for the reason the other worker described.
  - After the fix, `npx vitest run src/programs/automation-studio/runtime/recovery --root packages/fluxiq` gave `Test Files 16 passed`, `Tests 205 passed`. After the purse-split change: `Tests 210 passed (210)`.
- `pnpm check` (Core root), final run: exit 0.
  - `structure-audit: passed (140 warning(s), 254 baselined)`, and all four `tsc --noEmit` runs reported `Done`.
  - None of the warnings are from my files. `recovery/context.ts` was already over the line limit.
  - "1 baseline entries can be lowered" refers to `service.ts` (other worker). I did not run `structure:baseline`.
- `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`:
  - **Final:** `Test Files 101 passed (101)`, `Tests 932 passed (932)`.
  - **Earlier:** 926/926; before that 920/921 (`llm-grants`, fixed as above) and two runs at 919/921.
  - **The 919/921 failures:** the other worker's `iterating-recovery.test.ts` and the unrelated `instruction-readiness.test.ts`, each at ≈15,0xx ms, which is the 15 s test timeout under concurrent load.
  - **Not reproducible:** re-run on their own, both files passed 4/4.

## Not verified

- **No real-provider run.** Nothing here was exercised against DeepSeek. The cost figures are arithmetic from the ledger and DeepSeek's peak price constants, not a measured recovery.
- The failure-evidence fix is proven only with a stub domain. The live web domain was not run.
- No live browser or Lab run.
- I did not run full Core `pnpm test` (other packages), `pnpm build`, or the web-extension repository's checks. A grep of the web-extension repo finds no references to the removed names, apart from the earlier report `w2-exploration-allowance.md`.
- **Whether 120 s is enough.** With the call caps gone, the 120 s recovery deadline (`AS/recovery/recovery-deadline.ts`, not my file) is the guard most likely to fire first once calls take several seconds each.

## Open questions or contradictions found

1. **Grant default:** see the section above. The default of 10 binds, and can starve the patch.
2. **Stale comment in `AS/llm/harness/task-request.ts`** (other worker's file): the doc on `runBudgetAllowance` still describes "two call allowances". Exact replacement:
   ```ts
     /** What kind of call this is, for the run's receipt: an exploration
      * decision says `exploration`, everything else is an ordinary run call. It
      * is a label only -- every call draws on the same backstop, token budget
      * and cost ceiling. */
   ```
3. **`explore_and_adapt` budget:** `annotate.ts`'s `explicitGrantBudget` (and the `executionPurpose` metadata) only match `diagnose_and_adapt` and `diagnosis_only`. An `explore_and_adapt` grant therefore gets the training-settings budget ($0.25 and 144,000 tokens by default) and the `budgetDecision.ok` gate. That matches the other worker's description, but please confirm it is intended, since the grant itself authorizes up to $2.00. I left it unchanged.
4. **Recommended follow-up (not done, it is a design choice):** hold back budget for the patch. When a call count is declared, the exploration's `maxProviderCalls` could be set to `declared calls − calls used − 1`, so a long exploration can never leave the patch without a call. Tokens and money are shared the same way, so a long exploration can also leave the patch short of those. That second risk remains even with 26 calls.
5. **Recovery deadline:** consider raising `AUTOMATION_STUDIO_RECOVERY_MAX_DURATION_MS` (120 s) if live runs show `recovery_deadline_expired` ending explorations that were still making progress.
6. **Unchanged limits:** `maxRefusedActions` (2) and `maxRepeatsPerAction` (2) are safety and exact-repeat guards, not call counts. Exact repeats now report `no_progress`.
