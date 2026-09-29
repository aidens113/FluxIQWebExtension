# In-place effect check sees open shadow roots (t173-G)

## Outcome

Partial. The code and unit tests are done, and tsc passes on both configs.
The new content spec is written and type-checks, but it has not run:
Playwright chromium-1161 is incomplete on this machine. The directory
`%LOCALAPPDATA%/ms-playwright/chromium-1161/chrome-win` holds only
`chrome.dll` and a manifest, with no `chrome.exe`, and a `__dirlock` is
present. Per the brief, I did not install it. `actions/click.ts` is unchanged.

## What changed and why

- `apps/extension/src/content/action-runtime/in-place-effect.ts`
  - **What it observes.** The MutationObserver now covers every open shadow
    root as well as `document.documentElement`, and it uses the same
    `OBSERVED` options for all of them. A MutationObserver's `subtree` stops
    at every shadow boundary, which was the defect: the bigbox flyout's
    `hidden` flip produced no record.
  - **Which roots are covered.**
    - Roots present at the start are found with `composedRoots(document)`,
      minus the document itself.
    - Roots carried in by an element added during the window are found with
      `openRootsWithin(addedElement)` on each childList record.
    - Roots attached without a mutation (`attachShadow` on an element already
      on the page, or a late custom-element upgrade) are found by walking the
      page again. The walk happens at the first check, every `ROOT_RESCAN_MS`
      (500 ms) and at the deadline.
    - A root that appears outside the link counts as moved structure and
      marks the text dirty.
  - **"Inside the link"** is now decided with `composedContains`, so a ripple
    inside the link's own shadow tree still does not count.
  - **Text comparison.** Rendered text is compared with
    `composedRenderedText(document, roots)`.
  - **Header comment.** Updated. Closed roots stay explicitly out of scope.
- `apps/extension/src/content/action-runtime/composed-rendered-text.ts` (new;
  I split it out for cohesion). It returns `body.innerText` plus each open
  root's reading, joined with a separator. Details:
  - A root's reading is the `innerText` of its **rendered** top-level
    elements, meaning those with `getClientRects().length > 0`. A box-less
    element's `innerText` falls back to `textContent`, which would put a
    closed panel's text in the baseline.
  - It descends through `display: contents` wrappers.
  - A root that draws nothing adds nothing, so an empty component does not
    count as new text.
  - Text nodes directly under a root are not read.
- `action-runtime/tests/in-place-effect.test.ts` (new, 10 rows). It uses a
  hand-built page and a fake MutationObserver that, like the real one, never
  delivers across a shadow boundary. Rows:
  - a bigbox-style flyout un-hidden inside a root
  - a hidden panel that stays out of the baseline
  - a shadow clock with no structure change, which must not pass
  - a component inserted carrying a root
  - a nested root, added and then changed
  - a root attached with no mutation
  - a closed root, which is still not seen
  - a ripple inside the link's own root
  - a light-DOM panel, which is unchanged
  - a `display: contents` wrapper
- `apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-in-place.spec.ts`
  (new, 4 rows, on basic-form). Rows:
  - a flyout inside an open root passes
  - a component inserted after 150 ms passes
  - `attachShadow` after 150 ms passes
  - a closed-root panel still fails `output_not_observed`

## Commands run and observed results

- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` (in
  `apps/extension`):
  - First run: both exited 2 with a single error at
    `src/content/extraction/order-rows.ts(37,10)`: no export
    `webAutomationExtractConditionNumber`. That file belongs to another
    worker's in-flight change and is outside my scope.
  - Final run: `main exit=0`, `test exit=0`.
- The new test was bundled alone with esbuild, following
  `scripts/test-extension.mjs`, into `.test-build-scratch/t173g-worker`
  (since removed) and run with `node --test`:
  `# tests 10 # pass 10 # fail 0` (run twice).
- The same test run against the HEAD `in-place-effect.ts` (from `git show`)
  gave `# pass 4 # fail 6`.
  - Rows 1, 4, 5, 6 and 10 (the shadow cases) fail as intended.
  - Row 9 fails there only because the fake has no `Element.contains`, which
    the old code called.
- `actions/tests/click.test.ts` was run alone and **fails at load**:
  `ReferenceError: window is not defined` at `content/frame-geometry.ts:16`,
  reached from `frame-geometry.ts:10` through the action-runtime barrel. It
  fails the same way when the HEAD `in-place-effect.ts` is substituted in, so
  the failure predates this change and is not caused by it.
- `node scripts/structure-audit.mjs` reported one failure, `[working-docs]
  docs/working/README.md is out of date`, which is not mine. The only warning
  involving my files is advisory: `action-runtime/` now has 24 source files
  (threshold 15).

## Not verified

- The content spec, and any real-browser behaviour, are unverified because
  chromium-1161 is incomplete. In particular I have not checked:
  - that Chrome delivers records from observers attached to shadow roots, as
    the fake does;
  - how Chrome's `body.innerText` treats shadow content.
- The fix has not been tried on the live bigbox "Change store" page.
- The full extension unit suite (`pnpm --filter ... test`) was not run, per
  the brief.
- Performance of the 500 ms rescan on very large pages has not been measured.
  Each walk is bounded by `composedRoots`' 50,000-element and 500-root limits.

## Open questions or contradictions found

- **`click.test.ts` does not load under Node.** `frame-geometry.ts:10` calls
  `isTopFrame()` (`window.top`) at module load. If the full runner imports
  every bundle, this probably fails `pnpm test` for the extension today.
  Someone should confirm this and give it an owner.
- **Late upgrades can pass a dead link.** A page whose components upgrade
  late and draw text during the window can now make a dead link read as
  answered. This is the same known limitation as a live feed, and it is
  recorded in the header.
- **`isShadowRoot` is not in the `shadow-dom` barrel.** I used a
  `root !== document` guard instead of editing a module I do not own.
