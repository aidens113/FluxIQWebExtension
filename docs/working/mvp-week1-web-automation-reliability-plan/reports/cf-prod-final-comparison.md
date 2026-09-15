# `cf-prod-final-comparison` — production-Core confirmation pair comparison

## Outcome

The production-Core confirmation pair passed the official Week 1 comparison with
no differing verdict. It supersedes the two disclosed startup exceptions of the
`next dev` pair (`bz-final-2-comparison`).

The supervisor ran the comparator directly with the runner built at the pair's
own pin, from Lab worktree `F:\fxlab\fxlab-prod-core`. No other Lab work was
running.

```text
node F:\fxlab\fxlab-prod-core\packages\test-runner\dist\cli.js compare F:\fxlab-runs\prod-core-final\a\bench\bench-mu2i36f9-ea262b66\report.json F:\fxlab-runs\prod-core-final\b\bench\bench-mu2i36jy-ddf2e39f\report.json
```

Observed: `compare exit=0`, stdout 12,449 bytes, stderr empty,
`outcome=equivalent`, `comparisonPassed=True`, topology identical (sharded,
`result-round-robin-v1`, 3 shards, 2 jobs on both sides), differing results 0,
differing runs 0.

## Campaigns

| | A | B |
| --- | --- | --- |
| Logical ID | `bench-mu2i36f9-ea262b66` | `bench-mu2i36jy-ddf2e39f` |
| Worktree | `F:\fxlab\fxlab-prod-core` | `F:\fxlab\fxlab-7263534` |
| Pins | downstream `118aeb7`, Core `54ae663` | same |
| Runs / passed / skipped | 189 / 180 / 12 | 189 / 180 / 12 |
| Failure causes | 9 `runtime.behavior` (ruled-out variants) | 9 `runtime.behavior` (ruled-out variants) |
| Bench wall time | 4,076 s | 4,053 s |
| Merge seal, parent state | present, `finished` | present, `finished` |
| `.tmp` files in the campaign | 0 | 0 |

Each benchmark exited 1 because its nine ruled-out variant runs fail by design:
three repeats each of W05 `short-catalog`, W13 `banner-absent`, and W24
`unannounced`. No run failed with a facility, startup, or gateway category.

## Metrics

48 metric rows: 23 `equivalent`, 4 `not-applicable`, 21 `no-tolerance-stated`
disclosures, and 0 outside tolerance or absent on one side.

| Metric | A | B | Tolerance | `next dev` pair A / B |
| --- | ---: | ---: | ---: | ---: |
| Flow creation | 1.0000 | 1.0000 | 0.0250 | 1.0000 / 1.0000 |
| Flow initial execution | 0.9310 | 0.9310 | 0.0345 | 0.9310 / 0.9310 |
| Flow deterministic replay | 0.9310 | 0.9310 | 0.0345 | 0.9310 / 0.9138 |
| Flow false failure | 0.0357 | 0.0357 | 0.0357 | 0.0357 / 0.0361 |
| Flow failure classification | 0.9091 | 0.9091 | 0.0909 | 0.9091 / 0.9091 |
| Recording initial execution | 0.2174 | 0.2174 | 0.0435 | 0.2174 / 0.2174 |
| Run duration p95 | 35,059 ms | 37,864 ms | 8,764.75 ms | 113,134 / 113,054 ms |
| Run duration p50 | 21,235 ms | 22,034 ms | none stated | 93,100 / 92,168 ms |
| `wait_for_selector` p95 | 7,023 ms | 7,034 ms | 1,755.75 ms | 7,046 / 7,032 ms |
| Packet p95 | 5,934 B | 5,934 B | none stated | 5,934 / 5,934 B |
| Truncations | 165 | 165 | none stated | 167 / 165 |

The rates are unchanged from the `next dev` pair, except that B's Flow replay
and false-failure rates return to A's values without W14's startup exception.
Run duration fell to about a quarter. Action latencies did not change, because
the browser actions themselves were never slow.

## Exit-criterion projection

1. `actions-reliable`: measured. Recording unarmed 18/18 stable and Flow unarmed
   16/16 stable in both campaigns; repeat count 3.
2. `evidence-useful`: partially measured. 612 packet samples and 165 truncations
   on each side; the external 16-item and sensitive-input assertions are outside
   `BenchReport` (content harness `evidence.spec.ts` 30 passed at `3d6ecd6`).
3. `deterministic-fallback`: measured, 5/5 recovered without harness in both.
4. `failures-classified`: measured. Required W14/W19/W27 15/15 in both; all
   negatives 30/33 in both (the three W24 `unannounced` runs are ruled out).
5. `bench-repeatable`: measured. 48 metrics rendered, 0 outside tolerance, 0
   absent comparable metrics, 0 differing results, 0 differing runs.
6. `blockers-ranked`: not a `BenchReport` field; see `cb-blocker-ranking-final`.

Persistence discards: every counter is 0 on both sides.

## What the pair confirms about the fixes

- Every campaign cell served Core with `next start` from one published build per
  runs root (cache `6ac4f31e34cc2e50f3e864ff`, one attempt each). A live check
  at 03:00 local saw 0 `next dev` and 0 `next build` processes.
- Each Core was one in-process `next start` node process at 158 MB median and
  168 MB maximum private memory, against about 2,400-2,630 MB for a `next dev`
  Core. Available memory stayed near 13.7-14.6 GB.
- Slot-probe PowerShell fell from at least 173 distinct processes in 20 s to 7.
- No durable-write temporary was left in either campaign.

Per-bundle production-start markers and full terminal verification are in
`cd-prod-final-a` and `ce-prod-final-b`.

## Validation boundary

The figures come from the comparator output, both benchmark outcome lines,
supervisor checks of each campaign's merge seal, parent checkpoint and `.tmp`
count, and the supervisor's live process and memory samples during the pair. No
event messages, page data, environment values or secrets were read.
