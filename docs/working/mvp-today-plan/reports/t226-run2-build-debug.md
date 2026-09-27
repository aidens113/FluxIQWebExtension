# t226 Run-2 Build / Exploration / Proposal Debug

## Evidence boundary and integrity

Run: `run-muj39xl6-f6a5d4e5` (`everything-store`, workflow `plus-under-fifty`). The ids agree across `run.json`, `summary.json`, and `evaluation.json`.

The completion marker matches the artifact-index bytes. Every artifact opened below is indexed; its byte count and digest match; its index redaction state is `applied`. `run.json.redactionState` is `verified`.

Read only:

- `docs/working/mvp-today-plan/reports/t223-run2-artifact-map.md`
- `bundle.complete.json`
- `artifact-index.json`
- `run.json`
- `summary.json`
- `evaluation.json`
- `snapshots/live-llm.json`
- screened codes/counts/nullability from `snapshots/flow-lane.json`

No raw event, timeline, log, provider sidecar, prompt, response, page dataset, screenshot, HTML, database, browser state, selector, credential, or page content was opened or reproduced.

## Outcome and stage reached

- Overall status/verdict: `failed`; evaluation failure category `runtime.behavior`; no facility failure.
- Highest stage reached: **Stage 6 (judgement and recovery processing)**. The run built and reviewed a proposal, executed it, judged one extraction, recorded a refuted result, and attempted result recovery/reauthoring. Recovery remained `unsettled`, so Stage 6 did not settle successfully.
- Flow observation: `flowCreated: true`, `status: failed`, `oracleVerdict: failed`, `reportedVerdict: failed`, `resultVerification: refuted`, two harness activations.
- Terminal automation classification: category `output_not_observed`, code `core.result.does_not_answer_request`, stage `verification`, `retryable: false`.
- The dataset oracle was reached and judged structurally: 12 observed versus 13 expected records; 12 positions compared; 1 positional match and 7 any-order matches; all 48 compared required fields were present; 0 unexpected fields and 0 non-string values. No raw record values were inspected.
- Recovery was attempted. Two `diagnosis` interventions validated. Result repair used `core.result.does_not_answer_request`. Reauthoring was routed but not applied; it ended at `provider_request` with `flow_bootstrap.unexpected_error`, non-retryable, and no adaptation id. No runtime patch, adaptation, or change proposal was published.

## Provider accounting and budget state

Authorized/granted envelope: 26 calls, 560,000 total tokens per run, USD 0.25 maximum estimated cost per request, USD 2 maximum total estimated cost. The gate was invoked; no high-token confirmation was required or sent; the published accounting reports no budget breach and no pending call.

Build bucket:

- 19 provider calls, of which 18 were evidence-loop calls.
- 239,801 input tokens; 3,705 output tokens; 243,506 reported total tokens.
- USD 0.03085158 reported estimated cost.
- Seventeen calls have per-call observations and two are marked `unrecorded`; therefore the permitted artifacts do not prove complete per-call attribution for the published aggregate.

Verification/recovery bucket:

- 2 calls, both recorded.
- 5,930 input tokens; 733 output tokens; 6,663 total tokens.
- USD 0.0017178 estimated cost.
- The repair observation and verification record describe the same two calls, so they are not additive.

The build and recovery buckets are reported separately; no combined total is asserted because the artifact contract does not explicitly prove all bucket relationships. Each published bucket remains below its stated grant.

## Exploration and decisions

The primary build evidence loop contains 18 decisions, 15 tool calls, 25 sanitized step records, and 91,140 evidence bytes. It ended with `core.decision_complete`; build outcome was `proposed`. No build failure or permission request was published.

Closed tool/decision counts:

- `core.run_node`: 14
- `web.detect_repeating_structure`: 1
- `core.decision_amend_draft`: 7
- `core.decision_unusable`: 2
- `core.decision_complete`: 1

Closed result-code counts:

- `web.action.succeeded`: 4
- `web.inspect.succeeded`: 7
- `web.structure.detected`: 1
- `web.action.rejected.not_at_start_location`: 1 (`start_location_not_reached`)
- `web.action.rejected.target_unobserved`: 1 (`target_not_a_handle`)
- `web.action.rejected.blocked_by_dialog`: 1
- `llm_evidence_loop.draft_rerun`: 6
- `llm_evidence_loop.draft_unchanged`: 1
- `llm.provider_malformed_response`: 1
- `llm_evidence_loop.dry_run_refused`: 1
- final `core.decision_complete`: 1 step with no result code

The ordered decisions show continued work after both unusable classifications and a later terminal `core.decision_complete`. The sanitized bundle does not retain per-turn prompt, request, free-form rationale, selectors, or unsafe tool parameters.

## t217 exercise

**Yes.** The evidence loop emitted `core.decision_unusable` twice, once classified by `llm.provider_malformed_response` and once by `llm_evidence_loop.dry_run_refused`. This proves the t217 final-unusable classification path was exercised. It was not the terminal build outcome: the loop continued and ultimately completed a proposal.

## Proposal and authored-node presence

- Build outcome `proposed`; review present with 2 applied mutations.
- A build adaptation is present (identifier intentionally omitted).
- `flowShape` present: 5 nodes, all action nodes; 2 navigation nodes and 1 extraction node.
- `authoredNodes` present with 5 screened entries: two browser-navigation outputs, two DOM-click outputs, and one DOM-list-extraction output.
- Screened parameter envelopes and withheld markers are present. Their values were not reproduced or sought elsewhere.
- A runtime run id is present and 6 action-attempt summaries were published, confirming that the proposal reached playback rather than stopping at build/review.
- No `repair-lane.json` is indexed, so there is no repair-application, persistence, deterministic-reuse, or replay proof.

## Classification and limits

The build itself succeeded in producing a reviewed proposal. The final failure is a runtime verification/result failure, not a build failure: `core.result.does_not_answer_request` with a refuted judgement. Recovery then failed to apply a reauthored adaptation because the provider-request stage ended with `flow_bootstrap.unexpected_error`.

- `NO EVIDENCE:` the sanitized build-step contract retains no provider request, response, or free-form rationale explaining why each draft decision was chosen.
- `NO EVIDENCE:` no structured per-turn context eviction or truncation position is published.
- `NO EVIDENCE:` the bundle identifies closed failure/tool codes but does not identify an owning source file or corrective task.
- `NO EVIDENCE:` two build calls lack per-call records, so their token and cost contribution cannot be recovered from the permitted artifacts.

## Checks performed

- Verified marker-to-index integrity and every opened artifact's indexed digest/byte count/redaction state.
- Parsed only the approved JSON properties and emitted only ids, booleans, counts, numeric aggregates, nullability, and closed codes.
- No source/shared-document edit, build, test, live/provider/browser action, artifact mutation, or commit was performed.
