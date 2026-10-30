# F1-dates-followup (t800, K1 follow-up)

Saved by the t800 sub-supervisor from the worker's inline hand-back (the worker was cut off before writing it).
Worker tier: worker (Sonnet). Outcome as handed back: Partial (only contracts vitest run; the rest re-run by the
sub-supervisor, see `../t800-p7.md`).

## Bare relative dates
- C `process/read-date.ts` reads a compact age only when it is the whole value (`COMPACT_AGE`): an optional
  `posted|active|updated` prefix, a number (fraction allowed), a unit, optional `ago`. Units: s/sec/secs,
  m/min/mins (minutes), h/hr/hrs, d, w/wk/wks, mo/mos, y/yr/yrs. Read: "1d", "3h", "2w", "45m", "45min", "5s",
  "3h ago", "5m ago", "Posted 2d". Not read: "45", "Apply in 3d", "Size 5s".
- "1mo" and "1y" are read as 30 and 365 days (`m` is minutes, so `mo` is unambiguous), as "N months ago" already is.
- Risk: an `auto` sort column of values like "5m" or "3d" now reads as dates.
- One reader serves sort, condition and `within`. The domain imports Core's reader, so there is no second reader.
- Cases: 14 in `value-reading-cases.ts`, 11 in `condition/date-cases.ts`.

## One run now
- Core store: `storage/project/run-dataset-store.ts` `processDataset` judges relative dates at the run's
  `runtime_runs.started_at_ms`, falling back to processing time; an explicit `options.now` still wins. Test added.
- W `request.ts` `now?: number`; `read-request.ts` keeps it only as a non-negative integer.
- W `item-filter.ts` evaluates `request.now ?? Date.now()`.
- W `schema.ts` declares the condition's `within` and the request's `now`.
- W dispatch `domain/src/output-nodes/extract-list/dispatch.ts` (`webAutomationExtractListDispatch(parameters,
  runStartedAt?)`) adds `extractList.now` when the read has conditions, a start is given, and the request has none;
  `output-nodes/native-runtime.ts` reads `runStartedAt` defensively from the context.
- Not done (outside ownership):
  - Core `nodes/importer-sdk.ts`: `runStartedAt?: number` on `AutomationStudioNativeNodeContext`, filled by
    `executor/node-execution` from the graph run's `startedAt` (`executor/graph-run.ts:146`; executor is lane t799's).
  - Core `runtime/result-verification/build-test/stores.ts:140`: pass the run's `now` (lane t795's directory).
  - W `domain/src/runtime/llm-evidence/node-run/replay-answer.ts:388` and `replay.ts` call the dispatch without a start.
  - Until Core supplies `runStartedAt`, the page reads relative dates at its own clock.

## Structure
- Contracts `condition-*` files moved into `process/condition/` (`holds.ts`, `text.ts`, `date-cases.ts`, barrel),
  tests to `condition/tests/`. `candidate-trial/tests/reads-undated.test.ts` folded into `reads.test.ts`.

## Commands
- C contracts `npx vitest run src/record-sets` (in lock): "Test Files 17 passed (17)", "Tests 258 passed (258)".
