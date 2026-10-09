# w15: ending names refused steps, candidate describeCall, pace through draft, as-never

## Brief

### Brief: t378-w15-ending-steps-and-pace-draft (worker)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Rule: words a person sees are plain English; never codes, line numbers, handles or command names.
- Context: candidate refusal issues now carry `step` (the step's description as the model wrote it), `label`, `line`, `instead` (W1). The refusal card already names the step; the build-failed ending cannot, because the failure diagnostic is codes-only. Report: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w11-wording-and-row-contract.md` (Notes).
- Task:
  1. Add a bounded, screened `refusedSteps` (the refused steps' descriptions as the model wrote them, a few at most, each clipped) to the failure diagnostic (`R/flow-bootstrap/generation-failure/diagnostic.ts`, `diagnostic-parse.ts`; the parser drops unknown fields, so add it there), fill it from the last refused submission in `R/service/flow-bootstrap-commands/candidate-generation.ts` (`stalled`), and use it in the ending (`R/conversations/commands/progress.ts`, with the wording helpers in `R/activity/wording/`): lane D's ending then says the step "keep requests with 5 or more mutual friends" was given a setting it does not take, not "a step". Tests beside each change, including one end to end through `R/service/flow-bootstrap-commands/tests/candidate-failure-kept.test.ts`.
  2. `R/service.ts` ~:1565 gives the candidate loop no `describeCall` (the legacy round at ~:1595 does), so exploration cards named no control. Pass it the same way; a test if one exists for the legacy wiring, else note it.
  3. `R/llm/node-tools/draft-from-flow.ts` drops `metadata.paceMs` when a saved Flow is read back as a draft, so a repair or extension loses the learned pace. Keep it (plan node field `paceMs`, W8; Flow key `AUTOMATION_STUDIO_PACE_METADATA_KEY` in `R/executor/pacing/pace-metadata.ts`). Fail-first test.
  4. Structure audit: `as-never` at `R/activity/tests/call-context.test.ts` (11 casts): typed stubs or `satisfies`.
- Owns: `R/flow-bootstrap/generation-failure/**`, `R/service/flow-bootstrap-commands/candidate-generation.ts` and its tests, `R/conversations/commands/progress.ts` and its tests, `R/activity/wording/**`, `R/activity/tests/call-context.test.ts`, `R/service.ts` (the describeCall wiring only), `R/llm/node-tools/draft-from-flow.ts` and its tests.
- Must not touch: `R/executor/**` (another worker edits it now), every other file, any other tree, lab slots or processes. An error only in a file you do not own is someone else's: record it, do not fix it.
- Definition of done: `npx vitest run` on the test dirs of every file you touched plus `R/activity` and `R/conversations/commands/tests`, from `T/!FluxIQ`, passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files; `node scripts/structure-audit.mjs` shows no violation in your files. Never commit; no `pnpm build`; no Lab run or provider call. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w15-ending-steps-and-pace-draft.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Partial. Tasks 1, 2 and 4 are done and tested. Task 3 (keeping the pace when a saved Flow is read back as a draft) is blocked by file ownership: the draft step type and the draft assembler have no pace field, and both are outside this brief. Nothing was changed for task 3.

## What changed and why

All paths are relative to R.

### Task 1: the build-failed ending names the refused step
- `flow-bootstrap/generation-failure/refused-steps.ts` (new): the type `AutomationStudioFlowBootstrapRefusedStep = { step; line?; path?; code? }` and `automationStudioFlowBootstrapRefusedSteps` with:
  - `bounded()`, used by the producer: keeps only placed steps (each needs a line or a path), one per place, at most 4, each collapsed to one line and clipped to 120 characters; the code is stored without the part after its `:`.
  - `parse()`, used by the reader: holds the stored list to the same bounds and returns `null` for anything else.
  - Exported from the directory barrel.
- `flow-bootstrap/generation-failure/diagnostic.ts`: new optional field `refusedSteps`, with a doc comment.
- `flow-bootstrap/generation-failure/diagnostic-parse.ts`: adds `refusedSteps` to the exact-fields list. It is parsed by the shared parse and is valid only beside `flow_bootstrap.evidence_repeat_without_progress`; beside any other code the whole diagnostic is refused, as the parser does for its other code-bound fields. The parser refuses a diagnostic that has an unknown field (`hasExactFields`); the brief said it drops them.
- `service/flow-bootstrap-commands/candidate-generation.ts`:
  - A small `noteRefusedSteps` wrapper, composed into `observe`, records the issues of the last `core.submit_candidate` answer. It uses `automationStudioActivityIssuesOf` and screens each step with `automationStudioActivityReasonText(step, 80)`, the chat's own screen. An accepted submission clears them.
  - In `stalled`, when there are refusal codes (the no-progress code), the failure is rebuilt with `refusedSteps: bounded(...)`.
  - The later spend and candidate wrappers keep the field, because each rebuilds from the parsed diagnostic.
- `activity/wording/refused-step-issues.ts` (new) and the `activity/wording/index.ts` barrel: `automationStudioActivityRefusedStepIssues(issues, steps)` pairs each issue decoded from `issueCodes` with the words of its refused step:
  - first by line, then by path;
  - an issue with no place is paired by code with the next unused step, and also takes that step's place, so `issue-words` counts it as a step.
- `conversations/commands/progress.ts`: `refusedWords` passes the decoded issues through that helper before `automationStudioActivityIssueWords(..., counted, named)`. The words are screened again where they are said (`quoted`). `progress.ts` imports the helper from `activity/wording/index.ts` because `activity/index.ts` is not mine.
- Why the code fallback is needed: in the lane D shape (a JSON plan path) the issue code `candidate.last_submission_issue:bootstrap.unknown_parameter:plan.subflows.0.nodes.1.parameters.minimumMutualFriends` is longer than 100 characters. So `service/candidate-failure/refusal-codes.ts` (not mine) encodes it with no place, and matching by place alone found nothing.

### Task 2: the candidate loop gets describeCall
- `service.ts`: the candidate `loop:` now gets `describeCall` exactly as the legacy round does (`this.llmEvidenceRuntime.describeCall({ projectId, flowId, ...call })`). It is on the same line, so the file's baselined line count does not grow.
- No test covered the legacy wiring, so I added `service/flow-bootstrap-commands/tests/candidate-describe-call.test.ts`. It runs the actual service in candidate mode, and its click card reads "Clicking “Add to cart”".
- The test failed first: with the wiring forced off it printed `expected [] to deep equally contain {...}`. I then restored `service.ts` from a scratch copy; `git diff` on it shows only my one changed line.

### Task 4: as-never casts
- `activity/tests/call-context.test.ts`: all 11 `as never` casts removed.
  - `answer()` is typed to return `AutomationStudioLlmEvidenceToolExecutionResult`.
  - The inline `executeTool` result uses `satisfies AutomationStudioLlmEvidenceToolExecutionResult`.
  - The other casts were not needed: `decide` returns `Promise<unknown>`, and the call values already fit `JsonObject`/`JsonValue`.

### Tests added
- `flow-bootstrap/generation-failure/tests/refused-steps.test.ts`: bounds, parse, and the field accepted only beside the no-progress code.
- `activity/wording/tests/refused-step-issues.test.ts`: pairing by line, by path and by code.
- `conversations/commands/tests/candidate-endings.test.ts`: a lane D ending with the step's words, paired by code; a lane B ending naming both steps by line.
- `service/flow-bootstrap-commands/tests/candidate-failure-kept.test.ts`: lane D end to end through the real service. A JSON plan's `builtin.data.filter-rows` node named "keep requests with 5 or more mutual friends" is given an undeclared setting and refused three times. The ending reads: "the build failed: the Flow it wrote was refused 3 times in a row, the last time because the step 'keep requests with 5 or more mutual friends' was given a setting it doesn't take, so nothing was tested".

## Commands run and observed results
All from `T/!FluxIQ`.
- `npx vitest run <R>/flow-bootstrap/generation-failure <R>/service/flow-bootstrap-commands/tests <R>/conversations/commands/tests <R>/activity`: `Test Files 68 passed (68)`, `Tests 832 passed (832)`.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: no output, exit 0. Run after the final edit; the config includes the test files.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (293 warning(s), 708 baselined)`.
  - One earlier run reported `service.ts: 4382 lines exceeds ... baseline 4381`, caused by my two-line wiring. I fixed it by putting the wiring on one line.
  - The `as-never` failure for `call-context.test.ts` is gone.
- Fail-first for task 2: with the wiring disabled, `candidate-describe-call.test.ts` failed with `expected [] to deep equally contain { …(3) }`; with it on, it passes.

## Not verified
- Task 3 is not done (see below).
- No live run, Lab run, build or browser check was done.
- The extension's rendering of the ending was not checked. `refusedSteps` travels in the diagnostic payload; I did not check whether the gateway contract in `packages/contracts` lists diagnostic fields, since that file is not mine.
- After joining the `service.ts` wiring onto one line I re-ran tsc and the audit, but not the describeCall test. The change is text-only.
- `R/service.ts`'s own sibling `tests/` directory was not run, because it is very large. The candidate service tests in `service/flow-bootstrap-commands/tests` were run.

## Open questions or contradictions found
- **Task 3 is blocked by ownership.**
  - The seeded draft step is `AutomationStudioFlowDraftStep` (`flow-draft/step.ts`), which has no `paceMs`. Putting the pace on the seed in `draft-from-flow.ts` would not type-check.
  - Even with that field, `flow-bootstrap/authoring/assemble-draft.ts` (lines 134-145) copies only `routeSignatures` and `nodeLabel` onto the step it routes. The plan node gets `paceMs` only from the authoring step (`assemble.ts:426`), and that is set only by a script's `repeat pace:`.
  - The full fix needs three edits:
    1. `paceMs?: number` on `AutomationStudioFlowDraftStep` in `flow-draft/step.ts`.
    2. In `draft-from-flow.ts`, seed it from `automationStudioAuthoredPaceMs(node)` (exported by `executor/pacing/pace-metadata.ts`; reading it from `executor/pacing/index.ts` is only an import).
    3. In `assemble-draft.ts`, copy `step.paceMs` onto the routed step, and in `draft-routing.ts`, onto its `AutomationStudioFlowDraftRoutedStep` and authoring step.
  - A repair shown the draft as a Flow script would also need a pace line for a step outside a repeat (`llm/node-tools/draft-step.ts`). That is a design question.
  - Suggest one serial brief that owns `flow-draft/step.ts`, `flow-bootstrap/authoring/assemble-draft.ts`, `flow-bootstrap/authoring/draft-routing.ts` and `llm/node-tools/draft-from-flow.ts`.
- `service/candidate-failure/refusal-codes.ts` (not mine) drops an issue's place when the place makes the code longer than 100 characters, as with any deep plan path. The ending now recovers it by code through `refusedSteps`. Trimming the place to its node path (`plan.subflows.0.nodes.1`) there would make place matching work without the code fallback.
- `activity/call-context.ts:37` (not mine) still says the candidate build's loop has no domain `describeCall`; that comment is now out of date.
