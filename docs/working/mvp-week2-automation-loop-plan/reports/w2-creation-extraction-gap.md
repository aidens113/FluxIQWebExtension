# w2-creation-extraction-gap: can model-created Flows navigate and scrape?

Worker report, 2026-09-16. Read-only investigation of FluxIQ Core (`F:\!FluxIQ`)
and this repository. The only file I wrote in either repository is this
report. Path prefixes: `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`, and `FB/` is
`AS/runtime/flow-bootstrap/plan/`.

## Outcome

Done. The short answer is **no**. Today "instruction -> explore -> create a Flow
that navigates and scrapes -> run -> judge by the collected data" cannot work
end to end, for five separate reasons:

1. The model can pick an extraction node.
2. It is never told what that node's parameters look like.
3. It is never shown the selectors those parameters need.
4. The node it picks cannot save a dataset.
5. The Lab has no lane that creates a Flow from an instruction and judges the
   dataset.

## What changed and why

- Wrote this report.
- Wrote one scratch probe outside both repositories:
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\f31cfd6e-5126-46a3-8c5b-179104eb25c8\scratchpad\w2-creation-extraction-gap-probe.mjs`.
  It imports the built `dist` of both packages and makes no provider calls:
  `runAutomationStudioLlmHarness` runs with `dryRun: true`.
- Changed nothing in either repository.

## Commands run and observed results

- `node w2-creation-extraction-gap-probe.mjs`, run in the scratchpad. It
  printed the following:
  - `registry size 59`: Core's built-in nodes plus the 18 web output nodes.
  - For four scrape instructions (catalog, feed, table, members), the node
    catalog the model receives on an `evidence_tool_decision` call has 16-17
    entries using about 9,100-9,500 of about 9,500 bytes.
    `web.output.dom-extract_list` was present in all four.
    `builtin.policy.action` was present in **none**.
    `web.output.dom-click` was missing for "catalog" and "feed", and
    `web.output.dom-scroll` was missing for "catalog", "table" and "members".
    Filler such as `builtin.database.query`, `web.output.browser-download` and
    `web.output.dom-dialog` took the space.
  - The tools offered were exactly
    `web.inspect_current_page, web.navigate_same_origin, web.reveal_safe`.
  - The extract_list catalog entry the model sees is
    `"description":"Extract a field map from every item of a repeating structure, following paginati"`,
    with parameters
    `[{"id":"extractList","type":"object","required":true},{"id":"timeoutMs","type":"number","defaultValue":10000},{"id":"expectedState","type":"object"}]`
    and outputs `success`/`failed` only.
  - Bootstrap validation results for the four probe plans:

    | Plan | Result |
    | --- | --- |
    | `importerExtractList` | `ok=true risk=medium` |
    | `importerExtractListMalformed` (`extractList: {nonsense:true}`) | `ok=true` |
    | `policyActionWithRecordOutput` | `ok=true risk=high` |
    | `policyActionBadRecordOutput` (`outputId: "not.a.registered.output"`, `recordOutput: {nonsense:true}`) | `ok=true` |

    All four were within the evidence-completion limits.
  - The same malformed values are refused only by the runtime parsers:
    - `parseAutomationStudioRecordOutput({nonsense:true})` returned
      `ok:false` with `record_output.unknown_key, ...invalid_dataset_id, ...missing_records_path, ...invalid_write_mode, record_schema.not_object`.
    - `webAutomationExtractListRequestValue({nonsense:true})` returned
      `false`.
  - Normalizing the valid importer plan gave a node with
    `parameterValueKeys: ["extractList"]` and
    `metadata.outputActionId: "web.dom.extract_list"`. It has no
    `recordOutput`.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap`, run in
  `F:\!FluxIQ\packages\fluxiq`, printed `2 passed (2)` files and
  `64 passed (64)` tests. This is the baseline only; nothing was changed.
- `git status --short` in both repositories:
  - Core has uncommitted changes under `AS/runtime/llm/` and
    `AS/runtime/recovery/` only. Nothing under `flow-bootstrap/`, `nodes/` or
    `executor/` is changed, so the probe against `dist` reflects the source I
    read.
  - This repository has another worker's changes in progress: see Open
    questions.

## Findings

### 1. Which node and action types the model can emit when it creates a Flow

- **What the plan can contain.** A plan node is
  `{key, definitionId, definitionVersion, parameters?, outputActionId?}`
  (`FB/contracts.ts:9-15`). Any definition in the bound registry that the
  resolution allows is eligible.
  - The registry is `nativeNodeRuntime.sdk.nodes`
    (`AS/runtime/service.ts:1863-1868`, re-checked at apply time,
    `service.ts:4129-4140`).
  - The web domain registers one importer node per action type, 18 in all
    (`domain/src/output-nodes/definitions.ts:71-73`,
    `domain/src/web-panel-host.ts:69-97`, `domain/src/actions/types.ts:437-456`).
  - Each web node has `requiredRuntimeCapabilities: ["web.actions"]`
    (`definitions.ts:98`) and a fixed output action (`definitions.ts:104`).
  - Core's built-in nodes are also available, including `builtin.policy.action`
    and `builtin.data.write-records` (`AS/nodes/registry.ts:26-36`,
    `AS/nodes/canonical-registry.ts:51`).
- **What the model actually sees.** It sees only what fits the byte budget
  (`AS/runtime/llm/harness/context-packet.ts:136-146`, built with a 5,000-token
  input allowance, `service.ts:1932`). The evidence-guided pre-check also caps
  the catalog at 12 entries (`service.ts:1876`).
- **Extraction nodes.**
  - `web.output.dom-extract_list` and `web.output.dom-extract` are emittable.
    Their parameters are `extractList`, `timeoutMs` and `expectedState`
    (`definitions.ts:172-175`).
  - There is no dataset-writing web node. The only nodes that save datasets are
    `builtin.policy.action` (`recordOutput`, `AS/nodes/policy/action.ts:41-50`)
    and `builtin.data.write-records` (`AS/nodes/data/write-records.ts:11-33`).
    In the probe, `policy.action` never made the catalog.
- **Multi-page navigation.**
  - Pagination is inside `extract_list` itself, as `paginate` with the modes
    `next`, `loadMore`, `scroll` and `numbered` and a bound of 50 pages
    (`domain/src/actions/extraction/request.ts:66-73,146-147`; schema at
    `domain/src/actions/extraction/schema.ts:57-68`).
  - `web.output.browser-navigate`, `web.output.dom-click` and
    `web.output.dom-scroll` (modes `by`, `toElement` and
    `untilStable`/`maxScrolls`, `definitions.ts:152-158`,
    `domain/src/actions/types.ts:129-132`) are emittable when they rank into
    the catalog.
  - "Follow every link" (visit each record's detail page) has no dedicated
    node. It would need Core's `builtin.control.for-each` plus a navigate node
    bound to state. For-each is in Core's registry and appeared in three of the
    four probe catalogs.

### 2. Which tools the model can use to explore a site

- **The three authoring tools.** Flow Bootstrap builds its tool list from
  `automationStudioHarnessOptionRegistry({ binding })` with no host and no
  stage (`service.ts:1910`). So the model gets exactly the three unstaged tools
  the web binding declares (`domain/src/runtime/llm-evidence/tools.ts:134-160`):
  - `web.inspect_current_page` observes the page.
  - `web.navigate_same_origin` moves to another page on the same origin.
  - `web.reveal_safe` operates a disclosure, tab, menu or tree item.

  The file header states that form entry, option selection and submission are
  deliberately absent (`tools.ts:8-9`).
- **The recovery options are withheld.** The domain's five recovery options
  (inspect, reveal, act_safe, wait_for_change, navigate_in_scope) are pinned to
  the `gather` and `iterate` stages
  (`domain/src/runtime/llm-evidence/harness-options/options.ts:49,67,76`).
  Core withholds a stage-pinned option from a call that names no stage
  (`AS/runtime/llm/harness-options/registry.ts:231-237`). The result: there is
  **no scroll, wait, "load more" or pagination tool while authoring.**
- **What an inspect packet contains.** Up to 40 elements
  (`domain/src/runtime/llm-evidence/limits.ts:30`), each with:
  - an opaque `target` handle;
  - tag, role, name and text;
  - `item: {index, total}` for list position and `cell: {row, column, header}`
    for table position (`domain/src/runtime/llm-evidence/elements.ts:33-73`).
- **What it deliberately leaves out.** The packet carries **no selector**
  (`elements.ts:34-42`), and `selector` is a denied evidence key
  (`tools.ts:123`).
- **Repeating structure never reaches the model.**
  - The page capture computes page-level repeating runs: container selector,
    signature, item count and field test ids
    (`apps/extension/src/content/evidence/page.ts:45,62`,
    `domain/src/page-evidence/types.ts:177-191`). The LLM packet does not carry
    them (`domain/src/runtime/llm-evidence/page-evidence.ts:6-9,33-51`).
  - The extraction plan's field and repeating-structure inference
    (`apps/extension/src/content/extraction/infer-list.ts:51`, `infer-fields.ts:70`)
    is reachable only through the picker's `extraction.propose` content message
    (`apps/extension/src/content/message-handler.ts:96-117`). No gateway action
    or LLM tool reaches it, so **the model cannot discover repeating structures
    in a form it can use.**

### 3. Whether the prompt describes extraction, and whether an extraction plan validates and compiles

- **Prompt and schema.** Nothing describes extraction, datasets, pagination or
  selectors.
  - The system prompts are generic (`AS/runtime/llm/deepseek-provider.ts:43-53`,
    `AS/runtime/llm/evidence-loop.ts:14`).
  - The completion schema asks for a minimal plan (`FB/evidence-schema.ts:14,58`).
  - The only description of parameters is "Emit only parameter IDs declared by
    the selected nodeCatalog entry" (`FB/output-schema.ts:77`).
  - A catalog entry carries each parameter's id, type, required flag, default,
    options and constraints only (`FB/catalog.ts:61-86`). The
    `metadata.parameterSchema` that defines `extractList`'s shape
    (`definitions.ts:118-128`, `schema.ts:25-74`) is not sent, and the
    description is cut at 80 characters (`FB/catalog.ts:66`).
  - Ranking treats "extract" as one of the verify words
    (`FB/ranking.ts:10`). It has no terms for scrape, collect, table, rows,
    list, page, next or "load more".
  - The model is not told that a paginated read needs `timeoutMs` scaled by
    pages. The node default is 10,000 ms (`definitions.ts:169-175`,
    `domain/src/actions/extraction/request.ts:157-181`).
- **Validation.** Yes, a plan with an extraction node passes, and so does a
  wrong one.
  - `validateParameters` checks only a parameter's JSON type and constraints
    (`FB/validation.ts:132-150,221-244`). An `object` or `json` value only has
    to be a non-null, non-array object (`FB/validation.ts:228`).
  - The probe confirms that a malformed `extractList`, an invalid
    `recordOutput` and an unregistered `policy.action` `outputId` all validate.
- **Compiling and applying.**
  - Normalization copies parameters into `parameterValues` and puts the output
    id in metadata (`AS/runtime/flow-bootstrap/adaptation.ts:132-143`).
  - Apply re-validates the same way (`service.ts:4129-4150`) and saves the
    graph through structural `validateAutomationStudioFlow` only
    (`AS/runtime/service/flows/writer.ts:107`).
  - The recording-provenance guard rejects keys matching `/recording|timeline/i`
    (`adaptation.ts:234-246`); `recordOutput` does not match.
  - A malformed `extractList` is refused only at dispatch
    (`domain/src/actions/extraction/read-request.ts:56-60`).
- **Selectors.** `extractList.item` is a required non-empty CSS string, and
  fields are selector strings or specs (`read-request.ts:56-60`). The model
  must invent both, because no packet shows it a selector. Click and type have
  the same gap: `selector` is required (`domain/src/actions/schemas.ts:50-53`,
  `definitions.ts:127`).

### 4. Whether a created Flow that extracts data stores a dataset the Lab can judge

- **Core never saves the rows.**
  - Core's record capture runs only when the dispatch effect carries
    `recordOutput` (`AS/runtime/executor/record-capture.ts:48-51,75-81`). The
    comment at `record-capture.ts:4-7` says an importer node *may* supply it.
  - The web importer node's implementation emits only `{outputId, parameters}`
    (`domain/src/output-nodes/native-runtime.ts:57-73`).
  - So a bootstrapped `web.output.dom-extract_list` returns
    `{ result: dispatched }` unchanged (`record-capture.ts:51`), and **no
    dataset is written**.
- **Wiring to Write Records does not help.**
  - The web node has no `records` port (`definitions.ts`; `outputPorts` is
    `success`/`failed`).
  - Its `success` value is `true` (`native-runtime.ts:61-63`).
  - `write-records` would therefore receive `true` rather than rows, and its
    capture refuses non-lists (`record-capture.ts:116-117`).
- **Only `builtin.policy.action` saves datasets today, and bootstrap is a poor
  route to it.**
  - It saves only with an author-written `recordOutput`, which is exactly how
    recordings do it (`AS/runtime/service/recordings/proposal-candidates.ts:98-117`).
  - The model is never told its shape (`FB/catalog.ts:71-79` shows
    `{"id":"recordOutput","type":"json","stateBindable":false,"defaultValue":null}`).
  - It is privileged, so the plan's risk is `high` (`FB/risk.ts:12`).
  - Its `outputId` is unchecked.
- **The Lab.**
  - The Flow lane does read Core's run datasets (K5 and K8):
    `packages/test-runner/src/flow-lane/run-datasets.ts:5-45` and
    `persisted-flow-run.ts:154-160`.
  - It judges them (`flow-lane/expectations.ts:155-238`, called at
    `flow-lane/run-flow-lane.ts:181-188`), and the evaluation carries
    `extraction` (`run-evaluation/observed-run-evaluation.ts:105-108`).
  - That lane is recording-driven: record -> propose -> approve -> run
    (`run-flow-lane.ts:116-176`). It pairs datasets with the recording
    script's extract steps by recording candidate order
    (`expectations.ts:139-170,268-277`), and it identifies output nodes only by
    `parameterValues.outputId` (`flow-lane/flow-action-types.ts:50-59`).
  - `pages` and `truncated` cannot be observed in that lane
    (`expectations.ts:78-79`).
  - There is no live creation lane: `--llm-task` other than
    diagnose or adapt is refused
    (`packages/test-runner/src/live-llm/live-llm-plan.ts:174-181`).
  - The demo exploration baseline judges only the hard-coded
    `Submitted: Ada / team` text
    (`packages/test-runner/src/demo-workspace/exploration-checkpoints.ts:81`).

### 5. Scenario Lab targets for navigate-and-scrape

All paths are under `apps/scenario-lab/src/scenarios/`. The table goes from
easiest to hardest.

| Scenario | Workflow and step | What the manifest expects | Notes |
| --- | --- | --- | --- |
| data-table | primary `extract-inventory` (`data-table/scenario.ts:30,33`) | 12 records `{product, category, price, stock}`, read by `column:` header | Single page. The easiest first target. |
| data-table | `column-reorder` variant (`:43`) | The same 12 records | Tests reading by header. |
| data-table | `large-table` variant (`:54`) | `count: 1000, truncated: true` | `truncated` cannot be observed in the Flow lane. |
| data-table | `empty-table` / `extract-any-inventory` (`:67-79`) | 12 records; the `no-rows` variant expects 0 | Needs `minItems: 0`. |
| data-table | `sort-by-price` / `extract-cheapest` (`:90-100`) | Click the Price header, then 1 record | Navigate-and-extract. |
| product-catalog | primary `extract-page-one` (`product-catalog/manifest.ts:62,68`) | 8 records `{name, price, rating, url}`; `actions: web.dom.extract_list` | Variants `text-variant` (`:77`), `sparse-cards` with optional price and rating (`:85-89`), and `absolute-links` (`:97`). |
| product-catalog | `paginated-extraction` / `extract-all-pages` (`:106,112`) | 23 records, `pages: 3` via `next` (`maxPages: 5`) | Variants `short-catalog` (5, `:122`) and `link-pagination` (23, `:131`). |
| product-catalog | `numbered-pages` / `extract-numbered-pages` (`:222-229`) | 23 records, `pages: 3` via `numbered` | |
| product-catalog | `search` / `extract-search-results` (`:141-153`) | Type, press Enter, wait, then 4 records (`minItems: 0`) | `no-results` variant expects 0 (`:161`). |
| product-catalog | `in-stock-only` / `extract-in-stock` (`:170-180`) | Tick a checkbox, wait, then 18 records plus `availability`, `pages: 3` | |
| product-catalog | `with-images` / `extract-images` (`:192-200`) | 8 records of attribute reads; `deferredImage` optional | `lazy-images` variant (`:211`). |
| infinite-feed | primary `extract-loaded-posts` (`infinite-feed/scenario.ts:55-67`) | Three scrolls and waits, then 40 records `{title, author, published@datetime}` | `end-early` variant expects 25 (`:81`). |
| infinite-feed | `extract-until-end` / `extract-every-post` (`:94-98`) | Scroll mode, `maxScrolls: 20`, 60 records | |
| infinite-feed | `extract-by-load-more` / `extract-paged-posts` (`:109-113`) | `loadMore`: 10 records, `pages: 1` | `load-more-button` variant expects 60 (`:124-126`). |
| member-directory | `filter-members` / `extract-admins` (`member-directory/manifest.ts:130-140`) | Type a search and pick the admin role, then the matching admins `{id: "@data-member-id", member, role, team, status}` | Raw CSS item (`:29`), 240 rows, generated classes, and two controls both named "Search" (`:56`). Hard. `sorted-by-activity` variant (`:157`). |
| admin-console | `extract-customer-list` / `read-customer-book` (`admin-console/manifest.ts:138-143`) | Every record of a virtualised list | `short-book` variant (`:156`). Hard. |
| dynamic-list | none (`dynamic-list/scenario.ts:15-27`) | No extraction | Type, click and mutate only. |
| navigation | none (`navigation/scenario.ts:32-36`) | No extraction | Click and navigate only. Useful for testing navigation alone. |
| long-document | none (`long-document/scenario.ts:12-15`) | No extraction | Scroll and click only. |

Other extracting scenarios, each expecting a single record or a small set:
`auth-gate` (`read-account`), `multi-tab` (`extract-order-details`) and
`sensitive-input` (`extract-cards`).

## What is missing, in order

1. **A bootstrapped extraction node must save a dataset.** Mostly this
   repository.
   - In `domain/src/output-nodes/definitions.ts`, give
     `web.output.dom-extract_list`:
     - a `recordOutput` parameter (`json`, `allowStateBinding: false`,
       `ui.control: "record-output"`, as `AS/nodes/policy/action.ts:41-50`
       declares it);
     - a `records` output port (as
       `AS/runtime/service/recordings/candidate-definitions.ts:31-35` does).

     Every web parameter is currently forced to be state-bindable
     (`definitions.ts:110`), and `domain/src/tests/domain.test.ts:286-289`
     asserts that, so that test has to change deliberately.
   - In `domain/src/output-nodes/native-runtime.ts`, put `recordOutput` into
     the `policy.output.dispatch` payload. When the node carries none, derive
     one from the lifted `extractList.fields` with the existing
     `webAutomationRecordOutput` builder
     (`domain/src/recording/proposals/record-output.ts:49-72`), using
     `recordsPath: "result.extracted"` (`definitions.ts:36-38`). The model
     would then need to author only the extraction, not a schema.
   - Core's capture already honours an importer node's `recordOutput`
     (`record-capture.ts:4-7`). **Core** should only confirm this, and add a
     test that an importer node's declared `records` output passes
     `validateResultBoundary` (`AS/runtime/native-node-runtime.ts:104-114`).
2. **Bootstrap validation must refuse what the runtime refuses.** Core, in
   `FB/validation.ts`:
   - parse every `record-output`-controlled parameter with
     `parseAutomationStudioRecordOutput`;
   - add a generic per-definition parameter-contract hook, so a domain's
     structured parameter (`extractList`, `scroll`) is checked when the plan is
     validated rather than at dispatch;
   - check `builtin.policy.action`'s `outputId` against the registered outputs,
     or keep that node out of generated plans.

   The domain half, in `domain/src/output-nodes/definitions.ts`, supplies the
   check, reusing `webAutomationExtractListRequestValue`
   (`read-request.ts:56-60`).
3. **Tell the model the shape of structured parameters.**
   - Core (`FB/catalog.ts:61-86`, `FB/contracts.ts:57-65`): carry a bounded
     parameter schema or description for `object` parameters in the catalog
     entry, and stop cutting descriptions at 80 characters (`FB/catalog.ts:66`).
     Ranking (`FB/ranking.ts:6-16`) should let a definition's tags or synonyms
     carry intent, so that scrape, collect, list, table, rows and "every page"
     pull in extraction without Core learning web words.
   - This repository (`definitions.ts`):
     - add those tags and a concise `extractList` description covering `item`,
       the field grammar, the `paginate` modes and `minItems`/`maxItems`;
     - scale `timeoutMs` from `paginate` in the native implementation when the
       author left the default (`request.ts:177-181`).
4. **Let exploration find repeating structure without exposing selectors.**
   This repository, in `domain/src/runtime/llm-evidence/tools.ts` plus a new
   gateway action or snapshot flag in the extension.
   - Add an observe-only authoring tool that runs the picker's inference
     (`infer-list.ts:51`) on a target handle or on the page's largest
     repeating run.
   - It should return an opaque extraction handle plus field keys, labels,
     coverage, item count and the detected pagination mode. It must return no
     values and no selectors (the D3 rule the picker already follows,
     `message-handler.ts:107-111`).
   - Optionally, add a bounded authoring scroll or wait so the model can
     confirm infinite-feed and load-more behaviour. Today the only such options
     are stage-pinned recovery options (`options.ts:49`).
5. **Resolve handles into executable parameters.** Core generic hook, domain
   implementation.
   - Core: add a binding method on
     `AutomationStudioLlmEvidenceRuntimeBinding`
     (`AS/runtime/llm/harness-options/binding.ts:31-81`), analogous to
     `validateTargetOverrideEvidence`. Call it in
     `generateFlowBootstrapAdaptation` before validation
     (`service.ts:1989-1999`), so that a plan node naming a handle is rewritten
     into the domain's real parameters.
   - This repository: implement it from the selector bindings the evidence
     runtime already retains (`tools.ts:162-173`).

   The same fix closes the equivalent gap for click and type nodes, whose
   `selector` the model must currently invent (`schemas.ts:50-53`).
6. **Add a Lab lane that creates a Flow and judges its dataset.** This
   repository, test-runner.
   - Add a `create-flow` task in `live-llm/live-llm-plan.ts:174-181` that
     drives Flow Bootstrap, applies the result, runs the Flow and reads
     `runDetail.datasets` through `flow-lane/run-datasets.ts`.
   - Judge the result with `assertExtraction` and `measureExtraction` against
     the manifest's `expected.extracted` entry named by the task. The
     in-progress `apps/scenario-lab/src/scenarios/live-instructions.ts` names
     that entry through `expectedDatasetId`.
   - Pair by the Flow's dataset, not by recording candidate order
     (`expectations.ts:268-277`).
   - Identify output nodes by `metadata.outputActionId` as well as by
     `parameterValues.outputId` (`flow-action-types.ts:50-59`).
   - Declare `pages` and `truncated` unjudged in this lane, as the recording
     lane does.
7. **Later: "follow every link".** Per-record detail pages need a For Each
   over the extracted records feeding a state-bound navigate and a second
   extraction. Core's `builtin.control.for-each` exists. Whether bootstrap can
   author that loop correctly is untested.

## Not verified

- No live provider call, demo workspace run or `pnpm lab` run was made, as the
  brief required. Every statement about model behaviour comes from reading the
  prompt and catalog, not from observation.
- The probe ran against built `dist` (Core built 15:44, domain built 16:10
  today). Core's uncommitted changes do not touch the paths probed. I did not
  rebuild.
- I did not run the domain or test-runner test suites.
- I did not trace whether the extracted rows of an importer node without
  `recordOutput`, which stay at `outputs.result.extracted`
  (`record-capture.ts:51`), end up unwithheld in the saved run trace. It is
  worth checking, because D12 promises that excluded columns are stored
  nowhere.
- I did not verify whether `extract_list` reads the unmounted rows of
  admin-console's virtualised list.
- I did not check how the live `instruction-only-form` creation obtained
  working selectors for its click and type nodes. That is covered by
  `w2-live-explore-create-repair`, which I did not read.

## Open questions or contradictions found

- **Stale plan status.** `first-class-data-extraction-plan.md` Current State
  (lines 86-87) says X5.5-X5.7 "Flow-lane judging" is not done. The code has
  it: `flow-lane/expectations.ts:155-238`, called from
  `run-flow-lane.ts:181-188`. The plan's status looks stale.
- **Selectors are denied to the model but required by the nodes it authors.**
  The evidence packet withholds selectors by design, and `selector` is a
  denied key. Yet every targeted web node and `extract_list` require selector
  strings the model must write. Model-authored Flows can only guess them until
  item 5 exists.
- **Required test must change.** `domain.test.ts:286-289` requires every web
  node parameter to be state-bindable. Core requires `recordOutput` to be
  non-bindable. Item 1 therefore has to change that assertion on purpose.
- **Concurrent edits by another worker.** Another worker is editing this
  repository:
  - `packages/test-runner/src/flow-lane/flow-action-types.ts` has
    `FlowNodeRecord.outputActionId` added, but `flowActionTypes()` still read
    only `parameterValues.outputId` when I read it.
  - `apps/scenario-lab/src/scenarios/live-instructions.ts` and its test are
    new and untracked.

  I made no edits there. Item 6 should build on that worker's result.
- **The only dataset-saving node is effectively unavailable to bootstrap.**
  `builtin.policy.action` never ranked into the catalog, and choosing it makes
  a plan `high` risk. Item 1 is recommended over steering the model toward
  it.
