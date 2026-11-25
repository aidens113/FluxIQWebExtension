# t1038 A2: evidence decisions as native function calls on DeepSeek (D12)

Worker `a2-deepseek-tools`. Core tree `fxwork/t1038/!FluxIQ`, package `packages/fluxiq`. No git, no provider call, no Lab run.

## Outcome

Done. An evidence decision is sent to DeepSeek as OpenAI-style function tools with `tool_choice: "required"`, read from `choices[0].message.tool_calls`, mapped back into the old wrapper and passed through the same path a JSON decision takes. Default on; `decisionTools: false` keeps JSON.

## Docs evidence for the tool choice (read only; DeepSeek API reference, "Create chat completion", and the tool-calls guide)

- `tool_choice`: "`none`, `auto`, `required`"; "`required` means the model must call one or more tools"; a named function "forces the model to call that tool"; "`required` and named tool choices are not supported in thinking mode; the API returns a `400` error".
- Every Core DeepSeek request already sends `thinking: {type: "disabled"}`, so `required` is accepted on both configured models (`deepseek-flash`, `deepseek-v4-pro`). The guide's non-thinking example names `deepseek-flash`; `deepseek-v4-pro` is not named, so that model is unproven (see Not verified).
- A named tool is no use (the decision is which tool). `required` allows several calls and no switch against it is documented, so several is refused, paid.
- Strict mode is a beta: `/beta` base URL, all functions strict, every object closed with every property required. Not used: Core keeps the fixed endpoint, optional fields cannot be strict, and the call is checked against the unchanged schema.
- Function name pattern: a-zA-Z0-9, `_`, `-`, max 128; A1's names fit. No documented tool-count maximum. `response_format` with tools is not addressed, so `response_format` is dropped when tools are sent.
- Reply: `message.tool_calls[].function.{name, arguments}` (arguments a JSON string); finish reason `tool_calls`.

## What changed

Core `packages/fluxiq/src`:
- `runtime/models/providers/deepseek/decision-tools-wire.ts` (new): tools to `{type:"function", function:{name, description, parameters}}` plus `tool_choice: "required"`, deterministic. Exported from the barrel.
- `runtime/models/providers/deepseek/tool-call-refusal.ts` (new): paid `llm.provider_output_invalid` with the reply account.
- `runtime/models/providers/deepseek/response-envelope.ts`: adapter gets an optional `readToolCall`; when present, the reply's tool call is read instead of its content (`readToolCallOf`). Cut by `length` is the existing truncated codes; none is `tool_call_missing`; several is `tool_call_several`; a finish reason other than `tool_calls`/`stop` is the existing `finish_reason` case; a malformed call shape is `envelope_shape`; non-JSON arguments is `content_invalid`. Usage checks and pricing are shared with the content path.
- `runtime/llm/deepseek/decision-tools.ts` (new): which requests go as tools (`automationStudioLlmRequestDecisionTools`, or none with `enabled: false`).
- `runtime/llm/deepseek/request-body.ts`: body builder and input measure take the tools; with tools: `tools` and `tool_choice` placed before `messages` (prefix cache), no `response_format`, system prompt and user message from A1's `decision_tools` transport (context byte-identical). The measure counts the tools' bytes.
- `runtime/llm/deepseek/response-envelope.ts`: unknown name is `tool_call_unknown`, non-object input `content_not_object`, then the unchanged `parseDeepSeekStructuredResponse` (normalization).
- `runtime/llm/deepseek/request-shape.ts`: shape of a tools request (`responseFormat: "tool_choice_required"`, measured with tools).
- `runtime/llm/deepseek/provider.ts`: `decisionTools?: boolean` option (default on); the tools are computed once per call and threaded to body, measure, shape and reader.
- `runtime/llm/step-log/response-text.ts`: a DeepSeek tool call is shown as `==== tool call NAME (arguments N chars) ====` with arguments laid out; `tool_calls` removed from "other message fields".
- Files in no list that I edited: `runtime/llm/session-key-provider.ts` (new pass-through option `decisionTools`, like `fetchImpl`, so tests with scripted JSON endpoints can pin the JSON transport; production passes nothing, so DeepSeek is on tools). `docs/architecture/automation-studio.md`: new DeepSeek paragraph after A1's Anthropic one.
- Tests: new `llm/deepseek/tests/decision-tools.test.ts` (8 tests: request body with tools/choice/no response_format/no outputSchema and tools before messages; context byte-identical to the JSON-object request and deterministic bytes; a call for each variant kind (two tool calls, complete) read into the exact wrapper; unknown name; missing and several; unparseable arguments, non-object arguments, a `length` cut; an input off the schema passes on as today; `decisionTools: false` and a judge stay JSON) and `llm/step-log/tests/tool-call-response-text.test.ts`.
- Existing tests pinned to JSON text with `decisionTools: false` (they script JSON content): provider constructions in `step-log/tests/model-step.test.ts`, `project-build-reset`, `trial-view`, `stages/registry`, `deepseek-evidence-preflight`, `evidence-loop-provider`, `provider-cache-prefix`, `routing-context-packet`; session resolvers in the deepseek-bootstrap `harness.ts`, `deepseek-recovery-requests`, `reauthor-service`, `repair-replay-chain`, `iterating-recovery`, `creation-budget`, `evidence-loop/tests/request-prefix`.

Choices:
- Non-decision tasks (judge, diagnosis, bootstrap, patch, panel command) keep JSON object: DeepSeek's docs show no native structured-answer path other than tools, and the judge's answer is not a decision.
- A model or configuration that cannot take tools keeps `json_object`: a schema A1's tools cannot express (the neutral module returns none), or a provider built with `decisionTools: false`. Neither configured model is excluded.
- Cache placement: JSON keys put `tools` and `tool_choice` before `messages`; DeepSeek does not document how it renders tools into its prefix, so this is by convention, not measured.
- I made no change to A1's `provider-task/` files.

## Commands run and observed results

- `NODE_OPTIONS=--max-old-space-size=3072 heavy-slot run t1038-a2 -- node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/tests src/framework/automation-service/service/project-build src/runtime/llm src/runtime/flow-authoring/bootstrap/candidate src/runtime/flow-authoring/bootstrap/unfinished-build src/runtime/models src/runtime/result-verification/site-change src/runtime/result-verification/tests src/programs`: parallel `Test Files 637 passed (637)`, `Tests 5627 passed (5627)`; real-sql `Test Files 166 passed (166)`, `Tests 848 passed (848)`; `all groups passed`.
  - Before pinning the importers above, 7 files failed (31 tests) because scripted JSON replies met a tools request; the same dirs now pass.
- After moving one test: `... --groups=parallel,real-sql src/runtime/llm/deepseek src/runtime/llm/step-log`: `Test Files 29 passed (29)`, `Tests 252 passed (252)`.
- `pnpm --filter fluxiq check` (heavy gate): no errors, `"reason":"inputs changed: packages/fluxiq; stored in the shared store"`. It ran before the final move of a test file between directories (imports only).
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (574 warning(s), 903 baselined).` An earlier run caught one import into another directory's file in my test; moved the test into `step-log/tests/`.
- Downstream `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 555 model-facing Core files, 14376 string literals)`.

## Not verified

- No live DeepSeek call: not proven that `tool_choice: "required"` with thinking disabled is accepted on `deepseek-v4-pro` (the docs example names `deepseek-flash`), nor how often DeepSeek returns several calls under `required`, nor that it accepts these schemas as non-strict `parameters` (`oneOf`-free variants, large `input` schemas).
- Prefix-cache behaviour of the tools placement is unmeasured. Token cost of the tools is not measured; the measure counts their bytes.
- `pnpm --filter fluxiq check` was not re-run after the test-file move (imports only); the later vitest runs and the structure audit passed.
- P4 replay of the t1015 recordings not done for DeepSeek: they are Anthropic-shaped decisions (A1's replay); no DeepSeek recording of tool replies exists.
- Full suites were not run, by rule. The two failing-outside-paths items from A1 (`judge-continues-decider`) were not touched; that file lives in `answer-first` and was not in my run.

## Open questions

- `session-key-provider.ts` now takes `decisionTools`; if the lead prefers no test-only seam, the alternative is rewriting the scripted endpoints of 7 framework test files to answer with tool calls.
- A1's `harness.ts`-style fakes read `outputSchema` from the user message; a future move of those endpoints to tools needs `body.tools` instead.
