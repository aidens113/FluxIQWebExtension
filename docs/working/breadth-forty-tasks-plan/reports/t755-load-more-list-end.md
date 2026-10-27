# t755 load-more list end (photo-social priya-tags), plus the paused-list word

Worker report. Paired trees `fxwork/t755/!FluxIQWebExtension` and `fxwork/t755/!FluxIQ`, branch `task/t755-load-more-list-end`. No commits, no model calls, no Lab runs, no panel management. Browser runs: content harness, headed Chromium, photo-social only, provider-free.

## Outcome

Done for the loop's end and the under-collection, at the content-runtime level, and for the supervisor's scope addition (the paused-list word). The 4 missing rows had three framework causes and no condition cause:

- Match condition: correct. Revision 8's `comment contains "@priya.nair"` keeps exactly the expected rows, and it rejects Priya's own comment, once the list is whole (spec row 2: 3 rows; row 3: 5 rows).
- Loop end (2 rows of batch 3 missing): the thread's Load more is a `div role=button` named only by its `<svg aria-label>`. Detection read labels from the control's own `aria-label` or text, so it proposed `pagination: none`. Revision 8's `web.dom.next_page` then found no Next, scrolled, and answered `ended: scrolled_to_end` with Load more on screen (run receipt `attempt.caf6caba…`: `nextPage: {item}` only, answer `ended / scrolled_to_end`). Reproducing it found two more defects on the same path. Detection's control selector is positional (`li:nth-of-type(14) > div`), so the second press landed on a comment. And the thread swallows its first Load more press, so next_page failed `list_unchanged` where a person would press again.
- Replies (2 rows): never opened by the builder. Even when opened, a detected run held only siblings, so the read item selector (`ul > li.x`) left nested replies out. Re-detecting with replies open still read only the comments.
- Revisions 2-7 (click loop, repeat guard at 27-33): the run's click resolved its stale position `li:nth-of-type(38) > div` to a comment body and "succeeded". That run's fingerprint had no accessible name. On current dev, `e3d6f7e6` (2026-10-19, icon-only control names) gives the recording a name, and the veto refuses the comment (spec row 4 passes on unchanged source). So this is already fixed for new recordings. A recording with only a drawing and no name is still not vetoed (see Open questions).

"List ended" design (the original scope, together with the addition): a list is going on, ended, or paused by the site.
- Going on: `listContinues`, as before.
- Paused: `listContinues` with the new evidence word `loader_asked_to_wait`.
- Ended: no new read fact. The observed "no more items" state reaches a loop through `web.dom.next_page`'s existing `ended` route (`control_absent` / `control_disabled` / `scrolled_to_end`). Spec row 2 shows it ending the thread's loop once the defects above are fixed. A read-level "ended" claim was not added. The only positive evidence a read has is a disabled control, and "no control seen" is exactly what a slow or paused loader also looks like. That false "ended" is the bug the paused word fixes.

## 2026-10-27 - Trace (read-only)

- Diagnosis `diag-photo-store-2026-10-27.md` §1, debug `run-mvebbeom-a60886e1.md`, `codex-photo-priya-tags.md`, task `live-tasks.ts` (PRIYA_TAGS), `breadth/priya-tags/{workflow,expected}.ts`, site `pages/comments.ts`, `client/post-script.ts`.
- Steps `0099` (rev 2 script: `click t1478` with `repeat while: more`, `repeat most: 30`), `0101` (repeat.no_progress at 27), `0067` (`detect_repeating_structure` → `pagination: "none"` at 25 items), `0170`/`0172` (rev 8: click + `web.dom.next_page nextPage: extraction.7`, loop left after 1 pass, read 25 / kept 1).
- Command receipts: the tail click `attempt.249dcc94…` had fingerprint `{div, role button, 6 classes, drawing d1.hmtylar5os, listPosition 38/38}`, no name. It resolved `strategy selector` to `li:nth-of-type(38) > div` (`zara.qureshi` comment body), "pressed once more". The next_page attempt `attempt.caf6caba…` had request `{item}` and answer `ended: scrolled_to_end`. The run's snapshot carried the control's name only on its `svg` child (source `2fc5289c`, before `e3d6f7e6`).
- Core `flow-bootstrap/authoring/draft-routing.ts`: `repeat while` leaves only by a branch output of its last step (`repeatEndings`). A click has none, so a click loop ends only by `repeat most` or a failure. `web.dom.next_page` has `ended`.

## 2026-10-27 - Reproduction, failing on unchanged source

New spec `apps/extension/e2e/content/tests/list-states/tests/photo-social-thread-load-more.spec.ts` (first written under `extraction/tests/`, moved for the structure audit). Rows:
1. detection on the giveaway thread proposes `loadMore` naming the drawn control;
2. next_page with `{item}` only (rev 8's request) loads every batch, ends `ended`, the thread holds 41, and the condition keeps rows 3-5 of `priyaTagsExpected`;
3. with the detected way, the loop ends; Priya's replies opened; the thread detected again includes them (41 + replies) and the read keeps all 5 rows in order;
4. a click on Load more after the thread loaded whole is `web.target.not_found` and presses nothing (guard).

Command (in `fxwork/t755/!FluxIQWebExtension`): `pnpm --filter @fluxiq-web-extension/extension test:content -- photo-social-thread-load-more --headed --workers=2`

Observed before any fix: `4 failed, 1 passed`. That run included a fifth, exploratory row, a click carrying only the run's thin fingerprint, which was later dropped (see Open questions).
- row 1 `x`: `structure.proposal.pagination` `undefined`;
- row 2 `x`: `nextPage: {outcome: "ended", stop: "scrolled_to_end"}` (the live answer);
- row 3 `x`: the loop ended early, so Priya's entry (batch 2) never loaded;
- row 4 `ok` (already fixed on dev by `e3d6f7e6`);
- thin-fingerprint probe row `x`: resolved `strategy: selector`, `candidateCount 1` to the comment row. It was refused only because the site's dock covered it, which reproduces the run's acceptance.

Defects found while fixing, each seen failing first:
- after the drawn-name change alone: row 2 `list_unchanged` (first press swallowed). With every drawn name read, row 2 also failed "following the pager's Next to page 2": the post's own carousel "Next" icon was taken as the pager's Next. So only a drawn Load more is recognized (see Fix);
- after the press-again change: row 3 `list_unchanged … pressing "…li:nth-of-type(14) > div"` (stale position pressed a comment);
- after the control-on-page change: row 3 read 3 rows of 5. The item was `… > ul > li.x1t4am2q…` before and after replies opened (replies excluded).

## 2026-10-27 - Fix (extension)

- `content/extraction/detect-pagination.ts`: a wordless control (no `aria-label`, no text) is read by its accessible name (`identity/accessibleNameFor`, drawings included), and only as Load more. A drawn "Next" is not taken: the giveaway post's carousel arrow proved that an icon named Next is as often a slide arrow. Worded controls read exactly as before (`labelOf` unchanged).
- `content/extraction/page-advance/found-way.ts`: a next_page whose list carried no way looks for the list's load-more control (by detection) after a Next, before scrolling.
- `content/extraction/page-advance/load-more.ts`: (a) the press is watched with the click verb's ignored-press watch (`action-runtime/ignored-press`, 800 ms). A press with no sign at all, no new item and the control still there is made once more, once. (b) The control is chosen on the page each time through `page-advance/appending-control.ts` (new). The authored selector wins unless it names nothing or sits inside a list item. Otherwise the load-more found around the list now is used, and with none the list has ended.
- `content/extraction/nested-run/` (new, `nested-items.ts` + barrel + test): a run's items are each followed by nested same-template items (same signature, and a first child with the same signature), in document order. `infer-list.ts` `sameTemplateSiblings` uses it. `item-selector.ts` adds a descendant candidate `<container> li.x` (0.7) after the child one. It is chosen only for a run that holds nested items, so a sibling run is named as before.
- Header lines updated: `step-page.ts`, `move-page.ts`.
- Test stand-in: `page-advance/tests/scroll-loaded-list.test.ts` `El` gained `getRootNode()`, which the press watch asks.

## 2026-10-27 - Scope addition: the paused-list word (supervisor, from t756)

- Extension `read-coverage/loader-wait.ts` (new): the shown elements after the list's last own item, then after its container and 3 ancestors (3 each). Their bounded words are matched with the click watch's closed rate-limit and busy phrases. No word leaves the page.
- `read-coverage/list-continues.ts`: no way on, not still growing, and the loader asked to wait → `{kind: infinite_scroll, evidence: loader_asked_to_wait}`. `still_growing` still wins when the list grew.
- `action-runtime/interference/vocabulary.ts`: rate-limit phrases add the uncounted wait `wait a (few) moments|seconds|minutes|while before`. Photo-social's notice after its countdown ("Please wait a few moments before you try again." + Try again) matched nothing before. The same phrase now also reads as a rate-limit layer for the click watch (consistent meaning). Test cases were added both ways.
- Domain `actions/extraction/list-continues.ts`: type and `EVIDENCE` add `loader_asked_to_wait`. Test in `summary-list-continues.test.ts`.
- Core `service/summaries/extraction-summary.ts` `CONTINUES_EVIDENCE` adds it. `result-verification/read-account/list-continues.ts`: `shownBy` adds "the page answered the read's reveal of its end with a notice to wait before it loads more, so the list paused there rather than ended". Its fix line adds `PAUSED_FIX`: "The page paused this list: before each move, wait as long as its notice asks, or press the retry control the notice offers once it shows, as a person would." Generic, with no site, task or answer words. Tests in `read-account/tests/list-continues.test.ts` and `summaries/tests/extraction-summary-list-continues.test.ts`.
- Headed spec `e2e/content/tests/list-states/tests/photo-social-grid-paused.spec.ts`: studio profile; two quick scrolls trip the grid's limit (notice visible); then a one-page read → `listContinues {infinite_scroll, loader_asked_to_wait}` and `itemsSeen` = cells shown. The notice's own Try again then clears it.
- Failing first: with `loaderAskedToWait` short-circuited (temporary marker `T755-TEMP`, file restored from scratch copy, `grep -c T755-TEMP` → 0), the spec failed: `Expected: {"evidence": "loader_asked_to_wait", "kind": "infinite_scroll"} Received: undefined`, as t756 observed live.
- t756's `pressed-control/` code is not needed for these reproductions: neither spec presses a grid cell.

## 2026-10-27 - Validation

Extension (`apps/extension`):
- `pnpm --filter @fluxiq-web-extension/extension test:content -- photo-social-grid-paused photo-social-thread-load-more --headed --workers=2` → `5 passed (1.0m)` (before the move to `list-states/`; rerun in the related-spec sweep below).
- `EXTENSION_TEST_BUILD_LABEL=t755 node scripts/test-extension.mjs src/content/extraction src/content/action-runtime/interference src/content/action-runtime/ignored-press` → `# tests 555 # pass 555 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` → exit 0 (the test config first failed on `reply.extracted.map` in the spec, fixed).
- From the final folder, `pnpm --filter @fluxiq-web-extension/extension test:content -- list-states --headed --workers=2` → `5 passed (48.1s)` (thread rows 1-4 and the paused grid).
- Related headed sweep: `test:content -- e2e/content/tests/extraction e2e/content/tests/list-states e2e/content/tests/reveal-by-scroll e2e/content/tests/offline-reads e2e/content/tests/live-tasks e2e/content/tests/evidence --headed --workers=3` → exit 0. My output filter dropped the summary line, so the total passed count was not captured. The failed rows (`x`) were captured: 3.
  - `extraction/tests/social-kept-row-disclosure.spec.ts:70`: `Expected: "failed" Received: "succeeded"`.
  - `live-tasks/tests/local-classifieds-bike-search.spec.ts:298` and `:312`: "the detection proposes one title column … Expected: 1 Received: 2".
  - All 3 fail the same way on unchanged source. The 7 changed extension source files were swapped for their `HEAD` copies (`git show HEAD:<file>`), the two specs were rerun headed (`3 failed, 4 passed`, identical messages), and my files were restored. They also fail with only the nested-items change disabled. They are pre-existing and not caused by this work. Not investigated.

Domain: `npx tsc -p tsconfig.json --noEmit` → exit 0; `DOMAIN_TEST_BUILD_LABEL=t755 node scripts/test-domain.mjs src/actions/extraction/tests src/runtime/offline-reads/tests` → `# tests 105 # pass 105 # fail 0`.

Core (`packages/fluxiq`):
- `pnpm test src/programs/automation-studio/runtime/result-verification/read-account/tests src/programs/automation-studio/runtime/service/summaries/tests` → group 1 `Test Files 34 passed (34)`, `Tests 232 passed (232)`; group 2 `Test Files 2 passed (2)`, `Tests 7 passed (7)`.
- every Core test naming `listContinues` (located-defects, list-continues, repair-directive, paging-feedback, extraction-summary-list-continues) → `Test Files 5 passed (5)`, `Tests 57 passed (57)`.
- prompt contracts (`scripts/task/contract/list.mjs`: system-prompt, extraction-vocabulary, issue-feedback) → `Test Files 3 passed (3)`, `Tests 68 passed (68)`.
- `npx tsc -p tsconfig.json --noEmit` → exit 0. Core libraries rebuilt in the t755 Core tree (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`, fluxiq compiled 219 s) because the extension's core-build guard refused a stale Core.

Structure: downstream `pnpm structure:check` first failed with 4 violations: 26 files in `extraction/tests/`, 26 in `content/extraction/`, a barrel-bypassing import of `priya-tags/expected.js`, and the `load-` prefix ×3 in `page-advance/`. Fixed by moving the specs to `e2e/content/tests/list-states/tests/`, `nested-items.ts` to `extraction/nested-run/`, `load-more-control.ts` → `appending-control.ts`, and importing `priya-tags/index.js`. Now → `structure-audit: passed (222 warning(s), 616 baselined).` Core `pnpm structure:check` → `structure-audit: passed (443 warning(s), 1152 baselined).`

## Not verified

- The diagnosis's full installed-build spec (`site-reset/tests/photo-priya-thread.spec.ts`: scripted builder candidates A/B/C, repeat guard feedback, production judge) was not built. The reproduction here runs the same page steps the candidates would run, through the content runtime, and isolates each cause. It does not exercise Core's trial loop, the judge, or the builder's feedback text end to end.
- No live or paid run. Whether a builder now authors next_page plus the reply expansion is unproven. Reply expansion is still the builder's job; nothing tells it replies are unopened.
- A read detected before replies open keeps the child-only selector, so a Flow must open replies before the thread's handle is detected for them to be read.
- Paused-list for a step: `web.dom.next_page`'s scroll still answers `ended: scrolled_to_end` when the loader answers with a wait notice (the read says paused; the step does not). Not changed.
- Firefox not exercised. Full suites not run (per rules).

## Open questions or contradictions

- A recording carrying a drawing and no name or text (the run's own thin fingerprint) is still acted on by its selector unvetoed: `identity/veto.ts` `recordedDistinguisher` does not count `drawing`. Counting it would refuse an icon toggle whose picture changes with state, so it was left. Current recordings of labelled icons carry a name (`e3d6f7e6`), which is why the run's case is fixed on dev.
- `wait a few moments before` now also marks a click-time layer as a rate-limit notice (same vocabulary). This is intended, but it is shared with the click's watch and owned by `action-runtime/interference/`.
- next_page's scroll under a wait notice (above) is the step-side half of the paused state. It needs a decision: fail `rate_limited` (the existing fault word, retried after the wait), or press the notice's retry.

UNIT READY: apps/extension/src/content/extraction/detect-pagination.ts, apps/extension/src/content/extraction/infer-list.ts, apps/extension/src/content/extraction/item-selector.ts, apps/extension/src/content/extraction/tests/item-selector.test.ts, apps/extension/src/content/extraction/nested-run/index.ts, apps/extension/src/content/extraction/nested-run/nested-items.ts, apps/extension/src/content/extraction/nested-run/tests/nested-items.test.ts, apps/extension/src/content/extraction/page-advance/found-way.ts, apps/extension/src/content/extraction/page-advance/load-more.ts, apps/extension/src/content/extraction/page-advance/appending-control.ts, apps/extension/src/content/extraction/page-advance/move-page.ts, apps/extension/src/content/extraction/page-advance/step-page.ts, apps/extension/src/content/extraction/page-advance/tests/scroll-loaded-list.test.ts, apps/extension/src/content/extraction/read-coverage/list-continues.ts, apps/extension/src/content/extraction/read-coverage/loader-wait.ts, apps/extension/src/content/extraction/read-coverage/tests/list-continues.test.ts, apps/extension/src/content/extraction/read-coverage/tests/loader-wait.test.ts, apps/extension/src/content/action-runtime/interference/vocabulary.ts, apps/extension/src/content/action-runtime/interference/tests/vocabulary.test.ts, apps/extension/e2e/content/tests/list-states/tests/photo-social-thread-load-more.spec.ts, apps/extension/e2e/content/tests/list-states/tests/photo-social-grid-paused.spec.ts, domain/src/actions/extraction/list-continues.ts, domain/src/actions/extraction/tests/summary-list-continues.test.ts, docs/working/breadth-forty-tasks-plan/reports/t755-load-more-list-end.md; Core: packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/list-continues.ts, packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/tests/list-continues.test.ts, packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/extraction-summary.ts, packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/tests/extraction-summary-list-continues.test.ts
