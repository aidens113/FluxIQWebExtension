# Live create-flow campaign — slice C (tables and infinite feeds)

Real DeepSeek runs, not mocks. Campaign `2026-09-17T23-09-09-631Z`, started
23:09:09Z, finished 23:26:31Z. Instance `camp-c`, `FLUXIQ_TEST_TARGET=isolated`,
`FLUXIQ_TEST_ENV_FILES=none`, provider `deepseek` / `deepseek-chat`, profile
`lab-create-flow`, task `create-flow`, up to 3 attempts per task.

**Totals: 9 tasks, 4 passed, 5 failed, 0 no-result; 4 judgements passed;
27 provider calls; 117,614 tokens; $0.055478.** Every task took exactly 1
attempt — failures were not retried.

Per-run figures below were read call by call from each run's
`snapshots/live-llm.json`, not from the verdict. The nine runs' `observed.calls`
sum to 27 and their token totals sum to 117,614, matching the campaign totals
exactly, so no call went unaccounted.

## Results

| # | Task | Verdict | Judgement | `observed.calls` | Tokens | Cost USD | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | product-catalog-photos-lazy | failed | not measured | 1 | 0 | 0 | Bootstrap request rejected HTTP 400, `provider_input_budget_exceeded` |
| 2 | data-table-inventory | passed | passed | 2 | 10,681 | 0.004996 | 12/12 rows, 48/48 fields |
| 3 | data-table-inventory-reordered-columns | passed | passed | 2 | 10,720 | 0.005065 | 12/12 rows, 48/48 fields |
| 4 | data-table-inventory-large | passed | passed (count only) | 2 | 10,872 | 0.005075 | 1000/1000 rows; no field compared |
| 5 | data-table-inventory-may-be-empty | passed | passed | 3 | 18,091 | 0.008473 | 12/12 rows, 48/48 fields |
| 6 | data-table-inventory-empty | failed | not measured | 1 | 0 | 0 | Bootstrap request rejected HTTP 400, `provider_input_budget_exceeded` |
| 7 | data-table-cheapest-product | failed | not measured | 12 | 48,199 | 0.023090 | Sort refused `target_unsafe`, then looped on unusable decisions |
| 8 | infinite-feed-first-forty | failed | **failed** | 3 | 19,051 | 0.008778 | Scrolled once; 10 of 40 posts, 0 matched |
| 9 | infinite-feed-first-forty-short-feed | failed | not measured | 1 | 0 | 0 | Bootstrap request rejected HTTP 400, `provider_input_budget_exceeded` |

## Snapshot shape caveat (applies to every run in this slice)

For the `lab-create-flow` profile the live snapshot publishes `observed.calls`
(a count) but sets `observed.perCallRecords = "not recorded"` and
`observed.observedCalls = []`. **Per-call `taskKind` is therefore not published
on create-flow runs** — it only appears on runs that record per-call entries
(for example a `runtime_diagnosis` call). Likewise `exploration` is `null` on
all nine runs, so `exploration.requested` and `exploration.status` do not
exist here; the equivalent evidence lives in `build.evidenceLoop`
(`decisionCount`, `toolCallCount`, `evidenceBytes`, `toolIds`, `steps`). I
report those rather than inventing taskKinds or exploration states.

Authorized budget on every run: `maxCalls` 26, `maxInputTokens` 8000,
`maxOutputTokens` 2000, `maxTotalTokens` 10000 per request, 100000 per run,
`maxEstimatedCostUsd` 0.25 per call / 2 per run, timeout 25000 ms.

## The three identical bootstrap failures (tasks 1, 6, 9)

`product-catalog / lazy-images`, `data-table / no-rows`, and
`infinite-feed / end-early` all failed the same way:

- `observed.calls = 1`, `observedCalls = []`, **0 tokens billed, $0**.
- `build.outcome = failed`, `providerInvocation = attempted`,
  `providerCalls = null`, `evidenceLoop = null` — the evidence loop never
  started.
- `failure = {code: flow_bootstrap.provider_input_budget_exceeded,
  stage: provider_request, httpStatus: 400}`.
- `extraction = null`, `flowCreated = false`. Nothing was captured.

Durations 13.7 s, 14.7 s, 10.9 s. The failing request is the *first* bootstrap
request, before any tool call, so the oversized prompt is not the product of
evidence accumulation.

**Anomaly worth investigating, stated as an open question rather than a
conclusion.** A pure prompt-size explanation does not fit. The passing
inventory runs reached an evidence loop and spent ~10.3k input tokens across
two requests (~5k each, comfortably inside the 8000 cap), while
`data-table / no-rows` — an *empty* table, which should yield the smallest page
evidence of any run in the slice — failed for allegedly exceeding that same
cap. The three failures are all variant runs, but two other variant runs
(`column-reorder`, and `large-table` with 1000 rows) passed. DeepSeek returned
HTTP 400 with no tokens accounted (`inputTokens: null`), and a 400 can mean a
malformed request rather than an over-length one, so the mapping to
`provider_input_budget_exceeded` may be masking a different defect. The run
logs carry nothing further: `logs/core.log` is 321 bytes and records only
server startup and `[exit] code=1`.

## Task 7 — data-table-cheapest-product (the richest failure)

Run `run-mu65nfwk-80823691`. 12 calls, 46,060 in / 2,139 out = 48,199 tokens,
$0.023090, 45.4 s. `build.evidenceLoop`: 12 decisions, 4 tool calls, 14,139
evidence bytes. `failure = {code: flow_bootstrap.evidence_repeat_without_progress,
stage: provider_output_validation, httpStatus: 400}`. `extraction = null`.

| # | toolId | resultCode |
|---|---|---|
| 1 | `web.inspect_current_page` | `web.inspect.succeeded` |
| 2 | `web.detect_repeating_structure` | `web.structure.detected` |
| 3 | `web.reveal_safe` | `web.action.rejected.target_unsafe` (effectApplied false) |
| 4 | `web.reveal_safe` | `llm_evidence_loop.already_answered` |
| 5 | `core.decision_unusable` | `bootstrap.required_input_unconnected` |
| 6 | `core.decision_unusable` | `bootstrap.unknown_parameter` |
| 7 | `core.decision_unusable` | `bootstrap.unknown_parameter` |
| 8 | `web.detect_repeating_structure` | `web.structure.detected` |
| 9 | `core.decision_unusable` | `bootstrap.unknown_parameter` |
| 10 | `core.decision_unusable` | `bootstrap.unknown_parameter` |
| 11 | `core.decision_unusable` | `bootstrap.unknown_parameter` |
| 12 | `web.detect_repeating_structure` | `llm_evidence_loop.rejected.repeat_without_progress` |

The model found the table (steps 1-2), then tried to perform the *sort* by
revealing the price column header. That `web.reveal_safe` was refused as
`target_unsafe`. With no other way to express "sort by this column" it emitted
five decisions the bootstrap validator could not use
(`bootstrap.unknown_parameter`) plus one `bootstrap.required_input_unconnected`,
re-detected the same structure twice, and was cut off for repeating without
progress. This is the only task in the slice whose instruction requires a page
*interaction* before extracting, and there appears to be no accepted action to
express it — so it burned 12 calls and $0.023 and produced nothing.

## Task 8 — infinite-feed-first-forty (verdict disagreement)

Run `run-mu65pc00-80573a6e`. 3 calls, 18,601 in / 450 out = 19,051 tokens,
$0.008778. `build.evidenceLoop`: 3 decisions, 3 tool calls, 5,659 evidence
bytes, tools `web.detect_repeating_structure`, `web.inspect_current_page`,
`web.navigate_same_origin`. `build.outcome = proposed`, no build failure; a
Flow was created (`flow.014b3bc0-...`) and the runtime ran it to
`status: "succeeded"`.

Extraction: judged, **expected 40 records, observed 10**, comparedRecords 10,
**matchedRecords 0**, expectedFields 30, presentFields 30, 0 unexpected.
`firstFailure`: "Extract step extract-loaded-posts yielded 10 record(s),
expected 40".

**`reportedVerdict = passed` while `oracleVerdict = failed`.** FluxIQ's own
runtime declared the flow successful; only the dataset oracle caught that it
captured a quarter of the rows. This is exactly the "verdict says passed while
nothing correct happened" hazard.

Concretely wrong: **the feed was scrolled once and no more.** `flowShape` is
`nodeCount: 3` — `web.browser.navigate` x1, `web.dom.scroll` **x1**,
`web.dom.extract_list` x1; the executed action list confirms those three, the
scroll taking 2,052 ms. An infinite feed needs repeated scrolling until forty
posts have loaded, and the built flow contains no loop or repeat construct.
Separately, none of the 10 captured records matched an expected record
(`matchedRecords: 0` of 10 compared) although the field shape was right
(30/30), so row *values* also diverge from the expected dataset, not only the
count. (`task.judgement.stepIndex = 6` is the expected position of the extract
step in a correct flow, not the actual one.)

## Correction to the brief

The brief said two tasks "deliberately expect an EMPTY or nearly-empty result
(`data-table-inventory-empty`, `data-table-inventory-may-be-empty`)". That is
right for the first and **wrong for the second**. In
`apps/scenario-lab/src/scenarios/live-instructions.ts`,
`data-table-inventory-may-be-empty` carries **no `variantId`**, so it runs
against the normally populated table; only the *instruction* is hedged ("may be
empty"), and its expected dataset `extract-any-inventory` expects 12 records
there. Returning 12 rows is the correct outcome, and it did. The hedged wording
did cost one extra provider call (3 rather than the 2 used by the plainly
worded inventory tasks). The genuinely empty case is `data-table-inventory-empty`
(`--variant no-rows`) — and it never got tested, because it died in bootstrap.

## What the passing runs show

The four passes all produced the same minimal shape: 3 nodes,
`web.browser.navigate` x1 + `web.dom.extract_list` x1 (+ `builtin.control.end`).
Column reordering did not disturb field mapping (task 3 matched task 2 exactly:
12/12 rows, 48/48 fields). The 1000-row table was captured in full in 9,387 ms.

**But task 4's pass is weaker than it looks.** Its expected dataset sets
`recordsListed: false`, so `comparedRecords = 0`, `matchedRecords = 0`,
`expectedFields = 0`, `presentFields = 0`. Per
`scripts/lab/live-campaign/row/dataset-judgement.mjs`, a step passes on count
alone when records are not listed. All 1000 rows were captured, but **no field
value was checked**. It is a row-count pass, not a content pass.

## Not verified

- Per-call `taskKind` and `exploration.requested` / `exploration.status` could
  not be reported: the create-flow snapshot does not publish them (see caveat).
- Field-level correctness of the 1000-row table (count-only judgement).
- Whether the three HTTP 400s are genuinely over-length prompts or a different
  provider-side rejection mapped to that code. No request body or provider
  error text is recorded anywhere in the run artifacts.
- No manual browser validation; this is campaign output only.
- Each result is a single observation, not repeated. This machine has known
  faulty RAM, so any one-off anomaly carries an error bar — though the three
  bootstrap failures share one code, and the task 7 and 8 failures have
  coherent internal traces, so they do not look like hardware noise.
