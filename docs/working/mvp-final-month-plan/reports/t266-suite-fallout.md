# t266-suite-fallout (worker report)

Tree: Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t266/!FluxIQ`, branch `task/t266-t262-suite-fallout`, base `3c47ed7d` (Core dev with t262 and t263). Paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`. Logs are in the session scratchpad (`t266-run1.log`, `t266-final-b1.log`, `t266-final-b2.log`, `t266-final-lab.log`, `t266-check.log`).

## Outcome

Done. Only test files changed. None of the 17 deterministic failures is a source regression. Each one asserted behaviour that a deliberate, documented later change had replaced. Two of those changes came from **t261** (`b52bf47d`, 2026-10-03 17:45, merged to dev before t262), not from t262. The sweep had blamed every failure on t262. `instruction-readiness` fails because of load, not because of a regression.

At base, the six deterministic files showed 17 failing tests and 40 passing. The sweep counted 18, against Core `1fbfa5ef` before t263.

## What changed and why, per test

| File (tests) | Cause | Contract the test asserts now |
| --- | --- | --- |
| `service/runtime-adaptation/tests/refuted-result-port.test.ts`, "the repair's one purse": 5 tests | **t262** `e8c89bbd`: a re-author is rebuilt automatically only after a named transient provider request failure (rate limit, network, timeout, 5xx) (`reauthor-build.ts` `automaticRequestRetry`, `flow-authoring.md` "automatic reauthor build retries once only after..."). The tests drove the retry with `flow_bootstrap.evidence_iteration_limit`, which is still `retryable` in public but is no longer rebuilt. | The scenarios are unchanged: one purse shared across re-author, retry and patch ladder; a retry gets only what is left; a part that is refused is recorded under `llm_budget.run_cost_limit`; the lower Flow limit caps the whole repair; the next part needs enough left for one more call at the average cost. The retry now follows a `flow_bootstrap.provider_rate_limited` failure (attempted/received, 429, with accounting) built by a new `rateLimited(costUsd, decisions?)` helper. The "average" case uses a rate limit that arrives after two decisions. `degraded.afterCode` now reads `provider_rate_limited`. |
| same file, "is never raised by a Flow set above the ceiling" (1 test) | **t261** `b52bf47d`: the user clarified that the $0.10 knob applies only to the Lab. The ordinary default is $0.25. A Flow's own explicit limit is the user's policy: it replaces the default and is bounded only by a test-scoped ceiling and the $10 server maximum (`llm/flow-execution-limits/run-cost-ceiling.ts`, and its test "honors explicit user or resolver limits up to the server maximum"). | Renamed to "is set by a Flow's own limit above the default, up to the server maximum". The re-author is handed `automationStudioLlmRunCostCeilingUsd(1)` (1 in ordinary scope) and `automationStudioLlmRunCostCeilingUsd(11)` (at most 10). The section's comment now states the t261 and t262 rules. |
| `tests/service-bootstrap/tests/accounting.test.ts` (6) | **t262** `e8c89bbd`: once a build's purse exists, a failed build carries root `totalProviderCallCount` from that purse (`generation-catch.ts`, `with-total-provider-calls.ts`). | `totalProviderCallCount: 0` on the four raw harness escapes, on the structured harness failure and on the invalid-output case. The harness is stubbed (`runFlowBootstrapLlmHarness` replaced), so no request was admitted through the purse and zero is the true count. A comment separates zero from absence, which means unknown. |
| `tests/service-bootstrap/tests/generation.test.ts` (1) | **t262**, same contract. | `totalProviderCallCount: 1`: the single decision that named an unknown tool. |
| `tests/service-bootstrap/tests/judged-build.test.ts`, the reserve build (2) | **t261**, not t262: the scenario ("first decision costs $0.07, so its second does not fit beside the judging kept back") assumed a $0.10 build total. Since t261 the ordinary total is $0.25, so a second decision was asked for and the script threw, which surfaced as `provider_transport_unknown`. I proved this by running the unchanged file with `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test` (a $0.10 ceiling): it passed. | The reserve build's resolver now sets `maxTotalEstimatedCostUsd: 0.1`, so the build's total is $0.10 explicitly (the resolver's own total lowers the ceiling, `loop-limits/flow-bootstrap-evidence-loop.ts`). The scenario and its assertions are unchanged. |
| `tests/recovery-default-limits.test.ts` (1) | **t261**: "the per-call ceiling is the purse itself" held only when the purse ($0.10) was smaller than one whole-window call's worst case. At $0.25, the per-call cap is the window's worst case instead (0.1536 at the time of the run). That figure depends on the hour (peak or off-peak pricing). Also proved with the Lab scope: it passed unchanged. | The per-call cap equals `floor(min(run purse, whole-window worst case at the same instant))`. The budget gets a fixed `now`, so both sides are priced at the same rate. The rest of the test, at least 8 exploration decisions beside the patch reserve, passes at $0.25. |
| `llm/evidence-loop/tests/repeat-guard.test.ts`, t227 list read (1) | **t262** `115f67e9`: new `changes_nothing` wording in `llm/draft-amendment-feedback.ts`. "Identical request was not sent again... only if it actually returned the intended rows..." replaced "running it again changes nothing". | Asserts the two new phrases. |
| `tests/service-flows/tests/instruction-readiness.test.ts` (timeout) | **Load, not a regression.** Alone it passed in 3.3, 6.8, 4.2 and 7.3 s. Beside the other six files it took 4.5, 15.0 (14,985 ms against the 15 s default), 13.9 and 6.4 s. It makes 102 sequential SQLite saves. t262 changed nothing on that path; the test was last touched 2026-09-30. | Given an explicit `SEEDED_CASE_TIMEOUT_MS = 60_000` with a comment explaining why. This follows `SEEDING_TIMEOUT_MS = 60_000` in the sibling service-bootstrap tests. Its assertions are unchanged. |

No source file was edited.

## Commands run and observed results

All commands ran in `packages/fluxiq` of the t266 Core tree.

- Baseline, the six deterministic files: `npx vitest run <6 files>` exited 1. Output: `Test Files 6 failed (6)`, `Tests 17 failed | 40 passed (57)`.
- Hypothesis check before any edit to these two files: `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test npx vitest run judged-build.test.ts recovery-default-limits.test.ts` printed `Tests 9 passed (9)`.
- Per-file reruns after each edit: refuted-result-port 21 passed, accounting 13 passed, generation, judged-build and recovery 17 passed, repeat-guard 6 passed.
- `instruction-readiness` alone, four runs: passed at 3339, 6829, 4194 and 7286 ms.
- All seven together, in the final state, twice in a row: `npx vitest run <7 files>` exited 0 both times. Both runs printed `Test Files 7 passed (7)`, `Tests 58 passed (58)`; instruction-readiness took 13,944 ms and then 6,383 ms. An earlier pair of runs before the timeout edit also passed, at 4,492 ms and 14,985 ms.
- All seven under the Lab scope: `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test npx vitest run <7 files>` exited 0 with `Tests 58 passed (58)`.
- `node scripts/build-cache/cli.mjs fluxiq:check`, from the Core root, exited 0: `{"step":"fluxiq:check","reason":"no stamp; ...","ms":32568}`.
- `git diff --check` exited 0. `git diff --stat`: 7 test files, +84/-35.

## Not verified

- I did not run the seven files against a pre-t262 or pre-t261 tree, because that needs a git worktree or checkout. Attribution comes from source, commit diffs, the files' last-change dates (all before `b52bf47d`), and the Lab-scope experiment. That experiment shows that judged-build and recovery-default-limits fail only because of the $0.25 default.
- I did not run the Core structure audit, the full fluxiq suite, or any downstream check. Only test files changed.
- I did not rebuild Core's dist (no source changed).

## Open questions or contradictions found

1. **Stale source comments that still describe the $0.10 default and the "never raised" rule.** Fixing them is t264's call or a docs pass; I edited no source:
   - `recovery/refuted-result/purse.ts` header ("lowered by the Flow's own setting and never raised by it", "$0.10 by default"). This file is owned by t264.
   - `service/runtime-adaptation/refuted-result-port.ts` header ("$0.10 by default", "lowered by the Flow's own setting").
   - `loop-limits/flow-bootstrap-evidence-loop.ts` doc on `automationStudioFlowBootstrapEvidenceLoopLimits` ("$0.10 by default ... never raised by them").
   - `llm/session-key-provider.ts` comment ("which a Flow's own setting may only lower").
2. **Possible conflict with a user rule.** The project memory "per-flow-cost-ceiling-ten-cents-configurable" says a Flow may spend at most $0.10. t261's working doc records a later clarification from the user: $0.10 applies to the Lab only, and the ordinary default is $0.25. The tests now follow t261. If the memory is the current rule, t261 is the regression, and the fix belongs in source, not in these tests.
3. **Stubbed-harness tests report zero calls alongside a received response.** In accounting.test.ts, "attributes invalid successful output" now asserts `totalProviderCallCount: 0` next to accounting that shows tokens received. That is true for the stub, which bypasses the purse. Covering the real path, where the harness is admitted through the purse, would need a test that does not stub `runFlowBootstrapLlmHarness`.
