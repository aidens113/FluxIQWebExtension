# t1035: why a weaker model struggles in the build loop, measured

Worker report for the brief `briefs/t1035-agent-structure-audit.md`. Read-only analysis: no source edits, no git,
no Lab or paid run. Evidence: the five Haiku bigbox runs of 2026-11-24 under
`fxwork/recorded-evidence/t1015-bigbox/` (mwus396e, mwuuo3zk, mwuxd2v9, mwv5m906, mwveg5ls). Code read in the
shared Core checkout `fxwork/!FluxIQ` (detached at af7bfe2da, fluxiq 0.54.18, newer than the 0.54.9-0.54.16 the runs
used) and in this tree's `domain/src/runtime/llm-evidence/`. Measuring scripts: `test-runs/t1035/*.mjs` (ignored,
not committed); `audit.mjs` extracts every step to `audit.json`, the others print the tables below.

## Outcome

Short answers to the user's two questions:

- **There is no "look" tool.** A look is `core.run_node` with the node `web.output.dom-capture_snapshot`, which the
  catalog describes only as "Capture a structured DOM snapshot." The prompt and Core's notes say "look" 94 times in
  one late request (mwuuo3zk step 300) and never say which call that is. Core runs most looks itself: at each round
  opening and after each `core.run_flow`. The model asked for one only once on purpose, and three times called the
  node id as if it were a tool (`unknown_tool_refused`).
- **The model already gets the whole cleaned page with every decision.** `core.current_view` holds the latest whole
  page view, with no caps (3k-15k tokens on bigbox). It replaces the previous copy, and all 463 decisions had one. Every
  act that ran came back with the page after it. The trouble is around the page: (a) reading a list takes a separate
  detection call that issues a handle and CSS-derived field keys; (b) the page header and the tool text point the model to
  `find_on_page`; (c) in later rounds the page is 2-3% of a prompt of 150-310k tokens, and most of the rest is
  earlier rounds' read rows carried in full.

## 1. Where decisions go (463 decisions, 5 runs)

| Group | mwus | mwuuo | mwuxd | mwv5 | mwveg | Total | Share | Spend |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Looks and searches | 20 | 87 | 39 | 36 | 40 | **222** | 48% | $3.06 (47%) |
| - `web.find_on_page` | 7 | 31 | 14 | 33 | 24 | 109 | | |
| - `web.detect_repeating_structure` | 11 | 52 | 24 | 2 | 13 | 102 | | |
| - describe_element / recall / describe_nodes / capture | 2 | 4 | 1 | 1 | 3 | 11 | | |
| Reads (`dom-extract_list`) | 5 | 8 | 4 | 3 | 24 | 44 | 10% | $0.67 |
| Acts (click, type, check, select, next_page, navigate, run_flow) | 9 | 13 | 11 | 5 | 17 | 55 | 12% | $0.42 (6%) |
| Draft bookkeeping (amend_draft 44, complete 25, set_result_processing 11) | 4 | 15 | 11 | 24 | 26 | 80 | 17% | $0.93 |
| Loop machinery (`loop_decision`) | 1 | 9 | 5 | 2 | 15 | 32 | 7% | $0.69 |
| Unreadable replies | 1 | 10 | 11 | 0 | 3 | 25 | 5% | $0.73 (11%) |
| Node id sent as a tool | 0 | 0 | 0 | 3 | 2 | 5 | 1% | $0.06 |

What came of them: 158 looks answered, 25 reads that ran, **29 acts that landed (6% of decisions)**, 18 `run_flow`
replays, 16 amendments applied, 7 processing declarations. **116 refused by Core and 43 rejected by the tool (34%).**

Refusals by code (answer steps): `draft_unchanged` 28 (64% of the 44 `amend_draft` decisions), `already_answered` 26,
`provider_output_invalid` 25, `answer_first.judged_no` 16, `repeat_refused/failed` 14, `repeat_refused/changed_nothing` 6,
`unknown_tool_refused` 5, `processing_binding_missing` 4, `same_evidence` 4, `judged_unsure` 3, `repeat_refused`
(`same_draft` 2, `no_progress` 2, `near_repeat` 1), `processing_schema_missing` 2, `look_withdrawn` 1.
Tool rejections: `target_unobserved/handle_not_in_packet` 19, `column_not_in_detected_list` 7, `act_already_done` 7,
`answered_the_same_again` 7, `result_processing.invalid` 4, `recall.not_found` 2, `replay.unreproducible` 2, and one each
of `page_moved_since_packet`, `address_not_shown`, `option_not_offered` and `act_row_unclear`.

Spend in all: decisions $6.55, judges $1.29, chat $0.004, so **$7.84**.

## 2. What the model sees

**Page views.** Each decision gets `core.current_view`, the latest whole page (and the latest read rows as a held
group). Older copies become `core.view_reference` markers (`decision-context/current-view.ts`). A fresh round's
earlier calls carry `core.view_not_carried` in place of their pages (`answer-first/earlier-rounds/carried-step.ts`).
Pages arrive at round openings (15 Core looks, 5 of them the mwus396e rounds that never reached the model), after every
act (36 of 36 direct act steps that ran have `page.txt`), with every read result, and after each `run_flow` (18 Core
`.look` captures). Acting on a stale view: **effectively never**. The view's call id differs from the last captured
page in 120 decisions, but all except one of those are the `run_flow` result that carries its own look. Requests
hold one page, and three at most. The page view is whole: "321 elements with visible words or a control, in page order".

**Pulled perception is mostly redundant.** Of 109 `find_on_page` calls, **55 searched for words already printed in the
view in front of them** (30 of 31 in mwuuo3zk), and **33 found nothing**: words the model guessed from other sites, such
as "Next page", "Add to cart" and "Customer rating". Together that is 88 of 109 (81%) that added nothing. The page header ends
"find_on_page searches the rest", and Core's repeat note tells the model "First make the call that shows the handle:
look at the page ... or ... detect the list's repeating structure". Reads need detection first: 102 detections for 44
reads (2.3 each). Only 46 were answered; the rest were refused as already answered, repeats or stale handles. A
detection result is 5-14k characters, mostly `fields` keys such as
`ul_css-1ysgock_li_1_div_css-1n3n0dq_span_css-0ek4plr_currency_amount`, which the read must copy exactly.

**What a decision request holds** (tokens, calibrated per request from its own tokens/character):

| | First decision (all runs) | mwus396e last (one round) | mwuxd2v9 peak, step 217 |
| --- | --- | --- | --- |
| Input tokens | ~25.3k | 97.4k | 309.5k |
| System prompt | 5k | 6k | 7k |
| Decision schema (11-way `oneOf`; `amend_draft` alone 7.8k chars) | 6k | 8k | 9k |
| Flow bootstrap (66-node catalog, routing, start note) | 4k | 5k | 5k |
| Tool descriptions (9 tools) | 4k | 5k | 6k |
| Draft guide | 1k | 2k | 2k |
| Evidence | 4k | 71k | 280k |
| - of which the current page | 3k | 15k | 9k |
| - of which `core.earlier_rounds` | - | - | **212k** |

**What grows from 25k to 310k.** Earlier rounds' carried calls are 40%, 52% and 46% of all decision input tokens
(weighted) in mwuuo3zk, mwuxd2v9 and mwveg5ls. In those carried calls, `dom-extract_list` results (read rows, kept
whole) are 59-77% and detection results 5-33%. Pages are not carried. Inside a round the same kinds pile up: whole
read rows (16k characters each), detection fields (13k each), `route_state` entries (14 per run, 7-13k tokens), the
draft (up to 12k) and `described_nodes` (6k). The earlier-rounds fitting (`earlier-rounds/fitted.ts`) only summarises
past the model's window (`tokenBudget` 992,000), so here nothing was ever summarised. **Haiku costs five times as much
per input token above 100k** (`pricing.ts`): 247 of 463 decisions crossed it, and they cost **$5.93 of the $6.55**
spent on decisions (91%). Core's own notes average 3.5-5.8 entries per decision (up to 9, each with its own
`instruction`) but only 2-6% of the characters.

## 3. Handles

Of 136 uses of a page handle (`tN`), **38 (28%) named a handle that was not in the current view**, only in older
evidence. **All 38 failed**: 19 `handle_not_in_packet`, 13 repeats of that failure refused, 4 `answered_the_same_again`
and 2 `column_not_in_detected_list`. They cost $0.68 in decisions. In mwuuo3zk the model named `t1446` 20 times after a filter changed the URL.
That handle came from a detection at step 68 and sat in its draft, and the new page had numbered the same cards
afresh. Handles do not change when one page is captured again (`domain/.../stable-handles.ts`), but every new page
gets new numbers. Extraction handles (`extraction.N`) only ever appear in older evidence, by design: 25 reads with one
succeeded, and 15 failed (`column_not_in_detected_list` 4, `answered_the_same_again` 3, `page_moved_since_packet` 1,
node-as-tool 2, `changed_nothing` repeats 5).

## 4. Protocol load

- 9 tools; 11 decision shapes (`complete`, `amend_draft`, 9 tool calls); `core.loop_decision` with 4 choices; 13
  amendment kinds, of which 6 were used (`keep` 14, `take` 12, `add` 9, `drop` 6, `exploratory` 4, `repeat` 1); 4
  draft flags on `run_node` (`add` 64, `act` 7, `write` 2, `place` 1); 66 catalog nodes (20 of them web); `parameters`
  is an open object whose shape the model learns only after a node's first run.
- 28 kinds of evidence entry, 13 of them Core notes. 16 refusal codes and 12 tool-rejection reasons appeared. The
  Core source holds about 55 `llm_evidence_loop.*` and 37 `answer_first.*` codes.
- Instructions before any evidence: about 55k characters, or about 21k tokens (system 12.8k, schema 17k, tools 10.6k,
  bootstrap 10k, guide 3.9k).
- **The reply is a JSON string inside JSON.** The decision schema cannot be expressed in Anthropic's grammar (open
  `parameters`, more than 24 optional keys), so `models/providers/anthropic/schema.ts` falls back to `{"result_json":
  "<escaped JSON>"}` and nothing constrains the decoding. Result: 25 unreadable replies (5.4%), mostly the input of one
  tool under another tool's `toolId`. They cost **$0.73 and 4.65M input tokens**. Three judge replies were also
  unreadable and were asked again.
- **The schema changes mid-run.** Withdrawing looks cut the tool list from 9 to 2-3 tools **18 times** (10 episodes,
  67 decisions). Each change dropped the cache hit from 80-280k to 4-30k tokens, about **$0.74** of extra writes
  (estimated against the previous hit). Under withdrawal 11 of 67 replies were unreadable (16%, against 5% overall),
  6 of 9 in mwuxd2v9: the model asked for the withdrawn tool, and the narrowed schema rejected it.

## 5. Judging

22 judge calls (mwuxd2v9 7, mwv5m906 4, mwveg5ls 11) cost **$1.29, 16% of all spend** (26% in mwuxd2v9). Input ran
up to 480k tokens per call, because the judge continues the decider's conversation (`continues_the_decider`) and so
pays the >100k rate. **None accepted a result**: 16 no, 3 unsure, and one yes that was still refused `judged_unsure`.
**7 of 22 judged a state no different from the last judged no**, at about $0.41. Three were re-asks after an
unreadable judge reply. Four (mwuxd2v9 163 and 182, mwv5m906 81 and 94) followed a resubmitted completion with no act,
read, amendment or processing change since the last verdict, which `same_evidence` did not catch.

## Ranked structural changes

Ranked by expected effect on a weaker model, then cost. Size: S under a day, M one to three days, L more.

1. **Carry state, not transcripts, between rounds and calls.** Pass earlier rounds' calls through the same
   view-reference projection the current round uses. Read rows already live in the result feed and stay recallable
   by `core.recall_result`, and a later result replaces a detection's fields. *Removes:* 40-52% of input in the
   long runs, most of the >100k decisions ($5.93 of $6.55), and a page that is 3% of the prompt. *Risk:* the model
   loses rows it compares, so the result-so-far entry must show the rows held, compactly. *Rules:* nothing is
   dropped, only referenced, so it is not a cap ("fix the root cause"). The whole-page rule is untouched.
   *Size:* S-M (Core `answer-first/earlier-rounds`, `decision-context`).
2. **A read is one call that keeps every field.** Fold detection into the read node: target a handle, or the page's
   largest list, and keep all fields; the data layer filters. *Removes:* 102 detections (22% of decisions), 56
   refused or failed detections, 11 field-key rejections and 13k-character field lists. *Risk:* bigger read results,
   offset by change 1. *Rules:* this is the user's 2026-11-20 rule "extraction keeps every column", not yet built.
   *Size:* M-L (domain `structure`, `node-run`; Core draft step shape).
3. **Native tool calls instead of a JSON string.** Use one provider tool per action, so the provider validates the
   call shape and a reply cannot be off-shape. *Removes:* 25 unreadable replies ($0.73), 5 node-as-tool calls, 3 judge
   re-asks, and the extra failures under withdrawal. *Risk:* Core is provider-neutral, so the DeepSeek adapter needs
   the same mapping. *Rules:* none touched. *Size:* M (Core `models/providers/*`, decision reading).
4. **Keep the offered tool list fixed.** Withdraw a look by answering it ("act first"; the `look_withdrawn` backstop
   already exists), not by changing the schema. *Removes:* 18 cache breaks (~$0.74) and the 16% unreadable rate under
   withdrawal. *Risk:* none new; the t193 redirect stays binding through the refusal. *Size:* S (`look-withdrawal.ts`).
5. **One account of perception.** Tell the model that the page below is the page now and is refreshed after every
   act. Stop saying "look", or name the current view as the look. Take `dom-capture_snapshot` off the model's node
   list (Core already looks). State in the page header exactly what search adds (hidden text, attributes), and answer
   a search for words already in view by pointing to their lines. *Removes:* most of the 88 searches that added
   nothing, plus node-as-tool calls. *Rules:* keep `find_on_page`, since the user asked for page search by any text or
   attribute; removing it needs the user's say-so. *Size:* S (instructions, page header, tool text; check
   "never teaches to the test").
6. **Handles that survive page changes, and drafts that name controls.** Match a control across pages of one site by
   the fingerprint `stable-handles.ts` already uses within a page. Re-resolve a stale handle by identity, which the
   2026-10-28 rule already requires on retries, and show draft steps by control words, not `tN`. *Removes:* 38 stale
   handle failures and 13 repeat refusals ($0.68), and the `t1446` fixation. *Risk:* false matches, so an ambiguous
   match must still be refused. *Size:* M-L (domain `stable-handles`, `plan-resolution`; Core draft view).
7. **No judge on an unchanged state.** Refuse a completion resubmitted with no change since the last judged no (acts
   landed, rows held, processing, draft) without calling the judge, and repeat that judge's reason. Read the judge's
   reply through change 3. *Removes:* 7 of 22 judge calls (~$0.41) and judge input over 100k once change 1 lands.
   *Rules:* the judge still sees the whole run (2026-11-19), on the same model, and the task still ends only with its
   result or its budget. *Size:* S (Core `answer-first/completion`).
8. **A smaller draft grammar for the first attempt.** Offer `add` on the call and `take`/`drop`, and keep the other 10
   amendment kinds (7.8k characters of schema) for repair. Further out, the framework could compose the Flow from
   what ran. *Removes:* most of the 28 amendments that changed nothing, and schema load. *Rules:* trimming touches
   none. A framework-written Flow touches "build the whole Flow first", "flows authored as general structure" and
   "recording is evidence, not a script", so it needs the user's decision. *Size:* S to trim; L to have the
   framework write the Flow.
9. **Trim the fixed load.** Offer the web nodes and control flow, not 66 nodes including database, math and random.
   Send the page, draft and notes as plain-text blocks rather than escaped strings inside JSON: tokens per character
   rise from 0.37 to 0.53 as escaped content grows. *Removes:* part of the ~21k fixed tokens. *Size:* S.

Changes 1, 4 and 7 are small and independent, and change 1 alone covers most of the spend. Changes 2, 3 and 6 are
the structural fixes for a weaker model's error rate.

## What changed and why

Only this report and the ignored scripts under `test-runs/t1035/`. No source, no shared document, no git.

## Commands run and observed results

- `node test-runs/t1035/audit.mjs` printed "wrote run-mwus396e: 40 decides; mwuuo3zk: 142; mwuxd2v9: 81; mwv5m906: 73;
  mwveg5ls: 127". Four final decide folders without `meta.json` (runs stopped mid-call) were not counted.
- `node test-runs/t1035/summary.mjs decisions|refusals|tokens|cache|pages|handles|judges|composition` printed the
  tables above.
- `node test-runs/t1035/finds.mjs` printed `{ n: 109, inView: 55, zero: 33 }`, and `stale.mjs` and `er2.mjs` printed
  the view-staleness and earlier-rounds breakdowns quoted above.
- Python one-offs on `audit.json` gave the spend by group, the cache-break estimate, the >100k counts, the judge
  deltas and the unreadable-reply misses.

## Not verified

- The Core code read is af7bfe2da, newer than the code the runs used. Mechanisms are described as they read now.
- The token split by section is estimated from character shares of each request, not tokenised.
- The cache-break cost is a counterfactual estimate.
- "Already in view" is a case-insensitive substring match against the current view's strings.
- mwveg5ls has no debug in this tree, so its stop reason was not cross-checked.
- None of the proposals was prototyped or measured offline.

## Open questions or contradictions found

- The page view counts as "whole" under the user's rule, yet its header says "find_on_page searches the rest". What
  search adds should be stated exactly.
- `fitted.ts` sizes earlier rounds against the model's 992k window, so it never acts under the 100k price tier.
  Change 1 is the structural fix. Lowering the budget would be a cap.
- mwv5m906 step 94: a judge **yes** was refused `judged_unsure`, which may need a look by the completion owner.
