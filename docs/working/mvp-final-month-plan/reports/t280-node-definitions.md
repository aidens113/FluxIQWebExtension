# t280-node-definitions: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t280/!FluxIQ` (branch `task/t280-node-definitions`). Nothing committed.

## Outcome

Done. Every library call the model makes now adds the node it ran to the build's described-node memory, whether the call succeeded, was refused or was written (`write: true`). The definition then appears under `flowBootstrap.describedNodes` from the next decision on. A successful call still comes back unchanged and no call is refused before it runs, so a run that would have succeeded costs no extra decision. A refused call still gets `described: "<node> is now in flowBootstrap.describedNodes"` (or `definition: ...` on later refusals) plus `undeclaredParameters`. The three prompt texts now say this.

## Measurements

Method: a scratch script (`scratchpad/t280/measure.mjs`) built the evidence catalog with Core's `buildAutomationStudioFlowBootstrapContext`, using the rebuilt t280 Core dist and the web domain's node definitions from the main downstream checkout's `domain/dist` (resolution: domain `web-automation`, with every capability and permission the domain declares). Sizes are `JSON.stringify` UTF-8 bytes of each catalog entry, which is exactly what one `describedNodes` entry costs on the wire.

- Whole catalog: 59 entries, 41,122 bytes. The names-only `nodeCatalog` that an evidence decision is sent: 4,662 bytes. The catalog note: 288 characters (was 274).
- Per definition: `web.output.dom-extract_list` 2,696; `builtin.policy.action` 1,696; `builtin.data.write-records` 1,222; `web.output.dom-type` 1,041; `dom-scroll` 964; `dom-select` 918; `dom-wait_for_selector` 892; `dom-check` 867; `dom-keypress` 859; `dom-extract` 854; `dom-upload` 851; `dom-assert` 837; `dom-clear` 800; `dom-click` 784; `dom-wait_for_text` 733; `browser-navigate` 676; `dom-dialog` 646; `browser-download` 625; `browser-tab` 623; `dom-capture_snapshot` 595. The built-ins range from 397 to 759, apart from the two above.
- What a decision request carries today (from reading `context-packet.ts` and `request-body.ts`): a constant head (instructions, policy gates, `startLocation`, the 4,662-byte names, the note, then `describedNodes` last), then the tool list, then the evidence window, then the parts that vary. Before this change, `describedNodes` was empty unless the model asked or a call failed. In 21 of 23 live runs the model never asked.
- Bytes added per decision: the sum of the definitions of the distinct nodes the build has run. Every entry sits in the cached head.
  - Before the first decision: the opening call (the arrival `browser-navigate` and/or the look `dom-capture_snapshot`) goes through the same wrapper, because its input carries no `replay` key. That describes up to 676 + 595 = 1,271 bytes before the first paid decision.
  - A typical lane D build (navigate, snapshot, click, list read) ends at 4,751 bytes, about 1.3k tokens, almost all cached.
  - A lane C-like build that adds `dom-type`: about 5.8 KB.
- Cache cost: each node's first run appends its entry to the head, so the next request recaches everything after `describedNodes` (the tools and the evidence window) once. That is the same break a `core.describe_nodes` call causes today, without the decision the call costs. It happens at most once per distinct node, usually early in a build while the window is small.

## What changed and why

All paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `llm/node-tools/describing-failures.ts`: `memory.describe([node])` now runs after every non-replay call, before the success check (it previously ran only on `ok: false`). A thrown call still describes its node (unless the call was aborted) and still throws. Replays carrying `AUTOMATION_STUDIO_NODE_REPLAY_KEY`, and nodes the catalog does not hold, pass through without being described. The header now explains why (2 of 23 runs asked; lane D ran `dom-extract_list` 10-16 times per build with no definition), what it costs, and that the opening call is described.
- `llm/node-tools/run-node.ts`: in DESCRIPTION, "Before a node's first use, read its definition with core.describe_nodes ... unless it is already in flowBootstrap.describedNodes. Then give exactly the parameters that definition declares." became "A node you run is described for you, in flowBootstrap.describedNodes from then on. Give exactly the parameters its definition declares; for a node whose parameters you do not know yet, read it first with core.describe_nodes, several at once." The description stays under 1,500 characters (test passes). Header comments updated.
- `llm/node-tools/describe-nodes.ts`: "Ask once, before running them, for all the nodes you are about to use, several ids per call." became "A node you run is shown too; ask before its first run only to learn its parameters, several ids per call." The description is 396 characters, under its 400 budget.
- `llm/deepseek/request-body.ts`: the catalog note is now "nodeCatalog lists every node by id and what it does, by category. Each node you run joins describedNodes, with its inputs, outputs and parameters, for the rest of this build. To read one before its first run, ask core.describe_nodes (several ids at once); never ask for one already there." (288 characters, under 300). Doc comment updated.
- `llm/node-tools/node-descriptions.ts`, `llm/harness/context-packet.ts`, `flow-bootstrap/plan/contracts.ts`: comments only ("asked about" became "asked about or ran").
- Tests:
  - `llm/node-tools/tests/node-descriptions.test.ts`: new block "a node the model runs is described by running it", with 4 tests: a successful first run leaves the definition in memory and the answer untouched, each node once and in order; a written step's node is described; a refused first run points at its definition; replays and unknown nodes are left out.
  - `llm/node-tools/tests/run-node.test.ts`: the pinned sentence was updated.
- **Outside the listed paths, but needed:** `llm/harness-options/tests/binding.test.ts`. One assertion pinned the old behaviour (`memory.ids()` stays `[]` after a successful run). It now expects `[AND]`, and the test was renamed. This file tests the wrapper as `binding.ts` wires it, and it would fail without this change.
- The optional pre-describe on list detection was not done. Core has no generic link from a detection tool's handle to the node that reads it, so adding one would mean naming a domain node in Core. With this change, the read node's first run (succeeded or refused) describes it anyway.

## Commands run and observed results

All `npx vitest run` commands ran from `packages/fluxiq` with exact paths. The "Core checks" ran from the Core root.

- **Fail-first:** `npx vitest run .../node-tools/tests/node-descriptions.test.ts`, before the fix, gave "Tests 2 failed | 7 passed (9)". Failing: "leaves the definition of a first, successful run ..." and "describes a written step's node too" (`expected [] to deeply equal [ 'builtin.logic.and' ]`). The refused-run and replay tests passed, because that behaviour already existed.
- **Owning tests:** `npx vitest run` on node-tools/tests/{node-descriptions,describe-nodes,run-node}.test.ts, harness-options/tests/binding.test.ts, harness/tests/described-nodes.test.ts, deepseek/tests/request-body.test.ts, llm/tests/provider-cache-prefix.test.ts.
  - The first run after the fix gave 2 failures: describe-nodes description 420 > 400, and run-node's pinned sentence. Both texts were then adjusted.
  - The second and third runs both gave "Test Files 7 passed (7) / Tests 68 passed (68)".
- **Wider run:** `npx vitest run` on node-tools/tests, deepseek/tests, harness/tests, harness-options/tests, llm/tests/provider-cache-prefix.test.ts, evidence-loop/tests/authored-draft.test.ts, activity/wording/tests/wording.test.ts, route-state/tests/build-routing.test.ts, service/flow-bootstrap-commands/tests/state-digest.test.ts, src/ui/activity-action/tests/action-of.test.ts. Result: "Test Files 72 passed (72) / Tests 843 passed (843)".
- **Core checks:**
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
  - `node scripts/build-cache/cli.mjs structure-audit:check`: exit 0, "structure-audit: passed (264 warning(s), 349 baselined)". The `node-tools/tests` folder still holds 25 files, because the existing test file was extended rather than a new one added.
  - `pnpm.cmd build` in the Core tree: exit 0.

## Not verified

- No live, Lab or provider run, by rule. Whether the model actually reads the definitions it is now given is unmeasured until round 3+ step folders exist.
- Measured sizes come from the main checkout's `domain/dist` (not rebuilt here), so they may lag `dev` slightly.
- The whole-request byte size of a real decision was not measured, because no run step folders were readable outside the lane trees I was told not to touch.
- That the opening call reaches the wrapper was established by reading the code, not by a test: `service.ts:1551/1560/1563` chains `personNeeded`, then `permissions`, then `harnessOptions.executeTool`, then the registry and the wrapper. The domain's `runsNodes.initial` input (`domain/src/runtime/llm-evidence/tools.ts:417`) carries no `replay` key.
- No downstream check was run, because no downstream file changed.

## Open questions or contradictions found

- The function and file names `automationStudioLlmRunNodeDescribingFailures` / `describing-failures.ts` now undersell what they do. Renaming them means editing `llm/harness-options/binding.ts` (import plus the doc comment at about line 395, "a library call that fails naming a node it never asked about describes that node"), which is outside my paths. I recommend a rename (for example `run-node-describing.ts`) and a fix to that comment when this lands.
- Describing the opening look and arrival nodes adds about 1.3 KB to every decision's cached head, including for a build that would never call them again. That is cheap and deterministic. If unwanted, skip calls whose `callId` starts with `initial.`.
