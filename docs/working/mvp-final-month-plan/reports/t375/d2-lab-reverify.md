# t375 D2: Lab re-verification of audit blockers 2, 3 and item 24

Tree: `fxwork/t375/!FluxIQWebExtension` (task/t375-adaptation-unblock), Core sibling `fxwork/t375/!FluxIQ` (task/t375-adaptation-unblock, 52d7ac3a). Read-only; no source or test edited.

## Outcome

Done. Blocker 2 holds (fixed, including in candidate mode). Blocker 3 holds for applied repairs but keeps one gap: a re-author that was held then rejected (or is still held) is invisible to the lane and can pass with 0 replays. Item 24 has a gap: an applied re-author is neither counted in "Learned N" nor shown at all.

## What changed and why

Nothing changed. Findings follow.

### Q1. Blocker 2: created Flow's playback runs `fully_adaptive` — HOLDS

- Mode rule: `packages/test-runner/src/flow-lane/persisted-flow-run.ts:76-78` `liveFlowAdaptationModeOf`: `explore_and_adapt` -> `fully_adaptive`, everything else (incl. `build_and_adapt`) -> `manual_approval`.
- Per run: `runLiveFlow` (`persisted-flow-run.ts:491-504`) adds `adaptiveMode: "manual_approval"` only when the mode is `manual_approval` (line 498). An `explore_and_adapt` run sends no `adaptiveMode`, so it runs under the stored mode.
- Stored: `src/live-llm/flow-settings.ts:29-66` `configureFlowLiveLlmExecution` writes `adaptationMode = liveFlowAdaptationModeOf(plan.purpose)` (line 36, 45) and reads the Flow back via `get-flow`, refusing if the stored mode differs (`assertSettingsPersisted`, line 82).
- The playback plan: `src/live-llm/live-llm-run.ts:91` `CREATED_FLOW_REPAIR_PURPOSE = "explore_and_adapt"`; `repairPlan` (line 335-337) is the run's plan with `purpose: "explore_and_adapt"`; `repairAuthorizer` (424-431) authorizes with `repairPlan` (-> `authorize` 569 -> `authorizeFlowLiveLlmExecution` -> `configureFlowLiveLlmExecution`, `authorize-flow.ts:37`) and returns `{ intent: "explore_and_adapt" }`.
- Candidate-mode path end to end: `run-scenario.ts:417-427` passes `authoringMode: live.coreAuthoringMode`, `authorizeBuild: live.buildAuthorizer(...)` and `authorizeRun: live.repairAuthorizer(...)` into `runCreatedFlowLane`. In `flow-lane/creation/lane.ts`: build (direct `startDirectBuild` 513/526, or chat `startChatBuild` 550/557) -> candidate checks (402-408) -> `applyCreatedFlowProposal` (418; `review-proposal.ts`, approve+apply only, no mode) -> reset and `prepareFlowPage("playback")` (446-448) -> `input.authorizeRun(flowId)` (450), which rewrites the stored mode to `fully_adaptive` and verifies it, *after* build and promotion -> `executeRecordedFlowRun(..., llmExecution)` (453-464) -> `persisted-flow-run.ts:431-432` -> `runLiveFlow`. So the function that runs the Lab's playback of a candidate-promoted Flow is `runLiveFlow`, via `executeRecordedFlowRun`, called from `buildRunAndJudge` in `lane.ts`.
- The build-time write: the direct build's `buildAuthorizer` (`live-llm-run.ts:408-413`) stores `manual_approval` (purpose `build_and_adapt`) on the Flow; the chat build's `chatBuildAuthorizer` (234-242) only installs a session key and writes no mode. Either way `repairAuthorizer` overwrites it before the playback and the read-back proves it, so no `manual_approval` survives into the playback.
- Core candidate promotion: `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/promotion.ts` (whole file, 68 lines) proposes a bootstrap adaptation via `propose(...)` and touches no `adaptationMode`/`adaptiveMode`; `grep` for `adaptiveMode|adaptationMode|manual_approval` across `runtime/service/candidate-trial/` returns nothing.
- Nothing on the Lab side under `flow-lane/creation/` or `extension-chat-check/` writes or sends a mode (grep empty).

### Q2. Blocker 3: repair-lane outcomes — HOLDS for applied repairs; one GAP

Lane entry `src/flow-lane/repair/run-repair-lane.ts:102`: no `--replays` or a non-repairing run (diagnosis) -> skip (returns `undefined`, no record). `--replays` is 0..10 (`commands.ts:282-305`).

| Outcome | Lane | Replays |
| --- | --- | --- |
| Runtime patch, Core already applied (`statusBefore === "applied"`, `apply-repair.ts:89-91`) or Lab approve+apply reaches `applied` (93-100) | passes only if every replay ran, called no model, flow succeeded and goal held (`prove-repair.ts:91-114`) | N (`prove-repair.ts:60-62`, `replay-repair.ts:99-101`) |
| Runtime patch, any adaptation not `applied` after review (`not_applied`) | fails (`prove-repair.ts:84-90`) | 0 |
| Adaptation still `testing`/proposed | Lab approves and applies it itself (`apply-repair.ts:93-94`); `applied` -> as row 1; refused/other status -> fails | N or 0 |
| Re-author applied (`resultReauthor.applied === true` + id, `run-repair-lane.ts:176-180`) after a judged re-run with datasets | its id is added to `adaptationIds` (136); already `applied` -> counted; replays must also reproduce the rows (`expectedDatasets`, 137; `prove-repair.ts:103-108`) | N |
| Same, run stored no dataset (form task) | judged on 0 calls, success and goal (`datasetsReproduced: null`) | N |
| Created Flow with a declared repair, proposal judged not `repaired` | fails before anything is applied (`run-repair-lane.ts:111-116`), skipped for a re-author (108) | 0 |
| No proposal (`adaptationIds` empty, no applied re-author) | passes by design for refusal tasks (`prove-repair.ts:83`, `apply-repair.ts:83`) | 0 |
| Re-author held then rejected (`applied:false`, `notAppliedReason`) or still held | `resultRepairOf` returns `undefined` (178), so it is treated as if no re-author happened; with an empty `adaptationIds` (a bootstrap adaptation is not in it) the outcome is `no_proposal` -> **passes with 0 replays** unless a declared repair expectation fails it first (only created Flows whose variant declares one; it then fails as `not_attempted`/`not_proposed`, the wrong reason) | 0 |
| `--replays 0` explicitly | applies and passes with 0 replays, by design (`commands.ts:290-292`) | 0 |

- No path counts a never-applied repair as applied and replayed: a rejected re-author is never added to the proof (`applied !== true` guard at 178), and replays run only after `applied` (`prove-repair.ts:60`). Gap is the opposite: the rejected re-author passes silently as `no_proposal`, and the record (`snapshots/repair-lane.json`) does not say a re-author was tried.
- `RunHarnessResultReauthor` (`packages/test-contracts/src/harness-recovery.ts:143-170`) has `routed, refusal, adaptationId, applied, failureCode, failureStage, failureRetryable, provider*` — no `held`, no `notAppliedReason`; the reader `src/flow-lane/harness-recovery.ts:205-226` does not read them; the validation key list `test-contracts/src/harness-recovery-validation.ts:15` matches. Core does write both (`held-reauthor.ts:58` `held`; `judged-reauthor.ts:139` `notAppliedReason`). So **still not published**, as t267 noted.

### Q3. Item 24 row — "Learned N" applied-only HOLDS; applied re-author GAP

- `apps/extension/src/panel/automations/facts.ts:46-52`: `learned` = count of ids (`createdAdaptationIds ?? adaptationIds`) whose status is `applied`; 0 if `durableBehaviorChanged === false`; else undefined. Only applied adaptations count.
- A re-author is not counted or shown: nothing in `apps/extension/src/panel/automations/` reads `reauthored` (grep empty; `replies.ts:10-18` reads only `runSummary`, `createdAdaptationIds`, `durableBehaviorChanged`). Core's run answer adds `reauthored` (`!FluxIQ/.../api/handlers/runtime-execution.ts:117, 187-192`), and its `durableBehaviorChanged` (`runtime/durable-behavior/durable-behavior-changed.ts:12-21`) is false when `adaptationIds` is empty, so a run whose only change was an applied re-author gives `learned: 0`, `changesTried: 0`, `futureRunsUpdated: false`.
- Row text (`summary-copy.ts:94-101`, file-relative lines 21-28), after the outcome and AI lines:
  - One applied runtime patch (id in the run's ids, status `applied`): "Learned 1 new page variation" then "Future runs updated".
  - One applied re-author (and no runtime patch): no learning line at all; only e.g. "Completed in 14.2s" and "AI activated N times".
  - One tried-but-rejected change: as a runtime patch with status `rejected`/`disabled`/`reverted`/`superseded` -> "The change didn't hold up, so future runs stay the same"; still `proposed`/`testing` -> "Checking the change..."; as a rejected re-author -> no line (not in ids).

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner build` -> core-build current; `domain:build` and `test-runner:build` reused from stamp (inputs and outputs match).
- From `packages/test-runner`: `node --test dist/flow-lane/tests/persisted-flow-run.test.js dist/flow-lane/repair/tests/*.test.js dist/live-llm/tests/flow-settings.test.js dist/live-llm/tests/live-llm-run.test.js` (8 files) -> `# tests 101 # pass 101 # fail 0 # skipped 0`.
- Extra: `node --test packages/test-runner/dist/flow-lane/tests/live-repair-lane.test.js` -> `# tests 4 # pass 4 # fail 0`.
- Extension: `scripts/test-extension.mjs` has no filter, so a scratch script (outside the repo) bundled the 14 `src/panel/automations/tests/*.test.ts` with the same esbuild options into `apps/extension/.test-build-scratch/d2-lab-reverify/` (ignored), then `node --test .../panel/automations/tests/*.mjs` -> `# tests 101 # pass 101 # fail 0 # skipped 0`. Scratch output removed afterwards; `git status --short` clean.

## Not verified

- No Lab, browser or provider run; behavior is from reading code and unit tests.
- Did not trace Core's run-runtime-session handling of a stored `fully_adaptive` mode, nor whether Core's run detail `adaptationIds` ever includes the bootstrap re-author adaptation (taken from the brief and from `runtime-execution.ts:181-183` comment).
- Did not check whether Core allows the Lab to approve/apply a still-`testing` runtime adaptation (would bypass Core's judged gate).

## Open questions or contradictions found

- The repair lane's direct-build path stores `manual_approval` at build time and only flips to `fully_adaptive` at playback; harmless today because the read-back verifies, but if a candidate trial ever needs adaptive repair it runs under `manual_approval`.
- Fix candidates (not made): carry `held`/`notAppliedReason` on `RunHarnessResultReauthor` and fail (or record) the repair lane when a routed re-author was not applied; read Core's `reauthored` in `replies.ts`/`facts.ts` so an applied re-author shows as learned and a rejected one as "didn't hold up".
