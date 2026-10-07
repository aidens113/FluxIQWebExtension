# Report: s45-d-extension-next-page (W-D, wave 2)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension` (branch `task/t284-read-list-s45-next-page`). Contract:
C1 in `s45-next-page.md`; design 4.2(a). E = `apps/extension/src`.

## Outcome

Done. The extension runs `web.dom.next_page`: one step that moves a list to its next page or answers `ended`, carried
across documents by the worker. The read's advance logic moved into `E/content/extraction/page-advance/`, and
`pagination.ts` keeps every export and behaviour for the read. All tests were written first and observed failing (the
bundle failed: module and exports missing), then passing. `pnpm check` for the extension exits 0, and so does the
structure audit.

## What changed and why

**Page-advance module (new, `E/content/extraction/page-advance/`, 16 files incl. barrel, plus `tests/`).**
- Moved out of `pagination.ts` (the old lines 115-685):
  - `step-page.ts`: the dispatcher `stepPage(way, progress, bound)`, with the mode header that used to be in `pagination.ts`;
  - `follow-next.ts`: `followNext`, `awaitNextControl`;
  - `load-more.ts`: `pressLoadMore` and its helpers;
  - `scroll-for-more.ts`: `scrollForMore` and the scroller helpers;
  - `numbered-page.ts`: `visitNumberedPage`;
  - `list-change.ts`: `afterListChange`, the cancelled-click detection, `watchUnload`, `listChanged`, `clickable`,
    `pastDeadline`, `deadlineFor`;
  - `load-pace.ts`: the page-load pace (`awaitPageLoadTurn`, `tellPaceRefused`);
  - `refused-page.ts`: `BROWSER_PAGE_HOST`, `pageRefusalOf`, `refusedPageWaitMs` and the retry constants;
  - `pagination-fault.ts`: `PaginationFault`, `paginationStopOf`;
  - `types.ts`: `PageStep`, `PaginationProgress`, `PaginationStop`.
- How the moved code differs from the old:
  - **Bound.** Each step takes `bound: number | undefined`. The read passes `paginationBound(paginate)`; Next page passes
    none. For a scroll with no bound, the step stops after 5 scrolls of its own (`MOVE_SCROLLS`). The step answers
    `truncated` then, and Next page maps that to `failed list_unchanged`.
  - **`by`.** An `advanced` step now says how the list moved: `next`, `following`, `numbered`, `loadMore` or `scroll`.
    `pagination.ts`'s `advancePage` removes `by` again, so the read still gets exactly `{outcome: "advanced"}`.
  - **`beforeFollow`.** It now receives `by`. The read's zero-argument hook is still assignable.
  - **Finding Next with no way named.** `followNext` accepts no selector. It then finds the Next with
    `nextControlOnPage(null, items)`, which walks up from the list's first item.
- New code for Next page:
  - `move-page.ts`, `movePage`. It waits up to 5 s for the list's first item and fails `list_vanished` if none shows.
    The way is `request.pagination`, else Next found live. A disabled or absent control is never pressed; the answer is
    `ended` with the stop word. The press is marked to the worker (`beforeFollow` calls `options.mark({by})`), then made.
    The answer is `moved` with `page`, the number the pager marks current after the move.
  - **Numbered pager with no current page.** Such a pager fails `page_fault` rather than guessing, because one step
    keeps no page count (from page three, a guess would choose page two).
  - `arrival.ts`, `arriveAfterMove`. It runs in the document a press loaded, from the worker's mark, and presses
    nothing. A 429 or 503 status is waited out and reloaded, at most 2 times overall (a 429 only once, as for the read).
    The spent refusals go into the mark sent before the reload. Otherwise it waits up to 10 s for the first item and
    answers `moved {by: mark.by, page}`. With no item and no status, the landing counts as an unexplained refusal; with
    a 200 status, it fails `list_vanished`.
  - `shown-page.ts` holds `pageShownNow`.
  - `move-outcome.ts` holds the outcome and option types. Its words are classified through the domain's own reader
    (`webAutomationNextPageAnswerValue`), so the page cannot answer a word the wire would drop.
  - `continued-move.ts`, `pageMoveFor(continuation)`. It is the counterpart of `listReadFor` and sends marks over
    `chrome.runtime`.
- **`pager-reading/`.** `PagerReading` gains `current: number`. New `currentPageNumber(controls)` reads the
  `aria-current` control, or the one linking to this document.
- **`pagination.ts`.** It now holds only `paginationBound`, `advancePage` (which calls `stepPage` with the bound and
  removes `by`), `PageAdvance`, and re-exports of every moved name `list-reader.ts` and the tests import.

**Verb.** New `E/content/actions/next-page.ts`:
- `moved` becomes a succeeded result with `nextPage`.
- `ended` becomes a succeeded result with `nextPage` and `route: "ended"`.
- `failed` goes through `deps.failure`, with a `WebAutomationFailureCarrier` whose code comes from a total
  `FAULT_CODES` record matching C1's mapping.
- `timed_out` becomes `deps.timedOut`, with no answer.
- A throw becomes `page_fault`.

None of these codes is retried by the recovery loop: next_page is not read-only, and none of the codes is decided before
the press. Wiring: `content/actions/execute.ts` routes `web.dom.next_page`; `content/actions/types.ts` adds the
`nextPage: PageMove` dependency.

**Across documents.** `E/runtime/extract-list-continuation.ts` now holds one generic `sendAcrossDocuments`, parameterised
by what the page hands over before a press: the read's checkpoint, or Next page's mark. On top of it sit
`sendExtractListAcrossDocuments` (behaviour unchanged) and the new `sendNextPageAcrossDocuments`. In
`E/runtime/action-runner.ts`, `sendAction` picks one of them through `acrossDocuments(action)`, and both are booked on
the page-load pace the same way.

`E/shared/extraction-continuation.ts` adds:
- `PAGE_MOVE_MARK_MESSAGE` (`"fluxiq.nextPage.mark"`);
- the types `PageMoveMark {by, refusals?}`, `PageMoveContinuation` and `PageMoveMarkMessage`;
- `readPageMoveMark`, which refuses unknown members (so no rows ride along) and any `by` outside the domain's words.

No rows are carried.

**Protocol and total records.** `E/shared/protocol.ts` re-exports the six `WebAutomationNextPage*` types. Edits outside
the owned list:
- Demanded by the compiler:
  - `E/panel/copy/step-copy.ts`: `"web.dom.next_page": fixed("Going to the next page", "Went to the next page")`.
  - `E/background/connection/tests/runtime-status.test.ts`: `"web.dom.next_page": undefined` (no recording
    confirmation).
  - `E/content/action-runtime/execute-action.ts`: one import line and the dependency member
    `nextPage: pageMoveFor(extractionContinuation)`, plus a header sentence. This is required because `nextPage` is a
    required dependency.
- Demanded by a test: `E/background/connection/runtime-status.ts`. Its label test requires every action type to have a
  label, so I added `"Next page"`.

**E2E spec (written, not run).** `apps/extension/e2e/content/tests/extraction/tests/everything-store-next-page.spec.ts`.
It reads and presses Next page through the store's 5 pages and expects pages `[1,2,3,4,5]` read, then
`ended control_disabled` on page 5. A second test checks that page 2 goes to 3. The spec plays the worker's resend: when
the press destroys the document, it sends the command again with `resume: {by: "next"}`. It typechecks under
`tsconfig.test.json`.

## Commands run and observed results

All from the tree root or `apps/extension`.

**Fail-first.** `run-subset.mjs ... s45-d` over the three new test files, before the implementation, printed:

```
Build failed with 1 error: src/content/extraction/page-advance/tests/move-page.test.ts:16:69: ERROR: Could not resolve ".."
```

The module did not exist yet; the other two files import exports that did not exist yet.

**First green run.** After the implementation, `node --test <3 bundles>` printed `# tests 19 # pass 16 # fail 3`. The 3
failures were a test-harness defect, not the verb: my stub used `actionFailure`, which reads `location` in Node. I
replaced it with an `execute.test.ts`-style failure stub and the rerun printed `# pass 6 # fail 0` for the verb test.

**Full subset.** `run-subset.mjs ... s45-d` over 27 files, then `node --test <27 bundles>`, printed
`# tests 297 # pass 297 # fail 0 # cancelled 0`. The run was repeated after the file renames, with the same result. The
27 files:
- my 3 new tests;
- `content/extraction/tests/{pagination,pagination-pace,detect-pagination,list-reader,list-reader-refused-page,load-retry}`;
- `runtime/tests/{action-runner,extract-list-continuation}`;
- `background/connection/tests/runtime-status`;
- every `content/actions/tests/*.test.ts` (15 files);
- `panel/copy/tests/copy`.

**Typecheck.** `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit` printed nothing and exited 0. It
covers `src/**` and `e2e/**`, including the new spec.

**Extension check.** `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 0 on both runs: the first after
the implementation, the second after the renames (`"ms":49908`).

**Structure audit.** `node scripts/structure-audit.mjs`:
- The first run exited 1: `FAIL [naming] .../page-advance/: 4 files share the prefix "page-"`.
- I renamed the files to `pagination-fault.ts`, `load-pace.ts`, `shown-page.ts` and `continued-move.ts`.
- The rerun exited 0. One advisory warning remains: `page-advance/: 16 source files is past the 15-file advisory
  threshold`.

## Not verified

- No browser was used. The e2e spec was not run. Pressing a link that loads a new document and the worker re-injecting
  into it are proven only by the stubbed tests; the real-browser half is unexercised.
- The real `BROWSER_PAGE_HOST` reload, and the `PerformanceNavigationTiming` status on a Next page landing, are
  unexercised.
- The scroll and load-more paths of Next page have no new unit test. They are the read's moved code, still covered
  through `advancePage` by `load-retry.test.ts` and `pagination.test.ts`.
- `pageMoveFor`'s `chrome.runtime` send is not unit-tested; the worker's end of it is.
- `domain/` was not run here. Its wire copy of `nextPage` and `route` was exercised only through
  `webAutomationActionResultPayload` in `next-page.test.ts`.

## Open questions or contradictions found

- The brief cites `extract-list-continuation.ts ~300-360`, but the file has 109 lines; the resend is lines 60-103. I
  generalised it in that file rather than adding a runtime file outside my list, so the filename now says
  extract-list but holds both. The supervisor may want it renamed (e.g. `across-documents.ts`).
- **Running out of time** answers status `timed_out` with no `nextPage` member. C1 lists no timed-out answer, so this
  follows every verb's convention. The supervisor or W-A should confirm that the node treats it as a failure.
- **Numbered pager that marks no current page.** Next page fails `page_fault` on such a pager (neither `aria-current`
  nor a self-link nor a lone number shown as text). Guessing could move backwards. This is a deliberate narrowing
  compared with the read, which counted pages it had read.
- `content/action-runtime/results.ts` `soughtSelector`, the sign-in gate check, does not know `nextPage.item`. A
  `list_vanished` on a sign-in gate is therefore not turned into `AUTH_REQUIRED`. I did not touch it; it is outside my
  file list.
- **Documentation.** `docs/architecture/` was not updated for the new action, the mark message or the module split.
  This is the supervisor's call under AGENTS.md "Documentation Maintenance".
