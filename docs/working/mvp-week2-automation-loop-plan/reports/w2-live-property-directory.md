# w2-live-property-directory — live DeepSeek creation runs, property-listings and company-directory

**Date:** 2026-09-17 (run wall clock 2026-09-18T00:37Z–00:53Z)
**Lab instance:** `prop-b` · `FLUXIQ_TEST_TARGET=isolated` · `FLUXIQ_TEST_ENV_FILES=none`
**Provider:** deepseek / deepseek-chat, real calls, key exported from `.env.local` (never printed)
**Outcome:** the gate is open — 74 real provider calls, 410,822 tokens, $0.1912 —
and **0 of 9 tasks passed.** Six of the nine built a Flow; five of those six
reported `passed` while the oracle said `failed`.

## The gate is confirmed open

The previous attempt died at `update-flow-settings (400): LLM execution limit is
invalid` with zero calls. That is fixed. The probe
(`property-listings-newest-homes`, run `run-mu68bp0u-96f37861`) wrote
`snapshots/live-llm.json` with `observed.calls: 5` and
`observed.accounting: {inputTokens: 26535, outputTokens: 637, totalTokens: 27172,
estimatedCostUsd: 0.01251624, budgetBreaches: 0, pendingCalls: 0}`. Non-zero
tokens against non-zero calls, so these are genuine round trips, not the
"calls 1, tokens 0, $0" case where a call never leaves the machine. Every one of
the nine runs shows the same: `observed.calls` and
`observed.accounting.totalTokens` both non-zero. **No run in this campaign was a
phantom call.**

`exploration` is `null` in all nine snapshots — the bounded-exploration lane
never opened on any of these tasks.

## What was run

The briefed command, unmodified, split into a one-task probe and the remaining
eight so a broken gate could not consume the whole slice:

```
export DEEPSEEK_API_KEY=<from .env.local>
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=prop-b \
  pnpm lab:campaign <task ids>
```

Campaign 1 (`test-runs/campaigns/2026-09-18T00-37-12-694Z`): the probe.
Campaign 2 (`test-runs/campaigns/2026-09-18T00-40-09-601Z`): the other eight.

Each task resolved to `pnpm lab run <scenario> --live-llm --llm-profile
lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task
create-flow --instruction-task <task> --llm-max-input-tokens 48000
--llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens
600000 --llm-max-cost-usd 0.25`. Granted budget per run: `maxCalls 26`,
`maxTotalTokensPerRun 600000`, `maxEstimatedCostUsd 0.25`, `timeoutMs 25000`.
One attempt each; no RAM-fault retries fired.

## Result table

| Task | Run | Expected | Observed | Narrowing step in Flow? | `reportedVerdict` | `oracleVerdict` | Agree? | Calls | Tokens | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| property-listings-newest-homes | `run-mu68bp0u-96f37861` | 10 | **10** | n/a (no filter needed) | passed | failed | **NO** | 5 | 27,172 | $0.012516 |
| property-listings-kelford-homes | `run-mu68ff0w-f8ca2150` | 57 / 6 pages | **288** | **none** | passed | failed | **NO** | 8 | 43,971 | $0.020196 |
| property-listings-no-matches | `run-mu68i0l0-6da126ec` | **0** | **10** | **none** | passed | failed | **NO** | 6 | 34,740 | $0.016238 |
| property-listings-cheapest-home | `run-mu68jrj7-c307bd9d` | 1 | — no Flow built — | — | null | null | — | 23 | 134,311 | $0.063346 |
| property-listings-home-facts | `run-mu68mf70-a87fd9e6` | 1 | — no Flow built — | — | null | null | — | 7 | 31,306 | $0.014245 |
| company-directory-register-page | `run-mu68nu31-70a0d4e5` | 15 | — no Flow built — | — | null | null | — | 7 | 33,313 | $0.015897 |
| company-directory-logistics-sector | `run-mu68pdv2-2072ed19` | 40 / 3 pages | **320** | **none** | passed | failed | **NO** | 8 | 47,382 | $0.021598 |
| company-directory-no-companies | `run-mu68s4jy-f4d58dc9` | **0** | **320** | **none** | passed | failed | **NO** | 6 | 34,347 | $0.015914 |
| company-directory-company-profile | `run-mu68ud1m-0b752158` | 1 | 0 (extract never ran) | 3 navigates, died on the first | failed | failed | yes | 4 | 24,280 | $0.011266 |

Totals: **74 calls, 410,822 tokens, $0.191216.** 0 passed, 0 judgements passed.

## The hunted defect is confirmed, four more times

**A Flow built as navigate → extract that ignores the filter and returns
everything, while reporting `passed`.** Four fresh instances today on these two
fixtures, and the "everything" figure is exactly the fixture's whole size:

- `PROPERTY_COUNT = 288`
  (`apps/scenario-lab/src/scenarios/property-listings/listings.ts`).
  `kelford-homes` asked for the 57 homes in Kelford across 6 pages and got
  **288 — the entire portal**. Flow: `web.browser.navigate` ×1,
  `web.dom.extract_list` ×1, `builtin.control.end`. No search, no filter, no
  option-setting node. It *did* paginate, all the way to the end of the
  **unfiltered** list.
- The register holds **320** entries
  (`apps/scenario-lab/src/scenarios/company-directory/companies.ts`).
  `logistics-sector` asked for the 40 Logistics companies across 3 pages and got
  **320 — the entire register**. Flow: `web.browser.navigate` ×2,
  `web.dom.extract_list` ×1. Two navigations and still nothing that narrows.
- `no-companies` asked for a size band nobody in that sector occupies, expected
  **0**, and got **320 — the entire register again**, with
  `unexpectedFields: 1280`.
- `no-matches` expected **0** and got **10** — the default unfiltered first page,
  with `unexpectedFields: 60`.

All four reported `passed`. All four are `oracleVerdict: failed`. In every case
`matchedRecords: 0` — not one returned row is a row that was asked for.

### The two empty-by-construction tasks both failed outright

Whatever the verdict says: `no-matches` returned 10 rows against an expected 0,
and `no-companies` returned 320 against an expected 0. Both are failures on the
brief's own rule, and both self-reported `passed`.

### Pagination

`pagesFollowed` is **`null` in every run that produced one** — the harness
recorded no pages-followed figure at all, and the oracle lists `"pages"` under
`unjudged` for both paginated tasks. `expectedPages` is 6 for `kelford-homes`
and 3 for `logistics-sector`. The `datasetPages: 2` seen on those runs is the
dataset store's own chunking, not the site's pagination. So pagination depth
**cannot be reported from this campaign**; the only evidence that pagination ran
at all is that the row counts reached the fixtures' full 288 and 320.

## A second defect: the builder cannot narrow, and gives up

The three tasks that built **no Flow at all** all died inside the evidence loop,
and their `build.evidenceLoop.steps` show why. This is the same root cause seen
from the other side — when the model *tries* to narrow or drill in, Core rejects
the attempt:

- `web.navigate_same_origin` → **`web.action.rejected.no_progress`** on
  `cheapest-home` (×3) and `home-facts` (×1). The attempt to reach a filtered or
  sorted URL is refused as making no progress.
- `core.decision_unusable` ×8 on `cheapest-home`, with
  `bootstrap.unknown_parameter` (×5), `bootstrap.unknown_output_reference` (×2)
  and `flow_script.unknown_node` (×2). The proposed Flow script keeps naming
  parameters, outputs and nodes Core does not recognise.
- `web.reveal_safe` → `web.action.rejected.target_unsafe` on all three.
- `llm_evidence_loop.already_answered` repeatedly, then the loop dies on
  `llm_evidence_loop.rejected.repeat_without_progress`.

Failure codes: `flow_bootstrap.evidence_repeat_without_progress` for
`cheapest-home` and `home-facts`; `flow_bootstrap.evidence_unusable_decision`
for `register-page`, whose issue codes are `web.handle.malformed` and
`web.handle.expected.extract_list.handle_fields_paginate` — three consecutive
extract_list handles in a shape Core will not accept.

`cheapest-home` burned **23 of its 26 permitted calls, 134,311 tokens and
$0.063** — a third of the campaign's entire spend — producing nothing.

**So the two defects are one story.** Narrowing is rejected, so the builder
either loops until it is cut off (no Flow, honest failure) or emits the
degenerate navigate → extract that Core *will* accept (a Flow, everything
returned, `passed` reported).

## A third defect: a hallucinated hostname

`company-directory-company-profile` is the only run whose `reportedVerdict`
matches its `oracleVerdict` — both `failed`. It built the most elaborate Flow of
the nine (5 nodes: 3 navigates + 1 extract), then died on its very first action:

> `Cannot access contents of url "https://www.businessregister.test/search".
> Extension manifest must request permission to access this host.`

The Flow navigated to an invented host. Extraction never ran
(`status: "not_run"`). It did at least fail honestly, which is more than the
other five managed.

## Detail-page tasks

Neither `home-facts` nor `company-profile` reached a detail page.
`home-facts` never built a Flow — its `web.navigate_same_origin` attempt was
rejected `no_progress`. `company-profile` built three navigation nodes but the
first targeted a hallucinated host. So the requirement that the Flow navigate
into a detail page for facts that exist only there is **unmet in both cases**,
for two different reasons.

## The one task that got the count right

`newest-homes` returned exactly 10 records for an expected 10 — the only correct
count in the campaign — and still failed. `expectedFields: 50` (10 records × 5
required columns, `floorArea` optional), `presentFields: 41`, so **9 required
values came back empty**, and the first failure event reads:

> `Extract step extract-newest-homes record 1 carried no value for 3 required
> field(s) no optionalFields entry names`

`matchedRecords: 0`, `unexpectedFields: 0`, `nonStringValues: 0`. The Flow
under-extracted required columns. It reported `passed`.

## Missing values: no sign of invention, but not verifiable either

The brief asked whether the ~29 homes with no floor area and the 36 companies
with no headcount come back missing rather than invented. **This campaign cannot
answer that directly.** The run bundles are redaction-applied and retain no row
values, and the harness records no invented-value metric. The available proxies:

- `nonStringValues: 0` everywhere — nothing came back as a non-string.
- `unexpectedFields: 0` on all three judged non-empty extractions — no column
  appeared that was not asked for.
- The failure signal on `newest-homes` runs the *opposite* way: values were
  **absent** where they were required, not fabricated where they were optional.

So there is no evidence of invention, and no positive confirmation of correct
missing-value handling either. It could not be tested properly, because the
returned rows were the wrong rows in every filtered task.

## What this campaign did and did not exercise

Exercised: real DeepSeek round trips through the create-flow bootstrap loop;
Flow construction, application and execution against the isolated Core target;
the dataset oracle's record, field and page comparison; the extension's host
permission gate.

Not exercised: bounded exploration (`exploration: null` in all nine); any
repair/adapt lane; the `agent-withheld`, `renamed-pagination`,
`relabelled-columns` and `last-page` variants of these two fixtures, which were
not in the briefed selection; live browser interaction beyond what the Lab
drives.

## Files

Run bundles: `test-runs/instances/prop-b/<runId>/` — `evaluation.json`,
`snapshots/live-llm.json`, `snapshots/flow-lane.json`, `events.ndjson`,
`summary.json`.
Campaign summaries: `test-runs/campaigns/2026-09-18T00-37-12-694Z/summary.md`
and `test-runs/campaigns/2026-09-18T00-40-09-601Z/summary.md`.
