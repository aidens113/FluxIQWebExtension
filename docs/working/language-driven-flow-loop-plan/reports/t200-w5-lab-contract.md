# t200-w5-lab-contract: the Lab's LLM contract moves to the model's context window

## Outcome

Done. The Lab contract's per-request ceiling is now the model's 1,000,000-token context window. The default profile and the live campaign's limits now follow from it. The exploration byte budget is gone, and so is the `evidence-packet-budget` invariant. All the named checks pass. The full test-runner suite still has 3 failures, and none of them is in a file this brief touched (see below).

## What changed and why

- `packages/test-contracts/src/llm.ts`: `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` goes from 64,000 to 1,000,000. Its comment says this is the model's context window and not a budget, and that Core holds it as `contextTokens` in `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS` (`runtime/llm/deepseek/models.ts`). `DEFAULT_LLM_LAB_BUDGET` is now `maxInputTokens = window - 8_000` (992,000), `maxOutputTokens = 8_000` and `maxTotalTokensPerRequest = window`. All three are derived from the constant rather than written out. `LLM_LAB_MAX_ESTIMATED_COST_USD` (0.25), `LLM_LAB_MAX_CALLS_PER_RUN` (64) and the default `maxCallsPerRun` (26) are unchanged.
- `packages/test-contracts/src/llm-validation.ts`: no edit was needed. Every token bound reads the constant, so the per-request cap is now 1M and the run-token cap is 1M x 64. The per-run default in the contract is still derived (absent means per-request x calls, so 26M by default). It stays consistent without an edit.
- `packages/test-contracts/tests/llm-contracts.test.mjs`: expects 1,000,000 and 992,000/8,000/1,000,000. The over-ceiling mutation is now 1,000,001, and a comment was updated.
- `packages/test-runner/src/web-flow-exploration.ts`: `DEFAULT_MAX_EVIDENCE_BYTES` (48,000, capped at 100,000) set the size of the exploration evidence handed to Core's `selectExplorationPages` / `proposeFlowBootstrap` model requests. `fitPageToEvidenceBudget` dropped a page's trailing elements, and a later page that did not fit was dropped entirely. I removed the bound: the constant, `limits.maxEvidenceBytes`, `evidenceBytes` and `fitPageToEvidenceBudget`. `truncated` is still set when Core's page selection left selectable pages unvisited. Test added in `src/tests/web-flow-exploration.test.ts`: a page of 150 elements, more than 100,000 bytes, reaches Core whole and is not marked truncated.
- `packages/test-runner/src/run-evaluation/evidence-budget-invariant.ts` and its test: deleted. The budget was the invariant's only subject. I also removed its barrel export (`run-evaluation/index.ts`) and its registration in `observed-run-evaluation.ts` (`withEvidenceBudget` and the import; `judged = stopped`), and updated the comments there. Test added to `run-evaluation/tests/observed-run-evaluation.test.ts`: a 5,000,000-byte packet adds no invariant, the verdict stays passed, and the sizes are still recorded. `FlowLaneEvidence.packets` is kept because other producers read it; only its comment changed.
- Comments that pointed at deleted names:
  - `run-evaluation/flow-lane-evidence-sizes.ts`
  - `run-expectations/recording-event-types.ts`
  - `flow-lane/persisted-flow-run.ts` (pointed at the deleted `llm-evidence/limits.ts`)
  - `bench/evaluate-run.ts` (the field description said an over-budget packet fails the run)
- `packages/test-runner/src/live-llm/live-llm-plan.ts`: comment on `CORE_MAX_TOKENS` only. The value was already derived from the contract.
- `scripts/lab/live-campaign/lab-run/command.mjs`: `REPAIR_LIMITS` and `CREATE_LIMITS` go from 48000/8000/56000 to 992000/8000/1000000. `--llm-max-run-tokens` goes from 600000 to 1000000 in both, because the plan refuses a run budget below one full request (`runTokenBudget`). Cost stays at 0.25 and calls stay at 26 (repair) and 48 (create). Comments updated.
- `scripts/lab/live-campaign/tests/tasks.mjs` and `command-line.test.mjs`: the same numbers.
- Test-runner tests that failed only because the default request is now 1M: the typed run budgets of 150k, 300k, 500k and 600k were below one request. They are now multiples of `PER_REQUEST`, and the probes are scaled from it so they keep proving what their titles claim.
  - `live-llm/tests/budget.test.ts`
  - `live-llm/tests/live-llm-plan.test.ts` (plus the comment that said "64k")
  - `live-llm/tests/live-llm-run.test.ts`
  - `tests/commands.test.ts`
  - `tests/demo-llm-adaptation.test.ts`: the `FIRST_LIVE_ADAPTATION_PROFILE` budget, which spreads the default, is now 992,000/8,000/1,000,000.

## Commands run and observed results

- `bash .../heavy.sh "t200 contracts test" pnpm --filter @fluxiq-web-extension/test-contracts test`: `# tests 155 / # pass 155 / # fail 0`.
- `bash .../heavy.sh "t200 contracts check" pnpm --filter @fluxiq-web-extension/test-contracts check`: exit 0, no tsc errors.
- `bash .../heavy.sh "t200 runner check" pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0. The build cache logged `not stamped, because inputs changed while it ran (core:packages/fluxiq/src)`.
- `heavy.sh ... pnpm --filter @fluxiq-web-extension/test-runner build`: exit 0. Then `node --test "dist/**/*.test.js"` in packages/test-runner: `# tests 1681 / # pass 1678 / # fail 3`. Re-running the 3 in isolation reproduced all of them. None is in a file I changed:
  - `runner-wiring.test.js:122`: a source-text match on `runner.ts` for `runRedactionScopes({ ... workspaceWrittenSince ... })`. I did not touch `runner.ts`.
  - `clone-cache.test.js:71`: `Timed out waiting for the scoped clone cache lock`.
  - `demo-workspace.test.js:38`: `resolves one reusable demo directory below the configured runs root`, expected true, got false.
- Before my test edits the same run had 9 failures. The 6 caused by the new default were fixed, and the 3 above remain.
- `node --test scripts/lab/live-campaign/tests/*.test.mjs`: `# tests 21 / # pass 21 / # fail 0`.
- `node scripts/structure-audit.mjs`: 1 violation, in `apps/extension/src/content/evidence/layer-kind.ts` (a barrel bypass that another worker is editing), plus "1 baseline entries can be lowered". Neither is mine to fix.

## Not verified

- No Lab or live run, as the brief says. Whether Core accepts a 992,000-token input limit depends on Core's parallel change landing. Until it does, a live run would be refused by Core's own 64,000 check.
- I did not confirm that the 3 unrelated failures fail on `dev` as well. I only confirmed that they reproduce in isolation and are outside my files.

## Open questions or contradictions found

1. **The campaign's run-token budget needs a decision.** I raised it from 600000 to 1000000 because that is the smallest value the plan accepts once a request can be 1M. With whole-page requests a build may use more than 1M tokens across its calls. It would then fail as `performance.budget` after the money is spent, which is the 2026-09-23 pattern. The alternative is to drop `--llm-max-run-tokens` from the campaign so the default applies (per-request x calls, 48M) and cost ($0.25) is what bounds the run. That is the lead's call.
2. `web-flow-exploration.ts` still has other limits that hide page information on the way to the model. The brief named only the byte bound, so I left these:
   - `maxElementsPerPage` (default 80, max 150)
   - `MAX_TEXT_LENGTH` 300 (it truncates element names, text and titles)
   - selector 500, role 80
3. `docs/architecture/testing-facility.md:1554` still describes the `evidence-packet-budget` invariant. docs/ is outside my ownership.
4. apps/: no restatement of 64,000/48,000/56,000 tokens, no evidence byte bound and no removed domain import. The only numeric hit, `apps/scenario-lab/src/scenarios/company-website/data/services.ts:50` `48_000`, is a service price, not a limit.
5. Old token numbers left on purpose, as recorded-data fixtures (still valid under the new ceiling):
   - `scripts/lab/live-guards/tests/recorded-failures.mjs:16`: the bounds of a recorded failure.
   - `packages/test-runner/src/provider-failure/tests/provider-failure-log.test.ts:59,65`: a provider-failure record fixture with its own 48,000 limit.
   - `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts:28`: `MAX_EVIDENCE_BYTES = 7_340_032`, a sanity bound when parsing Core's adaptation loop record, not a bound on model input.
6. Item 5, `authored-nodes.ts`. `createdFlowAuthoredNodes` calls Core's `automationStudioScreenedNodeParameters(node.parameterValues, deniedKeys)`, where `deniedKeys` defaults to the domain's `WEB_LLM_DENIED_EVIDENCE_KEYS`. It copies `screened.values` into `AuthoredFlowNode.parameters` and `screened.withheld` into `parametersWithheld`. That is diagnostic output written to Lab run artifacts, not model input. If Core drops its caps and vocabulary whitelist, `parameters` carries more (longer or unlisted values), and `parametersWithheld` shrinks to the denied-keys hits. Two things may need re-checking then: `AuthoredFlowNode` validation in test-contracts (`authored-flow-node-validation.ts`) if it bounds sizes, and the Lab's redaction attestation over those artifacts.
