# p2 read gaps (invariant I7)

## Outcome
Done. All five gaps closed; `read-vocabulary.test.ts` passes whole with no exemption. t885's R1 had closed none of the five.

## What changed and why
Design: no new field kind (a new kind would have forced edits in the panel's field-row and view-model, which are not mine). A `value` field gains an optional member `shown` (`label | options | checked | disabled | marked`): what the page view prints of the element, read from the same source the view is printed from. Absent, the field reads the live value as before.
- `domain/src/actions/extraction/value-shown.ts` (new, exported by the barrel): the type and `WEB_AUTOMATION_EXTRACT_VALUE_SHOWN`. A separate file because request.ts hit the 15-exported-values limit.
- `request.ts`: `shown` on the field spec. `read-request.ts`: kept on `value` only, an unknown one refuses the field, left behind on any other kind. `schema.ts`: `shown` enum property.
- `apps/extension/.../item-mark/shown-value.ts` (new, exported from the barrel), sources are the capture's own:
  - label / options: `selectState` (describe-element). Options read as labels joined by `|`; a selection that is no option reads nothing.
  - checked: `checkedState` (live property), else `aria-checked`; reads `checked` / `unchecked`.
  - disabled: `ownPressCursor === "not-allowed"` or `disabled` attribute or `aria-disabled="true"` (the printer's rule); reads `disabled` or nothing.
  - marked: `(ownPressCursor !== undefined || isActionableElement) && setApartFromLikeSiblings`, the snapshot's own condition; reads `marked` or nothing.
- `field-reader.ts`: the `value` case calls `shownValue` when `shown` is set (header doc updated). `field-spec.ts` (not on the owned list, needed): `value` reader carries `shown`, an unknown one throws like an unknown mark.
- Exhaustive field-copy sites needed the new key (`present<>` forces every key): `plan-resolution/extraction/columns.ts` (2 sites), `structure/packet.ts` (`readableSpec`), and the test helper in `structure/first-item/tests/definition.test.ts`. Outside the owned list; one line each, no behaviour beyond keeping `shown` through a copy.
- `read-vocabulary.test.ts`: the five rows' `read` now name the `value`+`shown` field; the accept check also asserts `shown` is kept. No row removed, no exemption.
- Not done: offering these as columns from detection (`stateMarkSources`), since the brief required the read fields; the options column "kept" means readable by a field, not auto-offered. Model-facing text: only the schema label "Shown as" and the enum words; generic.

## Commands run and observed results
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t905-i7 node scripts/test-domain.mjs page-view/tests/read-vocabulary actions/extraction/tests` -> pass 108, fail 0 (includes read-vocabulary 5/5 and a new read-request test for `shown`).
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t905-i7 node scripts/test-extension.mjs item-mark/tests extraction/tests/field-reader extraction/tests/marks extraction/tests/record-control` -> pass 55, fail 0. New file `item-mark/tests/shown-value.test.ts` (7 tests: cursor-disabled seat, attribute/aria disabled, set-apart seat, native checkbox checked/unchecked with plain value read still empty, select label and options with live value unchanged, sensitive select refused, unknown shown refused).
- Revert check: field-reader's `shown` branch removed -> shown-value tests pass 2, fail 5; restored -> 7/7.
- Wider domain run (`... structure/first-item plan-resolution/extraction`) -> pass 196, fail 1: `element-record.test` "reads one element named by its own handle as a one-row table" actual has `answer: 'kept'`. Not touched by me (no `shown` involved; `answer` comes from another change in the tree: item-record/extract-list files are modified by others). Not confirmed against a clean tree.
- `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` in domain and in apps/extension -> no output (clean). `node scripts/check-extension.mjs` (typecheck plus every browser bundle) -> no output, exit 0.
- Slot run `heavy-slot.mjs run t905 -- pnpm check ...`: refused at `core-build.mjs`: "Core's build ... is not current with its source (ui-components:build: inputs changed: packages/fluxiq)", another worker's Core edit. So I ran the same tsc/bundle steps directly, as above.
- `node scripts/structure-audit.mjs` -> 1 violation: `list-reader.ts: 812 lines exceeds the 800-line limit` (other worker's file, forbidden to me). Earlier runs also showed list-place violations that have since cleared. My request.ts 16-values violation was fixed by value-shown.ts. `node scripts/check/model-text.mjs` -> ok.

## Not verified
Live behaviour in a real browser (the fake DOM stubs `getComputedStyle` and form-control classes; the real `ownPressCursor`/`setApart` were exercised only through those stubs). Whether the Core rerun-merge or the gateway lift in Core preserves an unknown `shown` member (Core untouched; the domain's own reader keeps it). The `element-record` failure above on a clean tree.

## Open questions or contradictions found
- Detection does not yet offer a `shown` column for these elements; a person or model must name it explicitly. Say if the lead wants `stateMarkSources` to offer `checked`/`marked` etc.
- The wider panel (`field-row.ts` kind labels) shows a `value` field with `shown` as a plain value; untouched.
