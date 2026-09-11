# w1-fixture-infinite-feed report

Worker `w1-fixture-infinite-feed`, Wave 1 Batch B, corpus row W11.

## Outcome

**Partial.** The fixture, its unit tests, and its Playwright spec are
written. The unit test passed 7/7 in place. The spec passed 4/4, then 20/20
with `--repeat-each=5`, but only in a scratch copy of the Scenario Lab. The
brief's exact in-place Playwright command never reached my tests, because
two other workers' files were half-finished at the time:

1. The `data-table` fixture's `table-page.ts` contains `\25B2` and `\25BC`
   inside a template literal. Playwright's loader rejects them as invalid
   escapes, and tsc reports TS1487 for them.
2. `packages/test-contracts` `src/index.ts` and `dist/index.js` re-export
   `bench-report.js` and `bench-report-validation.js`, but `dist` has no
   such files yet. At my last check `src/bench-report.ts` existed and had
   not been built.

The same gap in item 2 now stops my unit test and the shared registry and
server tests from loading. The supervisor should rerun the three
definition-of-done commands once both are consistent.

## What changed and why

All paths are under `apps/scenario-lab/`. I edited nothing outside the paths
I own.

| File | Purpose |
| --- | --- |
| `src/scenarios/infinite-feed/scenario.ts` | Replaces the placeholder. Keeps the export name `infiniteFeedScenario`, id `infinite-feed`, seed `116`, start path `/scenarios/infinite-feed/`, and title "Infinite feed". Holds the manifest, state, `mutate`, `render`, and `route`. |
| `src/scenarios/infinite-feed/feed-content.ts` | Generates posts from the seed and a 1-based position (`feedItem`, `feedPageItems`, `FEED_PAGE_SIZE = 10`). |
| `src/scenarios/infinite-feed/feed-markup.ts` | Builds the start document, the page fragment, and the inline client script (`renderFeedDocument`, `renderFeedPage`, `FEED_PAGE_HEIGHT_PX`). |
| `src/scenarios/infinite-feed/tests/scenario.test.ts` | Seven node:test tests: manifest validity, the variant, determinism, every `mutate` operation, and every `route` response. |
| `e2e/infinite-feed.spec.ts` | Four Playwright tests: W11 driven from the manifest's own script, loading and busy behaviour, a fresh session on reopen, and the `end-early` variant. |

### Fixture design

- **Markup.** The page uses the WAI-ARIA feed pattern.
  - `role="feed"` has `aria-busy`, which is true while a page loads.
  - Each post is an `<article>` with `aria-posinset`, `aria-setsize="-1"`,
    and `aria-labelledby` pointing at its `<h2>`.
  - The loading indicator is `role="status"`. The status line is
    `aria-live`.
  - Every workflow touchpoint has a stable test id: `feed`, `feed-page-N`,
    `feed-item`, `feed-item-title`, `feed-item-author`, `feed-item-time`,
    `feed-item-summary`, `feed-sentinel`, `feed-loading`, `feed-end`, and
    `feed-status`. Each article also carries `data-item-id="post-N"`.
- **Loading.** An IntersectionObserver watches a 1px sentinel below the
  feed. When the sentinel enters the viewport, the page:
  1. shows the loading indicator;
  2. waits a fixed 300 ms;
  3. fetches `GET /scenarios/infinite-feed/page/<n>`;
  4. appends the fragment.

  A `busy` flag stops overlapping loads. When the fragment says it is the
  last page, the page removes the sentinel, disconnects the observer, and
  shows "You're all caught up".
- **Geometry.** Cards have a fixed 160 px pitch, so each page of 10 is
  exactly 1600 px. That is taller than the runner's 720 px viewport, so
  after each append the sentinel is off-screen again. The result is that
  one scroll reaching the document bottom triggers exactly one load. The
  spec checks this by asserting the page requests are exactly
  `page/2, page/3, page/4`.
- **Oracle.** `/__control/final-state` returns this state shape:
  `{ mode, feedLength, loadedCount, ended, sessions, lastOperation }`.
- **Mutate operations.** Every state change goes through `mutate`:
  - `open` resets the session to page one and increments `sessions`. The
    client calls it on every page load.
  - `load-page {page}` applies only when `page` is the next page and the
    feed has not ended. Anything else leaves the state unchanged.
  - `set-mode {mode: "baseline" | "end-early"}` sets the feed length to 60
    or 25.
  - Unknown operations and malformed payloads leave the state unchanged.
- **Route.** Only `page/<n>` is served:
  - **200:** the next page's fragment, plus the `load-page` mutation, so the
    server records the load before responding.
  - **409:** a page that is inside the feed but out of order. This includes
    re-requesting a page after the feed has ended.
  - **404** (`undefined`): page 1, which is already in the start document;
    pages past the end; and malformed subpaths.
- **Determinism.** Content depends only on the seed and position: no
  `Math.random`, no clock. Post ids `post-N` stay the same across seeds.
  Titles, authors, and summaries vary with the seed. Timestamps count back
  from a fixed base, 2026-03-01T12:00Z, newest first.

## Workflows and variants

There are no `workflows[]` entries, because W11 is the only corpus row on
this fixture.

| Workflow | Variant | Arm | Expected outcome |
| --- | --- | --- | --- |
| primary (W11) | none | none | Success. Extract `extract-loaded-posts` returns 40 records (`title`, `author`, `published`). Final state: `feed-status` reads "Showing 40 posts", `feed-page-4` exists, `feed-page-5` does not, `feed-end` is hidden. Actions `web.dom.scroll` and `web.dom.extract` succeed. Recording event `web.scroll.changed`. No console errors are allowed. |
| primary (W11) | `end-early` | `set-mode {mode: "end-early"}` | Success. The extract returns 25 records. Final state: `feed-status` reads "Showing all 25 posts", `feed-end` is visible, `feed-page-4` does not exist. Actions, recording events, and allowed console errors are inherited from the primary workflow. There is no `failure` field. |

The recording script:

1. Three `scroll` steps of 2000 px each.
2. After each scroll, a `waitForState` on `testid:feed-page-2`, `-3`, and
   `-4` in turn, with a 5000 ms timeout.
3. `extract` with target `testid:feed-item` and fields `title`
   (`testid:feed-item-title`), `author` (`testid:feed-item-author`), and
   `published` (`testid:feed-item-time@datetime`).
4. A `checkpoint`.

Capabilities are `scroll` and `mutation`.

## Corpus decisions I had to make

1. **Waits between scrolls.** The brief asks for fixed scroll steps sized
   for 40. The runner's `scroll` is `page.mouse.wheel`, which returns before
   anything loads. Without a sync step, the next wheel would arrive while a
   load was still running, and the count would depend on timing. So the
   scroll steps stay fixed, and each is followed by a wait on the page it
   loads.
2. **Scroll size.** Each step is 2000 px, which is 1.25 pages. The document
   bottom limits every step, so a larger value cannot load extra pages. The
   unit test keeps the value between one and two pages.
3. **Waits assume the baseline.** Under `end-early`, the `page-4-loaded`
   wait can never succeed. The contract says `arm` is applied after
   recording, so the recording script never runs armed. The e2e variant
   test replays the same scroll steps and waits on the status line instead.
   **If any lane runs the recording script after arming, it will time out
   at `page-4-loaded`.** Flag for `w1-runner-asserts`.
4. **Arming clamps an open session.** `set-mode` also lowers `loadedCount`
   to the new length, so `loadedCount <= feedLength` always holds. The
   run's start document calls `open`, which resets to page one anyway, so a
   run after recording always starts from 10 posts.
5. **Page containers.** Each load is wrapped in a plain `<div>` with the
   test id `feed-page-N`, inside `role="feed"`. This gives each load a
   stable wait target and makes "page 4 absent" a checkable fact.

## Commands run and observed results

- **Build.** `pnpm --filter @fluxiq-web-extension/scenario-lab build`, run 3
  times.
  - Every run exited 2. The only errors were
    `src/scenarios/data-table/table-page.ts(15,49)` and `(16,50)`,
    "TS1487: Octal escape sequences are not allowed". That is another
    fixture's directory.
  - tsc still emitted all of my `dist` files (timestamps 12:45:28), with no
    error in any infinite-feed file.
- **Unit test.**
  `node --test apps/scenario-lab/dist/scenarios/infinite-feed/tests/scenario.test.js`
  - First run: `# pass 6 # fail 1`, with "11 !== 10". My test's item
    counter also matched the `[data-testid="feed-item"]` selector inside the
    client script. I tightened the regex to `<article class="feed-item"
    data-testid="feed-item"`.
  - Rerun: `# tests 7 # pass 7 # fail 0`.
  - Two later runs, after the contracts gap appeared: `ERR_MODULE_NOT_FOUND
    ... packages\test-contracts\dist\bench-report.js imported from
    ...dist\index.js`, `# pass 0 # fail 1`.
- **E2E, in place.**
  `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/infinite-feed.spec.ts`,
  run 5 times.
  - Runs 1–2: `SyntaxError: ...data-table\table-page.ts: Invalid escape
    sequence in template. (15:49)`, then "No tests found".
  - Runs 3–5: `Cannot find module ...test-contracts\dist\bench-report.js
    imported from ...dist\index.d.ts`, then "No tests found". The
    Scenario Lab `tsconfig` `paths` points Playwright at `dist/index.d.ts`.
  - pnpm then prints "Command "playwright" not found" after the non-zero
    exit. Playwright did run.
- **E2E, scratch copy.**
  - Setup, in my scratchpad:
    - a copy of `apps/scenario-lab/src`, `package.json`, and
      `tsconfig.json`;
    - from `e2e/`, only my spec, `network-policy.ts`, and
      `playwright.config.ts`;
    - a junction `node_modules` pointing to the package's real
      `node_modules`.
  - The only change to the copy: the data-table `\25B` escapes doubled.
  - Command: `node <copy>/node_modules/@playwright/test/cli.js test -c
    <copy>/e2e/playwright.config.ts`.
  - Result: `4 passed (6.1s)`. With `--repeat-each=5`: `20 passed (17.4s)`
    on 6 workers.
  - This ran around 12:47, while `test-contracts/dist` was still
    consistent.
  - Afterwards I removed the junction with `cmd /c rmdir` and confirmed the
    real `node_modules\@playwright\test\cli.js` still exists.
- **Structure audit.** `node scripts/structure-audit.mjs`
  - The audit lists files with `git ls-files`. My whole directory is
    untracked (the placeholder was never committed), so a plain run checks
    none of my files.
  - I reran it with `GIT_INDEX_FILE` pointing at a scratch copy of the
    index, with my five files added intent-to-add. The real index is
    untouched; `git status` still shows `??`.
  - Result: no finding names infinite-feed. The only matching line is
    `structure-audit: 1 baseline entries can be lowered.`, which was
    already there before my changes. I did not run `pnpm structure:baseline`.
  - The plain run also shows two findings that are not mine: `FAIL
    [working-docs]` for the plan document (824 lines against the 800-line
    limit), and `docs/working/README.md` out of date.
- **Shared tests.**
  `node --test apps/scenario-lab/dist/tests/registry.test.js apps/scenario-lab/dist/tests/server.test.js`:
  both fail to load with the same `bench-report.js` `ERR_MODULE_NOT_FOUND`.

## Not verified

- The brief's in-place Playwright command against my spec. It was blocked
  every time by the files above. The spec is verified only in the scratch
  copy.
- My unit test against the current contracts `dist`. It passed 7/7 against
  the earlier `dist`.
- The shared `registry.test.js` and `server.test.js` with my fixture
  registered. By inspection my manifest meets their per-scenario checks,
  and my own test runs `validateWebScenario` on it.
- The FluxIQ lane: extension recording, `web.scroll.changed` events, and
  executing the `extract` step as `web.dom.extract`. Only plain Playwright
  was run.
- Viewports taller than 1600 px. There the sentinel could stay visible after
  an append, and the one-load-per-scroll geometry would not hold. The runner
  uses 1280×720.

## Open questions or contradictions found

1. **Selector syntax inside `fields`.** The contract comment says a field is
   "a selector inside each item". I used the same `testid:` form as
   `target`. `w1-runner-asserts` must apply the `testid:` mapping to field
   selectors too, splitting off `@attribute` first, or these fields should
   switch to raw CSS.
2. **Recording waits and arming** (decision 3). If a lane runs the
   recording script after `arm`, the `end-early` variant times out at
   `page-4-loaded`.
3. **Expected action name.** `expected.actions` includes `web.dom.extract`
   with outcome `succeeded`, assuming the extract step becomes a
   `web.dom.extract` action in the flow. Adjust if the domain mapping names
   it differently.
4. **Build and load blockers outside my ownership:**
   - the data-table `\25B2` and `\25BC` escapes need doubling or `▲`;
   - `test-contracts` needs `bench-report` built into `dist`.
