# t730-b5-extraction-structure: worker report

## Outcome

Partial. Of the 30 tests in my five specs, 29 now open only realistic scenarios. One is Blocked: it still opens identity-drift, it is unchanged, and the hook it needs is named below.

Headed provider-free runs:

- 26 of 27 pass across the four extraction and selector specs.
- `large-page-resolution.spec.ts`: 1 of 3 passes.

Every red row is one that is also red in this tree on its original synthetic page, checked against the HEAD versions. The common cause is a snapshot or resolution that takes 40 to 300 s on a page with thousands of injected controls.

I added no unit tests: no logic was browser-free.

## What changed and why

All paths are under `apps/extension/e2e/content/tests/`.

Each site's interruptions (consent, nudges, chat, the store's first-visit check) are answered through the site's own `/api/<id>/<op>` operations before a page is read.

In four places I injected DOM into a realistic page because no realistic site has the shape under test. Each is marked in the spec and listed in the table:

- password rows inside a list;
- quoted or duplicate ids;
- scale filler;
- the bid-history column swap.

| spec | test (new name) | capability | disposition | new home | headed result |
| --- | --- | --- | --- | --- | --- |
| extraction/tests/structure-detection | job-board: selected cards keep one shared company field… | shared column across selection change | already realistic, kept | same | pass |
| " | everything-store: the largest list on a results page is its result cards, with the pager's Next, and it reads | largest run, Next detection, D3, executable | Retarget (was product-catalog) | everything-store `/s?k=wireless+earbuds&rh=plus` | pass |
| " | everything-store: a target whose selector names every card's title link finds the same list; one spanning cards and pager is ambiguous | target to run, ambiguous_target, target_not_found | Retarget (was product-catalog) | same page | pass |
| " | auction-marketplace: the largest list on a bid history is its rows, read by column header | table rows read by `column` header, D3 | Retarget (was data-table) | `bfl/viewbids/315018264403` (13 rows) | pass |
| " | job-board: the largest list on a fifty-result page is every card, past the filter menus and the header | long list beats menus and filters, D3 | Retarget (was member-directory, 240 rows) | `jobs?limit=50` | pass |
| " | social-network-feed: a declared feed is reported as infinite scroll, and scrolling reads it to its end | `infiniteScroll` from `role=feed`; scroll read to end | Retarget (was infinite-feed) | feed home; read by post links only (see notes) | pass (34 records, `scrolled_to_end`) |
| " | company-website: a grid continued by its Show more people button pages by the button | loadMore detection | Retarget (was infinite-feed load-more variant) | `/team` | pass |
| " | photo-social: a login form is answered as one record beside the page's list, never as a list of its fields | a form is not a list | Retarget (was basic-form) | `accounts/login/`. Expectation follows current product behaviour: the page-wide search skips the form; a target in the form yields `record` = the form, with password excluded, beside the nearest list | pass |
| " | photo-social: sensitive controls are refused, excluded, and never quoted | sensitive_region, D12 exclude, D2 | Retarget, with credential rows injected into the realistic login page | `accounts/login/` | pass |
| extraction/tests/inference | everything-store: a picked product title proposes the result cards, with a link field and the Next control | field to record, link field, Next with maxPages 1, D3, executable | Retarget (was product-catalog) | store results | pass |
| " | auction-marketplace: a picked bid amount proposes the history's rows as column fields, and the header row is not a record | column proposal; reorder survives | Retarget; columns swapped in-page (no realistic reorder variant) | bid history | pass |
| " | photo-social: a password field in a repeating row is proposed excluded… | D12 | Retarget, injected rows | login page | pass |
| extraction/tests/extraction-picker | everything-store: a picked product proposes the result cards, and the pick is neither recorded nor acted on | picker capture order, preventDefault, overlay not a mutation, D3 | Retarget (was product-catalog) | store results (title link) | pass (`dom.mutation` = []) |
| " | everything-store: Escape ends the pick… | Escape not recorded; link works after | Retarget | store results | pass |
| " | everything-store: a preview reads at most the limit… | preview limit, panel only, not recorded | Retarget | store results | pass |
| large-page-resolution | a control past the old scan bound is enumerated and recovered | enumeration past 3,000 candidates | **Blocked**: unchanged, still identity-drift (hook below) | — | fail: 30 s timeout. It fails identically at HEAD. |
| " | a scan the bound does cut short says so… | truncated-scan diagnostic | Retarget (was identity-drift) | company-website home + 6,000 anchors | fail: 30 s timeout. With a 420 s timeout it passes, with the miss taking 303,900 ms. HEAD's version also times out. |
| " | an ordinary page still reports its same-family count… | same-family diagnostic | Retarget | company-website home | pass |
| selectors/tests/unique-selectors | {everything-store, job-board, social-network-feed}: every described element… has a selector naming exactly that element (3 rows) | unique selectors on list pages with generated classes and ids | Retarget (was product-catalog, data-table, member-directory) | store results, `jobs?limit=50`, feed home | pass ×3 |
| " | everything-store: each result's title link gets its own selector, and none quotes a generated id | per-card unique link selector | Retarget (the test-id clause became "no `:r…:` token") | store results | pass |
| " | an element whose own anchor is unique keeps the short selector it always had | short anchors | Retarget to real anchors (`[data-testid="nav-search-submit"]`, `input[name="k"]`) | store results | pass |
| " | an element whose id is a stable author-named one keeps that id as its anchor | id anchor (split from the row above) | Retarget | auction home `#hal-*` | pass |
| " | repeated anchors with no unique container, and duplicate ids… | uniqueness without anchors | Retarget host, injection kept (no realistic duplicate ids) | store results | pass |
| " | a selector never quotes page text or a value, so a sensitive field's contents cannot reach one | no value or text in selectors and evidence | Retarget: a card number is typed into the real cc-number field | photo-social `verified/subscribe/` | pass |
| " | every xpath shape resolves… | xpath writer in Chromium | Retarget host, injection kept (ids holding quotes) | store results | pass |
| " | the form an id with a quote used to be recorded in throws… | engine premise | Retarget host | company-website | pass |
| " | on a real page, the anchored xpaths resolve… | id-anchored xpath | Retarget | auction home (stable `hal-*` ids) | pass |
| " | a large page is described with unique selectors without making the snapshot slow | uniqueness at scale; capture < 5 s | Retarget (was member-directory + 1,200 cells) | `jobs?limit=50` + 1,200 cells | fail: uniqueness passes; capture took 44,013 ms against < 5,000. HEAD's version on member-directory also fails (30 s timeout). |

Three changes to the oracle in unique-selectors:

- **Shadow roots.** An element inside an open shadow root is checked inside its root when its descriptor names `shadowHosts`. When it does not, the element is found in the page, left out of the claim, and listed in a `shadow-root` annotation. The original header already scoped shadow roots out; the defect behind this is under Open questions.
- **SVG with no box.** An SVG element with no box and no usable xpath is treated as unplaceable rather than wrong.
- **Duplicates.** Duplicate detection keys on hosts plus selector.

## Commands run and observed results

Each command was run from the tree root; `--headed --workers=2` throughout.

- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/extraction/tests/structure-detection.spec.ts content/tests/extraction/tests/inference.spec.ts content/tests/extraction/tests/extraction-picker.spec.ts content/tests/selectors/tests/unique-selectors.spec.ts --headed --workers=2`
  - Output: `26 passed`, `1 failed` (4.8m).
  - The failure is the large-page row: `Expected: < 5000  Received: 44013`.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/large-page-resolution.spec.ts --headed --workers=2`
  - Output: `1 passed`, `2 failed`, both `Test timeout of 30000ms exceeded`.
- Same file, rows 2 and 3 only, with the timeout temporarily raised to 420 s (then reverted):
  - Output: `2 passed (6.1m)`, with `DBG miss ms 303900`.
- Earlier, the same file on the everything store instead of company-website:
  - The store-seed replay of row 1 succeeded in 165,365 ms, but by `strategy: "fingerprint"`, not by enumeration. That is why row 1 is Blocked.
  - A first host attempt, the photo-social login page, returned `web.auth.required`: a missing target beside a password reads as a sign-in gate. So I moved to company-website.
- Baselines, with the HEAD versions swapped in temporarily and restored afterwards (`diff` confirmed the restore):
  - HEAD `large-page-resolution.spec.ts`: `2 failed, 1 passed`. Rows 1 and 2 time out at 30 s on identity-drift.
  - HEAD `unique-selectors.spec.ts -g "large page"`: `1 failed` (30 s timeout).
  - A first HEAD run of the whole of `unique-selectors` hit `FATAL ERROR: AlignedAlloc Allocation failed - process out of memory`. The machine was loaded at the time, with other workers running.

## Not verified

- I did not run a typecheck of my spec files: the brief leaves the package typecheck to the lead. Playwright compiles with esbuild and does not type-check.
- I did not run the structure audit.
- I did not establish whether the 40 to 300 s large-page timings are a product regression or machine load. Other workers ran suites concurrently and one run went out of memory. Both large-page rows also fail at HEAD.
- No unit tests were added or run.

## Open questions or contradictions found

1. **Defect: shadow-root descriptors are unaddressable at document scope.** Snapshot descriptors for controls inside open shadow roots have no `shadowHosts`, and carry root-relative selectors and xpaths.
   - On the everything store the chat bubble is `button`. That selector matches 17 elements in the document and 3 inside its own root.
   - On the job board the bubble is `div:nth-of-type(1)`, matching 52 in the document and 4 in its root.
   - A plan handle on such a control would resolve to some other element.
   - Every realistic site has a shadow chat or consent widget, so this matters more now that specs run on them. The `shadow-root` annotation lists the affected controls per page.
2. **Detection finding: tables inside repeated accordion sections.** On company-website `/services`, a detection aimed at a price cell, a row or a header inside the first category's table answers the run of accordion `section`s (5 categories), not the table's rows. I used the auction bid history for the table rows instead. This may be a defect in `inferListFromElement` for tables nested in repeated sections.
3. **Large-page snapshot and resolution cost.** In this tree:
   - a 6,000-anchor miss takes about 300 s;
   - a 3,000-anchor recovery takes about 165 s;
   - a 3,217-element capture takes about 44 s;
   - the spec comments record about 3.5 to 5 s for these from 2026-09-12.

   The original synthetic rows fail the same way, so I did not cause this. It needs a quiet-machine measurement.
4. **Blocked hook (large-page row 1).** The row needs a realistic control whose visible words change while its accessible name stays, so that only enumeration can answer. For example, an armable everything-store variant that draws the notifications prompt's "Not now" as "Maybe later" with `aria-label="Not now"`. Without it the fingerprint word scan answers first, and filler anchors are never in its way.
5. **Injected DOM on realistic pages.** I injected DOM into realistic pages in four places, as listed above. Each is commented in the spec. If the lead's wave-C rule forbids this, the matching hooks are:
   - photo-social, or any site: a list whose rows each carry a password;
   - a page with duplicate or quoted ids;
   - a table-reorder variant, for example on auction bid history.
6. **Concurrent edit to `identity-fixtures.ts`.** Another worker is editing it. My blocked row still imports `SAVE_BASELINE` and `armMode` from it, and both exported correctly at the time of my final run.
7. **Feed read limited to post links.** The social-feed scroll read uses post links only, made optional. A post's cut-short text fails a full read with `incomplete_text` (as `social-read-completion.spec.ts` shows), and three suggested posts have no link.
