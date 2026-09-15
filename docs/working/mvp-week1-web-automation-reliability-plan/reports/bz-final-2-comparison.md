# `bz-final-2-comparison` — official sharded-final-2 A/B comparison (Week 1 closeout)

## Outcome

The senior supervisor ran the official comparator from `F:\!FluxIQWebExtension` at clean
`3d6ecd6`, directly through the built CLI, against the two sealed campaign reports:

```text
node packages/test-runner/dist/cli.js compare F:\fxlab-runs\sharded-final-2\a\bench\bench-mu202a52-127f75c3\report.json F:\fxlab-runs\sharded-final-2\b\bench\bench-mu202snn-ec661de2\report.json
```

It exited 1 with empty stderr. The `pnpm lab compare` wrapper was bypassed on purpose: every
`pnpm lab` invocation rebuilds the shared `domain/dist`, which would have disturbed Lab runs
executing at the same time. I did not run the comparator; this report reads its saved stdout.

The output says `outcome: equivalent` and `comparisonPassed: false`, with `advisory: []`. The
two facts are distinct on purpose. Every metric that carries a Week 1 tolerance was equivalent
(23 of 23), none was outside tolerance and none was absent on one side. The comparison still
did not pass because two results, and one underlying run in each, have different verdicts:

- W14 `modal-flows` / `interstitial`, Flow lane, repeat 2: passed in A, failed in B.
- W28 `iframe-checkout` (primary workflow, no variant), recording lane, repeat 1: failed in A,
  passed in B.

Nothing else differs. The two campaigns ran the identical topology, and the comparator marks
it `identical: true`:

| | A (baseline) `bench-mu202a52-127f75c3` | B (candidate) `bench-mu202snn-ec661de2` |
| --- | --- | --- |
| mode | `sharded` | `sharded` |
| algorithm | `result-round-robin-v1` | `result-round-robin-v1` |
| shardCount | 3 | 3 |
| jobs | 2 | 2 |

Both differing runs failed inside topology startup, before any browser was launched or any step
ran. The user accepted both as disclosed exceptions belonging to one classified startup failure
class (see "Differing verdicts"). Under that decision Week 1 closes with these two exceptions
disclosed; the comparator itself does not treat `outcome: equivalent` as a pass while
`comparisonPassed` is false.

## Differing verdicts

The comparator's `differingVerdicts` holds exactly two results and two runs.

| Row | Scenario / workflow | Lane | A result verdict | B result verdict | Differing run | A run | B run | Category |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W14 | `modal-flows` / `interstitial` | flow | `stable-pass:1` | `flaky:0.6666666666666666` | repeat 2 | passed | failed | B `process.startup` |
| W28 | `iframe-checkout` / (primary) | recording | `flaky:0.6666666666666666` | `stable-pass:1` | repeat 1 | failed | passed | A `gateway.connection` |

In both result rows the extra fields (`runs: 3`, `passRate`, `flakeClass`) carry the baseline
(A) side's values: W14 `passRate 1`, `stable-pass`; W28 `passRate 0.6666666666666666`, `flaky`.

### W14 Flow repeat 2 in B

From the supervisor notes (sections "Observed at 20:35-20:45 local", "Root cause and fix", and
B's second resume output in "B resume attempt"):

- Run `bench-shard1-d0825d39-c35-a1`, attempt 1. Evaluation category `process.startup`; typed
  facility failure `finalized-bundle / scenario.execute / http.timeout / project.select /
  30000 ms`. B's resumed bench outcome lists the same cause: `1 run — process.startup:
  finalized-bundle / scenario.execute / http.timeout / project.select / 30000ms`.
- `flowCreated` false, zero actions, zero evidence, zero harness activations, 92,820 ms.
- The timeout was the first `selectProject` POST inside topology startup
  (`coordinator.ts:137`), before any browser or step. Supervisor-verified evidence: `run.json`
  has `ports: {}`, `processExits: {}`, `steps: []`, `actions: []`. The notes record that
  `metrics.steps` is the recording script length, not executed steps, and correct the earlier
  "after 3 recorded steps" wording as wrong.
- The notes classify it as the route's first hit on a fresh `next dev` Core, an on-demand
  compile under load. The Next.js-level mechanism was traced in source by a worker, not
  observed, and a startup failure deletes its own Core log, so none survived.
- Same-result peers passed: A repeats 0-2 (100.8, 68.1, 114.1 s) and B repeats 0-1 (110.0,
  92.5 s).

### W28 recording repeat 1 in A

From the notes section "Second unexpected failure" and the `bq` report's failed-run table:

- Run `bench-shard1-9c95f372-c64-a1`. Evaluation category `gateway.connection`; typed facility
  failure boundary `finalized-bundle`, stage `scenario.execute`, reason `unclassified`, with no
  operation stage or timeout because `waitForTcpGateway`'s failure has no closed projector.
- Oracle and reported verdict null, 0 actions, 0 packets, harness 0, 112,619 ms. `run.json`:
  steps 0, actions 0, `ports` empty, `processExits` `{}` (topology never set). One `error`
  event, "Timed out waiting for client gateway on 127.0.0.1:<port>".
- Source per the notes: after `GET /` readiness, a snapshot probe meant to start Core's lazily
  created gateway runs, then a 60 s TCP wait timed out (`coordinator.ts:121-122`). The notes
  classify it as the same dev-server startup class as W14, at a different stage.
- Peers recorded at the time: A repeat 0 passed (79,747 ms), B repeat 0 passed (69,453 ms),
  B repeat 1 passed (47,541 ms). The comparator's verdicts imply both repeat 2 runs also passed
  (A `flaky` at 2/3, B `stable-pass:1`).
- Memory during the window: available 7,666-10,877 MiB, commit 80-88%, no memory pressure.
- Load disclosure recorded by the supervisor: its own worktree build and 822-test suite, and a
  preceding worker's builds and tests, ran about 22:00-22:11 local and overlapped this window.
  A likely CPU contributor, not provable. The W14 failure (about 20:19-20:21) predates that
  load.

### User decisions

- About 20:45 local, for W14: "Both: close tonight + fix" — close Week 1 with the Core timeout
  disclosed as a classified infrastructure failure, and fix the cause in parallel.
- About 22:15 local, after W28: "Two exceptions, close tonight" — close Week 1 with both
  startup failures disclosed as one classified infrastructure failure class, knowing the
  comparison would show two differing verdicts, then run an overnight production-build pair to
  supersede both exceptions.

The focused 3/3 proofs of W14 Flow and W28 recording and the overnight pair are outside this
report's inputs; I make no claim about their results.

## Metrics and tolerances

The comparator renders 48 metric rows (`metricsRendered: 48` on both sides):

- 23 tolerance-bearing rows: **23 equivalent, 0 outside tolerance, 0 absent on one side**
  (`outsideTolerance: 0`, `absentComparableMetrics: 0`).
- 4 `not-applicable` rows, all in the recording lane: `flowCreationSuccess`, `fuzzyRecovery`,
  `falseSuccess`, `failureClassificationAccuracy` ("neither report has a population or
  measurement for this metric").
- 21 `no-tolerance-stated` disclosure rows.

### Tolerance-bearing rows (values as printed)

| Metric | A | B | Tolerance | Verdict |
| --- | --- | --- | --- | --- |
| recording initialExecutionSuccess | 0.21739130434782608 | 0.21739130434782608 | 0.043478260869565216 | equivalent |
| recording deterministicReplaySuccess | 0.21739130434782608 | 0.21739130434782608 | 0.043478260869565216 | equivalent |
| recording falseFailure | 0 | 0 | 0.2 | equivalent |
| recording harnessActivation | 0 | 0 | 0.043478260869565216 | equivalent |
| flow flowCreationSuccess | 1 | 1 | 0.025 | equivalent |
| flow initialExecutionSuccess | 0.9310344827586207 | 0.9310344827586207 | 0.034482758620689655 | equivalent |
| flow deterministicReplaySuccess | 0.9310344827586207 | 0.9137931034482759 | 0.034482758620689655 | equivalent |
| flow fuzzyRecovery | 0.75 | 0.75 | 0.125 | equivalent |
| flow falseFailure | 0.03571428571428571 | 0.03614457831325301 | 0.03571428571428571 | equivalent |
| flow falseSuccess | 0 | 0 | 1 | equivalent |
| flow failureClassificationAccuracy | 0.9090909090909091 | 0.9090909090909091 | 0.09090909090909091 | equivalent |
| flow harnessActivation | 0 | 0 | 0.025 | equivalent |
| p95 `web.browser.navigate` (ms) | 2287 | 2294 | 571.75 | equivalent |
| p95 `web.browser.tab` | 1040 | 1057 | 260 | equivalent |
| p95 `web.dom.check` | 2057 | 2065 | 514.25 | equivalent |
| p95 `web.dom.click` | 2383 | 2380 | 595.75 | equivalent |
| p95 `web.dom.keypress` | 2053 | 2064 | 513.25 | equivalent |
| p95 `web.dom.scroll` | 2085 | 2086 | 521.25 | equivalent |
| p95 `web.dom.select` | 2041 | 2048 | 510.25 | equivalent |
| p95 `web.dom.type` | 2066 | 2064 | 516.5 | equivalent |
| p95 `web.dom.upload` | 2050 | 2061 | 512.5 | equivalent |
| p95 `web.dom.wait_for_selector` | 7046 | 7032 | 1761.5 | equivalent |
| run-duration p95 (ms) | 113134 | 113054 | 28283.5 | equivalent |

Notable figures:

- **Flow deterministic replay** is the only rate that moved materially: 0.9310 in A versus
  0.9138 in B, a difference of 0.0172, half its 0.0345 tolerance.
- **Flow false failure** was 0.0357 in A versus 0.0361 in B (difference 0.0004; tolerance
  0.0357). Recording false failure was 0 on both sides.
- Harness activation was 0 in both lanes on both sides. Flow creation was 1 on both sides.
- **Run-duration p95** was 113,134 ms versus 113,054 ms, 80 ms apart against a 28,283.5 ms
  tolerance.
- **`web.dom.wait_for_selector` p95**, the largest latency, was 7,046 ms versus 7,032 ms against
  a 1,761.5 ms tolerance. The largest p95 difference was `web.browser.tab`, 17 ms (1,040 versus
  1,057) against 260 ms. In this output every p95 tolerance equals 25% of A's value.
- The criterion 5 note records that latency was measured under shared load.

### Disclosure rows without a Week 1 tolerance

- Action-latency p50 (ms, A/B): navigate 1731/1727, tab 1030/1030, check 2039/2038, click
  2340/2342, keypress 2042/2042, scroll 2055/2059, select 2036/2026, type 2040/2039, upload
  2044/2050, `wait_for_selector` 2045/2042. Run-duration p50 93,100/92,168 ms. Note: "Week 1
  repeatability tolerance applies to latency p95 only".
- Sanitized evidence packet bytes: p50 4,069 and p95 5,934 on both sides.
- Raw-snapshot bytes p50 and p95: null on both sides.
- Evidence truncation count: 167 in A, 165 in B.
- Reserved Week 2 fields `harnessRecovery`, `adaptationCost`, `adaptationValidation`,
  `adaptationPersistence`, `adaptationReuse`: null on both sides, as Week 1 requires.

The comparator's `gaps` list has 23 entries: these 21 no-tolerance rows, plus criterion 2's
external evidence assertions and criterion 6's blocker ranking, neither encoded in BenchReport.

## Exit-criterion projection

| # | Criterion | A | B | Status |
| --- | --- | --- | --- | --- |
| 1 | `actions-reliable` | recording unarmed stable 18/18; Flow unarmed stable 16/16; packets 618, truncations 167; fallback 5/5 without harness; required negatives 15/15; every negative 30/33; repeatCount 3 | recording unarmed stable 18/18; Flow unarmed stable **15/16**; packets 608, truncations 165; fallback 5/5 without harness; required negatives 15/15; every negative 30/33; repeatCount 3 | measured |
| 2 | `evidence-useful` | packetSamples 618, truncations 167 | packetSamples 608, truncations 165 | partially measured |
| 3 | `deterministic-fallback` | 5/5 recovered without harness, repeatCount 3 | 5/5 recovered without harness, repeatCount 3 | measured |
| 4 | `failures-classified` | required 15/15; all 30/33; repeatCount 3 | required 15/15; all 30/33; repeatCount 3 | measured |
| 5 | `bench-repeatable` | metricsRendered 48; outsideTolerance 0; differingResults 2; differingRuns 2; repeatCount 3 | metricsRendered 48; absentComparableMetrics 0; differingResults 2; differingRuns 2; repeatCount 3 | measured |
| 6 | `blockers-ranked` | rankedBlockers null | rankedBlockers null | not measured |

Plainly:

1. **Criterion 1** covers unarmed W01-W19 results stable across every repeat. B's Flow side is
   15/16. W14 is inside that range and is the only Flow row whose verdict differs between the
   campaigns, which is consistent with W14 being the unstable row, but the projection does not
   name it. W28 lies outside W01-W19, so A's recording side stays 18/18. The JSON does not
   attribute B's 10 fewer packets or 2 fewer truncations to any run.
2. **Criterion 2** is only partially measured. BenchReport carries packet samples and
   truncations, but not the external 16-item evidence assertion or the sensitive-input leak
   assertion; those must come from outside this comparison.
3. **Criterion 3** covers the W20-W23 drift variants and unarmed contextual W26: every repeat
   passed with zero harness activations on both sides.
4. **Criterion 4**: the required W14/W19/W27 categories were 15/15 on both sides against a
   target of at least 0.9. All negative variants were 30/33 on both. For A, the `bq` report's
   failed-run table shows the three W24 `unannounced` runs with expected `output_not_observed`
   and observed `runtime.behavior`, consistent with the three misses. B's three misses are not
   itemised in my inputs; the notes checked B's W24 repeat 0 only and found the same shape.
5. **Criterion 5**: zero tolerance-bearing metrics outside tolerance and none absent, but two
   differing results and two differing runs (W14 and W28 above), so the comparison did not pass.
6. **Criterion 6** is not measured by BenchReport at all: the Phase 1.6b blocker ranking is
   authored ledger evidence, not a report field.

## Persistence discards

The comparator's persistence-discard projection is zero on both sides, in every field:

| Field | A | B |
| --- | --- | --- |
| persistenceFailures | 0 | 0 |
| runsInspected | 0 | 0 |
| actionDiscardEntries | 0 | 0 |
| eventDiscardEntries | 0 | 0 |
| maxDiscardedActions | 0 | 0 |
| maxDiscardedEvents | 0 | 0 |
| entriesNamingRecording | 0 | 0 |
| entriesAfterFinalization | 0 | 0 |
| excludedByWindow | 0 | 0 |
| unreadableEventFiles | 0 | 0 |

`runsInspected` is 0 on both sides even though each campaign has ten failed runs, so these zeros
record that the projection inspected no run; the JSON does not state which runs are eligible.
Separately, the `bq` report found no recording-persistence field in A's `report.json` or bundle
files.

## Campaign durability

### A: verified by `bq-sharded-final-2-a`

From `F:\fxlab-runs\sharded-final-2\reports\bq-sharded-final-2-a.md` (a worker's read-only
verification):

- Pins: downstream `3d6ecd645e92f1899853e6cbf54f9cbb5ea136da`, Core
  `19468b72c4472fd5cc58940737702d5e4d72c985`; `shard-parent`, `result-round-robin-v1`,
  shardCount 3, jobs 2; repeat 3, target `isolated`, evidence `failure`.
- 189/189 evaluated plus 12 planned skips (201-cell plan); 0 duplicate, missing or extra keys.
- Checkpoint chains parent/000/001/002: 3/134/122/128 generations, contiguous and hash-linked,
  all terminal `finished`, no active attempt.
- Evaluation, receipt and bundle parity 189/189; merge seal 24/24 digests match; 0 leases,
  staging, `interrupted` or `.tmp` files; `.work` empty.
- 179 passed, 10 failed: 3 each of W05 `short-catalog`, W13 `banner-absent`, W24
  `unannounced` (all `runtime.behavior`, no facility failure), plus W28 recording repeat 1.
- Harness 0; redaction attestation findings 0 (180 not applicable, 9 passed); packet p50/p95
  4,069/5,934 bytes, maximum 5,992; truncations 167; run duration p50/p95 93,100/113,134 ms.
  These agree with the comparator's A-side values.

### B: one manual step before the merge sealed

From the notes sections "Terminal at 00:05 local" and "B resume attempt":

- At 00:05 all three B shards were `finished` (generations 134/122/128, no active attempt, no
  lease), but the parent had not merged: no `merge-seal.json`, one `running` parent checkpoint,
  no parent projections, and no bench process alive. The parent's own stdout was not captured,
  so its original exit error is unobserved.
- Shard 002's `evaluations/` held its 63 referenced evaluations plus one unreferenced temporary
  file, `.bench-shard2-fdae3012-c15-a1.json.10996.<hex>.tmp` (1,010 bytes, written 22:46:56),
  left by the durable write of c15's evaluation, whose final file existed. Source per the notes:
  `durable-file.ts:100-111` publishes by `link(temporary, target)` and then removes the
  temporary; a failed removal on Windows leaves exactly this orphan.
- An exact-ID resume at the clean pin failed closed in 22 s with "Shard evaluation directory
  contains a missing or orphan receipt" (`bench/shard-merge.ts:114-123`,
  `assertExactEvaluationFiles`, compares directory entries, dot files included, exactly).
- **With the user's approval (about 00:20 local, "Quarantine file, resume B")**, the orphan was
  moved, never deleted, to `F:\fxlab-runs\sharded-final-2\quarantine\b-shard002-evaluations\`.
  Observed before the move: the orphan's SHA-256 was identical to the published evaluation's
  (prefix `9C65986BFBC5F1C3`). After it: shard 002 `evaluations/` held 63 files and 0 dot files.
- The second resume at `3d6ecd6` / Core `19468b7` (both clean) published the merged report:
  189 runs, 179 passed, 12 skipped, 55 not executed, 334 actions executed, failure causes 9
  `runtime.behavior` plus the W14 `process.startup` run. Its exit 1 is the bench verdict (any
  failed run fails a bench), not a merge failure. The supervisor then observed `merge-seal`
  present, 3 parent checkpoints ending `finished`, no active attempt, 0 parent chain gap or link
  errors, 0 leases, shard evaluation directories 66/60/63 with 0 dot files, and `b\.work` empty.
  Both resume logs were checked for the fixture secret by flag only: `secret-in-log=False`.
- B's full terminal verification is the `br-sharded-final-2-b` report, expected at
  `F:\fxlab-runs\sharded-final-2\reports\br-sharded-final-2-b.md`. It was not present when
  this report was written, so none of its findings are reflected here.

## What changed and why

Only this report file was created. No repository, campaign, quarantine or scratchpad file was
modified.

## Commands run and observed results

No commands were run. I read the comparator's saved stdout
(`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\3454178a-dd53-4d6d-917d-85b8f63d0d91\scratchpad\compare-final-2.json`),
the `ah-final-repaired-comparison` template, the supervisor notes, and the `bq` report, and
listed `F:\fxlab-runs\sharded-final-2\reports\*.md` once to find the `br` report (absent). The
comparator's exit 1 and empty stderr are the supervisor's observation, taken from the brief.

## Not verified

- The comparator run itself, its exit code and stderr: not rerun by me.
- Anything in campaign B's bundles, and the `br` report's findings (not yet written).
- The focused W14 and W28 3/3 proofs and the overnight production-build pair.
- The startup-failure mechanisms at Next.js level: recorded in the notes as traced in source or
  inferred, not observed.
- Which runs the persistence-discard projection considers eligible, given `runsInspected: 0`.
- B's three all-negative classification misses as individual runs.
- No raw page data, event payloads, logs, browser state or secret values were read.

## Open questions or contradictions found

1. The brief named three notes sections. The W14 run facts (`run.json` evidence, first
   `selectProject` in topology startup, peer durations) come from two other sections of the
   same notes file, "Observed at 20:35-20:45 local" and "Root cause and fix"; each is cited
   above.
2. B's Flow `flowCreationSuccess` (1) and `initialExecutionSuccess` (0.9310) equal A's although
   B's W14 repeat 2 has `flowCreated` false, and A's W28 recording failure does not move
   recording `falseFailure` (0). Startup failures therefore appear to be excluded from those
   populations; the JSON does not state the population rules.
3. `runsInspected: 0` on both sides with ten failed runs each: the zero discards should not be
   read as a positive inspection of those runs.
4. W28's typed facility failure reason is `unclassified` (also flagged by `bq`), while W14's is
   fully typed. Both are classified as one startup class by the supervisor, not by the
   facility's typing.
5. The notes' draft terminal-verification brief says 18 skips; `bq` observed 12, and B's
   resume output also reports 12.
