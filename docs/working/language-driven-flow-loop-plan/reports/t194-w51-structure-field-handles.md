# t194-w51: structure fields carry the page-view handle of their first-item element (run 38, C2)

Worker `t194-w51`, 2026-10-02. Tree `fxwork/t194/!FluxIQWebExtension`, branch `task/t194-live-judge-answer`. Brief:
"Brief: t194-w51" in `reports/t194-lead-1002.md`.

## Outcome

Done. Each field in the `web.detect_repeating_structure` packet (`fields[]`, and `record.fields[]`) now carries
`at: "tNNN"`. That is the handle the model was last shown for the field's element in the list's first item. When any
field has an `at`, the packet adds one domain sentence, `atNote`. No value and no selector is added (D3). A field
whose element cannot be identified gets no `at`; nothing is guessed. The change stays inside
`domain/src/runtime/llm-evidence/structure/**`.

## What changed and why

The handle can be reached from `structure/**` alone, with no wire or extension change:

- The detection's own capture (`page` in `detect.ts`) lists every rendered element. Each element comes with its tag,
  every attribute (`class` included), its `parent`, and its selector, which the binding keeps and never publishes.
  The detection's container selector comes from the same `selectorFor` that writes snapshot selectors, so the
  container is found by an exact selector match.
- The item selector is either `<container> > <compound>` or a single test-id compound. Field selectors take one of
  three forms: a `:scope > a > b` path, a `:scope <compound>` own name, or a `[data-testid="x"]` (`infer-fields.ts`).
  A small reader walks these over the capture's tree.
- The model's handle is found by looking up the element's selector, frame and tag in `context.returned`, the last
  packet shown. That packet carries the stable numbering. The detection capture's own `tN` numbers are positional
  and were never shown.

Files:

- `structure/first-item/compound.ts` (new): tests one compound against an element. It reads a tag, `.class`,
  `[a]`, `[a="v"]` (with escapes), `[a^="v"]`, `:not([class])` and `:nth-of-type(n)`. Any other form returns
  `undefined`, never a guess. Attributes are read as own properties only.
- `structure/first-item/tree.ts` (new): builds the capture's own document as a tree, leaving out child-frame
  elements. An element's `:nth-of-type` position is read from its own selector's last step (`<parent sel> > tag:nth-of-type(n)`,
  or 1 when the step names no position). This avoids miscounting past siblings the page does not render. An
  element with its own anchor gets no position.
- `structure/first-item/chain.ts` (new): reads a field selector the way `item.querySelectorAll` would: `:scope`,
  then steps joined by `>` or a space, or a single unanchored compound. An unanchored chain of several compounds is
  refused.
- `structure/first-item/locate.ts` (new): `webLlmFirstItemHandles(proposal, {detected, shown, frameId})`. The
  container is the one element with that exact selector. The first item is the container's first child that the
  item compound names. A field's element is the item itself (no selector), the `td`/`th` under its header (column
  field), or the single element its selector names in the item. That element's handle comes from the shown packet:
  exactly one element there with the same selector, frame and tag. It returns nothing when no packet was shown, or
  when a top-frame detection's location differs from the shown packet's.
- `structure/first-item/index.ts` (new): the barrel.
- `structure/packet.ts`:
  - `WebLlmStructureField.at?`, `WebLlmRepeatingStructure.atNote?`, `AT_NOTE`.
  - The input gets `firstItem: WebLlmFirstItemPages | undefined`.
  - `readableFields` fills `at` for the run and for the record.
  - `shownField` now builds through `present` so an absent `at` is a missing key.
  - Header paragraph added.
- `structure/detect.ts`: passes `firstItem: { detected: page, shown: context.returned, frameId: element?.frameId }`.
  Header paragraph added.
- Tests:
  - `structure/tests/column-at.test.ts` (new, failing-first). The page has run 38's shape: atomic class paths, own-name
    and positional field selectors. The tests check four things:
    - Every first-request column's `at` equals the handle the page view printed for it. `mutual` points at
      "1 mutual friend", not at Confirm, and the badge column, which is absent from item 1, has no `at`.
    - The handle is the shown one even after a banner renumbers the detection's own capture.
    - With no page shown, the packet's keys are exactly as before.
    - When a different page was shown, there is no `at`.
  - `structure/first-item/tests/chain.test.ts` (new): every selector form, an anchored element under a positional
    step, refused forms, and a prototype-named attribute.
  - `badge-column.test.ts` and `continues.test.ts`: pass `firstItem: undefined`.
  - `detect.test.ts`: `PACKET_KEYS` adds `at` and `atNote`.

## Commands run and observed results

- Failing-first: I copied my `packet.ts` and `detect.ts` to the scratchpad and replaced them with `git show HEAD:`
  versions. Then I ran
  `bash .../heavy.sh "t194-w51 tests" node .../narrow-tests.mjs ".../domain" t194-w51 runtime/llm-evidence/structure`:
  `EXIT 1`, `# tests 27 # pass 25 # fail 2`. Tests 6 and 7 of `column-at.test.ts` fail with `+ {}` against the
  expected `{ age: 't8', ... }`. I copied my versions back, and `git diff --stat` shows them restored (detect.ts +11,
  packet.ts +49 -11).
- After the change, the same command: `EXIT 0`, `narrow: 6 test files`, `# tests 27 # pass 27 # fail 0`.
- Wider narrow run over every directory whose tests drive detection or read the packet: `runtime/llm-evidence/structure`,
  `harness-options`, `node-run`, `plan-resolution`, `state-digest`, `runtime/llm-evidence/tests` and
  `output-nodes/extract-list`. Result: `EXIT 0`, `narrow: 83 test files`, `# tests 538 # pass 538 # fail 0`.
- `bash .../heavy.sh "t194-w51 tsc" npx tsc -p domain/tsconfig.json --noEmit` gave `EXIT 0`, and so did the same
  command with `domain/tsconfig.test.json`. Both ran after the final edit.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (155 warning(s), 118 baselined)`. None of the
  warnings comes from a new file.
- My Python edits had written CRLF into four tracked files, so I normalized every file I touched to LF.
  `git ls-files --eol` now shows `w/lf` for all of them.

## Not verified

- No live run, no provider call and no full suite, as the brief requires. I did not check this against run 38's real
  capture: the run directory keeps the page view (`page.txt`) and the packet, but not the raw snapshot with
  selectors. The test page reproduces that page's class paths and selector forms by hand.
- I have not seen a real model read `at` and `atNote`.

How often `at` will be omitted, by cause:

- **The recovery harness's page-wide detection: always.** `harness-options/execute.ts:205` passes `returned` only
  when the call names a target, so a target-less detection there has no shown packet. Authoring (`tools.ts:455`)
  always passes it.
- **A column that item 1 lacks: by design.** These are partial-coverage columns, such as a badge only some cards
  have, or one the page does not render in item 1.
- **The page changed between the last look and the detection: occasional.** The element's selector, frame or tag
  no longer matches exactly one element in the shown packet. A press re-shows the page, so this should be rare.
- **The page's structure is not represented in the capture: rare.** Any of the following leaves the field without
  an `at`:
  - The container or a path ancestor is not a listed element (`visibility: hidden` wrappers are not listed).
  - A positional step lands on an element that has its own id, test id or name anchor.
  - A class or test-id value was withheld by the secret screen.
  - The header text of a table column differs after screening.
- **Location mismatch: when it happens, every field.** A top-frame detection whose location differs from the
  shown packet's gets no `at` at all.

On run 38's page, given the packet at 0018 and the page view at 0016, I expect all 7 run fields to resolve.

## Open questions or contradictions found

1. The two tool descriptions still list "each field's key, label, kind and coverage". These are `tools.ts:372`
   (authoring) and `harness-options/options.ts:133` (recovery), both outside my ownership. The packet's own
   `atNote` explains `at` in the meantime. Proposed diff, the same in both strings:
   `each field's key, label, kind and coverage` becomes
   `each field's key, label, kind, coverage and at (the handle of that column's element in the first item, whose line in the page view shows what the column holds)`.
2. The recovery path could pass the shown packet for a page-wide detection too, so `at` reaches it.
   `harness-options/execute.ts:205` would change from
   `returned: Object.prototype.hasOwnProperty.call(input.request.value, "target") ? shownPacket(input) : undefined,`
   to a call that passes the shown packet whenever one exists. This needs a non-throwing accessor, because
   `shownPacket` may throw when nothing was shown. I have not checked whether it throws. The target binding must
   keep using it only when a target is named, because `boundTarget` treats `returned` as the packet the target was
   bound through. So this needs a separate context field rather than a change to `returned`.
3. A more robust alternative, not done because it crosses the wire: the page could send, for each proposed field,
   `selectorFor(fieldElementInFirstItem)` (`apps/extension/src/content/extraction/detect-structure.ts` plus
   `domain/src/extraction/structure-detection.ts` `fieldValue`). The domain would then only need the lookup in the
   shown packet, with no selector walking. I chose the domain-only reader because the brief asks for it and its
   failure mode is an omitted `at`, never a wrong one.
4. A field with no selector points at the item element itself. That element may have no line of its own in the page
   view, for example a card `div` with no words. The handle is correct, but the model cannot read anything at it.
   This is minor, because such fields are item-level links or attributes.
