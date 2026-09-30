# t195-w5: a web element step inside a loop acts on the current row's control

Worker report, 2026-09-29. Tree `fxwork/t195/!FluxIQWebExtension`, branch
`task/t195-live-control-flow`. Nothing committed.

## Outcome

Done for the downstream half, with one resolution gap named under open
questions (the same-family candidate cap applies before the record gate).

## What changed and why

The defect (live runs `run-munnop9n-5475d593`, `run-munnyvbr-11c28a0f`): a For
Each over an extraction's rows ran its body click on the element recorded during
the build, so every pass pressed the first card's control.

1. **`domain/src/output-nodes/definitions.ts`**. New `itemInput` port
   `{ id: "item", label: "Item", valueType: "any", role: "data", required: false }`.
   A node declares it after `in` when its schema requires `selector`, which is
   the same rule that sets `metadata.elementTarget`: click, type, clear, select,
   check, upload, extract, wait_for_selector. Navigate, extract_list, dialog,
   tab, download, capture_snapshot, wait_for_text, scroll, keypress and assert
   declare `in` only.
2. **`domain/src/output-nodes/native-runtime.ts`**. New `scopedToRow`. When
   `context.inputs.item` is a plain object and `parameters.element.context.record`
   is an object, the dispatched `element.context.record` becomes
   `{ values }`, with `values = webAutomationRecordValues(Object.values(item))`.
   In every other case (no item, the item is an array, string or null, the row
   holds no non-empty string, or the element has no record, such as a dialog's
   Close) the parameters are dispatched unchanged. `context.inputs?.item` is
   read with optional chaining because existing tests build partial contexts.
3. **`domain/src/output-nodes/targets/targets.ts`**.
   - New exported `webAutomationRecordValues(value)` is the single bounding rule
     for both domain ends. It reads only an array, keeps strings only, collapses
     whitespace, trims, cuts at 200 characters, trims the end again, drops
     empties and duplicates, and keeps at most 8. An empty result is
     `undefined`.
   - `elementRecord` keeps `values` through that function.
   - `withRecordedRecord` changed. A recorded record carrying `values` now
     outranks a record that an adapted source (a matched candidate or a repair)
     named. That record describes the row the Flow was built on. A record
     without `values` still yields to the adapted one, as before (the existing
     test "the recorded record does not overwrite one an adapted target named
     for itself" still passes).
   - `client/gateway-mapping.ts` `commandElementFingerprint` needed no change.
     When the target is not superseded it reads `parameters.element` through
     `elementFingerprint`. When it is superseded it reads the wire
     `target.element` built by `outputTargetFromPayload`. Both paths now carry
     `values`, and a new end-to-end test proves it.
4. **Types**. `values?: string[] | undefined` was added to
   `domain/src/actions/types.ts` `WebAutomationElementContext.record` and to
   `apps/extension/src/shared/protocol.ts` `DomElementContext.record`, with
   docs.
5. **`apps/extension/src/content/identity/record.ts`**.
   - `agreesWithRecordedRecord` first checks `recorded.values`: each is
     collapsed and cut at 200 characters, and empties are dropped. When any
     remain, they decide the answer and `key`/`text` are not consulted. The new
     `holdsRowValues` fails closed when the candidate has no `enclosingRecord`
     or the record is inside a sensitive control.
   - Every value must be found in the record. `rowContents` runs one bounded
     walk: 2,000 nodes, text capped at 4,000 collapsed characters, and button
     words included. A value matches when it is a substring of that text, or
     exactly equals, after the same cut, an attribute value on the record or a
     descendant, an element's resolved `href` (the property, or
     `URL.canParse`+`new URL(attr, baseURI)`), or a form control's current
     `value`.
   - Sensitive form controls are skipped entirely. These sources are the ways
     `content/extraction/field-reader.ts` reads a field: text via textContent,
     `tightestStatedValue` (itemprop `content`, `aria-valuenow`, `aria-label`),
     `link` = resolved href, `attribute`, and `value`.
   - The header comment names the new rule.
6. **`resolve-target.ts`** (item 5): no edit needed for the confirmed path. I
   confirmed it by reading; it has no DOM test. When the recorded selector
   answers with the build row's control:
   - `vetoExactMatch` asks the record gate first (`identity/veto.ts:229`), so
     the veto refuses the control as `other-record` and the resolver records a
     miss.
   - The visual-target and fingerprint attempts reach the same veto. When
     `findClosestFingerprint` returns row 1 again, it is refused again.
   - The final `scoreFamily` hands every same-family candidate to
     `scoreTargetCandidates`, which filters by `agreesWithRecordedRecord` before
     ranking (`identity/score.ts:182`). The one control in the pass's row is
     ranked alone, so there is no runner-up, and it resolves when it clears the
     floor and corroborates exactly.
   - A generic selector matching every row goes the same way through the "several
     survived" branch.
   - See the open questions for the two cases where this still fails.
7. **`docs/architecture/page-evidence.md`**, Repeated Controls section, got one
   paragraph on loop-row scoping.

Tests added:
- `output-nodes/tests/definitions.test.ts` (1): which nodes declare `item`.
- `output-nodes/tests/native-runtime.test.ts` (6): with a row, bounds,
  without a row, non-object and empty rows, no recorded record, and a type step.
- `output-nodes/targets/tests/targets.test.ts` (4): normalizer bounds,
  round-trip and non-array; wire target carries values; values outrank an
  adapted record; a record without values still yields.
- `client/tests/gateway-mapping-identity.test.ts` (1): node, then Core's
  rewrite, then wire target and declared `command.element` all carry
  `{ values }`.
- `content/identity/tests/record.test.ts` (6): row accept and refuse, values
  beat key and text, all values required, href/attribute/button words,
  whitespace and empty values, fail closed with no record.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w5 domain" pnpm --filter @fluxiq-web-extension/domain test`
  exited 0 and printed `# tests 917 # pass 917 # fail 0`. The log shows the
  new tests as ok 87, 205-208, 225 and 239-244.
- `heavy.sh "t195 w5 domain check" pnpm --filter @fluxiq-web-extension/domain check`
  exited 0 (tsc for source and tests).
- `EXTENSION_TEST_BUILD_LABEL=t195w5 heavy.sh "t195 w5 extension" node apps/extension/scripts/test-extension.mjs`
  ran twice, before and after the `URL.canParse` change. Both runs exited 0
  with `# tests 1228 # pass 1228 # fail 0`, and the new tests are ok 723-728.
- `heavy.sh "t195 w5 extension check" pnpm --filter @fluxiq-web-extension/extension check`:
  - First run, before the `canParse` change: exit 0.
  - Second run: **exit 1**. The only errors are
    `src/content/extraction/pagination.ts(242,7): error TS2412 ... exactOptionalPropertyTypes`.
    That file is being edited concurrently by another worker: it is modified,
    and a new untracked `load-retry.ts` is beside it. I did not touch it. No
    error names a file of mine.
- `node scripts/structure-audit.mjs`:
  - First run: FAIL `[failure-as-empty]` at `record.ts:276`, a
    `try { new URL } catch { return undefined }`. I replaced it with
    `URL.canParse`, which `content/extraction/pagination.ts` already uses.
  - Re-run: `structure-audit: passed (125 warning(s), 120 baselined).`, exit 0.
    The only advisory on a touched file is the pre-existing one:
    `targets.ts` 465 lines, over the 400-line advisory.

## Not verified

- No browser run or Lab run, as the brief forbids them. Nothing here was run
  against a real page.
- The resolve-target fallback was confirmed by reading only, because it needs a
  DOM.
- End-to-end with Core: whether Core's t195-w4 actually delivers the row in
  `context.inputs.item` for these nodes. The domain side is tested with a
  hand-built context.
- `commandElementFingerprint` in the superseded branch, when the wire target has
  no `element` and the fallback `adaptedTarget.element` is used: that path
  would not carry `values`. It is reached only when the wire target carries no
  element at all.

## Open questions or contradictions found

1. **The family cap comes before the record gate.**
   - `identity/candidates.ts` `collectTargetCandidates` stops at
     `MAX_CANDIDATES = 60` family members in document order. `score.ts` filters
     by record only after that.
   - With a positional recorded selector, which `repeat-exemplars`/`selector/`
     usually produce for a row control, the pass's row resolves only if its
     control is among the page's first 60 same-family elements (e.g. buttons).
     On a results page with a few buttons per card plus header and filter
     buttons, later rows would fail as not found, with `truncated: true`.
   - This predates the change, since key records had the same limit, but loops
     make it the main path.
   - Suggested fix, for a file outside this brief:
     `collectTargetCandidates(family, roots, admits?)`, applying the record gate
     before counting toward the cap, and passed from `resolve-target.ts`
     `scoreFamily` only when `record.values` is present.
   - That costs one bounded record read per family member, up to 5,000. It
     needs a per-resolution cache keyed by record element, which `record.ts`
     deliberately does not have today. I left it for the supervisor to assign.
2. **Row-specific labels fail corroboration.** If the recorded control's name
   is row-specific (`aria-label="Add Blue Kettle to cart"`), the pass's row's
   control is the only eligible candidate but does not corroborate exactly
   (`corroboratesExactly`), so it is `unmatched`. Loosening corroboration when
   `values` scoped the pool to one row is a policy decision I did not make.
3. **The fallback reads `values` in key order.** Native runtime takes the row's
   first 8 non-empty string fields in key order. A row with more than 8 fields
   is identified by its first 8.
4. **Budget misses fail closed.** A value that lies past the bounded read
   (4,000 characters or 2,000 nodes) makes the row disagree.
