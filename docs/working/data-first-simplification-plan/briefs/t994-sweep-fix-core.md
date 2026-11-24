# Fix forward Core's failures from the 2026-11-23 full sweep (t994)

Lead: Claude Code session, 2026-11-23. Role: sub-supervisor (Opus). Team: up to four workers at a time (`worker` by default, `worker-heavy` for an unknown cause), each with a written brief of at most 40 lines, partitioned by file.
Code: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ` (Core task branch). Briefs and reports: `t994/!FluxIQWebExtension/docs/working/data-first-simplification-plan/{briefs,reports}/t994-*`.
Read: this brief; Core's `AGENTS.md` (its rules apply in Core); and the Current State plus U1-U8 of `docs/working/data-first-simplification-plan.md` in the downstream tree.

Evidence: the full sweep at Core 2dba34613. `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep/core-test-clean.txt`, ANSI-stripped, holds three failure sets:
- **fluxiq, `parallel` group, lines ~240-3460:** 25 failures in 16 files. One example is `answer-first/loop-signal/tests/completion-refused-again.test.ts`, "climbs one model rung…", which pins the model ladder that U1 (2026-11-20) removed.
- **fluxiq, `real-sql` group, lines ~3462-12615:** 292 failures in 69 files, mostly `answer-first/**` and `automation-service/tests/service-bootstrap/**`. Leading errors:
  - 37× "Run again was refused: You stopped the last run of this task part way…";
  - 38× "expected true to be false";
  - 20× "expected 0 to be greater than 0";
  - 19× `stopped_by_person`/`stopped` where `achieved` was expected.
- **apps/web, lines ~16072-16110:** `src/tests/panel-tokens.test.ts` (colour literals) and `src/lib/platform/tests/scope-boundary.test.ts`.

Goal: every failure passes, for the right reason. Each one is either:
- a product regression, fixed at its cause; or
- a test pinning behaviour superseded on purpose, updated to the new contract, citing the commit and the rule. Rules are in AGENTS.md downstream and the plan's U1-U8: no model ladder, fixed starting model, the start-only permission (t976), repeat-safe repair (t981) and the automatic data stage (P2, t984).

Never weaken an assertion, delete a test, skip it or cap a symptom. If a guard such as the "stopped part way" refusal fires in tests that should not reach it, find out whether the guard is too broad (a product defect) or the fixtures now need the state it requires.

Method:
1. Cluster by first error and file, and find the commit that broke each cluster with `git log` and `git bisect` run on single files.
2. Brief one worker per cluster by file. Verify each claim by rerunning the files yourself.
3. Run tests the way `packages/fluxiq/package.json` "test" does, through `scripts/vitest-groups.mjs` with the right group, but only on named files with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`. Never run the whole suite.

Rules:
- Every heavy command goes through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one heavy job per worker at a time.
- No git mutations (the lead commits), no `node -e`, no provider or paid calls, no browsers.
- Model guidance never mirrors a realistic scenario.

Owned paths, in the t994 trees only:
- Core `packages/fluxiq/**` and `apps/web/**`;
- your `t994-*` briefs and reports downstream.

Must not touch, without asking the lead first:
- `packages/contracts/src/record-sets/process/**` and the source (non-test) of `packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/**`, which lane t993 owns. If a failure's cause is there, report it.
- other worktrees, the shared `fxwork/!FluxIQ`, `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.

Before returning, run on the final tree:
- each touched file group;
- `pnpm --filter fluxiq check`;
- Core `node scripts/structure-audit.mjs`.
Bump the `fluxiq` patch version once, if product source changed.

Report: `reports/t994-sweep-fix-core.md`. List per cluster: cause, breaking commit, fix or test update, and the exact commands with observed counts. Return the return contract.
