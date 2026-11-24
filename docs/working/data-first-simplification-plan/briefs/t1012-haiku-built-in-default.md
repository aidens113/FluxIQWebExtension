# Core's built-in Anthropic default is Haiku (t1012)

Lead: Claude Code session, 2026-11-24. Tier: worker.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t1012/!FluxIQ` (Core task branch) and `t1012/!FluxIQWebExtension`.
Read: this brief; AGENTS.md downstream, "No model ladder: a task keeps the model it starts with" (Haiku for build and judge, user-approved 2026-11-20); Core `packages/fluxiq/src/runtime/models/catalog/{anthropic.ts,default-model.ts}`, `runtime/llm/anthropic/{provider.ts,panel-command.ts}`, `runtime/llm/role-routing/{starting-model.ts,resolution.ts}`.

Defect: `AUTOMATION_STUDIO_ANTHROPIC_BUILT_IN_DEFAULT_MODEL` is still `claude-sonnet-5-5` (`anthropic.ts:6`). It is what `AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL` falls back to when no `FLUXIQ_LLM_DEFAULT_MODEL` is named, and `provider.ts:27` uses it whenever a caller passes no model. Any Claude call that does not go through `automationStudioLlmStartingModelId` (t994) therefore runs on Sonnet. That contradicts the user's rule and costs several times more. The Lab mirrors this constant (`packages/test-contracts/src/llm-models/registry.ts`), and lane t1010 has just moved the Lab default to Haiku.

Goal: Haiku is Core's built-in Anthropic default everywhere a model is not named, with one source of truth.
1. Find every path that reads the built-in Anthropic default, or `AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL`, without a named model: the provider, the panel command, interpretation and start reading, conversation calls, the judge, recovery. Say which ran Sonnet before.
2. Set the built-in default to `claude-haiku-5-5`. Make the starting model and the built-in default agree from one constant rather than two literals, keeping DeepSeek's own default for a DeepSeek-only Flow (t994). Fix stale comments, such as "model ladder's cheapest rung" in `default-model.ts`.
3. Update tests that pinned Sonnet as the default, citing this brief and U1. Never weaken an assertion; a test that names Sonnet on purpose stays.
4. Bump `fluxiq` patch over dev's.

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- the touched and neighbouring test files through `scripts/vitest-groups.mjs` with their group, `--maxWorkers=1 --minWorkers=1 --fileParallelism=false` (include `runtime/models`, `runtime/llm/anthropic`, `runtime/llm/role-routing`, `runtime/llm/deepseek/tests/default-model-env.test.ts`);
- `pnpm --filter fluxiq check`;
- Core structure audit.
No full suites, no git mutations, no `node -e`, no provider or paid calls.

Owned: Core `packages/fluxiq/src/runtime/models/**`, `runtime/llm/anthropic/**`, `runtime/llm/role-routing/**`, their tests, `packages/fluxiq/package.json`, and your brief and report.
Must not touch: `runtime/llm/decision-handlers/**`, `loop-decision/**`, `result-verification/**` and `answer-first/completion/**` (lane t1011); `answer-first/attempt/**`, `answer-first/result/**` and the loop limits (lane t1008); other worktrees; the shared Core.
Report: `docs/working/data-first-simplification-plan/reports/t1012-haiku-built-in-default.md`. End with the return contract.
