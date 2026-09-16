# x5e-fixtures-tables-feed

The data-table, infinite-feed, iframe-checkout and sensitive-input halves of
X5.4. Source and unit tests only: no Playwright spec was added, changed or run,
and no content-harness row was touched.

## Outcome

**Done**, with one contradiction that needs the supervisor: adding `records` to
W11 — which the brief requires — breaks two assertions in
`apps/scenario-lab/e2e/infinite-feed.spec.ts`, a file the same brief forbids me
to touch. Details under "Open questions". Everything else landed and is green.

## What changed and why

### data-table — `empty-table` and `large-table`

- `inventory.ts`: `LARGE_INVENTORY_ROWS = 2_000` and `largeInventoryRows()`.
  Rows are built from the authored catalog rather than the seed, so the expected
  count holds under any lab seed, and every id and product name stays distinct
  so a truncated read cannot be mistaken for a de-duplicated one.
- `table-state.ts`: operations `clear-inventory` and `load-large-inventory`,
  both through `withRows`, which re-derives the view and drops the sort — a
  status line naming a sort of a table that is no longer the one sorted would be
  a claim the page cannot support.
- `table-page.ts`: an `empty-inventory` paragraph when there are no rows. The
  caption and the four headers still render, so `column:` fields still resolve
  against an empty table (the point of the case, per `ex-d-test-facility`).
- `scenario.ts`: variant **`large-table`** on the primary workflow — count
  1,000, `truncated: true`, and deliberately **no** `records`: what the cap
  keeps is a count and a flag, and listing 1,000 rows would assert the cap's
  cut-off point rather than that it reported itself. Workflow **`empty-table`**
  (step declares `minItems: 0`) with variant **`no-rows`** — count 0,
  `records: []`.

`empty-table` had to be a *workflow* while `large-table` is a *variant*:
`minItems` lives on the step, and a variant never changes the recording script,
so the validator (`validation.ts` `checkExtractionReferences`) rejects any entry
expecting no records unless the step itself declares `minItems: 0` (D4). This is
the shape product-catalog already uses for `search` / `no-results`.

### infinite-feed — records, two paginated workflows, comment deleted

- The comment at `scenario.ts:50` is deleted, as instructed.
- `records` added to W11 (40) and to the `end-early` variant (25), built from
  `feedItem(FEED_SEED, …)` with `FEED_SEED = 116`. **The seed matters**: this
  feed's posts are a function of the lab seed, and a run starts the lab on the
  scenario's own seed unless `--seed` overrides it (`run-scenario.ts:84`,
  `options.seed ?? scenario.seed`). The records are therefore correct at 116 and
  at no other seed; the code says so where it is declared.
- `feed-markup.ts`: a `FeedPagination` type. The document renders **either** the
  sentinel **or** a `load-more` button, never both, so a run cannot load a page
  by scrolling and by pressing at the same time. The client observes the
  sentinel only when it exists, wires the button when it exists, and `finish()`
  removes whichever control is present.
- New mode `load-more` (feed length 60), guarded by `isFeedMode` so an unknown
  mode arms nothing instead of clearing the feed.
- Workflow **`extract-until-end`**: `{ mode: "scroll", maxScrolls: 20 }`, count
  60, ending on the end-of-feed marker.
- Workflow **`extract-by-load-more`**:
  `{ mode: "loadMore", control: "testid:load-more", maxPages: 10 }`, with
  variant **`load-more-button`** (count 60, `pages: 6`). Unarmed, this feed
  scrolls and the control does not exist, so the workflow's own expectation is
  the honest one: 10 records, `pages: 1`. `load-more-button` is the variant
  because arming is what puts the button on the page, while the pagination mode
  belongs to the step.

Neither new workflow declares `expected.actions`: an extract step records no
action (`recordable-actions.ts`), so any entry would be unmeetable.

### iframe-checkout — `extract-order-lines`

- New `order-lines.ts` (four authored lines, each amount distinct so a record
  read off the wrong line cannot match by accident), exported through the
  barrel.
- Only the **same-origin** frame lists the order; the cross-origin frame stays
  the click surface it was, so a read that reached across origins could not pass
  for this workflow succeeding.
- Workflow `extract-order-lines` targets
  `frame:Same-origin checkout/testid:order-line`. The frame rides on the intent,
  which is the only way this read reaches those lines — the picker is top-frame
  only.
- **The fixture's state shape is deliberately unchanged.**
  `e2e/scenario-pages.spec.ts:29` asserts it with `toEqual({ sameOriginClicks:
  1, crossOriginClicks: 1 })`, so adding a field would have broken a spec I may
  not touch. A unit test now pins that shape with a comment saying why.
- Added `tests/scenario.test.ts`; this directory previously had none.

### sensitive-input — a refused read and an excluded one

- New `saved-cards.ts`: three saved cards, each item holding visible card text
  (`card-label`, `card-expiry`) and a `type="password"` unlock code whose value
  is a planted, unmistakable string. The control carries the real signature, so
  a refusal comes from the shared rule (`isSensitiveFieldSignature`) rather than
  from anything this fixture declares about itself.
- Workflow **`extract-card-secrets`** reads
  `code: "testid:card-unlock-code@value"` and expects
  `blocked_by_capability_or_policy` / `web.action.rejected`, with no `extracted`
  entry at all — a refused read returns nothing. `@value` is a real field form:
  `parseExtractField` splits on the last `@` and `value` matches its attribute
  pattern, so this is an attribute read, one of the modes D2 refuses.
- Workflow **`extract-card-labels`** omits the code entirely and succeeds. The
  test pins that each expected record's keys are exactly `label` and `expiry`:
  excluded means absent, not masked (D12).
- A unit test asserts the planted string **is** on the page but appears nowhere
  in the manifest — the page-side half of the bundle scan, so a bundle that
  later contains it has taken it off a sensitive control rather than from a
  fixture that never planted one.

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | Passed, no diagnostics. Covers `tsconfig.e2e.json` too. |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` (first) | `# tests 225 # pass 224 # fail 1` |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` (after fix) | `# tests 225 # pass 225 # fail 0` |
| `node scripts/structure-audit.mjs` | `structure-audit: 2 violation(s) across 1 rule(s)` — both pre-existing, neither mine |
| `pnpm --filter … test` (final, after mutations reverted) | `# tests 225 # pass 225 # fail 0` |

The one failure was **my own test**, not the fixture: I asserted
`!html.includes('data-testid="feed-sentinel"')`, but the client script always
contains that literal selector, so the check could not tell the sentinel
*element* from the script that looks for it. The element was genuinely absent.
The assertions now match element markup; the same flaw in the mirrored
`load-more` check was fixed with it.

Both structure-audit violations are in the `working-docs` rule and outside my
ownership: `docs/working/first-class-data-extraction-plan.md` is 915 lines
against an 800-line threshold, and `docs/working/README.md` is out of date. I
edited neither. The only scenario-lab findings are two pre-existing advisory
warnings (`e2e/` file count; `product-catalog/format.ts` exports), neither in a
directory I own.

### Mutation testing, per fixture

Each distinguishing change was removed, the suite run, and the change reverted.
All four were caught by their own fixture's row, and the revert check found no
mutation text left behind.

| Fixture | Mutation | Row that failed |
| --- | --- | --- |
| data-table | `LARGE_INVENTORY_ROWS` 2,000 → 500 (below the cap) | `large-table arms 2,000 distinct rows…` and `the large table renders every row…` |
| infinite-feed | `loadMore` forced false, so the sentinel always renders | `the load-more mode replaces the sentinel with a button…` |
| iframe-checkout | same-origin frame stops listing order lines | `the same-origin frame lists every expected order line…` |
| sensitive-input | unlock code `type="password"` → `type="text"` | `the saved cards are a repeating structure…` |

## Not verified

- **No Playwright spec was run** (the brief forbids it), so nothing here is
  browser-verified. Unproven in a browser: the Load more button actually
  appending pages; the scroll-paginated read reaching the end of the feed; the
  frame-qualified extract resolving across the frame boundary; the refusal code
  a real run reports for the password field (that needs the extension and Core).
- **The two new paginated workflows cannot run on the Lab today.** The Lab's
  extract reader follows only `next` pagination and throws `fixture.invalid` for
  any other mode (`test-runner/src/scenario-steps/extract-records.ts`,
  `nextPagination`). `extract-until-end` (scroll) and `extract-by-load-more`
  (loadMore) will fail that way until the reader learns those modes. The report's
  X5.4 asks for these modes regardless, so I authored them; someone must teach
  the reader before these rows are runnable.
- `truncated: true` and the 1,000-record cut-off are declared, not observed: the
  page has 2,000 rows, but nothing here exercises the extraction engine.
- The "no planted string anywhere in the bundle" check is a bundle/e2e concern.
  I verified only its unit-level halves: the page carries the string and the
  manifest does not.
- The `large-table` page is heavy — 2,000 rows plus eight embedded sort views,
  roughly 400 KB. Deliberate: it keeps sorting working on the large table with
  no special-casing in the renderer. Not measured in a browser.

## Open questions or contradictions found

1. **The brief contradicts itself on W11's records.** It requires "records for
   W11" and forbids touching `apps/scenario-lab/e2e/**`. But
   `e2e/infinite-feed.spec.ts:85` asserts
   `expect(workflow.expected.extracted).toEqual([{ step: EXTRACT_STEP, count: 40 }])`
   and `:144` the same for `count: 25`. Both are exact-equality checks, so both
   now fail at runtime — this is not a type error, and
   `pnpm … check` (which does compile the e2e project) stays green, so it will
   only surface when the spec is run. I implemented the requirement and left the
   spec alone. **Someone who owns that file must update those two lines.** Note
   the X5.4 report's own partition (Part 5, "Workers and owned files") gives
   each fixture worker `apps/scenario-lab/e2e/<id>.spec.ts`, so my brief's
   "must not touch" is narrower than the plan it implements.
2. **Which seed should infinite-feed's records be written for?** A run uses the
   scenario's declared seed, 116. That spec pins `labSeed: 42` and derives its
   own expectations from `feedItem(42, …)`. I wrote the manifest records for 116
   — correct for a real run — which means the spec's seed and the manifest's now
   disagree. Two ways out: move the spec to seed 116, or make the feed content
   seed-independent the way data-table's fixed catalog is
   (`table-state.ts`: "the catalog is fixed so expectations hold under any lab
   seed"). The second is more robust and would let records hold under any seed,
   but it changes fixture behaviour beyond this brief, so I did not take it.
3. **An "excluded column" cannot be expressed as a variant.** The brief asks for
   "an excluded-column variant". A variant never changes the recording script,
   and the scenario contract's `fields` map has no way to say
   `handling: "exclude"` — that lives in the domain's extract request (D12). So
   the excluded case is a sibling **workflow** (`extract-card-labels`) whose
   step simply does not name the column, which is what D12 says exclusion is:
   left out entirely, never read. If the intent was to exercise the domain's
   `handling: "exclude"` field, that needs a contract change in
   `packages/test-contracts`, which I do not own.
4. `empty-table`'s naming: I made `empty-table` the workflow (the one that
   tolerates an empty list, declaring `minItems: 0`) and `no-rows` the variant
   that actually empties the table. The brief names only "`empty-table`
   (`minItems: 0`, count 0)", which spans both.
