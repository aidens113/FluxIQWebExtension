# w2-judge-same-origin-urls: the Lab judge accepts a same-origin absolute URL

Worker report, 2026-09-16. Brief: the Lab's expected-dataset judge must treat
an absolute URL on the run's own scenario origin as equal to a root-relative
expected URL. Repository `F:\!FluxIQWebExtension`, `dev`. The brief was
written against `d9d23e3`. `HEAD` is now `4e3a3f3`, and the two commits in
between (`c1295e3`, `4e3a3f3`) touch none of the paths below. Nothing is
committed.

## Outcome

**Done.** The problem was confirmed without the provider, and the fix is in
place and tested.

- **The cause is confirmed.** The live task `product-catalog-first-page` was
  judged by the unchanged judge, compiled from `HEAD` in scratch. When the
  `url` column is read as an absolute address on the run's origin, the judge
  measures **observed 8, compared 8, matched 0, fields 32/32**. These are
  exactly the numbers `run-mu4yk4u1-60a1c3a4` published in
  `snapshots/flow-lane.json`.
- **The fix works.** The same task and the same records now measure
  **matched 8** and the dataset holds.
- **Nothing else loosened.**
  - An absolute URL on another port, another host or another scheme still
    matches 0.
  - The `absolute-links` variant still compares its absolute URLs exactly.

**Not fixed here: that run would still have failed.** Its Flow also failed
at run time with `graph_validation_or_unknown_node` / `record_output.invalid`.
That is the extra save node, open question 2 of `w2-created-scrape-fields.md`.

## What changed and why

### Which judges compare record values

- **The only place values are compared** is `matchesRecord` in
  `packages/test-runner/src/run-expectations/extraction.ts`.
  - `measureExtraction` calls it to count `matchedRecords`.
  - `assertExtraction` calls it to pass or fail a step.
- **Three lanes reach it:**
  - **The recording lane.** `run-scenario.ts` calls `assertExtraction`, and
    `runExtractionMeasurements` calls `measureExtraction`.
  - **The recorded Flow lane.** `run-flow-lane.ts` calls
    `judgeFlowExtraction` and `assertFlowExtraction` in
    `flow-lane/expectations.ts`.
  - **The created Flow lane**, which is what the live campaign's
    `judgeBy: "expected-dataset"` tasks use. `flow-lane/creation/lane.ts`
    calls `judgeCreatedFlowDataset` and `assertCreatedFlowDataset` in
    `flow-lane/creation/judgement.ts`, which call the two functions in
    `flow-lane/expectations.ts`.
- **The two bench files compare no values.**
  - `bench/extraction-accuracy.ts` and `bench/extraction-metrics.ts` only add
    up the `matchedRecords` that `measureExtraction` already produced.
  - They therefore pick up the fix without any change, and neither was
    edited.
- **Where the scenario origin comes from.**
  - Both Flow lanes already receive `scenarioOrigin`
    (`FlowLaneInput.scenarioOrigin`, `CreatedFlowLaneInput.scenarioOrigin`).
  - `run-scenario.ts` sets it from `topology.scenarioOrigin`, which is
    `http://127.0.0.1:${allocation.scenarioPort}` (`coordinator.ts:125,210`).
  - So no file outside the flow lane needed to change.

### The comparison, in one place

**New file:** `packages/test-runner/src/run-expectations/extracted-value-match.ts`,
exported from the `run-expectations` barrel.

- **What it exports:**
  - `type ExtractedValueContext = Readonly<{ scenarioOrigin: string }>`
  - `extractedValueMatches(expected, observed, context)`
- **When two values match:**
  - Equal strings, and `null` against `null`, still match, as before.
  - Otherwise, the expected value must start with a single `/`. It is
    resolved against the run's origin, and the observed value must parse,
    without a base, as an absolute URL **on that origin** whose `href`
    equals the resolved one.
- **Cases that still compare exactly:**
  - An expected absolute URL.
  - A protocol-relative expected value (`//host/...`).
  - An observed value that is relative or not a URL.
  - A missing context, or an origin that is no web origin. An opaque origin
    serialises as `"null"`, which is no valid base, so nothing resolves
    against it.
  - A value holding text the URL parser would silently strip: leading or
    trailing spaces or control characters, or a tab or line break anywhere.
    That text would be a difference in any other field.
- **Cases that never match:**
  - Another origin.
  - An expected `/\host/...`, which the parser resolves onto another host.
- **Why `URL.parse`:** it returns `null` on failure (Node 22.11, typed in
  `@types/node` 22.20), so the file has no try/catch for the failure audit
  rules to flag.
- **Why this filename:** a name starting with `extraction-` would give that
  prefix three files in `run-expectations/` (with `extraction.ts` and
  `extraction-measurements.ts`). The naming audit rule would then demand an
  `extraction/` directory.

### Use from each judge

**`run-expectations/extraction.ts`**

- `matchesRecord` now compares each value with `extractedValueMatches`.
- `measureExtraction` takes an optional fourth argument,
  `context?: ExtractedValueContext`.
- `assertExtraction` takes an optional fifth argument of the same type.
- Both pass the context to `matchesRecord`, so a measurement and an
  assertion still cannot disagree.
- **Why the argument is optional:** the recording lane's call in
  `run-scenario.ts` stays exactly as written. `runner-wiring.test.ts` pins
  that four-argument call string, and `run-scenario.ts` is not mine.
  - That lane reads with the fixture's own selectors
    (`testid:product-link@href`), so it gets the href as written, and exact
    comparison stays correct there.
  - `runExtractionMeasurements` is unchanged for the same reason.

**The flow lane: origin passing only, 13 changed lines in total.**

> **Ownership note:** the brief listed only `run-flow-lane.ts` in the flow
> lane. The other three files below are the judge the brief asked me to find
> ("find which the campaign's expected-dataset judgement uses … use it from
> each judge that compares extracted records"). None of them is in the brief's
> "Not yours" list, and no other worker had them modified (checked with
> `git status`). Without these edits the fix does not reach the campaign, and
> the `run-flow-lane.ts` edit alone does not compile. If you want them
> reverted, their diff is below.

- **`flow-lane/expectations.ts`**
  - `judgeFlowExtraction` takes a **required** `scenarioOrigin: string`.
  - It builds `comparison: ExtractedValueContext` and passes it to
    `measureExtraction`.
  - It returns `comparison` on `FlowExtractionJudgement`.
  - `assertFlowExtraction` passes `judgement.comparison` to
    `assertExtraction`.
  - **The origin is not published.** `flowExtractionSnapshot` names its
    fields one by one, and `creation/tests/lane.test.ts` still passes its
    check that `127.0.0.1` never appears in a snapshot.
- **`flow-lane/creation/judgement.ts`:** `judgeCreatedFlowDataset` takes a
  required `scenarioOrigin` and forwards it.
- **`flow-lane/creation/lane.ts:127`:** passes `input.scenarioOrigin`.
- **`flow-lane/run-flow-lane.ts:204`:** passes `input.scenarioOrigin`.
- **Why required:** the compiler makes both lanes supply the origin (probes
  P8 and P9 below).

```diff
--- flow-lane/expectations.ts
-import { assertExtraction, measureExtraction, type ObservedExtraction } from "../run-expectations/index.js";
+import { assertExtraction, measureExtraction, type ExtractedValueContext, type ObservedExtraction } from "../run-expectations/index.js";
   (FlowExtractionJudgement)
+  /** The run's scenario origin, which the assertion compares against as the measurement did. Never published (`flowExtractionSnapshot`). */
+  comparison: ExtractedValueContext;
   (judgeFlowExtraction input)
+  /** Where the run's scenario was served from: a root-relative expected URL resolves against it (`extractedValueMatches`). */
+  scenarioOrigin: string;
+  const comparison: ExtractedValueContext = { scenarioOrigin: input.scenarioOrigin };
-        ...measureExtraction(declared[0], dataset?.records ?? [], observed),
+        ...measureExtraction(declared[0], dataset?.records ?? [], observed, comparison),
+    comparison,
-    assertExtraction(step.entries, step.stepId, step.dataset.records, step.observed);
+    assertExtraction(step.entries, step.stepId, step.dataset.records, step.observed, judgement.comparison);
--- flow-lane/creation/judgement.ts
+  /** Where the run's scenario was served from, as `judgeFlowExtraction` takes it. */
+  scenarioOrigin: string;
+    scenarioOrigin: input.scenarioOrigin,
--- flow-lane/creation/lane.ts
-  ... judgeCreatedFlowDataset({ workflow, stepId: judgement.stepId, run, actionTypes }) : null;
+  ... judgeCreatedFlowDataset({ workflow, stepId: judgement.stepId, run, actionTypes, scenarioOrigin: input.scenarioOrigin }) : null;
--- flow-lane/run-flow-lane.ts
+    scenarioOrigin: input.scenarioOrigin,
```

### Tests (written before the implementation)

- **New: `run-expectations/tests/extracted-value-match.test.ts`**, 9 tests
  covering:
  - the same-origin match, including parser normalisation;
  - a different path, a trailing slash, a query or a fragment not matching;
  - another host, port or scheme;
  - `//` and `/\`;
  - an expected absolute URL;
  - relative or non-URL observed values;
  - text the parser would strip;
  - `null`;
  - no context, or a bad origin.
- **Added to `run-expectations/tests/extraction.test.ts`:** 1 test showing
  that `measureExtraction` and `assertExtraction` both use the context:
  0 matches without it, 2 with it, 0 on another port, and a wrong path still
  fails.
- **`flow-lane/tests/expectations.test.ts`:**
  - The `judge` helper now passes `scenarioOrigin`.
  - 1 test added: the Flow lane's measurement and assertion both match on
    the origin and fail on another port. An expected absolute URL is not
    matched by a root-relative observed value.
- **New: `flow-lane/creation/tests/judgement.test.ts`**, 3 tests using the
  **real** Scenario Lab build (`apps/scenario-lab/dist`) and the real live
  tasks via `loadCreatedFlowRequest`:
  - `product-catalog-first-page`: with no origin (the old comparison) the
    measurement is 8 / 8 / **0** / 32 / 32. Through `judgeCreatedFlowDataset`
    with the run's origin it is **8** matched, holds, and the assertion
    passes. The raw hrefs still match 8.
  - The same task with an absolute URL on `:4732`, on `localhost:4731`, or on
    `https://catalog.example.test`: 0 matched, fails with
    `record 0 does not match`.
  - `product-catalog-first-page-absolute-links`: 8 as written. The same paths
    on the run's origin, or root-relative, give 0.

## Commands run and observed results

1. **Type-check:** `pnpm --filter @fluxiq-web-extension/test-runner check`
   -> exit 0, no output from `tsc --noEmit`.
2. **"Before", on clean `HEAD`.**
   - Set-up:
     - `git archive HEAD packages/test-runner/{src,tsconfig.json,package.json}`,
       extracted to `<scratchpad>/pre-judge-same-origin`.
     - A junction to `packages/test-runner/node_modules`.
     - `tsc -p tsconfig.json` -> exit 0.
     - `grep -c extractedValueMatches dist/run-expectations/extraction.js`
       -> 0, so the build contains none of my change.
   - Ran `node <scratchpad>/judge-same-origin-proof.mjs F:/!FluxIQWebExtension <that dist>`:
     ```
     product-catalog-first-page asWritten: observed=8 compared=8 matched=8 fields=32/32 holds=true
     product-catalog-first-page absoluteOnRunOrigin: observed=8 compared=8 matched=0 fields=32/32 holds=false
     product-catalog-first-page absoluteOnOtherPort: observed=8 compared=8 matched=0 fields=32/32 holds=false
     product-catalog-first-page-absolute-links asWritten: observed=8 compared=8 matched=8 fields=32/32 holds=true
     product-catalog-first-page-absolute-links absoluteOnRunOrigin: observed=8 compared=8 matched=0 fields=32/32 holds=false
     product-catalog-first-page-absolute-links absoluteOnOtherPort: observed=8 compared=8 matched=0 fields=32/32 holds=false
     ```
3. **Package tests, first run:**
   `pnpm --filter @fluxiq-web-extension/test-runner test` -> exit 1, tests
   1118, pass 1117, fail 1.
   - The failure was `clone-cache refresh reports invalidate-now and refresh-on-next-run semantics`:
     the CLI it starts threw `ERR_MODULE_NOT_FOUND` for
     `node_modules/@fluxiq-web-extension/domain/dist/index.js`.
   - `domain/dist/index.js` had a new timestamp, 20:39:56, which falls inside
     that run.
   - So another process rebuilt `domain` during the run. This is
     environmental and unrelated to this change.
4. **Package tests, second run:** same command -> exit 0, tests 1118,
   pass 1118, fail 0. All 14 new tests report `ok`.
5. **Two simplifications, then everything checked again:**
   - Removed a redundant `wanted.origin` check.
   - Removed a redundant `origin === "null"` guard.
   - Final `pnpm --filter @fluxiq-web-extension/test-runner test` -> exit 0,
     tests 1118, pass 1118, fail 0.
6. **"After", on the working tree:** the same proof script against
   `packages/test-runner/dist`:
   ```
   product-catalog-first-page asWritten: observed=8 compared=8 matched=8 fields=32/32 holds=true
   product-catalog-first-page absoluteOnRunOrigin: observed=8 compared=8 matched=8 fields=32/32 holds=true
   product-catalog-first-page absoluteOnOtherPort: observed=8 compared=8 matched=0 fields=32/32 holds=false
   product-catalog-first-page-absolute-links asWritten: observed=8 compared=8 matched=8 fields=32/32 holds=true
   product-catalog-first-page-absolute-links absoluteOnRunOrigin: observed=8 compared=8 matched=0 fields=32/32 holds=false
   product-catalog-first-page-absolute-links absoluteOnOtherPort: observed=8 compared=8 matched=0 fields=32/32 holds=false
   ```
7. **Negative probes.**
   - **How they ran:**
     - In a scratch copy of the current `src`, confirmed identical with
       `diff -r`.
     - Each probe made one change, compiled, and ran the three unit test
       files: 38 tests, all passing unchanged.
     - The copy was restored after each probe and confirmed identical again
       with `diff -r`.
     - They never ran against the shared `dist`, so no other worker could
       pick up broken code.
   - **Results:**
     - P1: `matchesRecord` back to `!==` -> 2 fail (the Flow lane test and
       the extraction test).
     - P2: `assertFlowExtraction` without the comparison -> 1 fail.
     - P3: `judgeFlowExtraction`'s measurement without the comparison ->
       1 fail.
     - P4: no `//` guard -> 1 fail (single leading slash).
     - P5: no strip guard -> 1 fail (text the parser strips).
     - P6: no `actual.origin` check -> 1 fail (single leading slash, `/\`
       case).
     - P7: no `null` guard -> 6 type errors and 1 fail.
     - P8: `creation/lane.ts` drops the origin -> `error TS2345` at
       `lane.ts(127,89)`.
     - P9: `run-flow-lane.ts` drops the origin -> `error TS2345` at
       `run-flow-lane.ts(197,42)`.
   - **A slip during P8/P9, now fixed:** piping them to `head -1` stopped
     the script before it restored the scratch copy, so P9 also showed P8's
     error. The scratch copy was then restored and `diff -r` returned 0. The
     working tree was never mutated (checked with `grep`).
8. **Lab script tests:** `pnpm lab:test` -> exit 0, tests 73, pass 73,
   fail 0.
9. **Structure audit:** `node scripts/structure-audit.mjs` -> exit 0,
   `structure-audit: passed (61 warning(s), 122 baselined).` No warning
   names any file I touched. `extraction.ts` is 239 lines,
   `expectations.ts` 283, and the new module 63.

## Not verified

- **No live run.** This follows the brief, so no campaign row has been
  re-judged. The live run kept no values, so the cause is shown by
  reproducing its exact measurement (8 / 8 / 0 / 32 / 32), not by reading
  its records.
- **Not run:** the root `pnpm check`, `pnpm test` and `pnpm build`. Only the
  checks the brief names ran.
- **The recording lane is untouched.** It still compares exactly: its reads
  come from the fixture's own `@href` selectors, and its call site belongs to
  someone else.
- **Other workers may have seen my half-finished edits.** Another worker's
  build of this package compiled my tree at 20:37:05, while my edits were
  half applied. Its `dist/flow-lane/creation/judgement.js` predated my edit
  to that file.
  - Any test or type-check another worker ran in that window may have seen
    type errors or mixed output from my files.
  - Every later build here was clean.
- **Two more tasks probably benefit, but I did not test them.** Any other
  judged field whose fixture writes a root-relative path should benefit the
  same way, for example `product-catalog`'s `image` / `deferredImage`
  columns, used by the photos task.

## Open questions or contradictions found

1. **Ownership (recommendation: keep the edits).** As described above, I
   edited `flow-lane/expectations.ts`, `flow-lane/creation/judgement.ts` and
   `flow-lane/creation/lane.ts`, which the brief did not list as mine, to
   pass the origin. Without them the fix does not reach the campaign.
2. **The recording lane, optional (recommendation: leave it).** For full
   parity, `run-scenario.ts` could pass `{ scenarioOrigin: topology.scenarioOrigin }`
   as a fifth argument to `assertExtraction`, and `runExtractionMeasurements`
   could take the same value. But:
   - `runner-wiring.test.ts` pins the exact four-argument call string, and
     another worker currently has that test modified.
   - That lane reads raw hrefs, so it gains nothing today.
3. **Documentation.** `docs/architecture/testing-facility.md` has no sentence
   stating that record values compare exactly, so nothing there is now
   wrong. If you want the rule documented, it belongs beside the description
   of the created-Flow lane's dataset judgement. The rule is at the top of
   `extracted-value-match.ts`.
4. **The earlier task's recommendation is now implemented.** Open question 1
   of `w2-created-scrape-fields.md` can close. The instruction does not need
   the "as the page writes it" rewording.
