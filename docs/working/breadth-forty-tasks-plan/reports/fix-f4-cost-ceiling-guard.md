# Fix F4: refuse a --llm-max-cost-usd above the resolved Core ceiling

## Outcome

Done. A live launch whose `--llm-max-cost-usd` is above the per-build ceiling
from `liveLlmBuildCostCeilingUsd` is now refused in `beginLiveLlmRun`. The
refusal happens before the provider credential is read and before any
topology, port allocation, Core start, browser, build or provider call.
Launches with an equal or lower value, and launches without the flag, behave
as before.

## What changed and why

- New `packages/test-runner/src/live-llm/max-cost-within-ceiling.ts` exports
  `assertLlmMaxCostWithinCeiling(args, ceilingUsd)`. It reads the flag straight
  from the run's arguments. It cannot use the parsed profile: when the flag is
  absent, `commands.ts` fills in `DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd`,
  which is Core's maximum ($10), so the profile cannot tell "not typed" from
  "typed high". An unparsable value is still left to the parser in
  `commands.ts`. The refusal is a `RunnerFailure("fixture.invalid")` with the
  usual "Live LLM execution refused:" prefix. It names the typed amount, the
  resolved ceiling, `FLUXIQ_LLM_RUN_COST_CEILING_USD=<amount>` (Lab
  environment or `.env`/`.env.local`) as the way to raise the ceiling, and
  notes that `--llm-cost-ceiling-usd` can only lower it. No amount is
  hard-coded.
- `packages/test-runner/src/live-llm/live-llm-run.ts`: `beginLiveLlmRun` now
  resolves the ceiling once, calls the guard with the same `sources.args`, and
  then plans. This is the only call site; `cli.ts` calls it before the topology
  starts. Before this change, `planLiveLlmExecution` silently took
  `Math.min(ceiling, typed)`, and `assertChatBuildable` then saw a plan equal to
  the ceiling and let it through. That is how the 2026-10-18 launches got past.
- `packages/test-runner/src/live-llm/index.ts`: added the barrel export.
- `docs/architecture/testing-facility.md`, "Live-run waste guards": added one
  paragraph that describes the refusal.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner build` printed "Core's build
  ... is current", reused `domain:build` and built `test-runner:build`.
- `node --test dist/live-llm/tests/max-cost-within-ceiling.test.js
  dist/live-llm/tests/cost-ceiling-reach.test.js
  dist/live-llm/tests/core-default-model.test.js
  dist/live-llm/tests/live-llm-run.test.js
  dist/live-llm/tests/live-llm-plan.test.js
  dist/live-llm/tests/cost-ceiling-env.test.js` (in packages/test-runner):
  `# tests 70`, `# pass 70`, `# fail 0`.
- Proof that the tests depend on the guard: I disabled the guard call in the
  emitted `dist/live-llm/live-llm-run.js` and reran the new file. Tests 3, 4
  and 5 (the launch-level refusals) failed and tests 1 and 2 (unit tests)
  passed. I then restored the file, and the grep confirmed the call was back.
- `pnpm --filter @fluxiq-web-extension/test-runner check` ran
  `test-runner:check` and printed no TypeScript errors. The cache noted that
  Core's `packages/fluxiq/src` changed while it ran (the other worker), so the
  result was not stamped.
- `node scripts/structure-audit.mjs`:
  `structure-audit: passed (212 warning(s), 638 baselined).`

## Tests (new file `live-llm/tests/max-cost-within-ceiling.test.ts`)

Every amount is derived from `AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD`.

- **Above the ceiling:** refused. The message names both amounts and `FLUXIQ_LLM_RUN_COST_CEILING_USD`.
- **Equal, below, or flag absent:** allowed.
- **Through `beginLiveLlmRun` in an empty checkout with no key:** the cost refusal comes before the credential refusal.
- **Ceiling set in the environment (2.5x the default):** equal, below and absent all pass the cost check and reach the credential step. A value above the raised ceiling is refused.
- **Ceiling lowered with `--llm-cost-ceiling-usd`:** a typed amount between the two is refused.

## Not verified

- I made no live or `--dry-run` Lab launch. `run-lab.mjs` still writes its
  ledger `start` (after the build phase) before the runner refuses. The finish
  then has `runId: null`, which `previousRun` ignores. It does count toward the
  `loop` rule's start count, the same as every other runner-side refusal.
- I did not run the whole test-runner suite (repository rule).

## Open questions or contradictions found

- The brief asked for the refusal "before any allocation". Inside the runner,
  that holds. In the Lab launcher, `scripts/lab/run-lab.mjs` admits the run,
  takes the Core build lease, runs the build phase and records the ledger start
  before it spawns the runner. Moving the check into `scripts/lab/live-guards/`
  would mean restating Core's ceiling resolver there, because `scripts/` cannot
  import workspace packages. That is outside this brief.
- `live-llm-run.ts` is outside the narrow "owner" wording. It got a three-line
  wiring change because `beginLiveLlmRun` is the one place where the run's
  arguments and the resolved ceiling meet before anything starts.
