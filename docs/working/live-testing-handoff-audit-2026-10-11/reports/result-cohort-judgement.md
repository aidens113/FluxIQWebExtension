# Generic quantity and cohort judgement guidance
Status: Complete
Status detail: Prompt-only work and combined current-source narrow gates passed; supervisor acceptance/integration remains separate.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: result-cohort-judgement worker
Scope: t453 generic result-verification prompt and owning delivery/pin validation only.
Paired document: t453 Core runtime/llm/diagnosis-instructions.ts
Related: ../../../live-testing-handoff-audit-2026-10-11.md

## Current State

Supervisor verification after t452 sync: reviewed the generic prose and two generated pin changes;
independently ran delivery/pins 52/52, cache-free Core typecheck exit 0, actual domain freshness/source/test
check 22.221 s and both direct structure audits passed. Current owning build is fresh (worker 47.392 s,
7218 outputs; freshness independently accepted by the domain gate). Architecture updated by supervisor.
Ready for integration; semantic correctness still requires a new independent live oracle.
The original instruction, excluded-value witnesses and output cardinality were present in all three D judge requests; the failure was semantic interpretation, not missing evidence. The prompt now directs both candidate and runtime judges to interpret complete quantities, compare included/excluded witnesses against original requirements independently of the authored predicate, distinguish distinct subjects from before/after aggregate records, and refuse acceptance as no/unknown when omission/uncertainty remains.

This is stronger model guidance, not a deterministic arithmetic or completeness proof. No new coverage protocol/schema, numeric-condition semantics, oracle count, scenario content, examples, budget defaults or t452 source files changed. Future tests use the later user-authorized $0.25 preflight/environment, but no browser/provider launch belongs to this brief.

## Owned files and checks
- Core packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts: generic shared result-verification prose only.
- Core same llm/tests/diagnosis-channel.test.ts: actual mocked transport request for candidate/runtime modes; original generic instruction retained, current answer schema unchanged, unknown remains unknown.
- Core same llm/deepseek/tests/system-prompt-pins.json: two verification entries regenerated through fresh actual dist builder after canonical dist/index initialization; all 9 other entries unchanged. Supervisor approved before writes; no other worker owns pins.
- Existing deepseek/tests/system-prompt.test.ts, result-verification/tests/verdict.test.ts and build-test/tests/judge.test.ts are read/run for preserved message/uncertainty/confirmation contracts; no broad suite.

## Work Ledger
### 2026-10-11 - Delivery fail-first and scoped wording
- Agent: result-cohort-judgement worker.
- Changed: generic instruction prose, owning provider-bound delivery test and this report.
- Why: the judge trusted its incomplete cohort interpretation despite the excluded counterexample being present.
- Validation: named diagnosis-channel.test.ts ->2 new cases failed/19existing passed before source edit. Owning focused tests and library build currently running.
- Outcome: Partial; fresh pins, final narrow checks and supervisor t452 sync pending.
- Follow-up: preserve all nonverification pins, then verify actual built current source; no live correction claimed.

## Intermediate validation receipts
- Delivery fail-first: diagnosis-channel.test.ts2newcases failed/19existing passed; both actual outbound verification branches lacked the new guidance.
- After prose change: diagnosis-channel21, verdict29 and build-test/judge30 tests ->80/80passed,3files.
- Owner pnpm.cmd --filter fluxiq build ->freshcommand exit0,56.588s,7206output files stamped.
- Pin regeneration: node --input-type=module stdin script initialized packages/fluxiq/dist/index.js, imported actual dist internal deepseek/system-prompt.js, rebuilt only loop_verification and loop_verification_build_test, asserted all 9 other entries unchanged, then wrote JSON. Source diagnosis-instructions.ts SHA256711eb8c2aae5a89580cfe2de568938d1e6f6b1b2cce63d47e5ad3cfa491e2dc0.
- Direct internal dist import without canonical initialization hit an ESM initialization cycle before any pin write; no unowned source repair attempted. Supported canonical initialization succeeded. Initial old-pin run4verification-related assertions failed as expected; after regeneration system-prompt.test.ts31/31passed.
- git diff --check exit0; JSON pin comparison toHEAD confirms exactly2entries changed.
- All validation sessions finished; supervisor notified tree ready for t452 sync. Final package typecheck/audits and combined owning tests wait until that sync.
- No live provider/browser calls, full suites, source outside scope, commits or merges.

## Final combined-source validation
- Supervisor integrated t452 and preserved reviewed source at Core HEAD c53be8cf1a233b7a2780e293474275e8b73f961c; downstream HEAD bec8639b1f98bc1d16dcf915ca7cc11473af3f6e. Worker performed no integration/commits.
- Fresh combined owning library build passed (65.035 seconds, 7,218 files). Four focused files passed, 111 tests. Both verification pins matched the actual freshly built builder in a read-only comparison.
- Downstream direct structure audit passed (184 warnings, 646 baselined).
- First actual uncached current Core typecheck exposed a missing required buildTest.test field in the new delivery fixture; corrected it to ran. First Core structure audit exposed one new packed-statement line; separated the new callback statements. Production prompt and pins were unchanged by these corrections.
- Corrected fixture validation: all four files passed again (111 tests); actual pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental false exited 0; direct Core structure audit passed (330 warnings, 1,159 baselined); git diff --check exited 0. Final owning build completed freshly after the test correction (47.392 seconds, 7,218 files, source command). Both verification pins also matched this final actual built builder in a read-only comparison. Only the owning test file has an uncommitted correction after supervisor preservation/merge.

## Return and limits
All scoped work is complete. The final verification tree is Core c53be8cf plus the seven-line owning delivery-test correction; downstream bec8639b plus this report. Supervisor must independently review the claims and integrate the uncommitted correction/report. No provider calls, browser launches, full suites, commits, pushes or merges were performed by the worker. The tests verify current guidance delivery and preserved contracts; they do not prove that a live model will calculate quantities correctly or select the complete cohort. No deterministic completeness claim is made.
