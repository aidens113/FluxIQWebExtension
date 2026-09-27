# t173 — Cross-repository integration review

Repository scope: `F:\!FluxIQWebExtension` and `F:\!FluxIQ`, both current working
trees. Review only; no source, shared document, build, test, Lab, commit, or push.

## Outcome

**Release-blocking mismatches found.** The integrated diff does not yet satisfy the
binding defensive-runtime and repair-evidence contracts. I found three concrete,
actionable defects, ranked below. The first is a cross-module authorization mismatch;
the second breaks the web retry's stated timeout bound; the third can discard the
judge's repair advice at the only hop into recovery. Each has a proportional-test gap.

## Findings

### 1. P1 — Provider retries violate the execution grant that wraps the provider

Core's grant contract still states and enforces that an execution grant permits zero
provider retries:

- `runtime/llm/execution/grants.ts:209` rejects any issued grant whose
  `providerRetryCount` is not zero.
- `runtime/llm/execution/grants.ts:403` and `:485` type and return
  `providerRetryCount: 0`.
- `runtime/llm/execution/grant-metadata.ts:33` and `:63` publish the same zero in
  persisted metadata.

The harness nevertheless enables three attempts by default. It calls
`automationStudioLlmProviderCall` at `runtime/llm/harness/run.ts:172` without deriving
`maxAttempts` from the resolved grant. Each inner attempt invokes the grant-wrapped
provider (`runtime/llm/provider-retry/call.ts:179`), whose `runTask` claims and settles
a fresh grant call (`runtime/llm/execution/grants.ts:422`, `:466`, `:684-690`). Thus a
grant advertised and validated as allowing no provider retries can release the
credential and spend two additional calls for one harness question.

This is not bookkeeping only. If the first transient failure consumes the grant's last
remaining use, `finishCall` revokes the grant (`execution/grants.ts:720-726`); the retry
then sees a grant refusal instead of the original 429/5xx. That can replace the provider
fault the retry was supposed to absorb and makes behavior depend on remaining grant
uses.

The test suites prove the two halves separately but never compose them. Grant tests pin
zero and reject one (`llm/tests/execution-grant/tests/execution-grants.test.ts:246,532`);
provider-retry tests exercise an unwrapped provider. No test sends a 429/503 through a
resolved grant and asserts call usage, grant survival, final failure provenance, and
retry accounting.

**Action:** make the grant own the retry allowance and thread its resolved value to the
harness, or explicitly change the grant contract/metadata to authorize and account for
the inner attempts. Add an integration test for a transient failure with both spare and
last remaining grant uses before treating provider retry as releasable.

### 2. P1 — The browser recovery loop starts a retry after the command timeout expires

The web defence says a command's own `timeoutMs` is never exceeded
(`action-runtime/recovery/budget.ts:33-39`), but its implementation clips the *wait* to
the entire time remaining (`budget.ts:80-82`) and then unconditionally starts another
attempt after that wait (`attempt.ts:64,78`). For a command with 200 ms remaining,
`recoveryBackoffMs` returns 200 ms; the loop waits those 200 ms and dispatches attempt
two when the command has no time left. Scheduler delay makes this strictly worse, and
the attempt itself is not bounded by the recovery wrapper.

The existing test encodes only the clipped wait (`recovery/tests/budget.test.ts:42` and
the 190 ms case described by that suite); it does not use an advancing clock to prove
that a second attempt is withheld once `timeoutMs` expires. This contradicts the
binding bounded-retry rule and can turn a short command deadline into that deadline
plus a full extra verb execution.

**Action:** reserve time for the next attempt or re-check the deadline after the pause
and before dispatch. Add an attempt-loop test whose clock advances through the clipped
pause and asserts that no post-deadline verb runs (plus a scheduler-overshoot case).

### 3. P1 — The only repair hop can truncate the judge's advice before recovery sees it

The structured result repair directive is recorded on the run, but the refuted-result
recovery path does not carry that structure. `recovery/refuted-result/attempt.ts:80-117`
copies only the synthetic failure record, and `recovery/context.ts:424-452` exposes only
that record's bounded `expected` and `actual` fields to the repair model.

At that hop, `result-verification/core-observation.ts:124-130` serializes the content in
this order: the judge's `expected`, every Core fix line, then the judge's `advice`.
`boundedObservation` immediately truncates the combined text to the failure-record
limit (`core-observation.ts:140-142`). The source fields may each be substantial:
`repair-directive.ts:71-78` permits up to eight 300-character Core fix lines and
500-character judgement fields. Therefore valid directives can deterministically lose
the tail — specifically the judge's advice, because it is appended last — while the run
record still appears to contain a complete structured directive.

Current tests assert only that the failure text contains `"To fix:"`
(`result-verification/tests/verdict.test.ts:124`, `run-outcome.test.ts:395`, and
`core-observation.test.ts:116`). None constructs a directive near the bounds and proves
that the judge's advice or all selected fixes reach the recovery context.

This directly weakens the binding rule that a refuting judge tells the repair what to
fix. It is especially misleading because persistence retains the structured directive
while the repair consumes a different, lossy projection.

**Action:** carry a screened, bounded `repair_directive` section into recovery context
and budget it as structure; keep `expected`/`actual` as the human-readable failure. Add
a boundary test from verdict through `automationStudioRecoveryContext` proving which
findings, fixes, and judgement advice survive, including explicit withholding when the
section cannot fit.

## Non-blocking contract debt confirmed

The web action recovery account remains prose-only. `action-runtime/recovery/record.ts`
appends it to validation/failure `actual` text (`:49-60`), while
`domain/src/actions/types.ts:445-465` declares no recovery member and
`domain/src/client/gateway-mapping.ts:295-305` copies no such field. Recovery is visible
to a person and repair, but cannot be counted or reliably projected across the gateway.
This is the already-named t167 handoff, not a new release blocker for the hard scenario;
it should still be completed before claiming run-level recovery observability.

## What I reviewed

- `mvp-today-plan.md` Current State and brief t173.
- Complete reports t164 through t169.
- Current changed hunks and directly related contracts/tests for result verification,
  refuted-result recovery context, Core defensive execution, provider retry and grant
  accounting, web action recovery, and the web/domain result wire.

## Validation

Read-only source review only, as assigned. I ran `rg`, `git status`, `git diff --stat`,
and targeted `git diff`/file reads. I did not run builds, tests, type checks, browsers,
provider calls, or Lab. No behavioral claim above is based on a worker's pass report;
each finding is derived from the current integrated code paths named above.

## Files changed

- Added only `docs/working/mvp-today-plan/reports/t173-cross-repository-review.md`.

## Not verified

- I did not execute the provider retry through a real or fake resolved grant; finding 1
  follows the wrapper/call-settlement path in source and identifies the missing test.
- I did not time a real content action; finding 2 follows the clock arithmetic and the
  unconditional post-wait dispatch in source.
- I did not run a maximum-size directive through recovery; finding 3 follows the stated
  per-field bounds, concatenation order, and final failure-text truncation in source.
- I did not review unrelated extraction-fidelity, Lab, or name-resolution hunks beyond
  what was necessary to check these cross-repository contracts.

## Open questions

1. Is a provider retry intended to count as another credential release (the current
   grant implementation), or as one call under the original authorization (the retry
   module's comments)? The code currently claims both; the contract owner must choose.
2. Should the web command timeout be a hard deadline for all attempts, or only a budget
   for deliberate waiting? The comments and task report promise the former, while the
   loop implements the latter plus one attempt.
