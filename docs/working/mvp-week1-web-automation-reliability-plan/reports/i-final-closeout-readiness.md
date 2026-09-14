# i-final-closeout-readiness — bounded supervisor checklist

Read-only closeout preparation, 2026-09-13. This report does not inspect live
page data, logs, screenshots, credentials, or unfinished run bundles. It changes
no source or shared document and runs no build, test, Lab, comparison, commit, or
push command.

## Disposition

The closeout path is defined but cannot begin until both Stage 4m workers finish
and clean up. The authoritative pins are downstream
`54e30bc127f76041269d3707817c2e78d369c6b2` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`; A owns
`F:\fxlab-runs\final2\a` and B owns `F:\fxlab-runs\final2\b`
(`briefs/finish-week1.md:5383-5407`). At this pass `l-final-bench-a2.md` was
still `in progress`, and no `l-final-bench-b2.md` existed yet. The old
`l-final-bench-a.md` / `l-final-bench-b.md` are stopped historical campaigns and
must not enter any denominator.

The tracked two-report `lab compare` is now the closeout tool. It validates
complete report/run joins, renders all Metrics rows and six criterion figures,
fails closed on one-sided comparable metrics, and emits only bounded comparison
data (`docs/architecture/testing-facility.md:1157-1185`). It replaces the old
scratch `bench-compare.mjs` described in `i-bench-compare-prep.md`.

## Preconditions from each A/B worker

Do not run the comparison until both reports explicitly provide all of these:

1. **Identity and completion:** worker name, worktree, run root, instance/build
   label, full downstream and Core hashes, bench id, command, start/end time,
   exit code, and status `complete`. Both worktrees must finish detached and
   clean at the exact pins above; imported Core packages must resolve to the
   pinned `F:\fxlab\!FluxIQ\packages\...\dist` paths.
2. **Plan accounting:** corpus `week1`, target `isolated`, `repeatCount=3`,
   headed Chromium, provider disabled, LLM calls 0. Require 201 planned records
   (67 per repeat), 189 evaluated records, and exactly 12 W04/W08 Flow planned
   absences. Any other skipped, missing, inconclusive, staging, or unreadable run
   blocks closeout. Each evaluated result identity must have repeat indices
   0, 1, and 2 and a completed bundle.
3. **Per-run truth:** `verdict`, `oracleVerdict`, `reportedVerdict`,
   `failureCategory`, expected/reported automation category, lane, workflow,
   variant, repeat index, `flowCreated`, `startCandidateIndex`,
   `stoppedWithoutFailedAttempt`, `harnessActivations`, action type/status/
   `comparisonStatus`/duration, and run duration. A passed Flow row without a
   created Flow is a blocker. Every executable Flow must start at candidate 0;
   no row may stop without a failed attempt.
4. **Recording integrity:** extension/Core recorded-action counts for every row,
   `recording.persistence` failure count, discard kinds and counts, whether a
   discard names the run's recording or occurs after finalization, and discard
   window exclusions. Any unequal action count, persistence failure, or
   unexplained discard is a blocker even if the A/B metric comparison agrees.
5. **Evidence:** per-lane packet sample count, p50/p95, maximum bytes, marked
   truncation count, evaluator `truncationCount`, and packet-budget invariant.
   Every packet must be at most 6,000 bytes and both truncation counts must agree.
   Report `beforeAction`, `afterAction`, and `stateDiff` coverage for every web
   action.
6. **Safety:** one redaction attestation per completed bundle, literal count,
   finding count, advisory count, and aggregate leak count. Every finding count
   must be 0. Report harness activations per row and in aggregate; all must be 0.
7. **Operations:** initial/minimum/final free memory, memory waits, exact cleanup
   result, zero owned processes/listeners, preserved root, and final worktree/Core
   cleanliness. A worker report is a claim: the supervisor independently checks
   the report files, pins, complete bundle counts, and cleanup before acceptance.

The tracked closeout loader enforces the report-to-runs join: `report.json` and
`runs.json` must expose identical result groups, and every group must contain
exactly the report's repeat count of validated evaluations
(`closeout-comparison.ts:25-34`; `compare-reports.test.ts:185-201`). The
supervisor still verifies the 201-plan/12-planned-absence accounting because
that is outside the aggregated report's evaluated-group check.

## Exact comparison commands

First identify exactly one completed bench directory in each fresh root. Record
the resolved ids and refuse zero or multiple directories:

```powershell
Get-ChildItem -LiteralPath F:\fxlab-runs\final2\a\bench -Directory
Get-ChildItem -LiteralPath F:\fxlab-runs\final2\b\bench -Directory
```

Substitute their absolute `report.json` paths for `<A_REPORT>` and `<B_REPORT>`.
Run from the pushed A worktree, whose test-runner is at the accepted pin. The
benches ran concurrently, so **do not** pass `--sequential`:

```powershell
$env:FLUXIQ_TEST_ENV_FILES = "none"
$env:FLUXIQ_TEST_RUNS_DIR = "F:\fxlab-runs\final2\a"
pnpm -C F:\fxlab\fxlab-09fd9c7-a lab compare "<A_REPORT>" "<B_REPORT>"
```

Capture the single bounded JSON line and `$LASTEXITCODE` in a new private run
artifact such as `F:\fxlab-runs\final2\comparison-a-root.json`; do not pipe it
through a formatter that can hide the command's exit status. The required
primary result is exit 0 and:

- `baselineReportId` = A id and `candidateReportId` = B id;
- `comparisonPassed=true`, `outcome="equivalent"`, and `advisory=[]`;
- every gating `metrics[]` row has `verdict="equivalent"`;
- no `metrics[]` row is `improved`, `regressed`, or `not-compared`;
- `differingVerdicts.results=[]` and `differingVerdicts.runs=[]`;
- all `exitCriteria[]` entries 1-5 have the expected figures below, criterion 5
  has `status="measured"`, and criterion 6 remains `not-measured` until the
  authored ranking is finalized;
- both `persistenceDiscards` sides have zero failures and unreadable files;
- `gaps[]` contains only expected disclosure/external-proof gaps, not a missing
  tolerance-bearing metric.

The CLI accepts bench ids, bench directories, or `report.json` paths, defaults
to `sharedLoad=true`, prints JSON, and exits 1 when `comparisonPassed` is false
(`commands.ts:22,76-87`; `cli.ts:44-49`; `commands.test.ts:144-155`). Absolute
paths are necessary here because A and B use separate run roots.

### Separate-root persistence diagnostic

The metric/report comparison reads both absolute bench directories correctly,
but persistence-event diagnostics resolve each failing run beneath the single
`FLUXIQ_TEST_RUNS_DIR` value (`persistence-discard-diagnostics.ts:13-26`). If
either report contains a `recording.persistence` failure, rerun the same command
with:

```powershell
$env:FLUXIQ_TEST_RUNS_DIR = "F:\fxlab-runs\final2\b"
pnpm -C F:\fxlab\fxlab-09fd9c7-a lab compare "<A_REPORT>" "<B_REPORT>"
```

Keep the baseline discard figures only from the A-root invocation and candidate
figures only from the B-root invocation; require `unreadableEventFiles=0` on the
matching side. Do not interpret an unreadable count from the opposite-root side
as a product result. In the expected clean campaign both persistence-failure
counts are zero, so no event file is opened and one invocation suffices. Any
persistence failure remains a closeout blocker regardless of diagnostic counts.

`pnpm lab compare <report> --halves` is optional and contract-only. With three
repeats it compares repeats 0-1 against repeat 2; it is not the required A/B
closeout view and cannot replace the command above
(`compare-reports.ts:66-95`; `testing-facility.md:1169-1175`).

## Comparison tolerance acceptance

- **Rates:** each comparable lane/rate may differ by at most one workflow of
  that population. The tracked contract supplies the exact numeric tolerance.
  A zero population on both sides is `not-applicable`; one-sided population is
  `not-compared` and fails closeout.
- **Latency:** every action-type p95 must be within 25% of A's p95. Run-duration
  p95 is also within 25%; with a complete Week 1 bench it has far more than the
  20-sample threshold and is gating, not advisory. P50 values are disclosures.
- **Evidence:** packet/raw-snapshot p50/p95 and truncation count have no stated
  A/B tolerance and appear as `no-tolerance-stated`; this does not fail criterion
  5. The independent 6,000-byte packet ceiling and truncation equality still
  must pass in each worker report.
- **Verdicts:** result-level `passRate`/`flakeClass`, every per-repeat verdict,
  and its category must match between A and B. Any entry in either
  `differingVerdicts` array fails, even if aggregate rates remain within one
  workflow.
- **Direction:** a difference outside tolerance in either direction fails.
  “Improved” is not accepted as repeatable agreement; the closeout command's
  `comparisonPassed` deliberately requires no `improved`, `regressed`, or
  `not-compared` row (`closeout-comparison.ts:13-22`).
- **Completeness:** both `repeatCount` values must be at least 3 and all evaluated
  result groups complete. `comparisonPassed` proves only A/B agreement; it does
  not close partially measured external criteria
  (`testing-facility.md:1173-1182`).

These rules implement the plan's “rates within ±1 workflow; latency p95 within
25%” requirement (`mvp-week1-web-automation-reliability-plan.md:564-582`).

## Six exit criteria mapped to evidence

### 1. Core browser actions are reliable

For A and B separately, require every executed unarmed W01-W19 recording and
Flow result to pass all three repeats, with the W04/W08 Flow identities present
only as their 12 planned absences. Every Flow has `flowCreated=true`,
`startCandidateIndex=0`, and matched durable attempts; extension/Core action
counts agree and persistence failures are zero. Confirm the content-script
harness gate remains green at the final pin. Use A/B reports and comparison
criterion 1 (`recordingUnarmedStable/Total`, `flowUnarmedStable/Total`,
`repeatCount`), plus `l-stage2d`'s already accepted W15/W17/W28 observations.
Variants such as W05 `short-catalog` and W13 `banner-absent` do not enter the
unarmed criterion-1 denominator.

### 2. Browser evidence is useful

Require both benches' packet fields above, all packets ≤6,000 bytes,
`truncated` visibly counted, and leak findings 0 for every completed bundle.
Use comparison criterion 2's `packetSamples`/`truncations` only as the bench
portion; it is correctly `partially-measured` because BenchReport does not encode
the external assertions. Pair it with:

- `l-evidence.md`: `sensitive-input` passed both lanes 3/3, with two declared
  literals and zero findings in all six runs;
- the accepted 16-item content-harness assertion gate recorded by
  `f-evidence-items-harness`/the plan ledger;
- `l-final-proofs.md`: live failure-packet budget/truncation proof and the later
  final-bench packet observations;
- W17's zero name/content findings from `l-stage2d`.

Do not claim that `l-evidence` itself observed a live sanitized packet: that
report explicitly says its packet was derived. The live packet proof must come
from `l-final-proofs` and A/B.

### 3. Target matching has deterministic fallback

For each bench require every Flow-lane W20-W23 armed drift result and unarmed
contextual W26 result to pass all three repeats with zero harness activations.
Comparison criterion 3 must show `recoveredWithoutHarness == total` for A and B
and `repeatCount=3`. Separately confirm W26 `no-context` reports
`target_ambiguous` and W29 safely refuses as `target_not_found`; these negative
rows validate safety but are excluded from the recovery numerator by the
tracked tool (`testing-facility.md:1183-1185`).

### 4. Failures are meaningfully classified

Comparison criterion 4 must show the required W14/W19/W27 negative variants at
≥0.90 independently in A and B (`requiredCorrect/requiredTotal`), with
`repeatCount=3`. With 15 required evaluations per bench this means at least
14 correct. Inspect every miss by row, expected category, reported category,
and verdict. Record `allCorrect/allTotal` for every negative variant alongside
the judged rate, but do not substitute it for the verbatim objective's required
denominator. Confirm the already accepted W15 `output_not_observed`, W25
`web.action.timeout`, W10/W27 `navigation_unexpected`, and W19 `auth_required`
proofs remain consistent.

### 5. FluxBench is repeatable

Require both complete repeat-three reports, comparison exit 0,
`comparisonPassed=true`, every tolerance-bearing metric equivalent, zero
one-sided comparable metrics, zero differing results/runs/categories, and
criterion 5 `status="measured"`. Record the full bounded metric table, including
rates, action p95s, run-duration p95, evidence disclosures, `advisory`, and the
shared-load label. Also require zero persistence failures/discards and the two
clean worker cleanup attestations. The A/B run is the two-run proof; optional
within-report halves are diagnostic only.

### 6. Major reliability blockers are identified

Update `i-ranking-draft.md` from draft to final. Fill every placeholder from A,
B, comparison, and the named prior proofs. For every failure/flaky row rank by:
frequency in A and B, MVP-loop impact, reproducibility, owning phase, status
(`closed`, `Week 1 blocker`, `Week 2`, or later), and exact supporting report.
Any discrepancy between A and B, persistence loss, leak, harness activation,
false success/failure, missing packet, or unclassified required negative is a
Week 1 blocker until resolved or explicitly ruled with a ledger reason.
Comparison criterion 6 remains `not-measured` by design; the completed authored
ranking and Phase 1.6b ledger entry are its proof.

## Exact authored closeout updates

After independent verification, the supervisor should make one coherent
documentation/closeout work unit:

1. Preserve worker reports
   `reports/l-final-bench-a2.md` and `reports/l-final-bench-b2.md` as the bounded
   source observations. Add `reports/l-final-bench-comparison.md` containing the
   resolved report ids/paths, exact compare command and exit, top-level compare
   fields, complete metric verdict table, six criterion figures, persistence
   diagnostics, expected gaps, and supervisor verification. Keep raw one-line
   JSON only under `F:\fxlab-runs\final2\`.
2. Update `reports/i-ranking-draft.md` in place: remove placeholders/stale Stage
   3 framing, mark the outcome final, and rank observed remaining items. Do not
   discard ruled-out history. Update `reports/i-week2-entry-points.md` only where
   its “Depends on Week 1” statements are now stale; code entry points remain
   unchanged unless A/B found a contradiction.
3. Update authored architecture required by Phase 1.6b
   (`mvp-week1-web-automation-reliability-plan.md:541-559`):
   `docs/architecture/testing-facility.md` with final command/report facts,
   `docs/architecture/web-capabilities.md` with the final capability matrix, and
   `docs/architecture/extension-client.md` with final evidence/failure behavior.
   Change only facts the accepted A/B evidence supports.
4. Rewrite the authoritative `Current State` in
   `docs/working/mvp-week1-web-automation-reliability-plan.md`: quote all six
   observed criterion figures, name the comparison report and accepted pins,
   replace the queue with Week 2 handoff, set `Status: Complete`, update status
   detail/date, and retain genuine known limits as ruled/deferred—not open Week
   1 work. Current State wins over history and must remain under 150 lines
   (`agent-working-doc-protocol.md:140-150`).
5. Append one Phase 1.6b closeout ledger entry, at most 15 lines, with agent,
   changed files, reason, exact commands and observed outputs, outcome, and
   follow-up (`agent-working-doc-protocol.md:152-168`). The plan is currently
   791 lines; keep it at or below its stated 800-line budget. If the edits would
   cross 800, first move settled ledger detail verbatim to a new
   `archive/2026-09-13-finish-week1-closeout.md`, leave a one-line pointer, and
   record the compaction. Evidence moves; it is not deleted
   (`agent-working-doc-protocol.md:172-184`).
6. Regenerate/update `docs/working/README.md` because the working document's
   status and line count change (`agent-working-doc-protocol.md:262-268`). Add
   the protocol-required one-line paired ledger reference in
   `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md`; the
   full closeout entry remains in this repository
   (`agent-working-doc-protocol.md:254-260`).
7. Run and record the supervisor's documentation links/structure check and the
   repository validation appropriate to the final authored/source state. Only
   after all checks pass should the supervisor commit and push the coherent
   closeout. Preserve all `final2` artifacts and never commit run roots, secrets,
   page data, browser profiles, or raw comparison inputs.

If any criterion does not meet its threshold, leave the plan `Active`, append a
`Partial` or `Blocked` ledger entry with the observed bounded figures, update the
ranking, and dispatch the smallest owning fix. Do not turn A/B agreement on the
same wrong behavior into acceptance.
