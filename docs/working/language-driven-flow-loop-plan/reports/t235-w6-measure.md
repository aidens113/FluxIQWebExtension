# t235-W6: earbuds decide request, before vs after the names-only catalog

## Outcome

Done. Read-only measurement; no repository file edited except this report.

Headline: step-3 user message 58,547 -> 21,846 chars (-62.7%) with nothing
described, 27,066 (-53.8%) with the four end-of-build nodes described. Estimated
input tokens 20,754 -> 8,521 (a) / 10,261 (b).

## What changed and why

Nothing in Core or the extension. A script renders the recorded decision
through the t235 Core worktree's own code and measures both bodies.

- Before: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqbzu32-8691a65e/steps/0003-decide/request.json`
  (matches the brief's baseline: user 58,547; nodeCatalog 41,122 / 59 entries;
  outputSchema 6,797; tools 6,082; routing 2,571).
- After: an `AutomationStudioLlmTaskRequest` built by hand with the old
  taskKind, promptVersion, expectedOutput, schemaVersion/projectId/flowId,
  instructions, evidence, iteration, routing (as `flowBootstrap.routing`),
  startLocation, the 59 old catalog entries with the old
  `catalogTruncated`/`catalogSelection`, `catalogNames =
  automationStudioFlowBootstrapCatalogNames(entries)`; tools = the three web
  tools (old description, inputSchema from the old schema's matching
  `tool_call` variant, effect `observe`) + `automationStudioLlmRunNodeTool({nodeIds:
  <old 18-id enum>})` + the `core.describe_nodes` declaration from
  `automationStudioLlmDescribeNodesBundle(stub).options[0]` (the memory is
  only read by the implementation, so a stub does not affect the declaration);
  `decisionSchema = buildAutomationStudioLlmEvidenceLoopDecisionSchema(tools,
  automationStudioEvidenceFlowBootstrapDraftCompletionSchema(), true, false, true)`.
  Rendered with `buildAutomationStudioDeepSeekRequestBody(req, "deepseek-flash")`
  and measured with `measureAutomationStudioDeepSeekInput(req)`.
- (b) adds `describedNodes` = the full catalog entries for
  web.output.browser-navigate, dom-type, dom-click, dom-extract_list.

Script: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/58ff9269-d8d6-4822-86c8-adf096a6a8a7/scratchpad/measure/measure-t235-w6.mts`
Outputs (same directory): `after-a.request.json`, `after-b.request.json`, `results.json`.

## Table (chars of `JSON.stringify` of each part, unless marked)

| metric | before | (a) nothing described | (b) 4 described |
|---|---:|---:|---:|
| whole wire body | 70,148 | 26,865 | 32,709 |
| system message | 3,667 | 3,667 | 3,667 |
| user message | 58,547 | 21,846 | 27,066 |
| flowBootstrap total | 41,646 | 5,354 | 10,574 |
| - startLocation + startLocationNote | 342 | 342 | 342 |
| - nodeCatalog (full entries before; names after) | 41,122 | 4,662 | 4,662 |
| - catalogTruncated + catalogSelection | 88 | 0 (not sent) | 0 |
| - nodeCatalogNote | 0 | 277 | 277 |
| - describedNodes | 0 | 0 (absent) | 5,202 |
| evidenceLoop.tools | 6,082 | 6,030 | 6,030 |
| - web.detect_repeating_structure | 2,091 | 2,091 | 2,091 |
| - web.find_on_page | 1,285 | 1,285 | 1,285 |
| - web.describe_element | 642 | 642 | 642 |
| - core.run_node | 2,059 | 1,555 | 1,555 |
| - core.describe_nodes | - | 451 | 451 |
| routing | 2,571 | 2,571 | 2,571 |
| outputSchema | 6,797 | 6,440 | 6,440 |
| - complete variant | 2,078 | 2,078 | 2,078 |
| - tool_call variants total | 4,489 | 4,131 | 4,131 |
| - variant web.detect_repeating_structure | 862 | 491 | 491 |
| - variant web.find_on_page | 892 | 521 | 521 |
| - variant web.describe_element | 874 | 503 | 503 |
| - variant core.run_node | 1,861 | 1,922 | 1,922 |
| - variant core.describe_nodes | - | 694 | 694 |
| instructions | 788 | 788 | 788 |
| evidence | 272 | 272 | 272 |
| iteration | 1 | 1 | 1 |
| message UTF-8 bytes (system + user) | 62,214 | 25,513 | 30,733 |
| est. input tokens (`estimateAutomationStudioLlmTokensFromUtf8Bytes` + 16 framing) | 20,754 | 8,521 | 10,261 |
| `measureAutomationStudioDeepSeekInput` tokens / bytes | n/a (old body) | 8,521 / 25,513 | 10,261 / 30,733 |

"Before" tokens apply the same estimator to the old body's two message strings
(ceil(bytes/3) + 16 reserve, exactly what `measureAutomationStudioDeepSeekInput`
does); the script's own estimate agrees with `measureAutomationStudioDeepSeekInput`
for (a) and (b).

Reductions: user message -36,701 (a) / -31,481 (b); tokens -12,233 (-58.9%) (a)
/ -10,493 (-50.6%) (b). Each described node costs about 1,300 chars on average
(5,202 / 4).

## Commands run and observed results

- `node --experimental-strip-types --no-warnings <script>` from
  `C:/Users/osrs_/FluxStuff/fxwork/t235/!FluxIQ/packages/fluxiq` -> failed:
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` (parameter property in
  `runtime/flow-bootstrap/authoring/parse.ts:63`).
- Exact working command (PowerShell, cwd `C:\Users\osrs_\FluxStuff\fxwork\t235\!FluxIQ\packages\fluxiq`):
  `node --experimental-transform-types --no-warnings "C:\Users\osrs_\AppData\Local\Temp\claude\c--Users-osrs--FluxStuff--FluxIQWebExtension\58ff9269-d8d6-4822-86c8-adf096a6a8a7\scratchpad\measure\measure-t235-w6.mts"`
  -> printed the table above and the sanity block (Node v22.23.3).

Sanity check (computed in the script, all byte-equal to the old request for
both (a) and (b)): system message (`systemEqual: true`, 3,667),
instructions, routing, evidence, iteration, startLocation, startLocationNote,
the three web-tool entries in `evidenceLoop.tools`, the `complete` variant.
Top-level and context key order is identical to the old request.

## Not verified

- No live or Lab run, no model call. Whether the model actually calls
  `core.describe_nodes` before `run_node`, and how many describe calls a build
  adds, is not measured; (b) is the brief's assumed end-of-build set.
- The packet builder (`buildAutomationStudioLlmContextPacket` path) was not
  used: the request context was assembled by hand as the brief asked, so any
  packing the builder applies (deny-key screening, routing repacking) is not
  exercised. Routing came out byte-equal anyway.
- Cache-hit behaviour (prefix stability) not measured.

## Open questions or contradictions found

- Not a sanity failure but worth recording: each web-tool `tool_call` variant
  is 371 chars smaller after. The cause is the other t235 change in
  `buildAutomationStudioLlmEvidenceLoopDecisionSchema` (`add`/`act` explained
  once, on the first mutate/perCallEffect tool -- here core.run_node -- and bare
  elsewhere); the variants' `input` schemas are byte-equal to the old ones.
  core.run_node's variant grew by 61 (new `parameters` and `consequences`
  descriptions) while its tool description shrank 2,059 -> 1,555.
- With nothing described, `describedNodes` is absent from the wire (not an
  empty array), as `providerEvidenceFlowBootstrap` intends.
