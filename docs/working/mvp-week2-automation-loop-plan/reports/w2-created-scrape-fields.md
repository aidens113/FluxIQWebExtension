# w2-created-scrape-fields: created scrape Flows read the right rows but no fields

Worker report, 2026-09-16/17. This repository only; FluxIQ Core was read,
never edited. Scope: the brief, plus two scope extensions from the
coordinator (the `web.handle.*` refusals during creation, and why
`reveal_safe` refused the feed).

## Outcome

**Partial.**

- **Fixed, and confirmed by one live run.** A Flow created from the catalog
  instruction now extracts every field. In `run-mu4yk4u1-60a1c3a4` the
  extraction read 8 of 8 records, and 32 of 32 fields were present with no
  extra columns. Before the fix (`run-mu4wwkbc-df6cfe60`), every field was
  missing and the node failed.
- **Still failing, for two different reasons.**
  - None of the 8 records matched the expected values. The run does not
    record values, so the cause is inference: most likely the `url` column
    reads the link's absolute address, which includes the Lab's per-run port,
    while the fixture expects the root-relative href. See open question 1.
  - The model added a separate "write records" node after the extraction.
    That node failed with `record_output.invalid`, so the run failed even
    though the extraction succeeded. I then reworded the node's description to
    say it saves its own rows; that wording has not been tried live.
- **Live runs stopped at one.** The coordinator said not to run live from this
  checkout while other workers edit it, and that message arrived after the one
  run had started.

In plain terms:

- **What went wrong.** When a Flow was built from "scrape the products ...
  with columns name, price, rating and url", the model found the product list
  with the detection tool. That tool shows each column under the page's own
  name (`product-name`, `product-link`, ...) and hands back an opaque
  `extraction.N` handle. Two things then stopped the model from using it:
  1. The handle could not rename or select columns. `{ "handle": "extraction.1" }`
     gave all seven detected columns under the page's names, and anything
     else next to `handle` was refused as malformed. The instruction asks for
     four columns called `name`, `price`, `rating` and `url`, so the handle
     could never give the answer the task is judged on.
  2. The only text the model reads about the extraction node described a
     literal CSS request and showed a CSS example. So the model wrote a literal
     request, keyed `name, price, rating, url` as asked, with selectors it had
     never been shown. It most likely used the detected column keys as
     selectors: `product-name` as CSS matches nothing. The item selector
     happened to match the 8 cards, and every field was empty.
- **What changed.** The handle now takes the columns to keep and what to call
  them, can read an attribute as the page writes it, and can stop at the
  page shown:
  `{ "handle": "extraction.1", "fields": { "name": "product-name", "price": "product-price", "rating": "product-rating", "url": "product-link@href" }, "paginate": false }`
  resolves to exactly the request the fixture's own recording reads. The
  node's text now leads with that form, and says the node saves its own rows,
  with no record output and no separate save node. Once a Flow has been shown
  a detected list, a literal request is refused as a guess, which Core feeds
  back to the model while it can still correct the plan.
- **The refusals.** Every placement a model plausibly writes that has only
  one reading is now accepted, including the `location` Core itself tells the
  model to add. Every refusal says where the handle belongs and where the
  problem was, by position and never by value.

## Root cause, with file:line (as of 269e351)

1. `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:187`
   (`resolveExtraction`) refused every key beside `handle`, `minItems` and
   `maxItems`:
   - `fields`, so no renaming or choosing columns;
   - `paginate`, so no stopping at page one;
   - `location`, which Core's own prompt
     (`AS/runtime/flow-bootstrap/plan/evidence-schema.ts:69`) and refusal
     feedback (`AS/runtime/llm/harness-options/bootstrap-completion.ts:55-57`)
     tell the model to add after exploring more than one place.

   `resolve-plan-node.ts:194` then returned the binding's request unchanged:
   every detected column under its detected key, plus the detected Next-link
   pagination (`maxPages: 3`). Scratch probe on the real catalog capture:

   `{"extractList":{"handle":"extraction.1"}}` resolved to 7 fields
   (`product-image_src`, `product-image_alt`, `product-name`, `product-link`,
   `product-price`, `product-rating`, `stock-badge`) and
   `paginate {next, maxPages: 3}`. With `fields` added, it was
   `{"status":"refused","issueCodes":["web.handle.malformed"]}`.

   The judge (`packages/test-runner/src/run-expectations/extraction.ts:223-229`)
   requires the exact key set and exact values, so no handle-based plan could
   pass.
2. `domain/src/output-nodes/extract-list/catalog-text.ts:50-58` (the
   `extractList` description the model reads) said
   `item: CSS selector of each record ... fields: { key: "css" ... }`. It showed
   a CSS example (`:61-65`) and said nothing about handles. That contradicts
   Core's "Never write a locator ... of your own", and the model followed the
   node-specific text.
3. `resolve-plan-node.ts:138-141` (code) and its test at `:181` left a literal
   `extractList` unchanged even after a detection. So the guess reached run
   time, and failed there as `web.validation.output_not_observed` with
   "8 records from 1 page; missing from some records: name, price, rating, url".
4. `url` needs the raw `href`. The detected `product-link` column is kind
   `link`, which reads the absolute address
   (`apps/extension/src/content/extraction/field-reader.ts:82-91`). The
   fixture reads `testid:product-link@href`, the root-relative href, because
   the Lab port changes every run
   (`apps/scenario-lab/src/scenarios/product-catalog/format.ts:3`,
   `manifest.ts:13-18`). The plan had no way to say "the href as written"
   through a handle.
5. Truncation is not a cause. The catalog detection packet is 774 bytes
   (scratch probe), against a 6,000-byte exploration budget
   (`llm-evidence/limits.ts:22-26`). The 5,848-byte truncated packets in the
   run are the run-time failure evidence on the action nodes, not the build's
   exploration.

Supporting evidence, read from the campaign:

- Every catalog task that called detection failed the same way:
  `run-mu4wwkbc-df6cfe60`, `run-mu4wyfaw-001d0bcc`, `run-mu4wzn31-f8d2189b`,
  `run-mu4x1i5f-b4d20fee` and `run-mu4x8xmx-345d35bc` each read "8 records ...
  missing from some records: name, price, rating, url". `run-mu4x3hs7-9115ed49`
  read 0 records.
- The one catalog task that passed, `run-mu4x7und-4a367e42` (numbered pages,
  23/23 records, 92/92 fields), never called detection.
- The coordinator reports that four data-table tasks passed. There the
  detected keys (`product`, `category`, `price`, `stock`) already equal the
  instruction's column names, so a bare handle is enough.

## What changed and why

All paths are under `domain/src/`.

- `runtime/llm-evidence/plan-resolution/extraction-slot.ts` (new). The
  `extractList` slot reads the list's handle in each unambiguous place:
  - as the whole value, beside `location`, `fields` or `columns`, `paginate`,
    `minItems` and `maxItems`;
  - as `item` (a literal `item` string beside a handle is replaced by the
    detected one);
  - on fields, as `{ handle, key }` or as a bare `{ handle }` under a detected
    key.

  Pagination rules: `paginate: false` reads only the page shown. Absent or
  `true`, it reads the detected pagination. A pagination object the model
  wrote keeps the detected controls, and takes the model's
  `maxPages`/`maxScrolls` (1-50) when its mode matches; it is refused when
  nothing was detected.

  A location that differs from the one the handle was issued at is `unknown`.
  The result is checked by the dispatch reader.
- `runtime/llm-evidence/plan-resolution/extraction-columns.ts` (new). Which
  detected columns are kept, and under which keys:
  - `fields` in the documented direction; the reversed map when only that
    reading works; an array of columns; `columns` as a synonym;
  - a column written as `key`, as a unique key in another case, as
    `column:Header` or a unique header, or with `@attr` (attribute name
    checked) for that column element's attribute as written (not allowed on
    table-header columns);
  - column objects with `key`/`field`/`column`/`header`, `attribute`,
    `required` and a matching `kind`.

  Everything else is refused as `unknown_field`, `ambiguous` or `malformed`,
  with a position.
- `runtime/llm-evidence/plan-resolution/handle-tokens.ts` (new). Recognises
  `target.N` and `extraction.N` handles, and the path to every handle in a
  value. It replaces the two regexes and the depth search that were in
  `resolve-plan-node.ts`.
- `runtime/llm-evidence/plan-resolution/issue-position.ts` (new). Builds
  `<reason>:<path>` codes (at most 100 characters of Core's alphabet). It
  spells out only top-level parameter ids and the grammar's own keys; a key
  the model chose, and any array entry, is given by its index.
- `runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`:
  - The slot above is used for `extractList`.
  - A literal `extractList` after a detection in the same project and Flow is
    `web.handle.extraction_required`.
  - Core's Run Output node (`builtin.policy.action`) that names a web output
    has its `parameters` resolved exactly as that output's node would be. Core
    dispatches that payload unchanged (`AS/nodes/policy/action.ts:55-63`), and
    before this, such handles were refused as misplaced.
  - Refusals now list, in order: the reasons; where a handle of that kind is
    accepted, as a published code
    (`web.handle.expected.extract_list.handle_fields_paginate`,
    `web.handle.expected.selector.handle_location`), added for
    malformed/misplaced/unknown_field/extraction_required; and one
    `<reason>:<position>` per place, capped at Core's 16.
  - `WEB_PLAN_HANDLE_ISSUE_CODES` gains `web.handle.unknown_field`,
    `web.handle.extraction_required` and the two placement codes.
  - The new type `WebPlanHandleIssue` covers the position codes.
- `runtime/llm-evidence/plan-resolution/index.ts`: exports
  `WebPlanHandleIssue` and names the new modules.
- `runtime/llm-evidence/structure/handles.ts`: `issuedFor(scope)`, whether
  this project and Flow was ever issued a detection handle, kept or let go.
- `output-nodes/extract-list/catalog-text.ts`:
  - The node description now reads: "... Detect the list with
    web.detect_repeating_structure; name it in extractList by its handle. It
    saves its rows itself: no recordOutput or save node needed." (230
    characters, first sentence unchanged.) The last sentence was added after
    the live run below.
  - The grammar (595 of 600 characters) leads with
    `{handle: "extraction.N", fields?: {key: "detectedKey" | "detectedKey@href"}, paginate?: false (this page only)}`
    and states that a link column is the absolute URL and `@href` the raw
    href.
  - The literal grammar follows, with every term `definitions.test.ts` pins.
    The example is unchanged.
- Tests:
  - new `plan-resolution/tests/extraction-slot.test.ts` (8 tests: catalog,
    defaults and pagination, placements, table and feed, Run Output,
    refusals with positions, no value quoted, the literal guard);
  - new `output-nodes/extract-list/tests/catalog-text.test.ts` (2 tests);
  - updated `plan-resolution/tests/resolve-plan-node.test.ts` (refusals carry
    positions and hints; a literal after detection is refused; a Run Output
    payload resolves; the code list);
  - updated `plan-resolution/tests/plan-node-identity.test.ts` (two refusals
    carry positions).

## Scope extension: handle refusals during creation

Evidence (supervisor-read, re-read by me from each run's
`snapshots/live-llm.json` `build.evidenceLoop.steps`):

| Run | Task | Steps after detection |
| --- | --- | --- |
| `run-mu4x5m2p-a4a4a29d` | product-catalog-all-pages-short-catalog | misplaced, misplaced, malformed |
| `run-mu4xatjs-12a5a5c7` | product-catalog-search-no-results | record_output.unknown_key, detect, misplaced, malformed, record_output.unknown_key |
| `run-mu4xhkd9-d82265dc` | data-table-inventory-reordered-columns | malformed x3 |
| `run-mu4xn1wz-6cdb8bbf` | data-table-cheapest-product | misplaced x3 |
| `run-mu4xoqmk-e046f7bf` | infinite-feed-first-forty | reveal_safe target_unsafe, detect, misplaced, malformed, malformed |

Each build ended `flow_bootstrap.evidence_unusable_decision`.

### What the resolver accepted before

- `extractList: { handle: "extraction.N", minItems?, maxItems? }` on the
  extraction node only.
- `selector` / `target` / `element: { handle: "target.N", location? }` on
  element nodes.

Everything else was refused with a bare code, with nothing saying where.

### What the model most plausibly wrote

This is inference: plans are not recorded, by design.

- **malformed**:
  - `{ handle, location }`, the exact shape Core's prompt and feedback tell
    it to write after exploring (all these builds ran inspect and then
    detect);
  - `{ handle, fields: {...} }` to get the instruction's column names (the
    table task asks for columns in a new order, and the feed asks for
    "published", which is the `datetime` attribute:
    `apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts:30`);
  - `{ handle, paginate: {...} }` for the scroll bound ("until 40 posts").
- **misplaced**:
  - the list named at `item`, or at each field, beside literal fields;
  - a handle in a Run Output node's payload;
  - or a handle in a node that cannot take one (for "cheapest product", a
    data or transform node naming the list).

### What is accepted now

- All of the above except the last, which has no single reading. A data node
  cannot run a handle, so it stays `misplaced`.
- Refused shapes now name where the handle belongs and the position that was
  wrong. For example, a handle in a transform node's `records`:
  `["web.handle.misplaced", "web.handle.expected.extract_list.handle_fields_paginate", "web.handle.misplaced:records.0.0.0.0.0"]`.
- A literal request after a detection names the same placement.
- The feed request now resolves to the fixture's own:
  `{handle, fields: {title: "feed-item-title", author: "feed-item-author", published: "feed-item-time@datetime"}, paginate: {mode: "scroll", maxScrolls: 10}, maxItems: 40}`.
- Table columns can be named by header (`column:Price`, `Category`) or listed
  as an array (both tested).

### Lab and Core handling of the new codes

- The Lab admits the new published codes by exact value
  (`packages/test-runner/src/demo-llm-create-ui/generation-failure.ts:151`
  reads `WEB_PLAN_HANDLE_ISSUE_CODES`; all are lower-case dotted and at most
  64 characters).
- The Lab withholds the `:<position>` codes and counts them in
  `issueCodesWithheld`, because they contain a colon (`:147`).
- The model still sees the position codes: Core admits
  `[a-z0-9_.:-]{1,100}` (`plan-parameter-resolution.ts:38`) and forwards up
  to 16.

### What still needs Core (diffs in open question 3)

- Core's feedback does not say what a `code:path` code means, or that the
  node's description names extra keys.
- Core's prompt implies a handle reference may carry only `location`.

## Scope extension: why reveal_safe refused the feed

This part is read only. `domain/src/runtime/llm-evidence/tools.ts:246`
refuses with `target_unsafe` whenever
`safeRevealElement` (`domain/src/runtime/llm-evidence/reveal.ts:17-27`)
returns false. The rule is an allowlist:

- an element whose selector, name or text contains a committing word
  (`reveal.ts:15`) is refused;
- otherwise only a view switch (role `tab`, `menuitem` or `treeitem`) or a
  disclosure is allowed. A disclosure is a `summary`, or a button or
  `role=button` or input button that carries `aria-expanded` or
  `aria-controls` (`semanticRevealKind`, `elements.ts:166-172`).

A feed post, a post link, or a "Load more" button without
`aria-expanded`/`aria-controls` is neither, so it is refused. That is by
design: loading more items changes the page, and reveal stays an
uncover-structure tool (`reports/w2-detect-repeating-structure-tool.md`,
"The optional bounded scroll/wait probe was not built").

Nothing needs to change for the feed task. The detection already reports
`pagination: "infinite_scroll"` and the handle keeps `{mode: "scroll"}`; the
reveal attempt was one wasted call.

## Commands run and observed results

Scratch mirror probes (a copy of `domain/` in my scratch directory, made
while edits were barred):

- **Current behaviour** (`probe-current.ts`, bundled with the domain's
  esbuild):
  - the catalog detection packet was 774 bytes;
  - `{handle}` resolved to 7 fields plus `paginate {next, maxPages: 3}`;
  - `{handle, fields}` resolved to `refused ["web.handle.malformed"]`;
  - a literal request was `unchanged`.
  - The old grammar was 575 characters.
- **Fail first.** I ran the new and updated tests against the original
  sources (`node run-selected.mjs before/domain extraction-slot.test.ts
  resolve-plan-node.test.ts catalog-text.test.ts`): 18 of 20 tests failed and
  2 passed. The core catalog row failed with actual
  `{ issueCodes: ['web.handle.malformed'], status: 'refused' }`, where
  `parameters.extractList.fields.name` etc. were expected.
- **Mirror, with the change:**
  - The five selected files: `# tests 42 / # pass 40 / # fail 2`. Both
    failures were `plan-node-identity.test.ts` rows now carrying position
    codes; I updated them.
  - Full suite, `DOMAIN_TEST_BUILD_LABEL=scrape-fields node scripts/test-domain.mjs`:
    exit 0, 624 tests, 624 pass, 0 fail.
  - `tsc -p tsconfig.json --noEmit`: first run
    `resolve-plan-node.ts(240,45): error TS2345` (a string passed as
    `WebAutomationActionType`). I fixed it with a type guard; after that,
    exit 0 for both `tsconfig.json` and `tsconfig.test.json`.
- **Negative probes** in the mirror, each restored and compared byte-identical
  with the repository file:
  - guard against guessed literals disabled: `# pass 16 # fail 2` (the guard
    row and the updated resolver row);
  - `@attr` ignored: `# pass 3 # fail 5`.

In the repository, after the campaign recorded `finishedAt`
2026-09-17T03:14:21.394Z:

- `pnpm --filter @fluxiq-web-extension/domain test`:
  - exit 0, `# tests 624 # pass 624 # fail 0 # cancelled 0`;
  - run again after the description change: the same result.
- `pnpm --filter @fluxiq-web-extension/domain check`: exit 0, twice.
- `node scripts/structure-audit.mjs`:
  - first run: exit 1, with the single failure
    `[working-docs] docs/working/README.md is out of date with the documents' header blocks`
    (a shared file I did not touch);
  - rerun after the supervisor's commits `7c763e5`/`5d96ba2`: exit 0,
    `structure-audit: passed (60 warning(s), 122 baselined)`, with no warning
    on any file I changed.
- **One live run.** This was authorised by the brief, and started before the
  coordinator withdrew live runs from this checkout. Command:

  ```
  FLUXIQ_TEST_ENV_FILES=none FLUXIQ_CORE_ROOT=F:/fxlab/lab-core npm_config_workspace_concurrency=1 pnpm lab run product-catalog --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task product-catalog-first-page --llm-max-calls 26 --llm-max-cost-usd 0.25 --llm-max-input-tokens 42000 --llm-max-output-tokens 8000 --llm-max-total-tokens 50000 --llm-max-run-tokens 600000
  ```

  This is the campaign's own command (from `pnpm lab:campaign ... --dry-run`)
  plus the campaign's recorded `labArgs`. The command exited 1, producing
  **`run-mu4yk4u1-60a1c3a4`**:
  - checkout `5d96ba2`, dirty with this change; Core `F:\fxlab\lab-core`
    `8409ca2`;
  - build: `proposed`, 2 provider calls (detect, inspect), 12,661 tokens,
    about $0.006;
  - Flow: start, then `web.dom.extract_list`, then `builtin.data.write-records`
    (4 nodes);
  - `web.dom.extract_list` **succeeded**;
  - extraction judged: expected 8, observed 8, fields 32/32 present,
    0 unexpected, 0 invalid rows, **0 matched**;
  - `builtin.data.write-records` failed with `record_output.invalid`
    (`graph_validation_or_unknown_node`), so the verdict was `failed`.
  - For comparison, `run-mu4wwkbc-df6cfe60` failed at the extraction itself:
    0 of 8 records observed, 0 fields, `output_not_observed`.

  I made no further live runs.

## Not verified

- **The reworded description has not run live** ("It saves its rows itself:
  no recordOutput or save node needed"). The live run above used the earlier
  wording.
- **Why the 8 records did not match.** The judge records counts, not values,
  so the `url` explanation is inference. It rests on: 32/32 fields present;
  name, price and rating read with the fixture's own selectors; and the
  absolute-URL behaviour of a `link` column (`field-reader.ts:82-91`).
- **Only the plain catalog task ran live.** The table, feed, all-pages,
  search and variant tasks, and the refusal paths, are covered only by domain
  tests over the real captured detections (`captured-detections.ts`), not by
  live runs.
- **Which placement the model actually wrote** in the five refused campaign
  runs is inference. Plans are not recorded.
- **Nothing was checked in a browser with the unpacked extension.** The
  content-script side did not change.
- **No test runs through Core.** Core's completion check forwarding the new
  position codes to the model rests on Core's code
  (`plan-parameter-resolution.ts:119-121`: codes matching
  `[a-z0-9_.:-]{1,100}`, up to 16) and on this repository's tests.
- **The test-runner tests were not run.** I read the ones that name handle
  codes (`refused-plan-issue-codes.test.ts`, `build-proposal.test.ts`); they
  use existing codes at unchanged positions.
- **Tracked test bundles changed.** The unlabelled
  `pnpm --filter @fluxiq-web-extension/domain test` (the brief's command)
  rewrote the tracked `domain/.test-build/`: 44 entries, including 2 new
  bundles and bundles of tests I did not edit that include modules I changed
  or modules other workers are editing. The supervisor should regenerate
  them at commit time rather than take them as they are.
- **Architecture docs were not updated.** The brief gave me only this report
  under `docs/`. `docs/architecture/` should gain the handle forms, the
  placement codes and the position codes.

## Open questions or contradictions found

1. **The expected `url` versus an absolute link** (this needs a decision on
   the Lab judge, `packages/test-runner`, not my files).
   - The catalog fixture expects the root-relative href, because the Lab
     port changes every run. A model asked for a `url` column most naturally
     keeps the detected `link` column, which reads
     `http://127.0.0.1:<port>/scenarios/product-catalog/products/<slug>`, and
     every record then mismatches.
   - The grammar offers both readings (a link column is the absolute URL;
     `@href` is the raw href), and I did not push the model toward the
     relative one. An absolute URL is the more useful answer on a real site,
     and it is what the recorder's own link column produces.
   - Recommendation: the Lab judge should treat an observed absolute URL on
     the run's scenario origin as equal to a root-relative expected value
     (resolve the expected value against the scenario origin before
     comparing). The `absolute-links` variant is unaffected, because its
     expected values are already absolute.
   - The alternative is rewording the instruction to "the link's address as
     the page writes it".
2. **The save node** (Core, record-output shape; another worker owns it).
   - The model added a `builtin.data.write-records` node whose record output
     passed plan validation but failed at run time as `record_output.invalid`.
   - The description change here should stop the extra node. Separately, a
     record output that plan validation accepts should not fail at run time;
     the Core worker should check why the two parsers disagreed for that node.
3. **Core diffs this change would like** (their owners' files; not applied).
   - A. `AS/runtime/llm/harness-options/bootstrap-completion.ts:55-57`, so the
     model knows how to read the new codes:

     ```diff
      const FEEDBACK_INSTRUCTION = "The completed plan was refused and nothing was created. Correct every listed issue and complete again. "
        + `Where a parameter needs something you observed, write {"${AUTOMATION_STUDIO_PLAN_NODE_HANDLE_KEY}": "<handle copied exactly from evidence>"} instead of writing a locator of your own; `
     -  + `if you explored more than one place, add "${AUTOMATION_STUDIO_PLAN_NODE_HANDLE_LOCATION_KEY}": "<the location the evidence reported for that handle>".`;
     +  + `if you explored more than one place, add "${AUTOMATION_STUDIO_PLAN_NODE_HANDLE_LOCATION_KEY}": "<the location the evidence reported for that handle>". `
     +  + "A code written <code>:<path> names where inside that node's parameters the issue is, with keys you chose given by their position; "
     +  + "a parameter's own description names any further keys it takes beside the handle.";
     ```

   - B. `AS/runtime/flow-bootstrap/plan/evidence-schema.ts:69`, so that
     `{handle, fields, paginate}` does not read as forbidden: insert
     `A parameter's description may name further keys to write beside the handle.`
     before `Never write a locator, path or query of your own.`
   - C. `domain/src/runtime/llm-evidence/tools.ts:205` (owned by the tools.ts
     worker; the domain token-budget test in `domain.test.ts` should be
     rerun). Append to the detection tool's description:
     `Write the list into the extraction node as extractList: {handle, fields?: {yourKey: "fieldKey" | "fieldKey@attr"}, paginate?: false}.`
4. **Core's no-progress guard** (`AS/runtime/llm/evidence-loop.ts:158-178`).
   - It ends a build after repeated unusable decisions with an already-seen
     issue set. Position codes make a changed placement a new set, which helps
     a model that is correcting itself.
   - `run-mu4x5m2p-a4a4a29d` ended on misplaced, misplaced, malformed, whose
     last set was new. The Core worker may want to confirm the guard counted
     that as intended.
5. **Literal guard scope.**
   - `web.handle.extraction_required` applies to any literal `extractList`
     after a detection in the same project and Flow, and forgets after 256
     let-go handles. A future repair or "extend this Flow" path that sends an
     existing recorded extraction node through this resolver would need to
     keep that node out of it.
   - A literal field object carrying a `handle` this domain did not issue is
     now `malformed` with a position. Before, Core refused it as
     `bootstrap.handle_unresolved`.
