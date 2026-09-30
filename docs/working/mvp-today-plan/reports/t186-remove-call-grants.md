# t186 — Remove LLM call grants

Lane lead report. Branch `task/t186-remove-call-grants` in both trees:
`C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQ` (Core) and
`C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQWebExtension` (downstream).

## Rule (user, binding)

Model calls made while building, exploring, repairing, verifying/judging,
diagnosing or adapting a Flow need NO execution grant: nothing is issued,
leased, preflighted, digest-checked, confirmed (high-token), revoked or refused
before or during a provider call. Only the risk-only consequence permission
stays: a consequential act (move money, delete, send/publish) still asks the
person (`permission_required`). Spend safety is a plain configured limit read
from Flow settings and enforced by the loop's budget.

## Target contract (all workers build to this)

### Core `runtime/llm/`

- DELETE `runtime/llm/execution/` (grants.ts, grant-checks.ts, grant-metadata.ts,
  grant-refusal.ts, grant-binding.ts, index.ts), `runtime/llm/grant-capabilities.ts`,
  `runtime/llm/runtime-session-grant.ts`, and their tests.
- NEW `runtime/llm/model-caller.ts`:
  ```ts
  /** The person a model call is made for: whose unlocked Secret Keys key pays.
   * Not an authorization -- nothing is issued, held, checked or revoked. */
  export type AutomationStudioLlmModelCaller = { actorUserId: string; actorSessionId: string };
  ```
- NEW `runtime/llm/runtime-session-llm.ts` (replaces runtime-session-grant.ts):
  ```ts
  export const AUTOMATION_STUDIO_RUNTIME_SESSION_LLM_INTENTS = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt", "build_and_adapt", "verify_result"] as const;
  export type AutomationStudioRuntimeSessionLlmIntent = (typeof AUTOMATION_STUDIO_RUNTIME_SESSION_LLM_INTENTS)[number];
  /** A run a person asked the model to take part in: who asked, and what for. */
  export type AutomationStudioRuntimeSessionLlm = AutomationStudioLlmModelCaller & { intent: AutomationStudioRuntimeSessionLlmIntent };
  export function automationStudioRuntimeAdaptationContextForLlmRun(context, intent): AutomationStudioRuntimeAdaptationContext; // same body as ...ForGrant
  ```
- `resolver-contract.ts`: `AutomationStudioLlmProviderResolverInput.executionGrant`
  becomes `caller?: AutomationStudioLlmModelCaller`. `AutomationStudioLlmProviderResolution`
  loses `permittedConsequences`. `AutomationStudioBuildAndAdaptExecutionGrant` is deleted.
- NEW `runtime/llm/session-key-provider.ts`:
  `createAutomationStudioSessionKeyProviderResolver({ ports, fetchImpl? })` returns
  `(input: AutomationStudioLlmProviderResolverInput) => AutomationStudioLlmProviderResolution | undefined`.
  No `caller` -> `undefined`. With a caller: a DeepSeek provider whose secret is,
  per call, the newest enabled DeepSeek LLM key released to the caller's own
  unlocked session (same rule and ports as `deepseek/panel-command-key.ts`; share
  the key-pick code rather than copying it), refusing an outbound body that
  contains the secret. Model = `input.modelId` if a configured DeepSeek model,
  else Core's default. Returns default per-call limits (tokens 48k in / 8k out /
  56k total, `maxEstimatedCostUsd` 0.25, `maxTotalEstimatedCostUsd` 2, timeout
  as the old grant default unless the Lab used larger) -- defaults, not checks.
- `_shared/runtime.ts`: no grant service; `automationStudio.bindLlmExecutionProvider(resolver)`
  takes the resolver only. `GlobalProgramRuntime.llmExecutionGrants` removed.

### Core service (`runtime/service.ts` and `runtime/service/**`)

- `bindLlmExecutionProvider(resolver)` only; options `revokeLlmExecutionGrant`,
  `continueLlmExecutionGrantAfterAppliedFlowAdaptation`, `closeLlmExecutionGrants` removed.
- `generateFlowBootstrapAdaptation` input: `executionGrant` replaced by
  `caller: AutomationStudioLlmModelCaller` and `permittedConsequences?: AutomationStudioActionConsequence[]`.
  No purpose check, no digest/settings-revision comparison against a grant (the
  proposal's own base digest is still read from the Flow as it stands).
- `runRuntimeSession` input: `llmExecution?: AutomationStudioRuntimeSessionLlm` and
  `permittedConsequences?: AutomationStudioActionConsequence[]`; the recovery's
  consequence gate reads `permittedConsequences` from the run input (was the
  resolution). No grant revoke anywhere.
- Refuted-result repair re-authors under the run's own `caller`; no grant continuation
  (`reauthor-continuation.ts` goes if it only continued the grant).
- Spend limit: Flow setting `adaptationPolicySettings.maxEstimatedCostUsdPerRun`
  (policy `maxEstimatedCostUsdPerRun`), when set, is the run's total cost ceiling
  for builds and recoveries; otherwise the resolution's default.

### Core API (`api/**`)

- Endpoints `preflight-llm-execution` and `issue-llm-execution-grant` deleted with
  their contracts. Readiness `runtime.llmExecutionGrantsConfigured` removed.
- `generate-flow-bootstrap-adaptation` (and every other build endpoint that took
  `llmExecutionGrantId`): no grant id; optional `permittedConsequences`; caller is
  `request.actor`.
- `run-runtime-session`: no `llmExecutionGrantId`, no hold; `runIntent` with an actor
  makes `llmExecution`; optional `permittedConsequences`.

### Web app, Lab

- Web: no preflight/issue/high-token UI or commands; `permission.allowModelRun`
  capability deleted; builds/runs send `permittedConsequences` where the person
  allowed any; logout does not revoke grants.
- Lab: `live-llm/execution-grant.ts` deleted; builds/runs send `permittedConsequences`
  from `--llm-permit` (consequence permission only); the run budget is written to the
  Flow's `adaptationPolicySettings.maxEstimatedCostUsdPerRun`; no grant step in the plan.

## Audit: grant touchpoints (2026-09-29, before the change)

Grep: `executionGrant|ExecutionGrant|execution-grant|grant-refusal|highTokenConfirmation|issue-execution-grant|llmPermit|allowModelRun|llmExecutionGrantId|revokeForSession|getLlmExecutionBinding`, excluding `docs/working`.

Core (`AS` = `packages/fluxiq/src/programs/automation-studio`):

- Grant service and table: `AS/runtime/llm/execution/{grants,grant-checks,grant-metadata,grant-refusal,grant-binding,index}.ts`, `AS/runtime/llm/grant-capabilities.ts`, `AS/runtime/llm/runtime-session-grant.ts`, `AS/runtime/llm/resolver-contract.ts`, `AS/runtime/llm/index.ts`, grant attempt-limit symbol in `AS/runtime/llm/provider-retry/call.ts`.
- Host wiring: `_shared/runtime.ts` (grant service, bind resolver/revoke/close/continue, API registration), `apps/web/src/app/api/auth/logout/route.ts` (revokeForSession).
- Service: `AS/runtime/service.ts` (bind options, bootstrap grant read + digest check + revoke, refusal-code map, run grant revoke, verification grant, refuted-result grant continuation), `AS/runtime/service/flow-bootstrap-commands/{contracts,generation-request}.ts`, `AS/runtime/service/runtime-adaptation/{reauthor-continuation,refuted-result-port,repair-authority}.ts`, `AS/runtime/recovery/annotation/annotate.ts` (grant purpose, permittedConsequences from resolution), `AS/runtime/loop-limits/flow-bootstrap-evidence-loop.ts` (comments), `AS/runtime/result-check-authorization/contracts.ts` (comments).
- API: `AS/api/contracts/{endpoints,llm,adaptation}.ts`, `AS/api/handlers/{llm-generation,runtime-execution,register,dependencies}.ts` (preflight + issue endpoints, grant inspect/hold).
- Web: `apps/web/src/features/automation-studio/runtime/{run-commands,runtime-host,FlowRunView}.ts(x)`, `authoring/{authoring-commands,improvement-host,blank-flow-authoring-model,ImproveFlowPanel,BlankFlowAuthoringPanel}`, `conversation/capabilities/catalog/{running,flows}.ts` (`permission.allowModelRun`).
- Tests: `AS/runtime/llm/tests/execution-grant/**`, `AS/runtime/llm/tests/verify-result-grant.test.ts`, `_shared/tests/runtime-llm-grants.test.ts`, `AS/runtime/tests/{recovery-grant-limits,deepseek-recovery-requests,deepseek-bootstrap-exploration}.test.ts`, `AS/runtime/tests/service-bootstrap/tests/*`, `AS/runtime/tests/service-adaptation/tests/*`, `AS/runtime/tests/refuted-result/tests/reauthor-service.test.ts`, `AS/runtime/tests/service-flows/tests/execution-digest.test.ts`, `AS/runtime/service/runtime-adaptation/tests/*`, `AS/runtime/recovery/annotation/tests/*`, `AS/api/**/tests/*`, web tests beside the web files.
- Docs: `docs/architecture/{automation-studio.md,automation-studio/persistence.md,automation-studio/llm-flow-bootstrap.md,package-boundaries.md}`, `docs/reference/framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md`.

Downstream:

- Lab: `packages/test-runner/src/live-llm/{execution-grant,authorize-flow,index,live-llm-plan,live-llm-run}.ts` + tests, `commands.ts`, `demo-llm-create-ui/{explore-proposal-ui,generation-readiness}.ts` + tests, `demo-workspace/{exploration-adaptation,panel-run}.ts`, `existing-fluxiq-control.ts`, `flow-lane/creation/{build-proposal,instruction-task}.ts`, `flow-lane/persisted-flow-run.ts`, `saved-flow-replay/replay-saved-flow.ts`, `ui-e2e/topology.ts`, `packages/test-contracts/src/llm.ts`, `scripts/lab/live-campaign.mjs`, `scripts/lab/live-campaign/lab-run/command.mjs` + test, `scripts/run-demo-llm-creation-readiness.mjs`.
- Extension (`apps/extension`): no grant touchpoints.
- Docs: `docs/architecture/testing-facility.md`.

Not an interactive grant, audited separately: the standing result-check authorization for unattended runs (`AS/runtime/result-check-authorization/**`, `AS/runtime/service/runtime-adaptation/repair-authority.ts`). See "Standing authorization" below.

## Progress

- Lead: `runtime/llm` layer landed — deleted `execution/`, `grant-capabilities.ts`, `runtime-session-grant.ts` and their tests, `_shared/tests/runtime-llm-grants.test.ts`; added `model-caller.ts`, `runtime-session-llm.ts`, `session-key-provider.ts`, `deepseek/session-key.ts` (shared with the chat key), rewrote `resolver-contract.ts`, `llm/index.ts`, `deepseek/panel-command-key.ts`, `_shared/runtime.ts`; dropped the grant attempt-limit symbol from `provider-retry/call.ts`. Validation: `npx vitest run .../llm/tests/session-key-provider.test.ts` → 4 passed (a model call with no grant succeeds on the caller's key; no caller → no provider; locked session fails the call).

## Merge of dev (t180, t182, t177), 2026-09-29

Resolved in both trees; staged with `git add` only (supervisor commits).

- Core `runtime/service.ts` `finally`: kept dev's `this.runControl.close(...)` (t180); dropped the grant revoke.
- Core `api/handlers/runtime-execution.ts` import: grant-free runtime imports plus dev's `automationStudioRunChangedDurableBehavior`; `AUTOMATION_STUDIO_RUNTIME_SESSION_GRANT_PURPOSES` dropped.
- Web `runtime/runtime-host.ts` import: dev's `pause/resume/getRuntimeRunControl`; `issueLlmExecutionGrant`/`preflightLlmExecution` dropped.
- Web `conversation/capabilities/catalog/running.ts`: kept dev's `run.pause/takeControl/resume/progress`, `REASON`, `runControlOutcome`; dropped `PURPOSE`, `flowModelKey` (it existed only to fetch a key for a grant), and the `flowModelFromDetail`/`loadFlowSettingsDetail` imports.
- Web `runtime/tests/run-control-interactions.test.tsx` (new from dev): removed its `preflightLlm`/`issueLlmGrant` mocks.
- Downstream `test-runner/src/demo-workspace/panel-run.ts`: kept dev's `PANEL_RUN_RESPONSE_TIMEOUT_MS` (180 s) and `RunnerFailure` timeout (`panel_run.response_timeout`); dropped the preflight/issue-grant rejection listener.
- Left for step 2 grep: t182's paired-client field denylist still names `llmExecutionGrantId` (`apps/web/src/lib/program-route.ts` + tests, `route.test.ts`, `client-gateway.md`), `runtime-execution.ts` refuses a request that carries `llmExecutionGrantId`, and `simple-panel-control.test.ts` sends one.

Validation (build slot b1): `packages/fluxiq` `npx tsc --noEmit` exit 0; `apps/web` `npx tsc --noEmit` exit 0; downstream `packages/test-runner` `pnpm check` exit 0.
