# x1-domain-contracts: the domain share of X1

## Outcome

Done, with one audit failure outside this brief. On the final source the domain check passes and the labelled domain tests pass: 413 of 413, and every module-scope script printed its pass line. The structure audit exits 1 on one violation only, `[working-docs] docs/working/README.md is out of date`. That is not a file this brief owns. It failed identically on the first run and on the one rerun, and my files show only advisory warnings.

I checked seven mutations and saw each go red. The first ran on the real source and was reverted. The permission classifier then refused a test run against the real source with the encrypt refusal removed. As the brief directs, that mutation and the other five were proven on a scratch copy outside the repository.

## What changed and why

### X1.1: domain C1 and C2 types

New directory `domain/src/actions/extraction/`:

- **`request.ts`.** The C1 types, each with doc comments:
  - `WebAutomationExtractFieldKind` and `WebAutomationExtractFieldHandling`, with `encrypt` reserved;
  - `WebAutomationExtractFieldSpec` and `WebAutomationExtractField` (string or spec);
  - the `mode` union `WebAutomationExtractListPagination` (`next` when absent, `loadMore`, `scroll`, `numbered`);
  - `WebAutomationExtractListRequest`, which gains `itemElement` and `Record<string, WebAutomationExtractField>` fields.

  The two constants `WEB_AUTOMATION_EXTRACT_MAX_PAGES` (50) and `WEB_AUTOMATION_EXTRACT_MAX_ITEMS` (1,000) moved here. Three vocabulary arrays are new: `WEB_AUTOMATION_EXTRACT_PAGINATION_MODES`, `..._FIELD_KINDS` and `..._FIELD_HANDLINGS`. The schema and the lift share them, so the vocabulary is written once. It imports `WebAutomationElementFingerprint` type-only from `../types`.
- **`summary.ts`.** `WebAutomationExtractionSummary` is `{ recordCount; pagesRead; truncated; missingFields; fieldNames }`. Also `webAutomationExtractionSummaryValue(value)`, the field-by-field copy. It drops the whole summary when any of these holds:
  - a count is not a non-negative integer;
  - `truncated` is not a boolean;
  - a string is not a well-formed field key;
  - `missingFields` is not a subset of `fieldNames`.
- **`field-key.ts`.** `isWebAutomationExtractFieldKey` implements D16. A key is `^[A-Za-z0-9_-]{1,100}$` and never `__proto__`, `constructor` or `prototype`.
- **`schema.ts`.** `webAutomationExtractListSchema(elementFingerprintSchema)`; see X1.4.
- **`index.ts`.** The barrel.

`domain/src/actions/types.ts`:

- The old pagination type, request type and two constants are removed.
- It re-exports the moved and new types with `export type { ... } from "./extraction"`, and the two constants with `export { ... } from "./extraction"`. Existing importers are unchanged, including `client/index.ts`, `content/types.ts` and `shared/protocol.ts`.
- It adds `WebAutomationDialogKind` and `WebAutomationObservedDialog` (`kind`, `message`, `response`, `promptText?`, `at`), mirroring the extension's `DialogObserved` (`shared/dialog-channel.ts`), next to `WebAutomationDialogRequest`.
- `WebAutomationActionResult` gains `extraction?: WebAutomationExtractionSummary` and `dialog?: WebAutomationObservedDialog`.

### X1.2: the domain share

In `domain/src/client/gateway-action-parameters.ts`:

- **`fieldMapValue`.**
  - Each key must pass the D16 predicate.
  - Each value is a non-empty string or a spec read by the new `fieldValue`.
  - Any unreadable entry refuses the request whole, and so does a map with no entries.
  - A map in which every field is `handling: "exclude"` is refused too (D12).
- **`fieldValue`.**
  - `kind` must be in the set.
  - `attribute` is required and non-empty for `attribute` and refused on every other kind. `header` works the same way for `column`.
  - `selector` is optional but non-empty; `required` is optional but a boolean; `handling` is optional but in the set.
  - `element` goes through `elementFingerprint`, the one normalizer. A non-object, or an object with no recognized signal, is refused.
  - A spec property that was sent but cannot be read refuses the field; it is not dropped. A private `REFUSED` marker and `optionalValue` helper tell "sent but unreadable" apart from "absent".
- **`itemElement`.** Normalized the same way. Sent but malformed, it refuses the request.
- **`paginationValue`.**
  - It reads per `mode`; an absent mode is `next`, and `next` is always lifted in today's shape, with no `mode` key.
  - An unknown or non-string mode is refused, and so is a mode missing its own control or bound.
  - A key that belongs only to another mode is refused (for example `next` on `scroll`, or `maxPages` on `scroll`). Other unknown keys are ignored, as elsewhere in the lift.
  - `maxPages` and `maxScrolls` are clamped to `WEB_AUTOMATION_EXTRACT_MAX_PAGES`. For `maxScrolls` that matches test-contracts' `pageBound`.

In `domain/src/client/gateway-mapping.ts`, `webAutomationActionFromGatewayCommand`:

- After the required-field check, a `web.dom.extract_list` command whose lifted `extractList` has any `handling: "encrypt"` field is rejected with `WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED`: `blocked_by_capability_or_policy`, dispatch stage, not retryable.
- The message and the failure record name field keys only, at most five by name plus "and N more". They never include a selector or a value.
- The checks keep a fixed order: unknown type, then unmet run-time value, then unreadable required field, then encrypt.

### X1.3: payload copy

`webAutomationActionResultPayload` copies `extraction` through `webAutomationExtractionSummaryValue`. It copies `dialog` through a new private `observedDialogValue`: the five declared fields only, and a malformed dialog is left out. Absent fields stay absent.

### X1.4: schemas

`extractListSchema` moved to `extraction/schema.ts` as a factory. `actions/schemas.ts` passes its own `elementFingerprintSchema`, so the item and field element schemas are identical and there is no runtime import cycle. It adds:

- `itemElement`;
- `paginate` with no `required` array: a `mode` enum (`next`, `loadMore`, `scroll`, `numbered`), plus `next`, `control`, `pages`, `maxPages` and `maxScrolls`, both bounds having minimum 1 and maximum 50;
- `minItems` with `minimum: 0` and `maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS` (D14, and x0-domain's open question 2);
- the field spec, including the `handling` enum with `encrypt`, described under `fields.metadata.fieldSpec`.

`fields` stays `type: "object"`, and there is no `oneOf` anywhere (Core K1).

### Tests

- **`actions/tests/schemas.test.ts`.**
  - The pagination row now checks: no `paginate.required`, the `mode` enum order, the three selector properties, and both bounds.
  - The records row adds `minItems.maximum`.
  - A new row covers the field spec under `metadata`: the kind and handling enums, `itemElement` and the field `element` deep-equal to the click action's `element` schema, and no `oneOf`.
- **`client/tests/gateway-command-parameters.test.ts`.** All existing rows stand, and the exact rows at `:207-211` are untouched. One existing row, `paginate?.maxPages`, became a `deepEqual` on `paginate`, because the union no longer lets that property be read without narrowing. It asserts the same bound. New rows:
  - every spec kind lifts, including a spec that reads the item itself and an optional included field;
  - strings and specs mix;
  - `element` and `itemElement` equal `elementFingerprint`'s output;
  - the lift reads `encrypt`;
  - 15 malformed-spec rows, plus two malformed `itemElement` rows, are refused whole;
  - D16 keys: a 100-character key lifts, while `"Product name"`, `"price.amount"`, `"prix€"`, a 101-character key, `constructor`, `prototype` and a JSON `__proto__` are refused;
  - six pagination rows lift, including explicit `next` normalized and both clamps, and nine pagination rows are refused.
- **`client/tests/gateway-mapping.test.ts`.**
  - `encrypt` is refused with `web.action.not_implemented`, with category, stage and retryable checked. Core's parser keeps the record whole, the message names `card_number`, and the serialized rejection has no selector sentinel.
  - The same field set to `include` or `exclude` is dispatched, a click carrying the same map is not refused, and a malformed map is still refused as `web.action.invalid_parameter`.
  - The summary is carried, including when truncated. Unknown keys and page text beside it are left behind, and every string in it is a declared key. Seven malformed summaries are dropped.
  - A dialog result carries `dialog` and no `extracted`. The dialog is copied field by field, and five malformed dialogs are dropped.
  - Results with neither gain neither.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension`, one at a time and never concurrently.

1. `pnpm --filter @fluxiq-web-extension/domain check`, first run: exit 2, from `src/client/tests/gateway-command-parameters.test.ts(94,173): error TS2339: Property 'maxPages' does not exist on type 'WebAutomationExtractListPagination'`. `tsc -p tsconfig.json` passed; only the test config failed. I fixed the row as described above.
2. The same check: exit 0, no output from either `tsc`.
3. `DOMAIN_TEST_BUILD_LABEL=x1-domain pnpm --filter @fluxiq-web-extension/domain test`: exit 0, `# tests 413`, `# pass 413`, `# fail 0`. It printed "Web automation gateway command parameter tests passed.", "Web automation gateway mapping tests passed.", "Gateway input hub tests passed." and "Web automation input model tests passed.". No entry failed to load.
4. `node scripts/structure-audit.mjs`: exit 1, "structure-audit: 1 violation(s) across 1 rule(s)."
   - The violation: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.`
   - My files show only advisory warnings: `domain/src/actions/types.ts` 461 lines, `domain/src/client/gateway-action-parameters.ts` 440, `domain/src/client/gateway-mapping.ts` 512, `domain/src/client/tests/gateway-mapping.test.ts` 685. All are under 800, and nothing under `actions/extraction/` was flagged.
5. **M1, real source.** In `fieldValue`, `kind` was changed to accept any string. The labelled test exited 1 with "Domain test entry failed to load: src/client/tests/gateway-command-parameters.test.ts" and `AssertionError [ERR_ASSERTION]: web.dom.extract_list was dispatched: an unknown kind`. Reverted.
6. **M2, real source.** `if (false && encrypted.length > 0)`. The test run was **refused by the permission classifier** ("[Security Weaken]"). I reverted it at once, and a Grep confirmed `if (encrypted.length > 0) {` and the `memberOf(spec?.kind, ...)` line were back.
7. **Scratch harness.** `domain/src` was copied to the session scratchpad (`...\scratchpad\x1-mutation\src`, 151 files), with a directory junction `node_modules` pointing to `domain/node_modules`. A scratch runner, `run-entry.mjs`, bundles named entries with the same esbuild options as `domain/scripts/test-domain.mjs` and imports each one.
   - Baseline on the clean copy, running the mapping, parameter and schema entries: exit 0, both script pass lines, `# tests 13`, `# pass 13`, `# fail 0`.
   - Each mutation below restored its files from the real source, applied a literal replace checked to match exactly once (`MATCHES=1`), and ran one entry.
   - **M2**, encrypt refusal disabled, mapping entry: exit 1, `AssertionError [ERR_ASSERTION]: an encrypt field is not dispatched`.
   - **M3**, `extraction` omitted from the payload copy, mapping entry: exit 1, `AssertionError [ERR_ASSERTION]: the summary is carried`.
   - **M4**, `maxItems.maximum` dropped, schema entry: exit 1, `not ok 6 - web.dom.extract_list bounds the records it returns and lets a Flow say an empty list is an answer`, `# fail 1`.
   - **M5**, `minItems.maximum` dropped, schema entry: exit 1, the same `not ok 6`, `# fail 1`.
   - **M6**, D16 key check removed, parameter entry: exit 1, `AssertionError [ERR_ASSERTION]: web.dom.extract_list was dispatched: a field key Core would refuse: "Product name"`.
   - **M7**, all-excluded refusal removed, parameter entry: exit 1, `AssertionError [ERR_ASSERTION]: web.dom.extract_list was dispatched: every field excluded, which reads nothing`.
   - Afterwards the junction was removed with `rmdir`, and the domain package's `node_modules\esbuild` was confirmed present.
8. A Grep of the real source confirmed all seven guarded lines are present and no `false &&` remains.
9. Final `pnpm --filter @fluxiq-web-extension/domain check`: exit 0.
10. Final labelled test: exit 0, `# tests 413`, `# pass 413`, `# fail 0`, all four script pass lines, no load failures.
11. `node scripts/structure-audit.mjs`, the one rerun: identical to run 4. Exit 1 on the same single `working-docs` violation, with the same four advisories.

No single-observation crash occurred; nothing needed a rerun for hardware reasons.

## Not verified

- **The extension is not type-checked or tested.** The brief excludes it. Changing `fields` to `Record<string, WebAutomationExtractField>` and `paginate` to a union is expected to break the extension type check until the W1-B page brief lands, at `apps/extension/src/content/action-runtime/list-extraction.ts`:
  - `:117`, `parseExtractField(spec)` with a spec value;
  - `:119`, `request.paginate.maxPages` on `scroll`;
  - `:147`, `:155` and `:167`, `paginate.next`.

  I found these by Grep and did not compile them. `content/actions/dialog.ts:30-33` still puts dialog evidence on `extracted`, and the page does not yet produce `extraction`.
- **M2-M7 ran on a scratch copy** with a single-entry runner, not the repository's `test-domain.mjs` over all 55 entries. The runner's esbuild options are copied from that script, and a baseline on the clean copy passed first.
- **The recording reducer and runtime adapter** (`recording/reducers.ts`, `runtime/adapter.ts`, W3) were not read or tested with results carrying `extraction` or `dialog`.
- **Whole-repository `pnpm check`, `pnpm test` and `pnpm build`** were not run.
- **Tracked `domain/.test-build/` was not written.** Every run used the `x1-domain` label, and `git status -- domain` shows only my source and test files plus `domain/src/actions/extraction/`.
- **Dataset ids (D16).** No X1 contract carries a dataset id, so nothing was added. Per the X3-X5 plan, the id pattern check lands with X4's recorded definition.

## Open questions or contradictions found

1. **Where the field spec is described (judgement call).** With no `oneOf`, the spec schema, including the `handling` enum, sits under `fields.metadata.fieldSpec`. `metadata` is the free-form keyword Core's recording schema dialect admits, and Core's node parameters ignore domain schemas beyond storing them. The key name `fieldSpec` is my choice; Phase 3.7's editor should confirm or rename it.
2. **Stricter than the report in two places (judgement call).**
   - An `attribute` on a non-`attribute` kind, or a `header` on a non-`column` kind, is refused rather than dropped. Dropped, the page would read something other than what the field names.
   - A pagination key that belongs only to another mode is refused. This mirrors test-contracts' `additionalProperties: false` per mode. The tab precedent drops foreign keys instead.
3. **Explicit `mode: "next"` is lifted without `mode`**, so the page sees exactly today's shape. The type still allows `mode?: "next"`.
4. **The encrypt refusal applies to `web.dom.extract_list` only**, the one verb that reads the field map. A click whose parameters happen to hold an `extractList` is not refused (pinned by a test row).
5. **D16 predicate placement.** The key predicate is `domain/src/actions/extraction/field-key.ts` (`isWebAutomationExtractFieldKey`). X3.3 plans the label-to-key function at `domain/src/extraction/field-key.ts`. It should import this predicate rather than restate the pattern, and its "every output matches" test can assert against it. The two files would share a basename in different directories.
6. **Dialog `promptText` still leaves the browser.** It is the Flow-supplied reply to a `prompt` and could be a run-supplied value. It rode on `extracted` before with no element descriptor to judge, and the copy keeps today's behaviour. Recommend a decision on whether the wire should withhold it.
7. **The summary copy drops the whole summary** if `missingFields` is not a subset of `fieldNames`, or any name is not a key. The page (W1-B) must build `fieldNames` from the declared, non-excluded keys, as X1.3 says, or the summary silently disappears from the wire. A page-side test should pin that.
8. **New values are not in `client/index.ts`.** Only the re-exported types and the two constants reach `@fluxiq-web-extension/domain/client` through `types.ts`. The vocabulary arrays, the key predicate, the summary copy and the schema factory reach `domain/src` only through `actions/extraction`. Adding them to the client barrel is outside this brief, and the X3 plan re-exports its own extraction barrel there.
9. **The `working-docs` audit failure is not from this brief.** `docs/working/README.md` is reported out of date. `docs/working/first-class-data-extraction-plan.md` was already modified at session start, and I edited no working document. The audit's own remedy is `pnpm structure:baseline`, a supervisor action.
10. **Line endings.** `git diff` warns "LF will be replaced by CRLF" for the six edited files that git tracks, as it did in `x0-domain`. The content is unaffected.
