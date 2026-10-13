# Codex t516 review

Status: Done
Created: 2026-10-13
Last updated: 2026-10-13
Owner: codex-t516 worker
Scope: Review existing t516 handler learning and robot-check diagnosis in paired t516 worktrees; focused validation only.

## Current State

Source review, focused behavioral checks, touched-package typechecks and both structure audits passed in the paired t516 trees. Changes remain uncommitted for supervisor integration and re-verification. No commits, merges, browser/Lab runs or full suites.

## Findings and changes

- Preserved all original uncommitted work and the settled decision: model-free learning remains enabled when adaptations are kept.
- Fixed identity defects in Core interruption learning and its shared fix recorder. Repair and intervention IDs previously collided for every layer cleared by one attempt; timestamp-only adaptation/proposal IDs also overwrote one another when learned in the same millisecond. A separate-incident regular repair reproduced the same timestamp defect. Learning repair IDs now hash run/frame/attempt/opaque way-out; the shared recorder derives bounded SHA-256 adaptation/proposal IDs from repair identity and patch. Identifiers contain no page names or target descriptors, and proposal links stay synchronized. Fixed-clock regressions failed before each fix and pass afterward.
- Added a real-domain playback regression to the existing dispatcher test: host binding, dispatcher registry, fresh cleared-control handle issuance, partial view retention and view-history target resolution work without an exploration/model look. The resolved target uses the dismissal selector, without a handle. Source wiring: `domain/src/runtime/service.ts` unconditionally binds the evidence runtime; `llm-evidence/tools.ts` shares `webAutomationClearedWayOutsOf(fluxiq)` with the dispatcher; `way-out-handles/cleared-control-handles.ts` itself creates/remembers the partial view.
- Added learning-to-judged-settlement integration rows for a successful judged answer, failed run, refuted result and unjudged success. Only the first applies; all make zero provider requests. Failed/refuted/unjudged records stay unapplied and reviewable, not deleted.
- `validation.ok: true` means deterministic resolution and structural preflight passed, not that the newly authored handler executed. `prepareAutomationStudioInRunRepair` creates an unverified `in_run_trial` adaptation awaiting the judged run. Updated Core architecture and downstream extension contract documentation to make this distinction explicit.
- The original report did cover the supposed false robot check. The first search serves an actual soft check while `guard.softCheck` is pending (`everything-store/route.ts:49`), unlocking its button at 1.5 s and passing automatically at 8 s (`client/soft-check-script.ts`, `timings.ts`). Results/wheel/notification negative detector tests and the real person-only captcha positive test pass. No detector production change was necessary.

## Validation ledger

- Fail-first Core multi-layer test: repair IDs equal; after repair-ID fix, fixed clock exposed one adaptation instead of two. Both defects corrected.
- Core selected tests: 7 files / 103 tests passed; selections are `runtime/service/runtime-session/tests/{interruption-learning,interruption-handler,in-run-repair}.test.ts`, `runtime/executor/step-loop/tests/learned-interruption.test.ts`, `runtime/executor/node-execution/tests/cleared-layers.test.ts`, `runtime/service/runtime-adaptation/tests/{judged-promotion,held-fix-validation}.test.ts`. Command from Core `packages/fluxiq`: `pnpm.cmd exec vitest run` followed by those seven `src/programs/automation-studio/` paths. After the final intervention-ID edit, the two edited session test files passed again (21 tests).
- Domain: 16 tests passed. From downstream `domain`: `$env:DOMAIN_TEST_BUILD_LABEL='codex-t516'; node scripts/test-domain.mjs src/actions/tests/cleared-layers src/io/tests/gateway-output-dispatcher-cleared-layers src/runtime/llm-evidence/way-out-handles/tests/cleared-control-handles`.
- Extension: 32 tests passed. From downstream `apps/extension`: `$env:EXTENSION_TEST_BUILD_LABEL='codex-t516'; node scripts/test-extension.mjs src/content/action-runtime/interference/tests/press-ways-out src/content/action-runtime/tests/challenge-evidence`.
- Domain typechecks: `pnpm.cmd exec tsc -p tsconfig.json --noEmit` and `pnpm.cmd exec tsc -p tsconfig.test.json`, from downstream `domain`, both exit 0. First attempt caught an optional handle in the new test; added an asserted handle before target construction.
- Extension typecheck: `node scripts/check-extension.mjs`, from downstream `apps/extension`, exit 0.
- Both audits: `node scripts/structure-audit.mjs` from each repository root, exit 0 after final source edits with existing advisory warnings (Core 341 warnings / 1159 baselined; downstream 193 warnings / 646 baselined).
- Core typecheck: `pnpm.cmd run check` from Core `packages/fluxiq`, exit 0 after final source edit. Both `git diff --check` commands also exit 0 (existing line-ending advisories only).

## Remaining limits

- No live browser or Lab validation: popup arrival timing, actual handler execution, durable saved-Flow replay and gate P1-P7 still need supervisor evidence.
- The real-domain regression and Core judged-settlement rows cross the previously mocked seams separately; they are not an AutomationStudioService browser end-to-end test.
- Training-mode `createAdaptations: false` still correctly disables learning. The previous model-free Lab control therefore proved neither handler learning nor popup recovery.
- t516 is behind current dev. Supervisor must integrate both repositories, rebuild public Core outputs and re-run narrow checks before merging/pushing.
