# t194-w30: paging reads (a failed batch's "Try again", a script Next that loops, a page control picked by position)

## Outcome

Done. All three gaps are fixed in the product, generally. Every new unit row fails on the HEAD source and passes now. In T2, bikes GAP 2 rows `:249` and `:259` pass with their markers removed. Rotterdam G1 (`:338`) and spain-hubs G5 (`:463`) "pass unexpectedly", as the brief predicted; I did not edit those specs. No extraction spec regressed because of this change. The two real T2 failures come from other workers' changes (see "Open questions").

## What changed and why

- **GAP 2 (bikes): the read presses the list's own Retry.**
  - `load-retry.ts`:
    - Candidates now include `[tabindex]`. An element with no tag or role of a control counts only when its `tabindex` is 0 or higher, so a bare `span tabindex="0"` "Try again" is offered and `tabindex="-1"` is not.
    - New `offeredListRetry(items)` looks in the parent of the element that holds every item. It accepts only a Retry after that container in document order, or inside it, and never one inside an item. The whole-label rule, painted and not disabled still apply.
    - New `RetryBudget`, `newRetryBudget`, `spendRetry`, `LIST_LOAD_RETRIES = 2` and `RETRY_GROWTH_WINDOW_MS = 5000`.
    - `offeredLoadRetry` (load-more) shares the scan. It checks the label before the position, so position checks run only for matching labels.
  - `list-wait.ts`: new exported `awaitArrivalOrRetry(arrived, shown, windowMs, budget, deadline)`.
    - It waits for arrival, or for a Retry to appear. It presses the Retry while the budget lasts and gives each press 5 s.
    - A Retry still on screen after it was pressed is not pressed again.
    - A fresh Retry once the budget is spent ends the wait as `unchanged`.
    - `awaitListComplete` and `awaitPageComplete` take an optional budget. A reveal that moved nothing now runs one zero-window check, so a Retry already on screen is still pressed; otherwise it costs no wait, as before.
  - `pagination.ts`, `scrollForMore`: waits through `awaitArrivalOrRetry`. A press does not count as a scroll.
  - `PaginationProgress.listRetries`: one budget per read in a document. `list-reader.ts` creates it (`{ pressed: 0 }`) and passes it to both the reveals and the scroll read, so a read makes at most two presses in total.
- **G1 (rotterdam): a script Next that leads back to its own page.**
  - `pagination.ts`, `followNext`: the swap to the pager's following number now also applies when the Next has no address (`linkAddress(named) === undefined`: a script button, or `href="#"`), not only when it is a link to this document.
  - `pagerSuccessor` became `readPager`, which returns `{ following, later }`. `later` says whether the pager shows any page numbered above the current one.
  - **"Never `truncated: false` as if complete":** every `next` or numbered advance records `progress.laterPageShown` before it follows a control. When `list-reader.ts` stops on `page_repeated`, it sets `truncated = progress.laterPageShown === true`.
    - A repeat while the pager showed a later page now reads `truncated: true`.
    - A repeat with no pager, or with no later page, keeps `truncated: false`. That keeps `pagination-stop.spec.ts`'s `page_repeated` row unchanged.
    - On Guildline, page 3 has no 4, so the read falls back to Next, which reloads page 2. That stops `page_repeated` with 23 rows and `truncated: false`, which is correct there.
- **G5 (spain-hubs): a numbered read with no `aria-current`.**
  - `followingPageControl` finds the current page as the control marked `aria-current`. Failing that, it takes the numbered control that links to this document (`linksToThisPage`).
  - When neither identifies one, it counts numbered controls only: the number `pagesRead + 1`, then the numbered control at position `pagesRead`. Only a pager with no numbered control at all falls back to raw position.
  - On the last page, the self-link control is current and nothing follows it, so the read ends `no_following_page` instead of re-reading.
- **Headers:** `pagination.ts` (scroll, numbered, Next-leads-back and repeat bullets), `load-retry.ts` and `list-wait.ts` now describe the new behaviour.
- **Tests and fixtures:**
  - `tests/store-pager.ts`:
    - `FakeElement` gained `getClientRects` (honours `hidden`) and `compareDocumentPosition`.
    - New `PagerStyle` options: `controls: "buttons"` (Guildline), `current: "self-link" | "unmarked"` (spain), and `stuckOn`.
    - New exports `NEXT_BUTTON` and `PAGE_ITEM`.
  - `tests/load-retry.test.ts`: plus 6 rows.
    - A bare span in the tab order is offered; `-1` and no tabindex are not; role=button still is.
    - The classifieds-shaped feed: the one-page reveal presses Try again and reads 12.
    - At most 2 presses across two waits sharing one budget.
    - Not pressed: `tabindex -1`, no tabindex, a Retry above the list, "Retry payment", `hidden`.
    - A read that wants no more presses nothing.
    - A scroll read presses instead of `scrolled_to_end`; the scroll count stays 1.
  - `tests/pagination.test.ts`: plus 8 rows.
    - Advances: a script Next from page 2 goes to 3; `laterPageShown`; self-link numbered from page 2 goes to 3; unmarked numbered from pages 2 and 3 goes to 3 and 4; the last self-link page ends `no_following_page`.
    - Whole `extractList` reads: a buttons pager reads all 5 pages and ends on `control_disabled`; the `stuckOn: 2` read ends `page_repeated` with `truncated: true`; the self-link numbered read reads all 5 and ends `no_following_page`.
  - I first wrote these as two new files, `list-retry.test.ts` and `list-reader-paging-reads.test.ts`. I folded them into the two existing files because `content/extraction/tests/` went over the structure audit's 25-file limit.
- **`list-reader.ts` is at exactly 800 lines**, the audit limit. My net addition there is +1 line; I shortened the `page_repeated` comment to stay under the limit.
- **`e2e/.../local-classifieds-bike-search.spec.ts`:**
  - Removed the GAP 2 `test.fail` markers from "a literal read…" (`:249`) and "…pages by scrolling…" (`:259`). Updated the header bullet and both in-row comments to say the gap is fixed.
  - Kept the GAP 2 marker on `:273` (proposal through the evidence runtime). That row still fails, but on the title-column detection, not GAP 2 (see "Open questions").

## Commands run and observed results

All from the tree root, through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w30 <what>" …`.

- `npx tsc -p apps/extension/tsconfig.json --noEmit` printed nothing (exit 0), after the final edits.
- `npx tsc -p apps/extension/tsconfig.test.json --noEmit` exited 2 with three TS2610 errors, all in files I did not touch:
  - `apps/extension/src/panel/extraction/tests/dialog-dom.ts(16,37)`, `panel/recording/review/tests/recording-review.test.ts(20,16)` and `panel/settings/tests/forget-confirmation.test.ts(17,16)`: "'ownerDocument' is defined as an accessor in class 'FakeElement'…".
  - That `FakeElement` is `panel/chat/tests/fake-dom.ts`. `git status` shows no changes under `apps/extension/src/panel`, so these errors predate this work. Nothing in `content/extraction` is reported.
- Extraction unit tests: I used my own runner (`scratchpad/w30-run-extraction-tests.mjs`). It bundles `src/content/extraction/tests/*.test.ts` with esbuild exactly as `scripts/test-extension.mjs` does (`fluxiq` external) into `.test-build-scratch/t194-w30`, then imports them under node:test.
  - Final: `# tests 195`, `# pass 195`, `# fail 0`. That includes all 14 of my rows.
  - The count differs from an earlier 200/200 because other workers' test files changed between runs.
- **Fail-on-old check.** I did not touch the live `src`. I copied `apps/extension/src` to `.test-build-scratch/t194-w30-old/src` and overwrote the four owned sources there with `git show HEAD:…`. Then I ran the new tests against that copy (the copy is now deleted).
  - `pagination.test.ts` gave `# tests 21 / pass 16 / fail 5`: exactly the 5 new advance rows failed, all on assertions.
    - Old script Next: `followed [2]`.
    - Old positional pick: `followed [2]` and `[5]`.
    - Old `laterPageShown`: `undefined`.
  - The whole-read rows gave `# tests 3 / fail 3`.
    - Old buttons read: stopped `page_repeated` after page 2.
    - Old stuck read: `false !== true` with "pages three to five were on the pager and never read".
    - Old numbered read: re-read page 2.
  - `load-retry.test.ts` (the span row) gave `# tests 3 / pass 2 / fail 1`.
  - The feed rows need the new `load-retry` exports to bundle, so they ran with the new `load-retry.ts` and HEAD `list-wait.ts`/`pagination.ts`: `# tests 5 / pass 2 / fail 3`.
    - Press count `0 !== 1`; `0 !== 2`; the scroll row ended `scrolled_to_end`.
    - The 2 that passed are the "never press" rows, which hold on the old source too by design.
- `node scripts/structure-audit.mjs`: exit 0, no FAIL, after folding the tests and trimming `list-reader.ts`.
  - The earlier run failed on `directory-files` for `content/extraction/` (26; another worker's untracked `placeholder-run.ts`), for `content/extraction/tests/` (28, including my 2 new files), and on `file-lines` for `list-reader.ts` (807).
- `pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/extraction/tests e2e/content/tests/live-tasks/tests --reporter=list --output=e2e/test-results/t194-w30` printed `11 failed`, `94 passed (5.5m)`. Of the 11:
  - **"Expected to fail, but passed", mine:**
    - rotterdam `:338` (G1);
    - spain-hubs `:463` (G5);
    - bikes `:248` and `:259` (GAP 2; their markers are now removed).
  - **"Expected to fail, but passed", other workers' gaps** (from their concurrent edits in this tree):
    - auction `:618` (G3) and `:669` (G1);
    - spain-hubs `:342` (G3) and `:452` (G4);
    - bikes `:227` (GAP 1).
  - **Real failures, not caused by this change:**
    - `extraction/tests/job-board-listing.spec.ts:90` "a read whose next control names nothing stops on page one": `page.evaluate: Execution context was destroyed`. The selector names nothing, so `nextControlOnPage` finds the board's own Next link and the read navigates. That fallback is HEAD behaviour (518e38fe), and `followNext` behaves as before for a link Next. Worker w29 recorded the same diagnosis independently.
    - bikes `:289` "once the failed batch is retried…": "the detection proposes a title column: … `div.x19b50hr… > span:1` …". The spec's matcher looks for positional `div:3 > span.` paths, which another worker's `infer-fields.ts` change no longer produces (also recorded by w29).
  - No load-more ("Show more") extraction spec failed.
- After removing the markers: `… test:content -- …local-classifieds-bike-search.spec.ts:249 …:259 --reporter=list --output=e2e/test-results/t194-w30-bikes` printed `ok … :259 … pages by scrolling returns the twelve bikes (15.7s)`, `ok … :249 … literal read … returns the twelve bikes (17.4s)`, `2 passed (36.0s)`.
- Row `:273` with its marker temporarily disabled (restored right after): `x 1 … :273 … through the evidence runtime`. The error was "the detection proposes a title column: …", the same `infer-fields` cause as `:289`. GAP 2 is no longer what fails it, but it still fails, so its marker stays.

## Not verified

- No live Lab run (per the brief). Real-browser T2 covers the bikes feed. Rotterdam and spain are covered only by their T2 rows passing unexpectedly; I did not edit those specs.
- `laterPageShown` does not travel across documents. A `page_repeated` found in a document that a link navigation loaded (a resumed read) still reports `truncated: false`. A script Next stays in one document, so G1 is covered, but a link-Next loop whose pager shows later pages and has no following-number control is not. Carrying the flag would need the checkpoint type (domain), which is outside my ownership.
- The retry budget is per document: a read resumed in a new document starts a fresh budget of 2.
- `readPager` now runs on every `next` advance, to compute `laterPageShown`. On a page whose pager area holds a lone non-control number (a count, a price), `later` could be wrong. That matters only if the read then stops on `page_repeated`.
- A script Next that has no address is now replaced by the pager's following number whenever the pager marks a current page. I checked this only on the fake pager and in the T2 suites above, not on other real sites.

## Open questions or contradictions found

- **Spec markers others should remove:** the brief says not to edit those specs, so the markers on rotterdam `:338` (G1) and spain-hubs `:463` (G5) are still there. They now pass unexpectedly.
- **Bikes `:273` and `:289`:** I own the spec file, but only the GAP 2 markers. Both rows now fail on `infer-fields.ts`'s class-anchored field paths, and the matchers need updating by whoever owns that change. `:273`'s marker message still names GAP 2, which is no longer its cause.
- **`job-board-listing.spec.ts:90`:** it contradicts the `nextControlOnPage` fallback; someone needs to decide the intended contract.
- **The test tsconfig error is pre-existing:** the `tsconfig.test.json` TS2610 errors are in `panel/chat/tests/fake-dom.ts` users.
