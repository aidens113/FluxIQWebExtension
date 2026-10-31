# First-row toggle: explicit observed-state contract

Read-only investigation, 2026-10-30. No source changes, checks, browser runs, model calls or git operations.

## Decision

Use the existing `ensureState` parameter as the model's explicit choice of the state the instruction asks to leave. Accept it only when it exactly matches a bounded, domain-supplied signature tied to this step. Core supplies the matching stored object to the executable node. Core must stop treating the first press, an agreeing majority, a current state word, or a press's predicted result as task intent.

For a known toggle with no explicit choice, refuse the submission with the observed choices and let the model select one. This applies even when just one post-press signature is recorded: one observed transition does not establish the requested direction. Ordinary presses not known to be toggles keep their existing behavior. Keep this change in the existing `modify_existing` toggle scope; do not broaden consequence inference.

Preserving a same-control reversal means preserving an explicitly chosen state through subsequent opposite transitions. The old test's automatic first-click authority is implementation behavior, not a user rule. Its no-choice assertion must change. Once a state has been selected, a later reversal must not replace it, whether that reversal comes from the same control or another pass of the loop.

## Claims checked directly

- `flow-bootstrap/explored-toggles.ts:88-108` records succeeded, unskipped trial attempts by graph node, written step parameters and post-press signature. It stores no individual control/row identity and deduplicates repeated matching signatures. The graph parameters are authored bindings, not each pass's resolved parameters.
- `script-statements/toggle-tie.ts:72-89` returns `explored.find(...)`. Its matching rules establish which written step an observation belongs to; they do not establish the desired semantic state. Identity matching across renumbered steps, and matching only the toggle's own changed words, should remain.
- `script-statements/toggle-idempotent.ts:118-140` removes every model-written `ensureState`, then uses the first tied press or `lookedState(views)`. The latter uses `control.ensures`, not `control.state`.
- The public `llm/harness-options/binding.ts:516-524` explicitly defines `control.state` as the state shown and `control.ensures` as what pressing from that state would leave. Downstream `control-spot/control-view.ts:51-73` implements exactly that distinction. A pressed control currently reports `state: "pressed"` and `ensures: {...,to:false}`. Choosing the latter automatically can undo an already-satisfied control before any trial.
- `action-permissions.ts:621-627` independently overwrites exploration calls with the earliest tied signature. Fixing candidate submission alone leaves the same unsupported inference in live exploration.
- `executor/contracts.ts` has generic `outputs`, `inputs`, optional frame paths and optional `targetResolution`; the latter's `candidateId` is optional and has no contract proving durable per-control identity across loop passes. Saved inputs can also be deltas/withheld. Do not fabricate identity from an attempt number, row position, trial node, display row or selector guessed from these fields.
- `runtime/service/project-build-toggles/toggles-record.ts:104-115` explicitly copies recorded fields, and `runtime/project-agents/record/build-record-parser.ts:148-177` has a closed key list. A new pre-state field will be lost/rejected at reload unless both are updated.
- t799's native `photo-obstruction-toggle.spec.ts` first explores a correct Like and later proves idempotent skipping on that same post. It does not prove an already-satisfied first row, mixed trial-pass directions or model state selection. Its reported pass does not cover this defect.

## Small additive evidence contract

Keep `signature`'s existing meaning and shape. Add an optional pre-state signature; never redefine a post-press signature to mean the desired state:

```ts
// Exploration evidence.toggle and a trial attempt's outputs.toggle /
// outputs.result.toggle. Every signature remains an opaque JsonObject to Core.
toggle: {
  signature: afterSignature,
  beforeSignature?: beforeSignature,
  idempotentWith?: nodeId
}

// A resolved handle's existing CC9 control view.
control: {
  stateful: true,
  state?: shownStateWord,
  shown?: signatureOfTheStateActuallyShown,
  ensures?: signatureAPressWouldLeave,
  idempotentWith?: nodeId
}
```

`shown` is not another name for `ensures`. Each JSON object has the existing nonempty/plain-JSON/4,096-character bound; the state word keeps its current 40-character bound. Invalid optional evidence is dropped, never invented. If a present explicit selection cannot be grounded after that dropping, refuse it rather than falling through to another state's automatic choice.

Downstream owns producing the pre-state. At the existing before/after read, compute `afterSignature = webToggleSignatureOf(before, after)` and `beforeSignature = webToggleSignatureOf(after, before)`. Both readings must satisfy the existing same-control/same-document/succeeded/unskipped guards. Do not reverse attributes or `gains`/`loses` inside Core. The domain's `control-view.ts` can likewise supply `shown` from the stated attribute, or from whichever side of the learned word/class signature the actual reading shows. A state-holding role with no readable state still supplies only `stateful: true`.

Preserve the browser result's existing raw `toggle: WebToggleSignature`. Add optional `toggleBefore: WebToggleSignature` alongside it in `WebAutomationActionResult`; the extension already has both readings at `content/actions/click.ts:290-297`. `client/gateway-mapping.ts` parses both through `webToggleSignatureValue`, and `io/gateway-output-dispatcher.ts` wraps them as `{signature,beforeSignature,idempotentWith}`. Exploration `press-effect/toggle-signature.ts` emits the same wrapped form directly. `BrowserActionResult` is an alias of the domain result, so no duplicated extension protocol type is needed.

Carry `beforeSignature` through `AutomationStudioExploredToggle`, trial deduplication, the project build toggle type/parser/writer and restore path. Include it in deduplication so an after-only legacy observation cannot suppress a richer later observation. No executor trace-field addition, resolved-target identity, browser type in Core, or public test-contract change is needed.

## Selection and refusal behavior

1. Collect **all** observations tied by the current handle/whole-target/written-step rules. Keep the existing exact-vs-other-state and duplicate-step disambiguation; replace first-match selection with evidence collection. A signature from another step, another node or an unmatched trial binds nothing here.
2. Build the candidate states from the tied `signature`/`beforeSignature` pairs and this step's own CC9 `shown`/`ensures` pair. Deduplicate by canonical JSON/deep equality, never frequency. For complete pairs, order is irrelevant: `{A,B}` and `{B,A}` describe the same two states. Different complete pairs are conflicting evidence and must be refused, not voted on or silently reduced to their first member. An unpaired legacy observation outside the known pair is also a conflict; no inverse is manufactured for it. An after-only legacy signature remains evidence for that one state, not for an unknown opposite state.
3. Read the submitted `parameters.ensureState` **before** modifying parameters. It must be a bounded object exactly equal to an available state of this step. Preserve the exact stored observation, rather than trusting a model-created near match. A made-up value, another control's signature or a stale unmatched selection is refused as `candidate.toggle_state_unobserved`.
4. A known toggle without that choice is refused as `candidate.toggle_state_required`. A known stateful control with no readable signature, or irreconcilable state evidence, is refused as `candidate.toggle_state_unresolved`. An explicit choice does not cure contradictory evidence. If the node cannot take `ensureState`, retain `candidate.toggle_not_idempotent` and the supplied state-setting node guidance.
5. Apply the chosen signature unchanged to the loop body node, re-lay out and revalidate the executable/saved graph as submission already does. Every pass is held to that signature. A later press that reports the other member of the same pair cannot override the choice. Across a newly authored revision, omission requires a choice again; do not introduce a second implicit intent ledger. The saved Flow's executable `ensureState` remains its state on ordinary replay.
6. Apply the same grounded-choice reader to `action-permissions.ts` before dispatching a repeated exploration call. Missing/ungrounded choice returns an ordinary evidence refusal with `effectApplied:false` and `targetsUnchanged:true`; it is not a user permission request. A first previously unknown toggle press can still reveal its states. An admitted site-reset undo retains its current bypass and never becomes ordinary toggle-learning evidence.

Expose `ensureState` in the downstream click node's model-facing parameter catalog, with a description requiring an exact copy from observed choices. Add one generic sentence to Core's Flow script guidance; no new DSL syntax is necessary. The authoring value reader already accepts an object parameter as JSON, matching checks every declared parameter, and downstream handle resolution preserves unrelated parameters. The current hidden catalog test must deliberately change.

Use the existing issue `message`, `path` and `bindingRefusal` line/label mapping for answerable feedback. For example: `This step switches between observed states. Choose the state the instruction asks to leave. Write ensureState as an exact copy of one of these observed signatures: <bounded JSON choices>. A press may have begun with the control already in that state.` Label the choices as shown/before press/after press, optionally using the bounded domain state word. Do not label a choice correct, infer intent from the action's text or classifier, or ask the person to resolve a routine authoring choice. Limit the offered set to the coherent pair; for incompatible evidence report that incompatibility and require a fresh observation. This fits the existing feedback shape without expanding every bootstrap issue type.

## Exact ownership for implementation

Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/`:

- `runtime/flow-bootstrap/explored-toggles.ts`, `tests/explored-toggles.test.ts`; `script-statements/toggle-idempotent.ts`, `toggle-tie.ts`, `index.ts` and the three owning toggle test files. Put shared state-choice validation in new focused `script-statements/toggle-state-choice.ts` with `tests/toggle-state-choice.test.ts`, exported from that directory's barrel. Match collection and semantic selection stay separate.
- `runtime/flow-bootstrap/action-permissions.ts`, `tests/action-permissions.test.ts`; `candidate/submission.ts` for the refusal code selection instead of hard-coding every toggle error as `candidate.toggle_not_idempotent`; `candidate/tests/toggles/tests/submission-toggles.test.ts`, `submission-toggles-graph.test.ts`, `submission-toggles-undeclared.test.ts`.
- `runtime/llm/harness-options/binding.ts`, `plan-parameter-resolution.ts`, `tests/plan-parameter-resolution-control.test.ts` for optional bounded `shown`.
- `runtime/service/project-build-toggles/toggles-record.ts`, `tests/project-build-toggles-record.test.ts`; `runtime/project-agents/record/build-record.ts`, `build-record-parser.ts`, `tests/store.test.ts` for additive persisted `beforeSignature`.
- `runtime/service/candidate-trial/tests/already-in-state/tests/trial-toggles.test.ts` for actual attempt-to-record preservation; `runtime/flow-bootstrap/plan/flow-script-format.ts`, its owning format test, and `docs/architecture/automation-studio/llm-flow-bootstrap.md` for the changed authoring contract.

Downstream exact production paths:

- `domain/src/actions/toggle-signature/output.ts`, `domain/src/actions/types.ts`, `domain/src/actions/schemas.ts`.
- `domain/src/runtime/llm-evidence/node-run/press-effect/toggle-signature.ts`, `domain/src/runtime/llm-evidence/node-run/outcome.ts`, `domain/src/runtime/llm-evidence/control-spot/control-view.ts`.
- `domain/src/client/gateway-mapping.ts`, `domain/src/io/gateway-output-dispatcher.ts`, `domain/src/output-nodes/definitions.ts`.
- `apps/extension/src/content/actions/click.ts`.
- Owning tests: `domain/src/actions/toggle-signature/tests/toggle-signature.test.ts`; `domain/src/runtime/llm-evidence/node-run/press-effect/tests/press-toggle-signature.test.ts`; `domain/src/runtime/llm-evidence/plan-resolution/handle-control/tests/handle-view-control.test.ts`; `domain/src/client/tests/gateway-mapping-toggle.test.ts`; `domain/src/io/tests/gateway-output-dispatcher-toggle.test.ts`; `domain/src/output-nodes/tests/model-facing-catalog.test.ts`; `apps/extension/src/content/actions/tests/click/tests/press-toggle.test.ts` and `ensure-state.test.ts`.
- New native spec `apps/extension/e2e/site-reset/tests/photo-first-row-toggle.spec.ts`; authored `docs/architecture/build-loop.md` and `page-evidence.md` describe the paired evidence/choice contract. No scenario task, fixture, oracle or model-text allow-list edits are indicated.

This is additive in trace/wire/storage shape, but intentionally changes authoring behavior: a known toggle needs an explicit grounded state. Old records remain readable with unknown pre-state; do not invent one. Existing saved Flow runtime parameters keep their current meaning. Ship the Core/domain updates together: old Core's closed CC9 key validator would drop a `control` containing the new `shown` key, and old automatic polarity selection would still be wrong. The browser result's old `toggle` field remains compatible with old consumers; old consumers simply lack the new guarantee.

## Fail-first acceptance cases

- Opaque generic states `A`/`B`: trial passes `A -> B`, `B -> A`, `B -> A` on one loop step. No choice must refuse. Explicit `A` must be preserved and applied to every pass; explicit `B` must also be mechanically selectable, with semantic correctness left to task judgment. This proves Core did not vote for `A`, prefer first `B`, or classify the instruction.
- Permute pass order and repeat either direction many times; the same explicit choice gives the same plan. A one-row `A -> B` observation must allow choosing observed pre-state `A`; no choice still refuses.
- Same-control `A -> B -> A` exploration, then later reversed trial output: a selected `B` remains `B`. Update the old no-choice first-click test to provide the explicit selection. A repeated call missing a selection must not dispatch; a valid `ensureState:B` over a control already at `B` must skip without a new press. An admitted undo still reverses only the build's own act.
- CC9 `shown:A, ensures:B` with no press: choosing `A` skips an already-satisfied target; choosing `B` acts. Conflicting views, stateful-but-unknown views, another step's state and invented/oversized/malformed selections must refuse, without assigning a fallback polarity.
- Incompatible complete pairs `{A,B}`/`{A,C}`, an unpaired legacy signature outside a known pair, and unsupported `ensureState` nodes must refuse. Old after-only records do not acquire a fabricated opposite.
- Domain attribute/name/class observations carry both actual before and after signatures through exploration and extension -> parsed gateway payload -> dispatch -> attempt -> build record -> restore. Failure, skipped, navigation, removed target and unchanged control keep the existing evidence guards. Restored records still ground the same explicit choice.
- Verify selected state survives candidate re-layout, validation, graph execution and save. This is stronger than asserting the in-memory plan alone. Keep real domain `ensureState` skip/press tests as the runtime end of the contract.

## Realistic native provider-free proof

Use photo-social's existing `photo-social-newest-likes` task and exact final-state/nonempty three-link oracle. The fixture already supports Like/Unlike on the post action's labelled graphic (`client/post-script.ts:121-126`), and its honest `breadth/newest-likes/workflow.ts` identifies the three actual newest posts. Keep the pinned-post trap, task wording, oracle and other account state unchanged.

Create isolated scenario state through its UI with the first matching post already liked and the remaining matching posts unliked, before the build baseline is taken. First prove and capture those actual page states. Use the installed extension, real Core/domain gateway and existing scripted provider infrastructure from `photo-obstruction-toggle.spec.ts`; no direct browser-state injection or paid provider is needed.

Have the ordinary loop's first unguarded trial produce the mixed transition observations above. The next plain revision must receive an answerable state-choice refusal and must not become a runnable opposite-state loop. The scripted provider then chooses the actually observed state whose page presentation satisfies the instruction, copying the supplied signature rather than deriving an answer from row order or a majority. Repair the affected control live from the failed trial's retained site state, check from that step, and request the final judged whole run only once the Flow should work. The final graph must contain the selected `ensureState`, all three requested posts must end liked, the initially liked post must be preserved/restored as required, other account state must match the unchanged oracle, and the exact three-link dataset must pass. A zero-call replay must leave all three liked and show `already_in_state` rather than pressing them back.

Also assert the trial observation's real `beforeSignature`, the refusal's offered state signatures, the model-written selected value and the final executable parameter. Merely finishing with three liked posts could pass through manual setup alone and would not prove this fix. Record native headed Chromium, extension build target, isolated fixture state, zero paid calls and the final oracle result. Firefox launch remains a separate unverified compatibility limit unless exercised.

Proposed narrow native command, **not run**: `pnpm.cmd test:e2e -- site-reset/tests/photo-first-row-toggle.spec.ts --workers=1 --reporter=line`. Run owning unit tests, touched package typechecks, structure/model-text checks and documentation checks after implementation; no full sweep was requested for this investigation.

## Return contract

Outcome: Done
Changed: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-design.md`
Validation: not run (read-only exact-contract investigation; checks and browser execution expressly excluded)
Not verified: no implementation, fail-first execution, browser proof, package compatibility run or t811 acceptance claim; the proposed mixed-state native loop has not been authored or run
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-design.md`
Notes: Explicit observed-state choice replaces first-click/majority inference. Pre-state evidence must survive the closed persistence seam. Same-control reversal preserves the chosen state, not an unchosen first transition.
