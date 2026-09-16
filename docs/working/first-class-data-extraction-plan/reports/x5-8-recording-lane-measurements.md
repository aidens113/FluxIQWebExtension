# x5-8-recording-lane-measurements — the recording lane reads through FluxIQ and publishes what it measured

## Outcome

**Done, and verified by a real Lab run rather than by unit tests alone.** The
command in the brief now passes, and its `evaluation.json` carries the first
extraction measurement this facility has ever produced from a browser:

```text
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated pnpm lab run product-catalog --workflow paginated-extraction
-> verdict: passed   (run-mu3rd0ii-16a4d074)
```

```json
"extraction": [{
  "stepIndex": 0, "status": "judged",
  "expectedRecords": 23, "observedRecords": 23,
  "recordsListed": true, "countStated": true,
  "comparedRecords": 23, "matchedRecords": 23,
  "expectedFields": 92, "presentFields": 92, "unexpectedFields": 0,
  "expectedPages": 3, "pagesFollowed": 3, "truncated": false,
  "durationMs": 375, "nonStringValues": 0
}]
```

FluxIQ read 23 records across **3 pages in 375 ms**; all 23 matched the
fixture's records exactly and all 92 expected field values were carried.
`expectedPages: 3` beside `pagesFollowed: 3` is the pair that `paginationAccuracy`
needs and that no lane had ever both halves of.

## The defect was one link short of where the brief placed it

The brief said the measurements reach `createExtractionIntentDriver` and are
dropped there. They were not dropped: **nothing ever called that function.**
`grep -rn "createExtractionIntentDriver" src` found its definition and no call
site, and `run-scenario.ts` built its `ScenarioStepRunner` with no
`extractionIntent` at all. So every `extract` step on the recording lane was
read by the Lab's own Playwright reference reader (`extract-records.ts`), which
reports no pages, no truncation flag and no duration — which is exactly why
`assertExtraction` refused `pages: 3` as unjudgeable and why the run in the
brief failed as `fixture.invalid`. The judge was right and the seam was never
connected.

`docs/architecture/testing-facility.md` already described the connected design
("An `extract` step is **FluxIQ's read, not the Lab's**"), written from the
source by X5.7 without noticing that no caller existed. The code now matches
what the document already claimed.

## What changed and why

### 1. `run-scenario.ts`: the lane reads through FluxIQ, and keeps what it read

- The step runner is built with `extractionIntent:
  createExtractionIntentDriver(extensionControl)` when the run **paired**.
  Pairing is the condition rather than "an extension control page exists",
  because the seam answers `no_tab` unless the extension holds an automation
  tab, and `activateScenarioTab` is what gives it one — it runs only when
  `paired`. An unpaired run keeps the reference reader, which still says it
  reported no pages rather than defaulting them.
- Each extract step's read is stored in a per-run map **before** the assertion
  that may throw. A step whose records did not match is the measurement most
  worth publishing, and judging first would have thrown it away.
- `assertExtraction` is now called with the read's own observation as its
  fourth argument, so an expectation naming `pages` or `truncated` is judged
  instead of refused — while an entry nothing can report is still refused, not
  passed.
- The recording-lane observation publishes `extraction`: one measurement per
  extract step when the lane ran its script, `null` when it never reached it.

### 2. `run-expectations/extraction-measurements.ts` (new)

`runExtractionMeasurements({ script, expected, read })` returns one
`RunExtractionMeasurement` per `extract` step, in script order, using the Flow
lane's own status vocabulary and deciding it in the same order, so one workflow
measured on both lanes is measured the same way: `not_expected` when no entry
names the step, `not_run` when an expected step has no read, `judged`
otherwise. Like the Flow lane it measures the first entry naming a step while
`assertExtraction` asserts all of them; no fixture writes a second entry today,
and the report notes it below.

### 3. `scenario-steps/step-runner.ts`: records and their account travel together

`ScenarioStepResult` was `{ extracted?, observed? }`, two optional members that
could disagree. It is now `{ extraction?: { records, observed } }`: a
measurement needs both halves, and records with no account of the read behind
them would be a measurement whose pages, truncation and duration are silently
absent rather than reported as unreported. The reference-reader branch states
`nonStringValues: 0` — a fact about that reader, which keeps a field only as
text or `null` — and states nothing else.

## The three anti-defect rules were kept, and tested

Publishing real numbers must not become a way to publish numbers nothing
earned, so each rule has a test of its own in
`run-expectations/tests/extraction-measurements.test.ts`:

- **A measurement that cannot judge enters no rate.** A read reporting no
  pages measures `pagesFollowed: null`, `truncated: null`, `durationMs: null`
  — never 1, false, or 0. The live regression run below shows the same rule on
  the declared side: W04 declares no `pages`, so `expectedPages` is `null`
  beside a real `pagesFollowed: 1`, and the step enters no pagination rate
  because a rate needs both.
- **An empty population publishes no number.** Unchanged: this producer feeds
  `benchExtractionMetrics`, whose populations already filter on
  `status === "judged"`, so a `not_run` or `not_expected` step is in no rate.
- **Field completeness means a value was carried.** Unchanged and now
  exercised live: 92 of 92 expected fields carried a value in the run above,
  which is a number that could differ, not a guaranteed 1.000.

One further rule the brief did not name but the code now depends on: `null`
means unmeasured. A run that never reached its script publishes `null`, and a
workflow with no extract step that ran publishes `[]`. Those are different
claims and `benchExtractionMetrics` decides whether a lane states a block at
all from exactly that difference.

## Files changed

Owned by the brief:

- **New:** `packages/test-runner/src/run-expectations/extraction-measurements.ts`,
  `packages/test-runner/src/run-expectations/tests/extraction-measurements.test.ts`
- `packages/test-runner/src/run-scenario.ts`,
  `packages/test-runner/src/run-expectations/index.ts`,
  `packages/test-runner/src/scenario-steps/step-runner.ts`
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts` (the new
  result shape), `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
  (the H1 pin moved, plus a new test pinning the seam, the keep-before-judge
  order, and that the measurements reach the evaluation),
  `packages/test-runner/src/run-evaluation/tests/bench-parity.test.ts` (the new
  divergence, below)

Outside the brief's list, one file, for the repository's documentation rule:

- `docs/architecture/testing-facility.md`. Two claims became false the moment
  this landed: that the recording lane "keeps no per-step measurement", and the
  recording-lane section's silence about what a run publishes. Both are
  corrected in place, and the bench sentence now says precisely which producer
  still states `null` and why.

Nothing under `packages/test-runner/src/flow-lane/`, `bench/`,
`apps/extension/`, `domain/` or FluxIQ Core was edited. The extension and Core
were read only.

**The two new files were made visible to the structure audit with `git add -N`**
(it reads `git ls-files`), so they are intent-to-add: `git add` their contents
before committing or git will refuse the commit.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

1. **The brief's run.** `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated
   pnpm lab run product-catalog --workflow paginated-extraction` →
   `verdict: passed`, run `run-mu3rd0ii-16a4d074`. The `extraction` block from
   its `evaluation.json` is quoted at the top of this report, read back off
   disk. Its `run.json` records the extract step at 1,417 ms wall clock against
   FluxIQ's own 375 ms, and its `runtime.settle` event records
   `recordedActions: { extension: 1, core: 1 }` — **one** recorded executable
   action for a three-page read, so FluxIQ followed the pagination itself and
   the Lab clicked nothing.
2. **Regression, the case that already passed.** `... pnpm lab run
   product-catalog` (W04, no workflow) → `verdict: passed`, run
   `run-mu3rezen-4f661b04`, with `"expectedRecords": 8, "observedRecords": 8,
   "matchedRecords": 8, "expectedFields": 32, "presentFields": 32,
   "expectedPages": null, "pagesFollowed": 1, "durationMs": 16`. It now reads
   through FluxIQ rather than through Playwright and still passes.
3. `pnpm --filter @fluxiq-web-extension/test-runner test` → the build succeeded
   and the suite reported **914 tests, 914 pass, 0 fail, 20.6 s**, from a build
   (00:09:47) newer than every source file changed here (latest 00:08:54).
   905 before this work: +7 measurement tests, +1 runner-wiring test, +1
   bench-parity test.
4. `pnpm --filter @fluxiq-web-extension/test-runner check`
   (`tsc -p tsconfig.json --noEmit`) → no diagnostics, exit 0, run against a
   complete `domain/dist`.
5. `node scripts/structure-audit.mjs` → `structure-audit: passed (56
   warning(s), 17 baselined)`, before this work, after the code, and again
   after the documentation edits. The same 56 each time, so no warning here is
   mine.

**Two runs of the test suite went red and are recorded rather than hidden.**
One reported `# fail 1` without my capturing the name. The second named it:
`not ok 100 - dist\tests\commands.test.js`, `exitCode: 3221225477` — a Windows
access violation that killed the whole test *file* (893 tests reported instead
of 913), not an assertion failure. That is this machine's documented
failing-RAM signature. Both were rerun alone and passed; the totals across this
work are **three green whole-suite runs and two crashes of that shape**, and
no run produced an assertion diff.

## Not verified

- **No bench run, and a bench still measures no extraction on this lane.**
  `bench/evaluate-run.ts` builds its recording-lane observation from `run.json`
  (`benchRecordingObservation`), which carries no measurement, and hardcodes
  `extraction: null`. That file is in the brief's must-not-touch list, so a
  `week1` report still states an extraction block for the Flow lane alone and
  `paginationAccuracy` still reads `n/a` there. The fix is one line — take
  `input.result.observation`'s `extraction` when its lane is `recording` —
  plus the `RecordingRunInput` type carrying the observation. A new test in
  `bench-parity.test.ts` pins the divergence so it is visible rather than
  assumed, and says in its comment what closing it means.
- **A third Lab run could not be started.** `pnpm lab run product-catalog
  --workflow numbered-pages` — which would have exercised a pagination mode the
  reference reader always refused — failed in its own workspace build:
  `domain/src/web-panel-host.ts(140,23): error TS2304: Cannot find name
  'recordedExtractionEntry'`. Another worker has `domain/src/io/input-model.ts`,
  `domain/src/io/web-automation-io.ts` and `domain/src/web-panel-host.ts`
  modified in this shared tree. The failed build also emptied `domain/dist`, so
  `pnpm --filter test-runner check` now fails on missing domain exports for the
  same reason. Both facts post-date every result above, and none of it is this
  work's: my check and suite ran green against a complete `domain/dist`, and
  the two Lab runs completed before that edit landed.
- **Only `next` pagination and only `product-catalog` were run live.**
  `numbered`, `loadMore` and `scroll`, the 1,000-record cap (the only fixture
  that would report `truncated: true`), the empty list, the `frame:` target and
  the sensitive-column workflows are measured by no live run here.
- **The unpaired fallback was not exercised live.** That a run with no
  automation tab uses the reference reader and is then refused for declaring
  `pages` is unit-tested and read from the source, not observed.
- **A `not_run` measurement was not produced live.** No run in this work failed
  before an expected extract step, so that status exists only in unit tests.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, because
  another worker's `domain/` is mid-edit and a repository-wide gate would
  report their state as this work's.

## Open questions or contradictions found

1. **`recordingLaneObservation` still states `extraction: null`, and the run
   states its measurements over the top of it with a spread.** The tidy end
   state is a parameter on that function, in
   `packages/test-runner/src/flow-lane/lane-observation.ts` — a must-not-touch
   file for this brief. Its doc comment ("this lane … publishes no per-step
   measurement") is now false, and `flow-lane/tests/lane-observation.test.ts:91`
   asserts the `null` it returns. Four lines for whoever owns that file next.
2. **The bench's own printed source sentence is still accurate but will not
   stay so.** `FLOW_LANE_SOURCES`' recording-lane entry in `bench/evaluate-run.ts`
   says extraction is "unmeasured: the lane asserts each extract step as it runs
   and publishes no per-step measurement". True of the bench today, false of a
   single run, and it must change in the same edit as item 1 of *Not verified*.
3. **Two expectation entries for one step are asserted but only the first is
   measured** — inherited deliberately from the Flow lane so the two agree. A
   fixture that writes a second entry would get a run that can fail on an
   expectation its measurement does not mention. No fixture does today.
4. **The seam reads the extension's own automation tab, not the tab the step
   runs on.** That is the design (`extract-intent.ts`), and it is what makes
   the number FluxIQ's rather than the Lab's, but a workflow that extracts
   after a `switchTab` depends on the extension having followed the switch.
   No fixture in this work does; `multi-tab` is where it would first show.
5. **`extractionMsPerPage` now has samples.** It needs `durationMs` and
   `pagesFollowed`, which only this lane reports, so the distribution becomes
   real the moment item 1 of *Not verified* is closed. Nobody has seen its
   numbers yet; the two observed here would be 125 ms/page and 16 ms/page.
