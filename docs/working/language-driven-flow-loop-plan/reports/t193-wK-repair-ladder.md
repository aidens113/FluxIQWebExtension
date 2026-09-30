# t193-wK: why the in-run repair never repaired bigbox's armed variant

This was read-only analysis. I edited no source, started no Lab run and made no commits.

Evidence is the 20 runs the brief lists under
`test-runs/instances/t193-slot-2/run-<id>/`. For each run I read:
- `snapshots/flow-lane.json`;
- `snapshots/decision-trace.json`, which carries the Core `llmGate`, `recoveryTrace` and `structuredDiagnosis` for every run;
- `snapshots/live-llm.json`;
- `events.ndjson`;
- `logs/core.log`, whose build-trace lines include the re-author loops.

Code was read at these trees:
- Core `fxwork/t193/!FluxIQ` at `f4feb028`, clean. The recovery files last changed in `c2864786` (09:59Z), which is t193's own round-2 commit. The lane report says that change was in the working tree from run 8 onward.
- Downstream `fxwork/t193/!FluxIQWebExtension` at `6ea4fbea`.

Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done, with limits listed under "Not verified". In none of the 20 runs did the repair produce a change that ran. Nothing was persisted in any run: `adaptationIds` and `changeProposalIds` are `[]` everywhere, and the decision trace holds only the build's own `flow_bootstrap` adaptation.

**The redesign is not what broke these Flows.** 19 of the 20 runs failed at a step the `redesigned-buy-box` variant does not touch, or gave a wrong answer. Only `munwdydi` failed at the moved control, "Add to cart". Even there, the same fingerprint had just succeeded one step earlier on the redesigned page (s9, scored-candidate, 0.643).

The repair ladder was therefore asked to repair mis-built Flows:
- the store chip recorded in its after-switch state;
- a size swatch clicked on a page that has no such swatch;
- a "+ Add" recorded as "Added";
- wrong products.

A runtime patch cannot fix these, and Core's own guards refused the only patches that were proposed. Correcting a mis-built step needs a different step, and only the build loop (re-author) can author one. The failed-step entry point never routes to re-author.

Three ladder defects of its own also stopped repairs:
1. The patch call offers the model all five patch kinds and is never told the allowed ones. This caused 4 invalid or unplanned patches.
2. A diagnosis that said "deterministic recovery possible, no patch needed" stops the ladder, although the deterministic rungs have already failed.
3. The recovery context is capped at 8,000 bytes although the call allows 48,000 input tokens. `failed_target` and `recovery_candidates` were dropped in every step failure, and `step_parameters` in two.

The brief's "applied patch that still failed" did not happen. `validationOk: true` on a `runtime_patch` intervention only means the model's output passed the output schema. In all 7 such runs the domain or Core then refused the target override at preflight (`executed: false`, `preflightOk: false`). No patch was ever executed.

`recovery.ladder_diagnosis_unanswered` is not a failed call. It is a bookkeeping record written for every ladder that selected its model rung (13 runs), and it is misleadingly marked `validation.ok: false` (see K7).

## Per-run table

Column key:
- **Fail**: failing node / failure.
- **Given**: the recovery-context sections included.
- **Dropped (budget)**: sections dropped for byte budget. `ft` is `failed_target`, `rc` is `recovery_candidates`, `sp` is `step_parameters`.
- **Diag**: the model's structured diagnosis as stillAchievable / deterministicRecoveryPossible / explorationNeeded / patchNeeded, with confidence.
- **Ladder**: the rungs and calls in order.
- **End**: the code that ended it.

Every step-failure diagnosis also carried the sanitized failure-evidence page packet, 5,067 to 5,495 bytes, `truncated: true`. The recovery-context omitted list always includes `recent_nodes`, `subflow` and `route_context` (byte budget).

| Run | Fail | Given | Dropped (budget) | Diag | Ladder | End |
| --- | --- | --- | --- | --- | --- | --- |
| munwdydi | s11 click "Add to cart" (`[data-testid=atc]`), `target_not_found`, 7 same-family, best -0.12. This is the redesigned control. | failure, transitions, graph | sp, ft, rc, state_diff | unknown/unknown/T/F (0.40) | ladder record, then diagnosis, then explore (6 calls, `repeat_without_progress`), then `runtime_patch` | `llm_output.unexpected_field` + `unsupported_runtime_patch`: the model invented a patch kind. `patch_failed`. |
| munwmt25 | none: 15/15 actions succeeded; oracle `finalState: failed` | - | - | result check unsure x2 | result check only | `unverified` (`core.result.refutation_unconfirmed`), so the repair was never entered |
| muny76m9 | s4 click "Added" (list 1/8, post-click label), `target_not_found`, "+ Add" refused at -0.22 | failure, transitions, graph, sp | ft, rc | no/no/T/F (0.72) | record, diagnosis, explore (5, completed), re-plan (`runtime_diagnosis/plan`) unchanged | `llm.runtime_patch_goal_unachievable` at rung exploration |
| munymcpf | s5 click chip "Pickup or delivery?Millbrook Crossing Supercenter", `target_ambiguous`: 4 matched, chip 0.36 and 3x "Set as my store" -0.12 | failure, transitions, graph, sp | ft, rc | yes/yes/F/T (0.72) | record, diagnosis, `runtime_patch` (valid): a target override | domain refused `target_unanchored`; not executed |
| munyt4jo | refuted `does_not_answer_request`: store not switched; "+ Add" chosen by list position | failure, graph, sp | - | yes/yes/T/T (0.72) | re-author build first (core.log 10:34:54-10:35:22, ~14 decisions, no adaptation), then the ladder: diagnosis, explore (6), `runtime_patch` | `unexpected_field` + `unsupported_runtime_patch`; `patch_failed` |
| munyzo8z | no failed attempt: s15-s17 looped until stopped, 3 steps never visited | graph, sp | - | none (unclassified) | diagnosis call billed ($0.0016) | `llm.runtime_patch_unavailable` at rung resolution (no failed trace attempt) |
| munzl2eh | s7 chip "…Millbrook…", `target_ambiguous` (as munymcpf) | failure, transitions, graph, sp | ft, rc | yes/yes/F/F (0.82) | record, diagnosis | `llm.runtime_patch_diagnosis_asked_for_none` at rung plan |
| munzpdlu | refuted: store chip still Carden Falls; wrong adds | failure, graph, sp | - | no/unknown/T/F (0.60) | re-author first (10:59:28-10:59:44, ended on `web.action.rejected.target_unobserved`), then the ladder: diagnosis, explore (6, `no_progress`), re-plan unchanged | `goal_unachievable` at exploration |
| munzutb0 | s4 click span "Millbrook Crossing Supercenter" in the chip, `target_not_found`, 0 same-family | failure, transitions, graph, sp | ft, rc | yes/yes/F/T (0.72) | record, diagnosis, `runtime_patch` (valid): override | domain refused `target_indistinguishable` |
| muo00owc | s5 chip "…Millbrook…", `target_ambiguous` | failure, transitions, graph, sp | ft, rc | yes/no/F/T (0.72) | record, diagnosis, `runtime_patch` | `llm.provider_malformed_response`; `patch_failed` |
| muo06beo | s14 chip "…Millbrook…", `target_ambiguous` | failure, transitions, graph, sp | ft, rc | no/no/F/F (0.82) | record, diagnosis, explore (4, completed), re-plan unchanged | `goal_unachievable` at exploration |
| muo0ks69 | s6 swatch div "12 Double Rolls$16.47", `target_not_found`, 6 same-family. s5 "Options" matched 1 of 46 candidates, so this was probably the wrong product. | failure, transitions, graph, sp | ft, rc | no/no/T/F (0.90) | record, diagnosis, explore (3, `no_progress`), re-plan unchanged | `goal_unachievable` at exploration |
| muo0wf2q | s5 span "Millbrook Crossing Supercenter", `target_not_found` | failure, transitions, graph, sp | ft, rc | yes/yes/F/T (0.72) | record, diagnosis, `runtime_patch`: override | `target_indistinguishable` |
| muo12lnk | s15 swatch "12 Double Rolls$16.47", `target_not_found` | failure, transitions, graph | **sp**, ft, rc | yes/yes/F/T (0.72) | record, diagnosis, `runtime_patch`: override | `target_unanchored` |
| muo18781 | s18 chip "…Millbrook…", `target_ambiguous`; s20 again after s19 | failure, transitions, graph, sp | ft, rc | yes/yes/F/T (0.72) | record, diagnosis, `runtime_patch`: override | `target_unanchored` |
| muo1dxrj | refuted: s4 clicked a Loftwell product; no ValueRidge search | failure, graph, sp | - | yes/yes/F/T (0.72) | re-author first (11:46:39-11:48:34, 14 completions refused `flow_draft.repeat_span_unknown` / `repeat_not_after_its_source` / `instructed_act_missing`), then the ladder: diagnosis, `runtime_patch` returned a target override | that kind is not allowed for `recovery_path_or_reroute`: `failure_not_target_repairable`, not planned |
| muo1la5v | refuted: store not switched; generic adds | failure, graph, sp | - | yes/yes/T/T (0.72) | re-author first (11:51:54-11:57:02, 61 iterations, 31 completions refused `bootstrap.instructed_act_missing`), then the ladder: diagnosis, explore (1 call) | `llm_budget.run_cost_limit`: the re-author spent the $0.25 purse |
| muo2690x | s5 span "Millbrook Crossing Supercenter", `target_not_found` | failure, transitions, graph, sp | ft, rc | yes/yes/F/T (0.82) | record, diagnosis, `runtime_patch`: override | `target_indistinguishable` |
| muo2b224 | none: 16/16 succeeded; oracle failed | - | - | - | the result check's request was refused before sending | `llm.provider_result_summary_invalid`, then `core.result.verdict_unavailable`; the repair was never entered (0 calls) |
| muo2gyob | s8 swatch "12 Double Rolls$16.47" right after s7 "250 Count$6.48", on the napkins page, with no navigation between | failure, transitions, graph, sp | ft, rc | no/no/F/F (0.90) | record, diagnosis, explore (8, completed), re-plan unchanged | `goal_unachievable` at exploration |

### What the model was given

The questions from the brief, answered from the context summaries:

- **The failing node and its failure record.** Yes in every run. The `failure` section carries node id, definition, category, code, and `expected`/`actual` with locators screened, so candidate names and scores survive.
- **Its parameters.** Yes when `step_parameters` survived. It did not survive in `munwdydi` or `muo12lnk`: those diagnoses were never told what the step was meant to click, beyond names in the failure text.
- **The page at failure.** A 5-5.5 KB truncated page packet. The model's exact output text is not in the bundle; only the structured fields above are.
- **The prior steps.** Only through `flow_graph`. `recent_nodes` was dropped in every run.
- **`failed_target` and `recovery_candidates`.** Dropped in all 12 target-level step failures.

## Causes, ranked by runs affected

### C1. The created Flow was broken before the redesign (19 of 20 runs)

Nothing in the ladder can make these pass.

| Pattern | Runs |
| --- | --- |
| Store chip or its store-name span recorded in its after-switch state ("…Millbrook Crossing Supercenter"). The Flow never presses "Set as my store", so on replay from a fresh visitor the chip reads Carden Falls, and the shadow-root selector `button` matches 4 controls. | munymcpf, munzl2eh, muo00owc, muo06beo, muo18781, munzutb0, muo0wf2q, muo2690x (8) |
| Size swatch clicked on a page that has no such swatch. In muo2gyob it follows the napkins swatch with no navigation between. | muo0ks69, muo12lnk, muo2gyob (3) |
| A post-click label recorded as the target ("Added") | muny76m9 (1) |
| Wrong answer: store not switched, wrong or positional products | munyt4jo, munzpdlu, muo1dxrj, muo1la5v (4) |
| Runaway loop | munyzo8z (1) |
| Goal not held but unjudged | munwmt25, muo2b224 (2) |

These are build-side defects already on record:
- t193's own H/H2: the chip recorded with the current store's name; the dry run replays on a site the build already changed. H2 was routed to t196.
- t174 D1: dry runs start from the build's page state while playback starts fresh.
- t174 P1(A): the model invents addresses and lands on the wrong product or size.
- t174 P1(B), and instructed acts: store pick and quantities are not claimed as steps.

wH (chip found by its stable name) was in by run 9. The chip still fails as `target_ambiguous`, because the recorded step is the chip, not a store pick.

Owners: t174 (build), t196 (dry run, H2), t193 (H follow-up). Proof: the 4-fact goal holds on a provider-free replay of the *baseline*, before the variant is armed. The Lab runs no baseline replay for this task, so the Lab cannot currently tell "broke on redesign" from "never worked". **Proposed:** replay the created Flow once, provider-free, before arming the variant, and fail the build there (`packages/test-runner/src/run-scenario*`, t193 Lab).

### C2. A failed step the patch ladder cannot fix is never re-authored (13 runs)

The 13 runs:
- `goal_unachievable` x4: muny76m9, muo06beo, muo0ks69, muo2gyob;
- `asked_for_none` x1: munzl2eh;
- domain-refused override x6: munymcpf, munzutb0, muo0wf2q, muo12lnk, muo18781, muo2690x;
- invalid patch x2: munwdydi, muo00owc.

Code path:
- `recovery/refuted-result/reauthor.ts:79-90` routes to re-author only when the verdict code is `core.result.does_not_answer_request`.
- `service/runtime-adaptation/refuted-result-port.ts:113-117` sends everything else to the patch ladder alone.
- The failed-step entry, `recovery/annotation/annotate.ts:111-661`, ends at `:579-601` with no fallback.

The refusals themselves are correct:
- `plan.ts:195-197`: the model says the recorded target is gone.
- The domain equivalence check (`domain/src/runtime/llm-evidence/target/equivalence.ts:80,89`) refuses to re-point a click to a control that is not the recorded one. That is its design (see its header).

**Proposed minimal fix (Core, t193 with t194's re-author):**
1. Wrap the failed-step annotate the same way the refuted port does.
2. Route to `automationStudioReauthorRefutedResult` (extend mode, with a brief built from the failure record, node id and recorded target) when the recovery ended with no adaptation and either:
   - the plan's skip code is `goal_unachievable` or `diagnosis_asked_for_none`; or
   - every patch attempt was refused (`targetOverrideRefusal`) or failed validation.
3. Keep the one-purse rule (wR).

Tests:
- A service test where a failed step plus a `stillAchievable: no` diagnosis calls `generate` with `mode: "extend"`, and the brief names the node.
- The same when the override is refused with `target_unanchored`.
- A patch that executes does not call `generate`.

### C3. The patch call is never told the allowed kinds (4 runs)

Runs: munwdydi and munyt4jo (invented kind), muo1dxrj (disallowed kind), muo00owc (unparseable reply).

Code path:
- `annotate.ts:534-566` builds the `runtime_patch` request without `plan.allowedPatchKinds`.
- `llm/deepseek/output-schema.ts:61` and `llm/harness/runtime-patch-schema.ts:116-128,153-172` offer all five kinds (`GENERIC_RUNTIME_PATCH_ITEM_SCHEMA`).
- DeepSeek runs in `response_format: json_object` (`llm/deepseek/request-body.ts:33`), which does not enforce the schema.
- So the model wrote a kind outside the list (`llm/harness/provider-result.ts:188-189`), or wrote `temporary_target_override` for `output_not_observed`, whose plan allows reroute, subflow call or action sequence only. That override is refused at `recovery/annotation/patches.ts:139-140`, and `:429` records it as `failure_not_target_repairable`.
- muo00owc's reply failed JSON or envelope parsing (`llm/deepseek/provider.ts:160-167` or `response-envelope.ts:149`). There were no retries (`maxRetries: 0`).

**Proposed:** put `allowedPatchKinds: plan.allowedPatchKinds` in the patch request's metadata (`annotate.ts:564`), and filter the `oneOf` in `automationStudioRuntimePatchOutputSchema` by it. Optionally make one corrective retry on `llm_output.*`, or on a malformed reply, within the purse.

Tests:
- `llm/deepseek/tests`: the schema for `[temporary_target_override, temporary_wait_retry]` has exactly two variants.
- An annotate test: the patch request carries the plan's kinds.

Owner: t193.

### C4. The model's "no" is final whenever the recorded target is gone (5 runs)

Runs: muny76m9, munzpdlu, muo06beo, muo0ks69, muo2gyob.

`llm/diagnosis-instructions.ts:12` says to answer `stillAchievable no` when "what it acted on is gone with nothing that does the same thing". Given a mis-recorded target, this is the honest answer. The checkable re-plan (`diagnosis-chain.ts:109-111`, `annotation/replan.ts`) ran in all 5 and never changed its decision. That is expected: the page confirms the recorded control is not there.

This is not a separate defect. Fixed by C2: the re-author is the only rung that can add the missing store pick.

### C5. The recovery context is capped at 8,000 bytes (12 runs lost `ft`/`rc`; 2 lost `sp`)

Code path:
- `recovery/context.ts:261` sets `AUTOMATION_STUDIO_RECOVERY_CONTEXT_MAX_BYTES = 8_000`.
- `annotate.ts:346-358` passes no `byteBudget`.
- The priority order at `context.ts:135-150` puts `flow_graph` and `step_parameters` ahead of `failed_target` and `recovery_candidates`.
- `recovery/context-budget/fit.ts:53` drops the tail first. In munwdydi and muo12lnk, phase 3 (`fit.ts:116`) then dropped `step_parameters` as well.

The run allowed `maxInputTokens: 48,000` (live-llm `declared`). The failure-evidence packet already scales with the allowance (`annotate.ts:265-268`); the context does not. t194's F4, the context budget, is in this tree (`c4c469de`). It trims before dropping, but the ceiling is still 8,000.

**Proposed:** pass `byteBudget: min(16_000, floor(maxInputTokens * 3 * share))` from annotate. The clamp at `context.ts:284` already caps it at 16,000.

Test: a `recovery/tests/context-fit` case with munwdydi's shape (an 11-node graph and a step failure) at 16,000 bytes keeps `step_parameters` and `failed_target`.

Owner: t194 (F4) or t193.

### C6. "Deterministic recovery possible, no patch needed" stops the ladder (1 run)

Run: munzl2eh.

At `recovery/plan.ts:198-200`, `!patchNeeded && !explorationNeeded` stops the ladder. The model had answered yes/yes/F/F. `resolution === "model_required"` (`:187`) already means the deterministic rungs have failed, so "a deterministic recovery exists" can only be carried out as a patch.

**Proposed:** in `decidePatchRequest`, when `stillAchievable !== "no"`, `deterministicRecoveryPossible === "yes"` and `allowed.length`, request the patch. Also add one sentence to the diagnosis instruction: the deterministic rungs have already run.

Test: in `recovery/tests/plan`, that diagnosis now gives `request: true` with steps `[request_patch]`.

Owner: t193.

### C7. Refuted-result re-author failed, then starved the ladder (4 runs)

Runs: munyt4jo, munzpdlu, muo1dxrj, muo1la5v.

core.log shows the extend-mode build running after each build finished. It ended with no adaptation:
- repeated `bootstrap.instructed_act_missing` (a1 `step_not_kept`, a2/a3 `no_such_step`);
- `flow_draft.repeat_span_unknown`;
- `target_unobserved`.

In muo1la5v it spent the repair purse, so the ladder's exploration hit `llm_budget.run_cost_limit` after 1 call. This is by design (wR, `refuted-result-port.ts:173-176`).

The Lab's `flow-lane.json` `harnessRecovery` shows no `resultReauthor` or `resultRepair` for these runs although the re-author ran. `packages/test-runner/src/flow-lane/harness-recovery.ts:149-153` reads them off the run detail; why they were absent is not verified.

Owners:
- t194 (re-author);
- t174 (instructed acts);
- t193 (the Lab capture gap).

### C8. The run was never judged, so the repair was never entered (2 runs)

- **munwmt25**: the judge answered unsure twice, so the result was `unverified`. Only a refutation enters the repair (`result-verification/run-outcome.ts:299`).
- **muo2b224**: the pre-send check refused the result summary (`llm/harness/request-evidence-check.ts:43,115-122`: credential-shaped content, a denied key in sample rows, or over `maxBytes`; which one is not recorded). The result was `verdict_unavailable`.

Owner: t194 (the judge). t194's round-2 work (read-account, `repair-rerun.ts`, `executor/recovery-budget.ts`) is **not** in this tree: `4c8753ed` is not an ancestor of HEAD.

### C9. A diagnosis is billed when there is no failed attempt (1 run)

Run: munyzo8z.

- `annotate.ts:167`: `failedAttempt` is undefined, but the `runtime_diagnosis` call is still made (`:360`).
- `plan.ts:108,230-253`: `unclassifiedPlan` returns `patchRequest: chain` (`:252`), which is `request: true`.
- `annotate.ts:404,517-523`: the plan then ends `llm.runtime_patch_unavailable` because `failedTraceAttempt` is missing.

**Proposed:** skip the call when there is no failed attempt, and give `unclassifiedPlan` its own refusal code, for example `llm.runtime_patch_no_failed_attempt`, at rung `diagnosis`.

Test: an annotate test in which a run with no failed attempt makes 0 provider calls and records that code.

The loop itself belongs to t195.

### K7. A misleading record, not a cause (13 runs)

`service/summaries/conversions.ts:293,311` writes the ladder's selection of its model rung as a `diagnosis` intervention with `validation.ok: false`. This is why every step-failure run appears to begin with a "failed diagnosis".

**Proposed:** mark it `ok: true` with an informational code, or give it its own kind.

Test: `service/summaries/tests`.

Owner: t193.

### Also seen, correct by design

The three `target_indistinguishable` runs are consistent with the model naming one of the three identical "Set as my store" buttons. `equivalence.ts:148-157` compares tag, role, name, text, inputType, controlType, form and frame. It does not compare `within` (card words, `elements.ts` field `within`), so card-scoped twins count as the same.

Widening this would only turn those refusals into `target_unanchored`: the failed step's recorded target was the chip's span, not a store button. So it is not proposed as a fix here. It belongs to C2 (re-author).

## Commands run and observed results

- `git log --oneline -15` in both t193 trees. Downstream HEAD is `6ea4fbea` (merge of dev); Core HEAD is `f4feb028`, branch `task/t193-live-self-repair`, clean.
- `git merge-base --is-ancestor 4c8753ed HEAD` in the Core tree printed "t194 WIP NOT in t193". The same check for `c4c469de` (F4) printed that it is in.
- Node scripts in my scratchpad (`wk-sum.js`, `wk-trace.js`) printed, for all 20 runs:
  - from `flow-lane.json`: the `failure`, `actions`, `harnessRecovery` and `contextSections` fields quoted in the table;
  - from `live-llm.json`: the `repair` and `exploration` fields;
  - from `decision-trace.json`: the `llmGate`, `structuredDiagnosis` and `recoveryTrace` fields.
- The failing nodes' `authoredNodes` parameters were printed for all 20 runs.
- Counts of core.log build-trace lines after each build finished:
  - munyt4jo: 66 lines;
  - munzpdlu: 58;
  - muo1dxrj: 171, including 14 refused completions;
  - muo1la5v: 464, including 31 refused completions.
- The re-author loops ended as shown in the table, and muo1la5v ended with `decide throw ... name=Error` at 11:57:05.

## Not verified

- The model's actual diagnosis and patch text is not in the bundle. Examples: which kind munwdydi invented, which handle each override named, and why muo00owc's reply was malformed.
- Whether 3 `target_indistinguishable` runs named a "Set as my store" button. This is inferred from the page and the rule.
- Why `resultReauthor` is missing from the Lab's capture.
- Why muo2b224's result summary was refused.
- What page munwdydi's s11 reached. URLs are withheld.
- None of the proposed fixes was implemented or tested.
- I did not read the full t174 or t195 reports, only grep hits.

## Open questions or contradictions found

1. The brief's "a runtime patch applied (validationOk) yet the run still failed" is contradicted by the evidence: no patch executed in any run.
2. The lane's pass definition, "repaired after the redesign", cannot be met while the created Flow does not replay on the baseline (C1). Should the Lab gate on a provider-free baseline replay before arming the variant?
3. C2 re-author of failed steps crosses into t194's re-author code, so the supervisor needs to decide who owns it.
