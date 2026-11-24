# t1012 report: Haiku is Core's built-in Anthropic default

## Outcome
Done.

## What changed and why
Core tree `fxwork/t1012/!FluxIQ`, package `fluxiq` (version 0.54.4 -> 0.54.5).
- `runtime/models/catalog/anthropic.ts`: `AUTOMATION_STUDIO_ANTHROPIC_BUILT_IN_DEFAULT_MODEL` is `claude-haiku-5-5` (was Sonnet), the single source of truth.
- `runtime/llm/role-routing/starting-model.ts`: the unnamed Claude start now returns that constant instead of a second `"claude-haiku-5-5"` literal (DeepSeek-only Flow still `deepseek-flash`).
- `runtime/llm/anthropic/panel-command.ts`: uses `AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL` directly (which already is the named default or the built-in), dropping its own Haiku literal and the NAMED branch.
- `runtime/models/catalog/default-model.ts`: stale "model ladder's cheapest rung" comment fixed.
- `docs/architecture/automation-studio.md` line 350: default named as Haiku.

Paths reading the default with no named model, and what ran before: `llm/anthropic/provider.ts:27` (Sonnet, any caller passing no model); `models/providers/anthropic/pricing.ts:17` default parameter (priced as Sonnet); `automationStudioLlmProviderDefaultModel("anthropic")`, used by `llm/session-key-provider.ts:94`, `models/secrets/caller-key-choice.ts:85`, `result-verification/check-authorization/provider.ts:29` and the web settings view (all Sonnet when no model was named: the session provider, key choice, result-check provider). Panel command and `automationStudioLlmStartingModelId` (build, repairs, judge, interpretation) already ran Haiku. All now agree with Haiku. A named `FLUXIQ_LLM_DEFAULT_MODEL` still wins everywhere.

Tests (cite brief t1012 and U1):
- `llm/anthropic/tests/provider.test.ts`: asserts Sonnet prices and thinking, so it now names Sonnet on purpose (helper pins `model`, plus `useFixtureModel`). No assertion weakened.
- `llm/anthropic/tests/fixtures.ts`: replies claim the fixture model, default Haiku, with `useFixtureModel` to pin another.
- New `llm/anthropic/tests/default-model.test.ts`: built-in, starting model, provider-level default, provider metadata and panel command are all Haiku; DeepSeek start unchanged.
- `llm/deepseek/tests/default-model-env.test.ts` names Sonnet through the env on purpose; unchanged and passing.

## Commands run and observed results
- `heavy-slot run ... node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/runtime/models src/runtime/llm/anthropic src/runtime/llm/role-routing src/runtime/llm/deepseek/tests/default-model-env.test.ts` -> 40 files, 255 tests passed (an earlier run showed 35 then 7 failures from Sonnet-pinned fixtures, fixed above).
- `pnpm --filter fluxiq check` -> completed, no type errors.
- `pnpm structure:check` -> passed (first run failed one barrel import in the new test, fixed).
- New test file re-run -> 2 passed.

## Not verified
No full suites; web app settings behaviour (`apps/web` shows the default model, now Haiku) not run. The Lab mirror (`packages/test-contracts/.../registry.ts`) is the downstream repo's and lane t1010's; not touched.

## Open questions or contradictions
`docs/fluxnodes/guides/choosing-models.md` examples name Sonnet explicitly, left as examples of choosing a stronger model. The extension tree was not modified.
