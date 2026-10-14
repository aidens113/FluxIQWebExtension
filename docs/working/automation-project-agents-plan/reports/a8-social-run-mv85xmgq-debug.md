# A8 launch 6, social confirm-requests (`run-mv85xmgq-8a6a6f43`): debug

Read-only investigation. Core `!FluxIQ` dev is at `2db229e9`, the run's commit (`git log 2db229e9..dev` is empty), so
every line reference below is the code that ran. No model provider was called and no Lab run was started. The report
names no person from the page, only controls.

## Outcome

Done. There are two root causes and one aggravating defect, all in Core's project mode:

1. **The supervisor's whole test cannot use the start reset that candidate mode uses.** The Lab gives project mode
   the same deployment start hook it gives candidate mode (the fixture's `/__control/reset`). The builder's subflow
   trial used it (`"start": "reset"`). The supervisor's whole test never reaches it, because
   `whole-trial.ts:26-31` refuses on any act in the project ledger before calling the gate, and
   `supervisor-loop.ts:91` builds the gate with no `reset`, so `trial-gate.ts:227` would skip `prepareStart` anyway.
   Candidate mode passes this exact task because its gate is built with `reset` (`candidate/authoring-loop.ts:114`):
   the hook absorbs every act (`absorbedByStartReset`) and the trial runs.
2. **A reset brief's model is never told it is a reset.** Its prompt carries the build instruction ("confirm every
   request...") and the same opening evidence as a builder. Its only difference is the completion schema. The acts to
   undo appear only in the refusal of a completion (`reset-loop.ts:35-46`). So both reset briefs explored and tried
   to build the subflow again, and the repeat guards ended both.
3. **Aggravating: the second reset brief made a new lasting act the person excluded.** It pressed `Confirm` on a
   request below the threshold (act-5). No gate stopped it: `modify_existing` is asked of nobody, a reset's
   `permittedActs: []` narrows only the gated classes (`brief-ports.ts:131-133`), and the reset port omits the
   builder's `outsideBrief` note (`brief-ports.ts:188` has no `told(...)`).

The site itself offers **no control that undoes a confirmed request**, so a model reset could never have succeeded.
Only the start hook can put this site back, or the act has to be kept and the judge told.

## Timeline (UTC, 2026-10-14)

| Time | Step | What happened |
| --- | --- | --- |
| 13:49:50 | 0001 | Chat prompt received. |
| 13:49:5x | 0004-0010 | Plan written with two subflows. Plan warning `project.plan_subflow_constraint`, two `project.plan_refused` amendments, then a one-subflow plan: `confirm_requests` carries p1 (lasting act `modify_existing`) and p2 (the table). Under `notAsked`: accepting requests below the threshold, and declining or deleting any. |
| 13:50:10 | 0012 | Dispatch of brief-1 (build). |
| 13:50-13:51 | 0013-0041 | brief-1 explores: home, cookie consent, Friends, Friend requests, structure detection, list reads with an `atLeast 5` condition, chat close. **No lasting act while exploring**: no `Confirm` press. |
| 13:51:16 | 0043 | `core.submit_subflow` rev 1: navigate, optional chat close, filtered read, `Confirm` repeated over the read, read of the accepted rows. |
| 13:51:18-13:52:17 | 0045 | `core.test_subflow`: `start: "reset"` (the deployment hook ran), 4 `Confirm` presses (one absorbed `web.action.rate_limited`, retried after the wait), judged yes twice. `leftOnSite`: act-1 to act-4 = trial steps 9, 12, 15, 18 on `Confirm`. |
| 13:52:18 | 0050/0012 return | brief-1 `done`, `lastingActsInPlace: 4`. |
| 13:52:20 | 0052 | `project.assemble` rev 1 draft. |
| 13:52:21 | 0054 | `core.test_candidate` refused **`project.trial_reset_required`** in 2 ms. No trial ran. `actsInPlace` act-1 to act-4, all owned by brief-1. |
| 13:52:23-13:53:06 | 0056-0087 | **brief-2 (reset)**: navigate refused `address_not_shown`; clicks Friends, then Friend requests; detect; 3 decisions refused `llm_output.unexpected_field` (`consequences` at the decision level); `already_answered`; chat close; a list read that succeeded (it shows the 4 accepted rows); then the same read 3 times, each `repeat_refused` (`changed_nothing`). Ended `blocked`, `flow_bootstrap.evidence_repeat_without_progress`. It never tried to complete, so it never saw the act list. |
| 13:53:07-13:54:24 | 0089-0136 | **brief-3 (reset)**: same opening; malformed reads; then **0112 pressed `Confirm` on a request the task said to leave** (act-5, `modify_existing`); 0122 wrote a `Confirm` step (`write: true`); 0129 completed. 0130 refused **`project.reset_acts_in_place`**, listing act-1 to act-5. Three undo attempts: 0132 `Delete` (declared `delete`, `undoes: act-1`), 0134 `Confirm` (`undoes: act-2`), 0136 `Delete` (`undoes: act-3`), all on pending rows of other requests, each refused **`candidate.undo_wrong_target`**. The second refusal drew the `core.refusal_run` warning; the third ended the brief, `blocked`, `flow_bootstrap.evidence_repeat_without_progress`. Return: `lastingActsInPlace: 2` (act-1 to act-3 are now kept; act-4 and act-5 are still in place). |
| 13:54:26 | 0137-0139 | Supervisor ends `blocked`. 0138 was refused `project.completion_shape` because it mixed `revision`/`digest` with `ended`; 0139 ended correctly. |

$0.040 spent of $0.25; 71 calls. No permission request was raised (`permissionRequest: null` in `snapshots/flow-lane.json`).

## (1) The acts the build left, and what undoing each takes

- **Exploration: none.** brief-1 never pressed `Confirm` while exploring. It wrote the act into the submitted subflow.
- **Subflow trial: act-1 to act-4.** Four `Confirm` presses, exactly the four qualifying requests, made after the hook
  reset. They are recorded into brief-1's ledger by `trialRan` and shown as `leftOnSite`.
- **brief-3 (a reset!): act-5.** A `Confirm` on a request the person said to leave as it is.
- **How each can be undone on this site: through its own controls, it cannot.** Fixture
  `apps/scenario-lab/src/scenarios/social-network-feed/`:
  - `client/requests-script.ts:30-38`: a confirmed card's `Confirm`/`Delete` buttons are removed and replaced by the
    words "Request accepted" and a `Message` link.
  - `markup/friends.ts:59-63`: after a reload, a confirmed card renders the same way.
  - `state.ts` `mutateFeedState`: "a friend request can be confirmed or deleted only once". A second answer is ignored.
  - `markup/pages.ts`: the person page offers only `Follow`. `friends/list/` renders the Friends home
    (`route.ts:43`). No unfriend control exists anywhere.

  So the only thing that returns this site to its start is the deployment's start hook: the Lab's fixture reset,
  which `packages/test-runner/src/environment.ts:163-169` gives both candidate and project mode. On a real site with
  no hook, these acts belong under "kept: the site offers no undo". The trial then runs with them in place and the
  judge is told, as the ledger already does in candidate mode (`site-reset/ledger.ts` header, "An act the site cannot
  undo does not trap the build"; `trial-policy.ts:19-25`).

## (2) The two blocked briefs

Both were reset briefs (`dispatch.reset.1`, `dispatch.reset.2`, `kind: "reset"`, no parts; `permittedActs: []` by
`brief-input.ts:73`).

**What their model was given.** Step 0058 (brief-2's first decision) and step 0091 (brief-3's) show the same system
prompt as a builder, the build instruction as the only instruction, and the same two opening evidence entries
(`core.route_state.1`, `initial.core.run_node`). Their only difference from a builder is the completion schema
`{summary}`. The string `act-1` does not appear, and nothing says "undo". The cause is in
`service/project-build/brief-ports.ts:183-190`: the reset port reuses `environment(...)`, whose `runHarness` sends the
draft's build instructions. `project-agents/dispatch/reset-loop.ts:26-47` adds only `checkCompletion`, and that is the
first place the acts appear (`actsToUndo`, line 43). The supervisor's guidance does tell the supervisor what a reset
is for (`guidance.ts:143`), but the reset's own model is never told.

**brief-2.** It acted as a builder: it went to the requests list to read the counts "before deciding which to
confirm" (decision summaries 0058-0086). It wasted 3 decisions on a misplaced `consequences` field, which was refused
correctly as `llm_output.unexpected_field`. Its one useful read showed the four accepted rows. It then repeated that
identical read three times on an unchanged page. The repeat guard refused each one (`refused-repeat.ts`), and the
third ended the round: `AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW`, then
`unusableDecisions.stalled`, then `automationStudioCandidateStallCode` (`service/candidate-failure/stall-code.ts:27-29`)
gave `flow_bootstrap.evidence_repeat_without_progress`. **Guard verdict: right.** The calls were byte-identical on an
unchanged page, and the run's own instruction forbids them.

**brief-3.** It also acted as a builder, and on the way it confirmed a request below the threshold (0111: "starting
with ... Confirm", then 0113: "I confirmed ... by mistake"). Only at 0130 did it learn the act list. Its three undo
attempts aimed `Delete`/`Confirm` at **pending rows of other requests**: the confirmed rows have no control left to
press. `site-reset/ledger.ts:204-211` refused each before anything ran (`candidate.undo_wrong_target`) and kept that
act. The refusal-run counter (`llm/decision-handlers/refusal-run.ts:45-58`, kind `call:candidate.undo_wrong_target`)
ended the round at the third. **Guard verdict: right, and it prevented harm.** Unguarded, those presses would have
deleted two requests the person said to leave, and confirmed a third.

**Wording defects found on the way (both cosmetic, but they mislead a reset):**
- `undo_wrong_target`'s instruction (`site-reset/words.ts:48`) ends "Test the same revision again now". A reset has no
  test tool.
- The refusal-run warning (`refusal-run.ts:69`) says the round's end means "the Flow is then tested and judged as it
  stands" and "complete if the Flow already does what the person asked". A reset has no Flow.

**There was an escape the model was never told about.** The ledger keeps an act once a reset has asked for it twice
(`ledger.ts:119`, `ASKED_BEFORE_KEPT = 2`; `ledger.ts:315`), and the policy admits on an unchanged refusal
(`trial-policy.ts:70-72`). So completing once or twice more would have kept act-4 and act-5 and let brief-3 return
`done`. Its completion schema has no `cannotUndo`, and its words say "Undo each listed act", so the model could not
know that.

## (3) Gated undo, or not found?

**Not found, because none exists.** The real reversal of a confirm would be `modify_existing` (un-accept), which is
never gated, but the site has no such control. The undo the model tried, `Delete` declared `delete` under
`undoes: act-1`, is a delete-class act and would have gone to the person's gate. `ledger.target` checks the target
first and refused it as another item's before any gate (`ledger.ts` header: "Anything else is refused unrun"). No
permission request was raised in this run, so the Lab's person was never asked and never answered.

## (4) Why the candidate was `not_tested`

The supervisor's only `core.test_candidate` (0054) was refused at `project-agents/supervisor/whole-trial.ts:26-31`
(`inPlace.length` was 4) before `gate.test` ran, so `trialCount: 0` and no receipt. Both resets were blocked. After
brief-3, act-4 and act-5 were still in place, so a retest would have been refused again. `whole-trial.ts` has no
`cannotUndo`, no start-hook absorption and no stall admission. The supervisor ended `blocked`, and the Lab's
flow-lane recorded the candidate `outcome: draft`, `verdict: not_tested` ("It was never test-run from the start").

The whole-trial refusal is also internally inconsistent. `service/project-build/whole-trials.ts:64-65` keeps
`prepareStart` on the port "so the supervisor's trial gate runs it before each whole trial as a candidate build's
does". But the gate runs it only when `this.input.reset` is set (`flow-bootstrap/candidate/trial-gate.ts:227`), and
`supervisor-loop.ts:91` sets none. If the trial had been admitted, `candidate-trial/run.ts:60` would have called the
hook itself and the site would have been put back. The ledger, though, would never have counted the acts absorbed.

## (5) Candidate mode on the same task, and what differs

The latest passing candidate run of this task is `lab-runs/2026-10-13/run-mv6p78kz-44f8e85d`. Its step 0046
`core.test_candidate` was admitted with **`absorbedByStartReset`: act-1 to act-3**, the build's own exploration
presses of `Confirm`, and returned `leftOnSite` act-4 to act-7. Its step 0052 absorbed act-4 to act-7 the same way and
passed. No model reset was ever asked for. Ten candidate runs of this task passed on 2026-10-11 to 2026-10-13.

| | Candidate mode | Project mode (this run) |
| --- | --- | --- |
| Whole-trial gate | `new AutomationStudioFlowCandidateTrialGate({ ..., reset })` (`candidate/authoring-loop.ts:114`) | Same class built **without** `reset` (`supervisor-loop.ts:91`) |
| Before the gate | Nothing | Hard refusal on any project-ledger act in place (`whole-trial.ts:26-31`) |
| Start hook | `prepareStart`, then `beforeTrial({startReset:true})`: every act absorbed (`ledger.ts:291-302`) | Never reached |
| An act the site cannot undo | Kept after 2 asks, or by `cannotUndo` on `core.test_candidate`; the trial runs and the judge is told (`trial-policy.ts:19-20`) | Whole trial refused for as long as it is in place; nobody can name it `cannotUndo` |
| Deadlock guard | Unchanged refusal, or more than 3 refusals, admits the trial (`trial-policy.ts:21-25, 70-72`) | None |
| Who undoes | The same model, which knows its acts (it made them, and the refusal lists them beside its test) | A fresh model that is told nothing about undoing until its first completion |

The builder side of project mode was aligned in t578: `brief-ports.ts:159-170` and `subflow-trial-gate.ts:130` pass
`reset` with `startReset`, which is why brief-1's trial started reset. The supervisor's whole trial was not.

## Recommended fixes (Core; general wording, nothing shaped like any scenario)

1. **Give the supervisor's whole-trial gate the same reset the builder's trial has** (root cause 1).
   - In `supervisor-loop.ts:91`, pass `reset` built by `automationStudioProjectBuildTrialReset({ project: ledger, own:
     ledger.forBrief(SUPERVISOR_LEDGER), checks })`, with `compare: async () => ({ moved: false })` and per-act
     `compareAt`, the pattern a builder uses when its start is not the build's (`brief-ports.ts:161`).
   - Wire it through `ports` from `service/project-build/`.
   - Then reduce `whole-trial.ts:26-31` to a pass-through: the gate's own refusal (`candidate.trial_reset_required`,
     with `actsToUndo`) becomes the signal to dispatch a reset. The hook absorbs everything where a deployment has
     one; kept acts and the no-deadlock admission apply where it does not; the judge is told under `startedWith`.
   - This keeps the user's rule: every trial and the judged whole run start from the build's start state, and the
     site-control undo is still demanded wherever no hook exists.
   - Test it beside `project-agents/supervisor/tests/`: a project ledger holding trial acts, a port with
     `prepareStart`, and the whole trial admitted with `absorbedByStartReset`. Without a hook it is refused once, then
     admitted with the acts kept after a reset that kept them.
2. **Tell a reset brief's model what its job is** (root cause 2).
   - In the reset port (`brief-ports.ts:183-190`), replace the build instruction in its harness with a reset task, and
     put the acts to undo in its opening evidence, not only in the completion refusal (`reset-loop.ts`).
   - Generic wording: "Your only task is to undo these lasting acts this build made, each on the item it acted on,
     through the site's own controls, naming the act under `undoes`. Do nothing else on the site. If the site offers
     no control that reverses an act, complete and name it under `cannotUndo`."
   - Add `cannotUndo` to the reset completion schema. Route it to `ledger.beforeTrial(..., cannotUndo)`, which already
     honours it once the act has been asked for (`ledger.ts:287-291`), so an irreversible act ends a reset `done`, as
     kept, instead of stalling.
   - Drop `write` from the reset's `core.run_node` schema: a reset writes no Flow.
3. **Stop a reset from adding lasting acts** (defect 3).
   - At least: wrap the reset loop with the same `told(...)` `outsideBrief` note a builder gets, so a lasting press in
     a reset is named as outside it.
   - Better: refuse unrun, in a reset brief only, a lasting call that names no `undoes`. That is a new restriction
     beyond the permission gates. The user's rules of 2026-10-01 and the "no action restrictions beyond permissions"
     memory forbid refusing presses beforehand in general, so **the supervisor should confirm this with the user**
     before building it. The note alone does not need confirmation.
4. **Word refusals for the role** (`site-reset/words.ts:48`, `refusal-run.ts:69`). In a reset, `undo_wrong_target`
   should say "name it under `cannotUndo` when you complete, or undo another listed act", and the run warning should
   not mention a Flow being tested.
5. **Supervisor: no identical reset after a blocked one with the same acts.** Core could answer the second dispatch
   with what the first left and the instruction to end, or once fix 1 is in place, to test (kept acts no longer block).
   This would have saved brief-3's $0.012 and act-5.

No fixture change is recommended. Answering a request once, with no undo, is a realistic irreversible act, and the
product has to handle it through "kept, judge told" or the start hook.

## Commands run and observed results

- `git log --oneline 2db229e9..dev` in `!FluxIQ`: empty, so dev is the run's Core.
- Python and grep over `steps/` (0004, 0010, 0012, 0043, 0045, 0052, 0054, 0056, 0058, 0066-0087, 0089-0139):
  results and decisions as quoted above. The first requests of 0058, 0091 and 0014 contain no `act-1`, and their
  evidence entries are only `core.route_state.1` and `initial.core.run_node`.
- grep of `summary.json` and `snapshots/flow-lane.json`: `verdict: not_tested`, `trialCount: 0`,
  `permissionRequest: null`.
- `lab-runs/*/*/summary.json` scan: 10 candidate passes of this task, on 2026-10-11 to 2026-10-13. Run
  `run-mv6p78kz-44f8e85d` steps 0046 and 0052 show `absorbedByStartReset`.
- Read Core: `whole-trial.ts`, `supervisor-loop.ts`, `reset-loop.ts`, `run-brief.ts`, `dispatch/types.ts`,
  `brief-ports.ts`, `reset-calls.ts`, `trial-reset.ts`, `whole-trials.ts`, `candidate/trial-gate.ts` (200-260),
  `candidate/authoring-loop.ts` (105-115), `site-reset/ledger.ts` (header, 119, 204-221, 274-330),
  `trial-policy.ts`, `candidate-trial/port.ts`, `candidate-trial/run.ts` (60, 160-185), `refusal-run.ts`,
  `refused-repeat.ts`, `stall-code.ts`, `dispatch-tool.ts` (70-95).
- Read the downstream fixture: `client/requests-script.ts`, `markup/friends.ts`, `state.ts`, `route.ts`, and the
  person page in `markup/pages.ts`; and `packages/test-runner/src/environment.ts:125-169`.

## Not verified

- No fix was prototyped or tested. The claim that fix 1 alone would have let this run test and pass is an inference
  from candidate mode's identical behaviour and from `run.ts:60`.
- I did not trace where the reset port's `runHarness` takes its instruction text. I inferred it from the request
  content and from `environment(...)` reusing `draft`. The fix site may be one level below `brief-ports.ts`.
- I did not check the earlier project-mode social runs of today (`run-mv7t2xxc`, `run-mv7vmvhd`, `run-mv819so1`) for
  the same pattern.
- I did not verify whether the supervisor's host tools could give a start check a page to read (fix 1 assumes the
  per-act `compareAt` pattern needs no supervisor-side page tools beyond those the ledger checks use).

## Open questions or contradictions found

- `whole-trials.ts:64` says the supervisor's gate runs the start hook, but `supervisor-loop.ts:91` with
  `trial-gate.ts:227` means it never does. The comment describes intent the wiring does not deliver.
- The user's reset rule says "through the site's own controls". Candidate mode (t475) and the builder's trials (t578)
  already treat the deployment's start hook as satisfying it. Fix 1 extends that to the whole trial, which is
  consistent with existing practice, but the supervisor may want to confirm the reading with the user.
- Fix 3's hard refusal conflicts with the standing "no press refused beforehand" rule unless the user scopes an
  exception for reset briefs.
