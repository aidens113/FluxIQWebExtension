# t378 w9: LLM fixups (audit, submission key, refusal-run words)

## Brief

### Brief: t378-w9-llm-fixups (worker)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Context: W3 changed the repeat guard and refusal run (report `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w3-repeat-and-envelope.md`); W1 changed the refusal key in `R/flow-bootstrap/candidate/submission-refusal.ts` to `<category>:<8-hex digest of code@line>` (report `w1-refusal-locator.md` beside it).
- Task:
  1. Structure audit violations (from `T/!FluxIQ`, `node scripts/structure-audit.mjs`): `as-never` at `R/llm/decision-handlers/tests/candidate-repeat-told.test.ts:29` (write a typed stub or `satisfies`), and `failure-as-empty` at `R/llm/repeat-guard/outcomes.ts:356` (let the error propagate, or fail closed with an error that says what could not be read, or name the one failure that means absent and rethrow the rest). Read the audit's message for each.
  2. An identical `core.submit_candidate` resubmission is caught even when only `summary` differs: lane B's 0060 sent the refused script again without `summary` and ran instead of being refused, because the repeat key is the whole input. Key a submission on its Flow content (`flow`, or `plan`) only. Fail-first test.
  3. The refused-in-a-row warning (`R/llm/decision-handlers/refusal-run.ts`) must not show the model the digest suffix of the refusal key: say the same issues were refused again in words (the category or the issue codes and lines), never `...:3fa2b1c9`. Fail-first test.
- Owns: `R/llm/repeat-guard/**`, `R/llm/decision-handlers/**`, and their tests.
- Must not touch: every other file, any other tree, lab slots or processes. Other workers edit other Core files now; an error only in a file you do not own is theirs: record it, do not fix it.
- Definition of done: `npx vitest run` on `R/llm/repeat-guard`, `R/llm/decision-handlers` and `R/llm/evidence-loop/tests` from `T/!FluxIQ` passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files; the structure audit shows no violation in your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w9-llm-fixups.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done. One test outside my files (W1's `submission-refusal.test.ts:86`) now fails because it asserts the old behaviour item 3 removes; it needs a one-line update by its owner (see Open questions).

## What changed and why

All under R.

1. **Audit.**
   - `llm/decision-handlers/tests/candidate-repeat-told.test.ts`: the `execute as never` stub is replaced by `executor(resultCode)`, which returns a typed `AutomationStudioLlmEvidenceLoopInput["executeTool"]`; `loop()` now calls `loopWith(executeTool, ...)`.
   - `llm/repeat-guard/outcomes.ts` (`refusalIssues`): the bare `catch { return undefined; }` now names the one failure that means "listed no issues" (`SyntaxError`: an answer in plain words, not JSON) and rethrows anything else.
2. **Submission key.** `llm/repeat-guard/outcomes.ts`: the call key goes through a new private `keyedInput(toolId, input)`. For `core.submit_candidate` it keeps only `flow` and `plan` (whichever are present; the whole input if neither is). Every other tool is still keyed on its whole input. A header paragraph cites lane B 0058-0060.
3. **Refusal-run words.** `llm/decision-handlers/refusal-run.ts`: new private `reasonWords(kind, evidence)`. When the kind ends in `:<8 hex>`, it removes the suffix. `refusal` then carries the kind without it (e.g. `call:flow_bootstrap.completion_refused`), and the instruction's reason reads `<category>, the same issues each time: <code> at line <n>; ...`. The issues are taken from the latest refused evidence entry that lists any, which is the submission just counted: the loop pushes it at `evidence-loop.ts:469` before `RefusedCallRun` at line 509. When no issue is listed, it uses `<code> at <path>` or the bare code. Kinds without a digest (amendments, rerun, plain call codes) read exactly as before. The counting key passed to `refusalRun.refused` is unchanged, digest included, so W1's "same issues" counting still holds.
4. **Tests (fail-first).**
   - New `llm/repeat-guard/tests/submission-key.test.ts` (4): a summary that differs or is left out is the same key; a plan submission is keyed on its plan; a changed Flow runs; other tools are still keyed on their whole input.
   - New case in `candidate-repeat-told.test.ts`: with resultCode `flow_bootstrap.completion_refused:3fa2b1c9`, the warning's JSON does not contain `3fa2b1c9`, and the instruction names the category and `authoring.repeat.bound_inside_span at line 27`.

## Commands run and observed results

All from `T/!FluxIQ`.

- **Fail-first**, before any source edit: `npx vitest run .../decision-handlers/tests/candidate-repeat-told.test.ts .../repeat-guard/tests/submission-key.test.ts` printed `Tests 3 failed | 4 passed (7)`.
  - The 2 key tests got `expected undefined to be 'submit-flow-1'`.
  - The digest test failed because the warning contained `"refusal":"call:flow_bootstrap.completion_refused:3fa2b1c9"` and `(call:flow_bootstrap.completion_refused:3fa2b1c9)`.
- **After the edits:** `npx vitest run <R>/llm/repeat-guard <R>/llm/decision-handlers <R>/llm/evidence-loop/tests <R>/flow-bootstrap/candidate/tests` printed `Test Files 1 failed | 50 passed (51)`, `Tests 1 failed | 435 passed (436)`. The only failure is `flow-bootstrap/candidate/tests/submission-refusal.test.ts` "ends the round at the third refusal ...": `expected { ok: false, …(5) } to match object { …(3) }`. That is its line 86 regex, which requires the digest in `refusal`. All the brief's required directories (repeat-guard, decision-handlers, evidence-loop/tests) pass.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` printed nothing and exited 0.
- `node scripts/structure-audit.mjs` printed `structure-audit: 3 violation(s) across 3 rule(s)`, none of them in my files. All three are in `runtime/executor/`, which belongs to other workers:
  - `as-never` in `executor/tests/slowdown-recovery-words.test.ts:47`;
  - `directory-files`: `executor/tests/` has 26 files, over the limit of 25;
  - `file-lines`: `executor/graph-run.ts` has 814 lines, over the limit of 800.
  The two violations in my files are gone.

## Not verified

- No live run or provider call.
- No full suites.
- In a real loop, the issues the warning names come from the latest refused evidence entry. If another note listing `ok:false` issues were pushed after the submission and before the count, the warning would name that note's issues instead. I found no such push between `evidence-loop.ts:469` and `:509`, but I did not trace every handler.

## Open questions or contradictions found

- `R/flow-bootstrap/candidate/tests/submission-refusal.test.ts:86` (W1's file, not mine) expects `refusal` to match `/^call:flow_bootstrap\.evidence_completion_parameters_unresolved:[0-9a-f]{8}$/u`. The brief says the model must never see the digest, and `refusal` is shown to the model, so the expectation should become `refusal: "call:flow_bootstrap.evidence_completion_parameters_unresolved"`. The same-issues counting is still covered by that test's `decided()`/stall assertions and by its third case.
