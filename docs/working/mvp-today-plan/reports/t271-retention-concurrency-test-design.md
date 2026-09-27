# t271 — Retention concurrency test design

Status: **Complete read-only Core test-design audit**

## Verdict

The settled source seam is safe by construction, but the smallest release-quality regression set
is not complete. Public generation calls the private implementation with literal `false`;
the runtime wrong-answer callback alone creates a local wrapper that calls it with literal `true`.
There is no shared `Set`, async context, purpose exception, or exported retention selector.

Existing tests prove public failure revocation, successful public extend generation, and complete
runtime-owned reauthor retention/terminal revocation separately. No test overlaps a paused private
reauthor with an ordinary public invocation using the same grant ID. That overlap is the decisive
regression for the former ambient grant-ID bug. Add the two tests below before live run 3.

This audit changed no Core source, shared document, generated output, build, run artifact, or live
state. The snapshot reviewed includes Core `service.ts` as modified at
`2026-09-26T18:49:11.8465467-07:00`.

## Current seam and present coverage

| Invariant | Current source/test evidence | Covered? |
| --- | --- | --- |
| Ordinary public calls always own cleanup | `service.ts:1474` passes `false`; `service.ts:1715` revokes when false. | Source-proven; failure tested |
| Only the exact runtime reauthor invocation retains | The local `generateRuntimeOwned` at `service.ts:2639` is inside `repairRefutedResult` and passes `true`. | Source-proven; composition tested |
| A valid public `explore_and_adapt`/`extend` cannot retain by purpose | `extend.test.ts:183` proves this request can succeed, while `accounting.test.ts:75` proves a direct explore-purpose failure revokes. Neither successful extend test observes revocation. | **Missing exact assertion** |
| A public same-ID call cannot inherit an in-flight reauthor's retention | No shared state remains, so the source shape proves it. No test schedules the former vulnerable overlap. | **Missing regression** |
| The run remains terminal owner after successful private retention | `reauthor-service.test.ts:475` reaches apply, replay, and fourth verification; line 551 asserts zero active grants. | Covered |
| Grant-store concurrent use remains bounded | Execution-grant tests prove same-scope resolves share one allowance and mismatched scopes refuse. | Covered below the service cleanup seam |

The current `accounting.test.ts:75` case is useful: it would fail the old purpose-wide cleanup
exception even though request parsing rejects its explore-purpose create request. It does not show
that the accepted `explore_and_adapt` plus `mode: "extend"` combination revokes on success.

## Test 1 — valid public extend revokes on success

**Owner:** `runtime/tests/service-bootstrap/tests/extend.test.ts`.

Extend `serviceWithAppliedFlow` with an optional `revokeLlmExecutionGrant` callback and bind it into
the service options. In the existing successful `"opens for a non-blank Flow..."` fixture, use a
`vi.fn()` revoker, retain the existing exact `mode: "extend"`, `evidenceGuided: true`, and
`purpose: "explore_and_adapt"` request, and await successful generation.

Exact assertions after success:

1. The adaptation remains proposed and has the existing successful topology assertions.
2. The provider received an `evidence_tool_decision` request, proving this was not an early refusal.
3. `revoke` was called exactly once with the request's grant ID.
4. No caller-visible input or service method can name the retention boolean.

This test fails the old purpose-wide exception and passes the final public-`false` seam. Keep the
existing accounting failure case; together they prove success and failure cleanup without adding a
second large fixture.

## Test 2 — deterministic same-ID overlap cannot inherit retention

**Owner:** `runtime/tests/refuted-result/tests/reauthor-service.test.ts`.

Use the existing real-grant `createHarness`; do not test this with a fake revoker alone. Add two
deferred promises and a `revokedGrantIds` observation:

- `reauthorProviderStarted`, resolved when `fetchImpl` receives the
  `evidence_tool_decision` request;
- `releaseReauthorProvider`, awaited by that request before it returns its scripted completion;
- wrap `revokeLlmExecutionGrant` as `id => { revokedGrantIds.push(id); grants.revoke(id); }`.

Create a second blank Flow in the same service before starting the run. It needs no instruction or
provider response: its purpose is to give the ordinary public call a different per-Flow generation
lock while carrying the exact same grant ID. Then schedule the race without timers:

1. Start `runRuntimeSession(...)` and retain its promise.
2. Await `reauthorProviderStarted`. At this point the private call is inside generation with
   retention `true`, and the old ambient implementation would have registered this grant ID.
3. Without releasing the provider, call public `generateFlowBootstrapAdaptation(...)` against the
   second Flow using the same grant ID and the run's `build_and_adapt` grant fields. Await its
   expected sanitized generation failure. Because the Flow has a distinct lock, this cleanup runs
   while the private call is still paused.
4. Before releasing the private provider, assert `revokedGrantIds` equals exactly `[grantId]` and
   `grants.activeGrantCount()` is zero. This is the decisive scheduling assertion: the public
   invocation used its own `false` and did not inherit the private invocation's `true`.
5. Release the provider in a `finally` block, await the run, and assert it fails closed, publishes no
   replay/fourth verification after revocation, leaks no raw provider text, and ends with zero
   active grants. Permit the outer runtime `finally` to call revoke again; the pre-release assertion
   is what attributes the first revoke to the public call.

Use an explicit deferred helper rather than fake timers, sleeps, call-count polling, or reliance on
microtask order. The distinct Flow is essential: using the same Flow would serialize both calls on
`withBootstrapGenerationLock`, allowing the private call to clear old ambient state before public
cleanup and therefore failing to reproduce the former bug.

This test should use `build_and_adapt` for the overlapping public call. That isolates the ambient
grant-ID defect from the separate old `explore_and_adapt` purpose exception, which Test 1 covers.
The public call may fail at blank-target/instruction/binding validation; assert only the stable,
sanitized diagnostic family required by the chosen fixture and the cleanup behavior, not raw error
text.

## Minimal focused validation

Run serially on the settled tree:

```text
pnpm --filter fluxiq exec vitest run \
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts \
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts \
  src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts
pnpm --filter fluxiq check
```

The first new test is sufficient for the purpose-wide regression. The second is required for the
ambient/concurrent same-grant regression. Existing grant continuation/hold suites should remain in
the supervisor's broader settled-tree gate, but duplicating their CAS, scope, or allowance cases in
these service tests is unnecessary.

## Gate decision

- Final private seam by source shape: **GO**.
- Existing public direct failure and terminal runtime coverage: **GO**.
- Exact valid public-extend success revocation: **NO-GO until added and observed passing**.
- Deterministic concurrent same-ID/non-reauthor isolation: **NO-GO until added and observed passing**.
- Live run 3 from this audit alone: **NO-GO**.
