# run-mvfq94ff-c8c21493 — office checkout review r2 failure

Status: Debugged terminal failure. This was a read-only analysis: no source
edit, build, browser run, paid run or commit was made for it.

## Run

- Task `everything-store-office-checkout-review`, workspace
  `claude-office-checkout-t563-20261019-r2`, lane bf-slot-1. The build was
  started from the real extension chat, with a $0.25 ceiling.
- Trees: downstream dev 79fbbb7a and Core e11549a8, both clean. These carry the
  F1 and F3 fixes for the r1 failure (`run-mved5pro-91998cc2.md`).
- Run folder: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-19/run-mvfq94ff-c8c21493`.
- Verdict: failed with `lab.chat_build_failed`, and no Flow was created. There
  are 203 step folders and 101 provider calls, costing $0.06946167. The run went
  from 20:49:10 to 21:02:21, with the build itself starting at 20:55:35.
- The chat ending: "FluxIQ could not finish the Flow: i could not finish this.
  The Flow "Buy Now kettle to checkout" has no steps yet". The supervisor's
  stated reason was that the checkout showed the home address and the cart reset
  did not succeed.

## How far it got

It got further than r1. The plan and the subflow work were sound, and the
judge's feedback was right. The build was one passing trial away from a usable
checkout subflow when it stalled.

- 0003-0006: the supervisor planned two subflows. `checkout_kettle` (p1) was
  meant to hand an output `checkoutready` to `read_checkout` (p2). The first
  plan was refused because of port names, and the resend was accepted.
- Brief-1 (0009-0039) found the kettle and met the create precondition: it read
  the cart (0021, which issued `destination-1`), then pressed Buy Now with
  `resetDestination: destination-1` (0025). It then set delivery, the gift card
  and the Plus trial. Its submissions were refused three times (0035, 0037,
  0039, `subflow.scope_refused`) because no step makes `checkoutready`. Core
  told the supervisor so in plain terms. The supervisor amended the plan to hand
  the page over through `after` alone (0041) and dispatched briefs 2 and 3. This
  plan mistake was caught by the product and recovered. It is not the cause.
- Brief-2 (0044-0110) did the same exploration. Its Buy Now was act-11, sent
  with `resetDestination: destination-1` (0056). It submitted revision 1
  (0058).
- 0060: `candidate.trial_reset_required` for act-11. The model navigated to the
  cart under `undoes: act-11` (0064). That was a complete read of the named
  destination, unchanged, so F1 settled act-11: 0078 lists it under cannotUndo
  as "a complete read of its destination taken after it showed that destination
  exactly as first observed".
- 0066: the trial of revision 1 ran and answered no. Both judge calls said the
  address was the home address and that no step chose the office address. They
  gave exact advice to open Change, pick the office address and confirm it. The
  builder's step 0030 had wrongly claimed that the checkout already showed the
  office address. That was a model mistake, and the trial caught it as designed.
- 0069-0076: the builder added the office-address steps and revision 2 was
  accepted. **Revision 2 was never tried.**

## First divergent step: 0078

At 0078, `core.test_subflow` for revision 2 was refused with
`candidate.trial_reset_required`. The act it named was act-12, which is
"trial step 5 'press Buy Now so the cart is left as it is'". This is the
trial's own Buy Now from 0066, not an exploration act. From this point no trial
ran again, in brief-2, in the repair brief-4 or in the reset brief-6.

The reason is that act-12 has no destination. The ledger records a trial
step's act in `AutomationStudioSiteResetLedger.trialRan` (`site-reset/ledger.ts`),
through `record`, with its spot and created items but no `destination`. A Flow
step cannot carry a `resetDestination` ref. The Buy Now control is in no list,
so `leftUnchanged(act)` finds no group (`groups.length === 0`) and answers no,
however many complete, unchanged cart reads follow. The identical exploration
press, act-11, settled at once because its own call named the cart.

## How the ledger answered each trial request (F1)

| Step | Request | Answer | What the model was told, and whether it could act on it |
| --- | --- | --- | --- |
| 0060 | test rev 1 | `trial_reset_required`, act-11 | It was told to undo the act, or to settle it by reading its destination complete and naming the ref. It navigated to the cart under `undoes` (0064). Act-11 already carried the destination from its own call, so the read settled it. **This worked.** |
| 0066 | test rev 1 | ran, judged no (address) | This was correct. Act-11 was listed as left with no change seen. |
| 0078 | test rev 2 | `trial_reset_required`, act-12 | It got the same instruction. To settle act-12 it had to name `resetDestination` "on a look that names the act under undoes". |
| 0080, 0084 | navigate to cart, `undoes: act-12`, **no ref** | read the cart: `destination-1` count 2, `destination-2` count 2 | No destination was named, so nothing settled. |
| 0082, 0086 | test rev 2 | `trial_reset_required` again | The navigation counts as an applied action, so each retest ran and was refused correctly. |
| 0088 | extract_list, `undoes` plus `resetDestination: destination-1` | `target_unobserved` (`extractList` given as a bare string, before any structure detection) | This was a malformed call by the model. It was the right idea, and it was refused unrun. |
| 0092 | test rev 2, `cannotUndo: [act-12]` | `trial_reset_unproved` | cannotUndo marked act-12 `kept`. A kept strict act refuses every trial unless `leftUnchanged` holds (`unprovedReset`). |
| 0094 | extract_list complete, `undoes: act-12`, **no ref** | 2 rows, unchanged | No destination was named, so nothing settled. |
| 0096-0110 | test rev 2, same input | `llm_evidence_loop.already_answered` seven times, then `rejected.repeat_without_progress` | **This is the dead end.** The retest never reached the ledger (see below). Brief-2 ended partial. |
| 0133 (brief-4) | test rev 2 | `trial_reset_required`, act-15 (brief-4's own Buy Now, sent with a ref) | It navigated to the cart under `undoes: act-15` (0135). The 0137 claim answered `candidate.undo_act_kept`: settled. **This worked.** |
| 0139, 0143, 0149 | test rev 2 | `trial_reset_unproved`, act-12 | act-12 was still kept and had no destination. |
| 0151, 0153 | extract_list complete, `undoes: act-12`, `resetDestination: destination-1` | succeeded, 2 rows, unchanged | **This is exactly what the instruction asks.** No retest followed. The model resubmitted the unchanged revision instead (0155, `candidate.unchanged_submission`, whose answer said to test it), then sent it three more times (0157-0161, `repeat_refused`). Brief-4 ended. Even a retest here would have been answered from memory, for the reason below. |

The memory dead end works like this. `core.test_subflow` is an action tool, so
its request signature is keyed on `mutationEpoch`
(`automationStudioLlmEvidenceRequestSignature`, `runtime/llm/repeat-policy.ts`).
In `runCall` (`runtime/llm/evidence-loop.ts`), `mutationEpoch` moves only when
an action applies, and `attemptEpoch` moves only when an action runs. A refused
trial is registered in `answeredRequests` as the answer to its signature.
F1's settle path for a trial act is a **look** that names the destination, and
a look moves neither epoch. So the identical retest after the settling look has
the same signature and is answered from memory with the old refusal. It never
reaches the ledger, and enough repeats end the brief. Whatever the model does,
F1's instruction "read that list completely, name it ..., then test the same
revision again" cannot be followed for a trial's act unless an unrelated action
(a navigation, say) happens to run in between. Brief-2's 0080 and 0084
navigations are why its earlier retests ran at all.

Not verified: whether the 0151 look, made in repair brief-4, would actually
have named act-12's destination in brief-2's ledger. That needs the call to be
routed to the act's owner, and `destination-1` resolved there. The run never
asked the ledger again, so the artifacts cannot show it.

## The reset brief (F3, and the cannotUndo contradiction)

F3 held. At 0163 the ending was held with `project.completion_reset_first`
(act-12). The reset brief (brief-6) was dispatched at 0165, passed preflight,
and ran 18 calls. Its completions parsed against the shared reset schema: the
`cannotUndo` field arrived intact at 0197-0201. The brief text listed
"act-12: trial step 5 ..., page not read".

The reset could not finish. It looked for Buy Now, read the cart, and then
tried to delete the pre-existing Ridgeline case under `undoes: act-12` (0193).
Core correctly refused that unrun as `candidate.undo_unproved`, which protected
an item that predated the build. It then completed four times, three of them
with `cannotUndo: ["act-12"]`, and each time got `project.reset_acts_in_place`.
The refusal's own instruction says "complete and name that act under
cannotUndo, and it is kept as done". The reset brief body says the same. That
is false for a strict act. `beforeTrial` sets `kept`, but `claimable` keeps a
kept strict act claimable, so `toUndo` and `inPlace` still list it.
`remainingActs` (`service/project-build/brief-ports.ts`) therefore never comes
back empty. Neither text mentions the one path that does clear it (naming the
destination on a complete read). The reset ended blocked on the repeat guard,
and the supervisor ended honestly at 0203.

This did not decide the outcome: the checkout subflow had already failed. It
cost four decisions, and every reset of a trial act will hit it.

## Cause

**Class: product defect (Core).** F1's stricter rule created a dead end for
the act a trial makes. Two model mistakes contributed, and the product handled
both correctly. One was the false "office address" claim at 0030, which the
trial judge caught. The other was the unchanged resubmission at 0155-0161,
which the repeat guard ended. A third, the plan output nobody makes, was
recovered by amend_plan.

Owners:

1. `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/ledger.ts`,
   `AutomationStudioSiteResetLedger.trialRan` (via `record`). A trial step's act
   gets no destination, even when it repeats an exploration act whose own call
   named one. This is why act-12 needed the model at all.
2. `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`,
   `runCall` (`answeredRequests`), with `runtime/llm/repeat-policy.ts`
   `automationStudioLlmEvidenceRequestSignature`. A trial refused unrun stays
   "answered" across the look that F1 requires before retesting.
3. Words only: `runtime/project-agents/dispatch/reset-loop.ts` (the
   `project.reset_acts_in_place` instruction) and the reset brief body in
   `runtime/service/project-build/brief-ports.ts`. Both promise that cannotUndo
   keeps a strict act as done, which the ledger never does.

The task wording is not the cause. The model chose Buy Now, the cart stayed at
two items, and the judge read the address requirement correctly.

## Proposed fix (least general first)

1. **A trial act inherits its explored act's destination** (`ledger.ts`
   `trialRan`). When a trial step's act matches an act already in this ledger
   that carries `destination` (named on its own call), copy that destination
   to the trial act. A match means the same control name, the same consequences
   and the same page subject. The existing `leftUnchanged` then settles it on
   the next complete read of that destination, with no new model work. In this
   run, the 0080 navigation to the cart would have settled act-12, and 0082
   would have run revision 2. No new rule is needed: this is the same evidence
   that settled act-11 and act-15.
   Test seam: `site-reset/tests/ledger.test.ts`.
   - Positive case: observe a destination group complete, record an explored
     create_new on control C with `resetDestination`, call `trialRan` with a
     step on C with the same consequences and page, read the group again
     unchanged, then call `beforeTrial`. It should admit, with the trial act
     listed as left with no change seen.
   - Negative cases: a trial act on another control inherits nothing; a changed
     or partial fresh read still refuses; a trial act with no read after it
     still refuses.
2. **A trial refused unrun is re-decided after a look** (`evidence-loop.ts`
   `runCall`). When an action tool's call applied nothing and answered
   `ok: false`, keep its signature in `answeredRequests` only until the next
   call runs, a look included. The identical retest after the settling read is
   then put to the ledger again. With no call between, it is still answered from
   memory. `automationStudioLlmEvidenceNothingHappened` already counts such
   refusals toward the no-progress guard, so a loop of refuse, look, refuse is
   still bounded. This removes the dead end for any precondition a look can
   satisfy, not only F1's.
   Test seam: `runtime/llm/tests/evidence-loop.test.ts`, or beside it in
   `repeat-policy.test.ts`. Use a fake action tool that answers `{ok:false}`
   until a fake look tool has run once. After a look, the second identical
   request runs. With nothing between, it is `already_answered`, and the
   no-progress guard still ends an endless refuse-and-look loop.
3. **Words**. In `reset-loop.ts` and the reset brief body in `brief-ports.ts`,
   for a strict act say the true path: read its destination complete and name
   the ref on a look under `undoes`. Keep cannotUndo only for acts it actually
   keeps. Use one generic sentence, with no site, product or task named
   (`site-reset/words.ts` `nameDestination` already has it).

Fix 1 alone would have unblocked this run. Fix 2 is what makes F1's own
instruction followable in general. Neither change touches the task, the oracle,
or model guidance about this site.

## Rerun guidance

Do not rerun unchanged. Rerun once after fixes 1 and 2 land with their tests
and both lane trees are synced. Expect the builder still to need the judge's
address advice once. Revision 2 already had the office-address steps, so
the next run should reach a judged trial of them.
