# Provider-disabled public run regression

Status: Complete test-only regression; source/test frozen for independent supervisor review.
Owner: resume-ab

## Current State

Public FluxIQ.create forwards modelProvidersEnabled:false to the global runtime and retains the actual AutomationStudio service, runtime and native binding. False omits standing result-check/session/chat provider wiring before release/dispatch; this static constructor evidence alone is not saved-Flow execution proof.

Initial four bounded reads completed: framework/tests/model-provider-admission.test.ts; framework/index.ts constructor/service access; programs/_shared/runtime.ts false wiring; automation-studio/runtime/tests/native-node-runtime.test.ts. The native test executes the graph directly, so it is not sufficient for the required public ordinary saved-service path. Exact additional setup requested: framework/tests/index.test.ts native public construction/run section and _shared/tests/model-provider-admission.test.ts preconstruction key/fetch spy fixture.

Owned new Core test framework/tests/model-provider-disabled-run.test.ts only; no support file required. Production/source other owners untouched. The actual public run completed: saved parent Flow and primary Subflow/router, trusted-local native registration, original service, ordinary runRuntimeSession, then public getFlowRunDetail. The native callback executed once, the persisted native action attempt succeeded, and detail.summary reports the same successful terminal run. This is actual saved-service execution, not graph-direct or constructor-only evidence.

## Observed disabled-provider result

Before FluxIQ.create, the fixture installs fresh fetch, SecretKeysService.prototype.createSessionRevealAuthorization and revealKeyWithAuthorization spies. Fetch is replaced with a throwing fixture transport; the actual service/provider implementations are not replaced. Public creation uses modelProvidersEnabled:false and loadEnv:false. A nonempty fixture-only DeepSeek key is authored through the original public Secret Keys service and its session is unlocked before the saved run. The key snapshot is redacted and unchanged after execution; its enabled LLM key remains present, and the session unlock count remains one. Original AutomationStudio and IdentityAccess service identities remain unchanged.

The terminal public detail has metadata.llmGate exactly: invoked:false, ok:true; costAccounting calls/explorationCalls/inputTokens/outputTokens/totalTokens/estimatedCostUsd/budgetBreaches/pendingCalls all zero; providerCalls:[] and providerCallsOmitted:0. All three preconstruction spies record zero calls. Thus zero release/dispatch is directly observed in this fixture and agrees with an explicit terminal ledger; it is not inferred from absent accounting or disabled configuration. The empty interventions and invoked:false describe an unjudged model path. Native execution success does not claim model acceptance or task-result acceptance.

No llmExecution intent is supplied: its public type intentionally forces model participation, so it would change the ordinary-run request rather than merely identify a caller. An actual unlocked fixture session and available key provide the preserved credential context. This test does not test a later trusted provider rebind; constructor false omits built-in providers rather than prohibiting future reconfiguration. It does not prove A/B saved-Flow reuse, browser operation, or cart correctness.

## Bounded reads and validation

Approved setup expansions: framework/tests/index.test.ts native construction fixture; programs/_shared/tests/model-provider-admission.test.ts preconstruction spies; runtime/tests/service-flows/tests/runs.test.ts; its runtime/tests/service-fixtures.ts helper; secret-keys/runtime/tests/service.test.ts authored key/unlock fixture; runtime/service.ts runRuntimeSession and getFlowRunDetail signatures; result-verification/zero-provider-run.ts return shape; llm/runtime-session-llm.ts; llm/deepseek/session-key.ts port signature; imported public model/flow-adaptation.ts detail/summary contract. Discovery used exact symbols/paths before reads.

Two initial failing executions were fixture API errors: getFlowRunDetail mistakenly received an object instead of positional projectId/runId, then its wrapper was asserted as though runId/status were top-level rather than detail.summary. These were corrected in the test only; they are not production regressions. The corrected fixture passed, then the final native-attempt assertion also passed.

Final owning command, Core cwd C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 provider-disabled native terminal regression final' pnpm --filter fluxiq exec vitest run src/framework/tests/model-provider-disabled-run.test.ts
```

Observed exit0, one file/one test passed; 19.97s total, 2.57s test execution. Test is 88 lines, no focused support required. No typecheck, package build, audit, whole suite, real provider/browser/live run, user-state/key/profile operation, shared-doc update or git action performed. Temporary fixture storage is closed and removed by the test lifecycle; user keys are untouched. Supervisor independent rerun remains required.
