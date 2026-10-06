# t194-w84: answer folders for every decision Core answers

## Outcome

Done. Each decision Core answers without running a tool now gets an answer folder in the step log. That covers a shape-invalid or otherwise unusable decision, a refused completion (for example `full_run_required`), and a call answered from memory (`already_answered`, `already_observed`, `not_offered`, `looked_again_unchanged`). The folder holds Core's code and the Core evidence entries the model was shown about the decision. No decision outcome, evidence order or stored trace changed.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

### Design: the feedback is not carried on the trace row

The brief and the w82 report proposed carrying the feedback on the trace row. I did not do that, for two reasons:
1. In two of the three paths the feedback is pushed **after** the row is recorded. In `refuseDecision` (shape-invalid and other unusable decisions), `unusable()` records the row and then pushes `core.decision_check`. A stall redirect (`core.no_progress`) also follows the row. Putting the feedback on the row would have meant moving those pushes ahead of the row. That changes the order of evidence the model is shown, and the brief says no outcome may change.
2. A `feedback` member on `AutomationStudioLlmEvidenceLoopTrace` would sit in the stored and returned record. Every rebuilder would then have to decide what to do with it.

What I did instead:
- The recorder reads the loop's `evidence` list. It writes an answer folder when the row is recorded, holding the Core entries the decision has had so far. It completes that answer when the next decision starts, so it also gets the check and redirect that were pushed after the row.
- A row that ended the loop keeps what it was written with, because nothing more was said to the model.
- "Core entries" means entries whose toolId is one of: `core.decision_check`, `core.completion_check`, `core.dry_run`, `core.request_check`, `core.repeat_check`, `core.amendment_check`, `core.no_progress`. Only entries whose callId was not already held when the decision was asked are counted.
- The trace row type is unchanged.

### Files

- `R/llm/step-log/answer-step.ts`:
  - A folder is now also written for `decision: "unusable"` rows, named `answer-unusable`. Rows whose code is a provider-unanswered code (`llm.provider_timeout` and so on) are excluded, since Core said nothing to the model for those.
  - A folder is also written for `tool_call` rows with an answered-request code, named `answer-<toolId>`.
  - For these rows: `verdict: "refused"`, `reason: <code>`, `feedback: [{callId, toolId, value}]`, and `steps` (the draft positions a refusal listed under `steps[].step`). The summary is `refused <code>[: steps 2, 3]`.
  - The function now returns an `AutomationStudioLlmStepLogAnswerStep` handle. Its `shown(entries)` rewrites `result.json` and then `meta.json`, and only when the entries changed.
  - New exported types: `AutomationStudioLlmStepLogCoreEntry` and `AutomationStudioLlmStepLogAnswerStep`.
  - Screening is unchanged: every write goes through `files.ts`.
  - The answered codes are spelled out in a set here, citing `evidence-loop/answered-request.ts`, so the step log imports nothing from the loop.
- `R/llm/step-log/index.ts`: comment only. The folder contract now documents `answer-unusable`, answers from memory, `steps` and `feedback`.
- `R/llm/evidence-loop/trace.ts`:
  - The recorder takes a third optional parameter, `evidence: () => entries`.
  - New recorder method `decisionStarts()`. It clears `draftShown`, as the loop's `rows.draftShown = undefined` did before. It completes the pending answers and snapshots the callIds held at that point.
  - `CORE_ANSWER_TOOL_IDS` is imported from the barrels and owning files.
  - `record` passes a `coreAnswers` thunk to the step log, so evidence is filtered only for rows that write an answer.
- `R/llm/evidence-loop.ts`: two lines changed, so the file stays at 800 lines, the audit limit.
  - Line 183: `automationStudioLlmEvidenceLoopTraceRecorder(trace, process.env, () => evidence)`. The thunk is read only after `evidence` is declared at line 254.
  - Line 609: `rows.draftShown = undefined;` becomes `rows.decisionStarts();`.
- New test `R/llm/step-log/tests/answer-feedback.test.ts` (3 tests):
  1. Real loop, shape-invalid reply. Writes `0002-answer-unusable` with `resultCode`/`reason` `llm_evidence_loop.decision_shape_invalid`, `feedback` including the `core.decision_check` entry, a meta summary and an index line. Every feedback entry is checked to equal what the next `decide` call was shown.
  2. Real loop, `checkCompletion` refusing with `full_run_required` and steps 2 and 3. Writes `answer-unusable` with `steps: [2, 3]`, the `core.completion_check` entry, and the summary `refused llm_evidence_loop.full_run_required: steps 2, 3`. The same check against the next request is made.
  3. Direct test: `already_answered` writes `answer-core.run_node` with its feedback, and `llm.provider_timeout` writes nothing.
- I did not edit `decision-handlers/completion.ts`. The brief's `R/llm/evidence-loop/completion.ts` does not exist; the handler lives at `R/llm/decision-handlers/completion.ts`. It pushes its feedback before it records the row, so the reader above captures it without any change there.

## Commands run and observed results

All of these were run in `packages/fluxiq` unless noted.

- Tests first: `npx vitest run src/.../llm/step-log/tests/answer-feedback.test.ts` before the implementation printed `Tests 3 failed (3)`. The first two found `["0001-tool-inspect"]` and no answer folder; the third found `[]`. I then changed the filter to answer folders only, because the loop also writes tool folders.
- `npx vitest run src/programs/automation-studio/runtime/llm/step-log src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/llm/evidence-progress` printed `Test Files 35 passed (35)` and `Tests 261 passed (261)`. This was the final run, after every edit.
- `npx tsc --noEmit -p tsconfig.json` exited 0 with no output. It ran after the last code edit; the later `index.ts` change was a comment.
- `node scripts/structure-audit.mjs`, run from the Core root:
  - First run: 3 violations. Two were mine: `failure-as-empty` in answer-step.ts, and a deep import of `../evidence-progress/stall-redirect.ts` in trace.ts. I fixed both.
  - Final run: `structure-audit: 1 violation(s) across 1 rule(s)`. It is `[imports] packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts ... "../evidence-loop/decision-refusal.ts" at line 28`. That file is modified in the working tree by someone else; I did not touch it.

## Not verified

- No live run or Lab run.
- The dry-run path (`core.dry_run` with `full_run_required` from `automationStudioFlowDraftDryRunGate`, as in 0279) was not run end to end. The loop test uses `checkCompletion` to produce the same refusal. The dry-run entry goes through `showEvidence` before the row in the same way, and `core.dry_run` is in the captured set.
- The folders for `not_offered` from `final-decision-row.ts` and for the withdrawn-look stall end were not tested specifically. They are `unusable` rows and go through the same rule.
- I did not check whether the Lab's step-log reader in `packages/test-runner` accepts the new `answer-unusable` folder name and the new `feedback` and `steps` keys.

## Open questions or contradictions found

- The brief names `R/llm/evidence-loop/completion.ts`, which does not exist. The handler is `R/llm/decision-handlers/completion.ts`. I did not need to change it.
- I departed from "carry the feedback on the trace row" for the ordering and record reasons above.
- `refused-repeat.ts` and `amendment.ts` also push their notes after the row. Their existing answer folders now also gain `feedback`, through the next-decision completion.
- `core.search_check` is not in the captured set. `decision-handlers/searching.ts` imports the evidence-loop barrel by value, which would create a cycle.
- The answered-request codes are duplicated as strings in `answer-step.ts`. Exporting them from `evidence-loop/answered-request.ts` would remove the duplicate, but that file was outside my ownership.
- Should the Lab's step-log reader start reading `feedback` and `steps`?
