# t796 / w3-repeat-order: Core orders the rows a repeat walks

## Outcome

Done. When a `repeat over` reads from a listing whose node answers `page_order` and the listing has its own sort (`extractList.sort`), the For Each now gets that sort as its new `order` option. It sorts its rows and then applies `repeat most` (`stopAfter`). So "the N most recent" is written as a sort plus `repeat most: N`. The listing rule no longer refuses that sort. Where the rule still refuses, the message names the key the model actually wrote.

## Design

- **For Each `order`** (`nodes/control-flow/for-each.ts`). The new `order` parameter (`valueType: "array"`, `allowStateBinding: false`, no default) takes a list of `{field, order: asc|desc, as?: auto|number|date|text}`. That is the record process's own sort shape.
  - It is applied on the first pass with `sortAutomationStudioRecordRows`, reached through `nodes/record-process.ts`, before `stopAfter` and before the `maxIterations` check.
  - The sort is stable. Rows the sort cannot read go last. An item that is not an object reads as a row with no fields. Items keep their identity (they are passed by reference).
  - Unset, null or `[]` keeps the list's own order, so saved Flows are unchanged.
  - A malformed key fails before the first pass with `for_each.order_invalid` (graph_validation_or_unknown_node), so the loop never walks rows in an order nobody wrote.
- **Lowering**:
  - `script-statements/repeat-order.ts` exports `automationStudioFlowPlanRepeatOrder({plan, registry, resolution})`. It runs on the assembled plan.
  - For each For Each whose `items` edge comes from a listing that declares `answersRows: "page_order"` and holds a sort at its declared `recordProcessWrittenAt.sort` path, it sets `order` to that sort. A single key object becomes a list of one.
  - It is wired in `authoring/assemble.ts`. Script and draft both go through it: the draft door is covered by the test.
  - The listing keeps its sort, so the saved answer is in the same order as the rows the repeat walked. With a limit of the same N, the saved rows are exactly the acted rows.
  - Left alone:
    - a For Each that already holds `order`;
    - a listing that does not declare page order;
    - a sort written only in `recordOutput.process`. The format still says that sort only orders the saved answer, and this keeps that sentence true.
- **Shared reader**. `script-statements/listing-repeat-sort.ts` (`automationStudioListingRepeatSort`) is the one reader of "the sort a page-order listing hands a repeat". Both the lowering and the rule use it. It is not exported from the barrel, the same way `loop-body.ts` is not.
- **The rule** (`script-statements/listing-order-in-repeat.ts`). On a page-order listing:
  - The listing's own sort is admitted when every lasting For Each it feeds carries an equal `order`.
  - If a lasting For Each does not carry it, the sort is refused at the path written (`extractList.sort`). The message never mentions `recordOutput.process`. The `instead` says to use `repeat over:` and that Core orders the rows.
  - A sort only in the process is refused at `recordOutput.process.sort`. Its `instead` puts the order on `extractList.sort` (the declared path) and says to take the process sort out.
  - A limit beside an applied sort follows the existing rule: equal to `repeat most`, with no process where. If refused, the `instead` names the sort's order and the limit of N, and no longer says to take the sort out.
  - A limit with no sort keeps today's rule.
  - The non-page-order (t741) branch keeps its `INSTEAD`. Its message is now built from `writtenPath` instead of the shared `MESSAGE` constant, which has been removed.
- **Script format** (`plan/flow-script-format.ts`):
  - The sort sentence (~line 436) now says Core hands the repeat its rows in the listing's sort, unreadable rows last, before `repeat most`, whatever order the page shows. It also says never to stand in for an order with a where that copies a value out of an answer, and to give the listing a limit of the same N to save only the acted rows.
  - The page-order "nothing reorders them" clause is gone.
  - There is a new t796 paragraph in the doc comment.
  - Line 431 and the `only after` paragraph are untouched.
- **Judgement calls**:
  1. The sort is copied onto the For Each and kept on the listing, rather than moved. Moving it would leave the saved answer in page order, so a limit of N would save different rows than the repeat acted on.
  2. The lowering applies to every For Each over such a listing, not only lasting ones. The sort means the same thing for a read-only repeat, and the rule only judges lasting ones.
  3. The optional span-level `repeat order:` was not done. It needs `authoring/parse.ts`, which I do not own.
  4. The lowering lives in `script-statements/`, not `authoring/`. Adding it to `authoring/` pushed that directory to 26 source files, and the structure audit fails above 25. `script-statements/` is now at 25.

## Files

- Changed:
  - `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/for-each.ts`
  - `.../nodes/control-flow/tests/for-each.test.ts`
  - `.../runtime/flow-bootstrap/script-statements/listing-order-in-repeat.ts`
  - `.../script-statements/tests/listing-order-in-repeat.test.ts`
  - `.../script-statements/index.ts` (exports `repeat-order.ts`)
  - `.../authoring/assemble.ts`: the lowering call, with the plan literal passed in place. Net zero lines, so it stays at 800.
  - `.../plan/flow-script-format.ts`
  - `.../plan/tests/loop-format.test.ts`
- New:
  - `.../script-statements/repeat-order.ts`
  - `.../script-statements/listing-repeat-sort.ts`
  - `.../script-statements/tests/repeat-order.test.ts`
- Regenerated with `pnpm docs:reference`:
  - `docs/reference/framework-reference.md`
  - `packages/fluxiq/docs/reference/framework-reference.md`

  The `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT` summary changed. The run was over the shared tree, so these files also picked up rows from other workers' changes that were still in flight (trial-change acts, left-told). Regenerate them after integrating all workers.
- `authoring/draft-routing.ts`: not changed.

## Fail-first evidence

- Run 1: `pnpm test` on for-each, listing-order, repeat-order, before any implementation.
  - for-each: 8 failed. Examples: "declares order as a list Core writes" got `undefined`; "orders the items by the key, then stops after the first N" got `['Featured Atlas', …]` but wanted `['Quiet Orchard', …]`; the five `order_invalid` cases got `success`.
  - repeat-order.test: "Failed to load url ../repeat-order.ts".
  - listing-order.test had a syntax slip in my test (a literal newline in `join("\n")`). I fixed it and re-ran.
- Run 2: listing-order alone, with for-each, the helper and the lowering module present but not yet wired, and the rule unchanged. 6 failed / 9 passed. Examples:
  - "admits the listing's own sort…": expected `[]`, got an error issue.
  - "refuses the listing's sort a repeat is not handed…": message did not contain `` `extractList.sort` ``.
  - "refuses a sort written only in recordOutput.process…": message did not contain `` `recordOutput.process.sort` ``.
  - **"a sort on a page-order listing feeding a lasting repeat is applied by Core before the loop"**: For Each parameters lacked `order`.

## Test lines (new or changed)

- `nodes/control-flow/tests/for-each.test.ts`, describe "its order option" (library catalogue: two featured books listed first, one undated):
  - declares order;
  - order then stopAfter: newest 3 = Quiet Orchard, Harbour Notes, North Ledger;
  - unreadable last, plus asc/auto/text/number;
  - unset/null/empty keep list order;
  - 5 `for_each.order_invalid` cases.
- `script-statements/tests/listing-order-in-repeat.test.ts`, page-order describe:
  - admits the listing's own sort handed to every lasting repeat, with or without limit == most;
  - refuses a sort that was not handed, at `extractList.sort`, never naming `recordOutput.process`; same for `extractList.maxItems`;
  - refuses a process-only sort, naming it, with an `instead` that points to `extractList.sort`;
  - refuses a limit beside an applied sort, keeping the sort;
  - applying the `instead` literally is admitted;
  - **"a sort on a page-order listing feeding a lasting repeat is applied by Core before the loop"**: script through `acceptAutomationStudioFlowBootstrapResult`; the For Each has `{stopAfter: 3, order: [published desc date]}`, and the rule returns `[]`.

  The old page-order sort tests that asserted "never a sort" were replaced.
- `script-statements/tests/repeat-order.test.ts`:
  - lowering on hand-built plans: copies the sort and leaves the listing as written; wraps a single key; leaves the plan the same object for a non-page-order node, no sort, `sort: []`, or a process-only sort; keeps an existing `order`;
  - draft door through `assembleAutomationStudioFlowDraftPlan`.
- `plan/tests/loop-format.test.ts`: "says Core orders a repeat's rows by the listing's sort, unreadable rows last, before repeat most". The existing t741 sentence test still passes, including its rule against wording from the realistic scenarios.

## Commands run and observed results

All runs were under `heavy-check.lock`. The lock was always released.

- Final `pnpm test` in packages/fluxiq on `nodes/control-flow`, `script-statements/tests`, `authoring/tests`, `plan/tests`, `harness-options/tests/listing-order-in-repeat-feedback.test.ts` and `candidate/tests/refusal-locator-corpus.test.ts`: **Test Files 64 passed (64), Tests 731 passed (731)**.
  - An earlier run had one failure, in `guarded-steps.test.ts`. That is another worker's fail-first test: I did not touch `guarded-steps.ts`. It passed in the final run.
- `tsc --noEmit -p tsconfig.json` in packages/fluxiq: exit 2, with one error only: `runtime/service/project-build-ending/tests/ending-truth.test.ts(91,124) TS2322`. That file is in `service/**`, which is not mine and is on my must-not-touch list. None of my files had errors.
- `node scripts/structure-audit.mjs`:
  - First run: 2 failures caused by me. `authoring/` had 26 files, over the 25 limit, and `assemble.ts` was 803 lines, over the 800 limit. Fixed by moving the module to `script-statements/` and adding zero net lines to `assemble.ts`.
  - Final run: **"structure-audit: passed (454 warning(s), 1152 baselined)."**
- `pnpm docs:reference`: "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (4278 public declarations)."

## Not verified

- No live or Lab run. I did not check that the web domain's records rows carry the sort field under the same id the sort names. They should: `records` are the schema-validated rows keyed by field id, and the process sort is checked against the same schema.
- The JSON-plan path (`json-plan.ts`) does not lower. A model-written JSON plan with `extractList.sort` over a lasting repeat would still be refused, with the "not handed" sentence, unless it sets the For Each `order` itself.
- `pnpm check`, `docs:check` and the full suites were not run.

## Open questions or contradictions found

- The brief allowed the lowering in `draft-routing.ts` or "a new authoring module". Because of the directory-file budget it lives in `script-statements/repeat-order.ts`, beside the rule it relaxes, and `assemble.ts` calls it.
- `docs/reference/*` was regenerated from the shared tree and carries other workers' rows too. The lead should regenerate at integration.
- `repeat order:` at span level is still to do. It would need `authoring/parse.ts` and the repeat contracts.
