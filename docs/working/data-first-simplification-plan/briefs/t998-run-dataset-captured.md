# The run dataset's end-of-run answer reads captured-but-absent cells as "not shown" (t998)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy (the t993 worker, continuing).
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t998/!FluxIQ` (Core task branch) and `t998/!FluxIQWebExtension`.
Read: this brief; your t993 report (now on dev: `docs/working/data-first-simplification-plan/reports/t993-absent-cell-semantics.md`); Core `docs/architecture/retained-records.md`; `packages/fluxiq/src/framework/persistence/automation/project/run-dataset-answer/**`, `run-dataset-store.ts`, and migration 0040 (`run_dataset_exclusions`) as the pattern.

Gap, found by t993: the answer-first feed now passes each row's `captured` field list, so a tag the read captured but an item does not show is a definite "not shown". The run-dataset store's end-of-run automatic answer (`run-dataset-answer/answer.ts`) has no per-batch field list, so it still returns `processing_evidence_missing` over the same cells. A saved Flow's later attempts can therefore end in missing evidence while the feed said ready. That blocks the four-attempt acceptance the paid round needs.

Lead's decision:
- Add migration 0041. It stores each batch's captured field ids, from that batch's own stored schema at write time.
- Give `answer.ts` those ids as `captured`, so the store's answer and the feed agree on every row.
- A batch written before 0041 has no list, so its rows keep today's behaviour (missing evidence). Never infer a list from other batches or from values.
- Keep it minimal, with no public schema change. Follow 0040's migration pattern and its tests.

Steps:
1. Find where batches are written and where `answer.ts` reads rows. Add the column, the write and the read, one exported thing per file.
2. Tests in the owners' `tests/` folders:
   - the store's answer and the feed's answer agree, on the same rows, for a captured-but-absent tag;
   - a pre-0041 batch still withholds;
   - a schema that grows between batches keeps each batch's own list;
   - migration up on an existing database fixture (temporary databases only, never the user's).
3. Bump the `fluxiq` patch version over dev's.

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- the touched files through `scripts/vitest-groups.mjs` with their group (real-sql for store tests), named files only, `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`;
- `pnpm --filter fluxiq check`;
- Core `node scripts/structure-audit.mjs`.
No full suites, no git mutations, no `node -e`, no provider or paid calls, and never the user's database.

Owned:
- Core `packages/fluxiq/src/framework/persistence/automation/project/run-dataset-answer/**`, `run-dataset-store.ts`, the new 0041 migration file and wherever migrations are registered, and their tests;
- `docs/architecture/retained-records.md`;
- your brief and report.

Must not touch:
- `answer-first/**` (lane t994) and `packages/contracts/**`, unless a one-line export is unavoidable (report it);
- other worktrees, the shared `fxwork/!FluxIQ`, `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.

Report: `reports/t998-run-dataset-captured.md`. End with the return contract.
