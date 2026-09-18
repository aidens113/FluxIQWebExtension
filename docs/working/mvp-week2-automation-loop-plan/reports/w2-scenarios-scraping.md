# Two scraping fixtures: property-listings and company-directory

Two new scenario-lab fixtures for the FluxIQ corpus, both built so that every
workflow on them requires the product to build and run a real multi-step
automation. No refusal case was added. Every dataset but the two deliberately
empty searches expects records, and a unit test on each fixture asserts exactly
that, so neither fixture can ever be passed by collecting nothing.

## Outcome

Done. Both fixtures exist, are registered, are covered by their own unit tests
(24 tests, all passing), declare judgeable expectations, and carry 14 new live
instruction tasks and 2 new live repair tasks. The scenario-lab package's own
type check passes. Three test failures and two structure-audit failures remain
in the tree, and none of them is from this work — they come from four other
scenarios being written concurrently by other workers (see **Not verified**).

## `property-listings` — a property search portal

A portal called Harbourline Property with **288 homes** on the market, ten to a
page (29 pages unfiltered).

**Files.** `apps/scenario-lab/src/scenarios/property-listings/` with
`types.ts`, `listings.ts` (the market), `options.ts` (the four select option
lists), `format.ts`, `search.ts` (facets, ordering, paging, summary text),
`state.ts`, `markup.ts` (search panel and results fragment), `listing-page.ts`
(a home's own page), `client-script.ts`, `route.ts`, `records.ts` (expected
record builders), `manifest.ts`, `scenario.ts`, `index.ts`, and
`tests/scenario.test.ts`.

**What a results card carries**, all of it visible text under the design's own
class names — no card carries a `data-testid` at all:

| Field | Example | Notes |
| --- | --- | --- |
| price | `£340,000` | currency symbol, thousands separator |
| address | `Flat 5, 37 Saltmarsh Crescent, Ashcombe` | flats carry a flat number |
| bedrooms | `2 bedrooms` | singular for one |
| floorArea | `1,095 sq ft` | **absent on ~10% of homes** |
| agent | `Ashdown & Vale` | under a visible `Agent` label |
| listed | `Today`, `3 days ago`, `2 weeks ago`, `1 month ago` | a date given as an age |

**Facets** (all applied when Search is pressed, as a portal does): Area (five
neighbourhoods), Bedrooms (1–5, the last being "5 or more"), Price (four
bands), "New this week", and a Sort order (most recent, price ascending, price
descending).

**A home's own page** adds three facts that appear on no card: **Tenure**
(Freehold/Leasehold, derived from the property type), **Council tax** band, and
**EPC rating**, in a `dl` under visible `dt` labels, plus the local authority
and a description.

**Deliberate incompleteness.** Two independent kinds:

- ~29 of 288 homes publish no floor area. The element is **absent**, not empty,
  so the field reads as no value. Three of the ten homes on the opening page
  are such homes.
- 28 homes are new builds, which have no council tax band until first
  occupied, so that row is **absent** from the key facts. The third home the
  per-row sweep opens is one of them, so one judged detail record has
  `councilTax: null`.

Every expectation that can meet a missing value declares it as `null` in
`records` and names the field in `optionalFields`; a test asserts no record
anywhere holds `""`.

**The empty answer.** Prices are built so a five-bedroom home starts above
£430,000 in every area. "Five or more bedrooms, up to £250,000" therefore
matches nobody *by construction*, not by coincidence, and the `no-matches`
workflow declares `count: 0`, `records: []` and `minItems: 0`.

### Workflows (6)

| Workflow | Dataset | What it requires |
| --- | --- | --- |
| primary `extract-newest-homes` | 10 records, 1 page | read the opening page of results |
| `area-search` → `extract-area-homes` | **57 records over 6 pages** | select Kelford, press Search, follow Next to the end |
| `no-matches` → `extract-no-matches` | 0 records | two selects, Search, report nothing |
| `cheapest-match` → `extract-cheapest-home` | 1 record | three selects, Search, take the first result |
| `listing-detail` → `extract-home-facts` | 1 record | the above, then open the home and read facts only its page has |
| `detail-sweep` → three datasets | 1 record each | **per-row navigation**: open home 1, read, back, home 2, read, back, home 3, read, back |

Pagination is genuine: Kelford's 57 matches are 6 pages, and the read ends only
when the Next control is gone. The final state pins `Page 6 of 6` and the
absence of Next, so a read that stops early cannot pass.

### Variants (3)

- `agent-withheld` — a seventh of the market stops naming its agent; the line
  is absent, so `agent` reads `null`. Records declared; every other field
  identical (asserted).
- `renamed-pagination` — Next becomes a link reading "More homes" and the
  counter is reworded to "Showing page 1 of 29". Same control position and
  hook, so the same homes are still collected; only the words a model reads
  change.
- `redesigned-search` — **repair work.** The Search button is gone and a button
  reading "Show homes" stands in its place. Declared as a page fact
  (`search-submit` exists: false), with the *repaired* run's expectations, and
  wired to a `LIVE_REPAIR_TASKS` entry with `patchKind:
  "temporary_target_override"`.

## `company-directory` — a regional business register

The Northbank Business Register: **320 companies** across 8 sectors, 15 to a
page (22 pages unfiltered), listed alphabetically.

**Files.** `apps/scenario-lab/src/scenarios/company-directory/` with `types.ts`,
`companies.ts` (the register), `options.ts`, `format.ts` (sector naming and the
table's columns), `browse.ts` (A–Z, sector, size, search, paging), `state.ts`,
`markup.ts` (search, A–Z index, sector list, the table), `profile-page.ts`,
`client-script.ts`, `route.ts`, `records.ts`, `manifest.ts`, `scenario.ts`,
`index.ts`, and `tests/scenario.test.ts`.

**The list page is a real table** with column headings — Company, Sector,
Location, Employees — so the primary workflow reads it by `column:<heading>`
rather than by position. Values are formatted as a directory formats them:
`51–200` (en dash), `501–1,000`, `1,001+`, `Harrogate, North Yorkshire`.

**Navigation.** A 26-letter A–Z index (V, X and Z are filed under nobody and
render as plain text, not links), a sector list, a name search, and a size-band
filter. Letters and sectors apply on click; the search and the size band apply
when Search is pressed.

**A profile page** adds four facts the table has no column for: **Founded**,
**Website**, **Telephone** (`01686 657 923`) and **Registered office**.

**Deliberate incompleteness.** 36 of 320 companies have never filed a
headcount. In the table their Employees cell is genuinely empty with no element
inside it; on their profile the Employees row is absent. Either way the field
reads as no value, and a test asserts no `<span class="employees"></span>` ever
renders.

**The empty answer.** Each sector has a size profile, and an independent
retailer never exceeds 11–50 staff. "Independent retail" plus the largest band
therefore matches nobody by construction.

### Workflows (5)

| Workflow | Dataset | What it requires |
| --- | --- | --- |
| primary `extract-first-register-page` | 15 records | read the table by its column headings, plus each profile link's address |
| `sector-sweep` → `extract-sector-companies` | **40 records over 3 pages** | click the Logistics sector, follow Next to the end |
| `no-companies` → `extract-no-companies` | 0 records | click a sector, choose a size, Search, report nothing |
| `profile-lookup` → `extract-company-profile` | 1 record | type a name, Search, open the company, read profile-only facts |
| `enrich-register` → three datasets | 1 record each | **per-row navigation**: open company 1, read founded and website, back, and so on |

### Variants (2)

- `relabelled-columns` — Sector is headed "Industry", Employees "Team size",
  and Location moves in front of Industry. No value changes, so the recorded
  run still passes and a model asked for columns `name, sector, location,
  employees` has to map the new headings itself.
- `resectored` — **repair work.** The register renames Logistics to "Transport
  and logistics" in the sector list and in every row, while the sector's code
  is unchanged (which is how a directory actually ships a rename). The recorded
  click target `sector-logistics` is gone; the variant declares that as a page
  fact and declares the repaired run's records, in which the sector column
  reads the new name. Wired to a `LIVE_REPAIR_TASKS` entry.

## Live instruction tasks added (14)

All added to `apps/scenario-lab/src/scenarios/live-instructions.ts`. Every
instruction is a goal, names the columns a judged dataset uses, and contains no
selector, test id, element id, URL path or numbered step — checked against the
same 14 patterns `tests/live-instructions.test.ts` enforces.

| Id | Kind | Dataset |
| --- | --- | --- |
| `property-listings-newest-homes` | extract | `extract-newest-homes` |
| `property-listings-newest-homes-agent-withheld` | extract | same, variant `agent-withheld` |
| `property-listings-kelford-homes` | navigate-and-extract | `extract-area-homes` |
| `property-listings-kelford-homes-renamed-pagination` | navigate-and-extract | same, variant `renamed-pagination` |
| `property-listings-no-matches` | navigate-and-extract | `extract-no-matches` |
| `property-listings-cheapest-home` | navigate-and-extract | `extract-cheapest-home` |
| `property-listings-home-facts` | navigate-and-extract | `extract-home-facts` |
| `property-listings-last-page` | navigate | playback goal |
| `company-directory-register-page` | extract | `extract-first-register-page` |
| `company-directory-logistics-sector` | navigate-and-extract | `extract-sector-companies` |
| `company-directory-logistics-sector-relabelled` | navigate-and-extract | same, variant `relabelled-columns` |
| `company-directory-no-companies` | navigate-and-extract | `extract-no-companies` |
| `company-directory-company-profile` | navigate-and-extract | `extract-company-profile` |
| `company-directory-last-page` | navigate | playback goal |

Each fixture also declares a `playbackGoal` for the navigation job: showing the
last page of a narrowed search, judged on the filter summary, the page counter,
and the absence of a Next control.

## Repair tasks added (2)

In `apps/scenario-lab/src/scenarios/live-repair-tasks.ts`, both
`expect: "repair"` with `patchKind: "temporary_target_override"`:
`property-listings-repair-renamed-search` and
`company-directory-repair-renamed-sector`.

## Registration

The brief named `apps/scenario-lab/src/scenarios/index.ts`; that file is only
the barrel for the two live task catalogs. The actual registration points are
`apps/scenario-lab/src/types.ts` (`scenarioIds`) and
`apps/scenario-lab/src/registry.ts` (the definition map). Both were updated for
both fixtures.

Seeds were moved to **161** (property-listings) and **163** (company-directory)
after `social-scheduler` and `support-desk` both claimed 141 while this work was
in flight. Nothing in either fixture reads the seed: both registers are
authored and both manifests' expected records are literal text, so the fixtures
are identical on every run, which a test asserts by comparing `createState(1)`,
`createState(9_999)` and `createState(seed)`.

## Commands run and observed results

- `node .../typescript/lib/tsc.js -p apps/scenario-lab/tsconfig.json --noEmit`
  → no output, exit 0.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check`
  (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.e2e.json`) → exit 0, no
  diagnostics.
- Both new suites, compiled and run standalone with `node --test`:
  `# tests 24 / # pass 24 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` (the package's own
  gate: builds, then runs every compiled test) →
  `# tests 300 / # pass 297 / # fail 3`. The two new suites are tests 41–52 and
  200–211 and **all pass**. The three failures are listed below and none is
  from this work.
- `node scripts/structure-audit.mjs` → `2 violation(s) across 1 rule(s)`, both
  `[imports] apps/scenario-lab/.probe-build/probe.mjs` and `probe2.mjs`, a
  scratch build directory another worker left inside the repository. Filtering
  the audit output for `property-listings` or `company-directory` returns **0
  lines**: no failure and no warning in either new directory. Every new file is
  under 350 lines (limit 800, advisory 400), each directory holds 14–15 source
  files (limit 25), tests are in a `tests/` subfolder, and every directory has a
  barrel.
- `pnpm check` → exit 1, failing at its second stage, `pnpm lab:test`, with
  five failures in `scripts/lab/live-campaign/tests/` about LLM token budgets
  (`--llm-max-input-tokens 48000` observed against `42000` expected, and
  `56000` against `50000`). Those are another worker's concurrent change to the
  campaign's limits; the fixture task ids in them are `identity-drift`,
  `sensitive-input` and `table-read-reordered`, none of them mine. Because it
  fails there, `pnpm check` never reached `node scripts/structure-audit.mjs` or
  `pnpm -r check`; both were run separately, as above.
- A scratch harness replayed the catalog rules from
  `scenarios/tests/live-instructions.test.ts` and
  `scenarios/tests/live-repair-tasks.test.ts` against the two new manifests:
  all 14 instruction tasks resolve to exactly one workflow each, every dataset
  states a count and records, no instruction matches any of the 14
  selector-like patterns, extract step ids are unique within each fixture, and
  each of the five variants is correctly classified — three that the recorded
  Flow still passes, two that need a repair and have one. Output ended
  `ALL CHECKS PASSED`.

### The three package-test failures, and why they are not from this work

1. `every scenario that declares a playback goal or an expected dataset has at
   least one task` — actual `['support-desk', 'order-operations',
   'social-scheduler', 'social-inbox']`. Neither new fixture is in that list.
2. `every deliberately failing row of the corpus is a repair task, a refusal
   task, or an exclusion` — six unclassified rows, all under `support-desk`,
   `order-operations`, `social-scheduler` and `social-inbox`.
3. `manifest ids, paths, seeds, and step ids are unique across the corpus` —
   29 unique seeds against 31 manifests. The duplicates are seed 141
   (`social-scheduler` and `support-desk`) and seed 142 (`order-operations` and
   `social-inbox`).

## Not verified

- **No browser run.** Nothing here was exercised in Chrome or Edge, through the
  extension, or through `pnpm lab run`. The extraction contract was read from
  the code (`packages/test-runner/src/scenario-steps/extract-records.ts`,
  `extract-intent.ts`, `apps/extension/src/content/extraction/`) and the field
  and pagination shapes were matched to it, but that every judged dataset is
  actually collectable end to end is an argument, not a measurement. In
  particular: that clicking Next replaces the results region within the
  reader's window (modelled on `product-catalog`'s 150 ms latency, which the
  same reader already copes with), that a `column:` field resolves against the
  register's header row, and that a full navigation to a detail page and back
  survives the recording lane's step sequence.
- **No live campaign.** Not run, as the brief directed. Whether a model
  actually produces these records is unmeasured; only that the fixtures declare
  records a correct run would produce.
- **`numbered` and `loadMore` pagination were avoided on purpose.** The Lab's
  own reference reader
  (`packages/test-runner/src/scenario-steps/extract-records.ts`) follows only
  `next` and fails any other mode as `fixture.invalid`, so both new fixtures
  use `next` throughout. `product-catalog`'s existing `numbered-pages` workflow
  appears to have that problem on the recording lane; that is a pre-existing
  observation, not something changed here.
- **`pnpm test` and `pnpm build` were not run.** `pnpm check` already failed on
  another worker's change before reaching `pnpm -r check`, so a repository-wide
  test and build would have been measured against the same moving tree.
- **Documentation not updated.** `docs/architecture/testing-facility.md` holds
  a table of fixtures that ought to gain two rows. Four other scenarios were
  being added to the same table while this ran, so a single edit covering all
  six belongs to the supervisor rather than to a race between workers.
- **Non-ASCII normalisation.** Both fixtures' sources were rewritten to pure
  ASCII with `\uXXXX` escapes for `£`, `·` and `–`, matching the convention in
  `member-directory/filters.ts`; the 24 unit tests were re-run afterwards and
  still pass. During that rewrite a scripting mistake truncated
  `company-directory/options.ts` to zero bytes; it was rewritten and every
  other file in both directories was checked for truncation (none).

## Open questions and contradictions found

- **Shared files are being written by several workers at once.**
  `apps/scenario-lab/src/types.ts`, `src/registry.ts`,
  `src/scenarios/live-instructions.ts` and `src/scenarios/live-repair-tasks.ts`
  are each edited by this brief and by at least three others running
  concurrently. One whole-file rewrite here briefly dropped another worker's
  `scenarioIds` entry before it was restored, and two seed collisions arose
  between the others. All four files were re-checked at the end and every entry
  from this work is present; nobody should assume that holds for the others
  without looking. The protocol's rule that briefs are partitioned by file was
  not met for these four.
- **A per-row enrichment cannot be judged as a single created-Flow dataset.**
  `judgeCreatedFlowDataset` compares the run's *first* dataset against the one
  step a task names, so a job whose answer is "one row per page visited" has no
  single dataset to be judged on. Both fixtures therefore express per-row
  navigation as a recorded workflow with one extract step per row
  (`detail-sweep`, `enrich-register`), judged by the recording and recorded-Flow
  lanes, and give the live-instruction lane the robustly judgeable shape
  instead: one company or one home, found by searching or sorting, opened, and
  read. Making "enrich every row of this table" judgeable for a created Flow
  would need either a dataset-merging step in the extraction contract or a
  judgement that compares a named dataset rather than the first one. Worth
  raising: it is the single biggest gap between what the brief asked for and
  what the corpus can currently score.
- **A relabelled column cannot be a recorded-lane drift for a `column:` read.**
  `readColumn` throws when the header is gone, so a variant that renames a
  heading under a workflow reading by heading is a hard failure with no
  repaired run to declare. `relabelled-columns` is therefore attached to the
  workflow that reads by row content, where the recorded run still passes and
  only a model reading the headings has work to do.
- **`live-instructions.ts` is now 484 lines**, past the 400-line advisory
  threshold (a warning, not a failure). It is one flat array that four workers
  are appending to at once; splitting it into a directory now would collide
  with all of them, so it is left for the supervisor to split once the
  concurrent work has landed.
