# t132 — Publish the extraction's own summary into the run record

## Outcome

Done, with one boundary crossing the supervisor must decide about and one
correction to the brief's premise.

The extraction's own summary now reaches `snapshots/flow-lane.json` twice: on
each extract attempt in `actions[]`, and on each judged step in
`extraction.steps[]` beside the oracle's comparison. Carried: `listPresence`,
the condition report (`applied`, `kept`, `rejected[]` per condition,
`unfiltered`), `missingFields`, `fieldNames`, `recordCount`, `pagesRead` and
`truncated`.

**It required a FluxIQ Core change.** The brief said "the domain's summary
travels on the node's result", which is true, and assumed it therefore reached
the Lab. It did not. Core's run detail deliberately reduces an attempt's
outputs to names and counts (`attemptOutputShape` in
`runtime/service/summaries/conversions.ts`), so `metadata` carried
`recordCount` and nothing else about a read. No reader in this repository could
have found the summary, because nothing in this repository was ever sent it.
I added the projection in Core, exactly as `host-target-resolution.ts` beside
it was added for the same defect on a different record.

**Core is not rebuilt** (the brief forbade it — a live run was in flight), so
the new `metadata.extraction` will not appear in a real run until
`pnpm --filter fluxiq build` is run in `F:\!FluxIQ` and the panel restarted.
Nothing in `apps/extension` or `domain` changed, so neither needs rebuilding.

## Two fields the brief named that do not exist

- **`filtered`** is not on the wire summary. It exists on the content script's
  internal outcome (`readSummary` in `content/actions/extract-list.ts`) and was
  never sent. It is derivable from what is now published:
  `conditions.applied - conditions.kept`.
- **`timedOut`** is not on the extraction summary at all — that member belongs
  to `domain/src/runtime/expectation/evaluate.ts`, a different record. The
  read's own timeout is expressed as `listPresence: "never_appeared"`: the wait
  for the list ran out, the read went ahead anyway and succeeded with zero
  records. That is the fact the brief wanted, under a different name.

## The field-name question, confirmed

The brief asked me to confirm that field names are already published elsewhere
before including them. **They are — but not as the brief described them.**

They are *not* the fixture's vocabulary. For an instruction-built Flow they are
the column keys **the model chose**. What makes them safe is that
`snapshots/flow-lane.json` already publishes every one of them in full, in the
same file, under `authoredNodes[].parameters.extractList.fields` — screened by
Core's own parameter screen. In `run-muhrf6c4-9714939f` those keys are `name`,
`price`, `rating`, `url`, and both extract nodes' full field maps are published
there today. `missingFields` names a subset of what is already in the bundle,
so it introduces no new class of string.

The shape is also its own boundary: a field key is 1–100 characters of
`A-Z a-z 0-9 _ -`, so it admits no space and therefore no page text, no
selector, no URL and no sentence. Both the Core projection and the Lab reader
re-check that pattern, Core's reserved ids, and a 200-key ceiling, and drop the
whole summary on any violation. A declared secret that happened to be
field-key-shaped would still be caught by `redaction-attestation`, which is the
backstop for exactly that.

## What changed and why

### FluxIQ Core (`F:\!FluxIQ`) — the projection that was missing

- **`packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/extraction-summary.ts`** (new).
  `extractionSummaryFromOutputs(outputs)` rebuilds the summary member by member
  from `outputs.result.extraction` or `outputs.result.result.extraction` — both
  depths, because a runtime-dispatched output puts the action result straight on
  `outputs.result` while the domain's gateway dispatcher wraps it as
  `{ status, message, result }`. Reading only the first shape is the documented
  reason the host target resolution was absent from every real run while its
  unit tests passed. The domain's real path is the second: `adapter.ts` sets
  `runtimeResult.payload = { status, message, result: actionResult }`.
  Admitted whole or not at all, matching the producer's own rule.
- **`.../summaries/conversions.ts`** — `metadata.extraction` beside
  `metadata.recordCount`.
- **`.../summaries/index.ts`** — barrel export.
- **`.../summaries/tests/extraction-summary.test.ts`** (new) — 11 tests,
  including three end to end through `runtimeSessionToFlowRunDetail`.

### `packages/test-contracts` — the published contract

- **`src/extraction-read/read.ts`** (new): `RunExtractionRead`,
  `RunExtractionConditionReport`, `RUN_EXTRACTION_LIST_PRESENCE`,
  `RUN_EXTRACTION_READ_BOUNDS`.
- **`src/extraction-read/validation.ts`** (new): `validateRunExtractionRead`,
  `isRunExtractionFieldKey`.
- **`src/extraction-read/index.ts`** (new) + `src/index.ts` export.
  The pair went into its own directory because `packages/test-contracts/src`
  was already at the audit's 25-file limit and two loose files failed
  `directory-files`. A shared filename prefix becoming a directory is the
  repository's own rule.
- **`tests/extraction-read.test.mjs`** (new) — 6 tests.

### `packages/test-runner/src/flow-lane` — the reader and the publication

- **`extraction-read.ts`** (new): `extractionReadOf(attempt)` reads
  `metadata.extraction`, rebuilds it member by member and puts the result
  through the published contract's own validator before returning it;
  `extractionReadsByNode(actions)` groups reads per node. It **refuses**
  (returns `undefined`) rather than throwing the way `harness-recovery.ts`
  does: the recovery record is the measurement there, and here an unreadable
  summary must not cost a run that otherwise says what it did. Absent stays
  absent — no empty record is ever fabricated.
- **`persisted-flow-run.ts`**: `PersistedFlowRunAction.extraction`, set from
  the reader.
- **`expectations.ts`**: `FlowExtractionStep.reads`, and a new optional
  `readsByNode` input. A step's reads are found through its dataset's
  `nodeIds`, because the dataset is what names the nodes that wrote to it.
- **`run-flow-lane.ts`**: `flowActionsSnapshot` publishes `extraction` per
  attempt; `flowExtractionSnapshot` publishes `reads` per step.
- **`creation/judgement.ts`**: passes `readsByNode` (the creation lane shares
  both snapshot builders).
- **`index.ts`**: barrel export.
- **`tests/extraction-read.test.ts`** (new) — 10 tests.
- **`tests/run-flow-lane.test.ts`**: one hand-built fixture and one expected
  snapshot gained `reads: []`.

### Documentation

- **`docs/architecture/testing-facility.md`**: the `extraction` block and the
  per-attempt list now mention the new members, and a new section, *What a list
  read says about itself*, states the three causes, the path from the domain
  through Core's projection to the bundle, and the boundary.

## Why it is published in two places

Per step is what the brief asked for and is where it sits beside the oracle.
Per attempt is the safety net, and this run proves it is needed: the Flow held
**two** extract nodes for **one** judged step, so one read was paired with no
step at all. A step-only publication would have recorded nothing about the node
that actually did the work. A step also finds its reads through its dataset, so
a step with no dataset would otherwise have no reads; the attempt list has them
regardless.

## Second finding: the unpaired dataset held the answer

**Yes — the unpaired dataset held rows, and the judged step read the wrong
dataset.**

Evidence, all from `test-runs/run-muhrf6c4-9714939f/`:

1. Core's own result verification, on the last attempt in
   `snapshots/flow-lane.json`: *"8 records stored, across 2 record sets"*. The
   run stored eight rows.
2. The judged step measured `observedRecords: 0` over a dataset with
   `datasetPages: 1, invalidRows: 0`. With 8 rows across 2 sets and the paired
   set holding 0, **the unpaired set held all 8**.
3. Which node wrote the paired dataset is provable from the durations.
   `evaluation.json` gives the judged step `durationMs: 3117`, which
   `observedExtraction` computes by summing `durationsByNode` over the paired
   dataset's `nodeIds`. Node `…main.s10`'s attempts are 2109 ms + 1008 ms =
   **3117 ms**. Node `…main.s9`'s single attempt is 14258 ms. So the judged
   step was scored against **s10**'s dataset, and s9's was the unpaired one.
4. `authoredNodes` says what each node was told to do. **s9 authored four
   `where` conditions** — including `atLeast: 4` and `lessThan: 50` — which are
   the qualifying clauses of the workflow `plus-under-fifty` (expecting 13
   records). **s10 authored one.** The node whose conditions encode the
   instruction is the node whose dataset was never judged.

So the run's answer existed and was scored against the empty dataset of the
other node. It was still a wrong answer — 8 rows against 13 expected — but
"zero records" was not the truth of that run, and any diagnosis built on the
published zero was aimed at the wrong node.

**The cause is the pairing rule.** `judgeCreatedFlowDataset` passes
`candidateOrder: new Map()`, because a created Flow has no recording to order
against. `orderDatasetsByCandidate` then scores every dataset
`+Infinity`, the sort is stable, and `ordered[0]` is whatever order Core listed
the datasets in. With more datasets than judged steps the pairing is
effectively arbitrary, and here it picked wrong. This is **not fixed** by t132 —
the reads are now published so the mis-pairing is visible, but the judgement
still pairs the same way. It needs its own task.

## Third finding: the brief's premise about the last two runs

The brief says two consecutive live runs returned zero records. The bundles say
otherwise:

- `run-muhqop38-997ee8e5`: `observedRecords: 55` against 13 expected,
  `matchedRecords: 0`, *"70 records stored, across 2 record sets"*. A read far
  too **wide**, not an empty one — and the same 2-datasets-1-step shape
  (`extractNodes: 2, extractSteps: 1, unpairedDatasets: 1`).
- `run-muhrf6c4-9714939f`: the zero-record run analysed above.
- `run-muhru6ny-a84eb4a2` (the newest): `"Core web panel production build did
  not succeed"`, one event, no `snapshots/flow-lane.json`. A setup failure, not
  a run.

So there is **one** zero-record run, and its zero was the wrong dataset. The
consistent finding across both real runs is that a two-extract-node Flow is
being judged on one arbitrarily chosen dataset.

## Commands run and observed results

All from `F:\!FluxIQWebExtension` unless stated.

```
$ npx vitest run --root packages/fluxiq \
    src/programs/automation-studio/runtime/service/summaries/tests/   # in F:\!FluxIQ
 ✓ .../tests/run-detail-lock.test.ts (2 tests) 4ms
 ✓ .../tests/run-detail-merge.test.ts (5 tests) 6ms
 ✓ .../tests/conversions.test.ts (5 tests) 8ms
 ✓ .../tests/host-target-resolution.test.ts (9 tests) 10ms
 ✓ .../tests/extraction-summary.test.ts (11 tests) 11ms
 ✓ .../tests/run-detail-preservation.test.ts (3 tests) 4936ms
 Test Files  6 passed (6)
      Tests  35 passed (35)

$ npx tsc --noEmit            # in F:\!FluxIQ\packages\fluxiq
exit=0

$ node --test "packages/test-runner/dist/flow-lane/tests/*.test.js"
# tests 195
# pass 195
# fail 0

$ node --test "packages/test-runner/dist/flow-lane/creation/tests/*.test.js"
# tests 53
# pass 53
# fail 0

$ node --test "packages/test-contracts/tests/*.test.mjs"
# tests 143
# pass 143
# fail 0

$ node --test "packages/test-runner/dist/**/*.test.js"
# tests 1389
# pass 1389
# fail 0

$ npx pnpm -r --filter "./packages/**" check
Scope: 7 of 11 workspace projects
packages/{boundary-audit,real-site-policy,test-matrix,test-contracts,
          test-evidence,agent-orchestrator,test-runner} check: Done

$ node scripts/structure-audit.mjs
  FAIL  [file-lines] packages/test-runner/src/run-scenario.ts: 808 lines exceeds the 800-line limit.
  FAIL  [imports] scripts/lab/domain-build-staleness.mjs: 1 import(s) reach into another directory's files ...
structure-audit: 2 violation(s) across 2 rule(s).

$ node scripts/structure-audit.mjs --rule docs-links
structure-audit: passed (0 warning(s), 0 baselined).
```

Both remaining structure-audit failures are **pre-existing** — neither
`run-scenario.ts` nor `scripts/lab/domain-build-staleness.mjs` is in my diff
(`git status --porcelain` confirms). The `directory-files` failure my first
draft introduced (27 files in `test-contracts/src`, limit 25) is gone: the
contract pair moved into `src/extraction-read/`.

`packages/test-runner/dist` was rebuilt in place with `npx tsc -p
tsconfig.json`, deliberately **not** `pnpm build`, whose `clean` step deletes
`dist` — a window that could have broken a live run importing from it.

## The published shape

Printed from the built `dist` through the real `judgeFlowExtraction` and
`flowExtractionSnapshot`, from a Core-shaped attempt carrying
`itemSelector: "#private-selector"` beside the summary.

**A read that found rows** (`extraction.steps[0]`):

```json
{
 "stepIndex": 1, "status": "judged",
 "expectedRecords": 13, "observedRecords": 2, "comparedRecords": 0,
 "matchedRecords": 0, "expectedFields": 0, "presentFields": 0,
 "unexpectedFields": 0, "nonStringValues": 0, "unjudged": [],
 "storeTruncated": false, "invalidRows": 0, "datasetPages": 1,
 "reads": [
  { "recordCount": 8, "pagesRead": 1, "truncated": false,
    "fieldNames": ["name", "price", "rating", "url"],
    "missingFields": ["rating"],
    "listPresence": "appeared",
    "conditions": { "applied": 20, "kept": 8, "rejected": [4, 8, 0, 3], "unfiltered": false } }
 ]
}
```

**A read whose list never appeared** — the case the record exists for. The
oracle's side is identical to what `run-muhrf6c4-9714939f` published, and the
reason now sits beside it:

```json
{
 "stepIndex": 1, "status": "judged",
 "expectedRecords": 13, "observedRecords": 0, "comparedRecords": 0,
 "matchedRecords": 0, "expectedFields": 0, "presentFields": 0,
 "unexpectedFields": 0, "nonStringValues": 0, "unjudged": [],
 "storeTruncated": false, "invalidRows": 0, "datasetPages": 1,
 "reads": [
  { "recordCount": 0, "pagesRead": 1, "truncated": false,
    "fieldNames": ["name", "price", "rating", "url"],
    "missingFields": [],
    "listPresence": "never_appeared" }
 ]
}
```

**The same two reads per attempt** (`actions[]`), which is how the read no step
paired with is recorded:

```json
[
 { "actionType": "web.dom.extract_list", "nodeId": "node.s9", "attemptIndex": 10,
   "status": "succeeded", "durationMs": 14258,
   "extraction": { "recordCount": 8, "pagesRead": 1, "truncated": false,
                   "fieldNames": ["name","price","rating","url"], "missingFields": ["rating"],
                   "listPresence": "appeared",
                   "conditions": { "applied": 20, "kept": 8, "rejected": [4,8,0,3], "unfiltered": false } } },
 { "actionType": "web.dom.extract_list", "nodeId": "node.s10", "attemptIndex": 11,
   "status": "succeeded", "durationMs": 2109,
   "extraction": { "recordCount": 0, "pagesRead": 1, "truncated": false,
                   "fieldNames": ["name","price","rating","url"], "missingFields": [],
                   "listPresence": "never_appeared" } }
]
```

`#private-selector` does not appear in either. A test asserts that, along with
page text and a URL, over the whole serialized snapshot.

## Not verified

- **No live run.** Core is not rebuilt, so `metadata.extraction` has not been
  observed on a real Core run detail. The end-to-end proof I have is Core's own
  vitest, which drives a real graph execution through
  `runtimeSessionToFlowRunDetail` and reads the member off the projected
  attempt — the same call path a real run takes, with a stub host in place of
  the browser. Before the next campaign: `pnpm --filter fluxiq build` in
  `F:\!FluxIQ` and restart the panel, or the reads will silently be absent.
- **The withholding interaction.** Core's trace withholding treats everything
  under `outputs` as producer data and replaces a value matching a
  state-resolved binding. A count equal to a withheld number would become
  `"[withheld]"` and this reader would then drop the whole summary. Correct
  behaviour (absent stays absent), untested, and it can only affect a Flow that
  resolves parameters out of state.
- **The recorded lane's pairing.** Every test of the per-step `reads` uses an
  explicit `candidateOrder`. The recorded lane's real ordering is unchanged by
  this task and was not exercised beyond the existing suite.
- **Core's wider suite.** I ran the `summaries` directory only (35 tests). A
  full Core `vitest run` was not run; the change is additive and Core's own
  typecheck is clean.
- I did not run `pnpm check`, `pnpm test` or `pnpm build` at either repository
  root, to avoid the extension/domain/Core builds the brief forbade.

## Open questions or contradictions found

1. **The Core edit crosses the repository boundary.** `AGENTS.md` requires the
   user to be told before the first Core edit. A worker cannot do that, so this
   report is the notice: `F:\!FluxIQ` has four changed/new files, all under
   `runtime/service/summaries/`, uncommitted. The change is additive — one new
   optional `metadata` member — and nothing outside this repository reads it.
2. **The judged-dataset pairing is the real defect behind the last two runs**,
   and t132 makes it visible without fixing it. Recommend a follow-up that
   pairs a created Flow's judged step with a dataset by something better than
   Core's list order — the extract node's position in the Flow, or the read's
   own `conditions` count against the task's clauses.
3. **`RunExtractionMeasurement.truncated` and `pagesFollowed` can now be
   filled.** They are `null` today because `LANE_UNOBSERVABLE` in
   `expectations.ts` says Core's run detail states no page count for an
   extraction. That is no longer true: `pagesRead` and `truncated` now arrive
   per read. Filling them would make `evaluation.json` and the bench's
   pagination accuracy real. Deliberately out of scope here — it changes the
   evaluation contract and the bench's rates, which is a separate decision.
