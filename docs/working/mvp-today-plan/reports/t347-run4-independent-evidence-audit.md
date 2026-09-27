# t347 — Run-4 independent bounded evidence audit

Run: `run-muje0grk-4d8d2d3f`

Verdict: **accepted finalized measurement; failed at Stage 2 and fires the no-run-5 unchanged-retry stop**

This audit independently followed t343's bounded read order after the supervisor's integrity/identity gates passed. It opened only the artifact index and five uniquely indexed, conservatively redacted structured artifacts. It did not open raw logs/events, provider sidecars or text, screenshots/video, HTML, page/browser data, selectors, datasets, databases, credentials, or authorization material. No live/provider/browser/Lab/test/build/commit/shared-document action was performed.

## Index and read gate

The index uses schema `0.1`, contains 14 safe unique relative paths, and classifies all 14 as `redaction: applied`. An independent index-only check reproduced those results.

Each opened artifact has exactly one indexed entry with conservative redaction applied:

- `run.json`;
- `summary.json`;
- `evaluation.json`;
- `snapshots/live-llm.json`;
- `snapshots/flow-lane.json`.

Neither conditional artifact is indexed, so neither was opened:

- `snapshots/extraction-mismatches.json`;
- `snapshots/repair-lane.json`.

Run manifest redaction is `verified`. Manifest, summary, and evaluation agree on the safe run id and failed verdict. The run spans `2026-09-27T05:37:53.892Z` through `2026-09-27T05:41:25.951Z` in the manifest; summary timestamps differ only by bounded capture milliseconds.

## Highest stage reached

**Stage 2 — exploration/build, failed before a complete proposal.**

Positive bounded evidence:

- lane: created-Flow;
- `build.outcome: failed`;
- `flow-lane.complete: false` and `stoppedAt: build`;
- 26 evidence-loop decisions, 22 tool calls, 33 bounded trace steps, and 57,868 evidence bytes;
- iterations span 0 through 26 with 27 distinct iteration values;
- build provider calls and loop-provider calls are both 26;
- provider invocation is `attempted`; timeout recovery is false;
- build duration is 189,708 ms; evaluation duration is 212,059 ms;
- evaluation `flowCreated: false`.

Stage 3 is not established. One partial authored-node envelope is present, but review and Flow shape are null and build outcome is failed rather than proposed. A partial authored node does not satisfy t343's proposal/review/shape conjunction.

No runtime was reached: runtime run id and runtime status are null, action count is 0, and recovered-failure count is 0.

## Closed terminal failure

The smallest typed failure record is:

- failure code: `flow_bootstrap.evidence_unusable_decision`;
- failure stage: `provider_output_validation`;
- issue code: `bootstrap.cannot_answer_instruction`;
- provider invocation: `attempted`;
- recovered after timeout: false.

Evaluation separately records `failureCategory: runtime.behavior`. Its facility-classification representation is retained separately: boundary `finalized-bundle`, stage `scenario.execute`, reason `unclassified`. No arbitrary failure message or summary prose was copied.

## Bounded trace categories

The 33 screened trace steps break down as follows:

| Tool category | Count |
| --- | ---: |
| `core.run_node` | 16 |
| `core.decision_amend_draft` | 8 |
| `web.detect_repeating_structure` | 6 |
| `core.decision_unusable` | 3 |

| Result code | Count |
| --- | ---: |
| `web.action.succeeded` | 6 |
| `web.inspect.succeeded` | 3 |
| `web.structure.detected` | 2 |
| `llm_evidence_loop.draft_amended` | 2 |
| `llm_evidence_loop.draft_rerun` | 6 |
| `llm_evidence_loop.dry_run_refused` | 1 |
| `web.action.rejected.target_unobserved` | 5 |
| `web.action.rejected.no_repeating_structure` | 4 |
| `web.action.rejected.blocked_by_dialog` | 1 |
| `web.action.rejected.not_at_start_location` | 1 |
| `bootstrap.cannot_answer_instruction` | 2 |

The typed reason categories comprise four `column_not_in_detected_list`, four `nothing_repeats_on_page`, one `start_location_not_reached`, one `target_not_a_handle`, and 23 absent reasons. `effectApplied` is true on 6 steps, false on 2, and absent on 25. These are screened typed categories only; no node ids, selectors, handles, parameters, page text, or provider content were read or published.

## Oracle and later-stage evidence

No oracle comparison ran:

- `evaluation.extraction: null`;
- `oracleVerdict: null`;
- `reportedVerdict: null`;
- no mismatch snapshot is indexed.

`NO EVIDENCE: no oracle comparison or expected-versus-observed count, field, order, pagination, or mismatch result was measured. The prewritten 13-record oracle is not backfilled as observed evidence.`

No judgement or repair stage was reached:

- `flow-lane.resultVerification: null`;
- `live-llm.verification: null`;
- evaluation `harnessRecovery: null` and `harnessActivations: 0`;
- no repair-lane snapshot is indexed;
- `adaptationCost`, `adaptationValidation`, `adaptationPersistence`, and `adaptationReuse` are null.

Therefore:

- `NO EVIDENCE: no answer judgement occurred.`
- `NO EVIDENCE: no result-repair or result-reauthor route was published.`
- `NO EVIDENCE: no adaptation was proposed, approved, applied, persisted, validated, or reused.`
- `NO EVIDENCE: no deterministic replay occurred.`
- `NO EVIDENCE: no post-repair recursive judgement occurred.`
- `NO EVIDENCE: the bounded artifacts publish grant bounds and accounting but no terminal revoke/lifecycle property.`

## Accounting representations kept separate

### Build/main representation

`live-llm.build` records 26 provider calls and 26 loop-provider calls. Its accounting is:

- input tokens: 370,882;
- output tokens: 3,642;
- total tokens: 374,524;
- estimated cost: USD 0.049289784.

### Observed/itemized representation

`live-llm.observed` records:

- calls: 26;
- itemized observed-call entries: 26;
- per-call record state: `recorded`;
- unrecorded calls: 0;
- pending calls: 0;
- interventions: 0;
- typed budget breaches: 0;
- provider gate invoked: true;
- input tokens: 370,882;
- output tokens: 3,642;
- total tokens: 374,524;
- estimated cost: USD 0.049289784.

The 26 itemized entries sum exactly to that observed token/cost representation. Per-call ranges are 7,893–15,923 input tokens, 61–599 output tokens, 7,989–16,466 total tokens, and USD 0.000375504–0.00381594 estimated cost.

The build and observed values are equal representations of the same build usage and are **not added together**. Evaluation `llm.calls: 26` is corroboration, not another bucket. Repair and verification objects are null, so there is no reported repair/verification accounting bucket and no overlap to combine.

### Ceilings

Authorized and granted ceilings both record 26 calls, 560,000 total run tokens, USD 0.25 estimated cost per call, and USD 2 total estimated cost. Authorized per-request token limits are 48,000 input, 8,000 output, and 56,000 total. The observed numeric usage is within the token/cost ceilings, and the typed observed accounting reports zero budget breaches. The 26-call ceiling was exactly reached.

## Exact stop-trigger conclusion

The t331/t343 strict trigger **fires**. This accepted run-4 measurement:

1. ends at Stage 2; and
2. publishes failure code `flow_bootstrap.evidence_unusable_decision`; and
3. publishes issue code `bootstrap.cannot_answer_instruction`.

Therefore:

- stop unchanged retries;
- **do not launch run 5**;
- the consecutive-pass streak remains **0**;
- permit no next provider call until a fix-before-retry investigation produces privacy-safe stable draft/step identity or a deterministic scripted reproduction **and** a measured source change.

This conclusion comes from run 4's independently accepted typed evidence, not from call count, prose, or imported run-3 facts. Run 4 proves truthful preservation of a second non-converging Stage-2 terminal decision; it does not prove any later stage or a complete product pass.

This report is t347's only write.
