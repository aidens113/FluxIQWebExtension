# w2x-existing-flow-and-repair-design

Worker report, 2026-09-21. Read-only design; nothing in either repository was
changed except this file.

Reference trees: Core `F:\fxwork\t027\!FluxIQ` (HEAD `2dcf06b`) and downstream
`F:\fxwork\t027\!FluxIQWebExtension` (t027, ahead of `dev`). Every line number
below is in those trees. Prefixes: `AS/` = `packages/fluxiq/src/programs/automation-studio/`,
`web/` = Core `apps/web/src/features/automation-studio/`,
`TR/` = downstream `packages/test-runner/src/`.

## Outcome

Done. All five items are designed down to file:line. The work is split into 13
slices (8 Core, 1 Core-web pair, 4 downstream) with an ownership table and an
order. Three things I found in the source change the shape of the work, and the
supervisor should know them before dispatching:

1. **Item 4 is not dropped where the brief says.** `patches.ts:142-145` only
   sends the patch to `executeAutomationStudioRuntimePatch`. The refusal happens
   in its preflight, at `AS/runtime/live-patch.ts:140-141`. That code treats
   every target override and action sequence as a side effect (`live-patch.ts:550-552`).
   The default policy has `allowExternalSideEffects: false`
   (`AS/model/flows.ts:257`, `AS/runtime/service.ts:6230`), and a granted run
   forces `authorizedExternalSideEffects: false` (`service.ts:3095`). So under
   `explore_and_adapt`, every target override ends as `preflightOk: false`, and
   nobody is asked.
2. **Recovery exploration can never press, type or navigate under the default
   policy.** `AS/runtime/llm/harness-options/registry.ts:270-276` withholds every
   `mutate` option when `policy.allowExternalSideEffects` is false, and neither
   the Lab nor the panel ever sets it. That covers all three of the web domain's
   acting recovery options (`domain/src/runtime/llm-evidence/harness-options/options.ts:79-126`).
   t018's recovery gate (`AS/runtime/recovery/runtime-exploration.ts:187-192`)
   therefore cannot fire on a press. Item 3 fixes this, and it changes what a
   policy flag means.
3. **t027 Core's `service.ts` is 6,441 lines, against a ratchet of 6,404.**
   Both figures are committed (`git show HEAD:...service.ts | wc -l` gives 6441;
   `.structure-baseline.json:154` holds 6404). Every slice that edits
   `service.ts` must shrink it. Slice C0 moves about 135 lines out to create room.

Two gaps also block the live proofs, and each gets a downstream slice. First,
nothing downstream can issue a grant that carries `permittedConsequences`: there
is no reference to it anywhere in `apps`, `packages` or `scripts`. Second,
`pnpm lab replay` never carries a grant (`TR/saved-flow-replay/replay-saved-flow.ts:170`),
so the Lab cannot repair or revise a saved Flow.

## What changed and why

The only file created is this report. The design follows.

### Findings the design rests on (each read in source)

- **F1. Non-blank Flows are refused in three places.** Generation calls
  `assertBlankBootstrapTarget` at `service.ts:1850-1852`, proposal creation at
  `:2054`, and apply at `:4103`. The check itself is at `service.ts:4062-4071`.
  Revert (`service.ts:4219-4275`) deletes the whole Router and every Subflow the
  bootstrap created.
- **F2. The contract already has room for the third entry point, but nothing
  fills it.** `AutomationStudioBootstrapAdaptationMode = "create" | "extend"`
  (`AS/runtime/flow-bootstrap/adaptation.ts:20-25`) is declared, but `extend` is
  never used. `origin` already allows `entryPoint: "instruction" | "edge_case"`
  (`adaptation.ts:27-28`, `AS/model/flow-adaptation.ts:388-391`). In the routing
  context, `current` carries only step counts, not the steps themselves
  (`AS/runtime/flow-bootstrap/plan/routing-context.ts:46-51`). `lastRoute`
  (`:53-59`) is never filled, and `startAutomationStudioBuildRouting` hard-codes
  "The Flow is blank" (`AS/runtime/route-state.ts:142`).
- **F3. The run's grant set never reaches recovery.** The runtime session grant
  carries no permission set (`AS/runtime/llm/runtime-session-grant.ts:45-50`).
  The stored grant does have one (`AS/runtime/llm/execution-grants.ts:139-140`),
  but `resolve()` does not return it (`execution-grants.ts:375-384,455-464`).
  `runtime-exploration.ts:114-122` accepts `permittedConsequences`,
  `instructionIds` and `shownEvidence`, but its only caller,
  `AS/runtime/recovery/annotation/exploration.ts:203-218`, passes none of them.
- **F4. Result verification makes one call, by design.** `verify_result` is
  `iterates: false` (`AS/runtime/llm/grant-capabilities.ts:118-120`, whose
  comment says a second ask "would buy the same answer twice"). A grant for a
  purpose that does not iterate is held to exactly one call
  (`execution-grants.ts:212-214`). The Lab's created-Flow playback runs under
  `diagnose_and_adapt` (`TR/live-llm/live-llm-run.ts:71`), which iterates, so the
  Lab proof of item 5 does not need the grant change.
- **F5. The panel cannot start an `explore_and_adapt` run.**
  `web/runtime/run-input-model.ts:2` allows only `diagnosis_only` and
  `diagnose_and_adapt`.
- **F6. `deepseek-provider.ts` has no room.** It is 799 lines in t027 and 800 in
  t033, against an 800-line file limit (`scripts/structure-audit/context.mjs:46`).
  Any schema addition must first move the patch schemas out.
- **F7. The domain never checks permission for a Flow step.** Core hands a check
  to each plan step (`AS/runtime/llm/harness-options/plan-parameter-resolution.ts:72`),
  but the web resolver ignores it (`domain/src/runtime/llm-evidence/tools.ts:420-422`).
  The second half of t018's integration note was never done. It is out of scope
  here, but it matters for item 1: a revision that adds an acting step is never
  gated.
- **F8. t033 edits many files these slices also edit.** On the Core side:
  `runtime-exploration.ts`, `llm/harness/{structured-response,provider-result,output-validation,run,task-request}.ts`,
  `deepseek-provider.ts`, `flow-bootstrap/{action-permissions,generation-failure}.ts`,
  `api/handlers/llm-generation.ts` and `service.ts`. Every slice below therefore
  starts after t027 and t033 have reached `dev`.

### Item 1 — improving an existing Flow (the third entry point)

**Design.** Use one generator, as t020 designed it:
`generateFlowBootstrapAdaptation` with `revise?: { fromRunId?: string }`.

- Without `fromRunId`, it is an improvement driven by an instruction. The new
  instructions are the active instructions not listed in the parent's
  `metadata.bootstrapSourceInstructionIds`, and the origin is
  `{ entryPoint: "instruction", instructionIds }`.
- With `fromRunId`, it is an edge case or a repair, and the origin is
  `{ entryPoint: "edge_case", instructionIds, runId, failureSignature }`.

The grant stays `build_and_adapt`. The host resolver already narrows that
purpose to `flow_bootstrap` and `evidence_tool_decision`
(`programs/_shared/runtime.ts:86-88`), which is exactly what a revision needs,
so no new purpose is required.

**How the model sees the current Flow.** A new module,
`AS/runtime/flow-bootstrap/revision/render.ts`, renders the Router and each
active Subflow back into a Flow script:

- `subflow <label>:` blocks, with each `when:` written back from the rule's
  condition (the inverse of `authoring/condition.ts`);
- each step as `step <ref>: <node label or catalog title>`, `node: <definitionId>`,
  and its parameter **names only**, never values, because resolved steps hold
  selectors (t020's rule);
- `on <port>: go to <ref>` for edges that are not a straight fall-through.

A ref is `<block>.s<n>`, for example `main.s2`. The renderer refuses what it
cannot express (a cycle, two entry points, a node missing from the catalog, or a
script over its 4,000-byte budget) with `flow_bootstrap.revise_shape_unsupported`.

**What the model answers.** The whole revised script. `step: keep <ref>` keeps a
step. Inside its own block, a kept step keeps its node id and provenance. Inside
a different block, the node and its resolved parameters are copied under a new
id with `metadata.revisionCopiedFrom`. New steps are written as usual. A new
block adds a route and a Subflow. A block left out is retired.

**Where each change lands.**

| # | Site | Change |
|---|---|---|
| 1 | `service.ts:1850-1852` | With `revise`, call new `revision/target.ts` `loadAutomationStudioRevisableFlow` instead of the blank check. It needs an orchestration Flow with an active Router and at least one active Subflow. A blank Flow asked to revise is refused with `flow_bootstrap.revise_target_blank`. |
| 2 | `route-state.ts:130-143`; `service.ts:1909` | `startAutomationStudioBuildRouting` gains optional `current` and `lastRoute`, defaulting to today's blank sentence. The service passes the rendered structure. |
| 3 | `plan/routing-context.ts:46-51` | `AutomationStudioFlowBootstrapCurrentStructure` gains `script: string`, which counts inside the routing `maxBytes`. |
| 4 | `plan/flow-script-format.ts:57-75` | Two lines on revising (`keep`, retiring by omission, a new block adds a route) plus a four-line example. The pinned catalog byte budget test (5,118 at t020) must move with it. |
| 5 | `authoring/parse.ts:136-147`; `authoring/contracts.ts:28-40` | `startStep` reads `keep <ref>` into a new step field, `keeps?: string`. |
| 6 | `authoring/assemble.ts:211-218`; `plan/contracts.ts:11-17` | A kept step becomes a plan node `{ key, definitionId, keep: { nodeId } }` with no parameters. An unknown ref is refused (`flow_script.keep_unknown_step`), and so is a ref kept twice in one block. |
| 7 | `plan/validation.ts`; `llm/harness-options/plan-parameter-resolution.ts:70-80` | Kept nodes are skipped. Their parameters are already resolved and must never be resolved again from handles. |
| 8 | new `revision/diff.ts` | `AutomationStudioFlowRevisionDiff`: routes added, changed and removed; Subflows added, edited, retired and unchanged; steps added, removed and kept per Subflow. A revision that changes nothing is refused (`flow_bootstrap.revision_no_change`). |
| 9 | new `revision/topology.ts` | Normalizes the extension. The Router is patched in place: same `routerId`, unchanged rules keep their `ruleId`. Edited graphs keep their `graphFlowId`. New nodes get `node.revision.<ns>.<subflow>.<key>` and `withAutomationStudioNodeAdaptationId`. New Subflows are built as `normalizeAutomationStudioFlowBuildPlan` builds them (`adaptation.ts:118-263`). |
| 10 | `adaptation.ts:82-116`; `service.ts:2006-2019,2054` | The record gains `revision?: { fromRunId?, diff, baseDigest }`, `mode: "extend"` and `origin`. Proposal creation accepts a revisable target. |
| 11 | `service.ts:4103`, `2148`, `4219`; new `revision/apply.ts`, `revision/revert.ts` | When `mode === "extend"`, apply and revert branch into the new modules, which work through ports and stay out of `service.ts`. Apply re-checks `baseDependencyDigest` as `4104-4107` does. It stores `application.revisionBefore = { router, graphs, subflowStatuses, parentMetadata }` and merges any newly instructed consequences into `bootstrapInstructedConsequences`. Revert refuses if the digest changed after apply (as `4224-4227` does), then restores the before-state and deletes the Subflows the revision created. |
| 12 | review projection (`service.ts:6046-6128`, moved by C0 into `flow-bootstrap/review-projection.ts`) | For `extend`, it emits `edit_router` with before and after rule lists, `create_subflow`, `edit_subflow` with before and after step lists, and `retire_subflow`. `web/adaptations/AdaptationChangeCard.tsx:17-41` already renders before-and-after field diffs, so the person sees a diff with no new review component. |
| 13 | `AS/api/handlers/llm-generation.ts:149-157,115-132`; `AS/api/contracts/adaptation.ts:108-114`; `service.ts:1828` | Allow the `revise` field. `fromRunId` is validated as a bounded id and passed through. |
| 14 | `flow-bootstrap/generation-failure.ts:70` | New codes: `revise_target_blank`, `revise_shape_unsupported`, `revision_no_change` and `revision_out_of_scope`. |

**Contract changes.**
- The generation request gains `revise`.
- The bootstrap adaptation gains `revision`; `mode: "extend"` is used for the first time.
- The routing context's current structure gains `script`, and `lastRoute` is filled.
- Plan nodes gain `keep`.
- The review projection gains `edit_subflow` and `retire_subflow` entries.

**What the person sees** (slice CU2).
- A new panel, `web/authoring/ExistingFlowRevisionPanel.tsx`, with its model
  `existing-flow-revision-model.ts`. It is mounted beside
  `BlankFlowAuthoringPanel` at `web/runtime/FlowRunView.tsx:208`, for Flows the
  blank check (`web/authoring/blank-flow-authoring-model.ts:93-104`) rejects.
- It asks "What should this Flow also handle?", saves the instruction, issues a
  `build_and_adapt` grant (reusing t027's permission-continuation logic in
  `BlankFlowAuthoringPanel.tsx`), calls generate with `revise: {}`, and opens
  the proposal.
- `web/authoring/authoring-commands.ts:8-9` and `web/runtime/runtime-host.ts:56,100`
  gain `revise`.
- `web/adaptations/AdaptationsView.tsx:250-258` shows the diff, with a new
  `FlowRevisionDiff.tsx` for the step lists.

**Live proof** (slice DL, the Lab lane).
1. In a persistent workspace, build `social-scheduler-whole-queue` with
   `create-flow` and apply it.
2. Run the existing `edit-flow` task kind (`packages/test-contracts/src/llm.ts:32`)
   with the `social-scheduler-week-ahead` instruction.
3. The diff should show the reading steps kept and the narrowing steps added.
4. Apply, then run `pnpm lab replay social-scheduler --workspace <ws> --flow <id> --instruction-task social-scheduler-week-ahead`
   with no key.

Pass means `matchedRecords 14 / expectedRecords 14`, `build.providerCalls`
equal to `observed.calls` in `live-llm.json`, and a replay that makes no provider
call.

### Item 2 — a repair that edits the Flow's structure, shown as a diff

**Design.** There are two halves.

- **(a) The engine is item 1's** (slice CF). A repair is the same generator with
  `revise.fromRunId`.
- **(b) Recovery must be able to say "this needs a Flow change"** instead of
  offering only a target override, and a revision must stay within what the
  failed run actually touched (slice CG).

**Sites for half (b).**
- `AS/runtime/llm/harness/structured-response.ts:33-39`: add a no-repair reason,
  `step_missing: "the page now needs a step the Flow does not have"`. The
  sentence that teaches the model its reasons lives in `deepseek-provider.ts:57`
  and is edited on the same line.
- `AS/runtime/recovery/plan.ts:50-53`: a new plan-step action,
  `request_revision`. At `:186-206`, the two structural candidate kinds
  (`subflow_edit_or_create`, `router_rule_edit`; see `:87-95`) add it.
- `AS/runtime/recovery/annotation/annotate.ts:348,377-405`: when the model
  declines with `step_missing`, or the plan holds `request_revision` and no
  patch ran, the run detail records
  `metadata.revisionNeeded = { runId, failedNodeId, failureSignature, subflowId?, route: <summary of routeDecisions[0]>, reason }`
  and the trace records the code `llm.revision_needed`. No proposal is created
  yet: the generator needs a `build_and_adapt` grant, which is a new decision by
  the person.
- New `AS/runtime/flow-bootstrap/revision/scope.ts` holds the repair scope.
  - It reads the failed run's `routeDecisions[0]`, the field `AS/model/flow-adaptation.ts:353`
    defines.
  - It refuses a diff that edits or retires a Subflow or route the run did not
    take (`flow_bootstrap.revision_out_of_scope`).
  - It allows a new route with its Subflow, and allows edits to the Subflow the
    run took.
  - It runs inside the completion check, so the model can correct itself rather
    than the build ending: `AS/runtime/llm/harness-options/bootstrap-completion.ts:81-113`
    gains a `revision?` input, wired at `service.ts:1926-1930`.
- `revision/render.ts` also fills `AutomationStudioFlowBootstrapLastRoute`
  (`routing-context.ts:53-59`) from `routeDecisions[0]`.

**Contract changes.**
- The no-repair reason list gains `step_missing`.
- Recovery plans gain `request_revision`.
- The run detail gains `metadata.revisionNeeded`.

**What the person sees.** `RuntimePostRunSummary` (`web/runtime/FlowRunView.tsx:346-364`)
shows "This failure needs a change to the Flow" with a **Revise Flow** button.
The button opens `ExistingFlowRevisionPanel` with `fromRunId` already set. The
diff is shown exactly as in item 1.

**Downstream.** `TR/flow-lane/repair/run-repair-lane.ts` and `judge-repair.ts`
must read `revisionNeeded` as an outcome in its own right, neither a refusal nor
a repair. The saved-Flow revision lane (DL) consumes it.

**Live proof.**
1. Build `social-scheduler-week-ahead` in a persistent workspace. Its instruction
   says nothing about announcements, so the Flow has no route.
2. Replay it deterministically with `--instruction-task social-scheduler-week-ahead-whats-new`.
   It fails, because the dialog stands in front of the queue.
3. Run `--llm-task repair` on that replay. The run records `revisionNeeded`.
4. Run `edit-flow` with `revise.fromRunId`. The diff should show one route added
   (`when: state.page.dialog exists`), one new Subflow that closes the dialog and
   copies main's steps with `keep main.sN`, and main left unchanged.
5. Apply. Replay both `-whats-new` and `-no-announcement` with no key.

Pass means 14 of 14 `matchedRecords` on each rendering, `run.route` showing rule
r1 on whats-new and the fallback on the baseline, and no provider call in either
replay. That is t020's proven end state (`w2-routing-and-subflows.md`),
reached this time through a repair instead of a build.

### Item 3 — recovery receives the permitted set

**Design.** Build one permission gate per recovery. Both the exploration and the
patch stage use it (the design `AS/runtime/action-permissions/gate.ts:4` states:
"One gate per run"). Its authority is the grant's set plus the Flow's stored,
still-current instructed set. Recovery never asks a model to read instructions
for consequences; it reads what the build stored and fails closed on any entry
whose instruction has changed.

| Site | Change |
|---|---|
| `AS/runtime/llm/execution-grants.ts:375-384,455-464` | `resolve()` also returns `permittedConsequences: [...grant.permittedConsequences]`. |
| `AutomationStudioLlmProviderResolution` (`service.ts:391-400`, moved by C0 to `AS/runtime/llm/provider-resolution.ts`) | Gains `permittedConsequences?: readonly AutomationStudioActionConsequence[]`. The host resolver (`programs/_shared/runtime.ts:79-93`) passes `resolve()` straight through, so no host edit is needed. |
| new `AS/runtime/recovery/annotation/permissions.ts` | `automationStudioRecoveryPermissionGate({ granted, storedInstructed, instructions, failureEvidence, now })` builds one `AutomationStudioActionPermissionGate`: `stage: "recovery"`; `instructed` from `currentAutomationStudioInstructedConsequences({ stored, activeInstructions }).current` (`action-permissions/instructed.ts:127-140`); `instructionIds`; then `observe(failureEvidence)`. It returns `{ gate, summary() }`, where the summary is classes only: `{ granted, instructed, lapsed }`. |
| `recovery/annotation/ports.ts:61`; `service.ts:2891`; `annotate.ts:271` | The port `flowScope` becomes `flowForRecovery(projectId, flowId): Promise<{ scope; metadata? } \| undefined>`, so annotate can read the parent Flow's `bootstrapInstructedConsequences`. That set is stored on the parent at `service.ts:4160`; the subflow graph that ran does not carry it. This edit belongs to C0. |
| `recovery/annotation/annotate.ts:155-216,252-308,382-407` | Build the gate once the provider has resolved. Pass it to the exploration. If `gate.request` is set afterwards, skip the patch call (`patchSkippedCode: "llm.runtime_patch_permission_required"`), and write `metadata.permissionRequest` and `llmGate.permissions`. |
| `recovery/annotation/exploration.ts:102-127,162-169,203-218` | The input gains `permissionGate`. The registry resolution gains `mutationsGovernedByPermission: true`. The gate is passed through. |
| `recovery/runtime-exploration.ts:108-123,187-192` | Gains an optional `gate` input. When it is given, it is used as-is, and passing it together with the three loose fields throws. |
| `AS/runtime/llm/harness-options/registry.ts:49-56,270-276` | When the resolution sets `mutationsGovernedByPermission`, `sideEffectAllows` offers `mutate` options. `destructive` is still never offered. |

**Contract changes.**
- The provider resolution carries `permittedConsequences`.
- The run detail gains `metadata.permissionRequest` (the existing
  `automation-studio.action-permission-request.v1`, stage `recovery`) and
  `llmGate.permissions`.
- The registry resolution gains a flag.
- `policy.allowExternalSideEffects` is no longer read on the recovery path. The
  gate is the authority, per the "capable by default, permission asked" memory.
  This belongs in `docs/architecture/automation-studio.md`.

**Downstream.** The domain needs nothing: the recovery press already asks Core
(`domain/src/runtime/llm-evidence/harness-options/execute.ts:115-129,213`;
`press.ts:55-63`). The Lab needs D3 to issue a grant that carries consequences.

**Live proof.**
- Run `order-operations-repair-relabelled-dispatch` with `--llm-task repair`
  (`explore_and_adapt`), first with no permitted set.
  - `llmGate.permissions.granted` is `[]`.
  - Any lasting press, for example "Pick and pack", ends the recovery with
    `metadata.permissionRequest`: `reason.stage` is `recovery`, `missing` is
    non-empty, and nothing is dispatched.
- Run it again with `--llm-permit <missing>`: `granted` lists those classes, no
  request is raised, and the exploration's press appears in the trace.
- The instructed half:
  - Build `order-operations-dispatch-run` with `create-flow`, so the Flow stores
    its instructed set.
  - Repair it on the `relabelled-dispatch` variant through DL.
  - Pass means `llmGate.permissions.instructed` lists the class and no request is
    raised.
  - It is expected, not proven, that this build stores a set: one is stored only
    when the build meets a lasting action.

### Item 4 — a repair that needs a side effect becomes a permission request

**Design.** The model states what its repair would lastingly do, in the same way
the press tool already asks it to. Core asks the recovery gate. A patch the gate
refuses becomes a request rather than a preflight refusal. A permitted patch
counts as explicitly authorized.

| Site | Change |
|---|---|
| `llm/harness/structured-response.ts:143,145` | `temporary_action_sequence` and `temporary_target_override` gain `consequences: AutomationStudioActionConsequence[]`, required but allowed to be empty. |
| `llm/harness/provider-result.ts:176-178,186-190` | Allow and validate `consequences`: Core's classes only, at most 5, no duplicates. |
| `llm/deepseek-provider.ts:103-131` and `:50` | First move `TARGET_OVERRIDE_PATCH_SCHEMA` and the action-sequence schema into a new `llm/harness/runtime-patch-schema.ts` (F6). Then add a required `consequences` property. Extend the target-override instruction on its own line: "say in consequences what pressing the new target would lastingly do; `[]` when it only opens, shows or chooses". |
| `AS/runtime/live-patch/refusal-reasons.ts:48-51`; `live-patch/target-override-check.ts` | `matched` and `resolved` gain an optional `control?: { name: string; kind?: string }`, supplied by the domain and carried through the check. |
| `AS/runtime/recovery/annotation/patches.ts:42-79,108-145` | Input gains `permissionGate?`. See the rules after this table. |
| `AS/runtime/live-patch.ts:89-123,135-141` | Input gains `sideEffectPermission?: "permitted"`. When present, the two side-effect lines (140-141) do not apply: the person's grant or instruction is the explicit authorization those lines ask for. Every caller without a gate behaves as today. |
| `AS/runtime/action-permissions/request.ts:100-102` | The `flow_step` sentence always ends "so the build stopped to ask". Add the recovery wording: "To repair the step that failed, the Flow would press … each time it runs, …, so the repair stopped to ask". Confirm that the strict parser at `:107-` accepts it. |
| `annotate.ts:357-376,382-407` | Pass the gate. After the patches, a `gate.request` becomes `metadata.permissionRequest`, with patch failure code `llm.runtime_patch_permission_required`. |

**What the patch stage in `patches.ts` does with a side-effecting patch that
will execute** (every patch outside the proposal-only branch):
- It runs the target check first, to learn the control's name.
- `consequences` absent: a receipt says so (`permissionOutcome: "undeclared"`),
  and the patch does not run.
- `consequences` is `[]`: the patch runs without asking.
- Otherwise it asks the gate:
  `gate.checkFor({ kind: "flow_step", id: failedAttempt.definitionId, ref: failedAttempt.nodeId })`,
  with the control's name (or "the step's new target") and the verb `press`.
- Refused: the receipt records `permissionRequired: true`, the `requestId` and
  `missing`, and the loop stops. As on the authoring path, the first request
  ends the recovery.
- Permitted: the patch input carries `sideEffectPermission: "permitted"`.

The `diagnose_and_adapt` proposal-only branch (`patches.ts:142-144`) is
unchanged.

**Contract changes.**
- The model's runtime patch output gains `consequences`.
- The target validation result gains an optional `control`.
- The patch receipt gains `permissionRequired`, `requestId` and `missing`.
- The run detail gains `metadata.permissionRequest`, shared with item 3.

**What the person sees** (slice CU1).
- `web/runtime/run-input-model.ts:2,95` adds `explore_and_adapt` to the explicit
  LLM run modes, and `FlowRunView.tsx:101` treats it as explicit.
- A new `web/runtime/RunPermissionRequest.tsx`, rendered in
  `RuntimePostRunSummary` (`FlowRunView.tsx:346-364`):
  - It reads `runDetail.metadata.permissionRequest` through t027's client export
    `parseAutomationStudioActionPermissionRequest` and shows the consequence
    phrases.
  - **Allow and run again** issues a grant with
    `permittedConsequences: request.missing` and re-runs with the same
    `runIntent`, mirroring t027's continuation in `BlankFlowAuthoringPanel.tsx`.
  - **Don't allow** dismisses it.

**Downstream.**
- D4: `domain/src/runtime/llm-evidence/target/override.ts:71-119` returns
  `control: { name, kind }` for the resolved element, using the name exactly as
  the packet printed it.
- D3: the Lab's `--llm-permit` option.

**Live proof.** Use `social-scheduler-repair-renamed-composer` ("Add to queue"
schedules a post, so the likely classes are `send_or_publish` and `create_new`)
with `--llm-task repair`.
- Run 1, with no permitted set: `runtimePatchAttempts[0].permissionRequired` is
  `true`, `metadata.permissionRequest` names "Add to queue", nothing is
  executed, and the variant's final state is unchanged.
- Run 2, with `--llm-permit` set to the missing classes: the override runs, its
  trial verifies, and an adaptation id is recorded. Approve and apply it.
- A deterministic replay on the variant then reaches the declared final state
  with no provider call.
- The task's own negative (never pick "Save as draft") still holds.
- Repeat the same shape on `order-operations-repair-relabelled-dispatch`.

### Item 5 — result verification that disagrees with itself at temperature 0

**Design** (t022's policy). A "does not answer" from the model is asked once
more, with the same evidence. Core's own count-based observations are never
repeated.

| First call | Second call | Recorded as | Run status |
|---|---|---|---|
| answers | (none) | `confirmed` | as its steps earned it |
| does not answer | does not answer | `refuted`, code `core.result.does_not_answer_request`, `calls: 2` | failed |
| does not answer | answers | `unverified`, basis `model_disagreed`, code `core.result.verdicts_disagree` | as its steps earned it |
| does not answer | unsure, silent or unavailable | `unverified`, basis `model_unconfirmed`, code `core.result.refutation_unconfirmed` | as its steps earned it |
| unsure, silent or unavailable | (none) | unchanged: fails closed | failed |

| Site | Change |
|---|---|
| `AS/runtime/result-verification/verify.ts:89-116` | Make the second, identical harness call. Combine the two answers in a new, pure `result-verification/agreement.ts`. The report returns `interventions` (one or two) in place of `intervention?`. |
| `contracts.ts:38-46`; `verdict.ts:36-42` | New bases `model_disagreed` and `model_unconfirmed`; new codes `disagree` and `unconfirmed`. |
| `verification-status.ts:34-37` | An outcome that was performed with either new basis maps to `unverified`. |
| `run-outcome.ts:117,229-234,236-254` | `failing` excludes both new bases. `recordedOutcome` adds `verdicts` (the verdict words, never prose) and `calls`. The run detail appends one or two interventions. |
| C5b: `llm/grant-capabilities.ts:73,111-121`; `execution-grants.ts:212-214`; `AS/api/contracts/llm.ts:25-27` | `verify_result` gains a fixed allowance of two calls (`calls: 2` beside `iterates: false`), and the comment at `:118-119` is rewritten. A purpose that does not iterate takes `calls ?? 1`, and a request for 1 call or that allowance is accepted. |

**What the person sees.** `web/runtime/RunDetailPanels.tsx` (I did not open it)
should show "Unverified: the two checks disagreed".

**Downstream.**
- D5: `TR/live-llm/live-llm-run.ts` counts the verification interventions from
  the run detail (`metadata.source === "verifyAutomationStudioRunResult"`), a gap
  `w2-save-and-replay.md` recorded.
- `TR/live-llm/live-llm-plan.ts:22-30` needs a comment update only. No
  `verify_result` grant is issued anywhere in t027.

**Live proof.**
- (a) A Core probe against the real DeepSeek key, about 20 calls and roughly
  $0.05. Take the stored `social-scheduler-week-ahead` playback whose rows score
  14 of 14 (dataset sha `23782055…`, the pair `w2-save-and-replay.md` saw judged
  both ways). Verify it 10 times.
  - Pass means no `refuted`, and every "does not answer" shows a second call.
  - Negative control: the same result summary paired with the
    `social-scheduler-whole-queue` instruction must end `refuted` after two calls.
- (b) Run `pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1` twice.
  Pass means 14 of 14 `matchedRecords` and a `resultVerification.status` of
  `confirmed` or `unverified`, never `refuted`, with the verification calls
  listed.

### Slices

Each slice is partitioned by file. "After" means it must wait for that slice
because they share files, or because it needs a contract that slice creates.

| Slice | Repo | Item | Owns | After | Narrowest live proof |
|---|---|---|---|---|---|
| **C0** headroom | Core | 1–3 prerequisite | `service.ts` (moves `391-420` out to new `llm/provider-resolution.ts`, `6021-6128` out to new `flow-bootstrap/review-projection.ts`, rebinds the port at `2891`); `recovery/annotation/ports.ts:61`; `annotate.ts:271`; `llm/index.ts` and `flow-bootstrap/index.ts` barrels | t027 and t033 on `dev` | Behaviour is unchanged. One `pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1` (about $0.01) shows build, apply and review projection unchanged. It must also absorb whatever the merge leaves above 6,404 lines. |
| **C3** | Core | 3 | `llm/execution-grants.ts` (`375-464`); `llm/provider-resolution.ts`; new `recovery/annotation/permissions.ts`; `annotation/{annotate,exploration,index}.ts`; `recovery/runtime-exploration.ts`; `llm/harness-options/registry.ts`; their tests | C0 | `order-operations-repair-relabelled-dispatch`, twice, with D3 |
| **C4** | Core | 4 | `llm/harness/{structured-response,provider-result}.ts`; new `llm/harness/runtime-patch-schema.ts`; `llm/deepseek-provider.ts`; `live-patch.ts`; `live-patch/{refusal-reasons,target-override-check}.ts`; `action-permissions/request.ts`; `recovery/annotation/{patches,annotate}.ts` | C3 | `social-scheduler-repair-renamed-composer`, twice, then a replay |
| **C5a** | Core | 5 | `result-verification/{verify,contracts,verdict,verification-status,run-outcome}.ts`; new `agreement.ts` | t027 and t033 only | The Core probe, then `social-scheduler-week-ahead` twice |
| **C5b** | Core | 5 | `llm/grant-capabilities.ts`; `llm/execution-grants.ts` (`212-214`); `api/contracts/llm.ts` | C3 | A 2-call `verify_result` grant passes preflight; one probe run |
| **CF** | Core | 1, 2 | new `flow-bootstrap/revision/{render,target,diff,topology,scope,apply,revert,contracts,index}.ts`; `flow-bootstrap/authoring/{parse,contracts,assemble}.ts`; `flow-bootstrap/plan/{contracts,validation,flow-script-format,routing-context}.ts`; `llm/harness-options/{plan-parameter-resolution,bootstrap-completion}.ts`; `route-state.ts`; `flow-bootstrap/{adaptation,generation-failure,review-projection}.ts`; `service.ts` (`1828`, `1850-1852`, `1909`, `1926-1930`, `2006-2019`, `2054`, `2148`, `4103`, `4219`); `api/handlers/llm-generation.ts`; `api/contracts/adaptation.ts`; `docs/architecture/automation-studio.md` | C0 | Through DL: improve the whole-queue Flow into the week-ahead Flow |
| **CG** | Core | 2 | `llm/harness/structured-response.ts` (`33-39`); `llm/deepseek-provider.ts` (`57`); `recovery/plan.ts`; `recovery/annotation/annotate.ts`; `recovery/stages.ts` | C4 (shared files); CF (needed for the proof) | Week-ahead fails on whats-new, then repair and revise |
| **CU1** | Core web | 3, 4, 5 | `web/runtime/{run-input-model.ts,FlowRunView.tsx,RunDetailPanels.tsx}`; new `RunPermissionRequest.tsx` | The C3 contract (it can start from this report) | Panel: an `explore_and_adapt` run on relabelled-dispatch shows the request, and Allow re-runs |
| **CU2** | Core web | 1, 2 | new `web/authoring/{ExistingFlowRevisionPanel.tsx,existing-flow-revision-model.ts}`; `web/authoring/{authoring-commands,index}.ts`; `web/runtime/{runtime-host.ts,FlowRunView.tsx}`; `web/adaptations/AdaptationsView.tsx`; new `FlowRevisionDiff.tsx` | CF; CU1 (`FlowRunView.tsx`) | Panel: improve the whole-queue Flow, see the diff, apply |
| **D3** | downstream | 3, 4 | `TR/live-llm/{execution-grant.ts,live-llm-plan.ts}` (`--llm-permit` through to the grant's `permittedConsequences`); `packages/test-contracts/src/llm.ts`; the flag's passthrough in `scripts/lab/live-campaign.mjs` | none | A grant preflight shows the requested classes |
| **D4** | downstream | 4 | `domain/src/runtime/llm-evidence/target/override.ts` and its tests | C4 (type) | The request names "Add to queue" |
| **D5** | downstream | 5 | `TR/live-llm/live-llm-run.ts` | none | `live-llm.json` lists the verification calls |
| **DL** | downstream | 1, 2 (and item 3's instructed half) | new `TR/saved-flow-revision/*`; `TR/live-llm/live-llm-plan.ts` (`211-217`: `edit-flow` maps to `build_and_adapt` with revise); `TR/existing-fluxiq-control.ts:273` (`revise`); `TR/flow-lane/repair/{run-repair-lane,judge-repair}.ts`; the registration of the `lab replay` command | CF; D3 (`live-llm-plan.ts`) | The live proofs for items 1 and 2 |

### Shared files, and what must run in series

| File | Slices, in order |
|---|---|
| `AS/runtime/service.ts` | C0, then CF |
| `AS/runtime/recovery/annotation/annotate.ts` | C0, then C3, C4, CG |
| `AS/runtime/llm/provider-resolution.ts` (new) | C0, then C3 |
| `AS/runtime/flow-bootstrap/review-projection.ts` (new) | C0, then CF |
| `AS/runtime/llm/execution-grants.ts` | C3, then C5b |
| `AS/runtime/llm/harness/structured-response.ts`, `AS/runtime/llm/deepseek-provider.ts` | C4, then CG |
| `web/runtime/FlowRunView.tsx` | CU1, then CU2 |
| `TR/live-llm/live-llm-plan.ts` | D3, then DL |

**Parallel waves.**
- Wave 1, after the integration: C0, C5a, D3 and D5.
- Wave 2, after C0: C3, CF and CU1.
- Wave 3: C4 and C5b (after C3); CU2 and DL (after CF).
- Wave 4: CG (after C4 and CF) and D4 (after C4).

C5a shares no file with any other slice and can run at any time.

**Recommended live-first order**, one problem at a time:
1. C5a, which is smallest and proven by the Core probe.
2. C3 with C4, D3 and D4, on one repair task.
3. CF with DL: first the instruction entry, then the edge-case entry.
4. CG: the repair entry, using the week-ahead and whats-new pair.

## Commands run and observed results

All were read-only: `sed`, `grep`, `wc`, `git show`, `git log`, `git status`,
`git diff --stat` and `node -e` over the baseline JSON. No builds, tests or live
runs.

- `git -C F:/fxwork/t027/!FluxIQ log --oneline -3` returned `2dcf06b Add bounded permission continuation UI`. `git status --short` printed nothing.
- `wc -l .../runtime/service.ts` (t027) gave `6441`. `git show HEAD:...service.ts | wc -l` also gave `6441`. `.structure-baseline.json:154` reads `"...runtime/service.ts": 6404`. `F:/!FluxIQ` (`dev`) gives `6404`.
- The line limit is `fileLines: 800` (`scripts/structure-audit/context.mjs:46`). `deepseek-provider.ts` has 799 lines in t027, 800 in t033 and 797 in `dev`.
- `diff` of `patches.ts` between Core `dev` and t027 reported them the same.
- Searching `apps packages domain scripts` downstream for `permittedConsequences` returned nothing. Searching for `allowExternalSideEffects` returned nothing.
- Searching downstream for `verify_result` found only comments and the type at `TR/flow-lane/persisted-flow-run.ts:70`. `grantOverride` has no caller.
- `grep "permission"` in `domain/src/runtime/llm-evidence/plan-resolution/` returned nothing (F7).
- `git diff --stat` for t033 Core listed 39 files, including the ones named in F8.

## Not verified

- Nothing was built, tested or run live. Every live proof above is a plan.
- The line numbers are t027's and will move once t027 and t033 are merged.
- I did not confirm, against a stored Flow, that Lab Flows hold
  `allowExternalSideEffects: false` and `allowModifyActionTargets: true` under
  `manual_approval`. That reading comes from source only
  (`AS/model/flows.ts:79-110`, `service.ts:6212-6239`).
- I did not check which Subflow status value means "retired". `revision/topology.ts`
  must use the model's existing vocabulary.
- I did not open `web/runtime/RunDetailPanels.tsx`, how `AdaptationsView` loads a
  bootstrap adaptation, or where the `lab replay` command is registered.
- I did not check whether `pnpm lab:campaign` passes new `--llm-*` flags through
  for repair tasks. The repair tasks are in `scripts/lab/live-campaign/catalog.mjs`.
- I did not check whether the strict request parser (`action-permissions/request.ts:107-`)
  recomputes the sentence, or whether a recovery `flow_step` sentence would pass it.
- It is unproven that the model states consequences honestly on a runtime patch,
  or that exploration on the named repair tasks actually presses a lasting control.

## Open questions or contradictions found

1. **The ratchet.** t027 Core's `service.ts` is 37 lines over its ratchet at
   HEAD, so `structure-audit` should fail on t027 as committed. The integration
   must fix that. Every slice here assumes `service.ts` does not grow.
2. **Where item 4 is really dropped.** The brief places it at `patches.ts:142`.
   The refusal is at `live-patch.ts:140-141`, reached from there. The fix has to
   change the preflight.
3. **A person-set flag changes meaning.** Under items 3 and 4, recovery stops
   reading `policy.allowExternalSideEffects` and the permission gate decides. I
   took this decision in the design to follow the "capable by default,
   permission asked" memory. It needs a line in Core's architecture document.
4. **Build-time step gating (F7).** The domain never calls the Flow-step
   permission check (`domain/.../tools.ts:420-422`). A build or revision that
   adds a step with a lasting consequence is never gated. This is outside the
   five items, but it is t018's unfinished half.
5. **Reversing a stated stance.** `grant-capabilities.ts:118-119` says asking
   again "would buy the same answer twice". Item 5 reverses that for "does not
   answer" only, and the comment must change with the code.
6. **Applied proposals bypass permission.** A proposal-only target override from
   `diagnose_and_adapt`, once reviewed and applied, presses its new target on
   every later deterministic run. No consequence is declared and no request is
   formed; the person's review is the only consent.
7. **The model's declaration is trusted.** A model that declares `[]` for a
   lasting press would run it without asking. This is the same trust model the
   press tool already uses.
8. **Two additions beyond t020's approved design:** a kept step copied into a new
   block gets a new id with `revisionCopiedFrom`, and repair scope is checked
   inside the completion check rather than as a terminal refusal.
9. **Size limits on the rendered script.** The routing context is capped at
   6,000 bytes (`routing-context.ts:75-82`). The rendered script needs its own
   budget inside that, and a Flow too large to render is refused rather than cut.
10. **Nothing to show the model about a kept step.** Existing Flow nodes store no
    step description, so a rendered step shows its label or catalog title, its
    definition and its parameter names. Storing the model's own step description
    at build time would help, but it would put model prose on the Flow. I did not
    design that in.
