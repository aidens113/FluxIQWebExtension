# t186-C — Core API: remove LLM call grants

Worker report. Core tree `C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQ`, branch
`task/t186-remove-call-grants`. Nothing committed.

## Outcome

Done for `api/**`. The focused API vitest suite passes: 18 files, 84 tests.
`tsc` reports no errors in `api/**`. It still fails elsewhere, in
runtime/service files owned by other workers (listed below). The type-level
assertions in the new contract test were checked while `runtime/service.ts`
was still mid-change, so they need to be read again once the service lands.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/api/`.

- `contracts/endpoints.ts`: deleted the `preflightLlmExecution` and
  `issueLlmExecutionGrant` entries.
- `contracts/llm.ts`: deleted every grant type:
  `AutomationStudioLlmExecutionPurpose`, `AutomationStudioRuntimeSessionLlmIntent`,
  `AutomationStudioLlmExecutionLimitRequest`, `...PreflightRequest`,
  `...GrantRequest`, `...Preflight`, `...PreflightResponse`, `...Grant`,
  `...GrantResponse`. The API copy of `AutomationStudioRuntimeSessionLlmIntent`
  also had to go, because `runtime/llm/runtime-session-llm.ts` now exports that
  name and the program barrel re-exports both. Only the reusable-context
  request types remain.
- `contracts/adaptation.ts`:
  - `GenerateFlowBootstrapAdaptationRequest`: `llmExecutionGrantId` removed;
    `permittedConsequences?: AutomationStudioActionConsequence[]` added.
  - Doc comments on `permissionRequest` now say "send the next build's
    `permittedConsequences`" instead of "issue a grant".
  - Readiness: removed `preflightEndpoint`, `issueGrantEndpoint`,
    `runtime.llmExecutionGrantsConfigured`, `capabilities.grantPurpose` and
    `capabilities.canonicalBindingFields` (`executionDigest`/`settingsRevision`
    were the grant's binding fields). Because the shape changed,
    `contractVersion` went from `...readiness.v1` to `...readiness.v2`. The
    parser was updated to match, and it refuses a v1 record or one that still
    carries grant fields.
- `handlers/llm-generation.ts`:
  - Deleted the preflight and issue handlers and `llmExecutionGrantIssueCode`.
  - Readiness no longer takes a grant service.
  - `generate-flow-bootstrap-adaptation`:
    - no grant lookup;
    - parses `permittedConsequences` with `parseAutomationStudioPermittedConsequences`,
      and an unknown class is refused with "Flow bootstrap generation request
      contains invalid permitted consequences.";
    - calls the service with `caller: { actorUserId, actorSessionId }` from
      `request.actor` and always passes `permittedConsequences` (`[]` when
      absent);
    - keeps the `authSessionId` check;
    - `llmExecutionGrantId` is now an unsupported field and is refused.
- `handlers/runtime-execution.ts` (`run-runtime-session`):
  - No grant id and no `holdForRun`.
  - `runIntent` must be one of `AUTOMATION_STUDIO_RUNTIME_SESSION_LLM_INTENTS`,
    otherwise it is refused ("The run intent is not one Core supports.").
  - `runIntent` with no actor is refused ("A run the model takes part in needs
    a signed-in person.").
  - With an actor it makes `llmExecution = { actorUserId, actorSessionId, intent }`.
  - Optional `permittedConsequences` is parsed and forwarded; an unknown class
    is refused.
  - `runIntent` and `permittedConsequences` are no longer spread raw into the
    service input.
  - A request that still sends `llmExecutionGrantId` is refused ("LLM execution
    grants no longer exist; send runIntent alone."). I chose this so a stale
    caller fails visibly instead of silently.
- `handlers/dependencies.ts` and `handlers/register.ts`: removed the
  `llmExecutionGrants` dependency and parameter. The signature is now
  `registerAutomationStudioApi(registry, service, identityAccess?, clientGatewayBridge?, clientGateway?)`,
  which matches the landed `_shared/runtime.ts` call.
- `handlers/llm-execution-settings.ts`: `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS`
  no longer exists, so a local constant `FLOW_LLM_EXECUTION_MAX_CALLS = 64`
  replaces it. The value is unchanged.
- Tests:
  - `contracts/tests/llm.test.ts` deleted: it only compared the contract with
    the grant service.
  - New `contracts/tests/adaptation.test.ts`:
    - type assertions: no `llmExecutionGrantId`, and `permittedConsequences`
      matches `AutomationStudioActionConsequence[]` and the service build input,
      which has no `executionGrant`;
    - the readiness record names no grant or preflight.
  - `handlers/tests/llm-permission.test.ts`, rewritten:
    - a build with no grant reaches the service with `caller` and the ordered
      `permittedConsequences`, and no `executionGrant`;
    - **a build with no permission that meets a consequential act still ends
      `flow_bootstrap.permission_required` with the request intact**;
    - a run carries `permittedConsequences` beside `llmExecution`;
    - the "request only on permission_required" test is kept.
  - `handlers/tests/llm-generation.test.ts`:
    - removed the preflight, issue and grant-service tests;
    - run-intent tests now expect `{ actorUserId, actorSessionId, intent }`;
    - readiness expectations updated, and the v1/grant-field records are
      refused;
    - new: no preflight or issue endpoint exists (`endpoint.not_found`);
    - new: unknown consequence classes are refused for both builds and runs;
    - new: a leftover grant id is refused;
    - the build tests expect `caller` plus `permittedConsequences: []`.
  - `handlers/tests/runtime-execution.test.ts`: the grant-hold tests are
    replaced with three:
    - `llmExecution` is made from the intent and the actor, with nothing held;
    - an intent with no actor is refused, calling the handler directly because
      the registry refuses actorless calls first;
    - a plain run gets no `llmExecution`.
  - `handlers/tests/llm-execution-settings.test.ts`: uses literal 64 and 65.

## Final endpoint payloads

`generate-flow-bootstrap-adaptation` (`flows.write`, authoring). Every other
field is refused as unsupported.

```ts
{ projectId: string; flowId: string; authSessionId: string /* must equal actor session */;
  permittedConsequences?: ("move_money"|"delete"|"send_or_publish"|"modify_existing"|"create_new")[];
  evidenceGuided?: true; useReusableContext?: true; startLocation?: string; mode?: "create"|"extend" }
```

The service receives:

```ts
{ projectId, flowId, caller: { actorUserId, actorSessionId }, permittedConsequences, evidenceGuided?,
  useReusableContext?, mode?: "extend", startLocation?, permissionAskTimeoutMs }
```

`run-runtime-session` (`runtime.control`, authoring). The request is the
existing run fields plus:

```ts
runIntent?: "diagnosis_only"|"diagnose_and_adapt"|"explore_and_adapt"|"build_and_adapt"|"verify_result";
permittedConsequences?: AutomationStudioActionConsequence[];
```

`llmExecutionGrantId` is refused. The service receives the run fields plus
`llmExecution?: { actorUserId, actorSessionId, intent }` and
`permittedConsequences?`.

`get-flow-bootstrap-generation-readiness`:

```ts
{ contractVersion: "automation-studio.flow-bootstrap-generation-readiness.v2", schemaVersion: "0.1", supported,
  generationEndpoint: "generate-flow-bootstrap-adaptation", reviewEndpoint: "review-flow-adaptation",
  runtime: { providerResolverConfigured, nativeNodeRegistryConfigured },
  capabilities: { taskKind, expectedOutput, requiresNativeNodeRegistryContext, structuredFailureDiagnostics } }
```

`preflight-llm-execution` and `issue-llm-execution-grant` are deleted and now
answer `endpoint.not_found`.

## Commands run and observed results

- `npx vitest run --minWorkers=1 --maxWorkers=1 src/programs/automation-studio/api`
  (in `packages/fluxiq`): **18 files passed, 84 tests passed** (112.75s).
- `npx tsc --noEmit -p packages/fluxiq` (repo root): exit 2, 128 errors,
  **none in `api/**`**. The errors are in files outside my ownership:
  - `_shared/runtime.ts` (1): 105,20 "Expected 2-4 arguments, but got 1" on
    `bindLlmExecutionProvider`.
  - `runtime/service.ts` (19): missing `AutomationStudioBuildAndAdaptExecutionGrant`,
    `automationStudioLlmExecutionGrantRefusalCode`, and more.
  - `runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` (2).
  - `runtime/recovery/annotation/tests/*`: annotate-harness 3, annotate 2,
    patches 1, recovery-permissions 1, run-budget 11.
  - `runtime/service/runtime-adaptation/tests/repair-authority.test.ts` (1).
  - `runtime/tests/`:
    - deepseek-bootstrap-exploration 6
    - deepseek-recovery-requests 3
    - recovery-grant-limits 5
    - refuted-result/tests/reauthor-service 15
    - service-adaptation: iterating-recovery 6,
      unattended-repair-authority 2, unattended-retry-verification 2
    - service-bootstrap: accounting 12, adaptation 1, catalog 4, extend 7,
      generation 5, incomplete-draft 2, permission-ask 2, permission 1,
      plan-parameters 1, rejections 9, state-digest-and-trace 1
    - service-flows/tests/execution-digest 3

## Not verified

- The type assertions in `contracts/tests/adaptation.test.ts` read
  `Parameters<AutomationStudioService["generateFlowBootstrapAdaptation"]>[0]`.
  While `service.ts` does not compile, that type may be degraded, so the
  assertions may pass vacuously. Re-run `tsc` once the service worker lands.
- The handler tests mock the service, so nothing here proves the real service
  accepts `caller` and `permittedConsequences` end to end.
- No live build or run was attempted.

## Open questions or contradictions found

- The readiness contract bump to v2 and the removal of `grantPurpose` and
  `canonicalBindingFields` go beyond the brief's wording ("remove
  `llmExecutionGrantsConfigured`"). Downstream still reads the old fields:
  - `!FluxIQWebExtension/packages/test-runner/src/demo-llm-create-ui/generation-readiness.ts`
    (and its `tests/readiness-gate.test.ts`)
  - `!FluxIQWebExtension/scripts/run-demo-llm-creation-readiness.mjs`

  Both read `llmExecutionGrantsConfigured`, so the web and Lab workers must
  update them.
- Core docs still describe the grant endpoints and readiness fields:
  `docs/architecture/automation-studio/llm-flow-bootstrap.md` and
  `docs/architecture/package-boundaries.md`. They are not mine to edit.
- `runtime/recovery/annotation/annotate.ts` still reads
  `input.executionGrant?.purpose`. That file belongs to the service or recovery
  owner.
