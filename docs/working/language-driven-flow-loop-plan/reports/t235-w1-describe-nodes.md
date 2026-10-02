# t235-W1: core.describe_nodes and the build's described-node memory (Core)

## Outcome

Done. Everything is in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t235/!FluxIQ`. Nothing was committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## What changed and why

- **NEW `R/llm/node-tools/node-descriptions.ts`**: `automationStudioLlmNodeDescriptions({registry?, resolution})` returns the memory for one build:
  - `ids()` lists the described ids in the order each was first described, each once.
  - `describe(ids)` returns `{described, alreadyDescribed, unknown}`. Duplicates in the input count once. An unknown id is never stored.
  - `has(id)` says whether a node has been described.
  - `definition(id)` returns the catalog entry, whether or not the node has been described.
  - The catalog comes from `buildAutomationStudioFlowBootstrapContext({registry, resolution}).nodeCatalog`. It is built lazily, once, on first use. A test confirms `registry.list` is called exactly once.
- **NEW `R/llm/node-tools/describe-nodes.ts`**: holds `AUTOMATION_STUDIO_LLM_DESCRIBE_NODES_TOOL_ID = "core.describe_nodes"` and `automationStudioLlmDescribeNodesBundle(memory)`.
  - The option is a Core bundle with no `domainId`. It has `effect: "observe"`, `availability: both` and `safety.sideEffect: observe`.
  - Input is `{ids}`: minItems 1, maxItems 64, uniqueItems, the brief's item pattern, and no enum.
  - The answer is a receipt only: `{ok:true, described, alreadyDescribed?, unknown?, shownIn:"flowBootstrap.describedNodes"}`.
  - If every id is unknown, it returns `{ok:false, code:"describe_nodes.unknown_nodes", unknown}`. Malformed input returns `harness_option.input_invalid`. Both use builtin.ts's `rejection()` shape (copied locally, because that helper is not exported).
  - The description is 383 characters.
- **`R/llm/node-tools/index.ts`**: exports both new files.
- **`R/llm/harness-options/binding.ts`**: `automationStudioHarnessOptionRegistry` takes an optional `nodeDescriptions`. When it is given and run_node is offered:
  - It wraps the run_node implementation with `describingFailures` and registers the describe bundle as a second Core bundle.
  - Without a memory, or without `runsNodes`, nothing changes. Tests cover both cases.
- **What counts as a failed call.** I used the loop's own definition (`R/llm/evidence-loop.ts` around 711, `refusedCall`): the evidence object has `ok === false`, whether returned bare or inside an execution result. A thrown call also counts (`decision-handlers/failed-call.ts`).
- **What the decorator does on a failure.** It only acts when the failed call names a node the catalog knows:
  - **First failure for a node:** the node is added to memory and the evidence gets `described: "<id> is now in flowBootstrap.describedNodes"`.
  - **Node already described:** the evidence gets a pointer instead, `definition: "<id> is in flowBootstrap.describedNodes"`.
  - **Undeclared parameters:** in either case, if `parameters` has keys the definition does not declare, the evidence also gets `undeclaredParameters: [...]`.
  - **Thrown call:** the node is added to memory and the error is rethrown. This is skipped if the call was aborted.
  - Added keys never overwrite keys the domain already set.
- **What the decorator leaves alone.**
  - A successful call is returned as the same object.
  - Calls carrying `AUTOMATION_STUDIO_NODE_REPLAY_KEY` pass through untouched. These are Core's own dry-run replays and verifies, and the `<callId>.place` reset before a rerun.
  - Nothing is refused before a call runs.
- **amend_draft rerun is covered.** I checked the code: `evidence-loop.ts` around 572-584 turns the rerun into an ordinary run_node decision, and line 668 sends it through the same `input.executeTool`. In the service, that path goes routing.recording → personNeeded → permissions → harnessOptions.executeTool → registry → the wrapped implementation.
- **`R/llm/node-tools/run-node.ts`**: the DESCRIPTION is rewritten. It went from **1,990 to 1,490 characters**. The input schema JSON (one node) went from 678 to 753.
  - **Added:** the two-step pattern. The model picks a name from `flowBootstrap.nodeCatalog`, then calls `core.describe_nodes` once for every node it is about to use, unless the node is already in `flowBootstrap.describedNodes`, then gives exactly the declared parameters.
  - **Dropped:** the interpolated list of consequence classes (the enum already carries it), the add/amend_draft sentence (`add` in `evidence-loop-decision.ts` describes it), and "becomes a step ... never write it down again". That last one contradicted the add rule. A short "A step you add keeps the parameters it ran with" replaces it.
  - **Kept:** handles not locators, lists by the detection handle, never act on a check, judge this node not the Flow (filter/checkout `[]` versus `send_or_publish`), and "only reads".
  - **Property descriptions:** "is put to the person first" moved into the `consequences` description. `node` now points to `flowBootstrap.nodeCatalog` and `parameters` to `flowBootstrap.describedNodes`.
- **`R/service.ts`**: still 4,491 lines. No line was added.
  - Line 90 adds `AUTOMATION_STUDIO_LLM_DESCRIBE_NODES_TOOL_ID` and `automationStudioLlmNodeDescriptions` to the existing `./llm/index.ts` import.
  - Line 1545 creates the memory in the same `const` statement as `harnessOptions` and passes it to the registry.
  - Line 1598 passes `describedNodeIds: nodeDescriptions.ids()` in the evidence decide call's `flowBootstrap`. The single-reply `flow_bootstrap` call at 1644 is left as it was.
  - Repair rounds of one build share `harnessOptions`, so they share the memory too. A refuted-result repair is a separate call of `generateFlowBootstrapAdaptationInternal`, so it is a new build and starts with an empty memory.
- **Page captures (step 5): yes, a describe call did trigger them, through both paths.**
  - **`routing.recording`:** a describe call set `ranSinceObserved`. Because it carried no `routeState`, the next decision called `observeRouteState`, which is a whole page capture. If the call came before the free first look, it also took the look's place for reading the start.
    - Fix in `R/route-state/build-routing.ts`: a new optional `pageless` tool-id list. A call of one of those tools passes straight through and records nothing.
    - The service passes `pageless: [AUTOMATION_STUDIO_LLM_DESCRIBE_NODES_TOOL_ID]` on its existing line 1536.
    - I used a parameter rather than an import so route-state does not import a value from llm, which could close a module cycle.
  - **State-digest hook:** for a binding without `stateDigestsOnCalls`, the hook captured on both sides of every call. The web domain sets `stateDigestsOnCalls`, so it was unaffected.
    - Fix in `R/service/flow-bootstrap-commands/state-digest.ts`: the hook returns `undefined` for `core.describe_nodes` without capturing.
- **Tests:**
  - New: `node-tools/tests/node-descriptions.test.ts` (5) and `node-tools/tests/describe-nodes.test.ts` (5).
  - `harness-options/tests/binding.test.ts`: a new describe block with 7 tests.
  - `node-tools/tests/run-node.test.ts`: added a ≤1,500 cap and tests for the two-step teaching, the enum-only classes and the kept rules. I replaced the "names every consequence class" test because the brief drops that prose.
  - One test each added to `route-state/tests/build-routing.test.ts` and `service/flow-bootstrap-commands/tests/state-digest.test.ts`.

## Commands run and observed results

- `npx tsc --noEmit -p .` (from packages/fluxiq): the first run had 1 error in binding.ts (evidence narrowing), which I fixed. The final run printed nothing (exit 0).
- `npx vitest run R/llm/node-tools R/llm/harness-options R/route-state R/service/flow-bootstrap-commands/tests/state-digest.test.ts` → `Test Files 20 passed (20)`, `Tests 205 passed (205)`.
- **Tests fail on old source:**
  - I temporarily removed the skip lines in build-routing.ts and state-digest.ts. Both new tests then failed (2 failed / 10 passed). I restored the files from a byte copy and checked the restore with grep.
  - The other new tests import modules or parameters that did not exist before. The run-node ≤1,500 cap fails at the old 1,990.
- `node scripts/structure-audit.mjs` (Core root) → `structure-audit: passed (216 warning(s), 349 baselined)`, plus "1 baseline entries can be lowered", which I did not trace to its file.
  - New advisory warnings: binding.ts at 507 lines (it was already past 400 at 425) and build-routing.test.ts at 417 (was 396).
- `wc -l R/service.ts` → 4491.
- Measured with a scratch vitest: run_node description 1,490 characters (old 1,990), describe description 383, describe schema JSON 309.

## Not verified

- No Lab or live run, per the brief. Nothing confirms that the model actually describes before use, or what the receipt and pointer cost in tokens.
- How W2 renders `flowBootstrap.describedNodes`. I only supply `describedNodeIds`.
- I did not run the whole loop end to end with a rerun through amend_draft. That path is covered by code reading only.
- I did not trace which baseline entry the audit says can be lowered.

## Open questions or contradictions found

- **Line endings.** The Core worktree checks out with CRLF (`core.autocrlf=true`). I converted the new files to CRLF to match.
- **A different id spelling in a failed call.** The pointer for a failed call uses the id as the model wrote it. If a domain resolves aliases, an alias the catalog does not hold is neither described nor pointed to.
- **Where the decorator lives.** It is in binding.ts as a private function, so binding.ts is now 507 lines. A focused file such as `node-tools/failure-description.ts` would be cleaner, but no such file was listed among the paths I own.
- **Other Core options also cause captures.** `core.flow_graph` and the other Core observe options trigger the same routing and digest captures today. The `pageless` list could take them too. I left that out of scope.
