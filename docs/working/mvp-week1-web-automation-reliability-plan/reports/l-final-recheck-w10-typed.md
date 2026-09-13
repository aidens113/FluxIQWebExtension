# Report: l-final-recheck-w10-typed

Worker report, 2026-09-13. Bounded identifiers, counts, categories, and timings
only; no raw logs, page data, screenshots, or secret values.

## Setup

- Downstream `F:\fxlab\fxlab-16ff729-b`: detached and clean at local candidate
  `8327dddfd3fd4be89a4fceb4b85cb1d74ac08e9d`.
- Shared Core `F:\fxlab\!FluxIQ`: clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`, used read-only.
- Downstream `domain`, `test-contracts`, and `scenario-lab` builds exited 0.
- New run root: `F:\fxlab-runs\final\recheck-w10-typed`.
- Initial free physical memory: 10.29 GB. No auth-gate value is used.

## Current status

The six loaded acceptance runs completed under isolated instance
`l-final-recheck-w10-typed`.

## Outcome: candidate rejected

The primary acceptance is 1/3, not 3/3. In repeats 1 and 2 the scripted CDP
navigation step completed, but the recording retained only the click: one
extension action, one Core action, and one proposal candidate. Repeat 3 retained
both actions and passed. The `broken-link` acceptance is fully green 3/3.

| Run | runId | Exit / test | Bundle seconds | Extension/Core actions | Candidates | start | Harness | Result |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| primary 1 | `run-mu0dqkab-0edbbf7d` | 1 / failed | 54.0 | **1/1** | **1** | 0 | 0 | click only; oracle failed, reported passed |
| primary 2 | `run-mu0ds6se-8db39ae8` | 1 / failed | 51.1 | **1/1** | **1** | 0 | 0 | click only; oracle failed, reported passed |
| primary 3 | `run-mu0dtsbk-f3055fa9` | 0 / passed | 64.9 | 2/2 | 2 | 0 | 0 | click then navigation; both verdicts passed |
| `broken-link` 1 | `run-mu0dvu0c-6c4e1583` | 0 / passed | 66.3 | 2/2 | 2 | 0 | 0 | expected click failure |
| `broken-link` 2 | `run-mu0dxzld-9d89082c` | 0 / passed | 59.1 | 2/2 | 2 | 0 | 0 | expected click failure |
| `broken-link` 3 | `run-mu0dzuyj-43c873c2` | 0 / passed | 56.6 | 2/2 | 2 | 0 | 0 | expected click failure |

### Primary

- All three fixture event streams contain one `Start navigate` and one
  `Complete navigate`; the CDP command itself completed 3/3.
- Repeats 1 and 2 produced only `web.dom.click:succeeded:matched`. Their Flow
  status was succeeded, but oracle verdict failed while the persisted run
  reported passed.
- Repeat 3 produced `web.dom.click:succeeded:matched` followed by
  `web.browser.navigate:succeeded:matched`; Flow, oracle, reported, and test
  verdicts passed.
- Thus the mandatory two extension/Core actions and two candidates held 1/3.

### `broken-link`

- Two extension actions, two Core actions, and two proposal candidates 3/3.
- `startCandidateIndex=0` and `harnessActivations=0` throughout.
- The first action failed as expected with comparison `unexpected_state` and
  category/code `navigation_unexpected` / `web.navigation.unexpected`.
- Oracle passed, the persisted run reported the expected failure, and the test
  verdict passed 3/3.

## Safety, memory, and cleanup

- Leak findings 0 in all six accepted bundles. No
  `recording.persistence` failure and no recording discard occurred.
- The driver observed a campaign minimum of 4.33 GB through run 4, above the
  3 GB pause threshold. After the supervisor's stop-after-current instruction,
  the identified launcher was stopped while its already-active final child was
  preserved; that child's continuous minimum was consequently not retained.
  No seventh run started. Final point-in-time free memory was 7.33 GB.
- All six bundles are preserved under the owned run root.
- Owned runtime processes 0; owned listening sockets 0.
- Downstream and Core worktrees are clean at the exact pins above. Generated
  tracked files required no restoration.

## Not verified

- The candidate is not accepted because the primary recording shape failed
  twice consecutively under loaded conditions.
- Continuous free-memory minima for the final two runs were not retained after
  the directed launcher stop; the memory guard had admitted each run above its
  3 GB threshold.
- Chromium e2e build only; Firefox was not run.
