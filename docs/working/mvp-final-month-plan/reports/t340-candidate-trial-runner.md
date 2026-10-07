# t340: U2 candidate trial runner, judge and promotion

Worker: t340-trial-runner. Core worktree `C:\Users\osrs_\FluxStuff\fxwork\t340\!FluxIQ`, branch
`task/t340-candidate-trial-runner`, base `e76e1775`. Nothing committed. No provider, Lab or panel was used.
Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. One known side effect needs U3 (see "Open questions"). In candidate mode Core now:

- mints the candidate id before the authoring loop;
- injects a real trial port;
- runs the exact submitted candidate once, through `runAutomationStudioDetachedCandidate`, under a trial session of its
  own and with the executor options a normal run gets;
- judges only that run with `automationStudioBuildTestJudge`, which keeps t296's two-yes rule;
- after the loop, turns a standing yes into a proposed adaptation through `createFlowBootstrapAdaptation`, with a
  `candidateTrial` audit detail and base-digest checks.

Anything short of that stays a draft and says why.

The first job was to check how consequences are gated. A normal run carries no `permittedConsequences` into the graph.
The executor options have no such field, and no execution-time gate exists in Core or in the downstream domain:
`hostContext.sideEffectClass` has no consumer. A Flow's lasting consequences are gated when it is authored (the build's
`planStep` gate, before a candidate submission is accepted) and when it is approved. A trial therefore gates
consequences exactly as a run does, by running under the same options builder. A fail-first test pins this.

## What changed and why

New `service/candidate-trial/`:
- `graph-options.ts`: `automationStudioRunGraphOptions`, the executor options for one run: effect dispatcher, runtime
  capabilities, authorized domains, native executor, host runtime, max steps, `onRecordBatch` and parking. It was
  extracted from `runRuntimeSession`, which now calls it. The trial builds its options here too, so the two cannot
  drift. Its natural owner is `service/runtime-session/`; it sits here only because the brief owned this directory.
- `contracts.ts`: the trial ports, the trial record, and `AutomationStudioPrepareCandidateStart` (the D1 hook type).
- `run.ts`: `runAutomationStudioCandidateTrial`. The steps:
  1. The start: the D1 hook first when it is set (its result is recorded and never shown to the model); otherwise
     `not_reset`. A failing hook ends the trial as `execution_failed` / `candidate.trial_start_failed`, and nothing runs.
  2. `startRuntimeSession` with a `trial.<uuid>` run id and `metadata.candidateTrial`, then `running`.
  3. The detached run. The signal is passed only in the options, because the runner refuses two different signals.
  4. The session's end and trace are written, and datasets are processed in `finally`.
  5. A run that did not succeed is not judged (`execution_failed` with step codes). An abort is thrown before any judge
     call.
  6. Otherwise the judge gets one summary of the trial alone.
  The `requirementsDigest` identity field is filled with the original instructions' digest, as the t339 design said.
- `summary.ts`: `summarizeAutomationStudioRunResult` over the trial only: record sets read under the trial run id, the
  executed graph's nodes and edges, the trace attempts (step changes and start view), the end view, action attempts,
  and the domain's view keys and denied keys.
- `feedback.ts`: bounded JSON for the model. Each step's definition, label, status and failure code (never its message),
  the stored row counts, and the judge's expected, observed, advice, findings, fix and checked lines. The judge's
  verdicts map yes→yes, no→no, unknown→unsure, not_judged→not_judged.
- `port.ts`: `automationStudioCandidateTrialPort(candidateId, ports)`. It refuses a request for another candidate id, or
  one whose frozen bytes do not match the revision and digest it names (`candidate.trial_identity_mismatch`). It keeps a
  record of every trial and the judges' spend.
- `promotion.ts`: `promoteAutomationStudioCandidateTrial`. Each of these refuses to a kept draft carrying a code:
  - no standing verdict: `candidate.trial_not_run`;
  - a verdict for another revision: `candidate.trial_stale_revision`;
  - a non-yes verdict: the trial's own code;
  - no trial record behind the yes: `candidate.trial_record_missing`;
  - an unreadable authoritative draft: `candidate.promotion_draft_unreadable`;
  - an authoritative draft whose id, revision or digest differs, or whose digest does not recompute over the stored
    plan: `candidate.promotion_digest_mismatch`;
  - a moved binding (`executionDigest` or `settingsRevision`): `FLOW_BOOTSTRAP_STALE`;
  - a `FLOW_BOOTSTRAP_STALE` throw from `createFlowBootstrapAdaptation` under its lock: `FLOW_BOOTSTRAP_STALE`.

  Any other error is rethrown. This is decision D2: the legacy lock plus digest compare, not a crash-atomic promoter.

Changes to owned files:
- `flow-bootstrap/verification/detached-execution.ts`: also returns `graph`, the selected graph that ran (never stored).
  It is absent when nothing ran.
- `result-verification/run-outcome.ts`: `readRecordSets` is now exported, and its port parameter is widened to
  `Pick<…, "listRunDatasets" | "getRunDatasetPage">`. Nothing else changed.
- `service/flow-bootstrap-commands/candidate-generation.ts`:
  - new inputs `candidateId`, `trial` and `trialSpend`; `trial` without `candidateId` throws
    `candidate.trial_candidate_id_required`;
  - the port is passed to the U1 loop as `{ candidateId, port }`;
  - judge spend is counted in the build's accounting;
  - the draft is saved under the minted id;
  - it returns `{ record, trial }`, where `trial` is the standing verdict. It still never promotes.
- `service/flow-bootstrap-commands/contracts.ts`:
  - the proposal gains an optional `candidate: { candidateId, revision, digest, trial: { runId, verdict: "yes", calls } }`;
  - the draft gains an optional `trial: { verdict | "not_tested", runId?, codes }`;
  - `ResultFor<{ authoringMode: "candidate" }>` is now the full union (draft or proposal).
- `service.ts`, kept within its ratchets: 4381 lines (it was 4386) and no new methods.
  - The D1 option `prepareCandidateStart` is added, with its private field and assignment.
  - The graph-options block of `runRuntimeSession` is replaced by `automationStudioRunGraphOptions`, and the unused
    io-policy import is dropped.
  - The candidate branch now builds the judge and the trial port. The port is wired to `getFlow`,
    `getLlmExecutionDependencyDigest`, the catalogue snapshots and deprecations, `startRuntimeSession`,
    `writeRuntimeSession`, the run datasets, the end-view reader, `runtimeSessionToFlowRunDetail` attempts and the D1
    hook. The branch passes the port to generation, then promotes. When a proposal is made it reads the permission
    outcome first, as legacy does, then calls `creation.ended()`. It returns either the proposal with its `candidate`
    block, or the draft with its `trial` block.
  - `createFlowBootstrapAdaptation` takes `candidateTrial?: JsonObject`, which is recorded on the `created` audit event.
- `audit-event.ts` is unchanged. The detail goes through `createFlowBootstrapAdaptation`'s existing detail object.

Tests: new `service/candidate-trial/tests/{fixtures,consequences,run,promotion}.test.ts` and
`service/flow-bootstrap-commands/tests/candidate-trial-facade.test.ts`. I also updated
`flow-bootstrap-commands/tests/candidate-generation.test.ts`: the facade case now tests before it completes and ends as
`proposed`, and `stale`, `cancel` and `save_failure` are kept. I added a graph-return case to `detached-execution.test.ts`.

How the brief's fail-first negatives are covered:

| Negative | Test |
| --- | --- |
| Trial gates consequences like a normal run, written first | `consequences.test.ts`: it failed on load before `index.ts` existed, then 5/5 passed. Covers move_money, delete, send_or_publish, create_new and none: the native executor is asked the same thing as a normal canonical run of the promoted graph, and the trial passes the shared options object unchanged, with no `permittedConsequences` |
| The judge request holds only trial evidence | `run.test.ts`: the judge gets only `{summary}` built from the trial's ports. `candidate-trial-facade.test.ts`: the captured `loop_verification` requests contain neither the exploration markers nor `wrong-turn`, and do contain the trial's nodes |
| A yes followed by unknown or silence gives no adaptation | `run.test.ts`, with the real judge: yes then unknown, silent or no is `unsure`. Facade: yes then unknown, silent or no means no `createFlowBootstrapAdaptation` call and no adaptation |
| Instruction edited between trial and promotion | Facade: the instruction is edited right after the draft save. The result is a draft with `codes: ["FLOW_BOOTSTRAP_STALE"]`, the draft is kept, and there is no adaptation. Unit tests also cover the stale throw under the lock and a settings change |
| Digest mismatch refused | Facade: a tampered authoritative plan gives `candidate.promotion_digest_mismatch`. Unit: another candidate id is refused too |
| Cancelled trial: no judge call, no promotion | Facade: the D1 hook cancels the build, giving AbortError, zero judge requests, no adaptation and no draft. Unit: an abort mid-run throws and the session ends `cancelled`; a runtime-cancelled run is `execution_failed` and unjudged |
| Two yeses give a proposed adaptation | Facade (`candidate-generation.test.ts` "proposed", and both hook variants): `status: "proposed"` with `candidate.trial.calls: 2`; the stored adaptation's `created` event carries `detail.candidateTrial`, and the Flow is unchanged until it is applied |
| No hook gives `not_reset` | Unit and facade: the session `metadata.candidateTrial.start` is `not_reset`, or `reset` with a hook, called once before the trial with the candidate id and revision |

## Commands run and observed results

All in `C:\Users\osrs_\FluxStuff\fxwork\t340\!FluxIQ`:

- Clean tree first: `node scripts/structure-audit.mjs` printed `structure-audit: passed (285 warning(s), 349 baselined).`
- Fail-first: `npx vitest run …/service/candidate-trial/tests/consequences.test.ts` printed
  `Error: Failed to load url ../index.ts … Does the file exist?` and `Test Files 1 failed (1)`. After the
  implementation: `5 passed (5)`.
- `npx vitest run` on `service/candidate-trial`, `service/flow-bootstrap-commands`, `flow-bootstrap/verification`,
  `flow-bootstrap/candidate`, `result-verification` and the 35 test files that call `runRuntimeSession` (the
  graph-options extraction touches every run) printed `Test Files 1 failed | 100 passed | 1 skipped (102)` and
  `Tests 1 failed | 841 passed | 2 skipped (844)`. That one failure was there before this work (below).
- `npx vitest run` on `tests/service-bootstrap`, `service/candidate-trial` and `service/flow-bootstrap-commands`,
  after the last edits: `Test Files 40 passed (40)`, `Tests 256 passed (256)`.
- `npx vitest run …/candidate-trial-facade.test.ts`, after adding the activity check: `Tests 8 passed (8)`.
- `npx vitest run` on `conversations/commands`, `api`, `flow-bootstrap/authoring-result` and `model` printed
  `Test Files 1 failed | 45 passed (46)` and `Tests 3 failed | 318 passed (321)`. All three failures are in
  `conversations/commands/tests/extension-chat.test.ts`, "in candidate authoring mode", and are caused by this change
  (below).
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` (nonincremental, includes tests): exit 0, no output.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (285 warning(s), 349 baselined).` It also printed
  `1 baseline entries can be lowered` (service.ts file-lines, 4386 to 4381). I did not run `pnpm structure:baseline`,
  because `.structure-baseline.json` is outside the brief.

## Not verified

- Live behavior: no provider, Lab or browser run. Trials were exercised only with builtin Start/End and a fake native
  press, not with real web nodes on a fixture.
- The web package typecheck (`apps/web`) and downstream test-runner were not run. The response types only gained
  optional fields, but the API handler's response sanitizer (`api/handlers/llm-generation.ts`, U3) drops `candidate`
  and `trial`.
- That the pre-existing judge test failure (below) fails identically without my changes. I reasoned it from the diff,
  which touches only `run-outcome.ts` in that directory, and from history; I did not run the test on a clean tree.
- Rows stored by a real record-producing node under the trial run id, end to end. The unit test proves the trial's
  run id reaches the options builder and the record-set read. The service wires `recordBatchHandler(projectId, runId)`
  with a session opened through `startRuntimeSession`, but no facade test stores rows.

## Open questions or contradictions found

1. **Three Core tests now fail outside my area (U3 needed).**
   `conversations/commands/tests/extension-chat.test.ts`, "in candidate authoring mode":
   - "actual registry chat creation saves a draft and leaves accepted topology unchanged";
   - the two "candidate announcement masks address …" cases.

   Their scripted model (line 158) submits and then completes without `core.test_candidate`. With a real trial port
   always injected in candidate mode, completion is refused `candidate.trial_required` and the build ends "the model's
   answer could not be used". The brief forbids touching `runtime/conversations/**`.

   The fix belongs with U3: script a test call and judge replies, then accept a candidate `proposed` result in
   `conversations/commands/build.ts`. Today it parses only drafts (`parseAutomationStudioCandidateAuthoringResult`) and
   answers "the build answered without a valid candidate draft". Until then, a candidate-mode chat build that promotes
   leaves a proposed adaptation the chat does not apply, and that blocks the next build with
   `flow_bootstrap.pending_adaptation_exists`. Legacy mode, the default, is unaffected.
2. **A test that failed before this work.** `result-verification/build-test/tests/judge.test.ts`, "yes, then unknown
   or a reply without an answer, leaves the yes standing", expects `yes`, but t296's `agreement.ts` (commit
   `1736ba81`) makes it `unknown`. The judge's header comment (`build-test/judge.ts:13`) is stale in the same way. I
   left both alone because they are outside the brief. Someone should update the test and the comment to the t296
   contract.
3. **Whether trial steps reach the chat's run activity.** Yes, but as rows of the build's activity, not as a run.
   The executor's `Running step …` events are published under the enclosing build scope (facade test: at least one
   `kind: "build"` `Running step` event and no `kind: "run"` event).

   U3 should decide whether to wrap each trial in a run scope so the chat shows a "test run". A run scope emits
   `Run started` and a final `Run finished` / `Run failed`, which the chat and Lab may read as the Flow's own run. Or
   U3 can keep them as build rows and add a "Testing the draft" row before each trial, for example from the trial port.
4. **Trial sessions are ordinary runtime sessions of the Flow.** They are listed with its runs, marked only by
   `metadata.candidateTrial`. The Lab, the run list UI and `resolveRuntimeAdaptationContext`'s run history may count
   them; a failed trial could weigh on the adaptation policy's history. U3 and U4 should filter on
   `metadata.candidateTrial`, or a later unit should give trials their own `targetKind`.
5. **Product trials repeat acts.** As D3 accepts, a trial in product (no D1 hook) repeats lasting non-gated acts (for
   example add to cart) on the person's real target, and starts from whatever exploration left (`not_reset`). Gated
   classes (money, delete, send) cannot reach a trial unpermitted, because the submission's `planStep` gate refuses or
   asks first.
6. **The D1 hook is a function option, not an HTTP call.** `prepareCandidateStart` is a service option. The design's
   "authenticated POST to a deployment-trusted URL" is the deployment's adapter, and U4 must supply it where the Lab
   boots Core.
7. **Readiness capability flag.** Readiness does not report a trial capability yet. That is the design's U3 item
   (`generation-readiness.ts`), which this brief did not own.

U2 items 1, 2 and 7 are resolved by U3 below.

---

# U3: chat and API carry a promoted candidate (same branch, on top of U2)

## Outcome

Done. In candidate mode a chat build now ends in one of two ways:

- **The trial was judged yes twice.** The chat approves and applies the proposal and says the automation is ready.
  Create-here and explore apply it; improve asks first, exactly as legacy does.
- **Anything else.** The result stays a draft. A draft is never approved or applied, and the person is told in plain
  words what the test run came to.

The API carries the candidate block on a proposal and the trial block on a draft. It refuses inconsistent results:

- a candidate-mode proposal without a candidate block;
- a legacy proposal that carries one;
- a yes that only one judge call gave;
- a draft that claims `promotionAllowed: true`.

Readiness reports the trial capability. The stale judge test now expects the t296 rule. The shared run-options builder
lives in `service/runtime-session/`. Legacy mode is unchanged: its wording and its tests are untouched and pass. Nothing
was committed.

## What changed and why

Core paths are relative to `packages/fluxiq/src/programs/automation-studio/`.

- **`runtime/flow-bootstrap/authoring-result/{contracts,parse}.ts`**
  - The draft parser now accepts an optional `trial` block: a known verdict, an optional run id, and up to 20 codes.
    It still refuses `promotionAllowed: true`.
  - New `parseAutomationStudioCandidateProposalResult({ adaptation }, subject)` accepts only a proposal for the same
    project and Flow whose `candidate` block names a candidate id, a revision, a 64-hex digest and a trial
    `{ runId, verdict: "yes", calls >= 2 }`. Anything else returns null.
  - Both parsers stay browser-safe: the browser-export test passes against the rebuilt dist.
- **`api/handlers/llm-generation.ts`**
  - New consistency rule. Candidate mode may return a draft, or a proposal with a `candidate` block. Legacy mode may
    return only a proposal, without one.
  - The sanitizer copies the draft's `trial` block and the proposal's `candidate` block field by field. A bad verdict,
    a non-yes, or fewer than 2 calls throws, so the request answers `ok: false`.
- **`api/contracts/adaptation.ts`**: readiness `capabilities.candidateTrial = { version: "automation-studio.candidate-trial.v1",
  judge: "build_test_confirmed_yes", promotion: "bootstrap_adaptation" }`, and the parser requires it exactly.
  - It is a fixed capability, the same in every Core that has the runner. The downstream readiness gate compares
    against Core's own constant, so it stays compatible.
  - A deployment-dependent `startReset` is deliberately not in the API contract, because that gate's exact match would
    break.
- **`runtime/service/flow-bootstrap-commands/generation-readiness.ts`**: runtime readiness gains
  `candidateTrial: { runner: true, startReset }`. `startReset` is true when `prepareCandidateStart` is set; `service.ts`
  passes that in.
- **`runtime/conversations/commands/build.ts`**
  - In candidate mode it parses a proposal with its candidate block first. That gives `status: "proposed"` plus
    `trial: { runId, calls }`. Otherwise it parses a draft. Neither parsing means failure, so nothing is applied.
  - New `automationStudioConversationCandidateDraftSaid(candidate)` gives one plain sentence per verdict: judged not to
    do what you asked; could not confirm; not checked; did not get to the end; never test-run; or passed but the Flow
    changed before the change could be made, or the draft no longer matched the one tested. Each ends "so nothing was
    put into the Flow. I kept what I wrote as a draft." With no trial block, the old "Verification pending" sentence
    is kept.
  - New `AUTOMATION_STUDIO_CONVERSATION_CANDIDATE_TESTED` is said after "ready", or before the apply question, only
    when a trial stands behind the proposal.
- **`create-here.ts`, `explore.ts`, `improve.ts`**: the candidate-mode summaries and announcements now describe the
  test run. The draft branch uses the new sentence. The proposal paths are the legacy code, so they apply or ask
  unchanged, and they add the tested sentence only when `built.trial` is set. The legacy strings are byte-identical.
- **`runtime/service/runtime-session/graph-options.ts`**: `automationStudioRunGraphOptions` moved here from
  `service/candidate-trial/` and is exported from the runtime-session barrel. `service.ts` and the consequences test
  import it from there.
- **`service.ts`**:
  - the type exports gain `AutomationStudioCandidateDraftTrial` and `AutomationStudioGeneratedCandidateTrial`;
  - the readiness call passes `candidateStartPrepared`;
  - the imports were moved;
  - it is still 4381 lines with no new methods.
- **Tests updated or added**:
  - `conversations/commands/tests/extension-chat.test.ts`: the scripted model submits, tests, and completes only after
    a yes. The candidate case now asserts two judge calls, an applied adaptation and the router present, "is ready"
    plus the tested sentence, and one trial session with status `succeeded`. The announcement case expects the
    test-run wording.
  - `execute.test.ts`, candidate mode:
    - create-here and explore approve and then apply a tested proposal;
    - improve asks instead of applying;
    - a proposal without the trial block is never applied;
    - six draft-verdict cases × 3 commands never apply and say the verdict.
  - `build.test.ts`: proposal parsing, refusal of a wrong Flow or a one-call yes, the draft trial block, and refusal of
    `promotionAllowed: true`.
  - `authoring-result/tests/parse.test.ts`: both parsers' accept and refuse cases.
  - `api/handlers/tests/llm-generation.test.ts`: both blocks carried, the six refusals, and the readiness capability
    required.
  - `result-verification/build-test/tests/judge.test.ts`: "yes, then unknown or a reply without an answer" now expects
    `unknown`, not `oneCallSaidYes`.
  - `tests/service-bootstrap/tests/generation.test.ts`: the readiness expectation gains `candidateTrial`, the
    consequence of the owned readiness change.
  - `candidate-trial-facade.test.ts` asserts the runtime readiness `candidateTrial` with and without the hook.
  - The U2 `run.test.ts` fixture's `as never` cast was replaced by a fully typed dataset summary.

## Commands run and observed results

In `C:\Users\osrs_\FluxStuff\fxwork\t340\!FluxIQ`:

- `npx vitest run` on `runtime/conversations`, `api`, `flow-bootstrap/{authoring-result,candidate,verification}`,
  `result-verification`, `service/{candidate-trial,flow-bootstrap-commands,runtime-session}`, `tests/service-bootstrap`,
  `model` and the 35 test files that call `runRuntimeSession`: `Test Files 1 failed | 187 passed | 1 skipped (189)`,
  `Tests 1 failed | 1445 passed | 2 skipped`. That one failure was the readiness expectation in
  `generation.test.ts`. After updating it, the file printed `Tests 8 passed (8)`. In that sweep, `judge.test.ts`
  (30), `extension-chat.test.ts` (13) and `browser-export.test.ts` (1) passed.
- After the last edits: `service/candidate-trial` printed `Tests 30 passed (30)`; `candidate-trial-facade.test.ts`
  `8 passed`; `execute.test.ts` `34 passed`; `extension-chat` plus `build` tests `20 passed`, then `build.test.ts`
  `10 passed`; `api` `136 passed`; `parse.test.ts` `25 passed`.
- `pnpm --filter ./packages/fluxiq build`: exit 0, needed for the web typecheck and the browser-export test.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: exit 0, run last after every edit.
- `npx tsc --noEmit --incremental false -p apps/web/tsconfig.json`: exit 0. In `apps/web`, `npx vitest run
  src/features/automation-studio/authoring` printed `Test Files 2 passed`, `Tests 51 passed`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (285 warning(s), 349 baselined)`, plus the same
  "1 baseline entries can be lowered" note for service.ts.
- `git diff -U0 | grep "^+" | grep "as never"`: the only hit is the prose "never test-run". Untracked files contain no
  `as never` after the fix.

## Not verified

- No live, provider, Lab or browser run. Web panels were not exercised in a browser. They need no change: a candidate
  proposal arrives as an ordinary `{ adaptation }` and takes the existing review path, and their draft parser now
  accepts the trial block. The web unit tests cover the parser only through dist.
- Downstream test-runner tests were not run. Its readiness gate compares the readiness response against Core's own
  constant, so the added capability should match; that is unverified against a running panel.
- This worktree's structure audit predates dev's new `as never` rule. I checked for added `as never` casts with grep,
  not with that rule.

## Open questions or contradictions found

1. **Stale comment.** `result-verification/build-test/judge.ts:13`, the header line "answers, then answers, unknown or a
   silent reply -> yes", still states the pre-t296 rule. That file is not in my ownership. It should read: only
   answers then answers is yes.
2. **What a draft reports.** A candidate draft still ends the chat command as `done`, with its `candidate-draft`
   attachment and the verdict sentence. With a trial runner, a candidate build can complete only on a yes, so in
   practice a draft now comes only from a promotion refusal: stale, or digest mismatch. If the person should see a
   draft as a failure instead, that is a one-line change per command. I did not make it, because it would drop the
   attachment that `execute.ts` adds only to done outcomes.
3. **Trial sessions in run history.** Trial sessions still appear among the Flow's runtime sessions, marked
   `metadata.candidateTrial` (see U2 item 4). The extension-chat test now relies on that marker to find them.
