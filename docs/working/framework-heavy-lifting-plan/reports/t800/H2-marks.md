# t800 / H2-marks: typed fields, marks and row identity (W7 CC1, CC2, CC3)

## Outcome

Done, with one acceptance run not finished in-tree. CC1, CC2 and CC3 are filled on the detected-list packet, and a
read keeps rows by `is: "present"` on a mark, with the same verdict on the page and under Core's condition judge
(tested both ways). Both typechecks and the domain test command pass in-tree as written (1442/1442). The structure
audit and model-text check pass. The extension test command hangs in-tree on one list-reader test that is not mine
(see Commands). The same suite passes 434/434 in an isolated run that differs only by using HEAD copies of another
worker's four in-flight files. One forced two-line edit sits outside the owned list (`columns.ts`, under Files).

## On dev before this brief

- **CC1 (typed fields).** Nothing typed. `content/extraction/value-shape.ts` only appends `(currency amount)` or
  `(number)` to a *path-labelled text* column's label, measured over up to 24 items. The packet field carried
  `key, label, kind, coverage, at?, atItem?, sample?` (one sample from the first item that has the column). `kind` in
  `actions/extraction/request.ts` is a read mode.
- **CC2 (marks).** Icon badges were already columns (`badge-name.ts`, 2026-09-29): an `aria-label`/`title`
  attribute read, or an `<svg>`'s `<title>` text, labelled by its constant name; `is: "present"` on that key already
  kept exactly the badged rows. What was missing: (a) nothing told the model or Core which columns are marks; (b) no
  per-item marks anywhere in the packet; (c) an item's own `data-*` flag written `""` read `""` (Core: no value) and
  one written `"false"` read as present, so `is: "present"` kept the wrong rows; (d) a control's on/off state
  (`aria-pressed`, `aria-checked`, `aria-selected`) had no presence column -- at best `stated-name/` offered the state
  attribute, which reads `"true"`/`"false"`, both present. A Flow got a mark by reading an svg `aria-label`. t790's
  `row-mark.ts` is Core-side advice over stored rows only.
- **CC3 (row identity).** No `rowIdentity`/`itemKey` in the packet. `link-identity/` gives a tracking-free link only
  when a read asks for it; `target-reacquire/row-key-columns.ts` keys re-find on `dedupe.by` or id/link-named stored
  columns. Dedupe defaults to the whole row.

## Design

**How a request names a mark (inside the existing shapes).** A mark is a detected column; its id is its field key.
The field spec gains one optional member, `mark?: "badge" | "flag" | "state"` (`request.ts`,
`WebAutomationExtractFieldMark`, `WEB_AUTOMATION_EXTRACT_FIELD_MARKS`). The model names the mark by key in `fields`
and writes `where {field: <key>, is: "present"}` as today. The binding keeps `mark`, so the page reads it as a mark.

**Wire rule.** A mark's column holds a value only on the rows that carry it, so Core's existing `is: "present"` keeps
exactly those rows and the page's item filter gives the same verdict (both run the same `readField`):

- `badge`: read unchanged (the name when the element is there, `null` when not). Proposed as a mark only when every
  item that has it gives the same name; a per-item name stays data.
- `state`: the column's selector is the control's own with `[aria-pressed|aria-checked|aria-selected="true"]`
  appended, so an off row has no element and its record carries nothing. It reads the control's words, else its
  `aria-label`/`title`, else the state attribute (`"true"`). This needs no reader change and survives every copy
  path, because the on-state is in the selector. Label: `<path> (pressed)`. State columns are kept out of
  `template-kind/`'s split, which rewrites positional selectors and would drop the `[...="true"]`.
- `flag`: an item's own `data-*` attribute that only some items carry, or that every carrier writes `""`, `"true"`
  or `"false"`. The one reader change: `item-mark/flag-value.ts` reads `""`/`"true"` as the attribute's name, `"false"`
  as no value, any other value as written (same as before). An attribute every item carries with its own values
  (`data-item-id`) is data, not a flag.

No mark text is a site control word: the reader only tests the markup's own tokens (`true`/`false`/empty) and
returns the page's own string.

**Packet (domain, `runtime/llm-evidence/structure/`).**

- CC1 `column-type.ts`: each field gets `type` (`text|number|currency|count|date|datetime|url|id|flag`) and `parsed`.
  Order: a mark is `flag`; a link or an address attribute is `url`; an id-named attribute is `id`; the page's
  run-wide label note gives `currency`/`number`; a path text column *without* a note had mixed shapes, so its one
  sample is never typed numeric; otherwise the sample's shape (Core's `readAutomationStudioRecordNumber` /
  `readAutomationStudioRecordDate`). `parsed` is a number, or `YYYY-MM-DD`/an ISO instant for a date that reads the
  same against two far-apart nows; "3 days ago" and "Sep 12" get a type and no `parsed`.
- CC2 `fieldMarks: [{id, label, kind}]` from the proposal's `mark` specs, with `markNote`.
- CC2/CC3 `list-items/`: off the detection's own capture (`first-item/walk.ts`, the walk `locate.ts` already used,
  moved out so both share it), `items[i] = {itemKey?, marks?: {[id]: "on"|"off"}}` in list order, with `itemsNote`,
  and `rowIdentity: [fieldKey]`. Guards: items are emitted only when the capture holds exactly `itemCount` items; a
  mark's per-item values only when the capture finds its element in as many items as the page's coverage counted
  (else the mark is left out of every item, never said "off"); a row identity only for a coverage-1 link (the item's
  own first) or id-named attribute whose value is present, single and distinct on every captured item. `itemKey` is
  a link's path and query (no origin, no fragment) or the attribute as written, screened.
- Absent everywhere when the page proposed no mark and the capture answers nothing: `fieldMarks`, `markNote`,
  `rowIdentity`, `items`, `itemsNote` are all omitted (tested). Note: link/address columns now always carry
  `type: "url"`, and sampled columns carry `type`, so packets do change for those fields.

## Files

Domain (owned): `domain/src/actions/extraction/request.ts`, `read-request.ts`, `schema.ts`;
`domain/src/runtime/llm-evidence/structure/packet.ts`, `field-sample.ts`, `index.ts`, new `column-type.ts`, new
`list-items/{index,list-items,item-marks,row-identity}.ts`, `first-item/{index,locate}.ts`, new `first-item/walk.ts`.
Tests: new `structure/tests/packet-type-marks.test.ts`; updated `structure/tests/{detect,column-at,badge-column}.test.ts`.

Extension (owned): `apps/extension/src/content/extraction/field-spec.ts`, `field-reader.ts`, `infer-fields.ts`
(item attribute sources moved out to stay under 800 lines), new `item-mark/{index,flag-value,flag-attribute,state-sources}.ts`,
new `item-attributes/{index,item-attribute-sources}.ts`. Tests: new `tests/marks.test.ts`, which absorbs the former
`tests/badge-column.test.ts` (deleted; its tests are kept verbatim, specs updated with `mark: "badge"`), and
`tests/field-reader.test.ts`, which absorbs the former `tests/field-spec.test.ts` (deleted, tests unchanged). Both
merges keep `extraction/tests/` within its 25-file limit (Open question 3).

**Outside the owned list (flagged):** `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts`, two
lines (`mark: spec.mark,` in the `required`-override copy; `mark: undefined,` in the `@attr` copy). The typed
contract change made it fail to compile (`present<T>` requires every member), so the edit was forced. Revert it and
the domain does not typecheck.

## Commands run and observed results

All from W (`C:/Users/osrs_/FluxStuff/fxwork/t800/!FluxIQWebExtension`); heavy runs inside the heavy-check lock.

- Baseline before any edit: `DOMAIN_TEST_BUILD_LABEL=t800h2 node scripts/test-domain.mjs runtime/llm-evidence/structure actions/extraction`
  -> `# tests 143 # pass 143 # fail 0`; `EXTENSION_TEST_BUILD_LABEL=t800h2 node scripts/test-extension.mjs content/extraction`
  -> `# tests 429 # pass 429 # fail 0`.
- `npx tsc --noEmit -p domain/tsconfig.json` -> no output (clean). The final run came after Core's dist was rebuilt at 10:20. Between about
  09:15 and 10:20 it reported 4 errors, all in the other worker's files (`condition-grammar.ts` x2, `column-match.ts`,
  `plan-resolution/extraction/conditions.ts`), and none in mine.
- `npx tsc --noEmit -p apps/extension/tsconfig.json` -> clean before the other worker's edits; afterwards only the same
  errors in their files. `npx tsc --noEmit -p {apps/extension,domain}/tsconfig.test.json` -> 1 error each, both in
  `plan-resolution/extraction/conditions.ts` (theirs: `within` missing from a `present<>` copy). None in my files.
- `DOMAIN_TEST_BUILD_LABEL=t800h2 node scripts/test-domain.mjs runtime/llm-evidence actions/extraction` (in-tree, the
  brief's command, after the Core rebuild) -> `# tests 1442 # pass 1442 # fail 0`, `exit=0`. An earlier in-tree run
  (09:18, before the rebuild) had `20 of 29 domain test entries failed to load` on `SyntaxError: ... does not provide
  an export named 'readAutomationStudioRecordConditionDateBound'`, from the other worker's imports.
- Isolated domain run (scratch script `t800h2-iso.mjs`: the runner's esbuild options, the other worker's
  `condition-grammar.ts`, `column-match.ts`, `catalog-text.ts` and `tools.ts` loaded from `git show HEAD:`, and their 3 new
  date tests skipped), `runtime/llm-evidence actions/extraction` -> `207 entries`, `# tests 1434 # pass 1433 # fail 1`.
  The one failure was `detect.test.ts`'s field deepEqual now seeing `type: 'url'`. I fixed it in the test, then
  `runtime/llm-evidence/structure` -> `# tests 58 # pass 58 # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t800h2 node scripts/test-extension.mjs content/extraction` (in-tree, the brief's command):
  at 09:55 it failed to load on the missing Core export (`exit=7`). At 10:29, after the rebuild, it ran 278 tests, all ok,
  then hung on `list-reader-refused-page.test.ts:192` ("where the browser gives no status, a page that lost the list is
  retried as a possible refusal"). It made no progress for 17+ minutes. **It is still running as node PID 38440
  (started 10:29:22) and holds `lab-slots/heavy-check.lock`.** My attempt to stop it was denied by the permission
  system. When it ends, its wrapper releases the lock; otherwise the supervisor must stop it and `rmdir` the lock.
- Isolated extension run (`t800h2-iso-ext.mjs`, same substitution, `item-filter-date.test.ts` skipped),
  `content/extraction` -> `53 entries, 3 head loads`, `# tests 434 # pass 434 # fail 0`. That includes the hung test
  above, and `marks.test.ts` and the merged `field-reader.test.ts`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (233 warning(s), 616 baselined).` Earlier runs failed on
  `contract-spread` (two spreads in `list-items.ts` and one in my test, now written through `present<T>()`) and on
  `directory-files` (`extraction/tests/` at 26). That is resolved by folding `badge-column.test.ts` into
  `marks.test.ts` and `field-spec.test.ts` into `field-reader.test.ts` (tests unchanged), which leaves room for the
  other worker's `item-filter-date.test.ts`.
- `node scripts/check/model-text.mjs` -> `model-text: ok (208 scenario tokens, 377 model-facing Core files, 11793 string literals)`.

## Answers

**Q6. Can the packet carry per-item values for every field?** Today no: one screened sample per column. After this
brief it carries, per item, `itemKey` and `marks` (`{[markId]: "on"|"off"}`). Per-item values for every field are
computable domain-side by the same capture walk (`webLlmCaptureWalk(proposal, capture).items` x `elementsOf`), within
limits: selector forms the walk reads, elements the snapshot lists (an svg `<title>` may not be), values the screen
does not withhold, never a form control's value. The shape would be `items[i].values?: {[fieldKey]: string}`, screened
and bounded like `sample`. **Not emitted**, because Core never parses the web packet (Core's `row-mark.ts` header: the
structure "is the domain's evidence in the builder's history, never parsed by Core"). What Core's discriminating-field
note actually gets is the read's rows: `summary.recordSets[].sampleRows` and each condition's `leftOutCells`, shaped
`{[columnId]: string}`, holding only the columns the read declares. With CC2's wire rule, a mark the read names is such
a column (label or absent), which is the discriminating field the note looks for. If Core needs every *detected* field,
that needs a Core-parsed contract (new); that is a decision for the supervisor.

**Q7. Does `extractList` honour a `done when` end marker as the read's bound?** No (investigated, not run live). The
request has no end-marker member (`item, fields, paginate, maxItems, minItems, answer, where, dedupe, sort,
discloseText`). `content/extraction/list-reader.ts` `extractList` reads the page shown, bounded by `maxItems` (or
the domain's record bound when sorting) and filtered by `where`. A step's `done when:` is parsed by Core
(`flow-bootstrap/authoring/parse.ts`) into the node's expected state `{facts}` and judged after the step ran
(`executor/defensive/effect-check.ts`, `node-execution/recorded-effect.ts`). So it is a post-condition on the read,
never a bound. "Stop at the first row older than X" can only be written as a `where` date bound (the K1 twin), which
filters every row and does not stop the read.

## Not verified

- Live browser behaviour: no headed check was run. In particular whether a real snapshot lists a wordless
  `<i aria-label>` badge, a toggle's `aria-pressed`, and an item's `data-*` flag (the per-item guards make a missing
  element absent, never "off").
- The full suites. The brief's extension test command did not finish in-tree (see Commands); its result here comes
  from the isolated run.
- Core consuming any of it (Core P7 is not merged; Core reads none of these fields yet).
- `apps/extension/src/panel/extraction/{confirm-payload,view-model}.ts` (the picker) rebuild specs member by member and
  drop `mark`; a picked flag then reads as before (`""`), badges and states are unaffected. Not owned, not changed.
- `stated-name/` may still offer a toggle's state attribute as a plain column reading `"true"`/`"false"` beside the new
  state mark. Harmless, but both are shown.
- `aria-checked="mixed"` is read as off.

## Open questions or contradictions found

1. **Shared tree, concurrent worker.** Another worker (the date twin) is editing `request.ts` (`within`),
   `condition-grammar.ts`, `output-nodes/extract-list/{column-match,catalog-text}.ts`, `llm-evidence/tools.ts` and
   their tests in this checkout. Their code imports Core exports (`readAutomationStudioRecordConditionDateBound`,
   `...Within`, `automationStudioRecordConditionComparesDates`, `AUTOMATION_STUDIO_RECORD_CONDITION_DATE_CASES`) that are in
   Core's source but were not in Core's built `dist` until someone rebuilt it at 10:20. Until then, every domain or
   extension test that bundles `actions/extraction` failed to load in this tree, which is why I made the isolated
   runs. After the rebuild the domain command passes in-tree, and one `tsconfig.test.json` error of theirs remains
   (`conditions.ts`). `request.ts` is owned by both briefs; the edits do not overlap.
2. `columns.ts` edit outside the owned list (see Files).
3. Brief path `apps/extension/src/content/extraction/tests/marks.test.ts` collided with the 25-file directory limit,
   and so did the other worker's `item-filter-date.test.ts`. I resolved both by folding `badge-column.test.ts` into
   `marks.test.ts` (a badge is a mark) and `field-spec.test.ts` into `field-reader.test.ts` (both subjects changed
   here). No test was dropped and none was changed beyond `mark: "badge"` in two badge specs. The directory is at 25 again.
4. The hung in-tree extension test (Commands) passes with the other worker's files at HEAD. My changes are the same
   in both runs, so the hang is probably their in-flight code or a real-clock flake. That is not proven.
