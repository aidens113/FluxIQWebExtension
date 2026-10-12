# t387 - R3 safe state routing (Core) - worker report

## Outcome

Done for both guards. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t387/!FluxIQ`, branch `task/t387-safe-state-routing`,
uncommitted. All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **(a) Unbound skipped value, forward routes: done.** The data-dependency check that lived only in
  `executor/defensive/continuation.ts:157-169` is now `executor/defensive/output-reads.ts`
  (`automationStudioOutputReads`). Both continuation and the routing decision call it. Continuation's behaviour is
  unchanged, and its 14 tests pass as they were.
- **(b) Repeated lasting act, backward routes: done, and stricter than the brief's wording in one respect** (see Open
  questions 1). Today no host answer can allow a backward route across a completed lasting act, so every such route is
  refused.
- When a guard refuses a candidate, the decision drops it and tries the next ranked one. With none left the decision is
  `none` (`no_match`) and the ladder runs as before. The candidate exclusion of acted nodes
  (`decision.ts`, `actedNodeIds` and the after-state check) and the progress guard (3 returns) are unchanged.

## What changed and why

- `executor/defensive/output-reads.ts` (new): `automationStudioOutputReads(flow, producer, outputIds, readers)` returns
  every read of the producer's values among `readers`: data edges first, then state bindings in node order, each with
  the path it reads. This is the moved continuation check. It returns every read with its path, not only the first
  reader, because routing has to test whether each path is bound. `defensive/index.ts` exports it.
- `executor/defensive/continuation.ts`: `dependentNodeId` is now
  `automationStudioOutputReads(flow, node, outputIds, reachableFrom(flow, node.id))[0]?.readerNodeId`. The old data-edge
  loop did not check reachability, but every data edge's target is reachable from its source (`reachableFrom` follows
  all edges), so the result is identical. `readsAnyPath` and `MAXIMUM_BINDING_DEPTH` moved to the shared module.
- `executor/state-routing/route-path.ts` (new):
  - `automationStudioStateRouteSpan(flow, from, to)` returns the nodes on some edge path from `from` to `to`, both
    included, or an empty set when `to` is unreachable.
  - `automationStudioStateRouteOnward(flow, start)` returns `start` plus every node reachable from it.
  - I did not reuse `graph-navigation.ts`'s private `passedOver`/`reached` because that file is not mine.
- `executor/state-routing/skipped-values.ts` (new), guard (a):
  - Passed over: the failing node, plus the span from it to the target, minus the target.
  - Readers: the target plus everything reachable from it.
  - Outputs: each passed-over producer's ids come from its registered definition. An unregistered producer (every web
    domain node) gets `[]`, so only reads that name it by id count: every data edge and every `${id}.…` binding. A bare
    output id cannot be attributed to it.
  - Bound: run `options.inputs` plus every attempt's outputs, keyed `${nodeId}.${key}` and `key` the way `graph-run.ts`
    writes `values`. A path counts as bound if it equals a bound key, lies under one, or has bound keys under it.
  - The decision input's `options` Pick gained `"inputs"`. `graph-run.ts` already passes its full options, so it needs
    no change.
- `executor/state-routing/repeated-act.ts` (new), guard (b):
  - The walk is the target plus the span from target to failing node, minus the failing node. A target not connected to
    the failing node is a walk of one.
  - A node blocks the route when it is on the walk, completed (an attempt that succeeded and was not skipped), and
    `automationStudioNodeActLasts` (which already excludes `RepeatIsSafe`).
  - It returns `{ nodeId, effect: "on_page" | "unknown" }`, using `automationStudioRouteEffectHolds` on the act's
    recorded `effect` signature and the same observation.
- `executor/state-routing/refusal.ts` (new, types only): closed codes
  `AutomationStudioStateRouteRefusalGuard = "unbound_value" | "repeats_lasting_act"`, and
  `AutomationStudioGuardedStateRoutingRecord = AutomationStudioStateRoutingRecord & { refused?: { toNodeId, guard, nodeId }[] }`.
- `executor/state-routing/decision.ts`:
  - Ranked matches pass through `firstAllowed`: forward routes go through guard (a), backward routes through guard (b).
  - Refused matches are recorded in `record.refused`, and their sentences go into `reason`.
  - `matched` now counts only eligible matches (refused ones excluded).
  - The `effect_holds` route (forward along the failing step's own success edge) also goes through guard (a). If it is
    refused, matching continues on the same observation.
  - Refusals happen before the progress guard's `admit`, so a refused candidate never counts as a return.
- `executor/state-routing/index.ts`: exports the new modules.
- `service/summaries/state-routing.ts`: **not changed.** See Open questions 2.
- Tests (new):
  - `defensive/tests/output-reads.test.ts` (3)
  - `state-routing/tests/route-path.test.ts` (3)
  - `state-routing/tests/skipped-values.test.ts` (6)
  - `state-routing/tests/repeated-act.test.ts` (4)
  - `state-routing/tests/safe-routing.test.ts` (8). Each guard is covered for: refused (none left, so the decision is
    `none`), allowed, and the next ranked candidate taken. Guard (a) also covers the `effect_holds` route.
  - `executor/tests/safe-state-routing-run.test.ts` (2). Through `runAutomationStudioGraph`, a refused forward route and
    a refused backward route each leave the attempt with `stateRouting.refused` and a `recoveryDecision`, so the ladder
    ran. In the backward case s1 (the lasting act) is dispatched only once.
- No existing test expectation changed.

## Commands run and observed results

All from `C:/Users/osrs_/FluxStuff/fxwork/t387/!FluxIQ/packages/fluxiq` unless noted.

1. Baseline, before the edits: `node scripts/structure-audit.mjs` (repository root) printed
   `structure-audit: passed (295 warning(s), 708 baselined).`
2. Existing tests after the refactor, before any new tests:
   - Command: `npx vitest run …/executor/state-routing/tests …/executor/defensive/tests …/executor/tests/state-routing-run.test.ts …/service/summaries/tests/state-routing.test.ts`
   - Result: `Test Files 14 passed (14)`, `Tests 118 passed (118)`.
3. Affected directories plus the graph tests that use route signatures:
   - Command: `npx vitest run $A/executor/state-routing/tests $A/executor/defensive/tests $A/executor/tests $A/flow-bootstrap/authoring/tests/repeat-loop.test.ts $A/service/summaries/tests $A/route-state/signatures/tests`, with `A=src/programs/automation-studio/runtime`
   - Result: `Test Files 51 passed (51)`, `Tests 524 passed (524)`.
   - An earlier run that also included `llm/evidence-loop/tests/rerun-replacement.test.ts`,
     `llm/harness-options/tests/bootstrap-completion.test.ts` and `executor/tests/stop-after-node.test.ts` gave
     `31 passed (31)`, `283 passed (283)`.
4. Core typecheck: `npx tsc --noEmit -p tsconfig.json` produced no output and `tsc exit 0`. Its `include` is
   `src/**/*.ts`, so tests are type-checked too.
5. Structure audit, final run: `node scripts/structure-audit.mjs` (repository root) printed
   `structure-audit: passed (295 warning(s), 708 baselined).` with no warnings on the new files. The first run after the
   edits failed `[as-never]` on three new test files; I replaced those casts with typed metadata.
6. Two new tests needed fixture corrections while I wrote them; neither changed product code:
   - A safe-routing fixture: the `step()` helper's own `routeSignatures` had overwritten the recorded `effect`.
   - The graph-run backward test: after the refusal, the ladder retried s2 and then continuation carried on to s3, so the
     run ended `succeeded`. That is existing behaviour. The test now asserts the dispatch sequence
     `["s1","s2","s2","s2","s2","s3"]` instead of `failed`.

## Not verified

- No live or browser run, and no downstream (web host) test run. Downstream code did not change.
- No full suites, as the brief required.
- Resumed runs: values in a seed that came from a saved trace but are absent from the seeded attempts' outputs (for
  example withheld run inputs that are not resupplied) read as unbound. In that case guard (a) refuses conservatively. I
  did not test this path.
- The architecture document (`docs/architecture/automation-studio.md`, "A step that cannot run continues where the
  page is") does not yet describe the two guards. It is not mine to edit.

## Open questions or contradictions found

1. **Guard (b) has no way to see "did not land" evidence today.** The brief says to allow the route when
   `routeEffectHolds` gives positive evidence the act did not land. The host contract (`host-runtime.ts:83-91`,
   `route-state/signatures/effect.ts`) is boolean, though, and says the check is "true only on positive evidence … an
   effect that records nothing the page gained says nothing, and is false". So `false` means "not shown", not "did not
   land". For a completed act it is also not evidence: a cart keeps its item after the page moves on. I therefore treat
   every answer as `landed` or `unknown`, and both refuse. Today every backward route across a completed lasting act is
   refused, and the effect check only chooses the wording of the reason. A real `not_landed` needs the tri-state effect
   check (C6 step 4, downstream B3). When it exists, `repeated-act.ts` is the one place to add it. If the supervisor
   wants the host's explicit `false` read as `not_landed` now, that is a one-line change, but I think it is unsafe.
2. **The refusal is not declared on the shared record type, and the run detail cannot show it.**
   - `AutomationStudioStateRoutingRecord` is in `executor/contracts.ts` and the run-detail `stateRouting` union is in
     `model/flow-adaptation.ts`. Neither file is in my ownership.
   - So `refused` is typed as `AutomationStudioGuardedStateRoutingRecord` in `state-routing/refusal.ts`, and it travels
     on the attempt's `stateRouting` at runtime and in the saved JSON trace. The executor contract type does not declare
     it.
   - The run detail keeps `{ outcome: "no_match", code }` and drops `refused`. That is unchanged and safe, but a refused
     match reads there like "matched nothing".
   - Recommended follow-up, about 10 lines across three files:
     - add `refused?: AutomationStudioStateRouteRefusal[]` to `AutomationStudioStateRoutingRecord` (moving the two
       types into `contracts.ts`);
     - add `refused?: { guard; toNodeId }[]` to the model's `no_match`/routed variants;
     - project it in `service/summaries/state-routing.ts`, keeping only the closed codes and node ids.
3. **Scope choices to confirm:**
   - Guard (a) also covers the `effect_holds` forward route, because the failing step's own values are never set when
     the run goes past it.
   - Guard (a) does not refuse over an unregistered producer merely because its outputs cannot be listed. Continuation
     does refuse in that case, but doing the same here would disable forward routing for every web Flow, since domain
     nodes are not in Core's registry.
   - Guard (b) counts acts completed in earlier loop passes as completed.
4. **Not in this brief:** C6 also lists frame-scope and checkpoint `when`/`readyState` guards for safe routing. They
   need frames (C1), which are not implemented, so I did not touch them.
