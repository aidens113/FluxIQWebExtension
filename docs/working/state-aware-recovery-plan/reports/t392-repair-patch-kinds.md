# t392 E1: repair patch kinds `add_handler` and `replace_unit`, and the pure overlay

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`, nothing committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. Both kinds exist end to end on the model side (types, schema, boundary parse, output validation) and the
graph side (one pure overlay with a unit digest guard and Flow validation). `applyRuntimePatchToFlow` now delegates
to the overlay, so every kind goes through one application path. The recovery plan offers the new kinds only when
`inRunRepair: true`. Nothing is wired into graph-run or the run session.

## What changed and why

**Model-facing contract (`AS/runtime/llm/harness/`).** `llm/harness/` already holds 25 source files (the directory
limit), and a `harness/unit-repair/` subdirectory broke the 9-segment path-depth rule. So the new code went into the
files that already own each concern, and no file was added:
- `structured-response.ts`: new types `AutomationStudioRuntimeAddHandlerPatch`, `AutomationStudioRuntimeReplaceUnitPatch`,
  `...PatchHandlerSpec`, `...PatchHandlerScope` (`nodes` or `subflow`, never `automation`), `...PatchHandlerThen`
  (`resume`, `route`+checkpointId, `resolve`+outputs, `give_up`), `...PatchUnit` (`node`, `handler`, `part`). The event type is
  `Exclude<AutomationStudioLifecycleEvent, "start">`. Also added: `AUTOMATION_STUDIO_RUNTIME_PATCH_HANDLER_BOUNDS` (8
  conditions, fact up to 200 characters, values up to 1000, ids up to 200, 16 scope nodes, resolve outputs up to 4000
  characters) and `automationStudioHandlerThenDisposition` (`give_up` maps to `unhandled`). Both kinds join the
  `AutomationStudioRuntimePatch` union.
- `runtime-patch-schema.ts`: the JSON schemas for both kinds, and `AUTOMATION_STUDIO_IN_RUN_REPAIR_PATCH_KINDS`. They are
  offered **only** when `allowedKinds` lists them. When `allowedKinds` is undefined, the model sees exactly today's five.
  The descriptions use general words only (steps, facts, parts); a test checks them for scenario vocabulary. A
  condition `target` may name evidence handles only, the same rule a target override keeps.
- `provider-result.ts`: the boundary check for both kinds (allowed fields, bounded strings, step counts,
  FactCondition shape, no automation scope, the right replacement shape per unit kind, `failedEdgeTo` on node units
  only). `isRuntimePatchStep` stays in this file and now also checks handler bodies and replacement steps.
- `output-validation.ts`: the event-dependent rules. A `before`/`retry` handler needs a non-empty `when` and
  `completionCheck`. `then` must be allowed at the event (`automationStudioDispositionAllowedAt`). A route needs a
  checkpointId. A node or part needs steps, a handler needs a handler.
- `index.ts`: exports the new types, the kind list and the disposition mapping.

**Overlay (`AS/runtime/live-patch/`, new files).**
- `overlay.ts`: `overlayAutomationStudioRuntimePatch({ flow, patch, failedNodeId, runId, subflowGraphs?, validationContext? })`
  returns `{ applied: true, flow, changedUnit, partGraph? }` or `{ applied: false, reason, message }`. It never changes its
  input. It covers every kind, and the exhaustive switch with `unappliedRuntimePatchKind(patch: never)` moved here from
  `live-patch.ts`, unchanged. Existing kinds keep the same application and the same refusal codes.
  `temporary_recovery_subflow_call` is still `unapplied_patch_kind:...`.
- `handler-build.ts`: builds the handler as real nodes: a `builtin.control.handler`, then body steps built the way
  step-insert builds them, then a `builtin.control.handler-end`. They are joined by `body`, then `success` edges, then the
  end. Ids are `node.runtime-patch.<run>.handler-<failedNode>` plus a `-2`, `-3`... suffix when an id is taken.
- `unit-replace.ts`:
  - **node:** the first step keeps the node's id, so incoming edges and the continuation still point at the unit. Later
    steps chain behind it, and the last one takes the node's outgoing edges. The node's `fluxiq.entry` and
    `fluxiq.checkpoint` metadata are kept. `failedEdgeTo` replaces the unit's `failed` edge.
  - **node refusals:** a node inside a handler body, a Start, and a failed route into a handler body.
  - **handler:** the id is kept; the old body and end are removed, and the new ones take their place in node order.
  - **part:** the Subflow graph's Start nodes are kept and lead to the steps; everything else is replaced. It is returned
    as `partGraph`, and the calling flow comes back unchanged.
- `unit-digest.ts`: `automationStudioGraphUnits`, `automationStudioGraphUnitDigests` and `automationStudioUnitDigestRefusal`.
  - Units are handlers (the handler node, its body and its end) and every other node.
  - A digest is a sha256 over each member's definition, parameters, label, description and metadata, plus its outgoing
    edges (port, target, target port, metadata). Position and edge ids are ignored.
  - The overlay refuses `unit_outside_patch_changed:<unit>` when any unit other than the named one changed or disappeared.
  - The action-sequence insert re-points incoming edges, so it passes an alias (first inserted step stands for the
    target) and stays identical.
- `overlay-validation.ts`: wraps the document's nodes and edges in a blank artifact and runs `validateAutomationStudioFlow`
  (handler checks included). The overlay refuses `overlay_invalid:<code>` with the validator's message.

**`live-patch.ts`.**
- `applyRuntimePatchToFlow` delegates to the overlay. `failedAttempt.nodeId` is now passed in.
- Mapping for the new kinds:
  - Preflight policy lines: `add_handler` needs `allowCreateRecoveryPaths`, `replace_unit` needs `allowModifySubflows`.
  - `patchRisk` is `high`, and both are side-effecting (they run steps).
  - `requiredHostCapabilities` is `["action-dispatch"]`.
  - `requiresChangeProposalForRuntimePatch` is true.
  - `changedNodeForPatch`: a replaced node starts at its own id; the other new cases start at the failed node.
  - `retryOriginalAction` is false, as for inserted steps.
  - `runtimePatchTargetsFlow` checks scope nodes and the unit node.
  - `changePatchFromRuntimePatch` maps to `edit_recovery`, carrying the spec in `after` (see open questions).

**`recovery/plan.ts`.** New input option `inRunRepair?: boolean`. When it is true, and the failure's candidate kind
offers any patch, `add_handler` and `replace_unit` are added after today's kinds. Policy refusals use the same
sentences as the preflight. Callers that do not pass the option keep today's list.

**`recovery/annotation/patches.ts`.** The detached path holds `add_handler`/`replace_unit` to the plan's list, as it
already did for target overrides and inserts. Its plan never lists them, so a model that writes one there is recorded
as unplanned and does not run.

**Tests (new):**
- `llm/harness/tests/in-run-repair-patches.test.ts`
- `live-patch/tests/overlay.test.ts`
- `live-patch/tests/in-run-kinds.test.ts`
- `recovery/tests/plan-in-run-repair.test.ts`

`in-run-kinds.test.ts` covers `live-patch.ts` but is placed in `live-patch/tests/`, because `runtime/tests/` is at the
25-file limit.

## Commands run and observed results

All commands ran in `packages/fluxiq` unless noted.
- `npx vitest run <AS>/llm/harness/tests <AS>/live-patch/tests <AS>/tests/live-patch.test.ts <AS>/tests/live-patch-target-override.test.ts <AS>/recovery`
  - Before the new tests were added: `Test Files 68 passed (68)`, `Tests 724 passed (724)`. The existing live-patch tests
    pass unchanged.
  - With the new tests (still including `runtime/tests/live-patch-in-run-kinds.test.ts`, before it moved): `Test Files 72 passed (72)`,
    `Tests 776 passed (776)`.
- `npx vitest run <AS>/live-patch/tests` after moving the test: `Test Files 3 passed (3)`, `Tests 24 passed (24)`.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`: no output, exit 0.
  Earlier runs showed transient errors in `runtime/composite-execution/owner.ts` (another worker's in-flight edit); they
  were gone on the final runs.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` at the Core root: `structure-audit: passed (300 warning(s), 708 baselined).`
  - Advisory warnings on files I touched: `structured-response.ts` (410 lines, 15 exported values), `provider-result.ts`
    (544 lines), `live-patch.ts` (658 lines, down from 667), `annotation/patches.ts` (449 lines).

## Not verified

- No live run and no provider call. Everything above is provider-free unit tests.
- The registration readback is verified with `automationStudioGraphHandlerRegistrations`. Dispatch of an overlaid handler is
  not verified, because the dispatcher and the hold-in-place are E2/R2.
- `replace_unit` part is tested against a graph passed in `subflowGraphs`. The overlay does not check that the flow holds a
  Call Subflow node calling that `subflowId`, because `call-subflow.ts` is another worker's file and still in flight. E2 should
  check this, or pass only the called graphs.
- The full `pnpm check` / `pnpm test` suites were not run (twice-daily rule).

## Open questions or contradictions found

1. **Validation refuses new errors only.** The brief says "refuses on errors". The overlay refuses an error the overlay
   introduced, matched by code and message with multiplicity. If a run's graph already has an error, a repair to an
   unrelated unit is not refused for it. Refusing every error would also have changed behaviour for existing kinds on
   imperfect fixtures, which the brief forbids. The supervisor should confirm this reading.
2. **No durable form (gap in `model/`).** Neither kind has a change-proposal kind of its own, so both map to the closest
   existing op, `edit_recovery`, with the repair spec in `after`. `edit_recovery` has no durable applier
   (`service/adaptations/durable.ts` refuses it), so judged promotion of an in-run handler or unit replacement will be
   refused until `model/flow-adaptation.ts` gains kinds (for example `add_handler` / `replace_unit`) and an applier in
   `service/adaptations/`.
3. **No fact-evaluation capability id.** `host-runtime.ts` has no `fact-evaluation` capability, so the new kinds require
   only `action-dispatch`. The R2 dispatcher should add and require the fact capability.
4. **Condition targets.** A model-written `target` in a FactCondition is restricted to `{ handles }`. The host's fact
   evaluation will need to resolve handles, a downstream concern.
5. **`when` minimum.** A `before`/`retry` handler from a repair must have at least one `when` condition. Otherwise it would
   run before every attempt in scope; C4 itself sets no minimum. `fail`/`before_next` may have an empty `when`.
6. **Exhaustiveness check location.** The `unappliedRuntimePatchKind(patch: never)` check now lives in
   `live-patch/overlay.ts` with the one switch, not in `live-patch.ts`.
