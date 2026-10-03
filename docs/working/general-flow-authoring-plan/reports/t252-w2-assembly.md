# t252-w2-assembly report

## Outcome

Done. D3's assembly rules are in place in Core (t252 tree), with the tests written first.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/` in
`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`.

- `values.ts`: `authoringParameterValue` now returns text that parses as a `$state` binding
  (`isAutomationNodeParameterStateBinding`) as that object, whatever the declared type. Before this change, a run-node
  step's binding (JSON-stringified by `llm/node-tools/draft-step.ts`) was kept as a literal **string** on a string
  parameter and wrapped as `[binding]` on an array parameter.
- `normalise.ts`: `coerce` passes a binding through untouched. It was also wrapping a non-array in a list (F5).
- `draft-bindings.ts` (new, not published by the barrel): `authoringDraftBindingIssues` checks the assembled plan. It
  finds `$state` bindings at any depth (to depth 16), using the shape alone.
  - Row binding (path `item` or `item.<f>`): refused `flow_draft.row_binding_outside_loop` when the node is not in a
    For Each body. A node is in the body when it can be reached from For Each's `body` port without going back
    through that For Each. A loop that repeats while a check holds has no For Each, so a row binding there is
    refused too.
  - Input (a dotless path with a `fallback`) named `item`, or named the same as an output port id of any definition
    the plan uses: refused `flow_draft.input_shadowed`. Each name is reported once per step.
  - Each issue names its step (`Step N`, path `draft.steps.N`). A node that no step became is named by its node key
    instead.
- `assemble-draft.ts`: runs the binding check on `plan ?? refusedPlan`. It maps node `s<n>` to the n-th routed step's
  `draftStepId`, then to that draft step's position. Any binding issue turns `plan` into `refusedPlan`.
- `index.ts`: the barrel comment now lists `draft-bindings.ts` among the internal modules that are deliberately not
  published.
- `tests/draft-bindings.test.ts` (new, 8 tests):
  - Bindings on a string parameter and on an array parameter (whole value and as an element) come through unchanged,
    and the plan passes `validateAutomationStudioFlowBootstrapPlan` (ok, no errors).
  - Row bindings are refused outside a loop, after the loop, and inside a check-loop. They assemble inside a list
    loop.
  - Inputs named `item` and `records` (when an extract-list node is in the plan) are refused. `records` with no such
    node is allowed.

`plan/validation.ts` did not need changing.

## Commands run and observed results

- With my three source edits reverted to HEAD, the new test failed: `npx vitest run .../authoring/tests/draft-bindings.test.ts`
  -> `6 failed | 2 passed (8)`. The two that passed are the "allowed" cases. My edits were then restored.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests` -> `11 passed (11)` test
  files, `112 passed` tests.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/llm/node-tools`
  -> `78 passed (78)` files, `1177 passed` tests.
- `pnpm --filter fluxiq check` -> exit 2 with 28 TS errors. **All 28 are in the other worker's area**:
  - `runtime/flow-draft/tests/{amendment,binding-forms,binding-render,flow-inputs,step}.test.ts`: `bind`, `instance`,
    `written`, and missing modules `binding-forms.ts`, `binding-render.ts`, `flow-inputs.ts`.
  - `runtime/llm/tests/draft-amendment-feedback.test.ts`: `bind_*` codes.

  Filtering those paths out leaves 0 errors. I fixed none of them, as instructed.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (223 warning(s), 349 baselined)`. The
  authoring directory now holds 19 source files. That is past the 15-file advisory threshold but under the 25-file
  limit.

## Not verified

- Live behaviour, and how this interacts with the other worker's `binding-forms.ts` translation (it does not exist
  yet in this tree).
- The whole Core suite (not run, by rule).
- The real `draft-step.ts` write was not used in the test. A local copy with the same behaviour (JSON-stringify
  objects and arrays) stands in for it, so the test does not import `R/llm`.

## Open questions or contradictions found

- At run time, `item` reaches a node only through its `item` input port (`collectNodeInputs`) or a run variable.
  `draft-routing.ts` wires For Each's `item` only to body steps whose node declares an `item` input. So a row binding
  on a body step whose node declares no `item` input passes this check, but may not resolve at run time. The P3
  walker or a later rule may need to refuse that case.
- Side effect: a written Flow script (`assemble.ts` path) that writes `{"$state":{...}}` as a value now also gets a
  binding rather than a literal string. This is consistent with D3 but applies outside drafts too.
- The For Each id and the `body` port are written as literals in `draft-bindings.ts`, as `draft-routing.ts` does,
  because that module keeps its constants private.
