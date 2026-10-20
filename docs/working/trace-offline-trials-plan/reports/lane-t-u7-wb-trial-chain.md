# lane-t-u7-wb-trial-chain (worker report)

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t734/!FluxIQ`, branch `task/t734-trace-consumer-wiring`. No commits.
All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. The candidate and subflow trial runners take an optional `AutomationStudioRunEnvironment` (live by default). Both
trial ports report their environment's kind and offer `prepareStart` only when the kind is live. Both trial gates apply
Decision 6 (an offline trial gets no start hook, no site reset and no `trialRan`) and Decision 3 (an offline yes goes
back to the model as evidence but is never stored as the standing verdict, so `completion`, `standing`, promotion and
the supervisor's acceptance never see it). Live behaviour is unchanged: all 613 existing tests in the brief's
directories pass unmodified.

## What changed and why

- `service/candidate-trial/contracts.ts`: `environment?: AutomationStudioRunEnvironment | undefined` on
  `AutomationStudioCandidateTrialPorts`. `now` and `newRunId` on the ports still win when given.
- `service/candidate-trial/run.ts`: `runAutomationStudioCandidateTrial` resolves
  `environment = ports.environment ?? automationStudioLiveRunEnvironment` and runs the whole trial inside
  `environment.within(...)`: start, execute, end-view and attempt reads, cleared-control handles, and also the session
  writes and the judge. For live, `within` just calls the work. The body moved into a private `trialIn`.
  `now = ports.now ?? environment.now`, and the run id is `ports.newRunId?.() ?? environment.newRunId("trial")`, which
  keeps the `trial.<uuid>` shape. New export `automationStudioTrialExecutorOptions(options, environment)`.
  `automationStudioCandidateTrialStart` returns `not_reset` without calling the hook when the environment is not live.
- `service/candidate-trial/port.ts`: the port is `Object.assign(run, { environmentKind })`, where the kind is
  `ports.environment?.kind ?? "live"`. `prepareStart` is offered only when the kind is live.
- `service/subflow-trial/run.ts` and `port.ts`: the same changes. The run id is `environment.newRunId("subflow-trial")`,
  which keeps today's `subflow-trial.<uuid>` shape. `types.ts` was not changed: `AutomationStudioSubflowTrialPorts` is
  `Omit<AutomationStudioCandidateTrialPorts, "judge" | "execute">`, so it gets `environment` automatically. `start.ts`
  was not changed either: it calls the candidate start with the ports spread in, so it gets the no-hook rule for
  offline trials automatically.
- `flow-bootstrap/candidate/contracts.ts`: optional `readonly environmentKind` on `AutomationStudioCandidateTrialPort`.
- `flow-bootstrap/candidate/trial-gate.ts` (753 -> 780 lines):
  - New export `automationStudioCandidateTrialOffline(port)`: true when the kind is set and is not "live".
  - For an offline trial, `test()` skips `prepareStart`, `reset.beforeTrial` and `reset.trialRan`.
  - An offline yes is not written to `verdicts`. An older non-yes verdict for the same revision is deleted; a live yes
    already stored stays. Where the gate turns a pass into acceptance: `completion()` and `standing()` both read
    `verdicts`, and so do promotion (`service/candidate-trial/promotion.ts:73`) and the supervisor
    (`project-agents/supervisor/state.ts:461`, `dispatch-tool.ts:316`). Keeping the offline yes out of `verdicts`
    guards all of them at once, without restructuring.
  - The answer to an offline yes has `ok: false`, `verdict: "yes"`, `retestsLeft`, `resultReason: retry_allowed` and
    `resultCode: "candidate.trial_offline_yes"`, plus the new instruction below. The slow-down check is skipped for it.
- `flow-bootstrap/subflow-candidate/contracts.ts`: `AutomationStudioSubflowTrialPort` becomes the function type plus an
  optional `readonly environmentKind`.
- `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts` (758 -> 770 lines): the same rule, using the exported
  helper and instruction. The result code is `subflow.trial_offline_yes`. It also covers `whole` mode (single-subflow
  judged run), and `builder-loop.ts` `passed()` never sees an offline yes.
- Item 4: `service/project-build/brief-ports.ts` and `whole-trials.ts` were left unchanged. Neither builds a trial
  port with its own clock or run ids: `whole-trials.ts` spreads the service's trial environment, which already carries
  `environment?` through `Omit<AutomationStudioCandidateTrialPorts, ...>`, and `Date.now` in `brief-ports.ts` only
  timestamps instructions. See the open questions for the gap they still have.

New model-facing text: `AUTOMATION_STUDIO_CANDIDATE_OFFLINE_YES_INSTRUCTION`, exported from `trial-gate.ts`, and the
two result codes `candidate.trial_offline_yes` and `subflow.trial_offline_yes`. The instruction is generic, names no
site or scenario, and only shows up when a port's kind is not live, which no caller produces yet. I ran the three
prompt contract tests (results below).

New tests. The candidate-trial and candidate test directories already hold 25 files, the limit, so two new files sit
in feature subdirectories, as `candidate/tests/kept-condition/tests/` already does:
- `service/candidate-trial/tests/environment/tests/trial-environment.test.ts` (5 tests):
  - live default: `trial.<uuid>` run id, the options object exactly as built, no `random`, no channel scope, port kind
    live;
  - a fixture environment's clock (startedAt 5000), run id `trial.fixture-1`, and its now, delay and random reach the
    executor;
  - a live environment named explicitly leaves `random` unset;
  - the runner, the press, rows, end view and attempts all run inside the environment's `scopeId`;
  - offline: no start hook, no `prepareStart`, port kind "fixture", recorded start `not_reset`; an explicitly live
    environment keeps the hook.
- `service/subflow-trial/tests/environment.test.ts` (3 tests): the same for a partial trial.
- `flow-bootstrap/candidate/tests/offline-trial/tests/offline-trial-gate.test.ts` (4 tests):
  - offline: no hook, no reset, no `trialRan`;
  - an offline yes is answered (`candidate.trial_offline_yes`, `ok: false`, `retestsLeft` 2), `standing` is
    undefined, `completion` refuses with `candidate.trial_required`, and `retestable()` still offers a test;
  - a stale unsure is dropped, and a live yes survives a later offline yes;
  - a port with no kind or a live kind behaves as before.
- `flow-bootstrap/subflow-candidate/tests/subflow-trial-offline.test.ts` (3 tests): the same, in partial and `whole`
  mode.

I wrote the implementation before the new tests, not tests first as the brief asked. To make up for that, I ran a
mutation check: with `automationStudioCandidateTrialOffline` forced to return false and the `within` wrap removed,
6 of the new tests failed (the 5 gate tests and the within test). I then restored both files.

## Commands run and observed results

All commands ran from `packages/fluxiq` unless noted.
- `pnpm exec vitest run src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/service/subflow-trial src/programs/automation-studio/runtime/flow-bootstrap/candidate src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate src/programs/automation-studio/runtime/service/project-build`
  - Before the new tests: `Test Files 100 passed (100)  Tests 613 passed (613)`.
  - Final, after the test type fixes: `Test Files 104 passed (104)  Tests 628 passed (628)`.
- The four new test files alone: `Test Files 4 passed (4)  Tests 15 passed (15)`.
- Mutation check on those files: `Tests 6 failed | 6 passed (12)`. The files were restored afterwards.
- `pnpm exec tsc --noEmit`: `tsc exit: 0`. An earlier run failed only in the other worker's
  `service/runtime-session/tests/graph-options.test.ts` and on a missing `llm/tests/evidence-loop-environment.test.ts`.
  That run also failed on two type errors in my own new tests (a wrong relative path, and an optional option under
  `exactOptionalPropertyTypes`), which I fixed.
- `pnpm exec vitest run src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/issue-feedback.test.ts`:
  `Test Files 3 passed (3)  Tests 57 passed (57)`.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (413 warning(s), 1152 baselined).` An earlier
  run showed `FAIL [directory-files] ... runtime/llm/tests/: 26 source files`, which came from the other worker's new
  file; it was gone by the final run.

## Not verified

- I did not test that `clearedControlHandles` runs inside `within` directly; that would need a trial that presses a
  way out. It sits inside the same wrapped body as the reads that are tested.
- No live or browser run. No caller passes a non-live environment yet, so the offline paths are exercised only by the
  unit tests above.
- The judge call now runs inside the channel scope as well (the whole trial body is wrapped). That makes no difference
  for live, and I believe none offline, since the judge issues no gateway commands, but no test checks it.

## Open questions or contradictions found

1. The brief and the executor options. The brief specified
   `automationStudioEnvironmentExecutorOptions(ports.graphOptions(...), environment)`, which for the live environment
   would set `random` to `Math.random`. The other worker's `graph-options.ts` header says a missing `random` means no
   jitter in the Wait node, so setting it would change every live run's pauses. It would also replace a test's own
   `now` in `graphOptions`. So `automationStudioTrialExecutorOptions` leaves the options unchanged when the ports name
   no environment, and otherwise applies the helper and drops the live `random`, matching `graph-options.ts`.
2. The kind does not reach the gate in a project build yet. `service/project-build/whole-trials.ts:78` and
   `service/project-build/subflow-trials.ts:110` wrap the trial port and copy only `prepareStart`. Before P6 passes a
   non-live environment, both wrappers must also copy `environmentKind`. `whole-trials.ts:71-73` also writes trial acts
   into the supervisor's ledger, and that write should be skipped for an offline trial. I did not change them: the
   brief allowed `whole-trials.ts` only for clock or run-id threading, and `subflow-trials.ts` is not mine.
3. `subflow-trial-gate.ts` `port.weighed` still tells the project build an offline trial's verdict. A yes would feed
   `AutomationStudioProjectBuildProposals.passed`, which picks the predecessors for later briefs' entry preparation.
   That is not completion, but P6 should decide whether an offline pass may prepare a dependent's entry.
4. An offline trial still counts toward `AUTOMATION_STUDIO_CANDIDATE_MAX_TRIALS_PER_REVISION`. Its answer also keeps
   `effectApplied: true, targetsUnchanged: false`, as a live trial's does. Both are left for P6 to decide.
