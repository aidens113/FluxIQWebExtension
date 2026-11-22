# t981 repair progress

## Current progress

2026-11-22: Resumed the existing paired task trees. Preserved the interrupted edits to amendment/apply.ts and types.ts and the new repeat-hold.ts. Read the campaign diagnosis and scoped plan. Both save refusals originate in accepted amendments: withdrawing a repeat source/endpoint and introducing routing into a repeat body. Assembly remains the final authority and will not be weakened.

Implemented the repeat hold, exhaustive refusal wording/diagnostic maps, rerun transfer/rebinding/reordering before withdrawal and the loop-covered reference guard. Added campaign-shaped tests and assembly assertions, including shared-source repeat merging. The interrupted implementation missed the case where a new adjacent repeat extends an existing shared-source span over routed steps; the check now attributes that extension to the new routing. It also considers interruption steps' implicit optional routing.

Lead review identified the related pure move/add path. Those amendments now check a prospective draft before mutating the real one, refusing newly introduced routed bodies with the prior order, settings, claims and disposition intact. New regressions cover moving an already routed member, moving an endpoint past one, adding/keeping a withdrawn routed member and a valid keep that clears its old condition. Same-step routing rewrites unwind individually and preserve earlier valid routing with correct applied counts.

Lead approved the additional `packages/fluxiq/src/runtime/llm/evidence-loop/held-amendments.ts` and `evidence-loop/tests/held-amendments.test.ts` paths. Held refusals now translate repeat/through/routed back into the model's original numbering after a rerun and an independent reorder. Also synchronized `draft-amendment-feedback/feedback.ts`, `llm/tests/draft-amendment-feedback.test.ts` and `decision-handlers/tests/refusal-way-out.test.ts`, which project or exhaustively enumerate refusal contracts.

Done: all 281 distinct focused tests pass, the final package typecheck passes and the final structure audit passes. The audit caught the existing feedback test file crossing its line budget, so the new repeat-refusal test now lives in the owning feedback module's own tests folder; all assertions are retained and both affected test files passed again. The lead also added the required "Repeat-safe draft amendments" architecture note to the same authored architecture document; it is included in the final passing audit. The task tree is frozen for parent synchronization and integration.

## Changed paths

Core task tree (`C:/Users/osrs_/FluxStuff/fxwork/t981/!FluxIQ`):

- `docs/architecture/automation-studio/flow-authoring.md`
- `packages/fluxiq/src/runtime/flow-authoring/bootstrap/evidence-loop-steps.ts`
- `packages/fluxiq/src/runtime/flow-authoring/bootstrap/tests/evidence-loop-steps.test.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/amendment/apply.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/amendment/types.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/amendment/repeat-hold.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/amendment/tests/repeat-hold.test.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/loop-covered/covering-step.ts`
- `packages/fluxiq/src/runtime/flow-authoring/draft/loop-covered/tests/loop-covered.test.ts`
- `packages/fluxiq/src/runtime/llm/decision-handlers/tests/refusal-way-out.test.ts`
- `packages/fluxiq/src/runtime/llm/draft-amendment-feedback/fallback.ts`
- `packages/fluxiq/src/runtime/llm/draft-amendment-feedback/feedback.ts`
- `packages/fluxiq/src/runtime/llm/draft-amendment-feedback/refusal-reasons.ts`
- `packages/fluxiq/src/runtime/llm/draft-amendment-feedback/tests/repeat-refusal.test.ts`
- `packages/fluxiq/src/runtime/llm/evidence-loop/held-amendments.ts`
- `packages/fluxiq/src/runtime/llm/evidence-loop/rerun/replacement.ts`
- `packages/fluxiq/src/runtime/llm/evidence-loop/tests/held-amendments.test.ts`
- `packages/fluxiq/src/runtime/llm/evidence-loop/tests/rerun-replacement.test.ts`
- `packages/fluxiq/src/runtime/llm/tests/draft-amendment-feedback.test.ts`
- `packages/fluxiq/src/ui/activity-action/refusal-words.ts`

Downstream task tree: this report only. The earlier diagnosis report is preserved unchanged. Separately, at the lead's request, the approved read-only P1 proposal is recorded in t982's own `docs/working/data-first-simplification-plan/reports/t982-extraction.md`; no t982 product code changed.

## Validation

- Read-only intake: `git diff --stat` -> two modified tracked Core files; `git status --short` -> those plus untracked repeat-hold.ts.
- Interrupted focused vitest attempt: a queued request entered its slot as it was being stopped to finish the directly associated contract fixtures. `amendment/tests/apply.test.ts` passed 56 tests; the owned provider-free test process tree was then stopped. This is not acceptance; the finished tree will be checked again. No t981 test process remains from that attempt.
- No paid calls, panel management or git mutations. The only separate-tree write was the explicitly requested P1 proposal report in t982, described above.
- Complete focused attempt: `pnpm --filter fluxiq exec vitest run src/runtime/flow-authoring/draft/amendment/tests src/runtime/flow-authoring/draft/loop-covered/tests/loop-covered.test.ts src/runtime/llm/evidence-loop/tests/rerun-replacement.test.ts src/runtime/llm/evidence-loop/tests/held-amendments.test.ts src/runtime/llm/tests/draft-amendment-feedback.test.ts src/runtime/llm/decision-handlers/tests/refusal-way-out.test.ts src/runtime/flow-authoring/bootstrap/tests/evidence-loop-steps.test.ts src/runtime/flow-authoring/bootstrap/authoring/tests/draft-routing.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` through the heavy gate -> 279 passed, 2 failed, 15 files, 71.05 seconds. Both failures were in new add/keep tests' assembly helper, which incorrectly passed withdrawn steps to the low-level assembler. Their refusal and exact-state-preservation assertions passed. Corrected the helper to filter proposed steps as production's completion caller does; no product change made for this failure.
- `pnpm --filter fluxiq exec vitest run src/runtime/flow-authoring/draft/amendment/tests/repeat-hold.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` through the heavy gate -> 25/25 passed, 1 file, 24.60 seconds. Together with the 14 unchanged passing files above, all 281 focused tests pass.
- `node scripts/structure-audit.mjs` through the heavy gate -> 1 violation across 1 rule: `llm/tests/draft-amendment-feedback.test.ts` reached 817 lines, exceeding the 800-line budget. No other new audit violation. The new repeat-refusal test will move to the owning feedback module's own tests folder once the concurrent typecheck ends; then rerun the affected tests and audit.
- `pnpm --filter fluxiq check` through the heavy gate -> exit 0, `fluxiq:check` built successfully in 86,389 ms. This completed before relocating the added test; final incremental check pending.
- Final `pnpm --filter fluxiq check` through heavy label `t981-types-final` -> exit 0, `fluxiq:check` successfully rebuilt the changed inputs in 22,557 ms, after the test relocation and lead's architecture note.
- Final `node scripts/structure-audit.mjs` through heavy label `t981-audit-final` -> exit 0, `structure-audit: passed (563 warning(s), 909 baselined).`
- `pnpm --filter fluxiq exec vitest run src/runtime/llm/tests/draft-amendment-feedback.test.ts src/runtime/llm/draft-amendment-feedback/tests/repeat-refusal.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` through the heavy gate -> 53/53 passed (52 + 1), 2 files, 37.04 seconds. No product behavior changed after the earlier 281 focused tests; this rerun verifies the relocation/import and exhaustive-map changes on the final tree.
- `git diff --check` -> exit 0 with no output.

## Not verified

No browser/live model run or full suite performed; campaign coverage uses provider-free structural reproductions without page data. The supervisor still owns independent acceptance, commits, parent synchronization and integration. P1 is an approved proposal only and awaits the lead's integration/sync notice before product code changes.

Outcome: Done
Changed: 20 Core files listed above plus this downstream report; separately, t982 proposal report by explicit follow-up.
Validation: focused tests -> all 281 distinct tests pass; final relocated feedback tests -> 53/53; final package check -> exit 0; final structure audit -> passed; diff check -> exit 0.
Not verified: live browser/provider campaign, full suites and integration on parent dev.
Report: C:/Users/osrs_/FluxStuff/fxwork/t981/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t981-repair.md
Notes: Repeat references and bodies are protected before save without weakening assembly; reruns rebind/reorder before withdrawal. No git mutations or paid calls. Tree frozen for lead integration.
