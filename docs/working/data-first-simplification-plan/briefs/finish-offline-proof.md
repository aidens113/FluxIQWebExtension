# Finish the provider-free offline proof (S1/S2/S6, t986)

Lead: Claude Code session, which took over from the Codex session on 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t986/!FluxIQWebExtension` and `t986/!FluxIQ` only.
Read: this brief; the S1/S2/S6 row of Current State in `docs/working/data-first-simplification-plan.md`; the newest sections at the end of `reports/t986-offline-proof.md` and `reports/t986-content-startup.md`; `docs/architecture/recorded-offline-proof.md`.

Goal: provider-free proofs pass in a real browser. First, the Everything Store recorded read matches. Then a fresh Company website capture records the chat's native request. Then the per-site preflight: pairing, the chat starting the task, a person check answered, a permission answered, one read.

Starting state, observed by the lead on 2026-11-23:
- Downstream `4e364886d` is an unverified checkpoint of the previous session's split comparison. It compares raw native rows with raw recorded native rows, and rows projected by their actual owner (`webNodeReadWithRejectedRows(...).read.extracted`) with recorded canonical step rows. Neither may substitute for the other. Files: `domain/src/runtime/offline-reads/{index,model-result}.ts` and tests, `packages/test-runner/src/recorded-attempt-replay/read-parity/{boundaries,command,index,source}.ts` and tests. It was never compiled or tested.
- The Everything Store rerun (`report-original-six-rerun1.json`) fixed startup. The production read matched natively (20 rows, 0 calls) and failed only `canonical_recorded_rows_changed`: same-origin links are written as root-relative paths in the model-visible projection.
- The downstream structure audit fails on the checkpoint: `offline-reads/model-result.ts:2` imports `../llm-evidence/node-run/rejected-rows` instead of that directory's barrel.
- The Company capture (`test-runs/t986-fresh-capture-company-v1`) failed `native_request_not_captured` after reaching the starting snapshot. The suspected cause, an HTTP/service normalized-entry receipt mismatch, is undiagnosed.

Steps:
1. Compile the checkpoint and run its owning tests (domain offline-reads, test-runner read-parity), then the runner and domain types. Fix what fails.
2. Diagnose the Company capture from its preserved evidence and the code, and fix the cause. Do not change any timeout or wait.
3. Browser commands run only after the lead tells you both t986 trees are synced to the latest `dev`, because the Lab refuses stale lanes and `dev` is moving today. Order: the Everything Store recorded-read rerun to a new report file, the Company capture to a new evidence directory, then the social preflight. If you finish steps 1-2 before that message, stop with `Outcome: Partial` and say you are ready for browser runs. You will be resumed.

Rules:
- Run every heavy command (vitest, check, build, audit, Lab) through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`. Run Vitest with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false` on named files only. No full suites. One heavy job at a time.
- Lab runs are provider-free, on the ten realistic scenarios only, in visible (headed) browsers. Never overwrite an earlier report or evidence directory.
- Fix root causes. Never weaken a comparison, oracle or guard, never normalize one side to make it match, never cap. Report observed external calls and cost as observed (null when not observed, never zero).
- No provider or paid calls, no git mutations (the lead commits), no `node -e` one-liners. Never print recorded page data, tokens or secrets.
- Owned: everything in the two t986 trees except `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.
- Must not touch: other worktrees, the shared `fxwork/!FluxIQ`, historical recordings and earlier evidence directories.

Report: append a section "2026-11-23 resume" to `reports/t986-offline-proof.md` with exact commands and results. End with the return contract.
