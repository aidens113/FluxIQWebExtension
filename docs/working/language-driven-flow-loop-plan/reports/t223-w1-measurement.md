# t223-w1: today's LLM page packet, measured on the ten realistic scenarios

Worker report for brief t223-w1. Scratch root below is
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/58ff9269-d8d6-4822-86c8-adf096a6a8a7/scratchpad`
(`<scratch>`).

## Outcome

Done. There are 20 raw snapshots (a start page and a deep page for each of the ten scenarios) and 3 recorded v2 packets kept for calibration. `<scratch>/t223-measure.mjs` measures them and accepts `--view`. Across the 20 pages, today's packet totals **2,174,142 bytes, or about 724,720 estimated tokens**. That is 6,498 elements, of which 3,357 qualify for a compact default view. The largest page is everything-store results at 354,911 B (about 118k tokens), and the auction results page is 315,963 B (about 105k tokens).

No raw snapshot was recorded anywhere, so every raw page is **synthesized**. The method is described under "How the corpus was made". The three recorded packets match the synthesized ones to within about 1.5–4.5% in bytes.

## What changed and why

Nothing in either repository. The only file written in the worktree is this report. Files in scratch:

- `<scratch>/t223-corpus/<scenario>--<start|deep>.json`: 20 raw `web.dom.capture_snapshot` snapshots, with the keys `url`, `title`, `viewport`, `frame`, `interactiveElements`, `evidence` and `focusedElement`.
- `<scratch>/t223-corpus/<scenario>--<page>.recorded.packet.json`: 3 recorded v2 packets in the form `{source, at, packet}`. They are the `entry` values the model saw, taken from decision dumps. These pages also have a synthesized raw file; the packets are only for calibration.
- `<scratch>/t223-corpus/_synthesis-manifest.json`: the URL, status, element counts, script errors and the page's own fetches for each synthesized page.
- `<scratch>/t223-corpus/_measure-baseline.json`: the per-row results of the baseline run.
- `<scratch>/t223-measure.mjs`: the measurement script.
- **Outside the owned list:** `<scratch>/t223-w1-tools/`. This holds the corpus generator (`make-corpus.ts`/`.mjs`, `capture-entry.ts`, `capture-bundle.js`), a scratch `npm install jsdom@25` (no jsdom exists in either repository), and two example view modules used to test `--view`. The folder is needed to regenerate the corpus. It is scratch only and its name is unique to this worker.

## How the corpus was made

**Recordings searched.** I searched `fxwork/*/!FluxIQWebExtension/test-runs/**` and `!FluxIQWebExtension/test-runs/**`. `fxlab` was not walked. The three Lab runs found (`run-mun5e1ie`, `run-mun8tgdh`, `run-muna3yfq`) are all everything-store and contain no snapshots or packets, because they are redacted. Decision dumps exist in t174, t193 and t194 (the one in t195 is empty). They hold **only sanitized v2 packets, never a raw snapshot**:

- t174: crossborder start and search, but with 40 elements each, from before t200. These are stale and were not used.
- t193: bigbox-retail start, 324 elements. Kept as `bigbox-retail--start.recorded.packet.json`.
- t194: everything-store start (124 elements) and results at `s?i=all&field-keywords=&k=wireless+earbuds` (756 elements). Kept as `everything-store--start`/`--deep.recorded.packet.json`.

**Synthesis, for all 20 raw pages.** There was no Lab, no server and no browser:

1. **HTML.** Each scenario's own `createState(seed)` / `render` / `route` was called in-process from `apps/scenario-lab/src/registry.ts`. Mutations were applied as the server applies them, and redirects were followed. The origin is `http://127.0.0.1:57000`. For everything-store deep, the `pass-soft-check` mutation was applied first so that the results page is served instead of the soft check.
2. **DOM.** The HTML was parsed with jsdom 25 using `runScripts: "dangerously"` and `pretendToBeVisual`. jsdom does not run `<script type="module">`, so each inline module script was run as a classic script inside an async IIFE. Without that, results pages never hydrated: everything-store had 291 elements instead of 790. The capture waited 1,500 ms after parse, so hydrate timers of 700 ms ran, but timers of 2 s or more did not (app banners at 2 s, notifications at 4 s).
3. **The page's own fetches.** A GET under `/scenarios/<id>/` was answered by that scenario's `route` with the page's state. Everything else got a 503. This affected four pages:
   - local-classifieds `feed.json` batches 1 and 2, on both pages.
   - social-network-feed `feed/?cursor=0,1`, on the start page.
   - professional-network `search/results/people/fragment`, on the deep page.
   - crossborder-marketplace start: `POST /api/crossborder-marketplace/beacon` got a 503, which was logged as an unhandled rejection. The beacon does not affect markup.

   No page had a jsdom script error.
4. **Capture.** The extension's own `captureSnapshot` (`apps/extension/src/content/dom-snapshot.ts`) was bundled as an IIFE with esbuild and evaluated inside the jsdom window. The result is the content-script snapshot of a single top frame. The background's multi-frame merge was not applied, because none of these pages has a child frame in the HTML that was used.

**Layout assumptions.** jsdom has no layout, so every box comes from this synthetic layout:

- The viewport is 1280x720 with scroll 0 and `devicePixelRatio` 1.
- Every element is stacked in a single column in document order. Inline content is *not* placed on shared lines: each link in a paragraph gets its own 20 px row.
- `x` is indented 8 px per depth level, capped at 400. `width` is `1280 - 2x`, with a minimum of 40.
- A text leaf is 20 px tall for every 120 characters. Replaced and control elements have fixed heights: img 160, input/button/select 32, textarea 80, svg 24, iframe 150, hr 2, and so on.
- A container spans its boxed descendants.
- An element with no text, no boxed descendant and no replaced content gets a 0x0 box, as an empty span does in a browser.
- Elements with `display:none` (jsdom's computed style, which applies `<style>` rules), `[hidden]` or `input[type=hidden]` get no box.

**Stubs.** `Range#getClientRects` returns `[]`. `elementFromPoint` returns `null`, so no element is reported as covered by an overlay: no `blockedBy` or covered evidence from hit-testing. `checkVisibility` is absent, so the capture treats every element as boxed. `CSS.escape` and `structuredClone` were shimmed.

**Effect of the layout.** This layout stretches pages vertically. As a result, **`onViewport` and "qualifying on viewport" are strong underestimates.** The recorded bigbox start page has 106 qualifying elements on the viewport against 29 synthesized, and everything-store deep has 158 against 39. Element counts and bytes are close, because a box costs about the same number of digits either way.

**Calibration (synthesized vs recorded, same pages).**

| page | elements, synth/recorded | bytes, synth/recorded | delta |
| --- | --- | --- | --- |
| everything-store start | 124 / 124 | 31,757 / 32,219 | -1.4% |
| bigbox-retail start | 318 / 324 | 119,516 / 123,146 | -2.9% |
| everything-store results | 790 / 756 | 354,911 / 340,028 | +4.4% (recorded URL carried the honeypot `field-keywords=`; synth is `s?k=wireless+earbuds`) |

## The measurement script

```text
node <scratch>/t223-measure.mjs [--corpus <dir>] [--domain <domain pkg dir>]
     [--sanitizer source|dist] [--view <module>#<export>] [--contributors <n>] [--json <out>]
```

- **Sanitizer.** By default, `sanitizeWebLlmSnapshotWithBindings` is bundled in memory from `domain/src/runtime/llm-evidence/sanitize.ts`, using the domain's own esbuild as `scripts/test-domain.mjs` does. Bare packages such as Core's `fluxiq` stay external and load from their resolved dist files. The bundle is imported from a data: URL. No build step, no heavy command and no file is written. `--sanitizer dist` imports `domain/dist/runtime/llm-evidence/sanitize.js` instead. Both gave identical bytes on all 23 rows.
- **Bytes and tokens.** Bytes are `Buffer.byteLength(JSON.stringify(evidence))`. Tokens are `ceil(bytes/3)`, as in Core's `estimateAutomationStudioLlmTokensFromUtf8Bytes`. For `.packet.json` files, the run_node keys (`ok`, `node`, `status`, `pageChanged`, `read`, `inFlow`, `control`) are removed before measuring.
- **Qualifying.** A raw element qualifies when it is **visible** and has either **own text** or is **interactive**. Only elements the sanitizer kept are counted, matched by selector against `binding.selectors`.
  - **Visible:** the capture listed the element, so it is rendered (not `display:none`, not `[hidden]`, not `visibility:hidden`), *and* it has `documentBounds`, meaning a box of at least 2x2 px anywhere in the document. Elements off the viewport count as visible. `isVisibleOnViewport` is reported separately as "q on viewport". `aria-hidden` and `opacity:0` are not excluded, since the capture keeps them on purpose.
  - **Own text:** the element's `text`, after removing each direct child's `text` (children found by xpath), still contains a letter or digit.
  - **Interactive:**
    - `a` with an href;
    - `button`, `select`, `textarea`, `summary`;
    - `input` unless its type is hidden;
    - an ARIA control role: button, link, checkbox, radio, switch, tab, menuitem*, option, combobox, textbox, searchbox, slider, spinbutton, listbox, treeitem or gridcell;
    - `hasClickHandler`;
    - `contenteditable`.
  - **Packet-only files** use an approximation: visible means `box` is present, and own text means `text` or `name` is present, because a packet has no tree.
- **`--view <module>#<export>`.** The export is a `(binding) => string`. The script prints the string's UTF-8 bytes, the bytes of `JSON.stringify(string)`, the tokens computed from the latter, and the ratio of view to packet. A `.ts` module is bundled in memory the same way. Packet-only rows get `{evidence, selectors: new Map(), records: new Map(), packetOnly: true}`. I tested a `.mjs` view and a `.ts` view that imports domain source; both ran on all 23 rows.
- **Contributors.** Bytes are attributed per key: `"key":value` plus its comma, summed across elements, with non-element top-level keys listed as `packet.<key>`. The attributed bytes add up to within 1 byte of the packet size (checked on 2 packets).

## Commands run and observed results

- Corpus generation: `node <scratch>/t223-w1-tools/make-corpus.mjs <scratch>` (bundled with esbuild from the worktree's `domain/node_modules/esbuild`). Result: 20 pages, all HTTP 200, 0 script errors, 1.7–8.2 s per page.
- `node <scratch>/t223-measure.mjs --json <scratch>/t223-corpus/_measure-baseline.json` printed the table below in about 5 s:

| scenario | page | source | raw els | packet els | visible | qualifying | q on viewport | bytes | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| auction-marketplace | deep | jsdom-synth | 941 | 941 | 801 | 426 | 36 | 315963 | 105321 |
| auction-marketplace | start | jsdom-synth | 111 | 111 | 102 | 65 | 25 | 30884 | 10295 |
| bigbox-retail | deep | jsdom-synth | 561 | 561 | 536 | 389 | 34 | 168077 | 56026 |
| bigbox-retail | start | jsdom-synth | 318 | 318 | 298 | 214 | 29 | 119516 | 39839 |
| bigbox-retail | start | recorded packet 2026-10-01T05:05 | - | 324 | 323 | 233 | 106 | 123146 | 41049 |
| company-website | deep | jsdom-synth | 47 | 47 | 46 | 34 | 27 | 13367 | 4456 |
| company-website | start | jsdom-synth | 108 | 108 | 104 | 73 | 34 | 27842 | 9281 |
| crossborder-marketplace | deep | jsdom-synth | 382 | 382 | 313 | 205 | 37 | 86271 | 28757 |
| crossborder-marketplace | start | jsdom-synth | 481 | 481 | 413 | 253 | 37 | 113549 | 37850 |
| everything-store | deep | jsdom-synth | 790 | 790 | 756 | 455 | 39 | 354911 | 118304 |
| everything-store | deep | recorded packet 2026-10-01T05:17 | - | 756 | 730 | 562 | 158 | 340028 | 113343 |
| everything-store | start | jsdom-synth | 124 | 124 | 116 | 71 | 29 | 31757 | 10586 |
| everything-store | start | recorded packet 2026-10-01T05:17 | - | 124 | 116 | 95 | 55 | 32219 | 10740 |
| job-board | deep | jsdom-synth | 245 | 245 | 232 | 123 | 34 | 66515 | 22172 |
| job-board | start | jsdom-synth | 44 | 44 | 42 | 27 | 27 | 11552 | 3851 |
| local-classifieds | deep | jsdom-synth | 249 | 249 | 173 | 82 | 35 | 72899 | 24300 |
| local-classifieds | start | jsdom-synth | 219 | 219 | 143 | 65 | 36 | 64916 | 21639 |
| photo-social | deep | jsdom-synth | 225 | 225 | 183 | 78 | 24 | 78361 | 26121 |
| photo-social | start | jsdom-synth | 311 | 311 | 271 | 135 | 23 | 116364 | 38788 |
| professional-network | deep | jsdom-synth | 314 | 314 | 302 | 201 | 42 | 108128 | 36043 |
| professional-network | start | jsdom-synth | 199 | 199 | 182 | 121 | 41 | 64986 | 21662 |
| social-network-feed | deep | jsdom-synth | 343 | 343 | 274 | 139 | 33 | 152915 | 50972 |
| social-network-feed | start | jsdom-synth | 486 | 486 | 378 | 201 | 40 | 175369 | 58457 |
| TOTAL (excl. recorded) |  | 20 pages | 6498 | 6498 | 5665 | 3357 | 662 | 2174142 | 724720 |

Deep pages: everything-store `s?k=wireless+earbuds` · crossborder `search?q=usb+c+hub` · bigbox `search?q=paper+towels` · job-board `jobs?q=Halvard+Systems` · local-classifieds `category/bicycles/` · auction `sch/i.html?_nkw=kestrel+35` · photo-social `harbourlight.studio/` · social-network-feed `groups/riverside-allotments/` · company-website `book` · professional-network `search/results/people/?keywords=data+engineer`.

Qualifying is 52% of elements overall (3,357 of 6,498), ranging from 33% on local-classifieds deep to 72% on company-website deep. Bytes per element average about 335 B.

**The top five contributors per page** (bytes, % of packet), as printed by the script:

- auction deep: attributes 50895 (16.1%); heading 47272 (15.0%); within 42551 (13.5%); box 39472 (12.5%); item 23630 (7.5%)
- auction start: attributes 7247 (23.5%); box 4964 (16.1%); heading 2656 (8.6%); target 2334 (7.6%); onViewport 2065 (6.7%)
- bigbox deep: attributes 35442 (21.1%); box 26337 (15.7%); heading 19848 (11.8%); target 12234 (7.3%); landmark 10832 (6.4%)
- bigbox start: within 24225 (20.3%); attributes 20270 (17.0%); box 14586 (12.2%); heading 11632 (9.7%); item 7076 (5.9%)
- company deep: attributes 3020 (22.6%); box 2206 (16.5%); heading 1020 (7.6%); href 1019 (7.6%); target 978 (7.3%)
- company start: box 5031 (18.1%); attributes 4289 (15.4%); heading 2598 (9.3%); target 2268 (8.1%); landmark 2078 (7.5%)
- crossborder deep: attributes 20586 (23.9%); box 15317 (17.8%); target 8296 (9.6%); landmark 7258 (8.4%); onViewport 7204 (8.4%)
- crossborder start: attributes 26630 (23.5%); box 20227 (17.8%); target 10474 (9.2%); alike 10209 (9.0%); onViewport 9079 (8.0%)
- everything-store deep: heading 89905 (25.3%); attributes 60723 (17.1%); box 37273 (10.5%); within 33715 (9.5%); item 18135 (5.1%)
- everything-store start: attributes 7303 (23.0%); box 5647 (17.8%); target 2620 (8.3%); landmark 2591 (8.2%); onViewport 2315 (7.3%)
- job-board deep: attributes 11440 (17.2%); box 11303 (17.0%); heading 6666 (10.0%); item 5557 (8.4%); target 5282 (7.9%)
- job-board start: attributes 2465 (21.3%); box 2011 (17.4%); heading 953 (8.2%); target 915 (7.9%); onViewport 794 (6.9%)
- local-classifieds deep: attributes 24028 (33.0%); box 8411 (11.5%); target 5370 (7.4%); landmark 5256 (7.2%); heading 4981 (6.8%)
- local-classifieds start: attributes 21731 (33.5%); box 6945 (10.7%); heading 5080 (7.8%); target 4710 (7.3%); landmark 4453 (6.9%)
- photo-social deep: attributes 33443 (42.7%); box 8929 (11.4%); heading 5886 (7.5%); target 4842 (6.2%); onViewport 4231 (5.4%)
- photo-social start: attributes 43667 (37.5%); within 20109 (17.3%); box 13312 (11.4%); target 6734 (5.8%); onViewport 5867 (5.0%)
- professional deep: within 25028 (23.1%); attributes 17313 (16.0%); box 14730 (13.6%); item 7755 (7.2%); target 6800 (6.3%)
- professional start: within 14615 (22.5%); attributes 11628 (17.9%); box 8848 (13.6%); target 4270 (6.6%); item 4234 (6.5%)
- social feed deep: within 49400 (32.3%); attributes 35436 (23.2%); box 13379 (8.7%); heading 11293 (7.4%); target 7438 (4.9%)
- social feed start: attributes 50179 (28.6%); within 29172 (16.6%); box 18483 (10.5%); heading 12210 (7.0%); target 10584 (6.0%)

**The same attribution summed over all 20 synthesized pages** (2,174,142 B):

| key | bytes | share |
| --- | --- | --- |
| attributes | 487,735 | 22.4% |
| box | 277,411 | 12.8% |
| within | 249,011 | 11.5% |
| heading | 224,603 | 10.3% |
| target | 140,903 | 6.5% |
| onViewport | 122,373 | 5.6% |
| landmark | 116,030 | 5.3% |
| tag | 79,729 | 3.7% |
| item | 79,316 | 3.6% |
| name | 78,835 | 3.6% |
| alike | 75,647 | 3.5% |
| href | 72,824 | 3.3% |
| text | 64,654 | 3.0% |
| implicitRole | 42,951 | 2.0% |

Only about 3% of the packet is `text` and 3.6% is `name`.

Other checks:

- `node t223-measure.mjs --sanitizer dist`: the TOTAL line matched exactly, and 0 of 23 rows differed from the source bundle.
- `--view t223-w1-tools/example-view.mjs#lines` and `--view t223-w1-tools/example-view.ts#compact` both printed the view columns for every row. For example, the `.ts` view reported 104,088 JSON bytes in total, a ratio of 0.048.
- `git status --short` in the worktree printed nothing before this report was written.

## Not verified

- **No raw snapshot from a real browser.** All 20 raw pages are jsdom syntheses. Their bytes and element counts are calibrated against only 3 recorded packets, from 2 scenarios. The other 8 scenarios have no recording to compare with.
- **`onViewport` and "q on viewport".** These are underestimated by roughly 3–4x by the single-column layout, so do not use them as real figures. `box` values are synthetic, though their size in bytes is realistic.
- **Overlays and covering.** These are not exercised: `elementFromPoint` returns null. Timer-driven popups and banners of 2 s or more, the deal-wheel variants and cookie or consent timing were not captured. No variant (`list-layout`, `regrouped`, and so on) was measured; every page is the default variant at the scenario seed.
- **Background merge.** The background's multi-frame merge (`background/connection/dom-snapshot.ts`) was not applied; every page is a single top frame. Child frames that the scenarios open at runtime are absent.
- **Scope of the token figure.** Tokens are Core's conservative estimate (bytes/3), not a tokenizer count. Core's surrounding message (the tool result envelope, history and prompt) is not included.

## Open questions or contradictions found

- The brief mentions "a `[role]` control"; I took that to mean the ARIA control roles listed above. `option` is counted only when it carries a role, because native `<option>`s belong to their `select`.
- The brief limits owned files to the corpus, the script and the report. Generating the corpus also needed a tools folder (`<scratch>/t223-w1-tools/`, which includes a scratch jsdom install). It is listed above; nothing was written to either repository.
- The recorded "packets" in decision dumps are run_node results: the v2 packet plus `ok`, `node`, `status`, `pageChanged`, `read`, `inFlow` and `control`. The model sees those few extra keys too. They are excluded from the packet bytes here.
