# x4a-domain-recorded-extraction: X4.1, the domain's recorded extraction

## Outcome

**Done**, with one pre-existing failure that is not mine and that I deliberately
did not "fix" (see Open questions 1).

- **Check:** `pnpm --filter @fluxiq-web-extension/domain check` exits 0, no
  diagnostics from either `tsc`.
- **Tests:** 472 of 472 pass, 0 fail. All four module-scope script pass lines
  printed. The three Core-backed extraction rows pass, including the
  cross-repository one where Core's own proposal lift parses the `recordOutput`
  this brief builds.
- **One entry fails to load:** `src/tests/domain.test.ts`, on
  `assert.equal(new AutomationStudioNodeRegistry().list(...).length, 39)`
  receiving 41. **This is Core's rebuild, not this work.** Proof below.
- **Audit:** 2 violations, both `[working-docs]`, neither in a file this brief
  owns.

## What changed and why

### The recorded definition (D3), the privacy-critical piece

New `domain/src/actions/extraction/recorded-definition.ts`. The picker runs in
the page, so what it hands the recorder is page-adjacent and cannot be trusted
to hold only what it declares. `webAutomationRecordedExtraction(value)` rebuilds
the definition **field by field**; an unknown key is never copied rather than
refused, so a producer's extra key cannot break recording and cannot leak.

Two forms: `{ form: "list", datasetId, label, request, fieldLabels, itemCount }`
and `{ form: "value", label, read }`. Every field key is checked with
`isWebAutomationExtractFieldKey`, the dataset id against Core's
`datasetIdPattern` (plus `.` and `..`, which Core also refuses), and every label
against Core's 200-character bound. A label for a field the request does not read
is dropped; a label that is sent but malformed refuses the whole definition.

### The readers moved out of `client/`

New `domain/src/actions/extraction/read-request.ts` holds
`webAutomationExtractListRequestValue`, `fieldMapValue`, `fieldValue`,
`paginationValue` and their helpers, moved verbatim from
`client/gateway-action-parameters.ts`. `io/input-model.ts` needs the reader and
`client/gateway-mapping.ts` already imports `io/input-model`, so importing
`client` from `io` would have been a cycle.

It also holds the new `webAutomationExtractReadValue` for C3's structured read,
so the parameter lift and the recorded definition share one rule.

**One import detail worth keeping:** it takes `elementFingerprint` from
`output-nodes/targets` rather than the `output-nodes` barrel. The barrel reaches
`output-nodes/definitions` -> `actions/schemas` -> this directory's barrel, a
real runtime cycle. `targets.ts` imports nothing from `actions/` but types.

### The rest

- **`constants.ts`:** `dataExtractionDefined: "web.data.extraction_defined"`.
- **`recording/events.ts`:** the `extraction` payload field and the event row.
- **`actions/extraction/request.ts`:** `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS`
  (10,000), `webAutomationExtractListTimeoutMs` (the per-page wait times
  `maxPages`, or `maxScrolls` for `scroll`, or 1 unpaginated), and the C3 read
  vocabulary `WEB_AUTOMATION_EXTRACT_READ_MODES` / `WebAutomationExtractRead`.
- **`io/input-model.ts`:** both input ids, `extraction` on the recorded payload,
  the `data.extract` wire kind, the two `actionInputDefinitions` rows, the case
  that picks the input by `form`, and `isExecutableRequiredParameter` treating
  `extractList` as executable exactly when the reader reads it.
- **`output-nodes/payloads.ts`:** `extract_list` builds `{ extractList }` from
  the rebuilt definition; `extract` gains `extract: definition.read`;
  `extract_list` left the dispatch-only comment.
- **`output-nodes/definitions.ts`:** `structured("extract", "Read")` on
  `web.dom.extract`. **`extract_list`'s `timeoutMs` parameter was already there**
  with a passing test, landed by an earlier brief; I added nothing for it.
- **`actions/{schemas,types}.ts`:** the `extract` read schema (with `selector`
  still required, so element targeting is unchanged) and the command field.
- **`client/gateway-action-parameters.ts`:** lifts `extract`, calls the moved
  reader.
- **`client/gateway-mapping.ts`:** `extraction` on the recorded payload, copied
  through the reader, named rather than spread.
- **New `recording/proposals/record-output.ts`:** `webAutomationRecordOutput`.
  The schema covers **every** request field, excluded ones included (D12): the
  exclusion has to persist or the next detection proposes the column again. No
  `recordsPath` — Core takes it from the output's `metadata.recordsPath`.
- **`web-panel-host.ts`:** the two labels and `extractionCandidate`, which
  carries action-role `sourceInputIds`, **no** `expectedConfirmation`, and
  `recordOutput` + scaled `timeoutMs` for the list form only.

### One judgement call: duplicate labels

Core refuses a schema whose field labels collide, and a page can easily carry the
same header twice. `distinctLabel` disambiguates with the field key
(`"Price"`, then `"Price (price_gross)"`) rather than letting the collision
reject the whole candidate at approval. Pinned by a test that runs the result
through Core's own parser.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, one at a time, never concurrently.

1. `pnpm --filter @fluxiq-web-extension/domain check` — **exit 0**, no output
   from either `tsc`.
2. `DOMAIN_TEST_BUILD_LABEL=x4a pnpm --filter @fluxiq-web-extension/domain test`,
   first run — exit 1: `# tests 472`, `# pass 471`, `# fail 1`.
   - `not ok 7 - a field key a page could have produced is refused, whole`.
   - **My test was wrong, not the code.** The sentinel I planted,
     `SENTINEL-PAGE-VALUE-A-RECORDING-MUST-NOT-CARRY`, is made only of `A-Z` and
     `-`, which *is* a well-formed field key under `^[A-Za-z0-9_-]{1,100}$`. The
     reader was right to accept it. I removed it from the refused list, added
     `prototype` and `prix€`, and added a positive row that a valid key shape is
     accepted, with a comment stating what the key rule does and does not do:
     it refuses keys that could not be column ids, and it is not a test of
     whether a key came from the page. What keeps page *values* out is the
     field-by-field copy, which the other rows cover.
3. The same labelled test, after the fix — `# tests 472`, `# pass 472`,
   `# fail 0`, `# cancelled 0`. All four script pass lines printed, 0 entries
   reported "failed to load" by my grep of that phrase **except** the one below.
   - Exit is still 1 because of entry 4.
4. `src/tests/domain.test.ts` **fails to load**:
   `AssertionError: Expected values to be strictly equal: 41 !== 39` at
   `domain.test.ts:173`,
   `assert.equal(new AutomationStudioNodeRegistry().list(bootstrapResolution).length, 39)`.
5. `node scripts/structure-audit.mjs` — exit 1,
   `structure-audit: 2 violation(s) across 1 rule(s)`:
   - `FAIL [working-docs] docs/working/first-class-data-extraction-plan.md: 1103 lines exceeds the 800-line compaction threshold`;
   - `FAIL [working-docs] docs/working/README.md is out of date`.
   Neither is a file this brief owns; x1 and x3a reported the README one too.
   My files appear only as advisories (`domain/src/actions/types.ts` 468 lines,
   `client/gateway-mapping.ts` 517, `client/tests/gateway-mapping.test.ts` 721),
   all under the 800 limit. No finding line names `actions/extraction/`,
   `recording/proposals/` or `web-panel-host.ts`.

### Proof that the `41 !== 39` failure is Core's, not this brief's

I did not want to assert this, so I measured it.

- The assertion counts a registry constructed with **no domain nodes at all**.
  `canonical-registry.ts` seeds it from Core's `builtinAutomationNodeDefinitions`.
- I reproduced the exact count in a process that imports **only** `fluxiq` and no
  domain code: `COUNT_WITH_TEST_RESOLUTION=41`, against the test's 39, using the
  identical resolution (`scope: { kind: "domain", domainId: "web-automation" }`,
  `["web.actions"]`, `["web-automation.action"]`).
- The 41 ids include `builtin.data.write-records`, Core's record-output node from
  this same campaign.
- `git status --short -- domain/src/tests/domain.test.ts` is **empty**: I never
  touched the file.
- x1 (413 tests) and x3a (440 tests) both reported "no entry failed to load"
  earlier today. The brief states `fluxiq` was rebuilt for K7 between then and
  now, which is when Core's built-in count moved.

## Not verified

- **`domain/src/tests/domain.test.ts` still fails to load.** I left it failing
  deliberately; see Open questions 1. Everything that entry asserts after line
  173 is therefore unverified in this run, including its own Core-proposal rows.
- **The extension was not type-checked, built or tested.** The brief excludes
  `apps/extension/**`. `content/action-runtime/extract.ts` still reads its mode
  from `options`, not from the new `action.extract`; that is X4.2's.
- **No browser validation.** Nothing here was exercised against a real page; the
  picker that produces these definitions (X4.2) does not exist yet.
- **Whole-repository `pnpm check`, `pnpm test`, `pnpm build` were not run**, nor
  the domain `build`. Tracked `domain/.test-build/` was not written: every run
  used the `x4a` label.
- **Core's K7 acceptance command was not run.** The brief lists it third; it is a
  Core-side command and `k7b-recorded-node-ports` was editing Core concurrently,
  so running it would have measured their tree, not a stable one. My
  cross-repository coverage is instead the row in `tests/web-panel-host.test.ts`
  that drives a real `AutomationStudioService` and proves Core lifts and parses
  the `recordOutput` and `timeoutMs` this brief produces.
- **The report's mutation targets were not run as a separate exercise.** Four of
  the five are covered by rows that exist and pass, but I did not apply the
  mutations and observe them red, so I cannot claim the rows are mutation-proven.
  The one real red I observed was the unplanned one in run 2.
- **`handling: "encrypt"` reaching a record output.** The gateway refuses encrypt
  at dispatch, so the picker should never record one; if it did, Core's parser
  would reject the candidate. Not exercised.

## Open questions or contradictions found

1. **`tests/domain.test.ts` hard-codes Core's built-in node count, and Core's
   rebuild broke it (not mine to fix quietly).** Lines 173-174 assert 39 and 57
   (57 = 39 + this domain's 18). Core now ships 41, so both are stale and the
   whole entry fails to load. I did **not** renumber them to 41/59, for three
   reasons: the file is not one this brief set out to change; the byte-budget and
   `missingRequiredTerms` assertions below them are computed over the catalog and
   may shift with two more nodes, so a blind renumber could paper over a real
   change; and K6/K12 may still be adding Core nodes, so the number could move
   again this week. **Recommendation:** have whoever owns the Core pairing update
   both counts once Core's node set settles, and consider deriving them from
   `builtinAutomationNodeDefinitions.length` rather than restating them, so the
   next Core node does not fail a downstream repository.
2. **My own test row was wrong about what the key rule proves** (run 2 above).
   Worth stating because the corrected comment now records the real boundary: the
   D16 key rule refuses keys that could not be Core column ids; it is not, and
   cannot be, evidence that a key did not come from the page. Keys are structure
   because the picker derives them with `webAutomationExtractionFieldKey`.
3. **`fieldLabels` carries page text by design.** A column header is page
   structure under D16, not a sample value, so labels survive into the recording
   and into Core's dataset schema. This is the one place a recorded extraction
   carries page-derived strings, and it is deliberate. `sensitive-values.md`
   should say so explicitly (D16 already anticipates this).
4. **A label that is sent but malformed refuses the whole definition**, rather
   than falling back to the key. That is stricter than the report specifies; I
   chose it to match the house rule that a property sent but unreadable refuses
   rather than being dropped. One-line change if the supervisor prefers a
   fallback.
5. **Duplicate labels are disambiguated here** rather than being allowed to
   reject the candidate at Core (see the judgement call above). The report did
   not cover the case.
6. **The value form's executability rests on `selector`.** `web.dom.extract`
   requires `selector`, so a recorded value extraction with no element stays
   evidence. That is correct but implicit: nothing checks that a value definition
   *has* a read before the node is built, because `payloads.ts` only writes
   `extract` for the value form. Pinned by a test either way.
7. **Line endings.** `git diff` warns "LF will be replaced by CRLF" for the
   tracked files I edited, as x1 and x3a reported. Content unaffected.
