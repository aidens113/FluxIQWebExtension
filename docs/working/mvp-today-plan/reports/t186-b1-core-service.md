# t186-B1 — Core service code without call grants

Worker report. Core tree `C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQ`, branch
`task/t186-remove-call-grants`. Nothing committed. Paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done for the owned files. `tsc` is clean in every non-test file of the package,
and in every test file I own. 135 errors remain, all in test files outside my
ownership (listed below).

## What changed and why

### Final service input shapes

```ts
// service.bindLlmExecutionProvider
bindLlmExecutionProvider(resolver: (input: AutomationStudioLlmProviderResolverInput) => ...): this

// generateFlowBootstrapAdaptation(input: AutomationStudioGenerateFlowBootstrapAdaptationInput)
{
  projectId: string;
  flowId: string;
  caller: AutomationStudioLlmModelCaller;                  // { actorUserId, actorSessionId }; required
  permittedConsequences?: AutomationStudioActionConsequence[];
  evidenceGuided?: true;
  useReusableContext?: true;
  mode?: "create" | "extend";
  startLocation?: string;
  permissionAskTimeoutMs?: number;
}
// REQUEST_FIELDS = projectId, flowId, caller, permittedConsequences, evidenceGuided,
//   useReusableContext, startLocation, permissionAskTimeoutMs, mode
// caller fields = actorUserId, actorSessionId (exact). A missing or malformed caller,
// or any leftover field such as executionGrant, is flow_bootstrap.invalid_input.

// runRuntimeSession input (the changed fields only)
{
  llmExecution?: AutomationStudioRuntimeSessionLlm;          // caller + intent
  permittedConsequences?: AutomationStudioActionConsequence[]; // parsed with parseAutomationStudioPermittedConsequences
  idempotencyKey?: string;                                   // now accepted together with llmExecution
}

// AutomationStudioRuntimeRecoveryAnnotationInput (recovery/annotation/annotate.ts)
{ llmExecution?: AutomationStudioRuntimeSessionLlm; permittedConsequences?: readonly AutomationStudioActionConsequence[]; ... }
```

### `service.ts`

- Options `revokeLlmExecutionGrant`, `continueLlmExecutionGrantAfterAppliedFlowAdaptation`
  and `closeLlmExecutionGrants` are removed, along with their fields, the
  constructor wiring, the `close()` call and every revoke call.
  `bindLlmExecutionProvider(resolver)` now takes only the resolver.
- `FLOW_BOOTSTRAP_GRANT_REFUSAL_CODES` and the grant-refusal branch of the
  generation `catch` are gone, along with the `finally` that revoked. The
  `AutomationStudioBuildAndAdaptExecutionGrant` re-export is gone.
- Generation:
  - The internal method is now `(input, repairBrief?)`, with no
    `retainRunOwnedGrant`.
  - The grant digest and settings-revision comparison
    (`flow_bootstrap.stale_grant_binding`) is removed. The binding is still read
    for the proposal's base digest and for the post-generation stale check.
  - The resolver is called with `{ projectId, flowId, caller, modelId? }`.
    `modelId` is the Flow's `llmModel`, read through `mergedFlowSettingsMetadata(parent.metadata)`.
  - Audit `actorId` comes from `caller.actorUserId`, in the reusable context and
    in `createFlowBootstrapAdaptation`.
  - The consequence gate reads `permittedConsequences` from the request.
- `runRuntimeSession`:
  - The idempotency-key refusal for explicit LLM runs is removed, and so is the
    `refused` revoke hook.
  - `automationStudioRuntimeAdaptationContextForLlmRun(context, llmExecution.intent)`
    is used.
  - The result check prefers `resolveCallerProvider`, which calls the resolver
    with `caller`.
  - Both recovery annotations and the repair port's ladder receive
    `llmExecution` and `permittedConsequences`.
- The refuted-result repair is now wired with `caller`, `permittedConsequences`,
  `generate: (request, brief) => generateFlowBootstrapAdaptationInternal(request, brief)`,
  `approve` and `apply: reviewFlowBootstrapAdaptation({ ...review, action: "apply" })`.
  `reviewFlowBootstrapAdaptation` already takes the adaptation lock, and
  `applyFlowBootstrapAdaptation` already refuses a stale base digest, so dropping
  the continuation's own digest check loses nothing.
- The file is 4477 lines, down from 4547.

### `service/flow-bootstrap-commands/`

- `generation-request.ts` was rewritten. It holds no purposes, no grant fields,
  no digest or revision reading, and no `runOwnedRepair` option.
  `AutomationStudioFlowBootstrapGenerationGrant` is deleted.
- `contracts.ts`: the input has `caller` and `permittedConsequences?` in place
  of `executionGrant`. The `permissionRequest` doc no longer says "issue the
  next build's grant".
- `permission-hold.ts`: comment wording only.
- `tests/generation-request.test.ts` was rewritten for the caller shape.

### `service/runtime-adaptation/`

- `reauthor-continuation.ts` and its test are deleted, and the barrel entry is
  removed.
- `refuted-result-port.ts`:
  - The dependencies are `caller?` and `permittedConsequences?` in place of
    `executionGrant`. `binding` is gone, and `applyAndContinue` is replaced by
    `apply({ projectId, flowId, adaptationId, actorId })`.
  - A run with no caller fails the build as
    `flow_bootstrap.provider_resolution_failed` at stage `provider_resolution`,
    then degrades to the patch ladder as before.
  - After an applied re-author, the run detail is returned as is. There is no
    `replayReady` or `grant_continuation` marker, and `reauthor.ts` reads an
    absent `replayReady` as ready.
- `result-check.ts`: `resolveGrantedProvider` is renamed to
  `resolveCallerProvider`.
- `repair-authority.ts`: comment wording only.
- Tests: `refuted-result-port.test.ts` was rewritten for caller and apply, and
  `result-check.test.ts` and `repair-authority.test.ts` were updated.

### `service/runtime-session/requested-run-id.ts`

- The `refused` port is removed, since it only existed to revoke a grant. Its
  test is updated.

### Recovery annotation (`recovery/annotation/`)

- `annotate.ts`:
  - The input takes `llmExecution` and `permittedConsequences` in place of
    `executionGrant`.
  - The resolver is called with `caller`.
  - The consequence gate reads `input.permittedConsequences`, not the
    resolution's.
  - The `diagnose_and_adapt`, `diagnosis_only` and `explore_and_adapt` checks
    read `.intent`.
  - Provider-resolution failure no longer carries a grant `cause`.
  - Local renames: `explicitRunBudget`, `explicitProposalRun`, `intentSkip`.
  - The stored code `llm.runtime_patch_grant_scope_refused` keeps its spelling
    on purpose, because the Lab's test-runner matches it (see Open questions).
    The patch-skipped sentence now reads "A diagnose_and_adapt run asks for only
    a target override ...".
- `run-budget.ts`: the input field is renamed to `explicitRunBudget`.
- `patches.ts`: the input field is renamed to `explicitProposalRun`.
- `permissions.ts`, `ports.ts` and `exploration.ts`: comment wording only.
- Tests updated: `annotate-harness.ts`, `annotate.test.ts` (grant-cause case
  replaced), `iteration-guards.test.ts`, `recovery-permissions.test.ts`
  (permitted set now on the input), `patches.test.ts`, `permissions.test.ts`,
  `patch-reserve.test.ts`, `run-budget.test.ts` (new ceiling case),
  `service/summaries/tests/run-detail-preservation.test.ts`.

### Spend (step 4)

- **Recovery.** A run nobody asked for was already capped at
  `min(0.25, policy ?? 0.25, resolution)`, and that is confirmed unchanged. A
  run a person asked for used to ignore the policy. It now uses
  `min(ABS_MAX, policy ?? resolutionTotal)`, still under
  `AUTOMATION_STUDIO_RECOVERY_MAX_ESTIMATED_COST_USD_PER_RUN` ($2).
- **Build.** `automationStudioFlowBootstrapEvidenceLoopLimits(resolution, flowMaxEstimatedCostUsdPerRun?)`
  in `loop-limits/flow-bootstrap-evidence-loop.ts`. A positive Flow value
  replaces the resolution's `maxTotalEstimatedCostUsd` as the loop's
  `budget.maxCostUsd` and share divisor. The service passes
  `adaptationPolicyFromFlowMetadata(parent, flowSettings).maxEstimatedCostUsdPerRun`.
- The comments in that file no longer cite grants. The 64-call and 540,000 ms
  constants are unchanged.

### `result-check-authorization/contracts.ts`

- Comments only.

## Commands run and observed results

- `npx tsc --noEmit -p packages/fluxiq`, run twice.
  - Run 1: 177 output lines. My own tests had errors, which I fixed.
  - Run 2 (final): 135 `error TS`, all in test files outside my ownership, with
    none in non-test source:
    - `runtime/tests/refuted-result/tests/reauthor-service.test.ts` (23)
    - `runtime/tests/service-adaptation/tests/llm-grants.test.ts` (14)
    - `runtime/tests/service-bootstrap/tests/accounting.test.ts` (12)
    - `runtime/tests/service-adaptation/tests/iterating-recovery.test.ts` (12)
    - `runtime/tests/service-bootstrap/tests/rejections.test.ts` (9)
    - `runtime/tests/deepseek-bootstrap-exploration.test.ts` (8)
    - `runtime/tests/service-bootstrap/tests/extend.test.ts` (7)
    - `runtime/tests/service-adaptation/tests/failed-start.test.ts` (6)
    - `service-bootstrap/tests/generation.test.ts` (5)
    - `service-adaptation/tests/runtime-patches.test.ts` (5)
    - `runtime/tests/recovery-grant-limits.test.ts` (5)
    - `service-bootstrap/tests/catalog.test.ts` (4)
    - `service-flows/tests/execution-digest.test.ts` (3)
    - `deepseek-recovery-requests.test.ts` (3)
    - 2 each: `service-bootstrap/tests/plan-parameters`, `service-bootstrap/tests/permission`,
      `service-bootstrap/tests/permission-ask`, `service-bootstrap/tests/incomplete-draft`,
      `service-adaptation/tests/unattended-retry-verification`,
      `service-adaptation/tests/unattended-repair-authority`,
      `service-adaptation/tests/llm-diagnosis`,
      `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` (it imports the
      deleted `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS` and
      `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`)
    - 1 each: `service-bootstrap/tests/state-digest-and-trace`, `service-bootstrap/tests/fixtures.ts`,
      `service-bootstrap/tests/adaptation`
- `npx vitest run --minWorkers=1 --maxWorkers=1 src/.../runtime/service src/.../runtime/recovery/annotation/tests`,
  run from `packages/fluxiq`:
  - 40 files: 38 passed and 2 failed. 365 tests: 362 passed, 2 failed and
    1 skipped. The run took 308 s.
  - Both failures were `Test timed out in 15000ms`, in
    `run-detail-read/tests/flow-run-detail-reader.test.ts` and
    `summaries/tests/run-detail-preservation.test.ts`. Collection alone took
    74 s, which suggests a loaded machine.
  - Re-run of those two files alone: 2 files and 7 of 7 tests passed.
- `node scripts/structure-audit.mjs` printed:
  "structure-audit: passed (193 warning(s), 354 baselined)". It also printed
  "1 baseline entries can be lowered". I did not run `pnpm structure:baseline`,
  because the baseline file is not mine.

## Not verified

- The runtime tests outside my ownership, listed above.
- `_shared/runtime.ts` and API handlers. They compile, but I did not read them.
- Any live run, and the end-to-end refuted-result replay through the real
  service after an applied re-author. The port is covered by unit tests only.

## Open questions or contradictions found

- `flow-bootstrap/generation-failure/codes.ts` (not mine) still lists
  `flow_bootstrap.execution_grant_*` and `flow_bootstrap.stale_grant_binding`.
  Nothing in my files emits them now, so the owner can delete them.
- `llm.runtime_patch_grant_scope_refused` is kept as a stored code. It is
  matched in
  `!FluxIQWebExtension/packages/test-runner/src/live-llm/tests/live-llm-run.test.ts`
  and `.../tests/existing-fluxiq-control.test.ts`. Renaming it is a
  cross-repository decision.
- The request metadata key `executionPurpose` is kept, because
  `llm/deepseek/output-schema.ts` reads it. It now carries the intent.
- The recovery resolver call passes `caller` but not `modelId`: the adaptation
  context carries no `llmModel`. Only the build passes the Flow's model.
- `recovery/refuted-result/reauthor.ts:303` (not mine) still has a grant-worded
  comment about `replayReady`.
- The permission-request sentence "Neither its instruction nor a grant allows
  that" comes from `action-permissions` (not mine), so
  `recovery/annotation/tests/patches.test.ts:246` still asserts it.
