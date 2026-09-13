# Report: l-final-recheck-w10-intent2

Worker report, 2026-09-13. Bounded identifiers, counts, categories, and timings
only; no raw logs, page data, screenshots, or secret values.

## Setup

- Downstream worktree `F:\fxlab\fxlab-16ff729-b`: detached and clean at
  `6b379a909973158e397f85490d866852816a024c`.
- Shared Core worktree `F:\fxlab\!FluxIQ`: clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`, used read-only.
- Downstream `domain`, `test-contracts`, and `scenario-lab` builds exited 0.
- New run root: `F:\fxlab-runs\final\recheck-w10-intent2`.
- Initial free physical memory: 11.94 GB. No auth secret is used.

## Current status

The six-run sender-corrected acceptance completed under isolated instance
`l-final-recheck-w10-intent2`.

## Outcome: accepted 6/6

Every recording retained two extension actions, two Core actions, and two
proposal candidates. Primary passed 3/3 with click then navigation. The
`broken-link` variant passed 3/3 with its expected first-click failure.

| Run | runId | Exit/test | Bundle seconds | Extension/Core actions | Candidates | start | Harness | Result |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| primary 1 | `run-mu0fyjgs-23a59539` | 0 / passed | 57.2 | 2/2 | 2 | 0 | 0 | click then navigation; both verdicts passed |
| primary 2 | `run-mu0g07bj-aa10272c` | 0 / passed | 53.0 | 2/2 | 2 | 0 | 0 | click then navigation; both verdicts passed |
| primary 3 | `run-mu0g1rbv-aadb2117` | 0 / passed | 47.4 | 2/2 | 2 | 0 | 0 | click then navigation; both verdicts passed |
| `broken-link` 1 | `run-mu0g37j8-bb3c8a28` | 0 / passed | 48.2 | 2/2 | 2 | 0 | 0 | expected first-click failure |
| `broken-link` 2 | `run-mu0g4nvo-6888614a` | 0 / passed | 49.8 | 2/2 | 2 | 0 | 0 | expected first-click failure |
| `broken-link` 3 | `run-mu0g65eg-216643b2` | 0 / passed | 43.5 | 2/2 | 2 | 0 | 0 | expected first-click failure |

### Primary, 3/3

- Flow status `succeeded`, `startCandidateIndex=0`, and
  `harnessActivations=0` throughout.
- Action 0 `web.dom.click:succeeded:matched`, then action 1
  `web.browser.navigate:succeeded:matched`.
- Oracle verdict, reported verdict, and test verdict all `passed`.

### `broken-link`, 3/3

- Flow status `failed` as expected, `startCandidateIndex=0`, and
  `harnessActivations=0` throughout.
- The first attempted action was `web.dom.click:failed`, comparison
  `unexpected_state`, category/code `navigation_unexpected` /
  `web.navigation.unexpected`.
- Oracle verdict passed, the persisted run reported the expected failure, and
  test verdict passed.

## Acceptance totals

- Two retained extension/Core actions: 6/6.
- Two proposal candidates: 6/6.
- Start candidate zero: 6/6.
- Harness activations zero: 6/6.
- Correct primary action sequence and all passed verdicts: 3/3.
- Correct variant first-click category/code and passed test verdict: 3/3.
- Leak findings zero: 6/6.
- Persistence failures zero and recording discards zero: 6/6.

## Memory and cleanup

- Campaign minimum free physical memory: 8.96 GB, above the 3 GB pause
  threshold. No memory wait was required.
- All six accepted bundles are preserved under the owned run root.
- Owned runtime processes 0 and owned listening sockets 0 after completion.
- Downstream and shared Core worktrees are clean at the exact pins above;
  generated tracked files required no restoration.

## Not verified

- These are six loaded single-machine observations; the supervisor must still
  verify the report before accepting the candidate.
- Chromium e2e build only; Firefox was not run.
