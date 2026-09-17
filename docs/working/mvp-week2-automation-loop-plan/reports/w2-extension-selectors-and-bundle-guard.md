# w2-extension-selectors-and-bundle-guard: one selector per element, and a check that catches Node code in the browser bundle

Worker report, 2026-09-16. This repository only. The only `domain/**` edit was
the probe import, which is reverted: the file is byte-identical and git shows
it clean. No live provider call was made, and the demo workspace was not
started.

## Outcome

Done, both parts.

1. **Every element a snapshot describes now has a selector that matches that
   element and nothing else.** On the catalog, the eight product links used to
   share `[data-testid="product-link"]`. Each now reads, for example:
   `[data-testid="product-list"] > li[data-testid="product-card"]:nth-of-type(5) [data-testid="product-link"]`.
   Measured on the real content bundle:

   | Page | Described | Clickable | Selector matches exactly the described element | Duplicate selectors before |
   | --- | --- | --- | --- | --- |
   | product-catalog | 94 | 17 | 94 | 6 test ids, each shared by 8 elements |
   | data-table | 80 | 4 | 80 | 12 rows sharing `[data-testid="inventory-row"]` |
   | member-directory | 2000 (the cap) | 513 | 2000 | none (the old 5-step paths happened to be unique here) |

2. **`pnpm check` now fails when browser-bundled code reaches a Node-only
   module.** The extension's `check` bundles all five browser entries in memory
   with the real build settings, and a new bundler guard names the module and
   the import chain that reached it. I reintroduced this morning's exact import
   (`parseAutomationStudioRecordOutput` from `fluxiq/automation-studio` in
   `domain/src/output-nodes/extract-list/dispatch.ts`). `apps/extension check`
   then failed on four bundles, one error each, naming `node:crypto` or
   `node:perf_hooks` and the chain through `dispatch.ts`. The import was then
   reverted.

## What changed and why

### Part 1: selector generation (`apps/extension/src/content/selector/`, new)

- **`unique-selector.ts`** exports `selectorFor`, which moved out of
  `describe-element.ts`. It tries these forms, strongest first:
  1. **The element's own anchor**, if it matches only this element in the
     page. The anchors are its id, its test id (`data-testid`, `data-test`,
     `data-cy`) and its `name`. A control that was unique before keeps exactly
     the selector it had (`#invite-dialog`, `[data-testid="save"]`,
     `input[name="q"]`). Every existing exact-selector assertion in the specs
     still passes.
  2. **A scoped anchor**, for an anchor that repeats. Find the largest ancestor
     that contains no other match, then write that ancestor's selector, a
     space, and the anchor. For a product link, that ancestor is the card.
  3. **One step down from the parent**: the parent's selector, `>`, then this
     element's tag, its first anchor as a qualifier, and `:nth-of-type(n)` when
     it has siblings of the same type.
     - Example: `[data-testid="inventory-body"] > tr[data-testid="inventory-row"]:nth-of-type(1) > td:nth-of-type(1)`.
     - The climb stops at a unique ancestor, at a `body` or `main` the document
       holds only once, or at `:root`.
  - **Why the result is unique:** forms 2 and 3 are unique whenever the
    ancestor's selector is, and the same rules make it so. Form 1 is checked
    against the page, because ids can repeat.
  - **Detached elements** (for example, a control a click removed before it
    was described) cannot be checked against a page. They get their first
    anchor or a 5-step path, which is what every element got before.
  - **Shadow DOM** is handled best effort, within the element's own shadow
    tree.
- **`element-anchors.ts`** is the one list of identifiers a selector may quote.
  - It never reads text, a value, a placeholder, a label, a title, alt text or
    an href. Every anchor it reads is already on the descriptor's `attributes`,
    so a selector reveals nothing from a sensitive region that the descriptor
    does not already carry.
  - It reads the id with `getAttribute("id")`, not the `id` property. A
    `<form>` holding `<input name="id">` answers `form.id` with that input.
    The old code would have written `#[object HTMLInputElement]`.
  - **Behaviour change:** `data-test` and `data-cy` now count as anchors.
    Before, only `data-testid` did.
  - **Small fix:** the old `cssString` escaped quotes twice (`CSS.escape`
    already escapes them). The new module calls `CSS.escape` alone.
- **`selector-memo.ts`** (`withSelectorMemo`) lets one capture reuse the work
  its selectors share: each ancestor's selector, and whether each anchor is
  unique page-wide.
  - `captureSnapshot` in `dom-snapshot.ts` wraps its synchronous, read-only
    capture in the memo, and nothing else uses it.
  - Outside a snapshot nothing is cached, so an action's descriptor always
    reflects the page as it is at that moment. A click handler can rewrite the
    page within the same task, which is why a time-based cache was rejected.
- **`index.ts`**: the directory's barrel.
- **Callers now import from `../selector`:** `describe-element.ts`,
  `evidence/{dialogs,forms,loading,overlays,regions,repeating}.ts`,
  `extraction/{detect-pagination,infer-list}.ts`, `picker/session.ts`.
  - This also sharpens container selectors in list inference and pagination:
    a container's selector is now always unique.
  - `describe-element.ts` lost `selectorFor` and `cssString`, dropping from 10
    exported values to 9.
- **`extraction/detect-structure.ts`**: comment only. It no longer claims that
  snapshot selectors are not unique. Its rule that several matches are
  accepted when they all sit in one run still holds for selectors written by
  hand.
- **`content/tests/landmark-role.test.ts`**: its stub element now also answers
  the three things the selector reads. The id is now an attribute (as a
  browser reflects it), the element reports `isConnected`/`getRootNode`, and
  the stub document answers `#id` queries.
  - Without this, two rows failed, because the stub held the id only as a
    property.
  - The test's stated rule is that the stub answers exactly what the call
    sites read, so the stub was extended rather than the selector weakened.
- **Tests:**
  - New unit tests:
    - `selector/tests/element-anchors.test.ts`, 3 rows: anchor order, escaping,
      and that no text or value is ever used.
    - `selector/tests/selector-memo.test.ts`, 3 rows: nothing is cached outside
      a scope, nested scopes join the outer one, and a scope ends even when the
      capture throws.
  - New content-harness spec `e2e/content/tests/unique-selectors.spec.ts`,
    8 rows:
    - the three list pages;
    - the catalog's product links, each with its own selector that still names
      the link by its test id and resolves to that link's own href;
    - unique anchors keep their short form;
    - duplicate ids and repeated test ids with no unique container;
    - a sensitive-looking row, whose secret never appears in any selector or in
      the evidence;
    - a large page (the directory plus 1,200 unanchored links).
  - **How the spec proves "that element":** it uses two independent signals,
    not only a match count:
    - the descriptor's xpath (read as intended, see open question 1);
    - the element's page geometry.

    Every described element had to pass at least one of these checks.
  - Before the fix, 6 of these 8 rows failed. Member-directory and the large
    page already passed, because the old 5-step paths happened to be unique
    there.

### Part 2: the bundle guard (`apps/extension/scripts/`)

- **`build-extension.mjs`:**
  - `bundleExtensionEntry` takes `write` (default `true`) and runs a new
    `nodeOnlyImportGuardPlugin` first, ahead of the workspace alias plugin.
  - `EXTENSION_ENTRY_NAMES` is exported for the check to use.
  - How the guard works:
    - It resolves each import a second time, to record which file first
      imported each resolved file.
    - When an import cannot be resolved and names a Node built-in (bare or
      `node:`), it fails with the built-in's name, the chain from the entry
      file down to it, and how to fix it.
    - A package whose `browser` field stubs a built-in out still bundles as
      before, because only imports that fail to resolve are refused.
    - It refuses once per point where the chain leaves this repository.
      Further built-ins behind the same import are marked external, and the
      build has already failed.
  - Why once per crossing: the first probe printed 444 errors (about 9,300
    lines), one for every built-in inside Core's barrel. The deduplicated
    probe printed 4 errors in about 100 lines.
  - The guard runs in the real build and the content harness too, since both
    go through `bundleExtensionEntry`. After the change, a rebuild left the
    background, popup and sidepanel bundles byte-identical.
- **`check-extension.mjs`:** after the two `tsc` projects, it bundles every
  entry with `write: false` at log level `error`. It prints
  `extension check: the browser bundle "<name>" does not build.` for each
  failure and exits 1 if any fails. Nothing is written to disk: no
  `.bundle-check/` directory is created, and `build/` is unchanged.
- **`apps/extension/package.json`** did not need changing: `check` already
  runs `node scripts/check-extension.mjs`.

### Regenerated

- `apps/extension/build/content/index.js` and `index.js.map` were regenerated
  by `pnpm --filter @fluxiq-web-extension/extension build`. Only the content
  bundle changed.

## Commands run and observed results

- **Baseline** (the new spec on the old code),
  `pnpm test:content -- unique-selectors --workers=2`: `6 failed`, `2 passed`.
  - Duplicates listed: 6 catalog test ids at `8x` each, and
    `12x [data-testid="inventory-row"]`.
- **After the fix**, same command: `8 passed (7.4s)`. The JSON reporter
  annotations give the table above, plus
  `large page: 2000 described, capture 1975 ms`.
- **Timing**: 5 captures each on member-directory, from a scratch spec that has
  since been deleted.
  - New code: `grid=0 ms=1278,1157,1162,1101,1361` and
    `grid=1200 ms=2313,1868,1705,1682,1738`.
  - Old algorithm swapped in temporarily (restored, `cmp` identical):
    `grid=0 ms=1342,1211,1183,1269,1288` and
    `grid=1200 ms=1964,1820,1881,2395,1949`.
  - No measurable change. The snapshot's cost lies elsewhere. These are single
    runs on this machine.
- **Extension unit tests**,
  `EXTENSION_TEST_BUILD_LABEL=w2sel pnpm test` in `apps/extension`:
  - First run: `# tests 643`, `# pass 641`, `# fail 2` (the `landmark-role`
    rows above).
  - After the stub fix: `# pass 643`.
  - After adding the new unit tests: `Extension smoke test passed.`,
    `# tests 649`, `# pass 649`, `# fail 0`.
- **Full content harness**, `pnpm test:content -- --workers=2 --reporter=line`:
  `287 passed (1.2m)`, exit 0 (279 before, plus my 8).
  - This includes `identity-resolution.spec.ts`, `resolve-target.spec.ts`,
    `identity-veto.spec.ts` (whose `button:nth-of-type(1)` assertion still
    holds), `large-page-resolution.spec.ts` and the extraction specs.
  - After the final comment edit and rebuild,
    `pnpm test:content -- unique-selectors structure-detection` gave
    `16 passed`.
- **Domain tests**,
  `DOMAIN_TEST_BUILD_LABEL=w2sel node scripts/test-domain.mjs`:
  `# tests 576`, `# pass 576`, `# fail 0`, exit 0. The tracked
  `domain/.test-build` was untouched. No domain source changed.
- **Extension check**, `node scripts/check-extension.mjs`: exit 0, including
  after the final rebuild. It took about 8.5 s against about 7.8 s before the
  bundle step (one observation each).
- **Probe 1**, through root `pnpm check`, with the first version of the guard:
  exit 1.
  - The audit passed, and every package before the extension was `Done`.
  - Then `apps/extension check: X [ERROR] Node-only module "node:crypto" is reachable from the browser bundle "background"`,
    with the chain
    `apps/extension/src/background/index.ts -> .../extraction/confirm.ts -> domain/src/client/index.ts -> domain/src/output-nodes/index.ts -> .../extract-list/index.ts -> domain/src/output-nodes/extract-list/dispatch.ts -> ../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/index.js -> .../dsl/source.js -> node:crypto`.
  - `does not build` was printed for background, content, popup and
    sidepanel, followed by
    `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL ... extension ... check`.
  - This run printed 444 guard errors, which led to the one-refusal-per-crossing
    change.
- **Probe 2**, through root `pnpm check`: exit 1, but it stopped **before**
  the extension step.
  - `structure-audit: 2 violation(s)`: `packages/test-runner/src/demo-workspace/: 27 source files`
    and `scripts/: 33 source files`.
  - Both come from other workers' concurrent files, not mine.
- **Probe 3**, through `pnpm -r check` (the step root `check` runs next), with
  the final guard: exit 1.
  - `apps/extension check` failed with 4 errors, one per bundle:
    - background: `node:perf_hooks`, via `.../testing/scale-graph-store.js`;
    - content: `node:crypto`, with chain
      `content/index.ts -> dom-events.ts -> element-traits.ts -> shared/sensitive-field.ts -> domain/src/client/index.ts -> ... -> dispatch.ts -> ...`;
    - popup: `node:crypto`;
    - sidepanel: `node:crypto`.
  - Each error ended with the fix text and
    `Other Node-only modules reached through the same import are not listed again.`
  - The whole log was 100 lines.
  - After each probe, the file was restored from its backup:
    `cmp` reported `restored-identical`, and
    `git status --short -- domain/src/output-nodes/extract-list/dispatch.ts`
    printed nothing.
- **Extension build**, `pnpm --filter @fluxiq-web-extension/extension build`:
  exit 0, twice. `git status` shows only
  `apps/extension/build/content/index.js` and `index.js.map` modified.
- **Structure audit**, `node scripts/structure-audit.mjs` (last run): exit 0,
  `structure-audit: passed (59 warning(s), 17 baselined).`
  - This matches the count before my change.
  - The only warning on a file I touched is
    `describe-element.ts: 9 exported values`, which was 10 before.
- **Root `pnpm check`**, three runs:
  - Before any probe: exit 0. `structure-audit: passed`, and every package was
    `Done`, including `apps/extension check` with the bundle step.
  - Final run: **exit 2.**
    - The structure audit passed and `apps/extension check: Done`.
    - The only failure was `packages/test-runner check: Failed`, from
      `src/flow-lane/repair/declared-repair.ts(128,9): error TS2375`
      (`variants: ScenarioVariant[] | undefined` under
      `exactOptionalPropertyTypes`).
    - That directory is untracked (`?? packages/test-runner/src/flow-lane/repair/`):
      another worker's in-progress file, not mine.
  - `pnpm -r check`, run separately, showed the same result: every package
    `Done` except that test-runner file.

## Not verified

- **No browser beyond the Playwright content harness was exercised.** The
  harness runs the real content bundle on real Lab pages in headless Chromium,
  with no extension loaded, no background worker and no gateway. Not
  exercised:
  - an unpacked extension in Chrome, Edge or Firefox;
  - recording and replaying a Flow end to end with the new selectors;
  - a live DeepSeek plan resolving a handle on a repeated card. The domain
    resolver's `not_unique` refusal should now simply not trigger on the
    catalog, but nothing called `resolvePlanNodeParameters` against a new
    capture.
- **Firefox**: the selector code uses only standard DOM, but it was not run
  there.
- **Shadow DOM and iframes**: shadow-tree selectors are best effort and have no
  test. Child frames use the same code in their own document, and no
  frame-specific selector row was added.
- **Real sites**: only Lab pages and injected markup were measured. Pages with
  generated ids (`:r1:`) still get `#:r1:`-style selectors, which are unique
  but may not survive a reload. That is unchanged from before.
- **Replay after a list reorders**:
  - A recording of a repeated card now carries a positional selector, which
    after a reorder names a different card. Before, it carried the shared test
    id, which matched all of them.
  - The identity veto and scoring are designed to catch this, and
    `identity-veto.spec.ts` proves it for a reordered button pair. There is no
    card-list-specific replay row.
  - Recordings saved before this change keep their old selectors; nothing
    migrates them.
- **Checked-in captures in `domain/`** (`page-evidence/capture.ts` and
  `llm-evidence/structure/tests/captured-detections.ts`) were not
  regenerated, because `domain/**` was off limits. Their data shape is
  unchanged. A repeating structure's `representative.selector` would now be
  per-item if re-captured.
- **The guard's scope:**
  - It covers the five extension entries only.
  - A dynamic `import()` whose path is not a string literal is invisible to
    it, as it is to esbuild.
  - A Node-only *global* (`process`, `Buffer`) used without an import is not a
    resolution failure, so it is not caught.
- **Docs:** `docs/architecture/` was not updated (the brief barred it). It
  should record the selector rule (`selector/`) and the new bundle step in
  `check`.

## Open questions or contradictions found

1. **`xpathFor` is broken for any element with an id on itself or an
   ancestor** (`apps/extension/src/content/element-finder.ts:49-57`).
   - It writes `/*[@id="x"]/...`, which XPath reads as "the root element, if
     its id is x". Those xpaths therefore never resolve, so
     `findClosestFingerprint`'s xpath fallback silently never works for them.
   - The fix is one character (`//*[@id=...]`). I did not make it, because it
     changes which replays the xpath fallback rescues, and that belongs in its
     own brief with the identity specs rerun.
   - My spec reads such xpaths as `//` for verification, and says so.
2. **`apps/extension/e2e/content/tests/extraction/tests/structure-detection.spec.ts`
   is untracked.** It belongs to the earlier `w2-detect-repeating-structure-tool`
   worker, and it ran green here (8 rows). It looks like it was left out of
   commit `d4721b3`.
3. **Root `pnpm check` currently fails only on
   `packages/test-runner/src/flow-lane/repair/declared-repair.ts`** (untracked,
   another worker's). Earlier in the session it also failed at the structure
   audit on other workers' directory counts, which have since cleared.
4. **The domain resolver comment in
   `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`** still
   explains `not_unique` in terms of shared selectors. The refusal remains
   correct as a guard, but with this change it should no longer fire on
   snapshot-derived handles. The structure-detection report's open question 2
   ("targets on repeated cards cannot be addressed yet") is now answered on
   the extension side.
