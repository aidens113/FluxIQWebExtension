# t189-wB2: split `evidence-loop.ts` by responsibility

R = `packages/fluxiq/src/programs/automation-studio/runtime` in Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQ` (branch task/t189-decision-context).

## Outcome

Done. `R/llm/evidence-loop.ts` went from 800 to 636 lines (the target was 680 or
fewer). Behaviour is unchanged: all three suites have the same file and test
counts before and after, tsc is clean, and the structure audit passes with no
finding on the new directory.

## What changed and why

New directory `R/llm/decision-handlers/` holds six files, each with its own
comments moved along with it. No other directory gained files. `R/llm/` stays at 21
source files and `R/llm/evidence-loop/` at 23. No file under `decision-context/`
was created or touched.

| File | Lines | What it holds |
| --- | --- | --- |
| `types.ts` | 94 | `AutomationStudioLlmEvidenceDecisionHandlerContext`, `AutomationStudioLlmEvidenceDecisionNext`, `AutomationStudioLlmEvidenceLoopCounters`, `AutomationStudioLlmEvidenceRowTransition` (was the loop-local `RowTransition`) |
| `completion.ts` | 46 | `automationStudioLlmEvidenceHandleCompletion`: the whole `complete` branch (was ~590-618) |
| `amendment.ts` | 96 | `automationStudioLlmEvidenceHandleAmendment`: the whole `amend_draft` branch (was ~619-698) |
| `failed-call.ts` | 51 | `automationStudioLlmEvidenceHandleFailedCall`: the `toolFailed` closure (was 378-406) |
| `answered-request.ts` | 45 | `automationStudioLlmEvidenceHandleAnsweredRequest`: the `answerRequest` closure (was 407-438) |
| `index.ts` | 11 | barrel |

The cuts:
- **complete and amend_draft**, as recommended. Each handler returns what the loop
  does next: `{ kind: "continue" }`, `{ kind: "end", result }`, or, for amend only,
  `{ kind: "rerun", decision, replaces }`. The loop still sets `rerunning`,
  `rerunReplaces` and `decision` from a rerun, and the "From here the rerun is an
  ordinary call" comment stays in the loop because it explains the loop's
  `!rerunning` check.
- **The failed-call and answered-request closures (my own choice).** Why: these
  are two more of the places where the loop answers the model, and the wiring
  worker's recorder has to hook into them. With all four in one directory, all
  four take the same context object, so the recorder is wired in one place per
  site and no site is left as a loop closure. The two complete-and-amend cuts
  alone would have left the file at about 725 lines, above the 680 target.
- **The loop's counters are now one mutable object**, `counters`. The handlers
  read and write `draftAmendments`, `unusableInARow`, `completionAttempts`,
  `failedToolCalls`, `mutationEpoch` and `attemptEpoch`, which used to be `let`
  locals that only a closure could reach. Every read and write in the loop now
  goes through `counters.X`, including `unusable`, `exhausted`, the
  `noProgress.facts` callback, the dry run's `targetMoved`, the initial
  observation, and the tool-call path. The comments that were on the counters
  moved onto the type's fields. `lastIssueCodes` stays a loop local, because only
  `unusable` and `exhausted` use it.
- **Imports that were no longer used were removed from `evidence-loop.ts`**:
  `applyAutomationStudioFlowDraftAmendments`, the draft-amendment-feedback import,
  COMPLETION_FEEDBACK/REQUEST_CHECK ids, AnsweredRequestNote, CompletionAttempt,
  RerunRequest, the types AnsweredRequestCode, LoopDraftChange and Tool, UsageSummary,
  and the tool-failure import. Every `export ... from` line is unchanged, including
  the re-exports of COMPLETION_FEEDBACK_TOOL_ID and ToolFailureCode, which have
  their own `from` clauses. I left alone the imports that were already unused
  before this change (`AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`,
  `automationStudioLlmTokenBudgetBytes`, `automationStudioLlmEvidenceLoopBudgetValid`),
  because under `verbatimModuleSyntax` they are real module edges.
- **These are unchanged byte for byte**: the function opening (lines 160-163:
  `export async function runAutomationStudioLlmEvidenceLoop(` /
  `  input: AutomationStudioLlmEvidenceLoopInput` / `): Promise<AutomationStudioLlmEvidenceLoopResult> {` /
  `  const limits = resolveLimits(input);`) and the line
  `  automationStudioLlmEvidenceUnusedCallId,` (line 42). The import lines next to
  it did change: `automationStudioLlmEvidenceRerunRequest,` above it and
  `type AutomationStudioLlmEvidenceAnsweredRequestCode,` below it were removed. A
  patch that relies on 3 lines of context around line 42 will need to re-anchor.
- **Line endings**: `sed -i` under Git Bash had converted `evidence-loop.ts` to LF.
  I converted it and the new files back to CRLF to match the sibling files, and
  git's LF/CRLF warning has gone.

### The handler context object (the wiring worker extends this)

`AutomationStudioLlmEvidenceDecisionHandlerContext` in `decision-handlers/types.ts`.
The loop builds it once as `handling`, just after `dryRun` is created and before
the initial observation:

- `input: AutomationStudioLlmEvidenceLoopInput`
- `limits: EvidenceLoopLimits`
- `trace: AutomationStudioLlmEvidenceLoopTrace[]`
- `accounting: AutomationStudioLlmEvidenceLoopAccounting`
- `draftSteps: AutomationStudioFlowDraftStep[]`
- `amendmentMemory: AutomationStudioLlmEvidenceAmendmentMemory`
- `noProgress: AutomationStudioLlmEvidenceNoProgress`
- `evidence: AutomationStudioLlmEvidenceRecord[]`
- `toolIds: ReadonlySet<string>`, `toolsById: ReadonlyMap<string, AutomationStudioLlmEvidenceTool>`
- `observeToolFailures: boolean`
- `counters: AutomationStudioLlmEvidenceLoopCounters`
- `recordRow(row, transition?)`, `draftRecord(step): boolean`, `reserveEvidence(value): number | undefined`,
  `unusable(step, issueCodes, transition?): { error } | undefined`, `dryRun()`

To add the history recorder: add one member to the type, and one entry to the
`handling` literal in `evidence-loop.ts` (lines ~369-372). The handlers'
signatures are `(context, iteration, decision[, canAmend])` for completion and
amendment, `(context, iteration, callId, tool, code, value, usage?, stateBefore?)`
for a failed call, and `(context, iteration, decision, code, answeredByCallId)`
for an answered request.

Where the loop answers the model after this change:
- In the handlers: tool-call failure (`failed-call.ts`), answered request
  (`answered-request.ts`), amendment (`amendment.ts`), and completion (`completion.ts`),
  whether accepted or refused. A refused completion goes through `context.unusable`.
- Still in the loop: the ordinary tool call (~lines 585-635), the unusable-decision
  `catch` (~lines 494-512), the `unusable` closure (~lines 318-333), and every
  `noProgress.redirect` call.
- The "what one decision is shown" assembly is now at ~lines 470-492, and I did not
  move it.

## Commands run and observed results

All suites were run from `packages/fluxiq`. The command given in the brief failed
as written: it exited with `RangeError: options.minThreads and options.maxThreads
must not conflict` and reported "no tests". Adding `--minWorkers=1` fixed it, and
every run below includes that flag:
`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t189-wB2 <s>" npx vitest run src/programs/automation-studio/runtime/<s> --maxWorkers=2 --minWorkers=1 --exclude "**/decision-context/**"`

| Suite | Before editing | After (twice, the second after the CRLF normalisation) |
| --- | --- | --- |
| llm | 67 files, 676 tests passed | 67 files, 676 tests passed |
| flow-bootstrap | 34 files, 691 tests passed | 34 files, 691 tests passed |
| recovery | 34 files, 456 tests passed | 34 files, 456 tests passed |

- `bash .../heavy.sh "t189-wB2 tsc" npx tsc --noEmit -p tsconfig.json`:
  - First run after the split: one error, in a file I do not own,
    `llm/decision-context/closed-detail.ts(51,35): TS2345` (another worker's
    in-progress file). There were no errors in any file I changed.
  - Final run: no output (clean).
- `node scripts/structure-audit.mjs` from the Core root: `structure-audit: passed
  (198 warning(s), 355 baselined)`. It reported no finding mentioning
  `decision-handlers`. `evidence-loop.ts` now shows only the 400-line advisory
  warning (636 lines). The audit also said "1 baseline entries can be lowered". That
  entry is not about `evidence-loop.ts`, which was never baselined, and I did not
  run `pnpm structure:baseline` because I do not own `.structure-baseline.json`.

## Not verified

- I did not find out which baseline entry can be lowered.
- I did not capture tsc's exit code on the final run. What I observed was an empty
  output.
- I ran no Lab or browser runs (none are allowed by the brief).
- I did not run `pnpm check` or the whole Core test suite. Only the three named
  suites ran.

## Open questions or contradictions found

- The brief's vitest command needs `--minWorkers=1` on this machine: vitest 2.1.9
  derives `minThreads` from the CPU count, and that conflicts with
  `--maxWorkers=2`.
- `evidence-loop/draft-shown.ts` (modified) and `decision-context/` (untracked)
  were changed by other workers in the same checkout while I worked. I did not
  touch either.
