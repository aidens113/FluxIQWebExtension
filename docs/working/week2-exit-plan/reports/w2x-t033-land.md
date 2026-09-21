# w2x-t033-land — worker report

Brief: `### Brief: w2x-t033-land` in `docs/working/week2-exit-plan.md`, run on
the speculative base (merge `task/t027-multi-action-exploration`, not `dev`).
The supervisor then extended the scope to the Lab audit reader, six stale Core
assertions and a single re-run of the 16-action arm.

- Worktrees: `F:\fxwork\t033\!FluxIQWebExtension` and `F:\fxwork\t033\!FluxIQ`.
- Branch: `task/t033-multi-action-reconcile` in both.
- Date: 2026-09-21.
- State: everything is staged and uncommitted.

## Outcome

**Done.** The live A/B passes on both arms by the brief's criteria:

- Arm 1 (`run-mubmnrhq-f3f577eb`) and arm 16 (`run-mubo9tco-90f098f6`) each
  created a Flow whose replay passed the oracle, with
  `build.providerCalls == observed.calls` (4 = 4) and no interventions.
- In arm 16, one provider decision (iteration 3) completed **four ordered
  actions** (four `web.enter_field` actions at batch positions 1 to 4, each
  applied). This is read from Core's stored evidence trace, not from a count.
- Usage was counted once: per-decision usage sums exactly to the build
  accounting.

The merge is staged in both worktrees, the `evidence-loop.ts` split is done,
and both repositories' `check` and `build` pass. The six deterministic Core
failures are fixed. Every other earlier failure passes when its file runs
alone, so those were load timeouts.

What remains:

- Merge mechanics: a hook denies `git merge`. The resolution is staged
  without MERGE_HEAD. **The supervisor records the second parent**:
  - Core t027 tip: `510680f9a8a6411718dcd17f534993d8ae5a448a`
  - Downstream t027 tip: `9617103394f9f407f09467e29f5660d0aa1450b3`
- One inherited downstream failure (`lane.test.ts:67`, from `dev`).
- The usage-on-failed-read fix. Its sites are in files I do not own and are
  named below.

## What changed and why

### 1. Merge resolution (both worktrees)

I applied t027's changes as content with
`git diff --binary <base> <t027 tip> | git apply --3way`.

Two files conflicted textually:

- **Core `.structure-baseline.json`**: `service.ts` was 6377 (t033) against
  6381 (t027). I resolved it to **6377**, the lower, because the ratchet only
  falls.
- **Downstream `docs/working/README.md`**: regenerated with
  `node scripts/structure-audit.mjs --update --rule working-docs`, which
  gives t027's index plus the multi-action row.

Files both sides changed, all of which compose without semantic conflict:

- **Core `generation-failure.ts`**: t027's categorical pre-provider codes sit
  alongside t033's batch step fields, decision counting and trace sanitiser.
- **Core `llm-generation.ts`**: t027's grant-issue mapping sits alongside
  t033's `maxActionsPerDecision` validation.
- **Core `llm/index.ts`**: t027's resolver contract export sits alongside
  t033's `evidence-batch` export.
- **Core `service.ts`**: t027's resolver types moved out, plus its
  `llmEvidenceRuntime` readiness field and categorical codes. t033's action
  limit plumbing and its trace sanitiser move out of the file.
- **Downstream `existing-fluxiq-control.ts` and its test**: t027's
  `patchSkippedCode` sits alongside t033's generation parameter.

Integrity check (observed): every t027-only file in the index equals t027's
tip blob, with 0 mismatches across 24 Core and 125 downstream files. t027's
diffs contain no batch or actions-per-decision code.

### 2. `evidence-loop.ts` split (brief), Core

`runtime/llm/evidence-loop.ts` went from 810 to **753** lines.
`evidenceContextWindow` moved, unchanged, to
`runtime/llm/evidence-loop/context-window.ts` as
`automationStudioLlmEvidenceContextWindow`, with a barrel
`runtime/llm/evidence-loop/index.ts`. This is the `harness.ts` / `harness/`
pattern. The directory holds loop internals and is not re-exported from
`runtime/llm/index.ts`.

### 3. Merge-created size violation, Core

The merge made `runtime/flow-bootstrap/generation-failure.ts` 815 lines, a
`file-lines` FAIL. I moved `flowBootstrapEvidenceTraceDiagnostics` and its
private `evidenceTraceIdentifier`, unchanged, to
`runtime/flow-bootstrap/evidence-trace.ts`, exported through the same barrel.
The file is now **779** lines.

`service.ts` is 6354 lines. The audit says its entry could be lowered from
6377 to 6354; I did not run `pnpm structure:baseline`.

### 4. Lab audit bound (scope extension)

File: downstream `packages/test-runner/src/existing-fluxiq-control.ts`.

The old reader required `iterationCount ≤ providerCallCount + 1` and
`toolCallCount ≤ 16`. It refused every multi-action proposal, because each
action of a list writes its own trace row under the decision's iteration.

The bound is now derived from the record's counts and the actions per
decision its build declared:

- `providerCallCount ≤ iterationCount ≤ providerCallCount × actionsPerDecision + 1`.
  Every decision leaves at least one row and at most one per action; the `+1`
  is the loop's opening observation. At one action per decision this is
  exactly the old `calls + 1`.
- `toolCallCount ≤ iterationCount`, and
  `toolCallCount ≤ AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxToolCalls`.
  That is Core's own ceiling, imported from `fluxiq/automation-studio`, which
  replaces the literal 16.
- A record without a call count (legacy) is bounded as Core's sanitizer
  bounds a trace: `iterationCount ≤ maxIterations + maxToolCalls`, both from
  Core's published limits.

Where `actionsPerDecision` comes from:

- The client records the declared value, by project and Flow, in
  `generateFlowBootstrapAdaptation`, before sending the request, so a build
  recovered after a timeout keeps its declaration.
- All five places that parse an adaptation (get, reject, approve, apply,
  revert) pass it.
- A Flow the client did not build is held to Core's production default of
  one. That is `CORE_DEFAULT_ACTIONS_PER_DECISION = 1`, documented as Core's
  `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_ACTIONS_PER_DECISION`,
  which is not on Core's public subpath. This is the one literal left.

The `toolIds.length > 16` and `evidenceBytes` bounds are unchanged; they do
not reject multi-action audits.

New test in `src/tests/existing-fluxiq-control.test.ts`: "reads a list-taking
build's audit against the actions per decision that build declared".

- An audit of 3 calls, 7 actions and 8 rows is refused before the client
  declared anything, and accepted after it declared 16.
- 1 call with 17 rows is accepted; 18 rows is refused.
- Rows fewer than calls, actions more than rows, and 65 actions (above Core's
  64) are all refused.
- Another, undeclared Flow on the same client keeps the single-action bound.
  The mock echoes the requested `flowId`, so this refusal can only come from
  the bound.

### 5. Six stale Core assertions (scope extension)

All six encoded contracts that t033 deliberately changed. Neither branch had
touched these test files, and t033's reports never ran them. Every other
assertion in each test, safety included, is unchanged.

1. **`runtime/tests/service-bootstrap/tests/rejections.test.ts`, the
   `it.each` expectation (about line 133).** This is one expectation that
   covers four failing cases: wrapper shape, plan structure, evidence
   profile limits and registry validation. `decisionCount` changes from 4 to
   **3**. t033's `evidenceLoopDiagnostic` counts provider decisions (distinct
   iterations above 0), not trace rows, and each case makes 3 provider
   requests (`expect(requests).toHaveLength(3)`). The exact `steps` list,
   issue codes and no-content assertions are kept.
2. **`runtime/tests/service-bootstrap/tests/plan-parameters.test.ts`, about
   line 233** ("stops after three refused plans in a row").
   `decisionCount` changes from 4 to **3**, for the same reason: the test
   asserts `run.requests` has length 3. The no-topology, no-adaptation and
   revoke assertions are kept.
3. **`runtime/tests/deepseek-bootstrap-exploration.test.ts`, about line 245**
   ("asks again after a malformed decision…"). The stored unusable row now
   equals
   `{ iteration: 1, decision: "unusable", resultCode: "llm.provider_malformed_response" }`.
   t033's sanitiser keeps the closed `resultCode`. `toEqual` still proves the
   row has no tool, no call id and no content.

### 6. Usage when the proposal read fails (named, not fixed: not my files)

Build usage is recorded only by `input.settleBuild(build)` at
`packages/test-runner/src/flow-lane/creation/lane.ts:125`, and its figures
come from the proposal the build read.

- **`flow-lane/creation/build-proposal.ts:161`**: `proposed()` calls
  `control.getFlowAdaptation` unguarded. If that read throws, the throw
  skips `settleBuild`.
- **`run-scenario.ts:340-352`**: the created-Flow lane is not wrapped in
  `live-llm/lane-settlement.ts`'s settlement. So not even the
  `run_not_identified` snapshot is written, which is why the first arm-16
  run had no `snapshots/live-llm.json`.

A fix needs the build's usage from a source that does not depend on the
proposal read. For example, the refused read could return a `failed` build
carrying the audit's accounting, or the lane could read the grant's usage.

## Commands run and observed results

### Live A/B

Scenario `social-scheduler`, instruction task `social-scheduler-schedule-post`,
seed 171, `--target isolated` (fresh store per run), `--evidence checkpoints`,
`FLUXIQ_TEST_ENV_FILES=none`, `deepseek-chat`, `create-flow`.

Per-run limits: 48k input, 8k output and 56k per request; 560k run tokens;
25 s timeout; 0 retries; 25 calls at $0.04 each. The snapshot shows
`granted.maxTotalEstimatedCostUsd: 1`, a $1 total. The Lab's total is
min($2, per-call × calls), so the per-call cost was set to reach $1.

| | Arm 1 (`--llm-max-actions-per-decision 1`) | Arm 16 re-run (`… 16`) |
| --- | --- | --- |
| Run | `run-mubmnrhq-f3f577eb` | `run-mubo9tco-90f098f6` |
| Verdict | passed; oracle passed; `harnessActivations` 0 | passed; oracle passed; `harnessActivations` 0 |
| Build calls against observed calls | 4 = 4; interventions 0; evaluation `llm.calls` 4 | 4 = 4; interventions 0; evaluation `llm.calls` 4 |
| Tool calls and trace rows | 4 tool calls; 5 rows | 7 tool calls; 8 rows |
| Actions per decision | one each | iteration 3: **four ordered actions** |
| Stop reason | completion accepted, proposal `proposed` | completion accepted (iteration 4), proposal `proposed` |
| Cost and tokens | $0.01803472; 39,218 in, 590 out | $0.01925528; 41,689 in, 691 out |
| Created Flow | 8 action nodes: click 2, select 2, type 3, extract_list 1 | the same shape |
| Build duration | 40,053 ms | 115,512 ms |
| Run duration | 247,883 ms | 370,630 ms |
| Wall clock | 391 s | 426 s |

Wall clock and durations are not comparable across arms. Other workers held
the machine at 99% CPU during arm 1, and load varied through the session.

**Arm 16's stored evidence trace.** This was read from the isolated Core
store (`.fluxiq/global.sqlite`, `automation.state`) during the run, before
finalize deleted the workspace. Only identifiers, closed codes, batch
positions and usage figures were extracted. Rows in order:

| Iteration | Decision | Tool | Result | Batch | Usage |
| --- | --- | --- | --- | --- | --- |
| 0 | tool_call | `web.inspect_current_page` | `web.inspect.succeeded` | | |
| 1 | tool_call | `web.press_control` | applied, `web.action.succeeded` | | 7950 in / 67 out / $0.00358644 |
| 2 | tool_call | `web.detect_repeating_structure` | `web.structure.detected` | | 10941 / 72 / $0.00490908 |
| 3 | tool_call | `web.enter_field` | applied, `web.action.succeeded`, targets unchanged | 1 of 4 | 11119 / 185 / $0.00513656 |
| 3 | tool_call | `web.enter_field` | applied, `web.action.succeeded`, targets unchanged | 2 of 4 | none |
| 3 | tool_call | `web.enter_field` | applied, `web.action.succeeded`, targets unchanged | 3 of 4 | none |
| 3 | tool_call | `web.enter_field` | applied, `web.action.succeeded`, targets unchanged | 4 of 4 | none |
| 4 | complete | | | | 11679 / 367 / $0.0056232 |

Reading the trace:

- No row has `stoppedBy`.
- The four actions are ordered 1 to 4 under one iteration.
- Usage is attached once per decision. The four figures sum exactly to the
  build accounting: 41,689 in, 691 out and $0.01925528.

The Lab also reports `decisionCount` 4 and `toolCallCount` 7, and the old
bound would have refused 8 rows at 4 calls.

The first arm-16 run (`run-mubmxiyf-7e8f4056`) is superseded. The Lab refused
its proposal ("created evidence audit exceeded its bounded contract") and
recorded zero usage, as described in section 6.

### Tests (focused only; no full suites)

**Core, all 28 focused files in parallel (before the assertion fixes):** 17
failed and 332 passed.

**The same failing files, one at a time with `--no-file-parallelism`, after
the fixes:**

| File | Result | Time |
| --- | --- | --- |
| `service-bootstrap/tests/rejections.test.ts` | 16/16 | 23 s |
| `service-bootstrap/tests/plan-parameters.test.ts` | 9/9 | 18 s |
| `deepseek-bootstrap-exploration.test.ts` | 8/8 | 55 s |
| `service-bootstrap/tests/accounting.test.ts` | 8/8 | 33 s |
| `service-bootstrap/tests/adaptation.test.ts` | 9/9 | 20 s |
| `service-bootstrap/tests/permission.test.ts` | 10/10 | 20 s |

The first three hold the six deterministic failures. The last three had only
15 s timeouts. All are exit 0, so every earlier 15 s timeout was load, not
logic.

**Downstream:** `node --test` on the Lab-built `dist`, covering
`tests/commands`, `tests/cli-llm`, `tests/existing-fluxiq-control` and
`flow-lane/creation/tests/*`.

- Result: **tests 92, pass 91, fail 1**, with the new test passing.
- `existing-fluxiq-control.test.js` alone: 22/22.
- The one failure is `flow-lane/creation/tests/lane.test.ts:67`, **inherited
  from `dev`**. The test is unchanged on both branches, and
  `build-proposal.ts` already made the `get-flow-adaptation` call at base
  `d3ad8c5`.

### Checks and builds

- Core `pnpm check`: exit 0, before and after the test edits. The audit
  printed `passed (171 warning(s), 361 baselined)`.
- Core `pnpm build`: exit 0 (194 s). Web compiled; 16/16 static pages.
  - After that build only Core test files changed. Those are neither compiled
    into `dist` nor counted by the Lab's staleness scan.
- Downstream `pnpm check`: exit 0, before and after the reader change. The
  audit printed `passed (83 warning(s), 122 baselined)`.
- Downstream `pnpm build`: exit 0, 10 packages, before and after the reader
  change.

## Not verified

- A second 16-action run, or other seeds and tasks. One run showed one
  four-action decision; how often the model sends lists is not measured.
- Full suites, manual browser checks, and `pnpm structure:baseline`.
- The usage-on-failed-read fix (section 6), whose sites are not in files I
  own.

## Open questions or contradictions found

1. The hook denies `git merge` for workers. Record the t027 tips above as the
   second parents; the index already holds the resolved tree.
2. The Lab has no content-free way to show a successful build's per-decision
   actions. Success builds report `steps: null`, and Core's review projection
   carries only the audit counts. Here I read Core's stored trace from the
   isolated store while the run was still going. Recommended: t033's audit
   (`flow-bootstrap/evidence-trace.ts`) should add a content-free field such
   as the largest number of applied actions in one decision, so a campaign
   can judge this without store access.
3. `CORE_DEFAULT_ACTIONS_PER_DECISION = 1` mirrors a Core constant that is
   not public. Exporting
   `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_ACTIONS_PER_DECISION` on
   `fluxiq/automation-studio` would remove the last literal.
4. `lane.test.ts:67` is inherited from `dev` and belongs with the t027 gate
   triage. It will arrive when t033 re-merges `dev`.
5. t033's trace sanitiser (`evidenceTraceIdentifier`) accepts any trimmed
   string of up to 500 characters as a `resultCode`. That is looser than the
   code pattern the failure diagnostic uses. The loop only writes closed
   codes today, but this is worth tightening.
