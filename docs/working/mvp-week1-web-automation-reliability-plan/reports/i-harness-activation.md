# i-harness-activation: what the Flow lane's harness activations count with no provider

Worker `i-harness-activation`, read-only, 2026-09-13. This repository at HEAD (no
diff from `d639415` in any runner file cited). Core at `f22f401` (no diff from
`3cb8976` in any Core file cited). Every conclusion cites code or a stored field.
No page data, secret or recorded value is quoted: only kinds, statuses, ids, codes
and counts.

## Outcome

Done. The answer is **(d)**, a mix of two defects in two repositories plus one
counting consequence:

1. **Each failed Flow run gets two intervention records. Neither called a
   provider.**
   - **Record A, the recovery-ladder marker.** It is not an LLM request. Core writes
     it on every failed node that has no failure edge, whatever the LLM settings,
     because the ladder offers its "Request LLM diagnosis" rung without checking
     whether the LLM is allowed. That is a Core defect. The runner counting it as
     an activation is the symptom described in (a).
   - **Record B, the harness request.** It *is* an LLM request in the metric's sense:
     a packed `runtime_diagnosis` request, stopped only because no provider was
     configured (`llm.provider_missing`). Core writes it only because **the Lab asks
     for it**. The runner sends `dryRunLlm: true` on every Flow run, and Core
     honours that by overriding the project's `no_llm_intervention` setting. This is
     a runner defect in this repository, not (b).
2. **(c) is false.** A negative variant that fails by design needs no LLM.
   "Must be 0 with provider disabled" is the right rule once both defects are fixed.
3. **Smallest correct fix:**
   - drop `dryRunLlm: true` in `packages/test-runner/src/existing-fluxiq-control.ts:250`;
   - have Core's recovery ladder skip `llm_diagnosis` when the run's context has
     `invokeLlm: false`;
   - leave the runner's count unfiltered.

## What changed and why

Nothing tracked changed. I wrote only this report, plus scratch scripts
(`iha-survey.mjs`, `iha-sqlite.mjs`, `iha-events.mjs`) and file copies in my
scratchpad. Nothing under `F:\fxlab-runs` was written. The Core SQLite files and
object files were copied to the scratchpad and opened there, read-only.

### 1. What each counted intervention is

**How the runner counts.**
- `readRunDetail` sets `harnessActivations: interventions.length` over
  `runDetail.interventions`, reading neither kind nor provider
  (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:222`, `:226`, `:182`).
- The bench's rate is `applies: () => true, hit: harnessActivations > 0`
  (`packages/test-runner/src/bench/aggregate-report.ts:126-129`).
- Fuzzy recovery requires `harnessActivations === 0` (`aggregate-report.ts:104-107`).

**Stage 2d bundles** (`F:\fxlab-runs\stage2d\{a,b,c,d}`; fields
`evaluation.json $.harnessActivations`, `$.reportedVerdict`, `$.flowCreated`,
`$.llm`; the same count is in `snapshots/flow-lane.json $.harnessActivations`):

| Flow-lane runs with `evaluation.json` | Count | `harnessActivations` |
| --- | --- | --- |
| `reportedVerdict: failed` | 11 | 2 in every one |
| `reportedVerdict: passed` | 20 | 0 in every one |
| `flowCreated: false` (nothing executed) | 5 | 0 in every one |

- **W25 `too-slow`** (`a/run-mu02gkbf-f6f29849`, `a/run-mu02i2zp-e3078883`,
  `a/run-mu02jgi6-908234be`): reported `failed`, category `timeout`, code
  `web.action.timeout`, `harnessActivations: 2`, `llm: {mode: disabled, calls: 0}`.
- **W15 `popup-blocked`** (`a/run-mu02821o-fbd5b092`, `a/run-mu029hml-7e9956d4`,
  `a/run-mu02awe1-e68098d8`): reported `failed`, category `output_not_observed`,
  `harnessActivations: 2`.
- **Contrast** (`a/run-mu023nye-7ecc83ab`, `a/run-mu0255k5-3732d289`,
  `a/run-mu026lbm-5cf3a77b`, multi-tab unarmed): reported `passed`,
  `harnessActivations: 0`.
- **Also 2:** the other failed runs are `short-catalog` (b ×2, c ×1, d ×1) and W10
  `broken-link` (d ×1).
- **`llm.calls` is not an observation.** It is hard-coded
  `{ mode: "disabled", profileId: null, calls: 0 }` in
  `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts:85`.

**Where the kinds come from.** The W25 and W15 bundles hold no Core run detail,
only the count. The one Stage 2d failed run whose Core store was kept is
`kept/run-mu02vd6b-046b01e6` (bundle `c/run-mu02vd6b-046b01e6`, `short-catalog`,
reported `target_not_found`, `harnessActivations: 2`). It fails a node the same
way W25 and W15 do: a failed attempt with no `failed` edge and no recovery node.
From the copied `project.sqlite` (`runtime_runs`, `runtime_action_summaries`) and
its event-chunk objects:

- **Run:** `runtime_runs.status: failed`, `summary_json.interventionCount: 2`.
- **Attempt:** status `failed`, failure `web.target.not_found`, comparison
  `target_not_found`, `metadata.recoverySelected.kind: llm_diagnosis`.
- **`recovery_attempt` event:** status `diagnosis_only`, `selectedKind: llm_diagnosis`,
  `candidateCount: 1`, candidates `[llm_diagnosis]`.
- **Record A**, `intervention` event 1:
  - kind `diagnosis`, stream status `failed`, id shape `<attemptId>.recovery.diagnosis`;
  - reason "No lower-priority deterministic recovery fully resolved the failed
    transition.";
  - `validation.ok: false`, issue "LLM diagnosis provider is not configured in this
    runtime slice.";
  - no `provider`, `model`, `promptVersion` or `tokenUsage`; metadata keys
    `[recoveryId]`.
- **Record B**, `intervention` event 2:
  - kind `diagnosis`, stream status `failed`, id shape
    `intervention.runtime_diagnosis.<run>.<time>`;
  - reason "LLM intervention was prepared.";
  - `validation.ok: false`, issue code `llm.provider_missing`;
  - `promptVersion` present, `contextSummary.taskKind: runtime_diagnosis`,
    `contextSummary.dryRun: false`, `metadata.expectedOutput: diagnosis`, metadata
    carries `requestId`;
  - no `provider`, `model` or `tokenUsage`.
- **Final `run_summary` metadata:**
  - `trainingMode: normal`;
  - `trainingBehavior: {invokeLlm: true, runRecovery: true, createAdaptations: true, promoteAdaptations: false}`;
  - `llmGate: {invoked: false, providerConfigured: false, ok: false, diagnostics: [llm.provider_missing]}`;
  - `runtimeAdaptationContext`: mode `normal`, policy preset `locked`, budget ok.
    Its diagnostics include "LLM intervention is disabled by training mode or
    settings.", "Normal mode records adaptive context without invoking LLM.",
    "Runtime override mode: no_llm_intervention." and "Runtime override enabled
    dry-run LLM adaptation suggestions.";
  - `terminalFailureReason`: the ladder "stopped at LLM diagnosis fallback" text.
- **Project settings the Lab got:** both `flow_settings` rows have
  `intervention_mode: no_llm_intervention` (version 1), `training_json.mode: normal`,
  `allowLlmIntervention: false`, and adaptation preset `locked`. These are Core's
  defaults (`packages/fluxiq/src/programs/automation-studio/model/flows.ts:223-276`).

**Record A: the Core code that writes it** (paths under
`packages/fluxiq/src/programs/automation-studio/`):
- `runtime/executor/graph-run.ts:206-212`: a failed attempt calls
  `chooseAutomationStudioRecovery`. At `:213-225` no executable failure edge means
  the run stops with the ladder's message.
- `runtime/executor/recovery-ladder.ts:31` adds `deterministic_path` only with a
  failure edge, and `:41-53` adds reroutes only to `builtin.policy.recovery` nodes.
  `:54-61` **always** adds `llm_diagnosis` ("Request LLM diagnosis") unless the LLM
  budget is exhausted. With no other candidate it is selected (`:62-63`).
- `runtime/executor/recovery-budget.ts:21`: the only LLM guard is the count
  `maxAdaptationOrLlmAttemptsPerRun`. It is fed from `maxInterventionsPerRun`
  (`runtime/service.ts:6676-6682`), never from `behavior.invokeLlm`. The Lab's
  project leaves it at 3 (`flows.ts:260`).
- `runtime/service/summaries/conversions.ts:241` maps a selected `llm_diagnosis` to
  status `diagnosis_only`. `:203-222` turns every `diagnosis_only` into an intervention
  of kind `diagnosis` with the "not configured in this runtime slice" issue. `:178`
  also counts it into the summary's `interventionCount`, and `:255` writes the
  terminal reason.
- It is persisted through `runtime/service/summaries/store.ts:109` and
  `storage/project/runtime-stream-store.ts:463`, then read back at `:493`.

**Record B: the Core code that writes it, and why it runs at all:**
- The Lab's run call sends `adaptiveMode: "deterministic", dryRunLlm: true`
  (`packages/test-runner/src/existing-fluxiq-control.ts:246-251`). This has been in
  place since `5e9d97e`, the testing facility's first commit, and is pinned by
  `packages/test-runner/src/tests/existing-fluxiq-control.test.ts:259`. Both Lab
  callers use it: `flow-lane/persisted-flow-run.ts:158` and `existing-flow-run.ts:88`.
- Core's handler spreads that payload into `runRuntimeSession`
  (`api/handlers/runtime-execution.ts:24`, `:35`).
- `runtime/service.ts:3441-3443` builds the context through
  `runtimeAdaptationContextWithRunOverride`. At `:6620-6624`, `deterministic`
  (normalized to `no_llm_intervention`, `:6475-6479`) sets `invokeLlm: false`. Then
  `:6632-6637`, `dryRunLlm === true`, **sets `invokeLlm`, `runRecovery` and
  `createAdaptations` back to true**. That matches the stored `trainingBehavior` and
  the "Runtime override enabled dry-run" diagnostic.
- `runtime/service.ts:3529` (router path, which is this run's: its events include
  `route_decision` and `subflow_execution`) and `:3584` call
  `maybeAnnotateRunDetailWithRuntimeLlm`.
  - At `:2877` a non-failed run returns untouched.
  - At `:2879-2889`, with `invokeLlm` false it would return with
    `llmGate.invoked: false` and **no** intervention. With the flag it passes.
- The provider resolver returns `undefined` when there is no execution grant
  (`packages/fluxiq/src/programs/_shared/runtime.ts:73-86`). The Lab sends no grant,
  so no throw and no provider (`service.ts:2893-2908`), and failure evidence is not
  captured (`:2940`).
- `service.ts:3015-3038` calls `runAutomationStudioLlmHarness` for
  `runtime_diagnosis` with no provider **and no `dryRun`**. In
  `runtime/llm/harness/run.ts:96-106` a missing provider yields code
  `llm.provider_missing` with `ok: false`.
- `runtime/llm/harness/intervention.ts:20-27` builds the record: id
  `intervention.runtime_diagnosis.…`, reason "LLM intervention was prepared.",
  `promptVersion` set, `provider` set only when a provider existed. The kind is
  `diagnosis` (`runtime/llm/harness/task-kind.ts:38`; stored kind observed).
- No patch runs without a provider (`service.ts:3039`). `service.ts:3146-3148`
  appends the record to the run detail.

### 2. Should Core record it in the Lab's mode, and does it meet the definition

| | Record A, ladder marker | Record B, harness request |
| --- | --- | --- |
| Provider called | No (no provider, model or tokens) | No (`llm.provider_missing`) |
| Request built | No (no `promptVersion` or `requestId`) | Yes (`promptVersion`, `requestId`, `taskKind`) |
| Written without the Lab's `dryRunLlm` | Yes, in every mode | No (`service.ts:2879-2889` returns first) |
| Should Core record it in `no_llm_intervention` | **No.** The LLM rung is unavailable, so the record and the terminal reason describe a fallback that cannot happen | **Yes, as asked.** The Lab explicitly turned `invokeLlm` on |
| Meets "runs requesting an LLM intervention" | Only nominally: the rung is labelled "Request LLM diagnosis", but nothing was requested | **Yes.** An LLM request was prepared and failed only for lack of a provider |

### 3. Which option is true

- **(a)** holds for record A only. The runner counts a record that is not a request
  (`persisted-flow-run.ts:222-226`). A runner-side filter is the wrong remedy,
  though: Core should not write the record in this mode (see 4).
- **(b)** holds for record A (the ladder picks an LLM rung in a no-LLM mode) and is
  false for record B, because the Lab requested it.
- **(c)** is false. Failing by design does not require the LLM rung: the ladder's
  other outcome, `exhausted` (`conversions.ts:241`, `:256`), exists for exactly that.
- **(d)** is the answer. Record B is a runner configuration defect: the benches ran
  with LLM diagnosis switched on. Record A is a Core ladder defect. Together they give
  "2 on every failed run, 0 on every other run".

### 4. The smallest correct fix

1. **This repository, test-runner.** Remove `dryRunLlm: true` from
   `packages/test-runner/src/existing-fluxiq-control.ts:250` and keep
   `adaptiveMode: "deterministic"`.
   - Test: change the expected body in
     `packages/test-runner/src/tests/existing-fluxiq-control.test.ts:259`. Mutation
     proof: restore the flag and watch that assertion fail.
   - Effect by code: the override leaves `invokeLlm` false (`service.ts:6620-6624`),
     and the gate returns with no record (`:2879-2889`), so record B disappears.
   - Execution is unchanged. No provider was reachable either way (`runtime.ts:74-83`),
     so no evidence capture (`:2940`) and no patch (`:3039`); a passing run was never
     annotated (`:2877`).
2. **Core, the ladder** (supervisor's boundary alert applies; workers do not edit Core).
   The ladder must not offer `llm_diagnosis` when the run's context has
   `behavior.invokeLlm === false`. Two ways:
   - **Smallest:** in `recoveryBudgetFromRuntimeAdaptationContext`
     (`runtime/service.ts:6676-6682`), set `maxAdaptationOrLlmAttemptsPerRun: 0` when
     `!context.behavior.invokeLlm`. The budget is set after the override
     (`service.ts:3441-3447`), so it sees the run's real mode. Then
     `recovery-budget.ts:21` reports the LLM exhausted, `recovery-ladder.ts:54` skips
     the rung, nothing is selected, the recovery attempt is `exhausted`
     (`conversions.ts:241`), and no intervention is written (`:205`, `:178`).
     Side effect: the stop message becomes "Recovery budget exhausted: max
     adaptation/LLM attempts per run." (`recovery-ladder.ts:30`, `:70`, `:77`;
     `graph-run.ts:215-224`), which misdescribes a disabled LLM as an exhausted one.
     The runner reads the structured failure record, not the message
     (`persisted-flow-run.ts:249`), so classification is unaffected.
   - **Cleaner:** a graph option in `runtime/executor/contracts.ts` (next to
     `recoveryBudget`, `:185`), set at `service.ts:3447` from `invokeLlm` and checked
     at `recovery-ladder.ts:54`. The attempt's own message is kept.
   - Tests: Core `runtime/tests/executor.test.ts`, beside "records deterministic
     recovery decisions before LLM diagnosis fallback" (`:271`), for no `llm_diagnosis`
     candidate when disallowed. Core `runtime/tests/service.test.ts`, for a
     `no_llm_intervention` project whose action fails: `interventions: []`, recovery
     attempt `exhausted`, `summary.interventionCount: 0`.
3. **Runner metric:** no filter. With fixes 1 and 2, `interventions.length` is again
   "LLM interventions Core recorded" (`persisted-flow-run.ts:107`,
   `docs/architecture/testing-facility.md:877-878`). Filtering by record shape, such as
   counting only records with `promptVersion`, would guess at Core's internal records.
   **Both fixes are needed.** Fix 1 alone leaves 1 activation per failed run, because
   record A remains. Fix 2 alone leaves record B, because `dryRunLlm` turns `invokeLlm`
   back on, which also restores the ladder's budget.

**Can Lab Stage 3's benches be re-read without rerunning?**
- **Every rate except harness activation: yes.** The flag changes only the
  `interventions` and `llmGate` records of failed runs, not execution (see fix 1).
  Fuzzy recovery is unaffected: passing runs have 0 by construction (`service.ts:2877`;
  the ladder runs only on a failed attempt, `graph-run.ts:206`), so the `=== 0` test
  never excludes a passing run.
- **Harness activation: re-readable, but not provable as 0.**
  - Bundles keep only the count (`persisted-flow-run.ts:226`; `evaluation.json`;
    `snapshots/flow-lane.json`), and `llm.calls` is hard-coded
    (`observed-run-evaluation.ts:85`), so kinds cannot be recovered from a bundle.
  - At the Stage 3 pins the cited code is unchanged (both `git diff --stat` runs
    empty), and no Lab run can reach a provider: no grant is sent
    (`existing-fluxiq-control.ts:246-251`), and the resolver returns `undefined`
    without one (`runtime.ts:74-83`).
  - So Stage 3 can honestly be read as: **provider calls 0, by construction**. Raw
    activations equal the Flow runs Core failed after a failed attempt, 2 each: one
    ladder marker and one provider-less request the Lab's own flag asked for.
  - The metric as defined was **not** 0 in Stage 3: the flag made every failed run
    request an LLM intervention.
  - Consistency check the supervisor can run on the Stage 3 bundles:
    `harnessActivations` is 2 exactly when `flowCreated: true` and
    `reportedVerdict: failed`, and 0 otherwise. Any other value contradicts this report.
  - The "must be 0" proof needs a Lab run after the fixes. One W25 `too-slow` and one
    W15 `popup-blocked` Flow run showing `harnessActivations: 0`, with categories
    `timeout` and `output_not_observed` unchanged, would do; a full bench rerun is not
    required.

## Commands run and observed results

- **Bundle survey:** `node iha-survey.mjs` (read-only; prints whitelisted
  `evaluation.json` fields and the key paths of any `intervention` or `harness` key)
  → exit 0, 56 lines. 49 bundles with an evaluation: 36 Flow-lane, 13 recording-lane.
  - The 11 reported-failed Flow runs all show `harnessActivations: 2`; the other 25
    Flow runs show 0; every run shows `llm {disabled, null, 0}`.
  - Seven `kept/` directories and one `d/.work` directory have no `evaluation.json`.
- **Copies:** `find` plus `cp` copied `kept/run-mu02vd6b-046b01e6`'s `*.sqlite*` files
  (outside `versions/`) and its 15 `objects/sha256` files into the scratchpad.
  `keep-manifest.json` has reason `core-stopped-final-sweep`.
- **Node:** `node --version` → `v22.11.0`; `node:sqlite` is unavailable without
  `--experimental-sqlite`.
- **`node --experimental-sqlite iha-sqlite.mjs <copy>`:**
  - First run: exit 1, `no such module: rtree` on an R-tree table.
  - After the fix: exit 1 again. The project database and the runtime `global.sqlite`
    were read, including both `flow_settings` rows. The Core-root
    `.fluxiq/global.sqlite` **copy** reported `database disk image is malformed`.
    It is not needed and was not retried. This is a single observation: likely a
    WAL copied inconsistently, possibly this machine's RAM.
- **`node --experimental-sqlite iha-events.mjs <copy>`:**
  - First run: exit 0, but the chunk files read as absent (my path join doubled the
    project folder).
  - After the fix: exit 0, all 4 event chunks read. The output is summarized under
    section 1.
- **Pins:** `git log -S'dryRunLlm' -- packages/test-runner/src/existing-fluxiq-control.ts`
  → `5e9d97e 2026-09-04`. `git diff --stat d639415 HEAD` on the four runner files →
  empty. `git -C F:\!FluxIQ diff --stat 3cb8976 HEAD` on the ten Core files → empty.
  Core HEAD is `f22f401`.

## Not verified

- **W25 and W15 intervention kinds:** not read directly, because their bundles hold
  only the count. The kinds come from the kept `short-catalog` run, which fails
  through the same path (failed attempt, no failure edge, no recovery node). The
  identical count of 2 fits, but it is an inference.
- **Unread code:** `retryRuntimeSessionAfterAutoAppliedPatch`. The claim "execution is
  unchanged by the flag" rests on no provider, no patch and `adaptationIds` empty
  (`runtime_runs.adaptation_count: 0`), not on reading that function.
- **Not re-checked:** Stage 2's "14 of 44" (no Stage 2 bundles read), and all of
  Stage 3 (not touched).
- **Fixes:** not applied; no test run; no Lab run. What a Lab run must show after both
  fixes:
  - W25 `too-slow` and W15 `popup-blocked` Flow runs with `harnessActivations: 0` and
    categories `timeout` and `output_not_observed`;
  - passing Flow runs still 0;
  - in a kept Core store, a failed run with `interventions` empty and a
    `recovery_attempt` of status `exhausted`.
- **Minor:** the Core-root `global.sqlite` copy was not readable (above). One stored
  context diagnostic string was not in my whitelist and was printed only as "other".
  The tail of `kindForLlmTask` was not read; the stored kind `diagnosis` was observed.
- **Core fix side effects:** not checked for Core consumers of `diagnosis_only` or
  `interventionCount`, such as the UI or `adaptive-orchestrator.ts:178`, which filters
  out `llm_diagnosis` candidates.

## Open questions or contradictions found

1. **`dryRunLlm` is not a dry run.** Core's override turns the LLM on
   (`service.ts:6632-6637`), but the harness is called without `dryRun`
   (`service.ts:3015-3038`), and the stored request says `dryRun: false`. With a
   provider resolved, this flag would make a real provider call. Why the runner has
   sent it since `5e9d97e` is not documented anywhere I read. Should Core rename it, or
   pass `dryRun` through?
2. **Core's own accounting overstates too.** `adaptiveRuntimeMetricsFromRunDetail`
   counts every `diagnosis` intervention as an `llmCallCount`
   (`conversions.ts:29`), so both no-provider records count as LLM calls. The
   stability metrics penalize `interventionCount` (`training-modes.ts:204-215`).
3. **Scope.** The ladder fix is a Core change. Whether it is Week 1 work, or whether
   Week 1 instead records the Stage 3 reading above (provider calls 0 by construction,
   activations explained) and defers the Core fix, is the supervisor's call. Without
   it, the rate cannot be 0 for any failing run.
4. **Plan wording.** The Metrics row says "must be 0 with provider disabled". The runner
   comment (`persisted-flow-run.ts:107`) and `testing-facility.md:877-878` say "LLM
   interventions Core recorded". These agree only once Core stops recording the ladder
   marker in a no-LLM mode.
