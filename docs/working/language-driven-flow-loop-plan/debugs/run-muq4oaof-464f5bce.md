# Run debug — `run-muq4oaof-464f5bce`

Lane C (t194), run 11, chat-driven (`buildEntry: chat`). Written by worker t194-d11 from the run's bundle
(`test-runs/instances/t194-slot-3/run-muq4oaof-464f5bce/`: `snapshots/{flow-lane,live-llm,extraction-mismatches}.json`,
`evaluation.json`, `events.ndjson`, `logs/core.log` build trace), the three decision dumps
(`test-runs/instances/t194-slot-3/decision-dumps/build-2026-10-01T22-{53-23-880Z,55-58-356Z,56-26-017Z}-18012.jsonl`),
the Lab log (`scratchpad/t194/run11.log`), the spend ledger and the Lab's UI review
(`run-muq4oaof-464f5bce.ui-review.local/`, 14 moments). Read only: nothing launched, edited or committed.

---

## Header

- Run id: `run-muq4oaof-464f5bce`
- Scenario / variant / task: `everything-store` / none / `everything-store-plus-earbuds-under-50`; workflow `plus-under-fifty`.
- Launched 22:48:52 UTC from `fxwork/t194` on instance `t194-slot-3`; run 22:50:52-22:57:04 UTC (371 s). Trees at launch:
  downstream dev `8fa5a944` (t194 F23-F28/G4 merged 22:46 UTC), Core `83a6cc3a` (t227 merged). **The t193 repeat guard
  (Core `c11fac90`/`d5730a5a`, downstream `7b81b2df`) was merged at 22:54 UTC, after launch, so this run ran without it.**
- Provider/model: deepseek, deepseek-flash, profile `production`, per-build ceiling $0.25.
- Provider calls, tokens, cost: **39 calls, 1,246,976 input / 11,750 output tokens, $0.172862** (ledger `finish`:
  `totalEstimatedCostUsd 0.172862496`, `buildsOverCeiling 0`). The Lab's own count says **20 calls**: the 19 re-author
  calls are `callsFrom: not_recorded` (`live-llm.json` `reauthor`), though their tokens and cost are counted.
- Verdict as reported: `failed`, `runtime.behavior`; Flow failure `output_not_observed` /
  `core.result.does_not_answer_request` on node `s9`; re-author `flow_bootstrap.not_doable`; runtime patch
  `llm_output.invalid_risk`. `facilityFailure: null` (F20's misclassification did not recur).
- **Stage reached: 5** (the build proposed a Flow, it ran end to end and stored rows; the judge refuted the answer; the
  re-author and the runtime repair both failed). Expected 13 rows; **21 stored, 0 matched**.

## Stage 1 — the instruction and the expected chain

Same instruction and chain as run 9 (`debugs/run-mup2u8o3-6697c4be.md`, Stage 1): navigate; optional cookie/notification
dismissals; type "wireless earbuds" and press Go; **one** `extract_list` over the organic cards (name, price, rating, url;
sponsored out, Plus present, rating at least 4, price under 50, accessories out by what the item is, dedupe, paginate the
real Next through 5 pages); the rows stored with exactly the columns name, price, rating, url.

## Stage 2 — exploration (build, dump `22-53-23-880Z`, 15 decisions, 22:53:23-22:55:11)

| # | Decision | Action | Result |
| --- | --- | --- | --- |
| 0 | (Core's initial look) | `dom-capture_snapshot` | `not_at_start_location` (expected) |
| 1 | navigate, add | `browser-navigate` store home | succeeded |
| 2 | dismiss cookies, add, a1 | `dom-click t121` ("Decline") | succeeded |
| 3 | type the search | `dom-type t17` | `target_covered` / `covered_by_layer` (notification dialog `t123`) |
| 4 | dismiss notification, add | `dom-click t130` ("Not now") | succeeded |
| 5 | type, add, a1 | `dom-type t17 "wireless earbuds"` | succeeded |
| 6 | press Go, add, a1 | `dom-click t18` | succeeded (robot check cleared by itself after 9 s) |
| 7 | detect | `web.detect_repeating_structure t243` | `extraction.1` |
| 8 | read | `dom-extract_list` (input **A**: 5 conditions, name not contains `["ear tips","charging case","eartips"]`, paginate by `a[aria-label*='next']`, dedupe, `minItems 0`, `consequences []`) | **10 records, 5 pages, 94 seen, kept 12, rejected [20,37,34,40,20], alone [4,6,12,3,5]**; the tab is left on `/s?k=wireless+earbuds&page=5` |
| 9 | amend: 2,6,7,9 add; 3,5 optional | - | 4 applied, 6 and 7 refused `already_in_flow` |
| 10 | rerun 9 (input **C**: + "replacement") | `rerun.9` | 11 records, **1 page**, 11 seen, kept 0, `unfiltered: true`, `paginationStop: control_disabled` |
| 11 | rerun 10 (input **C** again) | `rerun.10` | identical (27,545 evidence bytes, same state digest before and after) |
| 12 | rerun 10 (input **D**: the 3 terms reordered) + **add 10** | `rerun.10.2` | identical |
| 13 | rerun 12 (input **D** again) | `rerun.12` | identical |
| 14 | rerun 13 (input **C** again) | `rerun.13` | identical |
| 15 | complete (a1 -> step 9) | completion check ok; dry run (Stage 4) | proposed |

**Why six reads with "the same parameters".** They were not one input six times: the effective (merged) inputs were
A, C, C, D, D, C, three distinct, differing only in the accessory word list. What made them identical is the page:

1. Read 1 paginated to page 5 and left the tab there (`stateDigests` `b4af8b86` -> `954f3a55`).
2. Every rerun ran on the tab as it was, `page=5`, whose Next is disabled: 1 page, 11 items. The conditions together
   kept none of the 11, so the extension returned the 11 rejected rows (`filtered-answer.ts:108-117`) with
   "where kept none ... narrow the conditions rather than trusting these rows".
3. The model did what it was told and kept toggling the one condition it suspected (the accessory list), which removed
   at most 3 of those 11 and none alone. The answer could not change, and every rerun reported the same digest before
   and after (`954f3a55`).
4. Nothing stopped it: a rerun counts as draft progress (`draftState: changed`), so the no-progress guard never fired.
   The repeat guard was not in this build.
5. Each rerun replaced read 1's 5-page evidence with a page-5 view, so the `rowsAlone` that showed the three wanted
   "... Wireless Charging Case" pairs dropped by condition 5 (read 1: `alone` 5, listing Lumo Audio Drift Pro, Aurelle
   Pods Fit, Trevio T5) was no longer the newest account the model held.

**The duplicate read.** Each rerun took the replaced step's place (Core `llm/evidence-loop/rerun-replacement.ts:46-61`),
and the replaced original stayed listed as `dropped`. At decision 12 the model reran *and re-added* step 10 (the dropped
original, 3 terms). The draft then held two kept `extract_list` steps over the same handle: step 9 (4 terms) and step 10
(3 terms). The draft's instruction says "Never add ... a second copy of a step already added", but nothing enforces it.
These became the Flow's `s8` and `s9`.

- Context: windows 16k-76k tokens (the compact view held). Cache hits fall after draft edits, as in run 9's cause 3: decision 9
  had 13,312 of 48,017 cached and decision 11 had 15,232 of 53,819, while decision 10 had 38,144 of 48,322.
- Rejections: one, `target_covered` (decision 3), handled correctly.

## Stage 3 — the proposed Flow (9 nodes, `flow-lane.json` `authoredNodes`)

`s1` navigate store; `s2` click "Decline" (optional, merge `s3`); `s4` click "Not now" (optional, merge `s5`);
`s6` type into "Search Brightaisle"; `s7` click "Go"; **`s8` `extract_list`** (6 fields name, price, rating, url,
**plus, ad**; where ad absent, plus present, rating atLeast 4, price lessThan 50, name not contains
`["ear tips","eartips","charging case","replacement"]`; paginate maxPages 5; dedupe by url; minItems 0;
`recordOutput: null`); **`s9` `extract_list`**, the same with name not contains `["ear tips","eartips","charging case"]`.

Divergences from Stage 1:
- **A second read of the same list (`s9`)**, which in the Flow runs on page 5, where `s8` leaves the tab.
- The accessory rule drops true pairs, the same misjudgement as run 9 (cause 6 there, F19): `"charging case"` matches
  "... with Wireless Charging Case" pairs.
- **Two helper columns (`plus`, `ad`) are stored** beside the four asked for (`recordOutput: null`, so every field is
  output).
- Matches: the search is typed and kept (`s6`), the dismissals are optional, and the Plus badge and card price/rating are used.

## Stage 4 — replay (the build's dry run, 22:54:41-22:55:11)

| Node | Result | Duration |
| --- | --- | --- |
| reset to store home | `core.replay.replayed` | 1.3 s |
| s2 navigate | replayed | 2.3 s |
| s3 Decline | **`core.replay.remembered`** (banner not shown: optional step) | 6.1 s |
| s5 Not now | `core.replay.remembered` | 5.0 s |
| s6 type | replayed | 0.05 s |
| s7 Go | replayed | 1.1 s |
| s9 read (4 terms) | replayed (5 pages) | 13.3 s |
| s10 read (3 terms) | **replayed**: on page 5, 11 unfiltered rows | 1.3 s |

- The gate passed the duplicate read because a replay judges only a collapse to zero
  (domain `node-run/replay.ts:241-249`). Exploration's own run of that step was also page 5 with 11 rows, so even a
  correct count could not differ. Its `replay.from` is recorded as `page=5` (the rerun's own start).
- `produced.records` in the dry-run requests was **638/643 for the reads, and 117/123 for a click and a type**. These are
  the longest array in the payload, not rows: t194-d227's cause 2 (`replay.ts:92`, `:243`) is live on this tree. It did not
  decide this run (nothing collapsed to 0).

## Stage 5 — the answer (Flow run 22:55:14-22:55:50)

Read accounts (`flow-lane.json` `extraction.steps[0].reads`):
- `s8`: 5 pages in order, `paginationStop control_disabled`, 94 seen, applied 94, kept 12, rejected [20,37,34,40,20],
  alone [4,6,12,3,5], deduped to **10**.
- `s9`: **1 page** (page 5), 11 seen, kept 0, rejected [4,5,4,7,3], alone [0,0,2,0,0], **`unfiltered: true`, 11
  rows returned** (sponsored, non-Plus, $50+).
- Stored: **21 rows in one record set, expected 13, matched 0** (`extraction-mismatches.json`).
- By url: `s8`'s 10 rows are expected positions 1-7, 10, 12 and 13, in order (the same 10 as run 9). Missing:
  - e8 Lumo Audio Drift Pro … Wireless Charging Case (B09HZLEPLS);
  - e9 Aurelle Pods Fit … Ivory with Wireless Charging Case (B0HKSZ2BM6);
  - e11 Trevio T5 … Wireless Charging Case, Rose Gold (B0X473P78X).

  All three were rejected by condition 5 alone.
- Why 0 matched although positions 0-6 have every value right: each row carries `plus` and `ad`, and the Lab's pairing
  rejects a record with a key the expectation does not name (`packages/test-runner/src/run-expectations/extraction/judgement.ts:292`).
  `extraction-mismatches.json` reports those rows as `values-differ` with `fields: []`, which does not say "extra columns".
- Not count-only: values compared field by field.

## Stage 6 — judgement and repair

- **Judge** (2 calls, `does_not_answer` twice): it correctly said 21 rows include sponsored, non-Plus and $50+ rows. It
  then advised "Make both extract steps apply the same full filter set … then dedupe the combined output". That is the
  wrong repair: `s9` is a duplicate read of page 5 and must be dropped, not aligned. The check 2 trigger is NO EVIDENCE.
  It probably comes from the re-author's "Testing the Flow so far" (panel #13): its cost ($0.0007 against $0.0025)
  suggests a cached repeat.
- **Re-author** (dumps 2 and 3, 19 calls, $0.0715, `flow_bootstrap.not_doable`): it followed the judge and reran
  step 9 with "the full filter set". 1 rerun ran and 16 were refused (see "Refusal loop" below).
- **Runtime repair** (2 calls, 22:56:51-22:56:59): a `runtime_diagnosis`, then a `runtime_patch` refused
  `llm_output.invalid_risk`. 4 interventions are listed (3 diagnoses) for 2 provider calls; the extra 2 diagnoses
  carried no call (NO EVIDENCE why).

### Which phase each dump is

| Dump | Phase | Decisions | Calls / cost |
| --- | --- | --- | --- |
| `22-53-23-880Z` | build (exploration, completion, dry run) | 15 | 15 / $0.08625 (+1 chat call in the build's 16) |
| `22-55-58-356Z` | **re-author, round 1** (starts on the stored Flow's page; ended `repeat_without_progress`) | 10 | 10 / $0.04194 |
| `22-56-26-017Z` | **re-author, round 2**: the resumed repair of the unfinished re-author (`core.resumed.0`, `llm_evidence_loop.repair`, `stopped: repeat_without_progress`, `test: not_tested`) | 9 | 9 / $0.02955 |

Dumps 2 and 3 sum to exactly the re-author attempt in `live-llm.json` (603,280 input / 6,186 output tokens, $0.071485).
The judge and the runtime repair are not evidence loops and write no dump.

### The refusal loop: what the invalid input was

- 16 calls were refused (round 1: `rerun.9.2`-`rerun.9.9`, 8; round 2: `rerun.9`-`rerun.9.8`, 8). Each was
  `web.action.rejected.invalid_input`, detail `{"reason":"consequences_unreadable"}` with `repeatedAnswer` 2..8, and
  diagnostic `phase: before_action`.
- **It is not the literal `item` selector.** It is a `"consequences": null` in the call. The model never wrote it.
- Every refused request was byte-identical after merging (1,030 bytes, same state digest `954f3a55`).

The chain, to file:line:
1. The re-author's draft step for the read was seeded without a `consequences` key, so round 1's first `rerun.9` ran
   (request keys `node, parameters`; 11 rows; `where[1]` rejected every one; see cause 5).
2. The domain wrote the step's declared input back with `consequences: value.consequences ?? null`. That is domain
   `node-run/run.ts:689-693` (`nodeCall`), and its result carries `draft.input.consequences: null`.
3. Core makes that declared input the step's input: `llm/evidence-loop/call-record.ts:52` (`input: declared?.input ?? input`).
4. The next rerun is a JSON merge patch over that input (`llm/evidence-loop/rerun-input.ts:30-45`). The model's patch
   never names `consequences`, so the `null` is carried into every later call.
5. The domain refuses a non-array declaration before it looks at the node's effect, even for a read:
   `permission.ts:90-91` returns `invalid`, and `node-run/run.ts:336-337` answers `consequences_unreadable`.
   So a read that "cannot have left anything behind" (permission.ts's own comment) is refused for its declaration.
6. The model is told only the reason word. It is shown its call without the stored `null`, so it cannot see what to
   correct. Writing `consequences: []` in its patch would have fixed it; nothing said so.
7. Round 2 resumed with the same draft step and failed from its first rerun.

### Would the repeat guard now on dev have stopped each loop?

Rule (`llm/repeat-guard/outcomes.ts:105-127`, `llm/evidence-loop/rerun-request.ts:68-72`,
`llm/decision-handlers/amendment.ts:103-110`, `repeat-guard/feedback.ts:20`):
- A proposing read whose page digest is unchanged is recorded as `changed_nothing`. A refusal is recorded as `failed`.
- A later rerun whose merged input matches one of those on the same digest is refused `changes_nothing` unrun.
- Three refusals on consecutive decisions stall the round. The guard is created per loop (`llm/evidence-loop.ts:397`),
  so a resumed round starts empty.

- **Build reruns: they would have been cut, not stopped.** Decision 10 (C) runs and records `changed_nothing`. 11 (C)
  is refused. 12 (D) runs, and its `add 10` still applies, so the duplicate read still enters the Flow. 13 (D) is refused
  and 14 (C) is refused: 2 in a row, below the stall. Result: 3 of 5 reruns unrun, but **the same 15 paid decisions**
  unless the refusal note changed the model's course. The page-5 cause, the duplicate add and the wrong answer are
  untouched.
- **Re-author round 1**: `rerun.9` (input B) runs. `rerun.9.2` (input C, carrying `null`) runs and fails. Decisions 4,
  5 and 6 would be refused (C on `954f3a55`), which is 3 in a row, so the round stalls after **6 decisions instead of 10**.
- **Re-author round 2**: decision 2 runs and fails, and 3, 4, 5 are refused, so it stalls after **5 decisions instead
  of 9**. This assumes the stall still leads to the resume, as `repeat_without_progress` did here.
- Together that is 8 re-author calls saved (about $0.029 of $0.0715). **Every rerun would still fail:** the guard limits
  the cost of the `null` defect and does not fix it.

## Cost by phase and every model call

| Phase | Calls | Input | Output | Cost |
| --- | --- | --- | --- | --- |
| build (15 loop + 1 chat answer) | 16 | 595,542 | 3,209 | $0.086514 |
| judge | 2 | 13,214 | 1,175 | $0.003229 |
| re-author (2 rounds) | 19 | 603,280 | 6,186 | $0.071485 |
| runtime repair | 2 | 34,940 | 1,180 | $0.011635 |
| **total** | **39** | **1,246,976** | **11,750** | **$0.172862** |

Per call (input includes cached; "cached" is the provider's cache hits where recorded). Input tokens over 39 calls:
min 1,573, median 30,104, max 75,814.

| # | Phase | Iteration | Input | Cached | Output | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | build: chat answer turn (derived: build accounting minus the loop's 15) | - | 1,573 | not recorded | 46 | $0.000264 |
| 2 | build loop | 1 | 16,202 | 640 | 100 | $0.004792 |
| 3 | build loop | 2 | 19,287 | 12,160 | 93 | $0.002323 |
| 4 | build loop | 3 | 19,955 | 12,160 | 85 | $0.002513 |
| 5 | build loop | 4 | 20,182 | 12,544 | 87 | $0.002471 |
| 6 | build loop | 5 | 20,528 | 12,672 | 100 | $0.002553 |
| 7 | build loop | 6 | 21,306 | 12,800 | 93 | $0.002740 |
| 8 | build loop | 7 | 27,177 | 13,056 | 75 | $0.004405 |
| 9 | build loop | 8 | 28,911 | 18,944 | 375 | $0.003554 |
| 10 | build loop | 9 | 48,017 | 13,312 | 126 | $0.010643 |
| 11 | build loop | 10 | 48,322 | 38,144 | 371 | $0.003727 |
| 12 | build loop | 11 | 53,819 | 15,232 | 371 | $0.012113 |
| 13 | build loop | 12 | 59,319 | 33,408 | 367 | $0.008414 |
| 14 | build loop | 13 | 64,817 | 38,400 | 367 | $0.008596 |
| 15 | build loop | 14 | 70,313 | 43,520 | 377 | $0.008751 |
| 16 | build loop | 15 | 75,814 | 48,640 | 176 | $0.008655 |
| 17 | judge | check 1 | 6,607 | not recorded | 656 | $0.002506 |
| 18 | judge | check 2 | 6,607 | not recorded | 519 | $0.000723 |
| 19 | runtime repair: diagnosis | - | 17,085 | not recorded | 650 | $0.005793 |
| 20 | runtime repair: patch | - | 17,855 | not recorded | 530 | $0.005842 |
| 21 | re-author r1 | 1 | 26,279 | 896 | 71 | $0.007705 |
| 22 | re-author r1 | 2 | 28,198 | 19,072 | 373 | $0.003300 |
| 23 | re-author r1 | 3 | 33,230 | 13,824 | 364 | $0.006342 |
| 24 | re-author r1 | 4 | 33,694 | 25,216 | 364 | $0.003131 |
| 25 | re-author r1 | 5 | 34,168 | 25,344 | 192 | $0.003030 |
| 26 | re-author r1 | 6 | 34,869 | 25,344 | 364 | $0.003446 |
| 27 | re-author r1 | 7 | 35,344 | 25,472 | 364 | $0.003551 |
| 28 | re-author r1 | 8 | 35,819 | 25,472 | 364 | $0.003694 |
| 29 | re-author r1 | 9 | 36,294 | 25,600 | 364 | $0.003799 |
| 30 | re-author r1 | 10 | 36,769 | 25,600 | 364 | $0.003941 |
| 31 | re-author r2 | 1 | 26,549 | 19,072 | 71 | $0.002443 |
| 32 | re-author r2 | 2 | 28,468 | 19,328 | 373 | $0.003306 |
| 33 | re-author r2 | 3 | 28,928 | 20,864 | 369 | $0.002987 |
| 34 | re-author r2 | 4 | 29,402 | 20,992 | 365 | $0.003087 |
| 35 | re-author r2 | 5 | 30,104 | 20,992 | 366 | $0.003299 |
| 36 | re-author r2 | 6 | 30,579 | 21,120 | 365 | $0.003402 |
| 37 | re-author r2 | 7 | 31,054 | 21,120 | 363 | $0.003543 |
| 38 | re-author r2 | 8 | 31,529 | 21,120 | 365 | $0.003687 |
| 39 | re-author r2 | 9 | 32,003 | 21,248 | 365 | $0.003792 |

Sources:
- Rows 2-16 come from `live-llm.json` `build.evidenceLoop.steps[].usage`.
- Rows 17-18 come from `verification.interventions`, and rows 19-20 from `repair.observed.observedCalls`.
- Rows 21-39 come from the dumps' `decision.usage`.
- Row 1 is derived: build accounting 595,542/3,209/$0.086514 minus the loop's 593,969/3,163/$0.086250. Calling it the
  chat's answer turn is an inference from `build.chat` (`answerTurn 2`, `became: build`).

## Does run 11 repeat t194-d227's causes?

- **The typed search not added to the Flow (Core `llm/evidence-loop.ts:207-211`): no.**
  - Decision 5's type was `add=1 act=a1` (core.log 22:53:40.615).
  - It is the Flow's `s6`, and the Flow run typed (`web.dom.type` succeeded, 112 ms).
  - `s8` then read 94 items over 5 pages.
- **The dry run's record count (domain `node-run/replay.ts:92`, `:243`, longest array): present, not decisive.**
  - It is still there: `produced.records` was 638/643 for 10/11-row reads and 117/123 for a click and a type.
  - Nothing collapsed to 0, so it never had to fire.
  - It would not have caught the duplicate page-5 read even with true counts (11 then, 11 now).

## Causes

| # | Cause, precisely | Repo and file:line | Smallest fix (not applied) | Owner |
| --- | --- | --- | --- | --- |
| 1 | **A rerun of a paginating read runs where the previous read left the tab (page 5).** 5 build reruns read 1 page, Next disabled, 11 unfiltered rows, identical every time. The model was told to narrow conditions, toggled the wrong one, and lost the 5-page account that showed the real fault. The rerun step then records `replay.from` page 5. | Core `llm/evidence-loop/rerun-request.ts:74` (the rerun call carries no start); the step's `replay.from` is known (`draft.replay.from` of `extract.list` = results page 1) | A rerun goes back to the replaced step's `replay.from` before it runs. That is the dry run's own `replay: "step", from` path, used for the rerun of an observe step. | lane B (Core rerun); the domain half lane C |
| 2 | **`consequences: null` written by the domain and carried forward by merge patches** refuses every re-author rerun `invalid_input` / `consequences_unreadable`: 16 calls, $0.06. | domain `runtime/llm-evidence/node-run/run.ts:692` (`value.consequences ?? null`); `permission.ts:91` (non-array is `invalid` before `effect` is read); Core `llm/evidence-loop/call-record.ts:52`, `rerun-input.ts:30` | `nodeCall` omits `consequences` when the call gave none (`present` drops `undefined`). Belt and braces: `webActionPermission` returns `no_consequence` for `null` on an `observe` node. Add a test: a rerun after a rerun of a read whose first call declared nothing. | lane C (re-author / domain node-run) |
| 3 | **A second copy of the list read was added to the Flow** (decision 12: `rerun 10` + `add 10` on the dropped original), so the Flow reads page 5 again and appends 11 unfiltered rows. | Core `flow-draft/amendment.ts:209-224`: `add` sets `kept`, and the only check is the step's own disposition (`already_in_flow`). It accepts re-adding a dropped step while another kept step already reads the same `handle` | Refuse `add` of an `extract_list` whose `handle` (or replaced-step lineage) is already kept: `already_in_flow`, naming the kept step. | t196 (draft authoring) |
| 4 | **The judge prescribed the wrong repair**: "make both extract steps apply the same full filter set … dedupe the combined output", when `s9` is a duplicate that must be dropped. The re-author followed it. | Core `result-verification/` judge advice (the "check's own advice" text) | When two reads share a handle and one read 1 page of 5 or answered `unfiltered`, the account says so and the advice names dropping it. | lane C (judge) |
| 5 | **A rerun's merge patch drops resolved selectors the model never saw.** `where` is a list, so the patch replaces it whole. The model's `where[1].read` had no selector, read the card's own `aria-label`, and rejected all 11 (re-author `rerun.9`: rejected [4,11,0,0,3]). | Core `llm/evidence-loop/rerun-input.ts:42` (arrays replace whole) with the domain withholding selectors from the shown call (`run.ts` `safeCall`) | Merge `where` items by index, keeping a withheld `selector` the patch does not name, or show `where` reads by field name as in the build. | lane C (re-author) |
| 6 | **The accessory rule drops true pairs** (`name not contains "charging case"`). Same as run 9: e8, e9 and e11 were missing, and read 1's `rowsAlone` listed them. | extraction near-miss account (F19 on dev) | Already F19's; this run shows the rerun hid its evidence (cause 1). | lane C |
| 7 | **Helper columns stored**: `plus` and `ad` are output beside the four asked for (`recordOutput: null`). The Lab then pairs no row (`judgement.ts:292`) and reports them as `values-differ, fields: []`. | Core/domain read output; Lab `packages/test-runner/src/run-expectations/extraction/judgement.ts:292` and `mismatches.ts` | Product: the judge checks stored columns against the instruction's. Lab: report "extra columns plus, ad" instead of an empty `values-differ`, and count value matches separately. | lane C (judge / Lab accounting) |
| 8 | **The dry run passed the page-5 read**: a replay judges only a collapse to 0. An `unfiltered: true` read is not a working step. | domain `node-run/replay.ts:241-249` | Answer `core.replay.changed` (or a refusal) when the replayed read's `conditions.unfiltered` is true. | lane C |
| 9 | **The Lab undercounts calls**: run total 20, actual 39, because the re-author's calls are `not_recorded`. | Lab `live-llm.json` `reauthor.callsFrom` (test-runner) | Count the re-author's decisions from its trace (the dumps hold them). | lane C (Lab accounting) |

## UI review (Lab ui-review, 14 moments; side panel open throughout)

The rule is that the chat shows each step with its reasoning.
- **#1 (22:53:20)**: "Loading the conversation…".
- **#2 (22:53:23.6)**: the empty welcome screen with suggestion chips, 1.4 s after the instruction was sent and 0.2 s
  after it was answered. No person message and no "Building" line. NO EVIDENCE whether the person's message showed
  later (the later captures are scrolled to the bottom).
- **#3-#6, build**: each step is a heading with its reasoning plus a card. This follows the rule. Gaps:
  - the cards read "Type · the page", "Click · the page" and "Read list · the page", without the control's name (the
    Flow run's cards do name it: "Type · Search Brightaisle", "Click · Go");
  - the five reruns each show "Updating the draft Flow … Read list · Done". The chat calls a read whose conditions
    kept nothing and returned rejected rows "Done", so the person cannot see the loop;
  - "Robot check: Done. The check cleared on its own after 9 s." is clear.
- **#7-#8, dry run**: "Test run · Decline" and "Test run · Not now" are shown in **red, "Didn't work: it didn't work the same
  way again"**, but Core answered `core.replay.remembered`, which is fine for an optional step. Several "Test run · Done"
  cards carry no name (the reset, the navigate, both reads).
- **#9-#10, Flow run**: "Running your Flow · Step 8 of 9 · Reading the list", then "Read list · Done / Records saved"
  **twice** with no row counts. Then "Test run · Working on it" and "Checking the result answers the request".
- **#11-#13, re-author**: "Fixing your Flow · Step 9 of 9", then about 16 near-identical "Updating the draft Flow — Rerun
  the s9 extract_list with the full filter set …" headings, each followed by a red "Read list · Didn't work: the step
  wasn't accepted". The chat repeats the same reasoning and the same failure many times. It names an internal node id
  ("s9") and `extract_list`, and never says why the step was refused.
- **#13**: "Testing the Flow so far — The build stopped before the Flow was finished: it kept repeating itself …" is
  honest.
- **#14, failure**: "Working out what went wrong — … The cause is visible in the step parameters: node s9
  (web.output.dom-extract_lis…". The message is **truncated mid-word** and exposes a node id. Then "Run failed", with no
  statement of what was stored (21 rows) or what it cost. The page toast "Couldn't fix your Flow / Run failed" is
  readable.
- **Overlay**:
  - build: the toast is top-right ("Building your Flow · Thinking about the next step"); the Flow run's toast is
    bottom-left, so its placement changes between phases;
  - Lab: `flickering` at #9, #11 and #12 (2 presence toggles or text changes in 3 s);
  - absent at #2 while the build had started.
- Owners: card names, red `remembered`, repeated rerun messages, the truncated diagnosis and the overlay are t191/t174
  (UI). The refusal reason not shown is lane C, cause 2, plus t191.

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 6 | When judge check 2 ran and what triggered it | `live-llm.json` `verification.interventions` carries no time or phase |
| 6 | Why 4 harness interventions show 2 provider calls | `flow-lane.json` `harnessRecovery.interventions` has no call ids |
| all | The re-author's per-call records (only in decision dumps) | Lab `live-llm.json` `reauthor.callsFrom: not_recorded` |
| 2 | The model's reasoning per decision (shown in the chat, absent from the dump's `decision`) | Core `llm/evidence-progress/decision-dump.ts` |
