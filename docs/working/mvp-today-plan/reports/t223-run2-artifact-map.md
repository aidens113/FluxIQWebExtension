# t223 — Sanitized post-run-2 artifact analysis map

## Outcome

This map routes every run-debug field to the smallest typed, redacted artifact property that can
answer it. It is derived only from the blank debug template, the completed run-1 debug, and runner
artifact schema/index producers. No run-2 bundle, `test-runs/` content, logs, screenshots, recorded
page data, browser/provider state, or source/shared document was changed or inspected.

## Mandatory privacy and integrity gate

Before reading any run-2 evidence:

1. Read `bundle.complete.json` and `artifact-index.json` only.
2. Verify the completion marker's `artifactIndexSha256` against the index bytes.
3. For each artifact opened below, verify that its index entry exists, its byte count and SHA-256
   match, and `redaction` is `applied` or `verified`.
4. Confirm `run.json.redactionState` is `verified` or `not_applicable`. If it is `failed` or
   `pending`, stop and report a redaction blocker without opening content artifacts.
5. Never open `events.ndjson`, logs, screenshots/video, HTML reports/contact sheets, provider
   sidecars, browser profiles, database files, prompts, responses, raw gateway payloads, or raw
   page snapshots for this debug. Their absence from the map is deliberate.
6. Never print hashes, credentials, credential-source values beyond the safe source name, selectors,
   URLs beyond an already-screened origin, recorded page text, raw model text, or command lines.

`EvidenceBundle.writeStructured` applies configured redaction and rejects configured sensitive text
before publication, while the index records the redaction state. That is necessary but not permission
to reproduce every carried value: the debug should still prefer counts, booleans, closed codes,
screened parameter shapes, and withheld markers.

## Minimal artifact read order

Open only as far as the run reached:

1. `bundle.complete.json`, `artifact-index.json`
2. `run.json`, `summary.json`, `evaluation.json`
3. `snapshots/live-llm.json`
4. `snapshots/flow-lane.json` when indexed
5. `snapshots/extraction-mismatches.json` only when extraction was judged and mismatched
6. `snapshots/repair-lane.json` only when indexed and Stage 6 was reached

If an artifact is not indexed, do not search elsewhere for an equivalent. Use `NO EVIDENCE:` and
name the missing artifact/property.

## Header mapping

| Debug field | Smallest source | Safe handling / absence |
| --- | --- | --- |
| Run id | `run.json.runId`; corroborate `summary.json.runId` and `evaluation.json.runId` | Record only if all present ids agree. Otherwise stop as bundle inconsistency. |
| Scenario / variant / task | `run.json.scenarioId`, `workflowId`, `variantId`; `snapshots/live-llm.json.task`; `snapshots/flow-lane.json.task` for the bounded created-Flow request | Closed ids/task names only. Do not copy instruction text here. |
| Command | Prewritten run-2 debug only | Never recover a command from process state, logs, or metadata. If not prewritten: `NO EVIDENCE: invocation was not recorded before the run.` |
| Date | `run.json.startedAt` and `finishedAt` | ISO timestamps only. |
| Provider / model | `snapshots/live-llm.json.provider`, `.model`, `.profileId` | Never copy credentials, credential values, or authorization identifiers. |
| Provider calls, tokens, cost | Build: `live-llm.build.providerCalls`, `.loopProviderCalls`, `.accounting.{inputTokens,outputTokens,totalTokens,estimatedCostUsd}`. Runtime/repair: `live-llm.observed.accounting`, `live-llm.repair.observed.accounting` when present. Verification: `live-llm.verification.{calls,totalEstimatedCostUsd,interventions[] token fields}`. | State buckets separately unless the schema proves they are disjoint; do not invent a combined total. Null means unreported, never zero. Note `unrecordedCalls` if present without inferring its stage. |
| Verdict as reported | `evaluation.json.verdict`, optional `.failureCategory`, `.facilityFailure`; corroborate `summary.json.verdict` | Keep facility failure separate from automation failure. Use closed codes only. |
| Stage reached | Presence/completion chain below | Name the highest completed stage, not the highest file present. |

### Stage-reached decision

- **1**: instruction/pre-run debug exists, but no readable build/exploration record.
- **2**: `live-llm.exploration` or `flow-lane.build.evidenceLoop` records exploration, but
  `flow-lane.build.outcome !== "proposed"` or proposal/review is absent.
- **3**: build proposed and `flow-lane.review`, `flowShape`, and `authoredNodes` exist, but no
  `runtimeRunId`/runtime completion.
- **4**: `flow-lane.runtimeRunId`, `status`, and `actions` establish playback completed or failed.
- **5**: `evaluation.extraction` is non-null and the oracle/result comparison ran; `[]` means it was
  measured and contained no extraction step, while `null` means unmeasured.
- **6**: `flow-lane.resultVerification`/`harnessRecovery` and, when repair was applied, indexed
  `repair-lane.json` establish judgement/repair processing. Do not call Stage 6 complete merely
  because a live-LLM snapshot exists.

## Stage 1 — instruction and expected chain

Every Stage-1 field comes only from the run-2 debug written before execution:

- verbatim instruction;
- expected node/action chain;
- plausible-looking wrong answer;
- oracle and hypotheses, when the authored debug includes them.

Never backfill or revise Stage 1 from run artifacts. A missing item is
`NO EVIDENCE: not recorded before run output was inspected.`

## Stage 2 — exploration

Primary source: `snapshots/flow-lane.json.build.evidenceLoop`.

| Debug column/field | Property | What may be written |
| --- | --- | --- |
| Turn number | `steps[].iteration`, else array position | Preserve order. Two rows may share one iteration. |
| What it was asked | None | `NO EVIDENCE: sanitized build steps do not retain the provider request or prompt.` Never open provider text. |
| What it decided | `steps[].toolId` and safe decision tool ids such as unusable/amend decisions | Paraphrase the closed tool/decision id only. |
| Action and parameters | `steps[].nodeId`, plus other bounded codes/flags/counts admitted on that row | Never infer parameters. `NO EVIDENCE: the build-step schema retains no selector, input value, or free-form parameters.` |
| Result | `steps[].resultCode`, `.resultReason`, `.effectApplied`, `.evidenceBytes`, `.usage` | Closed codes/counts only; do not expand a code into guessed page meaning. |
| Repeats/progress | ordered `steps[]` grouped by `iteration`, `toolId`, `resultCode`, `resultReason`; `evidenceLoop.decisionCount/toolCallCount` | State measured repetitions. The loop's rationale is unavailable unless a structured progress field exists; otherwise `NO EVIDENCE`. |
| Rejections/refusals | `steps[].resultCode/resultReason`; `build.failure.{code,stage,issueCodes}` | Say whether a later row changed course; do not claim feedback sufficiency from a code alone. |
| Context eviction/truncation | No current build-step member; `evidenceBytes` is only a size | `NO EVIDENCE: no structured per-turn context eviction/truncation position is published.` |

Fallback source `live-llm.exploration` supplies only aggregate `source`, status/outcome/end codes,
counts, deduplicated `toolIds/resultCodes`, and `toolDetail`. It cannot supply one row per turn. If
`build.evidenceLoop.steps` is null, write a counted aggregate and mark the per-turn table
`NO EVIDENCE`; never manufacture rows from aggregate counts.

## Stage 3 — proposed Flow

Primary source: `snapshots/flow-lane.json`.

- Node list: `authoredNodes[]` in array order, using only `nodeId`, `definitionId`, `outputId`,
  screened `parameters`, and `parametersWithheld`.
- Cross-check shape with `flowShape` and build/review status.
- A `null` parameter value beside a dotted `parametersWithheld` path means withheld, not authored
  null. State the path; never seek the value elsewhere.
- Screened parameters may contain only the producer-approved envelope. Do not print absolute URLs;
  reduce them to their already-screened origin or state `<screened origin>`. Never print selectors,
  handles, credentials, user/page text, or locator-like strings even if a future producer admits one.
- Divergences: compare the safe node/output/parameter structure with the prewritten Stage-1 chain,
  one node or missing step at a time.
- “Misread page / misread grammar / could not express it” requires direct support from a closed
  failure/issue code. If the artifacts only show a divergence, write
  `NO EVIDENCE: the bundle records the authored shape but not why the model chose it.`
- When `authoredNodes`, `flowShape`, or `review` is null, say no proposal survived; do not treat the
  empty shape as a zero-node authored Flow.

## Stage 4 — playback and defensive recovery

Primary source: `snapshots/flow-lane.json.actions[]`, plus run-level failure/recovery fields.

| Debug column/field | Property | Rule |
| --- | --- | --- |
| Node | `actions[].nodeId`, `.actionType`, `.attemptIndex` | Group attempts by node id; an absent id stays unnamed. |
| Executed | `.status`, `.startedAt` | Use Core's status word only. |
| Produced | `.extraction.{recordCount,pagesRead,truncated,fieldNames,missingFields,itemsSeen,emptyRecords,listPresence,listWait,conditions}` when present | Counts/closed names only. For other nodes, status is not proof of a meaningful output; use `NO EVIDENCE` if no structured output summary exists. |
| Duration | `.durationMs` | Null/absent is unreported, not zero. |
| Retries | repeated node id/attempts and `.retry` | Count attempts and state only structured retry fields. |
| Rung absorbed | `.retry` for the retrying attempt; corroborate run-level `recoveredFailures[]` | Do not assign a rung from timing alone. |
| Success while doing nothing | extraction count/list/condition summary, comparison status, or explicit failure/recovery record | A bare `succeeded` status is insufficient. Use `NO EVIDENCE` where no structured output exists. |
| Provider calls during playback | `live-llm.observed.accounting.calls` and verification call record, scoped to the runtime run | Keep build and runtime calls separate. Null is unmeasured. |

Run-level terminal cause comes from `flow-lane.failure`; absorbed faults come from
`recoveredFailures[]`; readiness and Core/host target-resolution records may explain recovery using
only closed statuses/counts. Never copy failure `expected`/`actual` prose if present in a future
shape; use category, code, stage, retryable flag, attempt/rung, and counts.

## Stage 5 — answer and dataset comparison

Use `evaluation.json.extraction[]` first:

- expected/returned counts: `expectedRecords`, `observedRecords`;
- whether values were compared: `recordsListed`, `countStated`, `comparedRecords`;
- positional and any-order result: `matchedRecords`, `matchedInAnyOrder`;
- fields: `expectedFields`, `presentFields`, `unexpectedFields`, `nonStringValues`;
- pagination/truncation: `expectedPages`, `pagesFollowed`, `truncated`, `unjudged`.

Interpretation rules:

- `extraction: null` = not measured; never report zero rows.
- `status: not_run` = expected extraction never ran.
- count-only means `recordsListed: false` and `comparedRecords: 0`; explicitly call it a gap.
- `matchedInAnyOrder > matchedRecords` means at least some records were correct but moved.
- Null pagination fields and `unjudged` members remain unmeasured.

Open `snapshots/extraction-mismatches.json` only for mismatching judged steps. Use
`steps[].{stepIndex,stepId,expectedRecords,observedRecords,comparedRecords,matchedRecords,matchedInAnyOrder,orderOnly,mismatchedRecords,detailedRecords,disclosure}` and
`records[].{position,kind,observedAtPosition,fields[].field,furtherFields,unexpectedFields}`.

Value rules:

- Never inspect datasets or raw records.
- `held: absent`, `null`, and `withheld` must remain distinct.
- For `held: withheld`, write `NO EVIDENCE: observed value withheld by <rule>; <characters> characters`
  and never seek it elsewhere.
- Even under `fixture-page`, do not copy observed page text into the debug. Record the field,
  position, mismatch kind, text length, and whether it was cut. Expected fixture-authored values may
  be named only when necessary and non-sensitive; prefer the same structural summary.
- `furtherFields`/undetailed records are explicit evidence limits. State the bounded remainder and
  do not search raw output to fill it.

## Stage 6 — judgement, repair, persistence, replay

Use three bounded sources:

1. `flow-lane.resultVerification` and
   `live-llm.verification.{source,status,basis,code,verdicts,recordedCalls,calls,interventions}` for
   whether judgement ran and its closed outcome/accounting.
2. `flow-lane.harnessRecovery` for repair entry and context:
   `attempted`, intervention kinds/validation codes, runtime-patch flags/issue codes/verdicts,
   `refusalCode/refusalRung/refusalCause`, `contextSections.included/omitted`,
   `resultRepair`, `resultReauthor`, and adaptation/change-proposal ids.
3. `repair-lane.json` for declared repair judgement, application, and deterministic reuse:
   `declaredRepair.{verdict,patchKind,proposals,mismatchedFields,refusalCodes}`;
   `application.{outcome,adaptations[] status/approval fields}`; `adaptationIds`;
   `replaysRequested`; and each replay's
   `{index,outcome,status,providerCalls,harnessActivations,modelCalled,goalPassed,flowSucceeded}`.

Rules:

- Closed judgement codes/verdicts can be reported; the judge's prose conclusion or fix directive is
  not published. Write `NO EVIDENCE: no sanitized judgement/directive text is retained` rather than
  reading prompts/responses.
- Context presence comes only from `contextSections.included/omitted`; do not infer presence from a
  successful repair. Omission reasons are `absent`, `byte_budget`, or `withheld`.
- `harnessRecovery.attempted: false` is measured no recovery; absent/null recovery is unmeasured.
- `repair-lane.json` absent means no repair-lane proof was published, not necessarily that Core made
  no internal proposal. Use the harness record to distinguish those cases.
- Deterministic replay requires `outcome: ran`, `providerCalls: 0`, `harnessActivations: 0`,
  `modelCalled: false`, `goalPassed: true`, and `flowSucceeded: true`. Missing/null counts prove
  nothing.
- Persistence can be stated from repair application/status and, when non-null,
  `evaluation.adaptationPersistence/adaptationValidation/adaptationReuse/adaptationCost`. Never infer
  persisted reuse from an adaptation id alone.

## Causes

Build cause rows only from measured structured facts:

- build failure code/stage/issue codes;
- terminal and recovered action failure category/code/stage plus attempt/rung;
- extraction mismatch kind/position/field/count class;
- verification/recovery refusal code/rung/cause;
- repair application or replay closed outcome.

The bundle does not map those facts to repository source files, fixes, or task ids. After artifact
analysis, a separately scoped source owner may trace a measured code to its implementation. Until
then use:

`NO EVIDENCE: the sanitized bundle identifies <code/field/node> but does not identify an owning
source file or corrective change.`

Do not turn a candidate contributor into a cause, and do not blame unentered stages.

## Instrumentation-gap handling

For every unanswered field, write exactly one `NO EVIDENCE:` line containing:

1. the question that cannot be answered;
2. the missing artifact/property that would have answered it;
3. the current producer boundary that omits it, when identifiable below.

Known boundaries from the schema/index implementation:

| Missing fact | Boundary to name |
| --- | --- |
| Exact provider request, response, or rationale per turn | `flow-lane/creation/build-proposal.ts` deliberately admits only bounded codes/counts/flags into `build.evidenceLoop.steps`. |
| Exploration parameters/selectors/page meanings | Same build-step publisher; unsafe free-form values are not admitted. |
| Per-turn context eviction/truncation location | No property in `CreatedFlowBuildStep` or `LiveLlmExplorationRecord`. |
| Unsummarized action output | `flow-lane/run-flow-lane.ts` publishes selected attempt metadata, not raw outputs. |
| Raw dataset values | `evaluation.ts` is counts/flags only; mismatch detail is bounded by `run-expectations/extraction/mismatches.ts`. |
| Judge directive prose | `live-llm` verification and harness-recovery contracts retain closed words/codes, not provider text. |
| Repair context contents | `RunHarnessRecovery.contextSections` retains section names, byte-budget/withheld reasons, never contents. |
| Source owner/fix/task id | No run-artifact contract carries repository ownership. |

If an artifact is present but a nullable field is null, report that precise null as unmeasured. If
the artifact is absent from the verified index, report the missing artifact. If redaction or
integrity fails, stop the analysis rather than downgrading unsafe evidence to `NO EVIDENCE` and
continuing.

## Files intentionally never needed

The complete debug can be produced without `events.ndjson`, `review/timeline.json`, HTML reports,
screenshots/contact sheets, logs, provider-failure sidecars, browser state, Core databases, or raw
datasets. If one of the mapped structured artifacts cannot answer a field, the correct result is an
instrumentation gap—not permission to broaden the read.
