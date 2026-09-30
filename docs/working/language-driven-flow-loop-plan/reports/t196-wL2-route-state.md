# t196-wL2: a Flow build's routing reads route state off its calls

Worker report for brief t196-wL2. Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQ`, branch `task/t196-state-digest-cost`.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. The new tests, llm, flow-bootstrap, tsc and the structure audit pass. `runtime/tests` passes except 6 assertions in `service-bootstrap/tests/rejections.test.ts`, which fail before this code runs (see "Commands run").

## What changed and why

### `R/route-state.ts` became `R/route-state/` (a directory with a barrel)

`R/tests/` already holds 25 files (the per-directory cap the structure audit
enforces), so a new test for `route-state.ts` had nowhere to go beside it. Making
the module a directory gives the test its own `tests/` folder and also brings the
file under Core's "one exported thing per file" rule. Nothing outside `service.ts`
imported it.

| File | Holds |
| --- | --- |
| `route-state/observe.ts` | `observeAutomationStudioRouteState` (unchanged behaviour) and `readAutomationStudioRouteState`, the one validation of a route state wherever it came from: a JSON object within `MAX_ROUTE_STATE_BYTES` (32,768). |
| `route-state/router-state.ts` | `automationStudioRouterStatePaths`, `resolveAutomationStudioRouterState`, `routeAutomationStudioRun`: moved verbatim. |
| `route-state/build-routing.ts` | `startAutomationStudioBuildRouting` and `AutomationStudioBuildRouting`: the change. |
| `route-state/index.ts` | Barrel. |
| `route-state/tests/build-routing.test.ts` | New tests (8). |

### Build routing (`build-routing.ts`)

- New `recording(executeTool)` wrapper. Every call the loop makes goes through it,
  the free first look and the dry run's reset and replayed steps included. It
  keeps the newest call's tool id and, when the result is an
  `llm_evidence_tool_execution` with a `routeState` that passes
  `readAutomationStudioRouteState`, the state that call left. A call that throws
  is still a call (it may have moved the page) and reports nothing.
- `observing(decide)`: the trigger is now "a call ran since the last decision".
  Then it records `after exploring with <newest call's toolId>` from that call's
  route state, and asks `observeRouteState` only when the newest call carried
  none. A Core note, an answer from memory, an amendment, or a window shift no
  longer causes a capture. Its type parameter no longer needs `evidence`.
- New `start` option: `"now"` (default) captures the start eagerly as before;
  `"first_look"` takes it from the free first look's route state. When the look
  carried none, the start is captured right after the look, and that capture also
  serves as the look's own state, so decision 1 costs one capture, not two. When
  the loop's first call is not the free look (no initial tool, or the look
  threw, or a resumed build's dry run), the start is captured before that call
  can move the page. When nothing has run by the first decision, it is captured
  there. The free look is recognised by the loop's `initial.<toolId>` call id
  (`R/llm/evidence-loop.ts:444`) on the first call.
- A host without `observeRouteState` is never deferred to. The start is settled
  immediately as unavailable with the same reason as before, and route states
  that calls report are not read, because a Router could not read them at run
  time either. `stateUnavailable`, the start label and the dedupe of identical
  states in `buildAutomationStudioFlowBootstrapRoutingContext` are unchanged.

### `R/service.ts` wiring (3 lines, line count unchanged at 4,480)

```ts
// line 73
import { routeAutomationStudioRun, startAutomationStudioBuildRouting } from "./route-state/index.ts";
// line 1534
const routing = await startAutomationStudioBuildRouting({ hostRuntime: this.hostRuntime, projectId, flowId, flowInputs: parent.interface.inputs, start: input.evidenceGuided ? "first_look" : "now" }); // An evidence-guided build reads its route states off its calls (`route-state/build-routing.ts`).
// line 1599
executeTool: routing.recording(permissions.executeTool)
```

`routing.recording` wraps `permissions.executeTool`, the exact function the loop
already received, so the permission gate still sees every call. The one-reply
path (line 1618, `routing.context()` with no loop) gets `start: "now"` and keeps
its eager capture.

## Route-state captures (`observeRouteState` calls), before and after

"Before" is measured. The test runs the pre-change rule (copied verbatim into the
test as `startBuildRoutingBeforeWL2`) on the same real evidence loop, script and
fake page. "After, calls report" is the intended state once the domain fills
`routeState`. "After, no call reports" is the state until it does.

### Per decision type

Each decision is charged at the decision after it, because that is when the
capture happens.

| Decision | Before | After, calls report | After, no call reports |
| --- | --- | --- | --- |
| Build start | 1 | 0 | 0 |
| Free first look (before decision 1) | 1 | 0 | 1 (the start, right after the look) |
| Action | 1 | 0 | 1 |
| Look | 1 | 0 | 1 |
| First re-ask (run once more) | 1 | 0 | 1 |
| Answered from memory | 0 | 0 | 0 |
| Amendment | 0 | 0 | 0 |
| Action whose result carries no route state | 0 (see note) | 1 | 1 |
| Completion refused, dry run replays | 1 | 0 | 1 |
| **Build total (8 decisions)** | **6** | **1** | **6** |

Note: for the action whose result carried no route state, the old rule captured
nothing at the next decision because the shown count did not grow. The page state
it left, `/page/2`, was therefore never shown. The new rule shows it (asserted in
the test).

### Per replayed build

The three recorded builds come from `R/llm/decision-context/tests/recorded-runs.ts`
and are replayed through the real loop. Their counts are computed: "before" from
each decision's shown count (the old high-water rule, plus the start), "after"
from which decisions ran calls. run-munneauy is measured through the real routing
wrappers on the script and outcomes from `state-digest-cost.test.ts`.

| Build | Decisions | Before | After, calls report | After, no call reports | Decisions after a call that the old rule did not observe |
| --- | --- | --- | --- | --- | --- |
| bigbox-run6 | 37 | 7 | 0 | 17 | 13 |
| crossborder | 22 | 5 | 0 | 11 | 8 |
| everything-store-run4 | 48 | 6 | 0 | 32 | 28 |
| run-munneauy-de8663ed (rebuilt) | 15 | 12 | 0 | 9 | n/a |

## Commands run and observed results

Every command was run from `packages/fluxiq` through
`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t196-wL2 ..."`. The structure
audit was run from the Core root. The machine was heavily loaded during these
runs: other lanes had `pnpm check`, a fluxiq build and vitest going.

| Command | Observed |
| --- | --- |
| `npx vitest run src/programs/automation-studio/runtime/route-state src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap --maxWorkers=2 --minWorkers=1` | `Test Files 110 passed (110)`, `Tests 1443 passed (1443)` |
| `npx vitest run src/programs/automation-studio/runtime/tests --maxWorkers=2 --minWorkers=1` | `Test Files 16 failed \| 64 passed (80)`, `Tests 33 failed \| 484 passed (517)`, `Duration 1520.09s`. Causes: 28 `Test timed out in 15000ms`, then `ENOTEMPTY`/`EBUSY` in temp-dir cleanup after those timeouts, and 6 in `service-bootstrap/tests/rejections.test.ts` (next rows). |
| same, `service-bootstrap` only, `--testTimeout=120000` | `Test Files 1 failed \| 15 passed (16)`, `Tests 6 failed \| 85 passed (91)`. The 6 are all in `rejections.test.ts`: the diagnostic carries an extra `issueCodes: ["thrown.Error", "thrown.at:runtime.service.flow-bootstrap-commands.field-readings.ts:6"]` (and `bootstrap-target.ts:22`) that the test does not expect. |
| same, `service-adaptation service-flows service-recordings`, `--testTimeout=120000` | `Test Files 37 passed (37)`, `Tests 179 passed (179)`. Every earlier timeout in these folders passes given time. |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 (after two test-only type fixes) |
| `node scripts/structure-audit.mjs` (Core root) | `structure-audit: passed (195 warning(s), 354 baselined).` and `1 baseline entries can be lowered.` |

**Why the `rejections.test.ts` failures are not this change.** Those rejections
are raised in `pre_provider_validation`, inside
`R/service/flow-bootstrap-commands/` (`field-readings.ts`, `bootstrap-target.ts`).
That is before provider resolution, and build routing only starts after it
(`service.ts:1534`). The `thrown.*` issue codes come from the committed
`R/flow-bootstrap/generation-failure/thrown-issue-codes.ts`, which this change
does not touch. It was not confirmed against a tree without this change: stash
was avoided because another worker's edits are uncommitted in this checkout.

## Not verified

- No domain changes. "After, calls report" assumes the domain fills `routeState`
  on every call, including refused calls, the free first look and dry-run
  reset/replay calls. Any call kind the domain leaves without one costs one
  capture at the next decision. On the recorded builds, if no call reports one,
  the new rule costs more than the old one: 17 vs 7, 11 vs 5, 32 vs 6.
- No Lab or browser run, per the brief. No live build measured.
- The service-level path (`generateFlowBootstrapAdaptation` with an evidence loop
  and a host that has `observeRouteState`) has no test that counts captures. The
  wiring is covered by tsc and by the existing service-bootstrap tests, none of
  which bind `observeRouteState`.
- Core dist not rebuilt, per the brief.

## Open questions or contradictions found

1. **The old trigger was cheaper than the walkthrough suggests, and it was
   blind.** It was a high-water mark on the shown count, and the shown count stops
   growing once the evidence window is full. On the recorded builds it fired
   5 to 7 times in total, and it never showed the state left after 8 to 28
   decisions that ran calls. The new trigger is correct, but it is cheaper only
   once the domain reports `routeState`. Until then it costs more (table above).
   The domain half should land with this change, or together with it.
2. **Old labels named Core notes, not tools.** Before, the label was
   `decision.evidence.at(-1)?.toolId`, the newest shown entry. In the test that
   gave `after exploring with core.budget` for every exploration state. Now it
   names the newest call's tool (`core.run_node`). The model sees this string.
   This is the one intended difference in `context()` labels.
3. `pnpm structure:baseline` would now lower one entry. The audit prints
   "1 baseline entries can be lowered", presumably the `R/` directory file count,
   because `route-state.ts` became a directory. `.structure-baseline.json` is
   outside this brief, so it was not run.
4. A stale path comment remains: `R/llm/evidence-loop/tool-execution.ts:87` still
   says `../../route-state.ts`. That file carries another worker's uncommitted
   change, so it was not touched. It should read `../../route-state/`.
