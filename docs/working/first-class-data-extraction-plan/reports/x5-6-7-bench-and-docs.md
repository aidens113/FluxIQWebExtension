# x5-6-7-bench-and-docs — the bench publishes what each extraction number is counted over, and the facility document says what the code now does

## Outcome

**Done, with one thing the brief should know before reading the rest: X5.6's
code was already on disk.** Every file the plan assigns to the X5-D bench
worker had been changed by X5.5 — `extractionByLane` pooled rather than
averaged in `aggregate-report.ts`, the `report.md` Extraction section in
`render-markdown.ts`, the `extraction:<lane>:<metric>` ids in
`comparison-details.ts`, the corpus comment already reading 67, and
`week1-corpus.test.ts` already asserting `[67, 23, 0, 23, 21]`. X5.6 as
written was therefore not work left to do. I verified that claim file by file
rather than assuming it, then spent X5.6 on the gap X5.5 left behind it: the
bench printed six extraction rates whose populations are all different and
told a reader none of them.

X5.7's documentation was the real remaining work, and the staleness was wider
than the `not_applicable` line the supervisor had already fixed. Seven separate
claims in `testing-facility.md` described a facility that no longer exists.

Validation: test-runner **905 tests, 905 pass, 0 fail** (904 before);
test-contracts **92 pass, 0 fail**; both type checks exit 0;
`structure-audit: passed (56 warning(s), 17 baselined)` — the same 56 as before
my edits, so none of them is mine.

## What changed and why

### X5.6, part 1: every published extraction rate now states its own population

`report.md` printed `| extractionCountAccuracy | 1 | 1 | 1 | 1.000 |` and
nothing else. A reader cannot act on that. "Count accuracy" over a **subset** of
the steps whose counts were checked is not what anyone assumes it means, and
x5f recorded that gap as its open question 2 without closing it: a step that
listed its records has its count judged inside the record accuracy's
`max(expected, observed)` denominator instead, and is deliberately absent from
the count accuracy. Two rates, two populations, no overlap, nothing on the page
saying so.

- **New `BENCH_EXTRACTION_RATE_DEFINITIONS`** in
  `packages/test-runner/src/bench/extraction-metrics.ts`: each of the six rates
  with its unit (records, fields, steps, runs) and the population it is counted
  over. It is in the module that computes the rates, for the reason
  `BENCH_RATE_DEFINITIONS` sits in `aggregate-report.ts`: a definition kept
  anywhere else is how the printed sentence comes to describe a rate that is no
  longer computed that way.
- **`render-markdown.ts`**: the Extraction table gains `Unit` and `Population`
  columns, matching the Rates table, which has carried a `Population` column all
  along.
- **`tests/render-markdown.test.ts`** asserts, for **every** metric, that the
  line printed for it ends with the definition the aggregator holds. A drifted
  definition is now a failing test rather than a misleading table.

It was not put in `packages/test-contracts/src/bench-report.ts`, beside
`benchExtractionRateMetrics`, although that reads like the natural home: that
file has exactly 8 exported values, and a ninth crosses the structure audit's
8-value advisory threshold and adds a warning. Nor in a new file:
`packages/test-runner/src/bench/` holds 24 source files against a hard limit of
25, and spending the last slot on this would force the next person into a
subdirectory.

Rendered from a constructed evaluation (three judged steps: one comparing 8
records and matching 7, one stating a count of 1,000 alone, one judging
neither), the published section now reads:

```text
**flow lane.** 3 step(s) judged and 0 not: 1 compared their records, 1 stated a count alone and compared no value, and 1 could judge neither. Only the compared steps are in the record accuracy.

| Metric | Unit | Count | Total | Workflows | Rate | Population |
| extractionRecordAccuracy | records | 7 | 8 | 1 | 0.875 | judged steps whose expectation listed the records: ... A count-only step is not in it |
| extractionCountAccuracy | steps | 1 | 1 | 1 | 1.000 | ... A step that listed its records is judged in the record accuracy instead, never here |
| extractionExactSuccess | runs | 0 | 1 | 1 | 0.000 | ... A step whose expectation could judge nothing is a miss, not an exclusion |
| extractionFieldCompleteness | fields | 15 | 16 | 1 | 0.938 | ... counted present when the record carried a value for the field |
| paginationAccuracy | steps | 0 | 0 | 0 | n/a | ... A lane that cannot observe pages has an empty population and publishes no rate |
| extractionFalseSuccess | runs | 1 | 1 | 1 | 1.000 | ... Lower is better |
```

The step declared `expectedPages: 3` and `paginationAccuracy` still prints
`n/a`, because nothing observed the other side. That is the contract holding.

### X5.6, part 2: the duration is disclosed for what it is

`FLOW_LANE_SOURCES.extraction` in `bench/evaluate-run.ts` now says that a step's
duration is the **sum of its extract node's attempt durations**, so a node Core
retried reports the retries too, and that `extractionMsPerPage` has no samples
on this lane at all. X5.5 recorded both facts in its report's "Not verified";
`report.md` prints the sources block, so the disclosure belongs there rather
than in a working document only agents read.

### X5.6, part 3: the two test gaps the plan named

`bench/tests/evaluate-run.test.ts` had extraction data in a fixture and asserted
nothing about it. It now pins that the Flow lane's measurements reach the
evaluation, that a recording-lane run states `extraction: null`, and — as a new
test — that a Flow-lane run whose lane published no observation states `null`
too. `null` and `[]` are different claims (unmeasured against "measured, and
there was no extract step"), and `benchExtractionMetrics` decides whether a lane
states a block at all from exactly that difference.

### X5.6, part 4: one contract-file defect

`packages/test-contracts/src/bench-report.ts` carried **two stacked JSDoc
blocks** above `benchExtractionRateMetrics`; only the second attached, so the
sentence naming the units was orphaned and invisible to a reader's tooling. The
two are merged, and the merged block points at the new definitions.

### X5.7: seven stale claims in `testing-facility.md`

The supervisor's fix to the `not_applicable` vocabulary was one of several. Each
of these described the facility as it was **before** an `extract` step recorded
an action:

1. **The manifest contract** said an `extract` step with `pagination` "clicks
   its `next` control as trusted input ... and the extension records those
   clicks". FluxIQ follows the pagination now; the Lab does not click.
2. **`recordableActionTypes`** was documented as "An `extract` step yields
   nothing unless it has `pagination`, whose recorded Next clicks yield what a
   click yields" — the exact opposite of the current rule. It now states
   `web.dom.extract_list` / `web.dom.extract`, one node, no `web.dom.click`, and
   adds the consequence: `flowLaneExclusion` excludes no `week1` workflow.
3. **The recording lane** was described as the Lab's own Playwright read. It now
   describes the intent seam (`fluxiq.test.defineExtraction` to the extension's
   control page, `web.dom.extract_list` through the same command a replayed Flow
   uses, no timeout sent), and states the reference reader as the fallback for a
   run with no extension control page — including that such a run **refuses** an
   expectation naming `pages` or `truncated` as `fixture.invalid`.
4. **The Flow lane's `expected.extracted`** said extraction "is usually
   `not_run` on this lane and is judged on the recording lane alone". It now
   describes reading Core's run datasets (K5/K8), the `null` restoration, the
   refusal of a short read, candidate-order pairing, the exact order of the five
   assertions, and — at length, because it is the one place a reader could be
   misled — that `pages` and `truncated` are **stated as unjudged**, enter no
   rate, and leave `paginationAccuracy` empty on this lane.
5. **The `flow-lane.json` snapshot** was a single status word. It is now its own
   bullet describing the `extraction` block, ending on why the `unjudged` list
   is in it.
6. **The bench corpus** said 63 runnable results, 40 on the Flow lane, with
   W04's and W08's four entries skipped. It is 67 and 44, 0 skipped.
7. **The content-script harness** said "Its 25 specs under
   `apps/extension/e2e/content/tests/`". The extraction specs moved into
   `extraction/tests/` and the evidence specs into `evidence/tests/`. I replaced
   the sentence with the structure rather than a new count, deliberately: two
   workers are live in `apps/extension/` right now, so any number I wrote would
   be stale by the time it was committed.

Two additions beyond fixing what was wrong:

- **The bench section gained an Extraction bullet** — the plan's "plus the
  metric definitions". It states the absent-means-unmeasured rule, why the
  recording lane states no block, the one rule every rate obeys, each rate's
  population, and the three basis counts. `lab compare`'s paragraphs gained the
  extraction ids and their tolerances (one workflow for the two success rates,
  one unit of the population for the four accuracies).
- **An extraction catalog table** listing the thirteen workflows and variants
  X5.4 added across six fixtures, none of which the document mentioned at all.
  Each row says what that fixture pins: the absent field that reads as no value,
  the absolute href, the lazy image's two attribute reads, `numbered` and
  `loadMore` and `scroll` pagination, the 1,000-record cap reporting itself, the
  empty table, the `frame:` target, and the two sensitive-column workflows.

## Files changed

All within the brief's owned paths.

- `packages/test-runner/src/bench/extraction-metrics.ts` (definitions),
  `render-markdown.ts` (two columns), `evaluate-run.ts` (one source string)
- `packages/test-runner/src/bench/tests/render-markdown.test.ts`,
  `tests/evaluate-run.test.ts`
- `packages/test-contracts/src/bench-report.ts` (merged JSDoc)
- `docs/architecture/testing-facility.md`

Nothing under `apps/extension/`, `domain/`,
`packages/test-runner/src/scenario-steps/` or `flow-lane/` was edited; those
were read only. No file was added, so the structure audit's `git ls-files` blind
spot does not apply to this work.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

1. **Baseline, before any edit** —
   `pnpm --filter @fluxiq-web-extension/test-runner test` →
   `# tests 904 / # pass 904 / # fail 0 / # duration_ms 22452.9225`.
2. **After the edits**, same command →
   `# tests 905 / # pass 905 / # fail 0 / # duration_ms 21155.2651`. Run twice;
   both green, both 905. The one new test is the `null`-not-`[]` case.
3. `pnpm --filter @fluxiq-web-extension/test-runner check`
   (`pnpm domain:dist && tsc -p tsconfig.json --noEmit`) → no diagnostics,
   exit 0.
4. `pnpm --filter @fluxiq-web-extension/test-contracts test` →
   `# tests 92 / # pass 92 / # fail 0 / # duration_ms 168.8505`.
5. `pnpm --filter @fluxiq-web-extension/test-contracts check` → no diagnostics,
   exit 0.
6. `node scripts/structure-audit.mjs` →
   `structure-audit: passed (56 warning(s), 17 baselined)`, before and after.
   Identical count, so no warning here is mine, and the docs-links rule accepts
   the anchor I added (`#the-recording-lane`).
7. **The rendered Extraction section**, quoted above, from a scratch script over
   the built renderer
   (`node <scratchpad>/x567-render.mjs`). It is the only observation in this
   report of what the bench actually prints.
8. **The fixture inventory**, from a scratch script over the built
   `loadScenarioManifests` (`node <scratchpad>/x567-manifests.mjs`) →
   `total manifests: 25`, and the workflow/variant ids the new catalog table
   lists. The table was written from that output and from each manifest's own
   `description`, not from memory.

**One run of the test-runner suite went red and must be recorded rather than
hidden.** After the last edit of this work — a Markdown paragraph in
`testing-facility.md`, with no source file touched — a run reported
`# fail 1` after 15.7s, while another worker's build was running in this tree.
I did not capture the failing test's name. The two runs immediately after it,
alone, reported `# tests 905 / # pass 905 / # fail 0` at 21.1s and 21.1s. The
compiled code was byte-identical across all three runs, so nothing in this work
can explain the difference, and this machine's known load-correlated failures
can. It is reported as an observation, not as a finding, and not as fixed. The
total across this work is therefore **three full runs after the edits: two
green, one red with an uncaptured name.**

## Not verified

This is the part of the report that matters most, and none of it improved.

- **No Lab run and no bench run happened, and nothing has ever produced a real
  `extractionByLane` block.** The whole extraction measurement chain — the
  intent seam, Core's datasets, the Flow-lane judgement, the pooled rates, the
  published table — is verified at unit level, against fakes, only. The
  Extraction section quoted above was rendered from an evaluation object I
  constructed in a scratch file. It proves the renderer; it proves nothing about
  a browser, a Core, an extract node or a dataset.
- **My work does not make an end-to-end run any more possible than it was.** It
  was already possible before this brief and it still needs a machine, not a
  code change. The commands, none of which needs `pnpm dev` or the FluxIQ web
  panel — `lab run` and `lab bench` on the `isolated` target start and own their
  own Scenario Lab, Core and Chromium — are:

  ```powershell
  pnpm lab run product-catalog --flow
  pnpm lab run data-table --flow --variant column-reorder
  pnpm lab run product-catalog --workflow paginated-extraction --flow
  pnpm lab run product-catalog --workflow numbered-pages --flow
  ```

  Then the A/B pair and the comparison, which need
  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` because `week1` runs `auth-gate` on
  the Flow lane:

  ```powershell
  pnpm lab bench --corpus week1 --repeat 3 --target isolated
  pnpm lab bench --corpus week1 --repeat 3 --target isolated
  pnpm lab compare <baseline-report> <candidate-report>
  ```

  I ran none of them, and I started no panel.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole.** Other
  workers have `apps/extension/`, `domain/` and `domain/.test-build/` in flight
  in this tree; a repository-wide gate would have reported their state as this
  work's. The per-package gates above were run instead.
- **The doc's description of the intent seam is read from source, not observed.**
  That `web.dom.extract_list` really runs through the background worker on a
  real page, and that the recording really holds one extract node with no Next
  clicks, is what a Lab run would show and no test here does.
- **The extraction catalog table describes expectations, not outcomes.** Each
  row says what the fixture declares. Whether FluxIQ satisfies any of them is
  unmeasured.

## Open questions or contradictions found

1. **The plan's X5.6 row is stale and should be closed rather than executed.**
   Every file it lists was delivered by X5.5, including the corpus comment and
   the `[67, 23, 0, 23, 21]` assertion the plan still describes as pending. A
   future reader following the plan literally would look for work that is not
   there.
2. **The `week1` corpus exercises exactly one pagination mode.** The only
   paginated extraction in it is W05's `next`. `numbered`, `loadMore` and
   `scroll` extraction pagination, the 1,000-record cap, the empty list, the
   `frame:` target and the two sensitive-column workflows are all in the X5.4
   catalog and in **no** corpus row, so the A/B bench pair will not measure any
   of them. Whoever wants extraction accuracy to stand on more than one mode has
   to add corpus rows; this is a scoping decision, not a defect, but it is not
   visible from the plan.
3. **`paginationAccuracy` will read `n/a` on every bench until something
   changes** (X5.5's open question 2, unchanged). The cheaper of the two fixes
   is publishing the recording lane's measurements, where the intent seam does
   report `pagesRead` — but that means writing measurements from
   `run-scenario.ts`, which this brief does not own and which sits beside
   another worker's files. It stays open.
4. **The recording lane still publishes `extraction: null`,** so a `week1` bench
   states an extraction block for the Flow lane alone, and
   `extractionFieldCompleteness` on that lane is measured against Core's stored
   schema rather than against the page. Same owner as item 3.
5. **`packages/test-runner/src/commands.ts` prints `run <scenario> ... [--flow
   ID]` in its usage string, but `--flow` takes no value** — it is parsed as a
   boolean. Cosmetic, in a file outside this brief, reported rather than fixed.
6. **`packages/test-runner/src/bench/` is at 24 of its 25-file limit.** X5.5
   flagged it; it is still true, and the next file added there forces a
   subdirectory. I avoided spending the slot.
