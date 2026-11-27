# Brief t1093: strict tools fit the provider's grammar; a refused request says why

**Goal.** Every build the user started from the web panel failed with "The build failed: the model could not be
reached". The user's step log for the panel (`FLUXIQ_LLM_STEP_LOG_DIR`) shows the cause:
- The first `evidence_tool_decision` request (project mode, role `supervisor`, Haiku) sent 12 tools, 8 of them strict:
  `complete`, `web_detect_repeating_structure`, `web_describe_element`, `core_describe_nodes`, `core_recall_result`,
  `project_write_plan`, `project_assemble` and `core_test_candidate`.
- Anthropic answered HTTP 400 in 177 ms: "The compiled grammar is too large, which would cause performance issues.
  Simplify your tool schemas or reduce the number of strict tools." Sonnet refuses the same body.
- Core recorded `llm.provider_http_error` with `reply: null`, dropping the API's message, and worded it "the model
  could not be reached".

The same refusal hit t1087's strict judge answer earlier today. `decision-tools-wire.ts` counts the documented limits
(20 strict tools, 24 optional parameters, 16 unions) but not the compiled grammar's size. The structured-outputs page
gives that limit no number.

**1. The strict set always fits.**
- When the platform refuses a request for its compiled grammar, Core demotes strict tools to non-strict in a
  deterministic order and sends again, until the platform accepts.
- It remembers the accepted strict set for that exact tool set (its digest), so every later request of the process
  sends the same bytes. Prompt caching depends on that.
- The order: the tools whose schemas cost the grammar most go first, and `complete` keeps strictness longest. Measure
  cost by the schema's own size; never by a fixed count.
- This is the platform's refusal, answered by changing the request. It is not a retry cap, and no count ends it: each
  pass removes one strict tool, so it ends by itself.
- The refusal itself is free.
- A non-strict tool's input is still validated against its unchanged schema, as today.

**2. A refused request says why.**
- A 4xx from the provider keeps the API's own error type and message in the failure, in the step log
  (`decision.json`), and in the activity.
- Screen it as every provider text is screened; never a key or header.
- The words become "the model provider refused the request: <its message>", not "could not be reached".
- Keep "could not be reached" for real network failures only. That is
  `runtime/automation-activity/wording/failure-code-words.ts:26` and `runtime/conversations/instructions/interpret.ts:212`.

**3. Answer-first is the product default.**
- `AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT` (`flows/authoring/model/authoring-mode/authoring-mode.ts`) becomes
  `answer-first`, the user's 2026-11-03 direction ("one-time exploration ... then simulation").
- Since then every Lab run and every fix has been in this mode. `project` stays selectable through
  `FLUXIQ_AUTHORING_MODE`.
- Update the header's history and every test that pins the default.

**4. A provider contract check.**
- Add a script in Core `scripts/` that builds the exact first request of each role and authoring mode, with Core's
  real tools, and posts each to Anthropic with a small `max_tokens`. It prints only the status and the error.
- A refusal is free; an acceptance costs about $0.01-0.03.
- It reads `CLAUDE_API_KEY` from an env file passed as an argument and never prints it.
- Do not run it; the lead runs it. Document it in Core's provider architecture doc.

**Fixtures.** The failing request body is at
`C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/panel-steps/0003-decide/request.json`.
- Copy only its `tools` into a fixture.
- Check that it holds no key; it holds none, but check.
- Also use t1087's `run-mwz2jc4w-0088-tools.json`.
- Tests: the panel's tool set, after one simulated grammar refusal per demotion, ends with a set the wire accepts, with
  stable bytes; the 0088 set is untouched; a 400's message is kept and worded; a network error still reads "could not
  be reached".

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1093/!FluxIQ`):
- `runtime/models/providers/anthropic/**`;
- `runtime/llm/anthropic/**`;
- `runtime/models/failures/**`;
- the two wording files above;
- `flows/authoring/model/authoring-mode/**`;
- the tests that pin the default;
- `scripts/` (the new check);
- the provider architecture doc.

**Must not touch.** `framework/automation-service/service/answer-first/result/**`, `answer-first/result-feed/**`
(t1091, not yet merged into Core), `domain/src/**`, and `packages/test-runner/**`.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1093-<label> -- <cmd>`.
- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/models src/runtime/llm src/runtime/automation-activity src/runtime/conversations src/flows/authoring`
  from `packages/fluxiq`.
- `pnpm check` in `packages/fluxiq`. Vitest does not type-check.
- `node scripts/structure-audit.mjs` (Core) and `node scripts/check/model-text.mjs` (downstream).

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1093.md` in the downstream tree, ending with the return
contract.
