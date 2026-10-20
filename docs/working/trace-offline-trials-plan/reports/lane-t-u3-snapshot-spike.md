# Lane T, U3: page-snapshot fidelity spike (tier 2)

## Outcome

Done. Four realistic sites (job-board, photo-social, social-network-feed, everything-store), two capture methods, all
headed, provider-free. Final run: 4 passed. The sandbox held in all 8 offline loads: no request left, no page script
ran. Every live baseline was non-empty.

Headline: **tier 2 is real for static-at-capture pages when the capture is a DOM serialization served at its original
URL.** On all four sites the extension's own code, run offline on that capture, gave:
- the same page view (every element matched);
- the same list read (every cell equal);
- the same element for every sampled target.

MHTML (`Page.captureSnapshot`, what `chrome.pageCapture` produces) is worse for reads and cannot be loaded as-is:
- Chromium disables script in an MHTML document, and with it every callback of the injected content script.
- Blink rewrites URL attributes to absolute, which breaks reads that match a raw `href`/`src`.
- It drops live form state, and on photo-social it dropped 10 of 82 images.

## What changed and why

All new, under `apps/extension/e2e/content/tests/snapshot-fidelity/tests/` (nothing else touched):

| File | Role |
| --- | --- |
| `snapshot-fidelity.spec.ts` | One test per site: settle, seed form state, warm-up pass, capture A and B, live measurements, close the Lab, reload each capture offline, measure, assert the sandbox, print one `FIDELITY` line (counts and tag names only) |
| `list-pages.ts` | The four list pages and how each is reached (job results; photo home feed; social feed with consent, notifications and chat answered through the Lab, and every post's expand-text button pressed; store search past its browser check) |
| `measure-page.ts` | The three measurements, all through the content script: `captureSnapshot`; `web.dom.extract_list` with the request from the extension's own `detectStructure`; `web.dom.assert exists` on sampled fingerprints (goes through `resolveTarget`). Builds the plan live; offline replays it unchanged |
| `compare-measurements.ts` | Agreement: page-view match by tag/role/accessible name/test id/id/name/href path/input type; field-by-field on matched pairs; read rows, columns, cells; targets by full and landmark-anchored element path |
| `serialize-document.ts` | Capture B, in-page: composed tree, open shadow roots as declarative templates, live form state written into attributes, CSSOM styles; every attribute kept raw; `<link>` stylesheets, same-origin images and same-origin frames carried as resources at their own URLs; scripts and `on*` stripped |
| `unpack-mhtml.ts` | Capture A loader: decodes the archive, serves its HTML at the snapshot URL and its parts from the archive; rewrites `cid:` references to a same-origin path and Blink's `<template shadowmode>` to `shadowrootmode` |
| `offline-capture.ts` | The sandbox. Fresh headed context, `offline: true`. A route answers every request: from the capture, else abort; a navigation the capture cannot answer gets `204`. Document served with CSP `script-src 'none'`. Page-world bundle in the main world, stub plus content bundle in a CDP isolated world. Proofs: request log, leak count, websocket count, `Debugger.scriptParsed`, canaries |
| `arm-capture.ts` | Adds a `<script>` canary and a `<body onload>` canary to each served document |
| `element-path.ts`, `page-census.ts` | In-page helpers: element path (full and anchored); per-category census |

Design decisions forced by what the runs showed:

1. **MHTML cannot be loaded natively.** The content script started (it sent `contentReady` and answered a capture), but
   every callback it registered was refused: a TreeWalker filter (`The provided callback is no longer runnable`),
   timers and listeners. About 280 `Blocked script execution` console lines per load, and `Runtime.evaluate` reported
   the reply promise collected. This held in the main world and in a CDP isolated world. So the archive is unpacked and
   served by the route instead.
2. **Navigations are held with 204.** Offline, a read that presses a load-more link, or meets a frame the capture does
   not hold, falls back to a real navigation, because the page's own script is not there to handle it. An abort put
   Chromium's error page in the frame, and that page's own scripts tripped the "no page script" proof. A 204 leaves the
   document where it is.
3. **Warm-up pass before capture.** On the first passing run the capture was taken before the live read, and live read
   more rows than the capture held: photo 27 against 4, social 34 against 5, store 20 against 15. The read scrolls the
   feed and the page loads more. The final design does a warm-up read, then captures, then measures live, so both
   sides read the same page. The finding is kept below as an evidence-gap category.
4. **Raw attributes.** My first serializer made URLs absolute and inlined images as data URLs. That broke the social
   read's `a[href^="…"]` column (24 rows null) and changed the store's `src` cells, exactly as MHTML does. The capture
   is served at its original URL, so raw relative URLs resolve as they did live.
5. **Social plan.** The read refused `incomplete_text` for one field even after every expand-text button was pressed. Following
   the refusal's own guidance, planning drops a field the read names as collapsed and reads again (1 field dropped).
   The offline replay never drops a field.

## Commands run and observed results

- `node scripts/test-content.mjs -- --headed --workers=1 snapshot-fidelity`, from `apps/extension`. Final run:
  ```
  ok 1 ...snapshot-fidelity.spec.ts:52:3 › job-board: a captured list page reloaded offline, measured against the live page (55.5s)
  ok 2 ...snapshot-fidelity.spec.ts:52:3 › photo-social: ... (2.8m)
  ok 3 ...snapshot-fidelity.spec.ts:52:3 › social-network-feed: ... (3.1m)
  ok 4 ...snapshot-fidelity.spec.ts:52:3 › everything-store: ... (2.9m)
  4 passed (13.7m)
  ```
  Earlier runs failed for the reasons in decisions 1 to 4, each fixed and re-run. One failure was not mine: in 2 of
  about 6 photo-social runs, the live `extract_list` (warm-up, `timeoutMs: 30000`) did not answer within the 4-minute
  test budget. The read is now bounded at 90 s so a stall names itself, and the budget is 7 minutes. That stall did
  not recur in the last two runs.
- `node scripts/structure-audit.mjs` (worktree root): `structure-audit: passed (213 warning(s), 638 baselined).` An
  earlier run failed `statement-packing` on `serialize-document.ts`; fixed.
- `npx tsc --noEmit -p tsconfig.test.json` (apps/extension): exit 0, 0 errors.
- `git status --short`: my only untracked path is `apps/extension/e2e/content/tests/snapshot-fidelity/`. Captures and
  measurements are in the ignored `apps/extension/e2e/test-results/`.

### Sandbox proof, all 8 offline loads

| Check | Result |
| --- | --- |
| Leaked requests (finished without the route serving them) | 0 |
| Websockets | 0 |
| Page scripts parsed | 0 |
| Canary script / `body onload` canary | never ran |
| Content script ready | true |

Requests seen, all answered from the capture:
- MHTML: the document plus 1 to 3 stylesheets, an archived frame on social, and 11 images on the store.
- Serialized document: the document, plus 11 images on the store. Social's unreachable frame was held with a 204.
- Aborted: 0 on every load.

### Agreement (final run; live is the measurement right after capture)

| Site | Method | Page view: live / offline / matched / missing / extra | Read: live / offline rows, columns, cells equal | Targets: sampled / resolved offline / same element | Detection: fields live / offline |
| --- | --- | --- | --- | --- | --- |
| job-board | MHTML | 299 / 299 / 299 / 0 / 0 | 12 / 12, 15, 180 of 180 | 17 / 17 / 17 | 15 / 15 |
| job-board | DOM | 299 / 299 / 299 / 0 / 0 | 12 / 12, 15, 180 of 180 | 17 / 17 / 17 | 15 / 15 |
| photo-social | MHTML | 1331 / 1331 / 1331 / 0 / 0 | 27 / 27, 43, 1127 of 1161 | 15 / 14 / 14 | 44 / 34 |
| photo-social | DOM | 1331 / 1331 / 1331 / 0 / 0 | 27 / 27, 43, 1161 of 1161 | 15 / 15 / 15 | 44 / 44 |
| social-network-feed | MHTML | 1855 / 1855 / 1855 / 0 / 0 | 34 / 34, 54, 1788 of 1836 | 16 / 16 / 16 | 5 / 5 |
| social-network-feed | DOM | 1855 / 1855 / 1855 / 0 / 0 | 34 / 34, 54, 1836 of 1836 | 16 / 16 / 16 | 5 / 5 |
| everything-store | MHTML | 927 / 927 / 927 / 0 / 0 | 20 / 20, 28, 548 of 560 | 20 / 20 / 17 | 28 / 28 |
| everything-store | DOM | 927 / 927 / 927 / 0 / 0 | 20 / 20, 28, 560 of 560 | 20 / 20 / 20 | 28 / 28 |

Notes on the table:
- **Read status.** On photo and social the read's status was `failed` with `web.validation.output_not_observed`, live
  and offline alike, with the rows above returned. Status agrees in all 8 cases.
- **Target categories.** Targets were sampled across row controls, buttons, links and inputs. The offline strategy was
  `fingerprint`, except 4 `scored-candidate` on the store under both methods.
- **MHTML read cells that differ, by column kind and attribute name:**
  - store: `attribute src`, relative live and absolute offline (12);
  - photo: `attribute src` data URL to null (9), `alt` to null (9), `aria-label` changed or null (10), `text` changed (6);
  - social: `text` and `link` columns on an `a[href^=…]` selector, null in 24 rows.
- **MHTML targets.** On the store, 2 buttons and 1 input resolved to a different element; on photo, 1 row control did
  not resolve.

### Sizes and capture time (final run)

| Site | MHTML raw / gzip, capture ms | DOM raw / gzip, capture ms (in-page ms) |
| --- | --- | --- |
| job-board | 31.2 KB / 7.7 KB, 32 | 31.9 KB / 6.7 KB, 24 (6) |
| photo-social | 202.8 KB / 19.3 KB, 665 | 191.9 KB / 13.3 KB, 84 (20) |
| social-network-feed | 220.0 KB / 32.3 KB, 205 | 192.7 KB / 18.1 KB, 108 (26) |
| everything-store | 106.2 KB / 16.0 KB, 281 | 167.0 KB / 78.5 KB in 12 parts (the document plus 11 PNG images), 154 (118) |

The serialized document alone is 7 to 18 KB gzip on these pages. Carried images dominate when present, and PNG
re-encoding through a canvas does not compress. Offline measurement time is close to live: page view 0.3 to 1.7 s,
read 2.1 to 6.0 s.

### What did not survive, by category

| Category | Observed on | MHTML | DOM serialization |
| --- | --- | --- | --- |
| Shadow DOM (open) | job-board 2, store 1 | Survives only after my unpacker rewrites `shadowmode` to `shadowrootmode` | Survives (declarative templates) |
| Custom elements | job-board 2 | Present but not upgraded (defined 2 to 0) | Same; the page view was unaffected |
| Form state (seeded field value, checked box) | job-board, store, social | Lost (census values 1 to 0, checked 1 to 0) | Survives |
| Raw URL attributes | all | Rewritten absolute: breaks `[href^=]`/`src` reads and changes fingerprints | Kept raw |
| Images | photo 82 (data URLs), store 28 | Photo lost 10; store 11 served from the archive | All kept: data URLs untouched, same-origin carried |
| Iframes | social 1 | The archive's frame served | Unreachable live (no document), held with 204 |
| Script-attached listeners (`hasClickHandler`) | all | Lost on 1 to 32 elements per page, which stay listed | Same |
| Fixed and sticky geometry | all | `documentBounds` differ on front-layer elements only (15 to 176 per page) | Same; non-fixed geometry identical |
| Viewport visibility (`isVisibleOnViewport`) | all | Differs on 126 to 390 per page, both directions | Same; likely scroll position, see Not verified |
| Script-rendered rows (feed growth on read) | photo, social, store | A capture holds only the rows rendered at capture time; live read loads more | Same; an evidence gap that tier 2 must detect |
| Load-more or pager navigation during a read | social | Becomes a real navigation offline; held by the sandbox | Same |
| Canvas, fonts, lazy images, closed shadow roots, cross-origin frames | none on these pages | Not exercised | Not exercised |

### Recommendation

- **P2 capture method: in-page DOM serialization plus a resource map** (stylesheets, same-origin images, frame
  documents keyed by URL), served at the original URL. Not MHTML. MHTML needs unpacking anyway, rewrites attributes,
  drops form state and some images, and cannot run extension callbacks when loaded natively.
- **Size per observation:** roughly 7 to 35 KB gzip for the document on these pages, plus images when carried.
  Stylesheets and images repeat across observations of a site, so store them once (the plan's risk note). Carry
  images as their original bytes rather than re-encoded PNG.
- **How much of tier 2 is real:** reads and target re-resolution on what the page had rendered at capture time match
  live exactly, on these four sites. The offline evaluator must:
  - restore the scroll position before viewport-dependent checks;
  - hold navigations;
  - inject the content script in an isolated world;
  - declare evidence gaps for: rows a read would load by scrolling or pressing load-more, listener-detected controls,
    fixed-element geometry, and closed shadow roots, canvas and cross-origin frames.

## Not verified

- A real extension isolated world, and whether `chrome.pageCapture` MHTML loaded in an extension tab blocks a real
  content script's callbacks as it blocked the CDP isolated world here.
- Edge, Firefox (no page capture), and real external sites. The Scenario Lab pages are mostly server-rendered.
- The cause of the viewport-visibility differences. Scroll position is inferred (both directions, geometry otherwise
  equal); the snapshot's `viewport.scrollY` was not recorded in the measurement.
- Canvas, fonts, lazy images, closed shadow roots and cross-origin frames: none occurred on these pages.
- Only the first three sites the brief required plus everything-store; the other six realistic scenarios were not run.

## Open questions or contradictions found

1. **Possible product defect, not mine to fix:** in 2 of about 6 runs, the live photo-social `web.dom.extract_list`
   with `timeoutMs: 30000` did not answer for over 4 minutes. In the passing runs it took 5 to 10 s. Worth a brief for
   whoever owns `content/extraction` (feed scrolling and load-more).
2. On social the read refused `incomplete_text` for a field after every visible expand-text button was pressed. This
   is either a field that truncates without such a button, or a detector false positive. Not investigated.
3. P5's design point: in the extension, where would the offline page run, with a route-equivalent server, a CSP and
   204-held navigations? An offscreen document or a CDP-driven tab are the candidates; the spike used Playwright
   routing.
4. In one run the serialized social page answered a content-world call with the harness global missing. It did not
   recur in three runs. The loader now names the contexts it saw if it happens again.
