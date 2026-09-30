# t191-shell (lane t191, round 2): one UI, chat first

## Outcome

Done, with one contradiction for the supervisor to resolve (see "Open questions"): the Lab's
way back from settings, `getByRole("radio", { name: "Simple", exact: true })`, cannot survive
removing the modes. Every other Lab and e2e hook is kept under the same selector.

## What changed and why

**Simple and Advanced are gone.** `panel/simple/**`, `panel/advanced/**`, the mode switch,
the mode preference (`fluxiq.ui.mode`, `fluxiq.ui.advancedTab`), the view host and the old
header were deleted with their tests. Their tests covered now-copy, run-stop,
status-controls, setup-steps, model-key, steps-model, step-rows, mode-preference and
advanced-copy. Modules still in use were moved, not copied:

| From | To |
| --- | --- |
| `simple/automations/*` | `automations/` (`card.ts` became `automations-tab.ts`) |
| `simple/recording/review/`, `payload-fields`, `plain-words`, `recording.css` | `recording/` |
| `simple/record-control.ts`, `simple/start/extract-control.ts` | `recording/` |
| `advanced/connection/*` | `settings/` (`settings-form` became `address-form`, `settings-fields` became `form-fields`, `connection-tab` became `settings-view`) |
| `simple/open-fluxiq-button.ts` | `open-fluxiq/` |
| `simple/sticky-error.ts` | `state/` |
| `simple/tests/status-fixture.ts` | `panel/tests/` |
| `simple/relay/` | deleted; the panel uses `SIMPLE_PANEL_MESSAGES` from `shared/protocol`, which has the same strings |

**Shell** (`panel/shell/`):

- `screen-state.ts`: a pure reducer. The screens are `chat` (the default), `automations`,
  `settings` (the gear, which wins over everything) and `getting-started` (gated).
- `top-bar.ts`: FluxIQ, the Chat / Automations tablist, then record, the connection dot,
  the gear (`#settingsButton`, "Settings") and the Open FluxIQ icon.
- `mount-panel.ts`:
  - It mounts the recording bar and one screen at a time. The chat gets a full-height flex
    column.
  - Reads run only for the screen on show.
  - When a recording stops, the panel switches to the automations tab, where the recording
    review is.
  - The strip follows `chat.onTargetChange`.
- `mountPanel(root, surface)` lost its `views` argument. The popup and side panel entries
  were updated.

**Getting started** (`panel/getting-started/`):

- `startGuide(status, noAnswer)` is pure. It returns the steps 1 Open FluxIQ, 2 Connect this
  browser, 3 Approve this browser in FluxIQ, each done, current, waiting, problem or todo.
- The connect button is `Connect`, `Try again`, `Try now` or `Cancel`, on `#connectButton`.
  The approval code is `#pairingReferenceCode`, with its "Approval code" label.
- The screen replaces the chat for every connection state except connected. It also shows
  while the status is unknown, and shows the critical "extension isn't answering" message.
  Settings still open over it.

**Settings** (`panel/settings/`):

- The connection form holds the same labels, `Save`, `Saved.`, `Disconnect`, the draft store
  and the save plan.
- On-page status uses the chat worker's `createOnPageStatusSetting` from `panel/chat`, which
  is active only while settings are shown.
- Also here: Report a problem, Forget this pairing / Forget, and Open FluxIQ.
- It is dropped: the raw ids (client, session, tab) and the queue line. Report a problem
  still carries diagnostics.

**Automations** (`panel/automations/`):

- The tab lists up to 30 automations; `ROW_LIMIT` went from 5 to 30. Each row is one button
  with the name and the last run's first line.
- `chooseAutomation` calls `chat.open({ kind: "automation", flowId, name })`, then switches
  to the chat tab.
- In the chat, `automation-strip.ts` is a slim strip above the chat. It shows "Last run: …",
  Run, dataset CSV / JSON exports, and Open in FluxIQ. It has no name and no close, because
  the chat's own header already shows "‹ Latest chat · Automation <name>".
- The controller now reads a run's detail only for the automation that is open
  (`focus(flowId)`), so a 30-row list costs one read, not 30.

**Recording** (`panel/recording/recording-controls.ts`):

- Record button: the top bar's round button, "Start recording" / `#recordButton`. It shows
  only while connected and idle, and is disabled with its reason as a tooltip.
- Recording bar: shown on every tab while recording, with "Recording · N steps", "Extract Data
  From This Page" and "Stop recording" (`#stopRecordingButton`). It also shows a recording
  refusal with OK, and a failed request.
- The automations tab has a "New automation" section. It holds "Record a new automation" and
  the extraction entry, each with its line.
- The extraction entry moves between that section and the bar, so an open sheet is never
  torn down.
- The recording step list (Remove) was dropped, with its tests.

**"Right now" and Stop are gone.** `now-card.ts`, `now-copy.ts` and `run-stop.ts` were
deleted. Nothing replaced them that reads `status.runtime` as steps.

**Other changes:**

- CSS: `.link-button`, `.open-fluxiq` and the button primitives moved into
  `shell/shell.css`, which the chat uses. The shell is a 100 % height flex column; the popup
  is 380×580.
- Docs:
  - `docs/architecture/extension-client.md`: the Panel UI section is rewritten, "Simple Mode
    Relays" became "Panel Relays", and the settings mentions are updated.
  - `docs/architecture/sensitive-values.md`: the "Report a problem" location.
- `apps/extension/scripts/smoke-test.mjs`: one needle, `mountPanel(root, "<surface>",` became
  `mountPanel(root, "<surface>")`. This file sits outside my listed ownership. The API
  change made the edit necessary, and it is the only edit there.
- `apps/extension/e2e/install-and-content.spec.ts`: rewritten for the tablist, the
  getting-started steps and settings in place. It was not run, as the brief asked.

## Commands run and observed results

- Command:
  `EXTENSION_TEST_BUILD_LABEL=t191-shell bash .../heavy.sh "t191 shell check+test+build" bash -c "pnpm --filter @fluxiq-web-extension/extension check && … test && … build"`
  - Exit status: `EXIT=0`.
  - Tests: `# tests 1270`, `# pass 1270`, `# fail 0`.
  - Build: chrome, firefox and e2e-chromium each printed "verified 22 files".
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (123 warning(s), 120 baselined)`.
  None of the warnings is under `apps/extension/src/panel`.
- The first test run failed on `smoke-test.mjs` ("src/popup/index.ts must mount the panel"),
  which the needle fix above addressed.
- Screenshots: a harness in my scratchpad (`t191-shell-shots.mjs`) served `dist/chrome` on
  loopback and rendered the real built side-panel and popup pages.
  - Setup:
    - headed Chromium;
    - a stubbed `chrome.runtime` answering like the background for each state;
    - no Core, gateway, scenario site or model call.
  - The run used the claimed `lab-slots/ui-1` slot, released afterwards.
  - All 15 shots had 0 page errors.
  - They are saved in `C:/Users/osrs_/FluxStuff/evidence/t191-shots/shell-*.png`:
    chat-light/dark, chat-empty, automations-light/dark, automation-open, settings-light/dark,
    recording, start-disconnected-light/dark, start-pairing, start-error, start-noanswer, and
    popup-chat.
  - I looked at them and fixed three problems:
    - the strip duplicated the chat's own "Latest chat" header;
    - the recording bar wrapped awkwardly;
    - the record button showed before any status had arrived.

## Lab and e2e DOM hooks (grep of `packages/test-runner/src`, `scripts/lab`, `apps/extension/e2e`)

| Hook | Used by | Status |
| --- | --- | --- |
| button "Settings" | browser-session.ts:229, extension-project.ts:29, problem-report.spec | kept (`#settingsButton`) |
| labels "FluxIQ connection address", "FluxIQ web address", "Reconnect automatically", "Record page changes", "Record what I type", "Record page snapshots" | browser-session.ts:233-242 | kept |
| button "Save" (exact), text "Saved." | browser-session.ts:249-250 | kept |
| **radio "Simple" (exact)** | **browser-session.ts:255, extension-project.ts:35** | **removed with the modes; see Open questions** |
| button /^(Connect\|Try again\|Try now)$/ | browser-session.ts:264 | kept; the getting-started screen shows exactly one |
| buttons "Forget this pairing", "Forget" (exact) | extension-project.ts:31-32 | kept, in settings |
| button "Start recording" | diagnosis-lanes, workspace-lanes, extraction.ts:82, recorded-task.ts:106 | kept, in the top bar on every tab |
| button "Stop recording" | the same lanes | kept, in the recording bar on every tab |
| button "Extract Data From This Page", `#extraction*`, "Confirm" | extraction.ts:148+ | kept; in the recording bar while recording |
| button "Report a problem", link "Save report" | problem-report.spec | kept |
| `#fluxiq-lab-open-live-panel` (injected into body) | live-panel/side-panel.ts | unaffected |
| status reads (`chrome.runtime.sendMessage` getStatus) | pair-extension, pollStatus | unaffected (no DOM) |

## Not verified

- A real Lab run. `pnpm lab:interactive company-website` was not run: free physical RAM was
  about 2.3 GB, below the 4 GB rule for a provider-free Lab run. The screenshots come from
  the built page with a stubbed runtime, not a live Core. So these were not seen against a
  real background: the real pairing, connect, automations list, recording and extraction.
- The Firefox popup in Firefox. The popup was checked in Chromium at 380×580 only.
- The e2e specs were not run, as the brief said.
- `chat.open` and `onTargetChange` behaviour belongs to the chat worker. Here it was only
  exercised in the harness, where it opened the automation's thread.

## Open questions or contradictions found

1. **The Lab's "Simple" radio.** `packages/test-runner/src/demo-workspace/browser-session.ts:255`
   and `ui-e2e/journeys/extension-project.ts:35` press
   `getByRole("radio", { name: "Simple", exact: true })` to leave settings. That control is
   the mode switch the user told us to remove, so those steps now time out.
   - Suggested one-line replacement in both files:
     `page.getByRole("tab", { name: "Chat", exact: true }).click()`. Picking a tab closes
     settings.
   - Another option is `getByRole("button", { name: "Close settings" })`.
   - I may not edit `packages/**`.
2. **Stop for a running automation is gone.** The old Stop (`panelStopRun`) lived in "Right
   now" and keyed on `status.runtime.state`. That state flips for every internal snapshot
   capture, so it cannot drive a stable control. If Stop is wanted, it belongs with the chat's
   live activity, which is the chat worker's.
3. **Leftover "Simple Mode" names outside my ownership:**
   - `background/simple-panel/` and its comments: the module is still used, so I left it.
   - `SIMPLE_PANEL_MESSAGES` and comments in `shared/protocol.ts:259-300` and
     `shared/constants.ts:43`.
   - `extension-client.md` line ~372, "replaces Simple Mode's conversation card", in the
     chat section.
   - `chat-panel.ts:75`, which names `simple/open-fluxiq-button.ts`; that file is now
     `open-fluxiq/`.
4. **No deep link to an automation in Core.** `panelOpenFluxIQ` opens only FluxIQ's root
   address, so "Open in FluxIQ" does not land on the Flow. Deep-linking needs a background
   change in `background/panel/`.
5. **`recordControl` still disables recording while `status.runtime.state === "running"`.**
   That state flickers with internal page reads, so the record button's disabled state can
   flicker during a build. This behaviour predates the change, and I left it as it was.
