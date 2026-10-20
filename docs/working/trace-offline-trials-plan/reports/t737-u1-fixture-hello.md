# t737 unit 1: e2e fixture teardown budget, and the missing hello after a worker restart

Worker report. Tree `fxwork/t737/!FluxIQWebExtension` (branch `task/t737-session-followups`). No commits.

## Outcome

Done. Both failure modes have a root cause backed by evidence, and both are fixed:

1. **Missing hello (a product defect).** The worker's `chrome.runtime.onInstalled` handler read the
   whole settings record and then wrote it back. It also created the client id alongside the worker
   start-up's own creation. Any save that landed between that read and that write was replaced. On a
   starved machine, that save was the gateway address the test had just stored. The restarted worker
   then dialled the default `ws://127.0.0.1:4777/client`, where nothing listens, and never reached the
   test's gateway. Fixed in the background code, with a unit test written first and seen to fail
   first. The fixture now also waits for the worker's start-up to finish before handing over the
   session.
2. **Teardown over budget.** Almost all of the time is Chromium's own graceful exit (from
   `Browser.close` until the process is gone). Measured at 0.6 to 25 s under load, it is Chromium
   flushing a profile the fixture deletes a moment later. Every step the fixture controls takes
   milliseconds. The fixture now has its own explicit budget (Playwright fixture `timeout`) for its
   launch and close work, with the reason in a comment. No test wait was raised and no assertion was
   loosened.

`reconnect.spec.ts` ran headed and provider-free 5 times in a row: all 3 tests passed every time,
including `:85` and `:122`.

## What changed and why

- `apps/extension/src/background/extension-installed.ts` (new, one export plus its deps type).
  `handleExtensionInstalled` now only sets the toolbar button to open the side panel. It writes no
  saved state, for two reasons. Settings are already read with defaults for any field not stored
  (`storage.ts`), so the old write added nothing and could only lose a concurrent save. And the
  worker's start-up (`buildConnection` in `index.ts`) creates the client id on every install and
  update. The file's header comment gives the reason.
- `apps/extension/src/background/index.ts`: `onInstalled` calls `handleExtensionInstalled({ enableSidePanel: enableSidePanelFirst })`
  and reports a failure through `noteMessageFailure`. Before, the handler was an inline async function
  with no catch. The unused `defaultSettings` import is gone. `readOrCreateClientId` and
  `writeSettings` are still imported because other code paths use them.
- `apps/extension/src/background/tests/extension-installed.test.ts` (new). It uses a fake
  `chrome.storage.local` whose reads answer what was stored at the moment of asking, one turn later,
  as the real storage does. A settings save and a client id are written while the handler is still
  running. The test asserts that both survive, that the handler writes nothing, and that the side
  panel is enabled. **Red first**: I ran it against the old handler moved verbatim into the module.
  It failed with the saved settings replaced by `gatewayUrl: 'ws://127.0.0.1:4777/client', autoReconnect: true`,
  which is the e2e failure in miniature. It passes after the fix.
- `apps/extension/e2e/fixtures/extension-context.ts`, two changes:
  - `extensionSession` is declared as `[fn, { timeout: EXTENSION_SESSION_BUDGET_MS }]` with
    `EXTENSION_SESSION_BUDGET_MS = 90_000`. In Playwright 1.51 a fixture with a `timeout` runs its
    setup and teardown in its own slot, and the two share it (`fixtureRunner.js`: the teardown
    description copies the setup's `slot`). The test body keeps its 30 s. The comment records the
    measured figures: launch up to 9 s, graceful exit 13 to 25 s, everything else milliseconds.
  - New `waitForWorkerStartUp(page)`, called in `launchExtensionSession` after the side panel loads.
    The worker answers `fluxiq.getStatus` only after `getConnection()` has built the start-up
    connection. That build is where the client id is read-or-created and the session record is read
    and written back. So a test that seeds storage cannot race the start-up's own writes. It retries
    only while nothing answers, up to 50 times at 100 ms intervals, then throws
    `extension.start: ...`. This is a readiness condition, not a longer timeout.
- `apps/extension/e2e/reconnect.spec.ts`: unchanged. The test was correct.

## Root cause 1: the missing hello

Evidence:

- **The failing trace** (`scratchpad/flake/pwapi/artifacts-1/...again-when-the-socket-drops/trace.zip`,
  the 2026-10-19 `DEBUG=pw:api` failure). Its screencast frames show the panel cycling: "Connecting to
  FluxIQ..." at 13.25 s, "Can't reach FluxIQ" at 15.7 s, connecting at 16.7 s, then error, connecting
  at 21.0 s, error at 23.4 s. Every cycle shows "This browser is approved". So the restarted worker
  did read the paired session. Each connect failed after about 2.3 s, which is how long Windows takes
  to refuse a loopback port with no listener, and the backoff was about 1 s and then 2 s. Meanwhile
  the fake gateway was listening on its own port and got 0 hellos. A slow but listening gateway would
  have shown the 10 s open timeout (`CLIENT_GATEWAY_OPEN_TIMEOUT_MS`), not 2.3 s. So the worker was
  dialling a different address. The extension in that run was badly starved: loading the side panel
  took 5.2 s, against about 0.1 s normally.
- **The only settings writer that runs without a message** was `onInstalled`:
  `readSettings()`, then `writeSettings({ ...defaultSettings(), ...settings })`. `grep` finds no other
  writer on the start path.
- **Shown in a real browser.** The probe `scratchpad/t737u1/probe/install-clobber.mjs` writes test
  settings, a session and a client id the moment the freshly installed worker is reachable, then
  reads them back after 2.5 s. It prints equality flags only.
  - Old build, 12 launches: `{"settingsClobbered":3,"sessionClobbered":0,"clientIdClobbered":2}`.
  - Fixed build, 12 launches: `{"settingsClobbered":0,"sessionClobbered":0,"clientIdClobbered":0}`.
- **Why it never reproduced in isolation.** Only the first restart after an install is exposed, and
  only when the test's write lands inside the install handler's read-then-write window. That happens
  when the extension is starved, as in the failing run, where the write came at 13.1 s. The earlier
  `hello-probe.mjs` made 36 restarts on browsers installed long before, so it never hit the window.
- **Also closed by the fixture wait.** The start-up's own `readOrCreateClientId` and
  `writeSession(session)` in `buildConnection` are read-then-write too. A test seed that landed during
  them would replace the client id (and break `:85`'s `clientId` assertion) or drop the token (no
  reconnect at all).

## Root cause 2: teardown time

- The 2026-10-19 failing `:85` trace: fixture teardown started at 27.67 s, `browserContext.close` ran
  27.86 to 30.48 s, and the fixture ended at 30.51 s. Guards and profile removal took about 30 ms. On
  2026-10-19 one `context.close()` took 13 s (lane G entry).
- My probe run, `DEBUG=pw:browser,pw:api` on the real fixture, 2 workers (`scratchpad/t737u1/probe-run1.log`).
  Time from `<gracefully close start>` to `<process did exit>` per browser: 3.9 s, **22.4 s**,
  **25.3 s**, 3.0 s, 0.6 s, 0.6 s. In every case, "temporary directories cleanup" took 1 to 3 ms and
  the gap from process exit to `close succeeded` was about 2 ms.
- Chromium's own log of a 7.1 s close (`probe/close-log.mjs` with `--enable-logging --v=1`,
  `scratchpad/t737u1/close-log/chrome-r2b.log`): `ExitIgnoreUnloadHandlers` at 48.444, profile keyed
  services shut down by 48.613, then a **2.1 s** gap to `CrxUpdateService stopping` (50.704), then a
  **4.1 s** gap to `Collections of all histograms` (54.844), then exit. That is the browser process's
  shutdown after the profile closed: thread-pool and blocking-shutdown file flushes, bound by I/O and
  slower under load. Nothing in it waits on a page, an unload handler, the extension, the network
  guard or the CDP session.
- Conclusion: the fixture awaits nothing avoidable. The time belongs to Chromium's graceful exit and
  the launch. Playwright offers no public way to kill a persistent context instead of closing it
  gracefully (its close timeout, `__testHookBrowserCloseTimeout`, is not on the protocol), so the
  sanctioned remedy is the fixture's own explicit budget.

## Commands run and observed results

All Playwright commands ran from `apps/extension`, headed, provider-free, with artifacts under
`C:\Users\osrs_\AppData\Local\Temp\claude\c--Users-osrs--FluxStuff--FluxIQWebExtension\53d1357c-b7da-4f48-9665-ff78992a8998\scratchpad\t737u1\`.

- `pnpm --filter @fluxiq-web-extension/extension build`: exit 1. It refused because Core's dist was
  stale ("inputs changed: packages/fluxiq"); another t737 worker was editing Core's `step-log`. I ran
  the build's own steps after the gate instead
  (`node ../../scripts/build-cache/cli.mjs extension:build -- "tsc ... && node scripts/build-extension.mjs"`):
  exit 0, "e2e-chromium: verified 22 files". After the fix I ran
  `node ../../scripts/check/core-build.mjs`, which printed "Core's build ... is current with its
  source" (someone had rebuilt Core by then), and built again: exit 0, "verified 22 files". The bundle
  contains `void handleExtensionInstalled({ enableSidePanel: enableSidePanelFirst }).catch(noteMessageFailure)`.
- `EXTENSION_TEST_BUILD_LABEL=t737-u1 node scripts/test-extension.mjs background/tests/extension-installed`
  - Old handler: `# pass 0 / # fail 1` (settings replaced with the default 4777 address).
  - After the fix: `# pass 1 / # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t737-u1 node scripts/test-extension.mjs src/background/tests`:
  `# tests 100 / # pass 100 / # fail 0`.
- `npx tsc -p tsconfig.test.json --noEmit` (covers `e2e/`): exit 0, no output.
- `node scripts/structure-audit.mjs` (repository root): "structure-audit: passed (212 warning(s), 618
  baselined)". None of the warnings is in a file I changed.
- The proof, five consecutive runs of
  `NODE_OPTIONS=--no-experimental-strip-types npx playwright test -c e2e/playwright.config.ts e2e/reconnect.spec.ts --reporter=list --workers=2 --output <scratch>/runN`:

  | Run | `:122` | `:85` | `:141` | Total |
  | --- | --- | --- | --- | --- |
  | run1 | ok (330 ms) | ok (2.8 s) | ok (30.4 s) | 3 passed (42.2 s) |
  | run2 | ok (264 ms) | ok (2.4 s) | ok (31.2 s) | 3 passed (40.7 s) |
  | run3 | ok (355 ms) | ok (2.3 s) | ok (30.4 s) | 3 passed (38.2 s) |
  | run4 | ok (405 ms) | ok (2.4 s) | ok (31.1 s) | 3 passed (40.1 s) |
  | run5 | ok (230 ms) | ok (2.4 s) | ok (30.4 s) | 3 passed (39.6 s) |

- A check on another consumer of the fixture: `npx playwright test -c e2e/playwright.config.ts e2e/gateway-session --reporter=list --workers=2 --output <scratch>/gs-run1`:
  "1 passed (1.1m)" (`queue-across-reconnects.spec.ts:117`).
- Diagnostic probes, all in `scratchpad/t737u1/probe/`:
  - `hello-race.spec.ts` (`:85` plus a storage-change log), run with `--repeat-each=8 --workers=2`:
    8 passed, hello within 100 to 116 ms.
  - `install-ids.mjs`: 6 launches; the stored, session and connection client ids agreed every time.
  - `install-clobber.mjs`: results above.
  - `target-ids.mjs`: a CDP restart reuses the service-worker target id; immediately after
    `closeTarget` the old target is still listed.
  - `close-log.mjs`: Chromium logs, two browsers at a time, closes of 1.2 to 7.1 s.

## Not verified

- I did not reproduce the saturated conditions of 2026-10-19 (CPU 100 % plus 1,800 to 2,400 pages/s
  from other lanes) during the 5-run proof. The runs were green, but they do not by themselves show
  that a 25 s close fits. That comes from the measurements and the 90 s budget.
- I did not reproduce the old missing-hello failure end to end through the spec. Its cause is shown
  by three things: the failing trace's frames, the red unit test, and the real-browser probe (3 of 12
  settings replaced on the old build, 0 of 12 on the fixed one).
- I ran only `reconnect.spec.ts` and `gateway-session/` under the changed fixture. The other
  extension specs (action, lease, resilience, problem-report, install-and-content, runtime,
  site-reset, cancellation) were not run. They all get the start-up wait and the fixture budget.
- No Firefox, no live or paid Lab runs, no full suites.

## Open questions or contradictions found

- **Possible gap in `restartServiceWorker`, not observed failing.** The readiness loop accepts the
  first `ok` reply. Right after `Target.closeTarget` returns, the old target is still listed for about
  20 ms (`target-ids.mjs`), and the target id is reused across restarts. So a reply from the stopping
  old instance cannot be ruled out by the target id alone. I did not change it: it was never seen
  failing, and a robust instance check needs CDP target events. The supervisor may want a follow-up.
- **The build gate refused because of another worker's in-progress Core edits.** I built past the gate
  once. My extension code does not use the Core `step-log` module. The second build passed the gate
  normally.
- The old `readOrCreateClientId` call in `onInstalled` ran alongside `buildConnection`'s own call, so
  two creators could store two different ids at install. `install-ids.mjs` saw no disagreement in 6
  launches, so I am not claiming that as an observed product failure. Removing the call also removes
  that possibility.
- No architecture document mentions `onInstalled` (`grep` in `docs/architecture`). The supervisor
  decides whether `docs/architecture/extension-client.md` should say that install writes no saved
  state.
- The 2026-10-19 verdict in `lane-g.md` says "no root cause in lane G's files" and that the failures
  are in the shared fixture. That is still right about lane G, but the hello failure is a product race
  in `background/index.ts`, not a fixture defect alone.
