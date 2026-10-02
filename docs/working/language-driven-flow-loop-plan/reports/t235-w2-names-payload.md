# t235-W2: names-only catalog on the wire, describedNodes, outputSchema trim (Core)

## Outcome

Partial. Steps 1-5, 7 and 8 are done. Step 6 (the outputSchema trim) is skipped on purpose: the brief's precondition does not hold in Core's source (reason below).

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t235/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime` (R).

- NEW `R/flow-bootstrap/plan/catalog-names.ts`: `automationStudioFlowBootstrapCatalogNames(catalog)` builds `{ "<category>": ["<id>: <description>", ...] }`. It sorts by id with `localeCompare`, the same comparison `catalog.ts` uses. Categories appear in first-appearance order and entries are in id order within each. Each description is kept whole, with whitespace collapsed to single spaces and trimmed. The module is exported from `R/flow-bootstrap/plan/index.ts`.
- `R/flow-bootstrap/plan/contracts.ts`: adds the type `AutomationStudioFlowBootstrapCatalogNames = Record<string, string[]>`. It also adds two optional fields to `AutomationStudioFlowBootstrapContext`: `catalogNames?` and `describedNodes?: AutomationStudioFlowBootstrapCatalogEntry[]`.
- `R/llm/harness/context-packet.ts`: for `evidence_tool_decision` only, the packet's `flowBootstrap` now also carries `catalogNames`. When there are any, it also carries `describedNodes`: the full entries for `describedNodeIds`, in order, with unknown ids and duplicate ids skipped, and the field omitted when empty. `nodeCatalog`, `catalogTruncated` and `catalogSelection` are unchanged. The `flow_bootstrap` packet is unchanged.
- `R/llm/deepseek/request-body.ts`:
  - For an evidence decision, `flowBootstrap` on the wire is now `{startLocation?, startLocationNote?, nodeCatalog: <names>, nodeCatalogNote, describedNodes?}`. The full catalog, `catalogTruncated` and `catalogSelection` are no longer sent.
  - If the packet carries no `catalogNames` (a request assembled by hand), the names are derived from `nodeCatalog` by the same function, so the full catalog never reaches a decision.
  - `nodeCatalogNote` is a constant of 275 characters: "nodeCatalog lists every node by id and what it does, by category. Before first running a node, ask core.describe_nodes for it (several ids at once); its inputs, outputs and parameters then stay in describedNodes for the rest of this build, so never ask for one already there."
  - The one-shot path (`providerFlowBootstrap`) is unchanged apart from dropping its `withRouting` parameter, which only the evidence path ever passed.
  - The ordering comment above `providerUserPayload` now has a paragraph on the names, the note and the append-only `describedNodes`. All three sit in the constant head, before `evidenceLoop`.
- `R/llm/deepseek/request-shape.ts`: `catalog` is now `{form: "whole"|"names", entries, bytes, truncated, described?: {entries, bytes}}`.
  - For an evidence decision with a loop it reports what was sent: the number of name lines, the bytes of the names, and how many described entries there were and their bytes.
  - A one-shot build reports `form: "whole"` with the same numbers as before.
  - `malformedFields` is unchanged; it only reads `catalog.entries` for `flow_bootstrap`.

Tests:
- NEW `R/flow-bootstrap/plan/tests/catalog-names.test.ts` (3 tests). It checks ordering, whitespace collapsing, and that every node of the fixture registry is named exactly once.
- NEW `R/llm/harness/tests/described-nodes.test.ts` (3 tests). It checks:
  - the evidence packet keeps the full catalog and selection and adds `catalogNames`;
  - `describedNodes` is in order, skips unknown ids, and is absent when empty;
  - the `flow_bootstrap` packet keys are exactly `outputSchema, nodeCatalog, catalogTruncated, catalogSelection`.
- NEW `R/llm/deepseek/tests/request-body.test.ts` (4 tests). It checks:
  - the evidence wire keys are exactly `startLocation, startLocationNote, nodeCatalog, nodeCatalogNote, describedNodes`;
  - `nodeCatalog` holds the names, and the note is at most 300 characters and names `core.describe_nodes` and `describedNodes`;
  - the words `catalogSelection` and `catalogTruncated` do not appear anywhere on the wire, and neither does any undescribed entry's JSON;
  - names are derived when absent;
  - the request shape reports the names and described sizes;
  - the one-shot user message is byte-equal to the payload rebuilt the pre-t235 way, and its shape is `form: "whole"`.
- `R/llm/tests/provider-cache-prefix.test.ts`, three changes:
  - Updated: the shared-prefix bound went from 40,000 to 18,000 bytes. With the names-only catalog this fixture's message shrank from about 50.7 KB to about 20.5 KB (measured shared prefix: 20,464). The ratio check (> 0.8) is unchanged. A comment in the test says this.
  - Added: a test where a node is described between two calls. The prefix holds through `nodeCatalog`, `nodeCatalogNote` and the first described node, and the newly described node falls outside it. With the described set then unchanged, the next call shares everything up to the newest result.
  - `loopRequest` takes an optional `describedNodes`.

Step 6, skipped: an "observe" tool without `perCallEffect` **can** become a Flow step, so leaving `add`/`act` off it would not be safe.
- A tool's executor may return `draft` on any execution result; nothing ties that to `perCallEffect`. `readCallRecord` in `evidence-loop-decision.ts` accepts `draft.effect: "mutate"` and `draft.proposes: true` from any tool. `automationStudioLlmEvidenceCallRecord` in `llm/evidence-loop/call-record.ts` takes `effect = declared?.effect ?? tool.effect` and passes `proposes` through.
- In `evidence-loop.ts` `draftRecord`, a step whose call said `add` is kept when `automationStudioFlowDraftStepIsProposable` holds. That is `proposes ?? effect === "mutate"` and `effectApplied !== false` (`flow-draft/step.ts`).
- So an observe-declared tool whose executor reports `proposes: true` or effect `mutate` becomes a kept step on `add`. Removing `add` from that tool's schema variant would take away the model's only way to keep the step in one call.
- In practice, the web domain writes `draft` only from node runs (`core.run_node`, which has `perCallEffect`). No domain observe tool sets it. But the Core contract allows it, and `tool.ts` says that when `draft` is absent "the tool's own declaration stands", which implies it may be present.
- The other precondition does hold. A reply that carries `add`/`act` on an observe tool is parsed the same way as today: `automationStudioLlmEvidenceParseDecision` does not consult the schema, and there is no JSON-schema validation of replies (DeepSeek uses `json_object`). The step stays `taken` because it is not proposable.
- To make the trim safe, Core would first have to ignore `draft.proposes` and `draft.effect` from a tool that is neither `mutate` nor `perCallEffect`, in `readCallRecord` or in `call-record.ts`. That is a contract change for the supervisor to decide on; I made no change.

## Commands run and observed results

- From `packages/fluxiq`: `npx tsc --noEmit -p .` printed nothing and exited 0.
- From `packages/fluxiq`: `npx vitest run <R>/llm <R>/flow-bootstrap` printed `Test Files 169 passed (169)` and `Tests 1944 passed (1944)`.
- From the Core repo root: `node scripts/structure-audit.mjs` printed `structure-audit: passed (216 warning(s), 349 baselined).` and `1 baseline entries can be lowered`. I did not run `pnpm structure:baseline` because the baseline file is not mine. `context-packet.ts` is now 564 lines (533 before). That is an advisory `file-lines` warning only, and it was already over 400.
- Checked that the new tests fail on the old source. I temporarily restored the HEAD versions of `request-body.ts` and `context-packet.ts` with `git show HEAD:... >` and ran the three changed test files: `Tests 5 failed | 16 passed (21)`. I then restored my versions and confirmed with `git diff --stat` (`request-body.ts` +52/-8 overall, `context-packet.ts` +33). `catalog-names.test.ts` cannot run against the old source because the module does not exist there.
- Step 8 measurement, from a scratch vitest file. The decision schema offered `web.detect_repeating_structure`, `web.find_on_page` and `web.describe_element` (observe, with stand-in input schemas), `core.describe_nodes` (its real bundle option, observe) and `core.run_node` (mutate, perCallEffect), with complete and amend both offered and authoring on. Before: 7,896 characters. With `add`/`act` only on `core.run_node`: 6,024 characters. That saves 1,872 characters, 468 per non-step tool. The saving does not depend on the input schemas; the absolute totals do, and the real web schemas are larger.

## Not verified

- No live or Lab run, and no full package suite.
- `R/tests/**` (for example `tests/deepseek-bootstrap-exploration.test.ts` and `tests/service-bootstrap/tests/*`) was not run. A later worker owns it, and tests there that assert the evidence payload's `catalogSelection` or full `nodeCatalog` may now fail.
- The extension repo's domain tests were not run.

## Open questions or contradictions found

- Step 6's precondition fails, as described above. The supervisor needs to decide whether to restrict the `draft` declarations of non-perCallEffect observe tools before trimming `add`/`act`.
- The `core.describe_nodes` input description (W1, `llm/node-tools/describe-nodes.ts`) says "copied exactly from flowBootstrap.nodeCatalog". On the wire, `nodeCatalog` is now a category map of `"<id>: <description>"` lines, so the model has to copy the part before the colon. That still reads correctly, but W1 may want to say "the id before the colon".
- An `evidence_tool_decision` request without `evidenceLoop` still goes through the generic path and sends the whole packet, including `catalogNames`. No caller does this today.
