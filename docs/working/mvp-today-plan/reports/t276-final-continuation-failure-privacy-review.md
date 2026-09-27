# t276 — Final continuation-failure privacy review

Status: **Complete read-only audit**

Snapshot: `2026-09-26`, current settled shared Core tree after the t267/t273 regressions landed.
No test command was run because this brief forbids generated-output changes; this report audits the
settled source and final test assertions and does not independently adopt their execution results.

## Verdict

**GO for live-run use.** The post-apply binding-read and grant-continuation failure paths publish a
closed, typed marker, preserve the durable fact that the adaptation was applied, and prevent replay.
No error message, stack, cause, provider payload, secret, grant identity, actor/session identity,
binding digest, settings revision, key identity, or accounting detail is copied into the marker.

The carriage is truthful in both directions. `applied: true` is added only after the adaptation
application has resolved; the binding read and grant continuation happen afterward inside the
closed catch. A failure in either operation becomes `replayReady: false` and cannot rewrite the
adaptation as unapplied. `run-outcome.ts` treats only that exact boolean as a replay refusal, saves
the repaired detail, skips rerun and recursive verification, and returns the already-failed
session. The final service regressions prove both failure branches retain an applied adaptation,
make only the three pre-replay provider calls, expose the closed marker, and leave no active grant.

## Field-by-field audit

| Published `resultReauthor` field | Source / meaning | Privacy and truthfulness verdict |
| --- | --- | --- |
| `routed: true` | Produced by the refuted-result routing record before continuation carriage. | **GO.** Boolean route fact; no external text. |
| `adaptationId` | Opaque id of the generated adaptation, retained by the reauthor result. | **GO.** Required to inspect the durable adaptation; no provider or grant material. |
| `applied: true` | Set by `automationStudioReauthorRefutedResult` only after its `apply` callback resolves. The continuation coordinator applies first, then reads the authoritative binding and continues the grant. | **GO.** Correctly remains true when either later operation fails. It is absent for pre-apply rejection or an apply throw. |
| `replayReady: false` | Derived solely from a recorded continuation failure. | **GO.** Truthfully closes deterministic replay; `run-outcome.ts` checks the exact `false` value before rerun. |
| `code` | Either one of the typed execution-grant refusal codes, obtained only from the dedicated refusal class, or the closed fallback `llm.execution_grant_no_longer_valid`. | **GO.** No message parsing or arbitrary thrown value is published. |
| `stage: "grant_continuation"` | Core-owned constant identifying the local post-apply stage. | **GO.** Actionable and contains no external text. |
| `retryable: false` | Core-owned constant. | **GO.** Correct for a failed binding/continuation on this consumed run path; no blind retry is implied. |
| `providerInvocation: "not_attempted"` | Provenance for the failing continuation stage, which performs a local binding read and grant-store operation only. | **GO.** Truthful for this stage even though earlier verification/reauthor generation used the provider. |
| `providerResponse: "not_received"` | Companion provenance for the same local stage. | **GO.** No provider request belongs to this failure, so no response was received for it. |
| `providerStatus` | Not added by continuation carriage. | **GO.** Correctly absent; there is no provider response/status at this stage. |

The implementation constructs those fields from booleans, constants, the opaque adaptation id,
and the closed refusal-code union. The helper does spread the existing `resultReauthor` marker, but
that marker has just been replaced by `automationStudioRefutedResultReauthored`; it is not an
untrusted carry-forward of an older marker. Run-detail persistence merges metadata at the top key
level, so the incoming complete `resultReauthor` object replaces any stored object rather than
deep-merging stale fields into it.

## Final regression evidence inspected

- `runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts` proves a rejected
  authoritative binding read occurs after apply, returns only the closed code, and never calls
  continuation.
- `runtime/tests/refuted-result/tests/reauthor-service.test.ts`, **“keeps durable applied provenance
  and skips replay when the applied binding cannot be read”**, proves the exact marker, persisted
  `status: "applied"`, three calls only, failed run, zero active grants, and absence of the injected
  binding-read message.
- The adjacent **“keeps a durable applied adaptation but refuses replay when grant continuation
  closes”** case proves the typed `llm.execution_grant_unavailable` projection, persisted applied
  adaptation, three calls only, failed run, sanitized detail, and zero active grants.
- `repair.ts` persists the returned repaired detail. `run-outcome.ts` refuses replay on exact
  `replayReady === false`, so neither branch can reach the fourth verification call.

## Untested disclosure path

One narrow defense-in-depth case is not explicit: no unit injects an arbitrary secret-bearing error
directly from `continueGrant` and asserts that its message, stack, and cause are absent. The same
catch and projection are exercised with an arbitrary secret-bearing authoritative-binding-read
error, and source inspection shows an unknown continuation error is reduced to the fixed
`llm.execution_grant_no_longer_valid` fallback. The typed-continuation service test exercises the
other branch. This is therefore a **non-blocking assertion gap, not a disclosure path found in the
current implementation**. An exact-key assertion for the failure marker would also strengthen the
tests, which currently use `toMatchObject`; current source inspection found no extra field.

No Core source, shared document, generated output, run artifact, provider/browser/Lab state,
commit, or push was changed. This downstream report is the only file written by t276.
