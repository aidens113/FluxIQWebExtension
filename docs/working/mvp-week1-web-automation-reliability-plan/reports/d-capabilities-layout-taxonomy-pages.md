# d-capabilities-layout-taxonomy-pages

Worker report for the thirty-fifth dispatch, brief `d-capabilities-layout-taxonomy-pages`
in `briefs/finish-week1.md`. Repository at `af80298`, working tree as of 2026-09-13.

## Outcome

Done. Every audit item for my three pages is fixed:
- `web-capabilities.md`: W1 and W2;
- `repository-layout.md`: R1 and R2;
- `failure-taxonomy.md`: F1, plus the audit's optional `fixture.invalid` note.

I also made two corrections the audit did not ask for:
- **The upload row.** It is no longer held back, now that `af80298` is committed.
- **The Lab's failure categories.** `failure-taxonomy.md` listed seven areas; the
  code has more.

## What changed and why

### `docs/architecture/web-capabilities.md`
- **W2, the header date.** The page still says its cross-cutting claims were
  re-verified on 2026-09-12. It now adds that the rows and sections changed since
  (uploads, tab changes, child frames, confirmations and dynamic elements) were
  checked against source on 2026-09-13.
- **W1, the Dynamic elements row.** The row stays Partially supported.
  - Removed: "must still author a wait before the action".
  - Now: a recorded DOM addition followed by a click in the same top document
    proposes `web.dom.wait_for_selector` on that click's selector, ahead of the
    click.
  - The row lists what still needs an authored wait: a Flow built by hand, any
    verb but a click, a click in a child frame, and a target revealed without an
    added node.
  - `domain/src/recording/proposals/late-target-wait.ts` is added to the owning
    files.
  - Sources: `late-target-wait.ts:52-91`, `web-panel-host.ts:135`.
- **W1, a new Recorded Actions bullet** stating the rule:
  - a batch with `added > 0` (`late-target-wait.ts:67-73`);
  - the first executable entry decides, and it must be a `web.dom.click` with a
    non-empty selector (`:55-62`, `:83-86`);
  - evidence in between is skipped unless it names another URL (`:93-98`);
  - the click is in the top frame, and its URL matches apart from the fragment
    (`:87-89`, `:101-110`);
  - the candidate is `{ selector, wait: { condition: "present" } }` (`:90`);
  - it is proposed from the addition's entry, never the click's (`:13-14`,
    `web-panel-host.ts:135`);
  - it has no source input and no expected confirmation (`:15-17`).

  **Not stated:** the wait's timeout. `late-target-wait.ts:15` is held back, and
  timeout forwarding belongs to `g-web-timeout-forwarding`.

  **The link** goes to `extension-client.md#recording-evidence`.
- **The upload row.**
  - The check passes only on exactly the requested names, in order.
  - `expected` and `actual` give only how many files there are and whether the
    names match, and a refusal names a file by its position.
  - A command with no files is also refused.
  - Sources: `content/actions/upload.ts:3-16,26,33-50`;
    `content/action-runtime/file-input.ts:12-14,36,45-47`.

### `docs/architecture/repository-layout.md`
- **R1, a new "Content Harness" section** under Validation Commands:
  - both command forms, which both ran (see below);
  - the script builds `packages/test-contracts` first. The Scenario Lab source
    value-imports it (`apps/scenario-lab/src/types.ts:85`), and its `import`
    export is `./dist/index.js` (`packages/test-contracts/package.json:6-10`). So
    the direct form assumes that build exists;
  - the config's 4 workers, and when to pass `--workers=2`
    (`e2e/playwright.content.config.ts:7-10,18`);
  - each run has its own directory under `.harness-build/`, removed at the end
    (`e2e/content/global-setup.ts:1-7,21-27`);
  - what the harness proves and does not (`e2e/content/harness.ts:1-21`);
  - `test:e2e` is a separate suite. It runs the extension build first
    (`apps/extension/package.json:11-12`) and ignores `content/`
    (`e2e/playwright.config.ts:4,6`).
- **R1, a new "Test Build Labels" section:**
  - the label format, and that a malformed label stops the run;
  - where each label sends bundles: `apps/extension/scripts/test-extension.mjs:15-27`;
    `domain/scripts/test-domain.mjs:9-19`;
  - an unlabelled domain run writes the tracked `domain/.test-build/`.
- **Links to the new sections:** the Lab-instance paragraph now links to Test Build
  Labels.
- **Tracking table, three new rows,** each checked with `git check-ignore -v`
  against `.gitignore:18,24-26`:
  - the two `.test-build-scratch/<label>/` directories;
  - `e2e/content/.harness-build/`;
  - `test-results/`.
- **R2, the tree:** it now lists `src/recording/proposals/`.
- **The `e2e/` line** now names both suites. It had called the directory only
  content-harness suites.

### `docs/architecture/failure-taxonomy.md`
- **F1, the date:** "verified against source on 2026-09-13". I re-counted the code
  set at `af80298`: 15 `: "web.` values in `codes.ts`. For the producers, I relied on
  the audit's same-day check at `5bad6c3`. `af80298` touched only the upload files.
- **"Two Axes":**
  - **The category list.** The parenthetical copied the doc comment's seven areas,
    but `failureCategories` (`packages/test-contracts/src/evaluation.ts:13-18`) has
    17 entries in more areas. The page now names the array and gives three
    examples.
  - **A new paragraph on rejected manifests** (`packages/test-runner/src/scenarios.ts`):
    - a rejection at registry import, or by the runner's own check, is
      `fixture.invalid` (`:10-13`, `:18-21`, `:38-45`);
    - so is an unknown scenario id (`:26`);
    - the message holds only issue paths and the validator's wording (`:31-37`);
    - a missing build is `environment.missing` (`:17`);
    - any other load error is passed on unchanged (`:42`).

## Commands run and observed results

- **Content harness, direct form, one spec.** Run from `apps/extension` with
  `EXTENSION_TEST_BUILD_LABEL=d-capabilities-layout-taxonomy-pages`:
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 select.spec.ts`
  printed `Running 12 tests using 2 workers`, then 12 `ok` lines and
  `12 passed (3.6s)`. Exit 0.
- **Content harness, script form, the same spec.** Run from the root:
  `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=2 select.spec.ts`
  - It printed `> tsc -p tsconfig.json` for `@fluxiq-web-extension/test-contracts build`.
  - Then `Running 12 tests using 2 workers` and `12 passed (3.8s)`. Exit 0.
  - The forwarded arguments were `-- "--" "--workers=2" "select.spec.ts"`; the
    script drops the leading `--`.
- **Link check, before editing:**
  `node C:/Users/mrjoh/AppData/Local/Temp/claude/f---FluxIQWebExtension/4f264c80-323b-4673-a09a-bde5851669f3/scratchpad/dcd-check-links.mjs docs/architecture/web-capabilities.md docs/architecture/repository-layout.md docs/architecture/failure-taxonomy.md`
  printed `checked 41 relative links in 3 page(s), 0 unresolved`. Exit 0.
- **The same link check, after editing:**
  `checked 48 relative links in 3 page(s), 0 unresolved`. Exit 0.
- **The same link check, after re-pointing W1's two links** to
  `extension-client.md#a-wait-before-a-late-target`:
  `checked 49 relative links in 3 page(s), 0 unresolved`. Exit 0.
- **Structure audit:** `node scripts/structure-audit.mjs`, from the root, printed
  `structure-audit: passed (40 warning(s), 17 baselined).` Exit 0. The warnings are
  advisory line counts on source files; none names a doc.
- **`git diff --stat` over my three pages:**
  - `failure-taxonomy.md | 31`, `repository-layout.md | 70`, `web-capabilities.md | 30`;
  - `3 files changed, 115 insertions(+), 16 deletions(-)`.
  - `git status` shows other docs workers' pages modified too; I did not touch them.
- **Supporting reads:**
  - `grep -c ': "web\.' domain/src/runtime/failure/codes.ts` gave 15;
  - `git check-ignore -v` on the four scratch paths matched `.gitignore:18,24,25,26`;
  - a grep for multi-file tests (`multiple|two files|several files|2 files`) in the
    upload unit test, the action-runtime tests and `upload-dialog.spec.ts` found
    none, so "Multi-file uploads are coded but untested" was left as it is.

## Not verified

- **A fresh clone.** I did not test the direct harness form without
  `packages/test-contracts/dist`. The claim that it needs that build rests on the
  export map and the Scenario Lab's value import, not on a reproduction.
- **`test:e2e`.** I did not run it. Its description rests on
  `apps/extension/package.json:11-12` and `e2e/playwright.config.ts:4,6`.
- **The failure-taxonomy producer list.** I did not re-read it line by line at
  `af80298`. The date rests on the audit's check at `5bad6c3`, plus my re-count of
  the codes. `g-web-timeout-forwarding` may yet change what produces `TIMEOUT`, and
  the page says nothing about that.
- **The web-capabilities rows I did not touch:** the summary counts (`:52-59`), and
  the switch and close tab rows. The header's "tab changes were checked on
  2026-09-13" rests on the audit's check of the switch lookup, the 100 ms poll and
  the 8-tab history. W15's fix, if it changes close order, would make that row
  stale.
- **Rendering.** No rendered preview. The link checker's slug rule approximates
  GitHub's.
- **The Lab.** No Lab run; these are docs only. What a Lab run should show for W1 is
  already in the plan: a live `delayed-ui` recording proposes the wait before its
  click, and W25 replays.

## Open questions or contradictions found

1. **The binding rules are out of date on one command.** `briefs/finish-week1.md:20-22`
   say the `pnpm --filter ... test:content --` form "finds no tests". It ran 12 tests
   and passed on 2026-09-13, as quoted above. The supervisor should correct that
   line; I do not edit shared documents.
2. **W1's link, re-pointed.** It first went to `extension-client.md#recording-evidence`,
   because the extension-client page had no section for the wait when I linked.
   On the coordinator's message, the Dynamic elements row and the Recorded Actions
   bullet both now link to `extension-client.md#a-wait-before-a-late-target`, which
   exists at `extension-client.md:668`. The link check was rerun afterwards (see
   below). Neither place gives the wait's timeout.
3. **The audit's spec count is off by one.** It says 25 content-harness specs.
   `apps/extension/e2e/content/tests/` holds 24 `*.spec.ts` files plus
   `identity-fixtures.ts`. This matters to `d-testing-facility-page` if it quotes a
   count; my page gives none.
4. **Audit open question 4 is not done.** It asked whether `repository-layout.md`
   should carry the Lab worktree and Core pin rule. The brief does not decide it, so
   I added nothing.
5. **Some old plan history is still on my pages.** "Describe the current design
   only" was applied to what I wrote, not to text already there. Examples:
   - web-capabilities: "Before Phase 1.1 an unknown type silently became
     `web.dom.extract`", and the "Changed by (Phase 1.2)" column;
   - failure-taxonomy: the removed `WebAutomationRuntimeError` paragraph;
   - repository-layout: the `.script-build/` history row.

   Trimming those is the supervisor's call.
