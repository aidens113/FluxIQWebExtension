# Report: lane-t-u7-wa-run-path (W-A run path + evidence loop)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t734/!FluxIQ` (branch `task/t734-trace-consumer-wiring`). No commits.
All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. Every check the brief names passes. One live-behaviour hazard turned up and is handled (see "Presence check").

## What changed and why

- `service/runtime-session/graph-options.ts`: new optional input `environment?: AutomationStudioRunEnvironment | undefined`.
  The returned options now go through
  `automationStudioEnvironmentExecutorOptions(options, input.environment ?? automationStudioLiveRunEnvironment)`.
  If the environment's `random` is the live environment's own `random` (identity check), `random` is then removed again.
  The header comment says why. File is 72 lines.
- `llm/loop-configuration.ts`: new optional input `environment?: AutomationStudioRunEnvironment | undefined` on
  `AutomationStudioLlmEvidenceLoopInput`, with a doc comment. The loop's clock comes from it, and an explicit
  `budget.now` still wins. Nothing else is read from it. Whoever runs the loop enters the channel scope, ambient like the
  host lease, so the loop never calls `within`. Also a type-only import of `../environment/index.ts`.
- `llm/evidence-loop.ts` (still exactly 800 lines): two lines changed, one comment and the clock line, which is now
  `const clock = input.budget?.now ?? input.environment?.now ?? Date.now;`.
- Tests:
  - New `service/runtime-session/tests/graph-options.test.ts` (3 tests):
    - An offline environment's now, delay and random reach the options, and a 60 s virtual wait costs no wall time.
    - With no environment (and with an explicit live one), the options use the live `now`/`delay` and have no `random`.
    - Every other option is the same with or without an environment.
  - 2 tests appended to `llm/tests/loop-budget.test.ts`, in a new describe block beside the existing clock test:
    - The environment's virtual clock drives the loop's deadline when the budget names no clock.
    - An explicit budget clock beats the environment's clock.

  The loop test was first written as a new file `llm/tests/evidence-loop-environment.test.ts`. That made the directory
  hold 26 files, and the structure audit's 25-file limit failed. `llm/evidence-loop/tests/` already holds 25. So the
  tests went into the existing `loop-budget.test.ts` (now 475 lines, past the 400-line advisory warning), and the new
  file was deleted. No existing test was modified.
- Tests-first check: with the clock line put back to the original, the new environment-clock test fails
  (`1 failed | 1 passed`). With the change, it passes.

### Presence check (the brief's "branches on whether options.now/delay/random is present")

I searched the executor and its callers for code that branches on whether these options are present.

- `delay`: the only branch is `executor/pacing/run-wait.ts` (`if (options.delay)`). The live `delay` is
  `automationStudioRunWait({signal}, ms)` with no delay, so it reaches the same unreferenced, abortable timer.
  Equivalent. No other consumer exists (`outside-graph/retries.ts` takes its own `input.delay`, and nothing passes it
  the options' delay).
- `now`: every read is `options.now?.() ?? Date.now()`, `options.now ?? Date.now`, or a parameter default of `Date.now`
  (`composite-execution/child-bounds.ts`). Spread-if-present into node context (`node-execution/attempt.ts:194`,
  `transition-comparison.ts:303`) lands on `context.now?.() ?? Date.now()` (`nodes/control-flow/start.ts`) and
  `input.now ?? Date.now` (`fact-observation.ts`). Equivalent.
- `random`: **not equivalent**. `node-execution/attempt.ts:193` passes `random` into node context only when present, and
  `nodes/timing/wait.ts:39` reads `context.random ? context.random() : 0.5`. With no `random`, a live Wait node's jitter
  is always 0 (0.5 → `(0.5*2-1)*jitter`). With `Math.random`, it would be real jitter. Passing the live `random` would
  therefore change every live run with a Wait node that has `jitterMs > 0`. To keep live identical, graph-options
  removes `random` whenever it is the live environment's. The random nodes (`nodes/random/shared.ts`,
  `random-number.ts`) fall back to `Math.random`, so they are unaffected either way.
- Consequence for offline runs: a scoped environment's default `random` is its own `() => Math.random()`, a different
  function. So an offline trial built through graph-options gets real Wait jitter unless its creator passes a
  deterministic `random`. That looks like the right default for an offline environment, but the trial runners in P4/P6
  should know about it.

## Commands run and observed results

From `packages/fluxiq`:
- `pnpm exec vitest run src/programs/automation-studio/runtime/service/runtime-session src/programs/automation-studio/runtime/llm`
  (final tree) printed `Test Files  238 passed (238)` and `Tests  2245 passed (2245)`. It included
  `loop-budget.test.ts (29 tests)` and `graph-options.test.ts (3 tests)`.
- `pnpm exec tsc --noEmit`, final run: `tsc exit 0`, no errors.
  - An earlier run showed 5 errors, all in my graph-options test (`onRecordBatch` returned `Promise<void>`). I fixed that
    by making the stub throw.
  - A middle run showed 3 errors, all in W-B's in-progress files (`flow-bootstrap/candidate/tests/offline-trial/...`,
    `service/candidate-trial/tests/environment/...`, `service/subflow-trial/tests/environment.test.ts`). They were gone
    on the rerun.

From the repo root:
- `node scripts/structure-audit.mjs`, final run: `structure-audit: passed (413 warning(s), 1152 baselined).`, exit 0.
  Earlier failures, both fixed:
  - `[directory-files] llm/tests/: 26 source files`
  - `[statement-packing] loop-budget.test.ts line 466`

## Not verified

- No live or browser run, and no Lab run (none in scope).
- No caller passes `environment` to either graph-options or the evidence loop yet. `runtime/service.ts` was not to be
  touched, so the environment arrives only through tests. The live path's equivalence rests on the presence analysis
  above and the existing suites passing.
- The full Core vitest suite was not run (the brief's scope only).

## Open questions or contradictions found

1. The brief's test spec says "absent -> the live environment's functions". For `now` and `delay` that holds. For
   `random` it would break live identity (the Wait node), so `random` stays unset for the live environment. The
   supervisor may prefer instead to give `automationStudioLiveRunEnvironment` a marker, or to make the Wait node's
   fallback match. Both of those are outside my ownership.
2. Assessment (lane S's build-lifecycle accessor). `llm/harness-options/evidence-build-scope.ts` does **not** exist in
   this tree. Existing ambient scopes here are `environment/channel-scope.ts` and `llm/build-purse/flow-scope.ts`
   (purse), plus activity and conversation storages.
   - Threading `environment` through the loop input does not by itself make an explicit per-request field cheap. It is a
     loop-input field read once at loop entry. A field on the tool request would have to ride on every `executeTool`
     call, and those calls are spread out:
     - The request type in `llm/loop-configuration.ts:82`.
     - The loop's own call (`llm/evidence-loop.ts:548`) and its pass-throughs (236, 379, 418, 421).
     - The node tools, each with their own request type: `llm/node-tools/{replay-draft,rerun-check,step-place,run-flow,run-flow-part,dry-run-gate}.ts`.
     - `llm/evidence-progress/progress-trace.ts` (step-log wrapper).
     - `llm/harness-options/{binding,registry}.ts`: `executionFor` forwards to the domain binding's
       `executeTool({projectId, flowId, callId, toolId, value, signal, startLocation, permission})`. That is a
       cross-repo contract with the extension's domain binding.
     - Every wrapper that builds or forwards requests: `llm/evidence-recall/binding.ts`,
       `flow-bootstrap/{action-permissions,person-needed}.ts`, `flow-bootstrap/candidate/{authoring-loop,trial-view}.ts`,
       `flow-bootstrap/site-reset/start-check.ts`, `flow-bootstrap/subflow-candidate/builder-loop.ts`,
       `service/candidate-failure/submission-refusals.ts`, `service/end-view/{look,run-reader}.ts`,
       `service/flow-bootstrap-commands/{build-judge,cancellation,candidate-generation,observed-test-tool}.ts`,
       `service/project-build/{brief-ports,types}.ts`.
   - The narrowest explicit seam would be a loop-input field (as `environment` now is) plus one wrapper of
     `input.executeTool` at loop entry that stamps it onto each request. But `evidence-loop.ts` is at its 800-line hard
     limit, and the node tools take `executeTool` through their own inputs, so they would still need their request
     types widened.
   - Recommendation: keep the build lifecycle ambient, the way the purse and the channel scope are carried. Make it
     explicit only if a consumer outside the async context needs it, and then first move the `executeTool` wrapping out
     of `evidence-loop.ts`.
