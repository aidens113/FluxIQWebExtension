# Brief t1048: the judge and the decider see every read's rows

**Goal.** Fix t1044's two main causes. Read `docs/working/page-diff-delivery-plan/reports/t1044.md` in full; its
"Open questions" section holds the patch plan, file by file. Run `run-mwvgjb8c` (Sonnet, bigbox) gave a wrong
answer that the judge accepted:
1. **Judge.** A draft read that is not the answer reaches the judge as a count only
   (`answer-first/result-feed/feed.ts:269`, `{step, position, listKey, kept}`), while a look goes with its rows.
   Page 1's qualifying row was in none of the judge's evidence. Working reads must carry their rows to the judge:
   `result-feed/feed.ts`, `result-feed/read-evidence.ts`, `result-verification/result-evidence/types.ts:61`,
   `result-evidence/from-batches.ts:29`, and the window fitting (`flow-less/window-fitting.ts:84`) beside looks.
2. **Decider.** Every read shares one held group, `holder:read`, in `runtime/llm/decision-context/current-view.ts:28`.
   So the second read evicted the first read's rows from the model's view. Give each read its own group, keyed by
   the read's stored list identity or handle, never by the model's `tN`. Every read that ran stays in view until
   the run replaces that same list's read.

**Rules.**
- Page data in one request stays within the existing page budget (D-rules in
  `docs/working/page-diff-delivery-plan.md`). Where the window fitting must leave rows out, it says so in the
  request in plain words. It never drops them silently. Add no new count or cap.
- Model-facing words stay generic: no site, scenario, product or task named (AGENTS.md, "Model guidance never
  teaches to the test").

**Proof.** Add provider-free tests that fail before the fix:
- a judge request built from two reads (the t1044 shape: page 1 holds the qualifying row, page 2 does not)
  carries both reads' rows;
- the decider's view after two reads holds both lists' rows;
- a re-read of the same list replaces only that list's rows.
Then add a test from t1044's recorded judge request, if the report's recording is reachable.

**Owned paths (Core, `--core` task).** `framework/automation-service/service/answer-first/result-feed/**`,
`answer-first/flow-less/window-fitting.ts`, `runtime/result-verification/result-evidence/**`,
`runtime/llm/decision-context/current-view.ts` and its `tests/`, the tests beside each, and
`docs/architecture/` lines that describe what the judge or the decider is shown.
**Must not touch.** `runtime/llm/evidence-loop*`, `decision-handlers/**`, `evidence-progress/**`,
`loop-configuration.ts`, `loop-limits/**`, `adaptation/recovery/**`, `agents/progress/**`,
`flow-authoring/**`, `result-verification/cited-yes/**`, `answer-first/tests/{second-attempt-proof,later-attempt}*`.
These are other tasks' files. No git, no paid or Lab runs, no `node -e`.

**Checks (heavy gate for test runs).**
- `pnpm --filter fluxiq check`.
- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first src/runtime/result-verification src/runtime/llm/decision-context`.
- Core `node scripts/structure-audit.mjs`.
- Downstream `node scripts/check/model-text.mjs`.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1048.md`, ending with the return contract.
