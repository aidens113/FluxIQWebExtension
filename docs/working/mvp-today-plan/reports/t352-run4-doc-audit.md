# t352 — Run-4 authored reconciliation audit

## Decision

**NO-GO pending three evidence-precision corrections in the run-4 debug.** The two active plans'
run-4 Current State and newest ledger entries otherwise reconcile with t347/t348, keep accounting
and evidence-byte representations separate, enforce the hard stop, and remain within their Current
State line budgets.

## Required corrections

1. In debug Stage 3, replace “review, flow shape, and authored nodes are null.” T347 reports that
   review and Flow shape are null but **one partial authored-node envelope is present**. State that
   this partial envelope does not establish Stage 3 or a complete proposal; `build.outcome` remains
   `failed` and `evaluation.flowCreated` remains false.
2. In debug Cause 2, remove the temporal/causal claim that “the last reruns still targeted an
   unobserved column.” T347 supports only aggregate closed evidence: five
   `target_unobserved` results, comprising four `column_not_in_detected_list` reasons and one
   `target_not_a_handle`; it does not independently attribute those refusals to the last reruns.
3. Replace or explicitly source the debug's ordered “terminal eight bounded steps” narrative.
   T347 publishes aggregate category/reason counts but not that ordering, and t348 does not supply
   it. A report-supported replacement is: the trace contains six draft reruns, two amendments, two
   cannot-answer results, five target-unobserved refusals, and four no-repeating-structure refusals;
   the safe evidence does not establish semantic draft identity or per-turn causality.

For precision, occurrences of “before a proposal existed” / “no proposal” may be rendered “before
a complete proposal survived validation.” This is advisory if the term *proposal* is reserved for
the completed Stage-3 object; the required correction is to stop saying authored nodes are null.

## Reconciled facts

- Run id, time range, provider/model, failed verdict, Stage-2 stop, 26 decisions/calls, 22 tool
  calls, 33 trace steps, terminal failure/stage/issue, and absence of runtime/oracle/judgement/
  repair/replay evidence match t347.
- Build and observed usage are correctly treated as equal views of one bucket: 370,882 input plus
  3,642 output equals 374,524 tokens and USD 0.049289784. All 26 calls are itemized; unrecorded and
  pending calls and typed budget breaches are zero. No repair or verification bucket is added.
- The debug and plans correctly keep 57,868 step-level evidence bytes separate from the 70,126
  summary evidence-byte projection and do not add them.
- The plans correctly retain the pass streak at zero and state the predeclared stop: no unchanged
  run 5 and no provider call during fix-first work. Their required deterministic fixture,
  privacy-safe progress evidence, measured source correction, validation closure, and fresh
  authorization agree with t348.
- The plans do not claim live proof for Flow creation convergence, later runtime stages, repair,
  deterministic replay, recursive judgement, or terminal revocation.

## Line budgets

- `mvp-today-plan.md` Current State spans lines 14–107 inclusive: 94 lines.
- `language-driven-flow-loop-plan.md` Current State spans lines 14–160 inclusive: 147 lines, within
  the 149-line limit with two lines of headroom.
- The newest run-4 ledger entries begin at lines 273 and 710 respectively and remain outside the
  Current State counts.

## Scope and checks not run

Read-only comparison used only the run-4 debug, t347, t348, both active plans' Current State, and
their newest run-4 ledger entries. I did not inspect raw/run artifacts, source, tests, builds, git
state, provider/browser/Lab state, or earlier ledger entries, and ran no validation commands. This
report is t352's only write.
