# X5.3 — the extraction intent seam (recording lane)

## Outcome

Done, for the part of X5.3 inside `packages/test-runner/src/scenario-steps/`.
The translator, the driver and the step-runner option are built, tested and
validated. The rest of X5.3 — `run-scenario.ts`, `run-evaluation/`,
`flow-lane/lane-observation.ts`, `bench/evaluate-run.ts` — was outside this
brief's owned paths and is untouched.

## What changed and why

### New `scenario-steps/extract-intent.ts` (287 lines)

`scenarioExtractionDefinition(step, nonce = "lab")` translates one `extract`
step into a `WebAutomationRecordedListExtraction`, the domain's own shape:

| Runner grammar | Definition |
| --- | --- |
| `target: "testid:X"` | `request.item` = `[data-testid="X"]` |
| raw target | `request.item` = that CSS, verbatim |
| field `"testid:X"` | `{ kind: "text", selector: '[data-testid="X"]', handling: "include" }` |
| field `"sel@attr"` | `{ kind: "attribute", selector, attribute: "attr", handling: "include" }` |
| field `"@attr"` | `{ kind: "attribute", attribute, handling: "include" }` — the item itself, no selector |
| field `"column:H"` | `{ kind: "column", header: "H", handling: "include" }` |
| `pagination` (no mode, or `next`) | `paginate: { mode: "next", next: <css>, maxPages }` |
| `pagination.mode: "loadMore"` | `paginate: { mode: "loadMore", control: <css>, maxPages }` |
| `pagination.mode: "scroll"` | `paginate: { mode: "scroll", maxScrolls }` |
| `pagination.mode: "numbered"` | `paginate: { mode: "numbered", pages: <css>, maxPages }` |
| `minItems` | `request.minItems`, copied; absent when the step names none |
| field name | the **record key**, verbatim, and its own `fieldLabels` entry |

Every selector goes through `parse-target.ts` then `css-selector.ts`, so the
seam and `extract-records.ts` cannot read the grammar differently.

`createExtractionIntentDriver(extensionControlPage, { newNonce? })` follows
`scripted-navigation.ts:22-34,88-90`: the factory binds the control page once
and returns the per-step function. It sends exactly one
`{ type: "fluxiq.test.defineExtraction", definition }` through
`chrome.runtime.sendMessage` evaluated **on the control page**, which is the
only sender `background/extraction/control.ts` accepts for that message. The
origin restriction was not weakened or worked around.

Four judgement calls, each written into the module comment:

1. **No `timeoutMs` is sent.** `confirmExtraction` otherwise bounds the read
   with `webAutomationExtractListTimeoutMs(request)`, a budget scaled by the
   pages the request may read; the same file records that a flat ceiling there
   once truncated any read past six pages. A step's `timeoutMs` is the
   fixture's bound on a Playwright action, and forwarding it would let the
   harness decide how long the product may take.
2. **Field keys are the runner's field names, verbatim** — not passed through
   `webAutomationExtractionFieldKey`, which lower-cases (`imageAlt` →
   `imagealt`). The name is what `expected.extracted` names its columns, what
   the definition carries into Core's dataset schema, and what the Flow lane
   compares against; deriving a different key would mis-align all three
   silently. A name the domain will not take as a key comes back as
   `invalid_definition` and is reported against the step, rather than being
   judged a second time by a copy of the domain's rule kept in the runner.
3. **No field declares `required`.** The domain's optional reading returns
   `null` for a value the page cannot find (`content/extraction/field-reader.ts:42`).
   That is exactly what `ExpectedExtraction.records` already spells with
   `null` — `product-catalog`'s `cardRecords` and `imageRecords` both do — and
   `optionalFields` lives on the expectation, not on the step. Note this is a
   real behavioural difference from `extract-records.ts`, which **omits** an
   unread field rather than reporting `null`.
4. **`itemCount: 0`.** The Lab defines the extraction before anything has been
   read, so no count has been observed; the count the run yields is what the
   measurement judges.

A `role:` or `frame:` target throws `fixture.invalid` rather than falling back
to reading the page some other way. An extraction request carries one CSS
selector in the main document and cannot express either, so a Flow built from
the recording could not repeat the read.

Refusal codes are classified into the facility taxonomy:
`invalid_definition` → `fixture.invalid`; `page_refused` → `action.dispatch`;
`run_failed` → `runtime.behavior` (FluxIQ's extraction failing is what the run
is measuring, so it fails the run rather than excusing it); `not_recording` →
`recording.persistence`; anything else → `extension.worker`.

Records are read defensively: a `string` or `null` value is kept, anything else
is counted into `nonStringValues` and dropped, as `flow-lane/persisted-flow-run.ts:400`
counts its own. `null` is **not** counted, because it is the answer an optional
field gives.

### `scenario-steps/step-runner.ts`

- New option `extractionIntent?: ExtractionIntentDriver`.
- `case "extract"` uses it when present and `extractRecords` otherwise, so
  `extract-records.ts` stays the reference reader for runs with no extension.
- `ScenarioStepResult.extracted` widened from `ExtractedRecord[]`
  (`Record<string, string>`) to `ExtractionRecord[]`
  (`Record<string, string | null>`), because FluxIQ reports an unread optional
  field as `null`. `run-scenario.ts:310` still compiles: `assertExtraction`
  already takes `readonly ExtractionRecord[]`.
- New `ScenarioStepResult.observed?: ObservedExtraction`, carrying `pagesRead`,
  `truncated`, `durationMs` and `nonStringValues` so the caller that wires
  `run-scenario.ts` can hand the whole thing to `measureExtraction`.

Both changes are additive: with no `extractionIntent` the runner behaves
exactly as before.

### `scenario-steps/index.ts`

Barrel gains `export * from "./extract-intent.js";`.

### Tests

- New `scenario-steps/tests/extract-intent.test.ts`, 20 rows: one per grammar
  form (testid item, raw CSS item, testid field, `sel@attr`, bare `@attr`,
  `column:`), one per pagination mode plus an explicit `next`, `minItems`
  present and absent, the dataset id, the refusal of `role:` and `frame:`
  targets, a step with no fields, the message the driver sends, per-call
  nonces, `null` kept and non-strings counted, unreported observations left out
  rather than invented, each refusal code's category, and three malformed
  answers.
- `scenario-steps/tests/step-runner.test.ts` gains "with the extraction seam
  present the runner reads nothing off the page itself": the fake page logs
  every locator it is asked for, and the log is asserted empty.

## Commands run and observed results

`pnpm --filter @fluxiq-web-extension/test-runner test` (build + `node --test dist/**/*.test.js`):

```
1..851
# tests 887
# suites 0
# pass 887
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 52253.6229
```

`pnpm --filter @fluxiq-web-extension/test-runner check` (`tsc --noEmit`): exit 0,
no diagnostics printed.

`node scripts/structure-audit.mjs`:

```
structure-audit: passed (56 warning(s), 17 baselined).
```

Same counts as the pre-change baseline taken at the start of this task, so no
new finding. The audit did fail once mid-work —
`[imports] packages/test-runner/src/scenario-steps/step-runner.ts: 1 import(s)
reach into another directory's files instead of its barrel, e.g.
"../run-expectations/extraction.js" at line 5` — and both new imports were
moved to `../run-expectations/index.js`, after which it passed.

The two new files alone:

```
node --test packages/test-runner/dist/scenario-steps/tests/extract-intent.test.js
# tests 20 / # pass 20 / # fail 0

node --test packages/test-runner/dist/scenario-steps/tests/step-runner.test.js
# tests 5 / # pass 5 / # fail 0
```

No failure occurred at any point in these suites, so no lone rerun for a
load-related timeout was needed.

### Mutation probes (each applied, observed, then reverted)

| Mutation | Observed |
| --- | --- |
| `case "extract"` always calls `extractRecords`, ignoring the seam | `not ok 4 - with the extraction seam present the runner reads nothing off the page itself`; 4 pass, 1 fail |
| field key derived as `name.toLowerCase()` instead of verbatim | `not ok 1 - a testid target and a testid field become CSS selectors, and the field names are the keys` and `not ok 5`; 18 pass, 2 fail |

The second probe was run twice. The first time only row 5 failed, because
row 1's fixture fields were all lower-case; row 1's fields were changed to
include a mixed-case `imageAlt` so the verbatim-key clause is genuinely pinned,
and the probe was repeated to confirm it now fails.

Working tree after the work, limited to owned paths:

```
 M packages/test-runner/src/scenario-steps/index.ts
 M packages/test-runner/src/scenario-steps/step-runner.ts
 M packages/test-runner/src/scenario-steps/tests/step-runner.test.ts
?? packages/test-runner/src/scenario-steps/extract-intent.ts
?? packages/test-runner/src/scenario-steps/tests/extract-intent.test.ts
```

Nothing under `apps/extension/`, `domain/` or `packages/test-contracts/` was
edited. (`domain/src/...` shows as modified in `git status` — that is another
worker's in-flight change, not mine.) Nothing was committed or pushed, and no
working document was edited.

## Not verified

- **No live browser run.** The seam has never spoken to a real extension. Every
  test drives it against a fake control page, so the wire shape is checked
  against `background/extraction/control.ts` as read, not as run. The spec's
  live acceptance (`pnpm lab run product-catalog`, then
  `--workflow paginated-extraction`) cannot happen until `run-scenario.ts`
  passes `extractionIntent`, which is outside this brief.
- **`domain/dist` is stale relative to `domain/src`.** The test-runner's
  `domain:dist` script never rebuilds an existing `dist`, and today's `dist`
  predates the value re-exports added to `domain/src/actions/types.ts`
  (`isWebAutomationExtractFieldKey`, `webAutomationRecordedExtraction`,
  `webAutomationExtractListRequestValue`, `webAutomationExtractListTimeoutMs`
  are all absent from `domain/dist/actions/types.d.ts`). This module therefore
  imports only `webAutomationDatasetId` and four types, all of which the
  current `dist` does carry. I did not rebuild the domain: its build runs
  `clean-dist` before `tsc`, so a failure would leave every package unable to
  resolve the domain while another worker has `domain/src` open.
- **`nonStringValues` semantics against a real read.** The count excludes
  `null`, which is a deliberate difference from `flow-lane/persisted-flow-run.ts`
  (which counts and drops `null`). Nothing has yet observed what the page
  actually sends for an unread field on the wire.
- **Which tab the extension extracts from.** The driver accepts the scenario
  page and does not use it; `defineForTest` reads `manager.status().activeTabId`.
  Whether that tracks the Lab's active tab after a `switchTab` step is
  unverified, and would matter for any multi-tab extract fixture.

## Open questions or contradictions found

1. **`frame:` targets are refused, but X5.4 plans an iframe extract workflow.**
   The plan's X5.4 says iframe-checkout gets `extract-order-lines` "from the
   same-origin frame. The intent carries the frame." `WebAutomationExtractListRequest`
   has no frame member today, and `cssSelectorForTarget` returns nothing for a
   frame target, so the translator refuses it as `fixture.invalid`. Either the
   request gains a frame, or that fixture uses a main-document target. This
   needs a decision before X5.4's iframe workflow is written.
2. **The reference reader and the seam disagree on an unread field.**
   `extract-records.ts` omits the key; the seam reports `null`. The fixtures
   already spell `null` (`product-catalog`'s `cardRecords`), so the
   expectations are written for the seam — meaning any workflow judged on the
   reference reader with a `null` in its expectation would fail. Worth a
   deliberate check when `run-scenario.ts` is wired.
3. **Dataset id nonce.** The default is the literal `"lab"`, so a definition is
   deterministic and a bench diff is readable. Step ids are distinct within a
   recording, so ids do not collide within one run; across runs the same id
   recurs, which is safe only because each Lab run is its own recording and
   Core run. `newNonce` is exposed if that assumption ever stops holding.
4. **The prefix-target question the plan raised is moot.** X5.4 asked whether
   the translator needs a `testid:` prefix form for `numbered-pages`.
   `product-catalog/manifest.ts:38` already uses a raw
   `[data-testid^="pagination-page-"]` CSS target, which passes through
   untouched. No new grammar is needed and none was added.
