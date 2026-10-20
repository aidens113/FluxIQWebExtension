# run-mvgf04kw-310fc169: office checkout review, rerun round 2

Status: debugged terminal failure. This was a read-only analysis. No source
edit, build, browser run, paid run or commit was made for it.

## Run

- Task `everything-store-office-checkout-review`, rerun round 2, slot 1, lane
  tree `C:/Users/osrs_/FluxStuff/fxwork/t563`. Downstream was at ddf41bf4 and
  Core at ca23a8ba, both current dev. That includes the L1 reset redesign,
  lane S's prompt-rule move and the chat instruction-fold fix. The build was
  started from the real extension chat, with a $0.25 ceiling.
- Run folder: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgf04kw-310fc169`.
  It holds 250 step folders and 126 provider calls, costing $0.16906 (the
  sum of the step costs equals the guard's figure).
- The Lab started at 08:22:01. The build started at 08:28:53 and ended at
  08:40:56.
- Verdict: `failed`, `runtime.behavior`, with no Flow created. The first
  failure (event 52) is that the assembled candidate's test run was judged no
  and it was kept as a draft.
- Spend per brief:

  | Brief | Spent | Calls |
  | --- | --- | --- |
  | brief-1 | $0.021 | 14 |
  | brief-3 | $0.044 | 30 |
  | brief-4 | $0.027 | 18 |
  | brief-5 | $0.025 | 28 |
  | brief-6 | $0.018 | 9 |
  | brief-7 | $0.007 | 4 |
  | brief-8 (reset) | $0.012 | 7 |

  The supervisor and the two judges took the rest.

## How far it got

It got much further than r2 (`run-mvfq94ff-c8c21493`). It reached the judged
whole-Flow run. Every act the task asks for was done correctly there; the only
thing missing was the one-row table.

- **0003-0010.** The supervisor planned two subflows: `checkout_kettle` (p1)
  hands four outputs to `report_checkout` (p2). The first plan was refused
  with `project.plan_port_name`. The resend was accepted, with a warning that
  `report_checkout` "neither makes a lasting act nor hands anything on". At
  0005 there was one `llm.provider_malformed_response`, which was recovered.
- **Brief-1 (0013-0041): blocked. This was model behaviour.**
  - Buy Now with `create_new` was refused `candidate.create_baseline_required`
    (0023). The refusal printed only `destination-4`, the product page's
    sponsored "Products related to this item" list.
  - The model read the cart (0027), which issued `destination-5` and
    `destination-6` (2 items each). It then never pressed Buy Now with a ref.
    Instead it went product page, cart, product page, cart (0028-0036), each
    time saying it would "record the baseline" or "read Buy Now".
  - The repeat guard ended the brief at 0037-0041 (`repeat_refused`,
    `same_result`).
- **Brief-3 (0044-0099): done. Revision 4 passed its own trial.**
  - Buy Now was refused again for a baseline (0050). After a cart read, the
    model pressed Buy Now with `resetDestination: destination-4`, the
    sponsored list, not the cart (0056). Core accepted that ref.
  - The four steps after that were all corrected the way they were meant to
    be:
    - The trial of revision 1 failed on a stale total handle (0062).
    - Revision 2 was judged no because it used the home address. Both judges
      named the office-address chooser (0068-0070).
    - Revision 3 failed on a stale address handle (0078).
    - Revision 4 was refused `candidate.trial_reset_required` for act-17
      ("confirm the office address", trial step 8). The model navigated under
      `undoes: act-17`, `resetDestination: destination-5` (0092). The retest at
      0096 ran and was judged **yes** by both judges: office address, free
      standard delivery, gift card, Visa, Plus off, cart still 2 items, order
      not placed.
- **Brief-4 (0102-0138) and brief-5 (0141-0197): `report_checkout`, both
  partial. No trial of it ever ran.** Each test was `trial_reset_required` for
  the "confirm the office address" acts that earlier trials and the entry
  preparation left behind (act-20, act-23, act-26). Both briefs then ended on
  three unchanged resubmissions (see causes C2 and C3).
- **0198-0201.** `project.assemble` was refused (`assemble_proposal_missing`
  for `report_checkout`). The supervisor folded p2 into `checkout_kettle`
  (`amend_plan`), and the plan became one router subflow.
- **Brief-6 (0204-0220).**
  - Revision 5 was submitted: brief-3's revision 4 with its four reads.
  - **0208 is the judged whole-Flow run** ("This test runs the whole Flow from
    its start as the build's judged run"). It ran with no reset refusal and
    was judged **no** by both judges (0209, 0210). Their reason was correct
    and the only one: every checkout act landed (kettle alone, Northgate
    Dental address, Thursday September 24, free standard delivery, gift card
    -$12.40, Visa, Plus off, total $7.59, order not placed), but "the run stored
    no record set (recordSetCount 0)". So the one-row table was never produced.
    That matches the task's expected values for every act.
  - The builder then tried five times to add a step that saves the four reads
    as one row. Every attempt was refused (see the first divergent step
    below), and the brief ended on the repeat guard.
- **Brief-7 (repair, 0223-0231): blocked.** The same table step was refused
  `record_schema.not_derivable` three times.
- **0232-0250.** The ending was held with `project.completion_reset_first`
  (act-27, act-29). The reset brief-8 ran 7 calls and came back done. The
  supervisor ended blocked at 0250.

**Distance: one authorable step short of a pass.** The judged run did
everything the task asks except store the row. The table step the build
needed could not be written in the script format.

## First divergent step: 0211-0220, the table step is unauthorable

After the correct no at 0208, the builder's single remaining job was to store
the four reads (step labels item, address, arriving, total) as one record.
The only node in the catalog that stores records without a list read is
`builtin.data.write-records`. Each attempt, with what it wrote and what came
back:

| Step | Model wrote | Product answered |
| --- | --- | --- |
| 0211 | `writeRecords.records: [{item: $step.item.value, ...}]` | `record_schema.not_derivable` on `recordOutput` (0212) |
| 0213 | the same, plus `recordOutput.datasetId/writeMode/schema` | `bootstrap.unknown_parameter` `writeRecords` (0214). The node "takes only recordOutput" |
| 0215, 0217 | `recordOutput.*` with a full schema and `recordsPath: $step.item.value` | `bootstrap.required_input_unconnected` at `plan.subflows.0.nodes.s13.inputs.records`, **placed at step "open the kettle's page", line 3** (0216, 0218) |
| 0219 | the same, with `recordsPath: rows` | the same, at line 3 (0220). The brief ended on the repeat guard |
| 0226-0230 (repair) | `recordOutput: {datasetId, schema with four fields, writeMode}` plus `records: [{... $step bindings ...}]` | `record_schema.not_derivable`: "A record output named a dataset but no columns to save in it" (0227, 0229, 0231), although a four-field schema was written |

Why every one of these fails:

1. **write-records cannot be fed from a script.** `nodes/data/write-records.ts`
   declares its rows only as a required **input port** `records`, and has the
   single parameter `recordOutput`. A script binding (`$step.<label>.<output>`,
   `flow-bootstrap/authoring/script-binding.ts`) fills a *parameter*, never an
   input port. So nothing the model can write connects that port, and
   `validateRequiredInputConnections` (`flow-bootstrap/plan/validation.ts:367`)
   refuses every plan that holds the node. No other node turns scalar reads
   into a row: only `web.dom.extract_list` declares a records path (downstream
   `domain/src/io/manifest-definitions.ts`). Yet the node catalog offers
   write-records to the model, and the judges' advice ("add a record set
   that stores the four extracted values as one row") points straight at it.
2. **A `records:` line silently replaces the record output.**
   `flow-bootstrap/authoring/matching.ts` maps the key `records` to the
   parameter `recordOutput` (`PARAMETER_SYNONYMS`, `["records",
   ["recordOutput"]]`). So the repair's `records: [{...}]` line was read as
   the record output itself. `normaliseAuthoringRecordOutput`
   (`authoring/record-output.ts:110-113`) then found no field list in the row
   objects and refused with "named a dataset but no columns", which is the
   opposite of what the model wrote. This inference fits every observed
   refusal: no `unknown_parameter` was raised for `records` at 0227-0231,
   while it was for `writeRecords` at 0214.
3. **The unconnected-input refusal names the wrong step.**
   `validateRequiredInputConnections` writes the path with the node **key**
   (`nodes.s13`). `authoring/locate-issue.ts` matches node paths only by index
   (`NODE = /^plan\.subflows\.(\d+)\.nodes\.(\d+)/`). So `s13` falls through
   to the subflow's own place, which is the block's first step. The model was
   told to "correct that step" at line 3, "open the kettle's page", which is
   correct as written. The real issue also gave no `accepted` or `instead`
   text saying how the port is fed.

## The report_checkout stall (briefs 4 and 5)

These briefs did not decide the outcome: the plan was folded and the judged
run happened anyway. They still cost $0.051 and 46 calls, and the same
mechanisms will recur in any downstream subflow whose predecessor makes a
lasting act.

- **Every trial and every entry preparation makes a new act with no
  destination.** The model wrote "confirm the office address" with
  `consequences: modify_existing` (honestly). Each run of that step (act-17,
  act-20, act-23, act-26, act-29) needs the model to name a list under
  `undoes` before the next trial. An address choice lives in no list, and the
  ledger accepts any list:
  - `destination-5`, the cart, settled act-17 at 0092 and act-26 at 0183
    (`candidate.undo_act_kept`).
  - act-20 came from brief-3's passing trial and was never settled before
    brief-3 completed. Brief-4 inherited it, with act-23 from its own entry
    preparation; brief-5 inherited act-20 again.
- **Core moved the tab during a refused test and did not say so.**
  - Before 0126 the tab was on checkout, and the decisions at 0127 and 0129
    still saw `URL ~/checkout`. Yet the 0130 settle read ran on the **product
    page** (its result's location, `resetDestinations` `destination-4`).
  - The same happened in brief-5: after 0159's refusal, the 0161 call on a
    checkout handle came back `target_unobserved` (`handle_not_in_packet`)
    with the cart's `destination-5` and `destination-6`. The tab was on the
    cart.
  - `trial_reset_required` carries no location or view. The model's settle
    reads therefore ran on the wrong page, and its next view surprised it
    (0131: "Checkout page is gone").
  - The artifacts show that the tab moved. They do not show which Core path
    moved it: the pre-trial re-read of reachable destination pages ("Core
    reads the lists and pages it can reach again itself", `site-reset`), or
    the entry preparation's first steps.
- **The repeat words for an unchanged builder submission say "submit
  again".**
  - In brief-4, `candidate.unchanged_submission` answered 0128 with "Revision
    1 still stands and has not been tested: test it". The model resubmitted
    the identical script at 0133. `repeat_refused` then said "read its answer
    ... change what it names, keep every other line ... and submit the whole
    subflow again". The model sent it twice more (0135, 0137), and the brief
    ended.
  - Brief-5 did the same at 0188-0197, right after 0190 had read under
    `undoes: act-20`. A retest there might have settled act-20. Brief-3 hit
    the same words at 0083-0084, but recovered.
  - The source is `runtime/llm/repeat-guard/candidate-feedback.ts`
    `builderInstruction`. For `core.submit_subflow` with a failed outcome and
    no issues, it always returns `refusedSubflowWithoutIssues`. It has no
    branch for `UNCHANGED_CODES`, unlike the candidate path, which uses
    `unchangedSubmission`. Even that candidate text says "change the step",
    where the true next call for an untested unchanged revision is a test.

## R8 causes from r2: status

| R8 cause | Status in this run |
| --- | --- |
| A trial's own Buy Now got no destination and refused every trial | **Gone.** Every trial Buy Now (act-11, -12, -15, -18, -21, -24) was listed under cannotUndo as "left on the site; nothing it could change showed a change" and never held a trial back. The same class remains for a trial act on no list: "confirm the office address" (modify_existing). It is settled only by naming an unrelated list, as above. |
| A refused trial was answered from memory (`already_answered`) after the settling look | **Gone.** No `core.test_subflow` was answered `already_answered` anywhere in this run. 0090 refused, the 0092 look ran, and 0096 ran the trial. 0187 ran fresh after 0183. |
| The reset wording promised that cannotUndo keeps a strict act | **Gone.** The words now say "cannotUndo never settles a reversible act". The reset brief-8 did not loop: 7 calls, done. At 0244 Core refused the home-address re-pick under `undoes: act-29` as `candidate.undo_unproved`, so the checkout was left on the office address. That is harmless here. |

## Cause

**Class: product defect (Core).** The terminal cause: Core has no authorable
way to store values read one by one as a single row. The one node it offers
for that, `builtin.data.write-records`, can only be fed through an input port
that the script format cannot connect. The refusals then misled twice: a
`records` synonym turned the rows into a schema-less record output, and the
unconnected-port refusal pointed at line 3.

Contributing causes, in order of cost:

- **C2 (Core): builder repeat words for an unchanged submission.**
  `repeat-guard/candidate-feedback.ts` `builderInstruction` tells the model to
  change and resubmit where the answer it repeats said to test. This ended
  brief-4 and brief-5.
- **C3 (Core): a tab moved silently during a refused test.** A Core-driven
  navigation during `core.test_subflow`'s refusal left the tab on another page
  without reporting it, so the settle reads ran on the wrong page (0130, 0161).
- **C4 (Core): settlement of acts on no list.** Trial and entry-preparation
  acts that live in no list (a checkout choice) are settled only by naming any
  list. The ledger accepts the cart for an address choice, which proves
  nothing, and costs one model turn per act per brief.
- **C5 (Core plus model): a baseline accepted on an unrelated list.**
  `create_baseline_required` printed only the current page's list (the
  sponsored related-products list). Brief-3 used it, and Core accepted it as
  the Buy Now baseline (0056).
- **C6 (Core plus model): no next-step guidance after a baseline read.**
  Nothing told brief-1, after its complete cart read, "the baseline is now
  observed as destination-5: press again with it". The model oscillated until
  the repeat guard ended the brief.
- **Model mistakes the product caught correctly.** These were the stale
  handles at 0062 and 0078, the missing office address at 0068 (caught by the
  judge), the oscillation in brief-1 (caught by the repeat guard), and the
  plan split (folded by `amend_plan`).

The task wording, oracle and fixture are not the cause. The judged run
matched the expected values ($7.59, the Northgate Dental address, Thursday,
September 24). The judges read the table requirement correctly. A person can
do this on the site.

Environment is not a cause either. The single malformed provider reply at 0005
was retried and cost nothing further. No stall, crash or balance error
appears in the Lab log.

## Proposed fix (least general first)

1. **Let write-records take its rows from bound values** (Core,
   `nodes/data/write-records.ts`). Give the node an authorable `records`
   parameter: a list of row objects whose values may be `$step.<label>.<output>`
   bindings, resolved at run time. The node uses this parameter when its input
   port is not connected, so the port becomes not required, and
   `validateRequiredInputConnections` stops refusing it.
   - With a `records` parameter on the node, `matchAuthoringParameter` matches
     it by id before the `records -> recordOutput` synonym, so 0226's script
     would assemble as written.
   - When no schema is written, derive `recordOutput.schema` from the row
     keys (`authoring/record-output.ts` `columns`).
   - Add one generic script-format example (`flow-bootstrap/plan/flow-script-format.ts`)
     on a different kind of site and act: for instance, an account page's plan
     name, renewal date and price read one by one and saved as one row. It
     must never name a store, checkout, kettle or address.
   - Test seams:
     - `nodes/data/tests/write-records.test.ts`: rows from bound values write
       one record with those values, and a missing binding fails clearly.
     - `flow-bootstrap/authoring/tests/`: a script whose last step is
       write-records with `records: [{a: $step.x.value, b: $step.y.value}]`
       assembles with no `required_input_unconnected`, and its derived schema
       has fields a and b.
     - A negative test: a row naming no earlier label is refused at its own
       line.

   This alone would have turned 0211 or 0226 into a passing judged run.
2. **Place `nodes.<key>` issues by key** (Core,
   `flow-bootstrap/authoring/locate-issue.ts`, or emit an index in
   `plan/validation.ts:367`). Either record a key-to-index map in
   `script-locator.ts`, or have `validateRequiredInputConnections` write
   `nodes.<index>`. Give that issue an `instead` saying how the port is fed.
   Test seam: `authoring/tests/locate-issue.test.ts`. An unconnected required
   input on a later node must be placed at that node's own step and line,
   never at the block's first step.
3. **Say "test it" when an untested unchanged revision is resubmitted**
   (Core, `runtime/llm/repeat-guard/candidate-feedback.ts`). In
   `builderInstruction`, when the earlier result code is in `UNCHANGED_CODES`,
   name `core.test_subflow` with that revision and digest as the next call,
   and make the same change on the candidate path. Test seam:
   `repeat-guard/tests/candidate-feedback.test.ts`. A repeated submission
   whose earlier answer was `candidate.unchanged_submission` must get words
   that name the test with its revision and contain no "submit the whole
   subflow again".
4. **Report where the tab stands after a refused test** (Core, `site-reset`
   pre-trial re-read, or the subflow entry preparation; the exact path is
   unverified). Either return the tab to the page it was on, or add the fresh
   location and view to `trial_reset_required`. Test seam: a site-reset or
   builder-loop test with a fake target whose re-read navigates. After the
   refusal, the loop's next view must carry the new location.
5. **Later, generically.**
   - Only list as a baseline a list whose page is where the act's effect would
     show (C5).
   - After a complete read that follows `create_baseline_required`, tell the
     model to press again with that ref (C6).
   - For an act on no list, settle from a complete read of the act's own
     control state (C4), as a toggle already is, instead of from any list.

None of these touches the task, the oracle or site-specific guidance.

## Chat and UI (screenshots in `run-mvgf04kw-310fc169.ui-review.local`)

- **38-failure-panel.** The final message says "the part that reaches
  checkout never passed its own test". This is false: revision 4 passed at
  0096, and the judged run did every checkout act. The supervisor's 0232 and
  0250 reasons say the same thing. Core passes that reason through unchecked
  against the brief returns, which record brief-3 as done with its trial
  answered yes.
- The same panel then says "Saved candidate draft. **Verification pending**;
  the Flow's steps are unchanged." Verification was not pending: the run was
  judged no.
- The reset message lists internal act ids ("act-9, act-11, act-12 ...") and
  says the site "is not as the build found it". Each of those acts was
  recorded as having changed nothing.
- **35-mid-build-panel and the later briefs.** "Open page: Didn't work: the
  request had something it doesn't take". Each later brief's opening call
  (0102, 0141, 0204, 0223) was refused `invalid_input` /
  `unexpected_input_keys` by the downstream
  `domain/src/runtime/llm-evidence/node-run/run.ts:209-211`, although the
  recorded call holds only `node`, `parameters` and `consequences`. Every
  refused opening carried `phaseStart`; the two openings that succeeded (0013,
  0044) did not. Cause not traced. The builder recovered each time, but the
  chat shows a failure on every brief.
- **38-failure-scenario.** The store is left on checkout with the office
  address chosen, and the cart badge still shows 2. That is consistent with
  the ledger.

## Not verified

- Which Core path moved the tab at 0126 and 0159 (the re-read or the entry
  preparation).
- Why each later opening call is refused `unexpected_input_keys`. The
  correlation with `phaseStart` is observed; the mechanism is not.
- That write-records, given a `records` parameter, would pass the executor's
  record capture for bound scalar values. This is inferred from
  `write-records.ts` and `record-output-contract.ts`; no test was run.
- The exact chain at 0212, where the model wrote `writeRecords.records`
  without a schema. The `not_derivable` there may have come from the missing
  schema alone.

## Rerun guidance

Do not rerun unchanged: the table step cannot be authored. Rerun once after
fix 1 lands with its tests, ideally with fixes 2 and 3, and after both lane
trees are synced. Expect brief-3's checkout path to pass again. The judged run
then needs only the row step.
