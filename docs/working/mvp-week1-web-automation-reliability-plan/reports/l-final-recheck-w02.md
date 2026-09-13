# `l-final-recheck-w02` — W02 loaded recheck

**Status:** complete — **3 of 3 passed** with the loaded-request recovery path
exercised in every repeat.

**Pins:** downstream `15974e749feed931b7de3c73ec6611c801557e32`;
Core `19468b72c4472fd5cc58940737702d5e4d72c985`.

**Owned paths:** `F:\fxlab\fxlab-7263534-load` and
`F:\fxlab-runs\final\recheck-w02`.

## Setup

- The downstream and Core worktrees were clean and were pinned exactly to the
  assigned commits. Builds of downstream `domain`, `test-contracts`, and
  `scenario-lab` exited 0. The pinned Core build was used read-only.
- Repeat 1 began with 11,579 MiB free physical memory, above the 3-GB guard.
  The parallel W10 campaign was assigned in the same campaign window.

## Runs

- **Repeat 1:** command exit 0; test and oracle verdicts `passed`;
  `flowCreated=true`; 9 durable action attempts, all `succeeded`;
  `startCandidateIndex=0`; `harnessActivations=0`. Flow dispatch-to-settle was
  47,857 ms, beyond the 30,000-ms initial request bound. Because the run still
  returned the terminal detail and durable attempts, the bounded-request
  recovery polling path was exercised. Total facility duration was 88,669 ms.
- **Repeat 2:** command exit 0; test and oracle verdicts `passed`;
  `flowCreated=true`; 9 durable action attempts, all `succeeded`;
  `startCandidateIndex=0`; `harnessActivations=0`; redaction findings 0.
  Flow dispatch-to-settle was 52,768 ms, so it also crossed the initial bound
  and exercised recovery polling. Total facility duration was 100,019 ms; free
  memory before the command was 8,820 MiB.
- **Repeat 3:** command exit 0; test and oracle verdicts `passed`;
  `flowCreated=true`; 9 durable action attempts, all `succeeded`;
  `startCandidateIndex=0`; `harnessActivations=0`; redaction findings 0.
  Flow dispatch-to-settle was 41,729 ms, so it crossed the initial bound and
  exercised recovery polling. Total facility duration was 91,738 ms; free
  memory before the command was 11,875 MiB.

### Bounded result

| Requirement | Observation |
| --- | --- |
| Command exits | 3/3 exited 0 |
| Test verdict | 3/3 `passed` |
| Oracle verdict | 3/3 `passed` |
| Created Flow | 3/3 `true` |
| Durable attempts | 9/9/9; every attempt `succeeded` |
| Start candidate | 0/0/0 |
| Harness activations | 0/0/0 |
| Crossed 30-second request bound | 3/3: 47,857 / 52,768 / 41,729 ms dispatch-to-settle |
| Recovery polling exercised | 3/3; terminal detail and durable attempts returned after each bound crossing |
| Leak findings | 0/0/0 |

The lowest free-memory value read before a command was 8,820 MiB. The memory
guard never paused. These runs were performed in the concurrently dispatched
Stage 4b loaded campaign window; this report does not infer the other worker's
result.

## Cleanup and unverified items

- All three bundles completed. No process associated with this worktree,
  instance, or run root remained after repeat 3.
- The three runs allocated nine distinct scenario/web/gateway ports; zero were
  listening after cleanup.
- Both the downstream and Core worktrees were clean at their exact assigned
  pins after the campaign. Core remained read-only.
- Raw logs, screenshots, page data, and literal values were not inspected or
  copied into this report.
- **Unverified here:** the W10 worker's independent result and a full repeat-3
  bench restart.
