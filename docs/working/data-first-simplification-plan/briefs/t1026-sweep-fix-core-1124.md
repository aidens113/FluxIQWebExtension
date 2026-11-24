# t1026 brief: the two Core failures of the 11-24 sweep

Lead: Claude Code. Task t1026. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t1026/!FluxIQ` (branch `task/t1026-sweep-fix-core-1124`), downstream `C:/Users/osrs_/FluxStuff/fxwork/t1026/!FluxIQWebExtension` (report only). Fix the cause; never weaken a test to pass (change a test only where it pins behaviour a named, intended commit changed, and cite that commit).

The full sweep of dev (Core e3498f9f3; log `C:/Users/osrs_/FluxStuff/fxwork/t1021/!FluxIQWebExtension/test-runs/sweep-1124/core-test.log`) failed:
1. `packages/fluxiq/src/tests/anthropic-session-panel.test.ts`, "Claude keys, Flow resolution and panel requests": "promise rejected AutomationStudioLlmProviderError ... instead of resolving", with a serialized `llm.provider_malformed_response`.
2. `apps/web/src/features/automation-studio/settings/tests/anthropic-settings.test.tsx`, "roundtrips explicit provider/model/key through saved settings and authoring readiness": expected `{ key: 'llmModel' ...}` to match `{ value: 'claude-haiku-5-5' ...}`.

Today's Core merges that may bear on them: t1012 (built-in Anthropic default is Haiku, `runtime/models/catalog/anthropic.ts`), t1014 (`answer-first/earlier-rounds/`, refusal runs on the loop ladder, unreadable replies as loop findings), t1016 (typed task-memory store failures in `task-model/resolve.ts`, `attempt/opening.ts`), t1018 (carried rounds drop denied keys). Use `git log` to find which change each failure began with: run each test at earlier dev commits if needed. Say whether the product or the test is wrong, with the evidence. A real product defect is fixed in the product.

Owned: what the causes need in Core `packages/fluxiq/src/**` and `apps/web/src/**`, with tests beside each. Must not touch: `runtime/llm/harness-options/draft-acts.ts`, `runtime/llm/evidence-progress/**`, `runtime/llm/draft-amendment-feedback/**`, `runtime/llm/decision-handlers/amendment.ts` (t1023), `answer-first/result/**` and `answer-first/result-feed/**` (t1024), `runtime/llm/unusable-decision*`, `runtime/models/failures/**` and the provider decision schema (t1025). If the cause is in one of those, stop and report it. Also out of bounds: the shared Core `fxwork/!FluxIQ`, `lab-slots/`, any Lab or paid run.

Acceptance (quote outputs): each failing test passes, and the tests in its directory pass, through `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dir>` from `packages/fluxiq` or the web package's own vitest; `pnpm --filter fluxiq check` and `pnpm --filter @fluxiq/web check` (or the web package's check script) exit 0; Core `node scripts/structure-audit.mjs` passes. Leave versions alone.

Report: `C:/Users/osrs_/FluxStuff/fxwork/t1026/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t1026-sweep-fix-core-1124.md`. No git (reading `git log`/`git show` is fine). No `node -e`. End with the return contract.
