# t256 — Grant continuation security review

Status: **Changes required**

## Verdict

The in-progress `continueAfterAppliedFlowAdaptation` transition has the right
core shape: it requires a held, claimed, live grant with remaining uses and no
call in flight; checks exact scope; resolves identity, key, and the authoritative
current binding; rechecks the same stored object and lifecycle state after the
await; compares stored-old and authoritative-new bindings; and then mutates only
`executionDigest` and `settingsRevision` synchronously.

It is not ready to accept yet. No t255 report or continuation test was present
at review time, and the current method has two fail-closed gaps plus a public-
surface concern.

## Required CAS and security invariants

- Before any await: require the exact stored grant, `state === "claimed"`,
  `heldForRun === true`, unexpired run lease, `remainingUses > 0`, no call in
  flight, and exact grant id/actor/session/project/Flow/purpose scope.
- Validate both supplied bindings as exact digest/revision pairs before use.
- Resolve the actor session, key summary, and authoritative current Flow
  binding without mutating grant state.
- After all awaits and immediately before mutation, reacquire by grant id and
  require object identity with the original record; repeat claimed, held,
  unexpired, remaining-use, no-in-flight, and stored-old-binding checks.
- Require the live session user to equal the stored actor; require the key id,
  enabled state, `llm` kind, revision, provider/model, and Flow scope to match
  the stored grant.
- Require stored binding to equal `expectedPreviousBinding` and authoritative
  current binding to equal `appliedBinding`. The caller must derive both from
  trusted applied-adaptation state while the per-Flow apply lock is still held;
  neither binding may come from an API request.
- Perform no await between the final recheck and the two synchronous binding
  assignments. Ordinary later drift must still be rejected by the existing
  per-resolve/per-call validation.
- On every malformed input, invalid purpose, dependency throw, compatibility
  failure, state race, identity/key failure, or binding mismatch, make no
  binding change and follow one typed fail-closed revocation policy.
- On success, preserve the same stored object and change only
  `executionDigest` and `settingsRevision`.

## State-preservation requirement

A focused test must compare the stored record before and after continuation and
prove byte-for-state preservation of every other field, including object/array
or timer identity where applicable:

- grant id, actor/session, project/Flow, purpose;
- key id/revision, provider/model, permitted consequences;
- token limits, per-call and total cost limits, total token limit, call limit,
  retry count, and timeout;
- `remainingUses`, committed tokens, and committed estimated cost;
- `expiresAtMs`, `authorizationsExpireAtMs`, `runExpiresAtMs`, and the existing
  expiry timer;
- `heldForRun`, claimed state, call-in-flight state, in-flight authorization and
  abort controller;
- reveal-authorization array identity, contents, and count.

The current implementation appears to satisfy this mechanically because its
only success writes are the two binding assignments. It is not yet proved by a
test.

## Gaps in the current hunk

1. `parseAutomationStudioLlmExecutionGrantPurpose`, both `executionBinding`
   parses, the asynchronous dependency calls, and `validateKeyCompatibility`
   are outside a catch that revokes and converts failure consistently. An
   invalid purpose, malformed binding, binding-resolver throw, or provider/model
   compatibility failure can therefore leave the grant active after a failed
   continuation. Wrap the whole transition after grant lookup in the same
   revoke-on-failure discipline used by `resolve`, preserving typed refusal
   codes where applicable.
2. Key-summary validation does not explicitly assert `key.id === grant.keyId`.
   The key service normally returns the requested record, but this security
   boundary should require exact identity just as revealed-key validation does.
3. The method is public on `AutomationStudioLlmExecutionGrantService`, and that
   class is re-exported through `execution/index.ts` and `llm/index.ts`. There is
   no program/API endpoint leak, but this is still an additive public TypeScript
   surface, contrary to the reports' “internal host capability” requirement.
   Either explicitly accept/document that compatibility surface or hide the
   capability behind a non-barrel internal binding. Do not export a request
   contract or add a gateway endpoint.
4. Atomicity across the Flow store and grant store still depends on the service
   caller invoking continuation after durable apply and before releasing the
   per-Flow adaptation lock. The grant method alone cannot prove adaptation
   identity/status or prevent a competing Flow mutation outside that lock.

## Missing focused refusal tests

- Success from an actually held and claimed grant, followed by resolve and one
  call against the new binding.
- Available-but-held, claimed-but-not-held, absent/revoked, exhausted, expired,
  and active-call cases all refuse and leave no continued grant.
- Wrong actor, session, project, Flow, and purpose; include invalid purpose.
- Stale expected previous digest and stale previous settings revision
  independently.
- Wrong applied digest and wrong applied settings revision independently.
- Grant revoked, exhausted, expired, or moved into an in-flight call while the
  identity/key/binding awaits are paused; this needs fixture gates for those
  dependency reads and proves the second check is real.
- Stored binding changed while those awaits are paused; CAS must lose without
  overwriting the winner.
- Session invalidation; missing, disabled, wrong-kind, rotated, wrong-id,
  provider-incompatible, model-incompatible, and wrong-Flow-scope keys.
- Malformed old/new digest or settings revision and a throwing authoritative
  binding resolver; assert no partial mutation and the chosen revocation code.
- State-preservation snapshot described above, plus unchanged reveal mint and
  revoke counts on success.
- A second continuation using the old binding loses; a repeat using the new
  binding must be explicitly decided and pinned (prefer refusal unless a real
  second applied adaptation supplies a distinct trusted old/new transition).
- Ordinary unproven Flow/settings drift still produces
  `llm.execution_grant_no_longer_valid`; no generic refresh path is introduced.

No source or shared document was edited. No tests, builds, provider, browser,
Lab, or commit operation was run. This review inspected the in-progress grant
store hunk and nearest grant state/test support only; t255's report/tests were
not yet present.
