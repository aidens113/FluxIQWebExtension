# Finish the automatic data stage (P2, t984)

Lead: Claude Code session, which took over from the Codex session on 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ` and `t984/!FluxIQWebExtension` only.
Read: this brief; the P2 and P6 rows of Current State in `docs/working/data-first-simplification-plan.md`; `reports/t984-data-stage.md` from "Observed runtime baseline" to the end; `briefs/post-reboot.md` for the frozen source-receipt contract.

Goal: P2 accepted. Removing duplicates, applying conditions, ordering and shaping run without the model asking, and every existing compatibility test passes for the right reason.

Starting state, observed by the lead on 2026-11-23:
- Batch `t984-af-compatibility-intent` (17 files) finished after the previous session stopped: 104 tests, 95 passed and 9 failed, in caller-seams (1), replay-over-done-act (1), acts-with-no-row (1), endings/saved-on-every-ending (2: expected saved state `partly_works`, got `notes_only`), interrupted (1), later-attempt (2) and skipped-rows (1). Log (UTF-16): `t984/!FluxIQ/node_modules/.cache/t984-acceptance/af-compatibility-intent.log`.
- The previous session edited 15 FluxNode test files plus `fluxnode/tests/library-lane.ts` and never ran them. The lead committed them unverified as Core `4c4868428`. Their failing baseline is the FluxNode table in the report (38 of 72 failed).
- The lead merges `dev` into both trees before you start. Expect the head to be a merge commit.
- The Core structure audit fails, so the branch cannot be pushed. Seen: `failure-as-empty` in `result-verification/judge-evidence/stored-finding.ts:10` and `run-trail/checkpoint/read.ts:28`; `service.ts` at 4305 lines against its 4304 baseline; barrel bypasses in `attempt-store/store.ts:34` and `attempt-store/tests/judge-checkpoint.test.ts:11`. The list may be longer. Fix each at its cause.

Steps:
1. Diagnose each of the 9 failures from its assertion and the product path it exercises. Decide from evidence whether it is a product regression or an invalid fixture, then fix that cause.
2. Run the 15 FluxNode files. Verify, correct or revert each of the previous session's fixture edits.
3. Rerun the full compatibility set (`t984-compatibility-independent`, file list in the report, 185 tests) until it passes, then the report's 22-file combined owner command.
4. Run `pnpm --filter @fluxiq/contracts check`, `pnpm --filter fluxiq check` and `node scripts/structure-audit.mjs` in Core. If downstream source changed, also run `pnpm --filter @fluxiq-web-extension/domain check` and the downstream audit.

Rules:
- Run every heavy command (vitest, check, build, audit) through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`. Run Vitest with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false` on named files only. No full suites. One heavy job at a time.
- Fix root causes. Never weaken, delete or skip an assertion or oracle, and never add a cap, timeout or retry limit to make a test pass. Change a fixture only when it was invalid against the real contract, and write down why.
- No provider or paid calls, no browser runs, no git mutations (the lead commits), no `node -e` one-liners.
- The source-receipt contract shape in `post-reboot.md` is frozen. Ask the lead before changing it. The P6 judge lane (t987) consumes it.
- Owned: everything in the two t984 trees except `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.
- Must not touch: other worktrees, the shared `fxwork/!FluxIQ`, recorded runs, `test-runs/`.

Report: append a section "2026-11-23 resume" to `reports/t984-data-stage.md` with exact commands and results. End with the return contract.
