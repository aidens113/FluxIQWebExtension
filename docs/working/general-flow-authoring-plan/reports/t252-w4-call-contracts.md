# t252-w4-call-contracts: report

## Outcome

Done. All five items of the brief are in the t252 Core tree (`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`), and nothing is committed. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

I wrote the tests first and saw 19 of them fail before writing any code. The checks the brief names all pass:
- the tests beside the changed files
- `pnpm --filter fluxiq check`
- the structure audit

The only failing test is the known one, `recorded-windows` "everything-store-run4". It shows the same `D32 ... rerun.23 web.inspect.succeeded` loss that w1 reported.

I edited three files outside the named list. They are listed under "Edited outside the named files" below, with the reason for each.

## What changed and why

1. **`R/llm/node-tools/replay.ts`**
   - New exports for the names the domain mirrors:
     - `AUTOMATION_STUDIO_NODE_WRITE_KEY = "write"`
     - `AUTOMATION_STUDIO_NODE_REPLAY_ITEM_KEY = "item"`
     - `AUTOMATION_STUDIO_NODE_OUTPUTS_KEY = "outputs"`
     - `AUTOMATION_STUDIO_NODE_WRITTEN_CODE = "core.run_node.written"`
     - the type `AutomationStudioNodeReplayPass = { item?: JsonObject; parameters?: JsonObject }`
   - `automationStudioNodeReplayStepCall(step, pass = {})` and `automationStudioNodeReplayVerifyCall(step, pass = {})` now take an optional pass:
     - `pass.parameters` replaces `ranWith.parameters`.
     - `pass.item` is sent under `item`.
     - With no pass, both calls are byte-identical to before. A test pins this.
   - The written code is not a replay code, so `automationStudioNodeReplayStatus` reads it as `failed`. A test pins this too.
   - The two existing callers (`replay-draft.ts:174`, `run-flow-part.ts:78`) call with one argument and are unchanged.

2. **Tool execution result**
   - `R/llm/evidence-loop/tool-execution.ts` has two new members:
     - `outputs?: JsonObject`. Its doc says it is carried and never shown, because rows are page text.
     - `draft.written?: true`.
   - In the parser (`R/llm/evidence-loop-decision.ts`):
     - `"outputs"` is added to `AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS`, and `"written"` to the draft's exact key list.
     - `outputs` is kept only when it is a JSON object. Any other value is dropped, not refused, so without it the test simply runs the loop once.
     - `outputs` is not added to `evidence`, so the model never sees it.
     - `readCallRecord` now receives `resultCode`. It keeps `written` only when the value is the literal `true` and the code is `core.run_node.written`. Otherwise `written` is dropped, never refused.
   - `R/llm/evidence-loop/call-record.ts` copies `written: true` onto the record. The loop spreads the record onto the appended step, so `automationStudioFlowDraftStepIsProposable` (w1) sees it.
   - The check that `written` only comes with the written code is done once, in the parse. I first repeated it in `call-record.ts`, but that needed a runtime import of `node-tools/`, which created a module cycle (`completion-attempt.test.ts` failed with "automationStudioLlmEvidenceCompletionAttempt is not a function"). So the check lives only in the parse, and `call-record` trusts what the parse lets through.

3. **Decision parse** (`automationStudioLlmEvidenceParseDecision`)
   - The tool-call shape check moved into `isToolCall`, unchanged.
   - A new private `readNodeCall` applies only to `core.run_node`:
     - **With `write: true`**: the parameters are translated with w1's `automationStudioFlowDraftTranslateBindings`, and the call is sent with the `$state` parameters. A `$state` binding passes through unchanged. The decision gets `add: true`; `act` is kept.
     - **A refused translation**: the parse returns `undefined`, as for any shape refusal.
     - **Without `write`, or with `write: false`**: if `automationStudioFlowDraftHoldsBinding(parameters)` finds a binding form or a `$state` anywhere, the parse returns `undefined`.
     - Every other tool, and a live call with concrete values, parses as before.
   - The refusal codes are exported:
     - `AUTOMATION_STUDIO_LLM_EVIDENCE_BINDING_NEEDS_WRITE_CODE = "run_node.binding_needs_write"`
     - `AUTOMATION_STUDIO_LLM_EVIDENCE_BINDING_REFUSED_CODE = "run_node.binding_refused"`
     - `automationStudioLlmEvidenceDecisionIssueCodes(value)`, which uses the same reader as the parse.
   - A refused translation gives one generic code followed by one code per binding: `run_node.binding_refused.<reason>:parameters.<path>`. When the path is not code-shaped, the code is just `.<reason>`.
   - Names from `node-tools/` (`core.run_node`, `write`, `core.run_node.written`) are written out again as private constants, not imported. `node-tools/` already imports this module by value (`loop-tools`, `replay-draft`, `run-flow-part`, `step-place`), so importing back would be a cycle; `evidence-loop/rerun-input.ts` handles the same problem the same way. The tests drive the parse with the exported node-tools constants, so the two copies cannot drift without a test failing.

4. **`R/llm/node-tools/run-node.ts`**
   - `write` is in the schema as an optional boolean. `required` is unchanged.
   - `WRITE_DESCRIPTION` covers D8:
     - the step is written without running it, nothing is done, and it is checked, frozen, added, and run by the test
     - use it once what you have seen is enough
     - "prefer write for a lasting act on items a loop selects: the test acts on exactly the items the Flow selects"
     - declare consequences as for a run
   - `PARAMETERS_DESCRIPTION` names `{"$input": "<name>", "test": <the value to test with>}` and `{"$row": "<field>"}` for a written step, and says that a call that runs now takes concrete values only.
   - The tool's main description is unchanged. It is 1,488 characters against the test's 1,500 limit, and a one-clause mention of `write` took it to 1,532. So the wording is on the property instead, and the test now pins the limit on that path too.

5. **Texts**
   - Policy (`evidence-loop-decision.ts`): "run each step it needs once and add it" is replaced, per D8:
     - run steps to learn what works and add the ones the Flow needs
     - you may also write a step without running it (core.run_node with write true)
     - repetitive work is a loop, not a sequence: list with a where, do or write the act once on one kept item, state repeat, never do it to every item
     - a value that changes is bound (`{"$input": ...}`, `{"$row": ...}`), never typed in
     - The two phrases pinned elsewhere are kept word for word ("Never mutate merely to perform an eventual workflow step", "never repeat a successful mutation merely to try another eventual-workflow value").
   - `add` description: "put its step into the Flow now -- a step you run or write; write true implies add. ...". The existing test regex `/put its step into the Flow/` still matches.
   - `bootstrap-completion.ts` `DRAFT_SCRIPT_NOTE`: "-- add, drop, reorder, rerun, repeat, bind -- or run or write the step it is missing and add it (write true adds it), then finish again."

### Edited outside the named files (please review)

- **`R/llm/evidence-loop/decision-refusal.ts`** (3 lines and 1 import). When the parse gives no decision, it now uses `automationStudioLlmEvidenceDecisionIssueCodes(raw)` before falling back to `decision_shape_invalid`.
  - Why: the parse's only refusal path is to return `undefined`, which this file turns into the single code `llm_evidence_loop.decision_shape_invalid`. That code cannot name a path or a reason, nor carry D1's sentence.
  - The usage on the refused reply is still counted as before.
- **`R/llm/unusable-decision.ts`**: two entries in `ISSUE_INSTRUCTIONS`.
  - `run_node.binding_needs_write`: "A binding runs only in the Flow; write the step (write true), or run it with the value and bind it after (amend_draft bind)." This is D1's sentence plus the amendment's name.
  - `run_node.binding_refused`: where and why, the two accepted forms, `test` required, and `$step` not yet available.
  - Why: the feedback the model is shown is issue codes plus this map, so without it D1's sentence would never reach the model.
- **`R/llm/deepseek/tests/system-prompt-pins.json`**: the pin for `evidence_tool_decision` changed. This is an assertion that pins the policy text, so the brief allows it, but it sits under `R/llm/deepseek/`, which the brief lists as must-not-touch. I read that entry as meaning the provider source. The change is the old policy clause replaced by the new one, byte for byte; nothing else in the file changed (`git diff --stat`: 1 line). The test header says "a pin moves only when Core's own prose does".

Neither `evidence-loop.ts` nor any new file in `R/llm/evidence-loop/` was touched.

### Assertions that pin these texts

- `R/llm/tests/evidence-loop-provider.test.ts:61-62`: still passes, because the phrases are kept.
- `R/llm/evidence-loop/tests/authored-draft.test.ts` (the `add` regex): still passes.
- `R/llm/deepseek/tests/system-prompt-pins.json`: re-pinned, as described above.
- `R/llm/node-tools/tests/run-node.test.ts`: the length limits still pass.

### Tests

- **New: `R/llm/node-tools/tests/replay.test.ts`**
  - the exported names, and the written code read as `failed`
  - calls with no pass are unchanged; a pass carries the row and the resolved parameters; either can be given alone; a step that never ran still gives no call
- **`run-node.test.ts`**: `write` is offered and optional, its description, the length limit, and the binding forms in the `parameters` description.
- **`authored-draft.test.ts`**, three new describe blocks:
  - "a written step's answer":
    - `written` is kept only beside the written code
    - a `written` that is not `true` is withheld, not refused
    - `outputs` is carried only as an object and is never in the evidence
    - the record copies `written`
    - in a loop, a written step ends up `kept` with `written: true` and `effectApplied: false`
    - a domain that ignored `write` and acted gives an ordinary kept step
  - "the decision parse of a node call":
    - `write` implies `add`, and the forms are translated
    - `act` is kept
    - a malformed binding and a `$step` binding are refused with their paths
    - a live call with a form or a `$state` is refused as needing write
    - other calls are untouched
    - end to end through the loop: `executeTool` is never called, and the feedback carries the codes and D1's sentence
  - "the policy where the result is a Flow": the policy text and the `add` text.
- **`bootstrap-completion.test.ts`**: a draft refusal's `previous` contains "run or write the step it is missing".

## Commands run and observed results

Every vitest command was run from `packages/fluxiq`.

- **Before any code** (`npx vitest run <R>/llm/node-tools/tests/replay.test.ts <R>/llm/node-tools/tests/run-node.test.ts <R>/llm/evidence-loop/tests/authored-draft.test.ts <R>/llm/harness-options/tests/bootstrap-completion.test.ts`): `Failed Tests 19`. The new names were not exported, the parse did nothing new, and the texts were unchanged.
- **The same files after implementing**: 1 failed, the run-node description at 1,532 against 1,500. I fixed it by moving the clause onto `write` (see item 4).
- **Directories beside every changed file** (`npx vitest run <R>/llm/node-tools/tests <R>/llm/evidence-loop/tests <R>/llm/harness-options/tests <R>/llm/tests <R>/llm/stages/tests <R>/llm/deepseek/tests <R>/flow-draft/tests <R>/flow-bootstrap/tests <R>/llm/decision-context/tests <R>/llm/decision-handlers <R>/llm/evidence-progress <R>/activity`):
  - **First run**: 3 failures in `deepseek/tests/system-prompt.test.ts`, the policy pin, which I re-pinned.
  - **After switching to barrel imports**: one new failure in `completion-attempt.test.ts`, the module cycle described in item 2, which I fixed.
  - **Final run**: `Test Files 1 failed | 145 passed (146)`, `Tests 1 failed | 1428 passed (1429)`. The one failure is `recorded-windows.test.ts` "everything-store-run4", with the diff `- "D32 amend_draft | rerun.23.place core.replay.replayed | rerun.23 web.inspect.succeeded"` / `+ "D32 amend_draft | rerun.23.place core.replay.replayed"`. That is the known failure, which t253 fixes on dev.
- **`pnpm --filter fluxiq check`**:
  - The first run gave one error of mine: a union narrowing in `bootstrap-completion.test.ts`. I fixed it with a guard.
  - Then `check exit 0`, with no tsc output.
  - The last run, after the final edits, printed only the build-cache line ("stored in the shared store") and no errors.
- **`node scripts/structure-audit.mjs`**, from the Core root:
  - The first run gave two `[imports]` FAILs, for reaching `./node-tools/replay.ts` instead of the barrel. Going through the barrel caused the cycle above, so the names are now written out locally and the imports are gone.
  - Final: `structure-audit: passed (226 warning(s), 349 baselined)`.
  - New advisories on my files, none of them failures:
    - `evidence-loop-decision.ts`: 626 lines and 14 exported values
    - `replay.ts`: 12 exported values
    - `authored-draft.test.ts`: 546 lines

## Not verified

- The full suite, and anything outside the directories listed above.
- An end-to-end run against the web domain. The domain's `write` and `outputs` (w3) and this Core side have not been run together, and there was no live or browser run.
- `docs-reference --check` and the architecture docs. AGENTS asks that wire-protocol changes reach the architecture documentation; P4 owns the docs.
- How P3 will use `pass` and `outputs`. The shapes are as D6 describes, but nothing reads them yet.

## Open questions or contradictions found

1. **Ownership.** The refusal path needed `decision-refusal.ts` and `unusable-decision.ts`, which are outside the named files, and the policy pin sits under `R/llm/deepseek/`. Details are under "Edited outside the named files". If they are unwanted, the parse still refuses, but the model sees only `decision_shape_invalid`.
2. **`produced` on a pass.** When a step call carries a pass, it still sends the explored row's `replay.produced`. For a different row, a host comparing against `produced` might answer `changed`. P3 should decide whether a pass with an `item` omits `produced`.
3. **Reruns are not checked.** An `amend_draft rerun` whose patch holds a binding form turns into a tool call in the decision handlers without going through this parse, so the "needs write" refusal does not apply to it. D2 sends bindings through `bind`, so this only matters if a model puts forms in a rerun patch.
4. **A `$state` in a live call is refused as needing write.** The brief says "any form"; I included a stored `$state` too, because it would reach a live node as an object.
5. **The refusal codes are under `run_node.*`, as the brief names them**, not `llm_evidence_loop.*` like the loop's other decision codes. The code carrying the path is cut back to just the reason when the path is not code-shaped (the code rule is `^[a-z0-9_.:-]{1,100}$`).
6. **`write: true` with parameters that are not an object** is sent to the host as written and left for the host to refuse; I did not refuse it in Core.
