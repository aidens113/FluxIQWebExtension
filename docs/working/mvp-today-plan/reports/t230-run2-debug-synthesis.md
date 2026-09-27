# t230 — Copy-ready completion for run 2

The block below is synthesized only from t222 and t226–t228. It is intended for the run-2 debug;
it does not modify that shared document. It contains no raw page values, model request/response
text, selectors, credential or authorization material, artifact digests, or provider prose.

---

# Run debug — `run-muj39xl6-f6a5d4e5`

## Header

- Scenario / variant / task: `everything-store` / none /
  `everything-store-plus-earbuds-under-50`
- Workflow / lane: `plus-under-fifty` / isolated created-Flow lane
- Profile: `mvp-hard-scenario`, unchanged default 26-call ceiling, one replay requested before the
  run
- Started / finished: `2026-09-27T00:37:19.822Z` /
  `2026-09-27T00:41:39.899Z`
- Duration: 260,077 ms
- Verdict: `failed`; evaluation category `runtime.behavior`; facility failure `null`
- Highest stage reached: **Stage 6 processing, not settled completion**
- Integrity/redaction: completion/index and all permitted opened-artifact checks passed;
  `run.json.redactionState` was `verified`
- Change under measurement: t217 terminal final-exhaustion classification parity only

## Provider accounting and bounds

Keep the typed buckets separate; the artifacts do not prove every representation is disjoint.

| Bucket | Calls | Input model tokens | Output model tokens | Total model tokens | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Build/main aggregate | 19, including 18 loop calls | 239,801 | 3,705 | 243,506 | $0.03085158 |
| Verification/recovery | 2 | 5,930 | 733 | 6,663 | $0.0017178 |
| Evaluation roll-up | 21 | unreported | unreported | unreported | unreported |

- Configured ceilings: 26 calls, 48,000 input / 8,000 output / 56,000 total model tokens per
  request, 560,000 total model tokens per run, $0.25 estimated cost per request, $2 estimated total
  cost, 30,000 ms provider timeout, and zero configured provider retries.
- The main accounting gate was invoked and reported `budgetBreaches: 0` and `pendingCalls: 0`.
- Seventeen of the 19 main calls have per-call observations; two are explicitly unrecorded. The
  bucket aggregate includes them.
- The two verification records and two repair-observation records are the same two calls and are
  not additive.
- No high-token confirmation was sent.

## Stage 1 — instruction and expected chain

Stage 1 was fixed before run output was inspected. The task required the Flow to reach the store
from a blank start, handle expected interruptions, perform the search, apply the strict eligibility,
rating, price, product-kind, and non-sponsored predicates, extract exactly four declared fields,
traverse all results, deduplicate while retaining first occurrence and result order, and submit the
complete ordered dataset for judgement. The oracle required exactly 13 ordered records; count alone
could not pass. If the first result was wrong, the expected product path was structured judgement,
automatic repair, persistence, and a provider-free deterministic replay.

The pre-run risk hypotheses were semantic-filter fidelity, full pagination/lazy-load traversal,
deduplication, and stable ordering. Runtime recovery was allowed only for bounded recoverable
faults, with every attempt and recovery disposition recorded.

## Stage 2 — exploration and build decisions

The build stayed within the default grant and ended `proposed`, with no build failure or permission
request. It recorded 18 decisions, 15 tool calls, 25 sanitized decision/tool rows, 91,140 evidence
bytes, and a 151,820 ms build duration.

Closed decision/tool totals:

- `core.run_node`: 14
- `web.detect_repeating_structure`: 1
- `core.decision_amend_draft`: 7
- `core.decision_unusable`: 2
- `core.decision_complete`: 1

Closed result totals:

- `web.action.succeeded`: 4
- `web.inspect.succeeded`: 7
- `web.structure.detected`: 1
- `web.action.rejected.not_at_start_location` / `start_location_not_reached`: 1
- `web.action.rejected.target_unobserved` / `target_not_a_handle`: 1
- `web.action.rejected.blocked_by_dialog`: 1
- `llm_evidence_loop.draft_rerun`: 6
- `llm_evidence_loop.draft_unchanged`: 1
- `llm.provider_malformed_response`: 1
- `llm_evidence_loop.dry_run_refused`: 1
- final `core.decision_complete`: 1

The loop continued after both ordinary unusable decisions and later completed a proposal.

**t217 was not exercised in its literal target condition.** T217 concerns classification when the
bottom-of-loop final decision is unusable and the build exhausts without a proposal. This run had
ordinary unusable decisions during the loop, then a final completion and `outcome: proposed`.
Those intermediate decisions exercise ordinary unusable-decision handling, not t217's terminal
final-exhaustion behavior. Run 2 therefore provides no acceptance evidence for t217.

## Stage 3 — proposed Flow

- Build outcome: `proposed`; build adaptation present.
- Review present with two applied mutations.
- Flow shape: five nodes, all action nodes—two navigation, two click, one list extraction.
- Five screened authored-node entries were present.
- Own-page navigation was required; the built shape contained two navigation nodes.
- A runtime run id was produced, proving the proposal reached playback.

**NO EVIDENCE:** these reports do not retain a safe, copyable proof that the authored parameters
implemented every strict semantic predicate, all-page traversal, deduplication, and stable-order
requirement. The shape proves node categories, not their complete semantics.

**NO EVIDENCE:** the sanitized build records do not say why the model chose this five-node shape.
No page/grammar misread or inability-to-express cause can be assigned.

## Stage 4 — playback and defensive recovery

- Runtime status: `failed`; own-page check reached.
- Six attempts were recorded. Two navigation attempts, two click attempts, and the initial
  extraction attempt succeeded. A sixth attempt on the extraction node failed at verification.
- There was no `stoppedWithoutFailedAttempt` finding.
- No run-level recovered failure was recorded.
- Two harness activations were recorded.
- The extraction attempt reported 12 records across five pages, four fields, 56 items seen, zero
  empty records, zero missing fields, and `truncated: false`.
- The stored dataset reported no store truncation, zero invalid rows, one dataset-store page, zero
  unpaired datasets, and zero non-string values.

A bare success status is not used as proof of answer correctness. The extraction's structured
output summary and the later oracle comparison are reported separately below.

## Stage 5 — answer and exact comparison

Extraction status was `judged`; both a complete record list and exact count were declared.

- Expected / observed records: 13 / 12
- Compared positions: 12
- Positional matches: 1
- Matches ignoring order: 7
- Expected / present required fields across compared positions: 48 / 48
- Unexpected fields: 0
- Non-string values: 0
- Unjudged members: none
- Comparison-level `expectedPages`, `pagesFollowed`, and `truncated`: all `null`

The bounded mismatch evidence records 12 detailed mismatches: five `values-differ`, six `moved`,
and one `expected-not-observed`. The mismatch was not order-only. Across the five value-difference
records, differences were counted for five name fields, four price fields, four rating fields, and
five URL fields. The missing record accounts for one absent instance of each required field. There
were no further undisclosed fields, no unexpected fields, and no cut values.

No expected or observed page value is reproduced here.

## Stage 6 — judgement, recovery, repair, persistence, and replay

Closed outcome fields:

| Field | Value |
| --- | --- |
| Flow created | `true` |
| Runtime / reported / oracle verdict | `failed` / `failed` / `failed` |
| Result verification | `refuted` |
| Automation failure | `output_not_observed` |
| Failure code | `core.result.does_not_answer_request` |
| Failure stage / retryable | `verification` / `false` |
| Expected automation failure | `null` |
| Recovery state | `attempted`, but `unsettled: recovery` |

The model-backed judge made two verification calls. Both structured interventions validated and
both returned the closed verdict `does_not_answer`. Recovery recorded two validated `diagnosis`
interventions, no runtime-patch attempts, no adaptation ids, no change-proposal ids, and no refusal
code or rung.

Result repair was attempted for `core.result.does_not_answer_request`. Result reauthor routing was
entered and a provider invocation was attempted, but no adaptation was produced or applied. It
ended non-retryably at `provider_request` with `flow_bootstrap.unexpected_error`; provider response
state was `unknown`.

No repair-lane artifact was indexed. Therefore Stage 6 was entered but did not yield settled repair,
persistence, or replay evidence.

- **NO EVIDENCE:** no declared-repair verdict or repair-application outcome was published; the
  repair-lane artifact that would carry it is absent.
- **NO EVIDENCE:** no repair context-presence/omission record is reported in t226–t228.
- **NO EVIDENCE:** no persistence or reuse was measured; `adaptationCost`,
  `adaptationValidation`, `adaptationPersistence`, and `adaptationReuse` are all `null`.
- **NO EVIDENCE:** no replay result was published. Replay count, replay provider calls, replay
  harness activations, model-called state, goal verdict, and Flow status are unavailable.
- **NO EVIDENCE:** no sanitized judge directive or reauthor rationale is retained; only closed
  verdict and failure codes are available.

The build adaptation is creation evidence and is not repair-persistence evidence.

## Supported cause rows

| Stage | Measured fact | Supported conclusion | Limit |
| --- | --- | --- | --- |
| Answer | 13 expected, 12 observed; 1 positional and 7 any-order matches; value, movement, and missing-record mismatches | The created Flow's answer failed the exact dataset oracle | The bundle does not identify why the Flow selected or ordered those records |
| Judgement | `refuted` / `does_not_answer` twice | Core judged the produced answer and rejected it | No safe directive prose or rationale is retained |
| Recovery | Reauthor routed; provider invocation attempted; no adaptation; `flow_bootstrap.unexpected_error` at `provider_request` | Recovery did not produce or apply a reauthored repair | Provider response state is `unknown`; no deeper provider cause is available |
| Build | Two ordinary unusable decisions followed by `core.decision_complete` and `proposed` | The build recovered from intermediate unusable decisions and produced a Flow | This is not t217's terminal final-exhaustion condition and is not the terminal scenario failure |
| Repair/replay | No indexed repair-lane artifact; adaptation/persistence/reuse evaluation fields null | No repair application, persistence, or deterministic replay was proved | Artifact absence does not establish every internal action that may have been attempted |

**NO EVIDENCE:** the sanitized bundle/report chain identifies no owning source file, corrective
change, or repository task for the answer mismatch or recovery failure.

## Instrumentation and evidence gaps

- **NO EVIDENCE:** exact provider requests, responses, and free-form per-turn rationale are not
  retained by the sanitized build-step contract.
- **NO EVIDENCE:** no structured per-turn context eviction/truncation position is published.
- **NO EVIDENCE:** the two unrecorded main calls have no individual token, cost, validation, or
  request-ceiling record. Only their aggregate contribution is derivable.
- **NO EVIDENCE:** no combined token/cost total for all 21 evaluation calls is published.
- **NO EVIDENCE:** permitted aggregate fields publish no per-call latency or timeout outcome; the
  configured timeout cannot be independently checked.
- **NO EVIDENCE:** provider-retry configuration is zero, but the permitted aggregate set has no
  separate retry-accounting field.
- **NO EVIDENCE:** repair aggregate accounting is `null`; its model-token totals are bounded sums
  of its two typed records.
- **NO EVIDENCE:** comparison-level pagination fields are `null`. The runtime read reports five
  pages, but the evaluation does not independently judge expected-vs-followed pages.
- **NO EVIDENCE:** no deterministic replay artifact exists, so zero provider calls on replay cannot
  be claimed.

## Final classification

Run 2 is a genuine scenario/MVP failure, not a facility failure and not a build-exhaustion failure.
The build proposed and playback ran, but the exact dataset oracle failed; Core refuted the answer;
and result recovery did not produce an applied repair. Persistence and deterministic replay remain
unmeasured.

The consecutive-pass streak remains **0**. T217's literal final-unusable-exhaustion behavior remains
unvalidated by this run.

---

No run artifact was inspected for this synthesis. No shared debug, source file, live/provider/
browser state, or commit was changed.
