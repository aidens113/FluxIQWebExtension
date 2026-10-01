# t223-W4: the element fields and the compact page view

This is the worker report for brief t223-W4. The tree is `fxwork/t223/!FluxIQWebExtension` on branch `task/t223-compact-page-view`. Nothing was committed. No Lab and no browser were used. The view is not wired into any tool, refusal, node run or recovery option (that is W5), and there is no search tool (that is W6).

## Outcome

Done.

- **Checks.** `domain check` exits 0. The unlabelled `domain test` exits 0 with 1130/1130 passing. The structure audit passes.
- **Targets on the structured pages.** Measured on the same pages in corpus v2, which carries `parent`, `ownText` and `viewport`, all three targets are beaten:

  | Page | View bytes | Target |
  | --- | --- | --- |
  | everything-store start | 2,791 | 3,544 |
  | bigbox start | 5,927 | 7,086 |
  | everything-store results | 13,754 | 22,307 |

  The supervisor's prototype, run on those same three pages, gives 3,369, 6,446 and 22,611.
- **Targets on the recorded packets (fallback mode).** These packets have no `parent` or `ownText`. Everything-store results beats its target: 18,175 against 22,307. Everything-store start (3,824 against 3,544) and bigbox start (9,502 against 7,086) miss. Both misses come from rules that need `parent`, as the spec allows; the bytes are attributed rule by rule below.

## What changed and why

### 1. Element fields

**`elements.ts`.** `WebLlmEvidenceElement` gains three fields:

- `ownText?: string`. It is screened. An empty string is kept as `""`, and the field is absent only when the capture sent none.
- `parent?: string`. This is a handle.
- `hidden?: true`.

The `present` call names all three. `parent` is written by `sanitize.ts`, because only that file knows every handle.

**`sanitize.ts`.**

- **Two passes.** The first pass describes every raw element. Handles are then assigned rendered-first: the rendered elements are numbered `t1`, `t2` and so on in document order, and hidden elements get the numbers after them. Elements stay in document order in the packet.
- **Parents.** `rawParentHandles` turns a raw `parent` index into the nearest described ancestor's handle. It reads parent indexes from the raw list, so a dropped element (sensitive, or unaddressable) still passes its own parent up. A first version read them only from described elements and lost them; a test caught it.
- **Malformed indexes.** A `parent` that is not strictly before its child ends the walk.
- **No undefined keys.** `parent` is written only when there is one.
- **Look-alikes.** These are now computed over rendered elements only, so a hidden copy of a control cannot change a visible element's `alike` or `within`.
- **Viewport.** `viewport` is carried on the packet.

**`page-evidence.ts`.** There is a new `WebLlmEvidenceViewport` with `width`, `height`, `scrollX` and `scrollY`. It is read from the snapshot's `viewport` and kept only when complete: all four values finite, and the sizes greater than 0. Values are rounded. The field table in the file header gains its row.

### 2. `stable-handles.ts`

- **Numbering.** `restamp` spends numbers rendered-first, then hidden.
- **Addresses.** `addressesOf` counts shared-selector occurrences over rendered elements first. This means a hidden element with the same selector, earlier in the document, cannot take a rendered element's occurrence.
- **Renaming.** `rewrite` renames `parent` along with the other handle fields.
- **Test.** The same page captured as a look and as a search, in either order, gives every visible element the same handle, `t1` to `t5`. A second test checks that renumbered parents still name the element's ancestor.

### 3. State digest and route state

- **`state-digest.ts`.** Hidden elements are filtered out before the projection. `viewport`, `ownText`, `parent` and `hidden` are marked OMITTED, each with its reason.
- **Version bump.** `STATE_DIGEST_VERSION` goes from `web-state.v2` to `web-state.v3`. Naming the new keys changes the projection's bytes for every page, and the constant's own comment requires a bump when that happens. t200 set the precedent. The regex assertions in `state-digest/tests/` were updated.
- **`route-state/project.ts`.** `controls` lists rendered controls only.
- **Tests.** In `state-digest/tests/hidden-elements.test.ts`, the same binding with and without hidden elements gives an equal digest and an equal route state. A hidden control is not listed, and a scroll does not change the digest.

### 4. New `page-view/`

The module has one exported value per file and a barrel. Its files are:

| File | What it holds |
| --- | --- |
| `schema-version.ts` | `WEB_LLM_PAGE_SCHEMA_VERSION = "web-llm-page.v3"` |
| `published-page.ts` | `publishedWebLlmPage(evidence)`, and the type `WebLlmPublishedPage`. The type is a `Pick` of `trust`, `location`, `truncated` and the five failure fields, plus `schemaVersion` and `page`. |
| `retention-key.ts` | `webLlmPageRetentionKey`, which gives `location + " " + page` |
| `page-text.ts` | The header lines, a blank line, then the element lines |
| `header.ts` | `PAGE`, `URL`, `VIEW`, `COVERING`, `DIALOG`, `LOADING`, `FRAMES`, `ARRIVED`, `SELECTED`, `CAPTURE`, in the spec's order, each only when it has something to say |
| `line-choice.ts` | Rules 1–4 with F1, F3, F2 and the image rule |
| `fragment-merge.ts` | F4 |
| `page-tree.ts` | The `parent` walk |
| `link-writer.ts` | The `~` base and the paths |
| `link-repeats.ts` | `same href`, `same href#frag` and `same href as tN` |
| `structure-markers.ts` | Region, item, row and screen markers |
| `line-render.ts` | Writes each line, with the heading-tag prefix |
| `view-line.ts` | A type only |

The per-element pieces are in `page-view/element/` so that W6's search can reuse them:

- `webLlmViewTraits`: visible, control, layer, semantic, image, own words, and which line role applies;
- `webLlmElementKind`;
- `webLlmElementWords`, which applies W1;
- `undoubledWords`;
- `webLlmStateTokens`;
- `webLlmElementWhere`, which returns `on screen`, `above`, `below`, `off screen`, `off-page` or `not rendered`;
- `meaningfulWords`, `normalisedWords`, `quotedWords` and `attributeValue`.

### 5. Tests

**Page-view tests**, in `page-view/tests/` (multi-subject, through the packet) and `page-view/element/tests/` (one per piece):

- Every line rule, each fold and the no-`parent` fallback;
- F4: the join, its three refusals, and a folded screen-reader copy;
- The link base, paths, other origins and repeats;
- Region, item, row and screen markers, with and without a viewport;
- Every header line and the `VIEW` variants;
- The published keys, the dropped keys, the failure marks and the retention key;
- Kinds, traits, words, W1, state tokens and `where`.

**The end-to-end test**, `page-view/tests/end-to-end.test.ts`, starts from a raw snapshot shaped like the format example's page. It has a honeypot at x = -9768, screen-reader prices, an h2 wrapping a link, a card below the fold, a modal cookie wall that covers a button, and two `hidden` elements. It goes through `sanitizeWebLlmSnapshotWithBindings` and `publishedWebLlmPage`, and asserts:

- the whole page text;
- each lesson;
- that removing the hidden elements gives an identical page.

**Field tests.**

- The sanitize field tests (ownText, parent, hidden, viewport) are appended to `tests/sanitize.test.ts`.
- The hidden-handle tests are appended to `tests/stable-handles.test.ts`.
- As separate files, these two pushed `llm-evidence/tests/` to 27 files, over the 25-file limit.

## Commands run and observed results

- `bash heavy.sh "t223 W4 domain check" pnpm --filter @fluxiq-web-extension/domain check` exited 0. Last line: `{"build-cache":"build","step":"domain:check","reason":"inputs changed: domain; stored in the shared store ...","ms":9450}`.
  - An earlier run failed on two test typings under `exactOptionalPropertyTypes`. Both were fixed.
- `bash heavy.sh "t223 W4 domain test" pnpm --filter @fluxiq-web-extension/domain test` (unlabelled) exited 0, printing `# tests 1130  # pass 1130  # fail 0  # cancelled 0`.
  - The Core-staleness guard passed in this run.
  - An earlier run printed `# fail 3`. Two failures were wrong test assumptions: a 400-word string that really is `X X`, and a link writer built with no links. The third was the real parent-walk bug described above.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (136 warning(s), 119 baselined).`
  - An earlier run failed on a call spread in a test and on `llm-evidence/tests/` holding 27 files. Both were fixed.
  - One new advisory warning is mine: `elements.ts: 432 lines is past the 400-line advisory threshold` (the hard limit is 800). It was 397 lines before; the field documentation is what grew it.
- `node <scratch>/t223-measure.mjs --corpus <scratch>/t223-corpus-v2 --view <scratch>/t223-w4-view.ts#view` and the same with `--corpus <scratch>/t223-corpus`. The adapter is `(binding) => publishedWebLlmPage(binding.evidence).page`. For recorded packets only, it first rewrites the pre-W3 `target.N` handles to `tN`, as the prototype did, so both are measured on the same handles. The output is in the tables below. The packet bytes in today's packet are larger than the baseline because they now carry `ownText` and `parent`; the baseline column is taken from `_measure-baseline.json`.

### Measurement

Tokens are counted on the view's JSON bytes, at 3 bytes per token.

| Page | Source | Baseline v2 packet B | View raw B | View JSON B | Tokens |
| --- | --- | --- | --- | --- | --- |
| **everything-store start** | jsdom v2 | 31,757 | **2,791** | 2,985 | 995 |
| **everything-store results (deep)** | jsdom v2 | 354,911 | **13,754** | 14,653 | 4,885 |
| **bigbox start** | jsdom v2 | 119,516 | **5,927** | 6,513 | 2,171 |
| bigbox deep | jsdom v2 | 168,077 | 11,313 | 12,368 | 4,123 |
| auction start / deep | jsdom v2 | 30,884 / 315,963 | 2,737 / 11,542 | 2,900 / 12,631 | 967 / 4,211 |
| company start / deep | jsdom v2 | 27,842 / 13,367 | 3,003 / 1,594 | 3,225 / 1,703 | 1,075 / 568 |
| crossborder start / deep | jsdom v2 | 113,549 / 86,271 | 7,948 / 6,276 | 8,678 / 6,865 | 2,893 / 2,289 |
| job-board start / deep | jsdom v2 | 11,552 / 66,515 | 1,473 / 4,418 | 1,562 / 4,782 | 521 / 1,594 |
| local-classifieds start / deep | jsdom v2 | 64,916 / 72,899 | 2,480 / 2,829 | 2,639 / 3,029 | 880 / 1,010 |
| photo-social start / deep | jsdom v2 | 116,364 / 78,361 | 4,377 / 1,941 | 4,690 / 2,082 | 1,564 / 694 |
| professional-network start / deep | jsdom v2 | 64,986 / 108,128 | 3,774 / 6,007 | 4,085 / 6,464 | 1,362 / 2,155 |
| social-feed start / deep | jsdom v2 | 175,369 / 152,915 | 7,214 / 6,457 | 7,612 / 6,792 | 2,538 / 2,264 |
| **TOTAL, 20 pages** | jsdom v2 | 2,174,142 | **107,855** | 116,258 | 38,759 |
| everything-store start | recorded (fallback) | 32,219 | 3,824 | 4,096 | 1,366 |
| everything-store results | recorded (fallback) | 340,028 | **18,175** | 19,475 | 6,492 |
| bigbox start | recorded (fallback) | 123,146 | 9,502 | 10,188 | 3,396 |

The 20 pages total 107,855 B of view text, 5.0% of the 2,174,142 B baseline. The W1 line-view prototype produced 227,607 B.

**The prototype on the same pages.** I ran `compact-view.mjs` on the v2 pages after sanitizing them:

| Page | Prototype | This view |
| --- | --- | --- |
| everything-store start | 3,369 | 2,791 |
| everything-store results | 22,611 | 13,754 |
| bigbox start | 6,446 | 5,927 |

**Where the two recorded misses come from.** I classified the rendered lines with `<scratch>/t223-w4-attrib.mjs`:

- **Everything-store start: 3,824 B.**
  - 691 B are semantic container lines: footer `li` items whose `text` repeats the link inside them.
  - With `ownText`/`parent`, the container has `ownText ""` and gets no line (F1). Without them the spec prints the duplicate.
  - Without those 691 B, the page would be 3,133 B, under the 3,544 target.
- **Bigbox start: 9,502 B.**

  | Cause | Bytes | Rule |
  | --- | --- | --- |
  | Card `li` lines that hold the whole card's text | 2,151 | F1, via `ownText` |
  | Price fragments such as `$10` and `47` | 474 | F4, which needs `parent` |
  | `covered-by t313` on 39 lines | 544 | none; the prototype printed it too |
  | Screen markers | 492 | see the note |

  Without the F1 and F4 costs, the page would be 6,877 B, under the 7,086 target.

  The marker bytes come from a recorded packet with no viewport. Screen-reader spans at the fold make `onViewport` alternate inside one card, so the zone flips back and forth. That is correct by the spec, but it costs bytes.

### Everything-store results, structured (v2), the first card

The page view's opening lines:

```text
PAGE "Brightaisle.com : wireless earbuds"
URL ~/s?k=wireless+earbuds   (~ = http://127.0.0.1:57000/scenarios/everything-store)
VIEW 1280x720 at the top · 288 elements with visible words or a control, in page order · find_on_page searches the rest
```

The first card:

```text
[main]
- 1/15
t121 "Sponsored"
t122 button "Leave ad feedback"
t123 link ~/sspa/click?ie=UTF8&adId=sp-7Q2K91&url=%2Fscenarios%2Feverything-store%2FPulsebud-Neo-ANC-Wireless-Earbuds-Hybrid-Active-Noise%2Fdp%2FB0DPN4ANC7
t126 "Pulsebud"
t128 h2 link "Pulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise Cancelling Bluetooth 5.4 Headphones, 50H Playtime, App EQ, Black" same href
t132 "4.5"
t134 "4.5 out of 5 stars"
t135 link "8,214 ratings" same href#customer-reviews
t138 link "$39.99" same href
t145 "FREE delivery"
t147 "Thu, Sep 24"
t149 button "Add to cart"
- 2/15
t152 "Sponsored"
t153 button "Leave ad feedback"
t154 link ~/sspa/click?ie=UTF8&adId=sp-3M8XT4&url=...
t157 "Lumo Audio"
t159 h2 link "Lumo Audio Drift Wireless Earbuds, Bluetooth 5.3 Headphones with 60H Playtime, Active Noise Cancelling, IPX7 Waterproof, Rose Gold" same href
```

The same card from the recorded packet, in fallback mode with no `parent` or `ownText`:

```text
t241 link ~/sspa/click?ie=UTF8&adId=sp-7Q2K91&url=...
t244 "Pulsebud"
t245 h2 "Pulsebud Neo ANC Wireless Earbuds, ... Black"
t246 link "Pulsebud Neo ANC Wireless Earbuds, ... Black" same href
t250 "4.5"
t252 "4.5 out of 5 stars"
t253 link "8,214 ratings" same href#customer-reviews
t254 "(8,214)"
t256 link "$39.99" same href
t259 layer covers 1
t260 "$"
t261 "39."
t262 "99"
t263 "FREE delivery"
t264 img "Brightaisle Plus"
t265 "Thu, Sep 24"
t267 button "Add to cart"
```

### The lessons of the format example

| Lesson | Structured (v2) | Fallback (recorded) | End-to-end test |
| --- | --- | --- | --- |
| Title once | Yes. `t128 h2 link`; the img `t124` and span `t129` fold into the link by F1. | No: h2 plus link (F1 needs `parent`). The img alt is dropped by the image rule. | Asserted |
| Price once | Yes: `t138 link "$39.99"` (W1), with the spans folded by F1 | Yes, the link line. The span copies fold by F3. | Asserted |
| No `$`, `39.` or `99` fragments | Yes | No: `t260`–`t262` remain, because F4 needs `parent` | Asserted |
| Label not repeated | Yes: the `Search in` label gets no line, and the select says it once | Yes | Asserted |
| No honeypot | Not checkable: the jsdom layout puts `input[name=field-keywords]` at x=40, so it shows as `t15 field "Search in" =""`. Corpus artefact. | Yes: `t155` at x=-9768 gets no line | Asserted, with a honeypot at x=-9768 |
| `same href` | Yes, including `same href#customer-reviews` and the price's `same href` | Yes | Asserted |

## Not verified

- No live browser, no Lab and no Playwright run, per the brief. Every page is jsdom or a recorded packet.
- The jsdom layout gives empty elements no box. For example, `i role=img "Brightaisle Plus"` is not visible in v2. It also places the honeypot on the page and makes `onViewport` differ from Chrome's, so the zone markers and visibility on the v2 corpus are approximate.
- I did not check that W5's consumers can use `WebLlmPublishedPage` as typed. The view is exported from `page-view/index.ts` but not from `llm-evidence/index.ts`, which is outside my paths.
- I did not check whether Core or any stored Flow keeps `web-state.v2` digests (for example, Flow preconditions). After the bump, an old stored digest no longer equals a new one.

## Open questions or contradictions found

1. **Files outside my list that had to change.** The new keys break two exhaustive records, so I made mechanical one-line additions there:
   - `look-alikes.ts` (`webLlmElementDescription`): `ownText`, `parent` and `hidden` are set to `undefined`, because none of them tells two elements apart.
   - `tests/present.test.ts`: the three keys are named in its exhaustive literal.
2. **`docs/architecture/page-evidence.md:317` still says `web-state.v2`.** It is outside my paths, so the supervisor should update it to `.v3`.
3. **W1 guard, a deviation.** The spec says `X X` and `XX` print as `X`. Taken literally, that turns `2020` into `20`, `11` into `1`, and `Bora Bora` into `Bora`, which drops words. I require `X` to be at least 2 characters, not digits alone, and to contain a space or a non-letter. `$39.99$39.99`, `Add to cart Add to cart` and `4.54.5` still collapse.
4. **Repeat forms, a deviation.**
   - A repeat form is used only when it is shorter than the written target. For example, `~/` stays `~/` rather than becoming `same href`.
   - "The previous link line" means the last link line not written as `same href#fragment`. This is what makes the example's `t253` → `t256` read `same href`.
5. **Image rule, a deviation.** I compare whole words only, so a rating `4` does not swallow the alt `4K screen`. I compare only against non-image lines, so two identical images cannot remove each other.
6. **F4's third condition, an interpretation.** I read "every visible meaningful-text element under A is in the run" as "every line under A". An element that F1 or F3 already folded has no line, and counting it would block exactly the price F4 exists for. A joined line that equals the previous line is then folded as F3 folds any text line.
7. **Kinds not in the spec, my choices.** Role `combobox` and `spinbutton` print as `field`, and `listbox` as `select`. A column header containing a space is quoted: `@"Unit price"`. `VIEW` adds `x=` when the page is scrolled sideways.
8. **Ordering.** F2 (labels) runs after F1 and F3, on the chosen lines. A label folded by F3 is removed either way.
9. **Leftover bytes.** The structured view still prints both `t132 "4.5"` and `t134 "4.5 out of 5 stars"`. No rule folds the first; F4 needs a run of two letterless lines, and this is one. If the supervisor wants it gone, the rule to add would be "a letterless text line whose words begin the next text line of the same parent".
