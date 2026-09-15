# x0-x1-execution: X0 and X1 as executable steps

Read-only. This file is the only thing written. Paths are relative to
`F:\!FluxIQWebExtension`. "(reasoned)" means traced by hand; nothing was executed
except the read-only listing commands below. The session was interrupted once by a
machine crash; the reads were resumed from context, and no file was left half-read.

## Outcome

Done. Part 1 checks the two reports and the plan's C1, C2, D2, D4, D12 and D13
against the code. Part 2 lists the X0 steps and Part 3 the X1 steps. Each step
names its files with the function or type and file:line, its test cases, the
command that accepts it, and a mutation target. Part 4 gives the worker
partition, the files that must be serial, the order, and the structure budgets.

The corrections that change the plan:

1. **The leak is wider than `.value`.** `web.dom.extract` also returns a sensitive
   control's `value` *attribute* in attribute mode (`content/action-runtime/extract.ts:9`),
   and the sensitive-input fixture renders secrets in `value` attributes
   (`apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts:54`). A list
   field `input@value` does the same (`list-extraction.ts:141`). X0 must refuse
   **every** read whose resolved element is a sensitive control, in every mode,
   not only the live `.value`.
2. **One domain seam covers all three exits.** The gateway result
   (`apps/extension/src/runtime/result-mapping.ts:60`), the runtime confirmation
   (`background/connection/server-command-channel.ts:231`) and the `action.result`
   recording event (`server-command-channel.ts:196-206` → `gateway-payloads.ts:76`,
   sent at `recorded-event-intake.ts:189,200`) all pass through
   `webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts:270-287`).
   ex-a §2 implied the confirmation carried the raw result. The two readers
   downstream do not re-check `extracted`:
   - the Core-side adapter, whose payload guard returns early on a validation
     of `none`, and `none` is exactly what extract returns
     (`domain/src/runtime/adapter.ts:310`);
   - the recording reducer (`domain/src/recording/reducers.ts:49`).
3. **Nothing that runs today depends on an empty list passing through FluxIQ's
   `extract_list`.** W06 `no-results` is judged by no lane. The scenario step
   contract has no `minItems` field to declare the opt-out in. D4's opt-out
   therefore needs the X1 contract field. The `minItems` request field itself
   lands in X0.
4. **The two reports named the pagination discriminator differently.** ex-a
   uses `mode` and ex-d uses `kind`. Use `mode` in both the domain and
   test-contracts, following `WebAutomationScrollRequest.mode`
   (`domain/src/actions/types.ts:128-131`). A field spec already uses `kind`.
5. **A premise in `list-extraction.ts` is out of date.** Its comment says the
   content script must not import domain runtime values (`:38-44`). It already
   does, in four files: `action-runtime/results.ts:40-46`,
   `action-runtime/resolve-target.ts:102`, `actions/execute.ts:58` and
   `actions/page-identity.ts:58`.
6. **Honouring `timeoutMs` makes Core's default command timeout bind.** That
   default is 5,000 ms (`adapter.ts:84-90`). The `extract_list` node declares no
   `timeoutMs` parameter (`output-nodes/definitions.ts:141`), while selector
   nodes default to 10,000 ms (`:112`).

## Part 1: The reports and design checked against the code

| Claim | Verdict | Evidence |
| --- | --- | --- |
| `extract` returns `.value` for input, textarea and select | True, and wider (attribute `value`, `html`) | `action-runtime/extract.ts:6-12`; fixture `sensitive-input/scenario.ts:54` |
| `mode` and `attribute` exist only in `options` | True | `schemas.ts:50-57,291`; `gateway-mapping.ts:180` |
| The wire guard covers `validation` only | True | `gateway-mapping.ts:275,322-327`; `extracted` at `:282` |
| The adapter re-checks only the comparison | True; skips validation `none` | `adapter.ts:103-104,120,307-323` (`:310`) |
| The reducer writes `runtime.lastActionResult` unguarded | True | `reducers.ts:49` (compare the forms guard at `:40-42`) |
| G3: an empty list passes | True (reasoned) | `list-extraction.ts:97-105`; `extract-list.ts:39-40` |
| The sign-in-gate hook needs `action.selector` | True | `results.ts:278-286` |
| G4: "load more" duplicates records | True (reasoned) | re-read at `list-extraction.ts:97-104`; count change counts as a page at `:185` |
| No default or hard item cap | True | lift `gateway-action-parameters.ts:183`; schema `schemas.ts:156`; page `list-extraction.ts:89` |
| `timeoutMs` is ignored by the page | True | `list-extraction.ts:48,119`; the command carries it (`gateway-mapping.ts:175`) |
| The Lab reader silently drops non-string values | True | `packages/test-runner/src/flow-lane/persisted-flow-run.ts:385-397` (`:394`) |
| `extracted` also carries dialog evidence | True | `content/actions/dialog.ts:30-33`; read at `e2e/content/tests/upload-dialog.spec.ts:129` |
| D2's category comes from ACTION_REJECTED | True | `domain/src/runtime/failure/codes.ts:27,124`; `actionRejected` at `results.ts:176-204` |
| A thrown value's failure record is honoured | True | `results.ts:102-120` |
| W06 `no-results` expects `count: 0` and is never judged | True | `product-catalog/manifest.ts:95-103`; `flow-lane/expectations.ts:72-75,88-89`; `recordable-actions.ts:55,68` |
| No fixture has a "load more" control | True | a search for `load-more`, `Load more` and `loadMore` in `apps/scenario-lab/src` finds nothing |
| C1 needs a request `timeoutMs` | Redundant | the command field already exists (`types.ts:224`) and reaches the page |

### Everything that expects an empty list (D4 audit)

- **Content harness.** None. Every `extract-list.spec.ts` case expects 3 or more
  records (`:78-232`). `content/actions/tests/execute.test.ts:193-195` uses a
  never-settling `extractList`.
- **Lab scenarios.**
  - W06 `no-results` (`product-catalog/manifest.ts:95-103`, step `:84`) needs
    `minItems: 0` once the step contract has it (step X1.5).
  - W15 `popup-blocked` (`multi-tab/manifest.ts:62`) and W19 `expired`
    (`auth-gate/manifest.ts:83`) use `extracted: []`, which means "not expected"
    (`expectations.ts:73`). They are unaffected.
- **Contract test fixtures.** `packages/test-contracts/tests/scenario-validation.test.mjs:79`
  (the `no-results` count 0 fixture) needs `minItems: 0` if the validator rule
  in X1.5 lands.
- **Run-outcome literals with `extracted: []`.** These mean "no extract attempt"
  and are unaffected by D4, but they are touched by X0.7's new field:
  - `flow-lane/tests/run-flow-lane.test.ts:260`;
  - `flow-lane/tests/lane-observation.test.ts:8`;
  - `run-evaluation/tests/single-run-evaluation.test.ts:85,134`.
- **Fixture oracle.** `apps/scenario-lab/e2e/product-catalog.spec.ts:38-39`
  checks the fixture, not FluxIQ.

## Part 2: X0 steps (security and correctness)

Each worker iterates with a build label so tracked test output is not rewritten:
`DOMAIN_TEST_BUILD_LABEL=<slug>` (`domain/scripts/test-domain.mjs:13-19`) and
`EXTENSION_TEST_BUILD_LABEL=<slug>`. Heavy commands run one at a time. A content
harness run passes `--workers=2`; the config pins 4
(`apps/extension/e2e/playwright.content.config.ts:17-18`).

### X0.1 Refuse a sensitive control on the page (D2)

**Files**

- **`content/action-runtime/extract.ts:6-12` `extractElement`.** Return
  `ExtractedElementValue = { ok: true; value: JsonValue } | { ok: false; refusal: "sensitive_value" }`.
  The first statement is `if (isSensitiveFormControl(element)) return { ok: false, refusal: "sensitive_value" }`,
  importing from `../element-traits`, as `actions/type.ts:35` does. It applies
  to **every** mode: default, `attribute` and `html`.
- **`content/action-runtime/index.ts:6-19`.** Export the type
  `ExtractedElementValue`.
- **`content/actions/types.ts:52`.** Change the `extractElement` signature.
- **`content/actions/extract.ts:10-19` `extractAction`.** On a refusal, return
  `deps.rejected(action, startedAt, "sensitive_value", "a readable element that is not a sensitive control", "the target is a sensitive control, so its value is never read", { element: deps.describeElement(element), resolution })`,
  with no `extracted`. The `sensitive_value` reason is not a modal refusal
  (`results.ts:305`).
- **`content/action-runtime/list-extraction.ts:127-143` `readRecord` and
  `readField`.** When the resolved field element is a sensitive control, throw
  an error carrying
  `failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected: "field <name> reads no sensitive control", actual: "sensitive_value: field <name> resolved to a sensitive control, so its value is never read" })`.
  `readRecord` passes `name` in. The field name is author-declared; no value is
  quoted. `actionFailure` lifts the record (`results.ts:104-111`), so the whole
  action is refused. D12's Exclude column is how an author leaves such a field
  out. `readColumn` reads table cells, not controls, so it is unchanged.

**Tests**

- New `content/actions/tests/extract.test.ts` (node:test, fake deps, no DOM):
  - "a refused read is rejected as sensitive_value and carries no extracted";
  - "an allowed read succeeds with an evidence-only validation".
- `e2e/content/tests/actions.spec.ts`, a new case after `:189-204`: "extract: a
  sensitive control is refused in every mode", on `sensitive-input`.
  - Selectors: `[data-testid="password"]`, `[data-testid="payment"]` and
    `[data-testid="billing"]`.
  - Modes: default, `{ mode: "attribute", attribute: "value" }` and
    `{ mode: "html" }`.
  - Expect `status: "failed"` and
    `failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }`.
  - Expect no `extracted` key, and `JSON.stringify(reply)` must contain none of
    `SYNTHETIC_PASSWORD_DO_NOT_USE`, `4111111111111111` or `4222222222222220`.
  - Control: `input[name="username"]` still returns `synthetic-user@example.test`.
  - The existing `:189-204` case (basic-form `NAME`, an ordinary control) must
    stay green.
- `e2e/content/tests/extract-list.spec.ts`, a new describe "on sensitive-input":
  `item: '[data-testid="sensitive-form"] label'`, `fields: { value: "input@value" }`.
  Expect `failed`, `web.action.rejected`, and the same whole-reply scan.

**Accept.** `pnpm --filter @fluxiq-web-extension/extension check`, then
`EXTENSION_TEST_BUILD_LABEL=x0-page node apps/extension/scripts/test-extension.mjs`,
then `pnpm --filter @fluxiq-web-extension/extension test:content -- actions extract-list --workers=2`.

**Mutation targets**

- Delete the `isSensitiveFormControl` line in `extract.ts`: the actions.spec
  case fails.
- Delete the `readField` check: the sensitive-input list case fails.
- Make `extractAction` ignore `ok: false`: the unit case fails.

### X0.2 Each reader checks `extracted` again

**Files**

- **`domain/src/client/gateway-mapping.ts:270-287` `webAutomationActionResultPayload`.**
  Set `extracted` to `undefined` when `isSensitiveElementDescriptor(result.element)`,
  through a private helper beside `webAutomationSecretSafeValidation` (`:322`).
  This one change covers the gateway result, the runtime confirmation and the
  `action.result` recording.
- **`domain/src/runtime/adapter.ts:103-120,307-323`.** Remove `result.extracted`
  from the dispatch payload whenever
  `isSensitiveElementDescriptor(clientResult?.element)`. The check must not
  depend on `producerDeclaredRedaction` or on the validation status, so the
  early return at `:310` must not skip it.
- **`domain/src/recording/reducers.ts:49`.** Write `runtime.lastActionResult`
  without `extracted` when `isSensitiveElementDescriptor(actionResult.element)`.

**Tests**

- `domain/src/client/tests/gateway-mapping-redaction.test.ts`, using the style
  and sentinel at `:29` and `:35-47`:
  - "a sensitive element's extracted value never reaches the wire": a
    `web.dom.extract` result with the element used at `:43` and
    `extracted: producerSentinel`; the serialized payload has no sentinel;
  - "an ordinary element's extracted value is carried".
- `domain/src/runtime/tests/adapter-redaction.test.ts`: an extract result with a
  validation of `none`, a sensitive element and a sentinel `extracted`; the
  serialized runtime result has no sentinel.
- `domain/src/recording/tests/reducers.test.ts`, following the style at `:56-73`:
  an `actionResult` with a sensitive element loses only `extracted`.
- Control: `apps/extension/src/runtime/tests/result-mapping.test.ts:123-133`
  (ordinary element, `extracted` kept) stays green.

**Accept.** `pnpm --filter @fluxiq-web-extension/domain check`, then
`DOMAIN_TEST_BUILD_LABEL=x0-readers pnpm --filter @fluxiq-web-extension/domain test`.
There is no single-file filter.

**Mutation targets.** Revert each of the three guard lines; its row fails.

### X0.3 Empty lists fail (D4), and a sign-in wall says so

**Files**

- **Domain `actions/types.ts:162-167` `WebAutomationExtractListRequest`.** Add
  `minItems?: number | undefined`, documented as default 1.
- **Domain `actions/schemas.ts:140-158`.** Add
  `minItems: { type: "integer", label: "Minimum items", minimum: 0 }`.
- **Domain `client/gateway-action-parameters.ts:176-185` `extractListRequestValue`.**
  - Read `minItems` with `nonNegativeInteger` (`:294`).
  - A present but unreadable `minItems`, or `minItems > maxItems`, refuses the
    whole request, as a malformed `paginate` does (`:181-182`).
- **Page `content/actions/extract-list.ts:36-42` `validationFor`.**
  - Pass `request.minItems ?? 1`.
  - Fail when `records.length < minItems`.
  - `expected` becomes "at least N record(s), each carrying <fields>".
  - `success()` turns the failed validation into OUTPUT_NOT_OBSERVED
    (`results.ts:144-160,239-243`).
- **Page `content/action-runtime/results.ts:278-286` `authGateFailure`.** Treat
  `action.extractList?.item` matching nothing (`selectorMatchesNothing`,
  `:366-372`) as "missing". An empty list on a sign-in gate then reports
  AUTH_REQUIRED rather than OUTPUT_NOT_OBSERVED.

**Tests**

- `domain/src/client/tests/gateway-command-parameters.test.ts:85-97`, using the
  `mapped` and `refusedWhole` helpers (`:20-40`):
  - `minItems: 0` is lifted;
  - `minItems: -1` and `"1"` are refused whole;
  - `minItems: 5` with `maxItems: 3` is refused whole.
- `domain/src/actions/tests/schemas.test.ts:78-90`: `minItems` is an integer
  with minimum 0.
- `e2e/content/tests/extract-list.spec.ts`:
  - (a) "an item selector matching nothing fails with output_not_observed", on
    product-catalog with `item: '[data-testid="no-such-card"]'`: `status: "failed"`,
    `failure.category: "output_not_observed"`, `extracted: []`;
  - (b) "minItems: 0 lets an empty list succeed": `succeeded`, `extracted: []`;
  - (c) "an empty list on a sign-in gate is auth_required", on `auth-gate`, whose
    start path `/scenarios/auth-gate/` (`auth-gate/constants.ts:3`) renders the
    sign-in form with a password control (`pages.ts:22-25`), reasoned: expect
    `failure.category: "auth_required"`.

**Accept.** The domain commands from X0.2, then the extension commands from
X0.1 with `-- extract-list`.

**Mutation targets**

- Default `minItems` to 0: case (a) fails.
- Drop the `extractList` branch from `authGateFailure`: case (c) fails.
- Drop the lift's unreadable-`minItems` refusal: its domain row fails.

### X0.4 De-duplicated append pagination

**Files.** `content/action-runtime/list-extraction.ts:91-122` `extractList`.
Keep `const read = new Set<Element>()` across pages. Skip an element already in
it, and add every element read. A page that replaces its nodes repeats none, so
product-catalog is unchanged. An appending page reads only its new items.

**Tests.** `e2e/content/tests/extract-list.spec.ts`: "an appending Next reads
each item once", on `basic-form`. No fixture has a load-more control, so inject
one with `page.evaluate`, the way `insertLateParagraph` does
(`actions.spec.ts:45-53`):

- a `<ul data-testid="feed">` with 3 items;
- a `<button data-testid="more">` that appends 2 items after 50 ms, and removes
  itself on its second click.

Expect 7 distinct records and validation actual "7 records from 3 pages".

**Accept.** The extension commands from X0.1 with `-- extract-list`.

**Mutation target.** Remove the skip: 3 + 5 + 7 = 15 records, and the case fails.

### X0.5 Item cap

**Files**

- **Domain `actions/types.ts:391-392`.** Add
  `WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1_000` (recommended value: it fits
  admin-console's 240, and ex-d's proposed 2,000-row `large-table` then expects
  `truncated`).
- **Domain `actions/schemas.ts:156`.** Add `maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS`.
- **Domain `client/gateway-action-parameters.ts:183`.** Clamp to the cap, as
  `maxPages` is clamped at `:202`.
- **Page `list-extraction.ts:45,89`.** Add `EXTRACT_MAX_ITEMS`, and set
  `maxItems = min(request.maxItems ?? EXTRACT_MAX_ITEMS, EXTRACT_MAX_ITEMS)`.
  Recommended: mirror the constant with an agreement test, as `:38-45` does.
  Open question 1 is whether to import it instead.

**Tests**

- `content/action-runtime/tests/list-extraction.test.ts` beside `:46-48`: "the
  item bound agrees with the domain's".
- `schemas.test.ts:85`: `maxItems.maximum` equals the cap.
- `gateway-command-parameters.test.ts`: `maxItems: 5_000` lifts to 1,000.
- `extract-list.spec.ts`: "an unbounded read stops at the domain's cap", on
  basic-form with 1,005 injected items: 1,000 records, "truncated".

**Accept.** The domain and extension commands above.

**Mutation target.** Remove the page default: 1,005 records, and the case fails.

### X0.6 Honour `timeoutMs`

**Files**

- **`content/actions/types.ts:64`.** Change the signature to
  `extractList(request, options?: { timeoutMs?: number })`.
- **`content/actions/extract-list.ts:20-32`.**
  - Pass `action.timeoutMs`.
  - On `outcome.timedOut`, return
    `deps.timedOut(action, startedAt, "Timed out extracting the list after N page(s).", { status: "failed", expected, actual }, { extracted: outcome.records, snapshot: deps.captureSnapshot() })`.
  - That gives status `timed_out` and `web.action.timeout` (`results.ts:207-223`).
- **`content/action-runtime/list-extraction.ts`.**
  - `:28-36`: `ListExtractionOutcome` gains `timedOut: boolean`.
  - `:83`: set a deadline only when `timeoutMs` is a positive number.
  - `:113-121`: check the deadline before `next.click()`.
  - `:172-179` `waitForListChange`: wait until the earlier of the deadline and
    `LIST_CHANGE_TIMEOUT_MS`.
  - A deadline reached during the wait returns `timedOut` rather than throwing.
  - Without `timeoutMs`, behaviour is unchanged; the harness specs send none.

**Tests**

- `e2e/content/tests/extract-list.spec.ts`: "timeoutMs: a read that outlasts it
  reports timed_out with the pages it read".
  - Setup: product-catalog, `paginate: { next: NEXT, maxPages: 5 }`,
    `timeoutMs: 100`. The page fetch waits 150 ms
    (`product-catalog/client-script.ts:8,29`), so the wait cannot see page 2 in
    time.
  - Expect `status: "timed_out"`, `failure.code: "web.action.timeout"`, and
    `extracted` equal to `FIRST_PAGE`.
  - Do not assert page state (open question 9).
- `content/actions/tests/execute.test.ts:180-200` must still compile against
  the new signature.

**Accept.** The extension commands from X0.1 with `-- extract-list`.

**Mutation target.** Ignore `timeoutMs`: the reply succeeds with 23 records, and
the case fails.

### X0.7 The Lab's Flow-run reader reports non-string values

**Files**

- **`packages/test-runner/src/flow-lane/persisted-flow-run.ts:385-397` `extractedRecords`.**
  Return `{ records, nonStringValues }`, counting each dropped non-string field
  value and each non-object entry.
- **`persisted-flow-run.ts:35-41` `PersistedFlowAction`.** Add
  `extractedNonStringValues?: number`, set at `:299,311`.
- **`persisted-flow-run.ts:119-128` `PersistedFlowRunOutcome`.** Add
  `extractedNonStringValues: number`, summed beside `:212`.
- **`flow-lane/expectations.ts:88-96` `assertFlowExtraction`.** Take the count.
  When extraction is judged and the count is above 0, throw
  `RunnerFailure("runtime.behavior", "The Flow's extract attempts carried N field value(s) that are not strings", { details: { nonStringValues: N } })`.
  Counts only, per D6.
- **`flow-lane/run-flow-lane.ts:180`.** Pass the count.
- **`run-flow-lane.ts:265`.** Publish `extractionNonStringValues` beside
  `extractionCount`.
- **Fixture literals that need the new field:**
  - `flow-lane/tests/run-flow-lane.test.ts:260`;
  - `flow-lane/tests/lane-observation.test.ts:8`;
  - `run-evaluation/tests/single-run-evaluation.test.ts:85,134`.

**Tests**

- Extend `flow-lane/tests/persisted-flow-run.test.ts:123-131`: the input
  `extracted: [{ name: "Alpha", price: null }, "stray", { name: "Beta", tags: ["x"] }]`
  yields records `[{ name: "Alpha" }, { name: "Beta" }]` and `extractedNonStringValues` 3.
- `flow-lane/tests/expectations.test.ts`: a judged extraction whose records
  match but whose count is 1 throws `runtime.behavior`.

**Accept.** `pnpm --filter @fluxiq-web-extension/test-runner build`, then from
the repository root
`node --test packages/test-runner/dist/flow-lane/tests/persisted-flow-run.test.js packages/test-runner/dist/flow-lane/tests/expectations.test.js packages/test-runner/dist/flow-lane/tests/run-flow-lane.test.js packages/test-runner/dist/flow-lane/tests/lane-observation.test.js`.
The dist layout comes from `packages/test-runner/tsconfig.json`: `outDir dist`,
`rootDir src`.

**Mutation target.** Restore the silent drop (count always 0): both new rows fail.

### X0.8 Documentation

- `docs/architecture/sensitive-values.md:230-239`: extraction now refuses a
  sensitive control in every mode, and `extracted` is checked again at the
  payload, the adapter and the reducer. Page text is still not guarded.
- `docs/architecture/web-capabilities.md:114-118`: `minItems`, the item cap,
  de-duplication and `timeoutMs`.
- The extension client doc's extract lines. These were not read.

## Part 3: X1 steps (contracts)

### X1.1 Domain C1 and C2 types

Recommended layout: a new `domain/src/actions/extraction/` directory holding
`request.ts`, `summary.ts`, `schema.ts` and an `index.ts` barrel. In-place
edits also fit the budget; `types.ts` would reach about 505 lines, past the
400-line advisory and under the 800-line limit.

**Types in `request.ts`**

- **Field.**
  - `WebAutomationExtractFieldKind = "text" | "attribute" | "link" | "value" | "column"`.
  - `WebAutomationExtractFieldHandling = "include" | "exclude" | "encrypt"`.
  - `WebAutomationExtractFieldSpec = { kind; selector?; attribute?; header?; required?: boolean; handling?; element?: WebAutomationElementFingerprint }`.
  - `WebAutomationExtractField = string | WebAutomationExtractFieldSpec`, so
    today's string grammar stays valid.
- **Pagination union** `WebAutomationExtractListPagination`:
  - `{ mode?: "next"; next: string; maxPages: number }`, today's shape;
  - `{ mode: "loadMore"; control: string; maxPages: number }`;
  - `{ mode: "scroll"; maxScrolls: number }`;
  - `{ mode: "numbered"; pages: string; maxPages: number }`, where `pages`
    selects the page controls (product-catalog renders `pagination-page-N` at
    `markup.ts:76`).
- **Request.** `WebAutomationExtractListRequest = { item; itemElement?: WebAutomationElementFingerprint; fields: Record<string, WebAutomationExtractField>; paginate?; minItems?; maxItems? }`.
  There is no request `timeoutMs` (open question 5).
- **Constants.** `WEB_AUTOMATION_EXTRACT_MAX_PAGES` and `..._MAX_ITEMS` move here.

**Types in `summary.ts`.**
`WebAutomationExtractionSummary = { recordCount; pagesRead; truncated; missingFields: string[]; fieldNames: string[] }`.

**`domain/src/actions/types.ts`**

- Remove `:151-167` and `:391-392`.
- Re-export the moved types and constants with a `from "./extraction"` clause.
  Re-exports are not counted as exported values (`scripts/structure-audit/rules/exported-values.mjs:33-35`).
  The existing importers therefore keep working: `gateway-action-parameters.ts:24,32-33`,
  `content/types.ts:38-39`, `shared/protocol.ts:428-429`, and the two domain
  tests.
- `extraction/request.ts` imports `WebAutomationElementFingerprint` type-only, so
  the cycle is erased, as with the precedent at `types.ts:9-14`.
- `WebAutomationActionResult` (`:363-379`) gains `extraction?: WebAutomationExtractionSummary`
  and `dialog?: WebAutomationObservedDialog`. The dialog type sits next to
  `WebAutomationDialogRequest` at `:183-187`.

**`domain/src/client/index.ts`.** No change is needed while `types.ts`
re-exports.

### X1.2 Gateway parameter mapping

**Files**

- **`client/gateway-action-parameters.ts:176-203`.**
  - **`fieldMapValue`.** Accepts a non-empty string, or a spec with:
    - `kind` a member of the kind set;
    - `attribute` non-empty for `attribute`;
    - `header` non-empty for `column`;
    - `selector` optional but non-empty;
    - `required` boolean;
    - `handling` a member of the handling set;
    - `element` normalized by `elementFingerprint`, already imported from
      `../output-nodes` in `gateway-mapping.ts:18`.
  - **Refusal.** Any malformed entry, or a map in which every field is
    `exclude`, refuses the request whole, as today's rule does at `:187-194`.
  - **`itemElement`.** Normalized the same way; malformed means refused.
  - **`paginationValue`.** Per `mode`, with an absent mode read as `next`; an
    unknown mode is refused.
- **`client/gateway-mapping.ts:158-165`.** After the required-field check, a
  field with `handling: "encrypt"` refuses the command with
  `WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED` (`codes.ts:135`,
  `blocked_by_capability_or_policy`, dispatch stage). The message names the
  field key, never a value. It is well formed, so INVALID_PARAMETER would be
  wrong (open question 8).
- **Page guard until X3 (`content/action-runtime/list-extraction.ts:86-88`).**
  A spec-form field, or a `paginate.mode` other than `next`, throws a failure
  record with NOT_IMPLEMENTED naming the feature. Every state between X1 and X3
  then fails loudly instead of misreading. X3 replaces the guard.

**Tests**

- `gateway-command-parameters.test.ts:85-97`:
  - the existing string rows are unchanged;
  - each spec kind and each pagination mode lifts;
  - `attribute` without `attribute`, `column` without `header`, an unknown
    `kind`, an unknown `mode`, a malformed `itemElement`, and all fields
    excluded are each refused whole;
  - `:207-211` stays exact.
- `client/tests/gateway-mapping.test.ts`: an `encrypt` field is refused with
  `web.action.not_implemented`, and the message contains no field value.
- `e2e/content/tests/extract-list.spec.ts`: "a structured field spec is refused
  until the engine lands", expecting `web.action.not_implemented`.

**Mutation targets**

- Accept an unknown `kind`: its row fails.
- Remove the `encrypt` refusal: its row fails.

### X1.3 C2 result summary and dialog evidence

**Files**

- `content/action-runtime/results.ts:74-79,407-408`: `ActionResultEvidence` and
  `buildResult` carry `extraction` and `dialog`.
- `content/actions/extract-list.ts:25-28`: pass `extraction` with `fieldNames` =
  the declared keys, excluded fields left out.
- `content/actions/dialog.ts:30-33`: `extracted` becomes `dialog`.
- `client/gateway-mapping.ts:270-287`: copy `extraction` field by field, and
  copy `dialog`.
- `output-nodes/definitions.ts:88-102`: the `extract_list` node's metadata
  gains the default records path `extracted` and a record-schema hint. The key
  names come from Core K1, which is a dependency.

**Tests**

- `gateway-mapping.test.ts:435-476`, following the `resolution` precedent:
  - the summary is carried;
  - every string in it is a declared field key;
  - a dialog result carries `dialog` and no `extracted`.
- `result-mapping.test.ts:123-133` gains `extraction`.
- `output-nodes/tests/definitions.test.ts:88-90` gains a records-path row.
- The harness `extract-list.spec.ts:86-95` and `:145-148` assert
  `extraction: { recordCount: 8, pagesRead: 1, truncated: false, ... }` and
  `truncated: true`.
- `upload-dialog.spec.ts:129` reads `next.dialog`.

**Mutation targets**

- Omit `extraction` from the payload copy: its gateway row fails.
- Put the dialog evidence back on `extracted`: upload-dialog fails.

### X1.4 Schemas

**Files.** Move `extractListSchema` (`actions/schemas.ts:133-158`) to
`extraction/schema.ts` and add:

- `itemElement: elementFingerprintSchema`;
- `minItems` (minimum 0);
- `maxItems.maximum`;
- `paginate.mode`, an enum of `next`, `loadMore`, `scroll` and `numbered`, with
  every member's properties;
- the field-spec `handling` enum, including the reserved `encrypt`.

Whether Core's parameter-schema dialect accepts `oneOf` was not checked (open
question 10). Until it is, keep `fields` as `type: "object"` and let the lift
enforce the union. `schemas.test.ts:87` (`paginate.required`) changes to match.

**Tests.** `schemas.test.ts:78-90`.

**Mutation target.** Drop `maxItems.maximum`: the test fails.

### X1.5 test-contracts additions

**Files**

- **`packages/test-contracts/src/scenario.ts`.**
  - `:48-49` `ScenarioExtractPagination` becomes the same union with the same
    `mode` names.
  - `:62-71` `ScenarioStep` gains `minItems?: number`.
  - `:103` `ExpectedExtraction` gains `pages?`, `optionalFields?` and
    `truncated?`, and record values become `string | null`.
  - `:241-254,280-287` update the JSON Schema to match.
- **`packages/test-contracts/src/validation.ts`.**
  - `:61-75`: pagination keys per mode.
  - `:79`: allow `minItems` on extract only, as a non-negative integer.
  - `:107-117`: `truncated` is a boolean; record values may be null.
  - `:166-178` `checkExtractionReferences`:
    - `pages` only when the named step paginates;
    - `optionalFields` must be a subset of that step's `fields` keys;
    - **a new mechanical D4 rule:** an extract step that some workflow or
      variant expects with `count: 0` or `records: []` must declare
      `minItems: 0`.
- **Hold `recordable-actions.ts:55,68` until X5.** Making `extract` yield the
  extract outputs before the recording lane records an extraction intent would
  put W04 and W08 on the Flow lane with no extract node to judge. That is
  reasoned from ex-d §2; `flow-lane-exclusion.ts` was not re-read.
- **Hold `evaluation.ts` (version still `"0.2"` at `:6`) and `bench-report.ts`
  until X5.** Their producers ship there; a version bump now would have no
  writer.
- **Follow-ups, serial after this step.**
  - `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts:84` gains
    `minItems: 0` on `extract-search-results`. W06's primary still expects
    `count: 4`.
  - `packages/test-runner/src/scenario-steps/extract-records.ts`: the runner
    reads `pagination.next` (ex-d `:64-71,89-106`, not re-read). It narrows to
    `next` and fails any other mode as `fixture.invalid`.
  - `run-expectations/extraction.ts:10,27`: the record type widens to
    `string | null`.

**Tests**

- `packages/test-contracts/tests/scenario-validation.test.mjs`, updating the
  `:73-87` fixture with `minItems: 0` and adding rows next to `:254-284` that:
  - accept every pagination mode;
  - reject an unknown mode or an extra key;
  - reject `minItems` on a non-extract step, and a negative one;
  - reject `optionalFields` that are not a subset;
  - reject `pages` on an unpaginated step;
  - reject a `count: 0` expectation without `minItems: 0`;
  - accept null record values;
  - check that the JSON schema lists the modes.
- The product-catalog manifest test (`apps/scenario-lab/src/scenarios/product-catalog/tests/scenario.test.ts`
  validates manifests) catches W06.

**Accept.** `pnpm --filter @fluxiq-web-extension/test-contracts test`, then the
scenario-lab package's `test` script. That script was not read.

**Mutation targets**

- Remove the subset check: its row fails.
- Remove the count-0 `minItems` rule: its row fails.

## Part 4: Worker partition and order

Structure budgets (`scripts/structure-audit/context.mjs:40-47`, mirrored in
`.structure-baseline.json`): files at most 800 lines, with an advisory at 400;
at most 25 files per directory, advisory at 15; at most 15 exported values per
file, advisory at 8; three files sharing a prefix must become a directory; at
most 9 path segments. The baseline holds no entry for any file named here.

| Worker | Owns | Steps |
| --- | --- | --- |
| W2 domain contracts | `domain/src/actions/{types.ts,schemas.ts,extraction/**}`, `actions/tests/schemas.test.ts`, `domain/src/client/{gateway-action-parameters.ts,gateway-mapping.ts}`, `client/tests/{gateway-command-parameters,gateway-mapping,gateway-mapping-redaction}.test.ts` | A: X0.3 domain, X0.5 domain, X0.2 wire guard. B: X1.1, X1.2 domain, X1.3 payload, X1.4 |
| W3 domain readers | `domain/src/runtime/adapter.ts`, `runtime/tests/adapter-redaction.test.ts`, `domain/src/recording/reducers.ts`, `recording/tests/reducers.test.ts`; later `output-nodes/definitions.ts` and its test | A: X0.2 adapter and reducer. B: X1.3 records path, after Core K1 names it |
| W1 extension page | `content/action-runtime/{extract.ts,list-extraction.ts,results.ts,index.ts}`, `action-runtime/tests/list-extraction.test.ts`, `content/actions/{extract.ts,extract-list.ts,types.ts,dialog.ts}`, `actions/tests/{extract.test.ts (new),execute.test.ts}`, `e2e/content/tests/{actions,extract-list,upload-dialog}.spec.ts` | A: X0.1, X0.3 page, X0.4, X0.5 page, X0.6. B: X1.2 guard, X1.3 page |
| W4 Lab reader | `packages/test-runner/src/flow-lane/{persisted-flow-run.ts,expectations.ts,run-flow-lane.ts}`, `flow-lane/tests/{persisted-flow-run,expectations,run-flow-lane,lane-observation}.test.ts`, `run-evaluation/tests/single-run-evaluation.test.ts` | X0.7 |
| W5 test-contracts | `packages/test-contracts/src/{scenario.ts,validation.ts}`, `packages/test-contracts/tests/scenario-validation.test.mjs` | X1.5 |
| W6 corpus follow-up | `apps/scenario-lab/src/scenarios/product-catalog/{manifest.ts,tests/scenario.test.ts}`, `packages/test-runner/src/{scenario-steps/extract-records.ts,run-expectations/extraction.ts}` and their tests | X1.5 follow-ups |
| W7 docs | `docs/architecture/{sensitive-values,web-capabilities,extension-client,testing-facility}.md` | X0.8, then X1 contract docs |

**Order.** Files shared between steps are serial within one owner.

1. In parallel: W2-A, W3-A, W4 and W5.
2. After W2-A: W1-A. The page needs `minItems` and the item cap on the domain
   type.
3. After W1-A and W2-A: W2-B.
4. After W2-B: W1-B and W3-B. W3-B also waits for Core K1's key names.
5. After W4 and W5: W6. It touches the `ExpectedExtraction` typing that
   `expectations.ts` reads.
6. W7, after the code.
7. The supervisor runs `pnpm check`, `pnpm test` and `pnpm build`, one at a
   time.

**Budget notes.**

- **`content/actions/`** has 20 files. It already holds `extract.ts` and
  `extract-list.ts`, so a third `extract-*.ts` there would trip the prefix rule
  (`scripts/structure-audit/rules/naming.mjs:88-101`). Add no new source file
  there; the new test goes under `tests/`.
- **`content/action-runtime/`** has 18 files and needs no new source file.
  `list-extraction.ts` grows from 194 to about 290 lines.
- **Already past the 400-line advisory, all well under 800 after the change:**

  | File | Lines now | After |
  | --- | --- | --- |
  | `results.ts` | 410 | ~425 |
  | `gateway-mapping.ts` | 429 | ~465 |
  | `adapter.ts` | 406 | ~420 |
  | `persisted-flow-run.ts` | 408 | ~420 |

- **`gateway-action-parameters.ts`** grows from 316 to about 400 lines.
- **`packages/test-contracts/src`** has 19 files and gains none.
- **`domain/src/actions/extraction/request.ts`** is 5 path segments and exports
  2 values.
- Every worker runs `pnpm structure:check`.

## What changed and why

Created this report only, as the brief allows. No source or document was edited.

## Commands run and observed results

All were read-only.

- **`wc -l` on the files to be changed, and `ls` counts per directory.**
  - Examples: `list-extraction.ts` 194, `results.ts` 410, `types.ts` 444,
    `schemas.ts` 347, `gateway-action-parameters.ts` 316, `gateway-mapping.ts` 429,
    `adapter.ts` 406, `persisted-flow-run.ts` 408, `scenario.ts` 330,
    `validation.ts` 289.
  - Directory file counts: action-runtime 18, actions 20, domain actions 4,
    domain client 4, test-contracts/src 19, flow-lane 12.
- **`head` and `grep` on `.structure-baseline.json`.** Limits as quoted in Part 4.
  Ratcheted rules hold only `directory-files`, `imports`, `naming` and
  `working-docs`, with no entry for these files.
- **`node -e` printing the `scripts` of the root, domain, extension,
  test-contracts and test-runner `package.json` files.** The acceptance
  commands above come from this output.
- **`sed` on the content-harness config, `test-domain.mjs`, `test-extension.mjs`
  and the test-runner `tsconfig.json`.** Neither unit-test runner has a
  single-file filter. The harness pins 4 workers.

No build, test, Lab or git command was run.

## Not verified

- Every "(reasoned)" item, and every step's behaviour; nothing was executed.
- That `content/element-traits.ts` loads under the Node unit runner without a
  DOM. Its `instanceof` checks sit inside functions. The first X0 run proves it.
- That the extension bundle already contains `domain/client`. This is inferred
  from four content-script imports, not from inspecting the bundle.
- Core's parameter-schema dialect (`oneOf`), and Core K1's key names for the
  records path and record schema.
- That the auth-gate start page renders the sign-in form visibly, and the
  AUTH_REQUIRED code string. The steps assert the category only.
- `flow-lane-exclusion.ts`, `scenario-steps/extract-records.ts`, the
  scenario-lab `test` script and the `extension-client.md` extract lines were
  not re-read; their citations come from ex-d or are named only.
- Whether a bare file-name filter (`-- extract-list`) selects the spec under
  `test:content`.

## Open questions or contradictions found

1. **The mirror premise is out of date.** `list-extraction.ts:38-44` restates
   the page bound because it says the content script must not import domain
   values, yet `results.ts:40-46`, `resolve-target.ts:102`, `execute.ts:58` and
   `page-identity.ts:58` do. Recommendation: mirror in X0 for consistency, then
   import both constants and delete the mirror in X3's split.
2. **The pagination discriminator.** ex-a says `mode`, ex-d says `kind`.
   Recommendation: `mode` in both.
3. **D2 in practice.** Refusing only `.value` would still leak the `value`
   attribute and `html`. Recommendation: refuse every read of a sensitive
   control.
4. **Container text is still unguarded.** A container's text still includes a
   sensitive `<textarea>`'s default text or a sensitive `<select>`'s option
   labels. That is inside the documented page-text boundary
   (`sensitive-values.md:230-239`). Recommendation: leave it out of X0; D12's
   Exclude column is the author's tool. `identity/reportable-text.ts` judges
   labels, not extraction text, so extraction cannot reuse it.
5. **C1's request `timeoutMs` duplicates the command's own**
   (`types.ts:224`, `gateway-mapping.ts:175`). Recommendation: do not add it.
6. **Paginated extraction on slow pages will hit Core's default timeout.** Once
   honoured, the 5,000 ms default (`adapter.ts:84-90`) cuts such reads short.
   X4's recorded node should carry a `timeoutMs` scaled by `maxPages`, and the
   `extract_list` node should declare the parameter (`definitions.ts:141`).
7. **Field names in the summary.** C2's `fieldNames` and `missingFields` are
   author-declared keys. Bench and evaluation must still not copy them (D6).
8. **The code for refusing `encrypt`.** Recommendation: NOT_IMPLEMENTED at
   dispatch, not INVALID_PARAMETER.
9. **A timeout can break D5.** A deadline reached after `next` was clicked
   leaves the page on a page that was never read.
10. **The schema union.** Expressing it in the domain schema depends on
    Core's schema dialect; it is Core-owned and unverified.
11. **A change to hold until X5.** Changing `recordableActionTypes` in X1
    would move W04 and W08 onto the Flow lane before any extract node exists.
