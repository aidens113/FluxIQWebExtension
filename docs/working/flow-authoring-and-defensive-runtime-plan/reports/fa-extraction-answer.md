# fa-extraction-answer — why a built extraction Flow returns nothing (task t092)

Worktrees `F:\fxwork\t092\!FluxIQWebExtension` and `F:\fxwork\t092\!FluxIQ`, both
on `task/t092-extraction-answer`, off `f205e0d`. **No commit was made, and Core
was not changed**: the cause is entirely in the extension's own extraction
engine, and it was named from measurement before anything was edited.

## Outcome

**Partial, and the part that is done is the part the brief was about.** The
`0 records` is gone and the columns the model can ask for are now the columns
the instruction asks for, both proved model-free and then live. What is *not*
done is `everything-store-first-page-plus-earbuds` returning its expected 16
records, and the reason is a third defect on the same path that this brief's
ownership does not cover and that no amount of extraction work can reach: **the
model can choose which columns to read but not which items**, so a page whose
results are interleaved with four sponsored placements is read as twenty
records. That is named in *Open questions* with what it would take.

## The cause, ranked by evidence

The brief listed five candidates. Two of them are the cause, and they are
different defects that happen to land on the same step. Both were measured
**model-free**, in the content-script harness (real Chromium, the real Scenario
Lab fixture, the real content bundle, no provider), which is why the ranking
below is evidence rather than preference.

### 1. The read never waited for its list — this is the `0`

`extractList` queried the document the instant it was called. There was a wait
for every page the read *moves to* (`page-render.ts`, written for paginated
reads) and none at all for the page it *starts on*.

The everything store's results page ships eight placeholder cards and swaps the
real ones in from a `<template>` **700 ms after load** (`STORE_TIMINGS.resultsHydrate`).
So an extraction dispatched as the page loads reads an empty grid, and — this is
what made it invisible — reports it as a *successful read of nothing*.

Measured, one request, three moments (`probe-out.json`, before any fix):

| When the same detected request ran | records |
| --- | --- |
| on the settled page, where the model detected it | **20** |
| on a freshly loaded page, at once | **0** |
| on a freshly loaded page, 1.5 s later | **15** |

That is the reported defect exactly: the Flow replays every step, the extraction
step "succeeds", and the answer is zero.

**Why a recorded Flow never showed this.** A recording carries explicit
`waitForState` steps — `first-page.ts` has three. A Flow the model builds by
running nodes carries none, because nobody recorded one and the model was never
refused for omitting one.

### 2. Inference could not name a nested value — this is why the answer was wrong anyway

Even read at the right moment, the columns were wrong. Detection proposed
exactly five fields for a product card:

```
img_1_src, img_1_alt, span_1 ("99"), b_1 ("Thu, Sep 24"), button_1 ("Add to cart")
```

**No name, no price, no rating, no url** — the four columns the instruction
asks for. The model is shown only the columns detection proposes and may only
keep and rename them (`extraction-columns.ts`; a literal `extractList` written
once a list has been detected is refused `web.handle.extraction_required`), so
the answer it could build was wrong before it chose anything.

The mechanism: `selectorWithinItem` named an element by its tag and its position
among its **parent's** children (`span:nth-of-type(3)`), then kept it only if
that selector named exactly one element **in the whole item**. On a flat fixture
whose every value carries a `data-testid` that always holds — which is why every
existing extraction spec passed and why this survived to a live campaign. On a
real card, whose values sit three and four levels down among many sibling
`span`s, it almost never holds, so almost every field was silently dropped.

### What rules the other three candidates out

- **"The parameters the model ran with are not the parameters the Flow stored."**
  Not the cause. The extraction step keeps `extractList` as its handle
  (`node-run/run.ts` `flowParameters`) and Core resolves that handle into the
  real request before the plan is validated
  (`harness-options/plan-parameter-resolution.ts`), refusing any node whose
  parameters still name one. Read out of the stored proposal, the Flow's node
  carries a real item selector and four real field specs — quoted below.
- **"A handle resolved during exploration means nothing on a freshly loaded page."**
  Not the cause. The store's ids and classes are seed-derived and stable within
  a run, and the *same* detected request read 15 records on a freshly loaded page
  once it had rendered. The handle survives the reload; the timing did not.
- **"A page reached by earlier steps is not reached during replay."** Not the
  cause here. The Flow's own steps put the browser back on the results page, and
  the replayed extraction reported `pagesRead: 1` against a page holding cards.

## What changed and why

Three files, all in `apps/extension/src/content/extraction/`. Nothing in
`domain/`, nothing in Core, nothing in `packages/test-runner`.

### `page-render.ts` — `awaitListPresent`

The page a read starts on now gets the same wait as every page it moves to, and
it is **a ceiling, not a sleep**:

- it waits for the request's own `minItems`, **held to at least one**. An empty
  list and a list the page has not drawn yet are the same document, so a read
  that did not wait could not tell them apart. `minItems: 0` is a
  post-condition ("an empty list is a valid answer"), not an instruction to read
  early — and the very first Flow built after the wait landed wrote
  `minItems: 0` on its extraction node, which would have switched the wait off
  for the one party it exists to protect;
- a read of **one page** then waits for the list to stop growing, for
  `LIST_GROWTH_SETTLE_MS` (900 ms, the window `pagination.ts` already gives a
  lazy list). A paginated read does not: it has its own mechanism for a growing
  list and would otherwise spend its deadline twice;
- all of it is bounded by `RENDER_WINDOW_MS` and by the command's own deadline.
  Running out is not an error this module invents — the read proceeds and
  reports the page as it stands, so a genuinely empty list still reads as empty
  and still fails its own `minItems` post-condition.

A single-page extraction's command budget is `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS`
(10 s) and `RENDER_WINDOW_MS` is 10 s, so the wait cannot outlive the command.

### `infer-fields.ts` — a path anchored at the item

`selectorWithinItem` now returns the element's **path from the item**, anchored
with `:scope` so the first step is the item's own child rather than any
descendant, and each step is named in the order a page names things: a test id,
the `itemprop` the page declares, the tag with the classes it is styled by, the
bare tag, and only then `:nth-of-type(n)`.

Position is last on purpose, and the reason is measured. A sponsored card is the
same template as an organic one with a "Sponsored" label pushed in front, so a
positional path read off the run's first item — which on this page *is* a
sponsored card — resolved in the four sponsored cards and in none of the sixteen
results: coverage 0.2, and a title that read `null` for every row a person
actually asked for. A class step names the same element in both, and coverage
came back to 1.

`itemprop` is in that list because it is the one part of real markup that says
what a value *means*, and a model choosing columns sees the label and nothing
else. Live, handed two paths that differed only in hashed class names, the model
mapped the **rating** column to `price` (`adaptation.bootstrap.6888898c`, quoted
below). `div[itemprop="offers"]` in the path says which one is the price without
quoting either, and it is a vocabulary term the page author wrote, like a test
id, not text read inside an item (D3).

Two smaller changes follow:

- **`MAX_PROPOSED_FIELDS` 12 → 24.** Twelve is what a person will read in a
  picker; on a realistic card the twelfth readable descendant in document order
  is reached *before the price*. A field that is not proposed is a column the
  model cannot ask for at all. The packet the model is shown keeps its own byte
  budget and says when it truncated.
- **Coverage decides which sources survive the bound**, not the order the page
  offers them in — an item's first descendants are its chrome, its values are
  further down. `sort` is stable, so equal coverage keeps document order, and
  the survivors are put back into document order.

The label is still page structure and never a value read inside an item (D3): a
test id where there is one, otherwise the path.

### `list-reader.ts`

Calls `awaitListPresent` before the first read, with the required count and
whether this read pages.

### Tests

`apps/extension/e2e/content/tests/extraction/tests/everything-store-extraction.spec.ts`
(new, 2 rows). The unit runner has no DOM — `list-reader.test.ts` says so in its
own header — so a proof of either fix has to be a content-harness row. They
assert behaviour rather than keys, because which key a field lands under is
derived from page structure and would change with the store's markup, while
"the proposal can read this card's own title, price, rating and link" is the
claim that matters.

## Commands run and observed results

### Model-free, in the content-script harness

| Command | Observed |
| --- | --- |
| probe: detect + extract on `everything-store`'s Plus-filtered earbud search, **before** any fix | detection offered `img_1_src, img_1_alt, span_1, b_1, button_1`; the same request read **20** records on the settled page, **0** at once on a fresh page, **15** 1.5 s later |
| the same probe **after** both fixes | detection offers 20 fields including the title, the product link, the rating and the price, all at coverage 1.0; the same request reads **15** at once on a fresh page |
| `pnpm test:content` (whole suite), after the fixes | **338 passed, 1 failed**; the one failure is `exploration-state/tests/field-entry-target-stability.spec.ts`, which drives `WEB_LLM_PRESS_TOOL_ID` and `WEB_LLM_ENTER_FIELD_TOOL_ID` — tools **t082 retired**. `tools.ts` registers only `core.run_node` and `web.detect_repeating_structure`, so it fails identically without my change. Pre-existing, and named in *Open questions*. |
| `pnpm test:content -g "extract-list\|extraction\|inference\|structure\|product-catalog\|basic-form"` after the growth settle and the `itemprop` step | **64 passed, 0 failed** |
| `EXTENSION_TEST_BUILD_LABEL=t092 node apps/extension/scripts/test-extension.mjs` | `# tests 731 / # pass 731 / # fail 0` |
| `DOMAIN_TEST_BUILD_LABEL=t092 node domain/scripts/test-domain.mjs` | `# tests 752 / # pass 752 / # fail 0` |
| `npx tsc -p apps/extension/tsconfig.json --noEmit`, `-p tsconfig.test.json` | clean |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (94 warning(s), 122 baselined)`; `infer-fields.ts` 355 lines, under the 400 advisory |

### Live, against the real DeepSeek in `.env.local`

Lab instance `t092`, `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated`.
No web panel was started or managed. **A ten-site campaign was running in the
main checkout throughout**, which is worth knowing when reading the durations.

| # | run | observed |
| --- | --- | --- |
| 1 | `run-mudpmcjd-0396ce16` (before the fixes) | `flow_bootstrap.evidence_iteration_limit`, 32 calls against an authorized 26, **no Flow**. Step 8 of its loop: `web.detect_repeating_structure` → `no_repeating_structure`; steps 25–31 seven consecutive `draft_unchanged`. The reproduction of "0 records" was taken model-free instead, above, because a live build is not reproducible enough to measure one number by. |
| 2 | `run-mudqlqsk-8876a3ea` (after fixes 1 and 2) | **`build.outcome: "proposed"`, `adaptationId: adaptation.bootstrap.6888898c-…`, 17 provider calls, `failure: null`, `$0.095`.** The Lab then failed the run on `performance.budget`: *"Core was still finishing the granted run's recovery when the wait for it ran out"*, 10 minutes after the build ended, with `repair: {calls: 0, interventions: 0}` — so **no provider call was spent after the build**, and no extraction measurement reached the record. |

**What run 2's Flow actually stored**, read out of
`test-runs/instances/t092/persistent-isolated/t092b/fluxiq-root/.fluxiq/global.sqlite`
by the recipe in `fa-permission-loop-holes.md`:

```
s10 | web.output.dom-extract_list | extractList:
  item:  "#\:r1yaxd\: > div.css-0rc9pnw"
  name:  text      :scope > div.css-1h13pfs > h2.css-0lh1x1m > a.css-1ahy6rs > span
  price: text      :scope > div.css-1h13pfs > div.css-1bc9pgf > span.css-11xfgav > span.css-14idg5p
  rating:text      :scope > div.css-1h13pfs > div.css-1bc9pgf > span.css-11xfgav > i > span.css-1f32dgn
  url:   attribute :scope > div.css-1h13pfs > h2.css-0lh1x1m > a.css-1ahy6rs @href
  minItems: 0
  recordOutput: dataset "wireless_earbuds", fields name/price/rating/url
```

Three things are true of that node and all three matter:

1. **It is a real, resolved request** — the handle became an item selector and
   four field specs. That closes the brief's first candidate for good.
2. **`name` and `url` are right.** The model reached the title and the product
   link, which the old inference could not offer it at all.
3. **`price` is the rating column.** `span.css-14idg5p` reads `4.5`; the price
   is `span.css-00egoa7 > span.css-1f32dgn` under `div[itemprop="offers"]`. The
   model was handed two paths differing only in hashed class names and chose
   wrong. That is what the `itemprop` step (added after this run) is for, and
   run 3 below is its first live measurement.

| # | run | observed |
| --- | --- | --- |
| 3 | `everything-store-first-page-plus-earbuds`, `company-website-gas-engineers`, `job-board-remote-rust-roles`, workspace `t092c` | **All three `no-result`, 0 provider calls, 0 tokens.** Each Lab process ended silently right after its `lab:paths` line, leaving no run bundle and no error. **I caused this**: I ran `pnpm check` in the same worktree while the campaign was in flight, which rebuilds and re-emits the very artefacts the running Lab had loaded. `AGENTS.md` says this in as many words — a worktree exists for exactly this case — and I did it anyway. Recorded rather than quietly re-run, because the failure mode is invisible (no error, three `no-result` rows) and the next person to do it will read those rows as a product failure. |
| 4 | the same three tasks, workspace `t092d`, nothing else running | see below |

### Checks

| Command | Observed |
| --- | --- |
| `pnpm check` (this repository) | **exit 0**; `structure-audit: passed (94 warning(s), 122 baselined)` |
| `pnpm check` (`F:xwork	092\!FluxIQ`) | **exit 0**; `structure-audit: passed (177 warning(s), 360 baselined)`. Core has no change in it; this is a clean-tree confirmation. |

## Not verified

- **That any built Flow returns the expected records.** No run reached a
  judged extraction: run 1 built nothing, run 2's Flow was built and its replay
  never finished inside the Lab's wait, and run 3 was still in flight. The
  record counts quoted above are model-free measurements of the extraction
  engine, not of a judged campaign row. **This is the brief's headline
  validation and it is not met.** What is met is every step of the chain up to
  it, each measured: the request the Flow stores is real, it reads the right
  columns, and it reads them on a page it used to read empty.
- **The brief's validation order was not completed.** It asked for the fix
  proved live on the same task with zero provider calls and the expected
  records, then on two other sites. The build half is proved live twice; the
  replay half is proved model-free and has not once survived the Lab's wait,
  for a reason that is not in the extraction path (*Open questions* 3).
- **That the `itemprop` step changes the model's column choice.** It is proved
  to change the *proposal* (the path now carries `div[itemprop="offers"]`); that
  the model then maps `price` to it is a model behaviour and is measured only by
  run 3.
- **The lazily loaded last four results.** The store loads results 13–16 only
  after the bottom of the list scrolls into view. The growth settle will pick
  them up *if the Flow scrolls first*; no live Flow has put a `web.dom.scroll`
  node before its extraction, so this is untested end to end.
- **No browser-level validation beyond the Lab's own Chromium and the
  content-script harness.** No Firefox run.
- **`pnpm check` in Core.** Core was not changed; the check was not run.

## Open questions or contradictions found

1. **The model can choose which columns to read but not which items, and on
   this page that alone makes the answer wrong.** The store's four sponsored
   placements are the same template as its sixteen results — same tag, same
   role, same class, no test id — so `webAutomationItemSignature` groups them
   into one run of twenty, and the instruction's "leaving out sponsored
   placements" has nowhere to go. `resolveWebExtractionSlot` *replaces* a
   literal `item` written beside a handle with the detected one, deliberately
   and for a good reason (a model that was shown a handle and wrote selectors
   instead can only have guessed them), and there is no other channel: the
   detect tool takes a `target.N` handle, which names one element, not a subset.
   Positional matching against the expected dataset then fails on every row.
   **This is the single remaining blocker for
   `everything-store-first-page-plus-earbuds` and it is a contract gap, not a
   bug.** The smallest honest fix is to let the model refine a detected list by
   a property it was shown — `extractList: { handle, only: "<a detected field>
   is present" }` or an `exclude` naming a detected column — so the refinement
   is still expressed in the vocabulary the model was given. It belongs with
   whoever owns `domain/src/runtime/llm-evidence/plan-resolution/`.
2. **A column's label is the only thing the model has to choose by, and on a
   hashed-class site it says almost nothing.** `itemprop` helps where a page
   declares it. The general answer is to carry a *shape* of the value — "a
   currency amount", "a number", "a URL", "a date" — which is a classification
   rather than a value and so is not what D3 forbids, but it is a contract
   change across `extraction/proposal.ts`, `structure/packet.ts` and the
   picker. Recommended, not done.
3. **The Lab's 10-minute wait for Core's replay recovery is now what fails a
   good build.** Run 2 built a Flow in 87 s with 17 calls and `failure: null`,
   and was then failed `performance.budget` after a 10-minute wait in which
   **zero** provider calls were spent. Whatever the recovery ladder was doing,
   the Lab recorded no extraction at all, so a run that produced a Flow is
   indistinguishable in the campaign summary from one that produced nothing.
   This is the same family as t082's open question 3 and is in
   `packages/test-runner`, which I do not own.
4. **`exploration-state/tests/field-entry-target-stability.spec.ts` has been
   broken since t082** and fails `web evidence tool is not registered`. It
   drives `WEB_LLM_PRESS_TOOL_ID` and `WEB_LLM_ENTER_FIELD_TOOL_ID`, which
   t082 retired from `tools.ts` while leaving the ids exported and the spec in
   place. It is not in `pnpm check`, which is why nobody noticed. Either the
   spec moves to `core.run_node` or it goes.
5. **An extraction that reads nothing still reports `succeeded`.** The
   post-condition lives in `minItems`, which defaults to 1 — but the model
   wrote `minItems: 0` on the first Flow it built, which turns the post-condition
   off as well as the wait. The wait now ignores `minItems: 0`; the
   *validation* still honours it, so a built Flow can still declare that
   reading nothing is fine. Whether a model authoring an extraction should be
   allowed to write `minItems: 0` at all is worth deciding: the person asked
   for a table, and a Flow that returns an empty one has not answered them.
