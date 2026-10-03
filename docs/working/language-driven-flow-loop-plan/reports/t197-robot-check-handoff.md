# t197: robot-check hand-off (lane report)

Lane lead report. Branch `task/t197-robot-check-handoff` in both trees
(`fxwork/t197/!FluxIQ`, `fxwork/t197/!FluxIQWebExtension`). Evidence:
`reports/robot-check-behaviour.md` (dev tree).

## Fix log

- 2026-09-30, lead: fixed the shared contract before dispatch.
  - Core `runtime/parking/person-needed-ask.ts` (new, exported from `parking/index.ts`): the one
    person-needed ask. Kind `choice`, options `person_done` "Continue" (route null, so `granted`,
    `success`) and `person_stop` "Stop" (route `failed`), `parks: true`, `onTimeout: "deny"`,
    timeout capped at 300 s, and `control.kind: "person_check"` as the marker for surfaces and
    the Lab. Text: "FluxIQ needs you: complete the check on this page, then press Continue."
  - Core `runtime/llm/evidence-loop/tool-execution.ts`: `personNeeded?: true` on a build tool
    result. When set, Core asks instead of showing the model the failure. On Continue the call
    stands with its `draft`, and a fresh look replaces its evidence. Otherwise the build ends
    `flow_bootstrap.user_intervention_required`.
  - Validation: `npx tsc --noEmit -p .` in Core `packages/fluxiq` printed no errors.

- 2026-09-30, round 1, workers landed (all verified by the lead, see Validation):
  - w1 (Core build): `flow-bootstrap/person-needed.ts` wraps the build's executor (after the permission gate). A
    `personNeeded` result is never shown to the model. The ask goes to the Flow's thread and the build waits. On
    Continue, the step stands with the domain's draft, and the evidence becomes `{personCompletedCheck, note, now:
    <fresh look>}`. On Stop, a timeout, no thread, or more than 3 asks, the build ends
    `flow_bootstrap.user_intervention_required` (issue `person_needed.stopped|timed_out|no_thread|cancelled|asks_exhausted`).
    Dry-run replays and `amend_draft` reruns go through the same wrapper, and a cleared replay counts as
    `core.replay.replayed`. `run-node.ts` now says a check goes to the person. `activity/ask.ts` shows
    `waiting_permission` with the ask text. apps/web gets one message line each in two authoring panels.
  - w2 (Core run): `executor/person-needed.ts`. A failed attempt with category `user_intervention_required` and
    no ask of its own gets the person-needed ask, but only when a parking port is bound. The existing parking
    then carries it, in place or durably. Continue goes down `success`. Stop or a timeout follows an authored
    `failed` edge if there is one; otherwise the run ends failed with "a person was needed at step …", keeping
    the category and code. At most 3 asks per run. Nothing is written to `values.answer`.
  - w3 (extension): checks are classified by wording as person-only or self-clearing. Self-clearing checks are
    waited out in place, for at most 15 s and never by reloading. A same-address navigation onto a tab showing a
    check is held, not reloaded. A click that lands on a check, or a press that raises one in place
    (company-website), fails `USER_INTERVENTION_REQUIRED` with the press recorded as made. The chat header shows
    Core's ask text.
  - w4 (domain): a `USER_INTERVENTION_REQUIRED` call sets `personNeeded`, with a proposing mutate draft for a
    navigation or press, and nothing proposed for a look. The model-facing wording no longer invites acting on a
    check. `failure-taxonomy.md` is updated.
  - w5 (Lab): `packages/test-runner/src/person-simulation/**` plays the person on any `control.kind:
    "person_check"` ask during build and run. It completes the fixture's check: crossborder box, company-website
    box, everything-store code from `robotCode`, bigbox hold. It then answers `person_done`, and records
    `snapshots/person-hand-offs.json` plus events. The everything-store `robot-check` variant now expects the
    hand-off (required) and then the ordinary result. crossborder spain-hubs and company-website quote-request
    expect a hand-off without requiring one. The hand-off invariant is judged in run-evaluation and in the
    campaign rows. `testing-facility.md` is updated.

- 2026-09-30, round 2 (w6 recovery, w7 browser check, then the lead's fixes for w7's defects 1 and 3). The
  lead stopped mid-edit on a session limit; the supervisor committed the tree as WIP (downstream `8e4b7bd3`,
  Core `0b3b7960`) and merged dev into both.
  - w6 (`reports/t197-w6-recovery.md`): recovery uses the same person-needed ask as the build. The shared logic
    moved out of `flow-bootstrap/person-needed.ts` into Core `parking/person-needed-tool-calls.ts`, and both the
    build wrapper (stage `authoring`) and `recovery/runtime-exploration.ts` (stage `recovery`) call it. No repair,
    re-plan or patch model sees a call that met a check; after Stop, a timeout or no port, no re-plan or patch
    call is made. The domain's run-time repair binding (`harness-options/execute.ts`) now marks `personNeeded`.
  - w7 (`reports/t197-w7-browser-check.md`): headed, provider-free, ui-1. Proved the ask in the side panel, a
    person-only check after a click (crossborder) and on a wait node (everything-store). Found defects 1 and 3.
  - Defect 1 fix (self-clearing check handed over after 3.9 s): `domain/src/actions/check-wait.ts` (new). A
    recorded click or navigation gets `timeoutMs` 5 s + 15 s and `checkWaitMs: 15000`
    (`web-panel-host.ts` `candidate`, `gateway-mapping.ts`, `actions/types.ts`). The extension's check wait
    uses the whole timeout; the click's other windows and the recovery retry budget use the timeout less the
    allowance (`click.ts`, `recovery/budget.ts`, `landed-check-wait.ts`).
  - Defect 3 fix (a run a person cleared judged failed): Core `service/summaries/conversions.ts` carries the
    attempt's ask as closed words (`kind`, `status`, `route`, `personNeeded`) in `metadata.ask`. The runner's
    `persisted-flow-run.ts` marks such an attempt `clearedByPerson`, and `node-recovery.ts` counts it as
    ending its node well, so its failure is a recovered one.
  - Triage (w8, this round): all of the above kept. The one unfinished piece was the parity test in
    `domain/src/tests/web-panel-host.test.ts`, which did not expect `checkWaitMs` on a recorded navigation or
    click; fixed. `failure-taxonomy.md` now documents `checkWaitMs`. Core dist was stale (02:03) and was
    rebuilt; the 4 domain permission-test failures seen before the rebuild were that staleness.

## Design (binding for workers)

- **Build.** A person-needed tool result never reaches the model. Core parks on the ask. After
  Continue, the step stands (a navigation or a press did happen, and the person cleared the
  obstacle behind it) and the model is shown a fresh look. After Stop, a timeout, or no thread,
  the build ends `flow_bootstrap.user_intervention_required`. `run-node.ts` no longer says "a
  failure ends nothing" for this case.
- **Run.** A node attempt that fails with category `user_intervention_required` and raised no ask
  of its own gets the person-needed ask synthesized as its ask effect. From there the executor's
  existing parking takes over: Continue goes down `success` and the next node reads the page
  fresh; Stop or a timeout goes down `failed`, with a clear person-needed ending.
- **Extension.** Checks are read as either person-only or self-clearing. A self-clearing check is
  waited out in place: no reload, and at most about 15 s. One that does not clear becomes
  person-only. A navigation or a click that lands on a person-only check reports
  `USER_INTERVENTION_REQUIRED`, never success. A same-address navigation onto a tab already
  showing a check does not reload it.
- **Domain.** A failed call whose code is `USER_INTERVENTION_REQUIRED` sets `personNeeded` and
  describes the step as it would stand once cleared.
- **Lab.** The harness plays the person. When a pending ask has `control.kind === "person_check"`,
  it completes the fixture's check in the scenario tab the way a person would, then answers
  `choice: person_done`. The evaluation counts a hand-off at a real check as correct behaviour.

## Workers

| Worker | Area | Report |
| --- | --- | --- |
| w1 (worker-high) | Core build loop | `reports/t197-w1-core-build.md` (Core-side notes in this tree) |
| w2 (worker-high) | Core run executor | `reports/t197-w2-core-run.md` |
| w3 (worker-high) | Extension | `reports/t197-w3-extension.md` |
| w4 (worker) | Domain mapping | `reports/t197-w4-domain.md` |
| w5 (worker-high) | Lab person and evaluation | `reports/t197-w5-lab.md` |

## Validation

Run by the lead on 2026-09-30, after all five workers had finished:

- Core, `npx vitest run --poolOptions.threads.maxThreads=2` over the person-needed tests (flow-bootstrap,
  service-bootstrap), permission-ask, executor, activity, parking, llm/node-tools, and
  conversation-parking: "Test Files 32 passed (32), Tests 374 passed (374)".
- Core, `heavy.sh ... pnpm --filter fluxiq check`: tsc exit 0. `node scripts/structure-audit.mjs`: "passed
  (197 warning(s), 354 baselined)".
- Downstream, `heavy.sh ... pnpm check`: EXIT=0.
- Extension, `EXTENSION_TEST_BUILD_LABEL=t197lead heavy.sh ... extension test`: "# tests 1384 # pass 1384
  # fail 0".
- Domain, `DOMAIN_TEST_BUILD_LABEL=t197lead heavy.sh ... domain test`: "# tests 949 # pass 949 # fail 0".
- Lab, after the scenario-lab and test-runner builds (exit 0), `node --test`:
  - the scenario-lab person-check, live-instructions and live-repair-tasks tests: 26/26;
  - test-runner person-simulation, the hand-off invariant and instruction-task: 30/30;
  - everything-store person-check: 4/4.
- Fail-before is the workers' claim (w1 4/4 fail against HEAD service.ts; w2 12/14; w3 per area; w4 8
  new fail at HEAD). The lead did not re-run tests against HEAD.

## Not verified

- **No browser check was run.** `lab-slots/ui-1` was free, but three live runs held slot-2, slot-3 and
  slot-4, and free RAM was 3.8 GB, then 2.7 GB, below the 4 GB floor for a provider-free run. The command
  for the next round:
  `FLUXIQ_LAB_INSTANCE=ui-1 FLUXIQ_TEST_ENV_FILES=none pnpm lab run everything-store --target isolated --flow --workflow first-page-earbuds --variant robot-check`.
  Whether the Flow lane records usefully with the variant armed from the start is itself unverified.
  - As a result, the Playwright person (`person-simulation/tab.ts`), Core's real conversation payloads, and
    the end-to-end ask, answer and resume path are exercised only against fakes.
- (Round 1 only; closed by w6 in round 2.) Recovery exploration and the run-time repair tools were not
  wrapped.
- Round 2: no browser check was run. `tasklist /FI "PID eq 7468"` showed `node.exe 7468 Console` still alive
  (the orphaned t191 interactive Lab), so the brief's rule skipped it; `lab-slots/ui-1` was not claimed.
  Defects 1 and 3 are fixed and unit-tested only. Not exercised live: the 15 s wait on a recorded click, a
  cleared run judged passed, and the recovery ask.
- The exploration's 600 s recovery clock keeps running while the person is asked (w6); a late Continue ends
  the exploration `budget_exhausted`. The rule holds (no model sees the check), but the answer is wasted.
- Not checked: whether click and navigation commands a model builds carry the check allowance; the fix covers
  recorded candidates.
- Core `node scripts/structure-audit.mjs` says 1 baseline entry can be lowered (probably
  `flow-bootstrap/person-needed.ts` shrinking); `pnpm structure:baseline` was not run.
- Downstream test-runner `run-evaluation/tests/runner-wiring.test.js` fails 1 row ("a persistent-isolated
  workspace is bounded to what this run wrote…"). It reads `runner.ts`, which this branch does not touch, so it
  comes from dev; not re-run on dev to confirm.
- One Core run of the full set failed `run-detail-preservation.test.ts` (a 26 s file) once; alone it passed
  3/3. Read as a load timeout, not re-checked further.

## Browser check attempt (w8, 2026-09-30, after the orphan was killed)

- Claimed `lab-slots/ui-1` at 2026-09-30T19:02:40Z. Command: `FLUXIQ_LAB_INSTANCE=ui-1
  FLUXIQ_TEST_ENV_FILES=none heavy.sh "t197 w8 browser check" pnpm lab run everything-store --target isolated
  --flow --workflow first-page-earbuds --variant robot-check`, with no stale overrides.
- **How far it got:** the prelude passed its Core commit, quiet, entries and staleness steps, and rebuilt
  scenario-lab and the domain host module. It then failed at `extension:build` (LAB_EXIT=1,
  `environment.missing`, "build step extension:build failed with exit code 1"). No browser opened and no run id
  was made. There are no screenshots: the capture loop took 0 frames.
- **Cause, a t197 defect (w6):** the extension's bundle guard refused `node:crypto`, which was "reachable from
  the browser bundle "background"". The chain was `shared/protocol.ts` -> `domain/src/client` -> Core
  `nodes/routine/approval.js` -> `runtime/parking/index.js` -> the new `parking/person-needed-tool-calls.js`,
  which imported `randomUUID` from `node:crypto`. `ask-effect.ts` already warns that the parking barrel
  reaches the browser. `pnpm check` and the unit tests do not bundle the extension, so none of round 1, w6 or
  this round's validation caught it.
- **Fix (Core, uncommitted):** `parking/person-needed-tool-calls.ts` no longer imports `node:crypto`, and its
  `newAskId` input is now required. The two Node-side callers supply it:
  - `flow-bootstrap/person-needed.ts` defaults to `person-needed.<uuid>`, so its behaviour is unchanged;
  - `recovery/runtime-exploration.ts`.
- The user's order then stopped all Labs, so the run was not relaunched. The slot was cleared (`lab-slots/ui-1`
  removed), the capture loop and watchers were stopped, and no Playwright Chromium was left running.
- **Not verified:**
  - the extension build after the fix (the next Lab prelude runs it);
  - everything the browser check was meant to show: a self-clearing check waited out, the person-needed ask,
    and the resume.

## Ready to commit

Ready to commit:
- Downstream: `8e4b7bd3` as it stands, plus `domain/src/tests/web-panel-host.test.ts`,
  `docs/architecture/failure-taxonomy.md` and this report.
- Core: `0b3b7960`, plus `runtime/parking/person-needed-tool-calls.ts`, `runtime/flow-bootstrap/person-needed.ts`
  and `runtime/recovery/runtime-exploration.ts` (the `node:crypto` fix).

Validation after that fix:
- Core `pnpm --filter fluxiq check` -> CHECK=0.
- vitest over both recovery person-needed tests, flow-bootstrap, parking and service-bootstrap person-needed ->
  "Test Files 46 passed (46), Tests 807 passed (807)".
- Core structure audit -> "passed (199 warning(s), 354 baselined)".
- The Core dist was not rebuilt after this fix.

Validation from before the `node:crypto` fix:
Validation (w8, 2026-09-30, after the dev merge):
- Core `heavy.sh ... pnpm --filter fluxiq check` -> CHECK_EXIT=0; `node scripts/structure-audit.mjs` ->
  "passed (199 warning(s), 354 baselined)".
- Core `npx vitest run` over recovery, llm/harness-options, parking, flow-bootstrap, executor,
  service/summaries and service-bootstrap person-needed -> "Tests 1 failed | 1733 passed (1734)"; the failure,
  `run-detail-preservation.test.ts`, re-run alone -> "Tests 3 passed (3)".
- Core `heavy.sh ... pnpm --filter fluxiq build` -> exit 0.
- Downstream `heavy.sh ... pnpm check` -> CHECK_EXIT=0; `node scripts/structure-audit.mjs` -> "passed (128
  warning(s), 120 baselined)".
- Domain `DOMAIN_TEST_BUILD_LABEL=t197w8 heavy.sh ... domain test` -> "# tests 985 # pass 985 # fail 0".
- Extension `EXTENSION_TEST_BUILD_LABEL=t197w8 heavy.sh ... extension test` -> "# tests 1454 # pass 1454 # fail 0".
- Test-runner `pnpm build`, then `node --test` node-recovery, persisted-flow-run and person-simulation -> "#
  tests 49 # pass 49 # fail 0"; all flow-lane and run-evaluation -> 410/411, the one failure above.
- w3 narrowed page-scope challenge gating to person-only checks. A missing target under a self-clearing
  cover that never clears is retried as `TARGET_NOT_FOUND` instead of being handed over.
- w3's in-page watch probably misses local-classifieds' pushState feed cover. The cover lifts by itself in
  2.5 s.
- `packages/test-contracts/src/validation.ts` has no `personHandOff` key. The hand-off is declared in each
  scenario's `person-check.ts` and in `LiveInstructionTask.personCheck` instead.
- Stop on a person-needed ask follows an authored `failed` edge when the Flow has one, rather than always
  ending the run.
