# t623 next-page-keeps-list-scope: worker report

## Outcome

Done. A `next` move now compares Next's address with the current page's query before it presses anything:
- If Next drops query state and the pager's following page number keeps all of it, the move follows that number (`by: "following"`).
- If nothing keeps the state, the move fails `page_fault` and presses nothing.
- If Next keeps all of the state, nothing changes.

## What changed and why

- `apps/extension/src/content/extraction/page-advance/dropped-state.ts` (new): `droppedQueryState(target, here, currentPage)` counts the parameters of the page's own address that `target` leaves out. It knows no parameter by name and compares the two addresses' own query.
  - **Counts as dropped:** a parameter the page carries with a non-empty value and that the target leaves out entirely, or, for a parameter carried more than once, a target missing any of those values.
  - **Does not count:** a changed value, because page numbers and opaque cursors change from page to page and the comparison cannot tell them from paging. An added parameter does not count either.
  - **Ignored:** empty parameters, and the single-valued parameter whose value equals the page number the pager marks current. That parameter may be renamed, for example an offset used in place of a page number.
  - Only a count is returned, so no word of the address leaves the page.
- `page-advance/follow-next.ts`: a new `keepingFollowing(next, pager)` runs for a Next that has an address and does not lead back to the current page.
  - It returns `undefined` when nothing is dropped, so Next is followed as before.
  - It returns `pager.following` when Next drops state and that control's address drops nothing.
  - Otherwise it throws `PaginationFault("page_fault", ...)`. The message gives only the number of dropped parameters. This happens when there is no pager that marks the current page, when the following control is a script button with no address to check, or when the following control also drops the state.
  - The check runs after the disabled check and the bound check, and before any mark or press. The header and the function docs say why.
- How the fault reaches the run: `movePage` turns the fault into `{outcome: "failed", stop: "page_fault", reason}` through `stoppedMove`. The read's paged loop (`list-reader.ts:641-646`) catches it as `pageFault` with stop `page_fault` and keeps the pages it has already read. `page_fault` is already one of the domain's closed fault words (`domain/src/actions/next-page/answer.ts:27`), so no domain change was needed.
- `page-advance/move-page.ts`: one header comment updated.
- `docs/architecture/web-capabilities.md`, Pagination row: describes the new `following` case and the new `page_fault` case.
- Tests (`page-advance/tests/`):
  - `catalog-pager.ts` is a fixture of a library catalog search narrowed by `format` and `lang`. It is not one of the ten scenarios. Its Next either keeps the narrowing or drops it, and its page numbers either keep it, drop it, or are absent.
  - `dropped-state.test.ts` has 6 unit tests of the comparison.
  - `next-keeps-scope.test.ts` has 8 `movePage` tests:
    - Next drops the narrowing: the following number is followed, with the way named and with it found from the list, from page 1 and from page 2.
    - Nothing keeps the narrowing: `page_fault`, nothing pressed, no mark, the URL unchanged and no address words in the reason. Covered for a pager with no numbers and for one whose numbers drop the narrowing too.
    - Next keeps everything: followed `by: "next"` on page 1, on page 2, and on a pager with no numbers.
  - Reverting the one call site (`keepingFollowing` replaced by `undefined`) made 5 of the 8 move tests fail. The 3 tests where Next keeps everything still passed. The change was restored afterwards.

### detect-pagination.ts: no change

- `nextControlOnPage` only picks a candidate: the authored selector's control, the labelled Next, or the number after the current one.
- Its only consumers are `followNext` and `pageShownNow`. `pageShownNow` only reads the current page number. So every press goes through `followNext`, where the comparison now runs whichever way the control was chosen. It covers a labelled fallback, as in step 0042 of run mv96rz68, and an authored selector that names Next directly.
- Proposal-time detection (`detectPagination`) sees a single page, often unfiltered (as in this run, step 0014), so it cannot know that Next will drop a filter later. Adding the comparison there would not have prevented this defect.

### domain arrival.ts: no exposure

`domain/src/runtime/llm-evidence/node-run/arrival.ts` remembers whether a build reached its start location (one bit per project, flow and session). It never reads a pager or a next-page address, so it does not have this exposure, and I did not touch it. The extension's own `page-advance/arrival.ts` answers on the document that a press loaded, and the decision is made before the press, so it needs no change either.

## Commands run and observed results

All commands were run in the t623 worktree.
- `EXTENSION_TEST_BUILD_LABEL=t623 node scripts/test-extension.mjs content/extraction/page-advance/tests` (apps/extension): `# tests 26`, `# pass 26`, `# fail 0`.
- The same command for `page-advance/tests/next-keeps-scope` with the call site reverted: `# pass 3`, `# fail 5`. The file was restored afterwards.
- `EXTENSION_TEST_BUILD_LABEL=t623 node scripts/test-extension.mjs content/extraction` (apps/extension): `# tests 285`, `# pass 285`, `# fail 0`, `# cancelled 0`.
- `node scripts/check-extension.mjs` (apps/extension): exit 0, no output.
- `npx tsc -p tsconfig.json --noEmit` (apps/extension): exit 0.
- `pnpm structure:check` (repo root): `structure-audit: passed (195 warning(s), 639 baselined)`.
  - New advisory warning: `page-advance/: 17 source files is past the 15-file advisory threshold`. The directory already had 16 files; this adds `dropped-state.ts`. It is advisory, not a failure.

## Not verified

- No live run and no Playwright content spec, as the brief says. Behaviour in a real Chrome, Edge or Firefox document was not exercised. The code path is shared by both browsers and uses only `URL`/`URLSearchParams` and the existing pager reading.
- The read's paged loop (`list-reader.ts`) was not tested with this fixture. It reaches the same `followNext`, and its `PaginationFault` handling already exists and is unchanged.
- The bigbox-retail towels pager was not run against this code. From its markup (`results-pagination.ts`), the current page is an `a` with `aria-current` and the numbers keep every filter, so `readPager` gives `following` = the next number, and the swap should apply there.

## Open questions or contradictions found

- **False-fault risk from tracking parameters.** Suppose a page's address carries a parameter that is not list scope (for example `ref=` or `utm_*`), its Next drops it, and no following number keeps it. That move now fails `page_fault` where it used to "succeed". This follows the brief's rule ("when no control keeps the state … report a pagination fault"). One possible relaxation would ignore a parameter that every addressed page control of the pager also drops, treating it as the site's convention rather than list scope. I did not build it, because it contradicts the brief's literal case where numbered controls drop the filter too. Supervisor's call.
- **Value changes are not detected.** A Next that keeps a filter's name but changes its value (for example `sort=price` to `sort=relevance`) is not caught. Telling that apart from a page number or cursor change would need knowing which parameter pages the list.
- **Core.** Core's read account (`narrowedBefore`, judge evidence) is out of scope, per the debug report's RC2. With this change the step fails visibly rather than reporting a narrowed read over unnarrowed pages.

## Follow-up (coordinator): count only state the page shows applied

### Outcome

Done. A parameter that Next drops now counts as the list's scope only when the page shows it applied. Anything else Next drops is ignored and Next is followed as before, which removes the false fault on tracking parameters described in the first open question. The rest is unchanged: Next is swapped for the following page number when that number keeps the applied state, and the move fails `page_fault` only when applied state would be lost.

### What changed and why

- `page-advance/applied-controls.ts` (new): `appliedControls(root)` lists the controls that show a choice applied, as `{name, value}`.
  - **Included:** a checked `input[type=checkbox|radio]`, read from the live `.checked` property and falling back to the attribute; a selected `option`, read from `.selected`, taking its name from its `select` and its value from `value` or else its text; and any element with `aria-pressed="true"` or `aria-checked="true"`.
  - **Excluded:** text and search fields, because what they hold is typed rather than chosen.
  - **Empty choices:** an input or option whose value is empty (for example "Any language") shows nothing applied and is skipped.
  - **Default value:** a checkbox with no `value` attribute is read as `on`, which is what it submits.
- `page-advance/dropped-state.ts`: `droppedQueryState` gained an `applied` argument. A dropped parameter counts only when an applied control matches it in one of these ways:
  - its name equals the parameter's name, ignoring case;
  - its value equals one of the parameter's values, ignoring case;
  - its value is a whole part of one of those values, bounded by characters that are not letters or digits. This is how the bigbox store works: each checkbox's value, for example `retailer_type:ValueRidge`, is one part of the joined `facet` value `retailer_type:ValueRidge||fulfillment_method:Pickup`.
  - A part shorter than 3 characters must be the whole value, so a radio worth `1` is not matched inside `sr_pg_1`.
  - No parameter or site is named in any of these rules.
- `page-advance/follow-next.ts`: `keepingFollowing` reads `appliedControls(document)` once and passes it to both comparisons (Next, and the following number). The header, the function docs and the fault message now say "shows applied".
- Tests:
  - `tests/catalog-pager.ts`: the fixture has a filter rail with `format` checkboxes (ebook checked), a language `select` (English selected), and a search field. It has two new options: `shown: "nothing"`, where the narrowing is in the address but nothing on the page shows it, and `arrivedWith`, an extra parameter only the first page's address carries.
  - `tests/dropped-state.test.ts`: rewritten for the new signature, with 9 tests. The new ones cover a tracking tag being ignored, a page that shows nothing applied, part-of-joined-value matching (case, and the letter or digit boundary), and the minimum length for a short value.
  - `tests/next-keeps-scope.test.ts`: the earlier 8 tests are unchanged and still pass with the narrowing shown as checked or selected controls (the number is followed, or the move faults). Two tests were added:
    - Next keeps the narrowing but drops `ref=newsletter`, which nothing shows: `moved` with `by: "next"`.
    - Next drops the narrowing, nothing shows it, and there are no numbers: `moved` with `by: "next"`.
  - `tests/applied-controls.test.ts` (new): the fixture rail gives `[{format, ebook}, {lang, en}]`, and gives `[]` when nothing is applied.
- `docs/architecture/web-capabilities.md`: the Pagination row now names the applied-control condition.

### Commands run and observed results

All commands were run in the t623 worktree.
- `EXTENSION_TEST_BUILD_LABEL=t623 node scripts/test-extension.mjs content/extraction/page-advance/tests`: the first run had 1 failure out of 32. The cause was a mistake in my own test, not the code: `rating=1` with current page 1 is excluded as the page-number parameter. I changed the test to use current page 2.
- `EXTENSION_TEST_BUILD_LABEL=t623 node scripts/test-extension.mjs content/extraction`: `# tests 291`, `# pass 291`, `# fail 0`, `# cancelled 0`.
- `node scripts/check-extension.mjs`: exit 0.
- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `pnpm structure:check`: `structure-audit: passed (195 warning(s), 639 baselined)`. The advisory warning now reads `page-advance/: 18 source files is past the 15-file advisory threshold`. It was 16 before t623; this task added `dropped-state.ts` and `applied-controls.ts`.

### Not verified

- `.checked` and `.selected` are read through their live properties in a real DOM. The fake DOM in these tests has only attributes, so only the attribute fallback was exercised.
- The bigbox page itself was not run. From its markup, its checked facet checkboxes carry values that are whole parts of the `facet` value, so the swap should apply there. No live run.

### Open questions

- **Filters drawn as links.** A filter shown only as a link or chip with no checked, selected or pressed state is not seen as applied. A Next that drops such a filter is followed as it was before t623. This is the price of not faulting on tracking tags.
- **Page-number collision.** A filter whose value equals the current page number is still excluded as the page-number parameter.
- **Advisory threshold.** `page-advance/` is now 3 files past the advisory threshold. A later split could move `dropped-state.ts` and `applied-controls.ts` into a `page-advance/list-scope/` directory with its own barrel.
