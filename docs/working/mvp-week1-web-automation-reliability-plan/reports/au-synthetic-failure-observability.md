# `au-synthetic-failure-observability` — durable facility diagnostics

## Outcome and correction

There is a durable observability gap, but the current W25 observation is **not**
the no-final-bundle case described in `at-w25-diagnosis`.

The immutable W25 evaluation says `verdict: failed` and its runner invariant is
`failed: environment.missing`. A synthetic attempt from
`evaluateFailedAttempt` would instead be `verdict: inconclusive` with
`runner threw before finalizing a bundle: environment.missing`
(`bench/evaluate-run.ts:110-133`). The W25 run therefore finalized a bundle and
was evaluated through the ordinary failed-run path. The contrary boundary
claim in `at-w25-diagnosis` is incorrect and must be rewritten; it must not be
used to choose a fix.

The corrected conclusion is narrower: W25 durably records the category
`environment.missing`, but its immutable `evaluation.json` records no sanitized
operation stage or cause code. The category proves a facility failure before a
runnable Flow was observed; it does not identify which finalized-run stage
failed.

## What survives today

### Finalized-bundle failures, including W25

`runScenario` converts a caught error to an error event at
`run-scenario.ts:377-395`. The event may carry one of the existing closed
projections: finalization wait, pairing wait, HTTP transport, or topology
readiness. The HTTP projector allows only a fixed operation stage, the literal
transport category `network`, and an allowlisted transport code
(`http-control/index.ts:189-204`). The readiness projector allows only
`scenario.health` or `core.health`, `bounded: timeout`, and a bounded timeout
(`http-control/index.ts:208-222`). Their tests reject raw targets, paths,
bodies, messages, and foreign codes.

Those safe details do not enter `RunEvaluation`. The contract contains only
`failureCategory` plus free-text invariant fields
(`test-contracts/src/evaluation.ts:63-96`), and its exact-key validator has no
diagnostic field (`evaluation-validation.ts:8-34`). `singleRunEvaluation`
receives closing events as only `{ sequence, trigger }`, so it cannot project
their details (`run-evaluation/single-run-evaluation.ts:8-31`).

On later bundle reading, `closingEvents` deliberately reduces the matching
error event to `{ message, category }`; it discards `details.failureDetails`
(`bench/read-run-bundle.ts:100-121`). The aggregate can therefore retain a
human message while the process remains uninterrupted, but it cannot recover a
typed stage/code from the immutable evaluation after a crash or resume. In the
W25 receipt, the only durable diagnostic dimension is
`failureCategory: environment.missing`.

### No-final-bundle failures

The gap is larger when `runScenario` throws without finalizing a bundle.
`run-bench.ts:247-256` calls `evaluateFailedAttempt`, hashes that immutable
evaluation into the completion checkpoint, and holds the thrown message only
in the transient `observed` object. The evaluation stores only the classified
category (`evaluate-run.ts:110-133`).

During resume, `validateCompleted` reconstructs a bundle-less accepted cell
from the hashed evaluation (`run-bench.ts:286-302`).
`recordFromEvaluation` can recover a cause only from the transient `observed`
argument or a finalized bundle (`run-bench.ts:509-512`), neither of which
exists on this path after process loss. Consequently the cause that appeared
in an uninterrupted `runs.json` is replaced after resume by no cause at all.
The existing resume tests prove checkpoint/evaluation identity and exact-once
execution, but do not crash after persisting a synthetic failure and compare
its diagnostic before and after resume (`bench/tests/run-bench.test.ts:155-215,
427-437`).

The bundle's `bench-receipt.json` cannot fill this role. It is intentionally an
identity-only, exact-key object and rejects secret-bearing field names
(`bench/bench-receipt.ts:3-8, 28-62, 84-99`). A synthetic failure has no
finalized bundle in which to put one anyway.

## Required contract

The smallest reliable seam is the artifact already made immutable and linked
from every completion checkpoint: `RunEvaluation`. Add a required nullable
field such as:

```text
facilityFailure: null | {
  boundary: "finalized-bundle" | "no-final-bundle",
  stage: <closed facility-stage enum>,
  reason: <closed facility-reason enum>,
  operationStage?: <existing closed HTTP/readiness operation enum>,
  causeCode?: <existing allowlisted OS/module/transport code>
}
```

This must never contain a message, path, URL, port, request/response data,
arbitrary error code, or arbitrary key. Suggested coarse stages are
`scenario.load`, `bundle.initialize`, `scenario.execute`, `scenario.cleanup`,
`bundle.publish`, and `bench.persist`; they identify the owning boundary
without describing page state. Suggested reasons are `readiness.timeout`,
`http.timeout`, `http.abort`, `http.transport`, `module.missing`,
`path.missing`, `path.denied`, and `unclassified`. Reuse the existing HTTP and
readiness allowlists rather than independently restating them.

`runScenario` should track only those coarse stages and project the caught
failure once. A finalized run passes the projection into
`singleRunEvaluation`; an outer throw is wrapped with the same closed
projection so `evaluateFailedAttempt` can persist it. The bench should derive
any rendered diagnostic from `evaluation.facilityFailure`, never preserve a
raw thrown message as its durable source. `readRunBundle` may continue reading
the one-line event summary for local troubleshooting, but resume correctness
must not depend on it.

`facilityFailure` must be `null` for a pass and for a product/automation result
with no facility failure. It must be non-null for every synthetic
no-final-bundle evaluation. For a finalized facility failure it is present
when a stage is known; an unprojectable error uses the literal
`reason: unclassified`, not raw fallback text. The validator should reject a
diagnostic paired with an automation-only failure and reject absent diagnostics
on the synthetic path.

## Compatibility

This changes an exact-key contract. Do not silently add it while continuing to
write evaluation schema `0.1`. Bump the evaluation schema, make the new writer
emit the new version, and either:

1. retain an explicit legacy `0.1` reader that normalizes missing
   `facilityFailure` to `null`; or
2. document that old evaluation artifacts require the old clean pin.

Option 1 is preferable for comparing completed historical campaigns. The
campaign semantics/compatibility identity must also change so a paused
campaign cannot resume with mixed old/new evaluation shapes. The currently
paused confirmation campaigns remain resumable only from their exact original
clean pin; they were already invalidated as acceptance evidence, so they must
not be migrated in place. `BenchReceipt` and checkpoint schemas need no field
change: the checkpoint's existing evaluation digest authenticates the added
diagnostic.

## Minimum tests

1. Contract validation accepts every closed combination and rejects unknown
   stages/reasons/codes, extra keys, oversized numbers, and sentinels placed in
   message/path/URL/body/credential-shaped keys. A pass with a facility failure
   and a synthetic evaluation without one both fail validation.
2. Projector tests inject raw sentinels and nested causes at each outer stage.
   Serialized diagnostics contain none of them and expose only allowlisted
   enum values. Mutating a stage or widening a raw spread must fail.
3. `singleRunEvaluation` preserves a finalized-bundle HTTP/readiness projection
   field-for-field into its parsed `evaluation.json`; an ordinary W25 timeout
   has `facilityFailure: null` because it is an expected automation result.
4. `evaluateFailedAttempt` persists a no-final-bundle projection with null
   automation verdicts and no actions/evidence, retaining its current
   inconclusive semantics.
5. A durable campaign test throws a projected outer failure, crashes after its
   completion checkpoint, resumes, and asserts the same diagnostic in the
   immutable receipt and regenerated `runs.json`/Markdown. It also asserts the
   scenario is not executed twice and the raw sentinel appears nowhere in the
   campaign directory.
6. A legacy-reader test parses a schema-0.1 evaluation without the field; a
   mixed-shape resume is refused by campaign compatibility rather than partly
   aggregating.

## Recommendation

Implement the typed evaluation field before another multi-hour confirmation
pair. This is a test-facility contract change, not a FluxIQ Core or extension
change. It should not alter verdicts, retries, W25 timing, or product behavior.
After its unit/mutation/resume proofs, run the three focused W25 validations
recommended by the corrected diagnosis; only then start a fresh clean-pinned
A/B campaign.

## Audit boundary

I inspected only `at-w25-diagnosis`, the evaluation and bench-receipt contracts,
the two existing failure projectors, `runScenario`'s outer evaluation boundary,
the bench's failed-attempt persistence/resume path, and their owning tests. I
did not inspect raw artifacts, event contents from the live run, process logs,
screenshots, page data, or secrets. I changed only this report, ran no Lab or
full corpus, and did not commit or push.
