# t395 - Core Flow editor views for handlers, entries and checkpoints (B7 / R5b)

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t395/!FluxIQ`, branch `task/t395-editor-handler-views`.
Only Core `apps/web` was edited. Nothing was committed.

## Outcome

Done, all five items. Two limits come from data the editor is not given, not from the views themselves:
the Inspector gets only the selected part's saved graph, and saved graphs carry no step labels (see Open questions).

| Item | State | Where |
| --- | --- | --- |
| 1. Handlers area apart from the main path, a card per Handler | Done | `flow-editor/components/FlowHandlerArea.tsx`, `FlowHandlerNode.tsx`; layout `graph/handlers/area-layout.ts` |
| 2. Hook ports on steps a node-scoped Handler covers | Done | `flow-editor/components/FlowNodeHandlerBadges.tsx`, `graph/handlers/canvas-view.ts` |
| 3. Default start, alternative starts (with condition), checkpoints | Done | same badges; `graph/handlers/state-markers.ts`; start fix in `flow-editor/model/flow-graph.ts` |
| 4. Inspector "Effective handlers" in C4 order with links | Done (this part only unless the host passes more) | `inspector/effective-handlers.ts`, `inspector/EffectiveHandlersSection.tsx`, `graph/node-focus.ts` |
| 5. Pure, tested web-side mirror of the Core resolver | Done | `graph/handlers/` (registrations, effective-handlers, fact-conditions, state-markers) |

## What changed and why

All paths below are under `apps/web/src/features/automation-studio/`.

**Pure model, `graph/handlers/` (new).** The `lifecycle` module is not on any public `fluxiq` entry point. I checked
`packages/fluxiq/package.json` exports and the `automation-studio` and `nodes` barrels. So, following the validator's
precedent, the editor carries a small mirror. Each file names its Core source in its header comment.
- `registrations.ts` mirrors `runtime/executor/lifecycle/graph-registrations.ts`. It reads three kinds of registration,
  in Core's document order: Handler nodes; each node's own failure route (a `failed` edge, an `error.<id>` port, or an
  optional step's way on, at `order = MAX_SAFE_INTEGER`, mirroring `step-skip/optional-step.ts` and
  `graph-navigation.ts`); and implicit `clearsInterference` retry registrations. `flowHandlerBodies` also returns every
  Handler's body up to its Handler Ends, even when Core could not read that Handler.
- `effective-handlers.ts` mirrors `scope-resolver.ts`, read statically. The current graph stands for the running
  frame. The graphs of parts that call it, nearest first, stand for ancestor frames, and count only when they
  `inherit`. The recovery part supplies whole-automation handlers. Order is node, then this part, then calling parts,
  then the whole automation. Within a level the order is ascending `order`, then distance, then document order, then
  id, all grouped by event in C3 order. A node never resolves its own interference registration. A Handler and its body
  steps resolve to nothing, because C5 allows no nesting.
- `fact-conditions.ts` mirrors `fact-conditions-parse.ts`. `state-markers.ts` mirrors `subflow-contract.ts` for entries
  and checkpoints, and `start-node.ts` for the default start, with Handlers and their bodies excluded.
- `plain-words.ts` holds the visible wording, with no codes. Events: "When a part starts", "Before a step", "Before
  trying again", "When a step fails", "After a step succeeds". Scope: "Whole automation", "This part", "Step "X"", or
  "One step" when the step has no name. Then: "Carry on", "Go back to "<checkpoint>"", "Use other results", "Give up".
  Conditions are written as sentences, for example: the "Session expiring" dialog is showing; what "Open the list" acts
  on is there; something on the page is gone. A target's evidence handle is never shown.
- `canvas-view.ts` collects, per graph: which nodes are in the Handlers area, the Handler cards, the hook ports and the
  markers. `area-layout.ts` moves Handlers and their bodies into a band below the main path, one Handler per row, but
  only when they overlap the main path. Core's depth layout puts them among the first columns, which the worked
  examples confirm. `vocabulary.ts` holds the ids and keys, which `graph-validation.ts` now imports instead of keeping
  private copies.

**Canvas.**
- `useFlowEditorGraphDocument` builds `flowHandlerView` from the editor draft. During a drag that moves positions only,
  it reuses the cached view.
- The display copy of a Handler node gets `type: "handlerRegistration"`, rendered by `FlowHandlerNode`. Body steps get
  the class `automation-handler-step`, and routes out of the area get `automation-handler-route`. These are display-only
  fields: node data is untouched and the stored node type stays `policyNode`.
- A loaded graph (not a draft) passes through `separateFlowHandlerArea`. The positions are saved only if the person
  saves.
- `FlowGraphCanvas` wraps React Flow in `FlowHandlerViewProvider`. It draws `FlowHandlerArea`, a labelled outline that
  takes no pointer input, through React Flow's `ViewportPortal`.
- `FlowNode` shows these badges: "Handler step", "Alternative start" (its condition in the tooltip), "Checkpoint", and
  one hook-port button per covering Handler, labelled with the event. A hook-port button selects the Handler the way
  the outline does.
- A Handler's `body` port and route read "Handler steps" instead of the loop label "Repeat". This touched
  `graph/ports.ts`, `graph/edge-routing.ts`, `NodePortList.tsx` and `flow-graph.ts`.

**Default start fix.** In `flow-editor/model/flow-graph.ts`, `isStart` used to fall back to `index === 0`. t388 saves a
Handler first in its graph, so the Handler was marked Start. The validator then reported the real first step as
"unreachable". For a graph that holds Handlers, the start is now Core's root rule with Handlers excluded. Graphs
without Handlers keep the old fallback.

**Inspector.**
- `panel-registry.tsx` (`editor-node`) adds `customContent: <EffectiveHandlersSection>`, built from `context.flow`, the
  saved graph.
- Each entry shows the event, the handler's name as a link, where it was found ("This step", "This part", "A part that
  calls this one: X", "Whole automation"), and "Any time" or "Only when ...".
- A link calls `requestAutomationGraphNodeFocus` in `graph/node-focus.ts`, an in-process listener set with no DOM
  event. `useFlowEditorSelection` subscribes to it: the editor showing that `flowId` selects the node as its outline
  does, so the published selection carries the editor's own node data.
- `InspectorPanelContext` gains an optional `handlerScopes` (`role`, `callers[]`, `automation[]`, as saved Flow
  documents). Until a host passes it, the section adds this note: "Lists the handlers stored in this part. Handlers
  inherited from parts that call it, and the whole automation's handlers in its recovery part, are not loaded here."

**Styles.** Handler styles are appended to `styles/flow-editor/03-nodes-ports.css`, and the Inspector list styles to
`styles/recordings-clients-inspector/01-inspector.css`.

**Fixture.** `graph/handlers/tests/worked-example-graphs.json` holds the four saved graphs, built with Core's real code:
1. The script was `AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT`'s three worked examples, plus one short script for
   checkpoint and route ("go to search"), which none of the three exercises.
2. Core's own `acceptAutomationStudioFlowBootstrapResult` assembled it, through `savedFlowValidation` and
   `normalizeAutomationStudioFlowBuildPlan`.
3. Every graph passed Core's `validateAutomationStudioFlow`.

The fixture library's click takes `selector`, so `target: tN` was read as `selector: #tN`. The generator is a scratch
script (esbuild-bundled, run with node); it is not in the repository. The JSON's `source` field records how it was
built.

## Commands run and observed results

All were run in the Core worktree.
- `npx vitest run src/features/automation-studio/flow-editor src/features/automation-studio/inspector src/features/automation-studio/graph src/features/automation-studio/tests/architecture-contract.test.ts`
  (in `apps/web`, final run on the clean tree) printed `Test Files 38 passed (38)`, `Tests 179 passed (179)`. New tests:
  - `graph/handlers/tests/`: 6 files, 29 tests.
  - `flow-editor/tests/handler-views-render.test.tsx`: 4 tests. This statically renders the real `FlowGraphCanvas` and
    controller on the fixture graphs.
  - `flow-editor/hooks/tests/node-focus-request.test.tsx`: 1 test.
  - `flow-editor/model/tests/flow-graph-start.test.ts`: 2 tests.
  - `inspector/tests/effective-handlers.test.tsx`: 4 tests.
- `npx vitest run .../shared/tests/phase-10f-ownership.test.ts .../views/tests/ClientViews.test.ts` printed `2 passed`,
  `7 passed`.
- `npx tsc --noEmit -p .` (in `apps/web`) printed nothing; exit 0.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` printed `structure-audit: passed (302 warning(s), 708 baselined).`
  - The earlier run of this check failed on an import cycle: Inspector to the `flow-editor` barrel to `FlowEditorView`
    and back to the Inspector. That is why the pure model lives in `graph/handlers/` and not `flow-editor/handlers/`.
  - Then 4 barrel-import findings failed it; all were fixed.
  - Two of the 302 warnings are new and advisory: `flow-editor/components/` now has 19 files (the threshold is 15), and
    `03-nodes-ports.css` has 519 lines (the threshold is 400).
- Render check from item 6 of the brief: I dumped the static canvas markup for the checkpoint example and read it.
  - The Handler row moved to y=856, below the main path, which ends at y=580.
  - The outline reads "Handlers 1 handler. The run turns to these only when ...". The card reads "Runs Before trying
    again / Applies to ... / Only when something on the page is there / Then Go back to "search"".
  - The step the Handler covers shows a "Before trying again" hook port. The checkpoint step shows "Checkpoint", and
    the body step shows "Handler step".
  - Only `s1` carries the Start badge.

## Not verified

- **Live browser.** I did not open the running web panel; per the brief I did not manage it. React Flow's own
  behaviour is unchecked in a real browser: the portal outline drawing behind the nodes (`z-index: -1` on
  `.react-flow__viewport-portal`), dragging inside the area, and hook-port clicks. The static render mocks
  `ViewportPortal`, which has no DOM target outside a browser.
- **Effects on a live canvas.** The editor's subscription to focus requests is tested at hook level (react-test-renderer).
  `fitView` on a live React Flow instance is not.
- **Visual check.** CSS tokens were checked to exist; no visual review was done.
- **Real step labels.** The fixture has no `nativeNodeDefinitions`, so web steps render with their ids as labels. The
  handler views word those as unnamed steps. With the real domain definitions they read as "Click" and similar; not
  checked.

## Open questions or contradictions found

1. **Core may refuse to run t388's handler graphs.** On dev, `chooseAutomationStudioStartNode` (`runtime/executor/start-node.ts`),
   called from `graph-run.ts:336`, counts a Handler as a root, because no route enters it. A saved graph with a Handler
   and no Start node therefore has several roots ("several_roots") and the run refuses. Both t388 examples that hold a
   Handler have this shape. The editor now excludes Handlers, as C4 intends. Core's runtime does not yet; R2's
   graph-run wiring or t388 should check this.
2. **Saved graphs drop step labels and the Handler's situation text.** In the normalized topology from
   `normalizeAutomationStudioFlowBuildPlan`, nodes have no `label` and an empty `description`. So a card can only say
   "Handler", and the Inspector's scope words read "One step". I did not check whether the real apply path keeps them.
3. **The Inspector is not given the other graphs.** The connected view (`live/view-host/canonical-connected-views.tsx`,
   outside this brief) does not populate `InspectorPanelContext.handlerScopes`. Inherited and whole-automation handlers
   appear only once it passes the caller graphs and the recovery part's graph, and the role. The Inspector also reads
   the saved graph, not the unsaved draft.
4. **The editor flags the recovery part's own handler.** The editor never passes `subflowRole` to
   `automationFlowGraphProblems`. Opened in the editor, the recovery part's whole-automation handler is therefore flagged
   "Only the automation's recovery part may hold a handler for the whole automation". This predates t395, but it now
   shows beside the new card. `FlowEditorProps` would need the Subflow role.
5. **Handler styles share an existing stylesheet.** They were appended to existing stylesheets. A separate
   `06-handlers.css` would need an `@import` in `apps/web/src/app/programs/automation-studio/automation-studio.css`,
   which is outside this brief.
6. **No documentation was updated.** The brief limited edits to `apps/web`. The architecture doc for the editor UI
   (Core `docs/architecture/`) should mention the Handlers area, hook ports and Effective handlers.
