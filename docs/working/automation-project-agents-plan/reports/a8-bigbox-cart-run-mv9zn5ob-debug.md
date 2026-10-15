# A8 frozen pair 3 debug: `run-mv9zn5ob-d929084d` (bigbox-retail-pickup-cart, `project` mode)

Read-only. No live run, no Lab run, no provider call, no source changed. Frozen pair 3: downstream `8b770037`, Core
`8b322a95`. Sources were read in the main checkouts (`!FluxIQWebExtension`, `!FluxIQ`), both at those commits.

## Outcome

Done. The cause is **general to `project` mode**, not specific to this site. The site's shape (pickup for the towels
exists only at the Millbrook store) only decided how the failure showed up at the end. None of t641, t642 or t643
played a part.

**The chain in one paragraph.** At step 0003 the supervisor's plan gave `switch_store` an output, `storeName`, and
gave `add_items` that value as an input. No step of `add_items` would ever type or open it: the switch is a state
the first subflow leaves on the site, and the plan guidance itself says to express that with `after` alone. Core
accepted the plan without a warning, because the value is "taken by another" subflow. The `switch_store` builder
did its real work in seven calls (0007-0019, store switched). It then spent every later call trying to bind
`storeName` to a value. `web.dom.extract` declares no value port, the catalog never shows its `extract` shape, and
`extract_list` needs an `extraction.N` handle the builder never had. Twice the repeat guard ended it (brief-1 and
brief-3), each time with a reason made only of codes that never say "the plan asks for an output this subflow
cannot make". `add_items` was blocked behind it both times without running. At step 0099 the supervisor read
"unresolved handles" as "cannot do the store switch". It amended the plan to **drop the person's first request**:
it moved "switch the pickup store to Millbrook Crossing Supercenter" into `notAsked`. Core accepted that too. From
then on the Flow could not pass. Each subflow trial starts from the start-hook reset, which puts the store back to
Carden Falls (`absorbedByStartReset` act-13). At Carden Falls the towels show "Pickup Not available", so the towels
went in as Delivery. Two builders (brief-5, then repair brief-6) spent $0.085 on a Pickup control that is disabled
at that store. Finally the supervisor ended the build blocked with a false reason: "the paper towels are
pickup-unavailable at this store, so the task cannot be done".

## What changed and why

Only this report file was written.

### 1. The first decision on the losing path: the plan invents a hand-off value (step 0003, general)

- 0003, `project.write_plan`: `switch_store` gets `outputs: [storeName]`, and `add_items` gets `inputs: [storeName]`
  and `after: [switch_store]`. The supervisor's own `howToWork` (0002) says the opposite: "Hand a value on only when
  a step of a later subflow uses it, as a name it types or a row it opens. What an earlier subflow leaves on the
  target, such as a chosen branch or a page left open, is no value: say it with after alone."
- 0004: Core answered `ok` with no `warnings`. `plan-input.ts` `valueWarnings` raises `project.plan_value_unused` only
  when **no** other subflow lists the value as an input. Here `add_items` lists it, so nothing fired. The header of
  `plan-input.ts` already records this exact case from bigbox `run-mv8186yr-a385fd3a` (bigbox debug fix 7): "Bigbox's
  value was taken by name by the later subflows and read by none of their steps: a plan cannot show that, so there
  the guidance is what answers it." The guidance did not answer it. This is the same failure coming back, and it
  needs a mechanical fix.
- The frozen pair 2 pass of the same task (`run-mv9v3u68`) planned three subflows using `after` only, with no
  values. Whether a value gets invented is a sampling difference, and the plan check does not catch it.

### 2. Points where Core could have steered `switch_store` right and did not (briefs 1 and 3, general)

- The builder brief (0008 request, `core.submit_subflow` description) orders it: "it is given no value and hands
  back exactly \"storeName\" ... `output: storeName = $step.<label>.<output>`".
- 0020 to 0049 (brief-1) and 0069 to 0098 (brief-3): 14 submissions, all refused, in a cycle.
  - `$step.read-store.storeName` / `.text` gets `subflow.output_unknown_port`: "its node \"web.output.dom-extract\"
    declares no output by that name: it declares only success, failed".
  - `.success` gets `subflow.output_not_a_value`.
  - `web.dom.extract_list` with `extractList: extraction.1` gets `web.handle.unknown`. The builder copied
    `extraction.1` from the tool description's own example (the `calendar-ref` / `plan-ref` parts, which read a
    "booking reference" with `extract_list`). It never called `web.detect_repeating_structure`, and the refusal does
    not say that an `extraction.N` handle comes from that tool.
  - `extract: {...}` gets `bootstrap.invalid_parameter_value`, with `accepted: {parameter: extract, type: object}`
    and no description or example. `core.describe_nodes` (0037) also shows `{"id":"extract","type":"object"}` with
    nothing more. The downstream schema (`domain/src/actions/schemas.ts:145` `extractReadSchema`, a required `mode`
    enum) never reaches the model. The builder guessed six shapes: `extraction.1`, `{"handle":"t7"}`,
    `{"handle","field":"text"}`, `{"attribute":"text"}`, `{"kind":"text"}` and `{"text": true}`.
- **No legitimate way to make the value existed.** `web.dom.extract` declares only `success` and `failed`
  (`domain/src/output-nodes/definitions.ts`, `outputPorts`; `recordsPathByOutput` lists only `extract_list`).
  Reading one text and handing it on is therefore not expressible except as an `extract_list` over a detected
  structure. The plan's demand could not be met without a workaround.
- Each refusal carried t581's way out: "If this subflow has no value to hand on, the plan asks it for one it does
  not make: end the brief blocked and name the output, so the plan can change." The builder never took it. The
  repeat guard ended both briefs instead (0049 and 0098, `llm_evidence_loop.repeat_refused`).
- **The return lost the cause.** Brief-1's reason (0006): "The builder failed: Flow Bootstrap generation failed
  (flow_bootstrap.evidence_repeat_without_progress). It was stopped by llm_evidence_loop.repeat_refused. The calls
  it stopped on ... core.submit_subflow answered subflow.scope_refused:ba64ff77". Brief-3's reason (0057) is better
  ("subflow.scope_refused (subflow.output_unknown_port)"), but neither names `storeName` and neither says the plan
  is at fault. `project-agents/dispatch/ending.ts` adds plan advice only for `subflow.input_unread`
  (`INPUT_UNREAD_ADVICE`, t630). It has no counterpart for the output codes `subflow.output_not_a_value` and
  `subflow.output_unknown_port`, whose own text says the plan must change.
- `add_items` (brief-2 and brief-4) was blocked behind its predecessor both times: 0 calls, $0.

### 3. The supervisor misreads, and Core accepts a plan that drops the person's request (0050 to 0100, general)

- 0050 "switch_store failed on unresolved handles". 0056 re-sent the same plan with a `recordingExcerpt` about the
  store button ("its builder could not resolve the store-switch control"). It spent 3 of its 3 looks to learn
  nothing new. Its looks at 0051 and 0055 even show the store already switched ("Pickup or delivery? Millbrook
  Crossing Supercenter"). The result was a second identical loop (brief-3).
- **0099 `project.amend_plan`**: `taskSpec.parts` is now only `p2`, and `notAsked` gains "switch the pickup store to
  Millbrook Crossing Supercenter". The person's words "Switch my pickup store to Millbrook Crossing Supercenter" are
  now in no part, and are listed as something nobody asked for. The amendment also changed p2's `lastingActs` from
  `create_new` to `modify_existing`.
- 0100: Core answered `ok`, `proposalsKept: []`, `proposalsDropped: []`, no warning.
  `contracts/task-spec.ts` `quoteIssues` checks that each quote is verbatim and that quotes do not overlap. It never
  checks that an amendment still covers the words an earlier plan covered, and it never checks that `notAsked`
  does not restate a quoted request. The way to give up on a part is to end honestly (partial or blocked). A plan
  without the part is a different task, and Core let the supervisor substitute it.

### 4. Building `add_items` on a state its own Flow does not create (brief-5, 0103 to 0199, general mechanism, site-specific symptom)

- The builder sees the whole instruction. At 0112 it switched the store ("Set as my store", act-13), then explored
  the towels page at Millbrook, where "Pickup Today" is offered. It could not put the switch in its subflow: its
  brief says "Any other part of the task is another builder's subflow: write none of its steps here", even though
  after the amendment no subflow carried those words. Because p2 now declared `modify_existing`, the switch matched
  the part's acts and the builder was not told it acted outside its brief (inferred from 0113 carrying no notice).
- 0147 first trial: `start: reset`. `absorbedByStartReset` lists `act-13 click "Set as my store"`. The judge says
  "Paper towels: 2 × ... 12 Double Rolls · Delivery — wrong fulfillment" and advises "select the Pickup fulfillment
  option ... mirroring what s6 did for the napkins", with `stillAchievable: yes`. Core said the act was undone. It
  did not say that the builder's evidence came from a page state the subflow never recreates.
- 0159: a Pickup step recorded at Millbrook ("PickupToday") fails at trial with `web.target.not_found`, after 4
  attempts, because at Carden Falls the control reads "PickupNot available". At 0162 and 0163 the builder sees
  `t957 "PickupNot available" cursor="not-allowed"` and writes "Pickup is unavailable ... at Carden Falls". From
  0164 to 0199 it then loops `find_on_page "How you'll get this item"` (`already_answered` six times), and the guard
  ends it (`repeat_refused (same_result)` 3 in a row). The return (0102) is again code-only and carries no trial
  words.
- 0200: the supervisor dispatches a repair with "since the store switch is already done". That is false: the trial
  reset undoes it every time.

### 5. The repair and the ending (brief-6 0202 to 0333, then 0334 to 0340)

- 0204, 0208, 0214, 0216, 0220 and 0244: the repair's `browser-navigate` to the towels address from its own failing
  receipt's script was refused `address_not_shown` six times. `domain/.../node-run/shown-addresses.ts` counts the
  navigations of a held Flow only "when a round continues a Flow", and a project repair brief does not get its
  failing proposal's addresses as held. This is general friction and cost about 12 decisions. It is not the cause.
- 0326: a trial measured the advice to be wrong (`web.target.not_actionable`, "disabled: <div> is disabled" on
  "PickupNot available"). 0331 and 0332: the judge, scoped to p2, again says "no step chose Pickup" and
  `stillAchievable: yes`. No judge or builder is shown the dropped part, so nobody connects "pickup is disabled here"
  with "the person asked to switch the store first".
- 0333: the builder ends blocked: "the Pickup fulfillment option is disabled and shows \"Not available\" ... so the
  paper towels cannot be added to the cart for pickup". 0334: the supervisor ends partial. 0335 is refused
  `project.completion_reset_first`. 0336 to 0339: reset brief (nothing left). 0340: the supervisor ends blocked: "The
  ValueRidge Essentials Select-A-Size Paper Towels ... cannot be added for pickup". That is untrue for the task as
  asked. The person sees it as the final verdict.

### 6. Did t641, t642 or t643 play a part? No.

- t641: there is no `candidate.kept_condition_dropped`, `retestAdvised` or refuted-advice label in any `result.json`
  of the run (grep count 0). The judge advice at 0148 and 0271 was later contradicted by a measurement (0326), but no
  t641 path refuted or kept it.
- t642: there is no `web.target.ambiguous` anywhere. The three `target_unobserved (handle_not_in_packet)` answers
  (0187, 0304, 0316) are `web.describe_element` calls on a handle from another page (`t1863`, the napkins page,
  asked from the towels page). That is a model error, not a rebinding.
- t643 is Lab-only and was never reached: no Flow was saved and there was no playback.

### 7. Proposed fixes, by owning module, each with the test that would prove it

Every fix below is structural. None mirrors this site, task or products in model guidance. Retries, reset scope and
passing-Flow retention are unchanged.

1. **Core, `project-agents/supervisor/plan-input.ts` plus `contracts/task-spec.ts`: an amendment may not drop the
   person's request.** On `amend`, every span of the instruction text that the current plan's parts quote must
   still be covered by the new parts' quotes. The parts may be re-split, but no span may be lost. Any `notAsked`
   item that contains a current part's quoted text, or is contained in it, is refused as well. New code:
   `project.plan_part_dropped`, path `taskSpec.parts`, naming the dropped quote, with `why`: give up on a part only
   by ending honestly (`ended: partial|blocked`). Core refuses only what it measures here, which is text coverage.
   Test: `project-agents/supervisor/tests/plan-tool.test.ts` (or `plan-input.test.ts`). Write p1+p2, then amend to p2
   only with p1's words in `notAsked`: refused with the code and the dropped quote. Amend p1+p2 re-split as p1a, p1b
   and p2 over the same spans: accepted. Amend that changes only p2's facts: accepted.
2. **Core, `project-agents/dispatch/ending.ts`: an output the plan demands and the subflow cannot make is the plan's
   to change.** Mirror `INPUT_UNREAD_ADVICE`. When the last refused submission's issues carry
   `subflow.output_not_a_value` or `subflow.output_unknown_port`, the reason names the output by its interface name
   (`output "storeName"`) and adds this advice: "the plan asks this subflow to hand on a value none of its steps
   makes; if a later subflow needs only what this one leaves on the target, drop the value and keep `after`".
   Also stop the brief early. Once the same output has been refused under 2 different bindings, Core ends the brief
   `blocked` with that reason itself (same mechanism as the repeat guard), and the remaining 6 or more decisions are
   not spent. Test: `project-agents/dispatch/tests/brief-return-reason.test.ts`. A stopped loop whose codes carry
   `subflow.output_not_a_value` must give a reason containing `output "storeName"` and the amend advice. A loop
   refused the same output twice under different bindings must return `blocked` before the third submission
   (`brief-loops.test.ts`).
3. **Core, `project-agents/supervisor/plan-input.ts`: a hand-off value checked against its consumer at dispatch,
   not only by guidance.** The plan cannot show whether a step reads a value. Core can check it once the
   **consumer's** builder submits (`subflow.input_unread` already exists). The producer goes first, so that check
   never runs. Change the order of the check: when a producer brief blocks on an output issue (fix 2), the
   supervisor's `next` names both ends ("`add_items` takes `storeName`, which `switch_store` could not make")
   instead of a generic "send a changed brief". Test: `supervisor/tests` dispatch-answer test with a blocked
   producer whose reason carries the output code. The `next` must name the consumer's subflow and the value.
4. **Downstream, `domain/src/output-nodes/definitions.ts` plus `domain/src/actions/schemas.ts`: one read value
   becomes expressible and self-described.** (a) `web.dom.extract` declares a data port (`value`, role `data`) for
   the text it read. This needs Core's capture to write that output, so check the K3 capture path before relying on
   it (not verified). (b) The `extract` parameter gets a catalog description and example (`{"mode": "text"}`,
   modes enumerated), the same way `extract_list` has `catalog-text.ts`, so `describe_nodes` and
   `accepted.example` show it. Test: `domain/src/output-nodes/tests/definitions.test.ts`. The dom-extract definition
   declares a `value` data port, and its `extract` parameter carries a description naming every mode. Also a Core
   `route-outputs` test: `$step.read.value` on dom-extract is classified `value`, not `unknown`.
5. **Core, the tool example in the `core.submit_subflow` description (flow-bootstrap guidance): stop teaching
   `extract_list` + `extraction.1` as the way to read one value.** The "booking reference" parts are the template
   the builder copied. Once fix 4 lands, the example should read one value with `web.dom.extract` and its port.
   Until then it should name `web.detect_repeating_structure` as the source of `extraction.N`. The example keeps its
   own domain (rooms), so it does not mirror any scenario. Also, the `web.handle.unknown` refusal for an
   `extraction.*` handle says where such a handle comes from. Test: the guidance snapshot test for the
   submit-subflow description, plus a refusal-feedback test asserting the `extraction.N` hint.
6. **Core, `flow-bootstrap/candidate/trial-gate.ts` (trial feedback): say when the build explored on a state the
   Flow does not recreate.** When a subflow trial's start reset absorbed an act made during **this brief's**
   exploration, and neither this subflow's steps nor an accepted predecessor proposal performs it, the feedback adds
   a finding: `trial.explored_on_absorbed_act`, naming the act (`act-13 click "Set as my store"`) and saying that
   the page the builder explored was changed by an act the reset undid and no step of the Flow does. The builder
   return carries that line to the supervisor. This is measured by Core (the act log versus the Flow's steps), so it
   refutes nothing it did not measure. Test: `flow-bootstrap/candidate/tests/trial-gate.test.ts`. An exploration act
   absorbed by the reset with no matching step must produce the finding. The same act performed by a step of the
   subflow must not.
7. **Downstream, `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts` (with Core passing the held
   addresses): a repair brief may navigate to the addresses of the proposal it repairs.** The failing receipt's
   navigations passed this rule when they first ran. Treat them as `held`, as a continuing round already is.
   Test: `node-run/tests/shown-addresses.test.ts`. A repair opening with a failing proposal whose step navigates to
   URL U must accept U, and must still refuse U with an edited query value.

Order: fix 1 alone would have kept p1 in the plan, so the build could not have produced the false ending. Fixes 2
and 3 turn the first 40 decisions into one honest block plus a plan amendment. Fix 4 removes the dead end. Fixes 5
to 7 are supporting.

### 8. UI review (chat cards, overlay, final message)

- `screenshots/00004-14b50ed3a883.jpg`: the chat shows "Building Add pickup items to cart: ..." with a
  "Build · Add pickup items to cart · Allowance $0.08" card **while `switch_store` is still building**. That brief
  waits on its predecessor and never ran (0 calls). The card reads as two builders working in parallel, and it
  shows money set aside as if spending had started. **Misleading.** It should say "waits for Switch pickup store".
- `screenshots/00008-949603ba1858.jpg`: the "Return · Switch pickup store" and "Couldn't build Add pickup items to
  cart" texts show raw internal codes to the person ("flow_bootstrap.evidence_repeat_without_progress",
  "llm_evidence_loop.repeat_refused", "Brief brief-1 for subflow switch_store"). **Unreadable for the person.**
  Plain words are needed ("the builder kept being refused handing on the store name").
- `screenshots/00012-7b29b77db0ff.jpg`: "Action · Submit subflow — **Done**" (green) for the submission at
  0091/0092, which Core **refused** (`ok: false`, `flow_bootstrap.completion_refused` /
  `evidence_completion_parameters_unresolved`). The `subflow.scope_refused` refusals right above it show red
  "Didn't work", so a refusal of the `flow_bootstrap.completion_refused` family is drawn as success. **Broken.** The
  same card's summary is garbled: "with the store name read via a list reading the list". The model wrote "via a
  list extraction", so the activity rewording broke it.
- `screenshots/00007-a356a8462d82.jpg`: "Action · Submit subflow — Not done: it was already tried exactly this way
  and did not work". This is accurate. Ten or more consecutive submit cards with no word about *what* was refused
  ("the plan asks for a store name this step cannot hand on") leave the person unable to follow the build.
- The amended plan that dropped the store switch: no screenshot shows its card. It had scrolled out of view
  between 00012 (20:33:09) and 00013 (20:33:24). **Not verified** whether the chat told the person that their first
  request was removed from the plan. It should say so loudly, and with fix 1 it cannot happen.
- `screenshots/00044-2fbcdaee71a4.jpg` and `screenshots/00048-3dd7203ba6c9.jpg`: the final chat says "The paper towels
  are pickup-unavailable at this store, so the task cannot be done", then "The supervisor ended the build: it could
  not finish the Flow. — Nothing this build did is still on the target", then the generic "The build failed ... has
  no steps yet, but it keeps your instruction". **Misleading:** the person is told their request is impossible,
  when it fails only because the build dropped the store switch that makes pickup possible. The toast "Build failed:
  the supervisor ended it because it could not finish the Flow" gives no reason. The reset line ("Every lasting act
  this build made is undone; the site is as the build found it") is accurate: the header is back to "Carden Falls
  Supercenter".
- The overlay ("Building your Flow / Switch pickup store: blocked", 00008) is accurate and readable.

## Commands run and observed results

- Read `steps/index.md` (340 steps), and the request, response, call and result of steps 0001-0006, 0007-0049
  (brief-1), 0050-0057, the decisions of brief-3 (0069-0098), 0099-0102, the decisions of brief-5 (0104-0199), 0113,
  0144, 0147, 0148/0149, 0159, 0163, 0187, 0200-0201, the decisions and judges of brief-6 (0203-0332), 0204, 0326,
  and 0333-0340. Also read `summary.json`, `evaluation.json` and `review/timeline.json`.
- Grep of every `result.json` for `kept_condition_dropped`, `retestAdvised`, `refuted`, `target_ambiguous` and
  `target.ambiguous` returned 0 files each. `trial_unchanged_after_no` returned 2 files (0292, 0310).
- `git log --first-parent 797452c1..8b322a95` (Core) showed t641, t643 and t644 merged since pair 2. t639
  (`output_unknown_port`) was already an ancestor of pair 2 (`797452c1`). Downstream `805f7cbd..8b770037` showed t642
  and t643 merged.
- Read Core `project-agents/supervisor/plan-tool.ts`, `plan-input.ts`, `contracts/task-spec.ts` (`quoteIssues`),
  `dispatch/ending.ts` (header, `stoppedOn`, `INPUT_UNREAD_ADVICE`),
  `flow-bootstrap/subflow-candidate/route-outputs.ts` and `candidate/interface-output-port.ts`. Read downstream
  `domain/src/output-nodes/definitions.ts`, `domain/src/actions/schemas.ts` (`extractReadSchema`, the `web.dom.extract`
  entry) and the `node-run/shown-addresses.ts` header.
- Viewed screenshots 00003, 00004, 00007, 00008, 00012, 00013, 00044 and 00048.
- Compared with the pair 2 project pass `run-mv9v3u68-6efbd7ae`: its plan has three subflows with `after` only and
  no values.

## Not verified

- Whether the amended-plan card in the chat said the store switch was removed (no screenshot shows it).
- Whether the brief-5 builder was told its store switch (0112) was outside its brief. Inferred "no" from the 0113
  result carrying no notice, together with the amendment declaring `modify_existing` for p2.
- Which module draws the "Done" state on a refused `flow_bootstrap.completion_refused` submission card (Core
  activity or extension rendering). Inferred from the screenshot and the 0092 result only.
- Whether Core's capture would carry a new `value` data port of `web.dom.extract` to a call's output (fix 4a).
- None of the fixes is implemented or tested.

## Open questions or contradictions found

- `plan-input.ts` already names this failure (bigbox `run-mv8186yr`, "a value ... taken by name by the later
  subflows and read by none of their steps") and leaves it to guidance. It recurred. The recurring-failure rule asks
  for a mechanical answer (fixes 2 and 3).
- The builder brief tells a builder "Any other part of the task is another builder's subflow" even when the plan
  leaves some of the person's words in no part. After fix 1 that cannot happen. Until then, the brief text is false.
- The judge is scoped to the part's facts, so it said `stillAchievable: yes` and gave "select Pickup" advice three
  times, while the Pickup control was measured disabled (0326). This is consistent with "Core refutes only what it
  measured", but nothing passed the measured "disabled" to the next judge call.
