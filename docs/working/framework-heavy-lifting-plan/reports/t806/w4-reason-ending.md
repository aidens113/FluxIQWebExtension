# w4 reason and ending

Outcome: Done

## What changed and why
Paths are under R = packages/fluxiq/src/programs/automation-studio/runtime/ in the t806 Core tree.
- R/activity/decision-reason.ts: added `core(decision, line)` and `isCoreWritten(decision)`. `of()` returns a Core line exactly as it returns a model reason. A later `attach` clears the Core mark. Existing model-reason behaviour is unchanged.
- R/activity/folded-reason.ts (new): `automationStudioActivityFoldedReason({ did, because })` returns "Core <did> because <because>." Each part goes through `automationStudioActivityReasonText` (the observer's screening), loses its closing stop, and gets a lowercased first letter. It returns undefined if either part reduces to nothing. Exported from R/activity/index.ts.
- R/service/project-build-ending/ending-told.ts: `reason` is now `reason?: string | undefined`. When the screened supervisor reason is empty or reduces to nothing and a record exists, `why` is the record text, and the record is left out of `text` so no sentence repeats. A supervisor reason that survives screening gives today's behaviour. Callers in project-build/run.ts and conversations/commands/build.ts were not touched; they still pass a string.

## Commands run and observed results
- vitest on folded-reason, decision-reason, observer, decision-words and narration (activity/tests) plus the whole service/project-build-ending/tests directory: 10 of 11 files passed, 98 of 99 tests passed. The one failure was in my new test, which asserted `not.toContain` on an undefined result. I fixed the test to `said ?? ""`.
- vitest on folded-reason.test.ts alone, after the fix: 4 of 4 passed.
- Both runs were wrapped in the heavy-check lock.

## Not verified
- I did not run the typecheck, as instructed. The callers' compile with the optional `reason` is therefore unchecked.
- I did not re-run the full set after the one-line test fix; only the changed file was re-run.
- Nothing calls `core()` yet, so no producer of folded steps uses it.

## Open questions or contradictions found
- None.
