# Report: l-final-bench-b

Worker report, 2026-09-13. This report is written as the final Bench B campaign
proceeds. It contains only bounded identifiers, counts, categories, and sizes; it
does not reproduce declared values, recorded page data, screenshots, or raw logs.

## Setup

- Downstream worktree: `F:\fxlab\fxlab-16ff729-b`, detached and clean at
  `4cde72dd63d1f855f3a09ffa98d4bc5f9cbf3736`.
- Shared Core worktree: `F:\fxlab\!FluxIQ`, clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`; it is treated as read-only.
- Downstream builds completed in sequence: `domain`, `test-contracts`, and
  `scenario-lab`, all exit 0.
- Run root: `F:\fxlab-runs\final\b` (absent before the campaign).
- Initial free physical memory: 11.64 GB.
- The declared auth-gate secret was loaded in memory from the built scenario
  constant and added only to the child bench process environment. It was not
  printed, interpolated into the command, persisted, or reproduced here.
- Exact command: `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1
  --repeat 3 --target isolated`, with instance and build label
  `l-final-bench-b` and the run root above. Extension-bearing runs are headed.

## Current status

Bench active concurrently with instance A. The first completed runnable result,
W01 recording repeat 1, passed. The 12 W04/W08 Flow results are present as planned
absences under the Stage 4 counting ruling. At the first active checkpoint free
memory was 8.57 GB. No leak or product blocker has been observed.

At 7 completed executable results the tally was 6 passed and 1 failed. W02
`keyboard-forms`, Flow repeat 1, failed because the approved Flow produced no
durable action attempt (`action.dispatch`; no closed-set code, candidate/action
index, harness count, or `flow-lane.json` was published). Its redaction finding
count was 0. This is one observation under concurrent load; the bench continues.
Free memory at this checkpoint was 7.09 GB. No `recording.persistence` failure
had occurred.

At 14 completed runnable results, 12 passed and 2 failed. The second failure is
the ruled-out W05 `short-catalog` Flow repeat 1: action 0 failed
`target_not_found` / `web.target.not_found`; `startCandidateIndex=0`,
`harnessActivations=0`, oracle passed and the Flow reported failed. Its leak
finding count is 0. This matches the known Stage 2 shape and remains a single
observation. No `recording.persistence` failure occurred.

## Outcome: stopped for W02 remediation

The supervisor stopped both final benches once W02 exposed a defect which must
be remediated before criterion 5 can be measured. This is a partial,
single-observation diagnostic run, not either of criterion 5's two complete
benches. Bench id `bench-mu0aucmv-b503cd81` completed 21 executable evaluations:
18 passed and 3 failed. It also wrote the 12 deliberate W04/W08 Flow absences
required by the Stage 4 ruling. The interrupted W11 run remains in `.work` and
its staging directory; neither it nor any other partial artifact was deleted.

### Headline partial rates

| Lane | Completed | Passed | Failed | Observed pass rate |
| --- | ---: | ---: | ---: | ---: |
| recording | 10 | 10 | 0 | 100.0% |
| Flow | 11 | 8 | 3 | 72.7% |
| both | 21 | 18 | 3 | 85.7% |

### Completed rows

Packet sizes are sanitized UTF-8 bytes. A dash means the lane produced no Flow
packet or the field does not apply. `start` is `startCandidateIndex`; `harness`
is `harnessActivations`.

| Row | Lane | Variant | Repeat | Verdict | start | harness | Packets | Byte range | Truncated |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| W01 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W01 | Flow | — | 1 | passed | 0 | 0 | 8 | 1,969–2,060 | 0 |
| W02 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W02 | Flow | — | 1 | failed | — | 0 | 0 | — | 0 |
| W03 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W03 | Flow | — | 1 | passed | 0 | 0 | 8 | 3,969–4,686 | 0 |
| W04 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W05 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W05 | Flow | — | 1 | passed | 0 | 0 | 8 | 5,847–5,944 | 8 |
| W05 | Flow | `short-catalog` | 1 | failed | 0 | 0 | 2 | 5,828 | 2 |
| W06 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W06 | Flow | — | 1 | passed | 0 | 0 | 6 | 5,847–5,992 | 6 |
| W06 | Flow | `no-results` | 1 | passed | 0 | 0 | 6 | 2,693–5,875 | 3 |
| W07 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W07 | Flow | — | 1 | passed | 0 | 0 | 14 | 5,822–5,920 | 14 |
| W08 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W09 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W09 | Flow | — | 1 | passed | 0 | 0 | 2 | 5,864–5,909 | 2 |
| W10 | recording | — | 1 | passed | — | 0 | 0 | — | 0 |
| W10 | Flow | — | 1 | failed | 0 | 0 | 2 | 1,258–1,266 | 0 |
| W10 | Flow | `broken-link` | 1 | passed | 0 | 0 | 2 | 966–1,258 | 0 |

The 12 explicit absences are W04 Flow unarmed and `text-variant`, and W08 Flow
unarmed and `column-reorder`, repeats 1–3. They were not executed and are not
included in the rates above.

### Evidence and harness totals

| Lane | Runs | Actions reported | Packets | Packet-byte range | Truncated | Harness activations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| recording | 10 | 6 | 0 | — | 0 | 0 |
| Flow | 11 | 29 | 58 | 966–5,992 | 35 | 0 |

Every measured packet was at or below the 6,000-byte budget. The Flow
evaluations' `truncationCount` totals 35 and equals the number of packets marked
truncated. Recording-lane packets are absent by the bench's declared measurement
source. Harness activations are 0 on every completed row.

### Bounded failure facts

1. **W02 Flow, repeat 1:** `action.dispatch`; the approved Flow produced no
   durable action attempt. No `flow-lane.json` exists, so an action index and
   `startCandidateIndex` are unavailable. The bench evaluation records
   `harnessActivations=0`; oracle and reported verdict are both null.
2. **W05 `short-catalog` Flow, repeat 1:** action 0 failed
   `target_not_found` / `web.target.not_found`, `startCandidateIndex=0`,
   `harnessActivations=0`; oracle passed, reported verdict failed. This is a
   ruled-out criterion row but remains a real bench failure.
3. **W10 unarmed Flow, repeat 1:** `action.dispatch`; action 0 was
   `web.dom.click:succeeded` where the workflow required
   `web.browser.navigate:succeeded`. `startCandidateIndex=0`,
   `harnessActivations=0`, Flow status succeeded; oracle failed while the
   persisted run reported passed.

Across all 21 completed bundles: redaction-attestation findings 0,
`recording.persistence` failures 0, and recording-discard observations 0. The
leak stop rule therefore did not fire.

### Exit-criterion accounting

- **Criterion 1:** only repeat 1 through W10 completed. The unarmed recording
  population is 10/10; the executable unarmed Flow population, with W04/W08
  absent by ruling, is 6/8. The required W01–W19 3-of-3 result is unmeasured.
- **Criterion 2:** this partial run measured the packet figures above, but it is
  not the standalone 16-item and `sensitive-input` proof. It cannot close the
  criterion.
- **Criterion 3:** W20–W23 and W26 were not reached.
- **Criterion 4:** W14, W19, and W27 were not reached. W10 `broken-link` passed,
  but it is outside the criterion's primary population.
- **Criterion 5:** not measured. Bench B was intentionally stopped and must not
  be selected as one of the two consecutive complete runs.
- **Criterion 6:** this run adds W02 and W10 Flow defects to the blocker input;
  it does not itself produce the final ranked list.

## Cleanup and verification

- The owned bench process tree was interrupted through its dedicated execution
  session. A follow-up process query found 0 Node/cmd runtime processes for
  `l-final-bench-b`, this worktree, or this run root, and 0 owned listeners.
- The run root and all partial artifacts remain intact. No run directory was
  deleted.
- The downstream worktree is clean at the exact downstream pin. Its three
  generated builds left no tracked diff, so no generated file needed restoring.
- The shared Core worktree remains clean at the exact Core pin.
- Initial free memory was 11.64 GB. The lowest retained checkpoint was 7.09 GB;
  the launcher sampled more frequently in memory, but interruption prevented it
  from emitting its final minimum, so a lower between-checkpoint value is not
  verified. Free memory after shutdown was 12.27 GB. No memory pause occurred.

## Not verified

- Repeats 2 and 3, and repeat 1 after W10, did not run.
- No complete bench report or cross-bench metric comparison exists from this
  stopped campaign.
- The interrupted W11 staging bundle was not evaluated.
- The between-checkpoint memory minimum is not recoverable from the interrupted
  launcher; 7.09 GB is the bounded observed minimum, not a continuous one.
- Chromium extension-bearing lanes only; Firefox was not run.
