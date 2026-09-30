# t178 — Flow Bootstrap before/after diff view (worker report)

Tree: `C:\Users\osrs_\FluxStuff\fxwork\t178\!FluxIQ`. A/ = `apps/web/src/features/automation-studio/adaptations/`.

## Outcome

Done. All three brief checks pass. One deviation from the brief: the loader does **not** call `get-flow-router` or `get-flow`. The browser refuses both. See below.

## What changed and why

### Deviation: bounded endpoints in place of `get-flow-router` / `get-flow`
`apps/web/src/features/automation-studio/data-request-policy.ts` lists `get-flow` and `get-flow-router` in `AUTOMATION_STUDIO_BROWSER_BLOCKED_LEGACY_ENDPOINTS`. `useProgramApi` (`apps/web/src/features/programs/program-api.ts:129`) calls `assertAutomationStudioBrowserEndpointAllowed`, which **throws** for these endpoints. A loader that used them would fail on every call in the real app. I used the bounded v2 equivalents instead:
- `get-flow-router-summary` → `{ router: { routerId, ruleCount, ... } | null }` (Core `service.getFlowRouterSummary`). I dropped its `name` because the SQL projection hard-codes `"Flow Router"`. Keeping it would mark every Router as renamed.
- `list-flow-subflows` with `{ projectId, flowId, limit: 100, offset: 0 }` → `{ subflows: [{ subflowId, name, graphFlowId?, ... }] }`. Core clamps the limit to 100, so only the first 100 Subflows are read.
- `get-graph-viewport` with `{ projectId, flowId: graphFlowId, bounds: ±1e9, limit: 500, cursor }`. This is paged by `nextCursor`, up to 10 pages. It returns `page.nodes[{ nodeId, label, definitionId }]`, `page.edges`, `page.boundaryEdges`. The edge count is the number of distinct `edgeId`s across edges and boundaryEdges on all pages. If a page fails, or the graph is larger than 5000 nodes, that Subflow's `nodes`, `nodeCount` and `edgeCount` stay **absent**. They are never set to an empty list, because an empty list would show every step as removed.

### Files
- **New `A/change-diff.ts`** (pure model, 3 exported values):
  - `isFlowBootstrapAdaptation(adaptation: unknown): boolean`
  - `flowChangeDiffMode(adaptation: unknown, current: ChangeDiffTopology | null): "create" | "extend" | undefined`. `metadata.bootstrap.mode` wins when it is present. Otherwise the result is `extend` if any patch `targetId` matches the current Router or a current Subflow id, and `create` if none does. The result is `undefined` when there is no declared mode and no topology.
  - `flowChangeDiffRows(adaptation: unknown, current: ChangeDiffTopology | null): ChangeDiffRow[]`
  - Types: `ChangeDiffStep {nodeId,label?,type?}`, `ChangeDiffCurrentSubflow`, `ChangeDiffTopology { router: {routerId, ruleCount, name?} | null; subflows: [...] }`, `ChangeDiffMeasures`, `ChangeDiffSteps {added, removed, kept}`, `ChangeDiffStatus`, `ChangeDiffRow {targetKind, targetId, label, status, before?, after, steps?}`, `ChangeDiffMode`.
  - Status rules:
    - In a create, every row is `added`.
    - In an extend, a matched id is `changed` when any known measure differs, or when the step diff has added or removed steps, or when a kept step has a different label or type. Otherwise it is `unchanged`. An unmatched id is `added`.
    - `after.steps` is diffed by nodeId against the current graph nodes only when both are known.
    - An added Subflow that carries steps lists all of them as added.
  - **Added a fourth status, `unknown`.** It is used when the topology could not be read and the mode is not `create`. I added it because showing `added` or `changed` in that case would be a guess. This goes beyond the three statuses in the brief.
- **`A/adaptation-queries.ts`**: added `loadFlowChangeTopology(api: ProgramCommandTransport, payload: { projectId: string; flowId: string; subflowIds?: string[] }): Promise<ApiResponse<{ topology: ChangeDiffTopology }>>`.
  - If the Router or Subflow read fails, the whole load returns `{ ok: false, error }`.
  - `subflowIds` limits the graph reads to the Subflows the adaptation touches.
- **`A/adaptation-host.ts`**: added the optional member `loadTopology?(payload)` to `AdaptationCommands` and wired it in `useAdaptationCommands`. The existing tests compile unchanged.
- **New `A/ChangeDiffSection.tsx`** (one component, `ChangeDiffSection`):
  - Heading is "What changes", or "Changes to your existing automation" for an extend.
  - A `DataTable` with the columns Part / Before / After / Change. It has a "Router rules" row and one "Subflow <name>" row per Subflow showing steps and connections, with a `StatusBadge`.
  - An Added / Removed step list for each Subflow whose step diff is not empty.
  - When the read fails, it says "The current automation could not be read, so only the proposed version is shown." and offers a Retry button. Without `loadTopology` it says "not available here".
  - For an applied adaptation, a note explains that "Before" already includes the changes.
  - The review buttons come from `adaptationReviewActions(status, adaptationKind)` and `adaptationReviewCopy`. They call the view's `requestAdaptationReview`, so they open the same modal the Audit tab uses.
  - A stale load is dropped through a `current` guard.
- **`A/AdaptationsView.tsx`**: two import lines, plus one line at the top of the Changes tab: `isFlowBootstrapAdaptation(selectedAdaptation) ? <ChangeDiffSection … onRequestReview={requestAdaptationReview} loadTopology=… /> : null`. No component was added to the file.
- **`A/index.ts`**: `export * from "./change-diff";`
- **New tests**:
  - `A/tests/change-diff.test.ts` (8 tests): recognition, create, inferred extend, declared extend with an unchanged Router, step diff (added / removed / kept, relabel, new Subflow), missing current data (no invented step diff, `unknown`), loader paging and endpoint choice (asserts that `get-flow` and `get-flow-router` are never called), loader failure.
  - `A/tests/change-diff-section.test.tsx` (3 tests, through `AdaptationsViewContent`):
    - extend: headings, before→after cells, added and removed steps, and Approve opening the review Modal;
    - create: a failed read shows the fallback copy, and Retry reloads;
    - no loader: shows the fallback copy;
    - non-bootstrap adaptation: shows no diff and never loads.

## Commands run and observed results

- Free RAM was 2.14, 3.46 and 2.19 GB before the heavy runs.
- `npx tsc --noEmit -p apps/web/tsconfig.json` (Core root) → no output, exit 0. I ran it twice, the second time on the final code.
- `npx vitest run --maxWorkers=2 src/features/automation-studio/adaptations` (in apps/web) → refused with `RangeError: options.minThreads and options.maxThreads must not conflict` (vitest 2.1.9). With `--minWorkers=1 --maxWorkers=2` on the final run: `Test Files 5 passed (5)`, `Tests 21 passed (21)`.
- `node scripts/structure-audit.mjs` → the first run failed with `[swallowed-failure] ChangeDiffSection.tsx line 61`: the rejection handler dropped the error once the component was unmounted. I fixed it by sending both settle paths through `apply(next)`. The final run printed `structure-audit: passed (194 warning(s), 355 baselined)`, exit 0. It also printed "1 baseline entries can be lowered". I did not check whether that entry is mine, and the baseline file is outside what I own.

## Not verified

- I did not check the page in a live browser or against a real Core server. The endpoint shapes come from reading the Core handlers and service code (`api/handlers/router.ts`, `subflows.ts`, `flows.ts`; `service.getFlowRouterSummary`, `getFlowGraphViewport`; `graph-store.ts viewport`).
- I added no CSS for `automation-adaptation-change-diff` or `automation-adaptation-step-diff`. The styles are outside A/.
- I did not run a repo-wide test run, as the brief required.

## Open questions or contradictions found

1. The brief named `get-flow-router` and `get-flow`. The browser refuses both, so I substituted the bounded endpoints as described above. Note that `conversation/capabilities/catalog/running.ts:221` also posts `get-flow`. That file is outside my scope, and it may hit the same guard.
2. The Audit tab has an existing bug: its terminal-state message calls `adaptationReviewActions(selectedAdaptation.status)` without the kind. As a result, a `flow_bootstrap` adaptation in `testing` shows no buttons and no message. I left it alone.
3. Current Subflows that the adaptation does not mention get no row. Whether an extend removes them is not stated in the projection.
4. The status palette gives `added`, `changed`, `unchanged` and `unknown` the neutral tone (`fluxiqStatusTone`). A distinct tone would need a Core UI change.
