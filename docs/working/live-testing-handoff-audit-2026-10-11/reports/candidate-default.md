# Candidate product default - t450

Status: Complete; focused checks passed. Supervisor review/integration owed.
Owner: candidate-default worker.

## Current State

Supervisor signed A creation/reuse gate and authorized configured product default switch. Core unset/empty/whitespace mode now resolves candidate; explicit legacy opt-out and explicit candidate remain; invalid spellings still refuse. Raw API omitted-mode compatibility remains legacy via the unchanged handler conditional. Only production edit is owning default constant plus explanatory comments; no handler/CLI/runtime code changed. Conversation/API regression tests now cover default candidate routing, explicit legacy fixtures, and omitted-mode compatibility.

## Owned files

Core source: `packages/fluxiq/src/programs/automation-studio/model/authoring-mode/authoring-mode.ts`.
Core tests: `model/authoring-mode/tests/authoring-mode.test.ts`; `api/handlers/tests/llm-generation.test.ts`; `runtime/conversations/commands/tests/build.test.ts`, `execute.test.ts`, `extension-chat.test.ts` (all relative to `packages/fluxiq/src/programs/automation-studio/`).

## Validation

Observed results:

- Fail-first: 8 expected failures / 39 passes in 3 files, exit 1, 34.28 seconds, before source edit.
- After owning constant change: 5 files / 96 tests passed, exit 0, 41.67 seconds. Actual registry extension-chat creation with blank configured mode executes candidate trial, gets two judge confirmations, applies tested proposal and reports ready; raw omitted-mode API still proposes legacy under unset/blank/candidate configuration.
- Actual affected Core package typecheck, separate task-specific build-info file (no cached-command bypass): exit 0.
- Core structure audit: exit 0, 330 advisory warnings / 1159 baselined; downstream audit: exit 0, 184 warnings / 646 baselined.
- `git diff --check`: clean. Exact source/test diff reviewed, 6 Core files, no outside source changes.

Commands (Core tree):

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/model/authoring-mode/tests/authoring-mode.test.ts src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/build.test.ts
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/model/authoring-mode/tests/authoring-mode.test.ts src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/build.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/execute.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts
pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/t450-candidate-default.tsbuildinfo
node scripts/structure-audit.mjs
```

Downstream: `node scripts/structure-audit.mjs` and own report only.

### Fail-first observed

Three focused files: 8 expected failures / 39 passes (47 tests), exit 1. Failures: default constant/resolver; configured API using absent setting; conversation candidate response routing for unset, empty, whitespace. Changed only owning product constant from legacy to candidate and aligned source comments with tested candidate promotion. Raw API handler and Lab remain unchanged.

## Compatibility and limits

Supervisor verification after integrating current dev: reviewed owning default and raw omitted-mode tests;
independently ran all 5 affected files, 96/96 passed, including actual registry chat with scripted model
and retained omitted-mode API compatibility. Actual Core package check executed and passed (40.958 s),
and direct Core audit passed (330 warnings, 1159 baselined). Supervisor updated authored Core/downstream
architecture and corrected the comment to distinguish deployments with a reset hook from those without one.
Final downstream audit and paired integration follow; no fresh live default-switch proof claimed yet.

Configured Core product callers now choose candidate unless FLUXIQ_AUTHORING_MODE=legacy opts out. Raw API payload omission stays legacy; raw authoringMode=legacy remains refused by its existing wire contract (product opt-out is the configured environment value). No actual browser/provider testing for this default switch; extension-chat test is real registry/service with scripted model/page edges. No full suites or distribution builds run. No source/env/runtime data/architecture shared-document changes outside listed ownership, commits, merges, pushes or launches. Supervisor owes authored architecture documentation and paired integration after C; Core build output has not been rebuilt by this worker.
