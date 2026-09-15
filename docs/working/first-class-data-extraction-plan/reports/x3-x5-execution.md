# x3-x5-execution: X3, X4 and X5 as executable steps

Read-only. This file is the only thing written. Paths are relative to
`F:\!FluxIQWebExtension` unless they start with `Core:`, which means
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\` (`AS/` in the paired
document) or, for `Core contracts:`, `F:\!FluxIQ\packages\contracts\src\`.
"(reasoned)" means traced by hand. Nothing was built, tested, or run in a
browser. Files under `apps/extension/src/content/` were read as the in-progress
`x0-page` working tree, not as commit `13b0a0d`.

## Outcome

Done. Part 1 checks `ex-a-extension-domain` and `ex-d-test-facility` against the
code after X0 and X1 as far as they have landed. Parts 2, 3 and 4 give the X3, X4
and X5 steps: files with the function or type and file:line, new exports, tests
with cases, the acceptance command, and mutation targets. Part 5 gives the
worker partition, serial files, order, Core dependencies, structure budgets, and
the steps that need manual browser validation.

Corrections that change the plan, most important first:

1. **The Lab's Flow-run reader reads a place Core never fills.**
   - The reader probes `attempt.structuredResult`, `metadata.result`,
     `metadata.structuredResult` and `metadata` of `get-flow-run-detail`
     attempts (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:286,395-419`).
   - Core builds those attempt records with metadata holding only `regionId`,
     `diffSummary`, `recoverySelected`, `hostCapabilities`, `stateRefs`,
     `targetResolution` and `adaptiveFailure`
     (`Core: runtime/service/summaries/conversions.ts:137-174`).
   - So no Flow-lane run can ever have seen an extracted record. X0.7 counts
     values in a list that is always absent.
   - The Design text "until then only `session.trace.attempts[].outputs.result`
     carries records" names `get-runtime-session`, which the Lab never calls (no
     match in `packages/test-runner/src`). After K4a that trace holds markers
     (CD14), and after K4d attempt payloads are withheld (CD15).
   - **Decision taken (recommended):** X5's Flow-lane judging reads K5's
     `runDetail.datasets` and K8's `get-run-dataset-page`. Build no interim
     reader. X5.5 waits for Core K5 and K8; the rest of X5 does not.
2. **D14's timeout scaling cannot reach a recorded node through the domain.**
   - Approval writes a recorded node's `parameterValues` as `outputId`,
     `parameters`, `confirmationInputId`, `confirmationTimeoutMs` and
     `expectedState` only (`Core: runtime/service/recordings/proposal-candidates.ts:101-107`).
   - The node is `builtin.policy.action` (`:99`), whose `timeoutMs` defaults to
     5,000 (`Core: nodes/policy/action.ts:20,40`). Core sends that as the command
     timeout (`Core: runtime/io-policy.ts:94`).
   - The gateway mapping prefers the command's timeout over `parameters.timeoutMs`
     (`domain/src/client/gateway-mapping.ts:175`). The adapter then hands it to
     the page (`domain/src/runtime/adapter.ts:84-90`).
   - So neither a `timeoutMs` inside the output parameters nor the `extract_list`
     node's declared parameter reaches a recorded node.
   - **Decision taken:** K7 also lifts an optional candidate `timeoutMs` into
     `parameterValues.timeoutMs`. That is additive to
     `AutomationStudioRecordingMapperCandidate`, `RecordingFlowActionCandidate`,
     `appendRecordingProposalToFlow` and `materializeRecordingNode`. The paired
     document must add this to K7 (open question 1).
3. **Record field keys must match Core's field id pattern.**
   - The pattern is `^[A-Za-z0-9_-]{1,100}$`, and `__proto__`, `constructor` and
     `prototype` are refused (`Core contracts: record-sets/schema.ts:16-23`).
   - A dataset id must match `^[A-Za-z0-9._:-]{1,200}$` (`record-sets/output.ts:11`).
   - Today's lift accepts any non-empty key (`domain/src/client/gateway-action-parameters.ts:206-212`).
     The corpus keys pass, but a picker name such as "Product name" would make
     K7 reject the whole candidate.
   - So the picker produces a key and a separate human label, and the domain
     supplies the one key function.
4. **`null` does not survive Core storage as `null`.**
   `validateAutomationStudioRecords` treats `null` as absent and omits the key
   (`Core contracts: record-sets/validate-records.ts:31,76-79`). So "nullable values"
   is three pieces:
   - the page writes `null` for an optional spec field it could not read;
   - the stored row lacks the key;
   - the Lab's dataset reader puts `null` back for every schema field a row lacks.
5. **C3's single input id cannot map two outputs.**
   - The input-to-output map is one to one (`domain/src/io/input-model.ts:109-111`).
   - The single-field form needs its own input,
     `web.user.value_extraction_defined` → `web.dom.extract`.
   - It carries no `recordOutput`, because capture replaces an array at
     `recordsPath` (CD13), and `web.dom.extract`'s `extracted` is one value.
6. **A recorded extraction must carry no `expectedConfirmation`.**
   - Core waits for the confirmation input whenever `confirmationInputId` is set
     (`Core: runtime/io-policy.ts:129-130`).
   - The extension confirms no extract action
     (`apps/extension/src/background/connection/runtime-status.ts:119-130`).
   - The mapper's `candidate()` helper always sets a confirmation
     (`domain/src/web-panel-host.ts:161-163`). An extraction candidate built with
     it would fail every replay after 5 s.
   - The late-target wait already omits it, for the same reason
     (`domain/src/recording/proposals/late-target-wait.ts:14-19,92`).
7. **A recorded `extract_list` is never executable today, even with a valid
   request.**
   - `hasExecutableParameters` requires every required parameter to be a
     non-empty string or a secret request (`input-model.ts:194-197,218-225`).
   - `extractList` is an object, so it needs a structured exception, as `upload`
     and `tab` already have (`:219-223`).
8. **The picker's overlay would be recorded as a DOM addition.**
   - While recording, the mutation observer counts every added node
     (`apps/extension/src/content/recorder.ts:32-37,121-128`).
   - A DOM addition followed by a click proposes a late-target wait
     (`late-target-wait.ts:54-66`).
   - So the picker's shadow host must be excluded from the tally.
9. **X1 has landed only in part.**
   - At `13b0a0d` the domain request still has `fields: Record<string, string>`
     and next-only pagination (`domain/src/actions/types.ts:151-176`).
   - There is no `domain/src/actions/extraction/`, no `extraction` result
     summary (`types.ts:372-388`), and no page guard for spec fields (the page
     parses every field as a string at `list-extraction.ts:117`).
   - X3 therefore depends on W2-B, W1-B and W3-B, as the plan's order says.
10. **`recordableActionTypes` also decides corpus validity.** Changing `extract`
    to yield the extract outputs gives W04 and W08 a Flow lane
    (`packages/test-contracts/src/flow-lane-exclusion.ts:24-28`). It also moves
    W05, W07, W09, W11, W15 and W18 from `not_applicable` to judged on the Flow
    lane once their Flows hold extract nodes. New failures there are
    measurements under D7, not regressions.

---

## Part 1: The two reports checked against the code

### ex-a-extension-domain

| Claim | Verdict now | Evidence |
| --- | --- | --- |
| `extract` returns a sensitive control's `.value` | Fixed in the working tree (x0-page) | `content/action-runtime/extract.ts:29-38` refuses first; container text and HTML filtered at `:45-85` |
| Request type `types.ts:151-167`, string fields only | True, moved to `:151-176` with `minItems` | `types.ts:162-176` |
| Lift clamps `maxPages`, drops bad `maxItems` | `maxPages` still clamped; `maxItems` now clamped to 1,000; `minItems` refused whole | `gateway-action-parameters.ts:184-203,215-221` |
| Page applies `EXTRACT_MAX_PAGES = 50`, no item cap | Both now mirrored | `list-extraction.ts:65,73`. The comment at `:58-63` still says the content script must not import domain runtime values, while `:36` does |
| Pagination polls for a changed list, 10 s | True | `list-extraction.ts:76-77,247-264` |
| `timeoutMs` ignored | Fixed | `list-extraction.ts:121,156-165`; `extract-list.ts:35,39-45` |
| G3 empty list passes | Fixed | `extract-list.ts:52-65` |
| G4 append duplicates | Fixed | `list-extraction.ts:127,136` |
| Sign-in detection keys off `action.selector` | Fixed | `results.ts:295` uses `extractList.item` |
| Result carries no `extraction` summary | Still true (X1.3 pending) | `extract-list.ts:38`; `types.ts:383` |
| Eleven recorder plug points | All true at the cited lines | `shared/protocol.ts:366-382`; `domain/src/constants.ts:4-21`; `recording/events.ts:44-61,74-91`; `input-model.ts:47-64,7-21,95-107,116-154,194-206`; `output-nodes/payloads.ts:65-94`; `gateway-mapping.ts:23-40,83-108`; `background/connection/gateway-payloads.ts:60-86`; `content/recorder.ts:23`; `web-panel-host.ts:101-111` |
| Plug points ex-a missed | New | `gateway-payloads.ts:22-37` (`recordedInputId` copies fields too); `content/snapshots.ts:3-9`; `runtime-status.ts:111-131` (no confirmation must stay no confirmation); `web-panel-host.ts:161-163` (confirmation); `input-model.ts:218-225` (object parameter); `recording/proposals/late-target-wait.ts` (overlay mutation) |
| Manifest inputs follow `actionInputDefinitions` automatically | True, no extra edit | `io/manifest-definitions.ts:7-10`; output binding at `web-panel-host.ts:42-54` |
| `repeating.ts` signature, caps, fields | True | `content/evidence/repeating.ts:22-28,42-65,68-77,101-109`; type `domain/src/page-evidence/types.ts:176-191` |
| One UI script for both surfaces | True | `sidepanel/index.ts` is 1 line; Chrome `side_panel` `sidepanel/index.html`, Firefox `action.default_popup` `popup/index.html` (both manifests) |
| Content accepts ping, recording, captureSnapshot, executeAction | True | `content/message-handler.ts:48-76` |
| Recorder listens on `document` capture, trusted only | True | `content/dom-events.ts:48-67` (pointerdown), `:69-82` (click) |
| Firefox popup closes on page focus | Not verified; still reasoned | — |
| `dialog.ts` reuses `extracted` | Not re-read (x0-x1 cited `:30-33`) | — |

### ex-d-test-facility

| Claim | Verdict now | Evidence |
| --- | --- | --- |
| Recording lane reads records with Playwright and clicks Next | True; any other mode now fails as `fixture.invalid` | `scenario-steps/step-runner.ts:116`; `extract-records.ts:61-83,100-117` |
| Assert extraction before final state | True | `run-scenario.ts:305-311`, final state `:317-318` |
| Flow lane `not_applicable` without an extract node | True | `flow-lane/expectations.ts:54-75,94-105` |
| One attempt per expected entry contradicts W05's one entry over 3 pages | Still true | `expectations.ts:101-104`; `product-catalog/manifest.ts:58,63` |
| `extract` yields nothing, paginated yields clicks | True | `packages/test-contracts/src/recordable-actions.ts:55,63-72` |
| week1 has 63 runnable results | True | `bench/tests/week1-corpus.test.ts:91,99-100`; `docs/architecture/testing-facility.md:1256` |
| Evaluation schema 0.2, no extraction field | True | `test-contracts/src/evaluation.ts:6,103-144`; validator `evaluation-validation.ts:27,170-173` |
| Bench has no extraction metric | True | `bench-report.ts:18-25,72-129,187-218`; `bench/aggregate-report.ts:226-250` |
| Flow-run reader drops non-strings | X0.7 now counts them (`persisted-flow-run.ts:395-419`), but **the list it reads is never filled** (correction 1) | `Core: runtime/service/summaries/conversions.ts:137-174` |
| `ExpectedExtraction` lacks pages, optional fields, truncation, nulls | Landed in X1.5 | `scenario.ts:121-138`; validator `validation.ts:130-144,197-223` |
| Pagination union discriminated by `kind` with `scroll.maxLoads` and numbered `pages: number` | Landed as `mode`, `scroll.maxScrolls`, numbered `pages: string` (a control selector) | `scenario.ts:48-68,285-310` |
| `pages`, `optionalFields`, `truncated` are asserted | **Not asserted by any reader yet** | `run-expectations/extraction.ts:14-29` checks count and records only |
| Product-catalog renders numbered pages and Next | True | `product-catalog/markup.ts:76,78`; product link `:62` |
| W11 expects a count only | True | `infinite-feed/scenario.ts:52`; `FEED_PAGE_SIZE = 10` at `feed-content.ts:2` |
| "No `web.dom.extract`" comments | True at two places; multi-tab not re-read | `infinite-feed/scenario.ts:50`; `admin-console/manifest.ts:143` |

---

## Part 2: X3 steps (extraction engine)

Each worker iterates with its own build label (`DOMAIN_TEST_BUILD_LABEL`,
`EXTENSION_TEST_BUILD_LABEL`) and runs heavy commands one at a time. A content
harness run passes `--workers=2`. Repair hooks stay out (D15), and D2's rules
stay: every read of a sensitive control is refused, and container text skips
sensitive controls.

### X3.1 Structured field specs on the page

**Files**

- **New `apps/extension/src/content/extraction/`.** This is the plan's own
  directory name. `content/action-runtime/` already holds `extract.ts` and
  `list-extraction.ts`, and `content/actions/` would trip the prefix rule with a
  third `extract-*` file (`scripts/structure-audit/rules/naming.mjs:88-101`).
  - `field-spec.ts`, `normalizeExtractField(name, field: WebAutomationExtractField): ExtractFieldReader`.
    - A string goes through today's grammar, moved from
      `list-extraction.ts:79-112` (`parseExtractField`).
    - A spec becomes `{ kind, selector?, attribute?, header?, required, handling }`.
    - `required` defaults to `true` for a spec. The string form is always
      required, as today.
    - `handling: "exclude"` is dropped before any read (D12).
    - `handling: "encrypt"` throws a NOT_IMPLEMENTED failure record. This is
      defence in depth: X1.2 already refuses it at dispatch.
  - `field-reader.ts`, `readField(item, name, reader): string | null | undefined`,
    moved from `list-extraction.ts:189-218` together with `readColumn` and
    `sensitiveFieldRefusal` (`:225-234`).
    - `text` reads `readableText` (`action-runtime/extract.ts:45-48`).
    - `attribute` reads `getAttribute`.
    - `link` resolves `getAttribute("href")` with
      `new URL(href, element.baseURI).href`. A non-http(s) result counts as
      unreadable.
    - `value` reads a form control's live `.value`. A non-control is unreadable.
    - `column` is today's `readColumn`.
    - Every kind refuses a sensitive control first (D2). `value` must too.
    - An unreadable optional field returns `null` and is not added to
      `missingFields`. An unreadable required field returns `undefined` and is
      reported missing.
  - `pagination.ts`, moved from `list-extraction.ts:174-177,236-268`
    (`deadlineFor`, `waitForListChange`, `listChanged`, `delay`). X3.2 adds the
    modes here.
  - `list-reader.ts`, `extractList(request, options)`, moved from
    `list-extraction.ts:114-172`.
  - `index.ts` barrel, exporting `extractList` and the types
    `ExtractedListRecord`, `ListExtractionOutcome` and `ListExtractionOptions`.
- **Delete `content/action-runtime/list-extraction.ts` and its test.** Nothing
  is left behind (no extract-and-drop). Update the importers:
  - `content/action-runtime/execute-action.ts:18,37`;
  - `content/action-runtime/index.ts:18`, whose type re-export moves to
    `content/extraction`;
  - `content/actions/types.ts:66`.
- **Import the bounds instead of mirroring them.** Replace `EXTRACT_MAX_PAGES`
  and `EXTRACT_MAX_ITEMS` (`list-extraction.ts:58-73`) with imports from
  `@fluxiq-web-extension/domain/client`. The file already imports from there at
  `:36`. Delete the agreement tests, as x0-x1 open question 1 recommended.
- **`ExtractedListRecord`** becomes `Record<string, string | null>`
  (`list-extraction.ts:41`). `content/actions/extract-list.ts:57-65` is unchanged
  apart from the type.
- **`content/actions/extract-list.ts:38`.** `extraction.fieldNames` (from X1.3)
  lists the included fields only, and `missingFields` names required fields only.
- **Remove X1.2's page guard** for spec-form fields.

**Tests**

- New `content/extraction/tests/field-spec.test.ts` (node:test, no DOM):
  - the string-grammar rows moved from `action-runtime/tests/list-extraction.test.ts`;
  - each spec kind normalizes;
  - an `exclude` field is dropped;
  - `encrypt` throws with code `web.action.not_implemented`;
  - `attribute` without `attribute` throws, and so does `column` without `header`;
  - `required` defaults to true for a spec.
- `e2e/content/tests/extract-list.spec.ts`, new describe "structured field
  specs", on product-catalog:
  - `url: { kind: "link", selector: '[data-testid="product-link"]' }` yields
    `new URL(<raw href>, harness.url).href` for all 8 cards;
  - `rating: { kind: "text", selector: '[data-testid="no-such"]', required: false }`
    yields `rating: null` in every record, and the validation passes;
  - the same field with `required` omitted fails with `output_not_observed`;
  - `price: { ..., handling: "exclude" }` leaves no `price` key and no `price` in
    `extraction.fieldNames`.
- Same file, "on sensitive-input":
  - `{ kind: "value", selector: '[data-testid="password"]' }` is refused as
    `web.action.rejected`, and the reply contains no fixture secret;
  - the same field with `handling: "exclude"` succeeds. This proves the field is
    never read, not read and then dropped;
  - `{ kind: "value", selector: 'input[name="username"]' }` returns the fixture's
    user.

**Accept.**
1. `pnpm --filter @fluxiq-web-extension/extension check`
2. `EXTENSION_TEST_BUILD_LABEL=x3-engine node apps/extension/scripts/test-extension.mjs`
3. `pnpm --filter @fluxiq-web-extension/extension test:content -- extract-list --workers=2`

**Mutation targets**

- Read an excluded field, then delete it: the sensitive-input exclude row fails.
- `link` returns the raw `href`: the link row fails.
- An optional miss omits the key instead of writing `null`: the null row fails.

### X3.2 Pagination modes on the page

**Files.** `content/extraction/pagination.ts` gains
`advancePage(paginate, state): Promise<"advanced" | "ended" | "timed_out">`, and
`list-reader.ts` calls it once per page.

- **`next`.** Today's behaviour (`list-extraction.ts:146-168`).
- **`loadMore`.**
  - Click `control`, then wait until an unread item appears or the control
    detaches.
  - An absent, `disabled` or `aria-disabled="true"` control means the list ended.
    Reaching `maxPages` with a live control means truncated.
  - The de-duplication set (`list-extraction.ts:127,136`) already reads only new
    items.
- **`scroll`.**
  - Scroll the nearest scrollable ancestor of the first item, or the window, to
    its bottom.
  - Wait up to 900 ms for an unread item, the window `scroll.ts:45` uses for
    document growth.
  - No new item while at the bottom means ended. `maxScrolls` reached means
    truncated.
  - The growth signal is item identity, not document height, so this is not a
    copy of `scroll.ts:106-170`, which stays untouched.
- **`numbered`.**
  - Read the current page.
  - Re-query `pages` after each change, and click the first control whose number
    follows the current one: its `aria-current="page"` sibling, falling back to
    DOM order.
  - Wait for the list to change. No following control means ended. `maxPages`
    with one left means truncated.
- **Every mode** checks the command deadline before each advance, and leaves the
  page on the last page it read (D5).

**Tests** (`e2e/content/tests/extract-list.spec.ts`)

- "numbered: every page is visited once, ending on the last", on product-catalog:
  - request `paginate: { mode: "numbered", pages: '[data-testid^="pagination-page-"]', maxPages: 5 }`;
  - expect 23 records equal to the all-pages list, `pagesRead: 3`, and
    `harness.finalState()` showing page 3.
- "loadMore: appended items are read once and a vanished control ends the list",
  on basic-form, with the injected feed from X0.4 driven by
  `{ mode: "loadMore", control: '[data-testid="more"]', maxPages: 5 }`:
  - 7 records, `truncated: false`;
  - with `maxPages: 2`, 5 records and `truncated: true`.
- "scroll: a feed is read until it stops loading", on infinite-feed:
  - `item: '[data-testid="feed-item"]'`, `paginate: { mode: "scroll", maxScrolls: 20 }`;
  - the count equals `feedLengths.baseline` (`infinite-feed/scenario.ts:75`;
    the value was not read);
  - after arming `end-early`, 25 records.
- "a mode's advance respects timeoutMs": loadMore with `timeoutMs: 100` against
  a 150 ms append gives `timed_out`, with the first page's records.
- A unit row in `content/extraction/tests/pagination.test.ts` for the page-bound
  clamp of `maxPages` and `maxScrolls`.

**Accept.** The X3.1 commands, and the same spec under the Firefox content config
`apps/extension/e2e/playwright.content.firefox.config.ts`. No package script
names that config; invoke it the way `test:content` invokes Playwright, with
`-c` pointing at it.

**Mutation targets**

- Numbered clicks the current page again: the 23-record row fails.
- `maxScrolls` is ignored: a capped scroll row fails.
- Remove the loadMore disabled check: the vanished-control row reads a truncated
  list.

**Risk kept open.** A virtualised list recycles its DOM nodes, so identity
de-duplication can skip a recycled node that holds a new record (E55,
`admin-console/virtual-list.ts`, not read). X3 does not claim `scroll` on
admin-console. X5's fixture run measures it.

### X3.3 Inference C4

**Domain files** (new `domain/src/extraction/`)

- `proposal.ts`, the type:
  `WebAutomationExtractionProposal = { container: string; item: string; itemCount: number; fields: Array<{ key: string; label: string; spec: WebAutomationExtractFieldSpec; coverage: number }>; pagination?: WebAutomationExtractListPagination; confidence: number }`.
  It holds selectors, names and counts only, never page values (D3).
- `field-key.ts`, `webAutomationExtractionFieldKey(label: string, taken: ReadonlySet<string>): string`.
  - It lower-cases, maps runs outside `[a-z0-9_-]` to `_`, trims to 100
    characters, and falls back to `field`.
  - A key already in `taken` gets a suffix, `price` then `price_2`.
  - A reserved id (`__proto__`, `constructor`, `prototype`) gets `_field`
    appended.
  - This is correction 3's single key rule.
- `dataset-id.ts`, `webAutomationDatasetId(label: string, nonce: string): string`,
  matching `^[A-Za-z0-9._:-]{1,200}$`.
- `signature.ts`, the pure string half of `repeating.ts:68-77`:
  `webAutomationItemSignature({ tagName, role, testId, classes })` and
  `webAutomationIdentifierShape(value)`.
- `index.ts` barrel. Re-export it from `domain/src/client/index.ts` (the only
  domain entry the extension bundle maps, `apps/extension/scripts/build-extension.mjs:12`)
  and from `domain/src/index.ts`.

**Extension files** (`content/extraction/`)

- `infer-list.ts`, `inferListFromElement(picked: Element): WebAutomationExtractionProposal | undefined`.
  - Walk the ancestors. At each level group the siblings by
    `webAutomationItemSignature`.
  - Take the nearest run of at least 3 (`repeating.ts:24`).
- `item-selector.ts`, `generalizedItemSelector(run: readonly Element[]): string | undefined`.
  - Try, in order: an exact shared test id, a test-id shape as
    `[data-testid^="…"]`, `<container> > tag.class`, and role.
  - Accept a candidate only when `document.querySelectorAll(candidate)` is
    exactly the run.
- `infer-fields.ts`, `inferFields(item: Element, run: readonly Element[])`.
  - Field sources: test ids (`data-testid`, `data-test`, `data-cy`), `a[href]` as
    `link`, `img` as `attribute` `src` and `alt`, table rows with header cells as
    `column`, and remaining text leaves as `text`.
  - Coverage is the share of items in the run that have the field.
  - A field whose element is a sensitive control, by `isSensitiveFormControl`
    (`content/element-traits.ts:111-117`, which includes `data-sensitive`), gets
    `handling: "exclude"`. That is D12's pre-selection.
- `detect-pagination.ts`, `detectPagination(run)`.
  - `a[rel=next]`, or a control labelled Next or `aria-label` "Next page", gives
    `next`.
  - Load more or Show more gives `loadMore`.
  - A signature run of digit-labelled buttons gives `numbered`.
  - Otherwise nothing. Scroll is offered only when the user picks it.
- **`content/evidence/repeating.ts:68-77`.** Import the two domain functions and
  delete the local copies. The directory is a contract-spread path
  (`scripts/structure-audit/config.mjs:54`), and the change adds no spread.
- **`content/message-handler.ts:48-76`.** Handle a new content message,
  `extraction.propose { selector }`, replying with the proposal. The harness
  needs it, and the picker reuses it. This is an addition to C5 (open question 3).
- **New `shared/extraction-messages.ts`** holds the message types.
  `shared/protocol.ts` is already 449 lines.

**Tests**

- `domain/src/extraction/tests/field-key.test.ts`:
  - "Product name" gives `product_name`;
  - "" gives `field`;
  - `__proto__` is never returned;
  - "Price" after "price" gives `price_2`;
  - a 150-character label gives 100 characters;
  - every output matches `^[A-Za-z0-9_-]{1,100}$`, restated with a pointer to
    Core `record-sets/schema.ts:19`.
- `domain/src/extraction/tests/signature.test.ts`: `row-1` and `row-2` share a
  shape; classes are sorted and capped at 3.
- New `e2e/content/tests/extraction-inference.spec.ts` (named in the plan's
  Validation):
  - product-catalog, proposing from `[data-testid="product-name"] >> nth=0`:
    `itemCount: 8`; the item selector matches exactly the 8 cards; fields include
    a `link`; pagination is `next`. The proposal, sent back as an `extract_list`
    request, yields the first page's records.
  - data-table, from a Price cell: 12 rows, `column` fields for all four headers,
    the header row not counted. Arm `column-reorder` and send the same request:
    the same records.
  - basic-form with 3 injected rows each holding `<input type="password">`: that
    field is proposed with `handling: "exclude"`.

**Accept.**
1. `pnpm --filter @fluxiq-web-extension/domain check`
2. `DOMAIN_TEST_BUILD_LABEL=x3-infer pnpm --filter @fluxiq-web-extension/domain test`
3. The X3.1 extension commands, with `-- extraction-inference --workers=2`

**Mutation targets**

- Accept an item selector that matches a superset: the data-table header row is
  counted, and that row fails.
- Remove the exclude pre-selection: the password row fails.
- Allow spaces in keys: the key-pattern row fails.

### X3.4 Documentation

- `docs/architecture/web-capabilities.md:114-118`: spec kinds, `null` for
  optional misses, the four modes, inference.
- `docs/architecture/sensitive-values.md:230-239`: an excluded field is never
  read; the `value` kind obeys D2.

---

## Part 3: X4 steps (recordable extraction)

### X4.1 Domain: recorded event, mapping, and the Core proposal

**Before editing,** land the paired K7 change for `timeoutMs` (correction 2),
and the K7 `recordOutput` field in the linked Core checkout. The domain compiles
against `fluxiq/automation-studio` (`web-panel-host.ts:2`), whose candidate type
has neither field today (`Core: nodes/importer-sdk.ts:19-31`).

**Files**

- **`domain/src/constants.ts:4-21`.** Add
  `dataExtractionDefined: "web.data.extraction_defined"`.
- **`domain/src/recording/events.ts`.**
  - `:44-61`: add `extraction: { type: "object", label: "Extraction definition" }`.
  - `:74-91`: add
    `event(WEB_AUTOMATION_EVENTS.dataExtractionDefined, "Data extraction defined", "A user defined a list or value extraction with the picker.")`.
- **New `domain/src/actions/extraction/recorded-definition.ts`** (beside X1.1's
  files).
  - The type `WebAutomationRecordedExtraction`:
    `{ form: "list"; datasetId; label; request: WebAutomationExtractListRequest; fieldLabels: Record<string, string>; itemCount: number } | { form: "value"; read: { mode: "text" | "attribute" | "value" | "html"; attribute?: string }; label: string }`.
  - `webAutomationRecordedExtraction(value: unknown): WebAutomationRecordedExtraction | undefined`
    builds the copy field by field. No sample values and no unknown key survive
    (D3).
  - It checks every field key against `webAutomationExtractionFieldKey`'s
    pattern, and the dataset id against Core's pattern.
- **New `domain/src/actions/extraction/read-request.ts`.** Move
  `extractListRequestValue`, `fieldMapValue` and `paginationValue` out of
  `client/gateway-action-parameters.ts:184-221`, as X1.2 leaves them, and export
  `webAutomationExtractListRequestValue`.
  - `io/input-model.ts` needs the reader, and `client/gateway-mapping.ts:5`
    already imports `io/input-model`. Importing `client` from `io` would make a
    cycle.
  - `gateway-action-parameters.ts:86` calls the moved function.
- **`domain/src/actions/extraction/request.ts`** (from X1.1).
  - Add `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 10_000`: the page's per-page
    wait, `list-extraction.ts:76` today, which the page then imports.
  - Add `webAutomationExtractListTimeoutMs(request)`: the page timeout times the
    bound (`maxPages`, or `maxScrolls` for `scroll`), or times 1 when unpaginated.
- **`domain/src/io/input-model.ts`.**
  - `:7-21`: `dataExtractionDefined: "web.user.data_extraction_defined"` and
    `valueExtractionDefined: "web.user.value_extraction_defined"`.
  - `:25-37`: `extraction?: JsonObject`.
  - `:47-64`: `if (kind === "data.extract") return WEB_AUTOMATION_EVENTS.dataExtractionDefined;`.
  - `:95-107`: two rows, mapping to `web.dom.extract_list` and `web.dom.extract`.
  - `:116-154`: a case for the new event. `form === "value"` gives the value
    input; otherwise the list input.
  - `:218-225` `isExecutableRequiredParameter`: `extractList` is executable
    exactly when `webAutomationExtractListRequestValue` reads it (correction 7).
- **`domain/src/output-nodes/payloads.ts:65-94`.**
  - `web.dom.extract_list`: `{ extractList: definition.request }` from
    `webAutomationRecordedExtraction(payload.extraction)`.
  - `web.dom.extract`: `:86` adds `extract: definition.read`.
  - Delete `extract_list` from the dispatch-only comment at `:90-93`.
  - `withRecordedFrame` (`:41-47`) already carries the frame.
- **`web.dom.extract`'s structured read** (C3).
  - `actions/schemas.ts:293` gains
    `extract: { type: "object", properties: { mode: { enum: [...] }, attribute: { type: "string" } } }`.
  - `actions/types.ts:215-270` gains `extract?: { mode; attribute? }` on the command.
  - `client/gateway-action-parameters.ts:49` lifts `extract`.
  - `output-nodes/definitions.ts:146` adds `structured("extract", "Read")` to
    `web.dom.extract`.
  - Page side, in X4.2: `content/action-runtime/extract.ts:29-38` reads
    `action.extract` instead of `options`.
- **`domain/src/output-nodes/definitions.ts:141`.** Add
  `{ id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 }`
  to `extract_list` (D14, authored nodes). W3-B's `metadata.recordsPath` is a
  prerequisite.
- **New `domain/src/recording/proposals/record-output.ts`**,
  `webAutomationRecordOutput(definition): { datasetId; label; schema; writeMode: "append"; maxRecords }`.
  - `schema` is `{ schemaVersion: "0.1", fields }` over every request field,
    excluded ones included. D12: an exclusion must persist so detection does not
    propose the field again. Core drops them from storage.
  - Each field is `{ id: key, label: fieldLabels[key], valueType: kind === "link" ? "url" : "string", required: spec.required !== false, handling }`.
  - `maxRecords` is `min(request.maxItems ?? 1_000, 10_000)`.
  - There is no `recordsPath`. K7 takes it from the output's
    `metadata.recordsPath` (CD19).
- **`domain/src/web-panel-host.ts`.**
  - `:101-111`: labels `"web.dom.extract_list": "Extract list"` and
    `"web.dom.extract": "Extract value"`.
  - `:132-138`: for the two extraction inputs, build the candidate through a new
    `extractionCandidate(action, step)`, not `candidate()`. It carries:
    - `sourceInputIds`, which are action-role, as Core checks at
      `proposal-candidates.ts:52-57`;
    - **no** `expectedConfirmation`;
    - `recordOutput` for the list form only;
    - `timeoutMs: webAutomationExtractListTimeoutMs(request)` for the list form.
- **`domain/src/client/gateway-mapping.ts`.**
  - `:23-40`: `extraction?: JsonObject`.
  - `:83-108`: `extraction: webAutomationRecordedExtraction(payload.extraction)`,
    named rather than spread.

**Tests**

- `io/tests/input-model.test.ts`:
  - a list definition maps to `web.dom.extract_list`;
  - a value definition maps to `web.dom.extract`;
  - a definition with an unreadable request stays evidence;
  - a `data.extract` wire kind maps to the new event type.
- `output-nodes/tests/payloads.test.ts:49-55`:
  - `extract_list` leaves the dispatch-only row;
  - a new row checks recorded parameters equal `{ extractList }` and carry the
    frame id.
- `output-nodes/tests/definitions.test.ts:68,88-90`: `extract_list` declares
  `timeoutMs`.
- New `actions/extraction/tests/recorded-definition.test.ts`:
  - a planted `samples` key is dropped;
  - a key with a space is refused;
  - a bad dataset id is refused.
- `tests/web-panel-host.test.ts`, beside `:185`, "a recorded list extraction
  proposes extract_list with a recordOutput Core can lift, a scaled timeout, and
  no confirmation":
  - every schema field id matches Core's pattern;
  - no `recordsPath` key;
  - no `expectedConfirmation`;
  - `timeoutMs` is 30,000 for `maxPages: 3`;
  - the excluded field is present with `handling: "exclude"`;
  - `JSON.stringify(candidate)` has no planted sample value.
- `tests/domain.test.ts`, Core proposal rows (ex-a cites `:263,286`). After K7,
  approving the proposal into a Flow writes `parameterValues.recordOutput` with
  `recordsPath: "extracted"` and `parameterValues.timeoutMs`. This is the
  cross-repository acceptance row.
- `client/tests/gateway-mapping.test.ts`: the recorded event's `extraction` holds
  only declared keys.

**Accept.**
1. `pnpm --filter @fluxiq-web-extension/domain check`
2. `DOMAIN_TEST_BUILD_LABEL=x4-domain pnpm --filter @fluxiq-web-extension/domain test`
3. Core's K7 acceptance, per `k-datasets-execution` §4 K7:
   `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/recordings/tests --no-file-parallelism`

**Mutation targets**

- Build the extraction candidate with `candidate()`: the no-confirmation row fails.
- Skip the key pattern check: the space-key row fails.
- Put `extract_list` back in the dispatch-only list: its payload row fails.
- Drop the object exception at `:218-225`: the list-maps-to-extract_list row fails.
- Drop `timeoutMs`: the 30,000 row fails.

### X4.2 Content picker and recorded event (C5, page half)

**Files**

- **`shared/extraction-messages.ts`** (created in X3.3).
  - Content messages: `extraction.pick_start { sessionId, form }`,
    `extraction.pick_cancel { sessionId }`, `extraction.preview { sessionId, request, limit ≤ 20 }`,
    `extraction.propose` (X3.3), and `extraction.record { sessionId, definition }`.
  - Content to background: `fluxiq.extractionPicked { sessionId, proposal | element }`.
  - Runtime message names: `fluxiq.extractionStart`, `fluxiq.extractionConfirm`,
    `fluxiq.extractionCancel`, `fluxiq.getExtractionSession`, and the test-only
    `fluxiq.test.defineExtraction` (X5.3).
  - Keeping the names here rather than in `shared/constants.ts:16-34` lets X4-C
    and X4-D run in parallel.
  - C5 lacks `extractionPicked` and `record` (open question 3).
- **New `content/picker/`.**
  - `overlay.ts`: a shadow-root host marked `data-fluxiq-picker`, with
    `pointer-events: none`, holding the highlight box and item count.
  - `session.ts`: `startPick(sessionId, form)` and `stopPick()`.
    - Capture listeners on **`window`** for `pointerdown`, `mousedown`,
      `pointerup`, `mouseup`, `click`, `auxclick` and `contextmenu`: each calls
      `preventDefault()` and `stopImmediatePropagation()`. Window capture runs
      before the recorder's `document` capture listeners (`dom-events.ts:48,69`),
      so no pick is recorded (reasoned).
    - `pointermove` updates the highlight. `keydown` Escape cancels.
    - A list pick runs `inferListFromElement`. A value pick describes the element.
    - A pick sends `fluxiq.extractionPicked` with no values.
    - `preview` runs `extractList` with `maxItems: limit` and replies with the
      rows. Preview rows go to the extension UI only (D3).
    - `record` calls `emit("data.extract", { element?, extraction })`, which
      requires recording to be on (`recorder.ts:54`) and flushes the pending
      mutation batch first.
  - `index.ts` barrel.
- **`content/message-handler.ts:48-76`.** Route `extraction.*` to `content/picker`,
  top frame only (`isTopFrame`, as at `:42-45`).
- **`content/recorder.ts`.**
  - `:23`: add `"data.extract"` to `EXECUTABLE_KINDS`.
  - `:121-128` `tallyMutations`: skip records whose target or added nodes are
    inside the `data-fluxiq-picker` host (correction 8).
- **`content/snapshots.ts:3-9`.** Add `"data.extract"`.
- **`shared/protocol.ts`.**
  - `:366-382`: add the kind `"data.extract"`.
  - `:384-401` `RecordingEventPayload`: add `extraction?: WebAutomationRecordedExtraction`.
- **`content/action-runtime/extract.ts:29-38` and `content/actions/extract.ts`.**
  Read `action.extract` (X4.1's structured read) and keep D2's refusal.

**Tests**

- `content/tests/recorder.test.ts:91`: the executable-kind row includes
  `data.extract`.
- New `e2e/content/tests/extraction-picker.spec.ts`, on product-catalog with
  `setRecording(true)`:
  - deliver `extraction.pick_start`, then `page.mouse.click` on the first product
    name as trusted input;
  - `messages()` holds one `fluxiq.extractionPicked` with `itemCount: 8`;
  - `recordedEvents("dom.click")` is empty;
  - `page.url()` is unchanged, so the link was not followed;
  - no `dom.mutation` counts the overlay;
  - Escape removes the host;
  - `extraction.record` yields exactly one `data.extract` event whose serialized
    payload contains no first-page product name.
- Same spec: "a preview reads at most the limit and is never recorded": 5 rows
  come back, and `recordedEvents()` is unchanged.

**Accept.** Extension check, the unit command with
`EXTENSION_TEST_BUILD_LABEL=x4-picker`, then `test:content -- extraction-picker --workers=2`.

**Mutation targets**

- Register the pick listeners on `document`: the `dom.click` row fails.
- Remove `preventDefault`: the URL row fails.
- Remove the overlay filter: the mutation row fails.

### X4.3 Background pick session and routing (C5, worker half)

**Files**

- **New `background/extraction/`.**
  - `session-store.ts`, `ExtractionSessions`: in memory only, keyed by tab.
    - States: `picking`, `picked`, `recorded`.
    - It holds the proposal, the user's edits and at most 20 preview rows, and is
      never written to `chrome.storage`.
    - A session is cleared on tab removal or top-frame navigation
      (`background/index.ts:55-73`).
  - `control.ts`, `handleExtractionControl(message, sender, manager)`, returning
    `{ handled, response }` like `scripted-navigation-control.ts:12-30`.
    - `start`, `confirm`, `cancel` and the test message are accepted only from the
      control page (`isControlPage`, `:6-10`).
    - `start` sends `pick_start` through `sendToTab(tabId, message, 0)`
      (`background/tabs.ts:41-51`) to the automation tab.
    - `extractionPicked` is accepted only from that tab's content script.
    - `confirm` builds the definition: `webAutomationExtractionFieldKey` for keys,
      `webAutomationDatasetId(label, crypto.randomUUID().slice(0, 8))`, and
      `webAutomationExtractListRequestValue` to validate. It refuses while not
      recording, then sends `extraction.record`.
    - `fluxiq.test.defineExtraction` is X5.3's seam.
  - `index.ts` barrel.
- **`background/index.ts:88-89`.** After the scripted-navigation check, add
  `const extraction = await handleExtractionControl(typed, sender, manager); if (extraction.handled) return extraction.response;`.
- **`background/connection/gateway-payloads.ts`.**
  - `:22-37` `recordedInputId` and `:60-86`: copy `extraction`.
  - `:39-58` `recordingEvidencePayload`: `extraction` is reduced to
    `{ form, fieldCount, itemCount }` for the activity log.

**Tests**

- New `background/tests/extraction-control.test.ts`, following
  `background/tests/scripted-navigation-control.test.ts`:
  - a non-control sender gets `forbidden`;
  - `start` addresses frame 0 of the automation tab;
  - a pick from another tab is ignored;
  - `confirm` while not recording is refused;
  - the recorded definition's keys match Core's pattern and it holds no preview
    row;
  - tab removal clears the session;
  - a `chrome.storage` spy sees no write.
- `background/connection/tests/gateway-payloads.test.ts`: a `data.extract`
  payload gives event type `web.data.extraction_defined`, `metadata.inputId`
  `web.user.data_extraction_defined`, and the projected `extraction`.

**Accept.** Extension check, then the unit command.

**Mutation targets**

- Drop the control-page check: the `forbidden` row fails.
- Persist the session: the storage spy row fails.
- Include preview rows in the record: the no-rows row fails.

### X4.4 Chrome side panel and Firefox popup UI

**Files**

- **`popup/index.html:39-72` and the same region of `sidepanel/index.html`.**
  - An "Extract data" button in `recorderView`.
  - `<section id="extractionPanel" hidden>` holding the item count, one row per
    field (label input, kind select, an Include or Exclude column choice with
    D12's info text), the pagination choice, a preview table and Confirm and
    Cancel.
  - Encrypt is not shown (D13, Week 3).
  - A diff of the two HTML files reported lines 1-38 as different, possibly only
    line endings; check before editing.
- **New `popup/extraction/`.**
  - `view-model.ts` (pure): field rows from a proposal, with Exclude pre-selected
    where the proposal says so, and the confirm payload.
  - `panel.ts`: renders with `textContent` only, since preview cells are page text.
  - `index.ts` barrel.
- **`popup/index.ts`.** At most 10 lines of wiring next to the record button
  handler (`:119-126`). The file is 514 lines.
- **`popup/styles.css`** and **`sidepanel/styles.css`.**

**Tests**

- `popup/extraction/tests/view-model.test.ts`:
  - excluded fields are pre-selected;
  - renaming a label keeps the key unique;
  - the confirm payload carries no preview rows.

**Accept.** Extension check, the unit command, then `pnpm --filter @fluxiq-web-extension/extension build`.

**Manual browser validation** (required, AGENTS.md)

- **Chrome, unpacked build, side panel, on the product-catalog fixture.**
  1. Start recording.
  2. Choose Extract data and pick a product name.
  3. The panel shows 8 items and the fields, with a preview of text only.
  4. Confirm, then stop recording.
  5. The Events tab shows one extraction entry and no click.
  6. The Core proposal has one `extract_list` node with `recordOutput` and
     `timeoutMs`.
- **Firefox, popup.**
  1. Start the pick, then click the page, which closes the popup.
  2. Reopen the popup. The session shows the picked proposal, which proves the
     background owns it.
  3. Escape cancels.
  4. Picking inside an iframe is refused with a message (top frame only).
- **Both, after K2-K9.** Approve and run the Flow; the dataset appears in Core.
  Record the browser, build, page and extension state.

### X4.5 Documentation

- `docs/architecture/extension-client.md:124-128,633`: the picker and extraction
  panel.
- `docs/architecture/web-capabilities.md:116`: structured extraction is recordable.
- `docs/architecture/sensitive-values.md:230-239`: Exclude is pre-selected from
  the sensitivity rule.

---

## Part 4: X5 steps (Lab measurement)

### X5.1 test-contracts (serial within the package)

**Files**

- **`recordable-actions.ts`.**
  - `:55`: `extract: ["web.dom.extract_list", "web.dom.extract"]`.
  - Delete the paginated-click branch at `:67-68` and its comment at `:22-26`.
- **`flow-lane-exclusion.ts:12-15`.** Comment only.
- **`evaluation.ts`.**
  - `:6`: `"0.3"`.
  - `RunEvaluation` (`:103-144`) gains `extraction: RunExtractionMeasurement[] | null`, where
    `RunExtractionMeasurement = { stepIndex; status: "judged" | "not_run" | "not_expected"; expectedRecords; observedRecords; matchedRecords; expectedFields; presentFields; unexpectedFields; pagesFollowed: number | null; truncated: boolean | null; durationMs: number | null; nonStringValues }`.
  - Numbers and booleans only: no step id, field name, or value (D6).
- **`evaluation-validation.ts`.**
  - `:27`: accept `0.3`.
  - `:170-173`: 0.1 and 0.2 normalize to 0.3 with `extraction: null` (D7).
  - Refuse any string member of a measurement.
  - Enforce `matchedRecords ≤ min(expectedRecords, observedRecords)` and
    `presentFields ≤ expectedFields`.
- **`bench-report.ts`.**
  - `:72-129` gains
    `extractionByLane?: Partial<Record<EvaluationLane, BenchExtractionMetrics>>`
    with `judgedSteps`, `unjudgedSteps`, and `BenchRate`s
    `extractionRecordAccuracy`, `extractionCountAccuracy`,
    `extractionExactSuccess`, `extractionFieldCompleteness`,
    `paginationAccuracy` and `extractionFalseSuccess`, plus the distributions
    `extractionDurationMs` and `extractionMsPerPage`.
  - `:187-199` and `:201-218` gain ids `extraction:<lane>:<metric>`. Accuracy
    tolerance is one record of the population; success rates use
    `BENCH_TOLERANCE.rateWorkflows`.
  - The schema version stays `0.1`: the block is optional, like `notExecutedRuns`
    (`:98-114`).
- **`bench-report-validation.ts:97`.** Add `extractionByLane` to the keys, plus
  its bounds.

**Tests**

- `tests/evaluation-contracts.test.mjs`:
  - 0.3 is accepted;
  - 0.2 reads back with `extraction: null`;
  - a planted `"4242424242424242"` in a measurement is refused.
- `tests/bench-report-contracts.test.mjs`: `matched > expected` is refused, and
  an absent block is valid.
- `tests/flow-lane-exclusion.test.mjs:9-15,19-24`: W04's and W08's shapes keep a
  Flow lane; a paginated extract yields `web.dom.extract_list`, not a click.

**Accept.** `pnpm --filter @fluxiq-web-extension/test-contracts test`.

**Mutation targets**

- Revert `extract` to `[]`: the W04 row fails.
- Remove the string refusal: the planted-value row fails.
- Drop `matched ≤ expected`: its row fails.

### X5.2 `measureExtraction`

**Files.** `packages/test-runner/src/run-expectations/extraction.ts`.

- New `measureExtraction(entry, records, observed: { pagesRead?; truncated?; durationMs?; nonStringValues })`.
  - Matching is positional, as `:31-34` does.
  - Optional fields are left out of `expectedFields`.
- `assertExtraction` (`:14-29`) is rebuilt on it, and newly asserts:
  - `pages` against `pagesRead`;
  - `truncated`;
  - that a field outside `optionalFields` is present.

**Tests** (`run-expectations/tests/extraction.test.ts`)

- Order matters.
- An extra field counts in `unexpectedFields` and fails.
- An optional field may be absent.
- `null` matches only `null`.
- `pages: 3` against 2 fails.
- `truncated: true` against false fails.

**Accept.** `pnpm --filter @fluxiq-web-extension/test-runner build`, then
`node --test packages/test-runner/dist/run-expectations/tests/extraction.test.js`.

**Mutation targets**

- Compare as a set: the order row fails.
- Drop the key-length check (`:33`): the extra-field row fails.

### X5.3 The extraction intent seam (recording lane)

**Files**

- **`background/extraction/control.ts`** (owned by X4-C). The test message
  `fluxiq.test.defineExtraction { definition }` is accepted from the control page
  only. It runs the confirm path without a pick:
  - `extraction.record` puts `data.extract` in the recording;
  - it then runs `web.dom.extract_list` through `runBrowserActionCommand`
    (`apps/extension/src/runtime/action-runner.ts:41`) on the automation tab;
  - it answers `{ records, pagesRead, truncated, durationMs }` to the control page
    only, never storing them.
- **New `packages/test-runner/src/scenario-steps/extract-intent.ts`.**
  - `scenarioExtractionDefinition(step)` translates the runner grammar:
    - `testid:X` becomes `[data-testid="X"]`, through
      `scenario-steps/css-selector.ts` and `parse-target.ts`;
    - `@attr` stays;
    - `column:` stays, since the page supports it;
    - `pagination` becomes `paginate` by `mode`;
    - `minItems` is copied;
    - labels are the field keys.
  - `createExtractionIntentDriver(extensionControlPage)` follows
    `scripted-navigation.ts:22-34,88-90`.
- **`scenario-steps/step-runner.ts`.**
  - `:11-26`: a new option, `extractionIntent?(page, step): Promise<ExtractionIntentResult>`.
  - `:116`: use it when present, and `extractRecords` otherwise. Keep
    `extract-records.ts` as the reference reader for runs with no extension
    control.
- **`run-scenario.ts:305-311`.**
  - Pass `extractionIntent: createExtractionIntentDriver(extensionControl)`.
  - Measure each step with X5.2.
  - Write counts-only `snapshots/extraction.json` through a new
    `run-evaluation/extraction-snapshot.ts`. `run-scenario.ts` is already 756
    lines, with an 800-line limit.
- **`flow-lane/lane-observation.ts`.** `:10-13` adds `"extraction"` to the Pick;
  `:16-33` and `:40-57` fill it.
- **`bench/evaluate-run.ts`.**
  - `:177-191`: read `snapshots/extraction.json`.
  - `:93-111`: copy `extraction`.
  - `:114-138`: set `null`.
- **`run-evaluation/single-run-evaluation.ts` and `observed-run-evaluation.ts`.**
  Write `extraction`. They were not read in detail.

**Tests**

- `scenario-steps/tests/extract-intent.test.ts`: one row per grammar form and per
  mode, plus `minItems`.
- `scenario-steps/tests/step-runner.test.ts`: with the seam present, no Playwright
  locator is read (spy).
- `run-evaluation/tests/runner-wiring.test.ts`: `extraction.json` holds counts,
  and a bundle scan finds no planted value.
- `run-evaluation/tests/bench-parity.test.ts`: the bench and a single run agree on
  `extraction`.
- `background/tests/extraction-control.test.ts`: the test message is refused
  outside the control page.

**Accept.** The test-runner build plus those `node --test` files, then the
extension unit command. Live: `pnpm lab run product-catalog`, then
`pnpm lab run product-catalog --workflow paginated-extraction`, one at a time.
This is live browser automation.

**Mutation targets**

- Fall back to `extractRecords` when the seam is present: the spy row fails.
- Write the records into `extraction.json`: the bundle scan fails.

### X5.4 Fixtures (one worker per scenario directory, after X5.1)

- **product-catalog** (`manifest.ts`, `markup.ts`, `tests/scenario.test.ts`,
  `apps/scenario-lab/e2e/product-catalog.spec.ts`):
  - `pages: 3` on W05 and W07 (`:63,119`);
  - `expected.actions` gains `web.dom.extract_list` on W04, W05 and W07;
  - variants `with-images` (`image@src`, `image@alt`, lazy `data-src`),
    `sparse-cards` (`optionalFields`, `null` values), `absolute-links` and
    `link-pagination`;
  - workflow `numbered-pages`: `pagination: { mode: "numbered", pages: "testid:pagination-page-", maxPages: 5 }`,
    count 23, `pages: 3`. Check how `testid:` prefix targets translate: the page
    needs `[data-testid^=…]`, so X5.3's translator must support a prefix form, or
    use a CSS target here;
  - `extract-specs` (nested values) is not in any contract, and is deferred.
- **data-table:** `empty-table` (`minItems: 0`, count 0) and `large-table`
  (2,000 rows, count 1,000, `truncated: true`).
- **infinite-feed:**
  - records for W11;
  - workflow `extract-until-end` with `{ mode: "scroll", maxScrolls: 20 }`;
  - variant or workflow `load-more-button` with `{ mode: "loadMore", control: "testid:load-more", maxPages: 10 }`;
  - delete the comment at `:50`.
- **iframe-checkout:** workflow `extract-order-lines` from the same-origin frame.
  The intent carries the frame. The picker is top-frame only, so this measures
  the intent path.
- **sensitive-input** (a workflow, to avoid a new registry entry): items holding
  visible card text and a password input.
  - A `value` field on the password control expects failure
    `blocked_by_capability_or_policy`.
  - An excluded variant succeeds, and a bundle scan finds no planted string.
- **admin-console:** delete the comment at `manifest.ts:143`.

**Accept per fixture.** `pnpm --filter @fluxiq-web-extension/scenario-lab test`,
then `pnpm --filter @fluxiq-web-extension/scenario-lab test:e2e -- <id>`, alone.

**Mutation target per fixture.** Arm the variant with its distinguishing change
removed: that fixture's spec fails.

**Content harness rows** on the same fixtures go in
`e2e/content/tests/extract-list.spec.ts`, serial with X3-B: with-images,
sparse-cards, absolute-links, numbered, load-more, empty-table, the 1,000-cap
truncation, and sensitive text. **Mutation:** read excluded fields, and the
sensitive-text row fails.

### X5.5 Flow-lane judging from Core's run datasets (after Core K5 and K8)

**Files**

- **New `flow-lane/run-datasets.ts`**, `readRunDatasets(control, projectId, runId, detail, bounds)`.
  - Take `runDetail.datasets` (K5: `AutomationStudioRunDatasetSummary[]` with
    `nodeIds`, `recordCount`, `truncated` and `invalidCount`).
  - For each dataset, call `get-run-dataset-page` with
    `{ projectId, runId, datasetId, limit: 200, cursor }` until `nextCursor` is
    null (CD20 pages 1-200).
  - Rebuild records over the page's `schema.fields`, putting `null` back for each
    field a row lacks (correction 4).
  - Count every non-string, non-null cell in `nonStringValues`.
- **`flow-lane/persisted-flow-run.ts`.**
  - `:280-297`: call the reader after `get-flow-run-detail`.
  - Replace `extractedRecords` (`:395-419`) and the per-attempt `extracted`
    (`:41-48,309,321`) with per-node datasets:
    `extracted: Array<{ nodeId; records; truncated; invalidCount }>`.
  - Attempt `metadata.recordCount` (K5) gives per-attempt counts.
- **`flow-lane/expectations.ts:54-105`.**
  - `not_applicable` is replaced. Fewer extract nodes than extract steps fails as
    `recording.contract`.
  - Datasets pair with steps by candidate order (`run-flow-lane.ts:129`) against
    the script's extract-step order.
  - One node reads every page, so W05's single entry now matches one dataset,
    which settles ex-d open question 1.
  - Judged, the measurement comes from X5.2.
- **`flow-lane/run-flow-lane.ts`.** `:155,180` use the new judge; `:267` publishes
  counts only.

**Tests**

- `flow-lane/tests/persisted-flow-run.test.ts:123`, with a fake control answering
  run detail with `datasets` and two dataset pages linked by a cursor:
  - all rows are read;
  - a missing optional field reads as `null`;
  - a number cell counts in `nonStringValues`.
- `flow-lane/tests/expectations.test.ts`:
  - a missing extract node gives `recording.contract`;
  - reordered nodes still pair by candidate order.
- `flow-lane/tests/run-flow-lane.test.ts:260,403`: `JSON.stringify(snapshot)` has
  no planted value.
- `flow-lane/tests/lane-observation.test.ts:8`.

**Accept.** The test-runner build, then `node --test` on the four flow-lane test
files (x0-x1 X0.7's command).

**Mutation targets**

- Ignore `nextCursor`: the second-page row fails.
- Reinstate `not_applicable`: the missing-node row fails.
- Pair by attempt index: the reorder row fails.
- Skip null restoration: the null row fails.

### X5.6 Bench

**Files**

- `bench/aggregate-report.ts:226-250`: `extractionByLane`, pooled rather than
  averaged, each rate shown with its coverage (`:52-65`).
- `bench/render-markdown.ts:122-157`: rows with Judged and Unjudged columns.
- `bench/comparison-details.ts:14-16`: ids.
- `bench/corpus/week1.ts`: the comment changes from 63 to 67.
- `bench/tests/week1-corpus.test.ts:91,99-100`: `[67, 23, 0, 23, 21]`.
- `bench/tests/evaluate-run.test.ts` and `aggregate-report.test.ts`.

**Mutation target.** Average per step: the uneven 23-against-1 row fails.

**Accept.** The test-runner build, then those tests.

### X5.7 Documentation, then Lab and bench

- **Docs.** `docs/architecture/testing-facility.md:740-742,779-781,891-895,941-945,958,1256`,
  plus the metric definitions.
- **Lab runs,** one at a time, each rerun once before a failure is called real:
  1. `pnpm lab run product-catalog --flow`
  2. `pnpm lab run data-table --flow --variant column-reorder`
  3. `pnpm lab run product-catalog --workflow paginated-extraction --flow`
  4. `pnpm lab run product-catalog --workflow numbered-pages --flow`
- **Bench.** A week1 A/B pair on the production-Core topology, then `lab compare`
  (D7).

---

## Part 5: Worker partition and order

### Workers and owned files

| Worker | Owns | Steps | Needs |
| --- | --- | --- | --- |
| X3-A domain inference | `domain/src/extraction/**` (new), one line each in `domain/src/client/index.ts` and `domain/src/index.ts` | X3.3 domain | W2-B (spec type) |
| X3-B page engine | `content/extraction/{field-spec,field-reader,pagination,list-reader,index}.ts` and `tests/`; delete `content/action-runtime/list-extraction.ts` and its test; `action-runtime/{index,execute-action}.ts`; `content/actions/{types,extract-list}.ts`; `e2e/content/tests/extract-list.spec.ts` | X3.1 then X3.2 | x0-page, W1-B |
| X3-C page inference | `content/extraction/{infer-list,item-selector,infer-fields,detect-pagination}.ts` and tests; `content/evidence/repeating.ts`; `content/message-handler.ts`; `shared/extraction-messages.ts` (new); `e2e/content/tests/extraction-inference.spec.ts` | X3.3 page | X3-A, X3-B (shares `content/extraction/index.ts`) |
| Docs X3 | `web-capabilities.md`, `sensitive-values.md` | X3.4 | X3-C |
| X4-A domain recording | `constants.ts`; `recording/events.ts`; `io/input-model.ts`; `output-nodes/{payloads,definitions}.ts`; `web-panel-host.ts`; `recording/proposals/record-output.ts` (new); `actions/extraction/{recorded-definition,read-request}.ts` (new) and `request.ts`; `actions/{types,schemas}.ts`; `client/{gateway-action-parameters,gateway-mapping}.ts`; and tests in `io/`, `output-nodes/`, `actions/`, `client/`, `tests/` | X4.1 | X3-A, W2-B, W3-B, **Core K4c.0 then K7 (with `timeoutMs`)** |
| X4-B content picker | `content/picker/**` (new); `content/message-handler.ts` and `shared/extraction-messages.ts` (after X3-C); `content/recorder.ts`; `content/snapshots.ts`; `shared/protocol.ts`; `content/action-runtime/extract.ts`; `content/actions/extract.ts`; `content/tests/recorder.test.ts`; `e2e/content/tests/extraction-picker.spec.ts` | X4.2 | X3-C, X4-A exports |
| X4-C background | `background/extraction/**` (new); `background/index.ts`; `background/connection/gateway-payloads.ts` and its test; `background/tests/extraction-control.test.ts` | X4.3 and the X5.3 test message | X4-B messages, X4-A exports |
| X4-D UI | `popup/index.html`; `sidepanel/index.html`; `popup/index.ts` (wiring only); `popup/extraction/**` (new); both `styles.css` | X4.4 | X4-B messages; parallel with X4-C |
| Docs X4 | `extension-client.md`, `web-capabilities.md`, `sensitive-values.md` | X4.5 | X4-D |
| X5-A contracts | `packages/test-contracts/src/{recordable-actions,flow-lane-exclusion,evaluation,evaluation-validation,bench-report,bench-report-validation}.ts` and tests | X5.1 | X4 merged (D14) |
| X5-B runner | `run-expectations/extraction.ts`; `scenario-steps/{extract-intent (new),step-runner,extract-records}.ts`; `run-scenario.ts`; `run-evaluation/**`; `flow-lane/lane-observation.ts`; and tests | X5.2, X5.3 | X5-A, X4-C |
| X5-C Flow reader | `flow-lane/{run-datasets (new),persisted-flow-run,expectations,run-flow-lane}.ts` and tests | X5.5 | X5-A, **Core K5 and K8** |
| X5-F1…F6 fixtures | one each: `apps/scenario-lab/src/scenarios/{product-catalog,data-table,infinite-feed,iframe-checkout,sensitive-input,admin-console}/**` and matching `apps/scenario-lab/e2e/<id>.spec.ts` | X5.4 | X5-A |
| X5-H harness rows | `e2e/content/tests/extract-list.spec.ts` | X5.4 harness | X3-B, fixtures |
| X5-D bench | `bench/{aggregate-report,render-markdown,comparison-details,evaluate-run}.ts`; `bench/corpus/week1.ts`; and tests | X5.6 | X5-B, X5-C |
| Docs X5 | `testing-facility.md` | X5.7 docs | X5-D |

### Serial files

- `content/extraction/index.ts`: X3-B, then X3-C.
- `content/message-handler.ts` and `shared/extraction-messages.ts`: X3-C, then X4-B.
- `e2e/content/tests/extract-list.spec.ts`: x0-page, W1-B, X3-B, then X5-H.
- `domain/src/actions/{types,schemas}.ts` and `client/gateway-*.ts`: W2-A,
  W2-B, then X4-A.
- `output-nodes/definitions.ts`: W3-B, then X4-A.
- `content/action-runtime/extract.ts` and `content/actions/extract.ts`: x0-page,
  then X4-B.
- `background/extraction/control.ts`: X4-C owns the test message X5-B calls.
- `persisted-flow-run.ts`, `expectations.ts`, `run-flow-lane.ts`: X5-C only
  (after x01-test-runner).
- `bench/evaluate-run.ts`: X5-B (recording-lane read), then X5-D.
- Core `recordings/candidate-definitions.ts`: K4c.0, then K7 (paired §5).

### Order

1. Finish X0 and X1 (x0-page, W2-B, W1-B, W3-B, X1.6); root gates one at a time.
2. In parallel: X3-A and X3-B.
3. X3-C, then docs X3. Early in Core in parallel: add `timeoutMs` to K7's scope,
   and run K4c.0 then K7.
4. X4-A after X3-A and K7. X4-B after X3-C. Then X4-C and X4-D in parallel. Then
   manual Chrome and Firefox validation, then docs X4.
5. X5-A. Then in parallel X5-B, the fixture workers, and (once Core K5 and K8
   land) X5-C. X5-B's and X5-C's pure logic can be written against fakes during
   step 4 and land after X5-A, accepting a rerun if X4's shapes move.
6. X5-H, then X5-D, then docs X5.
7. Lab runs, then the bench pair, one at a time.

### Dependencies on Core phases

| Downstream | Core phase needed | Why |
| --- | --- | --- |
| X3 | none | page and domain only |
| X4-A compile | K7 types (`recordOutput`, `timeoutMs` on the candidate) | `fluxiq/automation-studio` candidate type |
| X4-A acceptance row | K7 lift; K4c.0 | approval writes `parameterValues.recordOutput` and `timeoutMs` |
| A recorded node that runs | K3 (policy action parses `recordOutput`) | CD13 fails the node before dispatch on an invalid value |
| A dataset from a run | K2, K4a, K4b, K4c, K4d | store, capture, hook, withheld attempt payload |
| X4 manual end-to-end | K8, K9 or K12 | seeing and exporting data |
| X5-C | K5, K8 | `runDetail.datasets`, `get-run-dataset-page` |
| X5 bench on production Core | K1-K10 released | the Flow lane runs the new Core |

### Structure budgets

Limits (`scripts/structure-audit/context.mjs:40-53`, mirrored in
`.structure-baseline.json`): files at most 800 lines (advisory 400), at most 25
source files per directory (advisory 15), at most 15 exported values per file
(advisory 8), three files sharing a prefix become a directory, at most 9 path
segments.

| Location | Now | After |
| --- | --- | --- |
| `content/extraction/` | new | about 10 files; prefix groups `field-` 2, `infer-` 2 |
| `content/action-runtime/` | 18 files | 17 |
| `content/actions/` | 20 files | 20 (no `extract-*` file) |
| `content/` | 17 files (above advisory) | 17 (only directories added) |
| `content/picker/`, `background/extraction/`, `popup/extraction/` | new | 3, 3, 3 files |
| `popup/index.ts` | 514 lines | about 525 |
| `shared/protocol.ts` | 449 lines | about 455; `shared/` 6 → 7 files |
| `background/index.ts` | 183 lines | about 190 |
| `domain/src/extraction/` | new | 5 files |
| `domain/src/actions/extraction/` | X1.1's 4 files | 6 |
| `io/input-model.ts` | 249 | about 280 |
| `output-nodes/payloads.ts` | 187 | about 205 |
| `web-panel-host.ts` | 224 | about 250 (it has a baseline entry; the rule was not checked) |
| `client/gateway-action-parameters.ts` | 334 | shrinks after the reader moves |
| `client/gateway-mapping.ts` | 448 | about 452 |
| `packages/test-contracts/src` | 19 files | 19; `bench-report.ts` 234 → about 290 |
| `packages/test-runner/src/run-scenario.ts` | 756 lines | about 765: keep the writer in `run-evaluation/extraction-snapshot.ts` |
| `flow-lane/` | 12 files; `persisted-flow-run.ts` 430 lines | 13 files; the reader moves to `run-datasets.ts`, so the file shrinks |
| `bench/` | 22 files | 22 |
| `scenario-steps/` | 9 files | 10 |
| `apps/extension/e2e/content/tests/` | **25 files** | 27 with the two new specs: check whether `directory-files` counts test roots (`rules/directory-files.mjs:1-15` counts `ctx.sourceFiles`, not read further). If it does, fold both into one `extraction.spec.ts` (26) and move an existing spec, or ask for a baseline decision |

### Steps that need manual browser validation

- **X4.2-X4.4 picker:** Chrome side panel and Firefox popup, per X4.4's list:
  popup lifetime, background-owned session, picks not recorded, overlay not
  recorded, Escape, iframe refusal.
- **X4 end to end:** record, then proposal, approve, run, and dataset in Core
  (after K2-K9). This needs the user to authorize panel management for the
  session.
- **X3.2 on Firefox:** automated through the Firefox content config, not manual.
- **X5.3, X5.7:** Lab runs are live browser automation, not manual; run one at a
  time.

---

## What changed and why

Created this report only, as the brief allows. No source or document was edited.

## Commands run and observed results

All read-only.

- **`git log --oneline -3`, `git status --short`, `git diff --stat 13b0a0d -- apps/extension/src/content`.**
  HEAD is `13b0a0d`. Ten files under `apps/extension/src/content` and
  `e2e/content/tests` are modified, one test is untracked, and the two working
  documents are modified (x0-page in progress).
- **`wc -l` and `ls` over the domain, extension, test-contracts, test-runner and
  scenario-lab directories named above.** The counts are in Part 5, for example
  `list-extraction.ts` 272, `results.ts` 420, `types.ts` 461,
  `gateway-mapping.ts` 448, `persisted-flow-run.ts` 430, `run-scenario.ts` 756,
  `popup/index.ts` 514, `e2e/content/tests` 25 files.
- **`node -e` printing** `domain/package.json` exports and dependencies, the
  scripts of the extension, test-runner, test-contracts, scenario-lab and root
  packages, both extension manifests, and the `.structure-baseline.json` keys and
  limits.
- **`grep` and `sed` over the files cited, and over Core** (`importer-sdk.ts`,
  `recording-flow-proposal.ts`, `proposal-candidates.ts`, `io-policy.ts`,
  `nodes/policy/action.ts`, `summaries/conversions.ts`, `record-sets/*`) and
  Core's `k-datasets-execution.md` §4 K5, K7, K8 and §5.
- **`git log --oneline -5` in `F:\!FluxIQ`.** Of the dataset phases only K1 has
  landed (`33f0b4a`). `recordings/candidate-definitions.ts` does not exist yet
  (K4c.0 pending).

No build, test, Lab, browser, or history-changing git command was run.

## Not verified

- Every "(reasoned)" item and every step's behaviour. Nothing was executed.
- That a `window` capture listener calling `stopImmediatePropagation` keeps
  picks from the recorder in Firefox as in Chrome (standard DOM order says it does).
- Firefox popup lifetime while the page takes focus.
- That the background intake accepts a new `data.extract` kind unchanged.
  `recorded-event-intake.ts` special-cases kinds (`:55,84,193`) but its `accept`
  body was not read in full.
- How Core's authored web output node (as opposed to a recorded
  `builtin.policy.action`) gets its timeout. `manifest-definitions.ts:25-27` says
  `metadata.timeoutMs`; not traced.
- Whether `directory-files` counts files in test roots, and the rule behind
  `web-panel-host`'s baseline entry.
- `feedLengths.baseline` for infinite-feed, `admin-console/virtual-list.ts` node
  recycling, `dialog.ts`, `execute-action.ts` beyond `:18,37`,
  `single-run-evaluation.ts`, `observed-run-evaluation.ts`, and the
  `multi-tab/manifest.ts:41` comment.
- Whether `fluxiq/automation-studio` re-exports the record-set limits, so a
  domain test could import Core's field id pattern instead of restating it.
- The sidepanel and popup HTML difference at lines 1-38.
- Whether running `web.dom.extract_list` through `runBrowserActionCommand` during
  a recording adds evidence events that change any manifest's
  `recordingEvents` counts.

## Open questions or contradictions found

1. **K7 must also carry `timeoutMs`** (correction 2). Recommendation, taken:
   add an optional candidate `timeoutMs` lifted into `parameterValues.timeoutMs`
   in the paired document's K7. Without it D14 cannot be met for recorded nodes.
2. **Design's interim record source is not the Lab's.** The Design section says
   records come from `session.trace.attempts[].outputs.result` until K4. The Lab
   reads `get-flow-run-detail`, whose attempts carry none (correction 1).
   Recommendation, taken: no interim reader; X5.5 waits for K5 and K8. Update the
   Design sentence.
3. **C5 needs three more messages:** `extraction.propose` (X3.3 and the picker),
   `extraction.record` (content emits the event so its sequence and mutation
   flush match the page's), and `fluxiq.extractionPicked` (content reports to the
   background while the popup may be closed). Plus the test message
   `fluxiq.test.defineExtraction`.
4. **C3 needs two input ids** (correction 5), and the value form has no
   `recordOutput`. Recommendation, taken: `web.user.value_extraction_defined`.
5. **Field keys, dataset ids and nulls** (corrections 3 and 4) are Core contract
   constraints the downstream plan did not state. Put them in C1 and C3.
6. **No confirmation on extraction candidates** (correction 6). It may be worth a
   line in `docs/architecture/web-capabilities.md`.
7. **The picker overlay can propose a spurious wait** (correction 8).
8. **E55 remains open for `scroll` on virtualised lists.** Identity
   de-duplication and node recycling conflict.
9. **Dataset id stability.** A re-recorded extraction gets a new dataset id.
   Core's K12 Data window groups by dataset id, so it should know that.
10. **The picker is top-frame only in X4.** Frame extraction is reachable only
    through the intent path in X5 (iframe-checkout).
11. **Column header labels are page text** carried in the recorded definition
    and the Core schema. They are structure, not sample values, so D3 holds, but
    `sensitive-values.md` should say so.
12. **More rows become judged on the Flow lane** (correction 10): W05, W07, W09,
    W11, W15 and W18 as well as W04 and W08. Expect new failures in the first A/B
    pair. They are measurements under D7.
13. **ex-d's nested values** (`extract-specs`) have no contract in X1 or D14.
    Deferred.
14. **`list-extraction.ts:58-63`** still says the content script must not import
    domain runtime values while `:36` does. X3.1 deletes the mirror.
15. **`e2e/content/tests/` is at 25 files.** Adding two specs may breach the
    directory limit (Part 5).
