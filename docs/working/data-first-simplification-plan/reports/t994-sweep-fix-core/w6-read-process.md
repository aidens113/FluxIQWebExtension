# t994 W6: a read's own declared process holds under a declared task

## Outcome

Done. `answer-first/tests/declared-process.test.ts` passes 4/4 and none of its assertions changed. Every acceptance suite passes, and so does the structure audit.

## Cause, as verified

W1's diagnosis is correct. In `result-feed/feed.ts`, `rows()` takes the `stage.active()` branch as soon as the task has a declaration. That branch called `stage.evaluate` without the output read's process. `stage.ts` `bind` then bound only `declaration.task.process`. The read's `recordOutput.process` reached the answer only on the legacy branch, through `merged(processes.get(output.id), held)`. The regression dates from 05d61fea4 (t984).

I found one more problem the brief did not name. `withResultProcessing` (`result-processing/processing.ts`) writes the stage's stamped canonical processing back into the saved step's `recordOutput.process`. That copy carries `declaration: {source, revision, bindings}`. A naive merge passes that key to `automationStudioAnswerFirstProcessingInputs`, which refuses it (`record_output.process_declaration_framework_owned`). The merge would then fail on every rerun of a saved step.

## Fix

- **`result-feed/merged-processing.ts` (new).** `automationStudioAnswerFirstMergedProcessing(own, held)` is the old `merged` moved into its own file, one export, used by both paths. The rule is unchanged: held keys go over the read's keys, key by key. One guard is new: held is spread only when it is itself an object. On the legacy path held is always an object or `undefined`, so its behaviour is identical.
- **`result-feed/feed.ts`.**
  - The legacy branch calls the moved function.
  - The active branch passes `own: processes.get(output.id)` to `stage.evaluate`.
  - The header now describes both paths truthfully. Under a declared task the read's process holds, and an unacceptable read process shapes nothing. On the legacy path, since t984, a merged processing that cannot be applied withholds the answer.
- **`result-feed/stage.ts`.** `evaluate` takes `own?: unknown`. `bind`:
  1. Builds the task process. Where it names no columns, it takes the person's sure asked columns (as before), so a read's own `columns` never hides what the person asked for.
  2. Binds `automationStudioAnswerFirstMergedProcessing(own, task)` through the same input-resolution and binder path as before.
  3. If that merged process does not bind, binds the task process alone. A read process the contract does not accept therefore shapes nothing, which is what test 3 and the header expect. A failure of the declaration itself is still the error reported, so a requested condition is never dropped.
  4. The cache key now includes the read's process: `stableJson({schema, declaration, askedColumns, own})`.
  5. A new helper, `readProcess`, handles a stamped own process. If the stamp's source and revision match the current declaration, it is this same saved merge, and it is read again with the stamp removed. If it was stamped under another instruction, or under a revision that has since been amended, it shapes nothing. Merging it would bring back a condition the amendment removed.
- **`result-feed/tests/automatic-support.ts`.** `read(...)` takes an optional fifth argument, `own`, which becomes the read's `recordOutput.process`.
- **`result-feed/tests/read-process.test.ts` (new, 5 tests).**
  1. A read's `where`, `sort` and `limit` hold under a declared task. The judge's processing account is checked too.
  2. The declaration's `where` applies on top of the read's process, the declaration's `sort` replaces the read's, and the read's `limit` still holds.
  3. An unacceptable read process shapes nothing, while the declaration's own binding failure is still reported.
  4. Changing a read's process gives a new result, not the cached one.
  5. A saved stamped merge is read again under the same declaration, and does not bring back a condition after an amendment.

## Files changed (Core, `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ`)

- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/feed.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/stage.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/merged-processing.ts` (new)
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/automatic-support.ts`
- `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/tests/read-process.test.ts` (new)

`answer-first/tests/declared-process.test.ts` was not touched.

## Commands run and observed results

All test commands ran from `packages/fluxiq`, in the foreground, through `heavy-slot.mjs run t994-w6`.

1. `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w6 -- node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/.../result-feed/tests/read-process.test.ts src/.../answer-first/tests/declared-process.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
   - parallel: read-process 5/5 passed.
   - real-sql: declared-process 4/4 passed.
   - Output ended "all groups passed".
2. Mutation check. I temporarily removed `own` from the cache key and removed the stamp handling in `stage.ts`, then ran read-process.test.ts (parallel). Result: 2 failed, 3 passed. The failures were "never answers a read's new process…" and "reads the merge the framework saved…". So both guards are exercised. I restored `stage.ts` from a scratch copy and confirmed the restore with grep.
3. The same runner over `result-feed/tests`, `result-processing/tests`, `tests/latest-read.test.ts`, `tests/row-identity.test.ts` and `tests/declared-process.test.ts`:
   - parallel: 18 files, 129 tests passed.
   - real-sql: 6 files, 48 tests passed.
   - Output ended "all groups passed: parallel, real-sql".
4. `node scripts/structure-audit.mjs` (Core root): "structure-audit: passed (570 warning(s), 903 baselined)", exit 0. Two warnings concern files I touched, and both are advisory:
   - `result-feed/feed.ts` is 508 lines. It was already past the 400-line threshold at 509.
   - `result-feed/tests/` has 21 files, past the 15-file threshold. It was already past it before my new test.

## Not verified

- No package typecheck, per the brief (the supervisor runs it). Vitest transpiles without type-checking, so type errors in `stage.ts` (the cached tuple type, spreading `{...process, columns}`) are unchecked.
- No answer-first suites outside the named ones, and no live, paid or browser runs.
- I did not run a saved-Flow rerun end to end through `flow-run` with an automatic declaration. The stamp handling is covered only at the feed level (test 5).

## Open questions or contradictions found

- **The legacy path contradicts the header's old promise.** The old header said an unacceptable read process "shapes nothing". Since t984, the legacy `processed` withholds the answer instead (`processing_invalid`). I made the header describe that truthfully rather than change legacy behaviour, which is outside this brief. The lead may want the legacy path to drop an unacceptable read process the same way the active path now does.
- **Asked-column precedence is my decision; no instruction covered it.** The person's sure asked columns now default at the task level, so they win over a read's own `columns`. Before this fix the read's process was ignored on this path, so nothing existing depended on the opposite order.
- **An amendment loses the read's original keys.** After an amendment, a saved step's stamped merge from the earlier revision is ignored entirely. The read's original sort or limit, folded into that saved copy, is then lost until the read is run again with its own process. I chose this over bringing back an amended-away condition.
