# t1038 A1: evidence decisions as native tool calls (D12, Anthropic)

Worker `a1-native-decisions`. Core tree `fxwork/t1038/!FluxIQ`, package `packages/fluxiq`. No git, no provider call, no Lab run.

## Outcome

**Partial: the work is done, but one test outside my paths now fails and needs a change I have already proven.** On Anthropic, an evidence decision is now sent as one native tool call, read back from the streamed `tool_use` block, and held to the same reading and checks as before. Every acceptance check passes: typecheck, structure audit, model-text, and 79 test files / 880 tests in the parallel group. The real-sql group has one failure: `framework/automation-service/service/answer-first/completion/tests/judge-continues-decider.test.ts`. That file is on my must-not-touch list. Its fake wire reads `body.output_config.format`, which a tools request on Haiku no longer sends. I proved the fix in a temporary copy (it passes) and left the replacement for the lead (see Open questions, item 1).

## What changed and why

**API facts that decided the design** (from the claude-api skill and the live docs pages for tool use, define tools, strict tool use and structured outputs):
- `tool_choice` `any` or `tool` returns a 400 on Sonnet 5.5 and Opus 5.5. The Lab runs on Sonnet 5.5.
- Changing `tool_choice` invalidates the cached messages. Changing the tool definitions invalidates everything. Changing `output_config.format` invalidates the conversation's cache.
- Tool names must match `^[a-zA-Z0-9_-]{1,128}$`. DeepSeek and OpenAI allow up to 64 characters.
- Strict tools have limits per request, summed across all strict schemas: 20 strict tools, 24 optional parameters, 16 union parameters. A strict schema must close every object. `oneOf` is not supported.

1. **Provider-neutral module: `runtime/llm/provider-task/decision-tools/`.** One export per file, a barrel, and tests.
   - It builds one tool per decision variant, in schema order:
     - **Name:** the tool id for a tool call, or the decision kind otherwise, with each disallowed character written `_` (`core.run_node` becomes `core_run_node`). Clashes get a suffix in offer order (`_2`, `_3`); names stop at 64 characters.
     - **Description:** short and generic: "Calls the offered tool X (evidenceLoop.tools describes it); its input goes in input."
     - **Input schema:** the variant without its constant `kind` and `toolId`, with the wrapper's `summary` first and required.
   - **`input` stays nested.** A tool's own input keys may share names with the call's own keys (`add`, `act`, `place`, `callId`), so flattening them would make them collide.
   - **Reading a call back:** the tool is found by exact name lookup in the offer, never by undoing the name change. The call becomes exactly the old wrapper `{kind:"evidence_tool_decision", summary?, decision:{kind, toolId?, ...}}`. The name decides `kind` and `toolId`; if the model also wrote them into the input, they are ignored. An unknown name returns `unknown_tool`; an input that is not an object returns `input_not_object`.
   - **Determinism:** the tools are built from the schema alone, so the same offer always gives byte-identical tools.
2. **Anthropic wire.**
   - **`models/providers/anthropic/decision-tools-wire.ts`** sends the tools with `tool_choice: {type:"auto", disable_parallel_tool_use:true}` for every model. Forced choice is a 400 on Sonnet/Opus 5.5. On Haiku it would stop a continuing judge from answering in text, and changing `tool_choice` for the judge would lose the cached messages.
   - **Strict mode:** a tool is sent `strict` in its grammar form when its schema is fully closed and the per-request limits still allow it, taken in offer order. Every other tool is sent non-strict, exactly as its schema is.
   - **Grammar walk:** I moved it out of `schema.ts` into `grammar.ts` so tools and output formats share it. For tools it keeps an optional open object (`keepOpenObjects`) rather than dropping it, so a strict grammar can never stop a tool from sending a key its input takes.
   - **`request-body.ts`:** sends either `format` or `tools`. With tools there is no output format, and `output_config` keeps only `effort` (Opus).
   - **`stream.ts`:** joins `input_json_delta` pieces and parses them when the block stops. Input that does not parse is marked `input_unreadable`.
   - **`messages.ts`:** a new `readToolCall` reader, and `tool_use` is accepted as a stop reason. These are paid `llm.provider_output_invalid` failures with an account (four new cases in `models/failures/reply-account.ts`, each worded in `unreadable-reply.ts`):

     | What happened | Account case |
     |---|---|
     | no tool call | `tool_call_missing` |
     | two tool calls | `tool_call_several` |
     | a name the request did not offer | `tool_call_unknown` |
     | input JSON that does not parse | `content_invalid` |
     | a tool call where text was the answer | `tool_call_unexpected` |
   - **`llm/anthropic/request.ts` and `provider.ts`:** the new path is on by default. `decisionTools: false` on the provider keeps the JSON-text path, and that path is also used whenever the schema cannot be expressed as tools. A call goes through `automationStudioLlmDecisionFromToolCall`, then the unchanged `automationStudioAnthropicTaskAnswer` (now taking `finishReason`), then `decision-reading/`, then `decision-check.ts`, then the misses against the unchanged original schema.
3. **Prompt.** `automationStudioLlmTaskMessages(request, transport = "json_object")`, with the transport type in `provider-task/answer-transport.ts`. With `"decision_tools"`:
   - The user message has no `outputSchema`, and `context` is byte-identical. A test checks this against the JSON-text body.
   - The system prompt opens with: "Answer by calling exactly one of the offered tools: the tool you call is your decision, and its input says the rest. Write nothing besides that call."
   - The "Return minified JSON" sentence is replaced by a summary sentence. It keeps the override id `core.decision_output`.
   - Defaults are unchanged, so DeepSeek is untouched and its tests pass.
4. **Judge.** Standalone judges keep their native `json_schema`. A judge that continues a tools decider sends the decider's `tools`, `tool_choice`, system and messages prefix byte for byte, with no format of its own. Its system turn says the tools are not for this answer: "call none". It answers with its JSON object as plain text, read and checked against its own schema.
   - **Why the continued judge is not native:** a native answer would need either a different `tool_choice`, an output format, or a verdict tool. A different `tool_choice` or an added format would miss the cached messages. A verdict tool would add a tool the decider must never call to every decision request, and the judge schema varies (flow-less or not).
   - **Before vs now:** the old continued judge was not grammar-held either; only the `result_json` string around its answer was.
   - `continuation.ts` marks a tools prefix as `afterTools`.
5. **`decision-check.ts`:** I dropped the withdrawn-action allowance and the `decision-handlers/withdrawn-actions.ts` import. The enum-miss lead was real: `schema-misses.ts` now cuts an option list to fit within `MISS_RULE`'s 200 characters and says "or N more the schema lists". A value it cannot quote becomes "the N values the schema lists" or "exactly the value the schema gives". The bound itself is unchanged.
6. **Step log.** The writer is `runtime/llm/step-log/response-text.ts`, which is in no list; I edited it and name it here. An Anthropic SSE body is now put back together in `response.txt`: text, then each tool call by name with its input laid out readably, the stop reason and the usage. `response.json` keeps the raw stream. `decision.json` holds the read wrapper. A side effect: `meta.json` `finishReason` is now filled for Anthropic (it was always `null`).
7. **Docs.**
   - Core `docs/architecture/automation-studio.md`: a new paragraph on the Anthropic adapter.
   - `docs/architecture/automation-studio/llm-flow-bootstrap.md`: a note in the "paid reply is kept" paragraph.
   - Its line ~3907 about `look_withdrawn` belongs to W1 and is left for them.
8. **Tests.**
   - New:
     - `provider-task/decision-tools/tests/decision-tools.test.ts`: a round trip for every variant kind, an unknown name, a non-object input, the name the tool decides, an off-shape input passed on, deterministic bytes, naming and clashes.
     - `models/providers/anthropic/tests/decision-tools-wire.test.ts`: strict choice and limits, deterministic bytes.
     - `models/providers/anthropic/tests/schema-miss-bound.test.ts`.
     - `llm/anthropic/tests/native-decision.test.ts`: the wire shape, the context byte-identity, reading a streamed `tool_use` with text beside it, unknown tool, off-shape input with misses, missing and several calls, the step-log rendering, the continued judge reading text, and a judge that calls a tool.
   - Updated:
     - JSON-text tests (unreadable-reply, unreadable-reply-logged, off-shape-reply, decision-check's nested envelope, judge-continuation, provider's malformed transport): pinned to `decisionTools: false`, since they test the fallback transport.
     - `asked-table-replies`: the withdrawn-look block was rewritten without look withdrawal; the node is now refused with the bounded enum rule.
     - `cache-content`: compares against the `decision_tools` projection.
     - `provider`: checks both transports.
     - `result-verification/flow-less/tests/judge-unreadable.test.ts` (in no list, named here): pinned to `decisionTools: false`.

### Neutral module signatures, for the DeepSeek worker

From `runtime/llm/provider-task/index.ts`, which re-exports `./decision-tools/index.ts`:

```ts
type AutomationStudioLlmDecisionToolVariant = { readonly kind: string; readonly toolId?: string };
type AutomationStudioLlmDecisionTool = { readonly name: string; readonly description: string; readonly inputSchema: Record<string, unknown>; readonly variant: AutomationStudioLlmDecisionToolVariant };
type AutomationStudioLlmDecisionTools = { readonly tools: readonly AutomationStudioLlmDecisionTool[]; readonly wrapperKind: string };
type AutomationStudioLlmDecisionToolCall = { readonly name: string; readonly input: unknown };
type AutomationStudioLlmDecisionFromToolCallResult =
  | { readonly ok: true; readonly response: { kind: string; summary?: unknown; decision: Record<string, unknown> } }
  | { readonly ok: false; readonly reason: "unknown_tool" | "input_not_object" };
function automationStudioLlmDecisionTools(outputSchema: unknown): AutomationStudioLlmDecisionTools | undefined;
function automationStudioLlmRequestDecisionTools(request: AutomationStudioLlmTaskRequest): AutomationStudioLlmDecisionTools | undefined;
function automationStudioLlmDecisionFromToolCall(offer: AutomationStudioLlmDecisionTools, call: AutomationStudioLlmDecisionToolCall): AutomationStudioLlmDecisionFromToolCallResult;
function automationStudioLlmDecisionToolName(variant: AutomationStudioLlmDecisionToolVariant, taken: Set<string>): string;
type AutomationStudioLlmTaskAnswerTransport = "json_object" | "decision_tools";
function automationStudioLlmTaskMessages(request, transport?: AutomationStudioLlmTaskAnswerTransport): AutomationStudioLlmTaskMessage[];
function automationStudioLlmTaskSystemPrompt(request, transport?: AutomationStudioLlmTaskAnswerTransport): string;
```

Notes for the DeepSeek worker:
- Names already fit DeepSeek's 64-character pattern.
- `inputSchema` is the variant's own JSON Schema, not relaxed; any strict-mode relaxing is the adapter's job.
- Pass a read-back `response` to your existing decision path. The reply-account cases `tool_call_missing`, `tool_call_several`, `tool_call_unknown` and `tool_call_unexpected` exist for any provider.

## Commands run and observed results

- `NODE_OPTIONS=--max-old-space-size=3072 node .../heavy-slot.mjs run t1038-a1 -- node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm/anthropic src/runtime/models/providers/anthropic src/runtime/llm/provider-task src/runtime/models/failures src/runtime/llm/step-log src/runtime/llm/deepseek src/runtime/result-verification/unreadable-asks src/runtime/llm/caller-key-chat <26 importer test files found by grep>`
  - parallel: `Test Files  79 passed (79)` / `Tests  880 passed (880)`.
  - real-sql: `Test Files  1 failed | 2 passed (3)` / `Tests  1 failed | 25 passed (26)`. The failure is `judge-continues-decider.test.ts > ... sends the judge after a decision as a continuation of its own decider` (attempt `stopped_by_person`, because the fake fetch throws on `body.output_config.format`). It is caused by this change and is in a must-not-touch file.
  - The same test with the proposed change, run as a temporary copy (since deleted) in `llm/anthropic/tests`: `Test Files  1 passed (1)`.
- `pnpm --filter fluxiq check` (heavy gate) passed: no errors, `"reason":"no stamp; stored in the shared store"`. An earlier run caught one type error in `result-verification/run-trail/tests/repeats.test.ts` (a prefix literal); I made the prefix field optional (`afterTools?: true`) so that test is unchanged.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (574 warning(s), 903 baselined).` An earlier run failed `failure-as-empty` on my stream reader; it now rethrows anything that is not a `SyntaxError`.
- Downstream `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 554 model-facing Core files, 14346 string literals)`.
- P4: `node --experimental-transform-types test-runs/t1038/a1-replay.mjs`. Output is in `test-runs/t1038/a1-replay-out.txt`, per-step detail in `a1-replay-steps.json`.

### P4 replay: every `*-decide` step of the five t1015 bigbox recordings

Each recorded reply was decoded by the old reader (so damaged escaping did not stop it). It was re-expressed as the call it would have been: the variant the model meant, by the same decision reading the adapter applies, became the tool; the rest became the input. It was then read through the new path against that step's own recorded request schema.

- **Old** columns are the recorded outcome: read by the adapter, or refused.
- **Fixed tokens** are the per-request transport tokens, estimated with Core's conservative byte estimator.
  - Old: the `outputSchema` key in the user message, the `result_json` system block, the output-format JSON and the two JSON-object rule sentences.
  - New: the tools, the `tool_choice`, the two new sentences, plus the 286 tool-use system-prompt tokens the docs give for auto choice on the 5.5 models.

| run | decisions | old read | old refused | new read | new refused (by code) | impossible to express (why) | fixed tok/req old | new | strict tools/req |
|---|---|---|---|---|---|---|---|---|---|
| run-mwus396e | 40 | 39 | 1 | 40 | 0 | 0 | 6147 | 6970 | 6 of 11 |
| run-mwuuo3zk | 143 | 132 | 10 | 134 | 1 off_shape | 8 (7 name a tool or node not offered: find_on_page 2, dom-extract_list 3, dom-capture_snapshot 2; 1 no reply recorded) | 5991 | 6752 | 6 of 10 |
| run-mwuxd2v9 | 82 | 70 | 11 | 74 | 1 off_shape | 7 (5 name a tool or node not offered; 1 reply had a summary and no decision; 1 no reply recorded) | 5984 | 6742 | 6 of 10 |
| run-mwv5m906 | 74 | 73 | 0 | 70 | 0 | 4 (3 dom-capture_snapshot not offered; 1 no reply recorded) | 6030 | 6801 | 6 of 10 |
| run-mwveg5ls | 128 | 124 | 3 | 122 | 2 off_shape | 4 (3 name a tool or node not offered; 1 no reply recorded) | 5789 | 6450 | 5 of 9 |
| **all** | **467** | **438** | **25** | **440** | **4** (`llm.provider_output_invalid`, `content_off_shape`) | **23** (18 name a tool or node not offered; 4 no reply recorded; 1 no decision) | **5954** | **6694** | 5 of 10 |

How to read this:
- **Of the 25 old refusals:** 7 now read. 4 are still refused, all the same case: a node outside the narrowed `core.run_node` list (the withdrawn snapshot). The model is now told the list within the bound, for example `response.decision.input.node: must be one of "web.output.browser-download", ... or 13 more the schema lists`. Before, that rule was dropped. 14 cannot be expressed.
- **The 18 "not offered" cases** named a tool or node the request did not offer (`web.find_on_page`, a withdrawn node id used as the tool id). The old adapter passed 6 of them through, and the loop then refused them by name. A native call has to pick an offered tool by name, so these decisions cannot exist natively; what the model would have chosen instead cannot be replayed offline.
- **Tokens:** about 740 more fixed tokens per request, of which 286 are the API's own tool system prompt. The rest is mostly the `summary` property and the JSON structure repeated on each of about 10 tools, plus the "Original constraints" descriptions on strict tools. These sit first in the cached prefix, so they are cache-read priced except when the offer changes.
- **Not measured:** page tokens and new, uncached tokens are unchanged by this work, because `context` is byte-identical.

## Not verified

- **No live call.** Two things are unproven as a result:
  - Strict decision tools have not been sent to the API. The docs' internal "Schema is too complex for compilation" limit cannot be checked offline; the explicit limits are respected.
  - It is unmeasured how often Sonnet 5.5 with `tool_choice: auto` replies with no tool call (`tool_call_missing`) or adds text before the call.
- The model now sees tool names like `core_run_node` while the user message and guidance say `core.run_node`. Each tool's description names its id, but how well a live model maps the two is unmeasured.
- Token figures are estimates (Core's conservative bytes-per-token), not `count_tokens`.
- `eager_input_streaming` is deliberately off: the API buffers and validates the input, and Core does not need it streamed.
- The continued judge's plain-text reply was tested with scripted replies only.

## Open questions or contradictions found

1. **Needed from the lead:** `framework/automation-service/service/answer-first/completion/tests/judge-continues-decider.test.ts` (answer-first, must-not-touch) must take the content of `test-runs/t1038/a1-judge-continues-decider.patch-target.ts`.
   - What it changes: `Wire.output_config` becomes optional and is read with `?.`. When `body.tools` is present, the fake replies with the decision's `tool_use` block (`stop_reason: "tool_use"`), using `automationStudioLlmRequestDecisionTools(asked)`.
   - `test-runs/t1038/a1-judge-continues-decider.diff` shows it, but as a whole-file diff because the original uses CRLF line endings.
   - Proven passing through the real harness and adapter.
   - The one-line alternative, `decisionTools: false` on its provider, would keep it testing only the old transport.
2. The brief asked for "a tool choice that forces exactly one call". That is impossible on Sonnet 5.5 and Opus 5.5 (400), and on Haiku it would conflict with a judge continuing in text. "At most one call" is enforced by the API; "exactly one" by the prompt plus a paid, accounted refusal.
3. W1 removes look withdrawal. My code no longer imports `decision-handlers/withdrawn-actions.ts`, and `asked-table-replies.test.ts` no longer uses it, so W1 can delete it freely.
