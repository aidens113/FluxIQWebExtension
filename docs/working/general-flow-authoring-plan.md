# General Flow Authoring

Status: Active
Status detail: t252 implementing P1-P4 (Core-paired); P3 waits for lane A on Core dev; live runs are held by the user until t252 lands.
Created: 2026-10-02
Last updated: 2026-10-02
Owner: Senior supervisor agent (design and t252 by lane lead t251/t252)
Scope: How a build writes general Flow steps (loops over rows, Flow inputs, earlier outputs) from what it explored, beside the recorded steps it runs live, and how those steps are declared, tested and taught. It does not change the judge's rules, the recovery ladder, the stored-run permission model, or the $0.10 purse.
Paired document: none (Core changes are recorded here; Core architecture docs are updated in P4)
Related: [language-driven-flow-loop-plan.md](./language-driven-flow-loop-plan.md), [flow-authoring-and-defensive-runtime-plan.md](./flow-authoring-and-defensive-runtime-plan.md), worker reports linked under Findings

---

## Current State

**User direction (binding).**
- 2026-10-02: "it seems like the model thinks it needs to repeat the exact actions that the flow would do to add
  those steps to the flow. But it doesnt. For instance if the task is repetitive, it should be smart and make a flow
  that loops, takes params, etc."
- 2026-10-02, refinement: "The model should be ABLE to explore & 'record'/test different node configurations, but it
  should also be able/encouraged to build dynamic & smart flows from what its gathered without going through every
  iteration."
- 2026-10-02: "implement that feature first before any more live runs." All live runs wait for t252.

**What is true today (verified, Core `424a70b3`, downstream `45965d7d`; details in Findings).**
- Every Flow step is a recorded call: `core.run_node` runs it live, the domain freezes what it ran on as `ranWith`,
  and the Flow node's parameters are written from that (`R/llm/node-tools/draft-step.ts:49`). No step can enter the
  draft without running (`R/flow-draft/amendment.ts:69`), and five prompt sites say so (F4).
- No binding vocabulary reaches the model, although Core's executor already resolves `{"$state":{"path","fallback"}}`
  parameter bindings against Flow inputs, earlier outputs and the For Each row (`R/executor/node-execution.ts:106-115`).
- `repeat` compiles to For Each, whose row reaches body steps whose node declares `item`
  (`R/flow-bootstrap/authoring/draft-routing.ts:252-268`); the web domain then scopes the frozen control to the
  pass's row by its values (`domain/src/output-nodes/native-runtime.ts:158-166`).
- **The build's test never runs a loop.** The dry run and `core.run_flow` resend each step's `ranWith` once, in
  draft order; a repeat span is sent once on the explored row and excused as conditional
  (`R/flow-draft/routing.ts:104-131`, `R/llm/node-tools/replay-draft.ts:172-237`). The executor runs the Flow graph
  only for stored Flows.
- Run `run-murwcaj0-40e56557` (lane D, confirm-requests): the model pressed row 1's Confirm (Tom Becker, 1 mutual
  friend, a row its own listing excluded), so the build itself accepted his request; the test resent that one press,
  found it gone (`core.replay.remembered`), and the judge read "s8 confirms only Tom Becker". The stored Flow's loop
  would have scoped each pass to its row, but nothing ever ran it.

**Top three decisions (detail in Design).**
1. **Two ways in, one Flow.** A step is recorded (run live, as today) or written (`core.run_node` with
   `write: true`: the domain validates it and freezes what it names, nothing is performed). `amend_draft bind`
   generalizes a recorded step by lifting a concrete argument into a binding; its instance run stays as evidence.
2. **Bindings are Core's existing `$state`, nothing new at run time.** The model writes `{"$row": field}`,
   `{"$input": name, "test": value}` and (P5) `{"$step": n, "output": port}`; Core translates them once into
   `item.<field>`, `<name>` with the test value as `fallback`, and the earlier node's output path. A Flow input is
   declared by its first binding, and the stored Flow runs on the test value when no input is given.
3. **The build's test runs a loop as a loop.** A repeat span is run once per row its listing returned *in the test*,
   each body step sent with that row (`item`) and its bindings resolved by the executor's own resolver
   (`resolveAutomationNodeParameterValues`). Expanded spans are no longer excused. A parity test pins the walker to
   the executor's For Each. The test stays the replay walker, not a graph run, so reanchor, site memory,
   sometimes-present and verify-only keep working unchanged.

**Other decisions taken (the user may override).**
- Live calls carry concrete values only; bindings enter by `write` or `bind` (one rule, no half-resolved calls).
- `write` implies `add`. Written steps declare `consequences` exactly as live ones; the plan-time `flow_step` gate and
  the test's executeTool gate apply unchanged.
- For an act with a lasting effect on items a loop selects (confirm, accept, delete, save), the instructions prefer
  writing it over pressing one real item, so the build changes nothing the Flow should not.
- A Flow input's default is the value the instruction gave (its test value).
- Zero rows in the test leave a written loop body untested: refused `full_run_required` (`not_reached`).

**t252 progress (2026-10-03, verified by the lead).** P1/P2 are checkpointed (Core `e4854d20`, downstream
`c62900cb`); dev with lanes A and C is merged (Core `0d7d3071`, downstream `3ca6194b`). P3 so far is uncommitted in
the Core tree.
- Done: P1a, P1b, P1c, P2 (see the ledger); after the merge, `domain/.../written-step.ts` gained lane A's `choice`
  field. P3: w5 the walker runs a repeat over a list once per row with `item` and resolved `$state`, a while span
  until its check stops, `passes` on outcomes, `pass`/`of` on observations, `not_reached`, part runs expand spans;
  w6 the judge sees one line per pass named by the row's screened label and the test's inputs, the step log writes
  `item` and `outputs` as field names; w8 stored Flow nodes keep `metadata.declaredConsequences`, a rerun of a
  written step stays written, a rerun holding a binding is refused `rerun_holds_binding`; w9 `nodeOf`
  (`nodeDescriptions.definition`) reaches the build's gate, the stopped round's test and `core.run_flow`, a written
  member of an unexpanded span that did not pass is refused `not_reached`, and the judge request's denied-key
  re-screen covers `passes` and `inputs`.
- Decisions: a while span whose body is a lasting act runs one pass (the test never does the act); a written member
  excused because an earlier lasting act was withheld stays excused (the model cannot change it).
- Not done: w7 (parity with `runAutomationStudioGraph` and the scripted confirm-requests proof), P4 docs.
- Known, not t252: Core's web app build fails on dev (`apps/web/.../action-card/action-icons.ts` lacks lane C's
  `recall` kind); `evidence-loop.ts` is at the 800-line limit.

**Next.** Supervisor merges lane D (Core `2da9ce41`, downstream `9fed3b76`) into both trees; then w7, then P4.

**Needs the user.** Nothing blocks. The stored-run permission gap (F7: a stored Flow node keeps no `consequences`
and a plain run gates nothing per node) predates this work and applies to recorded steps equally; it is recorded as
a follow-up, not changed here.

## Findings

R = `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`, D = `domain/src`. Worker reports:
[w1 Flow model](./general-flow-authoring-plan/reports/t251-w1-flow-model.md),
[w2 row targets](./general-flow-authoring-plan/reports/t251-w2-row-targets.md),
[w3 instructions and permissions](./general-flow-authoring-plan/reports/t251-w3-instructions-permissions.md),
[w4 test paths](./general-flow-authoring-plan/reports/t251-w4-test-paths.md). Load-bearing claims were re-read by
the lead.

- **F1 Steps.** A draft step is a recorded call: `actionId`, `input`, `ranWith`, `replay {from, produced}`,
  `disposition` (`R/flow-draft/step.ts`). Only `core.run_node` steps are writable (`draft-step.ts:104-106`); the
  node's parameters come from `ranWith.parameters ?? input.parameters`, then `settings`, plus a reserved
  `consequences` entry from `input.consequences` (`draft-step.ts:49-67`). The domain fills `draft` on its result
  (`R/llm/evidence-loop/tool-execution.ts`), `call-record.ts` copies it, and the loop spreads it into the step
  (`R/llm/evidence-loop.ts:466`).
- **F2 Amendments.** `add, drop, exploratory, keep, reorder, rerun, optional, only_if, on_failed, repeat`
  (`amendment.ts:69`). Only `rerun` changes parameters, and it runs live. Routing names steps by id.
- **F3 Loops.** `repeat {through, over}` becomes Merge, For Each, Merge; the list's array port feeds `items`; `item`
  goes to each span step whose node declares an `item` input (`draft-routing.ts:252-268`). Web nodes needing a
  selector declare `item` (`D/output-nodes/definitions.ts:38,216`); navigate, extract_list, keypress do not.
- **F4 Prompts.** "unless the result is a Flow built from the steps you run and add to it: then run each step it
  needs once and add it" (`R/llm/evidence-loop-decision.ts:55`); "A step you run is not in the Flow until you add
  it" (`:291`); "the same node, with the same parameters, that the finished Flow runs" and "A step you add keeps the
  parameters it ran with" (`R/llm/node-tools/run-node.ts:63,73`); the authored draft instruction
  (`R/flow-draft/entry.ts:60`); the draft overrides any reply plan (`R/llm/harness-options/bootstrap-completion.ts:196-204,239,465`).
  The web text adds "do it to one item and state repeat" (`D/runtime/llm-evidence/system-instructions/instructions.ts:41`).
  A build is unstaged, so the policy goes straight into the system message (`R/llm/deepseek/system-prompt.ts:78`).
- **F5 Bindings and inputs.** `$state {path, fallback?}` resolves at any depth; state is Flow inputs, then
  variables, then every earlier output as `<nodeId>.<out>` and bare `<out>`, then wired inputs
  (`R/executor/node-execution.ts:106-115`, `R/../nodes/parameter-bindings.ts:41-72`); a missing path with no
  fallback fails the node, not retryable. For Each writes `<id>.item` and bare `item`. The canonical Flow declares
  typed inputs with defaults (`model/flows.ts:133-146,207`) but the bootstrap plan cannot (`plan/contracts.ts:71-75`),
  root runs apply no defaults (`composite-executor.ts:89`), and plan keys are not rewritten in `$state` paths at
  materialisation (`flow-bootstrap/adaptation.ts:202-213`).
- **F6 Test.** Reset to the first step's `replay.from`, then `{...ranWith, replay: "step"|"verify"}` per proposed
  step through the loop's executeTool (`R/llm/node-tools/replay.ts:92-134`); a step declaring a lasting class is
  verified, not run (`R/flow-draft/verify-only.ts`). Repeat-span members are conditional, so their failure never
  blocks. The judge reads the replay's observations (`dry-run-gate.ts:73-91`,
  `R/service/flow-bootstrap-commands/build-judge.ts:87-100`). t249's judged trial is for stored-Flow repairs only.
  The domain's replay reads only `parameters`, never a row (`D/runtime/llm-evidence/node-run/replay.ts:251-253`),
  and a list read answers row *labels* (`readRows`, one column) for the judge, not full rows (`replay-answer.ts:203-243`).
- **F7 Permissions.** Declared on the call (`run-node.ts:123-133`); the domain refuses a mutating node without one
  (`D/runtime/llm-evidence/node-run/run.ts:298`) and asks Core's gate (`R/action-permissions/gate.ts:292-385`; only
  money, delete, send/publish can be refused). The declaration becomes the plan node's `consequences`
  (`R/flow-bootstrap/authoring/assemble.ts:319-322,359`) and is gated again at plan time as a `flow_step`
  (`R/llm/harness-options/plan-parameter-resolution.ts:148-179`; the web side requires click, keypress and dialog to
  declare, `D/runtime/llm-evidence/plan-resolution/step-permission.ts:79-140`). The stored Flow node drops it
  (`adaptation.ts:208-224`); a stored run gates only in recovery.
- **F8 Row targets.** A press on a row's handle freezes `element.context.listPosition` and `record.text`
  (`D/runtime/llm-evidence/plan-resolution/element-identity.ts:89-104`). In a loop `scopedToRow` replaces the record
  with the pass row's values; the page vetoes the build row's control and rescans for the same control in the row
  holding those values (`apps/extension/src/content/identity/record.ts`, `veto.ts`, `action-runtime/resolve-target.ts`).
  An extract_list row is field values only, no anchor. The model has no handle meaning "this row's Confirm"; pressing
  any kept row's control and stating `repeat` is how it says it. The comment at `native-runtime.ts:150-152` is stale.

## Design

### D1. Recorded and written steps

- **Recorded** (unchanged): `core.run_node` runs the node live; the step is evidence until added.
- **Written**: `core.run_node {node, parameters, consequences, write: true, act?}`. Core sends it to the domain as is
  (bindings translated, D3). The domain does everything a live call does before acting -- node check, parameter
  validation, handle resolution into the frozen identity, the `consequences` declaration required for a mutating node
  and checked for shape -- and stops before the gateway action. It answers `resultCode: "core.run_node.written"`,
  `effectApplied: false`, and `draft {actionId, input, ranWith, effect, proposes: true, written: true,
  replay: {from: <current location>}, control, words}`. No permission request is raised at write time: nothing is
  done, and the test and the plan-time gate both gate it.
- Core marks a step `written: true` only when the domain answered that code, so a domain that ignored `write` and
  acted produces an ordinary recorded step, never a false "written". `write` implies `add`
  (`evidence-loop-decision.ts` parse). A written step is proposable whatever `effectApplied` says, is never
  `did_not_work`, and carries `ranWith` and `replay`, so the test and `core.run_flow` run it like any step.
- A live call whose parameters carry a binding form is refused by the parse (`run_node.binding_needs_write`): "a
  binding runs only in the Flow; write the step (write true), or run it with the value and bind it after".
- The draft line shows `written: true`; after a test it shows `replayed` and, in a loop, `passes`.

### D2. Generalizing a recorded step: `bind`

- `amend_draft {"step": n, "change": "bind", "input": {<parameter>: <binding form>, ...}}`. `input` is a JSON merge
  patch over the step's parameters, as for `rerun` (a node's parameters may be written without `parameters` around
  them). Every leaf it sets must be a binding form, and must replace a value the step already has: generalizing is
  lifting an argument, not inventing one (`bind_not_a_binding`, `bind_new_key`).
- Applies to a kept step, recorded or written. Core translates the forms (D3), writes them into `ranWith.parameters`
  and the shown `input.parameters`, and keeps the first concrete `ranWith` as `instance`, the evidence that the
  step worked with that value. `{"$input": name}` with no `test` takes the replaced value as its test value.
- `{"$row": field}` needs the step inside a repeat span over a list (`bind_row_outside_loop`, checked in the
  amendment and again at assembly). A control needs no `bind`: a press inside a span is scoped to the pass's row (D7).
- No live call. The Flow signature changes (bindings live in `ranWith`), so the next completion is tested again.
  Undoing is `rerun` with a concrete value, which records a fresh step.

### D3. Bindings

| Model writes (in `parameters`, any depth) | Stored as (`$state`) | Resolved |
| --- | --- | --- |
| `{"$row": "name"}` | `{"$state":{"path":"item.name"}}` | in a loop pass, from the row |
| `{"$input": "query", "test": "blue towels"}` | `{"$state":{"path":"query","fallback":"blue towels"}}` | from the run's inputs, else the test value |
| `{"$step": 4, "output": "records", "path": "0.name"}` (P5) | `{"$state":{"path":"@<stepId>.records.0.name"}}`, rewritten to the plan key at assembly and to the node id at materialisation | from that node's output |

- One module pair in `R/flow-draft/`: `binding-forms.ts` (parse a parameters object, translate forms to `$state`,
  name the forms found, refuse malformed ones) and `binding-render.ts` (show `$state` back as the form the model
  wrote). `flow-inputs.ts` collects the declared inputs of the proposed steps: name, test value, steps using it; two
  test values for one name are refused (`flow_draft.input_conflict`).
- Names: `$input` names match `^[a-z][A-Za-z0-9]{0,31}$`; `$row` fields are the list's own field keys.
- At assembly (`R/flow-bootstrap/authoring/`): a row binding outside a repeat span is refused
  (`flow_draft.row_binding_outside_loop`); an input whose name equals an output port id of any node in the plan is
  refused (`flow_draft.input_shadowed`, because bare output keys overwrite inputs, F5); a `$state` object survives
  normalisation unchanged for string and array parameters (F5 notes an array parameter wraps a non-array: fixed if so).
- The domain's write path and its plan-time resolution pass a `$state` leaf through untouched; a parameter whose
  value is a binding counts as present.

### D4. Flow inputs (parameters)

- A Flow input is declared by its first `$input` binding; its test value is the binding's `fallback`. The stored Flow
  runs on that value when the run supplies none and on the supplied one otherwise, because the executor reads run
  inputs first (F5). Nothing changes at run time in t252.
- The draft entry shows `inputs: [{name, test, steps}]`; the test report the judge reads carries the inputs used.
- Test values come from the instruction: "search for blue towels" binds `query` with test `"blue towels"`. The
  instructions say a value the person gave that would change between runs or rows is bound, not typed in.
- P5 adds `inputs` to the bootstrap plan (`plan/contracts.ts`), writes them into the Flow's `interface.inputs`
  (`defaultValue` = test value, `required: false`, value type from the test value) at adaptation, and applies declared
  defaults on root runs (`composite-executor.ts:89`), so callers and the panel can see and fill them.

### D5. Consequences and the permission gate

- A written step must declare `consequences` (the run-node schema already requires it); the domain refuses a mutating
  written node without a readable declaration, as for a live one. The declaration travels in `input` and `ranWith`
  into the plan node's `consequences` (F7), so the plan-time `flow_step` gate and the web rule that click, keypress
  and dialog declare apply unchanged.
- In the test a written or bound step is sent with its declaration through the loop's executeTool, so the gate sees
  each pass; a declared lasting class makes the step a verify step, never performed (`verify-only.ts`), on every pass.
- `bind` keeps the declaration. A loop does one declared act per row; the gate asks once per act as it does today for
  a recorded loop body.
- Unchanged and recorded as a follow-up: the declaration is the model's (cross-checked only for instructed acts), and
  the stored Flow node drops it, so a plain stored run gates nothing per node.

### D6. Testing written and looped steps

- **The walker** (`R/llm/node-tools/replay-draft.ts`, `automationStudioFlowDraftReplaySteps`, with the span logic
  in a new `replay-span.ts`): straight steps exactly as today. At a step whose routing is `repeat`:
  - **List span** (the `over` step's node declares an array output, the rule `draft-routing.ts` uses): the rows are
    `outputs[<that port>]` of the `over` step's answer *in this test*. A new `outputs` member on the tool execution
    result carries a node's output values; the domain fills `outputs.records` on a replayed list read with the rows
    exactly as the Flow's extract_list produces them. For each row in order, each span member is sent with
    `item: row` when its node declares an `item` input (the `takesRow` rule) and with its `$state` leaves resolved by
    `resolveAutomationNodeParameterValues` against `{item: row, ...earlier outputs}`; inputs resolve to their
    fallbacks because the test supplies none.
  - **While span** (`over` is a check): run the check, then the body, until the check stops replaying.
  - Passes are bounded by the For Each bound the executor applies; exceeding it fails the span (`core.replay.loop_bound`).
  - **No rows known** (the `over` step was verified, failed, or the host sends no `outputs`): the span runs once on the
    explored row and stays excused, exactly as today. Old hosts and every existing test keep their behaviour.
- **Outcomes**: one per step as today, plus `passes [{pass, status, resultCode}]` on span members; a member's status
  is its first non-passing pass's, else `replayed`. Members of an expanded span leave the conditional set; a pass
  answering `remembered`, `present` or `verified` passes (the row the build already did, or a lasting act checked).
- **Bindings on straight steps** are resolved the same way; an unresolved path fails the step with
  `core.replay.unresolved_binding`.
- **Observations** gain `pass` and `of`; the build-test summary groups passes under their step, and the judge's
  instruction says a repeated step's passes are one per row (`R/result-verification/build-test/summary.ts`,
  `R/llm/diagnosis-instructions.ts`).
- **dry-run-gate**: same rules, keyed on the Flow signature; the conditional set comes from the walker.
  **Flow signature**: formula unchanged; written steps and bindings change it through `ranWith`.
  **full_run_required**: a written step is runnable (the domain gives `ranWith` and `replay`); new word `not_reached`
  for a written step no pass reached (zero rows); the instructions name `write`.
- **`core.run_flow`**: the same walker without the reset; a span expands when its list step is inside the range,
  otherwise it runs once on the explored row.
- **Parity**: one test assembles a draft with a loop, runs it through `runAutomationStudioGraph` with fake native
  implementations and through the walker with a fake executeTool, and asserts the same sequence of
  (node, resolved parameters, item).
- **Why not run the graph as the test**: it would drop reanchor, site memory, sometimes-present, withheld excusal and
  per-step verdicts, and every existing dry-run test, for the same calls; lane A's verify semantics compose with the
  walker unchanged. The parity test is the guard against drift.

### D7. Row-bound targets in the web domain

- Kept: the frozen identity plus `scopedToRow` plus page-side row gating (F8) is the row binding of a control. It
  is deterministic given distinct row values.
- P2: `scopedToRow` moves to `D/output-nodes/targets/row-scope.ts` and the replay applies it when the call carries
  `item`, so the test targets each row exactly as the Flow will. `outputs.records` carries the Flow's own rows.
- The model says "this row's control" by pressing or writing the control of one row the listing kept and stating
  `repeat`. The instructions say "a row the listing kept" and prefer `write` for a lasting act, so the build no longer
  accepts a request the Flow must leave alone (run murwcaj0).
- P6: extract_list rows carry an anchor (the row element's identity) so two rows with equal values are told apart;
  until then such a pass is refused as ambiguous by the page, and the test shows it.
- Fix the stale comment at `native-runtime.ts:150-152` with the move.

### D8. The model's instructions and tools

Exploration stays first-class: "run any node configuration live to see what it does; what you add is your choice".
New sentences, by file (P1 unless marked):

- `R/llm/evidence-loop-decision.ts:55` (policy): replace the "run each step it needs once and add it" clause with:
  run steps to learn what works and add the ones the Flow needs; you may also write a step without running it
  (`core.run_node` with `write: true`) once what you have seen is enough to know its node and parameters; repetitive
  work is a loop, not a sequence -- list the items with a `where` that keeps the ones to act on, do or write the act
  once on one item it kept, and state `repeat`, never doing it to every item; a value that changes between runs or
  rows is bound (`{"$input": ...}`, `{"$row": ...}`), never typed in. `:291` (`add`): "a step you run or write";
  write implies add.
- `R/llm/node-tools/run-node.ts:62-81` and schema: `write` (boolean) and its description; the binding forms in the
  `parameters` description; "prefer write for a lasting act on items a loop selects: the test acts on exactly the
  items the Flow selects".
- `R/flow-draft/entry.ts:60` (authored draft instruction) and the step line: written steps, bindings shown in the
  model's forms, the `inputs` line, `passes`.
- `R/flow-draft/amendment.ts` (`bind` in the change list, schema and its description) and
  `R/llm/draft-amendment-feedback.ts` (the `bind_*` reasons).
- `R/flow-draft/full-run-required.ts` (both instructions name `write`; `not_reached`).
- `R/llm/harness-options/bootstrap-completion.ts:465` (`DRAFT_SCRIPT_NOTE`): "run or write the step it is missing".
- P3: `R/flow-draft/dry-run.ts:278` (`DRY_RUN_INSTRUCTION`: a repeated step runs once per row; `passes`) and
  `R/llm/diagnosis-instructions.ts:72` (judge: passes and inputs).
- `D/runtime/llm-evidence/system-instructions/instructions.ts:41` (Lists line: loop over the rows a listing kept, act
  on one kept row or write the act, bind values; version `web-4`).

## Phases

Each phase lists files, tests and the narrow checks that gate it. Checks are the tests beside each changed file,
`pnpm --filter fluxiq check` in Core, the downstream typechecks of domain, extension and test-runner against the
t252 Core (Core libraries rebuilt first), and the structure audit and `docs-reference --check` in Core. No full
suites and no live runs.

| Phase | Files (R = Core runtime, D = downstream domain) | Tests (failing first) |
| --- | --- | --- |
| P1a Core draft contracts | R/flow-draft/`binding-forms.ts`, `binding-render.ts`, `flow-inputs.ts` (new), `step.ts`, `amendment.ts`, `entry.ts`, `full-run-required.ts`, `index.ts`; R/llm/`draft-amendment-feedback.ts` | forms round-trip; malformed refused; input conflict; `bind` lifts and keeps `instance`; `bind_row_outside_loop`; written step proposable; entry shows forms, inputs, written |
| P1b Core call contracts | R/llm/node-tools/`run-node.ts`, `replay.ts`; R/llm/evidence-loop/`tool-execution.ts`, `call-record.ts`; R/llm/`evidence-loop-decision.ts`; R/llm/harness-options/`bootstrap-completion.ts` | `write` in schema; write implies add; live call with a form refused; `outputs` and `draft.written` parsed; written marked only on the written code |
| P1c Core assembly | R/flow-bootstrap/authoring/`assemble-draft.ts`, `draft-routing.ts` or a new `draft-bindings.ts`, `normalise.ts` | `$state` survives assembly for string and array parameters; row binding outside a span refused; `input_shadowed` |
| P2 Domain | D/runtime/llm-evidence/node-run/`run.ts` (+ new `write.ts`), `replay.ts`, `replay-answer.ts`; D/output-nodes/targets/`row-scope.ts` (new), `native-runtime.ts`; D/runtime/llm-evidence/plan-resolution (pass `$state` through); D/runtime/llm-evidence/system-instructions/`instructions.ts` | write freezes identity and dispatches nothing; mutating write without consequences refused; replay with `item` scopes the record; list replay carries `outputs.records`; `$state` leaf passes plan resolution |
| P3 Test walker (after lane A) | R/llm/node-tools/`replay-draft.ts`, `replay-span.ts` (new), `dry-run-gate.ts`, `run-flow-part.ts`; R/flow-draft/`dry-run.ts`; R/result-verification/build-test/`summary.ts`; R/llm/`diagnosis-instructions.ts` | span runs per row with `item`; while span; no-`outputs` fallback unchanged; zero rows; unresolved binding; parity with `runAutomationStudioGraph`; part run expands a span |
| P3 proof | a Core scripted build test (provider-free tool host, scripted decisions and judge) | the confirm-requests shape: list with `where` (3 of 8 kept), one confirm run live on a kept row (and a variant writing it), `repeat`, complete; the test presses each kept row's Confirm with its row, the verdict passes, the judge sees 3 passes, the build finishes |
| P4 Docs | Core architecture docs for the draft, the test and bindings; downstream `docs/architecture` page on the build loop | `docs-reference --check` |
| P5 (later) | `$step` bindings (assembly rewrite, `adaptation.ts` key rewrite); plan `inputs`, Flow `interface.inputs`, root-run defaults | binding to an earlier output resolves in a stored run; declared inputs visible and defaulted |
| P6 (later) | extract_list row anchors (D/output-nodes/extract-list, extension list reader), row scope by anchor | two equal-valued rows told apart |

**Risks.**
- *Determinism*: two interpreters of a loop (walker and executor). Guarded by the parity test, by sharing the
  list-port and `item` rules with `draft-routing.ts`, and by using the executor's resolver.
- *Permission safety*: written steps never act at write time; every test call and the plan-time gate see the
  declaration; lasting acts are verified on every pass. The stored-run gap (F7) is unchanged.
- *Cost under the $0.10 purse*: the test is provider-free, so per-row passes cost time, not money; writing and
  generalizing replace live calls, so builds should get cheaper. A long list makes a long test: bounded by the For
  Each bound.
- *Exposure*: `outputs` rows and `item` are page data. They never reach the model or the judge (the judge keeps
  `readRows` labels); the step log writes an `item` with denied keys withheld, as evidence is.
- *Lane A overlap*: P3 edits files lane A changes; it starts only after Core dev is merged in.

**Scenarios that prove it** (live, after t252, one per lane slot): `social-network-feed` / `confirm-requests`
(lane D) first: a loop confirming exactly the kept rows, nothing pressed outside them. Then one with a parameter, for
example an `everything-store` search whose searched item becomes `$input`, and `professional-network`'s invitation
manager as a second loop.

## Worker Briefs

The t251 read briefs (w1-w4) are done; their reports are linked under Findings. t252 briefs follow. Core tree
`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ` (R = `packages/fluxiq/src/programs/automation-studio/runtime`),
downstream tree `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQWebExtension` (D = `domain/src`); branch
`task/t252-general-flow-authoring-impl` in both; workers never commit.

### Brief: t252-w1-draft-contracts
- Repository: FluxIQ Core (t252 tree). Phase P1a.
- Task: implement in R/flow-draft and R/llm/draft-amendment-feedback.ts, failing tests first, per D1-D4 and D8:
  1. `binding-forms.ts` (new): translate a parameters object's model forms at any depth: `{"$row": f}` ->
     `{"$state":{"path":"item.<f>"}}`; `{"$input": n, "test": v}` -> `{"$state":{"path": n, "fallback": v}}`;
     `{"$step": ...}` refused `step_binding_not_yet` (P5). Names `^[a-z][A-Za-z0-9]{0,31}$`, `item` reserved; row
     fields `^[^.\s]{1,64}$`; extra keys or wrong types refused `malformed`. Also: whether a value holds any form;
     the kind of a stored `$state` (`row` = path `item.<f>`, `input` = dotless path with fallback). Answer
     `{parameters, refused: [{path, reason}]}`.
  2. `binding-render.ts` (new): stored `$state` back to the model's form, for display.
  3. `flow-inputs.ts` (new): inputs of the proposed steps (`ranWith.parameters ?? input.parameters`):
     `[{name, test, steps: [positions]}]`, and conflicts (one name, two test values).
  4. `step.ts`: `written?: true`, `instance?: JsonObject` (doc comments); a written step is proposable whatever
     `effectApplied` says.
  5. `amendment.ts`: change `bind` per D2 (enum, schema text, apply): `input` is a patch whose every leaf is a form
     replacing an existing parameter (the `parameters` wrapper optional); kept steps only; writes `$state` into
     `ranWith.parameters` and `input.parameters`; keeps the first concrete `ranWith` as `instance`; `$input` without
     `test` takes the replaced value; `$row` needs the step inside a repeat span (read `routing.ts`). Refusals
     `bind_not_a_binding`, `bind_new_key`, `bind_row_outside_loop`, `bind_malformed`. `did_not_work` never applies
     to a written step.
  6. `entry.ts`: step line shows `written: true`, parameters with `$state` rendered as forms, and `passes` when the
     step's `replayed` carries them; the entry gains an `inputs` line when any; AUTHORED_INSTRUCTION per D8.
  7. `full-run-required.ts`: word `not_reached`; both instructions name `write` (D8).
  8. `draft-amendment-feedback.ts`: a telling for each `bind_*` reason. 9. `index.ts` exports.
- Required reads: D1-D4 and D8 of the design doc in the downstream t252 tree; the files named.
- Owns (may edit): R/flow-draft/{binding-forms,binding-render,flow-inputs}.ts (new), `step.ts`, `amendment.ts`,
  `entry.ts`, `full-run-required.ts`, `index.ts`, R/flow-draft/tests/*, R/llm/draft-amendment-feedback.ts and its
  test; assertions elsewhere that pin the amendment change list or these instruction texts (list each).
- Must not touch: R/flow-draft/{dry-run,verify-only,routing}.ts, other R/llm files, the downstream tree.
- Definition of done: new and existing tests in R/flow-draft/tests and the feedback test pass;
  `pnpm --filter fluxiq check` clean; `node scripts/structure-audit.mjs` passes in Core.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w1-draft-contracts.md (downstream t252 tree)

### Brief: t252-w2-assembly
- Repository: FluxIQ Core (t252 tree). Phase P1c.
- Task: D3's assembly rules in R/flow-bootstrap/authoring, failing tests first:
  1. A draft step whose `ranWith.parameters` holds `{"$state":{"path":"item.name"}}` on a string parameter and
     `{"$state":{"path":"query","fallback":"x"}}` assembles (`assembleAutomationStudioFlowDraftPlan`) into a plan
     node holding the same objects unchanged, also on an array parameter; fix `normalise.ts`/`values.ts` if not.
     The plan passes plan validation (`R/flow-bootstrap/plan/validation.ts`).
  2. A row binding (path `item.<f>`) on a step outside a repeat span over a list step is refused
     `flow_draft.row_binding_outside_loop`, naming the step; inside such a span it assembles.
  3. An input (dotless path with a fallback) named `item`, or named like an output port id of any node definition the
     plan uses, is refused `flow_draft.input_shadowed`.
  Detect bindings locally in a new `draft-bindings.ts` (do not import the flow-draft binding modules, written now).
- Required reads: D3 of the design doc; `assemble-draft.ts`, `draft-routing.ts`, `normalise.ts`, `values.ts`.
- Owns (may edit): R/flow-bootstrap/authoring/{assemble-draft,draft-bindings (new),normalise,values,index}.ts and
  their tests; R/flow-bootstrap/plan/validation.ts only if item 1 needs it.
- Must not touch: R/flow-draft/*, R/llm/*, draft-routing.ts (read only), the downstream tree.
- Definition of done: new and existing tests in R/flow-bootstrap/authoring/tests pass; `pnpm --filter fluxiq check`;
  structure audit passes.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w2-assembly.md

### Brief: t252-w3-domain
- Repository: this repository (t252 tree). Phase P2.
- Task: the domain side of D1, D6, D7, D8, failing tests first:
  1. Move `scopedToRow` from D/output-nodes/native-runtime.ts to new D/output-nodes/targets/row-scope.ts (barrel),
     fixing the stale comment at native-runtime.ts:150-152; native-runtime imports it.
  2. D/runtime/llm-evidence/node-run/replay.ts: a `step` or `verify` call carrying an object `item` applies the row
     scope to `parameters` before permission and resolution, exactly as the native runtime does.
  3. A replayed list read also answers `outputs: {records: <rows exactly as the Flow's extract_list produces them>}`
     on the tool execution result (`capture.ts`), keyed by the node's output port id (`records`).
  4. Write mode: `core.run_node` with `write: true` runs the live path's checks and handle resolution (frozen
     identity in `ranWith`, control words) and stops before the gateway action, raising no permission request; a
     mutating node needs a readable `consequences` declaration (as `node-run/run.ts:298`). It answers
     `resultCode: "core.run_node.written"`, `effectApplied: false`, `draft {actionId, input, ranWith (with its
     consequences, as live), effect, proposes: true, written: true, replay: {from: {location: <current>}}, control}`.
  5. A parameter leaf `{"$state": {...}}` counts as present and passes untouched through write-mode validation and
     plan-time resolution (D/runtime/llm-evidence/plan-resolution).
  6. D/runtime/llm-evidence/system-instructions/instructions.ts:41 Lists line per D8; version `web-4`.
  Core mirrors these names in P1b: `write`, `item`, `outputs`, `core.run_node.written`.
- Required reads: D1, D6, D7, D8 of the design doc; the files named.
- Owns (may edit): D/output-nodes/{native-runtime.ts,targets/row-scope.ts,targets/index.ts} and their tests;
  D/runtime/llm-evidence/{capture.ts,node-run/*,plan-resolution/*,system-instructions/*} and their tests.
- Must not touch: Core, apps/extension, packages/.
- Definition of done: the tests beside each changed file pass (with `DOMAIN_TEST_BUILD_LABEL=t252-w3`);
  `pnpm --filter @fluxiq-web-extension/domain check` clean; `node scripts/structure-audit.mjs` passes.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w3-domain.md

### Brief: t252-w4-call-contracts
- Repository: FluxIQ Core (t252 tree). Phase P1b. w1's R/flow-draft binding modules and w3's domain answers exist.
- Task, failing tests first, per D1, D6 (contracts only) and D8:
  1. R/llm/node-tools/replay.ts: export the names the domain mirrors -- `write`, `item`, `outputs`,
     `core.run_node.written` -- and let the replay step and verify calls take an optional row (`item`) and optional
     resolved parameters in place of `ranWith.parameters` (P3 uses both; today's calls unchanged when absent).
  2. R/llm/evidence-loop/tool-execution.ts and the parser in R/llm/evidence-loop-decision.ts
     (`automationStudioLlmEvidenceParseToolExecutionResult`): accept `outputs` (a JSON object, carried, never shown)
     and `draft.written`; a result whose `draft.written` is true but whose code is not `core.run_node.written` is
     read as not written. R/llm/evidence-loop/call-record.ts carries `written` onto the step (the loop spreads it).
  3. The decision parse (R/llm/evidence-loop-decision.ts): a `core.run_node` call with `write: true` implies `add`;
     its parameters' binding forms are translated to `$state` with w1's translator before the call is sent, and a
     refused translation refuses the decision naming each path and reason; a call without `write` whose parameters
     hold any form is refused `run_node.binding_needs_write` with D1's sentence. Use the parse's existing refusal path.
  4. R/llm/node-tools/run-node.ts: `write` (optional boolean) in the schema and the description per D8; the binding
     forms in the `parameters` description.
  5. Policy text R/llm/evidence-loop-decision.ts:55 and the `add` text at :291 per D8;
     R/llm/harness-options/bootstrap-completion.ts:465 `DRAFT_SCRIPT_NOTE`: "run or write the step it is missing".
- Required reads: D1, D3, D6, D8 of this document; the w1 and w3 reports in this directory; the files named.
- Owns (may edit): the files named above and their tests (`R/llm/tests/*`, `R/llm/node-tools/tests/*`,
  `R/llm/evidence-loop/tests/*` for these files); assertions elsewhere that pin these texts (list each).
- Must not touch: R/llm/{evidence-loop,loop-configuration,diagnosis-instructions}.ts, R/llm/deepseek/*,
  R/llm/node-tools/{dry-run-gate,replay-draft,step-place,run-flow-part,run-flow}.ts, R/flow-draft/*, R/service*,
  R/result-verification/*, the downstream tree. No new file in R/llm/evidence-loop/ (25-file limit).
- Definition of done: new and existing tests beside the changed files pass; `pnpm --filter fluxiq check`; Core
  structure audit passes.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w4-call-contracts.md

### Brief: t252-w5-test-walker
- Repository: FluxIQ Core (t252 tree, after dev is merged in). Phase P3. Builds on w1/w4 contracts.
- Task, failing tests first, per D6: in R/llm/node-tools, with the span logic in a new `replay-span.ts`:
  1. `replay-draft.ts` (`automationStudioFlowDraftReplaySteps`): at a step whose routing is `repeat` over a step
     whose node declares an array output (the rule `draft-routing.ts` uses), take the rows from that step's answer
     *in this test* (`outputs[<port>]`, w4's member) and run every span member once per row, in order, sending
     `item` (the row) to members whose node declares an `item` input and resolving every member's `$state` leaves
     with `resolveAutomationNodeParameterValues` against `{item: row}` plus earlier outputs (w4's replay call
     options). A `repeat` over a check runs check then body until the check stops replaying. Passes are bounded by
     the executor's For Each bound (`core.replay.loop_bound` past it). No rows known (verified, failed, no
     `outputs`): one pass on the explored row, excused as today.
  2. Straight steps also resolve `$state`; an unresolved path fails the step `core.replay.unresolved_binding`.
  3. Outcomes: `passes [{pass, status, resultCode?}]` on span members; status is the first non-passing pass's, else
     `replayed`; members of an expanded span leave the conditional set; observations carry `pass` and `of`.
     Zero passes on a written member refuses `full_run_required` with `not_reached` (`dry-run-gate.ts`).
  4. `run-flow-part.ts`: the same walker without the reset; a span expands when its list step is in the range.
  5. R/flow-draft/dry-run.ts: the outcome type carries `passes`; `DRY_RUN_INSTRUCTION` says a repeated step runs
     once per row (D8). Keep lane A's verify-only and end-page behaviour intact.
  6. Resolve `$state` leaves against `{item: row}` for every span member (the executor reads the bare `item` too),
     and against `{}` for straight steps, so `$input` takes its test value. A pass with an `item` sends no
     `produced`. A member's mode is lane A's `automationStudioFlowDraftStepReplayMode(step, lastingActs)` on every
     pass: a lasting act is a verify call per row, never a press.
- Owns: R/llm/node-tools/{replay-draft,replay-span (new),dry-run-gate,run-flow-part}.ts, R/flow-draft/dry-run.ts,
  their tests. Must not touch: R/result-verification/*, R/llm/diagnosis-instructions.ts, R/llm/step-log/*, the
  downstream tree.
- Done: new and existing tests in R/llm/node-tools/tests and R/flow-draft/tests pass; check; audit.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w5-test-walker.md

### Brief: t252-w6-judge-view
- Repository: FluxIQ Core (t252 tree, after dev is merged in). Phase P3, parallel with w5.
- Task, failing tests first: observations may carry `pass` and `of`, outcomes `passes` (w5's shapes):
  1. R/result-verification/build-test/summary.ts (and `observation.ts` if needed): a repeated step's passes are one
     line each under their step, saying which row (its label, screened as `readRows` labels are); the inputs the
     test used (`flow-inputs.ts`) appear once.
  2. R/llm/diagnosis-instructions.ts (build-test judge): a repeated step runs once per row and its target is the
     pass's row, not the row the build explored; inputs are the Flow's parameters at their test values.
  3. The step log (R/llm/step-log): a replay call's `item` and a result's `outputs` are written as their field names
     only, never values.
- Owns: R/result-verification/build-test/*, R/llm/diagnosis-instructions.ts, R/llm/step-log/*, their tests. Must
  not touch: R/llm/node-tools/*, R/flow-draft/*, the downstream tree.
- Done: tests beside the changed files pass; check; audit.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w6-judge-view.md

### Brief: t252-w7-parity-and-proof
- Repository: FluxIQ Core (t252 tree), after w5 and w6. Phase P3 proof. Tests only, plus fixes w5/w6 missed.
- Task: (1) Parity: assemble a draft with a list step, a `repeat` span holding a row-scoped press and a step with a
  `$row` binding, and an `$input` step; run the assembled plan through `runAutomationStudioGraph` with fake native
  implementations and the draft through the walker with a fake executeTool; assert the same sequence of
  (node, resolved parameters, item). (2) Proof, provider-free (scripted decisions and judge, a fake tool host for
  `core.run_node` live, write and replay over 8 requests, 3 with 5+ mutual friends): list with a `where` (add), one
  Confirm run live on a kept row (add), `repeat` over the list, complete; the test presses each kept row's Confirm
  once with that row as `item` -- a verify call per row, since confirming declares a lasting class -- and touches no
  excluded row; the verdict passes, the judge sees 3 passes, the build finishes. Variants: the Confirm written
  (`write: true`) instead of run; a non-lasting act (consequences []) that is sent as a step call per row; zero kept
  rows with a written body refused `not_reached`. The written variant's stored Flow node keeps its declared
  consequences (w8) and the build's gate records list them. Model on `R/llm/node-tools/tests/lasting-acts-build.test.ts`.
- Owns: new test files beside the walker and the build loop; fixes only with a note in the report.
- Done: both tests pass and fail when the walker's expansion is disabled; check; audit.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w7-parity-and-proof.md

### Brief: t252-w8-stored-consequences-and-rerun
- Repository: FluxIQ Core (t252 tree). Phase P3, parallel with w5 and w6.
- Task, failing tests first:
  1. R/flow-bootstrap/adaptation.ts: each materialised Flow node keeps its plan node's `consequences` as
     `metadata.declaredConsequences` (absent when the plan node has none), for recorded and written steps alike, so
     the declaration survives storage. No run-time gate reads it yet (a user decision).
  2. R/llm/evidence-loop/rerun-request.ts: a rerun of a written step (`step.written`) stays written (the call carries
     `write: true`); a rerun of a recorded step whose merged parameters hold any binding (`$state`, `$row`, `$input`,
     `$step`) is refused with a new reason `rerun_holds_binding` (add it to the refusal union in
     R/flow-draft/amendment.ts, a telling in R/llm/draft-amendment-feedback.ts: "a bound step runs only in the Flow:
     rerun it with a concrete value for every bound parameter, or write it", and the reason maps in
     R/flow-bootstrap/evidence-loop-steps.ts and R/activity/wording/draft-edit-refused.ts).
- Owns: those five files and their tests. Must not touch: R/llm/node-tools/*, R/flow-draft/dry-run.ts,
  R/result-verification/*, the downstream tree.
- Done: tests beside the changed files pass; check; audit.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w8-stored-consequences-and-rerun.md

### Brief: t252-w9-wiring
- Repository: FluxIQ Core (t252 tree). Phase P3, after w5, w6, w8. Makes the per-row test live in a build.
- Task, failing tests first:
  1. `nodeOf` (w5's `AutomationStudioFlowDraftReplayNodeOf`, R/llm/node-tools/replay-span.ts) reaches every place
     the walker runs in a build: a loop input `nodeOf` in R/llm/loop-configuration.ts; R/llm/evidence-loop.ts passes
     it to the dry-run gate and to the tool set (R/llm/node-tools/loop-tools.ts), which hands it to the `core.run_flow`
     binding (R/llm/node-tools/run-flow.ts) and on to the part run; R/service.ts sets `nodeOf:
     nodeDescriptions.definition` on the build's loop input (the call with `fullRunRequired: true`) and on the stopped
     round's `test` gate. A loop-level test: a draft with a list step, a repeated press and `nodeOf` given runs the
     press once per row in the dry run and in `core.run_flow`.
  2. R/llm/node-tools/dry-run-gate.ts: a written member of a repeat span that the test ran without expanding (no
     `passes`, excused as conditional) and that did not pass is refused `not_reached`, as one with `passes: []` is.
     R/flow-draft/full-run-required.ts: the `not_reached` sentence covers both causes (the list had no items in the
     test, or the test could not walk its rows) and says what to do for each.
  3. R/llm/harness/request-evidence-check.ts: the judge request's denied-key re-screen covers the build test's
     `passes` (each pass's observed and label) and `inputs` (w6's fields in R/result-verification/build-test).
- Owns: the files named and their tests. Must not touch: R/result-verification/* (read only), the downstream tree.
- Done: tests beside the changed files pass; `pnpm --filter fluxiq check`; Core structure audit.
- Report to: docs/working/general-flow-authoring-plan/reports/t252-w9-wiring.md

## Work Ledger

### 2026-10-02 — t251 design: general Flow authoring
- Agent: lane lead t251, with workers t251-w1 to w4 (read only)
- Changed: this document; four reports under `general-flow-authoring-plan/reports/`
- Why: the user's direction that a build writes loops and parameters instead of replaying every action
- Validation: lead re-read `native-runtime.ts:60-170`, `node-run/replay.ts:195-360`, `draft-step.ts:1-106`,
  `node-execution.ts:100-125`, `parameter-bindings.ts:36-75`, `dry-run-gate.ts`, `replay-draft.ts`,
  `run-flow-part.ts`, `routing.ts`, the run's steps 0072-0080 -> worker claims matched; `node scripts/structure-audit.mjs` (see the report)
- Outcome: Accepted (design); no product code changed
- Follow-up: t252 implements P1-P4

### 2026-10-03 — t252 P1 and P2: authoring contracts and the domain side
- Agent: lane lead t252, workers t252-w1 (draft contracts), w2 (assembly), w3 (domain), w4 (call contracts)
- Changed: Core R/flow-draft (binding-forms, binding-render, flow-inputs new; step, amendment, entry,
  full-run-required, index), R/flow-bootstrap/authoring (draft-bindings new; assemble-draft, normalise, values,
  index), R/llm (node-tools/replay, run-node, evidence-loop/tool-execution, call-record, decision-refusal,
  evidence-loop-decision, unusable-decision, draft-amendment-feedback, harness-options/bootstrap-completion), two
  reason maps (evidence-loop-steps, activity wording), the deepseek policy pin; domain node-run (write mode,
  replay row scope, `outputs`), output-nodes/targets/row-scope, plan-resolution/state-binding, web instructions
- Why: D1-D4, D7, D8 and the contract half of D6
- Validation: Core `npx vitest run` over flow-draft, flow-bootstrap/authoring, llm/tests, llm/node-tools,
  llm/evidence-loop, llm/harness-options, llm/deepseek tests -> 114 files, 1191 passed; `pnpm --filter fluxiq check`
  -> clean; `node scripts/structure-audit.mjs` -> passed (226 warnings, 349 baselined); domain 49 test files beside
  the changes -> 390/390; domain check rc 0. recorded-windows run4 fails on the base with t252 files reverted.
- Outcome: Partial (P3, proof and P4 not started)
- Follow-up: dev merge (lanes A, C) by the supervisor; then w5, w6, w7

### 2026-10-03 — t252 P3: loops run per row in the build's test
- Agent: lane lead t252, workers t252-w5 (walker), w6 (judge view, step log), w8 (stored consequences, rerun), w9
  (wiring, not_reached, re-screen)
- Changed: Core R/llm/node-tools (replay-span new, replay-draft, dry-run-gate, run-flow-part, run-flow),
  R/flow-draft (dry-run, full-run-required, amendment), R/result-verification/build-test (pass-lines, span-rows,
  test-inputs new; summary, contracts), R/llm (diagnosis-instructions, step-log, loop-configuration, evidence-loop,
  harness/request-evidence-check, evidence-loop/rerun-request, draft-amendment-feedback), R/flow-bootstrap
  (adaptation, evidence-loop-steps), R/activity wording, R/service.ts (two call sites), policy pins; downstream
  written-step.ts (`choice`, after the merge)
- Validation: downstream domain, extension, test-runner `pnpm --filter <pkg> check` -> rc 0 each against the merged
  Core; domain 81 test files beside t252 -> 621/621; Core `npx vitest run` over runtime/llm, flow-draft,
  result-verification -> 183 files, 1721 passed (earlier, with flow-bootstrap, activity, decision-context: 229 files,
  2717 passed); `pnpm --filter fluxiq check` -> clean; Core audit -> passed (231 warnings, 349 baselined)
- Outcome: Partial (w7 proof and P4 docs remain)
- Follow-up: lane D merge by the supervisor, then w7 and P4

## Open Questions

- Stored-run permission gap (F7): should a stored Flow node keep its `consequences` and the plain run gate them?
  Owner: supervisor, with the user; settles in a task of its own.
- P5 scope: whether Flow inputs need the panel to show and fill them before the next live round. Owner: supervisor.
