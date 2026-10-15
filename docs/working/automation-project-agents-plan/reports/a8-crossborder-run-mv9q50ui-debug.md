# A8 wave 10 debug: crossborder hub-to-cart, project mode, run-mv9q50ui-1736d010

Read-only debug. Nothing was run or committed, and no model provider was called. Pair: downstream `112ad66e` and Core `cf928307`.
Steps are under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mv9q50ui-1736d010/steps/`.

## Outcome

Done. The run was lost to three product defects that had been in place before this wave. One Lab design choice made them harder to see. No t625-t637 change caused the failure.

1. **Overlapping plan parts (Core project-agents).** The supervisor's first plan quoted the whole cart request as part `p1` and a sub-span of it as `p2`, and Core accepted that. The first builder (`open_item`) was therefore told to do the whole task. It did the whole task and passed. `add_to_cart` then had nothing left to do but could not see that.
2. **An output bound to a port the node does not have (Core subflow-candidate).** `open_item` handed on `itemUrl = $step.read-url.url`. That port `url` is on a `dom-extract` step, which declares only `success` and `failed`, and Core accepted the binding. The value was empty, so every later subflow's mandatory `navigate $input.itemUrl` failed. Core's `subflow.input_unread` refuses a subflow that does not read its input, so the builders were forced to keep that broken navigate. That trap explains every `evidence_repeat_without_progress`.
3. **A navigate with no address is reported as a policy refusal (web domain/extension).** The empty-url navigate reached the content script and came back as `web.action.unsupported_type`: "A permission or policy refused the step", "web.browser.navigate has no verb in this build". Nothing told the builders that the value was missing.

## What changed and why

Only this report file changed. No code changed.

### (1) First plan, briefs and first trials: why `add_to_cart` was repaired

- **0004 `project.write_plan`.** Part `p1` quotes the whole instruction minus "Do not buy anything": *"On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item."* Its goal facts are item open, variant chosen and coupon collected, and its lastingActs is `create_new`.
  - `p2` quotes *"put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart"*. That is a verbatim sub-span of `p1`.
  - The subflows are `open_item` (parts p1, output `itemUrl`) and `add_to_cart` (parts p2, input `itemUrl`, after `open_item`).
  - Core returned `ok: true` with no warning.
  - For comparison, the passing launch-8 plan (`run-mv8i8r0u-0b564e8b`, step 0006) had disjoint quotes. Its p1 was the cart sentence and its p2 was the coupon sentence. Its second subflow took no input.
- **Brief-1 (0008).** The brief says *"It does only this part of the task: 'On Farbazaar, put three … in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon …'"*.
  - The builder correctly wrote the whole job (0029). That includes `set the quantity to three`, `add the three hubs to the cart` (create_new) and `output: itemUrl = $step.read-url.url` on a `web.output.dom-extract` of the h1 with `extract: {}`.
  - Its own `done when: text t875 contains "3"` was false, because the header reads "0 Cart".
- **0031 trial: `subflow.trial_yes`.** Both judges (0032, 0033) said the whole request was met.
  - 0032: *"set the quantity to 3 and added the three hubs to the cart … the cart's own state confirms 3 items, so the request itself is met."*
  - 0033: *"the cart holds three of the requested configuration … nothing outside this subflow's part was done."*
  - `leftOnSite`: *"act-11 … 'add the three hubs to the cart' on 'Add to cart'"*.
- **Brief-2 `add_to_cart` (0036-0063).** The entry was prepared by running `open_item`, so the cart already held 3. The builder's view (0037) shows `t875 link "0 Cart"`, quantity `="3"` and coupon `"Collected"`.
  - The cart icon's count is the scenario's deliberate stale badge (`client/shell-script.ts`: *"that number is only ever right on a fresh page load"*). The truth is in the hidden flyouts.
  - The entry note says only *"what they did is already done"*. It does not say what they did. The builder could not see that its part was done, so it rewrote the whole job.
  - 0043 was refused `subflow.scope_refused:b54daa6d` = `subflow.input_unread`: *"The input 'itemUrl' … is declared, and no line of this part reads it."*
  - 0045 added `step: open the item page / node: web.output.browser-navigate / url: $input.itemUrl`, and that version was accepted as revision 1.
  - **0047 trial `execution_failed`.** `open_item` ran (steps 4-17, cart filled at 16). Then step 18 call-subflow failed, and step 19 `open the item page` failed: `failureCode: web.action.unsupported_type`, *"happened": "A permission or policy refused the step."*, *"actual": "web.browser.navigate has no verb in this build"*, `retryable: false`.
- **Why `add_to_cart` was repaired.** No whole test was ever run. The only failing receipt was this subflow trial. The supervisor repaired from it (0064: *"its only trial failed execution. Repair it from that trial"*).

### (2) What each stalled builder repeated, and why

| Brief | Steps | Loop |
| --- | --- | --- |
| brief-2 build `add_to_cart` | 0043-0063 | Without the navigate it was refused `input_unread` (0043, 0049). With the navigate it was accepted but the trial failed (0047). It resent unchanged (0057 `candidate.unchanged_submission`), then 0053/0055/0059/0061/0063 `llm_evidence_loop.repeat_refused`. |
| brief-3 repair | 0066-0080 | Same pair: 0070 refused `input_unread`, 0072 accepted, 0074 failed identically at the navigate, then 0076-0080 repeat_refused. |
| brief-4 repair | 0089-0113 | Same pair: 0099 refused `input_unread`, 0101 accepted, 0103 failed at the navigate, then repeat_refused. |
| brief-5 `open_item` (amended plan) | 0138-0158 | Refusals on its `read-url` extract parameters (0138 `invalid_parameter_value`, 0142 `web.handle.misplaced`), then rev 5 with `extract: {"attribute": "href"}` on the h1. The h1 has no href, so itemUrl is again empty. Its trial passed (0158) because it again did the whole job, including the add-to-cart at step 12. |
| brief-6 `choose_variant` | 0164-0192 | The same `input_unread`/navigate trap. 0180 failed at step 15 with the same `unsupported_type`. |
| brief-7 `collect_coupon` | 0193-0215 | Oscillated between two refusals: without a navigate, `input_unread` (0205, 0211-0215); with a navigate, `subflow.lasting_act_missing` (0209, `76f26022`). The coupon already read "Collected" at its entry. |
| brief-8 `add_to_cart` | 0163 | Blocked. Its predecessor `choose_variant` ended partial. |

**What they saw.** An item page with every option marked, quantity 3, coupon "Collected" and a stale "0 Cart" badge. Nothing on the page showed that the cart already held three.

**What they were told.**
- `input_unread` told them to read `itemUrl`. The only sensible read was a navigate.
- The trial told them the navigate was *"A permission or policy refused the step"*, with *"retryable": false*. Nothing said that the value was empty or why.
- The brief and the refusal both offered the way out: *"If this subflow has no use for it … end the brief blocked and name the input"*. No builder took it.

**Did a recent change mislead them?** No.
- t625: the repair context was correct. 0067 `repairOf.failedStep` names step 19 and its code, and `yourSubflow` carries the accepted script. It faithfully repeated a misleading failure record.
- t627: the top-ups were irrelevant. The allowances were $0.08-$0.11 per brief and the run spent $0.070 in total.
- t631-t637 judge and fallback rules: the judges only saw passing trials (0032/0033, 0159/0160), and their yes was correct for p1 as quoted.
- t630: its blocked-return wording was correct and was the right advice. brief-7's reason (0163) says *"The plan gives this subflow a value no step of it reads: change the plan with project.amend_plan … or carry its parts in the subflow that reads that value."* The supervisor did not follow it (see 3).

### (3) Why assembly was refused at the end

- **0114 `amend_plan`** made the overlap worse. It shortened p1 to the cart sentence and gave the same part p1 to three sequential subflows (`open_item`, `choose_variant`, `add_to_cart`). It also kept `itemUrl` as an input to `choose_variant`, `collect_coupon` and `add_to_cart`.
  - Core accepted the amendment (0115) and dropped `open_item`'s done proposal (*"its parts changed"*). That discarded the one proposal that did the whole task.
- **0217 and 0221 `project.brief_repeated`.** The repeat was `collect_coupon`, and the whole dispatch was refused, including the changed `choose_variant` repair.
- **0219 `project.brief_refused` / `project.failing_receipt_unknown`.** The supervisor named `choose_variant`'s trial for a `collect_coupon` repair. It tried to remove an input through dispatch, which cannot change inputs, and never amended the plan.
- **0222 complete.** It was refused `project.completion_reset_first` because act-53 was in place (0223).
- **0225 reset.** The reset completed, and its `next` said *"Test the latest assembled Flow with core.test_candidate"*. No Flow had been assembled. The text comes from `project-agents/supervisor/guidance.ts:149`.
- **0229 `project.assemble_refused`.** `assemble_proposal_missing` was returned for `choose_variant`, `collect_coupon` and `add_to_cart`: under the amended plan only `open_item` rev 5 was done.

### (4) Was there a pass that t637's fallback should have completed on?

No t637 case existed.
- No `core.test_candidate` ran and no assembly ever succeeded, so there was no whole-test pass.
- t637 (`8f64cc9e`) keeps the most recent *whole-test* pass as the fallback. Partial subflow trials are explicitly not whole tests: 0031's instruction says *"It is a partial trial … no trial of the whole Flow"*.

There was a de facto whole-task pass, though.
- `open_item` rev 1 (0031, receipt `subflow-trial.401ed71c-…`) and rev 5 (0158) each started at the build's start location with no predecessors. Each ran the full job and was judged twice to meet the whole request.
- A one-subflow plan carrying both parts would have assembled and almost certainly passed its whole test. That is the shape the candidate-mode pass in this wave had.
- Core had the evidence to see this: the leftOnSite act-11 was the add-to-cart press. Nothing surfaced it to the supervisor.

### (5) Root causes, classification and smallest structural fixes

**RC1. Core project-agents: the plan contract accepts overlapping parts and one part carried by several sequential subflows.** Primary cause, not a regression.
- This is a latent gap that the supervisor model's plan variance exposed here.
- The passing launch-8 plan had disjoint parts. No check exists today: `contracts/task-spec.ts` `quoteIssues` checks only verbatim and source, and `contracts/structure-plan.ts` `issues` checks only unknown or uncovered parts.
- Fix in `task-spec.ts`: add `project.quote_overlaps`, refusing two parts of one source whose quote spans intersect. Compute the spans by locating each verbatim quote in the source text.
- Fix in `structure-plan.ts`: add `project.plan_part_carried_twice`, refusing a part in `partOf` of more than one subflow, except router-situation alternatives and recovery subflows.
- Add words for both in `supervisor/guidance.ts`, and tests in `contracts/tests/`.
- Either check would have refused 0004 and 0114 at write time.

**RC2. Core subflow-candidate: an interface output may be bound to a port its step's node does not declare.** Not a regression.
- This is a hole left by t594's `subflow.output_not_a_value`.
- In `flow-bootstrap/subflow-candidate/route-outputs.ts`, a port the registry does not describe falls to `ROUTE_PORTS[port]`, which is undefined, so the check continues silently.
- The web nodes declare only `success` and `failed` (plus `records` on extract_list) in `domain/src/output-nodes/definitions.ts:22-25,254`. So `$node.read-url.url` names nothing.
- Fix: in the same function, refuse with `subflow.output_unknown_port` when the node's definition is known and the port is not among its outputs. The message should name the ports it does declare and reuse t581's way out ("end the brief blocked and name the output, so the plan can change").
- Test: `subflow-candidate/tests/scoped-submission.test.ts`.
- This would have refused 0029 and 0156 and sent the plan back. Without RC2 the `input_unread` rule forces every later subflow onto a value that never exists.

**RC3. Web domain: a navigate whose `url` resolves to nothing is dispatched anyway and is misreported.** Not a regression.
- `domain/src/output-nodes/payloads.ts:75` compacts away a non-string url.
- `apps/extension/src/runtime/action-runner.ts:103` treats a navigate without url as not a navigation, so it reaches `content/actions/execute.ts:119`, which reports UNSUPPORTED_TYPE with the "permission or policy" category text.
- Fix: refuse before dispatch in the domain (`output-nodes/payloads.ts`, or the navigate branch of `output-nodes/native-runtime.ts`) with a missing-value failure. It should say the step's `url` had no value and quote the binding it read (`$input.itemUrl`), and it should not be retryable.
- Optionally the extension runner can answer a url-less navigate with that same code instead of falling through.
- Test: `domain/src/output-nodes/tests/`.
- Builders would then have seen *"url had no value (from $input.itemUrl)"* and ended blocked naming the input.

**Contributing causes (Core, smaller).**
- `service/project-build/brief-ports.ts`: the prepared-entry note says *"what they did is already done"*. It should also list the predecessors' landed lasting acts (step label and control, which Core already holds as `leftOnSite`), so a builder whose part is already done can see it behind a stale badge.
- `project-agents/supervisor/dispatch-tool.ts`: `project.brief_repeated` refuses a whole dispatch for one repeated brief. It could send the unrepeated ones and refuse only the repeat.
- `supervisor/guidance.ts:149`: `afterReset` should not tell the supervisor to test an assembled Flow when none exists, or when the reset was asked for by `completion_reset_first`. It should then say "end again".

**Lab.** The stale cart badge is deliberate live-site fidelity (`apps/scenario-lab/src/scenarios/crossborder-marketplace/client/shell-script.ts`). It is not a Lab defect.

None of these fixes is model guidance, and none mentions this site, task or product.

## Commands run and observed results

- `python …/scratchpad/a8-summary.py run-mv9q50ui-1736d010` printed 231 steps and the dispatch, amend and assemble lines quoted above.
- Read with Python and grep, all read-only:
  - step index `index.md`
  - `call.json`/`result.json` of 0004, 0006, 0029, 0031, 0036, 0043, 0045, 0047, 0049, 0051, 0053, 0057, 0065, 0115, 0138, 0142, 0156, 0158, 0163, 0178, 0180, 0205, 0209, 0215, 0217, 0219, 0221, 0225, 0229
  - decisions 0035, 0064, 0081-0087, 0114, 0116, 0162, 0222, 0228, 0230
  - judges 0032 and 0033
  - builder requests 0008, 0038, 0067, 0119, 0165, 0194
- Comparison: the launch-8 summary and plan of `run-mv8i8r0u-0b564e8b` (write_plan 0006, dispatch 0008 with two subflows done, assemble 0060, `test_candidate` yes at 0062).
- Code reads:
  - downstream: `apps/extension/src/content/actions/execute.ts`, `apps/extension/src/runtime/action-runner.ts`, `domain/src/output-nodes/{definitions,payloads,native-runtime}.ts`, `apps/scenario-lab/src/scenarios/crossborder-marketplace/{live-tasks.ts,client/shell-script.ts,markup/shell.ts}`
  - Core: `subflow-candidate/{callable-target,route-outputs}.ts`, `service/subflow-trial/run.ts`, `project-agents/contracts/{task-spec,structure-plan}.ts`, and the t622/t625/t627/t630/t631/t634/t637 merge messages

## Not verified

- I did not see the actual runtime value of `itemUrl`. That it was empty is inferred from the code path: `action-runner.ts:103` sends a navigate to the content script only when `action.url` is falsy, and `payloads.ts:75` drops a non-string url.
- I did not confirm whether Core lifts a `dom-extract`'s read value into any named node output.
- I did not check whether `subflow.output_unknown_port` would break existing web flows that bind other undeclared ports.
- The overlap check's exemptions (router alternatives, recovery subflows) are proposed, not checked against existing plans.
- No tests were run.

## Open questions or contradictions found

- What should a subflow hand on as a page address? No web node declares a value output carrying the current URL; `state.page.location` is routing-only. The supervisor's planning guidance may need to stop inventing address outputs between subflows that share a page. This is about structure, not this task.
- Should a passing partial trial that started at the build's start location with no predecessors be offered to the supervisor as "this subflow already covers parts X and Y"? That would have let 0035 amend to one subflow.
- Brief-1's judge 0033 wrote "nothing outside this subflow's part was done" even though the part as quoted included the cart. That is consistent with RC1, not a judge defect.
