# Report: lane-t-u7 (t734 trace-consumer-wiring)

## Outcome
Done (2026-10-20). The executor (through the shared graph options), the evidence loop (its clock) and the whole and
partial trial runners go through `AutomationStudioRunEnvironment`; live or offline is the environment passed, never
a second code path. Live behaviour is unchanged: every consumer defaults to the live environment, the live `random`
is never imposed, and the existing tests in the seven directories pass unedited. Choosing an offline environment per
trial remains P6.

## Plan

Task: the remaining-wiring table in `reports/lane-t.md`: the executor, the evidence loop and the trial runner go
through the environment port (clock plus channel scope, decision D3), so live or offline is configuration, never a
second code path; live behaviour unchanged, proven by the existing tests. Trees: `fxwork/t734/!FluxIQ` and
`fxwork/t734/!FluxIQWebExtension`, branch `task/t734-trace-consumer-wiring`.

Design (lead):
- Each consumer takes an optional `AutomationStudioRunEnvironment` and defaults to
  `automationStudioLiveRunEnvironment`, whose fields are exactly today's fallbacks. So Automation Studio's
  `runtime/service.ts` needs no edit for P1: lane S (t728, unmerged) has committed edits there, and choosing an
  offline environment per trial is P6 (row #18).
- Shared helper `automationStudioEnvironmentExecutorOptions(options, environment)` in `runtime/environment/` (written
  by the lead first, so the two workers below can run in parallel): a copy of the executor options with
  `now`/`delay`/`random` from the environment.
- The channel scope is ambient (D3): whoever runs offline work enters `environment.within`; the trial runners do so
  around the trial's client work. The evidence loop takes its clock from the environment; a repair-phase offline
  evidence call (P5/P6) is wrapped at its call site.
- Decision 6 in code: a non-live trial runs no start hook and no site reset. Decision 3 in code: a non-live pass is
  never the judged whole-run pass.
- Not in this unit (unchanged from the table): region-execution's referenced deadline timer (needs a timer
  abstraction for a virtual clock: P4), scoped sessions' events on the global event bus (P4), the gateway id and timer
  sources (P3/P4), per-phase choice of offline trials (P6).

| Unit | Worker | Owns (Core, under `packages/fluxiq/src/programs/automation-studio/runtime/`) |
| --- | --- | --- |
| L0 helper | lead | `environment/executor-options.ts`, `environment/index.ts` (one line), `environment/tests/executor-options.test.ts` |
| W-A run path + evidence loop | worker-high | `service/runtime-session/graph-options.ts` (+ tests), `llm/loop-configuration.ts`, `llm/evidence-loop.ts` (line-neutral: 800/800), new tests beside |
| W-B trial chain | worker-high | `service/candidate-trial/{contracts,run,port}.ts`, `service/subflow-trial/{types,run,port}.ts`, `flow-bootstrap/candidate/{contracts,trial-gate}.ts`, `flow-bootstrap/subflow-candidate/{contracts,subflow-trial-gate}.ts`, `service/project-build/{brief-ports,whole-trials}.ts` only if needed; tests beside |

## Progress log

### 2026-10-19 - L0 shared helper (lead)
- Added `environment/executor-options.ts` (`automationStudioEnvironmentExecutorOptions`, copy-with-override of
  `now`/`delay`/`random`), its barrel line, and `environment/tests/executor-options.test.ts` (keeps other options,
  leaves the input untouched, a 60 s wait on the virtual clock costs no wall time).
- Check: `pnpm exec vitest run src/programs/automation-studio/runtime/environment/tests/executor-options.test.ts`
  (packages/fluxiq) -> `Test Files 1 passed (1)  Tests 3 passed (3)`.

### 2026-10-19 - W-A run path and evidence loop (worker-high), verified by the lead
- Changed: `service/runtime-session/graph-options.ts` (optional `environment`, default live, options through the
  helper), `llm/loop-configuration.ts` (optional `environment` on the loop input: clock source; the scope is entered by
  whoever runs the loop), `llm/evidence-loop.ts` (still 800 lines: `const clock = input.budget?.now ??
  input.environment?.now ?? Date.now;` plus a comment line swapped), new `service/runtime-session/tests/graph-options.test.ts`,
  two tests appended to `llm/tests/loop-budget.test.ts` (llm/tests/ and evidence-loop/tests/ are at 25 files).
  Report `reports/lane-t-u7-wa-run-path.md`.
- Finding that changed the design: the live environment's `random` is NOT equivalent to the executor's fallback. The
  Wait node reads a missing `random` as 0.5, no jitter (`nodes/timing/wait.ts:39`); `Math.random` would add jitter to
  every live Wait. W-A and W-B each worked around it locally; the lead moved the rule into the one helper (next entry).

### 2026-10-19 - W-B trial chain (worker-high), verified by the lead
- Changed: `service/candidate-trial/{contracts,run,port}.ts` (optional `environment` on the trial ports; clock and
  `trial.<unique>` run id from it; the trial's client work runs inside `environment.within`; a non-live trial runs no
  start hook; the port carries `environmentKind` and offers `prepareStart` only when live);
  `service/subflow-trial/{run,port}.ts` (the same); `flow-bootstrap/candidate/{contracts,trial-gate}.ts` (780 lines:
  `environmentKind` on the port type; `automationStudioCandidateTrialOffline`; an offline trial gets no start hook, no
  reset, nothing recorded as left on the site; an offline yes is answered as evidence with `ok: false`, code
  `candidate.trial_offline_yes`, never kept as the standing verdict, so completion still needs a live yes);
  `flow-bootstrap/subflow-candidate/{contracts,subflow-trial-gate}.ts` (770 lines, the same, code
  `subflow.trial_offline_yes`). New tests: `service/candidate-trial/tests/environment/tests/trial-environment.test.ts`,
  `service/subflow-trial/tests/environment.test.ts`, `flow-bootstrap/candidate/tests/offline-trial/tests/offline-trial-gate.test.ts`,
  `flow-bootstrap/subflow-candidate/tests/subflow-trial-offline.test.ts`. Existing tests unedited (613 passed before
  the new ones); with the offline check forced off and the `within` wrap removed, 6 new tests failed. Report
  `reports/lane-t-u7-wb-trial-chain.md`.
- New model-facing text: `AUTOMATION_STUDIO_CANDIDATE_OFFLINE_YES_INSTRUCTION` (generic: "ran offline, on what Core
  recorded of the site ... completing needs a yes from a trial run on the live site from its start ... test this same
  revision again") and the two codes. Prompt contract tests pass (below). For P6: "test this same revision again"
  assumes the next trial of the revision is live; P6 should run that live trial itself rather than ask the model.
- Lead review note, kept as is: on an offline yes the gate drops an older non-yes verdict of the same revision (a live
  "no" is unaffected: it closes the digest in a separate map, so an offline trial of it never runs; a live yes is never
  dropped). Only transient verdicts (unsure, execution_failed) can go; the port's trial records keep them for audit.

### 2026-10-19 - Lead fix: the live-randomness rule in one place
- `environment/executor-options.ts`: `now`/`delay` always from the environment; `random` only when
  `environment.kind !== "live"` (a live run keeps whatever `random` its options already had). Removed W-A's and W-B's
  duplicated identity checks from `graph-options.ts` and `candidate-trial/run.ts` (whose
  `automationStudioTrialExecutorOptions` is now `environment ? helper(options, environment) : options`). Helper test
  updated (live leaves `random` unset; a live run's own `random` kept; an offline environment's taken).
- Check: `pnpm exec vitest run .../environment .../runtime-session/tests/graph-options.test.ts
  .../candidate-trial/tests/environment .../subflow-trial/tests/environment.test.ts` -> `Test Files 7 passed (7)
  Tests 32 passed (32)`.

### 2026-10-20 - W-C project-build wrappers keep the environment kind (worker), verified by the lead
- Changed: `service/project-build/whole-trials.ts` (the wrapped port carries the inner port's `environmentKind` with
  `prepareStart`, written at creation; the reset-ledger `trialRan` writes are skipped for an offline trial),
  `service/project-build/subflow-trials.ts` (carries `environmentKind`), new
  `service/project-build/tests/project-build-trial-environment-kind.test.ts` (6 tests; all 6 failed with the source
  edits reverted). Without this, an offline port wrapped by the project build would have been treated as live (site
  reset run, offline yes accepted). Report `reports/lane-t-u7-wc-build-wrappers.md`.
- Its check: `pnpm exec vitest run src/programs/automation-studio/runtime/service/project-build` -> `Test Files 21
  passed (21)  Tests 96 passed (96)`.

### 2026-10-20 - Lead's validation of the whole unit
- Prompt contract tests (model-facing text moved): `pnpm exec vitest run .../llm/deepseek/tests/system-prompt.test.ts
  .../flow-bootstrap/plan/tests/extraction-vocabulary.test.ts .../flow-bootstrap/plan/tests/issue-feedback.test.ts`
  -> `Test Files 3 passed (3)  Tests 57 passed (57)`.
- `pnpm exec tsc --noEmit` (packages/fluxiq, uncached) -> `tsc exit 0`.
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (413 warning(s), 1152 baselined).`; downstream
  -> `structure-audit: passed (210 warning(s), 625 baselined).`
- Downstream consumes none of the changed types (grep of apps, domain, packages for the trial port, trial ports,
  graph options, evidence loop and environment names -> no match), so no Core rebuild or downstream typecheck needed.
- Directory sweep (packages/fluxiq): `pnpm exec vitest run $R/flow-bootstrap $R/llm $R/service/project-build
  $R/service/candidate-trial $R/service/subflow-trial $R/service/runtime-session $R/environment`
  (`R=src/programs/automation-studio/runtime`) -> `Test Files 495 passed | 1 skipped (496)  Tests 5053 passed | 2
  skipped (5055)`, exit 0. None of the new test files contains a skip.
- UNIT READY (Core, all under `packages/fluxiq/src/programs/automation-studio/runtime/`): `environment/index.ts`,
  `environment/executor-options.ts`, `environment/tests/executor-options.test.ts`, `flow-bootstrap/candidate/contracts.ts`,
  `flow-bootstrap/candidate/trial-gate.ts`, `flow-bootstrap/candidate/tests/offline-trial/**`,
  `flow-bootstrap/subflow-candidate/contracts.ts`, `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`,
  `flow-bootstrap/subflow-candidate/tests/subflow-trial-offline.test.ts`, `llm/evidence-loop.ts`,
  `llm/loop-configuration.ts`, `llm/tests/loop-budget.test.ts`, `service/candidate-trial/{contracts,port,run}.ts`,
  `service/candidate-trial/tests/environment/**`, `service/project-build/{subflow-trials,whole-trials}.ts`,
  `service/project-build/tests/project-build-trial-environment-kind.test.ts`, `service/runtime-session/graph-options.ts`,
  `service/runtime-session/tests/graph-options.test.ts`, `service/subflow-trial/{port,run}.ts`,
  `service/subflow-trial/tests/environment.test.ts`; downstream `docs/working/trace-offline-trials-plan/reports/lane-t-u7*.md`
  (this report and `-wa-run-path`, `-wb-trial-chain`, `-wc-build-wrappers`).

## Lane S's lifecycle accessor (the supervisor's question)

My wiring does not make an explicit per-request field easy, and I recommend keeping the build lifecycle ambient. The
`environment` added here is a loop-input field read once at loop entry (clock); the channel scope is ambient by design
(D3), for the same reason lane S chose an accessor. A field on the evidence tool request would ride every
`executeTool` call: the request type (`llm/loop-configuration.ts:82`), the loop's own call and pass-throughs, six node
tools (`llm/node-tools/{replay-draft,rerun-check,step-place,run-flow,run-flow-part,dry-run-gate}.ts`), the step-log
wrapper, `llm/harness-options/{binding,registry}.ts` (whose `executionFor` forwards to the domain binding's
`executeTool` -- a cross-repository contract), and every wrapper that forwards requests (evidence recall, action
permissions, person-needed, authoring loop, trial view, ...): about 25 files plus the extension's domain binding.
W-A's list: `reports/lane-t-u7-wa-run-path.md` item 2. Nothing in this unit touches that chain or the accessor.

## Not verified

- No live, paid or browser run (none allowed); no caller passes a non-live environment yet (choosing one per trial is
  P6), so the offline paths are proven by unit tests only.
- Cleared-control handles inside `within`, and the judge running inside the scope, have no dedicated test.
- The subflow project-build wrapper does not copy the inner port's optional `standingNos` / `checkRows` (it did not
  before either; W-C's open question, outside this unit).

## Open questions or contradictions found

1. P6 must decide what follows an offline yes: the gate now answers it with "test this same revision again", which is
   only right if the next trial is live.
2. Still deferred from the table: region-execution's referenced deadline timer (P4, needs a timer abstraction),
   scoped sessions' events on the global event bus (P4), the gateway id and timer sources (P3/P4), the per-phase
   choice of offline trials (P6, row #18). Automation Studio's `runtime/service.ts` was not edited (lane S has commits
   there); the consumers default to the live environment, so it needs no change until P6 chooses one.
