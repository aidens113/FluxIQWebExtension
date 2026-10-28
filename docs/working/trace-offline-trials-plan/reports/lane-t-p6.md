# Report: lane-t-p6 (t769 offline trials in builds, trace plan P6)

Trees `fxwork/t769/{!FluxIQ,!FluxIQWebExtension}`, branch `task/t769-p6-offline-trials-in-builds` (downstream from dev
55fe5c0e, Core 4ae8444f). Brief: downstream plan "Brief: P6-offline-trials-in-builds"; plan of record Core P6.

## Outcome

Partial (2026-10-28). Tier 1 is done end to end. During a build's test and repair phases, every trial port (subflow
trials, a candidate build's whole trials, the project build's whole trials) checks the candidate offline first, against
the build's latest live trace of the same scope. A failure the recording demonstrates goes back as repair feedback
marked `checkedAgainst: "recorded_run"`, with no site command, no reset and no page look. A pass, a gap or an
inconclusive check runs the live trial in the same call. An offline yes never stands, so the final judged run is always
live. The chat, the status line and the step log (`NNNN-offline`) say which results were offline. The headed
provider-free proof passed on job-board and photo-social. Not done: tier 2 in production (no reevaluator is bound, so
every changed read runs live), pending a hosting decision.

Workers: B1, B3, B7, B8, B9, B12, B13, B14, B15 and B17 ran as worker-heavy (Opus); B2, B4, B5, B6, B10, B11 and
B16 as worker (Sonnet); the three discovery briefs were two worker-heavy and one worker. There were no escalations.
Each worker's claims were checked by the lead's own runs, recorded below.

## Progress log

### 2026-10-27 - Discovery (three read-only workers)
- `t769/core-design.md` (worker-heavy): file-level design. Findings: F1 `core.run_flow` is not offered in either
  builder loop and runs draft steps builders do not have; F2 the P4 runner covers only whole-candidate trials (a
  subflow twin is needed); F3 `project-agents/dispatch/trial-port.ts` drops the port's `environmentKind` (latent bug).
- `t769/tier2-hosting.md` (worker-heavy): production tier 2 is best hosted in the Core host process (a browser page
  launched from the host via P5's snapshot page, moved into a Node-only domain subtree), behind a capability; an
  in-extension variant needs the `debugger` permission or changes the page origin. P6 default: tier 1, no reevaluator.
- `t769/harness-survey.md` (worker): the site-reset headed harness (`apps/extension/e2e/site-reset/`) drives a project
  build with a scripted provider; tracing and the step log are off there (`FLUXIQ_CLIENT_GATEWAY_TRACE=1`,
  `FLUXIQ_LLM_STEP_LOG_DIR`); job-board (`repair-first.spec.ts`) and photo-social fit.
- Lead coordination (2026-10-27): t771 owns Core `runtime/result-verification/build-test/**` and the build test record's
  judge-grounding evidence. P6 stays off them.

### 2026-10-27 - Supervisor decisions
- D40 Gap answer: the trial runs live in the same call. The live run is the subflow trial itself (that subflow from its
  entry, the focused run), never the whole Flow; `core.run_flow` is unavailable in builder loops (F1). A project
  build's whole trial (the final judged run) is never offline-first; only subflow trials, and a candidate build's whole
  trials, are.
- D41 Offline is tried at most once per revision and digest (`tried === 0`); every retest is live (no gap loop).
- D42 An offline pass pays the judge twice (offline, then live); accepted (model spend is small; site time is the cost).
- D43 An offline-demonstrated `execution_failed` (matched recorded support) counts toward the same-failure rule.
- D44 Offline-first is on when gateway tracing is installed; `FLUXIQ_OFFLINE_TRIALS=0` turns it off (needed for P7's
  off/on measurement).
- D45 Tier 1 first; tier 2 (production reevaluator) after tier 1 is integrated, per `t769/tier2-hosting.md`.

### 2026-10-27 - Wave 1 batch A (B1 worker-heavy, B2 worker, B3 worker-heavy, B4 worker) back; lead fixes
- B1 `runAutomationStudioOfflineSubflowTrial` + `matcher-session.ts` (both runners); B2 `traceId` on candidate and
  subflow trial records; B3 `flow-bootstrap/offline-first/` (contracts, gate step, words) + the trace-free guidance
  boundary entry; B4 `automationStudioLlmStepLogOfflineTrial` (`NNNN-offline/meta.json`). Reports `t769/b1..b4-*.md`.
- Lead fixes for 5 audit failures in B2/B4 files: deep `gateway-trace/installation.ts` imports -> barrel (both run.ts);
  candidate-trial `tests/` at 26 files -> `trace-id.test.ts` moved to `tests/environment/tests/`; step-log test `as
  never` -> a typed variable with extra fields; describe-failure catch marked `best-effort:`.
- Lead check: `pnpm test` (packages/fluxiq) over service/{offline-trial,candidate-trial,subflow-trial}, llm/step-log,
  flow-bootstrap/offline-first -> parallel `Test Files 58 passed (58)`, `Tests 359 passed (359)`; real-sql `No test
  files found, exiting with code 0`; `[vitest-groups] all groups passed`. `node --max-old-space-size=4096
  node_modules/typescript/bin/tsc --noEmit -p .` -> 0 (plain `pnpm exec tsc` OOMs at the default heap). Core
  `node scripts/structure-audit.mjs` -> `passed (443 warning(s), 1152 baselined)`.
- D46 A `not_tried` note (no source yet) is logged in the step log but adds no evidence for the model.

### 2026-10-27 - Wave 2 (B5 worker, B7/B8/B9 worker-heavy) and wave 3 (B10/B11 worker, B12/B13 worker-heavy) back
- B5 offline chat words (`activity/candidate/offline-words.ts`); B7 whole gate and B8 subflow gate consult
  `offlineFirst` once per revision+digest before admission, hook and reset (both add an `offlineAsked` guard so a reset
  refusal after the offline check never pays the judge again); B9 `service/offline-first/` (installation, sources,
  answer, whole/subflow factories, spend; gap-reason words drift test); B10 wires subflow trials (every build) and a
  candidate build's whole trials (never a project build's final judged run, D40), offline judge spend added, live
  `records()` unchanged; B11 dispatch wrapper copies `environmentKind` (F3 fixed) and `offlineFirst`, kept trials listed
  through `receipts.kept`; B12 `programs/_shared/runtime.ts` installs the offline-trial host via the trace host
  (`storeFor`, `sessionViewFor`: exactly one ready, unscoped, action-capable session of the project); B13 truthful
  status labels (live "Testing your Flow on the site", refused "The test didn't run: <reason>", offline "Checking your
  Flow against the recorded run"; setup rerun partly: see below). Reports `t769/b5..b13-*.md`.
- Lead integration: AS `runtime/index.ts` exports `./service/offline-first/index.ts`; `service.ts:1585` passes
  `phase: repairBrief ? "repair" : "test"` (same line, no growth); the router-run setup rerun is marked as preparation
  (`flow-bootstrap/verification/detached-subflow.ts`, B13's cause: round 6's "Testing your Flow | Step 4 of 4" was the
  predecessor call), test `verification/tests/detached-subflow.test.ts` "runs the predecessor's call as getting the
  page ready..." shown failing first (`expected [ [ 'hub', false ], [ 'done', false ] ] to deeply equal [ [ 'hub', true
  ], [ 'done', false ] ]`), then `pnpm test .../flow-bootstrap/verification` -> parallel `Test Files 6 passed | 1
  skipped (7)`, `Tests 100 passed | 2 skipped (102)`; real-sql `Test Files 1 passed (1)`, `Tests 10 passed (10)`.
- D47 A kept offline answer keeps `effectApplied: true` (B7): marking it no-effect would let the repeat guard refuse
  the live retest D41 relies on.
- Lead check over every touched Core directory (flow-bootstrap/{candidate,subflow-candidate,offline-first},
  service/{offline-first,offline-trial,candidate-trial,subflow-trial,project-build}, project-agents, activity,
  llm/step-log, gateway-trace, ui/activity-status, programs/_shared/tests): parallel `Test Files 298 passed (298)`,
  `Tests 2071 passed (2071)`; real-sql `Test Files 15 passed (15)`, `Tests 72 passed (72)`; `all groups passed`.
  fluxiq tsc (4096 MB heap) -> 0; Core audit -> `passed (444 warning(s), 1152 baselined)`.
- Open: a callable target's setup (predecessor call frames and the arrival inside one root run) is still not marked
  as preparation; it needs the executor's call-subflow frame to carry the mark (`executor/frames/call-subflow.ts`).

### 2026-10-27 - B6 (worker) and B14 (worker-heavy) back; headed proof; lead fix; D48
- B6: Lab build-time gains category `offline` (precedence reset > offline > trial > model > exploration),
  `liveTrialCount`, `offlineTrialCount` (`packages/test-runner/src/build-time/`); `# tests 18 # pass 18 # fail 0` from a
  scratch compile (the package build refused while Core's build was stale; rerun below).
- B14: headed provider-free specs `apps/extension/e2e/site-reset/tests/offline-first-{job,photo}.spec.ts` (two
  subflows; harness additions `offline-first-build.ts`, `step-log.ts`, `offline-trial-environment.ts`):
  `1 passed (3.0m)` job-board, `1 passed (2.4m)` photo-social, `repair-first.spec.ts` `1 passed (3.3m)`. Step log in
  both: `0021-offline` `kept_no` (7/7 matched, no reset), `0024-offline` `passed`, `0025-reset`, live yes, then the
  supervisor's whole test live after `0028-reset`.
- B14 finding: a kept offline answer still sent two `web.dom.capture_snapshot` to the site: the after-trial page look
  (`flow-bootstrap/candidate/trial-view.ts`) ran because the answer keeps `effectApplied` (D47). Lead fix: no look after
  an answer `checkedAgainst: "recorded_run"` unless Core's own checks moved the target; test `candidate/tests/
  trial-view.test.ts` "is not looked at after a test answered from the recording..." failed first (`Tests 1 failed | 8
  passed (9)`), then `pnpm test .../flow-bootstrap/candidate .../flow-bootstrap/subflow-candidate` -> `Test Files 56
  passed (56)`, `Tests 367 passed (367)`, `all groups passed`.
- D48 (revises D40): a single-subflow plan's builder test is the supervisor's whole trial, so with D40 such builds never
  test offline. Offline-first now applies to every build trial port, the project build's whole trials included; an
  offline yes never stands (the gate always runs live after it), so the final judged run is always a live yes.
- Lead coordination (t775, user decision 2026-10-27: reset as rarely as possible; judges judge the change from the site
  state before each trial): P6 adds no reset precondition; the offline check runs before admission, the start hook and
  any reset, and an offline trial makes no site change, so it needs no reset and no before/after reading.

### 2026-10-28 - B15 (worker-heavy), B16 (worker), B17 (worker-heavy) back; final integration and gates
- B15 (D48): the project build's whole port is offline-first too (`service/project-build/whole-trials.ts`); a kept
  answer writes nothing to the supervisor ledger or acts record; `project-agents/supervisor/whole-trial.ts` no longer
  resets the test-time measure on a kept answer. B17: a single-subflow builder test answered by the supervisor's whole
  gate from the recording carries `checkedAgainst: "recorded_run"` on the subflow trial result; the subflow gate lifts
  it into its evidence, prefixes B3's words and skips `leftOnSite`/`reset.trialRan` (so no after-trial page look and
  truthful chat words). B16: Core `client-gateway.md` "Offline trials in builds (P6)", pointer in
  `llm-flow-bootstrap.md`, framework reference regenerated (4178 declarations); downstream `testing-facility.md`.
- Lead fixes: downstream `testing-facility.md:822` link out of the repository (audit `docs-links` FAIL) -> plain path;
  `e2e/site-reset/offline-first-build.ts` whole-test assertion updated for D48 (the whole test logs
  `offline:refused:no_live_source`: no earlier live whole test, so the judged run is live).
- Final gates (lead, integrated tree, no worker running):
  - Core `pnpm test` (packages/fluxiq) over flow-bootstrap/{candidate,subflow-candidate,offline-first,verification},
    service/{offline-first,offline-trial,candidate-trial,subflow-trial,project-build}, project-agents, activity,
    llm/step-log, gateway-trace, model/offline-trial, client-gateway/trace-matcher, ui/activity-status,
    programs/_shared/tests and the three prompt-contract tests (`scripts/task/contract/list.mjs`): parallel `Test Files
    314 passed | 1 skipped (315)`, `Tests 2281 passed | 2 skipped (2283)`; real-sql `Test Files 16 passed (16)`, `Tests
    82 passed (82)`; `[vitest-groups] all groups passed: parallel, real-sql`.
  - Core `pnpm check` -> exit 0 (`# tests 471 # pass 471 # fail 0`; `structure-audit: passed (444 warning(s), 1152
    baselined).`; fluxiq:check, web:check built; contracts:check, client-gateway-websocket:check reused).
  - Core `pnpm build` (packages/fluxiq) -> `fluxiq:build` built; downstream `node scripts/check/core-build.mjs` ->
    `current with its source`.
  - Downstream tsc (4096 MB heap): domain tsconfig.json 0, tsconfig.test.json 0; extension 0, 0; test-runner 0.
  - Downstream `node scripts/structure-audit.mjs` -> `passed (227 warning(s), 616 baselined).`
  - Test-runner build (`domain:build`, `test-runner:build` built); `node --test dist/build-time/tests/*.test.js` ->
    `# tests 19 # pass 19 # fail 0`.
  - Headed provider-free (Chromium, realistic scenarios, scripted provider), from apps/extension `pnpm test:e2e
    e2e/site-reset/tests/<spec> --workers=1`: `offline-first-job.spec.ts` `1 passed (2.5m)`; `offline-first-photo.spec.ts`
    `1 passed (1.4m)`; `repair-first.spec.ts` `1 passed (1.5m)`. Step log in both offline specs: `0021-offline
    outcome=kept_no` (no reset folder, `siteActs.test-2 = []`: nothing sent to the site), `0024-offline
    outcome=passed`, `0025-reset site_check:admit` then the live yes, `0027-tool-core.test_candidate`, `0028-offline
    outcome=refused:no_live_source`, `0029-reset`, whole live yes. Test results: test-2 `checkedAgainst:
    "recorded_run"`, test-3 `offlineCheck: "passed"`.

## Source tests and plan tests (P6 gate)

| Test | Proven by |
| --- | --- |
| T09 new external query -> faithful or gap | `service/offline-trial/tests/subflow-run.test.ts`, `service/offline-first/tests/{answer,subflow}.test.ts` (gap -> live, step named) |
| T17 no merge across episodes/scopes | `service/offline-first/tests/sources.test.ts` |
| T18 recorded success, wrong output -> no | `flow-bootstrap/candidate/tests/offline-trial/tests/offline-first-gate.test.ts`; headed specs (test-2 kept no) |
| T19 replays leave live counts unchanged | `service/offline-first/tests/whole.test.ts` (records and `tallyAutomationStudioLiveEpisodes`) |
| T21 missing transition through a real probe | `service/offline-first/tests/subflow.test.ts` (gap -> live; the new live trace becomes the source; derived never) |
| Not in exploration / initial build | runner refusal (`offline_not_allowed_in_phase`); first test of a scope has no source -> live (sources test; headed `0008`/`0017`) |
| Offline pass never satisfies the whole-run gate | `offline-first-gate.test.ts`, `subflow-trial-offline.test.ts`, `model/offline-trial/tests/whole-run-gate-eligibility.test.ts`; headed (offline pass then live) |
| No secrets in traces / step log | existing screening tests; `llm/step-log/tests/offline-trial-step.test.ts` (whitelisted meta) |
| Trace content never reaches guidance | `module-reach` boundary now includes `flow-bootstrap/offline-first/`; both audits pass |
| Truthful labels (lead addition) | `ui/activity-status/tests/truthful-test-labels.test.ts`, `activity/step/tests/recorded-check.test.ts`, `verification/tests/detached-subflow.test.ts` |

## Trial-gate files changed (for sequencing with t775 phase D)

Core AS `runtime/flow-bootstrap/candidate/{trial-gate.ts, contracts.ts, trial-view.ts, trial-slow-down.ts (new: helpers
moved out of trial-gate.ts for its line budget)}`; AS `runtime/flow-bootstrap/subflow-candidate/{subflow-trial-gate.ts,
contracts.ts, subflow-trial-result.ts (new), subflow-trial-offline-first.ts (new)}`. The offline check sits after the
retest-limit/same-failure checks and before admission, the start hook and the reset; no reset precondition was added.

## Not verified / open

- Tier 2 in production is not built: no reevaluator is bound, so every changed read or target is a gap and runs live.
  Design ready in `t769/tier2-hosting.md` (host-process snapshot sandbox behind a `trace-reevaluation` capability);
  it needs the lead's/user's call on running that sandbox browser headless in the person's own panel (Lab runs stay
  headed).
- The gap path was proven by unit tests only, not headed. Firefox not run. No live or paid run (by the brief).
- A single-subflow builder test still runs its start hook and reset before the whole gate answers from the recording
  (the subflow gate's pre-port steps; left for t775's reset-gate retirement).
- A callable target's setup (predecessor call frames inside one root run) is still labelled as testing; only the
  router-run setup is marked (needs `executor/frames/call-subflow.ts`).
- Receipt references of a kept answer carry the offline run's id; no "checked against the recording" flag (the receipt
  ref contract is fixed, B11).

UNIT READY (Core, t769 tree): every path in `git status` of `fxwork/t769/!FluxIQ` (57 modified, 29 new; listed in the
return). UNIT READY (downstream, t769 tree): `apps/extension/e2e/site-reset/{gateway,index,installed-build,
offline-first-build,offline-trial-environment,step-log}.ts`, `apps/extension/e2e/site-reset/tests/offline-first-{job,
photo}.spec.ts`, `packages/test-runner/src/build-time/**`, `docs/architecture/testing-facility.md`,
`docs/working/trace-offline-trials-plan/reports/{lane-t-p6.md,t769/**}`. The halves form one unit; merge Core first.

### 2026-10-28 - After the lead merged dev (t771, t773, t774, t776): headed specs failed; cause and fix
- Reproduced: `pnpm test:e2e e2e/site-reset/tests/offline-first-job.spec.ts --workers=1` -> `1 failed` at
  `offline-first-build.ts:113`, offline outcomes `["inconclusive", "passed"]`, not `["kept_no", "passed"]`. The LIVE
  test-1 also settled `unsure` (titles-1 judged 4 times), so this was not offline-only.
- Cause: the specs' scripted judge replies were stale under t771's grounding rules
  (`result-verification/located-defects/located-defects.ts`). (1) A row a read left out must be named with the column
  and the row's own value in it that make it asked for (`askedCellNotFound`); the job no named only the row. (2) A row is
  named by its whole label, Core's id, or the label first; a code found inside another label no longer counts. The
  photo nos named posts by a code inside their link label, so posts-2's `kept_not_asked` (and live test-2 after the
  offline check) settled `candidate.trial_unconfirmed`. P6's offline judging was not at fault: the live trial of the
  same reply was refused the same way.
- Fix (spec replies only; assertions unchanged): job `asked_missing` gains `column: "title", value: <that row's
  title>`; photo names each row by its link as the judge was shown it (`linkShown`), and `asked_missing` gains
  `column: "link", value: <post code>` (the link cell holds the code). Each kept no is still a real no the recording shows.
- Checks: headed `pnpm test:e2e e2e/site-reset/tests/<spec> --workers=1 --headed`: offline-first-job `1 passed
  (59.9s)`, offline-first-photo `1 passed (1.3m)`, repair-first `1 passed (1.5m)`. Both offline specs: test-1 live no,
  test-2 `checkedAgainst: "recorded_run"` no, test-3 `offlineCheck: "passed"` then live yes; judge calls 2/2/4/2.
  Extension `tsc --noEmit -p tsconfig.test.json` -> 0; downstream audit -> `passed (228 warning(s), 616 baselined).`
  Core trial-path grouped run (flow-bootstrap/{candidate,subflow-candidate,offline-first,verification},
  service/{offline-first,offline-trial,candidate-trial,subflow-trial,project-build}, project-agents, llm/step-log,
  gateway-trace/wiring, model/offline-trial, client-gateway/trace-matcher): parallel `Test Files 228 passed | 1 skipped
  (229)`, `Tests 1546 passed | 2 skipped (1548)`; real-sql `Test Files 12 passed (12)`, `Tests 65 passed (65)`;
  `all groups passed`.
- UNIT READY (downstream): `apps/extension/e2e/site-reset/tests/offline-first-{job,photo}.spec.ts`, this report.
