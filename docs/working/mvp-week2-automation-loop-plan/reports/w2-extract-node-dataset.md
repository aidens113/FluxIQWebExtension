# w2-extract-node-dataset: a model-created list extraction saves a dataset

Worker report, 2026-09-16. Brief: `w2-extract-node-dataset`. This covers items 1,
2 (the domain half) and 3 (this repository's half) of "What is missing, in
order" in [w2-creation-extraction-gap](./w2-creation-extraction-gap.md).
`AS/` is Core's `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Partial.** All three tasks are built and tested. The domain suite passes
except for three tests owned by the concurrent `llm-evidence` worker. Two
things are not complete:

- **The validator is not bound to Core yet.** The contract is exported in
  Core's signature, but it cannot be bound. Core's hook exists only in Core's
  uncommitted source, is not in the `dist` this package compiles against, and
  offers an importer no way to hand Core a contract. The one-line wiring is
  given below.
- **`pnpm check` exits 2.** The only failure is a type error in another
  worker's untracked file,
  `packages/test-runner/src/flow-lane/creation/tests/request.test.ts:47`.
  Every step before it passed, including `domain check`.

What a model-built Flow now gets:

- A `web.output.dom-extract_list` node whose author wrote only `extractList`
  dispatches with a `recordOutput`. That record output's schema is exactly the
  request's field map, so Core saves the rows as a run dataset. The dataset is
  named, for example, `extracted-list-name-link:<16 hex>`.
- The node declares a `records` port, so a later node can be wired to the rows.
- The node carries scraping tags, a short description, and the `extractList`
  grammar with a worked example.
- A paginated read left at the default timeout is given 10 s per page.

## What changed and why

### Task 1: the node saves a dataset

- **New directory `domain/src/output-nodes/extract-list/`** (the audit's prefix
  rule makes shared-prefix files a directory):
  - `dispatch.ts`, `webAutomationExtractListDispatch(parameters)`:
    - Takes `recordOutput` out of the page parameters and puts it on the
      dispatch payload, as `builtin.policy.action` does.
    - An authored record output is sent as written. If it has no
      `recordsPath`, the node fills in `result.extracted` (CD19).
    - If absent or `null`, it derives one from the parsed request.
    - Either one is parsed with `parseAutomationStudioRecordOutput` first. If it
      does not parse, the node **fails before the page is read**, with Core's
      own codes (`record_output.invalid` or
      `record_output.encrypt_unavailable`), category
      `graph_validation_or_unknown_node`, stage `dispatch`. This mirrors
      `AS/nodes/policy/action.ts`.
    - A request that does not parse derives nothing and scales nothing, and is
      sent as authored, so the dispatch refuses it as before.
  - `derived-record-output.ts`, `webAutomationDerivedRecordOutput(request)`:
    - Builds the record output with the existing builder, plus
      `recordsPath: "result.extracted"`.
    - **Dataset id.** The native context carries no node, Flow or run id
      (`AS/runtime/native-node-runtime.ts`), so the id is a pure function of the
      extraction: `webAutomationDatasetId(label, digest)`.
      - The digest is two FNV-1a passes over the item selector plus each field's
        key, kind, selector, attribute, header, `required` and `handling`, in
        order. Element fingerprints are left out: they carry page text, and they
        say where a field was picked, not what the column holds.
      - Core keys datasets by run and id (`storage/project/run-dataset-store.ts`),
        so each run gets its own rows under a stable id.
      - Two nodes that read the same shape append to one dataset. Different
        shapes never share an id.
    - **Label.** The label is `Extracted list: <kept keys>`, cut to 200
      characters. Excluded keys are left out, because Core keeps excluded field
      ids out of stored datasets.
  - `records-path.ts`: `WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH`, moved out of
    `definitions.ts` together with its explanation of why the path has two
    segments.
  - `record-output.ts`: `webAutomationRecordOutput` itself, **moved here from
    `recording/proposals/record-output.ts`**. Its parameter is widened to
    `Pick<…, "datasetId" | "label" | "request" | "fieldLabels">`, which existing
    callers still satisfy. The reason for the move is below.
  - `parameters.ts`: the node's own parameters:
    - `extractList`, with a description and an example;
    - `timeoutMs`, default `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS`;
    - `recordOutput`, declared as `AS/nodes/policy/action.ts:41-50` declares it:
      `json`, `defaultValue: null`, `allowStateBinding: false`,
      `ui.control: "record-output"`.
- **Why the builder moved.** `recording/proposals/index.ts` imports
  `late-target-wait.ts`, which imports `io/input-model.ts`, which imports the
  `output-nodes` barrel. A value import of the builder from `output-nodes`
  would therefore create a module cycle. It would be harmless at run time today,
  since every use is inside a function, but it would invert the existing
  layering, and `actions/extraction/read-request.ts` documents avoiding exactly
  this.
  - `recording/proposals/record-output.ts` is now a two-line re-export, so
    `web-panel-host.ts` and `recording/proposals/tests/record-output.test.ts`
    are unchanged and still pass.
  - This is more than the "only if it needs an export" edit the brief allowed
    for that file. It is the smallest change that avoids the cycle without
    touching files I do not own.
- **`output-nodes/definitions.ts`:**
  - A `records` port (`array`, role `data`, as in
    `AS/runtime/service/recordings/candidate-definitions.ts:31-35`) is declared
    on exactly the outputs that declare a `recordsPath`, which today means only
    `extract_list`.
  - `allowStateBinding: true` became `parameter.allowStateBinding ?? true`, a
    deliberate change: `recordOutput` is the only parameter that says `false`.
  - The `extract_list` parameters now come from `webAutomationExtractListParameters()`.
  - The description and tags now come from a per-output catalog-text map.
- **`output-nodes/native-runtime.ts`:** `extract_list` goes through
  `webAutomationExtractListDispatch`. Every other output's effect is
  byte-for-byte unchanged.
- **Tests changed on purpose:**
  - `domain/src/tests/domain.test.ts` replaces "every web parameter is
    state-bindable" with an exact list of exceptions:
    `["web.output.dom-extract_list:recordOutput:false"]`.
  - `output-nodes/tests/definitions.test.ts:43` excludes `recordOutput` from
    the same rule.
  - The comments in both say why: a binding could swap the dataset schema, and
    with it the excluded fields, at run time.

### Task 2: the validator

- **`extract-list/issues.ts`, `webAutomationExtractListIssues(value)`**
  returns the distinct codes from `web.extract_list.{not_object, unknown_key,
  invalid_item, invalid_item_element, invalid_fields, no_fields,
  invalid_field_key, invalid_field, unknown_field_key, all_fields_excluded,
  invalid_paginate, unknown_paginate_key, invalid_max_items, invalid_min_items,
  min_items_exceed_max, unreadable}`.
  - **It reuses the dispatch reader instead of copying its rules.** Each part
    is judged by handing `webAutomationExtractListRequestValue` a request that
    is valid except for that part.
  - `unreadable` is a safety net: if the reader refuses a value and no part
    explains it, the validator still returns a code, so it never passes
    something the reader refuses. The tests check this on every case.
  - The allowed keys are read from `webAutomationExtractListSchema`, so they
    cannot drift from the schema.
  - **It is stricter than the reader in two ways, on purpose:**
    - it refuses a key the schema does not declare, so a mistyped
      `pagination` cannot silently read a single page;
    - it refuses a `maxItems` that is not a positive integer.

    The reader silently drops both (see Open questions).
  - The codes are prefixed `web.` because Core's in-progress contract tests
    accept domain-prefixed codes (`demo.items.missing_item`). The prefix also
    matches this domain's failure-code vocabulary.
- **`extract-list/parameter-contract.ts`,
  `webAutomationExtractListParameterContract({definitionId, parameterId, value})`,**
  has the same signature as Core's in-progress
  `AutomationStudioNodeParameterContract`. It checks `extractList` only; Core
  parses `recordOutput` itself.
- **`output-nodes/parameter-contracts.ts`,
  `webAutomationOutputNodeParameterContracts`,** maps node ids to contracts.
  Only `web.output.dom-extract_list` has one.
- **Why the contract is not wired into Core.** Core's hook exists in its
  uncommitted source (`AS/nodes/definitions.ts`, `AS/nodes/canonical-registry.ts`)
  as `AutomationStudioNodeRegistry.bindParameterContract(nodeId, contract)`,
  but:
  - it is not in Core's `dist`, which this package compiles against;
  - `AutomationStudioImporterImplementationBundle` and the service's registry
    construction (`AS/runtime/service.ts` around 1863) have no way for an
    importer to hand a contract to Core's registry.
- **The wiring, once Core exposes such a channel:**
  - If Core adds a bundle key, for example
    `AutomationStudioImporterImplementationBundle.parameterContracts?: Record<string, AutomationStudioNodeParameterContract>`
    that the service binds, this is the exact line to add in
    `createWebAutomationOutputNodeImplementationBundle`
    (`domain/src/output-nodes/native-runtime.ts`), after `implementations: …,`:

    ```ts
    parameterContracts: webAutomationOutputNodeParameterContracts,
    ```
  - For any holder of a registry (for example the domain smoke test's
    `new AutomationStudioNodeRegistry(...)`), after Core is rebuilt:

    ```ts
    for (const [id, contract] of Object.entries(webAutomationOutputNodeParameterContracts)) registry.bindParameterContract(id, contract);
    ```

### Task 3: describing the node to the model

- **`extract-list/catalog-text.ts`.** The texts are sized to Core's
  in-progress catalog: a node description is kept to 240 characters, and a
  parameter's description (600 characters) and example are now sent for
  object and json parameters (Core's untracked `plan/tests/catalog.test.ts`).
  - **Tags:** `scrape, collect, extract, list, table, rows, records, dataset,
    every page, next page, load more, infinite scroll, pagination`, added after
    `web-automation, output`.
  - **Node description** (119 characters; its first sentence is 76, within the
    old 80 cut): "Scrape every item of a repeating list or table into a
    dataset, across pages. The rows are saved without a recordOutput."
  - **`extractList` description.** A grammar of 575 characters (the limit is
    600) covering:
    - `item`;
    - the field forms `"css"`, `"css@attr"`, `"column:Header"`, and the spec
      with `kind: text|attribute|link|value|column`;
    - the key rule;
    - the four `paginate` shapes, at most 50 pages;
    - the `minItems` default of 1 (0 allows an empty list) and `maxItems` of
      at most 1000.

    The lists and bounds are taken from the request's constants.
  - **`extractList` example:** a paginated product list. The tests check that
    it parses and has no issues.
- **Timeout.** It scales in `dispatch.ts` via
  `webAutomationExtractListTimeoutMs` (`request.ts:177-181`) when the author
  "left the default", meaning `timeoutMs` is absent or equal to 10,000.
  - "Absent" matters because Core passes the raw `node.parameterValues` to the
    native implementation, with no defaults filled in.
  - "Equal to 10,000" covers an editor that pre-fills the default.
  - Core's runtime path sends a command timeout only from the payload's
    top-level `timeoutMs` (`AS/runtime/io-policy.ts:94`). An importer payload
    has none, so `client/gateway-mapping.ts:190` falls back to
    `parameters.timeoutMs`, which is where the node already put it.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` in `domain`: exit 0.
- `npx tsc -p tsconfig.test.json` in `domain`: exit 0.
- `DOMAIN_TEST_BUILD_LABEL=w2-extract-node-dataset node scripts/test-domain.mjs`:
  - first run: `# tests 549 # pass 549 # fail 0`, and "Web automation domain
    smoke test passed.";
  - second run, after adding the contract: `# tests 552 # pass 550 # fail 2`.
    Both failures are in `runtime/llm-evidence/tests/vocabulary.test.ts`: they
    expect a `web.detect_repeating_structure` tool and a
    `web.structure.detected` code that the other worker had not yet wired in.
- `pnpm --filter @fluxiq-web-extension/domain test` (unlabelled; this
  regenerates the tracked `domain/.test-build`): exit 1,
  `# tests 552 # pass 549 # fail 3`, and the smoke test passed. All three
  failures are in the other worker's `runtime/llm-evidence/tests/`:
  - `tools.test.ts` "binds from the production host seam…" now finds the
    fourth tool that the worker had added in the meantime;
  - the two `vocabulary.test.ts` tests above.

  Count: 527 tests before, plus 25 of mine (7 native-runtime, 4 definitions,
  3 parameter-contracts, 5 issues, 6 derived-record-output), makes 552. Every
  one of mine passes.
- `.test-build` is regenerated: 38 entries changed, including new
  `output-nodes/extract-list/tests/*.mjs` and
  `output-nodes/tests/parameter-contracts.test.mjs`. It also contains the
  other worker's in-progress `llm-evidence` bundles.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (57 warning(s),
  17 baselined)`.
  - The audit lists files with `git ls-files`, so new untracked files are not
    checked. I re-ran it against a **private copy** of the index
    (`GIT_INDEX_FILE` in the scratchpad) with my new files added
    `--intent-to-add`: `passed (58 warning(s), 17 baselined)`, with no finding
    or warning on any path of mine.
  - The real index was not touched; `git status` still shows the files as
    `??`.
- `pnpm check`: exit 2.
  - Passed: `structure:test` (`# pass 96 # fail 0`), `lab:test`
    (`# pass 24 # fail 0`), the structure audit, and `domain check: Done`.
  - Failed: `packages/test-runner check`, with
    `src/flow-lane/creation/tests/request.test.ts(47,38): error TS2379 …
    playbackGoal: undefined`. That file is in the untracked
    `packages/test-runner/src/flow-lane/creation/`, another worker's.
- Read-only in Core: `git status` and `git diff` of `AS/nodes/*`, plus reading
  the in-progress `plan/tests/validation.test.ts` and `catalog.test.ts`.

## Not verified

- **No live run.** No provider call, demo workspace or Lab run was made, as
  the brief required. Nothing proves that a real bootstrapped Flow now saves a
  dataset end to end. This is covered only by unit tests of the dispatch
  effect and by reading `AS/runtime/executor/record-capture.ts`.
- **The contract has never run inside Core's validation.** Its code format was
  checked against Core's doc comment (lower-case, dot-separated, at most 120
  characters, no `bootstrap.` prefix) with my own regular expression, not with
  Core's check, which was not written yet.
- **The new catalog texts have not been seen through Core's new catalog.**
  Their size was checked against the 240 and 600 limits in Core's in-progress
  tests. With the current `dist` (80-character cut, no parameter descriptions),
  the model still sees only the first sentence.
- **`domain/dist` and the web panel host bundle
  (`domain/dist/host/web-panel-host.mjs`) were not rebuilt.** A live run still
  loads the old node until someone runs
  `pnpm --filter @fluxiq-web-extension/domain build` and `host:build`.
- **The web panel's `record-output` editor** was not checked against a web
  node, since it was built for `builtin.policy.action`.
- **Whether the domain smoke test's bootstrap-catalog selection holds under
  Core's new catalog.** It passes today, but the `extract_list` entry is now
  larger.
- `pnpm test` and `pnpm build` at the repository root were not run.
- The `.test-build` regeneration includes the other worker's in-progress
  bundles. It should be regenerated again once that worker finishes.

## Open questions or contradictions found

- **Core's bootstrap validation and this node disagree about `recordsPath`.**
  Core's in-progress validation parses every `record-output` parameter with
  `parseAutomationStudioRecordOutput`, and its test fixture includes
  `recordsPath`. So a model-authored `recordOutput` that omits `recordsPath`
  would be refused at plan validation, even though this node's dispatch fills
  it in. Two ways to resolve it:
  - Core defaults it from the definition's `metadata.recordsPath` before
    parsing, as CD19 does for proposals. This is my recommendation.
  - The grammar tells the model to write it.

  The node description steers the model away from authoring one at all.
- **The dispatch reader silently drops what it cannot read, against its own
  stated rule.** `webAutomationExtractListRequestValue`
  (`actions/extraction/read-request.ts`, not mine) ignores undeclared keys and
  drops an unreadable `maxItems`. That contradicts the file header's "nothing
  is dropped quietly". The validator refuses both, but a hand-edited Flow
  still runs with them dropped. The fix belongs in `read-request.ts`.
- **An extraction node now always saves a dataset whenever its request
  parses.** There is no opt-out, because `null` means "derive". This only
  affects `web.output.dom-extract_list` nodes. Recorded extractions go through
  `builtin.policy.action` and are unchanged. The only in-repository dispatch
  test that used this node passed no `extractList` and is unchanged.
  - A side effect: the gap report's open point about unwithheld rows in the
    saved trace no longer applies to these nodes. Every parseable one now
    carries `recordOutput`, which makes Core withhold the saved result payload
    (`AS/runtime/io-policy.ts`, `withheldResultPayload`).
- **Nested state bindings inside `extractList` are refused by the contract.**
  For example `item: { $state: … }`. Core's doc comment leaves this to the
  domain, and the dispatch reader would refuse such a value unresolved.
- **Documentation.** `docs/architecture/` may need a line saying that the
  importer extraction node now saves a dataset and declares a `records` port.
  I did not edit docs, per the brief.
