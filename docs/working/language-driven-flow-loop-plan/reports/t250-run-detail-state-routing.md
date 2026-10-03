# t250: the run detail says what state routing consulted; stale $0.25 references

Worker: t250-worker. Branch `task/t250-run-detail-state-routing` in both trees. Nothing committed.

## Outcome

Done. Part A: the run detail now carries every state routing outcome, the Lab parses it, and each `steps/` row says "the runtime consulted state: <outcome>". Part B: every in-scope comment that called the run, build or recovery ceiling $0.25 is corrected. The repair default now follows `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`, and the framework reference has been regenerated.

## Step 1: what the executor carries and what the run detail dropped (established before any change)

- The executor attempt (`R/executor/contracts.ts`) carries `stateRouting?: AutomationStudioStateRoutingRecord` = `{ outcome: effect_holds|routed|no_match|unobserved|no_pre_states|guard_stopped; candidates; matched; toNodeId?; direction?; closeness?; reason? }`.
- Where it gets stamped (`graph-run.ts`, `state-routing/routed-attempt.ts`):
  - `routed` and `effect_holds`: the attempt becomes `succeeded` / `route: "state_routed"`, with `skipped: {reason:"state_routed", code, toNodeId, direction}` plus the record.
  - `guard_stopped` (decision `stopped`): the attempt stays failed and gets the record; the run ends failed.
  - `no_match`, `unobserved`, `no_pre_states` (decision `none`): the attempt stays failed and gets the record, and the ladder runs. When a readiness gate asked first and found no way on, the node is dispatched anyway, and the dispatched attempt carries the record (`graph-run.ts:432`), even if that dispatch then succeeds.
  - A declared skip (`target_absent`) gets no record.
- The run detail (`R/service/summaries/conversions.ts`) copied only `skipped`. It dropped the whole `stateRouting` record. As a result:
  - `effect_holds` could not be told apart from `routed`: both produced the same `skipped`.
  - `guard_stopped`, `no_match`, `unobserved` and `no_pre_states` left no trace at all. A failed step that consulted the page read exactly like one that never did.
- The record's `reason` is free text built partly from host reasons, so it is not content-free. The counts and closeness are not needed. Neither was carried over.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t250/!FluxIQ`):
- `packages/fluxiq/src/programs/automation-studio/model/flow-adaptation.ts`: `AutomationStudioFlowRunActionAttemptRecord.stateRouting?` is a closed union:
  - `{ outcome: "routed"|"effect_holds" }`. Destination, direction and code are already in `skipped` and are not repeated.
  - `{ outcome: "guard_stopped"; code?; toNodeId }`
  - `{ outcome: "no_match"|"unobserved"|"no_pre_states"; code? }`
- New `R/service/summaries/state-routing.ts` (`automationStudioRunDetailStateRouting`). It parses the stored record defensively and keeps only the outcome, a code and a node id. `code` is the Core code that asked:
  - `executor.ready_state.not_shown` when the attempt's readiness reading shows the gate judged at least one condition and did not hold. This mirrors exactly the `notShown` condition in `graph-run.ts`.
  - Otherwise the attempt's parsed failure code.
  - The code is dropped unless it is a dotted Core code of at most 120 characters. `toNodeId` must be a node id with no whitespace, at most 200 characters.
- Also in Core:
  - Exported from `summaries/index.ts`.
  - Wired into `conversions.ts` beside `skipped`.
  - New tests in `summaries/tests/state-routing.test.ts`.
  - One paragraph added to `docs/architecture/automation-studio.md`.
- Part B comments corrected to name `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`, $0.10 by default, FLUXIQ_LLM_RUN_COST_CEILING_USD to change it. Where a figure is a measured past fact, it now reads "then $0.25". Files:
  - `R/llm/harness/token-limits.ts`
  - `R/llm/run-budget.ts`
  - `R/recovery/annotation/run-budget.ts` (5 places)
  - `model/tokens-per-run/tokens-per-run-default-cleared-key.ts`
  - `R/service/flow-settings/tokens-per-run-default-migration.ts`
  - `R/flow-bootstrap/generation-failure/build-ending.ts`
  - `R/llm/build-purse/purse.ts`
  - `R/llm/harness/run.ts`
  - `R/llm/session-key-provider.ts`
  - `R/loop-limits/flow-bootstrap-evidence-loop.ts` (2)
  - `R/recovery/annotation/patch-reserve.ts`
  - `R/recovery/refuted-result/purse.ts` (3, including the rounding example, now "$0.10 less $0.07 is $0.03")
  - `R/result-check-authorization/contracts.ts` (3)
- Step 5: `AUTOMATION_STUDIO_RESULT_CHECK_AUTHORIZATION_DEFAULTS.repairMaxCostUsdPerRun` is now `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`, imported from `../llm/flow-execution-limits/index.ts`. No `llm` module imports `result-check-authorization`, so there is no import cycle. New test `result-check-authorization/tests/contracts.test.ts` pins the default to the constant.
  - No existing test pinned the default as 0.25. The tests that write `maxCostUsdPerRun: 0.25` set it as an explicit stored value, so I left them unchanged.
- **Behaviour change from step 5.** An unattended repair switched on with no number now reads back a ceiling of the run cost ceiling ($0.10 by default, or whatever FLUXIQ_LLM_RUN_COST_CEILING_USD says, up to $10) instead of $0.25.
  - Actual spend per repair does not change at the default, because the run budget already clamped it to the ceiling with `automationStudioLlmRunCostCeilingUsd`.
  - What does change: `repair.ts:103` refuses as `exhausted` only when less than $0.10 (not $0.25) of the authorization's total is left. So a few more repairs run near the end of a total.
  - The clause the settings read returns (`result-check-settings.ts`) shows the lower figure.
  - With the Lab ceiling set above $0.25, the default now rises with it.
- Step 6: `pnpm docs:reference` regenerated both `framework-reference.md` copies, mostly line-number shifts plus the corrected defaults text. They contain no stale ceiling claim; the remaining 0.25 hits are the name-match score floor and the "then $0.25" history.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t250/!FluxIQWebExtension`):
- New `packages/test-runner/src/flow-lane/state-routing-attempt.ts` (`stateRoutingAttemptOf`). It checks exact key sets per outcome, applies the dotted-code check, and uses `attemptNodeId` for `toNodeId`, carrying the attempt's epoch-ms span. It is exported from the barrel.
- `flow-lane/persisted-flow-run.ts`: `PersistedFlowAction.stateRouting?` is parsed in `flowAction`.
  - To stay under the 800-line limit I moved `comparisonStatusOf` into a new `flow-lane/comparison-status.ts`. It is a self-contained field parser, and its doc comment had been orphaned above `clearedByPerson`; the move fixes that too.
  - The file is now 795 lines.
- `lab-runs/write-playback-steps.ts`: new optional input `stateRoutingSteps`.
  - Each consultation joins the skip of the same attempt (same node and span). Otherwise it joins the first unclaimed host attempt in its span, matched by failure code unless the readiness gate asked. Otherwise it becomes its own `NNNN-run-state-consulted` folder; that last case is a guard stop on a gate, which dispatched nothing.
  - The row gets `stateRouting` in `result.json` and `meta.json`, and its summary ends `; the runtime consulted state: <outcome>`, with ` (kept returning to <node>)` for `guard_stopped`.
  - A failed row stays failed.
- `run-scenario.ts` collects `playbackRoutings` from `evidence.run.actions` beside `playbackSkips` and passes them to the writer. `lab-runs/index.ts` exports the type.
- Tests:
  - `flow-lane/tests/state-routing-attempt.test.ts` (new, 3 tests)
  - 2 tests appended to `lab-runs/tests/write-playback-steps.test.ts`
  - 1 wiring test appended to `run-scenario/tests/playback-skips-wiring.test.ts`
- `docs/architecture/testing-facility.md`: one paragraph after the skip paragraph.

## Commands run and observed results

- Core summaries tests: `heavy.sh ... npx vitest run src/.../runtime/service/summaries/tests`: 7 files, 61 tests passed.
- Core tests next to every changed file: `heavy.sh ... npx vitest run` over the `tests/` folders of result-check-authorization, service/flow-settings, service/summaries, llm/build-purse, recovery/annotation, recovery/refuted-result, llm/harness, llm, loop-limits, model/tokens-per-run, flow-bootstrap/generation-failure and llm/flow-execution-limits.
  - Result: 83 of 84 files passed, 1118 of 1119 tests.
  - The one failure was `run-detail-preservation.test.ts` "keeps a repaired run's recovery annotation...", which timed out at 15000 ms under the parallel load. It took 2.7 s earlier.
  - Rerun alone: 3 of 3 passed.
- `heavy.sh ... pnpm --filter fluxiq check`: tsc completed with no errors (build-cache "build", 39 s).
- Core `node scripts/structure-audit.mjs`: "structure-audit: passed (219 warning(s), 349 baselined)."
- `heavy.sh ... pnpm docs:reference`: "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (2985 public declarations)." Then `node scripts/docs-reference.mjs --check`: "Deterministic framework reference is current."
- Core libraries: `heavy.sh ... pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`: all three Done (fluxiq rebuilt, the other two reused).
- `heavy.sh ... pnpm --filter @fluxiq-web-extension/test-runner build`: built. `check`: passed.
- `node --test "dist/flow-lane/tests/*.test.js" "dist/lab-runs/tests/*.test.js" "dist/run-scenario/tests/*.test.js"`: 287 tests, 287 passed, 0 failed. The new tests appear as ok 207-209, 249-250 and 274.
- Downstream `node scripts/structure-audit.mjs`: "3 violation(s) across 1 rule(s)", all `[working-docs]` and pre-existing in files this task does not own:
  - `docs/working/language-driven-flow-loop-plan.md`: Current State is 175 lines, and the file is 814 lines.
  - `docs/working/README.md` is out of date.
  - My own `persisted-flow-run.ts` overrun (809 lines) was fixed as described above.

## Not verified

- No live Lab run: the brief asked for narrow checks only. Live executor runs are untested for:
  - that a real `no_match` failure lands on the matching host attempt in `steps/`;
  - that a gate-asked `guard_stopped` writes its own folder.
- No whole Core suite, root check, test or build, as the brief directed.
- apps/web and any UI reader of the run detail were not checked for showing `stateRouting`. Nothing in Core enumerates attempt fields apart from `conversions.ts`.
- The existing-Flow and clone targets do not write `steps/`, so they do not carry `stateRouting`. `ExistingRunAction` was not extended.

## Open questions or contradictions found

- These $0.25 comments are in paths the brief told me not to touch, so I listed them and left them alone:
  - `R/service/runtime-adaptation/refuted-result-port.ts:21,23`: "held to $0.25 on their own" and "$0.25, lowered by the Flow's own setting". The second is a current-ceiling claim.
  - `R/service/runtime-adaptation/repair-authority.ts:89`: "$0.25, never a widening of it". Current-ceiling claim.
  - `R/flow-bootstrap/unfinished-build/phases.ts:15`: a dated run's "$0.25 ceiling". Historical.
  - `R/flow-draft/act-claim.ts:10`: "$0.25 ran out". Historical.
  - `R/llm/evidence-loop/exhaustion.ts:107`: a dated run's "$0.25 cost cap". Historical.
  - Tests under `flow-bootstrap/unfinished-build/tests/phases.test.ts:92` and `llm/evidence-loop/tests/cost-purse.test.ts:7,61` mention $0.25 in comments.
- These numbers are not the run ceiling, so I left them; the supervisor should decide:
  - `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_ESTIMATED_COST_USD = 0.25` (`R/llm/harness/token-limits.ts:29`), the per-call default.
  - `FLOW_MAX_COST_USD = 0.25` (`R/llm/flow-execution-limits/resolution-within-flow-settings.ts:32`).
  - The `> 0.25` bound in `api/handlers/llm-execution-settings.ts:33`.
  - The fixture `model/fixtures/large-project.ts:214`.
- The existing Core test `conversions.test.ts:72` uses `executor.state_routing.effect_holds` as a `skipped.code`. The executor never writes that code: `skipped.code` is the failure code. It is harmless, but misleading.
