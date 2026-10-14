# A8 launch 7 debug: run-mv8c7unr-42a8456d (bigbox-retail-pickup-cart, project mode)

Worker report, read-only investigation. Core and downstream at the pair that ran
(Core `6a81a391`, downstream `760d42bf`; `run.json` says both clean). No model
provider was called, and no Lab run was made.

## Outcome

Done. The whole test failed because of a Core defect, not because of either
subflow. **The whole candidate's trial never goes to the start page.** The
deployment's start hook (t586) put the site's *server* state back. Nothing then
reloaded the tab, so the assembled Flow ran on the stale page the last subflow
trial had left: the napkins product page, which still rendered Millbrook as the
current store. In this fixture the current store's card shows "Your store"
instead of a "Set as my store" button, so the step's control was not on the page.

Two more Core defects turned that one failure into a 9-brief loop that never
ended:

1. A repair brief's `failingReceipt` is validated, stored and never shown to
   the repair builder.
2. A builder with no predecessors explores the site as earlier trials left it.

No guard stopped repairs that changed nothing. The Lab's 795 s chat deadline cut
the build off mid-brief, so the person was never told how it ended.

## Timeline (steps; times UTC 2026-10-14)

| Step | Who | What |
| --- | --- | --- |
| 0001 (16:45:52) | chat | `flow.createHere` with the task instruction |
| 0004 | supervisor | Plan: `switch_store` (p1), `add_items` (p2, after switch_store); Core adds `main` |
| 0006-0028 | brief-1 build | Explored, submitted rev 1 (open picker, "Set as my store" on the Millbrook card). Trial 0025: yes, judged twice (0026/0027). Left act-2 (store set) on site |
| 0030-0094 | brief-2 build | Entry prepared (t580). Rev 2 trial 0081: `execution_failed` (napkins tile `web.target.ambiguous`). Rev 3 trial 0091: yes (0092/0093). Left act-8/9/10 (store, towels, napkins) on site, plus an open "added to cart" panel on the napkins page |
| 0096 | supervisor | `project.assemble`: rev 1 = main calls switch_store (brief-1 r1) then add_items (brief-2 r3) |
| 0098 (16:49:44) | supervisor | `core.test_candidate` rev 1: `execution_failed`, `start: reset`, `absorbedByStartReset` act-8/9/10. Step 1 call-subflow; step 2 "open the store picker" succeeded after the run pressed a dialog's way out (t2078); step 3 "set Millbrook Crossing Supercenter as my store", control "Set as my store": `web.target.not_found` 4 times, `retryable: true`, `retestsLeft: 2`. No start or arrival step at all |
| 0100-0118 | brief-3 repair | Same 2-step subflow, only a label reworded. Trial yes |
| 0120 | supervisor | assemble: `candidate.unchanged_submission`, `reworded: true` |
| 0122-0144 | brief-4 repair | Opened with Millbrook already current (left by brief-3's trial). Pressed "Your store" (t372), saved that step. Trial 0133: no. Re-submitted with "Set as my store": yes |
| 0146 | supervisor | assemble: unchanged (reworded) |
| 0148-0150 | supervisor | `core.recall_result` x2 (not_found, then already_answered) |
| 0152-0180 | brief-5 repair | Same Flow again; trial yes |
| 0182 | supervisor | assemble: unchanged (reworded). The last assemble of the run |
| 0184-0186 | supervisor | recall x2 again |
| 0188-0214 | brief-6 repair | "Your store" first (no), then "Set as my store" (yes) |
| 0216 | supervisor | `core.describe_nodes` |
| 0218-0234 | brief-7 repair | Trial yes |
| 0236-0258 | brief-8 repair | No, then yes |
| 0260 | supervisor | `project.amend_plan` refused `project.plan_refused` (`project.plan_subflow_no_parts` at `subflows.0.parts`: the model listed `main` with `parts: []`) |
| 0262-0292 | brief-9 repair | No, then yes |
| 0294-0316 | brief-10 repair | No, then yes |
| 0318 | supervisor | `project.amend_plan` accepted. Both proposals dropped, "its parts changed" |
| 0320-0336 | dispatch.11 | brief-11 builds switch_store; trial yes at 16:59:09. add_items brief not started yet |
| 16:59:07.8 | Lab | Chat deadline: "instruction ended", then `lab.chat_build_unfinished`; Core killed (exit 1) at 16:59:11 |

Spend: $0.112 of the $0.25 ceiling, 182 calls. About $0.062 went to the 8
repairs (brief-3..10, $0.0058-0.0089 each), and about $0.006 more to brief-11.

## (1) Why the whole test failed to execute

**Failing step:** step 3 of the whole trial, node `web.output.dom-click`,
switch_store's "set Millbrook Crossing Supercenter as my store", control
"Set as my store", code `web.target.not_found` (4 attempts). Page: the napkins
product page (`/ip/valueridge-everyday-dinner-napkins/...`) with the store picker
open. The picker shows "Stores near Millbrook" and the header reads Millbrook
Crossing Supercenter (`0098.../screenshot.jpg`).

**Mechanism:**

- The fixture renders the current store's card with a "Your store" label and no
  button. Every other card gets "Set as my store"
  (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts:13`).
  The page had been loaded while Millbrook was current (left by brief-2's
  trial), so the Millbrook card had no such button.
- The start hook ran (`start: reset`; act-8/9/10 under `absorbedByStartReset`).
  It is only an HTTP POST to the Lab's fixture reset
  (`runtime/candidate-start-hook/from-environment.ts:55-57`). It resets server
  state and does not touch the tab.
- **Root cause, Core:** a subflow trial is given the domain's arrival node and
  goes to the build's start location after the hook:
  - `service/project-build/subflow-trials.ts:57` (t578);
  - `flow-bootstrap/verification/detached-subflow.ts:177-180`.

  The whole candidate's trial is not. Its port is built at
  `service/project-build/whole-trials.ts:52` with no `arrival`, and the
  candidate trial path (`service/candidate-trial/run.ts:60`,
  `flow-bootstrap/verification/detached-execution.ts:18`) has no arrival concept
  at all. The assembled `main` holds Call Subflow steps only
  (`project-agents/supervisor/assembly.ts:171-195`, `callsInOrder`), so nothing
  in the Flow goes to the start either. The subflow trials' feedback opens with
  `builtin.control.start` and `web.output.browser-navigate`; the whole trial's
  feedback opens straight at `call-subflow` (0098 vs 0025/0091).
- The interruption at step 2 (`dialog`, way out t2078) was the "added to cart"
  panel left open by add_items' last trial (`0091.../screenshot.jpg`, dimmed
  page). Closing it was right and is not the cause.

**Whose defect:**

- **Not assembly's order or contents:** the composed calls and the proposals are
  correct.
- **Not t586's hook or ledgers:** the hook ran, and the ledgers correctly counted
  act-8..10 undone server-side. But t586 wired the hook without the arrival
  that t578 gave subflow trials, so its reset is only half of a start.
- **Not t585's arrival/entry rules:** those cover builders, not the whole trial.
- **Not the subflows:** both passed from a loaded start page.

The saved Flow would carry the same gap. When promoted it would run from
wherever the tab is, since no step of it goes to the start location.

## (2) Why the supervisor repaired switch_store, and whether the feedback pointed there

Yes. The only failing step in the feedback was switch_store's step 3, with a
plain "control was not found". Nothing in it told the supervisor:

- that the page was not the start page (`start: "reset"` reads as a full
  start);
- that the Millbrook card read "Your store".

Given that feedback, choosing switch_store was reasonable. The fault was not in
switch_store, though, so no repair could fix it.

**The repair brief told the builder nothing.**
`project-agents/contracts/subflow-brief.ts:53,98,119` requires and stores
`failingReceipt`. No other code reads it: `grep failingReceipt` finds only the
contract, the guidance and the tool schema. `project-agents/dispatch/run-brief.ts:60`
turns `repair` into a role label only. Brief-3's opening request (0102) has no
receipt, no feedback and no mention of the failure. Every repair builder
therefore re-explored p1 from scratch.

**The receipts were unchecked too.** Six of the eight repairs named the previous
repair's *passing* subflow trial as `failingReceipt`. Two (0121, 0235) named the
whole trial. Dispatch accepted all of them.

## (3) Why every reassembly was "unchanged", and whether that refusal was right

**Which proposal is used:** `state.latestDone()`
(`project-agents/supervisor/state.ts:125`) takes each subflow's latest done
return under the plan in force. So the repair's revision *did* replace brief-1's
in assembly: the latest proposal is used, not the kept one.

**Why it was the same:** every repair re-derived the same two steps. They open
the picker and press "Set as my store" on the Millbrook card. Only step labels
changed ("choose ..." vs "set ... as my store"). `automationStudioCandidateSameBehaviour`
(`flow-bootstrap/candidate/unchanged-submission.ts:62`) sets names aside, so each
reassembly was refused `candidate.unchanged_submission` with `reworded: true`.

**Verdict: right.** The assembled Flow behaved exactly like revision 1, and a new
revision would have failed the same way. The refusal also said to test the same
revision again if the failure was retryable (it was, with `retestsLeft: 2`). The
supervisor never did. A retest would have failed identically, since every later
trial also left a stale page with Millbrook current. The same-failure rule would
then have closed revision 1. Either way there was no route to success: the
defect is Core's, not the Flow's.

**Why repairs kept coming back with a "no" first:** brief-4, 6, 8, 9 and 10 each
opened on a site where an earlier trial had already switched the store.
Brief-4's opening view (0123): header "Pickup or delivery? Millbrook Crossing
Supercenter". The builder pressed the "Your store" label (0129, t372) and saved
that as the step. In the trial, the hook restored Carden Falls, the step pressed
a "Your store" label (now Carden Falls'), nothing changed, and the judge said no.
The builder then corrected the step back to "Set as my store", which is
brief-1's Flow again.

The cause is `service/project-build/entry-preparation.ts:76`. A builder with no
predecessors returns `{ kind: "start" }`: no start hook and no reset, so it
explores whatever the site was left as (each prior trial's `leftOnSite`).
brief-ports' header says as much ("that is the build's start only when nothing
of the build was on the site then").

## (4) Why amend_plan was refused, then accepted

**0260, refused `project.plan_subflow_no_parts` at `subflows.0.parts`
(`project-agents/supervisor/plan-input.ts:164`).** The model listed `main`, with
`parts: []`, as a subflow of its own.

- Verdict: right by the rule. `main` is the subflow Core adds.
- But Core's own `write_plan` answer (0004) lists `main` as a subflow with
  `parts: []`, which invites the copy.
- The refusal carried only a code and a path, no words.
- That amendment also added a `storeName` output/input, which nothing needed.

**0318, accepted.**

- p1's goalFacts were reworded ("shown for the account" became "shown on the
  site"), and p2's quote gained a leading "then".
- So `state.ts:227` ("its parts changed") dropped both proposals, including
  add_items' passing rev 3.
- Verdict: correct by the t590 rule (quote and facts are what builders are
  briefed and judged on).
- But the amendment's only purpose, in the model's own reason, was to escape
  "unchanged". It discarded a good proposal and fixed nothing.

## (5) How the build ended, what the person was told, what was left on the site

**How it ended:** Core never ended the build. The Lab's chat waiter gives
`DEADLINE_MS = 795 s` from Send
(`packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts:80,159`).
Sent at 16:45:52.8, it expired at 16:59:07.8. That was during brief-11's trial,
with add_items' brief not yet started. The Lab recorded
`lab.chat_build_unfinished` (`:170`) and tore Core down (exit 1 at 16:59:11).
Core's ending reset (`supervisor-loop.ts:171`, `resetBeforeEnding`) never ran.

**What the person was told:** no ending at all. The chat last showed "Building
your Flow / Working on the page" with "Stop build" still offered (screenshot
00059). Earlier it showed the whole-Flow receipt as "Not confirmed" (0098).

**What was left on the site:** the pickup store switched to Millbrook Crossing
Supercenter (act-39, left by brief-11's trial, never undone). The cart is as the
last start hook restored it, before brief-11's trial, so no item of this task.
That is inferred from the hook's behaviour; no cart view was read.

## (6) Every judge call

32 judge calls, two per subflow trial over 16 trials. The whole trial was never
judged: it was `execution_failed`, which is correct, since the gate does not
judge a run that did not reach its end.

**Yes (confirmed twice): 0025, 0091, 0115, 0141, 0177, 0211, 0231, 0255, 0289,
0313, 0333.** Each yes cites an end view whose header reads Millbrook Crossing
Supercenter, starting from Carden Falls. add_items' yes (0092/0093) cites cart
lines of 2 x the paper towels (12 Double Rolls, Pickup) and 1 x the napkins
(250 Count, Pickup). All correct.

**No (both calls agreeing): 0133, 0201, 0245, 0279, 0303.** Each says the
header still reads Carden Falls and "Your store" is still on Carden Falls. That
is correct: the saved step pressed the current store's label, so nothing changed.

All 32 calls were right. One side note: the judge's quoted page text carries
mojibake ("Â·", "Ã—"), so the evidence text it is sent appears to be
double-decoded somewhere. Not traced.

## (7) Guards that should have stopped the loop sooner

None fired, and none exists for this loop:

- **Repairs that change nothing.** A repair came back `done`, with a revision
  number, even when its proposal behaved exactly like the one already in the
  standing assembled revision. The supervisor learned that only by assembling.
  After 0182 it stopped assembling, sent five more repairs (brief-6..10) "blind",
  and then amended.
- **Repeat dispatches.** Nothing refuses a second repair of the same subflow
  against the same standing whole-trial failure after the first came back
  unchanged. `project.reset_repeated` (`dispatch-tool.ts:49,116`) does exactly
  this for resets only.
- **Repeated unchanged assemblies.** The refusal-run guard keys unchanged
  submissions "in a row", and dispatches sat between them, so it never counted.
- **Recalls.** The two recall attempts at 0148/0150 and 0184/0186 were caught by
  `already_answered`, which is fine but cheap.

The right stop was at 0120. The repair's proposal was the same as the assembled
one, the failing step was retryable, and two retests were left. Core should have
said "this repair changed nothing; the failure stands", then pointed the
supervisor at a retest, and after the same-failure rule at an honest ending
(reset, then tell the person).

## Recommended fixes (generic; no scenario, site or product words in model guidance)

1. **(Root cause) The whole trial starts where subflow trials start.** After the
   start hook, go to the build's start location through the domain's arrival
   node.
   - Preferred: assembly writes the arrival as the first step of the composed
     router-run subflow (`assembly.ts`, `callsInOrder`). The saved Flow then
     opens at its start too, as a candidate-mode Flow's first kept step does.
   - Minimum: pass `arrival` into the whole-trial port (`whole-trials.ts:52`) and
     the detached candidate runner, as `subflow-trials.ts:57` does.
   - Test: a hook that resets server state but leaves a stale page must still
     give a whole trial that opens at the start location.
2. **A repair builder is told what failed.** Put the `failingReceipt`'s trial
   feedback into the repair builder's opening evidence or brief text:
   - the failing step, its control, the code and "happened";
   - the trial's start;
   - a note that the step passed in its own partial trial.

   Validate that the receipt is a non-yes trial of that subflow, or the
   standing whole trial.
3. **A return says when a proposal changed nothing.** When a repair's done
   proposal has the same behaviour (`automationStudioCandidateSameBehaviour`
   over that subflow) as the one in the standing assembled revision, the return
   says `unchanged` rather than `done`. A further repair of that subflow against
   the same standing failure is then refused, as `project.reset_repeated` does
   for resets, and the refusal names the way out: retest if retryable,
   otherwise end with a reset.
4. **A no-predecessor builder starts at the build's start.**
   `entry-preparation.ts:76` should run the start hook and the arrival when
   acts of this build are in place, as a dependent builder's entry does, and
   mark the ledgers `startReset`. Failing that, the opening must say which of
   its own part's acts are already on the site.
5. **Trial feedback says what kind of start it had.** Distinguish "server state
   reset, start page loaded" from "server state reset, page not reloaded", so a
   model is not told `reset` for a half start.
6. **amend_plan / write_plan wording.** Either leave Core's router-run subflow
   out of the plan answer, or accept and ignore an entry with its key and no
   parts. Give `project.plan_subflow_no_parts` words, not just a path.
7. **The ending reaches the person.** A project build needs a wall-clock bound
   below the host's that ends honestly (reset, then tell the person), or the
   Lab's chat deadline must allow for project mode. This is secondary: with
   fix 1 this run would likely have finished by about 16:51.

## Commands run and observed results

- Listed and read the step folders: index.md; 0001, 0002, 0004, 0025, 0081,
  0091, 0096, 0098, 0099-0336 decisions and results; judge decision.json for all
  32 judge steps; screenshots for 0091, 0098, 00056, 00058 and 00059. Observed
  as quoted above.
- Read `logs/core.log` (around 16:49-16:50 and the tail), `run.json`,
  `summary.json`, `evaluation.json`, `review/timeline.json` (the last 5 events)
  and the Lab log (non-UI lines).
- `git grep` and read in Core at `6a81a391` (HEAD equals 6a81a391):
  - `candidate-trial/interruptions.ts`
  - `whole-trial.ts`
  - `whole-trials.ts`
  - `candidate-trial/{port,run,contracts}.ts`
  - `candidate-start-hook/from-environment.ts`
  - `assembly.ts`
  - `assemble-tool.ts`
  - `unchanged-submission.ts`
  - `state.ts`
  - `plan-input.ts`
  - `guidance.ts`
  - `tools.ts`
  - `dispatch-tool.ts`
  - `run-brief.ts`
  - `subflow-trials.ts`
  - `entry-preparation.ts`
  - the `brief-ports.ts` header
  - `detached-subflow.ts`
- Read downstream: `bigbox-retail/shell/store-picker.ts:13` and
  `test-runner/.../build-from-chat.ts:70-190`.

No tests were run; this was an investigation only.

## Not verified

- I did not read the cart's contents at the end. The claim that nothing of this
  task stayed in the cart is inferred from the hook's behaviour and the final
  trial's `leftOnSite`.
- Whether the stale picker was rendered at page load or re-rendered on open. I
  inferred it from the screenshot (header and "Stores near Millbrook" after a
  server reset) and the fixture template.
- In repair trials 0133 and later, the step saved against Millbrook's "Your
  store" label resolved to Carden Falls' "Your store" label (judges: "Your store"
  still on Carden Falls). Whether the element resolution should have refused that
  row mismatch was not investigated.
- The source of the judge-evidence mojibake.
- Whether Core has a build wall-clock bound in project mode. None fired in about
  13 minutes.

## Open questions or contradictions found

- The brief says "each later `project.assemble` answered unchanged". There were
  only three later assemblies (0120, 0146, 0182); brief-6..10 were sent without
  assembling in between.
- The builder brief's `startLocationNote` says the arrival "is the Flow's first
  step, already kept". In project mode no subflow keeps it and assembly does not
  add it, so that note is untrue for project builds. That is fix 1's subject.
- `failingReceipt` is required for a repair and stored, but read by nothing. Is
  it meant to reach the builder, which would be a lost wiring, or was it only an
  audit field? Fix 2 assumes the former.
