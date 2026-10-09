# E3: extension background for Take over / Hand back and Core's `stopped` field

## Outcome

Partial. Everything the brief asked for is done and validated, with one exception. The toolbar "!" is implemented
and tested, but nothing feeds it the live activity yet. The wiring has to go in `background/connection.ts` and
`background/index.ts`, and both are outside this brief's ownership (see Open questions).

## What changed and why

Messages and relays:
- `shared/constants.ts`: adds `RUNTIME_MESSAGES.panelTakeOverRun = "fluxiq.panel.takeOverRun"` and
  `panelHandBackRun = "fluxiq.panel.handBackRun"`.
- `shared/protocol.ts`: adds `PanelTakeOverRunRequest` and `PanelHandBackRunRequest`, both shaped
  `{ projectId?: string; runId: string }`. The reply is Core's run-control answer
  `{ runId, sessionStatus, live, runControl, progress }`, passed through unchanged.
- `background/panel/run-control.ts`:
  - `takeOverRun` sends `pause-runtime-session` with `{ projectId, runId, takeControl: true }`.
  - `handBackRun` sends `resume-runtime-session` with `{ projectId, runId, afterManualAction: true }`.
  - Only these named fields are sent. Any `reason`, `note` or other field in the panel's message is dropped.
  - A missing or blank `runId` is refused with `invalid_request` ("Take over needs the run it is for." or "Hand back
    needs the run it is for."). A missing project is refused with `no_project`. In both cases Core is never called.
  - `projectId` defaults to the paired project, because Core's handler requires both IDs.
  - Exported through `background/panel/index.ts`.
- `background/panel/panel-control.ts`: both messages are added to `PANEL_MESSAGES` (control pages only, so a page
  under test is refused with `forbidden`) and routed the same way as `panelStopRun`.

Stopped endings:
- `background/activity/pacer.ts`: the headline's `stopped` now comes from `event.stopped === true`. It no longer
  matches the label. Core only sets the field on the final failed event, and `activityHeadline` still checks
  `outcome === "failed"`, so the headlines still read "Run stopped" and "Build stopped".

Phase `paused`:
- `shared/activity/wording.ts`: `PHASE_ACTIONS.paused = "Paused"`.
- `content/activity-overlay/phase-appearance.ts`: `paused = { name: "Paused", accent: "#f7d354", mark: "attention" }`.
  These two fix the TS2741 build failures.
- `background/activity/headline.ts`: `ActivityWaitReason` gains `"paused"`, whose headline is "Paused: your turn on
  the page".
- `background/activity/pacer.ts`, for a `paused` event:
  - The outcome is `waiting` and `working` is false.
  - The headline changes, so it shows at once. No timer runs and it never fades, the same as any wait on the person.
  - `detail` is null, because Core's "Paused: you have the page" only repeats the headline.
  - The display keeps the held step (`step` = the node the run continues from), so the chat can say "continues from
    step N".
  - Core's later `running` event ("Continuing from step N") or the final event replaces it at once.
  - `shared/activity/activity-display.ts` documents all of this.
- `background/activity/unit-situation.ts`: a run that continues after a hold clears any page check. This also covers
  a held step with no number (a Merge), whose `running` event has no `step`.
- `content/activity-overlay/overlay-view.ts`: a display that is `waiting` in phase `paused` is drawn with the paused
  appearance and the detail "Open FluxIQ and press Hand back". It shows no step and does not fade.

Toolbar badge:
- `toolbar-badge.ts`: `toolbarBadge(status, now, activity?)` returns "!" when `activity.outcome === "waiting"`.
  "waiting" covers a paused run, a question, and a check on the page. REC still wins over "!", and "!" wins over
  "...".
- `toolbar-indicator.ts`: a new `ToolbarIndicator.activity(display)` method re-evaluates the badge when "waiting"
  starts or stops. The badge colour for "!" is `#b26a00`.
- `background/activity/activity-relay.ts`: a new optional dep `onDisplay?: (display) => void`, called synchronously
  whenever the display may have changed. This is the hook the badge needs.

Tests, in the existing test files beside each change:
- `run-control.test.ts`:
  - the named fields are forwarded;
  - extra fields and caller-supplied `takeControl: false` / `afterManualAction: false` are not sent;
  - a missing or blank `runId`, or a numeric one, is refused;
  - a missing project is refused.
- `panel-control.test.ts`:
  - both messages are added to the forbidden-sender sweep;
  - both route to pause and resume.
- `pacer.test.ts`:
  - a stopped ending is read from the field, and the label alone no longer stops;
  - paused shows at once, has no fade or timer over 60 s, keeps the step, and clears at once on resume;
  - Stop while held reads "Run stopped";
  - a check clears when the run continues.
- `headline.test.ts`: the paused headline.
- `overlay-view.test.ts`: the paused appearance and detail.
- `toolbar-indicator.test.ts`: "!" priority, and the indicator writing and clearing "!".
- The two existing pacer cases for "Run cancelled" and "Build stopped" now carry `stopped: true`.

## Commands run and observed results

- Subset runner, using the same esbuild options as `scripts/test-extension.mjs`
  (scratchpad `e3-run-tests.mjs`; output went to `.test-build-scratch/e3-take-over`, removed afterwards).
  - Run over `background/panel/tests`, `background/activity/tests`, `shared/activity/tests`,
    `content/activity-overlay/tests` and `shared/tests`.
  - Result: exit 0, `# tests 273`, `# pass 273`, `# fail 0`. All 13 new tests are listed as `ok`.
- `pnpm --filter @fluxiq-web-extension/extension build`
  - Result: exit 0.
  - The Core-staleness gate passed and `tsc` reported no errors (the TS2741 errors are gone).
  - Chrome, Firefox and e2e-chromium each reported "verified 22 files".
- `npx tsc -p tsconfig.test.json --noEmit`, run in `apps/extension` because the build's tsconfig excludes tests.
  - Result: exit 0, no output.
- `node scripts/structure-audit.mjs`
  - First run: FAIL `[as-never]` on my new test (4 `as never` casts). I replaced them with
    `as Partial<PanelTakeOverRunRequest | PanelHandBackRunRequest>`.
  - Re-run: the only FAIL left is the pre-existing `[working-docs] docs/working/README.md`.

## Not verified

- Live browser behaviour: the overlay, the badge, and a real Take over / Hand back against Core. None of it was
  exercised.
- The "!" badge does not show in the running extension until the wiring below is added.
- Full `pnpm test` was not run (the brief limits validation to the narrow checks).

## Open questions or contradictions found

1. **Badge wiring, which the supervisor needs to add.** These two places are outside my ownership:
   - `background/connection.ts`, in the `new ActivityRelay({...})` deps: add
     `onDisplay: (display) => this.activityListeners.forEach((l) => l(display))`, or any equivalent way to expose
     it.
   - `background/index.ts`: call `toolbar.activity(display)` from it.
   - The simplest form is a `FluxIQConnection.onActivityDisplay(listener)` and one line in `buildConnection()`.
2. **Every pause gets the same headline.** Core labels a plain (FluxIQ-held) pause "Paused", but the headline reads
   "Paused: your turn on the page" for every pause, as the brief says. The extension only sends `takeControl: true`,
   so a plain pause comes only from the web panel. If that headline is wrong for a plain pause, it could branch on
   Core's label. I left label matching out deliberately.
3. **Overlay detail wording.** The overlay detail is "Open FluxIQ and press Hand back", per the brief. Unit 7 of the
   design suggests "Open FluxIQ from the toolbar to answer" for waiting and paused. I changed only the paused case.
4. **Documentation not updated.** `client-gateway.md` and the extension architecture docs do not yet describe the
   two new panel messages. They are not in my ownership.
