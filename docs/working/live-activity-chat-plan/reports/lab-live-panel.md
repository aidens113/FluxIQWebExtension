# Report: lab-live-panel (E4), lane t185

## Outcome

**Done** within my owned files.

- **Built and checked:** the mode choice, the side-panel and popup openers, the CLI parsing and the wiring are built, unit-tested and type-checked.
- **One gap:** `--no-live-panel` parses but reaches the runner only once `cli.ts`, which I do not own, passes it through (see Not verified).
- **No live run:** no browser run was made; the lead does the headed run.

## What changed and why

New module `packages/test-runner/src/run-scenario/browser-session/live-panel/`:

- `choose-live-panel-mode.ts` defines `chooseLivePanelMode(choice, openers)`, the mode decision. It returns `skipped` (`--no-live-panel` or `headless`), `side-panel`, `popup` (which keeps `sidePanelRefusal`) or `none` (with both reasons). It never throws: when an opener throws, that counts as a refusal.
- `side-panel.ts` defines `openSidePanel(extensionPage, origin, timeoutMs)`. It adds a button to the extension control page (`sidepanel/index.html`, opened as a tab). The button's click handler calls `chrome.sidePanel.open({ tabId })` synchronously. The tab id is the scenario tab, found with `tabs.query({ url: origin/* })`, preferring the active tab, and it is fixed before the click. Playwright clicks the button (`locator.click({ force: true })`) as a trusted CDP input. A resolved `open()` does not count as success on its own: the panel counts as open only once `chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL"] })` returns a context. The button is always removed afterwards.
- `docked-popup.ts` defines `openDockedPopup(...)`. It opens `chrome.windows.create({ url: sidepanel/index.html, type: "popup", focused: false })` at the right edge of the scenario window, 420 px wide and as tall as that window, pulled back onto the screen if the screen is narrower. It waits until the popup tab has status `complete` on the panel URL. If that fails, it closes the popup. Either way it then activates another tab in the scenario window and then the scenario tab again. **Why:** the extension (`background/connection/active-page.ts` `handleTabUpdate`) treats whichever tab last fired `onActivated`/`onUpdated` as active, and the popup's tab fires both. `activateScenarioTab`'s `tabs.update(id, {active:true})` on an already-active tab fires no event, so without this step the run would wait for a status that never comes.
- `open-live-panel.ts` defines `openLivePanel(extensionPage, { enabled, headless, scenarioOrigin, timeoutMs = 5000, log })`. It wires these together and logs `[lab] live panel: <mode> (...)`.
- `index.ts` is the barrel. The `browser-session/index.ts` barrel re-exports it.

Wiring:

- `launch-browser.ts` adds `--window-size=1700,1000` and returns `headless` (always `false`).
- `run-scenario.ts`:
  - adds a `livePanel?: boolean` option (default on);
  - after `openScenarioStart` and `page.bringToFront()`, and before the at-load facts, pairing and `activateScenarioTab`, runs `bundle.writeStructured("snapshots/live-panel.json", await openLivePanel(extensionControl, …))`, with the log line going to stderr.
- `interactive-session.ts`:
  - `livePanel?: boolean` option, `--window-size=1700,1000`, and `openLivePanel` after `scenarioPage.bringToFront()`;
  - the ready line now carries `livePanel: <outcome>`.
- `commands.ts`:
  - `--no-live-panel` on `run`, `matrix` and `interactive`, giving `livePanel: false`. The key is absent otherwise.
  - It takes no value and is removed before positionals are read, like `--dry-run`.
  - Duplicates are refused; `bench` refuses it as unknown.
  - The usage string is updated.

Scenario-tab isolation: the side panel and the popup are both `chrome-extension://` pages. Every place that picks a scenario tab or page filters by the fixture origin: `activateScenarioTab`, `findScenarioPageWithExpectedState`, the blanking at run-scenario L302, `ScenarioTabs.hasPath`, `ConsoleErrorWatch`, and the interactive `executeExtensionAction` URL match. None of them can pick the panel.

## Commands run and observed results

- `mkdir C:/Users/osrs_/FluxStuff/build-slots/b1`: claimed after waiting, with owner `t185 E4 test-runner build+focused-tests+check 2026-09-30T01:40:48Z`, and removed by trap on exit.
- `pnpm build` (packages/test-runner) -> `build exit 0`.
- `node --test --test-concurrency=2` over these files -> `# tests 115 # pass 114 # fail 1`:
  - `dist/run-scenario/browser-session/live-panel/tests/*.test.js` and `browser-session/tests/*.test.js`;
  - `tests/commands.test.js` and `tests/interactive-session.test.js`;
  - `guarded-browser/tests/launch-containment.test.js`;
  - `run-evaluation/tests/runner-wiring.test.js` and `single-run-evaluation.test.js`;
  - `tests/scenario-assertions.test.js` and `flow-lane/tests/lane-observation.test.js`.
  - The one failure is `runner-wiring.test.ts` "the redaction attestation scans once Core has stopped…" (`expected: true, actual: false`). **It already fails before my change.** Its `source.includes('runRedactionScopes({ bundleStagingPath: … workspaceWrittenSince: target.mode === "persistent-isolated" ? … })')` check is `false` on `git show HEAD:packages/test-runner/src/run-scenario.ts` too, and my edits touch none of its anchors: every indexOf anchor shifts by the same +585 and the order is unchanged.
  - Every new test passes: 6 mode-choice tests, 9 opener and `openLivePanel` tests, and 1 CLI test.
- `pnpm check` (packages/test-runner, `tsc --noEmit`) -> `check exit 0`.
- `node scripts/structure-audit.mjs` (repo root) -> `2 violation(s) across 2 rule(s)`. Neither is in my files: the `docs/working/README.md` failure was there before my edits, and the other is `apps/extension/src/panel/chat/chat-panel.ts` imports (E3). The only mention of my files is the advisory warning `run-scenario.ts: 706 lines`, up from 703.
- The whole package `pnpm test` suite was not run; only the focused files above.

## Not verified

- **No browser run was made (brief rule).** Nothing here has shown that Playwright's click on a background control-page tab counts as a user gesture for `sidePanel.open` in the Lab's Chromium, or that `getContexts` reports `SIDE_PANEL` there. If either fails, the popup fallback runs and the reason is recorded.
- **`--no-live-panel` does not yet reach the runner.** `cli.ts` is not in my owned paths, so the flag parses (`livePanel: false` on the command) but `cli.ts` does not pass it on. The lead needs to add `...(command.livePanel === false ? { livePanel: false } : {})` in three places: the `runInteractiveSession({...})` call (cli.ts ~L31), the run lane's `runScenario({...})` call (~L107) and the matrix `runScenario({...})` call (~L117). Until then the panel is always on in headed runs, which is the intended default.
- The bench (`bench/run-bench.ts`) calls `runScenario` without `livePanel`, so bench runs show the panel too, as the default. The brief gave no bench flag.
- Two panel instances run at the same time: the control-page tab and the real side panel (or popup) both load `sidepanel/index.html`. Whether two panel instances interfere with each other in the extension (duplicate polling, pairing UI) is E3/E1 territory and is unverified.

## How the lead verifies it in one headed run

1. First add the three `cli.ts` pass-throughs above.
2. Do one headed provider-free run on a realistic scenario in `lab-slots/slot-2`, for example `pnpm lab run company-website`, or whatever the lane uses.
3. Check the run:
   - stderr has the line `[lab] live panel: side-panel (verified open)`, or `popup (side panel refused: …)`;
   - the bundle has `snapshots/live-panel.json` with the same `mode`;
   - on screen, the FluxIQ panel sits at the right of a roughly 1700x1000 window next to the 1280-wide page (or in a docked popup);
   - the run passes pairing and `activateScenarioTab`, so the extension status `activeTabUrl` is the fixture URL, not `chrome-extension://…`.
4. Run the same command again with `--no-live-panel`. `live-panel.json` must say `{"mode":"skipped","reason":"--no-live-panel"}` and no panel may appear.

## Open questions or contradictions found

- The brief's owned paths exclude `cli.ts`, but the flag has to go through it (see above).
- Structure audit: my files add no violation. The two failures present are `docs/working/README.md` being out of date (it was there before my edits) and `apps/extension/src/panel/chat/chat-panel.ts` barrel imports (E3's work in progress).
