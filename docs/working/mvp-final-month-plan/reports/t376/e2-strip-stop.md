# E2: Stop on the Automations strip (t376)

## Outcome

Done. The strip shows "Stop run" next to Run while the shown automation's run is in progress. Your full `pnpm ... build` was refused by its Core-staleness gate (details below), so the typecheck was run on its own.

## What changed and why

- `apps/extension/src/panel/automations/controller.ts`
  - `AutomationRowView` gains `stoppable` and `stop?: AutomationStopState` ("stopping" | "requested" | "failed").
  - `stoppable` is true in two cases: a Run from this panel is in flight (`runningFlowId`), or the row's newest known run reads as `running` (Core status queued/running, through `runFacts`). The second case covers a run started elsewhere, for example from the chat.
  - New `AutomationsController.stop(flowId, owner?)`:
    - It refuses a stale owner (`leased`), offline, an unknown row, a row that is not stoppable, and a press while one is already sending or sent. A second press therefore does nothing.
    - It finds the run id through `runningRunId`. If the run on screen is running, it uses that id. If the run came from the strip's own Run, it reads `listAutomations` once and takes this flow's newest run if that run is running.
    - It sends `RUNTIME_MESSAGES.panelStopRun` with `{ runId }`. With no id it sends `{}`, which is the background's project-wide stop of every active run.
    - The result is "requested" only when `result.ok && value.ok`; anything else is "failed". If the owner or connection changes in between, the answer is dropped.
  - Stop state is cleared when a run starts or ends, and on owner or connection changes (`invalidateOperations`). `AutomationStopState` is exported from `index.ts`.
- **Why a fresh read rather than the run reply.** `runAutomation` relays Core `run-runtime-session` and is awaited until it answers. As far as the panel code shows, the run id arrives only with that reply, which in practice means after the run has ended. The controller receives no live activity for runs. `panelStopRun`'s `flowId` cancels a *build* (`cancel-flow-bootstrap`), not a run, so it cannot be used to target a Flow's run.
  - The minimum change for an exact target in every case would be either of these. Neither is in my ownership.
    - The background accepts `flowId` together with a run intent and filters `list-runtime-sessions` by flow.
    - The shell passes the chat's run activity (subject.id) into the controller.
  - Until then, the fallback is the project-wide stop. Per run-control.ts, a project runs one adaptive run at a time.
- `automation-strip.ts`
  - Adds the `strip-stop` button: hidden unless `stoppable`, and disabled with "Stopping…" while the stop is stopping or requested.
  - Adds a `strip-stop-status` span (`role=status`, `aria-live=polite`). It reads "Couldn't stop the run. Try again." on failure and "Stop requested. Waiting for the run to finish." after success.
  - The click handler is bound to the owner it was drawn for, like Run, and `retireOwner` replaces the button. Old owner presses do nothing.
  - Run reads "Running..." and is disabled while `stoppable`, and lines drop the "Last run:" prefix.
  - When Stop disappears while it has focus, focus moves to Run.
- `automations.css`: there are now three columns in `.strip-head`, plus Stop styling. A hidden Stop and an empty status take no space.
- Existing tests: mocks gain `stop` and `stoppable`. The "disabled Run" focus test now sets `stoppable` together with `running`, as the real controller does.
- New tests: `tests/controller-stop.test.ts` (7 cases) and `tests/automation-strip-stop.test.ts` (5 cases).
- Task 2: a cancelled run's reply or list entry has status `cancelled`. `facts.ts` maps that to "stopped" and `summary-copy.ts` shows "Stopped". The controller test asserts `lines[0] === "Stopped"` after a strip Stop followed by a cancelled reply. facts.ts and summary-copy.ts were not edited.

## Commands run and observed results

- Bundled and ran every `src/panel/automations/tests/*.test.ts` with esbuild (the same options as `scripts/test-extension.mjs`, label dir `.test-build-scratch/e2-strip-stop`). Result: `# tests 113`, `# pass 113`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension build` was refused by `core-build.mjs`. It reported that Core's build at `fxwork/t376/!FluxIQ` is 9 minutes behind its source (`graph-run.ts`). I did not rebuild Core, because the Core tree is not mine.
- `npx tsc -p tsconfig.json --noEmit` in apps/extension: exit 0. This checked against Core's existing dist and included the other worker's chat and shell edits as they stood at that moment.
- `node scripts/structure-audit.mjs`: one FAIL, `[working-docs] docs/working/README.md is out of date`. It was already there before my edits: I ran the audit first and saw the same failure, most likely from the untracked t376 report doc. It also printed a new advisory warning: `apps/extension/src/panel/automations/tests/` has 16 files, past the 15-file advisory threshold. That is not a failure.

## Not verified

- The extension bundle (`build-extension.mjs`) was not built, because the Core staleness gate stopped it.
- No live browser check: the real Stop of a running run, Core's reply to a cancelled `run-runtime-session` (ok with status cancelled, or a failure notice), and the CSS layout at panel width.
- Whether Core's `list-flow-runs` lists a run while it is in progress. That is what lets the fresh read name the strip-started run. If Core does not list it, the project-wide fallback is used.

## Open questions or contradictions found

- The brief says to send "the Flow's context so only that run stops". The protocol's `flowId` means a build, so this was not possible without a background change (see above).
- Nothing in the controller refreshes the list mid-run. A run started from the chat shows Stop only after the next list read reports it as running.
