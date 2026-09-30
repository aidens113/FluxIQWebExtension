# Audit A3: judgement and repair (Full Debug Protocol stages 5 and 6)

Worker A3, 2026-09-30. Read-only audit: no code changed, no Lab run, no model call.

- Dev heads read: Core `25c8b32f`, downstream `097c9a52`.
- Core paths below start at `R/` = `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.
  Downstream paths are relative to the web-extension checkout.

## Outcome

Done. The evidence covered:
- the 57 debug files: the union of dev and the four lane trees, with the lane copy winning. Five t195 files differed
  from dev, and t195's copy was used;
- the four lane reports, plus t195-w14, t195-w16, t196 and t200;
- the spend ledger for the five afternoon runs;
- the bundles of the two afternoon runs that have no debug: `run-muogfred-d3510100` (B) and `run-muohbi3e-e5847e5a` (A).

None of the lane reports has a "Top causes for the audit" section yet, so the lane tables were read instead.

No run has ever gone the whole way through the product's last three steps:
1. a Flow was built, ran, and was judged wrong or failed;
2. a repair was applied and the repaired Flow's answer was judged right;
3. the repaired Flow was replayed with no provider call.

- **Nearest:** C runs 4, 6 and 7 applied and persisted a re-author (graph revisions 2 and 3), but the re-run stopped
  before the repaired step.
- **Replay after repair:** reached in 0 runs.

## Ranked causes

"Runs" counts the live runs the cause decided, from debugs and lane tables. Ids drop the `run-` prefix. A = t174,
B = t193, C = t194, D = t195.

### 1. A build that fails to finish never reaches test, judgement, repair or a "not doable" ending

- **Runs:** 30. The build (stage 2) ended with no Flow, so stages 5 and 6 never ran.
  - A (16): runs 4, 6, 7, 10, 17, 19, 21, 23, 27, 29, 30, 32, 33, 34 `muoga8at-123533a4`, 35 `muogweml-0190212c`, and
    `muohbi3e-e5847e5a`.
  - B (5): runs 1 to 4 and 7.
  - C (1): run 5.
  - D (8): runs 7, 8, 9, 11, 13, 14, 15 and `muog33va-96469cb2`.
- **The user's complaint.** "Failed with no repair attempt or anything" is this cause. `muoga8at` was probably the run
  the user watched: the panel said "Build failed" and nothing followed. `muog33va` stopped with 25 of 64 calls,
  $0.06 of $0.25 and 398 s of 540 s still unused, on a refusal it could have corrected.
- **Root cause on dev:**
  - `R/llm/evidence-loop.ts:353-367` (`unusable`). After 12 unusable decisions in a row, or when the no-progress guard
    fires, it returns `stalled` and the loop ends.
  - `R/service.ts:1558` maps that ending to `keeper.stalled(flowBootstrapEvidenceUnusableDecisionFailure(...))`, and an
    exhausted loop to `keeper.exhausted` at `:1611`.
  - Neither ending lets the model finish, and neither declares the task not doable with a reason. The loop has no
    "not doable" decision at all.
  - The kept incomplete draft is resumed only by a later build of the same Flow (`:1555`), and the Lab makes a new Flow
    per run.
- **Scope.** Why each loop stalls (repeats, refused completions, element caps) belongs to A1, A2 and t200. This audit
  covers only what a stall ends in.
- **Status:** open. t196 moves the test to after an accepted completion (`llm/evidence-loop/completion-attempt.ts`,
  uncommitted on `task/t196-state-digest-cost`) but leaves the stall ending unchanged.

### 2. A step that fails in playback can only be patched; nothing can add, move or close a step, and re-author is never entered

- **Runs:** 12. Stage 6, runtime recovery (the "ladder": diagnosis, plan, patch).
- **Where the fix is a missing or moved step, or a covering layer (8 runs):**
  - D3 `munnyvbr` (the dialog's confirm sat outside the loop);
  - D4 `munoa86g` (a consent wall);
  - A16 `munore4o`, A18 `munpwa5r`, A22 `munu4b4y` (consent);
  - A20 `muntmwvx` (a support card covering the button);
  - A26 `munvhy0t` and A31 `munwk8ta` (both the same as run 22; no debug).
- **Where the control moved in B's armed variant (3 runs):** B5 `munutuvf`, B6 `munv9eqy`, B8 `munwdydi`.
- **A rate limit (1 run):** D6 `munq51ik`, ended `diagnosis_asked_for_none`.
- **What each ladder ended in:**
  - `runtime_patch_goal_unachievable`: 4 runs;
  - a target override refused as ambiguous or `target_unanchored`: 2;
  - `temporary_action_sequence` refused as not planned: 1;
  - a patch reply `provider_output_invalid`, `unsupported_runtime_patch` or `unexpected_field`: 4.

  In `munoa86g` the model wrote the right fix, an action sequence pressing the consent decline first, and Core refused
  it because the plan did not list that kind.
- **Root cause on dev:**
  - `R/recovery/plan.ts:95-102` (the map at `:97`): `action_target_override` allows only `temporary_target_override`
    and `temporary_wait_retry`, and every one of these failures classified that way.
  - `R/recovery/annotation/patches.ts:139-141` then refuses an unplanned action sequence (`unplannedPatchAttempt`,
    `:421`).
  - `R/llm/harness/provider-result.ts:189` rejects any kind outside the five.
  - The only path that can add or reorder steps is the extend-mode re-author (`R/recovery/refuted-result/reauthor.ts`,
    built by `R/service/runtime-adaptation/refuted-result-port.ts:113-178`). It is wired only to a refuted result
    (`R/service.ts:2597`).
  - The failed-step paths `R/service.ts:2712-2737` (routed Subflow) and `:2771-2790` (direct) run the ladder, and when
    no patch lands they save "declined" and stop. There is no escalation.
- **Why the replan does not help.** The replan after exploration (`R/recovery/annotation/replan.ts`) re-asks the same
  question, and the model answers `goal_unachievable` honestly: a target override cannot add a step. In `munu4b4y`
  the exploration itself pressed the consent decline, found the next blocker, and was still ruled unachievable.
- **Status:** open.

### 3. A permission ask ends the build, so a consequential task cannot produce a Flow

- **Runs:** 14. Stage 2, reported at stage 6 as the ending.
  - D's 12 bigbox `pickup-order` "passes", including D5 `munovwp3` and D16 `muny5y17`. Each is `flowCreated=false`.
  - D10 `munuj2os`: `delete` with `no_point_declared`, after a 122 s unanswered wait.
  - B `muogfred-d3510100`: `send_or_publish` at an exploration click, `no_point_declared`. The build ended after 15
    decisions ($0.028) and has no debug.
- **Root cause on dev:**
  - Core `R/flow-bootstrap/action-permissions.ts`:
    - `:164-177` allows one ask per build (`asked`);
    - a refused or unanswered ask settles `refused`;
    - `planStep` at `:201` then aborts the loop (`planRefused.abort()`) as soon as a completion holds the refused act;
    - `R/service.ts:1558` reads `permissions.endedOnRequest` first.
  - Nothing in the Lab answers the ask: `parking/permission-ask.ts:59-110` waits up to 120 s and then counts it as
    `deny`.
- **Tasks that name a send act but declare no permission point:**
  - `apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts`: `social-network-feed-group-post`, `-regrouped`
    and `-regrouped-after-creation`. B's lane runs the last one.
  - `apps/scenario-lab/src/scenarios/company-website/live-tasks.ts:29-30`: `company-website-quote-request` and
    `-redesigned-after-creation`. A's lane runs the first; B's lane runs the second.

  Under F10 (money, delete and send always ask) these five tasks can never build a Flow.
- **Status:**
  - fixed on branch `task/t195-live-control-flow` for declared points (t195-w14, uncommitted; the Lab grants at the
    declared point and denies elsewhere);
  - **open** for the five undeclared tasks: w14 denies them, and the build ends exactly as `muogfred` did;
  - **open** (a design point for the supervisor) for the one-ask rule. A deny or grant on an earlier
    `create_new`/cookie ask uses up the build's only ask before the real act (w14's open question).

### 4. A repaired Flow whose re-run fails is never repaired again

- **Runs:** 3. Stage 6, after the re-author was applied.
  - C4 `munq5s8x`, C6 `munv53gt`, C7 `munw7ffn`.
  - In each, the re-author was applied and persisted, then the re-run stopped on the optional "Continue shopping"
    press.
  - The repaired read was never played or judged.
- **Root cause on dev:**
  - `R/result-verification/run-outcome.ts:330-342`. Only `rerun.session.status === "succeeded"` is verified again.
  - Any other re-run is settled `rerun_failed` (`:341`) and the repair ends.
  - The re-run (`R/service.ts:2595`, `rerunAfterRepair`) never goes through the failed-step ladder, and
    `AUTOMATION_STUDIO_RESULT_REPAIR_MAX_ATTEMPTS = 3` (`R/recovery/refuted-result/history.ts:40`) is never used.
- **Status:**
  - the trigger is fixed on branch `task/t194-live-judge-answer`: F11 (`R/executor/recovery-budget.ts`) and F12
    (attempt ids), WIP `4c8753ed`, not on dev;
  - the loop gap is open: any other re-run failure still ends the repair.

### 5. The re-author build fails in the same ways the build does, from the wrong page, and is applied without a test

- **Runs:** 7. Stage 6, re-author.
- **Before F2 and F3 (2 runs):** C1 `munnhi5q` and C3 `munojusu` ended `evidence_unusable_decision`, from
  `consequences_undeclared` ×8 and `answered_the_same_again`. F2 and F3 are on dev.
- **Still open on dev-equivalent code (3 runs):**
  - A15 `munoeac4`: 8 completions refused `instructed_act_missing`, then `unusable_decision`;
  - B5 and B6: 9 `draft_unchanged` amendments, then `evidence_repeat_without_progress`.
- **Applied but weak (C6, C7):**
  - the re-author explored from the page where playback ended (page 4), not from the page where the failing read
    starts, so it wrote `a:nth-of-type(6)`, which is only valid on pages 3-4;
  - it made 13 reruns into the store's 429 limiter;
  - 13 of 35 replies were malformed;
  - it completed with no test.
- **Root cause on dev:**
  - The re-author is the build loop in extend mode (`refuted-result-port.ts:134-138`), so it inherits cause 1's stall
    endings and A1's decision causes.
  - The extend seed is never dry-run gated (`R/llm/loop-configuration.ts:222-225`: "a seeded draft is not dry-run
    gated"), and nothing moves the page to the failing step before exploring. The user's rule allows a replay from the
    start in the repair phase.
- **Status:** open. The gating and seed replay are t196's files; the stalls belong to cause 1 and A1.

### 6. The judge cannot see what an act task did, so a wrong cart is "unverified" (success) or unjudged (no repair)

- **Runs:** 4. Stage 5.
  - **B9 `munwmt25`:** the Flow succeeded on the armed variant and the goal failed. The judge said `unsure` twice, the
    result was `unverified` (`core.result.refutation_unconfirmed`), and the run ended `status: succeeded`. A wrong
    answer was judged fine, and no repair ran.
  - **A28 `munvvc3z`:** all 15 actions ran, and 3 of 5 goal facts were wrong. The judge call was refused before
    sending, `llm.provider_result_summary_invalid`, so the verdict was `unavailable`. The run was failed closed, and
    `unsure` is never repaired.
  - **B5, B6:** refuted, but only from step names (finding `result.no_record_set`).
- **Root cause on dev:**
  - `R/result-verification/result-summary.ts` summarises record sets and the Flow's step shape (`:120-129`) and
    nothing else. An act task, which stores no records, sends no evidence of the cart, the page or each step's effect.
  - `R/result-verification/agreement.ts:79-81` then keeps "the status its steps earned" on two non-`no` answers.
  - `R/recovery/refuted-result/attempt.ts:82` builds a repair only from `does_not_answer`.
  - `R/llm/harness/request-evidence-check.ts:115-122` (`sendableResultSummary`) refuses for any of four reasons under
    one code, so A28's actual reason was not recorded.
- **Status:** open. t194's F8 (read-account, on branch) helps list reads only.

### 7. The judge's advice misdescribes the read, and the re-author follows it

- **Runs:** 2. Stage 5 into 6.
  - C4 `munq5s8x`: the judge advised adding a paging loop that already existed.
  - C7 `munw7ffn`: 1 of 3 advice points was right. "Raise the page limit" came from a false `truncated: true`; "add
    Plus" was wrong because the Plus condition was worded `aria-label present`; the lazily loaded rows were missed.
- **Root cause:** C4's cause is on dev (the judge was not told pages or stop). C7's causes are on the t194 branch:
  - `result-verification/read-account/condition.ts:82-84` words a condition by selector, not by what it tests;
  - the false `truncated` flag comes from the positional Next;
  - the missing lazy rows come from `list-reader.ts:487-505`.
- **Status:** fixed on branch `task/t194-live-judge-answer`:
  - F8 gives the judge pages and stop;
  - F10 makes a `next` read use the page's own Next;
  - F13 reveals lazy tails.

  Open on that branch: the condition wording (`read-account/condition.ts:82-84`).

### 8. The repair's context was cut to a byte budget

- **Runs:** 8. Stage 6. C1, D2, D3, D4, D6, A18, A20 and A22.
  - `step_parameters`, `flow_graph`, `failed_target`, `recent_nodes` and other sections were omitted for
    `byte_budget`.
  - A20 kept only `failure` and the two transitions.
- **Root cause on dev:** `R/recovery/context.ts:261,268-269`, an 8,000-byte budget clamped to 1,500-16,000.
- **Status:**
  - partly fixed on dev by t194 F4, `R/recovery/context-budget/*`: lossless trims come first, but the budget still
    drops sections;
  - removal is owned by t200 (worker w4 owns `R/recovery/**`), in progress.

### 9. A failed patch reply is charged its whole reservation

- **Runs:** 2. D2 `munnop9n` and A18 `munpwa5r`, $0.0833 each, about $0.17 in all.
- **Root cause on dev:** `R/llm/deepseek/response-envelope.ts:33-43`. Usage is parsed at `:34-41`, then
  `parseDeepSeekStructuredResponse` throws at `:43` and the parsed usage is lost. The ledger then charges the
  reservation.
- **Status:** open.

### 10. A Core-counted refutation closes the re-author route

- **Runs:** 1. D2 `munnop9n`.
- The result was refuted `core.result.required_values_missing` (`R/result-verification/verify.ts:121-122` returns
  Core's own observation first).
- The re-author then refused `not_a_wrong_answer`, because the route compares codes (`R/recovery/refuted-result/reauthor.ts:84`).
- The only route able to add the missing `where` and reorder steps stayed closed. The same would happen to any
  `every_record_refused`.
- **Status:** open.

### 11. A repair's own call breached the budget, and the Lab failed the run

- **Runs:** 2. B5 and B6.
- **Status:** fixed on dev. C4 (`worstCaseCallCostUsd`, `R/recovery/annotation/run-budget.ts:145,156`) is in
  `c2864786`.

### 12. Persistence and the zero-provider replay after a repair

- **Runs:** 0 reached. Persistence was observed in C6 and C7 (graph revisions 2 and 3, re-run on revision 3).
- **Not exercised:**
  - B's `--replays 2` has never been reached;
  - `R/result-verification/zero-provider-run.ts` has never been reached after a repair.
- **One inconsistency, recorded and not traced.** C7's re-run recorded
  `resultCheck: core.check.authorization_absent`, although the first pass was judged with the caller's key. The
  refuted-result re-run path (`R/service.ts:2594-2596`) does not refresh `runResultCheck`, where the ladder paths do
  (`:2735`, `:2788`).
- **Status:** unverified.

## Fixes for open causes, partitioned by file

Each group of files can go to one worker. Groups that share a file are serial.

### Fix 2: a failed step escalates to re-author (cause 2)

Core; serial after t200-w4 and t194, which own `R/recovery/**` and `R/result-verification/**`.

- **`R/recovery/plan.ts:97`: add `temporary_action_sequence` to `action_target_override`.** Add it only when the
  failure category is `blocked_by_dialog` or `target_not_actionable`, or when the diagnosis names a covering layer, so
  "press the layer's close or decline, then the step" is a legal patch.
  - Tests in `R/recovery/tests/plan.test.ts`:
    - the new kind is allowed for `blocked_by_dialog`;
    - it is not allowed for a plain `target_not_found`.
  - Keep the test that pins the plan's kinds to the preflight's in agreement.
- **`R/recovery/refuted-result/reauthor.ts:79-89`: open the route on a failed step.**
  - The decision takes a new input, `failedStep?: { ladderApplied: boolean }`.
  - It routes a failed-step run whose ladder applied no patch.
  - Add the refusal `ladder_repaired` for the case where the ladder did apply a patch.
- **New directory `R/recovery/failed-step/`**, with files `entry.ts`, `brief.ts` and `index.ts`.
  - The history entry and brief for a failed step:
    - the failed node, its failure record's `expected` and `actual`;
    - the ladder's diagnosis words;
    - the exploration's action codes;
    - "a missing precondition (consent wall, covering card, a dialog's confirm) is a step to add before sN; a moved
      control is a step to re-point".
  - Mirror `refuted-result/brief.ts`, and reuse `purse.ts` and `history.ts`.
  - Tests in `R/recovery/failed-step/tests/*.test.ts`.
- **New `R/service/runtime-adaptation/failed-step-reauthor.ts`:** the port.
  - It calls `automationStudioReauthorRefutedResult` with `mode: "extend"`, spending from the same purse, then
    approves and applies.
  - It then calls `rerunAfterRepair({ from: "start" })` and `verifyAutomationStudioRuntimeSessionResult`, within
    `AUTOMATION_STUDIO_RESULT_REPAIR_MAX_ATTEMPTS`.
  - Test in `R/service/runtime-adaptation/tests/failed-step-reauthor.test.ts`. When the ladder ends `patch_failed`:
    - `generate` is called in extend mode with the brief;
    - the edit is applied and re-run from the start;
    - the purse bound holds, and a third failure stops.
- **`R/service.ts` (line-neutral where possible; the file is at 4,485 of 4,558):**
  - at `:2737` and `:2790`, when `retry?.session` is absent, call the new port before
    `automationStudioRunDetailWithDeclinedAdaptiveRetry`;
  - wire the port next to `repairRefutedResult` at `:2597`.
- **Integration test:** `R/tests/service-bootstrap/tests/failed-step-reauthor.test.ts` covers a scripted run that
  fails at s2 behind a consent layer and is re-authored with a consent step.

### Fix 4: a failed re-run re-enters repair (cause 4)

Core; serial after Fix 2, which it reuses, and after t194.

- **`R/result-verification/run-outcome.ts:330-342`:** when `rerun.session.status === "failed"`, call the failed-step
  path from Fix 2 through a new port `repairFailedRerun`, instead of settling `rerun_failed`, while attempts remain.
- **`R/recovery/refuted-result/history.ts`:** a history entry kind `rerun_failed`, so the convergence stop and
  `MAX_ATTEMPTS` count it.
- **`R/service.ts:2594-2596`:** pass the port.
  - Refresh `runResultCheck` there too, with `automationStudioRepairedRunResultCheck`, as `:2735` does. This also
    covers the C7 inconsistency in cause 12.
- **Tests:**
  - `R/result-verification/tests/run-outcome-rerun-failed.test.ts`: a failed re-run is repaired, and the bound holds;
  - `R/recovery/refuted-result/tests/history.test.ts`.

### Fix 6: the judge sees the end state (cause 6)

Core plus a small domain change; serial after t194 F8 and t200-w4.

- **`R/result-verification/contracts.ts` and `result-summary.ts`:** add `endState` to the summary:
  - the page the Flow ended on, as the domain's screened capture, with no element cap (t200's rule);
  - each attempted step's `actual` and effect words.
- **`R/result-verification/run-outcome.ts`:** fill `endState` from a new port, `observeEndPage`, before verifying.
- **`R/service.ts` `resultPorts` (at `:2588`):** add `observeEndPage` through `llmEvidenceRuntime`, the same
  capture `route-state/observe.ts` uses. One line.
- **`R/llm/harness/context-packet.ts`:** carry `endState` in the `loop_verification` packet.
- **`R/llm/harness/request-evidence-check.ts:115-122`:**
  - screen `endState`;
  - return a distinct code per failing condition: `llm.provider_result_summary_invalid.{no_denied_keys, credential,
    denied_key, too_large}`.
- **`R/llm/diagnosis-instructions.ts`:** one sentence: judge an act task by the end state against every instructed
  requirement.
- **Tests:**
  - `R/result-verification/tests/result-summary-end-state.test.ts`;
  - `R/llm/harness/tests/request-evidence-check.test.ts` (each code);
  - a verification test where an act task with a wrong cart comes back `does_not_answer` and is repaired.
- **Not recommended:** changing `agreement.ts` or `attempt.ts:82`. With evidence the judge can answer; without it,
  repairing on `unsure` repairs on nothing.

### Fix 10: route by verdict, not code (cause 10)

Core; serial with Fix 2, which edits the same file.

- **`R/recovery/refuted-result/reauthor.ts:84,92-97`:** route when the repair marker's verdict is `does_not_answer`,
  whatever its code.
- **`R/recovery/refuted-result/repair.ts:143,154`:** write `verdict` on the marker beside `code`.
- **Test:** `R/recovery/refuted-result/tests/reauthor-decision.test.ts`: `required_values_missing` and
  `every_record_refused` route.

### Fix 9: charge what a failed reply used (cause 9)

Core; t200-w3 owns `R/llm/deepseek/`, so this is serial.

- **`R/llm/deepseek/response-envelope.ts:33-43`:** parse usage first. On a structure failure, throw a provider error
  that carries `usage`.
- **`R/llm/harness/run.ts`:** charge the carried usage, not the reservation.
- **Tests:**
  - `R/llm/deepseek/tests/response-envelope.test.ts`;
  - `R/recovery/annotation/tests/run-budget.test.ts`: a malformed patch reply is charged its tokens.

### Fix 3: permission (cause 3)

Downstream; can run now, disjoint from Core.

- **Land t195-w14 as it stands.**
- **`apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts`:** add
  `permissionPoint: { consequence: "send_or_publish", control: "Post" }` to the three group-post tasks. The label
  "Post" is in the scenario source.
- **`apps/scenario-lab/src/scenarios/company-website/live-tasks.ts:29-30`:** add
  `{ consequence: "send_or_publish", control: "Send request" }` to both quote tasks.
  - The redesigned variant is also asked during repair at "Get my free quote". So widen `control` to
    `string | readonly string[]` in:
    - the scenario task type;
    - `packages/test-runner/src/flow-lane/creation/permission-point.ts:27` (`judgeCreatedFlowPermissionStop`).
- **Tests:**
  - `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`;
  - `packages/test-runner/src/flow-lane/creation/tests/permission-point.test.ts`, including a case for the list of
    controls.
- **Core, only on the supervisor's decision:** in `R/flow-bootstrap/action-permissions.ts:164-177`, key `asked` by
  class and control instead of once per build, so an early cookie or `create_new` ask does not use up the ask at the
  real act.
  - Tests: `R/runtime/tests/service-bootstrap/tests/permission-ask.test.ts`.

### Fix 1: a stall is a phase-3 turn, not the end (cause 1)

Core; serial after t196 and t200-w3, which both own `llm/evidence-loop*`. Coordinate with A1's fix for the stalls
themselves.

- **`R/llm/evidence-loop.ts:353-367`:** while budget, calls and deadline remain, the first stall does not return
  `stalled`. It gives the model one turn that shows the stall's issue codes and offers two answers:
  - amend as the refusal names;
  - declare `not_doable` with a closed reason and one sentence.

  A second stall, or an exhausted budget, ends the loop as now.
- **`R/llm/evidence-loop-decision.ts`:** a new decision kind, `not_doable`, with a closed reason:
  `needs_person | control_absent | site_refuses | permission_denied | other`.
- **`R/flow-bootstrap/generation-failure/{codes.ts, evidence-failure.ts}`:** a new ending,
  `flow_bootstrap.declared_not_doable`, with the reason, distinct from `evidence_unusable_decision`.
- **`R/service.ts:1558`:** map the new ending (on an existing line).
- **Tests:**
  - `R/llm/evidence-loop/tests/stall-turn.test.ts`: a stall with budget left gets one turn, a second stall ends, and a
    `not_doable` ends with its reason;
  - `R/flow-bootstrap/generation-failure/tests/*`.
- **Downstream:** the Lab records a declared not-doable as its own verdict, never a pass. Change
  `packages/test-runner/src/flow-lane/creation/lane.ts` and its tests.

### Fix 5: the re-author starts at the failing step and is tested (cause 5)

t196's files; hand this to t196, or do it after t196 merges.

- **`R/llm/loop-configuration.ts:222-237`:** an extend (repair) build's completion is tested like any draft. The repair
  phase may replay from the start.
- **`R/llm/evidence-loop/resume.ts`:** before a repair build's first decision, replay the seed up to the failing node,
  so exploration starts on the page where the failure happened.
- **Tests:** the extend-seed cases in `R/llm/evidence-loop/tests/resume.test.ts` and `completion-attempt.test.ts`.

## Conflicts with t196 and t200

- **t200 (Core tree clean; workers not started).**
  - w4 owns `R/recovery/**`, `R/result-verification/**` and `R/llm/harness/**`, the files of Fixes 2, 4, 6 and 10.
  - w3 owns `R/llm/{evidence-loop*, loop-configuration.ts, deepseek/}`, the files of Fixes 1, 5 and 9.
  - All of these must follow t200's merge.
  - t200 also removes the byte budget of cause 8 (`recovery/context.ts:261-272`, `context-budget/*`) and the result
    summary's 4,000-byte cap (`result-summary.ts:14-36`). Fix 6's `endState` must follow t200's no-cap rule.
- **t196 (uncommitted on its branch).** It edits:
  - `llm/evidence-loop.ts`, `evidence-loop/{completion-attempt,resume,progress-trace}.ts`;
  - `decision-handlers/completion.ts`, `loop-configuration.ts`;
  - `flow-draft/{dry-run,entry,index}.ts`, `node-tools/replay*.ts`, and a new `flow-draft/verify-only.ts`.

  Fixes 1 and 5 touch the same files and go after it. Its lifecycle comment in `completion-attempt.ts` makes the
  in-build dry run the phase-2 "test". The answer is still judged only at the first playback (`run-outcome.ts`), so
  phase 2's "judge" and phase 3's "repair" in this audit are the post-creation run.
- **t194 (round 2 WIP, not on dev).** It edits `result-verification/{read-account/*, result-summary.ts,
  run-outcome.ts, verdict.ts}` and `recovery/refuted-result/{brief,history}.ts`. Fixes 4, 6 and 10 go after it.
- **t195.** Its w14 is downstream only (`packages/test-runner/src/{person-simulation,flow-lane/creation}/**`,
  `run-scenario.ts`). Fix 3's `permission-point.ts` edit goes after w14.

## Commands run and observed results

- **Copied the union of debugs** into scratch (`a3dbg/`), lane copy winning. Result: 57 files. Five files differed
  from earlier copies, and the t195 copy was taken: `munq51ik`, `munsxchc`, `muntfume`, `muntu7in`, `munuj2os`.
- **Extracted every debug's Stage 5 and Stage 6 sections** with awk: 95 sections, all read.
- **Read the spend ledger** `lab-slots/spend-ledger.jsonl`. It has 5 finish rows, all `failed`: D $0.061, B $0.028,
  A $0.117, $0.080 and $0.070.
- **Read the two undebugged bundles' `flow-lane.json` and `summary.json`:**
  - `muogfred`: `permission.required: send_or_publish`, `permissionPoint: "no_point_declared"`,
    `action.kind: exploration_step`, 15 decisions;
  - `muohbi3e`: `flow_bootstrap.evidence_unusable_decision`.
- **Read the dev sources cited above** by line: `git -C !FluxIQ branch` gave `dev` at `25c8b32f`.
- **Checked which lane fixes are on dev** with `ls`:
  - present: `inherited-plan-nodes.ts` (F2), `own-extraction-list.ts` (F3), `recovery/context-budget` (F4),
    `refuted-result/purse.ts` (C3), `worstCaseCallCostUsd` (C4);
  - absent: `result-verification/read-account` (F8), `executor/tests/optional-failed-route.test.ts` (F11), the
    `priorAttemptCount` executor field (F12).
- **Listed the in-progress edits** in t196 (22 Core files, 3 domain files) and t195: `git status --short` and
  `git diff`, read-only.
- **t200's Core tree:** `git status --short` printed nothing, so it has no changes yet.
- **Tried `git stash list`, by mistake.** The hook refused it as history-changing. No state changed.

## Not verified

- **No Lab or model call was made.** Every fix above is unbuilt and untested.
- **Four runs have no debug.** A26, A31, B `muogfred` and A `muohbi3e` are classified from lane tables and bundle
  summaries only. `muohbi3e`'s stall cause is unknown.
- **The counts rely on lane tables for some runs.** For cause 1 and D's 12 permission "passes", the lane report tables
  were used, not per-run debugs. Many A and D runs (for example A23, A27, A30, A32, A33, D11, D13-D15) have no debug.
- **Several details are not recorded in the evidence:**
  - which of the four `sendableResultSummary` conditions refused A28;
  - what the patch contained in `muntmwvx` and `munwdydi`;
  - why C7's re-run recorded `authorization_absent`.
- **Fix 3's control labels are unconfirmed.** "Post" and "Send request" were found by grep in the scenario sources.
  Whether the site's accessible names match the control names Core records was not checked.

## Open questions or contradictions found

- **The "passed" label on D's permission stops is stale.** The lane D report (Tasks table: "bigbox pickup-order,
  passes in a row: 1 (run 16)"; run 16 "passed") still calls a permission stop a pass. Current State and dev
  (`f2f80024`) say it is `stopped_for_permission`, never a pass.
- **F10 conflicts with the tasks' own instructions.** The instructions ask to post, send a quote or withdraw. F10 asks
  every time anyway, and five tasks declare no point. A Lab rule of "deny where no point is declared" makes those tasks
  impossible to pass. Declaring the points (Fix 3) is the smallest reconciliation, and the supervisor should confirm
  it.
- **Is the build's dry run the user's phase-2 "test and judge"?** t196 makes it the phase-2 test. But the answer is
  judged only after creation, in the first playback, so phase 2's "judge" happens outside the build. The supervisor
  should confirm this is the intended split. If the judgement belongs inside the build, Fix 6's end state would also
  be needed at the build's test.
- **One observation is outside this audit's scope.** C7's Lab sat idle for 306 s after the re-run, and the
  re-author's $0.0425 was missing from `live-llm.json`. Those are Lab accounting and waiting issues (A4).
