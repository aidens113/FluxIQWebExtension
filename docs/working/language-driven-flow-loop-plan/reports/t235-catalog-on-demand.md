# t235-catalog-on-demand report

Lead report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t235/!FluxIQ` (branch `task/t235-catalog-on-demand`, base Core dev `baefb753`); downstream worktree `C:/Users/osrs_/FluxStuff/fxwork/t235/!FluxIQWebExtension` (same branch). Nothing committed. Core paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/` unless they start with `docs/` or `scripts/`.

## Status

Done; not committed. The supervisor still has to commit, merge dev into both task branches, and merge Core first (Core-paired). Core dev has moved since the base (`baefb753` -> `5c981e82`: F31, describeCall); see the overlap note under "Briefs and assignments".

## Findings (before any change)

- **Evidence.** Earbuds step `0003-decide` (`lab-runs/2026-10-01/run-muqbzu32-8691a65e`): user message 58,547 chars, of which `context.flowBootstrap.nodeCatalog` is 41,122 (59 entries), `outputSchema` 6,797, `context.evidenceLoop.tools` 6,082 (detect_repeating_structure 2,091, find_on_page 1,285, describe_element 642, run_node 2,059), `context.routing` 2,571, system prompt 3,669.
- **Where the catalog reaches a model.** Only through `llm/harness/context-packet.ts` (`buildAutomationStudioFlowBootstrapContext`), for two task kinds set in `service.ts` `generateFlowBootstrapAdaptationInternal`: the evidence-guided build loop (`evidence_tool_decision`; explore round, up to two repair rounds; re-author builds go through the same path) and the one-shot `flow_bootstrap` (one call, no tools; reached only from the API without `evidenceGuided`). Recovery exploration, diagnosis, patch, verification, the instruction-authority call and the result check carry no catalog.
- **Cache reality in that run.** Cache hits per decide stay at 12-25K tokens while misses climb to 47.7K (step 32: 72,677 in, 24,960 hit). The hit size is the system prompt plus the constant head (instructions and catalog); the prefix breaks inside the evidence window, where an earlier page view is replaced by its `supersededBy` stub. So after the first call the catalog was billed mostly at the cache-hit rate, and the misses come from the window. Removing it still cuts every request by about 36 KB and the first call's miss by about 10K tokens, but the per-call miss growth is window churn (lane B territory), not the catalog.
- **Consequence for the design.** Described definitions go in the constant head as `flowBootstrap.describedNodes` (append-only, build-scoped), not in the evidence window: anything in the window after the first superseded view is billed uncached on every later call, while the head is cached between describes.
- **Line budgets.** `service.ts` 4,491 = baseline (no headroom); `llm/evidence-loop.ts` 770 of 800. `llm/`, `llm/harness/`, `llm/evidence-loop/` are at 25 files; `flow-bootstrap/plan/` has 24; `llm/node-tools/` has 8.
- **Validation per call.** The domain resolves run_node parameters (`domain/src/runtime/llm-evidence/node-run/run.ts`); Core checks parameters against the definition only at completion (`flow-bootstrap/plan/validation.ts`). Neither reads what the model was shown, so validation is unchanged by a names-only catalog.
- **Merge note.** `git merge dev` in the downstream worktree is blocked for leads by the hook ("workers must not change git history"); the branch is 5 commits behind dev (lane D's F41). The supervisor must run it.

## Design

1. Evidence decisions carry `flowBootstrap.nodeCatalog` as names only: `{<category>: ["<id>: <description>", ...]}` (the description is one line already); `catalogTruncated` and `catalogSelection` are dropped from that payload (bookkeeping, never read by the evidence preflight). The one-shot `flow_bootstrap` keeps the whole catalog: it is one call with no tools, so it has no second request to describe in.
2. `core.describe_nodes` (`{ids: string[]}`, observe-only, Core-owned) adds the ids to a build-scoped memory and answers with a short receipt; from the next request on, those nodes' full entries ride in `flowBootstrap.describedNodes`, in the order first described, each once. Repair rounds of the same build keep them.
3. A failed `core.run_node` call (including an `amend_draft` rerun, which runs through the same tool) for a library node not yet described adds that node to the memory and says so on the refusal, with any parameter keys the definition does not declare. Nothing new is refused before a call; an undescribed correct call just runs.
4. `outputSchema`: the `add`/`act` properties go only on tool variants that can become a step (not observe-only looks). `core.run_node`'s description is rewritten to teach the two-step pattern and to drop sentences that repeat its schema.

## Briefs and assignments

- **Lead, before dispatch:** added `flowBootstrap.describedNodeIds?: readonly string[]` to the harness input (`llm/harness/task-request.ts`) as the contract between W1 and W2.
- **W1 (worker-high), done:** `llm/node-tools/node-descriptions.ts` (build-scoped memory), `llm/node-tools/describe-nodes.ts` (`core.describe_nodes`, receipt only), run_node failure wrapper, `run-node.ts` description 1,990 -> 1,490 chars, `service.ts` wiring on existing lines (4,491 lines, unchanged), and `pageless` skips so a describe costs no page capture (`route-state/build-routing.ts`, `service/flow-bootstrap-commands/state-digest.ts`). Report: `t235-w1-describe-nodes.md`.
- **W2 (worker), partial by design:** `flow-bootstrap/plan/catalog-names.ts`, packet `catalogNames`/`describedNodes` (`llm/harness/context-packet.ts`), wire payload names + `nodeCatalogNote` + `describedNodes` with no full catalog or `catalogSelection` (`llm/deepseek/request-body.ts`), `request-shape.ts`. Skipped dropping `add`/`act` from observe tools: `readCallRecord` accepts a draft statement proposing a step from any tool, so an observe tool's call can still become a step. Report: `t235-w2-names-payload.md`.
- **Lead integration edits (after the supervisor's note that dev's F31 and describeCall touch `binding.ts`, `run-node.ts`, `request-body.ts`, `service.ts`):**
  - moved W1's wrapper out of `binding.ts` into `llm/node-tools/describing-failures.ts`, so `binding.ts` carries only an import, the `nodeDescriptions` input and six lines of registration;
  - reverted the run_node `node` property description to its base wording, which sits three lines from F31's hunk;
  - fixed `context-packet.ts`, where `withNamesAndDescribed` had been inserted between `packRoutingContext` and its doc comment;
  - `describe_nodes` `ids` description now says the id is the part before the colon;
  - `llm/evidence-loop-decision.ts`: `add`/`act` stay on every tool variant, but their descriptions appear only on the first variant that can act (the run_node one), with a bare `{type}` pair on the others. New test `llm/tests/evidence-loop-decision.test.ts` fails 3 of 4 on the base source.
- Dev overlap checked with `git diff baefb753 dev`: F31 changes `binding.ts` (`runNode` construction, two lines above our register block), `run-node.ts` (signature and `initialObservation`), `request-body.ts` (`FLOW_START_LOCATION_NOTE`, three lines below our insertion), `evidence-loop-decision.ts` (`validTools`, far from ours), `service.ts` line 1566 (not ours). Each is separated from our hunks by unchanged lines.

## Validation

- `npx tsc --noEmit -p .` (packages/fluxiq) after the lead edits: no output, exit 0.
- `npx vitest run runtime/llm runtime/flow-bootstrap runtime/route-state runtime/service/flow-bootstrap-commands`: 175 files, 1 failed (`run-node.test.ts` asserting the reverted `node` wording; assertion removed). After the fix, `evidence-loop-decision.test.ts` + `run-node.test.ts`: 12 passed.
- Baseline note: a baseline over the touched folders ran while W1 was editing. It showed 5 failures: `tests/deepseek-bootstrap-exploration.test.ts` x2 (`revealed` 6 vs 3 at line 493, before any payload change) and `tests/service-bootstrap/tests/adaptation.test.ts` x3 (15,000 ms timeouts under load; they pass in every later run).
- **Lead, test placement fix.** The new `llm/tests/evidence-loop-decision.test.ts` made `llm/tests/` 26 files, and the audit failed on `directory-files`. Its four cases moved into `llm/evidence-loop/tests/authored-draft.test.ts`, which already tests the authoring schema.
- **W4 (worker-high), runtime tests.** The 10 `deepseek-bootstrap-exploration` failures were the test's stub calling `.flatMap` on the now names-only `nodeCatalog`; the throw surfaced as `llm.provider_network_error`. W4 fixed the stub and changed no assertion. Report: `t235-w4-runtime-tests.md`.
- **5 remaining failures predate this task.** All come from the t195 F43 build judge (`4f78cadc`) making an extra `loop_verification` call:
  - `deepseek-bootstrap-exploration` "asks again after a malformed decision..." and "...reaches its deadline": `revealed` 6 vs 3, already in my early baseline.
  - `refuted-result/tests/reauthor-service.test.ts` x2 and `refuted-result/tests/repair-replay-chain.test.ts` x1: I confirmed they fail the same way on the untouched main Core checkout (dev `82a47a68`): `npx vitest run .../reauthor-service.test.ts .../repair-replay-chain.test.ts` gave "Tests 3 failed | 5 passed (8)".
- **Final Core checks, on the final tree.** All from `packages/fluxiq` unless noted:
  - `npx tsc --noEmit -p .`: no output, exit 0.
  - `npx vitest run runtime/llm runtime/flow-bootstrap runtime/recovery runtime/route-state runtime/service/flow-bootstrap-commands runtime/tests/service-bootstrap runtime/tests/deepseek-bootstrap-exploration.test.ts runtime/tests/llm-deepseek-flow-bootstrap.test.ts runtime/tests/refuted-result`: "Test Files 3 failed | 241 passed (244)", "Tests 5 failed | 2653 passed (2658)". The 5 are exactly the ones above.
  - `node scripts/structure-audit.mjs` (repo root): "passed (216 warning(s), 349 baselined)". Its "1 baseline entries can be lowered" also appears on the untouched dev checkout, so it is not ours.
  - `node scripts/docs-reference.mjs --check`: "Deterministic framework reference is current." W5 regenerated it once with `pnpm docs:reference`.
  - `wc -l`: `service.ts` 4,491 (= baseline), `llm/evidence-loop.ts` 770 (untouched).
- **New tests fail on the old source.**
  - W1's tests import modules that did not exist before.
  - W2 swapped the old `request-body.ts` and `context-packet.ts` back in: 5 of its changed tests failed.
  - The authoring-schema cases: 3 of 4 fail with the base `evidence-loop-decision.ts`. The fourth ("offers neither where the model does not author") is a guard that holds on both.
- **W5, docs.** Core: `docs/architecture/automation-studio/llm-flow-bootstrap.md` (new subsection "The catalog an evidence decision is shown"), `docs/architecture/package-boundaries.md`, regenerated `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`. Downstream: `docs/architecture/testing-facility.md`. Report: `t235-w5-docs.md`.
- **W7, downstream (t235 Core libs rebuilt; downstream resolves `fluxiq` from `fxwork/t235/!FluxIQ`).** Report: `t235-w7-downstream.md`.
  - `pnpm --filter @fluxiq-web-extension/domain check` and `pnpm --filter @fluxiq-web-extension/extension check`: exit 0.
  - Scoped domain tests (`domain/src/tests/domain.test.ts` plus `domain/src/runtime/llm-evidence/**/tests`): 601 pass, 0 fail.
  - 14 test-runner files that read the catalog or tool ids, including the existing-fluxiq-control `toolIds.length` check: 167 pass, 0 fail.
  - Downstream `node scripts/structure-audit.mjs`: passed.
  - No downstream source or test needed a change.

## Measurements

The earbuds `0003-decide` request was re-rendered through the new code (W6's script, which I re-ran). Script: `<scratchpad>/measure/measure-t235-w6.mts`, run as `node --experimental-transform-types --no-warnings <script>` from `packages/fluxiq`. Column (a) is that request as recorded, with nothing described. Column (b) is the same request with four nodes described: browser-navigate, dom-type, dom-click and dom-extract_list. Every part this task did not change comes out byte-equal to the recording: system prompt, instructions, routing, evidence, start location and note, web tool entries, and the complete variant.

| chars | before | (a) | (b) |
|---|---:|---:|---:|
| whole wire body | 70,148 | 26,865 | 32,709 |
| user message | 58,547 | 21,846 | 27,066 |
| flowBootstrap | 41,646 | 5,354 | 10,574 |
| - nodeCatalog | 41,122 | 4,662 (names) | 4,662 |
| - catalogTruncated + catalogSelection | 88 | 0 | 0 |
| - nodeCatalogNote | 0 | 277 | 277 |
| - describedNodes | 0 | 0 | 5,202 |
| evidenceLoop.tools | 6,082 | 6,030 (run_node 2,059 -> 1,555; + describe_nodes 451) | 6,030 |
| outputSchema | 6,797 | 6,440 (each web variant -371; run_node +61; + describe_nodes variant 694) | 6,440 |
| routing / instructions / evidence / system | 2,571 / 788 / 272 / 3,667 | same | same |
| est. input tokens | 20,754 | 8,521 | 10,261 |

What this means for cost:
- In the recorded run the catalog sat in the cached prefix after the first call. Cache hits stayed at 12-25K tokens per decide, so the per-call saving is about 9-10K tokens at the cache-hit rate, plus about 10K tokens at the miss rate on each build's first call.
- Each `core.describe_nodes` call is one more decision of about 8.5K input tokens, mostly cache hits.
- The growing misses (up to 47.7K per decide) come from the evidence window's prefix breaking at the first superseded page view. That is the bigger remaining budget sink and is outside this lane.

## Not verified

- No live or Lab run (forbidden for now). So it is untested whether a model actually describes before running, how many describe calls a build makes, and the cache-hit behaviour of `describedNodes` on a real provider.
- The one-shot `flow_bootstrap` request still carries the whole catalog. This is deliberate: it is one call with no tools and no second request to describe in, and it is reachable only from the API without `evidenceGuided`.
- The task branches are not merged with dev (the hook blocks leads). Every overlap with F31 and describeCall is separated from our hunks by unchanged lines, but the merge itself is untried.
- `system-prompt.ts` is unchanged, per the supervisor (t237 owns it). It never mentions the catalog; the two-step pattern is taught by `nodeCatalogNote` (in the cached head) and the `core.run_node` and `core.describe_nodes` descriptions.
