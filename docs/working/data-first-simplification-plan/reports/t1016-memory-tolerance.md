# t1016 report: memory tolerance

## Outcome
Done. `tolerated` in `task-model/resolve.ts` now swallows only the new typed `AutomationStudioAnswerFirstTaskMemoryStoreError`; everything else throws.

## What changed and why
All under `packages/fluxiq/src/framework/automation-service/service/answer-first/` in Core:
- `task-memory/store-error.ts` (new): `AutomationStudioAnswerFirstTaskMemoryStoreError`, "store could not be read or written", driver error kept as `cause`.
- `task-memory/store-io.ts` (new): `automationStudioAnswerFirstTaskMemoryIo(work)`, the boundary. Converts an error to the store error only by its driver `code` (Node system errno `/^E[A-Z0-9]+$/`, or SQLite `SQLITE_*` / `ERR_SQLITE*`); never by message. TypeError, bad argument, integrity error and `program_state.invalid` pass through.
- `task-memory/store.ts` (the store adapter; no other adapter touched): unscoped `get` and `update` run through the boundary (`update` body moved to private `write`). Scoped paths unchanged, still strict and keep their own errors.
- `task-memory/index.ts`: barrel exports both new things.
- `task-model/resolve.ts`: `tolerated` rethrows unless unscoped and a store error.
- Tests: `task-model/tests/resolve.test.ts` (store failure tolerated; scoped throws on store failure; TypeError thrown; integrity error thrown), new `task-memory/tests/store-io.test.ts` (classification by code, not message).

## Commands run and observed results
- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql ...task-model ...task-memory --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> parallel: 4 files, 29 tests passed; real-sql: 3 files, 35 tests passed; "all groups passed".
- After a formatting-only edit (structure audit flagged a packed line), `--groups=real-sql ...task-model` -> resolve.test.ts 12 tests passed.
- `node scripts/structure-audit.mjs` (Core root) -> first run FAIL statement-packing on resolve.test.ts line 113; fixed; rerun "structure-audit: passed (571 warning(s), 903 baselined)".
- `pnpm --filter fluxiq check` -> build-cache ran tsc, printed no errors (ran 118 s, no stamp). The "exit=0" I saw was after a `| tail`, so tsc's own exit code was not read directly; no diagnostics were printed.

## Not verified
- Real-driver mapping of an actual EBUSY/SQLite failure through the real store (only unit-tested on the boundary function and via mocked store methods).
- Version left alone as instructed.

## Open questions or contradictions found
- The attempt's opening read (`attempt/opening.ts` line 76, `readOrNothing` -> `automationStudioAnswerFirstBestEffort`) swallows every error from `memory.get` the same way. It is in `attempt/**`, off limits for me; it should be switched to tolerate only the new store error (shared helper is also used for `stores.store.list` and `stores.acts.get`, so those would need their own classification).
- Other store failures the real store raises as plain errors without a `code` (none found) would now surface rather than be tolerated.
