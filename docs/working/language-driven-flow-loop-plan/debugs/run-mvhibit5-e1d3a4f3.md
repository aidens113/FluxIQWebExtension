# run-mvhibit5-e1d3a4f3: office checkout review, rerun round 5

Status: debugged terminal failure. Read-only analysis: no source edit, build, browser run, paid run or
commit was made for it.

## Run

- Task `everything-store-office-checkout-review`, rerun round 5, slot 1, lane tree
  `C:/Users/osrs_/FluxStuff/fxwork/t563` (downstream dev e04711f0, Core 3caf1ff0, so t743 and t748 are
  in). Build started from the real extension chat, deepseek-flash, $0.25 ceiling.
- Per-step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvhibit5-e1d3a4f3/steps` (214
  folders). Trace store: `test-runs/instances/rr5-slot-1/persistent-isolated/claude-office-checkout-t563-20261020-r6/.../project.sqlite`
  (one exploration trace, one trial trace).
- Build 02:53:07-03:04:04 (UTC). Verdict `failed` (`lab.chat_build_failed`), no Flow created. The live
  guard recorded $0.143394936. The Lab log shows a normal start and a recorded verdict; no provider,
  balance or crash error. Every refusal below is a deterministic Core or domain answer.
- Spend per brief (from the dispatch returns):

  | Brief | Subflow | Spent | Calls | Ending |
  | --- | --- | --- | --- | --- |
  | brief-1 | buy_now_checkout | $0.0184 | 12 | blocked: plan asked for an output no step makes |
  | brief-2 | delivery_and_payment | 0 | 0 | blocked: predecessor blocked |
  | brief-3 | buy_now_checkout | $0.0195 | 12 | **done: trial yes (0054), judged twice** |
  | brief-4 | delivery_and_payment | $0.0205 | 14 | blocked `gate_unsatisfiable` (act-7, act-8) |
  | brief-5 | checkout_summary | 0 | 0 | blocked: predecessor blocked |
  | brief-6 | delivery_and_payment | $0.0157 | 12 | blocked `gate_unsatisfiable` (act-7, act-8, act-12) |
  | brief-7 | reset | $0.0192 | 16 | blocked, stopped by the repeat guard |
  | brief-8 | checkout_summary | $0.0379 | 23 | blocked: act-18 "listed, yet refused as already back" |
  | supervisor | - | ~$0.012 | 13 decisions | blocked |

## How far it got

- **0003-0006: plan.** Three subflows: `buy_now_checkout` (p1), `delivery_and_payment` (p2+p3),
  `checkout_summary` (p4). The plan gave `buy_now_checkout` an output `checkoutReady` that none of its
  parts makes. Core accepted the plan (0004).
- **Brief-1 (0007-0031).** Search, product page; Buy Now refused `create_baseline_required` (0017);
  cart read (0021) issued destination-5/6; it never pressed again. Four submissions were refused for the
  output (`output_unbound`, `output_unknown_port`, `output_not_a_value`) and Core ended the brief. The
  supervisor dropped the output with `project.amend_plan` (0032-0033). Cost: one brief.
- **Brief-3 (0036-0058).** Buy Now refused again (0042). The model re-read the cart (0043-0044, against
  the retry note), then retried **from the cart page** with handle `"t?"` and `consequences` inside
  `parameters` (0045-0046: `target_unobserved`, `malformed_handle`). It navigated back (0047-0048) and
  submitted the subflow without ever pressing Buy Now live. Revision 2's trial **answered yes and was
  judged yes twice** (0054-0057). Its press is act-7, left on the site, with no witness.
- **Brief-4 (0059-0087).** Core's entry preparation re-ran `buy_now_checkout` (act-8). The builder
  explored delivery, gift card and Plus on checkout and submitted revision 1 (0079). **0081: trial
  refused `trial_reset_required`; act-7 and act-8 `actsUnsettleable`, `failed: nothing_to_name`.** It
  undid its own toggles (0083-0086) and ended `gate_unsatisfiable`.
- **Brief-6 (0090-0114).** Entry preparation made act-12. The builder did the **whole p2+p3 checkout
  path live**: address chooser, office address, Deliver to this address (act-15), standard delivery,
  gift card (act-17), Plus off (act-18) (0093-0104). Revision 1 (0106) has every step the task asks
  for. **0108: trial refused; act-7, act-8, act-12 unsettleable (`nothing_to_name`).** Ended blocked.
- **0115-0118:** ending held `completion_reset_first` for act-15 and act-18; reset brief-7 dispatched.
- **Brief-7, reset (0119-0151).**
  - 0122-0123: to undo act-18 (an untick) the model sent `checked: false` again. Core admitted it as
    the act's own toggle (`own`); the press was a no-op ("Check state already set").
  - 0126-0135: undo of act-15 on the home-address radio: refused `no_item_identity`, then
    `undeclared_press`, both `canMeet: this_page`, then repeat refusals.
  - 0136-0139: completion with `cannotUndo` refused twice (`reset_acts_in_place`).
  - 0140-0141: a radio check with `undoes: act-15, resetDestination: destination-1`. **The call never ran**
    (`target_unobserved`), but destination-1 was attached to act-15, and from that moment act-7, act-8
    and act-12 changed from `nothing_to_name` to "Read destination-1 completely again" (0141, 0147).
  - Stopped by the repeat guard (0149-0151).
- **0152-0155:** ending held `completion_repair_first` for `checkout_summary`; brief-8 dispatched with
  `entry.predecessors: []`.
- **Brief-8 (0156-0210).**
  - Search, product page, Buy Now refused (0166), cart (0168), stale-handle press from the cart page
    (0169-0170), back to the product page, then **Buy Now with `resetDestination: destination-5`
    accepted (0173-0174)**. Core noted it as outside the brief's parts.
  - That new checkout session **reset the checkout page to its defaults**: home address, Plus trial
    ticked, gift card unticked (pages 0174 onward).
  - Revision 1 of `checkout_summary` (navigate to checkout, four reads, write-records) submitted (0178).
  - **0180: trial refused**: act-18 in `actsToUndo`, settle "Its control ... still shows the state this
    act set: press that same control back once". act-12 and act-15 were now `cannotUndo` "left;
    nothing it could change showed a change"; act-7 and act-8 had settled.
  - **0182-0183:** pressing it back refused `candidate.undo_already_back`, `canMeet: no_call`, and the
    same refusal repeats the contradicting settle words.
  - 0184-0209: eight more identical `test_subflow` calls, each refused the same way; one repeat refusal.
  - 0210: ended blocked.
- **0211-0213:** supervisor ends `blocked` after one more `completion_reset_first` for act-18.

**Distance.** Exploration covered every fact of the task live: Buy Now to checkout, the office address,
standard delivery, gift card and Plus off, all in brief-6. One subflow trial ran and passed
(`buy_now_checkout`, 0054). Neither `delivery_and_payment` (two revisions with the right steps) nor
`checkout_summary` was ever trialled, and no judged whole run happened.

Round 4 got further in trials: one subflow, a trial to step 11 of 15, one stored row. This round's plan
split the work into three subflows, and the split put every later trial behind the reset gate.

**Where it stopped going forward:** 0081, the first trial of a dependent subflow, refused for acts no
call could settle. **Terminal:** 0180-0210, act-18 can neither be pressed back nor settle.

## Cause 1, terminal: a toggle the site put back by itself can never settle (0174-0210)

| Step | What happened |
| --- | --- |
| 0104 | act-18: the Plus checkbox, ticked by default, unticked (the task's own requirement). |
| 0123 | reset brief-7 sent `checked: false` again under `undoes: act-18`: admitted `own`, a no-op. |
| 0174 | brief-8's Buy Now opened a fresh checkout session; the page now shows the checkbox ticked, the build's start state. |
| 0180-0208 | `actsToUndo` keeps act-18 with "still shows the state this act set: press that same control back". |
| 0183, 0199 | that press refused `undo_already_back`, `canMeet: no_call`. |

The two halves read different evidence:

- **Settlement**, Core `flow-bootstrap/reset-settlement/control-tracker.ts`, `standing()`. A toggle
  holds only when *the last press at its place* left it at the start counts ("a control that reverts
  by itself never holds: the return must follow a press"). The last press at that place left it
  unticked (0104, and the no-op at 0123), so the status stays `open`, though every fresh read after the
  latest lasting call (0174) shows the start counts.
- **Admission**, Core `flow-bootstrap/site-reset/undo-admission.ts`,
  `automationStudioSiteResetUndoAdmission` and then `alreadyBack()`. It reads the control's current
  state, which equals `toggle.from`, and refuses `no_call`. Its header says "The act stays listed as
  today (`actsToUndo`)".
- **Unmet**, `reset-settlement/judge.ts` `unmet()` with `site-reset/undo-reach.ts` as `more`. It does
  not class this toggle reason as no-call-can-meet, so the act is never moved to `actsUnsettleable` and
  the builder never gets the honest `gate_unsatisfiable` exit.

The builder kept being told "press it back", and every press was refused. That is why it sent nine
`test_subflow` calls. The repeat guard did not stop those identical refused calls; the pre-trial look
moves the page each time, which probably exempts them (not traced).

**Class: product defect.** The site's behaviour (a new checkout session starts from defaults) is
realistic, and the site *is* in the start state at that place. Two defects compound it:

- t743's `already_back` named the case but left the act listed.
- The no-op at 0123 shows that the `own` admission checks only the control's current state, never
  that the requested `checked` value flips it.

## Cause 2, structural: a witnessless trial act blocks every dependent subflow (0081, 0108)

- act-7 (brief-3's trial press), act-8 and act-12 (entry preparations re-running that trial,
  `service/project-build/entry-preparation.ts`) are trial acts (`call` absent). They have no list
  witness and no toggle. They repeat no explored act, because Buy Now never landed in exploration in
  brief-3, so they have no lent destination.
- t743 narrowed A1's adoption (`reset-settlement/judge.ts` `adoptable()`) to two cases:
  - (a) issued lists that some act of the build named as a destination;
  - (b) issued lists read on the act's own page.
- (a) was empty: no act had named one.
- (b) never fires for a navigating press. `pageLocation` is set in `site-reset/ledger.ts` `trialRan()`
  only from `act.controls`. The domain emits `controls` only for a visible stateful control on a step
  that stayed on its document (downstream `domain/src/runtime/state-diff/places/diff.ts`, header).
  Core `service/candidate-trial/landed-acts.ts` `controlsOf()` reads only that field.
- With refs closed, `unmet()` answers `nothing_to_name`, so the acts are `gate_unsatisfiable`.
- The gate refuses **every** trial while they are in place, including trials whose own entry
  preparation repeats the same press. So no subflow after `buy_now_checkout` could ever be trialled.

**How it unblocked, by accident** (Core `site-reset/undo-claims.ts`, `ran()`):

- `ran()` pushes a `resetDestination` named under `undoes` onto the act **before** checking that the
  call landed. 0140's call never ran (`target_unobserved`), yet destination-1 became act-15's
  destination.
- Rule (a) then let act-7, act-8 and act-12 adopt it. destination-1 is the home page's "keep shopping"
  list, named for an address act, and they settled `unchanged` on it.
- Brief-8's own Buy Now did name the cart correctly (0174). The class is still unsound: a list named
  on an unrun call, for an unrelated act, became three other acts' witness.

**Class: product defect.** It also includes a model choice the product should have prevented: C6,
below. Had 0046 pressed Buy Now on the product page with `resetDestination: destination-5`, act-7
would repeat an explored act with the cart as its destination and would settle on a cart read, as
brief-8's press shows.

## Other defects seen

1. **Plan output with no value** (0003-0031). `project.write_plan` accepted an output on a subflow
   whose part asks only for a lasting act. It was refused only at submit, and cost a whole brief. The
   0033 warning `plan_subflow_constraint` also fired on `checkout_summary`, whose part asks for a
   table (a false positive).
2. **An untick is worded as "set checked" / "Ticking".**
   - The domain declares the verb as the node's label (`domain/src/runtime/llm-evidence/node-run/run.ts:340`,
     `verb: node.definition.label.toLowerCase()`). Core's ledger builds `did` from it
     (`site-reset/ledger.ts` `explored()`). So act-10 and act-18 (unticks) read
     `set checked "Yes, start my ... trial"`.
   - The supervisor then told the person the opposite of what happened. 0152: "the 30-day free ...
     Plus trial was switched on". 0213: "the ... Plus free trial box is ticked, and it could not be
     unticked. Please check that box yourself".
   - The overlay and chat say "Ticking" for the same untick (Core `activity/wording/action.ts`, verb
     `check`). See the UI review.
3. **Undo feedback on act-15 never names the act's own control.**
   - The model tried to undo "Deliver to this address" on the home-address radio. It was refused
     `no_item_identity` and `undeclared_press`, both `canMeet: this_page`, with no hint that the inverse
     is the act's own control, pressed again after choosing the original option.
   - It then claimed `cannotUndo`, which was refused twice.
4. **Supervisor override of entry.** 0154 sent `checkout_summary` with `entry.predecessors: []`, and
   Core accepted it. Its trial would read a checkout session left by exploration, which is a trial on
   leftovers. It never ran, so nothing was measured.
5. **Repeat guard and `test_subflow`.** Nine identical refused trials (0180-0208) cost about $0.012
   and 30 steps.

## Round-4 causes and t743/t748: status

| Item | Status in this run |
| --- | --- |
| Round-4 first divergence: read target bound to its value (t743 d2) | **Not exercised.** No read step was trialled. Unproved live. |
| Round-4 terminal: `address_not_shown` across briefs (t743 d1/c4) | **Fixed for its case.** Brief-7 and brief-8 navigated where earlier briefs had stood. One `address_not_shown` (0158) was for a search URL the model invented and no brief was shown, which is correct; it recovered the next call. |
| A1 adopted an unreachable list (t743 narrowing) | **Replaced by the opposite failure (cause 2).** The narrowing left navigating create presses with nothing adoptable, so brief-4 and brief-6 were `gate_unsatisfiable`. **t743 caused or exposed this.** Rule (a) then adopted an unrelated list named on an unrun call. |
| t743 `undo_already_back` | **Fired (0183, 0199), and is half of the terminal deadlock (cause 1).** It refuses the press but leaves the act in `actsToUndo`. |
| t743 S3 `completion_repair_first` | Fired (0153), and led to brief-8. Working. |
| A3: refusals list build-wide acts | Working: act-7 appears in brief-4's and brief-6's refusals. |
| **C5** (a related list offered as a witness) | **Did not recur.** The model named the cart (destination-5) both times (0045, 0173), never destination-4, the product page's related list. t748's wording plausibly helped. |
| **C6** (after the baseline read, press again with the ref) | **Recurred partially.** t748's `retryRefused` appeared (0044, 0168) and says "go back to where it was refused". Both times the model retried from the cart page instead (0045 `"t?"`, 0169 stale `t401`). Brief-8 recovered (0171-0174). Brief-3 gave up and submitted an unexplored create step, which is what made act-7 witnessless (cause 2). |
| t748 "an unidentified creation needs a witness" | Covers explored presses before the seal only. A trial step that was never explored is not covered. |
| Ending cut mid-word | Gone. The ending text is whole, but see the UI review on which ending reaches the panel. |

## UI review

Screenshots: `test-runs/instances/rr5-slot-1/run-mvhibit5-e1d3a4f3.ui-review.local/` (35 moments). The
overlay samples come from `.ui-review.local.json`.

- **Chat stream.** It reads as a message stream with a composer at every moment (`01`, `13`, `24`,
  `32`, `35`): assistant turns with an action card each, a "Building your Flow" status line, and Stop
  build. Defects:
  - **Contradicting words, `13-mid-build-panel.png` and `32-mid-build-panel.png`.** The heading says
    "Ticking 'Yes, start my 30-day FREE ... Plus trial'" and the card says "Tick", while the model's
    line beneath says it will *clear* the Plus trial. The person sees FluxIQ apparently signing them up
    for a trial (defect 2).
  - **Internal names leak, `32-mid-build-panel.png`.** "Using 'Test subflow'" and "Action · Test
    subflow". `03-mid-build-panel.png` lists the plan's router as "Main: Runs each of the other subflows
    in turn, passing each value on by name", and cuts a quote mid-word ("address is t...").
  - **Repetitive cards, `24-mid-build-panel.png`.** Two identical "Choose ... Not done: it was already
    tried exactly this way" cards around one Look card. The status line repeats the same words.
  - **Ending, `35-failure-panel.png`.**
    - A dense list of leftovers in one paragraph ("used ...", "clicked 'Buy Now' ... could not undo
      them", "and 1 more").
    - It names the Buy Now presses as possibly left, though by then Core had settled them.
    - It then says "The build failed: FluxIQ could not finish the Flow: I could not finish this." The
      supervisor's own reason (0213) is not what the panel shows. That is the same gap round 4 noted.
- **Overlay.**
  - Present and visible in all 34 working moments; absent only at start (`01`) and for single samples
    during page loads. No presence or visibility toggles.
  - **Position jumps between top-left (y=16) and bottom-left (y=620)** across moments, and within
    moments 10 and 18. At the top it covers the site's header and logo (`35-failure-scenario.png`).
  - Text changes once or twice per 3 s window in about half the moments. Moment 6 is reported
    `flickering` (3 changes).
  - Copy defects:
    - "Ticking 'Yes, start my 30-day FREE ...'" over a page whose checkbox is unticked
      (`13-mid-build-scenario.png`).
    - "The check cleared on its own after 10 s." (moment 4) is unexplained.
    - "not done: the step 'open the kettle's page, choose white, press Buy Now and reach…" is cut
      mid-phrase (moment 9).
    - "Build failed | Build failed: FluxIQ could not finish the Flow: I could not finish this."
      repeats itself (moments 34-35, `35-failure-scenario.png`).

## Recommended fix

All generic; nothing names this task, site or answer, and no model guidance mirrors the scenario.

### 1. Terminal (Core): a toggle whose place shows the start state after a later lasting act settles

- **What changes.**
  - In `reset-settlement/control-tracker.ts` `standing()`: when the latest read of the press's page,
    taken after the latest lasting call, shows the place at the build-start counts **and** a lasting
    act or trial of the build landed after the last press there, answer `holds`. The settlement then
    marks it `restored` (a change was seen) and tells the judge, as today. The "never by itself" guard
    stays for a reversion with no later build action (a flicker).
  - Make the invariant mechanical. `undo-admission.ts` `alreadyBack()` must never leave the act in
    `actsToUndo`: either the settlement says it holds, or `judge.ts` `unmet()` lists it apart as
    `gate_unsatisfiable`.
  - Tighten the `own` admission for a check node: the requested end state must be `toggle.from`
    (0123's no-op).
- **Files.** Core `reset-settlement/control-tracker.ts`, `reset-settlement/judge.ts`,
  `site-reset/undo-admission.ts`, `site-reset/undo-reach.ts` (keep its mirror of admission paths in
  step).
- **Tests that fail first.**
  - A `site-reset/tests/` ledger test: a toggle act (ticked to unticked), then a later `create_new`
    act, then a read showing the place at start counts. Expect `beforeTrial` to admit. Today it refuses
    with the act in `actsToUndo` while `target` answers `undo_already_back`.
  - A property test over ledger states: every act in `actsToUndo` has at least one call its settle
    words name that `target` admits.

### 2. Structural (Core, with one domain field): no lasting trial step without a witness the ledger can judge

The witnessless-trial-act class has come back in rounds 2 (C4), 3 (A1), 4 (adoption too wide) and 5
(adoption too narrow). Stop patching adoption.

- **Gate before the trial.** In `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts` (or at
  submit), refuse a subflow trial whose lasting step has no witness. A witness means one of: it repeats
  an explored act of the build with a named destination, a lent destination or a toggle; or it is a
  stateful control. The refusal names the step and asks for the press live with its `resetDestination`
  first. The brief that can still meet it gets the refusal; today an act is made that blocks every later
  brief.
- **Lend across trials.** In `site-reset/ledger.ts` `trialRan()`, a trial or entry-preparation act also
  repeats earlier *trial* acts of the same step and inherits their witness. An entry preparation then
  never adds a new witnessless act for a press already settled once.
- **Remove the accidental path** (`site-reset/undo-claims.ts` `ran()`). Attach a named destination only
  when the call landed. Narrow adoption rule (a) in `judge.ts` `adoptable()` to lists named for an act
  with the same control or operation, never any act's list.
- **Tests that fail first.**
  - A `subflow-trial-gate` test: a candidate whose `create_new` step repeats no explored act is refused
    before the trial runs.
  - An `undo-claims` test: `undoes` plus `resetDestination` on a call answered `target_unobserved`
    leaves `act.destinations` unchanged.
  - A `judge` test: a witnessless act-B does not adopt a list named for act-A on a different control.
  - A two-brief `project-build-reset-settle` test: an entry preparation repeating a settled trial press
    is settled without a model turn.

### 3. Person-facing wording (domain + Core): an untick is an untick

- **What changes.** In `domain/src/runtime/llm-evidence/node-run/run.ts` (verb at :340) and
  `replay.ts:303`, a check node with `checked: false` declares an untick verb, so Core's `did` reads it
  correctly. Core `activity/wording/action.ts` chooses "Unticking" for `checked: false`.
- **Tests that fail first.**
  - A domain node-run test: `dom-check` with `checked: false` declares the untick verb.
  - A Core activity-wording test.

### 4. Plan-time check (Core supervisor)

- **What changes.** `project.write_plan` and `amend_plan` refuse an output on a subflow whose parts ask
  for no read or made value, as the plan-port check does. Fix the `plan_subflow_constraint` false
  positive on a part that asks for a table.
- **Test that fails first.** Beside the existing plan-port tests.

### 5. Carried C6 (Core words and data)

- **What changes.** `retryRefused` carries the refused call's page location as where to return. The
  words say the press needs a handle from a fresh view there; a handle from the list's page names
  nothing.
- **Test that fails first.** The `retryRefused` object carries the location. Generic words only.

### 6. Feedback

- An `undo_unproved` on a strict act names the act's own control as where an undo acts, generically.
- The repeat guard also covers an identical `test_subflow` refused for an unchanged reason.

**Rerun guidance.** Do not rerun unchanged: a three-subflow plan will block at the first dependent
trial again whenever the create press is not explored with its destination. At minimum, land fixes 1
and 2 with their tests; fix 3 matters for the person's ending. Sync both lane trees before relaunch.
Expect `delivery_and_payment` to reach its trial; the read-identity fix (round 4) is then the next
unproved step.

## Not verified

- That act-8 and act-12 are the entry preparations' presses. This is inferred: each was named "trial
  step 5 press Buy Now", appeared at the start of brief-4 and brief-6, and those briefs started on
  checkout. The trace's entry-preparation sessions were not opened.
- When the refs closed (`refsClosed()`); inferred from `nothing_to_name`, which requires it.
- Why `test_subflow` repeats escaped the repeat guard.
- That trial step 5's attempt carried no `stateDiff.controls`. This is inferred from the domain rule
  (a navigating, non-stateful press) and from `pageLocation` being the only route for (b).
- Whether the final ending text in the panel is the supervisor's 0213 reason: the panel shows Core's
  draft narration instead.
