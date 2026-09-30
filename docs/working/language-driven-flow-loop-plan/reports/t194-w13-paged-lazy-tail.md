# t194-w13: a paginated list read reveals each page's lazily loaded tail

Worker report. Tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`. Nothing committed.

## Outcome

Done. Every page of a `next` or `numbered` read is now revealed to its end before it is read. That covers the first page, every
page reached by a control, and a page a new document continues from a checkpoint. A reveal that the command's deadline cuts short
ends the read as `timedOut` with `paginationStop: "deadline"`. It is no longer read as a complete page. Store-shaped tests prove
all 16 results of each page are read, and 4 of the 6 new tests fail when the reveal is removed.

Item 3 turned up something different from the brief's premise. The 10000 is the node's catalog default, and the domain dispatch
already scales it by `maxPages`, so run 7's read had 50 s on the page, not 10 s. The real limit is elsewhere: the scaled timeout
only travelled inside `parameters`, so Core stopped waiting after its gateway default of 30 s. I changed the dispatch to also
send the timeout at the top level of its payload, which is the field Core reads, and added a test.

## What changed and why

- `apps/extension/src/content/extraction/list-wait.ts`
  - `awaitListComplete` now returns `ListCompletion` (`"complete" | "timed_out"`) instead of `void`. It answers `"timed_out"`
    only when the command's deadline ended a growth wait.
  - New `awaitPageComplete(item, want, deadline)` and its `PageWant` type. The bound is the one a single-page read uses:
    - with conditions, a dedupe or a sort, it reveals everything (`Number.MAX_SAFE_INTEGER`);
    - otherwise it wants `max(1, readBound - records.length)` items, plus the items on the page that were already read (a
      page that appends its next items still shows them).
  - `revealListEnd` skips an element that lacks `getBoundingClientRect` or `scrollIntoView`, and treats it as a reveal that
    moved nothing. The existing fakes in `list-reader.test.ts`, `list-reader-refused-page.test.ts` and
    `actions/tests/extract-list-*.test.ts` therefore work unchanged.
  - Header updated: a page-by-page read is revealed page by page, what a cut-short reveal reports, and the skip.
- `apps/extension/src/content/extraction/list-reader.ts` (773 to 790 lines, under the 800 limit)
  - At the top of the page loop, when `pageByPage` is true (`next`, `numbered`, or no mode), it calls `awaitPageComplete`
    before `querySelectorAll`. The loop is the one place the first page, every page reached by a control, and a resumed
    document all pass through. Scroll and loadMore reads are not `pageByPage`, so they keep their own behaviour.
  - The single-page reveal's result is kept too (`revealCutShort`).
  - After a page is read: if the reveal was cut short and the item bound did not truncate the read, it sets
    `timedOut = true` and, for a paginated read, `paginationStop = "deadline"`, then stops. It does not advance.
    Nothing new is added to the summary.
  - Two comments updated: the header (:14-23) and the three-waits comment.
- `apps/extension/src/content/extraction/tests/store-pager.ts` (test support I extended)
  - Geometry: each element takes one 40 px row in document order, and the viewport is 800 px tall. `FakeElement` gained
    `nextElementSibling`, `getBoundingClientRect`, `scrollIntoView` (block end, counts scrolls) and `replaceWith`.
  - A `lazyTail` option, with `STORE_LAZY_TAIL = {eager: 12, lazy: 4, loadMs: 600}` taken from the store's
    `client/search-script.ts` and `timings.ts`. A sentinel sits under the 12th card. Once a scroll brings it within 200 px of
    the viewport, it replaces itself with cards 13-16 after `loadMs`.
  - A page turn now redraws the pager for the target page, updates `document.URL`, and scrolls back to the top. Before, the
    pager and URL stayed on the starting page, so a read of more than two pages was impossible.
  - The selector-step parser accepts `*`, and `StorePage` gained `scrolls()`. `cards` now lists `data-card` elements only.
  - w12's pagination tests still pass on the changed fake: 16 of 16 in `pagination.test.ts`.
- `apps/extension/src/content/extraction/tests/list-reader-lazy-tail.test.ts` (new, 6 tests)
  1. A `next` read over three store pages reads all 48 cards (`1-1..3-16`) and follows `[2, 3]` (page two's Next leads back to
     page two, and the read goes on to page three). It stops on `page_limit`.
  2. A `numbered` read (`pages: "nav > *"`) reads all 32 cards of two pages.
  3. A resumed document (page 2, from a page-1 checkpoint, with a stub `pageHost` that answers 200) reads all 16 of page 2, and
     `itemsSeen` is 32.
  4. A paged read with `maxItems: 10` reads 10 records, stops on `item_limit`, and scrolls 0 times.
  5. The picker's preview (no paginate, `maxItems: 5`) scrolls 0 times.
  6. With `loadMs 1500` and `timeoutMs 500`, the read returns the 12 eager cards with `timedOut: true` and
     `paginationStop: "deadline"`, `pagesRead: 1`, and follows no control.
- `domain/src/output-nodes/extract-list/dispatch.ts` (the item-3 domain file)
  - `webAutomationExtractListDispatch` now puts the node's final `timeoutMs` (scaled or authored) at the top level of the
    dispatch payload as well, when it is a positive finite number. That is the field Core's runtime reads
    (`!FluxIQ .../runtime/io-policy.ts:94`): Core then waits `timeoutMs` plus its 3 s answer margin (`runtime/service.ts:360`),
    and the domain adapter sends it as the gateway command's timeout (`runtime/adapter.ts:90`).
  - The value in `parameters` is unchanged, and the gateway mapping picks `command.timeoutMs ?? parameters.timeoutMs`, so the
    page gets the same number.
  - Header section added.
- `domain/src/output-nodes/extract-list/tests/dispatch-timeout.test.ts` (new, 5 tests)
  - A default or unset timeout on a 5-page read gives 50,000 in both places.
  - `maxPages: 500` is clamped to 50 pages, which gives 500,000.
  - An authored 12,000 is passed through unchanged, and a one-page read gives 10,000.
  - A timeout of 0, -1 or `"soon"` is not sent at the top level.
  - The timeout is sent alongside a record output.

### Item 3: where the 10000 comes from

- `domain/src/output-nodes/extract-list/parameters.ts:35` sets the node's `timeoutMs` default to
  `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 10_000` (`actions/extraction/request.ts:354`). The model (or bootstrap) left or
  wrote exactly that default.
- `dispatch.ts` treats an unset value or 10000 as "left at the default" and replaces it with
  `webAutomationExtractListTimeoutMs(request)`, which is 10 s times `maxPages` (`request.ts:366-370`). For run 7's
  `maxPages: 5` that is 50,000 ms. The debug's "10000 against 9.5 s, 0.45 s of margin" (debug line 218) reads the node
  parameter, not the budget the page had.
- 10 s a page already covers the pace and the reveal. The pace spaces loads 2.5 s apart. On the store, the reveal costs about
  1.5 s a page: a 600 ms fetch plus the 900 ms window the second reveal waits to confirm nothing more comes. So I did not change
  the per-page figure.
- The existing parse caps `maxPages` at 50, so the scaled value is at most 500 s. I added no tighter cap: a 50-page paced read
  needs about 122 s for pacing alone.
- **What would actually have cut a read short is Core's 30 s.** Before this change, the dispatch payload carried no top-level
  `timeoutMs`. Core's runtime command therefore had none, the adapter sent none (`adapter.ts:90`), and Core's gateway waited only
  `commandTimeoutMs = 30_000` (`client-gateway/service/config.ts:21`, `commands.ts:69`) while the page could read for 50 s or
  more.
  - With the reveal, a store page costs roughly 4.5 s (2.5 s pace plus about 1.5 s reveal plus render), so a read of about
    seven or more pages would have been abandoned as `timed_out` with every row lost.
  - The dispatch change closes that gap.

### Item 4: how a cut-short reveal is reported

It uses only the existing fields, `timedOut: true` and `paginationStop: "deadline"`. `truncated` is left as the page-limit and
item-limit logic sets it. `actions/extract-list.ts:66` already turns `timedOut` into a `timed_out` result carrying the records
as evidence and the text "the time ran out before the list ended".

The same applies to a read of one page: if its single-page reveal is cut short, it now reports `timedOut: true` (with no
`paginationStop`, since it does not page). Before, it answered as a complete read.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/extension) printed nothing and exited 0. I ran it after each edit, and last after
  the fake's fixes.
- Targeted tests: esbuild bundles into `.test-build-scratch/t194-w13`, then `node --test`.
  - Before the fake's URL and redraw fix, 2 of the new tests failed. Page 3 was never reached because `document.URL` stayed on
    page 1, so page two's Next looked like a different page and was not swapped. The numbered read picked "3", because
    `nav > a` excludes the current page's span.
  - After fixing the fake: `list-reader-lazy-tail` plus `pagination` gave `# pass 22`, `# fail 0`.
- Mutation check: I changed `if (pageByPage) {` to `if (false && pageByPage) {` at `list-reader.ts:515` and reran the new file.
  - Result: `not ok 1`, `not ok 2`, `not ok 3`, `ok 4`, `ok 5`, `not ok 6`, then `# pass 2`, `# fail 4`.
  - Reverted; `grep -c "false && pageByPage"` printed 0.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (domain) both exited 0.
- `DOMAIN_TEST_BUILD_LABEL=t194-w13 bash heavy.sh "t194-w13 domain suite" pnpm --filter @fluxiq-web-extension/domain test`
  exited 0 with `# tests 987`, `# pass 987`, `# fail 0`. The new dispatch-timeout tests are among them (e.g. `ok 159 - the
  scaled timeout is bounded as the pages are, at fifty`).
- `EXTENSION_TEST_BUILD_LABEL=t194-w13 bash heavy.sh "t194-w13 extension suite" pnpm --filter @fluxiq-web-extension/extension
  test` exited 0 with `# tests 1493`, `# pass 1493`, `# fail 0`. The new tests ran as `ok 767`-`ok 772`.
- `bash heavy.sh "t194-w13 extension check" pnpm --filter @fluxiq-web-extension/extension check` exited 0. The build cache
  reported `"step":"extension:check","reason":"inputs changed ..."` and `"ms":41043`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (128 warning(s), 120 baselined).` Relevant advisory
  warnings:
  - `content/extraction/` has 25 source files, which is at the hard limit of 25. That is why no new module was added (see Open
    questions).
  - `extraction/tests/` has 24 files.
  - `list-reader.ts` is 790 lines.

## Not verified

- No live browser and no Lab run, as the brief says. The real store's reveal, the real `IntersectionObserver` and scroll
  timing, and Chrome's `scrollIntoView` on the store's page are proven only through the fake.
- The e2e Playwright content specs (`e2e/content/tests/extract-list.spec.ts`) were not run. A paginated fixture whose list end
  is below the fold will now scroll it into view and wait up to 900 ms for growth on each page, which can change their timing.
- The Core-side effect of the top-level `timeoutMs` was read from source and not exercised: Core's runtime waiting
  `timeoutMs + 3 s`, and the gateway doing the same. No Core test was run. I did not check whether anything in Core or the Lab
  caps a command's wait below the scaled value; the Lab's own run and settle timeouts should be checked against reads of up to
  500 s.
- `pnpm check` (repository-wide) and `pnpm build` were not run. I ran only the extension check.

## Open questions or contradictions found

1. **The brief asked for a new module under `content/extraction/`, but that directory has 25 source files, the structure
   audit's hard limit** (`limits.directoryFiles: 25` in `.structure-baseline.json`; the directory is not baselined).
   A 26th file would fail `pnpm check`. The new logic went into `list-wait.ts` (172 lines), which already owns the reveal and
   is its natural home. Splitting the directory is a structural task outside this brief.
2. **The debug's timing premise for item 3 is wrong.** It read `timeoutMs 10000` off the node, but the page had 50 s. The
   gap that mattered was Core's 30 s gateway default, which I fixed in the dispatch. The supervisor may want to correct
   the run-7 debug (line 218) and check whether any earlier "timed out" extract_list verdicts past 30 s were Core
   abandoning a read that was still running.
3. **The cost of the reveal on every paginated read.** A page whose list end sits below the fold now pays one scroll, plus the
   900 ms growth window when nothing more loads. On the store that is about 1.5 s a page: 600 ms fetch and 900 ms confirming.
   A 50-page read therefore spends about 75 s on reveals. The per-page budget covers this, but a faster "nothing more"
   signal would cut it; for example, stop when the sentinel is gone and the last item is in view. That design is not part of
   this brief.
4. **Reporting a reveal that did not finish.** The "Instrumentation gaps" table in the run-7 debug asks for a "list end not
   revealed" signal. With this change, an incomplete reveal always ends the read as `timedOut`/`deadline`. A reveal that ran
   out of its `LIST_REVEALS` (4) still reads the page as complete, silently. No summary member was added, as the brief says.
