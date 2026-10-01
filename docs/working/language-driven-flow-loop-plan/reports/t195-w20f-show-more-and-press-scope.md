# t195-w20f: a hidden Show more ends the list; F20's press scope stops below main

## Outcome

Done. Both fixes are in, with tests. The six cases that pin the defects fail on HEAD and pass with the change. The
extension check and the structure audit pass.

## What changed and why

### Fix 1: a hidden load-more control is the list's ordinary end (audit R1)

File: `apps/extension/src/content/extraction/pagination.ts`.

- `pressLoadMore` now gets its control from a new `renderedLoadMore(selector, progress)`.
- The order of checks is now: absent, then hidden (after a grace), then disabled, then the page bound.
- A found control counts as not rendered in either case:
  - it has the `hidden` attribute (`getAttribute("hidden") !== null`);
  - `getClientRects().length === 0`.
- A control that is not rendered is re-queried every 50 ms (`PAGER_POLL_MS`) for up to `HIDDEN_CONTROL_GRACE_MS` =
  1 000 ms, through `waitUntil`.
  - If it renders within the grace, the read goes on with it: the bound test, then the press.
  - If it is still hidden or gone at the end, the result is `ended("control_absent")`.
  - If the command's deadline passes during the grace, the result is `TIMED_OUT`.
- An element with no `getClientRects`, such as a test stand-in, counts as rendered.
- An absent control still ends the list at once, with no grace, as before.
- The header bullet for `loadMore` now describes the rule and gives the Guildline reason.
- How this fits Guildline (`manager-client.ts:45,51`):
  - Guildline sets `hidden` on Show more while it loads, then sets `more.hidden = body.done` in the same task that
    appends the rows.
  - The read only advances after it sees new rows, so by then the final state is set.
  - The press itself and the Retry path inside `waitForMoreItems` are unchanged.

### Fix 2: the main landmark is page-wide in the press scope (audit #4)

File: `apps/extension/src/content/action-runtime/ignored-press/press-scope.ts`.

- `main` moved from `SECTION_TAGS` to `PAGE_TAGS`.
- Role `main` moved from `SECTION_ROLES` to a new `PAGE_ROLES`.
- A new `isPageWide()` checks both. It replaces the `PAGE_TAGS`-only test in the loop.
- A new `roleOf()` is shared by `isPageWide()` and `isSection()`.
- The header now explains the change and states its cost.
- Result: `body > div.page > main > div.atcBar > button` is scoped to `div.atcBar`. The buy-box skeleton removed at
  700 ms and the reviews appended at 900 ms are no longer seen as an answer to the press.

### Tests

`apps/extension/src/content/extraction/tests/pagination.test.ts` has five new cases. Each sets a stub `document`
global with `querySelector` and restores it afterwards.

1. A present control with `hidden` gives `{outcome:"ended", stop:"control_absent"}`, `click` is never called, and it
   takes about 1 s (asserted at least 900 ms and under 3 s).
2. A control with no box (`getClientRects` returns `[]`) also ends the list.
3. With `pagesRead` 3 of `maxPages` 3 and the control hidden, the result is ended, not truncated.
4. A visible control at the bound is still `{outcome:"truncated", stop:"page_limit"}`. There is no click, and it
   takes under 500 ms.
5. A control hidden at first and shown after 200 ms is waited for, and the result is truncated at the bound.

`apps/extension/src/content/action-runtime/ignored-press/tests/press-scope.test.ts` has three new cases:

1. `body > div.page > main > div.atcBar > button` is scoped to `atcBar`.
2. An element with role `main` is page-wide, so the scope is `bar`.
3. A `section` inside `main` still bounds the scope.

`apps/extension/src/content/action-runtime/ignored-press/tests/swallowed-press.test.ts` is a new file. It runs the
real `watchIgnoredPress`, `listenForPressAnswer` and `pressScope`. Its `MutationObserver` stub reports a mutation to
every observer whose target holds the mutated node, as a subtree observer does.

1. Reviews change under `main > section.reviews` 100 ms after the press, in a 300 ms window. Only `atcBar` is
   observed, `seen` is `[]`, and `pressAgain(seen, 0)` is true.
2. The button inside its own bar changes 100 ms after the press. `seen` is `["change"]` and `pressAgain` is false.

## The trade-off the audit names

The cost is a toggle that sends no request and whose only visible change is elsewhere in `main`, outside every
section around the control. Such a toggle is now pressed twice. No existing test depends on `main` bounding a scope:

- In `press-scope.test.ts`, the only `main` is the "further than four levels" case. Its scope is still `a`, and it
  passes.
- `page-press-listener.test.ts` scopes to a `section`, which is unchanged.
- `actions/tests/click.test.ts` fakes the whole watch (`fakeIgnoredWatch`), so the scope cannot affect it.

Every existing test in `ignored-press/tests/` passes.

The risk is limited in three ways:

- A second press happens only when nothing at all was seen: no request, no navigation, no focus move, and no change in
  the scope.
- Nothing allows more than one extra press (`MAX_EXTRA_PRESSES` = 1).
- Controls inside a form, dialog, section, article, aside or region within four levels keep that container as their
  scope.

I did not check bigbox's swatch, slot and radio scopes against the scenario markup. The audit says they are
`pdpLayout`, `section` and `section`.

## Commands run and observed results

- `node .../scratchpad/run-dir-tests.mjs apps/extension w20f content/extraction/tests/pagination.test.ts content/extraction/tests/load-retry.test.ts content/action-runtime/ignored-press/tests`,
  from the downstream root:
  - first run: `tests 54, pass 54, fail 0`;
  - again after the type fix below: `tests 54, pass 54, fail 0`.
- Revert check:
  - I restored both source files from `git show HEAD:<path>` and ran the pagination and ignored-press tests: `pass 46,
    fail 6`.
  - The six failures are the main-landmark scope, the role main scope, the reviews-inside-main watch, the hidden
    control, the boxless control, and the hidden control at the bound.
  - The other four new cases are guards, and they pass on HEAD as expected: visible at the bound, hidden while
    settling, a section inside main, and a change in the press's own bar.
  - I then copied my versions back. `git diff --stat` showed them again: +44/-2 and +31/-8.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w20f check" pnpm --filter @fluxiq-web-extension/extension check`:
  - first run: failed with TS2345 in my new `swallowed-press.test.ts:91`, where `seen` was typed `string[]`. I fixed it
    by typing it `PressSignal[]`.
  - second run: passed with no errors. The build cache did not stamp it: "inputs changed while it ran
    (core:packages/fluxiq/src)". That is a Core edit by someone else, not this brief.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (138 warning(s), 118 baselined)`.
  - It warns on `pagination.ts`: 743 lines against a 400-line advisory threshold, and 11 exported values against 8.
  - Both are advisory and were already exceeded: the file was 703 lines before.

## Not verified

- No Lab, browser or model run, as the brief requires.
- I did not observe a real Chrome or Firefox reading the hidden Show more as ended. I did not observe the real
  `MutationObserver` delivery on bigbox either.
- The `getClientRects` path is exercised only with a stub.
- I did not inspect bigbox's other controls (swatch, slot, radio) to confirm their scopes after the change.
- The e2e `extract-list.spec.ts` was not run, because no full suites are allowed.

## Open questions or contradictions found

- The brief says to stub `document` "as `load-retry.test.ts` does". `load-retry.test.ts` has no `document` stub: it
  only tests `isLoadRetryLabel`. Instead I followed the save-and-restore pattern of `store-pager.ts` in the same
  `tests/` folder.
- The hidden-control grace adds about 1 s to the last page of every load-more read whose control ends hidden. That
  replaces the 10 s failure, or the false truncation, that such a read produced before.
