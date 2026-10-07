# Report: s6-migration (lead, stage S6 of the read-list redesign)

Trees: `C:/Users/osrs_/FluxStuff/fxwork/t290/` (both repos, branch `task/t290-read-list-s6-migration`; downstream at
`cc99f7f2`, Core at `522584ed`). Design: `read-list-collect-design.md` sections (6) and (7), row S6. Nothing committed.

## Current State

- 2026-10-06: S6 is done in the tree, uncommitted:
  - recording-lane exclusion;
  - the collected count in extraction measurements;
  - Lab oracle comments;
  - downstream and Core docs;
  - the 9 e2e specs the redesign broke;
  - GAP N1, a Next page defect, fixed;
  - the Next page spec's flake fixed.
- Changed tests pass. Checks and both audits exit 0.
- The 14 paging content specs: 87 of 88 passed before the flake fix. The Next page spec then passed 12 of 12.
- Not done here, owned elsewhere: S3 (build test and judges, t286's `R/result-verification/**`), and S7.

## What changed and why

### 1. A paged recording step is excluded, never mis-recorded

FluxIQ's read reads one page, and a Flow pages with read + Next page + repeat. No recording can produce that loop.
Before S6, `extract-intent.ts` still mapped a step's `pagination` to the recorded `paginate`. The domain now refuses
that as `paginate_retired`, or drops `maxPages: 1`, so the recording would have measured a one-page read.

- New `packages/test-contracts/src/lane-exclusion/` (`flow-lane-exclusion.ts` moved here from `src/`,
  `paged-extract-exclusion.ts` new, `index.ts` barrel). `test-contracts/src` held 25 files, its budget, so a
  directory was the only way to add one.
  - `pagedExtractExclusion(script)` names every paged extract step and says why.
  - `flowLaneExclusion` excludes a script with a paged extract step, with that reason.
- `packages/test-runner/src/scenario-steps/extract-intent.ts`:
  - the `paginationFor` mapping is gone;
  - a paged step throws `fixture.invalid` "The recording lane does not record extract step <id>: ..." before
    anything is sent.
- `packages/test-runner/src/bench/expand-corpus.ts` gains `laneExclusion`:
  - the recording lane skips a paged workflow with the same reason;
  - the Flow lane keeps `flowLaneExclusion`;
  - week1 now plans 62 runnable results, down from 67. Skipped: W05 unarmed on both lanes, W05 `short-catalog` on the
    Flow lane, and W07 unarmed on both lanes.
- Comments brought up to date: `recordable-actions.ts` and `scenario.ts`. A step's `pagination` is now Lab data only:
  the reference reader and the oracle use it, and FluxIQ never receives it.
- Fail-first:
  - `flow-lane-exclusion.test.mjs`: `not ok 5` before the change, then 7/7;
  - `extract-intent.test.ts`: `not ok 6`, `not ok 7` before (the old code returned a `paginate` request), then pass;
  - `week1-corpus.test.ts` rewritten to name the five skipped results and their reason.

### 2. Extraction metrics count the collected rows and the processed answer

Core S1 serves each dataset's answer once it is processed, and its summary carries a `processing` account. The
Flow lane already judged the answer. It did not say what the passes had collected.

- `flow-lane/run-datasets.ts`: `RunDatasetSummary.processing?` holds `{collected, duplicates, filteredOut, cut,
  passes}`. It carries counts only. A malformed account or an unprocessed dataset gives none.
- `flow-lane/expectations.ts` and `run-expectations/extraction/judgement.ts`: the observed extraction and the
  measurement carry `collectedRecords` when a processing account exists.
- `test-contracts`:
  - `RunExtractionMeasurement.collectedRecords?`: optional, validated, never fewer than `observedRecords`. No
    legacy normalisation is needed;
  - `BenchExtractionMetrics.collection?` holds `{steps, collectedRecords, answerRecords}`. Validation:
    `answerRecords <= collectedRecords` and `steps <= judgedSteps`.
- `bench/extraction-metrics.ts` pools the collection over judged steps that stated it. `render-markdown.ts` prints it
  after the basis sentence. `evaluate-run.ts` updates the Flow-lane source sentence.
- `paginationAccuracy` is unchanged. It stays a recording-lane measure, and no recording-lane step pages now, so it
  publishes no rate.
  - Core's `passes` were not used as pages: a page whose read kept no row stores no batch, so the pass count would
    understate pages.
  - S7 decides whether to retire the metric.
- Fail-first: five new tests (evaluation contract, bench contract, metrics, run-datasets, Flow-lane judgement). All
  five were `not ok` before the source change and pass after it.

### 3. Lab tasks and fixtures

- No Lab task or fixture depends on the read paging by itself any more:
  - live tasks are language; the model builds the loop (instructions `web-5`, S4);
  - their oracles are workflow expectations, unchanged.
- Lane C's oracle, computed from the built Lab (not quoted): `extract-plus-under-fifty` holds count 13, 13 records and
  52 fields, ordered, with no `pages` member. The step keeps its `pagination` as Lab data.
- `everything-store/workflows/plus-under-fifty.ts`: the comment now names the Flow the redesign expects (see "Lane C
  live proof").
- Recorded paged workflows are "marked as needing a rebuild" by the exclusion, with a reason that says why: W05, W07
  and the other paged catalog workflows `numbered-pages`, `link-pagination`, `extract-until-end` and
  `extract-by-load-more`. Each comes back when a recording can produce a loop.
- Not changed, with reasons:
  - `apps/scenario-lab/e2e/product-catalog.spec.ts` reads with the Lab's own Playwright reader, not FluxIQ.
  - The creation lane's comments (`flow-lane/creation/{authored-nodes,lane,snapshot}.ts`) are history. Its
    `authoredNodes` already records every node, so it covers Next page and Repeat. That directory is t289's.

### 4. Docs

- Downstream (worker, report `s6-docs-downstream.md`): `docs/architecture/{build-loop,web-capabilities,
  extension-client,testing-facility,page-evidence}.md`.
  - The lead verified the code claims: `retired-paging.ts`, `next-page-slot.ts`, `nextPageNote`, `web-5` and the
    replay-span do-while all exist as described.
  - The lead added the `collectedRecords` / `collection` paragraph to testing-facility.md.
- Core (worker, report `s6-docs-core.md`):
  - `docs/architecture/automation-studio/{flow-authoring,llm-flow-bootstrap}.md`,
    `automation-studio-native-nodes.md`, `package-boundaries.md`;
  - both `framework-reference.md` regenerated by `node scripts/docs-reference.mjs` (`--check`: current);
  - the lead added one sentence on do-while assembly to `docs/architecture/automation-studio.md`, checked against
    `nodes/control-flow/repeat.ts` and `draft-routing.ts`.

### 5. The affected e2e specs, and a Next page defect they exposed (GAP N1)

The 14 content specs that page were run on this tree (headless Chromium content harness; no Lab, no provider). Before
S6, 19 of 87 tests failed. A worker-high traced each one (report `s6-e2e-specs.md`), and the lead checked the
commits it cites:

- **15 tests, read-list S4 working as designed.** Handle-form reads still wrote `paginate`, mostly `paginate: false`,
  and are now refused `malformed_handle`. The spec changes:
  - the `paginate` key is dropped from those reads;
  - professional-network's "every page" test now runs read, Next page, read, Next page, read through the evidence
    runtime;
  - the old page-bound test (G2) now asserts the refusal;
  - the kestrel keyword-route test asserts the packet's `nextPageNote` and one page read.
- **4 tests, spec drift from intended earlier commits:**
  - `326ad350`: the page-bound sentence was reworded;
  - `b05e186b`: detected column labels now quote a sample;
  - `c8be5125`: a stored condition names a kept column by its key.
- **1 test, a product defect (GAP N1).** It was introduced by `3ac340bc` (S4+S5) in
  `apps/extension/src/content/extraction/page-advance/follow-next.ts`.
  - On the last page, a script Next (no address, or leading back to this page) stays enabled. The pager marks the
    current page and shows no page after it.
  - Next page pressed that Next anyway and answered `moved`, so a read + Next page loop on professional-network went
    2, 3, 2, 3. The old paged read caught this with `page_repeated`; a Next page step keeps no history.
  - The lead fixed it: that case now answers `ended no_following_page` and presses nothing.
  - Fail-first: a `lastNext: "enabled"` style was added to `content/extraction/tests/store-pager.ts`, and a new test
    in `page-advance/tests/move-page.test.ts` was `not ok 4` before the fix. After it, 358/358 tests passed across
    `content/extraction/**/tests` and `content/actions/tests`.
  - The worker's `test.fail` row in the professional-network spec is now a plain test.
  - **Ownership:** this is extension source outside S6's named files. No running stream owns `page-advance/**`. The
    supervisor should confirm before merging.
- Left for S7: the content `pagingAccount` sentences still say "rerun with `paginate.maxPages`"
  (`content/actions/extract-list.ts:378-398`). Only a request carrying `paginate` sets `paginationStop`, and the
  domain sends none since S4, so no build sees them. The specs that page straight through the content script still
  pass.

## Validation (lead, observed)

- test-contracts, after `pnpm.cmd run build`: `node --test tests/*.test.mjs` gave `# tests 165 # pass 165 # fail 0`.
- test-runner, after `pnpm.cmd run build`, `node --test` over `dist/{bench,flow-lane,scenario-steps,
  run-expectations/extraction,run-evaluation}/tests/*.test.js`: `# tests 560 # pass 560 # fail 0`.
- `pnpm.cmd run check` exited 0 in test-contracts, test-runner and scenario-lab.
- Downstream `node scripts/structure-audit.mjs`: `passed (176 warning(s), 118 baselined)`, exit 0.
  - New advisory warning: `tests/bench-report-contracts.test.mjs` went from 400 to 411 lines.
  - Already past 400 before S6: `evaluation-validation.ts` (408 to 415 lines) and `scenario.ts` (590 to 597 lines).
- Core `node scripts/build-cache/cli.mjs structure-audit:check`: `passed (272 warning(s), 349 baselined)`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 0.
- Extension unit tests, through `run-subset.mjs` with label `s6-lead`, over `content/extraction/**/tests` and
  `content/actions/tests`: `# tests 358 # pass 358 # fail 0`.
- e2e, from `apps/extension`, with the 14 paging specs (the 9 fixed plus everything-store-next-page,
  extract-list-continuation, pagination-stop, structure-detection and local-classifieds-bike-search):
  `pnpm.cmd run test:content -- <14 specs> --reporter=line`.
  - Before S6: `19 failed, 68 passed`.
  - After the spec fixes and GAP N1: `1 failed, 87 passed (4.8m)`. The failure was the Next page spec's flake.
  - The flake was the spec's stand-in for the worker. After a lost reply it called `waitForLoadState("load")`,
    which can still return for the old document, so the delivery died with "Execution context was destroyed".
    Now it retries only that error, after the next load, at most 5 times.
  - Before the flake fix: `--repeat-each=4` gave `2 failed, 6 passed`. After it: `--repeat-each=6` gave
    `12 passed (2.2m)`.

## What S7 (retiring the read's own paging) must remove, after the lane C live proof

Design 6.5, plus what S4-S6 found:

- **Extension:**
  - the paged loop, checkpoint and resume in `content/extraction/list-reader.ts`;
  - `content/extraction/continued-read/**` and `content/action-runtime/extraction-continuation.ts`;
  - the read-only parts of `runtime/extract-list-continuation.ts` (Next page reuses its resend);
  - the re-exports `pagination.ts` keeps for the loop;
  - `content/action-runtime/results.ts` `soughtSelector`, which does not know `nextPage.item` (S45 note);
  - the paging account and "rerun with paginate" advice in `content/actions/extract-list.ts`;
  - `recovery/fault.ts` treating a paginated read as impure.
- **Extension tests and e2e:**
  - unit: `extract-list-paging-account`, `pagination`, `detect-pagination` and `list-reader` paging cases;
  - e2e specs that send `paginate` straight to the content harness: `extract-list-{pagination,catalog,continuation}`,
    `pagination-stop`, `item-conditions`, `job-board-listing`, `list-completeness`, `structure-detection`,
    `everything-store-cart-names`, and the live-task specs `auction-marketplace-kestrel-auctions`,
    `crossborder-marketplace-spain-hubs`, `local-classifieds-bike-search` and
    `professional-network-rotterdam-data-engineers`;
  - each moves to read + Next page or is deleted.
- **Domain:**
  - `paginate` in `actions/extraction/request.ts`, `paginationValue` in `read-request.ts`, `schema.ts` `paginate`;
  - `slot.ts` `keptPagination`, `everyPage` and `liftedBounds`;
  - the paginate issues in `issues.ts`;
  - page-timeout scaling: `request.ts`, `dispatch.ts`, and `web-panel-host.ts:198`, which still scales a recorded
    multi-page definition's timeout;
  - `paginationStop` moves to Next page's answer;
  - the `retired-paging.ts` refusal stays as long as stored Flows may carry `paginate`.
- **Core:**
  - read-account paging: `accounts.ts`, `judge-paging.ts`, `pages-clause.ts`, `stop.ts`, `page-bound-sentence.ts`;
  - "page through" in `activity/wording/person-words.ts`;
  - the stale `marketing-demo.ts:58`.
- **Lab:**
  - decide `paginationAccuracy`: retire it, or redefine it once a page loop can be recorded;
  - the recording-lane exclusion stays until the recorder can produce a loop.
- **Tests:** each stage moves or deletes the tests its files own (design: about 19 extension unit, 14 e2e, 32
  domain and 35 Core test files).

## Found for S3 (not S6's files)

`R/result-verification/build-test/stores.ts:46` is a blocker for the live proof. `ROUTING_NODES` holds Merge and For
Each but not `builtin.control.repeat`. So `buildTest.stores` loses track of the writing step from the first do-while
on (Core docs worker's finding; the lead confirmed the set). S3, owned by t286, must add it. S3 must also process the
replayed rows (S1 report).

## Lane C live proof

Prerequisites (memory: live runs wait for all agreed changes):
1. S3 is merged, including the `ROUTING_NODES` fix.
2. S6 is merged.
3. The lane C tree `fxwork/t274` (both repos) is synced to dev and rebuilt.
4. The run is off-peak.

Command, from `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQWebExtension`, dry run first:

```
FLUXIQ_LAB_INSTANCE=t274-slot-1 FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t274-c pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --dry-run --max-attempts 1
FLUXIQ_LAB_INSTANCE=t274-slot-1 FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t274-c pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --max-attempts 1
```

Expected results:
- **Flow:**
  1. navigate;
  2. Decline (optional);
  3. Not now (optional);
  4. type "wireless earbuds";
  5. read with `where` (sponsored absent, Plus present, rating at least 4, price under 50, accessories out);
  6. Next page (`nextPage: {list}`);
  7. `repeat` on the read through Next page while it succeeds.
- **Build test:** 5 passes, `core.replay.ended` on page 5, `stores` with the collected rows and the duplicates
  removed, an answer of 13.
- **Run:** the dataset `processing` holds about 17 collected and 4 duplicates.
  - The Lab measurement carries `collectedRecords`, with `observedRecords` 13.
- **Lab verdict:** `passed`, 13 ordered records and 52 fields.

### What the UI review must see

- The pass cards name the page ("Reading page 3", or the Next page card per pass).
- The loop's end reads that the list ended after 5 pages.
- No internal word appears ("paginate", "paginate_retired", `ended` as a code, "Repeat" node ids).
- Read cards show their counts; a page whose read kept nothing is not shown as a failure.
- The ending names the 13 rows, not the collected count.
- The pass and "list ended" activity words depend on S3 and on the activity owner (t288 `R/activity/**`). If they
  have not landed, report their absence as open, not as a regression.

## Not verified

- No Lab, live, browser-with-extension or provider run. The lane C proof waits on S3.
- No Lab dry run in this tree. It would rebuild the extension while the e2e run was reading it, and the live proof
  runs from the lane C tree anyway.
- Firefox.
- The build-test side of the collection (S3).
- Full suites (per AGENTS.md).

## Work Ledger

### 2026-10-06 - S6 implemented and verified by the lead
- Parts 1-3 and GAP N1 by the lead. Docs by two workers and the e2e specs by a worker-high; the lead verified each.
  Validation is as above.
- The 14-spec suite was not rerun after the flake fix. The fix touches only the Next page spec, which was then run
  12 times.
