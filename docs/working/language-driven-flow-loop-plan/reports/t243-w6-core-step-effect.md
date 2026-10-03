# t243-w6: Core records a step's effect and routes past a step the site already did

- Brief: t243-w6-core-step-effect, 2026-10-02
- Tree: Core `fxwork/t243/!FluxIQ`, branch `task/t243-state-routing-runtime`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`
- Design: "Second case: the step's own effect is already on the page" in `t243-state-routing-runtime.md`
- No commits, no Lab run, no provider call, no Core library build.

## Outcome

Done. The build records `effect` for each step whose page is known on both sides. At run time, a step that cannot run is
passed over along its own success edge when the host says its effect already holds (outcome `effect_holds`). These
checks pass:

- the brief's vitest trees;
- `pnpm --filter fluxiq check`;
- the structure audit.

## What changed and why

**`stateDigests.before` is reported on action calls (confirmed).**

- Core: `AutomationStudioLlmEvidenceToolExecutionResult.stateDigests` is `{ before?, after? }`
  (`R/llm/evidence-loop/tool-execution.ts`), and `evidence-loop.ts` `statesOf` takes a step's `stateBefore`/`stateAfter`
  from it when no digest hook is set.
- Web domain: `domain/src/runtime/llm-evidence/capture.ts` `withCallStates(execution, found, left)` writes
  `before: found?.stateDigest` (an action's read before acting) and `after: left?.stateDigest` (its read after). The
  binding sets `stateDigestsOnCalls: true` (`tools.ts`).
- Only `routeState` (the page left) rides the result. The full "before" state is therefore the previous call's left
  state, as the design says.

**Build side: `R/route-state/build-routing.ts`.**

- `recording` keeps `left = { digest, state }`, the full route state of the page the newest call left with its
  `stateDigests.after`. That is one state, never more.
- Before each non-pageless call, the code copies `left` into `found` and clears it. A call that throws therefore leaves no
  known page.
- After the call, if all of the following hold, it stores `automationStudioSignRouteEffect(host, found.state, ran.state)`
  under the key `before\nafter`:
  - `found` exists;
  - the call reported its route state;
  - `stateDigests.before === found.digest`;
  - `after` is present and `!== found.digest`.
- `left` is then set from this call's `after` and its state.
- `reportedDigestAfter` became `reportedDigests` (both sides), with an `isDigest` type guard.
- `signaturesOf(step)` adds `effect` looked up by `(stateBefore, stateAfter)`. It now returns a value when only an effect
  exists.
- The interface doc comment has a new "The effect" paragraph.

**Run side.**

- `R/executor/contracts.ts`: `"effect_holds"` added to the `stateRouting` outcome union, and documented.
- `R/executor/state-routing/decision.ts`:
  - New `ownEffect`: the failing node's recorded `effect`, plus its success edge from
    `chooseAutomationStudioEdge(flow, id, "success", definitionId)` and the target node. It is present only when all
    three exist.
  - Order: F38 declared; candidates; `no_pre_states` only when there are no candidates **and** no own effect; one
    observation. Then, if there is an own effect, `effectHolds`:
    - `automationStudioRouteEffectHolds(host, effect, observation.state)`.
    - If it holds: the progress guard on the target. That gives `stopped`/`guard_stopped`, or
      `{ kind: "routed", node: target, direction: "forward", edge, record: { outcome: "effect_holds", candidates, matched: 0, toNodeId, direction: "forward" } }`.
    - If it does not hold: matching on the same observation, signed then. With no candidates, the outcome is `no_match`.
      The host's "not shown" reason is put in front of the `no_match` reason.
  - The guard code is factored into `guarded()` and shared by both routes. Messages are unchanged for the matching
    route.
  - The routed variant gains `edge?`, and `closeness` became optional, because an effect route has no closeness.
- `R/executor/state-routing/announcement.ts`: an effect route says "Passed over “X”: the page already shows what it does.
  Continuing at “Y”".
- `R/executor/graph-run.ts`: one line. A routed decision with an `edge` calls `recordRegionTransition` before moving on.
  The file went from 749 to 750 lines.

**Docs.**

- `docs/architecture/automation-studio.md`, "A step that cannot run continues where the page is.":
  - Step 2 notes the own-effect exception to `no_pre_states`.
  - Step 3 is now "Observe, once" plus the effect case. It covers the place in the order, why it precedes matching (the
    layer rule must not be relaxed), and why out of stock is safe.
  - `effect_holds` added to the outcome list.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`: the t243 paragraph now ends with how steps record their
  effect, and when they do not.

**Tests.**

- `R/route-state/tests/build-routing-signatures.test.ts`, new `describe`, 6 cases:
  - the effect is recorded from the full states either side;
  - none for a look (equal digests);
  - none when the call started elsewhere;
  - none after a call that threw;
  - none when the host records no effects;
  - an effect alone when no page was signed.
- `R/executor/state-routing/tests/decision.test.ts`, new `describe`, 6 cases:
  - holds: success edge, one observation, one host ask;
  - observed with no other pre-states;
  - does not hold: matching continues on the same observation;
  - no host answer, and a throwing host;
  - no success edge: host not asked, nothing observed;
  - guard on the effect target.
- `R/executor/tests/state-routing-run.test.ts`, 2 cases:
  - the bigbox store-remembered mirror (n1 open store picker, n2 choose store failing `target_not_found` with an effect,
    n3 type search whose before lacks the layer);
  - the out-of-stock twin.

## Commands run and observed results

All vitest runs were from `packages/fluxiq`, with `R=src/programs/automation-studio/runtime`.

1. **Failing first, against unchanged code** (only the new tests had been added):
   `pnpm exec vitest run $R/route-state/tests/build-routing-signatures.test.ts $R/executor/state-routing/tests/decision.test.ts $R/executor/tests/state-routing-run.test.ts`
   - It printed `Test Files 3 failed (3)` and `Tests 9 failed | 26 passed (35)`. Examples:
     - `expected { before: { at: '/home' }, …(1) } to deeply equal { …(2) }` (no effect recorded);
     - `expected { kind: 'none', … } to match object { kind: 'routed', … }` (decision);
     - run: `expected [ 'n1', 'n2', 'n2', 'n2', 'n3' ] to deeply equal [ 'n1', 'n2', 'n3' ]`. On unchanged code the
       ladder retried n2 twice, then the continuation rule went on to n3.
   - The out-of-stock twin first failed on my guessed `status "failed"`. I printed the unchanged-code trace:
     `calls n1,n2,n2,n2,n3`, every n2 attempt `failed`/`no_match` with a recovery decision, and the run `succeeded` by
     the continuation rule.
   - I rewrote the twin to assert exactly that unchanged ladder course. It then passed on unchanged code, as a
     regression guard should: `Tests 1 failed | 8 passed (9)`, where the 1 is the bigbox mirror.
   - Three of the new decision and build cases are guards that also pass on unchanged code: look, threw, host records no
     effects.
2. **After the change**, the same command printed `Test Files 3 passed (3)` and `Tests 35 passed (35)`.
3. `pnpm exec vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/route-state`
   printed `Test Files 33 passed (33)` and `Tests 408 passed (408)`.
4. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t243-w6 check" pnpm --filter fluxiq check` held slot b1 and
   printed
   `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ...","ms":51875,...}`, exit 0,
   no TS errors.
5. `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (218 warning(s), 349 baselined).`,
   exit 0.
   - The warnings in my lane are advisory and were there before: `executor/` has 25 files, `contracts.ts` is 467 lines,
     `graph-run.ts` is 750 lines.

## Not verified

- No run with the real web `signRouteEffect` and `routeEffectHolds`. The domain side is another worker's. Only fake hosts
  were used.
- No service-level build: the path from effect recording through `signaturesOf` to plan node to Flow metadata was not
  exercised end to end. W2's carry path was reused, and `automationStudioRouteSignaturesValue` already accepts `effect`.
- No Lab, browser or provider call. The full Core suite was not run, by policy.
- A region transition on an effect route that crosses regions: the code calls `recordRegionTransition` with the edge, but
  no test crosses regions.

## Open questions or contradictions found

1. **`matched` is 0 on an `effect_holds` record, and `closeness` is absent.** No pre-state was compared. If readers want
   `matched: 1`, change `effectHolds` in `decision.ts`.
2. **A step whose effect holds but has no success edge** (the last step, or one with only a failed edge) is never tested
   against the page, and matching goes on. This follows the brief. It also means such a node with no other pre-states
   records `no_pre_states` without observing.
3. **The design's "out of stock is safe" relies on the host.** `routeEffectHolds` must be true only on positive evidence.
   Core cannot enforce this. It only refuses non-`true` answers and treats a throw as false.
