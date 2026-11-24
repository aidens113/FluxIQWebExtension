# t1026 report: the two Core failures of the 11-24 sweep

## Outcome
Done. Both failures were stale tests, not product defects. Both began with t1012 (commit ba00707aa, "Core's built-in Anthropic default is Haiku"). No product code changed.

## What changed and why
1. `packages/fluxiq/src/tests/anthropic-session-panel.test.ts`: the shared fixture (`runtime/llm/anthropic/tests/fixtures.ts`) was changed by t1012 to make streamed replies claim `claude-haiku-5-5` (`fixtureModel`), with `useFixtureModel()` for files that pin another model. This test names `claude-sonnet-5-5` in every call, so the reply's model no longer matched the request and the provider correctly raised `llm.provider_malformed_response` (`reply.case: envelope_shape`). Fix: call `useFixtureModel("claude-sonnet-5-5")` at the top of the file, as `provider.test.ts` already does. The product's envelope check is right to refuse a reply from a different model than asked.
2. `apps/web/src/features/automation-studio/settings/tests/anthropic-settings.test.tsx`: the test used `claude-haiku-5-5` as a Flow's explicit override. With t1012 Haiku is the Anthropic default, so a Flow naming it is correctly shown as "Framework default", not "Flow override". Fix: the test's explicit model is now `claude-sonnet-5-5` (a non-default). The assertion on source is unchanged, so it still proves an override is reported as one.

The product is right in both cases. t1014, t1016, t1018 are not involved.

## Commands run and observed results
- web: `npx vitest run src/features/automation-studio/settings` (apps/web) -> 13 files passed, 90 tests passed.
- fluxiq: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/tests/` -> parallel group: 6 files, 40 tests passed. real-sql group: 5 of 6 passed; `model-provider-disabled-run.test.ts` timed out at 30s (transform 219s, i.e. the machine was loaded by my concurrent tsc checks). Rerun alone: `--groups=real-sql src/tests/model-provider-disabled-run.test.ts` -> 1 passed (13s test time). An earlier parallel run also timed out two `vi.resetModules` import tests while `pnpm --filter @fluxiq/web check` ran concurrently; they passed on the idle rerun.
- `pnpm --filter fluxiq check` -> exit 0 (tsc, 218s).
- `pnpm --filter @fluxiq/web check` -> passed (build-cache stored the stamp; a rerun reported "reuse", exit 0).
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (571 warning(s), 903 baselined)", exit 0.

## Not verified
- The real-sql group was not seen green in one single clean run of the whole directory; the one timeout is load-induced (evidence above), and the file passes alone. Full sweeps were not run, per the repository rule.
- Web tests were run for the settings directory only.

## Open questions or contradictions found
None. Note for the lead: other tests that pin Sonnet but import the shared fixtures without `useFixtureModel` would fail the same way; the sweep found only this one.

## Addendum: load-sensitivity of anthropic-session-panel.test.ts

Cause (root): two tests ("honors the isolated Lab's five-dollar build ceiling..." and "leaves the ordinary default at 25 cents...") called `vi.resetModules()` and then dynamically re-imported all of `runtime/llm/index.ts`, re-evaluating the whole model-provider module graph, only because `flow-execution-limits/run-cost-ceiling.ts` reads `FLUXIQ_LLM_RUN_COST_CEILING_*` once at module load. The cost is transform/import time, which balloons under machine load (collect 280-600s in the sweep-like runs). The same pattern was in `src/tests/session-key-provider.test.ts` ("clamps a session-backed Flow to the isolated test budget...").

Fix (test seam in the owning modules, no timeout raised, no test skipped):
- `runtime/llm/flow-execution-limits/run-cost-ceiling.ts`: new `automationStudioLlmRunCostCeilingUsdIn(env, ...limits)`; `automationStudioLlmRunCostCeilingUsd` delegates with `env = undefined` (identical behaviour, still the load-time ceiling).
- `runtime/llm/session-key-provider.ts`: resolver option `env?`, passed to the ceiling function; omitted means the process's own, as before.
- The three tests now pass `env: {...}` to the resolver and no longer reset or re-import modules.

Durations (test time for the two tests): before, quiet 4725 ms and 2784 ms (lead's figures), 15000 ms timeouts under load. After, with two copies running concurrently, 5 runs each (`vitest-groups --groups=parallel src/tests/anthropic-session-panel.test.ts src/tests/session-key-provider.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false`): all 10 runs passed 24/24; total test time for both files 375-558 ms per run (collect/import time 80-110 s per run under the load, no longer inside any test's time budget).
- `pnpm --filter fluxiq check` -> exit 0 (142 s). `node scripts/structure-audit.mjs` -> "passed (571 warning(s), 903 baselined)".
Changed additionally: `packages/fluxiq/src/runtime/llm/flow-execution-limits/run-cost-ceiling.ts`, `packages/fluxiq/src/runtime/llm/session-key-provider.ts`, `packages/fluxiq/src/tests/session-key-provider.test.ts`.
Not verified: other tests in the repo using the `vi.resetModules()` + dynamic import pattern for env were not audited.
