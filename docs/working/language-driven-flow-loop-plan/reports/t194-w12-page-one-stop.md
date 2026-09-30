# t194-w12: a paginating read that stops on page 1 with `control_absent`

## Outcome

Done. The cause is in the Flow run 6 actually played, not in any change to the
paging code: that Flow's `next` was `a:nth-of-type(6)`, not `(4)`. The fix
makes a `next` read find the page's own Next when the authored selector names
nothing, or names another page's control, and gives a page that shows its items
but no way forward a short, bounded wait for its pager. New tests use the
store's pager markup and fail without the fix. One related defect is outside my
ownership and is written up under Open questions: a paginated read never loads
a page's lazily loaded results.

## 1. Why run 6 found no next control on page 1

**The brief's premise is wrong: run 6 did not play `a:nth-of-type(4)`.** The
Flow source on disk
(`.work/run-munv53gt-a0e6f545/.../flows/*.main.graph/source/flows/*.flow.ts`)
is the version written *after* the playback. The run's `project.sqlite`
(`graph_nodes`, read-only through `node:sqlite`) holds both:

| node | created (UTC) | `paginate` |
| --- | --- | --- |
| `node.bootstrap.1087466e1d5ee18d.main.s6` (rev 2, bootstrap import) | 08:54:10.614 | `next: "main > div:nth-of-type(2) > div > nav > a:nth-of-type(6)"`, `maxPages: 10` |
| `node.bootstrap.5aa64708ef9d2185.main.s6` / `.s7` (rev 3, re-author) | 08:59:19.832 | `next: "... > nav > a:nth-of-type(4)"`, `maxPages: 10` |

The playback in `snapshots/flow-lane.json` (`actions[5]`, 08:54:36.084) is node
`1087466e1d5ee18d.main.s6`, so it ran the `(6)` selector.

**`a:nth-of-type(6)` names nothing on the store's page 1.** I rendered the
store's own results pages through its built `routeStore`
(`apps/scenario-lab/dist/scenarios/everything-store/route.js`, same markup as
`src/.../pages/results/pagination.ts:16-35`; the store is unchanged since
`defcbe2d`). The pager's children, page by page:

| page | pager children | `a:nth-of-type(4)` | `a:nth-of-type(6)` | Next is `a` # |
| --- | --- | --- | --- | --- |
| 1 | span,span,a,a,span,a,a | Next | none | 4 |
| 2 | a,a,span,a,span,a,a | "5" | none | 5 |
| 3 | a,a,a,span,a,a,a | "4" | Next | 6 |
| 4 | a,a,a,a,span,a,a | "3" | Next | 6 |
| 5 | a,a,a,a,a,span,span | "3" | none | (disabled span) |

Previous is a `span` on page 1 and an `a` from page 2 on, and the numbers shown
move with the page. So `(6)` was authored while the tab showed page 3 or 4, and
from page 1 it names nothing. The re-authored `(4)` names Next on page 1, then
page "5" on page 2, then "3" on pages 4 and 5. Run 4's `(4)` read "5 pages" by
visiting pages 1, 2, 5, 3 and 4, which this table predicts.

**The kept evidence rules out the other two hypotheses.** Run 6's s6 capture
(`objects/sha256/2a/cd/2acd…json`, `web.state.8@…s6.attempt.6:before_action` and
`web.state.9@…:after_action`) shows page 1's pager both before and after the
read: `a` links named "Go to next page, page 2", "Go to page 2", "Go to page 3"
and "Go to page 5", with navigation type `reload` (the soft check's). The pager
had rendered, and the tab never left page 1.

- It is not a changed wait. `followNext` at `8b5fcb9b`
  (`pagination.ts:294-296`) is `document.querySelector(paginate.next)` then
  `if (!next) return ended("control_absent")`, the same as before `defcbe2d`.
  `git diff defcbe2d HEAD` on `list-reader.ts` adds the refused-page, condition
  and checkpoint handling, but nothing before the page-1 advance. `page-render.ts`
  and `list-wait.ts` are unchanged, and `load-retry.ts` is `loadMore` only.
- It is not the pager arriving late. The store's pager is server-rendered HTML
  (`pages/results/search.ts:42`), present from parse, and the capture shows it.
- Nothing rewrites `paginate` on the way to the page (checked
  `domain/src/actions/extraction/read-request.ts:359-380`,
  `content/actions/extract-list.ts:55-60`, and
  `runtime/extract-list-continuation.ts`, which never sets a stop word).
  Nothing the extension or the store injects lands under `main` either: the
  activity overlay sits on `documentElement` in a closed shadow root, and the
  store's banners and modals are appended to `body`.

**Where the positional selector comes from.** `detect-pagination.ts:95`
proposes `next: selectorFor(next)`. For a control with no id or test id,
`selectorFor` writes an `:nth-of-type` chain, which only holds while the pager
keeps the same shape. A model that writes its own selector from a snapshot
gets the same kind of chain.

## 2. Is it reported honestly?

No, before this fix. A page-1 `control_absent` counts as an ordinary end
(`content/actions/extract-list.ts:291`, `ORDINARY_END`). The read answers
`truncated: false`, so the structured summary says the list ended. Only the
prose hedges: `extract-list.ts:285`, "paging stopped on the first page because
the pagination control named nothing there -- check the control's selector,
unless the list has only one page". The judge in run 6 caught it only because
it knew the store had more pages.

After the fix, `control_absent` means that neither the authored selector nor the
page's own pager offers a way forward, even after a one-second watch. It is no
longer "the selector drifted". What is still unreported is that a read
re-resolved its Next, which is the sign that the Flow's selector is stale (see
Open questions).

## 3. Fix

- `apps/extension/src/content/extraction/detect-pagination.ts:132-252` (new):
  `nextControlOnPage(named, run)` decides the control a `next` read follows on
  this page.
  - **Authored control first.** It is followed as authored unless it names
    nothing, or plainly names another page's control (`namesAnotherPage`, :223).
    That means a page number, the control marked `aria-current`, or a label
    reading Previous, First, Last or Back (`OTHER_PAGE_LABEL`, :180). A control
    labelled next, or one whose label says nothing a pager says (an icon), is
    the author's choice.
  - **Otherwise, the pager's own way forward.** The lookup walks out from the
    authored control's parent, then from the list's container, up to detection's
    six levels, and never considers controls inside the list's items. At each
    level it takes the control whose label is the pager's Next or which carries
    `rel="next"` (`PAGER_NEXT_LABEL`, :177). This rule is stricter than
    detection's: "Next day delivery" and "Next slide" do not qualify. Disabled
    ones count (`PAGER_CONTROL_SELECTOR`, :169), so a last page ends
    `control_disabled`.
  - **Failing a label, a page number.** It takes the enabled control numbered
    one more than the page marked `aria-current` (:246).
  - Labels are read locally only, to recognize a control (decision D3).
- `apps/extension/src/content/extraction/pagination.ts:367-409`:
  - `followNext` resolves its control through `awaitNextControl` (:399) instead
    of `document.querySelector` alone.
  - A page that shows items but offers no control gets `PAGER_WAIT_MS` = 1000 ms
    (:391), polled every 50 ms and bound by the read's deadline (which ends it as
    `timed_out`), before it counts as `control_absent`. A read with no items, or
    whose list has no container, does not wait.
  - The rest of `followNext` is unchanged: the disabled check, the page bound,
    the swap when Next leads back to its own page (`pagerSuccessor`), the pace
    wait, the checkpoint and the click.
  - Header updated (:17-23), and one import added (:85).
- Tests:
  - `tests/store-pager.ts` (new) is test support: a fake tree that mirrors the
    store's results page level for level (`main` > bar, layout > rail, column >
    results, widget, pager), with the store's pager copied page for page,
    including Previous as text on page 1 and page 2's Next that leads back to
    page 2. It evaluates the real child-combinator `:nth-of-type` selectors, and
    its links "load" their page when clicked.
  - `tests/pagination.test.ts`: seven new tests through `advancePage`.
    - The fake pager places Next where the store does: fourth `a` on page 1,
      none at sixth, "5" at fourth on page 2, and so on.
    - Page 1 with `(6)` follows Next to page 2.
    - Page 3 with `(6)` follows the authored control to page 4 (regression
      guard).
    - Page 2 with `(4)` follows page 3, not "5".
    - Page 5 with `(4)` ends `control_disabled` instead of going back to "3".
    - A pager drawn 300 ms after the items is waited for and followed.
    - A page with no pager ends `control_absent` after the bounded wait.
  - `tests/detect-pagination.test.ts`: five new `nextControlOnPage` tests.
    - An icon control is trusted as authored.
    - An item's own "Next" link, "Next day delivery" and "Next slide" are never
      chosen, while "Next ›" is.
    - `rel="next"` counts whatever the control reads.
    - The page number after `aria-current` is used when the pager labels no
      Next.
    - A drifted Previous on a last page is no way forward.

Existing fakes (`list-reader*.test.ts`, `actions/tests/extract-list-*`) give
their items `parentElement: null` and no `.next` control, so their reads
resolve nothing and do not wait. They behave exactly as before.

## Commands run and observed results

- Rendering the store's pages (scratch script importing the built
  `dist/scenarios/everything-store/route.js`) printed the table in section 1.
- `node --no-warnings <scratch>/w12-sql2.mjs` (read-only `node:sqlite` over run
  6's `project.sqlite`) printed the three extract nodes with the `(6)` and `(4)`
  selectors and the times above.
- `npx tsc -p tsconfig.json --noEmit` (apps/extension) -> exit 0.
- A quick bundle of `pagination.test.ts` and `detect-pagination.test.ts` with
  the runner's esbuild settings passed: 26 tests, exit 0.
- The same run with `followNext` temporarily put back to
  `document.querySelector(paginate.next)`, then the file restored (`cmp`
  identical) -> `# pass 11`, `# fail 5`: page one (6), page two (4), page five
  (4), the late pager, and the bounded wait (the old code ended at once).
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w12 ext" pnpm --filter @fluxiq-web-extension/extension test`
  -> exit 0; `# tests 1383`, `# pass 1383`, `# fail 0`, `# cancelled 0`,
  `# duration_ms 95818`. The smoke test ran first.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w12 ext check" pnpm --filter @fluxiq-web-extension/extension check`
  -> exit 0 (`extension:check`, 255 s).
- `node scripts/structure-audit.mjs` -> exit 0,
  `structure-audit: passed (126 warning(s), 120 baselined)`, the same count as
  before my change.
  - Warnings on my files, all advisory: `extraction/tests/` has 21 files
    (warned before at 20; hard limit 25), and `pagination.ts` has 701 lines
    (warned before at 662; hard limit 800) and 11 exported values, unchanged.

## Not verified

- No browser: no Lab run, no Playwright content harness (`test:content`), and no
  live read of the store. The fix is proven only on the fake store pager.
  Whether a live run 6 Flow now reads all five pages is the supervisor's next
  live check.
- Run 6's own extension build is gone. `apps/extension/.lab-instances/t194-slot-3/dist`
  was rebuilt at 09:17Z, after the run. What that build did is inferred from
  source at `8b5fcb9b` plus the working tree (whose uncommitted edits near the
  lookup, w10's pace wait, run after it), and from the kept evidence. I did not
  observe it executing.
- The one-second pager wait has not been measured on a real site whose pager
  arrives after its results.

## Open questions or contradictions found

1. **The brief's "same `paginate.next`" came from the post-re-author Flow
   source**, which was written five minutes after the playback. The graph
   database is where the played node's parameters are.
2. **Outside my ownership: a paginated read never loads a page's lazily loaded
   results.**
   - Where: `list-reader.ts:487-505`. A paged read only runs
     `awaitListPresent(item, 1, false, …)`; `awaitListComplete`, which reveals
     the list end, runs only `if (paginate === undefined)`. Later pages wait
     only for `awaitPageRendered`.
   - Effect on the store: each page's last four results (a sentinel fetch, on
     scroll) are never read. Run 6's page 1 counted 15 items, which is the 3
     sponsored plus 12 eager organic cards, and results 13-16 were never
     rendered. The store's expected answer includes page 1's boundary result
     (`tests/scenario.test.ts:80`, `kept(15)`), so even a correctly paging read
     answers short.
   - Proposed change (not applied, not tested): at the top of the page loop
     (`list-reader.ts:508`, before `const shown = …`), add
     `if (pageByPage) await awaitListComplete(item, rejects || order ? Number.MAX_SAFE_INTEGER : Math.max(1, readBound - records.length), progress.deadline);`.
   - Test impact: `revealListEnd` (`list-wait.ts`) calls
     `getBoundingClientRect` and `scrollIntoView`, so the fake items in
     `list-reader.test.ts`, `list-reader-refused-page.test.ts` and
     `actions/tests/extract-list-*.test.ts` would need those two methods, or the
     reveal would need to skip elements that lack them.
   - Cost: at most about 900 ms per page whose reveal moves but brings nothing.
3. **A re-resolved Next is not reported.** A read that followed the pager's Next
   because the authored selector drifted succeeds silently, so the stale
   selector is never seen. Proposal: pass `NextControlChoice.by` ("selector",
   "label" or "number") through `ListExtractionOutcome` and the domain summary
   (`domain/src/actions/extraction/summary.ts`, a closed schema). That spans the
   domain, `list-reader.ts` and `actions/extract-list.ts`, none of them mine.
4. `loadMore` (`pressLoadMore`) still uses its authored selector only. It was
   not implicated here, and the same resolution by label ("Load more", "Show
   more") would fit it.
