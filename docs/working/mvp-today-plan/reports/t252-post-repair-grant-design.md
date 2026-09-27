# t252 — Post-repair grant lifecycle design

Status: **Complete (read-only design audit)**

## Finding

The repaired replay is no longer the blocker. t246 proves that it runs the
selected Subflow successfully and without a provider call. The remaining
provider call is the recursive `loop_verification` after that replay.

There are two grant-lifecycle barriers in the current integrated code:

1. `generateFlowBootstrapAdaptation` revokes every `build_and_adapt` grant in
   its `finally`, because only `explore_and_adapt` is treated as belonging to a
   still-running runtime session. After t233, the nested reauthor correctly
   preserves `build_and_adapt`, so this standalone-build cleanup now also sees
   a run-owned build grant.
2. If that run-owned grant is retained, applying the adaptation changes the
   canonical `executionDigest` and `settingsRevision`. The grant service checks
   both fields on every resolve and provider call and correctly refuses the old
   binding as `llm.execution_grant_no_longer_valid`. t246 observed this form of
   the failure before the current purpose-preservation path introduced the
   earlier revocation barrier.

The result-check resolver is behaving correctly: the person's explicit grant
wins over standing authorization, while an absent or refused explicit grant is
not silently replaced by another authority. The recursive verifier also has a
structural one-repair bound, so solving the lifecycle transition does not make
the repair recurse without limit.

## Options compared

| Option | Assessment |
| --- | --- |
| Generic refresh-in-place | Reject. Allowing arbitrary callers to replace an issued grant's binding would turn an unrelated Flow mutation into authorized work and defeat the exact-binding invalidation invariant. |
| Explicit run-ownership flag alone | Necessary but insufficient. It prevents the nested build from revoking the run's grant, but the post-apply binding check still fails closed. Ownership must be private Core call context, not a caller-supplied request field. |
| Purpose exception | Reject. Exempting all `build_and_adapt` generation from cleanup lengthens standalone grant lifetime and leaks authority beyond the operation the person started. Rewriting the nested call as `explore_and_adapt` would also violate the stored purpose/scope. |
| New grant | Reject for the automatic path. Normal issuance requires fresh actor/session, credential, limits, reveal authorizations, and confirmation checks. Silently minting another grant duplicates authority and budgets; transferring authority into a child grant is materially larger than advancing the existing run-owned grant. |
| Guarded binding advance on the same run-owned grant | Recommend. It preserves one grant, one remaining-use ledger, one cost/token purse, one lease, and one final revocation, while acknowledging only the exact mutation that the same authorized repair just applied. |

## Minimal design

Use an explicit internal lifecycle plus a narrowly named grant-service
operation; do not expose either through an API payload.

1. Split the existing public generation method into its public wrapper and a
   private implementation that receives `standalone` or `runtime_owned` grant
   lifecycle. The wrong-answer reauthor path calls the private implementation
   as `runtime_owned`. Its `finally` does not revoke that grant; the enclosing
   `runRuntimeSession` `finally` remains the sole terminal revoker. Preserve
   existing standalone cleanup and the existing `explore_and_adapt` behavior.
2. Immediately before the authorized apply, retain the exact old binding. Only
   after `reviewFlowBootstrapAdaptation(..., action: "apply")` succeeds, read
   the exact new binding and ask the grant service to
   `advanceHeldGrantBindingAfterAuthorizedMutation` (name illustrative).
3. The grant-service operation accepts the full existing grant scope plus
   `expectedPreviousBinding` and `appliedBinding`. It succeeds only when the
   stored grant exists, is held for this run, is already claimed, is inside its
   unchanged run lease, has no call in flight, has remaining uses, matches the
   actor/session/project/Flow/purpose exactly, still has a valid session and
   key, its stored binding equals `expectedPreviousBinding`, and Core's current
   binding equals `appliedBinding`.
4. On success, mutate only `executionDigest` and `settingsRevision`. Do not
   reset or increase remaining uses, cost, tokens, reveal authorizations,
   retries, expiry, run lease, permitted consequences, task capability,
   project/Flow scope, actor/session, purpose, provider, model, or any action
   permission.
5. Any mismatch fails closed and leaves recursive verification unperformed;
   the enclosing run still revokes the grant. Do not fall back to a standing
   authorization after an explicit-grant transition failure.

This needs one additional internal service wiring port from
`AutomationStudioService` to `AutomationStudioLlmExecutionGrantService`, wired
beside resolve/revoke/close in `programs/_shared/runtime.ts`. It is additive to
the construction contract and must not become a program endpoint or an input
field. The mutation operation belongs in `runtime/llm/execution/grants.ts`;
the ownership, apply sequencing, and invocation belong in `runtime/service.ts`.

## Compatibility and security invariants

- Standalone build generation still revokes `build_and_adapt` on success,
  refusal, or failure.
- Runtime completion, cancellation, throw, timeout, logout, key change, scope
  mismatch, exhaustion, and service close still revoke or invalidate exactly
  as before.
- The binding advance is unavailable to unheld or merely available grants and
  while a provider call is in flight.
- The old and new bindings are both checked; the operation cannot bless an
  arbitrary current Flow or cross project, Flow, actor, session, or purpose.
- No call, token, cost, retry, TTL, lease, credential, consequence, capability,
  permission, or repair-cycle allowance increases.
- Deterministic replay remains zero-provider. Exactly the later recursive
  verification may consume the next already-authorized use.
- Failed apply performs no advance. Failed advance performs no provider call.
  Later unrelated mutation is still caught by the ordinary exact-binding check.
- Existing `explore_and_adapt` recovery behavior and no-grant/standing-result-
  check behavior remain unchanged.

## Focused proof required

- Grant-service tests: accept the exact held/claimed/no-call-in-flight
  old-to-current transition; preserve every budget/lifetime/authority field;
  reject unheld, available, expired, exhausted, in-flight, wrong-scope,
  wrong-purpose, stale-old, non-current-new, invalid-session, and changed-key
  cases.
- Bootstrap/service tests: standalone `build_and_adapt` still revokes; nested
  run-owned `build_and_adapt` survives generation; apply failure never advances;
  run `finally` still revokes.
- The t246/t240 composition: observe two initial `loop_verification` calls, one
  reauthor `evidence_tool_decision`, zero-provider deterministic replay, then
  the post-replay `loop_verification`; confirm one grant ledger and zero active
  grants at run end.
- Preserve the structured provider-failure case and its no-raw-response
  persistence assertion.

No source was edited and no tests, builds, live providers, browsers, or commits
were run for this audit.
