# t289-H (W22 instrumentation): creation snapshot keeps control nodes and edges

Worker report.

## Outcome

Done. A created-Flow run's `snapshots/flow-lane.json` now has an `authoredGraph` field beside `authoredNodes`, which is unchanged. The field has this shape:
`{ controlNodes: [{ nodeId, definitionId }], edges: [{ edgeId, sourceNodeId, sourcePortId, targetNodeId, targetPortId }], omitted: { controlNodes, edges } }`.
It holds identifiers only. The incomplete snapshot carries `authoredGraph: null` until the Flow has been read.

## What changed and why

- **New contract** in `packages/test-contracts/src/authored-flow/`:
  - `graph.ts` defines the `AuthoredFlowGraph`, `AuthoredFlowControlNode` and `AuthoredFlowEdge` types and `AUTHORED_FLOW_GRAPH_BOUNDS` (128 control nodes, 512 edges).
  - `graph-validation.ts` provides `validateAuthoredFlowGraph` and `assertAuthoredFlowGraph`. Every string must be a Core identifier (`isCoreIdentifier`). Ports, `edgeId` and `definitionId` may be null. Unknown keys are rejected, ids must be unique, the lists are bounded, and `omitted` holds non-negative integers.
- **Files moved (no content change):** `authored-flow-node.ts` and `authored-flow-node-validation.ts` are now `authored-flow/node.ts` and `authored-flow/node-validation.ts`. The structure audit required this: `src/` would have held 27 files against a limit of 25, and four files would have shared the `authored-` prefix. A new `authored-flow/index.ts` barrel exists, and `src/index.ts` now re-exports it. Public exports are unchanged.
- **New producer files** in `packages/test-runner/src/flow-lane/creation/`:
  - `graph-read.ts` (`readCreatedFlowGraph`) wraps the control and calls the existing `readFlowNodes`. It collects `flow.edges` from every `get-flow` answer, so nodes and edges come from the same read and there are no extra HTTP calls. `flow-lane/flow-action-types.ts` is outside my ownership, so I did not change it.
  - `authored-graph.ts` (`createdFlowAuthoredGraph`):
    - A control node is any node not in `actionTypes`.
    - Edges keep only their ids and ports.
    - An edge id that is malformed or repeated, a malformed `definitionId`, or a missing port becomes `null`.
    - A malformed node id or edge endpoint, or anything past the bounds, is counted in `omitted` and not carried.
  - `document-identifier.ts` (`flowIdentifier`) holds the `IDENTIFIER` shape rule taken out of `authored-nodes.ts`, which now imports it.
  - The barrel is updated.
- **Wiring:** `lane.ts` uses `readCreatedFlowGraph` and adds `authoredGraph` to the evidence, the progress record and the incomplete snapshot. `snapshot.ts` writes `authoredGraph`.
- **Tests:**
  - New: `packages/test-contracts/tests/authored-flow-graph.test.mjs` and `creation/tests/authored-graph.test.ts`. The second uses the `mut4fvkm` s6/s7/s8/s9 shape and covers leak checks, omitted counts, bounds, and a single read with no duplicate `get-flow`.
  - `fake-creation-core.ts` now serves `EXTRACTING_EDGES`, which include a label and metadata that must not leak.
  - `lane.test.ts` asserts `snapshot.authoredGraph` and its validation, and extends the leak list and the incomplete-null list.
- **Docs:** `docs/architecture/testing-facility.md` has a new paragraph after the `authoredNodes` paragraph. `docs/architecture/sensitive-values.md` has a new sentence on what `authoredGraph` may carry.

## Commands run and observed results

- **Fail-first, contracts:** after the build, before the barrel export, `node --test tests/authored-flow-graph.test.mjs` printed `# pass 0`, `# fail 3`.
- **Fail-first, runner:** with the `authoredGraph` line in `snapshot.ts` commented out, the `test-runner:build` step showed TS2339 `Property 'authoredGraph' does not exist` (lane.test.ts:140, 148), and `node --test dist/flow-lane/creation/tests/lane.test.js` printed `# pass 32`, `# fail 1`. After restoring the line, both passed.
- **Contract tests:** `pnpm.cmd --filter @fluxiq-web-extension/test-contracts test` exited 1 at its first step, `scripts/check/core-build.mjs`: "FluxIQ Core's build at ...\t289\!FluxIQ is 25 minute(s) behind its source" (stale `packages/fluxiq/src/ui/activity-action/tested.ts`). Core is read-only for me, so I ran the steps after that gate directly. `node ../../scripts/build-cache/cli.mjs test-contracts:build` then `node --test tests/*.test.mjs` printed `# pass 164`, `# fail 0`.
- **Runner build:** `node scripts/domain-dist.mjs` then `node ../../scripts/build-cache/cli.mjs test-runner:build` stored 1646 files, with no tsc errors after the move.
- **Runner tests:** `node --test dist/flow-lane/creation/tests/*.test.js dist/flow-lane/creation/chat/tests/*.test.js` printed `# pass 130`, `# fail 0`.
- **Runner check:** `test-runner:check` (tsc --noEmit through build-cache) exited 0.
- **Contracts check:** `test-contracts:check` (tsc --noEmit) exited 0.
- **Structure audit:** `node scripts/structure-audit.mjs` printed `structure-audit: passed (174 warning(s), 118 baselined)` and exited 0. Before the move it reported 3 violations: directory-files 27/25 in test-contracts/src, the `authored-` prefix, and the `flow-` prefix in creation. The move cleared them. `creation/tests` holds 19 files.

## Not verified

- The `pnpm.cmd ... test`, `check` and `build` wrappers as written: each stops at the Core-staleness gate. The test-runner build and check also compiled against Core's dist, which is 25 minutes older than Core's source.
- Live runs: no Lab, browser or provider run, as the brief says. Against a real Core, `get-flow` answers carry `flow.edges` per the `AutomationStudioFlowArtifact` type (Core `model/flows.ts:213`). I read that type but did not exercise it live.
- I did not run the whole test-runner suite, only the tests in the creation directory.

## Open questions or contradictions found

- The brief suggested `authored-flow-graph.ts` at the `src/` root. The structure audit forbids that, so the files went into `src/authored-flow/`, and the existing `authored-flow-node*` files moved with them.
- The parent orchestration Flow's edges, if it has any, are recorded together with the Subflow graph edges in one list. No per-graph `flowId` is recorded. Node ids are unique across those documents in the `mut4fvkm` evidence, but no contract guarantees that.
- `git status` also shows `apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts` modified. That is the concurrent worker's change; I did not touch it.
