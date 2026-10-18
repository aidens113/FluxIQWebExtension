# Report: lane2-pager-current-page

Lane tree `fxwork/t565`, branch `task/t565-a8-lane-2`. Nothing committed.

## Outcome

Partial. The pager fix and every test the brief asked for are done and pass, and both typechecks and the structure audit pass. One existing test, in a file this brief does not own, now fails. Its cause is that test's minimal pager stub, which has no `closest` method; the shared rule now calls it on page controls. The fix is one line in that stub (given below), and a probe showed it is enough.

## What changed and why

All under `apps/extension/src/content/extraction/`.

- `pager-reading/current-page.ts` (new) holds the one rule for which numbered control is the current page: `currentPage(candidates)`, plus `pageControlOf` and `pageNumber`. It tries, in this order:
  1. `aria-current` on the element or on the control it is drawn as;
  2. a numbered link to the document already showing;
  3. the one number that is not a control;
  4. the one numbered control styled apart. That means exactly two distinct class lists, sorted so the order of classes does not matter: one held by a single control and the other by at least two.

  Comments give the reason for each rule and cite run-mvd0pbn9-bad36023 for rules 2 and 4. `pageControlOf` also accepts a control inside the number's element (`<li><a>2</a></li>`), so a numbered way whose `pages` selector names the wrapping item reads the same way.
- `pager-reading/page-address.ts` (new) now holds `linkAddress`, `leadsToThisPage` and `sameDocument`, moved out of `pager-reading.ts`. The move keeps `current-page.ts` from importing back from `pager-reading.ts` (the audit has an import-cycle rule). `sameDocument` now drops parameters with an empty value from both sides before comparing.
- `pager-reading/pager-reading.ts`: `readPager`, `currentPageNumber` and `followingPageControl` all call `currentPage`. The private `PAGE_CONTROL`, `isControl`, `onlyOne`, `isCurrentPage`, `linksToThisPage` and `pageNumber` moved into `current-page.ts`. `followingPageControl` keeps its fallbacks: it counts pages when nothing is current, and when the current control carries no number it takes the next control in the list.
- `pager-reading/index.ts`: the barrel exports the same public names as before, now from the two files.
- New tests:
  - `pager-reading/tests/current-page.test.ts` (8 tests). Each pager is read by all three readers. Covers:
    - aria-current wins even where a number is styled apart (d);
    - a link to this document;
    - `<b>2</b>` among links;
    - the class-marked page;
    - classes in another order count as one list;
    - three pagers where styling picks no page: only one other number, two numbers styled apart, and no two alike.
  - `pager-reading/tests/page-address.test.ts` (3 tests, c): an empty parameter on either side; a parameter with a value still tells documents apart; order, fragment, origin and path behave as before.
  - `page-advance/tests/script-next-pager.ts`, a new fake built on `FakeElement`: a 4-page shop pager shaped like the run's. Every number is an `a[href]`, the current one has an extra class, Next is a `div` whose press changes nothing, and there is a go-to-page box.
  - `page-advance/tests/script-next.test.ts` (5 tests):
    - (a) on page one, `movePage` with `next: 'div[class="pg"]'` answers `{moved, by: "following", page: 2}` and Next is pressed 0 times. This runs for three arrivals: class only, class plus an empty-parameter landing, and plain classes with an empty-parameter landing (the last isolates (c) end to end);
    - page two goes on to three;
    - (b) on the last page, with `next: 'div[class="pg pg-off"]'`, it answers `{ended, stop: "no_following_page"}`: nothing was followed, no press, no marks.

### Callers of `sameDocument`: why the empty-parameter rule is safe for each

1. **`leadsToThisPage` → `followNext` (`unaddressed`).**
   - **What changes:** a Next whose address differs from this page only by empty parameters now counts as leading back here.
   - **What happens next:** such a Next is swapped for the pager's following number when the pager shows one. It ends `no_following_page` only when the pager marks a current page and shows no later one, which is the last page. Otherwise it is pressed as before (`following ?? named`).
   - **Why it is safe:** a server reads an empty field as unset, so that Next does reload this page. Taking the pager's following page is the right move.
   - **Side effect:** such a Next no longer goes through `keepingFollowing`'s dropped-state check. The check only matters for an address that leaves this page's list, and this one does not.
2. **`leadsToThisPage` → `current-page.ts` rule 2.** This is the fix the run needed. Link "1" (`search?q=…`) now matches the landing page `search?cat=&q=…`.
3. **`list-change.ts` `afterListChange` (`elsewhere`).** A link that differs from this page only by empty parameters is no longer "elsewhere", so the move no longer falls back to `window.location.assign` it after an ignored click. Going to that address would load the same document and the same list, so the fallback could only end in `list_unchanged` anyway. No path that used to succeed loses its way forward.

`shown-page.ts` and `numbered-page.ts` call `readPager`, `currentPageNumber` and `followingPageControl`, and now use the shared rule through them.

## Commands run and observed results

From `apps/extension`, unless noted:

- `EXTENSION_TEST_BUILD_LABEL=lane2-pager node scripts/test-extension.mjs src/content/extraction` printed `# tests 316 / # pass 315 / # fail 1`, exit 1.
  - The only failure is `not ok 181 - where the browser gives no status, a page that lost the list is retried as a possible refusal` (`tests/list-reader-refused-page.test.ts:201`, "Missing expected rejection").
  - All 16 new tests show `ok`.
  - The existing page-advance tests (`move-page`, `next-keeps-scope`, `dropped-state`, `list-change`, `applied-controls`) and `tests/pagination.test.ts` all pass.
  - On the first run, a new test (page 2 → 3) failed on a 3-page fake: page 3 was the last page, and the class selector no longer named its Next, so no page number came back. I widened the fake to 4 pages.
- **Cause of test 181:**
  - The test's stub is `{ getAttribute: () => null, textContent: "1" }` (line 196). It has no `closest` or `querySelector`, and `pageControlOf` calls both.
  - Probe: I temporarily guarded `pageControlOf` with `if (typeof element.closest !== "function") return undefined;` and ran `… test-extension.mjs src/content/extraction/tests/list-reader-refused-page`, which printed `# pass 5 / # fail 0`.
  - I then reverted the guard. `grep -c "typeof element.closest"` printed `0`.
  - With methods that return null, the shared rule picks "1" as the only number that is not a control, and moves to nothing. That is the same "no following page" outcome the test relied on before.
- `node_modules/.bin/tsc -p tsconfig.json --noEmit`: exit 0, no output.
- `node_modules/.bin/tsc -p tsconfig.test.json --noEmit` (includes tests and e2e): exit 0, no output.
- At the repo root, `node scripts/structure-audit.mjs` printed `structure-audit: passed (204 warning(s), 638 baselined).` No finding names a file I touched.

## Not verified

- No live browser or Lab run (the brief forbids it), so the fix is not proven on the real scenario page.
- I did not run the whole extension suite or `pnpm check`; I ran only the narrow test run named in the brief.
- The fix for test 181 is not applied, because the file is outside my ownership. Proposed edit at `apps/extension/src/content/extraction/tests/list-reader-refused-page.test.ts:196`:
  `const pager = [{ getAttribute: () => null, textContent: "1", closest: () => null, querySelector: () => null } as unknown as Element];`
  The probe above is equivalent evidence that this is enough.

## Open questions or contradictions found

- **Order risk:**
  - The brief's order puts rule 2 (link to this document) ahead of rule 3 (the number that is not a control) in `readPager` as well. Before, `readPager` tried rule 3 right after aria-current.
  - The risk: a script-driven pager whose address never changes, showing page 2 as `<b>2</b>` while link "1" points to the unchanged address, would now read as page 1.
  - I followed the brief. Rules 1 and 3 still catch every pager that marks its page.
- **Selectors that change on the last page:** when the recorded Next selector names Next by a class that changes on the last page, `pageShownNow` cannot find the pager after the move. The answer then carries no `page` (this was the first-run failure above). That is `shown-page.ts` behaviour, not changed here.
- **Flag parameters:** `sameDocument` treats a valueless flag (`?debug`) as absent too, since its value is empty. That is how the brief worded the rule, but it is broader than search-form empty fields.
