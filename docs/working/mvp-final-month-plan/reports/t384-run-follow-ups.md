# t384 run follow-ups (planned as "t388 run follow-ups")

Core-paired. Trees: downstream `fxwork/t384/!FluxIQWebExtension`, Core `fxwork/t384/!FluxIQ`, both on
`task/t384-run-follow-ups`. Nothing committed.

## Outcome

Done, all three units.

1. Core: an attempt the ladder's `satisfied` rung went past now carries a mark, `stateHeld`. Readers of
   what a node came to read that attempt as done. The attempt itself still says `failed` and keeps its
   failure, its fault and its defence-ledger entry.
2. Extension: the Automations row reads `durableBehaviorChanged` from listed runs, not only from the
   reply to a Run pressed in this panel.
3. Extension: the strip's Stop now works for a run started elsewhere. When FluxIQ starts or finishes work,
   the list is read again, so the row shows the run in progress with Stop and its run id. Stop takes the id
   from the list.

## What changed and why

### Unit 1 (Core, `packages/fluxiq/src/programs/automation-studio/`)

- `runtime/executor/contracts.ts`: new optional field on the attempt trace,
  `stateHeld?: { rung: "skip_satisfied_node"; route: "success" }`.
- `runtime/executor/graph-run.ts`: the satisfied branch only. It stamps `stateHeld` on the attempt before
  `recordDefendedFault(..., "continued")`. Status, failure, fault and the ledger entry are unchanged. I kept
  the earlier design ("what happened and what the ladder made of it are two facts") rather than rewriting
  status to `succeeded`. Rewriting it would also have changed executor-internal readers that this task does
  not own and that other workers are editing: state routing's "nodes done" set and progress guard,
  `recovery-budget`, `person-needed` and `defensive/assess`.
- `runtime/flow-change/attempt-projection.ts`: two new helpers.
  - `automationStudioAttemptSettled(attempt)` returns `{ status: "succeeded", route: "success" }` for a
    failed attempt marked `stateHeld`, and the attempt's own status and route otherwise.
  - `automationStudioAttemptDeclaredRoute(attempt)` returns the route the node declares. A failed attempt's
    `failed` is the executor's default (`expected-transition.ts`), not a declaration, so it is not read as
    one. Without this, the trial read `failed` as the declared route of a node that went on down `success`
    and contradicted the change with `expected_route_not_taken`. The first version of the trial test caught
    this.
- Readers adjusted, each with a test:
  - `flow-change/trial.ts` (trial verdict): status, route and expected route come from the two helpers.
  - `adaptation-confidence/replay.ts` (replay confidence): the same helpers, so a replay and a trial
    cannot answer differently.
  - `service/summaries/conversions.ts` (run detail and summaries): the record reads `status: "succeeded"`,
    `route: "success"` and gains `stateHeld: { rung }`. It keeps the attempt's `failure`, `message` and
    `adaptiveFailure` metadata. The record type in `model/flow-adaptation.ts` gains the documented
    optional `stateHeld`.
  - `service/candidate-trial/feedback.ts` (the build's trial feedback to the model):
    - The step is listed as `succeeded`, with `failureCode`/`happened` kept and the sentence "The step's
      try failed, but the page already showed what the step does, so the run went on without doing it
      again."
    - No `retryable` or check-step advice is given for a failure the run went past.
    - The step-folding treats it as done, so the same node reached again is a new step.
  - `recovery/unresolved-failed-attempt.ts`: a `stateHeld` attempt counts as its node done, so it is never
    picked as the run's unresolved failure.

### Unit 2 (extension, `apps/extension/src/panel/automations/`)

- `types.ts`: `RunSummary.durableBehaviorChanged?: boolean`.
- `read-core.ts`: `readCore.run` reads that field when it is a boolean.
- `replies.ts`: the run reply's own `durableBehaviorChanged` is read first, then its run summary's.
- `controller.ts` `factsOf`: `reply?.durableBehaviorChanged ?? run.durableBehaviorChanged`.
- Core's `list-flow-runs` already sends the field on every run (`api/handlers/runs.ts:35`, normalized to a
  boolean). A run that changed later runs now shows "Learned 1 new page variation · Future runs updated"
  without a reply from this panel. A listed `false` means the same as before, because summary copy and
  `needsDetail` treat `false` and unknown the same way for the lines they draw.

### Unit 3 (extension, same directory, `controller.ts`)

- `setWorking(next)`: on a change, it reads the list again when connected and the list is supported. The
  shell's held working signal is how a run started elsewhere (the chat's "run it", a Lab playback through
  the API) reaches this panel. The strip sits above the chat, where the Automations tab's 30 s poll does
  not run, so before this change its row stayed stale and Stop never appeared.
- `runningRunId`: no longer reads the list only for a Run from this panel. Any automation whose shown run is
  not running is looked up in a fresh list read.
- Core writes a run's flow-run detail and summary on every `writeRuntimeSession`, including while the run is
  in progress (`runtime/service.ts:4147-4148`). So a run in progress is in the list. This answers t376 E2's
  "not verified" question from the source.
- The project-wide fallback, Stop with no id, is unchanged.
- The strip module (`automation-strip.ts`) needed no change: it already shows Stop whenever the row is
  `stoppable`. The automations code is shared by the Chrome side panel and the Firefox popup, so both stay
  aligned.

## Commands run and observed results

- Core, in `packages/fluxiq`:
  - Tests beside the change:
    `npx vitest run <runtime>/executor/tests/ <runtime>/flow-change/tests/ <runtime>/adaptation-confidence/tests/ <runtime>/service/summaries/tests/conversions.test.ts <runtime>/service/candidate-trial/tests/ <runtime>/recovery/tests/unresolved-failed-attempt.test.ts`
    -> `Test Files 38 passed (38)`, `Tests 559 passed (559)`.
  - Related ladder tests:
    `npx vitest run <runtime>/executor/step-skip/tests/ <runtime>/activity/wording/tests/reasons.test.ts <runtime>/executor/defensive/`
    -> `Test Files 11 passed (11)`, `Tests 127 passed (127)`.
  - `npx tsc --noEmit -p .` -> no output, exit 0. It was run after the last source edit.
- Core structure audit: `node scripts/structure-audit.mjs`.
  - The first run gave `FAIL [as-never] ... attempt-projection.test.ts: 2 as never casts` (one of them mine).
  - I replaced my cast with a typed `AutomationStudioTransitionComparison`. The rerun gave
    `structure-audit: passed (295 warning(s), 708 baselined)`.
- Core libraries rebuilt in the t384 Core tree, so the extension builds against this Core:
  `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> exit 0,
  `fluxiq:build ... Done`.
  - `node scripts/check/core-build.mjs` (downstream) then printed `Core's build ... is current with its
    source`, exit 0.
- Extension tests, narrow: every `src/panel/automations/tests/*.test.ts`, bundled with the same esbuild
  options as `scripts/test-extension.mjs` (scratch runner, since removed) -> `# tests 122`, `# pass 122`,
  `# fail 0`.
  - This includes the new tests "a run started elsewhere shows Stop once FluxIQ is working, and stops by the
    id the list names", "FluxIQ's working signal reads nothing while offline", "a listed run that changed
    later runs says so in its row ...", "a listed run that changed nothing durable is not read as learned"
    and "runAutomation: the run summary's durable change when the reply does not say".
  - Also `src/panel/shell/tests` and `src/background/automation-relay/tests`, which use the real controller
    -> `# tests 67`, `# pass 67`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension build` (tsc `--noEmit`, then the bundles) -> exit 0, with
  `chrome: verified 22 files`, `firefox: verified 22 files` and `e2e-chromium: verified 22 files`. Firefox
  printed its usual placeholder `gecko.id` warning.
- Downstream structure audit: `node scripts/structure-audit.mjs` -> `structure-audit: passed (184
  warning(s), 257 baselined)`.

## Not verified

- No live browser check. Three things are still unproven:
  - the strip showing Stop for a run started from the chat or by a Lab playback;
  - pressing it stopping that exact run;
  - the row's "Learned" lines for a run started elsewhere.
- That the shell's working signal turns on for a Lab playback started through the API depends on Core
  pushing activity for that run to the chosen project. I read this from the code; I did not run it.
- No full suites, by rule. Whole `packages/fluxiq` and extension suites were not run.

## Open questions or contradictions found

- Readers this task does not own, which still read a `stateHeld` attempt's raw `failed`:
  - `executor/state-routing/decision.ts:157` and `progress-guard.ts:25` do not count it as a done node or
    as progress;
  - `recovery-budget.ts` counts it in `failedAttemptsForAction`;
  - `result-verification/run-outcome.ts` `lastFailedAttempt` may hand it to a result repair;
  - the chat's activity card for the step was settled as failed by `emitAutomationStudioActivityStepRecovering`
    before the ladder ran.
  Each can adopt `automationStudioAttemptSettled` when its owner touches it. The chat card most affects what
  the person sees.
- Core architecture docs were not updated: the brief owns no doc path. The new trace field and record field
  are documented in their type comments.
- A run that ends while the working-edge list read is still in flight can show "Running..." until the next
  read (the working-off edge or the tab's poll). The same window existed before with the tab's 30 s poll.
