# t273-s2-w2-decision-grammar-and-wording

Worker report for "Brief: t273-s2-w2-decision-grammar-and-wording" (`t273-creation-wiring.md`, S2). Core tree `fxwork/t273/!FluxIQ`; R = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits, Lab, browser or provider calls.

## Outcome

Done. Tasks (1) to (5) are in place, with fail-first tests recorded. Two follow-ups sit outside my files: `R/llm/harness/provider-result.ts` still rejects `place` on a real provider's `tool_call`, and the Core architecture doc is stale. Both are under Open questions.

## What changed and why

- **`R/llm/evidence-loop-decision.ts`, task (1):**
  - `AUTOMATION_STUDIO_FLOW_DRAFT_ROUTE_PLACE_VALUE` is imported through the flow-draft barrel.
  - The authoring `tool_call` schema now offers `place` on every variant. The first call that can act gets it explained, with the ids' pattern (`.source` of the regex) and a description: "Once the draft shows route: the places on it this step is on, such as r1, or r1,r2 for two; none clears them. Implies add." Every other variant gets it bare as `{"type":"string"}`, with no pattern. This keeps the cost low on route-less builds, about 26 characters a tool, and the parser still holds every call to the ids.
  - `isToolCall` has `place` in its exact-key list and tests it with the new `validPlace`. A bad value fails the shape check, exactly as a bad `act` does, so the decision is `undefined`.
  - The parse result carries `place`, and `place` implies `add`, as `act` does.
  - `readAmendment` has `place` in its exact-key list, and a bad `place` drops that amendment, as a bad `act` does. A read amendment carries `place`.
- **`R/llm/evidence-loop/rerun-replacement.ts`, task (2):** under `takesItsPlace`, the rerun gets a copy of `replaced.places` and the attempt keeps none. Unlike `acts`, this holds for a read as well as a press, because a place says where the step is, not what it changes. The header comment is updated.
- **`R/flow-bootstrap/incomplete-draft/parse.ts`, task (3):** `keptStep` accepts `places` only as an array of `^r[1-9][0-9]?$` ids. Anything else refuses the whole record, as a bad `acts` does. `kept.ts` already keeps `places` through its `structuredClone`.
- **`R/llm/deepseek/request-body.ts`, task (4):** the second sentence of `FLOW_START_LOCATION_NOTE` uses the brief's exact text, and ends "...drop the steps that only travelled there; the completion accepts that only once Core has read that the person named no route." The header comment now describes D phase 2 enforcement and replaces "Lane D's detection ... not ported" with it.
- **`R/llm/diagnosis-instructions.ts`, task (5):** the brief's sentence is appended to `AUTOMATION_STUDIO_BUILD_TEST_VERIFICATION_INSTRUCTION`, with a provenance comment.
- **Tests:**
  - `R/llm/evidence-loop/tests/authored-draft.test.ts`:
    - A new describe, "the grammar of place", has 16 cases: parse on a call (5 values), beside `act`, 8 refused values, amendments read and dropped, and the schema (explained, bare, absent outside authoring).
    - The "costs one explanation, not one a tool" bound is raised from `468 + 4*120` (948) to `468 + 280 + 4*(120+30)` (1,348). The measured cost is 1,235, against 907 before `place`.
  - `R/llm/evidence-loop/tests/rerun-replacement.test.ts`: places carried for `mutate` and `observe` (2 cases).
  - `R/flow-bootstrap/incomplete-draft/tests/incomplete-draft.test.ts`: places round-trip, and 7 damaged shapes are refused.
  - `R/llm/deepseek/tests/request-body.test.ts`: the old "says how to get there" assertions are replaced with the new text.
  - `R/llm/tests/diagnosis-channel.test.ts`: the build-test prompt ends with the route sentence, and the finished-run prompt lacks it.
  - `R/llm/deepseek/tests/system-prompt-pins.json`: the `loop_verification_build_test` pin is moved by the appended sentence. The test file says "a pin moves only when Core's own prose does".
- Line endings are kept as CRLF in every touched file (checked: CRLF count equals LF count).

## Commands run and observed results

All `npx vitest` commands ran in `packages/fluxiq`.

- **Fail-first for (1)-(3), before any source change:** `npx vitest run` on the then-new `R/llm/tests/evidence-loop-decision.test.ts`, `rerun-replacement.test.ts` and `incomplete-draft.test.ts` gave "Tests 12 failed | 45 passed (57)".
  - Failures, (1): "expected undefined to deeply equal { kind: 'tool_call', …(5) }" and "expected undefined to deeply equal { type: 'string' }".
  - Failures, (2): "expected [ [ 'd2', 'kept', undefined ], …(1) ] to deeply equal [ …(2) ]".
  - Failures, (3): "expected { …(13) } to be null".
- **Fail-first for (4) and (5):** `npx vitest run` on `diagnosis-channel.test.ts` and `request-body.test.ts` gave "Tests 2 failed | 17 passed (19)".
- **After the source change:**
  - The 7 touched test files gave "Tests 1 failed | 153 passed". The failure was the schema-size bound: "expected 1235 to be less than 948". I raised the bound as described above.
  - Then `R/llm R/flow-bootstrap R/tests/deepseek-bootstrap` gave "Test Files 243 passed (243), Tests 2772 passed (2772)". The answerability draft budget is included.
- **Moving the grammar tests:** `node scripts/structure-audit.mjs` failed with "[directory-files] .../llm/tests/: 27 source files exceeds the 25-file limit". The other count was w3's new `evidence-loop-route.test.ts`, which also had a barrel-import violation that is w3's. I moved my grammar tests into `authored-draft.test.ts` (their existing home) and deleted the new file. Re-run:
  - 6 touched test files: "Test Files 6 passed (6), Tests 153 passed (153)".
  - `npx tsc --noEmit -p .`: exit 0, no output. This ran direct and uncached.
  - `node scripts/structure-audit.mjs`: "structure-audit: passed (253 warning(s), 349 baselined)".
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0. It printed "reuse ... waited 10.4s for pid 9008's run of this step, then inputs and outputs match the stamp", so it reused another worker's concurrent run; the direct `tsc` above is the uncached check.

## Not verified

- **No live, provider or Lab run.** Whether DeepSeek sends `place` in the intended shape is not checked.
- **The real provider path.** By reading, `R/llm/harness/provider-result.ts:211` accepts only `["kind","callId","toolId","input","add","act"]` on a `tool_call`. A real reply with `place` would get `llm_output.unexpected_field` before my parser sees it. I did not run this; it is a conclusion from the code.
- **The 2772-test run was a moment's snapshot.** It ran while w1 and w3 were editing; their later edits are not covered by it.

## Open questions or contradictions found

1. **`R/llm/harness/provider-result.ts:211` needs `"place"` in its `tool_call` allowed-field list.** This file is not in my brief and I did not touch it. Without the change, part (1) works only for the in-process grammar, not for a real provider reply. The `amend_draft` path is unaffected: amendments are only checked as records there.
2. **Stale doc.** `docs/architecture/automation-studio/llm-flow-bootstrap.md` (Core, around line 1926) still quotes "says how to get there" and says "The clause is wording only: Core does not detect a named route". It needs the new wording and the D phase 2 enforcement, and the `framework-reference` regeneration if the `request-body.ts` line numbers are referenced there.
3. **`authored-draft.test.ts` was not strictly in my owned list.** It is where `buildAutomationStudioLlmEvidenceLoopDecisionSchema` and the parse are tested, and its size bound had to move. I edited it with two small Edit calls (one new describe block, one bound, one import). If w3 also edits it, the supervisor should check the merge.
4. **The bare `place` carries no pattern, by choice.** Byte cost on every decision of every build outweighed consistency with `act`. If the lead wants the pattern on the bare variants too, it is about 59 more characters a tool, and the size bound would need about another 240.
