# D3 — Runtime execution and failure handling as it exists today

Read-only investigation. Nothing was changed in either repository.

Paths are relative to `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`
unless prefixed with `contracts/` (which is `F:\!FluxIQ\packages\contracts\src\`)
or `web/` (which is `F:\!FluxIQWebExtension\`).

---

## Outcome

Done. All five questions are answered below with `file:line` evidence, followed
by a numbered walk of the failure-handling sequence as it actually runs and a
final section naming the seams a defensive ladder would attach to.

**The single most important finding:** there is no per-node retry anywhere in
the runtime. A node that fails is never executed a second time. The word
"retry" appears in five places and none of them re-runs a failed node:
`maxRetriesPerAction` is a *cap on the recovery ladder*, not an allowance;
`builtin.timing.retry` returns its own parameters as outputs and retries
nothing; `temporary_wait_retry` writes a `retryCount` onto a node that nothing
reads; the composite (Call Flow) retry re-runs a *child Flow*, not a node, and
defaults to one attempt; and the "adaptive retry" is a whole-run resume that
happens only after the model has already repaired the Flow.

---

## 1. The full execution path for one node

### 1.1 The step loop

`runtime/executor/graph-run.ts:211` is the only loop that advances a Flow. Per
iteration it:

1. checks `options.signal?.aborted` (`graph-run.ts:212`);
2. resolves the node's region, its required capabilities and its timeout
   (`graph-run.ts:215-222`);
3. executes the node once — `executeAutomationStudioNode(...)` at
   `graph-run.ts:224`, or wrapped in `executeWithRegionTimeout` at
   `graph-run.ts:225-231` when the region has a remaining budget;
4. pushes the attempt (`graph-run.ts:234`), publishes every output into the
   run's `values` map under both `<nodeId>.<key>` and `<key>`
   (`graph-run.ts:236-239`);
5. branches on `attempt.status`: `waiting` returns (`graph-run.ts:242`),
   `failed` goes to the recovery ladder (`graph-run.ts:253`), otherwise it
   chooses the next edge (`graph-run.ts:280`).

There is no inner loop over attempts. `attempts.length + 1` is the attempt
number (`graph-run.ts:224`), and it only ever increases because the graph
walked somewhere, never because a node was taken again.

### 1.2 Dispatch inside one node

`runtime/executor/node-execution.ts:35` `executeNodeAttempt` is the whole of
"run one node":

- **Parameter resolution** — `resolveAutomationNodeParameterValues`
  (`node-execution.ts:48-57`) merges run inputs, live run variables, graph
  `values` and edge inputs. An unresolvable state-bound path fails the attempt
  immediately with no failure record (`node-execution.ts:66-80`).
- **Pre-action snapshot** — `captureHostState(..., point: "before_action")`
  (`node-execution.ts:81`). This *captures*; it judges nothing.
- **Version pin check** (`node-execution.ts:82-84`).
- **Dispatch, in this fixed order** (`node-execution.ts:85-118`):
  1. `getAutomationNodeDefinition(node.definitionId)?.execute` — built-in nodes
     only. The registry is a literal array of built-ins
     (`nodes/registry.ts:53-55`), so a `web.output.*` node never matches here.
  2. `options.nativeNodeExecutor` (`node-execution.ts:86`) →
     `runtime/native-node-runtime.ts:76` `execute`, which looks the definition
     up in the importer SDK registry and calls the bound implementation with a
     30 s default timeout (`native-node-runtime.ts:83, 88`). For this domain
     that implementation is
     `web/domain/src/output-nodes/native-runtime.ts:67-83`, which returns
     `status: "success"` and one `policy.output.dispatch` effect. **The node
     implementation never reports the browser's outcome** — see its own comment
     at `web/domain/src/output-nodes/native-runtime.ts:50-60`.
  3. `options.compositeExecutor` (`node-execution.ts:101`) — Call Flow.
  4. Otherwise the attempt fails with "Node definition is not executable"
     (`node-execution.ts:105-117`).
- **Effect dispatch** — `dispatchAutomationStudioEffects`
  (`node-execution.ts:98, 138`, defined at `node-execution.ts:180`). This is
  where the web action actually happens. `options.effectDispatcher` is
  `createRuntimePolicyEffectDispatcher` (`runtime/service.ts:3093-3095`), which
  is `runtime/io-policy.ts:75`. It calls `runtime.dispatch(...)`
  (`io-policy.ts:88-106`) → `web/domain/src/runtime/adapter.ts:71`
  `executeWebAutomationRuntimeCommand` → `dispatchWebAutomationOutput`
  (`adapter.ts:91`) → the paired extension over the gateway.
- **Merge** — a dispatcher result with `status: "failed"` overwrites the node's
  own optimistic success, taking its route, message, `failure` record and
  `targetResolution`, and stops dispatching further effects
  (`node-execution.ts:197-208`).
- **Post-action enrichment and the expected-state check** — `finishAttempt`
  (`node-execution.ts:159-168`): `enrichAttemptWithHostState` captures
  `after_action` and asks the host for a diff
  (`runtime/executor/host-state.ts:22-54`), then
  `attemptWithHostExpectationEvaluation`
  (`runtime/executor/transition-comparison.ts:99`).

### 1.3 How success or failure is decided

Four independent things can decide it, in this order:

1. **The node implementation's own `status`** — e.g. a Call Flow child that
   failed, or an extraction whose dataset is invalid.
2. **The effect dispatcher's `status`**, which overrides the node's
   (`node-execution.ts:197-208`). For a web action this is the command status
   from `web/domain/src/runtime/adapter.ts:97`, classified into a failure
   record by `commandFailure` (`adapter.ts:106, 186`).
3. **The record-persistence hook** — a throwing `onRecordBatch` fails the
   attempt with `record_output.persist_failed`
   (`node-execution.ts:251-268`, record at `:264`).
4. **The host's expected-state verdict** —
   `attemptWithHostExpectationEvaluation`. If, and only if, the attempt
   *succeeded*, the node is not `builtin.policy.expectation`, and
   `expectedState` has at least one key (`transition-comparison.ts:109`), the
   host is asked. A rejection rewrites the attempt to
   `status: "failed", route: "failed"` with the host's failure record or Core's
   `EXPECTATION_REJECTED_FAILURE` (`transition-comparison.ts:128-136`).

The attempt is then classified into a `transitionComparison`
(`transition-comparison.ts:38-87`), whose `status` is derived structured-first
from the failure record's category
(`COMPARISON_STATUS_FOR_FAILURE`, `transition-comparison.ts:14-31`; used at
`:169-170`), falling back to text matching on "timeout" (`:171-172`).

---

## 2. Every retry that exists today

| # | Where | Attempts | Backoff | What varies | Re-check before retry |
|---|---|---|---|---|---|
| 1 | Call Flow child, `runtime/composite-executor.ts:63-68` | `node.parameterValues.retry.maxAttempts`, floored at 1, **default 1** (`:63`) | none — the loop has no delay | nothing; identical `childInputs`, identical options | none |
| 2 | Adaptive run resume, `runtime/service.ts:2953` | at most one, and only after a model-authored patch verified | n/a | the Flow has been *changed* by the patch; the run resumes at `decision.resume.nodeId` (`:2980`) | yes — the trial's verdict (§2.3) |
| 3 | Live-patch trial, `runtime/live-patch.ts:252-262` | one trial run per patch | n/a | the patched Flow, started at the changed node (`:254-255`), seeded with `input.failedAttempt.inputs` (`:256`) | n/a — this *is* the check |
| 4 | Browser-side assertion poll, `web/apps/extension/src/content/action-runtime/assertion-evaluation.ts:74-78` | until the deadline, 50 ms apart (`:65`) | fixed 50 ms | the live DOM is re-queried each pass (`evaluateOnce`, `:76`) | n/a — it is a wait, not an action retry |
| 5 | Browser-side wait conditions, `web/apps/extension/src/content/action-runtime/waits.ts:64` | poll until deadline | fixed interval | DOM state | n/a |

### 2.1 What `maxRetriesPerAction` actually does

`runtime/executor/recovery-budget.ts:18`:

```ts
const retry = budget.maxRetriesPerAction !== undefined && state.failedAttemptsForAction >= budget.maxRetriesPerAction;
```

`state.failedAttemptsForAction` counts previous *failed attempts for the same
node id* (`recovery-budget.ts:7`). When exhausted, the ladder stops offering the
`deterministic_path` candidate (`runtime/executor/recovery-ladder.ts:31`). It
grants nothing. Default value is `1`
(`model/flows.ts:234-238`), read back at `runtime/service.ts:6018, 6032-6036`.

So `maxRetriesPerAction: 1` means "the failed edge may be followed back into the
same node at most once", which only matters for a Flow whose `failed` edge loops
back. It is not a retry allowance.

### 2.2 `builtin.timing.retry` retries nothing

`nodes/timing/retry.ts:33`:

```ts
execute: (context) => emptyResult({ success: context.inputs.in ?? null, attempts: ..., delayMs: ..., backoff: ..., jitterMs: ... })
```

It returns its own parameters as outputs and routes to `success`. No caller
consumes `attempts`, `delayMs`, `backoff` or `jitterMs`.

### 2.3 `temporary_wait_retry` writes a `retryCount` nothing reads

`runtime/live-patch.ts:499` writes `timeoutMs` and `retryCount` onto the target
node's `parameterValues`. A repository-wide grep for `retryCount` in
`packages/fluxiq/src` finds only: the LLM provider schema
(`runtime/llm/deepseek-provider.ts:139`), the structured-response type
(`runtime/llm/harness/structured-response.ts:143`), its validator
(`runtime/llm/harness/provider-result.ts:170, 182`), the patch application
above, the adaptation summary (`live-patch.ts:546`), and a provider-settings
guard (`api/handlers/llm-execution-settings.ts:27`). **No execution path reads
it.** `timeoutMs` *is* read — by `builtin.policy.action`
(`nodes/policy/action.ts:62`) and `builtin.policy.expectation`
(`nodes/policy/expectation.ts:51`) — so a `temporary_wait_retry` patch
effectively only widens a timeout.

### 2.4 `RetryPolicy { maxAttempts, backoffMs }`

Declared at `model/policies.ts:11-14`, validated at
`model/validation/policy-graph.ts:22-23`, defaulted at `runtime/service.ts:1328`
(`retry: { maxAttempts: 1, backoffMs: 500 }`). The only consumer of
`maxAttempts` at run time is the composite executor
(`composite-executor.ts:63`). `backoffMs` has no consumer at all.

---

## 3. Expected-state and state-digest checks around a node

### 3.1 Before a node

Only a **capture**, never a judgement: `captureHostState(..., "before_action")`
(`node-execution.ts:81`, `host-state.ts:6-17`). A throw is swallowed and the ref
is simply absent (`host-state.ts:14`). The web host declines the capture for any
node that does not act on a page
(`web/domain/src/runtime/host-runtime.ts:97-100, 203-207`).

Nothing compares this snapshot against anything before the action runs. There is
no precondition gate.

### 3.2 After a node

Three things happen, in order:

1. **`after_action` capture + state diff** — `enrichAttemptWithHostState`
   (`host-state.ts:22-54`). The diff is `web-state-diff.v2`
   (`web/domain/src/runtime/host-runtime.ts:67, 165-194`): location changed,
   title changed, element counts, and up to 10 added/removed elements
   (`host-runtime.ts:75`). **It is recorded on the attempt and never used to
   decide anything.** It is evidence for the model, nothing more.
2. **Expected-state evaluation** —
   `attemptWithHostExpectationEvaluation` (`transition-comparison.ts:99-137`).
   It runs only when all of: an evaluator is bound, the attempt carries a
   non-empty `expectedState`, the attempt **succeeded**, and the node is not
   `builtin.policy.expectation` (`transition-comparison.ts:109`). A thrown
   evaluator returns the attempt untouched (`:121-123`).
   - On the web side the evaluator is
     `web/domain/src/runtime/expectation/evaluate.ts:95`. Each condition is
     dispatched as a `web.dom.assert` action (`evaluate.ts:66, 155-159`), which
     is the polling, re-querying verb from §2 row 4.
   - The verdict rules are at `evaluate.ts:196-233`. Critically: **a condition
     that could not be judged is not a failure** (`:168-170`), and with nothing
     judged the verdict is an unconditional pass with
     `checkedConditionCount: 0` (`:199-207`). `passed: true` therefore means
     "nothing judged said otherwise", which the module documents explicitly at
     `evaluate.ts:38-45`.
3. **Transition comparison** — `compareAutomationStudioTransition`
   (`transition-comparison.ts:38`) produces the `status` that the failure
   classifier and the recovery ladder both read.

### 3.3 What happens on a mismatch

A rejected expectation **fails the attempt**
(`transition-comparison.ts:129-136`), which drops it into the same path as any
other failed attempt: the ladder at `graph-run.ts:253-277`. There is no separate
"expected state did not hold, wait and look again" branch, and no second
evaluation.

### 3.4 Where the *recorded* state checker comes from

`web/domain/src/runtime/expectation/click-landing.ts:56`
`webAutomationClickLandingExpectation` derives an `expectedState` from the
recording: the URL path a recorded click landed on, with a 5,000 ms wait
(`click-landing.ts:28`). It is attached to the proposed node at
`web/domain/src/web-panel-host.ts:144-145` and `:222-232`. That claim is what
the evaluator above checks on replay. It is a path substring test and nothing
else (`click-landing.ts:17-19`).

So the "recorded state checker" the user wants as the first fallback rung
already exists as a *post-condition* for one verb (click → landing path). It is
consulted once, after a successful attempt, and never again.

---

## 4. The exact conditions under which the model is consulted on a failure

### 4.1 Two separate gates, in two separate places

**Gate A — the in-run recovery ladder** (`runtime/executor/recovery-ladder.ts:5`)
builds candidates for a failed attempt and ranks them by priority:

| Priority | Kind | Offered when |
|---|---|---|
| 1 | `deterministic_path` | a `failed` edge exists **and** the retry, recovery and reroute budgets are all unexhausted (`recovery-ladder.ts:31`) |
| 2 | `approved_runtime_patch` | a `builtin.policy.recovery` node is in the Flow and its id is in `options.approvedRuntimePatchNodeIds` (`:41-52`) |
| 3 | `reroute` | as above, without the approval (`:46`) |
| 4 | `llm_diagnosis` | `options.allowLlmDiagnosis !== false` and the LLM budget is unexhausted (`:54-61`) |

But `graph-run.ts:260-273` only ever *executes* the `deterministic_path`
candidate:

```ts
const executableFailedEdge = recoveryDecision.selected?.kind === "deterministic_path" && recoveryDecision.selected.edgeId === failedEdge?.id ? failedEdge : null;
if (!executableFailedEdge) { ... return { status: "failed", ... } }
```

If the ladder selects `llm_diagnosis`, the run **stops** with the message
"Recovery ladder reached LLM diagnosis fallback before a configured provider was
invoked." (`recovery-ladder.ts:76`). The ladder cannot invoke a model; it is a
record of what was considered.

**Gate B — the post-run recovery path** is where the model is actually reached:
`runtime/service.ts:3192` / `:3247` call
`maybeAnnotateRunDetailWithRuntimeLlm` (`service.ts:2834`), which is
`runtime/recovery/annotation/annotate.ts:79`
`annotateAutomationStudioRunDetailWithRuntimeLlm`. Its four stages are
documented at `annotate.ts:12-28`.

### 4.2 Everything that suppresses Gate B, in order

| Order | Condition | Source |
|---|---|---|
| 1 | no `adaptationContext` (needs `projectId` **and** a canonical Flow) | `service.ts:3108`, `annotate.ts:83` |
| 2 | run did not fail | `annotate.ts:84` |
| 3 | `context.behavior.invokeLlm` false — training mode/settings; default `allowLlmIntervention: false` | `annotate.ts:97-110`, `service.ts:6026` |
| 4 | training budget exhausted (skipped for an explicit grant) | `annotate.ts:89, 97` |
| 5 | **deterministic-first refusal** | `annotate.ts:117-119` → `recovery/llm-invocation.ts:63` |
| 6 | provider resolution throws | `annotate.ts:138-154` |
| 7 | sanitized failure evidence unavailable | `annotate.ts:199-215` |

Step 5 is the substantive one. `decideAutomationStudioRuntimeLlmInvocation`
(`llm-invocation.ts:63`) refuses when:

- the training gate says a known recovery or a reroute must run first
  (`llm-invocation.ts:96-98`, gate at `training-modes.ts:291-292`), or
- the deterministic diagnosis says the model is not needed
  (`llm-invocation.ts:99-101`).

`recovery/deterministic-diagnosis.ts:126-135` decides:

```
deterministicRecoveryAvailable → "deterministic_recovery"   (model refused)
knownAdaptationAvailable       → "known_adaptation"         (model refused)
class ∈ MANUAL_INTERVENTION    → "manual_intervention"      (model refused)
otherwise                      → "model_required"
```

`AUTOMATION_STUDIO_MANUAL_INTERVENTION_FAILURE_CLASSES`
(`deterministic-diagnosis.ts:113-119`) is
`blocked_by_capability_or_policy`, `external_side_effect_denied`,
`auth_required`, `user_intervention_required`,
`graph_validation_or_unknown_node`.

`deterministicRecoveryAvailable` is
`failure.llmEligibility.knownRecoveryAvailable`
(`deterministic-diagnosis.ts:149`), which is
`deterministicRecoveryCandidates.length > 0`
(`adaptive-orchestrator.ts:92`), read off the attempt's own
`recoveryDecision.candidates` minus the `llm_diagnosis` one
(`adaptive-orchestrator.ts:191-193`). **So the mere presence of a `failed` edge
in the Flow is enough to refuse the model.** Note the ordering hazard: the ladder
offers `deterministic_path` only while the retry/recovery/reroute budgets hold
(`recovery-ladder.ts:31`), so once they are spent the candidate list empties and
the model becomes eligible — the deterministic rung disappearing is what unlocks
the model rung.

`knownAdaptationAvailable` counts only `validated` adaptations
(`KNOWN_ADAPTATION_STATUSES`, `adaptive-orchestrator.ts:207`); an `applied`
adaptation that failed again explicitly makes the model *more* eligible
(`adaptive-orchestrator.ts:255`).

### 4.3 Stages B, C, D and what suppresses each

- **Plan (B)** — `recovery/plan.ts:98`. Deterministic, no provider call. It
  refuses a patch request when the resolution is not `model_required`
  (`plan.ts:166-168`), when the diagnosis says the goal is unachievable
  (`plan.ts:174-176`), when the model asked for neither a patch nor exploration
  (`plan.ts:177-179`), or when the policy permits no patch kind for this
  candidate (`plan.ts:180-182`). Candidate → patch-kind map at
  `plan.ts:87-95`; policy refusals at `plan.ts:152-158`.
- **Exploration (C)** — `annotate.ts:270` runs only when
  `plan.explorationRequested && plan.patchRequest.request && !grantSkip &&
  provider && ports.llmEvidenceRuntime`.
- **Resolution (D)** — `annotate.ts:259`:
  `patchWillFollow = plan.patchRequest.request && !grantSkip && provider &&
  input.runtimeFlow && input.failedTraceAttempt &&
  input.context.behavior.createAdaptations`.
  `createAdaptations` defaults off (`allowAdaptationCreation: false`,
  `service.ts:6028`).

### 4.4 The three named blockers — confirmed / corrected

#### (a) "a granted run is forced to manual approval with side effects off" — **CONFIRMED, with a correction**

`runtime/service.ts:3054-3061`:

```ts
if (input.llmExecution) {
  const refusal = automationStudioRuntimeSessionGrantRefusal(input.llmExecution, input);
  if (refusal) { this.revokeLlmExecutionGrant?.(input.llmExecution.grantId); throw new Error(refusal); }
  input = { ...input, adaptiveMode: "manual_approval", authorizedExternalSideEffects: false };
}
```

Correction: the forcing at `:3060` is *normalization*, not a downgrade. The
refusal one line earlier (`runtime/llm/runtime-session-grant.ts:62-74`) already
rejects any granted run whose `adaptiveMode` is anything other than
`"manual_approval"`, whose `authorizedExternalSideEffects` is `true`, whose
`dryRunLlm` is `true`, which names any `authorizedDomainIds`, or which names a
`runId`. So a granted run **cannot be requested** with side effects on; line
3060 only fills in the undefined case. The practical effect is the same — a
granted run always carries `authorizedExternalSideEffects: false` — but the
mechanism is a hard refusal, not a silent downgrade, and a fix must change the
refusal list, not just line 3060.

Two consequences of `authorizedExternalSideEffects: false`:
- `preflightRuntimePatch` refuses any side-effecting patch when the policy sets
  `requireApprovalForExternalSideEffects` (`live-patch.ts:141`).
- It is also passed into `applyAutomationStudioRuntimeRecoveryPatches`
  (`annotate.ts:373`) and on into each patch input
  (`recovery/annotation/patches.ts:139`).

And a consequence of the `diagnose_and_adapt` purpose specifically: the
adaptation context is rewritten to `runRecovery: false`, `proposalMode:
"manual"`, `allowModifyActionTargets: true`
(`runtime-session-grant.ts:119-132`), and every target override is *proposed*,
never executed — `proposeAutomationStudioRuntimeTargetOverride`
(`patches.ts:142-145`), which returns
`verification: { status: "not_executed", reason: "proposal_only" }` and
`retryOriginalAction: false` (`live-patch.ts:209-211`).

#### (b) "the adaptive retry is skipped when a grant is present" — **CONFIRMED**

Two call sites, both guarded:

- `runtime/service.ts:3203` — routed (Router + Subflow) path:
  `const retry = adaptationContext && !input.llmExecution ? await this.retryRuntimeSessionAfterAutoAppliedPatch({...}) : null;`
- `runtime/service.ts:3257` — direct path:
  `const retry = input.llmExecution ? null : await this.retryRuntimeSessionAfterAutoAppliedPatch({...});`

Combined with (a), this means: **under `diagnose_and_adapt` no patch can execute
at all, and under `explore_and_adapt` a patch can execute and verify and still
never resume the run.** The only way the run-level retry fires is a
non-granted adaptive run — which requires the project's training settings to
have `allowLlmIntervention: true` (default `false`, `service.ts:6026`) and
`allowAdaptationCreation: true` (default `false`, `service.ts:6028`).

The retry itself, when it does fire: `service.ts:2953-3036`. It requires
`session.status === "failed"` (`:2961`), then reads the trial's resume verdict
back off the run-detail receipts
(`service/adaptations/adaptive-retry.ts:43-62`). It fails closed on every
ambiguity — `resume_decision_missing`, `resume_point_missing`,
`resume_point_subflow_mismatch`, `resume_point_completed`,
`resume_point_malformed` (`adaptive-retry.ts:80-90`), `resume_points_disagree`
(`:59`). The resume permission is `verdict.resumable`, decided at
`flow-change/resume.ts:29-41`: any failed check, any `unknown` check, a missing
resume point, or no passed evidence check all refuse.

#### (c) "a target override is refused at preflight" — **CONFIRMED; three distinct refusals**

`runtime/live-patch.ts:224-235` runs
`checkAutomationStudioRuntimeTargetOverride` before anything else and returns
`verification: { status: "not_executed", reason: "preflight_failed" }` on any
issue.

1. **Core's own classification refuses it** —
   `runtime/live-patch/target-override-check.ts:72`:
   `if (!targetOverrideServesFailure(input)) return refused({ status: "absent", reason: "failure_not_target_repairable" });`
   `targetOverrideServesFailure` (`:83-91`) requires
   `classifyAutomationStudioAdaptiveFailure(...).candidateKind === "action_target_override"`.
   Per `adaptive-orchestrator.ts:155-183`, that holds for `target_not_found`
   and `target_ambiguous` always, and for `unexpected_state` / `action_failed`
   **only when `subflowId` is present** (`adaptive-orchestrator.ts:169`). A
   top-level `action_failed` therefore maps to `recovery_path_or_reroute` and
   every target override for it is refused. Note also that the classify call
   here passes no `adaptations` (`target-override-check.ts:84-90`), so it is a
   pure failure-shape judgement.
2. **No domain check bound** — `target-override-check.ts:73`:
   `if (!input.validateTargetOverrideEvidence) return refused({ status: "absent", reason: "domain_check_unavailable" });`
   That function is supplied only when
   `ports.llmEvidenceRuntime.validateTargetOverrideEvidence` exists *and* there
   is a packet to judge against (`patches.ts:211-229`; `:227` returns
   `undefined` when there is no failure evidence).
3. **Policy** — `live-patch.ts:143`:
   `allowModifyActionTargets` false ⇒ issue. Default is `false`
   (`model/flows.ts:255`).

Plus a fourth, upstream of preflight: a target override whose kind is not in
`plan.allowedPatchKinds` never reaches the preflight at all
(`patches.ts:114-117`, receipt at `patches.ts:289-304`).

---

## 5. The failure taxonomy and what counts as recoverable

### 5.1 Core's categories — 16, closed

`contracts/failure/adaptive-class.ts:10-43`: `action_failed`,
`expected_state_missing`, `unexpected_state`, `timeout`,
`blocked_by_capability_or_policy`, `missing_router_or_subflow_target`,
`graph_validation_or_unknown_node`, `external_side_effect_denied`,
`ambiguous_or_unknown`, `target_not_found`, `target_ambiguous`,
`navigation_unexpected`, `output_not_observed`, `page_changed`,
`auth_required`, `user_intervention_required`.

### 5.2 The web domain's codes — 15, closed

`web/domain/src/runtime/failure/codes.ts:25-76` names them;
`codes.ts:123-139` binds each to a category, a `retryable` flag and a stage:

| Code | Category | `retryable` | Stage |
|---|---|---|---|
| `web.action.rejected` | `blocked_by_capability_or_policy` | false | execution |
| `web.target.not_found` | `target_not_found` | **true** | target_resolution |
| `web.target.ambiguous` | `target_ambiguous` | false | target_resolution |
| `web.validation.output_not_observed` | `output_not_observed` | **true** | verification |
| `web.validation.state_mismatch` | `unexpected_state` | false | verification |
| `web.navigation.unexpected` | `navigation_unexpected` | false | confirmation |
| `web.page.changed` | `page_changed` | **true** | execution |
| `web.action.timeout` | `timeout` | **true** | execution |
| `web.auth.required` | `auth_required` | false | confirmation |
| `web.intervention.required` | `user_intervention_required` | false | execution |
| `web.action.unsupported_type` | `blocked_by_capability_or_policy` | false | dispatch |
| `web.action.not_implemented` | `blocked_by_capability_or_policy` | false | dispatch |
| `web.action.invalid_parameter` | `graph_validation_or_unknown_node` | false | dispatch |
| `web.action.failed` | `action_failed` | **true** | execution |
| `web.action.unknown` | `ambiguous_or_unknown` | false | execution |

Five are retryable: `target_not_found`, `output_not_observed`, `page_changed`,
`timeout`, `action_failed`. Classification from an outcome is
`web/domain/src/runtime/failure/classify.ts:74-102`.

Core-side codes also exist, outside that set:
`output_dispatch.timed_out` / `output_dispatch.rejected` /
`output_confirmation.not_received` (`runtime/io-policy.ts:139-149`),
`output_dispatch.missing_output_id` / `output_dispatch.output_not_registered`
(`io-policy.ts:159-167`), `record_output.*`
(`node-execution.ts:264`, `runtime/executor/record-capture.ts:190-218`),
`core.policy.expectation_rejected` (`nodes/policy/expectation.ts:14-19`).

### 5.3 What "recoverable" means in practice — three different answers

1. **`retryable` on the record is inert.** A grep of
   `packages/fluxiq/src/programs/automation-studio` for `.retryable` finds only
   writes, a parse guard, the LLM provider contract
   (`runtime/llm/provider-contract.ts:129, 151, 156`), the Flow-bootstrap
   failure type (`runtime/flow-bootstrap/generation-failure.ts`), and one read
   that copies it into the model's context
   (`runtime/recovery/context.ts:308`). **No runtime decision reads it.** Its
   only enforced meaning is a consistency rule in the parser: six categories may
   never be marked retryable (`contracts/failure/parse-record.ts:17-24`), and a
   record that contradicts that is dropped whole (`parse-record.ts:62`).
2. **Model-recoverable** = `resolution === "model_required"` — i.e. not one of
   the five manual-intervention classes
   (`deterministic-diagnosis.ts:113-119`), with no deterministic candidate and
   no validated adaptation matching.
3. **Patch-recoverable** = the candidate kind maps to at least one patch kind
   the policy permits (`plan.ts:87-95` × `plan.ts:152-158`):
   - `expected_state_missing`, `timeout`, `output_not_observed` →
     `expectation_wait_retry` → `temporary_wait_retry`
   - `target_not_found`, `target_ambiguous` → `action_target_override` →
     `temporary_target_override`, `temporary_wait_retry`
   - `navigation_unexpected`, `page_changed` → `recovery_path_or_reroute` →
     `temporary_reroute`, `temporary_recovery_subflow_call`,
     `temporary_action_sequence`
   - `unexpected_state`, `action_failed` → `action_target_override` inside a
     Subflow, `recovery_path_or_reroute` otherwise
     (`adaptive-orchestrator.ts:169`)
   - `missing_router_or_subflow_target` → `temporary_reroute`
   - `graph_validation_or_unknown_node` → `temporary_recovery_subflow_call`
     (but the class is manual-intervention, so it never gets there)
   - the five manual classes + `ambiguous_or_unknown` → `diagnosis_only` → no
     patch kinds at all (`plan.ts:94`)

   `ambiguous_or_unknown` is worth flagging: it is *not* in the
   manual-intervention set, so it reaches `model_required`, but its candidate
   kind is `diagnosis_only` (`adaptive-orchestrator.ts:178-179`), so the plan
   allows no patch and the run stops after one diagnosis call.

---

## The current failure-handling sequence, in order

For one node that fails on a web action:

1. The node implementation returns success plus a `policy.output.dispatch`
   effect (`web/domain/src/output-nodes/native-runtime.ts:76-83`).
2. `dispatchAutomationStudioEffects` calls the runtime dispatcher
   (`node-execution.ts:190`), which dispatches the command to the extension
   (`io-policy.ts:88`, `web/domain/src/runtime/adapter.ts:91`).
3. The extension resolves the target, acts, and validates its own
   post-condition; on failure it names a code from the closed set
   (`web/domain/src/runtime/failure/codes.ts`).
4. The adapter builds the failure record and attaches the sanitized page packet
   (`adapter.ts:106, 118`).
5. The dispatcher's `failed` status overwrites the node's optimistic success
   (`node-execution.ts:197-208`). **No second dispatch is attempted.**
6. `after_action` snapshot + state diff are captured and stored on the attempt
   (`host-state.ts:22-54`). The diff decides nothing.
7. The expected-state evaluation is **skipped**, because the attempt is not
   `succeeded` (`transition-comparison.ts:109`). The recorded state checker is
   never consulted on a failure.
8. `compareAutomationStudioTransition` produces a `transitionComparison`
   whose status comes from the failure record's category
   (`transition-comparison.ts:169-170`).
9. `graph-run.ts:253` — the attempt is failed. `chooseAutomationStudioEdge`
   looks for an edge on the failed route (`:254`).
10. `chooseAutomationStudioRecovery` ranks candidates
    (`recovery-ladder.ts:5`) and the decision is stamped onto the attempt
    (`graph-run.ts:256-259`).
11. If the selected candidate is `deterministic_path` and matches the failed
    edge, the run walks that edge and continues (`graph-run.ts:260, 274-277`).
    **Otherwise the run ends, failed** (`graph-run.ts:261-273`), with the
    message from `failureMessageForRecoveryStop` (`recovery-ladder.ts:75-79`).
12. Back in `runRuntimeSession`, the session is written as failed
    (`service.ts:3236-3244`).
13. `maybeAnnotateRunDetailWithRuntimeLlm` runs — but only with an
    `adaptationContext` (`service.ts:3245`).
14. Gate: `invokeLlm` and budget (`annotate.ts:97`); then deterministic-first
    (`annotate.ts:117-119` → `llm-invocation.ts:63`). Most runs stop here,
    because `allowLlmIntervention` defaults to `false`.
15. Stage A: provider resolved, failure evidence captured, one
    `runtime_diagnosis` call (`annotate.ts:230-250`).
16. Stage B: the deterministic plan (`annotate.ts:252`, `plan.ts:98`).
17. Stage C: bounded exploration, only if the plan asked and a patch will follow
    (`annotate.ts:270-308`).
18. Stage D: one `runtime_patch` call (`annotate.ts:317-344`); each patch is
    preflighted and then executed as a trial, or proposed
    (`patches.ts:142-145`).
19. The trial re-runs the patched Flow from the changed node
    (`live-patch.ts:252-262`) and the verdict decides `restoredExpectedState`
    and `retryOriginalAction` (`live-patch.ts:263-265`), plus `resumable` /
    `resumeFrom` (`flow-change/verdict.ts:112-122`).
20. `retryRuntimeSessionAfterAutoAppliedPatch` resumes the run from
    `resume.nodeId` — **unless a grant is present** (`service.ts:3203, 3257`).
21. Whatever happened, `verifyAutomationStudioRuntimeSessionResult` judges the
    finished run's result (`service.ts:3213`, `:3267`).

Counting provider calls: the cheapest failure costs zero, and a full recovery
costs one diagnosis + N exploration + one patch. Counting re-executions of the
failed node: **zero**, until step 19's trial, which is the first and only time
the failed node is taken again — and that requires a model-authored change
first.

---

## Where a defensive ladder would attach

The user's direction — on repeated failure, first fall back to the recorded
state checker, and only then escalate to the model — needs rungs between step 8
and step 9 above. Concretely:

1. **`runtime/executor/node-execution.ts:159` `finishAttempt`** — the one place
   every dispatch path converges after the action and before the attempt is
   returned. Today it calls `enrichAttemptWithHostState` then
   `attemptWithHostExpectationEvaluation`. A cheap in-node rung (re-check, wait,
   re-dispatch) belongs here, because both the `before_action` ref and the
   resolved `executionNode` are still in scope and nothing above has committed
   to a route yet.

2. **`runtime/executor/transition-comparison.ts:109`** — the guard
   `attempt.status !== "succeeded"` is precisely what stops the recorded state
   checker from ever being consulted on a failure. Relaxing it (for a failed
   attempt whose failure record is `retryable`, say) is the smallest change that
   makes the recorded state claim the first fallback rung: a click that reports
   `web.action.failed` but whose recorded landing path *does* hold is a false
   negative the checker would catch for free, and the checker already re-queries
   and polls (`web/apps/extension/src/content/action-runtime/assertion-evaluation.ts:74`).

3. **`runtime/executor/graph-run.ts:253-277`** — the failed branch. This is the
   only place a Flow-level ladder can re-enter the same node: `currentNode` is
   still bound and `continue` would re-execute it. Adding a rung here needs a
   per-node attempt counter, which `recoveryBudgetState`
   (`runtime/executor/recovery-budget.ts:7`) already computes as
   `failedAttemptsForAction` — today only to *remove* a candidate. Turning that
   counter from a cap into an allowance is the smallest correct change.

4. **`runtime/executor/recovery-ladder.ts:29-61`** — the candidate list itself.
   A new rung (`state_recheck`, `wait_and_retake`) inserted at priority 0 or 1.5
   would be ranked and recorded in the same `recoveryDecision` vocabulary every
   reader already understands, and would automatically appear in
   `deterministicRecoveryCandidates`
   (`adaptive-orchestrator.ts:191-193`), which is what keeps the model refused
   while a cheaper rung remains.
   Caution: that same coupling means a new deterministic rung, while it is on
   offer, suppresses the model entirely — so the rung must be *consumed* (and
   drop off the candidate list) before escalation is possible, exactly as
   `deterministic_path` does when its budget runs out
   (`recovery-ladder.ts:31`).

5. **`runtime/executor/graph-run.ts:260`** — `executableFailedEdge` is the
   bottleneck that makes every non-`deterministic_path` candidate a dead stop. A
   ladder that can actually *do* more than one thing has to widen this branch.

6. **`runtime/service.ts:3203` and `:3257`** — the `!input.llmExecution` guards.
   These are the two lines that stop a verified repair resuming a granted run.

7. **`runtime/llm/runtime-session-grant.ts:67-72`** — the grant refusal list,
   which is the real reason a granted run can never carry side-effect
   authorization. (Owned by another worker; noted, not touched.)

8. **`runtime/live-patch/target-override-check.ts:83-91`** — widening
   `targetOverrideServesFailure` (or passing the Subflow context so
   `action_failed` maps to `action_target_override` more often) is what unblocks
   target overrides for top-level `action_failed`.

9. **`web/domain/src/runtime/expectation/evaluate.ts:199-207`** — if the ladder
   is to *trust* a recorded state check as a rung, this unconditional pass with
   `checkedConditionCount: 0` must be read as "unknown", not "held". The module
   already documents the count as the only unknown signal
   (`evaluate.ts:29-45`), and `flow-change/resume.ts:36` already treats unknown
   as not-resumable — the same discipline has to apply to a new rung.

---

## Commands run and observed results

```
pnpm exec vitest run \
  src/programs/automation-studio/runtime/executor/tests/recovery-ladder.test.ts \
  src/programs/automation-studio/runtime/service/adaptations/tests/adaptive-retry.test.ts
```
(run in `F:\!FluxIQ\packages\fluxiq`)

Observed:

```
 ✓ src/programs/automation-studio/runtime/service/adaptations/tests/adaptive-retry.test.ts (10 tests) 5ms
 ✓ src/programs/automation-studio/runtime/executor/tests/recovery-ladder.test.ts (5 tests) 10ms
 Test Files  2 passed (2)
      Tests  15 passed (15)
   Duration  3.38s
```

No live provider calls were made. No files were modified.

## Not verified

- I did not run a live Flow or observe a real failure end to end. Everything
  above is read from source and from the two focused unit suites named.
- I did not check the Studio UI or API handlers for a separate retry affordance;
  the brief scoped this to the runtime.
- `runtime/llm/**` is owned by another worker. I read
  `runtime/llm/runtime-session-grant.ts` to confirm blocker (a) and changed
  nothing there; I did not audit the rest of that directory.
- I did not measure how often each suppression actually fires in the Lab corpus.
- `runtime/result-verification/**` (the post-run "did this run answer the
  request" judgement) was only skimmed; it sits after every path above and does
  not participate in failure handling.

## Open questions or contradictions found

1. **`maxRetriesPerAction` is named as an allowance and implemented as a cap.**
   `model/flows.ts:235` sets it to 1 beside `maxRecoveryAttemptsPerSubflow: 2`
   and `maxReroutesPerRun: 2`, reading as "one retry per action". It grants
   nothing. Anyone designing the ladder against the setting name will build the
   wrong thing.
2. **`builtin.timing.retry` is a live, published node that does nothing.** It
   appears in the node catalogue with a backoff selector and a jitter parameter
   and returns them as outputs. A model authoring a Flow can place it and
   believe it has added resilience.
3. **`temporary_wait_retry` writes `retryCount` into a Flow and nothing reads
   it.** The patch kind is offered for `expected_state_missing`, `timeout` and
   `output_not_observed` (`plan.ts:88`) — the three classes most likely to be
   transient — and half of what it writes is inert.
4. **The state diff is captured on every web attempt and used by nothing.**
   `webAutomationStateDiff` (`web/domain/src/runtime/host-runtime.ts:165`) costs
   a gateway round trip per node and only ever becomes model context.
5. **The deterministic-first rule couples "a `failed` edge exists" to "the model
   is refused"** (`adaptive-orchestrator.ts:92` via
   `recovery-ladder.ts:31-39`). A Flow that wires a `failed` edge to an End node
   — which is what a model-authored Flow tends to do — refuses every model
   escalation until the reroute budget is spent.
6. **Under either adapting grant, a verified repair can never resume the run.**
   `diagnose_and_adapt` proposes only; `explore_and_adapt` executes but is
   skipped by `service.ts:3203/3257`. The resume path is reachable only from a
   non-granted adaptive run, which needs two settings that both default off.
   I could not tell from source whether that is deliberate (a grant is one
   authorized action, not an authorized continuation) or a gap.
7. **`ambiguous_or_unknown` reaches the model and then can do nothing**, because
   its candidate kind is `diagnosis_only`. A failure nobody could classify buys
   one provider call and no possible repair.
