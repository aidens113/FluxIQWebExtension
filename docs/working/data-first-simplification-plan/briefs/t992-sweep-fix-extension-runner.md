# Fix forward the extension, test-runner and check-script failures from the 2026-11-23 full sweep (t992)

Lead: Claude Code session, 2026-11-23. Tier: worker.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t992-sweep-fix-extension-runner` (shared Core beside it at 2dba34613, read-only).
Read: this brief and the failing tests' own files.
Evidence is in `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep/`, from the full run at downstream c61dbf0fa / Core 2dba34613.
`sweep1123-down-test.log` ("not ok" blocks start at these lines):
- 37619 (2026), 37640 (2027), 37661 (2028): apps/extension, a seat's disabled and marked reads
- 50970 (3716): apps/extension, "with no message channel there is no watch, and the press is judged as before marks"
- 54849 (216): packages/test-runner, "it takes exactly one model, its task, and the mode it drives"

`sweep1123-down-check.log`:
- line 4411 (722): `scripts/worktree/tests/core-build.test.mjs:122`, "the full list is exactly Core's own root build script, in its order". Core's root build script now lists `cloud` before `web`, and the downstream list lacks it.

Goal: all six pass, for the right reason. Each one is either:
- a product regression to fix at its cause; or
- a test pinning behaviour that a later change superseded on purpose (for example, 2026-11-20 "no model ladder: a task keeps the model it starts with" in AGENTS.md), to be updated to the new contract.

For 722, decide whether the downstream Core build list should build `cloud`, or whether the test should derive the list without it. Read Core's root `package.json` build script and what downstream consumes from Core (Core is read-only).

Steps:
1. Reproduce in this worktree. Use the narrowest command per package; see `docs/architecture/repository-layout.md` "Commands" for each package's single-file test form. If one passes here, report it as sweep-tree only and why.
2. Find each cause, using `git log` on the test and its subject.
3. Fix the product, or update a superseded test, citing the commit and the rule. Never weaken an assertion, delete a test or cap a symptom.
4. Rerun the affected tests, the touched packages' `check`, and `node scripts/structure-audit.mjs`.

Rules:
- Run every heavy command through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`, one at a time. No full suites, no git mutations, no `node -e`, no provider or paid calls.
- A browser spec, if one is needed, is visible and uses a realistic scenario only.
- If a cause is in Core or in `domain/`, stop and report it with the file and line.
- Owned: `apps/extension/**`, `packages/test-runner/**`, `scripts/worktree/**`, `scripts/check/**`, and the report below.
- Must not touch: `domain/**` (lane t991), the shared `fxwork/!FluxIQ`, other worktrees, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.

Report: `docs/working/data-first-simplification-plan/reports/t992-sweep-fix-extension-runner.md`. Give per test its cause, fix or update, and the commit that broke it. End with the return contract.
