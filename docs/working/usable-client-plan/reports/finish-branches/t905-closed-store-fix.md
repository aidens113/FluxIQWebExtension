# t905 closed-store fix

## Outcome
Done. Both service-wiring endings pass again; every named check is green.

## What changed and why
- `packages/fluxiq/src/framework/automation-service/service/summaries/run/detail-writer.ts`: in `saveTyped`, only `AutomationStudioProjectRuntimeStreamStore.open` is wrapped. `AutomationStudioProjectStoreUnavailableError.is(error)` returns `null` (legacy JSON detail is written, as on dev; the next typed save merges it via `readLegacy`). Every other open error is rethrown; read and write failures are untouched. Import and the method's comment updated.
- Dataset check (read, not assumed): `database.ts` `acquire` throws `AutomationStudioProjectStoreUnavailableError` whenever the pool is closing (lines 85, 93), and every typed and dataset write goes through the pool, so no dataset row can exist without its run row.
- `.../summaries/run/tests/detail-writer.test.ts`: two new tests. (1) An unavailable-store open writes the legacy detail; the next typed save (real SQLite) merges it, and the typed store then holds `metadata.projectStoreUnavailable`. (2) An ordinary `Error` that merely says "pool is closing" still propagates and writes no legacy file.
- `docs/architecture/automation-studio/persistence.md`: added the exception and its reason (t258, closed pool refuses dataset writes too) after the propagation rule.

## Commands run and observed results
- Vitest (via heavy slot, from packages/fluxiq, the brief's folder list; all folders exist at those paths) -> exit 0; Test Files 271 passed, 2 skipped (273); Tests 1907 passed, 4 skipped (1911). service-wiring.test.ts 7/7; detail-writer.test.ts 6/6.
- `pnpm.cmd --filter fluxiq check` (heavy slot) -> exit 0 (tsc ran, 113 s).
- `node scripts/structure-audit.mjs` from Core root -> exit 0, "passed (554 warning(s), 909 baselined)"; no rebaseline.

## Not verified
- Red-first was not run: I did not revert the fix to watch the new test 1 fail. The two service-wiring failures were already reproduced red on t905 in the earlier report and are now green.
- No full suites, Lab, browser or paid calls (per brief).

## Open questions or contradictions found
- None. The earlier report's path discrepancy (brief said `src/persistence`, real `src/framework/persistence`) did not affect this run.
