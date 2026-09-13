# g-runner-start-guard — a Flow-lane run that did not start at its first action fails, by name

Worker report, 2026-09-13, at this repository's `af80298` working tree. Test-runner only. No
Lab command, no `pnpm build`, and no Core edit.

## Outcome

**Now Done:** task 1 was finished after the ownership amendment. See "Addendum, 2026-09-13" at the
end of this report. The rest of this section describes the first pass, before the amendment.

**Partial.**

- **Task 2 is done.** A run that stopped with actions never attempted and no failed attempt now
  fails by name. It has a mutation proof.
- **Task 1 is blocked by the brief's ownership.** The data needed to tell which node is the
  Flow's first action is dropped in two files the brief does not own, named below. Nothing for
  task 1 was shipped, because a check with no data to run on would do nothing.
- **Task 3** is answered below for task 2. For task 1 the bench shows nothing new yet.

## What changed and why

### Task 2: an early stop is named

**`packages/test-runner/src/flow-lane/persisted-flow-run.ts`**
- **New optional field** `stoppedWithoutFailedAttempt?: { attemptedActions; unvisitedActions }`
  on `PersistedFlowRunOutcome`, with the exported type `FlowStopWithoutFailedAttempt`.
- **When it is set.** All four must hold:
  - Core's run status is `failed`;
  - every attempt's status is `succeeded`;
  - an action map was given;
  - at least one action node in that map was never attempted.
- **What it counts.** Action nodes are the node ids in `actionTypes`, the same map the lane
  already passes in. Attempted nodes are the distinct `nodeId`s of the run detail's attempts, so
  a node retried twice counts once.
- **When it claims nothing.** A run that has an attempt in any other status: `failed`,
  `timed_out`, `cancelled` or `unknown`. Such a run did not stop cleanly, so calling it "no
  failed attempt" would mislead.
- **Why the field is optional.** `flow-lane/tests/lane-observation.test.ts`, which is not mine,
  builds this type by hand, and a required field would break its compile.
- **What it leaves out.** Only counts travel. Core's `currentNodeId`, its message, and node ids
  stay out.

**`packages/test-runner/src/flow-lane/run-flow-lane.ts`**
- **The named failure.** `assertFlowDidNotStopEarly(run)` runs after `recordEvidence` and before
  the expectation checks. It throws `RunnerFailure("action.dispatch", "The Flow stopped with N
  recorded action(s) never attempted and no failed attempt, after M action(s) succeeded")`, with
  the two counts as details.
- **Why that order.**
  - After `recordEvidence`: the run is published first.
  - Before the expectation checks: otherwise the run fails on whichever later action an
    expectation names. W28 run 2's error read "did not produce a web.dom.click action".
- **The snapshot.** `flowLaneSnapshot` now writes `stoppedWithoutFailedAttempt` into
  `snapshots/flow-lane.json` on every Flow-lane row: the counts, or `null`.

**Tests**
- **`flow-lane/tests/persisted-flow-run.test.ts`**, new row "a failed run whose every attempt
  succeeded, with action nodes never attempted, is recorded as a stop, by counts".
  - **W28's shape:** 4 action nodes, 1 attempt on the last scroll, run `failed`, which gives
    `{ attemptedActions: 1, unvisitedActions: 3 }`.
  - **Nothing leaks:** neither the node id nor Core's message appears in the outcome.
  - **A retried node** counts as one action.
  - **Six cases record no stop:** a failed attempt, a timed-out attempt, a cancelled attempt,
    every node attempted, a run Core did not fail, and no action map.
- **`flow-lane/tests/run-flow-lane.test.ts`**, new row "a Flow that stops with recorded actions
  never attempted and no failed attempt fails as exactly that, after its evidence is published".
  - **The failure:** `action.dispatch`, with the exact message, although the workflow also
    expects a later `web.dom.scroll`.
  - **The evidence** is recorded once, and the snapshot carries `{ attemptedActions: 1,
    unvisitedActions: 2 }`.
  - **A run that did not stop early** publishes `null`.

### Task 1: the wrong start is blocked, and why

The brief's check is "the first attempt is not the Flow's first action". The lane cannot answer
that from the files it may edit.

- **Recording order: the dropped data.** The approved proposal's candidates, in order, each map
  to the node whose `metadata.recordingCandidateId` names it (Core
  `runtime/service/recordings/proposal-candidates.ts:92-122`). The lane drops both ends:
  - **the node's metadata:** `readFlowNodes` (`flow-lane/flow-action-types.ts:11, 64-71`) keeps
    only `id` and `parameterValues`, and drops `metadata`, `position` and the edges;
  - **the candidate ids:** `createRecordingFlowProposal`
    (`flow-lane/recording-flow-proposal.ts:18, 41-52`) keeps only `candidateCount`.
- **The graph's root: the dropped data.** The edges are dropped by the same `readFlowNodes`.
- **Two ways around it, both refused.**
  - **A second read of the Flow** in `run-flow-lane.ts`. That would break the lane's "read the
    approved Flow once" design and its test (`run-flow-lane.test.ts`, "the approved Flow is read
    once…").
  - **Parsing the node ids** (`recorded.candidate.entry.<N>.<uuid>`). That depends on how Core
    names ids, which is the exact dependence `g-core-start-node` removes.

**Files the brief should have included:**
- `packages/test-runner/src/flow-lane/recording-flow-proposal.ts`, to carry the candidate ids in
  order, with its test;
- `packages/test-runner/src/flow-lane/flow-action-types.ts`, to carry each node's
  `metadata.recordingCandidateId`, with its test.

**Recommended rule: the recording's order, not the graph's root.**
- **Recording order is independent of Core.** Candidate 1 is the first recorded action,
  whatever start rule Core applies.
- **A root check would only repeat Core's new rule** from `g-core-start-node`. It would miss a
  Flow whose chain was built in the wrong order.

**What the follow-up then does in `run-flow-lane.ts`:**
- publish `startCandidateIndex`;
- throw `RunnerFailure("action.dispatch", …)` when the first attempt's node is not candidate 1's.

The first attempt's `nodeId` would also have to reach `run-flow-lane.ts` from
`persisted-flow-run.ts`. That is not added yet, because nothing would read it.

### Task 3: what the bench shows

**A run that stops early, such as W28 run 2:**

| Bench field | Value |
| --- | --- |
| Verdict | `failed` |
| `failureCategory` | `action.dispatch` |
| Cause | "The Flow stopped with 3 recorded action(s) never attempted and no failed attempt, after 1 action(s) succeeded" (read from the run's `error` event) |
| `flowCreated` | `true` |
| `reportedVerdict` | `failed` |
| `automationFailureReported` | still `ambiguous_or_unknown` (`lane-observation.ts`, not mine, is unchanged) |
| `snapshots/flow-lane.json` | the two counts |

- **Grouping:** bench failure causes group by category and message, so runs with different
  counts form separate groups.
- **Before this change:** the same run showed `action.dispatch` with "The Flow did not produce a
  web.dom.click action; it produced …".

**Every other Flow-lane row:**
- no verdict change;
- `stoppedWithoutFailedAttempt: null` in `flow-lane.json`.

**W15's shape is not caught.** Its first attempt, the tab close, failed or timed out, so the run
had a failed attempt and shows what it showed before. Only the task 1 check, or Core's start-node
fix, changes W15.

## Commands run and observed results

Each command's output went to a scratch file with its exit code, never through a pipe.

1. **Type check.** `pnpm check`, in `packages/test-runner`: exit 0.
2. **Structure audit.** `node scripts/structure-audit.mjs`, from the root: exit 0, "structure-audit:
   passed (41 warning(s), 17 baselined)". Its one line on my files is advisory:
   "packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts: 445 lines is past the 400-line
   advisory threshold". The file was 426 lines before my row, and it is not baselined.
3. **Private build and full tests.** `pnpm exec tsc -p tsconfig.json --outDir dist-grsg`: exit 0.
   `node --test "dist-grsg/**/*.test.js"`: exit 0, "# tests 557 … # pass 557 # fail 0". Both new
   rows passed, as `ok 110` and `ok 150`.
4. **Hashes before mutating.** `persisted-flow-run.ts` `1F46D454…F7B8`, `run-flow-lane.ts`
   `BA057EB9…1DDD`.
5. **Mutation A.** In `stopWithoutFailedAttempt`, an unconditional `return undefined`. After a
   rebuild, `node --test` on both flow-lane test files: exit 1, "# tests 28 # pass 26 # fail 2".
   - "not ok 12 - a failed run whose every attempt succeeded, …": deep-equal failed, expected
     `unvisitedActions: 3`.
   - "not ok 27 - a Flow that stops with recorded actions never attempted …": "The validation
     function is expected to return "true". Received false … RunnerFailure: The Flow did not
     produce a web.dom.scroll action; it produced web.dom.click:succeeded".
   - Restored. SHA-256 is again `1F46D454…F7B8`: byte-identical.
6. **Mutation B.** The `assertFlowDidNotStopEarly(run)` call replaced with a no-op. After a
   rebuild, `node --test` on `run-flow-lane.test.js`: exit 1, "# tests 16 # pass 15 # fail 1".
   - "not ok 15 - a Flow that stops with recorded actions never attempted …" failed with the same
     "did not produce a web.dom.scroll action" error.
   - Restored. SHA-256 is again `BA057EB9…1DDD`: byte-identical.
7. **Clean rebuild after the restores.** Build exit 0. Full `node --test "dist-grsg/**/*.test.js"`:
   exit 0, "# tests 557 # pass 557 # fail 0". `dist-grsg` was then deleted: `Test-Path` returned
   False.

No command failed in a way that looked environmental. Nothing needed a rerun for the RAM fault.
Each gate above is a single observation.

## Not verified

- **No Lab run.** A Lab run must show three things:
  - **W28's shape** (`iframe-checkout`, a recording of 11 or more entries that starts at a later
    scroll), or any row that stops early:
    - an `error` event with `failureCategory: action.dispatch` and the message above;
    - `stoppedWithoutFailedAttempt` counts in `flow-lane.json`.
  - **Every other Flow-lane row:** `stoppedWithoutFailedAttempt: null` and unchanged verdicts.
  - **Once Core's `g-core-start-node` fix is built:** `null` on every row.
- **Core's live run detail was not observed for this shape.** A run status of `failed` with every
  attempt `succeeded` comes from reading `graph-run.ts:240-252` in the investigation, and from W28
  run 2's single succeeded attempt. The test's fake Core supplies it.
- **Task 1** has no code, no tests and no mutation proof.
- **The root gates** (`pnpm check`, `pnpm test`) were not run. Only the test-runner package and
  the structure audit were run.

## Open questions or contradictions found

- **Brief defect.** Task 1's data lives in `flow-action-types.ts` and
  `recording-flow-proposal.ts`, which the brief did not grant. The investigation's Fix 2 said
  `readFlowNodes` "is already read" and that the lane could map `metadata.recordingCandidateId`.
  It cannot: that function drops `metadata`, and the proposal reader drops the candidates.
- **The Flow's reported category.** A run that stops early still reports
  `automationFailureReported: ambiguous_or_unknown` (`lane-observation.ts:94-98`). The runner
  failure now names the stop, but the automation category does not. Whether that should change
  is the supervisor's call. `lane-observation.ts` was not mine to change.
- **A failed run with a cancelled or unknown attempt** and unvisited nodes is deliberately not
  called a stop. It falls through to the expectation checks as before. Tell me if it should be
  named separately.
- **Counts in the message** mean bench cause groups split by count. Putting the counts only in
  `details` would group every early stop together, but the bench's cause column would then lose
  them.

---

## Addendum, 2026-09-13: task 1 after the ownership amendment

The supervisor gave this worker `flow-lane/flow-action-types.ts`,
`flow-lane/recording-flow-proposal.ts` and their tests. The decision: take the first action from
the recording's candidate order, keep the lane's one read of the Flow, and parse no node ids.
Task 1 was built on top of the uncommitted task 2 diff.

### Outcome

**Done.** Both tasks are done, each with a mutation proof. A run that did not start at the
recording's first action now fails by name.

### What changed and why

**`flow-lane/recording-flow-proposal.ts`**
- **New field** `candidateIds` on `RecordingFlowProposal`: the candidates' ids in Core's order,
  which is the recording's order.
- **A candidate with no id is refused.** Without a non-empty string id, the proposal fails as
  `recording.contract`, naming `proposal.candidates[i].candidateId`.

**`flow-lane/flow-action-types.ts`**
- **New optional field** `recordingCandidateId` on `FlowNodeRecord`, taken from the node's
  `metadata.recordingCandidateId` in the same read the lane already makes.
- **Why optional:** `declared-uploads.test.ts`, which is not mine, builds this record by hand, and
  a node no recording produced has no link.
- **Evidence the link survives Core's read, from code only:**
  - Core's graph index stores node metadata (`graph_nodes.metadata_json`);
  - `flowNodeFromGraphRecord` returns it (Core `runtime/service/flows/mapping.ts:23-33`);
  - `materializeCanonicalGraphFlow` builds nodes through that function
    (`runtime/service/flows/store.ts:258`).

**`flow-lane/persisted-flow-run.ts`**
- **New input** `candidateOrder`: node id to position in the recording's order.
- **New optional output** `startCandidateIndex`: the position of the run's first attempt, in
  Core's attempt order, that lands on a node the order names. It is a position, never a node id.
- **A first design was replaced.** It carried `firstActionNodeId` on the outcome, which put a node
  id there. My task 2 row then failed: "recorded.scroll.two must not travel". I kept that
  assertion and changed the design instead.
- **The attempts' node ids are now an ordered list,** and the early-stop count builds its set
  from it.

**`flow-lane/run-flow-lane.ts`**
- **Before the run:** the new `recordedCandidateOrder` maps each action node to its candidate
  position. If any action node links to no candidate of this proposal, the run fails before
  dispatch as `recording.contract`: "The approved Flow has action nodes linked to no candidate of
  the recording's proposal, so where the recording begins cannot be identified". The details are
  `flowId`, `unlinkedActionNodes` and `candidateCount`.
- **After the run:** `startCandidateIndex` is published in the lane's evidence, in its outcome, and
  in `snapshots/flow-lane.json` (0 for the first action, or `null`).
- **The start check.** `assertFlowStartedAtFirstAction` runs after the evidence is recorded, and
  before both the early-stop check and the expectations.
  - **A wrong start** fails as `action.dispatch`: "The Flow started at recorded action N of M, not
    at the recording's first action", with `startCandidateIndex` and `candidateCount` as details.
  - **No attempt on an action node** fails as `action.dispatch`: "The Flow's attempts name none of
    its action nodes, so the run cannot be shown to start at the recording's first action".
- **Why the start is checked before the stop.** A run that began at a later action also stops
  short, and the start is the cause, so W28 run 2's shape names the start.

**Tests**
- **`recording-flow-proposal.test.ts`**, row "the proposal keeps its candidates' ids in Core's
  order, never sorted, and a candidate without an id is refused".
  - The ids are given unsorted, `entry.4`, `entry.13`, `entry.8`, and come back in that order.
  - A missing, empty or numeric id is refused.
  - The shared `withCandidates` helper gained `candidateIds`.
- **`flow-action-types.test.ts`**, row "each node carries the recorded candidate its metadata
  names, and a node with none, or a malformed one, carries none".
  - A node whose id says entry 10 and whose metadata says entry 9 reads entry 9.
  - A missing, empty or numeric link, or metadata that is not an object, gives no link.
  - The read is still the one read.
- **`persisted-flow-run.test.ts`**, row "the run's start is the recording position of its first
  attempt on a recorded node, and is absent without an order or such an attempt".
  - Attempts are listed out of order; a control-node attempt and an unnamed attempt are passed
    over; a retry does not move the start.
  - Position 0 is a start, not an absence.
  - No node id appears in the outcome.
- **`run-flow-lane.test.ts`**
  - **The fake Core** now links `node.one` to `candidate.0`, and the graph's nodes after it, as
    approval does.
  - **Row "a Flow whose first attempt is not the recording's first action fails as a wrong start,
    by candidate position, after its evidence is published":**
    - **W15's shape:** the first attempt is on candidate 3 of 4 and fails;
    - **W28 run 2's shape:** the attempt succeeds and the run stops, and the start is still what
      is named;
    - **a normal start** publishes 0.
  - **Row "an action node linked to no candidate of the recording's proposal fails the run before
    it starts":** covers no link, and a link to another proposal's candidate. Nothing starts and
    no dispatch is reported.

### What the bench shows

**A wrong start (W15's shape, W28 run 2's shape):**

| Bench field | Value |
| --- | --- |
| Verdict | `failed` |
| `failureCategory` | `action.dispatch` |
| Cause | "The Flow started at recorded action N of M, not at the recording's first action" |
| `flowCreated` | `true` |
| `automationFailureReported` | whatever Core reported: for W15, its failed close's category; for W28 run 2, `ambiguous_or_unknown` |
| `snapshots/flow-lane.json` | `startCandidateIndex` N−1 |

**An action node with no candidate link:**
- **Category and cause:** `recording.contract`, with the message above. `runScenario` also
  publishes the details on the run's `error` event, because it does so for every
  `recording.contract` failure.
- **`flowCreated` is `false`, and nothing executed.** The lane throws before it publishes its
  observation. Refusing an undeclared secret or upload looks the same today.

**A run that starts at the recording's first action:**
- no verdict change;
- `startCandidateIndex: 0` on every Flow-lane row.

**An early stop:** reported as before, unless the run also started late. Then the wrong start is
named instead.

### Commands run and observed results

Each command's output went to a scratch file with its exit code, never through a pipe.

1. **Type check.** `pnpm check`, in `packages/test-runner`: exit 0.
2. **Structure audit.** `node scripts/structure-audit.mjs`: exit 0, "structure-audit: passed (41
   warning(s), 17 baselined)". Its one line on my files is advisory: `run-flow-lane.test.ts` "485
   lines is past the 400-line advisory threshold". That file was 426 lines before this brief and
   445 after task 2, and it is not baselined.
3. **First full run, which failed.** `pnpm exec tsc -p tsconfig.json --outDir dist-grsg`: exit 0.
   `node --test "dist-grsg/**/*.test.js"`: exit 1, "# tests 562 # pass 561 # fail 1".
   - The failure was "not ok 111 - a failed run whose every attempt succeeded, … recorded as a
     stop, by counts", with "recorded.scroll.two must not travel".
   - The cause was `firstActionNodeId`. I replaced it with the position design above.
4. **After the fix.** `pnpm check` exit 0; build exit 0; tests exit 0, "# tests 562 # pass 562 #
   fail 0". The new rows passed as `ok 91`, `112`, `131`, `154` and `155`. The audit gave exit 0
   and the same line.
5. **Hashes before mutating (SHA-256).**
   - `run-flow-lane.ts` `FE0F24B8…B57D`
   - `persisted-flow-run.ts` `CD3816E3…4F0A`
   - `flow-action-types.ts` `BD156C61…6C54`
   - `recording-flow-proposal.ts` `0421EAB9…F7B4`
6. **Mutations C and D.** C made the start check never fail. D sorted `candidateIds`, which
   brings back the id sort behind W15 and W28. They were applied together because they touch
   different files and break different test files. Rebuild exit 0; full tests exit 1, "# tests 562
   # pass 560 # fail 2".
   - **"not ok 131 - the proposal keeps its candidates' ids in Core's order, never sorted, …" (D):**
     the actual order was `'candidate.entry.13.b', 'candidate.entry.4.a', 'candidate.entry.8.c'`,
     where `entry.4`, `entry.13`, `entry.8` was expected.
   - **"not ok 154 - a Flow whose first attempt is not the recording's first action fails as a
     wrong start, …" (C):** "The "wrongStart" validation function is expected to return "true".
     Received false … RunnerFailure: The Flow reported an unexpected target_not_found failure".
     That is the misleading failure the start check replaces.
   - Both restored. All four hashes compared `identical=True`.
7. **Clean rebuild after the restores.** Build exit 0; tests exit 0, "# tests 562 # pass 562 #
   fail 0". `dist-grsg` was then deleted: `Test-Path` returned False.

No failure looked environmental, and nothing needed a rerun for the RAM fault. Each gate is a
single observation.

### Not verified

- **No Lab run.** A Lab run must show three things:
  - **Before Core's `g-core-start-node` fix is built:** W15 fails as `action.dispatch` "The Flow
    started at recorded action N of 5, not at the recording's first action". A W28 recording of 11
    or more entries names its start the same way.
  - **After that fix is built:** `startCandidateIndex: 0` on every Flow-lane row, and no
    `recording.contract` refusal for unlinked nodes.
- **That live `get-flow` nodes carry `metadata.recordingCandidateId`** is known from reading Core's
  code only. If they don't, every Flow-lane run fails as `recording.contract` before dispatch,
  which one run would show at once.
- **An explicit start node from `g-core-start-node`.** If it records an attempt, that attempt is
  passed over, because only nodes in the candidate order count. That was tested with a fake
  control-node attempt, not against Core.
- **The root gates** (`pnpm check`, `pnpm test`) were not run.

### Open questions or contradictions found

- **An unlinked action node shows as `flowCreated: false`,** although Core did approve a Flow. The
  refusal comes before the lane publishes its observation, as secret and upload refusals already
  do.
- **A candidate with no node is not refused before the run.** If it is candidate 1, the run shows a
  wrong start; otherwise nothing names it. `assertProposalCoversRecording` still guards the count.
