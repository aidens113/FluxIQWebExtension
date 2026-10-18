# Auction negated-pattern numeric guard

Status: bounded source fix complete in t567; all assigned narrow checks passed; awaiting supervisor review/integration. No source changes in frozen t563, no paid rerun, commit/merge/push.

Actual run-mvdghd7e-267bcda3 failed without Flow: 93 calls / $0.110640684. Trial 0051 stored 6 / model judges 0052/53 yes, but Core refused with result.left_out_stating_a_kept_number and result.counts_look_right. Read-only actual-summary replay reproduced one false numeric contradiction on negated text matches; separate typed numeric limit remains intact. Required full debug is in t563 language-driven-flow-loop-plan/debugs/run-mvdghd7e-267bcda3.md. Model yes/counts alone never establish final oracle acceptance.

Own Core files: packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/left-out-stating-a-kept-number.ts and its existing tests/left-out-stating-a-kept-number.test.ts. Generic document-title exclusion with incidental digits failed first: 1 failed / 9 passed, 3.32 s. A mixed positive numeric-text and negated-pattern control passed already. Source now ignores only negated matches as quantity evidence. Positive numeric-text range checks, typed numeric predicates and all other result gates remain unchanged; no forced yes or model/task/oracle change. Broader semantic changes require a new proposal.

Validation performed: owning guard + result-verification/tests/verdict.test.ts; affected fluxiq compiler check; Core audit. Exact logs C:/Users/osrs_/AppData/Local/Temp/t567-auction-numeric-{failfirst,tests,check,audit}.log. No library build required for source-only review, no t563 rebuild.

Final validation: guard and verdict 2 files / 49 tests passed (50.94 s), actual fluxiq compiler check passed (83.976 s), Core audit passed (401 warnings / 1154 baselined), git diff --check clean. All exited 0. Source diff exactly 2 Core files, 16 insertions / 1 deletion. No build, paid rerun, commit, merge or push. No other source paths changed by worker.

Exact focused command (Core packages/fluxiq cwd):

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/request-rows/tests/left-out-stating-a-kept-number.test.ts src/programs/automation-studio/runtime/result-verification/tests/verdict.test.ts --maxWorkers=2 --minWorkers=1`

Fail-first command was the same owning guard file alone with maxWorkers=1/minWorkers=1. Core root compiler command: process-only FLUXIQ_BUILD_CACHE_DIR=off then pnpm.cmd --filter fluxiq check. Audit command: node scripts/structure-audit.mjs. Exact full stdout/stderr logs: C:/Users/osrs_/AppData/Local/Temp/t567-auction-numeric-failfirst.log, C:/Users/osrs_/AppData/Local/Temp/t567-auction-numeric-tests.log, C:/Users/osrs_/AppData/Local/Temp/t567-auction-numeric-check.log, C:/Users/osrs_/AppData/Local/Temp/t567-auction-numeric-audit.log.

Future changed-source live oracle/judge/zero-call replay remains required after supervisor integration/release. This narrow fix has not proved any prior auction candidate's oracle result.
