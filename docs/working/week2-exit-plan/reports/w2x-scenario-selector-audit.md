# w2x-scenario-selector-audit (task t058)

Worktree `F:\fxwork\t058-bigbox-selectors`, branch `task/t058-bigbox-selectors`, shared read-only Core.
All changes are uncommitted.

## Outcome

**Partial.** Every selector the extension executes from the ten realistic sites' recorded workflows
is now valid native CSS. On every page, each one picks exactly the same items and field elements
that the old Playwright selector picked. That was checked element by element in Chromium, and the
extension then ran each rewritten extract step live. Four of the five rewritten extract steps
matched their expected records exactly inside the extension:

| Extract step | Records matched |
| --- | --- |
| `pickup-order` | 1 of 1 |
| `gas-engineers` | 8 of 8 |
| `business-prices` | 12 of 12 |
| `book-service` | 1 of 1 |

The fifth, `pickup-towels`, now executes: it read page 1 and followed Next. It then fails for a
product reason. Next is a full page load, and `web.dom.extract_list` pagination cannot survive a
navigation.

It is Partial for three reasons:

- **Oracle unmet on `pickup-towels`.** The extension cannot run this extraction to its oracle
  without a product change.
- **Pinned conditions.** Three filter conditions cannot be written in CSS at all. They are now
  pinned by item id or grid position (see the first open question).
- **One test left red.** The rewrite breaks one bigbox naive-path test, which string-replaces the
  old selector. That test is outside my ownership; the fix is one line, given and verified below.

## What changed and why

### How the extension reaches a manifest selector

Traced in source:

- **Extract steps.** `packages/test-runner/src/scenario-steps/extract-intent.ts` sends the item
  selector, the field selectors and the pagination selectors verbatim to the extension
  (`fluxiq.test.defineExtraction` then `web.dom.extract_list`). The extension then runs:
  - `document.querySelectorAll(item)` in `content/extraction/list-reader.ts`;
  - `item.querySelector(field)` in `field-reader.ts`;
  - `document.querySelector(next)` and `querySelectorAll(pages)` in `pagination.ts`.
- **The Core action probe.** It types, with `web.dom.type`, into the first `type` step whose CSS
  target is on the start page (`lane-rules/probe-step.ts`).
- **Every other step** (click, waitForState and the rest) is performed by Playwright in
  `scenario-steps/step-runner.ts`.
- **A Flow built from the recording** replays the recorder's own captured selectors, not the
  manifest's.

So the Playwright-only syntax that the click and waitForState steps use in auction-marketplace,
everything-store `purchase.ts`, photo-social and elsewhere is legitimately Playwright-only, and it
is left alone.

### Audit coverage

- **Syntax check.** 156 extension-bound selectors: 22 extract steps plus every `type` target,
  across 32 workflows. Each was checked with Chromium `querySelectorAll`.
  - Before: 17 invalid, all in 5 extract steps.
  - After: 0 invalid. 130 are CSS; the other 26 are 10 `role:` and 13 `frame:` type targets
    (which the probe skips), 2 `column:` fields and 1 self field.
- **Element identity.** For every extract step on every page, the Playwright-engine pick of the
  old selector was compared with the native pick of the current one. The comparison covered each
  item and each field.
- **Full sweep.** All 32 workflows were driven end to end with the Lab's own `ScenarioStepRunner`.

### Extension-executed selectors rewritten

**bigbox-retail `manifest/pickup-towels-workflow.ts`, `extract-pickup-towels`**

- **Not an ad:** the tile does not open with a `div`, since an ad's first child is its
  "Sponsored" label.
- **Rated 4.5 or better:** the stars bar's `style="--pct:90%"` to `100%`. The bar width is the
  rating times twenty, and every catalog rating has one decimal.
- **Pickup today:** there is no CSS equivalent. "Pickup tomorrow" tiles differ only in their words,
  so the two such listings are excluded by `data-item-id`:
  - `433201876`, Softerra Pick-A-Sheet 8 Triple Rolls;
  - `470665371`, Northmere 12 Rolls.
- **Fields:**
  - `price` is `span:has(+ span > sup)`;
  - `unitPrice` is `div:has(> span > sup) > div`;
  - `rating` is `span:has(+ span[style])`.
- The item root is still `div[data-item-id]`, so the `list-layout` variant (whose rows are
  `li[data-item-id]`) still reads nothing, as before.

**bigbox-retail `manifest/pickup-order-workflow.ts`, `extract-order`**

- **Item:** `section:has(> h1)`.
- **Fields:**
  - `order` is `h1 + p > span`;
  - `quantity` is `li > span > span:last-child`;
  - `pickup` is `h2 ~ p > span`.

**company-website `manifest.ts`, `gas-engineers`**

- **Item:** the eight cards, named by their place in the "Our people" grid
  (`article:nth-of-type(n)`). The places are computed from `TEAM` by card id. CSS cannot read a
  card's branch or its Gas Safe value.
- **Fields:**
  - `branch` is `dl > div:first-child > dd`, since the Branch row is always first;
  - `gasSafeId` is `dl > div:last-child > dd`. On all eight cards the Gas Safe row is the last one,
    including Stefan Novak's, where it follows his F-Gas row.

**company-website `manifest.ts`, `business-prices`**

- **Item:** `section[data-category="servicing"|"repairs"] tbody tr:not(:has(span))`. An advert is
  the only row that holds a `span`.

**company-website `manifest.ts`, `book-service`**

- **Fields:** `dt:nth-of-type(k) + dd`, using the confirmation's fixed label order.

### Lab-driving selectors fixed

These steps are run by Playwright, not the extension, but they are in owned files. The Lab's step
runner is strict, and these targets matched many elements, so the recording lanes failed with
"strict mode violation" before reaching extraction.

**everything-store**

- `workflows/first-page.ts`, step `first-results`: matched 15 elements.
- `workflows/plus-under-fifty.ts`, step `sweep-results`: matched 15 elements.
- Both now use `[data-index="1"]`, the pattern the same files already use. Ads carry
  `data-index="0"`.

**professional-network `manifest.ts`**

- Steps `second-degree-shown` and `rotterdam-shown` matched 10 elements.
- Both now wait for `section[aria-label="Search results"] ul[role="list"]:has(> <organic result>)`.

These two sets of fixes are outside the brief's "extension engine" class. The supervisor may keep
or revert them independently.

No page, oracle, task, extension or domain file was touched.

## Commands run and observed results

### Syntax and equivalence probes

Scratch scripts, using Chromium via Playwright 1.51.1:

- **Syntax check**
  - Before the change: `{"valid":113,"INVALID":17,...}`.
  - After the change: `{"valid":130,"role":10,"frame":13,"self":1,"column":2}`.
- **Element identity**
  - Changed steps: `pickup-towels` pages `8=8,1=1`, `pickup-order` `1=1`, `gas-engineers` `8=8`,
    `business-prices` `12=12`, `booking` `1=1`, all "same elements".
  - Every other extract step: same elements. `professional-network` numbered pagination was
    compared on the first page only, and job-board `extract-application` was skipped (it has a
    frame target).
- **Sweep:** all 32 workflows `ok` after the fixes.

### Live recording lanes

Every run used `FLUXIQ_TEST_ENV_FILES=none pnpm lab run <site> --workflow <w> --flow --target
persistent-isolated --workspace t058-<site>`, sequentially, with LLM mode `disabled` and 0 calls.

| Run | Workflow | Recording-lane extract | Run ended |
| --- | --- | --- | --- |
| `run-mubrnwgm-ad7a11c4` | bigbox `pickup-towels` | Executed: page 1 read, Next followed to page 2 (failure screenshot shows "13–13 of 13 results") | `runtime.behavior` "(run_failed) A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received": the content script died on the full-page navigation. No records returned (0 of 9 judged) |
| `run-mubrrjc5-1af8e3c1` | bigbox `pickup-order` | `recordCount` 1, 1 of 1 matched (`assertExtraction` passed) | `recording.persistence`: "Core was still writing the run's recording after 90000 ms" (lane B finding 1) |
| `run-mubrw2bw-063f5dc0` | company `gas-engineers` | 8, 8 of 8 matched | The Flow was built; its first click failed `target_ambiguous`: "one element matching selector div:nth-of-type(2) > div" had 7 matches (the recorder's capture of the chat greeting's Close); Flow extract `not_run` |
| `run-mubrz09i-98f0f170` | company `business-prices` | 12, 12 of 12 matched | Same Flow first-click `target_ambiguous` |
| `run-mubs1yzb-9e1eda44` | company `book-service` | 1, 1 of 1 matched | Same Flow first-click `target_ambiguous` |
| `run-mubs6gxo-df2f6b49` | everything-store `first-page-earbuds` | Not reached | Step 1 `accept-cookies`: the notifications dialog intercepts pointer events |
| `run-mubs8820-e3fb3376` | everything-store `plus-under-fifty` | Not reached | Same as `first-page-earbuds` |
| `run-mubsao98-9d32535e` | professional-network `people-search` | Both fixed waits completed; 10 records, expected 23 | Numbered pagination ended on the skeleton that replaces the list between pages |

### Scenario-lab suite

`pnpm --filter @fluxiq-web-extension/scenario-lab test` gave `# tests 570`, `# pass 561`,
`# fail 9`. The failing entries:

- the bigbox naive test, which my change breaks;
- auction-marketplace: the bid honest path, where `#hal-greeting` intercepts the click;
- crossborder-marketplace: 5 tests failing with "No tab opened";
- professional-network: "paging faster than a person reads".

Reruns in isolation:

- The auction-marketplace, professional-network and bigbox browser files: 34 tests, 33 pass. The
  only failure is the bigbox naive test.
- The crossborder-marketplace browser file: 12 of 12 pass.

The other failures are load-timing flakes in files I did not touch.

### Repository check

`pnpm check` exited 0. `structure-audit: passed (84 warning(s), 122 baselined)`, and none of the
warnings names a changed file.

### Proposed naive-test fix

I verified the one-line fix by running the naive test's body with it: "naive read 14 records,
4 repeated: the test body passes".

## Not verified

- **Flow-lane replay.** No changed extraction was replayed by a Flow: every Flow stopped earlier
  (`target_ambiguous`, a Core finalization stall, or failing before recording).
- **Variants.** None were run. Only the base renderings were compared.
- **Later numbered pages.** Pages 2 and 3 of `people-search` were not compared between engines.
- **Firefox.** Not exercised.
- **Leftover run state.** The Lab workspaces `t058-bigbox`, `t058-company`, `t058-everything` and
  `t058-network`, and the `test-runs/` bundles, remain in the worktree.

## Open questions or contradictions found

1. **Some conditions cannot be written in CSS.** The brief's "a selector that picks exactly the
   same elements" can only be met by pinning in three places:
   - bigbox "Pickup today" versus "Pickup tomorrow";
   - the company card's branch;
   - the company card's "Gas Safe number" versus "pending" or "Required".

   CSS cannot read text, and the pages carry no attribute for these. The recorded extractions now
   list what was read rather than state the filter. Stating the filter needs a text predicate in
   `extract_list` (product) or a model-authored Flow. Site difficulty is unchanged, but the
   supervisor should accept or reject the pins.
2. **Test outside my ownership.** `apps/scenario-lab/src/scenarios/bigbox-retail/tests/browser-paths.test.ts:105`
   must change `.replace(":not(:has-text(\"Sponsored\"))", "")` to
   `.replace(":not(:has(> div:first-child))", "")`.
3. **job-board `apply-remote-rust-role` `extract-application`.** Its item is
   `frame:Talentloom job application/dl`. The seam refuses frame targets (`fixture.invalid`),
   because the definition lane is top-frame only (`domain/src/actions/extraction/request.ts`).
   No selector rewrite can fix it.
4. **Product gaps shown by these runs:**
   - `extract_list` next pagination across a full navigation loses the read (bigbox);
   - numbered pagination treats a loading skeleton as the next page (professional-network);
   - on company-website the recorder captures the chat-greeting Close as an ambiguous
     `div:nth-of-type(2) > div`;
   - Core recording finalization stalls past 90 s under load.
5. **everything-store recording lanes cannot pass their first step in the Lab.** The Core probe
   delays `accept-cookies` past the 4-second notifications dialog, which then covers the cookie
   banner. This is step order and timing, not a selector, so I left it unchanged. It is likely also
   what failed lane B's `run-mubq6293`.
