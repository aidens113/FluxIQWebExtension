# t195-w20e: the row gate sees what the row draws

## Outcome

Done. Both defects are fixed in `apps/extension/src/content/identity/record.ts` and pinned by five new cases in
`identity/tests/record.test.ts`. Three of the new cases fail with the change reverted. The other two are guards that
pass either way by design (details below).

## What changed and why

### Fix 1: `rowContents` reads open shadow roots (w19c B1)

- The walk's stack entries now carry a `shadow` flag. After an element's light children are pushed, its open
  `shadowRoot`'s children are pushed. The stack pops them first, so the shadow words land at the host's place in the
  text.
- The walk uses the same `MAX_ROW_NODES` budget and the same `isSensitiveFormControl` skip.
- Inside a shadow tree, `style`, `script`, `template` and `noscript` subtrees are skipped (`UNDRAWN_TAGS`, mirroring
  `field-reader.ts`). They match no value and do not spend `MAX_ROW_TEXT`.
- Attributes and links inside the shadow root go into `exact` through the same `elementValues` call.
- The light tree is read exactly as before. A light `<style>` is still read, because the brief limited the skip to
  shadow trees.
- `recordText` and `recordIdentity` are untouched.
- The header's "What counts as a record" section gained one sentence: row values are also looked for in a row's
  shadow-drawn words.

### Fix 2: a row for a control in no record (w19b #9)

- `agreesWithRecordedRecord` now calls `holdsRowValues(enclosingRecord(element) ?? rowOfOneControl(element), values)`.
- "Alike" means same kind and same accessible name:
  - Kind is the first token of the written `role`, else `implicitRole`, else the tag.
  - The name comes from `accessibleNameFor`.
  - A control with no accessible name gets no row, so the gate fails closed.
- `rowOfOneControl` walks up from the control, at most `MAX_RECORD_DEPTH` levels. At each parent it scans the parent's
  other children for an alike control, with one shared `MAX_ROW_NODES` budget (light DOM only).
- At the first parent that holds a second alike control, the row is the child the walk came up through. It must be more
  than the control itself: `holdsMoreThan` looks for an element or non-blank text off the control's path.
- It fails closed (`undefined`) when:
  - the control has no name;
  - no parent within the depth bound holds a second alike control;
  - the row would be just the control;
  - the budget runs out before the scan can tell.
- The header's values paragraph names the fallback.

**Deviation from the brief's wording, on purpose.** The brief said "smallest ancestor that holds exactly one alike
control and more than the control". Read literally, that is the button's own wrapper (`div.cartLineActions`: Qty,
Remove, Save for later). The wrapper holds none of the line's values, so it would refuse the soap's own Save for later,
and test 4 would fail. The literal rule would also *admit* the existing case "a candidate in no record disagrees with a
row's values: fail closed" (`<div>Red Toaster<button>Add to cart</button></div>`): that div holds exactly one alike
control and more than the control. So I took the boundary reading instead: the largest ancestor that holds exactly one
alike control, bounded by a parent that holds two.

**Why not make `div.cartLine` a record.** The only general rule that would catch it is something like "sibling divs
sharing a class set". `isRecordElement` is also what:

- decides what a *recording* identifies (`recordIdentity`, which would start recording text identities on many
  repeated divs);
- the snapshot's repeat annotation uses (`repeat-exemplars.ts`).

Widening it changes recording, replay and the snapshot on every page, and adds false refusals, which the header warns
against. The fallback is asked only when a pass's values are present and the candidate is in no record, where the
answer was always "no". It can only turn a certain refusal into an admission, and only when every value is found inside
a region that holds no second alike control. So it is the smaller sound change.

**Known limit.** A cart with a single line has no second "Save for later", so it marks out no row, and a pass over a
one-line cart is still refused. That is the "no such ancestor, fail closed" case. It is deliberate: the region around a
lone control can hold unrelated words (for example, the soap's title in the "Frequently bought together" rail while only
the towels are in the cart), and admitting there could press the wrong line.

### Tests (`identity/tests/record.test.ts`)

The stub `el()` gained:

- an optional `shadow` (an open root with `childNodes`/`children`; its nodes have no parent element, as in a browser);
- `closest`, `hasAttribute` and `firstChild`;
- a computed `textContent`;
- `querySelectorAll("*")`, which throws on any other selector.

The text-node stub gained `textContent`. Stand-in classes for `HTMLSelectElement`, `HTMLTextAreaElement` and
`HTMLElement` were added next to `HTMLInputElement`, for `accessibleNameFor`.

New cases:

1. A Guildline sent request shaped like `network/rows.ts` `sentRowMarkup` (the age is a `gl-time-ago` whose shadow root
   holds a `<style>` and "Sent 1 month ago" or "Sent 4 weeks ago"):
   - `[name, urn, "Sent 1 month ago"]` admits its own Withdraw.
   - The neighbour's own name and urn with "Sent 1 month ago" are refused, because only the drawn age differs.
2. Shadow `<style>` text ("display:inline-block", and a CSS token alongside the name) matches nothing. A stylesheet
   longer than `MAX_ROW_TEXT` before the age does not push the age out of the bound.
3. A row with no shadow root reads as before:
   - light text and attribute values (including `datetime`) admit;
   - another row is refused;
   - an age the row does not draw is refused.
4. A cart shaped like `cart-page.ts` `lineMarkup`, inside one pickup `section.cartGroup` with the soap first then the
   towels:
   - `[SOAP]` admits the soap's Save for later and refuses the towels'.
   - The towels' own values admit the towels' button.
   - `[SOAP, "$8.97"]` is refused on the soap's line, because every value must be in the line.
   - The soap's Remove is admitted by its line too.
5. A cart with only the soap still fails closed (the lone-control limit above).

## Commands run and observed results

All commands were run from `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`.

- `node .../scratchpad/run-dir-tests.mjs apps/extension w20e content/identity/tests`: `tests 104, pass 104, fail 0`.
- `node .../scratchpad/run-dir-tests.mjs apps/extension w20e content/identity/tests content/action-runtime/tests`:
  exit 0, `tests 186, pass 186, fail 0`. This includes other workers' uncommitted `action-runtime` edits.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (138 warning(s), 118 baselined)`.
  - New advisory warning: `apps/extension/src/content/identity/record.ts: 508 lines is past the 400-line advisory
    threshold`. It was 400 before; the fail limit is 800.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w20e check" pnpm --filter @fluxiq-web-extension/extension check`:
  exit 0.
  - The build cache printed `"reason":"no stamp; not stamped, because inputs changed while it ran
    (core:packages/fluxiq/src)"`, meaning someone was editing Core during the run.
- **Revert check.** With the original `record.ts` restored, the identity tests gave `tests 104, pass 101, fail 3`.
  - Failed: cases 1, 2 and 4.
  - Cases 3 and 5 passed, as expected: they are a regression guard and a fail-closed guard, true both before and after.
  - The new version was then copied back and confirmed byte-identical with `cmp`.
- **Mutation check for the style skip.** With only `|| (shadow && UNDRAWN_TAGS.has(...))` removed, `record.test.ts`
  gave `tests 21, pass 20, fail 1`, and the failure was case 2. The new version was restored and confirmed with `cmp`.

## Not verified

- I did not exercise either fix against the real scenario pages in a browser: no Lab or browser use was allowed. The
  stubs reproduce the markup by hand rather than rendering `renderCartPage` / `sentRowMarkup`. Scenario-lab sources were
  not imported into the extension tests.
- Nothing above the identity layer was run end to end, including `resolve-target.ts`'s use of the gate. The
  `action-runtime` tests pass, but no case there carries row values on these page shapes.
- I measured nothing about how much the fallback's `accessibleNameFor` calls cost on a large page. The cost is bounded
  by `MAX_ROW_NODES` scanned elements per gate question, but `accessibleNameFor` reads `textContent` for same-kind
  elements.
- Whole-row text values. The field reader's `drawnText` reads a shadow host's root *instead of* its light children, and
  skips light `<style>` too once a row hosts a shadow root. `rowContents` reads both trees. A whole-row text value from
  a row whose host has unslotted light children, or a light `<style>`, could therefore fail to be a substring here. This
  did not arise in either scenario.

## Open questions or contradictions found

- The brief's literal "smallest ancestor" rule contradicts its own test 4 and the existing fail-closed case. I
  implemented the boundary reading (see Fix 2) and the supervisor should confirm it.
- The one-line-cart limit stays fail-closed. If a loop over a one-line cart must work, it needs a different signal (for
  example, w19b's t223 look-alike context), not a wider region.
- `record.ts` is now 508 lines (advisory warning). A future split could move the row-values half (`holdsRowValues`,
  `rowContents`, `rowOfOneControl` and helpers) into its own module. I could not create new source files under this
  brief.
- I did not edit any files outside my ownership, and saw no errors in them.
