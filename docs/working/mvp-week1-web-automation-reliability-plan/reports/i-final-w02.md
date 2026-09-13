# i-final-w02 — final-bench W02 Flow repeat-0 investigation

Read-only investigation, 2026-09-13. Source read at downstream `4cde72d` and
Core `19468b7`, the pushed pins used by both final benches. Only this report is
owned by this worker. No source, shared document, worktree, or run artifact was
changed, and no Lab or heavy gate was run. Bundle inspection is limited to
closed-set fields, counts, phases, statuses, and artifact presence; no raw log,
page data, screenshots, credentials, selectors, or secret values are reported.

## Current finding

Both campaigns have reproduced the same W02 primary-workflow failure at Flow
repeat 0. In each bundle:

- the completed bundle verdict is `failed` and its failure category is
  `action.dispatch`;
- the error is exactly the runner guard “The approved Flow produced no durable
  action attempt”;
- the recording-side script and persistence completed before the Flow dispatch;
- no Flow observation was published, so evaluation reports `flowCreated=false`,
  null oracle/reported verdicts, zero actions, and no structured automation
  failure.

The two failures therefore share a phase and immediate cause. They are not the
earlier Core action probe: each bundle's probe navigation and type action
settled successfully before recording began.

The strongest source-backed explanation is a runner timeout/read race, though
the current bundles do not preserve the swallowed timeout itself. Proposal
creation, approval, page preparation, and the persisted run start all occur
before the guard can fire. Later W02 repeats are still needed to distinguish
that lifecycle race from a deterministic W02 graph/runtime defect.

## Source trace

- W02 records a type, Enter keypress, and two checked-control changes and expects
  `web.dom.type`, `web.dom.keypress`, and `web.dom.check`
  (`apps/scenario-lab/src/scenarios/keyboard-forms/manifest.ts:15-39`).
- The Flow lane finalizes the recording, creates and approves Core's proposal,
  prepares the start page, reads action nodes, then starts/runs the persisted
  Flow (`packages/test-runner/src/flow-lane/run-flow-lane.ts:98-152`).
- `executeRecordedFlowRun` reads the durable run detail and throws the observed
  `action.dispatch` error only when that detail has zero actions
  (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:146-170`).
- Every HTTP operation defaults to 30 seconds
  (`packages/test-runner/src/http-control.ts:154-175`). The persisted-run helper
  catches **any** `RunnerFailure` from `runPersistedFlow`, marks the session
  failed, and immediately performs one detail read
  (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:157-170`). It does
  not distinguish the bounded transport timeout exported by
  `isBoundedHttpFailure` (`packages/test-runner/src/http-control.ts:150-151`).
  The sibling existing-Flow path does distinguish that condition and attempts
  cancellation before rethrowing (`packages/test-runner/src/existing-flow-run.ts:113-119`).
- Core's endpoint runs synchronously and only writes the terminal session/detail
  after graph execution (`packages/fluxiq/src/programs/automation-studio/runtime/service.ts:3345-3604`). A client-side fetch timeout can therefore be followed
  by a one-shot read while the session is still running and before any attempt
  is durable.
- That one-shot read has an especially exact failure mode: when no terminal
  detail exists, `getFlowRunDetail` converts the current runtime session to a
  detail, marks it as partial-write recovery, saves it, and returns it
  (`packages/fluxiq/src/programs/automation-studio/runtime/service.ts:3840-3854`).
  The session written immediately before graph execution is `running` and has
  no trace yet (`service.ts:3448-3463`), so its recovered detail has zero action
  attempts. This precisely feeds the downstream guard at
  `persisted-flow-run.ts:168-170`.
- Evidence publication happens only after that function returns
  (`packages/test-runner/src/flow-lane/run-flow-lane.ts:161-171`). Consequently
  this failure cannot publish a Flow observation even though proposal approval
  and run dispatch preceded it.
- The bench intentionally translates an absent Flow observation into
  `flowCreated=false`, null verdicts, and zero actions
  (`packages/test-runner/src/bench/evaluate-run.ts:79-106`). Thus
  `flowCreated=false` here means “the lane did not reach evidence publication,”
  not proof that approval created no Flow.

## Evidence observed so far

| Campaign | Completed W02 primary Flow r0 | Failure | Later W02 primary Flow repeats |
| --- | --- | --- | --- |
| final/a | one | `action.dispatch`; no durable attempt; no Flow observation | not yet observed |
| final/b | one | `action.dispatch`; no durable attempt; no Flow observation | not yet observed |

Both campaigns' W02 `combobox` recording and Flow rows visible at this point
passed. Those are separate W03 corpus rows, not later repeats of W02 primary.

The bench loop is repeat-major: it completes the entire runnable corpus for
repeat 0 before starting repeat 1 (`packages/test-runner/src/bench/run-bench.ts:110-119`).
That is why no later W02 primary row exists yet even though both campaigns have
moved on to later corpus rows. The failures' wall-clock intervals overlapped;
shared load is therefore a condition of both observations, although the two
isolated instances share no project or runtime state.

The two W02 Flow intervals from the lane's bounded dispatch event to its error
were 42,985 ms and 46,497 ms. This is consistent with proposal/approval setup
followed by the shared 30-second request bound. The intervals overlap in wall
clock time, so the observation is specifically under the authorized concurrent
load. This timing supports, but does not by itself prove, the swallowed-timeout
mechanism.

## Preliminary classification

- Severity: **high for Week 1 closeout** — if repeatable, W02 cannot meet the
  unarmed Flow reliability criterion.
- Reproducibility: **2 of 2 independent campaign repeat-0 runs** at the same
  pushed pins.
- Immediate-cause confidence: **high** — both bounded bundles reach the same
  zero-durable-attempt guard.
- Root-cause confidence: **medium-high for the runner timeout/read race**. The
  code path predicts the exact empty-detail shape and both elapsed intervals
  fit its bound; the bundles do not preserve the swallowed timeout, and later
  repeats remain outstanding.
- Smallest provisional fix area: downstream
  `flow-lane/persisted-flow-run.ts` and its focused tests. At minimum it must not
  treat a bounded HTTP timeout/abort as a completed action failure and then
  classify an in-progress detail as “no durable attempt.” A complete reliability
  fix should either give this synchronous operation an action-count-aware bound,
  or poll the exact run to a terminal detail under a separate bound; it should
  preserve cancellation/cleanup semantics. No evidence supports changing the
  W02 fixture, mapper, Core graph creation, or extension action implementation.

## Still to verify

- W02 primary Flow repeats 1 and 2 in each campaign.
- Whether the no-attempt Core detail is already terminal or was read before its
  first attempt became durable.
- Whether proposal/action-node counts and run status can be recovered from a
  bounded, non-sensitive artifact without opening runtime workspace data.
- The narrow owning source and a focused regression/mutation test once the race
  versus product-graph distinction is resolved.

## Checks and handoff

- Read both completed W02 primary Flow repeat-0 bundles plus the corresponding
  W02 recording rows, using selected evaluation fields and event phases only.
- Confirmed both error summaries equal the runner's fixed no-durable-attempt
  guard and both pre-recording action probes settled `succeeded`.
- Confirmed neither Core log contains an error/warning, timeout, OOM, missing
  start, or no-action diagnostic; raw log lines were not printed or copied.
- Compared the relevant downstream runner/evaluator/tests and Core synchronous
  runtime/detail-recovery source. No test currently distinguishes a bounded
  `runPersistedFlow` failure from the intentional structured failed-run path;
  `persisted-flow-run.test.ts:45-55` explicitly covers only a generic
  `RunnerFailure`, while `:74-81` covers an already-complete empty detail.
- A read-only synthetic probe against the pinned built module made
  `runPersistedFlow` throw the exact bounded-timeout `RunnerFailure` shape and
  returned a running detail with zero attempts. The public helper changed it to
  `action.dispatch` with the exact no-durable-attempt message, confirming the
  suspected catch/read behavior. The probe exited 0 and changed no file.
- No test suite was run: the useful next test is a checked-in version of that
  synthetic bounded-timeout row, owned with the fix. Running an unrelated suite
  while both heavy Lab campaigns are active would add no evidence.

Final classification at this checkpoint: **high severity**, **2/2 reproducible
under concurrent repeat-0 load**, **high immediate-cause confidence**, and
**medium-high root-cause confidence** in the downstream swallowed-timeout /
premature-detail-read path. Core's runtime and detail recovery explain the
shape but are not the smallest fix surface.
