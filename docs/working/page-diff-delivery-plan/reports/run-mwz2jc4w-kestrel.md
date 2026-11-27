# Report: run-mwz2jc4w-0c207128 (kestrel auctions), diagnosis only

Debug file: `docs/working/language-driven-flow-loop-plan/debugs/run-mwz2jc4w-0c207128.md`.

## Outcome

Done.

- All five questions are answered from the recording, with file and line.
- The replay's stop has a confirmed cause, proven by the gateway trace.
- The search was sent and landed on the site's bot check, an interstitial that lets the visitor on by itself after
  5 s.
- The domain's effect check read that third address as proof the act never happened.
- Core then had no route on, because that verdict is a true failure that bypasses retries, the effect check and state
  routing.
- Two further product defects made the re-exploration cost $1.18 instead of about $0.06. Two judge-side defects added
  $0.49.

Corrections to the brief:

- Note 0105 (`flow_not_proven`) belongs to **attempt 3**, steps 0091-0106. Attempt 3's replay ran with 0 decisions and
  1 standalone judge ($0.09, yes).
- The run was stopped as **attempt 4** began, not during attempt 3. The log ends with attempt 4's instruction being
  typed.
- Attempt 2 = steps 0040-0090: 18 decisions and 3 judges = 21 calls, $1.91.

## What changed and why

Nothing in code. Two documents were written: the debug file above and this report.

## Answers

### Q1. Step 3's `effect_not_seen` on `dom-type`

**What the page did.**

- 0040 opened the home page afresh, so nothing was left in the search box from attempt 1.
- 0041 Reject all was passed over by state routing, since consent was remembered (`attempt-2/site.json` `activityBefore`).
- 0043 typed "kestrel 35" with `submit: true`. Spans show `send.type` succeeded and `pressed type`.
- From the gateway trace (`project.sqlite` `client_gateway_trace_events`, trace `…091757be0ac1`):
  - seq 61, 14:24:16.268: the tab is at `/splashui/challenge?ru=%2F…%2Fsch%2Fi.html%3F_nkw%3Dkestrel%2B35%26_sacat%3D0`,
    titled "Pardon the wait | Hammerline". The `ru` is the search the type submitted, so the act landed.
  - seq 77, 80, 83, 86, 89, 92 (16.545, 16.572, 17.103, 17.640, 18.168, 18.705): the six snapshots the
    recorded-effect wait took. Every one is on the check page.
  - seq 99, 14:24:21.303: the tab is on `sch/i.html?_nkw=kestrel+35&_sacat=0`, 5.0 s after the check loaded.
  - The run had stopped at 18.716 (0043 `finishedAt`). 0045's look, at 19.2-23.3, found the results page.

**Why the bot check came up.**

- `apps/scenario-lab/src/scenarios/auction-marketplace/route.ts:11,54-57` sends a session's fourth results page to the
  check, once. Attempt 1 served three or more in the same session.
- `client/challenge-script.ts:12` lets the visitor on after 5 s. `attempt-2/site.json` `activity` records
  "passed challenge".
- This is realistic interruption design, not a fixture defect.

**Why it was judged not done.**

1. `packages/fluxiq/src/engine/automation/node-execution/attempt.ts:296` calls
   `recorded-effect.ts:65-101` after the type answered success.
   - The node has an effect, because the answer-first draft stamps route signatures.
   - The saved s4 effect (`graph_nodes`, and the same in `global.sqlite` `…/answer-attempts`) is `web-effect.v1`:
     `added` 16, `removed` 16, `path` `488e7727` (results). Its `before.path` is `5e3745f5` (home).
2. `recorded-effect.ts:83` uses a window of `automationStudioReadinessCeilingMs(undefined)`, which is the 2,000 ms
   floor (`transitions/recorded.ts:35,69-72`). Neither Flow's nodes carry `recordedGapMs`. The loop at `:85-92` polls
   every 500 ms, which matches the span `recorded-effect` 556→2714 ms.
3. `domain/src/runtime/route-state/effect/seen.ts:56` answered `not_seen` each time: at least 3 added, none shown, and
   the page not on `488e7727`.
   - The check page shows none of the results controls. It also shows none of the home page's `removed` controls, and
     it is on neither path.
   - The header (`seen.ts:13-18`) says `not_seen` is for "strong evidence of absence". A page that has left where the
     step found it is evidence the act did something.
4. `recorded-effect.ts:93-101` fails the attempt with `output_not_observed` / `core.step.effect_not_seen`, stage
   `verification`. `compareAutomationStudioTransition` marks it `hostEvaluated` (`transitions/comparison.ts:97`).
5. `defensive/assess.ts:102-104` (`rejectedAfterSuccess`, `:186-190`): a lasting act refused after success is a true
   failure. It is not `actUncertain`, so the effect check in `step-loop/failed-attempt.ts:88-95` never runs, and
   neither does any retry.
   - The type is lasting because `domain/src/actions/action-effect/table.ts:21` makes `web.dom.type` a commit when
     `submit` is set (`defensive/lasting-act.ts:57`).
6. `graph-run.ts:554` offers state routing only to a step that could not run. This step ran, so the router's
   "effect already holds" route (`state-routing/decision.ts`, rule 3) was never asked.
7. `defensive/continuation.ts:44`: `output_not_observed` is not survivable, so the run stops.
   `answer-first/attempt/round-note.ts:23,74` hands the attempt to the model.

**How the AGENTS.md rules apply.**

- "Every node retries" excludes repeating a lasting act whose effect may have landed (`lasting-act.ts:3-41`). Retrying
  the submit would have been wrong anyway.
- "Runtime routes by state" never ran (point 6).
- The defect is upstream of both: a wrong `not_seen`.

**A field that already holds the value.** It did not hold one here, but the answer is:

- **Without `submit`:** the field's value is the whole effect (`table.ts:21`, state, `repeatSafe`). Counting it done is
  right, and retyping is harmless. `apps/extension/src/content/actions/type.ts:101-106` proves the field equals the
  text, so the type replaces the value rather than appending.
- **With `submit`:** the value is not the effect. The submit is the lasting act and its effect is the page it brings.
  So type and submit, and judge it by the page, as this run did.
- Core's "already in state" skip (t775) is only for presses with `ensureState`
  (`domain/src/io/gateway-output-dispatcher.ts:84-90`). It should not be extended to a submit.

**Why provider-free missed it.**

- Recovery-matrix case 14 (`packages/test-runner/src/recovery-matrix/flows/hood-seller-shop.ts`, t968) is this exact
  search-into-the-check under `browser-check-first`.
- But its search step is authored and has no route signatures, so `recorded-effect.ts:77-79` returns before judging.

### Q2. The judge reply at 0088/0089

**What Sonnet sent** (`0088-judge/response.txt`, tool call `core_check_answer`, 2423 chars):

- `diagnosis` was a JSON-encoded string holding `answersRequest`, `expected`, `observed`, `changed`,
  `stillAchievable`, `deterministicRecoveryPossible`, `defects` and `checked`.
- `answerRecords`, `explorationNeeded`, `patchNeeded`, `confidence` and `summary` came after it as top-level keys.
- The first three of those belong inside `diagnosis`. That gives exactly 0089's four complaints.
- 0087, a turn earlier, against byte-identical tools, sent the object correctly.

**Why it could nest wrongly.**

- `core_check_answer` is sent non-strict. In 0088's request the strict tools are `complete`,
  `web_detect_repeating_structure`, `web_describe_element`, `core_describe_nodes`, `core_recall_result` and
  `core_full_page`.
- `models/providers/anthropic/judge-answer-tool.ts:18-22` explains why. Strict schemas share 24 optional parameters per
  request (`grammar.ts:19`). The six strict tools use 23, and this schema needs about 12, so it goes last and
  non-strict (`decision-tools-wire.ts:36-52`).
- Without constrained decoding, nothing stops a nested object parameter from being serialised as a string. That is a
  sampling slip, not a misunderstanding: same description, right at 0087, wrong at 0088.

**What should prevent it: a strict schema, reached by a simpler reply shape.**

- A clearer description would not: it was already sufficient once.
- Flattening alone reduces nesting but leaves the answer unconstrained.
- So reshape the answer to cost about 0 optional parameters:
  - every `diagnosis` member required;
  - `confidence` required;
  - drop `metadata` from the tool's copy (`grammar.ts` already drops open bags);
  - fields that may truly be absent (`siteShows`, and a defect's `column`/`value`/`step`) as required and nullable.
- Nullable members use the union budget (16), not the optional one. The tool then fits (23 + 0 ≤ 24) and is sent
  strict while staying last.
- Note: strict decoding does not enforce `minLength`/`maxLength`/`minimum`. Core strips them (`grammar.ts:3`) and keeps
  validating them after, as now.

**Also in this judge path (cost, not shape).**

- 0088 itself was a re-ask: 0087's citation "Kestrel 35 Rangefinder Camera (ends Mon 21 Sep 15:35)" matched no row.
- Attempt 1's 0039 was the same re-ask for the same title.
- `result-verification/cited-yes/citation-refuted.ts:36-40` accepts a shared label as written, or a bare position.
- But the judge's copy gives rows that share a label one id (`request-rows/row/id.ts:17-19`). The citation rule
  (`citationsNotMatched.validCitation`) never says a shared label may be cited as is, so the judge qualified it
  itself.
- Cost: $0.15 in attempt 1, $0.25 in attempt 2.

### Q3. What attempt 2's other calls were spent on

There were 18 decisions ($1.18) and 3 judges ($0.73). With the replay standing, attempt 2 would have needed no
decision.

| Calls | Cost | What | Cause |
| --- | --- | --- | --- |
| 0046 click Auction, 0048 detect, 0050 read, 0074 and 0084 processing, 0086 complete | $0.36 | ordinary re-exploration | the replay stop (Q1); also `round-note.ts:23` told the model "The page is where it left it. Fix that step", which was false by 0045 |
| 0052, 0054, 0056 reads, 0058 amend (drop 6, 7; keep 14 as result) | $0.29 | **product defect** | The saved Flow's read (step 6, `not_reached` this attempt) stayed the draft's result. Every new read was marked `taken`/`not_the_result` and the new Auction click `dead_end` (0052's `core.flow_draft`). At the same time `core.result` said "the draft has no read step yet … Capture the required source fields". The feed and the composer disagreed: 0051's tool result says "the result is now step 11's"; 0052's header says "step 11 left the draft". Likely site: `runtime/flow-authoring/draft/compose/compose.ts:98-110`, where a ruled (carried) read with `result` set becomes `named` and outranks every framework read. |
| 0060 next page, 0062 amend repeat, 0064 processing refused ("Capture the result's full retained schema"), 0066 run_flow from 14 (page 2 only), 0076 back to page 1, 0078 run_flow 14-15 | $0.39 | **product defect** | After 0058 the result was step 14 "(v1) has read no page yet": the 26 rows its read took at 0057 were not credited to v1. The loop was rebuilt and run twice. |
| 0070 (pattern of 206 characters over the stated 200), 0072 (price regex missed row 15) | $0.14 | model slips | The limit is stated in the tool text (0070's request, lines 52 and 78). |
| 0087 judge | $0.24 | needed | |
| 0088 judge | $0.25 | **product defect** | duplicate-label citation re-ask (Q2) |
| 0090 judge | $0.24 | **product defect** | unreadable-shape re-ask (Q2) |

The judges cost about 167k input tokens each, with only 58k read from cache. That was not investigated further.

### Q4. Shared with bigbox run-mwz29d50

Its debug file (`debugs/run-mwz29d50-c3a32a9c.md`) was read, and its report did not yet exist.

- **Shared kind of defect.** A replay rule reads a step's recorded route signature but not where the page is now
  relative to the step's start and its destination.
  - bigbox F1: `state-routing/not-arisen.ts:59-69` passes over a step whose effect was a navigation.
  - Here: `seen.ts:56` calls a third address absence.
  - Both fixes want the effect's addresses to be first-class. K1 adds `from` to `route-state/effect/sign.ts`, which
    bigbox F1 also reads (`effect.path`), so the two changes should land in one unit, or K1 first.
- **Shared path, different result.** Attempt 3 here met bigbox F2's standalone `flow_not_proven` replay judge (0105,
  0106, `no_decision_in_this_attempt`). It answered yes because the read rows carry their own evidence. bigbox's
  answered `unknown` for want of page text.
- **Not shared.**
  - bigbox's `output_not_observed` is a read run on the wrong page (cart read on the product page). Here it is
    `core.step.effect_not_seen` on a type.
  - The reads, columns and keys are fine in both runs.
  - The draft/result disagreement (K3) and the judge shape and citation defects (K4, K5) were not reported for bigbox.
    Its attempt-1 double judge (0030, 0031) may be K5 and is worth checking.

### Q5. Root-cause fixes, each with an offline proof on this recording

None caps anything. Rejected as symptom fixes:

- raising the 2 s floor, or waiting longer for the effect;
- retrying the submit, which repeats a lasting act;
- parsing a stringified `diagnosis` back into an object;
- accepting any citation text.

**K1. `not_seen` only when the page stands where the step found it** (domain `route-state/effect/sign.ts`,
`seen.ts`; Core unchanged).

- The change:
  - `sign.ts:66` also signs `from` (the start path shape) whenever the step moved.
  - In `seen.ts`, a page on neither `from` nor `path` that shows none of `removed` and none of `added` has left its
    start without arriving. That is `unknown`, so the act's success stands.
  - Old effects without `from` use "none of `removed` shown". The t1062 `standsWhereFound` rule and the Add to cart
    case (no `path`) are untouched.
- What happens next on this run: step 4 (Auction) meets the check page. Its target is not found, and it is retried
  with a wait until the check lets the visitor on. Recovery-matrix case 14 already requires and proves exactly that
  (`hood-seller-shop.ts:14-19`).
- **Offline proof.**
  - (a) A domain unit test built from this recording:
    - the saved s4 effect (`graph_nodes` / `answer-attempts`);
    - the observed route states of the six snapshots in trace seq 77-92;
    - the results snapshot at seq 123 (14:24:22.613);
    - the home page captured after 0040.
    - Today: `not_seen` ×6, which reproduces the run. After: `unknown` ×6, results `seen`, home `not_seen`.
    - The existing `seen` tests (run-mv5tusj4, run-mwxixc4p) must stay green.
  - (b) Provider-free: a recovery-matrix case 14 variant whose search step carries a signed effect, as the
    answer-first draft writes it, under `browser-check-first`. Today it stops `effect_not_seen` at the search. After,
    it reaches the shop with no model call.

**K2. A replay stop is told as the page is at handoff** (Core `answer-first/attempt/round-note.ts:23,74` and the
flow-run stop).

- The change:
  - Before handing over, observe the page once and ask the stopped step's effect again.
  - Where it now holds, take the router's existing "effect holds" way on and continue the replay from the next step.
  - Otherwise say what the page shows rather than "The page is where it left it".
- K1 removes this run's trigger. K2 covers any interstitial slower than one look.
- **Offline proof:** the stop of 0044 with the observation of 0045 (trace seq 123). The domain's
  `webAutomationRouteEffectHolds(effect, observed)` returns true, and the replay resumes at position 4. That is a unit
  test over the recorded effect and snapshot.

**K3. One answer to "which read is the result"** (Core `flow-authoring/draft/compose/compose.ts:98-110` and the
answer-first result feed).

- The change:
  - A carried read that has not run this attempt may not hold the result against a fresh read of the same list. The
    later read is the model's latest word, as rule 5 already says for framework reads.
  - The header and the draft name the same step.
  - Rows a read took before it was ruled the result stay credited to it.
- **Offline proof:**
  - Run `automationStudioFlowDraftCompose` on 0052's recorded `core.flow_draft` (steps 1-11, with step 6 carried and
    ruled). Today step 11 comes out `not_the_result`, which reproduces it.
  - After the fix it is the result, and the feed's header says the same.
  - Replay 0058's amendment on the recorded ledger: step 14 keeps page 1's 26 rows.

**K4. A strict judge answer** (Core judge schema, `judge-answer-tool.ts`, `decision-tools-wire.ts`).

- The change: the zero-optional reshape in Q2.
- **Offline proof:**
  - `automationStudioAnthropicDecisionToolsWire` over 0088's recorded tool list, with the reshaped schema, returns
    `core_check_answer` with `strict: true`, total optional ≤ 24 and unions ≤ 16.
  - Validating 0087's and 0090's replies against the reshape accepts them, so it refuses nothing good.
  - 0088's reply is refused.
  - That strict decoding cannot produce 0088's shape is the API's guarantee, which no offline run can show. The first
    live judge measures it.

**K5. Rows that share a label get distinct handles** (Core `result-verification/request-rows/row/id.ts`,
`cited-yes/`).

- The change:
  - An id from the label plus its rank among equal labels, shown in the judge's copy.
  - `validCitation` says rows sharing a label are cited by that handle, or as written.
- **Offline proof:**
  - The matcher over 0038's and 0087's `checked` against the stored rows. Today: 1 and 2 refusals.
  - The same citations by handle match, each to the right row (£64.00 / 15:35, £41.00 / 23:05).
  - Whether the judge uses the handle shows only live.

## Commands run and observed results

- `find …/lab-runs -maxdepth 2 -name run-mwz2jc4w-0c207128` → `lab-runs/2026-11-27/run-mwz2jc4w-0c207128`. Then
  `cat steps/index.md`: 106 steps; attempt 2 = 0040-0090; 0043 `failed core.step.effect_not_seen`; 0088
  `llm.provider_output_invalid`.
- `node scratchpad/kestrel-summarize.mjs <steps> 44 90` (a script file, not `node -e`): each decision's tool, input
  and cost, as tabled in Q3.
- `node scratchpad/kestrel-strdiff.mjs`, plus `diff` of the 0087 and 0088 requests: the only added evidence is
  `citationsNotMatched` (two "(ends …)" rows).
- `grep` of 0052-0086 requests for `core.result` and `core.flow_draft`: the header and draft disagreements quoted in Q3.
- `python -I scratchpad/kestrel-tables.py` on copies of `global.sqlite`, `project.sqlite` and `runtime/sqlite/global.sqlite`:
  tables listed, secret tables skipped.
- `python -I scratchpad/kestrel-nodes.py` and `kestrel-sig.py`: s4 effect `added` 16, `removed` 16, `path 488e7727`;
  `before.path 5e3745f5`; no `recordedGapMs`.
- `python -I scratchpad/kestrel-trace.py project.sqlite "splashui/challenge"`: 12 hits, from 14:24:16.268 to 18.705,
  all "Pardon the wait". With `"kestrel 35 for sale"`: the results page at 14:24:21.303 (seq 99) and 22.613 (seq 123).
- `grep -n "it ended\|typing the instruction" kestrel4.log`: attempts 1, 2 and 3 ended achieved at lines 154, 238
  and 256. Attempt 4's instruction was typed at line 260, the last line. Line 237 gives attempt 2's total, $1.912752
  over 21 calls with $0.730205 of it judge. Line 255 gives attempt 3's, one judge call at $0.090292.
- No background process was started. No live or paid run, no `node -e`, no git.

## Not verified

- The K1-K5 code changes and their proofs were not written or run. This brief was diagnosis only.
- Whether the trace snapshots convert to the host's route-state shape unchanged for K1(a).
- K3's exact mechanism: the draft view does not show a step's `result` flag. `named` is inferred from the dispositions
  and from 0051 versus 0052, and running compose on the recorded draft would confirm it.
- Why step 14's v1 had no pages after 0058.
- Why attempt 3's replay "deviated from the accepted run".
- Why the judges read only 58k of about 167k input tokens from cache.
- That the 6 strict tools use 23 optional parameters on this run's requests: taken from `judge-answer-tool.ts:18-21`'s
  measurement of `run-mwy3btww`, not recomputed.
- The union count left for nullable fields.
- Anthropic's 24/16/20 strict limits: taken from `grammar.ts:10-19`. The bundled API reference does not state them, and
  the live docs were not fetched.

## Open questions or contradictions found

- The brief places note 0105 in attempt 2 and the stop in attempt 3. The steps and log put 0105 in attempt 3 and the
  stop at attempt 4's start.
- `recorded-effect.ts:22-27` says an unseen effect fails "so the act is not made again". But `assess.ts:102-104` also
  skips the effect check and state routing. So a lasting step with a wrong `not_seen` can never be found done later in
  the same run. K2 addresses this at handoff. Whether Core should also re-ask the effect inside `failed-attempt.ts`
  for this failure is a design choice for the lead.
- K1 and bigbox F1 both touch the effect's address fields (`sign.ts`). Sequence them in one unit.
