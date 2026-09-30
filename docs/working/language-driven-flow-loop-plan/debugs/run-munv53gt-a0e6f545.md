# Run debug — `run-munv53gt-a0e6f545`

t194 lane C, run 6. Same task and Stage 1 as `run-munnhi5q-4867dabe.md`. Written after the fact (brief t194-d56) from the kept bundle, the kept workspace (`project.sqlite`, read only through `node:sqlite`) and the Lab log. Causes found earlier: `reports/t194-w12-page-one-stop.md` (the page 1 stop), `reports/t194-w7-reauthor-routing.md` (re-author routing, attempt id collision), and the executor recovery-budget cause (Core `runtime/executor/recovery-budget.ts`).

## Header

- Run id: `run-munv53gt-a0e6f545`
- Scenario / variant / task: `everything-store` / none / `everything-store-plus-earbuds-under-50` (workflow `plus-under-fifty`, expected dataset `extract-plus-under-fifty`, 13 records)
- Command: lane C live-run script on slot-3, instance `t194-slot-3`, headed, side panel verified open; Lab log `scratchpad/t194/run06.log` (session `eb370cd2`), start 08:46:16Z, exit 1 at 09:09:47Z.
- Date, provider, model: 2026-09-30. Prelude 124,476 ms (domain, extension and test-runner rebuilt; Core dist newest 08:46:08). Scenario 08:48:28 to 09:09:35 UTC (1,266,567 ms). DeepSeek `deepseek-flash`, profile `production`.
- Provider calls, tokens, cost:
  - Build: 28 calls (27 in the loop), 303,545 in + 4,166 out, 118,743 ms. **Cost USD 0.037808** (`snapshots/live-llm.json` `observed.totalEstimatedCostUsd` 0.03780836400000001). `unrecordedCalls: 7`.
  - Result re-author: 30 decisions + 1 additional call, 431,388 in + 8,632 out, 302,776 ms, USD 0.045770 (`decision-trace.json`).
  - Repair attempt (runtime diagnosis): 2 calls, 3 interventions, USD 0.002029 (event 70).
  - Run total USD 0.085608, of which `live-llm.json` counts only the build.
- Verdict as reported: `failed`, `runtime.behavior`; `flowCreated: true`; `oracleVerdict: failed` (`records: failed`, `finalState: held`); `reportedVerdict: failed`; `resultVerification: refuted`; `automationFailureReported: output_not_observed / core.result.does_not_answer_request`; `unsettled: recovery`; `facilityFailure: null`.
- **Stage reached: 6.** The first playback's answer was judged and refuted, the re-author was routed and **applied** (`adaptation.bootstrap.72a7ffbb-...`) and persisted (graph revisions 2 and 3 at 08:59:19.832), and the re-run of the repaired Flow executed and stopped on the optional "Continue shopping" press before it reached its reads.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim: Find every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, rating and url.
- The node chain a correct Flow must have (as written for run 1, before any run was read):
  1. Navigate to the store; clear the deal dialog, the cookie banner, and the first-search browser check ("Continue shopping") **as an optional step**.
  2. Search `wireless earbuds` and submit.
  3. Optionally narrow with Plus and a max price of 49.99 (not "4 Stars & Up" alone, not "$25 to $50").
  4. Let each page's four lazy results load.
  5. Extract organic cards only, fields name, price, rating, url. Keep earbuds, not accessories; a pair named "... with Wireless Charging Case" is earbuds. Keep Plus, rating >= 4.0 and price < $50.00.
  6. Follow Next through every page, paced under the store's 429 limit, stopping when a page adds nothing new.
  7. Dedupe by url, keeping the first occurrence and the results order.
  8. Judge; re-author a wrong answer; persist; re-run.
- What a wrong answer that looks right would look like here: sponsored cards, ear tips or a charging case in the table, a 3.8/3.9, the $50.00 pair, a boundary repeat, page one only, dropped under-$25 pairs, dropped "with Wireless Charging Case" earbuds, or the right rows out of order.

## Stage 2 — exploration

### Build (08:52:08 to 08:54:05; `flow-lane.json` `build.evidenceLoop`, 27 decisions, 18 tool calls; call ids and times from `logs/core.log`)

| # | Time | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- | --- |
| 0 | 08:52:08 | (initial) | — | `capture_snapshot` | `not_at_start_location` |
| 1 | 08:52:10 | next step | tool | `nav.start`: navigate `http://127.0.0.1:63272/scenarios/everything-store/` (the kept s1) | succeeded, 3,434 ms |
| 2 | 08:52:15 | next step | tool | `search.earbuds`: type | `target_unobserved` / `target_not_a_handle` |
| 3 | 08:52:17 | next step | tool | `detect.results` | detected, 87 ms |
| 4-5 | 08:52:18-20 | next step | tool x2 | `search.type`, `search.type2`: type | `target_unobserved` / `answered_the_same_again` x2 |
| 6 | 08:52:22 | next step | amend: rerun d3 | `rerun.3` | `answered_the_same_again` |
| 7 | 08:52:23 | next step | tool | `search.type.handle`: type "wireless earbuds" into `input[name="k"]` ("Search Brightaisle") | succeeded, 1,391 ms |
| 8 | 08:52:26 | next step | tool | `search.submit`: click `[data-testid="nav-search-submit"]` ("Go") | succeeded, 1,239 ms |
| 9 | 08:52:29 | next step | tool | `continue.check`: click `[data-testid="soft-check"] > button` ("Continue shopping") | succeeded, 1,608 ms |
| 10 | 08:52:32 | next step | tool | `detect.products` | detected, 507 ms |
| 11 | 08:52:34 | next step | tool | `extract.products`: extract_list (paging) | `web.inspect.succeeded`, **6,326 ms**, 7,418 B |
| 12 | 08:52:42 | next step | tool | `detect.products2` (the tab was left where the paging read ended) | detected, 552 ms |
| 13-14 | 08:52:43-47 | next step | unusable x2 | — | `llm.provider_malformed_response` |
| 15 | 08:52:47 | next step | amend: rerun d12 | `rerun.12` | succeeded, **3,190 ms** |
| 16 | 08:52:54 | next step | tool | detect again | `llm_evidence_loop.already_answered` |
| 17 | 08:52:57 | next step | amend: rerun d14 | `rerun.14` | succeeded, 2,022 ms |
| 18 | 08:53:02 | next step | unusable | — | malformed |
| 19 | 08:53:05 | next step | amend: rerun d16 | `rerun.16` | succeeded, 1,962 ms |
| 20 | 08:53:09 | next step | unusable | — | malformed |
| 21 | 08:53:12 | next step | amend: rerun d17 | `rerun.17` | succeeded, 2,152 ms, 7,037 B |
| 22 | 08:53:16 | next step | complete | dry run 1: reset replayed; steps 2, 8, 9 replayed; **step 10 (Continue) `core.replay.unreproducible`** 7,521 ms; **step 18 (extract) replayed in 383 ms** | `dry_run_refused` |
| 23 | 08:53:31 | next step | unusable | — | malformed |
| 24 | 08:53:32 | next step | amend d10 | — | `draft_amended` (made optional: the graph has `s4:failed -> s5:in`) |
| 25 | 08:53:33 | next step | amend d10 | — | refused `10:already_so` |
| 26 | 08:53:36 | next step | unusable | — | malformed |
| 27 | 08:53:37 | next step | complete | dry run 2: same, step 10 unreproducible but now conditional; step 18 replayed in 398 ms | **accepted**; build settled 08:54:05 |

- The reruns after the first read took 2.0 to 3.2 s against 6.3 s for the first. That fits a read that stopped on page 1 (w12: the authored `a:nth-of-type(6)` names nothing on page 1). Their rows, pages and stop are **NO EVIDENCE** in the bundle.
- **Repeats, and what the loop believed was progress:** four reruns of the extract (d12 to d17), each a new draft revision. **The dry run accepted a one-page read** of a five-page list, because the domain answers `changed` only when a step that read something now reads nothing (`domain/src/runtime/llm-evidence/node-run/replay.ts:234-241`).
- **Rejections and refusals, and whether each said enough:**
  - `target_not_a_handle` / `answered_the_same_again` on the search field, four times, before the model used a handle. The first rejection said enough, and the model took three more tries to act on it.
  - `unreproducible` on the Continue press, answered correctly by making it optional.
  - Seven malformed responses.
- **Where the context was evicted or truncated:** NO EVIDENCE of eviction; the extract argument's visibility (`inputTooLarge`) is not in this run's step records.

### Result re-author (08:54:46 to 08:58:57; `decision-trace.json` adaptation `72a7ffbb` `evidenceLoop`, 30 decisions, 20 tool calls, 66,718 evidence bytes)

| # | Time | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- | --- |
| 0 | 08:54:46 | the brief (3,739 chars) | — | `capture_snapshot` | inspect succeeded, 8,736 B |
| 1-2 | 08:54:49-52 | next step | amend: rerun f6 (the seeded extract) x2 | `rerun.6`, `rerun.6.2` | `target_unobserved` / `column_not_in_detected_list`, then `answered_the_same_again` |
| 3 | 08:54:54 | next step | tool | `detect.1` | detected, 916 ms |
| 4-5 | 08:54:58-01 | next step | unusable x2 | — | malformed |
| 6 | 08:55:04 | next step | amend: rerun f6 | `rerun.6.3` | succeeded, 7,992 ms, 3,742 B |
| 7-15 | 08:55:14 to 08:56:54 | next step | amend: rerun d5 to d12 (8 reruns) | `rerun.11` to `rerun.18` | each succeeded, about 11,050 ms, **3,538 B every time**; **429 page on screen at 08:55:23 and 08:56:43** |
| 16 | 08:57:08 | next step | unusable | — | malformed |
| 17 | 08:57:11 | next step | amend: rerun d13 | `rerun.19` | succeeded, 11,076 ms, 3,538 B |
| 18-19 | 08:57:24-27 | next step | unusable x2 | — | malformed |
| 20 | 08:57:30 | next step | amend: rerun d14 | `rerun.20` | succeeded, 11,123 ms |
| 21-24 | 08:57:43-52 | next step | unusable x4 | — | malformed |
| 25-27 | 08:57:54 to 08:58:23 | next step | amend: rerun d15, d16, d17 | `rerun.21` to `rerun.23` | each about 11 s, 3,538 B; **429 on screen at 08:58:04** |
| 28 | 08:58:37 | next step | tool | `rerun.24` | 11,059 ms, 3,537 B |
| 29 | 08:58:50 | next step | tool | `detect.2` | `web.action.rejected.no_repeating_structure` / `nothing_repeats_on_page`, 5,025 ms (consistent with a 429 page) |
| 30 | 08:58:57 | next step | complete | completion check ok | accepted; no dry run appears in `core.log` |

- **Repeats:** thirteen reruns with byte-identical 3,538 B evidence. The loop counted each as a changed draft while the store refused loads under it. This is the same unpaced-load cause as run 5 (w10).
- **Rejections:** `column_not_in_detected_list` on the seeded extract, then nine malformed responses.
- **Truncation:** NO EVIDENCE.

## Stage 3 — the proposed Flow

**Built Flow** (graph revision 1, 08:54:10.614; `graph_nodes` in the kept `project.sqlite`):

- s1 `web.output.browser-navigate` `{url: "http://127.0.0.1:63272/scenarios/everything-store/", newTab: false}`
- s2 `web.output.dom-type` `{selector: "input[name=\"k\"]", text: "wireless earbuds", element: {tagName: input, accessibleName: "Search Brightaisle"}, timeoutMs: 10000}`
- s3 `web.output.dom-click` `{selector: "[data-testid=\"nav-search-submit\"]", element: {button, "Go"}, timeoutMs: 10000}`
- s4 `web.output.dom-click` `{selector: "[data-testid=\"soft-check\"] > button", element: {button, "Continue shopping"}, timeoutMs: 10000}`, optional: edges `s4:failed -> s5:in`, `s4:success -> s5:branches`
- s5 `builtin.control.merge` `{mergeMode: "first"}`
- s6 `web.output.dom-extract_list`:
  - `item: "main > div:nth-of-type(2) > div > div:nth-of-type(1) > div.css-0rc9pnw"`
  - fields: name `:scope > div.css-1h13pfs > h2.css-0lh1x1m > a.css-1ahy6rs > span`; price `... div[itemprop="offers"] > a.css-1wwnizn > span.css-00egoa7 > span.css-1f32dgn`; rating `... div.css-1bc9pgf > span.css-11xfgav > span.css-14idg5p`; url (link) `... h2 > a.css-1ahy6rs`
  - `where`: (0) attribute `data-ad-id` **absent**; (1) attribute `aria-label` of `... div.css-1rgshzi > i.css-0dxd415` **present** (the Plus badge, by F7/w6; not re-verified against the store's markup here); (2) rating text `atLeast: 4`; (3) price text `lessThan: 50`
  - **`paginate: {next: "main > div:nth-of-type(2) > div > nav > a:nth-of-type(6)", maxPages: 10}`**
  - `dedupe.by: ["url"]`
  - `recordOutput: {datasetId: "wireless_earbuds", fields name/price(string)/rating(number)/url(url), writeMode: "replace"}`

**Re-authored Flow** (revisions 2 and 3, 08:59:19.832): s1 to s5 unchanged, **the optional route of s4 kept** (edges `edge.bootstrap.5aa64708ef9d2185.main.e1` `s4:failed -> s5:in` and `.e5` `s4:success -> s5:branches`). The old s6 was replaced by **two chained extract nodes**, `node.bootstrap.5aa64708ef9d2185.main.s6 -> .s7`. They are identical apart from the price column's `valueType` (number in s6, string in s7), and both write `wireless_earbuds` with `replace`. Each adds `where` (4): name text `contains ["ear tips", "charging case", "replacement"], not: true`, and `paginate.next: "... nav > a:nth-of-type(4)"`, `maxPages: 10`.

Divergences from Stage 1:
- **Built s6 `paginate.next` `a:nth-of-type(6)`** names nothing on page 1 (the store's page 1 pager is `span, span, a, a, span, a, a`, so Next is the 4th `a`; w12). Cause: **misread the page.** The positional chain was authored while the tab was left on page 3 or 4 by the paging read at iteration 11 (`detect.products2` ran after it). `detect-pagination.ts:95` `selectorFor(next)` writes positional chains.
- **Built s6 has no accessory rule.** Ear tips (Plus, 4.5, $12.99) pass every condition. Cause: **misread the task.** The instruction names accessories, and the grammar could express the rule (the re-author did).
- **No step lets the four lazy results per page load** before a paged read. Cause: **could not express it.** The paged read never runs `awaitListComplete` (w12 open question 2).
- **Re-authored `a:nth-of-type(4)`** follows Next on page 1, then "5" on page 2, then "3" on pages 4 and 5 (w12 table). It would visit pages 1, 2, 5, 3, 4, **out of results order**. Cause: misread the page.
- **Re-authored accessory rule `not contains "charging case"`** drops three true answers named "... Wireless Charging Case" (expected rows 8, 9 and 11, 1-based). This is run 4's cause 1 again. Cause: misread the task (the scenario's trap).
- **Re-authored s6 -> s7**: a duplicate read that doubles every page load and competes for the store's allowance. Cause: the re-author's rerun churn left two record producers in the result, and the completion check accepted them.
- No deal-dialog or cookie-banner step in either Flow. The playback relied on neither blocking (they did not, moments 11 and 28).

## Stage 4 — replay

First playback (runtime run `e230a482`, started 08:54:23.154):

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| s1 navigate | 08:54:27.814 | succeeded | 2,308 ms | 0 | — |
| s2 type | 08:54:31.225 | succeeded (host selector, score 0.629) | 195 ms | 0 | — |
| s3 click Go | 08:54:32.487 | succeeded (score 1) | 188 ms | 0 | — |
| s4 click Continue | 08:54:33.722 | succeeded (score 0.643; the check was shown) | 877 ms | 0 | — |
| s5 merge | 08:54:36.082 | succeeded | 1 ms | 0 | — |
| s6 extract_list | 08:54:36.084 | **2 records, 1 page of 10, 15 items seen, `conditions {applied: 15, kept: 2, rejected: [3, 2, 7, 5]}`, `paginationStop: control_absent`, `truncated: false`** | 872 ms | 0 | — |
| s6 verification | 08:54:36.956 | failed `core.result.does_not_answer_request` ("judged ... twice and with the same evidence") | 1,436 ms | — | — |

Re-run of the re-authored Flow (from the start, 09:00:0x to 09:00:25.988):

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| s1 to s3 | yes (overlay moment 27: steps 2, 3, 4 of 7 at 09:00:09) | **not recorded** (attempt id collision, below) | NO EVIDENCE | — | — |
| s4 try 1 | presumed | **not recorded** | NO EVIDENCE | — | — |
| s4 try 2 (`s4.attempt.5`) | 09:00:11.019 | failed `web.target.not_found`: "nothing matched; 23 control(s) of the same family; best scored -0.12", absorbed `target_absent` x4, waited 3,654 ms | 5,491 ms | attempt 2 of 3, backoff 250 ms | `retry_node` |
| s4 try 3 (`s4.attempt.6`) | 09:00:18.971 | same, waited 3,627 ms | 5,601 ms | attempt 3 of 3, backoff 1,000 ms | `retry_node` |
| s5 to s7 | **no** | — | — | — | — |

- **Why s4 failed:** the session had already passed the store's one-time browser check, so the page shown (moment 28, 09:00:24) is the results page, with no "Continue shopping". That is exactly the case the optional route exists for.
- **Why the run stopped instead of taking `s4:failed -> s5:in`:** the route was in the graph (Stage 3). The two ladder retries of s4 were counted against the subflow recovery budget (default 2), so the third miss found the budget spent and the Flow's own failed route was withdrawn. Fixed in Core `runtime/executor/recovery-budget.ts` (`recoveryBudgetState` no longer counts `LADDER_RUNG_KINDS` decisions; its comment names this run), with test `executor/tests/optional-failed-route.test.ts`.
- **Why s1 to s3 and s4's first try are missing:** the re-author kept the node ids `...1087466e1d5ee18d.main.s1..s5`, and the re-run numbered its attempts from 1. So `s1.attempt.1` to `s4.attempt.4` equalled the first pass's ids, and the run store kept only the new ids (w7 item 3). `runtime_action_summaries` still shows `s4.attempt.4` as **succeeded** at 08:54:33, the first pass's. Fixed: `priorAttemptCount` in `executor/graph-run.ts:385` and `service/runtime-adaptation/repair-rerun.ts:118`.
- Any node that reported success while doing nothing: **s6 of the first playback** reported `succeeded` on a one-page read of a five-page list. It said so in `paginationStop: control_absent`, but as an ordinary end with `truncated: false` (w12 section 2). The build's dry run replayed the same one-page read as `replayed`.
- Provider calls during replay: 0 in both playbacks. The recovery's diagnosis made 2 calls (3 interventions; the third `recovery.ladder_diagnosis_unanswered`), USD 0.002029.
- After 09:00:26 the Lab waited until 09:09:23 for Core's recovery record, which never arrived (`unsettled: recovery`; `packages/test-runner/src/flow-lane/terminal-run-wait.ts` `RECOVERY_RECORD_WAIT_MS` 300,000). What the rest of the 9 min was spent on is NO EVIDENCE.

## Stage 5 — the answer (first playback; the re-run produced none)

- Records expected vs returned: **13 expected, 2 returned**; 2 compared, 1 matched in position, 1 in any order (`snapshots/extraction-mismatches.json`, disclosure `fixture-page`).
- Fields compared 8 (2 records x 4), matched 4, mismatched 4; 11 expected records (44 fields) absent.
- Every mismatch, observed beside expected (expected rows 1-based):

| Row | Field | Expected | Observed | Why |
| --- | --- | --- | --- | --- |
| 1 | all 4 | Lumo Audio Drift Wireless Earbuds ... 50H ... / $49.99 / 4.1 / `.../dp/B0PXHP88KT` | same (url absolute, matched) | — |
| 2 | name | Brightaisle Basics Sport Wireless Earbuds, Bluetooth 5.3 with Ear Hooks, 36H Playtime, IPX7 Sweatproof, Black | Replacement Ear Tips for Wireless Earbuds, Memory Foam Eartips, 3 Pairs (S/M/L), Black | ear tips kept: no accessory rule in s6. Row 2 itself is page 1's boundary result (w12: `tests/scenario.test.ts:80` `kept(15)`), one of the four lazy results a paged read never renders |
| 2 | price | $22.99 | $12.99 | same row |
| 2 | rating | 4.0 | 4.5 | same row |
| 2 | url | `/scenarios/everything-store/Brightaisle-Basics-Sport-Wireless-Earbuds-Bluetooth-5-3/dp/B0R257NR7U` | `http://127.0.0.1:63272/scenarios/everything-store/Replacement-Ear-Tips-for-Wireless-Earbuds-Memory-Foam/dp/B0JKYDKPGR` | same row |
| 3 | all | Zephyrline Z3 ... Sage / $34.99 / 4.3 / B0P8ZF57AC | absent | page 1 stop |
| 4 | all | Aurelle Echo ... Ivory / $47.99 / 4.5 / B0J5MCMBAY | absent | page 1 stop |
| 5 | all | Aurelle Pods Fit ... Ivory / $39.99 / 4.4 / B0VNKJTVCD | absent | page 1 stop |
| 6 | all | Tessaro Arc ... Sage / $29.99 / 4.2 / B07Z1RZGJG | absent | page 1 stop |
| 7 | all | Aurelle Pods ... 40H ... Black / $47.99 / 4.0 / B00BJX53AC | absent | page 1 stop |
| 8 | all | Lumo Audio Drift Pro ... Wireless Charging Case ... White / $26.99 / 4.2 / B09HZLEPLS | absent | page 1 stop; the re-authored rule would also drop it |
| 9 | all | Aurelle Pods Fit ... Ivory with Wireless Charging Case / $39.99 / 4.4 / B0HKSZ2BM6 | absent | page 1 stop; the re-authored rule would also drop it |
| 10 | all | Trevio T5 ... Active Noise Cancelling ... Ivory / $22.99 / 4.6 / B0G68DZTDB | absent | page 1 stop |
| 11 | all | Trevio T5 ... Wireless Charging Case ... Rose Gold / $39.99 / 4.0 / B0X473P78X | absent | page 1 stop; the re-authored rule would also drop it |
| 12 | all | Aurelle Pods ... 50H ... Black / $47.99 / 4.0 / B02UB6NJWC | absent | page 1 stop |
| 13 | all | Soundcrest Air Pro 2 ... Graphite / $34.99 / 4.5 / B016CBKJ2R | absent | page 1 stop |

- Not count-only: every field of both returned rows was compared.

## Stage 6 — judgement and repair

- **Judged:** `refuted`, correctly, with the read's facts: "read 1 page of at most 10, paging stopped on control_absent and kept 2 of 15 items seen; ... its 4 conditions rejected 3, 2, 7, 5 rows". The judge now sees pages and stop (run 4's cause 5). Its advice was two-thirds right: add an accessory rule, fix paging. It was wrong on the third point, "No condition ... checks Brightaisle Plus eligibility", because `where` (1) is the Plus badge test. The judge is told each condition's rejection count, not what it tests.
- **Automatic repair:** yes. Result re-author routed and **applied** (`72a7ffbb`, attempt 1, 302,776 ms, USD 0.045770), `refusal: null`, `failureCode: null`. `runtimePatchAttempts: []`.
- **Context the repair received:**
  - The failure record: present. The brief of 3,739 chars carries the judge's expected and actual text; findings `result.counts_look_right`, `result.summary_withheld`, `fixLines: 1`, `advised: true`.
  - The Flow with the failing node in place: present. It was seeded as steps `f1..f6`, and the re-author reran `f6`.
  - The page when it broke: partly. The re-author's first step captured the page (8,736 B), which was page 1 as the playback left it.
  - Prior steps with parameters and results: parameters through the seed; the playback's per-read result only as the judge's summary.
  - The conversation: NO EVIDENCE.
  - Which rows the conditions rejected: NO EVIDENCE in the brief record.
- **The re-author's own run:** thirteen 11-second reruns into the store's 429 limiter (screenshots at 08:55:23, 08:56:43 and 08:58:04), nine malformed responses, and a final detect that saw nothing repeating. It then completed with **no dry run** in `core.log` and a Flow holding two chained extract nodes. It corrected the accessory rule too broadly and the paging selector wrongly (Stage 3).
- **Persisted, and did the re-run use it:** persisted (revisions 2 and 3); the re-run used it (the overlay counts 7 steps). The re-run stopped on s4 before any read, so the repaired reads were **never played** and **not re-judged**.

## UI review (`run-munv53gt-a0e6f545.ui-review.local/`, 56 moments, 08:51:58 to 09:09:27)

- **01 to 02:** no overlay (start; `about:blank` at 02).
- **03 to 08 (build):** the overlay is present, but moments 03, 06 and 07 are `flickering`; 07 has 4 presence toggles in 3 s. Its text is raw tool ids and codes: "Using web.detect_repeating_structure", "Using core.run_node: core.replay.replayed", "Checking the proposed result".
- **09 to 10:** absent at the build-to-run handover.
- **11 (08:54:43):** "Running your Flow · Step 5 of 6 · Checking the result answers the request". The judged step is the 6th node (s6), so the count is off by the merge. The page behind is scrolled to the sponsored "Featured from our brands" carousel, with "Never miss a deal" and the cookie banner up.
- **12 to 26 (08:55:04 to 08:59:44, the whole re-author):** the overlay and panel say **"Running your Flow · Step 5 of 6 · Using core.run_node"**. That is wrong: nothing was running step 5, FluxIQ was re-authoring. Behind it the site shows **"Sorry, you're going a little too fast"** (13, 17, 21) and nothing tells the person. **24 to 26:** "The proposed result passed its check" for 40 s, **misleading** while the run's actual result stood refuted.
- **27 to 28 (re-run):** "Running step 6 of 7: node.bootstrap.1087466e1d5ee18d.main.s4" shows a **raw node id**, and s4 is not step 6. Moment 27 is `flickering` (2 presence toggles).
- **29 to 56 (09:00:44 to 09:09:27):** **no overlay at all for 9 minutes** while FluxIQ's recovery was still unsettled. Panel: "Run failed · Worked for 4m 54s · 20 steps · 1 failed", collapsed: no answer, no rows, no reason, no next step. The store's deal modal and cookie banner are still open in the final frame (56).
- Every panel frame: **"Add an AI model key: To do"** during a keyed build (false). The chat has no user turn and no assistant message, only a status block, so it does not meet the ChatGPT-like chat standard.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | Built s6 `paginate.next: "main > div:nth-of-type(2) > div > nav > a:nth-of-type(6)"`, authored from a later page. On page 1 it names nothing, so the read stopped `control_absent` after 15 items, and that is reported as an ordinary end | extension `content/extraction/pagination.ts` `followNext` (`document.querySelector(paginate.next)`); origin `detect-pagination.ts:95` `selectorFor` | **Existing:** `nextControlOnPage` (`detect-pagination.ts:132-252`) plus `awaitNextControl` with a 1 s pager wait in `followNext`; `reports/t194-w12-page-one-stop.md`; in tree (WIP `518e38fe`), not live-validated | t194-w12 |
| 2 | A paged read never lets a page's four lazy results load: `awaitListComplete` runs only `if (paginate === undefined)`. Page 1's boundary result (expected row 2) is never read | extension `content/extraction/list-reader.ts:489-496` (page loop from `:507`) | **None yet.** Proposed in w12 open question 2: at the top of the page loop, `if (pageByPage) await awaitListComplete(item, ..., progress.deadline)`, and give the list-reader test fakes `getBoundingClientRect`/`scrollIntoView` | t194 (open) |
| 3 | Built s6 has no accessory rule, so "Replacement Ear Tips ..." ($12.99, 4.5, Plus) is kept | model output (build) | Judge caught it; re-author added a rule (cause 4) | t194 |
| 4 | Re-authored rule `name not contains ["ear tips", "charging case", "replacement"]` drops expected rows 8, 9 and 11 ("... Wireless Charging Case") | model output (re-author); what the re-author is shown of rejected rows | Same as run 4 cause 1, open; see `reports/t194-w9-rejected-rows.md` (not read by this debug) | t194 |
| 5 | Re-authored `paginate.next` `a:nth-of-type(4)` would visit pages 1, 2, 5, 3, 4 (out of results order) | model output; same positional selector origin as cause 1 | Covered at run time by cause 1's fix: `(4)` on page 2 names page "5", which `namesAnotherPage` rejects in favour of the pager's Next | t194-w12 |
| 6 | The optional s4's two `retry_node` retries spent the subflow recovery budget (2), so its third miss withdrew the authored `s4:failed -> s5:in` route and stopped the re-run | Core `runtime/executor/recovery-budget.ts` `recoveryBudgetState` | **Existing:** ladder rung kinds excluded from the recovery counts; test `executor/tests/optional-failed-route.test.ts`; in tree (WIP `4c8753ed`), not live-validated | t194 |
| 7 | Re-run attempt ids collided with the first pass's (`s1.attempt.1`..`s4.attempt.4`), so the re-run's s1 to s3 and s4 try 1 were dropped, and `s4.attempt.4` reads as succeeded | Core `executor/graph-run.ts`, `service/runtime-adaptation/repair-rerun.ts` | **Existing:** `priorAttemptCount` (`graph-run.ts:385`, `repair-rerun.ts:118`), w7 item 3's diff, applied | t194-w7 |
| 8 | No per-origin pace: the re-author's thirteen 11-second reruns met the 429 limiter (08:55:23, 08:56:43, 08:58:04) and returned identical 3,538 B evidence | extension pagination and navigate paths | **Existing:** `background/page-pace/` (`reports/t194-w10-origin-pace.md`) | t194-w10 |
| 9 | The build's dry run accepted a one-page read as `replayed`: a read counts as `changed` only when it now reads nothing | downstream `domain/src/runtime/llm-evidence/node-run/replay.ts:88-91, 234-241` (`produced: {records}` only) | **Proposed:** carry `pagesRead` and `paginationStop` in `produced`, and answer `changed` when a read that followed N pages now stops earlier, or stops `control_absent` on page 1 | t194 (open) |
| 10 | The re-author completed with two chained extract nodes writing the same dataset with `replace`, and ran no dry run | Core result re-author completion (`service/runtime-adaptation/`, completion check) | **Proposed:** refuse a completion with two record producers for one dataset, and dry-run a re-authored draft like a build's. Files to locate | t194 (open) |
| 11 | The judge reads condition counts but not what each tests, so it claimed no Plus condition existed | Core `result-verification/core-observation.ts` | **Proposed:** list each condition's field and test (for example `aria-label present`, `rating >= 4`) in the read's summary | t194 (open) |
| 12 | UI: raw tool ids and node ids; "Running ... Step 5 of 6" through a re-author; "passed its check" after a refutation; step numbers counting the merge; no overlay for the last 9 min; unexplained "Run failed"; false "Add an AI model key"; no chat turns | extension overlay, side-panel status | Sent to the UI lane (t191) | t191 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Decision arguments, and each rerun's rows, pages and stop, in both loops (only call ids, codes and bytes) | Core `flow-bootstrap/evidence-loop-steps.ts`; Lab `flowLaneSnapshot` |
| 3 | The played `paginate.next` is withheld in `flow-lane.json` `authoredNodes` (`parametersWithheld` includes `extractList.paginate.next`). The Flow source on disk is the post-re-author version, so the played selector was only in `project.sqlite` | Lab `packages/test-runner/src/flow-lane/` snapshot policy |
| 4 | The re-run's s1 to s3 and s4 try 1 (fixed, cause 7) | Core `executor/graph-run.ts` |
| 4 | What 09:00:26 to 09:09:23 was spent on; Core's recovery record never arrived | Core runtime recovery record; Lab `flow-lane/terminal-run-wait.ts` |
| 6 | Whether the re-author ran a dry run; the attempt record does not say | Core result re-author attempt record |
| header | `live-llm.json` counts only the build (re-author and repair costs are elsewhere); 7 unrecorded calls | Lab live-LLM accounting |
