# Final-slot offer/execution repair
Status: Complete
Created: 2026-10-11
Last updated: 2026-10-12
Owner: B-debug worker

## Current State
Bounded t460 Core fix complete; downstream replay source is owned by C-validation. Final four Core files and current build are frozen. Fail-first reproduced the offer/execution mismatch; final focused checks passed. Supervisor independently reviewed source, observed74tests/4files and cache-free types pass, and updated authored Core architecture. No provider/browser or changed limits.

## Work Ledger
- Existing candidate wrap-up advertises submit/test through the last counted slot, but evidence-loop.ts final-decision guard assumes completion only for every non-cost bound. Cost-only exemption leaves duration/call/token advertisement inconsistent.
- Added owning evidence-loop/tests/final-slot.test.ts: submit/test across duration, literal iteration, token and cost one-slot bounds; decision that actually reaches deadline must not start a tool. Tests do not claim another trial fits or succeeds.

- Fail-first actual9tests:7failed/2passed, native1; non-cost submit/test blocked, cost paths preserved, expired deadline incorrectly labelled not_offered. Source change now admits actually offered candidate tools and guards actual deadline before starting them; tests rerunning.

- First implementation narrow checks passed74tests/5files and cache-free types native0. First native audit failed solely because new evidence-loop/tests file26 exceeded25; root notified. No runtime restructuring: final-slot cases now live in existing wrap-up-not-offered.test.ts alongside the same subject, new file removed. Both existing owning test directories stay25files.
- Preserve paid ending trace: final-decision-row.ts accepts a closed optional duration_limit code, old not_offered default unchanged. Actual expired deadline explicitly records duration bound and the paid decision, including when cost was the earlier estimated bound. Existing helper tests expanded accordingly.
- First forced owner fluxiq build native0,50.903seconds/7250files/21,114,566bytes; finished before final test layout mutation. Final narrow checks/native audit and fresh owner identity build follow on final layout.

## Final behavior and compatibility
- Candidate wrap-up tools offered in a one-slot duration/iteration/token estimate now reach ordinary tool eligibility, repeat, call-count and execution handling. Cost-bound path continues unchanged; actual provider admission/purse and candidate trial/completion/promotion owners are untouched.
- Candidate offered tool whose paid decision returns at/after the actual duration deadline does not start. Its paid trace is retained as llm_evidence_loop.duration_limit with existing usage/known tool name; exhausted budgetBound is explicitly duration even if earlier estimated slots tied cost. Existing helper default not_offered remains compatible for truly unoffered final requests.
- Literal last iteration may execute its already-admitted finishing tool, then ends exhausted iterations if no further completion decision remains. No extra decision, timeout, token/cash/call allowance or promotion granted. A submission/trial cannot be assumed to fit in remaining time or succeed; a tool already admitted is not forcibly cancelled by this local deadline check. Existing cancellation/executor/provider gates retain ownership.
- Draft loops still offer only completion in their final non-cost slot, and final unknown/withheld requests retain existing refusal trace. Supported completion behavior is unchanged. No model guidance, task, schema, oracle, scenario pattern or example was changed. Helper argument addition is optional with prior default and existing exports intact.

## Precise changed paths
Core packages/fluxiq/src/programs/automation-studio/runtime/llm/:
- evidence-loop.ts (offered candidate admission and actual deadline)
- evidence-loop/final-decision-row.ts (closed optional truthful stopping code)
- evidence-loop/tests/final-decision-row.test.ts
- evidence-loop/tests/wrap-up-not-offered.test.ts (all9neutral final-slot cases; no new test file)
Coordinator800lines, wrap-up test107lines. No unrelated files/source ownership expansion. loop-budget.ts unchanged.

## Validation on final source/layout
- Fail-first new cases:7failed/2passed, native1; actual non-cost offering mismatch reproduced.
- Final actual owning command: pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/wrap-up-not-offered.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/final-decision-row.test.ts src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts src/programs/automation-studio/runtime/llm/tests/evidence-loop.test.ts.74passed/4files, native0 (11+3+21+39). Preserves existing purse-provider stub, completion/refusal, wrap-up and tool behavior gates; no real provider.
- pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental false: fresh cache-free owning typecheck native0 after final test placement.
- node scripts/structure-audit.mjs: final native0, passed331warnings/1159baselined; ignored local core-final-slot-structure.log. Two baseline reductions noted but no unrelated baseline rewrite. Initial failed file-count audit corrected through existing test owner rather than exempting rule.
- git diff --check native0. Only4approved Core files modified; downstream own report plus C-validation independent replay work. No full suite, browser, live/provider call, panel, budget override, commit/merge/lifecycle operation.
- Final forced fluxiq owner build in flight; no source changes during it. Current source/build identity and C-validation emitted build handoff will be reported after native completion.

## Architecture text owed to supervisor
Candidate wrap-up retains submission and testing in every advertised final estimated slot. Executability follows that offered-tool contract and ordinary call/purse/candidate gates, rather than a completion-only assumption. A decision returning after actual duration expiry leaves a paid duration-limit trace and cannot start another candidate tool. Estimated remaining time is not a guarantee a trial fits; literal decision ceilings and guarded completion/promotion still apply. This is the bounded source change justified by C's advertised-but-refused final test; no semantic judge or live qualification claim.

## Completed handoff
Final forced owning build: FLUXIQ_BUILD_FORCE=1 pnpm.cmd --filter fluxiq build, native0,47.101seconds/7250outputs/21,114,566bytes. Source/layout stayed fixed through build. Current dist/runtime-build-identity.json regenerated by owning build. C-validation/root notified that Core source/output are frozen and normal downstream freshness-gated owner builds may resume. No further Core read/check/write process is running. Report/source review remains supervisor-owned; no live acceptance claim.

Supervisor acceptance: independently observed the exact named74tests/4files command exit0 and fresh nonincremental Core tsc exit0 on final source. Reviewed ordinary eligibility/repeat/tool-count handling after the corrected guard; no limits or completion/promotion owners changed. Authored architecture updated; native integration audit and live qualification remain separate.
