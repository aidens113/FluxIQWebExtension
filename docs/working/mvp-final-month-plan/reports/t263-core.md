# t263-core report

## Outcome

Done. A1, B F11 and D C3 ported onto Core worktree `fxwork/t263/!FluxIQ` (branch `task/t263-lane-only-ports`, HEAD `1fbfa5ef`). Uncommitted.

## What changed and why

All under `packages/fluxiq/src/programs/automation-studio/` (`R` = `runtime`). Each change is the lane's own `git diff`, applied as a patch, LF endings, no wholesale copy.

- **A1 (t174)**: `api/handlers/llm-execution-settings.ts` bounds `maxEstimatedCostUsd` by `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD` (model barrel, value 10) instead of the literal 0.25. Test `api/handlers/tests/llm-execution-settings.test.ts`: the old 0.26 rejection replaced by 0 and MAX+0.01, plus a new case that accepts 0.3 and MAX. Applied cleanly.
- **F11 (t193)**: `R/llm/evidence-loop/amendment-memory.ts` `draftSignature` now includes sorted `acts` and `ranWith`. Test: new describe block in `R/llm/evidence-loop/tests/stalled-amendments-replay.test.ts`. Applied cleanly. Compatibility with the later draft key: t195's `repeat-guard/draft-key.ts` hashes `flow-draft/flow-signature.ts`, which on t263 already includes `ranWith ?? input` and sorted `acts`, so the two agree on what counts as a change. F11 does not touch flow-signature.ts.
- **C3 (t195 w43)**: `R/llm/step-log/scope.ts` gains `AutomationStudioLlmStepLogPass` and `automationStudioLlmStepLogScope.pass`; `R/llm/step-log/tool-step.ts` writes `pass`/`of`/`row` into `meta.json`; `R/llm/node-tools/replay-span.ts` plans screened row labels from `readRows.rows` and sends each pass call inside the pass scope. replay-span.ts did not apply plainly (t262 added the scheduled-candidate import and `node` argument); `git apply --3way` merged it cleanly since the hunks are disjoint (t262's `automationStudioFlowDraftReplayPassCall(..., node)` call is kept; t195's `sendPass` wraps only the send). I unstaged the index entry 3-way left behind (`git restore --staged`). Tests: added case in `R/llm/step-log/tests/tool-step.test.ts`; new file `R/llm/node-tools/tests/replay-span-step-log.test.ts` (copied from t195, CR stripped).
- Not ported (outside the brief's owned files): t174's `step-log/answer-step.ts` change, t193's `authored-draft.test.ts` policy assertions.

## Commands run and observed results

- `npx vitest run` on the 4 test files (in `packages/fluxiq`): `Test Files 4 passed (4)`, `Tests 25 passed (25)`.
- Failing-first: temporarily restored the 5 source files to `HEAD` (tests kept), reran the same 4 files: `Tests 6 failed | 19 passed (25)` — exactly the new cost-limit case, the F11 "moves an act / binds" case, the tool-step pass case and 3 of 4 replay-span-step-log cases. Source restored afterwards; `git diff --stat` back to `8 files changed, 178 insertions(+), 15 deletions(-)` plus the untracked new test.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): exit 0 (`"step":"fluxiq:check" ... "ms":85492`).

## Not verified

- No Core `pnpm build`, no downstream checks, no structure audit, no wider Core test run (e.g. other replay-span / build-test suites that call `automationStudioFlowDraftReplaySpanRun`). No Lab, browser or provider call.

## Open questions or contradictions found

- None blocking. The replay-span header comment notes a value import out of `result-verification` would close a barrel cycle; the port keeps it a type-only import as the lane had it.
