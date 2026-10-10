# t410: the run log shows a called part's steps under the step that called it

## Outcome

Done. All work is in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t410/!FluxIQ` on `task/t410-run-log-parts`. Nothing is committed.

## What changed and why

**Paged action rows now carry the frame fields** (gap 1). Core paths are under `packages/fluxiq/src/programs/automation-studio/`.
- New `storage/project/action-rows/frame-fields.ts`, with the barrel `index.ts`, exports `automationStudioRuntimeActionRowFrame`, which has two members:
  - `select` is the SQL. It reads the fields out of each row's stored `detail_json` with SQLite `json_extract`, so a page never parses a whole record.
  - `fields(row)` checks each field again before using it.
- It carries `parentAttemptId`, `framePath` and `subflowTarget`, as the brief asked.
- It also carries `failureClass`, `entry` and `lifecycle`, which goes beyond the brief. The log's rows are the paged rows, so the lifecycle wording needs these fields. They are ids and closed codes only, the same values the run detail already keeps.
- If a JSON field fails to parse, the error is thrown, not read as an absent field. The structure audit's failure-as-empty rule requires this, and SQLite wrote that text itself.
- The helper sits in a subdirectory because `storage/project/` was already at the 25-file limit.
- `storage/project/runtime-stream-store.ts` changed in three places: the import, the extra select columns in `listRunActions`, and `actionSummaryFromRow` spreading `fields(row)`. Its row type now includes the frame columns as optional fields.
- `runtime/service.ts` is unchanged, because the page type passes the new fields through as they are.

**The web run log groups each part's steps** (gap 2). Web paths are under `apps/web/src/features/automation-studio/`.
- New `runtime/action-log-frames.ts` exports `runtimeRunLogFrames(attempts)`. For each row on a page it returns:
  - `depth`, the nesting level. It counts from the parent row when that row is on the page. When it is not, it uses the frame path length minus one, with a minimum of 1.
  - `part`, set on the first row of each group of a part's steps, from the call row's `subflowTarget.subflowId`.
  - `continued`, set when the group's call row is on an earlier page.
  - `calls`, set on a Call Subflow row.
- The name avoids the `run-` prefix because that prefix's naming baseline is 5 and a sixth file would fail the audit.
- `RunDetailPanels.tsx`: `RuntimeAttemptRow` takes `frame?`. Rows inside a part get the `in-part` class and are indented through `--automation-runtime-part-depth`. A call row gets the `calls-part` class. The first row of each group has a full-width heading, "Part <name>", or "A called part, continued from the previous page".
- `RunActionLogView.tsx` computes the frames once per page and passes them to both of its row lists.
- New styles are at the end of `styles/runtime/04-controls-details.css`.

**The attempt-story wording**:
- New `part.ts` line on a call row: "Ran the part <name>; its steps are listed under this one."
- `child-run.ts` no longer prints its called-Flow line ("Ran the Flow this step calls") when the row is a Call Subflow (has `subflowTarget`).
- `lifecycle.ts` now builds its lines from five new modules:
  - `entry.ts`: "Started at <step>: …", worded by the entry's kind (another way in, a checkpoint, or a part's usual start). The root Flow's own default start stays silent.
  - `handler.ts`: "<When>, the handler for <situation> ran." When is "Before a step", "When the step failed" and so on. The outcome comes from the decided `disposition` and `completionCheck`: "It dealt with it, and the run carried on", "Went back to <checkpoint>", "Used the other way: …", or "It did not settle it…".
  - `cleared-layers.ts`: "Closed a notice the page put in the way: <kind>". It uses the kind only, never the control's page text.
  - `failure-class.ts`: true failure, planned failure, or uncertain.
  - `repair.ts`: held or dropped.
- `RuntimeAttemptStoryOptions` gained `handlerName?` and `partName?`, which name a handler by its situation and a part by its name. Without them the ids are shown in quotes.
- `runtimePartWords` was added to `words.ts` and is exported from the barrel. `RuntimeAttemptStoryKind` gained `part`, `entry`, `handler`, `cleared_layers`, `failure_class` and `repair`.

**Tests**:
- `storage/project/tests/runtime-stream-store.test.ts` has a new case. It pages the t406 frame fixture 3 rows at a time and checks `parentAttemptId`, `subflowTarget`, `framePath`, `entry` and `lifecycle` on the paged rows.
- New `runtime/attempt-story/tests/lifecycle.test.ts` (7 tests).
- New `runtime/tests/action-log-frames.test.tsx` (4 tests). It covers nesting, a page that opens inside a part, flat runs and bad rows, and the markup of an indented row and its heading.

## Commands run and observed results

- `pnpm --filter @fluxiq/contracts --filter fluxiq build`:
  - The first run failed: `failureClass` cast under exactOptionalPropertyTypes.
  - After the fix it printed `packages/contracts build: Done` and `packages/fluxiq build: Done`.
- `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` (Core typecheck, tests included): no output, exit 0.
- `npx tsc --noEmit -p .` in `apps/web`:
  - The first run showed TS2769 on the optional `frame` prop.
  - After the fix it printed no output, exit 0.
- `npx vitest run src/programs/automation-studio/storage/project` in `packages/fluxiq`: Test Files 39 passed, 2 skipped (41); Tests 317 passed, 4 skipped (321).
- `npx vitest run src/features/automation-studio/runtime/attempt-story src/features/automation-studio/runtime/tests` in `apps/web`, after rebuilding dist: Test Files 16 passed (16); Tests 161 passed (161).
- `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`:
  - The first run had 3 failures: the 25-file limit in `storage/project`, failure-as-empty on the JSON parse catch, and the `run-` prefix naming rule.
  - After the fixes: `structure-audit: passed (319 warning(s), 1160 baselined).`

## Not verified

- No live browser look at the indented log or its heading. The checks were static markup tests only, with no visual check of the CSS, including narrow widths.
- No caller passes `handlerName`, `partName` or `stepName` yet: the log view has no Flow in hand. Handlers and parts therefore show as quoted ids. Feeding names in needs the Flow's handler situations and part names, which this task did not have.
- I did not check how fast `json_extract` is on very large `detail_json` rows. A page holds at most 101 rows.
- No full suites were run, per the brief.

## Open questions or contradictions found

- The run detail's `lifecycle` record leaves out the trace's `selection`, so "why this handler" can only be told by its event and situation, not by its scope choice.
- A handler execution's `outcome` (succeeded, failed or refused) is on the run detail's `handlerExecutions`, not on the attempt. The row's handler line therefore words the outcome from `disposition` and `completionCheck` only.
- Run-detail action records do not carry `clearedLayers` or `repair`, which are on trace attempts only. Those lines appear only where the log is handed trace attempts, or a copy under `metadata`.
