# t787 fix 1: layers cleared during exploration become handlers

Worker report for brief `t787/fix1-layer-handlers`. Both trees are on branch
`task/t787-layer-handlers-and-toggle-proof`. No git command that mutates was run.

## Outcome

Done. When a press made during exploration clears a layer that covered the page,
the press now reports that (`evidence.layerCleared`). Core records it, and every
submitted Flow that has no step of its own for that press gets a handler in each
non-recovery part. The handler presses that control whenever it shows, checks the
control is gone, and carries on. The model writes nothing. The handler shape now
lives in one module, and the run-time learned handler (t516) uses it too.

Every new test failed before the change and passes after it. One deviation from
the brief's path list: I put the two new handler modules in a new directory,
`R/flow-bootstrap/layer-handlers/`, and not in `candidate/`. The reasons are
under "Open questions".

## What changed and why

### Domain (D = `fxwork/t787/!FluxIQWebExtension/domain/src/runtime/llm-evidence/node-run`)

- **New `press-effect/cleared-layer.ts`**, which exports `webPressClearedLayer`. A
  press reports `{ signature, control }` only when all of these hold:
  - the node is `web.output.dom-click` and the press does not move the page;
  - the looks before and after the press are of the same location;
  - before the press, a blocker (the view's `COVERING <layer> covers N`, N > 0)
    held the pressed control (the control is the layer, sits in its dialog, or
    passes `webInLayer`);
  - after the press, that layer covers 0 or is gone;
  - after the press, the pressed control is no longer shown (it is absent or
    `hidden`). This is the guard that lets a "control visible" condition mean
    "layer showing" without pressing a control that stays on screen a second time;
  - the layer was not opened by this build's own press (`run.layers.owns`, the
    same exclusion `answered-layer.ts` uses).

  `signature` holds the tag, role, kind and accessible name of the layer and of the
  control. It never holds a selector: the model sees the evidence, and `selector`
  is a denied evidence key. `control` is the handle the press used.
- **`outcome.ts`**: added `layerCleared?: WebPressClearedLayer` to
  `WebNodeRanOutcome`.
- **`press-effect/index.ts`**: added the export and the header line.
- **`run.ts`**: set `layerCleared` in both `present<WebNodeRanOutcome>` sites. The
  file stays at exactly 800 lines: I merged one comment and packed `read, addable`
  onto one line.
- **Tests:**
  - `press-effect/tests/cleared-layer.test.ts` (unit, 4 tests).
  - `tests/layer-cleared/tests/cleared-layer.test.ts` (2 tests through the real
    `createWebAutomationLlmEvidenceRuntime` with a fake gateway). It covers both
    cases: a press of a nameless panel's own control reports `layerCleared`, and a
    press that clears nothing does not.
  - The run test sits in a nested group because `node-run/tests/` was at its
    25-file limit. The structure audit failed with 26 files until I moved it.

### Core (R = `fxwork/t787/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`)

- **New `flow-bootstrap/explored-interruptions.ts`**: the class
  `AutomationStudioExploredInterruptions` and the type
  `AutomationStudioExploredInterruption`. It mirrors `explored-toggles.ts`. It keeps
  a `core.run_node` call only when all of these hold:
  - the call declared `consequences: []`;
  - the answer has `evidence.ok !== false`;
  - `layerCleared` has a non-empty signature object and a handle-shaped `control`;
  - `draft.ranWith.parameters` is a non-empty object.

  It keeps `{ callId, node, handles, parameters (domain-resolved, opaque), signature }`,
  bounded to 8 KB of JSON and 64 records.
- **New `flow-bootstrap/layer-handlers/patch.ts`**: `automationStudioLayerHandlerPatch`.
  This is the one handler shape, extracted from `interruption-handler.ts`: event
  `before`, `when` [shown], `completionCheck` [gone], one press step, `then: resume`,
  `consequences: []`. The scope and the shown/gone facts come from the caller.
- **`service/runtime-session/interruption-handler.ts`**: now builds its patch through
  `automationStudioLayerHandlerPatch` and produces the same output as before. Its
  existing test passes unchanged.
- **New `flow-bootstrap/layer-handlers/explored.ts`**:
  `automationStudioCandidateExploredLayerHandlers`. It lowers the patch into plan
  nodes, as in the table below.

  | Plan node | Contents |
  | --- | --- |
  | `layerN-s1` | `builtin.control.handler` with `{ event: "before", scope: { kind: "subflow", inherit: false }, when: [{ fact: "visible", op: "visible", target: <press parameters> }], order, completionCheck: [{ fact: "visible", op: "equals", value: false, target: <press parameters> }], maxRuns: 1 }` |
  | `layerN-s2` | The explored node with the domain-resolved parameters and `consequences: []` |
  | `layerN-s3` | `builtin.control.handler-end` with `resume` |

  Edges and their ports come from the registry. The press parameters serve as the
  fact target because a fact's resolved target is, by C9, the parameters a step
  with that target would run with; Core never reads inside them.

  The function also does the following:
  - It skips a press that a plan step already makes: the same node and either a
    `handleViews` handle the press named, or the same resolved `target` compared
    whole. This is the tie rule the toggles use.
  - It adds one handler to every non-recovery subflow. The scope is the part
    itself, with no inheritance, so a subflow brief's proposal carries the handler
    whichever part it builds. It skips a subflow that would exceed
    `maxNodesPerSubflow`.
  - It recomputes `metadata.requires` and validates the plan again. A plan that
    would fail validation keeps no handlers.
  - It returns `plan`, `risk` and laid-out `subflows` from that validation.
  - Labels are generic ("Something covered the page", "Close what covered the
    page"). Nothing names a site, a dock or likes.
- **`flow-bootstrap/candidate/submission.ts`**:
  - New input `exploredInterruptions`.
  - After the toggle step, a model's `submit` (`holdKept`) passes the build plan
    through the function above. A composed Flow keeps what its parts gave it.
  - Header paragraph added.
- **`flow-bootstrap/action-permissions.ts`**:
  - New input/output `exploredInterruptions`, shared when given, otherwise the
    wrapper keeps its own.
  - Both call sites record into it; an undo never does.
  - Header line added.
- **`flow-bootstrap/index.ts`**: exports `explored-interruptions.ts` and
  `layer-handlers/index.ts`.
- **`service.ts`**: one wiring line (candidate path, about line 1588).
- **`service/project-build/brief-ports.ts`**: one shared
  `new AutomationStudioExploredInterruptions()` per build, passed to every brief's
  gate and every submission, as `exploredToggles` is.
- **Test `flow-bootstrap/tests/explored-interruptions.test.ts`** (8 tests):
  - what the record keeps and refuses;
  - wiring through the permission wrapper;
  - a submission through the real `AutomationStudioFlowCandidateSubmissionController`
    gets the handler nodes, edges and requires, and passes `savedFlowValidation`;
  - no handler when nothing was explored, or when a step of the Flow already
    makes the press;
  - a run uses `normalizeAutomationStudioFlowBuildPlan` to produce the saved graph,
    then `runAutomationStudioGraph` with a fake host (fact evaluator and native
    node executor). On a page where the panel shows, it presses the panel control
    and then the covered step, with one `before`/`resume` handler execution. On a
    page without the panel it presses only the step. Without the record it fails at
    the covered step, as playback 0141 did.

## Commands run and observed results

1. **Fail-first, domain.** I replaced the `layerCleared:` producer in `run.ts` with
   `undefined`, then ran
   `DOMAIN_TEST_BUILD_LABEL=t787-fix1 node scripts/test-domain.mjs node-run/tests/cleared-layer`.
   Result: `not ok 1 - a press of the covering panel's own control …`,
   `# pass 1  # fail 1`. I then restored `run.ts`. The unit test could not exist
   before its module did.
2. **Fail-first, Core.** I passed `explored: []` in `submission.ts`, then ran
   `npx vitest run …/flow-bootstrap/tests/explored-interruptions.test.ts`.
   Result: `Tests 2 failed | 6 passed (8)`. The plan had only `n0`, and the run
   ended `failed` where `succeeded` was expected. I then restored
   `submission.ts`. A first attempt at this check passed by mistake, because it
   used `[] && …`; I redid it.
3. **Domain tests.**
   `DOMAIN_TEST_BUILD_LABEL=t787-fix1 node scripts/test-domain.mjs runtime/llm-evidence`
   gave `# tests 1325 # pass 1325 # fail 0`. I ran the script directly, not through
   `pnpm --filter … test`, so the core-build gate was skipped. That run used the
   earlier location of the run test; after moving it I ran
   `… test-domain.mjs layer-cleared press-effect/tests/cleared-layer`, which gave
   `# tests 6 # pass 6 # fail 0`.
4. **Domain typecheck.** `npx tsc -p tsconfig.json --noEmit` exited 0, and
   `npx tsc -p tsconfig.test.json --noEmit` exited 0. I ran tsc directly, not
   `pnpm check`, which runs the core-build gate first.
5. **Core typecheck.** `pnpm check` (from `C/packages/fluxiq`), after the final
   file layout, gave `{"build-cache":"build","step":"fluxiq:check",…}` and exit 0.
6. **Core tests.** `pnpm test` over `…/flow-bootstrap/tests`,
   `…/flow-bootstrap/candidate/tests`, `…/flow-bootstrap/subflow-candidate/tests`,
   `…/service/runtime-session/tests` and `…/service/project-build/tests`, after the
   final layout:
   - group 1: `Test Files 112 passed (112) / Tests 800 passed (800)`;
   - group 2: `Test Files 7 passed (7) / Tests 35 passed (35)`;
   - exit 0;
   - the run included `explored-interruptions.test.ts` (8), `interruption-handler.test.ts`
     (3), `interruption-learning.test.ts` (8), `explored-toggles.test.ts` (7), both
     submission-toggles files and `project-build-shared-toggles.test.ts`.
7. **Extension structure audit.** `node scripts/structure-audit.mjs` (from D)
   ended `structure-audit: passed (232 warning(s), 616 baselined)`. The warnings
   on my files are `press-effect/` at 17 source files (advisory 15; it was already
   at 16) and `run.ts` at 800 lines (advisory).
8. **Core structure audit.** `pnpm structure:check` (from C) ended
   `structure-audit: 4 violation(s)`. None is in a file of mine:
   - `candidate/tests/` has 26 files: the untracked
     `trial-gate-contradicted.test.ts` is another worker's;
   - `subflow-candidate/tests/` has 26 files: the untracked
     `subflow-trial-contradicted.test.ts` is another worker's;
   - `candidate/trial-gate.ts` is 804 lines;
   - `subflow-candidate/subflow-trial-gate.ts` is 805 lines.

   Earlier runs had flagged my own violations; each is now cleared:
   - `candidate/` reached 27 files;
   - a `candidate/layer-handlers/` subdirectory broke the 9-segment depth limit;
   - the test imported past the executor barrel.

## Not verified

- **No live or Lab run.** The real dock's packet was not replayed through
  `webPressClearedLayer`. From 0045 and 0047 the cover reads `t573 covers 14`
  before the press and bare `t573` after it, and the pressed control `t584` is
  absent after it. That fits the rule, but the capture's real `blockedBy`,
  `coversCount` and `parent` fields for `t584` were not read.
- **Own-layer exclusion may hide the dock.** Own-layer memory counts an unmarked
  layer that opens on a timer just after a press as that press's own. If the dock
  ever came out that way, its press would report no `layerCleared`, the same blind
  spot as the existing `interruption` flag. In this run `t573` first appears bare
  after 0015 (a navigating press, which is not recorded as own) and covers 12 after
  0023. I believe it is not own here, but I did not check that against the build
  state.
- **Real fact evaluation not exercised.** The extension's page-side evaluation of
  `{ fact: "visible", target: <resolved click parameters> }` was not run. Only the
  domain grammar was read: `query.ts` reads `selector` and `element` off the
  target, and `visible` + `equals false` asks "not shown".
- **Subflow-brief proposals not traced.** I did not trace the handler through a
  real project-build subflow brief, a supervisor composition, or a trial/promotion,
  beyond the suites above passing.
- **Docs not edited, per the brief.** These places now describe less than the code
  does; no sentence was found false:
  - Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`, the
    "Idempotent toggles" bullet list (about line 247), needs a sibling bullet for
    layers cleared during exploration.
  - Core `docs/architecture/automation-studio.md`, the "A closed layer becomes a
    handler of the Flow (t516)" section (about lines 1446-1480), still correctly
    names `interruption-handler.ts`, but the shape now lives in
    `flow-bootstrap/layer-handlers/patch.ts`.
  - Extension `docs/architecture/web-capabilities.md`, the press-answer bullets
    (about line 610, "A press of a toggle can answer `toggle`"), needs a
    `layerCleared` bullet.

## Open questions or contradictions found

- **New directory outside the owned list.** I created
  `R/flow-bootstrap/layer-handlers/` (`index.ts`, `patch.ts`, `explored.ts`). Each
  alternative failed a structure rule or the dependency direction:
  - `candidate/` already held 25 source files, the hard limit, and both new modules
    there made 27, which the audit failed.
  - A `candidate/layer-handlers/` subdirectory breaks the 9-segment depth rule.
  - `service/runtime-session/`, which the brief offered, cannot be imported by
    `flow-bootstrap` without an upward dependency or reaching past a barrel.

  The new directory touches no other worker's file and sits behind the
  flow-bootstrap barrel that both `candidate/submission.ts` and
  `interruption-handler.ts` import. If you want it elsewhere, it is a pure move.
- **Possible t775 defect (toggle worker).** `submission.ts` writes the toggles'
  `ensureState` only into `buildPlan.plan`, but
  `normalizeAutomationStudioFlowBuildPlan` builds the saved graph from
  `buildPlan.subflows`, the laid-out copy. That copy is not regenerated, so
  `ensureState` may never reach the saved Flow. I did not verify that a later step
  rebuilds `subflows`. My function validates the plan again and returns fresh
  `subflows`, so when a handler is added, the toggles' changes reach the saved
  graph as a side effect. When no handler is added, the behaviour is unchanged.
  This is worth a look by the worker who owns toggles.
- **Behaviour choices for review:**
  - The handler goes into every non-recovery part with `inherit: false`, and not
    only the part that met the layer. Core has no reliable tie from a press to a
    part, and a subflow brief's proposal keeps only its target part.
  - An unchanged script text resubmitted after a new layer was cleared gets no new
    handler. The existing "same text" shortcut runs before the completion check.
