# t197 w6: recovery hands a robot check to the person

Worker report for brief t197-w6. Branch `task/t197-robot-check-handoff` in both trees. Nothing committed.

## Outcome

Done. No repair or recovery model is shown a call that met a check. The check goes to the person through
the run's parking port, at stage `recovery`. On Continue the exploration goes on from a fresh look. On
Stop, a timeout, no port, or more than 3 asks, the exploration ends `user_intervention_required` with a
person-needed `endedBy`, and the recovery makes no further model turn, no re-plan and no patch call.

## Paths a repair/recovery model sees tool results on (task 1)

| # | Path | What the model sees | Status |
| --- | --- | --- | --- |
| 1 | `R/recovery/runtime-exploration.ts` `executeTool` (the model's calls, the loop's free first look, and now the fresh look) | Every exploration tool result | **Wrapped** (person-needed ask, then stand or end) |
| 2 | `R/recovery/annotation/exploration.ts` `returned` packets, which become `explorationEvidence` for the re-plan and patch calls | Packets the domain options returned | **Fixed**: a person-needed call's packet is never kept. The fresh look's packet is kept under the call it stands in for. |
| 3 | `R/recovery/annotation/annotate.ts`: re-plan (`replan.ts`) and `runtime_patch` calls | Exploration packets plus failure evidence | **Gated**: neither call is made after a person-needed ending. Patch recorded skipped `llm.runtime_patch_person_needed`, rung `exploration`. |
| 4 | `R/llm/harness-options/{registry,binding,builtin}.ts` | Dispatch only; results pass unchanged to #1 | No change needed. Core's built-in options read the Flow, the catalogue and adaptations, not a live target, so they cannot meet a check. |
| 5 | Diagnosis call (`runtime_diagnosis`, annotate.ts), which reads `captureSanitizedFailureEvidence` | The failed run's page | Already safe for the check class: `deterministic-diagnosis.ts` reads `user_intervention_required` as `manual_intervention`, so `modelNeeded` is false and no provider is called. |
| 6 | Refuted-result repair (`R/recovery/refuted-result/**`) | Re-author build, then annotate | Covered: the re-author goes through the build wrapper, and the patch path is #1 to #3. |
| 7 | Domain run-time repair binding (`domain/src/runtime/llm-evidence/harness-options/execute.ts` `run()`) | The six recovery options' results | **Fixed**: this is where the gap was. It turned `RecoverableToolRejection.personNeeded` into a plain `needs_person` refusal and dropped the mark. It now calls `withPersonNeeded(refused, undefined)`. |
| 8 | Domain authoring tools (`tools.ts`, `node-run/**`) when a domain binds only plain tools for recovery | Tool results | Already marked by w4. The web domain declares harness options, so recovery does not use these. |

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t197/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`):

- `parking/person-needed-tool-calls.ts` (new, exported from `parking/index.ts`). This is the shared logic,
  moved out of `flow-bootstrap/person-needed.ts` rather than copied: the ask at a caller-given stage, the
  wait, the 3-ask bound, the fresh look, the standing result, and `ended()`/`asks()`. It also exports
  `AUTOMATION_STUDIO_PERSON_NEEDED_ISSUE_CODES`, `automationStudioPersonNeededLookCallId` and
  `automationStudioToolResultNeedsPerson`. Activity is emitted through `onAsk`/`onCleared`, because
  `activity/` imports parking constants and a value import back from here would close a cycle.
- `flow-bootstrap/person-needed.ts` is now a thin wrapper over the helper: stage `authoring`, subject
  `build`, the same activity lines, the same `flow_bootstrap.user_intervention_required` ending, and the
  same exports (the max-asks constant is aliased). Behaviour is unchanged, and its tests pass unmodified.
- `recovery/runtime-exploration.ts`:
  - Every action runs through the helper, stage `recovery`, subject `exploration`. The permission check is
    still built per call. The ask uses `input.ask.port` with Core's own person-needed wait (300 s), not the
    permission ask's `timeoutMs`.
  - The helper's signal is joined to the loop's stop signal.
  - `classify` now reads a person-needed ending after a permission request and before any ledger stop
    reason. The result is outcome `user_intervention_required` and `endedBy` `person_needed.*`, with Core
    sentences, no `stopReason`, and no `result`.
  - New optional `personNeeded: { asks, ended? }` field on the exploration result and in the trace event
    detail. The trace status stays `refused`.
- `recovery/annotation/exploration.ts`: packet bookkeeping (row 2 above).
- `recovery/annotation/annotate.ts`: `personStopped` blocks the re-plan and the patch (row 3). `llmGate`
  gains `personNeeded: { asks, ended? }` and `patchSkipped` (the exploration's sentence).

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t197/!FluxIQWebExtension`):

- `domain/src/runtime/llm-evidence/harness-options/execute.ts`: marks `personNeeded` (row 7). It sets no
  draft, because recovery options write none.
- `docs/architecture/failure-taxonomy.md`, section "A Robot Check Parks, It Does Not End": one line under
  "Running a Flow" (the gate never hands the class to a model) and a new "Repairing a failed run" bullet.

Tests added:

- Core `recovery/tests/runtime-exploration-person-needed.test.ts` (7). Uses the real registry and loop,
  with a scripted `decide` that records every decision's evidence. Covers:
  - Continue: the ask carries `raisedBy.stage` `recovery` and `control.kind` `person_check`; the wait is
    300 s; the calls are look, press, `call.press.look`; no decision contains the check; the next decision
    carries the fresh look; outcome `evidence_gathered`.
  - The free first look meeting a check.
  - Stop, timeout and an unreadable thread: `user_intervention_required`, the right `endedBy`, exactly 1
    provider call, no look, trace `refused` with `personNeeded`.
  - No port: `no_thread` at once, nothing opened.
  - Bound: 3 asks, then `asks_exhausted`.
- Core `recovery/annotation/tests/recovery-person-needed.test.ts` (4). Drives the full
  `annotateAutomationStudioRunDetailWithRuntimeLlm` with `graphOptions.parking`.
  - Stop, nobody answering and no port: task kinds are exactly `[runtime_diagnosis, evidence_tool_decision]`
    (no patch); `patchSkippedCode` `llm.runtime_patch_person_needed`; no `runtimePatchAttempts`; no
    adaptation; nothing of the check in any request.
  - Continue: the patch call is made and its explored packets hold the after-person page, never the check.
- Domain `harness-options/tests/person-needed.test.ts` (6).
  - Inspect, press, navigate and wait each come back `personNeeded`.
  - A sign-in (`AUTH_REQUIRED`) press and an ordinary refusal stay unmarked.

## Commands run and observed results

- Fail-before, Core: HEAD's `runtime-exploration.ts`, `annotate.ts` and `exploration.ts` were put in
  place, and my copies were saved to scratchpad and restored afterwards. `pnpm vitest run
  --poolOptions.threads.minThreads=1 --poolOptions.threads.maxThreads=2 <the two new Core test files>` ->
  "Tests 11 failed (11)". After restoring: 7/7 and 4/4 passed.
- Fail-before, domain: HEAD's `execute.ts` was put in place, then restored. The domain test gave "# tests
  955 # pass 951 # fail 4". The 4 failures are the four "comes back marked personNeeded" rows, and the two
  control rows passed.
- Core `pnpm vitest run --poolOptions.threads.minThreads=1 --poolOptions.threads.maxThreads=2 R/recovery
  R/llm/harness-options R/parking R/flow-bootstrap R/tests/service-bootstrap/tests/person-needed.test.ts` ->
  "Test Files 86 passed (86)", "Tests 1363 passed (1363)", EXIT=0, 130 s.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t197 w6 tsc" pnpm --filter fluxiq check` ->
  CHECK_EXIT=0 (`tsc --noEmit`, no output).
- Core `node scripts/structure-audit.mjs` -> "structure-audit: passed (197 warning(s), 354 baselined)",
  AUDIT_EXIT=0. It also says "1 baseline entries can be lowered".
- Downstream `DOMAIN_TEST_BUILD_LABEL=t197w6 bash .../heavy.sh "t197 w6 domain" pnpm --filter
  @fluxiq-web-extension/domain test` -> "# tests 955 # pass 955 # fail 0", EXIT=0.
  - The first run failed 1 row: my sign-in row asserted `needs_person` on a look, which has always read
    `page_unreadable`. I moved that row to a press.
- Extra checks, not in the brief:
  - `heavy.sh ... pnpm --filter @fluxiq-web-extension/domain check` -> CHECK_EXIT=0.
  - Downstream `node scripts/structure-audit.mjs` -> "passed (127 warning(s), 120 baselined)".

## Not verified

- No live or browser run.
- The domain tests resolve `fluxiq/automation-studio` through Core's `dist`, which was built at 02:03 by
  someone else and does not contain these Core changes. I did not rebuild Core `dist`, because other
  workers may share this tree. The domain tests do not depend on the Core changes: they exercise the
  domain options through the unchanged registry. The Core side is covered by Core's own tests.
- `pnpm structure:baseline` was not run. The baseline file is not mine to edit, and the lowerable entry is
  probably `flow-bootstrap/person-needed.ts` shrinking.
- The whole downstream `pnpm check` and `pnpm test` were not run.

## Open questions or contradictions found

- **The clock keeps running while the person is asked.** The exploration's clock (600 s recovery
  deadline) runs during the person's wait (up to 300 s).
  - If it expires during the wait and the person then presses Continue, the exploration ends
    `budget_exhausted` (`recovery_deadline_expired`) and does not go on. Nothing is shown to a model and
    no patch follows, so the rule holds, but the person's Continue is wasted.
  - The permission ask already has the same behaviour. A fix would suspend the ledger clock while parked,
    which is a change to `exploration-budget.ts`.
- **Stale check page in the domain's press map.** When a press's refusal carries the page, the domain's
  `run()` still records that check page as the packet later handles bind against. The model is never shown
  it, and Core's fresh look replaces it, so it is harmless as wired today.
- `service.ts` was not touched. No wiring was needed, because annotate already receives
  `graphOptions.parking`.
