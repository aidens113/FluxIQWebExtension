# t267 — t265 remediation test audit

Status: **Complete read-only snapshot audit**

Snapshot: `2026-09-26 18:46:02 -07:00`, from the shared, uncommitted Core tree. The four
reviewed files had last-write times between 18:35 and 18:44, so this report describes the fix while
it was still landing. No test command was run: the brief forbids generated-output changes and this
shared checkout was being edited and validated by the implementation worker. Test results reported
elsewhere are not independently adopted here.

## Verdict

**Source correction: GO. Final regression gate: NO-GO on this snapshot.**

Both t265 defects are corrected in source. Public Flow Bootstrap generation again has a one-input
signature, and its input contract exposes no retention control. Retention is now private service
state selected only around the runtime-owned reauthor generation call and removed in its `finally`.
After durable apply, the authoritative binding read and grant continuation are both inside the same
closed catch, so either failure returns a generic continuation refusal rather than erasing the
durable fact.

The remaining gap is proof, not a source defect found by this audit. A focused helper test now
covers a rejected post-apply binding read, and the existing service composition covers the same
closed projection for a continuation refusal. The composition suite does not inject the binding-read
failure itself, however, so it does not yet prove in one test that this exact failure publishes
`applied: true`, skips replay and the fourth judge, persists the applied adaptation, and ends with
zero active grants. T265 explicitly required that regression before live-run GO.

## Smallest regression matrix

| Case | Required assertions | Snapshot evidence | Verdict |
| --- | --- | --- | --- |
| Public generation cannot select retention | `generateFlowBootstrapAdaptation` accepts one input; the input type has no retention field; a direct successful `build_and_adapt` generation invokes revocation for its grant. | `runtime/service.ts:1481`; `service/flow-bootstrap-commands/contracts.ts:8`; existing `service-bootstrap/tests/generation.test.ts:156`. The old caller-controlled boolean is absent. | **Covered**, subject to the implementation worker's test run. |
| Runtime reauthor owns retention | Only the private service set can suppress ordinary `build_and_adapt` revocation; the exact nested reauthor call adds the run's grant id and removes it in `finally`; no other add site exists. | `runtime/service.ts:394`, `:1723`, `:2648`; repository search found one add site and one delete site. | **Covered by source inspection**; the success composition's terminal zero-grant assertion guards leakage. |
| Binding read fails after durable apply | Apply is observed first; binding read rejects; continuation is not called; the helper resolves `{ replayReady: false, code: "llm.execution_grant_no_longer_valid" }`; error text does not escape. | New `runtime-adaptation/tests/reauthor-continuation.test.ts:21`; implementation in `reauthor-continuation.ts:39-46`. | **Covered at helper boundary**, not independently run here. |
| Exact binding-read failure closes through service composition | Persisted adaptation remains `status: "applied"`; result marker has `routed:true`, `applied:true`, `replayReady:false`, `stage:"grant_continuation"`, `providerInvocation:"not_attempted"`, `providerResponse:"not_received"`; only three provider task kinds occur; no replay/fourth judge occurs; run fails; active grant count is zero; thrown detail is absent. | No binding-read fault injection exists in `runtime/tests/refuted-result/tests/reauthor-service.test.ts` at this snapshot. Its continuation-refusal case at lines 538-587 proves the projection and control flow for the adjacent failure branch only. | **Missing — live-run blocker.** |

## Required final assertion

Add one service-composition case by injecting failure specifically from the authoritative
post-apply binding read (not from `continueGrant`). Reuse the current continuation-refusal
assertions, but also prove that the saved adaptation is applied and that neither the rejected error
message nor provider content is present in the run detail. Expected task kinds are exactly the two
pre-repair `loop_verification` calls plus `evidence_tool_decision`; there must be no replay-driven
fourth `loop_verification`. Finish by asserting `activeGrantCount() === 0`.

That one case completes the missing cross-layer proof. The existing direct-generation revocation,
helper fault, successful four-call reauthor, continuation-refusal, and provider-privacy tests are the
rest of the minimum matrix; duplicating them is unnecessary.

No Core source/shared document, generated output, run artifact, provider/browser/Lab state, commit,
or push was changed. This downstream report is the only file written by t267.
