# Web/Core contract fixture budget investigation

Status: Fixture-only correction complete and frozen in isolated t224; narrow contract validation passed. No commits/live/provider calls.

## Trigger and current scope

Supervisor full web suite observed 1,699 passed / one failed, with sole `core-contract` flow.build failure `pre_provider_request_total_exceeded`. Core baseline before this UX task is e5b8f015 (t210 rounds 1–2); this task has no package runtime edits.

Required brief/Current State read. Initial fixture evidence: `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts:147` advertises scripted tokenLimits input 8,000 / output 512 / total 9,000. Diagnose current public budget and prepared request reserve before proposing an exact fixture-only change. Preserve the successful public-contract assertion; no skip, refusal expansion or timeout increase.

## Resume

Diagnosis and approved fixture correction complete; session 97510 passed. Keep the fixture frozen for supervisor's full web rerun. Core composer belongs to supervisor and is excluded here.

## Root cause and minimal proposal

- The contract fixture explicitly binds 8,000 input / 512 output / 9,000 total at core-contract-world.ts:147. Its script reports actual usage 900/100/1,000 only after invocation; those numbers cannot satisfy a pre-provider request check.
- Current public `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS.tokenLimits` is 992,000 input / 8,000 reply / 1,000,000 total, derived from the model window (`runtime/llm/session-key-provider.ts:53`, `harness/token-limits.ts:54`). It is exported through `runtime/index.ts:19` and `llm/index.ts:98`, so no private leaf import is needed.
- Harness `runtime/llm/harness/run.ts:97` checks measured input; line 100 checks measured input plus reserved reply against total. This fixture's total check rejects whenever measured input exceeds 8,488 (9,000 − 512). The result reports providerInvocation not_attempted, and `flow-bootstrap/generation-failure/harness-failure.ts:145` maps that total-budget guard to the observed error. Current generic capability error does not include the exact measured input; do not invent that number.
- Baseline t210 commit b7305903 (included in e5b8f015) removed ranked/truncated node catalogs and instruction cuts; its current source retains explicit caller token limits. `git diff e5b8f015 -- <core-contract-world.ts>` is empty: the stale literal was inherited, not introduced by UX fixes.
- Same repository already corrected an equivalent fake-profile mismatch in `runtime/conversations/commands/tests/extension-chat.test.ts:133`, using the public session-key token limits and explaining why a made-up small window rejects untrimmed requests. Read only; no protected file edited.
- Proposed exact change, awaiting supervisor clearance: only `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts`; add public constant to its existing runtime import and replace only the tokenLimits literal with `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS.tokenLimits`. Provider still scripted, one call, $0.25 cost ceiling, 20-second provider timeout, script response and all contract assertions/refusal exceptions unchanged. This aligns a non-budget contract fixture with current public profile; it does not weaken runtime budget enforcement.
- After clearance: run the original failing flow.build variant against the public/default fixture, then the full core-contract file (all capabilities/arguments must remain accepted with existing exact exceptions). Use heavy.sh, no new refusal allowance/skip/timeout. Any different failure is diagnosed separately. Current state: no product/test change and no controlled test run yet.

## Approved change and validation in progress

Supervisor approved only core-contract-world.ts and updated the written brief. Added `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS` to its existing public runtime import; tokenLimits now references the published current contract. The fixture's provider response, usage, one-call bound, $0.25 ceiling, 20-second timeout and all capability assertions/refusal allowances remain unchanged. No runtime/package change or new arbitrary numeric budget.

Explicit `C:/Program Files/Git/bin/bash.exe` / `C:/Users/osrs_/FluxStuff/build-slots/heavy.sh` label `codex t224 current-contract fixture regression`, command `pnpm exec vitest run src/features/automation-studio/conversation/capabilities/tests/core-contract.test.ts` in Core apps/web. Session 97510 acquired b1 and Vitest started. This full single-file regression includes original flow.build and all capability variants. Source frozen; report result before root's whole web suite rerun, which also verifies the independently fixed Core composer. `git diff --check` observed exit 0 after the approved change.

## Observed result and handoff

Supervisor verification complete: inspected the exact public-default fixture
diff and raw narrow60/60 completion, then independently ran final whole web suite
session98054: exit0,287files/1704tests passed,212.84s. The original flow.build
contract now passes there too,53/53variants across45capabilities accepted.
Core95573296 checkpoints the approved fixture correction and separate composer
fix. No runtime budget/assertion/timeout change, live call, merge or push.

Session 97510 exited 0: one file / 60 tests passed, duration 75.21 seconds. Capability contract output records 53/53 variants accepted across 45 capabilities, including `flow.build [on a blank Flow] -> generate-flow-bootstrap-adaptation`. No failed or skipped tests. The original successful public-contract expectation now passes using the shipped provider profile; existing legitimate refusal cases remain unchanged.

Full completion output saved at `C:/Users/osrs_/AppData/Local/Temp/codex-t224-core-contract-fixture.log` for independent supervisor inspection. Own source file and this report frozen. Required remaining supervisor work: independently inspect the narrow result, rerun whole web suite after its separate composer correction, and integrate/commit. Worker did not rerun broad suite/build or edit runtime packages, composer, other tests, shared plans or generated data.
