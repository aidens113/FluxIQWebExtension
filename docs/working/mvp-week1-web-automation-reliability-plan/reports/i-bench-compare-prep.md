# Report: i-bench-compare-prep

Worker: `i-bench-compare-prep`. A ready comparison script for bench A against bench B, run
on a real finished week1 bench and on a copy with one row's verdict flipped. Read-only
apart from the script, the copy and this report. No Lab command, build or test suite ran.

## Outcome

**Done.** The script covers the Metrics section, verdict differences, the exit-criterion
counts and `recording.persistence` discards. It follows the supervisor's mid-task ruling
on criteria 1, 4 and 5 and on marking rows that are ruled out.

- It runs on the finished Stage 2 week1 bench: exit 0, 0 metrics outside tolerance, and
  0 disagreements with the contract's own `compareBenchReports`.
- The flipped copy is caught: exit 1, one result and one run listed as differing.
- The discard section is proven only on synthetic input. No finished bench on disk has a
  `recording.persistence` failure (see Not verified).

## Usage

```text
node C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\bench-compare.mjs <reportDirA> <reportDirB> [--sequential] [--contracts <test-contracts dist/index.js>]
node ...\bench-compare.mjs --self-test
```

- `<reportDir>` is a bench directory (`<runs>/bench/<bench id>`), or its `report.json`.
  A is the baseline and B the candidate, as in `compareBenchReports`.
- **Inputs read:**
  - `report.json`, which is required;
  - `runs.json`;
  - `evaluations/*.json`, keeping only verdict, lane, oracle, reported and expected
    categories, and harness activations;
  - for a `recording.persistence` failure only, that run's `events.ndjson` at
    `<runs>/<runId>`, keeping only `details.recordingDiscards` and
    `details.recordingDiscardWindow` counts.
- **Exit status:**
  - 0: every compared metric is within tolerance and no verdict differs;
  - 1: a metric is outside tolerance, or a result or run verdict differs;
  - 2: bad arguments or an unreadable `report.json`.
- **Latency is labelled "measured under shared load" by default**, per the supervisor's
  ruling that the two Stage 3 benches ran concurrently at the same pins. Pass
  `--sequential` to drop the label.
- **Cross-check.** It dynamically imports
  `F:/!FluxIQWebExtension/packages/test-contracts/dist/index.js` (overridable) and:
  - validates each report with `validateBenchReport`;
  - checks every within/outside judgement, and every tolerance value, against
    `compareBenchReports`.

  When A and B share a `reportId` (the same report, or a copy), the candidate's id is
  renamed in memory, because the contract refuses a self-comparison.
- **What it prints.** Ids, enum values, field names, counts, rates and durations. It
  never prints `failureCause` text, invariants, event payloads or recording ids, and any
  id or enum that does not look like one prints as `(unprintable)`.

### What it prints, section by section

1. **Reports.** For A and B: id, corpus, repeat count, target, results, run verdict
   counts, evaluations read, LLM mode and calls, and contract validation. It also warns
   about corpus or repeat mismatches and about unreadable files.
2. **Metrics section.** One row per report field: the plan's metric name, A, B, the
   tolerance, a within or OUTSIDE judgement with the difference, and a note. Beneath it,
   the two things the section states outright: harness activation must be 0, and the
   Week 2 fields must be null.
3. **Contract cross-check.** How many metrics the contract compared, and every
   disagreement with the script.
4. **Rows whose verdict differs.**
   - Result level: `passRate` and `flakeClass` in `report.json`.
   - Run level: the verdict per repeat in `runs.json`, with the failure category from A
     to B.
   - Runs whose verdict is the same but whose failure category changed.
5. **Exit criteria 1-6.** The counts and rates each is judged on, for A and for B,
   applying the supervisor's ruling:
   - criterion 1 counts only the unarmed W01-W19 workflows, per lane, and lists variant
     rows apart;
   - criterion 4 is judged on the W14, W19 and W27 negative variants against the 90% bar,
     beside the rate over every negative variant (W24 `unannounced` included) and each
     miss's row, expected category and reported category;
   - W05 `short-catalog`, W13 `banner-absent` and W24 `unannounced` are marked
     `(ruled out)` wherever they appear;
   - criterion 5 carries the shared-load label.
6. **`recording.persistence` failures.**
   - From `failureCause`: the action counts, whether each names a recording, and whether
     the loss came after finalization. Recording ids are dropped.
   - From the run's own folder: discard entries by type, the largest discarded-action and
     discarded-event counts, how many entries name a recording, how many came after
     finalization, and the window's exclusion counts.
7. **Gaps.** The list under task 4 below.

## What changed and why

| File | Why |
| --- | --- |
| `<scratchpad>\bench-compare.mjs` (new, untracked) | The comparison tool the brief asks for. |
| `<scratchpad>\ibcp-flip\` (new, untracked; 69 files) | Copy of the Stage 2 bench's `report.json`, `runs.json` and `evaluations/`, with one row flipped, for the flip test. Disposable. |
| `reports/i-bench-compare-prep.md` | This report. |

**Input chosen.** The only finished week1 bench report on disk is
`F:\fxlab-runs\stage2b\d\bench\bench-mtzqnj6o-f355f75e`: week1, `--repeat 1`, 67 runs,
37 passed and 30 failed. That matches Current State's "Stage 2: week1 `--repeat 1` passed
37 of 67". The other candidates:
- `stage2c\e\bench\bench-mtzygou6-68413aa9` has a `runs.json` with 11 runs and no
  `finishedAt`, and no `report.json`: the `l-stage2c` bench that was cut short, which
  cannot be compared.
- `stage1\b` and `stage2b\c` are `smoke` benches.

`stage2d`, `stage3` and every `F:\fxlab` worktree were not opened.

## Commands run and observed results

Exit codes were printed with `$LASTEXITCODE` straight after `node`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `node bench-compare.mjs --self-test` (before and after the label fix) | 0 | `self-test: 15 passed, 0 failed`. The checks cover: rate within and outside, total 0, p95 within and outside at the 25% boundary, unmeasured p95, parsing a discard cause and refusing a cause of another shape, events.ndjson discard kinds, counts and window exclusions, identical and flipped verdicts, ruled-out marks, and old reports whose rates carry no lane. |
| `node bench-compare.mjs <stage2 bench> <stage2 bench>` | 0 | Summary line: `metrics outside tolerance 0; results or runs whose verdict differs 0; exit 0`. Both reports `valid`. Contract: `contract compared 18 metric(s) (equivalent 18); script rows agreeing with it: 24; disagreements: 0`. Tally: within 18, outside 0, not comparable 6, no tolerance stated 13. |
| `Copy-Item` into `ibcp-flip`, then `Get-FileHash` | 0 | 69 files copied; `report.json identical: True`, `runs.json identical: True` before editing. |
| Four Edit-tool changes to the copy | - | Row W01 `basic-form` unarmed, Flow lane, repeat 0, flipped from passed to failed consistently: `runs.json` verdict; `report.json` result `passRate 1 -> 0`, `stable-pass -> stable-fail`; the evaluation file's verdict; and `report.json` Flow `initialExecutionSuccess` `9/33 -> 8/33`. The original evaluation shows oracle passed, reported passed and 0 activations, so that run was one of the 9 hits; no other rate's population or hit changes. |
| `git diff --no-index --numstat` original against the copy, and hashes of every evaluation file | 1 (differences found; LF/CRLF warnings only) | `report.json` 4/4 lines, `runs.json` 1/1, the one evaluation 1/1; `evaluation files identical: 66; differing: 1`. |
| `node bench-compare.mjs <stage2 bench> <ibcp-flip>` | **1** | The flip is caught; output excerpt below. |

### Output on the real report (A = B = Stage 2 week1), excerpts

Printed exactly as the script wrote it; the B columns equal A and are dropped from the
criteria lines.

```text
Metrics row                     | Report field                            | A             | Tolerance      | Judgement
Flow creation success           | recording.flowCreationSuccess           | 0/0 null      | ±1 workflow    | not comparable: total 0 in A and B
Flow creation success           | flow.flowCreationSuccess                | 30/44 = 0.682 | ±1/44 = ±0.023 | within (Δ +0.000)
Initial execution success       | recording.initialExecutionSuccess       | 4/23 = 0.174  | ±1/23 = ±0.043 | within (Δ +0.000)
Initial execution success       | flow.initialExecutionSuccess            | 9/33 = 0.273  | ±1/33 = ±0.030 | within (Δ +0.000)
Deterministic replay success    | recording/flow                          | 0/0 null      | ±1 workflow    | not comparable: total 0 in A and B
Fuzzy recovery rate             | flow.fuzzyRecovery                      | 4/10 = 0.400  | ±1/10 = ±0.100 | within (Δ +0.000)
False failure rate              | recording.falseFailure                  | 0/4 = 0.000   | ±1/4 = ±0.250  | within (Δ +0.000)
False failure rate              | flow.falseFailure                       | 0/14 = 0.000  | ±1/14 = ±0.071 | within (Δ +0.000)
False failure rate (inverse)    | flow.falseSuccess                       | 1/6 = 0.167   | ±1/6 = ±0.167  | within (Δ +0.000)
Failure classification accuracy | flow.failureClassificationAccuracy      | 8/11 = 0.727  | ±1/11 = ±0.091 | within (Δ +0.000)
Harness activation rate         | recording.harnessActivation             | 0/23 = 0.000  | ±1/23 = ±0.043 | within (Δ +0.000)
Harness activation rate         | flow.harnessActivation                  | 14/44 = 0.318 | ±1/44 = ±0.023 | within (Δ +0.000)
Action latency                  | web.dom.click p95                       | 1349 n31      | ±337 ms        | within (Δ +0 ms)   (shared load)
Action latency                  | web.dom.type p95                        | 1415 n24      | ±354 ms        | within (Δ +0 ms)   (shared load)
Action latency                  | web.browser.navigate/check/keypress/scroll/select p95 | n7/n1/n4/n6/n1 | ±25% | within; "under 20 samples: p95 is the maximum observation"
Action latency (run duration)   | runDurationMs p95                       | 58566 n67     | ±14642 ms      | within (Δ +0 ms)
Evidence size                   | sanitizedPacketBytes p50/p95            | null/null n0  | none stated    | no tolerance stated; unmeasured in A and B (0 samples)
Evidence size                   | rawSnapshotBytes p50/p95                | null/null n0  | none stated    | no tolerance stated; unmeasured in A and B (0 samples)
Evidence size                   | truncationCount                         | 0             | none stated    | no packet was measured in A and B, so a 0 here is not an observation
(disclosure, not a Metrics row) | notExecutedRuns / actionsExecuted       | 31 / 74       | none stated    |

Harness activation must be 0 with the provider disabled, flow lane: A 14 of 44 runs -> NOT met; B 14 of 44 runs -> NOT met
Week 2 fields null in Week 1, A: 5 of 5 null; llm disabled, calls 0

1. A recording, unarmed W01-W19: 18 workflows; 3 of 3 not judgeable at repeat 1; workflows passing every run: 13/18 = 0.722
   A flow, unarmed W01-W19: 18 workflows; 3 of 3 not judgeable at repeat 1; workflows passing every run: 6/18 = 0.333
     not passing every run: W02, W03/combobox, W05/paginated-extraction, W07/in-stock-only, W09/sort-by-price, W11, W12,
                            W14/interstitial, W15, W16, W17/upload, W18   [all flow, stable-fail]
   A variant rows in W01-W19, outside criterion 1: ... W05/paginated-extraction/short-catalog[flow] (ruled out) 0/1,
     W13/consent-then-click/banner-absent[flow] (ruled out) 0/1, W14/interstitial/armed[flow] 0/1, W19/expired[flow] 0/1 ...
2. A: sanitizedPacketBytes samples 0 (unmeasured); truncationCount 0; rawSnapshotBytes samples 0 (unmeasured)
   A: runs failed as security.redaction: 2 (W18[recording]r0, W19/expired[flow]r0)
3. A W20-W23: 4 results; runs passed 4/4; recovered without harness 4/4; harness activations summed 0
   A W26[recording]: runs passed 1/1;  A W26[flow]: runs passed 0/1
   A W26/no-context[flow]: runs passed 0/1; expected target_ambiguous, category matched 1/1
4. A JUDGED, negative variants of W14, W19, W27: expected category reported 4/5 = 0.800; FluxIQ reported no failure in 1; >= 0.90: NOT met
   A every negative variant, ruled-out rows included (W24/unannounced[flow]r0 (ruled out)): 8/11 = 0.727; FluxIQ reported no failure in 2
     report.json failureClassificationAccuracy summed over lanes: 8/11 = 0.727; agrees with the evaluations
     misses: W14/interstitial/armed[flow]r0 [judged]: expected user_intervention_required, reported none
             W24/unannounced[flow]r0 (ruled out): expected output_not_observed, reported none
             W25/too-slow[flow]r0: expected timeout, reported target_not_found
5. repeatCount: A 1, B 1; the proof asks --repeat 3 for both: NOT met
   agreement within tolerance: within 18, outside 0, not comparable 6, no tolerance stated 13
6. A: failed runs 30/67; by test-rig failureCategory: runtime.behavior 15, action.dispatch 7, recording.contract 3,
      security.redaction 2, gateway.connection 1, process.startup 1, unknown 1
   A: failed runs by FluxIQ-reported category: none-reported 19, target_not_found 5, output_not_observed 3, auth_required 1,
      blocked_by_capability_or_policy 1, target_ambiguous 1
   A: failed runs outside the ruled-out rows: 27/64 = 0.422
== recording.persistence failures: A: runs failed as recording.persistence: 0
```

(Latency rows and criterion lines are condensed above; every one of them is printed in
full by the script.)

### The flip test (A = Stage 2 bench, B = `ibcp-flip`)

```text
B | bench-mtzqnj6o-f355f75e | week1 | 1 | isolated | 67 | 67 (passed 36, failed 31; skipped 0) | 67 | disabled calls 0 | valid
Initial execution success       | flow.initialExecutionSuccess | 9/33 = 0.273 | 8/33 = 0.242 | ±1/33 = ±0.030 | within (Δ -0.030)
contract compared 18 metric(s) (equivalent 18); script rows agreeing with it: 24; disagreements: 0

== Rows whose verdict differs
Results (report.json passRate and flakeClass): 1 differ
Result                                | A             | B
W01 basic-form/primary/unarmed [flow] | stable-pass 1 | stable-fail 0
Runs (runs.json verdict per repeat): 1 differ
Run                                      | A      | B      | failureCategory A -> B
W01 basic-form/primary/unarmed [flow] r0 | passed | failed | - -> -
Runs with the same verdict and a different failureCategory: 0

1. B flow, unarmed W01-W19: 18 workflows; ... workflows passing every run: 5/18 = 0.278; flaky 0, stable-fail 13
     not passing every run: W01[flow] stable-fail, W02[flow] stable-fail, ...
6. B: failed runs 31/67 = 0.463; ... none-recorded 1 ...
   B: corpus rows with a failed run (failed/runs): ... W01 1/2 ...

== Summary: metrics outside tolerance 0; results or runs whose verdict differs 2; exit 1
```

The flip shows up in four places:
- the result-level difference table;
- the run-level difference table;
- criterion 1, where B's Flow lane drops from 6/18 to 5/18;
- the exit status, 1.

The one-workflow rate change is correctly within tolerance, because ±1/33 equals the
difference. That is the tolerance's intended edge, which the self-test also pins.

## Task 4: where the Metrics section gives no tolerance, or the report carries no field

1. **Action latency p50 and run duration p50.** The section's tolerance names p95 only.
   No tolerance.
2. **Run duration p95.** The section lists "run duration" under Action latency and says
   "latency p95 within 25%"; it does not say whether run duration counts as latency. The
   script applies 25%, as the contract does. The contract's summary gates it only at 20 or
   more samples; below that it is advisory, and the script notes it.
3. **Evidence size**: sanitized packet p50/p95, raw snapshot bytes and truncation count.
   No tolerance; the contract states "Evidence sizes are reported, not compared." They are
   printed, not judged. Raw snapshot bytes are ruled out of Week 1 (Current State). In
   Stage 2 both distributions have 0 samples, so truncation count 0 is not an observation.
4. **Harness activation.** The ±1-workflow tolerance applies. The section also states an
   absolute requirement, "must be 0 with provider disabled". Both are printed; the
   requirement is not part of the A-against-B tolerance tally.
5. **Harness recovery, adaptation cost, validation, persistence and reuse.** `null` in
   Week 1 by definition, with no tolerance. Checked for null only.
6. **"±1 workflow" names no population when A and B differ.** The script uses B's
   `workflows`, as `compareBenchReports` does, and notes when the populations differ.
7. **Deterministic replay success** has no population at `--repeat 1`, and flow creation
   success has none on the recording lane. These show as "not comparable: total 0", not
   as a pass.
8. **`notExecutedRuns` and `actionsExecuted`** are not Metrics rows. Printed as
   disclosure, with no tolerance.
9. **Ruled-out rows still count in `report.json`'s rates.** The script marks them but
   re-aggregates no rate without them. If the supervisor wants rates without the three
   rows, that is a separate aggregation, not something this script invents.
10. **Exit-criterion proof items no bench report carries:**
    - criterion 1's content-script harness;
    - criterion 2's "16 items", packet budget and `sensitive-input` leak assertion. The
      nearest per-run signal is a run failing as `security.redaction`, which is printed;
    - criterion 6's ranking, which is a ledger entry. The script prints its inputs.

## Not verified

- **The discard section on real data.** No finished bench on disk has a run failing as
  `recording.persistence`: the category counts across all four finished `runs.json` files
  were checked. In the Stage 2 bench, 44 Flow runs have 60 events carrying
  `details.recordingDiscards`, all of them empty lists. Both parsers, for `failureCause`
  and for `events.ndjson`, are exercised only by the synthetic self-test. The Stage 3
  benches are the first real input that can reach this path.
- **The `--repeat 3` shape.** On real data the script has seen repeat 1 only. That leaves
  unexercised: replay rates with a population; the flaky class; `3 of 3` judgements;
  per-action p95 at 20 or more samples; and a `runs.json` with skipped runs. The logic
  for each is the same code path as repeat 1, with the self-test covering the tolerance
  boundaries, but no real repeat-3 report exists yet.
- **Reports whose results carry no lane** (the eight historical smoke benches) are
  exercised only synthetically, by the self-test.
- **Freshness of the contracts build.** `dist/bench-report.js` (09:43) is newer than
  `src/bench-report.ts` (00:17) and exports the functions used, but I did not rebuild and
  did not diff dist against src. If dist were stale, the cross-check would compare against
  an older contract.
- **Bundle lookup from a copy.** The flip copy is not under `<runs>/bench/`, so its bundle
  lookup is correctly reported as not locatable (warning printed). The real report's
  lookup path was confirmed to exist (`run.json`, `events.ndjson` and others under
  `F:\fxlab-runs\stage2b\d\<runId>`).
- **A single observation on a machine with faulty RAM.** Each script run executed once
  per input; nothing was rerun beyond the self-test's second pass.

## Open questions or contradictions found

1. **Harness activation on the Flow lane is 14 of 44 in Stage 2 with `llm: disabled,
   calls 0`.** The Metrics section says it "must be 0 with provider disabled". Either
   Core's run detail counts something other than an LLM intervention as an activation, or
   the requirement is not met. This is a single Stage 2 observation. The script flags it
   on every run, so the Stage 3 benches will show whether it persists.
2. **Criterion 4 as ruled is a small population.** At repeat 1 it is 5 runs (4/5 = 0.800
   in Stage 2, missed by W14 `armed` reporting no failure); at repeat 3 it is 15. At 15,
   the 90% bar allows one miss, and the ±1-workflow tolerance is 1/5 per bench.
3. **Per-action p95 below 20 samples.** At repeat 3, `web.dom.check`, `web.dom.select`
   and `web.dom.keypress` will likely still be under 20 samples (1, 1 and 4 at repeat 1).
   Their p95 is then one maximum observation, the contract still gates on it, and under
   shared load it is the likeliest "outside" that says nothing about the product. The
   script labels both conditions.
4. **W26's Flow runs both failed as tests.** The unarmed Flow run passed 0/1. The
   `no-context` variant failed as a test while reporting the expected
   `target_ambiguous`, so it counts as a criterion 4 hit and a run failure. Criterion 3's
   "W26 resolves ambiguity by context" is not met in Stage 2 on the Flow lane. This is a
   single observation.
5. **Criterion 2 has no bench measurement yet.** Sanitized packet bytes have 0 samples in
   Stage 2, although Current State lists "single-run evidence sizes, through one reader"
   as settled. Whether a Stage 3 bench fills them is the first thing to check in its
   output.
