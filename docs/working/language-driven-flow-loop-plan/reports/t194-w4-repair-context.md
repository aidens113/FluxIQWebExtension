# t194-w4: the runtime repair diagnosis got only `failure`

## Outcome

Done. The cause is found and measured, and the fix is in Core `runtime/recovery/`. On a reconstruction of run-munnhi5q's Stage 6 at the default 8,000-byte budget, the diagnosis context now carries `failure`, `flow_graph` (with s11 and the edges on either side of it) and `step_parameters` (with s11's parameters), all inside the budget. Before the fix it carried `failure` alone, the same result as the live run. Nothing is committed.

## 1. Where the context is assembled and budgeted, and why everything after `failure` was dropped

Paths are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **Where it is built.** `recovery/annotation/annotate.ts:317` calls `buildAutomationStudioRuntimeRecoveryContext` (`recovery/context.ts:283`) with no `byteBudget`. So the default applies: `AUTOMATION_STUDIO_RECOVERY_CONTEXT_MAX_BYTES = 8_000` (`context.ts:261`, clamped to 1,500–16,000 at `:284`).
- **How it was trimmed.** The old trim was `trimRecoveryContextToBudget`, which sat just above `serializedByteCount` in `context.ts`. Its loop was: pop the last included section whole, re-measure the whole context (including the omitted list), repeat. Sections were dropped whole in reverse priority order (`AUTOMATION_STUDIO_RECOVERY_CONTEXT_SECTIONS`, `context.ts:135`). No section could be made smaller, only dropped.
- **Section sizes.** The live bundle kept no byte counts (`harnessRecovery.contextSections` records names and reasons only), and the Flow document is not in the bundle. So I rebuilt the run's shape as a test fixture (`recovery/tests/context-fit.test.ts`). It has an 11-node bootstrap Flow with the real id scheme `node.bootstrap.38f9de4a681ea8a6.main.sN`, the eight actions from the debug's Stage 3, a Subflow and a router. The refuted-result attempt is built through the real `automationStudioRefutedResultAttempt` and `automationStudioResultFailureRecord`. Measured with the budget lifted:

  | Section | Bytes |
  | --- | --- |
  | failure | 3,260 |
  | flow_graph | 5,056 |
  | step_parameters | 4,985 |
  | recent_nodes | 940 |
  | route_context | 155 |
  | subflow | 114 |
  | **Total** | **15,489** (budget 8,000) |

  With the old code at 8,000 bytes, the fixture reproduces the live result exactly: included `[failure]`, and `flow_graph`, `step_parameters`, `subflow`, `route_context` and `recent_nodes` all omitted for `byte_budget`.
- **Why everything after `failure` went.** No single section was oversized; the budget was too small for a real Flow once each section had to be kept whole or dropped whole.
  - `failure` + `flow_graph` alone is about 8.3 KB, plus about 0.85 KB for the omitted list. So after the loop dropped the tail and the step chain, it had to drop the graph too.
  - The graph is large because real ids are long and every action has a `failed` edge beside its `success` edge: 19 edges in about 3.4 KB. The budget comment's estimate of "24 nodes and 32 edges ≈ 2,000 bytes" was about 2.5 times too low.
  - The failure section says the judge's directive twice. `failure.expected` is built only from the directive's `expected`, fix lines and advice (`result-verification/core-observation.ts:118,124-131`), and the full directive also rides alongside as `failure.repair` (`recovery/context.ts:456`, fed from `recovery/refuted-result/attempt.ts:104`).

## 2. Why the patch was declined `control_gone`, and whether that was right

- **The decline was the model's choice.** `no_repair` must name one reason from a closed list, and every reason on it is about a control or a target (`llm/harness/structured-response.ts:35-41`; prompt at `llm/deepseek/system-prompt.ts:23`). Nothing on the list means "the fix is a change to the Flow's parameters, not a runtime patch".
- **No allowed patch could have fixed this.** The diagnosis classified the failure as `output_not_observed` / `recovery_path_or_reroute`. That class allows only `temporary_reroute`, `temporary_recovery_subflow_call` and `temporary_action_sequence` (`recovery/plan.ts:98`). None of them can change s11's `where` conditions or remove s10 and s11.
- **Verdict.** Declining was right. The label `control_gone` is wrong: it will be read as "the element disappeared". The patch model also could not have done better, because it was never shown the graph or any step's parameters.
- **Routing to the re-author is confirmed.** `service/runtime-adaptation/refuted-result-port.ts:64-65` decides the route. It is taken, so the re-author runs first (`:94`). That build failed as not retryable (`flow_bootstrap.evidence_unusable_decision`), so there was no second try (`:98`). It then fell back to the patch ladder (`:105`, `degradeToPatchLadder` `:116-128` → `deps.annotate` → the diagnosis at `annotate.ts:331`, the decline at `:541`, and `patchDeclined` at `:615`).
- **What the decline cost.** The diagnosis ran after the re-author had already failed, so it cost the re-author nothing. It cost 2 provider calls: 12,025 tokens, $0.0041 (`decision-trace.json` `recovery.llmGate.costAccounting`). The re-author cost 296,990 tokens, $0.0215. The fallback could not have produced a fix with the patch kinds available.

## 3. The fix

The fix is a new module, `recovery/context-budget/`, called from `context.ts:325` in place of the old whole-section loop.

- **Essential sections** (`essential-sections.ts`): `failure`, `expected_transition`, `actual_transition`, `flow_graph` and `step_parameters`. These are the first five entries of the priority list, so dropped sections are still always a tail of the list, as the contract requires.
- **The fitting loop** (`fit.ts`) runs in phases:
  1. **Tail.** Sections outside the essential set are dropped whole, lowest priority first, until the context fits. This is the old behaviour, unchanged.
  2. **Lossless trims.** Every essential section's lossless steps are applied first (`lossless-levels.ts`):
     - The failure record drops its restated `expected` and marks `expectedIsRepair: true`.
     - The step chain carries each node's authored parameters once, on the node's latest step; earlier steps get `parametersAtOrder`. A refuted result always repeats s11, because the synthetic attempt names s11.
  3. **Largest first.** Then the largest essential section is trimmed one step at a time.
  4. **Relaxation.** Once the context fits, trimmed sections are stepped back up in priority order for as long as they still fit, but never back past a lossless step.
  5. **Last resort.** Only then are essential sections dropped whole, lowest priority first.

  Trimmed sections are screened again for locator-shaped text. Each is marked `trimmedToFit: true` inside the section and `trimmedFromByteCount` on its `included` entry. The summary carries the same field (`context-summary.ts`).
- **What each section loses, in order.**
  - **Graph** (`graph-trim.ts`): prose cut to 240 characters; labels on nodes that did not fail; ids on edges that do not touch the failing node; router conditions (marked `conditionTrimmed`); then a narrower node window centred on the failing node (±4, then ±2). The narrowed window keeps edges that leave a shown node or enter the failing node, and keeps the true node and edge counts and the window's start position.
  - **Steps** (`steps-trim.ts`): prose cut to 240; label and output shape on steps that did not fail; parameters on steps of a different definition from the failing one; prose cut to 120; parameters on all other steps (marked `parametersTrimmed`); then identity only.
  - **Failure** (`section-trim.ts`): restated `expected` dropped, then prose cut to 480, then 240.
  - **Guarantees.** On every step, the failing node, its label, its incoming and outgoing edge ids, and its own parameters are kept. Prose trimming never shortens ids or codes (`prose-cap.ts`).
- **Result at 8,000 bytes on the run's shape:** 7,745 bytes in total.
  - `failure` 2,006 bytes (from 3,260). The judge's advice survives to 240 characters, including "rating at least 4.0, price under $50".
  - `flow_graph` 2,270 bytes (from 5,056). It shows s8 to s11 and end with every edge between them, and the failing node's edge ids.
  - `step_parameters` 2,383 bytes (from 4,985). s11 keeps its full screened parameters (`where` with 1 item, `maxPages` 10).
  - `subflow`, `route_context` and `recent_nodes` are dropped.
- **Other changes.** The budget comment in `context.ts` now states the measured sizes. The budget itself stays 8,000 bytes (see the open questions).

**Tests:**
- `recovery/tests/context-fit.test.ts` has 6 tests on the run's shape. Checked by temporarily emptying the essential set, which reduces `fit.ts` exactly to the old behaviour: 4 of the 6 fail. They cover the graph with s11, s11's parameters and the advice; restated-directive first; trim before drop; and a larger budget giving back s9. The 2 that still pass are "a context that fits is untouched" and "a tiny budget still ends inside it".
- `recovery/context-budget/tests/trims.test.ts` has 4 tests: ids are never cut; the failing node and its edges survive every graph step; the window narrows correctly with true counts; there are no steps past the end of a ladder.

## Commands run and observed results

All in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`.

- **Recovery tests, final tree.** `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/recovery` in `packages/fluxiq` → `Test Files 36 passed (36)`, `Tests 469 passed (469)`.
- **Before the fix.** The same test file on the unchanged code printed included `[failure]`, and `flow_graph`, `step_parameters`, `subflow`, `route_context` and `recent_nodes` omitted for `byte_budget` → 2 failed of the 4 tests the file had then.
- **Proof the tests depend on the fix.** Essential set temporarily emptied → `4 failed | 2 passed (6)`. File restored afterwards.
- **Type check.** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w4 tsc" npx tsc --noEmit -p tsconfig.json` → exit 2 with one error, in `src/programs/automation-studio/runtime/llm/harness-options/tests/inherited-plan-nodes.test.ts(43,143)` TS2375. That file is not mine: it is untracked, belongs to another lane in `harness-options/**`, and appeared during this task. No errors in any file I changed.
- **Structure audit.** `node scripts/structure-audit.mjs` → `structure-audit: passed (194 warning(s), 354 baselined)`. The warning count is unchanged. `context.ts` dropped from 723 to 717 lines and is still over the advisory 400-line threshold. The note "1 baseline entries can be lowered" was there before my change.
- **Consumers of the recovery context.**
  - `runtime/llm/tests/recovery-context-packet.test.ts` and `runtime/tests/refuted-result/tests/repair-context.test.ts` pass.
  - `runtime/tests/service-adaptation/tests/llm-diagnosis.test.ts` is flaky under load:
    - With the fix: one run had 2 timeouts at 15,000 ms, another had 1 timeout, and a third passed 8/8 (69.7 s, CPU at 70%, 8 node processes).
    - Without the fix: one run passed 8/8.
    - Instrumenting `fit` in the slow test showed 1 ms and 6 measurements for a 3,258-byte context, while the test itself took 11.9 s and then 28.6 s. The time goes elsewhere; I read this as machine contention, not my change.

## Not verified

- No live or Lab run (the brief forbids them). The effect on a real diagnosis or patch reply is not measured.
- Section sizes for run-munnhi5q come from a reconstruction, not the live bytes. The bundle keeps neither byte counts nor the Flow document. The exact node labels, edge set and router in the reconstruction are my estimates from the debug's Stage 3.
- The `llm-diagnosis.test.ts` timeouts are attributed to load. I did not get an unloaded, back-to-back comparison.
- The Core dist is not built.

## Open questions or contradictions found

- **Budget.** At 8,000 bytes, s9 (the filtered extraction, the natural comparison for s11) keeps only its identity and `parametersTrimmed`. At 10,000 bytes it keeps its full parameters (tested); at 9,000 bytes it does not, because the next step up is about 900 bytes against 834 bytes of slack. Raising `AUTOMATION_STUDIO_RECOVERY_CONTEXT_MAX_BYTES` (`context.ts:261`, a file I own) to 10,000 is a one-line change. I did not make it, because the patch request's explored-packet allowance lives in `llm/harness-options/**`, which is not mine, and the comment there says it yields by exactly this amount. The supervisor should decide with the owner of that lane.
- **The `no_repair` reason list has no word for "this needs a Flow edit, not a runtime patch".** A wrong-answer refutation will keep being recorded as `control_gone` or similar. The proposed fix is to add a sixth reason in `llm/harness/structured-response.ts:35` (with its schema in `runtime-patch-schema.ts` and the prompt at `deepseek/system-prompt.ts:23`). This is outside my ownership, so no diff was applied.
- **A refuted result has no patch kind that edits a node's parameters** (`recovery/plan.ts:98`). The fallback to the patch ladder therefore cannot repair a wrong filter, whatever it is shown. This belongs to the plan's owner.
- **The run bundle does not record the context's byte counts.** The `harnessRecovery.contextSections` exporter drops the `byteCount` the summary already carries, so this diagnosis needed a reconstruction. The owner is downstream Lab code, which I did not locate.
