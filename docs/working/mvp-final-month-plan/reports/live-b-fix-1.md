# live-b-fix-1: the finished-run check sees what each step changed

Worker report for brief live-b-fix-1 (lane B live lead). All changes are uncommitted in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ`.

## Outcome

**Done.** Each `resultSummary.flowShape` step now carries `changed`. It is taken from this session's in-memory trace (`session.trace.attempts[].stateRefs.stateDiff`) and holds one `{ added?, removed? }` entry per run of the step, in run order. There is nothing for a run whose diff reports `locationChanged: true`. It is screened like the end view and named to the judge in one instruction sentence. The pre-send evidence check still sends the request, which the new test asserts.

## What changed and why

Paths are under `packages/fluxiq/src/programs/automation-studio/runtime/` unless stated.

- **`result-verification/step-changes.ts`** (new). It exports one function, `automationStudioResultStepChanges(attempts, deniedEvidenceKeys)`, which returns `{ byNode: Map<nodeId, changes[]>, withheld }`.
  - It reads the diff's `locationChanged`, `added` and `removed` and nothing else. No refs, locations or counts are forwarded. Lines are passed on exactly as the domain joined them, with no cap and no interpretation.
  - Screening works the same way as `automationStudioResultEndView`:
    - Without a denied-keys declaration, nothing is carried (and `withheld` is set if there was something to carry).
    - `screenAutomationStudioLlmEvidence` is run over the domain's whole diff object. A denied key or a credential-shaped value withholds that step's change.
    - `automationStudioWithoutLocators` redacts locator-shaped runs.
    - Each of these sets `withheld`.
  - The attempt type is a local structural type (`{ nodeId; stateRefs?: { stateDiff? } }`), so the module does not import the executor.
- **`result-verification/contracts.ts`**: added `changed?: Array<{ added?: string; removed?: string }>` to `AutomationStudioResultFlowStepSummary`, with a doc comment that cites this run.
- **`result-verification/result-summary.ts`**:
  - New input `sessionAttempts`.
  - It calls `automationStudioResultStepChanges`, attaches `changed` to each flowShape step by nodeId, and ORs the result into `withheld`.
  - Added a header comment paragraph.
- **`result-verification/run-outcome.ts`**: `runVerification` passes `sessionAttempts: session.trace.attempts` when a trace exists. This adds 2 lines; the file is now 798 lines against the 800 hard limit.
- **`result-verification/index.ts`**: `export * from "./step-changes.ts"`.
- **`llm/diagnosis-instructions.ts`**:
  - Added one sentence to `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`, right after "It shows the end only, not each step.":
    > resultSummary.flowShape[].changed, where present, is what this run saw that step change on the page it stayed on, once for each time it ran and in order (added: the view lines that appeared; removed: those that left; a step that moved to another page carries none): read each act's own change before endView, which shows only the end.
  - Added a comment paragraph above it that cites `run-muw5zv4m-52d83027`. It uses no site-specific words.
- **`llm/harness/request-evidence-check.ts`**: `sendableResultSummary` now refuses a summary whose `flowShape[].changed` contains a locator-shaped string. This is the same builder/check contract `buildTest` already has. The existing credential check already covers the whole summary.
- **Tests**:
  - New: `result-verification/tests/judge-sees-each-step.test.ts`, with 5 tests:
    - end to end through `verify()`: s9 navigates and carries nothing, s10 carries one change, s11 run twice keeps both changes in order, and the request passes `automationStudioLlmRequestEvidenceRefusal`;
    - a drifted locator line is refused before sending;
    - no declaration means nothing is carried and `withheld` is set;
    - a denied key or credential-shaped diff withholds only that step;
    - locator redaction.
  - `llm/tests/diagnosis-channel.test.ts`: added one `it` that pins the new instruction sentence.
- **`llm/deepseek/tests/system-prompt-pins.json`**: re-pinned. The sentence appears in both the `loop_verification` and `loop_verification_build_test` pins (2 occurrences). This file is outside the brief's listed test directories (see Open questions).
- **`docs/architecture/automation-studio.md`**: added one paragraph after the existing `flowShape` evidence paragraph, at about line 427. `grep endView` under docs/ found no architecture paragraph; this `flowShape` paragraph is the one that describes the check's evidence.

**Design choices**

- The field is named `changed`, matching the build-test judge's `observed.changed`. It is forwarded as the domain's strings, not split into lines.
- Every traced attempt is included regardless of status, because a failed attempt that changed the page still changed it.
- An attempt whose diff has no added or removed lines carries nothing.
- Locator redaction sets `withheld`, as `build-test/change-lines.ts` does.
- The whole diff object is screened, not only the lines that are sent. This is fail-closed: a credential-shaped location would withhold that step's change too.

## Commands run and observed results

Run from the Core tree root `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ`.

**1. Before the fix:** `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/judge-sees-each-step.test.ts` printed `Tests 5 failed (5)`. Each failure was an assertion failure, for the right reason:
- `carries each step's change ...`: `expected undefined to deeply equal [ { …(2) } ]`
- `carries none without a declaration ...`: `expected false to be true` (withheld)
- `withholds a step ...`: `expected undefined to deeply equal [ { added: 't931 "2"', …(1) } ]`
- `redacts a locator-shaped run ...`: `expected undefined to deeply equal [ Array(1) ]`
- `is named to the judge ...`: `expected 'Put your reading of the failure in th…' to contain 'resultSummary.flowShape[].changed'`

**2. After the fix:**
- The same command printed `✓ ... judge-sees-each-step.test.ts (5 tests)`, `Tests 5 passed (5)`.
- `pnpm.cmd --filter fluxiq exec vitest run <R>/result-verification/ <R>/llm/tests/ <R>/llm/deepseek/tests/ <R>/llm/harness/tests/` printed `Test Files 84 passed (84)`, `Tests 972 passed (972)`.
- `pnpm.cmd --filter fluxiq check` exited 0 (tsc --noEmit, no errors).
- `node scripts/structure-audit.mjs` exited 0: `structure-audit: passed (258 warning(s), 349 baselined).` An earlier run had failed on `[imports]` because the new test reached into `llm/` files; that was fixed by importing from `../../llm/index.ts` and moving the instruction assertion into `llm/tests/diagnosis-channel.test.ts`.
- The new advisory warnings are only `result-verification/tests/: 17 source files` (the folder was already past 15) and `run-outcome.ts: 798 lines`.

**3. `git status`:** only the files listed above changed; `step-changes.ts` and the new test are untracked. The downstream repository was not touched by me.

## Not verified

- No Lab, live or provider run, as the brief required. Whether the real web diff for a "+" press reads `t931 "1"` → `t931 "2"` in `removed`/`added` was not checked; the test uses lines shaped like the brief's description.
- The instruction assertion that moved into `diagnosis-channel.test.ts` was not separately run red against the pre-fix code. The same assertion did fail red in the first version of the new test (item 5 above).
- The full suite was not run.

## Open questions or contradictions found

- **Pin file outside the listed directories.** `llm/deepseek/tests/system-prompt-pins.json` pins the verification system prompt byte for byte. Any instruction sentence moves it, so I re-pinned it (a mechanical insertion of the same sentence). It is outside the brief's listed `llm/tests/`.
- **Vitest import-order cycle.** If a test imports an `llm/` module before `result-verification/result-summary.ts`, the llm barrel is evaluated mid-cycle and arrives without `screenAutomationStudioLlmEvidence` ("is not a function"). The new test imports the modules under test first and says why in a comment.
  - `result-summary.ts` already imported that barrel the same way, so this is not new exposure in production, where ESM `export *` is live.
- **Line budget.** `run-outcome.ts` is at 798 of 800 lines; the next edit there will need a split.
- **Persistence.** `changed` lives only on the in-memory summary. `recovery/refuted-result/history.ts` does not copy flowShape changes, so nothing new is persisted. The summary is still handed to the refuted-result repair port as `resultSummary`, as `endView` already is.
