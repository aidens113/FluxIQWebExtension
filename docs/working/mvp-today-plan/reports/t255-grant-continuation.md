# t255 — Grant continuation primitive

Status: **Complete**

## Implemented

Added the grant-store continuation primitive:

```ts
grants.continueAfterAppliedFlowAdaptation({
  grantId,
  actorUserId,
  actorSessionId,
  projectId,
  flowId,
  purpose,
  expectedPreviousBinding: { executionDigest, settingsRevision },
  appliedBinding: { executionDigest, settingsRevision }
})
```

It returns sanitized `AutomationStudioLlmExecutionGrantMetadata`. It does not
issue a grant, make a provider call, mint or revoke a reveal on success, or
reset any allowance.

The transition requires the exact stored grant to be held, claimed, live,
unexhausted, and idle. It checks exact actor/session/project/Flow/purpose scope,
parses both exact bindings, revalidates the actor session and the key's id,
enabled state, kind, revision, provider/model, and Flow scope, and independently
reads the authoritative current binding. After those asynchronous reads it
rechecks stored-object identity, lifecycle state, scope, the old-binding CAS,
and authoritative-new equality. Only then does it synchronously replace
`executionDigest` and `settingsRevision`.

Every failure path—including invalid purpose, malformed binding, dependency
throw, compatibility failure, lifecycle race, identity/key failure, and CAS
loss—revokes and emits a typed grant refusal. Ordinary unproven Flow drift is
unchanged and remains `llm.execution_grant_no_longer_valid` through the normal
resolve/call path.

## Security-review resolution

The t256 required changes were addressed:

- the whole transition is under one typed revoke-on-failure boundary;
- key summary `id` must exactly equal the stored `keyId`;
- success compares every stored field other than the two binding fields and
  separately pins stored-object, reveal-array, consequence-array, token-limit,
  and expiry-timer identity;
- one-shot dependency gates prove the post-await CAS loses to revocation,
  expiry, a newly in-flight call, or a competing stored-binding update;
- tests cover absent, available-but-held, claimed-but-unheld, exhausted,
  wrong-scope, stale-old, non-authoritative-new, malformed input, dependency
  failure, invalid session, and incompatible key cases;
- replaying the old transition is refused and revokes the grant.

The binding type lives in the focused internal
`execution/grant-binding.ts` module and is deliberately not re-exported from
`execution/index.ts` or `llm/index.ts`. No API handler, gateway contract,
request field, or package-barrel capability was added. The method itself is an
additive method on the already exported grant-service class; this narrow
TypeScript visibility is accepted because the next host-wiring step must bind
the same service instance without creating a public program endpoint. Its
arguments remain untrusted and fully checked by the store.

## Files changed

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grants.ts`
  - added the held-run continuation CAS and fail-closed policy.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-binding.ts`
  - extracted the exact two-field binding type so `grants.ts` remains within
    the 800-line structure limit (797 lines).
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-checks.ts`
  - imports that internal binding type from its focused owner.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts`
  - nine focused success, preservation, refusal, race, and ordinary-drift
    tests.

No service/runtime wiring was added. No public API, budget, grant issuance,
purpose, retry, permission, consequence, provider, or live behavior changed.

## Validation

- New continuation suite: **9/9 passed**.
- New continuation + existing hold + existing grants suites: **45/45 passed**.
- `pnpm --filter fluxiq check`: **passed**.
- Scoped Core `git diff --check`: **passed** (line-ending warning only).
- Core `grants.ts` line count: **797**.

No build, live provider, browser, Lab, or commit action was performed.
