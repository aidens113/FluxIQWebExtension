# Report: s45-j-next-page-e2e

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension`, branch `task/t284-read-list-s45-next-page`. Core is the
sibling `fxwork/t284/!FluxIQ`; `core-build` reported it current with its source.

## Outcome

Done. `everything-store-next-page.spec.ts` passed on its first run, and passed again on a second run. The control
`everything-store-extraction.spec.ts` also passed both times. No product or spec change was needed, so no file was
edited. The named unit tests pass. The extension check exits 0 and so does the structure audit.

## What changed and why

Nothing. Before accepting the green run, I checked that the spec's premise is real. In the fixture, the Next on page two
links back to page two: `apps/scenario-lab/src/scenarios/everything-store/pages/results/pagination.ts:22`,
`const nextTarget = page.page === 2 ? 2 : page.page + 1;`. On the last page, Next is a
`<span aria-disabled="true">`. So the second test's `pageOf(url) === 3` would fail if the step followed Next, which
would reload page two. The first test's `[1,2,3,4,5]` followed by `ended control_disabled` exercises the real disabled
control.

The harness's global setup (`e2e/content/global-setup.ts`) bundles the content script from the current `src/` into a
per-run directory, so the runs tested this tree's uncommitted code.

## Commands run and observed results

**E2E**, from the tree root. Narrowest command: the package's content-harness script with Playwright file filters.

```
pnpm.cmd --filter @fluxiq-web-extension/extension test:content -- everything-store-next-page.spec.ts everything-store-extraction.spec.ts --reporter=list
```

- Browser: headless full Chromium (`channel: "chromium"`) from `e2e/playwright.content.config.ts`, 4 workers. The
  content bundle runs in the page with the `chrome.runtime` stub; no extension, Lab or provider was used.
- Run 1: `4 passed (60.0s)`.
  - next-page "a read and Next page go through all five results pages…": 40.4s.
  - next-page "from page two the step follows the pager's page three…": 11.2s.
  - Both extraction control tests: ok.
- Run 2: `4 passed (1.0m)`.
  - The two next-page tests: 41.2s and 13.0s.
  - Both controls: ok.
- Afterwards, `tasklist | grep -ic chrom` printed `0`, so no browser was left running.

To run only the new spec, drop the second filter:
`pnpm.cmd --filter @fluxiq-web-extension/extension test:content -- everything-store-next-page.spec.ts`.

**Unit tests.** I bundled the following with `run-subset.mjs … s45-j`:
- `src/content/actions/tests/next-page.test.ts`;
- `src/content/extraction/page-advance/tests/move-page.test.ts` (the only file in that `tests/`);
- `src/runtime/tests/next-page-continuation.test.ts`;
- `src/content/extraction/tests/{pagination,pagination-pace,detect-pagination,list-reader}.test.ts`.

`node --test` over the 7 bundles printed `# tests 94 # pass 94 # fail 0 # cancelled 0`. The store-pager fixture walk
(`content/extraction/tests/store-pager.ts`) runs through `move-page.test.ts`, `pagination.test.ts`,
`detect-pagination.test.ts` and `list-reader.test.ts`.

**Extension check.** `pnpm.cmd --filter @fluxiq-web-extension/extension check` ran three times:
- Run 1 exited 1. `domain/src/output-nodes/extract-list/dispatch.ts:98` imported `webAutomationRecordOutputProcessValue`,
  which `record-output-process.ts` (untracked, new) did not export. The popup and sidepanel bundles failed. That code
  belongs to the domain workers who were editing at that moment; I did not touch it.
- Runs 2 and 3 exited 0. By then the import was gone (grep found no match). Both runs logged
  `not stamped, because inputs changed while it ran (domain)`, which means domain was still being edited during them.

**Structure audit.** `node scripts/structure-audit.mjs` exited 0 and printed
`structure-audit: passed (172 warning(s), 118 baselined).`

## Not verified

- Firefox: the spec ran only under Chromium.
- The real extension: no background worker, no `chrome.scripting` re-injection, no tab routing. The spec plays the
  worker's resend itself, as its header says. So `runtime/extract-list-continuation.ts`'s `sendNextPageAcrossDocuments`
  was not run against a real browser.
- The `by` the page marks before a press. The page sends it over `chrome.runtime`, and that mark is lost with the
  document. The spec's resend always says `by: "next"`, so the e2e proves where the step went (by URL), not the `by`
  word it reported.
- A whole-package unit run, which was not asked for.

## Open questions or contradictions found

- The extension check is not stable while the domain workers are mid-edit. The supervisor should rerun it after their
  work lands; a green run from me does not cover their final state.
