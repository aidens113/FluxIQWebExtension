# ex-a-extension-domain — extraction today in the web domain and extension

Brief: read-only investigation for "first-class data extraction", extension and
domain half. Scope read: `domain/src`, `apps/extension/src`,
`docs/architecture/web-capabilities.md`, `docs/architecture/sensitive-values.md`,
plus test titles in `apps/extension/e2e/content/tests` (named by the brief) and
the extract lines of `packages/test-contracts/src/{scenario,recordable-actions}.ts`
(the contract `actions/types.ts:156` names). No builds, tests or Lab commands run.

## Outcome

Done. Every claim below is from reading code. Nothing was executed. Findings
marked **(reasoned)** come from tracing the code by hand, with no run behind them.

## 1. Current contracts

### `web.dom.extract` (single value)

- **Type and safety.** Declared at `domain/src/actions/types.ts:26`. Safety is `"safe"` (`actions/safety.ts:22`), so it needs no operator approval (`output-nodes/definitions.ts:51,73-77`). It is exempt from the unsupported-page block (`apps/extension/src/runtime/action-runner.ts:343-350`).
- **Schema.** `selectorSchema`: `selector` is required, with optional `element`, `visualTarget` and `timeoutMs` (`actions/schemas.ts:48-57,291`). The node parameters are `target`, `selector`, `element`, `visualTarget` and `timeoutMs` (`definitions.ts:106-113,146`), plus `expectedState` (`definitions.ts:34-40,81`). Because `selector` is required, the node declares `elementTarget: true` (`definitions.ts:101`), so Core's fingerprint adaptation applies. The LLM target override also accepts it (`runtime/llm-evidence/target-override.ts:41`).
- **Modes.** The content reader (`apps/extension/src/content/action-runtime/extract.ts:6-12`) supports four modes:
  - `options.mode === "html"` returns `innerHTML`.
  - `"attribute"` with `options.attribute` returns that attribute, or `""` when absent.
  - An `input`, `textarea` or `select` returns its live `.value`.
  - Anything else returns whitespace-collapsed `textContent`.

  `mode` and `attribute` exist in no schema, node parameter or recorded payload. They arrive only because the raw parameters are copied into `options` (`web-capabilities.md:115`; `client/gateway-mapping.ts:180`).
- **Verb.** `content/actions/extract.ts:10-19` resolves the target and returns `extracted`, `element`, `snapshot` and `resolution`. Its validation is `{status:"none", reason:"evidence-only"}` (`extract.ts:13`; `types.ts:277`).
- **Recording.** `output-nodes/payloads.ts:86` can build recorded parameters for it, but no recorded input maps to it (`io/input-model.ts:95-107`).

### `web.dom.extract_list`

- **Type and safety.** Declared at `types.ts:30`, safety `"safe"` (`safety.ts:29`).
- **Request.**
  - `WebAutomationExtractListRequest = { item: string; fields: Record<string,string>; paginate?: {next, maxPages}; maxItems? }` (`types.ts:151-167`).
  - Command field: `extractList` (`types.ts:253-254`).
  - Schema: `extractList` is required, `item` and `fields` are required, `paginate` requires `next` and `maxPages` (1..`WEB_AUTOMATION_EXTRACT_MAX_PAGES`), and `maxItems` has minimum 1 (`schemas.ts:140-158,317-322`).
  - The node has one structured parameter, `extractList` (`definitions.ts:141`), and no `selector`, so no `elementTarget` (`definitions.ts:101`).
- **Field grammar** (`content/action-runtime/list-extraction.ts:54-81`):
  - A plain selector reads text.
  - An empty string reads the item itself.
  - `selector@attr` reads an attribute. The `@` only counts when what follows matches `ATTRIBUTE_NAME` (`:52,72-75`).
  - `column:<header>` reads a table cell by its header text (`:67-71,151-163`). colspan is not modelled (`:146-150`).
  - **Not supported:** no dedicated "link" kind (a link is `a@href`, returning the raw attribute; the harness expects root-relative hrefs, `e2e/content/tests/extract-list.spec.ts:29,36`). No typed values: every value is a string (`list-extraction.ts:26`; `web-capabilities.md:116`). No optional fields. A field some record lacks is left out of that record rather than set to null (`:131-132`).
- **Gateway lift and limits.**
  - `extractListRequestValue` needs `item` and a non-empty `fields` map in which every entry is a non-empty string (`client/gateway-action-parameters.ts:176-194`).
  - A malformed `paginate` refuses the whole request (`:181-182`). `maxPages` is clamped to 50, not refused (`:197-203`; `types.ts:392`).
  - A non-positive `maxItems` is silently dropped, which leaves the read unbounded (`:183`).
  - The page applies its own `EXTRACT_MAX_PAGES = 50` (`list-extraction.ts:45,88`). `maxItems` has no default and no hard cap (`:89`).
- **Pagination** (`list-extraction.ts:96-122,172-186`):
  - The loop clicks `next`, then polls every 25 ms for up to 10 s (`:48-49`) until the list has changed: the first item is detached, the count differs, or the first item is a different node.
  - Next control absent: the list has ended, not truncated (`:110-112`). Stopping at `maxPages` while it is still present sets `truncated` (`:113-116`).
  - `timeoutMs` is ignored, so a 50-page read can run about 500 s. **(reasoned)** Core may give up earlier: the node default is 5,000 ms (`recording/proposals/late-target-wait.ts:15-17`), and the adapter sends it as the command timeout (`runtime/adapter.ts:90`).
- **Result.** `extracted` is the records array, alongside `snapshot`, with no `element` or `resolution` (`content/actions/extract-list.ts:24-28`).
  - `pagesRead`, `truncated` and `missingFields` appear only as validation prose (`:36-42`), which is bounded by `boundValidation` (`action-runtime/results.ts:151`).
  - The validation passes exactly when `missingFields` is empty (`extract-list.ts:39-40`).
- **Errors.**
  - A missing field is a failed validation, which becomes `OUTPUT_NOT_OBSERVED` (`results.ts:144-160,239-243`).
  - Four conditions throw (`list-extraction.ts:85,87,117,120,154`): no item, no fields, `next` not an HTMLElement, list unchanged after `next`, and a `column:` field on non-table items. A throw is handled by `actionFailure`, which uses `classifyWebAutomationFailure` or falls back to `UNKNOWN` (`results.ts:102-113`, classifier not read).
  - An unreadable required `extractList` is refused before dispatch with `INVALID_PARAMETER` (`gateway-mapping.ts:160-165,384-389`).
  - `AUTH_REQUIRED` detection keys off `action.selector` (`results.ts:278-285`), which `extract_list` never has.
- **Scenario contract.** The Lab's `extract` step is "the runner's own data-extraction check, never recorded as an extract action" (`packages/test-contracts/src/scenario.ts:23-24`; `recordable-actions.ts:22-26,55`).

## 2. Travel to Core, size, redaction

- **Path.**
  1. The content result is built in `results.ts:382-409`, with `extracted` copied at `:407`.
  2. `gatewayActionResultFromBrowserResult` wraps it into the gateway `payload` through `webAutomationActionResultPayload` (`apps/extension/src/runtime/result-mapping.ts:48-73`; `gateway-mapping.ts:270-287`, `extracted` at `:282`).
  3. On the Core side, the domain adapter passes `result.payload` through unchanged, except that it withholds validation comparisons (`runtime/adapter.ts:103-104,120,307-320`).
  4. How Core then exposes `extracted` to later nodes is not in this repository.
- **Recordings.** The runtime-confirmation path puts the whole action result, `extracted` included, into a recording event (`background/connection/server-command-channel.ts:218-241`). So do the `action.result` events (`gateway-payloads.ts:76`; `server-command-channel.ts:198-206`). The reducer writes it to state `runtime.lastActionResult` (`recording/reducers.ts:49`; `recording/domain.ts:92`).
- **Size.** Nothing bounds `extracted`: a search for `MAX_*BYTES` in both packages finds only the upload bounds (`types.ts:395-396`). The only record bound is the optional `maxItems`, and every successful `extract_list` also carries a full snapshot (`extract-list.ts:27`). The background queue is capped by event count, not bytes (`background/storage.ts:49`).
- **Redaction.**
  - The wire guard covers `validation` only (`gateway-mapping.ts:275,322-327`). `extracted` passes through unguarded.
  - `sensitive-values.md:230-239` says so explicitly: extracted values and `web.dom.extract` output have no sensitivity guard.
  - **Contradiction (reasoned):** `extract.ts:10` returns `.value` for any input, a password field included. That bypasses `readElementValue`, which withholds a sensitive control's value everywhere else (`sensitive-values.md:54`; `content/describe-element.ts:153`).
  - `dialog.ts:32` also reuses `extracted` for dialog evidence, so the field has two meanings.

## 3. Recorder pipeline and where "extract" plugs in

- **Page to recording event.**
  - Capture-phase listeners (`content/dom-events.ts:47-167`) call `emit` (`content/recorder.ts:52-58`), which sends `CONTENT_EVENT`. Kinds are listed at `shared/protocol.ts:366-382`. `EXECUTABLE_KINDS` (`recorder.ts:23`) flush the pending mutation batch first.
  - The background builds the gateway event with `gatewayRecordingEventFromPayload` (`background/connection/gateway-payloads.ts:60-86`), which calls `createWebAutomationRecordingEvent` (`gateway-mapping.ts:69-115`, payload whitelist at `:83-108`).
  - The event type comes from `webAutomationEventTypeForClientKind` (`io/input-model.ts:47-64`; `constants.ts:4-21`). Event definitions and their payload schema are at `recording/events.ts:44-91`.
- **Recording event to Core proposal.**
  - `mapWebRecordingObservation` (`web-panel-host.ts:132-138`) calls the single mapping `webAutomationRecordedAction` (`input-model.ts:76-83`): `recordedActionInputId` (`:116-154`), then output (`:95-111`), then `webAutomationOutputPayload` (`output-nodes/payloads.ts:14-94`), then `hasExecutableParameters` (`:194-206`).
  - The candidate carries `sourceInputIds`, `expectedConfirmation` and confidence 0.9 (`web-panel-host.ts:161-163`), with labels from `web-panel-host.ts:101-111`.
  - Extra proposals, currently only the late-target wait, come from `recording/proposals/` (`web-panel-host.ts:135`; `late-target-wait.ts:54-66`).
- **No extract event exists anywhere.** No kind, event type, input id or label mentions extract. `payloads.ts:90-93` calls `extract_list` "dispatch-only".
- **Where an explicit event plugs in, in order:**
  1. A new kind in `protocol.ts:366`.
  2. `WEB_AUTOMATION_EVENTS` (`constants.ts:4`).
  3. An event definition and an `extraction` schema field (`events.ts:44-91`).
  4. A mapping case (`input-model.ts:47-64`).
  5. An input id and an `actionInputDefinitions` row mapping to `web.dom.extract_list` (`input-model.ts:7-21,95-107`).
  6. A case in `recordedActionInputId` (`:116`).
  7. A branch in `recordedOutputParameters` (`payloads.ts:65-94`).
  8. An executability rule (`input-model.ts:194-206`).
  9. A field copy in `WebAutomationRecordedPayload` and its whitelist (`gateway-mapping.ts:23-40,83-108`) and in `gateway-payloads.ts:60-86`.
  10. `EXECUTABLE_KINDS` (`recorder.ts:23`).
  11. `CANDIDATE_LABELS` (`web-panel-host.ts:101`).

  The event would be emitted by the picker flow (section 4), not by a page listener.
- **What `content/evidence/repeating.ts` detects:**
  - Candidates are `li`, `tr`, `article`, `[data-testid]` and list, row, option, article and treeitem roles (`:22`), up to 2,000 scanned (`:23,45-47`).
  - They are grouped by parent and a signature of tag, role, test-id shape and up to 3 classes (`:48-56,68-77`). Runs of 3 or more are kept, top 6 by size (`:24-25,34-37`).
  - Each run reports `containerSelector`, `signature`, `itemCount`, the first item as representative (selector, testId, text up to 160 chars) and `fields`. `fields` are the test ids inside the first item, up to 8 (`:79-109`), in the shape of `domain/src/page-evidence/types.ts:176-191`.
  - The evidence flows through page evidence (`content/evidence/page.ts:45,62`), a cross-frame merge (`background/connection/dom-snapshot.ts:259,337`) and state `evidence.repeating` (`recording/web-state/evidence/project.ts:233-236`; `recording/domain.ts:90`).
  - The harness proves 8 product cards with named fields, plus pagination as its own run (`e2e/content/tests/evidence.spec.ts:132-152`).
- **Could it drive automatic detection?** Partly. It gives the container, the count and test-id field names. It does not give:
  - a CSS selector that matches every item (`signature` is `tag|role|shape|classes`, not CSS, `:71`; the representative selector is one item's path, `dom-snapshot.test.ts:160`);
  - fields on pages without `data-testid`, `data-test` or `data-cy` (`:103`);
  - text, link or image fields, or table headers;
  - `div` grids with no role or test id (`:22`).

  It is a seed, not an inference engine.

## 4. Extension UI and element picking

- **One UI script.** `sidepanel/index.ts:1` only imports `popup/index.ts`, and the two HTML files have the same markup (`sidepanel/index.html:34-72`; `popup/index.html:34-40`).
- **Recorder view.** `recorderView` holds `recordButton` and the runtime card (`index.html:39-72`). Buttons send `RUNTIME_MESSAGES` (`popup/index.ts:119-126`; `shared/constants.ts:16-34`), which `background/index.ts:84-130` routes.
- **Content messages.** The content script accepts only `fluxiq.ping`, `recording`, `captureSnapshot` and `executeAction` (`content/message-handler.ts:48-76`). The entry point wires modules only (`content/index.ts:14-25`).
- **No picker, highlight or overlay code exists.** Searching `apps/extension/src` for `highlight|overlay|picker|pickElement|outline` matched 15 files. I opened `content/evidence/overlays.ts`, which detects blocking overlays and does not draw any (`:1-15,30-51`). The others, by name and matched line, are the pairing and recording-lock dialogs (`sidepanel/index.html:147,157`), a focus-outline style (`popup/styles.css:38`), and evidence, actionability and snapshot modules. None looks like UI, but I did not open them all.
- **Where a picker would live:**
  - A new `content/picker/` directory: an overlay in a shadow root, and a pick session with capture listeners on `window` that suppress the click.
  - New message types in `message-handler.ts`.
  - An "Extract data" button and a preview view in `recorderView`, in both HTML files.
  - New `RUNTIME_MESSAGES` entries and a background module (`background/extraction/`) routed from `background/index.ts:84`.
- **Two risks (reasoned):**
  - The recorder's capture listeners on `document` record trusted clicks (`dom-events.ts:48-82`). A picker must stop propagation from a `window` capture listener, or the recorder must check a "picking" flag, or picking gets recorded as `dom.click`.
  - A Firefox popup closes when the page takes focus, so the pick session and its result must live in the background, not the popup. I did not verify this here.

## 5. Existing tests covering extraction

- **Extension unit tests.**
  - `content/action-runtime/tests/list-extraction.test.ts`:
    - "a plain selector reads the element's text" (:13)
    - "an empty selector reads the item itself" (:17)
    - "a trailing @attribute reads that attribute instead of the text" (:21)
    - "the item's own attribute needs no selector" (:29)
    - "an @ that is not an attribute name stays part of the selector" (:33)
    - "column: names the header whose cell the field reads" (:37)
    - "a column field with no header is rejected rather than matching every column" (:42)
    - "the page bound agrees with the domain's, which the content script cannot import" (:46)
  - `content/actions/tests/execute.test.ts:180`: "no action type can leave the background worker without a reply", which includes `extractList`.
  - `runtime/tests/result-mapping.test.ts:123`: "an explicit visual target wins over one derived from the element, and extracted data is kept".
  - `runtime/tests/action-runner.test.ts:506-507`: "a web.dom.extract that meets a navigating page the same way is sent once".
  - `background/connection/tests/runtime-status.test.ts:44,50`: labels.
  - Repeating evidence: `background/connection/tests/dom-snapshot.test.ts:106,159-160` and `page-evidence-capture.test.ts:96-97,133-134`.
- **Domain tests.** Most are assertion-style scripts without test names, so these are cited by line.
  - `actions/tests/schemas.test.ts:78`: "web.dom.extract_list mirrors the scenario contract's extract step and bounds its pagination".
  - `client/tests/gateway-command-parameters.test.ts:85-97,207-211`: lift, clamp and refusals.
  - `client/tests/gateway-mapping.test.ts:60,68`: alias, and no rewrite into extract.
  - `output-nodes/tests/definitions.test.ts:29,68,88-90,150`.
  - `output-nodes/tests/payloads.test.ts:52`: `extract_list` is dispatch-only.
  - Others: `output-nodes/tests/native-runtime.test.ts:51`, `io/tests/input-model.test.ts:224-229`, `io/tests/manifest-definitions.test.ts:31`, `tests/safety.test.ts:13-18`, `tests/domain.test.ts:263,286`.
  - Repeating state: `recording/web-state/tests/evidence.test.ts:56,145,154-156`, `recording/tests/domain.test.ts:86`, `page-evidence/tests/capture.test.ts:83-89,140`.
- **Content harness (Playwright).**
  - `e2e/content/tests/extract-list.spec.ts`, "on product-catalog" (:78):
    - "page one: every card's text and its link's raw href" (:79)
    - "every page: Next is followed until it is absent, and each new page is read, not the stale one" (:98)
    - "maxPages: stopping with a page left is reported as truncated" (:124)
    - "maxItems: the record list is bounded and reported as truncated" (:138)
    - "a declared field no record yields fails the validation with output_not_observed" (:152)
    - "text-variant: rewritten price text is extracted as the page now renders it" (:173)
  - Same file, "on data-table" (:186):
    - "column: each field reads the cell under its header" (:187)
    - "column-reorder: the same records come back from reordered columns" (:205)
    - "a column header the table does not have is reported missing, not read from another column" (:218)
  - `actions.spec.ts:189`: "extract: text by default, one attribute, or a field's value".
  - `evidence.spec.ts:132-152`: the "repeating structures" item.
  - These use `web.dom.extract` only to read an element's descriptor: `identity.spec.ts:20-24`, `identity-fixtures.ts:54-58`, `identity-resolution.spec.ts:10`, `large-page-resolution.spec.ts:132`.
  - `upload-dialog.spec.ts:129` reads `extracted` as dialog evidence.
- **Lab and runner (paths only, not read).** `packages/test-runner/src/scenario-steps/extract-records.ts` and its tests, `run-expectations/extraction.ts` and its tests.
- **Not covered by any test:**
  - a list that matches zero items
  - "load more" or infinite-scroll pagination (`web-capabilities.md:118` calls append-style pagination "unexercised")
  - `html` mode, or `extract` on a sensitive control
  - result size
  - extraction on Firefox

## 6. Gaps and recommended minimal design (extension and domain)

### Gaps

- **G1. Not recordable.** There is no event, input or mapping (section 3).
- **G2. `extract_list` cannot be repaired.**
  - `item` and field selectors are raw CSS strings with no fingerprints (`types.ts:162-167`).
  - The node has no `elementTarget` (`definitions.ts:101`).
  - The LLM target override skips it (`target-override.ts:36-42`).
- **G3. An empty list passes (reasoned).** Zero matched items gives `missingFields=[]`, so validation passes (`list-extraction.ts:97-105`; `extract-list.ts:39-40`). A sign-in wall therefore yields `succeeded` with `[]` (see `results.ts:278-285`). This is the silent no-op that decision D4 forbids.
- **G4. "Load more" pages duplicate records (reasoned).** Every loop re-reads all items (`list-extraction.ts:97-104`), and a changed item count counts as a new page (`:185`).
- **G5. No scroll-feed mode inside extraction.** No de-duplication key (`web-capabilities.md:118`).
- **G6. No byte or item cap by default (G6).** Every success attaches a snapshot, and records persist into recording state (section 2).
- **G7. `extract` modes are not authorable, and `.value` bypasses the sensitivity rule (G7)** (section 1, `extract.ts:10`).
- **G8. The field vocabulary is a string mini-grammar (G8).** No typed or optional fields, no absolute-URL link kind, no colspan. Summary fields (`pagesRead`, `truncated`) exist only as prose.
- **G9. No field or list inference, and no item-selector generation (G9)** (section 3).
- **G10. No UI entry, picker or highlight (G10).**
- **G11. `extracted` is overloaded by `dialog.ts:32` (G11).**
- **G12. The content action ignores `timeoutMs`, unlike Core's node deadline (G12).** Reasoned, section 1.

### Contracts, with owning files

- **C1. `WebAutomationExtractListRequest` v2** (`domain/src/actions/types.ts`, `schemas.ts`, `client/gateway-action-parameters.ts`; mirrored in `content/types.ts` through the domain import).
  - Field values accept a string (the existing grammar is kept) or a spec: `{ kind: "text"|"attribute"|"link"|"value"|"column", selector?, attribute?, header?, required?: boolean, element?: WebAutomationElementFingerprint }`. `link` returns the href resolved against the document base.
  - Add `itemElement?`, a fingerprint used for repair.
  - Add `minItems?`, default 1, whose violation is `OUTPUT_NOT_OBSERVED`.
  - Add a hard cap `WEB_AUTOMATION_EXTRACT_MAX_ITEMS`, mirrored in the page as `EXTRACT_MAX_PAGES` already is (`list-extraction.ts:38-45`).
  - `paginate` becomes a union: `{mode?:"next", next, maxPages}` (the current shape) | `{mode:"loadMore", control, maxPages}` | `{mode:"scroll", maxScrolls}`. The append and scroll modes de-duplicate by element identity.
  - Add `timeoutMs`, honoured by the page.
- **C2. Result summary** (`types.ts:363-379`, `gateway-mapping.ts:270-287`, `content/action-runtime/results.ts:74-79`).
  - Keep `extracted: records[]`, since Lab expectations read it.
  - Add a closed `extraction?: { recordCount, pagesRead, truncated, missingFields, fieldNames }`: names and numbers only, following the `resolution` precedent (`types.ts:332-341`).
  - Move dialog evidence off `extracted`.
- **C3. Recorded extraction event.** Files as listed in section 3.
  - Kind `data.extract`, event `web.data.extraction_defined`, input `web.user.data_extraction_defined`, output `web.dom.extract_list`.
  - The payload carries the C1 spec, item count and field names. By default it carries no sample values, because recordings reach Core's workspace and page text has no guard (`sensitive-values.md:230-239`).
  - A sibling "single field" form maps to `web.dom.extract`, with a new structured `extract: { mode, attribute? }` parameter in the schema, the node and the lift. `content/action-runtime/extract.ts` reads that instead of `options`, and refuses `.value` on sensitive controls using `shared/sensitive-field.ts`.
- **C4. Inference output** (domain type in a new `domain/src/extraction/`, re-exported through the barrel).
  - `WebAutomationExtractionProposal = { container, item, itemCount, fields: [{ name, spec, coverage }], pagination?, confidence }`.
  - Samples are kept local to the extension UI only.
- **C5. Picker messages.**
  - Content messages: `extraction.pick_start`, `extraction.pick_cancel`, `extraction.preview`.
  - Runtime messages: `fluxiq.extractionStart`, `fluxiq.extractionConfirm`, `fluxiq.extractionCancel`, `fluxiq.getExtractionSession`.

### Ordered steps

- **S1. Correctness fixes to the existing verb.**
  - Covers G3, G4, the G6 item cap, the G7 sensitive value, and G12.
  - Files: `list-extraction.ts`, `extract-list.ts`, `extract.ts`, and the domain `types.ts`, `schemas.ts` and `gateway-action-parameters.ts`.
  - Tests: `list-extraction.test.ts`, `gateway-command-parameters.test.ts`, and new `extract-list.spec.ts` cases (zero items; a load-more variant, which needs a fixture variant outside this scope).
  - Check the Lab corpus for scenarios that expect `[]` before making an empty list fail.
- **S2. Structured field specs, link and value kinds, and the C2 summary.**
  - Split `list-extraction.ts` into `content/action-runtime/extraction/` (field-spec, read-field, paginate, index), following the rule that a shared filename prefix becomes a directory.
  - Tests: `schemas.test.ts`, `definitions.test.ts`, the parameter tests, new unit tests for the field-spec parser, and harness cases on product-catalog and data-table.
- **S3. Pagination modes (C1).**
  - Reuse the scroll capability behind `content/actions/scroll.ts`.
  - Harness test on the `infinite-feed` fixture (`domain/src/page-evidence/capture.ts:54`).
- **S4. Repair hooks.**
  - Fingerprints in the request, and resolving `item` or a field by fingerprint when its selector matches nothing, using `content/action-runtime/resolve-target.ts` candidates.
  - Include `extract_list` in `target-override.ts`.
  - The list-target contract is Core's; coordinate with the Core brief.
  - Tests: the adapter and gateway tests, and a harness variant where selectors have drifted.
- **S5. Inference.** New `content/extraction/`:
  - `infer-list.ts` walks up from the picked element to a repeating ancestor. Extract `itemSignature` and `identifierShape` from `repeating.ts` into a shared module rather than copying them.
  - `item-selector.ts` generalises an item selector and verifies that `querySelectorAll` count equals the run size.
  - `infer-fields.ts` finds text leaves, links, images, test ids and table headers.
  - `detect-pagination.ts` looks for `rel=next`, next or load-more text, and a numbered-page run.
  - The unit runner has no DOM (`list-extraction.test.ts:3-6`), so keep the pure logic unit-tested and cover DOM behaviour in a new `extraction-inference.spec.ts` on product-catalog, data-table and infinite-feed.
- **S6. Picker, highlight and UI (C5).**
  - `content/picker/*`, `message-handler.ts`, `content/index.ts` wiring, both HTML files, `popup/index.ts`, `shared/constants.ts`, and `background/extraction/*` routed from `background/index.ts`.
  - Tests: a harness spec driving the pick messages; manual Chrome side panel and Firefox popup validation.
- **S7. Recordable event and mapping (C3).**
  - Tests: `input-model.test.ts` rows, `payloads.test.ts:52` (drop `extract_list` from the dispatch-only list), `web-panel-host.test.ts`, `gateway-payloads.test.ts` and `recorded-event.test.ts` rows, and `recorder.test.ts` executable kinds.
  - Lab: a scenario that records a picker-defined extraction, then replays it and checks the extracted records.
  - `packages/test-contracts/src/recordable-actions.ts:22-26,55` must change too, outside this brief's scope.
- **S8. Docs.** `web-capabilities.md:114-118`, `sensitive-values.md:230-239`, and the extension client doc.

## What changed and why

Created this report only. No source edits.

## Commands run and observed results

None. The brief forbids builds, tests and Lab commands. Only file reads and searches.

## Not verified

- Every "(reasoned)" item: G3 empty-list pass, G4 duplicates, G12 timeout mismatch, the `extract` sensitive `.value` leak, the picker and recorder interaction, and Firefox popup lifetime.
- Failure categories behind `classifyWebAutomationFailure` (not read).
- How Core exposes `payload.extracted` to later Flow nodes.
- The 15 matches for `highlight|overlay|picker` were not all opened.
- `packages/test-runner` extraction code was not read.

## Open questions or contradictions found

1. `extract.ts:10` returns a sensitive control's live value, while `sensitive-values.md:54` says no descriptor carries it and `:230-233` treats extract output as page text. Refuse, or withhold?
2. Should recorded extraction events carry sample values? Recommendation: no, keep them local to the extension UI, but Core's preview design decides.
3. A failing empty list (G3) may break Lab scenarios or corpora that expect `[]`.
4. Repairing a list target needs a Core-side contract for collection targets. Today `elementTarget` means exactly one element (`definitions.ts:92-101`).
