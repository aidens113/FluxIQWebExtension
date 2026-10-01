# t223-W2: the capture reports ownText, parent and hidden

Worker report for brief t223-W2. Tree: `fxwork/t223/!FluxIQWebExtension`, branch `task/t223-compact-page-view`. Nothing committed. Nothing under `domain/` was touched.

## Outcome

Done, with one caveat on validation. The brief's `pnpm --filter @fluxiq-web-extension/extension test` stopped at its first step, the Core-build staleness guard, because Core's source is newer than its dist. That is not caused by this change. The two steps that follow the guard were run directly, and both pass. Details are under Commands.

## What changed and why

### 1. `ownText`

- New `ownTextBeside(element, text)` in `content/describe-element.ts`. It applies only to the elements whose `text` is all their descendants' words: interactables and semantic text elements, the same branch `describeElement` uses.
- It returns the element's own words through `directVisibleText`, so the sensitive-text rule applies. It returns `""` when the element has no words of its own, and `undefined` when the own words equal `text`.
- It is written only onto descriptors in the snapshot list, from `content/dom-snapshot.ts`. `focusedElement`, action `element` evidence and recorded targets do not get it. That keeps it snapshot-scoped, like `repeatCount`.

### 2. `parent`

- New `content/listed-parents.ts`, `listedParentIndexes(elements)`. For each listed element it walks the composed tree, in this order: assigned slot, then parent element, then the shadow root's host. It returns the index of the nearest listed ancestor, or `undefined` when there is none.
- Frame merge (`background/connection/dom-snapshot.ts`): each frame's block is appended as before. `withParentOffset` adds the block's start offset to `parent`.
  - The first block, and any element without a parent, is passed through as the same object.
  - The function uses `Object.assign`, not a spread, because the file is in `contractSpreadPaths`. A comment says the element is copied whole.
- `translateFrameElements` already spreads the element, so `ownText`, `parent` and `hidden` survive the translation without any change there.

### 3. `includeHidden`

**The walk** (`content/rendered-elements.ts`): `renderedElements(root, { includeHidden })`.

- With the option, the walk enters `[hidden]` and `display:none` subtrees. It also lists `visibility: hidden|collapse` elements and elements with no box (`checkVisibility()` false). All of these appear in composed order, and the returned `hidden` set names them.
- `walked` counts only what the default walk counts, so a search's evidence totals match a look's.
- It still never lists `script`, `style`, `noscript`, `template`, the extension overlays, `html` or `body`.
- It also never lists two things the brief did not name. Both are my decisions; see Open questions.
  - The document `head` (title and meta).
  - `<input type="hidden">`, whose value or attribute is often a CSRF/session token.
- Without the option, the code path is the old one and returns `{ elements, walked }` with no `hidden` key.

**Snapshot assembly** (`content/dom-snapshot.ts`):

- `captureSnapshot(options = {})`.
- Hidden elements are described like any element, with `ownText` and `parent` added, plus `hidden: true`.
- Repeat runs, front layer, lead statements and `pageEvidence` (including the change record kept between captures) see the rendered elements only. This means:
  - a hidden element changes no visible element's descriptor;
  - the evidence is the default capture's;
  - `evidence.elements.returned` counts rendered elements only.

**Parameter path:**

- New `shared/snapshot-capture-options.ts`, `snapshotCaptureOptionsFor(action)`. It reads `action.options.includeHidden === true`, and only for `web.dom.capture_snapshot`.
- The domain's gateway mapping copies every raw parameter into `options` (`domain/src/client/gateway-mapping.ts`, `options: parameters`), so no typed command field is needed.
- Single frame: the content verb (`content/actions/capture-snapshot.ts`) calls `deps.captureSnapshot(snapshotCaptureOptionsFor(action))`. That covers both the unaddressed top-frame look and a look addressed to one frame.
- Merged look:
  - `runtime/look-across-frames.ts` passes the options as a new 4th argument, `capture`, of `MergeFrameSnapshots`.
  - `server-command-channel.ts` hands that argument to `captureMergedTabSnapshot(..., { includeHidden })`.
  - `captureSingleFrameSnapshot` then sends `{ type: "captureSnapshot", includeHidden: true }` to every frame it asks. The flag is added only when set, so every other capture message is unchanged.
  - The seed (the top frame's own capture) already carries the option.
- `content/message-handler.ts` and `captureSnapshotForResponse(options)` pass the flag into the capture.

### 4. Types

- `DomElementDescriptor` gains `ownText?`, `parent?` and `hidden?: true`. All three are added to `UnwiredElementField`, with a doc bullet, because they are snapshot-scoped and not identity.
- `protocol.ts` was at 793 of the 800-line hard limit. I moved the element-descriptor block, unchanged apart from the additions, to the new `shared/dom-element.ts`. That block is `RectDescriptor`, `DomElementDescriptor`, `DomElementContext`, `DomElementIdentitySignal`, `UnwiredElementField`, `WireElementTarget` and `WiredIdentitySignals`.
- `protocol.ts` re-exports every one of those names, so no import changed. It is now 604 lines.
- `ContentActionDependencies.captureSnapshot(options?)`.

### 5. Tests (Node `node:test` with hand-built fakes, the repository's existing pattern)

The extension's test runner has no jsdom. jsdom was used for the corpus proof below.

- `content/tests/rendered-elements.test.ts` (+3):
  - `includeHidden` lists `display:none` and `[hidden]` subtrees, `visibility:hidden` and no-box elements, all flagged and in order;
  - it still excludes script, overlay, head, hidden input, html and body;
  - the default walk equals the hidden walk minus its hidden elements, `walked` is identical, the result keys are exactly `["elements","walked"]`, and `{includeHidden:false}` deep-equals the default.
- `content/tests/listed-parents.test.ts` (new, 4): unlisted ancestors skipped; shadow root to host; slotted child to slot; an unlisted slot passes the child up to the host; nested shadow hosts.
- `content/tests/describe-element.test.ts` (+3): `ownText` on li, p and button, `""` when none; absent when equal to `text` or when the element is not in the descendant-text branch; the sensitive rule holds. `stub-page.ts` gained `hasAttribute`.
- `background/connection/tests/merged-element-structure.test.ts` (new, 5): `parent` offset into the merged list; a seed from a child frame moves the top frame's block; `ownText` and `hidden` cross the merge; `includeHidden` reaches every frame the merge asks, and the plain message is unchanged; a single frame's elements are not copied.
- `runtime/tests/look-across-frames.test.ts` (+1): the merge receives `{includeHidden:true}` only for a literal `true`.
- `shared/tests/snapshot-capture-options.test.ts` (new, 3).

### 6. Corpus v2

**Generator changes.** `make-corpus.ts` hard-coded its output to `t223-corpus`, so it had to change. It now reads:

- `T223_CORPUS_DIR` (default `t223-corpus`);
- `T223_CAPTURE_BUNDLE` (default `capture-bundle.js`);
- `T223_INCLUDE_HIDDEN=1`, which calls the capture with `{includeHidden:true}`.

The originals are kept as `make-corpus.v1.ts`, `make-corpus.v1.mjs` and `capture-bundle.v1.js`. The new capture is `capture-entry-v2.ts` built to `capture-bundle-v2.js` (esbuild iife), and `make-corpus.mjs` was rebuilt.

**Output.** `<scratch>/t223-corpus-v2/` holds the same 20 pages under the same names, plus `_synthesis-manifest.json`. Totals:

- 6498 elements;
- 6425 carry `parent`;
- 762 carry `ownText`, 697 of them `""`;
- 0 `parent` values fail `0 <= parent < own index`.

**Comparison corpora**, in my own scratch directories:

- `t223-w2-hidden/`: the new capture with `includeHidden`, 939 hidden elements across the 20 pages;
- `t223-w2-v1rerun/`: the old bundle run with the current generator.

## Commands run and observed results

- `bash heavy.sh "t223 W2 extension check" pnpm --filter @fluxiq-web-extension/extension check` exited 0 (`{"build-cache":"build","step":"extension:check",...}`). It was re-run after the tests were added and again exited 0 (`"ms":212652`). This covers the src and test tsconfigs.
- `bash heavy.sh "t223 W2 extension test" pnpm --filter @fluxiq-web-extension/extension test` exited 1 at `scripts/check/core-build.mjs`: "FluxIQ Core's build at ...\t223\!FluxIQ is 68 minute(s) behind its source. Stale: ...packages\fluxiq\src\programs\automation-studio\runtime\llm\harness\task-request.ts". I did not rebuild Core, because that is outside my brief and another lane may be editing Core.
- `EXTENSION_TEST_BUILD_LABEL=t223-w2 bash heavy.sh "..." bash -c "node scripts/smoke-test.mjs && node scripts/test-extension.mjs"` (in `apps/extension`) exited 0: `Extension smoke test passed.` and `# tests 1692 # pass 1692 # fail 0 # cancelled 0`. All 20 new tests are listed as `ok`.
- `node scripts/structure-audit.mjs` (repository root): `structure-audit: passed (135 warning(s), 119 baselined).` My files raise these warnings:
  - `describe-element.ts` has 10 exported values, past the advisory threshold of 8; it was 9 before;
  - `background/connection/dom-snapshot.ts` is 478 lines;
  - `shared/protocol.ts` is 604 lines.

  An earlier run, before my change landed, failed only on `domain/src/runtime/llm-evidence/`: 26 files, which is the other worker's directory.
- `node <scratch>/t223-w2-compare.mjs <scratch>` printed `TOTAL {"pages":20,"els":6498,"ownText":762,"ownTextEmpty":697,"parent":6425,"hiddenEls":939,"identicalV1":20,"identicalV1Rerun":20,"hiddenFilterEqual":20,"badParent":0}`. What it checks:
  - **v2 matches v1 byte for byte.** For every page, v2 with `ownText` and `parent` stripped equals both the original `t223-corpus` file and the v1 rerun. So without the option the output is identical to today's apart from the two new fields.
  - **A hidden capture adds only hidden elements.** For every page, the `includeHidden` capture with its hidden elements removed and its parents re-pointed past them equals the v2 default capture exactly, evidence included.

## Not verified

- No browser, Lab or Playwright run, per the brief. Real Chromium `checkVisibility`, `assignedSlot` and closed-shadow behaviour are covered only by fakes and jsdom. jsdom may not implement `checkVisibility`.
- The full `pnpm ... test` script did not pass its Core-staleness guard. Its test steps were run directly.
- Whether the domain accepts the three new fields depends on the other worker. Today the domain's `WebAutomationElementStateInput` does not declare `ownText`, `parent` or `hidden`, nor `repeatCount` or `frontLayer`; they arrive as undeclared runtime properties.
- Whether the domain's action schema for `web.dom.capture_snapshot` refuses an unknown `includeHidden` parameter was not checked. That is domain-owned.

## Open questions or contradictions found

1. **Tests are not jsdom.** The brief says "(jsdom)", but the extension's unit runner is Node with hand-built fakes and has no jsdom dependency. I could not add one, because `package.json` is outside the owned paths. The jsdom proof is the corpus comparison above, which is a scratch script and not a committed test.
2. **What "byte-identical to today" means.** I read it as "identical apart from the new `ownText` and `parent`", because items 1 and 2 add those fields to every capture. Proved on 20 pages.
3. **Two exclusions not in the brief:** the document `head` subtree and `<input type="hidden">`. A display:none `head` would otherwise list title, meta and link. A hidden input's `value`, or its `value` attribute in `attributes`, is usually a token, and the sensitivity rule does not cover it. Other display:none inputs are listed, under the same value rules as visible ones.
4. **A visible element's `parent` can point at a hidden one.** Under `includeHidden`, a visible element may sit inside a `visibility:hidden` or no-box element, which is then listed hidden. Its `parent` is that hidden element, per the definition. A consumer that drops hidden elements must follow `parent` up past them, as the compare script does.
5. **`evidence.elements.returned` counts only rendered elements** in an `includeHidden` capture, so that the evidence matches a look's. The element list is longer than `returned` by the number of hidden elements.
