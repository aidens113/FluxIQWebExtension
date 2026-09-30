# t186-D: remove LLM execution grants from the Lab

Worker report. Tree `C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQWebExtension`,
branch `task/t186-remove-call-grants`. Spec: "Target contract" in
`t186-remove-call-grants.md`. Core was not touched.

## Outcome

Done. The Lab no longer preflights, issues, confirms (high-token) or carries an
execution grant anywhere. It installs the key, saves the Flow's LLM settings
with the run's spend ceiling as `adaptationPolicySettings.maxEstimatedCostUsdPerRun`,
and sends builds and runs with no grant id. `--llm-permit` is now consequence
permission only, sent as `permittedConsequences` when it names something.

## What changed and why

### Core behaviour (live-llm)

- `live-llm/execution-grant.ts` and `live-llm/tests/execution-grant.test.ts`: **deleted** (`git rm`).
  Its export was removed from `live-llm/index.ts`.
- `live-llm/authorize-flow.ts`: rewritten. It installs the key, reauthenticates
  when the key is new, and saves the Flow settings. It returns `{ secretKeyId, secretKeyName }`.
  The `grantOverride` (verify_result second grant) is gone.
- `live-llm/flow-settings.ts`: now also writes
  `metadata.adaptationPolicySettings = { maxEstimatedCostUsdPerRun: plan.maxTotalEstimatedCostUsd }`.
  It reads the value back after the save and refuses when it is missing. Core merges
  `adaptationPolicySettings` (`runtime/service/flow-settings/merged-metadata.ts`),
  so the Flow's other policy fields are kept. The model is still `llmModel`.
- `live-llm/live-llm-plan.ts`: removed `highTokenConfirmation`, the Core
  high-token threshold, the `verify_result` purpose, and the grant wording. The run
  token budget is now a Lab-only post-run check: the typed `--llm-max-run-tokens`
  held to per-call × calls, or per-call × calls by default. It was
  `min(exposure, threshold)` for non-builds. The spend ceiling is still
  `min($2, per-call × calls)`, renamed `LAB_MAX_TOTAL_COST_USD`.
- `live-llm/live-llm-run.ts`: the grant fields became `prepared` / `repairPrepared` booleans.
  - `authorizer` returns `{ intent, permittedConsequences }`.
  - `buildAuthorizer` returns `{ permittedConsequences }`.
  - `repairAuthorizer` returns `{ intent: "explore_and_adapt", permittedConsequences }`.
  - The snapshot drops `granted` and `highTokenConfirmation` and adds top-level
    `permittedConsequences`.
  - `repair.granted` became `repair.authorized`.
  - `describe()` (the dry run) shows `permittedConsequences` and no `highTokenConfirmation`.
- `live-llm/budget.ts`, `build-usage.ts`, `declared-provider-calls.ts`, `exploration-record.ts`, `secret-key.ts`: comments only.

### Requests (flow-lane, control client)

- `flow-lane/persisted-flow-run.ts`: `PersistedFlowLlmExecution` is now
  `{ intent, permittedConsequences }`. The new `persistedFlowLlmRunFields()` sends
  `runIntent`, plus `permittedConsequences` only when it is non-empty, and never a grant id.
  `runGrantedFlow`/`grantedSettlement` were renamed to `runLiveFlow`/`liveRunSettlement`.
  Core's grant constant is gone, so the run deadline comes from `terminal-run-wait.ts`.
- `flow-lane/terminal-run-wait.ts`:
  - New local `LIVE_LLM_RUN_WAIT_MS = 600_000`. It was Core's
    `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`, which Core is deleting.
  - `TERMINAL_DETAIL_MAX_WAIT_MS` uses it.
  - `GRANTED_RUN_UNSETTLED_CODE` became `LIVE_RUN_UNSETTLED_CODE`, and its value
    became `"flow_lane.live_run_unsettled"`. It was only used internally.
- `existing-fluxiq-control.ts`:
  - `runPersistedFlow` sends `runIntent` and `permittedConsequences` (when non-empty), with no `llmExecutionGrantId`.
  - `generateFlowBootstrapAdaptation` takes `CreatedFlowBuildRequest`.
- `flow-lane/creation/build-proposal.ts`:
  - New `CreatedFlowBuildRequest` type (no grant id; optional `permittedConsequences`).
  - New `CreatedFlowBuildLlm` type.
  - `authorize` returns `{ permittedConsequences }`, and the build request carries them when non-empty.
- `flow-lane/run-flow-lane.ts`, `flow-lane/creation/lane.ts`: hook types and comments.
  The repair judgement checks `intent !== "diagnosis_only"`.

### Panel and demo paths

- `demo-workspace/panel-run.ts`: removed the preflight/issue response watch and
  `llmPreparationRejectionCode`, which was dead once the panel has no grant calls.
- `demo-workspace/adaptation-ui.ts`: removed the high-token confirmation click and the `grant_invalid` rejection code.
- `demo-llm-create-ui/explore-proposal-ui.ts`: removed the high-token confirmation branch
  and the `ignoreHighTokenConfirmation` option. `classifyExplorationUiTerminal` now
  reports only `ui_failure`.
- `demo-llm-create-ui/limits.ts` and `index.ts`:
  - Removed `LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD` and `grantClaimWindowSeconds`.
  - `runLeaseSeconds` became `runDeadlineSeconds`.
  - The command timeout is still 675,000 ms, now written as deadline + 75 s.
- `demo-llm-create-ui/generation-readiness.ts`: dropped `llmExecutionGrantsConfigured` (Core is removing it from readiness).
- `demo-workspace/adapting-run/run-timeouts.ts`: same timeout value, derived without grant fields.
- `demo-llm-exploration-request.ts`: `providerBudget.runLeaseSeconds` became `runDeadlineSeconds`.
- `adaptationCallCountWithinGrant` became `adaptationCallCountWithinCeiling`, applied everywhere
  (`demo-llm-adaptation-control.ts`, `demo-llm-adaptation.ts`, `demo-llm-exploration-adaptation*.ts`,
  `demo-workspace/adaptation-lane.ts`, `demo-workspace/exploration-adaptation.ts`, and tests).
  Its failure text now says "its run could not have produced".

### Provider-free guards

The deleted grant endpoints were how "no provider" was guarded, so the guards changed:

- `ui-e2e/topology.ts` and `demo-workspace/exploration-adaptation.ts` still block
  `generate-flow-bootstrap-adaptation`.
- They now also abort any `run-runtime-session` whose body carries a `runIntent`,
  and treat an unreadable body as asking. Other runs pass through with `route.fallback()`.

### Other

- `saved-flow-replay/replay-saved-flow.ts`: `ReplayModelAccounting.executionGrant: null` became `runIntent: null`.
- `packages/test-contracts/src/llm.ts`: comments only (`--llm-permit` described as consequence permission, no grant).
- Comment-only grant wording in:
  - `commands.ts`, `run-scenario.ts`, `web-flow-exploration.ts`
  - `http-control/index.ts`, `demo-workspace/core-process.ts`
  - `existing-fluxiq-control/adaptation-evidence-loop.ts`
  - `flow-lane/harness-recovery.ts`, `lane-observation.ts`
  - `flow-lane/creation/{blank-flow,request,instruction-task}.ts`
  - `flow-lane/repair/{apply,declared,prove,replay,run}-repair*.ts`

### Scripts and docs

- `scripts/lab/live-campaign/row/consequences.mjs`: reads `liveLlm.permittedConsequences`
  (was `granted.permittedConsequences`). The row field `granted` became `permitted`.
- Comments only in:
  - `scripts/lab/live-campaign.mjs`, `lab-run/command.mjs`
  - `row/reported-spend.mjs`, `row/summarize-task.mjs`
  - `scripts/lab/adversarial-lane.mjs`, `adversarial/{conditions,measurement}.mjs`
- `scripts/run-demo-llm-creation-readiness.mjs`: dropped `llmExecutionGrantsConfigured` from its output.
- `docs/architecture/testing-facility.md`:
  - Grant wording removed throughout.
  - New paragraph "Model calls need no grant" covering the spend ceiling as a Flow
    setting, `--llm-permit` as `permittedConsequences`, and the snapshot fields.

### Tests updated to the new behaviour

- `flow-lane/tests/granted-run-settlement.test.ts` was renamed (`git mv`) to `live-run-settlement.test.ts`.
- The fake Cores in `live-llm-run.test.ts` and `lane-settlement.test.ts` now **throw** on any
  grant endpoint.
- New or changed assertions check that:
  - no `llmExecutionGrantId` is sent;
  - `permittedConsequences` is sent only when non-empty (control client, build request,
    persisted run, created-Flow lane);
  - the Flow settings carry `adaptationPolicySettings.maxEstimatedCostUsdPerRun: 2`;
  - the snapshot has no `granted` or `highTokenConfirmation`.
- The plan tests now test the new token-budget default.
- The drift test that read Core's `llm/execution/grants.ts` was replaced, since Core deletes those constants.

Also changed: `tests/{existing-fluxiq-control,commands,cli-llm,demo-llm-*}.test.ts`,
`flow-lane/tests/{persisted-flow-run,live-repair-lane,terminal-run-wait,lane-observation}.test.ts`,
`flow-lane/creation/tests/{build-proposal,lane,request,permission-required-diagnostic}`,
`flow-lane/repair/tests/{declared,replay,run}-repair*.test.ts`, `live-llm/tests/{budget,build-usage,live-llm-plan}.test.ts`,
`demo-llm-create-ui/tests/{exploration,readiness-gate}.test.ts`, `demo-workspace/adapting-run/tests/run-timeouts.test.ts`,
`demo-workspace/tests/diagnosis-ui.test.ts`, `existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`,
`http-control/tests/auth.test.ts`, and the `scripts/lab/live-campaign/**/tests/*.mjs` files listed in git status.

## Commands run and observed results

Each command ran one at a time, with test concurrency 2.

- `pnpm --filter @fluxiq-web-extension/test-runner exec tsc --noEmit` exited 0 with no output.
- `pnpm --filter @fluxiq-web-extension/test-contracts exec tsc --noEmit -p tsconfig.json` exited 0.
- `pnpm --filter @fluxiq-web-extension/test-runner build` completed with no errors.
- `node --test --test-concurrency=2 live-llm/tests/*.test.js flow-lane/tests/*.test.js flow-lane/creation/tests/*.test.js flow-lane/repair/tests/*.test.js` (in `dist`) gave `# tests 380 # pass 380 # fail 0`.
- `node --test --test-concurrency=2` over the demo-workspace, adapting-run, demo-llm-create-ui,
  `tests/{existing-fluxiq-control,commands,cli-llm,demo-llm-*}`, existing-fluxiq-control, http-control,
  saved-flow-replay and ui-e2e tests gave `# tests 241 # pass 241 # fail 0`.
  - A first run had 1 failure: `demo-workspace/tests/core-process.test.js` "a restart start skips the host build…".
  - The cause was mine. My Python text-mode edits on Windows had written CRLF into
    78 LF files, and that test matches source text across newlines.
  - I converted every changed file back to LF (the repo has `* text=auto eol=lf`),
    rebuilt, and both groups passed as above.
- `node --test --test-concurrency=2 scripts/lab/live-campaign/tests/lab-run-command.test.mjs scripts/lab/live-campaign/row/tests/*.test.mjs` gave `# tests 25 # pass 25 # fail 0`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (114 warning(s), 120 baselined)`.
- Dry run, first attempt: `node scripts/lab/run-lab.mjs run everything-store --dry-run --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task everything-store-kettle-to-cart`
  - It exited 1 on the Lab's stale-Core guard: "Core's build is 32 minute(s) behind its source … runtime/service.ts".
  - Core is being edited in parallel, and I must not rebuild it.
- Dry run, second attempt: the same command with `FLUXIQ_LAB_ALLOW_STALE_CORE=1`.
  - It exited 0 and started no topology. It rebuilt ignored Lab outputs (extension, domain, test-runner dist).
  - The printed plan was
    `"live":{"profileId":"production","provider":"deepseek","model":"deepseek-flash","task":"create-flow","purpose":"build_and_adapt","authorized":{"maxCalls":26,"tokenLimits":{…48000/8000/56000},"maxTotalTokensPerRun":1456000,"timeoutMs":25000,"maxEstimatedCostUsd":0.25,"maxTotalEstimatedCostUsd":2},"permittedConsequences":[],"credentialSource":{…}}`.
  - `grep -ciE "grant|highToken|high-token|preflight"` over the whole output returned `0`. There is no grant step.

## Not verified

- **Nothing ran against the new Core.**
  - The typecheck and tests resolve `fluxiq/automation-studio` from Core's **stale dist**,
    which still exports the grant symbols; I removed every import of them.
  - Core's parallel changes (`llmExecutionGrantsConfigured` removed from readiness,
    `permittedConsequences` on `generate-flow-bootstrap-adaptation` and `run-runtime-session`,
    `maxEstimatedCostUsdPerRun` enforced as the run ceiling) are assumed from the spec.
  - Recheck: run the test-runner `tsc --noEmit` again once Core is rebuilt.
- I did not confirm that Core stores `adaptationPolicySettings.maxEstimatedCostUsdPerRun`
  and returns it from `get-flow` in the shape the Lab's read-back expects. The read-back
  refuses if it does not, which would show up as a fail-closed `environment.missing`
  in the first live run.
- No live runs, and no browser checks of the panel or ui-e2e route guards. The new
  `run-runtime-session` + `runIntent` block is typechecked only.
- The full `pnpm check` / `pnpm test` were not run. Only the focused groups above ran.

## Open questions or contradictions found

- The run token budget no longer has any Core enforcement; it is a Lab post-run check
  only. The default for non-build runs rose from `min(exposure, 560,000)` to
  `exposure` (e.g. 1,456,000 for 26 calls), because the old threshold was the grant's.
  A typed `--llm-max-run-tokens` still binds. The campaign's 600,000 is unchanged.
- The spend ceiling stays at the Lab's `min($2, per-call × calls)`. Core's
  `run-budget.ts` accepts up to $10, so raising it is a policy choice, not something this brief asked for.
- `EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS` and `ADAPTING_RUN_TIMEOUT_MS` keep the
  old 675 s, which included the grant's 60 s claim window, so they are never shorter
  than the panel's own number. The web worker may shorten the panel's; these can follow.
- Out-of-brief side effects:
  - My LF-normalization pass covered every changed **and untracked** file in the tree,
    including the other workers' untracked report files under
    `docs/working/mvp-today-plan/reports/` and the lane report. If any of them had
    CRLF, it is now LF. The content is otherwise unchanged.
  - `git mv` and `git rm` staged the rename and the two deletions in the index. There were no commits.
