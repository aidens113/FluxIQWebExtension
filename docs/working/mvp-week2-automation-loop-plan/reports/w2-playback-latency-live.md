# W2 playback latency live report

## Result

Status: **passed with a measured 1,016 ms runtime-step improvement; the
remaining 14.8 seconds is real snapshot/action execution, not a removable
playback poll**.

The saved production-panel Flow still passed with the exact durable identities,
4/4 actions, the submitted-page oracle, and zero normalized provider calls or
LLM activity. I removed only redundant synchronous Lab screenshot boundaries
around Core's own internal `web.dom.capture_snapshot` commands. I did not remove
or shorten Core's before/after state captures, action waits, runtime response
wait, page oracle, or durable-detail checks.

## Baseline decomposition

The second proven reuse run was used as the stable baseline:
`demo-playback-2026-09-21T00-36-14-892Z-860fd8`, runtime run
`70bf1457-8ffa-4e2c-9c5b-8d5befaabb57`.

- Panel `runtime-run`: 15,790 ms.
- Twelve Lab action-evidence boundaries: 13,386 ms total.
- Eight internal `web.dom.capture_snapshot` boundaries: 8,702 ms, or 55.1% of
  the whole runtime step.
- Four user-action boundaries: 4,684 ms, or 29.7%.
- Dispatch, routing, and finalization outside those boundaries: about 2,404 ms.
- Core durable attempts lasted 9,616 ms, with 3,491 ms between attempts; the
  timestamps matched the repeating before-snapshot / action / after-snapshot
  sequence.

The action types and durations were unusually regular: every type/select and
internal snapshot command occupied about 1.08â€“1.10 seconds; the final click was
about 1.40 seconds. That regularity initially made the synchronous Lab boundary
capture the largest plausible avoidable owner.

## Narrow change

In the isolated candidate only,
`packages/test-runner/src/demo-workspace/browser-session.ts` now acknowledges
`web.dom.capture_snapshot` action-evidence boundaries without asking the Lab to
take a second screenshot around them.

This is deliberately narrower than suppressing all action evidence:

- user-action before/after screenshots remain;
- Core still executes and durably records every before/after state snapshot;
- the extension still produces the snapshot payload used by state refs/diffs;
- the panel still waits for the real runtime response; and
- no product or Core action semantics changed.

The redundant Lab captures existed only while the test action-evidence port was
installed. A normal user panel run has no such port, so this change improves and
clarifies Lab measurement rather than claiming a one-second production-runtime
optimization.

## Live rerun

- Evidence bundle: `demo-playback-2026-09-21T00-42-53-014Z-6d4a23`.
- Runtime run: `bc7f2efd-a9f2-4055-bd61-0da2c247db4b`.
- Exact saved project/Flow/Subflow/graph/router identities: unchanged.
- Panel `runtime-run`: **14,774 ms**, down 1,016 ms (6.4%).
- Evidence bundle duration: 24,570 ms, down 575 ms from the 25,145 ms baseline.
- Playback function: 32,436 ms; including the separate post-stop durable query:
  38,283 ms.
- Evidence events/screenshots: 99/84, down from 115/100 exactly because the
  eight internal commands no longer add before/after Lab screenshots.
- User action-evidence boundaries: 8 events for four actions, all retained.
- Internal snapshot Lab boundary events: 0.
- Durable action attempts: 4; succeeded: 4.
- Submitted-page oracle: passed.
- Provider count: optional field absent, normalized by the established
  `(value ?? 0)` rule to 0.
- Interventions, adaptation IDs, change-proposal IDs, and summary adaptations:
  all 0.

## What the rerun proved about the remaining time

Filtering the redundant Lab visuals reduced each durable attempt by roughly
130â€“150 ms and each between-attempt gap by roughly 140 ms, totaling the measured
1,016 ms. It did **not** remove the one-second cadence:

- Core run duration: 13,832 ms.
- Durable attempt durations: 2,202 / 2,170 / 2,189 / 2,477 ms.
- Between-attempt gaps: 1,019 / 1,013 / 1,029 ms.
- First-attempt start through final-attempt finish: 12,099 ms.
- Sanitized panel timeline after filtering still shows about 2.1 seconds before
  each next user action, corresponding to the real after-state and next
  before-state capture sequence.

The remaining time is therefore predominantly the real, correctness-bearing
host-state snapshot/action path. Removing those captures would discard the
before/after state refs and diffs used for diagnosis and repair, which this brief
forbids. No timeout, readiness wait, page-oracle wait, or control polling bound
was reduced.

## Focused validation

A directly owned focused test was added at
`packages/test-runner/src/demo-workspace/tests/browser-session.test.ts`. It
proves the internal snapshot boundary is acknowledged without a Lab capture and
an ordinary `web.dom.type` boundary is still captured and acknowledged.

Focused command:

`node --test packages/test-runner/dist/demo-workspace/tests/browser-session.test.js`

Result: 1 test passed, 0 failed. The prerequisite test-runner build passed. No
other unit tests, broad suite, commit, or push ran.

## Mutation boundary

- Core remains clean and unchanged.
- Saved workspace identities and recording were preserved.
- The prior `flow-document.ts` recording predicate diff remains untouched.
- This brief adds only the host filter and its focused test in the isolated
  candidate, plus this report in the main working-doc tree.
- The user's panel/profile/data and provider, batch, repair, and recording
  generation lanes were untouched.
