# t270-p5-step-binding: P5 `$step` earlier-output binding

## Current State

Partial, as intended by the split. In Core, the files t270 owns are done and
tested: the form translates to a stable step id, the build's test resolves it
from what that step answered in the same walk, assembly rewrites it to a plan
node key and checks it, and the executor resolves the key in the stored Flow.
**No live path uses it yet.** The four call sites that translate or render
bindings are in t264-owned files and still pass no draft, so a model's
`$step` is still refused with `step_binding_not_yet`, exactly as before. The
exact wiring and model-facing text are specified below. Nothing was committed.
There were no Lab, browser or provider calls.

## Outcome

Partial. Everything in the owned files is implemented: tests were written to
fail first and now pass, `fluxiq:check` passes, the Core and downstream
structure audits pass, Core is rebuilt and the downstream domain typecheck
passes. Activation needs t264's wiring (section "Specified for t264-owned
files"). The re-seed translation needs t269-c4's `draft-from-flow.ts`.

## What changed and why

Design (from `p5-binding-preflight.md` and WIP `p5-earlier-output-contract.md`):

| Layer | Form | Owner |
| --- | --- | --- |
| Model writes | `{"$step": n, "output": "<port>"}`, optional `"path": "<field>[.<field>]"` | grammar text, specified below |
| Draft stores | `{"$state":{"path":"$step.<step id>.<port>[.<field>]"}}` | `flow-draft/binding-forms.ts` |
| Build's test resolves | state `{"$step.<id>": <outputs that step answered in this walk>}` | `llm/node-tools/replay-draft.ts`, `replay-span.ts` |
| Plan and saved Flow | `{"$state":{"path":"$node.<plan key sN>.<port>[.<field>]"}}` | `flow-bootstrap/authoring/assemble-draft.ts` |
| Native run | `$node.<key>` is resolved to the one graph node whose `metadata.bootstrapSymbolicKey` is `<key>`, then `${nodeId}.<port>` goes through the existing resolver | `executor/node-inputs.ts`, `executor/node-execution.ts` |

Core files (tree `fxwork/t270/!FluxIQ`, paths under `packages/fluxiq/src/programs/automation-studio/`):

- `runtime/flow-draft/binding-forms.ts`:
  - `automationStudioFlowDraftTranslateBindings(parameters, context?)`. The new
    `AutomationStudioFlowDraftBindingContext` is `{ steps, at?, nodeOf? }`.
    With no context, `$step` is still refused `step_binding_not_yet`, so every
    current caller behaves as before.
  - With a context, position n becomes the step's own id. These are refused:
    `step_missing` (no step at n), `step_not_earlier` (n is the step itself or
    after it, when `at` is given), `step_not_usable` (the step was dropped or
    exploratory, only looked, or failed), `step_output_unknown` (`nodeOf` knows
    the node and the node declares no such port), and `malformed` (stray key,
    a non-integer or non-positive n, a bad port id, or a list-index or empty
    field segment).
  - Stored kind `{kind:"step", step, output, path?}`.
  - New `AUTOMATION_STUDIO_FLOW_DRAFT_STEP_OUTPUT_ROOT` and
    `automationStudioFlowDraftStepOutputsState`.
- `runtime/flow-draft/binding-render.ts`:
  `automationStudioFlowDraftRenderBindings(value, steps?)` shows a step binding
  as `{"$step": <current position>, ...}`, or `null` once the step is gone.
  Without `steps` it shows the binding as stored.
- `runtime/llm/node-tools/replay-draft.ts` and `replay-span.ts`:
  - Each step's outputs are kept per walk, and only from an answer that was
    asked to run and returned `core.replay.replayed`
    (`automationStudioFlowDraftReplayProduced`). A checked, remembered, failed
    or not-yet-run step produced nothing, so its reader fails
    `core.replay.unresolved_binding` and nothing is sent.
  - Each repeat pass starts with none of the previous pass's outputs. Steps
    before the span are visible on every pass.
  - Nothing reads the exploration's `produced`/`priorExecution`.
- `runtime/flow-bootstrap/authoring/assemble-draft.ts`:
  - New refusals, each naming the reading step:
    - `flow_draft.step_binding_source_missing`: the source is not a plan node,
      or the step carries an untranslated `$node.` reference from a saved Flow.
    - `flow_draft.step_binding_not_earlier`: self, or a later step (for
      example after a reorder).
    - `flow_draft.step_binding_unknown_output`: checked against the registry.
    - `flow_draft.step_binding_conditional_source`: the source is optional,
      only-if, a fallback or an interruption.
    - `flow_draft.step_binding_repeated_source`: the source is a repeat member
      and the reader is outside that repeat.
  - On success it rewrites `$step.<id>` to `$node.<sN>` in the plan's single
    Subflow.
- `nodes/parameter-bindings.ts`: adds `AUTOMATION_NODE_OUTPUT_REFERENCE_ROOT`,
  `automationNodeOutputReference` and `rewriteAutomationNodeStatePaths`
  (generic path rewrite). The brief's `R/nodes/parameter-bindings.ts` does not
  exist, so I read it as this file.
- `runtime/executor/node-inputs.ts`: adds `automationStudioNodeOutputReferences`.
  A key that no node carries, or that two nodes carry, is left as written, so
  the run fails `executor.parameter.unresolved_state_path` before dispatch.
  - This lives in `node-inputs.ts` rather than a new file because `executor/`
    is at its 25-file limit.
  - `node-execution.ts` applies it before resolution and passes the rewritten
    parameters to `withholding.record`.
- Docs: `docs/architecture/automation-studio/flow-authoring.md`, Bindings
  section. Covers the table row, the P5 paragraph and the new assembly checks,
  and removes P5 from "Not built".
- Tests:
  - New: `runtime/tests/earlier-output/tests/replay.test.ts` and
    `stored-flow.test.ts`. These are multi-subject, and
    `llm/node-tools/tests/` was at its 25-file limit; `runtime/tests/<x>/tests/`
    follows the `service-authoring` precedent.
  - New: `runtime/flow-bootstrap/authoring/tests/earlier-output.test.ts` and
    `runtime/executor/tests/node-inputs.test.ts`.
  - Extended: `runtime/flow-draft/tests/binding-forms.test.ts` and
    `binding-render.test.ts`.

What the tests cover (the brief's list):

- Accepts a strictly prior step's real output.
- Refuses:
  - self
  - future
  - missing
  - dropped or exploratory
  - look or failed
  - unknown output
  - reordered away (`not_earlier` at assembly, unresolved in the test)
- Survives positional keys: the draft position 4 step becomes `s3`, behind a
  dropped step, an exploratory step and an optional-step join. It still
  resolves when the extend keeps saved node ids (`node.saved.*`) that hold no
  key.
- Resolves at native runtime (`runAutomationStudioGraph` and
  `AutomationStudioNativeNodeRuntime` with fake web nodes). The build's test
  and the stored Flow send the same value. A missing output fails the reader
  before dispatch with no fabricated value.
- No stale value comes from an earlier pass or from exploration.

## Commands run and observed results

All Core commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t270/!FluxIQ` (vitest in `packages/fluxiq`).

- **Fail first:** `npx vitest run` on the 5 new or extended test files (before
  the move to `runtime/tests/earlier-output/`) printed
  `Tests 25 failed | 14 passed (39)`. The failures were the expected ones:
  `step_binding_not_yet` still returned, `automationStudioFlowDraftStepOutputsState is not a function`,
  no `$node` rewrite, no assembly refusals, and the stored-Flow run did not
  resolve. The 14 that passed were negative replay cases already failing
  closed.
- **After the change:**
  `npx vitest run runtime/executor/tests/ runtime/flow-draft/tests/ runtime/llm/node-tools/tests/ runtime/flow-bootstrap/ runtime/tests/earlier-output/ nodes/tests/ runtime/llm/evidence-loop/tests/ runtime/llm/tests/`
  printed `Test Files 208 passed (208)`, `Tests 2633 passed (2633)`. The
  t264-owned tests that expect `$step` refused
  (`flow-draft/tests/amendment.test.ts:251`,
  `llm/evidence-loop/tests/authored-draft.test.ts:572`,
  `rerun-request.test.ts:239`, `llm/tests/draft-amendment-feedback.test.ts:254`)
  still pass, unchanged.
- **After the last edit** (the untranslated `$node.` refusal):
  `npx vitest run runtime/flow-bootstrap/authoring/tests/ runtime/tests/earlier-output/ runtime/flow-bootstrap/tests/ runtime/llm/node-tools/tests/`
  printed `Test Files 50 passed (50)`, `Tests 505 passed (505)`.
- `node scripts/build-cache/cli.mjs fluxiq:check` exited 0. The first run
  failed on a test-only `exactOptionalPropertyTypes` error, which I fixed.
- `node scripts/structure-audit.mjs` (Core) printed
  `structure-audit: passed (250 warning(s), 349 baselined)`. An earlier run
  failed on `directory-files` and one barrel import; both are fixed. The only
  new warning is `binding-forms.ts: 9 exported values` (advisory threshold 8).
- `node scripts/structure-audit.mjs` (downstream) printed
  `structure-audit: passed (170 warning(s), 118 baselined)`.
- `pnpm.cmd build` (Core): exit 0 on the first run. The second run, after the
  last `assemble-draft.ts` edit, and the downstream
  `pnpm.cmd --filter @fluxiq-web-extension/domain check` are in "Final rebuild"
  below.
- `node scripts/docs-reference.mjs --check` (Core) **fails**:
  `docs/reference/framework-reference.md is stale`. The generated inventory
  records export line numbers, and my edits move them and add exports. Its
  owner script is `pnpm docs:reference`. I did not run it, because the file is
  outside my ownership and t264/t269-t272 will all shift it, so regenerate it
  once at integration. I did not establish whether it was already stale on
  `dev`.

### Final rebuild

After the last source edit, `pnpm.cmd build` in the Core tree printed
`build exit=0`. Then
`pnpm.cmd --filter @fluxiq-web-extension/domain check` in the downstream tree
printed `domain check exit=0`, with the log line
`core-build: FluxIQ Core's build at ...fxwork\t270\!FluxIQ is current with its source.`
Nothing downstream was edited apart from this report.

## Specified for t264-owned files (not written)

Wire the draft into translation and display. Every change below is a small
argument addition. All paths are under `runtime/`.

1. `llm/evidence-loop-decision.ts`:
   - Change the signatures to
     `automationStudioLlmEvidenceParseDecision(value: unknown, binding?: AutomationStudioFlowDraftBindingContext)`
     and
     `automationStudioLlmEvidenceDecisionIssueCodes(value: unknown, binding?: AutomationStudioFlowDraftBindingContext)`.
   - Pass `binding` to `readNodeCall(toolId, input, binding)`, which calls
     `automationStudioFlowDraftTranslateBindings(parameters, binding)`.
   - The refusal codes are produced automatically, for example
     `run_node.binding_refused.step_not_earlier:parameters.text`.
2. `llm/evidence-loop.ts:663`: call
   `automationStudioLlmEvidenceParseDecision(raw, drafting ? { steps: draftSteps, nodeOf: input.nodeOf } : undefined)`.
   Pass no `at`: a written call is appended after every step.
3. `llm/evidence-loop/decision-refusal.ts:44`: pass the same context to
   `automationStudioLlmEvidenceDecisionIssueCodes(raw, ...)`. Its function
   needs the context handed in.
4. `llm/evidence-loop/rerun-request.ts`, `writtenInput`: call
   `automationStudioFlowDraftTranslateBindings(parameters, { steps, at: step.position })`.
   Thread `steps` and `step` into `writtenInput`; both are in scope in
   `automationStudioLlmEvidenceRerunRequest`.
5. `flow-draft/amendment.ts`, `bindStep`: call
   `automationStudioFlowDraftTranslateBindings({ value: form }, { steps, at: step.position })`.
   - Recommended: map a `step_*` refusal to its own amendment reason
     (`bind_step_missing`, `bind_step_not_earlier`, `bind_step_not_usable`,
     `bind_step_output_unknown`) rather than `bind_malformed`, with the texts
     in item 7.
   - Minimum: keep `bind_malformed` and change only its text.
6. `flow-draft/entry.ts:112`:
   `input: automationStudioFlowDraftRenderBindings(step.input, all)`.
   `all` is `stepLine`'s second parameter, the whole draft.
7. Model-facing text:
   - `llm/unusable-decision.ts:113`. Replace
     `{\"$step\": ...} is not available yet.` with:
     `{\"$step\": <n>, \"output\": \"<output id>\"} for the output of the earlier step n, as that step's node declares it, with \"path\": \"<field>\" for one field of a record output; n must be a step before this one that worked and is in the draft.`
   - `llm/draft-amendment-feedback.ts`, `bind_malformed`. Replace the last
     sentence with:
     `{\"$step\": <n>, \"output\": <output id>}: n is a step before this one that worked and is not withdrawn, output an output its node declares, and \"path\" (optional) field names of a record output, never a list index.`
   - If the dedicated reasons are added:
     - `bind_step_missing`: `No step has that number: $step names an earlier step by its number in the draft as it is now.`
     - `bind_step_not_earlier`: `$step reads a step before this one; this step itself and the steps after it have produced nothing yet when it runs. Move the step it reads before it, or read another.`
     - `bind_step_not_usable`: `That step is withdrawn, only looked, or did not work, so the Flow will not produce its output. Read a step that is in the Flow and worked.`
     - `bind_step_output_unknown`: `That step's node declares no output by that name: read the output ids in its definition (core.describe_nodes).`
8. `llm/node-tools/run-node.ts`, `PARAMETERS_DESCRIPTION`. This file is mine,
   but I deliberately did **not** change it: teaching `$step` before items 1-2
   land would make every such call refused `step_binding_not_yet`. Land it in
   the same commit as items 1-2. Insert before
   `"A call that runs now takes concrete values only."`:
   `or {\"$step\": <n>, \"output\": \"<output id>\"} for an output of the earlier step n (add \"path\": \"<field>\" for one field of a record output). `
   The `run-node.test.ts` assertions only check that `$input`/`$row` are
   contained, and the 1,500-character cap is on the tool description, not on
   this property.

For **t269-c4** (`llm/node-tools/draft-from-flow.ts`, re-seeding a saved Flow):
when seeding each node's `parameterValues`, translate `$node.<key>.<rest>` to
`$step.<seed id of the node carrying that key>.<rest>`. Use
`rewriteAutomationNodeStatePaths(parameters, path => ...)` with
`automationNodeOutputReference(path)`, and map the key to a node by
`node.metadata.bootstrapSymbolicKey` (unique) and the node to its seed id
through the inverse of `nodeIdByStepId`. Until this lands, a re-seeded Flow
that holds a `$node` reference is refused at assembly
(`flow_draft.step_binding_source_missing`) rather than pointing at whatever
node now holds the old key. It never silently reads the wrong value.

## Not verified

- No live path exercises P5 until items 1-8 land. No Lab, browser or provider
  run took place.
- The live proof needed is a D-lane or B-lane build where the instruction
  needs a value read on one page and typed on another. The web domain declares
  no data output on `web.dom.extract` (only `extract_list` declares
  `records`), so the most likely live use, "read one value, type it later",
  also needs a downstream output port. That is outside t270's ownership; it
  belongs to `domain/src/output-nodes/definitions.ts`.
- Part runs (`run-flow-part.ts`) and a rerun's put-back (`step-place.ts`) that
  start after the step being read send the reader nothing and fail it
  `core.replay.unresolved_binding`. This is the honest no-fallback rule, but
  it means a part run cannot test a `$step` reader without its source. Not
  exercised by a test of those callers.
- A bound value is withheld from the trace wherever it appears, by the
  existing `withholding.record`, as for every binding. This is not new, but a
  `$step` value (for example a name) will be blanked in traces.
- `docs/reference/framework-reference.md` needs regenerating
  (`pnpm docs:reference`) at integration.

## Open questions or contradictions found

- The brief names `R/nodes/parameter-bindings.ts`, which does not exist. I
  edited `programs/automation-studio/nodes/parameter-bindings.ts`, the file the
  preflight names.
- I chose to resolve the plan key in the executor through node metadata rather
  than rewrite it to the real node id in `flow-bootstrap/adaptation.ts`.
  `adaptation.ts` is outside t270's ownership, and the executor was owned. The
  alternative gives a cleaner persisted form (real node ids, no executor
  change): in `normalizeAutomationStudioFlowBuildPlan`, rewrite
  `$node.<key>.` to `${nodeIds.get(key)}.`. If the supervisor prefers it, it
  is about 8 lines there, and `node-inputs.ts` keeps working for any `$node`
  left over.
- `assemble-draft.ts` existing `stepPositionOf` maps `sN` to `steps[N-1]`
  without checking that the node matches. The new checks use
  `draftStepIdByNodeKey`, which does check. Similarly,
  `draft-from-flow.ts automationStudioFlowDraftPlanNodeIds` assumes `s<index>`
  over proposed steps, which is wrong whenever routing inserts a join or loop
  node. That is pre-existing, belongs to t269-c4's file, and affects which
  node ids an extend keeps.
