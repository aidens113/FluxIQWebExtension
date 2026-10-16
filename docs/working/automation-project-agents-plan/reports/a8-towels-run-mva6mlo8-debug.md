# A8 frozen pair 5: towels, candidate `run-mva6mlo8-f519063c` and project `run-mva6mlm4-97fe42f9` (read-only debug)

Pair 5 is downstream `ee0723db` and Core `8c39a3f7`, with t650 and t651 in. The
pair-4 project run that passed, `run-mva4488t-c51bd732` (Core `0df06e34`, before
t650 and t651), is the comparison. The task is `bigbox-retail-pickup-towels`. The
oracle is `PICKUP_TOWEL_RECORDS` in
`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/expected-values.ts`: nine
rows.

## Outcome

Done. This was a diagnosis only, and no source changed.

**This is not a regression from t650 or t651.** Neither change acted in any of
the three runs:

- t650 had nothing to admit: no run had a kept-condition refusal.
- t651's label rule had nothing to skip:
  - No condition that tests a row's name left out a row by itself.
  - The candidate run had no name condition.
  - In both project runs, each name condition shows `alone: 0`.
- The judge system prompt is byte-identical across pair 4 and pair 5 (17,764
  characters).
- After t651, Core still refutes judges through the pickup condition's request
  words (project run 0076).
- In every run, the only seller signal was the Retailer facet. That is a step
  that narrows the list before the read, and no refutation path in Core reads
  such a step, before t651 or after it.

**The 9-row results matched the oracle exactly.** Names, order, price, unitPrice
and rating all match. That held for every 9-row trial: three in the candidate
run, seven in the failing project run, and every trial of the passing run.

**Why pair 4 passed and pair 5 failed.** Pair 4 passed on the luck of the judge
draws, not on anything Core measured. Its unsure subflow trial (a yes, then an
unknown) was resubmitted unchanged and retested, and that retest drew two yeses.
Pair 5's correct Flows drew dissent in every trial. The judge calls on correct
results came back:

- Candidate run: yes, unknown | no, yes | truncated, no, yes, truncated, no.
- Project run, whole Flow: no, yes. Project run, repair subflow: yes, truncated,
  truncated | no, no.

None of those dissents named a real defect.

**The causes are general,** apart from the site traps the scenario sets on
purpose. They stack:

1. **A split leaves a refuted no unlabelled (general).** When one call says no
   and the other yes, Core passes the no's reading to the builder without a label
   even when its record refutes part of the reading. Core also tells the builder
   "Nothing in Core's record contradicts what kept this trial from a yes". In
   trial 6 the no said a stored row was missing. The builder followed it and
   dropped the correct pickup condition (rev 6), and that cost a trial.
2. **Only a double no keeps conditions (general).** A condition that Core's
   record vindicated in an unsure trial is not kept. So rev 6 dropped condition 3,
   "Pickup today", unchallenged, although every row it left out by itself was
   settled against the request's own words.
3. **No measurement of what a site filter removed (general).** Core records no
   evidence of what a narrowing step left out. So the judges' speculative doubts
   cannot be weighed: "the Department facet may exclude packs", "the ValueRidge
   filter may not narrow", "these Loftwell rows are marketplace items". Each
   dissent on a correct Flow stood, and needing two yeses from this judge became
   a coin flip.
4. **Judge replies loop until cut off (general, recurring).** Judge calls loop a
   sentence inside the JSON `summary` until the provider's 8,192-token output
   ceiling is reached. The run sends no `max_tokens`.
   - In the candidate run, 4 of 21 judge calls looped. They cost $0.021 of the
     $0.066 the step metadata sums to, and 117 s of a 624 s build.
   - Each loop is asked again, which draws a fresh, independent answer.
   - In the project run, two loops in a row left a yes unconfirmed (0090).
   - The same loop was seen before in `run-mv6v2kzn-d593231f`
     (`result-verification/verify.ts` header).

## What changed and why

Nothing changed. The findings follow.

### Candidate run `run-mva6mlo8-f519063c`: trial by trial

The build ran from 23:47:03 to 23:57:27, 624 s in all. It ended on budget
`duration` (`flow_bootstrap.evidence_iteration_limit`, "it ran out of time"). The
8 trials took 538 s of that, judges included. "Extras" below are stored rows the
oracle does not have.

| Trial (step) | Rev | Flow shape | Rows | Extras / missing | Judges | Right verdict? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (0020) | 1 | Retailer + Speed "Today" + "4 & up" facets. Conditions: sponsored absent, rating ≥ 4.5 | 12 | + Softerra Pick-A-Sheet 8 Triple, + Northmere 12 (both "Pickup tomorrow"; "Today" counts delivery), + Loftwell Countertop holder | no / no | Right. Call 1 named the holder (right) and a carousel (wrong). Call 2's duplicates claim was wrong, and Core correctly marked it contradicted. Neither call named the two tomorrow rows; the read had no pickup column, so Core could not either. |
| 2 (0030) | 3 | Adds Department "Paper Towels" and dedupe by url | 11 | + the two tomorrow rows | no / yes, so unsure | Should be no. The no was baseless: it called one row a duplicate and said another stored row was missing. The yes was wrong. Neither saw the real gap. |
| 3 (0040) | 3 (retest) | same | 11 | same | no / no | Right. Both calls named the Speed "Today" facet. Core rightly corrected call 2, which had called Softerra 8 Triple not stored. |
| 4 (0046) | 4 | Fulfillment "Pickup" in place of "Today". Conditions: sponsored, rating | 15 | + 6 "Pickup tomorrow" rows | no / yes, so unsure | Should be no. The no named the defect and the right fix (0047). |
| 5 (0052) | 5 | Department + Retailer + Pickup facets. Conditions: sponsored, rating ≥ 4.5, `pickup contains "Pickup today"`, dedupe by url | **9 = oracle** | none | yes (0053) / truncated (0054) / unknown (0055) | Should be yes. 0055 doubted the Department facet as "a category the request does not name", which is false because the request says "paper towels", and "may exclude packs listed under other departments", which no evidence supports. |
| 6 (0059) | 5 (retest) | same | **9 = oracle** | none | no (0060) / truncated (0061) / yes (0062) | Should be yes. 0060 said "Missing qualifying items include ValueRidge Essentials … Value Pack, 15 Rolls", which is stored, and otherwise only "verify …". |
| 7 (0068) | 6 | Rev 5 without the pickup condition | 15 | + 6 tomorrow rows | no / no | Right. A regression the builder made on 0060's advice. |
| 8 (0074) | 7 | Rev 5 again, with the pickup condition | **9 = oracle** | none | truncated (0075) / no (0076) / yes (0077), then a re-ask: truncated (0078) / no (0079) | Should be yes. 0076 claimed the result included carousel rows (napkins, dish soap); no stored row is one. Its advice to "exclude the carousel" triggered a t515 re-ask. That re-ask (0079) called seven stored rows "marketplace-seller items" by their brand, although the read ran after the "ValueRidge (23)" Retailer facet. |

**The first wrong point is the builder's.** At 0017 (rev 1) it read "pickup
today" as the Speed "Today" facet and stored no pickup column. That is the trap
the scenario sets on purpose ("Today" counts delivery too). The builder added a
pickup column only at rev 5, 23:51, with about 5.5 minutes left. From then on,
three trials of a correct Flow could not get two yeses.

**Where Core could have steered the builder right:**

- **Trial 2 (0030).** The split's no rested on two claims Core's record
  contradicts: a duplicate the stored rows do not show, and a "missing" row that
  is stored. That reading arrived unlabelled. The builder spent 0033-0038
  "fixing" dedupe and page 2: one `candidate.unchanged_submission`, then a
  `repeat_refused`, then another `unchanged_submission`. Fix 1.
- **Trial 5 (0052).** The unknown's doubt about the narrowing step went
  unanswered. Core measures nothing about what the facet left out. Fix 3.
- **Trial 6 (0059).** The split's no claimed a stored row was missing, and that
  claim is refutable by `refuted-no/missing-claim.ts` ("missing qualifying items"
  matches its `missing\s+QUALIFIERS ROWS` form). But `agreement.ts` labels part
  of a no's reading as refuted only in the double-no branch and in the
  neither-yes-nor-two-nos branch. Both split branches call `unsettled(…, weigh)`
  without `refuted`. Then `trial-gate.ts` `UNSURE_RETESTABLE` said "Nothing in
  Core's record contradicts what kept this trial from a yes". The builder
  submitted rev 6, "drop the pickup-today condition that wrongly excluded
  qualifying rows" (0065), and lost a trial. Fixes 1 and 2.
- **Trials 5 and 8 (0054, 0061, 0075, 0078).** Four replies looped until cut
  off; each is a fresh draw on retry. Fix 4.

**The unchanged submissions** (0034, 0038, 0064) were the builder trying to obey
a no that named nothing real, so it resubmitted the same Flow. Core's refusals
and the repeat guard (0036) worked as designed. The cause is the unlabelled
reading (fix 1).

**What spent the time.** Of the 624 s build:

- 259 s went to five trials of wrong Flows. Three of those trials came from the
  builder's own wrong first reading. Rev 3's retest was spent on a baseless no.
  Rev 6 was a regression Core could have prevented.
- 280 s went to three trials of a correct Flow, judges included, of which 117 s
  were the four looping judge calls.
- 64 s went to builder decisions.

**Core's record, condition by condition** (rev 5 and rev 7 read accounts):

| Condition | What it left out | What Core settled |
| --- | --- | --- |
| 1, sponsored absent | 4 or 6 rows | All also in the result, which is right |
| 2, rating ≥ 4.5 | Hearthside Kitchen 4.3, Loftwell Prints 4.4 | Both settled, which is right |
| 3, `pickup contains "Pickup today"` | Six "Pickup tomorrow" rows | All settled. t629 counts it as the request's words "pickup today", which is right; its witnesses are not labels, so t651 does not apply |

### Project run `run-mva6mlm4-97fe42f9` (failing)

1. **Builder subflow, rev 1 (0029): 12 rows, no / no.** The extras were the
   holder and the two "Pickup tomorrow" rows. The verdict was right.
2. **Builder subflow, rev 2 (0037): 9 rows = oracle, yes.** Call 1 (0038) said no
   on paging. Core's paging record contradicted it, Core asked that call again,
   and it said yes. That is t501/t607 working.
3. **Whole Flow, assembled (0045): 9 rows = oracle, no / yes, so unsure.**
   - The no (0046) said "ValueRidge Essentials Paper Towels, 12 Double Rolls
     (2-Pack)" was "missed" by `name contains "Paper Towels"`. That name contains
     "Paper Towels". The row appears only in the request's `startView`, the
     unfiltered page. It is rated 4.2 and ships only, so the "Today" facet removed
     it before the read, and no condition ever saw it.
   - Core leaves a no that names an unseen row standing (`named.unmatched`).
   - The supervisor dispatched a repair (0048) instead of retesting. Fix 5.
4. **Repair brief 2 (0050-0103):**
   - Rev 1, 10 rows, no / no: right, the holder had come back.
   - Rev 3, 9 rows = oracle, no / no (0076): wrong. Both calls advised removing
     the name conditions. Core correctly did not refute that advice, because
     conditions 4-6 overlap (rejected 3, 2 and 1 rows, none alone), so
     `advice-condition.ts` `mayLeaveOutTogether` holds. Core did correctly refute
     call 1's pickup claim with the request words "Pickup today".
   - Rev 4 dropped the name conditions: 10 rows, holder back, no / no, right.
   - Rev 5, 9 rows = oracle: yes (0091), then truncated twice (0092, 0093),
     giving `verdict_unavailable` and unsure.
   - The retest (0095) drew no / no on a correct result:
     - 0096 said the "4 & up" facet and "Today" facet disagree with the read's
       conditions, which is no defect.
     - 0097 said stored rows were "sponsored" per the `endView` and that "9 of 16"
       were kept.
   - Rev 5 was then banned. Three `test_subflow` retries were refused
     `repeat_refused`, and the supervisor completed with nothing saved.

### Passing pair-4 project run `run-mva4488t-c51bd732`: the same kinds of trial

1. **Subflow rev 1: 10 rows (+ holder), no / no.** Right.
2. **Subflow rev 2: 9 rows = oracle, yes / unknown.** The unknown doubted the
   Retailer and "Today" facets, the same kind of narrowing-step doubt as
   candidate trial 5. Core did nothing with it, as in pair 5.
3. **The builder resubmitted unchanged** (`unchanged_submission`, 0039), retested
   (0041), and drew yes / yes.
4. **The whole Flow drew yes / yes.**

Its read used one combined condition, `name not contains ["Holder", "Dispenser"]`,
and two name conditions with `alone: 0`, so t629 and t651 had nothing to act on.
Core's record shaped the same way as in pair 5, and no refutation helped it pass.
The difference is that the judge draws came up yes.

### Was each verdict right? (summary)

- Every no on a Flow with extra rows was right in verdict, often for partly wrong
  reasons.
- Every dissent on a 9-row result was wrong. None named a stored row the request
  excludes or an asked row that is missing.
- Core's existing refutations that fired were all correct: duplicates (candidate
  0020), stored-or-not (0040, project 0068 and 0084), paging (project 0037) and
  pickup request words (project 0076).
- No refutation was lost to t651.

### Truncation: what it is and why it is not a cap matter

- Calls 0054, 0061, 0075, 0078, project 0092 and 0093 all stopped with
  `finish_reason: length` at 8,192 output tokens, inside the `summary` string.
- 0054 holds 33,286 characters: 523 sentences, of which 58 are distinct. "That
  matches." appears 40 times and "The result seems to satisfy the request." 26
  times.
- The request sends no `max_tokens` (t254). 8,192 is the provider's ceiling for a
  request with none.
- A loop would not end at any size, so raising or lowering a limit changes
  nothing.
- The trigger is the judge reasoning aloud inside the JSON `summary` field: `json_object`
  mode, temperature 0, thinking disabled. The verdict fields come after it, so a
  loop leaves no verdict at all.
- Temperature 0 does not make the judge deterministic. On byte-identical input,
  0053 answered yes, 0054 looped and 0055 answered unknown.

### Proposed structural fixes, by owning module

Every fix keeps the rules in the brief:

- Core refutes only what it measured.
- A yes still needs two yeses.
- A refusal is a hint, never a block (t650 admits the resend once).
- Fixtures are generic (a library or a hardware store), never this site's
  departments, sellers, products or answer.
- No output is capped.

**Fix 1 (general, primary): label a split's no where Core's record refutes part of it, and stop saying nothing contradicts it.**

- Core `result-verification/agreement.ts` `agree()`: in both `model_disagreed`
  branches, pass `refuted: weighedNo(input, call)` for the no's call into
  `unsettled(…)`, as the neither-yes-nor-two-nos branch already does. The no's
  reading then carries the t628 label "Core's record contradicts part of this
  reading: …", or "contradicted" when the whole of it is, and
  `recordContradicts: "part" | "whole"`. The verdict is unchanged.
- Core `flow-bootstrap/candidate/trial-gate.ts` and
  `subflow-candidate/subflow-trial-gate.ts`, plus `unchanged-submission.ts`:
  - When `recordContradicts` is `"part"`, use a third set of words: "Core's
    record contradicts part of the no's reading, as its label says. Change the
    Flow only for what the rest of it names where the trial's own reads, steps
    and stored rows show it."
  - `retestAdvised` stays false for `"part"`. Only `"whole"` advises a retest,
    as t641 decided.
- Tests:
  - New `result-verification/tests/agreement-split-partial.test.ts`:
    - A split whose no says "Missing qualifying items include <a stored row>"
      and "verify the filter steps" gets that label with
      `recordContradicts: "part"`.
    - The same holds with yes first and no second.
    - A split no that names nothing Core can check stays unlabelled.
    - The verdict stays `unsure` in every case.
  - In `trial-gate` tests: an unsure with `"part"` never prints "Nothing in Core's
    record contradicts".

**Fix 2 (general): keep a vindicated condition from any judged trial, not only a double no.**

- Core `result-verification/agreement.ts` `standingNoOf`, which today is attached
  only in the double-no branch, together with `standing-no/kept-conditions.ts`
  and the gate in `trial-gate.ts` that feeds `AutomationStudioResultKeptConditionMemory`.
- Change: also carry the kept-condition record on an unsure trial. That is a
  condition whose every row left out by itself Core accounts for, by a bound
  number or by the request's words (t629), and never a label test (t651).
- A later revision that drops the condition is then refused once with
  `resend: "accepted_once"`, and t650 lets the builder override it.
- Test: new `flow-bootstrap/candidate/tests/kept-condition-after-split.test.ts`:
  1. A trial judged yes and no, whose `stock contains "In stock today"` condition
     left out only rows Core read as "Ships in 3 days".
  2. The next revision drops that condition and is refused
     `kept_condition_dropped`.
  3. The identical resend is accepted.
  4. A condition with an unsettled left-out row is not kept.

**Fix 3 (general): record what a narrowing step left out, and ask an unsure that doubts one once more with it.**

- Core `result-verification/narrowed-before.ts`, its contract
  `contracts/read-account.ts` (`AutomationStudioResultNarrowingStep`), and
  `agreement.ts` `contradictedUnsure`.
- For a step that chose one control of a named group (the `group="…"` in the
  page view Core already holds before the step), carry:
  - the group's other options with the counts the page showed;
  - the result count the page states before and after, when it states one.
- Those are words and numbers Core read off the page; it interprets none of them.
- An unsure whose doubt names such a step as a category or option "the request
  does not name", where the step's control words pass the request-text test
  (`refuted-no/request-text-test.ts`), is marked `contradictedUnsure` about
  `narrowing` and asked once more (t503). The new words name the request's words
  and the options the step left out.
- Its answer replaces it, so a yes still needs two yeses.
- A doubt about a facet whose words are not the request's stands as now.
- Tests:
  - `result-verification/tests/narrowed-before-options.test.ts`: a library
    fixture that chose "Hardcover (40)" in "Format" with "Paperback (12)" beside
    it carries `leftOptions` and the counts; a step with no group carries none.
  - `tests/agreement-narrowing-doubt.test.ts`:
    - An unsure doubting the "Hardcover" step for a request for "hardcover
      books" is asked again once.
    - For a request for "books" it is not.
    - A no is never asked again on this ground.

**Fix 4 (general, recurring): a judge reply that loops leaves its verdict readable.** Two parts, with the risk noted:

- **4a.** In the loop-verification output schema and prompt (`llm/harness/task-kind.ts`
  `loop_verification`, and the system words that say "Put your reading of the
  failure in the diagnosis object"), order `diagnosis` before `summary` and ask
  for `diagnosis` first. The model then commits to its verdict before it
  narrates. This changes no limit.
- **4b.** In `result-verification/verify.ts`, together with the DeepSeek
  envelope (`llm/deepseek/response-envelope.ts`): on
  `llm.provider_output_truncated`, read the reply's leading `kind` and complete
  `diagnosis` object when the reply closed them before the cut. Mark the result
  `truncatedAfterVerdict`.
  - A no or an unknown read this way counts as an answer.
  - A yes counts only if every check a yes must pass reads fields that arrived
    whole. If the quote checks read `summary`, a truncated yes stays unavailable
    and is asked again as now.
  - This reads what the model wrote. It caps nothing.
- Tests: `result-verification/tests/truncated-reply.test.ts`, with a provider
  fixture:
  - `kind` and `diagnosis` complete, then a summary that loops: read, flagged.
  - Cut inside `diagnosis`: unavailable and asked again.
  - A yes whose required quotes sit in the cut summary: unavailable.
- The alternative is thinking mode for judge calls only: it costs more and needs
  the user's view on cost. The loop is a recurring failure, so prefer 4a+4b over
  per-run patches.

**Fix 5 (general): refute "condition N missed row X" when no condition saw X.**

- Core `result-verification/refuted-no/missing-claim.ts` and `named-rows.ts`, or
  a new focused `unseen-row-claim.ts` beside them.
- Case: a sentence says a named condition left out or missed a row, and the row
  is in none of the read's seen labels (`automationStudioRequestRowsReads`, read
  labels), while `narrowedBefore` steps ran first. Refute that claim: "no
  condition saw X; it never reached the read". The question whether the
  narrowing step was right stays the judge's.
- This refutes only what Core measured: which rows the read saw.
- Test: `refuted-no/tests/unseen-row-claim.test.ts`, a library read after a
  "Hardcover" step:
  - "Condition 2 missed <a paperback that appears only in the start view>" is
    refuted.
  - "The Format step removed <it>" stands.
  - A row the read saw stays on the existing path.

**Task-specific, no fix.** The site's traps are working as designed:

- "Today" counts delivery.
- The Retailer facet is the only seller signal.
- "Paper Towel Holders" is a department beside "Paper Towels".

Together they made the builder's first Flows wrong, and the judges at trial 1 did
not name the two tomorrow rows. Guidance must not mirror them.

### Did t650 and t651 act as intended?

- **t650**: not exercised. No refusal in these three runs carried
  `resend: "accepted_once"`, and the guard refusals that did happen (0036,
  project 0064, 0066 and 0099-0103) were unmarked, guarded as before. That is
  correct.
- **t651**: not exercised, and no false positive. `labelTested`'s four tests
  (`label-tested-condition.ts`) cannot match any condition that left out rows by
  itself here:
  - the sponsored witness is "Sponsored";
  - the rating witness is a number;
  - the pickup witness is "Pickup tomorrow", its kept value is "Pickup today",
    and its column `pickup` is not stored.
- The name conditions in the project runs had `alone: 0`, so `requestQuotes`
  skipped them before the label test was ever reached (`leftOutOnlyByThis` is
  empty).
- **Key question:** the seller filter is a narrowing step, not a column, so
  there was no correct refutation for t651 to discard, before or after it.

## Commands run and observed results

- `python -X utf8 towels_rows.py <run>` and `towels_values.py <run>`, my
  scratchpad scripts. They parse `sampleRows` from every judge `request.txt` and
  compare the rows to the oracle. Result: every 9-row trial in all three runs
  matches the oracle on names, order and all four values. Extras per trial are as
  in the tables above.
- `python -X utf8 towels_trials.py <run>`. It prints each trial's verdict, code,
  `retestAdvised`, the checked lines and the judge readings, and each judge call's
  `finishReason`, output tokens and `answersRequest`. The verdict sequences above
  come from it.
- Step `meta.json` aggregation per run:
  - Candidate: 8 trials, 537.8 s. Judges: 17 ok calls (85.7 s, $0.017) and
    4 truncated calls (117.4 s, $0.021). Decisions: 28 (63.9 s, $0.027).
  - Project failing: 2 truncated calls (59.9 s, $0.010).
  - Pair 4: none truncated.
- Judge system prompt equality across pair 4 and both pair-5 runs: 17,764
  characters each, equal (`True True`).
- The truncated reply 0054: 33,286 characters, 523 sentences, 58 distinct. The
  request carries no `max_tokens`; its keys are `model`, `temperature`,
  `thinking`, `stream` and `response_format`.
- The build ending, from `snapshots/flow-lane.json`: `durationMs: 626871`,
  issue `flow_bootstrap.evidence_iteration_limit`, and the person-facing text "it
  ran out of time" (budget `duration`).
- Read in Core at `8c39a3f7`:
  - `git show 99ce4d18` (t651: `label-tested-condition.ts`, `record.ts`,
    `missing-claim.ts`, `types.ts`);
  - `git show f08fd778` (t650: `resend-admission.ts`, `outcomes.ts`,
    `submission.ts`);
  - `result-verification/agreement.ts` (header and lines 200-489);
  - `refuted-no/missing-claim.ts`, `refuted-no/advice-condition.ts` (header and
    rule);
  - `narrowed-before.ts` (header);
  - `flow-bootstrap/candidate/trial-gate.ts` (lines 140-230 and 582-586);
  - `verify.ts` (lines 20-60).
- Read downstream: `bigbox-retail/manifest/pickup-towels-workflow.ts` and
  `manifest/expected-values.ts`.
- No tests and no builds were run: the brief was read-only.

## Not verified

- **Whether trial 2's no was wholly refutable.**
  - "Missing \"Hearthside Select-A-Size …\"", a verbless form with a quoted
    label, does not match `missing-claim.ts`'s `MISSING` patterns.
  - I did not check whether `row-reference-claim.ts` catches it.
  - Either way, a split never labels part of a reading (fix 1). Whether a whole
    refutation would have triggered the t607 re-ask is not established.
- **The exact sentence that kept trial 6's no from being wholly refuted.** I
  inferred it was the "verify …" advice and the "need verification" sentence. I
  did not run `weigh.ts`.
- **Fix 3's group data.** I did not confirm that the page view before each
  narrowing step is available in the trial trace at `narrowed-before.ts`.
- **Fix 4b's yes path.** I did not confirm whether the yes quote checks in
  `verdict.ts` read `summary` or `diagnosis`.
- **Fix 5's seen labels.** I did not confirm that `read.labels` in
  `automationStudioRequestRowsReads` lists every row the read saw, and not only
  the rows it left out.
- **The cost gap.** Step metadata for the candidate run sums to $0.066. The run
  reported $0.083, and I did not reconcile the two.
- **The fixes themselves.** None was implemented. Whether fixes 1 and 2 would
  have saved this exact run depends on the builder's response, which cannot be
  replayed read-only.

## Open questions or contradictions found

- **The retest wording is false in places.** `UNSURE_RETESTABLE` says "Nothing in
  Core's record contradicts what kept this trial from a yes" whenever
  `recordContradicts` is not `whole`. That includes trials where Core's record
  did refute part of the no. In trial 6 it pointed the builder at a false reading.
- **Kept conditions depend on a double no.** t641's memory exists only after one.
  But a correct Flow is most often judged a split, so the condition Core
  vindicated was unprotected exactly when it mattered.
- **The judge prompt fights itself on facets.** It tells judges to answer no over
  "a category … the request does not name". It also says "a site's own filter …
  can keep rows that clause does not ask for". Both invite the speculative facet
  dissents seen here, with nothing Core can weigh them against. Fix 3 gives them
  evidence. Changing the prompt's wording is a separate decision, and its
  examples must stay off this site's kinds.
- **Project mode retests less than candidate mode.** After an unsure whole-Flow
  trial whose no named an unseen row, the supervisor dispatched a repair rather
  than retesting the same revision, although `retestsLeft` was 2. The repair
  rebuilt the subflow and wandered through 5 revisions. The supervisor's options
  may need the same retest prompt the candidate builder gets. I did not
  investigate this beyond 0048.
