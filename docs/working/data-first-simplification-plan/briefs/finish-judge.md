# Finish the smaller judge (P6, t987)

Lead: Claude Code session, which took over from the Codex session on 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t987/!FluxIQ` and `t987/!FluxIQWebExtension` only.
Read: this brief; the P6 row of Current State in `docs/working/data-first-simplification-plan.md`; lines 1-30 ("Post-reboot validation") of `reports/t987-smaller-judge.md`, then the sections that cover the files you touch; `briefs/post-reboot.md` for the frozen source-receipt contract.

Goal: P6 accepted. On every judge call path, the judge reads the stored rows, the data stage's account of what it removed, and a short screened trail instead of page captures. Recovery from a historical evidence gap clears a requirement only on the exact source, under current authority.

Starting state, observed by the lead on 2026-11-23:
- Core `9bc172cf2` (revalidate repaired judge evidence against current source authority, including resolved findings reopened from storage and later reuse of the same tuple) and the structure corrections `cb1aa1d0d` and `bd82236c0` have had no test, type or audit run since they landed.
- The last observed results predate them: five-owner recovery/window/request 45/45, structural 90/90, types passed, audit 33 violations before corrections. The lead's independent acceptance batch never ran.
- The FluxNode fixture repairs that the previous judge worker held moved to the t984 lane. They are not yours.
- The lead merges `dev` into both trees before you start. Expect the head to be a merge commit.
- The downstream structure audit fails, so the branch cannot be pushed. Seen: `contract-spread` in `domain/src/runtime/llm-evidence/judge-evidence/{action,project,read,state}.ts` and `tests/project.test.ts`. Write each field by name through `present<T>()`, as the rule explains. Check the Core audit too.

Steps:
1. Run the owning tests of `9bc172cf2`. If the current-authority cases lack a regression (a resolved finding reopened from storage, a later reuse of the same tuple, an unrelated state or a higher revision that must not clear a requirement), add one.
2. Run the owning tests of every source file changed on the branch (`git diff --name-only dev...HEAD`), grouped by area: semantic/projector, checkpoint/witness, composition and reopen, request/window, downstream `judge-evidence`. Fix failures at their cause.
3. Run `pnpm --filter fluxiq check` (plus contracts if changed) and `node scripts/structure-audit.mjs` in Core, then `pnpm --filter @fluxiq-web-extension/domain check`, the downstream judge-evidence owners and the downstream audit.
4. Measure the complete judge request in UTF-8 bytes on the existing harness fixture before and after, with both rows retained. Report the numbers only, no payloads.

Rules:
- Run every heavy command (vitest, check, build, audit) through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`. Run Vitest with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false` on named files only. No full suites. One heavy job at a time.
- Fix root causes. Never weaken, delete or skip an assertion or oracle, no caps, no raw-capture fallback, no new terminal outcome, no permanent missing-evidence blocker. Change a fixture only when it was invalid against the real contract, and write down why.
- The judge stays on the task's model (no ladder, user 2026-11-20).
- Do not edit P2's producer files: `answer-first/result-feed/{source-state,feed,read-evidence}` and the result-evidence replacement type and parser. The source-receipt contract is frozen. If you need a change there, report the exact need. P2 merges before P6.
- No provider or paid calls, no browser runs, no git mutations (the lead commits), no `node -e` one-liners.
- Owned: everything in the two t987 trees except `docs/working/data-first-simplification-plan.md`, `docs/working/README.md` and the P2 files above.
- Must not touch: other worktrees, the shared `fxwork/!FluxIQ`, recorded runs, `test-runs/`.

Report: add a section "2026-11-23 resume" at the top of `reports/t987-smaller-judge.md` with exact commands and results. End with the return contract.
