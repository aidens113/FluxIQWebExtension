# t343 — Run-4 bounded post-gate evidence checklist

Status: **Checklist ready; no run-4 artifact or live state inspected**

This checklist adapts the reviewed t313/t317 procedure to run 4 and binds it to t331's one-invocation stop rule. It must be used only after the supervisor has a safe run id and the live command has ended. This report opened no `test-runs` path and performed no Lab, browser, provider, test, build, inspection, or commit action.

## 1. Entry gates before semantic reading

1. Retain from the command wrapper only numeric exit code, safe run id, reported path, and closed CLI verdict. Never print or persist raw stdout/stderr or the parsed whole object.
2. Require run id `^[A-Za-z0-9._-]{1,128}$`. A malformed/no-id result consumes the single authorized invocation: retain the pending debug, record bounded startup/facility state, inspect nothing, and do not relaunch.
3. Require the destination debug `<run-id>.md` to be absent, then rename the pending debug before any semantic artifact read. Never overwrite an existing debug.
4. Require the normalized bundle path to be exactly `F:\!FluxIQWebExtension\test-runs\<run-id>` and CLI verdict to be exactly `passed` or `failed`.
5. Run the established in-memory `inspect <run-id>` gate with stderr discarded. Require exit 0, one parseable final JSON object, `valid:true`, matching run id, and the exact default path. Do not publish the object or artifact hashes.
6. Open only `artifact-index.json`. Require schema `0.1`, unique safe relative paths, exactly one `run.json`, and every indexed artifact's conservative redaction state to be `applied|verified`.
7. Before every later read, require exactly one matching indexed entry already verified by `inspect` and admitted by the redaction gate. Failure of integrity, identity, path, uniqueness, redaction, or verdict consistency stops all semantic reading and all later provider work.

Never open raw logs, `events.ndjson`, provider prompts/responses or sidecars, screenshots/video, HTML/contact sheets, page snapshots/datasets, selectors/handles, browser profiles/state, databases, cookies, network payloads, credentials, authorization material, or unsanitized errors.

## 2. Minimal safe read order and fields

Stop as soon as the highest reached stage and terminal classification are established. An absent artifact, absent property, and explicit `null` are distinct.

| Order | Safe file | Minimal paths/purpose |
| ---: | --- | --- |
| 1 | `run.json` | `runId`, `scenarioId`, `workflowId`, `variantId`, `startedAt`, `finishedAt`, `verdict`, manifest redaction state |
| 2 | `summary.json` | `runId`, `verdict` corroboration only |
| 3 | `evaluation.json` | `runId`, `verdict`, `failureCategory`, `facilityFailure`, `flowCreated`, `oracleVerdict`, `reportedVerdict`, `extraction`, `harnessRecovery`, `adaptationPersistence`, `adaptationValidation`, `adaptationReuse`, `adaptationCost`, `llm` |
| 4 | `snapshots/live-llm.json` | `build`, `observed`, `repair`, `verification`, `authorized`, `granted`, `declared`; typed accounting and closed verification fields only |
| 5 | `snapshots/flow-lane.json` | `build`, `review`, `flowShape`, `authoredNodes`, `runtimeRunId`, `status`, `failure`, `actions`, `recoveredFailures`, `resultVerification`, `harnessRecovery` |
| 6, conditional | `snapshots/extraction-mismatches.json` | Only when `evaluation.extraction[]` establishes mismatch; bounded counts/kinds/field names and disclosure flags, never record values |
| 7, conditional | `snapshots/repair-lane.json` | Only if indexed and Stage 6/recovery was reached; `declaredRepair`, ids, `application`, `replaysRequested`, `replays` |

Corroborate all present run ids. Manifest, summary, evaluation, and retained CLI verdict must agree. Keep the typed product failure and `facilityFailure` representations separate.

## 3. Highest-stage classification

- **Stage 1:** the prewritten run-id-bound debug exists; never reconstruct it from artifacts.
- **Stage 2:** `flow-lane.build.evidenceLoop` or `live-llm.exploration` records actual exploration. A failed build can end here.
- **Stage 3:** require `build.outcome === "proposed"` plus non-null `review`, `flowShape`, and `authoredNodes`.
- **Stage 4:** require `runtimeRunId`, runtime status, and actions establishing a terminal run attempt.
- **Stage 5:** require non-null `evaluation.extraction[]` with completed comparison rows; `null` or `status:"not_run"` is unmeasured.
- **Stage 6:** require structurally recorded `resultVerification` and/or `harnessRecovery`; file presence alone is insufficient.

Report the highest completed stage, not the highest file present.

## 4. Pass and failure decisions

### Complete pass threshold

Classify a complete pass only when the finalized bundle is integrity-valid and the bounded evidence establishes all applicable requirements:

- closed verdict `passed`, `flowCreated:true`, `oracleVerdict:passed`, and `reportedVerdict:passed`;
- result verification `confirmed`;
- exact 13-record ordered comparison at `extract-plus-under-fifty`, all required `name`, `price`, `rating`, and `url` fields present, no mismatch/order/pagination/truncation defect, and predicates represented by the typed oracle comparison rather than count alone;
- exactly one deterministic replay with `outcome:"ran"`, `providerCalls:0`, `harnessActivations:0`, `modelCalled:false`, `goalPassed:true`, and `flowSucceeded:true`;
- if repair occurred: routed repair, applied and persisted adaptation, selected-Subflow replay, and post-replay judgement;
- terminal grant revocation.

A raw runner pass, count-only equality, inferred fourth call, local tests, or a replay request without the successful replay record cannot satisfy the threshold. The bounded schema mapped by t317 does not publish terminal grant lifecycle/revocation; unless run 4 introduces an admitted typed property, record the revocation `NO EVIDENCE` below and do not independently claim the complete threshold from these artifacts alone.

A complete pass moves the consecutive-pass streak from **0 to 1**, never 2.

### Failed measurement

For any accepted failed bundle, preserve the closed verdict, highest stage, typed build/runtime/verification failure code/stage/issue codes, and the separate facility-classification object. Do not quote arbitrary failure prose. A failure leaves/resets the streak to **0** and must be fully classified before any later provider call.

An integrity/path/redaction/identity failure is an invalid evidence bundle, not a product pass or silently reclassified product failure. A malformed/no-id/facility-only outcome still consumes the one authorized invocation and never authorizes an automatic relaunch.

## 5. Exact repeated-Stage-2 stop trigger

The strict t331 stop applies only when **accepted run-4 evidence again ends at Stage 2** and publishes both:

- failure code `flow_bootstrap.evidence_unusable_decision`; and
- issue code `bootstrap.cannot_answer_instruction`.

When both identify the repeated Stage-2 exhaustion family:

- stop unchanged retries;
- **do not launch run 5**;
- leave the pass streak at **0**;
- permit no next provider call until a fix-before-retry investigation produces either privacy-safe stable draft/step identity or a deterministic scripted reproduction **and** a measured source change.

Do not infer this trigger from call count, budget exhaustion, free-form prose, or run-3 facts. Run 4 must independently publish the typed code pair after all acceptance gates pass. Regardless of trigger family, this authorization covers exactly one run-4 invocation; no failure class allows an automatic rerun.

## 6. Repair, replay, judgement, and revocation paths

- Judgement: `flow-lane.resultVerification`; `live-llm.verification.{source,status,basis,code,verdicts,recordedCalls,calls,totalEstimatedCostUsd,interventions}`.
- Repair/reauthor: `flow-lane.harnessRecovery.resultRepair.{attempted,nodeId,code}` and `.resultReauthor.{routed,refusal,adaptationId,applied,failureCode,failureStage,failureRetryable,providerInvocation,providerResponse,providerStatus}`.
- Persistence/application: conditional `repair-lane.application` plus `evaluation.{adaptationPersistence,adaptationValidation,adaptationReuse,adaptationCost}`. `applied:true` or an adaptation id alone is not external persistence/reuse proof.
- Replay: each conditional `repair-lane.replays[]` must satisfy every zero-provider/success property in the pass threshold; missing/null counters are unmeasured, not zero.
- Post-repair judgement: use ordered typed verification interventions/counters only. If calls are not phase-labelled, do not infer which was post-repair.
- Revocation: no mapped bounded field currently proves terminal revocation. Issued grant bounds, settlement, and zero-provider replay are not revocation evidence.

## 7. Accounting separation

Keep these representations separate and never add them unless the schema proves them disjoint:

1. **Build/main:** `live-llm.build.providerCalls`, `.loopProviderCalls`, `.accounting.{calls,inputTokens,outputTokens,totalTokens,estimatedCostUsd}`. Build accounting is not an extra total beside the build record.
2. **Runtime/main observed:** `live-llm.observed.accounting.{calls,inputTokens,outputTokens,totalTokens,estimatedCostUsd,unrecordedCalls}`.
3. **Repair observed:** `live-llm.repair.observed.accounting.{calls,inputTokens,outputTokens,totalTokens,estimatedCostUsd,unrecordedCalls}`.
4. **Verification:** `live-llm.verification.{recordedCalls,calls,totalEstimatedCostUsd}` and its intervention token/cost fields. Interventions decompose this representation and may overlap repair observed.
5. **Evaluation summary:** `evaluation.llm` is corroboration, not another bucket.
6. **Authorized/granted/declared ceilings:** ceilings are not spend. Report a breach only from a typed breach/settlement field.

Preserve every `unrecordedCalls` count without assigning it to a stage. If disjointness is not typed, publish no combined calls, tokens, or cost.

## 8. Required `NO EVIDENCE` rules

For every absent artifact/property or explicit null, name the missing source and do not widen the read set. Use these statements where applicable:

- `NO EVIDENCE: no oracle comparison or expected-versus-observed count, field, order, pagination, or mismatch result was measured; do not backfill the prewritten 13-record oracle as observed evidence.`
- `NO EVIDENCE: no sanitized judgement or repair-directive prose is retained.`
- `NO EVIDENCE: no automatic result-repair/result-reauthor route record is published.`
- `NO EVIDENCE: no adaptation proposal, approval, application, persistence, or reuse is published.`
- `NO EVIDENCE: no deterministic replay record is published; a requested replay is not proof it ran.`
- `NO EVIDENCE: verification calls are recorded but not safely phase-labelled; do not infer a fourth/post-repair call from count alone.`
- `NO EVIDENCE: the bounded run artifacts publish grant bounds and accounting but no terminal revoke/lifecycle property.`

Only include a statement when the corresponding run-4 property is actually absent/null. Do not import run-3 values or conclusions into run 4.

This report is t343's only write.
