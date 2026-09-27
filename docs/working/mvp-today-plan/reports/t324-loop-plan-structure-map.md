# t324 — Loop-plan post-run structure map

Status: **Ready for bounded in-place update after run 3 settles; no compaction required now**

Current file: `docs/working/language-driven-flow-loop-plan.md`

- whole file: **694 lines**;
- `Current State`: lines 14–148, **135 lines including its heading**;
- `Work Ledger`: lines 617–684, 3 entries;
- compaction triggers: over 800 whole-file lines or over 20 ledger entries;
- Current State budget: must remain under 150 lines.

The document is below both compaction triggers. Its tight constraint is the Current State, with
only 14 additional lines available while remaining strictly below 150.

## Exact Current State edit map

Use t321's already-bounded run-3 fact sheet. Do not reopen artifacts while editing.

1. **Rung counters and streak — current lines 35–41.** Rewrite only the paragraph beginning
   `Where rung 1 actually is`:
   - attempts 16 -> 17;
   - built Flows 11 -> 12 only if run 3 safely proves Flow creation;
   - pre-Flow failures stay 5 when a Flow was created, otherwise become 6 with only a closed safe
     reason;
   - latest-result reference becomes run 3 only for an integrity-valid accepted product
     measurement;
   - streak becomes 1 only for a valid pass, otherwise remains 0.
2. **Historic ten-row table — current lines 43–54.** Do not add run 3 or edit old rows. This table
   is fixed earlier-run history; later runs are represented by the latest-measurement paragraph and
   ledger.
3. **Historic attempt diagnosis — current lines 56–125.** Preserve the t143 timing diagnosis,
   scoring corrections, evidence-reading warnings, run-8 findings, and binding-plan pointer. They
   explain prior decisions and are not superseded merely because run 3 completed.
4. **Latest measurement — current line 127.** Replace the entire paragraph beginning
   `Latest accepted rung-1 measurement` with t321's passed/product-failed branch. For an invalid
   facility/integrity/redaction attempt, retain run 2 as latest accepted and add only one bounded
   sentence saying run 3 was not an acceptable measurement.
5. **Accounting — current line 129.** Replace the entire run-2 accounting paragraph only when run 3
   is an accepted measurement. Keep build/main, runtime, repair, verification, and evaluation
   representations separate; preserve `unrecordedCalls`; publish no combined total without typed
   disjointness. If run 3 is invalid, retain run-2 accounting.
6. **Connector — current lines 131–133.** Preserve the pointer to `What This Batch Established`.
7. **Outcome/next/blockers — current lines 135–148.** Replace from `What is proven working, live`
   through the end of `Blockers` as one bounded block:
   - pass: state only verified live capabilities, streak 1, same-scenario second pass next;
   - product failure: state highest completed stage/earliest closed defect, streak 0, full debug/fix
     then same-scenario rerun;
   - invalid measurement: keep run 2 latest, streak 0, and block on restoring trustworthy evidence.
   A run-level pass does not prove self-repair if no wrong-answer repair occurred. Preserve t321's
   `NO EVIDENCE` wording for unphase-labelled judgement and terminal grant revocation.

Do not append a new Current State subsection. Rewrite these anchored paragraphs in place. After
editing, count from `## Current State` through the line before its closing `---`; require at most
149 lines. If prose would exceed the budget, shorten only the new run-3 summary/accounting/outcome
wording and point to the renamed debug/t321 report. Do not delete evidence, compress the historic
table into an inaccurate count, or hide a gap.

## Ledger edit map

Append entries immediately before `## Open Questions`, preserving the existing three entries:

1. the observed final local-validation/readiness entry derived from t297/t307, with all placeholders
   replaced by actual root/check/dry-run results;
2. one run-3 measurement entry from t321, with exact inspect/evidence result, `Outcome: Accepted`
   for either an integrity-valid product pass or product failure, and `Outcome: Partial` for an
   invalid facility/integrity/redaction measurement.

Keep each entry under 15 lines and include one real `- Validation:` bullet. `Accepted` describes
measurement integrity, not a passing product verdict. The follow-up must preserve streak 1 -> second
unchanged-profile pass, or streak 0 -> debug/fix/same-scenario rerun.

Two ordinary seven-line entries plus separating blanks add about 16 lines and bring the ledger to
5 entries. Even with the maximum 14-line Current State growth, the file projects to at most
**724 lines**, still below 800.

## Compaction/archive verdict

**No archive is required for this update.** The file is 106 lines below the whole-file trigger and
17 entries below the ledger trigger. Creating an archive now would be discretionary churn during a
live closeout, not protocol-required compaction.

Re-evaluate only after the actual edits: if the file unexpectedly exceeds 800 or the ledger exceeds
20, compact before any further touch by folding settled truth into Current State, moving superseded
detail to `docs/working/language-driven-flow-loop-plan/archive/YYYY-MM-DD-<topic>.md`, leaving a
one-line pointer, and recording the compaction. Never delete old run evidence.

## Safe edit order keyed to t321

1. Wait for run 3 and its bounded evidence review/debug to settle; resolve the t321 fact sheet.
2. Decide measurement class first: valid pass, valid product failure, or invalid
   facility/integrity/redaction attempt.
3. Rewrite latest-measurement and accounting paragraphs from verified facts.
4. Rewrite `What is proven` / next / blockers, including every material `NO EVIDENCE` gap.
5. Update attempt/build/pre-Flow counts and streak last, checking them against the chosen branch.
6. Append the final-local-validation and run-3 ledger entries.
7. Verify Current State <=149, whole file <800, ledger <20 entries, and no historical row changed.
8. Update `mvp-today-plan.md` from the same fact sheet, then perform the scoped working-index
   regeneration and validation described by t320/t323 only after both plans stop changing.

t324 opened no `test-runs` path and ran no check, test, build, provider, browser, Lab, or live
command. It changed no shared plan/archive/index, source, commit, or run state. This report is its
only write.
