# t234 W9: the chat's interpretation cost goes into the Flow's creation purse

## Outcome

Done. The chat's panel-command call now reports what it cost. That cost travels with the interpretation to the command the turn runs. A build the command starts carries it in the Flow's creation purse, and it is saved into the creation-spend record. A refuted-result repair ignores it. W8's step-log scopes are wired into `creation-purse.ts`.

All paths below are under `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ/packages/fluxiq/src/programs/automation-studio/`.

## What changed and why

Contract choice (the narrowest one): `decide` still returns only the content. `AutomationStudioConversationModelExecution` gains an optional callback, `paid?(costUsd: number): void`. A model that does not price (test models, any non-DeepSeek model) never calls it, so nothing is carried for it, and no existing model or test needed changing.

- `runtime/conversations/instructions/model.ts`: adds `paid?` to the execution.
- `runtime/llm/deepseek/panel-command.ts`:
  - The envelope is now parsed once (`panelCommandEnvelope`). It returns the parsed value, or the parse error as a value. This replaces a `catch` that returned `undefined`, which the structure audit's failure-as-empty rule refused.
  - `panelCommandCostUsd` prices the envelope's `usage` with `estimateAutomationStudioDeepSeekCostUsd` and `automationStudioDeepSeekCacheHitInputTokens`. Counts the pricing refuses (RangeError) leave the reply unpriced; any other error is rethrown.
  - The cost goes to `execution.paid` before the HTTP status or content checks, so a reply Core cannot use is still counted.
  - Both helpers are module-private, to keep one export per file.
- `runtime/conversations/instructions/interpret.ts`: adds up every priced attempt, including unreadable ones and ones that fell back to the closest match. It sets `costUsd` on the interpretation only when at least one attempt was priced.
- `runtime/conversations/instructions/decision.ts`: `AutomationStudioConversationInterpretation.costUsd?`. `AutomationStudioConversationResponse` is now `Omit<Interpretation, "costUsd"> & {...}`, so the client wire answer is unchanged.
- `runtime/conversations/instructions/request.ts` and `runtime/conversations/conversations.ts`: `respondToPersonTurn` takes `costUsd` out of the response and returns it as `answer.interpretationCostUsd`. It does this on the write-failed path too.
- `runtime/conversations/commands/command.ts`: `AutomationStudioConversationCommandContext.interpretationCostUsd?`.
- `api/handlers/conversations.ts`: `commandContext` puts `answer.interpretationCostUsd` into the context for a person's turn. The confirmed-ask path carries nothing; it only runs delete/pay confirmations and never builds.
- `runtime/conversations/commands/build.ts`: adds `interpretationCostUsd` to the `generate-flow-bootstrap-adaptation` payload when the context has it.
  - This is the one function create-here, explore and improve all call, so all three pass it. `create-here.ts` itself needed no edit.
  - Improve is an extend build. It also passes the cost, because the creation purse opens for every non-repair build.
- `api/contracts/adaptation.ts`: `GenerateFlowBootstrapAdaptationRequest.interpretationCostUsd?` (documented).
- `api/handlers/llm-generation.ts`:
  - Adds the field to the allowed set.
  - Refuses anything but a finite, non-negative number with "Flow bootstrap generation request contains an invalid interpretation cost.", before the service is called.
  - Forwards the value only when it is present.
- `runtime/service/flow-bootstrap-commands/contracts.ts`: `AutomationStudioGenerateFlowBootstrapAdaptationInput.interpretationCostUsd?`.
- `runtime/service/flow-bootstrap-commands/generation-request.ts`: adds the field to `REQUEST_FIELDS`. It reads it as an optional finite, non-negative number and otherwise throws, so the caller answers `flow_bootstrap.invalid_input` as for other fields.
- `runtime/service.ts`: two lines edited in place (the destructure at 1477, and the purse call at 1550 gains `interpretationCostUsd`). It stays at 4490 lines, its baseline.
- `runtime/service/flow-bootstrap-commands/creation-purse.ts`:
  - `carriedUsd = record.spentUsd + (repair ? 0 : interpretationCostUsd ?? 0)`. Because `purse.spentUsd()` includes what was carried, the cost is saved into the record with the rest, or deleted with it when the creation ends.
  - `run` wraps the body in `automationStudioLlmStepLogScope.within({ part: repair ? "reauthor" : "creation" }, ...)`, inside the purse scope.
  - `reading` wraps each run in `automationStudioLlmStepLogScope.within({ phase: "read" }, ...)`.
  - W8's `within` was already present in `llm/step-log/scope.ts` when I compiled.

Tests added:

- (a) `runtime/llm/deepseek/tests/panel-command.test.ts`: a priced reply reports exactly `estimate(1200, 40, 1000, default model)`. An empty answer is still reported. No usage, or a negative count, reports nothing. With no `paid`, the call still answers.
- `runtime/conversations/instructions/tests/interpret.test.ts`: costs are summed over an unreadable attempt plus a good one, and over three failing attempts that fall back. A scripted model, or no model, gives no `costUsd`.
- `runtime/conversations/instructions/tests/respond-to-turn.test.ts`: `answer.interpretationCostUsd` is set and `response` has no `costUsd`.
- (b) `runtime/conversations/commands/tests/execute.test.ts`: create-here's build call carries `interpretationCostUsd: 0.0003`, and only the build call carries it.
- (c) `runtime/tests/service-bootstrap/tests/creation-spend.test.ts` (g): half the ceiling is carried and each call is priced at three tenths. One call is sent instead of three, the build ends on cost, and `record.spentUsd` is carried + one call.
- (d) the same file (h): a repair given `interpretationCostUsd: CEILING` still sends calls (it would send none if carried), and leaves no record.
- (e) `runtime/service/flow-bootstrap-commands/tests/generation-request.test.ts`: reads 0.0003 and 0, leaves the field out when it is absent, and refuses -0.0001, NaN, Infinity, `"0.0003"` and null.
- `api/handlers/tests/llm-generation.test.ts`: the endpoint forwards the value, leaves it out when absent, and refuses -1, NaN, Infinity, `"0.0003"` and null without calling the service.

## Commands run and observed results

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/w9-check.tsbuildinfo` (packages/fluxiq): exit 0, no output. Run after the source changes and again after the tests were added.
- The brief's set, run from packages/fluxiq: `npx vitest run src/programs/automation-studio/runtime/conversations src/programs/automation-studio/runtime/llm/deepseek/tests src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/service/flow-bootstrap-commands`. Final run: "Test Files 1 failed | 48 passed (49); Tests 1 failed | 320 passed (321)".
  - The one failure is `conversations/commands/tests/extension-chat.test.ts`, "improves an automation, asks before applying, sets the change aside on no and applies it on yes". The improve build ends "could not finish ... the steps it carried from the earlier Flow were never run in this build", so the expected pending ask is missing (line 300).
  - It is not mine. I copied my 15 source files to scratch, put HEAD's versions in their place, and reran that file alone: it still failed (1 failed, 7 passed). I restored the copies and `cmp` confirmed them byte-identical.
  - The worktree also holds other workers' edits: `llm/harness/run.ts`, `llm/provider-contract.ts`, `llm/deepseek/provider.ts`, `llm/deepseek/response-envelope.ts` and `llm/step-log/*`. The failure is either theirs or already on the branch.
- `npx vitest run api/handlers/tests/llm-generation.test.ts api/handlers/tests/conversations.test.ts api/contracts/tests`: 3 files, 37 tests passed.
- Fail-on-old-source check: I swapped my source files back to HEAD again (tests kept) and ran the 7 test files I touched. "Tests 8 failed | 66 passed (74)". The 8 failures are exactly the 8 new tests, and every earlier test passed. I then restored the files and checked them byte-identical.
- `node scripts/structure-audit.mjs` (worktree root):
  - First run: 1 violation, `[failure-as-empty]` in `panel-command.ts` at the JSON.parse catch. Fixed as described above.
  - Final run: "structure-audit: passed (219 warning(s), 349 baselined)". `service.ts` is 4490 lines, its baseline.

## Not verified

- The step-log scopes (`part` creation/reauthor, `phase` read) are wired but not tested here. No test enables `FLUXIQ_LLM_STEP_LOG_DIR` for a build, and with it unset `within` just calls the function. W8's own `llm/step-log/tests/scope.test.ts` covers the API itself.
- No live or Lab run (forbidden by the brief). The real DeepSeek reply's `usage` is assumed to have the OpenAI/DeepSeek shape the step log already reads.
- The end-to-end path from the conversation API handler through to the service build is covered in pieces only: handler to context is untested; context to build payload, payload to generate input, and generate input to purse are tested. `extension-chat.test.ts`'s scripted chat model does not price, so it does not exercise the carry.
- I did not update `docs/architecture` or the extension repo. The extension does not send `interpretationCostUsd`; Core fills it itself.

## Open questions or contradictions found

- The extension-chat improve failure above needs an owner. It fails with or without this change.
- Line endings: files I edited are LF in the working tree, while untouched files are CRLF (autocrlf=true, index LF). `git diff` shows only real changes and commits normalize to LF, so nothing is lost, but `git status` warns "LF will be replaced by CRLF".
- `confirmedExecution` (an answered command ask) carries no interpretation cost. Today those asks only gate deletes and payments, never builds. If a confirmed build is ever added, the cost of the original turn would need to travel on the ask.
