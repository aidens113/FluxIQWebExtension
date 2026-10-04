# Lasting action classification — read-only design

## Current State
Worker resume-cd; source frozen during A2/B live work. No source change, tests, builds, provider call, launch, browser/store/profile read, or shared-document edit. Inspected frozen Core replay/classification owners and public downstream registration/task source. B worker safe summary received: cart additions in the last draft are step11/a2 and step20/a3 with input.consequences=[]. Four full-test Add-to-cart calls 0088/0094/0143/0149 explicitly used replay:step, consequences:[], and returned core.replay.replayed/ok:true. Final screened screenshot counts were 10 items/$140.74 versus expected 4/$43.39. Actual cached instructed-consequence entry quotes remain unknown. This report distinguishes confirmed source behavior from the live-specific hypothesis.

## Confirmed classification path
Core source root: `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `flow-draft/verify-only.ts` StepReplayMode first requires effect=mutate. It returns verify if the step's declaration contains any non-none consequence, reading ranWith.consequences before input.consequences. Otherwise it returns verify only when a step's acts contains an ID in the supplied instructed lasting-act set. A choice such as a2.size never matches its parent a2 automatically. Without either witness, it returns replay, which node-tools sends as replay:step.
- `llm/node-tools/replay-draft.ts` uses that mode for each full draft step; replay-span uses it for repeated members too. Domain verification is read-only, whereas step mode executes the registered action. A cart Add in step mode therefore actually mutates the cart again during every full test that reaches it.
- `flow-bootstrap/action-permissions.ts` instructedLastingActs calls the existing cached instruction consequence derivation once. It excludes IDs containing dots, folds case/spacing and matches each act's quote only by whole-string substring containment in either direction against the consequence reader's grounded quotes. It does not know cart controls or action IDs.
- The instruction-act parser deliberately splits a single adding clause with multiple counted objects into separate acts. `instructed-acts/instruction-acts.ts` coordinatedObjects gives each child its own object plus common destination, then prefixes the original verb. Those per-object display quotes are reconstructed phrases, often not contiguous substrings of the original sentence. This is necessary for correct per-object coverage, but incompatible with assuming every act quote is a literal original span.
- Registered web output catalog derives web.dom.click as mutate from the safety table. The domain has no semantic cart-specific action/consequence registration in these owners: an Add-to-cart control and a menu button use the same web.output.dom-click/web.dom.click. Node-run accepts the model's consequence declaration; missing/null mutate declaration is refused, while [] is a valid explicit declaration. Domain permission policy explicitly avoids assigning consequences from FluxIQ's own interpretation of control labels.

Thus permission-class declarations and replay protection are related but distinct. `modify_existing` or `create_new` protects a declared cart step without asking a person under the current user policy. Empty [] leaves protection dependent on correctly attributed instructed lasting acts. Do not change permission behavior or infer lasting classes from page labels to solve this bug.

## Concrete B source-level failure candidate
Public task `apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts` has a switch-store act followed by one add clause containing two counted products and a shared cart destination. Existing Core instruction-acts tests pin its three parsed acts: store a1, towels a2, napkins a3.

Using synthetic equivalent words:

```text
Original clause: add two packs of Towels in Large and one pack of Napkins in Small to my cart, both for pickup
Parsed a2 quote: add two packs of Towels in Large to my cart, both for pickup
Parsed a3 quote: add one pack of Napkins in Small to my cart, both for pickup
```

If the grounded consequence read quotes the original combined clause, neither reconstructed child quote contains it nor is contained in it. Current instructedLastingActs then misses both a2 and a3, although the original read correctly identifies that the instruction asks for cart mutation. With [] declarations and a2/a3 claims, both adds replay in step mode.

This failure follows directly from the confirmed algorithms. B's [] declarations, a2/a3 claims and step-mode tests are confirmed by the worker summary. The worker measured a1 containment true and a2/a3 false only against the serialized complete context.instructions record, not the cached gate consequence entry.quote values; the actual read-side half of this mechanism remains unproven. Other possible routes to step mode are no act claim, wrong claim, choice-only claim, derivation returning no cart quote/failing, stale cached empty set, or lasting-set omission in a caller. Existing lasting-acts tests cover wiring with supplied sets and single contiguous quotes; they do not cover the combined-quote/split-object intersection.

## Narrow generic correction
Preserve each parsed act's original source-clause provenance independently of its per-object display quote. For split objects, source provenance must identify the original adding clause and the child's own object range; do not merge a2/a3 or weaken their object coverage checks.

Use grounded source provenance when attributing instructed consequences to acts, instead of relying solely on the reconstructed display quote. Minimal compatible candidate: an optional sourceQuote containing the *original exact adding clause* beside the current display quote, supplied only by Core's parser. instructedLastingActs can match existing literal quote first and grounded source clause second. A stricter range-based design also preserves verb/object/destination spans and checks whether the consequence quote covers those spans in the same active instruction; that handles narrowly quoted individual objects without treating a shared verb alone as evidence for every act.

Recommend first bounded implementation only for the reproduced combined-clause witness. Keep current unsplit behavior, IDs, display quotes, choices, permission classes and lazy one-read caching unchanged. Never widen to all acts: open/filter/set steps may be needed to reach subsequent targets, and verifying them instead of replaying them breaks the Flow. Never use page-control text, cart-specific Core node names, a global verify-all-mutations rule, or new model/provider calls.

Consequence derivation failure/no grounded witness remains a separate unresolved behavior. Do not silently classify every unproven act as lasting or authorize it from this proposal. Record diagnosis provenance so a future failure distinguishes declared-lasts, instructed-act-match, unmatched claim, and missing instruction read without exposing text.

## Failing-before tests to write once freeze is released
1. Use the public B task instruction and a fake cached consequence derivation returning a validated original combined adding-clause quote. Parse acts; assert a2 and a3 are in instructedLastingActs and a1 is excluded unless separately quoted. Current source deterministically fails the two cart membership assertions.
2. Whole-loop fullRunRequired fixture: two generic mutate adds claiming a2/a3 with consequences:[], followed by full draft test. Counting fake host must record one real action for each exploration call, then verify for each cart step in *every* subsequent full test. Preserve store/menu/navigation/choice step replay:step. Current source executes adds again when the read uses the combined clause.
3. Direct declared witness: a mutate step carrying modify_existing/create_new verifies even with no matching act; ranWith declaration retains precedence. This existing semantics must stay unchanged.
4. Per-object display/checklist assertions: child IDs and quotes remain separate; towels cannot fulfill napkins, quantities remain ordinary selected inputs rather than row loops. Scope does not alter quantity-fault or unrepeat.
5. Negative witnesses: unrelated source clause, negated add, omitted/failing read, choice IDs with dots, open/read instructions, different instruction scope and title/body handling must not invent a lasting match. A short generic fragment such as shared add verb alone must not classify unrelated acts.
6. No permission changes: fake gate records same declarations; non-destructive cart steps do not ask a person, destructive classes still use their existing gate. No provider call beyond the existing one cached instruction read.
7. Each test's fake host explicitly counts mutations, not just successful verdicts. Full draft tests are verification of prior lasting acts, not extra production-like cart additions; normal persisted runtime execution still acts as authored.

## Minimal exact file partition
One serial Core-only unit, paths relative to runtime root:

```text
flow-bootstrap/instructed-acts/contracts.ts
flow-bootstrap/instructed-acts/instruction-acts.ts
flow-bootstrap/instructed-acts/tests/instruction-acts.test.ts
flow-bootstrap/action-permissions.ts
flow-bootstrap/tests/action-permissions.test.ts
llm/node-tools/tests/lasting-acts-build.test.ts
```

No downstream source changes for this correction. Read-only owning compatibility dependencies: flow-draft/verify-only.ts, llm/node-tools/replay-draft.ts and replay-span.ts; downstream node-run/{catalog,run,verify}.ts, permission.ts, actions/{effect,safety}.ts, output-nodes/definitions.ts. Existing llm/node-tools/tests/lasting-acts.test.ts is an additional focused compatibility owner to run, not a source-edit release initially required.

The contracts/source-quote field must be explicitly released by supervisor and kept source-provenance-only; do not treat model-supplied fragments as authenticated parser origin. If new matcher responsibilities warrant a focused module, request that module plus its barrel/test as exact added paths before implementing.

Focused owning command after failing-before fixture and correction, Core cwd, through heavy wrapper:

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/instruction-acts.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/lasting-acts-build.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/lasting-acts.test.ts
```

Supervisor owns authored architecture updates, narrow package checks/structure audit, paired checkpoint and next changed-source live run. No budget increase or new permission restriction is needed.

## Remaining assumptions
Active B's [] declarations, a2/a3 claims, four replay:step test calls and final excessive cart count were provided in a safe worker summary. Its actual cached consequence read is still unavailable; serialized full-instruction noncontainment must not be reported as measurement of gate quote contents. The report does not infer those cache contents from the cart count. Source provenance fixes a confirmed reproducible classification gap; it may not explain every observed mutation. Judge/execution-proof ambiguity remains the separate checked-retarget design and must not be conflated with repeated full-test execution.