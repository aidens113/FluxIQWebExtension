# x3c-page-inference: X3.3's extension share and X3.4

## Outcome

**Done, with one part of the brief's acceptance deliberately unrun.** The
inference modules, the `extraction.propose` message, the `repeating.ts`
de-duplication and both documentation updates are in the working tree.

- **Extension check:** exit 0, twice (`tsc -p tsconfig.json --noEmit` and
  `tsc -p tsconfig.test.json`, which covers `e2e/**/*.ts`, so the new harness
  spec is type-checked rather than merely transpiled).
- **Unit tests:** exit 0, `# tests 578`, `# pass 578`, `# fail 0`. The count
  rose from 559 to 578: my 19 new rows, and nothing else moved.
- **Mutations:** four, all on the real source, each observed red on the rows it
  targets and each restored byte-identical (SHA-256 compared).
- **Structure audit:** exit 1 on two violations, both in supervisor-owned
  working documents (`docs/working/first-class-data-extraction-plan.md` at
  1,174 lines, and `docs/working/README.md` out of date). No finding names a
  file of mine.
- **The content harness was not run**, as the brief instructed, because the
  fixture workers are editing `apps/scenario-lab/src/scenarios/` and the
  harness loads those sources at start-up. The three cases the report asks for
  are written and unproven. See *Not verified* for the exact command.

## What changed and why

### New `content/extraction/` modules (four files, plus barrel lines)

- **`infer-list.ts`** — `inferListFromElement(picked)`. Walks outward from the
  picked element; at each level it groups the element's siblings by the
  domain's `webAutomationItemSignature` and takes the nearest run of at least
  three. A level is accepted only once it can be *named* and *read*: the item
  selector must match exactly the run and the item must expose at least one
  field, or the walk goes on outward rather than proposing a list nothing can
  read. Confidence is the selector's strength times the fields' mean coverage,
  so it is computed rather than invented.
- **`item-selector.ts`** — the candidates a run's markup offers, strongest
  first: the shared test id, the test-id *shape* as a prefix match
  (`row-1`, `row-2`, `row-12` give `[data-testid^="row-"]`), `<container> >
  tag.class`, then role. A candidate is accepted only when
  `document.querySelectorAll` answers with exactly the run, element for
  element. Building the candidates is pure and tested without a page; only the
  acceptance test touches the document.
- **`infer-fields.ts`** — a table row's cells become `column` fields keyed by
  the header above them; anything else contributes an `<img>`'s `src` and
  `alt`, an `<a href>` as `link`, a form control as `value`, and a test-id
  element or remaining text leaf as `text`. Coverage is the share of the run's
  items the field resolves in, and a field below 1 is proposed
  `required: false`, so a record that lacks it carries `null` (D16).
- **`detect-pagination.ts`** — walks outward from the container, ignoring
  controls inside the run's own items (a product card's own link is not a way
  to the next page), and proposes `next`, `loadMore` or `numbered`. **`scroll`
  is never proposed**, as the proposal contract requires.

### D12's pre-selection, and one deliberate strengthening

A field whose element is, or sits inside, a sensitive control is proposed
`handling: "exclude"`, and inference can propose nothing else for it.

The brief (and the report) name `isSensitiveFormControl`. I used
**`isWithinSensitiveControl`**, the ancestor-aware rule, because
`field-reader.ts` refuses the *whole* read for a field that resolves to
anything inside a sensitive control (D2): a field proposed `include` inside a
marked group would produce a proposal that refuses itself the moment it ran.
The ancestor rule returns true for a marked control itself, so it subsumes what
the brief asked for rather than departing from it.

No label is text read inside an item (D3). A label is a test id, a column
header — page structure, not a sample value, as D16 says — an attribute name,
or the item's own tag and position. Keys come from the one domain key function,
so every key is one Core's dataset schema accepts.

### `content/evidence/repeating.ts`

`itemSignature` and `identifierShape` are gone; the file now reads the parts off
the element and calls `webAutomationItemSignature` and
`webAutomationIdentifierShape`. `MAX_SIGNATURE_CLASSES` went with them. The
comment says why: the picker's inference groups by the same string, so a second
spelling here would mean the run the evidence reports is not the run the picker
proposes. The directory is a contract-spread path and this change adds no
spread.

### `content/message-handler.ts` and `shared/extraction-messages.ts`

A new branch answers `extraction.propose { selector }` behind the same
active-instance and frame-address checks every other message uses. Inference is
synchronous, so it replies and closes the channel as `fluxiq.ping` does. A
selector the browser cannot parse, or that this frame cannot resolve, is
`{ ok: false, refused: "target_not_found" }` rather than a throw.

The message types are in a new `shared/extraction-messages.ts`, not
`shared/protocol.ts`, which is already 449 lines.

### X3.4 documentation

- **`web-capabilities.md`**, rows 116-118. The spec kinds, `null` for an
  optional miss, `exclude` and `encrypt`, the four pagination modes, and
  inference. It also corrects three now-stale owning-file pointers: every row
  still named `content/action-runtime/list-extraction.ts`, which `x3b`
  deleted.
- **`sensitive-values.md`**, two additions. In *Readers*' "not a rule about page
  text" bullet: a list field obeys D2 in every kind, the `value` kind most of
  all, and an **excluded** column is not a redaction — it is dropped in
  `field-spec.ts` before the page is read, so it is absent from the output, the
  summary's `fieldNames`, the saved table and every export. In the *Recorded
  events* bullet, the sentence the supervisor asked for: `recordableKey` asks
  the ancestor-aware rule, so a printable key pressed in **anything inside** a
  marked element is withheld too, not only one in a control the rule marks
  itself (found and fixed by `x0-12-descriptor-marked-state`).

## Commands run and observed results

Every command ran from `F:\!FluxIQWebExtension`, one at a time.

1. **Structure audit, before editing:** exit 1, `2 violation(s) across 1
   rule(s)` — the plan document at 1,103 lines and `docs/working/README.md` out
   of date. Both supervisor-owned; neither is mine.
2. **Extension check** after the code landed: exit 0, no output from either
   `tsc`.
3. **Unit tests** (`EXTENSION_TEST_BUILD_LABEL=x3c`): exit 0, `# tests 578`,
   `# pass 578`, `# fail 0`, `# cancelled 0`.
4. **Mutations**, by the scratch driver
   `...\scratchpad\x3c-mutate.mjs`. Each confirmed its search text matched
   exactly once (`MATCHES=1`), applied it, ran the unit tests, restored the
   file in a `finally` block and compared SHA-256.

   | ID | Mutation (real source) | Observed |
   | --- | --- | --- |
   | M1 | the D12 exclude pre-selection removed from `proposedFieldSpec` | exit 1, `# fail 2`: `not ok 329` (a sensitive source is proposed excluded) and `not ok 330` (every kind is excluded) |
   | M2 | an item selector allowed to match a superset: any test-id prefix, however short | exit 1, `# fail 1`: `not ok 338` (ids that differ before their first digit have no shape) |
   | M3 | a table cell allowed to be the record | exit 1, `# fail 1`: `not ok 334` (a table cell is never a record) |
   | M4 | a control labelled Next no longer recognized | exit 1, `# fail 1`: `not ok 313` (a control labelled Next follows the list) |

   Every row printed `restored byte-identical=true`, and the driver ended with
   `all restored identical: true`. No mutation was refused by the permission
   classifier, so no scratch copy of the repository was needed.
5. **Residue grep** over `content/extraction/` for `false &&`, `false ?`,
   `MIN_SHAPE_PREFIX = 0` and a bare `return true;`: the only hit is
   `infer-fields.ts:211`, which is my own `resolvesIn` fallback for the `text`
   and `value` kinds. M3's target in `infer-list.ts` shows none.
6. **Final gates on the restored tree**, in one sequential run:
   - extension check: exit 0;
   - unit tests: exit 0, `# tests 578`, `# pass 578`, `# fail 0`;
   - structure audit: exit 1, the same two working-document violations (the
     plan document now reads 1,174 lines — another agent is appending to it).
     A grep of the audit output for `extraction`, `message-handler` and
     `repeating` matched only the plan document's own filename.
7. **`git diff --stat -- apps/extension/build domain/.test-build`**: printed
   nothing, so neither tracked generated output was touched.

## Not verified

- **The content harness was not run at all**, by instruction. Every claim the
  three new rows make is therefore unproven: the eight catalog cards, the link
  field and the detected `next` control; the twelve table rows proposed as
  `column` fields with the header row excluded, and the same records after
  `column-reorder`; and the password field proposed `handling: "exclude"`. The
  command, once the fixture workers are done, is
  `pnpm --filter @fluxiq-web-extension/extension test:content -- extraction/inference --workers=1`.
  Note the path filter: the spec is at `e2e/content/tests/extraction/inference.spec.ts`
  (see open question 1), not the filename the brief named.
- **The report's two harness-level mutations were not observed.** "Accept an
  item selector that matches a superset" and "remove the exclude
  pre-selection" were run against the *unit* rows (M2 and M1) and were red
  there, but neither was seen to turn the data-table or password harness row
  red, because that needs the harness. The third, "allow spaces in keys", is
  domain code this brief does not own; `x3a` observed it red as its M1.
- **The structure audit cannot see my new files.** It reads `git ls-files`, and
  everything new here is untracked, so no budget was actually checked against
  it. Counted by hand: `content/extraction/` 9 source files (largest,
  `infer-fields.ts`, 222 lines), its `tests/` 7, `shared/` 7,
  `e2e/content/tests/extraction/` 1, and no prefix group above 2. All are
  inside the limits, but that is my arithmetic, not the audit's. Re-run it
  after `git add`.
- **No browser, and no Firefox.** No unpacked extension, no side panel or
  popup, no cross-frame routing. `extraction.propose` has never been delivered
  by a real background worker — only the harness path is written, and that is
  unrun.
- **Repository-wide gates were not run**: root `pnpm check`, `pnpm test`,
  `pnpm build`, and the domain package's own check and tests. The domain
  package was not edited.
- **The fixtures are moving under this spec.** `product-catalog` and
  `data-table` are being edited by the fixture workers. The spec reads what it
  can off the live DOM — the product names, the table's headers, the number of
  numbered page controls — but it does pin `itemCount` at 8 and 12 and the
  item selector at `[data-testid="inventory-row"]`. If a fixture worker changes
  the page size or the row test id, those rows fail for that reason, not
  because inference broke.
- **Confidence is a number nobody has calibrated.** It is
  `selector strength × mean coverage`, bounded 0 to 1 and asserted only to be
  within those bounds.

## Open questions or contradictions found

1. **The harness spec is not at the path the brief names (a decision, not an
   oversight).** The brief says
   `e2e/content/tests/extraction-inference.spec.ts`. `git ls-files` shows that
   directory holds **exactly 25** source files, which is the audit's
   `directoryFiles` hard limit, and it has no baseline entry — so a 26th file
   there is a ratcheted FAIL of `pnpm check`'s first gate. D16 already directs
   new harness specs to an `e2e/content/tests/extraction/` subdirectory for
   this exact reason, and the brief told me to apply D16, so the spec is at
   `e2e/content/tests/extraction/inference.spec.ts`. The brief's own validation
   line (`-- extraction-inference`) needs to become `-- extraction/inference`.
2. **A table cell would otherwise be the record.** The report's rule — "walk the
   ancestors, take the nearest run of at least 3" — makes a picked Price cell
   propose the *four columns* of its row, because a row's cells are four
   siblings of one template and they are nearer than the twelve rows. I added
   one rule: `<td>` and `<th>` are never the record, because a cell is a column
   of one, which is exactly what `infer-fields.ts` proposes them as. Without it
   the report's own data-table case cannot pass.
3. **The item selector rule is a second spelling of `repeating.ts`'s
   `ITEM_SELECTOR`, in spirit.** The clean fix is to export that constant from
   `repeating.ts` and add one line to `content/evidence/index.ts`, so evidence
   and inference share one answer to "what can be an item". I did not, because
   the barrel is outside this brief's owned paths. Worth a one-line follow-up.
4. **`generalizedItemSelector` takes the container selector as a second
   argument**, and returns `{ selector, confidence }` rather than the report's
   bare `string | undefined`. The structural candidate needs the container, and
   only the selector knows how strongly it names the run, so returning the
   strength is what lets confidence be computed instead of guessed.
5. **`maxPages` on a detected pagination is a policy I invented.** It is the
   number of numbered page controls the page shows, or the domain's
   `WEB_AUTOMATION_EXTRACT_MAX_PAGES` when the page advertises nothing. The
   page's own count is right for `product-catalog` (3), but "as far as the
   contract allows" for a page with only a Next control is an opinion the user
   should confirm in the picker. X4 should decide whether the picker defaults
   it differently.
6. **The refusal vocabulary cannot say "a run, but nothing to read".**
   `inferListFromElement` returns `undefined` both for "no run of three" and
   for "a run whose items expose no field", so the reply says
   `no_repeating_run` for both. Distinguishing them would help the picker tell
   the user what to pick instead.
7. **The parts-reading is now written twice** — in `repeating.ts` and in
   `infer-list.ts` — though the *rule* is written once, in the domain. That is
   the shape `signature.ts` was designed for (the page supplies the parts), but
   it does mean two call sites must agree about reading `classList` and
   `testIdFor`.
8. **The spec copies `armVariant` from `extract-list.spec.ts`.** Eight lines,
   duplicated because a spec cannot import from another spec and a shared
   helper file would add a 26th file to the full directory. A
   `e2e/content/tests/extraction/` helper could hold it once X5-H splits the
   big spec.
9. **A control labelled "Next of kin" would read as a Next control.** The label
   rule is `/^next\b/`, which is deliberate for "Next →" and "Next page" but
   does match that. No fixture has one; tightening it needs a real example.
10. **Frame routing for `extraction.propose` is unsettled.** The branch honours
    `isAddressedToThisFrame`, so an addressed message reaches one frame, but a
    broadcast would have every frame answer and the first reply win. X4 owns
    the pick session and should address the message to the frame the user
    picked in.
