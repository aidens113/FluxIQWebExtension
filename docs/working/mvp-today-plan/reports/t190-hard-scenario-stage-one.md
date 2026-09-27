# t190 -- Hard-scenario Stage 1 facts

Status: Complete
Repository scope: `F:\!FluxIQWebExtension`, read-only except this report
Date: 2026-09-26

## Copy-ready Stage 1

- The instruction, verbatim: Find every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, rating and url.
- The node chain a correct Flow must have, written before looking at the run:
  1. Navigate from the blank start to the everything-store home page.
  2. Wait for and dismiss the `Never miss a deal` notification dialog with `Not now`, then accept the cookie banner. These interruptions must not be mistaken for human-only authorization.
  3. Type `wireless earbuds` into the real header search field and submit the search.
  4. Wait for the first-search browser check and choose `Continue shopping` when it appears.
  5. Narrow or classify the organic result cards by the instruction's exact predicates: Plus eligible, actual printed rating at least 4.0, price strictly below $50.00, and product kind earbuds rather than an accessory. The rounded `4 Stars & Up` control and inclusive `$25 to $50` band are not sufficient statements of those predicates.
  6. Read the organic, non-sponsored result cards with fields `name`, `price`, `rating`, and `url`; do not read sponsored placements or the sponsored house-brand carousel as search results.
  7. Traverse every results page, including lazy cards that appear on scroll. Do not depend on the broken page-two Next control when it ceases to advance; use a route that demonstrably reaches the remaining pages.
  8. De-duplicate the repeated organic card at each later page boundary while retaining the first occurrence and the store's relevance order.
  9. Produce the ordered four-column dataset and let Core judge the exact records. If the first result is wrong, apply and persist the judge's repair, then replay the repaired Flow with zero provider calls.
- What a wrong answer that looks right would look like here: a polished table with the requested four columns and plausible earbud names from several pages, possibly even with 13 rows, built by clicking Brightaisle Plus, `4 Stars & Up`, and `$25 to $50` and then collecting every visible card. It is wrong if it includes sponsored cards, the ear-tip or charging-case accessories, actual 3.8/3.9 products admitted by the rounded star control, the exactly-$50.00 product admitted by the inclusive band, or repeated page-boundary products; it is also wrong if the band excluded valid products under $25 or if the broken Next control left later pages unread. Matching the count alone is not a pass.

## Oracle dataset contract

- Task: `everything-store-plus-earbuds-under-50`.
- Scenario/workflow: `everything-store` / `plus-under-fifty`.
- Judgement: `expected-dataset`, dataset/step id
  `extract-plus-under-fifty` (provider-free readiness identifies it at workflow
  step index 16).
- Expected size: exactly 13 records.
- Expected order: the organic search's authored relevance order, retaining the
  first occurrence of each qualifying listing.
- Qualification rule: search `wireless earbuds` with no approximate rail
  semantics substituted, then require `kind === "earbuds"`, `plus === true`,
  `rating >= 4`, and `priceCents < 5000`.
- Record projection: `name` is the catalogue title; `price` is the printed US
  money string with two decimals; `rating` is the numeric rating formatted to
  one decimal; `url` is the store-relative product path containing its slug
  and SKU.
- Exclusions: all sponsored placements, the sponsored carousel, accessories,
  the exactly-$50.00 listing, actual ratings below 4.0, and repeated page-edge
  appearances.
- Passing evidence must compare all four fields and exact row order against the
  expected records. Runtime success, a plausible table, or count 13 alone is
  insufficient.

## Explicit pre-run hypotheses

These are predictions recorded before reading any new run output.

1. Navigation, interruption dismissal, search, and basic extraction will be
   reachable; the highest-risk failure is semantic fidelity in the authored
   filtering/pagination parameters rather than inability to reach results.
2. The model may choose the store's approximate `4 Stars & Up` or `$25 to $50`
   controls as if their labels exactly expressed the instruction. If so, the
   result will look credible while admitting or omitting the planted boundary
   cases above.
3. The model may author `next` pagination and stall or repeat at page two, or
   fail to scroll lazy results. A correct Flow must demonstrate progress across
   all pages and retain earlier rows without duplication.
4. The authored extraction may still be too broad: selectors or conditions may
   admit sponsored placements/accessories, or may deduplicate lookalike titles
   instead of repeated identical listings. Exact record comparison should
   expose this even when the row count matches.
5. Late notification/browser-check/list rendering, a transient target miss, or
   a content transport blip should be absorbed and recorded by deterministic
   browser/Core recovery. A recoverable fault stopping the Flow, or a provider
   call during deterministic replay, would contradict the intended runtime
   contract.
6. No action in this instruction is delete, move-money, send, or publish. A
   permission question before build, repair, or replay would be a gate
   regression rather than an expected scenario outcome.
7. If the first dataset is wrong, Core's result judgement should identify the
   concrete mismatch and provide a structured fix directive. The one permitted
   repair should update the relevant authored parameters, persist the change,
   and replay it without another provider grant. A verdict without actionable
   repair context is not sufficient.
8. A temporary provider transport/service fault may consume separately
   authorized bounded retry attempts during creation. It must remain visible
   in accounting and must not be confused with deterministic replay work.

## Pre-run disposition

Stage 1 is ready to copy into a fresh pending debug record before any new run
artifact is opened. This report does not by itself authorize a live run: the
supervisor must still satisfy t178's immediate go/no-go checks, freshness
attestation, credential handling, single-Lab-run rule, provider-free readiness
contract, and any later integration gate in the current plan.

## Evidence and limits

Read only the live debug template, t178 preflight report, and the current
scenario task/workflow/catalog definitions needed to state the oracle. No prior
run artifact or prior filled debug was opened. No source/shared document,
existing artifact, build output, browser, provider, Lab process, commit, or
push was touched. No build or test was run.
