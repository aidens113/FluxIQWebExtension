# Lane T, P2 E1: the content-script page capture

## Outcome

Done. The top frame now answers `TRACE_PAGE_CAPTURE_MESSAGE` with a `TracePageCaptureResponse`. The answer is the page
serialized in one synchronous pass, plus its same-origin resources as their original bytes. Sensitive values are
withheld by the rule the action results use. All checks were run and their output read:

- 28 of 28 unit tests pass.
- The headed harness spec passed on job-board and everything-store, twice in a row. Reloaded offline, the capture
  agreed exactly with the live page on all three measures: page view, list read and sampled targets.
- Both typechecks are clean, and the structure audit passes.

The shared contract (`shared/trace-page-capture.ts`) was not changed. One reading of it needs the lead's confirmation:
see Open questions 1.

## What changed and why

New: `apps/extension/src/content/trace-capture/`. Each file has one export, and the directory has a barrel.

| File | Role |
| --- | --- |
| `index.ts` | Barrel: `captureTracePage`, `TRACE_CAPTURE_BOUNDS`, type `TraceCaptureBounds` |
| `capture-page.ts` | Entry point. It serializes the page, then carries the resources. It never rejects. A failure answers `ok: false` with a reason that names the stage and the error's kind, never the error's message (which can quote the page) |
| `serialize-document.ts` | The spike's serializer, productionized (details below) |
| `element-markup-state.ts` | The attributes an element is written with, plus the live text of a `<textarea>`. Handlers are stripped. Raw attributes come through `elementAttributes` (`descriptor-attributes.ts`), so held values are withheld by the existing rule. Live state (`value`, `checked`, `selected`, textarea text) is written only where `readElementValue` or `checkedState` would read it: never inside a sensitive control, never for a file input, and a typed value only while `captureSettings.inputValues` is on |
| `read-stylesheet.ts` | A stylesheet's rules as the CSSOM holds them, plus its `@import` addresses (followed recursively, at most 8 deep). A sheet that throws `SecurityError` or `InvalidAccessError` answers `null`; any other error is rethrown |
| `same-origin-address.ts` | Carries only http(s) addresses of the top document's origin |
| `fetch-resource-bytes.ts` | Fetches the original bytes: `credentials: same-origin`, `cache: force-cache`. A declared `content-length` past the bound is refused, and a streamed body is abandoned once it passes the bound. The server's `content-type` is kept. Each outcome is reported as `status`, `too-large`, `timeout` or `failed`; it never rejects |
| `carry-resources.ts` | Fetches with a pool of workers, applies the per-resource and total byte bounds and a deadline, and returns base64 in document order. Each resource left out is counted |
| `bytes-to-base64.ts` | Converts bytes to base64 in slices |
| `capture-bounds.ts` | Named bounds: 4 MiB per resource, 16 MiB total, 5 s per fetch, 15 s overall, 6 concurrent fetches. The comment explains why: Chrome's 64 MiB message limit and Core's 20 MB object limit |
| `types.ts` | Internal types (references, collector, bounds, fetcher) |

What the serializer does, and how it differs from the spike:

**Kept from the spike:**
- The composed tree.
- Open shadow roots as `<template shadowrootmode>`, now also writing `delegatesfocus`, `clonable` and `serializable`.
- `<style>` elements written from the CSSOM.
- Raw attributes in source order.
- `script` and `noscript` dropped.

**Added:**
- `<script>` is dropped in every namespace, including SVG.
- A `<link>` is dropped if it is `modulepreload`, or if it is `preload` or `prefetch` with a script `as` value.
- A frame's `srcdoc` that the serializer did not write is dropped, because it could hold a script.
- A `<template>`'s content is serialized by the same rules instead of copied as raw `innerHTML`.
- The doctype keeps its public and system ids.
- Adopted stylesheets go at the end of `<head>` and at the end of each shadow root, where the cascade puts them.
- Raw-text elements are not escaped.
- A leading newline in `pre`, `listing` and `textarea` is preserved.

**Sensitivity:**
- `within` (inside a control that `isSensitiveFormControl` marks) is carried down the tree.
- Text inside such a control is dropped. This covers a sensitive textarea, the option labels of a sensitive select, and
  the words in a `data-sensitive` region.
- A sensitive element's shadow root and any frame inside it are not written at all, because neither rule can see
  across into them.

**Resources:**
- Carried: `<link rel=stylesheet>` (original bytes), each `@import` they name, `img` at its `currentSrc`, and
  same-origin frame documents.
- A frame document is serialized by the same pass, not fetched. A fetched one would bring its scripts and lose its live
  form state.
- An `about:` frame that has content goes into `srcdoc`.
- Counted in `unavailable`: cross-origin, `blob:`, failed, timed-out, over-bound and past-deadline resources. Each
  address is counted once.

Modified: `apps/extension/src/content/message-handler.ts`.
- A new branch answers `TRACE_PAGE_CAPTURE_MESSAGE` only when `isTopFrame()` and `isAddressedToThisFrame(typed)` both
  hold.
- It keeps the channel open (`return true`) and always answers. A defensive rejection handler answers `ok: false`.
- The header comment documents the message.

New: `apps/extension/e2e/content/tests/trace-capture/tests/trace-capture.spec.ts`. It reuses the spike's helpers by
import (`list-pages`, `measure-page`, `compare-measurements`, `offline-capture`, `arm-capture`) and runs on job-board
and everything-store. Each run does the following:

1. Seeds a visible text field. Adds a hidden form of sensitive controls: a password with a token in both its value
   attribute and its live value, a `cc-number` field, a `data-sensitive` textarea (markup and live value), and a
   `data-sensitive` text region. Each holds a per-run synthetic token.
2. Runs a warm-up measurement.
3. Sends the message addressed to frame 3 and asserts that it is not answered.
4. Sends the message addressed to frame 0 and asserts `ok`.
5. Parses the capture with `DOMParser`, walking template contents too, and asserts no `<script>` and no `on*`
   attribute.
6. Asserts that no token appears in the document or in any decoded resource, and that every resource is same-origin.
7. Measures live, closes the Lab, and serves the capture in the spike's sandbox.
8. Asserts the sandbox held and that the three measures agree exactly.
9. Prints one `TRACE_CAPTURE` line of counts and sizes only.

## Commands run and observed results

All were run in the t736 worktree.

- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit`: no output, 0 errors (run after
  the message-handler change).
- `npx tsc --noEmit -p tsconfig.test.json` (apps/extension): no output, 0 errors (final run, after the stub refactor).
- `EXTENSION_TEST_BUILD_LABEL=t736-e1 node scripts/test-extension.mjs src/content/trace-capture/tests` (final):
  `# tests 28`, `# pass 28`, `# fail 0`. On the first run 27 passed; my expected string had left out the `@import`
  line that the stub sheet emits. I fixed the test, not the code.
- `node scripts/test-content.mjs -- --headed --workers=1 trace-capture` (apps/extension), run twice and passing both
  times:
  ```
  ok 1 ...trace-capture.spec.ts:96:3 › job-board: the trace page capture reloads offline to the live page view, read and targets (22.0s)
  ok 2 ...trace-capture.spec.ts:96:3 › everything-store: ... (1.1m)
  2 passed (2.1m)
  ```
  The second run: 22.2 s and 58.4 s, `2 passed (2.6m)`.
- `node scripts/structure-audit.mjs` (worktree root):
  - final: `structure-audit: passed (212 warning(s), 618 baselined).`, with no warning on any of my files.
  - first run: 2 `exported-values` failures on the test stub (12 exported classes). I fixed this by making the classes
    type-only exports.

Measured results (counts and sizes only):

| Site | Capture ms (run 1 / run 2) | Document raw / gzip | Elements, shadow templates | Resources carried | Unavailable | Page view matched / live | Read cells equal | Targets same / sampled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| job-board | 30 / 25 | 32,067 B / 6,808 B | 351, 2 | 0 | 0 | 299 / 299 | 180 / 180 (12 rows, 15 cols) | 17 / 17 |
| everything-store | 133 / 182 | 90,757 B / 12,185 B | 1,074, 1 | 11 `image/svg+xml`, 3,349 B in total | 0 | 927 / 927 | 560 / 560 (20 rows, 28 cols) | 20 / 20 (16 fingerprint, 4 scored-candidate) |

Other observations:

- **Read status:** `succeeded` both live and offline on both sites.
- **Sandbox:**
  - 0 leaked requests, 0 websockets, 0 page scripts parsed, and neither canary ran.
  - On the store, 11 image requests were all answered from the capture's resources.
  - Nothing was aborted, and no navigation was held.
- **Field disagreements in matched pairs** (reported, not asserted). These are the same categories the spike recorded:
  - viewport visibility: 126 on job-board, 389 on the store;
  - geometry over 2 px: 44 and 15;
  - `hasClickHandler`: 8 and 32.
- **Image size:** carrying original bytes made the store's images about 3.3 KB in total. The spike's canvas PNGs were
  about 72 KB.
- **Capture time:** the "capture ms" column is the time from sending the message to the reply, including Playwright's
  evaluate overhead.

## Not verified

- **A real extension context.** The harness runs the content script in the page's main world with a runtime stub. Not
  exercised:
  - Chrome's isolated world;
  - a content-script `fetch` under a real MV3 extension (which uses page-origin credentials);
  - `chrome.tabs.sendMessage` message-size behaviour for a large reply.
- **Paths not reached by these two pages:**
  - job-board and the store carry no `<link>` stylesheet, so the fetched-stylesheet and `@import` paths are covered
    only by unit tests;
  - the same goes for same-origin frames, the `srcdoc` path and adopted stylesheets;
  - the byte bounds and the deadline were never reached live.
- **The checkbox seed.** It found no visible unchecked checkbox on either page (`checkboxes: 0`), so live checked state
  was proven only by unit tests.
- **Firefox and Edge.**
- **The other eight realistic scenarios.**
- **Resources outside this brief's three kinds** are neither carried nor counted in `unavailable`: CSS `url()` fonts and
  backgrounds, `<video poster>`, `<input type=image>`, SVG `<image>` and `<use>`. Offline they are aborted by the
  sandbox, and the store run showed `aborted: 0`.

## Open questions or contradictions found

1. **The `source` key.** The contract says "The address the document uses for it, unchanged". I key each resource by
   the absolute address the browser requests:
   - `link.href` for a stylesheet;
   - `img.currentSrc` for an image;
   - the frame's resolved `src` for a frame, or its document's URL when it has no http(s) `src`;
   - absolute `@import` addresses.

   The raw relative attributes stay unchanged in the HTML. This is what the sandbox (and any server-at-original-URL)
   needs, and it is unambiguous across frames and `<base>`. A raw relative key would have to be resolved by the
   consumer against the right base. If the lead meant the raw attribute value, the contract comment or the key needs
   to change.
2. **Frame documents.** The brief groups "same-origin frame documents" with resources carried "as their original
   bytes". I serialize them by the same pass instead. A fetched frame document would carry its scripts, its unscrubbed
   sensitive values and its markup defaults, where the live document has the current form state. This matches the
   spike. The lead should confirm.
3. **Input-value capture.** `captureSettings.inputValues` is honoured, as the action results honour it: with it off, a
   typed value and a textarea's text are withheld, which makes the trace's form state less faithful. It defaults to
   on. The lead should confirm that traces should follow the person's capture setting.
4. **Inline handler URLs.** `href="javascript:..."` is kept raw, so reads that match `href` still match. It cannot run
   under the sandbox's `script-src 'none'`. Any consumer that serves a capture without that CSP must add it.
