# t758 launch-path audit (read-only, current dev code in the t758 trees)

Trees: Lab `C:/Users/osrs_/FluxStuff/fxwork/t758/!FluxIQWebExtension` (HEAD bf4aeda2, branch `task/t758-adaptation-gate-refresh`; local `dev` is bcec9915), Core `.../t758/!FluxIQ` (HEAD 08d95721, same-named branch; `dev` is 0305b482). Paths below are relative to the Lab tree unless marked Core. No Lab run, model call or index-changing git command was made.

## Outcome

Done. The three gate tasks, their variants and the arm path all exist and are consistent. The launch path reaches playback on the armed variant, the repair lane and the in-run replay in every authoring mode; no mode skips a step. Four traps to fix in the launch recipe: the Lab's default mode is `legacy`, not `project`; `.env.local` pins the wrong target and ceiling; the plan's `--llm-max-calls 64` is valid but the brief's 250 is the hard maximum; and a run can exit 0 with `adaptationGate.counted: false`. Nothing provider-free exercises the three armed variants through a Flow (section 4).

## 1. Tasks, variants, arming

All three tasks exist with `variantArmedAfterBuild: true` (the field is current, not renamed). The loader accepts it only with a `variantId` (`packages/test-runner/src/flow-lane/creation/instruction-task.ts:142-144`, `TASK_FIELDS` at 86; contract `apps/scenario-lab/src/scenarios/live-instructions.ts:40`).

| Site | Task id (file:line) | Variant, arm payload | Server op |
| --- | --- | --- | --- |
| crossborder-marketplace | `...-hub-to-cart-basket-redesign-after-creation`, `crossborder-marketplace/live-tasks.ts:102-110`; `judgeBy: playback-goal`, no permission point | `basket-redesign`, `crossborder-marketplace/manifest/manifest.ts:65-67`, `set-mode {mode:"basket-redesign"}`; page facts: recorded Add to cart gone, cart 0, coupons held | `state/mutate.ts:40` (`"set-mode": setMode`); mode listed in `state/types.ts:29` |
| everything-store | `...-first-page-plus-earbuds-deal-wheel`, `everything-store/live-tasks.ts:55-58`; `expected-dataset` `extract-first-page` | `deal-wheel`, `everything-store/workflows/first-page.ts:85-91`, `set-mode {mode:"deal-wheel"}`; final fact `wheel-closed` | `state/mutate.ts:22`; popup renders from `pages/results/search.ts:43` (mode deal-wheel and nudge pending); dismiss op `state/guard-ops.ts:38-41` |
| social-network-feed | `...-group-post-regrouped-after-creation`, `social-network-feed/live-tasks.ts:60`; `playback-goal`, permission point `send_or_publish` on "Post" (line 5) | `regrouped`, `social-network-feed/manifest.ts:127-131`, `set-mode {mode:"regrouped"}`; fact `recorded-prompt-gone` | `social-network-feed/state.ts:47` |

Arm path: `packages/test-runner/src/lab-control/arm-variant.ts:14-27` POSTs `/api/<scenario>/<operation>` with the run's bearer token and the payload; a non-2xx throws `fixture.invalid`. The created-Flow lane's `prepareFlowPage(moment)` is `run-scenario.ts:292-300`:
- `moment === "build"` with `variantArmedAfterBuild` leaves the site unarmed (`unarmedBuild`, line 296) and skips the armed-facts assertion;
- any other moment, including `"playback"` and the repair lane's replays, arms it (line 297) and then asserts the armed facts on the freshly loaded page (line ~307), so a fixture that did not arm fails loudly rather than silently;
- the recording-style arm at lines 280 and 447 is skipped for the created-Flow lane (`!flowLane`).

Fixture-level unit tests cover each arm: crossborder `tests/scenario.test.ts:71`, everything-store `tests/scenario.test.ts:228`, social `tests/scenario.test.ts:199`. Not run (brief forbids runs).

## 2. Authoring mode and the steps `--replays 1` reaches

- The Lab default is `legacy`, not `project`. `packages/test-runner/src/live-llm/authoring-mode-env.ts:35` (`LAB_DEFAULT_AUTHORING_MODE = "legacy"`, applied at line 44). Core's own default is `project` (Core `packages/fluxiq/src/programs/automation-studio/model/authoring-mode/authoring-mode.ts:41`), but the Lab always passes `FLUXIQ_AUTHORING_MODE` explicitly and drops any inherited value (`environment.ts:151-164`). The file's own header comment says the Lab's default is its own for exactly this reason. The live-guard ledger restates `legacy` as the default (`scripts/lab/live-guards/live-launch.mjs`, `LAB_DEFAULT_AUTHORING_MODE`). So a run that names no `--authoring-mode` builds in legacy, which is neither the plan's `candidate` nor the product's `project`. Name the mode explicitly.
- Admission per mode: `legacy` always; `candidate` and `project` need Core's trial runner and, unless `--model-reset-only`, the fixture start hook (`flow-lane/creation/readiness.ts:93-107`, checked before Core starts at `cli.ts:123-126` and again against the running Core at `flow-lane/creation/lane.ts:362-363`). `project` through the direct-API build is refused (`build-proposal.ts:378-379`); the chat entry is the default so this does not apply. The chat build deadline is longer for `project` (`chat/build-deadline.ts:22-23`).
- Steps after the build do not depend on the mode. In `run-scenario.ts` the created-Flow branch (line ~410) runs, in order:
  1. build from the chat, then the Flow's judged whole run on the unarmed site (P1);
  2. `runCreatedFlowLane`: playback with `authorizeRun: live.repairAuthorizer` (the playback's intent is `explore_and_adapt`, `live-llm-run.ts:94`), arming through `prepareFlowPage("playback")`, harness recovery and diagnosis as Core records them, then judgement by the task's oracle;
  3. `proveRepair` = `runLiveRepairLane` (`run-scenario.ts:350-356`), called on a pass at line 439 and, with `laneFailure`, on a failed judgement at line 436 (t512);
  4. in the lane (`flow-lane/repair/run-repair-lane.ts:134-212`): `applyLiveRepair` approves and applies each adaptation and reads the Flow's hashes before and after (`apply-repair.ts`, `stepsHash`/`contentHash`); `replayRepairedFlow` runs N model-free replays, each reset and re-armed through `prepare` (line ~171); `classifyAdaptationGate` (`run-evaluation/adaptation/gate.ts:82-102`); writes `snapshots/repair-lane.json` (line 194) and `snapshots/adaptation.json`; then `assertRepairPersisted` (210), `assertLiveRepairProof` and `assertReplaysAccounted` (211-212).
- The only conditions that skip steps are not mode-related:
  - `runLiveRepairLane` returns `undefined` unless `--replays` is given (line 139). Without `--replays` there is no apply, no hash proof, no replay, no gate record.
  - `--replays 0` applies but replays nothing, so the gate says `no_replay`.
  - A failed judgement records the lane and applies and replays nothing (`recordFailedLane`, line 220+).
  - An unkept re-author is recorded and fails the run before apply (line 147).
  - A clean pass (no recovery) takes the `cleanCreation` branch (line 161): the Flow is replayed as "unchanged creation reuse" and the run exits 0, but the gate reads `no_recovery_attempted`. This is the silent way a gate run does not exercise the drift (fingerprint matching or a passed retry absorbed it). Read `adaptationGate` in `repair-lane.json`, not the exit code.
  - `no_proposal` with recovery attempted and not a clean creation throws "did not qualify for its requested replay" (`prove-repair.ts`, `assertLiveRepairProof`).
- The Flow survives for Step B only on `persistent-isolated` with `--workspace`.

## 3. Live-run requirements and exact commands

Flags and env, each verified in code:
- `--live-llm --llm-profile <id> --llm-provider deepseek --llm-task create-flow` are required (`commands.ts` `llmOptions`); `--llm-model` defaults to `deepseek-flash` (`test-contracts/src/llm.ts:16`). `diagnose`, `adapt`, `repair` are refused (`live-llm-plan.ts:244`).
- `--llm-max-calls`: 1 to 250 (`LLM_LAB_MAX_CALLS_PER_RUN`, `test-contracts/src/llm.ts:51`); the default is 26 (line 158). Both 64 (plan) and 250 (brief) are legal.
- `--llm-max-cost-usd` may only equal or lower the ceiling, and for a chat build it must equal the ceiling or `assertChatBuildable` refuses (`live-llm-run.ts:230-233`; `max-cost-within-ceiling.ts`). The ceiling comes from `FLUXIQ_LLM_RUN_COST_CEILING_USD` in the process env, then `.env.local`, then 0.10 (`cost-ceiling-env.ts`). The t758 `.env.local` says `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.10` and `FLUXIQ_TEST_TARGET=isolated`. So the process env must set `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25` and `FLUXIQ_TEST_TARGET=persistent-isolated` (a process variable beats a file, `target-config.ts:214-218`), or `--target persistent-isolated` throws a conflict and `--llm-max-cost-usd 0.25` is refused.
- Chat build: `--llm-permit` is refused; the model must equal Core's default (pass `--llm-model deepseek-flash`); `--no-live-panel` is refused (`commands.ts` `creationOptions`); `--direct-api-build` would never count. The default entry is the chat, which is "started from chat".
- Headed: `FLUXIQ_DEMO_HEADLESS` defaults to false (`demo-workspace/configuration.ts:92`); keep it unset or false.
- `--workspace` is lowercase, at most 64 characters, `[a-z0-9._-]` (`target-config.ts:142`).
- `--model-reset-only` only applies to candidate/project and is not needed (fixture reset stays on). Do not pass it.
- Live guards (`scripts/lab/live-guards/`), asked before any build, skipped by `--dry-run`:
  - `balance`: no `lab-slots/STOP-balance` (absent now); not overridable.
  - `behind-dev`: HEAD must contain local `dev` in both trees, or lack only docs/Markdown commits. Today Lab lacks bcec9915 and Core lacks 0305b482; both diffs touch only `AGENTS.md` and docs, so it passes (`rules/behind-dev.mjs`). A code merge to `dev` before launch would refuse until `git merge dev` is done in the affected tree (the supervisor's step, not mine).
  - `loop`: at most 3 live starts per instance per 30 minutes.
  - `debug`: the instance's previous live run must have `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` in the launching tree (`admit-live-run.mjs`, `DEBUG_DIRECTORY`). Existing instance names in the ledger (`t275-slot-4`, `t451-slot-1`, `t418-slot-3`, `rr5-slot-*`) have previous runs; use a fresh instance name per gate lane (for example `t758-slot-3`) so the rule has no history, or write the missing debug. I did not verify which of those old runs have debugs in this tree (460 debug files exist).
  - `unchanged`: a failed previous run of the same instance, task and authoring mode on a byte-identical source is refused; mode is part of the key.
  - Overrides are files only a person creates (`lab-slots/OVERRIDE-<rule>`); none exist.
- Instance and slot rules: `FLUXIQ_LAB_INSTANCE` is lowercase kebab-case, at most 64 characters, and is the only thing that matters. It sets the build output and the runs directory `test-runs/instances/<instance>`, which holds the persistent workspace. `lab-slots/slot-N` are markers only; nothing in code reads them. Use the same instance for Step A and Step B.
- Core staleness: `FLUXIQ_LAB_CORE_BRANCH` is only compared when Core is detached (`scripts/lab/core/commit/behind-target.mjs`). The t758 Core is on a branch, so it never refuses; setting the variable to the Core branch name is harmless.
- The key: `.env.local` in the t758 Lab tree has `DEEPSEEK_API_KEY`; the process env wins if set. Never log it.

Step A, from `C:/Users/osrs_/FluxStuff/fxwork/t758/!FluxIQWebExtension` (PowerShell shown; replace `<slot>` with a fresh kebab-case instance, for example `t758-slot-3`). Mode shown is `candidate`, as the plan's Step A; to gate on the product default use `project` (the guard treats them as different experiments).

```powershell
$env:FLUXIQ_TEST_TARGET="persistent-isolated"; $env:FLUXIQ_LLM_RUN_COST_CEILING_USD="0.25"
$env:FLUXIQ_LAB_INSTANCE="<slot>"; $env:FLUXIQ_LAB_CORE_BRANCH="task/t758-adaptation-gate-refresh"; $env:FLUXIQ_DEMO_HEADLESS="false"
pnpm lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash `
  --authoring-mode candidate --llm-task create-flow --instruction-task <task> --target persistent-isolated `
  --workspace adapt-<site>-<n> --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

Per site (`<scenario>` / `<task>` / workspace):
- crossborder: `crossborder-marketplace` / `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` / `adapt-crossborder-1`
- everything-store: `everything-store` / `everything-store-first-page-plus-earbuds-deal-wheel` / `adapt-everything-1`
- social: `social-network-feed` / `social-network-feed-group-post-regrouped-after-creation` / `adapt-social-1`

`--llm-max-run-tokens 48000000` is accepted as any safe integer (`optionalIntegerOption`); I did not check it against Core's token cap beyond `runTokenBudget` in `live-llm-plan.ts:132`, which a `--dry-run` would exercise.

Step B (`lab replay`, no model). Needs `--workspace` (required), `--flow` (required), `--project` (the project that holds the Flow; required in practice, the lane-created project differs from the workspace default), `--instruction-task` (selects the variant to arm and the oracle). Optional: `--variant` (override the armed variant), `--seed`, `--no-tracing`. No `--target`.

```bash
env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_PROVIDER_KEY_FILES=none FLUXIQ_LAB_INSTANCE=<slot> \
  pnpm lab replay <scenario> --workspace adapt-<site>-<n> --project <projectId> --flow <flowId> --instruction-task <task>
```

The ids are in the Step A run bundle: `snapshots/creation-context.json` (`projectId`, `flowId`, `workspace`; its `savedFlowHash` is the hash right after creation, before the repair) and `snapshots/flow-lane.json`. The replay refuses when any provider credential variable is present in the process or resolved env (`replay-saved-flow.ts`, `providerCredentialVariables`), hence `env -u`. Step C is the same command with the base task id (no variant, so unarmed): `crossborder-marketplace-hub-to-cart`, `everything-store-first-page-plus-earbuds`, `social-network-feed-group-post`. These are the plan's names; I confirmed the first two ids exist as tasks only by their naming in the plan, not by reading each (crossborder `...-hub-to-cart` is at `live-tasks.ts:~120`).

## 4. Dry run and provider-free routes

- `pnpm lab run <scenario> --dry-run <same flags>` works only with `--live-llm ... --llm-task create-flow` (`commands.ts:273`). It runs the whole option check (`beginLiveLlmRun`: ceiling, plan, credential presence, chat buildability; mode readiness; `loadCreatedFlowRequest`) and prints `status: ready, providerCallCount: 0, request: describeCreatedFlowRequest(...)`, `live`, `candidateTrial`, and `coreWeb` (`cli.ts:128-133`). It starts no Core, no browser, no topology. `run-lab.mjs` still waits on and builds Core and the extension before it, and the live guards do not run for it. It needs a provider key to be findable (it reads, never calls); with `FLUXIQ_PROVIDER_KEY_FILES=none` and no key it refuses, so a probe for "no key" is the opposite check. `--dry-run` is also where to confirm the social task's `permissionPoint` and the `describeCreatedFlowRequest` output for all three. Not run.
- Bare `--flow` is refused (`commands.ts:58`, `refuseRecordingOnlyFlow`), and `--variant` on `lab run` is accepted only with create-flow (`commands.ts:67`). So there is no `lab run` form that arms a variant provider-free.
- A plain `pnpm lab run <scenario>` (no `--live-llm`) records the scenario's scripted workflow, unarmed only, with a Core round trip. It exercises each fixture's base workflow, not a Flow.
- `lab replay` is the only provider-free route that arms the variant, and it replays an existing saved Flow. It arms the task's variant, or the `--variant` override, after a reset (`replay-saved-flow.ts`, `resetScenarioLab` then `armScenarioVariant`), and verifies zero model use. It therefore needs a Flow saved by an earlier build (a paid Step A run). `--variant` allows a model-free preflight of a Flow built on the base site against the gate variant (`workflow-selection.ts`), but that Flow must already exist. I found no provider-free Flow producer that targets these three fixtures.
- `lab recovery-matrix --list|--case|--row|--ready` is provider-free and scripted-Flow based, but none of its rows names `basket-redesign`, `deal-wheel` or `regrouped` (grep of `recovery-matrix/` found no match), so it does not cover these variants. Rows 5, 6 and 11 use crossborder `flash-deal`, a different drift.
- What does cover the three armed variants provider-free: the fixture unit tests listed in section 1 (arm payload, state transitions, facts, markup) and `lab interactive <scenario> --target persistent-isolated --workspace W` for manual inspection (I did not check whether `interactive` arms variants).

## 5. Gate oracle evidence keys (P1 to P7)

All keys exist; none is renamed. Corrections to how the plan names them:
- P1 `flowCreated`: it is on the lane observation and in the run evaluation (`flow-lane/lane-observation.ts:14`, `run-evaluation/observed-run-evaluation.ts:136`), not in `snapshots/flow-lane.json`. `flow-lane.json` carries `oracleVerdict`, `reportedVerdict`, `status`, `resultVerification` (`flow-lane/creation/snapshot.ts:66-91`).
- P2 `harnessRecovery.attempted`, `interventions[]` (`kind`, `validationOk`, `validationCodes`) and `adaptationIds`: present at `snapshot.ts:85` in `flow-lane.json` under `harnessRecovery` (`test-contracts/src/harness-recovery.ts:19-291`).
- P3 `validationOk: true` is `harnessRecovery.interventions[].validationOk`. The "no out-of-request lasting act" half is the Lab's oracle and fixture final state, not a stored key.
- P4: in `snapshots/repair-lane.json` the application is `application.outcome` (`applied`), `application.adaptations[]`, and the hashes are `application.flow.before` and `application.flow.after` with `contentHash` and `stepsHash`, plus `application.flow.change` (`changed`, `changed_in_run`). `adaptations at least 1` is not a stored count in the file: use `adaptationIds.length` or `application.adaptations.length`. The count `adaptations` exists only in the published settle event (`run-repair-lane.ts` publish). Use `stepsHash`, because `contentHash` moves on Core's apply stamp alone; the gate classifier itself judges `change`, not the content hash. `adaptationPersistence` is in `snapshots/adaptation.json` (`measure.ts:120`), alongside `adaptationReuse` (51, 82), `adaptationValidation` and `adaptationCost`.
- P5: `repair-lane.json` `replays[]` each carry `outcome`, `providerCalls` (null means unknown, which fails), `harnessActivations`, `modelCalled`, `goalPassed`, `flowSucceeded`, `datasetsReproduced`, `runId` (`replay-repair.ts`). The classification is in `adaptationGate` (`counted` and `reason`, closed list at `gate.ts:25-37`). Read `adaptationGate.counted` first.
- P6: the receipt `<runs>/replays/<id>.json` has `flowContentHash.{before,after}` and `model.{coreProviderCallCount, accountedCalls, calls, interventions, harnessActivations}` (the five counters), plus `verdict`, `reasons`, `modelProvidersEnabled: false`, `task.variantId`. "Hash unchanged" means `before === after` inside the receipt; compare `before` to `repair-lane.json` `application.flow.after.contentHash`. Do not compare to `creation-context.json` `savedFlowHash`, which is the pre-repair hash and will differ on a counted run.
- P7: cost is in `snapshots/live-llm.json` and the spend ledger; headed and chat-started are recorded in the run manifest and `dry-run` `buildEntry`; the debug file is the supervisor's.

## Not verified

- No unit test, dry run, build or live run was executed. Everything is from reading code; line numbers are as of the t758 trees today.
- That the t758 trees' `node_modules` and `dist` are current for a build (I saw Core `dist` and the extension `dist` exist; I did not check freshness; `run-lab` rebuilds).
- Whether `.env.local`'s `DEEPSEEK_API_KEY` is valid or funded.
- Whether the `--llm-max-run-tokens 48000000` value passes `runTokenBudget` and Core's caps.
- Whether `lab interactive` can arm a variant.
- Old-instance debug files for the rule `debug` (only a fresh instance name avoids the question).

## Open questions and contradictions

- Plan says Step A uses `--authoring-mode candidate`; Core's product default is `project` (t667) and the Lab default is `legacy`. Which mode the gate pair freezes on needs a decision, because the guard and `unchanged` rule treat modes as separate experiments.
- The plan's Step A has `--llm-max-calls 64`, the brief 250; both are legal.
- The plan's P4 "adaptations at least 1" has no stored count key (see section 5).
