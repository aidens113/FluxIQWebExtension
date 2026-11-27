# Audit of live run run-mwy3btww-31d32e0d (bigbox new-store cheapest towels)

Diagnosis only: no code changed, and no live, paid or git command was run. Sources:
- the step files `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwy3btww-31d32e0d/steps/`;
- the Lab log (`.../scratchpad/live-round/bigbox.log`);
- the attempt bundle `fxwork/t1015-paid-bigbox/test-runs/instances/paid-bigbox/attempts/run-mwy3btww-31d32e0d/`;
- the shared Core checkout `fxwork/!FluxIQ` at fluxiq 0.54.30, the version the lane ran.

Core paths below are under `packages/fluxiq/src/`, and Lab paths under `fxwork/t1015-paid-bigbox/packages/`. The debug
file is `docs/working/language-driven-flow-loop-plan/debugs/run-mwy3btww-31d32e0d.md`.

## Outcome

- **The model did the task right by step 0020**, about $0.35 and 9 decisions in.
  - At 0019 it saw the first card of the Pickup list sorted by price: "$1.28", "4.5", "4.5 out of 5 Stars. 938
    reviews", "Pickup today".
  - It added that single roll (0020) and read the cart's 2 rows (0026).
  - The site agrees: `cart:5510204:pickup +1` (the $1.28 roll's variant), store 2291 to 4419, dish soap kept.
- **Everything after that was the completion check failing to accept a right answer.**
  - 7 checks took 14 judge calls ($0.59).
  - They drove 49 more decisions ($2.24) of re-verification, refusals and round restarts, until the person stopped
    the run.
- **"0 rows stored, 0 shown" and the empty chat table** come from one amendment at 0144. It emptied the result 7
  steps before the Stop. Until then the result held the right 2 cart rows.

The user's suspicion holds, but on the judge's side, not the decider's. The decider saw what it needed all the way
through. The judge either saw it and answered in a form Core cannot read, or could not see it.

## Findings, ranked by impact on whether runs succeed

### F1. Every continuing judge's reply was unreadable (product, judge transport; regression from t1038, fluxiq 0.54.20)

- **Cause.**
  - Since D12 (t1038) the decider goes as tools (`runtime/llm/anthropic/provider.ts:23-34`, default on).
  - A judge that continues the decider's cached conversation keeps the decider's `tools` and `tool_choice: auto`, and
    must answer "with only the JSON object ... as your reply's text" (`runtime/models/providers/anthropic/continuation.ts:31-38`,
    `JUDGE_TURN_AFTER_TOOLS` at :58). It is read as plain text (`runtime/llm/anthropic/provider.ts:117`,
    `jsonText: prefix.afterTools !== true`).
  - Two ways to fail are left open:
    - text before the object is refused as `content_prefixed` (`runtime/models/providers/anthropic/reply/case.ts:12`,
      thrown from `reply/reading.ts:18-19`);
    - a call of the still-offered `complete` tool is refused as `tool_call_unexpected`
      (`runtime/models/providers/anthropic/messages.ts:142`).
- **Evidence.**
  - All 7 continuing judges failed. Every one of them has `"continuation":{"used":true,"reason":"continues_the_decider"}`,
    and tools are in each request.
    - Prose then JSON: 0034, 0077, 0104, 0130.
    - A `complete` call with `summary: placeholder`: 0039, 0060, 0069. 0039 is one too, not only 0060 and 0069.
  - 6 of the 7 said yes:
    - 0034, 0077 and 0104 carry a schema-shaped object with `"answersRequest":"yes"`;
    - 0039, 0060 and 0069 say it in prose (0039: "rated 4.5 (938 reviews), and it shows 'Pickup today' ... 4.5 meets
      the 4.5-or-higher threshold").
  - The previous live run run-mwvgjb8c (fluxiq 0.54.24) came before tools were on by default. Its decider and judge
    had `output_config` and no tools, and its one judge (0042) was read.
- **Proposed root-cause fix.**
  - Give the continuing judge an answer channel it cannot miss, without breaking the cache. Put one judge-answer
    tool (input schema = the judge's outputSchema) in every decider request's tool list, so the cached prefix is the
    same bytes, and tell the judge turn to answer by calling it.
  - Read the judge's answer from that call, and from no other tool. The decider is never offered the judge tool's
    use, and a decider call of it is refused as any unknown tool is.
  - Do not fix this by reading the last object out of prose: that is a lenient parse over a format the model is
    told not to use.
  - t1065 is fixing `tool_call_unexpected`. It does not cover the 4 `content_prefixed` replies, which are half of
    the failures here, so the channel above is needed whichever way t1065 lands.

### F2. The judge used after an unreadable reply cannot see the evidence (product, judge evidence; t979 design, made reachable by F1, and t1037 together with t1048)

- **Cause.**
  - After one unreadable reply the check is asked on its own request, for the rest of the check
    (`runtime/result-verification/unreadable-asks/asks.ts:73-76`, `standalone`). That request is the judge's own
    projection, which leaves out:
    1. **Page views.** Every trail entry carries `"captureOmitted":true`. The add's entry (n=10) holds only the
       filter controls and "Added to cart". It names neither the card it pressed nor its rating or pickup line.
    2. **The candidate reads' rows.** The model read the filtered list with `rating` and `pickup` columns twice: c15
       at 0082 and c50 at 0100, 15 rows each.
       - The framework draft drops a read that is not the result's
         (`runtime/flow-authoring/draft/compose/compose.ts`, rule 2, `not_the_result`, t1037). 0083 says "step 21
         left the draft, and its page=1 (15) left its working read", and 0101 says the same for step 27.
       - The judge's working reads come only from draft steps
         (`framework/automation-service/service/answer-first/result-feed/feed.ts:272`, t1048).
       - The trail entry for a read carries only its counts and field names (`found.evidence.read`, no rows).
- **Evidence.** In the fresh judge requests, "Pickup today" appears 0 times and "4.5" once (the instruction). "938"
  never appears. Counts per request:

  | Judge | Kind | "1.28" | "4.5" | "Pickup today" | "938" | Verdict | Cost |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | 0034 | continuing | 13 | 20 | 46 | 5 | unreadable (prose + JSON, yes) | $0.0471 |
  | 0036 | fresh | 4 | 1 | 0 | 0 | unsure | $0.0504 |
  | 0039 | continuing | 14 | 20 | 46 | 5 | unreadable (tool call, prose yes) | $0.0430 |
  | 0041 | fresh | 5 | 1 | 0 | 0 | unsure | $0.0154 |
  | 0060 | continuing | 19 | 23 | 50 | 7 | unreadable (tool call, prose yes) | $0.0545 |
  | 0062 | fresh | 6 | 1 | 0 | 0 | unsure | $0.0286 |
  | 0069 | continuing | 19 | 23 | 50 | 7 | unreadable (tool call, prose yes) | $0.0553 |
  | 0071 | fresh | 6 | 1 | 0 | 0 | **no** | $0.0192 |
  | 0077 | continuing | 19 | 23 | 50 | 7 | unreadable (prose + JSON, yes) | $0.0611 |
  | 0079 | fresh | 6 | 1 | 0 | 0 | unsure | $0.0176 |
  | 0104 | continuing | 23 | 23 | 44 | 5 | unreadable (prose + JSON, yes) | $0.0728 |
  | 0106 | fresh | 6 | 1 | 0 | 0 | unsure | $0.0332 |
  | 0130 | continuing | 11 | 6 | 8 | 0 | unreadable (prose + JSON, unknown; F3) | $0.0753 |
  | 0132 | fresh | 6 | 1 | 0 | 0 | unsure ("diagnosis: unknown") | $0.0166 |

  Total: $0.5901, matching the Lab's judge total. Each check was one continuing call and then one fresh call. That
  is why there were 14 judge calls for 7 checks.
  - The fresh judges kept asking for the same thing. 0036: "nor checked the item's rating, pickup-today
    availability". 0106: "The 15-row result list was read but its rows and ratings are not shown". 0079: "no result
    row was read".
  - 0071 said **no** over the order of acts: "the add was made on a page with Today unchecked, so neither the rating
    condition nor 'today' pickup is shown to hold". That is the right reading of evidence that leaves out the card.
- **Proposed root-cause fix.**
  - The judge's projection must stand on its own. A continuation is a cache saving and must never change what the
    judge can see. Two changes:
    1. **The rows of every read that bears on the answer reach the judge, whether or not the read stays in the
       Flow.** Have the result feed keep a read's pages as evidence when it leaves the draft (not as the answer), and
       send them in `resultEvidence.working`, or in a new `evidenceReads` beside it.
    2. **An act's trail entry names the item it acted on.** The press's own read already does this for the store
       picker (0008: "This acted on item 4/4 (Millbrook Crossing ...)"), but not for the product card at 0020 (no
       `actedOn` in `0020-tool-core.run_node/result.json`). The search grid's cards are not marked as list items in
       the page view (no `- i/n` lines at 0019, unlike "Popular in your area"), so no item is named. Trace and fix
       that card-as-item detection in the domain's page view (location not verified here).

### F3. Rows the decider recalled never reach a continuing judge (product, judge continuation; older, t965/t1044 design)

- **Cause.**
  - A continuing judge gets the decider's blocks up to the last cache mark
    (`runtime/models/providers/anthropic/continuation.ts:60-83`).
  - `core.recall_result` puts the recalled view in the `core.current_view` tail, after that mark.
- **Evidence.**
  - In 0129's request the recalled c50 rows ("938" 3 times) are only in block 18. The last mark is block 17.
  - Judge 0130 continued it and holds "938" 0 times and "Pickup today" 8 times (route-state control lists only).
    It said: "Its rating was never verified; the 15-row list was read, but its ratings are not shown here".
- **Proposed fix.** F2's first change covers it. The judge's evidence comes from the feed's reads, not from what the
  decider's prefix happens to hold.

### F4. A `result` edit put a second copy back with no pages and emptied the result (product, draft amendment; regression from t1037's edits, fluxiq 0.54.25)

- **Cause.**
  - At 0144 the model sent `step 36: keep` and `step 36: result`.
  - `keep` is checked for a second copy (`runtime/flow-authoring/draft/amendment/apply.ts:207-211`) and was refused:
    `second_copy`, `copyOf: 13`.
  - The `result` branch runs before that check and has no such check (`apply.ts:182-187`;
    `runtime/flow-authoring/draft/amendment/edits/result.ts:9-15` sets `disposition = "kept"` unconditionally). So
    step 36 went back into the Flow anyway.
  - Step 36 had left the draft at 0139, and the feed dropped its pages: "step 36 left the draft, and its offset=0 (2)
    left the result".
  - It came back as "a new read step" whose v1 "has read no page yet". The answer went from 2 rows to 0, with no
    contributing pages and so no schema. The data stage then refuses
    `answer_first.processing_schema_missing` (`framework/automation-service/service/answer-first/result-feed/stage.ts:66`).
- **Evidence.** The `core.result` line the decider saw:
  - 0003 to 0025: "no rows: the draft has no read step yet";
  - 0027 to 0144: "step 13 ... 2 rows over 1 page";
  - 0146: "result 2 → 0 rows: step 36 is a new read step; the result is now step 36's (it was step 13's)";
  - 0149: completion refused `processing_schema_missing`.
- **Proposed fix.**
  - The `result` edit applies the same second-copy rule as `keep`. Naming a copy either moves the result to the
    step it copies (here step 13) or is refused `second_copy` with `copyOf`, never applied beside a refused `keep`.
  - Separately, a read step that leaves the draft and comes back should have its pages back. The feed holds pages by
    the call that first ran the step (`feed.ts` header, "A draft step's ledger id is the call that first ran it"),
    so it can restore them instead of starting a new version with none.

### F5. Why "0 rows stored, 0 shown" and no cart table in the chat (consequence of F4 together with F1 and F2; no separate defect found)

The coordinator asked to start here. This is the trace.

- **"Full retained schema"** is the record schema of the pages that make up the answer (`feed.ts:191`,
  `retainedSchema()`). Without contributing pages there is none.
- **The cart page's read did retain a schema.**
  - From 0027 to 0144 the result was step 13 with 2 rows, and processing was declared and applied.
  - The fresh judges' `resultEvidence.processing` says `"collected":2,"kept":2`, with the 2 rows in `sampleRows`
    (checked in 0036 and 0106).
  - So neither page diffs (W1), data-first retention, nor t1048 lost the cart rows. The schema went missing only
    because of F4's amendment at 0144.
- **Where the rows stopped.**
  1. **Read.** 0026 (c10): 2 rows, stored.
  2. **Run dataset and result feed.** Step 13's page, "2 rows over 1 page", until 0144.
  3. **After 0144.** The result is step 36 with 0 rows, and readiness is `missing-evidence`
     (`processing_schema_missing`).
  4. **The Stop (0151, `threw AbortError`).** The ending withholds instead of publishing when readiness is
     `missing-evidence` (`framework/automation-service/service/answer-first/attempt/ending.ts:51-55`). The result's
     rows are then empty, so `rowsOf` gives no `rows` (`attempt/keep.ts:80-81`).
  5. **The Lab.** It reads stored rows only from the attempt result's `rows`
     (`test-runner/src/attempt-lane/live/attempt/stage.ts:16-18`). With none it counts 0, and the panel has nothing
     to draw. `attempt-1/answer-turn.json` is `"kind":"stopped","columns":[],"rows":[]`, with the model's own table
     only as `text`. The screenshot shows "Stopped, as you asked. What I found so far is kept." and no table.
- **Comparison.**
  - The previous live run run-mwvgjb8c and t1064's provider-free run both ended `achieved`, so their results were
    published. The Lab says "2 rows stored, 2 shown" for run-mwvgjb8c. t1064's scripted run passed 4 of 4.
  - The difference is the ending: neither of them was stopped, and their results were in a ready state.
- **Whether that is the whole reason.**
  - For the 0 at the end, yes: F4 emptied the result just before the Stop.
  - For "it's not seeming to actually return the table": the table appears on the answer card at the end of an
    attempt. This attempt never reached an accepted ending (F1, F2), and when it ended its result had just been
    emptied (F4).
  - Not verified: whether the chat ever draws a live table of the result during an attempt. That would need the
    panel code or a live check.

### F6. Refusals turned into round restarts that wiped the decider's evidence (product, loop design; amplified by F1 and F2)

- **Evidence.**
  - 4 `answer_first.same_evidence` refusals without a judge call (0075, 0087, 0110, 0136). They are correct by
    design: nothing new had arrived since the last refusal.
  - They raised `near_repeat` to 5 `change_approach` round restarts (0089, 0113, 0120, 0125, 0140).
  - Each restart started a fresh request: 43 blocks at 0088, then 21 at 0091.
  - The `core.earlier_rounds` summary carries reads as counts only ("rows":15, columns), so the model had to call
    `core.recall_result` for c50 four times (0116, 0123, 0128, 0143). That set off the watcher's `repeated_call`
    alert at 0143.
  - The model's `finish_with_best` at 0112 became `change_approach` at 0113, which set off the watcher's
    `finish_not_ending`. It finished with the same result, and the refusal says `finish_with_best` is "only with a
    different result" (`framework/automation-service/service/answer-first/completion/refused-words.ts:51`).
- **Class.** Product. The loop is behaving as built, against a check that could not be satisfied.
- **Fix.**
  - F1 and F2 remove the cause.
  - Also: a round restart after a refusal should carry, whole, the reads whose rows the refusal says it could not
    see. The refusal's `lastCheck.reason` named "the 15-row result list". Carrying them avoids recall loops.

### F7. Stale "look" and "search" words in model text (product, guidance text; left over after W1, t1036)

AGENTS.md (2026-11-25) says there is no look command and no page search. These remain:
- `framework/automation-service/service/answer-first/completion/refused-words.ts:18` (`NEW_EVIDENCE`, in every
  refusal and round note): "after your acts a look at the page that shows what the check said it could not see (open
  that page, then read or search it there)".
- `refused-words.ts:51`: "go to where what the check could not see is shown, and look, read or act there".
- `runtime/answer-first/guidance/guidance.ts:24` (system prompt): "describing a control or searching the page never
  presses, types into or opens anything".
- `runtime/llm/evidence-loop-decision.ts:89`: "Core drafts the Flow from the steps that worked, leaving out looks".

The tool list itself is clean: complete, amend_draft, web_detect_repeating_structure, web_describe_element,
core_run_node, core_describe_nodes, core_recall_result, core_full_page, core_set_result_processing,
core_loop_decision, core_run_flow.

There is also a contradiction for the fresh judge. Its system text includes the decider's page-reading section ("The
page shown below your evidence is the page now ... never ask for it"), but a fresh judge is shown no page. The source
of that text was not traced.

**Fix:** reword these to the full-page and read vocabulary, and add the words to `scripts/check/model-text.mjs` so a
check fails on them.

### F8. Context spent on stale or duplicated page state (product, decision context; low impact on success, high on cost)

Request size by evidence kind (characters):

| Decision | Input tokens | Largest entries |
| --- | --- | --- |
| 0019 (early) | 53,933 | head 23k, c6 24.6k, c7 14.0k |
| 0088 (middle) | 87,543 | c6 24.6k, `core.route_state` x12 20.5k, `core.current_view` 14.8k, c14 14.4k, c10 8.8k |
| 0148 (late, round 3) | 61,547 | `core.current_view` 27.2k, `core.route_state` 20.5k, `core.flow_draft` 13.6k, `core.described_nodes` 12.5k |

The system prompt is 17k characters and the tools 15.7k in every request.

- **c6, the failed sort at 0014** (`output_not_observed`), carries a whole page view (24.6k characters). It stayed
  in every request until the round restart at 0089, 75 steps later. A failed act's page is never folded into the
  current view.
- **Each `core.route_state` update** repeats the page's whole control list (`state.page.controls`, about 2k
  characters) rather than what changed. All 12 are kept across rounds, even though a restart says "no page is
  carried".
- **`core.described_nodes`** (12.5k characters) is added at each round start.

**Fix:** fold a failed act's page into the view groups as a successful one is; send route-state controls as a diff;
drop route states of an earlier round.

### F9. The Lab's flow chart cannot be drawn for any live run (Lab; t1039)

- **Cause.**
  - Both chart writes pass the attempt bundle as the run directory: `run-attempt-command.ts:258` (in-attempt) and
    `:343` (end of run).
  - `readChartFlow` reads `<runDirectory>/steps` (`test-runner/src/flow-chart/read/chart-flow.ts:46`).
  - A live run writes its steps to `labRun.stepsDirectory` under `lab-runs/<date>/<run>/steps`
    (`run-attempt-command.ts:191`). Only a scripted run uses `<bundle>/steps`.
  - `listFolder` answers `[]` for the missing folder (`flow-chart/read/list-folder.ts`), `latestFlowDraft` answers
    `null`, and `writeFlowChart` returns "Flow chart: none written, the attempt never got a draft of a Flow".
  - `writeFlowChart` never throws, so the `.catch` at :258 swallows nothing. The line it returns is discarded.
- **Evidence.**
  - The only bundles in the lane with a chart are scripted runs that have a `steps/` folder (run-mwwvelrb,
    run-mwwwf7pb, run-mwwwr1ty, run-mwx9ale4, run-mwx9k3mi, run-mwx9mpt9).
  - The two live bundles (run-mwvgjb8c, run-mwy3btww) have none.
  - The Stop does not matter here: every live run fails the same way.
- **Fix.** Pass the steps directory to `readChartFlow` (a `stepsDirectory` member of `ChartRead`) at both calls, and
  log the line the in-attempt write returns.

### F10. Smaller things that made the run hard to follow (product or model behaviour; low impact)

- **0027 and 0028.** The model marked step 13 as the result. The answer was `ignored`, with
  `draft_amendment_undone` ("These amendments put the draft back exactly as it stood"), although it says
  `applied: 1`. The same edit then came back `already_so` (0030), which led to a `same_fix` loop and a loop decision
  (0031 to 0033). The feedback contradicts itself (the amendment check's undone rule; location not traced).
- **0014.** The sort by label failed (`output_not_observed`, 4 tries). By value it succeeded at 0018 after a robot
  check that cleared by itself (8,529 ms). The site's activity log shows `clear-robot-check`.
- **The model's choice was good.** It picked the right item at 0019 from the card's own "Pickup today" line, before
  applying the Today filter. It then spent 0043 to 0058 re-verifying with filters only because the check asked.

## The four questions, answered

**1. What the decider saw.**
- Early (0019): the whole page view of the sorted Pickup list. The first card's lines were t1112 "$1.28", t1118
  "4.5", t1120 "4.5 out of 5 Stars. 938 reviews", t1123 "Pickup today", and t1125 "+ Add".
- Rating and pickup lines are printed for every card. Holders show "Paper Towel Holder" in their names.
- Middle (0088) and late (0148): the model restated "$1.28, rated 4.5, pickup today" in every decision from 0019 to
  0150. The c50 rows came back through `core.recall_result` after each restart.
- The draft and its result read were the cart (step 13, 2 rows) until 0144 (F4).
- Stale words: F7. Stale or duplicated page state: F8.
- So yes, the model had everything it needed, and it acted on it at 0020.

**2. What the judge saw.**
- The table under F2 lists all 14 calls. Each check was a continuing judge that saw the evidence but whose reply was
  unreadable (F1), followed by a fresh judge that could not see it (F2).
- The fresh judges did not see rows with ratings, and they asked for the same missing evidence each time.
- "Same evidence" was handled as designed: 4 refusals with no judge call.
- There were so many judges because every check cost two calls, and the check could never pass.

**3. Rows.** F5: the rows stopped at the 0144 amendment (F4). The cause sits in t1037's `result` edit. Before that,
the right 2 rows were the result for 117 steps.

**4. Anything else.**
- The loop of refusals, restarts and recalls: F6.
- Contradictory amendment feedback: F10.
- `answer-unusable` steps: 0037, 0042, 0063 and 0072 to 0149 are the completion refusals (`judged_unsure` x6,
  `judged_no` x1, `same_evidence` x4, `processing_schema_missing` x1 at 0149).
- `recall_result` use: 4 identical recalls of c50, each forced by a round restart.
- The chart: F9.

## What changed and why

Two documents written, no code:
- `docs/working/language-driven-flow-loop-plan/debugs/run-mwy3btww-31d32e0d.md`, the debug file the Lab's guard
  requires;
- this report.

## Commands run and observed results

- `ls` and `cat` of the run directory, the steps index, `entry.json`, `watch-alerts.ndjson` and `watch-status.json`:
  151 steps; 2 alerts (`finish_not_ending` at 112-122, `repeated_call` at 143).
- Scratch scripts in the session scratchpad, run with `node <file>`, never `node -e`:
  - `summarize.mjs` (every step's decision text, tool call and result);
  - `parts.mjs` and `judgeshape.mjs` (request blocks and their JSON shape);
  - `tail.mjs` (`core.result` across decisions);
  - `where.mjs` (which block holds a string, relative to the last cache mark).
- `grep -o ... | wc -l` per judge request for "1.28", "4.5", "Pickup today", "938": the table under F2.
- `grep` of the request bodies for `tools`, `tool_choice`, `output_config` and `continuation`:
  - this run's decider and continuing judges have tools and no `output_config`, and the fresh judges have
    `output_config` with `standalone_after_unreadable`;
  - run-mwvgjb8c's decider and judge have `output_config` and no tools.
- Lab log lines 303-312: "Ended stopped_by_person, 0 rows stored, 0 shown ... judge 14".
- `attempt-1/answer-turn.json`: `"kind":"stopped","columns":[],"rows":[]`.
- `attempt-1/site.json`: `cart:5510204:pickup +1`.
- Reading the Core and Lab source files cited above at fluxiq 0.54.30 (shared Core `fxwork/!FluxIQ`, its
  `package.json` version line and version commit message 0.54.30).
- One `git log` was attempted to date t1038's integration. It was denied, and dates were taken from the
  page-diff-delivery plan's ledger instead: t1038 integrated at 0.54.20, t1037 at 0.54.25, t1048 at 0.54.27.

## Not verified

- No fix was written or replayed. Every proposed fix is unproven.
- Where the search grid's cards lose their list-item marking, so that the add names no item (F2, change 2), was not
  traced to a file.
- The source of the decider page-reading text in the fresh judge's system prompt (F7) was not traced.
- Whether the panel draws a live table during an attempt (F5) was not checked.
- The amendment check's `draft_amendment_undone` contradiction at 0028 (F10) was not traced to a line.
- Whether the oracle would have passed. It never ran. The site change matches the right item's variant, and that
  match is inferred from the URL `variant=5510204` of the $1.28 roll in the cart read.

## Open questions or contradictions

- t1065 is described as fixing 0060 and 0069. 0039 is the same `tool_call_unexpected` case. The 4 `content_prefixed`
  replies (0034, 0077, 0104, 0130) are outside t1065's described scope, but they fail for the same transport reason
  (F1).
- t1048 says "working reads go to the judge page by page with their rows". That holds only for reads that stay in
  the draft, while t1037's compose (integrated before t1048) drops every read that is not the result's. Run-mwvgjb8c's
  shape (both reads of the result list) is covered; this run's shape (the candidate list is not the result) is not.
