# Processing metadata write recovery

Owner: Lead; bounded t984 regression found by compatibility tests.
Cause: opening already treated unscoped task-memory reads as best effort, but the new initial processing metadata write threw unconditionally before the attempt started. A failed-memory fixture therefore returned setup_needed instead of reaching its actual result.
Change: use existing best-effort handling for unscoped initial processing persistence; retain the actual declaration in memory. Scoped execution writes still throw before execution because forgotten scoped state can repeat a lasting act. Existing end-of-attempt persistence reporting remains unchanged.
Changed Core: attempt/opening.ts and attempt/tests/act-scope.test.ts; checkpoint81182b7a0.
Validation: gated `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/attempt/tests/act-scope.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` ->9/9 passed,69.62s, exit0. New cases prove live declaration survives unscoped failure and scoped failure still refuses; existing scope/act provenance negatives pass.
Not verified: corrected later-attempt actual-result/warning regression (processing worker owns its truthful declaration), final combined package checks and browser task acceptance.
Log: ignored `.heavy-slots/t984-opening-storage-regression.log`.
