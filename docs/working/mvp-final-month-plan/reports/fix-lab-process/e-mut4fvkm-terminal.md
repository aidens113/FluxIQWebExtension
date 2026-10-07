# t289-E (W22): why run-mut4fvkm-e2fc03e6 ended `failed`

Worker report. Read-only investigation; no source edited, no command beyond read-only git and file reads.

## Outcome

Done. The cause is established. The healed coupon press did not end the run, and neither did a recovery decision. Core's graph runner ended it as `failed` after the last node, s14, succeeded, because two nodes had no attempt: s7 and s8. A forward state route had legitimately jumped over them. The termination rule counts every node with no attempt as "unvisited", whatever the reason. That rule is unchanged on Core `dev` (b181f4bc), so the same sequence still ends `failed` today. No commit has fixed it: 42434f42 and 71cb8bfb do not touch it.

## Established cause, with evidence

### 1. The graph that ran (14 nodes, no End node)

From the build judge request, `lab-runs/2026-10-03/run-mut4fvkm-e2fc03e6/steps/0086-judge/request.txt`, `resultSummary.flowShape` at lines 118-268:
- s1-s14. s3 and s8 are `builtin.control.merge` (`mergeMode: first`). The other 12 are actions.
- s7 is a sometimes-present consent-banner dismissal, the optional shape that the build joins at the merge s8. s2 → s3 has the same shape, for the first popup.
- No node is `builtin.control.end`. s14 (add to cart) is the last node.

### 2. What playback did

From `steps/index.md` rows 0088-0099 and `steps/0092-run-web.dom.click/meta.json`:
- s6's target was not found. Core state-routed it: `skipped.reason: state_routed`, `toNodeId: …main.s9`, `direction: forward`, `stateRouting.outcome: routed`. The run went straight from s6 to s9, so **s7 and s8 never got an attempt**.
- s13 was state-routed forward to s14, which is adjacent, so nothing was bypassed there.
- `snapshots/flow-lane.json.actions` holds all 13 attempts, including the control attempt on merge s3 (`builtin.control.merge`, 0 ms). The 0 ms "s3 success" in the debug is therefore just the merge node passing through, not an action. It has no attempt on s7 or s8.
- The last attempt is s14, `succeeded`.

### 3. Where Core turns that into `failed`

At Core 9f756676, `packages/fluxiq/src/programs/automation-studio/runtime/executor/graph-run.ts`:
- **:545-563**: a step that could not run asks state routing. `routing.kind === "routed"` sets `currentNode = routing.node` (s9) and continues. Nothing marks the nodes it jumped over.
- **:679**: after s14, `chooseAutomationStudioEdge(...)` returns null because s14 has no outgoing edge.
- **:692**: `if (currentNode.definitionId === "builtin.control.end" || !outgoingRoutes.length && !hasUnvisitedAutomationStudioNodes(flow, attempts))` → succeeded. s14 is not an End node, and the next check finds s7 and s8 unvisited, so the run falls through to…
- **:694-707**: `status: "failed"`, `currentNodeId: s14`, message template `Node <id> completed without an outgoing edge before the Flow visited every node. …`.

`executor/graph-navigation.ts:13-16`: `hasUnvisitedAutomationStudioNodes` counts a node as visited only if some attempt names it. A node that a state route deliberately passed over counts as unvisited.

`runtime/service.ts:2710-2714`: the canonical run's `trace.status` becomes the session status with nothing in between. `composite-executor.ts:38` passes the subflow graph's trace straight through. No later step rewrites the status from the attempts.

### 4. Why each alternative in the brief is ruled out

- **The failed attempt counted despite the healed retry?** No. When the ladder chooses retry (`graph-run.ts` :597-614), the run continues and s12 attempt 2 succeeds. Every `failed` return before :679 requires the current attempt to fail or the run to be cancelled, parked or stopped. The last attempt (s14) succeeded, so only the post-loop branch at :692-707 can produce `failed` (or `missingTargetTrace`, which needs an outgoing edge, and s14 has none). The healed attempt does matter elsewhere, but not for status (C5): at 9f756676, `service.ts:2710` and `recovery/annotation/annotate.ts` took the *last failed* attempt, the healed s12, as the recovery cause. That produced `harnessRecovery.refusalCode: llm.gate.known_recovery` and the Lab's `recoveredFailures` entry. 42434f42 replaced both selections with `automationStudioUnresolvedFailedAttempt` (dev `service.ts:2708`). It changes recovery labelling, not the terminal status.
- **The authored s7 vs playback s3 mismatch?** This is not an identity mismatch. The creation snapshot's `authoredNodes` list (`packages/test-runner/src/flow-lane/creation/authored-nodes.ts`) holds only the 12 action nodes, so it lists s7 but not the merges s3 and s8. The playback list includes the s3 merge attempt but has no attempt on s7, because s7 was routed over. Both are the same 14-node revision. The judge's `flowShape` lists s1-s14 matching both.
- **A control node with no successor?** Not as such. The node with no successor is s14, the last action. Ending there is correct, but the rule at :692 also requires every node to have an attempt, and the state route made that impossible.

### 5. Why the Lab reported `flow_lane.every_failure_recovered` with `failure: null`

At 326ad350, `packages/test-runner/src/flow-lane/persisted-flow-run.ts:587` (`stopWithoutFailedAttempt`) already recognises this exact shape (W28: failed with no failed attempt, action nodes unvisited). It gave up because it required `actions.every(status === "succeeded" || "skipped")`, and the healed s12 attempt 1 is `failed`. So `stoppedWithoutFailedAttempt` came back null. The run was then classified only as "status failed, every failure recovered". **Already fixed on downstream dev by 14cd066b** ("Retain screened terminal evidence…", not in 326ad350). `flow-lane/terminal/stopped-without-failed-attempt.ts:17` now uses `recoveredByNode(actions).every(...)`, so this run would report `stoppedWithoutFailedAttempt { attemptedActions: 11, unvisitedActions: 1 }`.

## Does current Core dev still compute `failed`?

Yes. `git diff --stat 9f756676 dev` over `executor/graph-navigation.ts`, `executor/graph-run.ts`, `executor/step-skip/` and `executor/state-routing/` shows only `state-routing/announcement.ts` (+ its test) changed. On dev, `graph-run.ts:692` and `graph-navigation.ts:13-16` are byte-identical in logic. 71cb8bfb (absent optional skipped) is already an ancestor of 9f756676, and it is the declared-skip path, not this one. 42434f42 is recovery-cause selection only. **No commit fixed it.**

## Smallest fix, and who owns it

**Core, `executor/**`, owned by t283.** A node that a forward state route passed over should count as visited for the termination check, so a run whose last node succeeds is not failed for steps the page made unnecessary. The smallest change:
- `runtime/executor/graph-navigation.ts`: `hasUnvisitedAutomationStudioNodes` also treats as visited every node that a forward `state_routed` attempt bypassed. A node counts as bypassed when it lies on an edge path from the routed attempt's node to its `skipped.toNodeId`, excluding those two. Both are already on the attempt. The simpler variant is to count only nodes reachable from the routed node and able to reach `toNodeId`.
- Regression test in `runtime/executor/tests/` (state-routing or graph-run tests). Optional step A, then sometimes-present B joined at merge M, then C, with C last and no End node. A is state-routed forward to C. Expect `succeeded`. Keep the W28 case failing: unvisited nodes *upstream* of the start, with no state route, must still give `failed`.
- The rule at :692 should stay for genuinely disconnected or unreached nodes. Do not replace it with "last node succeeded ⇒ succeeded".

An alternative with a larger blast radius, not recommended: have the build always end Flows with `builtin.control.end` (Core `flow-draft/**`, also t283). That avoids the check, but it hides the executor rule's defect for hand-edited Flows.

**Downstream (`packages/test-runner/**`, t289):** nothing further is needed for this cause. 14cd066b already fixed `stopWithoutFailedAttempt` and added the terminal reason projection (`flow-lane/terminal/evidence.ts`, which maps this exact message to `graph.unvisited_nodes`).

## What the Lab failed to keep (C7), and its status on dev

| Missing at 326ad350 | Needed for | Status on downstream dev |
| --- | --- | --- |
| Core terminal `metadata.terminalFailureReason` / `currentNodeId` | naming the terminal branch directly | Kept by 14cd066b: `flow-lane/terminal/evidence.ts` (category only, `graph.unvisited_nodes`, no message text) |
| `skipped`/`stateRouting` marks in `snapshots/flow-lane.json.actions` (they reached only `steps/*/meta.json` and `steps/index.md`) | seeing the bypass from the snapshot alone | Not checked whether dev's snapshot now carries `skipped`. `flowAction` at 326ad350 `persisted-flow-run.ts:686-693` does emit it, but the snapshot here has no `skipped` key on s6/s13 (`onSkipRoute` fallback only). The meta.json copies were enough this time. |
| Authored control nodes and edges (s3/s8 merges, s6→s7→s8→s9 edges) in the creation snapshot | proving the exact bypassed path | Still absent: `creation/authored-nodes.ts` keeps action nodes only. Recoverable this time from the judge request's `flowShape` (nodes only, no edges). Smallest keep: add control node ids/definitionIds and an edge list (`sourceNodeId`, `sourcePortId`, `targetNodeId`, all opaque ids) to `packages/test-runner/src/flow-lane/creation/authored-nodes.ts` / `creation/snapshot.ts` (t289). |

The edges were not needed to settle this cause. The routed jump s6 → s9, the missing attempts on s7 and s8, and the code path together are sufficient.

## Commands run and observed results

- Located run folders: `fxwork/t262/!FluxIQWebExtension/test-runs/instances/t262-slot-2/run-mut4fvkm-e2fc03e6` and `lab-runs/2026-10-03/run-mut4fvkm-e2fc03e6`. Their `snapshots/flow-lane.json` are byte-identical (`cmp`).
- Node scripts over `flow-lane.json` printed field structure only: `status: failed`, `failure: null`, `runtimeRunId`, 13 actions, 12 authoredNodes (s1, s2, s4-s7, s9-s14).
- `grep` of `logs/core.log`: it has build-trace only, with no runtime terminal message.
- `git show 9f756676:<path>` for `executor/graph-run.ts`, `graph-navigation.ts`, `step-skip/absent-step.ts`, `state-routing/decision.ts`, `composite-executor.ts`, `service.ts`. Line numbers above are from those blobs.
- `git merge-base --is-ancestor`: 71cb8bfb is in 9f756676; 42434f42 is not in 9f756676 but is in dev; 14cd066b is not in 326ad350.
- `git diff --stat 9f756676 dev -- executor/{graph-navigation,graph-run}.ts executor/state-routing executor/step-skip`: only `state-routing/announcement.ts` and its test changed.
- `git show dev:.../graph-run.ts | grep`: the rule is still at :692 and the message at :706.

## Not verified

- The Core terminal message for this run was not retained, so the exact string at `graph-run.ts:706` is inferred from the code path, not observed. The only other reachable post-s14 branch (`missingTargetTrace`) needs an outgoing edge from s14, and none exists in the `flowShape`. The unvisited branch is the only fit.
- The actual edge list was not observed. It is inferred that s6's success edge leads to s7, and that s7 → s8 → s9 follow the draft-routing optional shape described in `step-skip/absent-step.ts`. The bypass itself is observed.
- No focused Core test was run to reproduce the bug: build and test commands were forbidden by the brief.
- Whether dev's flow-lane snapshot now keeps the `skipped` mark on actions.

## Open questions or contradictions found

- The debug's C6 frames this as an "authored s7 vs playback s3 mismatch". That framing is wrong. The two lists differ because the creation snapshot omits control nodes and playback state-routed past s7. The revision is the same.
- The UI showed the cart step as "Didn't work" with Run failed. That follows from `currentNodeId: s14` on the failed trace, not from any failure at s14.
