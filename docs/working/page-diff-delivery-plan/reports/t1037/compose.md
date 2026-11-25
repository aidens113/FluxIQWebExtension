# t1037 W3 compose: report

## Outcome
Done for my files. The two acceptance gates that cover the whole tree (`pnpm --filter fluxiq check`, structure audit) fail only on the other worker's files.

## What changed
New, in Core `packages/fluxiq/src/runtime/flow-authoring/draft/compose/`:
- `compose.ts` `automationStudioFlowDraftCompose({ steps, isAskedTable? })`
- `framework-step.ts` (`drafted !== undefined || disposition === "taken"`), `mark.ts` (writes `drafted` and its disposition together)
- `result-reads.ts`, `dead-end.ts`, `undone.ts`, `index.ts`, `tests/compose.test.ts` (23 tests)
- `draft/index.ts`: one line `export * from "./compose/index.ts";`

## Rule order as built
Working copy is `{...step}` per step (input never mutated; order and positions kept). Framework steps are reset to `in` (an `undone` step's `cancels` cleared) then:
1. `replaced`, `look`, `did_not_work`.
2. Result reads among framework steps still in with `effect: observe`: model's `result: true` wins (a model-kept step with it also outranks framework reads), else last read `isAskedTable` accepts (fallback last read), plus other reads with the same `reads` code; others `not_the_result`.
3. `undone` via `automationStudioFlowDraftDropReversals`.
4. `dead_end`.
5. `repeat`.

## Judgement calls
- Undone: the reversal runs on the working copy including model steps; whatever it did to a model step is restored (disposition, cancels, acts), and a framework step whose pair partner is a model step is put back in too (a half-pair would flip the control the wrong way). Model steps stay in the call so the pairing sees them.
- Repeat: `automationStudioFlowDraftSecondCopy` is called with only the steps BEFORE the step (not the whole copy). With the whole list it searches later kept steps too and would mark the earlier of two copies, not the later.
- Dead end: "lasting" is judged only on steps currently in the Flow (framework-in or model-kept); a model-kept step inside always counts as lasting. Detour start must be a framework-in mutate step with `stateBefore`; the last later step with `stateAfter === S` closes it; walk continues after it. Steps are processed in position order.
- Result reads override: model `result: true` on a framework step keeps it and the other framework reads go out; same-code siblings are not auto-added in the override case (spec: only the marked steps).
- Compose reads `step.reads`-based picks only among framework reads; a model-kept read is never reclassified.

## Commands and results
- `NODE_OPTIONS=--max-old-space-size=3072 node .../heavy-slot.mjs run t1037-compose -- node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/flow-authoring/draft/compose` -> `Test Files 1 passed (1) / Tests 23 passed (23)`.
- Same on `src/runtime/flow-authoring/draft` (before the last test-only type fix, earlier in the session) -> `Test Files 40 passed (40) / Tests 434 passed (434)`. An earlier run showed `accrual.test.ts` failing with `ReferenceError: edited is not defined` in `runtime/llm/decision-handlers/amendment.ts:75`: the other worker's mid-edit file, gone by the later run.
- `pnpm --filter fluxiq check` at Core root -> exit 2. Errors remaining, none in my files (my one test type error was fixed and re-checked): `automation-activity/wording/draft-edit-card.ts(21,7)`, `llm/decision-handlers/tests/refusal-way-out.test.ts(130,9)`, `llm/tests/draft-amendment-feedback.test.ts(227,9)`, all TS2739 missing `not_an_edit`, `not_a_read` refusal keys (theirs).
- `node scripts/structure-audit.mjs` -> `3 violation(s)`: `as-never` in `llm/decision-handlers/tests/draft-edits.test.ts`, `directory-files` on `llm/decision-handlers/tests/` (26 files), `imports` in `draft/amendment/changes.ts`. None in `draft/compose/`.

## Not verified
Not wired into the loop (phase 2). Final green of check/audit depends on the other worker finishing.
