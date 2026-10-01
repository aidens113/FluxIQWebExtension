# Run debug — `run-muq66ff9-cb3767a1`

Lane C (t194), run 12, chat-driven (`buildEntry: chat`). Written by worker t194-d12. Sources: the run's bundle
(`test-runs/instances/t194-slot-3/run-muq66ff9-cb3767a1/`: `snapshots/{flow-lane,live-llm,extraction-mismatches,decision-trace}.json`,
`evaluation.json`, `run.json`, `events.ndjson`, `logs/core.log` build trace); the six decision dumps
(`test-runs/instances/t194-slot-3/decision-dumps/build-2026-10-01T23-{34-54-915Z,36-29-313Z,37-59-303Z,38-48-822Z,40-39-381Z,42-15-553Z}-30488.jsonl`);
the Lab log (`scratchpad/t194/run12.log`); and the Lab's UI review (`run-muq66ff9-cb3767a1.ui-review.local/`, 29 moments).
This was a read-only pass: nothing was launched, edited, stashed or committed.

---

## Header

- **Run:** `run-muq66ff9-cb3767a1`. Scenario `everything-store`, no variant, task `everything-store-plus-earbuds-under-50`,
  workflow `plus-under-fifty`.
- **Timing:** launched 23:31:50 UTC from `fxwork/t194` on instance `t194-slot-3`. The run itself went from 23:32:58 to
  23:43:30 UTC (632 s). The build took 147 s (23:34:54-23:37:20).
- **Trees at launch:**
  - downstream `7b81b2df` (t193 RG merged), **dirty**: F29, F30 and F31 were uncommitted in `node-run/{run,replay}.ts`,
    `permission.ts`, `tools.ts` and the Lab's `extraction/mismatches.ts`;
  - Core `d5730a5a` (RG), clean.
  - Every changed source file has an mtime of 23:17-23:21 UTC, before launch. The Lab prelude rebuilt `domain:host-build`,
    `extension:build` and `test-runner:build` for "inputs changed", so **F29-F31 and RG were all in this run**.
- **Model:** deepseek, deepseek-flash, profile `production`, per-build ceiling $0.25.
- **Calls, tokens, cost:** **80 provider calls, 2,371,199 input / 27,118 output tokens, $0.323853.** This matches the
  ledger and `live-llm.json` `runSpend.totalEstimatedCostUsd 0.323852916`; `maxBuildCostUsd 0.160320`; `overCeiling 0`.
  - **The Lab says 34 calls.** All 46 re-author calls are `callsFrom: not_recorded`, though their cost is counted.
  - 3 of those 46 were malformed replies, which appear in no dump.
- **Verdict:** `failed`, `runtime.behavior`. The Flow failed `output_not_observed` / `core.result.does_not_answer_request`
  on the re-authored `s8`, after **3 re-author attempts** (`result_repair` max 3). `facilityFailure: null`.
- **Stage reached: 5.**
  - The build proposed a Flow, and the Flow ran end to end four times and stored rows.
  - The judge refuted every answer, and three re-authors made the answer worse (10 rows, then 53, then 11 unfiltered).
  - **Rows: 13 expected, 11 stored, 0 matched.**
- **Compared with run 11:** about twice the cost ($0.3239 against $0.1729) and twice the calls (80 against 39). The cost
  moved from the build to the re-author: $0.213 here against $0.071.

## Stage 1 — the instruction and the expected chain

The instruction and expected chain are the same as runs 9 and 11 (`debugs/run-mup2u8o3-6697c4be.md`, Stage 1):
1. navigate to the store;
2. dismiss the cookie and notification prompts, both optional;
3. type "wireless earbuds" and press Go;
4. **one** `extract_list` over the organic cards:
   - columns name, price, rating, url;
   - sponsored out, Plus present, rating at least 4, price under 50;
   - accessories out by what the item is;
   - dedupe;
   - paginate with the real Next through 5 pages;
5. store rows with exactly the columns name, price, rating, url.

## Stage 2 — exploration

### Build round 1 (dump `23-34-54-915Z`, 17 decisions, 23:34:54-23:36:00)

| # | Decision | Action | Result (code / reason) |
| --- | --- | --- | --- |
| 0 | (Core's opening look) | `dom-capture_snapshot` | `not_at_start_location` / `start_location_not_reached` (expected: the free first look) |
| 1 | navigate, add | `browser-navigate` store | succeeded |
| 2 | dismiss cookies, add | `dom-click selector:"t121"` ("Decline") | succeeded |
| 3 | dismiss again, add | `dom-click target:{handle:t121}` | `target_unobserved` / `handle_not_in_packet` (the banner was gone) |
| 4 | the same call again | - | **RG**: `repeat_refused` before it ran (`core.repeat_check.4`, `refusedInARow 1`) |
| 5 | dismiss notification, add | `dom-click t130` ("Not now") | succeeded |
| 6 | type, guessed `#twotabsearchtextbox` | `dom-type` | `target_unobserved` / `target_not_a_handle` |
| 7 | type, guessed `input[type=search]` | `dom-type` | `target_unobserved` / `target_not_a_handle` (`repeatedAnswer 2`) |
| 8 | find "Search Brightaisle" | `web.find_on_page` | `t16` label, `t17` field |
| 9 | type, add, a1 | `dom-type t17 "wireless earbuds"` | succeeded |
| 10 | press Go, add, a1 | `dom-click t18` | succeeded (robot check cleared itself after 9.2 s) |
| 11 | detect | `web.detect_repeating_structure t260` | `extraction.1`, 15 items |
| 12 | read (no `where`) | `dom-extract_list` 6 fields (name, price, rating, url, **plus, ad**), paginate 5 | **82 records, 5 pages**; leaves the tab on `/s?k=wireless+earbuds&page=5` |
| 13 | amend: 2,9,10,12 add; 3,5 optional | - | 4 applied; 9 and 10 refused `already_in_flow` |
| 14 | rerun 12 with the 5 conditions + `dedupe:url` | `rerun.12` | **11 records, 1 page**, "where kept none of the 11 ... returned unfiltered; the conditions together" |
| 15 | the same rerun again | - | **RG**: `changes_nothing` (`core.amendment_check.15`) |
| 16 | the same rerun again | - | **RG**: `changes_nothing`, `repeated` |
| 17 | the same rerun again | - | **RG**: 3rd refusal in a row; **the round stalls** `unusable_decisions` / `llm_evidence_loop.repeat_refused` |

**The read that read "the extraction twice".** Decision 12 was the read without conditions: 5 pages, 82 rows, and it left
the tab on page 5. Decision 14 was the rerun with conditions. It ran on page 5 (1 page, 11 items, Next disabled), and every
item there is sponsored, non-Plus or $50 and over, so it answered unfiltered. This is run 11's cause 1 unchanged: a rerun
runs where the last read left the tab (Core `llm/evidence-loop/rerun-request.ts:74`: the rerun call carries no start).

**RG fired and did what it was built to do:**
- it refused the repeat of the failed `t121` click once;
- it refused the identical page-5 rerun three times in a row, which stalled the round after 17 decisions.

In run 11 the same loop ran 5 reruns with no guard. RG cannot repair the page-5 cause; it only stops paying for it.

**The stall test (23:36:00-23:36:29, no trace lines).** Core then tested the unfinished draft from its start. The repair
round's resume entry says `test: replayed_clean`, `stepsInFlow 6`. The 28.6 s gap in `core.log` matches a full replay, and
UI moment #7 shows "Testing the Flow so far". None of the test's calls are in `core.log` or a dump (see instrumentation
gaps).

### Build round 2, the repair of the stalled build (dump `23-36-29-313Z`, 8 decisions, 23:36:29-23:37:17)

Core resumed with `llm_evidence_loop.repair`, `stopped: unusable_decisions` and the instruction "**The page is wherever the
test left it, so look first.** Work live on what is failing" (Core `llm/evidence-loop/resume.ts:67`).

| # | Decision | Action | Result (code / reason) |
| --- | --- | --- | --- |
| 0 | (opening look) | `dom-capture_snapshot` | **`not_at_start_location` / `start_location_not_reached`** |
| 1 | detect | `web.detect_repeating_structure` | `extraction.2`, 11 items, on `page=5` (observe tools are not gated) |
| 2 | read (handle `extraction.2`, the 5 conditions) | `dom-extract_list` | **`not_at_start_location` / `start_location_not_reached`** (`repeatedAnswer 2`) |
| 3 | rerun 6 with `{handle: extraction.2}` | - | RG `changes_nothing`: the merged input equals decision 2's failed call |
| 4 | rerun 6 (handle `extraction.1`, full) | `rerun.6` | **`not_at_start_location`** (`repeatedAnswer 3`) |
| 5 | rerun 6 (`extraction.2`, full) | - | RG `changes_nothing`, `repeated` |
| 6 | rerun 6 (another `next` selector) | `rerun.6.2` | **`not_at_start_location`** (`repeatedAnswer 4`) |
| 7 | add 6 | - | `already_in_flow` |
| 8 | complete | completion check ok; dry run (Stage 4) | proposed |

**The three `not_at_start_location` refusals, and why they happened.** The read was refused because the domain thinks this
build "has not arrived", not because of anything on the page:
1. A build told its start location is "not there" until a navigation node succeeds in *this* build. Arrival is keyed by
   (session, project, flow) (domain `node-run/arrival.ts:55-72`).
2. The stall test replayed the draft's navigate. A replayed navigation that ran counts as arrival
   (`node-run/run.ts:203-205`), and the comment at `:198-201` says this is what keeps a resumed build from being refused.
3. **The repair round's opening call is `initial.core.run_node`.** `run.ts:211` calls `arrivals.opening(...)`, and
   `arrival.ts:69-71` deletes the arrival for any `initial.` call. That erased the arrival the test had just recorded.
4. So `currentPage` discards the page it read (`run.ts:782`), and every non-navigation call is refused `notThereYet`
   (`run.ts:255`, `:791-793`).

Core's own instruction and the domain's gate contradict each other: Core says "the page is wherever the test left it, look
first, work live", and the domain says "go to the start location first". The model never navigated. 5 of the round's 8
decisions ($0.0296 for the round) went to refusals.

**Under the user's rule this refusal is not allowed.** It is not a permission, secret screening, RG, or an input that cannot
execute: the read could have run on page 5. It also starts the page-5 problem over.

The re-author rounds are not affected: their opening look succeeded (`web.inspect.succeeded`). They are evidently not given
a start location; NO EVIDENCE beyond that observed result.

- **Context:** windows ran 16k-47k tokens and the compact view held. Cache hits again fell after draft edits: build
  decision 13 had 13,568 of 40,838 cached and decision 15 had 15,616 of 46,722.

## Stage 3 — the proposed Flow (8 nodes, `flow-lane.json` `authoredNodes`)

| Node | What it is |
| --- | --- |
| `s1` | navigate to the store |
| `s2` | click "Decline" (optional, merge `s3`) |
| `s4` | click "Not now" (optional, merge `s5`) |
| `s6` | type into "Search Brightaisle" |
| `s7` | click "Go" |
| **`s8`** | **`extract_list`**, below |

`s8`:
- fields: 6 (name, price, rating, url, **plus, ad**);
- where: ad absent, plus present, rating atLeast 4, price lessThan 50, name not contains
  `["ear tips","charging case","eartips"]`;
- paginate maxPages 5; dedupe by url; minItems 0;
- `recordOutput` `brightaisle_plus_earbuds`, which the model wrote with a **4-column** schema.

Divergences from Stage 1:
- **The duplicate read of run 11 did not recur.** There is one read, `s8`.
- The accessory rule still drops true pairs ("charging case" matches the "... Wireless Charging Case" earbuds). This is
  run 9's cause 6 and run 11's cause 6 (F19).
- **Helper columns are still stored (F30 did not take).**
  - The model kept `plus` and `ad` in `fields` in its very first read (decision 12), although the F30 detect description
    it was shown says "keep only the columns asked for, never a mark used only to filter".
  - Its `recordOutput.schema` names only the four, but the domain rebuilds the schema from the field map
    (`output-nodes/extract-list/reconciled-record-output.ts:67-75`: "the field map declares the columns").
  - So all 6 are stored, and the author's own 4-column declaration is overridden.
- Matches: the search is typed and kept, the dismissals are optional, and the Plus badge and the card's price and rating
  are used.

## Stage 4 — replay (the dry run, dump 2, 23:36:49-23:37:17)

| Node | Result | Duration |
| --- | --- | --- |
| reset to store home | `core.replay.replayed` | 1.3 s |
| s1 navigate | replayed | 2.3 s |
| s2 Decline | `core.replay.remembered` (banner not shown; optional) | 6.0 s |
| s4 Not now | `core.replay.remembered` | 5.0 s |
| s6 type | replayed | 0.05 s |
| s7 Go | replayed | 1.1 s |
| s8 read | replayed (12.6 s, 5 pages) | 12.6 s |

**F29's read account is live:**
- `s8`'s replay call carried `produced: {records: 11, itemsSeen: 11, unfiltered: true}`, the read's own account rather
  than the longest array (run 11 showed 638);
- clicks and types still carry the longest-array count (117/123), as designed.

The step's recorded run was the page-5 rerun, which was itself `unfiltered: true`. `readChange` fires only when the
recorded run had `unfiltered: false` (domain `node-run/replay.ts`, F29 diff). So the comparison could not have flagged it.
It did not need to: replayed from the start, the read was fine (the Flow's first run kept 10).

## Stage 5 — the answers (four Flow runs)

The read accounts are from `flow-lane.json` `extraction.steps[0].reads`:

| Flow run | s8 (adaptation) | Pages | Seen | Conditions | Kept | Stored | Judge's advice |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (23:37:21) | build's `s8` | 5, `control_disabled` | 94 | 5: rejected [20,37,34,40,20], alone [4,6,12,3,5] | 12 | **10** | "Re-point the columns (ad) that are empty"; "**Raise maxPages above 5 ... stopped at the page limit, not because results ran out**" |
| 2 (23:39:38) | re-author a1 (`4799…s8`) | 5 of at most 11 | 94 | 4: rejected [0,15,1,20], alone [0,10,0,14] | 64 | **53** | "the where filters on the item's full text, not on the parsed price/rating/plus fields" (correct) |
| 3 (23:41:14) | re-author a2 (`82dc…s8`) | 5 of at most 11 | 94 | 3: rejected [0,94,20], alone [0,74,0] | 0 | **11, unfiltered** | "correct the plus attribute selector ... add price and rating conditions" (correct) |
| 4 (23:42:21) | re-author a3 = a2 unchanged | 5 of at most 11 | 94 | identical | 0 | **11, unfiltered** (stored, judged) | - |

- **Final stored answer: 11 rows, expected 13, matched 0** (`extraction-mismatches.json`).
  - The 11 are the page-5 items: the first is "Novaq Life Beam ... $89.99", sponsored, the same first row as build
    `rerun.12`.
  - So an unfiltered multi-page read answers with the last page's items; this is an inference from the names.
- **Flow run 1 was the best answer of the run.** Its account is identical to run 11's `s8`, so by inference it held the
  same 10 of the 13: e8, e9 and e11 were missing, each rejected by "charging case" alone. Each of its rows also carried
  `plus` and `ad`.
- **F31 reported the extra columns.** `extraColumns: {records: 11, names: ["plus","ad"], matchedRecords: 0}`. This
  replaces run 11's opaque `values-differ, fields: []`. Here the values differ anyway: the rows are the wrong rows.
- **Optional dismissals cost 24 s per re-run.** On Flow runs 2-4 the cookie and notification prompts were not shown
  (remembered), and each optional click was retried 3 times through the `retry_node` rung (Core
  `executor/recovery-ladder.ts:182`, `ladder-run.ts:81`) at about 4 s each before its merge. That is 6 failed attempts,
  about 24 s per run and about 72 s in all.

## Stage 6 — judgement and repair: why the re-author loops through four dumps

| Dump | Phase | Decisions (calls) | Cost |
| --- | --- | --- | --- |
| `23-37-59-303Z` | re-author **attempt 1, round 1**; ended in an RG stall (`unusable_decisions` / `repeat_refused`) | 17 (17) | $0.084521 |
| `23-38-48-822Z` | re-author **attempt 1, round 2** (`core.resumed.0`, `test: not_tested`); complete | 14 + 3 malformed (17) | $0.075799 |
| `23-40-39-381Z` | re-author **attempt 2**; complete | 10 (10) | $0.042573 |
| `23-42-15-553Z` | re-author **attempt 3**: detect, then complete with **no change** ("my last decision is spent") | 2 (2) | $0.010514 |

The chain:
1. **Recovery repeats.** Each refuted answer is re-authored, up to 3 attempts (Core
   `recovery/refuted-result/history.ts:45`). Each attempt is a fresh evidence loop, and attempt 1 needed a second round
   because RG stalled the first. That makes four dumps.
2. **Every attempt was briefed with a false finding.** `decision-trace.json` lists `findingCodes:
   ["result.column_always_empty"]` on all three attempts.
   - `ad` is empty in every row *because* `where ad absent` keeps only those rows.
   - `alwaysEmptyColumns` (Core `result-verification/repair-directive.ts:216-222`) does not know that, and tells the
     re-author to "re-point" it.
   - Attempt 1 was also told to raise `maxPages`. The judge misread "read 5 pages of at most 5, paging stopped on
     control_disabled" (Core `result-verification/read-account/sentence.ts:14-15`) as hitting the limit.
   - The real defect was in the same account and never named: condition 5 alone rejected [... 5], three of them wanted
     pairs.
3. **Every re-author worked on page 5.** Each Flow run leaves the tab on page 5. All 9 re-author reruns that ran read
   1 page of 11 items (dumps 3-5 accounts). 8 of them answered unfiltered ("where[n] rejected every one"), and one
   (a1r2 `rerun.8.8`) kept 8 of 11. This is cause 1 again.
4. **Its reruns kept failing on input shape, about half of them.** See "Refusal accounting".
5. **It completes without a test.** `judgement.test: not_tested`, and dumps 3-6 contain no dry run. The adaptation is
   applied and the Flow re-run, even when the step's own last run was unfiltered (a2), or when nothing changed (a3: 2
   decisions, no edit). The answer-unchanged stop (`history.ts:51`, 2 in a row) needs a Flow run to count, so a3 cost a
   Flow run (~46 s) and 2 judge calls.
6. **The purse shrinks per attempt:**

   | Attempt | Started with |
   | --- | --- |
   | a1 | $0.2348 |
   | a2 | $0.0736 ("3 decisions left") |
   | a3 | $0.0300 ("1 decision left") |

   So a3 could only look and complete.

## Refusal accounting, classified against the user's rule

The rule: nothing the model chose is refused except for permissions, secret screening, RG, and inputs that cannot
execute; information is preferred.

| Refusal (exact code / reason) | Where | Count | What it was | Rule |
| --- | --- | --- | --- | --- |
| `not_at_start_location` / `start_location_not_reached` | opening looks (build r1, build r2) | 2 | Core's free first look, not a model choice | n/a (informational) |
| `not_at_start_location` / `start_location_not_reached` | build r2 decisions 2, 4, 6 (`dom-extract_list`) | **3** | a read on a readable page, refused because the round's opening call erased the arrival | **Violates** (owner t228); domain `run.ts:211`, `arrival.ts:69-71`, `run.ts:255` |
| `target_unobserved` / `handle_not_in_packet` | build r1 decision 3 | 1 | a handle no longer on the page | Exempt (cannot execute) |
| `target_unobserved` / `target_not_a_handle` | build r1 decisions 6, 7 | 2 | invented CSS selectors refused without trying them (`input[type=search]` might have matched) | **Violates** (t228); domain `run.ts:295-299`. Prefer running it and answering `target_not_found` or the result |
| `invalid_input` / `unexpected_input_keys` (incl. `answered_the_same_again`) | re-author a1r1 5, a1r2 5, a2 4 | **14** | the rerun patch written as `{extractList: ...}` instead of `{parameters: {extractList: ...}}`; the merge adds a top-level key | Exempt as written (cannot execute), but Core-made: the patch description is ambiguous (see cause 5) |
| `invalid_input` / `parameter_not_readable` | re-author a1r1 `rerun.8.6` | 1 | the merge kept the old `attribute: data-ad-id` when the model changed `ad` to `kind: text`; the model never wrote that input | Exempt as an input, but Core-made (cause 6) |
| `target_unobserved` / `malformed_handle` | re-author a1r2 `rerun.8.2` | 1 | handle-style field keys mixed into a literal-`item` read | Exempt (cannot execute) |
| RG `repeat_refused` / `changes_nothing` | build r1 4; build r2 2; a1r1 7; a1r2 3; a2 1 | **17** | the same merged call on the same page, after it failed or changed nothing | Allowed (RG). It worked: 2 stalls; at most 3 in a row |
| `consequences_unreadable` / `missing_input_keys` | - | **0** | - | **F29 took effect.** No `"consequences":null` in any dump; the re-author's draft step 8 has no `consequences` key |
| `llm.provider_malformed_response` (`content_mismatched`) | a1r2 iterations 3, 5, 12 | 3 | replies of 446-580 output tokens (the length of a full rerun patch) with mismatched brackets; content not recorded | Provider (paid, undumped) |

**So the lead's "about 15 refused, alternating with succeeded" is 14 `unexpected_input_keys` plus 1 `parameter_not_readable`.**
The model alternated between the two patch shapes:
- `{extractList}` was refused;
- `{parameters: {extractList}}` ran (9 times), on page 5, read 1 page, and in 8 of the 9 answered unfiltered, because the
  model rewrote the `where` list without the stored `selector` keys. A list replaces whole in the merge, so each condition
  read the card root.

## Cost by phase and every model call

| Phase | Calls | Input | Output | Cost |
| --- | --- | --- | --- | --- |
| build round 1 | 17 | 481,166 | 3,318 | $0.068062 |
| build round 2 (repair of the stall) | 8 | 197,765 | 2,108 | $0.029646 |
| build: chat answer turn (derived) | 1 | 1,575 | 49 | $0.000268 |
| judge (4 Flow runs × 2 checks) | 8 | 61,980 | 4,618 | $0.012470 |
| re-author a1 (2 rounds, incl. 3 malformed) | 34 | 1,225,785 | 13,056 | $0.160320 |
| re-author a2 | 10 | 346,614 | 3,704 | $0.042573 |
| re-author a3 | 2 | 56,314 | 265 | $0.010514 |
| **total** | **80** | **2,371,199** | **27,118** | **$0.323853** |

Per-call input tokens, including cached, over the 77 calls with a per-call record: min 1,575, median 28,921, max 46,820.
The 3 malformed calls average about 32,948; counting them as that average, the median over all 80 is about 29,653.
Cached is the provider's cache hits, where recorded.

| # | Phase | Iteration | Input | Cached | Output | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | build r1 | 1 | 16,208 | 640 | 93 | $0.004786 |
| 2 | build r1 | 2 | 19,292 | 12,160 | 89 | $0.002319 |
| 3 | build r1 | 3 | 19,961 | 12,160 | 92 | $0.002524 |
| 4 | build r1 | 4 | 20,229 | 12,544 | 90 | $0.002489 |
| 5 | build r1 | 5 | 20,494 | 13,952 | 88 | $0.002152 |
| 6 | build r1 | 6 | 20,599 | 12,800 | 91 | $0.002526 |
| 7 | build r1 | 7 | 20,783 | 13,952 | 94 | $0.002246 |
| 8 | build r1 | 8 | 20,966 | 14,080 | 68 | $0.002232 |
| 9 | build r1 | 9 | 21,132 | 14,080 | 103 | $0.002324 |
| 10 | build r1 | 10 | 21,919 | 12,800 | 96 | $0.002928 |
| 11 | build r1 | 11 | 27,785 | 13,312 | 76 | $0.004513 |
| 12 | build r1 | 12 | 29,522 | 19,328 | 390 | $0.003642 |
| 13 | build r1 | 13 | 40,838 | 13,568 | 140 | $0.008430 |
| 14 | build r1 | 14 | 41,144 | 30,720 | 463 | $0.003867 |
| 15 | build r1 | 15 | 46,722 | 15,616 | 450 | $0.009965 |
| 16 | build r1 | 16 | 46,752 | 25,600 | 445 | $0.007033 |
| 17 | build r1 | 17 | 46,820 | 35,712 | 450 | $0.004087 |
| 18 | build r2 (repair) | 1 | 21,874 | 12,160 | 68 | $0.003069 |
| 19 | build r2 (repair) | 2 | 23,798 | 12,416 | 459 | $0.004040 |
| 20 | build r2 (repair) | 3 | 24,357 | 14,080 | 78 | $0.003261 |
| 21 | build r2 (repair) | 4 | 24,617 | 14,080 | 438 | $0.003771 |
| 22 | build r2 (repair) | 5 | 25,429 | 14,336 | 443 | $0.003946 |
| 23 | build r2 (repair) | 6 | 25,497 | 14,080 | 450 | $0.004050 |
| 24 | build r2 (repair) | 7 | 26,096 | 14,208 | 69 | $0.003734 |
| 25 | build r2 (repair) | 8 | 26,097 | 14,208 | 103 | $0.003776 |
| 26 | build: chat answer turn (derived) | - | 1,575 | not recorded | 49 | $0.000268 |
| 27 | judge, Flow run 1 | check 1 | 4,585 | not recorded | 429 | $0.001627 |
| 28 | judge, Flow run 1 | check 2 | 4,585 | not recorded | 456 | $0.000643 |
| 29 | judge, Flow run 2 | check 1 | 10,902 | not recorded | 680 | $0.003560 |
| 30 | judge, Flow run 2 | check 2 | 10,902 | not recorded | 703 | $0.000953 |
| 31 | judge, Flow run 3 | check 1 | 7,207 | not recorded | 593 | $0.002046 |
| 32 | judge, Flow run 3 | check 2 | 7,207 | not recorded | 737 | $0.000977 |
| 33 | judge, Flow run 4 | check 1 | 8,296 | not recorded | 508 | $0.001932 |
| 34 | judge, Flow run 4 | check 2 | 8,296 | not recorded | 512 | $0.000732 |
| 35 | re-author a1 r1 | 1 | 25,763 | 896 | 80 | $0.007561 |
| 36 | re-author a1 r1 | 2 | 27,693 | 18,816 | 404 | $0.003261 |
| 37 | re-author a1 r1 | 3 | 28,244 | 20,352 | 406 | $0.002977 |
| 38 | re-author a1 r1 | 4 | 32,693 | 13,568 | 449 | $0.006358 |
| 39 | re-author a1 r1 | 5 | 33,226 | 24,448 | 197 | $0.003016 |
| 40 | re-author a1 r1 | 6 | 33,765 | 24,448 | 449 | $0.003481 |
| 41 | re-author a1 r1 | 7 | 34,027 | 24,576 | 196 | $0.003218 |
| 42 | re-author a1 r1 | 8 | 34,096 | 24,576 | 195 | $0.003237 |
| 43 | re-author a1 r1 | 9 | 38,544 | 15,360 | 438 | $0.007573 |
| 44 | re-author a1 r1 | 10 | 39,165 | 19,712 | 436 | $0.006477 |
| 45 | re-author a1 r1 | 11 | 39,202 | 19,456 | 335 | $0.006443 |
| 46 | re-author a1 r1 | 12 | 39,963 | 28,928 | 436 | $0.004007 |
| 47 | re-author a1 r1 | 13 | 40,504 | 28,928 | 435 | $0.004168 |
| 48 | re-author a1 r1 | 14 | 40,541 | 28,672 | 450 | $0.004273 |
| 49 | re-author a1 r1 | 15 | 44,690 | 23,424 | 453 | $0.007064 |
| 50 | re-author a1 r1 | 16 | 44,726 | 23,552 | 457 | $0.007042 |
| 51 | re-author a1 r1 | 17 | 44,729 | 32,640 | 452 | $0.004365 |
| 52 | re-author a1 r2 (resumed) | 1 | 26,061 | 18,816 | 75 | $0.002376 |
| 53 | re-author a1 r2 (resumed) | 2 | 27,980 | 19,072 | 186 | $0.003010 |
| 54 | re-author a1 r2 (resumed) | 3 (malformed reply) | not recorded | not recorded | 580 | not recorded |
| 55 | re-author a1 r2 (resumed) | 4 | 28,879 | 20,736 | 476 | $0.003139 |
| 56 | re-author a1 r2 (resumed) | 5 (malformed reply) | not recorded | not recorded | 578 | not recorded |
| 57 | re-author a1 r2 (resumed) | 6 | 29,783 | 20,864 | 442 | $0.003331 |
| 58 | re-author a1 r2 (resumed) | 7 | 34,510 | 15,744 | 448 | $0.006262 |
| 59 | re-author a1 r2 (resumed) | 8 | 35,065 | 25,472 | 450 | $0.003571 |
| 60 | re-author a1 r2 (resumed) | 9 | 35,626 | 25,600 | 448 | $0.003699 |
| 61 | re-author a1 r2 (resumed) | 10 | 35,888 | 25,600 | 451 | $0.003781 |
| 62 | re-author a1 r2 (resumed) | 11 | 40,314 | 15,744 | 445 | $0.007999 |
| 63 | re-author a1 r2 (resumed) | 12 (malformed reply) | not recorded | not recorded | 446 | not recorded |
| 64 | re-author a1 r2 (resumed) | 13 | 41,223 | 29,824 | 429 | $0.004113 |
| 65 | re-author a1 r2 (resumed) | 14 | 43,533 | 20,736 | 445 | $0.007498 |
| 66 | re-author a1 r2 (resumed) | 15 | 43,603 | 20,480 | 346 | $0.007475 |
| 67 | re-author a1 r2 (resumed) | 16 | 41,434 | 32,000 | 438 | $0.003548 |
| 68 | re-author a1 r2 (resumed) | 17 | 41,471 | 31,744 | 105 | $0.003235 |
| 69 | re-author a2 | 1 | 27,348 | 896 | 72 | $0.008027 |
| 70 | re-author a2 | 2 | 26,560 | 20,352 | 449 | $0.002523 |
| 71 | re-author a2 | 3 | 27,095 | 22,016 | 450 | $0.002196 |
| 72 | re-author a2 | 4 | 31,525 | 15,232 | 477 | $0.005552 |
| 73 | re-author a2 | 5 | 35,955 | 17,024 | 449 | $0.006320 |
| 74 | re-author a2 | 6 | 36,519 | 29,952 | 416 | $0.002649 |
| 75 | re-author a2 | 7 | 37,089 | 29,952 | 416 | $0.002820 |
| 76 | re-author a2 | 8 | 41,315 | 20,864 | 443 | $0.006792 |
| 77 | re-author a2 | 9 | 41,848 | 33,792 | 414 | $0.003116 |
| 78 | re-author a2 | 10 | 41,360 | 33,920 | 118 | $0.002577 |
| 79 | re-author a3 | 1 | 28,921 | 896 | 80 | $0.008509 |
| 80 | re-author a3 | 2 | 27,393 | 21,888 | 185 | $0.002005 |

Sources:
- Rows 1-25 and 35-80 are the dumps' `decision.usage`.
- Row 26 is derived: the build accounting (680,506 / 5,475 / $0.097976) minus the 25 loop calls (678,931 / 5,426 /
  $0.097708). Calling it the chat answer turn follows `build.chat` (`answerTurn 2`, `became: build`) and
  `unrecordedCalls 1`.
- Rows 27-34 are `live-llm.json` `verification.interventions`, in Flow-run order.
- The 3 malformed rows have their output tokens from `core.log` (`decide throw ... out=`). Their input and cost are known
  only in total: a1's accounting minus its 31 dumped calls is 98,844 input and $0.012762 for the 3.

## Did this tree's changes take effect?

| Change | Took effect? | Evidence |
| --- | --- | --- |
| **F29** (no `consequences: null` written back; a read accepts `null`; the dry run compares a read's own account) | **Yes** | 0 `consequences_unreadable`, 0 `"consequences":null` in 6 dumps, where run 11 had 16 refusals. The dry-run `produced` for `s8` is the read's account (`{records 11, itemsSeen 11, unfiltered true}`, not 638). `readChange` had nothing to catch here (the recorded run was already unfiltered; see Stage 4). |
| **F30** (the detect description: a `where` may name a column `fields` does not keep) | **No change in behaviour** | All 4 reads that stored rows kept `plus` and `ad` in `fields`. The stored rows still had 6 columns, also because the domain overrides the author's 4-column schema (cause 8). |
| **F31** (the Lab's extra-columns report) | **Yes** | `extraColumns: {records 11, names [plus, ad], matched 0}` |
| **RG** (repeat guard) | **Yes, fired 17 times** | Two rounds stalled on 3 in a row (build r1, re-author a1 r1). It cut the page-5 rerun loop to one paid run plus 3 refused decisions, where run 11 had 5 runs. It cannot fix the cause (page 5), and each stall led to a resumed round. |

## Causes

| # | Cause, precisely | Repo and file:line | Smallest fix (not applied) | Owner |
| --- | --- | --- | --- | --- |
| 1 | **A rerun of a paginating read runs wherever the last read left the tab (page 5).** It affected build `rerun.12` and all 9 re-author reruns that ran: 1 page, 11 items, 8 unfiltered. That is run 11's cause 1, still open. Every Flow run also ends on page 5, so every re-author starts there. | Core `llm/evidence-loop/rerun-request.ts:74` (the rerun call carries no start) | A rerun of a step goes back to that step's `replay.from` (reset, then replay the steps before it) before it runs, as the dry run does. | lane B (Core rerun); domain half lane C |
| 2 | **The repair round erases the arrival the stall test just made, then refuses the model's reads `not_at_start_location`.** 3 reads plus 2 RG follow-ons were refused, against Core's own "the page is wherever the test left it". | domain `node-run/run.ts:211` (`arrivals.opening` on an `initial.` call), `node-run/arrival.ts:69-71`, refusal at `run.ts:255` / `:791-793`; Core `llm/evidence-loop/resume.ts:67` | Either a resumed round keeps an arrival set by a replayed navigation (`run.ts:203-205`; skip `opening` when the build key arrived by replay), or Core opens a resumed round with a non-`initial.` call id. Under the user's rule the larger fix is to drop the gate for non-navigation calls on a readable page and leave start-reaching to Core's completion check. | **t228** (refusal); lane B for the Core call id |
| 3 | **A false `result.column_always_empty` on `ad`** was put in every re-author brief (3 of 3). The column is empty by design (`where ad absent`). | Core `result-verification/repair-directive.ts:216-222` (`alwaysEmptyColumns`) | Leave out a column that the step's own `where` requires `absent`, or that the request did not ask for. | lane C (judge) |
| 4 | **The judge advised "raise maxPages above 5"** after reading "5 pages of at most 5, paging stopped on control_disabled" as stopping at the limit. The real defect was in the same account and not named: condition 5 alone rejected 5, three of them wanted pairs. | Core `result-verification/read-account/sentence.ts:14-15` | When the stop is `control_disabled`, say "the list ended: its Next was disabled after page N", and drop "of at most N". | lane C (judge) |
| 5 | **The rerun patch shape is ambiguous: 14 `unexpected_input_keys`.** The description says "a JSON merge patch over the argument the step ran with", while the draft shows `{node, parameters}`. The model alternated between `{extractList}` and `{parameters:{extractList}}`; the first adds a top-level key. | Core `flow-draft/amendment.ts:140`, `llm/evidence-loop/rerun-input.ts:30-45`, `rerun-request.ts:68`; domain `node-run/run.ts:219-220` | For a `core.run_node` step, a patch naming none of `node`, `parameters` or `consequences` is a patch of `parameters`. Also say so in `amendment.ts:140`. | lane C (re-author) |
| 6 | **The merge builds inputs the model never wrote.** (a) A field object merges by key, so `ad: {kind: text}` kept `attribute: data-ad-id`, refused `parameter_not_readable`. (b) A list replaces whole, so a rewritten `where` lost every stored `selector`, each condition read the card root, and 8 of the 9 reruns that ran answered unfiltered. The applied a1/a2 Flows inherited it (rejected [0,15,1,20] and [0,94,20]). That is run 11's cause 5, still open. | Core `llm/evidence-loop/rerun-input.ts:42` | Replace a field or condition object whole when its `kind` changes. Merge `where` items by index, keeping a `selector` the patch does not name. | lane C (re-author) |
| 7 | **A re-author is applied untested.** It is applied even when its read's last run was unfiltered (a2), or when it changed nothing (a3). The answer-unchanged stop needs a Flow run plus 2 judge calls to notice. | Core `recovery/refuted-result/history.ts:45` (3 attempts), `:51` (2 unchanged in a row); `repair.ts:129-154`; `judgement.test: not_tested` in dump 4 | Do not apply an adaptation whose list read's last run was `unfiltered`. Stop the repair when a re-author completes with the draft unchanged, before the Flow runs. | lane C (re-author / purse) |
| 8 | **Helper columns are stored against the author's own schema.** `fields` kept `plus` and `ad`, and the field map overrides the 4-column `recordOutput.schema`. 2 of the 6 stored columns were never asked for, and F30's text did not move the model. | domain `output-nodes/extract-list/reconciled-record-output.ts:67-75` | When the authored schema names a subset of the field-map keys, store only those. The conditions still read the rest (the resolver already allows it). | lane C (extraction) |
| 9 | **The accessory rule drops true pairs** (`name not contains "charging case"`). Flow run 1's account is identical to run 11's: alone [4,6,12,3,5]. | extraction near-miss account (F19) | F19's, unchanged. The judge should name a condition whose "alone" rejections include rows matching every other condition. | lane C |
| 10 | **Invented selectors are refused without being tried:** `target_not_a_handle`, 2 calls. | domain `node-run/run.ts:295-299` | Run it and answer `target_not_found`, or the result. | **t228** |
| 11 | **An optional dismissal is retried 3 times when its prompt is absent.** That is about 24 s per Flow re-run and about 72 s over runs 2-4, and the chat shows "Recovery started". | Core `executor/recovery-ladder.ts:182`, `executor/ladder-run.ts:81` | An optional step whose target is not found goes straight to its merge, without `retry_node`. | lane B (runtime ladder; owner to confirm) |
| 12 | **An RG stall is reported as `unusable_decisions`,** and the chat says "every attempt to finish was refused" when no finish was attempted. | Core `flow-bootstrap/unfinished-build/not-done.ts:33` | Give the stall its own stop reason (`repeat_refused`) and wording ("it kept repeating a step that changed nothing"). | lane B (RG) + t191 (text) |
| 13 | **A later Flow run's account lists earlier adaptations' read steps,** e.g. "step `4799…s8` read …; step `82dc…s8` …; the Flow's steps were dom-extract_list, browser-navigate, …". | probably Core `recovery/refuted-result/attempt.ts:156` (all `detail.actionAttempts`); not traced further | Account only for the attempts of the Flow run being judged. | lane C (judge) |
| 14 | **The Lab counts 34 calls; there were 80.** All 46 re-author calls are `not_recorded`, and 3 malformed replies are in no dump. | Lab `live-llm.json` `reauthor.callsFrom` (test-runner) | Count re-author calls from the trace or dumps, and record malformed replies with their usage. | lane C (Lab accounting) |

**Fix order by money saved:**
- cause 1 removes the page-5 world every rerun ran in;
- causes 3 and 4 remove the false brief that sent all three re-authors after `ad` and `maxPages`;
- cause 5 removes 14 refusals.

Together they would have left Flow run 1's 10-row answer as the one to repair. The repair it needed is cause 9: drop
"charging case".

## UI review (Lab ui-review, 29 moments; side panel verified open throughout)

The rule is that the chat shows each step with its reasoning.

### Start and build

- **#2 (23:34:54.8):** the welcome screen with suggestion chips, 1.5 s after the instruction was sent and answered. No
  person message and no "Building" line. Same as run 11.
- **#3:**
  - the cards read "Click · the page", without the control's name;
  - the RG-refused decision 4 shows its reasoning heading again with no card, so the person sees the same sentence twice
    and no "not run: a repeat" note;
  - "Didn't work: it wasn't on the page" is clear.
- **#5:** "Reading the list · Read list · the page · Done" is clear.
- **#7:**
  - three "Updating the draft Flow — Rerun the list extraction with a corrected where clause ..." headings with no
    outcome. They were RG refusals and are not shown as such;
  - then "Testing the Flow so far — The build stopped before the Flow was finished: **every attempt to finish was
    refused**". That is untrue: no finish was attempted (cause 12).
- **#8:** "Read list · Didn't work: the step wasn't accepted". The reason (`not_at_start_location`) is not shown. Then
  "Checking the Flow is finished" and "Test run · Passed".

### Dry run

- **#9:** "Test run · Decline" and "Test run · Not now" are shown **red, "Didn't work: it didn't work the same way
  again"**, though Core answered `core.replay.remembered`, which is fine for an optional step. This is run 11's finding,
  not fixed.

### Flow runs

- **#10:** the scenario tab is `about:blank` at the start of the Flow run, and the overlay is absent.
- **#11:** merges show as "Action · the page · Done" cards, which mean nothing to a person. "Running your Flow · Step 8
  of 8".
- **#18:** the Flow re-run's optional "Decline" shows "Recovery started — Trying the step again ... **Click · Decline ·
  Done**", but all three attempts failed `target_not_found`. Then "The quick fixes didn't help" for a step that is
  optional.

### Re-author

- **#13, #16, #21:**
  - "Updating the draft Flow — Rerun ... maxPages raised to 11 ..." repeats, so the chat shows the model chasing the
    judge's wrong advice;
  - each refused rerun is a red "Read list · Didn't work: the step wasn't accepted" with no reason
    (`unexpected_input_keys`).
- **#25:**
  - "Fixing your Flow · **Step 12**", though the Flow has 8 nodes;
  - the brief excerpt shows the internal id `node.bootstrap.82dc2500a6c69e0a.main.s8`;
  - "Checking the Flow is finished — ... my last decision is spent, so I record the corrected Flow as the result", then
    **"Test run · Passed"**, though the re-author ran no test (`not_tested`).

### End

- **#28-#29:** "Records saved", "Test run · Didn't pass", "Run failed". It does not say how many rows were stored (11),
  why they fail, or what the run cost.

### Overlay and owners

- **Overlay:**
  - top-right at #3 (x 863, y 16), bottom-left from #4 on (x 16, y 638), so it moves between phases, as in run 11;
  - `flickering` at #7, #9, #12, #16, #19, #20, #21 and #25;
  - absent at #2 and #10.
- **Owners:**
  - t191/t174: card names, red `remembered`, "Done" on a failed retry, the step counter, node ids, "Test run Passed"
    without a test, the end summary, and the overlay;
  - lane B + t191: the stall wording (cause 12);
  - t228: refusal reasons not shown, for any refusal that stays.

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | The stall test's calls (23:36:00-23:36:29): `test: replayed_clean` is recorded, but no call is | Core build trace (`core.log`) and the decision dump record only in-loop calls |
| 6 | Per-call input and cost of the 3 malformed replies | Core `decide throw` trace prints `out=` only; the dump writes no `decision` row |
| 6 | The applied re-author nodes' parameters (a1, a2) | `flow-lane.json` `authoredNodes` lists only the build's Flow |
| all | Re-author call count | Lab `live-llm.json` `reauthor.callsFrom: not_recorded` |
| 5 | Flow run 1's stored rows: the expectation compares only the final store (run 4) | Lab `extraction-mismatches.json` judges the last stored set only |
