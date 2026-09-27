# t257 — Grant continuation runtime wiring plan

Status: **Ready for implementation, conditional on t255 package validation**

## Evidence boundary

This plan is based on t251–t254, the t255 implementation/API details visible in the Core working tree and supplied by its owner, the Automation Studio service's generation/review/apply locks and host hooks, `programs/_shared/runtime.ts`, and the t246 real composition test. No run artifact, browser, provider, or live work was inspected or performed.

t255 adds this grant-owned primitive:

```ts
await grants.continueAfterAppliedFlowAdaptation({
  grantId,
  actorUserId,
  actorSessionId,
  projectId,
  flowId,
  purpose,
  expectedPreviousBinding: { executionDigest, settingsRevision },
  appliedBinding: { executionDigest, settingsRevision }
});
```

It returns sanitized `AutomationStudioLlmExecutionGrantMetadata`. It requires the exact grant to be held, claimed, unexpired, usable, and without an in-flight call; checks the complete scope, actor session, and exact key; compares the stored binding with `expectedPreviousBinding` and the authoritative current binding with `appliedBinding`; then changes only the stored execution digest and settings revision. Grant identity, purpose, authority, allowance, accounting, deadlines/run lease, provider/model, and reveal authorizations remain unchanged. Its focused 42-test result was reported passing, but its owner was still correcting one exact-optional TypeScript assignment when this plan was written. Package validation is therefore an implementation prerequisite, not a result claimed here.

## Required ownership and files

### 1. `runtime/llm/execution/grants.ts` and its t255 contract files

Keep `continueAfterAppliedFlowAdaptation` as the sole binding-advance authority. The runtime service must not mutate grant state or synthesize replacement grants. Retain t255's refusal behavior: every mismatch closes the grant and returns only a typed refusal; it must never bless a caller-supplied binding.

No additional grant-layer method is needed. t256 may intentionally remove this capability from the LLM barrel, so the implementation task must not require or restore a public barrel export. First confirm the t255/t256 security shape, exact-optional correction, focused tests, and package checks.

### 2. `runtime/service.ts` — internal generation ownership

Split the existing public generation entry point into a thin public wrapper and a private implementation with a non-wire lifecycle argument, for example:

```ts
generateFlowBootstrapAdaptation(input) {
  return this.generateFlowBootstrapAdaptationInternal(input, "standalone");
}
```

The refuted-result reauthor path calls the private implementation with `"runtime_owned"`. This flag must not be added to the public request schema or accepted from an untrusted caller.

Preserve today's standalone cleanup rules, including the existing `explore_and_adapt` ownership exception. A runtime-owned nested `build_and_adapt` generation must not revoke the run-owned grant in the generation `finally`. The outer `runRuntimeSession` `finally` remains the terminal revoker, including all success and failure paths. Nested work never creates a second grant and never resets allowance or accounting.

### 3. `runtime/service.ts` — host continuation hook

Add an internal host hook to `AutomationStudioServiceOptions`, its private field, constructor assignment, and `bindLlmExecutionProvider` arguments. A suitable structural shape is:

```ts
continueLlmExecutionGrantAfterAppliedFlowAdaptation?: (
  input: {
    grantId: string;
    actorUserId: string;
    actorSessionId: string;
    projectId: string;
    flowId: string;
    purpose: AutomationStudioLlmExecutionGrantPurpose;
    expectedPreviousBinding: AutomationStudioLlmExecutionBinding;
    appliedBinding: AutomationStudioLlmExecutionBinding;
  }
) => Promise<AutomationStudioLlmExecutionGrantMetadata>;
```

Keep this as a private host/service seam, not a public LLM barrel capability. Reuse already-public metadata/binding types where appropriate, but define the narrow continuation input at the host boundary or import it only from an explicitly internal module if t256 permits that dependency. Absence of the hook is a closed configuration failure on this runtime-owned path; it must not fall back to replay with a stale grant.

### 4. `programs/_shared/runtime.ts` — production binding

Extend the existing `automationStudio.bindLlmExecutionProvider(...)` binding with a callback that forwards the exact input to:

```ts
grants.continueAfterAppliedFlowAdaptation(input)
```

Do not issue a replacement grant, alter the input scope, catch-and-retry a refusal, or translate it into an open-ended provider error. Existing resolve, revoke, and close callbacks remain unchanged.

### 5. `runtime/service.ts` — apply and continue under the Flow lock

Introduce a private runtime-only apply operation rather than adding grant fields to the public review request. It must acquire the same `withBootstrapAdaptationLock(projectId, flowId)` used by `reviewFlowBootstrapAdaptation`; do not nest that non-reentrant lock by calling the public review method from inside it.

Share/extract the locked review/apply body as needed. Approval may remain the preceding explicit review action. The runtime apply operation must perform this order while holding the Flow lock:

1. Load the exact proposed adaptation and validate project, Flow, status, actor permission, base dependency digest/settings revision, topology, and plan.
2. Capture the grant's expected previous binding from the already admitted run input. It must equal the adaptation base binding; do not refresh it from post-apply state.
3. Call the existing durable `applyFlowBootstrapAdaptation` logic. Complete graph/subflow/router/parent persistence, the `applied` adaptation record and application digest, and the change-feed record before attempting continuation.
4. Read `getLlmExecutionBinding(projectId, flowId)` after the durable apply, still under the Flow lock.
5. Require the authoritative binding to agree with the application record (`appliedDependencyDigest`/new settings revision) and the exact target Flow. A mismatch is a closed post-apply failure, not a reason to propose a guessed binding.
6. Invoke the host continuation hook once with the original grant/scope/purpose, the exact pre-apply binding, and that authoritative applied binding.
7. Only after continuation succeeds, return a replay-ready result and release the Flow lock.

The continuation call is asynchronous, so another grant action can race outside the Flow lock. t255's second identity/state check after its awaits is the authority for rejecting that race. The Flow lock serializes Flow mutations; it does not replace the grant CAS.

Do not place continuation inside `applyFlowBootstrapAdaptation`'s rollback `try/catch`. Once its durable apply completes, an extend adaptation cannot safely be represented as rolled back merely because grant continuation failed.

### 6. Refuted-result reauthor result contract — truthful post-apply failure

The current generate/approve/apply callback chain treats a rejected apply callback as `applied: false`. That becomes false after step 3 above. Extend the internal reauthor apply/result seam so it can distinguish:

- `applied: false`: durable adaptation did not complete;
- `applied: true, replayReady: true`: durable apply and exact grant continuation both completed;
- `applied: true, replayReady: false`: Flow is durably adapted, but authoritative binding validation or grant continuation refused.

Persist only closed, structured metadata for the third state: adaptation id, `applied: true`, `replayReady: false`, phase `grant_continuation`, and the sanitized refusal code/category. Do not persist exception text, provider text, credentials, bindings/digests, or grant metadata. Preserve the applied adaptation/application and change-feed facts. Do not attempt an unsafe rollback, issue another grant, retry provider work, or claim the adaptation failed to apply.

Update the `automationStudioRefutedResultFlowWasReauthored`/equivalent success predicate to require both `applied === true` and `replayReady === true`. A post-apply continuation refusal must therefore end with the structured reauthor failure and proceed directly to outer cleanup; it must never enter replay or recursive verification.

If changing the general reauthor contract would affect other consumers, keep the new three-state result internal to Automation Studio and map legacy callback success to `replayReady: true`. Do not weaken the existing one-repair-per-run marker.

## Exact successful control flow

1. The admitted run holds and claims its original `build_and_adapt` grant.
2. Initial result verification consumes its existing verification calls and returns `refuted`.
3. Nested extend generation uses the same run-owned grant. Its two verification calls precede reauthor provider work; nested generation does not revoke the grant.
4. The proposed adaptation is explicitly approved.
5. Under the Flow adaptation lock, the service durably applies it and records the applied adaptation/change feed.
6. Still under that lock, the service reads and checks the authoritative new execution binding.
7. The host invokes t255's exact-grant continuation CAS. No allowance, accounting, authority, identity, or deadline is reset.
8. The service releases the Flow lock only after continuation succeeds.
9. `rerunAfterRepair({ from: "start", subflowId })` performs deterministic replay. This replay makes **zero provider calls** and preserves the selected Subflow; a present invalid Subflow must still refuse rather than fall back to the parent Flow.
10. Recursive result verification resolves the same continued grant and makes the fourth provider call expected by t240. That call is not part of deterministic replay.
11. The one-repair marker prevents a second reauthor cycle. The outer run's `finally` revokes the exact grant once; existing revoke idempotence covers already-closed failure paths.

## Failure invariants

- Generation/approval/apply failure before durable apply: existing structured failure, no replay, outer revoke.
- Durable apply followed by binding mismatch, missing hook, or continuation refusal: retain the applied Flow and applied/change-feed records; persist `applied: true, replayReady: false` plus only a closed code/category; no replay or recursive judge; outer revoke.
- Continuation success followed by deterministic replay failure: preserve the continued grant until normal outer cleanup, record the existing structured rerun failure, and make no provider call for replay.
- Continuation success followed by recursive verification failure: preserve existing typed verification outcome/accounting; final outer revoke still runs.
- No path may replace the grant, replenish uses/tokens/cost, extend a deadline, change purpose/scope/actor/key/model/consequences, expose a digest, or convert a present invalid Subflow into parent execution.

## Focused tests

### Grant primitive prerequisite

- Run the t255 continuation suite. It must cover exact success/preservation, unheld/unclaimed/in-flight/expired/unusable refusal, scope mismatch, stale previous binding, non-authoritative applied binding, invalid session/key, and ordinary untrusted drift.
- Run the Core package check before consuming the API; t257 does not inherit an uncompleted t255 package result.

### Service wiring and lifecycle

- Extend `runtime/tests/refuted-result/tests/reauthor-service.test.ts` (t240): keep the four-task expectation unchanged. Assert two initial `loop_verification` calls, one reauthor/evidence call, zero-provider deterministic replay, then the fourth recursive `loop_verification`; successful approve/apply; selected Subflow replay; and final revoke.
- Add the same real-composition case with continuation refusal after durable apply. Assert the Flow/adaptation remains applied, metadata says `applied: true` and `replayReady: false` with only the closed refusal code/category, no replay, no fourth provider call, and final revoke.
- Add a missing-hook case with the same closed post-apply behavior.
- Add a binding/application mismatch case proving caller-supplied or stale binding cannot be blessed.
- In bootstrap/accounting grant tests, prove standalone generation keeps its existing revoke behavior while runtime-owned nested generation does not revoke early and does not reset accounting/allowance.
- In run-outcome/repair-rerun tests, retain present/absent/invalid `subflowId` coverage, deterministic zero-provider replay, recursive verification after replay, and the one-repair limit.
- In service adaptation tests, prove continuation occurs after durable persistence but before lock release. A deferred continuation callback plus a competing review/apply operation can establish ordering without provider work.

Suggested narrow commands (use the exact package scripts/filters already used by the neighboring suites):

```text
vitest run runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts
vitest run runtime/tests/refuted-result/tests/reauthor-service.test.ts
vitest run runtime/result-verification/tests/run-outcome.test.ts
vitest run runtime/tests/service-repair-rerun
vitest run runtime/tests/service-adaptation runtime/tests/service-bootstrap
pnpm check
pnpm build
```

Run the focused suites first, then Core package/root check and build, and `git diff --check`. This plan performs no validation and makes no source claim beyond the inspected t255 focused-test report.

## Implementation boundary

This is an internal, nonbreaking runtime/host wiring change. Public grant issuance, public adaptation review payloads, provider accounting, and deterministic replay semantics remain unchanged. The only externally observable addition is more truthful structured failure metadata when the Flow was durably applied but the exact run grant could not be continued; that shape requires compatibility review if it is exported rather than kept in Automation Studio's internal result metadata.
