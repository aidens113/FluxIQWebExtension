# t191-r2-w3: stable record, extract and Run controls

## Outcome

Done. The record, extract and Run controls now wait on a held "FluxIQ is working" signal, not on `status.runtime.state`. In the tests, 20 runtime flips during one build change each control once each way (false, true, false). Before this change the same 20 flips toggled the controls 20 times.

## Cause

`recordControl` (recording/record-control.ts:24), `extractControl` (recording/extract-control.ts:31) and `AutomationsController.observe` (automations/controller.ts:206) all read `status.runtime?.state === "running"`. The runtime goes to `running` for every internal page snapshot and back to idle after it, many times during one build. Each flip enabled or disabled "Start recording", "Record a new automation", "Extract Data From This Page" and the strip's Run.

## Fix

- `shell/working-input.ts` (new, pure): `workingInput(status, feedSnapshot)` works out the raw signal.
  - When the activity feed is `ready` and the relay is `live`, it uses the paced `display?.working`.
  - Otherwise it falls back to `runtime.state === "running"`. That covers no relay, an unsupported relay, a failed read, and a Core that does not stream activity.
- `shell/working-hold.ts` (new, pure, with an injectable `WorkingClock`): `createWorkingHold(clock, onChange)` adds hysteresis.
  - The held value becomes working only after the raw signal has stayed working for `WORKING_ON_MS` = 400 ms.
  - It becomes idle only after the raw signal has stayed idle for `WORKING_OFF_MS` = 1,200 ms.
  - A flip back inside that time cancels the pending change. Repeating the same input restarts nothing.
- `shell/mount-panel.ts` changes:
  - It creates its own activity feed with `createActivityFeed`, imported read-only through the `panel/chat` barrel.
  - The chat barrel does not export `listenToRuntime`, so a four-line private `listenToPushes` stands in for it.
  - The feed starts and reads at mount, and reads again each time the connection becomes connected.
  - The shell feeds `workingInput(...)` into the hold on every status and every feed change. The hold calls `recording.setWorking` and `automations.setWorking`.
- `recording/record-control.ts` and `recording/extract-control.ts` now take a required `working: boolean` parameter and no longer read `runtime`. `RecordingControls` gains `setWorking`, which redraws only when the value changes.
- `automations/controller.ts` changes:
  - `observe` reads only the connection.
  - The new `setWorking` calls `onChange` only when the value changes.
  - `AutomationsState.runtimeBusy` is renamed to `working`. `automation-strip.ts` reads the new name, and `automations-tab.ts` exposes `setWorking`.
- `shell/index.ts` exports the two new modules.
- A user's own recording and Run were already covered and are unchanged: `recordingState` hides or reshapes the controls, and `runInFlight` blocks Run.

Tests:
- `shell/tests/working-hold.test.ts`: the hold rules.
- `shell/tests/working-input.test.ts`, which covers:
  - which input decides;
  - the full chain with 20 flips of 700 ms reading / 300 ms idle, run three ways: with the display working (once each way), with no relay (once each way), and with the relay live outside a build (never changes);
  - a baseline showing 20 toggles when keyed on the runtime directly.
- `shell/tests/fake-clock.ts`: a manual clock for the tests.
- Updated: `recording/tests/record-control.test.ts`, `recording/tests/extract-control.test.ts`, `automations/tests/controller.test.ts`. The controller test now also checks that 20 runtime flips never redraw the tab.

## Commands run and observed results

All `tsc` commands ran in `apps/extension`:

- `npx tsc -p tsconfig.json --noEmit` -> exit 0.
- `npx tsc -p tsconfig.test.json --noEmit` -> exit 2. The only error is in `src/panel/chat/view/tests/thread-view.test.ts(69,72)`: `LiveLineModel` is missing `action`. That is the concurrent chat worker's file, still in progress. An earlier run showed other `panel/chat/*` errors from the same in-progress `ChatTarget` "question" kind; they have since cleared. Filtering out `panel/chat/` leaves no errors.
- Focused test run: `node <scratchpad>/t191-r2-w3-run.mjs <scratchpad>/t191-r2-w3-build`.
  - The runner mirrors `scripts/test-extension.mjs` for `panel/recording`, `panel/automations` and `panel/shell` only.
  - It bundles the `@fluxiq/*` packages in instead of leaving them external, because they cannot resolve from the scratchpad. The first attempt with them external failed with ERR_MODULE_NOT_FOUND for that reason.
  - Result: `# tests 76, # pass 76, # fail 0, # cancelled 0`, exit 0.
- `node scripts/structure-audit.mjs` at the repo root -> `structure-audit: passed (129 warning(s), 120 baselined)`, exit 0. None of the warnings are in `panel/shell`, `panel/recording` or `panel/automations`.

## Not verified

- No browser run. The live panel behaviour is untested: the feed read at mount, pushes reaching the shell's second listener, and the controls staying steady during a real build.
- The full package test suite was not run, as the brief said.
- `tsconfig.test.json` was not observed clean, because of the in-progress chat file.

## Open questions or contradictions found

- The panel now holds two or three activity feeds: the chat's, the on-page status setting's, and the shell's. Each registers a runtime listener and makes one read. If the chat barrel exported a shared feed, or `listenToRuntime`, the shell's copy could go.
- While the relay is live, the paced display is the only source. If Core ever does runtime work that it does not report as activity, the controls would not wait for it. With the relay live, the runtime is deliberately ignored.
- The on and off hold times (400 ms and 1,200 ms) are my choice within the brief's "a few hundred ms" and "about a second".
