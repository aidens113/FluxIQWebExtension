# t730-b4-extraction-lists: list-extraction specs on realistic scenarios only

## Outcome

Done. All five owned specs now open only realistic scenarios: professional-network, company-website,
social-network-feed, photo-social, bigbox-retail and everything-store. Three tests that no realistic
page can carry became Node unit tests beside their subjects. One synthetic test was deleted because an
existing realistic test proves the same thing (citation below). The final headed run of all five specs
passed 34 of 34, and the three new unit files passed 9 of 9. Writing these tests surfaced three product
defects. They are listed under open questions. None is fixed here, because extension `src/**` is out
of scope.

## What changed and why

Every expected record comes from the scenario's exported data, except the bigbox reviews (see the hooks
below):

- **people search:** `peopleResultsPage`, `peopleMatches`, `peopleRecords`, `profileHref`
- **price list:** `PRICE_LIST`, `priceText`
- **social feed:** `feedPlanFor`
- **sent invitations:** `pendingSent(createNetworkState())`
- **team grid:** `teamCardsFor`, `TEAM_BATCH_SIZE`
- **cross-border search:** `searchResults`. It was used only in an attempt that was dropped.

Each site's interruptions are handled the way a returning visitor's would be. Consent, newsletter,
chat, notifications and promo are answered through the site's own `/api` mutations. The store's
browser check is passed through its own button. The `quiet-feed` variant is armed through `set-mode`.

| spec | test (old) | capability | disposition | new home (file and test) | headed run |
| --- | --- | --- | --- | --- | --- |
| extract-list-catalog | page one: text + raw href | records are page text and raw attributes | Retarget | catalog: "page one: every card's text and its link's raw href" (professional-network people search) | pass |
| extract-list-catalog | every page via Next | in-place Next reads each new page, not the stale one | Retarget | catalog: "every page: Next is followed to the end of the list…". Gives 23 from 3 pages, `no_following_page`, `earlierPageRepeats: 1` | pass |
| extract-list-catalog | maxPages truncated | bound stop is `truncated` | Retarget | catalog: "maxPages: stopping with a page left…". Gives 20 from 2 pages, address `page=2` | pass |
| extract-list-catalog | maxItems truncated | record bound | Retarget | catalog: "maxItems: the record list is bounded…" | pass |
| extract-list-catalog | column no card has | an unrequired blank column is stated, null cells | Retarget | catalog: "a column no card has is stated…". The column is `email`; result cards have no mailto | pass |
| extract-list-catalog | item selector matches nothing | `output_not_observed` and render-window account | Retarget | catalog: "an item selector matching nothing…" | pass |
| extract-list-catalog | minItems 0 | an empty list may succeed | Retarget | catalog: "minItems: 0 lets an empty list succeed" | pass |
| extract-list-catalog | timeoutMs | `timed_out` with the pages read | Retarget | catalog: "timeoutMs: a read that outlasts it…". Budget is 300 ms against the site's 700 ms skeleton | pass |
| extract-list-catalog | numbered vs Next | numbered visits each page once, ends on the last, and matches Next | Delete | `extract-list-continuation.spec.ts` "numbered: the people search is read across all three pages, each person once". Extended to assert it ends on page 3 (address and `aria-current`). The catalog Next test asserts the same `peopleMatches` records | pass |
| extract-list-catalog | text-variant price | text rewritten after load is read as now rendered | Retarget | `extract-list-table.spec.ts` "prices the VAT switch redrew are extracted as the page now renders them" | pass |
| extract-list-catalog | structured field kinds | text, attribute, link, optional null, excluded field | Retarget | catalog: "each kind reads what it names…" | pass |
| extract-list-catalog | required field missing | explicit `required` still fails | Retarget | catalog: "a required field the page cannot read…" | pass |
| extract-list-catalog | (new) | the data has a list longer than one page | New | catalog: "the scenario's own search spans three pages of ten…" | pass |
| extract-list-table | column: header | `column:` reads the cell under its header (the `th scope=row` cell too) | Retarget | table: "column: each field reads the cell under its header" (company-website servicing table) | pass |
| extract-list-table | column-reorder | header lookup survives a column reorder | Unit | `apps/extension/src/content/extraction/tests/field-reader-column.test.ts` (2 tests) | unit pass |
| extract-list-table | missing header blank | a missing header is a stated gap, never another column | Retarget | table: "a column header the table does not have…" | pass |
| extract-list-table | column spec | `{kind:"column"}` equals the grammar, padded header included | Retarget | table: "a column spec reads the cell under its header…" | pass |
| extract-list-pagination | scroll to end | scroll reads each unit once to the end | Retarget | pagination: "scroll: the feed is read to its end, each unit once". Gives 34 from 8 pages, `scrolled_to_end` | pass |
| extract-list-pagination | maxScrolls | scroll bound is `truncated` | Retarget | pagination: "scroll: maxScrolls stops the read…". Gives 15 from 3 pages | pass |
| extract-list-pagination | end-early | a feed that ends early is read to that end | Retarget | pagination: "scroll: a feed that ends early…" (`quiet-feed` variant). Gives 19 from 5 pages | pass |
| extract-list-pagination | auth-gate | an empty list on a sign-in gate is `auth_required` | Retarget | pagination: "an empty list on a sign-in gate is auth_required" (photo-social `/accounts/login/`) | pass |
| extract-list-pagination | appending Next | a `next` control that appends reads each item once | Retarget | pagination: "an appending Next reads each review once" (bigbox See more reviews). Gives 6 from 2 pages. The stop reason is not asserted because of defect D2 | pass |
| extract-list-pagination | loadMore all + vanished control | appended rows read once, and a hidden control ends the list | Retarget | pagination: "loadMore: appended rows are read once…" (professional-network Sent invitations, with the Retry handled). Gives 36 from 4 pages, `control_absent` | pass |
| extract-list-pagination | loadMore capped (same test) | loadMore bound is `truncated` | Retarget | pagination: "loadMore: maxPages stops the read…" (company-website team). Gives 16 from 2 pages | pass |
| extract-list-pagination | loadMore disabled / aria-disabled | a disabled control is the list ending | Unit | `apps/extension/src/content/extraction/tests/list-reader-load-more-end.test.ts` (3 tests) | unit pass |
| extract-list-pagination | loadMore timeout | `timed_out` mid-advance with the first page | Retarget | pagination: "loadMore: an advance that outlasts timeoutMs…" (team). Gives 8 from 1 page | pass |
| extract-list-pagination | domain cap | an unbounded read stops at 1,000 and is truncated | Unit | `apps/extension/src/content/extraction/tests/list-reader-item-cap.test.ts` (4 tests) | unit pass |
| extract-list-continuation | numbered behind skeleton + check, repeat once | skeleton and check waited for, repeat read once | Delete | same file, "numbered: the people search is read across all three pages, each person once". It now forces the site's security check with two extra searches inside its 3 s window and asserts the site's `challenges >= 1` | pass |
| extract-list-continuation | next: filtered page | a page holding no wanted record is read as empty, and the read goes on | Retarget | continuation: "next: a page holding no record the read wants…". The item selector names 4 people from page 1 and 2 from page 3 | pass |
| extract-list-continuation | continuation token | checkpoint handed over before each control | Retarget | continuation: "with a continuation token…". Checkpoints are 10/1 and 20/2 | pass |
| extract-list-continuation | resume | a document goes on from a handed checkpoint | Retarget | continuation: "with a resume…". Opens on page 3 with a checkpoint of pages 1-2; page 3's repeat of person 20 is already held | pass |
| extract-list-continuation | bad resume refused | a malformed resume is refused | Retarget | continuation: "a resume that is not a checkpoint is refused…" | pass |
| extract-list-continuation | professional-network numbered | (already realistic) | Kept, extended | as above | pass |
| pagination-stop | Next redraws same page | `page_repeated` | Retarget | stop: "a control that redraws the list it was on…" (company-website VAT "ex. VAT" option redraws the same services) | pass |
| pagination-stop | disabled Next | `control_disabled`, without pressing | Retarget | stop: "a disabled Next is the list ending…" (everything-store earbuds page 5, `aria-disabled` span) | pass |
| pagination-stop | ignored Next | `list_unchanged` | Retarget | stop: "a Next the page ignores…" (company-website VAT option already chosen) | pass |

`pagination-stop.spec.ts` did open basic-form, not just mention it in comments, so it needed
retargeting. I first tried the cross-border marketplace's broken "Next ›" div for `list_unchanged`, and
dropped it. The read swaps a script's Next for the pager's following page link, by design in
`page-advance/follow-next.ts`, so it navigated to page 2. The spec header records this.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/extraction/tests/extract-list-catalog.spec.ts content/tests/extraction/tests/extract-list-pagination.spec.ts content/tests/extraction/tests/extract-list-continuation.spec.ts content/tests/extraction/tests/pagination-stop.spec.ts content/tests/extraction/tests/extract-list-table.spec.ts --headed --workers=2`
  printed `34 passed (2.3m)`. This was the final run, after every edit.
- `EXTENSION_TEST_BUILD_LABEL=t730-b4-extraction-lists node apps/extension/scripts/test-extension.mjs extraction/tests/field-reader-column extraction/tests/list-reader-item-cap extraction/tests/list-reader-load-more-end`
  printed `# tests 9`, `# pass 9`, `# fail 0`.
- Targeted typecheck. I wrote a temporary `apps/extension/tsconfig.t730-b4.json` that extends
  `tsconfig.json` and lists only the 8 files above, then deleted it. `npx tsc -p tsconfig.t730-b4.json`
  printed `0` lines matching `error TS`.
- Earlier iteration runs:
  - The first pagination run had 2 failures. Both were team-grid whole reads, which hit defect D1 and
    were retargeted to the Sent invitations page.
  - Bigbox reviews failed once, on the asserted stop text (D2).
  - The cross-border `list_unchanged` attempt failed with "Execution context was destroyed", because
    the read navigated to page 2.

## Not verified

- I did not run the whole-package typecheck or any full suite, per the brief. The lead runs those.
- Each spec ran once headed, in the final combined run, plus the iteration runs above. I did not
  repeat runs to look for flakiness. Timing-sensitive rows are the 300 ms `timeoutMs` budgets, the
  forced security check, and the 900 ms team rate window.
- I did not exercise the Chrome/Edge or Firefox extension build. This is the T2 content harness only.

## Open questions or contradictions found

Product defects. None is fixed, because they are in extension `src/**`:

- **D1. A swallowed first press ends a `loadMore` read early.** On company-website `/team`, the read
  takes the first press of "Show more people" (which only shows a spinner) as the page ignoring its
  control. It ends with the 24 auto-batch people of 28, `succeeded`, `truncated: false`,
  `paginationStop: "list_unchanged"`. A person would press again. A `next` read of the same button
  ends after 8. This conflicts with the "every node retries automatically" rule.
- **D2. A `next` read presses a hidden control.** On bigbox "See more reviews", after the last batch,
  the read presses the now-`hidden` control, waits 10 s, and reports `list_unchanged` ("the page
  ignored its pagination control"). `loadMore` treats a hidden control as the list ending
  (`page-advance/load-more.ts`, `renderedLoadMore`), but `follow-next.ts` `awaitNextControl` has no
  rendered check.
- **D3. A `next` read never presses the page's Retry.** On professional-network Sent invitations, the
  first "Show more" fails and offers a Retry. A `next` read never presses it and ends with 10 of 36
  (`list_unchanged`). `loadMore` presses it (`load-retry.ts`).

Hooks for realistic scenarios. I edited none, because `apps/scenario-lab/src/scenarios/**` is out of
scope:

- bigbox-retail: export the towels' `REVIEWS` from `client/product-script.ts`. The spec hard-codes
  the six headings and cites the file.
- An armable variant that disables, rather than hides, a load-more control at the end of its list.
  Company-website "Show more people" or professional-network Sent "Show more" would do. It would let
  `list-reader-load-more-end.test.ts` also run in a browser.
- An armable company-website variant that draws the price table in another column order. It would let
  the column-reorder row run in a browser again instead of only as a unit test.

Other notes:

- `apps/extension/e2e/content/tests/extraction/tests/scenario-variant.ts` is not my file. After this
  change, no spec in the extraction folder imports it, because other workers' files no longer use it
  either. It may be dead code for the lead to remove.
- The brief allows new unit tests "only for logic you move there". I moved no logic. The three unit
  files test existing `src` logic (`field-reader.ts` `readColumn`, `list-reader.ts` `itemBound`,
  `page-advance/load-more.ts` disabled ending) whose browser rows no realistic page can host. That is
  disposition 3 of the shared brief.
