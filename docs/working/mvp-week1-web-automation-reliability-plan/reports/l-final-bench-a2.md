# `l-final-bench-a2` — final pushed repeat-three bench A

**Status:** **interrupted and incomplete** — 153 of 189 executable results
finalized; this is not an accepted criterion-5 bench.

**Pins:** downstream `54e30bc127f76041269d3707817c2e78d369c6b2`;
Core `19468b72c4472fd5cc58940737702d5e4d72c985`.

**Owned paths:** worktree `F:\fxlab\fxlab-09fd9c7-a`; fresh run root
`F:\fxlab-runs\final2\a`.

## Setup and execution

- The assigned A worktree and `final2\a` root were absent at intake. A fresh
  detached worktree was created at the exact downstream pin; its `origin/dev`
  resolved to the same full hash. Core was clean at its exact assigned pin.
- Because the new worktree had no `node_modules`, `pnpm install
  --frozen-lockfile` completed without downloads. Serial builds of downstream
  `domain`, `test-contracts`, and `scenario-lab` each exited 0.
- Package-link inspection from `domain`, `apps/extension`, `test-runner`, and
  `test-contracts` showed junctions into the assigned `F:\fxlab\!FluxIQ`
  packages, with no unpinned package link. Post-build downstream and Core
  statuses were clean.
- At A readiness, the fresh root remained absent, free physical memory was
  12,270 MiB, and no Lab runner process was active. The supervisor coordinated
  A's launch with B after B's one shared serial Core build.
- B reported the one shared Core serial build complete at the clean Core pin;
  A thereafter treated Core as read-only. The A wrapper reserved its fresh
  root with an exclusive lock and started at `2026-09-13T23:38:39.766Z`, PID
  19124, with 12,184 MiB free. The first process-tree check found two A
  `run-lab` processes and two belonging to the concurrently launched B bench,
  with no third campaign. Command output goes directly to the private owned
  log; the process-only auth value is never printed or persisted by the
  wrapper. Memory and finalized attestations are sampled every 15 seconds.
- Repeat 0 completed all 63 executable results plus the four planned W04/W08
  Flow absences. It had 59 passing evaluations, the three ruled-out variant
  misses W05 `short-catalog`, W13 `banner-absent`, and W24 `unannounced`, and
  one concurrent-load W27 Flow failure before Flow creation. W27 was
  `gateway.connection` at pre-approval after 15,024 ms against a 15,000-ms
  bound; last status was disconnected with no pairing reference/session and
  queue size 0. This is one observation, so the bench continues.
- At 72 executable results, totals were 68 passed and 4 failed; repeat 1 had
  begun with 9 evaluations. Leak findings, recording-persistence failures, and
  harness activations were zero. The sampled memory minimum was 5,563 MiB.
- Repeat 1 completed 63/63 executable evaluations. Its W27 base Flow passed,
  so repeat 0's gateway timeout did not repeat. Repeat 2 reached W13 recording
  before the process tree ended. The wrapper did not reach its normal final
  status write or `finally` cleanup: no exit code was captured, its stale lock
  remained, and the bench wrote no final aggregate. Raw console output was not
  consulted to invent an exit result.

## Results

### Completion and partial headline

| Scope | Evaluated | Passed | Failed | Observed pass rate |
| --- | ---: | ---: | ---: | ---: |
| Recording lane | 59 | 59 | 0 | 100% |
| Flow lane | 94 | 86 | 8 | 91.5% |
| Both lanes | 153 | 145 | 8 | 94.8% |
| Repeat 0 | 63 | 59 | 4 | 93.7% |
| Repeat 1 | 63 | 60 | 3 | 95.2% |
| Repeat 2, partial | 27 | 26 | 1 | 96.3% |

The intended plan is 201 slots: 189 executable evaluations and 12 planned
W04/W08 Flow absences. `runs.json` contains 165 entries: all 12 planned
absences and 153 evaluated entries. Every one of those 153 run directories has
an evaluation and `bundle.complete.json`. The remaining 36 executable results
were never reached. There is no `report.json` or `report.md`, so no complete
bench headline or acceptance decision exists.

All 153 manifests carry downstream pin
`54e30bc127f76041269d3707817c2e78d369c6b2` and Core pin
`19468b72c4472fd5cc58940737702d5e4d72c985`. The observed browser name was
Chromium; the extension-bearing command was launched headed as required.

### Failures

| Row / variant | Repeat | Category | Flow created | Oracle / reported | Start candidate | Harness |
| --- | ---: | --- | --- | --- | ---: | ---: |
| W05 `short-catalog` | 0 | `runtime.behavior` | yes | passed / failed | 0 | 0 |
| W13 `banner-absent` | 0 | `runtime.behavior` | yes | failed / failed | 0 | 0 |
| W24 `unannounced` | 0 | `runtime.behavior` | yes | passed / passed | 0 | 0 |
| W27 base | 0 | `gateway.connection` | no | null / null | absent | 0 |
| W05 `short-catalog` | 1 | `runtime.behavior` | yes | passed / failed | 0 | 0 |
| W13 `banner-absent` | 1 | `runtime.behavior` | yes | failed / failed | 0 | 0 |
| W24 `unannounced` | 1 | `runtime.behavior` | yes | passed / passed | 0 | 0 |
| W05 `short-catalog` | 2 | `runtime.behavior` | yes | passed / failed | 0 | 0 |

W05, W13, and W24 are the three explicitly ruled-out variants that remain in
the corpus for reporting. W27 base repeat 0 is the sole non-ruled failure: its
pre-approval connection wait ended disconnected after 15,024 ms against a
15,000-ms bound, with no pairing reference or session and queue size 0. W27
base repeat 1 passed with a created Flow and passing oracle/reported verdicts;
repeat 2 was not reached. The timeout is therefore one concurrent-load
observation, not a deterministic three-repeat result.

### Partial criterion observations

- Criterion 1's unarmed W01-W19 rows observed here were 91/91 passed. The
  repeat-2 denominator is incomplete, so this does not close the criterion.
- W20-W23 Flow recovery rows were 8/8 passed across repeats 0 and 1. All four
  observed W26 Flow rows passed; its two unarmed rows were 2/2. Repeat 2 for
  these rows was not reached.
- All ten observed objective negative rows (W14, W19, and W27's three negative
  variants across repeats 0 and 1) passed. Repeat 2 was not reached.
- Criterion 5 cannot be evaluated from this incomplete campaign.

### Evidence, harness, leaks, and discards

| Lane | Sanitized packets | Total bytes | Minimum | Maximum | Truncated |
| --- | ---: | ---: | ---: | ---: | ---: |
| recording | 0 | 0 | n/a | n/a | 0 |
| Flow | 514 | 2,076,018 | 528 | 5,992 | 161 |

The maximum observed packet remained below the 6,000-byte budget. Every
evaluated row individually reported `harnessActivations=0` (153/153).

All 153 completed bundles had redaction attestations. They declared six
literal checks in total and reported zero findings; the leak watcher processed
all 153 attestations and never fired. No evaluation failed
`recording.persistence`.

There were 29 unique `recording.event_discarded` records: 13 on recording-lane
runs and 16 on Flow-lane runs. They account for 29 discarded passive events and
**zero discarded actions**. No other discard type was observed.

The memory monitor wrote 644 samples from `2026-09-13T23:38:39.756Z` through
`2026-09-14T02:19:30.069Z` (160.8 minutes). Its minimum was 5,185 MiB and its
maximum 12,279 MiB, so the 3-GB pause threshold never fired.

## Cleanup and unverified items

- Cleanup verification found zero processes referencing A's instance,
  worktree, or run root. Across 456 unique assigned loopback ports, zero
  listeners remained.
- The interrupted wrapper's exact zero-byte lock was removed after process
  ownership was proven clear. The entire run root, including all partial
  bundles, private logs, watcher data, and the launcher, remains preserved.
- The downstream worktree is clean at the exact assigned pin and equals its
  `origin/dev`. Core is clean at its assigned pin and remained read-only after
  B's one shared build. No generated tracked file needed restoration.
- **Unverified:** the wrapper/bench process exit code, the final 36 executable
  rows, all missing repeat-2 criterion observations, a complete aggregation,
  A/B comparison, and criterion-5 acceptance. Nothing was rerun.
