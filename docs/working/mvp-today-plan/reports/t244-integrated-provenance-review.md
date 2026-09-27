# t244 — Integrated t233/t239/t243 provenance review

## Verdict

**NO-GO for a new default-profile live run in the current state.** The t233/t239/t243
classification changes are internally coherent and the t243 focused suite is reported as 13/13
passing, but the real-grant t240 composition test is not complete. Its success path currently
observes:

```text
loop_verification → loop_verification → evidence_tool_decision
```

and fails because it expects a fourth, post-apply `loop_verification`. Until that discrepancy is
explained and the composition test proves the intended apply/rerun/result contract, a live run would
measure a known unclosed path rather than validate a settled one.

Conditional GO requires all of the following:

1. t240 resolves whether post-apply verification is required or the test expectation is wrong;
2. the corrected real-grant success and structured-failure composition cases pass;
3. t243 and t240 reports are written and their claims are verified by the supervisor;
4. Core's focused suite, package check, full test/check/build gates, and downstream paired checks
   pass on the settled tree.

No source/shared-document edit, test/build, live/provider/browser action, or commit was performed by
this review.

## Files and reports inspected

- downstream t233, t239, t241, and t242 reports;
- current Core `runtime/service.ts` targeted generation/reauthor hunks;
- Flow Bootstrap generation-failure diagnostic, projection, state, parser, and named tests;
- service-bootstrap accounting and extend tests;
- refuted-result recovery type and tests;
- current unreported t240 `runtime/tests/refuted-result/tests/reauthor-service.test.ts`;
- t243 worker status: focused suite stable at 13/13, full validation waiting on t240.

t240 and t243 had no final report at review time.

## Required invariants

### Pre-request setup remains not attempted — PASS

After provider resolution, the outer mutable fallback is reset to
`pre_provider_validation / pre_provider_validation_failed`. Routing, option construction,
permission construction, evidence-runtime access, and other setup remain outside the scoped
harness wrapper. The post-resolution getter regression proves the resolver ran, the harness did
not, no raw detail escaped, and the diagnostic is `not_attempted / not_received`.

### Untyped harness escape is unknown — PASS

t243 introduces one local `runHarness` wrapper and routes instruction authority, evidence decisions,
and direct Flow Bootstrap generation through it. An untyped escape is converted at
`provider_request` by `automationStudioFlowBootstrapFailureDiagnosticOf`, whose canonical raw-error
states are `unknown / unknown`. Direct and evidence-guided tests cover `Error`, `TypeError`, and
`DOMException`, assert one harness entry, no fabricated accounting/topology, grant revocation, and
no raw text.

This is the correct statement: entering the harness proves neither invocation nor non-invocation.

### Structured failures remain dominant — PASS

The scoped helper first parses an existing Flow Bootstrap diagnostic and returns it unchanged; it
then wraps that same diagnostic in the canonical error. The outer catch parses structured failures
before grant-refusal or unclassified fallback handling. The new structured-timeout regression
asserts exact equality including accounting and `unknown / not_received`. Returned `ok: false`
harness results still use `flowBootstrapHarnessFailure`, so provider code/status/refusal,
retryability, accounting, issue codes, and observed provenance retain their existing projection.

### Provider metadata no longer implies invocation — PASS

`flowBootstrapHarnessFailure` now requires a harness `providerInvocation`. Provider metadata is
used only for bounded provider/model/status/accounting fields. The failure-state table accepts the
observed invocation only where that code permits it; otherwise it uses the code's canonical state.
Tests cover resolved-provider preflight as `not_attempted` and timeout with metadata as `unknown`.

### Impossible state pairs are rejected — PASS

The parser admits only the code's accepted invocation set and additionally refuses:

- any `received` response without `attempted` invocation;
- any `not_attempted` invocation whose response is not `not_received`.

Focused tests reject `unknown / received`, `not_attempted / received`, and
`not_attempted / unknown`, alongside existing retryability/stage/accounting mismatches.

### Legacy acceptance is bounded — PASS, with compatibility question

Historical `attempted` forms are accepted for timeout, abort, request-default,
transport-unknown, and unclassified request families while new producers use `unknown`. The table
also accepts historical attempted secret/configuration failures; a retired configuration-code test
proves that compatibility. Received-response families remain attempted-only, and pre-provider
stages remain strictly not-attempted.

One policy question remains: named provider-preflight codes at `provider_request` now accept only
`not_attempted`, although the former stage-wide producer could have persisted them as `attempted`.
That rejection is consistent with the narrow t237 matrix but not with a blanket promise that every
old diagnostic remains readable. Decide explicitly whether those known-false historical records
should be readable for migration. This does not affect a fresh live run, but it should be settled
before claiming full stored-record compatibility.

### Exact admitted grant purpose — SOURCE PASS; composition incomplete

The reauthor callback no longer rewrites purpose to `explore_and_adapt`. It accepts only
`build_and_adapt` or `explore_and_adapt`, the same two purposes the extend generation-request owner
admits, and forwards the selected purpose. Other purposes fail before provider resolution. The
existing direct extend tests cover purpose pass-through.

The current t240 real-grant fixture reaches the real resolver with the original
`build_and_adapt` grant id, actor/session, purpose, and current digest/settings binding. That is
strong evidence that the previously suspected purpose-scope mismatch is fixed. It has not yet
completed its success assertion set because of the missing expected post-apply verification call;
therefore approval/application, final run outcome, and one-time grant release are not yet accepted
as integrated proof.

### No retry, budget, permission, or capability widening — PASS for reviewed hunks

- The scoped wrapper adds no retry and does not change returned failed-result handling.
- Provider retry source and policy are unchanged.
- Token, call, cost, timeout, reservation, and accounting limits are unchanged.
- `permittedConsequences` and action-permission construction are unchanged.
- No task kind or runtime capability is added by t233/t239/t243.
- Purpose handling narrows authority: it preserves one of two already admitted purposes instead of
  upgrading any runtime grant to `explore_and_adapt`.
- Proposal, approval, application, rerun gating, and grant revocation branches are not changed by
  these provenance hunks.

The shared Core worktree contains other concurrent/earlier behavior changes near these lines; this
verdict applies only to the t233/t239/t243 hunks and does not substitute for supervisor review of
the entire release diff.

## Remaining gaps before GO

1. **Blocking:** t240 must explain the absent post-apply verification call and produce a passing,
   non-weakened real-grant composition test.
2. **Blocking:** no integrated full gate result exists after t240/t243 settle; concurrent validation
   would be unreliable while their files are still changing.
3. **Compatibility decision:** explicitly accept or deliberately reject legacy attempted records
   for the named provider-preflight code list, and test the chosen policy.
4. **Coverage:** t240 exercises real `build_and_adapt`; `explore_and_adapt` has direct extend
   coverage but not the same end-to-end real-grant composition.
5. **Release pairing:** downstream readers must admit `providerInvocation: unknown` in the same
   release unit before Core emits it across a mixed-version boundary.

## Recommended gate sequence

After t240 is resolved and all editing stops:

1. run the combined service-bootstrap, generation-failure, harness, provider-retry, refuted-result,
   and real-grant composition tests;
2. run Core package check and root `pnpm test`, `pnpm check`, and `pnpm build`;
3. run the downstream paired type/tests and readiness checks;
4. inspect the final source and generated diffs;
5. only then authorize one default-profile live run.
