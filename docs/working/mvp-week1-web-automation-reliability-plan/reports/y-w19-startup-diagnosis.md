# `y-w19-startup-diagnosis` — accepted-tree startup classification

## Classification

- Run: `run-mu1dfobh-b6be2187`.
- Durable category: `process.startup`.
- Bounded outcome: `timeout`.
- Fixed operation stage: not recorded.
- Fixed diagnostic code: not recorded.
- `failureDetails`: absent.
- Extension launch: not reached. The failure is ordered before browser context
  creation and therefore before extension launch or installation.

Private inspection identified no safely publishable classification narrower
than the fixed labels above. The next three isolated invocations passed, so the
failure occurred once in four accepted-tree invocations and did not repeat in
the three immediate confirmations.

## Counts and bounds

- Configured startup bound: 60,000 ms.
- Poll interval bound: 200 ms.
- Total run elapsed time: 67,546 ms.
- Recorded steps: 0.
- Recorded actions: 0.
- Recorded process-exit entries: 0.
- Recorded run artifacts: 0.
- Flow created: false.
- Harness activations: 0.
- Sanitized evidence packets: 0.
- Truncations: 0.

The transient topology allocation, including its process logs, was removed by
the startup-failure cleanup path. The preserved bundle retains the category and
raw summary but does not retain a safe stage projection or process-exit fact.
Consequently it cannot distinguish the failed startup operation using only its
fixed safe fields.

## Smallest safe diagnostic correction

Give the bounded startup wait a required closed-set `operationStage`, and
persist only:

```text
failureCategory: process.startup
failureDetails.bounded: timeout
failureDetails.operationStage: <closed startup-stage label>
failureDetails.timeoutMs: 60000
```

The coordinator should supply the stage; the bounded wait should omit its
target from durable details; and the existing failure-event projection should
carry only that allowlisted structure before cleanup. A small contract test
should prove each startup wait maps to one closed stage and that no target,
body, raw message, or nested cause survives. This is diagnostic-only: the
single non-repeating result does not justify a retry or timeout change.

This was read-only diagnosis. I did not build, run Lab, edit product/shared
documents, commit, or push. This report is the only file written.
