# Live lane 1, fix 2: a group of positional lines offered whole

## Outcome

Done. When field inference can name a container's text lines only by their
position (`div:1`, `div:2`, `div:3`), it now also offers the container itself
as one `text` field carrying a new spec flag, `lines: true`. The list reader
reads that field as each child's text, in order, joined by `" · "`. The flag
gets through the domain's request reader, the detection packet and handle,
column resolution, the record-output digest, and the picker's confirm path.
The positional fields are unchanged. No build was run.

## What changed and why

A plain text read of the container would not work. The lines run together
("Pickup todayDelivery today...") because each line's words end where the next
line's begin. Changing every container text read to join its children would
break composed values (a price drawn as `$` `14` `47`). So the join is a
declared read, `lines: true`, allowed only on `text`.

Domain (`domain/src`):
- `actions/extraction/request.ts`: `lines?: boolean` on `WebAutomationExtractFieldSpec`, with its rationale, and `WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR = " · "`. The separator is re-exported through `actions/types.ts` so `domain/client` reaches it.
- `actions/extraction/read-request.ts` (`fieldValue`): `lines` is kept only on `text` and only when `true`. On other kinds it is dropped, the same way a stray `header` is. A value that is not a boolean refuses the field.
- `actions/extraction/schema.ts`: `lines` added to the field-spec metadata schema.
- `runtime/llm-evidence/structure/packet.ts` (`readableSpec`): the handle keeps `lines`. `handles.ts` needed no change: it deep-copies the spec with `structuredClone`, so the flag survives.
- `runtime/llm-evidence/structure/first-item/locate.ts` and its `index.ts`: new `webLlmFirstItemLines`, which returns the container's listed children in the first item that has the container.
- `runtime/llm-evidence/structure/field-sample.ts`:
  - A `lines` column's sample is its children's words, screened and joined with the separator, cut at 40 characters as before.
  - Its readable label is `lines: '<sample>'` when its path is a generated class path. The trailing `(all lines)` is stripped before that test.
  - The cut no longer leaves a dangling `·`.
  - The container's own run-together text is never shown.
- `runtime/llm-evidence/plan-resolution/extraction/columns.ts`: the `required` override copy carries `lines`. The `key@attr` copy sets it to `undefined`.
- `output-nodes/extract-list/derived-record-output.ts`: `lines` enters the dataset shape digest only when `true`, so every existing Flow keeps its digest.

Extension (`apps/extension/src`):
- `content/extraction/field-spec.ts`: the text reader variant carries `lines?: true`.
- `content/extraction/field-reader.ts`: new `readLines`.
  - It goes through the drawn children (shadow root and slot aware). An element child is read with `readText`; a direct text node is a line of its own.
  - It skips sensitive controls and style/script tags, drops empty lines, and joins the rest with the domain separator.
  - Conditions use the same `normalizeExtractField` and `readField`, so `where` reads the group the same way the list reader does.
- New `content/extraction/line-group/`, holding `index.ts`, `positional-line.ts` and `kept-groups.ts`:
  - `positionalLine` decides when a text line's selector ends in `:nth-of-type(n)`. Its parent becomes a group when the parent is not the item, at least two of its children hold words, it is not sensitive, and a selector names it alone in the item (`selectorWithinItem`).
  - The group's label is `<container path> (all lines)`, e.g. `div.css-0gz65eu (all lines)` with key `div_css-0gz65eu_all_lines`.
  - `keepLineGroups` handles the cap.
- `content/extraction/infer-fields.ts`:
  - `FieldSource` gains `lines` and `lineOf`.
  - `elementSources` pushes the group source just before its first positional line.
  - The source identity includes `lines`.
  - `proposedFieldSpec` writes `lines: true`.
  - `inferFields` runs `keepLineGroups` after the bound.
  - The logic lives in `line-group/` because the file passed the 800-line audit limit (it is now 779 lines).
- To keep detection's run ranking and confidence exactly as before (a group restates lines already counted):
  - `content/extraction/content-fields.ts`: `contentFieldCount` skips groups.
  - `content/extraction/detect-structure.ts`: `readableFieldCount` skips groups.
  - `content/extraction/infer-list.ts`: confidence's mean coverage leaves groups out (`withoutLineGroups`, which falls back to all fields if nothing else is left).
- Picker path, so a confirmed or previewed definition reads the group the same way: `shared/extraction-messages.ts` (`ExtractionConfirmField.lines`), `background/extraction/definition.ts` (`proposedColumns` and `fieldSpec` write `lines` only under `text`), `panel/extraction/view-model.ts` (`ExtractionFieldRow.lines`), and `panel/extraction/confirm-payload.ts` (sent only while the column's kind is `text`).

Docs: `docs/architecture/web-capabilities.md`, the structured extraction row, now has one sentence on `lines` and the detection rule.

**Cap.** `MAX_PROPOSED_FIELDS` (24) and `RESERVED_PARTIAL_FIELDS` (8) are unchanged. A group usually has coverage 1, so coverage sorting normally keeps it. If the bound leaves the group out, it takes the place of the last-placed (latest in the document) positional line of its own container that was kept, so the field count stays the same. If none of its lines was kept, the group is left out like any other source. The test with 30 fields shows this: the group replaced `div:nth-of-type(3)`, and `div:nth-of-type(2)` stayed.

Scope of the rule: a container is offered only when the line itself (the text source's own element) is the positional step. A path that is positional at a higher level (`div:2 > span`) does not create a group. This keeps large layout blocks from turning into groups.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQWebExtension`. The compiler is the one `require.resolve('typescript/bin/tsc')` finds from `domain`.
- `node <tsc> -p domain/tsconfig.json --noEmit` -> exit 0, no output.
- `node <tsc> -p domain/tsconfig.test.json --noEmit` -> exit 0.
- `node <tsc> -p apps/extension/tsconfig.json --noEmit` -> exit 0. Final run, after the last edit.
- `node <tsc> -p apps/extension/tsconfig.test.json --noEmit` -> exit 0. Final run.
- `DOMAIN_TEST_BUILD_LABEL=lane1-fix2 node domain/scripts/test-domain.mjs actions/tests/schemas runtime/llm-evidence/structure actions/extraction output-nodes/extract-list runtime/llm-evidence/plan-resolution/extraction extraction/tests` -> `# tests 314 # pass 314 # fail 0`. It includes the new `structure/tests/line-group.test.ts`, whose 3 tests pass:
  - the sample `"Pickup today · Delivery today…"` and the label `lines: 'Pickup today · Delivery today…'`;
  - the handle keeps `lines: true` on the group only, and the request reader keeps it;
  - the reader keeps `lines` only on `text` and only when true, and refuses `lines: "yes"`.
- `EXTENSION_TEST_BUILD_LABEL=lane1-fix2 node apps/extension/scripts/test-extension.mjs src/content/extraction src/background/extraction src/panel/extraction src/shared/tests` -> `# tests 506 # pass 506 # fail 0` (final run). The 4 new tests are in `content/extraction/tests/infer-fields.test.ts`:
  - On 5 cards whose containers hold 1 to 3 lines in varying order, the group field is `{kind:"text", selector:":scope div.ways", lines:true, required:true}` with coverage 1. Each row reads its own joined lines. `div:nth-of-type(1..3)` are still offered.
  - `where [{field:<group key>, contains:"Delivery"}]`, through `webAutomationExtractListRequestValue` and `itemFilterFor`, keeps exactly the 3 cards that have a Delivery line. `contains:"Pickup"` keeps exactly its 3. The old `div:1` field would have kept only 2.
  - No group is offered for single-line containers or for lines named by their own class.
  - Under the cap, the group replaces the last of its own positional lines.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (205 warning(s), 638 baselined).` Before the split, it had reported two FAILs from my first version: `infer-fields.ts` at 846 lines, and `extraction/tests/` with 26 files. Both were fixed by moving the logic to `line-group/` and the tests into `infer-fields.test.ts`. The baseline was not touched.

## Not verified

- No build was run, as instructed, and nothing was tested live or in a browser. The headed lane run is still using the old built extension.
- Nothing was re-run against the actual bigbox capture from `run-mvcxvr3k-af919462`. The tests use the fake DOM and a synthetic capture with the same structure.
- No e2e content-harness spec was run for the new read.
- Full package suites were not run (only the directories listed above). Other content directories were not run, e.g. `content/actions` extract-list.
- No change in model guidance was needed or made. Whether the model actually picks the group column with `contains` is unverified until the next live run.

## Open questions or contradictions found

- This is a change to the request contract (a new optional `lines` member). Core treats field specs as opaque JSON, so no Core edit is expected. Core's rerun merge, which patches a changed kind over an old spec, could leave `lines` on a non-text field; the domain reader drops it there.
- On single-line cards inference still offers the existing extra field `:scope > div.ways > div.way` (coverage counts presence, so it reads the first line on every card). This was here before this fix and was left unchanged.
- The domain sample screens each line, and leaves out a line the screen withholds. The page-side read still returns that line, so the sample can be shorter than the value on such rows.
