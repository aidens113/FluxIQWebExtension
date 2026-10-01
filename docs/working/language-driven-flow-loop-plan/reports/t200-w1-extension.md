# t200-w1-extension report: the extension sends the whole page

Worker `t200-w1-extension`, tree `C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQWebExtension`,
branch `task/t200-model-sees-whole-page`. Nothing was committed.

## Outcome

**Partial.** All of the extension-side work in the brief is done:

- `pnpm --filter @fluxiq-web-extension/extension test` passes.
- `pnpm --filter @fluxiq-web-extension/extension build` passes.
- `node scripts/structure-audit.mjs` passes.

`pnpm --filter @fluxiq-web-extension/extension check` **fails**. The only errors
are in `apps/extension/e2e/content/tests/evidence/tests/{budget,controls}.spec.ts`,
which is outside my ownership:

- Both specs import `WEB_LLM_EVIDENCE_BYTE_BUDGETS` from `@fluxiq-web-extension/domain`.
- `HEAD`'s domain exports that name (`domain/src/runtime/llm-evidence/index.ts:25`).
- The domain worker's working tree deleted `limits.ts` and the export with it.

Every `src/` file type-checks. `tsc -p tsconfig.json` exits 0, and the test
project's only errors are those three e2e lines.

## What changed and why

### Element list (D1, D2): `content/rendered-elements.ts` (new) and `content/dom-snapshot.ts`

`renderedElements()` is one depth-first walk of the composed tree. It uses an
explicit stack, so a 20,000-deep nesting is walked without recursion.

- **Order.** A host comes first, then its open shadow root's children, then the
  light children a slot places. This is the order `composedDocumentOrder`
  already defines. A closed root is described as its host.
- **Pruned with the whole subtree:**
  - `script`, `style`, `noscript` and `template`;
  - `[hidden]`;
  - computed `display:none`;
  - a light child of an open-root host that no slot places (`assignedSlot === null`);
  - the extension's own overlay hosts (`data-fluxiq-picker`, `data-fluxiq-activity`).
- **Walked through but not listed:**
  - `html` and `body`;
  - `visibility: hidden` or `collapse` (a child that sets `visible` again is listed);
  - an element where `checkVisibility()` is false, which covers a closed
    `<details>` body, `content-visibility:hidden` and SVG defs. Two exceptions
    are still listed: `display:contents` elements and `<area>`.
- **Listed:** everything else, including `aria-hidden`, `opacity:0`, sub-2px and
  nameless elements.

`dom-snapshot.ts` now describes every listed element in that order. These are
deleted:

- `MAX_SNAPSHOT_CANDIDATES`, `MAX_SNAPSHOT_SCAN_ELEMENTS`;
- the allow-list gathering passes;
- `shouldIncludeSnapshotElement`, the buckets and `elementPriority`;
- the follower sort, lead-statement promotion and front-layer promotion;
- the `href` deletion (`repeatsTheDocumentAddress`).

`repeatCount` stays, as an annotation on each run's exemplar, and moves nothing.
For the selection, the 2,000-character cut and the `MAX_SELECTION_SCAN`
withholding are removed. All three sensitivity questions are kept, and every
candidate control is asked.

### Per element (D3, D5)

**`describe-element.ts`** no longer cuts text or `visibleText` (was 500), the
value (was 2,000), the options (was 20), or option values, labels and
`selectedValue` (were 200). A selection past the 20th option is now reported.

**`content/descriptor-attributes.ts`** (new) is the attribute reader:

- It sends every attribute, in source order, uncut. It builds the record with
  `Object.fromEntries`, so an attribute named `__proto__` is kept as an attribute.
- It withholds `value`, `checked`, `selected`, `label`, `aria-valuenow` and
  `aria-valuetext` on an element that is, or sits inside, a sensitive control
  (`isWithinSensitiveControl`).
- It withholds a text control's `value` attribute while `captureSettings.inputValues`
  is off. React mirrors the live value into that attribute. Button-type inputs
  keep theirs.

**Identity:** a new `identity/normalized-text.ts` holds the uncut rule.
`bounded-text.ts` is now only for failure-message quotes and For Each row values.
These no longer cut text:

| File | Cuts removed |
| --- | --- |
| `accessible-name.ts` | 200 |
| `label.ts` | 200, and the nearby-label 80 (the nearby label is now whole) |
| `context.ts` | 200 on the form attributes, legend, heading and landmark name |
| `stable-name.ts` | 200, kept consistent with the accessible name |
| `candidates.ts` | 200 on the resolver's `visibleText` signal, so it matches the uncut descriptor |

`record.ts` no longer cuts the record key (120) or text (160).
`agreesWithRecordedRecord` still accepts a pre-t200 recording: a recorded value
exactly 160 (text) or 120 (key) characters long matches when the live whole
value begins with it (`sameAsRecorded`). Without this, existing Flows would
fail closed on long rows.

### Evidence (`content/evidence/*`)

- **Open shadow roots:** `dialogs`, `regions`, `repeating`, `loading` and `forms`
  now query through them with `shadow-dom/query-in-order.ts` (new,
  `queryComposedInOrder`), in composed document order. `forms` no longer uses
  `document.forms`.
- **Caps and cuts removed:**
  - dialogs 5;
  - regions 20;
  - repeating: scan 2,000, biggest 6, fields 8, text 160;
  - loading: 8 indicators, 8 busy regions, label 120;
  - forms: 8 forms, 30 controls, text 200, autocomplete 16 tokens / 64 characters;
  - navigation: URL and referrer 2,000.
- **Order changes:**
  - Repeating runs are in order of their first item, not biggest-first.
  - Loading indicators are in document order, not grouped by kind.
- **Overlays:**
  - Every interactable element with a nonzero box in the viewport is
    hit-tested. The 40-candidate cap is gone, and a sub-2px element now has a
    hit point.
  - The 12-level ancestor walk is gone: the blocker named is the outermost
    ancestor that does not contain the target.
  - Every blocker is reported, sorted into composed document order, not
    most-blocking-first cut to 5. Every blocked control is reported, not 5.
- **Sensitivity gaps closed:** `repeating.ts` (representative text) and
  `loading.ts` (status words and label) read raw `textContent` before. They now
  read `textOutsideSensitiveControls`.
- **Deleted**, because they fed only the ranking:
  - `lead-statements.ts` and its test;
  - `link-address.ts`;
  - `isPageStateControl`, `isFrontLayer`, `isSiteChrome` and
    `addressesThisDocument` from `controls.ts`, which keeps only
    `isDrawnControl` (used by `covering-layer.ts`);
  - the now-unused `isPageControlElement`, `isPrimaryControlElement` and
    `hasVisualMedia` from `element-traits.ts`.

### Shadow roots

`shadow-dom/composed-roots.ts` has no 500-root or 50,000-element cap in
`composedRoots` and `openRootsWithin` any more.

### Background merge: `background/connection/dom-snapshot.ts`

- **Caps removed:** `MAX_MERGED_ELEMENTS` (4,000), every `MAX_MERGED_*`
  evidence cap, and the blocker sort-and-cut. `returned` is the plain sum;
  `truncated` is only what a frame said.
- **Frame reads.** The top frame is read once, beside the frame list, and not at
  all when the seed is the top frame. Every other listed frame is read in
  parallel.
- **Element order:** seed first (pinned by `recording-evidence.test.ts`), then
  the top frame, then frames in the order the browser lists them. It was
  answer order, which is nondeterministic.
- **Unanswered frames.** A listed child frame with no snapshot when the wait
  ends goes in `evidence.unansweredFrameIds`, deduplicated, and only when
  non-empty.
- **Frame wait:** `FRAME_SNAPSHOT_WAIT_MS = 10_000`, up from 150. The reasons:
  - 150 ms was sized for 2,000 ranked elements. A full-frame capture describes
    every element with selector, name, label and context, so a large frame
    needs far longer.
  - 10 s still leaves the look inside Core's 30 s default command wait
    (`client-gateway/service/config.ts:21`, used when a command sends no
    `timeoutMs`), after the top frame's own capture.
  - A frame with no listener is refused at once by Chrome, so it does not wait.
  - A caller with a deadline passes `{ waitMs }`.
  - This number is not measured on a real page (see "Not verified").

### The look (D9): `runtime/look-across-frames.ts` (new)

When `web.dom.capture_snapshot` names no frame (no `frameId`, no frame URL
path) and succeeds, its snapshot is replaced by the all-frames merge. The top
frame's capture is the seed. Child elements are addressed exactly as the merge
does today: `frame[<id>] >> selector`, plus a `data-fluxiq-frame-id` attribute.

The merge is injected, not imported. `server-command-channel.ts` passes
`captureMergedTabSnapshot` bound to `sendToTab` and `allTabFrames` through
`ExtensionRuntimeCommandRouterOptions.mergeFrameSnapshots` →
`BrowserActionRunRequest`. This is because `background/connection` imports
`runtime`, so the reverse import would close a cycle.

A look with its own `timeoutMs` lends the merge what is left of it. This
matters because the domain host runtime sends `timeoutMs: 5_000`
(`domain/src/runtime/host-runtime.ts:72`). A look addressed to a frame is
unchanged.

### Manifests

Both content-script entries in both manifests now have `"match_about_blank": true`.
The Chrome entries also have `"match_origin_as_fallback": true`. The shipped
manifests still pass their verification test.

### Comments

Comments that described ranking or bounds were rewritten in:

- `capture-settings.ts`, `event-elements.ts`, `evidence/changes.ts`,
  `evidence/index.ts`;
- `repeat-exemplars.ts`, `identity/candidates.ts`, `identity/record.ts`;
- `describe-element.ts`, `shared/protocol.ts` (`repeatCount` and `truncated`
  docs), `action-runtime/in-place-effect.ts`.

### Tests

**Updated:**

- `background/connection/tests/dom-snapshot.test.ts`: the cap tests are
  replaced.
- `background/connection/tests/recording-evidence.test.ts`: the round-trip
  counts dropped by one per merge (1→0, 3→2, 6→4, 2→1), because the top frame
  is no longer read twice.
- `content/evidence/tests/forms.test.ts`: the stub answers `querySelectorAll("form")`
  and defines `HTMLFormElement`, and a no-cap row is added.
- `content/tests/stub-page.ts`: adds `attributes` and input attributes.
- `content/tests/repeat-exemplars.test.ts`: a comment.

**Added:**

- `content/tests/rendered-elements.test.ts`, 8 rows:
  - composed order across shadow roots and slots;
  - what is pruned;
  - aria-hidden, transparent, tiny and nameless elements are listed;
  - visibility;
  - boxless elements;
  - html and body;
  - 10,000 rows uncapped;
  - 20,000-deep nesting.
- `content/tests/descriptor-attributes.test.ts`, 5 rows:
  - every attribute in order, including a 10,000-character value;
  - no attributes gives `undefined`;
  - `__proto__`;
  - sensitive held values withheld;
  - `inputValues` off.
- `content/tests/describe-element.test.ts`, 3 rows:
  - 10,000-character text uncut;
  - 5,000-character value uncut;
  - 60 options with 300-character values and labels, and selection at index 45.
- `background/connection/tests/dom-snapshot.test.ts`, 7 rows:
  - 5,500 merged elements survive in exact order;
  - no truncation;
  - frame-list order, not answer order;
  - every evidence collection whole, and blockers in frame order;
  - an unanswered frame is named;
  - a slow frame is named, and the wait is honoured;
  - a top seed is not re-read.
- `runtime/tests/look-across-frames.test.ts`, 5 rows.

### Wire fields whose shape or meaning changed (extension → domain)

**On each `DomElementDescriptor`:**

- `text` and `visibleText`: whole (was 500).
- `value`: whole (was 2,000).
- `options`: every option, values and labels whole (was 20 × 200 characters).
  `selectedValue` is whole and set for any option.
- `attributes`: still a keyed record, but now **every** attribute in source
  order, whole. It was a 25-name allow-list at 500 characters. Held-value
  attributes are withheld on sensitive controls, and a text control's `value`
  is withheld while `inputValues` is off. It can now carry names the domain
  denies, such as `headers` and `selector` (see D4).
- `href`: no longer deleted when it repeats the document address.
- These are now whole: `accessibleName`, `label` (including the nearby label,
  was 80), and `context.formId`, `formName`, `formAction`, `fieldsetLegend`,
  `landmarkName` and `heading`.
- `context.record.key` (was 120) and `context.record.text` (was 160) are whole.
- `repeatCount`: an annotation only. Followers keep their document position and
  are no longer ranked last.

**On `DomSnapshot`:**

- `interactiveElements`: every rendered element in composed document order.
  This now includes non-interactive and nameless elements, `aria-hidden`,
  `opacity:0`, SVG internals, `<br>` and so on. It was ranked, filtered, and
  capped at 2,000 per frame and 4,000 merged.
  - Sub-2px elements are now present but carry no `bounds`/`documentBounds`,
    because `visual-bounds.ts` still returns nothing under 2 px.
- `selectedText`: whole, and no longer withheld on pages with more than 2,000
  form controls.

**On `evidence.elements`:**

- `scanned` = `candidates` = elements the walk visited.
- `matched` = `returned` = elements listed.
- `truncated` is never set by a capture or by the merge.

**Other evidence:**

- `evidence.dialogs.open`: all of them, from open shadow roots too. Still
  top-most-first (reverse document order).
- `evidence.overlays`:
  - `tested` covers every interactable in-viewport element.
  - `blockers` are **in document order, all of them**. The contract comment
    "most-blocking first; the first is the top-most" is now stale.
  - `blocked` lists all covered controls; the "capped" comment is stale.
  - The blocker named may be a higher ancestor, because the 12-level walk is
    gone.
- `evidence.loading`:
  - `busyRegions` and `indicators` are all included, in document order, from
    shadow roots too.
  - An indicator's `label` is whole.
  - The status-word test and the label are sensitivity-filtered.
- `evidence.regions`: all of them, from shadow roots too.
- `evidence.repeating`:
  - every run, ordered by where its first item is (was biggest-first, 6);
  - `fields` all (was 8);
  - `representative.text` whole and sensitivity-filtered (was 160 of raw
    `textContent`).
- `evidence.forms`:
  - every form, from shadow roots too (was 8);
  - `controls` all (was 30; `controlCount` now equals its length);
  - `name`, `action` and `method` whole;
  - `autocomplete` all tokens, each whole.
- `evidence.navigation.url` and `referrer`: whole (were 2,000).
- `evidence.unansweredFrameIds`: **new**, written only by the frame merge.

**The look and the merge:**

- The look (`web.dom.capture_snapshot` with no addressed frame) now returns the
  **merged all-frames snapshot**; it used to be the top frame only.
- The merged element order is seed, then top, then frames in browser-list
  order. It used to be answer order.
- about:blank and srcdoc frames now run the content script.

## Commands run and observed results

All four were run from the tree root.

1. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 ext check" pnpm --filter @fluxiq-web-extension/extension check`
   → **exit 1**. The only errors printed:
   ```
   e2e/content/tests/evidence/tests/budget.spec.ts(31,34): error TS2305: Module '"@fluxiq-web-extension/domain"' has no exported member 'WEB_LLM_EVIDENCE_BYTE_BUDGETS'.
   e2e/content/tests/evidence/tests/controls.spec.ts(26,34): error TS2305: Module '"@fluxiq-web-extension/domain"' has no exported member 'WEB_LLM_EVIDENCE_BYTE_BUDGETS'.
   e2e/content/tests/evidence/tests/controls.spec.ts(111,28): error TS2339: Property 'blocks' does not exist on type 'WebLlmEvidenceBlocker[]'.
   ```
   An earlier run also showed `domain/src/runtime/llm-evidence/node-run/run.ts`
   errors. They were gone on the re-run, because the domain worker was mid-edit.
   Separately, `node -e` running `tsc -p tsconfig.json --noEmit` from
   `apps/extension` exited 0.
2. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 ext test" env EXTENSION_TEST_BUILD_LABEL=t200-ext pnpm --filter @fluxiq-web-extension/extension test`
   → exit 0: `Extension smoke test passed.`, `# tests 1472`, `# pass 1472`,
   `# fail 0`. The first run had 3 failures, all round-trip counts in
   `recording-evidence.test.ts`, which were updated as described above.
3. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 ext build" pnpm --filter @fluxiq-web-extension/extension build`
   → exit 0. It printed `build\content\index.js 597.9kb`, then
   `extension build: chrome: verified 22 files`,
   `firefox: verified 22 files` and `e2e-chromium: verified 22 files`.
4. `node scripts/structure-audit.mjs`
   → `structure-audit: passed (129 warning(s), 119 baselined).` and
   `1 baseline entries can be lowered. Run "pnpm structure:baseline"`.
   An earlier run failed on the naming rule (three `element-*` files and three
   `composed-*` files). I fixed that by naming the new files
   `descriptor-attributes.ts` and `shadow-dom/query-in-order.ts`.

## Not verified

- **No browser run of any kind**, as the brief required. So:
  - the real-Chromium behaviour of `renderedElements` is unverified: computed
    style, `checkVisibility`, `assignedSlot`, closed `<details>`, unslotted
    children of closed roots;
  - so is the hit test on the whole page;
  - so is `match_about_blank` / `match_origin_as_fallback` injection;
  - so is the merged look end to end through Core.
- **Capture time and payload size on a large page are unmeasured.** Every
  rendered element now gets `describeElement`: selector, xpath, accessible
  name, label, context and record walk, plus a `getComputedStyle` call. Also,
  `isInteractableUiElement` in the overlay pass reads `cursor` per element.
  Consequences:
  - Every action result that carries a snapshot now describes the whole page
    (`content/action-runtime/results.ts:464`, every verb in `content/actions/*`).
  - The domain host runtime's state capture waits 5 s
    (`HOST_STATE_COMMAND_TIMEOUT_MS`). A large page may not fit in that.
  - The 10 s frame wait is a reasoned choice, not a measured one.
  - The lead's measurement worker should time the capture on the realistic
    scenarios.
- The Playwright content specs under `apps/extension/e2e/` were neither run nor
  edited. They are not in my ownership. Several almost certainly assert the old
  ranking, caps or filters:
  - `e2e/content/tests/evidence/tests/budget.spec.ts`, `controls.spec.ts`,
    `page-evidence.spec.ts`;
  - `repeat-exemplars.spec.ts`, `frames.spec.ts`, `selection-redaction.spec.ts`;
  - possibly `large-page-resolution.spec.ts` and `shadow-roots/**`.

## Open questions or contradictions found

1. **`pnpm check` is red on `e2e/` specs** because the domain worker removed
   `WEB_LLM_EVIDENCE_BYTE_BUDGETS` and changed the blocker type. Someone who
   owns `apps/extension/e2e/**` must update or delete `budget.spec.ts` and
   `controls.spec.ts`; the latter tests the removed ranking.
2. **Domain contract comments are now stale.** They live in
   `domain/src/page-evidence/types.ts`, which I was told not to edit:
   - `WebAutomationOverlayEvidence.blockers` says "most-blocking first";
   - `WebAutomationOverlayEvidenceItem.blocked` says "capped";
   - `WebAutomationFormEvidence.controlCount` says "before the per-form cap";
   - the `WebAutomationSnapshotElementTotals` text describes a cap.
3. **Search bounds and non-packet bounds kept**, as the brief allows:
   - `accessible-name.ts`: 8 labelledby ids.
   - `label.ts`: 4 associated labels, 4 preceding siblings, 40 text parts,
     depth 8.
   - `context.ts`: landmark depth 30, heading levels 10, heading siblings 12,
     subtree queries 24, labelledby 8.
   - `record.ts`:
     - depth 12;
     - 400 nodes, which also bounds how much record text is read;
     - For Each row matching (`MAX_ROW_TEXT` 4,000, `MAX_ROW_NODES` 2,000,
       `MAX_ROW_VALUE` 200, which mirrors the domain's cut).
   - `repeat-exemplars.ts`: record depth 12.
   - `event-elements.ts`: remembered-touch queue of 500. It is no longer a
     ranking input.
   - `selector/shadow/element-from-point.ts`: shadow depth 16.
   - `identity/candidates.ts`: resolver pool, 5,000 scanned and 60 scored. This
     is not the packet.
   - `evidence/changes.ts`: fingerprint text 120. It is memory only.
4. **Failure-text caps not touched.** They are not in the brief's Do list, and
   some mirror a Core parser limit:
   - `resolve-target.ts`: 5 named candidates;
   - `reportable-text.ts`: 40-character labels;
   - `covering-layer.ts`;
   - `actions/select.ts`: 20 options on failure;
   - `validation-outcome.ts` and `shared/dialog-channel.ts`: 1,024, the latter
     also cutting native dialog `message` in `evidence.dialogs.lastNative`;
   - `runtime-status.ts`: 80.

   Say whether they should go too.
5. **Kept as evidence rules, not packet filters:**
   - `loading.ts` `isPainted` and `dialogs.ts` `isShown` still ignore
     `aria-hidden`, `opacity:0` and under-1px elements when deciding what
     *counts as* a loading indicator or an open dialog. Those elements are
     still in the element list.
   - `visual-bounds.ts` still gives no bounds under 2 px. It is shared with the
     action runtime, and changing it would change click targeting.
6. **The gateway `capture_snapshot` command path is not merged.** This is
   `RecordingEvidenceReporter.captureActiveSnapshot` → `client.snapshot`. It
   still sends to the tab without a frame, so the first responder wins. Only
   the `web.dom.capture_snapshot` action (the look) is merged. Say whether that
   path should merge too.
7. **Child frames that lost their script are not re-injected before the look's
   merge.** This happens after an extension reload. Such frames appear in
   `unansweredFrameIds` rather than being re-injected.
8. **Slot placement.** A slotted light child is listed after its host's whole
   shadow tree, not at its slot's position, matching `composedDocumentOrder`.
   A true flat-tree order would interleave it.
9. **Structure baseline.** The audit reports one baseline entry that can be
   lowered. I did not run `pnpm structure:baseline`, because
   `.structure-baseline.json` is not mine.
10. **Firefox `match_origin_as_fallback`.** The brief said Chrome only, so
    Firefox does not have it, although Firefox's `strict_min_version` of 128
    supports it.
