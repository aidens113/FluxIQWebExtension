# t188-A2: remaining Flow-size readers use the Flow size setting (Core)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t188/!FluxIQ`, branch `task/t188-node-limits`.
P = `packages/fluxiq/src/programs/automation-studio`.

## Outcome

Done. All five named readers now take their bound from the Flow size setting, with no fixed node count left. The repair-context graph window stays a fixed prompt window, but it now sits around the failing node. The tests I added pass. Package tsc: see "Commands run".

## What changed and why

### 1. Flow-bootstrap record readers: bounded at the setting's largest value

None of these readers has a Flow in hand, and none of their callers has one either (the list is below). Each bound is now
`automationStudioFlowBootstrapLargestSizeLimits().maxTotalNodes + AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxIterations + 1`,
which is 8000 + 64 + 1 = 8065. I added no optional size argument, because no caller could pass one. A record written while a Flow's setting was higher must still read after the setting is lowered. The build's own validation refuses anything the current setting does not allow. A comment at each bound says this.

- `P/runtime/flow-bootstrap/evidence-loop-steps.ts`: `MAX_REPRESENTED_DRAFT_STEPS` (was 64+64+1=129). It now imports `automationStudioFlowBootstrapLargestSizeLimits` from `./plan/index.ts` instead of `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS`.
- `P/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`: `EVIDENCE_LOOP_MAX_DRAFT_STEPS` (was 129). It bounds `exhausted.draftSteps` and `incompleteDraft.steps`.
- `P/runtime/flow-bootstrap/incomplete-draft/parse.ts`: `MAX_STEPS` (was 256). The stale "a Flow is at most 64 nodes" comment is rewritten. It now imports loop-limits and plan.

Callers, with no Flow in hand in any of them:
- `evidenceStepDraftChange` / `evidenceStepDraft`: `evidence-loop-steps.ts:220-221` (trace rows into steps), `evidence-loop-steps.ts:337-339` (stored-step parser), and `runtime/service/flow-bootstrap-commands/evidence-trace.ts:120,122` (service trace sanitizer; not edited).
- `automationStudioFlowBootstrapEvidenceSteps`: `generation-failure/evidence-failure.ts:181` and `runtime/service/flow-bootstrap-commands/evidence-trace.ts:224`.
- `parseAutomationStudioFlowBootstrapEvidenceSteps`: `generation-failure/diagnostic-parse.ts:267`.
- `parseAutomationStudioFlowBootstrapFailureDiagnostic` (reaches `parseEvidenceLoopExhausted` and `parseIncompleteDraftPointer`): `generation-failure/error.ts:45`. That in turn is called from `api/handlers/llm-generation.ts:147`, `runtime/service.ts:1710` and `generation-failure/phase-failure.ts:113`.
- `parseAutomationStudioFlowBootstrapIncompleteDraft`: `runtime/service/incomplete-drafts.ts:30` (has only `{projectId, flowId}`).

### 2. `DETERMINISTIC_PATH_MAX_NODES = 16` removed

`P/model/validation/adaptation.ts`:
- `parseAutomationStudioDeterministicPath(value, maxNodes = AUTOMATION_STUDIO_FLOW_SIZE_SETTING.defaultValue)`. A path inserts into one Subflow, so its bound is `maxNodesPerSubflow`.
- `validateAutomationStudioFlowAdaptation(adaptation, maxNodesPerSubflow = defaultValue)` passes the bound through to the parser (`:161`). This is fresh validation, so it gets the setting's default unless a caller passes the Flow's own setting.
- The value is imported from `../flow-size/index.ts` directly, not from the `../index.ts` barrel, which the file uses for types only.

What each caller gets:
- `storage/project/adaptation-store.ts:520` (`deterministicPathOperations`, the apply of a stored adaptation) gets **`AUTOMATION_STUDIO_FLOW_SIZE_SETTING.maximum`**. The adaptation is read back with no Flow in hand; the graph repository gives nodes, not Flow metadata. A path already approved must not be stranded by a later, lower setting. This is the only line I changed in that file, plus the import.
- `model/validation/adaptation.ts:161` gets whatever the caller of `validateAutomationStudioFlowAdaptation` passed, and the **default (100)** otherwise.
- `runtime/service.ts:3461` (`saveFlowAdaptation`) gets the **default (100)**. Not edited, out of ownership. **It should pass the Flow's setting**: `automationStudioFlowMaxNodesPerSubflow(flow.metadata)` for `adaptation.flowId`.
- `storage/project/adaptation-store.ts:64` (`putAdaptation`) gets the **default (100)**. Not edited; the brief limited me to `:516`. **It should pass the same value**, either as a new optional `maxNodesPerSubflow` on `putAdaptation`'s input, filled by service.ts, or `maximum`, since service.ts already validated. Until then, a Flow whose setting is above 100 has paths longer than 100 refused at record time. That is still strictly looser than the old fixed 16, so nothing regresses.

### 3. Caps checked: keep or scale

| Cap | Bounds | Verdict |
| --- | --- | --- |
| `flow-bootstrap/answerability/check.ts:40` `MAX_FEEDBACK_STEPS = 24` | Steps named in the cannot-answer feedback; says `stepsWithheld: true` when cut | Keep. Its comment, "A plan holds at most sixteen per subflow", is stale; fix the wording only. |
| `flow-bootstrap/reachability/check.ts:43` `MAX_FEEDBACK_STEPS = 24` | Same feedback listing, with `stepsWithheld` | Keep. Now owned by lane t190; not edited. |
| `flow-bootstrap/instructed-acts/check.ts:35` `MAX_LISTED_STEPS = 32` | `missingActs.stepsThatChangedSomething`, a prompt listing. The verdict itself is computed over every kept step. | Keep the bound. It truncates **silently**, though: with more than 32 kept steps, the model is not told that later steps exist. Fix (lane t190, `:97`): add `...(kept.length > MAX_LISTED_STEPS ? { stepsWithheld: true } : {})`, as answerability does. |
| `evidence-loop-steps.ts:195` `MAX_EVIDENCE_STEP_AMENDMENT_REFUSALS = 16` | Refusals per decision (= amendments per decision) | Keep; not a Flow size. |
| `evidence-loop-steps.ts:373` `MAX_DRAFT_CHANGE_TARGETS = 16` | Step ids targeted by one decision | Keep; not a Flow size. |
| `recovery/repair-context/flow-graph.ts:35` `maxNodes: 24` (and `maxEdges: 32`) | A prompt window inside the recovery context byte budget (`recovery/context.ts:243-251`: 8 KB default, 16 KB max) | **Kept at 24, but the window now moves to the failing node.** Scaling it with the setting would spend the whole repair budget on node names. Before this change, the window was always the first 24 nodes, so a failure at node 30 of the repaired Subflow was invisible to its own repair. Now, when the failing node falls outside the first window, the window is centred on it and clamped inside the Flow. The section then says `firstNodePosition` (1-based), and edges touching shown nodes are listed first. With no failing node, or one inside the first 24, the output is unchanged. |
| `recovery/repair-context/step-parameters.ts:31` `MAX_STEPS = 12` | The run's most recent action attempts, newest last | Keep; this is a run's recent steps, not the Flow. |
| `result-verification/verdict.ts:46` `MAX_OBSERVED_STEPS = 12` | A one-line human observation; says "and N more" | Keep. |
| `llm/harness/structured-response.ts:176` `AUTOMATION_STUDIO_RUNTIME_PATCH_MAX_STEPS = 8` | Steps one runtime repair patch may insert ("a missing step or two, never a second Flow") | Keep; it bounds a repair, not a Flow. Note that it does not check the Subflow's remaining room under the setting, which may need a check elsewhere. |
| `llm/node-tools/run-node.ts:44` `MAX_ENUMERATED_NODES = 400` | Library node definition ids the tool enumerates, not Flow nodes | Keep. |

### 4. Tests

- `P/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts`:
  - The old boundary cases hardcoded 129/130; they now use the derived `MAX_REPRESENTED`.
  - Added `it.each([100, 150])` for a draft that is published, sanitized and parsed back.
- `P/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`:
  - Added an exhaustion plus kept-draft pointer at 100 and 150 steps that reads back.
  - Added a case above the maximum that is refused.
  - Updated the existing `unlisted: maxIterations * 2` out-of-bounds case, which was only out of bounds under the old 129. It now uses the derived maximum.
- `P/runtime/flow-bootstrap/incomplete-draft/tests/incomplete-draft.test.ts`: kept drafts of 100 and 150 steps read back; one longer than any Flow is refused.
- New `P/model/validation/tests/adaptation.test.ts`:
  - The path parser takes 100 at the default and refuses 101.
  - With `maxNodes` 150 it takes 150 and refuses 151.
  - At the maximum it takes 1000 and refuses 1001.
  - An empty path is still refused.
  - `validateAutomationStudioFlowAdaptation` takes 100 and refuses 101 at the default, and takes 150 and refuses 151 when passed 150.
- `P/runtime/recovery/repair-context/tests/flow-graph.test.ts`:
  - A 150-node Subflow failing at n.30 shows n.29 to n.31, its edges, `firstNodePosition` and `nodeCount`.
  - A failure at the last node keeps the window inside the Flow.
  - A failure inside the first window leaves the output unchanged.

## Commands run and observed results

All from `packages/fluxiq`. `--maxWorkers=2` alone errors in this vitest (2.1.9): "RangeError: options.minThreads and options.maxThreads must not conflict". So I ran every command with `--maxWorkers=2 --minWorkers=1`.

- `npx vitest run src/programs/automation-studio/runtime/recovery/repair-context src/programs/automation-studio/model/validation src/programs/automation-studio/model/tests/flow-adaptation.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests src/programs/automation-studio/runtime/flow-bootstrap/generation-failure src/programs/automation-studio/runtime/flow-bootstrap/incomplete-draft src/programs/automation-studio/storage/project/tests/adaptation-store.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands --maxWorkers=2 --minWorkers=1`
  - Result: "Test Files 1 failed | 21 passed (22); Tests 4 failed | 563 passed (567)".
  - All four failures are in `runtime/flow-bootstrap/tests/plan.test.ts`, which tests the plan module the parallel worker is editing (`plan/limits.ts`, `output-schema.ts`, `validation.ts` and others are modified in the tree). The failing assertions:
    - `maxItems: 64`
    - `expected 5117 to be 5118`
    - `graph_too_deep`
    - a structural count/byte ceiling
  - None of these touch files I changed.
- Package tsc (`npx tsc --noEmit`, run in build slot b2, owner file written; `build-slots/` was empty afterwards):
  - Exit 2 with 3 errors. **None are in files I changed:**
    - `runtime/flow-bootstrap/tests/plan.test.ts(404,74)`: `maxGraphDepth` does not exist on `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS`.
    - `runtime/flow-bootstrap/tests/plan.test.ts(423,95)`: `maxPlanBytes` does not exist on the same object.
    - `runtime/service/flow-settings/tests/flow-size-settings.test.ts(13,3)`: TS2375 under `exactOptionalPropertyTypes`.
  - The first two are the parallel worker's in-flight removal of the node fields from `plan/limits.ts`. The third is in another lane's new test.

## Not verified

- No Lab or browser runs (the brief forbids them).
- The full package test suite was not run.
- `runtime/service` tests beyond `flow-bootstrap-commands` were not run, including `runtime/tests/service-adaptation`, which exercises adaptation save and apply.

## Open questions or contradictions found

- The `runtime/service.ts:3461` and `storage/project/adaptation-store.ts:64` recording path still validates deterministic paths at the default of 100, whatever the Flow's setting (see section 2). It needs plumbing through files I do not own.
- The brief expected `answerability/check.ts:40` and `reachability/check.ts:43` might need scaling. They say `stepsWithheld` when they cut, so they are kept. `instructed-acts/check.ts:97` truncates silently and needs a `stepsWithheld` flag (lane t190).
- The brief's vitest command form (`--maxWorkers=2` alone) fails in this vitest version without `--minWorkers=1`.
