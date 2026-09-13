# Report: l-final-recheck-w10

Worker report, 2026-09-13. Bounded identifiers, statuses, categories, counts,
and timings only; no raw logs, page data, screenshots, or secret values.

## Setup

- Downstream `F:\fxlab\fxlab-16ff729-b`: detached and clean at
  `15974e749feed931b7de3c73ec6611c801557e32`.
- Shared Core `F:\fxlab\!FluxIQ`: clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`, used read-only.
- Downstream `domain`, `test-contracts`, and `scenario-lab` builds all exited 0.
- Run root `F:\fxlab-runs\final\recheck-w10` was absent before the run.
- Initial free physical memory: 11.26 GB. No auth-gate value is used.

## Current status

The six loaded rechecks are active under isolated instance
`l-final-recheck-w10`, concurrently with the W02 worker. Primary repeat 1 exited
0 in 84.1 seconds with leak findings 0. It produced two candidates, started at
0, used the harness 0 times, executed `web.dom.click:succeeded` then
`web.browser.navigate:succeeded`, and both oracle and reported verdict passed.
Its minimum free memory was 5.55 GB. No blocker was visible at that checkpoint.

## Outcome: blocked by proposal-candidate instability

All six commands exited 0 and their test verdicts passed. Primary is 3/3 on
every required behavior. The `broken-link` variant produced two candidates only
1/3 times: repeats 2 and 3 produced one. Therefore the brief's two-candidate
requirement is 4/6 overall, not 6/6, and this loaded recheck has a blocker.

| Run | runId | Exit | Seconds | Candidates | start | Harness | Flow / test | Minimum free GB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| primary 1 | `run-mu0c89t0-a0d4b4ec` | 0 | 84.1 | 2 | 0 | 0 | succeeded / passed | 5.55 |
| primary 2 | `run-mu0c9znw-2bbadb00` | 0 | 77.6 | 2 | 0 | 0 | succeeded / passed | 7.51 |
| primary 3 | `run-mu0cbqkp-5d033721` | 0 | 89.6 | 2 | 0 | 0 | succeeded / passed | 6.42 |
| `broken-link` 1 | `run-mu0cdl7k-caf3836f` | 0 | 97.3 | 2 | 0 | 0 | expected failure / passed | 5.64 |
| `broken-link` 2 | `run-mu0cfoni-cf63072f` | 0 | 74.5 | **1** | 0 | 0 | expected failure / passed | 7.69 |
| `broken-link` 3 | `run-mu0ch926-65b2f21b` | 0 | 69.8 | **1** | 0 | 0 | expected failure / passed | 9.13 |

### Primary, 3/3

- Two proposal candidates and `startCandidateIndex=0`.
- `harnessActivations=0` and durable Flow status `succeeded`.
- Action 0 `web.dom.click:succeeded:matched`, then action 1
  `web.browser.navigate:succeeded:matched`.
- Oracle verdict `passed`, reported verdict `passed`, test verdict `passed`.

### `broken-link`, 3/3 verdicts but 1/3 candidate counts

- `startCandidateIndex=0` and `harnessActivations=0` throughout.
- The first and only attempted action was `web.dom.click:failed` with
  comparison `unexpected_state` and expected category/code
  `navigation_unexpected` / `web.navigation.unexpected`.
- Oracle verdict `passed`, reported verdict `failed` with the expected category,
  and test verdict `passed` throughout.
- Candidate counts were 2, 1, 1. The latter two are consecutive loaded
  observations, so this is not treated as a one-off timing or faulty-RAM result.

## Safety and cleanup

- Leak findings were 0 in all six bundles; the leak stop rule did not fire.
- No `recording.persistence` failure occurred. One logical
  `recording.event_discarded` was reported twice across the first and second
  discard reads of `broken-link` repeat 1; unioned by its audit identity it is
  one discard, with 0 discarded actions, 1 discarded event, 7 ms after
  finalization. The other five runs reported none.
- Campaign minimum free physical memory was 5.55 GB. It never crossed the
  3 GB pause threshold, so no memory wait was needed.
- After completion, owned runtime processes 0 and owned listening sockets 0.
- The run root and all six accepted bundles remain intact.
- Downstream and shared Core worktrees are clean at the exact pins above;
  generated tracked files required no restoration.

## Not verified

- The variant's required two-candidate recording shape did not hold, so the W10
  recheck is not accepted as fully green and full benches should not rely on it
  without the supervisor's disposition.
- These are loaded concurrent observations, not isolated reruns.
- Chromium e2e build only; Firefox was not run.
