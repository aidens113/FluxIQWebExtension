# t227 — Run-2 runtime, judge, repair, and replay evidence

## Outcome

Run 2 reached the created-Flow runtime, extraction comparison, model-backed result
verification, and recovery routing. It therefore reached Stage 6 processing, but did not
complete a settled repair cycle: the run ended failed, result verification was `refuted`,
recovery remained `unsettled`, no repair adaptation or change proposal was produced, and no
repair-lane/replay artifact was published.

The bundle is internally consistent and safe to inspect through the bounded artifacts below.
The completion marker matches the artifact index, every opened artifact matches its indexed byte
count and SHA-256, every opened artifact is indexed with redaction `applied`, and
`run.json.redactionState` is `verified`. The run id agrees across the run, summary, and evaluation.

## Files inspected

- `docs/working/mvp-today-plan/reports/t223-run2-artifact-map.md`
- `test-runs/run-muj39xl6-f6a5d4e5/bundle.complete.json`
- `test-runs/run-muj39xl6-f6a5d4e5/artifact-index.json`
- `test-runs/run-muj39xl6-f6a5d4e5/run.json`
- `test-runs/run-muj39xl6-f6a5d4e5/summary.json`
- `test-runs/run-muj39xl6-f6a5d4e5/evaluation.json`
- `test-runs/run-muj39xl6-f6a5d4e5/snapshots/flow-lane.json`
- `test-runs/run-muj39xl6-f6a5d4e5/snapshots/extraction-mismatches.json`

`snapshots/repair-lane.json` is not indexed and was not opened. No raw event stream, timeline,
log, provider text/sidecar, prompt, response, page row, dataset, screenshot, HTML, browser state,
or database was inspected.

## Stage chain reached

1. The build outcome was `proposed`; a build adaptation was present.
2. Review was present and recorded two applied mutations.
3. The resulting Flow had five action nodes: two navigation, two click, and one extract-list node.
   Five authored nodes were present. The own-page check was required and reached.
4. Playback produced a runtime run and six attempts. The first five attempts succeeded: two
   navigation, two click, and the extract-list attempt. A sixth attempt on the extract node failed
   at verification. There was no `stoppedWithoutFailedAttempt` finding.
5. Extraction was `judged`; the oracle comparison ran and failed.
6. Result verification was model-backed and `refuted`. Recovery was entered, but its record is
   explicitly `unsettled: recovery`; this is Stage 6 reached, not a completed repair/persistence/
   replay proof.

## Closed verdict and status fields

| Field | Value |
| --- | --- |
| Run manifest status / verdict | `failed` / `failed` |
| Evaluation verdict | `failed` |
| Evaluation failure category | `runtime.behavior` |
| Facility failure | `null` |
| Lane / Flow created | `flow` / `true` |
| Flow snapshot lane | `created-flow` |
| Runtime status | `failed` |
| Oracle verdict | `failed` |
| Reported verdict | `failed` |
| Result verification | `refuted` |
| Automation failure category | `output_not_observed` |
| Automation failure code | `core.result.does_not_answer_request` |
| Failure stage / retryable | `verification` / `false` |
| Expected automation failure | `null` |
| Harness activations | `2` |
| Recovery settlement | `unsettled: recovery` |

The runner-verdict invariant failed as `runtime.behavior`. The evidence-packet-budget invariant
passed: nine sanitized packets were measured, the largest was 5,851 bytes against a 6,000-byte
limit. Six packets were marked truncated. Raw snapshot byte measurements were empty.

## Playback and extraction aggregates

Playback recorded five successful action attempts followed by one failed verification attempt.
There were no run-level recovered failures. The runtime extraction summary reported 12 records
from five pages, four fields, 56 items seen, zero empty records, no missing fields, and
`truncated: false`. The stored dataset was not store-truncated, had zero invalid rows, and was read
from one dataset-store page. There were no unpaired datasets and no non-string values.

The oracle comparison measured:

- 13 expected records and 12 observed records;
- 12 compared positions;
- 1 positional match and 7 matches when order was ignored;
- 48 expected required fields and 48 present required fields;
- 0 unexpected fields and 0 non-string values;
- `recordsListed: true` and `countStated: true`;
- no unjudged members;
- `expectedPages`, `pagesFollowed`, and comparison-level `truncated` all `null`.

The bounded mismatch artifact accounts for 12 detailed mismatches: five `values-differ`, six
`moved`, and one `expected-not-observed`. It marks the failure as more than order-only. Across the
five value-difference records, field-level differences were recorded for five name fields, four
price fields, four rating fields, and five URL fields. The missing record accounts for one absent
instance of each of the four required fields. There were zero additional undisclosed fields, zero
unexpected fields, and no cut values. No expected or observed field values were read or copied.

## Judgement and recovery aggregates

The result judge refuted the answer with `core.result.does_not_answer_request`. The Flow snapshot
records recovery as attempted with two `diagnosis` interventions; both had
`validationOk: true` and no validation codes. It records:

- zero runtime-patch attempts;
- zero repair adaptation ids;
- zero change-proposal ids;
- `refusalCode: null` and `refusalRung: null`;
- result repair attempted against the extract node for
  `core.result.does_not_answer_request`;
- result reauthor routed, with no refusal, but no adaptation and `applied: false`;
- result reauthor failure `flow_bootstrap.unexpected_error` at `provider_request`,
  non-retryable, with provider invocation `attempted` and provider response `unknown`.

This proves that judgement and reauthor routing were entered. It does not prove a repair was
created, approved, persisted, or reused.

## Repair, persistence, and replay evidence

There is no indexed `snapshots/repair-lane.json`. Accordingly:

- **NO EVIDENCE:** no declared-repair verdict or repair application outcome was published; the
  artifact that would carry it is absent.
- **NO EVIDENCE:** no deterministic replay result was published; replay count, provider calls,
  harness activations, model-called flag, goal result, and Flow result are unavailable because the
  repair-lane artifact is absent.
- **NO EVIDENCE:** no repair persistence or reuse was measured. Evaluation fields
  `adaptationCost`, `adaptationValidation`, `adaptationPersistence`, and `adaptationReuse` are all
  `null`.
- **NO EVIDENCE:** no sanitized judge directive or reauthor rationale is retained in the permitted
  artifacts; only the closed verdict and failure codes are available.
- **NO EVIDENCE:** the cause of the record selection/order mismatch is not identified. The bundle
  records mismatch structure, but no repository owner, source file, or corrective task id.

The build adaptation and reviewed authored Flow are creation evidence. They must not be
misreported as repair persistence.

## Checks performed

- Verified the completion marker against the artifact-index bytes.
- Verified indexed byte count, SHA-256, and redaction state for every opened artifact.
- Confirmed `run.json.redactionState` is `verified` before opening content artifacts.
- Confirmed run-id agreement and verdict agreement across run, summary, and evaluation.
- Confirmed the conditional mismatch artifact was indexed before opening it.
- Confirmed the repair-lane artifact was not indexed and did not search for an alternative.

No build, provider, browser, live-run, source edit, or commit was performed.
