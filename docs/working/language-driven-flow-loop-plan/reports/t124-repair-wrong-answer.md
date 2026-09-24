# t124 — letting a wrong answer be repaired

Worktree `F:\fxwork\t124\!FluxIQ`, branch `task/t124-phase0-debuggable-run`.
Nothing committed.

## Outcome

Partial, and the shape of the remaining work changed mid-task.

The finding the brief asked for is settled, with evidence. The brief's two
options were then overturned by the coordinator mid-flight: a wrong answer is
not a patch-kind problem, it is a Flow-editing problem, and it must re-enter the
exploration-and-authoring loop rather than the patch planner. I stopped, reverted
the part of my work that rested on the overturned premise, kept the part that
survives it, and did the seam analysis that was asked for instead of the large
edit.

## The finding: which wall a wrong answer hits

**Candidate kind: `recovery_path_or_reroute`. The wall is the grant, not the
plan — an allowed set the grant does not buy.**

Evidence, from the code rather than from the run:

- `adaptiveCandidateKindForFailure` (`runtime/adaptive-orchestrator.ts:178-181`)
  tests `isAutomationStudioRunResultFailure` — stage `verification` plus a code
  in the `core.result.` namespace — and returns `recovery_path_or_reroute` for
  anything whose failure class is not `ambiguous_or_unknown`. The refuted-result
  attempt carries category `output_not_observed`, so the branch is taken.
- `AUTOMATION_STUDIO_PATCH_KINDS_FOR_CANDIDATE.recovery_path_or_reroute`
  (`runtime/recovery/plan.ts:98`) is
  `["temporary_reroute", "temporary_recovery_subflow_call", "temporary_action_sequence"]`,
  and `temporary_action_sequence` has no policy flag, so the allowed set is
  non-empty whenever `allowRuntimeRecovery` is on. `policy_allows_no_kind` was
  therefore never the refusal.
- `grantSkipReason` (`runtime/recovery/annotation/annotate.ts:650`) refuses
  unless `allowedPatchKinds.includes("temporary_target_override")`, which this
  candidate kind never contains. That is the observed
  `llm.runtime_patch_grant_scope_refused` at rung `plan` in
  `run-mufvlasz-c83071f7`.
- It also suppresses the exploration: `annotate.ts:383` gates the exploration on
  `!grantRefusal`, which is why the run's snapshot reads
  `exploration.requested: false, status: skipped, providerCalled: false`.

**A third wall sits behind the grant, and it is the important one.** Even with
the grant widened, none of the three allowed kinds could have inserted a step:

- `temporary_action_sequence` had **no application at all**.
  `applyRuntimePatchToFlow` returned `unapplied_patch_kind` for it
  (`runtime/live-patch.ts`, pre-change), and its payload was
  `actionDefinitionIds: string[]` — definition names with no parameters and no
  target, from which no applier could build a node. Its durable form,
  `edit_recovery`, is refused outright by both durable appliers as having no
  durable application.
- `temporary_recovery_subflow_call` was refused the same way, and the Flow had
  no recovery subflow to call.
- `temporary_reroute` only adds an edge between two nodes that already exist. The
  Flow was navigate → extract; there was no search node to route to.

So neither of the brief's two options was sufficient. That is the answer to the
brief's question, and it is also why the coordinator's redirect is right.

## The redirect, and what I did about it

The coordinator's instruction, mid-task: a wrong answer must re-enter the same
explore-and-modify loop creation uses, with the existing Flow as the starting
draft. The five `temporary_*` kinds are runtime band-aids for a node that broke;
a Flow missing a step needs editing. Do not widen the grant; report the seam
before large edits.

I reverted the grant-scope widening, because it rested on the overturned premise
and because it changed what a person's existing `diagnose_and_adapt`
authorization buys — the one thing the redirect said to keep unchanged. Reverted:
`grantSkipReason`, `explicitProposalIssue`, the proposal-only response schema,
and the four test expectations that had followed them. They are back to their
original text, with a comment at each site recording why widening is not the fix
and pointing here.

## Seam analysis

### Where a wrong-answer verdict could hand control to the build loop

`repairAutomationStudioRefutedRunResult`
(`runtime/recovery/refuted-result/repair.ts:82`) is the seam. It builds the
attempt a refuted result amounts to, writes it onto the run, and calls
`input.repair(...)` — an `AutomationStudioRefutedResultRepairPort` the service
binds to `annotateAutomationStudioRunDetailWithRuntimeLlm`. That one call is
where a wrong answer picks its loop, and today every path out of it is the patch
ladder. The port already receives the Flow document, the failed trace attempt,
the result summary and the subflow id, so the context a build entry point would
need is already in hand at the seam.

### What the build loop needs that a repair does not currently have

**Already there and shared — unwired, not missing:**

- *The exploration is literally the same loop.*
  `runAutomationStudioRecoveryExploration` (`runtime/recovery/runtime-exploration.ts`)
  drives `runAutomationStudioLlmEvidenceLoop` (`runtime/llm/evidence-loop.ts`),
  which is what a build drives. Its own header says so: "no loop is written
  here".
- *The evidence loop already accrues the draft.*
  `AutomationStudioLlmEvidenceLoopResult` carries
  `steps: AutomationStudioFlowDraftStep[]` on both its branches
  (`evidence-loop.ts:226` and `:234`). A recovery exploration therefore already
  produces the list of actions it ran, in exactly the shape the authoring path
  consumes. Nothing downstream of the recovery reads it: the recovery's own
  result surfaces `AutomationStudioExplorationStepRecord[]` from its recorder
  (`runtime-exploration.ts:484`) and drops the draft steps on the floor.
- *The authoring side is already draft-driven.*
  `flow-bootstrap/authoring/assemble-draft.ts` turns draft steps into a plan
  through the same assembler the written-script path uses, and
  `runtime/flow-draft/amendment.ts` is the vocabulary for a model editing that
  draft one step at a time. Neither is bootstrap-specific except by location.
- *The instruction, the page, the conversation and what already ran are all
  assembled on the repair path already* — `resolveAutomationStudioLlmInstructions`,
  `captureSanitizedFailureEvidence`, `refuted-result/conversation.ts`, the run
  detail and its attempts, plus the cost/token/deadline ledger.
- *The vocabulary for this entry point exists with no producer.*
  `AutomationStudioBootstrapAdaptationMode = "create" | "extend"`
  (`flow-bootstrap/adaptation.ts:30`) and the `edge_case` entry point of
  `AutomationStudioFlowChangeOrigin` (`model/flow-adaptation.ts:415`) are
  declared types. A repository-wide grep finds only the declarations, a reader
  that defaults absent modes to `create`, and the validator. **Nothing anywhere
  constructs an `extend`-mode adaptation or an `edge_case` origin.** The third
  entry point is named and unbuilt.

**Genuinely missing:**

1. **An entry point that accepts a non-blank Flow.**
   `generateFlowBootstrapAdaptation` calls `this.assertBlankBootstrapTarget`
   (`runtime/service.ts:1500`) and refuses with
   `flow_bootstrap.blank_target_required`. The build loop is closed to exactly
   the Flows this failure is about.
2. **A way to seed a draft from an existing Flow.** A draft step is "an action
   the loop took", carrying the argument it was given and a state digest either
   side (`flow-draft/step.ts`). There is no constructor that turns an existing
   Flow's nodes into draft steps, so the model cannot be shown "here is your
   Flow as a draft, amend it" — which is the whole of the coordinator's ask.
3. **A durable apply that edits an existing topology in place.**
   `normalizeAutomationStudioFlowBuildPlan` (`flow-bootstrap/adaptation.ts:150`)
   materializes a whole new topology: a new router id, new subflow ids, new
   graph Flow documents, and node ids derived from a hash of the adaptation id.
   Approving it replaces rather than edits, so node ids, provenance and any hand
   edits are lost. The only in-place graph edits that exist are per-node
   parameter writes (`edit_expectation`, `edit_action_target`), a router edge add
   (`edit_router`), the `failed`-port insert (`insert_deterministic_path`) and —
   added in this task — `insert_step_path`.
4. **The routing at the seam itself.** Nothing routes
   `core.result.does_not_answer_request` anywhere but the patch planner.

### Scope, honestly

This is bigger than one brief. Four pieces, each independently testable:

- **A. Draft from an existing Flow.** A constructor in `runtime/flow-draft/` that
  reads a Flow's nodes and edges into draft steps, plus the reverse mapping so an
  amended draft names the existing node ids rather than minting new ones.
  Without the reverse mapping an "edit" is a replace with extra steps.
- **B. A build entry point for a Flow that already has a topology.**
  `assertBlankBootstrapTarget` becomes "blank, or extending"; the result is an
  `extend`-mode adaptation with an `edge_case` or `run_failure` origin. Both the
  mode and the origin already exist as types.
- **C. A durable apply for an extend-mode plan** that diffs the plan against the
  live graph and emits add/edit/delete node and edge operations, instead of
  materializing a new topology. `insert_step_path`, delivered in this task, is
  the narrowest instance of exactly this and is the proof the transactional store
  can carry it; the general case is the work.
- **D. The routing at the seam.** A wrong answer enters B with the run, the page
  and the conversation as context; step-level failures keep the patch ladder.

A and C are the load-bearing ones. B and D are small once A and C exist.

## What changed, and why it survives the redirect

Kept, because it is a durable Flow edit rather than a band-aid, and because
piece C needs exactly this primitive:

- **`temporary_action_sequence` now carries real steps and has a real
  application.** Its payload is
  `steps: Array<{ definitionId; label?; parameters? }>` instead of bare
  definition ids (`runtime/llm/harness/structured-response.ts`), bounded at eight
  steps and 8,000 serialized characters each, checked at the provider boundary
  (`harness/provider-result.ts`) and in the model-facing schema
  (`harness/runtime-patch-schema.ts`). `runtime/live-patch/step-insert.ts`
  applies it to a throwaway copy of the Flow — the steps are inserted *ahead* of
  the named node, every edge into that node is re-pointed at the first step, and
  the last step rejoins — so the trial runs the repair rather than the Flow that
  answered wrongly. The trial's changed node is the first inserted step, derived
  from the run id so the trial, the receipt and the durable record agree.
- **`insert_step_path`**, a new change-proposal kind with a transactional,
  reversible durable applier (`storage/project/adaptation-step-path.ts`). It
  takes over the live edges into the target node, chains the inserted steps and
  rejoins; a target nothing enters is allowed, since after the insert the first
  step is the one node nothing enters and the start stays unambiguous. It is
  `GATED` on all three gates (`runtime/service/adaptations/gates.ts`), so it
  cannot reach a Flow without a reviewed proposal. One narrow repository method
  was added to support it: `listEdgesIntoNode` on
  `AutomationStudioProjectGraphRepository`.
- **The permission gate is now asked about an inserted step.**
  `recovery/annotation/patches.ts` previously consulted the gate only for a
  target override; it now does so for any acting patch, so a step that would
  lastingly act raises the person's question instead of running. This
  strengthens the permission model rather than weakening it. The same file now
  also holds an inserted step to the plan's allowed list, as it already held a
  target override.

Reverted, because the coordinator overturned its premise and it changed the
permission model: the `diagnose_and_adapt` grant-scope widening in
`annotate.ts`, `patches.ts` and the proposal-only response schema, plus the four
test expectations that followed it.

**Consequence worth stating plainly:** with the grant reverted, the insert
capability is reachable under `explore_and_adapt` but **not** from the Lab's
created-Flow repair, which uses `diagnose_and_adapt`
(`packages/test-runner/src/live-llm/live-llm-run.ts:71`, chosen deliberately
because `explore_and_adapt` tries its repair live and a granted run may never
authorize an external side effect). So this task does **not** make
`run-mufvlasz-c83071f7` repairable as it stands. That is intentional under the
redirect: the route that should make it repairable is piece D, not the grant.

## Files changed

Core worktree `F:\fxwork\t124\!FluxIQ`, all under
`packages/fluxiq/src/programs/automation-studio/`:

New:
- `runtime/live-patch/step-insert.ts`
- `storage/project/adaptation-step-path.ts`
- `storage/project/tests/adaptation-step-path.test.ts`

Modified:
- `model/flow-adaptation.ts` — `insert_step_path` kind, `AutomationStudioInsertedStepPath`
- `model/validation/adaptation.ts` — validates the new kind, refuses a named rejoin
- `runtime/live-patch.ts` — applies the insert, maps it to the durable kind, starts the trial at the inserted step
- `runtime/live-patch/index.ts` — barrel
- `runtime/llm/harness/structured-response.ts` — the step contract and its bounds
- `runtime/llm/harness/provider-result.ts` — boundary check for steps
- `runtime/llm/harness/runtime-patch-schema.ts` — the steps schema
- `runtime/llm/harness/output-validation.ts` — empty-steps diagnostic
- `runtime/recovery/annotation/patches.ts` — gate and plan-list now cover an insert
- `runtime/recovery/annotation/annotate.ts` — comment only, recording why widening is not the fix
- `runtime/service/adaptations/gates.ts` — `insert_step_path: GATED`
- `storage/project/adaptation-store.ts` — routes the new kind to its applier
- `storage/project/graph-store.ts` — `listEdgesIntoNode`
- `storage/project/index.ts` — barrel
- tests: `runtime/tests/live-patch.test.ts`,
  `storage/project/tests/adaptation-store.test.ts` (the two new cases moved out
  to their own file to stay under the 800-line limit)

## Commands run, and what they printed

- `npx tsc --noEmit` (in `packages/fluxiq`) — **no output; clean.** Run four
  times through the task; the last run, after the revert and the test split, was
  clean.
- `npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/tests/live-patch.test.ts src/programs/automation-studio/runtime/tests/service-adaptation src/programs/automation-studio/storage/project/tests`
  — **113 test files passed, 1121 tests passed, 0 failed.**
- `npx vitest run src/programs/automation-studio/storage/project/tests/adaptation-step-path.test.ts src/programs/automation-studio/storage/project/tests/adaptation-store.test.ts`
  — **23 passed** after the split.
- `node scripts/structure-audit.mjs` (repo root) — **0 violations.** It failed
  once at `file-lines` when my two new cases pushed `adaptation-store.test.ts` to
  869 lines against the 800 limit; splitting them into
  `adaptation-step-path.test.ts` cleared it. Only advisory 400-line warnings
  remain, all pre-existing.
- `npx biome check <the three new files>` — "No files were processed"; that path
  is ignored by `biome.json`, so lint says nothing about them either way.

### A full-program run, and two failures that are not mine

`npx vitest run src/programs/automation-studio` reported **5 failed / 2882
passed** partway through the task. Three were mine and are fixed. Two remain and
are in another worker's area:

- `runtime/tests/deepseek-bootstrap-exploration.test.ts` — "asks again after a
  decision that runs past its deadline"
- `runtime/tests/service-bootstrap/tests/rejections.test.ts` — "feeds back, then
  reports a content-free failure for, invalid plan structure", expecting
  `bootstrap.invalid_subflows` and receiving `bootstrap.subflow_has_no_nodes`

`git status` in the shared worktree shows the other worker has uncommitted
changes to `flow-bootstrap/generation-failure.ts`,
`flow-bootstrap/evidence-loop-steps.ts` and
`runtime/tests/deepseek-bootstrap-exploration.test.ts` — the exact subjects of
both failures. Neither test touches any module I changed. I left them alone.

## Not verified

- **No live run.** The supervisor owns the re-run, and nothing here has been
  exercised against a real page or a real provider.
- **The insert has never run against a real domain.** Every test of it uses
  builtin node definitions in a fixture Flow. Whether a model can author usable
  `parameters` for a real `web.dom.type` / `web.dom.click` step is unproven, and
  it is the obvious place this fails first.
- **Model-authored `parameters` are deliberately not interpreted by Core.** They
  are bounded and checked for shape, and the node definition registry the
  executor dispatches through is what refuses a parameter a definition never
  declared. I did not add a registry pre-check at the boundary. This matches the
  authoring path — `web.dom.type` declares `selector` as an ordinary authorable
  parameter — but it is a judgement call and deserves the supervisor's eye,
  because the target-override path is fiercer: there a model may only name opaque
  handles a domain issued.
- **`insert_step_path` has not been exercised through a real promotion.** Its
  applier and rollback are tested directly through the store; the path from a
  runtime patch's adaptation through `promoteRuntimeAdaptation` to that applier
  is not covered end to end.
- **The seam analysis is read from source, not executed.** The "no producer"
  claims for `extend` mode and the `edge_case` origin come from repository-wide
  greps of non-test sources; I did not build a case to prove they are
  unreachable.
- I did not run `pnpm check`, `pnpm test` or `pnpm build` at the repository root,
  to avoid a whole-tree run against a worktree another worker is editing.

## Open questions for the supervisor

1. **Should the grant revert stand?** I reverted it because it changed the
   permission model and its premise was overturned. If the intended route is
   still to attempt a repair from the Lab's created-Flow lane before piece D
   exists, the Lab's `CREATED_FLOW_REPAIR_PURPOSE` is the downstream knob, not
   Core's grant scope — but `explore_and_adapt` was already tried there and
   fails differently (`runtime_patch.side_effect_not_authorized`).
2. **Does `insert_step_path` stay?** It is a durable, reversible, gated Flow edit
   and piece C needs one. It is currently reachable only under
   `explore_and_adapt`. If the answer is that all Flow editing should go through
   the extend-mode build plan instead, this should be folded into that rather
   than kept as a second route.
3. **Pieces A and C are the real work and are each larger than this brief.** They
   want their own task with their own file partition, and A must land before C
   can be tested end to end.

---

# t124, second pass — the routing, built

Same worktree `F:\fxwork\t124\!FluxIQ`, same branch `task/t124-phase0-debuggable-run`.
Nothing committed. This pass built the three pieces the brief asked for, on top
of the seam analysis above.

## Outcome

Done, with one thing deliberately not done and named below.

**A run that answers wrongly now re-enters exploration and produces an edited
Flow, and that edit persists in place when it is approved.** Proven end to end
through a real service, not inferred: the model explores, runs the node the Flow
never had, the Flow gains that step, every node it kept keeps its id, and apply
writes it back into the same Subflow and the same graph Flow.

**What it does not do is approve itself.** The route ends at a *proposed*
adaptation. Nothing in this task approves or applies one, so an unattended wrong
answer ends with an edit waiting for review rather than a re-run. That is a
promotion-policy decision, not a wiring gap, and it is the supervisor's to make
(see "What remains", 1).

## The chain, as it now stands

1. The verification refutes the result: `core.result.does_not_answer_request`.
2. `repairAutomationStudioRefutedRunResult` writes the refuted attempt onto the
   run (its `metadata.resultRepair.code` carries the verdict) and calls the
   repair port.
3. **New.** The port first asks `automationStudioRefutedResultReauthorDecision`
   (`runtime/recovery/refuted-result/reauthor.ts`). It routes when the code is
   the wrong-answer code, a project and Flow are in hand, the run's grant is
   `explore_and_adapt`, and the context permits creating adaptations. Any other
   answer goes to the patch ladder exactly as before, and the run records why
   under `metadata.resultReauthor`.
4. Routed: the service reads the current execution binding and calls
   `generateFlowBootstrapAdaptation({ mode: "extend", evidenceGuided: true })`
   with the run's own grant.
5. `assertBootstrapTarget(..., "extend")` accepts the non-blank Flow.
   `automationStudioFlowBootstrapExtendSubject` reads the primary Subflow's
   graph Flow and turns its nodes into draft steps plus a step-id-to-node-id map.
6. The **same** evidence loop creation uses runs, seeded with that draft, with
   the same tools, the same completion check, the same permission gate and the
   same cost/token/deadline ledger (`automationStudioFlowBootstrapEvidenceLoopLimits`).
   Nothing about the loop is duplicated or special-cased.
7. The completion check assembles the amended draft through the **same**
   assembler, and `automationStudioFlowDraftPlanNodeIds` maps each plan node key
   back to the existing node id for every seeded step the model kept.
8. `createFlowBootstrapAdaptation` records `mode: "extend"`,
   `origin: { entryPoint: "edge_case", ... }` and `existingIds`, and normalises
   the topology reusing the Router, Subflow, graph Flow and kept node ids.
9. Apply re-normalises with the stored `existingIds`, so the comparison passes,
   and writes the graph Flow, Subflow and Router back at their own ids: an edit,
   not a replacement.

`AutomationStudioBootstrapAdaptationMode = "extend"` and the `edge_case` origin
had no producer anywhere in the repository. They have one now.

## What was built

New:

- `runtime/llm/node-tools/draft-from-flow.ts` — a Flow's nodes read back as
  draft steps, in the order the Flow runs them, plus the reverse mapping from
  assembled plan key to existing node id. Seeded steps carry the run-node tool
  id so the build's own writer can write them down; they carry no `replay` and
  no consequence declaration, and both absences are deliberate and documented.
- `runtime/flow-bootstrap/extend.ts` — what each mode refuses as a target, which
  Subflow an extend writes into, and the `AutomationStudioBootstrapExistingTopology`
  ids an edit keeps.
- `runtime/service/flow-bootstrap-commands/extend-subject.ts` — the read that
  turns a Flow into that seed and those ids.
- `runtime/recovery/refuted-result/reauthor.ts` — the routing decision and the
  record of it on the run.
- `runtime/service/flow-bootstrap-commands/generation-readiness.ts` — extracted
  from `service.ts` to pay for the lines the above needed.

Modified: `runtime/flow-bootstrap/adaptation.ts` (normalisation reuses given
ids; the record carries `existingIds`), `runtime/llm/loop-configuration.ts`
(`draft.seed` plus `automationStudioLlmEvidenceLoopSeedSteps`),
`runtime/llm/evidence-loop.ts` (one line: the loop starts from the seed),
`runtime/service/flow-bootstrap-commands/generation-request.ts` (`mode`, and the
grant purposes), `.../contracts.ts`, `runtime/service.ts`, and three barrels.

`service.ts` is 4583 lines, the same as it started, against its 4584 baseline —
the readiness extraction paid for the additions. `evidence-loop.ts` is 800, at
its limit, which is why the seeding helper sits in `loop-configuration.ts`.

## The permission model is unchanged, and here is exactly why

The route runs under `explore_and_adapt` and no other purpose. That grant is
already defined as "the iterating recovery; it explores on its own", and an
extend build makes `evidence_tool_decision` calls and nothing else, which the
purpose already buys. Nothing is minted: the request reader names the two
purposes it accepts rather than manufacturing a build grant from a run grant,
and `create` still requires `build_and_adapt`.

`diagnose_and_adapt` is refused at this door too, recorded as
`grant_does_not_buy_exploration`. That grant buys one target override under
manual review; routing it into a loop that explores would be the widening this
task reverted, arriving by a different door.

An `explore_and_adapt` grant carries no `permittedConsequences`, so an extend
entered this way permits **no** lasting consequence and every consequential step
raises the person's question through the gate that was already there. Adding a
search and re-extracting declares nothing and needs nothing, which is the case
the brief called out.

One related fix: the generation entry point revokes the grant it was handed,
refused requests included, **except** an exploring recovery's — that grant
belongs to the run still using it, and revoking it mid-run would strand the run.
Caught by `rejections.test.ts > rejects wrong purpose`, which failed on my first
attempt at this and passes now.

## Commands run, and what they printed

In `F:\fxwork\t124\!FluxIQ\packages\fluxiq` unless stated.

- `npx tsc --noEmit` — **no output, exit 0.** (One earlier run failed with
  `TS2322` in my new service test, where `value.node` could be `undefined`;
  fixed with `String(...)` and re-run clean. Vitest does not type-check, so the
  test had been passing with that error present.)
- `npx vitest run src/programs/automation-studio/runtime/llm
  src/programs/automation-studio/runtime/flow-bootstrap
  src/programs/automation-studio/runtime/recovery
  src/programs/automation-studio/runtime/service
  src/programs/automation-studio/storage/project/tests`
  — **143 test files passed, 1486 passed, 1 skipped, 0 failed.**
- `npx vitest run src/programs/automation-studio/runtime/tests`
  — **73 of 74 files passed, 490 passed, 1 failed.** The one failure is
  `service-bootstrap/tests/rejections.test.ts > feeds back, then reports a
  content-free failure for, invalid plan structure`, expecting
  `bootstrap.invalid_subflows` and receiving `bootstrap.subflow_has_no_nodes`.
  **Not mine, and pre-existing:** it is the same failure recorded in the first
  half of this report before any of this pass existed; `git diff --stat` over
  `flow-bootstrap/plan.ts`, `flow-bootstrap/plan/` and
  `flow-bootstrap/generation-failure.ts` shows the only modified file in that
  path is `generation-failure.ts`, which is the other worker's uncommitted
  change and which the brief told me not to touch.
- `npx vitest run .../runtime/tests/service-bootstrap/tests/extend.test.ts`
  — **5 passed.**
- `node scripts/structure-audit.mjs` (repo root) — **passed (184 warnings, 359
  baselined), exit 0.** All warnings pre-existing 400-line advisories.
- Not run: repo-root `pnpm check`, `pnpm test`, `pnpm build`. No live run.

### A note on the earlier flaky runs

Before the tree was mine alone, whole-directory `runtime/tests` runs reported a
different set of 4-8 failures each time while every one of them passed in
isolation. Grepping the output showed the cause: they were **test timeouts**
("If this is a long-running test, pass a timeout value..."), not assertion
failures, from contention while another worker was editing the same checkout.
With the tree to myself the same command reports one failure, three runs
running, and it is the assertion failure above. I did not hit a segfault or a
`3221225477` exit, so nothing here was retried for the RAM fault.

## What the end-to-end test actually proves

`runtime/tests/service-bootstrap/tests/extend.test.ts` drives a real
`AutomationStudioService` with a real node registry and a stand-in domain:

- a two-node Flow is created, approved and applied, as the Flow a run executed;
- an extend is then generated against it and **is not refused** — the same call
  without `mode: "extend"` fails `flow_bootstrap.blank_target_required`, which is
  the door that was shut before;
- the model's first decision runs `core.run_node` for a third node, and the
  resulting plan holds three steps where the Flow had two;
- the two it kept have **the same node ids** as before, only the added one is
  new, and `existingIds.nodeIdByKey` names them;
- the Router id, Subflow id and graph Flow id are unchanged;
- approving and applying leaves **one** Subflow, with the same node ids on disk;
- reverting an extend is refused rather than deleting the Flow it edited;
- an `explore_and_adapt` grant is refused at the `create` door.

Plus 9 unit tests on the seed and reverse mapping, 10 on extend targets and
normalisation, 7 on the routing decision, and 5 on the seeded loop.

## What remains

1. **Nothing approves the proposal.** The route produces a `proposed` extend
   adaptation; bootstrap adaptations are manual-review by design, and
   `maybePromoteRuntimeAdaptation` governs *runtime* adaptations, not these. For
   a wrong answer to end in a persisted Flow unattended, something must approve
   and apply an extend. I did not invent that policy — it is a permission
   decision and the brief says not to weaken the model. **Supervisor's call, and
   it is the last step between here and the MVP criterion.**
2. **The route does not re-run the Flow afterwards.** The once-per-run
   `resultRepair` marker correctly stops a loop, but it also means the edited
   Flow's first run is a later run.
3. **The Lab's repair lane will not take this route as configured.** It uses
   `diagnose_and_adapt` (`packages/test-runner/src/live-llm/live-llm-run.ts:71`)
   and will record `grant_does_not_buy_exploration`. Passing `explore_and_adapt`
   there is the downstream knob; this is the prior open question 1, now answered
   as "the Lab's setting, not Core's grant".
4. **Revert is refused for an extend.** An extend overwrites the graph Flow it
   was given and `parentBefore` keeps only the parent's metadata, so there is
   nothing to put back. Refusing is the safe gate; recording what was
   overwritten so an extend can be reverted is follow-on work.
5. **A seeded draft is not dry-run gated.** `automationStudioFlowDraftReplayable`
   needs every proposed step to carry `ranWith` and `replay`; a seeded step
   carries neither, because Core cannot say how to put a page back the way a
   node it never watched found it. So an extend is not held to the replay gate a
   creation is. Deserves the supervisor's eye.
6. **A node the current registry cannot resolve refuses the plan.** The seed
   writes each node by its `definitionId` and the assembler matches it against
   the live resolution, so a Flow holding a node outside the current scope fails
   `flow_script.unknown_node` rather than passing through untouched.

## Not verified

- **No live run**, as instructed. Nothing here has met a real page or a real
  provider. The stand-in domain returns fixed evidence.
- **The recovery seam itself is typed, not executed.** The end-to-end test
  enters `generateFlowBootstrapAdaptation` directly. No test drives a refuted
  run through `repairRefutedResult` into it; the decision function and the record
  are unit-tested, and the call between them is type-checked only.
- **`insert_step_path` still has no end-to-end promotion test** (unchanged from
  the first half of this report). Open question 2 there stands: if all Flow
  editing should now go through the extend-mode build plan, that kind should be
  folded into it rather than kept as a second route. My view, having built both:
  fold it in.
- Repo-root `pnpm check` / `pnpm test` / `pnpm build` not run.

---

# t124, third pass — the loop closed

Same worktree, same branch, nothing committed. This pass carried out the
coordinator's decision: auto-approve and apply on this route, re-run afterwards,
and fold `insert_step_path` into the extend plan.

## Does a wrong answer now end with a corrected Flow that has actually re-run?

**Yes.** The chain runs end to end with no person in it:

refuted (`core.result.does_not_answer_request`) → routed to the build loop with
the existing Flow as its draft → the model explores and runs the node the Flow
never had → the edit is **approved and applied automatically**, keeping the
Flow's Router, Subflow, graph and node ids → the corrected Flow is **re-run from
its start** → and that run's result is **judged in its turn**.

Proven by test, not inferred. `runtime/result-verification/tests/run-outcome.test.ts`
drives the whole loop: a run is refuted, the repair reports that it changed the
Flow, the corrected Flow is re-run, the second verdict is reached, and the run
handed back to the caller is the re-run's with `resultVerification.status:
"confirmed"`. The run that comes out the other end is the corrected Flow having
answered the question.

## 1. Auto-approve and apply

`automationStudioReauthorRefutedResult` (`recovery/refuted-result/reauthor.ts`)
sequences build → approve → apply, and the run records which of the three it got
to. The service's route calls it with `actorId: "runtime.result_repair"`.

**Nothing was widened to make this work, and I checked each gate rather than
assuming.** The route is still taken only under `explore_and_adapt`; that grant
still carries no `permittedConsequences`, so a consequential step is still
refused and put to the person; the cost, token and deadline ledger is untouched;
`diagnose_and_adapt` is still refused. And the approval itself is a gate, not a
formality: `reviewFlowBootstrapAdaptation("approve")` calls
`assertAutomationStudioBootstrapPermissionAnswered`, so a build that had to ask
the person a question **cannot** be auto-applied — it stops with the proposal
standing and the question outstanding. There is a test for exactly that case
("keeps the proposal when approval is refused, and does not say the Flow
changed").

This is a policy for this route only. A Flow Bootstrap adaptation reached any
other way is still proposed for review; nothing about general promotion changed.

## 2. The re-run, and what bounds it

**One repair-and-re-run cycle per verdict**, as you suggested, and the bound is
structural rather than a counter — which is why I kept it at one rather than
making it configurable.

`verifyAutomationStudioRuntimeSessionResult` now takes a `rerunRepairedFlow`
port. After a repair that **actually changed the Flow**, it re-runs and calls
itself once with the resulting session. The re-run keeps the run's id and
carries its metadata forward, so the marker saying "this result has been
repaired once" survives the rebuild; on the second pass
`repairAutomationStudioRefutedRunResult` answers nothing at its first line, so
the recursion cannot reach the re-run again. A Flow that answers wrongly twice
is reported wrong, not repaired forever.

Two narrower decisions worth stating:

- **Only when the edit reached the Flow.** An edit that was built and could not
  be applied has changed nothing, and re-running would spend a second
  verification to reach the same verdict on the same Flow. The re-run is keyed
  on `applied`, not on `routed`.
- **From the start, not from a resume point.** The edit *inserts* a step; a
  resume would skip it.

The re-run itself is not a second implementation. I extracted the existing
`retryRuntimeSessionAfterAutoAppliedPatch` out of `service.ts` into
`service/runtime-adaptation/repair-rerun.ts` and gave it one parameter,
`from: "resume" | "start"`. A failed step and a wrong answer now re-run through
one function; they differ by that word.

**A defect found and fixed while extracting it.** The original swallowed three
storage failures as `null`, so a Flow that could not be read reported as "there
was nothing to re-run". Those lines were baselined inside `service.ts` and the
structure audit caught them the moment they moved. They now fail closed with
named codes (`repair_rerun.flow_unreadable`, `.subflow_unreadable`,
`.subflow_absent`, `.subflow_graph_unreadable`) which travel out as the run's
`declinedCode`. Ownership mismatch still throws: that is a fault, not an absence.

## 3. `insert_step_path` folded into the extend plan

Removed: the `insert_step_path` change-proposal kind and
`AutomationStudioInsertedStepPath` (`model/flow-adaptation.ts`), its validation
branch, its durable applier (`storage/project/adaptation-step-path.ts`) and that
applier's test, its promotion gate entry, its routing in `adaptation-store.ts`,
the `listEdgesIntoNode` repository method added only to serve it, and the
`temporary_action_sequence` → `insert_step_path` mapping.

What remains is `temporary_action_sequence` as what the word *temporary* always
meant: a trial-only band-aid that lets the current run get past a step it is
missing, whose durable form is `edit_recovery`, which no durable applier
applies. Durably inserting a step is now the extend plan's job and nothing
else's. `live-patch/step-insert.ts` says so at the top, and the live-patch test
that pinned the old durable form now pins the new one.

## Commands run, and what they printed

In `F:\fxwork\t124\!FluxIQ\packages\fluxiq` unless stated.

- `npx tsc --noEmit` — **no output, exit 0.**
- `npx vitest run src/programs/automation-studio/runtime/llm
  .../runtime/flow-bootstrap .../runtime/recovery .../runtime/service
  .../runtime/result-verification .../storage/project/tests .../model`
  — **157 test files passed, 1629 passed, 1 skipped, 0 failed.**
- `npx vitest run src/programs/automation-studio/runtime/tests`
  — **72 of 74 files passed, 489 passed, 2 failed.** One is the pre-existing
  `rejections.test.ts > invalid plan structure` documented in the second pass
  (the other worker's `generation-failure.ts`). The other is
  `service-flows/tests/instruction-readiness.test.ts`, which failed with
  **"Test timed out in 15000ms"** and passes in isolation in 8.0s — the same
  contention timeout described in the second pass, not an assertion failure.
- `npx vitest run .../service-flows/tests/instruction-readiness.test.ts
  .../service-bootstrap/tests/extend.test.ts` — **6 passed** (the timeout one
  included).
- `npx vitest run .../runtime/result-verification/tests/run-outcome.test.ts`
  — **29 passed**, including the four new loop tests.
- `npx vitest run .../runtime/recovery/refuted-result` — **20 passed.**
- `node scripts/structure-audit.mjs` (repo root) — **passed (184 warnings, 359
  baselined), exit 0.** It failed once mid-pass on the three swallowed failures
  described above; fixing them cleared it. No entry was added to the baseline.
- Not run: repo-root `pnpm check`, `pnpm test`, `pnpm build`. No live run.

`service.ts` is 4519 lines against its 4584 baseline — 65 lines smaller than it
started this task, after the two extractions.

## Tests added this pass

- Four in `run-outcome.test.ts`: the corrected Flow re-runs and is judged; no
  re-run when the repair changed nothing; **repairs once** — a re-run that
  answers wrongly again is reported, not repaired again; a re-run that failed a
  step is judged as the failed run it is.
- Seven in `reauthor.test.ts`: the build/approve/apply order; a failed build
  names no adaptation; **approval refused keeps the proposal and does not say
  the Flow changed**; a refused apply likewise; and what "the Flow was actually
  changed" is true of.

## Still open, documented and unbuilt, as instructed

Items 3 to 6 from the second pass stand unchanged: the Lab's
`diagnose_and_adapt` knob, revert for an extend, dry-run gating of seeded steps,
and a node the current registry cannot resolve.

## Not verified

- **No live run**, as instructed.
- **The service's own binding of `rerunRepairedFlow` is typed, not executed.**
  The loop is proven at `run-outcome.ts` with a scripted port, and the extend is
  proven end to end through a real service, but no test drives a refuted run
  through the real service binding into a real re-run. That composition is what
  your live run will exercise first.
- **The auto-apply is proven as a sequence, not against a real permission
  refusal.** The unit test scripts `approve` throwing;
  `assertAutomationStudioBootstrapPermissionAnswered` refusing a real
  unanswered request on this route is not covered end to end.
- Repo-root `pnpm check` / `pnpm test` / `pnpm build` not run.
