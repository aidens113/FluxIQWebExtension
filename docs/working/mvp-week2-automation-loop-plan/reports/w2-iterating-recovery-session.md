# w2-iterating-recovery-session — worker report

Repository changed: FluxIQ Core, `F:\!FluxIQ`. `AS/` means
`packages/fluxiq/src/programs/automation-studio/`. Nothing committed.

## Outcome

**Done for the brief's scope.** A runtime recovery session can now run an
adaptation that iterates and explores. The mode of a grant no longer sets how
many provider calls it gets. Calls are configuration, with one high backstop,
and gathering evidence is allowed on the recovery path. A service-level test
drives the exact sequence that fails live (diagnose, gather, gather, answer)
through a real failed run, the real grant service, the real DeepSeek request
contract and the host's task-kind policy. It passes for both
`diagnose_and_adapt` and `explore_and_adapt`.

**Two further live blockers exist outside my files.** Both are under "Open
questions". Until they are fixed, a live run from the web panel or the Lab still
will not gather:

1. `AS/runtime/recovery/annotation/exploration.ts:175` forwards captured failure
   evidence into the `evidence_tool_decision` request. The request builder
   refuses that, so every exploration ends in `llm_evidence_loop.invalid_decision`
   before any provider call whenever the domain captures failure evidence. The
   web domain always captures it.
2. Both callers still ask for exactly 2 calls: the web panel and the Lab.

## What changed and why

The design splits "what a grant may ask for" from "how many times". A
purpose now carries a task-kind set and a yes/no `iterates` flag, never a number.

- `AS/runtime/llm/execution-grants.ts` (owned)
  - `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS` rose from 8 to **64**. It is
    one runaway backstop for every purpose.
  - New `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS = 10`. It is the
    single default for every iterating purpose. It fits a diagnosis, an
    exploration and a patch. At the default token limits it totals exactly
    100,000 tokens, so it does not trigger the high-token confirmation, which
    fires only above that. A caller asking for more must confirm the token
    exposure.
  - Removed `defaultMaxCalls(purpose)` (1/2/6/4), `EXPLORE_DEFAULT_MAX_CALLS`
    and the `diagnose_and_adapt permits exactly two` guard.
  - Replaced the per-purpose `switch` with one `GRANT_CAPABILITIES` table.
    - `diagnosis_only` does not iterate. It stays a single call, because one
      diagnosis is all it asks for, and the existing "exactly one" refusal and
      one-use rule are kept.
    - `diagnose_and_adapt` now iterates and may use `evidence_tool_decision`,
      `loop_plan` and `loop_verification`.
    - `explore_and_adapt` and `build_and_adapt` are unchanged apart from the call
      count.
  - New export `automationStudioLlmExecutionGrantTaskKinds(purpose)`.
- `AS/runtime/llm/runtime-session-grant.ts` (new module holding the session-mode
  logic moved out of `service.ts`):
  - `AUTOMATION_STUDIO_RUNTIME_SESSION_GRANT_PURPOSES` =
    `diagnosis_only | diagnose_and_adapt | explore_and_adapt`, with its type
    and `AutomationStudioRuntimeSessionGrant`.
  - `automationStudioRuntimeSessionGrantRefusal`: the incompatible-flags check,
    moved verbatim. The message is unchanged.
  - `automationStudioRuntimeSessionGrantTaskKinds(purpose)`: what the recovery
    entry point may spend a grant on. That is diagnosis, evidence, patch,
    loop_plan and loop_verification, narrowed by the grant. It never includes
    instruction suggestions or change proposals.
  - `automationStudioRuntimeAdaptationContextForGrant`:
    - `diagnose_and_adapt` keeps its exact previous shaping: one
      target-override proposal under manual review.
    - `explore_and_adapt` gets `invokeLlm` and `createAdaptations` and manual
      proposal mode. It gets no `allowModifyActionTargets` exemption and does
      not force `runRecovery: false`, so a known fix without a model call
      still runs first.
- `AS/runtime/llm/index.ts`: one barrel line for the new module. The structure
  audit requires `service.ts` to import through the barrel.
- `AS/runtime/service.ts` (owned; **6468 → 6434 lines**):
  - `llmExecution` and `executionGrant` now use the shared type.
  - The inline refusal block became a call to the new module.
  - `runtimeAdaptationContextForExplicitProposal` moved into the module, and the
    call site now applies to any grant purpose.
- `programs/_shared/runtime.ts` (**not owned; required**): the host's live
  connection between the service and the grant service had its own table. It
  gave `diagnose_and_adapt` only `["runtime_diagnosis","runtime_patch"]` and
  `explore_and_adapt` only `["runtime_diagnosis"]`. Without this change the
  gather call is still refused as a request mismatch in live runs, even with
  the grant table fixed. I verified this: the service test fails when run with
  the old table (see below). It now calls
  `automationStudioRuntimeSessionGrantTaskKinds`. `build_and_adapt` keeps its
  literal narrow list.
- `AS/api/handlers/runtime-execution.ts` (**not owned; required**): its `runIntent`
  mapping accepted only the two old intents. Without this change no API caller
  can start a runtime session under `explore_and_adapt`, which is the brief's
  task 1. It now reads the shared purpose list.
- Tests:
  - `AS/runtime/llm/tests/execution-grants.test.ts`:
    - Rewrote the two tests that asserted the removed 2- and 6-call counts.
    - Moved the call-limit checks from 9 to the backstop + 1.
    - Added a scripted reply queue to the fixture and `gatherRequest` and
      `patchRequest` helpers.
    - New tests: call count comes from configuration for every iterating
      purpose, up to the backstop; high-token confirmation above the default;
      **diagnose → gather (tool call) → gather (complete) → patch** through
      one grant for both purposes with 4 reveals; and the recovery task-kind
      scoping.
  - `AS/runtime/tests/service-adaptation/tests/iterating-recovery.test.ts`
    (new): the end-to-end service proof, with the task-kind order, the tool
    call, the exploration stage completed and outcome `evidence_gathered`,
    `costAccounting {calls: 4, explorationCalls: 2}`, the patch recorded with
    no auto-apply, 4 reveals and the grant released. It also covers refusal of
    an unsupported purpose and of incompatible flags. It has a 60 s timeout
    because the suite's 15 s timeout was hit under full-suite load.
  - `AS/api/handlers/tests/llm-execution-settings.test.ts` (**not owned;
    required**): Flow settings validate `maxCalls` against the backstop, so its
    assertion that `maxCalls: 9` is refused broke as a direct consequence. It
    now accepts 9 and the backstop, and refuses backstop + 1.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`
  (the definition of done), final run: **Test Files 100 passed (100), Tests 921
  passed (921)**.
  - An earlier full run had one failure: the bootstrap test "bridges a
    generated proposal ID…", a 15058 ms timeout under load. Rerun alone
    (`…/runtime/tests/service-bootstrap`) it gave 45/45, that test in 6466 ms.
    That earlier failure rests on one observation under load.
  - Earlier runs, taken while the other worker was mid-edit, also showed
    failures in `recovery/annotation/tests/run-budget-allowance.test.ts` and
    in `llm-grants.test.ts` "shares one atomic call budget". Both came from
    their `annotate.ts` change, since that test uses no grant. Neither appears
    in the final run.
- `pnpm check` (Core): **exit 0**, `structure-audit: passed (140 warning(s), 254
  baselined)`.
  - The first attempt failed on `[imports]`, because `service.ts` imported
    `./llm/runtime-session-grant.ts` directly. Fixed by importing through the
    barrel.
  - The second attempt failed on TS18046 (`unknown`) in my grant test. Fixed.
  - The audit also prints "1 baseline entries can be lowered"; I did not run
    `pnpm structure:baseline` (see "Not verified").
- `npx vitest run src/programs/automation-studio/api src/programs/_shared --root
  packages/fluxiq`: **26 files, 168 tests passed.**
- `npx vitest run …/llm/tests/execution-grants.test.ts`: 23 passed.
- `npx vitest run …/iterating-recovery.test.ts`: 3 passed. The recovery tests
  took about 5–6 s each alone.
- Negative control: I ran a throwaway copy of the service test with the old host
  policy `["runtime_diagnosis","runtime_patch"]`. The `diagnose_and_adapt` case
  **failed**, as expected, and the copy was deleted.
- `wc -l AS/runtime/service.ts` → 6434.

## Not verified

- **No live DeepSeek run.** The proof uses a scripted endpoint behind the real
  provider contract. Per the standing rule a live run needs the user's explicit
  go-ahead, and it would still fail on blocker 1 below.
- A domain that *captures failure evidence*, which is the real web domain, was
  deliberately left out of the passing test because of blocker 1. The gather
  path with captured evidence is proven broken, not fixed.
- The web panel and the Lab were not changed or exercised.
- `pnpm structure:baseline` was not run: the baseline file is shared, and the
  other worker is editing concurrently.
- Core `pnpm test` / `pnpm build` across all packages were not run; only the
  runtime, API and shared suites were.
- `AS/api/contracts/llm.ts:22` `AutomationStudioLlmExecutionPurpose` still
  omits `explore_and_adapt`. This is type-only, since the grant service already
  accepted it, and the file is not mine.

## Open questions or contradictions found

1. **Live blocker, other worker's file**
   (`AS/runtime/recovery/annotation/exploration.ts`). The gather step fails
   whenever failure evidence was captured. The trace is
   `explorationDecision → runAutomationStudioLlmHarness →
   packAutomationStudioLlmContext → sanitizeAutomationStudioLlmFailureEvidence`,
   which throws "Failure evidence is available only to runtime diagnosis and
   patch tasks." The evidence loop swallows the error, so the exploration ends
   `failed` / `llm_evidence_loop.invalid_decision` with no provider call. I
   reproduced this in the service test with a domain that captures evidence.
   **Exact change:** in `explorationDecision`, delete line 175:
   `...(input.failureEvidence ? { failureEvidence: input.failureEvidence } : {}),`
   The DeepSeek provider's `validRuntimePromptProjection` also rejects failure
   evidence on non-diagnosis/patch tasks, so widening the sanitizer instead
   would need three coordinated changes plus a privacy review. After the fix,
   add a captured-evidence case to `iterating-recovery.test.ts`: give the
   fixture's `llmEvidenceRuntime` a `captureSanitizedFailureEvidence` and a
   `validateTargetOverrideEvidence`, then assert the same four-call order.
2. **Callers still pin two calls.** The grant no longer forces it, but the
   callers ask for it:
   - Core web panel: `apps/web/src/features/automation-studio/runtime/run-input-model.ts:115`
     (`maxCalls: purpose === "diagnose_and_adapt" ? 2 : 1`) and `FlowRunView.tsx:153`
     (`maxUses … ? 2 : 1`). Its description text at `:234` still says "Diagnose
     once, generate one bounded runtime patch".
   - Lab, in this repository:
     `packages/test-runner/src/live-llm/live-llm-plan.ts:12`
     (`PURPOSE_CALLS = { diagnosis_only: 1, diagnose_and_adapt: 2 }`).
   - Recommended change: drop `maxCalls`/`maxUses` for adapting purposes and
     take the default, or send the configured default. Otherwise live runs
     stay at two calls.
3. The other worker's `annotate.ts` removed the per-mode `explicitCallLimit` and
   takes `providerResolution.maxCallsPerRun`, which is the grant's `maxCalls`. That
   matches this change, so no `annotate.ts` edit is needed from my side.
   `explicitGrantBudget` there is still `diagnose_and_adapt || diagnosis_only`.
   An `explore_and_adapt` run therefore sizes tokens from the project's
   settings rather than the grant's, and requires the training budget decision
   to be ok. That is arguably correct for an exploring run, and it passed in
   the test. If grant-sized budgets are wanted, the change is
   `const explicitGrantBudget = Boolean(input.executionGrant);`.
4. `patches.ts` `explicitProposalGrant` is still `purpose === "diagnose_and_adapt"`.
   `explore_and_adapt` is therefore not narrowed to one target override, which
   is intended, and it runs under `manual_approval` because `runRuntimeSession`
   forces that mode for any grant. The test asserts no auto-apply.
