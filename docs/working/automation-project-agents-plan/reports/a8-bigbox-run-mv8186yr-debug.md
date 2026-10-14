# Debug: A8 run run-mv8186yr-a385fd3a (bigbox-retail-pickup-cart, project mode)

Read-only investigation. Nothing was edited except this report. No Lab run and no provider call.

Sources:

- Steps: `lab-runs/2026-10-14/run-mv8186yr-a385fd3a/steps/` (349 steps plus `index.md`).
- The Lab log, `logs/core.log`, and the screenshots taken after steps 29 and 51.
- Core on `dev` (`3a2cb555`). The run used lane tree `fxwork/t565`, with Core at `048a1d91`. The only change between
  them is t577, which touches brief sizing and the subflow-brief contract. None of the files cited below changed, so
  every line number is the same at both commits.
- Scenario source under `fxwork/t565/!FluxIQWebExtension/apps/scenario-lab/src/` (control.ts, state-store.ts, bigbox
  shell-script.ts and mutate-state.ts) and the Lab's start-hook environment
  (`packages/test-runner/src/environment.ts:163`).

## Outcome

Done. The run failed for reasons in Core, not in the model. The supervisor's plan was mostly sensible. The builders
reached the right controls on the site, and every builder got a proposal accepted. None of the 20 trials could pass,
for two separate reasons:

1. **The trials of `switch_store` ran on a stale tab.** The trial's start hook reset the fixture on the server. It did
   not reload the tab and did not go to the start page, so the subflow ran against a page that still showed the
   store the builder had just chosen (cause A).
2. **Every dependent subflow's trial was refused before it ran.** These trials need a predecessor proposal whose
   trial answered yes. `switch_store` never got one, so all 14 trials of the other three subflows answered
   `subflow.trial_predecessor_missing`. The dispatcher still started those briefs (cause B).

Those builders were then told to "complete with outcome blocked", but their completion schema has no such field
(cause C). Each sent the same completion four times and was stopped. The judge was never called, so this run says
nothing about t574's judge evidence.

## Timeline (step ranges per agent)

| Steps | Agent | Subflow | Calls / $ | Trials | Ended |
| --- | --- | --- | --- | --- | --- |
| 1 | panel chat | - | 1 | - | `flow.createHere` |
| 2-6 | supervisor | plan, dispatch 1 | 3 decisions | - | 4 briefs, 46 turns / $0.048 each |
| 7-99 | brief-1 | switch_store | 46 / $0.0269 | 4 (all ran, all `execution_failed`) | `llm_evidence_loop.iteration_limit`, partial rev 5 |
| 100-146 | brief-2 | add_paper_towels | 23 / $0.0163 | 3 (all `predecessor_missing`) | `evidence_repeat_without_progress` (4 refused completions) |
| 147-187 | brief-3 | add_napkins | 20 / $0.0110 | 3 (all `predecessor_missing`) | same (4 refused completions) |
| 188-208 | brief-4 | preserve_cart | 10 / $0.0064 | 1 (`predecessor_missing`) | same (3 `candidate.unchanged_submission` in a row) |
| 209-210 | supervisor | dispatch 2 | 1 decision | - | 4 briefs, 26 turns / $0.0357 each |
| 211-253 | brief-5 | switch_store | 21 / $0.0089 | 2 (ran, `execution_failed`) | same (3 `repeat_refused` in a row) |
| 254-300 | brief-6 | add_paper_towels | 23 / $0.0124 | 3 (`predecessor_missing`) | same (4 refused completions) |
| 301-323 | brief-7 | add_napkins | 11 / $0.0046 | 2 (`predecessor_missing`) | same (4 refused completions) |
| 324-348 | brief-8 | preserve_cart | 12 / $0.0044 | 2 (`predecessor_missing`) | same (4 refused completions) |
| 349 | supervisor | - | 1 decision | - | `complete {ended: blocked}`, 9 lasting acts still in place |

The run cost $0.094 of its $0.25 and made 170 provider calls. The briefs that could never get a trial (2, 3, 4, 6,
7 and 8) spent $0.055 of that.

## 1. The supervisor's plan

The plan was written in one call (steps 3-4).

- Parts: p1 switch the store, p2 two packs of towels in one size, p3 one pack of napkins in one size, p4 "keep the
  cart and do not check out" (no lasting acts).
- `notAsked` was sensible: no checkout, no change to the existing cart, no delivery, no other sizes.
- Subflows:
  - `switch_store` (p1) hands back `storeName`.
  - `add_paper_towels` (p2) and `add_napkins` (p3) each take `storeName`, after `switch_store`.
  - `preserve_cart` (p4) takes `storeName`, after both add subflows.

Does it fit the task?

- **The order is right.** The site's default fulfilment depends on the chosen store. At the start store the towel
  variant offers only Delivery (step 114: `t960 clickable marked`, `t961 "Delivery"`). Every towel add made while
  exploring landed as "Qty 1 · Delivery" (steps 116 and 276). So the store has to be switched before anything is
  added.
- **`storeName` is an interface nobody uses.** No add step reads it. Because of it, brief-1 had to bind an output it
  had no step for:
  - First it wrote an extract with an invented handle `extraction.1`, which was refused (step 19).
  - Later it bound `$step.choose-store.control` (the "Set as my store" label, step 27).
  - At revision 4 (step 49) it dropped the store-switching press altogether. That revision only opened the picker
    and read the product list. Core accepted it, although the subflow no longer did p1.
- **`preserve_cart` should not be a subflow.** p4 is a constraint: it has no act and nothing to build. Making it a
  subflow added a fourth builder, and a predecessor chain on both add subflows that could never be satisfied. Its
  builder switched the store, which nobody briefed it to do (step 198, `modify_existing`). That act then
  contaminated the second `switch_store` builder (below).

## 2. Each builder: what it tried, what repeated, and whether the guard was right

**brief-1, switch_store (7-99)**

- It switched the store correctly in 6 actions: close the consent banner, close the promo, open the picker
  (`t7`), then the Millbrook "Set as my store" (`t353`). At step 17 the header read Millbrook.
- Submissions:
  - Step 19 was refused for the invented handle. The refusal was right.
  - Step 23 was refused with `subflow.scope_refused` / `subflow.steps_outside_part` at line 19. The model had
    copied Core's own probe lines (`end end end step subflow-probe-call: run switch_store`). The refusal's
    `previous` field had shown it those lines and said "send it again with only the listed issues corrected: keep
    every other line" (see section 4).
  - Revision 2 (step 27) was the correct subflow: open the picker, then Set as my store.
- Trial 1 (step 29) ran. The open-picker step passed. The Millbrook "Set as my store" step failed
  `web.target.not_found` after 4 attempts.
- Trials 2-4 (steps 51, 63, 93) failed at the open-picker step with `web.target.ambiguous`.
- After that, every submission was the same revision-5 script:
  - Steps 57, 65, 69, 83 and 85 were refused `candidate.unchanged_submission`.
  - Steps 25, 45, 47, 71, 87, 89, 95 and 99 were refused `llm_evidence_loop.repeat_refused`.
  - The repeated looks (detect on `t337`, describe on `t369` and `t365`) were refused `already_answered`.
  - Steps 91 and 97 were refused `not_offered` in the wrap-up.
- It ended `iteration_limit` at 46 turns.
- **Guard verdict:** the repeat and unchanged guards were right. The inputs were identical and nothing had changed
  (repeat guard: `llm/repeat-guard/feedback.ts:24`, at most 3 in a row). The builder could not have fixed this,
  though: its revision 2/5 was a correct subflow, and the trial failed because of how the trial was set up
  (cause A).

**Why `switch_store`'s trials failed (cause A).** The evidence:

- `run.ts:71` calls the deployment start hook, and the trial records `start: "reset"`. The Lab's hook is
  `/__control/reset` (`environment.ts:163`), which resets server state: the store, the consent answer and the cart
  (`control.ts:19-21`, `state-store.ts:23`).
- Nothing then reloads the tab or goes to the start location:
  - `run.ts:71-97` goes straight from the start to `runAutomationStudioDetachedSubflow`.
  - In `detached-subflow.ts` the throwaway root is a start step followed by Call Subflow steps; there is no
    navigation step.
  - The subflow has no navigate step of its own, because the brief tells it to write only its own part.
- So the trial ran on a stale page. The screenshots after trials 1 and 2 (steps 29 and 51) show the header still
  reading Millbrook, the picker open with Millbrook marked "Your store", and no consent dialog. On a page loaded
  after a real reset, the consent dialog would be showing.
- The server reset did happen. At the next fresh navigation (brief-2, step 100) the page shows the consent dialog
  again, the start store, and the start cart of 1 line ($3.97). Nothing else in brief-1 could have reset the site.
- The pattern holds through the rest of the run. The site is found reset only after a brief whose trial got as far
  as calling the hook: brief-1 before step 100, and brief-5 before step 254. After briefs whose trials were all
  `predecessor_missing`, the acts pile up:
  - brief-3 starts with a cart of 2 lines ($20.44) and brief-4 with 3 lines ($26.92).
  - brief-7 and brief-8 show the same.
  - `run.ts:67` returns before the hook, so those trials never reset anything.
- On the stale page Millbrook's card has no "Set as my store" button, so trial 1 answered not-found.
- In trials 2-6 the open-picker step's saved control is `"Pickup or delivery?Carden Falls Supercenter"`. The live
  button read `"... Millbrook Crossing Supercenter"`, and the only other match for "Pickup or delivery?" is `t8`, a
  span inside `t7` (steps 73, 231 and 233). The result was `web.target.ambiguous`.
- In brief-5 the saved control still carried the start-store label, even though no view brief-5 was shown printed it:
  - `grep` finds only the Millbrook label for `t7` in the requests at steps 212 and 220.
  - So `t7`'s fingerprint came from an earlier capture somewhere in the build. Where the extension or Core keeps
    that binding was not traced.

**The trial gate does not undo the build's acts.** `run.ts:9-10` says "Undoing the build's own acts is the trial
gate's, before it asks". That is not true:

- `subflow-trial-gate.ts` `test()` (lines 68-103) calls the port with no site reset and no `startedWith`.
- The whole-candidate gate does reset first (`candidate/trial-gate.ts:227-229`).
- Without the Lab's hook, a subflow trial would run on whatever earlier briefs left behind. That breaks the
  2026-10-12 rule that a build resets the site before it re-runs.

**brief-2, add_paper_towels (100-146)**

- Exploration was clean: search, open the product, choose 12 Double Rolls (`t706`), Add to cart. The cart line
  landed as Delivery, because exploration starts from the build's start, not from after `switch_store`.
- Step 118 was refused `web.handle.not_a_field` on `t971`, the quantity text span. The refusal was right.
- Three describes in a row were refused `already_answered`; the refusals were right.
- Revision 2 (step 132) was accepted. Trials 134, 136 and 138 answered `subflow.trial_predecessor_missing`
  (`missing: ["switch_store"]`): `run.ts:65-67`, `proposals.ts:33-37` (only a predecessor proposal whose trial
  answered yes counts).
- Then four identical completions (steps 139-146) were refused `subflow.trial_execution_failed`. The loop stopped
  with `evidence_repeat_without_progress`:
  - `completion.ts:77` counts each refused completion as an "unusable" decision.
  - `evidence-loop.ts:308-317` stops the loop.
  - `stall-code.ts:27-29` names the stall, because the issue code is not a reply-shape code.
- **Guard verdict:** right mechanically: the same completion four times over the same proposal. But the model had no
  legal honest exit (cause C), so the stop and its code describe the model wrongly.

**brief-3, add_napkins (147-187).** The same pattern. Revision 1 (step 173) was accepted. Three
`predecessor_missing` trials, then four refused completions. Guard verdict as for brief-2.

**brief-4, preserve_cart (188-208)**

- It went to the cart and pressed Set as my store for Millbrook (step 198), which it was not briefed to do.
- Revision 1 (step 200) was accepted. Its trial answered `predecessor_missing` (add_paper_towels and add_napkins).
- It resubmitted the identical script three times, each refused `candidate.unchanged_submission`. The refusal run
  ended it (`refusal-run.ts:53`, 3 in a row).
- **Guard verdict:** right. It also left the store switched for brief-5, because no trial reset ran after it.

**brief-5, switch_store (211-253)**

- It started with the store already Millbrook, left there by brief-4. Its "set" press hit `t369`, the "Your store"
  label, which was a no-op (steps 215 and 217).
- Revision 1 (step 221) opened the picker, pressed `t369`, and read the product list. That revision could not pass
  even on a reset page: on a fresh page, item 3 has a button where `t369` had a label.
- Both trials (223, 235) failed `web.target.ambiguous` at open-picker, for the reasons under cause A.
- Then three identical submits were refused `repeat_refused` (249-253), with `t6` refused `not_a_control` between
  them. It ended `evidence_repeat_without_progress`.
- **Guard verdict:** right. Its subflow was wrong because it explored a page someone else had dirtied.

**briefs 6-8 (254-348).** Like briefs 2-4:

- brief-6: one `subflow.scope_refused` from the same probe-line copy (step 280, line 23), two `not_a_field`
  refusals on the quantity, then revision 3.
- brief-7: one accepted revision.
- brief-8: one accepted revision, after brief-4's script was cut down.
- All seven of their trials answered `predecessor_missing`, and each builder ended on four refused completions.

## 3. The 20 "unusable" answers

None was a malformed reply. Every one (steps 140-146, 179-187, 294-300, 317-323 and 342-348) is a well-formed
completion that names the latest proposal, for example (step 139):

```json
{"kind": "complete", "result": {"subflowKey": "add_paper_towels", "revision": 2, "digest": "d8c7e7b7..."}}
```

- Core refused each one at the trial gate: `subflow-trial-gate.ts:113` returns `subflow.trial_execution_failed`
  with the instruction `ENTRY_NOT_PREPARED`.
- That instruction (`subflow-trial-gate.ts:43`) says "if it keeps failing there, complete with outcome blocked and
  say why".
- The builder's completion schema has no such field: `builder-loop.ts:163` allows only `subflowKey`, `revision` and
  `digest`, and `builder-loop.ts:150` refuses any other key.
- The models tried to do what they were told. Summaries read "so I complete with the blocked outcome" (step 141) and
  "complete with the accepted revision 3 as blocked" (step 297), but the only shape they could send is the refused
  one.
- The step log names these "unusable" because `completion.ts:77` records every refused completion as
  `decision: "unusable"`.
- The "sent again" words they were shown (`completion.ts:94-97`) are wrong for a builder: "run the step that is
  missing, or amend the steps they name". That is draft-mode wording.

Format, schema size, truncation and missing tools were not factors. Many decisions used the non-standard
`"kind": "callId"`, and Core accepted them.

## 4. Why submissions were refused

27 submit decisions. 11 were refused by the loop before reaching the tool, and the codes reported by the tool were:

| Code | Steps | Right? |
| --- | --- | --- |
| `flow_bootstrap.evidence_completion_parameters_unresolved`: `web.handle.unknown` | 19 (`extraction.1` invented) | right |
| `...parameters_unresolved`: `web.handle.not_a_control` | 43 (`t369` "Your store"), 247 (`t6` custom element) | right |
| `...parameters_unresolved`: `web.handle.not_a_field` | 118, 278 (`t971` text), 282 (`t972` "+") | right |
| `subflow.scope_refused`: `subflow.steps_outside_part` | 23, 280 | right as a check, but the cause is Core's |
| `candidate.unchanged_submission` | 57, 65, 69, 83, 85, 204, 206, 208, 243 | right |
| `llm_evidence_loop.repeat_refused` (loop, not run) | 25, 45, 47, 71, 87, 89, 95, 99, 249, 251, 253 | right |

Both scope refusals are a probe leak:

- `callable-target.ts:58-60` checks a callable subflow by appending `end`, `end` and a `step subflow-probe-call`.
- `scoped-submission.ts:125-130` passes the refusal over that probe straight back to the builder.
- `llm/harness-options/bootstrap-completion.ts:697` puts the script it checked under `previous`, and the
  instruction tells the model to resend `previous` with only the listed issues fixed.
- The comment at `callable-target.ts:25` says no builder is told of the probe label. The builder is shown it.

## 5. Trial verdicts and the judge

- 20 trials: 6 ran with their entry prepared (brief-1: 4, brief-5: 2), and all 6 were `execution_failed` at a
  step. The other 14 were `predecessor_missing` with nothing run.
- No trial reached the judge: `run.ts:120-125` returns before `ports.judge`. No judge request exists in the step
  log.
- So t574's judge evidence was not exercised. Whether the judge would have got the wording and the tested values
  right cannot be said from this run.
- Were the verdicts right?
  - "execution_failed" is true to what ran.
  - For brief-1, revisions 2 and 5 it pinned the failure on the subflow when the cause was the trial's stale start
    (cause A). I expect those revisions would have passed on a reloaded start page; this was not verified.
  - For brief-5's revision 1 the failure was real: the step targets a label.
  - The 14 `predecessor_missing` answers were right about what happened, but the briefs should never have started
    (cause B).

## 6. How the supervisor reacted, and why the build ended

- **Dispatch 1.** All four briefs came back `partial` with generic reasons only: "`iteration_limit`" and "`Flow
  Bootstrap generation failed (evidence_repeat_without_progress)`". `ending.ts:38-44` gives no trial feedback, no
  "predecessor has no passing proposal" and no failing step.
- **Dispatch 2 (step 209).** The supervisor resent the same four briefs with the same subflows and parts. It added
  only a `recordingExcerpt`, which was the task's own words, and asked for $0.05 and 40 turns, getting $0.0357 and
  26. It did not call `project.amend_plan`. It could not see what had gone wrong.
- **Step 349.** It ended honestly with `ended: blocked`. Nine lasting acts of the build were still on the site:
  extra cart lines (towels for delivery, napkins) and the store switch. It did not dispatch a reset brief before
  ending.

How the dispatcher let the doomed briefs run (cause B):

- `dispatcher.ts:57` holds back a dependent brief only when its predecessor ended `blocked`.
- brief-1 ended `partial`: a proposal stood, but no trial had answered yes for it.
- So briefs 2-4 and 6-8 started, although their trials could never prepare an entry (`proposals.ts:33-37`).

## Comparison with run-mv7vl89u-917d62a6

In that earlier bigbox run, no builder submitted before the build-wide 64-call cap ended the build. The fixes since
then (t570 per-brief shares, t576's 250-call cap, t577 brief sizing) worked here:

- every builder had its own share;
- all eight submitted and got proposals accepted;
- 20 trials ran or were answered;
- the build ended through the supervisor's own honest ending, not a cap.

The failure has moved downstream, to how the subflow trial is set up (the stale tab, and no undo of the build's
acts) and to the brief lifecycle around a predecessor that never passes. The cost was $0.094 against $0.079 then.

## Recommended fixes

None of these mirrors this scenario in model guidance. Every guidance example should use another kind of site.

1. **A subflow trial starts on a loaded entry page** (cause A; Core). After `automationStudioCandidateTrialStart`
   (`run.ts:71`), load the build's start location in the trial tab before the throwaway root runs. Alternatively,
   put a navigate to `startLocation` at the head of the root in `detached-subflow.ts` when the run starts the
   chain.
2. **The subflow trial gate undoes the build's acts before it asks, as the whole gate does** (Core). Wire the
   site-reset ledger into `subflow-trial-gate.ts:test` as `candidate/trial-gate.ts:227-229` does, and pass
   `startedWith`. Fix the claim in `run.ts:9-10`.
3. **No dependent brief starts without a passing predecessor** (cause B; Core). At `dispatcher.ts:57`, also stop
   a waiter whose predecessor's return is not `done`. Return it `blocked`, naming the predecessor and why. That
   would have saved about $0.055 here.
4. **A builder can end honestly** (cause C; Core). Either:
   - add an `{ended: "blocked" | "partial", reason}` variant to the builder completion
     (`builder-loop.ts:150,163`) and map it to the return; or
   - drop the impossible instruction at `subflow-trial-gate.ts:43` and end the brief as `blocked` as soon as a
     trial answers `subflow.trial_predecessor_missing`. Nothing the builder does can change that answer.

   Also give builders their own wording in place of the draft-mode "sent again" text (`completion.ts:94-97`).
5. **Stop leaking the probe** (Core). A refused callable submission's `previous` should be the script the builder
   sent, not the probe from `callable-target.ts:60`. Strip it in `scoped-submission.ts:125-130` before returning.
6. **Returns tell the supervisor why** (Core, `project-agents/dispatch/ending.ts`). Put the last trial's code and
   failing step in the return's reason: entry not prepared and which predecessor, or the step and failure code.
   Then the supervisor can amend the plan instead of resending the same briefs.
7. **Plan checks** (Core, `project-agents/supervisor/plan-input.ts` and guidance, worded generically):
   - Refuse or warn on an interface value that no later subflow takes as a step input.
   - Treat a part with no lasting act whose facts only say what must stay unchanged as a constraint (`notAsked`,
     or the judge's checklist), not a subflow of its own.
8. **A dependent builder explores from its entry** (Core). Run the predecessors' latest passing proposals before a
   dependent builder's first look, or at least tell it its entry has not been prepared. Here every add was explored
   at the start store, and so made with the wrong fulfilment.
9. **Accept no revision that drops its brief's only lasting act** (Core, scoped submission). Here revision 4 of
   `switch_store` read a list and switched nothing.
10. **Reset before an honest ending** (Core supervisor guidance or `completion.ts` of the supervisor). An ended
    build that leaves lasting acts in place dispatches a reset brief, or at least tells the person what is left.
11. **Control identity (extension/Core, not traced).** A saved control's fingerprint should not depend on text the
    build's own acts change. An element that is ambiguous with its own descendant should resolve to the actionable
    ancestor. Find where `t7`'s start-store label was bound for brief-5 before changing anything.

## Commands run and observed results

- `ls`, `index.md`, and per-step `call.json`, `result.json`, `decision.json`, `response.txt` and `request.txt` read
  through a scratch dump script (`python -I`, scratchpad `a8dbg/dump.py`, `page.py`). The table in `index.md` agrees
  with the per-step results quoted above.
- `grep -c 't7 button "Pickup or delivery? Carden'` in steps 0212 and 0220 printed 0 and 0; the Millbrook label
  printed 1 and 1.
- Page grep across the brief starts (steps 7, 100, 147, 188, 211, 254, 301, 324) showed the store, cart and consent
  sequence quoted above.
- Core: read `subflow-trial/run.ts`, `subflow-trial-gate.ts`, `builder-loop.ts`, `proposals.ts`, `dispatcher.ts`,
  `ending.ts`, `callable-target.ts`, `scoped-submission.ts:118-130`, `completion.ts`, `evidence-loop.ts:295-317`,
  `stall-code.ts`, `refusal-run.ts`, `candidate-start-hook/from-environment.ts` and `candidate-trial/run.ts:173-196`.
- `git diff --stat 048a1d91 HEAD` in Core listed only 5 files (t577: subflow-brief, brief-sizing and their tests).
  None is cited here.

## Not verified

- That the trial tab is never reloaded after the hook. This is inferred from the screenshots, the missing consent
  dialog, and the reset state at the next navigations; no execution trace or scenario request log of the trial was
  available (`scenario-lab.log` holds only its ready line).
- That brief-1's revisions 2 and 5 would have passed on a reloaded start page.
- Where `t7`'s start-store fingerprint was bound for brief-5's step.
- Whether the briefed lasting-act scope is meant to stop a `modify_existing` that no part asked for (brief-4).
- The judge's behaviour: it was never called.

## Open questions or contradictions found

- `run.ts:9-10` claims the subflow trial gate undoes the build's acts. `subflow-trial-gate.ts` does not.
- The supervisor's `howToWork` says Core "permits exactly the lasting acts its parts ask for". brief-4 made a
  `modify_existing` that its part (no lasting acts) did not ask for, and it ran.
- The `callable-target.ts:25` comment says no builder is told of the probe label, but refusals show it to the
  builder in `previous`.
