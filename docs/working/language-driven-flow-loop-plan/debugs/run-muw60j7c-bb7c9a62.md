# Run debug — `run-muw60j7c-bb7c9a62`

Lane C of the Phase 1 live round (t274), written by the lane C lead. Central run folder `F` =
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-05/run-muw60j7c-bb7c9a62/`; session folder `S` =
`fxwork/t274/!FluxIQWebExtension/test-runs/instances/t274-slot-1/persistent-isolated/t274-c/.sessions/run-muw60j7c-bb7c9a62/`.
Trees: downstream `fxwork/t274/!FluxIQWebExtension` `efaf2034` (clean but for this lane's docs), Core
`fxwork/t274/!FluxIQ` `a83b1471` (= Core `dev`). Launched 2026-10-06T04:14:22Z.

## Stage 1 — expectations (written 2026-10-06T04:11Z, before the dry run and the launch)

Copied unchanged from `docs/working/mvp-final-month-plan/reports/live-C.md` "Expectations", where they were
written before anything ran.

- The instruction (task `everything-store-plus-earbuds-under-50`, 415 characters, sha256 `d4f7835b...`): "Find
  every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or
  higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories
  such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order
  the search results show them in, with columns name, price, rating and url."
- Actions a correct Flow takes:
  1. Open the store home.
  2. Dismiss the cookie bar ("Decline") and the "Never miss a deal" dialog ("Not now") when present, as optional
     or state-routed steps.
  3. Search "wireless earbuds" (type, submit), landing on results page 1.
  4. One list read over the result cards that pages through every results page (five) with an explicit bound,
     `paginate: {next: ..., maxPages: >=5}`, never `paginate: true` alone; conditions: not sponsored, Plus badge
     present, printed rating >= 4.0, price < $50.00, not an accessory (ear tips and a charging case sold alone are
     out; a pair "with Wireless Charging Case" stays in); de-duplicated by url; page order; columns name, price,
     rating, url as printed.
  5. Traps: four results a page load only on scroll; page 2's Next link leads back to page 2; a too-fast sweep
     draws a 429; the store's "4 Stars & Up" and "$25 to $50" filters are wrong shortcuts.
- Exact oracle: dataset `extract-plus-under-fifty`, **13 records in order, 52 string fields matched in place**:
  B0PXHP88KT, B0R257NR7U, B0P8ZF57AC, B0J5MCMBAY, B0VNKJTVCD, B07Z1RZGJG, B00BJX53AC, B09HZLEPLS, B0HKSZ2BM6,
  B0G68DZTDB, B0X473P78X, B02UB6NJWC, B016CBKJ2R (names and prices in `live-C.md`). Final state: not challenged;
  cart count "2". Pass needs the Lab verdict `passed`: oracle held and Core's result check not refuting it.
  Look-alike wrong answers: 10 of 13 (the three charging-case pairs dropped), 3 (page 1 only), 14+ (a boundary
  repeat kept), sponsored rows kept. Expected read account: 5 pages, stopped `control_disabled` on page 5, about 94
  seen, 2 repeats left out.
- UI checkpoints: U-start (bubble at send, overlay prompt), U-read (read cards carry counts, no false "every page"
  claims), U-detect (card names the list), U-words (no step numbers, handles, node ids, `page_limit`, `endView`,
  `paginate`, `extract_list`), U-status (cut at a word, no flicker), U-tests (every test's cards shown), U-run
  (merges hidden, count right, dropped after the run), U-end (result in words, or what the Flow does and what
  blocked it).

## Watch log

- 04:14:22Z launched (`pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --max-attempts 1`, instance
  `t274-slot-1`, workspace `t274-c`); guard `admitted`, fingerprint `sha256:aad4522a...`.
- 04:19:30Z steps 0001-0006: chat `flow.createHere`, then build decisions adding steps.
- 04:23:00Z build complete at 0023, build test, two build-test judges `yes`, playback, two result judges, re-author
  under way with repeated `changes_nothing`.
- 04:23:50Z run ended `failed` (campaign exit 1). Not relaunched.

Note on numbering: `F/steps/index.md` was written by Core as the run went and is **off by six from step 0033 on**:
the six playback folders (`0033-run-*` to `0038-run-*`) were inserted after Core stopped, so index row "0033 judge"
is folder `0039-judge`, and so on. Every step number below is a **folder** number.

## Header

- Run id `run-muw60j7c-bb7c9a62`; Flow `flow` in workspace `t274-c` (id in `F/snapshots/flow-lane.json`
  `flowId`); nodes `node.bootstrap.589d57d24ac663c7.main.s1..s7`.
- Scenario everything-store, no variant, task `everything-store-plus-earbuds-under-50`, workflow `plus-under-fifty`,
  judged by expected dataset `extract-plus-under-fifty` (stepIndex 16). Lane `created-flow`, `buildEntry: chat`,
  target `persistent-isolated`.
- Command: `pnpm lab run everything-store --live-llm --llm-profile lab-create-flow --llm-provider deepseek
  --llm-model deepseek-flash --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50
  --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48`
  (from `pnpm.cmd lab:campaign ... --max-attempts 1`). Headed Chrome, ports 60760-60762.
- Provider and model: deepseek / `deepseek-flash`; ceiling $0.10 per build (`authorized.maxEstimatedCostUsd 0.1`).
- **Calls and cost: 54 calls, $0.081399873** (`live-llm.json` `runSpend`; campaign summary `reportedCostUsd
  0.08139987`; the 51 costed step folders sum to the same 0.081399873). Per build: creation $0.024054 (chat 1
  call $0.000183, build 11 decisions $0.021981, build-test judges 2 calls $0.002074); result judges 2 calls
  $0.002898 (`part: null`); re-author 35 calls $0.054265 (11 explore $0.024594, 24 repair $0.029671). No build over
  the ceiling (`buildsOverCeiling 0`, `maxBuildCostUsd 0.05426514`).
- Verdict: **failed**. Oracle `records: failed`, `finalState: held` (`never-challenged` held, cart count "2" held).
  Extraction: expected 13, **observed 30, matched in place 0, matched in any order 10**, 52/52 fields present.
  FluxIQ reported `output_not_observed` / `core.result.does_not_answer_request` at `verification`;
  `resultVerification: refuted`; re-author routed, ended `flow_bootstrap.evidence_budget_exhausted` (six rounds,
  `adaptationId: null`, `applied: false`).
- **Stage reached: 6.** Built, tested, judged yes, proposed, played back, answered wrongly (30 rows), refuted
  correctly, re-authored without a test, ended at the re-author's rounds bound.

## Stage 2 — exploration

### Build round 0 (0002-0023), one row per decision

| # | What it decided (its summary, short) | Action | Result |
| --- | --- | --- | --- |
| 0001 | chat | `flow.createHere` with the instruction | build starts |
| 0002 | (initial, no model) | navigate home | home; cookie bar and "Never miss a deal" dialog |
| 0003 | "Dismissing the cookie banner" | click t121 Decline, **add** | ok |
| 0005 | "Dismissing the notification popup" | click t130 Not now, **add** | ok |
| 0007 | "search the store for wireless earbuds" | type t17 "wireless earbuds", submit, **add** | results page 1 |
| 0009 | "Detecting the repeating product list" | detect t230 (the "Sponsored" label) | `extraction.1`, 15 items, `data-ad-id` coverage 0.2 |
| 0011 | same | detect t228 | `extraction.2`, identical |
| 0013 | same | detect t228 again | `extraction.3`, identical (third identical detect, not refused) |
| 0015 | "describe the extract-list node" | `core.describe_nodes` | ok |
| 0017 | "Reading the search results list ... **to see the rows, fields and pagination it really returns before adding it**" | `core.run_node` extract_list `extraction.3`, six fields, **no where, no paginate, no add** | 0018 ok; the read scrolled page 1 to y=2604 (loads the lazy last four cards): its digests differ |
| 0019 | "Reading all search result pages ... keeping only Plus, 4.0+, under $50, excluding sponsored and accessories" | extract_list, where [sponsored absent, plus present, rating >= 4, price < 50, name not contains ["ear tips","charging case","eartips"]], `paginate {mode next, next "a.next", maxPages 50}`, dedupe url, **no add** | 0020 ok, ended on page 5 |
| 0021 | "add the search-results listing step to the Flow, then repeat the extraction over it" | amend: step 10 `add`; step 10 `repeat over 10` | `partly_applied`: add applied; repeat refused `over_not_before` (correctly: nothing to repeat) |
| 0023 | "step 10 already keeps only ... across all pages, so the Flow is complete" | `complete` | accepted; build test |

- The draft the model saw at 0021 (0021 request.txt:2040-2215): steps 1-4 kept; 5-8 looks; **step 9 the
  unfiltered read, `disposition: taken`, `inResult: false`**; step 10 the filtered read. The model added only 10.
  The build test then replayed **both** reads (0029: "kept 20 rows from 1 page, stopped on page_limit, cut short";
  0030: "kept 10 rows from 5 pages, stopped on control_disabled; 94 items seen; per condition rejected (removed
  alone): sponsored 20 (4), plus 37 (6), rating 34 (12), price 40 (3), name 20 (5)"). Step 9 entered the Flow as
  an **opener** of step 10 (Cause C-1).
- Repeats: three detects of one list (0009-0013, $0.004559). Nothing else repeated in round 0; 11 decisions.
- Rejections: `over_not_before` (0022) said why and the model moved on. No other refusal.
- Context: input grew from 11,862 (0003) to 38,165 tokens (0023); nothing evicted.

### Re-author (0041-0136), grouped by round

| Round (loop start) | Steps | What happened |
| --- | --- | --- |
| r0 (04:21:32) | 0041-0069 | Opening look on results page 5. Re-detect (0042), four `describe_element` looks at Plus badges (0044-0050, all show `aria-label="Brightaisle Plus"`). **0052: drop step 6 (the unfiltered read) and rerun step 7** with where [sponsored absent, plus present (`aria-label`), rating >= 4, price < 50, name not contains ["ear tips","eartips","charging case replacement","replacement"]], `paginate {next ..., maxPages 50}`, dedupe url: applied. **0055: "13 records from 5 pages" -- exactly the oracle's 13 ids in order** (B0PXHP88KT ... B016CBKJ2R). 0056: following the check's (wrong) advice, reruns step 7 **without the plus condition**: 0059 "21 records from 5 pages" (non-Plus pairs in). 0060 the same (21). 0064, 0066, 0068: the same where again, refused `changes_nothing` x3 |
| r0 cont. | 0070-0081 | 0071: rerun step 5 (the carried search) with `element {input, "Search Brightaisle"}`: applied, put back, **`target_unobserved` / `target_not_a_handle`** (0074). 0075-0079: three resends, `changes_nothing` x3. 0082: rerun with no input, `rerun_needs_input`. 0084: rerun step 1 `input {}`: navigate ran |
| r1-r5 (04:22:43, 04:22:52, 04:23:10, 04:23:18, 04:23:27) | 0086-0136 | The same pattern five times: a look, a rerun of step 5 (0087/0091/0094/0105/0116/0127, the last with `input {}` exactly as the brief says), put back, `target_unobserved` with `instead: target {handle: tN}`; then three resends with `element` refused `changes_nothing`. The model never wrote `target: {handle: "t17"}` and never sent `complete`. Rounds bound reached |

- Rejections that did not say enough: `target_unobserved` with `reason: target_not_a_handle`, `instead: ["target:
  {\"handle\": \"tN\"}", ...]` (0090 result.json). It names the shape but not that the stored step's `element`
  descriptor is the reason, nor which handle on the shown page is the search box. The re-author brief (0042
  request.txt:56, 0071 request.txt:575) says "rerunning a step with the parameters it has is how it comes to have
  run" -- the domain refuses exactly that for any element-acting carried step
  (`domain/src/runtime/llm-evidence/node-run/run.ts:281-286`). Brief and domain contradict each other (C-4).
- Context: re-author requests 18-27k tokens; nothing evicted.

## Stage 3 — the proposed Flow

The stored Flow, as the re-author's seed shows it (0042 request.txt, draft steps 1-7) and as playback ran it:

1. `main.s1` navigate `http://127.0.0.1:60760/scenarios/everything-store/`, newTab false.
2. `main.s2` click `element {button, "Decline"}`, timeout 10 s, **optional** (the Flow carries on when it fails).
3. `main.s3` `builtin.control.merge` first.
4. `main.s4` click `element {button, "Not now"}`, timeout 10 s (not optional).
5. `main.s5` type "wireless earbuds", submit, `element {input, "Search Brightaisle"}`, timeout 10 s.
6. **`main.s6` extract_list**, item `main > div:nth-of-type(2) > div > div:nth-of-type(1) > div.css-0rc9pnw`, six
   fields (name, price, rating, url, sponsored text, plus `aria-label`), **no where, no dedupe, `paginate {next ...,
   maxPages: 1}`**, records to dataset `web.output.dom-extract_list`, `writeMode: append`.
7. `main.s7` extract_list, same item and fields, where [sponsored absent, plus present, rating >= 4, price < 50,
   name not contains ["ear tips","charging case","eartips"]], `paginate {next "... nav > a:nth-of-type(4)",
   maxPages: 50}`, dedupe by url, records to the **same dataset**, `writeMode: append`.

Divergences from Stage 1:
- `s6` should not exist: the exploratory unfiltered read, never added by the model, brought in as `s7`'s opener
  (**misread by Core**, not by the model: C-1).
- `s7`'s name condition drops "with Wireless Charging Case" pairs (**misread the instruction**: C-2). Everything
  else in `s7` is right: sponsored by label, Plus by `aria-label`, rating, price, every page (`control_disabled` on
  page 5), dedupe by url, page order, four string columns.
- `s4` is not optional; harmless here (the dialog showed in every run).

## Stage 4 — replay

Playback 0033-0038 (`evaluation.json` actions, step `result.json`):

| Node | Executed | Produced | Duration | Retries | Rung |
| --- | --- | --- | --- | --- | --- |
| s1 navigate | 0033 succeeded | home | 2,312 ms | 0 | - |
| s2 Decline | 0034 succeeded | cookie bar dismissed | 440 ms | 0 | - |
| s3 merge | succeeded | - | 0 ms | 0 | - |
| s4 Not now | 0035 succeeded | dialog dismissed | 716 ms | 0 | - |
| s5 type | 0036 succeeded | results page 1, robot check cleared by itself after 9 s | 9,506 ms | 0 | - |
| s6 read | 0037 succeeded | **20 rows, 1 page, `page_limit`, unfiltered** | 2,599 ms | 0 | - |
| s7 read | 0038 succeeded | 10 rows, 5 pages, `control_disabled`, 94 seen, 2 repeats left out | 10,647 ms | 0 | - |

- A node that succeeded while doing the wrong thing: `s6`, which did exactly its parameters (one unfiltered page)
  and appended 20 rows nobody asked for.
- Provider calls during playback: zero (no costed folder 0033-0038).
- Build test (0024-0030): reset, navigate, Decline `remembered`, Not now `remembered`, type, the two reads (same
  counts as playback). Zero calls.

## Stage 5 — the answer

- Records: expected 13, stored **30** (one record set): `s6`'s 20 unfiltered page-1 rows (sponsored, non-Plus,
  rated under 4 and the ear-tips accessory among them), then `s7`'s 10. Matched in place 0 (row 1 is the sponsored
  Pulsebud Neo), matched in any order 10.
- `s7`'s 10 are expected rows 1-7, 10, 12, 13. **Missing: 8 B09HZLEPLS (Lumo Audio Drift Pro ... Wireless Charging
  Case ... White), 9 B0HKSZ2BM6 (Aurelle Pods Fit ... Ivory with Wireless Charging Case), 11 B0X473P78X (Trevio T5
  ... Wireless Charging Case ... Rose Gold)**, each removed by the name condition alone (`leftOutOnlyByThis` name:
  5 rows = these 3, the ear tips and the "Charging Case Replacement" accessory).
- Duplicates: B0PXHP88KT, B0R257NR7U and B0P8ZF57AC appear in both `s6` and `s7` (dedupe is per read).
- Fields: 52/52 present, no non-string values. Not count-only: every field of every row compared. `expectedPages`
  and `pagesFollowed` are still `null` in the oracle (musp39u8 gap stands).
- The two look-alikes predicted in Stage 1 both happened at once: 10 of 13 (charging-case pairs) inside 30
  (an unfiltered page added).

## Stage 6 — judgement and repair

| Step | Judged | Verdict | Conf. | Reason (short) | Right? |
| --- | --- | --- | --- | --- | --- |
| 0031 | build test (both reads) | `yes` | 0.7 | "The unfiltered read (step 9) kept 20 rows from 1 page only ... so it is not the paging read"; conditions "look correct ... accessory names excluded" | **Wrong.** Saw the unfiltered read and passed it; missed the three pairs its own `leftOutOnlyByThis` listed |
| 0032 | the same | `yes` | 0.9 | "leftOutOnlyByThis shows each condition removing rows that the request also excludes"; "the test stored nothing ... so the record set is empty" | **Wrong.** The name condition's `leftOutOnlyByThis` (0031 request.txt:472-475) lists the three pairs; the prompt (line 28) says "an item sold with or including an excluded part is still the item" |
| 0039 | playback (30 rows) | `no` | 0.6 | `s6` appends 20 unfiltered rows; duplicates; name rule drops pairs; **"plus is present alone excluded 6 rows that satisfy the request, including ... B0J5MCMBAY, B07Z1RZGJG"**; "sponsored is absent dropped non-sponsored rows" | Right verdict. Right on `s6` and the name rule. **Wrong on Plus and sponsored**: B0J5MCMBAY and B07Z1RZGJG are stored (s7 rows 4 and 6), and every other row it names is not in the oracle |
| 0040 | the same | `no` | 0.6 | same, and "Plus eligibility rendered as an image (img "Brightaisle Plus"), not an aria-label" | Right verdict; the Plus claim is false (the badge carries `aria-label="Brightaisle Plus"`, 0045) |

- Build-test pair yes + yes = confirmed; the build was proposed. Result pair no + no = refuted;
  `core.result.does_not_answer_request`, routed to the re-author (one attempt; musp39u8's double re-author, R4,
  did not recur).
- What the repair received (0042 request): the check's verdict and advice, verbatim including the false Plus and
  sponsored advice; Core's read account; the brief "Act on the check's findings and advice above. Where the advice
  names a fix, make it -- ... where the check's advice contradicts 'How the read went' ... Core's account stands"
  (line 74). Core's account says nothing about which condition rejected which row, so it cannot contradict the
  Plus claim.
- Was the repair persisted: no. **At 0055 the re-author held the exact answer** (drop `s6`, narrowed name rule:
  13 records, the oracle's 13 in order). 0056 then removed the Plus condition on the check's advice (21 records),
  and from 0071 every round tried to rerun the carried search step, which the domain refuses (C-4). No `complete`
  was sent, so no whole-Flow test ran. Ending: rounds bound, $0.054265 of the $0.10 ceiling spent; the stored Flow
  is unchanged (still 30 rows).
- **NO EVIDENCE** whether `complete` after 0055 would have been admitted: the brief lists steps 1-5 (including the
  merge `s3`, which the domain cannot run live, musp39u8 R3b) as `not_run_in_this_build`, but the model never
  asked.

### Cost per call

Per-call table generated from the step folders' `meta.json` (step, part/phase, input tokens, cached, output, cost).
Totals by part: chat 1 call $0.000183; creation/explore 11 $0.021981; creation/judge 2 $0.002074; result judge 2
$0.002898; reauthor/explore 11 $0.024594; reauthor/repair 24 $0.029671. Sum $0.081399873 = `runSpend`.

| Step | Part/phase | Input | Cached | Output | Cost (USD) |
| --- | --- | --- | --- | --- | --- |
| 0001 | -/chat | 1794 | 1024 | 107 | 0.000183 |
| 0003 | creation/explore | 11862 | 1408 | 90 | 0.001626 |
| 0005 | creation/explore | 12972 | 5504 | 95 | 0.001194 |
| 0007 | creation/explore | 13453 | 5760 | 98 | 0.001230 |
| 0009 | creation/explore | 19611 | 6400 | 73 | 0.002045 |
| 0011 | creation/explore | 21578 | 13824 | 70 | 0.001247 |
| 0013 | creation/explore | 23595 | 15744 | 70 | 0.001267 |
| 0015 | creation/explore | 23940 | 15744 | 78 | 0.001323 |
| 0017 | creation/explore | 24615 | 3456 | 291 | 0.003359 |
| 0019 | creation/explore | 30421 | 7808 | 385 | 0.003646 |
| 0021 | creation/explore | 37621 | 13056 | 73 | 0.003768 |
| 0023 | creation/explore | 38165 | 30720 | 112 | 0.001276 |
| 0031 | creation/judge | 12421 | 2816 | 454 | 0.001722 |
| 0032 | creation/judge | 12421 | 12287 | 492 | 0.000352 |
| 0039 | -/judge | 13821 | 1792 | 869 | 0.002331 |
| 0040 | -/judge | 13821 | 13568 | 813 | 0.000566 |
| 0042 | reauthor/explore | 20399 | 1536 | 73 | 0.002878 |
| 0044 | reauthor/explore | 22563 | 14464 | 79 | 0.001306 |
| 0046 | reauthor/explore | 22853 | 16256 | 70 | 0.001080 |
| 0048 | reauthor/explore | 23221 | 16512 | 71 | 0.001098 |
| 0050 | reauthor/explore | 23518 | 16768 | 70 | 0.001105 |
| 0052 | reauthor/explore | 24138 | 17024 | 414 | 0.001367 |
| 0056 | reauthor/explore | 34051 | 7936 | 162 | 0.004038 |
| 0060 | reauthor/explore | 35012 | 12672 | 160 | 0.003485 |
| 0064 | reauthor/explore | 35980 | 13312 | 132 | 0.003519 |
| 0066 | reauthor/explore | 36116 | 14208 | 131 | 0.003407 |
| 0068 | reauthor/explore | 36186 | 28544 | 130 | 0.001310 |
| 0071 | reauthor/repair | 20877 | 9344 | 100 | 0.001818 |
| 0075 | reauthor/repair | 22056 | 6400 | 87 | 0.002420 |
| 0077 | reauthor/repair | 22404 | 15744 | 106 | 0.001110 |
| 0079 | reauthor/repair | 22474 | 15744 | 87 | 0.001109 |
| 0082 | reauthor/repair | 17165 | 9600 | 64 | 0.001202 |
| 0084 | reauthor/repair | 17697 | 11264 | 67 | 0.001039 |
| 0087 | reauthor/repair | 18119 | 9856 | 96 | 0.001327 |
| 0091 | reauthor/repair | 18513 | 9600 | 103 | 0.001428 |
| 0094 | reauthor/repair | 18871 | 12032 | 101 | 0.001123 |
| 0098 | reauthor/repair | 19500 | 12288 | 103 | 0.001180 |
| 0100 | reauthor/repair | 19850 | 12672 | 83 | 0.001165 |
| 0102 | reauthor/repair | 19917 | 12672 | 82 | 0.001174 |
| 0105 | reauthor/repair | 17444 | 9856 | 95 | 0.001225 |
| 0109 | reauthor/repair | 18069 | 9600 | 82 | 0.001348 |
| 0111 | reauthor/repair | 18417 | 11776 | 85 | 0.001082 |
| 0113 | reauthor/repair | 18487 | 11776 | 89 | 0.001095 |
| 0116 | reauthor/repair | 17444 | 11136 | 93 | 0.001035 |
| 0120 | reauthor/repair | 18069 | 10624 | 82 | 0.001198 |
| 0122 | reauthor/repair | 18417 | 11776 | 88 | 0.001084 |
| 0124 | reauthor/repair | 18487 | 11776 | 104 | 0.001104 |
| 0127 | reauthor/repair | 17444 | 11136 | 62 | 0.001017 |
| 0131 | reauthor/repair | 18069 | 10624 | 82 | 0.001198 |
| 0133 | reauthor/repair | 18416 | 11776 | 88 | 0.001084 |
| 0135 | reauthor/repair | 18487 | 11776 | 108 | 0.001107 |

What the waste cost: three identical detects (0009-0013) $0.004559; the re-author after it held the right
answer (0056-0136) about $0.045.

### UI review

Full table of all 16 moments (32 pictures) in `docs/working/mvp-final-month-plan/reports/live-C-ui-review.md`
(worker report; this lead re-viewed moments 07 panel, 14 scenario and 16 panel and they match). Summary:

- Fixed: the bubble shows at send with the composer empty and the overlay present from the first sample (U-F
  partly); the ending gives a row count and says the check refuted it, with no "--" (U-E partly); no
  `extraction.N`, handles, node ids, `page_limit`, `endView`, `paginate` in any picture; named test cards; no merge
  cards; "Step N of 6" counts the merge out.
- Still open: read cards say only "Done", never "N rows from M pages" (moments 04-12; the overlay alone says
  "Saved 20 records") (U-A); "Look · Sponsored ⓘ ... Hybr..." and "Look · Brightaisle Plus" (U-B); model
  vocabulary ("extract-list node", "extraction node", "selector", "attribute", "markup") and system wording "steps
  1, 2, 3, 4 and 5", "named no control from the page" (U-C); overlay cut mid-word "Search Bri…", "another w…",
  "the…" (U-D); "Sending your message" ~2.7 s after send (U-F).
- New: the build test's check card says "**Passed: no rows came back.** The result was judged to answer the
  request." (moment 07): the person is told an empty list answers a list request, and it is the same evidence gap
  as C-3. "Step 6 of 6" stays during the result check (09). Refusals shown 2-3 times per picture as work cards
  ("Not done: that step was already tried exactly this way ...", 13, 15, 16). "Didn't work: it wasn't on the
  page" beside a picture where the search box is plainly visible (14). The ending does not say what blocked the
  repair, and says "returned" for rows that were saved (16).

## Causes

| # | Cause, precisely | Repo and file | Fix | Status |
| --- | --- | --- | --- | --- |
| C-1 | **An exploratory read joined the Flow as an opener.** When the model adds a step, `automationStudioFlowDraftKeepOpeners` keeps every `taken`, proposable step since the last kept step whose state digests differ. The unfiltered read 0017 (draft step 9, never added) is proposable (`proposes: true`) and its digests differ because it scrolled page 1 to load the lazy cards; so adding the filtered read (0021) brought it in as `s6`, which appended 20 unfiltered rows to the same dataset. A read's effect is `observe` (`domain/src/actions/safety.ts`: extract_list `safe`): nothing a later step stands on | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/path-to-step.ts` (the walk) | Pass over a step whose `effect` is `observe` in the walk, after the `kept` check (so an added read still ends the walk). Failing test first: `flow-draft/tests/opener.test.ts` "a read the model ran and never added" (3 tests; 2 failed before the fix with `[1,2,3,4,6,7]` and `[3,2]`) | **Fixed in the lane tree, uncommitted** |
| C-2 | Round 0's name condition `not contains ["ear tips","charging case","eartips"]` removes the three "with Wireless Charging Case" pairs; neither build-test judge caught it although `leftOutOnlyByThis` listed them and the prompt states the rule. Same miss as musp39u8 0087 | model judgement (deepseek-flash) | None proposed in source. The result check caught it, and the re-author fixed it at 0052 | open (model) |
| C-3 | The build-test judges are told the test "stored nothing", so the record set they judge is empty: they cannot see that two reads append to one dataset (30 rows, duplicates). 0031 saw the unfiltered read and passed it; the chat card says "Passed: no rows came back" | Core build-test judge evidence (`flow-bootstrap` build-test judging) | Give the build-test judge the record set the Flow would store: each read's kept rows, concatenated per dataset and write mode | open (proposed) |
| C-4 | **The re-author cannot rerun a carried click or type step as its brief tells it to.** The brief says "rerun each [carried step] ... rerunning a step with the parameters it has is how it comes to have run". A carried element step holds `element {tagName, accessibleName}` and no handle, and the domain refuses an element-acting node whose parameters name no handle as "a locator the model invented" (`target_not_a_handle`), even with `input {}` (0127). Five rounds of this; the model never supplied `target: {handle: t17}` | downstream `domain/src/runtime/llm-evidence/node-run/run.ts:281-286`; Core re-author brief (`flow-bootstrap/unfinished-build/judgement.ts` / `recovery/refuted-result/brief.ts`) and `flow-bootstrap/unfinished-build/not-run.ts` | Either let a rerun of a carried step resolve its own stored `element` (it was not invented: it came from the Flow), or schedule unchanged carried steps for the whole-Flow test without a live rerun, as the seed's "scheduling candidate" comment intends; and stop telling the model to rerun with the parameters it has where that cannot work. Musp39u8's R3a, still on dev | open (proposed) |
| C-5 | The result judges' advice contained two false claims (Plus and sponsored conditions dropped valid rows, naming two stored ids); the re-author followed them and threw away the exact answer it held at 0055 | model judgement; Core brief `recovery/refuted-result/brief.ts` (advice is acted on unless Core's read account contradicts it, and the account says nothing per condition) | Check a judge's "left out" ids against the stored rows and drop advice about rows that are in the result; or carry `leftOutOnlyByThis` into Core's account so it can contradict such advice | open (proposed) |
| C-6 | Three identical detects of one list in round 0 (0009-0013), unrefused | model; Core `already_answered` | minor | open (minor) |
| U-1..U-14 | See UI review above and `live-C-ui-review.md` | extension panel / overlay / Core activity wording | - | open |

With C-1 fixed and nothing else changed, this run's Flow would have stored only `s7`: 10 of 13 (C-2), still a
failure, but one the result check and re-author had already shown they can repair (0052-0055), if C-4 and C-5 do
not stop the repair from reaching its test.

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| all | `steps/index.md` numbering is off by six after the playback folders are inserted (index "0033 judge" = folder 0039) | Lab central run folder writer (`packages/test-runner/src/lab-runs/`) / Core step index |
| 2 | `live-llm.json` counts 54 calls; 51 step folders carry a cost (the costs sum to the same total) | Core step-log writer / `live-llm.json` call rows |
| 6 | The re-author's ending bound (`rounds`) appears only in the chat ending and as six `loop start` lines in `core.log`; `flow-lane.json` records `failureStage: provider_output_validation`, which describes nothing that happened | Core re-author ending record (`service/runtime-adaptation/reauthor-build.ts`) |
| 3 | `flow-lane.json` `flowShape` and `authoredNodes` have no nodes for a proposed Flow; the stored Flow had to be read from the re-author's seed in 0042's request | Lab `flow-lane.json` writer |
| 4 | Playback read folders 0037/0038 `result.json` carry `validation: null` and no counts; the counts are only in `evaluation.json` and the result judge's request | playback step writer |
| 5 | Oracle `expectedPages` / `pagesFollowed` still `null` | Lab extraction oracle |
| UI | No picture shows the result check's refutation in the chat (scrolled out by moment 10) | Lab UI review cadence |
