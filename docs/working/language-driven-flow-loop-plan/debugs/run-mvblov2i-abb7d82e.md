# Debug: run-mvblov2i-abb7d82e

- Instance: a8-slot-2, task `bigbox-retail-pickup-towels`, authoring mode `project` (cost round, 2026-10-16, downstream `a835db3b` / Core `8ac92ef1`, after Core t671-t684), lane tree `fxwork/t565`.
  Steps: 304. LLM calls: 79 (1 chat, 67 decisions, 11 judge calls), $0.110 of $0.25 at the off-peak rate.
- Verdict: **failed** (`runtime.behavior`, the Flow's own `output_not_observed` / `core.result.does_not_answer_request`). The Flow was created on a judged yes that was wrong. Playback stored 12 rows; the oracle expected 9. All 9 were present, plus 3 extra rows, and only 1 was in the expected position. The playback result check correctly said no twice. The result repair then spent 48 decisions and $0.080 over 15 minutes and applied nothing.
- Cause: a product defect in Core's judge agreement, not machine load. Revision 2's trial got two "no" answers. One "no" was right ("sponsored rows were stored"), but Core sorted it as a complaint about a filter step because its sentences mention a filter next to words like "excludes" and "drops". Core then asked that judge again with a recheck about filter steps only, and the second answer, "yes", replaced the first. The other no was re-asked the same way, and the two "yes" answers counted as a pass (`unsure-doubts/narrowing.ts` + `narrowing-no-reask.ts`, t666). Two things had already gone wrong before this. Revision 2 dropped the correct `sponsored is absent` condition because the builder followed one judge's advice, even though that reading came labelled "contradicted by Core's record". And no judge noticed that the site's separate Pickup and Today filters do not together mean "pickup today".
- Next: Core fix 1. A re-ask's answer may replace a "no" only when Core has settled every reason that "no" gave (below). Core fix 2. Core's recheck text must stop saying a filter step "matches the request" just because the option's words appear in it. Then rerun this task in the next cost round.

## Detail

### 1. How far it got, and where it failed

| Stage | Steps | Outcome |
| --- | --- | --- |
| Plan and dispatch | `0002`-`0008` | One subflow `find_paper_towels`, one brief. |
| Exploration | `0009`-`0027` | Search page opened, 3 overlays dismissed, 4 filters chosen (Retailer ValueRidge, Fulfillment Pickup, Speed Today, Customer Rating 4 & up), list structure found. |
| Revision 1 + its test | `0028`-`0033`, judges `0034`-`0038` | The read used `sponsored is absent` + `rating atLeast 4.5`. 12 rows, including a towel holder. Judged **no**. Correct, because the holder is not a pack. |
| Revision 2 + its test (the judged whole run, t679) | `0039`-`0042`, judges `0043`-`0046` | The read used `name contains "Paper Towels"` + `rating atLeast 4.5`, with the sponsored condition and field removed. 12 rows. Judged **yes**. Wrong. |
| Completion | `0047` (builder), `0048` (supervisor) | Flow created at 23:35:00, build cost $0.027. |
| Playback | `0049`-`0061` | 2 pages read, 16 rows collected, 12 stored, the same rows as the trial. Playback did **not** differ from the trial. |
| Playback result check | `0062`, `0063` | Both **no**: "the read kept Tidemark Paper Towels, 12 Mega Rolls … which the endView marks Sponsored". The verdict was refuted, which is correct. The t677 first-ask flag had correctly not marked the build's yes as first-ask, so the playback hold did not override these two "no" answers. |
| Result repair | `0064`-`0304` | 48 decisions, 3 dry runs, never judged. It ended `flow_bootstrap.build_not_finished` at 23:50:02 and applied nothing. |
| Oracle | `evaluation.json` | expected 9, observed 12, matchedInAnyOrder 9, matchedRecords 1, so the run failed. |

### 2. Why: the judged yes was wrong. Playback matched the trial, and the oracle read only what the Flow claimed

The 3 extra rows against the expected 9 are the same 3 that the frozen pair 8 passing runs left out: **Tidemark Paper Towels, 12 Mega Rolls** (sponsored), **Northmere Paper Towels, 12 Rolls** and **Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls**. Northmere's own card reads "Pickup tomorrow" / "Delivery today". Its card in that view also reads "Sponsored", but revision 1, which had the sponsored condition, still kept Northmere, so that condition alone would not have removed it. Softerra 8 Triple was kept by the repair's own read, which had a Pickup filter but no Today filter. The position errors come from dedupe by name, which kept the first copy, and that was often the sponsored card near the top.

Both passing runs kept `sponsored is absent` **and** `name contains "Paper Towels"`, and they also tested the card's own "Pickup today" text (`pickup contains "Pickup today"`). This run never read that text.

How the wrong "yes" came about:

1. **Revision 1 to 2: a correct condition was dropped.** The no feedback the builder received (`0039` request) carried judge call 1 (`0037`). Its advice: "the read must not treat a sponsored tag on a qualifying pack as excluding it". The label on it said "contradicted by Core's record: … another copy of it was kept". The builder still followed it: "keep only paper-towel packs by name, **drop the sponsored condition**" (`0039`). This is the t641/t652 pattern again: labelling the reading did not stop it. The kept-condition gate (`result-verification/standing-no/kept-conditions.ts`) did not keep the condition either. That condition left out 5 rows by itself, and Core's record accounted only for the 2 that the judge named as copies, so no `keptOut` was recorded. The other 3 rows are sponsored-only rows that only the page's label marks, and t651 does not count a label test as a measurement. This is inferred: the `standingNo` record is not written to the run files. The noise in the labels made it worse. Judge call 2 (`0038`) was marked as "contradicts part" for saying the brushed-steel holder was "left out only by rating", which is exactly what Core's own record says.
2. **Revision 2's verdict was turned around.** The first two calls both said no: `0043` claimed the 4 & up filter dropped rows, which Core showed false (16→16), and `0044` said sponsored rows were stored, which is true. `automationStudioResultNarrowingNoBlamed` (`unsure-doubts/narrowing.ts`) counts a sentence as blaming a step whenever it contains a word like *excludes* or *drops* and names a step. `0044`'s sentence says the 4 & up filter is "redundant but not harmful", but it contains "excludes" and "drops", and its sentence about holders names a row "ValueRidge Essentials …", which matched the Retailer option "ValueRidge". So Core decided `0044` "blames only such steps" and re-asked it (`0046`) with a recheck about steps only. The header of `narrowing-no-reask.ts` promises a re-ask only where a no "blames **only** such steps". The code only checks that every step it found is a request-words step. It never checks that the no gave no other reason. The re-asked calls answered yes (`0045` even said "Sponsored rows … were not kept", which is false). Revision 2 no longer read a sponsored field, so Core had nothing to check that claim against. Two yeses made it **yes**.
3. **A clause gap that no judge caught.** Even with the sponsored condition kept, revision 2 would have stored 11 rows, because Northmere and Softerra 8 Triple pass the Pickup facet and the Today facet separately. The narrowing recheck Core sent made this worse: "chose 'Pickup' … and the request itself says 'Pickup'", "chose 'Today' … and the request itself says 'Today'". Core vouched for two independent facets because each option's word appears in the request, but together they do not mean the request's single clause "ready for pickup today".

### 3. Relation to this session's Core changes (t671-t684)

- **Not the cause.** The faulty re-ask is t666 (`narrowing-no-reask.ts`, the previous session). The dropped condition comes from the t641/t652 labelling and the t651 rule that a label test is not a measurement.
- **t679 (single-path test): interacts.** Revision 2's trial yes was the judged whole run, so `0047`/`0048` completed the Flow on it directly. Before t679, a separate whole-Flow judged run would have asked two more calls first. The playback check's two calls (`0062`/`0063`), on the same rows, both said no without blaming a step. So the extra run would probably have caught it, but only by chance. The real fault is in the agreement.
- **t677 (first-ask flag): worked correctly.** The yes was not first-ask confirmed, so the playback double no was not held and the run was not recorded as passed.
- **t671, t672, t673, t676, t683 (carried proposals, unread inputs, same-page asks, done-before, held ending): not involved.** There was one brief, the supervisor took 4 decisions, and no ending was held.
- **t684 (reset of in-part acts): not involved.** The task only reads. The trials started with `startHook: ran` and nothing was absorbed.

### 4. Where the 67 decisions went

- **Build: 19 decisions, $0.018, plus 9 judge calls, $0.009.** The supervisor took 4 (`0003`, `0005`, `0007`, `0048`). The builder took 15:
  - 9 exploring (`0010`-`0026`);
  - 2 submissions of revision 1, the second rejected as `candidate.unchanged_submission` (`0030`, wasted);
  - 1 test;
  - revision 2's submission, its test and the completion.
  - The build was lean.
- **Playback check: 2 judge calls, $0.003.**
- **Result repair: 48 decisions, $0.080 (73% of the run), 15 minutes, nothing applied.**
  - Outcomes of the 48:
    - 15 amendments applied;
    - **13 refused as `changes_nothing`**: the same "rerun step 13 with the sponsored condition" sent again;
    - 5 refused as repeats (`repeat_refused`);
    - 2 completions refused (`full_run_required`), because step 1 `cannot_run_again`;
    - 1 refused as `repeat_body_is_routed`;
    - 3 partly applied (`run_by_the_loop`);
    - the rest were inspections.
  - About 15 decisions re-ran the saved Flow's steps one at a time (`0088`-`0120`, `0197`-`0215`), some with `add`. This put a second navigate step, a second Pickup filter and a second read at the end of the draft (dry run steps 15-17).
  - The page loop lost its read. In each of the three dry runs (`0217`, `0252`, `0286`), the read ran once and the next-page step ran 8 times, 7 of them after it had already reported "no next page".
  - No dry run was judged. After the last one ended (23:44:59), nothing was logged until the deadline (23:50:02).

### 5. Structural fix (general, Core)

1. **A re-ask can only replace a no whose every reason Core has settled.** One shared rule, used by every re-ask path (`result-verification/agreement/ask-again.ts`, `agreement/reask-contradicted.ts`, `unsure-doubts/narrowing-no-reask.ts`), with one decomposition module, e.g. `agreement/no-reasons.ts`:
   - split the no's `observed` and `advice` into the reasons it states;
   - re-ask only when each reason is either the kind the recheck addresses (a step that chose request words) or refuted by Core's record;
   - otherwise the no stands.

   In `narrowing.ts`, three changes:
   - a sentence that calls a step harmless, redundant, matching or correct does not blame it;
   - match step names only after removing the names of rows Core stored or left out from the sentence;
   - require the "only" that the header already promises.
2. **Core's recheck states what it measured, never that a step is correct.** In `unsure-doubts/narrowing.ts` (`sentence`) and `unsure-doubts/recheck-words.ts`:
   - give the option chosen, its group, and the counts before and after;
   - drop "the request itself says X" whenever two or more steps in different groups each match only one word of the same request clause;
   - say instead that a site filter's option words do not show that each kept row meets the clause, and that a row's own text does.

   The same point belongs in the builder's generic read guidance. Its example must use a different kind of site (e.g. a venue listing filtered by "outdoor" and "weekend" separately, against "outdoor seating this weekend").
3. **A condition written in the request's own exclusion words is kept until measured otherwise.** In `standing-no/kept-conditions.ts` and `standing-no/kept-condition-drop.ts`, use `refuted-no/request-text-test.ts`. A condition whose wording passes the request-text test as an exclusion the request states is kept across revisions even without `keptOut`. A later record can release it only by showing it left out a row Core accounts as asked for. In `service/candidate-trial/feedback.ts` with `agreement/refuted-labelled.ts`, a reading Core contradicts **entirely** passes on its `observed` but not its `advice`.
4. **Repair lane waste (secondary).**
   - In `flow-draft/full-run-required.ts` and `llm/node-tools/dry-run-gate.ts`, when the saved Flow's step 1 `cannot_run_again`, Core reruns the carried steps itself, as the dry run already can, instead of asking the model to re-run them one at a time with `add`.
   - A page loop's next-page step that reports "no next page" ends the loop. It must not be re-run.
   - The 5-minute silence before the deadline needs its own trace (see below).

### Not verified

- Which reasons Core's `standingNo` record held for revision 1's sponsored condition (`keptOut` absent), because it is not in the run files.
- Softerra 8 Triple's own card text (it was not in the views I searched). That it fails "pickup today" is inferred from the passing runs leaving it out and from the repair's Pickup-only read keeping it.
- What Core was doing between 23:44:59 and the 23:50:02 deadline (`logs/core.log` has nothing after 23:44:08).
