# run-mvrj7qg8-6916b3f7: office checkout review, rerun round 6

Status: debugged terminal failure. Read-only analysis: no source edit, build, browser run, paid run or
commit was made for it.

## Run

- Task `everything-store-office-checkout-review`, rerun round 6, slot 1, lane tree
  `C:/Users/osrs_/FluxStuff/fxwork/t563` (downstream dev 55fe5c0e, Core 4ae8444f: t751, t752, t757/t764,
  t762/t765 and t766 are in). Build started from the real extension chat, deepseek-flash, $0.25 ceiling.
- Per-step files: `test-runs/instances/rr6-slot-1/run-mvrj7qg8-6916b3f7/steps` (182 folders; `index.md`
  is the table). UI review: `test-runs/instances/rr6-slot-1/run-mvrj7qg8-6916b3f7.ui-review.local/` (26
  moments) and its `.json` overlay samples.
- Build 03:13:02-03:20:59 UTC (Core's web build took the first ~7 minutes). Verdict `failed`,
  `lab.candidate_not_promoted`, "the candidate's test run was judged **unknown**". Cost $0.1282 of $0.25.
  The Lab log shows a normal start; no provider, balance or crash error. Every refusal below is a
  deterministic Core answer.
- Spend per brief (from `index.md` and the dispatch returns):

  | Brief | Kind | Spent | Calls | Ending |
  | --- | --- | --- | --- | --- |
  | brief-1 | build `kettle_checkout` (p1+p2) | $0.0496 | 33 | partial: stopped by the repeat guard on the act-15 undo (0076) |
  | brief-2 | repair from trial.b641 | $0.0409 | 24 | partial: stopped by the repeat guard on the act-19 undo (0130) |
  | brief-3 | reset | $0.0234 | 23 | blocked: stopped by the repeat guard on the act-19 undo (0181) |
  | supervisor (+2 judge calls, chat) | - | $0.0143 | 8 decisions | blocked (0182) |

## How far it got (question 1)

- **0001:** chat turned the message into `flow.createHere` with the instruction word for word.
- **0003-0006: plan.** One subflow `kettle_checkout` with both parts: p1 (eight goal facts, Buy Now, office
  address, standard delivery, gift card, no Plus trial, order not placed; `lastingActs: ["create_new"]`) and
  p2 (one row, columns item/address/arriving/total). Core accepted it. One build brief dispatched.
- **Brief-1, exploration (0007-0037).**
  - Cookie banner declined; first search went through a robot check and found nothing; a shorter search
    found the kettle; product page opened (0015).
  - 0017: Buy Now refused `candidate.create_baseline_required`. The builder read the cart (0021, 0025,
    issuing destination-5/6), came back and pressed **Buy Now with `resetDestination: destination-5`**
    (0031): accepted, landed on checkout. This is act-6.
  - Checkout opened on the store's defaults: **home address** (t951 "418 Larkspur Ave"), Brightaisle Day
    delivery, gift card off, Plus trial ticked (0031 page).
  - 0033 untick Plus, 0035 standard delivery, 0037 gift card on. All declared no lasting class.
  - **Model mistake:** 0034 says "Checkout shows the kettle, office address, ..." and 0038 "Checkout
    already shows ... office address". It never chose the office address.
- **Revision 1 (0039)** had no address step. **0041: whole-run test** (the plan is one subflow, so every
  `test_subflow` is the judged whole run) **`execution_failed`** at step 5 Buy Now,
  `web.action.blocked_by_dialog`: step 3 "close the assistant chat if it shows" pressed t720, the
  assistant's launcher, which is a toggle. In exploration the chat was open, so it closed it; in the trial
  the chat was still closed, so it opened it over Buy Now. Not judged (it did not run to the end).
- **0042-0043: resets admitted.** act-6 (Buy Now) settled `cannotUndo` "nothing it could change showed a
  change" on the cart read again: correct, Buy Now leaves the cart alone.
- **Revision 2 (0045)** closes the chat with its own "Minimize chat" (t729). **0047: whole-run test ran
  all 13 steps and stored 1 row; judged no twice (0050 conf 0.82, 0051 conf 0.85).** Both judges, in
  their own words:
  - "address is the home address (418 Larkspur Ave Apt 3B), not the office (Northgate Dental, 2100 N
    Vancouver Ave Suite 200)" (`wrong_value`, step s9);
  - "arriving is stored as "Arriving Thursday, September 24" instead of "Thursday, September 24""
    (`wrong_value`, step s10).
  - Both are right against the oracle (`workflows/office-checkout.ts` RECORDS). Both missed a third wrong
    cell: item was "...White$19.99 · Qty: 1 · Sold by: Brightaisle", where the oracle wants the product name
    alone. The verdict was still correct.
- **0052-0057: the builder explored the address change.** Change (t950), office radio (t1071), then
  **"Deliver to this address" declared `modify_existing` (0057): act-15.** Core ran it and attached
  `outsideBrief`: "your brief's parts ... ask only for create_new ... Write no step of your subflow that
  does it, and do not do it again". The task requires that act.
- **Revision 3 (0059)** has every fix the judges asked for except the item cell. It adds the three address
  steps, with the Deliver step written `consequences: none` (after the note), and reads the bare date
  (t978).
- **0061: trial refused `candidate.trial_reset_required`** (reset 0062 `refuse`): act-15 in `actsToUndo`,
  settle "Nothing read shows where its effect would be: read the list where it would show completely and
  name that list's ref as resetDestination ...". act-6 `cannotUndo`.
- **0063-0076: brief-1 tries to undo act-15.** See question 3. The repeat guard ends the brief (0076).
- **0077-0078: repair brief-2** from trial.b641 (the closest trial).
- **Brief-2 (0079-0130).**
  - Pressed Buy Now again with no resetDestination (0083): act-16. Since that opens a fresh checkout
    session, the address was back to home (0084 summary).
  - Changed the address again: 0085, 0087, and **0089 Deliver `modify_existing`: act-19**, with the same
    `outsideBrief` note.
  - **Revision 3 again (0095, digest b6c1..., a different Flow from brief-1's revision 3, d845...).**
  - 0097: trial refused; act-15, act-16 and act-19 are in `actsToUndo`.
  - 0102: act-16 settled. 0110: act-15 settled (question 3).
  - 0108: unchanged submission. 0112: the repeat guard refused the same submission.
  - 0114 and 0123: trial refused, with act-19 alone.
  - 0117-0130: undo attempts on act-19 all refused; the repeat guard ends the brief.
- **0131-0132:** supervisor ends `blocked`; held `project.completion_reset_first` for act-19.
- **0133-0181: reset brief-3.** Every undo of act-19 refused (question 3); the repeat guard ends it.
- **0182:** supervisor ends `blocked`: "it changed the delivery address on the site to your office address;
  I could not put that back ... Nothing was ordered and no payment was made." That is accurate: the final
  checkout page (0137, 0145) shows Northgate Dental, and the cart still holds 2 items.

**Distance.** The model did every act the task asks for, live (0031-0037, 0052-0057, again in 0083-0089).
It wrote revision 3 with the address and date fixed, twice. Two whole-run tests ran: one stopped at Buy
Now, one ran 13/13 and was judged no correctly. Revision 3 was **never tested**: four trial requests (0061,
0097, 0114, 0123) were refused for the address act.

**Where it stopped going forward:** 0061, the first trial after the address act. **Terminal:** act-19
could not be undone or settled by any call (0116-0181).

## Why "judged unknown" (question 2)

**The Lab misreads the ending. Core judged no.** Neither t766, t751's admission or settlement, nor
t757/t764 produced it.

- The only judged whole run is trial.b641 (revision 2), judged `no` by both calls (0050, 0051). The
  requested-output gate passed it: findings `result.counts_look_right`, `result.summary_withheld`.
- t766's act grounding did not fire. The defects were `wrong_value` on stored cells, with step ids, so
  nothing was demoted to `unsure` or `not_judged`.
- Core's ending row in the panel (`26-failure-panel.png`) says the whole Flow "ran all 13 of its steps and
  stored 1 row, and was judged not to do what was asked".
- Since t753 a draft whose ending row was told says only `TOLD_DRAFT`: "I kept what I wrote as a draft,
  and nothing was put into the Flow. You can ask me to build it again." (Core
  `runtime/conversations/commands/build.ts`, `automationStudioConversationCandidateDraftSaid(candidate,
  told)`). That sentence carries no verdict.
- The Lab reads a chat draft's verdict only by matching those words against Core's sentence for each
  verdict (downstream `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`,
  `chatDraftVerdict`, called from `createdFlowChatCandidateDraftOutcome` in
  `chat/build-from-chat.ts:186`). It never generates the told sentence, so every told draft is recorded
  `verdict: "unknown"`.
- The trial sessions it does read carry no verdict, so the event's `trials` (revision 1 `failed`,
  revision 2 `succeeded`) do not show it either.
- **Class: Lab reporting defect, introduced by t753's wording change.** The summary line misleads every
  debug of a told project draft. It changes no product behaviour.

## Each reset refusal (question 3)

| Step | Build tried | Core answered | Right? |
| --- | --- | --- | --- |
| 0017 | Buy Now, `create_new`, no destination | `create_baseline_required` (`another_page`) | Yes. Recovered at 0031 by naming the cart. |
| 0061, 0097, 0114, 0123 | test revision 3 | `trial_reset_required`, act-15/16/19 open | **The gate, yes:** the address is a lasting act of the build (the fixture stores it in the checkout session, `state/checkout-ops.ts` `set-address`), and the 2026-10-12 rule says undo it. **The settle words, no:** the act changed a shown value on checkout and named no list, yet the only route offered is "read the list ... name resetDestination". |
| 0064, 0104 | navigate to checkout under `undoes: act-15` | look admitted; settle unchanged | Correct. |
| 0066, 0121 | Change (t950), `consequences: []`, `undoes` | `undo_unproved` `undeclared_press`, `canMeet: this_page` | Correct for Change alone (it is not the inverse). But "another call on this page can meet it" is false: see the next rows. |
| 0070, 0117 | home radio t1068, `modify_existing`, `undoes` | `target_unobserved` `handle_not_in_packet` | Correct: after the reload the chooser is closed, and t1068 was not in that view. The model never opened Change without `undoes` first. **Model mistake**, then repeats (0072-0076, 0119, 0126-0130). |
| 0147 | Deliver (t1072), `[]`, `undoes: act-19` | `undeclared_press`, `this_page` | Consistent with the rules, but this is the act's own control. |
| 0157 | Deliver, `modify_existing`, `undoes: act-19` | `undo_unproved` **`no_destination_read_before`, `canMeet: no_call`**: "The list this would remove the item from was not read complete before the act" | **Wrong class.** The admission read the act's own control with an inverse class as a subject *deletion* (`subjectDeletion` in `site-reset/undo-admission.ts`). act-19 created no subject and named no list; nothing here is a removal. |
| 0159 | home radio, `[]`, `undoes` | `undeclared_press`, `this_page` | Per the rules. |
| 0169 | home radio, `modify_existing`, `undoes` | `no_item_identity`, `this_page` ("carries no title of the item") | **Wrong.** The radio is labelled with the full address. It is not `aboutTheAct`, so `unmatched()` answers `no_item_identity` because `control.subject` is undefined. |

**No admission path exists for this act.** Pressing the original option and confirming is exactly what a
person does. Core can neither admit it nor settle the act afterwards:

- act-19 is a `modify_existing` press that **reloads the page**. The domain emits `controls` only for a
  step that stayed on its document (round 5 cause 2), so there is no toggle.
- It named no list, so there is no destination.
- `undo-admission.ts` therefore has only `moving`, `own item`, `subject` and `destination` paths to try,
  and each refuses with a `canMeet` that promises another call.
- `judge.ts` `unmet()` / `undo-reach.ts` never moved it to `actsUnsettleable`. The builder never got the
  honest `gate_unsatisfiable` exit, and every brief ended on the repeat guard instead.

**Two settlements, one sound and one not (`site-reset/undo-claims.ts` `ran()`).**

- **0102: act-16 settled.** A list read under `undoes: act-16` named destination-5, the cart, where
  Buy Now would show. The read's own extraction handle (extraction.1, the product page's related list)
  found 0 records. Core's own re-read of the cart issued destination-5/6, still 2 items, and act-16
  settled "left; nothing changed". That is sound: the cart is the right witness for Buy Now.
- **0110: act-15 settled unsoundly.** A look on the checkout page under `undoes: act-15` named
  **destination-6, the cart**, an unrelated list; its read also found 0 records. Core attached the cart
  as act-15's destination (`ran()` checks only that the call landed, which is the t751 R6 narrowing). The
  unchanged cart then settled act-15.
  - The outcome happened to be harmless: act-16's fresh checkout session had replaced act-15's address.
  - The mechanism is the round-5 accident in a new shape: any issued list, named for any act, is
    accepted as its witness. Named for act-19, the same move would have settled it while the office
    address was still on the page.

## Root causes (question 4)

### Cause 1, terminal (product defect): a selection confirmed by a reloading press has no witness, no admissible undo, and no honest exit

The facts are in question 3. This is the **witnessless-act class again**: round 2 C4, round 3 A1, round 4
adoption too wide, round 5 adoption too narrow, round 6 a `modify_existing` that reloads. Round 5 fix 2
asked to stop patching adoption. The structural fix was not landed, so the class came back in a new shape.

**Owning files.**

- Core `flow-bootstrap/site-reset/ledger.ts` / `ledger-act.ts` (what an act records).
- Core `flow-bootstrap/reset-settlement/control-tracker.ts` (`standing()`) and `judge.ts`
  (`unmet()`, `adoptable()`).
- Core `flow-bootstrap/site-reset/undo-admission.ts`, `undo-paths.ts`, `undo-reach.ts`, `undo-claims.ts`.
- Downstream `domain/src/runtime/state-diff/places/diff.ts`, the rule that emits `controls` only for a
  step that stayed on its document.

**Generic fix.**

1. **A value witness for a lasting press.** When a press declared `modify_existing` lands and the
   domain's change list shows a value at one place replaced (here t951 "was ..."), record it like a
   toggle: the place, `from` (the start count) and `to`. Do the same for a press that reloads to the same
   address. Two ways to get there:
   - the domain emits the place for a same-address reload, treating it as staying on its resource; or
   - Core reads the place from the next fresh read of that address.
2. **Settle by value.** `standing()` holds when a fresh read after the latest lasting call shows `from`
   at that place.
3. **Admit the inverse.** On the act's own control, admit an undo declaring `modify_existing` as `own`
   when the act has a value witness, and let the settlement judge the result. A choice made with no
   lasting class before it (here the original option) is a step toward the undo, not an undo.
4. **Never mislabel.** `subjectDeletion` applies only to an act that created a subject or named a list;
   otherwise answer by the value path.
5. **Mechanical invariant (round 5 asked for it too).** Every act in `actsToUndo` has at least one call,
   named by its settle words, that `target` admits. If none exists, the act goes to `actsUnsettleable`
   (`gate_unsatisfiable`), and no refusal for it says `canMeet: this_page`.
6. **Settle words follow the witness kind.** A value act is told "set it back where it shows, then look";
   the list route is offered only to an act that changed a list.

**Tests that fail first.**

- A `site-reset/tests/` ledger test: a `modify_existing` press whose page reloads to the same address
  and replaces a shown value, then an undo on the same control declaring `modify_existing` after the
  original option is chosen. Expect it admitted `own`, and the act settled `restored` once a fresh read
  shows the start value. Today it is refused `no_destination_read_before`.
- A property test over ledger states: the invariant in item 5.
- An `undo-claims` test: a look under `undoes: act-A` that names a list read on another page, never
  named for act-A, and not on act-A's resource, leaves `act.destinations` unchanged.

### Cause 2 (model mistakes, and one product contradiction that fed them)

- **0034/0038, brief-1:** claimed the checkout already showed the office address; revision 1 had no
  address step. That cost the first judged run (0047).
- **0031-0039:** step 3 closed the assistant with its launcher toggle (t720), which opened it during the
  trial (0041).
  - The runtime's dialog handling then retried 4 times and did not use the dialog's own "Minimize chat".
  - Under the every-node-retries rule, a page-level assistant panel with its own close control is an
    interruption a run could close. This is a minor runtime gap; not traced.
- **0066-0076, 0116-0130:** retried an unshown handle and repeated refused calls until the repeat guard
  stopped it. It never opened the chooser without `undoes` and then pressed the radio.
- **Product contradiction, owner Core `service/project-build/brief-ports.ts` (`outsideBrief`).**
  - The plan's p1 listed `lastingActs: ["create_new"]`, though four of its goal facts change the checkout
    session.
  - When the builder declared `modify_existing` honestly, Core said "Write no step of your subflow that
    does it, and do not do it again", about a step the task requires.
  - Brief-1's revision 3 then declared that step `consequences: none`. Meanwhile the three toggles, also
    stored in the session (`office-checkout.ts`: "each choice reloads the page"), were declared none,
    listed only as "possibly lasting", and never blocked anything.
  - So the honest declaration is what made the build unsettleable.
  - Generic fix: the note asks the supervisor to amend the plan's classes (`project.amend_plan`) instead
    of forbidding the step. The plan check should also refuse a part whose goal facts change settings
    while `lastingActs` lists only `create_new`. That second check is a model-judgment surface, so it
    needs care.

### Cause 3 (Lab reporting defect): told drafts read as `unknown`

**Owning files.** Downstream `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`
(`chatDraftVerdict`, `createdFlowChatCandidateDraftOutcome`) and `chat/build-from-chat.ts`.

**Fix.** Never read a verdict from prose:

- take the last judged whole run's verdict from Core's structured answer: the ending row's recorded
  tests, the build's failure diagnostic (`get-flow-bootstrap-failure`, `diagnostic.candidate.trials`),
  or a verdict field on the trial session summary;
- recognise `TOLD_DRAFT` as "told", never as a verdict.

**Test that fails first.** In `creation/tests/candidate-draft.test.ts`: a told project draft whose last
whole test was judged no records `verdict: "no"`.

### Task and fixture

No defect. The reworded instruction led the model to Buy Now first time (0016, 0031). Rounds 1-2
pressed Add to Cart, so the audit's rewording worked. Every fact the oracle checks was reached live. The
oracle's row is reachable as worded.

## Other defects seen

1. **Refused undos shown as "Done" (UI).**
   - `13-mid-build-panel.png` and `21-mid-build-panel.png` show "Put back · Change — Done" for 0066 and
     0121, both refused unrun.
   - Core `runtime/activity/observer.ts` `outcomeOf()` calls a `core.run_node` result "done" unless its
     code matches a word list (`reject|fail|error|...|unobserved`). `candidate.undo_unproved` and
     `candidate.create_baseline_required` match none of it.
   - Fix: classify by the answer's shape (`ok: false` with `failed`/`canMeet`), as t649 did for
     submissions. A test beside `activity/tests/observer.test.ts`.
2. **Judge missed a wrong cell** (0050, 0051): item held price, quantity and seller. A third revision
   would have failed the oracle on it. Not traced.
3. **Two different proposals are both "revision 3"** of `kettle_checkout`: brief-1 at 0059 (digest
   d845...) and brief-2 at 0095 (b6c1...). The kept draft's revision number is ambiguous in returns and
   debugs. Not traced.
4. **Ending row cut mid-word**: "...and might have left something behind, so che..."
   (`26-failure-panel.png`), from Core `service/project-build-ending/ending-told.ts`.
5. **The ending row overstates Buy Now.** It says the build "clicked "Buy Now", ran the step "buy it now"
   ... but could not undo them, so they may still be on the site". Core had settled both Buy Now acts as
   leaving nothing changed (0042, 0102); only the checkout session they opened remains.

## Rounds 1-5 causes and t751/t752/t757/t764/t766: status

| Item | Status in this run |
| --- | --- |
| Rounds 1-2: pressed Add to Cart (task wording) | **Fixed** by the audit's rewording: Buy Now pressed every time. |
| Round 4 read identity (t743 d2) | **Working.** The trial's reads returned live values (home address, $7.59), not values bound at build time. |
| Round 5 cause 1 (toggle already back, deadlock) | **Not exercised.** The toggles were declared without a lasting class. |
| Round 5 cause 2 (witnessless act, `controls` only on same document) | **Recurred in a new shape** (cause 1): a `modify_existing` press that reloads. |
| Round 5 C6 (retry Buy Now from the wrong page) | **Did not recur.** Brief-1 returned to the product page and named the cart (0031). |
| Round 5 accidental adoption (unrun call names a list) | t751 R6 (landed only) is in effect. **An unrelated list still settles an act** (0110). |
| Round 5 defect 2, untick worded "Ticking" | **Not observed.** The Plus untick fell between UI samples; gift card "Ticking" (moment 7) is a real tick. |
| t752 grounded judging | **Working:** both judges grounded the defects in stored cells and step ids. One cell was missed (other defects 2). |
| t757/t764 requested-output gate | Passed the one judged run; did not affect the ending. |
| t766 act grounding | Not exercised: no act defect was claimed. |
| t751 reset admission/settlement | Admitted the Buy Now settlement soundly (0042, 0102). Produced the act-15 settlement on an unrelated list (0110), and refused every inverse of act-15/19 (cause 1). |
| t762/t765 list pausing | Not exercised: no list was paged. |
| Repeat guard | Working. It ended all three briefs, each looping on a condition no call could meet. |

## UI review (question 5)

Screenshots: `test-runs/instances/rr6-slot-1/run-mvrj7qg8-6916b3f7.ui-review.local/` (26 moments).

- **Chat stream.** Assistant turns with action cards, a status line and Stop at every moment (`03`, `07`,
  `10`, `13`, `21`, `25`). Defects:
  - **"Put back · Change — Done"** for undos Core refused unrun (`13`, `21`; other defects 1). The person
    reads that FluxIQ put the address back when nothing was pressed.
  - **"Putting the site back: choosing 'Dana Whitfield, 418 Larkspur Ave ...'"**, with a card "Working
    on it", for calls refused unrun (`13`, `25`). The overlay says the same at moments 13, 20, 24 and 25.
  - **The whole-run test's steps sit under a "Supervisor" heading** (`09`), though the builder's
    `test_subflow` ran them.
  - **Counts disagree.** "Step 3 of 12" (`09`, `10`) beside the ending's "ran all 13 of its steps".
  - **Plan card cut** mid-word: "set office addres..." (`03`).
  - **Ending (`26`).** One dense paragraph of leftovers. It is cut mid-word ("so che..."), then followed by
    "I kept what I wrote as a draft ...".
    - It does say the run was judged not to do what was asked.
    - It names the office address as possibly left, which is true.
    - It names the Buy Now presses as could-not-undo, which overstates (other defects 5).
- **Overlay.**
  - Present in 25 of 26 moments (absent only at start); no presence or visibility toggles.
  - Moment 9 is `flickering` (2 visibility toggles).
  - **Position jumps between y=16, ~185, ~450-540 and y=620** across moments and within moments 3, 5, 6,
    8, 9 and 16. At y=16 it sits over the site header. Same as round 5.
  - Copy:
    - moment 12 "Testing one part of the Flow" for a trial that was refused before running;
    - the end reads "Build failed | Build ended: no Flow was built" (`26-failure-scenario.png`), plain
      and correct.

## Recommended fix

All generic; nothing names this task, site or answer, and no model guidance mirrors the scenario.

1. **Cause 1 (Core, with one domain rule), structural:** a value witness, an own-control inverse, the
   act-to-admissible-call invariant, and settle words by witness kind. Files, steps and tests are under
   cause 1.
2. **Unrelated-list settlement (Core `undo-claims.ts` `ran()`, `judge.ts`):** attach a named list to an
   act only when it was read on the act's own page or resource, or the act already named it.
3. **Lab verdict (downstream `candidate-outcome.ts`):** read verdicts from Core's structured trial data,
   never from chat prose (cause 3).
4. **Activity status (Core `activity/observer.ts`):** a refused run_node is "not done", by shape.
5. **`outsideBrief` wording (Core `project-build/brief-ports.ts`):** point to a plan amendment; never
   forbid a step the parts require.
6. Lower: the judge's per-column check (other defects 2), revision numbering across briefs (3), the
   ending-row cut (4), the Buy Now wording in the ending (5).

**Rerun guidance.** Do not rerun unchanged. Any build that explores the address change before a trial
will block on it again. At minimum, land fix 1 with its tests, and fix 3 so the Lab reports the real
verdict. With fix 1, expect revision 3 to reach its trial; the item cell (other defects 2) is then the
next likely judge or oracle failure.

## Not verified

- That a same-address reload is exactly why the domain emitted no `controls`/place for act-15 and act-19.
  This is inferred from round 5's rule in `state-diff/places/diff.ts` and from the press "navigated its
  page before it could answer" (0057, 0089). `diff.ts` was not re-read.
- Which `undo-admission.ts` branch answered 0147 and 0159: inferred to be the `strictReset` empty-classes
  check at line 129 from the `undeclared_press` code; not stepped through.
- Whether a `resetDestination` naming another page's list on a look is meant to be accepted.
  `receipts.named()` was not read.
- The runtime's dialog handling at 0041, and why it did not use "Minimize chat".
- Whether the item-cell miss comes from the judge prompt or from the evidence shown to it.
- How Core numbers revisions across briefs.
- The Plus untick's chat wording: no UI sample fell on it.
