# g-core-ladder-llm-off: the recovery ladder offers no LLM step when the LLM is off

Worker `g-core-ladder-llm-off`, 2026-09-13. Core at `f22f401`, not committed. Paths
under `packages/fluxiq/src/programs/automation-studio/` unless given in full.

## Outcome

**Done, by Route B.** Nothing is committed.

- **Before the decision:** the first pass stopped, as the brief's step 3 required.
  The ladder received no "LLM off" input.
- **The decision:** the supervisor approved Route B, recorded as "Amendment to
  `g-core-ladder-llm-off` — Route B (Core)" in `briefs/finish-week1.md`.
- **The fix, one change in each of three files:**
  - the graph run's options gain one optional field, `allowLlmDiagnosis`;
  - Core's runtime service sets it from the run's LLM setting;
  - the recovery ladder leaves out its LLM step when the field is `false`.
- **What the fix preserves:**
  - with the LLM on, or with the field left out, behaviour is as before;
  - the deterministic steps are unchanged;
  - the failed attempt's own failure record and message are unchanged.
- **Evidence:** five new tests pass. A mutation that ignores the field fails the two
  LLM-off rows. The restored ladder file is byte-identical. `pnpm check` passed.

## What changed and why

### Why a new input was needed

The ladder had no way to know the LLM was off.
- `chooseAutomationStudioRecovery` (`runtime/executor/recovery-ladder.ts:5-18`)
  receives the Flow, the node, the attempt, the comparison, the failure edge,
  `AutomationStudioGraphExecutionOptions` and the attempt counts.
- The options type (`runtime/executor/contracts.ts:153-187`, before this change) had
  no LLM field.
- Its only LLM-related input was `recoveryBudget.maxAdaptationOrLlmAttemptsPerRun`.
  Its sole producer is `service.ts:3447` through
  `recoveryBudgetFromRuntimeAdaptationContext` (`service.ts:6676-6682`), which fills
  it from `maxInterventionsPerRun`, 2 or 3 by default (`model/flows.ts:240`, `:260`).
  It never reads `behavior.invokeLlm`.
- **Route A was rejected.** It would have forced that budget to 0, which reports a
  disabled LLM as a spent budget: in `metadata.budgetExhausted` and in the run's
  stop message (`recovery-ladder.ts:70`, `:77`).

### The three source edits (Core diff)

1. **`runtime/executor/contracts.ts`** (+5 lines, 187 to 192).
   `AutomationStudioGraphExecutionOptions` gains `allowLlmDiagnosis?: boolean`, with a
   doc comment. `false` means the ladder may not offer `llm_diagnosis`. Leaving it out
   keeps the step available, subject to the budget as before.
2. **`runtime/service.ts:3447`** (0 net lines; 6807 before, 6807 after, against the
   `file-lines` baseline of 6807). The line now reads:
   `if (adaptationContext) { graphOptions.recoveryBudget = recoveryBudgetFromRuntimeAdaptationContext(adaptationContext); graphOptions.allowLlmDiagnosis = adaptationContext.behavior.invokeLlm; }`
   - **Why it is read here:** this is after both adjustments to the run's setting,
     so the field sees the run's real value. Those adjustments are the run override
     (`:3441-3443`, `runtimeAdaptationContextWithRunOverride`, `:6612-6652`) and the
     explicit-proposal override (`:3444-3446`).
   - **Why two typed assignments:** a first draft used `Object.assign`. I replaced it
     so that TypeScript checks the property names.
3. **`runtime/executor/recovery-ladder.ts:54`**: `if (!budgetExhausted.llm)` became
   `if (options.allowLlmDiagnosis !== false && !budgetExhausted.llm)`.
   - **With the step left out:** `selected` stays undefined, so
     `failureMessageForRecoveryStop` does not return the "LLM diagnosis fallback" text.
     No budget message is set, so it returns the attempt's own message (`:78`).
   - **Unchanged:** the deterministic path and reroute conditions (`:31`, `:44`).

### What the field does per run mode, by code (not run)

**`allowLlmDiagnosis` is `false`, so there is no LLM step:**
- `no_llm_intervention` / `adaptiveMode: "deterministic"` without `dryRunLlm`
  (`service.ts:6620-6624`);
- `normal` training mode with `allowLlmIntervention: false`
  (`training-modes.ts:181`).

**`allowLlmDiagnosis` is `true`, so the step is offered as before:**
- `manual_approval` (`:6626`);
- `dryRunLlm: true` (`:6633`);
- explicit `diagnose_and_adapt` runs (`:3444-3446`, `:6659`).

**The field is left out, so behaviour is as before:**
- runs with no adaptation context, where there is no project or no canonical Flow
  (`:3441-3443`);
- every other caller of `runAutomationStudioGraph`: `compiled-plan.ts:158`, and
  `live-patch.ts:179` when its caller passes no options.

**Child Flows inherit the field.** `runCanonicalAutomationStudioFlow` spreads the
run's options into each graph run (`runtime/composite-executor.ts:38-39`). The Lab's
router path (`service.ts:3490`) and the direct path (`:3571`) both pass the same
`graphOptions`.

**Downstream effect for a failed node with no failure edge and the LLM off:**
- the stored recovery attempt is `exhausted`, not `diagnosis_only`
  (`runtime/service/summaries/conversions.ts:241`);
- no `diagnosis` intervention is written (`:203-222`);
- the summary's `interventionCount` does not count it (`:178`);
- the terminal reason is "Recovery ladder exhausted all known recovery candidates."
  (`:256`).

### The new test file

`runtime/executor/tests/recovery-ladder.test.ts`, 97 lines, 5 tests, run through the
barrel's `runAutomationStudioGraph`. Its fixture is one `builtin.policy.action` node.
Its effect dispatcher fails with a message and a structured failure (category
`target_not_found`, code `test.target.not_found`). A second Flow adds a failure edge
to a `builtin.policy.recovery` node and an end node.

1. **LLM off:**
   - `candidates: []`, no `selected`, no `metadata.budgetExhausted`;
   - the run fails after one attempt;
   - the attempt's node id, status, route, message, failure record and comparison
     status equal both the expected values and the same run with the LLM on;
   - the run's message is the node's own.
2. **LLM off, with a failure edge:** candidates `[deterministic_path, reroute]`,
   `deterministic_path` selected, and the run succeeds.
3. **LLM on:** candidates `[llm_diagnosis]`, `llm_diagnosis` selected, and the
   message is the "LLM diagnosis fallback" text.
4. **Field left out:** the same as row 3, and the recoverable Flow lists
   `[deterministic_path, reroute, llm_diagnosis]`.
5. **LLM on with an LLM budget of 0:** candidates `[]`, and the message is the budget
   text. Both controls still apply.

## Commands run and observed results

All Core commands ran in `F:\!FluxIQ`. Test commands ran from `packages/fluxiq`.
Output went to scratch files, and each exit status was echoed.

- **Before editing:**
  - `git status --short` showed only `g-core-host-state-node`'s files modified:
    `package-boundaries.md`, `host-state.ts`, `node-execution.ts` and
    `executor/tests/node-execution.test.ts`.
  - `wc -l` gave `service.ts` 6807, `contracts.ts` 187 and `recovery-ladder.ts` 79.
- **First test run:** `npx vitest run src/programs/automation-studio/runtime/executor/tests/recovery-ladder.test.ts src/programs/automation-studio/runtime/tests/executor.test.ts --no-file-parallelism`
  - Result: `exit=1`, 1 failed | 19 passed.
  - Cause: a real defect in my first test draft. `toMatchObject` expected
    `"failure": undefined` and `"message": undefined` from a divide-by-zero attempt
    that has neither key. I rewrote the fixture as the failing action described above.
- **Same command after the rewrite:** `exit=0`; `Test Files 2 passed (2)`,
  `Tests 20 passed (20)`. That is 15 in `executor.test.ts` and 5 in
  `recovery-ladder.test.ts`.
- **Mutation proof:**
  - `sha256sum recovery-ladder.ts` before the mutation:
    `de7c6da37633bceb1ae061d94453b42bb1959df949ca400cef4652ed953c0847`.
  - The mutation removed `options.allowLlmDiagnosis !== false && ` at `:54`.
  - `npx vitest run src/programs/automation-studio/runtime/executor/tests/recovery-ladder.test.ts --no-file-parallelism`
    gave `exit=1` and `Tests 2 failed | 3 passed (5)`:
    - `× ... offers no LLM rung when the LLM is off, and the run fails with the node's own failure`,
      with `AssertionError: expected [ 'llm_diagnosis' ] to deeply equal []`;
    - `× ... keeps the deterministic rungs when the LLM is off`, with
      `AssertionError: expected [ 'deterministic_path', …(2) ] to deeply equal [ 'deterministic_path', 'reroute' ]`.
  - After restoring the line, `sha256sum` gave the same
    `de7c6da37633bceb1ae061d94453b42bb1959df949ca400cef4652ed953c0847`, so the file is
    byte-identical.
- **Rerun after the restore** (same two-file command): `exit=0`,
  `Tests 20 passed (20)`.
- **After editing:** `wc -l service.ts` gave 6807. `git diff` on the three files
  shows only the edits described above.
- **New file in a copied index:**
  - `cp .git/index <scratchpad>/gclo-index`, then
    `GIT_INDEX_FILE=<scratchpad>/gclo-index git add .../executor/tests/recovery-ladder.test.ts`;
  - the copied index lists the file;
  - in the real index, `git ls-files` printed nothing for it, and `git status` shows it
    as `??`.
- **`GIT_INDEX_FILE=<scratchpad>/gclo-index pnpm check`:** `exit=0`.
  - `structure-audit: passed (123 warning(s), 256 baselined).` The warnings are
    400-line advisory notes. None names my files. One names `runtime/tests/executor.test.ts`
    at 403 lines, which is not mine.
  - `tsc --noEmit` reported `Done` for `packages/contracts`,
    `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web`.
  - The run included `g-core-host-state-node`'s in-progress edits, and nothing
    failed.
- **Not run:** `pnpm build`, the full suite, `docs:reference`, and every Lab command,
  as directed. There was no commit and no change to the real index.

## Migration Notes paragraph (Route B), for the supervisor to merge

> **Automation Studio recovery ladder honours a disabled LLM.**
> `AutomationStudioGraphExecutionOptions` gains an optional `allowLlmDiagnosis`
> field. When it is `false`, the recovery ladder does not offer its `llm_diagnosis`
> candidate; omitting it keeps the previous behaviour, so existing callers of
> `runAutomationStudioGraph` need no change. The Automation Studio runtime service
> now sets it from the run's training behaviour (`invokeLlm`), after any run
> override is applied. As a result, a run whose LLM is off — for example
> `adaptiveMode: "deterministic"` (`no_llm_intervention`) without `dryRunLlm`, or a
> project with `allowLlmIntervention: false` — no longer records an LLM diagnosis
> fallback for a failed node that has no deterministic recovery: its recovery
> attempt is `exhausted` rather than `diagnosis_only`, no `diagnosis` intervention
> is written, and it adds nothing to the run summary's `interventionCount`. The run
> still fails with the same structured failure record, and its trace message is
> the failed node's own message rather than the "LLM diagnosis fallback" text.
> Deterministic recovery candidates, recovery budgets, and runs that allow the LLM
> (including `dryRunLlm: true`, `manual_approval`, and explicit
> `diagnose_and_adapt` runs) are unchanged.

## Not verified

- **The service-level wiring is not proven by a test.** No test drives
  `runRuntimeSession` with a `no_llm_intervention` project whose action fails, and
  checks for `interventions: []`, a recovery attempt of `exhausted` and
  `interventionCount: 0`.
  - What exists: the type check shows the property name and type at `service.ts:3447`
    agree with `contracts.ts`, and the ladder is tested through `runAutomationStudioGraph`.
  - The right place for the test is `runtime/tests/service.test.ts`. It is outside my
    Owns, and it is at its 4787-line baseline.
- **The per-mode table is from reading code**, not from runs.
- **Live patches:** I did not check whether `live-patch.ts:179` receives the service's
  options when it re-runs a patched Flow.
- **Other consumers:** I did not check anything that reads a recovery attempt's
  status or `interventionCount`, such as the UI's recovery timeline or
  `adaptive-orchestrator.ts:178`, for the move from `diagnosis_only` to `exhausted`.
- **What a Lab run must show,** after this change and `f-runner-no-dry-run-llm`'s
  removal of `dryRunLlm: true`:
  - one W25 `too-slow` and one W15 `popup-blocked` Flow run, each with
    `harnessActivations: 0`;
  - their categories unchanged: `timeout` (`web.action.timeout`) and
    `output_not_observed`;
  - passing Flow runs still at 0;
  - in a kept Core store, a failed run whose `interventions` are empty, whose
    `recovery_attempt` has status `exhausted`, and whose `summary_json.interventionCount`
    is 0.
  - If the runner still sends `dryRunLlm: true`, `harnessActivations` stays at 2,
    because the flag turns `invokeLlm` back on.
- **No full suite and no `pnpm build`.** The fluxiq package's `dist` and the framework
  references are not regenerated.

## Open questions or contradictions found

1. **An authored architecture page now describes the ladder incompletely.**
   `F:\!FluxIQ\docs\architecture\automation-studio.md:420-425` lists the ladder's
   order as "... graph local recovery reroute, then LLM diagnosis fallback", with no
   exception for a run whose LLM is off. That file is outside my Owns and was not
   edited. Suggested addition after "then LLM diagnosis fallback.": "The LLM
   diagnosis rung is offered only when the run's training behaviour allows the LLM
   (`allowLlmDiagnosis` on the graph options, set from `invokeLlm`); with the LLM off,
   a failed node with no deterministic recovery ends `exhausted`."
2. **The framework reference.** `F:\!FluxIQ\docs\reference\framework-reference.md:607`
   lists the executor contract types. Its line numbers for `contracts.ts` entries
   after `:185` move by 5. The supervisor regenerates it at the gate.
3. **`dryRunLlm` is still not a dry run.** This was already open from
   `i-harness-activation` and is unchanged here. It turns `invokeLlm` on, and therefore
   `allowLlmDiagnosis` too.
