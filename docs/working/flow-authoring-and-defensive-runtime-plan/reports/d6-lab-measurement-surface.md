# D6 — What the Testing Lab can measure about authoring-by-accrual and the recovery ladder

Read-only investigation, 2026-09-22. Scope: `packages/test-runner/`, `scripts/lab/`,
plus the contracts in `packages/test-contracts/` and `packages/test-evidence/` those
two write through. No Lab run was started and no provider was called; every number
below is read from source or from artifacts already on disk under `test-runs/`.

---

## 1. Every field a run writes that a reader uses to judge a build

A finished run leaves a bundle. Four files in it are read by the campaign summary
(`scripts/lab/live-campaign/row/bundle.mjs:12`): `evaluation.json`, `run.json`,
`snapshots/live-llm.json`, `snapshots/flow-lane.json`. Two more are written and read
by nobody downstream: `snapshots/repair-lane.json` and `snapshots/redaction-attestation.json`.

### 1a. `snapshots/live-llm.json`

Written by one function, `LiveLlmRun.writeSnapshot`
(`packages/test-runner/src/live-llm/live-llm-run.ts:435`), from four call sites:
`settle` (:288), `settleBuild` (:302), `settleRepair` (:324), `settleUnfinished` (:384).

Top-level members (`live-llm-run.ts:437-476`):

| Field | Line | What it says |
| --- | --- | --- |
| `schemaVersion` `"0.1"` | :437 | |
| `profileId`, `provider`, `model`, `task`, `purpose` | :438-442 | the plan, not the outcome |
| `credentialSource {name, from}` | :443 | where the key was found, never the key |
| `authorized {maxCalls, tokenLimits, maxTotalTokensPerRun, timeoutMs, maxEstimatedCostUsd, maxTotalEstimatedCostUsd}` | :444-451 | what the operator asked for |
| `granted {…same five…}` | :454-456 | what Core issued; `null` when no grant |
| `highTokenConfirmation {sent, authorizedTokens, threshold, reason}` | :460-465 | |
| `declared` | :466 | the raw `--llm-*` options |
| `observed` | :467 | `LiveLlmObservedUsage` — see below |
| `exploration` | :472 | `LiveLlmExplorationRecord` — see below |
| `verification` | :475 | Core's result-verification record and its calls |
| `build` / `repair` / `settlement` | :476 (`...extra`) | added per call site |

`observed` (`packages/test-runner/src/live-llm/observed-usage.ts:42-63`):
`calls`, `interventions`, `observedCalls[]`, `perCallRecords`
(`"recorded" | "incomplete" | "not recorded"`), `unrecordedCalls`,
`totalEstimatedCostUsd`, `accounting`, `gate`. Each `observedCalls[]` entry (:9-28)
holds `requestId`, `taskKind`, `stage`, `provider`, `model`, `promptVersion`,
`validationOk`, `validationCodes[]`, `inputTokens`, `outputTokens`, `totalTokens`,
`estimatedCostUsd`.

`build` (a `CreatedFlowBuild`, `packages/test-runner/src/flow-lane/creation/build-proposal.ts:76-89`):
`outcome` (`proposed`/`failed`), `adaptationId`, `providerCalls`, `providerInvocation`
(`attempted`/`not_attempted`/`unknown`), `accounting {provider, model, inputTokens,
outputTokens, totalTokens, estimatedCostUsd}`, `evidenceLoop {decisionCount,
toolCallCount, evidenceBytes, toolIds[], steps[]}` (:50), `failure {code, stage,
httpStatus, issueCodes[]}`, `recoveredAfterTimeout`, `durationMs`,
`instructedConsequences[]`, `permissionRequest` (:91-101).

`exploration` (`packages/test-runner/src/live-llm/exploration-record.ts:33-75`):
`source` (`recovery-trace`/`absent`/`unreadable`), `requested`, `status`,
`providerCalled`, `outcome`, `endedBy`, `stopReason`, `noProgressReason`,
`counts {actions, observedActions, refusedActions, unusableDecisions, providerCalls,
evidenceBytes, durationMs}`, `toolIds[]`, `resultCodes[]`, `toolDetail`.

**Authority.** Core's own per-run ledger is the authority on spend, in this order:
`llmAccounting.calls`, then `providerCallCount`, then the itemized per-call lines
(`packages/test-runner/src/flow-lane/repair/replay-repair.ts:134-138`, stated as
"most authoritative first"). `observed.accounting` is "what the budget is actually
judged against" (`observed-usage.ts:54-60`), and the campaign deliberately does *not*
use it for the reported spend because it includes reservations
(`scripts/lab/live-campaign/row/reported-spend.mjs:5-6`). `perCallRecords:
"incomplete"` is a hard failure, because a call that escaped itemization escaped
every per-call cap (`live-llm/budget.ts:72-77`).

### 1b. `evaluation.json`

Written at `packages/test-runner/src/run-scenario.ts:635` from `singleRunEvaluation`
(:633). Shape: `RunEvaluation`, `packages/test-contracts/src/evaluation.ts:236-326`.

`schemaVersion` `"0.3"` (:8), `runId`, `verdict` (`passed`/`failed`/`inconclusive`),
`failureCategory` (the **test-rig** taxonomy, :18-24), `facilityFailure`
(`FacilityFailureDiagnostic`, :56-71), `invariants[]` (:25), `metrics`, `scenarioId`,
`workflowId`, `variantId`, `repeatIndex`, `lane` (`recording`/`flow`), `flowCreated`,
`oracleVerdict`, `reportedVerdict` (`passed`/`failed`/`unverified`/`null`, :274),
`automationFailureReported` (Core's taxonomy, :276), `automationFailureExpected`,
`harnessActivations`, `durationMs`, `actions[]` (`{actionType, durationMs}`, :85),
`evidence {sanitizedPacketBytes[], rawSnapshotBytes[], truncationCount}` (:88),
`llm {mode, profileId, calls}` (:98), `extraction[]`, `harnessRecovery`,
`adaptationCost`, `adaptationValidation`, `adaptationPersistence`, `adaptationReuse`.

`extraction[]` entries (`RunExtractionMeasurement`, :140-218): `stepIndex`, `status`
(`judged`/`not_run`/`not_expected`), `expectedRecords`, `observedRecords`,
`recordsListed`, `countStated`, `comparedRecords`, `matchedRecords`,
`matchedInAnyOrder`, `unjudged[]`, `expectedFields`, `presentFields`,
`unexpectedFields`, `expectedPages`, `pagesFollowed`, `truncated`, `durationMs`,
`nonStringValues`.

`harnessRecovery` (`packages/test-contracts/src/harness-recovery.ts:19-40`):
`attempted`, `interventions[] {kind, validationOk, validationCodes[]}` (:49),
`runtimePatchAttempts[] {kind, proposalOnly, executed, preflightOk, issueCodes[],
adaptationCreated, changeProposalCreated, verdict}` (:67-76), `adaptationIds[]`,
`changeProposalIds[]`, `refusalCode`.

**Authority.** `evaluation.json` is the verdict of record; the Lab's printed stdout
result is only the fallback for targets that publish no evaluation
(`scripts/lab/live-campaign/row/summarize-task.mjs:37-45`). Within `extraction[]`,
`matchedRecords` is meaningless without `recordsListed` and `comparedRecords`: a
count-only expectation reports `comparedRecords: 0, matchedRecords: 0` although it
"passed" (`evaluation.ts:126-133`). `reportedVerdict: "unverified"` is a third
outcome, neither a pass nor a fail (`evaluation.ts:258-273`,
`packages/test-runner/src/flow-lane/lane-observation.ts:158-183`).

### 1c. `snapshots/flow-lane.json`

Two writers, one shape family. Recorded-Flow lane: `flowLaneSnapshot`
(`packages/test-runner/src/flow-lane/run-flow-lane.ts:407-421`) — `recording
{recordingId, entryCount, secondWait{…}}`, `proposalId`, `mapperId`,
`candidateCount`, `proposalIssues[]`, `flowId`, `runtimeRunId`, `status`,
`harnessActivations`, `failure`, `stoppedWithoutFailedAttempt`, `harnessRecovery`,
`startCandidateIndex`, `extraction`, `repair`, `actions[]`.

Created-Flow lane: `createdFlowLaneSnapshot`
(`packages/test-runner/src/flow-lane/creation/snapshot.ts:18-45`) — `lane:
"created-flow"`, `task` (with the instruction as `{characters, sha256}` only),
`build`, `review`, `flowId`, `flowShape`, `runtimeRunId`, `status`,
`resultVerification`, `reportedVerdict`, `harnessActivations`, `failure`,
`stoppedWithoutFailedAttempt`, `route`, `harnessRecovery`, `oracleVerdict`,
`extraction`, `actions[]`.

`actions[]` in both (`flowActionsSnapshot`, `run-flow-lane.ts:428-437`):
`actionType`, `status`, and optionally `failure`, `comparisonStatus`,
`targetResolution`, `evidencePackets[]`. **No node id, no attempt index, no
duration.**

`targetResolution` is narrowed to `status | candidateCount | minimumConfidence |
confidence | normalizedScore` (`persisted-flow-run.ts:154-160`).

**Authority.** This file is written *before* any expectation is judged, so a run that
fails an assertion still shows the Flow run it was
(`docs/architecture/testing-facility.md:1138-1140`). It is the only surviving record
of how a target was resolved, because Core deletes an isolated run's workspace
(`run-flow-lane.ts:386-390`).

### 1d. `events.ndjson`

Written by the evidence bundle's journal (`packages/test-evidence/src/bundle.ts:168`).
Per event (`packages/test-contracts/src/evidence.ts:3-14`): `schemaVersion`,
`sequence`, `timestamp`, `trigger`, `scenarioStepId?`, `correlationId?`, `summary`,
`imageSha256?`, `duplicateOfSha256?`, `details?`.

The trigger vocabulary is ten words (`evidence.ts:2`). Across the 219 bundles on disk
under `test-runs/`, only eight ever appear: `runtime.settle` 334, `runtime.dispatch`
245, `error` 194, `step.start` 185, `step.complete` 140, `final` 54, `checkpoint` 45,
`gateway.action` 44. `navigation` and `state.change` are **never emitted**.

**Authority.** The closing event decides the run's invariant evidence sequence
(`packages/test-runner/src/run-evaluation/run-outcome.ts:41-50`), and the bench
refuses a bundle whose `events.ndjson` carries no `error` event for a declared
failure category (`packages/test-runner/src/bench/read-run-bundle.ts:120`).

**What it is not.** The whole Flow execution is *one* dispatch/settle pair. In
`test-runs/instances/verify-t009/run-mu6kjsm3-39948391/events.ndjson` the entire
seven-node build and run is four events: `runtime.dispatch "Build a Flow from the
live instruction task and run it"` at 06:20:47.599, `runtime.settle "The live Flow
build finished"` at 06:21:37.197, then two `error` events. There is no per-node event.

### 1e. The campaign summary

`summary.json` and `summary.md` (`scripts/lab/live-campaign/summary/write-summary.mjs:6-9`).
Top level: `schemaVersion`, `campaignId`, `startedAt`, `finishedAt`, `options`,
`environment`, `totals`, `tasks[]` (`scripts/lab/live-campaign/runner.mjs:21`).

`totals` (`summary/totals.mjs:2-14`): `tasks`, `passed`, `succeeded`, `failed`,
`noResult`, `judgementsPassed`, `providerCalls`, `reportedTokens`, `reportedCostUsd`.

Each `tasks[]` row (`row/summarize-task.mjs:47-90`): `taskId`, `scenarioId`,
`workflowId`, `variantId`, `kind`, `instruction`, `judgeBy`, `expectedDatasetId`,
`runId`, `verdict`, `succeeded`, `exitCode`, `attempts`, `ramFaults[]`,
`repeatedFailure`, `flowCreated`, `actionTypes[]`, `createdFlowShape`, `judgement`,
`repair`, `providerCalls`, `reportedTokens`, `reportedCostUsd`, `spendSource`,
`callsWithoutReportedTokens`, `failureCategory`, `automationFailure`,
`declaredFailure`, `issueCodes[]`, `runPath`, `runnerMessage`.

`judgement.dataset` carries per step `{status, expectedRecords, observedRecords,
matchedRecords, recordsListed}` and passes only when every judged step matched in
count and, where listed, in value (`row/dataset-judgement.mjs:9-10`).

**There is no per-task duration on a row.** The only wall-clock figures in the whole
summary are the campaign's `startedAt`/`finishedAt`.

---

## 2. Model-free replay today: how it is invoked, what it records, and whether the page can be reset mid-run

There are **two** model-free replays, and they are different things.

### 2a. `lab replay` — a separate invocation, a fresh topology

`packages/test-runner/src/cli.ts:46-49` → `replaySavedFlow`
(`packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts:105`). Command
parsing at `commands.ts:104-112`: it requires `--workspace` and `--flow` and refuses
`--target`, because a Flow outlives its build only on the persistent workspace.

"No model" is *made* true, not observed
(`replay-saved-flow.ts:118-121`, `:153`, `:170`):

- refuses to start if any provider credential variable is in its environment;
- deletes every `llm` Secret Key Core holds (`removeCoreProviderKeys`);
- passes no `llmExecution`, so Core runs `adaptiveMode: "deterministic"`.

It resets and reloads before running (`:167-169`): `resetScenarioLab(...)`, then
`armScenarioVariant(...)` if the workflow has a variant, then `browser.openStart()`.

It records to `<runs>/replays/<replay-id>.json` (`:206-233`): `replayId`, `verdict`,
`reasons[]`, `workspace`, `projectId`, `flowId`, `flowContentHash {before, after}`,
`task`, `address {scenarioOrigin, scenarioPortRetained, savedNavigationOrigins[],
servedAtSavedAddress}`, `model {environmentCredentialVariables[], coreProviderKeys,
executionGrant: null, coreProviderCallCount, accountedCalls, calls, interventions,
harnessActivations, llmGate, resultVerification}`, `run {runtimeRunId, status,
actions[{actionType, status}], failure, route}`, `extraction[]`, `datasets[{records,
sha256}]`, `playbackGoalHeld`, `error`, `resultPath`.

**Cost:** it calls `startTopology` (`:136`) — a fresh Core, a fresh browser, a fresh
login. That is the wrong shape for a per-attempt dry run. **No `<runs>/replays/`
directory exists anywhere under `test-runs/`, so `lab replay` has never been run
here** and there is no measured wall clock for it.

### 2b. `replayRepairedFlow` — in-run, on the live topology. This is the dry run.

`packages/test-runner/src/flow-lane/repair/replay-repair.ts:79-89`, one replay at
`:91-125`. It is already exactly the loop Design One's dry run needs:

```
prepare()                       // replay-repair.ts:94
executeRecordedFlowRun(...)     // :95-103, no llmExecution passed
getRunDetail(...)               // :106, provider calls read from Core's ledger
checkGoal()                     // :107
```

`prepare` is wired at `run-repair-lane.ts:94` to
`resetScenarioLab(scenarioOrigin, runToken)` followed by the lane's own
`prepareFlowPage` (arm the variant, then load the start page —
`run-scenario.ts:252-264`). The comment at `replay-repair.ts:62-65` states the
contract: "Puts the page back the way the Flow expects to find it: the scenario lab
reset, the variant armed again, the start page loaded. Called before every replay."

**So yes — the Lab can already reset a scenario page to a known start state mid-run,
without restarting anything.** The same reset already runs unconditionally between a
created Flow's build and its playback (`flow-lane/creation/lane.ts:138-139`).

What one replay records (`RepairReplay`, `replay-repair.ts:20-38`): `index`,
`outcome` (`ran`/`unreachable`), `runId`, `status`, `providerCalls`,
`harnessActivations`, `modelCalled`, `goalPassed`, `flowSucceeded`. The set is
published to `snapshots/repair-lane.json` (`run-repair-lane.ts:96`).

**Gap for Design One:** a replay records `flowSucceeded` as a single boolean
(`replay-repair.ts:117`) and no per-node statuses. A dry run that fails must hand
the model *the failing node*; `RepairReplay` names no node, and neither does the
`actions[]` array a snapshot writes (`run-flow-lane.ts:428-437` drops the node id).

**Cost of the reset itself:** `resetScenarioLab` is one authenticated `POST
/__control/reset` bounded at 5,000 ms (`reset-scenario-lab.ts:14-18`);
`armScenarioVariant` is one `POST /api/<scenario>/<operation>` bounded at 5,000 ms
(`lab-control/arm-variant.ts:17-22`). Both are loopback. The start-page load is one
`page.goto` (`saved-flow-replay/replay-browser.ts:61`).

**Nothing in the campaign reads the replay record.** `bundle.mjs:12` reads four
files and `snapshots/repair-lane.json` is not one of them, so
`repairOutcome` hard-codes `replayProviderCalls: null`
(`row/repair-outcome.mjs:14`, `:45`) and the summary prints "not replayed"
(`summary/markdown.mjs:48`).

---

## 3. What is recorded about a node failure and a retry — and whether a reader could name the rung

### What exists

- **Per attempt, in Core's order.** A retried node appears once per attempt:
  "In attempt order, one entry per attempt that names a node, so a retried node
  appears once per attempt" (`persisted-flow-run.ts:489`).
- **Per attempt fields** (`PersistedFlowAction`, `persisted-flow-run.ts:79-105`):
  `actionType`, `status`, `startedAt`, `durationMs`, `failure`
  (`AutomationStudioFailureRecord`: category + code), `recordCount`,
  `comparisonStatus` (Core's transition comparison, e.g. `matched`, `blocked`),
  `targetResolution`, `evidencePackets[]`.
- **Per run**: `harnessRecovery` (contracts `harness-recovery.ts:19-40`) —
  interventions, runtime patch attempts with `preflightOk`/`executed`/`issueCodes`,
  the change verdict `{outcome, basis[]}` (:96-101), and `refusalCode` for a recovery
  that was never allowed to start (:29-39).
- **Per run**: `stoppedWithoutFailedAttempt {attemptedActions, unvisitedActions}`
  (`run-flow-lane.ts:369-376`) and `startCandidateIndex` (`:414`).

### Could a reader today tell which of the five rungs resolved a failure?

**No. Not one of the five is observable.**

| Rung | Nearest evidence today | Why it does not answer |
| --- | --- | --- |
| 1 — re-resolve target | `action.targetResolution` (`persisted-flow-run.ts:154-160`) | Only the *final* `status`, `candidateCount`, `minimumConfidence`, `confidence`, `normalizedScore`. It names no strategy and records no sequence of attempts. The strategy vocabulary exists — `selector`, `coordinates`, `visual-target`, `fingerprint`, `active-element`, `scored-candidate` (`domain/src/actions/types.ts:387-393`) — on `WebAutomationTargetResolution` (`:418-425`), but that record "reaches Core inside the dispatched result, which Core stores on the attempt's `outputs`; the run detail drops `outputs`, so no endpoint this lane reads can return it" (`persisted-flow-run.ts:149-153`). |
| 2 — wait for readiness | nothing | No node carries a recorded readiness condition, and nothing records a wait. `durationMs` per attempt would grow, but it is not written to the snapshot at all (`run-flow-lane.ts:428-437`). |
| 3 — post-state already true | nothing | `comparisonStatus` is Core's comparison of what the attempt *did* against the node's expected transition; there is no "skipped because already true" status and no per-node status vocabulary the Lab pins (`persisted-flow-run.ts:99-104`, `:543-554`). |
| 4 — diverged pre-state | nothing | A target that cannot be found reports `unresolved_no_candidates` with `candidateCount: 0` — exactly the "target not found" the design says is misleading. Observed on a **succeeded** attempt in `test-runs/instances/verify-t009/run-mu6kjsm3-39948391/snapshots/flow-lane.json`. |
| 5 — clear known interference | nothing | No node kind marks a dismissal, and no record says one was run out of order. |
| 6 — escalate to model | **this one is measurable** | `harnessRecovery.interventions[]` and `harnessRecovery.refusalCode`. |

Two further blind spots that matter to Design One's "failures are part of the record":

- **A retried node cannot be joined to its node.** `flowActionsSnapshot`
  (`run-flow-lane.ts:428-437`) drops the node id, so two `web.dom.click` entries in a
  row are indistinguishable from one click node retried twice. `attemptNodeIds` is
  computed (`persisted-flow-run.ts:489`) and consumed internally only, for early-stop
  detection and `startCandidateIndex` (`:387-390`); it is never published.
- **A build's failed tool calls are usually invisible.** `evidenceLoop.steps` is
  documented as "every decision of a refused build, in order"
  (`build-proposal.ts:73-74`), i.e. only on a **refused** build. In the proposed build
  at `run-mu6kjsm3-39948391/snapshots/flow-lane.json`, `evidenceLoop.steps` is `null`
  and only `toolIds` and counts survive. Likewise the exploration record's per-step
  trace is explicitly "not published" by Core today
  (`live-llm/exploration-record.ts:64-74`).

---

## 4. How a scenario declares expectations, and what "absorbed by rung 2, zero provider calls" would take

### The declaration surface today

- **`ScenarioExpected`** (`packages/test-contracts/src/scenario.ts:161-168`):
  `pageFacts`, `recordingEvents`, `actions`, `finalState`, `allowedConsoleErrors`,
  `extracted`, `failure`. Declared on the manifest, on each `workflows[]` entry
  (`:201-206`), and on each `variants[]` entry (:188-193), where "each field it sets
  replaces the workflow's field of the same name, and omitted fields are inherited"
  (`:170-179`).
- **The oracle** is `expected.finalState` (or `playbackGoal.successFacts`, `:144`),
  checked by `checkFinalState` (`run-scenario.ts:277-280`) / `playbackGoalHeld`
  (`replay-saved-flow.ts:239-246`).
- **`expectedRecords`** is not declared directly. A fixture declares
  `ExpectedExtraction {step, count?, records?, pages?, optionalFields?, truncated?}`
  (`scenario.ts:134-141`); the measurement derives `expectedRecords` as "the number it
  listed, else the count it stated, else the number observed"
  (`evaluation.ts:144-149`).
- **A variant is armed** through the fixture's own `mutate(operation, payload)`,
  exposed as `POST /api/<scenario>/<operation>` (`lab-control/arm-variant.ts:14-23`).
- **Task contracts.** `LiveInstructionTask {id, scenarioId, variantId?, kind,
  instruction, judgeBy, expectedDatasetId?, variantArmedAfterBuild?}`
  (`flow-lane/creation/instruction-task.ts:21-31`), validated entry by entry at load
  so an unjudgeable task refuses before a grant is issued (:5-6, :48-58).
  `LiveRepairTask {id, scenarioId, workflowId?, variantId?, kind: "repair", expect:
  "repair" | "refusal", patchKind?, description}`
  (`apps/scenario-lab/src/scenarios/live-repair-tasks.ts:39-52`).

### The precedent for a negative expectation

`expected.failure` already lets a fixture say "the automation must refuse". The
machinery is `declaredFailureVerdict`
(`packages/test-runner/src/run-evaluation/declared-failure-verdict.ts:43-70`): such a
run passes by reporting exactly the declared failure, and the declaration overrides
**only** `action.dispatch` / `action.targeting` (`:22`) — never the oracle, never a
facility failure. That is the exact shape a rung expectation should copy.

### What "this variant must be absorbed by rung 2 with zero provider calls" needs

1. **A rung vocabulary in a contract.** There is none anywhere in
   `packages/test-contracts/src/`. It belongs beside
   `harnessChangeVerdictOutcomes` (`harness-recovery.ts:84`) as a closed list, e.g.
   `["retarget", "await_readiness", "post_state_satisfied", "pre_state_diverged",
   "interference_cleared", "model"]`.
2. **A per-node record of which rung ran and which resolved.** Section 3 shows
   nothing carries it today. It must reach `snapshots/flow-lane.json`'s `actions[]`
   (`run-flow-lane.ts:428`) and `evaluation.json`'s `harnessRecovery`
   (`evaluation.ts:308`), which means Core must publish it on the attempt.
3. **A node identity on the published attempt.** Without it the assertion "rung 2
   absorbed *this* node" cannot be written (`run-flow-lane.ts:428-437`).
4. **A new member on `ScenarioExpected`,** e.g.
   `expected.recovery?: { node?: string; absorbedBy: RecoveryRung; providerCalls: 0 }`,
   inherited variant-over-workflow like every other member (`scenario.ts:170-179`)
   and validated in `scenario-workflow.ts` alongside the others.
5. **An assertion and a verdict rule** modelled on `declared-failure-verdict.ts`, so
   a variant that declares a rung passes by hitting it and fails by needing a
   different one — and so the oracle still wins (`declared-failure-verdict.ts:60-64`).
6. **The zero-call half is currently inverted and must be fixed.**
   `assertLiveLlmProviderWasReached` (`live-llm/budget.ts:101-109`) **fails any
   `--live-llm` run that reached no provider**: "`--live-llm` is a request for a real
   provider call, so a run that finished without one has not done what was asked"
   (:94-96). A variant that is meant to be absorbed with zero calls would therefore
   fail today under exactly the flag that makes the model available. This
   assertion needs a declared-zero-calls exemption, or the run must carry a grant and
   declare that it must go unspent.
7. **Switchable fixture conditions.** Design Three's five conditions (latency, timed
   overlay, renamed control, varying rows, expiring session) are variants like any
   other — the arming transport already exists (`arm-variant.ts`) — but no fixture
   declares a *timer*-driven arm today; every `arm` is a single synchronous mutate
   before the page is loaded (`run-scenario.ts:252-264`).

The zero-call side is already assertable from existing evidence once (6) is settled:
`assertProviderFreeRun` (`ui-e2e/journeys/provider-free-run.ts:22-27`) checks
`providerCallCount`, `llmAccounting.calls`, `interventions`, `adaptationIds` and
`changeProposalIds` are all zero, and `RepairReplay.providerCalls` does the same for
a replay (`replay-repair.ts:106`, `:137-138`).

---

## 5. Cost of a mandatory dry run on every build the Lab measures

### Provider calls: zero, by construction

A dry run passes no `llmExecution`, so Core starts it `adaptiveMode: "deterministic"`
and resolves no provider at all (`replay-saved-flow.ts:172` comment;
`docs/architecture/testing-facility.md:568-571`). `replayRepairedFlow` makes the same
guarantee in-run (`replay-repair.ts:9-12`). **The dry run itself adds no calls.**

The indirect effect is the opposite of a cost: Design One returns a failing dry run
to the model, so a *failing* build gains one or more extra build calls per iteration.
Measured build cost today, across the 87 created-Flow runs on disk: median 5 calls
observed in the campaign of 2026-09-18, median build wall clock 21.3 s (min 6.4 s,
max 51.7 s), reading `snapshots/flow-lane.json` `build.durationMs` and
`build.providerCalls`. At the observed DeepSeek rate in
`test-runs/campaigns/2026-09-18T06-19-25-348Z/summary.json` — 11 calls, 84,435
tokens, $0.0387 total — one extra build iteration costs roughly **$0.004 to $0.02**.

### Run time: additive, and measurable from what is already on disk

The components of one dry run, all of them already implemented:

| Step | Source | Cost |
| --- | --- | --- |
| `resetScenarioLab` | `reset-scenario-lab.ts:14-18` | one loopback POST, bounded 5,000 ms |
| `armScenarioVariant` (if any) | `arm-variant.ts:17-22` | one loopback POST, bounded 5,000 ms |
| load the start page | `replay-browser.ts:61` / `run-scenario.ts:260` | one `page.goto` on a local fixture |
| execute the Flow, model-free | `replay-repair.ts:95-103` | the node time below |
| poll for the terminal detail | `persisted-flow-run.ts:21-22` | 250 ms poll interval, 90 s bound → ≤ ~0.25 s of latency |
| read the run detail | `replay-repair.ts:106` | one Core call |
| judge the goal or dataset | `replay-repair.ts:107` | one oracle probe |

**Node execution time, measured** — summing `evaluation.json` `actions[].durationMs`
across every flow-lane evaluation under `test-runs/` (n = 111 with at least one
action):

| Nodes | n | min | median | max |
| --- | --- | --- | --- | --- |
| 1 | 16 | 2,041 ms | 2,066 ms | 4,482 ms |
| 2 | 41 | 4,079 ms | 5,140 ms | 10,506 ms |
| 3 | 33 | 4,432 ms | 6,509 ms | 15,534 ms |
| 4 | 11 | 6,702 ms | 11,956 ms | 13,729 ms |
| 5 | 6 | 8,938 ms | 11,167 ms | 16,177 ms |
| 6 | 3 | 13,312 ms | 13,605 ms | 17,929 ms |
| 7 | 1 | 22,363 ms | 22,363 ms | 22,363 ms |

Per-node: min 1,477 ms, **median 2,268 ms**, max 5,253 ms.

**So one dry run costs roughly 2.3 s per node plus about 1 s of reset, arm, page load
and read-back** — call it **5 s for a 2-node Flow and 25 s for a 7-node Flow**.

**Against what a build costs now.** Across the 87 created-Flow runs on disk, the whole
`lab run` invocation has a median `evaluation.durationMs` of **80.7 s** (min 37.4 s,
max 203.9 s), of which the build is a median 21.3 s. A single mandatory dry run is
therefore **about 6% to 30% more wall clock per attempt** — materially cheaper than
one provider call, which the same corpus shows costing roughly 4 s of build time each.

**Worked example, end to end.** `test-runs/instances/verify-t009/run-mu6kjsm3-39948391`
(`social-scheduler-retry-failed`, 7 nodes, 5 provider calls): build 44,587 ms
(`snapshots/flow-lane.json` `build.durationMs`), node execution 22,363 ms, whole run
153,360 ms. A dry run before the proposal would have added ~25 s to a 153 s run, and
would have caught the defect the campaign actually recorded — 10 records observed
against 10 expected with **`matchedRecords: 0`**.

**Campaign-level.** `scripts/lab/live-campaign/runner.mjs:9`, `:23` runs tasks "in
order, one at a time", so the added time is strictly additive, not amortized. The
2026-09-18 campaign ran 3 tasks in 6 m 08 s (`summary.json` `startedAt`/`finishedAt`).
At a median 5-node Flow the same campaign would gain roughly 12 s per task, ~7%.

**Two costs that are not time.** A dry run that fails must be iterated on, so the
bound must be a number of dry-run cycles per build, or a failing build loops until its
token budget is spent (the budget is the only backstop today,
`live-llm/budget.ts:44-48`). And a dry run makes the page dirty twice, so the
reset that already runs between build and playback
(`flow-lane/creation/lane.ts:138`) must run once per dry run as well — which
`run-repair-lane.ts:94` already does correctly.

**Not measured.** No `<runs>/replays/` directory exists and the campaign records
`replayProviderCalls: null` for every repair row (`row/repair-outcome.mjs:14`), so
neither replay path has ever been exercised end to end on this machine. Every timing
above is composed from per-action and per-run durations in existing bundles, not from
an observed replay.

---

## New evidence fields required

Each field the two designs would need the Lab to record, with the file that would
write it.

### For Design One (authoring by accrual)

| Field | Where it must be written | Why |
| --- | --- | --- |
| `build.draft {nodeCount, effectualCalls, observationalCalls, exploratoryMarked, deletedNodes, replacedNodes, insertedNodes, reorderedNodes, branches, loops}` | `packages/test-runner/src/flow-lane/creation/build-proposal.ts:76` (`CreatedFlowBuild`), surfaced by `creation/snapshot.ts:23` | Nothing today distinguishes a node that accrued from a node the model composed. `flowShape` counts the final Flow only. |
| `build.evidenceLoop.steps` on a **proposed** build, not only a refused one | `build-proposal.ts:191` | Today `steps` is `null` on every successful build (observed in `run-mu6kjsm3-39948391`); the accrual trail is exactly this list. |
| `build.failedCalls[] {toolId, resultCode, effectApplied}` | `build-proposal.ts:49` (`CreatedFlowBuildStep` already has the shape) | "A failed call ended the build and was absent from the trace." |
| `build.dryRun {attempts, nodesPassed, nodesFailed, firstFailedNodeId, firstFailedNodeIndex, providerCalls, goalHeld, datasetMatched}` | a new member on `CreatedFlowBuild` (`build-proposal.ts:76`), written by `flow-lane/creation/lane.ts` around `:138`, published through `creation/snapshot.ts:23` | The dry run's verdict is the whole point of Design One and no artifact has a place for it. |
| `RepairReplay.nodes[] {nodeId, status, failure}` | `packages/test-runner/src/flow-lane/repair/replay-repair.ts:20-38` and `:108-118` | A dry run must hand the model the failing node; `flowSucceeded` is a single boolean. |
| `dryRuns` / `dryRunIterations` on a campaign row | `scripts/lab/live-campaign/row/summarize-task.mjs:47` | A build that needed four dry runs and one that needed none must not read alike. |
| `snapshots/repair-lane.json` added to the campaign's bundle read | `scripts/lab/live-campaign/row/bundle.mjs:12` | The replay record already exists and is read by nobody; `repair-outcome.mjs:14` hard-codes `replayProviderCalls: null` because of it. |
| per-task `durationMs` on a campaign row | `scripts/lab/live-campaign/runner.mjs:50` (the runner already holds both clocks) | Without it the cost of a mandatory dry run cannot be measured from the summary. |

### For Design Two (the recovery ladder)

| Field | Where it must be written | Why |
| --- | --- | --- |
| `RecoveryRung` closed vocabulary | `packages/test-contracts/src/harness-recovery.ts` (beside `harnessChangeVerdictOutcomes`, `:84`) | Nothing names a rung today. |
| `action.nodeId` and `action.attemptIndex` | `packages/test-runner/src/flow-lane/run-flow-lane.ts:428` (`flowActionsSnapshot`) — the value already exists at `persisted-flow-run.ts:489` and is discarded | Without it a retried node cannot be joined to its node, so no rung claim can be checked. |
| `action.recovery {rungsRun[], resolvedBy, observations[]}` | `flowActionsSnapshot` (`run-flow-lane.ts:428`), fed from a new field on `PersistedFlowAction` (`persisted-flow-run.ts:79-105`) — requires Core to publish it on the attempt | The single answer questions 3 and 4 both need. |
| `action.targetResolution.strategy` (and `bestScore`, `runnerUpScore`) | `persisted-flow-run.ts:157` (`PersistedTargetResolutionField`) — but the browser's record is dropped by Core's run detail (`persisted-flow-run.ts:149-153`), so Core must carry `WebAutomationTargetResolution` (`domain/src/actions/types.ts:418-425`) out of `outputs` | Rung 1's "fingerprint, then anchors, then name, then selector, then text" is unmeasurable without the strategy that won. |
| `action.readiness {conditionRecorded, waitedMs, satisfied}` | `persisted-flow-run.ts:79` → `run-flow-lane.ts:428` | Rung 2. |
| `action.stateCheck {preStateHeld, postStateAlreadyTrue, digestBefore, digestAfter}` | same two files | Rungs 3 and 4; `comparisonStatus` alone cannot express "skipped, already true". |
| `action.interferenceCleared {dismissalNodeId, retried}` | same two files | Rung 5. |
| `harnessRecovery.escalations[].ladderSummary {rungsRun[], divergence}` | `packages/test-contracts/src/harness-recovery.ts:19` and the reader at `packages/test-runner/src/flow-lane/harness-recovery.ts:42` | Rung 6 must show it received a diagnosis, not a bare failure. |
| `expected.recovery {node?, absorbedBy, providerCalls}` | `packages/test-contracts/src/scenario.ts:161` (`ScenarioExpected`), resolved by `scenario-workflow.ts`, asserted in a new module beside `run-evaluation/declared-failure-verdict.ts` | The declaration Design Three's variants need. |
| a declared-zero-calls exemption | `packages/test-runner/src/live-llm/budget.ts:101` (`assertLiveLlmProviderWasReached`) | Today a `--live-llm` run that correctly spends nothing **fails**. |
| a per-rung column in the campaign summary | `scripts/lab/live-campaign/row/summarize-task.mjs:47` and `summary/markdown.mjs:39` | "Which rung absorbed it" is the headline number of Design Two. |
| `navigation` / `state.change` evidence events, or their removal | `packages/test-contracts/src/evidence.ts:2` and whatever would emit them | Both are in the trigger vocabulary and were emitted zero times across 219 bundles; a ladder that waits for readiness has an obvious use for `state.change`. |
