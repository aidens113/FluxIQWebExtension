# Diagnosing the extract lane, 2026-09-24

Every finding of the day, in the order it was found, including the three
pagination theories that were wrong and how each was killed. Compacted out of
the plan when it passed 800 lines; `Current State` carries the conclusions.

- **A single lane run cannot tell a fix from noise, and the pass count hid it.**
  Two full lanes either side of four fixes both read 11 of 19, which looks like
  no movement. Task by task it is 9 stable passes, 6 stable failures and **4
  tasks that flipped** - two each way. The two the subflow fix targeted flipped
  to passing (`product-catalog-first-page-sparse-cards`,
  `admin-console-customer-book-short`); two that had passed flipped to failing
  (`product-catalog-first-page`, `sensitive-input-card-labels`). About one task
  in five changes verdict between identical runs, which matches
  `product-catalog-first-page` passing twice and failing once on unchanged code
  earlier. **Report the stable sets, not the count**, and get repeats before
  calling a fix proven.
- **What the nine stable passes actually are: one-node Flows.** Every one is a
  single `web.dom.extract_list` - the page is already the right page, so nothing
  navigates, searches, clicks or filters. The *pages* are hard and the
  extraction is correct to the field: `social-scheduler` 280 records and 1120
  fields all matched in 5 calls, `social-inbox` 25 and 125, `data-table` with
  its columns reordered, `product-catalog` with price and rating absent on some
  cards (`sparse-cards`), with the real image in `data-src` (`lazy-images`) and
  with prices reading "16.00 USD" (`text-variant`). The *tasks* are one step.
  Single-step extraction from difficult pages works; multi-step automation is
  what is still open, and `everything-store` - search, then filter, then
  extract - has still never produced a correct answer.
- **`data-table-inventory-large` passes on count, not on fields.** It reports
  1000 records with `presentFields: 0` and `matchedRecords: 0`, so the judge
  accepted it without comparing a single field. Until that is understood it
  should not be counted as a full pass.
- **The extract lane, all nineteen tasks: 11 passed, 8 failed, 0 no results.**
  Up from 4 of 11 before the pagination fix, and every task now produces a Flow.
  Passing includes `social-scheduler-whole-queue` at 280 records,
  `data-table-inventory-large` at 1000, and `sensitive-input-card-labels` and
  `social-inbox-first-screen`, which had produced nothing before. The eight
  failures reduce to four causes, not eight.
- **Four of the eight were one silent return.** `buildSubflow` ended
  `if (!nodes.length) return { issues }`, and when the model's node list was
  not under `nodes`, `steps` or `actions`, `issues` was empty - the subflow
  vanished with no reason recorded, and the caller reported "Bootstrap subflows
  must be an array" to a model that had written an array. Nothing in that
  sentence could be acted on, so the model wrote the same plan again:
  `data-table-inventory-empty` 24 times, `admin-console-customer-book-short` 16,
  `product-catalog-first-page-sparse-cards` 15, `company-directory-register-page`
  12 before dying after 44 provider calls. Three refusals now, because they are
  three different problems.
- **A refused attempt is no longer progress.** The loop cleared its no-progress
  count on a refused action, bounded instead by the action's signature - which
  catches an identical retry and not a model naming a different target each
  time. `company-directory-register-page` spent 31 of 45 build steps on
  `target_unobserved` that way. The repeat cache keeps its own rule; progress
  now asks whether anything happened.
- **A declared row count is read.** `admin-console-customer-book` returned 19 of
  240 from a virtualiser, over a viewport saying `aria-rowcount="240"`. The
  extension read only the ARIA feed pattern, which a grid does not use.
- **Still open: a column mapped to the wrong element**, on
  `property-listings-newest-homes` (address reads the listing URL, 10 rows, 0
  matching) and intermittently on `product-catalog` (rating read `$49.00`).
  Intermittent is the finding: earlier runs of the same task mapped it
  correctly, so this is model variance and wants a rate, not a single run.
- **The 23-record failure is fixed, and it took three wrong answers to find the
  right one.** The cause was that the grammar for `extractList` named `maxPages`
  and its ceiling and never said what the number does, so a model read it as a
  description of the page and wrote the count it could see. The proof is a pair,
  not an argument: "the products shown on the first page of the catalog" and
  "every product, across all of its pages" produced the *identical* authored
  node, `paginate: { maxPages: 3 }`, one failing at 23 of 8 and one passing at
  23 of 23. With the clause in - "maxPages/maxScrolls = pages to read, not pages
  present: read only the page shown unless asked for more" - the same pair
  produced `paginate: null` and `maxPages: 3`, 8 of 8 and 23 of 23. The clause
  needed room Core's 600-character parameter description did not have, and Core
  truncates rather than refusing, so the bound moved to 700 with it.
- **Three attempts missed first**, each diagnosed from record counts alone: the
  detector's page proposal, the worked example's `maxPages: 5`, and the node's
  own "across pages" description. None was the cause. What found it was
  recording the parameters the model actually wrote, then running the two
  opposite instructions as a pair - one run each, about a cent apiece. **The
  instrumentation should have come before the first fix, not after the third.**
- **The next cause on that task is already visible**, and it is the same one
  property-listings has: a column mapped to the wrong element. All 8 rows, all
  32 fields present, and `rating` reads `$49.00` where "4.6 out of 5" was
  expected; property-listings' `address` reads its listing URL. Two sites, one
  shape of error, and it is now the largest open failure in the extract lane.
- **Eleven tasks across six sites never measured before: 4 passed, 6 failed, 1
  no result.** Two of the failures are new causes, each diagnosed to the field.
  - `admin-console-customer-book`: expected 240, observed **19**, none matching,
    and the first row read `CUS-0005` where `CUS-0001` was expected. The console
    is a *virtualiser* (`apps/scenario-lab/src/scenarios/admin-console/virtual-list.ts`):
    a row outside the scroll band is removed from the document rather than
    hidden. So 19 is the window that happened to be mounted, read from wherever
    the list was standing - the Flow never scrolled. This is the opposite
    failure to product-catalog's: there a read took more than it was asked for,
    here it took a fraction, and both come down to a read's scope.
  - `property-listings-newest-homes` and its `agent-withheld` variant: 10
    expected, 10 observed, **0 matching**, and one field explains all ten - the
    `address` column carries
    `http://127.0.0.1:.../scenarios/property-listings/listings/hb-10258` where
    "Flat 5, 37 Saltmarsh Crescent, Ashcombe" was expected. The model mapped the
    column to the card's link rather than to its address text. Right rows, right
    count, one column pointed at the wrong thing.
  - Passing: `admin-console-customer-book-short` (12/12), `social-scheduler-whole-queue`
    (**280/280**), `data-table-inventory-large` (1000/1000) and
    `data-table-inventory-may-be-empty` (12/12).
  - No result: `data-table-inventory-empty`, `sensitive-input-card-labels` and
    `company-directory-register-page`, the last after 44 provider calls.
- **A falsifiable prediction about the 23-record failure, and where it comes
  from.** `domain/src/output-nodes/extract-list/catalog-text.ts` ends in
  `WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE`, the worked request the model is shown
  for `extract_list`. Its own doc calls it "a paginated product list", and it
  reads `{ item: "li.product", fields: {name, price, url}, where: [...],
  paginate: { mode: "next", next: "a.next", maxPages: 5 }, minItems: 1 }`.
  A model asked to scrape a product catalogue is shown an example of scraping a
  product catalogue across five pages.
  **The example cannot simply drop `paginate`.** Its own comment says why: Core
  reads a parameter's example as the declaration of which keys belong inside it
  (`flow-bootstrap/authoring/matching.ts`), so a key the example omits is a key
  the model is refused for writing. The key has to stay; it is the *value* that
  teaches five pages.
  **The prediction:** when `authoredNodes` lands, a failing `product-catalog`
  run's `extract_list` will carry `maxPages: 5`. Five is not a number reasoning
  produces from a three-page catalogue - it is the example's number - so finding
  it is conclusive, and not finding it kills this explanation as cleanly as the
  re-run killed the last one. No change to the example until the run says.
- **Before t119 merges, Core must export the screen the Lab needs.** Recording a
  Flow's authored parameters requires the same screening Core already does for a
  repair's step parameters, and `automationStudioScreenedNodeParameters` exists
  for exactly that - but it is unreachable from any public subpath, because
  `recovery/index.ts` never re-exports `repair-context/index.ts`. A one-line
  omission. The worker, correctly forbidden from editing Core, restated the
  screen instead: 198 lines against Core's 200, identical logic. That is a copy
  of Core in a downstream repository, which is the one thing that must not
  happen, so it is not merging in that shape. The sequence is: add the barrel
  line in Core, rebuild, import it in the Lab, delete the copy. It cannot be
  done while a campaign holds the main checkout, because a Core source edit
  stales Core's dist and the Lab refuses to run against it.
- **The pagination fix did not work, and the inference behind it was wrong.**
  Re-running all four failing `product-catalog` tasks against the merged fix,
  with `PROPOSED_MAX_PAGES = 1` confirmed present in the `dist/e2e-chromium`
  bundle the Lab loads: 0 passed, 4 failed, three of them the same
  `exp 8 obs 23 match 8`. The detector's proposal was never where the page
  budget came from. What the change is still right about - a detector reports
  how a list continues and does not decide how much of it to take - it is not a
  fix, and it was shipped as one.
  **What the code says instead.** `plan-resolution/extraction/slot.ts`
  `keptPagination` reads the model's `paginate`: `false` is the page shown,
  absent or `true` is the detected pagination, and an object supplies the
  model's own `maxPages`. With the proposal now at 1, absent and `true` both
  give eight records - so the model is writing an explicit number above one. It
  does not need to know the catalogue has three pages to do it: any `maxPages`
  greater than 1 follows Next until Next is gone, which is all 23. The packet
  tells it a pagination *mode* and an item count, never a page count.
  **This was diagnosed twice from record counts and got it wrong once, which is
  the argument for the instrumentation rather than for another guess.** No
  further pagination change until a run records what the model actually wrote.
- **The result check was wrong in both directions, in one campaign, and that
  now costs money.** `run-muezaeuk-5affbb6c` (`product-catalog-photos`) extracted
  the right dataset - the Lab's oracle passed it - and Core's own verification
  refuted it twice over, `does_not_answer` on both checks, 1,519 input tokens
  each. `run-mueyh9ey-5ce143dc` went the other way: 23 rows for a first-page
  request, and the verification answered `answers_request`. A false positive
  wastes a wrong answer; a false negative was harmless only while the repair
  could never start, and t117 changed that - a refuted result now reaches a
  repair, so a wrong refutation spends provider calls trying to fix a Flow that
  was already correct, and may damage it.
  **What is shown to the judge is not recorded anywhere**, which is why the
  mechanism is still open. `result-summary.ts` withholds a record set's
  `sampleRows` when they are absent, over the byte budget, or tripped by the
  evidence screen, and 1,519 tokens is consistent with a judge shown counts and
  column names and no rows at all. If that is what happened, the fix is not a
  better prompt: a check shown no rows cannot honestly answer "does not answer",
  and `unverifiable` already exists for exactly that. Confirming it needs the
  summary on the record, which is the same gap as the authored parameters and
  the packet composition.
- **A run does not record the parameters of the Flow it built.** `flow-lane.json`
  publishes `flowShape` and `actionTypes`, and no Flow document is persisted
  under `test-runs/`, so the pagination cause behind five of six failures on
  2026-09-24 had to be *inferred* from record counts rather than read from the
  node. The inference was solid - 23 is exactly the three-page catalogue, and
  the run that passed took 8 - but it should not have been an inference. A
  campaign that cannot say what the model actually wrote can only diagnose
  causes that happen to leave an arithmetic signature. Recording the authored
  parameters, screened the way the repair context already screens step
  parameters, is what would have answered it in one read.
- **`product-catalog-first-page` passed twice and failed once** on the same
  code, because the model sometimes copies the pagination proposal into the node
  and sometimes does not. Run-to-run variance of that size means a single run is
  not evidence about a task, and a pass rate needs repeats before it means
  anything.
