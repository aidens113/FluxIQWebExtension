# Run debug — `everything-store-plus-earbuds-under-50`, 2026-09-24

Rung 3 of the ladder and the first of the ten realistic sites. This is the case
that has never produced a correct answer. Stage 1 written before any result was
read.

---

## Header

- Run id: pending
- Scenario / task: `everything-store` / `everything-store-plus-earbuds-under-50`
- Command: `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/live-campaign.mjs everything-store-plus-earbuds-under-50`
- Code under test: `dev`, **without** the wrong-answer repair route, which is
  still on `task/t124-phase0-debuggable-run`. So this run measures creation
  only: if it answers wrongly, no repair can save it yet.

## Stage 1 — the instruction and the expected chain

**The instruction, verbatim:**

> Find every pair of wireless earbuds in the store's search results that is
> Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going
> through every page of results. Leave out sponsored placements and accessories
> such as ear tips or charging cases, list each pair only once even if it turns
> up on two pages, and keep the order the search results show them in, with
> columns name, price, rating and url.

**What a correct answer requires.** This is far harder than anything attempted
so far, and it carries at least seven separate obligations:

1. **Search** for wireless earbuds — the results do not exist until something
   is typed and submitted.
2. **Three filters, all of which must hold together**: Plus eligible, rating
   ≥ 4.0, price < $50. Each may be a facet control on the page or a predicate
   applied to extracted rows; either is legitimate, but all three must apply.
3. **Every page** — pagination genuinely traversed, not the first page taken
   for the whole set.
4. **Exclude sponsored placements**, which look like ordinary results.
5. **Exclude accessories** — ear tips, charging cases — which match the search
   term but are not pairs of earbuds. This one is semantic, not structural.
6. **Deduplicate across pages**, since a product can appear on two pages.
7. **Preserve the order the search results show**, so the answer is not merely
   the right set but the right sequence.

**The expected chain**, at minimum: navigate, type the query, submit, then
either apply facet controls or extract across pages, with the filtering,
exclusion, dedupe and ordering expressed in the extraction node's own
parameters rather than left to chance. Roughly eleven nodes by the corpus
inventory's estimate.

**What a wrong answer that looks right looks like here.** Several, and they are
the point of this scenario:

- The first page only, with the right columns and plausible rows.
- Everything matching "earbuds", including ear tips and charging cases, which
  have names, prices and ratings and so pass any shape check.
- Sponsored rows included, which are indistinguishable from organic ones by
  column shape.
- Duplicates across pages, which inflate the count while every row looks valid.
- The right set in the wrong order, which only an order-sensitive comparison
  catches.

Any of these produces a table that reads as a correct answer. Stage 5 must
therefore compare rows and their order, not shape or count.

## Stage 2 — exploration

Pending.

## Stage 3 — the proposed Flow

Pending.

## Stage 4 — replay

Pending.

## Stage 5 — the answer

Pending.

## Stage 6 — judgement and repair

Pending. Note the repair route is not on this build, so a wrong answer is
expected to end at the verdict rather than be corrected. What matters here is
whether the verdict is *correct* — that a wrong answer is judged wrong.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
