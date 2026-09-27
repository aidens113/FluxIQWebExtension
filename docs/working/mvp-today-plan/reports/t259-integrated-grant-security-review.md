# t259 — Integrated grant-continuation security review

Status: **Complete source review; validation results noted below**

## Verdict

**GO for supervisor gates. NO-GO for a new live run until t258's broader Core
checks/rebuild are complete and observed passing.**

The integrated t255/t258 design preserves one admitted grant across exactly one
Core-authorized reauthor/apply boundary without minting authority or weakening
ordinary binding validation. The decisive local composition now passes with
the expected four provider calls. No live/provider claim follows from this
review.

## t255 grant-store review

The t256 findings are resolved:

- `continueAfterAppliedFlowAdaptation` requires the exact grant object to be
  held, claimed, unexpired, unexhausted, and idle before its asynchronous
  checks and again immediately before mutation.
- Scope is exact across grant id, actor, session, project, Flow, and purpose.
- The old binding is a CAS against the stored binding; the proposed new binding
  must equal a fresh authoritative binding read by the grant store.
- Session identity and key id, enabled state, kind, revision, provider/model,
  and Flow scope are revalidated.
- Invalid purpose, malformed bindings, dependency throws, compatibility
  failures, state races, and mismatches all enter one typed revoke-on-failure
  boundary. Ordinary unproved drift still uses the existing
  `llm.execution_grant_no_longer_valid` path.
- The success path mutates only `executionDigest` and `settingsRevision`.
  Focused assertions compare every other stored field and pin object, array,
  token-limit, and timer identities; no reveal authorization is minted or
  revoked on success.
- Paused dependency-read tests prove the second CAS check loses safely to
  revocation, expiry, a newly in-flight call, and a competing stored-binding
  change.
- The binding type remains in an internal module and is not exported through
  `execution/index.ts` or `llm/index.ts`. No API/gateway endpoint or request
  contract was added. The continuation remains an additive method on the
  already exported grant-service class, explicitly documented as the internal
  host seam; it grants no usable authority without the private live grant
  record and all checks above.

## t258 integrated wiring review

### Operation-scoped retention

The public `generateFlowBootstrapAdaptation` wrapper always calls the private
implementation with `retainRunOwnedGrant = false`. The only `true` call site is
the runtime wrong-answer reauthor operation. Thus `build_and_adapt` is retained
for this nested operation only; there is no purpose-wide cleanup exemption.
Standalone build cleanup and the outer runtime-session final revocation remain
unchanged.

### Exact durable apply boundary

The reauthor route captures the authoritative pre-generation binding and uses
it in the generation request. Under the per-Flow bootstrap-adaptation lock, the
runtime-only apply helper reloads the exact returned adaptation id and requires
both its `baseDependencyDigest` and `baseSettingsRevision` to equal that
captured binding before applying it. It then durably applies the validated
adaptation, reads the final authoritative binding under the same lock, and only
then invokes grant continuation.

The final authoritative digest is intentionally not compared with
`application.appliedDependencyDigest`: the adaptation record/change-feed
persistence occurs after that application field is captured and itself affects
the final execution dependency digest. Instead, the grant store independently
re-reads the authoritative current binding after the service passes it and
requires equality after all of its awaits. This is the correct final-state
check.

### Safe failure and replay

If the continuation hook is absent or refuses, the already durable adaptation
remains truthfully `applied`. The run detail records:

- `replayReady: false`;
- the closed typed grant code;
- `stage: grant_continuation`;
- `retryable: false`;
- `providerInvocation: not_attempted`;
- `providerResponse: not_received`.

Result verification reads `replayReady:false` and skips deterministic replay
and recursive judging. The focused failure composition observes only the two
initial judges plus the reauthor call, persists no raw response detail, retains
the applied adaptation record, fails the run, and ends with zero active grants.

On success, the exact provider task order is:

1. `loop_verification`;
2. `loop_verification`;
3. `evidence_tool_decision`;
4. `loop_verification`.

The selected-Subflow deterministic replay sits between calls 3 and 4 and makes
no provider call. No grant is issued in the repair path; every resolver use
carries the original grant id/scope/purpose. The t255 store preserves remaining
uses, committed tokens/cost, lease, deadline, reveals, limits, and consequences
across continuation, so call 4 charges the same existing allowance. The outer
`runRuntimeSession` `finally` remains the terminal revoker, and the composition
ends with zero active grants.

The fixture now mirrors the production API boundary by calling `holdForRun`
before execution. Its explicit `maxCalls: 4` is only the exact allowance needed
to prove this four-call scenario; no product default, budget, retry, purpose,
permission, or consequence changed.

## Validation evidence reviewed

- t255 continuation suite: 9/9 passed.
- t255 continuation + grant-hold + grant suites: 45/45 passed.
- t255 FluxIQ package check: passed.
- t258 decisive refuted-result composition: reported passing, including the
  four-call success path and structured provider-failure path; the added
  continuation-failure case proves safe applied-state persistence and no
  replay/provider call.
- t258 broader Core gates/rebuild: pending at the time of this report's source
  review. They remain the condition for live-run GO.

## Files reviewed

- Core `runtime/llm/execution/grants.ts`
- Core `runtime/llm/execution/grant-binding.ts`
- Core `runtime/llm/execution/grant-checks.ts`
- Core `runtime/llm/execution/index.ts`
- Core `runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts`
- Core `runtime/service.ts`
- Core `programs/_shared/runtime.ts`
- Core `runtime/recovery/refuted-result/reauthor.ts`
- Core `runtime/result-verification/run-outcome.ts`
- Core `runtime/tests/refuted-result/tests/reauthor-service.test.ts`
- Downstream reports t251–t258 available during review, especially t255 and
  t256.

No source/shared document was edited. No test, build, live provider, browser,
Lab, or commit action was performed by t259.
