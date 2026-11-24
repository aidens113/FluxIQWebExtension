# Fix forward the domain failures from the 2026-11-23 full sweep (t991)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t991-sweep-fix-domain` (shared Core beside it at 2dba34613, read-only).
Read: this brief; the Current State of `docs/working/data-first-simplification-plan.md`; the failing tests' own files.
Evidence: `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep/sweep1123-down-test.log`, from the full domain run at downstream c61dbf0fa (dev minus docs) / Core 2dba34613. 14 of 3164 domain tests failed. Their "not ok" blocks start at these lines:
- 8147 (1039) the bound production evidence gateway sends one supported or ordinary read normally
- 13883 (1990) dotted extractList.fields and extractList.minItems read as the nested form does
- 14140 (2029), 14280 (2030), 14464 (2034), 14900 (2091), 15062 (2095): extraction handles, detected lists, extract nodes
- 15930 (2219) loop: explicit web examples reconstruct the pinned original UTF8 bytes
- 20388-20464 (2936-2940) actual saved repair: five tests
- 20892 (3008) four verified paging no-effects exhaust the normal first-plus-three ladder without stale-source refresh

Goal: every one of the 14 passes, for the right reason. Each one is either:
- a product regression to fix at its cause; or
- a test pinning behaviour that a later change superseded on purpose, to be updated to the new contract.

Steps:
1. Reproduce in this worktree with `DOMAIN_TEST_BUILD_LABEL=t991 node scripts/test-domain.mjs <path fragments>`, run from `domain/`. If one passes here, report it as sweep-tree only and why.
2. Group the failures by cause. Use `git log` on the test and its subject to find the commit that broke each one; recent merges are t984 (P2 data stage), t986 (offline proof), t985 and t989.
3. Fix each cause. To update a test as superseded, cite the commit and the rule (AGENTS.md or the plan) that superseded it. Never weaken an assertion to make it pass, never delete a test, and never cap a symptom.
4. Rerun the affected tests, then `pnpm --filter @fluxiq-web-extension/domain check` and `node scripts/structure-audit.mjs`.

Rules:
- Run every heavy command through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`, one heavy job at a time. No full suites.
- No git mutations, no `node -e`, no provider or paid calls, no browsers.
- Model guidance never mirrors a realistic scenario.
- If a cause is in Core, stop and report it with the Core file and line; do not edit the shared Core.
- Owned: `domain/**`, and `docs/working/data-first-simplification-plan/reports/t991-sweep-fix-domain.md`.
- Must not touch: `apps/**` and `packages/**` (lane t992 owns those failures), the shared `fxwork/!FluxIQ`, other worktrees, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.

Report: `docs/working/data-first-simplification-plan/reports/t991-sweep-fix-domain.md`. Give per test its cause, fix or update, and the commit that broke it. End with the return contract.
