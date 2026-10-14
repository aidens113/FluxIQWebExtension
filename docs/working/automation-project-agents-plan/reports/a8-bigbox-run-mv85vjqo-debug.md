# Debug: A8 launch 6, run run-mv85vjqo-4c022aec (bigbox-retail-pickup-cart, project mode)

This was a read-only investigation. I edited nothing except this report, ran no Lab run and made no provider call.

Sources:

- The steps under `lab-runs/2026-10-14/run-mv85vjqo-4c022aec/steps/` (108 steps plus `index.md`).
- The run's `logs/core.log`, `run.json`, `summary.json` and the final screenshot `screenshots/00020-*.jpg`.
- The Lab log `a8-slot-2-project-bigbox-retail-pickup-cart.log`.
- The source code. `run.json` gives the lane tree as Core `2db229e9` and downstream `6fbf6b6f`. Those are the current
  `dev` heads of both repositories, so every line number below matches the code that ran.

## Outcome

Done. The build failed for four reasons, and none of them is mainly the model's fault.

1. **A prepared entry does not count as arrival** (cause A). This is a contract gap between Core and the domain.
   - t580 now prepares a dependent builder's entry and opens the builder with a look instead of a navigation.
   - The web domain still refuses every non-look node `not_at_start_location` until the builder itself navigates.
   - Both `add_paper_towels` builders started on the right page (Millbrook store, start cart). Every action they tried
     was refused.
   - `add_napkins` escaped by luck: its first action happened to be a navigation, to a product link on the home page.
2. **Core's repeat guard keys a build-state failure on the page digest** (cause B). Brief-2 did navigate. The page it
   reloaded was the same page, so the digest did not change. The guard then refused the now-valid search as a repeat
   of the failed one, three times in a row, and the brief stalled.
3. **The supervisor could not recover, for several reasons** (cause C).
   - The return gave no cause.
   - A repair brief needs a trial receipt that the supervisor is never shown.
   - Its `failingReceipt` was refused once as "executable code", because one key was named `code`.
   - `project.amend_plan` threw away the passing proposals of `switch_store` and `add_napkins`.
   - The `predecessor_not_done` refusal names only a path, not the subflow or why it is not done.
   - The third refusal of that kind in a row ended the build through the refusal-run guard. The supervisor never
     reached an honest ending or a reset.
4. **The build left the store switched, and the person was not told** (part of cause C). The act ledger also claimed
   more acts in place than were on the site (cause D).

The fixes from the previous debug did take effect:

- the trial now starts with a navigate to a loaded start page (cause A there);
- the site is reset before each trial;
- predecessor proposals are run before a dependent builder starts;
- both trials that ran were judged, and both judges were right.

## Timeline

| Steps | Agent | What happened | Calls / $ | Ended |
| --- | --- | --- | --- | --- |
| 1 | panel chat | `flow.createHere` | 1 / $0.0001 | - |
| 2-8 | supervisor | `read_task`, one find, `write_plan` (p1 store, p2 towels, p3 napkins; keep-cart under `notAsked`), dispatch `switch_store` | 3 decisions | - |
| 9-26 | brief-1, `switch_store` | Opened by navigating to the start. Closed the consent banner and the email overlay, opened the picker, pressed Millbrook "Set as my store". Revision 1 submitted, trial yes (judged twice), complete. | 10 / $0.0088 | done |
| 27-28 | supervisor | dispatched `add_paper_towels` and `add_napkins` in one call | 1 decision | brief-2 blocked, brief-3 done |
| 29-43 | brief-2, `add_paper_towels` | Entry prepared (Millbrook, cart 1 line $3.97). Search refused `not_at_start_location`. It navigated to the start, and the repeat guard then refused the search three times. | 7 / $0.0043 | `flow_bootstrap.evidence_repeat_without_progress` |
| 44-63 | brief-3, `add_napkins` | Entry prepared (the same page). Found the napkins link on the home page, navigated to it, checked 250 Count, closed the chat widget, Add to cart (Qty 1, Pickup). One malformed reply. Revision 1, trial yes (judged twice), complete. | 11 / $0.0089 | done |
| 64-69 | supervisor | Sent a repair brief for `add_paper_towels` three times: `project.brief_refused` (unknown field), `project.brief_refused` (no `failingReceipt`), then a refusal before the call ran (`llm_output.executable_code`). | 3 decisions | - |
| 70-71 | supervisor | `project.assemble` refused: `assemble_proposal_missing` for `add_paper_towels` | 1 decision | - |
| 72-98 | brief-4, `add_paper_towels` (a build brief) | Entry prepared. Search refused `not_at_start_location` four times (78, 80, 86, 92), with repeats refused unrun (82, 88, 94, 96, 98) and finds in between. It never navigated. | 12 / $0.0030 | `flow_bootstrap.evidence_repeat_without_progress` |
| 99-102 | supervisor | One find, then `amend_plan`: split p2 into `select_paper_size` (p2) followed by `add_paper_towels` (p2) | 2 decisions | - |
| 103-108 | supervisor | Dispatched `select_paper_size` three times, each refused `project.predecessor_not_done` | 3 decisions | the build threw `evidence_repeat_without_progress` (`core.log` line 200) |

In total there were 55 provider calls, costing $0.031 of the $0.25 limit. The supervisor's 14 decisions cost $0.0056.

## 1. The paper-towels builder: what it tried, what repeated, and why

**Its entry.** Entry preparation (`service/project-build/entry-preparation.ts:41-120`, t580) ran for both briefs:

- Steps 29 and 74 carry `entry.prepared: true` and the note from `brief-ports.ts:223`.
- Both opening looks show the start URL, the header store "Millbrook Crossing Supercenter", and the cart at its start
  (1 line, $3.97).
- So the builder started where its subflow begins. Entry preparation itself worked.

**Why every action was refused.** The opening of a prepared builder is a look, not the arrival:

- `brief-ports.ts:179` wraps every tool in `lookingInPlace` when `entry.kind === "prepared"`, and
  `brief-ports.ts:214-216` strips `initialObservation.arrival`. So step 29 is a `dom-capture_snapshot`. In brief-1,
  step 9 was a `browser-navigate`.
- The web domain then treats the builder as not arrived:
  - Its opening call `initial.core.run_node` re-arms the arrival memory (`domain/src/runtime/llm-evidence/node-run/run.ts:180`
    → `arrival.ts:121-123` deletes the build's key).
  - Only a successful navigation sets the key (`run.ts:395`), or a `held` Flow on the opening (`run.ts:185-188`).
  - Until then every non-look node gets `notThereYet` (`run.ts:754`, `run.ts:774`), and the detail comes from
    `start-location.ts:70-72`: `{reason: "start_location_not_reached", startLocation}`.
- Entry preparation's own navigation ran in a separate detached runtime session (`entry-preparation.ts:77-101`). Nothing
  tells the builder's session that it has arrived: Core passes no `held` Flow and no other signal.
- The builder was also given guidance that contradicts itself:
  - Core's `startLocationNote` (`llm/deepseek/request-body.ts:378`) says that if the evidence does not open with the
    arrival, "your first call [must] be the node that goes there ... every action is refused until it has run".
  - The entry note (`brief-ports.ts:223`) says "Explore and build from here; what they did is already done, so do not
    do it again".
  - The refusal itself carries no `next`, unlike `target_covered` (step 13).

**What brief-2 did (steps 29-43).**

- 31: it typed the product name into the site search `t11` and submitted. Refused `not_at_start_location`.
- 33: the identical call was refused `repeat_refused`. That refusal was right: nothing had changed.
- 35: it navigated to the start URL, which succeeded ("the browser loaded the page again"). The page after it is
  byte-identical to the page at step 29 (both 6068 characters; a diff shows no difference).
- 37: `find_on_page "Select-A-Size"` found 0 matches. The product is not on the home page.
- 39, 41, 43: the identical search was refused `repeat_refused`, with `then.resultCode` `not_at_start_location` and
  `refusedInARow` 1, 2, 3. On the third, the round stalled.

**Was the guard right?**

- At 33, yes.
- At 39, 41 and 43, no. After step 35 the domain had marked arrival, so the search would have run. Core's repeat guard
  refused it as a repeat because of how it keys calls (`llm/repeat-guard/outcomes.ts`):
  - A refused call that reports no state is keyed on the last state the loop saw (`outcomes.ts:317`,
    `call.stateBefore ?? latest`). The domain reports no `stateDigests` for a `not_at_start_location` refusal
    (`domain/src/runtime/llm-evidence/state-digest/tests/call-state-digests.test.ts:228-235`).
  - It is recorded `failed` at that key (`outcomes.ts:343-365`).
  - The navigation reloaded the same page. The digest leaves out how a page was reached (`state-digest.ts:49-53`), so
    the page state was the same.
  - `blocks()` (`outcomes.ts:367-369`) therefore found the old failure. The failure was about the build's state
    (arrived or not), and the navigation had changed that state. The page key cannot see it.
  - The navigation itself was recorded `changed_nothing` (`outcomes.ts:344`: `stateAfter === state`). A second identical
    navigation would also have been refused.
  - The stall: `decision-handlers/refused-repeat.ts:43-45` with `repeat-guard/feedback.ts:24` (3 in a row).
- The note also misled the model. It said "on this exact page, and it did not work then", but the model had just gone
  to the start location, as the refusal told it to.

**What brief-4 did (steps 72-98).** It started from the same prepared entry and searched four times with two different
texts. Each was refused `not_at_start_location` (with `repeatedAnswer` 2-4), and identical resends were refused unrun.
It never navigated, and stalled after 12 calls.

- **Guard verdict:** the repeat refusals were right as mechanics, since nothing changed between them.
- The domain refusal underneath them was wrong, because the builder was at its prepared entry.
- The model's failure to navigate comes back to the missing `next` and the contradictory notes above.

## 2. Why `add_napkins` succeeded where the towels failed

- It had the same prepared entry and the same arrival gap.
- The difference was its first act. The napkins product is listed on the home page (step 46: `t87` link). So its first
  run-node call was a `browser-navigate` to that product's URL (step 48).
- A navigation is exempt from the arrival rule and also sets arrival (`run.ts:395`). Every later act ran.
- The towels product is not on the home page (steps 37, 76 and 100: 0 matches). Its only way in was the site search, a
  `dom-type`, which the arrival rule refuses.
- So the two siblings differ only in whether the product could be reached by a link from the entry page.

## 3. The supervisor's later dispatches and refusals

What the supervisor was told after brief-2 (step 28): `outcome: blocked`, reason "The builder failed: Flow Bootstrap
generation failed (flow_bootstrap.evidence_repeat_without_progress)", `trials: 0`.

- That reason comes from `project-agents/dispatch/ending.ts:75`. It has no cause and no last failing code
  (`not_at_start_location`). That gap was fix 6 of the previous report, and it is still open.

| Step | What it sent | Core's answer | Right? | Could it recover from the wording? |
| --- | --- | --- | --- | --- |
| 65 | `kind: repair`, `failingReceipt: {outcome, reason}` | `project.brief_refused`, `project.unknown_field` at `briefs.0.failingReceipt.outcome` (`contracts/json-shape.ts:48` via `contracts/receipt-ref.ts:18`) | Yes. A receipt ref is `{kind, receiptId, digest}`. | No. The tool schema gives `failingReceipt` only as `{type: "object"}` (`supervisor/tools.ts:64`), the guidance says only "failingReceipt for a repair" (`supervisor/guidance.ts:71`), and the issue names the path but not the accepted keys. |
| 67 | `kind: repair` without `failingReceipt` | `project.brief_refused`, `project.brief_failing_receipt` (`contracts/subflow-brief.ts:98`) | Yes | No. Nothing says that a repair starts from a trial receipt. The supervisor can never send one in any case: a return shows only `trials: <count>` (`supervisor/dispatch-tool.ts:122`), never the refs, and brief-2 ran no trial. The right brief was `kind: build`. |
| 68-69 | `failingReceipt: {code, reason}` | Refused before it ran, `llm_output.executable_code` (`llm/harness/output-validation.ts:135`: any key named `code`, `script`, ... anywhere in the output) | No: a false positive | No. The message says "cannot include executable code", which is untrue of the reply. Core's own tool results use `code` keys throughout, so the model copies them. |
| 71 | `project.assemble` | `project.assemble_refused`, `assemble_proposal_missing` for `add_paper_towels` | Yes | Yes. It then sent a build brief (73). |
| 73 | `kind: build` (`add_paper_towels`) | Ran as brief-4 and came back blocked with the same generic reason | - | - |
| 101-102 | `amend_plan`: `select_paper_size` (p2, after `switch_store`), then `add_paper_towels` (p2, after `select_paper_size`) | Accepted, with no warnings | Accepted, but the plan was wrong | The supervisor guessed that the builder "looped" because one subflow carried two acts. The real cause is A/B, and it could not see that. Core accepted two subflows that carry the same part. |
| 104, 106, 108 | `kind: build`, `select_paper_size` | `project.predecessor_not_done` at `briefs.0.entry.predecessors.0` (`supervisor/dispatch-order.ts:26`, `dispatch-tool.ts:51`, wording `guidance.ts:136`) | Yes. `amend_plan` makes proposals made under the old plan no longer count (`supervisor/state.ts:56-73` filters on `planDigest`), so `switch_store` had no done proposal under the new plan. | No. The issue names a path, not `switch_store`, and does not say that its proposal was dropped by the amendment. The supervisor's own summary at 107 says "its predecessor switch_store is done". The amend answer's `next` ("those with nothing to run after first") was the only hint, and it was not specific. |

After the third `predecessor_not_done` in a row, the refusal-run guard stopped the supervisor:

- The guard is `llm/decision-handlers/refusal-run.ts:53`, with `evidence-progress/refusal-run.ts:19` (3 in a row), and
  the stop was logged as `flow_bootstrap.evidence_repeat_without_progress`.
- The warning at the second refusal (step 107's request, `refusal-run.ts:69`) told the supervisor that "the Flow is
  then tested and judged as it stands". That is draft-mode wording, and it is false for the supervisor loop: nothing
  is tested, the build just throws.
- The guard was right to stop a loop sending one refused dispatch three times. But the supervisor was never pointed at
  the move that worked, which was to send `switch_store` (and `add_napkins`) again, or to end with `ended`.

## 4. How the build ended and what it left on the site

- The build threw `AutomationStudioFlowBootstrapGenerationError` (`core.log` line 200). It did not end through the
  supervisor's `complete {ended}`, so no reset brief ran and Core added nothing about what was left.
- The person was told: "The build failed: it kept trying without getting any further, so it was stopped. The Flow ...
  has no steps yet".
- **What was left on the site.** The final screenshot shows the header store "Millbrook Crossing Supercenter", so the
  store switch made by brief-4's entry preparation is still in place.
  - At step 74 the cart was back at its start (1 line, $3.97): entry preparation's start hook had reset the server
    state.
  - brief-4 made no lasting act afterwards, because all its calls were refused.
  - So the site holds one act of the build, the store switch, and the person was not told about it.
- **The ledger over-counts** (cause D). The step 73 return said `lastingActsInPlace: 3`, but the page at step 74 showed
  only the store switch.
  - Entry preparation runs the deployment's start hook (`entry-preparation.ts:69-73`), which puts the site back.
  - `brief-ports.ts:173-176` records only the acts the preparation run landed. Nothing marks the earlier acts (brief-3
    trial's act-6 and act-7) as absorbed, as the subflow trial does with `absorbedByStartReset`.
  - This was not checked against the scenario server.
- **UI.** In the final screenshot the chat shows each refused dispatch card as "Action · Dispatch · Done".

## 5. Judge calls

There were four judge calls, two per trial that ran. All four were right.

- Steps 24 and 25, `switch_store` revision 1: both answered yes (confidence 0.95 and 0.97).
  - The trial ran start, navigate, call-subflow, open picker (the consent banner was closed automatically), and Set as
    my store.
  - The end view header and "Pickup today at Millbrook Crossing Supercenter" confirm the switch.
  - The cart was unchanged at 1 item, $3.97.
- Steps 61 and 62, `add_napkins` revision 1: both answered yes (0.97).
  - The trial ran `switch_store`, then the napkins page, 250 Count ($6.48) and Add to cart.
  - The end view showed "Added to cart", "Qty 1 · Pickup", and the cart holding the existing item plus the napkins
    (subtotal $10.45 = $3.97 + $6.48).
  - Nothing outside the brief was touched.
- Both trials recorded the earlier acts as `absorbedByStartReset`, which shows t578's reset worked before them.

## Root causes, with a verdict on each

| # | Cause | Where | Verdict |
| --- | --- | --- | --- |
| A | A prepared entry is not arrival. The builder's opening look re-arms "not arrived", and every action is refused until it navigates, which in general walks away from the entry. | Core `service/project-build/brief-ports.ts:179,214-216`; domain `node-run/run.ts:180,754,774`, `node-run/arrival.ts:121-123`, `node-run/start-location.ts:70-72` | The refusal was wrong for a prepared entry. This is the main cause. |
| A' | Contradictory guidance (the start-location note against the entry note), and a refusal with no `next`. | Core `llm/deepseek/request-body.ts:378`, `brief-ports.ts:223`; domain `start-location.ts:70-72` | The wording failed the model. |
| B | The repeat guard keys a build-state refusal on the page digest, and a navigation back to the same page does not lift it. | Core `llm/repeat-guard/outcomes.ts:317,343-365,367-369` | The guard was wrong at steps 39, 41 and 43, and right at step 33. |
| C1 | Returns give no cause. | Core `project-agents/dispatch/ending.ts:75` | Open since the previous report (fix 6). |
| C2 | A repair needs a receipt that the supervisor never sees; the schema and wording do not say so. | Core `contracts/subflow-brief.ts:98`, `contracts/receipt-ref.ts:18`, `supervisor/dispatch-tool.ts:122`, `supervisor/tools.ts:64` | The refusals were right; the contract cannot be used. |
| C3 | Any `code` key is treated as executable code. | Core `llm/harness/output-validation.ts:135` | False positive. |
| C4 | `amend_plan` drops passing proposals of subflows it does not change, and `predecessor_not_done` names a path only. | Core `supervisor/state.ts:56-73`, `supervisor/dispatch-order.ts:26`, `supervisor/guidance.ts:136` | The refusal was right; its wording did not let the supervisor recover. |
| C5 | A refusal-run stop ends the supervisor with no honest ending, no reset and no word about what is left, and its warning uses draft wording. | Core `llm/decision-handlers/refusal-run.ts:53,69` | The stop was right; the ending was wrong. |
| D | The ledger does not see the start hook run by entry preparation. | Core `entry-preparation.ts:69-73`, `brief-ports.ts:173-176` | It over-counts acts in place (not checked against the server). |

## Recommended fixes

None of these puts the scenario's task, site or products into model guidance. Any example in guidance should use
another kind of site.

1. **A prepared entry is the builder's arrival** (A; Core and domain, one contract).
   - When `entry.kind === "prepared"`, have Core's opening look carry the predecessors' calls under `held`, as a
     continuing round does. The domain already treats a held navigation as arrival and an address shown
     (`run.ts:182-188`, `arrival.ts:82-93`).
   - Alternatively, give the domain an explicit `arrived: true` flag on the opening call.
   - Add a test in each repository: a builder whose opening is a prepared-entry look can type into a field without
     navigating first.
2. **One start-location note that fits the opening** (A'; Core `request-body.ts:378`). Leave out the "first call must be
   the node that goes there" sentence when the entry was prepared. Have the domain's `not_at_start_location` refusal
   carry a `next` that names the navigation node and `startLocation`, as `target_covered` does.
3. **A build-state refusal is lifted by the move that clears it** (B; Core `repeat-guard/outcomes.ts`).
   - Option 1: treat `start_location_not_reached` like `HANDLE_UNSHOWN`: lifted once a navigation succeeds in the
     build, whatever the page digest.
   - Option 2: have the domain fold the arrival bit into the state it reports, so a page seen before arrival and after
     it digest differently.
   - Do not record a successful navigation as `changed_nothing` when it changed the build's arrival.
4. **Returns tell the supervisor why** (C1; Core `ending.ts`). Add the stalled brief's last refused result code and
   reason, for example "every action was refused not_at_start_location". Also add the receipt refs of the trials it ran.
5. **Make repair usable, or say what it needs** (C2).
   - Give `failingReceipt` its real schema `{kind, receiptId, digest}` in `tools.ts:64`.
   - List the receipt refs in each return (`dispatch-tool.ts:122`).
   - When a brief ran no trial, answer a repair with "this subflow has no trial receipt: send kind build".
6. **No false executable-code refusal** (C3; Core `output-validation.ts:129-139`). Stop matching a bare `code` key. Tool
   inputs are validated by their own schemas. Check only payloads that would actually be run, such as script or
   function bodies inside patches.
7. **An amendment keeps what it does not change, and says what it dropped** (C4).
   - Keep a done proposal for a subflow whose key, parts, interface and chain of predecessors are unchanged by the
     amendment.
   - Otherwise list, in `amend_plan`'s answer, the subflows that now have no done proposal.
   - Make `predecessor_not_done` name the predecessor and why, for example: "\"X\" has no done proposal under plan
     revision N; proposals made before project.amend_plan no longer count. Send its brief first or in this call."
   - Have plan checks warn when two subflows carry the same part.
8. **A stalled supervisor ends honestly** (C5; Core `refusal-run.ts` and the supervisor loop).
   - In the supervisor loop, the warning should say that one more refused decision ends the build, and offer
     `complete {ended}` or the move named beside the refusal.
   - On the stop, run the supervisor's ending path: the reset brief, or at least the list of acts still in place
     added to the person's message.
9. **The ledger sees entry preparation's start hook** (D; Core `brief-ports.ts:172-176`). When preparation ran the start
   hook, mark the acts it put back as absorbed, as the subflow trial does.
10. **UI** (extension chat). Show a refused dispatch as refused, not "Done".

## Commands run and observed results

- `ls` of the run directory, and `index.md` read. There are 108 steps, consistent with the table above.
- I read the per-step `call.json`, `result.json`, `decision.json`, `meta.json` and `response.txt` through a scratch
  script (`python -I`, at `scratchpad/a8dbg6/dump.py` and inline). The steps quoted above match it.
- Diff of the page text at steps 29 and 35: both 6068 characters, with no differing lines.
- Regex over the opening pages at steps 9, 29, 44 and 74. Cart link "1 $3.97" on all four. The header store reads
  "Carden Falls" at 9 and "Millbrook Crossing" at 29, 44 and 74.
- Cost sum over `decision.json` usage by role and brief: supervisor 14 decisions, $0.0056; brief-1 $0.0088 including
  its judges; brief-2 $0.0043; brief-3 $0.0080 including its judges; brief-4 $0.0030.
- `grep` in `logs/core.log`: three `project.predecessor_not_done`, then `build throw ...
  code=flow_bootstrap.evidence_repeat_without_progress` (line 200).
- `grep refused_in_a_row` in the requests: 0 at step 105 and 1 at step 107, showing the warning text quoted above.
- I read the Core and downstream source files named above. `git log` shows Core `dev` at `2db229e9` and downstream at
  `6fbf6b6f`, the same commits as `run.json` gives for the lane tree.

## Not verified

- **Domain arrival state.** Nothing in the steps logs it. That brief-2 was "not arrived" at step 31 and "arrived" after
  step 35 is inferred from the domain code and the refusal codes.
- **The repeat guard's digests.** The guard's `stateBefore` and `stateAfter` values are not in the step files. That the
  digests matched is inferred from the identical page text and from the guard's refusal at step 39.
- **That `held` on a prepared opening would satisfy the domain without side effects** (for example on shown addresses
  or held literals). This is a design suggestion and was not tested.
- **The server-side store and cart at the end, and which acts the ledger's 3 are.** The screenshot shows the store and
  not the cart count. The over-count is inferred from step 74's page.
- **Whether brief-4's model would have navigated if the refusal had carried a `next`.**

## Open questions or contradictions found

- `brief-ports.ts:62-69` says a prepared builder's opening is "never the arrival at the build's start". The domain's
  rule (`arrival.ts`, `run.ts:180`) requires an arrival before any action. These two designs conflict, and no test
  covers them together.
- The entry note says "do not do it again", while `startLocationNote` says the first call must be the navigation. The
  builder receives both.
- `amend_plan` guidance says proposals made under the old plan no longer count. The dispatch guidance says "A
  predecessor must be done already", with no mention of plan revisions.
- `refusal-run.ts:69`'s non-candidate warning ("the Flow is then tested and judged") is used in the supervisor loop,
  where it is not true.
