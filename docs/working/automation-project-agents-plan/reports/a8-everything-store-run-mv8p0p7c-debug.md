# A8 wave 3 debug: everything-store plus-earbuds-under-50, project mode, run-mv8p0p7c-c8412344

Read-only. Downstream `ad8ec315`, Core `8d6239a8`, which is the pair the Lab ran (`fxwork/t567/!FluxIQ` HEAD is `8d6239a8`; main Core checkout `309dee11` differs only in docs). No model provider was called. Page data quoted here is limited to product names, prices, ratings and product ids.

## Outcome

Done. **The Flow was right from the first assembly.** Rows came out right on the whole test, and the judges are what failed it. The assembled candidate (revision 1) stored exactly the oracle's 13 records in the oracle's order, and I checked it by product id against `PLUS_UNDER_FIFTY_WORKFLOW` computed from the built catalog. It is the same 13 ids that passed on the candidate run `run-mv8n3lu0-ee3b3ca3`. Three of the four whole-test judge calls said no, and all three were wrong. Core accepts a no without checking it against its own record, so the false double no at 0050/0051 refuted a correct Flow. The supervisor then followed that wrong reading. It sent a repair, amended the plan to add a `dedupe_and_order` subflow that has no node to run on and no defect to fix, and ran out of the 25-minute work window. The person was told only that the old candidate's test "was judged not to do what you asked". The time limit went unmentioned.

## Timeline (UTC, step numbers from `steps/`)

| Time | Step | What happened |
| --- | --- | --- |
| 22:43:42 | 0001 | Chat instruction; build starts (work deadline = 30 min − ending margin, hit at ~25 min). |
| 22:43:51 | 0004–0006 | Plan with one subflow, `collect_earbuds` (parts p1, p2). Brief-1 dispatched. |
| | 0025–0027 | Rev 1: 15 rows (two accessories kept: ear tips B0JKYDKPGR, charging case B0W5X5HSU9). Judged no twice. **Correct.** |
| | 0031–0033 | Rev 2: 10 rows (a "Charging Case" name condition dropped three earbuds sold with a case). No twice. **Correct.** |
| 22:48:08 | 0037–0040 | Rev 3: 13 rows = oracle. 0038 yes but held by Core (no quotes) → 0039 recheck yes, accepted; 0040 confirming yes, accepted. **Trial yes. Correct.** |
| 22:48:23 | 0043 | Assemble: candidate rev 1 (root → Call Subflow `collect_earbuds`). |
| 22:49:22 | 0045–0047 | Whole test 1: same 13 rows. 0046 **no (wrong)**, 0047 **yes (right)** → `candidate.trial_unconfirmed` (unsure). |
| 22:50:31 | 0049–0051 | Whole test 2: same 13 rows. 0050 **no (wrong)**, 0051 **no (wrong)** → `candidate.trial_judged_no`; "This exact Flow cannot be tested again". |
| 22:50:41 | 0052–0096 | Supervisor repairs `collect_earbuds` (brief-2) to "dedupe by product id and exclude accessory bundles". Rev 3 of the repair stores the 13 oracle rows again (deduped by sku). Trials: 0080 unsure (one false "unknown"), then 0085 and 0091 `not_judged`: 8 yes calls, Core held them for missing row-local quotes. Retests run out. The brief ends partial. |
| 22:56:16 | 0097–0098 | Supervisor `amend_plan`: adds `dedupe_and_order` (inputs/outputs `earbuds`, after `collect_earbuds`) and changes p2's goal facts, which drops `collect_earbuds`'s accepted proposal. |
| 22:56:18 | 0100–0159 | Brief-3 rebuilds `collect_earbuds` from scratch. It gets a 13-row yes at 0137 after two `not_judged`. Brief-4 `dedupe_and_order` is blocked: scope refused (input unread), then `part_interface_invalid` with no message, then the same script three times → `repeat_refused` ×3 → `evidence_repeat_without_progress`. |
| 23:03:13 | 0160–0200 | Supervisor sends brief-5, a repair of `collect_earbuds` against the old candidate receipt `trial.0c8cac95…`. It reaches 13 rows again (0186, 0192 `not_judged`, held for quotes). The 4th trial (0197) is cut by `TimeoutError` at 23:08:47 (work deadline). |
| 23:08:47 | — | `build end ms=1503377 status=draft`. Chat: "Its test run from the start was judged not to do what you asked, so nothing was put into the Flow. I kept what I wrote as a draft." Lab verdict failed, `flowCreated: false`, $0.1279. |

The 13 oracle rows were produced on 10 separate trials (0037, 0045, 0049, 0080, 0085, 0091, 0131, 0137, 0186, 0192). I checked each one's stored ids against the oracle from its judge request: all identical.

## (1) Why the whole test held what the subflow trial accepted

**The evidence was the same, and the verdicts were not.** I diffed the user payload of the subflow-trial judge (0038) against the whole-test judges (0046, 0050):

- **Record sets:** identical. Same 13 rows, same `processing` (15 collected, 2 duplicates, 13 kept), same `keptPerPage` `[3,5,5,2,0]`.
- **`reads`:** identical except node-id prefixes. t574's Call Subflow matching worked in the whole run. The read under Call Subflow carries its authored conditions numbered and worded ("condition 1 (sponsored is absent)" … "condition 7"), `valuesRead`, the presence statement and the paging record.
- **t599's settled rows:** present and identical. Conditions 1–4 each carry `leftOutSettled` and the `settled` sentence (presence/absence for 1–2, numeric for 3–4).
- **Row ids:** none in either payload (`[row …]` count 0). That is correct. Conditions 5–7 had `alone: 0`, so no row needed naming. Ids appear only where a judge must name a row: in brief-2, condition 5 alone left out 2 rows, which carried `[row M2P7E2]` and `[row W8B3N2]`.
- **Differences:** only the instruction framing (subflow: "Judge only whether it did these parts…" plus the builder's success check; whole: the generation goal, same words) and the `runId`.
- **Same request, opposite answers:** 0046 and 0047 are byte-identical requests (temperature 0, thinking disabled) that answered no and yes. 0050 and 0051 are byte-identical to each other and both said no. So the hold is judge non-determinism on unchanged evidence. Over this run's correct-row trials the judges said no or unknown 4 times out of roughly 30 calls. Two of those landed on the whole test, which needs two concurring yeses and refutes on two concurring nos (`result-verification/agreement.ts:136-163`).

**Root cause 1 (Core): a no is taken at face value.** `result-verification/verdict.ts:205-223` builds the refutation from the no's prose. It attaches `checked` lines but never tests the no's factual claims against Core's own record. `agreement.ts:147-163` lets two such nos refute, and `bothReadings` (`agreement.ts:389-429`) marks a reading contradicted only for pages (t501) or order (t511). A yes, by contrast, is held unless it quotes the request word for word beside each row. Every wrong no in this run made a claim that Core's own record refutes:

- **0046:** says page-5 rows "Aurelle Pods Fit … Sage" ($49.99, 4.8) and "Tessaro Arc Lite … White" ($24.99, 4.1) qualify "with Brightaisle Plus" and were dropped because a cookie layer covered them. Both are **sponsored ad slots** in the end view (`t449/t480 "Sponsored"`, `sspa/click?adId=`), and neither shows a Plus marker (catalog: `plus: false`, B0PXG323U8 and B0TSARCLW1 are in `ads`). Core's read saw both on page 5 and left them out by conditions 1 and 2, which Core settled. "Covered" is not a read defect: the read reported 94 seen and `stop: ended`.
- **0050/0051:** say B0VNKJTVCD ("… Ivory") and B0HKSZ2BM6 ("… Ivory with Wireless Charging Case") are "the same pair" and that the second is an accessory. The stored rows differ in name and in url, and they are two oracle records (catalog `kind: "earbuds"`, both Plus, $39.99, 4.4). 0081 (repair) made the same claim as "share the name", which is false: the names differ.

## (2) Verdict on each judge, guard and refusal

| Step | Rows | Judge said | Against oracle | Core did |
| --- | --- | --- | --- | --- |
| 0026, 0027 | 15 | no (accessories kept) | right | refuted, right |
| 0032, 0033 | 10 | no (three earbuds with case dropped) | right | refuted, right |
| 0038 | 13 | yes | right | held: no quotes for conds 1–4 (false hold, recovered) |
| 0039 (recheck), 0040 | 13 | yes, yes | right | trial yes, right |
| 0046 | 13 | **no**: sponsored, non-Plus page-5 ads "qualify"; cover theory | **wrong** | split → unsure |
| 0047 | 13 | yes | right | accepted |
| 0050, 0051 | 13 | **no**: two distinct listings "same pair"; bundle = accessory | **wrong** | refuted (wrong); "cannot be tested again" |
| 0075, 0076 | 10 | no | right | right |
| 0081 | 13 | **unknown**: "two kept rows share the name" | **wrong** | → unsure with 0082 yes |
| 0082, 0083 | 13 | yes, yes | right | 0083 held (elided quote) → unsure |
| 0086–0089, 0092–0095 | 13 | yes ×8 | right | **held**: `exclusion_evidence_missing` → `not_judged` ×2 (false hold) |
| 0116, 0117 | 0 | no | right | right |
| 0126, 0127 | 10 | no | right | right |
| 0132–0135 | 13 | yes ×4 | right | held → `not_judged` (false hold) |
| 0138–0141 | 13 | yes | right | trial yes |
| 0181, 0182 | 10 | no | right | right |
| 0187–0195, 0198–0200 | 13 | yes | right | held → `not_judged`; 0197 timed out |

I replayed the yes-hold offline: Core's own `automationStudioResultLeftOutRowsUnquoted` from the Lab's Core dist, run over each recorded request and reply. It reproduces every hold above. Accepted: 0039, 0040, 0047, 0089, 0095. Held: 0038, 0086, 0088, 0092, 0094, plus the rechecks 0087 and 0093. **Root cause 2 (Core): the row-local quote rule holds correct yeses.** Two causes, both measured:

- **Elided quotes are refused.** 0083, 0087 and 0093 quote `"Leave out ... accessories such as ear tips or charging cases"`. `wording.says()` returns false because the words do not run word for word (`request-rows/unquoted-rows.ts:120`). The same quote with the elision removed, `"accessories such as ear tips or charging cases"`, returns true.
- **Quote and row in different fields.** 0087 names `[row M2P7E2]` and `[row W8B3N2]` in `observed` and quotes the request in `summary`. `replyText` joins the fields with `\n` (`verdict.ts:252-255`), and a quote is lent only within the same line (`unquoted-rows.ts:70-73`). Even with the elision fixed, 0087 is still held.

**Why brief-1 passed and the repair did not:** in brief-1 each accessory failed two name conditions (conditions 5–7, `alone: 0`), so no row-local quote was required. The repair merged the exclusions into one condition, which left those 2 rows out "alone", and from then on every yes needed a row-local quote that the judges gave only about half the time.

**Guards and refusals:**

- `llm_evidence_loop.already_answered` (0064, 0066, 0107, 0113, 0149, 0178): right. They were repeats of answered detection or submission calls.
- `flow_bootstrap.evidence_completion_parameters_unresolved` (0060, 0174): not examined in depth. The next submission was accepted both times.
- `web.action.rejected.target_unobserved` (0119): benign. Recovered at 0121.
- `subflow.scope_refused` / `subflow.input_unread` (0151): right, and the message was given. The script re-read the page and never read `$input.earbuds`.
- `flow_script.part_interface_invalid` (0153): the refusal was right but arrived with **no message**. That is root cause 4 below.
- `llm_evidence_loop.repeat_refused` ×3 (0155, 0157, 0159): the guard worked as designed. The builder had nothing to correct by, so the guard ended the brief.
- `project.dispatch` accepted brief-5's repair against the superseded plan's candidate receipt (`dispatch-tool.ts:215-220`: the rev-1 candidate is still "latest" after `amend_plan`). Legal, but stale. Recorded, not a root cause.

## (3) Why the supervisor amended, and why `dedupe_and_order` was blocked

**The amend.** At 0097 the supervisor reasoned from the refuting double no (0050/0051, forwarded as `failingTrial.judge`): "the judge found the same pair listed twice (name-based dedupe) and an accessory bundle kept". It read brief-2's partial ("Core could not confirm, missing exclusion evidence") as a structural problem and split dedupe into its own subflow "so … provable". This went against brief-2's own return, which said the judges answered yes and none said no, and the trial instruction "The judges accepted the rows this subflow kept: do not rewrite it". **Root cause 3:** the wrong refutation from root cause 1 carried through to the plan. The supervisor had no Core finding that the double no's claim was false. The amendment also changed p2's `goalFacts`, which dropped `collect_earbuds`'s accepted proposal, so it had to be rebuilt (brief-3, about 7 minutes).

**The block.** `dedupe_and_order` has no defect to fix. The answer is already deduped: Core's run-end whole-row dedupe plus the read's `process.dedupe`. It also has no node to run on. The catalogue has `builtin.data.filter-list` and `write-records` but no dedupe over an input list, and the builder tried to re-read the page (0150) and then to point `web.output.dom-extract_list` at `{"handle":"$input.earbuds"}` (0152). **Root cause 4 (Core feedback):** 0153's refusal `flow_script.part_interface_invalid` reached the builder as code, path, step, label and line, with no sentence. `flow-bootstrap/plan/issue-feedback.ts:254` keeps a message only for `AUTHORED_CODES` (`issue-feedback.ts:95-185`), and that code is not in the set. Its sentences are Core's own: `script-statements/called-parts.ts:88`, "declares an input or output of a block no step calls …", and `authoring/assemble.ts:379`, "The output … could not be read: …". The result's `next` even says "correct that step, where each issue says", but no issue said anything. The builder resubmitted the same script three times, and the repeat guard ended the brief: blocked, `evidence_repeat_without_progress`.

## (4) How the build ended, and what the person was told

The supervisor's work signal fired at about 25 minutes, during brief-5's 4th trial (0197 `TimeoutError`, 70 s). `supervisor-loop.ts:221` computes `timedOut`, so the recorded ending is "The build reached its time limit of 30 minutes before a whole trial passed" (`supervisor-loop.ts:236-237`). Because an assembled candidate existed (rev 1 of the old plan), `service/project-build/run.ts:197-215` saved it as a draft and returned only its standing trial (no). The time-limit words (`timeLimitWords`, `run.ts:203`) are built only on the no-candidate branch (`run.ts:198-205`). `conversations/commands/create-here.ts:75` then wrote the chat line from that trial alone (`commands/build.ts:39-55`). **Root cause 5 (honesty of the ending):** the person was told a correct Flow "was judged not to do what you asked". Nothing said the build ran out of time, that the plan had been changed, that the new plan never assembled, or that one subflow was blocked.

## Recommended fixes (generic; no scenario's task, site, products or answer in any model guidance)

1. **Hold a no to Core's record, as a yes is held** (`result-verification/agreement.ts`, `verdict.ts`). Extend t501/t511/t515's contradicted-reading marks plus one re-ask with two generic checks:
   - (a) A no or unknown that names a row as qualifying-but-missing, where Core's read saw that row and left it out by a condition Core settled (presence, absence or numeric, `value-readings/settled-rows.ts`), is marked contradicted with the settled value.
   - (b) A no or unknown that calls two stored rows duplicates, the same item, or sharing a name, where Core's stored values for them differ, is marked contradicted, naming the differing columns.

   In both cases the call is asked once more with Core's record, and its new answer takes its place. A double no with such a reading is not a refutation until re-asked. Core-only words, no task content.
2. **Accept an elided quote whose pieces each run in order in the request, and pair a quote across the reply's fields** (`request-rows/unquoted-rows.ts:70-73,120`, `request-wording.ts`). Split a quotation on `...`/`…`. It counts when every piece is word for word in the request, in order, and the pieces carry own-words. Treat the joined `observed` and `summary` text as one accounting scope for a row named by its `[row id]` in one field and quoted beside its condition in another, or else ask in the recheck words for one sentence per row. Add the offline replay of steps 0038/0083/0086–0095 as a regression test (requests and replies are on disk; the check is pure).
3. **Give `flow_script.part_interface_invalid` its sentence** (`plan/issue-feedback.ts:95-185`). Both of its messages are Core's own and quote at most 60 characters of the model's own text, the same as the route codes already listed. Add a test that every `scriptStatementRefusal`/`authoringError` code under `flow_script.*` is in `AUTHORED_CODES` or has a detail sentence, so no refusal reaches a model bare.
4. **Say the time limit when a draft is kept** (`service/project-build/run.ts:197-215`, `conversations/commands/create-here.ts:75`). Carry `outcome.timedOut` and the recorded ending onto the draft result. The chat should say the build stopped at its time limit, which plan the kept draft belongs to, and what its last whole test said. The draft wording alone should be kept only for a build that ended on that test.
5. **Plan amendments.** Refuse or warn on an `amend_plan` whose new subflow's only parts are already answered by an accepted proposal. Name the supervisor's evidence for the change, e.g. "the latest whole test's no was contradicted by Core's record" once fix 1 exists. Do not drop an accepted proposal whose own parts' text is unchanged when only another subflow's facts moved. This is supervisor guidance in Core's words, with no mention of dedupe or this task.

## Commands run and observed results

- `git -C !FluxIQ log 8d6239a8..HEAD`: one docs commit. `git -C fxwork/t567/!FluxIQ log -1`: `8d6239a8`. `git diff --stat 2d675cb2 8d6239a8 -- …/result-verification`: empty, so the dist I replayed matches the run's source for that module.
- `node oracle.mjs`: 13 records, scenario-lab dist; the source file's only change since the build is a `recordingDescription` line. The stored ids of 0038, 0046, 0050, 0081, 0086, 0092, 0132, 0138, 0187, 0193 and 0198 each `== oracle` → True. Page-5 items: B0PXG323U8 `plus false` in `ads`; B0TSARCLW1 `plus false` in `ads`.
- `node check.mjs 0038 … 0095`: replays `automationStudioResultLeftOutRowsUnquoted` from the Lab's Core dist on the recorded requests and replies. The held and accepted sets match the observed trial outcomes.
- `node says.mjs`: `wording.says("Leave out ... accessories such as ear tips or charging cases")` → false; without the elision → true. 0087 is still held on condition 5 after the elision fix.
- Python diffs of the judge requests: 0046 = 0047 and 0050 = 0051 byte for byte; 0038 vs 0046 differ only in instructions, node ids and runId.

## Not verified

- Which of the two `part_interface_invalid` sentences 0153 hit: the message was withheld, and I did not re-run the parser.
- Why `evidence_completion_parameters_unresolved` fired at 0060 and 0174.
- The supervisor's prompt wording that led to the amend: I read its decision and inputs, not the whole system prompt.
- Whether fixes 1 and 2 would have flipped 0046, 0050 and 0051: those are model answers, so the effect is not measurable offline.
- Lab UI screenshots: not reviewed.

## Open questions or contradictions found

- At temperature 0, identical judge requests (0046 and 0047) gave opposite verdicts. The two-call design assumes independent samples. In practice the second call is often a cache hit on the same prompt and still disagrees, so the agreement rule is weighing noise.
- The trial instruction says "The judges accepted the rows this subflow kept: do not rewrite it", but the supervisor is shown the earlier whole test's refutation as authoritative. The two Core messages pull in opposite directions, and nothing reconciles them.
