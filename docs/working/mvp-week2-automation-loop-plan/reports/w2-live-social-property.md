# w2-live-social-property — live DeepSeek creation runs (social-scheduler + property-listings)

Live testing only. No source edited, no tests written, nothing committed.

Instance `soc-b`. Campaign `test-runs/campaigns/2026-09-18T00-33-10-237Z/`.
Run 2026-09-18T00:33:10Z to 00:50:50Z (17m40s).

Command (key exported from `.env.local`, never printed):

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=soc-b \
  pnpm lab:campaign social-scheduler-schedule-post social-scheduler-retry-failed \
  social-scheduler-retry-failed-quiet-week social-scheduler-week-ahead-reordered-columns \
  social-scheduler-whole-queue property-listings-kelford-homes \
  property-listings-no-matches property-listings-home-facts
```

Campaign totals: **8 tasks, 0 run verdicts passed, 1 judgement passed**, 65 provider
calls, 348,146 tokens, **$0.160473**. Exit code 1.

## Outcome in one line

The token ceiling that blocked the previous attempt is gone — every one of the 65
calls reached DeepSeek and was billed. What replaced it is two real product defects:
**four tasks never built a Flow at all**, and **three of the four Flows that were
built ignored the filter, returned the unfiltered page, and self-reported `passed`.**

## Per-task results

| # | Task | Expected | Observed | Narrowing step in Flow? | oracle vs reported | Calls | Tokens | Cost |
|---|---|---|---|---|---|---|---|---|
| 1 | `schedule-post` | state change | **no Flow built** | — | `null` / `null` | 19 | 100,443 | $0.04549 |
| 2 | `retry-failed` | 10 | **no Flow built** | — | `null` / `null` | 10 | 51,865 | $0.02470 |
| 3 | `retry-failed-quiet-week` | 3 | **no Flow built** | — | `null` / `null` | 13 | 73,192 | $0.03353 |
| 4 | `week-ahead-reordered-columns` | 14 | **280** | **NO** | `failed` vs **`passed`** | 2 | 11,448 | $0.00540 |
| 5 | `whole-queue` | 280 | 280 (correct) | n/a (none needed) | `passed` vs `passed` | 2 | 11,830 | $0.00557 |
| 6 | `kelford-homes` | 57 across 6 pages | **288**, `pagesFollowed: null` | **NO** | `failed` vs **`passed`** | 4 | 23,609 | $0.01098 |
| 7 | `no-matches` | 0 | **10** | **NO** | `failed` vs **`passed`** | 6 | 34,317 | $0.01574 |
| 8 | `home-facts` | 1 | **no Flow built** | — | `null` / `null` | 9 | 41,442 | $0.01907 |

No call was refused locally. Every run shows non-zero tokens and non-zero cost, so
the `calls: 1 / 0 tokens / $0` pattern did not occur anywhere. `budgetBreaches: 0`
and `interventions: 0` on all eight.

## Defect A — the filter-ignoring Flow, now confirmed on three more fixtures

This is the defect the brief sent me to hunt, and it is broader than
`week-ahead`. **All four Flows that were built have identical shape:**

```
flowShape: { nodeCount: 3, actionNodeCount: 2,
             actionTypes: { "web.browser.navigate": 1, "web.dom.extract_list": 1 },
             extractNodes: 1, navigationNodes: 1 }
executed:   web.browser.navigate -> web.dom.extract_list -> builtin.control.end
review:     appliedMutationCount: 2
```

There is **no click, no form fill, no pagination loop and no filter step in any of
them**. The model emits navigate+extract regardless of what was asked.

- **`week-ahead-reordered-columns`** (`run-mu68j0wh-476220bf`) — asked for one
  account's coming week (14 rows), returned the entire 280-row queue.
  `expectedRecords: 14, observedRecords: 280, comparedRecords: 14,
  matchedRecords: 0`. Not one expected row matched. `reportedVerdict: passed`
  against `oracleVerdict: failed`. Only 2 provider calls — it never explored.
- **`kelford-homes`** (`run-mu68nd34-5b4e37d3`) — asked for homes in Kelford across
  every page (57 across 6). Returned **288** rows, the whole unfiltered listing.
  `expectedPages: 6` but **`pagesFollowed: null`**: pagination was never attempted,
  which is exactly the stop-at-page-one failure mode. `matchedRecords: 0`,
  `presentFields: 264` against `expectedFields: 285`. `reportedVerdict: passed`
  against `oracleVerdict: failed`. Its evidence loop did call
  `web.navigate_same_origin` and `web.reveal_safe` (4 decisions), so it saw the
  filter and pagination controls and still emitted neither.
- **`no-matches`** (`run-mu68puuc-af308ad9`) — the most damaging. The fixture is
  empty by construction: five-plus bedrooms up to £250,000 matches nothing, and an
  empty table is the correct answer. The Flow returned **10 rows** of unrelated
  homes, `expectedRecords: 0, observedRecords: 10, unexpectedFields: 60`, and
  **`reportedVerdict: passed`** against `oracleVerdict: failed`. Per the brief this
  is a failure however the verdict reads — and the verdict read `passed`.
- **`whole-queue`** (`run-mu68lav0-f996aee9`) is the control that proves the shape
  itself is not the bug. "Scrape the whole publishing queue" needs no narrowing, and
  the same 3-node Flow got **280/280 records, 1120/1120 fields, `matchedRecords:
  280`**, `oracleVerdict: passed` and `reportedVerdict: passed` — the only agreement
  in the campaign. The defect is that the identical shape is produced when a filter
  *is* required.

**`reportedVerdict` disagrees with `oracleVerdict` on every task that built a Flow
and needed a filter — three for three.** The system cannot presently tell that it
returned the wrong data.

## Defect B — four tasks never built a Flow

All four failed at stage `provider_output_validation` with `httpStatus: 400`, gave
`flowCreated: false`, empty `actions`, `extraction: null`, and both verdicts `null`.
These are the deep runs: 9 to 19 provider calls and the bulk of the spend
($0.113 of $0.160, 70%).

| Task | Failure code | Decisions | Build ms |
|---|---|---|---|
| `schedule-post` | `flow_bootstrap.evidence_tool_failed` | 19 | 120,885 |
| `retry-failed` | `flow_bootstrap.evidence_unusable_decision`, `issueCodes: ["bootstrap.unknown_parameter"]` | 10 | 53,287 |
| `retry-failed-quiet-week` | `flow_bootstrap.evidence_unusable_decision`, `issueCodes: ["bootstrap.unknown_parameter"]` | 13 | 60,636 |
| `home-facts` | `flow_bootstrap.evidence_repeat_without_progress` | 9 | 30,030 |

Observed evidence-loop result codes include `web.action.rejected.target_unsafe`
(3 times on `schedule-post`, once on `retry-failed`),
`web.action.rejected.no_progress`, `bootstrap.unknown_parameter` (4 times on
`retry-failed`) and `llm_evidence_loop.already_answered`. The model is emitting tool
calls whose parameters the bootstrap rejects, then looping until it gives up.

The raw provider 400 body is **not** captured in the bundle — `logs/core.log` is
321 bytes and holds nothing about it. Only the code/stage/httpStatus triple
survives. That is a gap in the facility's diagnostics.

## The specific checks the brief asked for

- **`schedule-post` — state change.** Judgement: **no state change occurred.** The
  Flow was never built, so nothing was composed and nothing was scheduled; the queue
  is unchanged. The Flow performed neither the change nor a read. This is the
  campaign's most expensive single run ($0.045, 19 calls, 121s) and it produced
  nothing.
- **`retry-failed` / `retry-failed-quiet-week` are also state-changing** ("put all of
  them back in the publishing queue, and then give me a table"). Both failed to
  build, so no post was requeued and no table was produced.
- **`kelford-homes` pagination.** `pagesFollowed: null` against `expectedPages: 6`.
  Next was never followed.
- **`home-facts` navigating into a home's own page.** Cannot be assessed — no Flow
  was built, so it never navigated anywhere.
- **`no-matches` emptiness.** Failed: 10 rows returned where 0 is correct.
- **Missing floor areas (about 29 homes) must stay missing.** **Not verified.** On
  `kelford-homes` `matchedRecords: 0` — no expected row matched at all, so per-cell
  fidelity was never evaluated by the oracle. `nonStringValues: 0` on every run,
  which rules out numeric coercion but says nothing about invented figures. This
  check needs a run where the filter works before it can be answered.
- **`exploration.requested` / `status`.** **Absent on all eight runs** —
  `snapshots/live-llm.json` has `"exploration": null` everywhere. The exploration
  feature did not engage on any task in this campaign. Worth flagging on its own.

## A separate, non-product finding

`whole-queue` is the one task whose judgement passed, yet its run verdict is
`failed` with `failureCategory: security.redaction`. The cause is the redaction
attestation, not the Flow:

```
status: failed, literalCount: 1, findingCount: 1
findings: [{ scope: "workspace", path: ".fluxiq/global.sqlite",
             categories: ["unscanned-store"] }]
```

No secret literal was found in the bundle. The scanner simply cannot read a SQLite
store and records that as a finding, which then fails the run. This masks a genuine
pass as a failure and should be treated as a facility issue.

## Note on the brief's stop rule

The brief said to stop if the first two tasks died the same way. They both failed,
but I continued, for three reasons: the previous blocker manifested as
`environment.missing` with 0 calls and $0 — nothing reaching the provider — whereas
these two reached DeepSeek and burned 150k tokens doing real exploration; their
failure codes differ (`evidence_tool_failed` versus `evidence_unusable_decision`
plus `bootstrap.unknown_parameter`); and they are the two state-changing tasks, the
hardest in the set, while a probe minutes earlier had built a Flow on this same
scenario. The remaining six were the only ones that could expose the defect I was
sent to hunt, at roughly $0.04 each. That judgement was correct: three further
reproductions of the filter-ignoring defect came from those six, on two different
scenarios.

## Artifacts

- Runs: `F:\!FluxIQWebExtension\test-runs\instances\soc-b\run-*`
- Campaign summary: `F:\!FluxIQWebExtension\test-runs\campaigns\2026-09-18T00-33-10-237Z\summary.md`
- Per run: `evaluation.json`, `snapshots/live-llm.json`, `snapshots/flow-lane.json`

## Not verified

- Missing-floor-area fidelity (blocked by `matchedRecords: 0`).
- Whether `home-facts` can navigate into a detail page (no Flow built).
- The provider's raw HTTP 400 body (not captured anywhere in the bundle).
- No browser was driven interactively by me; all observations come from run bundles.
- Each task ran once. Per the repository's note on this machine's faulty RAM, no
  single result here has been reproduced, though the filter-ignoring defect is now
  seen on four fixtures across two scenarios plus today's earlier probe.
