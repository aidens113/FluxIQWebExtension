# `l-final-bench-a` — final Week 1 bench A

**Status:** **STOPPED FOR W02 REMEDIATION** — incomplete, not an accepted
criterion 5 bench.

**Assigned pins:** downstream `4cde72dd63d1f855f3a09ffa98d4bc5f9cbf3736`;
Core `19468b72c4472fd5cc58940737702d5e4d72c985`.

**Owned paths:** worktree `F:\fxlab\fxlab-7263534-load`; run root
`F:\fxlab-runs\final\a`.

## Setup and execution record

- Intake: Core was clean at the assigned pin. The downstream worktree was clean
  at the former Stage 3 pin and was not yet moved. Free physical memory was
  12,126 MiB. No blocker was present.
- The downstream worktree was moved to the assigned detached pin and remained
  clean. Core was clean at its assigned pin. Builds of `domain`,
  `test-contracts`, and `scenario-lab` each exited 0. The pinned Core build was
  already prepared by the preceding final-proof campaign and was used read-only.
- The bench will run once, headed, with repeat count 3 and the isolated target.
  The declared auth-gate value is process-only and will not be written here.
- The exact bench started under instance `final-a`; its first boundary had zero
  completed evaluations and 11,338 MiB free physical memory. No blocker was
  present.
- At 10 completed executable evaluations, 8 passed and 2 failed. All 10
  redaction attestations had zero findings; there was no
  `recording.persistence` failure. The minimum sampled free-memory value was
  5,961 MiB.
- The misses were W02 `keyboard-forms`, Flow repeat 0 (`action.dispatch`, no
  code, no oracle, no produced action, `flowCreated=false`, no start candidate,
  `harnessActivations=0`), and the ruled-out W05 `short-catalog`, Flow repeat 0
  (`runtime.behavior`, `oracleVerdict=passed`, `flowCreated=true`,
  `harnessActivations=0`). Both are single concurrent-load observations while
  the campaign remains in progress.

## Results

The supervisor ordered a stop after the first W02 Flow failure. The owned
process tree was terminated at a safe boundary. The launcher consequently
exited 1; that exit describes the intentional stop, not a completed bench.
All partial artifacts remain under the owned run root.

### Partial headline

| Scope | Passed | Failed | Observed rate |
| --- | ---: | ---: | ---: |
| Recording lane | 7 | 0 | 100% |
| Flow lane | 6 | 2 | 75% |
| Both lanes | 13 | 2 | 86.7% |
| Criterion 1 rows reached, using the counting rulings | 13 | 1 | 92.9% |

The bench wrote 15 executable evaluations before the stop. Its incremental
plan file contained 27 entries: the 15 evaluated entries and all 12 planned
W04/W08 Flow skips. The full repeat-3 corpus was not reached, so none of these
partial rates closes a criterion.

### Per-row observations

| Row / variant | Lane | Repeat | Verdict | `startCandidateIndex` | `harnessActivations` |
| --- | --- | ---: | --- | ---: | ---: |
| W01 base | recording | 0 | passed | n/a | 0 |
| W01 base | Flow | 0 | passed | 0 | 0 |
| W02 base | recording | 0 | passed | n/a | 0 |
| W02 base | Flow | 0 | **failed** | absent | 0 |
| W03 base | recording | 0 | passed | n/a | 0 |
| W03 base | Flow | 0 | passed | 0 | 0 |
| W04 base | recording | 0 | passed | n/a | 0 |
| W05 base | recording | 0 | passed | n/a | 0 |
| W05 base | Flow | 0 | passed | 0 | 0 |
| W05 `short-catalog` | Flow | 0 | **failed** | 0 | 0 |
| W06 base | recording | 0 | passed | n/a | 0 |
| W06 base | Flow | 0 | passed | 0 | 0 |
| W06 `no-results` | Flow | 0 | passed | 0 | 0 |
| W07 base | recording | 0 | passed | n/a | 0 |
| W07 base | Flow | 0 | passed | 0 | 0 |

### Bounded failures

- **W02 base, Flow repeat 0:** evaluation `failed`; category
  `action.dispatch`; no code; `oracleVerdict=null`; `flowCreated=false`; no
  produced or failed action type/index; no Flow snapshot or
  `startCandidateIndex`; `harnessActivations=0`. The error event exposed no
  diagnostic field beyond `failureCategory` and bounded capture references.
  This is one observation under the two-bench concurrent load. It is the reason
  the supervisor stopped this bench for remediation.
- **W05 `short-catalog`, Flow repeat 0:** evaluation `failed`; category
  `runtime.behavior`; `oracleVerdict=passed`; persisted reported verdict
  `failed`; `flowCreated=true`; `startCandidateIndex=0`;
  `harnessActivations=0`. This row is ruled out of Week 1 criterion 1 but stays
  reported by the counting ruling.
- No observed failure was `recording.persistence`, so there are no persistence
  discard kinds to report.

### Evidence, leaks, and memory

| Lane | Evaluations | Sanitized packets | Total bytes | Maximum packet | Truncated packets |
| --- | ---: | ---: | ---: | ---: | ---: |
| recording | 7 | 0 | 0 | n/a | 0 |
| Flow | 8 | 54 | 266,588 | 5,992 | 35 |

All 15 completed bundles carried a redaction attestation; their combined
finding count was 0. The leak stop rule did not fire. The lowest free-memory
value observed was 5,961 MiB, above the 3-GB pause floor, so no memory pause
occurred.

### Cleanup

- The exact owned process tree rooted at bench PID 13540 was enumerated before
  termination. After termination, 0 of its 13 recorded PIDs remained.
- Across the 15 completed bundles, all 45 assigned scenario/web/gateway ports
  had 0 listeners after cleanup.
- The downstream worktree was clean at the exact assigned pin, and Core was
  clean at its exact assigned pin. No generated tracked file required restore.
- The partial run root was preserved. No source or shared working document was
  edited, and this worker did not commit or push.

## Unverified

- Repeats 1 and 2 and all corpus work after W07 were never run.
- Criteria 2–6 and the complete criterion 1 denominator cannot be concluded
  from this stopped bench.
- W02 was not rerun alone because the supervisor directed a stop for
  remediation; its single concurrent-load failure is not independently
  reproduced here.
- No comparison against bench B is valid from this partial report.
