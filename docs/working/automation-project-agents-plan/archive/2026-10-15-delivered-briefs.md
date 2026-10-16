# Delivered worker briefs (archived)

Moved from the Worker Briefs section of `../../automation-project-agents-plan.md` on 2026-10-15: every brief
here was delivered and its work merged (the ledger records each). Briefs are unchanged.

### Brief: t536-w1-web-lease
- Repository: this repository, worktree `fxwork/t536/!FluxIQWebExtension`, branch `task/t536-host-lease-wire`; it builds
  against the paired Core worktree `fxwork/t536/!FluxIQ`, where Core's half (t536-a3b-lease-core) runs at the same time.
- Task: unit W1, the web side of the host lease (user, 2026-10-13: concurrent agents possible in Core, the extension
  sets one at a time). Core's types are fixed on the branch: `ClientGatewayHostLease`, `lease?` on
  `ClientGatewayActionCommand` and `CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES` in `packages/contracts/src/client-gateway.ts`;
  the port `AutomationStudioHostResourcePort` published from Core's runtime barrel. (1) New
  `domain/src/runtime/host-resources/`: the web port, `capacity: 1` (a test pins it), resource key
  `web.automation:<clientId>` (client id, not session id, so a worker restart keeps the key), epochs strictly rising
  even across a Core restart (seed from the clock), `acquire` answers `at_capacity` unless exactly one session
  qualifies by the build-path rule (`domain/src/runtime/llm-evidence/tools.ts:713-724`); expose it as `hostResources`
  from `createWebAutomationHostRuntime` (`domain/src/runtime/host-runtime.ts:136-233`). (2) New
  `domain/src/client/host-lease.ts`: validate a wire lease, build the refusal record (`client.action_result`,
  `status: "failed"`, failure `{category: "blocked_by_capability_or_policy", code: host_lease.stale |
  host_lease.holder_mismatch, retryable: false, stage: "dispatch", effect: "unacted"}`). (3) Extension: carry `lease`
  on `ServerCommandPayload` (`apps/extension/src/shared/protocol.ts:624-634`) through `gateway-session.ts:335-358`
  (the mapping drops unknown fields); in `server-command-channel.ts` check it after `answerRepeat` and before
  `reconciliation.begin` (and in the `evaluate_facts` branch): per resource key keep the highest `{epoch, holder}`
  seen in `chrome.storage.session` (new `background/connection/host-lease/`); lower epoch is stale, same epoch with
  another holder is a mismatch, higher is adopted; send the refusal directly (as `gateway-session.ts:351-355` does,
  no runtime status or recorded event) and mark it settled in reconciliation so a repeated id gets the refusal, never
  `not_seen`. (4) A leased command with no named tab runs on the automation tab (`latestOpenAutomationTab()`), not the
  tab in front; an explicit `browserTabId` still wins (`runtime/command-router.ts:38-55`, `action-runner.ts:35-62,191-214`).
- Required reads: this document's `Host Actions` and `Extension And Domain Wiring`; the files named above;
  `docs/architecture/web-capabilities.md` (command channel and reconciliation sections).
- Owns: the new directories and files above with their tests; the named lines of `host-runtime.ts`, `protocol.ts`,
  `gateway-session.ts`, `server-command-channel.ts`, `command-router.ts`, `action-runner.ts` (and `automation-tab.ts`
  only if needed); the client barrel export; `docs/architecture/web-capabilities.md` and `extension-client.md`
  sections on the lease; `docs/working/automation-project-agents-plan/reports/t536-w1-web-lease.md`.
- Must not touch: every Core file; `domain/src/runtime/llm-evidence/**`; `domain/src/io/gateway-output-dispatcher.ts`;
  `domain/src/runtime/adapter.ts`; `apps/extension/src/panel/**`; `apps/extension/src/background/activity/**`; `scripts/lab/**`.
- Definition of done: tests: capacity pinned at 1; epochs rise across a restarted port; zero or two sessions answer
  `at_capacity`; a stale or mismatched lease gets the exact record, the router is never called and nothing is
  recorded; a repeated id is answered with the refusal; a higher epoch is adopted; a lease-less command with no lease
  ever seen runs as today; the ledger survives a worker restart; a leased click and a leased navigation use the
  automation tab while another tab is in front. Checks: the tests beside each changed file, the domain and extension
  typechecks, `pnpm structure:check`. A Chromium content-harness check that a stale holder's command is refused if
  the harness can drive it; say so if not.
- Report to: `docs/working/automation-project-agents-plan/reports/t536-w1-web-lease.md`

### Brief: t539-w2-chat-attribution
- Repository: this repository, worktree `fxwork/t539/!FluxIQWebExtension`, branch `task/t539-agent-attribution-chat`;
  it builds against the paired Core worktree `fxwork/t539/!FluxIQ`, where Core's half (t539-a6-attribution-core)
  runs at the same time. W3 (Lab step-log columns) is folded in.
- Task: unit W2. The chat shows a build with several agents. Wire types are fixed on the Core branch:
  `agent?: ClientGatewayActivityAgent` on an activity and `project?: ClientGatewayActivityProjectCard` on a
  `note` row (plan, brief, return, receipt). (1) New `apps/extension/src/shared/activity/{agent,project-card}.ts`
  readers (that directory is at its file-count warning: put them in a subfolder if the audit asks).
  (2) `background/activity/unit-history.ts` and `shared/activity/history-limits.ts`: keep every event of the
  build in progress and pin project rows; a 1,500-event build keeps its plan card; ten other units never evict
  the current build. (3) `panel/chat/stream/step/messages.ts`: key per-unit decision state by
  `activityId#briefId` so a tool card attaches to its own agent's decision (one branch plus keying only; the
  file is past its size warning, so new logic goes in new `project-message.ts` and `project-words.ts`).
  Show: the plan card; "Building <subflow>: <purpose>" (or "Surveying", "Repairing", "Resetting the site") at
  a brief; that builder's steps under a subflow header; the return card; receipt cards; validator rows; the
  ending. Every step stays its own message with its reasoning and an icon card (standing rule). (4) View:
  `panel/chat/view/{step-message-view,thread-view}.ts`, `panel/chat/chat.css`, `panel/icons/lucide-nodes.ts`
  (icons must match the ones Core pins; parity test). Chrome side panel and Firefox popup share `mountPanel`.
  (5) W3: `packages/test-runner/src/lab-runs/rewrite-steps-index.ts` gains Role and Brief columns matching
  Core's `listing.ts` header word for word; `docs/architecture/testing-facility.md` step-log section.
- Required reads: this document's `Chat Presentation`; the files named above;
  `docs/architecture/extension-client.md:389-419,486-540,749-790`.
- Owns: the files named above, their tests, `shared/activity/index.ts`, `panel/chat/stream/step/index.ts`;
  `docs/architecture/extension-client.md` and `testing-facility.md` sections;
  `docs/working/automation-project-agents-plan/reports/t539-w2-chat-attribution.md`.
- Must not touch: every Core file; `background/connection/**` and `background/connection.ts` (W1, t536);
  `domain/**`; `background/activity/pacer.ts`; `packages/test-runner/src/live-llm/`; `scripts/lab/**`.
- Definition of done: tests: agent and card readers; unit history keeps the build and its plan card; messages
  for a multi-agent fixture (plan, dispatch header, builder steps under it, interleaved lanes keyed apart,
  return, receipt, validator rows, ending); view tests and the icon parity test; the Lab index columns. Checks:
  the tests beside each changed file, the extension and domain typechecks, `pnpm structure:check`,
  `node scripts/check-extension.mjs`. Say what live browser behaviour was not exercised.
- Report to: `docs/working/automation-project-agents-plan/reports/t539-w2-chat-attribution.md`

### Brief: domain-sweep-fixtures
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: fix forward the 17 domain tests the 2026-10-13 downstream sweep found failing on dev `7a93c624` (with Core
  `1f747263`; `pnpm -r test` stopped at the domain package: "# tests 2019, # pass 2002, # fail 17"). Files (source
  paths of the built tests): `domain/src/io/tests/gateway-output-dispatcher-durable-reconcile.test.ts` (4),
  `domain/src/io/tests/gateway-output-dispatcher.test.ts` (1), `domain/src/runtime/tests/adapter.test.ts` (1),
  `domain/src/tests/core-gateway-recording-order.test.ts` (1), `domain/src/tests/web-panel-host.test.ts` (10).
  Errors are Core's t519 refusals (`AutomationInstructionError`: a recording started without a description; a Flow
  with no active written instructions, then "Unknown Automation Studio Flow"). Fix the fixtures the way Core's t543
  did (Core `docs/working/automation-project-agents-plan/reports/t543-wiring-tests.md`): save the Flow's
  instructions through the product's own call and describe each recording; never relax a product gate. A failure
  that is not this cause: stop on it and report it with the evidence.
- Required reads: the five files and their helpers; the t543 report.
- Owns: the five files and test-only helpers under `domain/src/**/tests/` that only they use;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: any file outside a `tests/` directory; Core files.
- Definition of done: `cd domain && DOMAIN_TEST_BUILD_LABEL=<label> node scripts/test-domain.mjs io/tests/gateway-output-dispatcher runtime/tests/adapter tests/core-gateway-recording-order tests/web-panel-host`
  passes in full; `pnpm --filter @fluxiq-web-extension/domain check`; `pnpm structure:check`.

### Brief: test-runner-sweep-failures
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: find the cause of, and fix forward, the downstream sweep's 14 failures (2026-10-13, dev `7a93c624` with Core
  `1f747263`, from `fxwork/sweep-1010/!FluxIQWebExtension`: `pnpm -r --no-bail --filter '!@fluxiq-web-extension/domain' test`
  -> `packages/test-runner` "# fail 13", `apps/scenario-lab` "# fail 1"; the 2026-10-10 sweep had 1 test-runner
  failure, `compile-flow-script.test.ts`). Failing: `run-evaluation/tests/runner-wiring.test.ts` (5: "flowLane is
  in the runner", "snapshot is in the runner"), `run-evaluation/tests/single-run-evaluation.test.ts` (1),
  `run-scenario/browser-session/{core-identity,build-identity}/tests/identity.test.ts` (1 each), `tests/cli-llm.test.ts`
  (5: refusals before a credential is read, e.g. "the next refusal is the live run's missing credential"), and
  `apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/browser-paths.test.ts` (1, a browser test the
  2026-10-10 sweep listed as slow). For each: reproduce in your worktree, find the commit that broke it, and say
  whether it is a stale test (source-scanning tests after a move, an expectation older than a product change), an
  environment dependence (credentials or variables a test must not read from the machine), or a product defect.
  Fix stale tests and environment leaks in the tests; never relax a product check; stop on a product defect and
  report it with the evidence.
- Required reads: the failing tests and the code they exercise; `docs/architecture/testing-facility.md` where a test
  names a contract.
- Owns: the failing test files and test-only helpers under `tests/` directories they use;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: any file outside a `tests/` directory; Core files.
- Definition of done: each listed test passes in your worktree (`pnpm --filter @fluxiq-web-extension/test-runner build`
  then `node --test` on the built files; scenario-lab by its own test script), `pnpm --filter @fluxiq-web-extension/test-runner check`,
  `pnpm structure:check`; the report names each failure's cause and the breaking commit.

### Brief: W4-lab-project-mode
- Repository: this repository, the paired worktree the dispatch prompt names (its Core worktree carries A5c, which
  adds authoring mode `project`).
- Task: unit W4, let the Lab run and read a build in mode `project`, so A8 can compare it with `candidate`.
  (1) `packages/test-runner/src/flow-lane/creation/readiness.ts:68-87` admits `project` on the same terms as
  `candidate` (a trial runner and the start reset), with its own refusal wording. (2) Read a project build's
  outcome and draft as `flow-lane/creation/candidate-outcome.ts` reads a candidate's (a project build proposes
  through the same promotion owner and stores the same draft). (3) `live-llm/step-log-spend.ts`: spend, calls and
  the largest single decision input in tokens, per role and brief, from the step log's new `role`/`briefId`
  fields; written into the run's report so a debug and A8 can read them. (4) `cli.ts:123`: `--model-reset-only`
  applies to `project` builds too. (5) `docs/architecture/testing-facility.md`: the mode, its readiness and the
  per-role spend.
- Required reads: the Core paired plan's Current State; this document's `Lab Qualification`; the files above;
  `live-llm/authoring-mode-env.ts`.
- Owns: the files named above and their tests; the report.
- Must not touch: Core files, `apps/extension/**`, `domain/**`, `scripts/lab/**` (unless the launch path itself
  refuses the mode; then report it before editing).
- Definition of done: tests for readiness (admitted, refused without trial runner or start reset), outcome reading
  of a project build fixture, per-role spend from a step-log fixture with two briefs, the CLI flag; test-runner
  check and the tests beside each file; `pnpm structure:check`. No live run.

### Brief: W5-live-adapt-launch
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: unit W5. t519 (`4ee4e65c`) retired bare `--flow`, but `packages/test-runner/src/live-llm/live-llm-plan.ts:240`
  still tells a live `diagnose`, `repair` or `adapt` run to pass it, so those runs have no reachable launch on
  `lab run` (found by t548; see `reports/t548-test-runner-sweep.md`). First establish what the adaptation gate
  actually runs today (`docs/working/adaptation-and-breadth-plan.md` Current State; the instruction-created gate
  command in `mvp-final-month-plan/reports/codex-continuation-live-readiness.md:99-110`): if the gate creates the
  Flow in the same run (`--llm-task create-flow` with an `-after-creation` task) and repairs it in-run, say so and
  whether a separate diagnose/repair/adapt launch is still needed. Then either give `diagnose`, `repair` and `adapt`
  an instruction-led launch (a saved Flow named by the run's workspace and its written instructions, never a
  recording-only Flow), or retire them cleanly with a refusal that names the supported path. Remove the dead
  "drop --flow" checks (`commands.ts:274`, `live-llm-plan.ts:237`), `flowLaneExclusion` and the never-assigned
  `discardWindowUntil`; stop `bench/run-bench.ts:505,591` passing `flow: true`; correct
  `docs/architecture/testing-facility.md:2521`.
- Required reads: the files named above; `docs/architecture/testing-facility.md` (live-run and lane sections).
- Owns: `packages/test-runner/src/live-llm/`, `packages/test-runner/src/commands.ts`, `packages/test-runner/src/bench/run-bench.ts`,
  the files holding `flowLaneExclusion` and `discardWindowUntil`, their tests; `docs/architecture/testing-facility.md`;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: Core files; `apps/extension/**`; `domain/**`; `packages/test-runner/src/flow-lane/**` (W4's,
  merged; report if a change there is needed).
- Definition of done: tests beside each changed file; test-runner check; `pnpm structure:check`. No live run.

### Brief: W6-lab-key-scope-and-dead-flow-lane
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: unit W6. (1) Key scope: t552's worker found that a `lab run` probe with `FLUXIQ_TEST_ENV_FILES=none` still
  read the real provider key from the worktree's `.env.local` and got past the credential check (it stopped only
  at a bad variant; nothing was spent). Find what `FLUXIQ_TEST_ENV_FILES` is meant to govern (grep its readers and
  docs) and where the key resolver reads `.env.local`; make it so a run or probe that says no env files reads no
  key from any env file, and so no unit test or CLI test can ever obtain a real key. If the variable was never
  meant to cover `.env.local`, add the explicit way to say so and document it. Tests that pin both. (2) Dead
  recorded-Flow code left by t519 and t552 (see `reports/t552-w5-live-adapt-launch.md`): `cli.ts` passing
  `flowLane` and building a live matrix that can only be refused; `run-scenario.ts` remaining `options.flow`
  branches; `LiveLlmRun`'s recorded-Flow code (`authorizer`, `settle`, `lane-settlement`) unreachable from the CLI;
  `flow-lane/recording-discards.ts` `until` nothing sets; `bench/expand-corpus.ts` planning Flow-lane results that
  are always refused (`week1`, `week2`). Remove it, never extract-and-drop; keep every refusal a person can still
  meet, with its message.
- Required reads: the t552 report; the files named; `docs/architecture/testing-facility.md` (env files, Lab CLI).
- Owns: `packages/test-runner/src/**` files named above, the key resolver and env-file reader wherever they live in
  `packages/test-runner/` or `scripts/`, their tests; `docs/architecture/testing-facility.md`;
  `docs/working/automation-project-agents-plan/reports/<your label>.md`.
- Must not touch: Core files; `apps/extension/**`; `domain/**`.
- Definition of done: tests beside each changed file and every test reading the changed sources; test-runner
  check; `pnpm structure:check`. No live run, and no CLI probe that could reach a provider.

### Brief: W7-bench-dead-flow-lane
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: remove the recorded-Flow code t553 left unreachable (`reports/t553-w6-key-scope.md`, decisions): the bench's
  Flow-lane evaluation in `packages/test-runner/src/bench/run-bench.ts` (`assertRunnableLane`, the `evaluateFlowRun`
  branch, `flowSources`, the `reconstructBenchEvaluation` Flow branch); the `week2` corpus that now runs nothing
  (retire it with a refusal that says why); `flowLaneExclusion` in `packages/test-contracts` (no consumer left);
  and the declared-repair module that `proposesRepairOnly` (always false for a launchable run) can no longer reach.
  A campaign saved before t553 is already refused on resume; keep that refusal and its message. Never
  extract-and-drop; keep every refusal a person can still meet.
- Owns: `packages/test-runner/src/bench/**`, the corpus definitions, `packages/test-contracts/**` for
  `flowLaneExclusion`, the declared-repair module and its callers, their tests; `docs/architecture/testing-facility.md`;
  report.
- Must not touch: Core files; `apps/extension/**`; `domain/**`.
- Definition of done: tests beside each change and every test reading the changed sources; test-runner and
  test-contracts checks; `pnpm structure:check` (lower the baseline if entries go). No live run, and no CLI probe that
  could reach a provider.

### Brief: W8-lab-orphaned-repair-code
- Repository: this repository, the paired worktree the dispatch prompt names.
- Task: remove what t559 left orphaned (`reports/t559-w7-bench.md`): `apps/scenario-lab` identity-drift `repair.ts`
  with no caller, the dead `declaredRepair` input of `gate.ts`, and the six stale comments the report lists. Never
  extract-and-drop; keep every refusal a person can still meet.
- Owns: those files and their tests; report. Must not touch: Core files; `apps/extension/**`; `domain/**`.
- Definition of done: tests beside each change and every test reading the changed sources; scenario-lab and
  test-runner checks; `pnpm structure:check` (lower the baseline if entries go). No live run or provider probe.
