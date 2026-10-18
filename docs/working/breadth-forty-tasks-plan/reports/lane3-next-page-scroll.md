# lane3-next-page-scroll: worker report

## Outcome

Done. The cause is found, fixed, unit-tested, and confirmed in a real browser on the
social-network-feed scenario. The full suites were not run, as the brief asked.

## Root cause

`apps/extension/src/content/extraction/page-advance/scroll-for-more.ts` at HEAD,
lines 40-43. After each scroll the step waited a fixed 900 ms window
(`SCROLL_GROWTH_WINDOW_MS`, line 22) for a new item. If none came and the window
was at its bottom, it answered `ended: scrolled_to_end` (line 43). It never
checked whether the page was still loading. The feed fetches its batch after the
scroll, marks itself `aria-busy="true"` and appends two placeholder cards
meanwhile. A batch slower than 900 ms therefore left the window at the bottom of
the placeholders when the window closed, and the step called the list ended
while the batch was on its way.

Evidence that this is what happened live (`run-mvcvzwk1-c1d869e4`):
- Step 0031 (exploration `run_node` of Next page on `extraction.2`): `actual: "ended: scrolled_to_end"`.
  Its own `changed` list shows the next batch's posts appearing (`t801` ...
  `t961`, including the Harbourside Runners post the judge later found missing),
  so the batch arrived, but only after the step had decided.
- `extraction.2` carried `pagination: infinite_scroll`, which becomes `{mode:"scroll"}`, so the step went through `scrollForMore`.
- Live batches were slow. The read in step 0025 waited 4.6 s at the bottom of
  the feed and still saw only 5 rows, yet by step 0029 the page held 10. I have
  no explanation for the latency itself (see Open questions).

Reproduced in the T2 content harness (real content bundle, headless Chromium,
social-network-feed, viewport 885x650). I added a 3 s delay to the feed's
`/feed/?cursor=` fetches with `page.route`. On HEAD code, Next page answered
`{"outcome":"ended","stop":"scrolled_to_end"}` after 2280 ms. At that moment the
feed showed `aria-busy="true"`, 7 children and 5 items. 500 ms later it held 10
items. With no delay, and with a 1.5 s delay, HEAD code moved correctly.

A second instance of the same flaw: a next-page step whose list carried no
pagination (`step-page.ts:53` at HEAD, `way === undefined`) only looked for a
pager Next and answered `ended: control_absent` when it found none. A list that
loads as it is scrolled shows no control. Detection marks a list as scrolling
only where the page declares a feed (`detect-structure.ts`), so any other
scroll-loaded list ended there.

## What changed and why

- `apps/extension/src/content/extraction/page-advance/list-loading.ts` (new):
  `watchListLoading(item, first)` reports whether the page shows the list still
  loading. It uses only page structure and reads no page words:
  - `aria-busy="true"` on the list's container or an ancestor of it.
  - `aria-busy="true"` or `role="progressbar"` on or inside the list's tail.
  - A placeholder added to the tail since the watch began: an element with no text, or one marked `aria-hidden="true"`.
  - `moved()`: the tail changed since the last look.

  The tail is the container's non-item children after the last item, plus the
  next 3 siblings of the container. An element added with text, such as an end
  note, is not a placeholder, so a real end is not held open.
- `.../page-advance/scroll-for-more.ts`: when the 900 ms window brings nothing
  and the watch shows loading or movement, the step waits on in `awaitLoaded`.
  It stops when a new item arrives (`advanced`) or the page settles (no loading
  and an unchanged tail for 900 ms). The wait is capped at `LOADING_WAIT_MS =
  15_000` per call, and the command deadline still applies. A Retry offered
  during the wait is still pressed, through `awaitArrivalOrRetry`. Only after
  that does `atBottom` decide `scrolled_to_end`. The header now records the
  live failure and the rule.
- `.../page-advance/found-way.ts` (new): `followFoundWay`. With no way named,
  it follows the pager's Next found from the list. That includes a disabled
  Next (`control_disabled`), a `no_following_page` ending and a following
  page, so a control always beats a scroll. Only when the step ends on
  `control_absent` does it scroll the list for more.
- `.../page-advance/step-page.ts`: an absent way now goes through `followFoundWay`. Header updated.
- `.../page-advance/move-page.ts`: header only.
- `.../page-advance/tests/scroll-loaded-list.test.ts` (new): a synthetic
  scroll-loaded feed in Node (no browser), plus the store pager fake for the
  control-preferred case.

The answer shape is unchanged: no domain or wire change, and nothing under
`domain/src/actions/next-page/**` was touched.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQWebExtension`.

1. New tests: `apps/extension> EXTENSION_TEST_BUILD_LABEL=lane3-scroll node scripts/test-extension.mjs scroll-loaded-list`
   -> `# tests 9  # pass 9  # fail 0`. Proves:
   - a batch within the window moves by scroll;
   - a slow (2.5 s) batch moves by scroll in each of three cases: busy and placeholders, busy only, placeholders only;
   - a feed with nothing more ends `scrolled_to_end` in 918 ms;
   - a feed stuck loading ends `scrolled_to_end` after the bounded wait (15.9 s);
   - with no way named and no control, the list moves by scroll twice and then ends;
   - a named Load more is pressed (`by: "loadMore"`) with 0 window scrolls;
   - a pager Next found with no way named is followed (`by: "next", page: 2`), and a disabled one ends `control_disabled`, with 0 scrolls.
2. The same tests on HEAD's `scroll-for-more.ts` and `step-page.ts` (copied
   back temporarily, then restored) -> `# pass 4  # fail 5`. Tests 2-4 (slow
   batch), 6 (bounded wait) and 7 (no way) fail, so the tests cover the fix.
3. `node scripts/test-extension.mjs src/content/extraction src/content/actions/tests/extract-list` -> `# tests 352  # pass 352  # fail 0`.
   This covers the read's scroll paging, the load-retry scroll test and the page-advance tests.
4. `node scripts/test-extension.mjs next-page` -> `# tests 17  # pass 17  # fail 0`.
5. `pnpm.cmd --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit` -> exit 0, no output.
6. `node scripts/structure-audit.mjs` -> `structure-audit: 1 violation(s) across 1 rule(s)`.
   The only FAIL is `[as-never] apps/extension/src/content/actions/tests/scroll.test.ts:66`.
   That file is untracked and belongs to the concurrent scroll.ts worker; it is
   not mine. My files raise only the advisory warning `[directory-files]
   page-advance/: 20 source files` (it was already past 15 at 18).
7. Real browser, T2 content harness, social-network-feed only. I used a
   temporary spec `e2e/content/tests/zz-lane3-diag/feed-next-page-diag.spec.ts`,
   run with `apps/extension> node scripts/test-content.mjs -- zz-lane3-diag
   --workers=1`, and have deleted it. I ran `test-content.mjs` directly because
   `pnpm test:content` refused: Core's dist is 127 minutes behind its source,
   and Core is being edited by the other worker. Results with the fix:
   - no delay: 7 moves by scroll (5 -> 34 items), then `ended scrolled_to_end` with "No more posts" shown;
   - 3 s batch delay: 7 moves by scroll, 3.9-5.1 s each (5 -> 34 items), then `ended scrolled_to_end`.

   Before the fix, the 3 s delay ended on the first step.

## Not verified

- No live Lab run. It is not clear that the live latency came from the batch
  fetch; a 3 s `page.route` delay reproduces the symptom, but the real source
  of latency in the Lab is unknown.
- I did not run the extension against a fresh Core build; Core's dist was stale and is someone else's to rebuild.
- I did not run full suites (`pnpm check`, `pnpm test`, the whole `test:content`).
- I did not check the no-way scroll fallback in a real browser; it is covered by unit tests only.
- Firefox was not exercised.

## Open questions or contradictions found

- The trial's missing rows have a second cause outside paging. In the trial
  (step 0053) the read already revealed most of the feed itself. The judge also
  says the `where audience contains "Members of"` condition dropped group
  posts, and it stored 1 row. Next page's `ended` there may have been correct
  once the read had loaded everything. The exploration step 0031 is the clean
  instance of this bug.
- The one-page read's reveal (`apps/extension/src/content/extraction/list-wait.ts`,
  `awaitListComplete`, outside my brief) has the same flaw. It gives a revealed
  list 900 ms to grow and calls it complete while the page is busy. In live
  step 0025 it read 5 of the feed's rows while a batch was loading. It could
  reuse `watchListLoading` from `page-advance/list-loading.ts` (not exported
  from the barrel yet).
- With no way named, a list that does not continue now ends `scrolled_to_end`
  instead of `control_absent`, after about 1 s for the pager wait plus about
  0.9 s for the scroll. Both are ordinary-end words (`extract-list.ts`
  `ORDINARY_END`). Core's paging prose may phrase them differently.
- The live batch latency of several seconds on a local Lab server is unexplained.
  Possible causes are the Lab's network guard or server load; I did not investigate.
