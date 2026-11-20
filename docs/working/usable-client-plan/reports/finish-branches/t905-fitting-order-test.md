# t905-fitting-order-test

## Outcome
Done. Five tests added; all pass. No behaviour differs from the stated order. No source touched.

## What changed and why
New file `packages/fluxiq/src/runtime/result-verification/flow-less/tests/window-fitting-order.test.ts` in Core worktree `fxwork/t905/!FluxIQ`. Generic fixtures (a reading room's tables); trail of 3 entries plus resultEvidence (1 page, 1 look, coverage, working, answerContract), built through `automationStudioFlowLessJudgedSummary` then `automationStudioFlowLessSummaryFitting`.

Tests:
1. A request that fits (no `summarised`) keeps the trail and resultEvidence whole.
2. The first form summarises `resultEvidence.looks`, the second adds `.pages`; the trail is identical to the whole one in both, and the first trail summary is `trail.entries[0].asked`.
3. Item order is looks, pages, asked 0..2, found 0..2, then rows. At the form before rows, every trail entry is summarised and the rows are whole.
4. Coverage, working and answerContract are equal to the originals in every form, and never named in `summarised.items`.
5. Nothing dropped: each `core.summarised` names its item, kind and counts; trail entries keep `n`, `callId`, `did`, `outcome`, `where`; `summarised.count` equals its item list length.

## Commands run and observed results
- `heavy-slot run t905-fitorder -- pnpm.cmd exec vitest run src/runtime/result-verification/flow-less --maxWorkers=1 --minWorkers=1` -> 1 failure: my fixture error (`resultEvidence.pages` is an array, I compared it to an object). Test bug only.
- Fixed, rerun (`t905-fitorder2`) -> Test Files 13 passed (13), Tests 110 passed (110). Logs: `fxwork/t905/fo.log`, `fo2.log`.

## Not verified
No typecheck (per brief), no Lab. A form where "acts" falls between trail and rows is not exercised (the fixture has no acts, so that step is skipped as nothing shorter). Real window sizes are not modelled; "just over" is read as one step of the form list.

## Open questions or contradictions found
None against the stated order.
