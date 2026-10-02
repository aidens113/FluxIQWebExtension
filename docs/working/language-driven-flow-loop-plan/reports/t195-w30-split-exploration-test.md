# t195-w30: split deepseek-bootstrap-exploration.test.ts

## Outcome

Done. The 913-line test is now five files, each under the 400-line advisory threshold. No test's body or expectation changed. The same 11 tests pass, tsc is clean, and the structure audit passes.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime/` (Core worktree `fxwork/t195/!FluxIQ`).

**Deviation from the brief's file names.** `R/tests/` already held 25 source files, which is the `directory-files` limit (25). Adding any file beside the original would have failed the audit. Three or more non-test siblings named `deepseek-*` would also have tripped the prefix-group rule. So I followed the folder's existing convention (`R/tests/service-bootstrap/tests/`, `R/tests/service-flows/tests/`) and moved everything into `R/tests/deepseek-bootstrap/tests/`. The original file is deleted, so `R/tests/` now holds 24 files. That folder had no barrel, and I added none.

New files, all under `R/tests/deepseek-bootstrap/tests/`:
- `harness.ts` (316 lines): the shared stub harness. It holds `create`, `endpoint`, `lookBinding`, `webRuntime`, `sessionKeyPorts`, `KEY_ID`, `ACTOR`, `JUDGE_BILLED` and the `JudgeRequest`/`Creation` types. The temp-root `beforeEach`/`afterEach` hooks moved into an exported `useBootstrapTempRoot()`, which each test file calls once at top level. The hooks are the same, and each case still gets its own `mkdtemp` directory. Exported values: `create` and `useBootstrapTempRoot`.
- `observation.ts` (104 lines): the `DecisionObservation` type, `issueCodesForEvidence`, `PACKED_DRAFT_FIELDS`, `draftObservation` and `feedbackRows`.
- `replies.ts` (112 lines): the `Reply`/`JudgeReply` types, `LOOK_TOOL_ID`, `look`, `complete`, the private `recordsPlan`/`cannotAnswerCompletion`/`answeringCompletion`, `RECORDS_INSTRUCTION`, `repeatedBuildReply` and `JUDGE_NO`.
- `exploration.test.ts` (204 lines): the 8 exploration cases, which used to be lines 537-723.
- `answerability.test.ts` (219 lines): the "draft observation discriminator" (it tests the stub's draft reading that the answerability cases assert on) and the two answerability cases. Their history comments are unchanged, and they keep the original describe title.

Each file has a header saying what it holds. I copied the code by line range with `sed` and did not retype it. The only edits were `export` keywords, the relative import paths (two levels deeper) and the hook wrapper.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests` (in `packages/fluxiq`): "Test Files 2 passed (2), Tests 11 passed (11)". That is 3 in answerability and 8 in exploration.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w30 tsc" npx tsc --noEmit -p .` (in `packages/fluxiq`): "[heavy] t195-w30 tsc holds b2", then no diagnostics, exit 0.
- `node scripts/structure-audit.mjs` (Core root): "structure-audit: passed (214 warning(s), 349 baselined)". There were no findings for the new files. It also printed "1 baseline entries can be lowered", which was already there before this change.

## Not verified

No full suites were run, as the brief directs. I did not run `pnpm structure:baseline`.

## Open questions or contradictions found

- Two Core source comments still name the old path, and I did not touch them because they are outside my ownership:
  - `R/llm/evidence-loop/resume.ts:131`: "(t195-w29, `deepseek-bootstrap-exploration.test.ts`)". The case it means is now in `tests/deepseek-bootstrap/tests/answerability.test.ts`.
  - `R/llm/provider-retry/decision.ts:37`: "`runtime/tests/deepseek-bootstrap-exploration.test.ts`'s \"asks again after a ...\"". That case is now in `runtime/tests/deepseek-bootstrap/tests/exploration.test.ts`.
- The brief named the files `deepseek-bootstrap-harness.ts`, `deepseek-bootstrap-answerability.test.ts` and `deepseek-bootstrap-exploration.test.ts` beside the original. That is impossible under the 25-file directory limit, so I used the subfolder layout above.
