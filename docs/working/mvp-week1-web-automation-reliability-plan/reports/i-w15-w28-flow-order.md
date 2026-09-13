# i-w15-w28-flow-order — why W15's Flow starts with a tab close, and why W28's run 2 stopped after a scroll

Read-only investigation, 2026-09-13. Code read at this repository's `69f40c1` working tree and Core
`F:\!FluxIQ` at `6621d66` (the pin every bundle records). Bundles read:
`F:\fxlab-runs\stage2c\d4r\run-mtzye7ll-de4dba98`, `d\run-mtzxuy31-ba766e08`,
`d\run-mtzy9h6r-08713546`, `d\run-mtzy83q6-5a9b03ae`, plus screenshot names of
`d\run-mtzyaqil-a6e2979d`. No Lab command ran. Only ids, kinds, paths, orders and counts are
reported here; no recorded page data is quoted.

## Outcome

**Both failures have one cause, in Core: a Flow built from a recording starts at whichever
recorded node sorts first by node id, and node ids embed an unpadded timeline number.**

- **How a run picks its first node.** A run looks for a `builtin.control.start` node and
  otherwise takes `flow.nodes[0]`. The node list is read back from SQLite
  `order by node_id`.
- **What a recorded node id looks like.** It is `recorded.candidate.entry.<N>.<uuid>`, where
  `N` is the entry's timeline sequence, not zero-padded.
- **The result.** Text order puts `entry.10`–`entry.19` before `entry.2`–`entry.9`. Once a
  recording holds more than 10 entries, a later action can become the start node.
- **W15.** The Flow starts mid-chain at the tab close, which has no tab to act on because
  nothing before it ran.
- **W28 run 2.** 12 entries. The Flow starts at the chain's last node, a scroll that
  succeeds and has no outgoing edge. Core then fails the run because nodes remain unvisited,
  and no attempt failed, so there is no failure record.

The tab recorder, the bridge's storage order and the domain's mapping are not what puts the
close first. The proposal's candidate order is also correct: Core chains the nodes in
candidate order, and only the start-node choice is wrong. The mechanism is shown by code
read end to end and by two probes of the ordering rule (below). The recorded entries' actual
numbers are **not** in the bundles: no Core workspace was kept for W15 or W28. Where each
candidate sits is inferred from `entryCount`, and it is consistent with every Stage 2c
Flow-lane row read.

Where W28 run 2's second scroll came from is **not determinable from the bundle**. The
runner's start-page load and the user script are ruled out by code. That leaves a scroll
inside the frames. Details and the Lab evidence needed are below.

## What changed and why

Only this report was written. No code, test or shared document was edited.

### 1. W15 — `multi-tab`

**Recorded entries, as far as the bundles show them.** `flow-lane.json` carries counts only,
and no Core workspace was kept, so the stored entry list cannot be printed.

- **Counts.** `entryCount` is 25 in the six timed-out runs and 26 in the rerun
  `run-mtzye7ll-de4dba98`. `recordedActions` is `{"extension":5,"core":5}`.
  `recordedEvents` is `web.element.clicked` 2 and `web.tab.state_changed` 4. `candidateCount`
  is 5, and `proposalIssues` compacted 5 high-frequency state entries.
- **Expected order, from the recording script and the tab recorder.** The script's steps are
  `open-order-details` click, `switch-to-details` switchTab, `details-loaded`,
  `extract-order-details`, `close-details-tab` closeTab, `order-list-restored`, and
  `confirm-order-review` click (`multi-tab/manifest.ts:21-37`). They yield five recorded
  actions, in time order:
  1. `dom.click`, mapped to `web.dom.click`;
  2. `browser.tab {operation: "switch", urlPath}` (`tab-recorder.ts:85`);
  3. `browser.tab {operation: "close"}` with no tab id (`tab-recorder.ts:97`);
  4. `browser.tab {operation: "switch"}` back to the list page. The closed tab stays current,
     so the next page in front is recorded as a switch (`tab-recorder.ts:94-96`);
  5. `dom.click`.
- **The fourth tab event.** It is the recording-start marker, which has no `tab`
  (`input-model.ts:229-236`). 1 marker plus 3 tab operations makes the 4
  `web.tab.state_changed` events.
- **Stored kind and id.** Each executable event reaches Core as `client.recording_event` with
  an `inputId`. The bridge stores it through `recordGatewayInput`
  (`client-gateway/bridge.ts:415-425`), and `AutomationStudioIoRecorder.recordInput` appends
  an `action` entry with no explicit id (`runtime/io-bridge.ts:32-50`). So its id is
  `entry.<sequence>` (`model/recording-framework.ts:52-55`). The sequence is 0-based over the
  whole timeline, state entries included.

**The Flow's candidates, in order.** Core maps the timeline in stored order
(`runtime/service.ts:2401-2426`). For these `action` entries the domain mapper returns
`null` (`web-panel-host.ts:127-135`), so Core's fallback candidate (`service.ts:2411`,
`recordingActionEntryCandidate` at `service.ts:5726`) stands. `appendRecordingProposalToFlow`
builds a node for each candidate in that order and joins them with `success` edges
(`recordings/proposal-candidates.ts:90-132`). The chain is therefore click → switch → close →
switch → click. The only run evidence of order is that the first attempt, in 7 of 7 runs, was
`web.browser.tab`, and every `flow-lane.json` lists exactly one attempt.

**What puts the close first: none of the four named places.** It is Core's choice of start
node over a node list sorted by id.
1. **Node ids.** `candidateId` is `candidate.${safeSegment(actionEntryId)}.${randomUUID()}`,
   and the node id is `recorded.${safeSegment(candidateId)}`
   (`proposal-candidates.ts:68, 93`). That gives `recorded.candidate.entry.<N>.<uuid>`.
2. **The graph index.** On approval, `saveFlow` then `replaceFlowGraphIndex`
   (`service.ts:2517-2519`) imports the Flow into the SQLite graph index
   (`flows/store.ts:193-200`).
3. **The read.** `getFlow` → `materializeCanonicalGraphFlow` (`flows/store.ts:75-80, 249-258`)
   rebuilds `nodes` from `exportSnapshotData`, which runs
   `select * from graph_nodes where flow_id = ? and deleted_at_ms is null order by node_id`
   (`storage/project/graph-store.ts:189`). `graph_nodes.node_id` is `text primary key` with no
   collation (`schema/domain-resources.ts:103-104`), so the order is binary.
4. **The start node.** `runRuntimeSession` → `runCanonicalAutomationStudioFlow`
   (`service.ts:3571`) → `runAutomationStudioGraph` with no `startNodeId`
   (`runtime/composite-executor.ts:38`) → `findStartNode`, which returns
   `builtin.control.start` or else `flow.nodes[0]` (`runtime/executor/graph-navigation.ts:13-15`).
   A recording-derived Flow has no start node.
5. **Why the close.** With 25–26 entries, the close and the actions after it sit at two-digit
   entry numbers, and the first click and first switch at single-digit ones. The close is then
   the smallest id and starts the run. This matches the probe's `w15-like` case. The exact
   numbers are not recoverable from the bundle.

**Why the close has no tab to act on.**
- **What a recorded close carries.** No tab: `domain/src/output-nodes/payloads.ts:129`
  builds `{ tab: { operation: "close" } }`, by design (`tab-recorder.ts:94-96`).
- **What replay needs instead.** `closeTab` uses `request.tabId ?? currentAutomationTabId()`
  (`apps/extension/src/runtime/browser-tab.ts:223-233`). The automation tab is set only by an
  action FluxIQ runs (`runtime/automation-tab.ts:41-55`, `browser-tab.ts:210-212`,
  `runtime/action-runner.ts:60-73`).
- **Why there was none.** The Flow lane opens the start page through Playwright
  (`run-scenario.ts:338-345`, `openScenarioStart`), not through FluxIQ, and here the close was
  the first node. `automationTabs` was therefore empty, and the extension answered
  `web.action.rejected`, "no tab named and none open". That was observed once, in the rerun.
  In the other 6 runs Core's dispatch deadline expired first; `g-core-dispatch-deadline` owns
  that.
- **In the chain's own order.** The preceding switch sets the automation tab
  (`browser-tab.ts:208-212`), and the close then closes the details tab and fronts the tab
  driven before it (`browser-tab.ts:247-250`).

**What a close should do when the recording's tab is already the only one.** It should
refuse, and never close the window the Flow runs in.
- **Which tab it resolves.** A named tab, else the automation tab, else the active tab of the
  last-focused normal window, only when that is a page FluxIQ can drive
  (`unsupportedAutomationPageReason`).
- **When it refuses.** If the resolved tab is the only tab in its window, fail with
  `ACTION_REJECTED`, expected "another open tab to return to", actual "the tab to close is the
  only tab open".
- **Why.** Closing the last tab closes the window and ends the session, and a person who
  recorded a close always landed on another tab (`browser-tab.ts:10-11`).
- **Unchanged.** The existing rejection stays when nothing resolves.

### 2. W28 — `iframe-checkout`, run 2 (`run-mtzy9h6r-08713546`)

**Where the second scroll came from.** Not determinable from the bundle. What the bundle and
the code do establish:
- **Counts.** Run 2: `entryCount` 12, `recordedActions` 4/4, `web.scroll.changed` 2,
  `candidateCount` 4. Run 1 (`run-mtzy83q6-5a9b03ae`): 10 entries, 3 candidates, 1 scroll.
  Run 3: 9 entries, 3 candidates, 1 scroll (`l-stage2c.md:677-681`).
- **Screenshots.** Run 2's are byte-identical by name hash to runs 1 and 3 before click 1
  (`00002-3a742965b93a`), after click 1 (`00003-ef841f737076`) and after click 2
  (`00005-b975f43dfa4f`). The extra scroll left no visible difference at any step boundary.
- **Not the runner's start-page load, for the recording.** The page is opened at
  `run-scenario.ts:207`, before `fluxiq.startRecording` at `:281`. The content recorder drops
  every event while `recording` is false (`content/recorder.ts:52-54`). The Flow lane's reload
  (`run-scenario.ts:345`) runs after Stop. Core discarded exactly 1 late action for this
  recording in the window up to Flow dispatch (`events.ndjson` seq 12,
  `recording.action_discarded.thisRunsRecording: 1`). That action is not in the recording.
- **Not the user script.** Its steps are two frame clicks and a checkpoint
  (`iframe-checkout/scenario.ts:16-20`).
- **So a scroll inside the page's frames.** The content script runs in every frame
  (`manifest.e2e.json:39,51`, `all_frames`). Its `window` `scroll` listener
  (`content/dom-events.ts:161-167`):
  - is a capture listener, so it also fires for element scrolls inside that document;
  - has no `isTrusted` check;
  - debounces per document at 400 ms;
  - records only `window.scrollX/Y`.

  A frame scrolled by Playwright's click actionability (scroll into view), or an inner element
  scroll, is recorded as a page scroll. Which frame, and at what position, needs the stored
  entries.

**Why the Flow stopped after a scroll that succeeded, with no failure record.** The same
start-node defect.
- **The start.** With 12 entries (`entry.0`–`entry.11`), the chain's last candidate, a scroll,
  sits at `entry.10` or `entry.11`, and its id sorts first. The run starts there.
- **The stop.** The scroll attempt `succeeded`. Its node has no outgoing edge, and 3 nodes are
  unvisited, so `executeAutomationStudioGraph` returns `failed` with the message "completed
  without an outgoing edge before the Flow visited every node"
  (`runtime/executor/graph-run.ts:231-252`). No attempt failed.
- **Why there is no failure record.** The runner's `failure` is taken only from attempts
  (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:146`), so it is `null`.
- **Why `harnessActivations=1`.** A failed session goes to the LLM gate
  (`service.ts:3584`, `maybeAnnotateRunDetailWithRuntimeLlm`), which adds one provider
  intervention with no failed attempt (`service.ts:2891-2925`). W15's 2 is that one plus the
  recovery-ladder diagnosis converted from its one failed attempt
  (`service/summaries/conversions.ts:203-223`, `graph-run.ts:204-223`,
  `executor/recovery-ladder.ts:54-61`).
- **The runner's category.** It came out `ambiguous_or_unknown`, and the error
  "did not produce a web.dom.click action" (`flow-lane/expectations.ts:15-28`) follows.

**Consistency with every Flow-lane row in `l-stage2c.md`.** All are consistent with the rule;
none contradicts it.

| Row | `entryCount` | Flow started at candidate 1 |
| --- | --- | --- |
| W17 | 10 | yes, 3 of 3 |
| W25 unarmed and `too-slow` | 8 | yes, 6 of 6 |
| W28 runs 1 and 3 | 10, 9 | yes |
| W18 | 24 | yes, 3 of 3 |
| W19 `expired` | not listed | yes, 3 of 3 |
| W15 | 25–26 | no, 7 of 7 |
| W28 run 2 | 12 | no |

For W18, 24 entries with the chain intact is consistent only if its three candidates share a
digit count, which is possible. It was not verified.

### 3. Fix design, partitioned by file

**Fix 1: start a Flow at its root, not at the first id (Core; the root cause).** The
supervisor alerts the user before a Core edit.
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/graph-navigation.ts`,
  `findStartNode`:
  - keep `builtin.control.start` first;
  - otherwise take the node no edge targets. If several, take the lowest `position.x`, then
    `position.y`, then array order. Recorded nodes get `x = 120 + index * 340`
    (`proposal-candidates.ts:108`).
  - Never array order alone.
- `packages/fluxiq/src/programs/automation-studio/runtime/compiled-plan.ts:100`:
  - `startNodeId` uses the same rule. Share `findStartNode` rather than restating it.
  - Compatibility note: this changes `startNodeId` and `planDigest` for recompiled plans of
    Flows without a start node.
- Tests:
  - `runtime/executor/tests/` gets a 4-node chain whose ids are `entry.9` before `entry.10`
    in chain order. The run must start at the root.
  - A service-level row approves a proposal whose candidates cross `entry.9`/`entry.10`, reads
    it back through `getFlow`, and runs it. The first attempt must be candidate 1.
  - Mutation proof: revert to `flow.nodes[0]` and the row fails.
- Not recommended instead:
  - zero-padding entry ids (`model/recording-framework.ts`), which changes stored ids for
    existing recordings;
  - reordering `exportSnapshotData` (`graph-store.ts:189`), which many readers share.

**Fix 2: the Flow lane fails a run that did not start at candidate 1, and names a stop with
no failed attempt (test-runner).**
- `packages/test-runner/src/flow-lane/run-flow-lane.ts`:
  - `readFlowNodes` is already read (`:114`). Map each node's `metadata.recordingCandidateId`
    to its index in the approved proposal's candidates.
  - After the run, fail with `RunnerFailure("action.dispatch", …)` when the first attempt's
    `nodeId` is not candidate 1's node.
  - Publish `startCandidateIndex` in `flow-lane.json`.
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`:
  - record `stoppedWithoutFailedAttempt` (status `failed`, no failed attempt);
  - record `runDetail.metadata.currentNodeId` as a candidate index, never the message text.
- Tests in `packages/test-runner/src/flow-lane/tests/`, with a mutation proof.

**Fix 3: a close with no driven tab, and never the last tab (extension).**
- `apps/extension/src/runtime/browser-tab.ts`, `closeTab`: resolve the tab and refuse the last
  one, as described in section 1.
- Tests in `apps/extension/src/runtime/tests/browser-tab.test.ts`: no automation tab with two
  tabs, which closes the active tab; the only tab, which is refused; and neither, which keeps
  the existing rejection. Include a mutation proof.

**Fix 4: record a page scroll only when the page moved (extension). Conditional:** dispatch
it only after the Lab shows the extra scroll's frame and position.
- `apps/extension/src/content/dom-events.ts:161-167`: emit `dom.scroll` only when the event
  target is the document (`event.target === document`), and only when `window.scrollX/Y`
  differ from the last position this document recorded.
- Tests: a content-harness spec for a zero-move scroll and for an inner element scroll.

`g-core-dispatch-deadline` (in flight) covers W15's 6-of-7 timeout. None of the fixes above
touches it.

### 4. Week1 rows each fix changes

- **Fix 1.**
  - **Changes W15 unarmed and `popup-blocked`.** The start moves from the close to the first
    click. Unarmed then runs click → switch → close → switch → click. `popup-blocked` meets the
    blocked click first, which is where its expected `output_not_observed` belongs.
  - **Changes W28**, in any run whose recording reaches 11 or more entries, which is run 2's
    shape.
  - **Changes any other Flow-lane row** whose recording puts a later candidate at a two-digit
    entry number and an earlier one at a single-digit number, or crosses 99/100.
  - **Measured and unchanged at this pin:** W17, W18, W19 `expired`, W25 unarmed and
    `too-slow`, W28 runs 1 and 3. Their start was already candidate 1.
  - **Not measured in anything read here:** W01–W14, W16, W20–W24, W26, W27, W29. Fix 2's
    `startCandidateIndex` would show them in one bench run.
- **Fix 2.** No verdict changes for runs that start at candidate 1. It turns W15's and W28 run
  2's shape into an explicit `action.dispatch` failure, and adds the field to every Flow-lane
  row. Bench rows affected: all 44 Flow-lane results.
- **Fix 3.** W15 only: `multi-tab` is the only scenario with `closeTab`, checked by grep over
  `apps/scenario-lab/src/scenarios`. With Fix 1 in place its verdicts should not change,
  because the switch before the close sets the automation tab. It hardens the no-driven-tab and
  last-tab cases.
- **Fix 4.** W28, plus W11 `infinite-feed`, the only week1 row whose script scrolls
  (`infinite-feed/scenario.ts:36-40`). It could also change any row where Playwright's
  actionability scrolls a frame or an element. Those cannot be listed without stored entries.

## Commands run and observed results

**Probe 1: JavaScript `localeCompare` over the real id shape.** It builds
`recorded.` + `safeSegment("candidate." + safeSegment("entry.N") + "." + uuid)` and sorts the
way `compiled-plan.ts:86` does:

```
all<10  chain: click@3 -> click@5 -> scroll@8 | sorted: click@3, click@5, scroll@8 | start: click@3
one>=10 chain: click@3 -> click@5 -> scroll@8 -> scroll@10 | sorted: scroll@10, click@3, click@5, scroll@8 | start: scroll@10
w15-like chain: click@4 -> switch@8 -> close@13 -> switch@14 -> click@19 | sorted: close@13, switch@14, click@19, click@4, switch@8 | start: close@13
entry.10 vs entry.9: -1
```

The entry numbers in the probe are illustrative, not read from the runs.

**Probe 2: SQLite, the order the run actually uses.** Run with
`node --experimental-sqlite` (Node `v22.11.0`), on an in-memory
`graph_nodes (node_id text primary key, …)` and the exact query at `graph-store.ts:189`:

```
sqlite order: scroll@10, click@3, click@5, scroll@8
```

**Bundle reads.** `flow-lane.json`, `run.json`, `events.ndjson`, `evaluation.json` and
`logs/core.log` of the W15 rerun and the W28 failed run; `flow-lane.json` and `run.json` of
W28 run 1; `flow-lane.json` of W15 run 1; `review/timeline.json` of the W15 rerun; and
`ls` of W28 runs 1 and 3's `screenshots`. Their results are quoted in sections 1 and 2.

No unit tests, content harness, build or Lab command were run. The brief asked for unit probes
only, and the two above are the probes.

## Not verified

- **The real entry numbers** of W15's five and W28 run 2's four candidates. Neither run kept
  Core's workspace. A Lab run with the workspace kept must show:
  - each candidate's `actionEntryId`;
  - the Flow node order that `getFlow` returns;
  - that the first attempt's `nodeId` is the smallest node id.
- **Core's `terminalFailureReason` and `currentNodeId`** for W28 run 2. The bundle does not
  save the run detail. The expected message is the `graph-run.ts:251` "completed without an
  outgoing edge before the Flow visited every node".
- **Where the extra W28 scroll came from.** The Lab must keep the workspace for
  `iframe-checkout` and read both scroll entries': `frameId`, `scroll` x/y, timeline sequence,
  and timestamps relative to the two clicks.
- **Fixes 1–4** are designs only, with no code, tests or mutation proofs. Whether W15 unarmed
  passes once it starts at the first click, and whether `popup-blocked` reports
  `output_not_observed`, needs the Lab.
- **Whether any other week1 row is currently mis-started.** The Stage 2 bench bundles were
  not read.
- **A single-observation caveat.** W28 run 2 happened once. The W15 order is 7 of 7.

## Open questions or contradictions found

- **Does the rule explain other Stage 2 bench failures?** It could explain Flow-lane failures
  in rows with longer recordings, among the 30 of 67 that `i-bench-triage` classified. That
  report was not read here. If its triage attributed a failure to a target or a timing,
  Fix 2's `startCandidateIndex` would confirm or rule this out.
- **`findStartNode` is shared.** Any hand-built or imported Flow without a
  `builtin.control.start` node starts at its smallest node id once it passes through the
  graph index, not only recording-derived Flows. That is the compatibility surface of Fix 1.
- **The runner's category.** It reports `ambiguous_or_unknown` for a Core run that failed
  structurally, from a graph with no path. Whether that should map to a closed runner category
  rather than a failure taxonomy category is the supervisor's decision.
- **A close with no tab.** Its recorded payload carries no tab id, by design
  (`tab-recorder.ts:94-96`), so it depends on the automation tab being set by an earlier node.
  After a service-worker restart mid-Flow, the in-memory `automationTabs` (`automation-tab.ts:16`)
  is empty even in the right order. Fix 3 covers that; nothing measured it.
