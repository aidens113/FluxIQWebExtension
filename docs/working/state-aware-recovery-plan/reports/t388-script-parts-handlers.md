# t388 R4a-script-parts-handlers: worker report

Worker report for task t388 (brief R4a-script-parts-handlers). All edits are in the Core tree
`C:/Users/osrs_/FluxStuff/fxwork/t388/!FluxIQ`. Nothing is committed. In this report, AS means
`packages/fluxiq/src/programs/automation-studio/` and FB means `AS/runtime/flow-bootstrap/`.

## Outcome

**Done (round 2, after the coordinator's continuation).** The grammar now conforms to t385's real
node definitions and lifecycle vocabulary. Every Flow the tests and the ten format examples assemble
passes both the plan validator and `model/validation/flow.ts`. `FB/adaptation.ts` writes the new
fields to the saved graphs, the candidate tool shows the new format text, and the refusal corpus
covers every new code.

One gap remains, outside my files: the parent Flow's own `metadata.requires` (see "Round 2", item 6).

Round 1's outcome was Partial, and the round 1 sections below are kept as written. The two corpus
failures and the missing adaptation and authoring-loop wiring they describe are fixed in round 2.

## Round 2: conformed to t385 and wired in

### Differences from my first draft, changed to match t385

1. **Fact `target` is now an object.** It was a string. t385's parser,
   `executor/lifecycle/fact-conditions-parse.ts`, keeps only an object target and drops a string
   silently. A handle is now written `{ handle: "t5" }`, the same form a step's `target:` takes once
   read (`authoring/values.ts`). A dialog stays `{ kind: "dialog", role, name }`. The plan parser now
   accepts any bounded JSON object as a target.
2. **Subflow scope says `inherit` explicitly.** It is now `{ kind: "subflow", inherit: true }`, t385's
   default. `nodes` and `automation` are unchanged.
3. **`json` parameters may hold a list.** The handler's `when`, `completionCheck` and `scope` are
   `json` in t385, and `when` and `completionCheck` are lists. The plan validator used to refuse a list
   for a `json` parameter; now only `object` must be an object. My fixture's Call Subflow parameters
   are `json` too, to match.
4. **The handler-end gets t385's defaults.** Every end now carries `checkpointId: ""` and
   `outputs: {}` unless set. The parameter names were already t385's: `disposition`,
   `checkpointId`, `outputs`.
5. **The vocabulary is t385's.** Event values are typed as t385's `AutomationStudioLifecycleEvent`,
   and the C5 table is now decided by t385's `automationStudioDispositionAllowedAt`. My own refusal
   messages are kept.
6. **No change needed:** the event names (`next` becomes `before_next`), the dispositions, the entry
   and checkpoint keys and shapes (`AUTOMATION_STUDIO_SUBFLOW_CONTRACT_KEYS`), the requirement ids
   (they match `requirement-gate.ts`), and the success-check key.

### Other changes

- **Fixture.** `plan/tests/state-node-definitions-fixture.ts` now provides only Call Subflow, still
  compiled to `builtin.control.call-subflow` with C1's parameters. The handler and handler-end are
  the real built-ins, present in every default registry.
- **New test helper.** `plan/tests/saved-flow-validation-fixture.ts` exports `savedFlowValidation`.
  It runs a plan through the plan validator, then through `normalizeAutomationStudioFlowBuildPlan`
  (the topology apply saves), then through `validateAutomationStudioFlow` on each graph. It passes
  each graph's Subflow role, and every checkpoint the automation declares as
  `externalCheckpointIds`.
- **Every assembled Flow is checked against both validators.**
  - In `authoring/tests/state-statements.test.ts`, `planOf` now uses `savedFlowValidation`.
  - In `plan/tests/flow-script-format.test.ts`, a new describe runs all 10 examples through it, using
    a copy of the web fixture where `selector` is optional, because the real domain takes the handle
    instead.
  - Nothing failed the Flow validator once the conformance changes above were made.
- **`FB/adaptation.ts` writes everything to the saved graphs.**
  - Node metadata: `fluxiq.entry` and `fluxiq.checkpoint`.
  - A part's `interface`, including each output's `metadata.binding`.
  - Graph metadata: `fluxiq.successCheck` and `requires`.
  - A new `topology.requires`, the Flow-level union of requirements.
  - Minted ids: the call's `subflowId` and a node-scoped handler's `scope.nodeIds`, through a new
    `mintedReferences` helper. Tests check the minted ids against the saved Subflows and nodes.
- **Candidate tool.** `FB/candidate/authoring-loop.ts:39` now appends
  `AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT` after the loop text, in candidate mode only. The legacy
  digests are unchanged.
- **Refusal corpus.** In `FB/candidate/tests/refusal-locator-corpus.test.ts`:
  - case 91 is now "a step calling a part in a library with no Call Subflow" and expects
    `call_unavailable`;
  - 14 cases are added: `subflow_unreachable`, `call_situation`, `call_misplaced`,
    `call_unknown_input`, `call_input_missing`, `call_cycle`, `part_interface_invalid`,
    `entry_invalid`, `checkpoint_invalid`, `handler_invalid`, `handler_then_invalid`,
    `handler_check_missing`, `fact_invalid` and `handler_unavailable`;
  - the call cases use a library with the Call Subflow stand-in, and the `handler_unavailable` case
    leaves the two handler built-ins out.
- **Clearer refusal.** Because the handler nodes are now in the catalog, a written
  `node: builtin.control.handler`, `builtin.control.handler-end` or `builtin.control.call-subflow` is
  refused `flow_script.unknown_node` with a sentence saying to write `call:` or `on ...:` instead.

### Round 2 commands and observed results (Core tree)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` (in `packages/fluxiq`) | No output, exit 0 |
| Tests | `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/model/validation` | `Test Files 118 passed, 1 skipped (119)`; `Tests 1746 passed, 2 skipped (1748)` |
| Structure audit | `node scripts/structure-audit.mjs 2>&1 \| tail -1` | `structure-audit: passed (300 warning(s), 708 baselined).` |

### Round 2: not verified and still open

- **The parent Flow's own `metadata.requires` is not written yet.** Apply in `runtime/service.ts`
  (around line 3486, not owned) needs one line:
  `...(adaptation.topology.requires?.length ? { requires: [...adaptation.topology.requires] } : {})`.
  The requirement gate already reads each graph's `metadata.requires`, which adaptation now writes,
  so a run is gated even without this line.
- **The host must resolve the new handles.** It needs to resolve `{ handle }` inside fact targets:
  handler `when` and `completionCheck`, entry and checkpoint `when`, and `fluxiq.successCheck`.
  Today only step targets are resolved. This is the downstream fact-evaluation work.
- **Call Subflow is still a stand-in.** It remains the C1-shaped fixture until R1-call-subflow
  defines it.
- **No runtime execution was exercised.**

## Round 1 report (superseded where round 2 says so)

## What changed and why

### Parser (`FB/authoring/parse.ts`, `contracts.ts`)

It now reads each new statement as written:

- **Blocks:** `part <label>:` (as well as `subflow` and `block`).
- **Part interface:** `input: <name>`, and `output: <name> = <binding>`. An `output:` without `=` is
  still a step's output action.
- **Calls:** `call: <part>` on a step.
- **Entries and checkpoints:** `start at: <step>` with the `when:` lines that follow it, and
  `checkpoint:` on a step.
- **Success checks:** `done when:`. It also accepts `success when` and `succeeds when`.
- **Handlers:** `on <before|retry|fail|start|next> [scope]: <situation>`, then `when:` lines, steps,
  `then:` and `end`.

How the parser tells these apart:

- **`end` of a handler:** it returns to the block the handler was written in, not to the main
  sequence.
- **`on` lines:** `on <port>: go to X` is still a branch.
- **`then:` lines:** a `then:` is read as a disposition only inside a handler, and only when it starts
  with carry on, continue, resume, go to, use, give up, stop or fail. Any other `then:` still starts a
  step.

### Statement lowering (new files in `FB/script-statements/`)

- **`fact-condition.ts`** reads fact lines into `FactCondition` (C9):
  - the kinds `exists`, `absent`, `visible` and `enabled`;
  - `text` and `value`, with `is`, `contains` or `matches`, where the value may be `$input.x`;
  - `count`;
  - `dialog <kind> "<name>" [absent]`.

  It also derives the opposite of a fact, which is how a handler's completion check is filled in when
  none is written.
- **`called-parts.ts`** handles parts and calls:
  - finds the parts: a block without `when:` that some step calls with `call:` or `run subflow`;
  - lowers each call into a `builtin.control.call-subflow` step with `{subflowId, inputs, outputs}`;
  - refuses an unknown part, a call to a block with `when:`, a call written beside `node:`, an
    unknown or missing input, a call cycle, and bad or misplaced `input:`/`output:` lines.
- **`entry-points.ts`** writes `fluxiq.entry` (`{id, order, when, requires}`) and
  `fluxiq.checkpoint` (`{id, requires}`). `requires` lists the `$input` names the step reads.
- **`handler-blocks.ts`** lowers each handler into three steps:
  - a registration (`builtin.control.handler`) with `event` (`next` becomes `before_next`), `scope`,
    `when`, `order` and `completionCheck`;
  - the handler's own steps;
  - a `builtin.control.handler-end` with the disposition: `resume`, `route` + `checkpointId`,
    `resolve` + `outputs`, or `unhandled`.

  It also applies the C5 table: no carry on after a fail, `use` only after a fail, and `go to` only to
  a checkpoint. A before or retry handler with no check it can derive is refused.
- **`flow-requires.ts`** works out `metadata.requires` from what each Subflow actually holds.

### Assembly (`FB/authoring/assemble.ts`)

- **Parts** become their own Subflows with role `utility` and an `interface`. Each output port carries
  `metadata.binding`.
- **Handlers** written in a block go into that block's graph, keyed `h<n>-s<m>`. Handlers written
  `everywhere` go into a `recovery` Subflow.
- **Router and fallback:** neither parts nor handler blocks are ever router rules or the fallback.
- **The "no `when:`" branch of `run subflow` is removed**, because a part is now a call.
- **Moved out to stay under 800 lines:** the binding reader went to `script-binding.ts` (now 778
  lines). Inside a part, `$input.x` may only name one of the part's own inputs (C1).

### Supporting changes

- **`assemble-draft.ts`, `draft-bindings.ts`:** a call node's outputs (its `outputs` parameter) count
  as outputs, so `$step.<call>.<out>` checks correctly.
- **`script-locator.ts`:** handler lines, `then:` lines and block-level statements are placed at the
  handler or block as written, and a synthetic label (`:on1`) is never shown.
- **Plan (`FB/plan/`):**
  - `contracts.ts` gains the new types and two constants: the three node ids, and the requirement
    ids.
  - `parsing.ts` accepts and bounds `plan.metadata.requires`, `subflow.interface`,
    `subflow.metadata` and `node.metadata`.
  - `validation.ts` allows each handler body to be its own connected component.
  - `route-validation.ts` treats a Subflow as reached when a call names it, and treats the
    `recovery` Subflow as reached by its handlers.
- **Format text (`FB/plan/flow-script-format.ts`):** a new candidate-only constant,
  `AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT`.
  - It has one line per rule, each with a one-line example.
  - It has the interruption guidance: one place uses `optional:`/`only after:`; several places, or
    any loop pass, use a handler; `repeat pace:` stays. It also says to write a handler only for an
    interruption actually seen, never one imagined.
  - It has three worked examples: a city permit portal (state-aware entry), a weather network's
    station list (an `everywhere` handler for a session-expiry dialog inside a loop), and a
    meeting-room planner (a fail handler that calls a second part and resolves, with both parts
    sharing `done when:`).
  - The legacy constant is unchanged, and the digest tests still pass.

### Tests

- **New** (`FB/authoring/tests/state-statements.test.ts`, 18 tests):
  - parse tests;
  - plan shape for each statement, each plan also run through `validateAutomationStudioFlowBootstrapPlan`;
  - a refusal test for every new code, each checking the line and step the locator names.
- **New** `FB/script-statements/tests/fact-condition.test.ts`.
- **New** fixture `FB/plan/tests/state-node-definitions-fixture.ts`: the three contract nodes, built
  over the built-in Merge node.
- **Updated** `FB/plan/tests/flow-script-format.test.ts`:
  - the guard test now covers the four constants and the three new examples;
  - new shape tests for each example;
  - checks that the new text stays out of the legacy schema.
- **Updated** `FB/authoring/tests/routes.test.ts`: the old "route_condition_missing" case is now
  "call_unavailable", because `run subflow` now means a call.

## Commands run and observed results

All commands were run from the Core tree.

| Check | Command (run from) | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` (`packages/fluxiq`) | No output, exit 0 |
| Structure audit | `node scripts/structure-audit.mjs` (Core root) | `structure-audit: passed (297 warning(s), 708 baselined).` Only advisory warnings appear for the owned directories: authoring 24 files, plan 25, `assemble.ts` 778 lines. |
| Owned test directories | `npx vitest run .../flow-bootstrap/authoring .../flow-bootstrap/script-statements .../flow-bootstrap/plan` | `Test Files 38 passed (38)`, `Tests 448 passed (448)` |
| All of flow-bootstrap | `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap` | `Test Files 1 failed, 115 passed, 1 skipped (117)`; `Tests 2 failed, 1698 passed, 2 skipped (1702)` |

Both failures are in `candidate/tests/refusal-locator-corpus.test.ts`:

- **"is refused with the codes each corpus case is about":** the case "a step running a block with no
  condition" now gets `flow_script.call_unavailable`, because the corpus library has no Call
  Subflow node.
- **"are each met by a corpus case":** 14 codes have no corpus case yet: `call_cycle`,
  `call_input_missing`, `call_misplaced`, `call_situation`, `call_unknown_input`,
  `checkpoint_invalid`, `entry_invalid`, `fact_invalid`, `handler_check_missing`, `handler_invalid`,
  `handler_then_invalid`, `handler_unavailable`, `part_interface_invalid` and `subflow_unreachable`.

## Not verified

- **No real node definitions.** t385's real definitions for the three nodes are not in this tree. The
  tests use fixtures shaped like the contract. Two things could differ in t385's real definitions:
  - parameter value types (assumed): `when` and `completionCheck` are arrays, `scope`, `inputs` and
    `outputs` are objects, `order` and `maxRuns` are numbers;
  - the ports and a separate `checkpointId` parameter.
- **Nothing reaches a stored Flow yet.** `adaptation.ts` does not yet write the new fields.
- **The model never sees the new text yet.** `authoring-loop.ts` does not append it.
- **No live run.** No runtime, extension or live run was exercised. No full suites were run.

## Open questions or contradictions found

1. **Corpus cases needed (t383, `FB/candidate/tests/refusal-locator-corpus.test.ts`).**
   - **Case 91 must change.** `run subflow` now means a call, so this case now gets
     `flow_script.call_unavailable` (because that library has no Call Subflow node) where it expected
     `route_condition_missing` and `subflow_unreachable`. `route_condition_missing` is no longer raised
     by authoring.
   - **Fourteen new cases are needed**, one per code listed under "Commands run". Each needs a
     library that holds the three state nodes; `stateNodeRegistryFixture` is exported from
     `FB/plan/tests/index.ts`.
   - **`subflow_unreachable` needs its own case:** a `subflow x:` block with no `when:` and no call.
   - Ready-made scripts for every new code are in `state-statements.test.ts`, in the tests whose
     names start with "refuses".
2. **`FB/adaptation.ts` (not owned) must write the new plan fields to the Flow.**
   - Node `metadata["fluxiq.entry"]` and `metadata["fluxiq.checkpoint"]` go into the Flow node's
     metadata.
   - `subflow.interface` becomes the part graph's `interface`. Today every non-primary graph gets
     empty inputs and outputs.
   - `subflow.metadata` (`fluxiq.successCheck`, `requires`) goes into the graph's metadata.
   - `plan.metadata.requires` goes into the Flow's `metadata.requires`.
   - **Rewrite the call's `subflowId`.** It holds the plan's Subflow key, which must become the minted
     Subflow id (`subflowIds` map, around line 179).
   - **Rewrite the handler's `scope.nodeIds`.** They hold plan node keys, which must become minted node
     ids (`nodeIds` map).
3. **`FB/candidate/authoring-loop.ts:39` (t383) needs one change** for the model to see the new text:
   append `\n${AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT}`.
4. **Contract shapes I had to assume.**
   - **Fact encoding:** `fact` is the kind, and `op` is the same as the kind for the plain kinds
     (exists, absent, visible, enabled). Text and value facts use equals, contains or matches. A
     count is `op: "count"` with a number, meaning exactly that many. A dialog uses `op` visible or
     absent, with `target: {kind:"dialog", role, name}`. Any other target is the evidence handle as
     written, a string; the host must resolve it the way it resolves a step's target.
   - **Call outputs:** the call's `outputs` maps each part output to the same name, and callers read
     it as `$step.<call>.<name>`.
   - **Interface output bindings** sit in port `metadata.binding`.
   - **Handler-end parameters:** `{disposition, checkpointId?, outputs?}`.
   - **Scope:** `subflow` (the default and `for this part`), `automation` (`everywhere`), or `nodes`.
     `inherit` and `maxRuns` are left at their defaults.
   - **Order:** the document order within the graph the handler registers in.
   - **`requires`:** entries and checkpoints only add `web.facts@1`. There is no separate entry
     capability id.
5. **Grammar additions not named in C12.**
   - `done when:` is used as both a part's success check (C2) and a handler's `completionCheck`, so
     that the "verified alternative" can be written and a non-derivable before or retry check can be
     given.
   - The grammar-only nodes are hidden from fuzzy step matching, so a step that says "call ..." can
     never match Call Subflow by its wording.
