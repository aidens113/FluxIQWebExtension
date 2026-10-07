# t289-J: large-page capture back to linear

## Outcome

Done. The three O(siblings)-per-element paths named in `i-content-specs.md` §2 now cost O(1) per element inside a capture. A bare capture of the 6,000-link page took **30.9 s and 41.8 s** before the change and **2.1 s and 2.3 s** after it, with two captures on the same page each time. `large-page-resolution.spec.ts:94` passes in 9.0 s, where it had been timing out at 42 s against its 30 s budget. Capture output is byte-identical before and after on seven pages. The only difference in the files is the test server's port.

## What changed and why

- **New `apps/extension/src/content/selector/sibling-position.ts`** exports `siblingPosition(element, parent, grouping)`, which returns `{ index, shared }`.
  - Inside `withSelectorMemo`, the first question about a parent indexes all of `parent.children` in one pass. The table is kept per parent and per grouping in a new `SelectorMemo.siblingPositions` field. Every later question is a lookup.
  - Outside a scope it does one walk over `parent.children`, so nothing is kept between actions.
  - There are two groupings, matching what each path counted before. `"tag-name"` (xpath) groups by `tagName`. `"local-name"` (`:nth-of-type`) groups by `localName` plus `namespaceURI`.
  - It is exported from the `selector/` barrel.
- **`element-finder.ts` `xpathFor`**: the per-element spread and filter of `parentElement.children` is replaced by `siblingPosition(current, current.parentElement, "tag-name").index`. With no parent element the index is still 1.
- **`selector/unique-selector.ts` `position`**: the walks over previous and next siblings, and `sameType`, are replaced by `siblingPosition(element, element.parentNode ?? null, "local-name")`. It uses `parentNode`, so the top-level children of a shadow root still count the shadow root's children, as `previousElementSibling` did.
- **`selector/selector-memo.ts`**: adds the `siblingPositions` field. The header no longer says "up to 2,000 elements", which stopped being true at t200.
- **`evidence/lead-statements.ts` `isLeadStatement`**:
  - It now checks `belongsToMainRegion` before the parent's words. That answers at once for every control, every record and everything outside `main`.
  - Both "own words" questions go through `hasOwnWords`, which is memoised per capture in a `WeakMap<SelectorMemo, Map<Element, boolean>>`. A parent is therefore read once, however many children ask.
  - Every condition is a pure test combined with AND, so changing their order cannot change the result.
- **`sensitive-text.ts` `ownText`**: a single indexed loop over `childNodes` replaces spread, filter and map. The output is the same; the copies are gone.
- **Tests:**
  - New `selector/tests/sibling-position.test.ts` (7 rows). It checks every element against verbatim copies of the old xpath and `:nth-of-type` algorithms, both outside and inside a scope. The cases are a wide flat list of 3,000 elements, a nested list of rows, the top of a shadow root (300 children plus a nested block), and an HTML `a` beside an SVG `a`, `A` and `foreignObject`. It also covers an element with no parent. The last two rows pin that a parent's children are read once per grouping per capture, and that nothing is kept from one capture to the next.
  - `tests/element-finder.test.ts`, one row: on a 1,500-element list and a nested table, the xpath is the same inside a capture as outside it, with exact values checked.
  - `evidence/tests/lead-statements.test.ts`, two rows:
    - Marks are the same inside and outside a capture, on the store's empty-results page and on a 500-line `main` with a parent that has words of its own.
    - A parent's child nodes are read as often for 400 lines as for 2.
  - `describe-element.test.ts` was not touched.

## Commands run and observed results

- **Before and after comparison.** I used a scratch spec, `e2e/content/tests/t289j-capture-equivalence.spec.ts`, which is now deleted. It ran on the unchanged code first, then on the changed code, with `node scripts/test-content.mjs --workers=1 t289j-capture` from `apps/extension`. The JSON outputs are in the scratchpad under `t289j/before-*.json` and `t289j/after-*.json`.
  - Bare `harness.capture()` round trip, in ms:

    | Page | Before | After |
    | --- | --- | --- |
    | wide-links-6000 (identity-drift, 6,000 `<a>` in one `<nav>`) | 30917, 41779 | 2111, 2269 |
    | mixed-main (everything-store plus 800 text siblings in `main`, nested lists, SVG, an open shadow root with 300 children) | 2167 | 606 |
    | job-board | 70 | 63 |
    | everything-store | 147 | 85 |
    | product-catalog | 115 | 77 |
    | data-table | 97 | 57 |
    | basic-form | 41 | 25 |

  - With `127.0.0.1:<port>` normalised, all 7 snapshot JSONs were **byte-identical** under `cmp`. The comparison covered 6,030 + 1,592 + 45 + 120 + 95 + 81 + 14 xpaths, the matching selectors, and 806 lead statements on mixed-main. It included shadow-root `button:nth-of-type(n)` and `/button[1]`, and `svg > a:nth-of-type(1)`.
- `node scripts/test-content.mjs --workers=2 identity-ambiguity identity-signals identity-veto identity-wire-chain identity.spec large-page-resolution resolve-target.spec shadow-roots` gave **60 passed (1.4m)**, rc=0. Two of those rows are `large-page-resolution.spec.ts:94` at 9.0 s and `:66` at 2.6 s. The brief's baseline was 59 passed and 1 failed. The one extra pass is :94.
- Unit tests: I ran `run-subset.mjs ... t289-j` over `src/content/tests/*.test.ts`, `src/content/selector/tests/*.test.ts` and `src/content/evidence/tests/lead-statements.test.ts`, 16 files. `node --test` on the bundles gave **tests 95, pass 95, fail 0**. `selector/shadow/` has no `tests/` directory.
- Fail-first for the new read-once row: I temporarily put back the old `isLeadStatement` body. The row then failed with `expected: 5, actual: 403`. The file was restored from a copy afterwards.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` printed "core-build: ... is current with its source" and then the build-cache `extension:check` step, rc=0.
- `node scripts/structure-audit.mjs` from D printed "structure-audit: passed (174 warning(s), 118 baselined)". No finding names any file I touched.

## Not verified

- **Lab and live runs:** not run, as the brief requires. I did not test a real large site, only the injected 6,000-link fixture and the scenario pages above.
- **Other O(n²) paths:** I did not profile again after the fix. 2.1 s for 6,000 links is in line with the 2026-09-12 figure of about 4 s for 5,000 elements, but there may be smaller super-linear costs I did not look for.
- **Firefox:** the byte-identical check ran only on the harness's Chromium build.

## Open questions or contradictions found

- The `SelectorMemo` scope now also carries the lead-statement memo, held in a `WeakMap` keyed by the memo. In practice it is the capture-scoped memo, but its name still says "selector". Renaming it would touch `dom-snapshot.ts`, which I do not own.
- The tree had other workers' uncommitted changes when I started: `background/connection/*`, `shadow-root-controls.spec.ts`, `packages/test-contracts/**`, `packages/test-runner/**` and docs. I left them alone. The content-spec run above includes the modified `shadow-root-controls.spec.ts`.
- `.test-build-scratch/t289-j/` holds the unit bundles. It is git-ignored.
