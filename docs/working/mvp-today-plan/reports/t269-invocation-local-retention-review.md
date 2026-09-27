# t269 — Invocation-local retention review

Status: **Complete read-only source review**

## Verdict

**GO on the settled source boundary; NO-GO for the final/live gate until the exact regression is
observed passing.** The current Core source removes both defects identified by t268: no grant
purpose suppresses revocation, and no shared/ambient retention state exists. Retention is now an
ordinary private implementation argument set to `false` by the public generation entry point and
to `true` only by the private runtime-owned reauthor wrapper.

The remaining gate is evidence, not a source-boundary defect. At this snapshot, the nearest tests
do not directly assert that a public `explore_and_adapt`/`extend` invocation revokes while a
runtime-owned reauthor invocation using the same grant retains. The settled focused test run must
include that regression (or an equivalent same-grant concurrency assertion) before run 3.

No Core or downstream source, shared document, generated output, run artifact, provider/browser
state, build, commit, or push was changed. This report is the only file written.

## Snapshot limit

This review describes the shared Core checkout observed at
`2026-09-26T18:48:23-07:00`. `service.ts` last changed at
`2026-09-26T18:47:41-07:00`; the review deliberately waited through the earlier intermediate
`AsyncLocalStorage<boolean>` version and assessed the later private-argument version. Concurrent
edits after that timestamp are outside this verdict and require a fresh diff/read.

## Proof of the settled boundary

| Required property | Current evidence | Result |
| --- | --- | --- |
| No purpose-wide retention | `generateFlowBootstrapAdaptationInternal` finally revokes whenever `retainRunOwnedGrant` is false. It does not inspect `executionGrant.purpose`; repository search finds no old `purpose !== "explore_and_adapt"` exception. | Proven |
| No caller-selectable retention | Public `generateFlowBootstrapAdaptation(input)` passes literal `false`. Its exported input type has no retention field. The only `true` is in private `generateRuntimeOwnedFlowBootstrapAdaptation`. | Proven |
| No ambient retention | The intermediate `AsyncLocalStorage` import/store is gone. There is no `Set`, module flag, instance flag, async context, or grant-id lookup controlling cleanup; the boolean is a lexical argument of one invocation. | Proven |
| Exact owning operation | The only production reference to the private retaining wrapper is the wrong-answer `automationStudioReauthorRefutedResult` generation callback in `runRuntimeSession`. | Proven |
| Concurrent same-grant isolation | Each public call enters the private implementation with its own `false`; the reauthor call enters with its own `true`. Interleaving cannot transfer one invocation's value to another because there is no shared lookup or async context. The per-flow generation lock may serialize execution, but cleanup ownership no longer depends on that serialization. | Proven by source shape |
| Terminal ownership | The reauthor composition test still binds the real revoker and asserts zero active grants after the complete run. Public generation's finally still owns ordinary-call revocation on success and failure. | Existing partial regression evidence |

The relevant source chain is:

1. Public service/API/in-process callers can reach only
   `generateFlowBootstrapAdaptation(input)`, which delegates with `false`.
2. The private reauthor callback reaches `generateRuntimeOwnedFlowBootstrapAdaptation(input)`,
   which delegates with `true`.
3. Both paths share the same generation body, but its `finally` consults only that invocation's
   parameter: `if (!retainRunOwnedGrant && grantId) revoke(...)`.
4. The exported runtime facade still exposes the service, but it cannot name either private method
   or the private boolean through the public request contract.

This is the smallest safe seam recommended by t268. It also avoids the intermediate
`AsyncLocalStorage` implementation's descendant-context leak: async work started inside a provider
or harness callback can no longer inherit retention after the owning call returns.

## Test evidence and remaining hard gate

Existing nearby coverage proves important halves of the behavior:

- `runtime/tests/refuted-result/tests/reauthor-service.test.ts` exercises the private reauthor path
  with a real held grant and asserts the completed run leaves zero active grants.
- service-bootstrap accounting/generation/rejection tests assert ordinary public generation
  revokes on success and multiple failure stages.

At the snapshot, no nearest test combines the formerly vulnerable conditions: public
`mode: "extend"`, exact `purpose: "explore_and_adapt"`, and an observed revoker. Nor does a test
pause private reauthor generation and launch a public same-grant call to prove the latter cannot
inherit retention. Static review proves the isolation, but the regression that would fail both the
old purpose-wide implementation and the intermediate ambient implementation is still required for
the release/live gate.

Minimum acceptable assertion:

1. Begin or pause the runtime-owned reauthor generation with a held run grant.
2. Invoke the public generation entry point using the same grant identity (a distinct fixture Flow
   may be used if avoiding the per-flow lock is necessary).
3. Observe that the public call reaches cleanup with retention disabled and invokes the revoker,
   while the private invocation itself does not invoke cleanup revocation.
4. Preserve the existing end-to-end assertion that the outer run performs the terminal revoke and
   leaves zero active grants.

If the implementer instead adds a direct public `explore_and_adapt`/`extend` success-and-failure
revocation pair plus a structural assertion that no ambient state exists, that is sufficient for
this narrow remediation provided the full reauthor composition test also passes.

## Gate decision

- **Architecture/security boundary:** GO.
- **Concurrent isolation by source semantics:** GO.
- **Settled validation evidence:** NO-GO pending the exact public-extend/same-grant regression and
  the broader focused gates owned by the supervisor.
- **Live run 3:** do not authorize from this report alone.
