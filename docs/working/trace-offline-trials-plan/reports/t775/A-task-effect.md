# t775-A task effect

## Outcome
Done, with two deviations (below).

## What changed and why
Under packages/fluxiq/src/programs/automation-studio/runtime/:
- project-agents/contracts/task-effect.ts (new, barrel line added): AutomationStudioProjectTaskEffect.
- contracts/task-spec.ts: part.effect?, spec.unchanged?; readEffect/readUnchanged; refusal project.plan_effect_invalid; digest now covers unchanged (parts already carry effect). Absent fields leave old digests unchanged (digest drops undefined).
- supervisor/tools.ts: PLAN_INPUT gets part.effect and taskSpec.unchanged (generic library wording). plan-input.ts: unchanged included in the digested fields.
- service/project-build/task-checklist.ts: whole() and subflow() carry part effect and spec unchanged.
- result-verification/build-test/task-checklist.ts: checklist type gains part.effect, unchanged (type only; new type AutomationStudioBuildTestTaskEffect).
- Tests: contracts/tests/task-spec.test.ts, supervisor/tests/plan-input.test.ts, service/project-build/tests/project-build-task-checklist.test.ts.

## Commands run and observed results
- Failing-first: task-spec test 4 failed before implementation (round-trip, end_state refusal, valid cases).
- vitest-groups parallel on contracts/tests + supervisor/tests + service/project-build/tests + system-prompt.test.ts + issue-feedback.test.ts: 49/50 files then 1 failure (my test's missing scope; fixed); after fix project-build-task-checklist 11/11, contracts+plan-input 8 files 120 tests passed.
- pnpm check (packages/fluxiq): no type errors printed (exit 0).
- pnpm structure:check: first FAIL statement-packing in my test; fixed; rerun "structure-audit: passed".

## Not verified
Judge-side use of effect/unchanged (the judge summary builder, build-test/task-checklist.ts logic) is not done here. guidance.ts (supervisor prose) not updated (not owned). Full suites not run.

## Open questions or contradictions
1. The checklist type is in result-verification/build-test/task-checklist.ts, not contracts/build-test.ts; I edited only its type there (no logic). Whoever owns the judge text must merge around it.
2. Brief contradiction: "end_state needs modify_existing or create_new" vs the test "end_state with only create_new is refused". I followed the test: end_state requires modify_existing.
3. Effect text fields are trimmed on load; digests are over the trimmed values only if the writer sent them trimmed (a padded text would digest-mismatch).
