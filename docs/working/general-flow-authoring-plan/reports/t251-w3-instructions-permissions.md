# t251-w3: build instructions and the permission data path

Core root: `C:/Users/osrs_/FluxStuff/!FluxIQ` at `424a70b3` (read only). `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.
Downstream: `C:/Users/osrs_/FluxStuff/fxwork/t251-general-flow-authoring` (`D` = `domain/src`).

## Outcome

Done. I found every file the brief names and quoted the sentences that matter. The permission path is traced from the `consequences` a `core.run_node` call declares to the gate. The main finding: **a stored Flow node keeps no `consequences`.** When the stored Flow runs, no gate checks each node. The only gate at run time is inside recovery.

## What changed and why

Nothing changed. This was an investigation, and the only file written is this report.

## A. What the build model is told, in the order it reaches the request

### A1. System message assembly
- `R/llm/deepseek/system-prompt.ts:51-57`: the message is built as core rules, then the domain text, then core task prose.
- `R/llm/deepseek/system-prompt.ts:70-80`: for `evidence_tool_decision` with no `stage`, `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` is pushed into the system message (line 78), followed by the compact-output line (line 36).
- A build is unstaged. No evidence-loop or flow-bootstrap caller sets `stage` (I grepped `R/llm/evidence-loop*`, `R/llm/decision-handlers` and `R/flow-bootstrap/*.ts`; the only `stage:` hits are the permission `stage: "authoring"` at `R/flow-bootstrap/action-permissions.ts:170`). So the stage instructions in `R/llm/stages/instructions.ts:73-79` are not sent in a build. The same policy text reaches staged requests through `R/llm/stages/instructions.ts:108-116`, using `R/llm/stages/registry.ts:147`.
- Domain text seam: `R/llm/domain-instructions/provider.ts` stamps `domainInstructions` on every request. `validate.ts` enforces the limit of 4,000 characters (`max-length.ts`).

### A2. Evidence-loop decision policy: `R/llm/evidence-loop-decision.ts:55`
These sentences make the model believe that every Flow step must be run live:
- "Your goal is to produce the final structured result, not to execute the workflow that result describes."
- "...except where a core.flow_draft entry is shown: then the result is a Flow you author, and it is ready only when every act on that entry's acts checklist is done by a step you added to the Flow."
- "Never mutate merely to perform an eventual workflow step that belongs in the generated result, **unless the result is a Flow built from the steps you run and add to it: then run each step it needs once and add it** (a look, a failed try or a detour is never added), and to do one act to every item of a list do it to one item and state repeat, rather than doing it to each".
- "Getting back to a state you were already in is not progress: only a step added to the Flow, or a state you had not reached, is."
- "...write the step you were not permitted to perform here into the result instead, from what you observed." In draft mode nothing can carry such a written step, because the draft overrides the reply (see A7).
- History comment: `R/llm/evidence-loop-decision.ts:49-54` (the "unless the result is a Flow built from the steps you run" clause, t195, 2026-09-30).

### A3. Decision schema, including `add` and `act`
- `R/llm/evidence-loop-decision.ts:257-287`: `buildAutomationStudioLlmEvidenceLoopDecisionSchema` defines three variants: `complete` (264-267), `amend_draft` (268-274) and one `tool_call` per tool (275-284). `add` and `act` appear only when `authoring` is true (282). Their explanation is attached to the first acting tool (261).
- `R/llm/evidence-loop-decision.ts:291` `add`: "true: if this call works, put its step into the Flow now. **A step you run is not in the Flow until you add it**, here or with amend_draft add. Leave it out for a look, a try or a step the Flow does not need."
- `:292` `act`: "The act from the acts checklist this step does ... Implies add." The parser treats `act` as implying add at `:364-368`.
- `authoring` defaults to on: `R/llm/evidence-loop.ts:191` (`input.draftAuthoring !== "transcript"`).

### A4. `amend_draft` grammar: `R/flow-draft/amendment.ts`
- `:69` changes: `add, drop, exploratory, keep, reorder, rerun, optional, only_if, on_failed, repeat`. No change can insert a step that was not run.
- `:163` `change` description: "add: put this step you ran into the Flow -- a step you run is not in the Flow until you add it ... rerun: do it again with input's changes; the run replaces this step ... repeat: do this step, through the one given by through, once for each row the step given by over produced". It also gives the three-step list recipe: listing with `where`, then the act on one row, then repeat.
- `:167` `input`: "rerun only: a JSON merge patch over the argument the step ran with." This is the only way to change a step's parameters, and it reruns the step live.
- `:165` `settings`: "Settings to carry on the step, merged over any it already has." Settings can be changed without a run.

### A5. The draft entry the model reads: `R/flow-draft/entry.ts`
- Selected at `:90`. `authored` comes from `R/llm/evidence-loop.ts:651` and is wired through `R/llm/decision-context/shown.ts:37`.
- `AUTHORED_INSTRUCTION` (`:60`, the default): "The Flow you are authoring. **Every step you run is listed here as evidence (disposition taken) and is not in the Flow until you add it** ... Add only what the finished Flow needs ... Never add a look, a failed try, a detour, or a second copy of a step already added ... To do one act to every item of a list, three steps in this order: add the step listing them ...; do the act to one row it kept -- press that row's own control -- and add that press with its act; then send amend_draft {"step": <that press>, "change": "repeat", "over": <the listing>} ... Complete when the Flow does what the person asked: it is then tested from its start and judged on what it does".
- `DRAFT_INSTRUCTION` (`:53`, the transcript mode): "The Flow you are building ...: **every step here is something you actually ran, with the argument it ran with** ... **A step you want and have not run yet is run, not written.**"
- Each step line is built at `:95-139`. It shows `input` (the argument the step ran with, `:99`), `does`, `changed`, `disposition`, `inResult`, `act`, `replayed`, `runs` (routing) and `settings`. No field names a Flow input or a binding.

### A6. `core.run_node`: `R/llm/node-tools/run-node.ts`
- Description, `:62-81`:
  - "Run one node from the library against the live target, now, and get back what it really did: **the same node, with the same parameters, that the finished Flow runs.**" (`:63`)
  - "Where a node acts on something you observed, name it under `target` as {"handle": ...} and nothing else. Never write a locator ...: a step that names something you did not observe is refused." (`:65`)
  - "**A step you add keeps the parameters it ran with.**" (`:73`)
  - "Judge `consequences` for this node, not the Flow: [] when it only reads, and in one Flow the press that applies a filter or opens checkout is [] and the press that submits the post is send_or_publish." (`:80`)
- Input schema, `:120-135`: `required: ["node","parameters","consequences"]`. `node` is an enum of every registry id (`:109`). `parameters` is "That node's own parameters, exactly as its definition in flowBootstrap.describedNodes declares them." (`:126`). `consequences` is an array of at most 5 unique items from the `AUTOMATION_STUDIO_ACTION_CONSEQUENCES` enum (`:127-133`), described as "What running this node would lastingly do. [] leaves nothing behind; a press that submits, orders, deletes or changes something saved names its class ... and is put to the person first."
- `effect: "mutate"` and `perCallEffect: true` (`:115-116`). The arrival call declares `consequences: []` (`:144`).
- History of the "exploratory output is the same nodes" design: header comment, `:4-11`.

### A7. `core.describe_nodes` and node descriptions
- `R/llm/node-tools/describe-nodes.ts:27-30`: "Show the full definitions of library nodes ... Ask once, before running them ... Returns a receipt; the definitions are shown there. **Observes only; never a step of the Flow.**" Input `ids` is at `:46-61`.
- `R/llm/node-tools/node-descriptions.ts:45-72` keeps the described-node memory for one build. The definitions come from `buildAutomationStudioFlowBootstrapContext(...).nodeCatalog` (`:52-53`). This file contains no prose.

### A8. Completion: the draft overrides the reply
- `R/llm/harness-options/bootstrap-completion.ts:196-204` (doc on `draftSteps`): "Given, it is authoritative: the plan is assembled from the steps that ran and worked and that the model kept, and any plan the reply happens to carry is ignored ... a Flow whose steps are nodes that provably ran cannot contain one that never did."
- `:239-242`: "The draft wins wherever there is one."
- `:465` `DRAFT_SCRIPT_NOTE`, shown on refusal: "The Flow is the steps in your draft that are in the Flow. Correct it with amend_draft decisions -- add, drop, reorder, rerun, repeat -- or run the step it is missing and add it, then finish again."
- `:442`: the default summary is "Flow built from the steps that ran."
- The script path, used only when there is no draft, says the opposite: `R/flow-bootstrap/plan/flow-script-format.ts:99` ("A step may act, not only read ... The tools you were given while gathering evidence are for looking; one refusing to act ... "), and `:100` adds the `consequences:` line rule.

### A9. `amend_draft` feedback: `R/llm/draft-amendment-feedback.ts`
- Refusal reasons are at `:63-77`. The run-only ones:
  - `run_by_the_loop` (`:67`): "A rerun is carried out by the loop rather than written onto the draft ... A rerun needs an input saying what changes in the step's argument".
  - `not_a_kept_step` (`:70`): "Routing describes the Flow, so it may only name steps the Flow runs."
  - `did_not_work` (`:72`): "The only amendment that changes it is rerun with a corrected argument; or run the action again as a new call."
  - `over_not_before` (`:69`): "When no step does the act to a row yet, do it to one row the listing kept and add it first: there is nothing to repeat until then."
  - `act_on_a_read` (`:75`).
- Wrapper sentences: `:79-81` ("A decision whose amendments all change nothing counts toward stopping this exploration."), `:89` and `:93`.

### A10. Web domain system instructions: `D/runtime/llm-evidence/system-instructions/instructions.ts:28-47` (version `web-3`)
- `:31`: "You operate a real website in the person's own browser ... to build a Flow that does their instruction on that site."
- `:41`: "Lists. Do each act once, on one item. To do it to every item of a list, do it to one item and state repeat."
- `:43`: "Limits. Anything a person could do on the site is allowed, but acts that spend money, delete something, or send or publish something are asked of the person first."
- The domain text never says that steps must run. It reinforces "do it to one item" and leaves the rule about adding steps to Core.

### A11. Other context prose
- `R/llm/decision-context/compression.ts:21`: the history entry instruction. It says nothing about authoring.

### Summary of the "run it to have it" chain
- `run-node.ts:63,73` ties a step's parameters to the call that ran.
- `evidence-loop-decision.ts:55,291` makes adding depend on running.
- `amendment.ts:69,163,167` has no change that writes an unrun step, and rerun means running again.
- `entry.ts:53` says "A step you want and have not run yet is run, not written".
- `bootstrap-completion.ts:196-204,239` ignores any plan in the reply.

There is no vocabulary anywhere for a step that names a Flow input, an earlier output, or the current row.

## B. Permissions: from declaration to gate

1. **Declaration.** The model writes `consequences` on the `core.run_node` input (`R/llm/node-tools/run-node.ts:123,127-133`). The class list and its order are in `R/action-permissions/consequences.ts:47-58`. Phrases for a person are at `:67-73`. A permitted set fails closed: `:90-98`.
2. **Exploration-time check.** The build wraps `executeTool` so that each call carries a permission check made by `gate.checkFor({kind:"exploration_step"})` (`R/flow-bootstrap/action-permissions.ts:211-218`). The gate is constructed with `stage:"authoring"` and the run's `permittedConsequences` (`:168-177`), and is wired in `R/service.ts:1555`. The ask/settle loop that puts a request to a person is at `:190-209`.
3. **Domain validates and calls the check.** `D/runtime/llm-evidence/node-run/run.ts:298-302` refuses a mutating node whose `consequences` is missing or null (`missing_input_keys`). `:303-312` calls `webActionPermission` with `effect: node.effect`. Refusals are at `:313-320` (`consequences_unreadable`, `nobody_to_ask`, `consequences_declined`, `consequences_not_granted`). `webActionPermission` is at `D/runtime/llm-evidence/permission.ts:83-124`: a declaration that is not an array of known classes is `invalid` (`:104`); with no check, destructive classes are refused (`:115-118`); otherwise it calls `check({consequences, control, verb, effect})` (`:121`). Replays of draft steps go through the same path: `D/runtime/llm-evidence/node-run/replay.ts:261-263`.
4. **Core reads and decides.** `readAutomationStudioActionDeclaration` (`R/action-permissions/declaration.ts:143-164`) checks the shape, the classes and the effect, defaulting to `mutate`. `gate.checkFor` (`R/action-permissions/gate.ts:292-385`):
   - `effect:"observe"` turns the classes into `disregarded` (`:300-302`).
   - `[]` is permitted and recorded (`:329`).
   - Only the destructive classes `move_money`, `delete` and `send_or_publish` can be refused (`R/action-permissions/destructive.ts:12-22`, `gate.ts:358`).
   - A press a person already declined is refused again by control name (`:350-357`).
   - Otherwise a request is raised (`:364-385`).
   - Every verdict becomes a declaration record (`:304-321`).
5. **Into the draft step.** The domain writes the call back with `consequences` only when the call had one (`D/runtime/llm-evidence/node-run/run.ts:684-698`, `nodeCall`). The value becomes the draft step's `input.consequences`.
6. **Draft step to plan node.** `R/llm/node-tools/draft-step.ts:57-67` turns `step.input.consequences` into a reserved script entry, `consequences: a, b` or `none`. `R/flow-bootstrap/authoring/assemble.ts:319-322` reads it through `isAuthoringConsequenceKey`/`readAuthoringConsequences` (`R/flow-bootstrap/authoring/consequences.ts:34-55`) and sets `consequences` on the plan node (`assemble.ts:359`). The same path exists in `normalise.ts:63-65` and in `json-plan.ts:340-342` for nested plans. The plan contract field is `R/flow-bootstrap/plan/contracts.ts:28`, and parsing bounds it at `R/flow-bootstrap/plan/parsing.ts:116-119`.
7. **Plan-time (flow_step) gate.** `R/llm/harness-options/plan-parameter-resolution.ts:148` reads `automationStudioPlanStepConsequences(node)` (`R/llm/harness-options/plan-step-consequences.ts:71-81`, which also strips the key from the parameters). It passes `declaredConsequences` and `permission` to the domain's `resolvePlanNodeParameters` (`plan-parameter-resolution.ts:171-179`; contract at `R/llm/harness-options/binding.ts:322-348`). The `permission` there is `planStep` with `kind:"flow_step"` (`R/flow-bootstrap/action-permissions.ts:220-229`); a refusal aborts the plan. The domain answers in `D/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:375-390` using `webPlanStepPermission` (`D/runtime/llm-evidence/plan-resolution/step-permission.ts:122-140`). Click, keypress and dialog must declare (`:79-81,110,128`); undeclared gives `web.step.consequences_undeclared`. Steps already gated by the caller skip this (`gatedByCaller`, `node-run/run.ts:244-253`).
8. **What the written Flow node carries.** Nothing. `R/flow-bootstrap/adaptation.ts:208-224` builds each Flow node from `definitionId`, `definitionVersion`, `parameterValues`, `position` and `metadata` (`bootstrapAdaptationId`, `bootstrapSymbolicKey`, `outputActionId`, `routeSignatures`). `consequences` is dropped, and was already stripped from the parameters at step 7. What persists is at proposal and Flow level:
   - `declaredConsequences` (gate records) and `instructedConsequences` on the adaptation (`R/flow-bootstrap/adaptation.ts:120-127`; written in `R/service.ts:1777`).
   - On apply, only `instructedConsequences` is copied to the Flow as `metadata.bootstrapInstructedConsequences` (`R/service.ts:3529-3530`).
9. **Gate when the stored Flow runs.** The gate is constructed in only three places: build (`R/flow-bootstrap/action-permissions.ts:168`), recovery annotation (`R/recovery/annotation/permissions.ts:82`) and runtime exploration (`R/recovery/runtime-exploration.ts:449`). `AutomationStudioActionPermissionStage` is `"authoring" | "recovery"` (`R/action-permissions/request.ts:31`).
   - A normal run takes `permittedConsequences` (`R/service.ts:2504-2513`) and forwards it only to recovery and repair (`runLlm`, `:2549,2671,2729`).
   - The recovery gate reads the run's `permittedConsequences` and the Flow's `metadata.bootstrapInstructedConsequences`, keeping an entry only while its instruction is active and unchanged (`R/recovery/annotation/permissions.ts:59-91`, `R/recovery/annotation/annotate.ts:338-339`).
   - `R/executor` has no permission references (grep for "permission" found nothing outside tests), and the downstream native runtime has none outside `llm-evidence`. So a stored press runs without any per-node gate, and nothing on the node says what it would do.

## Commands run and observed results
These were read-only `sed`/`grep`/`cat` calls on the files above. Notable observations: the grep for `stage:` in the evidence-loop and flow-bootstrap callers returned only the permission-stage hits. The grep for `permission` under `R/executor` returned no files. The grep for `consequences` in `D` matched only files under `runtime/llm-evidence`, plus `page-evidence/capture.ts`.

## Not verified
- I did not run anything, so no request bundle was inspected. The order of the system prompt comes from the code, not from a captured request.
- I did not trace `instructedConsequences` derivation (`deriveInstructed`) or the cross-check (`R/action-permissions/cross-check.ts`, `instructed.ts`) beyond their call sites (`R/flow-bootstrap/action-permissions.ts:234-242`).
- I did not inspect the recovery patch path (`AUTOMATION_STUDIO_RUNTIME_PATCH_CONSEQUENCES_INSTRUCTION`, `R/llm/deepseek/system-prompt.ts:16,83`) beyond the prompt line.
- I only spot-checked `R/llm/harness-options/bootstrap-completion.ts` at the cited lines.

## Open questions or contradictions found
- Contradiction: the policy tells the model to "write the step you were not permitted to perform here into the result instead" (`evidence-loop-decision.ts:55`), but in draft mode any plan in the reply is ignored (`bootstrap-completion.ts:196-204`). Nothing can carry an unrun step.
- A general (unrun or bound) step would have no `consequences` from a run. Today the declaration comes only from the run call (step 5) or a script line (step 6). A design for authored steps needs its own way to declare consequences that reaches the step 7 gate.
- At run time nothing checks node-level consequences (step 9). If general steps are meant to be gated when they run, that requires a new place to store the declaration, because the node currently drops it at `adaptation.ts:208-224`.
