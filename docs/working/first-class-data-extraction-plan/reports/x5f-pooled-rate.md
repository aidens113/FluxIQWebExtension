# x5f-pooled-rate — a count-only extraction step can no longer score a false 1.0

## Outcome

**Done.** A step that counted records without comparing any of their values can
no longer contribute a match to a pooled extraction accuracy, at three levels:
the producer no longer calls those records matches, the contract refuses a
measurement that claims one, and the new aggregator pools only the steps whose
values were actually compared and states the basis of every number it publishes.

The defect was reproduced against the real producer before the fix, and the
reproduction is now a test. Nothing publishes an extraction accuracy yet — no
code writes `BenchCorpusMetrics.extractionByLane` — so the fix lands before the
first number rather than after it.

## What changed and why

### The defect, measured

Run against the code as it stood (`measureExtraction` from
`packages/test-runner/dist/run-expectations/index.js`, pooled by the formula
`ex-d-test-facility.md:223` states, Σ matched ÷ Σ max(expected, observed)):

```text
count-only  : {"expectedRecords":1000,"observedRecords":1000,"matchedRecords":1000,"expectedFields":0,...}
fully listed: {"expectedRecords":2,"observedRecords":2,"matchedRecords":1,"expectedFields":2,...}
pooled over BOTH steps (ex-d:223 formula): {"matched":1001,"denominator":1002,"rate":0.999001996007984}
pooled over the compared step alone      : {"matched":1,"denominator":2,"rate":0.5}
```

The count-only step's 1,000 records were **1,000 empty strings**. Not one value
was compared, and the step still contributed 1,000 of 1,000 matches. The honest
rate over what was actually compared is 0.5; the published rate would have been
0.999.

### 1. The producer stops manufacturing matches

`packages/test-runner/src/run-expectations/extraction.ts` — `measureExtraction`:

- a count-only entry no longer reports `matchedRecords = min(expected, observed)`.
  It reports `matchedRecords: 0` and `comparedRecords: 0`, which is what
  `matchedRecords`' own contract already said it meant ("observed records equal
  to an expected record": a count-only entry has no expected record, so zero
  observed records can equal one);
- every measurement now states `comparedRecords` (positions value-compared),
  `recordsListed` (the expectation listed the records), and `countStated` (the
  expectation stated a count of its own).

This is a **deliberate deviation from x5f's recommendation**, which was to keep
`matchedRecords = min(expected, observed)` and add `comparedRecords` beside it.
x5f rejected the zero because it would be ambiguous with a genuine total
mismatch — true when the only discriminator was a heuristic over
`expectedFields`, and no longer true now that `comparedRecords` is explicit:
`matched 0 / compared 0` is "nothing was compared", `matched 0 / compared 68` is
"68 were compared and none matched". Keeping the inflated value would have left
every naive consumer — including any future one — able to pool a perfect score
out of it, and it broke the invariant that lets the contract enforce the rule
mechanically. With the zero, `matchedRecords ≤ comparedRecords ≤ min(expected,
observed)` holds for every measurement and is checked.

### 2. The contract refuses a claimed match nothing compared

`packages/test-contracts/src/evaluation.ts` and `evaluation-validation.ts`:

- `RunExtractionMeasurement` gains `recordsListed`, `countStated`, and
  `comparedRecords`, documented with why a reader of `matchedRecords` may not
  skip them;
- validation adds `matchedRecords ≤ comparedRecords` ("a match is a record whose
  values were compared"), `comparedRecords ≤ expectedRecords` and
  `≤ observedRecords`, and `comparedRecords === 0` whenever `recordsListed` is
  false ("nothing was there to compare against"). The exact shape that produced
  the false 1.0 is now a validation failure, not a convention.

`packages/test-contracts/src/bench-report.ts` and `bench-report-validation.ts`:

- `BenchExtractionMetrics` gains `comparedSteps`, `countOnlySteps`, and
  `unjudgeableSteps`, so a published report states the basis of its record
  accuracy instead of asking to be trusted;
- validation adds the identity `judgedSteps === comparedSteps + countOnlySteps +
  unjudgeableSteps` (every judged step is in exactly one basis) and refuses a
  report whose `extractionRecordAccuracy.total` is above zero while
  `comparedSteps` is zero — a rate over records no one looked at.

### 3. The aggregator pools only what was compared, and refuses otherwise

New: `packages/test-runner/src/bench/extraction-accuracy.ts`, exported from the
bench barrel. `benchExtractionAccuracy(measurements)` returns
`{ basis, recordAccuracy, countAccuracy }`:

- `recordAccuracy` = Σ `matchedRecords` ÷ Σ `max(expectedRecords,
  observedRecords)` over judged steps whose **expectation listed records**;
- `countAccuracy` = count-only steps whose observed count equals the expected
  one, over the count-only steps;
- `basis` states `judgedSteps`, `unjudgedSteps`, `comparedSteps`,
  `countOnlySteps`, and `unjudgeableSteps`;
- a rate whose population is empty is `rate: null` — a **refusal** to publish a
  number for a population that judged nothing, matching X5.4's refusal of an
  expectation nothing can judge. A bench whose extraction steps all stated
  counts states no record accuracy at all.

Two design points differ from the recommendation recorded in the finding, both
because the recommendation as written would have opened a second hole:

1. **The population is "the expectation listed records", not "comparedRecords >
   0".** A step that listed 68 records and observed none also compared nothing,
   but it is a total extraction failure. Selecting on what was compared would
   have dropped that failure out of the rate and *raised* the number it belongs
   in. It stays, contributing 0 of 68 (test 2 below).
2. **A step that stated neither a count nor records enters no rate.**
   `measureExtraction` adopts the observed count as the expected one for such an
   entry, so `expectedRecords === observedRecords` is the step agreeing with
   itself; pooling it into count accuracy would have replaced one free 1.0 with
   another. `countStated` is what excludes it, and it is counted as
   `unjudgeableSteps`.

### Files changed

Owned by the brief:

- `packages/test-contracts/src/evaluation.ts`, `evaluation-validation.ts`,
  `bench-report.ts`, `bench-report-validation.ts`
- `packages/test-contracts/tests/evaluation-contracts.test.mjs`,
  `bench-report-contracts.test.mjs`
- `packages/test-runner/src/bench/extraction-accuracy.ts` (new),
  `packages/test-runner/src/bench/index.ts`,
  `packages/test-runner/src/bench/tests/extraction-accuracy.test.ts` (new)

Outside the brief's list, and why:

- `packages/test-runner/src/run-expectations/extraction.ts` and
  `tests/extraction.test.ts`. `ExtractionStepMeasurement` is
  `Omit<RunExtractionMeasurement, "stepIndex" | "status">`, so a contract field
  is a compile error in the producer until it is produced — and this file *is*
  the producer of the wrong number. The change is confined to
  `measureExtraction`; `assertExtraction`'s behaviour is untouched (it reads
  `matchedRecords` only inside the `entry.records !== undefined` branch, where
  nothing changed). Its two tests that pinned the old count-only value were
  updated, one of them a test named for the defect.

No file under `apps/extension/`, `domain/`, or `apps/scenario-lab/` was touched.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

1. **Defect reproduced before the fix** — a scratch script over the built
   producer: `node <scratch>/x5f-repro.mjs`. Output quoted above: pooled rate
   **0.999001996007984** over a count-only step and a compared step; **0.5** over
   the compared step alone.

2. **The new test failing before the fix.** With the pre-fix behaviour
   temporarily restored in both files (count-only `matchedRecords = min(...)`,
   and the aggregator pooling every judged step),
   `node --test packages/test-runner/dist/bench/tests/extraction-accuracy.test.js`:

   ```text
   # tests 5
   # pass 2
   # fail 3
   not ok 1 - a count-only step is excluded from the pooled record accuracy instead of scoring a perfect match
         {  compared: 0,  +   matched: 1000  -   matched: 0  }
   not ok 3 - a step that stated neither a count nor records enters no rate: it cannot agree with itself into a hit
   not ok 4 - a lane that compared no record publishes no record accuracy at all
         + count: 1000, + rate: 0.999000999000999, + steps: 2, + total: 1001
         - count: 0,    - rate: null,              - steps: 0, - total: 0
   ```

   The fixed sources were then restored from a saved copy and rebuilt.

3. **The same test after the fix** — same command:
   `# tests 5 / # pass 5 / # fail 0`.

4. **Test-runner suite**: `pnpm --filter @fluxiq-web-extension/test-runner test`
   (`pnpm build && node --test "dist/**/*.test.js"`) →
   `# tests 866 / # pass 866 / # fail 0 / # duration_ms 39871`.

5. **Test-runner type check**: `pnpm --filter @fluxiq-web-extension/test-runner
   check` (`tsc -p tsconfig.json --noEmit`) → no diagnostics, exit 0.

6. **Contracts suite and type check**: `pnpm --filter
   @fluxiq-web-extension/test-contracts test` → `# tests 92 / # pass 92 / # fail
   0`, including the new `a step that compared nothing has no matches to pool: a
   count-only measurement cannot report one`; `... check` → no diagnostics.

7. **Other dependents of the contract**: `pnpm --filter
   @fluxiq-web-extension/test-evidence check` and `... agent-orchestrator check`
   → no diagnostics. A repository-wide grep found no other consumer of
   `RunExtractionMeasurement`, `BenchExtractionMetrics`, or `extractionByLane`.

8. **Structure audit**: `node scripts/structure-audit.mjs` →
   `structure-audit: passed (55 warning(s), 17 baselined)`. The first run after
   my edits reported 56: my additions had pushed
   `bench-report-contracts.test.mjs` to 406 lines, past the 400-line advisory.
   The additions were compacted to bring the file back to exactly 400, so the
   audit now reports **one warning fewer than before** and none of mine.

An earlier full test-runner run (before the producer tests were updated) also hit
`not ok 545 - serializes simultaneous independent-run writes with one complete
valid winner ... Timed out waiting for the scoped clone cache lock` after 13.3s.
It did not recur in either later full run and is unrelated to extraction; I am
recording it rather than claiming it as mine or as fixed.

## Not verified

- **No bench run.** Nothing writes `extractionByLane` yet, so no report was
  produced and no real corpus number was measured. Everything here is unit-level.
- **`benchExtractionAccuracy` is not wired into `aggregateBenchReport`.** X5.5
  still has to compose `BenchExtractionMetrics` (the four other extraction rates,
  the two distributions, and `workflows` per rate) from it. The basis counts it
  returns map one-to-one onto the new `comparedSteps` / `countOnlySteps` /
  `unjudgeableSteps` fields.
- **`RunEvaluation.extraction` is still `null` everywhere.**
  `observed-run-evaluation.ts:97` writes `extraction: null`, so no measurement
  reaches a bench today; the producer is exercised only by the runner's
  assertions and by these tests.
- `pnpm check` and `pnpm test` were not run whole: another worker has
  `domain/src/runtime/llm-evidence/` in flight and failing independently of this
  work. I ran the per-package checks above instead.
- `apps/extension` and `apps/scenario-lab` type checks were not run (other
  workers' areas). Neither references the changed types.

## Open questions or contradictions found

1. **A `not_run` step is excluded from record accuracy, and that could flatter a
   number.** The rates are computed over `status === "judged"` only, so a step
   that was expected and never ran leaves the denominator entirely rather than
   contributing 0 of its expected records. That matches the contract's existing
   `judgedSteps` / `unjudgedSteps` vocabulary, and such a run fails anyway, but if
   X5.5 wants an accuracy that cannot be raised by a step failing to run, the
   population should be widened to `not_run` and the choice recorded.
2. **`extractionCountAccuracy`'s population is count-only steps, so a step that
   listed records *and* stated a count is not in it.** That follows `ex-d:223`
   and x5f, and the count is still judged inside record accuracy through the
   denominator's `max(expected, observed)`. Worth a line in the metric's
   published definition, because "count accuracy" over a subset of the steps
   whose counts were checked is not what a reader will assume.
3. **The tolerance in `ex-d:223` was sized for the old population.** "About 1/68
   per week1 repeat" was a fraction of a pooled denominator that included
   count-only steps. With those steps out, the denominator is smaller and the
   per-record tolerance correspondingly larger; whoever publishes the first
   comparison should re-derive it rather than reuse the figure.
4. **`BenchExtractionMetrics` now requires the three basis counts.** That is safe
   today because no report on disk carries `extractionByLane` (the contract
   tests' legacy fixtures all omit it, and that is asserted), but it is a
   required-field addition to a shipped type: any bench report that gains an
   extraction block written before this change would fail validation rather than
   read as legacy.
