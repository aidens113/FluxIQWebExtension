# t193-wC report: Lab screenshots

## Outcome

Done. Live Lab runs now have a real `ScreenshotAdapter`. On Windows it captures the run's own Chromium window with `PrintWindow(PW_RENDERFULLCONTENT)`, so the page, the side panel (or docked panel popup) and the overlay are in one frame, and focus never moves. The browser process is found by the run's profile directory. When that fails, or on another platform, the fallback is a Playwright screenshot of the scenario tab that is in front. Each capture is bounded to 4 s in total. Pictures are taken at the existing dispatch, settle, gateway, error and `final` events, every 15 s while the run works, and once more at the end of a failed run.

**Important caveat, which the supervisor needs to act on.** 9 of the 10 realistic scenarios declare no `evidencePolicy`, so `effectiveEvidencePolicy` resolves `screenshots: "none"`. Only `company-website` declares `events`. For every other scenario, the controller suppresses each picture as `policy`, and the periodic scheduler does not start. Live runs must pass `--evidence events` (or `checkpoints`) until the manifests or the default change. Both of those files are outside this brief.

## What changed and why

New directory `packages/test-runner/src/run-scenario/window-capture/`, with a barrel and one export per file:

- `window-capture-source.ts`: the C# helper source (`String.raw`). `processes` lists chrome.exe and msedge.exe processes as `pid TAB ppid TAB commandLine` through WMI. `capture <pid> <quality>` enumerates the visible, non-minimized, non-cloaked, titled top-level windows of that pid. It `PrintWindow`s each one with `PW_RENDERFULLCONTENT`, composites them at their screen positions (back to front), caps the width at 2400 and writes a JPEG to stdout. It exits 2 when the process has no visible window. It calls `SetProcessDPIAware` so the rectangles are in physical pixels.
- `ensure-window-capture-helper.ts`: compiles the helper once with the .NET Framework `csc.exe` into `%TEMP%/fluxiq-window-capture/window-capture-<sha16>.exe`. Each build goes to a unique staged name and is then renamed, so concurrent lanes are safe. The loser of the rename race uses the winner's executable.
- `run-window-capture-helper.ts`: runs the helper hidden (`windowsHide`) with an AbortSignal, so the deadline kills it. A non-zero exit rejects with `exitCode`. Output is capped at 16 MB.
- `find-browser-process.ts` and `parse-process-list.ts`: pure lookup of the browser process by `--user-data-dir`. Matching ignores case and separator style and handles all three Windows quotings. Child processes (`--type=`) are excluded, and when several candidates remain, the root one wins.
- `with-deadline.ts`: bounded timeout. It aborts the signal and rejects at the deadline.
- `capture-first-available.ts`: the fallback order. Sources run in order inside one deadline, each capped by its own `timeoutMs`. It never rejects: each failed source becomes a reason in `failures`.
- `native-window-source.ts`: the Windows source. It remembers the pid and forgets it on exit 2.
- `front-tab-source.ts`: the fallback. It only photographs a scenario-origin tab whose `document.visibilityState` is `visible`, with a Playwright timeout of 3 s. It never calls `bringToFront`.
- `run-screenshot-adapter.ts`: `createRunScreenshotAdapter`.
  - The helper starts compiling when the adapter is created, before topology start.
  - `step.start` and `step.complete` are skipped. Two captures per scripted step would slow a recording whose timing competes with the site's own timers, so those events keep publishing `capture-unavailable` as before.
  - It answers `undefined` before the browser exists and after the context emits `close`, so cleanup-phase events pay nothing.
  - It logs each distinct failure reason once to stderr (at most 20 lines).
- `periodic-capture.ts`: `PeriodicCapture` publishes a `checkpoint` event every 15 s through the run's own controller, so `maxScreenshots` and `maxBytes` are enforced there.
  - It uses at most 80% of `maxScreenshots` and stops when the controller answers `quota` or when a publish fails (the error is kept in `failure`).
  - Ticks never overlap, and its timer is `unref`'d.
  - `stop({ finalCapture })` waits for any capture in flight and then takes "The browser as the run ended". It never throws.
  - It does nothing under the `none` policy.

`checkpoint` was chosen because it is captured under both the `checkpoints` and `events` policies. The evaluation and the bench read only `final` and `error` (`closingSequences`), so these events cannot change a verdict.

`packages/test-runner/src/run-scenario.ts`, net -10 lines:
- `screenshotAdapter = createRunScreenshotAdapter({ session: () => context && topology ? {...} : undefined, log })`, which replaces `= undefined` and its 15-line comment with a 3-line one.
- `const periodicCapture = new PeriodicCapture({ policy: evidence.capture, trigger })`.
- `periodicCapture.start()` right after `launchBrowser`.
- `await periodicCapture.stop({ finalCapture: verdict !== "passed" })` as the first statement of `finally`, before cleanup changes the screen.
- The comment above the failure capture in `catch` no longer says "No picture is taken".

`packages/test-runner/src/run-scenario/index.ts`: one line, `export * from "./window-capture/index.js";`.

## Commands run and observed results

- Scratch proof, before any repository code: `csc.exe ... window-capture.cs`, then `wc.exe capture 22248 70` against a live Lab Chromium that was running at the time. Exit 0 in 0.39 s, producing a 116 KB JPEG that shows the bigbox-retail page with the FluxIQ side panel ("FluxIQ is working / Clicking 'Accept all'"). Nothing was focused. `wc.exe capture 999999` exited 2 with "no visible window belongs to process 999999". `wc.exe processes` listed that Chromium with its `--user-data-dir`. The images are in the scratchpad `t193/wC/`, not in the repository.
- `bash .../heavy.sh "t193-wC test-runner build" pnpm --filter @fluxiq-web-extension/test-runner build`: built three times, the final build in 48.9 s, with no tsc errors.
- `node --test dist/run-scenario/window-capture/tests/*.test.js`: 21 tests, 21 pass, 0 fail. The four brief-required areas are covered:
  - lookup by profile directory against an injected four-lane process list;
  - the bounded timeout (rejects at about 50 ms and aborts the signal);
  - the fallback order (native first, fallback on failure, a hung source cut, the deadline shared, an empty image skipped);
  - the periodic scheduler (interval, nothing after stop, the in-flight capture awaited, the final capture, the quota share, the quota answer, the `none` policy, a failed publish).
  - Also covered: the adapter skips steps and answers nothing before launch or after close.
- Scratch `prove2.mjs` against the final build, capturing the VS Code window through `nativeWindowSource` with an injected process listing:
  - Three captures of about 133 KB each, taking 242, 169 and 168 ms (0.6-1.0 s in the first session). The process was listed once, because the pid is remembered.
  - A process with no window gave exit 2 and fell through to the fallback in 342 ms.
  - A helper that hangs was cut at 4009 ms, and the fallback was recorded as "no time was left". Afterwards no `Start-Sleep 30` child remained (count 0).
- `node scripts/structure-audit.mjs`: "structure-audit: passed (124 warning(s), 120 baselined)". There are no findings under `window-capture/`. `run-scenario.ts` shows only the existing file-lines advisory (695 lines), so its `failure-as-empty` (3) and `swallowed-failure` (14) counts did not rise.
- Source-pinning tests (`runner-wiring`, `lane-observation`, `launch-containment`, `single-run-evaluation`, `scenario-assertions`, `browser-evidence`): 54 tests, 53 pass. The one failure is `runner-wiring` #27 ("the redaction attestation scans once Core has stopped..."), and it is pre-existing: HEAD's `run-scenario.ts:612` already passes `extensionStorage` to `runRedactionScopes`, while HEAD's test at line 154 still expects the older string. My edits do not touch that line.

## Not verified

- No Lab or browser run was started, as the brief requires. So the adapter has not run inside `runScenario`, and the bundle's `screenshotCount` is unproven for a real run.
- The profile-directory lookup was not proven end to end against a live Lab Chromium with the final build, because that lane's browser had closed by then. It was proven by unit tests and by the raw `processes` output shown earlier.
- The Playwright front-tab fallback was not exercised against a real page. It is covered only through injected sources.
- Multi-monitor and mixed-DPI compositing, and a window that is partly off-screen (the live capture looked cut at the screen's bottom edge), were not checked.
- `redactionVerified: true` is asserted without any pixel redaction, the same as `browser-evidence.ts` does. `sensitive-action` suppression still applies. Whether an unredacted window frame is acceptable when a scenario declares secrets is the supervisor's call.

## Open questions or contradictions found

1. Screenshots are off for 9 of the 10 realistic scenarios (no `evidencePolicy`, so the policy is `none`), as described under Outcome. Use `--evidence events`, or change the manifests or the `effectiveEvidencePolicy` default in a follow-up brief.
2. `runner-wiring` test #27 fails at HEAD, as described above. The test needs updating to the `extensionStorage` form.
3. `run-scenario.ts` and `run-scenario/index.ts` already carried another worker's uncommitted edits in this worktree (`ExtensionStartTrace`, `extensionControlPage`). I kept them unchanged. The supervisor should commit the two sets of changes with that in mind.
