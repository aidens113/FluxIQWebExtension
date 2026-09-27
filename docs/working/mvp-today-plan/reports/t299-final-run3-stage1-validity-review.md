# t299 Final Run-3 Stage-1 Validity Review

Status: **Conditional GO — create the pending debug only after the provider-free dry-run passes.**

## Verdict

The exact Stage-1 block in t262 remains accurate after the settled t258 production change and the
t290/t293 test-only reconciliations. No Stage-1 wording correction is required. T266's corrected
capture procedure also remains the required procedure; do not reuse the older t249 helper
unchanged.

This is not authorization to create the pending debug now. The complete final-tree Core root test,
final identity, repeated one-Lab check, and unchanged zero-provider dry-run remain serial
preconditions in t297. If the dry-run passes its exact readiness facts and the pending path is
unused, the supervisor has **GO to create and attest**
`docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md` from t262. After that
attestation, repeat the one-Lab check before the single live invocation.

## Change-under-measurement validity

T262 truthfully describes the production behavior under measurement:

- request provenance distinguishes pre-request setup from truthful provider-attempt state;
- the Router-selected Subflow is preserved for repaired replay;
- only the same held, claimed, idle run grant may continue across the exact authorized binding
  change;
- t258 retains that exact run-owned grant only for private nested reauthoring, durably applies the
  approved adaptation under the Flow lock, reads the authoritative applied binding, continues the
  same grant, releases the lock, replays the selected Subflow without a provider call, recursively
  judges the replay, and leaves terminal revocation to the enclosing run;
- a post-apply binding-read or continuation refusal remains `applied:true`, closes with
  `replayReady:false` and typed privacy-safe `grant_continuation` provenance, and performs neither
  replay nor the fourth judgement.

T290 changed only recovery permission assertions, confirming the already-settled risk-only rule:
ordinary creation is ungated while uninstructed/ungranted sending is held. T293 changed only a
deadline test fixture, replacing a wall-clock race with a typed post-endpoint-entry timeout. Neither
changes production behavior, the 26-call profile, the expected live provider sequence, capture
shape, oracle, permission expectation, or authority/accounting invariants. They therefore must not
be added to Stage 1 as product changes under measurement.

The remaining Stage-1 facts are still exact: the verbatim task; nine-step expected chain; exact
ordered 13-record oracle and four fields; wrong-answer counterexamples; zero expected permission
questions; expected two initial verification calls, one reauthor decision, zero-provider selected-
Subflow replay, and one post-replay verification when repair is needed; and the rule that a pass
advances the streak only from 0 to 1.

## No-hindsight and capture validity

The final serial boundary is:

1. Finish the final root/identity/one-Lab/dry-run gates without creating a pending debug.
2. Require dry-run exit zero and the reviewed ready facts: `status:"ready"`,
   `providerCallCount:0`, `lane:"created-flow"`, `target:"isolated"`, and matching scenario,
   workflow, task, oracle, and replay facts.
3. Assert the pending path does not exist; create it with t262's exact header and Stage 1; manually
   attest all fields remain pending and contain no run-derived knowledge.
4. Repeat the one-Lab process/lock gate and load the credential process-only.
5. Invoke the unchanged default-profile live command exactly once. Keep stdout in memory, discard
   stderr, parse only the final JSON line, validate a safe run id, and never print/save the raw
   result object.
6. Rename the pending debug to `<run-id>.md` immediately after obtaining the safe id and before
   checking the bundle path or invoking `inspect`. Never overwrite an existing destination.
7. Validate the default run path and closed CLI verdict; then run `inspect` in memory with stderr
   discarded. Require matching identity/path and valid completion/index hashes.
8. Apply t266's artifact-index and manifest redaction gate before semantic reads. Only then read the
   minimal structured artifacts in its prescribed order and complete the bound debug without
   changing Stage 1.

A nonzero live exit with a safe run id can still be a valid product-failure measurement and must be
inspected and fully debugged. Missing/unsafe identity, wrong root, integrity failure, identity
mismatch, or redaction failure stops evidence reading and every further provider call. The bound
debug remains. Use `NO EVIDENCE:` rather than widening the read set, and never expose raw
prompts/responses, stderr, logs, page/record data, credentials, authorization material, browser
state, or provider sidecars.

## Copy-ready decision after dry-run

If every precondition above is green, record:

```md
Run-3 Stage 1/capture review: GO. The provider-free dry-run passed the reviewed ready facts; the
pending debug path was unused; t262 remains the no-hindsight Stage-1 source; and t266 remains the
capture/privacy procedure. Creating and attesting the pending debug does not change the live streak,
which remains 0 until a finalized integrity-valid live run passes.
```

If the dry-run fails or its facts differ, record the bounded mismatch and **do not create the
pending debug**. If the pending path already exists, stop and reconcile it without overwrite; do
not infer it belongs to the upcoming run.

## Scope

This review read only the required reports and wrote this report. It did not change either active
plan, source, generated outputs, pending debug/run artifacts, build output, provider/browser/Lab
state, or the live streak. No command described above was executed.
