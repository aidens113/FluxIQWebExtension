# t321 — Post-run documentation update map

Status: **Complete report-only map; no run-3 artifact was opened**

Apply this map only after t313's integrity/identity/redaction gates pass and t317's bounded fields
have been recorded in the renamed run-3 debug. A CLI verdict alone is insufficient. Every fact
below must be either corroborated from t317's safe paths or written as `NO EVIDENCE:`; never infer a
stage from file presence, zero from a missing counter, persistence from an adaptation id, a fourth
judgement from call count, or revocation from accounting.

## Evidence tokens to resolve first

Before editing either plan, prepare one bounded fact sheet:

- `<RUN_ID>`, `<STARTED_AT>`, `<FINISHED_AT>`, and closed `<VERDICT>` corroborated across
  `run.json`, `summary.json`, and `evaluation.json`;
- `<FACILITY_OR_PRODUCT>` from `evaluation.failureCategory/facilityFailure`;
- `<HIGHEST_STAGE>` from t317's completion chain, not the highest artifact present;
- `<FLOW_CREATED>`, reviewed shape, and node categories from `flow-lane`;
- exact oracle `<EXPECTED>/<OBSERVED>/<MATCHED_IN_ORDER>` and bounded field/pagination facts from
  `evaluation.extraction`;
- closed verification status/verdict from `flow-lane.resultVerification` and `live-llm.verification`;
- recovery route/apply facts from `harnessRecovery.resultRepair/resultReauthor`;
- persistence/application facts only when `repair-lane.application` and the named evaluation
  persistence/validation/reuse fields corroborate them;
- deterministic replay only when one replay satisfies all six t317 conditions, including
  `providerCalls:0`, `harnessActivations:0`, and `modelCalled:false`;
- accounting as separate build/main, runtime, repair, verification, and evaluation representations;
  never publish a combined total unless the schema proves disjointness.

Two gaps have mandatory wording when the bounded schema does not close them:

- `NO EVIDENCE: verification calls are recorded but not safely phase-labelled.`
- `NO EVIDENCE: the bounded run artifacts publish grant bounds and accounting but no terminal revoke/lifecycle property.`

## `mvp-today-plan.md`

### Preserve unchanged

Keep `Purpose`, both complete run-1/run-2 paragraphs, `Run-2 accounting`, the t217 correction, and
the run-2 evidence paragraph as historical evidence. Do not rewrite run 2 as a pass or add its
overlapping accounting buckets.

### Required Current State edits for either outcome

1. Apply t297's locally implemented paragraph and replace the stale pre-fix `Local validation`
   paragraph with the observed final-tree validation from t307: t290 81/81, t293 51/51, t304
   11/11 plus Core 30/30, final Core root totals, Core check result, and the provider-free dry-run's
   exact ready/zero-provider facts. These remain local/readiness evidence, not live proof.
2. Add `**Live run 3.**` after the retained run-2 evidence. It must name only the corroborated run
   id, closed verdict, facility/product classification, highest completed stage, Flow-created fact,
   exact oracle comparison, and closed verification/repair/replay facts.
3. Add `**Run-3 accounting.**` only from separately labelled safe representations. Preserve
   `unrecordedCalls`; if overlap is unresolved, state that no combined token/cost total is
   published.
4. Add `**Run-3 evidence status.**` naming integrity/redaction success and every material
   `NO EVIDENCE` gap. In particular, do not claim terminal grant revocation from the current mapped
   artifacts.
5. Rewrite `Next` and `Blockers` from the passed/failed branch below. Remove stale t229 wording
   only after run 3 establishes a newer result.

### Four criterion rows — passed run 3

| MVP criterion | `Current evidence` replacement | `Still required` replacement |
| --- | --- | --- |
| Created from language | State the verified created/reviewed Flow shape and exact oracle outcome. | One further independent unchanged-profile pass; if shape detail is absent, say `NO EVIDENCE` and retain the prior requirement. |
| Runs deterministically | State the replay only if all six t317 replay predicates passed, including zero provider/harness/model calls. | One further independent pass; otherwise keep provider-free replay as required and name the missing property as `NO EVIDENCE`. |
| Repairs itself | Claim this only if run 3 actually entered wrong-answer repair and bounded application + persistence + successful replay are all corroborated. | If the first answer passed or any repair proof is absent, keep self-repair live-unproven and state the precise `NO EVIDENCE`; a run-level pass does not prove repair. |
| Judges its own answer | State the closed affirmative verification. Claim post-repair recursive judgement only when phase-labelled evidence proves it. | One further independent pass; otherwise retain the missing judgement phase with `NO EVIDENCE`. |

For a pass, `Next` must say: repeat the same scenario under the unchanged default profile for the
second independent consecutive pass. `Blockers` must say no defect is established by run 3 but the
MVP/rung exit remains open until pass 2; also list any self-repair, phase-labelled judgement, or
revocation evidence gap. The streak becomes **1**, never 2, and the rung is not left.

### Four criterion rows — failed run 3

Update a row only with capability actually proved before the failure. For every later stage, retain
the prior `Still required` text and add the exact missing bounded fact. A Flow-created failure can
advance `Created from language` evidence without advancing deterministic replay; a judged mismatch
can advance judgement evidence without proving repair; an adaptation id or `applied:true` alone
does not prove persistence/reuse. The streak remains/resets to **0**.

For a valid product failure, `Next` must name the earliest evidence-backed defect and require full
debug/fix before the same unchanged-profile scenario is repeated. `Blockers` must name that defect
and every downstream unmeasured stage. For a facility/integrity/redaction failure, do not make run
3 the latest accepted product measurement: keep run 2 as latest, name run 3 as an invalid or
inconclusive attempt, and block on restoring trustworthy measurement.

### MVP ledger

Append the observed t307 Accepted validation entry first, replacing all placeholders. Then append
one run-3 entry (seven bullets, under 15 lines):

```md
### 2026-09-26 — Run 3 <passed | failed | was not an acceptable measurement> at <highest stage>
- Agent: supervisor with run-3 evidence reviewers
- Changed: `<RUN_ID>` debug/evidence reports and both active plans' Current State; no outcome inferred beyond bounded sanitized evidence
- Why: Measure creation, deterministic execution, self-repair, and judgement on the unchanged default-profile hard scenario.
- Validation: `inspect <RUN_ID>` -> <EXACT INTEGRITY RESULT>; bounded manifest/summary/evaluation and conditional flow/mismatch/repair snapshots -> <EXACT CLOSED VERDICT, STAGE, ORACLE, REPAIR, REPLAY SUMMARY>; <MATERIAL NO EVIDENCE GAPS>.
- Outcome: <Accepted for an integrity-valid pass or product failure | Partial for facility/integrity/redaction failure>
- Follow-up: <second unchanged-profile pass when passed | exact defect/debug gate and same-scenario rerun when failed>; consecutive-pass streak <1 | 0>.
```

`Outcome: Accepted` means the measurement is valid, not that the product passed.

## `language-driven-flow-loop-plan.md`

### Preserve unchanged

Do not rewrite the binding live-test instruction, ten-scenario corpus, historic ten-row run table,
old run ids, old accounting, or archived defect analysis. Do not add run 3 to the old ten-row table;
that table is historical context and later runs are represented by the latest-measurement block and
ledger.

### Required Current State edits for either outcome

1. In `Where rung 1 actually is`, change attempts from 16 to **17**. If run 3 created a Flow,
   change built Flows from 11 to **12** and leave pre-Flow failures at 5; otherwise leave built
   Flows at 11, change pre-Flow failures to **6**, and add run 3's closed pre-Flow reason only when
   safely established. Set the streak to 1 only for a valid pass, otherwise 0.
2. Replace `Latest accepted rung-1 measurement` and its following accounting paragraph with run 3
   only when integrity/redaction passed and it is an accepted product measurement. Use the bounded
   fact sheet and separate accounting representations. On a facility/integrity failure, keep run 2
   as latest accepted and add one sentence describing run 3 as an unaccepted attempt without
   bundle-derived claims.
3. Replace from `What is proven working, live...` through `Blockers` with outcome-specific current
   truth. Fold t297's local implementation/root/check/dry-run evidence into `implemented but not
   live-proven` only for capabilities run 3 did not itself prove.
4. Append the same factual run-3 ledger outcome, phrased for the operating loop. Preserve the exact
   run id and validation commands, and use `Outcome: Accepted` for either valid product verdict;
   use `Partial` when the measurement itself is not trustworthy.

### Passed branch

State that run 3 is the latest accepted measurement and streak **1**. `What is proven working,
live` may include only criterion facts closed by bounded run-3 evidence. If no wrong-answer repair
occurred, explicitly keep the full self-repair cycle unproven despite the pass. `The next action`
is a second independent run of the same scenario under the unchanged profile; `Blockers` is the
missing second consecutive pass plus any explicit evidence gap. Do not leave rung 1.

### Failed branch

State run 3 as the latest accepted measurement only for an integrity-valid product failure and keep
streak **0**. Name the highest completed stage and earliest closed defect; keep later repair,
persistence, replay, and judgement claims absent or `NO EVIDENCE`. `The next action` is full debug,
an evidence-backed fix, affected local validation, and the same unchanged-profile rerun before any
different scenario. For facility/integrity/redaction failure, run 2 remains latest accepted and the
next action is restoring a trustworthy run-3 measurement.

## Global truthfulness checks

- A raw runner pass, count 13, or `flowCreated:true` alone cannot update all four rows.
- Missing/null is not false or zero. Use `NO EVIDENCE:` with the artifact/property needed.
- Never publish record values, provider text, failure prose, selectors, handles, page data, secrets,
  credentials, or raw errors in either plan.
- Do not sum accounting representations or turn authorized ceilings into spend.
- Never claim terminal grant revocation from current bounded artifacts.
- Passed run 3 yields streak 1; failed/invalid run 3 yields streak 0. A second independent pass is
  always required before leaving rung 1.

t321 opened no run-3 artifact or `test-runs/` path and ran no test/live command. It changed no
shared plan, debug, source, generated output, commit, or live state. This report is its only write.
