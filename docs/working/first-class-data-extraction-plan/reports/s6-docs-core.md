# Report: s6-docs-core

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t290/!FluxIQ` (branch task/t290-read-list-s6-migration, HEAD `522584ed`).
No commits. Docs only; no source or test touched.

## Outcome

Done. Core's architecture docs now describe S1 (collection, run-end processing) and S2 (do-while repeat, Repeat
node, dispatched `ended` route, build-test do-while walk). S3 is described as not done wherever the docs touch the
build test's stores, the read account's paging, the refuted-result brief and the rerun-input example. References
regenerated.

## What changed and why (per file)

The design's 6.6 line numbers had drifted; I placed edits by content.

- `docs/architecture/automation-studio/flow-authoring.md`
  - The Walker: new "Do-while spans" bullet (plan from routing, pass by pass, `core.replay.ended` on the last member
    ends the loop, `ended` elsewhere reads as failed, a verify-only last member runs once); "The bound" now gives the
    do-while bound (`most`, else Repeat's default 50; reaching it is not a failure). Checked against
    `runtime/llm/node-tools/replay-span.ts` header and lines 405-445.
  - New section "A list that continues" (after "Removing an accidental row repeat"): read reads one page; read, Next
    page (`web.output.dom-next_page`, success/failed/ended), `repeat {while, most?}`; parse rules
    (`evidence-loop-decision.ts:558-576`); routing (`flow-draft/routing.ts`); assembly graph and refusals
    (`draft-routing.ts:121,242-362`); Repeat node (`nodes/control-flow/repeat.ts`); allowance and progress mark
    (`graph-run.ts:231`, `progress-guard.ts:12`); dispatched route (`io-policy.ts:128-135`, node-execution:169);
    read-back; collection (`assembled-record-output.ts`, `record-output.ts:215-220`, writeMode default append
    `record-output.ts:115`).
  - "Paging Evidence Sent To The Result Judge": a lead paragraph saying it describes today's read account and that S3
    (not done) retires that paging.
- `docs/architecture/automation-studio-native-nodes.md`
  - The candidate `recordOutput` paragraph: parse keeps `process` and refuses unknown keys (`parse-output.ts:16,48`).
  - New section "Record outputs and run-end processing": append/replace and batches (`run-dataset-store.ts:150-200`),
    one schema and one `process` per dataset per run, per-step dataset ids; run-end processing
    (`run-datasets.ts:110-120`, `service.ts:2550,2744`) through `processAutomationStudioRecordRows` in
    where -> dedupe -> sort -> limit -> columns order, default whole-row dedupe with layout/case ignored and first kept
    (`process-rows.ts`, `row-identity.ts`), limits (`processing-vocabulary.ts`), storage and readers
    (`run-dataset-store.ts:245-300,515,590`; judges via `run-outcome.ts:611` `readRecordSets` -> `getPage`);
    the account shape (`process/types.ts`); "Not yet": build test does not process (S3).
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  - `buildTest.stores` paragraph: per-step datasets since S1; counts are collected rows, not the answer; judges at
    run time read the answer; S3 makes the build test process. Also states the gap below (Repeat node unknown to
    `stores.ts`).
  - Refuted-result brief paragraph: the brief's page wording, "a pagination setting" (`brief.ts:83`) and the
    `maxPages` rerun-input example (`rerun-input.ts:97,106`) still assume a paging read; S3 changes them.
  - "A repeat is run once per row..." sentence gains the do-while case.
  - Line ~794 ("every page of results") left: it quotes a past live instruction, not a claim about the read.
- `docs/architecture/package-boundaries.md`
  - New migration note "Next minor (unreleased): a read collects, a do-while repeat pages, and each dataset is
    processed at run end" (Added / Changed / Not yet S3). The design's `:294` now points into an unrelated entry
    (result-summary caps), so nothing there was stale. Names verified against source and the regenerated reference.
- `docs/reference/framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md`: regenerated with
  `node scripts/docs-reference.mjs` (3201 public declarations); they were already stale before my edits (source drift
  from S1/S2 and later merges), so the diff is source-line moves and new exports, not doc text.

## Commands run and observed results

All from the Core root.
- `node scripts/docs-reference.mjs --check` (before) -> "docs/reference/framework-reference.md is stale", exit 1, 15.6 s.
- `node scripts/docs-reference.mjs` -> "Wrote docs/reference/framework-reference.md and
  packages/fluxiq/docs/reference/framework-reference.md (3201 public declarations).", exit 0.
- `node scripts/docs-reference.mjs --check` (after edits) -> "Deterministic framework reference is current."
- `node scripts/build-cache/cli.mjs structure-audit:check` -> "structure-audit: passed (272 warning(s), 349
  baselined).", exit 0.
- `node scripts/structure-audit.mjs --rule docs-links` -> "passed (0 warning(s), 0 baselined)", exit 0.
- `git diff --stat` -> only the 4 architecture docs and the 2 reference files (6 files, +699 -439).

## Not verified

- Whether the docs-links rule checks `#anchor` fragments; I matched the new anchors to heading slugs by hand
  (`#a-list-that-continues`, `#record-outputs-and-run-end-processing`, `#generation-command`, `#the-walker`).
- No tests run (docs-only change).

## Open questions or contradictions found

1. Code defect for S3 (not fixed, not my file): `runtime/result-verification/build-test/stores.ts:46` `ROUTING_NODES`
   lists Merge and For Each only. A do-while puts `builtin.control.repeat` between the loop Merge and the read, so the
   node walk at :130 stops there and `buildTest.stores` finds no writing step from the first do-while on. I documented
   this as a current gap in llm-flow-bootstrap.md; S3 should add the Repeat id (or share draft-from-flow's framing
   list).
2. The brief says reaching `most` "ends the loop reported as incomplete". The code does not say incomplete: the Repeat
   node routes `done` as a success with the message "The loop reached its most passes (N) and ends here."
   (`repeat.ts:81`), and the walker treats it as no failure. I documented what the code does.
3. `docs/architecture/automation-studio.md:600-610` (outside my owned set) describes repeat assembly through For
   Each only; it is incomplete rather than wrong. Worth one sentence pointing at flow-authoring.md "A list that
   continues".

Outcome: Done
