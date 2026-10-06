# live-b-fix-2 report

## Outcome

Done. Both wording defects from run-muw5zv4m-52d83027 are fixed in Core (t262 tree), test first. Nothing is committed.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `activity/wording/run-ending.ts`: `rowCount()` now returns undefined when the result declared no record set. It checks two things: the repair history's last record has `recordSetCount === 0` (written by `recovery/refuted-result/history.ts` `automationStudioResultRepairHistoryRecord`: `recordSetCount: entry.produced.recordSets.length`), or the check's observation (`result-verification/verdict.ts` `automationStudioResultObservation`: "N records stored[, M refused…], across 0 record sets…") says 0 record sets. `judged()` then uses its rows-undefined wording, "The check found its result doesn't answer what you asked". A declared record set that stored 0 rows still says "It returned no rows".
- `executor/state-routing/announcement.ts`: `stepName()` goes through these in order. (1) The authored label, in quotes, as before. (2) Otherwise the step-card action words from `automationStudioActivityAction({ id: definitionId, parameters })`, with the first letter lowercased, for example `Passed over clicking “Set as my store”: …`. (3) Otherwise "step N" in run order, from `automationStudioActivityStepNumbers(flow, chooseAutomationStudioStartNode(flow).node?.id)`. That is the same numbering graph-run uses for "Running step N of M", and it is never `flow.nodes.indexOf`. (4) A node with no number, such as a Merge, is called "a step". The three sentence shapes are unchanged, and no ids appear in the text.
- Tests: a new case in `activity/wording/tests/run-ending.test.ts`, and a new file `executor/state-routing/tests/announcement.test.ts`. The new file captures emissions through `automationStudioActivityHub` inside `runWithAutomationStudioActivity` and uses a Flow whose stored node order differs from its run order.

## Commands run and observed results (from the Core tree root)

- Red run: `pnpm.cmd --filter fluxiq exec vitest run …/run-ending.test.ts …/announcement.test.ts` printed "Tests 3 failed | 8 passed (11)". run-ending received "It returned no rows, so it doesn't answer…". announcement received "Passed over step 1 … Continuing at step 2" where "clicking “Set as my store” … step 4" was expected.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/activity/wording src/programs/automation-studio/runtime/executor/state-routing` printed "Test Files 11 passed (11)" and "Tests 101 passed (101)".
- `pnpm.cmd --filter fluxiq check` finished with the build-cache line "step fluxiq:check … ms 7080" and printed no tsc errors.
- `node scripts/structure-audit.mjs` printed "structure-audit: passed (258 warning(s), 349 baselined)". On the first run it failed because the new test imported `activity/default-hub.ts` and `activity/scope.ts` directly. I changed the test to import from the `activity/index.ts` barrel, and the next run passed.

## Not verified

- I did not run a live run or a Lab, as the brief said.
- Wider suites were not run.
- For a partial or resumed run, graph-run numbers steps from `chooseAutomationStudioStartNode(flow)`, and the announcement recomputes the same thing. The two agree, but the announcement does not receive graph-run's own `stepNumbers` instance.

## Open questions or contradictions found

- The action-words name reads as a gerund ("Passed over clicking “Set as my store”"). If the supervisor prefers the bare control name ("Passed over “Set as my store”"), the change is a one-line edit in `stepName`.
- The other uncommitted files in the tree (result-verification/, llm/, docs/architecture/automation-studio.md) were left untouched.
