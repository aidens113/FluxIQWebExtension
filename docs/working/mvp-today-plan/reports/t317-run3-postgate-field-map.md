# t317 — Run-3 bounded post-gate evidence field map

## Scope and entry gate

This is a field map only. No run-3 artifact or `test-runs/` path was opened, and no live, provider, browser, Lab, build, or inspection command was run.

Use this map only after t313's full integrity, identity, path, unique-index-entry, and conservative redaction gates pass. Read the minimum structured artifacts in this order and stop when the run's reached stage is established:

1. `run.json`, `summary.json`, `evaluation.json`;
2. `snapshots/live-llm.json`;
3. indexed `snapshots/flow-lane.json`;
4. indexed `snapshots/extraction-mismatches.json` only for a judged mismatch;
5. indexed `snapshots/repair-lane.json` only when Stage 6 was reached and that snapshot exists.

An absent artifact, absent member, and explicit `null` are different. Record `NO EVIDENCE:` with the missing artifact/property; never widen the read set to raw logs, events, provider text, page data, screenshots, HTML, browser state, or databases.

## Minimal classification paths

Paths below are relative to the named artifact.

### Run identity, terminal verdict, and facility classification

| Fact | Minimal safe path(s) | Classification rule |
| --- | --- | --- |
| Run identity | `run.json.runId`; corroborate `summary.json.runId`, `evaluation.json.runId` | All present ids must agree. |
| Scenario/workflow/variant | `run.json.scenarioId`, `.workflowId`, `.variantId` | Closed identifiers only. |
| Timing | `run.json.startedAt`, `.finishedAt` | ISO timestamps only. |
| Product verdict | `evaluation.json.verdict`; corroborate `summary.json.verdict` and `run.json.verdict` | Preserve the closed word; disagreement is bundle inconsistency. |
| Failure class | `evaluation.json.failureCategory`, `.facilityFailure` | Keep product failure distinct from facility failure. Do not copy arbitrary error prose. |

### Highest stage reached

| Stage | Minimum positive evidence | Do not overclaim when |
| --- | --- | --- |
| 1 — instruction | Prewritten, run-id-bound debug exists | Never reconstruct Stage 1 from artifacts. |
| 2 — exploration | `snapshots/flow-lane.json.build.evidenceLoop` or `snapshots/live-llm.json.exploration` records work | A snapshot merely exists but records no exploration. |
| 3 — proposal/created Flow | `flow-lane.build.outcome === "proposed"` plus non-null `flow-lane.review`, `.flowShape`, and `.authoredNodes` | Proposal/review/shape is absent or null. |
| 4 — runtime playback | `flow-lane.runtimeRunId`, `.status`, and `.actions` establish a terminal run attempt | A Flow was authored but no runtime id/completion exists. |
| 5 — oracle comparison | `evaluation.json.extraction` is non-null and its row(s) record comparison status/counts | `extraction === null` is unmeasured; `status === "not_run"` is not a completed extraction. |
| 6 — judgement/repair | `flow-lane.resultVerification` and/or `.harnessRecovery` records judgement/recovery processing; use `repair-lane.json` only if indexed | The only evidence is a generic live snapshot or an absent/null recovery member. |

The stage number records the highest completed stage, not the highest file present. A failed Stage 6 can still be the highest reached stage when judgement/recovery is structurally recorded.

## Flow creation and runtime shape

Use `snapshots/flow-lane.json`:

- creation outcome: `build.outcome`, with closed failure support from `build.failure.code`, `.stage`, `.issueCodes`;
- exploration counts/order: `build.evidenceLoop.decisionCount`, `.toolCallCount`, and `steps[].{iteration,toolId,nodeId,resultCode,resultReason,effectApplied,evidenceBytes,usage}`;
- review and shape: `review`, `flowShape`, `authoredNodes[]`;
- authored node envelope: `authoredNodes[].{nodeId,definitionId,outputId,parameters,parametersWithheld}` only;
- runtime identity/outcome: `runtimeRunId`, `status`, `failure`, `actions[]`, `recoveredFailures[]`;
- action facts: `actions[].{nodeId,actionType,attemptIndex,status,startedAt,durationMs,retry,extraction}`.

Never publish selectors, handles, page text, raw parameters outside the screened envelope, or failure prose. A withheld parameter remains withheld.

## Oracle and answer verdict

Use `evaluation.json.extraction[]` first:

- oracle execution/status: `status`, `unjudged`;
- expected versus observed: `expectedRecords`, `observedRecords`;
- comparison strength: `recordsListed`, `countStated`, `comparedRecords`;
- correctness/order: `matchedRecords`, `matchedInAnyOrder`;
- field coverage: `expectedFields`, `presentFields`, `unexpectedFields`, `nonStringValues`;
- pagination/completeness: `expectedPages`, `pagesFollowed`, `truncated`.

Open `snapshots/extraction-mismatches.json` only when those rows establish a mismatch. Use only `steps[].{stepIndex,stepId,expectedRecords,observedRecords,comparedRecords,matchedRecords,matchedInAnyOrder,orderOnly,mismatchedRecords,detailedRecords,disclosure}` and bounded `records[].{position,kind,observedAtPosition,fields[].field,furtherFields,unexpectedFields}`. Do not copy observed or expected record values.

## Judgement, repair, apply, replay, and persistence

### Result judgement

- Core's closed result status: `snapshots/flow-lane.json.resultVerification`.
- Bounded verification record: `snapshots/live-llm.json.verification.{source,status,basis,code,verdicts,recordedCalls,calls,totalEstimatedCostUsd,interventions}`.
- Per-intervention accounting only: `verification.interventions[]` token/cost fields admitted by the schema.

These fields do not retain safe judge prose or a repair directive. Use `NO EVIDENCE: no sanitized judgement/directive text is retained` rather than reading provider content.

### Wrong-answer route and reauthor outcome

Use `snapshots/flow-lane.json.harnessRecovery`:

- recovery entry: `attempted`;
- result-failure marker: `resultRepair.{attempted,nodeId,code}`;
- route: `resultReauthor.routed`;
- route refusal: `resultReauthor.refusal`;
- proposed adaptation: `resultReauthor.adaptationId`;
- durable-apply flag: `resultReauthor.applied`;
- closed failure provenance: `resultReauthor.{failureCode,failureStage,failureRetryable,providerInvocation,providerResponse,providerStatus}`;
- other saved identities: `adaptationIds`, `changeProposalIds`;
- bounded repair context presence: `contextSections.included`, `.omitted`;
- general refusal: `refusalCode`, `refusalRung`, `refusalCause`.

Absent `resultRepair`/`resultReauthor` means Core published no route record; explicit `null` means the producer saw an unreadable shape. Do not convert either into `routed:false`.

### Application and persistence proof

When indexed, use `snapshots/repair-lane.json`:

- declared repair: `declaredRepair.{verdict,patchKind,proposals,mismatchedFields,refusalCodes}`;
- identities: `adaptationIds`, `changeProposalIds`;
- application: `application.outcome`, `application.adaptations[]` bounded status/approval/refusal fields;
- requested replay count: `replaysRequested`.

Corroborate application/persistence, when non-null, with `evaluation.json.adaptationPersistence`, `.adaptationValidation`, `.adaptationReuse`, and `.adaptationCost`. An adaptation id or `resultReauthor.applied:true` alone proves only what that record states; it does not by itself prove the Lab's external repair-lane persistence/reuse assertions.

### Deterministic replay

For each `repair-lane.json.replays[]`, require all of:

- `outcome === "ran"`;
- `providerCalls === 0`;
- `harnessActivations === 0`;
- `modelCalled === false`;
- `goalPassed === true`;
- `flowSucceeded === true`.

Also record `index` and closed `status`. Missing/null counters are unmeasured, not zero. `replaysRequested` without a corresponding successful replay is not proof of replay.

### Post-repair recursive judgement

Use the ordered `live-llm.verification.interventions[]`, `recordedCalls`, `calls`, and closed verdict/status fields. Report the number and order the schema actually establishes. If the record does not label an intervention as pre- versus post-repair, write `NO EVIDENCE: verification calls are recorded but not safely phase-labelled`; do not infer “fourth call” from count alone.

### Grant revocation

**No current mapped artifact publishes a terminal grant lifecycle/revocation state.** `live-llm.granted` describes issued bounds, and settlement/accounting describes usage; neither proves revocation. Zero-provider replay also does not prove revocation.

Required debug wording: `NO EVIDENCE: the bounded run artifacts publish grant bounds and accounting but no terminal revoke/lifecycle property.` Do not inspect Core storage, databases, logs, raw requests, or authorization identifiers to fill this gap.

## Accounting without overlap

Report these as separately labelled representations; never sum them unless the schema itself proves disjointness:

| Bucket/representation | Safe paths | Rule |
| --- | --- | --- |
| Build/main | `live-llm.build.providerCalls`, `.loopProviderCalls`, `.accounting.{calls,inputTokens,outputTokens,totalTokens,estimatedCostUsd}` | Treat the build record and its accounting as one representation, not two totals. |
| Runtime/main observed | `live-llm.observed.accounting.{calls,inputTokens,outputTokens,totalTokens,estimatedCostUsd,unrecordedCalls}` | Keep separate from build and label null as unreported. |
| Repair observed | `live-llm.repair.observed.accounting.{calls,inputTokens,outputTokens,totalTokens,estimatedCostUsd,unrecordedCalls}` | Do not add to verification unless disjointness is explicitly established. |
| Result verification | `live-llm.verification.{recordedCalls,calls,totalEstimatedCostUsd}` and `interventions[]` token/cost fields | Intervention detail is a decomposition of this representation, not an extra bucket. It may overlap repair observed. |
| Evaluation summary | `evaluation.json.llm` fields when present | Use as corroboration, not an additional total. |
| Authorized/granted ceilings | `live-llm.authorized.*`, `live-llm.granted.*`, `live-llm.declared.*` | Ceilings are not spend. Record breaches only from typed breach/settlement fields, never by comparing rounded prose. |

Always preserve `unrecordedCalls` as its own count. Do not assign an unrecorded call to build, repair, or verification without a typed link. If build/main and repair/verification representations cannot be proven disjoint, publish no combined token or cost total.

## Safe terminal classification checklist

The post-gate analyst can classify the measurement using only:

1. corroborated run id and closed verdict;
2. highest completed stage from the presence/completion chain above;
3. exact oracle counts/comparison strength;
4. closed verification status/verdict;
5. `resultRepair` and `resultReauthor` route/apply/failure members;
6. repair-lane application and replay proof when indexed;
7. separately labelled accounting representations and typed ceiling/breach fields;
8. explicit `NO EVIDENCE` for revocation, unlabelled verification phase, prose rationale, or any absent artifact/property.
