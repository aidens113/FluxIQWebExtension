# f-tab-recording — record and replay a tab switch or close (extension)

## Outcome

**Done in unit scope.** Two ownership widenings are named under open question 1.
Nothing ran in a browser or the Lab.

- **Recording.** A tab switch and a close are now recorded as `browser.tab` events
  carrying `tab`. They go through the normal event funnel, so each is counted once
  and sent with its input id.
- **Replay.**
  - A switch finds its tab by exact path, and waits for a tab that is still opening.
  - A close brings back the tab FluxIQ drove before it.
- **Gates.**
  - Extension `check` passed.
  - Unit tests passed, 459 of 459.
  - The structure audit passed.
  - Eight mutation proofs each failed their own test and were restored byte-identical.

## What changed and why

### Recording, in the background worker

**New `background/connection/tab-recorder.ts` (`TabRecorder`).** It decides which
tab changes are recorded actions.

- **A switch.** Recorded when a page the recording can see comes to the front and
  is not the page the recording is already in. The event carries:
  - `tab: { operation: "switch", urlPath }`, the pathname only;
  - `url` as origin plus path, with no query or hash;
  - the tab's title;
  - the id of the tab switched to, so evidence is read from that page.
- **A new tab with no page yet.** Its URL is empty or `about:blank`. The switch
  waits for the tab's first committed URL, for at most 10 s (`SWITCH_COMMIT_WAIT_MS`).
  If the URL commits later, no switch is recorded, but the recorder follows the tab.
- **A close.** Recorded only when the removed tab is the page the recording is in.
  - The event carries `tab: { operation: "close" }` and the last known origin plus path.
  - It carries no tab id, because the page is gone and there is nothing to snapshot.
  - This is narrower than the report's "a tab the recording attached". Replay
    closes the tab it is driving, so a recorded close of any other tab would replay
    against the wrong tab. The worst case is a missing close, never a wrong one.
- **Never recorded:**
  - **A page a recording cannot see** (`unsupportedPageForUrl`): browser pages, the
    extension's control page, the web store. Passing through one is not a switch.
  - **A tab change made while a runtime command is running** (the `runtimeBusy`
    dep, meaning the runtime status is `"running"`). This guard is new, beyond the
    report's design. A runtime action enters a recording through its own
    confirmation (`f-capability-confirmations`), so recording the tab change it
    caused as well would count it twice.
- **State is kept per recording id.** A recording's first tab event starts from the
  page `ActivePage` had in front.
- **The recording-start marker is unchanged.** `active-recording.ts` is not edited;
  the marker carries no `tab`, so the domain keeps it as evidence.
- **The path helper is local.** `landingLocation` (`recorded-event-intake.ts:68-75`)
  drops the query and hash but keeps the origin, so it does not give a bare pathname.

**Changes to existing files:**
- **`background/connection/active-page.ts`.**
  - Two new ports: `noteTabChange(tab, lastActive)` and `noteTabRemoved(tabId, lastActive)`.
  - `handleTabUpdate` calls the recorder after updating its own state, so evidence
    beside a switch reads the new page. It calls it before attaching, so the switch
    is sent ahead of what that path does next.
  - A recorder failure is swallowed, as the attach failure already is.
  - New `handleTabRemoved`.
  - `lastActive` is undefined when the page in front is unsupported.
- **`background/connection.ts`.** New facade method `handleTabRemoved` delegates to
  `this.page.handleTabRemoved`. Outside the owned method, see open question 1:
  - a header line and the import;
  - the `tabs` field;
  - the `TabRecorder` construction, with `runtimeBusy: () => this.runtimeStatus.current().state === "running"`;
  - two `ActivePage` dep lines.
- **`background/connection/index.ts`** (not owned): exports `TabRecorder`,
  `KnownActiveTab` and `TabRecorderDeps`.
- **`background/index.ts`:** `chrome.tabs.onRemoved` calls `manager.handleTabRemoved(tabId)`.
- **`shared/protocol.ts`:** `RecordingEventPayload.tab?: WebAutomationRecordedTab`.
  The type is imported from the domain, never copied.
- **`background/connection/gateway-payloads.ts`:** `tab` is now passed to
  `recordedInputId`, to `createWebAutomationRecordingEvent`, and to the evidence
  payload.
- **`background/connection/recorded-event-intake.ts`:** no change was needed. The P3
  change was committed to HEAD while I worked:
  - `git show HEAD:…/recorded-event-intake.ts | grep -c notePress` printed 1;
  - the source is unmodified against HEAD;
  - the test file's diff against HEAD holds only my additions.

### Task 2: does a recorded tab action reach the path that sends its input id and counts it?

**Yes, exactly once.** This answers the report's first P4 "Not verified" item. The path:
1. `TabRecorder.record` calls `deps.recordEvent`, which is the facade's
   `handleRecordingEvent` (`connection.ts:92`).
2. `RecordedEventIntake.accept` pairs only `dom.click`; every other kind goes straight on.
3. `processEvent` calls `isExecutableRecordedAction` (`recorded-event.ts:9-11`), which
   is `recordedInputId(payload) !== undefined`.
4. The executable branch (`recorded-event-intake.ts:164-176`) runs `recording.noteEvent()`
   once, sends `client.recording_event` with `metadata.inputId`, then sends evidence.

Before this change `recordedInputId` did not pass `tab` to the domain, so a tab
event could never have been executable.

**Proof.** A row in `recorded-event-intake.test.ts` uses the real intake, the real
gateway payloads and the real domain mapping:
- a switch and a close count 2 and are sent with `web.user.tab_switched` and `web.user.tab_closed`;
- the marker counts 0 and is not sent.

Mutation M5 breaks it.

### Replay, in the runtime

**`runtime/browser-tab.ts`.**
- **`selectTabForSwitch` accepts `urlPath`.**
  - It matches the exact pathname, and the newest tab id wins among matches.
  - It never matches a browser or extension page.
  - An id still beats a path, and a path beats a pattern.
- **A switch by path waits for its tab.** It looks again every 100 ms, up to
  `action.timeoutMs`, or 10 s when the command names none. A switch by id or pattern
  does not wait, as before.
- **On a match:**
  1. The tab driven before is remembered: the page in front, or the target's
     `openerTabId` when the browser has already fronted the target.
  2. The target is fronted and becomes the automation tab.
  3. `waitForTabReady` runs only when the tab's status is not `complete`.
  4. A tab already in front succeeds.
- **The failure record is unchanged:** `TARGET_NOT_FOUND`, actual
  `no open tab matched`. The expected text for a path is `a tab at path "<path>" active`.
- **A close of the automation tab** fronts the most recently driven tab that is still
  open. It returns that tab's URL, with validation actual `tab 6 closed; tab 5 active`.
  Closing a named tab that is not the automation tab fronts nothing.

**`runtime/automation-tab.ts`.**
- It keeps a history of up to 8 driven tabs, and `setAutomationTab` adds to it.
- `forgetAutomationTab(id)` removes a tab, so the automation tab falls back to the one before.
- New `latestOpenAutomationTab()` skips, and forgets, tabs that have closed.
- `resolveAutomationTab` behaves as before.

### Task 4: does the runner record anything when it fronts a page or closes its control page?

**No, not in the isolated lane** (the bench and single runs). This follows from where
those calls sit relative to the recording:

- **Before the recording starts** (`fluxiq.startRecording`, `run-scenario.ts:281`):
  - `page.bringToFront()` (`:208`);
  - `activateScenarioTab` (`:211`, `:564-573`);
  - the Core action probe, which opens an automation tab and closes it
    (`proveCoreActionRoundTrip`, `:267`; `automationPage.close()`, `:561`).

  The recorder ignores every event while no recording runs, and a recording starts
  from the page in front.
- **While recording** (`:290-300`), the only fronting is `ScenarioTabs.switchTo` and
  `closeActive` (`scenario-steps/scenario-tabs.ts:28,46`). These are W15's intended
  switches. Step screenshots call `screenshot()` (`:212`) and front nothing.
- **The control page** is `chrome-extension://…/sidepanel/index.html` (`:517`).
  - It is unsupported, so it is never named and fronting it is never a switch.
  - It closes only with `context.close()` (`:410`), after `stopRecording` (`:306`).
- **`browser-evidence.ts:50-52` fronts pages, but only the demo flows use it**
  (`BrowserEvidenceRecorder` is imported only from `demo-workspace/*`, `demo-llm-*`
  and `secret-keys-ui.ts`), never from `run-scenario.ts`. Fronting the control page
  there is ignored, and fronting the single scenario page again is not a switch.
- **The existing and clone lanes** (`:218-235`, `:244-260`) keep a recording open
  while Core runs a Flow.
  - There, the Flow's own tab changes would look like switches: navigate creating or
    fronting the automation tab, or a replayed switch or close.
  - The runtime guard skips them, provided Chrome's tab event is handled while the
    command's status is still `"running"`.
  - That is unit-proven (M4), not observed live.

## Commands run and observed results

All from `apps/extension` unless noted.

**Type checks**
- `pnpm exec tsc -p tsconfig.json --noEmit`, source only, before the tests existed:
  exit 0.
- `pnpm check`, first run: exit 2.
  - `recorded-event-intake.test.ts(366,50): error TS2339: Property 'payload' does not exist on type 'never'`, and the same at (367,52).
  - Cause: `assert.deepEqual(h.sent, [])` narrowed `h.sent` to `never[]`. Fixed by asserting its length.
- `pnpm check`, second run: exit 0.

**Unit tests**
- `EXTENSION_TEST_BUILD_LABEL=ftr pnpm test` (smoke test and units): exit 0,
  `# tests 459`, `# pass 459`, `# fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=ftr node scripts/test-extension.mjs`, rerun alone after
  the mutations: exit 0, 459 of 459.

**Structure audit** (repository root)
- Command: `GIT_INDEX_FILE=<scratch copy of .git/index> node scripts/structure-audit.mjs`,
  after `git add -N` of the three new files in that scratch index only.
- Result: exit 0, `structure-audit: passed (39 warning(s), 17 baselined).`
- Warnings this change touches, both advisory:
  - `apps/extension/src/background/connection/: 24 source files` (advisory 15, limit 25; was 23);
  - `apps/extension/src/shared/protocol.ts: 449 lines` (was 446, already past the advisory 400).
- No baseline entry needs to change.

**Mutation proofs**

Script: `scratchpad/ftr/mutate.mjs`. Each mutation replaces one exact string, runs
`node scripts/test-extension.mjs` under label `ftr`, restores the file from a byte
copy, and compares the bytes. All eight were restored identical (`Buffer.compare` 0).

| Mutation | What it breaks | Failing test |
| --- | --- | --- |
| M1 | Recorder's unsupported-page guard: `if (!url \|\| unsupportedPageForUrl(url))` becomes `if (!url)` | `not ok 162 - a page a recording cannot see records no switch, and passing through one is not a switch` |
| M2 | Exact path becomes substring: `pagePath(tab.url) !== urlPath` becomes `!(tab.url ?? "").includes(urlPath)` | `not ok 383 - a switch by path takes the tab at exactly that path, the newest of several, and never a browser page` |
| M3 | Close only of the current tab (`tabId !== this.currentTabId \|\|` dropped) | `not ok 165 - closing the tab the recording is in records a close; closing another tab does not` |
| M4 | Runtime guard removed | `not ok 167 - a tab change FluxIQ makes while running a command records nothing, and the recording follows it` |
| M5 | `tab` not passed to `recordedInputId` | `not ok 89 - a recorded tab switch or close maps to its input and crosses carrying its operation and path`; `not ok 119 - a recorded tab switch and close are each counted once and sent with their input ids; the recording-start marker is neither` |
| M6 | Close no longer fronts the prior tab | `not ok 386`, `not ok 387`, `not ok 388` (the three close rows) |
| M7 | Commit bound removed | Rerun alone: `not ok 164 - a new tab that commits later than the bound records no switch, but the recording follows it` |
| M8 | Switch no longer waits for an opening tab | Rerun alone: `not ok 384 - a switch by path waits for a tab still opening, fronts it, and remembers the tab the Flow was on`; `not ok 385 - a switch by path whose tab never opens fails target_not_found once its timeout passes` |

**M7 and M8's first runs also failed tests 89 and 119. That came from the domain
worker, not from these mutations.**
- Test 89's output shows the recording-start marker mapped to `web.user.tab_closed`.
  That matches the domain worker's own mutation, dropping the `tab` presence check.
- `domain/src/io/input-model.ts` was modified at 06:47:36 and `output-nodes/payloads.ts`
  at 06:47:34, seconds before I read them.
- The unmutated suite, rerun alone, then passed 459 of 459.
- Rerun alone, M7 and M8 failed only the tests in the table.

**Cleanup:** `rm -rf apps/extension/.test-build-scratch/ftr`, then confirmed the
directory is gone.

**Not run, and why:**
- The content harness: tabs live only in the service worker, and the report's Proof
  rules it out.
- `pnpm build` and any `pnpm lab` command: forbidden in this dispatch.

## Not verified

**Nothing ran in a browser.** In particular:
- Whether Chrome fires `tabs.onActivated` for a `target="_blank"` tab and for
  Playwright's `bringToFront`, and whether `tab.url` is empty at that moment. The
  waiting path handles both answers.
- **Chrome's event order when a tab closes.** The design relies on `tabs.onRemoved`
  for the closed tab being handled before `onActivated` for the tab Chrome fronts
  next. `background/index.ts`'s `onActivated` handler adds a `chrome.tabs.get` round
  trip, which helps. If the order is reversed:
  - the recorder has already moved to the fronted tab, so no close is recorded;
  - the recording reads switch, switch;
  - replay still ends on the list, but the details tab stays open.
- **The runtime guard's timing** in the existing and clone lanes.
- **`openerTabId`** for a link's tab during replay.
- **Arrival order at Core.** A switch is sent after its snapshot capture finishes, so
  an event the new page sends meanwhile could reach Core first. That is already true
  of every executable event.
- **The `onRemoved` listener in `background/index.ts` has no unit test.** The module
  registers Chrome listeners as it loads, and the Node runner cannot import it. Only
  the type check covers it.
- **The architecture pages are not updated.** The dispatch schedules one pass once
  these workers land.

**What a Lab run must show:**
- **W15 unarmed, both lanes.**
  - Between the two clicks, the recording holds three `web.tab.state_changed` entries
    that carry `tab`, in this order:
    1. a switch to the details path, input `web.user.tab_switched`;
    2. a close, input `web.user.tab_closed`;
    3. a switch to the list path.
  - The extension's `eventCount` equals Core's recorded action count.
  - The Flow runs click, tab, tab, tab, click, all succeeded, and the confirm click
    runs on the order list.
  - The final state holds. That also needs H6 and the Flow-lane extract decision.
- **W15 `popup-blocked`:** still `output_not_observed`.
- **Every other week1 row:**
  - `flow-lane.json` lists no `web.browser.tab`;
  - no recorded entry carries `tab`;
  - the recording-start marker is still evidence.
- **One existing-lane or clone-lane run:** no recorded `tab` entry comes from the
  Flow's own navigate.

## Open questions or contradictions found

1. **The brief drew ownership around a file, not the change.**
   - It owns `connection.ts` "the `handleTabRemoved` facade method only". Without
     building the recorder in the constructor and handing it to `ActivePage`,
     nothing would ever call it.
   - `connection.ts` must import it through `background/connection/index.ts`, which
     the imports audit enforces, and that barrel is not owned.
   - I made both edits minimal:
     - in `connection.ts`: a header line, the import, the field, the construction and two `ActivePage` dep lines;
     - in the barrel: one export line.
   - Please confirm or revert.
2. **The runtime guard and `f-capability-confirmations` must stay consistent.** A
   runtime tab action enters a recording through its confirmation only, and the
   recorder skips tab changes while a command runs.
3. **A close is recorded only for the tab the recording is in**, not for any tab
   the recording attached. The reason is under "What changed".
4. **A path match ignores the origin.** With two tabs at one path on different
   origins, the newest wins (a test row shows `other.test` chosen). That is fine for
   the Lab's single scenario origin; a later design could prefer the automation
   tab's origin.
5. **A blank tab followed by a typed URL.** If someone opens a blank tab and types a
   URL within 10 s, a switch is recorded before the typed navigation. Replaying that
   switch would wait for a tab that does not exist yet and fail as
   `target_not_found`. No corpus row does this.
6. **The activity log labels a tab action `browser.tab`.** The label comes from
   `activityLabel` in `recorded-event.ts`, which I do not own.
7. **`ActivePage.select` during a recording would record a switch.** It is reached
   through the `fluxiq.test.setActiveTab` message, a test path.
