# t905 closed store: two service-wiring failures

## Outcome

Blocked. I traced the cause, but the fix belongs in a file the brief does not let me edit:
`packages/fluxiq/src/framework/automation-service/service/summaries/run/detail-writer.ts`. I edited nothing.

## Cause, with evidence

- Reproduced on t905: 2 of 7 tests failed, with exactly the errors in the brief: `ending.ts:86` ("could not record that its store was unavailable: ... pool is closing") and `ending.ts:74` ("could not be settled: ... pool is closing").
- Both failures are in `writeRuntimeSession` (service.ts:4065). It writes the session files, then the runtime summary (a separate SQLite repository, not the pool), then `saveFlowRunDetail` -> `AutomationStudioRunDetailWriter.saveTyped`.
  - Line 86: `ending.ts` writes the ended session.
  - Line 74: `judged-promotion.ts` `noteStoreUnavailable` writes the session with `judgedPromotionSettlement`.
- Dev's `saveTyped` (dev:detail-writer.ts:76-84) catches any failure to open the typed store and returns `null`, so the session's detail goes to the legacy JSON file. The next typed save then merges that file in (via the `readRunForUpdate` -> `readLegacy` path). Because of that, the session write survived a closing pool, which is the t258 guarantee that the session "lives outside the store".
- t905 commit 280c4bdad ("Checkpoint result provenance...") removed that catch on purpose. `AutomationStudioProjectRuntimeStreamStore.open` now propagates `AutomationStudioProjectStoreUnavailableError` ("pool is closing") through `writeRuntimeSession`, so both endings turn into AggregateErrors. Its stated intent (persistence.md, detail-writer.test.ts) is that a legacy file must not replace the SQL run row that run datasets need.
- No other file in the chain differs from dev: `git diff dev --stat` shows nothing for `service/runtime-session`, `service/runtime-adaptation`, `service/summaries/store.ts` or `service/command-execution`. The t905 changes under `service/datasets` and `persistence/.../project` (the evidence column and its migration) are never reached, because the store is closed before any of them runs. The cause is not in any path I own.

## Proposed fix (the lead needs to give me detail-writer.ts or apply it)

The fix narrows t905's strictness by one classified case and keeps everything else. In `saveTyped`, keep `requireProject` outside the catch. Wrap only `AutomationStudioProjectRuntimeStreamStore.open`:

```ts
let store: AutomationStudioProjectRuntimeStreamStore;
try { store = await AutomationStudioProjectRuntimeStreamStore.open({ pool: this.runtimeProjectDatabasePool, projectId }); }
catch (error) {
  // The store is gone (pool closing, t258): no SQL row, and no dataset row, can be written for this run,
  // so the legacy detail the typed store merges on its next save keeps the session's account.
  if (AutomationStudioProjectStoreUnavailableError.is(error)) return null;
  throw error;
}
```

- t905's tests still hold: a generic open failure ("migration refused") and any write failure still propagate.
- Datasets cannot be orphaned: when the pool is closing, `appendBatch` cannot write either (test 1 checks that no rows are saved).
- The error is not swallowed: the run records it in `metadata.projectStoreUnavailable` and `judgedPromotionSettlement`.
- Two companion edits:
  - A new row in `summaries/run/tests/detail-writer.test.ts`: a closed pool writes the legacy detail, and the next typed save merges it.
  - One sentence added to `docs/architecture/automation-studio/persistence.md` ("...propagates its original cause, except when the store is unavailable (t258)...").
- Why the fix cannot go in `ending.ts`: the adaptive case fails inside `noteStoreUnavailable`'s own write in runtime-adaptation, so that write has to succeed. The other place to fix it, `service.ts`, is on the must-not-touch list.

## Commands run and observed results

- From packages/fluxiq: `node .../heavy-slot.mjs run t905-closed-store -- pnpm.cmd exec vitest run src/framework/automation-service/service/datasets/tests/service-wiring.test.ts --maxWorkers=1 --minWorkers=1` -> exit 1; Test Files 1 failed; Tests 2 failed, 5 passed (7). The 2 failures are the two named tests, at ending.ts:86 and ending.ts:74.
- `git diff dev --stat` on the chain files listed above -> empty. `git show dev:.../detail-writer.ts` -> confirms dev's open-failure catch.

## Not verified

- The proposed patch has not been run. Applying it would mean editing a file I do not own.
- I did not run the brief's wider vitest set, `pnpm --filter fluxiq check` or the structure audit, because I changed nothing.

## Open questions or contradictions found

- The brief's owned paths say `packages/fluxiq/src/persistence/...` and `.../automation-service/runtime-session/**`. The real paths are `packages/fluxiq/src/framework/persistence/...` and `.../automation-service/service/runtime-session/**`.
- t905's documented rule (a configured store's open failure always propagates) conflicts with dev's t258 rule (the session survives a closed store). The lead should confirm the narrowing above is acceptable, and say whether persistence.md should be updated in the same change.
