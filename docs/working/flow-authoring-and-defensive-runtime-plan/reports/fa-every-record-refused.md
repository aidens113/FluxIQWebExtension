# t111 — every record refused

Task branch `task/t111-every-record-refused`, worktrees `F:/fxwork/t111/!FluxIQWebExtension`
and `F:/fxwork/t111/!FluxIQ`. Run under post-mortem: `test-runs/run-mueqynzb-ac54aab9`
(campaign `fresh-r7-everything-store`, task `everything-store-first-page-plus-earbuds`,
`deepseek-flash`, 24 provider calls, $0.0319, 321 s).

## Outcome

Done. The cause is found, proved model-free against the live fixture, and fixed in
both repositories. No Lab run, campaign or provider call was launched.

**The extraction was right. The schema the rows were stored under was not.** The
Flow read the store's search results, produced exactly the sixteen rows the task
expected, and Core's record validation refused all sixteen because the record
schema declared on the node typed columns the page can only ever hand back as
text. Nothing anywhere checked the declared schema against what the extraction
can actually produce, and the refusal's reason was thrown away, which is why the
run says only "16 rows were refused".

This is **not** a regression from t095 or t096. Both were tested directly and
both are clean; see question 2.

---

## 1. What `core.result.every_record_refused` means, and what refused the records

**Where it is raised.** `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/core-observation.ts`,
`automationStudioResultCoreObservation`. It is pure arithmetic over the run's
dataset summaries, with no model involved:

```ts
if (summary.recordSetCount === 0) return undefined;
if (summary.totalRecordCount > 0) return ... ;
if (summary.totalRefusedCount > 0) return refused({ code: codes.everyRecordRefused, ... });
```

So the code means exactly: **at least one record set exists, it stored zero rows,
and at least one row was refused.** The run's own failure record says
`"16 rows were refused, 0 stored, across 1 record set."`
(`snapshots/flow-lane.json` → `failure.actual`), and the lane's extraction step
carries `invalidRows: 16`, `datasetPages: 1`, `storeTruncated: false`.

**What refused them.** `totalRefusedCount` is the sum of each dataset summary's
`invalidCount` (`result-verification/result-summary.ts:79`), which the run dataset
store copies from the capture batch (`storage/project/run-dataset-store.ts:154,199`),
which comes from `validated.invalidCount` in
`runtime/executor/record-capture.ts` → `validateAutomationStudioRecords`
(`packages/contracts/src/record-sets/validate-records.ts`).

That function copies each row field by field against the record schema and
refuses the whole row on any of five codes: `records.row_not_object`,
`records.required_missing`, `records.invalid_value`, `records.row_too_large`,
`records.invalid_row`. **This happens at capture, before storage** — the rows
existed, reached Core, and were discarded there. The node was told nothing: the
capture returned `status: "success"` with an empty row array.

**Which of the five fired: `records.invalid_value`.** The page's extract verb
returns `Record<string, string | null>` and nothing else
(`apps/extension/src/content/extraction/list-reader.ts`,
`field-reader.ts`). A schema field typed `number`, `boolean` or `datetime` can
therefore never be satisfied by any row, and `copyCell` refuses the row. The
other four are ruled out below.

- `records.required_missing` cannot fire without the action failing first. A
  required field the page cannot read is omitted from the record **and** added to
  `missingFields`; a non-empty `missingFields` makes the verb's validation
  `failed` (`content/actions/extract-list.ts`, `validationFor`), and a failed
  validation is not a successful action — it becomes `OUTPUT_NOT_OBSERVED`
  (`content/action-runtime/results.ts`, `domain/src/runtime/failure/classify.ts:89`).
  The run's extraction action **succeeded**, so no required field was missing.
- `records.row_too_large` needs a 64 KiB row; `records.row_not_object` needs
  non-object rows; `records.invalid_row` needs `copyRow` to throw. None is
  reachable from a four-column text extraction.

**Where the contradictory schema comes from.** `web.dom.extract_list` derives a
correct record output from its own field map when its author set none
(`domain/src/output-nodes/extract-list/derived-record-output.ts`), but
`dispatch.ts` preferred an **authored** `recordOutput` outright. And Core's Flow
Bootstrap actively teaches a model to write one:

- `flow-bootstrap/plan/record-output-contract.ts` puts the whole record-set
  contract into the catalog entry for this parameter, listing the value types it
  may pick from — `string|number|boolean|url|datetime|json` — and supplies a
  worked example `{datasetId: "items", schema: {schemaVersion: "0.1", fields:
  [{id: "name", label: "Name", valueType: "string"}]}, writeMode: "append"}`.
  Its own header records that "Live Flow creations were refused three times in a
  row for record-output keys the parser does not take", so models demonstrably
  write this parameter.
- `flow-bootstrap/authoring/matching.ts` additionally maps the words `dataset`,
  `records` and `save` onto `recordOutput`.

The instruction was *"…into a table with columns name, price, rating and url."*
A model shown that parameter and that example types price and rating as numbers,
exactly as a person would. `parseAutomationStudioRecordOutput` accepts `number`,
so the plan is valid and the node runs; the page then hands back `"$79.99"` and
`"3.7"`, and every row dies at `copyCell`.

The run's own Flow could not be re-read (an isolated run's `.work` storage is
removed on completion, and `test-runs/.work` holds only three older runs), so the
authored schema is reconstructed from the mechanism rather than quoted. What is
quoted is the arithmetic — 16 found, 16 refused, 0 stored, action succeeded, no
missing fields — and only a schema/row type mismatch produces that combination.
The fix closes the id-mismatch shape as well, so it does not depend on which of
the two the model wrote.

## 2. The leading hypothesis (t095 value shapes, t096 required fields): **disproved**

Tested directly against the live fixture, model-free, in the content harness.

`required` on a proposed field is `coverage >= 1` — the share of the *same run of
items the read will use* that the field resolves in
(`apps/extension/src/content/extraction/infer-fields.ts`, `proposedFieldSpec`).
The page reader and the derived record schema then default `required` identically
(`required !== false`, in `content/extraction/field-spec.ts` and
`domain/src/output-nodes/extract-list/record-output.ts`). So a required field the
page cannot read is reported by the action as missing and fails it, rather than
reaching Core as a refusal. The derived path cannot produce this failure.

Measured, on `/scenarios/everything-store/s?k=wireless+earbuds&rh=plus`:

- the detection's own proposal, every non-excluded column (24 fields), read
  **20 records**; Core's `validateAutomationStudioRecords` kept **20**, refused
  **0**, issues `[]`;
- a four-column plan renamed `name/price/rating/url` with a `where` leaving the
  sponsored cards out read **16 records**; Core kept **16**, refused **0**,
  issues `[]`.

t095's value-shape work is also what makes the rating read `3.7` rather than
`3.7 out of 5 stars`, and t096's `where` is what turns 20 items into the 16 rows
the task expects. Both are load-bearing for the correct answer here and neither
is touched by the fix.

## 3. One `extract_list` node, two `extract_list` attempts

Not a retry, not pagination, and not an uncounted node. Both entries carry the
**same** `nodeId` (`node.bootstrap.17655c00b52d909b.main.s11`) at `attemptIndex`
13 and 14; the second carries no `retry` block (the three click retries do) and
its failure is `stage: "verification"`.

The second is a **synthetic attempt Core builds after the run finished**, so the
recovery ladder — which is keyed on a failed attempt and answers `stop` when
there is none — has something to repair:
`runtime/recovery/refuted-result/attempt.ts`,
`automationStudioRefutedResultAttempt`, attempt id
`result-verification.<runId>`. It names "the node the result came out of", which
is the last attempt that stored records or else the last that succeeded — the
extraction node. Its `startedAt` is that attempt's `finishedAt` and its
`finishedAt` is the verification's own clock, which is why it reads as
1,139 ms starting at exactly 23:45:29.077, the instant the real read ended.

It emptied nothing. The facility renders it as an action only because
`packages/test-runner/src/flow-lane/persisted-flow-run.ts` builds its `actions`
list from the run detail's attempts.

## 4. The three failed clicks

All three are absorbed, and none is why the extraction found nothing.

`snapshots/flow-lane.json` → `recoveredFailures` lists exactly three records, and
they are exactly these three clicks:

- two on node `…main.s2`, attempts 1 and 2, `web.target.not_found` /
  `target_resolution`, "nothing matched; 6 control(s) of the same family are on
  the page; best scored -0.12" — attempt 3 on the same node succeeded under
  `rung: "retry_node"`, and a `merge` follows;
- one on the store's browser check, `[data-testid="soft-check"] > button`,
  refused because the button still read "Checking your browser…" — the next click
  succeeded and a `merge` follows.

`recoveredByNode` in `persisted-flow-run.ts` is what classes them as recovered, so
the run did not report any of them as its failure. The page they left the Flow on
was the right one: `ownPage.reached: true`, and the extraction then read exactly
16 rows — the number the expectation asks for — with `validation.status` passing
and every declared field present.

---

## The fix

### A. `web.dom.extract_list` holds an authored record output to the columns it reads

New `domain/src/output-nodes/extract-list/reconciled-record-output.ts`, wired into
`dispatch.ts` and the directory barrel.

An authored `recordOutput` keeps everything its author wrote — `datasetId`,
`label`, `writeMode`, `maxRecords`, and each column's `label` — and has two things
replaced, because only the extraction can know them:

- **the schema's fields**, rebuilt from the request's field map through the same
  `webAutomationRecordOutput` a recording uses: which columns exist, what each
  reads, its `valueType`, its `required` (coverage-measured) and its `handling`;
- **`recordsPath`**, always the node's own (CD19).

Deliberately minimal, so every existing refusal survives: the reconciled value is
the author's object with two keys replaced, so a record output carrying a key the
record-set parser does not take is still refused at dispatch with
`record_output.invalid`, before the page is read. A value that is not an object is
handed through untouched for the same parse to refuse. A recording's own record
output is byte-identical afterwards but for the records path the dispatch always
supplied — it is built from this very request and the user's own column names
(`domain/src/web-panel-host.ts`), so a recorded Flow is unchanged.

### B. Core fails a capture that finds rows and can store none of them

`packages/fluxiq/src/programs/automation-studio/runtime/executor/record-capture.ts`.
When `validated.rows.length === 0 && validated.invalidCount > 0`, both capture
paths now return a failed node result instead of success over an empty dataset:

```
category: "output_not_observed", code: "record_output.records_refused",
retryable: false, stage: "dispatch",
expected: "records the Flow's own record schema can store.",
actual:   "16 records were refused and none stored (records.invalid_value)."
```

The validation's issue codes are in hand at that point and are carried in both the
failure record and `outputs.error`. This is the half that turns the run this task
investigated into a one-line diagnosis: the failure lands **at the node that
produced the rows, with the reason**, and the recovery ladder gets a real failed
attempt there instead of a synthetic one at verification time.

**Behaviour change to note:** a run with two record sets where one stores rows and
another refuses all of its own used to pass (`every_record_refused` only fires
when the whole run stored nothing). It now fails at that node. That is intended —
a node that found rows and kept none is broken whatever another node did — but it
is a widening of when a run fails.

### C. Core exports `validateAutomationStudioRecords` from `fluxiq/automation-studio/nodes`

So a downstream domain that produces rows can check them against the schema it
means to declare, with the function the capture will validate them with rather
than a reading of the rules. Types `AutomationStudioRecordValidationOptions` and
`AutomationStudioRecordValidationResult` go with it. This is what lets the new
harness row below assert refusal and acceptance with Core's own code.

---

## Validation, with observed output

Everything below was run in the two t111 worktrees. No Lab run, campaign or
provider call.

**1. Model-free in the content harness, against the everything-store fixture,
with the fixture untouched.** New permanent row
`apps/extension/e2e/content/tests/extraction/tests/record-output-schema.spec.ts`
detects the store's search results, builds the four-column plan the instruction
asks for with the sponsored cards left out, attaches the record output a model
writes (price and rating typed `number`), dispatches it through
`webAutomationExtractListDispatch`, runs the read, and puts the rows through
Core's own validator both ways. Observed, printed during the diagnostic run:

```
t111 observed: page 20 items (4 sponsored); read 16 records;
               authored schema kept 0, refused 16 (records.invalid_value)
t111 observed: the node's record output kept 16, refused 0
```

That is the live failure reproduced exactly — 16 refused, 0 stored — and the fix
storing all 16, with the dataset still named `products` and the columns still
labelled `Name, Price, Rating, URL`.

```
pnpm --filter @fluxiq-web-extension/extension test:content -- record-output-schema
  2 passed (24.5s)
```

**2. The whole extraction content suite** (the harness rows t095/t096 landed,
which is where a regression would show):

```
pnpm --filter @fluxiq-web-extension/extension test:content -- extraction --workers=2
  62 passed (2.1m)
```

**3. Unit suites.**

```
node domain/scripts/test-domain.mjs
  # tests 779  # pass 779  # fail 0
```
(new file `domain/src/output-nodes/extract-list/tests/reconciled-record-output.test.ts`,
8 rows, including one that asserts the authored schema alone refuses every row
with `records.invalid_value`, so the fix cannot be removed without the reason
coming back.)

```
pnpm --filter @fluxiq-web-extension/extension test
  # tests 740  # pass 740  # fail 0
```

Core, run singly as the machine requires (`--maxWorkers=1` crashes tinypool here
with `options.minThreads and options.maxThreads must not conflict`, so it was
omitted):

```
npx vitest run .../runtime/executor .../runtime/result-verification \
  .../runtime/recovery/refuted-result .../nodes packages/contracts/src/record-sets
  Test Files 36 passed (36)   Tests 395 passed (395)

npx vitest run .../runtime/flow-bootstrap
  Test Files 17 passed (17)   Tests 224 passed (224)
```

**4. `pnpm check` in both worktrees, exit 0.**

```
F:/fxwork/t111/!FluxIQWebExtension  pnpm check → EXIT=0, structure-audit: passed (99 warning(s), 121 baselined), 10 packages "check: Done"
F:/fxwork/t111/!FluxIQ              pnpm check → EXIT=0, structure-audit: passed (179 warning(s), 360 baselined), 4 packages "check: Done"
```

Core's `packages/contracts` and `packages/fluxiq` were rebuilt
(`pnpm --filter @fluxiq/contracts build`, `pnpm --filter fluxiq build`) so the
extension worktree resolves the new export; both completed without output.

## Not verified

- **No live run.** The fix is proved at the seam that failed — the page's rows
  through Core's validator — not end to end through a built Flow with a provider.
  The supervisor owns the live runs.
- **The live Flow's authored `recordOutput` was never read.** The isolated run's
  Core storage is removed when the run completes and nothing in the bundle
  carries node parameters, so the mechanism is established from the arithmetic
  and the code rather than quoted from the Flow. The fix covers both shapes that
  produce that arithmetic (a type the page cannot produce, and field ids the
  extraction does not read), so it does not turn on which one it was.
- `pnpm build` was not run in either repository; `pnpm check` and the extension's
  own `check-extension.mjs` were.
- Core's full suite was not run — only the suites touching capture, result
  verification, refuted-result recovery, nodes, record-set contracts and flow
  bootstrap.
- Nothing was committed or pushed.

## What Core's paired working document should record

1. **A new failure code.** `record_output.records_refused` —
   `output_not_observed`, `retryable: false`, `stage: "dispatch"` — raised by
   `runtime/executor/record-capture.ts` on both capture paths when a capture
   finds rows and its record schema refuses every one of them. It carries the
   validation's issue codes in `actual` and in `outputs.error.issues`.
2. **A widening of when a run fails**, as described under B above: a single
   fully-refused record set now fails its node even when another record set
   stored rows, where before only a run that stored nothing anywhere reached
   `core.result.every_record_refused`.
3. **A new public export** on `fluxiq/automation-studio/nodes`:
   `validateAutomationStudioRecords`, plus its two types. It is the seam a
   downstream domain needs to keep a declared schema and the rows it produces in
   agreement.
4. **A note against `flow-bootstrap/plan/record-output-contract.ts`.** Core
   teaches a model to declare a record schema for nodes that already derive a
   correct one, and offers value types (`number`, `boolean`, `datetime`) that a
   page-reading output can never satisfy. The downstream node now defends itself,
   but the catalog text is the upstream reason a model writes a schema at all for
   a node whose own description says "It saves its rows itself: no recordOutput
   or save node needed". Worth considering whether that parameter should be
   offered to a model for an output whose `metadata.recordsPath` says it derives
   its own — or whether the contract text should say which value types the
   producing domain can actually return.
