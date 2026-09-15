# Worker report: ex-d-test-facility

Read-only investigation of how the Testing Lab should measure FluxIQ's own
data extraction. No source, test, or document was edited; this file is the
only output. Paths are relative to `F:\!FluxIQWebExtension` unless noted.

## Outcome

Done. The five questions are answered below with file:line references.
Five findings matter most:

1. **FluxIQ's extraction is judged nowhere today.** The recording lane
   judges records that the runner itself reads with Playwright. The Flow
   lane marks every week1 extraction `not_applicable`, or skips the row.
2. **Six variant-level extraction claims have never been checked by any
   run:** W04 `text-variant`, W05 `short-catalog`, W06 `no-results`, W08
   `column-reorder`, W11 `end-early`, and W15/W19's empty lists. Variants run
   only on the Flow lane (`bench/expand-corpus.ts:21`), and that lane either
   skips the row or does not judge extraction.
3. **No `RunEvaluation` or `BenchReport` field measures extraction.** The
   only trace is a record count in `snapshots/flow-lane.json`
   (`flow-lane/run-flow-lane.ts:265`) and in the `step.complete` event
   (`run-scenario.ts:311`).
4. **Pagination semantics contradict each other on the Flow lane.** The
   judge expects one extract attempt per expected entry
   (`flow-lane/expectations.ts:92-95`), but W05 expects a single entry of
   23 records spread over 3 pages (`product-catalog/manifest.ts:63`).
5. **The Flow-run reader drops values silently.** It searches four places
   for extracted records and discards any value that is not a string
   (`flow-lane/persisted-flow-run.ts:387,394`). Nested or null values
   therefore vanish, and a record can then match that should not.

## 1. What each lane judges today, per week1 row with `expected.extracted`

**Shared mechanics.**

- **Recording lane.**
  - `step-runner.ts:116` calls `extractRecords` (`extract-records.ts:57-72`),
    which reads the page with Playwright. With `pagination` it also clicks
    Next itself (`:64-71`, `:89-106`).
  - `run-scenario.ts:310` then calls `assertExtraction`, which checks the
    count exactly and the records exactly, in order
    (`run-expectations/extraction.ts:10-30`).
  - This happens before the final-state check (`run-scenario.ts:317`). In
    the bench, an extraction failure is read as `oracleVerdict: failed`
    (`bench/evaluate-run.ts:13,184`).
  - Variants are never recorded armed (`run-scenario.ts:736`).
- **Flow lane.**
  - `flowExtractionExpectation` returns `not_applicable` unless the Flow
    contains a `web.dom.extract` or `web.dom.extract_list` node
    (`flow-lane/expectations.ts:55,72-75`). When it is not `judged`,
    `assertFlowExtraction` returns without checking anything (`:89`).
  - What actually decides the run is the fixture's final-state oracle
    (`run-flow-lane.ts:161`), plus the failure and action checks
    (`:178-179`).
  - `extract` records no action (`recordable-actions.ts:55`). A paginated
    extract records only its Next clicks (`:67-68`).
  - A script that records no action is excluded from the Flow lane
    (`flow-lane-exclusion.ts:24-28`). The bench skips such rows
    (`bench/expand-corpus.ts:76`) and `--flow` refuses them
    (`run-scenario.ts:738-739`).

| Row | Workflow (file:line) | Expected | Recording lane | Flow lane |
| --- | --- | --- | --- | --- |
| W04 | product-catalog primary (`manifest.ts:36-44`) | 8 records incl. `@href` | runner read, judged | **skipped**: the script is extract + checkpoint only |
| W04 `text-variant` | `manifest.ts:45-52` | 8 records, new price text | never (variant) | **skipped**, so **never judged** |
| W05 | `paginated-extraction` (`:54-65`) | 23 records, 5-page cap (`:16`) | runner reads and clicks Next, judged | Flow is 2 click nodes; `not_applicable`; oracle checks "Page 3 of 3" and Next absent (`:64`) |
| W05 `short-catalog` | `:66-75` | 5 records | never | `not_applicable`; oracle only. See the open questions |
| W06 | `search` (`:77-94`) | 4 records | judged | type/press Flow; `not_applicable`; oracle checks "4 results" |
| W06 `no-results` | `:95-103` | count 0, `[]` | never | `not_applicable`; the empty list is **never judged** |
| W07 | `in-stock-only` (`:105-125`) | 18 records + `availability` | judged | check + Next clicks; `not_applicable`; oracle checks "Page 3 of 3" |
| W08 | data-table primary (`data-table/scenario.ts:29-38`) | 12 records via `column:` | judged | **skipped**: extract only |
| W08 `column-reorder` | `:39-44` | same 12 records | never | **skipped**, so **never judged** |
| W09 | `sort-by-price` (`:45-62`) | 1 record (first row) | judged | click Flow; `not_applicable` (named at `expectations.ts:65`); oracle checks sort status |
| W11 | infinite-feed primary (`infinite-feed/scenario.ts:35-60`) | **count 40 only**, no records | judged, count only | scroll Flow; `not_applicable`; oracle checks "Showing 40 posts" |
| W11 `end-early` | `:61-73` | count 25 | never | `not_applicable`; oracle only |
| W15 | multi-tab primary (`multi-tab/manifest.ts:21-50`) | 1 record | judged | click/tab Flow; `not_applicable`; oracle |
| W15 `popup-blocked` | `:51-65` | `extracted: []` | never | `not_expected`, because an empty array reads as not expected (`expectations.ts:73`); checked by failure category |
| W18 | auth-gate primary (`auth-gate/manifest.ts:43-64`) | 1 record | judged | type/click Flow; `not_applicable` (`expectations.ts:65`); oracle |
| W19 `expired` | `:66-86` | `extracted: []` | never | `not_expected`; failure `auth_required` |

Two manifests with extraction have no week1 row (`bench/corpus/week1.ts:33-61`):

- admin-console `extract-customer-list` (`admin-console/manifest.ts:134-160`);
- member-directory `filter-members` (`member-directory/manifest.ts:126-160`).

## 2. Contracts, and what each would need

**`ExpectedExtraction`** (`test-contracts/src/scenario.ts:103`; JSON schema
`:280-287`; validator `validation.ts:107-117`).

- *Today:* `{ step, count?, records? }`. Records are flat
  `Record<string, string>`, compared exactly and in order.
- *Needs:*
  - `pages?: number`, the number of pages FluxIQ must have followed.
  - `optionalFields?: string[]`, fields that may be absent without failing
    completeness. It must be a subset of the step's `fields`; the validator
    should enforce that.
  - `truncated?: boolean`, so a capped result is an expected outcome rather
    than a count mismatch.
  - A value type that allows null, and later nested lists. This must mirror
    the domain `web.dom.extract_list` result, which was **not verified**
    because the domain is out of scope.
  - Keep `[]` meaning "no extraction expected" (W15, W19). Keep
    `{ count: 0, records: [] }` meaning "extraction ran and found nothing"
    (W06). Document the difference, because both must be judged on the Flow
    lane.

**Scenario step `extract` and pagination** (`scenario.ts:48-71,241-253`;
`validation.ts:61-96`).

- *Today:* `target`, `fields` in the runner's own selector grammar
  (`extract-records.ts:9-40`: `testid:`, CSS, `@attr`, `column:<header>`),
  and `pagination: { next, maxPages ≤ 50 }` (`scenario.ts:6,49`).
- *Needs, so the recording lane records an extraction intent:*
  - The step becomes a request for FluxIQ to extract. The runner dispatches
    it through an injected seam, the way `scriptedNavigation` works
    (`step-runner.ts:21-22,96-98`), and FluxIQ produces the records.
  - The runner must not click Next itself. Otherwise the recording holds
    clicks **and** the extract node follows pagination, so the Flow would
    navigate twice.
  - `recordableActionTypes` must map `extract` to `web.dom.extract` and
    `web.dom.extract_list`, with no click for a paginated step
    (`recordable-actions.ts:55,67-68`).
  - A translation module from the runner grammar to the domain's extract
    input. Grammar the domain cannot express, such as `column:`, fails as
    `fixture.invalid`.
  - Pagination becomes a discriminated union with `kind` defaulting to
    `next`:
    - `{ kind: "next", next, maxPages }`
    - `{ kind: "numbered", pages, maxPages }`
    - `{ kind: "scroll", maxLoads }`
    - optionally `maxRecords`.
- *Knock-on changes:*
  - W04 and W08 gain a Flow lane automatically. `flowLaneExclusion` derives
    from `recordableActionTypes`, so its code does not change, only its
    comment at `flow-lane-exclusion.ts:12-14`.
  - The week1 plan grows from 63 to **67** runnable results: 23 on the
    recording lane and 44 on the Flow lane. Update `week1.ts:16-21`,
    `bench/tests/week1-corpus.test.ts:91` and `testing-facility.md:1255-1258`.
  - `checkExpectedActionSources` (`validation.ts:190-203`) will then accept
    `web.dom.extract_list` in `expected.actions`. Remove the "No
    `web.dom.extract`" comments at `infinite-feed/scenario.ts:50`,
    `multi-tab/manifest.ts:41` and `admin-console/manifest.ts:143`.

**`RunLaneObservation`** (`flow-lane/lane-observation.ts:10-13`) is a subset
of `RunEvaluation`'s fields (`evaluation.ts:103-144`), which has no
extraction field.

- *Needs:* a new field, `RunEvaluation.extraction: RunExtractionMeasurement | null`.
  - It holds **counts only**, never values or field names from the page,
    per AGENTS.md. Per step: `stepIndex`, `status`
    (`judged | not_run | not_expected`), `expectedRecords`,
    `observedRecords`, `matchedRecords`, `expectedFields`, `presentFields`,
    `unexpectedFields`, `pagesFollowed | null`, `truncated | null`,
    `durationMs | null`.
  - Bump `EVALUATION_SCHEMA_VERSION` from 0.2 to 0.3 (`evaluation.ts:6`).
    Evaluations at 0.2 stay readable, with the field absent meaning
    unmeasured, following `bench-report-validation.ts:13-14`.
- *Producers to update:*
  - `recordingLaneObservation` (`lane-observation.ts:16-33`) and
    `flowLaneObservation` (`:40-57`);
  - `evaluateFlowRun` (`bench/evaluate-run.ts:93-111`), which copies each
    field explicitly;
  - `evaluateFailedAttempt` (`:114-138`), which sets null;
  - `benchRecordingObservation` (`:177-191`). It derives from `run.json`, so
    it must read a new counts-only `snapshots/extraction.json`, keeping the
    bench and a single run in agreement (`bench-parity.test.ts`).
- *Flow-lane judge* (`flow-lane/expectations.ts:69-96`):
  - `not_applicable` must become a `recording.contract` failure whenever
    `expected.extracted` is non-empty and the Flow has fewer extract nodes
    than the script has extract steps.
  - Pair attempts with steps by the recording's candidate order
    (`run-flow-lane.ts:129,192-205`) against the script's extract-step
    order, not by raw attempt index. Several attempts for one step, such as
    one per page, are concatenated.
- *Flow-run reader* (`persisted-flow-run.ts:385-397`): read one documented
  location in Core's run detail, which needs confirming in Core. Report
  non-string values instead of dropping them (`:394`), and carry pages and
  truncation.

**`BenchReport` metrics** (`bench-report.ts:72-129`).

- *Today:* rates per lane (`:18-21`), action latency, run duration, packet
  sizes, and execution coverage. Nothing about extraction.
- *Needs:*
  - An optional `extractionByLane` block (definitions in section 4). Absent
    means unmeasured, following the `notExecutedRuns` rule at `:108-114`.
  - Validation keys at `bench-report-validation.ts:97` and bounds checks
    such as `matched ≤ expected` and `judged ≤ expected`.
  - Comparison ids in `compareBenchReports` (`bench-report.ts:191-192`) and
    `measure` (`:201-218`).
  - Report rows in `bench/render-markdown.ts:122` and
    `bench/comparison-details.ts:14`.
  - Computation in `bench/aggregate-report.ts:226-250`.

## 3. Fixture coverage for a real scraping capability

| Capability | Covered today by | Gap | Proposed fixture or variant |
| --- | --- | --- | --- |
| Attribute fields | `product-catalog` `url: @href` (`manifest.ts:14`, `markup.ts:62`); `infinite-feed` `@datetime` (`scenario.ts:44`); `member-directory` `@data-member-id` read from the item itself (`manifest.ts:38`) | none basic | keep |
| Link fields | root-relative `href` only (`product-catalog/manifest.ts:9`) | resolved absolute URL vs raw `href`; `target=_blank` links (`multi-tab/list-page.ts:37`) are never extracted | `product-catalog` variant `absolute-links`: mixed absolute, relative and `?query` links, with expected resolved URLs |
| Images | **none**: no `<img` or `srcset` in any fixture | `src`, `srcset`, `alt`, lazy `data-src` | `product-catalog` variant `with-images`: an `<img data-testid="product-image" loading="lazy">` per card, fields `image@src` and `image@alt`, with lazy placeholders past the first row |
| Nested fields | **none**: records are flat strings (`scenario.ts:103,285`) | lists inside a record | `product-catalog` workflow `extract-specs`, reading a spec list per product detail page. Blocked on the contract value type |
| Missing or optional fields | the runner leaves absent fields out (`extract-records.ts:43,78`), unit test only (`extract-records.test.ts:50`); every card has every field (`markup.ts:62-65`) | no corpus record ever lacks a field | `product-catalog` variant `sparse-cards`: some cards lack a rating, some read "Price on request", with `optionalFields` |
| Empty lists | W06 `no-results` count 0 (`product-catalog/manifest.ts:96-101`), **never judged** | a table with headers and no rows | `data-table` variant `empty-table`: headers render, 0 rows, `column:` fields still resolve |
| Infinite scroll | `infinite-feed`: sentinel loads 10 per page (`scenario.ts:92-105`), but the **script** scrolls and extraction reads afterwards; `admin-console` virtualised list, 240 records with few mounted (`manifest.ts:59-66`), not in week1 | FluxIQ loading more by itself; W11 has no expected records (`scenario.ts:52`) | `infinite-feed` workflow `extract-until-end`: extract with `{ kind: "scroll" }`, expecting 60 seeded records (25 with `end-early`); add records to W11; consider a week1 row for `admin-console extract-customer-list` / `short-book` |
| Next pagination | `product-catalog` Next button (`markup.ts:78`), W05 and W07 | Next as a full-navigation `<a href>`; a "Load more" button | `product-catalog` variant `link-pagination`; `infinite-feed` variant `load-more-button` |
| Numbered pagination | rendered but unused: `pagination-page-N` buttons (`product-catalog/markup.ts:76`) | no workflow uses it | `product-catalog` workflow `numbered-pages`: `{ kind: "numbered" }`, 23 records, `pages: 3` |
| Iframes | frames exist, same-origin and cross-origin (`iframe-checkout/scenario.ts:36`) and a card frame (`storefront-checkout/checkout-steps.ts:159`); **no extraction inside a frame**; the runner reader scopes to `page` (`step-runner.ts:116`) | extraction inside a frame | `iframe-checkout` workflow `extract-order-lines` from the same-origin frame, plus variant `cross-origin-lines` whose expected outcome follows domain policy (success, or a failure category) |
| Sensitive values in extracted text | `sensitive-input` has inputs only (`scenario.ts:13-15`); emails in `member-directory` records (`manifest.ts:212`). Evidence stays counts-only: failure details are published only for `recording.contract` (`run-scenario.ts:405`), `step.complete` carries `recordCount` only (`:311`), `flow-lane.json` carries `extractionCount` only (`run-flow-lane.ts:265`) | no fixture renders secret-shaped **text**, such as a card number or token, inside an extractable item, or reads a password `value` | new fixture `account-statement`, or a `sensitive-input` workflow, with a visible card number, an API token cell and a password input value. The expected records follow the domain sensitivity rule (`testing-facility.md:978-979`). Add a guard that scans the run bundle for the planted strings |
| Large lists and truncation | `admin-console` 240 records (`manifest.ts:8`); page cap 50 (`scenario.ts:6`); the runner has no record cap (`extract-records.ts:63-66`) | no expected truncation; domain caps unknown | `data-table` variant `large-table` (for example 2,000 rows) with `truncated: true` and the domain's cap as `count`; check interaction with the 6,000-byte packet budget (`testing-facility.md:971-973`) |

## 4. Metrics to add

All metrics are per lane, never combined. Each counts only runs whose
extraction status is `judged`, and states the number of expected-but-unjudged
steps beside it, following the rule that a rate is never shown without its
coverage (`aggregate-report.ts:52-65`).

| Metric | Definition | Tolerance proposal | Computed where |
| --- | --- | --- | --- |
| `extractionRecordAccuracy` | Pooled over all steps, not averaged per step: Σ matched ÷ Σ max(expected, observed). A record matches when it is identical at its position, the same rule as `extraction.ts:20-30`. Only entries with `records` count; count-only entries feed `extractionCountAccuracy` (steps whose count is exact ÷ steps). Also `extractionExactSuccess`: runs whose every step matched ÷ judged runs, in workflows | one record of the population (1 ÷ Σ expected; about 1/68 per week1 repeat on the recording lane); exact-success is ±1 workflow (`BENCH_TOLERANCE.rateWorkflows`, `bench-report.ts:25`) | per step: a new pure `measureExtraction` in `run-expectations/extraction.ts`, with `assertExtraction` built on it so the two cannot disagree; per run: the lane observations; per bench: `aggregate-report.ts` `corpusMetrics` |
| `extractionFieldCompleteness` | Over aligned positions i < min(expected, observed): Σ expected non-optional fields present ÷ Σ expected non-optional fields. `unexpectedFields` is counted separately | one field of the population (1 ÷ Σ expected fields) | same as above |
| `pagesFollowed` | Per paginated step: the pages FluxIQ reports, or its extract attempts for that step. Rate `paginationAccuracy` = steps whose pages equal `expected.pages` ÷ paginated steps; distribution p50/p95 alongside | ±1 workflow | Flow: `persisted-flow-run.ts` feeding `expectations.ts`; recording: the intent result; bench: `aggregate-report.ts` |
| `extractionDurationMs` | Per step, summed attempt `durationMs` (`persisted-flow-run.ts:308`); also `extractionMsPerPage` = duration ÷ pages. On the recording lane the source is the step timing (`step-runner.ts:78-79`), labelled as such, as with `RECORDING_LANE_SOURCES` (`evaluate-run.ts:11-20`) | p95 within 25% (`latencyP95Ratio`). One observation carries this machine's error bar; rerun before calling a regression | bench: new distributions in `corpusMetrics`; compared through `measure` (`bench-report.ts:201-218`) |
| `extractionFalseSuccess` | Positive runs where FluxIQ reported success but a judged extraction did not match. `oracleVerdict` is left alone so the historical `falseSuccess` stays comparable (`evaluate-run.ts:171-175`) | ±1 workflow | `aggregate-report.ts` rate definitions |

## 5. Implementation steps

Steps that touch the same file are serial. Step 0 blocks everything else.
Steps 2a-2g run in parallel after step 1. Steps 3, 4 and 6 run in parallel
after step 1.

0. **Decide, outside this scope.** Confirm the domain's
   `web.dom.extract_list` input and result shape (fields grammar, pagination
   kinds, pages, truncation cap, sensitivity masking), Core's run-detail
   location for the result, and how the extension records an extraction
   intent. Decide whether FluxIQ's pagination leaves the page on its last
   page (W05 and W07 `finalState`, `product-catalog/manifest.ts:64,122`).
1. **Contracts** (`packages/test-contracts/src`), serial within the package.
   Covered by that package's `tests/`.
   - a. `scenario.ts`: pagination union; `ExpectedExtraction.pages`,
     `optionalFields` and `truncated`; schema `$defs`.
   - b. `validation.ts`: `pages` only on a paginated step; `optionalFields`
     must be a subset of the step's field keys.
     *Mutation target:* remove the subset check, and the test with an
     unknown optional field fails.
   - c. `recordable-actions.ts`: `extract` yields
     `web.dom.extract`/`web.dom.extract_list`, with no click.
     *Mutation target:* revert to `[]`, and a test asserting that W04's
     script yields `web.dom.extract_list` and that `flowLaneExclusion`
     returns `undefined` fails.
   - d. `evaluation.ts` and `evaluation-validation.ts`: the `extraction`
     measurement and schema 0.3.
     *Mutation target:* the validator must refuse any string-valued member;
     a test planting `"4242424242424242"` in a measurement must fail if the
     refusal is removed.
   - e. `bench-report.ts` and `bench-report-validation.ts`: extraction
     metrics, comparison ids, tolerances, bounds.
     *Mutation target:* drop `matched ≤ expected`, and the fixture report
     that violates it passes, which the test catches.
2. **Fixtures** (`apps/scenario-lab/src/scenarios/<id>/`), one worker per
   fixture. Each adds cases to `tests/scenario.test.ts` and, outside this
   scope, `e2e/<id>.spec.ts`.
   - a. `product-catalog`: `pages` on W05 and W07; `expected.actions` gains
     `web.dom.extract_list`; variants `with-images`, `sparse-cards`,
     `absolute-links`, `link-pagination`; workflows `numbered-pages` and
     `extract-specs`.
   - b. `data-table`: `empty-table`, `large-table`.
   - c. `infinite-feed`: records for W11, `extract-until-end`,
     `load-more-button`.
   - d. `multi-tab` and `auth-gate`: actions, comments.
   - e. `iframe-checkout`: frame extraction.
   - f. `account-statement`, a new fixture, or the `sensitive-input`
     workflow.
   - g. `admin-console`: comment at `:143`.

   *Mutation target for each:* arm the variant with its distinguishing
   change removed, and that fixture's spec must fail.
3. **`run-expectations/extraction.ts`**: `measureExtraction`, with
   `assertExtraction` built on it. Covered by `tests/extraction.test.ts`.
   *Mutation targets:* compare as a set instead of by position, and the
   order test fails; drop the key-length check (`:29`), and the
   extra-field test fails.
4. **`scenario-steps/`**: new `extract-intent.ts` translating the grammar;
   `step-runner.ts:116` dispatches through an injected `extractionIntent`
   seam. `extract-records.ts` stays only as the fixture reference reader;
   decide whether to move it rather than delete it. Covered by
   `tests/extract-intent.test.ts` and `tests/step-runner.test.ts`.
   *Mutation target:* fall back to `extractRecords` when the seam is
   present, and a test spying that Playwright read no locator fails.
5. **`run-scenario.ts:306-312`** (after 3 and 4): record the per-step
   measurement, write counts-only `snapshots/extraction.json`, and feed
   `recordingLaneObservation`. Covered by
   `run-evaluation/tests/runner-wiring.test.ts` and
   `single-run-evaluation.test.ts`.
   *Mutation target:* write the records themselves, and a bundle scan for a
   planted value fails.
6. **`flow-lane/persisted-flow-run.ts:385-397`**: a single location,
   non-string values reported, pages and truncation carried. Extend the test
   at `tests/persisted-flow-run.test.ts:123`.
   *Mutation target:* restore the silent drop at `:394`, and the
   nested/null test fails.
7. **`flow-lane/expectations.ts`** (after 6): a missing extract node fails
   as `recording.contract`; attempts pair with steps by candidate order;
   per-page attempts are concatenated. Rewrite
   `tests/expectations.test.ts:61,76`.
   *Mutation targets:* reinstate the `not_applicable` skip, and the
   missing-node test fails; pair by attempt index, and the reordered-attempt
   test fails.
8. **`flow-lane/run-flow-lane.ts:153-181,257-275` and
   `lane-observation.ts`** (after 7): publish the measurement in the
   observation and `flow-lane.json`. Rewrite `run-flow-lane.test.ts:403` and
   extend `lane-observation.test.ts`.
   *Mutation target:* add records to the snapshot, and a
   `JSON.stringify(snapshot)` scan for a planted value fails.
9. **Bench** (after 1e, 5 and 8): `evaluate-run.ts` (recording lane reads
   `extraction.json`; `evaluateFlowRun` copies the measurement),
   `aggregate-report.ts`, `render-markdown.ts`, `comparison-details.ts`,
   `corpus/week1.ts` comment. Tests: `evaluate-run.test.ts`,
   `bench-parity.test.ts`, `week1-corpus.test.ts:91` (63 → 67).
   *Mutation target:* average per step instead of pooling, and a test with
   uneven lists (23 records against 1) fails.
10. **Content harness** (extension-owned, outside this scope):
    `apps/extension/e2e/content/tests/extract-*.spec.ts` runs the real
    content script against each section 3 fixture
    (`repository-layout.md:295-301`).
    *Mutation target:* disable the sensitivity masking, and the
    sensitive-text spec fails.
11. **Docs:** `testing-facility.md:740-742, 779-781, 890-895, 941-945, 958,
    1250-1258, 1289-1298`.
12. **Lab, then bench:**
    - `pnpm lab run product-catalog --flow` (W04 is no longer refused);
    - `pnpm lab run data-table --flow --variant column-reorder`;
    - `pnpm lab run product-catalog --workflow paginated-extraction --flow`;
    - then a week1 bench;
    - `lab compare` against the last baseline. Extraction metrics are absent
      from the baseline and show as not-compared.
    - Run heavy gates one at a time; rerun a single failure before calling
      it real.

## What changed and why

Created only this report, as the brief requires. No code, test, or other
document was touched.

## Commands run and observed results

None. The investigation used Read, Grep, and Glob only. As the brief
requires, no build, test, Lab, or git command was run.

## Not verified

- Domain `web.dom.extract` and `web.dom.extract_list` schemas, pagination,
  truncation caps and sensitivity masking. `domain/` was out of scope.
- Where Core's run detail carries extract results.
- How the extension could record an extraction intent.
- Scenario Lab e2e specs (`apps/scenario-lab/e2e/`), `bench-parity.test.ts`,
  and where test-contracts keeps its tests.
- Whether any live Flow run has ever produced an extract node. The docs say
  extraction is "usually `not_applicable`" (`testing-facility.md:941-945`).
- The tolerance numbers are proposals, not derived from measured variance.

## Open questions or contradictions found

1. `expectations.ts:81-86` says each page is compared "one attempt per
   expected entry", but W05 and W07 each expect a single entry across 3
   pages (`product-catalog/manifest.ts:63,118`). A Flow that extracts page by
   page would fail with a count of 3 against 1.
2. Variant extraction claims are measured by no run: W04 `text-variant`
   ("extraction must still succeed", `manifest.ts:47`), W08 `column-reorder`
   (`data-table/scenario.ts:41`), W05 `short-catalog`, W06 `no-results`,
   W11 `end-early`.
3. W05 `short-catalog` on the Flow lane replays two recorded Next clicks
   against a page with no Next (`manifest.ts:68`), yet expects no failure.
   The prior ledger may already explain this; not checked.
4. A recording-lane extraction failure throws before the final-state check
   (`run-scenario.ts:310` vs `:317`). A single `lab run` therefore never sets
   `oracleVerdict: failed` for it, while the bench infers `failed`
   (`evaluate-run.ts:184`). This is the known divergence at `:163-175`; new
   extraction metrics must not inherit it.
5. `persisted-flow-run.ts:387` probes four locations and drops non-string
   values. The Core carrier is unconfirmed, and the silent drop can let a
   wrong record match.
6. If the recording lane stops clicking Next, W05 and W07 `finalState`
   ("Page 3 of 3") holds only if FluxIQ's extractor both executes on that
   lane and leaves the page on its last page. This is a product decision the
   expectations currently presume.
