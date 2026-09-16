# x5f-refuse-unjudgeable-expectations

## Outcome

**Done, with one caveat the supervisor must decide on.** `assertExtraction` now
refuses an entry declaring `pages` or `truncated` that nothing reported,
throwing `fixture.invalid` and naming the entry's step and every unjudgeable
field, instead of returning a pass. Two tests cover the refusal and the same
entry passing once `observed` is supplied. The package suite is **859 passed,
0 failed** (857 before), with no newly failing test.

The caveat: **six fixture entries now fail**, listed in section 3. I changed no
fixture and no pinned call site, as the brief required. Two of the six are
reachable from the week1 corpus today; the other four are not yet in any corpus
row.

A second caveat on validation: my mutation check was **denied by the permission
system**, so the claim "these tests fail without the refusal" is not proven by
mutation. See Not verified.

## What changed and why

### `run-expectations/extraction.ts` (184 lines, was 156)

The defect was that `observed` is an optional fourth parameter — forced, because
`run-scenario.ts:310` and `flow-lane/expectations.ts:104` are pinned and
`runner-wiring.test.ts:228` asserts the exact three-argument call text. The old
code read `entry.pages !== undefined && observed.pagesRead !== undefined`, so an
entry declaring `pages` against a caller reporting nothing fell through every
comparison and the function returned normally. The fixture said "three pages",
nothing checked it, and the run went green.

Two changes:

- A new private `unjudgeableFields(entry, observed)` returning the declared
  fields nothing reported: `pages` without a `pagesRead`, `truncated` without a
  `truncated`. Empty for an entry declaring neither, which is every entry the
  pinned callers can judge in full today.
- In `assertExtraction`, immediately after the `entry.step !== stepId` skip and
  **before any content assertion**, a non-empty result throws. Placing it first
  means the failure always names the unjudgeable entry rather than whichever
  comparison happened to fail first; an entry that is both unjudgeable and
  wrong is a facility defect before it is a behaviour defect.

The category is **`fixture.invalid`**, not `runtime.behavior`. This matters
beyond tidiness: `runtime.behavior` asserts the automation misbehaved, and the
bench's failure-category accuracy compares reported categories against expected
ones (`evaluation.ts:135`). Classifying "the runner observed nothing" as an
automation failure would blame FluxIQ for the runner's own missing observation
and corrupt that metric. `fixture.invalid` is the established category for "the
facility could not produce a trustworthy judgement" and is already used this way
in `bench/closeout-comparison.ts:17,36,38`.

Message and details, for one unjudgeable field:

```
Extract step read declares pages, which nothing reported for this run, so the expectation cannot be judged
details: { stepId: "read", unjudgeableFields: ["pages"], expectedPages: 3 }
```

Both fields at once are named in one failure (`declares pages and truncated`),
and a half-observation still refuses the half nothing reported. `details`
carries counts and booleans only, so D6 holds.

`measureExtraction` is **unchanged**. Measuring an unreported value as `null`
(`pagesFollowed`, `truncated`) is correct and is what X5.3 and the bench read;
refusing is a judging decision, not a measuring one. The default
`observed = NOTHING_REPORTED` also stays, because it is what lets the two pinned
three-argument call sites compile. The refusal is what converts their silent
pass into a loud failure.

### `run-expectations/tests/extraction.test.ts` (129 lines, was 99)

Two assertions encoded the old behaviour and had to be inverted — they are in the
file I own, not pinned call sites:

- `:91` `assert.doesNotThrow(() => assertExtraction([{ step: "read", pages: 3 }], "read", records))` → `assert.throws(… /declares pages, which nothing reported/)`
- `:98` the same for `truncated: true`

Two tests added:

- *"an expectation nothing can judge is refused as fixture.invalid, naming the
  entry and every unjudgeable field"* — asserts the category, the exact message,
  and the exact `details`. Its first case uses `{ count: 2, records, pages: 3 }`
  against matching records, so the count is right and every record matches:
  **without the refusal this entry reads as a pass**, which is precisely the
  defect. It also covers both fields named in one failure, a half-observation
  refusing the unreported half, an entry declaring neither field passing, and an
  entry naming another step not being this step's to judge.
- *"the refused entry passes unchanged once observed supplies what it declares"* —
  the same entry throws with three arguments, passes with `observed`, and then
  **fails on its own terms** (`read 2 page(s), expected 3`) when `observed`
  carries a wrong value. That last line is the point: supplying the observation
  judges the entry rather than waving it through.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

1. `pnpm --filter @fluxiq-web-extension/test-runner build` — exit 0. Meaningful
   in itself: it type-checks the two untouched pinned callers against the
   signature, which I did not change.
2. `node --test packages/test-runner/dist/run-expectations/tests/extraction.test.js`
   — `# tests 14 # pass 14 # fail 0`, exit 0 (12 before).
3. `pnpm --filter @fluxiq-web-extension/test-runner test` —
   **`# tests 859 # pass 859 # fail 0`**, exit 0. Was 857. The delta is exactly
   my two new tests; **no test newly fails**. No unit test outside my own file
   constructs an `ExpectedExtraction` carrying `pages` or `truncated`, which is
   why the refusal is invisible to the rest of the suite.
4. Mutation check — **attempted and denied.** I disabled the guard
   (`unjudgeable.length > 0` → `> 99`) intending to observe the new tests go red.
   The build-and-test command was refused by the permission system's
   "Security Test Removal" classifier. That is a fair reading of the shape of
   what I did, so I did not work around it. I restored the guard immediately and
   verified the file is **byte-identical to the pre-mutation backup**
   (`sha256 9956e9e7b43b852015fcbda978c933112bb0374a8338a5b1d9940fd30cb5d14b`,
   `diff -q` clean), then re-ran the full suite: `# tests 859 # pass 859 # fail 0`.
   The mutation never survived past that one denied call and is not in the tree.
5. `node scripts/structure-audit.mjs` — exit 1, **2 violations, neither mine**,
   both `[working-docs]` on shared documents outside my ownership: the plan
   document is 961 lines past the 800-line compaction threshold, and
   `docs/working/README.md` is out of date. My files draw no `file-lines`
   warning at 184 and 129 lines, both under the 400-line advisory.

## Not verified

- **No browser, e2e, or Playwright run.** The fixture list in section 3 is
  derived by reading the call sites, `week1.ts`, and `flowExtractionExpectation`
  — not by running the Lab. I did not watch the refusal fire in a real run.
- **The mutation check did not happen** (item 4 above). So "these two tests fail
  if the refusal is removed" is reasoned, not observed. The supervisor may want
  to run it: disabling the guard should redden tests 11, 12, 13 and 14 of
  `extraction.test.js`. Everything else in this report was observed.
- **The Flow-lane claim in section 3 is read from source, not measured.** That
  `assertFlowExtraction` returns early as `not_applicable` today comes from
  `flow-lane/expectations.ts:57-75` and its doc comment, not from a Flow run.
- I did not run `pnpm check`, `pnpm test` or `pnpm build` at the repository root;
  other workers hold files in this package concurrently.
- I did not run the scenario-lab e2e specs.

## 3. Fixture entries that now fail, and the lane each runs on

Six entries, unchanged by me. Reading the two call sites:

- **Recording lane** (`run-scenario.ts:310`) asserts every extract step with
  three arguments. Its reader returns records only
  (`scenario-steps/extract-records.ts:61`, `Promise<ExtractedRecord[]>`), so
  `observed` is always nothing-reported and **the refusal always fires**.
- **Flow lane** (`flow-lane/expectations.ts:104`) is also three-argument, but
  `assertFlowExtraction` returns early unless `flowExtractionExpectation` is
  `judged`, which needs the approved Flow to hold a `web.dom.extract` or
  `web.dom.extract_list` node. A recording's `extract` step is the runner's own
  check rather than a user action, so Core proposes no extract node and these
  resolve to `not_applicable` (`:57-67`). **The refusal does not fire on the
  Flow lane today.** It begins firing when X4 makes extraction recordable,
  unless `observed` is supplied first.
- Variants run **only** on the Flow lane; unarmed workflows run on both
  (`week1.ts:18-21`).

| # | Entry | Step, field | Corpus row | Lane it runs on | Fails today? |
| --- | --- | --- | --- | --- | --- |
| 1 | `product-catalog/manifest.ts:110` workflow `paginated-extraction` | `extract-all-pages`, `pages: 3` | W05 unarmed | recording + Flow | **Yes, recording lane** |
| 2 | `product-catalog/manifest.ts:177` workflow `in-stock-only` | `extract-in-stock`, `pages: 3` | W07 unarmed | recording + Flow | **Yes, recording lane** |
| 3 | `product-catalog/manifest.ts:120` variant `short-catalog` | `extract-all-pages`, `pages: 1` | W05 variant | Flow only | No — `not_applicable` today |
| 4 | `product-catalog/manifest.ts:129` variant `link-pagination` | `extract-all-pages`, `pages: 3` | **none** | direct CLI only | Only if invoked directly |
| 5 | `product-catalog/manifest.ts:226` workflow `numbered-pages` | `extract-numbered-pages`, `pages: 3` | **none** | direct CLI only | Only if invoked directly |
| 6 | `data-table/scenario.ts:54` variant `large-table` | `extract-inventory`, `truncated: true` | **none** | direct CLI only | Only if invoked directly |

So **two week1 results break today**: W05 unarmed and W07 unarmed, both on the
recording lane. Rows 4 to 6 are the new x5d/x5e fixtures, which no corpus row
reaches yet — `W05`'s variants are `["short-catalog"]` only and `W08`'s are
`["column-reorder"]` only — so they will start failing the moment they are added
to a corpus or run directly.

**The decision for the supervisor** is whether these six hold their `pages` and
`truncated` expectations until X5.3 supplies `observed`, or drop them. My
recommendation, not implemented: **hold them and let W05 and W07 fail loudly**.
A red recording-lane result is accurate — the fixture states a pagination
expectation the runner genuinely cannot judge — and X5.3 is the work that makes
it green. Dropping the fields would restore the green-while-unjudged state this
brief exists to remove, and re-adding them later is easy to forget.

### A second, separate silent-pass site, reported not fixed

`apps/scenario-lab/e2e/data-table.spec.ts:43-50` has its own local
`expectExtracted`, unrelated to the runner, which checks **only** `count` and
`records`:

```ts
if (expectation.count !== undefined) expect(actual).toHaveLength(expectation.count);
if (expectation.records) expect(actual).toEqual(expectation.records);
```

It ignores `pages` and `truncated` entirely, so the same class of defect exists
there. It bites nothing today because that spec has no `large-table` test, but a
future one would silently not judge `truncated: true`. The file is must-not-touch
for me; flagging it so the fix lands with X5's fixture work.

## 4. Can `matchedRecords = min(expected, observed)` mask a real failure?

**Yes, and the risk scales with the count.** Recommending only; X5.5 owns this.

`extractionRecordAccuracy` is pooled, not averaged per step: Σ matched ÷
Σ max(expected, observed) (`ex-d-test-facility.md:223`). For a count-only entry
x5b sets `matchedRecords = min(expected, observed)`, so when the count is right
`expected == observed == n` and the step contributes `n/n = 1.0` — a perfect
score for a step where **not one record value was compared**.

Concretely: `data-table`'s `large-table` expects `{ count: 1000, truncated: true }`
with no `records`. If the extractor returned 1,000 duplicated rows, 1,000 empty
strings, or simply the wrong 1,000 rows, `matchedRecords` is still 1,000 and
record accuracy still reads 1.0. The same holds for `infinite-feed`'s
`{ count: 25 }` (`scenario.ts:81`) and the `count: 0` empty-list entries.

Pooling makes it worse than a per-step distortion. ex-d:223 sizes the tolerance
at one record of the population, "about 1/68 per week1 repeat". A single
count-only step worth 1,000 pooled matches would swamp that population outright:
the corpus rate would become mostly a measure of one unjudged count, and a
genuine record regression elsewhere could move it by far less than its tolerance
and pass unseen. That is a false success in a published metric.

The root cause is the one x5b named: ex-d:223 wants count-only and record
entries in **different** rates, and `RunExtractionMeasurement` is counts-only, so
nothing in it lets the aggregator tell the two apart.

**Recommendation.** Add a counts-only discriminator — a `comparedRecords` member:
the number of positions actually value-compared, which is
`min(expected, observed)` for an entry listing `records` and **0** for a
count-only entry. Then:

- `extractionRecordAccuracy` = Σ matchedRecords ÷ Σ max(expected, observed),
  over steps with `comparedRecords > 0`;
- `extractionCountAccuracy` = steps where `expectedRecords === observedRecords` ÷
  steps, over the count-only population.

This keeps D6 (no step id, field name or page value), preserves x5a's bounds, and
needs no access to the workflow expectation at aggregation time. The alternative
— setting `matchedRecords = 0` for count-only entries and excluding steps with
`expectedFields === 0 && matchedRecords === 0` — I would **not** take: it is
ambiguous with a genuine total mismatch and reintroduces the false 0 x5b
deliberately avoided. Either way, X5.5 must stop pooling count-only entries into
record accuracy, which is what happens today.

## Open questions or contradictions found

1. **Rows 4 to 6 are invisible until someone adds them to a corpus.** The new
   `numbered-pages`, `link-pagination` and `large-table` fixtures carry
   expectations no bench row exercises. They are neither green nor red — they are
   unrun. Worth a corpus decision alongside the hold-or-drop one.
2. **The Flow lane will inherit this the moment X4 lands.** Once recordings
   propose extract nodes, `flowExtractionExpectation` flips from
   `not_applicable` to `judged` and every entry in the table starts hitting the
   refusal on the Flow lane too. X5.3 and X5.5 should supply `observed` before
   or with that change, or the Flow lane goes red in the same week.
3. **`assertFlowExtraction` cannot pass `observed` even when it has it.** The
   Flow lane will hold per-node `truncated` from Core's dataset summaries (X5.5,
   `RunExtractionMeasurement`/K5), but `expectations.ts:104` is pinned to three
   arguments. Unpinning that call site is X5.5's, not mine; noting it so the
   refusal is not mistaken for a reason to relax the guard.
4. **`runner-wiring.test.ts:228` pins call *text*, not behaviour.** A test
   asserting a source file contains an exact call string will block any future
   attempt to pass `observed` from `run-scenario.ts`. X5.3 must update that
   assertion deliberately rather than discover it as a failure.
