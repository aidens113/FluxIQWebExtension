# t730-c4 job-board hooks: report

## Outcome

Done. The job board has a new mode you can arm, `in-place-filters`. In that mode a filter-pill menu option fetches the filtered results and swaps them into the page under `aria-busy`, and the address does not move. The click row that used to be blocked now runs on that mode, so `click.spec.ts` no longer opens any synthetic scenario. All 17 click rows pass headed, and all 57 job-board unit tests pass.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- `apps/scenario-lab/src/scenarios/job-board/types.ts`: added `in-place-filters` to `jobBoardModes`, with a doc entry. It is armed through the site's existing `set-mode` operation, which starts the board over, the same as the other modes. I added no manifest variant. A manifest variant has to belong to a workflow and carry its own expectations, and the spec only needs the mode. The manifest, the live tasks and the repair tasks are unchanged.
- `.../job-board/board/results-page.ts`: in this mode only, the results column (`c.left`) carries `aria-busy="false"`. The baseline markup is byte-identical to before, and a unit test asserts this.
- `.../job-board/board/client-script.ts`:
  - New `refine(href)`. When the page is a results page in `in-place-filters` mode, a plain click on a `pillOption` link does the following:
    - It cancels the navigation and closes the menus.
    - It sets the column to `aria-busy="true"` and fetches the link's own results page, with at least 400 ms before the answer, like the job pane's minimum.
    - It swaps that page's filters, header (`meta`) and results column into this page.
    - It refreshes the page data that `CONFIG` holds (words, ads, companies, limitHrefs) from the fetched page, repaints the hearts, and sets `aria-busy="false"`.
  - A ctrl, meta or shift click still opens the link as a link.
  - A failed fetch shows the toast "We couldn't update your results. Try again." This can be the board's every-sixth 429.
  - Nothing calls `pushState` or `replaceState`.
  - The jobs-per-page `change` listener is now delegated to the document, so it still works after the column is replaced. Behaviour is unchanged in every mode.
  - No visible text or test ids were added apart from that failure toast.
- New `.../job-board/board/tests/in-place-filters.test.ts`, with four tests:
  - Arming resets to a fresh `in-place-filters` state.
  - Only the armed render carries `aria-busy=`, and its markup is otherwise exactly the baseline's.
  - In a browser, on the armed board:
    - Remote only drives `aria-busy` through exactly `["true","false"]`.
    - The count becomes "Page 1 of 28 jobs".
    - The address is unchanged and the Remote pill is active.
    - After the swap, the per-page select still navigates to `limit=50&wp=remote`.
    - No page errors occur.
  - In a browser, on baseline, the same option still navigates to `wp=remote` and the page has no `aria-busy`.
- `apps/extension/e2e/content/tests/click.spec.ts`: replaced the blocked `on company-directory` block with `on job-board's in-place filters`. The row does the following:
  - It arms the mode, then answers consent, the alert offer and the chat.
  - It loads `/jobs` and checks "Page 1 of 40 jobs".
  - It presses the Remote pill, then marks "Remote only" with `data-spec-filter`.
  - It runs `web.dom.click` on that link.
  - It asserts that the click succeeded and was judged on the link's href, with `actual` matching `IN_PLACE_CONTENT` and no failure.
  - It reads `aria-busy`, which is "false", and the count, "Page 1 of 28 jobs", once each.
  - It checks the address is unchanged.

  The file has no `company-directory` reference left.

## Commands run and observed results

These were run from `apps/scenario-lab` unless noted.

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"`
  - The first attempts failed on test-file type errors (`window`, then `MutationObserver`; the scenario-lab tsconfig has no DOM lib). I fixed them.
  - The final build succeeded: "stored in the shared store (1073 file(s)…)".
- `node --test dist/scenarios/job-board/board/tests/*.test.js`
  - Final: `# pass 4  # fail 0`, five times in a row.
  - Earlier failures, now fixed:
    - A client regex had been written with a literal newline, which produced the page error "Invalid regular expression: missing /".
    - `waitForFunction` was refused by the board's CSP ("unsafe-eval"), so I replaced it with an `evaluate` poll.
    - A `waitForSelector('[aria-busy="true"]')` wait timed out intermittently. A probe with a MutationObserver showed the real sequence `click A → true → false` on 6 of 6 runs, so the test now records that sequence instead.
- `node --test dist/scenarios/job-board/tests/*.test.js dist/scenarios/job-board/board/tests/*.test.js dist/scenarios/job-board/breadth/tests/*.test.js dist/scenarios/job-board/qualification/tests/*.test.js` → `# tests 57  # pass 57  # fail 0`. This covers the manifest shape, the live-task and dataset consistency, and the browser honest and naive paths.
- `node --test dist/scenarios/tests/live-instructions.test.js dist/scenarios/tests/live-repair-tasks.test.js dist/scenarios/tests/realistic-site-live-tasks.test.js` → `# tests 23  # pass 23  # fail 0`.
- A grep for `JobBoardMode|jobBoardModes` outside `scenarios/job-board/` in apps, packages and scripts found no consumers.
- From the repository root: `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/click.spec.ts --headed --workers=2 --reporter=line` → `17 passed (4.2m)`. That includes `[17/17] … on job-board's in-place filters › a filter link the page loads in place passes…`.

## Not verified

- I did not run a separate typecheck of `click.spec.ts`; Playwright compiled and ran it. I also ran no full-package typecheck, no structure audit and no full suites.
- The in-place spec row passed once, in the single headed run. I did not repeat it for flakiness.
- I do not know the root cause of the earlier intermittent `waitForSelector` miss. The page sequence was correct in every probe, and the cause may be a Playwright polling or CSP interaction.

## Open questions or contradictions found

- The mode is reachable only through `set-mode`; it is not declared as a manifest variant. If the supervisor wants every armable rendering listed in the manifest, it would need a workflow to attach to and its own expectations. That would also change the manifest-shape assertion in `job-board/tests/scenario.test.ts`.
- During one build, the build cache reported "waited 50.7s for pid 9832's run of this step". Another process in this tree was building scenario-lab at the same time.
