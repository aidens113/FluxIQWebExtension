# t195-w46 — repeat guard refuses an unchanged call on an unchanged draft and page

## Outcome

Partial. The code work is done: the failing tests were written first, the brief's test directories pass, and the typecheck exits 0. The structure audit exits 1, but both of its violations are in files this brief does not own (see "Not verified").

## What changed and why

Root cause in `run-musr9pv3-f4bf6256`. The run's trace rows for iterations 32–58 all show `core.run_flow` with `effectApplied: true` and `pageState: "unobserved"`. A part run took `effectApplied` from every step it ran, and the list read it replayed answers applied. The press only checked (`verified`/`present`), so nothing was pressed, but the run still counted as applied. With no page states to compare, the repeat guard's `changedNothing` was false and `sameResult` needed a `stateAfter`. So `outcomes.delete` ran every time and nothing was ever refused. Each run also counted as no-progress `cleared()`, so the unchanged `complete`s in between never added up.

Core root: `packages/fluxiq/src/programs/automation-studio/runtime/llm`.

- `node-tools/run-flow-part.ts`: `effectApplied ||= step.effect === "mutate" && answer.effectApplied`. A part run now counts as applied only when a changing step acted. The header cites the run.
- `repeat-guard/draft-key.ts` (new): `automationStudioLlmEvidenceDraftKey(steps)` returns a 32-hex sha256 of `automationStudioFlowDraftFlowSignature`, which covers steps, order, arguments, routing, settings and acts. It is exported from the barrel `repeat-guard/index.ts`.
- `repeat-guard/outcomes.ts`:
  - `automationStudioLlmEvidenceRepeatGuard({ draftOf? })`: a tool for which `draftOf` returns a key is keyed on tool, page, draft and input.
  - New outcome `same_draft`: the call ran on the same draft and page and changed nothing.
  - A draft-keyed call that applied nothing is not `failed`, because it ran the draft and changed nothing.
  - Other tools are keyed exactly as before. The draft key is empty for them.
  - The header has a new section citing the run.
- `repeat-guard/feedback.ts`: new `DRAFT_INSTRUCTION` for `same_draft`. It tells the model that this exact call already ran on this unchanged draft and page and changed nothing, that its result is shown above under `sameAsCall`, and that it was not run. It tells the model to change the draft first (amend_draft), then run it again, or else move on. It also says that completing again over an unchanged refused draft is refused the same way, and that both kinds of refusal end the round.
- `evidence-loop.ts` (800 lines, at budget):
  - A `draftOf` closure (core.run_flow → draft key) is passed to the guard.
  - The repeat policy's request signature for `core.run_flow` now includes `draftKey`. This is needed because a part run that changed nothing no longer moves `mutationEpoch`, so without it a run after an amendment was answered from memory as `already_answered`. I saw that in the second new test before adding the key.
  - In `unusable()`, a completion refused again over the same draft (`noProgress.refusedAgain`, the existing count of unchanged completions) now also calls `handling.repeats.refusedAgain(iteration)`. It stalls the round at `AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW`.
  - The comment at the guard's call site was updated, and one older comment was compacted to stay at 800 lines.
- Tests:
  - `repeat-guard/tests/outcomes.test.ts`: one unit test covering draft keying, `same_draft`, a draft change, a page change, a different part, an applied run, and run_node keying unchanged.
  - `evidence-loop/tests/repeat-guard.test.ts`: the live sequence as a fixture, plus a run after an amendment and a run that pressed something.

What is unchanged:
- A first call, or a call after a draft change, runs as before.
- run_node/press keying ignores the draft, as before.
- The handlers in `decision-handlers/` (not owned) were not edited. The refusal goes through the existing `automationStudioLlmEvidenceHandleRefusedRepeat`.

## Commands run and observed results

All run from the Core root.

1. Failing-first, before any source change. Scratch copy: `t195-w46-failing-first.txt`.
   - Command: `npx vitest run ... llm/repeat-guard llm/evidence-loop/tests/repeat-guard.test.ts`.
   - Result: 2 failed, 15 passed (17).
   - Unit test: `outcome` was `changed_nothing` where `same_draft` was expected.
   - Loop test: `promise resolved "{ ok: false, …(5) }" instead of rejecting`.
   - A debug run of the same fixture showed `llm_evidence_loop.iteration_limit` at 40 iterations, with `core.run_flow.ran` repeated between refused completions. That is the live run's shape.
2. After the fix, the two files: 2 passed, 17 tests passed.
3. The brief's directories (repeat-guard, evidence-loop, llm/tests, node-tools, tests/service-authoring, tests/service-bootstrap): `Test Files 102 passed (102)`, `Tests 951 passed (951)`. This run was before a test-only type fix. The two new-test files were re-run after that fix: 17/17 passed.
4. `bash .../heavy.sh "t195 w46 core check" pnpm --filter fluxiq check`:
   - First run exited 2. One error was mine (`repeat-guard.test.ts(181,55)`: the fixture's parameter type lacked `callId`), and I fixed it. The other was in `llm/tests/draft-amendment-feedback.test.ts(205,9)` (`repeat_taken_off` missing), from another agent's uncommitted edit.
   - Re-run: exit 0, no `error TS` lines.
5. `node scripts/structure-audit.mjs`: exit 1 with 2 violations, neither in my files.
   - `llm/tests/` has 26 files. The extra file is the untracked `llm/tests/evidence-loop-decision.test.ts`, which is not mine.
   - `flow-draft/amendment.ts` is 817 lines. That file is modified by another agent and is on my must-not-touch list.
   - `evidence-loop.ts` is at 800 lines, which only triggers the advisory warning.

## Not verified

- The audit does not pass as a whole tree, because of other agents' files. Rerun it once they land.
- No live browser or Lab run, so it is not shown that the model actually changes the draft once told to.
- The full suites were not run, per the brief.
- `decision-handlers/tests` and `flow-bootstrap/**` tests are outside the named directories and were not run.

## Open questions or contradictions found

- A part run that only reads and checks no longer moves `mutationEpoch`. A look made after such a run, with nothing else in between, can now be answered from memory. I think that is correct, since the page did not change, but it is a change in behaviour.
- A completion refused again over the same draft now stalls the round when it comes third in a row with other refusals. This includes four identical refused completions in a row: the first counts as new, then three repeats. Before this change those continued until the no-progress or unusable-decision bound. No test in the named directories depended on the old behaviour.
- The stall from a refused completion is recorded under the completion's own issue codes (for example `flow_draft.repeat_not_after_its_source`), not `llm_evidence_loop.repeat_refused`.
