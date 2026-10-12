# t398 report: handler labels and recovery role

## Outcome

Partial. Item 1 (labels) is done. Item 2 (recovery role) is done in Core's save-time
validation and in the editor's two validator calls. The editor does not yet receive the
role, though: the source of the role is outside the paths this brief owns (see Open
questions). Two Core save paths in `runtime/service.ts`, which this brief forbids, still
validate without the role.

## What changed and why

All paths are in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t398/!FluxIQ`.

### 1. Labels (candidate-script Flows)

- `runtime/flow-bootstrap/authoring/assemble.ts`: `buildNode` names a node with
  `step.nodeLabel ?? writtenNodeLabel(step)`. The new `writtenNodeLabel` returns the step's
  description, with whitespace collapsed and cut at `maxNameLength` (120). It does this
  only for a step the model wrote (`line > 0`) that no draft step became
  (`draftStepId === undefined`). As a result:
  - Draft-path naming is unchanged. A draft step keeps `describedName`, and a per-row step
    stays deliberately unnamed so that a row's page data never becomes a node name.
  - Joins and loops that Core derives (`line` 0) stay unnamed.
- `runtime/flow-bootstrap/script-statements/handler-blocks.ts`: the handler
  registration's `nodeLabel` is the `<situation>` text, or the block's name when there is
  none. The handler-end's `nodeLabel` is `Then <then text>`. Both are one line, at most
  120 characters. The body steps get their names from rule 1.
- `runtime/flow-bootstrap/authoring/contracts.ts`: the `nodeLabel` doc now describes where
  the name comes from.
- `adaptation.ts` needed no change. It already writes `node.label` to the Flow node, which
  is the field the editor (`FlowHandlerNode`, `graph/handlers/canvas-view.ts`,
  `plain-words.ts`) and the run's step card read.
- Part Subflow: a part's `<what it does>` is already the block `name`, which becomes
  `subflow.name` (`parse.ts` `startBlock` → `assemble.ts` → `adaptation.ts`). A test now
  pins this. The plan Subflow type has no `description` field, and `plan/` is not owned
  here, so no description was added.

### 2. Recovery role

- Core, new file `runtime/service/flows/validation-context.ts`:
  `automationStudioFlowValidationContext(flow, readSubflow, given)`.
  - A caller-supplied role takes precedence.
  - Otherwise it looks up the role, but only for a Subflow graph (`isAutomationStudioSubflowGraphMetadata`) that holds a handler node.
  - The lookup reads the Subflow the graph names, and uses the role only when that Subflow's `graphFlowId` is this graph.
  - A failed read propagates rather than being guessed; the structure audit refuses a failure that is turned into "no value".
  - The file is exported from `flows/index.ts`.
- `runtime/service/flows/writer.ts`:
  - `saveFlowInternal` and `saveFlowUnheld` accept an optional `validation?: AutomationStudioFlowValidationContext` on their input.
  - Both `validateAutomationStudioFlow` calls in the save now use the resolved context, read through `facade.getFlowSubflow`.
- `runtime/service/adaptations/patches.ts`:
  - `resolveFlowNodeAdaptationTarget` returns `validation: { subflowRole }` from the Subflow it already loads.
  - `assertFlowValidationOk` takes an optional context.
  - The node-patch and router-reroute paths pass that context to the pre-save assertion, to the save, and to the recorded validation.
- `storage/project/accepted-state/validation.ts`: a graph is validated with the role of its `owningSubflowId` Subflow from the same snapshot.
- `model/validation/index.ts`: now also exports `type AutomationStudioFlowValidationContext`.
- Web, `apps/web/src/features/automation-studio/flow-editor/`:
  - `flow-editor-types.ts`: `FlowEditorProps` gains `subflowRole?: string | undefined`.
  - `hooks/useFlowEditorGraphDocument.ts` (the idle validation) and `hooks/useFlowEditorCanvasInteractions.ts` (`validateFlowGraph`) pass `{ subflowRole: props.subflowRole }`. The idle validation also re-runs when the role changes.
  - `graph-validation.ts`: the context field is typed `string | undefined`, which `exactOptionalPropertyTypes` requires.

Tried and removed: a flow-editor hook that fetched `get-flow-subflow` itself. The
structure audit refused it as a new import cycle. Any `useProgramTransport` import from
`flow-editor/` closes the loop `program-api → data-request-policy → view-registry →
canonical-view-definitions → FlowEditorView`, and `FlowEditorView` is baselined at 2
cycles with no room to grow. Importing `subflowSettingsOwnership` from the settings barrel
closed a second cycle, and importing it from the module directly failed the
architecture-contract test (a domain-private import).

## Commands run and observed results

Core commands were run in `C:/Users/osrs_/FluxStuff/fxwork/t398/!FluxIQ` and its packages.

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/service/flows src/programs/automation-studio/runtime/service/adaptations src/programs/automation-studio/storage/project/accepted-state` (packages/fluxiq)
  → `Test Files 123 passed | 1 skipped (124)`, `Tests 1794 passed | 2 skipped (1796)`. These include the new tests:
  - `authoring/tests/written-labels.test.ts` (4 tests)
  - `service/flows/tests/validation-context.test.ts` (3 tests)
- `npx vitest run src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/service/flow-bootstrap-commands src/programs/automation-studio/model/validation`
  → `26 passed (26)`, `181 passed (181)`. This ran before the final validation-context change.
- `pnpm --filter fluxiq check` → completed with no errors (build-cache line only).
- `pnpm --filter @fluxiq/contracts --filter fluxiq build` → `Done`. The web tests need it, because they import the compiled dist.
- `pnpm check` (apps/web) → completed with no errors (build-cache line only).
- `npx vitest run src/features/automation-studio/flow-editor src/features/automation-studio/tests` (apps/web) → `Test Files 22 passed (22)`, `Tests 128 passed (128)`. The existing `flow-editor/tests/graph-validation.test.ts` already covers the validator with `subflowRole: "recovery"`.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` → `structure-audit: passed (303 warning(s), 708 baselined).` The only warning on a touched file is advisory: `authoring/assemble.ts` is 800 lines, against a 400-line threshold.

## Not verified

- No live editor check. In the running app, the editor still gets no `subflowRole` (see below), so the false "Only the automation's recovery part…" problem remains visible.
- The apply of a bootstrap adaptation with an `everywhere` handler, end to end through `service.ts`, was not exercised.
- Whether the chat shows the new labels. The chat was not opened, and its source was not read beyond the fact that it shares the node `label` the run's step card uses.
- No full suites were run, as instructed.

## Open questions or contradictions found

1. **Source of the editor's role (needs files outside this brief).** The flow-editor
   cannot get the role without a host change. The cheapest fix that adds no request:
   - Core `runtime/service/flows/hierarchy-subflows.ts`: add `role` (already present on `AutomationStudioSubflowSummary`) to each `hierarchySubflows` entry.
   - Web `model/project-summary-converters.ts` (line ~129): keep `role`. `model/project-change-reconciliation.ts` may also need to keep it when it rebuilds entries.
   - Web `live/view-host/canonical-connected-views.tsx`, in the `AutomationFlowEditorConnectedView` model selector: find the parent Flow's `hierarchySubflows` entry for `taskGraph.metadata.parentSubflowId` and pass `subflowRole: entry.role`.

   The other option is to add `loadSubflowRole` to an existing transport-bound command hook that `FlowEditorView` already imports, such as `runtime/runtime-host.ts`. That stays inside the baselined cycles.
2. **`runtime/service.ts` (forbidden here) still validates without the role. This is a real bug, not only an editor one.**
   - Line ~3474, in bootstrap apply: `saveFlowInternal({ projectId, flow: entry.graphFlow }, false, "subflow_graph")` runs before `saveFlowSubflow`. When the save looks up the Subflow record, it finds nothing yet. A plan with an `everywhere` handler therefore fails at apply with `flow.handler_automation_scope_outside_recovery`. The fix is one line: pass `validation: { subflowRole: entry.subflow.role }` in that input object. `saveFlowInternal` now accepts it.
   - Line ~4179, the canonical adaptation graph projection: `validateAutomationStudioFlow(synchronized)` has the same gap.

   Both belong to the lead working in `service.ts`.
3. `dsl/compiler.ts` also calls the validator without a context. It compiles code-owned Flows, which are never Subflow graphs, so it was left alone.

## Continuation (coordinator message: feed `subflowRole` from the hierarchy summary)

Outcome of item 2 is now Done, except for the two `service.ts` lines, which are assigned to the t392 lead.

### Why the earlier fetch was removed

The structure audit refused the fetch inside `flow-editor/` under the **`import-cycles`** rule.
- Importing `useProgramTransport` closed the loop `program-api → data-request-policy → view-registry → canonical-view-definitions → FlowEditorView`. `FlowEditorView` is baselined at 2 cycles, and that count may not grow.
- Importing the settings barrel closed a second cycle.
- Importing `settings/subflow-settings-model` directly instead failed `tests/architecture-contract.test.ts`, which forbids domain-private imports.

So the role now comes from data the host already holds, with no new request.

### Changes

- Core `storage/file-store.ts`: `AutomationStudioFlowHierarchySubflowSummary` gains `role?: string`.
- Core `runtime/service/flows/hierarchy-subflows.ts`: each `hierarchySubflows` entry carries the role from the Subflow index summary.
- Web `model/project-summary-converters.ts`: keeps `role` on each `hierarchySubflows` entry.
- Web `model/project-change-reconciliation.ts` (`upsertSubflowSummaryIntoProjectFlows`): keeps `role`, so a role change made in settings reaches the summary.
- Web `live/view-host/canonical-connected-views.tsx`: the flow-editor model sets `subflowRole` through the local `subflowRoleModel(view.projectFlows, taskGraph)`. It finds the parent Flow (`taskGraph.metadata.parentFlowId`), then its `hierarchySubflows` entry for `parentSubflowId`. When the graph is no Subflow's, or the entry has no role, it sets nothing.
- Tests:
  - `runtime/tests/service-flows/tests/subflows.test.ts`: two exact summaries now include `role`.
  - `runtime/tests/service-flows/tests/subflow-index-read.test.ts`: asserts that each entry has a role.
  - Web `model/tests/project-summary-converters.test.ts`: asserts that `role` survives conversion.

### Commands and results

- Core vitest on `runtime/tests/service-flows/tests`, `runtime/service/flows`, `runtime/flow-bootstrap`, `runtime/service/adaptations` and `storage/project/accepted-state`: `Test Files 138 passed | 1 skipped (139)`, `Tests 1859 passed | 2 skipped (1861)`.
  - The first run had 2 failures in `subflows.test.ts`. They were exact `hierarchySubflows` expectations that lacked the new field. The expectations were updated, and one entry's role is `utility`.
- `pnpm --filter fluxiq check`: no errors.
- `pnpm --filter @fluxiq/contracts --filter fluxiq build`: `Done`.
- Web `pnpm check`: no errors.
- Web vitest on `flow-editor`, `tests`, `model` and `live`: `Test Files 58 passed (58)`, `Tests 318 passed (318)`.
- `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`: `structure-audit: passed (303 warning(s), 708 baselined).`

### Not verified

- `subflowRoleModel` has no unit test of its own: it is a non-exported local, under the one-export-per-file rule.
- No live check that the parent Flow's entry keeps `metadata.hierarchySubflows` after the parent's full detail loads. If it does not, the role is missing and the editor falls back to the stricter check.
- `flow-generation.ts` also reads `hierarchySubflows`, which suggests the entry is kept.
