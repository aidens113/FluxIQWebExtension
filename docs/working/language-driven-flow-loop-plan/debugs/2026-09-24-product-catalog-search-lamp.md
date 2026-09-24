# Run debug — `product-catalog-search-lamp`, 2026-09-24

The first multi-node live run attempted in this project. Rung 1 of the Phase 2
ladder. Stage 1 was written before any result was read, as the protocol
requires.

---

## Header

- Run id: pending
- Scenario / variant / task: `product-catalog` / — / `product-catalog-search-lamp`
- Command: `FLUXIQ_TEST_TARGET=isolated node scripts/lab/live-campaign.mjs product-catalog-search-lamp`
- Date, provider, model: 2026-09-24, DeepSeek, deepseek-flash
- Code under test: `dev` at 66b21cd — **without** the Phase 0 instrumentation,
  which is still in flight on `task/t124-phase0-debuggable-run`. Evidence will
  be thinner than the protocol wants, and that is expected rather than a
  surprise to diagnose.

## Stage 1 — the instruction and the expected chain

**The instruction, verbatim:**

> Search the catalog for "lamp" and scrape every product the search returns with
> columns name, price, rating and url.

**The node chain a correct Flow must have**, written before looking at the run:

1. **Enter the query.** Put the text `lamp` into the catalog's search field.
   This is a real action on a real control; it is not expressible as a parameter
   of an extraction.
2. **Submit the search.** Press the search control, or submit the field, and
   arrive at the result set. A correct Flow must also wait for the results to
   replace the unsearched catalog — this is the step most likely to be omitted,
   and omitting it is invisible on a fast fixture.
3. **Extract the results.** One `web.dom.extract_list` over the returned
   products, with columns `name`, `price`, `rating`, `url`.

Three nodes, two kinds. This is the minimum. A Flow of two nodes can only be
correct if the search is reachable by URL and the model chose to navigate
directly — which would be a legitimate alternative chain, and must be judged on
whether the result set is genuinely the search's, not the whole catalog.

**What a wrong answer that looks right would look like here.** The unfiltered
catalog. It has exactly the right shape — the same four columns, well-formed
names, prices and ratings — and it is what a Flow that skipped steps 1 and 2
returns. Record count is the tell: the whole catalog is larger than the lamp
result set. **A pass on shape alone would be a false pass**, so stage 5 must
compare rows, not just columns.

**Why this task is rung 1.** It is the cheapest task in the corpus that cannot
be satisfied by a single extraction on the page the run opens at. Nine tasks
have passed at one node; none has ever been asked for two.

## Stage 2 — exploration

Pending.

## Stage 3 — the proposed Flow

Pending.

## Stage 4 — replay

Pending.

## Stage 5 — the answer

Pending.

## Stage 6 — judgement and repair

Pending.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | **Two refusals before the product was ever reached**, both from the same root: this machine's `.env.local` configures an *existing* FluxIQ installation. Attempt 1 — `FLUXIQ_TEST_TARGET=existing` requires `FLUXIQ_TEST_PROJECT_ID`, which is not set. Attempt 2 — forcing `isolated` is refused because the same file sets `FLUXIQ_TEST_BASE_URL` and `FLUXIQ_TEST_GATEWAY_URL`, which an isolated target may not have. Each attempt cost zero provider calls, no browser and $0. An earlier report in this repository records the identical first refusal, so it is a repeat trap. | L, `.env.local` / `target-config.ts:66-75,162-181` | Attempt 3 uses the escape the code already documents for exactly this case: `FLUXIQ_TEST_ENV_FILES=none`, which skips both env files for a run that must not inherit a machine's saved configuration. The provider key survives because `live-llm/provider-credential.ts` reads it separately and has a test for that. | resolved by configuration |
| 2 | **Neither refusal named the way out**, which is why it took three attempts rather than one. `FLUXIQ_TEST_ENV_FILES=none` is documented in a comment above the function that implements it and nowhere the operator of a refused run would look. The first message says a project id is required; the second says isolated cannot use existing-install configuration; neither says that the configuration came from a file, which file, or that there is a supported switch to ignore it. | L, `target-config.ts:74,90` | Make both refusals name the source of the offending value and the `FLUXIQ_TEST_ENV_FILES=none` escape. Cheap, and it converts a three-attempt trap into a one-attempt one. | open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
