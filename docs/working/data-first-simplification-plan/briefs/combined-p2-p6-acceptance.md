# Combined P2 + P6 acceptance (t984 with t987 merged)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ` and `t984/!FluxIQWebExtension` only.
Read: this brief; the "2026-11-23 resume" sections of `reports/t984-data-stage.md` and `reports/t987-smaller-judge.md` in this tree. They hold every owner command and file list named below.

Goal: the combined automatic data stage (P2) and smaller judge (P6) pass every owner group, both package checks and both structure audits on one tree, so the lead can merge the unit into dev.

Starting state, set by the lead:
- Core head: t984 e2b1f2635, merged with t987 (clean), then current Core dev (clean, version 0.52.2).
- Downstream: t984, merged with t987 (one brief conflict, both briefs kept), then current dev (clean).
- Each lane passed on its own branch: P2 compatibility 37 files 195/195 and combined 24 files 192/192; P6 authority 77, semantic 255, checkpoint 112 and request/window 420. P6 composition was 160/196, failing only for missing P2 declarations that t984 now supplies. t984's Core audit had 16 violations, all in P6 files that t987 fixed. The merge should clear them.

Run each group through the gate, one at a time, and fix failures at their cause:
1. `node scripts/structure-audit.mjs` in Core. Expect 0 violations. Fix any that remain.
2. P2: the compatibility set (37 files) and the combined 24-file command, exactly as in the t984 report.
3. P6: authority, semantic, checkpoint, composition (20 files, including later-attempt, saved-read-restart, flow-stage-person-stop and endings judge, saved-on-every-ending, saved-shapes) and request/window, exactly as in the t987 report.
4. `pnpm --filter @fluxiq/contracts check` and `pnpm --filter fluxiq check` in Core.
5. Rebuild Core's libraries: `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` in Core. Then, downstream, run `pnpm --filter @fluxiq-web-extension/domain check`, the domain judge-evidence owners (`node scripts/test-domain.mjs runtime/llm-evidence/judge-evidence/tests runtime/llm-evidence/result-observation/tests runtime/llm-evidence/page-view runtime/llm-evidence/observed-state/tests` with `DOMAIN_TEST_BUILD_LABEL=t984-combined`), and `node scripts/structure-audit.mjs`.

Rules:
- Run every heavy command through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`. Run Vitest with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false` on named files only. No full suites. One heavy job at a time. Another agent is running Lab browser jobs, so expect to queue.
- Fix root causes. Never weaken, delete or skip an assertion or oracle, never add caps, and never change a timeout. Change a fixture only when it was invalid against the real contract, and write down why. Report any assertion you change.
- Keep the source-receipt contract as it is.
- No provider or paid calls, no browser runs, no git mutations (the lead commits), no `node -e` one-liners.
- Owned: everything in the two t984 trees except `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.
- Must not touch: other worktrees, the shared `fxwork/!FluxIQ`, recorded runs, `test-runs/`.

Report: write `reports/combined-p2-p6.md` with every exact command and result. End with the return contract.
