# t1038 worker B (`b-one-read`): D13, a list read is one call that detects the list itself

## Outcome

Done. A list read is now one call. `core.run_node` with `web.output.dom-extract_list` names its list by a line of the page view (`{handle: "tN"}`), by the words of such a line (`{words: "..."}`), or by nothing (the page's largest list). The read runs the same detection the tool runs, then reads the `extraction.N` that detection issued. It keeps every column under a readable, stable name and tells the model those names. `fields` is optional and only picks columns. A read that names an `extraction.N`, or detected keys, works as before. The detection tool stays, and no refusal says "detect first".

Offline proof: 21 distinct recorded detect-then-read pairs. 16 were replayed as single reads on the bigbox-retail fixture, and all 16 returned the same rows as the old two calls (same items, same values in every asked column). 5 could not be replayed, for the reasons below.

No wire change was needed: the read reuses `web.dom.capture_snapshot` with `detectStructure`, and the content script is unchanged.

## What changed and why

### New read request shape
- `extractList: {handle: "tN", fields?, where?, dedupe?, sort?, minItems?, maxItems?, discloseText?}`. `tN` is a line of the page view inside the list, or the heading above it. A bare `extractList: "tN"` is read the same way.
- `extractList: {words: "...", ...}`: the first line in page order whose words equal those words, otherwise the first that contains them.
- `extractList: {}`, or no `handle`/`words`/`item` at all: the page's largest list.
- Rules, in `node-run/list-read/own-detection.ts`:
  - The detection is `detectRepeatingStructure` itself, retained in the same store. The call then goes on as a read of the issued `extraction.N` through the existing slot resolver, so conditions, dedupe, sort and the record output are unchanged.
  - A line inside the list reads the run.
  - If the page also sends the record the line sits in, outside the run, that record is read, unless the line is a heading or shows the list's own name (`packet.list`). Then the run is read. This came out of the replay: bigbox's shelf heading sent its own header block as the record, which gave 1 row instead of 8.
  - A `tN` read whose `fields` name only `text`/`value`/`link` is still a one-element table (t903), with no detection. So is a `tN` with no list anywhere on the page.
  - Unchanged cases:
    - a handle that does not bind on this page goes to the resolver, which refuses it as stale or unknown as before;
    - a client that declares no detection;
    - a read that names an `extraction.N`, a literal `item`, or a handle inside its fields.
  - Words that no line shows are refused (see refusal wording below). They are never read as the largest list.
- The step the draft keeps names the issued `extraction.N` and holds its `extractionBinding`, now including `names`. A rerun therefore detects nothing.

### Readable column names (labels)
- `structure/column-names.ts`. A column whose key came from the page's own words (`price`, `product-image_src`) keeps its key as its name.
- A class-path column is named from closed words only, with no page value:
  - what its element is, from the readable label: `link`, `button`, `heading`, `image`, `price`, `number`, `lines`;
  - otherwise from its path's tags: `img` gives `image`; plain text inside an `a` or `h1-h6` gives `link_text` or `heading_text`;
  - then what of the element is read: `url` for an address, the attribute name for an attribute (`image_src`, `image_alt`), a state mark's state (`button_pressed`).
- Clashes get `_2`, `_3`, and a name is never another column's key.
- Names are computed once, at detection. They are kept in the binding (`names`, `structure/handles.ts`) and persisted in a saved read's `extractionBinding` (`plan-resolution/extraction/saved-list.ts`, validated on read).
- How the names are used:
  - `keptWebExtractionColumns` keeps every column that `fields` does not ask for under its name.
  - A name in `fields` or `where` resolves exactly, as a key does.
  - Nearest-column guessing also searches the names.
  - The unknown-column issue's `valid` list now holds names.
- What the model sees:
  - the packet shows `name` beside `key` where they differ;
  - the read's answer carries `columns` (every kept name, in row order) and `asked` (the ones `fields` picked);
  - the retained record schema labels a class-path column by its name instead of its key.
- Bigbox example, the columns of the search-results read:
  `data-item-id, text, text_2, text_3, url, link_text, image_src, image_alt, price, text_4, number, text_5, text_6, text_7, number_2, price_2, text_8, text_9, lines, text_10, text_11, text_12, link, button, url_2`.
  An honest limit: this site's classes are all generated, so many text columns can only be `text_N`. The row values show what each one holds.

### Refusal wording (all generic; `node scripts/check/model-text.mjs` ok)
- Unknown column, list read (`rejection-next/unknown-column.ts`): "Nothing was read: `x` is not a column of the list this read names. A read keeps every column of its list; fields only picks the ones asked, each written as {your name: name or key} with a column name or key of this list. Run the same read with no fields to get every column under its name, then pick from those names. A key of a detection's cells or record is a column of their own handle, not of this list."
- Unknown column, one-element read: "... No list was found around it on this page, so the read reads that one element as one row, whose only columns are text, value and link. A table of several rows is a list on the page that shows it: go to that page and read it there, naming the list by the handle of a line inside it, with no fields to keep every column under its name." The old text said "Detect the list you mean on its own page".
- Words not shown (new; `rejection-next/list-words.ts`; reason `list_not_on_page`, code `web.list.words_not_shown` in `instead`): "Nothing was read: no line of this page's view shows the words this read named its list by. Name the list by the handle of a line inside it, or of the heading above it, as the page view prints them; or name nothing, and the read takes the page's largest list."
- Saved read's list not on this page (`list-made-on.ts`): "... or, for a list this page shows, read it here by the handle of a line inside it." The old text said "detect it here and read it by the handle that detection issues".
- Handle shapes in a resolver refusal (`node-run/refusal-detail`): `extractList: {"handle": "tN"}` replaces `extractList: {"handle": "extraction.N"}`.
- Packet `readNote`: it keeps every field under its name; `fields` is optional and only picks columns.
- Not changed: `notInPacketNext`'s "to detect or read a list that another page shows, go to that page first". It is not "detect first", and its pin lives in the W1-owned `harness-options/tests/detect-option.test.ts`.

### Catalog text the model sees (`output-nodes/extract-list/catalog-text.ts`, a file in no list)
- Description, 239 of Core's 240 characters: "Read the rows of a list or table on this page, or one record, into the dataset. Name the list by a line of it (handle tN); it keeps every column. Fields {yourKey: "text"} alone read that one element. It saves its rows itself: no save step."
- Grammar, exactly 700 of 700: it now leads with `{handle: "tN", ...}` and adds "tN: a line in/above the list (none: largest). All columns kept; fields picks some." That clause took the room of "All safe fields are retained; fields selects a view." `words` did not fit; it is still accepted. Example `handle: "t12"`.
- `node-run/catalog.ts` holds no parameter text, so nothing changed there.

### Files changed
- Owned:
  - `domain/src/runtime/llm-evidence/structure/`: new `column-names.ts`; `packet.ts`, `handles.ts`; tests: new `column-names.test.ts`, updated `detect.test.ts`, `record.test.ts`, `column-at.test.ts`.
  - `domain/src/runtime/llm-evidence/rejection-next/`: new `list-words.ts`; `next-sentence.ts`, `unknown-column.ts`, `list-made-on.ts`, `index.ts`; `tests/list-handle-elsewhere.test.ts` (its stub now answers a detection with no list).
  - `domain/src/runtime/llm-evidence/node-run/`:
    - `list-read/`: new `own-detection.ts` and `tests/own-detection.test.ts` (7 tests); `answer-keys.ts`, `index.ts`;
    - `run.ts`: one line replaced, still 800 lines; one import name added;
    - `refusal-detail/refusal-detail.ts`.
- In no workstream's list:
  - `domain/src/runtime/llm-evidence/plan-resolution/extraction/`: `columns.ts`, `conditions.ts`, `slot.ts`, `saved-list.ts`, `retained-schema.ts`, `element-record.ts`; tests `extraction/tests/stored-columns.test.ts`, `tests/one-record.test.ts`.
  - `domain/src/output-nodes/extract-list/catalog-text.ts`; tests `extract-list/tests/catalog-text.test.ts`, `extract-list/tests/answered.test.ts`, `output-nodes/tests/definitions.test.ts`.
  - `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts` (handle-shape expectation).
  - Docs: `docs/architecture/page-evidence.md` (new paragraphs "A read is one call that detects its own list" and "Every column is kept under a readable name"), `docs/architecture/web-capabilities.md` (extraction row), `docs/architecture/build-loop.md` (one clause).
- Not touched: Core, page-view, stable handles, page-find, fingerprints, target-reacquire, content snapshots and handle assignment, `packages/test-runner`, `domain/src/extraction/**`, `domain/src/actions/extraction/**`, `apps/extension/src/content/extraction/**`.
- Scratch files, ignored and not to commit: `test-runs/t1038/b-*`.

## Commands run and observed results

- Domain tests over every touched directory: `DOMAIN_TEST_BUILD_LABEL=t1038b node scripts/test-domain.mjs llm-evidence/structure/ llm-evidence/node-run/ llm-evidence/rejection-next/ llm-evidence/plan-resolution/ output-nodes/ llm-evidence/tests/tool-rejection` (in `domain/`, heavy gate).
  - First run: `# tests 1415 # pass 1403 # fail 12`. The 12 were wording and name expectations, an over-strict own assertion, and a crash with clients that declare no detection. All were fixed in the code or the expectations as described above.
  - Final run: `# tests 1417 # pass 1417 # fail 0 # cancelled 0`.
- `pnpm --filter @fluxiq-web-extension/domain check`: first refused with "FluxIQ Core's build ... is not current with its source". I rebuilt Core's libraries as it instructed (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` in the t1038 Core tree; all Done). Then: "core-build: ... is current with its source" and `domain:check` built, exit 0.
- `pnpm --filter @fluxiq-web-extension/extension check`: exit 0 (`extension:check` built).
- `EXTENSION_TEST_BUILD_LABEL=t1038b pnpm --filter @fluxiq-web-extension/extension test`: exit 0, `# tests 4168 # pass 4168 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (261 warning(s), 551 baselined).` One `contract-spread` failure in `answer-keys.ts` was fixed along the way.
- `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 554 model-facing Core files, 14346 string literals)`.
- Offline replay: `node node_modules/@playwright/test/cli.js test -c ../../test-runs/t1038/b-replay.config.mjs` (in `apps/extension`, heavy gate, `NODE_OPTIONS=--no-experimental-strip-types`). Result: `1 passed (4.4m)`.

## Offline replay (bigbox-retail fixture, content harness)

- Route:
  - The real content-script bundle runs in headless Chromium on the Lab's bigbox-retail fixture, through `apps/extension/e2e/content`'s harness (realistic scenario only).
  - The domain's own evidence runtime (`createWebAutomationLlmEvidenceRuntime`) runs against it, with gateway results mapped by `gatewayActionResultFromBrowserResult`.
  - No provider, no Lab launch.
  - Spec: `test-runs/t1038/b-replay.spec.ts`. Pairs come from `b-pairs.mjs`, results are in `b-replay-results.json` and the table in `b-table.md`.
- For each distinct pair (run, detection, read request, page):
  - **Old:** look, `web.detect_repeating_structure` at the recorded target's line (found by its recorded words), then the recorded read of that handle with its recorded `fields`, on the read's own page.
  - **New**, in a fresh harness: look, then one `core.run_node` read naming the list by the recorded target's line. Where the read ran on another page than the detection, the line of the old read's first row is used instead. No `fields`; the other keys are kept.
  - Each old asked column is compared with the new column that has the identical field spec, row by row. Link origins are stripped, because each harness has its own port.
  - The old harness rows are also compared with the recorded rows.

| Pair (run, detect->read) | Page read | Old rows (recorded) | New: one read named by | New detections | New rows | Same rows on asked columns? | Old harness vs recorded |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mwus396e 0004->0008 | `/` | - (2) | - | - | - | not replayed (A) | - |
| mwus396e 0024->0034 | `/search?q=paper+towels` | 15 (15) | t111 | 1 | 15 | yes (5 cols) | same |
| mwuuo3zk 0018->0024 (cells) | `/search?q=paper+towels` | - (16) | - | - | - | not replayed (B) | - |
| mwuuo3zk 0068->0070 (cells) | `/search?...&facet=fulfillment_method:Pickup` | - (16) | - | - | - | not replayed (B) | - |
| mwuxd2v9 0004->0006 | `/` | - (2) | - | - | - | not replayed (A) | - |
| mwuxd2v9 0018->0020 | `/` | - (2) | - | - | - | not replayed (A) | - |
| mwv5m906 0010->0012 | `/` | 8 (8) | t45 (heading) | 1 | 8 | yes (5 cols) | same |
| mwv5m906 0010->0123 | `/` | 8 (8) | t45 | 1 | 8 | yes (9 cols) | same |
| mwv5m906 0010->0129 | `/` | 8 (8) | t45 | 1 | 8 | yes (9 cols) | same |
| mwveg5ls 0004->0006 | `/` | 8 (8) | t45 | 1 | 8 | yes (5 cols) | same |
| mwveg5ls 0010->0014 | `/search?q=paper+towels` | 15 (15) | t116 | 1 | 15 | yes (5 cols) | same |
| mwveg5ls 0010->0016 | `/search?q=paper+towels` | 15 (15) | t116 | 1 | 15 | yes (5 cols) | same |
| mwveg5ls 0010->0022 | `...&sort=price_low` | 15 (15) | t115 | 1 | 15 | yes (5 cols) | same |
| mwveg5ls 0010->0026 | `...&sort=price_low&page=2` | 15 (15) | t115 | 1 | 15 | yes (5 cols) | same |
| mwveg5ls 0010->0030 | `...&sort=price_low&page=3` | 11 (11) | t115 | 1 | 11 | yes (5 cols) | same |
| mwveg5ls 0010->0036 | `...&page=3` | 11 (11) | t115 | 1 | 11 | yes (5 cols) | same |
| mwveg5ls 0010->0072 | `...&page=3` | 11 (11) | t115 | 1 | 11 | yes (5 cols) | row 3 `pickup` (C) |
| mwveg5ls 0183->0201 | `...&page=3` | 11 (11) | t339 | 1 | 11 | yes (5 cols) | row 3 `pickup` (C) |
| mwveg5ls 0010->0210 | `...&page=3` | 11 (11) | t115 | 1 | 11 | yes (4 cols) | row 3 `pickup` (C) |
| mwveg5ls 0010->0220 | `...&page=3` | 11 (11) | t115 | 1 | 11 | yes (5 cols) | row 3 `pickup` (C) |
| mwveg5ls 0010->0232 | `...&page=3` | 11 (11) | t115 | 1 | 11 | yes (2 cols) | same |

- Replayed: **16 of 16 equal** (old two calls against the new one call). 12 of the 16 also matched the recorded rows exactly.
- Why the 5 could not be replayed:
  - **(A)** The fixture's detection around the recorded heading (`t45`, "Pickup today at ...") answers the product shelf (8 items). The recorded live detection answered a 2-item section-level run whose keys (`div_css-0e8dhz2_h2`, `ul_css-1ysgock_li_1_span_css-195vhdq`) the fixture's detection does not issue. So the old read itself is refused `column_not_in_detected_list` on the fixture, and there is no old result to compare with. The same heading's other pairs (mwv5m906, mwveg5ls) recorded the shelf and replay equal. I did not trace why the live page detected the section level in these three runs. Candidates are page state the fixture does not reproduce (store, layout, a covering consent layer).
  - **(B)** The recorded reads are of a `cells` handle (one row per control). The fixture's detection around the recorded targets ("+ Add", "(938)") issues no `cells`, so the old read cannot run. A single read by `tN` also reads the run or the record, never `cells`. A cells read stays a detection of its own, and through it the old two calls.
  - **(C)** Only the `pickup` text differs between the harness and the recording ("Pickup today" against "Pickup tomorrow"), which depends on the time of day. Old and new agree with each other.
- Detection cost the one-call read removes, measured on the recordings (`b-detect-cost.mjs`): 102 detection decisions (69 ran, 33 refused by Core), and 457,306 characters of detection results, about 114k tokens at 4 characters per token. These are no longer required before a read. A read's own detection result is not shown to the model; it gets rows, `columns` and `asked`. I did not measure per-request decision tokens; that needs W1's context change to be meaningful.

## Draft needs (Core `runtime/flow-authoring/**`, W3; not changed)

- The draft needs nothing changed to work. The read is recorded as the call it is. `input` and `ranWith` name the issued `extraction.N`, and `ranWith` holds `extractionBinding` with `names`, so the saved step resolves and replays without memory or detection.
- What W3 or Core may want:
  1. Core's submit feedback `EXTRACTION_FROM` (`runtime/flow-authoring/bootstrap/plan/issue-feedback.ts`) still tells the model "Detect the structure first and write the handle its answer gives" for an unknown `extraction.N`. With D13 it should say: name the list by a line of it (`tN`).
  2. If the auto-draft (D16) writes a read step itself, it should copy `ranWith.parameters.extractList` (handle plus `extractionBinding`) and not the model's `tN`. A `tN` in a saved Flow would detect again at playback time, and the handle may not exist then.
  3. The model's later `fields`, conditions and result-processing columns now use readable names (`price`, `url`, `link_text`). Core's guidance text that says columns are "detected keys" could say "column names".

## Not verified

- No live run and no provider-free Lab run (the brief asked for neither). Only the harness replay on bigbox-retail exercised the browser.
- The harness runs headless, which is the harness config's standard; it is not a Lab browser.
- The `words` route and the record-preference rule on a real page. The `words` route is only unit-tested; the record rule is unit-tested and appeared indirectly in the replay through the heading rule.
- Other sites' column names. On sites with test ids the names are the keys; on generated-class sites expect `text_N`.
- How Core shows the new `columns`/`asked` keys inside a read answer. I checked the domain tests and that the answer still carries `listKey`/`place`; I did not read Core's consumers.
- The domain check passed after I rebuilt Core from the t1038 Core tree, which holds worker A's uncommitted Core edits. The build itself succeeded.

## Open questions or contradictions found

- The tools.ts detect description (`runtime/llm-evidence/tools.ts`, which W1 may edit for D15) still says "Run the extraction node with extractList: {handle, fields?...}" with an extraction handle. It does not say "first", so I left it, to avoid a merge conflict next to the `find_on_page` entry W1 removes. W1, or whoever integrates, may want it to add "or name the list by a line of it (tN)".
- `harness-options/options.ts` (W1-owned) describes the recovery detect option. Unchanged.
- Choosing the record over the run when the target sits outside the run is a judgement call. Headings and the list's own name read the run; any other line reads the record it sits in. A live run may show whether the model ever wants the run in that case.
