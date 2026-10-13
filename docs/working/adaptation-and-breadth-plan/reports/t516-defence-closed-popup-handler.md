# t516 defence-closed-popup-handler: worker report

## Outcome

**Done, but the live proof is missing.** All four goals are built or settled, and the unit tests, typechecks and
both structure audits pass. The live part is not proven: the one Lab run I made never met the wheel. It failed earlier,
on a recorded step (see Not verified).

This report covers two passes:

- **Pass 1** did Goal 1 (the close record names the layer and the control). It also root-caused Goal 3.
- **Pass 2** is the supervisor's continuation. It built Goal 2 as designed: an `add_handler` with event `before`,
  `when` dialog visible `<name>`, a press of the way out's handle, then `resume`, with no leading wait (supervisor
  decision). It also updated Core's architecture doc.

| Goal | Outcome |
| --- | --- |
| 1. The step result records the close (layer kind, layer name, pressed control's name) | Done (pass 1) |
| 2. Core turns a recorded close into a guarded handler, with no model, through validate, apply and persist | Done (pass 2). Live run not shown. |
| 3. False robot check | No classifier defect. The store serves a real self-clearing check before the first results page of every fresh session. Regression rows added. |
| 4. Fail-first tests with generic fixtures | Done. Each new test was seen failing before its fix. |

## What changed and why

### Goal 1 (pass 1): the close record names the layer and the control

- **Extension, `interference/press-ways-out.ts`.** Each cleared layer now also records:
  - `name`: the layer's accessible name. This is the same name `evidence/dialogs.ts` labels the dialog with, and the
    same one a `dialog` fact's `nameContains` matches.
  - `controlName`: the pressed control's accessible name.
- **Domain, `actions/cleared-layers.ts`.** The two new fields are kept with whitespace collapsed and cut at
  `WEB_AUTOMATION_CLEARED_NAME_MAX` (120).
- **Domain, `io/gateway-output-dispatcher.ts`.** It lifts both names to Core.
- **Core, `executor/node-execution/cleared-layers.ts`.** Core keeps both names on the attempt trace, held to the
  activity bound at 120 characters.
- **Core, new `executor/node-execution/cleared-layer.ts`.** It holds the cleared-layer types. They moved out of
  `contracts.ts` so that file stays under 800 lines. `contracts.ts` re-exports them through the barrel.

### Goal 2 (pass 2): a defence close becomes a guarded handler, with no model call

**Domain, `io/gateway-output-dispatcher.ts`.**

- Every lifted layer that has a `wayOut` now also carries `wayOutDefinitionId`. Its value is
  `webAutomationOutputNodeId("web.dom.click")`, which is `web.output.dom-click`.
- Why: Core must name the definition of the step that presses the way out. The structure audit's web-vocabulary rule
  keeps web words out of Core, so the domain supplies the identifier.
- This is one domain file beyond the Core files the continuation listed. It is the file Goal 1 already owned.

**Core executor.**

- `node-execution/cleared-layer.ts` and `cleared-layers.ts`: the new `wayOutDefinitionId` field. It is kept only as an
  identifier, and only beside a `wayOut`.
- `lifecycle-run/incident-repair.ts` (and its barrel): new types `AutomationStudioInterruptionLearningRequest`
  (graph, subflowId, framePath, the succeeded attempt, the layer) and `AutomationStudioInterruptionLearningCallback`.
  The callback answers with the existing `AutomationStudioIncidentRepair`: an overlay, or `none`.
- `contracts.ts`: a new optional `learnInterruption` on the graph execution options.
- `step-loop/incident-repair.ts`: new `automationStudioStepLearnInterruption`, which runs on a verified success.
  - It handles each cleared layer that has a `name`, a `wayOut` and a `wayOutDefinitionId`.
  - It asks once per (frame graph, step, name) in a run. It never asks inside a handler body, or once the run is
    cancelled or paused.
  - On an overlay it swaps the frame's graph, using the same `swapGraph` a repair uses. It records a `held` run repair,
    stamps the step's attempt with `repair`, and posts a "Learning an interruption" activity thought.
  - Because the repair is held, the run lists its id in `trace.repairs`. The judged end reads that list
    (`automationStudioRunInRunRepairAdaptationIds`) to treat the fix as one the run ran, and settles it.
  - On `none`, or a throw, it changes nothing, and records only that the step and name will not be asked about
    again.
- `graph-run.ts`: calls the step above just before `automationStudioStepBeforeNext`, on a verified `success`.

**Core run session (`service/runtime-session/`).**

- `interruption-handler.ts` (new, pure) proposes the patch:

  ```text
  { kind: "add_handler", event: "before", scope: { kind: "nodes", nodeIds: [step] },
    when: [{ fact: "dialog", op: "visible", value: name }],
    completionCheck: [{ fact: "dialog", op: "absent", value: name }],
    steps: [{ definitionId: wayOutDefinitionId, label: "Close \"<name>\"", parameters: { target: { handle } } }],
    then: { kind: "resume" }, consequences: [], metadata: { learnedFrom: "defence_close", layerKind } }
  ```

  It proposes nothing when the layer has no name or no way-out definition. It also proposes nothing when a Handler
  node in scope already waits for a dialog fact with that name.
- `interruption-learning.ts` (new) supplies the callback. It never calls a model:
  1. It asks the domain to name the way out by a handle (`clearedControlHandles`).
  2. It proposes the patch.
  3. It resolves the press through `resolveAutomationStudioFlowBootstrapPlanParameters`, with `handleReach:
     "view_history"`, as a build's step is resolved. What is saved is the domain's resolution, never the handle.
  4. It runs `prepareAutomationStudioInRunRepair`, the in-run repair's own preflight, overlay and adaptation. It
     passes `sideEffectPermission: "permitted"`, because the handler declares no consequences. This is the same answer
     the in-run repair's `permissionFor` gives for a declared-none patch.
  5. It records the fix through the shared recorder: review record, adaptation, then the promotion gate.
  6. It writes to the ledger:
     - a receipt (`learnedFrom: "defence_close"`) and the kept overlay;
     - a recovery record carrying a `diagnosis` intervention and a `runtime_patch` intervention, both with
       `validation.ok: true`, both `deterministic`, neither naming a provider;
     - a `runtimePatchAttempts` entry (`add_handler`, `preflightOk: true`, `inRun: true`, `traceStatus: "held"`, plus
       the adaptation id).

  A refusal records a receipt with a code: `way_out_unnamed`, `already_handled`, `step_unresolved`, a preflight code,
  or `unrecorded`.
- `in-run-repair-fix-record.ts` (new) holds `recordFix`, moved out of `in-run-repair.ts` so the repair and the
  learning path share one recorder.
- `in-run-repair.ts`: the binder now also supplies `learnInterruption`. It does so for any run that keeps adaptations,
  is not a dry run, and is not a diagnose-only or propose-only lane, even when the context invokes no model.
  `repairIncident` still needs `invokeLlm`. The header comment says this.
- `index.ts`: exports the three new modules.

**Core docs, `docs/architecture/automation-studio.md`** (the cleared-layers paragraph near line 1238).

- A table of all six fields: `kind`, `control`, `name`, `controlName`, `wayOut`, `wayOutDefinitionId`.
- A new section, "A closed layer becomes a handler of the Flow (t516)", covering the trigger, the proposal, the
  resolution, the no-wait decision, the judged-end settle, and what the run detail carries.

### What the gate can now read, for a run whose context keeps adaptations

| Gate check | What the run produces |
| --- | --- |
| **P2** | `harnessRecovery.attempted` is true, because interventions, patch attempts and adaptation ids are now non-empty. There is a `diagnosis` intervention. |
| **P3** | A `runtime_patch` intervention with `validationOk: true`, and a patch attempt with `preflightOk: true`. The run carries on from the same step, since it had already succeeded. |
| **P4** | The adaptation sits in the run's `adaptationIds`. It is held for the judged end, and the repair is listed in `trace.repairs`. When the run is judged to answer, the judged end applies it, with the judged run recorded as its trial (`awaitsJudgedRun`). The Lab's repair lane can also approve and apply it. Applying adds Handler nodes, so the Flow's steps hash changes. |

### Goal 3 (pass 1): root cause of the "robot check" card

There is no false detection.

- `everything-store/route.ts:49` serves `renderSoftCheck` while `guard.softCheck === "pending"`.
- That page shows "We're checking that your browser is set up to shop securely" with a disabled "Checking your
  browser…" button, and passes by itself at 8 s.
- `set-mode` recreates the store state, so every armed run meets the check again.

I added regression rows to `action-runtime/tests/challenge-evidence.test.ts` using the fixture's markup:

- the results page, with the wheel, the notifications prompt and the cookie banner up, is not a check;
- the wheel and the prompt, read as layers, are not checks;
- the store's real robot check is still `person_only` / `captcha`.

## Commands run and observed results

### Fail-first, pass 2

| Test | Observed before the fix |
| --- | --- |
| Domain `io/tests/gateway-output-dispatcher-cleared-layers` (`DOMAIN_TEST_BUILD_LABEL=t516 node scripts/test-domain.mjs ...`) | `not ok 6 - a layer closed by a way out names the node definition...`, `expected: 'web.output.dom-click'`, `# pass 5 # fail 1` |
| Core `runtime-session/tests/interruption-handler.test.ts` and `interruption-learning.test.ts` (`npx vitest run ...`) | The handler file failed to import (module missing). Learning: `2 failed | 1 passed (3)` |
| Core `step-loop/tests/learned-interruption.test.ts` and the `cleared-layers` `wayOutDefinitionId` row | `Tests 4 failed | 34 passed (38)` |

The executor rows were written before the source. But I first ran them after the source, so I made the before-state
by hand to see them fail: I disabled the `graph-run.ts` call and the definition keep, and copied both files back
afterwards. The fourth executor test, "asks nothing ...", passes either way, as it should.

**Fail-first, pass 1:** extension `# pass 9 # fail 1`; domain build error (no export `WEB_AUTOMATION_CLEARED_NAME_MAX`);
Core `1 failed | 32 passed`.

### An existing test whose behaviour changes on purpose

`runtime-session/tests/in-run-repair.test.ts`, "is not supplied at all ...". Before, `invokeLlm: false` meant no
binding at all. Now that run gets `learnInterruption` and no `repairIncident`, and `createAdaptations: false` still
binds nothing. The test now asserts exactly that.

### Final checks (all after the last source edit)

| Check | Command | Result |
| --- | --- | --- |
| Core tests | `npx vitest run src/.../runtime/executor/ src/.../runtime/service/runtime-session/ src/.../runtime/service/runtime-adaptation/ src/.../runtime/tests/in-run-repair/` | `Test Files 132 passed (132)`, `Tests 1176 passed (1176)` |
| Related Core suites, earlier in pass 2 | The above plus `service/summaries/` and `recovery/in-run-repair/` | `132 passed`, `1173 passed` |
| Core typecheck | `pnpm run check` (Core `packages/fluxiq`) | exit 0 |
| Core audit | `node scripts/structure-audit.mjs` (Core) | exit 0 |
| Domain tests | `DOMAIN_TEST_BUILD_LABEL=t516 node scripts/test-domain.mjs src/actions/tests/ src/io/tests/ src/client/tests/gateway-mapping` | `# tests 92 # pass 92 # fail 0` |
| Domain typecheck | `pnpm run check` (domain) | exit 0. Core's build is current. |
| Extension typecheck | `pnpm run check` (extension) | exit 0 |
| Downstream audit | `node scripts/structure-audit.mjs` (downstream) | exit 0 |
| Core library build | `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` | Done |

The Core audit's first run in pass 2 failed `statement-packing` on one line of the new executor test. I fixed it.

### Lab run

Command: `FLUXIQ_TEST_ENV_FILES=none pnpm lab run everything-store --workflow first-page-earbuds --variant deal-wheel
--flow`, run in the t516 tree.

- **Result:** exit 1, verdict `failed`, run `run-mv6y2t42-222ea4f9` in `test-runs/`.
- **What happened:**
  - The search submit click took 9241 ms, which is the soft check being waited out.
  - The recorded next step, `wait_for_selector [data-testid="soft-check"] > button`, then timed out four times
    (`web.action.timeout`). The check had already cleared during that 9 s wait, so the button was gone.
  - No step met the wheel. `grep` finds no `clearedLayers` and no "Spin to win" anywhere in the bundle.
- **No adaptations in this run either:** `harnessRecovery.refusalCode` is `llm.gate.training_mode`.
- **Conclusion:** this run cannot show the close or the handler. It is neither evidence for nor against Goal 2.

## Not verified

- **Live: the close recorded with names and the handler proposed.** The model-free Lab run failed before any step met
  the wheel. Its training mode also keeps no adaptations, so it would not learn even if it had met the wheel.
  - A gate-style run is needed: `--llm-task create-flow --replays 1` on `persistent-isolated`, paid.
  - In such a run, P2-P4 should show the `diagnosis` and `runtime_patch` interventions, the `add_handler` patch
    attempt, and the adaptation id.
- **An end-to-end Core service proof** through `AutomationStudioService` was not written. The judged end applying the
  learned handler is shown only by parts:
  - the executor test: the repair id is in `trace.repairs`;
  - the session test: the adaptation is saved with `approvalDecision.applyAt: "judged_whole_run"`;
  - the existing judged-promotion code path.
- **Real domain resolution.** The domain's `view_history` resolution of a cleared-control handle in a playback run
  (not a build) is untested here. The session test fakes `clearedControlHandles` and `resolvePlanNodeParameters`.
- **Full suites** were not run, per the twice-a-day rule.

## Open questions or contradictions found

1. **The model-free deal-wheel Lab run cannot reach the wheel.** The recorded `first-page-earbuds` workflow waits for
   the soft check's button after a search whose click already waited the check out. This mismatch between the
   recording and the store existed before t516, and t516 does not change it. It is a separate defect, in the
   recording-to-Flow mapping or in the landed-check wait, and needs its own brief.
2. **Learning now binds for model-free adapting runs.** `bindAutomationStudioInRunRepair` gives a ledger and
   `learnInterruption` to any run that keeps adaptations, including one whose context invokes no model. The supervisor
   should confirm that unattended learning there is wanted. It follows the user's "interruptions become branches"
   rule, and the judged end still gates the apply.
3. **The ledger keeps only the last recovery's gate.** The run detail's `llmGate` and `recoveryTrace` come from the
   last recovery record. A learned handler recorded after a model repair in the same run would hide that repair's
   gate fields. Interventions, adaptations and patch attempts all still accumulate. This is low impact and is not
   fixed.
4. **The domain now names its click definition for Core** (`wayOutDefinitionId`). A different domain would need to
   supply its own pressing definition.
