# t249 report: a runtime patch is applied only after a judged whole run (Core)

Worker: t249-worker. Core tree `fxwork/t249/!FluxIQ`, branch `task/t249-ladder-full-judged-run`. Nothing committed.

## Outcome

Done, round 2 included. Items 1 to 3 of the brief are built, and so are follow-ups 1 to 3 from the supervisor's message
(on the tree at `c49b3e7a`):

1. A trial that runs the Flow to its end is now judged as the whole run.
2. Patches written by the ladder after a refuted result now get a whole-Flow re-run from the start.
3. A run that throws, or parks waiting on a person, now settles its pending patch unapplied with a reason code.

Every new test failed on the earlier code and passes now. The narrow checks all pass: 99 test files and 1,003 tests,
`pnpm --filter fluxiq check`, the structure audit, and the docs reference check.

One pre-existing defect sits on dev at `c49b3e7a` and is not caused by this work. A module cycle breaks
`unattended-retry-verification.test.ts` when that file imports the result-check modules before the service. Details
are under "Round 2".

## Round 2 (supervisor follow-up, 2026-10-02)

### 1. A trial that runs the Flow to its end is the whole run

- **Where the pass is kept.** When a trial runs the Flow to its end (`resumeFrom.completed`) on a patch the gate
  allows unattended, `recovery/annotation/patches.ts` keeps the trial's saved trace on that patch's receipt as
  `completedTrace`.
- **Adoption.** `repair-rerun.ts` (`from:"resume"`) receives `resume_point_completed`. If a receipt carries a
  trace, it adopts it as the resumed pass and runs nothing again:
  - the trace is appended to the run's own trace;
  - the session takes the trial's status;
  - `adaptiveRetry` records `{ trialCompleted: true, candidateAdaptationIds }`;
  - `completedTrace` is removed from the receipt.
- **Judging.** The run is then judged and settled on that verdict. The patch is applied only on `succeeded` with
  `answers`, and is never settled `not_rerun`. A completed-trial receipt with no trace (one written before this
  change) is still declined as before.
- **Attempt ids.** The trial now numbers its attempts after the run's own (`recovery/annotation/annotate.ts` passes
  `priorAttemptCount` into the trial's options). The adopted pass therefore never repeats an attempt id, which matters
  because the run store drops a repeated id.

### 2. Ladder patches after a refuted result get a whole-Flow re-run

- **The re-run gate.** A refuted result's repair is followed by a re-run from the start when its Flow was re-authored,
  or when it holds an untried patch. Untried means: allowed unattended, held for a judged run, and not yet run by any
  pass. This is `automationStudioRefutedResultRerunsFlow` in `recovery/refuted-result/reauthor.ts`.
  `run-outcome.ts` uses it to gate the re-run, and `repair.ts` uses it to write the `rerunning` phase.
- **The re-run, when the Flow was not re-authored.** In `repair-rerun.ts` (`from:"start"`):
  1. Settle only the patches an earlier pass already ran (`only:"ran"`), on that pass's ending (`refuted`).
  2. Run the whole Flow from its start on the candidate, which carries the untried patches, and record
     `repairedRerun.candidateAdaptationIds`.
  3. The result is judged, and the final settle applies the patch only on `answers`.
- **After a re-authoring.** Every pending patch is still settled first, unapplied, as before.
- **Nothing to run.** A start re-run that would change nothing declines with `repair_rerun.nothing_to_rerun`.
- **Moved state.** The decision-record readers moved to the new `durable-behavior/judged-decision.ts`:
  - `AUTOMATION_STUDIO_JUDGED_PROMOTION_APPLY_AT`
  - `automationStudioDecisionAwaitsJudgedRun`
  - `automationStudioRunCandidateAdaptationIds` (reads `adaptiveRetry` and `repairedRerun`)
  - `automationStudioRunHasUntriedPatch`

  The result verification and the refuted-result repair can read these without importing the service layer.

### 3. A run that throws, or parks waiting on a person

- **Parked runs.** A `waiting` session now settles as `run_parked` (`automationStudioJudgedPromotionOutcome`).
- **Thrown runs.** `endAutomationStudioRuntimeSessionAfterThrow` (`service/runtime-session/ending.ts`) has a new
  `settleAfterThrow` port, and the service binds it. It runs after the session is marked failed, whatever state the
  session was in, and settles every pending patch as `run_errored`. If the settle itself fails, the caller's error is
  returned inside an `AggregateError` together with the settle's error.
- **Where the reason is written.** Both reasons go on the adaptation and on the receipt.
- **Can a later resume or answer still settle it? No; the settle is final.** No Core path continues a parked run:
  `resumeAutomationStudioGraph` has no caller in Core, and a waiting run is only expired or cancelled. A
  continuation would also resume the stored Flow, not the candidate, so it could not be the judged whole run for the
  patch. The adaptation stays `validated` and a person can apply it through review.
- **Line budget.** `service.ts` stays at 4,420 lines. The ports are shared as one `judgedPorts` line before the
  `try`, and the old comment line was folded onto it.

### Round 2 changes

**Implementation:**
- `durable-behavior/judged-decision.ts` (new), and `durable-behavior/index.ts`
- `service/runtime-adaptation/judged-promotion.ts`: reads the moved state; adds `run_parked` and `run_errored`; adds
  the `only` and `reason` options; strips `completedTrace` from settled receipts
- `service/runtime-adaptation/repair-rerun.ts`: adopts a completed trial; re-runs untried ladder patches from the
  start; settles earlier passes first
- `service/runtime-adaptation/runtime-promotion.ts`: imports the constant from its new place
- `recovery/annotation/patches.ts`: keeps `completedTrace` on the receipt
- `recovery/annotation/annotate.ts`: the trial's `priorAttemptCount`
- `recovery/refuted-result/reauthor.ts`, `repair.ts`, `result-verification/run-outcome.ts`: the re-run gate
- `service/runtime-session/ending.ts`: `settleAfterThrow`
- `service.ts`: `judgedPorts` and the `settleAfterThrow` binding

**Docs:** `docs/architecture/automation-studio.md`, `docs/reference/framework-reference.md` (regenerated).

**New failing-first tests.** On the checkpoint code, 12 failed and the other 36 in those files passed:
- `tests/service-adaptation/tests/judged-promotion.test.ts`, 3 tests:
  - judges a trial that ran the Flow to its end as the whole run, and keeps the patch when it answers
  - leaves such a trial unapplied (`refuted`) when its run is refuted, never as not re-run
  - re-runs a patch the refuted result's repair wrote from the Flow's start, and keeps it when that run answers
    (verdicts no, no, yes; 3 judge calls)
- `service/runtime-adaptation/tests/repair-rerun.test.ts`, 4 tests:
  - runs an untried patch as the candidate of a whole-Flow re-run
  - settles the earlier pass's patch first
  - declines `nothing_to_rerun`
  - adopts a completed trial, running nothing again

  A 5th new test there, "still declines a completed trial whose receipt carries no pass", is a guard that passes on
  both versions.
- `service/runtime-adaptation/tests/judged-promotion.test.ts`, 3 tests:
  - `run_parked` outcome
  - parked settle on the adaptation and the receipt
  - `run_errored` settle, which also strips `completedTrace`
- `service/runtime-session/tests/ending.test.ts`, 2 tests:
  - write first, then settle, for any state
  - a settle that fails joins an `AggregateError` and the session is still marked failed

  A 3rd new test there, "settles nothing for a session that is no longer stored", passes on both versions.

**Existing tests rewritten to the new rule:**
- `repair-rerun.test.ts`:
  - "settles a pending patch unapplied before a re-run from the start…" now sets up a re-authored Flow.
  - "settles a patch no resumed pass ran as never re-run" is now "…when the Flow was re-authored". Without
    re-authoring, that patch is now run.
  - The test helper now defaults a start re-run to a re-authored Flow, so the older re-authored-Flow cases are
    unchanged.
- `judged-promotion.test.ts` (service unit): "leaves a patch waiting while its run has not finished" and "changes
  nothing while the run is still waiting on a person" now expect `run_parked`; `running` still waits.
- `tests/service-adaptation/tests/judged-promotion.test.ts`: in the refuted case, later patches are now refuted on
  their own re-run rather than `not_rerun`.
- `tests/service-adaptation/tests/unattended-retry-verification.test.ts`: "fails the run when the repair produced
  another wrong answer…" expected exactly 2 judge calls. It now expects more than 2, in pairs, all
  `loop_verification`. In this harness it took 6, because the ladder's patch is re-run and judged again.

### Pre-existing on dev: a module cycle

- **Symptom.** With the earlier code restored on `c49b3e7a`, `unattended-retry-verification.test.ts` fails all 8 tests
  with `TypeError: automationStudioLlmResolutionWithinFlowSettings is not a function`, thrown at
  `recovery/annotation/annotate.ts:252`.
- **Cause.** The test imports `result-check-authorization/` and `result-check-schedule/` before `service.ts`. Under
  vitest's module loader, a module cycle that came in with the dev merge (t244/t250) leaves that binding undefined.
  Importing the service first makes it pass.
- **What I did.** I moved the service import to the top of that test file, with a comment saying why. That is a
  workaround, not a fix. The cycle itself is unowned and should be found and broken.

## Design as built

### The real path, before

`runRuntimeSession` (`R/service.ts`) runs the Flow from its start. When a step fails, the run is annotated through
`maybeAnnotateRunDetailWithRuntimeLlm`, which calls `annotateAutomationStudioRunDetailWithRuntimeLlm`. Inside that,
`applyAutomationStudioRuntimeRecoveryPatches` (`R/recovery/annotation/patches.ts`) calls
`executeAutomationStudioRuntimePatch`. That function trials the patch on a throwaway copy from the changed node
(`R/flow-change/trial.ts`) and saves the adaptation. It then calls the `promoteRuntimeAdaptation` port, which is
`maybePromoteRuntimeAdaptation`. That method decided the gate and, on `autoApply`, called
`reviewFlowAdaptation({action:"apply"})` on the spot, so the stored Flow changed mid-run. After that,
`rerunAfterRepair({from:"resume"})` read the stored Flow back, which by then held the patch, and resumed it at the
trial's `resumeFrom`. Only after all of that did `verifyAutomationStudioRuntimeSessionResult` judge the run.

### The order now

1. **Decide, record, never apply.** `maybePromoteRuntimeAdaptation` is now a 3-line delegate to
   `promoteAutomationStudioRuntimeAdaptation` (new, `R/service/runtime-adaptation/runtime-promotion.ts`). The body
   moved there unchanged except for the end. A decision that allows an unattended apply now records
   `autoApply: true, applyAt: "judged_whole_run", applied: false, runId` and returns without applying.
2. **The resume runs the unapplied candidate.** In `rerunAutomationStudioSessionAfterRepair` (`repair-rerun.ts`),
   `from:"resume"` reads the stored Flow and writes every pending patch of this run onto it in memory with
   `automationStudioJudgedPromotionCandidate` (`judged-promotion.ts`). Pending means the stored adaptation still has a
   held decision for this run. The patch is written by the same function an apply uses: the new
   `automationStudioGraphFlowWithAdaptationPatch` (`R/service/adaptations/graph-flow-patch.ts`). The durable appliers
   in `patches.ts` now call it too, so the candidate and a later apply cannot disagree.
   - `edit_recovery` has no durable form. It changes nothing in the candidate, and its later apply is refused and
     recorded as before.
   - The pass records `adaptiveRetry.candidateAdaptationIds`.
   - An unreadable pending patch declines the resume with `repair_rerun.candidate_unreadable`. One that cannot be
     written onto the Flow declines it with `repair_rerun.candidate_unwritable`.
   - The verification is handed the candidate document.
3. **Judge, then settle.** Each of the three verify returns in `runRuntimeSession` is wrapped in a local `judged(...)`.
   It calls `settleAutomationStudioRunJudgedPromotions`, which reads the run detail, settles each pending adaptation,
   writes the decision onto the adaptation and onto any receipt the run still holds, and saves the detail. The rule
   lives in `automationStudioJudgedPromotionOutcome`:
   - The patch is applied only when all of these hold: the run ended `succeeded`, the verdict was performed and is
     `answers`, and the resumed pass ran the patch. The apply goes through `reviewFlowAdaptation` with
     `actorId: "runtime"`, so the promotion gates run on it again.
   - Otherwise the patch stays unapplied with `notAppliedReason`, one of: `not_rerun`, `run_cancelled`,
     `run_failed`, `refuted` (any performed verdict other than `answers`), `not_judged`, or `apply_failed`.
   - Every settled decision carries `judgedRunId` and `settledAt`.
   - A run that is still `waiting` or `running` settles nothing.
4. **The re-run from the start settles first.** `from:"start"` follows a re-authored Flow, from the refuted-result or
   failed-step route. Before it runs, it settles any patch still pending as unapplied, using the outcome of the
   session it is re-running: `refuted`, `run_failed` or `not_rerun`. It never carries an old patch onto a re-authored
   graph.

Settling reads the run's `adaptationIds` together with the receipt ids, and checks each stored adaptation's decision.
I found that this is needed. In the refuted case, the refuted result's own repair runs the ladder again and replaces
`runtimePatchAttempts` with its own receipts. The first patch's receipt is gone, but the patch is still in
`adaptationIds`. The integration test caught this before the fix.

### Which run is the judged whole run, and why

The judged whole run is the trialling run itself. Its first pass ran from the start to the failing step. The resume
of the candidate keeps the same run id and continues from the trial's resume point to the end.

- The steps before the patched one are identical in the candidate and the stored Flow, and everything after it ran on
  the candidate.
- `repair-rerun` does have a whole-Flow re-run (`from:"start"`), but it only follows a re-authored Flow, never a
  runtime patch.
- Re-running from the start after an apply would repeat every lasting effect the run already had. That is the reason
  the resume exists (`adaptive-retry.ts`, `resume_point_completed`).

### How apply, persistence and later reuse flow now

Before the settle, the stored Flow is never written for a runtime patch. The adaptation is saved twice before then:
first at the trial (`saveFlowAdaptation`), then with the deferred decision. The run receipt carries a copy of the
decision.

At the settle, an `answers` verdict leads to two steps. The decision is saved with `applied: true`, and then
`reviewFlowAdaptation` applies it. That apply runs the durable patch, records `applicationRecord`, and stamps
`appliedAdaptationIds` and `stabilityReset` on the Flow. If the apply throws, the decision is re-saved with
`applied: false`, `notAppliedReason: "apply_failed"`, `autoApplyFailed` and the error. Any other ending saves
`applied: false` with the reason.

Reuse is unchanged in kind:
- Only an applied patch is on the stored Flow, so only it runs in later runs, is replayed by zero-provider runs
  (`recordAdaptationReplays`), and counts toward `knownAdaptationMatches` with status `applied`.
- "Changed durable behavior" is now `automationStudioDecisionAppliedAutomatically` (`R/durable-behavior/`):
  `autoApply === true && applied !== false`. Decisions from before this change carry no `applied` field and still
  count. `conversions.ts` uses the same predicate.
- An unapplied adaptation keeps `validated` and its trial evidence, and stays manually appliable.
- The gate's reason text now says the apply waits for the judged run.

### Executor (item 2)

- `AutomationStudioGraphExecutionOptions.stopAfterNodeId` and `AutomationStudioGraphExecutionTrace.stopReason`
  (`"stopped_at_node"`) are in `executor/contracts.ts`.
- `executor/partial-run/stop-after-node.ts` is new, with a barrel. It had to be a subdirectory because the
  `executor/` directory would otherwise have hit the 26 > 25 file limit.
- `graph-run.ts` asks the stop rule before every move out of a node. Once the stop node has run, the run ends
  `succeeded` with `stopReason`, with no outgoing edge followed, by any of these ways out:
  - its edge for the route it took;
  - its failed route (an `executableFailedEdge`);
  - a continuation past a failure;
  - its declared skip;
  - a forward state route.
- It also stops at a stop node that has no outgoing edge, where a whole run would fail.
- Composition with t243 state routing:
  - A state route from another node to a node strictly past the stop node stops the run. "Strictly past" means
    reachable from the stop node with no way back to it.
  - A backward route from the stop node is followed.
  - A route onto the stop node runs it.
- `runCanonicalAutomationStudioFlow` strips `stopAfterNodeId` from Call Flow child options, as it strips
  `startNodeId`. Nothing calls it yet.

### Docs (item 3)

In `docs/architecture/automation-studio.md`:
- New section "Applying a runtime patch waits for a judged whole run": the order, the reasons, why the trialling run is
  the judged run, and reuse.
- New partial-run paragraph after the start-node rules.
- Rewrote the "Automatic promotion" and "retry after a patch" bullets.
- Replaced the stale paragraph that said the retry starts from the graph's start.

`docs/reference/framework-reference.md` was regenerated.

## Changes and why

Core paths, under `packages/fluxiq/src/programs/automation-studio/runtime/` unless shown otherwise.

**Item 1: implementation.**
- `service.ts`: promotion became a delegate; added the rerun promotion ports; added the `judged` settle on every
  verify return; removed unused imports. The file is now 4,421 lines, down from 4,489.
- `service/runtime-adaptation/runtime-promotion.ts` (new): the decision, moved out of the service, with the apply
  deferred.
- `service/runtime-adaptation/judged-promotion.ts` (new): the rule, the candidate and the settle.
- `service/runtime-adaptation/repair-rerun.ts`: the resume runs the candidate; the start re-run settles first; records
  `candidateAdaptationIds`; two new decline codes.
- `service/runtime-adaptation/index.ts`: barrel exports.
- `service/adaptations/graph-flow-patch.ts` (new): the one in-memory patch writer.
- `service/adaptations/patches.ts`: now uses it (no behaviour change).
- `service/adaptations/index.ts`: barrel.
- `durable-behavior/durable-behavior-changed.ts`: added `automationStudioDecisionAppliedAutomatically`.
- `service/summaries/conversions.ts`: uses that predicate.
- `training-modes.ts`: gate reason text.

**Item 2: implementation.**
- `executor/contracts.ts`: the option and the trace field.
- `executor/partial-run/{index,stop-after-node}.ts` (new).
- `executor/graph-run.ts`: the stop checks at each move.
- `composite-executor.ts`: root only.

**Item 3: docs.** `docs/architecture/automation-studio.md`; `docs/reference/framework-reference.md` (regenerated).

**New tests (failing-first).**
- `executor/tests/stop-after-node.test.ts`: 9 tests. Before the implementation, 8 failed and 1 passed (the
  no-stop-node baseline).
- `tests/composite-executor.test.ts`: +1 test, "stops the root graph after its stop node…". It failed before the
  root-only strip because the child trace had `stopReason`.
- `service/runtime-adaptation/tests/repair-rerun.test.ts`: +4 tests, all of which failed on the original code:
  - resumes on the candidate…
  - declines… candidate_unwritable
  - settles… before a re-run from the start
  - settles a patch no resumed pass ran as never re-run
- `tests/service-adaptation/tests/judged-promotion.test.ts`: 3 tests, all of which failed on the original code. The
  first failed with `expected [ 2 ] to deeply equal [ undefined ]`: the patch was already on the stored Flow when the
  judge was asked.
- `service/runtime-adaptation/tests/judged-promotion.test.ts`: unit tests for the new module. They were written after
  the module, so they are not failing-first.
- `durable-behavior/tests/durable-behavior-changed.test.ts`: +1 case.
- `service/summaries/tests/conversions.test.ts`: +2 assertions.

**Existing tests rewritten to the rule (none deleted).**
- `tests/service-adaptation/tests/adaptive-loop.test.ts`:
  - "auto-applies validated low-risk runtime adaptations and records approval decisions" is now "allows a validated
    low-risk runtime adaptation unattended, and leaves it unapplied when nothing judged the run that ran it". It
    expects `validated`, `applied:false`, `notAppliedReason:"not_judged"` and the stored graph unchanged.
  - "completes an adaptive runtime loop and makes the next run deterministic" is now "completes an adaptive runtime
    loop, keeps the patch once the repaired run is judged to answer, and makes the next run deterministic". It now has
    a standing-authorization judge, and the interventions list includes the result check's `diagnosis`.
- `tests/service-adaptation/tests/promotion-tier.test.ts`: "applies a change whose trial succeeded, and records its
  tier" is now "allows a change whose trial succeeded unattended, holds the apply for its run's judged end, and
  records its tier".
- `tests/training-modes.test.ts`: the gate reason string, in "decides adaptation auto-promotion policy for safe,
  manual, structural, destructive, and first-review gates" and in "promotes an adaptation from the confidence tier its
  trials and replays earn".

## Commands and observed output

### Round 2 (on the merged tree at `c49b3e7a`)

All commands ran in the Core tree through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t249 …"`.

- **Failing first.** I backed up the 11 changed implementation files, restored them from HEAD, and ran `npx vitest
  run` on the service `judged-promotion.test.ts`, `repair-rerun.test.ts`, the unit `judged-promotion.test.ts` and
  `ending.test.ts`. Result: `Test Files 4 failed (4); Tests 12 failed | 36 passed (48)`. I restored my files and
  re-ran the same set: `Tests 48 passed (48)`.
- **The cycle, with HEAD code.** `unattended-retry-verification.test.ts` gave `8 failed`, each with
  `TypeError: automationStudioLlmResolutionWithinFlowSettings is not a function`.
- **The cycle, service imported first, with my code.** `7 passed, 1 failed`. The one failure was the
  exactly-2-calls test (6 calls); it was then rewritten.
- **Type check.** `pnpm --filter fluxiq check`: no errors.
  `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store …"}`
- **Narrow tests.** `npx vitest run` over:
  - `R/tests/service-adaptation`
  - `R/tests/service-flows/tests/{creation,representation}.test.ts`
  - `R/tests/{training-modes,live-patch,live-patch-target-override,composite-executor}.test.ts`
  - `R/tests/refuted-result`, `R/recovery/refuted-result/tests`, `R/result-verification/tests`
  - `R/durable-behavior/tests`, `R/service/summaries/tests/conversions.test.ts`
  - `R/service/runtime-adaptation/tests`, `R/service/runtime-session/tests`, `R/service/adaptations/tests`
  - `R/recovery/annotation/tests`, `R/executor/tests`

  Result: `Test Files 99 passed (99); Tests 1003 passed (1003)`, in 73.9 s.
- **Structure audit.** `node scripts/structure-audit.mjs`: `structure-audit: passed (222 warning(s), 349 baselined)`.
- **Docs reference.** `node scripts/docs-reference.mjs --check`: first stale. I ran `pnpm docs:reference` (3,010
  public declarations), and the re-check printed `Deterministic framework reference is current.`

### Round 1

All commands ran in the Core tree through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t249 …"`.

**Item 2, failing first.**
- `npx vitest run …/executor/tests/stop-after-node.test.ts`, before the implementation: `Tests 8 failed | 1 passed (9)`.
- `npx vitest run …/tests/composite-executor.test.ts`, before the root-only strip: `1 failed | 5 passed (6)`.
  `expected {…} to not have property "stopReason"`.

**Item 1, failing first.** I backed up the implementation files to the scratchpad, restored the HEAD versions, and
ran `npx vitest run …/tests/service-adaptation/tests/judged-promotion.test.ts
…/service/runtime-adaptation/tests/repair-rerun.test.ts`. Result: `Test Files 2 failed (2); Tests 7 failed | 7 passed
(14)`. All 7 new tests failed, and the 7 pre-existing repair-rerun tests passed. I then restored my files.

**Final checks.**
- `pnpm --filter fluxiq check`: tsc finished with no errors.
  `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored in the shared store …"}`
- Narrow tests:
  `npx vitest run R/tests/service-adaptation R/tests/service-flows/tests/creation.test.ts
  R/tests/service-flows/tests/representation.test.ts R/tests/training-modes.test.ts R/tests/live-patch.test.ts
  R/tests/live-patch-target-override.test.ts R/tests/refuted-result R/durable-behavior/tests
  R/service/summaries/tests/conversions.test.ts R/service/runtime-adaptation/tests R/service/adaptations/tests
  R/recovery/annotation/tests R/executor/tests R/tests/composite-executor.test.ts`
  gave `Test Files 74 passed (74); Tests 741 passed (741)`, in 81.6 s.
  - Before the rewrites, the same set gave exactly 5 failures: the 5 old-behaviour tests named above.
  - The `R/tests/service-*` files included are every one that greps for `runtime_patch`, `promot`, `adaptiveRetry` or
    `approvalDecision`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (219 warning(s), 349 baselined)` and `1 baseline
  entries can be lowered`.
  - That entry is the `service.ts` file-lines ratchet, 4,489 down to 4,421.
  - The first run failed `[directory-files] executor/: 26 source files` before the move into `partial-run/`.
- `node scripts/docs-reference.mjs --check`: it first threw `docs/reference/framework-reference.md is stale`. I ran
  `pnpm docs:reference`, which wrote 2,987 public declarations, and the re-check printed
  `Deterministic framework reference is current.`

## Not verified

- **No live runs, and no full suites** (per the brief). Neither Core's whole vitest run nor `pnpm check` was run.
- **The downstream extension and Lab were not run.** The extension reads `durableBehaviorChanged`, which is now true
  only after the judged apply. The Lab may have assumed a mid-run apply.
- **The web app's Adaptations view was not updated.** It still shows "Automatically allowed" and does not yet show
  `applied` or `notAppliedReason`.
- **The thrown and parked settles are tested at unit level only.** They are covered through `ending.ts` and
  `judged-promotion.ts`. The service wiring (`settleAfterThrow`, and the parked outcome through `judged(...)`) is
  checked by the type checker, not by a service-level run that throws or parks.
- **The completed-trial adoption is exercised only on a single-node Flow.** That is the shape in which a mid-Flow
  trial can run to the end, because the trial's own run must visit every node or end at an End node.
- **The supervisor lowered the `service.ts` baseline to 4,420.** The file is still at 4,420.

## Open questions or contradictions found

1. **Resolved in round 2:** a trial that runs the Flow to its end is adopted and judged.
2. **Follow-up, left out of scope at the supervisor's instruction: the reroute edge port.** For `temporary_reroute`
   the trial adds a `success` edge (`live-patch.ts`). The durable apply, and therefore the candidate, add a `failed`
   edge (`service/adaptations/graph-flow-patch.ts`, used by `patches.ts`). This mismatch existed before this task.
3. **Resolved in round 2:** a refuted result's ladder patches get a whole-Flow re-run from the start and are judged.
   - In the all-refuted harness the run cost 6 judge calls instead of 2. The repair's own bound
     (`AUTOMATION_STUDIO_RESULT_REPAIR_MAX_ATTEMPTS`) and its convergence stop are what limit this. Each extra pass
     also replays the Flow's lasting effects from the start; that is the same trade the re-authored re-run already
     made.
4. **The judgement is recorded against the stored revision, not the candidate.** The flow-version judgement row names
   the stored graph revision that the candidate was built on. Traceability to the patch is through
   `adaptiveRetry.candidateAdaptationIds`.
5. **Steps after the changed node run twice.** The trial runs from the changed node to the end, and the resume runs
   again from the node after it. This existed before this task; `stopAfterNodeId` is the seam a later step could use
   to stop the trial at the changed node.
6. **Pre-existing: the dev module cycle** described under "Round 2". The fix is unowned.
