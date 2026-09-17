# w2-live-explore-create-repair

Worker report. Live campaign against the real DeepSeek key: instruction ->
exploration -> Flow -> run -> page drift -> repair -> validate -> revert.

## Outcome

**Partial.**

- **Repair half: done live, end to end.** On a Flow an LLM built from an
  instruction, the page drifted, and the full lane passed in one invocation at
  17:20 (`pnpm demo:llm:adapt:focused`). It made two DeepSeek calls, a
  diagnosis and a patch. The repair was approved and applied, the replay after
  apply succeeded, and the final replay made 0 model calls. The safety and
  key-leak checks passed. `pnpm demo:llm:adapt:revert` then passed at 17:27
  (applied -> reverted, 0 calls).
- **Explore -> run half: not reached. Two Core problems stand in the way.**
  1. DeepSeek's surplus closing brace. Found, reported, and fixed by the
     supervisor (`a9a78ed`). Exploration now produces a proposal on real Core
     code.
  2. Applying an explored Flow records an execution digest that the first
     graph view then changes. Found, pinned to the exact call, and a two-line
     fix proposed. It was validated live in a private worktree only. The fix
     is assigned to `w2-bootstrap-survives-and-resolves`.

  With that fix, the explored Flow applies cleanly but fails its first no-model
  run, because the model has to guess CSS selectors. This is a design gap: the
  exploration evidence gives it opaque handles only, and a plan cannot
  reference a handle. The plan handle-resolution work is in flight with
  another worker. Until it lands, "exploration produces a Flow that runs"
  holds only by luck.
- All live repair results rest on a private Core worktree (`fcc5423` plus the
  service.ts fix; the fix is not on the repair path). They also rest on a
  private extension build at `d4721b3`.
- Total live spend: 12 provider calls, about 71,000 reported tokens, about
  **$0.032** (see the cost table).
- **Cleanup.**
  - The persistent Core is stopped: nothing listens on 127.0.0.1:3300 or
    :4877.
  - The lanes closed their browsers, and no Core, Next.js or Chromium process
    of this worker remains.
  - All three private worktrees are removed: `F:/fxlab/w2e-fcc5423/!FluxIQ`,
    `F:/fxlab/w2e-fix/!FluxIQ` and `F:/fxlab/w2e-fix/!FluxIQWebExtension`.
    - Method: `git worktree remove --force`, then deleting the leftover
      directories with `rmdir /s /q`, after checking that all 1,445 junctions
      pointed inside them. Then `git worktree prune`.
    - Neither repository lists them now.
- Nothing was committed.

## What changed and why

This repository only; this worker made no edits in the shared Core checkout.
All changes are uncommitted.

**The three stale Lab rules fixed, and why:**

1. **Validation-result contract (Core `a2de143`).** Core no longer gives a
   target repair a validation result unless it ran and was compared.
   - A checked-but-unrun proposal records `metadata.targetResolution` and
     `metadata.structuralChecks` instead.
   - A repair applied and replayed live still carried none: 0 successes and 0
     failures at 17:18.
   - The Lab demanded exactly one success in five places, at proposal time and
     after apply. So a correct live repair was refused twice: at 17:02 at the
     proposal, and at 17:24 at revert.
   - Now:
     - A proposal must record no validation, a resolved target, and only passed
       structural checks.
     - An applied or reverted repair may carry one success.
     - A recorded failure is always refused.
2. **Project-wide zero recordings.** The repair certificate required the whole
   project to hold no recordings.
   - The demo's recording-driven diagnosis Flow lives in the same project, so
     this could never pass. It refused the 17:09 lane after apply.
   - The real invariants are unchanged and still checked: the repair adds no
     recording, and the repaired Flow has no recording provenance.
3. **Fixed Flow shape in exploration validation.** The final exploration
   validation required exactly 6 nodes and 6 action attempts, the shape one
   earlier model reply happened to have. Today's explored Flow has 7 nodes and
   5 actions. The check now uses the Flow's own deterministic baseline count.

**Files:**

- `packages/test-runner/src/demo-llm-exploration-adaptation.ts`
  - Adds `unexecutedTargetProposalIsSound`, and `evaluateExplorationAdaptationProposal` now takes Core's structural record.
  - The checkpoint reports `validationSucceededCount: 0` and
    `structurallyChecked: true`.
  - Validation uses the baseline action count (rules 1 and 3).
- `packages/test-runner/src/demo-llm-adaptation-control.ts`
  - New `targetRepairValidationIsHonest` (rule 1). It is also used by
    `demo-llm-exploration-adaptation-readiness.ts` (the drift explanation) and
    `demo-llm-exploration-adaptation-revert.ts`.
- `packages/test-runner/src/demo-llm-adaptation.ts` (rule 2).
- `packages/test-runner/src/demo-workspace/adapting-run/`: `index.ts`,
  `proposal-structure.ts`, `run-timeouts.ts`, and `tests/`.
  - `readTargetProposalStructure` reads Core's structural record from the
    adaptation's metadata. The control client does not carry that metadata.
  - `ADAPTING_RUN_TIMEOUT_MS` is the grant claim window, plus the 600 s lease,
    plus 15 s. It replaces two fixed 60 s waits (panel run response and run
    detail) that an iterating repair can exceed. A terminal run still returns
    at once. The waits are in `adaptation-ui.ts` and `panel-run.ts`
    (`waitForPanelRunResponse` takes an optional timeout).
- `packages/test-runner/src/demo-workspace/adaptation-lane.ts` and
  `exploration-adaptation.ts`: read the structural record and apply rule 1.
- `packages/test-runner/src/demo-llm-create-ui/applied-binding.ts` (+
  `tests/applied-binding.test.ts`) and `apply-proposal-ui.ts`: after applying
  an exploration proposal, the apply step:
  - reads the binding once before its own graph inspection;
  - watches it for 5 s;
  - records which panel endpoints were called after the apply response;
  - fails `exploration_apply.applied_binding_drifted` when the current digest
    leaves the applied one.

  Before this, apply reported success and the next step found the drift. This
  watch is what pinned the Core defect.
- `packages/test-runner/src/demo-workspace/launcher/` (`index.ts`,
  `failure-detail.ts`, `tests/`), plus `scripts/demo/launcher-failure.mjs`.
  - `describeDemoLauncherFailure`: prints the runner's own fixed messages in
    full, and only the first line of any other error (a Playwright call log can
    quote the page). Credential literals are redacted. It also gives the reason
    code and the source location.
  - It is wired into 9 demo launchers: `run-demo-llm-exploration`,
    `apply-demo-llm-exploration-proposal`, `run-demo-llm-exploration-baseline`,
    `inspect-demo-llm-exploration-adaptation-readiness`,
    `run-demo-llm-exploration-adaptation`,
    `apply-demo-llm-exploration-adaptation`,
    `validate-demo-llm-exploration-adaptation`, `run-demo-llm-adaptation`,
    `control-demo-llm-adaptation`.
  - The launchers used to print `failureCode: unknown`.
- `packages/test-runner/src/demo-workspace/configuration.ts` and
  `browser-session.ts`: an optional absolute `FLUXIQ_DEMO_EXTENSION_DIR` names
  the unpacked extension a run copies. The default is unchanged. All 24 demo
  launchers that allowlist `FLUXIQ_DEMO_HEADLESS` now pass it through.
  - Why: other workers rebuild `apps/extension/dist` from their in-flight
    source, and it was absent mid-run twice (16:57, 17:12).
- `packages/test-runner/src/demo-workspace/index.ts` and
  `demo-llm-create-ui/index.ts`: barrel exports.
  `demo-llm-exploration-adaptation.ts` imports the proposal type through the
  `demo-workspace` barrel. The structure audit required both this and the two
  subdirectories: `demo-workspace` was over its file limit, and `scripts/` may
  not grow.
- Tests changed or added, each new test observed failing first unless noted:
  - `tests/demo-llm-exploration-adaptation.test.ts`: the 7-node case, the
    proposal contract, and lane source checks. Negative probe: restoring the
    old check in the built file fails 5 tests.
  - `tests/demo-llm-adaptation.test.ts`: the recordings rule.
  - `tests/demo-llm-adaptation-control.test.ts`,
    `tests/demo-llm-exploration-adaptation-readiness.test.ts`,
    `tests/demo-llm-exploration-adaptation-revert.test.ts`: rule 1. Old
    fixtures that described an unrun repair carrying a success were updated to
    Core's current shape.
  - `tests/demo-workspace.test.ts`: the extension override.
  - `demo-workspace/adapting-run/tests/*`, `demo-workspace/launcher/tests/*`,
    `demo-llm-create-ui/tests/applied-binding.test.ts`: written with or just
    before their modules; the first compile failed on the missing module.

## Live runs (command, result, cost)

**Gates.**

- Until 16:41: Core `npx tsc --noEmit -p packages/fluxiq` had to exit 0.
- From 16:41, supervisor-accepted:
  - The Core web panel is built from a clean private worktree. The Next.js
    build type-checks Core *source*, and the other workers' in-flight source
    broke it at 16:40.
  - The main checkout's `packages/fluxiq/dist` must still be the 16:31 build of
    clean `fcc5423`.
  - This repository's domain must type-check.
- From 17:15: the extension must come from a clean private build.
- Gate script: `<scratchpad>/gate.sh`.

**Scratch diagnostics, all outside the repositories.**

- A `NODE_OPTIONS` preload recorded only the *structure* of each DeepSeek
  exchange (never content, headers or key): lengths, parse category, key
  names, handle forms.
- Read-only scripts printed digest hashes, run records and adaptation fields.
- One scratch script applied a proposal through the real panel.
- Another reverted one applied repair.

**Runs.**

1. **16:13 `pnpm demo:llm:explore`** (default `instruction-only-form`).
   - Failed: `flow_bootstrap.provider_response_malformed`, HTTP 400, 1 call.
   - The shell's exit 139 came at teardown, after the result line was written:
     RAM fault.
2. **16:15, same command, with the probe.**
   - Same failure. HTTP 200, `finish_reason: stop`, 2,192 chars beginning `{`
     and ending `}`, but not valid JSON.
   - Cost: 5,239 / 595 / 5,834 tokens, $0.0031.
   - Core tsc was red on another worker's test file just before this run. The
     run used the unchanged 15:44 Core build (HEAD `0b3ba93`).
3. **16:18, retry.**
   - The first attempt was refused at login by the known RAM fault inside the
     memory-hard credential step. The immediate retry logged in.
   - Result: parse error at the last character; one value, closing depth -1.
   - Cost: 5,244 / 569 / 5,813 tokens, $0.0031.
   - **Root cause:** DeepSeek JSON mode emits one complete object plus one
     surplus `}`. Core's `parseDeepSeekEnvelope` refused it, and the bootstrap
     loop (`service.ts:1914`, `propagateDecisionErrors`) ended the exploration.
   - **Fix:** supervisor, Core `a9a78ed`, test
     `AS/runtime/llm/tests/deepseek-json-content.test.ts`.
4. **16:22, with a scratch shim simulating that fix.** (This result rests on
   the shim.)
   - Proposal: 1 call, 5,243 / 681 / 5,924 tokens, $0.0032.
   - 16:23 `pnpm demo:llm:explore:apply`: applied. 7 nodes (start, type,
     select, click, wait for text, assert, end), 6 edges, 5 executable.
   - 16:24 `pnpm demo:llm:explore:baseline`: refused,
     `exploration_baseline.binding_drift_unexplained`.
   - Digest probe:
     - The applied digest is `7bfea0504c`; the current one is `a327d665b0`.
     - Two snapshots across two Core restarts are identical.
     - Both apply writes fall inside the apply request.
   - Core rebuilt at the supervisor's request: 16:25 and 16:31 (`fcc5423`).
5. **16:43 `pnpm demo:llm:explore`, real Core fix, no shim.**
   - Proposal: 1 call, 5,445 / 683 / 6,128 tokens, $0.0033. The reply again
     carried the surplus brace, and Core accepted it.
   - 16:45 `pnpm demo:llm:explore:apply`: refused by the new watch,
     `exploration_apply.applied_binding_drifted`.
     - The binding held right after the apply response.
     - The only panel request afterwards was `get-flow-adaptation`.
     - It moved during the step's own read-only inspection.
6. **16:47 `pnpm demo:llm:explore`**, then the scratch per-read apply
   experiment.
   - Cost: 1 call, 5,458 / 648 / 6,106 tokens, $0.0033.
   - The binding held after:
     - the apply response;
     - `get-flow` on the parent;
     - `list-flow-subflows`;
     - `get-flow-router`;
     - `get-flow` on the graph;
     - `list-native-node-definitions`.
   - **The first `get-graph-viewport` of the new Subflow graph moved the
     current digest** from `49029d9c` to `b3081a4b`. A second read changed
     nothing. The settings revision stayed 4 throughout.
   - **Root cause (Core `AS/runtime/service.ts`, not this worker's).**
     - `getFlowGraphViewport` (~2172) imports a graph that has no revision into
       the revisioned graph store.
     - After that, `getFlow` -> `materializeCanonicalGraphFlow`
       (`service/flows/store.ts:249`) returns the graph rebuilt from the store,
       with `metadata.graphRevision` added.
     - `graphFlows` is one of the inputs to the execution digest.
     - `applyFlowBootstrapAdaptation` (~4160) saves each Subflow graph without
       creating that index. So `appliedDependencyDigest` is the pre-import
       value.
     - Result: the first time anyone views the graph (the Lab, or a person
       opening the Subflow's Nodes view), the applied bootstrap can no longer
       be reverted (`FLOW_BOOTSTRAP_STALE`), and the next Lab step refuses.
   - **Proposed fix:** in that loop,
     `const savedGraph = await this.flowWriter.saveFlowInternal(...);`
     followed by
     `await this.flows.replaceFlowGraphIndex(adaptation.projectId, savedGraph);`,
     as `service.ts:2513` already does for recording proposals.
   - **Proposed test:** apply, view the graph, check the digest still equals
     `appliedDependencyDigest`, and check revert still succeeds.
   - Assigned to `w2-bootstrap-survives-and-resolves`.
7. **Private fix worktree** (`F:/fxlab/w2e-fix/!FluxIQ`, `fcc5423` plus
   exactly that change, Core tsc 0). Everything from here rests on it.
   - 16:51 `pnpm demo:llm:explore`: proposal, 1 call, 5,449 / 688 / 6,137
     tokens, $0.0033.
   - 16:53 `pnpm demo:llm:explore:apply`: **applied, and the binding watch held
     5 s.** The fix removes the drift.
   - 16:54 `pnpm demo:llm:explore:baseline`: the no-model run `d0dd803a`
     failed at `web.output.dom-type` (`web.action.failed`: "No target resolved
     from selector input[name="Name"]").
     - The fixture's field is `name="name"`.
     - The select node likewise says `select[name="Plan"]`, where the page has
       `name="plan"`.
   - **Root cause: a design gap.**
     - The exploration packet deliberately carries opaque handles and never a
       selector (`domain/src/runtime/llm-evidence/elements.ts:35-40`).
     - Plan nodes require a literal `selector`, and nothing resolves a handle
       inside a plan.
     - So the model guesses selectors from accessible names.
     - The domain side, `resolvePlanNodeParameters` with
       `{ handle: "target.N" }`, exists in `d4721b3`. Core's
       `harness-options/plan-parameter-resolution.ts` exists, but
       `binding.ts` was still modified in the shared checkout at 17:29.
8. **Repair half, on the prepared Flow `flow.080e474c`.**
   - About this Flow: the one-call "build from instruction" Flow from 7
     September. Its no-model baseline passes. The drift turns the name input
     into a textarea.
   - Command: `pnpm demo:llm:adapt:focused`.
   - Steps:
     - 16:56 `pnpm demo:llm:adapt:readiness`: passed. 6 nodes, 6 actions, 3
       repairable targets.
     - 16:57: `node.enoent`, no provider call. The extension dist was missing
       during another worker's rebuild.
     - 16:59 **repair 1**:
       - Both calls answered with valid JSON: diagnosis 2,845 / 360 / 3,205
         ($0.0017), patch 2,937 / 226 / 3,163 ($0.0016).
       - Core's preflight: "Target override is absent from current sanitized
         evidence". No proposal was made.
       - Probable cause, not captured for that reply: the model named its
         handle under a parameter name other than the domain's `element`.
         - The failure packet never lists the repairable parameter names.
         - Core's prompt nevertheless says "one per repairable parameter it
           offers".
     - 17:02 **repair 2**:
       - Cost: diagnosis 2,843 / 447 / 3,290 ($0.0018), patch 2,935 / 242 /
         3,177 ($0.0016).
       - Handles `{ element: target.N }`. Core resolved the target and created
         the proposal.
       - Refused by stale rule 1 (proposal carries 0 successes). Fixed.
     - 17:09, the lane resumed the proposal with no new call:
       - Approved, **applied**, and both no-model validation runs passed.
       - Then the certificate refused under stale rule 2. Fixed.
     - 17:12: `node.enoent` again.
     - 17:15, with the private extension (`d4721b3`): refused, because the
       source run's provider-call count was unreadable.
       - **Core finding:** between 17:09 and 17:15, runs `8cd04d2b` and
         `3cc4bd79` lost from their stored details:
         - `metadata.llmGate`;
         - `runtimeAdaptationContext`;
         - `runtimePatchAttempts`;
         - `summary.tokenUsage`.
       - Both had them at 17:03 and 17:09. What remains has the shape of an
         unannotated `runtimeSessionToFlowRunDetail`.
       - The loss did **not** recur for run `bc1f0545`, which still had its
         record at 17:27 after apply and revert.
       - Assigned to `w2-run-detail-annotation-loss`.
     - 17:19: scratch operator revert of the applied repair (applied ->
       reverted).
     - 17:20 **repair 3, full lane: PASSED.**
       - Output: `{"status":"passed","providerCallCount":2,"retryCount":0,"reviewOutcome":"approved","applyOutcome":"applied","postApplyValidationStatus":"succeeded","finalReplayRunId":"abf586e0-442b-4c20-9768-c13256bb4079","finalReplayProviderCallCount":0,"safetyPassed":true,"leakAttestation":"passed"}`.
       - Cost: diagnosis 2,924 / 407 / 3,331 ($0.0018), patch 3,016 / 229 /
         3,245 ($0.0016).
     - 17:24 `pnpm demo:llm:adapt:revert`: refused by stale rule 1 in the
       control module. Fixed.
     - 17:27 `pnpm demo:llm:adapt:revert`: **passed**.
       `"initialStatus":"applied","status":"reverted","reverted":true,"appliedMutationCount":1,"providerCallCount":0`.

### Cost summary (reported tokens, Core's estimator)

| Run | Calls | Tokens (in / out / total) | Cost |
| --- | --- | --- | --- |
| explore 16:13 | 1 | not reported on the failure path | about $0.003 |
| explore 16:15 | 1 | 5,239 / 595 / 5,834 | $0.0031 |
| explore 16:18 (retry) | 1 | 5,244 / 569 / 5,813 | $0.0031 |
| explore 16:22 (shim) | 1 | 5,243 / 681 / 5,924 | $0.0032 |
| explore 16:43 | 1 | 5,445 / 683 / 6,128 | $0.0033 |
| explore 16:47 | 1 | 5,458 / 648 / 6,106 | $0.0033 |
| explore 16:51 (fix worktree) | 1 | 5,449 / 688 / 6,137 | $0.0033 |
| repair 1, 16:59 | 2 | 5,782 / 586 / 6,368 | $0.0033 |
| repair 2, 17:02 | 2 | 5,778 / 689 / 6,467 | $0.0035 |
| repair 3, 17:20 | 2 | 5,940 / 636 / 6,576 | $0.0035 |
| **Total** | **12** | about 71,000 | **about $0.032** |

## Commands run and observed results

- `npx tsc --noEmit -p packages/fluxiq` (Core, before each step until 16:41):
  exit 0.
  - Exception: it was red at 16:15, 16:33–16:41 and 16:43, always in other
    workers' test files. The substitute gate replaced it from 16:41.
- `pnpm --filter fluxiq build` (Core, at the supervisor's request): exit 0 at
  16:25 and at 16:31. A 16:24 attempt segfaulted in tsc (RAM fault); it was
  retried alone.
- Builds in this repository, one at a time, each exit 0:
  `pnpm --filter @fluxiq-web-extension/scenario-lab build`,
  `... extension test:e2e:build`, `... test-runner... build`.
- `npx tsc -p packages/test-runner/tsconfig.json`:
  - Final result: errors only in `src/flow-lane/repair/declared-repair.ts:128`
    and `src/flow-lane/run-flow-lane.ts:91`, both another worker's in-flight
    files.
  - At 17:30 it was fully clean.
- Test runs:
  - Final: `node --test` over `dist/demo-workspace/tests`,
    `dist/demo-workspace/adapting-run/tests`, `dist/demo-workspace/launcher/tests`,
    `dist/demo-llm-create-ui/tests` and `dist/tests/demo-*.test.js`:
    **189 pass, 0 fail.**
  - Earlier: post-apply suites 61/61, create-UI 25/25.
- `node --test "dist/**/*.test.js"` (the whole runner): **1,067 pass, 0 fail**
  (17:30, before the final directory move).
  - An earlier run at 16:28 had 3 failures, all in other workers' files
    (`live-llm-plan`, `runner-wiring`, `scenario-assertions`).
- `pnpm check` (this repository, 17:28), exit 2:
  - structure tests 96/96, Lab tests 24/24, structure audit passed;
  - domain, boundary-audit, real-site-policy, test-contracts, test-matrix,
    extension, scenario-lab, agent-orchestrator and test-evidence checks
    passed;
  - test-runner check failed only on `src/flow-lane/run-flow-lane.ts(91,23)`
    (another worker's file).
- `node scripts/structure-audit.mjs`, after the restructure:
  **exit 0, "passed (59 warning(s), 17 baselined)"**. None of the warnings is
  a failure in this worker's files.
- Launcher check:
  `FLUXIQ_DEMO_BASE_URL=https://example.test node scripts/run-demo-llm-exploration-baseline.mjs`.
  It exited 1 and printed the configuration error through the moved helper.
  Nothing started.
- `pnpm -s demo:llm:explore:request`: ready, `providerCallCount: 0`.
- Cleanup: no listener on 3300 or 4877. Worktrees removed and pruned; neither
  `git worktree list` shows them.

## Not verified

- **The end-to-end explore goal.** An explored Flow that runs, then is
  repaired and validated.
  - Blocked on plan handle resolution.
  - The exploration repair lanes were never run live:
    `demo:llm:explore:adapt:readiness`, `explore:adapt`,
    `explore:adapt:apply`, `explore:adapt:validate` and
    `explore:adapt:revert`. Their changed checks are covered by tests only.
- **The proposed `service.ts` fix.** Validated only live, in a private
  worktree. No Core test was written for it; the owning worker lands the real
  change.
- **What deletes run records.** The trigger for the run-detail annotation loss
  was not identified. The evidence is two runs before and after, and one run
  where it did not happen.
- **Why repair 1's target was "absent".** The parameter-name explanation is
  probable, not captured.
- **The longer adapting-run waits.** No live run needed more than 60 s.
- **The default extension path.** Every run from 17:15 used the override, so
  the default path was not exercised after the change. The default itself is
  unchanged.
- **Every live repair result depends on the private worktree** and the private
  extension build, not on the shared checkout.
- **Checks not run.**
  - Core `pnpm check`: no Core edits by this worker.
  - Full `pnpm test` across this repository: only the test-runner suite ran.
  - Firefox.
  - Manual panel use.

## Open questions or contradictions found

1. **Documentation.** `docs/architecture/testing-facility.md` is outside this
   brief's ownership and was not edited. Proposed changes:
   - Add `FLUXIQ_DEMO_EXTENSION_DIR` to the environment table (near line 424):
     "Optional absolute path of the unpacked extension a demo run copies;
     defaults to `apps/extension/dist/chrome`".
   - State that a runtime target proposal carries no validation result until
     it has run (Core `a2de143`).
   - State that the adaptation certificate refuses a repair that adds
     recordings, not a project that already has them.
2. **Repairable parameter names.** The domain failure-evidence packet
   (`domain/src/runtime/llm-evidence/**`, now the scraping workers') should
   name the repairable parameters (`element`). Core's patch prompt refers to
   the parameters "it offers", and the packet offers none.
3. **Token headroom.** `FIRST_LIVE_ADAPTATION_PROFILE` allows 4,000 input
   tokens per call. The repair calls used about 2,850–3,020. An explored Flow
   with larger evidence may exceed it, and Core would then refuse before
   sending.
4. **Ownership overlap.** Core `flow-bootstrap/generation-failure.ts` and its
   test are still listed as this worker's but were edited by another worker.
   This worker did not touch them.
5. **Demo workspace clutter.** The persistent demo project now holds several
   exploration checkpoint Flows from this campaign: drifted applied bootstraps,
   and one Flow with the guessed selectors.
   - The lanes pick the newest by `updatedAt`, so a rerun works.
   - A cleanup of old checkpoint Flows may still be wanted.
6. **Machine faults.** Hardware faults seen and retried once each:
   - a segfault at teardown (16:13);
   - a login refusal at 16:18;
   - a tsc segfault at 16:24.
