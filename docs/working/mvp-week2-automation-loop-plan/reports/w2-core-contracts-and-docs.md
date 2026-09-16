# Report: w2-core-contracts-and-docs

Repository changed: FluxIQ Core, `F:\!FluxIQ`. `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Nothing was committed or pushed. No runtime code, handler, `apps/**` file, `.structure-baseline.json` or `docs/working/**` file was edited. In this repository, only this report file was written.

## Outcome

**Done.** Both parts of the brief are complete.

- **Contract.** `AS/api/contracts/llm.ts` now matches what the handlers accept and return. That covers `explore_and_adapt`, `maxTotalTokensPerRun`, the runtime-session intent, and the preflight and grant response records.
- **Contract test.** A new test pins the contract to the grant service, so any drift between them fails `pnpm check`.
- **Documentation.** Core's architecture docs describe the new model: iterating adaptations, the four guards, the patch hold-back, the worst-case cost, and the grant lifetime (claim window, run lease, one-for-one exchange, and what ends a claimed grant early).

Required checks:

- Core `pnpm check`: exit 0.
- API contract tests: 4/4. The whole API suite: 55/55.
- `node scripts/structure-audit.mjs`: passed, including `--rule docs-links`.

The most important finding is open question 1: an `explore_and_adapt` grant now makes **live patch testing** reachable in the shipped app, through the API. The docs now say so; please confirm that is intended.

## What changed and why

### 1. The contract (`AS/api/contracts/llm.ts`)

- **`AutomationStudioLlmExecutionPurpose`** now includes `explore_and_adapt`. Its doc comment says a purpose names what may be asked for, not how many times.
- **New `AutomationStudioRuntimeSessionLlmIntent`**, defined as `Exclude<…Purpose, "build_and_adapt">`. It is what `run-runtime-session` accepts as `runIntent`, and it matches `AUTOMATION_STUDIO_RUNTIME_SESSION_GRANT_PURPOSES`.
- **`AutomationStudioLlmExecutionLimitRequest`** gains `maxTotalTokensPerRun?: number`. Doc comments now give:
  - the defaults and bounds for `maxCalls`: 1–64, default 26 when iterating, `diagnosis_only` = 1;
  - the default and valid range for `maxTotalTokensPerRun`;
  - the per-call token defaults.
- **`AutomationStudioLlmExecutionGrantRequest`** gains doc comments only:
  - `highTokenConfirmation` is judged on the run budget or the per-call total, never on the call count;
  - `ttlMs` is the claim window (1,000–300,000 ms, default 60,000), and a claimed grant runs under the 600 s lease;
  - `maxUses` must equal the call limit.
- **New response types**, which did not exist before:
  - `AutomationStudioLlmExecutionPreflight` and `…PreflightResponse` (`{ preflight }`);
  - `AutomationStudioLlmExecutionGrant` and `…GrantResponse` (`{ grant }`).

  `expiresAtMs` is documented as the end of the claim window, not the grant's lifetime.
- **No handler or web edit was needed.** The handlers already read these fields through `Partial<…Request> & Record<string, unknown>`. Their `as Parameters<…>[0]` casts still compile; they could now be dropped, but those files are not mine.

### 2. The contract test (`AS/api/contracts/tests/llm.test.ts`, new)

**Type-level pins, which `tsc` in `pnpm check` enforces.** Each compares the contract with the grant service:

- The purpose union equals `AutomationStudioLlmExecutionGrantPurpose`.
- The runtime intent equals `AutomationStudioRuntimeSessionGrantPurpose`.
- The limit request has the same keys and shape as the service's limits.
- Every field `preflight()` accepts is in the preflight request.
- Every field `issue()` accepts, apart from the actor fields, is in the grant request.
- The grant record has the same shape as `AutomationStudioLlmExecutionGrantMetadata`.
- The preflight record has the same shape as `preflight()`'s return type.

**Runtime tests:**

- The runtime-session purposes are exactly the three, and exclude `build_and_adapt`.
- A contract-typed `explore_and_adapt` request with `maxTotalTokensPerRun: 40_000` gets that budget back from the **real** grant service's `preflight`, with 26 calls.
- The defaults the contract comments promise hold: 26 calls, a 64-call maximum, a 100,000 threshold, 8,000/2,000/10,000 per call, and a 100,000 default budget. `diagnosis_only` is refused 2 calls, 65 calls are refused, and a budget below one call's limit is refused.

**Stubs.** The test builds its own minimal stubs: a key summary and an execution binding. It does not import another directory's test fixture. It imports the contract through the `contracts/index.ts` barrel, so the audit's barrel rule adds no finding.

### 3. Documentation statements changed

**`docs/architecture/automation-studio.md`**

1. **Runtime lanes.** Was: "two closed lanes … `diagnose_and_adapt` makes exactly one diagnosis and one runtime-patch request". Now there are three lanes:
   - `diagnose_and_adapt` gathers evidence and ends in at most one target-override proposal;
   - `explore_and_adapt` gathers evidence and live-tests its patches within the Flow's policy;
   - neither has a fixed call count (with a link to the new section).
2. **Target-override exemption.** Was: "Because the explicit grant is schema-bound…". It now names `diagnose_and_adapt`, and says `explore_and_adapt` gets no target-override exemption.
3. **Flow settings call range.** Was: "Persisted Flow settings allow one through eight LLM calls … runtime intents can impose narrower exact limits. Evidence-guided generation uses the upper bound". Now:
   - settings allow 1–64 calls;
   - a call count is configuration, and only `diagnosis_only` is fixed at one;
   - bootstrap makes at most one decision per authorized call.
4. **Run ledger.** Was: "ledger is shared across diagnosis and patch calls so the call, total-token, and output-token budgets are reserved". Now it is shared by every call (diagnosis, evidence decisions, patch), covering tokens, output, cost and a 250-call backstop.
5. **What the grant binds.** Was: "effective token/call/cost/timeout limits, purpose, and expiry". Now: per-call token limits, run token budget, call/cost/timeout limits, purpose, and claim window.
6. **Reveal authorizations.** Was: "Secret Keys creates a separate … reveal authorization …; the LLM grant retains only that opaque ID … recheck active state and expiry". Now:
   - there is one authorization per authorized call, and the grant keeps their IDs;
   - "expiry" means the claim window, or the run lease once claimed;
   - a link points to the new grant-lifetime section.
7. **Settings API call check.** Was: "persists … one-call limit … rejects … calls other than one". Now: "a call limit", and it rejects call limits outside 1–64. Verified in `AS/api/handlers/llm-execution-settings.ts:21`.
8. **Runtime Debug grants.** Was: "issues the scoped one- or two-call grant". Now:
   - one call for diagnosis;
   - Core's default for the adapting mode, whose request names no count;
   - Runtime Debug does not offer `explore_and_adapt`, which is reachable through the API.
9. **High-token confirmation.** Was: "A future profile above 100,000 total tokens additionally requires … confirmation". Now the confirmation is judged on the run token budget or the per-call total, never on the call count.
10. **Fresh sessions.** Was: "Both explicit runtime lanes must create a fresh runtime session". Now: "Every explicit runtime lane…".
11. **Task kinds.** Was: the `build_and_adapt` match list, and "`diagnose_and_adapt` resolves `runtime_diagnosis` and `runtime_patch`". Now:
    - per-purpose grant task-kind lists, taken from `GRANT_CAPABILITIES`;
    - the resolver narrowing, where both adapting purposes resolve diagnosis, evidence decision, patch, loop plan and loop verification;
    - a failed run never reaches instruction suggestions or change proposals.
12. **Accepted purposes.** Was: "`runRuntimeSession` accepts only `diagnosis_only` and `diagnose_and_adapt`". It now adds `explore_and_adapt`.
13. **Grant call limits.** Was: "A grant allows at most eight explicitly configured calls … a finite aggregate estimated-cost ceiling". Now:
    - 26 calls by default when iterating, 64 at most, 1 for `diagnosis_only`;
    - an aggregate cost of at most USD 2;
    - the run token budget: its default, the refusal on a call's worst case, and the charge on reported usage (the worst case if a report is missing or inconsistent).
14. **Commit boundary.** Was: "Core revalidates expiry, …" and "Expiry, explicit cancellation, …". Now: "the grant's lifetime" and "The end of the run lease, …".
15. **Recovery budgets (clarification only).** After "adaptation/LLM attempts per run", it now says that an LLM attempt is one recovery, not one provider call, with a link.
16. **"What the shipped app reaches":**
    - *Runtime diagnosis:* adds `explore_and_adapt`.
    - *Evidence gathering during a recovery:* new bullet. The adapting grants reach it, and the captured failure evidence never goes to these calls; verified at `AS/runtime/recovery/annotation/exploration.ts:174`.
    - *Runtime patch requests:* was "a `diagnose_and_adapt` grant only". Now both adapting grants, and `explore_and_adapt` sends each patch to live testing.
    - *Live patch testing:* was "no grant purpose". Now it is `explore_and_adapt`, API only, bounded by the Flow policy's flags. External side-effecting patches are refused where the policy disallows them or requires approval, because explicit runs never carry that approval.
    - *Automatic promotion:* was "only a `diagnose_and_adapt` proposal … high-risk". Now any adapting grant. Every explicit run is forced into manual proposal mode, and the gate sends manual-mode adaptations to review. Verified at `AS/runtime/service.ts:2912` and `training-modes.ts:313`.
    - *Training modes:* adds `explore_and_adapt`. "stops neither explicit lane" became "stops none", and each lane spends its grant's budget. Verified at `annotate.ts:89-91`.
17. **New subsection "Iterating adaptations and their bounds":**
    - the four guards with their codes (cost, tokens, a recovery deadline of 600 s that is also the maximum, and no progress after 3 barren steps);
    - backstops: 250 calls, or the grant's count; exploration at 24/24 by default and 64 at most;
    - the patch hold-back;
    - Flow Bootstrap loop limits, and its unnamed failure on budget exhaustion;
    - the worst-case table and the real-money figures, as the grant-budget report gives them.
18. **New subsection "LLM execution grant lifetime":**
    - what the claim window bounds;
    - what the run lease bounds;
    - the one-for-one exchange and what it guarantees;
    - the full list of what ends a claimed grant early.

    I verified every item against `execution-grants.ts:376-609` and `secret-keys/runtime/service.ts:273-296`. I removed "overlaps another call" from the early-end list, because `claimCall` runs **before** `runTask`'s `try`: a concurrent call is refused **without** revoking the grant.

**`docs/architecture/automation-studio/llm-flow-bootstrap.md`**

19. **Confirmation rule.** Was: "requests above 100,000 total tokens additionally require … confirmation flag (while the current absolute token ceiling remains lower)". Now the run budget or the per-call total above 100,000 requires it, and in practice only a run budget can.
20. **Loop bound.** "bounded series of `evidence_tool_decision` tasks" now states the bound: one decision per authorized call and at most 64, tool calls at most decisions + 1, total cost divided by calls per decision, and grant totals enforced on every call.
21. **Aggregate exposure.** Was: "Aggregate grant exposure is `maxTotalTokens * maxCalls`; … confirmation … when that amount is greater than 100,000". Now:
    - it is the run token budget: by default that product held to 100,000, and never less than one call's limit;
    - each call is charged its reported usage;
    - the confirmation rule is restated.
22. **Website exploration budget.** "Its 48,000-token aggregate exposure" became "Its run token budget, 48,000 tokens by default". Arithmetic: max(12,000, min(4 × 12,000, 100,000)).
23. **Confirmation dialog.** Was: "Only a preflight whose total-token limit exceeds 100,000 opens an additional confirmation dialog; … enforced again by Core". It now states both rules precisely:
    - the client's rule: per-call total × call limit;
    - Core's rule: the run budget or the per-call total.

    They differ; see open question 3.

**`docs/architecture/automation-studio/persistence.md`**

24. **Stored authorization IDs.** Was: "The LLM grant stores only the opaque Secret Keys authorization ID". Now it stores one ID per authorized call, and exchanges one for a fresh ID when a claimed run outlives it (with a link).
25. **Settings validation.** Was: "validates the immutable 50,000-token hard ceiling and current diagnosis-only one-call/zero-retry policy". Now it validates a call limit of 1 to 64 and the zero-retry policy.

### 4. Statements found and judged still true (left unchanged)

**`automation-studio.md`**

- The per-request token defaults (8,000/2,000/10,000), and the 50,000 absolute per-request ceiling.
- The settings rejections: totals above 50,000, input + output above the total, retries other than zero, timeouts above 25 s, and cost caps above USD 0.25 (`llm-execution-settings.ts`).
- Explicit grants attach only to run-runtime-session. A supplied `runId` is refused and the grant revoked (`runtime-session-grant.ts` refusal, `service.ts:3088-3095`).
- An explicit run's cross-domain authorization is an empty set (`service.ts:3147`).
- The `diagnose_and_adapt` target-override validation paragraph. That path is still `explicitProposalGrant` (`annotate.ts:321`).
- The build-grant paragraph, the recovery-ladder paragraph, and the evidence-loop coordinator paragraph ("caps iterations, tool calls, and accumulated evidence bytes … runs through the existing grant and per-run budget boundaries").
- The training-mode "Budgets cap interventions, tokens, and cost".
- "A run without a grant gets no provider … `llm.provider_missing`".
- "A run with an explicit grant skips the retry at both of its call sites" (`service.ts:3252`, `3306`).

**`llm-flow-bootstrap.md`**

- "invokes the harness exactly once with … flow_bootstrap". This is the ordinary, non-evidence-guided path.
- The grant is closed after the command, and session-derived buffers are copied into one-use authorizations.
- "ordinary one-call Bootstrap".
- The 8,000-byte context window and 64,000-byte cumulative ceiling (`flow-bootstrap-evidence-loop.ts`).
- The duplicate-request and repeat-without-progress diagnostics.
- "Build Flow from instructions" with its exact saved build limits, including one call (`BLANK_FLOW_AUTHORING_LIMITS`).
- The website-exploration client limits: 8,000/4,000/12,000, four calls, 45 s, USD 1 (`WEBSITE_EXPLORATION_LIMITS`).

**`persistence.md`**

- Secret Keys zeroing and re-seal behaviour.

**`package-boundaries.md`**

- The 0.4.0 migration note's "Unchanged … explicit `diagnose_and_adapt` runs" is a historical release note, so I left it.

**`client-gateway.md`**

- `AUTOMATION_STUDIO_CONTEXT_LEASE_MS` is an unrelated lease.

## Commands run and observed results

- **Type check.** `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no output.
- **Contract tests.** `npx vitest run src/programs/automation-studio/api/contracts`: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.
- **Negative controls.**
  - Method: `llm.ts` was backed up to my scratchpad, mutated, type-checked, then restored. `cmp` confirmed each restore.
  - **A.** `maxTotalTokensPerRun` removed from the request: `tsc exit=2`. TS2322 at test lines 48, 49 and 50 (limits, preflight fields, issue fields), plus TS2353 on the request literal.
  - **B.** `explore_and_adapt` removed from the purpose: `tsc exit=2`. TS2322 at lines 46, 47, 51 and 52, and on the runtime-purposes assignment and the request literal.
  - **C.** `maxTotalTokensPerRun` removed from the preflight record: `tsc exit=2`. TS2322 at lines 51 and 52.
- **docs-links rule.** `node scripts/structure-audit.mjs --rule docs-links`: `structure-audit: passed (0 warning(s), 0 baselined)`, exit 0.
- **docs-links negative control.** Breaking the new `persistence.md` anchor gave `FAIL [docs-links] …persistence.md:125: the link to ../automation-studio.md#llm-execution-grant-lifetime-broken is broken`, exit 1. The file was restored and `cmp` confirmed it.
- **Full audit.** `node scripts/structure-audit.mjs`: `structure-audit: passed (140 warning(s), 254 baselined)`, exit 0. That is the same count as before this task.
- **Core `pnpm check`:** exit 0.
  - Structure-audit node tests: `# tests 96`, `# pass 96`, `# fail 0`.
  - `structure-audit: passed (140 warning(s), 254 baselined)`.
  - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` all reported `check: Done`.
- **API suite.** `npx vitest run src/programs/automation-studio/api` in `packages/fluxiq`: `Test Files 14 passed (14)`, `Tests 55 passed (55)`.
- **Reference freshness.** `node scripts/docs-reference.mjs --check`: `Error: docs/reference/framework-reference.md is stale`, exit 1.
  - It was **already failing before my first edit** (same message, run at the start of this task).
  - It is not part of `pnpm check`. It is part of `pnpm docs:check`.
- **Biome.** `npx biome check <my two files>`: "No files were processed … paths were provided but ignored" (Biome's config ignores them). Not applicable.
- **Blocked command.** One `git tag --list` was blocked by the worker hook. No history-changing command was run.

## Not verified

- **No live runs.** Nothing ran against DeepSeek, a browser, the Lab or the web panel.
- **Wider suites not run.** I did not run Core `pnpm test`, `pnpm build`, or the runtime suite. I changed no runtime code; my test only imports the runtime.
- **Behaviour descriptions come from reading.** They rest on the code and the three reports, not on new tests. That covers the lease, the exchange, the early-revocation list, live-patch reachability under `explore_and_adapt`, and promotion under manual mode. The grant-budget report's lifetime tests cover most of the grant lifetime; I did not rerun them.
- **Live-patch reachability has no test from me.** That `explore_and_adapt` patches reach `executeAutomationStudioRuntimePatch` is read from `patches.ts:98-101`; no test I ran exercises it.
- **The Runtime Debug sentence depends on uncommitted web code.** "Core's default call count for the adapting mode, whose request names none" describes the **uncommitted** working-tree change in `apps/web/.../runtime/run-input-model.ts` and `FlowRunView.tsx`. If that change is not kept, the sentence is wrong.
- **The website-exploration numbers may change.** They read `WEBSITE_EXPLORATION_LIMITS` as it is now, and another worker is editing `apps/web/.../authoring/` concurrently.
- **Release status of the removed names.** I could not check whether those names are in a released 0.5.0: the hook blocks even listing git tags.

## Open questions or contradictions found

1. **An `explore_and_adapt` grant makes live patch testing reachable in the shipped app (security/product; please confirm).**
   - *How.* `patches.ts:98` makes a patch proposal-only only when `explicitProposalGrant`, which `annotate.ts:321` sets only for `diagnose_and_adapt`. Under `explore_and_adapt`, each runtime patch goes to `executeAutomationStudioRuntimePatch`.
   - *What runs.* The patched clone runs with the run's own graph options (real IO and host runtime) for at most 50 steps.
   - *Bounds.* It runs only when the Flow policy has `allowRuntimeRecovery` and allows that patch kind. An external side-effecting patch is refused when the policy disallows side effects **or** requires approval, because explicit runs force `authorizedExternalSideEffects: false` (`service.ts:3094`).
   - *Gap.* A Flow whose policy allows external side effects **without** requiring approval would live-run a side-effecting, model-proposed patch.
   - *Before.* The docs said no grant purpose reached live patch testing.
   - *Reach.* It is API-only today, because Runtime Debug offers only the two older modes. I documented it as current behaviour.
2. **A misleading comment in `AS/runtime/llm/runtime-session-grant.ts:118-120` (not my file).**
   - *The claim.* "`runRecovery` stays as configured: a known deterministic recovery … must still run before the model is asked."
   - *What happens.* `runRuntimeSession` forces `adaptiveMode: "manual_approval"` for every explicit run (`service.ts:3094`). `runtimeAdaptationContextWithRunOverride` then sets `runRecovery = false` before the grant shaping (`service.ts:3157-3158`), so it is always false for `explore_and_adapt`.
   - *Why nothing breaks.* `behavior.runRecovery` is read only by `runtimeAdaptationContextSummary`; it gates nothing. Deterministic-first ordering is enforced by `decideAutomationStudioRuntimeLlmInvocation` in `annotate.ts`.
   - *Suggested fix.* Correct the comment to say that. The doc now says `explore_and_adapt` "turns recovery off", matching the recorded behaviour.
3. **The web high-token warning disagrees with Core (in `apps/web`, not my file).**
   - *The mismatch.* `llmRequestRequiresHighTokenWarning` (`apps/web/src/features/automation-studio/authoring/blank-flow-authoring-model.ts:28-38`) tests `maxTotalTokens * maxCalls > 100_000`. Runtime Debug uses it (`FlowRunView.tsx:152`).
   - *The effect.* The adapting mode now takes Core's default of 26 calls, and 26 × 10,000 = 260,000. So every default "Diagnose and propose adaptation" run would open the confirmation dialog and send `highTokenConfirmation: true`, although Core does not require it (default budget 100,000). This is inferred from code, not seen in a browser.
   - *Exact change:*
     ```ts
     const runBudget = typeof preflight.maxTotalTokensPerRun === "number" && Number.isFinite(preflight.maxTotalTokensPerRun)
       ? preflight.maxTotalTokensPerRun
       : (typeof maxTotalTokens === "number" ? maxTotalTokens * maxCalls : 0);
     return typeof maxTotalTokens === "number" && Math.max(runBudget, maxTotalTokens) > LLM_HIGH_TOKEN_WARNING_THRESHOLD;
     ```
   - *Doc follow-up.* Then update the `llm-flow-bootstrap.md` sentence "An additional confirmation dialog opens only when the preflight's per-call total-token limit times its call limit exceeds 100,000" to name the run budget.
4. **Release policy (`package-boundaries.md`: intentional breaks and changed published numbers take a minor version and a migration note).**
   - *The package.* `fluxiq` is `0.5.0`.
   - *Public breaks in today's uncommitted Core work.* At HEAD, `run-budget.ts` is re-exported by `runtime/llm/index.ts`, and the committed reference lists its types as public. The breaks:
     - `AutomationStudioLlmRunBudgetLimits.maxExplorationCallsPerRun` and `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_EXPLORATION_CALLS_PER_RUN` were removed;
     - the `llm_budget.run_exploration_call_limit` code was removed;
     - `AutomationStudioLlmRunBudgetLease` gained a required `release()`;
     - `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS` went from 8 to 64.
   - *Behaviour changes.* The default grant call count, the meaning of the public `expiresAtMs`, repeat stops moving from `budget_exhausted` to `no_progress`, and the recovery deadline going from 120 s to 600 s.
   - *What I did not do.* I did not write a 0.6.0 migration note: the version bump is outside my files, and a note naming a version the package does not have would be false.
   - *Recommendation.* Bump `fluxiq` to 0.6.0 and add a migration note listing the items above.
5. **The framework reference is stale, and CI's `pnpm docs:check` will fail until `pnpm docs:reference` is run.**
   - *Scope.* It regenerates `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`, both outside my paths.
   - *Cause.* It was already stale at HEAD and more so after today's runtime work. My contract adds five public types and shifts `llm.ts` line numbers.
6. **The no-grant worst-case figure is conditional.** "USD 0.06 to 0.19 by tokens alone" is the report's figure, and I copied it as instructed. The 0.19 end assumes all 144,000 tokens could be output. That holds only when the resolver states no per-call output limit. At default per-call limits, `run-budget.ts` caps output at 2,000 × 24 = 48,000, which gives about USD 0.11.
7. **The recovery deadline is fixed.** `annotate.ts` calls `startAutomationStudioRecoveryDeadline` without `maxDurationMs`, so no host or setting can change the 600 s today. The doc says "600 seconds, which is also the most any recovery clock may be" and makes no configurability claim.
8. **Handler casts are no longer needed.** Now that the contract carries `maxTotalTokensPerRun`, the `as Parameters<…>[0]` casts in `llm-generation.ts` (lines 37 and 55) could be removed. That is an optional tidy-up in a file I do not own.
