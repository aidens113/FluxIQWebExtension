# t188-A1 report: Flow Bootstrap plan limits read the Flow size setting (Core)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t188/!FluxIQ`, branch `task/t188-node-limits`.
P = `packages/fluxiq/src/programs/automation-studio`.

## Outcome

Done. No fixed node, edge, depth or byte cap remains in Flow Bootstrap's plan
module. The parser, validator, both profile checks, the output and completion
schemas, and the bootstrap context all take the Flow's size bounds. When no
size is passed they fall back to the default setting of 100. A refusal over a
size bound names `flowSizeSettings.maxNodesPerSubflow`, its label and its
value. The brief's vitest set passes (12 files, 161 tests), and package
`tsc --noEmit` exits 0.

## What changed and why

### `P/runtime/flow-bootstrap/plan/limits.ts`
- Removed from `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS`: `maxNodesPerSubflow`,
  `maxEdgesPerSubflow`, `maxTotalNodes`, `maxTotalEdges`, `maxGraphDepth`,
  `maxPlanBytes`.
- Removed from `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_LIMITS`:
  `maxResultBytes`, `maxNodesPerSubflow`, `maxEdgesPerSubflow`.
- All other fields are unchanged. The header comment now says that no bound here
  counts nodes, edges, depth or bytes, and why.

### `P/runtime/flow-bootstrap/plan/size-limits.ts` (added to it; the existing derivation is untouched)
- `type AutomationStudioFlowBootstrapSizeSetting = { path; label; value }`
- `automationStudioFlowBootstrapSizeSetting(size): AutomationStudioFlowBootstrapSizeSetting`
- `automationStudioFlowBootstrapSizeRefusal(measured: string, limit: keyof AutomationStudioFlowBootstrapSizeLimits, size): string`
  - For the setting itself: `"Subflow has 101 nodes; this Flow allows 100 (flowSizeSettings.maxNodesPerSubflow, Flow Settings > Maximum nodes per Subflow)."`
  - For a derived bound: `"Subflow has 201 edges; this Flow allows 200, derived from flowSizeSettings.maxNodesPerSubflow = 100 (Flow Settings > Maximum nodes per Subflow)."`
- Another lane added `automationStudioFlowBootstrapSizeLimitsOfContext` to this
  file while I worked. I left it as it is.

### New signatures (every `size` is optional and defaults to `automationStudioFlowBootstrapSizeLimits()`)
- `parseAutomationStudioFlowBootstrapPlan(value: unknown, size?: AutomationStudioFlowBootstrapSizeLimits)`
- `validateAutomationStudioFlowBootstrapPlan({ plan, registry?, resolution, size? })`: passes `size` to the parse, and the depth check reads `size.maxGraphDepth` through `ValidationScope.size`.
- `automationStudioEvidenceFlowBootstrapLimitsExceeded(value, source = "reply", size?)`
- `isAutomationStudioEvidenceFlowBootstrapResultWithinLimits(value, size?)`
- `buildAutomationStudioFlowBootstrapContext({ ..., size? })`
- `automationStudioFlowBootstrapOutputSchema(size?)`: nodes `maxItems = size.maxNodesPerSubflow`, edges `maxItems = size.maxEdgesPerSubflow`.
- `automationStudioEvidenceFlowBootstrapCompletionSchema(size?)`: `flow.maxLength = size.maxResultBytes`.
- `automationStudioEvidenceFlowBootstrapDraftCompletionSchema(_size?)`: the result does not depend on size (see Open questions).
- `automationStudioFlowBootstrapCatalogByteBudget({ maxInputTokens, instructionBytes, size? })` in `plan.ts`: counts the bytes of the schema built for that size.
- `AutomationStudioFlowBootstrapLimitExceeded` has a new optional field, `setting?: AutomationStudioFlowBootstrapSizeSetting`.

### Where size is read
- **parsing.ts**
  - `bootstrap.invalid_nodes` and `bootstrap.invalid_edges` now have two messages:
    - an empty or non-array Subflow keeps the old message;
    - a Subflow over the bound gets the refusal sentence that names the setting.
  - `bootstrap.too_many_nodes`, `bootstrap.too_many_edges` and `bootstrap.plan_too_large` read `size` and name the setting.
  - All issue codes are unchanged. None of them appears anywhere in the web-extension tree (grep of `.ts`/`.mjs`).
- **validation.ts**: `bootstrap.graph_too_deep` reads `size.maxGraphDepth`, and its message is `"Subflow is N nodes deep; this Flow allows M, derived from …"`.
- **profile-limits.ts**
  - Reply and draft profiles both bound nodes and edges by `size.maxNodesPerSubflow` and `size.maxEdgesPerSubflow`.
  - Reply bytes are bounded by `size.maxResultBytes`, draft bytes by `size.maxPlanBytes`.
  - Every limit that comes from the setting carries `setting`.
  - Subflow, rule, route-tag, name, summary and parameter bounds are as before.
- **output-schema.ts, evidence-schema.ts**
  - The schemas are now functions of size.
  - `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_OUTPUT_SCHEMA`, `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA` and `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_DRAFT_COMPLETION_SCHEMA` are kept, each equal to the default-size result.
  - Their values therefore changed: nodes 64→100, edges 128→200, `flow.maxLength` 12,000→102,400.
- **catalog.ts**
  - `outputSchema` is `automationStudioFlowBootstrapOutputSchema(size)` when `size` is given. Otherwise it is the constant, as the same object.
  - A context also carries `maxNodesPerSubflow` when `size` is given and is not the default. The brief did not ask for this. I added it because another lane added the optional `maxNodesPerSubflow` field to `AutomationStudioFlowBootstrapContext` in `contracts.ts`, and its doc comment says `./catalog.ts` sets it. `automationStudioFlowBootstrapSizeLimitsOfContext` reads it in the DeepSeek preflight, output-schema and response-envelope code.
  - Without the field, preflight would rebuild the default schema, compare it to a sized context's schema, and refuse every non-default Flow. A default Flow's context is unchanged.
- **Instruction text**: nothing in these files states a node count. `flow-script-format.ts` and `issue-feedback.ts` were checked; the only 16 in `issue-feedback.ts` is its feedback issue count.

### `MAX_ACT_CLAIMS = 16` (evidence-schema.ts): kept
It bounds the `acts` array of the draft completion. That array holds one claim for each act the instruction asks for (a save, an add to cart, a post), naming the draft step that does it. It does not count Flow steps, so it does not grow with the setting. The comment now says so. `step.maxLength: 16` is the length of a step-id string such as `d7`, not a count.

### Tests
- New: `P/runtime/flow-bootstrap/plan/tests/size-limits.test.ts` (4 tests)
  - derivation at 100, 150 and 1;
  - the largest limits equal size(1000);
  - `...SizeLimitsOf` reads metadata, and falls back to the default when the value is missing or invalid;
  - the exact refusal sentences.
- New: `P/runtime/flow-bootstrap/plan/tests/flow-size.test.ts` (10 tests)
  - Plans use the web domain's real definitions with realistic parameters: navigate URL, selectors, typed text, select values, `expectedState` conditions, `timeoutMs`.
  - At the default, a 100-node branched Subflow (99 edges on success and failure ports) and a straight 100-node chain both parse, validate, and pass the reply and draft profiles.
  - 101 nodes (chain and branched) is refused by parse (`bootstrap.invalid_nodes` with the exact message naming the setting and 100), by validate, and by both profiles (with `setting`).
  - With size(150), 150 is accepted and 151 is refused naming 150. With size(20), 20 is accepted and 21 is refused naming 20.
  - Derived-bound messages are checked for edges and depth.
  - The output schema's maxItems and the completion schema's maxLength at 100 and 150 are checked, and the draft schema does not depend on size.
  - The constants equal the default-size results.
  - The context's outputSchema follows size, and the context carries `maxNodesPerSubflow` only when it is not the default; `…SizeLimitsOfContext` round-trips it.
- Updated `P/runtime/flow-bootstrap/tests/plan.test.ts`:
  - the first-live catalog budget is pinned at 5,117 (was 5,118; the schema is one byte longer because "100" replaces "64");
  - schema nodes and edges maxItems are 100 and 200;
  - the depth test builds a 17-node chain. At the default, that chain does not raise `graph_too_deep`; with `{...size(), maxGraphDepth: 16}` it does;
  - the plan-bytes test reads `automationStudioFlowBootstrapSizeLimits().maxPlanBytes`.
- Updated `P/runtime/flow-bootstrap/plan/tests/profile-limits.test.ts`:
  - 16/17 became 100/101, with `setting`;
  - 30 steps passes the reply profile as well as the draft;
  - 101 is refused in a draft;
  - a draft at size(20) is refused at 20.

### `P/runtime/llm/harness-options/tests/bootstrap-completion.test.ts` (it pinned 16/17), every change
- Old lines 398–405, the test "names the limit a result is over, its maximum and the actual value":
  - it now builds a 5-Subflow reply and expects `{ limit: "maxSubflows", max: 4, actual: 5, path: "plan.subflows" }` in `limitsExceeded`;
  - it previously built a 17-node Subflow and expected `maxNodesPerSubflow` 16/17.
  - Reason: the parse and the profile check now share the node bound, so a node count over it is refused by the parse (`evidence_completion_plan_invalid`) before the profile check runs. The profile check only names reply-shape limits now.
  - I added a 3-line comment above the test.
- New test, "refuses a Subflow over the Flow's size setting, naming the setting and its value":
  - 101 nodes produces `flow_bootstrap.evidence_completion_plan_invalid`;
  - `verdict.issues` messages contain the exact setting sentence.
- Nothing else in `runtime/llm/**` was edited.

## Commands run and observed results

- `cd packages/fluxiq && npx vitest run <brief's three paths> --maxWorkers=2`
  - Refused by vitest: `RangeError: options.minThreads and options.maxThreads must not conflict`, no tests ran.
  - Rerun with `--minWorkers=1` added.
- The brief's set with `--maxWorkers=2 --minWorkers=1`:
  - before the test updates: 7 failed, 139 passed, all failures on the old pins;
  - after the updates: **12 files passed, 160 tests passed**;
  - after the catalog `maxNodesPerSubflow` change: **12 files passed, 161 tests passed**.
- A throwaway probe test, `llm/harness-options/tests/t188a1-probe.test.ts`, checked which check refuses 17 unknown parameters, 101 nodes and 5 Subflows. It was deleted afterwards.
- `npx tsc --noEmit` (packages/fluxiq), first run: build slot b2 claimed by hand (b1 was held by t187), slot-1 absent.
  - Exit 2, with one error, in another lane's `runtime/service/flow-settings/tests/flow-size-settings.test.ts(13,3)` (TS2375 metadata exactOptionalPropertyTypes).
  - b2 released right after.
- `bash build-slots/heavy.sh "t188-A1 fluxiq tsc" npx tsc --noEmit`, final run: it held b2 and released it. **Exit 0, no errors.**
- `node scripts/structure-audit.mjs` (Core):
  - only advisory warnings touch my files: `plan/` has 24 source files against a 15-file advisory; `validation.ts` is 498 lines and `catalog.test.ts` 523 lines, against a 400-line advisory;
  - 3 FAILs, all in files I do not own: `api/handlers/flows.ts` failure-as-empty, `runtime/service.ts` failure-as-empty 17 against a baseline of 16, and a naming failure in `apps/web/.../settings/` "flow-".
- Wider run: `npx vitest run runtime/flow-bootstrap runtime/llm runtime/tests/service-bootstrap --maxWorkers=2 --minWorkers=1`
  - first run: 4 failed / 1476 passed;
  - after the catalog change, `llm` and `service-bootstrap` only, with `--testTimeout=60000`: 2 failed / 766 passed. Both are listed under Open questions.
  - The earlier `adaptation.test.ts` "bridges a generated proposal ID…" failure was a 15s timeout. Run alone with `--testTimeout=60000` it passes, in 32s, while the machine was loaded (collection alone took 52s).
- `grep` confirms nothing under `packages/fluxiq/src` reads a removed field any more.

## Not verified

- Live provider behaviour: DeepSeek preflight and real replies with a non-default size. Only unit tests exercised this.
- Whether a real 100-node reply fits the provider's output-token budget. The byte bound allows 102,400 bytes, but the provider's token limits are separate.
- Core `pnpm check` and `pnpm test` as a whole, and the web extension. No Lab or browser runs.
- I did not investigate why `adaptation.test.ts` "bridges a generated proposal ID…" took 32s. It passes at 60s, but I cannot say whether it was already slow before t188.

## Open questions or contradictions found

1. **The feedback the model sees drops the setting-naming message.** For a parse refusal, `checkAutomationStudioFlowBootstrapCompletion` puts the message in `verdict.issues`. But `verdict.check.feedback.issues` has only `{code, path}`: the probe showed `{"code":"bootstrap.invalid_nodes","path":"plan.subflows.0.nodes"}`. So the model is not told the setting or its value on a node-count refusal. The profile path does carry it, through `limitsExceeded[].setting`. If the model should see it, the fix belongs in `flow-bootstrap/plan/issue-feedback.ts` (which is mine by directory but was not listed in the brief) or in `bootstrap-completion.ts` (`runtime/llm/**`). Supervisor's call.
2. **Another lane's `P/runtime/tests/service-bootstrap/tests/rejections.test.ts` "evidence profile limits" row fails because of this change's design.**
   - The row sends `maxNodesPerSubflow + 1` = 101 nodes and expects `evidence_completion_profile_limit_exceeded`.
   - The parse now holds nodes to the same bound as the profile check, so it refuses first with `evidence_completion_plan_invalid` / `bootstrap.invalid_nodes`.
   - Fix in that file: either send a reply-shape violation, such as 5 Subflows, each of the 4 non-primary ones with role `utility` (as `bootstrap-completion.test.ts` now does), or expect `plan_invalid` / `bootstrap.invalid_nodes`.
3. **Another lane's `P/runtime/tests/service-bootstrap/tests/flow-size.test.ts` "refuses to apply a proposal the Flow's setting was lowered beneath" fails** with `FLOW_BOOTSTRAP_STALE: Flow dependencies changed…` instead of a message naming `flowSizeSettings.maxNodesPerSubflow`. Changing the setting changes the dependency digest, so the stale check at `service.ts:3600` throws before validation at `service.ts:3605` runs. This is in `runtime/service.ts`, which the brief told me not to touch, not in the plan module.
4. **The draft completion schema has no size-dependent field.** The brief said both completion schemas take "result maxLength". The draft schema has no result field (it takes `summary` and `acts` only, with `additionalProperties: false`), so `automationStudioEvidenceFlowBootstrapDraftCompletionSchema(size)` returns the same schema for every size. I did not invent a field. The service lane's test at `flow-size.test.ts:178` was rewritten meanwhile to check `context.maxNodesPerSubflow` and the context's outputSchema instead, and it passes.

### Call sites in `runtime/llm/**` and `runtime/service.ts` that should pass `size`

Other lanes had already threaded most of them when I checked (current line numbers):

| Call site | What it passes | Status |
| --- | --- | --- |
| `llm/deepseek/output-schema.ts:59` | `automationStudioFlowBootstrapOutputSchema(automationStudioFlowBootstrapSizeLimitsOfContext(request.context.flowBootstrap))` | done (needs catalog's `maxNodesPerSubflow`, now present) |
| `llm/deepseek/preflight.ts:89` | `automationStudioFlowBootstrapOutputSchema(…SizeLimitsOfContext(bootstrap))` | done |
| `llm/deepseek/response-envelope.ts:90` | `parseAutomationStudioFlowBootstrapPlan(structured.plan, …SizeLimitsOfContext(request.context.flowBootstrap))` | done |
| `llm/harness/context-packet.ts:240-243` | `buildAutomationStudioFlowBootstrapContext({ …, size: input.flowBootstrap.size })` | done |
| `llm/harness/context-packet.ts:250` | `automationStudioFlowBootstrapCatalogByteBudget({ …, size: input.flowBootstrap.size })` | **not passed**. Should pass `size` so the catalog budget counts the sized schema. The difference is a few bytes, absorbed by the 1,800-byte reserve. |
| `llm/harness/output-validation.ts:23` | `validateAutomationStudioFlowBootstrapPlan({ …, size: flowBootstrap.size })` | done |
| `llm/harness/provider-result.ts:34,73` | `parseAutomationStudioFlowBootstrapPlan(value.plan, size)` from `flowBootstrap?.size` | done |
| `llm/harness-options/bootstrap-completion.ts:236,243,317` | `input.size` to parse, profile and validate | done |
| `service.ts:1525` | `const size = automationStudioFlowBootstrapSizeLimitsOf(parent)` | done |
| `service.ts:1529-1531` | `buildAutomationStudioFlowBootstrapContext({ …, size })` | done |
| `service.ts:1534` | `automationStudioFlowBootstrapCatalogByteBudget({ …, size })` | **not passed**, same reason as `context-packet.ts:250` |
| `service.ts:1580` | `automationStudioEvidenceFlowBootstrapDraftCompletionSchema(size)` | done (size-independent) |
| `service.ts:1592` | `checkAutomationStudioFlowBootstrapCompletion({ …, size })` | done |
| `service.ts:1665, 1760, 3606` | `validateAutomationStudioFlowBootstrapPlan({ …, size })` | done |
