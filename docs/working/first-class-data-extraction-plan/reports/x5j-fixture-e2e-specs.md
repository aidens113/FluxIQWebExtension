# x5j-fixture-e2e-specs

## Outcome

**Done.** All three Playwright specs the brief named are fixed and green, and
the `infinite-feed` seed question is decided and implemented. Nothing in this
report rests on reasoning about what Playwright would do: every spec was run
before the change to observe the real failure, and after it to observe the
pass. No run failed non-reproducibly, so the machine's RAM-fault retry rule was
never invoked.

The three breakages were exactly as the brief predicted. Each **type-checked
before and after**, so `pnpm check` was green the whole time and only a real
browser run could tell the difference.

## What changed and why

### `product-catalog.spec.ts` — the runs table, `null` fields, numbered pages

- **The `runs` table goes from 7 rows to 13**, in the manifest's own
  enumeration order, which the first test pins. The six new rows are
  `primary/sparse-cards`, `primary/absolute-links`,
  `paginated-extraction/link-pagination`, `with-images/baseline`,
  `with-images/lazy-images` and `numbered-pages/baseline`.
- **The oracles are derived from `state.ts`, not guessed.** Only the `results`
  route records a view (`show`), and `set-variant` resets to the start page, so
  every variant that merely changes how a card renders leaves
  `viewHistory: []` and keeps the baseline's first-page oracle:
  `sparse-cards`, `absolute-links` and `lazy-images` change no product's
  membership of the listing, only its markup. `link-pagination` and
  `numbered-pages` both end on page 3 with `viewHistory: [view(2), view(3)]`,
  because both reach page 3 through two client-side view changes; the
  `link-pagination` anchor does not navigate, since the client's handler
  matches `[data-page]` and calls `preventDefault()`.
- **A field the page does not carry now reads as `null`, not `""`.** This was
  the second latent breakage in that file, under the one the brief named: the
  old helper ended every field read with `?? ""`, which flattens "the element is
  absent" and "the element is empty" into the same value. `sparse-cards` omits
  a card's price element entirely and `with-images` reads a `data-src` that an
  eager card does not carry, and both manifests expect `null` (D16). Exact
  equality against those records is now the assertion, so `optionalFields`
  needs no special handling and a regression to `""` fails loudly.
- **`numbered` pagination is supported.** The controls are matched by the
  step's plain CSS target `[data-testid^="pagination-page-"]`; control 0 is the
  page already read, so the next control sits at the index of the pages read so
  far. `loadMore` and `scroll` still throw — this fixture offers neither.
- **`locate()` replaces `byTestId()`**, which threw on any target not starting
  `testid:`. That was the second half of the `numbered-pages` breakage: its
  pagination target is deliberately raw CSS (x5d resolved the `testid:` prefix
  question that way), and the old helper could not express it at all.
- **`pages` is now judged**, by having the reader return how many pages it
  covered. Four entries declare it (`pages: 3` on W05, W07 and
  `numbered-pages`, `pages: 1` on `short-catalog`) and none was checked before.
  `truncated` is refused rather than skipped, for the reason given below.
- **Page facts now come from `scenarioPageFactSchedule(..., "arms-before-loading")`
  instead of `workflow.expected.pageFacts`.** `resolveScenarioWorkflow` merges a
  variant over its workflow with a plain object spread, so a variant that
  declares no `pageFacts` silently inherits the workflow's — which describe the
  *unarmed* rendering — and this spec then asserted them against an *armed*
  page. `scenario-workflow.ts:8-17` calls the merged field "dead weight: no lane
  reads it" and names this spec as the one assertion still reading it. This spec
  arms before it loads, which is precisely the `arms-before-loading` lane, so
  the schedule gives it the correct set: a variant's own declared facts, and the
  workflow's otherwise. This is the established pattern here rather than a new
  one — `member-directory.spec.ts:50-51` already drives its runs table exactly
  this way.

### `infinite-feed.spec.ts` — the seed decision, and two exact-equality assertions

- **Decision: the spec moves to the scenario's declared seed, read off the
  scenario rather than written down again.** `const SEED = infiniteFeedScenario.seed`
  replaces `const SEED = 42`.
- **Why not the other option.** Making the feed content seed-independent, as
  `data-table`'s fixed catalog is, would mean editing `feed-content.ts` under
  `apps/scenario-lab/src/**`, which this brief puts in my "Must not touch" list.
  That option was not mine to take, so the choice was between the two ways of
  landing on 116.
- **Why this is the one that does not pin a seed in two places.** The literal
  `116` now exists once, as `FEED_SEED` in `scenario.ts`. The scenario's `seed`,
  the manifest's `seed` and the manifest's expected records all derive from it,
  `defineScenario` already throws if the definition and manifest disagree on
  `seed`, and the spec now resolves its `labSeed` and its expected records from
  the same field. Writing `116` in the spec would have restored the very
  two-places problem in the other direction.
- **The two assertions** at `:85` and `:144` now read
  `toEqual([{ step, count, records: expectedRecords(n) }])`. Keeping them as
  exact equality on the whole entry is deliberate: it is what makes a field this
  spec does not judge — a `pages` its reader never counts — fail here instead of
  passing unseen, so this file needs no separate refusal guard.

### `data-table.spec.ts` — the silent pass, refused

`expectExtracted` now refuses an entry declaring `pages` or `truncated`,
naming every unjudgeable field in one failure, instead of skipping it. This is
the same defect and the same shape of fix as X5-F's, one level down.

**It refuses rather than judges, and that is the honest answer to the brief's
"or state why it cannot".** This spec drives the recording script with plain
Playwright: it follows no pagination and applies no extraction cap. `truncated`
on `large-table` is not a property of the page at all — the page has 2,000 rows,
and `truncated: true` is what FluxIQ's 1,000-record cap must report about its own
read. Nothing this spec can observe distinguishes a correct truncated read from a
broken one, so judging it here would be a claim the file cannot support.

A test was added to prove the refusal fires, rather than leaving it as a
reasoned claim: it asserts each field is refused, both are named together, an
entry declaring neither is still judged, and it pins `large-table`'s expectation
as the entry the guard exists for.

## Commands run and observed results

Run from `F:\!FluxIQWebExtension`, one at a time, never concurrently.

### Baselines, before any edit

| Spec | Observed |
| --- | --- |
| `test:e2e product-catalog` | **1 failed, 8 passed.** `every manifest workflow and variant has an e2e run` — `toEqual` diff missing exactly `primary/sparse-cards`, `primary/absolute-links`, `paginated-extraction/link-pagination`, `with-images/baseline`, `with-images/lazy-images`, `numbered-pages/baseline` |
| `test:e2e infinite-feed` | **2 failed, 2 passed.** Both `expect(workflow.expected.extracted).toEqual([{ step, count }])` at `:85` and `:144`; the diff shows the manifest's seed-116 content (`"title": "Harbor lights #23"`, `"author": "Elena Varga"`) against a spec deriving seed 42 |
| `test:e2e data-table` | **3 passed.** Confirms x5f's reading: the silent pass bites nothing yet, because no running test declares `pages` or `truncated` |

### After the changes

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | Passed, no diagnostics, exit 0. Runs `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.e2e.json`, so the e2e project is type-checked |
| `test:e2e product-catalog` | **15 passed** (was 9 tests, 1 failing; now 15) |
| `test:e2e infinite-feed` | **4 passed** |
| `test:e2e data-table` | **4 passed**, including `an extraction expectation this spec cannot observe is refused rather than skipped` |
| `node scripts/structure-audit.mjs` | `1 violation(s) across 1 rule(s)` — `[working-docs] docs/working/README.md is out of date`. **Not mine**: I edited nothing under `docs/` except this report. No `[file-lines]` warning names any file I touched |

Owned file sizes, all under the 400-line advisory and far under the 800-line
hard limit: `product-catalog.spec.ts` 246, `infinite-feed.spec.ts` 159,
`data-table.spec.ts` 142.

The `product-catalog` and `infinite-feed` specs were run again unchanged after
the final `data-table` edit, so the three green results above are one
consistent state of the tree.

**One file in my owned directory is modified but is not mine.** `git status`
shows `M apps/scenario-lab/e2e/member-directory.spec.ts`. I never opened it for
editing: the same `git status --short apps/scenario-lab/e2e/` run *before* my
first edit already reported that file, and only that file, as modified. It
arrived in the working tree from elsewhere. The three files I changed are
`product-catalog.spec.ts`, `infinite-feed.spec.ts` and `data-table.spec.ts`,
plus this report.

## Not verified

- **None of this is evidence about FluxIQ's extraction engine.** These specs
  play recording scripts with plain Playwright to check that the *fixture*
  serves what the manifest declares. No extension, no domain, no Core, and no
  part of the real extractor ran. A passing row here means the page and the
  manifest agree, not that extraction works.
- **`truncated` and the 1,000-record cap are unjudged**, by construction, and
  `large-table` has no browser test at all.
- **`empty-table` and its `no-rows` variant have no e2e coverage.** The
  data-table spec covers 3 of the manifest's 6 workflow/variant combinations.
  I did not add tests for the rest: the brief scoped me to making the judging
  honest, and adding fixture coverage is a larger piece of work.
- **`infinite-feed`'s three new paginated entries have no e2e coverage** —
  `extract-until-end` (scroll), `extract-by-load-more` (loadMore) and
  `load-more-button`. This spec's reader drives neither mode, and x5e reports
  the Lab's own reader does not either.
- **The `truncated` refusal in `product-catalog.spec.ts` is unexercised**; no
  catalog entry declares the field. Only data-table's refusal has a test.
- **`numbered-pages` passes here as a fixture check only.** D14 says the page
  refuses `numbered` pagination until X3, so this proves the controls and the
  markup, not that the product can drive them.
- I did not run the repository-wide `pnpm check`, `pnpm test` or `pnpm build`,
  nor the scenario-lab unit suite: other workers hold files in this tree, and
  `pnpm --filter … test` rebuilds every scenario from `src/**`.
- I touched nothing outside `apps/scenario-lab/e2e/`.

## Open questions or contradictions found

1. **The coverage gap is structural, and only one spec is protected from it.**
   `product-catalog.spec.ts` has an enumeration test that fails when the
   manifest gains a workflow or variant without a run — which is the only
   reason this whole class of breakage was visible at all. `data-table.spec.ts`
   and `infinite-feed.spec.ts` have no such guard, which is exactly why x5e
   could add three workflows and a variant to `infinite-feed` and two to
   `data-table` with nothing going red. **Recommendation:** give both specs the
   same enumeration guard. It converts "a fixture landed with no run" from
   invisible into a failing test, which is the mechanical enforcement this
   repository prefers over written guidance.
2. **The deeper seed fix is still open and is not mine.** The feed's content
   remains a function of the lab seed, so a real run with `--seed` still
   invalidates the manifest's records. Making the feed content fixed, as
   `data-table`'s catalog is, would remove the seed from the expectation
   entirely; it needs `apps/scenario-lab/src/scenarios/infinite-feed/**`.
3. **`expected.pageFacts` lost the reader the contract names, but is not yet
   droppable.** `scenario-workflow.ts:8-17` keeps the field on the resolved
   workflow only because "one fixture assertion still reads it for a variant
   (`product-catalog.spec.ts`)". That reader is gone: grepping every call site,
   no spec now reads the *merged* `expected.pageFacts` for a variant selection.
   Dropping the field is still not free, though. Six reads across five files take
   it off a resolved workflow with **no** variant selected, where the merge is a
   no-op and the value is simply the authored workflow's facts:
   `storefront-checkout.spec.ts:81`, `file-transfer.spec.ts:64` and `:76`,
   `multi-tab.spec.ts:73`, `intermediate-state.spec.ts:40`, and
   `auth-gate.spec.ts:68`. Each would have to move to the manifest or to the
   schedule before the resolved value could lose the field. I corrected this
   item after checking: my first draft claimed the field was now droppable,
   which the call sites do not support.
4. **Judging is uneven across the three specs, deliberately.**
   `product-catalog` judges `pages` because its reader follows pagination;
   `data-table` refuses it because its reader does not; `infinite-feed` catches
   it through exact equality on the whole entry. All three are loud, but a
   reader moving between the files should not expect one mechanism.
5. **Two of the catalog's workflows carry no corpus row**, which x5f raised as
   its own open question 1. Their tests are named `no corpus row
   with-images/baseline` and `no corpus row numbered-pages/baseline`, so the
   fact is visible in the run output rather than buried in the manifest.
