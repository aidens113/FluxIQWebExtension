# Debug: run-mvd8ypsv-32cde667

- Instance: bf-slot-1, task `bigbox-retail-rated-delivery-towels` (instruction reworded on dev `2485e450`: "that
  ValueRidge offers for Delivery to me (shipping or pickup alone does not count)"), authoring mode `project`
  (2026-10-18 UTC, downstream `48cdbfee` / Core `c1ed1bdd`, after integration round 1), lane tree `fxwork/t563`.
  Steps: 57. LLM calls: 27.
- Verdict: **failed** (`runtime.behavior`, reported `unverified`), but the Lab's oracle **passed**: 16 of 16 records,
  all in position, 48 of 48 fields; $0.028 of $0.25.
- How far it got: one brief; the builder ticked the site's Delivery filter, sorted by Highest rating and read both
  pages; subflow judges yes (0038-0043); the judged whole run stored exactly the oracle's 16 rows (0046-0055). Both
  whole-run judges said no (0056, 0057): condition 1 (`sponsored is absent`) "wrongly drops Tidemark Paper Towels, 12
  Mega Rolls".
- Why it failed: a judge-evidence trap. Core had settled the condition: `leftOutObservations` showed `value:
  Sponsored` for all five rows condition 1 alone left out, and `leftOutSettled` named all five, Tidemark included,
  with the sentence that each fails the condition as written. Beside it, `leftOutAlsoInResult` named four of the five
  ("another copy of the same item was kept, so that item is not missing"), and the judges read the one left
  unnamed as missing. Tidemark 12 Mega Rolls appears on the page only as a sponsored placement, so leaving it out is
  exactly what the request asks. Core `result-verification/request-rows/summary-with-also-in-result.ts` marks
  settled rows as also-in-result, and its sentence lets the judge infer the unmarked rows are missing.
- Fix 4 (Core): see the lane report's fix log.
- UI review: the chat's plan, step cards and "Check result: Passed" for the subflow trial read clearly; the final
  card says the result could not be verified, which matches the judges, not the result.
- Next: local-classifieds-test-ride-question while fix 4 is built; rerun this task on fix 4.
