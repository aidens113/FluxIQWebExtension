# Cost gap, `project` vs `candidate`: Core code map and a one-brief path design

Worker report for brief `cost-gap-core-code`. Read-only investigation of FluxIQ Core at
`C:/Users/osrs_/FluxStuff/!FluxIQ`. All paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/` unless they say otherwise. Line numbers are from the
current Core working tree (2026-10-16).

## Outcome

Done. Questions (1) to (5) are answered with file:line references. The main finding: for a one-part task, `project`
runs the same Flow from the start **twice**, each run judged (two judge calls each). It also runs a **reset brief**
(a separate LLM loop) between the two runs whenever the first run left a lasting act, pays at least **five to seven
supervisor decisions**, and gives its only builder **half** of the money it could spend. That last point pushes the
builder into its wrap-up early, which is what turns one part into several briefs. The design in (5) makes the
builder's own test the judged whole-Flow run when the plan has one subflow, and sizes that brief at the whole
allocatable purse. The creation rule and the plan stay as they are.

## What changed and why

Only this report was written. No source or document in either repository was touched.

## (1) The LLM calls a `project` build makes, from request to judged whole run

Both modes share the instruction-authority reading (`service.ts:1575`, `automationStudioFlowBootstrapInstructionAuthority`),
so it is not part of the gap. From there, `service.ts:1600` calls `runAutomationStudioProjectBuild` in place of
`generateAutomationStudioFlowCandidateDraft`.

| # | Role | What happens | Provider calls | Where |
| --- | --- | --- | --- | --- |
| 0 | build | The project build wires the dispatcher, subflow-trial port, supervisor provider and reserve | none | `service/project-build/run.ts:154-226` |
| 1 | supervisor | The loop starts; the opening `project.read_task` returns the instructions, money, `howToWork` and `example` | none (free opening look) | `project-agents/supervisor/supervisor-loop.ts:283`; `supervisor/tools.ts:211`; `supervisor/read-task.ts:53-68` |
| 2 | supervisor | Up to 3 looks (budget), then `project.write_plan` | 1 decision, plus 0-3 for looks | `supervisor/look-budget.ts:98`; `supervisor/planning.ts:19-28`; `supervisor/plan-tool.ts:57` |
| 3 | supervisor | `project.dispatch` with one build brief | 1 decision | `supervisor/dispatch-tool.ts:134-233` |
| 3a | builder | Ports are made per brief (harness, routing, permissions); then the phase start: start hook, project reset, arrival, entry | none (page work) | `service/project-build/brief-ports.ts:241-274`, `:262` (`phaseStart.explore`) |
| 3b | builder | Evidence loop: explore, `core.submit_subflow`, `core.test_subflow`, then complete with the receipt | N builder decisions | `flow-bootstrap/subflow-candidate/builder-loop.ts:291-330`; decisions through `brief-ports.ts:228-230` → `service/project-build/decisions.ts` |
| 3c | judge (builder purse) | Each subflow trial runs the subflow from the build's start (arrival, start hook), then the **scoped** build-test judge | 2 judge calls per trial (first answer and confirmation) | `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts:324-330`; `service/project-build/subflow-trials.ts:15-31, 60-80`; `service/project-build/brief-calls.ts` (`JUDGE_CALLS_PER_TRIAL = 2`) |
| 4 | supervisor | `project.assemble` (deterministic, no LLM inside) | 1 decision | `supervisor/assemble-tool.ts:24-62`; `supervisor/assembly.ts:71` |
| 5 | supervisor | `core.test_candidate`; if the subflow trial's lasting acts are still in place it is refused with `project.trial_reset_required` | 1 decision | `supervisor/whole-trial.ts:68-91` |
| 6 | supervisor | `project.dispatch` with a reset brief (guidance step 6 asks for this up front) | 1 decision | `supervisor/guidance.ts:124`; `supervisor/dispatch-tool.ts:134` |
| 6a | reset agent | Reset ports, phase start, then the reset loop: look, undo, complete (budget 6 calls) | 2-6 decisions | `brief-ports.ts:276-290`; `project-agents/dispatch/run-brief.ts:269-279`; `service/project-build/reserve.ts:424` |
| 7 | supervisor | `core.test_candidate` again: the whole Flow runs from the start, then the whole judge (full instructions plus the A9 task checklist) | 1 decision + 2 judge calls (from the reserve) | `supervisor/whole-trial.ts:68-80`; `service/project-build/whole-trials.ts`; `service/project-build/reserve.ts:430-437` |
| 8 | supervisor | Completes with the `complete` object | 1 decision | `supervisor/completion.ts` (the `gate.completion` branch) |

A clean one-part build with a lasting act therefore takes about **6-7 supervisor decisions, N builder decisions,
2-6 reset decisions and 4 judge calls**. `candidate` makes one loop: explore, `core.submit_candidate`,
`core.test_candidate` (2 judge calls), complete (`flow-bootstrap/candidate/authoring-loop.ts:139-186`, test at `:150`,
submit at `:162`), which comes to about N decisions and 2 judge calls.

Each new agent loop also starts with a request head that is not yet cached. An evidence decision's head (output
schema, instruction, node catalog names, tools) goes in front of the window so it can be cached, and a candidate's
schema alone is about 28.8k characters (`llm/deepseek/request-body.ts:95-160`). A builder's head differs from the
supervisor's (different tools and completion schema). It also differs between briefs, because the submit tool's
`flow` description opens with that brief's own words (`builder-loop.ts:232-233`, `briefWords` at `:169-183`). So
every builder brief, every reset brief and the supervisor each pay one uncached head; `candidate` pays it once. This
part is inferred from the code's caching notes; I did not measure it.

## (2) What each builder brief re-does that `candidate` does once

- **The system prompt and head.** Each brief is a new evidence loop with its own head, as described above. Builders
  keep the domain's operating text; the supervisor gets its own (`supervisor/system-instructions.ts:20-26`,
  `service/project-build/supervisor-provider.ts`).
- **The page view and the exploration from the entry.** Every brief takes the phase start before its first look:
  start hook, project reset, arrival, and predecessors run to the entry (`service/project-build/phase-start.ts`
  header (a)-(e); `brief-ports.ts:262`). After that it explores from nothing. No exploration evidence crosses briefs.
  A repair or carried brief is shown only the earlier script and its resolved steps, and is told explicitly to
  re-find every control. The note reads: "Those handles came from that builder's looks, not yours ... find the same
  controls and reads on your own page" (`project-agents/dispatch/run-brief.ts:177-181`, wired at `:296-300`). So a
  repair re-explores the whole path to get its handles back.
- **The subflow trial, and then the whole trial.** For a one-part plan the single subflow is the router-run subflow
  (`supervisor/plan-input.ts:283-285`: one subflow with no inputs or outputs becomes the router's target, with no
  `main` added). Its subflow trial runs it detached from the build's start (`service/subflow-trial/run.ts:12-40`,
  `:131`). The assembled Flow is that same subflow with the arrival step in front (`supervisor/assembly.ts:113-115`,
  `:231`). The whole trial then runs it again and judges it again. **For a one-part plan the two runs are the same
  run, judged twice by two different judges**: the scoped judge (`subflow-trials.ts:22-28`) and the whole judge.
- **The reset between them.** The subflow trial's acts stay in the ledger, so the whole test is refused until a
  reset brief undoes them (`whole-trial.ts:70`, `:84-91`). `candidate` has one trial, so it has no second reset.
- **Values handed on.** A one-part plan hands on no values. If the plan was split, every trial of the dependent
  re-runs its predecessors to reach the entry (`service/project-build/entry-preparation.ts`; `phase-start.ts` (d)).
- **A supervisor review between briefs.** Every return goes back to the supervisor as a compacted answer
  (`dispatch-tool.ts:221-232`, `compact` at `:459-484`) and costs at least one supervisor decision with its own head.

## (3) Every condition that dispatches another brief for the same part, or splits one request into several parts

Splitting at plan time (the supervisor's own choice, steered by its guidance):

- `guidance.ts:116` (step 1): "Parts share no words: where one stretch of the person's words holds another, it is
  one part, **or split it into stretches that do not overlap**."
- `guidance.ts:129-134` (`EXAMPLE`, the only example): a single sentence, "Find the three newest titles by Ada Hart
  and place a hold on the first", becomes **two parts and two subflows with a handed value** (`find_titles` →
  `titles` → `place_hold`). The example's own case is legitimate, since the titles are read and used. But no example
  shows a single-part plan, so "find X, then act on it" is taught as two subflows.
- `guidance.ts:121` (step 3): "Send briefs with project.dispatch, one for each subflow." The system role
  (`guidance.ts:183`, used by `system-instructions.ts:24`) reads "hand its parts to builder agents".
- `guidance.ts:118` does say "A one-part task is one subflow with no inputs or outputs". Nothing says that a find
  which only leads to the act it serves belongs to that act's part.
- The guards against splitting: `project.plan_part_carried_twice` and `project.quote_overlaps`
  (`guidance.ts:306`, `:309`); the reshape-only warning, refused once (`plan-tool.ts:66-71`); and the
  constraint/reshape warnings, which apply only to plans of two or more subflows (`plan-input.ts:164-170`).

Another brief for the same part, after a return:

1. **The builder comes back partial or blocked** → `GUIDANCE.next.afterReturnsNotDone`: "send a changed brief ...,
   change the plan ..., or end honestly" (`guidance.ts:205`; chosen at `dispatch-tool.ts:229-231`; `forward.dispatch`
   at `planning.ts:30-31`). This has several causes:
   - **Budget wrap-up at its share.** The builder's loop counts decisions left from its allowance's ceiling and
     keeps 4 finishing judge calls (`builder-loop.ts:105`, `:294`; wrap-up = 5 decisions, `llm/loop-budget.ts:113`).
     For a one-part plan that ceiling is half the purse (see (4)), so the builder wraps up, or stops with
     `iteration_limit` or `run_cost_limit`, while the purse still has money. That comes back as partial.
   - **A stall** on repeats or unusable decisions, carrying the last refused submission (`brief-ports.ts:205-213`;
     `dispatch/ending.ts` header t588, t630).
   - **An output the subflow cannot make** (`run-brief.ts:119-124`; `dispatch/output-refusals.ts`) →
     `afterOutputUnmade` (`guidance.ts:210-215`).
   - **A predecessor not done** or not in the dispatch → `notStarted` blocked (`dispatch/dispatcher.ts:70-89`).
   - **"Already done by a subflow before it"** → blocked (`builder-loop.ts:189-194`; `brief-ports.ts`, the
     `entryNote` / `predecessorsLeftOnSite` text).
   - **A brief ending** on a permission refusal or person-needed check (`run-brief.ts:34-43`, `:314`).
2. **The whole test answered no or unsure** → `forward.changeAfterNo`, a repair brief whose `failingReceipt` names
   the whole test (`planning.ts:36`; `guidance.ts:239`). This adds a brief, a new exploration, a reset, another whole
   trial and two more judge calls.
3. **A rescued pass** (the run recovered on a slow-down) → completion is refused `candidate.trial_slow_down_unhandled`
   until a repair is tried (`completion.ts`, the `recoveryRepairFirst` branch; `guidance.ts:339-341`;
   `dispatch-tool.ts:142-144`, `:219-220`).
4. **Lasting acts before a whole test** → a reset brief: guidance step 6 (`guidance.ts:124`), the refusal
   `project.trial_reset_required` (`whole-trial.ts:84-91`; `guidance.ts:258`). Once per whole test that follows any
   trial with acts.
5. **Lasting acts before an ending** → `project.completion_reset_first`, up to `MAX_HELD_FOR_RESET = 2`
   (`completion.ts:11`, the `resetFirst` closure); and Core's own reset before an ending a guard forced, or before
   completing on a fallback (`supervisor-loop.ts:307`, `:329`, `:409-426`).
6. **An amendment** that drops or carries a proposal → new build briefs for the carried, dropped and new subflows
   (`guidance.ts:142-148`, `:200-201`; `state.ts:280` `adopt`, `:346` `carriedForward`; `dispatch-tool.ts:159`
   `carriedOnto`, `:310-319`).
7. **A dispatch failure** → retry (`dispatch-tool.ts:194-199`). **An allowance refusal** → send fewer
   (`dispatch-tool.ts:146-152`, `:173-175`; `dispatch/run-brief.ts:224-232`).

These guards limit the repeats: a second reset after one that came back not done, with nothing changed
(`dispatch-tool.ts:140`, `:416-427`); a brief sent again unchanged after a blocked return (`:162-168`, `:346-353`); a
brief of a subflow whose last proposal changed nothing (`:169`, `:356-369`, `:384-401`).

I cannot reconstruct which of these produced the frozen pair 8 crossborder sequence (five briefs, 68 builder
decisions) from code alone. The build record's decisions (`dispatch` vs `triage` vs `re_plan`,
`dispatch-tool.ts:189-190`; `plan-tool.ts:75`) and its returns' reasons would say. The most likely combination, from
the code: a partial return at the half share (cause 1), then a repair, plus one reset brief per whole test (cause 4).

## (4) How allowances and the reserve are carved for a one-part plan

- **At supervisor start** (`supervisor-loop.ts:228-233`):
  - The judging reserve is kept back: `AUTOMATION_STUDIO_PROJECT_BUILD_RESERVE.calls = 4` (judged whole run 2 + one
    repair round 2), held at the largest judge call priced so far, or at the judge reserve pricing before any
    (`service/project-build/reserve.ts:429-437`; `llm/build-purse/judging-reserve.ts:1-16`).
  - 10 calls are kept from every allowance: `supervisorCalls 4 + resetCalls 6` (`reserve.ts:421-427`;
    `purse.keepBackCallsFromAllowances`, `llm/build-purse/purse.ts:220`).
  - The record's supervisor allowance = `purse.keptBackUsd()`.
- **The build brief** (`supervisor/brief-sizing.ts:72-78`): `shares = sent (1) + waiting (0) + 1 (the build's
  finishing) = 2`.
  - Dollars: `allocatableUsd / 2`.
  - Calls: `floor(allocatableCalls / 2)`.
  - `maxIterations = min(64, calls)` (`:91`).
  - Its call cap is that `maxCalls` (`service/project-build/brief-calls.ts:498-500`).
  - **So the only builder of a one-part plan starts on half of what the build can give**, and the other half sits
    uncarved for a finishing that in practice is one reset brief and two or three supervisor decisions.
- **A waiting brief** is re-sized at start (`dispatch/start-allowance.ts:46-58`). That does not apply here (no
  predecessors).
- **Top-ups:** an allowance may draw up to its own carve again from the purse when a call does not fit, so up to twice
  its share (`llm/build-purse/top-up.ts:1-45`). But the builder's decisions-left count reads its allowance ceiling, so
  the wrap-up is still timed against the half share (`top-up.ts:26-29`; `builder-loop.ts:20-31`).
- **The builder's own keep:** 4 finishing judge calls (`builder-loop.ts:105`, `:294`). Its subflow trials' judges are
  charged to its allowance (`run-brief.ts:22-27`, `:241`).
- **A reset brief:** calls from the kept-back finishing calls minus the supervisor's (`brief-sizing.ts:79-82`;
  `run-brief.ts:224-226`, `fromKeptBack`). Its dollars are a share of what is allocatable.
- **The whole trial's judge** draws on the judging reserve (`whole-trial.ts:12-15`).
- **For comparison,** `candidate` keeps no reserve: one loop on the whole purse
  (`service/flow-bootstrap-commands/candidate-generation.ts:147-160`).

## (5) Recommended "one-brief path" for a one-part plan

**Scope.** It applies only while the plan in force is a *single-subflow plan*: exactly one subflow, carrying parts,
with no `interface` (no inputs or outputs), that the router runs. That is the plan `plan-input.ts:283-285` compiles
when `written.length === 1` with no ports. Every other plan keeps today's path unchanged.

**Idea.** On this plan the builder's own test is the judged whole-Flow run. Core assembles the builder's proposal
deterministically, submits it to the supervisor's whole-candidate controller, and tests that exact revision with the
supervisor's whole-trial gate and judge. This happens inside the builder's `core.test_subflow`, after the builder has
put the site back, exactly as a candidate builder does. A yes from the builder is then a whole-trial yes on the exact
assembled revision, recorded as a `candidate_trial` receipt, and the supervisor completes on it. Gone from the path:
the scoped subflow judge, the second run, the reset brief between the runs, and the assemble and test decisions.

### Changes, by file and function

1. **New file: `project-agents/supervisor/single-subflow-plan.ts`.** It exports
   `automationStudioProjectSingleSubflowPlan(structure): string | undefined`, which returns the subflow key when
   `structure.plan.subflows.length === 1`, that subflow has no `interface`, `structure.plan.router.fallback` targets
   it, and `structure.partOf[key]` is non-empty. It is one exported thing in one file, added to `supervisor/index.ts`.
2. **New file: `project-agents/supervisor/single-subflow-trial.ts`.** It exports
   `automationStudioProjectSupervisorSingleSubflowTrial(context, wholeTrial)`. It returns `undefined` unless (1)
   holds; otherwise it returns a function `(request: AutomationStudioSubflowTrialRequest, signal) =>
   Promise<AutomationStudioSubflowTrialResult>` that does the following:
   - Reads the requested proposal through `ports.proposals`.
   - Assembles it with the **same code `project.assemble` uses**: extract the body of
     `automationStudioProjectSupervisorAssembleTool` (`supervisor/assemble-tool.ts:28-46`) into a shared function in
     its own file, e.g. `supervisor/assemble-latest.ts`, which both the tool and this module call. Here the proposal
     is the one under test rather than the latest done one, because no return has been recorded yet. This is not
     extract-and-drop: the tool keeps calling the shared function.
   - Submits the plan with `controller.submitComposed`, then runs `wholeTrial.test(context, {revision, digest},
     signal)` (`supervisor/whole-trial.ts:68`). That records the receipt, sets `state.noteWholeTest` and
     `wholeTrialFailed`, and leaves `gate.standing`.
   - Runs the whole trial **under the supervisor's purse frame and attribution**, as `resetBeforeEnding` does
     (`supervisor-loop.ts:421`: `withAutomationStudioProjectAgent({ role: "supervisor" }, () =>
     automationStudioLlmBuildPurseRun(ports.purse, ...))`). Its judge then draws on the judging reserve and not on the
     builder's allowance.
   - Maps the answer to `AutomationStudioSubflowTrialResult` (`flow-bootstrap/subflow-candidate/contracts.ts:78-92`):
     `partial: true`, `scope: "subflow"`, the request's identity, the **proposal's** revision and digest, the whole
     trial's verdict, `trialRunId` and `acts`, `entryPrepared: true`, and `feedback` = the whole trial's feedback plus
     `wholeTest: { revision, digest, trialRunId }` and the `complete` object.
   - Maps a whole-gate refusal to the builder's terms: `project.trial_reset_required` becomes "undo the listed acts
     first", a refused composed submission keeps its own code. Do not wrap a refusal as a verdict.
3. **The dispatcher seam: `project-agents/dispatch/port.ts:80-84`.** Add an optional
   `wholeTrial?: AutomationStudioSubflowTrialPort` to `AutomationStudioProjectDispatchRequest`.
   - `dispatch/dispatcher.ts:91` passes it to `runAutomationStudioProjectDispatchBrief`.
   - In `dispatch/run-brief.ts`, `run()` at `:295` builds the gate's port with it in place of `ports.trial` for
     `build` and `repair` briefs, through the same `automationStudioProjectDispatchTrialPort` wrapper, so receipts,
     `remember`, `weighed` and the standing nos still apply. Keep `prepareStart` from `ports.trial`, so the start hook
     still runs ahead of the builder's reset (`subflow-trial-gate.ts:324-327`). Reset briefs never get it.
   - `supervisor/dispatch-tool.ts:195` passes `wholeTrial` when (2) returns one.
4. **Builder words: `flow-bootstrap/subflow-candidate/builder-loop.ts`.** Add an input `trialIsWhole?: true`, passed
   by `run-brief.ts` when the request had `wholeTrial`.
   - The submit tool's `next` (`:321-323`) and the trial gate's tool description say: this test runs the whole Flow
     from its start and is the build's judged run, and a yes completes the brief.
   - `briefWords` (`:169-183`) stays as it is; for a router-run subflow it already says the subflow takes no inputs
     and hands back no outputs.
   - All words stay generic and name no Lab site, product or task.
5. **The answer after a done return: `supervisor/dispatch-tool.ts:229-231` and `guidance.ts`.**
   - When the single subflow came back done and the latest assembly's standing verdict is yes, answer with a new
     `GUIDANCE.next.afterSingleWholeYes` that carries the `complete` object. Wording such as: "This plan is one
     subflow, so its builder's test was the judged whole run, and it answered yes: complete with the complete object
     here." `planning.ts:32-37` already reaches `complete` from the same state.
   - **Guard against a re-assembly.** `project.assemble` on this path, when the latest assembly is from the latest
     done proposal, must answer with the existing `complete` object and make no new revision. A new revision would
     need a new test (`guidance.ts:163`). Put this in the shared function from (2).
6. **Sizing: `supervisor/brief-sizing.ts:72-77`.** For a build or repair brief of a single-subflow plan, drop the even
   finishing share.
   - Give `allocatableUsd - finishingUsd`, where `finishingUsd` is `finishing.supervisorCalls + finishing.resetCalls`
     calls priced at the purse's settled average (`llm/build-purse/purse.ts:386` computes `averageUsd`; expose it if
     it is private). Fall back to today's even share when nothing is priced yet.
   - The calls kept back (10) are unchanged, so the completion and a reset before an ending still have calls.
   - `dispatch/start-allowance.ts` needs no change (no predecessors).
   - The builder's own 4 finishing judge calls (`builder-loop.ts:105`) are no longer its spend on this path, because
     the whole judge draws on the reserve. Pass `keptForFinishing: 0` when `trialIsWhole`, and check that the loop
     budget still leaves room for the wrap-up's own decisions.
7. **Guidance: `supervisor/guidance.ts`.**
   - Step 1 (`:116`): add that a search, find or open which only leads to the act it serves belongs to that act's
     part, and that parts are only for separate things the person asked for.
   - Steps 5-6 (`:123-124`): add that with one subflow there is nothing to assemble or reset: once its brief comes
     back done, complete with the complete object it carries.
   - Add a second, **one-part** example from a kind of site no realistic Lab scenario uses, for example a community
     garden's plot booking: "Book the earliest free plot on the east beds" is one part, one subflow `book_plot` with
     no inputs or outputs, and one brief. The scenarios to avoid are everything-store, crossborder-marketplace,
     bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed,
     company-website and professional-network.
   - `supervisor/tests/guidance.test.ts` already holds every string to its lists.
8. **Optional, phase 2, only if a live round shows it matters:** Core dispatches the single build brief itself right
   after a `project.write_plan` that yields a single-subflow plan with no warnings, as it dispatches its own reset in
   `supervisor-loop.ts:409-426`. It returns the plan answer and the brief's return together. This saves one more
   supervisor decision (write_plan → complete).

After (1)-(7), a one-part build makes **write_plan, dispatch and complete**, which is three supervisor decisions,
plus one builder loop and two judge calls per tested revision. With a lasting act and a passing first test, it makes
no reset brief and no second run. The remaining overhead against `candidate` is those three decisions and one extra
uncached head. This is an estimate from the code; it needs a live round to confirm.

### Tests to add (each in the `tests/` folder beside its subject)

- `project-agents/supervisor/tests/single-subflow-plan.test.ts`:
  - It recognises a one-subflow router-run plan.
  - It rejects a plan with ports, with two subflows, or with Core's added `main`.
- `project-agents/supervisor/tests/single-subflow-trial.test.ts` (on `supervisor-fixture.ts`):
  - It assembles exactly the tested proposal and records a `candidate_trial` receipt.
  - The gate stands yes and `planning` says complete.
  - A no sets `wholeTrialFailed`.
  - `trial_reset_required` comes back as a refusal in the builder's terms.
  - A multi-subflow plan gets `undefined`.
  - The judge runs under the supervisor's purse frame.
- `project-agents/supervisor/tests/brief-sizing.test.ts`:
  - New cases: a single-subflow build brief gets `allocatableUsd - finishingUsd`.
  - The unpriced fallback gives the even share.
  - A multi-subflow plan is unchanged.
- `project-agents/supervisor/tests/assembly.test.ts`, or a new `assemble-latest.test.ts`:
  - `project.assemble` after a single-subflow whole yes returns the same `complete` object and no new revision.
- `project-agents/dispatch/tests/dispatcher.test.ts`, or a new `whole-trial-port.test.ts`:
  - `request.wholeTrial` replaces the trial port for build and repair briefs, not for reset briefs.
  - `prepareStart`, receipts, `remember` and `weighed` are kept.
- `flow-bootstrap/subflow-candidate/tests/builder-loop.test.ts`:
  - The `trialIsWhole` wording, and `keptForFinishing` on that path.
- `project-agents/supervisor/tests/planning.test.ts` / `plan-dispatch.test.ts`:
  - After a done single-subflow return with a whole yes, the `next` is `afterSingleWholeYes`, carrying `complete`.
- `service/project-build/tests/project-build-single-subflow.test.ts` (end to end, scripted provider):
  - A one-part task with a lasting act runs one builder brief and **zero reset briefs**.
  - It makes no scoped subflow-judge calls and one whole-judge pair per tested revision.
  - The supervisor decisions are exactly write_plan, dispatch and complete.
  - The build ends `candidate`, and promotion reads the whole trial from `trials.records()`.
  - The existing two-subflow facade test stays green unchanged.

### What should NOT change

- **The multi-subflow path:** the plan format, assembly order, entry preparation, the scoped subflow judge, and repair
  or reset handling for any plan of two or more subflows, or one with ports.
- **The creation rule:** completion only on a whole-trial yes for the exact latest assembled revision and digest
  (`completion.ts`, `gate.completion`), and promotion from `trials.records()`
  (`service/project-build/run.ts:240-267`; `service.ts:1612-1614`).
- **The plan's hold on the person's request:** verbatim quotes, no overlaps, `plan_part_dropped`, notAsked feeding
  the judge's task checklist (`plan-input.ts`; `service/project-build/task-checklist.ts`).
- **Honest endings:** the builder's `ended` (`builder-loop.ts:259-270`); the supervisor's ending and the
  reset-before-ending rule (`completion.ts`, `resetFirst`); Core's reset before an ending a guard forced
  (`supervisor-loop.ts:307`, `:329`); and what is left named in Core's words.
- **The site reset before every trial and judged run** (user rule, 2026-10-12): the builder still undoes this build's
  acts through the project reset before its test (`subflow-trial-gate.ts:324-330`), and the whole gate checks the
  ledgers again (`whole-trial.ts:12-45`).
- **The repeat guards** (`dispatch-tool.ts:140`, `:162-169`), the judge weighing, the retries, host capacity 1 and the
  leases, the builder never seeing `project.*` tools, and the rule that model guidance never mirrors a realistic
  scenario's task, site, products or answer.

## Commands run and observed results

Read-only shell reads only (`cat -n`, `sed -n`, `grep -n`, `ls`, `wc -l`) over Core's
`packages/fluxiq/src/programs/automation-studio/runtime/`. One `awk` printed this repository's
`docs/working/automation-project-agents-plan.md` `Current State`, which confirmed the cost figures and the open item
"Plan a one-brief path for a one-part plan". No build, typecheck or test ran: the brief named none, and the work
edits no code.

## Not verified

- The actual brief sequence of the frozen pair 8 crossborder run (five briefs, 68 builder decisions). Its build
  record was not read, so which of the (3) causes fired is inferred.
- Whether the Lab deployment supplies a start hook (`prepareCandidateStart`, `service.ts:310`, `:427`). With a hook,
  the reset brief before a whole test may undo nothing and cost little; without one, it is a full LLM loop.
- That a purse run frame opened inside a builder's allowance scope makes the whole judge draw on the parent purse's
  judging reserve, rather than on the allowance. The code's frame comments say "innermost wins"
  (`supervisor-loop.ts:18-23`); this needs a test.
- The size of each agent's uncached head. It is inferred from `request-body.ts` comments, not measured.
- Whether `controller.submitComposed`'s unchanged-submission and refuted-digest rules
  (`flow-bootstrap/candidate/unchanged-submission.ts`) interact badly with a builder that resubmits the same subflow
  between whole tests on the single path. The worker implementing (2) should read that file.
- Whether the whole trial needs a host lease. `service/project-build/whole-trials.ts` names none, so it should run
  under the builder's held lease with capacity 1, but this is untested.

## Open questions or contradictions found

- `guidance.ts:115` (`HOW_TO_WORK`) tells the supervisor "The start page as the build found it is already in your
  evidence", but `supervisor/role-tools.ts:116-123` strips every kept tool's `initialObservation`, and the opening
  look is `project.read_task`, which carries no page (`read-task.ts:58-66`). As far as this code shows, the
  supervisor has no start page in its evidence, so the sentence may push it into its 3 looks. Worth confirming
  against a step log.
- `reserve.ts` sizes the finishing calls (4 supervisor + 6 reset) for the multi-subflow path. On the single path,
  `supervisorCalls` could be 2, but the reserve is set before the plan is known (`supervisor-loop.ts:231`). I left it
  unchanged in the design; a later tightening is possible.
- The brief's phrase "every code path that can turn a one-part task into more than one builder brief" includes Core's
  own resets. Those are reset briefs, not builder briefs, but they are LLM loops and count toward the gap. They are
  listed in (3).
