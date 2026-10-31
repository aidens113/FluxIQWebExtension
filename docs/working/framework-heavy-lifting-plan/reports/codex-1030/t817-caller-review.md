# t817 caller regression review

Read-only review of caller tests in frozen `taskt817` Core/domain and the paired downstream checkout. No tests, builds, source edits, git operations, environment reads or model calls were performed.

## Findings

1. **Stale Core caller expectation — `packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/tests/project-build-shared-toggles.test.ts`.** Its trial/repair cases expect Core to inject the first trial press's signature as `ensureState` when the repair submission omits a choice, including the renumbered-step/insertion case. The new contract requires an explicit state selection grounded in the tied step's evidence and refuses a known toggle with no choice. These assertions should be updated to exercise explicit selection and no-choice refusal. The earlier test in this file that checks explored-toggle sharing across briefs remains a valid wiring assertion. Best bounded Core rerun: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/project-build/tests/project-build-shared-toggles.test.ts`.

2. **No stale Claude/DeepSeek caller assumption found in downstream CLI/topology tests.** Direct reading of `packages/test-runner/src/tests/cli-llm.test.ts` shows legacy DeepSeek cases now set `DEEPSEEK_MODEL` to the explicit supported `deepseek-v4-pro`, and a separate default-Claude dry run asserts Anthropic, `DEFAULT_LLM_MODEL`, fake Claude credential attribution, and zero provider calls. `coordinator-existing.test.ts` exercises explicit and default Claude launch contexts while isolating caller args/environment and provider secrets. This is based on current test source; the prior `t811-result.md` records the compiled four-file caller command passing 26/26, so no extra test-runner caller command is recommended.

## Bounded validation recommendations

- Core: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/project-build/tests/project-build-shared-toggles.test.ts`
- Downstream test-runner: none additional indicated by this read-only review; the exact CLI/auth/coordinator compiled command and 26/26 result are recorded in `docs/working/framework-heavy-lifting-plan/reports/codex-1030/t811-result.md`.

Outcome: Done
Changed: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/t817-caller-review.md`
Validation: not run (read-only discovery; checks prohibited by brief)
Not verified: whether the full lead acceptance set includes any other caller beyond the searched project-build and test-runner scope; no runtime behavior executed
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/t817-caller-review.md`
Notes: The only concrete stale caller found is the shared-project-build integration fixture's implicit `ensureState` expectation. CLI/model-default and actual topology-context fixtures appear current and have reported prior bounded green evidence.
