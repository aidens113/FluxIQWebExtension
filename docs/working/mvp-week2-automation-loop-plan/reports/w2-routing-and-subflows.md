# W2 routing and subflows (t020)

Worker report. Worktrees: Core `F:\fxwork\t020\!FluxIQ` (uncommitted), downstream `F:\fxwork\t020\!FluxIQWebExtension` on `task/t020-routing` (supervisor committed a WIP and merged dev with t019; my later edits uncommitted).

## Outcome

Done for the core deliverable; piece 3 (repair/improvement editing structure) designed and approved, not built.

One Flow, built live by DeepSeek, saved, then replayed twice with no model: it took a different route on each rendering and produced the right answer both times (14 of 14 expected records matched, identical dataset digest). Details under "Live proof".

## What existed (verified)

- The build plan's router rule had no condition field; `adaptation.ts` wrote rules with none; `router-runtime.ts` answers "No condition configured." with `matched: true`. Confirmed.
- Worse than the brief said: the Router's `state.*` read only `inputs.state` passed by the caller (`service.ts`), which no real run passes. No page rule could ever have held.
- Flow script `step: run subflow X` produced an unconditioned rule, so a Flow with a block always ran that block.
- In-subflow branches exist (`on <port>: go to <label>`), but web nodes' control input `in` takes one edge. A branch to the step written next took that edge and the assembler silently dropped the success fall-through. Live repro `run-mu7ffuwd-096f7778` (whats-new, before the fix): the model wrote "close the announcement; on failed: go to <next step>"; the run closed it and stopped with 3 steps never attempted.
- Structural adaptations do get a linked change proposal now (live-patch creates `proposal.<adaptationId>`), so the old proposalId blocker is gone. But `create_subflow` makes an empty graph and nothing writes a Subflow's nodes, so repair still cannot add a working route + Subflow.
- Flow bootstrap still refuses a non-blank Flow.

## Shared structural contract

The Flow script, one format for create, repair and improve. A route is a block:

```
subflow <label>: <the situation>
  when: <condition>
  step: ...
end
<steps outside every block = fallback>
```

- The condition is read forgivingly from one line (`authoring/condition.ts`): `state.page.dialog exists`, `inputs.mode is retry`, `page.path starts with /orders`, `is missing`, `contains`, `matches`, `greater than`, `and`/`or`, `unless:`. It becomes Core's `AutomationConditionExpression`. Core derives rule keys, order, ids and wiring.
- Validation refuses (`plan/route-validation.ts`, `plan/route-condition.ts`): a rule with no condition (`bootstrap.route_condition_missing`), two rules testing the same thing (`route_shadowed`), a condition the router cannot evaluate (path not `inputs.*`/`state.*`, history operators, bad regex), and a Subflow nothing reaches (`subflow_unreachable`). The script also refuses a `when:` outside a block, `run subflow` naming a block with no `when:`, and a branch to the step written next when the step still falls through (`flow_script.branch_to_next_step`). Refusal feedback for these carries the message and the condition form.
- `adaptation.ts` copies each rule's condition onto the saved Router.

**The Router reads real state.** Core host boundary gains optional `observeRouteState` + `routeStatePaths` (domain-neutral). `route-state.ts` observes only when an active rule reads `state.*`, just before routing; host keys replace a caller's. The decision record now keeps each rule's verdict and matcher reason plus which state paths were read and whether they were observed; never values. The web host (`domain/src/runtime/route-state/`) projects the sanitized evidence packet only: `state.page.path`, `location`, `title`, `dialog`, `blockedBy`, `controls`.

## Context the model receives

`flowBootstrap.routing` (`plan/routing-context.ts`), built in the service from the host observation, carried through `context-packet.ts` and the DeepSeek projection:
- `decides`: how the router picks, before any step, with no model;
- `current`: "The Flow is blank..." (for repair/improve the type for routes + subflows exists; not yet filled, see piece 3);
- `paths`: the Flow's declared inputs and every host state path with its description;
- `situations`: distinct observed states, first "where a run starts", then after each exploration step;
- `lastRoute`: type exists for repair/improve; not yet filled.

It is screened with the domain's denied evidence keys (refused if one appears) and credential-shaped values are dropped. Proof it arrives: `llm/tests/routing-context-packet.test.ts` captures the real DeepSeek provider's outbound body. Excerpt of what it asserts in `context.flowBootstrap.routing`:

```
paths: ["inputs.account", "state.page.dialog", "state.page.path"]
situations: [{ seen: "where a run starts, before any step runs",
               state: { "state.page.path": "/queue", "state.page.dialog": "What's new in Cadence" } }]
```

with a credential-shaped `sk-live-...` value absent from the body. I did not capture a packet from the live build to disk.

## Live proof: one saved Flow, two routes, no model

Fixture (smallest honest variant, `apps/scenario-lab`): social-scheduler week-ahead `whats-new` rendering, a modal announcement in front of an inert queue. Tasks `social-scheduler-week-ahead-whats-new` and `-no-announcement`, same instruction ("...when one is showing, close it first; when none is, go straight to the queue").

Build: `FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t020-routing pnpm lab:campaign social-scheduler-week-ahead-whats-new` -> run `run-mu7gdplv-dc59aed7`, 2 provider calls, $0.0075, proposed and applied. Its in-lane run then hit the 30 s control timeout (t022's issue), so the replay is the proof. Saved Flow `flow.9c8f4386-37a0-4ec3-ba65-19dc7b779185`, read from its project database:
- rule `r1` "a What's new announcement stands in front of the queue", condition `{"signalPath":"state.page.dialog","operator":"exists"}` -> Subflow `announcement` (click, select, select, extract_list);
- fallback -> Subflow `main` (select, select, extract_list).

Replays: `pnpm lab replay social-scheduler --workspace t020-routing --flow flow.9c8f4386-... --instruction-task <task>`, no key, no grant.

| Rendering | Replay | Route | Actions | matchedRecords / expectedRecords | model calls |
| --- | --- | --- | --- | --- | --- |
| whats-new | `replay-mu7gsejr-6ce62f9d` passed | r1 matched "state.page.dialog exists." -> announcement, stateObserved true | click, select, select, extract | 14 / 14 | 0 |
| baseline | `replay-mu7gvodo-22d5cc23` passed | r1 rejected "state.page.dialog does not exist." -> fallback main | select, select, extract | 14 / 14 | 0 |

Same Flow content hash before and after both (`b8cf04e0...`), same dataset sha256 (`23782055...`).

Caveat: the format's own routing example uses `state.page.dialog exists`, so the live Flow's condition could have been copied from the example rather than chosen from the routing context.

## Repair and improvement (piece 3): designed, not built

Approved by the supervisor, with a diff requirement. To build next:
- **Input.** The model sees the current Flow rendered back as a script. Each step is shown by a stable reference and never by its parameters, because resolved steps hold selectors.
- **Answer.** It answers with the revised script: `step: keep main.s2` for an unchanged step, fresh handles for new steps, a new block label to add a Subflow, an omitted label to retire one.
- **Diff.** Core diffs the answer against the current Flow. It stores routes added, changed and removed; Subflows added, edited, retired and unchanged; and steps added, removed and kept. The person reviews the diff. Kept steps keep their node id and provenance, and graphs are patched in place.
- **Repair scope.** A repair carries the failed run's `routeDecisions[0]`, which is now recorded. It refuses edits to Subflows and routes that run did not take. It may add a new route and Subflow.
- **Apply and revert.** These use the bootstrap adaptation with `mode: "extend"`, which is declared but unused today, through the same validate, approve and apply gates. Apply stores the before-state of the router, of each edited graph and of each retired Subflow's status. Revert restores them and deletes the Subflows the adaptation created.
- **Entry point.** One generator, `generateFlowBootstrapAdaptation` with `revise: { fromRunId? }`. Without a run it is an improvement; with one it is a repair.
- **Missing step.** For `target_not_found` or a missing step, the runtime repair plan should record `revision_needed` with the failed run id instead of offering only a target override. The host then calls the generator.

## Commands run and observed results

- Core `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq): clean.
- Core `node scripts/structure-audit.mjs`: passed (after keeping `service.ts` at its 6,405-line baseline and `deepseek-provider.ts` under 800).
- Core `npx vitest run src/programs/automation-studio`: 2239 passed, 12 failed under full load. Rerun alone, 11 pass (timeouts and the RAM fault). One fails every time and is not mine: `api/contracts/tests/llm.test.ts` expects 3 runtime-session purposes and there are 4 (`verify_result`); I did not touch either file.
- Targeted Core runs: flow-bootstrap + routing packet + router-runtime + deepseek + evidence-loop provider: 220/220.
- Mutations, each reverted:
  - Removing the route validation call: `routes.test.ts` "refuses a router whose rules carry no condition" failed.
  - Dropping routing from the packet: `routing-context-packet.test.ts` failed.
- Downstream:
  - `node scripts/test-domain.mjs`: 686/686, including the new route-state test.
  - scenario-lab `pnpm test`: 331/331.
  - test-runner and domain `tsc --noEmit`: clean.
  - `node scripts/structure-audit.mjs`: passed. Renamed `run-route.ts` to `taken-route.ts` for the naming rule.

## Files (for merge)

Core:
- `runtime/flow-bootstrap/plan/{route-condition,route-validation,routing-context}.ts` are new. Also changed in that directory: `contracts`, `parsing`, `validation`, `output-schema`, `flow-script-format`, `issue-feedback`, `index`.
- `authoring/condition.ts` is new; `assemble`, `parse` and `contracts` changed.
- `adaptation.ts`, `host-runtime.ts`, `router-runtime.ts` and `service.ts` changed, and `route-state.ts` is new.
- `llm/deepseek-provider.ts`, `harness/context-packet.ts` and `harness/task-request.ts` changed.
- Tests: `routes.test.ts` and `routing-context-packet.test.ts` are new; `script.test.ts` and `plan.test.ts` changed (the pinned catalog budget went from 5366 to 5118 because the schema now carries conditions).
- `docs/architecture/automation-studio.md`.

Downstream:
- social-scheduler fixture: `types`, `markup`, `client-script`, `manifest` and its test, plus `live-instructions.ts`.
- `domain/src/runtime/route-state/*` is new; `host-runtime.ts` and `index.ts` changed, and its test.
- test-runner:
  - `flow-lane/taken-route.ts` is new.
  - `persisted-flow-run.ts`: only the import, the `route` field on `PersistedFlowRunOutcome`, and one line in `outcomeFromDetail`.
  - `flow-lane/index.ts` and `creation/snapshot.ts` changed.
  - `saved-flow-replay/replay-saved-flow.ts`: records `run.route`. A Flow with no navigate step now passes the address check, because it starts where the run starts.
  - Four fixtures gained `route: null`.

## Not verified

- A live created-Flow run inside the lane: both routed builds hit the 30 s control timeout, which is t022's fix.
- The routing packet from the live build was not captured.
- Piece 3 is not built.
- Whether the model would choose the same condition without the format example.
- The Chrome/Edge extension outside the Lab.
- Downstream `pnpm check` and `pnpm test` as a whole.
