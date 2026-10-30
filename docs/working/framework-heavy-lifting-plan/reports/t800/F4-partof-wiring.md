# F4-partof-wiring (t800, Core K5)

## Outcome
Partial. The `partOf` route is threaded through all three named call sites and a resolver exists and is tested, but no production caller supplies a resolver yet: the task-spec part's columns do not reach any file I own (see Open questions for the exact edits).

## What changed and why
- New `flow-bootstrap/record-defaults/scope-part-of.ts` (+ barrel export): `authoringScopePartOf(parts)` where a part is `{id, words?, columns?, rowIdentity?}`. Returns a resolver only when exactly one part owes records (columns non-empty); label is the part's quote words (whitespace-collapsed); `rowIdentity` only if given (the task spec has none today). Zero or several records parts: `undefined`, today's behaviour. Authoring still fills only what the model left out.
- `llm/harness-options/bootstrap-completion.ts`: input `partOf?` passed to `fromReply` -> `acceptAutomationStudioFlowBootstrapResult` and `fromDraft` -> `assembleAutomationStudioFlowDraftPlan`. Because `candidate/submission.ts` types its input from this input, the candidate controller now accepts `partOf` and spreads it into both completion checks with no edit to `submission.ts`/`contracts.ts`.
- `subflow-candidate/scoped-submission.ts:305`: probe accept passes `this.input.submission.partOf` (its inner controller already receives it through `...input.submission`).
- `llm/node-tools/replay-span.ts`: `automationStudioFlowDraftReplayPassCall` takes a trailing `partOf` (forwarded to the replay/verify calls); `AutomationStudioFlowDraftReplaySpanRunInput.partOf` is passed at the member pass call. The repeat-check call (no definition) is unchanged.
- Tests (folded into existing files, since `subflow-candidate/tests` and `node-tools/tests` were at the 25-file limit): `record-defaults/tests/scope-part-of.test.ts` (3); `subflow-candidate/tests/scoped-submission.test.ts` (+2: a read with no schema gets the part's columns; no part is byte-identical); `llm/node-tools/tests/replay.test.ts` (+2: span pass call equals the assembled saved-Flow record output with a part; byte-identical without).

## Commands run and observed results
- `pnpm check` (packages/fluxiq, in lock), final run: `CHECK_EXIT=0`, no diagnostics.
- `pnpm test <six dirs>` (first run, before folding tests): "Test Files 1 failed | 142 passed (143)", "Tests 1 failed | 1225 passed"; the one failure was my new test using an extraction with unnamed fields (fixed). The `real-sql` group matched no files ("No test files found").
- After fix and folding: `vitest run` of scoped-submission, replay, record-defaults tests: "Test Files 4 passed (4) / Tests 45 passed (45)".
- `pnpm structure:check`: first run 2 FAIL (`directory-files` 26 files in the two tests dirs); after folding, no FAIL/violation line, exit 0.

## Not verified
The full six-directory test run was not repeated after the final fix and folding (only the four affected files, plus the first full run where everything else passed). No live or model runs.

## Open questions or contradictions found
No production caller passes `partOf`, because the columns never reach the build:
1. `flow-bootstrap/subflow-candidate/contracts.ts` `AutomationStudioSubflowScopePart` has only `partId, sourceId, text, lastingActs?, effect?`. Add `answer?: { columns: readonly string[] }` there.
2. `project-agents/dispatch/scope.ts` (builds `scope.parts` from the spec parts) must fill it from `part.answer` (`kind: "records"`).
3. Where the dispatcher constructs `AutomationStudioSubflowScopedSubmissionController` (single-subflow / run-brief), pass `submission: { ..., partOf: authoringScopePartOf(scope.parts.map(p => ({ id: p.partId, words: p.text, columns: p.answer?.columns }))) }`. A scoped-submission constructor default from `scope.parts` would also do, once (1) lands.
4. Test side: `llm/node-tools/replay-draft.ts` (lines ~316 span run and ~336 pass call) and its input type must carry `partOf` and pass it to `automationStudioFlowDraftReplaySpanRun({ partOf })` / `automationStudioFlowDraftReplayPassCall(..., input.partOf)`; `replay-draft` is fed from the evidence loop configuration (`llm/loop-configuration.ts`). None of these files were in my ownership.
A whole-Flow (non-subflow) build has the `structurePlan.partOf` subflow-to-parts map but no step-to-subflow lookup at the completion check, so it stays unresolved (ambiguous) there.
