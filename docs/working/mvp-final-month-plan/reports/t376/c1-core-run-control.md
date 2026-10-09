# C1: Core run-control contract and activity (t376)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t376/!FluxIQ`, branch `task/t376-run-controls-onboarding`. Nothing committed.

## Outcome

Done. All six tasks are finished. The tests beside each change pass, the four package checks pass, the structure audit passes, and the contracts, client-gateway-websocket and fluxiq builds were rebuilt.

## What changed and why

- `packages/contracts/src/client-gateway.ts`
  - Added the phase `"paused"` to `ClientGatewayActivityPhase`, between `running` and `extracting`. The doc comment says when Core sends it: once when a run holds and once as `running` when the run continues. A held run that is stopped ends through the normal final event.
  - Added `stopped?: true` to `ClientGatewayActivity`. It is set only on the final event of work that a person or caller cancelled, and it comes from the cancellation itself, never from the label.
- `runtime/activity/contracts.ts` and `emit.ts`: the emission now carries `stopped` and passes it to the hub. `bounded.ts` spreads the event, so nothing else needed to change.
- `runtime/activity/run.ts`: a session that settles with status `cancelled` gets `stopped: true` on its final event. The label stays "Run cancelled". Failed, succeeded and waiting runs get no `stopped`.
- `runtime/activity/build.ts`: a build that ends in an `AbortError` gets `stopped: true`.
  - That error is what `AutomationStudioBuildCancellation.run`/`checkpoint` throws when `cancel-flow-bootstrap` aborts the build. It was already the test that produced the title "Build stopped".
  - Budget, not-doable and other endings carry no `stopped`, even though their titles read "Build stopped: ...".
- New `runtime/activity/hold.ts` exports `automationStudioActivityHold(held, at)`, also exported from the activity barrel:
  - When the run holds, it emits one `phase: "paused"` event.
  - It then awaits the hold promise.
  - On a `resume` outcome where the run's signal was not aborted, it emits one `phase: "running"` event.
  - On a `stop` outcome it emits nothing, so the run ends through the normal cancelled path, which carries `stopped`.
  - Neither event has a `detail` row.
  - It lives in its own module because `graph-run.ts` was exactly at the 800-line limit. The call site changed with net zero lines.
- `runtime/executor/graph-run.ts`: the held checkpoint now awaits `automationStudioActivityHold(...)` instead of `held`. It passes the node id, label, step number, count, whether a person holds the page, and the run's signal. This runs inside the run's activity scope, the same scope the step events use.
- `runtime/run-control/types.ts` and `run-controller.ts`: the gate gains an optional `heldBy?(): holder | null`, and the controller implements it. A takeover (`holder: "person"`) says "Paused: you have the page", while a plain pause says "Paused". Without it, a plain pause would have claimed that the person had the page.
- `apps/web/src/lib/program-route.ts`: added `pause-runtime-session`, `resume-runtime-session` and `get-runtime-run-control` to `PAIRED_CLIENT_ENDPOINTS`.
  - Their registry classifications are pause and resume `authoring` under `runtime.control`, and get `read` under `programs.read`. The existing test `api/handlers/tests/run-control.test.ts` "are registered ..." asserts this. Both permissions are already in `PAIRED_CLIENT_PERMISSIONS`.
  - No request narrowing is needed. The bodies carry only `projectId`, `runId`, the `takeControl`/`afterManualAction` booleans (the handler type-checks them) and a short note or reason (clipped to 500 characters). None of these fields reaches an LLM, an inline Flow or a side-effect authorization.
  - No response projection is needed. The answer is the run's control snapshot and progress, nothing secret.
- `docs/architecture/automation-studio/client-gateway.md`:
  - The paired-endpoint list now includes the three endpoints. It also gains `cancel-flow-bootstrap`, which was already allowlisted but missing from the doc.
  - The per-step activity section has a new paragraph on `stopped` and `paused`.

Exact names and labels:
- Field: `stopped?: true`. Phase: `"paused"`.
- Paused event: `phase: "paused"`, label `"Paused: you have the page"` for a takeover or `"Paused"` for a plain pause. `step: { index, count, nodeId, label? }` names the held node, and is absent for a Merge, which has no number.
- Continue event: `phase: "running"`, label `"Continuing from step N"`, or `"Continuing the run"` when the node has no number. It carries the same `step`.
- Final events: `"Run cancelled"` (phase `failed`, `final: true`, `stopped: true`) and `"Build stopped"` (phase `failed`, `final: true`, `stopped: true`).

## Commands run and observed results

- `pnpm --filter @fluxiq/contracts build` printed `contracts:build ... stored in the shared store (145 file(s))`. The rebuilt `dist/client-gateway.d.ts` contains `"paused"` and `stopped?: true`.
- From `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/activity/tests src/programs/automation-studio/runtime/executor/tests/graph-run-pause.test.ts src/programs/automation-studio/runtime/run-control/tests src/programs/automation-studio/api/handlers/tests/run-control.test.ts` printed `Test Files 15 passed (15)`, `Tests 125 passed (125)`.
- Mutation check: I put `await held;` back in `graph-run.ts` and the three new hold-activity tests failed (`3 failed | 5 passed`). I then restored the file.
- From `apps/web`: `npx vitest run src/lib/tests/program-route.test.ts` printed `Tests 20 passed (20)`.
- `pnpm --filter @fluxiq/contracts check`, `@fluxiq/client-gateway-websocket check`, `fluxiq check` and `@fluxiq/web check`: each ended with its build-cache "build" line, printed no tsc errors, and exited 0.
- `pnpm --filter @fluxiq/client-gateway-websocket build` stored 25 files. `pnpm --filter fluxiq build` stored 6382 files. Both exited 0.
- `node scripts/structure-audit.mjs` printed `passed (289 warning(s), 710 baselined)`.
  - The first run failed: a new `executor/tests/run-control-activity.test.ts` made 26 files in that folder against a limit of 25.
  - I moved those cases into `executor/tests/graph-run-pause.test.ts` as the block "a held run on the activity stream" and deleted the new file.

Tests added:
- `activity/tests/scope.test.ts`: `stopped` on a cancelled run only, and on a cancelled build only. A budget ending and a failed build are not stopped.
- `executor/tests/graph-run-pause.test.ts`, block "a held run on the activity stream":
  - A takeover emits `paused` once. It stays at one event over 25 timer turns and a second takeover request during the hold. Continuing is emitted once, before "Running step 2".
  - A plain pause says "Paused".
  - Stop while held emits `paused` only.
  - An unpaused run emits nothing.
- `api/handlers/tests/run-control.test.ts`: the real-service "ends a held run as stopped" case now also asserts the activity for that run id: one "Paused: you have the page", no "Continuing", and a final event with `stopped: true`.
- `apps/web/src/lib/tests/program-route.test.ts`: the exact allowlist now includes the three endpoints, and `isPairedClientEndpoint` is true for each.

## Not verified

- I did not exercise the bearer-token route itself (`app/api/programs/[programId]/[endpoint]/route.ts`) end to end with a paired token. Only the allowlist and classification functions are tested.
- No live browser, Lab or panel run, as the brief said.
- No full suites.
- I did not check the Core web panel's own handling of a `paused` event (see the first open question).

## Open questions or contradictions found

1. **The Core web panel drops `paused` events.** `apps/web/src/features/automation-studio/conversation/activity/contracts.ts` has its own `PHASES` list (line 65) and phase union, without `"paused"`. The panel's parser will therefore drop or reject `paused` events, and `ui/activity-action/action-of.ts` has no case for the phase. Both are outside my ownership, and the design marks `ui/activity-action/**` as t264-owned. The compile did not fail because these are string lists, not `Record<Phase, ...>`. Someone needs to own adding `paused` there.
2. **A run can be stopped by its own hold timer.** A run held past `AUTOMATION_STUDIO_RUN_CONTROL_MAX_PAUSED_MS` (15 minutes) stops itself as `cancelled`, so its final event also carries `stopped: true`. Nobody pressed Stop. Telling the two apart would need the run's message or record in `activity/run.ts`. Today the session status is the only real outcome it reads. I left it, and the doc names this case.
3. **Project scoping on the token route.** The brief asked that a token reach only its own project's runs. The route has no per-project pinning for any endpoint: `cancel-runtime-session`, `list-runtime-sessions` and `get-flow-run-detail` all take `projectId` from the body. A token acts as the approving person within its declared domain. The new endpoints have the same reach as Stop, and the controller is keyed by `projectId:runId`, so both ids must match. Pinning to the paired project would need the session's project in `route.ts` or `PairedSession`, which I do not own. I did not add it.
4. **The build `stopped` test.** A build counts as `stopped` when it ends in an error named `AbortError`. Only the cancellation class produces that error today. An `AbortError` escaping from elsewhere would also read as stopped, but it already read "Build stopped" before this change.
