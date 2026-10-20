# run-mvgo5xft-25460ba2: office checkout review, rerun round 3

Status: debugged terminal failure. This was a read-only analysis. No source
edit, build, browser run, paid run or commit was made for it.

## Run

- Task `everything-store-office-checkout-review`, rerun round 3, slot 1, lane
  tree `C:/Users/osrs_/FluxStuff/fxwork/t563`. Downstream was at e1363c31 and
  Core at e74e0890, which is dev with t738's fixes. The build was started from
  the real extension chat, with a $0.25 ceiling.
- Per-step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgo5xft-25460ba2/steps`.
  There are 140 step folders and 69 provider calls, costing $0.04931. The sum
  of the step costs equals the live guard's figure, $0.049308.
- The Lab started at 12:38:28. The build ran from 12:44:07 to 12:50:17, and
  the Lab finished at 12:50:33.
- Verdict: `failed`, `runtime.behavior` (`lab.chat_build_failed`), with no
  Flow created. No judged whole-Flow run ever ran.
- Spend per brief:

  | Brief | Subflow | Spent | Calls | Ending |
  | --- | --- | --- | --- | --- |
  | supervisor | - | $0.0059 | 10 | blocked |
  | brief-1 | `buy_now_checkout` | $0.0179 | 23 (incl. 4 judge calls) | done, revision 2 trial judged yes |
  | brief-2 | `read_checkout_summary` | $0.0052 | 7 | blocked, stopped by the repeat guard |
  | brief-3 | `read_checkout_summary` (re-sent) | $0.0045 | 9 | blocked, stopped by the repeat guard |
  | brief-4 | `buy_now_checkout` (merged) | $0.0099 | 11 | blocked (by the model) |
  | brief-5 | reset | $0.0057 | 8 | blocked, act-18 left |

## How far it got

- **0003-0008: plan.** The supervisor split the task into two subflows:
  - `buy_now_checkout` covers p1-p4 and has no outputs.
  - `read_checkout_summary` covers p5. It runs after the first, and its
    outputs were named `item`, `address`, `arriving` and `total`, the task's
    column names.

  `project.write_plan` accepted that plan with no issue (0006).
- **Brief-1 (0009-0052): done, which is faster than round 2.**
  - Buy Now with `create_new` was refused `candidate.create_baseline_required`
    (0019). Again it printed only `destination-4`, the product page's
    sponsored related-products list.
  - The model then went cart, product page, cart, product page (0020-0027).
    At 0030 it pressed Buy Now with `resetDestination: destination-4`, and
    Core accepted it. That press was act-6, which sealed the baselines.
  - Revision 1 was judged no for the home address (0037-0040).
  - The model explored the address chooser. Revision 2 added "open the
    address chooser", "choose the office address" and "confirm the office
    address" (`consequences: modify_existing`).
  - Revision 2's trial was judged **yes** by both judges at 0048: the kettle
    alone, the office address, free standard delivery, Visa, the gift card,
    Plus off, the order not placed, and the cart unchanged.
  - That trial left act-10 (Buy Now) and **act-12 ("confirm the office
    address", trial step 10)** on the site.
- **Brief-2 (0053-0067) and brief-3 (0070-0088): unpassable by construction**
  (first divergent step, below). Each brief's entry preparation re-ran
  `buy_now_checkout` revision 2 before its first look. That made act-13 and
  **act-15** for brief-2, and act-16 and **act-18** for brief-3 (0053 and 0070
  `entry.predecessorsLeftOnSite`).
- **0089-0094: plan folded.**
  - The first `amend_plan` was refused `project.plan_part_dropped`, because
    it lost p4's words.
  - The second merged p5 into `buy_now_checkout`, which now runs as the
    router subflow. Brief-1's revision 2 was carried over.
- **Brief-4 (0095-0119): the judged run was refused three times.**
  - The opening look succeeded.
  - Revision 3 was accepted at 0103. It is revision 2 plus four
    `web.output.dom-extract` reads and a `builtin.data.write-records` step
    with `records: [{"item": "$step.item.value", ...}]`. That is t738's B1 at
    work: in round 2 this step could not be written at all.
  - Its test is the build's judged whole run. It was refused
    `candidate.trial_reset_required`:
    - 0105: act-12, act-15 and act-18.
    - The model settled act-12 with a look under `undoes: act-12`,
      `resetDestination: destination-4` (0108).
    - 0112: act-15 and act-18.
    - It settled act-15 with a look under `undoes: act-15`,
      `resetDestination: destination-5` (0114).
    - 0117: act-18 alone.
  - At 0119 the builder ended **blocked**. Its reason was false: "no complete
    read shows where their effect would be, so the reset precondition ... can
    never be met". The same one-call look that settled act-15 three steps
    earlier would have settled act-18.
- **0120-0140: ending.**
  - The supervisor's ending was held with `project.completion_reset_first`
    for act-18 (owner brief-3) (0121).
  - The reset brief-5 never named act-18 under `undoes` (see the reset
    section below). Its `complete` was refused `project.reset_acts_in_place`
    at 0132 and 0138. At 0139 it completed with `cannotUndo: ["act-18"]`,
    which never settles a reversible act.
  - The reset came back blocked, and the supervisor ended blocked at 0140.

**Distance.** Round 2 reached the judged whole run, and its only gap was the
row step. Round 3 got further on authoring: the row step assembles, and the
checkout part passed in 2 revisions instead of 4. But it got less far on
judging, because no judged run ever ran. Had the reset let it run, revision 3
would very likely have been judged no anyway. All four of its reads target
`t987`, the delivery-address line. So `item`, `arriving` and `total` would
have held the address. That is a model error a judge catches, so one more
revision was needed, and $0.20 of purse was left for it.

## First divergent step: 0057-0067 and 0074-0088, a plan port name the script refuses

The plan named `read_checkout_summary`'s outputs `item`, `address`,
`arriving` and `total`. Two Core checks then contradict each other for the
name `item`:

| Step | Model wrote | Product answered |
| --- | --- | --- |
| 0056 | `output: item = $step.item.value` (plus 3 more) | `flow_script.part_interface_invalid` at line 4: "is never \"item\"" (0057) |
| 0058 | `output: Item = ...`, `Address`, ... | `subflow.interface_output_mismatch` x4: "not one of this subflow's outputs, which are \"item\", ... Hand back exactly those, by those names", plus `subflow.output_unbound` (0059) |
| 0060 | `item` again | `part_interface_invalid` again (0061) |
| 0062-0066 | `Item` again, three times | `repeat_refused`, and the brief ended (0067) |
| 0073-0088 (brief-3) | the same alternation | the same two refusals; the brief ended on the repeat guard |

- **Plan side.** Core `project-agents/supervisor/plan-input.ts` `ports()`
  (line 265) checks only `PORT_NAME = /^[a-z][A-Za-z0-9]{0,31}$/u` (line 117),
  so `item` passes. The guidance words for `project.plan_port_name`
  (`supervisor/guidance.ts:319`) do not mention the reserved name.
- **Script side.** Core `flow-bootstrap/script-statements/called-parts.ts`
  `partOf()` (lines 143-148) refuses `name === ROW_NAME` (`"item"`, line 38),
  because "item" is the name of a loop's row.
- **Scope side.** The subflow scope check demands exactly the plan's names,
  so no script can satisfy both. The builder had no move but
  `{"ended": "blocked"}`, which the repeat words do offer, but it kept
  alternating instead.

This is generic, not task-specific. Any plan whose port is named `item` (a
common column name) makes its subflow unbuildable. It cost two briefs and
$0.0097, and it forced the plan fold. The fold put the row step into the
checkout subflow, so the judged whole run inherited every trial and entry act
of the three earlier briefs.

## Why act-18 was left with no reset settling it (the terminal stall)

**The acts.** Each "confirm the office address" press in a trial or an entry
preparation is a new act declared `modify_existing`:

- act-12: brief-1's passing trial (0048);
- act-15: brief-2's entry preparation (0053);
- act-18: brief-3's entry preparation (0070).

Each one is in no list. Its `settle` reads "Nothing read shows where its
effect would be: read the list ... and name that list's ref as
resetDestination on a look that names this act under undoes", and it offers
all six issued refs, `destination-1` to `destination-6`. Each act needs its
own look, one model turn per act. Any list settles it (`destination-4` is the
sponsored list, and `destination-5` is the cart): this is round 2's C4,
unchanged.

**What went wrong in brief-4:**

1. **A settling look says nothing.** The results at 0108 and 0115 carry only
   the page and `resetDestinations`. There is no "act-12 settled", and no
   list of what is still open. The model repeated the act-12 look (0109).
2. **The refusal for that repeat listed no open acts.** At 0110 it answered
   `candidate.undo_act_kept` with `actsToUndo: []`, although act-15 and act-18
   were open (0112 listed both). Cause, from the code:
   - `service/project-build/reset-calls.ts:45` sends the claim to the act's
     owner ledger (`owner(undoes).claim(...)`).
   - `site-reset/ledger.ts:364` fills `actsToUndo` from that ledger's own
     `inPlace()`, which holds brief-1's acts only.
   - The trial gate builds its list over every owner
     (`brief-ports.ts:492-497` `openActs`).

   So the refusal told the model nothing was left, and it tested and was
   refused again (0111-0112).
3. **The model then gave up one act short** (0119), with a false reason. The
   model made that mistake, but points 1 and 2 meant it never saw the look at
   0114 work.

**What went wrong in brief-5 (reset):**

- 0125: a cart navigation without `undoes`.
- 0127-0130: opened and closed the location (ZIP) chooser, which is unrelated.
- 0131: completed. Refused at 0132.
- 0133-0136: read the cart list completely with
  `resetDestination: destination-5`, but **no `undoes`**. Core ran it as an
  ordinary look:
  - `ledger.claim` returns `none` when `undoes` is undefined.
  - `ledger.explored` records a named destination only under `undoes`.
  - The answer said nothing about act-18.
- 0137: completed with the same words, refused at 0138 (`sentAgain`).
- 0139: completed with `cannotUndo: ["act-18"]`. The reset ended blocked.

**Did t738's reset-witness rule (`candidate.reset_witness_required`) fire,
help or hurt? It never fired.** The code appears in no step file. Neither
did `candidate.reset_destination_unissued`. The rule
(`site-reset/reset-witness.ts`, asked from `create-baselines.ts:130`) only
judges **exploration presses before the seal**:

- The only lasting exploration press was Buy Now at 0030. That is a lone
  `create_new` (exempt), and it named an issued ref anyway.
- No later exploration press declared a lasting class. The office radio at
  0044 was declared none, and "Deliver to this address" was never pressed in
  exploration.
- Every act that blocked the build was a **trial or entry-preparation act**
  of a script step. The rule never looks at those.

So it neither helped nor hurt here. The class that actually blocked the build
is outside its scope: acts on no list, repeated by every trial and every
entry preparation.

## Round-2 causes: status

| Round-2 cause | Status in this run |
| --- | --- |
| Terminal: write-records could not be fed from a script | **Gone at assembly.** Revision 3's `records: [{... $step ...}]` was accepted (0103), with no `required_input_unconnected` and no `not_derivable`. It never executed, so the run-time record capture is unproved live. |
| Issue placed at the block's first step (`nodes.<key>`) | Not exercised. |
| C2: "submit again" for an untested unchanged revision | Not exercised. The repeats here were of refused scripts, and those words were right. |
| C3: tab moved silently during a refused test | Not observed. No refused test carried `pageAfterTrial`, and the model navigated explicitly each time. |
| C4: an act on no list settles by naming any list | **Still present, and terminal here.** It is the whole act-12/15/18 mechanism. |
| C5: baseline accepted on an unrelated list | **Still present.** At 0030 and in 0099's refusal, Buy Now was admitted or offered on `destination-4`, the sponsored list. |
| C6: no next step after a baseline read | **Partly present.** Brief-1 lost 4 calls (0020-0027) before pressing with the ref. Brief-4 sidestepped it by not exploring Buy Now. |
| Opening call refused `unexpected_input_keys` | **Gone.** The openings at 0053, 0070, 0095 and 0124 all succeeded (t738 C2). |
| False "never passed its own test" ending | **Gone in substance.** The 0140 reason is true, and the panel row says the part passed its own test and no whole Flow was assembled. See the UI section for a new truncation. |

## Cause

**Class: product defect (Core)**, in two places, with model mistakes on top.

1. **Plan and script disagree on legal port names.** This is where the run
   first went off course. `plan-input.ts` `ports()` accepts `item`, and
   `called-parts.ts` `partOf()` refuses it, while the scope check demands the
   plan's name. That made two briefs unbuildable and forced the fold that put
   the row step under the inherited acts.
2. **Settling acts across briefs is opaque and costs a turn per act.** This is
   where the run ended.
   - A settling look returns no receipt.
   - `undo_act_kept` lists only the owner brief's open acts
     (`reset-calls.ts:45` with `ledger.ts:364`).
   - A look naming `resetDestination` without `undoes` settles nothing,
     silently.
   - Underneath all three: every trial and entry preparation mints a new
     act on no list (C4), each needing its own model look.
3. **Model mistakes:**
   - brief-4 ended blocked one look short, with a false reason (0119);
   - the reset brief never named act-18 under `undoes`;
   - revision 3 read every column from `t987`;
   - brief-2 and brief-3 alternated between two refused scripts instead of
     ending blocked.

The task, oracle and fixture are not the cause. Brief-1's trial matched every
checkout fact the task asks for. The task's column name `item` is ordinary,
and the defect is Core reserving it on one side only.

Environment is not a cause either. The Lab log shows a normal start and a
recorded verdict. There was no stall, crash, provider error or balance error,
and the build took about 6 minutes.

## Proposed fix (least general first)

1. **One port-name rule for plan and script** (Core).
   - `project-agents/supervisor/plan-input.ts` `ports()` should refuse
     `item` with `project.plan_port_name`, using one exported predicate shared
     with `flow-bootstrap/script-statements/called-parts.ts` (`PORT_NAME`
     plus `ROW_NAME`). That way the supervisor, which owns the names, picks
     another one.
   - Add "and never `item`" to `supervisor/guidance.ts:319`.
   - Test seams:
     - `supervisor/tests/plan-input.test.ts`: outputs `["item"]` are refused
       at `subflows.0.outputs.0`.
     - A parity test: every name the plan accepts, `partOf` accepts.
   - An alternative, if proved safe: drop the reservation for part outputs,
     which never bind as `$item`. That needs a check of
     `authoring/script-binding.ts` and `draft-bindings.ts`, so it was not
     proposed as the first fix.
2. **Tell the model what a settling look did, and list the whole build's
   open acts** (Core).
   - `service/project-build/reset-calls.ts` and `site-reset/ledger.ts`.
   - A look under `undoes` that settles its act answers
     `settled: <act>` plus the build's still-open acts. That list comes from
     the same union as `brief-ports.ts` `openActs`, not from the owner's
     `inPlace()`.
   - The same list goes into `undo_act_kept`, `undo_unknown_act` and
     `undo_already_done`.
   - Test seam: a two-brief `service/project-build` test. Settle brief A's
     act from brief C while brief B's act is open. The answer must name brief
     B's act, and a repeat's `actsToUndo` must not be empty.
3. **A look naming `resetDestination` with no `undoes`, while acts are open,
   gets a note** (Core, `ledger.claim` or the reset-call wrapper). The note
   says that it settled nothing and names the open acts, with one example
   call (`"undoes": "<act>", "resetDestination": "<ref>"`). Test seam:
   `site-reset/tests` or `reset-calls` tests.
4. **Structural, the C4 class** (Core, `site-reset/`, `entry-preparation`).
   Two generic options:
   - (a) For a trial or entry-preparation act whose settle is "nothing read
     shows where its effect would be", let Core's own pre-trial re-read of
     every issued list settle it. The model's look adds nothing that read
     does not, since today any list settles it.
   - (b) Better: let a `modify_existing` act on no list name its own page
     region as its witness, so that a reset restores that region.

   Either removes one model turn per act per brief. That turn compounds with
   every entry preparation: three briefs made three acts here. Option (a)
   should be weighed against the user's rule that a build undoes its own
   lasting acts, because it accepts "unchanged" with no undo.
5. **Later (C5 and C6, carried over):**
   - offer as a baseline only a list whose page shows the act's effect;
   - after a complete read that follows `create_baseline_required`, say
     "press again with this ref".

None of these touches the task, the oracle or site-specific guidance.

## Chat and UI (screenshots in `run-mvgo5xft-25460ba2.ui-review.local`)

- **21-failure-panel and 21-failure-scenario: the final chat line is cut in
  mid-word.** It reads "The build failed: FluxIQ could not finish the Flow: i
  could not finish this. The part that takes t." The supervisor's reason
  (0140) is a full, true paragraph.
  - The cut sits somewhere on the `endedBecause` path:
    `service/project-build/run.ts` `toldEnding`/`endedSaid`, then
    `activity/wording/ended-reason.ts` and `reason-text.ts`, then
    `conversations/commands/progress.ts` `supervisorEndingWords`. The exact
    point was not traced.
  - The lowercase "i" comes from `lowerFirst`, which lowercases the
    pronoun "I".
- The panel row above it is accurate. It says the checkout part passed its own
  test, that no whole Flow was assembled, and that "confirm the office address"
  may have changed nothing.
- The store was left with the cart unchanged (2 items) and no order placed.

## Not verified

- Where exactly the final chat reason is cut to "The part that takes t".
- That act-18's address change actually persisted on the site. No read
  compared the checkout's address after the reset.
- That revision 3's write-records step would store the row at run time. It
  was only assembled.
- That `undo_act_kept`'s empty `actsToUndo` at 0110 comes from the owner
  ledger. This is inferred from `reset-calls.ts:45` and `ledger.ts:364`, not
  reproduced in a test.
- Whether dropping the `item` reservation for part outputs is safe.

## Rerun guidance

Do not rerun unchanged. A plan that names a port `item` is unbuildable, and
leftover trial and entry acts still need one silent look each. Rerun once
fixes 1 and 2 land with their tests, ideally with fix 3, and after both lane
trees are synced. Expect brief-1 to pass again. The judged run should then
reach the row step, where the model must read each column from its own line.
