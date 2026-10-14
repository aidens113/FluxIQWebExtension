# A8 launch 7 debug: crossborder `run-mv8c76i3-61b9ca89`

Read-only investigation. Pair that ran: downstream `760d42bf` and Core `6a81a391`. Lane tree
`fxwork/t563`, both repositories clean at those commits, matching the main checkouts I read. No
model provider was called and no Lab run was started. Page data is quoted only as product and
control names.

## Outcome

Done. One root cause, plus four defects that made it worse:

1. **Root cause: brief-1 did brief-2's work.** The `add_hub_to_cart` builder (part p1) wrote
   p2's coupon press into its own subflow (step "collect the store coupon", `target: t934`,
   `consequences: none`). Nothing caught this: no Core check, not the permission gate (the press
   declared no lasting act), and not the two trial judges. So every prepared entry for
   `collect_coupon` started with the coupon already in its done state ("Collected"). The only
   control the builder could name then had a thinned identity, and the web domain's save-time
   identity guard was right to refuse it. With nothing left to do, three builders resubmitted
   the same script until the repeat guard ended each brief.
2. `itemPage` should not have been an interface value. `add_hub_to_cart` bound it to a click's
   control port (`$step.add-to-cart.success`), and Core accepted that. `collect_coupon` then
   "read" it as `navigate url: $input.itemPage` only to get past t581's `subflow.input_unread`,
   when it should have ended blocked as that refusal told it to.
3. A blocked builder's return carries only refusal codes. The supervisor never learned that "the
   coupon already shows Collected". It re-sent the same brief twice with no plan change, then made
   up a reason when it ended.
4. The closing chat line misstates the ending. "The build failed: what the model wrote could not
   be used" comes from a stage fallback, because `project.build_partial` has no words of its own.
5. Side defect (brief-1): the repeat guard refused a resubmission that would now have passed,
   because the "handle not yet shown" lift does not cover a submission refused for an unknown
   handle.

## What changed and why

Only this report.

## Timeline (UTC, 2026-10-14)

| Time | Step | What happened |
| --- | --- | --- |
| 16:44:43 | 0001 | The chat prompt starts the build (mode `project`). |
| 16:44:50 | 0003-0004 | `project.write_plan` (no warnings): p1 (cart, lasting act `create_new`) and p2 ("Collect that store's coupon while you are on the item", lasting act `create_new`). Subflows: `add_hub_to_cart` [p1] with outputs [itemPage], and `collect_coupon` [p2] with inputs [itemPage] and after [add_hub_to_cart]. |
| 16:44:52 | 0006 | One dispatch with both briefs. They ran in order (host capacity 1). |
| 16:44:52-16:45:43 | 0007-0041 (brief-1) | Explores: search, closes the cookie layer, opens the item page. The coupon control t934 reads "Get coupons" in every view (0017, 0019). The 0028 script already includes "collect the store coupon" (t934). 0029 is refused (`web.handle.unknown` on `extraction.1`). 0031 detects `extraction.1`. 0032 sends a byte-identical script and is refused as a repeat (defect 5). 0035 is refused `subflow.output_unbound`. 0037 and 0039 are repeats. 0041 is accepted as revision 2 with `output: itemPage = $step.add-to-cart.success`. |
| 16:45:45 | 0043 | `core.test_subflow` answers yes. The trial ran "collect the store coupon" on "Get coupons" (succeeded on attempt 2), then the option presses, quantity and Add to cart. `leftOnSite`: act-1 (add to cart) only. |
| 16:46:15 | 0044, 0045 | Two judge calls, both yes (see question 6). Brief-1 completes, done. |
| 16:46:42 | 0047 (brief-2) | Entry prepared (t580/t585), `absorbedByStartReset: [act-1]`. The page is the item page, and t934 now reads "Collected". |
| 16:46:46-16:46:59 | 0051-0065 | Seven submissions: `scope_refused` (input mismatch), `scope_refused` (input unread), unidentifiable, unidentifiable again with a location, one `already_answered` look, then three identical resubmissions refused as repeats. Brief-2 comes back blocked. |
| 16:47:01 | 0066-0067 (brief-3) | Re-sent with the same subflow and parts, and a `recordingExcerpt`. The entry is prepared again (absorbs act-2), t934 still reads "Collected", and the same refusals follow. Blocked. |
| 16:47:43-16:48:27 | 0091-0096 (brief-4) | The supervisor looks twice, then re-sends with an excerpt naming t931, a text element and not the control. Same refusals. Blocked. |
| 16:48:29 | 0116-0117 | The supervisor completes `ended: partial` and is refused `project.completion_reset_first` (act-4, from brief-4's entry preparation, is still in the cart). |
| 16:48:31-16:48:47 | 0118-0129 (brief-5) | Reset brief: home page "3 Cart", opens the cart, presses Remove (`undoes: act-4`), cart reads "0 Cart". Done. |
| 16:48:49 | 0130 | Completes `ended: partial`. The build throws `flow_bootstrap.post_provider_validation_failed` with `issueCodes: [project.build_partial]`. |
| 16:48:56 | Lab seq 22 | `lab.chat_build_failed`, category `runtime.behavior`. 65 calls, $0.0356 of the $0.25 ceiling. |

Spend by brief: brief-1 $0.0155 (21 calls), brief-2 $0.0071 (9), brief-3 $0.0036 (11),
brief-4 $0.0023 (9), brief-5 (reset) $0.0028 (5). The supervisor spent the rest.

## 1. Why each `collect_coupon` submission was refused

The same pattern repeats in all three briefs. Brief-2's calls:

| Step | What was sent | Refusal | Check (file:line) | Right? |
| --- | --- | --- | --- | --- |
| 0051 | `part collect_coupon` with no `input:` line, one click on t934, using node id `web.dom.click`. The decision object itself was malformed (`"kind":"callId"`, extra `plan`/`summary`), but the loop still ran it. | `subflow.scope_refused` / `subflow.interface_input_mismatch` | Core `runtime/flow-bootstrap/subflow-candidate/callable-target.ts:58-62` | Yes. The scope's interface gives `itemPage`. |
| 0053 | Adds `input: itemPage`, which nothing reads | `subflow.scope_refused` / `subflow.input_unread` (digest b54daa6d) | Core `callable-target.ts:72-81` (t581) | Yes. Its message already offered the right exit: "If this subflow has no use for it ... end the brief blocked and name the input, so the plan can change." The builder did not take it. |
| 0055 | Adds `step: open the item page`, `navigate url: $input.itemPage`, then a click on `t934` | `flow_bootstrap.completion_refused` / `evidence_completion_parameters_unresolved`, issues `web.handle.unidentifiable` and `web.handle.unidentifiable:target` at line 8 (digest c034ed3e) | Web domain, not Core: `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:637-639`, through `identity-guard.ts:22-25`, `element-fingerprint/shortfall.ts:43-47` and `element-fingerprint/signals.ts:66-69` | The guard was right, for an upstream reason (below). |
| 0057 | The same, with `target: {"handle":"t934","location":...}` | The same, unidentifiable (digest 6bd7f51c) | The same | Yes. A location adds no identity signal. |
| 0059 | A snapshot | `llm_evidence_loop.already_answered` | Core `llm/evidence-loop.ts:773` | Yes. The page had not changed. |
| 0061, 0063, 0065 | Byte-identical to 0055 | `llm_evidence_loop.repeat_refused` ("the same call before: failed"), 3 in a row, then the brief stops as `flow_bootstrap.evidence_repeat_without_progress` | Core `llm/repeat-guard/outcomes.ts:356` (the key is tool, page state, standing revision and input) and `:428-431` (`blocks`); `feedback.ts:24` (max 3); `decision-handlers/refused-repeat.ts:115` (the stall) | Yes (question 4). |

**Why t934 was unidentifiable.** The handle store lives for the whole build, so t934 keeps
every view any brief took of it. In brief-1 it was `<div>` "Get coupons" with class `b`. After
the entry preparation ran `add_hub_to_cart`, which pressed it, t934 became `<div>` "Collected"
with classes `b x` (describe at 0049). Because the tag and selector match, `element-identity.ts`
`webPlanElementIdentityAcrossViews` (lines 192-223) keeps only what both views agree on: the
words are dropped (lines 210-212) and the toggled class `x` is dropped (line 217). That leaves
`div` plus the single class `b`, and `signals.ts:68` counts a lone class beside a bare tag as no
second signal, so the step is short of the two-signal floor. This is exactly the t442 F5 case
the header of `signals.ts` describes: such an identity matches a done coupon as well as an undone
one. Refusing it was correct. The step should never have existed, because brief-1 had already
done what it asked. The refusal wording ("choose a control the page names in more ways") left
the builder no exit, since the coupon control was the only one there.

The builder's own summaries said it noticed every time ("The coupon on this item page already
shows Collected"). It never used the `complete {ended: "blocked", reason}` its schema offered.
The entry note (Core `service/project-build/brief-ports.ts:339`, "what they did is already done,
so do not do it again") does not tell a builder what to do when its own part is among the things
already done.

## 2. `itemPage` as an interface value

It is no value. Core's supervisor guidance says so directly (Core
`project-agents/supervisor/guidance.ts:46`: "What an earlier subflow leaves on the target, such
as ... a page left open, is no value: say it with after alone"). The supervisor ignored it, and
no plan warning fired, because `collect_coupon` does take `itemPage`.

What each side did with it:

- **Producer.** Brief-1 first tried to read the item page with `extract_list` (refused as an
  unknown handle, then as a repeat). Then it dropped `output:` (refused `subflow.output_unbound`,
  Core `callable-target.ts:68-71`). Finally it bound `itemPage = $step.add-to-cart.success`.
  `success` is the click node's control port (`domain/src/output-nodes/definitions.ts:22-25`,
  `role: "success"`), not a data output. `callable-target.ts:68` checks only that the binding is
  non-empty, so Core accepted an output that hands on a routing signal.
- **Consumer.** t581's `subflow.input_unread` fired correctly, and its message gave the right
  answer: end blocked and name the input. Every one of the three builders instead invented
  `navigate url: $input.itemPage`, a navigation to a value that is no URL. That line would have
  passed the scope check. It was never reached only because the click step was refused first.
- **What the builder could have done.** Either end blocked, naming `itemPage` and saying the coupon
  was already collected at its entry, or (had the coupon still read "Get coupons") end blocked
  naming `itemPage` as a value it does not need, so the supervisor could amend the plan to
  `inputs: []` with `after` alone. Launch 6's single subflow for both parts avoided all of this.

## 3. Was the entry prepared, and on what page did the builder start

Yes, for all three `collect_coupon` briefs (0047, 0068, 0097): `entry.prepared: true`, with Core
saying it ran `add_hub_to_cart`'s passing proposal once. `absorbedByStartReset` was `act-1`, then
`act-2`, then `act-3`: each time the start hook took back the previous brief's cart add, and the
preparation run then made a new one, recorded in that brief's ledger (`lastingActsInPlace: 1`).
That is t585 working as designed. Each brief started on the item page, scrolled to y=380, with t934
"Collected", a cookie layer t1042 covering four navigation links (its "Not now" is t1081), and
the header cart link reading "0 Cart". The home page read "3 Cart" in the reset brief, so the
item page's header count does not update after an add. A judge noticed this too (0045).

So the preparation was correct, and that is exactly what exposed brief-1's overreach: the
dependent builder started where its own part was already done.

## 4. Was the repeat guard right to refuse the third submission

Yes, in brief-2, brief-3 and brief-4. 0060, 0062 and 0064 are byte-identical to 0055, on the same
page state (0059's snapshot came back `already_answered`) with no accepted revision in between.
Running them again would have given the same identity refusal. Ending the brief after three
refusals in a row is the designed stall. Two gaps remain:

- **The builder is never pointed at its honest exit.** The repeat note (Core
  `llm/repeat-guard/candidate-feedback.ts:39`) offers "look ... use a different control ... submit
  a corrected candidate, or ask the person". It does not offer "complete with ended blocked and
  your reason", which a builder can do and which was the right move here.
- **Brief-1, 0033: the guard refused a submission that would now have passed.** 0029 was refused
  only because `extraction.1` had not been issued yet. 0031 issued it, and 0032 resent the same
  script on the same page state. The lift for "a handle not yet shown" (Core
  `llm/repeat-guard/outcomes.ts:206` and `:412`) tests `call.resultReason` against
  `handle_not_in_packet|handle_not_issued|unknown_handle`. A submission refusal carries its
  `web.handle.unknown` only inside its issues, with `resultReason: null` (0029 meta), so nothing
  was lifted. This pushed brief-1 away from a real read and into the `success`-port binding.

## 5. How the build ended, what the person was told, and the Lab's report

- **The ending was honest and the order was right.** 0116 `ended: partial` was refused
  `project.completion_reset_first`. The reset brief then removed act-4, and 0130 ended partial.
  But the supervisor's reasons were wrong:
  - 0116 claimed the coupon "is already applied automatically at checkout". Nothing showed that;
    it misread the page.
  - 0130 says "the coupon was therefore never collected". It was collected, by
    `add_hub_to_cart`'s trial and by every entry preparation. The reset could not see that,
    because the press declared `consequences: none`, so no act was recorded. After the last
    entry preparation the coupon very probably stayed collected (not verified; no later view of
    the item page exists).
- **What the person saw** (Lab UI review `15-failure-panel.png`):
  - Core's row "The supervisor ended the build with only part of the Flow built. — Nothing this
    build did is still on the target." (Core `service/project-build/run.ts:191-212`, t590). The
    second sentence is probably false about the coupon, for the reason above.
  - Then "The build failed: what the model wrote could not be used. ..." That line is wrong: the
    model wrote nothing unusable. `run.ts:172` throws `flow_bootstrap.post_provider_validation_failed`
    with `issueCodes: ["project.build_partial"]`. `project.build_partial` has no `CODE_WORDS`
    entry (Core `conversations/commands/progress.ts:183-201`), so it falls back to the stage
    words at `progress.ts:210`.
- **The Lab** reported `failed`, category `runtime.behavior`, `lab.chat_build_failed` (first
  failure at seq 22), quoting the chat line, with `flowCreated: false` and no oracle verdict. That
  no Flow was built is accurate. The cause it quotes is Core's misleading line.

## 6. Judge calls

There were two (0044, 0045), both on `add_hub_to_cart` revision 2, both yes (confidence 0.95 and
0.90). No other judge calls were made, and since no Flow was assembled there was no whole-run
judgement.

- **Right on p1's facts.** Both cite the cart state (three of the hub with the chosen colour,
  version and shipping origin) and the chosen options.
- **Missed the overreach.** 0044 lists "collected the store coupon" among the steps and still says
  "nothing the instruction did not ask for was done". The judge was told only the scope ("This
  trial ran only the subflow ... Judge only whether it did these parts", listing p1). Its checklist
  says an addition "no part and no instruction asks" fails, and the coupon is asked by the
  person's instruction, just not by this subflow's part. Under its own instructions a yes is
  defensible. As a check on brief scope it let through the defect that sank the build.
- **Note: the success check passes on any cart count.** Brief-1's success check
  `done when: text t884 contains "Cart"` holds for "0 Cart" as well. The judges looked past it,
  but Core does not refuse a success check that is already true at the start.

## Recommended fixes

None of these mirror the scenario. Guidance examples should use another kind of site with the
same structure (for example a library: an earlier subflow that also renews a loan the next
subflow was meant to renew).

1. **Catch a dependent brief whose part is already done at its entry (root cause, Core).**
   - Change the entry note (`brief-ports.ts:339`) to say: if what your part asks is already true
     here, a subflow before yours did it. Complete with `ended: "blocked"` and say which.
   - Carry that ending into the return (`project-agents/dispatch/ending.ts`), so the supervisor's
     next text says to merge the parts or amend the plan.
   - Mechanically: give the dependent builder's describe or refusal an "already in its done
     state" hint when a handle's words changed between a predecessor's run and its entry.
2. **Give the subflow judge its siblings' parts as out of scope (Core).** List the other parts'
   words to the subflow-trial judge as "another subflow's work: a step that does one of these is
   outside this subflow". A trial that does them then answers no, with that reason. The builder
   prompt already says "write none of its steps here" (`builder-loop.ts:150`). The judge is the
   mechanical backstop the model ignored.
3. **Refuse an interface output bound to a control port (Core, `callable-target.ts:68`).** If
   an `output:` binding names a port whose role is success or failure, refuse it (a new code, say
   `subflow.output_not_a_value`) with the t581 mirror: "if this subflow hands nothing on, end
   blocked and name the output, so the plan can change". Optionally refuse `$input.<name>` in a
   URL-typed parameter when no producer binds that name to data.
4. **Tell a builder its honest exit in the repeat note.** For a builder,
   `candidate-feedback.ts:39` should name "complete with ended blocked and your reason" instead of
   "ask the person". Have the blocked return carry the builder's last decision summary next to
   its codes, so the supervisor reads why and not only what was refused.
5. **Refuse an unchanged re-brief after a blocked return (Core supervisor).** A dispatch that
   re-sends the same subflow and parts under the same plan, after it came back blocked with the
   same refusal codes, should be refused, pointing at `project.amend_plan` or an honest ending.
   This is the repeat guard applied one level up.
6. **Lift the repeat for a submission refused on an unknown handle (Core, `outcomes.ts:412`).**
   Also set `handleUnshown` when the refusal's issues include `web.handle.unknown`, or have the
   domain return reason `unknown_handle` for such a submission refusal.
7. **Fix the closing chat line (Core, `progress.ts`).** Add `CODE_WORDS` for `project.build_partial`
   and `project.build_blocked` (for example "the supervisor ended it with only part of the Flow
   built"), or leave out the generic failed line once t590's ending row has been shown.
8. **Hold a brief to the lasting acts its parts declare (Core).** If a brief's parts declare a
   lasting act and its submission declares none, refuse it (a sibling of t581's
   `subflow.lasting_act_dropped`). Here that would have made the coupon press `create_new`, so
   it would have been recorded, reset, and reported honestly in "what is still on the target".

## Commands run and observed results

All reads, no builds, tests or Lab runs:

- Listed the run directory and read `steps/index.md` (131 rows), `summary.json`,
  `evaluation.json`, `snapshots/flow-lane.json`, `review/timeline.json`, the tail of
  `logs/core.log` (ends `build throw ... code=flow_bootstrap.post_provider_validation_failed`)
  and the Lab log (live guard admitted, prelude rebuilt, verdict failed, $0.0356).
- Parsed `call.json`, `result.json`, `decision.json` and `meta.json` with Python for steps
  0003-0130 as cited, and grepped the 0028, 0044 and 0048 requests for the brief and scope text.
- `git log -1` in `fxwork/t563/!FluxIQWebExtension` printed `760d42bf`, and in
  `fxwork/t563/!FluxIQ` printed `6a81a391`. Both were clean.
- Read the Core and domain sources cited above.
- Viewed `15-failure-panel.png` from the lane tree's UI review.

## Not verified

- Whether the coupon stayed collected after the build ended (no later view of the item page), and
  whether the scenario's start hook resets it.
- Where the malformed 0050 decision (`kind: "callId"`) was repaired into a submission.
- That fixes 1-8 behave as described. None was implemented or tested.
- The fixture's item-page cart count staying at "0" after an add was observed, not investigated.

## Open questions or contradictions found

- The brief asked for "Core file and line" for each refusal. `web.handle.unidentifiable` is the
  web domain's save-time guard (this repository), not Core's.
- Is an across-views identity that lives for the whole build right once a dependent brief's
  entry preparation has acted on the page by design? Today a predecessor's act thins the next
  builder's handles. Fix 1 works around this. A per-entry view history would be the structural
  alternative, at the cost of the t356 protection.
- Should `consequences: none` on a press be accepted when the brief's parts declare a lasting act
  (fix 8)? Is collecting a coupon a lasting act in the product's sense? The plan said so
  (`create_new`).
