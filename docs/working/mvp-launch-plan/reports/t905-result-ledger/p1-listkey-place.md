# t905 phase 1a: listKey and place

## Outcome
Partial. listKey, place, the live-read stamp and the Core readers are built and tested. Three
things the goal names could not be done inside the owned paths and need a one-line change each
in files I do not own (see Open questions): the saved read's answer is built by the page and
passes `runtime/adapter.ts`, the record batch type and capture are in Core `capture.ts` /
`contracts.ts`, and nothing in the page produces `place` yet.

## What changed and why
E = domain/src.
- `output-nodes/extract-list/list-key.ts` (new): `webAutomationExtractListKey({item, container?, frameId?, frameUrlPath?})`, an
  opaque `list.<28 hex>` digest (two seeded cyrb53 hashes, no platform call because dispatch.ts is
  bundled in the extension). Frame is named by its path when known (a reload renumbers ids), else by id.
  The page address is not in the key (the key is site structure only).
- `runtime/llm-evidence/structure/handles.ts`: exports `webLlmExtractionListKey(binding)`; `resolve` now returns
  `WebLlmExtractionBindingKeyed` (binding plus `listKey`, plus optional `container`); `retain` takes
  `WebLlmExtractionBindingRetained`. I could not add the fields to `WebLlmExtractionBinding` itself: three
  unowned files (`packet.ts`, `saved-list.ts`, `element-record.ts`) build it with `present<WebLlmExtractionBinding>`,
  which demands every optional key, so they would stop compiling. Container is therefore optional beside the
  binding; nothing sets it yet (detect.ts/packet.ts own that, `proposal.container` is available there).
- `actions/extraction/list-continues.ts`: `WebAutomationExtractionPlace` ({kind: page|offset|cursor, value}),
  `webAutomationExtractionPlaceValue` (strict: page>=1, offset>=0, cursor token charset, no page text),
  `webAutomationExtractionPlaceText` (`page=3`, `offset=40`, `cursor=abc`, the same words Core's address-split uses).
- `actions/extraction/summary.ts`: summary gains optional `place`, copied through the boundary; a malformed place is
  dropped alone, never the summary.
- `output-nodes/extract-list/answered.ts` (new, exported from the barrel): `webAutomationExtractListAnswered(parameters, answer)`
  stamps `listKey` (from the read's item and `browserFrameId`/`browserFrameUrlPath`) and `place` (from the answer's own
  summary) beside `extracted`, same level as `location`. Absent place stays absent.
- `runtime/llm-evidence/node-run/list-read/answer-keys.ts` (new) `webListReadAnswerKeys`, wired in `node-run/run.ts`
  where `read` is made: the model's live `extraction.N` read carries both. One stamp function serves live and saved reads,
  so a detection's key, a live read's and a saved read's agree (tested).
- Core `engine/automation/records/read/`: `list-key.ts` (`automationStudioRecordReadListKey`), `place.ts`
  (`automationStudioRecordReadPlace`, whole `name=value[&...]` token strings only), both over `holders.ts` nearer-first like
  `location.ts`; exported from `index.ts`; the index comment updated.

## Commands run and observed results
- `DOMAIN_TEST_BUILD_LABEL=t905-w1 node scripts/test-domain.mjs structure/tests/handles extract-list/tests/answered summary-place node-run/tests/run.test target-binding` -> `# pass 41 # fail 0`
  (includes new handles.test.ts 5 tests, answered.test.ts 6, summary-place.test.ts 3, run.test.ts live-read test).
- Revert check: replaced the run.ts stamp with `shownRead` -> `not ok 24 - a live list read carries its listKey...`, `# fail 1`; restored.
- `npx vitest run packages/fluxiq/src/engine/automation/records/read` (from t905/!FluxIQ) -> 3 files, 10 tests passed (4 new in `list-key-and-place.test.ts`).
- Core `pnpm check` via heavy-slot (packages/fluxiq) -> exit clean, `fluxiq:check` built in 172 s.
- Core libs rebuilt (the domain check refuses a stale Core) -> all five built.
- Domain `pnpm check` via heavy-slot -> only two errors, both in `page-view/tests/read-vocabulary.test.ts` lines 68 and 79
  (`row` missing; `"menu"` not a `WebAutomationLayerKind`): another worker's file, not mine. No errors in any file I touched.
- `node scripts/structure-audit.mjs` in E -> `passed (249 warning(s), 552 baselined)`; in Core -> `passed (535 warning(s), 969 baselined)`.
  (First run caught a deep import in my test and a property spread in handles.ts; both fixed.)

## Not verified
- Domain `pnpm check` is not green overall because of the other worker's read-vocabulary.test.ts; my files compile.
- No run with a real page: the place and the stamp are exercised through unit and runtime-with-fake-gateway tests only.
- The saved-read stamp is not reached in a real Flow run (see below).

## Open questions or contradictions found
1. **Saved read answer (needs adapter.ts).** The saved read's answer is the extension's command result, passed through
   `domain/src/runtime/adapter.ts` (`runtimeResult.payload = ...`, ~line 154). Nothing in `output-nodes/extract-list/dispatch.ts`
   can put a key in it. Wiring: for `outputId === "web.dom.extract_list"`, set `payload.result =
   webAutomationExtractListAnswered(command.parameters, payload.result)` (import from `../output-nodes`). Until then Core
   sees `listKey`/`place` only on live reads.
2. **Record batch (needs Core capture.ts and contracts.ts).** Core now has the readers, but `AutomationStudioRecordBatch` has no
   `listKey`/`place` and `capture.ts` line 78 does not call them. Add both optional fields and pass
   `automationStudioRecordReadListKey(outputs.result, segments)` and `automationStudioRecordReadPlace(...)` to `recordBatch` as it
   does for `location`.
3. **Nothing produces `place` yet.** The pager's current page number is read in the page
   (`content/extraction/page-advance/shown-page.ts` `pageShownNow`, `pager-reading.ts`), and a load-more control's offset or cursor
   is not read anywhere. The page must send `extraction.place` as `{kind, value}` (the content script and `shared`/summary
   typing are outside my paths). The domain admits and stamps it as soon as it is sent. No place is ever derived from rows or the address.
4. **Container is not set.** `detect.ts` knows `proposal.container`; passing it to `retain` as `container` makes it part of the key
   (the saved read has none, so the saved read's key would then differ from a container-keyed detection; decide: either drop container
   from the key, or have the content script/dispatch carry it). Today keys agree because no container is set anywhere.
5. `structure/index.ts` (barrel, not owned) should export `webLlmExtractionListKey`, `WebLlmExtractionBindingKeyed` and
   `WebLlmExtractionBindingRetained`.

Outcome: Partial
Changed: see list above; E=C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQWebExtension/domain/src, C=C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQ/packages/fluxiq/src
Validation: tests 41 pass, Core records/read vitest 10 pass, both pnpm checks run (domain only fails in another worker's read-vocabulary.test.ts), both structure audits pass
Not verified: real-page behaviour, saved-read stamping in a Flow run
Report: C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/t905-result-ledger/p1-listkey-place.md
