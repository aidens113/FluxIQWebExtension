# A8 wave 8 debug: project towels `run-mv9gbsm5-2957581c`

Read-only debug. No live or Lab run and no provider call was made. Pair: downstream `003c3353`, Core `be766f29` (after t629 and t630).
Steps: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mv9gbsm5-2957581c/steps/`.

## Outcome

The build found the oracle's exact answer four times and never got it accepted. In four trials the
stored rows were exactly the 9 rows of `PICKUP_TOWEL_RECORDS`, in oracle order and with the same
values. All four times the judges came back unsure or no. Six of the eight judge calls on those
trials were wrong. Their objections were of two kinds:

- The name conditions that keep only packs were called "extra narrowing" that "could drop" a row.
  None of those conditions left out a single row on its own.
- One judge said rows were missing that Core had settled as failing a test written in the request's
  own words. t629 was built to refute that kind of claim, but it did not fire because it did not
  recognise the judge's wording.

Every other revision stored 10 rows: the oracle's 9 plus a paper towel holder. The judges rightly
said no to all of those. So each builder swung between two Flows, the right one (rejected wrongly)
and the one with the holder (rejected rightly). It then sent one of them again unchanged, and each
brief ended on the repeat guard.

This is a product defect in Core's result verification. It is not a Lab defect: the oracle is
right, and wave 7 passed on the same Flow shape because its re-test drew a yes.

## How far it got and what ended it

- 0001–0008: the instruction was read, the plan was written with one subflow `find_paper_towels`
  carrying parts p1 and p2, and the build brief was sent.
- Builder brief 1 (0009–0061) ran three revisions:
  - Revision 1: 2 rows.
  - Revision 2: 10 rows.
  - Revision 3: the oracle's 9 rows, trial unsure.
- After that unsure trial, the builder did not test revision 3 again. At 0054 it removed the name
  conditions, as the "no" judge had asked. That rebuilt revision 2 word for word, and at 0055 Core
  refused it with `candidate.unchanged_after_no`.
- The builder then sent the same Flow three more times, at 0057, 0059 and 0061, each refused with
  `llm_evidence_loop.repeat_refused`. The brief returned partial with
  `flow_bootstrap.evidence_repeat_without_progress`, shown in the result at step 0063.
- 0062: the supervisor sent a repair from the closest trial (`subflow-trial.452f1859`, revision 3,
  unsure).
- Repair brief 2 (0064–0134) went 10 → 9 → 9 (re-test) → 10 → 9 → 10 rows.
- At 0123 the repair resubmitted revision 5, which was the oracle revision already judged no. Core
  refused it with `candidate.unchanged_after_no` at 0124 and again at 0128. Repeats were refused at
  0126 and then at 0130, 0132 and 0134, three in a row, and the brief ended with
  `flow_bootstrap.evidence_repeat_without_progress`.
- 0135: the supervisor ended with `complete` and outcome partial.
- The Lab result is `lab.chat_build_failed`. The chat said: "the supervisor ended it with only part
  of the Flow built". In total: 136 steps, $0.082, no Flow.

## Trials against the oracle (9 rows)

| Trial (step) | Revision | Rows | Against the oracle | Judge 1 | Judge 2 | Verdict | Judges right? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0029 | b1 | 2 | 7 missing: the URL-slug test `retailer contains "/ip/valueridge"` | no 0030 | no 0031 | no | right |
| 0045 | b2 | 10 | 9 plus "Loftwell Countertop Paper Towel Holder, Bamboo" | no 0046 | no 0047 | no | right (a holder is not a pack). Call 1's dedupe doubt was refuted by t628, rightly. |
| 0051 | b3 | **9, exact** | equals the oracle | **yes** 0052 | no 0053 | unsure | 0053 wrong |
| 0068 | r1 | 10 | plus the holder | no 0069 | no 0070 | no | Verdicts right. 0070 also says Hearthside 8 Double Rolls and Kindleaf are missing; both were stored, and Core flagged the Kindleaf misread. |
| 0080 | r2 | **9, exact** | equals the oracle | unknown 0081 | **yes** 0082 | unsure | 0081 wrong ("9 rows while the page shows 23") |
| 0084 | r2 re-test | **9, exact** | equals the oracle | no 0085 | no 0086 | **no** | both wrong |
| 0090 | r3 | 10 | plus the holder | no 0091 | no 0092 | no | Verdicts right. 0091's claim that the first-line pickup field dropped VR Select-A-Size 6 DR is false: that row is stored. |
| 0108 | r5 | **9, exact** | equals the oracle | no 0109 | no 0110 | **no** | both wrong |
| 0118 | r6 | 10 | plus the holder | no 0119 | no 0120 | no | right |

What the wrong calls on the exact revisions said:

- 0053, 0085, 0086 and 0110 (call 2): "condition 4 (name contains "Paper Towels") ... is an extra
  narrowing the request does not state and could drop a qualifying pack whose name lacks that exact
  phrase."
  - This is hypothetical. Every trial result records `rejectedByItself: 0` for conditions 4, 5 and 6,
    and 0051's no-reading admits it: "condition 4's leftOutOnlyByThis is empty, so no qualifying row
    is shown dropped by it".
  - The only row those conditions removed together is the holder, which every 10-row trial was
    rightly rejected for keeping.
  - The judge prompt's supplementary text drives this: "a result that a filter, condition or
    exclusion narrows ... which the instructions do not ask for ... does not do what was asked".
- 0109: "Condition 2 (pickup contains "Pickup today") dropped rows whose pickup value was "Pickup
  tomorrow" (ValueRidge Essentials Paper Towels, 1 Roll; ...) ... which the request does not
  exclude."
  - All 8 of condition 2's `leftOutOnlyByThis` rows are in `leftOutSettled`, with read values such as
    "Pickup tomorrow", "Delivery tomorrow" and "Shipping, arrives ...".
  - The request says "ready for pickup today", so the condition is testing the request's own words.
- 0110: "Stored 9 rows including ... "Northmere Paper Towels, 12 Rolls", which are not ValueRidge-sold
  items". Northmere is not among the stored rows. Core did not flag this misread.

## Did t629, t628 and t630 fire, and should they have?

- **t629 (refute a no that calls settled rows missing): did not fire anywhere. It should have at
  0109.**
  - Every row 0109 names under condition 2 is settled by a positive `contains "Pickup today"` test.
    "pickup today" appears in the request as "ready for pickup today", with no cue word nearby, so
    `quotesRequest` would hold.
  - It missed because `missing-claim.ts`'s `MISSING` regex does not match the sentence. "dropped rows
    whose ... which the request does not exclude" is a form the pattern list does not cover: its
    `dropped ... rows` form needs "including / such as / like" after the noun.
  - I confirmed this by running the regex copied from `missing-claim.ts` on 0109's sentence in node.
    It prints `false`. The 0085 sentence also prints `false`.
  - This is the third wave in a row where a judge's wording slipped past a pattern list.
- **t628 (a no that says what a row is stands; an unsure-and-no split is weighed): fired, and
  rightly.**
  - The nos saying the holder "is a paper towel holder, not a pack" stood in all four 10-row trials,
    which matches the oracle.
  - The dedupe doubt in 0046 was marked "contradicted by Core's record", which is correct.
  - The yes/no split at 0051 and the unknown/yes split at 0080 were both turned into unsure,
    correctly.
  - t628 did not help the exact revision, because neither no there said what a row is.
- **t630 (plan warning on a subflow that only reshapes): did not fire, and rightly.** The plan has one
  subflow with no inputs and an output, so `project.plan_subflow_reshape_only` does not apply. No
  dispatch was refused.
  - The t630 wording does show in the return reasons, for example
    "candidate.last_submission_family:candidate.unchanged_after_no".

## Is "delivery counted as today" behind this run too?

No.

- No revision used the site's "Today" filter. Every `narrowedBefore` lists only the retailer facet
  "ValueRidge (23)" besides the notices that were closed.
- "Today" was tested per row by `pickup contains "Pickup today"`. Every stored set equals the oracle
  or the oracle plus the holder, so no row that is only "Delivery today" was kept.
- One weakness is still there: the field binds `extractList.fields.pickup:
  div_css-0gz65eu_div_1`, the card's first fulfilment line. On rows with no pickup line, the read
  value is "Delivery tomorrow" or "Shipping, arrives ...".
  - Here the pickup line is first whenever a card has one, so it did no harm.
  - A card that listed delivery first would be misread. This is a separate, untriggered issue in the
    web domain, not this run's cause.

## Root causes

1. **Core result verification refutes a no by parsing the judge's sentences, so it lets through nos
   that point at no concrete row.** This is a product defect.
   - Every wrong no on the exact revision asked to change a condition, either "remove conditions
     4–6" or "replace condition 2".
   - Core's own read account already shows that the change would add nothing the request asks for:
     - Conditions 4–6 each have no `leftOutOnlyByThis` rows.
     - Condition 2's rows are all settled against the request's own words.
   - The fix depends on the condition the advice names, not on how the sentence is worded. The
     pattern-list approach of t607 and t629 keeps missing new wordings (the
     recurring-failures-need-structural-fix lesson).
2. **No memory across trials for an exclusion the judges already confirmed.**
   - The holder no stood (t628) on revisions b2, r1, r3 and r6.
   - The next nos then asked to remove exactly the conditions that leave the holder out, and Core
     weighed them as if fresh.
   - That makes the two Flows a cycle in which every move is closed off.
3. **Secondary: the builder did not re-test after an unsure trial, and the refusal wording is
   wrong.**
   - At 0054 the builder followed the no-reading instead of re-testing revision 3, which the
     `readings` text allows.
   - The `candidate.unchanged_after_no` refusal tells a subflow builder to "submit the whole changed
     Flow with core.submit_candidate". `unchanged-submission.ts` hard-codes
     `SUBMIT = "core.submit_candidate"`, but in a brief the tool is `core.submit_subflow`.
   - This is a minor wording defect. It did not cause the failure, because the model used the right
     tool anyway.

The Lab is not at fault. The oracle is correct, and the Lab's verdict, failed with no Flow, is honest.

## Smallest structural fixes (all in Core, `packages/fluxiq/src/programs/automation-studio/runtime/`)

1. **Refute a no at the level of the condition its advice names, in a new
   `result-verification/refuted-no/advice-condition.ts`.**
   - Wire it in through `record.ts` and `weigh.ts`, and export it from `refuted-no/index.ts`.
   - When a no's `changed`/advice names only conditions (Core already names them "condition N"),
     and Core's read account shows that removing or loosening each one re-admits no row the request
     could ask for, refute the no to unknown with Core's finding. Either:
     - the condition's `leftOutOnlyByThis` is empty, or
     - every row in it is in `leftOutSettled`, with `quotesRequest` true for text conditions, or in
       `leftOutAlsoInResult`.
   - The result keys on the condition reference and the read account, not on the wording that says
     "missing". It would have covered 0053, 0085, 0086, 0109 and 0110's call 2.
   - Tests go in `refuted-no/tests/` and use a fixture of another kind of site, never this
     scenario.
2. **An exclusion that has stood holds across the subflow's trials.**
   - Where the gate records verdicts across revisions
     (`flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`, with the record from `refuted-no`):
     - Keep the labels of rows that a standing no of this subflow called "not the asked kind"
       (t628's `excluded-kind` / kind-exclusion path).
     - Refute a later no whose remedy would re-admit exactly those rows, meaning the rows left out
       only by the conditions it names. Its advice contradicts the subflow's own standing verdict.
   - This breaks the A↔B cycle in general.
3. **Check the other direction for misreads in
   `result-verification/request-rows/checked-rows.ts`.**
   - A row the check calls stored, kept or included that is not in the stored rows is a misread, the
     same way a row called left out but stored already is. This covers 0110's "Northmere".
4. **Wording fix in `flow-bootstrap/candidate/unchanged-submission.ts`.**
   - Name the tool of the context the refusal is sent in (`core.submit_subflow` / `core.test_subflow`
     in a brief) instead of the constant `core.submit_candidate`.
   - Optional: when the latest revision's trial was unsure, the refusal should also name that
     revision and say to test it again.

None of these changes the guidance a model is given about any site, task or product.

## Commands run and observed results

- `python .../scratchpad/a8-summary.py run-mv9gbsm5-2957581c`
  - Two dispatches, both partial: build with 29 calls and repair with 41, each ending with
    `flow_bootstrap.evidence_repeat_without_progress`.
- Python scripts over `steps/*test_subflow/result.json` and `*-judge/{request.txt,decision.json}`.
  These produced the table above:
  - Stored-row comparison with the oracle in my scratch script `mv9gbsm5_rows.py`: 0052, 0053, 0081,
    0082, 0085, 0086, 0109 and 0110 show 9 rows, none extra, none missing, order OK. The 10-row
    trials show one extra row, the holder.
- `node mv9gbsm5_re.mjs` (the `MISSING` regex copied from `missing-claim.ts`) printed:
  - `0109 observed sentence matches MISSING: false`
  - `0085 sentence matches MISSING: false`
- Wave 7 comparison (`run-mv9dgwzi-5811e1a6`): the same shape (conditions 1–3, plus name contains
  "Paper Towels", plus name not contains Holder/Dispenser) was unsure at 0071, then yes at 0077,
  0103 and 0135. That run passed on the re-test draw.

## Not verified

- I did not run Core's refuted-no code end to end on 0109. The diagnosis rests on the regex alone.
  Whether "Tidemark Paper Towels, 12 Mega Rolls" (sponsored, so not left out by condition 2 alone)
  would have counted as an unmatched row was not checked, because it is unquoted in that sentence.
- The fixes proposed above are not implemented or tested.
- I did not check whether the site ever lists a delivery line before a pickup line on cards that have
  both. All observed cases put pickup first.

## Open questions or contradictions found

- The judge prompt's supplementary rule treats an unstated filter as a failure. That conflicts with
  t628's standing kind-no: one demands a condition that the other forbids. Fix 2 settles this in
  Core, but the supervisor may want to reword the supplementary rule so it applies only when the
  extra narrowing actually left out a row.
- `unchanged-submission.ts` names `core.submit_candidate` inside subflow briefs (wording defect noted
  above).
