# Final durable Week 1 A/B comparison

## Outcome

The two complete `week1 --repeat 3` campaigns are statistically equivalent on
every metric with a stated Week 1 tolerance, but the closeout gate does not pass.
It reports `outcome: equivalent` and `comparisonPassed: false` because four
per-repeat verdicts differ. This is a complete measurement, not an interrupted
or corrupt benchmark.

- Downstream pin: `003ea99218cfc0f7320b31b06bc553771eae967d`.
- Core pin: `19468b72c4472fd5cc58940737702d5e4d72c985`.
- A: `bench-mu0zusso-f044675b`, 179 passed / 10 failed / 12 planned skips.
- B: `bench-mu0zuaod-8a35e3d7`, 177 passed / 12 failed / 12 planned skips.
- Each campaign has 201 planned slots, 189 evaluated runs, 63 result groups,
  repeat count 3, and a finished generation-379 checkpoint.

The command was the built runner's `compare` command with the two absolute
`report.json` paths. It exited 1 because the strict comparison gate failed.

## Integrity verification

Supervisor verification loaded both campaign manifests and their immutable
checkpoint chains through the shipped campaign-store reader. Each chain contains
380 contiguous checkpoints (generation 0 through 379), with zero ignored files,
189 completed cells, no active attempt, and state `finished`. The shipped
`inspectRun` verifier accepted 189/189 finalized run bundles in A and 189/189 in
B. Both leases were absent after completion.

## Comparable metrics

All tolerance-bearing rows were `equivalent`; none was `improved`, `regressed`,
or `not-compared`.

| Metric | A | B | Tolerance |
| --- | ---: | ---: | ---: |
| Flow creation success | 1.000 | 1.000 | 0.025 |
| Flow initial execution success | 0.9310 | 0.9310 | 0.0345 |
| Flow deterministic replay success | 0.9138 | 0.9310 | 0.0345 |
| Flow fuzzy recovery | 0.750 | 0.750 | 0.125 |
| Flow false failure | 0.0361 | 0.0357 | 0.0357 |
| Flow false success | 0 | 0 | 1.000 |
| Flow failure classification accuracy | 0.9091 | 0.8485 | 0.0909 |
| Recording initial / replay success | 0.2174 / 0.2174 | 0.2174 / 0.2174 | 0.0435 each |
| Overall run-duration p95 | 115,898 ms | 116,488 ms | 28,974.5 ms |

Action p95 values were also all equivalent: navigate 2,290/2,305 ms; tab
1,037/1,037; check 2,055/2,055; click 2,380/2,377; keypress 2,063/2,053;
scroll 2,084/2,080; select 2,040/2,042; type 2,063/2,058; upload
2,053/2,050; and wait-for-selector 7,042/7,040.

The comparison discloses p50 latency, evidence size, truncation count, and the
reserved Week 2 fields without assigning them a tolerance, as required by the
Week 1 metric contract. Those disclosures do not create a regression verdict.

## Verdict differences and causes

| Row | Repeat | A | B | Current judgment |
| --- | ---: | --- | --- | --- |
| W05 primary recording | 0 | passed | failed, service-worker readiness timeout | cold MV3 readiness flake |
| W19 `expired` Flow | 1 | passed, `auth_required` | failed expectation; replay succeeded | recorder stop/debounced-landing race |
| W19 `expired` Flow | 2 | passed, `auth_required` | failed expectation; replay succeeded | same recorder race |
| W25 primary Flow | 1 | failed, `fetch failed` | passed | pre-browser startup transport flake; exact control stage was erased |

Three stable failures occur identically in both campaigns and were already ruled
out of Week 1: W05 `short-catalog`, W13 `banner-absent`, and W24 `unannounced`,
each 0/3. They remain ranked product gaps rather than repeatability differences.

## Exit-criterion figures

- Criterion 1: unarmed W01-W19 stability was A recording 18/18 and Flow 16/16;
  B recording 17/18 and Flow 16/16. B's only miss was pre-scenario W05 startup.
- Criterion 2: the reports contain 610 and 620 sanitized packet samples and
  167/171 truncations. Separate accepted content-harness evidence covers all 16
  items, while live evidence supplies the packet and `sensitive-input` leak proofs;
  all final-bench attestations had zero findings.
- Criterion 3: W20-W23 and contextual W26 recovered without the harness 5/5 in
  both campaigns; harness activation was zero across all 378 runs.
- Criterion 4: required W14/W19/W27 classifications were A 15/15 and B 13/15;
  all negative rows were A 30/33 and B 28/33. B therefore misses the 90% target.
- Criterion 5: every stated metric tolerance passed, but three result groups and
  four repeats differed, so the strict comparison gate failed.
- Criterion 6: the authored blocker ranking must incorporate these final figures.

## Persistence and evidence

Neither aggregate had a `recording.persistence` failure or an action-bearing
discard. B's separate count-only scan of all 189 event files found 65
evidence-only event discards, maximum one per affected run, and zero unreadable
files. A's accepted diagnostics likewise found no persistence or action-discard
failure. A had 610 packet samples (p95 5,934 bytes, max 5,992); B had 620 with
the same p95 and maximum. Both stayed below the 6,000-byte invariant.

## Required follow-up

The W19 recorder race must be fixed and mutation-proved. Cold extension-worker
readiness needs a stronger bounded contract. Startup transport failures need
closed, secret-safe operation diagnostics before any idempotent retry policy is
selected. Narrow concurrent stress should precede a fresh full A/B pair; only a
pair with the required classification rate and no verdict differences can close
the current strict comparison gate.
