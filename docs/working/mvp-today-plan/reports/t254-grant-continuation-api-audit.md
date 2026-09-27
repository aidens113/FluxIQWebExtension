# t254 — Grant continuation API audit

## Finding

No authority-preserving continuation or rebind API exists.

`AutomationStudioLlmExecutionGrantService` exposes preflight, issue,
hold-for-run, inspect, resolve, revoke/cancel, actor/session revocation, count,
and close operations. Its stored binding can only be established at issue.
Every later inspect, resolve, call, secret reveal, and call commit re-reads the
authoritative Flow binding and requires exact equality with those immutable
stored fields. There is no method that can advance `executionDigest` or
`settingsRevision` after an authorized mutation.

Automation Studio's host wiring exposes only provider resolution, revoke, and
close to `AutomationStudioService`. The bootstrap apply transaction knows the
adaptation's trusted before/after digests but has no grant hook. The runtime
reauthor path refreshes the request binding before generation, then applies the
adaptation; it cannot update the underlying stored grant afterward.

That absence exactly explains t246: deterministic Subflow replay succeeds,
then the later verification resolve reaches the grant service after the Flow
binding moved and receives `llm.execution_grant_no_longer_valid`.

## Existing trusted facts at apply

Core already has the proof material needed for a narrow continuation:

- the adaptation record owns `projectId`, `flowId`, `adaptationId`, mode,
  `baseDependencyDigest`, and `baseSettingsRevision`;
- apply is allowed only from `validated` status;
- apply re-checks the current dependency digest against the base digest;
- apply revalidates the Core-normalized topology and permission answer;
- the apply transaction runs under the per-Flow bootstrap adaptation lock;
- after graph/router/parent writes it computes and stores
  `application.appliedDependencyDigest` and persists `status: applied`;
- runtime reauthor owns the exact execution grant that generated this
  adaptation and the apply call that follows.

No public caller-supplied digest needs to be trusted.

## Minimal owner and API

The grant store must own the state transition because only
`AutomationStudioLlmExecutionGrantService` owns remaining uses, committed
tokens/cost, reveal authorizations, the run lease, in-flight state, and the
stored binding.

Add one narrowly named method, for example:

```text
continueAfterAppliedFlowAdaptation({
  grantId, actorUserId, actorSessionId, projectId, flowId, purpose,
  expectedPreviousBinding,
  appliedBinding,
  adaptationId
})
```

This is an internal host capability, not an API/gateway operation and not a
way for a client to request a new digest. The Automation Studio service must
derive both bindings from trusted state:

- `expectedPreviousBinding` from the applied adaptation's base digest/settings
  revision;
- `appliedBinding` from `getLlmExecutionBinding` after durable apply, with its
  digest cross-checked against `application.appliedDependencyDigest`.

The grant method should also re-read its own authoritative binding resolver
and require it to equal `appliedBinding`; the passed value is a concurrency
expectation, not authority.

Wire this as a fourth host function beside resolve/revoke/close in
`AutomationStudioServiceOptions` and `bindLlmExecutionProvider`, then bind it
to the same `AutomationStudioLlmExecutionGrantService` instance in
`programs/_shared/runtime.ts`. Only the runtime refuted-result apply path should
invoke it.

## Ordering and atomicity

The Flow store and in-memory grant store cannot share one database transaction.
The safe linear order is:

1. validate the old binding and adaptation;
2. durably apply and persist the adaptation;
3. while still serialized for that Flow, re-read the authoritative new
   binding and verify the applied digest;
4. continue the exact held grant from the exact base binding to that exact new
   binding;
5. release the Flow lock;
6. perform deterministic replay;
7. resolve the continued grant for recursive result verification.

The strongest design refactors the locked bootstrap-review implementation so
the runtime-only apply-and-continue operation executes step 3/4 before the
bootstrap lock is released. It should not add a client-settable continuation
field to the public review request.

Inside the grant method, asynchronous identity/key/current-binding checks must
be followed by a second check that the same stored grant is still present,
claimed, held, unexpired, and has no call in flight. Updating digest and
settings revision is then one synchronous store mutation.

If continuation fails after durable apply, do not pretend apply failed and do
not attempt a partial rollback. Extend apply is intentionally not revertible,
and the bootstrap transaction does not provide a cross-store rollback for a
grant. Keep the adaptation recorded as applied, fail the continuation closed,
skip the post-replay provider call, and persist the typed refusal. This is a
safe degraded result and preserves the truth of durable state.

## State that must not change

Continuation changes only `executionDigest` and `settingsRevision`. It must
not:

- mint a grant or change `grantId`;
- add/reset `remainingUses`;
- reset committed token or cost totals;
- mint reveal authorizations;
- extend issue TTL or the claimed run deadline;
- change actor/session, project/Flow, purpose, provider/model, key revision,
  token/cost/call limits, retry count, or permitted consequences;
- release an in-flight call or make concurrent calls legal.

The deterministic replay continues to use zero provider calls. The next and
only new spend is the later recursive `loop_verification`, charged to the same
grant's existing allowance.

## Refusal invariants

Continuation must refuse (and follow the existing typed refusal/revocation
policy) when:

- the grant is absent, revoked, exhausted, expired, available-but-not-held, or
  not the claimed grant for this run;
- a call is in flight;
- actor/session, project, Flow, or purpose differs;
- the stored old binding does not exactly match the adaptation base binding;
- the current authoritative binding does not exactly match the applied binding
  and stored applied digest;
- the adaptation is not `applied`, belongs to another Flow, or was not the one
  this runtime reauthor operation generated/applied;
- identity is no longer valid;
- the key is missing, disabled, rotated, wrong-kind, or incompatible with the
  grant's provider/model;
- unrelated settings/Flow drift occurred before or after the authorized apply.

Ordinary drift must remain `llm.execution_grant_no_longer_valid`; continuation
is a proof-carrying transition for one applied adaptation, not relaxed binding
validation.

## Exact implementation and test surface

Likely implementation files:

- `runtime/llm/execution/grants.ts` — owned stored-state transition;
- `runtime/llm/execution/index.ts` or a focused continuation contract file if
  the input/result type is exported;
- `runtime/service.ts` — host hook plus runtime apply-and-continue ordering;
- `programs/_shared/runtime.ts` — production binding to the grant instance.

Focused tests:

- new `runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts`
  for success, unchanged allowance/accounting/deadline, and every refusal
  invariant above;
- existing `execution-grants.test.ts` and `execution-grant-hold.test.ts` to
  prove generic drift and lease/re-resolve rules remain unchanged;
- bootstrap adaptation tests for no continuation before successful apply, one
  continuation after durable apply, and safe applied-state retention if the
  continuation hook refuses;
- `runtime/tests/refuted-result/tests/reauthor-service.test.ts` as the decisive
  real composition: two negative judges, authoring call, zero-provider replay,
  fourth verification, confirmed final result, then terminal grant revoke;
- `runtime/tests/service-adaptation/tests/llm-grants.test.ts` for unchanged
  run-boundary revoke behavior.

## Scope

Read only grant service/contracts/state, binding validation, bootstrap apply,
runtime service wiring, and production host composition. No continuation API
was found. No source, test, or shared-document edits were made. No live,
provider, browser, Lab, build, or commit action was performed.
