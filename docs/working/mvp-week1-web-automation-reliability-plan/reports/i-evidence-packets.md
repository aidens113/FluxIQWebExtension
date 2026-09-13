# i-evidence-packets — why no Flow-lane attempt carries a measured evidence packet

Worker `i-evidence-packets`, read-only, 2026-09-13, tree at `d639415` plus in-flight edits.
Core read at `F:\!FluxIQ` working tree (the Lab pin is `3cb8976`; no file cited below is
touched after it as far as this read shows, but I did not diff the pin).

## Outcome

Done. The chain breaks in the domain, on every Flow-lane attempt, before any snapshot is
requested. The domain's host runtime only snapshots nodes whose `definitionId` is a
`web.output.*` node id. A Flow built from a recording never contains one: Core makes every
recorded action a `builtin.policy.action` node. So `captureStateSnapshot` throws "does not
act on a page". Core swallows the throw and the attempt gets no `stateRefs` at all.

A second, Core-side gap sits behind it. Core hands the after-action capture a stub node with
`parameterValues: {}`. So even a corrected domain rule cannot tell a web policy action from
any other at `after_action`.

## What changed and why

Nothing tracked. Scratch scripts only (`iep-keys.mjs`, `iep-scan.mjs`, `iep-struct.mjs` in
the session scratchpad). They print key names, ids and counts. The SQLite files were copied
into the scratchpad and opened there; the copies were deleted at the end (confirmed by listing).

## 1. Which attempts carry `metadata.stateRefs`

None, on any evidence read.

- **`flow-lane.json`, all 48 stage2d bundles (`a`, `b`, `c`, `d`):** 31 have the file, with
  86 action attempts in total (11 failed).
  - 0 attempts have `evidencePackets`.
  - 66 have `targetResolution`, so the runner reads the run detail's `metadata` correctly.
  - Every `evaluation.json` has an `evidence` object with `sanitizedPacketBytes`,
    `rawSnapshotBytes` and `truncationCount`.
- **Kept Core workspaces:** 7 runs under `F:\fxlab-runs\stage2d\kept\`, 6 matching bundles in
  `a` and 1 in `c`. A raw byte scan of every file in `fluxiq-root` and `versions`, SQLite and
  WAL included, found:
  - `stateRefs`, `beforeAction`, `afterAction`, `stateDiff` and `web-state-diff.v1`: 0 in
    every run;
  - `web-automation-host-runtime`, the `source` the domain stamps on a snapshot dispatch: 0
    in every run;
  - `web.output.`: 0 in every run;
  - `hostCapabilities`: present in every run, 1 to 9 per run;
  - `builtin.policy.action`: present in every run, 24 to 55 per run.
- **Structured SQLite read:**
  - `project.sqlite` `runtime_action_summaries`, the 5 copies that opened (10 rows): every
    row's `definition_id` is `builtin.policy.action`.
  - Metadata keys are `diffSummary`, `hostCapabilities` and `targetResolution`, plus
    `recoverySelected` and `adaptiveFailure` on the failed run. `stateRefs` appears 0 times.
  - `capabilityIds` are `expectation-evaluation`, `state-diff` and `state-snapshot`, so the
    domain boundary *was* bound in the Lab Core.
  - 2 `project.sqlite` and 4 `global.sqlite` copies are "malformed": the keeper swept them
    while Core deleted them (`pathsNotPresentAtFinalSweep` lists their `-wal` and `-shm`).
    The byte scan covers those files.
- **Command attempts in the kept workspaces:** 15, one per recorded action dispatch. Their
  `command.outputId` values are only `web.dom.click`, `web.dom.scroll` and `web.dom.upload`.
  None is `web.dom.capture_snapshot`, so no snapshot was ever dispatched.
- **`core.log` of the 7 matching bundles:** `capture_snapshot`, `stateRefs` and
  `does not act on a page` each occur 0 times. Core catches the throw silently, so a count of
  0 was expected.

## 2. Where the chain breaks

| Candidate | Verdict | Citation |
| --- | --- | --- |
| The domain never produces the summary on these runs | **Yes, root cause** | See the steps below the table |
| Core stores a reference without the summary | No | There is no reference at all. When one exists, Core copies the whole `stateRefs`, summary included, into run-detail `metadata` (`conversions.ts:168`) and stores the record as the event payload (`runtime-stream-store.ts:461`) |
| Core withholds it | No | Withholding keeps every key (`trace-withholding.ts:36-46`). Booleans are never withheld (`:149-155`), so `truncated` would survive. `stateRefs` and `summary` are not `TRACE_DATA_KEYS` (`:64`), so summary strings pass through unrewritten (`:172-173`) |
| The runner's point names differ | No | Runner points are `beforeAction` and `afterAction` (`persisted-flow-run.ts:58`, read at `:277-283`). Core writes the same keys (`host-state.ts:45-48`) |
| Produced only on some paths | Partly, but not into `stateRefs` | The domain builds a `web-llm-evidence.v1` packet live only in failure diagnostics (`domain/src/runtime/adapter.ts:346,362`), which lands in the command attempt: 1 occurrence, in the failed short-catalog run `run-mu02vd6b-046b01e6`. It also builds one in the LLM tools (`llm-evidence/tools.ts:198,234`). Neither path writes an attempt's `stateRefs` |

How the domain breaks the chain, step by step:
1. Core turns each approved candidate into a node with
   `definitionId: "builtin.policy.action"` and puts the web output id in
   `parameterValues.outputId` (Core `runtime/service/recordings/proposal-candidates.ts:99,103`).
2. Core calls the before-action capture with that node, parameters resolved
   (Core `runtime/executor/node-execution.ts:54`).
3. The domain's accepted set is `WEB_AUTOMATION_ACTION_TYPES` mapped to `web.output.<name>`
   ids (`domain/src/runtime/host-runtime.ts:65`, `domain/src/output-nodes/definitions.ts:42-43`).
4. Any other `definitionId` throws before dispatch (`host-runtime.ts:76-78`).
5. Core catches the throw and returns `undefined` (Core `runtime/executor/host-state.ts:12-16`).
6. With no before or after reference and no diff, the attempt gets no `stateRefs` key
   (`host-state.ts:44-50`).

History: Core has made recorded nodes `builtin.policy.action` since `9f6d8ca` (2026-08-07).
The domain's host runtime and its filter arrived in `ee25ac9` (2026-09-12). The filter has
never matched a recorded Flow.

The Core gap behind it: `enrichAttemptWithHostState` builds
`{ id, definitionId, parameterValues: {} }` for the `after_action` capture and for
`inspectStateDiff` (`host-state.ts:25-26,31-36`). Its callers do have the execution node:
`finishAttempt(node, ...)` at `node-execution.ts:130-138`, and `node` or `executionNode` in
the failure branches at `:56,78,112`. A domain rule keyed on `parameterValues.outputId` would
therefore snapshot before the action and decline after it.

## 3. Were the earlier entries proven on real Lab packets?

No. All four were proven on fixtures only, and each entry says so.

- **`g-flow-lane-followups`:** "Not verified: Core serving `stateRefs` summaries in a live run
  detail, which is read from source only; a Lab `flow-lane.json` showing `evidencePackets`"
  (archive lines 722-724).
- **`g-bench-evidence-size`:** validated by a diff read and `node --test` (496 pass). No Lab
  evidence (archive 979-983).
- **`g-single-run-evidence`:** "Not verified: a Lab run whose `evaluation.json` sizes equal its
  `flow-lane.json` packets and its bench row" (archive 1211-1212).
- **`g-evidence-reader-merge`:** "Not verified: a real bundle read by either producer"
  (archive 1338).
- **The runner tests build `metadata.stateRefs` by hand:** `persisted-flow-run.test.ts:165-194`
  and `run-flow-lane.test.ts:366-367`.
- **The domain's own host-runtime tests use a node shape no recorded Flow has:**
  `CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click")`, i.e. `web.output.dom-click`
  (`host-runtime.test.ts:16,41-43`). No row uses `builtin.policy.action`.
- **Core's `service.test.ts:1048` asserts `stateRefs`** with a test host runtime that does not
  filter nodes, so nothing caught the mismatch between the two.

## 4. Smallest fix

**Part 1: domain (owner: a domain worker).** Owns `domain/src/runtime/host-runtime.ts` and
`domain/src/runtime/tests/host-runtime.test.ts`.
- **Rule:** a node is a web node when its `definitionId` is in `WEB_AUTOMATION_NODE_IDS`, *or*
  it is `builtin.policy.action` and `parameterValues.outputId` is a string in
  `WEB_AUTOMATION_ACTION_TYPES`.
- **Effect:** this alone gives a `beforeAction` packet on every web attempt of a recorded
  Flow, at the current Core pin `3cb8976`.
- **Diff guard:** `inspectStateDiff` should throw (Core then records no diff,
  `host-state.ts:37-39`) when either side is missing. Otherwise the before-only case writes a
  `web-state-diff.v1` claiming every element was removed (`host-runtime.ts:125-145`).
- **Tests:**
  - a policy action with `outputId: "web.dom.click"` dispatches `web.dom.capture_snapshot` and
    returns a summary with a boolean `truncated`;
  - a policy action with a non-web `outputId`, or none, is declined with 0 dispatches;
  - a one-sided diff is declined.
- **Mutation proof:** restore the old `definitionId`-only check; the first row must fail.

**Part 2: Core (owner: a Core worker, after the boundary alert).** Pass the execution node
(with its `parameterValues`) into `enrichAttemptWithHostState`, and use it for the
`after_action` capture and `inspectStateDiff` in `host-state.ts:25`. Callers are in
`node-execution.ts:56,78,110-112,137`.
- **Test:** an executor row whose host runtime records both capture inputs, asserting that
  `after_action` receives the node's `parameterValues.outputId`.
- **Effect:** `afterAction` packets and a real `stateDiff`.
- **Cost:** needs a Core build and a new Lab pin.

A workaround I would reject: have the domain accept a `builtin.policy.action` with no
`outputId` at `after_action`. It approximates Core's stub node downstream, which the
project's rule on Core-shaped defects forbids.

**Budget.** The host runtime calls `sanitizeWebLlmSnapshot` with no options, so the
exploration budget applies: 6,000 bytes (`sanitize.ts:125-128`, `limits.ts:22-25`). No runner
code compares `sanitizedPacketBytes` to a budget; a grep of `packages/test-runner/src` finds
only LLM token budgets. Criterion 2's "≤ budget" is therefore today a reading of the figures,
not a check.

**The one Lab run that proves it.** One `lab run --flow` of `product-catalog`, default
variant, after Part 1 (and Part 2 if landed), with `FLUXIQ_TEST_ENV_FILES=none`.
- **Why this scenario:** its stage2d Flow runs had 4 to 7 web actions, and its kept recording
  objects are 125-135 KB, so a trimmed packet (`truncated: true`) is plausible. That is an
  inference; I did not read values.
- **What the run must show:**
  1. in `snapshots/flow-lane.json`, every web action has `evidencePackets` with a
     `beforeAction` entry (and `afterAction` with Part 2);
  2. `evaluation.json` `sanitizedPacketBytes` has one entry per packet, every entry ≤ 6,000,
     and `truncationCount` equals the packets flagged `truncated`;
  3. the redaction attestation still reports 0;
  4. the Flow's statuses and `comparisonStatus` values are unchanged from stage2d.
- **Leak rows:** repeat 3 on an `auth-gate` or `sensitive-input` run before criterion 2
  closes, because summaries are not rewritten by trace withholding (`trace-withholding.ts:64`).

## Commands run and observed results

- `node iep-keys.mjs a/run-mu023nye-7ecc83ab/snapshots/flow-lane.json` -> `actions[]` keys
  `actionType`, `status`, `comparisonStatus`, `targetResolution`; no `evidencePackets`.
- `node iep-scan.mjs` -> exit 0.
  - Totals: `{"bundles":48,"withFlowLane":31,"actions":86,"actionsWithPackets":0,"actionsWithTargetResolution":66,"failedActions":11}`.
  - Kept totals per run: `stateRefs=0 beforeAction=0 afterAction=0 stateDiff=0 web-state-diff.v1=0 web.output.=0 web-automation-host-runtime=0`.
  - `web-llm-evidence.v1=1` only in `run-mu02vd6b-046b01e6`'s command attempt.
- `node --experimental-sqlite iep-struct.mjs`:
  - first run exit 1, `database disk image is malformed` on the first copy;
  - after per-database error handling, exit 0. `runtime_action_summaries ... stateRefs=0`,
    `definition_id counts: builtin.policy.action=3|2|2|2|1`; command-attempt `outputId`s only
    `web.dom.click`, `web.dom.scroll` and `web.dom.upload`; `scratch copies removed`.
- `git log -S'does not act on a page' -- domain/src/runtime/host-runtime.ts` -> `ee25ac9 2026-09-12`.
- Core `git log -S'definitionId: "builtin.policy.action"'` (recordings service paths) -> earliest `9f6d8ca 2026-08-07`.

## Not verified

- **Lab evidence:** no Lab run exercised a changed rule. Everything in 1 comes from one
  campaign (stage2d): a single observation per run, though the code path is deterministic, not
  timing-dependent.
- **Bench A (`F:\fxlab-runs\stage3`):** not read, by instruction. The supervisor's reading of
  its first 8 runs agrees.
- **Which kept workspace maps to which workflow id (W-number):** not resolved, only scenario
  and variant names.
- **Core pin:** I did not diff Core `3cb8976` against the working tree for the cited files.
- **Snapshot dispatches as command attempts:** whether each `web.dom.capture_snapshot`
  dispatch persists a raw snapshot in Core's command attempts, adding page data at rest the
  leak check must scan. Plausible from the existing action attempts, not read.
- **Cost of two extra round trips per web attempt:** duration, W25 `too-slow` timing, and a
  capture during navigation (a failed capture only drops the reference).
- **`extension` handler for `web.dom.capture_snapshot`:** it exists (`execute.ts:128-129`); I
  did not confirm it returns `result.snapshot` in the shape `host-runtime.ts:149-152` reads.

## Open questions or contradictions found

1. **Architecture notes:** `host-runtime.ts:3-8` and `runtime/service.ts:24-27` say the binding
   "gives a web attempt its `stateRefs`". On recorded Flows it never has. `g-flow-lane-followups`
   was accepted on that premise.
2. **No budget check:** criterion 2 names "packet ≤ budget", but no Lab-side code checks it.
   Should a bench row fail a packet over the exploration budget (6,000) or over the ceiling
   (12,000)? This would be a test-runner brief.
3. **Behaviour change to verify:** with references present, Core's `currentStateRef`
   (`transition-comparison.ts:148-151`) and the expectation context's `stateRef`
   (`node-execution.ts:96`, domain `expectation/evaluate.ts:198`) become populated. The domain
   only echoes it, but the Lab run should confirm comparison statuses do not move.
