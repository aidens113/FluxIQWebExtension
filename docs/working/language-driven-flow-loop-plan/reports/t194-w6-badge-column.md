# t194-w6: an icon-only badge is a column the model can name and filter on

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`, branch
`task/t194-live-judge-answer`. Nothing committed.

## Outcome

**Done.** Detection now offers an element with no words but an accessible name as a
column. When every item that has the badge (at least two) gives it the same name, the
column is labelled by that name and keyed from it (`Brightaisle Plus` / `brightaisle_plus`).
It reads the naming attribute and is `required: false`. The column reaches the model
through the unchanged structure projection. `where {field: "brightaisle_plus", is: "present"}`
keeps exactly the badged items, from the domain's request reader through to the
extension's condition match. The vocabulary text says so. The two doc rows are updated.

## Cause

- `apps/extension/src/content/extraction/infer-fields.ts:333-372` (pre-change),
  `elementSources` offered only these:
  - `<img>` (src/alt),
  - `<a href>`,
  - form controls,
  - test-id elements,
  - text leaves (`isTextLeaf`, `:576-578`, which requires non-empty text).

  The store's Plus mark, `<i role="img" aria-label="Brightaisle Plus"></i>`
  (`apps/scenario-lab/src/scenarios/everything-store/pages/results/result-card.ts:40`),
  matches none of them, so no column existed.
- The model sees only labels, keys, kinds and coverage, never values or selectors
  (`domain/src/runtime/llm-evidence/structure/packet.ts`). So there was nothing a
  `where` condition could name.

## What changed and why

- **New `apps/extension/src/content/extraction/badge-name.ts`** (the naming rule, kept in
  its own module):
  - `badgeNaming(element)` finds the name, in accessible-name order:
    1. `aria-label` (which covers `role="img"` with one),
    2. `title`,
    3. an `<svg>`'s own `<title>` child.

    The element must have no words of its own. An `<svg>`'s drawing text is not
    counted as words. `aria-hidden="true"` means the element is not a badge.
  - `constantBadgeName(run, selector, attribute)` returns the name only when every
    item that has the element gives the same non-empty name, and at least two items
    have it. Otherwise it returns `undefined`, and also for anything inside a
    sensitive control.
- **`infer-fields.ts`**:
  - Before the text-leaf case, `badgeSource` emits:
    - an `attribute` source (`${path} aria-label` / `title`) with `accessibleName: true`, or
    - for an svg title, a `text` source on the `<title>` element.
  - `describedLabel` swaps in the constant name via `badgeLabel`. A name that varies,
    or is seen once, keeps the structural path label. A sensitive source is never read.
  - Coverage makes it optional (`required: false`) exactly like any partial column.
  - The header comment and the `FieldSource.label` doc now state the D3 reasoning:
    a constant name is chrome, like a button caption.
- **Domain projection** (`structure/packet.ts`) needed no logic change. It already
  passes key/label/kind/coverage to the model and keeps the attribute spec in the
  handle. I only updated the `WebLlmStructureField.label` doc comment. The request
  reader (`read-request.ts`) and `condition-match.ts` already handle `is: "present"`
  on a field key. No change was needed in `domain/src/actions/extraction/**`.
- **`domain/src/output-nodes/extract-list/catalog-text.ts`**: the grammar was at 698
  of Core's 700-character bound. It is now exactly 700 and says
  `...not: true inverts; badge: is: "present".`. To pay for the 22 characters I removed:
  - `Detected: ` before the handle form. The handle says it, and the literal branch's
    `Or` still sets that branch apart.
  - `All hold; `. The detect tool's description (`runtime/llm-evidence/tools.ts`) says
    "Every condition must hold" to the same build.

  The docstring records this, as the file does for earlier cuts. No test pinned
  either phrase.
- **`docs/architecture/web-capabilities.md`**: one sentence each.
  - Structured extraction: the badge column's value and the presence filter.
  - Repeating/list elements: badge detection and the constant-name labelling rule.

## Tests

- `apps/extension/src/content/extraction/tests/badge-column.test.ts` (new; its own
  stub DOM answers the `:scope > a.b > c:nth-of-type(n)` selectors detection writes):
  1. 3 of 5 store-shaped cards carry the badge. The result is a column labelled
     `Brightaisle Plus`, key `brightaisle_plus`, coverage 0.6, spec
     `{kind: attribute, selector: ":scope > div.body > div.dlv > i.plus", attribute: "aria-label", required: false}`.
  2. A varying name (`N.5 out of 5 stars`) is still a column, but under its path
     label, and no label contains the value. One differing name among agreeing ones
     gives a path label. A name seen in only one item gives a path label.
  3. An svg `<title>` names the column (text read of the title). An `aria-hidden`
     icon is no column.
  4. Detected fields plus `where [{field: "brightaisle_plus", is: "present"}]` go
     through `webAutomationExtractListRequestValue` (the condition survives unchanged),
     then `itemFilterFor` + `readField`. That keeps exactly `Earbuds 1, 3, 4`.
- **Without the fix** (committed `infer-fields.ts` put back temporarily, then restored),
  all four fail (`# pass 0 # fail 4`):
  - Test 1: `a column is labelled Brightaisle Plus: ["div.body > h2.ttl > a.tl url","div.body > h2.ttl > a.tl > span","div.body > div.prc > span (currency amount)","div.body > div.dlv > b"]`.
  - Tests 2 and 3: "the icon is still offered as a column" / "the svg's title names the column".
  - Test 4: kept-set mismatch.
- `domain/src/runtime/llm-evidence/structure/tests/badge-column.test.ts` (new, a guard).
  It checks:
  - the wire reader keeps the column;
  - the packet shows `{key: "brightaisle_plus", label: "Brightaisle Plus", kind: "attribute", coverage: 0.6}` with no selector and no attribute name;
  - the binding keeps the optional attribute spec;
  - the presence condition survives the reader and holds for the name but not for `undefined`.

  It passes without the extension fix, because the domain half needed no change.
- `domain/src/output-nodes/extract-list/tests/catalog-text.test.ts`: new test "the
  grammar says a badge column filters by presence".

## Commands run and observed results

1. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w6 ext" pnpm --filter @fluxiq-web-extension/extension test`
   gave `exit=0`, `# tests 1235 # pass 1235 # fail 0`. It includes ok 565-568 (the four badge tests).
2. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w6 domain" pnpm --filter @fluxiq-web-extension/domain test`
   gave `exit=0`, `# tests 914 # pass 914 # fail 0`. It includes ok 145 (catalog badge line) and ok 589-590 (domain badge tests).
3. `node scripts/structure-audit.mjs` (first run) failed `[failure-as-empty]` on my
   `badge-name.ts` try/catch around `querySelector`. I removed it: the selector is one
   detection built and already ran for coverage, so a throw is a fault.
   Rerun: `structure-audit: 2 violation(s) across 1 rule(s)`. Both are `[file-lines]`
   in `apps/extension/out/content/actions/tests/*.test.mjs`, an untracked `out/`
   directory created 23:49 by another agent (not mine, untouched). My files show only
   the pre-existing advisory `infer-fields.ts: 645 lines` (was 616; limit 800).
4. After the audit fix, a scratch esbuild run of `badge-column.test.ts` + `infer-fields.test.ts` gave `# pass 9 # fail 0`.
   The scratch directory `.test-build-scratch/t194-w6-iter` was removed.
5. Type checks, all `exit=0` with no output:
   - `tsc -p apps/extension/tsconfig.json --noEmit`
   - `tsc -p apps/extension/tsconfig.test.json --noEmit`
   - `tsc -p domain/tsconfig.json --noEmit`
   - `tsc -p domain/tsconfig.test.json --noEmit`

   The `packet.ts` edit after runs 1-2 is a doc comment only.
6. Grammar length measured with node before editing: 700.

The whole-suite runs included other workers' uncommitted edits in this tree
(`list-reader.ts`, `pagination.ts`, `handles.ts` and others). They passed with them.

## Not verified

- **No browser, Lab or Playwright run** (forbidden). Nothing has checked that the real
  store's result card yields the `Brightaisle Plus` column in Chrome, or that a live
  model writes `is: "present"` on it.
- **Detection output on the ten scenarios is not measured.** Every word-less element
  with `aria-label`/`title` is now a column. That includes icon-only buttons (a
  constant caption, coverage 1, labelled by the caption), which can:
  - take places under `MAX_PROPOSED_FIELDS` (24) or the 8 reserved partial places;
  - lower a run's mean-coverage confidence;
  - raise `contentFieldCount`, which the page-wide run ranking reads.
- `e2e/content/tests/extraction/inference.spec.ts` was not run.

## Open questions or contradictions found

1. **Beyond the decision's letter:** I require the name in **at least two** items
   before it becomes a label. With one item, "the same in every item" cannot be told
   apart from one record's value. Lower `MIN_NAMED_ITEMS` in `badge-name.ts` if the
   lead disagrees.
2. **svg `<title>`** is read as a `text` field on the `<title>` element, not as an
   attribute. It has no attribute to read. Presence works the same way.
3. **The grammar is now at 700/700** and dropped `Detected: ` and `All hold; ` (see
   above). The next clause needs Core's bound raised or another cut.
4. **Stale comment outside my files:** `domain/src/extraction/proposal.ts:16-18` and
   `:28` say "The text inside an item may not be a label" / "Never text read inside an
   item." The code does not violate this: a constant badge name is chrome under the
   lead's D3 decision. The wording should still say so. Proposed diff:
   ```diff
   -// it may be a label or a spec's `header`. The text inside an item may not be a
   -// label.
   +// it may be a label or a spec's `header`. A value read inside an item may not be
   +// a label; an icon badge's accessible name that every item carrying it gives
   +// identically is chrome, not a value, and may (`apps/extension/src/content/extraction/badge-name.ts`).
   ```
   ```diff
   -  /** What the picker shows for the field: a test id, a column header, an attribute name. Never text read inside an item. */
   +  /** What the picker shows for the field: a test id, a column header, an attribute name, or a badge's constant accessible name. Never a value read inside an item. */
   ```
