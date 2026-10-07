# Report: s45-e-extension-one-page-read

## Outcome

Done. The page side of contract C3 (S5, "the read reads one page") is in place, and the picker's "Read every page" checkbox is gone, along with its confirm member.

## What changed and why

**Read answers only what it kept (C3, design C5)**
- `apps/extension/src/content/extraction/filtered-answer.ts`
  - `filteredListAnswer(rows, truncated, answer?)` takes the request's `answer` rule.
  - With `"kept"` it never falls back. It answers the kept rows, possibly `[]`, with `unfiltered: false`. The rejected rows' missing fields and their truncation are not reported, because those rows are not the answer.
  - Without a rule (exploration) the "too much, never nothing" floor is unchanged.
  - The header has a new section, "Only in exploration".
- `apps/extension/src/content/extraction/list-reader.ts`: passes `request.answer` to `filteredListAnswer`, and the header says the floor applies to exploration only. The first-page wait already counts items on the page, so it needed no change.
- `apps/extension/src/content/actions/extract-list.ts`
  - With `answer: "kept"`, `minItems` is measured against `max(itemsSeen ?? 0, records.length)`, meaning items seen rather than rows kept.
  - So a page with items but no match passes with `[]`, and a page with no item still fails.
  - The expected and shortfall texts say "item(s) on the page".
  - Without `answer`, the minimum and its text are exactly as before.
  - The domain client barrel does not export `WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT`, and domain is out of scope. Both files therefore compare against the literal `"kept"`, which TypeScript checks against the request's `answer` union.

**Checkbox and confirm member removed (design 6.3)**
- `panel/extraction/panel-elements.ts`: the `extractionPaginate` input, its label and its row are removed.
- `panel/extraction/panel.ts`
  - The change listener, `renderPagination` and `paginationLabel` are removed.
  - The "Pages" note now reads "Current page only: FluxIQ found no link to more pages."
  - When a control was detected, it reads "Current page only. The list goes on: a Next page step after this one reads the pages that follow."
- `panel/extraction/view-model.ts`: `paginate` and `setExtractionPaginate` are removed. `pagination` stays, as information only, for the note above.
- `panel/extraction/index.ts`: the barrel export is dropped.
- `panel/extraction/confirm-payload.ts`: there is no `paginate` member.
- `panel/extraction/extraction.css`: the `.extraction-paginate` rules are removed.
- `shared/extraction-messages.ts`: the `ExtractionConfirmRequest.paginate` member is removed, along with its now-unused type import, and the `pagesRead` doc is updated.
- `background/extraction/definition.ts`: a recorded definition no longer copies `confirm.paginate`, so a stale panel's member is ignored. The unused import is removed.

**Tests**
- `content/extraction/tests/filtered-answer.test.ts`: added 2 tests, one for a kept read answering `[]` and one for the exploration floor.
- `content/extraction/tests/list-reader.test.ts`: added 2 tests.
  - A kept read of an all-rejected page gives `[]` with `itemsSeen: 2`, `unfiltered: false`.
  - The same page read as an exploration answers its rejected rows.
- `content/actions/tests/extract-list-kept-answer.test.ts` (new): 3 tests.
  - Passes with `[]` when items were seen.
  - Fails when no item was on the page.
  - `minItems` 4 vs 3 vs 0.
  - An exploration read keeps the minimum on rows.
  - These were first appended to `extract-list.test.ts`, which then reached 809 lines and failed the audit's 800-line limit, so they were moved into this file. `extract-list.test.ts` is back to its HEAD content.
- `panel/extraction/tests/confirm-payload.test.ts` and `view-model.test.ts`: the paginate tests are rewritten so that the payload and the draft have no `paginate` member.
- `panel/extraction/tests/panel.test.ts`: a new test. With a detected control, there is no `extractionPaginate`/`extractionPaginateRow`, no "Read every page" text, the note names a Next page step, and the sent confirm has no `paginate`.
- `panel/extraction/tests/panel-draft-recovery.test.ts`: this test used the checkbox as its "unrelated same-draft redraw". It now renames another column instead. A kind change was tried first, but it starts an async preview re-read that outlives the test (`chrome is not defined`).
- `background/tests/extraction-confirm.test.ts`: the "paginated read gets a scaled budget" test pinned the confirm member and is replaced. A confirm that still names `paginate` now records a definition without it and gets the one-page budget.

## Commands run and observed results

- Fail-first, before implementation: `node .../run-subset.mjs <apps/extension> s45-e <8 files>` then `node --test <bundles>` gave `# pass 105`, `# fail 8`.
  - The new or changed tests that failed are kept-answer filtered-answer, list-reader kept read, extract-list kept minimum, confirm-payload, view-model, panel checkbox, and extraction-confirm. The eighth was the draft-recovery file, which failed on the kind-change redraw I had first put in.
  - The exploration-floor tests passed, as expected.
- After implementation, the subset was run over 29 files:
  - `content/extraction/tests/{filtered-answer,list-reader,list-reader-refused-page,rejected-samples}`
  - `content/actions/tests/extract-list*.test.ts` (4)
  - all 15 `panel/extraction/tests/*.test.ts`
  - `background/tests/extraction-*.test.ts` (5; `background/extraction/tests/` does not exist)
  - Result: `# tests 286`, `# pass 286`, `# fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` (repo root) exited 0. This runs tsc over `tsconfig.json` and `tsconfig.test.json`, so tests and e2e are typechecked.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (172 warning(s), 118 baselined).` and exited 0. The first run had failed on `extract-list.test.ts` at 809 lines and was fixed as described above.
- A grep for `extractionPaginate|Read every page|everyPage|setExtractionPaginate` over apps, packages and scripts finds only the new tests' own assertions and comments.
- The scratch build dir `.test-build-scratch/s45-e` was removed afterwards.

## Not verified

- No live browser check of the picker panel, and no Lab or provider run, as the brief requires.
- No end-to-end run of a Flow read with `answer: "kept"` through the domain dispatch. Only the page side was unit-tested.
- The full extension test suite was not run; only the subset above.

## Open questions or contradictions found

- The domain client barrel does not re-export `WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT`, although `request.ts` exports it. If the domain owner adds it to `domain/src/client`, the two `"kept"` literals here could import it.
- A continued read whose checkpoint carried no `itemsSeen` falls back to its row count for the kept minimum. That case cannot occur for a one-page Flow read, but it is noted.
- The draft keeps `pagination`, as information only, so the note can say the list goes on. If the supervisor prefers to drop it entirely, the note's second sentence goes with it.
