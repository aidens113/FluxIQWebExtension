# Integration F11: prompt, vocabulary and feedback tests on t722

Worker brief F11, Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t722/!FluxIQ`, branch
`task/t722-f-round-integration`. Paths below are under
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. All six failures were tests that had fallen behind deliberate, documented source changes on
Core `dev`. No source regressed, so no source changed. F5's loop-format clause
(`flow-bootstrap/plan/flow-script-format.ts`) did not affect any of the three files: none of them reads
the script format, and the `flow_bootstrap` pins still pass.

Sources the three tests cover, all read and left unchanged:
- `llm/diagnosis-instructions.ts` (`AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`), through
  `llm/deepseek/system-prompt.ts`.
- `flow-bootstrap/plan/record-output-contract.ts` (`KEYS`, the contract text and its `purpose` sentence),
  through `flow-bootstrap/plan/issue-feedback.ts` and the bootstrap catalog.

## What changed and why

1. `llm/deepseek/tests/system-prompt.test.ts` and `llm/deepseek/tests/system-prompt-pins.json`: 4 failures
   (`loop_verification` and `loop_verification_build_test`, with and without domain instructions).
   - **The test was out of date.** Commit 5a652d4a (t563, 2026-10-17, "Judge retrieval queries and
     stored-copy exclusion claims accurately") added three judge sentences on purpose: a search query
     retrieves candidates and is not a title requirement; apply a literal title requirement only when the
     request states one; judge each candidate's actual type. Its own tests are in
     `llm/tests/diagnosis-channel.test.ts`. It did not move the pins. The pins were last moved in
     7758f375 (t692, 2026-10-16).
   - A probe that diffed the built prompt against the pin showed exactly these three sentences as the only
     difference, inserted after "...answer unknown instead of accepting the authored condition.".
   - **Fix:** a script inserted the same three sentences at that place in both verification pins. It
     replaced only those two JSON string values, so the other nine pins are byte-for-byte unchanged. The
     test's header comment now records the t563 move, as it does for t653 and t660.
   - The sentences are generic: they name no site, product or answer.

2. `flow-bootstrap/plan/tests/issue-feedback.test.ts`, "names every issue at its path...": the
   `recordOutput` keys were missing `purpose`.
   - **The test was out of date.** Commit aa04a943 (t567, 2026-10-18, "distinguish explicit intermediate
     records from stored answers") added `purpose` to `KEYS` in `record-output-contract.ts`, to the parser
     (`packages/contracts/src/record-sets/output.ts` and `parse-output.ts`) and to the architecture doc. It
     updated `record-output-contract.test.ts` but not this test.
   - **Fix:** the expected `keys` now include `"purpose"`.

3. `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`, "is sent with the request...": the entry
   measured 4,394 bytes against a bound of 4,000.
   - **Where the growth came from.** Commit aa04a943 (above) added the `purpose` sentence (402 characters)
     to the contract text, plus " " and ", purpose" in the list of keys: 412 bytes in total, all ASCII.
     Before it the entry was 4,394 - 412 = 3,982 bytes, under the bound. No commit after aa04a943 touched
     `record-output-contract.ts` or `tests/web-domain-definitions-fixture.ts`. This size breakdown was
     measured with a probe on this tree: extractList 940, recordOutput 2,696, expectedState 192,
     timeoutMs 55.
   - **Why the text could not be brought back under 4,000.** That needs 394 of the 412 bytes cut.
     - Tightening the purpose sentence while keeping each of its meanings saved 11 bytes (402 to 391
       characters). Those meanings are: optional, absent means answer; validates and returns rows for
       computation and loops; never saves or clears an answer dataset, even with replace; cannot satisfy
       an answer table; refuses invalid or truncated rows and a nonempty process, with the remedy; reads
       and acts remain evidence. That saving was not worth rewriting another lane's text.
     - Cutting about 390 bytes elsewhere would mean removing the `process` sentences. Each of those was
       added for a specific run defect (t458, t510).
   - **Why the old bound is obsolete.** It was a tripwire set "just above the intended entry", which was
     3,982 bytes. aa04a943 changed the intended entry with a deliberate addition, documented in
     `docs/architecture/automation-studio-native-nodes.md` under "Intermediate rows". The author simply
     never ran this test.
   - **Fix:** following the convention t458 used when it moved the bound from 3,000 to 4,000, the bound is
     now 4,400, 6 bytes above the new intended entry. The comment records why it moved, by how much and
     which commit, so a later addition still trips it. The purpose text is unchanged.

The probe test files (`zz-f11-probe*.test.ts`) were created and then deleted. None remain.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t722/!FluxIQ`.

- Before any edit, `npx vitest run` on the three failing files (from `packages/fluxiq`) reproduced the
  sweep's 6 failures. extraction-vocabulary: 1 of 5 failed, "expected 4394 to be less than or equal to
  4000". issue-feedback: 1 of 20 failed, keys `+ "purpose"`. system-prompt: 4 of 32 failed.
- After the edits, `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests src/programs/automation-studio/runtime/llm/deepseek/tests src/programs/automation-studio/runtime/llm/tests`
  printed: Test Files 61 passed (61), Tests 862 passed (862).
- `pnpm --filter ./packages/fluxiq check` ran `tsc --noEmit` through the build cache: "build ... ms 108094",
  with no errors. A second run gave exit 0.
- `node scripts/structure-audit.mjs` printed "structure-audit: passed (406 warning(s), 1152 baselined)",
  exit 0.

## Not verified

- No full package suite, Lab run or browser run, as the brief instructed.
- I did not check how the larger contract text affects the model's behaviour.
- I did not measure the condensed catalog form, which also carries the purpose sentence; no test bounds it.

## Open questions or contradictions found

- Both source commits (5a652d4a on t563 and aa04a943 on t567) reached `dev` without these three directories'
  tests being run against them. Running the tests beside the changed files would not have caught them,
  because the failing tests sit in other directories: `llm/deepseek/tests` and `flow-bootstrap/plan/tests`.
  This is worth noting for the narrow-check rule: prompt-text changes in `llm/` and
  `record-output-contract.ts` also need `llm/deepseek/tests` and `flow-bootstrap/plan/tests`.
- The worktree also holds F10's uncommitted edits: `site-reset/words.ts`, `candidate/tests/trial-gate-reset.test.ts`,
  `project-agents/supervisor/tests/whole-trial.test.ts` and `service/project-build/tests/project-build-reset.test.ts`.
  I did not touch them. The vitest run and the check above included them as they stood.
