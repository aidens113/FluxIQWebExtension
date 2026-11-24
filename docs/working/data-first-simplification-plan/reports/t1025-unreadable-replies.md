# t1025 report: why the model's replies came back unreadable

Worker: Claude Code (Opus 5.5 worker-heavy). Core tree `C:/Users/osrs_/FluxStuff/fxwork/t1025/!FluxIQ`. No git, no Lab, no browser, no paid run.

## Outcome

Done. I checked all 22 recorded `llm.provider_output_invalid` / `content_off_shape` decisions in the three bigbox runs, which is 11 more than the brief listed. Each one was rebuilt from its SSE `response.txt` and checked against the `outputSchema` in its `request.json`.

The root cause is two gatekeepers holding one reply to two different grammars:

- **The parser.** For every provider, the harness reads a decision with some repairs. It reads an unknown `kind` that carries `toolId` and `input` as a tool call, and it moves misplaced input keys into `input`. The loop then refuses anything it was not offered, by name and with an instruction: `unknown_tool_refused` with the offered ids and the nearest one, `look_withdrawn`, `complete_not_offered`, `amend_not_offered`.
- **The Anthropic adapter.** `runtime/llm/anthropic/task-answer.ts` first checked the whole reply against the full `oneOf` decision schema. In that schema each tool variant has its `toolId` as a constant.
  - A reply naming a tool the schema did not offer fit no variant.
  - The schema walk then reported the misses of whichever variant had the fewest. So a model that asked for a withdrawn page search was told "`toolId must be exactly "core.run_flow"`; `input.from is missing`". A model that named a node id was told "`toolId must be exactly "web.detect_repeating_structure"`".
  - Replies the harness would have read (`kind: "loop_decision"`) were refused before the harness saw them.
  - DeepSeek never had this check (`deepseek/response-envelope.ts` only normalizes the wrapper). So the schema the model was given and the one the parser held it to were the same, but on Anthropic a stricter and misleading reader ran first.

A change of offers made it worse. When looks were withdrawn, `core.loop_decision` was withdrawn with them, because it is declared `observe`. This happened in the same request where the loop-detection steer said "your next decision is a call to core.loop_decision" (run-mwuuo3zk steps 121 and 122). The narrowed node list also never said why a node had gone.

## The 22 replies: what was written, against what, and why it did not fit

Path and rule are quoted from each `decision.json`. The tool and node ids are the real catalog ids. No page data is shown.

| Run / step | What the model wrote | Why it did not fit | Cause |
| --- | --- | --- | --- |
| us396e/45 | `core.run_node` call with `act: null, place: null` | null is not text | A: optional own keys written as null |
| uuo3zk/89, uxd2v9/196 | `toolId: "web.output.dom-next_page"` (or `-extract_list`), with `input: {node: <same id>, parameters, consequences}` | `toolId must be exactly "core.run_node"` | B: node id as toolId, input names it |
| uuo3zk/219, 226, 280 | `toolId: "web.output.dom-extract_list"`, `input: {extractList: {...}}` | `toolId must be exactly "web.detect_repeating_structure"`, `input.extractList` not a key | C: node id as toolId, input is the node's own parameters; misleading nearest-variant feedback |
| uuo3zk/247, 272, uxd2v9/131 | `toolId: "web.output.dom-capture_snapshot"`, `input: {}` | `toolId must be exactly "web.detect_repeating_structure"` (fewest misses) | C |
| uuo3zk/124, 232, uxd2v9/194, 204 | `web.find_on_page {query}` while looks were withdrawn (offers: complete, amend_draft, core.run_node, core.run_flow) | `toolId must be exactly "core.run_flow"`, `input.from` missing | D: withdrawn look; adapter pre-empted the loop's `look_withdrawn` |
| uxd2v9/139, 200 | `web.detect_repeating_structure {target}` while looks were withdrawn | as above | D |
| uuo3zk/308, uxd2v9/202 | `core.run_node {node: "web.output.dom-capture_snapshot"}`; the node was narrowed out of the enum (looks withdrawn) | `input.node must be one of` the first 8 | E: withdrawn node; the schema never said why |
| uuo3zk/144, uxd2v9/179 | `{kind: "loop_decision", callId, toolId: "core.loop_decision", input: {...}}` | `decision.kind must be exactly "tool_call"` | F: the harness reads this; the adapter refused it first |
| uxd2v9/215 | `{kind: "loop_decision", decision, question, why}` (flat) | `result` missing, `kind must be exactly "complete"` | G: tool call written flat under the tool's name |
| uxd2v9/74 | `{"result_json": "{\"result_json\": \"{...decision...}\"}"}` (transport envelope twice) | `response.kind` / `decision` missing, `result_json` not a key | H: double envelope |
| uxd2v9/78 | `{"summary": "..."}` and no decision | `response.kind` missing, `response.decision` missing | I: no decision at all (`end_turn`) |

Was anything required that the model could not know? No hidden key. The model was told about withdrawn looks only as a code in the decision history (`"llm_evidence_loop.looks_withdrawn": [7]`), not by name. It was told to call `core.loop_decision` while that tool was not offered.

Did the feedback say what to fix? No:

- For A–D and F–G it named another tool's variant (see the recorded `0125-answer-unusable/result.json`, which tells the model to use `core.run_flow`).
- For E it gave a list cut to 8 values with no reason.
- For I it also flagged `response.kind`, a word Core fills in itself.

## What changed and why

All changes are in Core and grammar or feedback only. Nothing that a decision may be was relaxed, and no retry count or loop-detection handling changed.

1. **New shared reader, `packages/fluxiq/src/runtime/llm/decision-reading/`** (`read.ts`, `own-key-nulls.ts`, `flat-tool-call.ts`, `inferred-tool-call.ts`, `value-tool-id.ts`, `input-value-of.ts`, `derived-call-id.ts`, `tool.ts`, `reading.ts`, `index.ts`, `tests/read.test.ts`). One reading that both the harness and the adapter apply, in this order:
   1. A tool call's own `add`/`act`/`place` written as `null` is read as absent (A).
   2. A tool call written flat under the name of exactly one offered tool is read as a call of that tool, provided every other key is declared by that tool's input (G).
   3. The existing inferred-kind reading, moved here unchanged from `harness/provider-result.ts` (F).
   4. A `toolId` that is an enum value of exactly one offered tool's input key, where the input already holds that value at that key, is read as that tool (B).
   5. The existing key folding (`tool-call-keys/folded.ts`, unchanged).

   I did **not** read C. Doing so would mean Core writing the call's `consequences` on the model's behalf, and that list feeds the permission gate.
2. **`runtime/llm/harness/provider-result.ts`** now uses the shared reader. It keeps `llm_output.decision_kind_inferred` (warning) and `llm_output.key_moved_into_input` (info) with the same messages and metadata, and adds `llm_output.null_key_read_as_absent` (info), `llm_output.flat_tool_call_read` (warning) and `llm_output.tool_id_read_from_input` (warning). The old private `inferredEvidenceToolCall`, `foldedEvidenceToolCall` and `derivedCallId` are removed.
3. **New `runtime/llm/anthropic/decision-check.ts`; `task-answer.ts` uses it.** For a decision task the reply is checked as Core reads it, against the variant it names:
   - A tool call naming an offered tool, or an offered `complete` or `amend_draft`, is held to that variant only, and its misses are its own.
   - A tool or kind the schema does not offer is passed on, so the loop refuses it by name as it already does for DeepSeek (fixes the misleading feedback for C and D).
   - A reply with no `kind` is checked with the wrapper word filled in, so the misses name only what is missing (I).
   - The reply passes on as it came; the harness reads it again the same way and logs what it read.
4. **`runtime/models/providers/anthropic/reply/reading.ts`:** an envelope inside the envelope (a lone `result_json` key, again) is opened once more (H).
5. **`runtime/llm/unknown-tool/refusal-of.ts`, `runtime/llm/unusable-decision.ts`, `runtime/llm/evidence-loop/decision-refusal.ts`:** when the unknown id is an enum value of exactly one offered tool's input key, the refusal carries `takenBy: {toolId, key}`, the nearest becomes that tool, and the instruction says: `"<id>" is not a tool but a value that "core.run_node" takes in input.node: call "core.run_node" with input.node "<id>" and the rest of its input as its input schema in the decision schema declares it.` (C). The field was first named `valueOf`, which clashed with `Object.prototype.valueOf` and broke two tests; it is renamed and guarded with `Object.hasOwn`.
6. **`runtime/llm/decision-handlers/look-withdrawal.ts`:**
   - `core.loop_decision` is never treated as a look, so it stays offered and is never refused while looks are withdrawn. This fixes the steer telling the model to call a tool it was not offered.
   - A narrowed action list now carries a description naming the withdrawn values and why: "Not offered now, because each only looked and looks are withdrawn until an action runs: …" (E).
7. **Tests:**
   - `runtime/llm/anthropic/tests/decision-check.test.ts`: 10 tests, one or more per recorded reply shape.
   - `runtime/llm/decision-reading/tests/read.test.ts`: 8 tests.
   - Two tests appended to `runtime/llm/decision-handlers/tests/look-withdrawal-finishing-tools.test.ts`. A separate file pushed that directory to 26 files, over its 25-file limit.

### How many of the 22 the fix would have read

- **Read and acted on as the decision meant: 7.** us396e/45 (A); uuo3zk/89 and uxd2v9/196 (B); uuo3zk/144 and uxd2v9/179 (F); uxd2v9/215 (G); uxd2v9/74 (H).
- **Read and refused by the loop's own named refusal with an exact instruction, no longer an unreadable reply: 12.**
  - Six withdrawn looks get `llm_evidence_loop.look_withdrawn`: uuo3zk/124, 232; uxd2v9/194, 204, 139, 200.
  - Six node ids given as the toolId with the node's own parameters as input get `unknown_tool_refused` with `takenBy` core.run_node / node: uuo3zk/219, 226, 280, 247, 272; uxd2v9/131.
- **Still refused as unreadable: 3.**
  - uxd2v9/78: there is no decision in the reply to read. The feedback now names only `response.decision is missing`.
  - uuo3zk/308 and uxd2v9/202: these name a node that the narrowed schema withdrew. They should be refused, and still are, at `response.decision.input.node`. The decision schema now says which nodes are withdrawn and why.

## Commands run and observed results

Commands run in `packages/fluxiq` unless noted.

- **New tests against the pre-fix code.** The seven modified files were swapped for their `git show HEAD:` versions, then put back:
  - Command: `node ../../scripts/vitest-groups.mjs --groups=parallel src/runtime/llm/anthropic/tests/decision-check.test.ts src/runtime/llm/decision-handlers/tests/look-withdrawal-offers-told.test.ts`
  - Result: `Tests 10 failed | 2 passed (12)`. The 2 that passed are the non-regression tests: step 308 still refused at `input.node`, and an offered tool's bad input held to its own variant.
  - `read.test.ts` tests the new module, which did not exist before.
- **New tests on the fix:** `decision-check.test.ts (10 tests)` passed. `read.test.ts (8 tests)` passed. `look-withdrawal-finishing-tools.test.ts (5 tests)` passed. `evidence-loop-unknown-tool.test.ts (5 tests)` passed after the rename.
- **Test groups over every changed directory:**
  - Command: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm/anthropic src/runtime/llm/decision-reading src/runtime/llm/decision-handlers src/runtime/llm/evidence-loop src/runtime/llm/harness src/runtime/llm/unknown-tool src/runtime/llm/tests src/runtime/llm/deepseek src/runtime/models/providers/anthropic`
  - parallel: `Test Files 1 failed | 168 passed (169)`, `Tests 1721 passed (1721)`. The one failed file is `look-withdrawal-offers-told.test.ts`, which I deleted during the run when moving its tests into the existing file; no test failed.
  - real-sql: `Test Files 1 passed`, `Tests 2 passed`.
- **Re-run of that directory:** `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm/decision-handlers` gave `Test Files 25 passed (25)`, `Tests 114 passed (114)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- **`pnpm --filter fluxiq check`:** exit 0 (`build-cache ... fluxiq:check ... ms 299014`).
- **`node scripts/structure-audit.mjs`** (Core root): the first run failed with `[directory-files] .../decision-handlers/tests/: 26 source files exceeds the 25-file limit`. After the merge: `structure-audit: passed (571 warning(s), 903 baselined).`, exit 0.

## Not verified

- No live or paid run, and no replay of the recorded runs through the whole loop.
- What happens after the adapter for the 12 "refused by name" replies is covered by the existing loop tests plus the unit-level refusal and feedback test. I did not run a whole-loop test with looks withdrawn and a withdrawn tool named.
- `models/failures/**` is unchanged; the feedback path through it is exercised by the tests above.
- I counted only the three runs under `recorded-evidence/t1015-bigbox/`.

## Open questions or contradictions found

- **Ownership:** `runtime/models/providers/anthropic/reply/reading.ts` (the double envelope) is the provider adapter's reply parsing, but the brief does not name it explicitly. It is not on any must-not-touch list. Please confirm.
- **Behaviour change on Anthropic:** a decision naming a tool or kind the schema does not offer now reaches the harness and loop instead of failing at the adapter, which is exactly what DeepSeek has always done. The loop refuses each such decision with its existing code, so a different refusal path, not a new way through.
- **Not fixed (outside the brief), cost:** withdrawing and restoring looks rewrites the decision schema at the head of the request, so each change misses the prompt cache. uuo3zk step 122 paid for 93,208 uncached and 76,800 cache-write input tokens. A schema that stays the same with a loop-side refusal would avoid this; that is a design question for the lead.
- **Not fixed (outside the brief), notice:** the model learns that looks are withdrawn only from a code in the decision history. Its first refusal (`look_withdrawn`) now explains it, but nothing tells it when the withdrawal starts.
