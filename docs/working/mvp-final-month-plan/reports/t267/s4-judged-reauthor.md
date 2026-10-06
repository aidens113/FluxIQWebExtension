# t267 S4: a re-authored Flow is kept only after a judged whole run (blocker 5)

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t267/!FluxIQ`,
branch `task/t267-adaptation-loop-unblock`. Nothing committed. C2's uncommitted
changes were left as they were. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. The lead's design is implemented. Two additions it needed are described
below under "Deviations".

- **Hold.** Both re-author routes now approve and hold their extend-mode edit. The build no longer applies it.
- **Candidate.** A `from: "start"` re-run runs the held graph unapplied, or applies the edit first (`appliedBeforeJudged`) when the held topology is a shape that cannot be run as one graph.
- **Settle.** The run's judged end applies the held edit only when the pass that ran it ended `succeeded` with a performed `answers` verdict. Otherwise the edit stays validated and unapplied, and `notAppliedReason` is recorded.
- **service.ts** is 4,399 lines (was 4,400), with no new class method.

## What changed and why

### Hold (`R/recovery/refuted-result/`)
- `reauthor.ts`:
  - `automationStudioReauthorRefutedResult` takes either `hold: true` (approve and stop, answer `{ adaptationId, held: true }`) or `apply` (the old behaviour). The input is a discriminated union.
  - `automationStudioRefutedResultReauthored` records `held: true` on the latest fields and on the attempt.
  - `automationStudioRefutedResultFlowWasReauthored` is now `applied === true || held === true`, so both routes still re-run. The four callers are unchanged: `run-outcome.ts:358/426` via `RerunsFlow`, `repair.ts:172`, `repair-rerun.ts` and `step-failure-port.ts`.
  - The "Why this applies itself" comment was rewritten as "Why this approves itself" plus a new "Why it no longer applies itself in the run (`hold`, t267)".
- New `held-reauthor.ts` holds the held-marker helpers. They were split out of `reauthor.ts`, which had reached 11 exported values and 402 lines (advisory limits are 8 and 400):
  - `automationStudioRefutedResultHeldReauthor`: the latest held edit still waiting.
  - `automationStudioRefutedResultWaitingReauthors`: every held edit still waiting.
  - `automationStudioRefutedResultReauthorMarked`: writes fields onto the latest record and onto the matching attempts.
  - "Waiting" means `held` is set, `applied` is not, and there is no `notAppliedReason`.
- `index.ts`: one barrel line added.

### Build (`R/service/runtime-adaptation/reauthor-build.ts`)
- Uses `hold: true` for both routes.
- `AutomationStudioReauthorBuildDependencies` drops `apply` and adds `reject` (see Deviation 1).
- Before a new attempt builds, any earlier held edit still waiting is rejected (`runtime.result_repair`) and marked `notAppliedReason: "superseded"`. A refused rejection is recorded as `rejectRefused: "refused" | "store_unavailable"`, as a code with no message.

### Candidate (`repair-rerun.ts`, new `held-candidate.ts`)
- When the latest marker is held and waiting, `automationStudioHeldReauthorCandidate` reads the held adaptation through the new port `getFlowBootstrapAdaptation`. It must still be `validated`; otherwise the pass declines with `repair_rerun.held_reauthor_unreadable`.
- The held graph is used unapplied only when all of these hold:
  - `input.subflowId` is set;
  - the topology has exactly one subflow, with that `subflowId`;
  - that subflow's `graphFlowId` and `graphFlow.flowId` equal the selected subflow's `graphFlowId`;
  - every router rule targets the subflow, and so does a subflow fallback if there is one.
- Ownership is checked as `changedFlow` checks it, and a mismatch throws.
- Any other shape takes the fallback: apply first through the new port `applyFlowBootstrapAdaptation`, record `{ applied: true, appliedBeforeJudged: <code> }` on the latest record and the matching attempt, then re-run the stored Flow.
  - Fallback codes: `no_selected_subflow`, `not_one_subflow`, `other_subflow`, `other_graph`, `router_routes_elsewhere`.
  - A refused apply declines the pass with `repair_rerun.held_reauthor_apply_failed`.
- A pass that ran a held edit records `heldReauthorAdaptationId` on the session metadata and on `repairedRerun` in the detail. A pass that ran none clears an earlier pass's value from the session.
- The graph version recorded for that pass is the candidate's (revision `null`), not the stored revision it did not run.
- `held-candidate.ts` answers `{ unreadable: <key> }`, and `repair-rerun.ts` maps the key to its own `UNREADABLE` codes. This keeps every decline code in one place with no import cycle.

### Settle (new `R/service/runtime-adaptation/judged-reauthor.ts`)
- `settleAutomationStudioRunJudgedReauthor({ ports, projectId, flowId, session })` runs from the `judged` closure, before the runtime-patch settle. The underlying `settleAutomationStudioJudgedReauthor` is also exported.
- Outcomes:
  - The latest waiting held edit is settled with `automationStudioJudgedPromotionOutcome(session, ranIt)`, where `ranIt` means the session's `heldReauthorAdaptationId` equals the edit.
  - `apply` goes through `reviewFlowBootstrapAdaptation({ action: "apply", actorId: "runtime.result_repair" })`, then `applied: true, judgedRunId, settledAt` is written on the latest record and the matching attempt, and the detail is saved.
  - Any other outcome writes `notAppliedReason` and leaves the adaptation validated.
  - Every other waiting held edit gets `superseded`.
- It is not gated on `promoteAdaptations`.
- Edge cases:
  - A run that ended `succeeded` without running a held edit has its record left unread (t258).
  - A store-unavailable error on read returns the session unchanged, with nothing applied.
  - A store-unavailable error on save is noted on the session as `judgedReauthorSettlement`.
  - An apply failure records `apply_failed` or `store_unavailable`, as codes only.
- Deviation 2: a pass that ran the held edit and whose own trace did not succeed is `run_failed`, whatever verdict the session carries.

### service.ts (folds only; 4,400 → 4,399 lines)
- Line 280: the import gains `settleAutomationStudioRunJudgedReauthor`.
- `rerunAfterRepair`: `getFlowBootstrapAdaptation` and `applyFlowBootstrapAdaptation` were folded onto the existing `saveFlowRunDetail` line.
- `judgedPorts`: gains `applyFlowBootstrapAdaptation`.
- Result-repair ports: `apply` was removed and `reject` folded onto the `approve` line. This is the saved line.
- `judged`: now `settleAutomationStudioRunJudgedPromotions({ ..., session: await settleAutomationStudioRunJudgedReauthor({ ... }) })`.

### Docs
- `docs/architecture/package-boundaries.md` has a new unreleased entry, placed after C2's.
- Both generated copies of `framework-reference.md` were regenerated with `node scripts/docs-reference.mjs`.

### Tests
New:
- `R/recovery/refuted-result/tests/held-reauthor.test.ts`: 5 tests.
- `R/recovery/refuted-result/tests/reauthor.test.ts`: 4 tests added (hold mode, a refused approval under hold, held recorded, `FlowWasReauthored` false after a failed later attempt).
- `R/service/runtime-adaptation/tests/judged-reauthor.test.ts`: 14 tests (apply; refuted / run_failed / not_judged / not_rerun ×2 / run_cancelled; the stale-verdict run_failed; superseded; apply_failed; store_unavailable; no read for a run that answered; no flowId or nothing held; read unavailable; save unavailable).
- `R/service/runtime-adaptation/tests/held-candidate.test.ts`: 6 tests (held graph run unapplied and named; fallback ×3 with its code; declined when unreadable or no longer validated; earlier name cleared).
- `R/service/runtime-adaptation/tests/reauthor-build.test.ts`: 3 tests added (build holds; earlier held edit rejected then superseded before the new build; refused rejection recorded as a code).
- `R/tests/service-adaptation/tests/judged-reauthor.test.ts`: 3 tests against the real service, using the caller-paid harness:
  - **answers**: the stored graph's owner was `null` at both dispatches, so the re-run executed the held graph unapplied. `heldReauthorAdaptationId` is on the session and on `repairedRerun`. Afterwards the marker shows `applied: true`, the adaptation is `applied`, and the stored graph carries the adaptation id.
  - **refuted**: every dispatch ran on the unchanged stored graph. More than one adaptation was built; the earlier ones are `rejected` and the last stays `validated`. Stored nodes and edges are unchanged. The latest record is `refuted` and earlier ones are `superseded`.
  - **re-run fails**: the stored graph is unchanged, the adaptation stays `validated`, and the reason is `run_failed`.

Updated because they assumed apply-before-run:
- `reauthor-build.test.ts`: the `apply` dependency was removed. "never rebuilds ... when %s fails" now covers approve only. `built.applied` became `built.held`.
- `step-failure-port.test.ts`: `apply` is kept only as a sentinel that is never called. The marker now shows `held: true`, and the approve count replaces the apply count.
- `refuted-result-port.test.ts`: the `apply` dependency was removed. Three marker assertions changed from `applied: true` to `held: true`, and the first test asserts the approval.
- `R/tests/refuted-result/tests/failed-step-reauthor.test.ts`: `apply` is a never-called sentinel, `reject` was added, and the marker shows `held: true`. This file is outside the named test list. It was the only service-level test that failed after the change.
- `repair-rerun.test.ts`: its harness moved to `tests/repair-rerun-harness.ts`, which is shared with `held-candidate.test.ts`. The harness gained the two bootstrap ports and a selectable subflow. The existing tests are unchanged.

## Deviations from the design, and why

1. **A later attempt rejects the earlier held edit.** The first service-level run showed attempt 2 failing with `flow_bootstrap.pending_adaptation_exists`. `generateFlowBootstrapAdaptationInternal` refuses to build while any adaptation is `proposed` or `validated` (`R/service.ts` about line 1492), and a held edit is `validated`. Under hold, every second repair attempt of a run would therefore build nothing. The brief requires a "later attempt replaced" outcome, so the earlier waiting edit is rejected and marked `superseded` before the new build. Rejection is through review, with actor `runtime.result_repair`. This needed a `reject` dependency, folded into service.ts at no line cost.
2. **A failed pass is `run_failed`.** `repair-rerun.ts` carries the run's session metadata forward, so a failed re-run's session still holds the first pass's `resultVerification: does_not_answer`. On its own, `automationStudioJudgedPromotionOutcome` therefore returned `refuted` for a re-run that failed. The settle now checks the pass's own trace first. I did not change what the session carries.

## Commands run and observed results

All commands ran in the Core worktree.

- **Baseline, before any edit.** `npx vitest run R/recovery/refuted-result R/service/runtime-adaptation R/service/adaptations R/tests/service-adaptation R/tests/service-bootstrap R/result-verification R/tests/refuted-result` printed "Test Files 100 passed (100), Tests 787 passed (787)", exit 0.
- **Brief command, run 1.** `npx vitest run R/recovery/refuted-result R/service/runtime-adaptation R/service/adaptations R/tests/service-adaptation R/tests/service-bootstrap R/result-verification` printed "Test Files 2 failed | 96 passed (98), Tests 2 failed | 787 passed (789)", exit 1.
  - Both failures were 15 s timeouts: `tests/service-adaptation/tests/subflow.test.ts` ("writes a typed owned-graph adaptation ...") and `tests/service-bootstrap/tests/adaptation.test.ts` ("bridges a generated proposal ID ...").
  - Re-run alone, both files passed (14/14). Those two tests took 942 ms and 1206 ms, so the failures were load timeouts. Neither test re-authors.
- **Brief command, run 2:** "Test Files 98 passed (98), Tests 789 passed (789)", exit 0.
- **Brief command, run 3:** "Test Files 98 passed (98), Tests 789 passed (789)", exit 0.
- **Outside the brief's list.** `npx vitest run R/tests/refuted-result R/activity` printed "Test Files 27 passed (27), Tests 225 passed (225)", exit 0.
- `node scripts/build-cache/cli.mjs fluxiq:check` exited 0 on the final run.
- `node scripts/structure-audit.mjs` printed "structure-audit: passed (255 warning(s), 349 baselined)", exit 0.
  - It also printed "1 baseline entries can be lowered": service.ts's line ratchet, 4400 in `.structure-baseline.json`, is now 4399.
- `pnpm.cmd docs:check` printed "structure-audit: passed (0 warning(s), 0 baselined). Deterministic framework reference is current.", exit 0.
- `wc -l R/service.ts` printed `4399`.
- Line endings: every file I modified kept CRLF in the working tree, and new files were written CRLF to match their neighbours. The generated `framework-reference.md` copies stay LF, as before. C2's LF files were not touched.

## Not verified

- **Fail-first was not run against the old code.** I would have had to stash or revert C2's uncommitted tree. The new tests fail on the old code by construction: the unit tests import functions that did not exist. The service "answers" test asserts the stored graph's owner was `null` at the re-run's dispatch, and the old code applied before the re-run.
- **No live browser or Lab run.**
- **The fallback path was not exercised against the real service.** All three service-level cases took the unapplied-candidate path (a primary Subflow plus a map fallback, so `subflowId` is set). The fallback (`appliedBeforeJudged`) is covered only by unit tests.
- **A run that throws mid-run is not settled.** A held edit then stays validated with no `notAppliedReason`. Only the `judged` closure calls the settle; `settleAfterThrow` does not, because the brief named only `judged`.
- **Parent-level parts of the held edit are not in effect during the candidate pass.** The parent Flow metadata the apply writes (`bootstrapInstructedConsequences`, `bootstrapSourceInstructionIds`) and the router and subflow records are not active. Only the graph runs unapplied. The router check limits this, but a held build's instructed consequences are not read during its own judged pass.

## Open questions or contradictions found

1. **A held edit left `validated` blocks every later build of that Flow.** The design leaves a refuted or failed held edit validated and unapplied. `pending_adaptation_exists` then refuses every later Flow Bootstrap build on that Flow until someone rejects or applies the edit. That covers the next run's re-author (which would degrade to the patch ladder) and a person's own build. Inside one run I rejected superseded edits (Deviation 1). The run's final held edit is left validated, as the brief says. The supervisor should decide whether the settle should reject it instead, or whether the pending guard should ignore held repair edits.
2. **A second attempt now extends the stored Flow, not the first attempt's edit.** The first edit was never applied, so attempt 2 builds from the original Flow. The brief still carries the history of earlier attempts. This is intended under the rule, but it changes what attempt 2 starts from.
3. **The `.structure-baseline.json` line ratchet for service.ts can be lowered from 4400 to 4399 with `pnpm structure:baseline`.** I don't own that file.
4. **Files I added or edited outside the literal owned list.** `R/recovery/refuted-result/held-reauthor.ts`, its test, and one line in `R/recovery/refuted-result/index.ts` were added to keep `reauthor.ts` under the advisory limits. `R/tests/refuted-result/tests/failed-step-reauthor.test.ts` was the one existing test that assumed apply-before-run.
5. **`runtime-adaptation/` now has 17 source files, past its 15-file advisory threshold.** A subdirectory would exceed the 9-segment path-depth limit, which fails the audit, so I could not split it further.
